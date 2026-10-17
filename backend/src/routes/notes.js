const express = require("express");
const mongoose = require("mongoose");
const Note = require("../models/Note");
const NoteChunk = require("../models/NoteChunk");
const Brain = require("../models/Brain");
const User = require("../models/User");
const {
  generateEmbedding,
  generateQueryEmbedding,
} = require("../services/vector");
const {
  rebuildNoteChunks,
  syncChunkMetadata,
  deleteNoteChunks,
} = require("../services/chunking");
const { extractMetadata } = require("../services/scraper");
const { authenticate } = require("../middleware/auth");
const { getBrainAccess, getNoteAccess, canRead, canEdit, canManage } = require("../services/access");

const router = express.Router();
const LOCK_TTL_MS = 5 * 60 * 1000;

// Protect all note routes with JWT authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helper: build a text blob for embedding from a note's fields
// ---------------------------------------------------------------------------
function buildEmbeddingText(note) {
  const parts = [];
  if (note.title) parts.push(note.title);
  if (note.content) parts.push(note.content);
  if (note.tags && note.tags.length) parts.push(note.tags.join(", "));
  return parts.join("\n\n");
}

async function getAccessForNote(note, user) {
  const brain = note.brain ? await Brain.findById(note.brain) : null;
  return getNoteAccess(note, brain, user.id, user.email);
}

function sameId(value, expected) {
  return Boolean(value && expected && value.toString() === expected.toString());
}

function hasActiveLock(note, now = new Date()) {
  return Boolean(note.lockedBy && note.lockExpiresAt && note.lockExpiresAt > now);
}

async function lockPayload(note) {
  const active = hasActiveLock(note);
  let holder = null;
  if (active) {
    const user = await User.findById(note.lockedBy).select("name email");
    holder = {
      id: note.lockedBy.toString(),
      name: user ? user.name : null,
      email: user ? user.email : null,
    };
  }
  return {
    locked: active,
    holder,
    expiresAt: note.lockExpiresAt || null,
  };
}

async function conflict(res, note, error, code) {
  const serverNote = note.toJSON();
  serverNote.lock = await lockPayload(note);
  return res.status(409).json({
    error,
    code,
    version: note.version,
    lock: serverNote.lock,
    serverNote,
    draft: note.draftContent,
  });
}

