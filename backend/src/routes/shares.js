const express = require("express");
const mongoose = require("mongoose");
const Brain = require("../models/Brain");
const Note = require("../models/Note");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Protect all share routes with JWT authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/shares/shared-with-me  —  List brains and notes shared with the user
// ---------------------------------------------------------------------------
router.get("/shared-with-me", async (req, res, next) => {
  try {
    const userEmail = (req.user.email || "").toLowerCase();
    const userId = req.user.id;

    const brains = await Brain.find({
      $or: [
        { "sharedWith.email": userEmail },
        { "sharedWith.user": userId },
      ],
    }).select("-embedding");

    const notes = await Note.find({
      $or: [
        { "sharedWith.email": userEmail },
        { "sharedWith.user": userId },
      ],
    }).select("-embedding");

    res.json({ brains, notes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes/:id/share  —  Share a note with a user by email
// ---------------------------------------------------------------------------
router.post("/notes/:id/share", async (req, res, next) => {
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
router.delete("/notes/:id/share/:email", async (req, res, next) => {
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

module.exports = router;
