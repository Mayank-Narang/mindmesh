/**
 * URL Metadata Extraction Service for MindMesh
 *
 * This service implements a dual-strategy for extracting Open Graph and other semantic metadata from URLs:
 * 1. Primary Strategy: Uses `metascraper` and its rule packages for robust, standardized extraction.
 * 2. Fallback Strategy: If metascraper fails to retrieve essential fields (title or description), it falls back
 *    to direct HTML parsing using `cheerio` to extract meta tags (OG, Twitter) and standard HTML elements.
 *
 * This combination ensures high reliability when converting saved links into semantically searchable content.
 */

const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-url')()
]);

const cheerio = require('cheerio');

/**
 * @typedef {Object} MetadataResult
 * @property {string} title - The title of the page.
 * @property {string} description - The description of the page.
 * @property {string} image - The URL to an image representing the page.
 * @property {string} url - The canonical URL of the page.
 * @property {string} author - The author of the content.
 * @property {string} date - The publication date.
 * @property {string} publisher - The publisher of the content.
 * @property {string} favicon - The URL to the site's favicon.
 */

/**
 * Creates an empty metadata result object.
 * @returns {MetadataResult}
 */
const createEmptyResult = () => ({
  title: '',
  description: '',
  image: '',
  url: '',
  author: '',
  date: '',
  publisher: '',
  favicon: ''
});

/**
 * Helper to validate a URL.
 * @param {string} urlString 
 * @returns {boolean}
 */
const isValidUrl = (urlString) => {
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Extracts metadata from a given URL using metascraper and cheerio fallback.
 * @param {string} targetUrl - The URL to extract metadata from.
 * @param {number} [timeoutMs=10000] - Timeout for the fetch request in milliseconds.
 * @returns {Promise<MetadataResult>} The extracted metadata. Never throws.
 */
async function extractMetadata(targetUrl, timeoutMs = 10000) {
  const result = createEmptyResult();

  if (!isValidUrl(targetUrl)) {
    console.warn(`Invalid URL provided for metadata extraction: ${targetUrl}`);
    return result;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      signal: abortController.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Failed to fetch URL ${targetUrl}: HTTP ${response.status}`);
      return result;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      console.warn(`URL ${targetUrl} did not return HTML content (Content-Type: ${contentType})`);
      return result;
    }

    const html = await response.text();
    const finalUrl = response.url; // Use final URL after any redirects

    // 1. Primary Extraction: metascraper
    let metaResult;
    try {
      metaResult = await metascraper({ html, url: finalUrl });
    } catch (err) {
      console.warn(`Metascraper failed on ${targetUrl}`, err.message);
      metaResult = {};
    }

    // Merge metascraper results
    if (metaResult.title) result.title = metaResult.title;
    if (metaResult.description) result.description = metaResult.description;
    if (metaResult.image) result.image = metaResult.image;
    if (metaResult.url) result.url = metaResult.url;
    if (metaResult.author) result.author = metaResult.author;
    if (metaResult.date) result.date = metaResult.date;
    if (metaResult.publisher) result.publisher = metaResult.publisher;

    // Default URL to the fetched URL if not found by metascraper
    if (!result.url) result.url = finalUrl;

    // 2. Fallback Extraction: cheerio
    const needsFallback = !result.title || !result.description || !result.image;
    
    // Always use cheerio for favicon as metascraper doesn't have a default favicon package in this setup
    const $ = cheerio.load(html);

    if (needsFallback) {
      if (!result.title) {
        result.title = $('meta[property="og:title"]').attr('content') ||
                       $('meta[name="twitter:title"]').attr('content') ||
                       $('title').text() || '';
      }
      if (!result.description) {
        result.description = $('meta[property="og:description"]').attr('content') ||
                             $('meta[name="twitter:description"]').attr('content') ||
                             $('meta[name="description"]').attr('content') || '';
      }
      if (!result.image) {
        result.image = $('meta[property="og:image"]').attr('content') ||
                       $('meta[name="twitter:image"]').attr('content') || '';
      }
    }

    // Extract favicon
    let faviconUrl = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
    if (faviconUrl) {
      try {
        result.favicon = new URL(faviconUrl, finalUrl).href;
      } catch (e) {
        result.favicon = '';
      }
    } else {
      // Default to /favicon.ico on the same domain
      try {
        const urlObj = new URL(finalUrl);
        result.favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
      } catch (e) {
        result.favicon = '';
      }
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`Fetch timed out for URL ${targetUrl} after ${timeoutMs}ms`);
    } else {
      console.warn(`Error extracting metadata for ${targetUrl}:`, error.message);
    }
  } finally {
    clearTimeout(timeoutId); // Ensure timeout is cleared in all cases
  }

  // Ensure all values are strings (fallback against undefined)
  for (const key of Object.keys(result)) {
    if (result[key] == null) result[key] = '';
  }

  return result;
}

/**
 * Builds a single searchable string from the metadata by concatenating key text fields.
 * Useful for generating embeddings or full-text search indexing of link-type notes.
 * @param {MetadataResult} metadata - The extracted metadata.
 * @returns {string} The concatenated searchable content.
 */
function buildSearchableContent(metadata) {
  const parts = [];
  if (metadata.title) parts.push(metadata.title);
  if (metadata.description) parts.push(metadata.description);
  if (metadata.author) parts.push(metadata.author);
  if (metadata.publisher) parts.push(metadata.publisher);
  
  return parts.join(' ').trim();
}

module.exports = {
  extractMetadata,
  buildSearchableContent
};
