const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// NoteChunk Schema
//
// Represents a semantically chunked segment of a parent Note for vector search
// and granular retrieval snippet extraction.
// ---------------------------------------------------------------------------
const noteChunkSchema = new mongoose.Schema(
  {
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: [true, "Parent note reference is required"],
      index: true,
    },

    chunkIndex: {
      type: Number,
      required: [true, "Chunk index is required"],
      min: 0,
    },

    content: {
      type: String,
      required: [true, "Chunk text content is required"],
    },

    embedding: {
      type: [Number],
      default: [],
    },

    isEmbedded: {
      type: Boolean,
      default: false,
    },

    // Metadata replicated from parent Note to support pre-filtering in Atlas Vector Search
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

    type: {
      type: String,
      enum: ["text", "markdown", "url"],
      default: "text",
    },

    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.embedding;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
noteChunkSchema.index({ note: 1, chunkIndex: 1 }, { unique: true });
noteChunkSchema.index({ type: 1 });
noteChunkSchema.index({ tags: 1 });

module.exports = mongoose.model("NoteChunk", noteChunkSchema);