function clearExpiredLock(note, now = new Date()) {
  if (note.lockExpiresAt && note.lockExpiresAt <= now) {
    note.lockedBy = null;
    note.lockedAt = null;
    note.lockExpiresAt = null;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// GET /api/notes/metadata  —  Live preview of URL metadata
// ---------------------------------------------------------------------------
router.get("/metadata", async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }
    const metadata = await extractMetadata(url);
    res.json({
      siteName: metadata.siteName || metadata.publisher || "",
      description: metadata.description || "",
      image: metadata.image || "",
      favicon: metadata.favicon || "",
      title: metadata.title || "",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to extract metadata" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes  —  Create a new note
// ---------------------------------------------------------------------------
router.post("/", async (req, res, next) => {
  try {
    const { title, type, content, url, urlMeta, tags, brain } = req.body;

    if (brain) {
      if (!mongoose.Types.ObjectId.isValid(brain)) {
        return res.status(400).json({ error: "Invalid brain ID" });
      }
      const targetBrain = await Brain.findById(brain);
      if (!targetBrain || !canEdit(getBrainAccess(targetBrain, req.user.id, req.user.email))) {
        return res.status(403).json({ error: "You do not have permission to add notes to this brain" });
      }
    }

    const note = new Note({
      title,
      type,
      content,
      url: url || null,
      urlMeta: urlMeta || null,
      tags: tags || [],
      brain: brain || null,
      author: req.user.id,
    });

    // Auto-extract metadata for URL-type notes if URL is provided and no meta given
    if (type === "url" && url && !urlMeta) {
      try {
        const metadata = await extractMetadata(url);
        if (metadata && (metadata.title || metadata.description)) {
          note.urlMeta = {
            siteName: metadata.siteName || metadata.publisher || "",
            description: metadata.description || "",
            image: metadata.image || "",
            favicon: metadata.favicon || "",
          };
          // Auto-populate title if empty or if it equals the URL (fallback from frontend)
          if ((!note.title || note.title === url) && metadata.title) {
            note.title = metadata.title;
          }
        }
      } catch (metaErr) {
        // Metadata extraction failed — continue without it
        console.warn("URL metadata extraction failed:", metaErr.message);
      }
    }

    // Generate vector embedding (non-blocking — note saves even if this fails)
    const embeddingText = buildEmbeddingText(note);
    const embedding = await generateEmbedding(embeddingText, title);

    if (embedding) {
      note.embedding = embedding;
      note.isEmbedded = true;
    }

    await note.save();

    // Build, embed, and index chunks for granular retrieval
    try {
      await rebuildNoteChunks(note, { generateEmbeddings: true });
      await note.save();
    } catch (chunkErr) {
      console.warn("Chunking/embedding failed on note create:", chunkErr.message);
    }

    console.log("note stored in db");
    res.status(201).json(note);
  } catch (err) {
    // Mongoose validation errors → 400
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/notes  —  List notes (with optional query filters)
//
//   ?type=text|markdown|url
//   ?brain=<ObjectId>
//   ?author=<ObjectId>
//   ?tag=<tagName>            (single tag filter)
//   ?page=1&limit=20         (pagination)
//   ?sort=createdAt|-createdAt|updatedAt|-updatedAt   (default: -createdAt)
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    // Find all brains the user has access to
    const accessibleBrains = await Brain.find({
      $or: [
        { author: req.user.id },
        { "sharedWith.user": req.user.id },
        { "sharedWith.email": (req.user.email || "").toLowerCase() },
      ],
    }).select("_id");
    const accessibleBrainIds = accessibleBrains.map((b) => b._id);

    const userFilter = {
      $or: [
        { author: req.user.id },
        { "sharedWith.user": req.user.id },
        { "sharedWith.email": (req.user.email || "").toLowerCase() },
        { brain: { $in: accessibleBrainIds } },
      ],
    };

    const queryFilter = {};
    if (req.query.type) queryFilter.type = req.query.type;
    if (req.query.brain) queryFilter.brain = req.query.brain;
    if (req.query.author) queryFilter.author = req.query.author;
    if (req.query.tag) queryFilter.tags = req.query.tag;

    const filter = { $and: [userFilter] };
    if (Object.keys(queryFilter).length > 0) {
      filter.$and.push(queryFilter);
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 1000); // Increased max limit to 1000 for dashboard
    const skip = (page - 1) * limit;

    // Sort string: prefix with "-" for descending (Mongoose convention)
    const sort = req.query.sort || "-createdAt";

    const [notes, total] = await Promise.all([
      Note.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-embedding"), // exclude the large embedding array from list responses
      Note.countDocuments(filter),
    ]);

    res.json({
      notes,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/notes/:id  —  Get a single note by ID
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

    if (!canRead(await getAccessForNote(note, req.user))) {
      return res.status(403).json({ error: "You do not have access to this note" });
    }

    res.json(note);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/notes/:id  —  Update a note
//
// Re-generates the embedding only when content, title, or tags change.
// ---------------------------------------------------------------------------
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

    if (!canEdit(await getAccessForNote(note, req.user))) {
      return res.status(403).json({ error: "You do not have permission to edit this note" });
    }

    const { title, type, content, url, urlMeta, tags, brain, expectedVersion, releaseLock } =
      req.body;

    const now = new Date();
    const expiredLockWasCleared = clearExpiredLock(note, now);
    if (expectedVersion !== undefined && Number(expectedVersion) !== note.version) {
      if (expiredLockWasCleared) await note.save();
      return await conflict(res, note, "This note has changed since you last loaded it", "VERSION_CONFLICT");
    }
    if (hasActiveLock(note, now) && !sameId(note.lockedBy, req.user.id)) {
      return await conflict(res, note, "This note is being edited by another collaborator", "NOTE_LOCKED");
    }

    if (brain !== undefined && brain !== null) {
      if (!mongoose.Types.ObjectId.isValid(brain)) {
        return res.status(400).json({ error: "Invalid brain ID" });
      }
      const targetBrain = await Brain.findById(brain);
      if (!targetBrain || !canEdit(getBrainAccess(targetBrain, req.user.id, req.user.email))) {
        return res.status(403).json({ error: "You do not have permission to move this note to that brain" });
      }
    }

    // Detect whether embedding-relevant fields changed
    const oldText = buildEmbeddingText(note);

    // Apply updates
    if (title !== undefined) note.title = title;
    if (type !== undefined) note.type = type;
    if (content !== undefined) note.content = content;
    if (url !== undefined) note.url = url;
    if (urlMeta !== undefined) note.urlMeta = urlMeta;
    if (tags !== undefined) note.tags = tags;
    if (brain !== undefined) note.brain = brain;

    const newText = buildEmbeddingText(note);

    // Re-embed only when the textual payload actually changed
    if (newText !== oldText) {
      const embedding = await generateEmbedding(newText, note.title);
      if (embedding) {
        note.embedding = embedding;
        note.isEmbedded = true;
      } else {
        // Embedding generation failed — mark stale but don't block update
        note.isEmbedded = false;
      }
      try {
        await rebuildNoteChunks(note, { generateEmbeddings: true });
      } catch (chunkErr) {
        console.warn("Chunking/embedding failed on note update:", chunkErr.message);
        note.isEmbedded = false;
      }
    } else if (brain !== undefined || tags !== undefined || type !== undefined) {
      try {
        await syncChunkMetadata(note);
      } catch (syncErr) {
        console.warn("Syncing chunk metadata failed:", syncErr.message);
      }
    }

    note.version = Number.isInteger(note.version) ? note.version + 1 : 1;
    note.draftContent = null;
    note.draftUpdatedAt = null;
    if (releaseLock && sameId(note.lockedBy, req.user.id)) {
      note.lockedBy = null;
      note.lockedAt = null;
      note.lockExpiresAt = null;
    }

    await note.save();
    res.json(note);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes/:id/lock — acquire or renew an editing lock
// ---------------------------------------------------------------------------
router.post("/:id/lock", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (!canEdit(await getAccessForNote(note, req.user))) {
      return res.status(403).json({ error: "You do not have permission to edit this note" });
    }

    const now = new Date();
    clearExpiredLock(note, now);
    if (hasActiveLock(note, now) && !sameId(note.lockedBy, req.user.id)) {
      return await conflict(res, note, "This note is being edited by another collaborator", "NOTE_LOCKED");
    }

    note.lockedBy = req.user.id;
    note.lockedAt = now;
    note.lockExpiresAt = new Date(now.getTime() + LOCK_TTL_MS);
    await note.save();
    const lock = await lockPayload(note);
    res.json({ ...lock, version: note.version, draft: note.draftContent });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes/:id/lock/renew — extend the caller's active editing lock
// ---------------------------------------------------------------------------
router.post("/:id/lock/renew", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (!canEdit(await getAccessForNote(note, req.user))) {
      return res.status(403).json({ error: "You do not have permission to edit this note" });
    }

    const now = new Date();
    clearExpiredLock(note, now);
    if (!hasActiveLock(note, now) || !sameId(note.lockedBy, req.user.id)) {
      return await conflict(res, note, "Only the active editor can renew this lock", "LOCK_OWNERSHIP_REQUIRED");
    }

    note.lockExpiresAt = new Date(now.getTime() + LOCK_TTL_MS);
    await note.save();
    res.json({ locked: true, expiresAt: note.lockExpiresAt, version: note.version });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/notes/:id/draft — soft-save content and renew the caller's lock
// ---------------------------------------------------------------------------
router.put("/:id/draft", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }
    if (typeof req.body.content !== "string") {
      return res.status(400).json({ error: "Draft content must be a string" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (!canEdit(await getAccessForNote(note, req.user))) {
      return res.status(403).json({ error: "You do not have permission to edit this note" });
    }

    const now = new Date();
    clearExpiredLock(note, now);
    if (!hasActiveLock(note, now) || !sameId(note.lockedBy, req.user.id)) {
      return await conflict(res, note, "Acquire this note's editing lock before saving a draft", "LOCK_REQUIRED");
    }
    if (req.body.expectedVersion !== undefined && Number(req.body.expectedVersion) !== note.version) {
      return await conflict(res, note, "This note has changed since you last loaded it", "VERSION_CONFLICT");
    }

    note.draftContent = req.body.content;
    note.draftUpdatedAt = now;
    note.lockExpiresAt = new Date(now.getTime() + LOCK_TTL_MS);
    await note.save();
    const lock = await lockPayload(note);
    res.json({ ...lock, version: note.version, draft: note.draftContent });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/notes/:id/lock — release the caller's editing lock
// ---------------------------------------------------------------------------
router.delete("/:id/lock", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });
    const access = await getAccessForNote(note, req.user);
    if (!canEdit(access)) {
      return res.status(403).json({ error: "You do not have permission to edit this note" });
    }
    if (hasActiveLock(note) && !sameId(note.lockedBy, req.user.id) && access !== "owner") {
      return await conflict(res, note, "Only the active editor or owner can release this lock", "LOCK_OWNERSHIP_REQUIRED");
    }

    note.lockedBy = null;
    note.lockedAt = null;
    note.lockExpiresAt = null;
    await note.save();
    res.json({ locked: false, version: note.version });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/notes/:id  —  Delete a note
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

    if (!canManage(await getAccessForNote(note, req.user))) {
      return res.status(403).json({ error: "Only the owner can delete this note" });
    }

    await deleteNoteChunks(note._id);
    await note.deleteOne();

    res.json({ message: "Note deleted", id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes/:id/share  —  Share a note with a user by email<longcat_arg_value>// ---------------------------------------------------------------------------
// POST /api/notes/:id/share  —  Share a note with a user by email
// ---------------------------------------------------------------------------
router.post("/:id/share", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const { email, permission } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "An email is required" });
    }
    if (permission && !["read", "collaborator"].includes(permission)) {
      return res.status(400).json({ error: "Permission must be 'read' or 'collaborator'" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

    if (!note.author || note.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can share this note" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const User = require("../models/User");
    const targetUser = await User.findOne({ email: normalizedEmail });

    const existingIdx = note.sharedWith.findIndex(
      (s) => s.email.toLowerCase() === normalizedEmail
    );

    const entry = {
      user: targetUser ? targetUser._id : null,
      email: normalizedEmail,
      permission: permission || "read",
    };

    if (existingIdx >= 0) {
      note.sharedWith[existingIdx] = entry;
    } else {
      note.sharedWith.push(entry);
    }

    await note.save();
    res.json({ sharedWith: note.sharedWith });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/notes/:id/share/:email  —  Unshare a note
// ---------------------------------------------------------------------------
router.delete("/:id/share/:email", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

    if (!note.author || note.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can unshare this note" });
    }

    const normalizedEmail = decodeURIComponent(req.params.email).toLowerCase();
    note.sharedWith = note.sharedWith.filter(
      (s) => s.email.toLowerCase() !== normalizedEmail
    );

    await note.save();
    res.json({ sharedWith: note.sharedWith });
  } catch (err) {
    next(err);
  }
});

const CHUNK_VECTOR_INDEX = process.env.CHUNK_VECTOR_INDEX || "note_chunks_vector_index";

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

async function buildSearchAccessFilter(user) {
  const accessibleBrains = await Brain.find({
    $or: [
      { author: user.id },
      { "sharedWith.user": user.id },
      { "sharedWith.email": (user.email || "").toLowerCase() },
    ],
  }).select("_id");
  const accessibleBrainIds = accessibleBrains.map((b) => b._id);
  const userId = new mongoose.Types.ObjectId(user.id);
  const userEmail = (user.email || "").toLowerCase();

  return {
    accessibleBrainIds,
    userId: user.id.toString(),
    userEmail,
    noteFilter: {
      $or: [
        { author: userId },
        { "sharedWith.user": userId },
        { "sharedWith.email": userEmail },
        { brain: { $in: accessibleBrainIds } },
      ],
    },
    parentNoteMatch: {
      $or: [
        { "parentNote.author": userId },
        { "parentNote.sharedWith.user": userId },
        { "parentNote.sharedWith.email": userEmail },
        { "parentNote.brain": { $in: accessibleBrainIds } },
      ],
    },
  };
}

function normaliseSearchResult(result, score, retrievalMode, snippet, chunkIndex) {
  const source = typeof result.toJSON === "function" ? result.toJSON() : result;
  const id = source.id || (source._id ? source._id.toString() : "");
  const { _id, embedding, ...rest } = source;
  const finalSnippet = snippet !== undefined && snippet !== null
    ? snippet
    : (source.content || "").slice(0, 300);

  const out = {
    ...rest,
    id,
    score,
    retrievalMode,
    snippet: finalSnippet,
  };
  if (chunkIndex !== undefined && chunkIndex !== null) {
    out.chunkIndex = chunkIndex;
  }
  return out;
}

function searchFilters({ brain, type, author, tags }) {
  const filters = {};
  if (brain) filters.brain = new mongoose.Types.ObjectId(brain);
  if (type) filters.type = type;
  if (author) filters.author = new mongoose.Types.ObjectId(author);
  if (tags) filters.tags = Array.isArray(tags) ? { $all: tags } : tags;
  return filters;
}

async function semanticSearch(query, accessInfo, filters, limit) {
  const queryEmbedding = await generateQueryEmbedding(query);
  if (!queryEmbedding) return null;

  const vectorFilters = {};
  for (const key of ["brain", "type", "author", "tags"]) {
    if (filters[key] !== undefined) vectorFilters[key] = filters[key];
  }

  const parentFilters = {};
  for (const key of ["brain", "type", "author", "tags"]) {
    if (filters[key] !== undefined) parentFilters[`parentNote.${key}`] = filters[key];
  }

  const numCandidates = Math.max(limit * 20, 50);

  const pipeline = [
    {
      $vectorSearch: {
        index: CHUNK_VECTOR_INDEX,
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates,
        limit: Math.max(limit * 10, 30),
        ...(Object.keys(vectorFilters).length ? { filter: vectorFilters } : {}),
      },
    },
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" },
      },
    },
    {
      $match: {
        score: { $gte: 0.82 },
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
          accessInfo.parentNoteMatch,
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
        bestScore: { $first: "$score" },
        bestChunkContent: { $first: "$content" },
        bestChunkIndex: { $first: "$chunkIndex" },
      },
    },
    {
      $sort: { bestScore: -1 },
    },
    {
      $limit: limit,
    },
  ];

  try {
    const aggregated = await NoteChunk.aggregate(pipeline);
    if (aggregated && aggregated.length > 0) {
      return aggregated.map((item) =>
        normaliseSearchResult(
          item.parentNote,
          item.bestScore,
          "semantic",
          item.bestChunkContent,
          item.bestChunkIndex
        )
      );
    }
  } catch (vectorErr) {
    // Atlas $vectorSearch failed (e.g. index not yet ready or non-Atlas local environment)
    console.warn("Atlas $vectorSearch failed, running fallback:", vectorErr.message);
  }

  // In-memory cosine similarity fallback over stored NoteChunk embeddings
  try {
    const chunkQuery = {
      isEmbedded: true,
      embedding: { $exists: true, $ne: [] },
      ...filters,
    };

    const chunks = await NoteChunk.find(chunkQuery)
      .populate("note")
      .lean();

    if (!chunks || chunks.length === 0) {
      return [];
    }

    const accessibleChunks = [];
    for (const chunk of chunks) {
      const parent = chunk.note;
      if (!parent) continue;

      const parentAuthor = parent.author ? parent.author.toString() : "";
      const isAuthor = parentAuthor === accessInfo.userId;
      const isBrainShared = parent.brain && accessInfo.accessibleBrainIds.some(
        (bId) => bId.toString() === parent.brain.toString()
      );
      const isNoteShared = (parent.sharedWith || []).some((s) => {
        const sUser = s.user ? s.user.toString() : "";
        const sEmail = (s.email || "").toLowerCase();
        return sUser === accessInfo.userId || sEmail === accessInfo.userEmail;
      });

      if (!isAuthor && !isBrainShared && !isNoteShared) {
        continue;
      }

      if (filters.brain && parent.brain && parent.brain.toString() !== filters.brain.toString()) continue;
      if (filters.type && parent.type !== filters.type) continue;
      if (filters.author && parentAuthor !== filters.author.toString()) continue;

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= 0.82) {
        accessibleChunks.push({
          parentNote: parent,
          score,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
        });
      }
    }

    accessibleChunks.sort((a, b) => b.score - a.score);

    const noteMap = new Map();
    for (const item of accessibleChunks) {
      const noteId = item.parentNote._id ? item.parentNote._id.toString() : item.parentNote.id;
      if (!noteMap.has(noteId)) {
        noteMap.set(noteId, item);
      }
    }

    const topItems = Array.from(noteMap.values()).slice(0, limit);
    return topItems.map((item) =>
      normaliseSearchResult(
        item.parentNote,
        item.score,
        "semantic",
        item.content,
        item.chunkIndex
      )
    );
  } catch (fallbackErr) {
    console.error("Semantic search fallback error:", fallbackErr.message);
    return [];
  }
}

async function keywordSearch(query, accessFilter, filters, limit) {
  if (!query) return [];
  const notes = await Note.find(
    { $text: { $search: query }, $and: [accessFilter, filters] },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .select("-embedding");

  return notes.map((note) => {
    let snippet = (note.content || "").slice(0, 300);
    if (note.content && query) {
      const lowerContent = note.content.toLowerCase();
      const lowerTerm = query.toLowerCase().split(/\s+/)[0];
      const idx = lowerContent.indexOf(lowerTerm);
      if (idx !== -1) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(note.content.length, idx + 240);
        snippet = (start > 0 ? "..." : "") + note.content.slice(start, end).trim();
      }
    }
    return normaliseSearchResult(note, note.score || 0, "keyword", snippet);
  });
}

async function recencySearch(accessFilter, filters, limit) {
  const notes = await Note.find({ $and: [accessFilter, filters] })
    .sort("-updatedAt")
    .limit(limit)
    .select("-embedding");
  return notes.map((note, index) =>
    normaliseSearchResult(
      note,
      Math.max(0, 1 - index / Math.max(limit, 1)),
      "recency",
      (note.content || "").slice(0, 300)
    )
  );
}

function reciprocalRankFusion(resultLists, limit) {
  const ranks = new Map();
  for (const list of resultLists) {
    list.forEach((result, index) => {
      const existing = ranks.get(result.id) || { ...result, score: 0, sources: [] };
      existing.score += 1 / (60 + index + 1);
      existing.sources.push(result.retrievalMode);
      if (result.retrievalMode === "semantic" && result.snippet) {
        existing.snippet = result.snippet;
        if (result.chunkIndex !== undefined) {
          existing.chunkIndex = result.chunkIndex;
        }
      }
      ranks.set(result.id, existing);
    });
  }
  return [...ranks.values()]
    .map((result) => ({ ...result, retrievalMode: "hybrid" }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// POST /api/notes/search — semantic, keyword, recency, or hybrid retrieval
// ---------------------------------------------------------------------------
router.post("/search", async (req, res, next) => {
  try {
    const { query: rawQuery = "", mode = "semantic", brain, type, author, tags, limit: rawLimit } = req.body;
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    const validModes = new Set(["semantic", "keyword", "recency", "hybrid"]);
    if (!validModes.has(mode)) return res.status(400).json({ error: "Unsupported search mode" });
    if (mode !== "recency" && !query) return res.status(400).json({ error: "A non-empty query string is required" });
    for (const value of [brain, author]) {
      if (value && !mongoose.Types.ObjectId.isValid(value)) return res.status(400).json({ error: "Invalid search filter ID" });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 50);
    const filters = searchFilters({ brain, type, author, tags });
    const accessInfo = await buildSearchAccessFilter(req.user);
    const accessFilter = accessInfo.noteFilter;
    let results;

    if (mode === "keyword") {
      results = await keywordSearch(query, accessFilter, filters, limit);
    } else if (mode === "recency") {
      results = await recencySearch(accessFilter, filters, limit);
    } else if (mode === "semantic") {
      results = await semanticSearch(query, accessInfo, filters, limit);
      if (results === null) return res.status(503).json({ error: "Embedding service unavailable — try again later" });
      if (results.length === 0) results = await keywordSearch(query, accessFilter, filters, limit);
    } else {
      const semantic = await semanticSearch(query, accessInfo, filters, limit);
      if (semantic === null) return res.status(503).json({ error: "Embedding service unavailable — try again later" });
      const [keyword, recency] = await Promise.all([
        keywordSearch(query, accessFilter, filters, limit),
        recencySearch(accessFilter, filters, limit),
      ]);
      results = reciprocalRankFusion([semantic, keyword, recency], limit);
    }

    res.json({ query, mode, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
