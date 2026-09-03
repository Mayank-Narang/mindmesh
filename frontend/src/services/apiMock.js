/**
 * MindMesh — Mock API Service
 * Simulates backend responses with realistic dummy data.
 * All functions return Promises with artificial delays.
 */

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ─── Dummy Data ──────────────────────────────────────────────

const BRAINS = [
  { id: 'brain-1', name: 'Personal', emoji: '🧠', noteCount: 24, color: '#22d3ee', createdAt: '2026-08-01T10:00:00Z' },
  { id: 'brain-2', name: 'Work', emoji: '💼', noteCount: 18, color: '#8b5cf6', createdAt: '2026-08-05T14:30:00Z' },
  { id: 'brain-3', name: 'Research', emoji: '🔬', noteCount: 31, color: '#34d399', createdAt: '2026-08-10T09:15:00Z' },
];

const NOTES = [
  {
    id: 'note-1', brainId: 'brain-1', type: 'markdown', title: 'Linux Screen Brightness Fix',
    content: `# Fixing Screen Brightness on Arch Linux\n\nThe backlight controls stopped working after a kernel update.\n\n## Solution\n\nEdit the GRUB config and add the \`acpi_backlight=native\` parameter:\n\n\`\`\`bash\nsudo nano /etc/default/grub\nGRUB_CMDLINE_LINUX_DEFAULT="quiet acpi_backlight=native"\nsudo grub-mkconfig -o /boot/grub/grub.cfg\n\`\`\`\n\n> Reboot required after this change.\n\n### Alternative\nUse **brightnessctl** for manual control:\n- \`brightnessctl set 50%\`\n- \`brightnessctl set +10%\``,
    tags: ['linux', 'hardware'], updatedAt: '2026-09-01T08:30:00Z', createdAt: '2026-08-15T10:00:00Z',
  },
  {
    id: 'note-2', brainId: 'brain-2', type: 'markdown', title: 'JWT Auth Architecture Notes',
    content: `# JWT Authentication Architecture\n\n## Flow\n1. User sends credentials to \`/api/auth/login\`\n2. Server validates against MongoDB\n3. Server returns a **signed JWT** with 24h expiry\n4. Client stores token in \`httpOnly\` cookie\n\n## Token Payload\n| Field | Description |\n|---|---|\n| sub | User ID |\n| iat | Issued at timestamp |\n| exp | Expiry timestamp |\n| role | User role (admin/user) |\n\n## Security Considerations\n- Use **refresh tokens** for long-lived sessions\n- Implement rate limiting on auth endpoints\n- Never store JWT in localStorage`,
    tags: ['auth', 'security', 'backend'], updatedAt: '2026-09-02T14:20:00Z', createdAt: '2026-08-20T09:00:00Z',
  },
  {
    id: 'note-3', brainId: 'brain-3', type: 'url', title: 'MongoDB Vector Search Docs',
    content: 'Official documentation for MongoDB Atlas Vector Search — how to create vector indexes, run $vectorSearch queries, and use pre-filters.',
    url: 'https://www.mongodb.com/docs/atlas/atlas-vector-search/',
    metadata: { siteName: 'MongoDB Docs', description: 'Build AI-powered search with MongoDB Atlas Vector Search.', image: null, favicon: 'https://www.mongodb.com/favicon.ico' },
    tags: ['mongodb', 'vector-search', 'ai'], updatedAt: '2026-08-28T11:00:00Z', createdAt: '2026-08-22T16:00:00Z',
  },
  {
    id: 'note-4', brainId: 'brain-1', type: 'text', title: 'Quick Ideas for Side Projects',
    content: 'Build a CLI tool that converts natural language to shell commands using an LLM.\n\nBuild a browser extension that summarises long articles into bullet points.\n\nCreate a desktop widget that shows your most recent git commits across all repos.',
    tags: ['ideas'], updatedAt: '2026-08-30T20:10:00Z', createdAt: '2026-08-25T18:00:00Z',
  },
  {
    id: 'note-5', brainId: 'brain-3', type: 'markdown', title: 'Semantic vs Keyword Search',
    content: `# Semantic Search vs Keyword Search\n\n**Keyword search** matches exact terms. **Semantic search** matches *meaning*.\n\n## Example\n- Query: "adjusting display luminance"\n- Keyword search: ❌ No results (no exact match)\n- Semantic search: ✅ Finds "Linux Screen Brightness Fix"\n\n## How It Works\n1. Convert text to **vector embeddings** using a model\n2. Store embeddings in a **vector database**\n3. At query time, embed the query and find **nearest neighbours**\n\n### Key Metrics\n- **Cosine similarity** — angle between vectors\n- **Euclidean distance** — straight-line distance`,
    tags: ['search', 'ai', 'embeddings'], updatedAt: '2026-09-01T15:00:00Z', createdAt: '2026-08-27T12:00:00Z',
  },
  {
    id: 'note-6', brainId: 'brain-2', type: 'url', title: 'Gemini Embeddings API',
    content: 'Google AI documentation for the Gemini Embedding API — how to generate text embeddings for semantic search and retrieval.',
    url: 'https://ai.google.dev/gemini-api/docs/embeddings',
    metadata: { siteName: 'Google AI for Developers', description: 'Generate text embeddings using the Gemini API.', image: null, favicon: 'https://ai.google.dev/favicon.ico' },
    tags: ['gemini', 'embeddings', 'api'], updatedAt: '2026-08-29T09:30:00Z', createdAt: '2026-08-23T14:00:00Z',
  },
  {
    id: 'note-7', brainId: 'brain-1', type: 'markdown', title: 'React useEffect Cleanup Patterns',
    content: `# useEffect Cleanup Patterns\n\nAlways clean up effects that create subscriptions or timers.\n\n\`\`\`jsx\nuseEffect(() => {\n  const controller = new AbortController();\n  fetch('/api/data', { signal: controller.signal })\n    .then(res => res.json())\n    .then(setData);\n  return () => controller.abort();\n}, []);\n\`\`\`\n\n## Common Mistakes\n- ❌ Forgetting cleanup → memory leaks\n- ❌ Missing dependency array → infinite loops\n- ✅ Use AbortController for fetch calls`,
    tags: ['react', 'hooks', 'frontend'], updatedAt: '2026-09-03T07:00:00Z', createdAt: '2026-08-30T11:00:00Z',
  },
  {
    id: 'note-8', brainId: 'brain-3', type: 'text', title: 'Cosine Similarity Explained',
    content: 'Cosine similarity measures the cosine of the angle between two non-zero vectors. It ranges from -1 (opposite) to 1 (identical). For text embeddings, higher cosine similarity means the texts are more semantically related. Formula: cos(θ) = (A·B) / (||A|| × ||B||). Commonly used in information retrieval, recommendation systems, and semantic search engines.',
    tags: ['math', 'ml', 'search'], updatedAt: '2026-09-02T18:45:00Z', createdAt: '2026-08-28T15:00:00Z',
  },
];

