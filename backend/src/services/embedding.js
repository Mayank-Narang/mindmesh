const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize client once at module load
let genAI = null;
let model = null;

function initialize() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is missing.');
        }
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    }
}

/**
 * Helper to pause execution for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate an embedding for the given text with exponential backoff retries.
 * 
 * @param {string} text - The text to embed.
 * @param {string} [taskType='RETRIEVAL_DOCUMENT'] - Task type ('RETRIEVAL_DOCUMENT' or 'RETRIEVAL_QUERY').
 * @returns {Promise<number[]>} - The 768-dimensional embedding array.
 */
async function getEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Input text must be a non-empty string after trimming.');
    }

    initialize();

    const maxRetries = 3;
    let delay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.embedContent({
                content: { parts: [{ text: text.trim() }] },
                taskType: taskType
            });
            return result.embedding.values;
        } catch (error) {
            const isRateLimit = error.status === 429;
            const isServerError = error.status >= 500 && error.status < 600;
            
            if ((isRateLimit || isServerError) && attempt < maxRetries) {
                console.warn(`[Embedding API] Attempt ${attempt} failed (Status: ${error.status}). Retrying in ${delay}ms...`);
                await sleep(delay);
                delay *= 2; // Exponential backoff
            } else {
                console.error(`[Embedding API] Failed to embed text after ${attempt} attempts:`, error.message);
                throw error;
            }
        }
    }
}

/**
 * Processes an array of texts to generate embeddings sequentially.
 * 
 * @param {string[]} texts - Array of texts to embed.
 * @param {string} [taskType='RETRIEVAL_DOCUMENT'] - Task type.
 * @returns {Promise<number[][]>} - Array of embedding arrays in the original order.
 */
async function getBatchEmbeddings(texts, taskType = 'RETRIEVAL_DOCUMENT') {
    if (!Array.isArray(texts)) {
        throw new Error('Input texts must be an array of strings.');
    }

    const embeddings = [];
    for (let i = 0; i < texts.length; i++) {
        try {
            const embedding = await getEmbedding(texts[i], taskType);
            embeddings.push(embedding);
            
            // Wait 300ms between calls to avoid rate limiting
            if (i < texts.length - 1) {
                await sleep(300);
            }
        } catch (error) {
            console.error(`[Batch Embeddings] Failed at index ${i}:`, error.message);
            throw error; // Fail the entire batch if one fails, or could return partial depending on requirements. Requirements say throws on other errors.
        }
    }

    return embeddings;
}

module.exports = {
    getEmbedding,
    getBatchEmbeddings
};
