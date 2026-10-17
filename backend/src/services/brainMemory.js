const { GoogleGenerativeAI } = require("@google/generative-ai");
const Note = require("../models/Note");

/**
 * Generates a compact JSON memory state for a Brain based on its contained notes.
 * Replaces simple count-only descriptions ("A collection of X notes.") with rich,
 * structured metadata that can be parsed or rendered directly.
 *
 * @param {object} brain - Mongoose Brain document
 * @param {object} [options]
 * @param {boolean} [options.save=true] - Whether to save the brain document after updating
 * @param {boolean} [options.useAi=true] - Whether to synthesize summary with Gemini if available
 * @returns {Promise<object>} Generated compact memory state
 */
async function generateBrainMemoryState(brain, options = {}) {
  const shouldSave = options.save !== false;
  const useAi = options.useAi !== false;

  const notes = await Note.find({ brain: brain._id })
    .sort("-updatedAt")
    .select("title type tags updatedAt");

  const noteCount = notes.length;

  if (noteCount === 0) {
    const emptyState = {
      summary: "Empty brain with no notes yet.",
      noteCount: 0,
      types: { text: 0, markdown: 0, url: 0 },
      tags: [],
      topics: [],
      lastActivity: null,
    };
    brain.description = JSON.stringify(emptyState);
    brain.memoryState = emptyState;
    if (shouldSave) await brain.save();
    return emptyState;
  }

  // Count by type
  const types = { text: 0, markdown: 0, url: 0 };
  const tagCounts = new Map();
  const topics = [];

  for (const n of notes) {
    if (n.type && types[n.type] !== undefined) {
      types[n.type]++;
    }
    if (Array.isArray(n.tags)) {
      for (const t of n.tags) {
        if (!t) continue;
        const normalized = t.toLowerCase().trim();
        tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
      }
    }
    if (n.title && topics.length < 5) {
      topics.push(n.title.trim());
    }
  }

  // Sort tags by frequency
  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 6);

  const lastActivity = notes[0]?.updatedAt || new Date();

  // Generate concise 1-sentence summary
  let summary = "";
  const apiKey = process.env.GEMINI_API_KEY;

  if (useAi && apiKey && topics.length > 0) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const prompt = `Synthesize a one-sentence summary (max 15 words) of a knowledge collection titled "${brain.name}" containing these topics: ${topics.join(", ")}. Do not use quotes or introductory phrases.`;
      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.();
      if (text) {
        summary = text.trim().replace(/^["']|["']$/g, "").slice(0, 150);
      }
    } catch (_aiErr) {
      // Fall through to heuristic summary
    }
  }

  if (!summary) {
    const tagSummary = sortedTags.length > 0 ? ` covering ${sortedTags.slice(0, 3).join(", ")}` : "";
    summary = `Collection of ${noteCount} note${noteCount === 1 ? "" : "s"}${tagSummary}.`;
  }

  const memoryState = {
    summary,
    noteCount,
    types,
    tags: sortedTags,
    topics,
    lastActivity: lastActivity instanceof Date ? lastActivity.toISOString() : String(lastActivity),
  };

  let jsonStr = JSON.stringify(memoryState);
  // Guarantee fits within 500 characters
  if (jsonStr.length > 490) {
    memoryState.topics = memoryState.topics.slice(0, 3);
    memoryState.tags = memoryState.tags.slice(0, 4);
    jsonStr = JSON.stringify(memoryState);
  }

  brain.description = jsonStr;
  brain.memoryState = memoryState;

  if (shouldSave) {
    await brain.save();
  }

  return memoryState;
}

module.exports = {
  generateBrainMemoryState,
};
