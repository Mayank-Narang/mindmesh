const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Sub-schema: URL metadata (only relevant for type "url")
// ---------------------------------------------------------------------------
const urlMetaSchema = new mongoose.Schema(
  {
    siteName: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    favicon: { type: String, default: "" },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Sub-schema: sharing entry
// ---------------------------------------------------------------------------
const sharedWithSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    permission: {
      type: String,
      enum: ["read", "collaborator"],
      default: "read",
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Main Note schema
// ---------------------------------------------------------------------------
const noteSchema = new mongoose.Schema(
  {
    // ---- core fields -------------------------------------------------
    title: {
      type: String,
      required: [true, "A note title is required"],
      trim: true,
      maxlength: 500,
    },

    type: {
      type: String,
      required: [true, "Note type is required"],
      enum: {
        values: ["text", "markdown", "url"],
        message: "{VALUE} is not a supported note type",
      },
    },

    content: {
      type: String,
      default: "",
    },

    // ---- URL-specific fields -----------------------------------------
    url: {
      type: String,
      default: null,
    },

    urlMeta: {
      type: urlMetaSchema,
      default: null,
    },

    // ---- organisation ------------------------------------------------
    tags: {
      type: [String],
      default: [],
    },

    brain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brain",
      default: null,
      index: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ---- vector embedding --------------------------------------------
    embedding: {
      type: [Number],
      default: [],
    },

    isEmbedded: {
      type: Boolean,
      default: false,
    },

    // ---- sharing -------------------------------------------------------
    sharedWith: {
      type: [sharedWithSchema],
      default: [],
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
noteSchema.index({ tags: 1 });
noteSchema.index({ type: 1 });
noteSchema.index({ createdAt: -1 });
// Add a text index to support stemming (e.g. "dolls" matches "doll")
noteSchema.index({ title: 'text', content: 'text' });

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
module.exports = mongoose.model("Note", noteSchema);
