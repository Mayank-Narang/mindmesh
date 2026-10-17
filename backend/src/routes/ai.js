const express = require("express");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Note = require("../models/Note");
const NoteChunk = require("../models/NoteChunk");
const Brain = require("../models/Brain");
const { authenticate } = require("../middleware/auth");
const { getBrainAccess, canRead } = require("../services/access");
const { generateQueryEmbedding } = require("../services/vector");

const router = express.Router();
const CHUNK_VECTOR_INDEX = process.env.CHUNK_VECTOR_INDEX || "note_chunks_vector_index";

// Protect all AI routes with JWT authentication
router.use(authenticate);

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// POST /api/ai/ask  —  RAG-based Q&A with SSE streaming
//
// Body: { question: string, brainId?: string }
//
// Stream events:
//   event: sources  -> data: { sources: [{ id, title, snippet, score, chunkIndex }] }
//   event: message  -> data: { text: string }
//   event: done     -> data: { done: true }
//   event: error    -> data: { error: string }
// ---------------------------------------------------------------------------
router.post("/ask", async (req, res) => {
  const { question, brainId } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required" });
  }

  if (brainId) {
    if (!mongoose.Types.ObjectId.isValid(brainId)) {
      return res.status(400).json({ error: "Invalid brain ID" });
    }
    const targetBrain = await Brain.findById(brainId);
    if (!targetBrain) {
      return res.status(404).json({ error: "Brain not found" });
    }
    const access = getBrainAccess(targetBrain, req.user.id, req.user.email);
    if (!canRead(access)) {
      return res.status(403).json({ error: "You do not have access to this brain" });
    }
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const userEmail = (req.user.email || "").toLowerCase();

    // Find all brains the user has access to
    const accessibleBrains = await Brain.find({
      $or: [
        { author: req.user.id },
        { "sharedWith.user": req.user.id },
        { "sharedWith.email": userEmail },
      ],
    }).select("_id");
    const accessibleBrainIds = accessibleBrains.map((b) => b._id);

    // Build security access filter for parent note
    const parentSecurityMatch = {
      $or: [
        { "parentNote.author": userId },
        { "parentNote.sharedWith.user": userId },
        { "parentNote.sharedWith.email": userEmail },
        { "parentNote.brain": { $in: accessibleBrainIds } },
      ],
    };

    const directSecurityMatch = {
      $or: [
        { author: userId },
        { "sharedWith.user": userId },
        { "sharedWith.email": userEmail },
        { brain: { $in: accessibleBrainIds } },
      ],
    };

    const parentFilters = {};
    const vectorFilters = {};
    if (brainId) {
      const bOid = new mongoose.Types.ObjectId(brainId);
      parentFilters["parentNote.brain"] = bOid;
      vectorFilters.brain = bOid;
      directSecurityMatch.brain = bOid;
    }

    // 1. Generate query embedding for retrieval
    const queryEmbedding = await generateQueryEmbedding(question.trim());

    let sources = [];
    const limit = 5;

    if (queryEmbedding) {
      // 2. Vector search over NoteChunk collection with parent note aggregation
      const pipeline = [
        {
          $vectorSearch: {
            index: CHUNK_VECTOR_INDEX,
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: limit * 15,
            limit: limit * 8,
            ...(Object.keys(vectorFilters).length ? { filter: vectorFilters } : {}),
          },
        },
        {
          $addFields: {
            score: { $meta: "vectorSearchScore" },
          },
        },
        {
          $lookup: {
            from: "notes",
            localField: "note",
            foreignField: "_id",
            as: "parentNote",
          },
        },
        {
          $unwind: "$parentNote",
        },
        {
          $match: {
            $and: [
              parentSecurityMatch,
              parentFilters,
            ],
          },
        },
        {
          $sort: { score: -1 },
        },
        {
          $group: {
            _id: "$note",
            parentNote: { $first: "$parentNote" },
            score: { $first: "$score" },
            bestChunkContent: { $first: "$content" },
            bestChunkIndex: { $first: "$chunkIndex" },
          },
        },
        {
          $sort: { score: -1 },
        },
        {
          $limit: limit,
        },
      ];

      try {
        const aggregated = await NoteChunk.aggregate(pipeline);
        if (aggregated && aggregated.length > 0) {
          sources = aggregated.map((item) => ({
            id: item.parentNote._id.toString(),
            title: item.parentNote.title,
            snippet: item.bestChunkContent,
            score: item.score,
            chunkIndex: item.bestChunkIndex,
          }));
        }
      } catch (vectorErr) {
        console.warn("Atlas vector search in AI route failed, attempting fallback:", vectorErr.message);
      }

      // In-memory cosine similarity fallback if Atlas vector search stage is not present
      if (sources.length === 0) {
        try {
          const chunkQuery = {
            isEmbedded: true,
            embedding: { $exists: true, $ne: [] },
            ...(brainId ? { brain: new mongoose.Types.ObjectId(brainId) } : {}),
          };

          const chunks = await NoteChunk.find(chunkQuery)
            .populate("note")
            .lean();

          const candidates = [];
          for (const chunk of chunks) {
            const parent = chunk.note;
            if (!parent) continue;

            const parentAuthor = parent.author ? parent.author.toString() : "";
            const isAuthor = parentAuthor === req.user.id;
            const isBrainShared = parent.brain && accessibleBrainIds.some(
              (bId) => bId.toString() === parent.brain.toString()
            );
            const isNoteShared = (parent.sharedWith || []).some((s) => {
              const sUser = s.user ? s.user.toString() : "";
              const sEmail = (s.email || "").toLowerCase();
              return sUser === req.user.id || sEmail === userEmail;
            });

            if (!isAuthor && !isBrainShared && !isNoteShared) continue;
            if (brainId && (!parent.brain || parent.brain.toString() !== brainId.toString())) continue;

            const score = cosineSimilarity(queryEmbedding, chunk.embedding);
            if (score >= 0.70) {
              candidates.push({
                parentNote: parent,
                score,
                content: chunk.content,
                chunkIndex: chunk.chunkIndex,
              });
            }
          }

          candidates.sort((a, b) => b.score - a.score);

          const noteMap = new Map();
          for (const item of candidates) {
            const noteId = item.parentNote._id.toString();
            if (!noteMap.has(noteId)) {
              noteMap.set(noteId, item);
            }
          }

          sources = Array.from(noteMap.values())
            .slice(0, limit)
            .map((item) => ({
              id: item.parentNote._id.toString(),
              title: item.parentNote.title,
              snippet: item.content,
              score: item.score,
              chunkIndex: item.chunkIndex,
            }));
        } catch (_fallbackErr) {
          // fallback failed, continue to keyword search
        }
      }
    }

    // 3. Fallback: if vector retrieval yielded 0 sources, use text search
    if (sources.length === 0) {
      const fallbackNotes = await Note.find(
        { $text: { $search: question }, ...directSecurityMatch },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .select("title content type tags");

      sources = fallbackNotes.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        snippet: (n.content || "").substring(0, 300),
        score: null,
        chunkIndex: 0,
      }));
    }

    // 4. Emit sources event
    sendEvent("sources", { sources });

    // 5. Build grounded context and strict prompt
    const contextText = sources
      .map(
        (s, i) =>
          `[Source ${i + 1}: "${s.title}" (Chunk #${(s.chunkIndex ?? 0) + 1})]\n${s.snippet}`
      )
      .join("\n\n");

    const prompt = `You are MindMesh, an intelligent AI research assistant. Answer the user's question accurately, concisely, and factually using ONLY the provided sources.

Rules:
1. Base your answer strictly on the facts directly stated in the sources. Do not extrapolate or speculate.
2. Cite your sources using bracketed notation like [1], [2] immediately following the corresponding statement.
3. If the provided sources do not contain sufficient context to answer the question, state clearly: "I couldn't find enough information in your notes to fully answer this question."
4. If asked about something contradicted by the sources, follow the sources.

Sources:
${contextText || "No relevant notes found."}

Question: ${question.trim()}

Answer:`;

    // 6. Stream the Gemini response
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey || process.env.NODE_ENV === "test") {
      // Fallback message when Gemini API key is not configured
      const fallbackAnswer = sources.length
        ? `Based on your notes, I found ${sources.length} relevant source(s): ${sources
            .map((s, i) => `[${i + 1}] "${s.title}"`)
            .join(", ")}. (Gemini API key not configured — full AI answer unavailable)`
        : "I couldn't find any relevant notes for that question. Try rephrasing or adding more notes to your knowledge base.";

      for (const word of fallbackAnswer.split(" ")) {
        sendEvent("message", { text: word + " " });
        await new Promise((r) => setTimeout(r, 15));
      }
      sendEvent("done", { done: true });
      return res.end();
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        sendEvent("message", { text: chunkText });
      }
    }

    sendEvent("done", { done: true });
    res.end();
  } catch (err) {
    console.error("AI Q&A error:", err.message);
    sendEvent("error", { error: "Failed to generate answer. Please try again." });
    res.end();
  }
});

module.exports = router;
