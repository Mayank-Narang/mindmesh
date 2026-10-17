#!/usr/bin/env node
/**
 * reindexChunks.js — MindMesh Migration & Chunk Re-indexing Script
 *
 * Slices existing notes into overlapping chunks, generates 768-dim embeddings,
 * and populates the NoteChunk collection for Atlas Vector Search.
 *
 * Usage:
 *   node src/scripts/reindexChunks.js [options]
 *
 * Options:
 *   --force            Re-index notes even if already embedded
 *   --dry-run          Preview chunking without saving to MongoDB or calling Gemini API
 *   --brain <id>       Filter to notes belonging to a specific brain ID
 *   --no-embeddings    Create chunks in database without calling Gemini embedding API
 *   --batch-size <n>   Batch size for processing notes (default: 10)
 *   --delay <ms>       Delay in milliseconds between chunk embeddings (default: 150)
 */

const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load backend .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const Note = require("../models/Note");
const NoteChunk = require("../models/NoteChunk");
const { chunkNote, rebuildNoteChunks } = require("../services/chunking");

async function reindexAllNotes(options = {}) {
  const {
    force = false,
    dryRun = false,
    brainId = null,
    noEmbeddings = false,
    batchSize = 10,
    delayMs = 150,
    log = console.log,
  } = options;

  log("\n🧠 MindMesh Chunk Re-indexing & Migration");
  log("==========================================");
  log(`Mode:           ${dryRun ? "DRY RUN (no DB writes or API calls)" : "LIVE"}`);
  log(`Force Re-embed: ${force ? "YES" : "NO (skip up-to-date notes)"}`);
  log(`Embeddings:     ${noEmbeddings ? "DISABLED" : "ENABLED"}`);
  if (brainId) log(`Brain Filter:   ${brainId}`);
  log(`Batch Size:     ${batchSize}`);
  log("==========================================\n");

  const query = {};
  if (brainId) {
    query.brain = new mongoose.Types.ObjectId(brainId);
  }
  if (!force && !dryRun) {
    // If not forced, we can find notes that haven't been chunked or marked embedded
    // but checking chunk count ensures notes missing chunks get reindexed
  }

  const totalNotes = await Note.countDocuments(query);
  log(`Found ${totalNotes} note(s) to evaluate.`);

  if (totalNotes === 0) {
    log("No notes match the criteria.");
    return { totalNotes: 0, processedNotes: 0, totalChunks: 0, embeddedChunks: 0, errors: [] };
  }

  let processedNotes = 0;
  let totalChunks = 0;
  let embeddedChunks = 0;
  const errors = [];
  const startTime = Date.now();

  const cursor = Note.find(query).cursor({ batchSize });

  for await (const note of cursor) {
    try {
      if (dryRun) {
        const previewChunks = chunkNote(note);
        processedNotes++;
        totalChunks += previewChunks.length;
        log(
          `[DRY RUN] Note "${note.title}" (${note._id}): ${previewChunks.length} chunk(s)`
        );
        continue;
      }

      // Check if note already has chunks
      if (!force) {
        const existingChunksCount = await NoteChunk.countDocuments({ note: note._id });
        if (existingChunksCount > 0 && note.isEmbedded) {
          log(`Skipping Note "${note.title}" (${note._id}) — already indexed with ${existingChunksCount} chunk(s).`);
          processedNotes++;
          totalChunks += existingChunksCount;
          continue;
        }
      }

      log(`Indexing Note "${note.title}" (${note._id})...`);
      const chunks = await rebuildNoteChunks(note, {
        generateEmbeddings: !noEmbeddings,
      });

      await note.save();

      processedNotes++;
      totalChunks += chunks.length;
      const embeddedCount = chunks.filter((c) => c.isEmbedded).length;
      embeddedChunks += embeddedCount;

      log(
        `✓ Note "${note.title}": created ${chunks.length} chunk(s) (${embeddedCount} embedded).`
      );

      // Polite delay between notes to avoid rate limits
      if (!noEmbeddings && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (noteErr) {
      log(`✗ Error indexing note "${note.title}" (${note._id}): ${noteErr.message}`);
      errors.push({ noteId: note._id, title: note.title, error: noteErr.message });
    }
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  log("\n==========================================");
  log("🎉 Re-indexing Complete!");
  log(`Notes Processed:  ${processedNotes} / ${totalNotes}`);
  log(`Chunks Created:   ${totalChunks}`);
  log(`Chunks Embedded:  ${embeddedChunks}`);
  log(`Errors:           ${errors.length}`);
  log(`Time Elapsed:     ${elapsedSec}s`);
  log("==========================================\n");

  return {
    totalNotes,
    processedNotes,
    totalChunks,
    embeddedChunks,
    errors,
    elapsedSec,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const noEmbeddings = args.includes("--no-embeddings");

  let brainId = null;
  const brainIdx = args.indexOf("--brain");
  if (brainIdx !== -1 && args[brainIdx + 1]) {
    brainId = args[brainIdx + 1];
  }

  let batchSize = 10;
  const batchIdx = args.indexOf("--batch-size");
  if (batchIdx !== -1 && args[batchIdx + 1]) {
    batchSize = parseInt(args[batchIdx + 1], 10) || 10;
  }

  let delayMs = 150;
  const delayIdx = args.indexOf("--delay");
  if (delayIdx !== -1 && args[delayIdx + 1]) {
    delayMs = parseInt(args[delayIdx + 1], 10) || 150;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("✗ MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to MongoDB.");

    const result = await reindexAllNotes({
      force,
      dryRun,
      brainId,
      noEmbeddings,
      batchSize,
      delayMs,
    });

    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB.");

    if (result.errors.length > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error("✗ Reindexing script failed:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { reindexAllNotes };
