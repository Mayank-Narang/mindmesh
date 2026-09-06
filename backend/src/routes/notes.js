const express = require("express");
const mongoose = require("mongoose");
const Note = require("../models/Note");
const {
  generateEmbedding,
  generateQueryEmbedding,
} = require("../services/vector");
const { extractMetadata } = require("../services/scraper");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

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

// ---------------------------------------------------------------------------
// POST /api/notes  —  Create a new note
// ---------------------------------------------------------------------------
router.post("/", async (req, res, next) => {
  try {
    const { title, type, content, url, urlMeta, tags, brain, author } =
      req.body;

    const note = new Note({
      title,
      type,
      content,
      url: url || null,
      urlMeta: urlMeta || null,
      tags: tags || [],
      brain: brain || null,
      author: req.user?.id || author || null,
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
          // Auto-populate title if empty
          if (!note.title && metadata.title) {
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
    const filter = {};

    if (req.query.type) filter.type = req.query.type;
    if (req.query.brain) filter.brain = req.query.brain;
    if (req.query.author) filter.author = req.query.author;
    if (req.query.tag) filter.tags = req.query.tag;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
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

    const { title, type, content, url, urlMeta, tags, brain, author } =
      req.body;

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
    if (author !== undefined) note.author = author;

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
// DELETE /api/notes/:id  —  Delete a note
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ error: "Note not found" });

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

// ---------------------------------------------------------------------------
// POST /api/notes/search  —  Semantic vector search
//
// Body: { query: "...", brain?: "<ObjectId>", type?: "text"|"markdown"|"url",
//         limit?: 10 }
//
// Uses the Atlas $vectorSearch aggregation stage.
// ---------------------------------------------------------------------------
router.post("/search", async (req, res, next) => {
  try {
    const { query, brain, type, author, limit: rawLimit } = req.body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return res
        .status(400)
        .json({ error: "A non-empty 'query' string is required" });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 50);
    const numCandidates = limit * 10; // oversample for better recall

    // Generate query embedding (asymmetric — uses RETRIEVAL_QUERY task type)
    const queryEmbedding = await generateQueryEmbedding(query.trim());

    if (!queryEmbedding) {
      return res
        .status(503)
        .json({ error: "Embedding service unavailable — try again later" });
    }

    // Build optional pre-filter
    const filter = {};
    if (brain) filter.brain = new mongoose.Types.ObjectId(brain);
    if (type) filter.type = type;
    if (author) filter.author = new mongoose.Types.ObjectId(author);

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
          type: 1,
          content: 1,
          url: 1,
          urlMeta: 1,
          tags: 1,
          brain: 1,
          author: 1,
          createdAt: 1,
          updatedAt: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await Note.aggregate(pipeline);

    res.json({ query: query.trim(), results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
