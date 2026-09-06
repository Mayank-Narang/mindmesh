const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Sub-schema: sharing entry (used by both Brain and Note models)
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
// Main Brain schema
// ---------------------------------------------------------------------------
const brainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "A brain name is required"],
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    color: {
      type: String,
      default: "#22d3ee",
    },

    icon: {
      type: String,
      default: "🧠",
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sharedWith: {
      type: [sharedWithSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

brainSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model("Brain", brainSchema);
module.exports.sharedWithSchema = sharedWithSchema;
