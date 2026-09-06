require("dotenv").config();
process.env.JWT_SECRET = process.env.JWT_SECRET || "mindmesh-jwt-secret-dev-2026";

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { createRateLimiter } = require("./middleware/rateLimiter");
const authRoutes = require("./routes/auth");
const noteRoutes = require("./routes/notes");
const brainRoutes = require("./routes/brains");
const shareRoutes = require("./routes/shares");
const aiRoutes = require("./routes/ai");

const app = express();

// ---------------------------------------------------------------------------
// Health-check endpoint (unaffected by auth or rate limiting)
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mongo:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use((req, res, next) => {
  console.log(`backend connected to fe - [${req.method}] ${req.url}`);
  next();
});

// ---------------------------------------------------------------------------
// Global Rate Limiter (exempting /api/health and /api/auth/login)
// ---------------------------------------------------------------------------
const baseGlobalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: "Too many requests, please try again later.",
});

app.use((req, res, next) => {
  // Exempt health check and login endpoint (login has its own strict rate limiter)
  if (req.path === "/api/health" || req.path === "/api/auth/login" || req.path.startsWith("/api/auth/login")) {
    return next();
  }
  return baseGlobalLimiter(req, res, next);
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/brains", brainRoutes);
app.use("/api/shares", shareRoutes);
app.use("/api/ai", aiRoutes);

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
