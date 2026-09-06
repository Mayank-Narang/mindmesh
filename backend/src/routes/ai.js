const express = require("express");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Note = require("../models/Note");
const { authenticate } = require("../middleware/auth");
const { generateQueryEmbedding } = require("../services/vector");

const router = express.Router();

// Protect all AI routes with JWT authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /api/ai/ask  —  RAG-based Q&A with SSE streaming
//
// Body: { question: string, brainId?: string }
//
// Stream events:
//   event: sources  -> data: { sources: [{ id, title, snippet, score }] }
//   event: message  -> data: { text: string }
//   event: done     -> data: { done: true }
//   event: error    -> data: { error: string }
// ---------------------------------------------------------------------------
router.post("/ask", async (req, res) => {
  const { question, brainId } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required" });
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
    // 1. Embed the question
    const queryEmbedding = await generateQueryEmbedding(question.trim());

    // 2. Retrieve relevant notes via vector search
    const limit = 5;
    const numCandidates = limit * 10;
    const filter = { author: new mongoose.Types.ObjectId(req.user.id) };
    if (brainId && mongoose.Types.ObjectId.isValid(brainId)) {
      filter.brain = new mongoose.Types.ObjectId(brainId);
    }

    let sources = [];
    if (queryEmbedding) {
      const pipeline = [
        {
          $vectorSearch: {
            index: "notes_vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates,
            limit,
            ...(Object.keys(filter).length ? { filter } : {}),
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            content: 1,
            type: 1,
            tags: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];

      const results = await Note.aggregate(pipeline);
      sources = results.map((r) => ({
        id: r._id.toString(),
        title: r.title,
        snippet: (r.content || "").substring(0, 200),
        score: r.score,
      }));
    }

    // Fallback: if no embedding, do a text search
    if (sources.length === 0) {
      const fallbackNotes = await Note.find({
        ...filter,
        $or: [
          { title: { $regex: question.trim(), $options: "i" } },
          { content: { $regex: question.trim(), $options: "i" } },
        ],
      })
        .limit(5)
        .select("title content type tags");

      sources = fallbackNotes.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        snippet: (n.content || "").substring(0, 200),
        score: null,
      }));
    }

    // 3. Emit sources event
    sendEvent("sources", { sources });

    // 4. Build context and prompt
    const contextText = sources
      .map((s, i) => `[Source ${i + 1}] ${s.title}\n${s.snippet}`)
      .join("\n\n");

    const prompt = `You are MindMesh, a semantic note-taking assistant. Answer the user's question using ONLY the provided sources. Be concise and cite sources like [1], [2] etc. If the sources don't contain enough information, say so honestly.

Sources:
${contextText}

Question: ${question.trim()}

Answer:`;

    // 5. Stream the Gemini response
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      // No API key — send a fallback response
      const fallbackAnswer = sources.length
        ? `Based on your notes, I found ${sources.length} relevant source(s): ${sources
            .map((s, i) => `[${i + 1}] ${s.title}`)
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
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
