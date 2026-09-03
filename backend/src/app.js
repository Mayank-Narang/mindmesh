const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const noteRoutes = require("./routes/notes");

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api/notes", noteRoutes);

// Health-check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mongo:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

module.exports = app;
