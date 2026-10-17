/**
 * vector.js — Gemini Embedding Service
 *
 * Generates 768-dimensional vector embeddings using Google's
 * gemini-embedding-001 model via the @google/generative-ai SDK.
 *
 * Features:
 *   • generateEmbedding(text, title) – for indexing document chunks
 *   • generateQueryEmbedding(text)   – for search and RAG queries
 *   • In-memory LRU cache to reduce latency and API calls
 *   • Exponential backoff retries for 429 rate limits and 5xx transient server errors
 *   • L2-normalisation for cosine and dot-product interchangeability
 */

const { GoogleGenerativeAI, TaskType } = require("@google/generative-ai");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-embedding-001";
const OUTPUT_DIMS = 768; // reduced from the default 3072 for storage efficiency
const MAX_INPUT_CHARS = 8000;
const MAX_CACHE_ENTRIES = 500;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// In-Memory Embedding Cache
// ---------------------------------------------------------------------------
const _cache = new Map();

function getFromCache(key) {
  if (!_cache.has(key)) return null;
  const val = _cache.get(key);
  // Re-insert to keep MRU order
  _cache.delete(key);
  _cache.set(key, val);
  return val.slice();
}

function setToCache(key, vector) {
  if (!vector || !Array.isArray(vector)) return;
  if (_cache.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest (first key in map)
    const oldestKey = _cache.keys().next().value;
    _cache.delete(oldestKey);
  }
  _cache.set(key, vector.slice());
}

function clearEmbeddingCache() {
  _cache.clear();
}

function getEmbeddingCacheSize() {
  return _cache.size;
}

// ---------------------------------------------------------------------------
// SDK initialisation (lazy — only created once)
// ---------------------------------------------------------------------------
let _model = null;

function getModel() {
  if (process.env.NODE_ENV === "test") return null;
  if (_model) return _model;

  const key = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!key) {
    console.warn(
      "⚠️  GEMINI_API_KEY is not set — embeddings will be skipped."
    );
    return null;
  }

  const genAI = new GoogleGenerativeAI(key);
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
 */
function l2Normalise(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute an embedding API call with exponential backoff on 429 or 5xx.
 *
 * @param {Function} apiCallFn
 * @param {string} label
 * @returns {Promise<any>}
 */
async function callWithRetry(apiCallFn, label = "Embedding") {
  let attempt = 1;
  let delay = BASE_RETRY_DELAY_MS;

  while (attempt <= MAX_RETRIES) {
    try {
      return await apiCallFn();
    } catch (err) {
      const isRateLimit = err.status === 429 || (err.message && err.message.includes("429"));
      const isServerError = err.status >= 500 && err.status < 600;

      if ((isRateLimit || isServerError) && attempt < MAX_RETRIES) {
        const jitter = Math.floor(Math.random() * 100);
        const backoffMs = delay + jitter;
        console.warn(
          `[${label}] Attempt ${attempt} failed (${err.status || err.message}). Retrying in ${backoffMs}ms...`
        );
        await sleep(backoffMs);
        delay *= 2;
        attempt++;
      } else {
        console.error(`[${label}] Failed after ${attempt} attempt(s):`, err.message);
        return null;
      }
    }
  }
  return null;
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

  const cacheKey = `DOC:${title || ""}:${input}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const result = await callWithRetry(async () => {
    return await model.embedContent({
      content: { role: "user", parts: [{ text: input }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      ...(title ? { title } : {}),
      outputDimensionality: OUTPUT_DIMS,
    });
  }, "generateEmbedding");

  if (!result || !result.embedding || !result.embedding.values) {
    return null;
  }

  const normalised = l2Normalise(result.embedding.values);
  setToCache(cacheKey, normalised);
  return normalised;
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

  const cacheKey = `QUERY:${input}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const result = await callWithRetry(async () => {
    return await model.embedContent({
      content: { role: "user", parts: [{ text: input }] },
      taskType: TaskType.RETRIEVAL_QUERY,
      outputDimensionality: OUTPUT_DIMS,
    });
  }, "generateQueryEmbedding");

  if (!result || !result.embedding || !result.embedding.values) {
    return null;
  }

  const normalised = l2Normalise(result.embedding.values);
  setToCache(cacheKey, normalised);
  return normalised;
}

module.exports = {
  generateEmbedding,
  generateQueryEmbedding,
  clearEmbeddingCache,
  getEmbeddingCacheSize,
  OUTPUT_DIMS,
};
