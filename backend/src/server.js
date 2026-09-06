require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(
    "FATAL: MONGODB_URI is not defined. " +
      "Copy .env.example to .env and fill in your Atlas connection string."
  );
  process.exit(1);
}

const seedDemoUser = require('./seed');

async function start() {
  try {
    console.log("connecting to backend starting");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas");
    console.log("backend connected to db");
    
    // Seed the demo user and initial data
    await seedDemoUser();

    app.listen(PORT, () => {
      console.log(`🚀 MindMesh API server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
