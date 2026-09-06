const express = require("express");
const mongoose = require("mongoose");
const Brain = require("../models/Brain");
const Note = require("../models/Note");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Protect all brain routes with JWT authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helper: determine access level for a brain relative to the current user
// Returns 'owner' | 'collaborator' | 'read' | null
// ---------------------------------------------------------------------------
function getAccessLevel(brain, userId, userEmail) {
  if (brain.author && brain.author.toString() === userId) return "owner";
  const entry = (brain.sharedWith || []).find(
    (s) =>
      (s.user && s.user.toString() === userId) ||
      (s.email && userEmail && s.email.toLowerCase() === userEmail.toLowerCase())
  );
  return entry ? entry.permission : null;
}

// ---------------------------------------------------------------------------
// POST /api/brains  —  Create a new brain
// ---------------------------------------------------------------------------
router.post("/", async (req, res, next) => {
  try {
    const { name, description, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Brain name is required" });
    }

    const brain = new Brain({
      name: name.trim(),
      description: description || "",
      color: color || "#22d3ee",
      icon: icon || "🧠",
      author: req.user.id,
    });

    await brain.save();
    res.status(201).json({ brain });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/brains  —  List brains owned by or shared with the user
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const brains = await Brain.find({
      $or: [
        { author: req.user.id },
        { "sharedWith.user": req.user.id },
        { "sharedWith.email": (req.user.email || "").toLowerCase() },
      ],
    }).sort("-createdAt");

    const brainsWithCounts = await Promise.all(
      brains.map(async (brain) => {
        const noteCount = await Note.countDocuments({ brain: brain._id });
        const obj = brain.toObject();
        return { ...obj, id: obj._id.toString(), noteCount };
      })
    );

    // Count unassigned notes
    const unassignedCount = await Note.countDocuments({
      brain: null,
      $or: [
        { author: req.user.id },
        { "sharedWith.user": req.user.id },
        { "sharedWith.email": (req.user.email || "").toLowerCase() },
      ],
    });

    if (unassignedCount > 0) {
      brainsWithCounts.push({
        id: "unassigned",
        name: "Unassigned",
        description: "Notes without a brain",
        color: "#9ca3af",
        icon: "📥",
        noteCount: unassignedCount,
      });
    }

    res.json({ brains: brainsWithCounts });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/brains/:id  —  Get a single brain and its notes
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    if (req.params.id === "unassigned") {
      const notes = await Note.find({
        brain: null,
        $or: [
          { author: req.user.id },
          { "sharedWith.user": req.user.id },
          { "sharedWith.email": (req.user.email || "").toLowerCase() },
        ],
      })
        .sort("-updatedAt")
        .select("-embedding");

      return res.json({
        brain: {
          id: "unassigned",
          name: "Unassigned",
          description: "Notes without a brain",
          color: "#9ca3af",
          icon: "📥",
        },
        notes,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid brain ID" });
    }

    const brain = await Brain.findById(req.params.id);
    if (!brain) return res.status(404).json({ error: "Brain not found" });

    const access = getAccessLevel(brain, req.user.id, req.user.email);
    if (!access) {
      return res.status(403).json({ error: "You do not have access to this brain" });
    }

    const notes = await Note.find({ brain: brain._id })
      .sort("-updatedAt")
      .select("-embedding");

    res.json({ brain, notes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/brains/:id  —  Update a brain (owner or collaborator only)
// ---------------------------------------------------------------------------
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid brain ID" });
    }

    const brain = await Brain.findById(req.params.id);
    if (!brain) return res.status(404).json({ error: "Brain not found" });

    const access = getAccessLevel(brain, req.user.id, req.user.email);
    if (access !== "owner" && access !== "collaborator") {
      return res.status(403).json({ error: "You do not have permission to edit this brain" });
    }

    const { name, description, color, icon } = req.body;
    if (name !== undefined) brain.name = name.trim();
    if (description !== undefined) brain.description = description;
    if (color !== undefined) brain.color = color;
    if (icon !== undefined) brain.icon = icon;

    await brain.save();
    res.json({ brain });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/brains/:id  —  Delete a brain (owner only), unlink notes
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid brain ID" });
    }

    const brain = await Brain.findById(req.params.id);
    if (!brain) return res.status(404).json({ error: "Brain not found" });

    if (brain.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can delete this brain" });
    }

    await Note.updateMany({ brain: brain._id }, { $set: { brain: null } });
    await Brain.findByIdAndDelete(brain._id);

    res.json({ message: "Brain deleted, notes unlinked" });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/brains/:id/share  —  Share a brain with a user by email
// ---------------------------------------------------------------------------
router.post("/:id/share", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid brain ID" });
    }

    const { email, permission } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "An email is required" });
    }
    if (permission && !["read", "collaborator"].includes(permission)) {
      return res.status(400).json({ error: "Permission must be 'read' or 'collaborator'" });
    }

    const brain = await Brain.findById(req.params.id);
    if (!brain) return res.status(404).json({ error: "Brain not found" });

    if (brain.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can share this brain" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const User = require("../models/User");
    const targetUser = await User.findOne({ email: normalizedEmail });

    const existingIdx = brain.sharedWith.findIndex(
      (s) => s.email.toLowerCase() === normalizedEmail
    );

    const entry = {
      user: targetUser ? targetUser._id : null,
      email: normalizedEmail,
      permission: permission || "read",
    };

    if (existingIdx >= 0) {
      brain.sharedWith[existingIdx] = entry;
    } else {
      brain.sharedWith.push(entry);
    }

    await brain.save();
    res.json({ sharedWith: brain.sharedWith });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/brains/:id/share/:email  —  Unshare a brain
// ---------------------------------------------------------------------------
router.delete("/:id/share/:email", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid brain ID" });
    }

    const brain = await Brain.findById(req.params.id);
    if (!brain) return res.status(404).json({ error: "Brain not found" });

    if (brain.author.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can unshare this brain" });
    }

    const normalizedEmail = decodeURIComponent(req.params.email).toLowerCase();
    brain.sharedWith = brain.sharedWith.filter(
      (s) => s.email.toLowerCase() !== normalizedEmail
    );

    await brain.save();
    res.json({ sharedWith: brain.sharedWith });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
