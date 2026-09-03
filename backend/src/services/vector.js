/**
 * vector.js — Gemini Embedding Service
 *
 * Generates 768-dimensional vector embeddings using Google's
 * gemini-embedding-001 model via the @google/generative-ai SDK.
 *
 * Two public helpers:
 *   • generateEmbedding(text)       – for indexing documents
 *   • generateQueryEmbedding(text)  – for search queries
 *
 * Uses asymmetric task types (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY) so that
 * document and query embeddings are optimised for retrieval quality.
 */

const { GoogleGenerativeAI, TaskType } = require("@google/generative-ai");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-embedding-001";
const OUTPUT_DIMS = 768; // reduced from the default 3072 for storage efficiency

/**
 * Rough character-level cap to stay within the model's 2 048-token input
 * limit.  1 token ≈ 4 characters on average for English text, so
 * 2 048 × 4 = 8 192 characters is a safe ceiling.
 */
const MAX_INPUT_CHARS = 8000;

// ---------------------------------------------------------------------------
// SDK initialisation (lazy — only created once)
// ---------------------------------------------------------------------------
let _model = null;

function getModel() {
  if (_model) return _model;

  if (!GEMINI_API_KEY) {
    console.warn(
      "⚠️  GEMINI_API_KEY is not set — embeddings will be skipped."
    );
    return null;
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  _model = genAI.getGenerativeModel({ model: MODEL_NAME });
  return _model;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate text so it fits within the model's token budget. */
function truncate(text) {
  if (!text) return "";
  return text.length > MAX_INPUT_CHARS
    ? text.slice(0, MAX_INPUT_CHARS)
    : text;
}

/**
 * L2-normalise a vector in-place.
 *
 * When outputDimensionality is lower than the native 3 072, the API truncates
 * but does NOT re-normalise.  Cosine similarity in Atlas Vector Search works
 * correctly regardless, but normalised vectors let us also use dotProduct
 * interchangeably if we ever switch similarity metrics.
 */
function l2Normalise(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an embedding for a document to be stored and later retrieved.
 *
 * @param {string} text    – The note content to embed.
 * @param {string} [title] – Optional note title (provides extra context).
 * @returns {Promise<number[] | null>}  768-dim float array, or null on failure.
 */
async function generateEmbedding(text, title) {
  const model = getModel();
  if (!model) return null;

  const input = truncate(text);
  if (!input) return null;

  try {
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: input }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      ...(title ? { title } : {}),
      outputDimensionality: OUTPUT_DIMS,
    });

    return l2Normalise(result.embedding.values);
  } catch (err) {
    console.error("Embedding generation failed:", err.message);
    return null;
  }
}

/**
 * Generate an embedding optimised for a search / retrieval query.
 *
 * @param {string} text – The user's search query.
 * @returns {Promise<number[] | null>}  768-dim float array, or null on failure.
 */
async function generateQueryEmbedding(text) {
  const model = getModel();
  if (!model) return null;

  const input = truncate(text);
  if (!input) return null;

  try {
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: input }] },
      taskType: TaskType.RETRIEVAL_QUERY,
      outputDimensionality: OUTPUT_DIMS,
    });

    return l2Normalise(result.embedding.values);
  } catch (err) {
    console.error("Query embedding generation failed:", err.message);
    return null;
  }
}

module.exports = {
  generateEmbedding,
  generateQueryEmbedding,
  OUTPUT_DIMS,
};
