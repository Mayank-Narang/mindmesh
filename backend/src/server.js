require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");
const { startCronJobs } = require("./jobs/cron");
const { validateEnv } = require("./services/envValidator");

// Validate startup environment variables and security policies
const envValidation = validateEnv({ throwOnFatal: false });
if (envValidation.warnings.length > 0) {
  envValidation.warnings.forEach((w) => console.warn(`⚠️  [Config Warning]: ${w}`));
}
if (!envValidation.isValid) {
  console.error("❌ FATAL CONFIGURATION ERROR(S):");
  envValidation.fatalErrors.forEach((err) => console.error(`   • ${err}`));
  console.error("Please inspect .env or copy from .env.example before launching the server.\n");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
  try {
    console.log("connecting to backend starting");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas");
    console.log("backend connected to db");

    startCronJobs();

    app.listen(PORT, () => {
      console.log(`🚀 MindMesh API server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
