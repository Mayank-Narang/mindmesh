const NoteChunk = require("../models/NoteChunk");
const { generateEmbedding } = require("./vector");

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;

/**
 * Split raw text into overlapping chunks respecting natural paragraph, sentence,
 * or word boundaries where possible.
 *
 * @param {string} text - Raw text to split.
 * @param {object} [options]
 * @param {number} [options.chunkSize=800] - Target character length per chunk.
 * @param {number} [options.overlap=150] - Overlap character count between consecutive chunks.
 * @returns {string[]} Array of string chunks.
 */
function splitIntoChunks(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(
    options.overlap !== undefined ? options.overlap : DEFAULT_OVERLAP,
    Math.floor(chunkSize / 2)
  );

  if (!text || typeof text !== "string") return [];
  const cleanText = text.trim();
  if (!cleanText) return [];

  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  const chunks = [];
  let start = 0;

  while (start < cleanText.length) {
    let end = start + chunkSize;

    if (end >= cleanText.length) {
      const lastChunk = cleanText.slice(start).trim();
      if (lastChunk) chunks.push(lastChunk);
      break;
    }

    // Search window near the target boundary to find natural break
    const searchStart = Math.max(start + overlap, end - 150);
    const searchEnd = Math.min(cleanText.length, end + 50);
    const windowText = cleanText.slice(searchStart, searchEnd);

    let splitOffset = -1;

    // 1. Try Markdown header or double newline (paragraph boundary)
    const doubleNewline = windowText.lastIndexOf("\n\n");
    if (doubleNewline !== -1) {
      splitOffset = searchStart + doubleNewline + 2;
    } else {
      // 2. Try single newline
      const singleNewline = windowText.lastIndexOf("\n");
      if (singleNewline !== -1) {
        splitOffset = searchStart + singleNewline + 1;
      } else {
        // 3. Try sentence boundary (period, question mark, or exclamation followed by space)
        const sentenceMatch = windowText.match(/([.!?]\s)(?!.*[.!?]\s)/);
        if (sentenceMatch && sentenceMatch.index !== undefined) {
          splitOffset = searchStart + sentenceMatch.index + sentenceMatch[0].length;
        } else {
          // 4. Try whitespace
          const space = windowText.lastIndexOf(" ");
          if (space !== -1) {
            splitOffset = searchStart + space + 1;
          }
        }
      }
    }

    if (splitOffset > start && splitOffset <= cleanText.length) {
      end = splitOffset;
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Advance start with overlap
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

/**
 * Break a note document into indexed chunk items ready for embedding.
 *
 * @param {object} note - Mongoose Note document or plain note object.
 * @param {object} [options]
 * @returns {Array<{ chunkIndex: number, content: string }>}
 */
function chunkNote(note, options = {}) {
  const content = (note.content || "").trim();
  const title = (note.title || "").trim();
  const tags = Array.isArray(note.tags) ? note.tags.filter(Boolean).join(", ") : "";

  // If content is present, chunk it
  if (content) {
    const rawChunks = splitIntoChunks(content, options);
    if (rawChunks.length > 0) {
      return rawChunks.map((chunk, index) => ({
        chunkIndex: index,
        content: chunk,
      }));
    }
  }

  // Fallback if content is empty or resulted in empty chunks: use title + tags / urlMeta
  const fallbackParts = [title];
  if (note.urlMeta && note.urlMeta.description) {
    fallbackParts.push(note.urlMeta.description);
  }
  if (tags) {
    fallbackParts.push(`Tags: ${tags}`);
  }

  const fallbackText = fallbackParts.filter(Boolean).join("\n\n").trim();
  return fallbackText ? [{ chunkIndex: 0, content: fallbackText }] : [];
}

/**
 * Rebuild and re-embed all chunks for a note.
 * Removes existing chunks for the note and creates fresh ones.
 *
 * @param {object} note - Mongoose Note document.
 * @param {object} [options]
 * @param {boolean} [options.generateEmbeddings=true] - Whether to call embedding API.
 * @returns {Promise<Array>} List of created NoteChunk documents.
 */
async function rebuildNoteChunks(note, options = {}) {
  const shouldEmbed = options.generateEmbeddings !== false;
  const chunkItems = chunkNote(note, options);

  // Remove existing chunks for this note
  await NoteChunk.deleteMany({ note: note._id });

  if (chunkItems.length === 0) {
    return [];
  }

  const chunkDocs = [];
  let allEmbedded = true;

  for (const item of chunkItems) {
    let embedding = [];
    let isEmbedded = false;

    if (shouldEmbed) {
      try {
        embedding = await generateEmbedding(item.content, note.title);
        if (embedding && embedding.length > 0) {
          isEmbedded = true;
        } else {
          allEmbedded = false;
        }
      } catch (err) {
        console.warn(`Failed to embed chunk ${item.chunkIndex} for note ${note._id}:`, err.message);
        allEmbedded = false;
      }
    }

    chunkDocs.push({
      note: note._id,
      chunkIndex: item.chunkIndex,
      content: item.content,
      embedding: embedding || [],
      isEmbedded,
      brain: note.brain || null,
      author: note.author || null,
      type: note.type || "text",
      tags: note.tags || [],
    });
  }

  const savedChunks = await NoteChunk.insertMany(chunkDocs);

  // Maintain parent note isEmbedded flag and legacy embedding (first chunk's vector)
  if (shouldEmbed && savedChunks.length > 0) {
    note.isEmbedded = allEmbedded;
    if (savedChunks[0].embedding && savedChunks[0].embedding.length > 0) {
      note.embedding = savedChunks[0].embedding;
    }
  }

  return savedChunks;
}

/**
 * Synchronise replicated metadata (brain, author, type, tags) to all existing
 * chunks of a note when metadata changes without textual content change.
 *
 * @param {object} note - Note document with updated metadata.
 */
async function syncChunkMetadata(note) {
  await NoteChunk.updateMany(
    { note: note._id },
    {
      $set: {
        brain: note.brain || null,
        author: note.author || null,
        type: note.type || "text",
        tags: note.tags || [],
      },
    }
  );
}

/**
 * Delete all chunks associated with a parent note ID.
 *
 * @param {mongoose.Types.ObjectId | string} noteId
 */
async function deleteNoteChunks(noteId) {
  await NoteChunk.deleteMany({ note: noteId });
}

module.exports = {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
  splitIntoChunks,
  chunkNote,
  rebuildNoteChunks,
  syncChunkMetadata,
  deleteNoteChunks,
};