// ─── Search result sets keyed by concept ────────────────────

const SEARCH_RESULT_MAP = {
  brightness: [
    { noteId: 'note-1', score: 0.96, snippet: 'Fixing Screen Brightness on Arch Linux — backlight controls and brightnessctl' },
    { noteId: 'note-5', score: 0.72, snippet: 'Semantic search finds "brightness" even when the exact word is not present' },
  ],
  auth: [
    { noteId: 'note-2', score: 0.95, snippet: 'JWT Authentication Architecture — login flow, token payload, security' },
    { noteId: 'note-6', score: 0.58, snippet: 'Gemini API authentication and key management' },
  ],
  search: [
    { noteId: 'note-5', score: 0.97, snippet: 'Semantic Search vs Keyword Search — embeddings, cosine similarity, nearest neighbours' },
    { noteId: 'note-3', score: 0.89, snippet: 'MongoDB Atlas Vector Search — creating vector indexes and $vectorSearch queries' },
    { noteId: 'note-8', score: 0.84, snippet: 'Cosine similarity — measuring semantic relatedness between text embeddings' },
    { noteId: 'note-6', score: 0.71, snippet: 'Gemini Embeddings API — generating text embeddings for retrieval' },
  ],
  react: [
    { noteId: 'note-7', score: 0.94, snippet: 'useEffect Cleanup Patterns — AbortController, memory leaks, dependency arrays' },
  ],
  vector: [
    { noteId: 'note-3', score: 0.95, snippet: 'MongoDB Atlas Vector Search — $vectorSearch queries and pre-filters' },
    { noteId: 'note-5', score: 0.91, snippet: 'Vector embeddings and nearest-neighbour retrieval for semantic search' },
    { noteId: 'note-8', score: 0.88, snippet: 'Cosine similarity for measuring distance between vector embeddings' },
    { noteId: 'note-6', score: 0.79, snippet: 'Generating text embeddings with the Gemini Embedding API' },
  ],
  ideas: [
    { noteId: 'note-4', score: 0.93, snippet: 'Side project ideas — CLI tool, browser extension, desktop widget' },
  ],
};

// ─── API Functions ──────────────────────────────────────────

export async function getBrains() {
  await delay(400);
  return [...BRAINS];
}

export async function getNotes(brainId = null) {
  await delay(500);
  if (brainId) return NOTES.filter((n) => n.brainId === brainId);
  return [...NOTES];
}

export async function getNoteById(id) {
  await delay(300);
  const note = NOTES.find((n) => n.id === id);
  if (!note) throw new Error(`Note not found: ${id}`);
  return { ...note };
}

export async function searchNotes(query) {
  await delay(700);
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase();
  // Try to match a curated result set first
  for (const [key, results] of Object.entries(SEARCH_RESULT_MAP)) {
    if (q.includes(key)) {
      return results.map((r) => {
        const note = NOTES.find((n) => n.id === r.noteId);
        return { ...note, score: r.score, snippet: r.snippet };
      });
    }
  }
  // Fallback: fuzzy match across all notes
  const matches = NOTES.filter((n) =>
    n.title.toLowerCase().includes(q) ||
    n.content.toLowerCase().includes(q) ||
    n.tags.some((t) => t.includes(q))
  ).map((n, i) => ({
    ...n,
    score: parseFloat((0.90 - i * 0.08).toFixed(2)),
    snippet: n.content.substring(0, 120) + '...',
  }));
  return matches;
}

export async function saveDraft(note) {
  await delay(400);
  console.log('[MindMesh Mock] Draft saved:', note.title || 'Untitled');
  return { success: true, savedAt: new Date().toISOString() };
}

export async function getUrlMetadata(url) {
  await delay(600);
  return {
    url,
    title: 'Example Page — ' + new URL(url).hostname,
    description: 'Automatically extracted metadata from ' + url,
    siteName: new URL(url).hostname,
    image: null,
    favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
  };
}
