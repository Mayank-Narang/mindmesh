require("dotenv").config();
process.env.JWT_SECRET = process.env.JWT_SECRET || "mindmesh-jwt-secret-dev-2026";

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const packageJson = require("../package.json");
const { createRateLimiter } = require("./middleware/rateLimiter");
const authRoutes = require("./routes/auth");
const noteRoutes = require("./routes/notes");
const brainRoutes = require("./routes/brains");
const shareRoutes = require("./routes/shares");
const aiRoutes = require("./routes/ai");

const app = express();
const appStartTime = Date.now();

// ---------------------------------------------------------------------------
// Root endpoint (friendly JSON response)
// ---------------------------------------------------------------------------
app.get("/", (_req, res) => {
  res.json({
    name: "MindMesh Backend API",
    version: packageJson.version,
    status: "online",
    health: "/api/health",
    documentation: "https://github.com/Mayank-Narang/mindmesh#api-reference",
  });
});

// ---------------------------------------------------------------------------
// Health-check endpoint (unaffected by auth or rate limiting)
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const uptimeSeconds = Math.floor((Date.now() - appStartTime) / 1000);

  res.status(isMongoConnected || process.env.NODE_ENV === "test" ? 200 : 503).json({
    status: isMongoConnected || process.env.NODE_ENV === "test" ? "ok" : "degraded",
    mongo: isMongoConnected ? "connected" : "disconnected",
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    services: {
      database: isMongoConnected ? "connected" : "disconnected",
      embeddings: process.env.GEMINI_API_KEY ? "configured" : "unconfigured",
      geminiAi: process.env.GEMINI_API_KEY ? "configured" : "unconfigured",
    },
    environment: process.env.NODE_ENV || "development",
  });
});

// ---------------------------------------------------------------------------
// Middleware & CORS Configuration
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [
      "https://mindmesh-frontend-eta.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. curl, server-to-server, mobile)
      if (!origin) return callback(null, true);
      // Allow all in development or when wildcard is explicitly configured
      if (process.env.NODE_ENV !== "production" || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      // Allow configured origins, Vercel deployments, and localhost
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

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
