/**
 * MindMesh — Mock API Service
 * Simulates backend responses with realistic dummy data.
 * All functions return Promises with artificial delays.
 */

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

let mockAuthToken = typeof window !== 'undefined' ? localStorage.getItem('mindmesh_token') : null;

export function setAuthToken(token) {
  mockAuthToken = token;
}

export function getAuthToken() {
  if (!mockAuthToken && typeof window !== 'undefined') {
    try {
      mockAuthToken = localStorage.getItem('mindmesh_token');
    } catch {
      mockAuthToken = null;
    }
  }
  return mockAuthToken;
}

export function onUnauthorized(handler) {
  if (typeof window !== 'undefined') {
    window.addEventListener('mindmesh:unauthorized', handler);
    return () => window.removeEventListener('mindmesh:unauthorized', handler);
  }
  return () => {};
}

// ─── Stateful Mock Users ─────────────────────────────────────

const DEFAULT_MOCK_USERS = [
  {
    id: 'user-demo',
    name: 'Demo User',
    email: 'demo@mindmesh.io',
    password: 'DemoPassword123!',
    role: 'user',
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Alice Cooper',
    email: 'alice@mindmesh.io',
    password: 'Password123!',
    role: 'collaborator',
    createdAt: '2026-08-15T12:00:00Z',
  },
];

let inMemoryUsers = null;

function getMockUsers() {
  if (typeof window === 'undefined') {
    if (!inMemoryUsers) inMemoryUsers = [...DEFAULT_MOCK_USERS];
    return inMemoryUsers;
  }
  try {
    const stored = localStorage.getItem('mindmesh_mock_users');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem('mindmesh_mock_users', JSON.stringify(DEFAULT_MOCK_USERS));
  } catch {
    // ignore
  }
  return [...DEFAULT_MOCK_USERS];
}

function saveMockUsers(users) {
  if (typeof window === 'undefined') {
    inMemoryUsers = users;
    return;
  }
  try {
    localStorage.setItem('mindmesh_mock_users', JSON.stringify(users));
  } catch {
    // ignore
  }
}

// ─── Authentication ─────────────────────────────────────────

export async function login(email, password) {
  await delay(300);
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  const normEmail = email.trim().toLowerCase();
  const users = getMockUsers();
  const user = users.find((u) => u.email.toLowerCase() === normEmail);
  if (!user) {
    throw new Error('Invalid email or password');
  }
  if (normEmail === 'demo@mindmesh.io' && (password === 'DemoPassword123!' || password === 'demo')) {
    // matched
  } else if (user.password !== password) {
    throw new Error('Invalid email or password');
  }

  const token = `mock-jwt-token-${user.id}-${Date.now()}`;
  setAuthToken(token);
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}

export async function signup(name, email, password) {
  await delay(400);
  if (!name || name.trim().length < 2) {
    throw new Error('Full name must be at least 2 characters');
  }
  const normEmail = (email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!normEmail || !emailRegex.test(normEmail)) {
    throw new Error('Please enter a valid email address');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const users = getMockUsers();
  const existing = users.find((u) => u.email.toLowerCase() === normEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    email: normEmail,
    password,
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveMockUsers(users);

  const token = `mock-jwt-token-${newUser.id}-${Date.now()}`;
  setAuthToken(token);
  return {
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
    },
  };
}

export async function getMe() {
  await delay(200);
  const token = getAuthToken() || (typeof window !== 'undefined' ? localStorage.getItem('mindmesh_token') : null);
  if (!token) {
    throw new Error('Authentication required. Please provide a valid token.');
  }

  if (typeof window !== 'undefined') {
    try {
      const storedUser = localStorage.getItem('mindmesh_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.email) {
          return { user: parsed };
        }
      }
    } catch {
      // ignore
    }
  }

  const users = getMockUsers();
  const matched = users.find((u) => token.includes(u.id)) || users[0];
  return {
    user: {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: matched.role,
      createdAt: matched.createdAt,
    },
  };
}

// ─── Dummy Data ──────────────────────────────────────────────

const BRAINS = [
  { id: 'brain-1', name: 'Personal', emoji: '🧠', noteCount: 24, color: '#22d3ee', createdAt: '2026-08-01T10:00:00Z' },
  { id: 'brain-2', name: 'Work', emoji: '💼', noteCount: 18, color: '#8b5cf6', createdAt: '2026-08-05T14:30:00Z' },
  { id: 'brain-3', name: 'Research', emoji: '🔬', noteCount: 31, color: '#34d399', createdAt: '2026-08-10T09:15:00Z' },
];

const DEFAULT_NOTES = [
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

let inMemoryNotes = null;

function getMockNotes() {
  if (typeof window === 'undefined') {
    if (!inMemoryNotes) inMemoryNotes = [...DEFAULT_NOTES];
    return inMemoryNotes;
  }
  try {
    const stored = localStorage.getItem('mindmesh_mock_notes');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem('mindmesh_mock_notes', JSON.stringify(DEFAULT_NOTES));
  } catch {
    // ignore
  }
  return [...DEFAULT_NOTES];
}

function saveMockNotes(notes) {
  if (typeof window === 'undefined') {
    inMemoryNotes = notes;
    return;
  }
  try {
    localStorage.setItem('mindmesh_mock_notes', JSON.stringify(notes));
  } catch {
    // ignore
  }
}

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
  const brains = getMockBrains();
  const notes = getMockNotes();
  // Dynamically compute noteCount
  return brains.map(b => ({
    ...b,
    noteCount: notes.filter(n => n.brainId === b.id).length
  }));
}

export async function getNotes(brainId = null) {
  await delay(500);
  const notes = getMockNotes();
  if (brainId) return notes.filter((n) => n.brainId === brainId);
  return notes;
}

export async function getNoteById(id) {
  await delay(300);
  const notes = getMockNotes();
  const note = notes.find((n) => n.id === id);
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
  const notes = getMockNotes();
  const matches = notes.filter((n) =>
    (n.title && n.title.toLowerCase().includes(q)) ||
    (n.content && n.content.toLowerCase().includes(q)) ||
    (n.tags && n.tags.some((t) => t.includes(q)))
  ).map((n, i) => ({
    ...n,
    score: parseFloat((0.90 - i * 0.08).toFixed(2)),
    snippet: (n.content || '').substring(0, 120) + '...',
  }));
  return matches;
}

export async function saveDraft(note) {
  await delay(400);
  const notes = getMockNotes();
  let savedNote = { ...note };
  
  if (note.id) {
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      notes[idx] = { ...notes[idx], ...note, updatedAt: new Date().toISOString() };
      savedNote = notes[idx];
    } else {
      if (note.brainId) {
        const brainNotes = notes.filter(n => n.brainId === note.brainId);
        if (brainNotes.length >= 10) throw new Error('Free plan limit: A brain cannot have more than 10 notes.');
      }
      savedNote = { ...note, id: `note-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: note.tags || [] };
      notes.push(savedNote);
    }
  } else {
    if (note.brainId) {
      const brainNotes = notes.filter(n => n.brainId === note.brainId);
      if (brainNotes.length >= 10) throw new Error('Free plan limit: A brain cannot have more than 10 notes.');
    }
    savedNote = { ...note, id: `note-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: note.tags || [] };
    notes.push(savedNote);
  }
  
  saveMockNotes(notes);
  console.log('[MindMesh Mock] Draft saved:', note.title || 'Untitled');
  return { success: true, savedAt: new Date().toISOString(), note: savedNote };
}

export async function getUrlMetadata(url) {
  await delay(600);
  let finalUrl = url || '';
  if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = 'https://' + finalUrl;
  }
  let hostname = 'unknown';
  try { hostname = new URL(finalUrl).hostname; } catch(e) {}
  
  return {
    url: finalUrl,
    title: 'Extracted Page — ' + hostname,
    description: 'Automatically extracted metadata from ' + finalUrl,
    siteName: hostname,
    image: null,
    favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
  };
}

// ─── Brains (stateful) ──────────────────────────────────────

let inMemoryBrains = null;

function getMockBrains() {
  if (typeof window === 'undefined') {
    if (!inMemoryBrains) inMemoryBrains = [...BRAINS];
    return inMemoryBrains;
  }
  try {
    const stored = localStorage.getItem('mindmesh_mock_brains');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem('mindmesh_mock_brains', JSON.stringify(BRAINS));
  } catch {
    // ignore
  }
  return [...BRAINS];
}

function saveMockBrains(brains) {
  if (typeof window === 'undefined') {
    inMemoryBrains = brains;
    return;
  }
  try {
    localStorage.setItem('mindmesh_mock_brains', JSON.stringify(brains));
  } catch {
    // ignore
  }
}

export async function createBrain(brain) {
  await delay(300);
  const brains = getMockBrains();
  const newBrain = {
    id: `brain-${Date.now()}`,
    name: brain.name || 'Untitled Brain',
    description: brain.description || '',
    color: brain.color || '#22d3ee',
    icon: brain.icon || '🧠',
    noteCount: 0,
    createdAt: new Date().toISOString(),
  };
  brains.push(newBrain);
  saveMockBrains(brains);
  return { brain: newBrain };
}

export async function updateBrain(id, brain) {
  await delay(300);
  const brains = getMockBrains();
  const idx = brains.findIndex((b) => b.id === id);
  if (idx < 0) throw new Error('Brain not found');
  brains[idx] = { ...brains[idx], ...brain, id };
  saveMockBrains(brains);
  return { brain: brains[idx] };
}

export async function deleteBrain(id) {
  await delay(300);
  const brains = getMockBrains();
  const filtered = brains.filter((b) => b.id !== id);
  saveMockBrains(filtered);
  return { message: 'Brain deleted, notes unlinked' };
}

export async function getBrainById(id) {
  await delay(300);
  const brains = getMockBrains();
  const brain = brains.find((b) => b.id === id);
  if (!brain) throw new Error('Brain not found');
  const notes = getMockNotes();
  const brainNotes = notes.filter((n) => n.brainId === id);
  return { brain, notes: brainNotes };
}

// ─── Sharing (mock) ─────────────────────────────────────────

export async function shareBrain(id, email, permission = 'read') {
  await delay(300);
  const brains = getMockBrains();
  const idx = brains.findIndex(b => b.id === id);
  if (idx >= 0) {
    if (!brains[idx].sharedWith) brains[idx].sharedWith = [];
    brains[idx].sharedWith.push({ email, permission });
    saveMockBrains(brains);
    return { sharedWith: brains[idx].sharedWith };
  }
  throw new Error('Brain not found');
}

export async function unshareBrain(id, email) {
  await delay(300);
  const brains = getMockBrains();
  const idx = brains.findIndex(b => b.id === id);
  if (idx >= 0 && brains[idx].sharedWith) {
    brains[idx].sharedWith = brains[idx].sharedWith.filter(s => s.email !== email);
    saveMockBrains(brains);
    return { sharedWith: brains[idx].sharedWith };
  }
  return { sharedWith: [] };
}

export async function shareNote(id, email, permission = 'read') {
  await delay(300);
  const notes = getMockNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx >= 0) {
    if (!notes[idx].sharedWith) notes[idx].sharedWith = [];
    notes[idx].sharedWith.push({ email, permission });
    saveMockNotes(notes);
    return { sharedWith: notes[idx].sharedWith };
  }
  throw new Error('Note not found');
}

export async function unshareNote(id, email) {
  await delay(300);
  const notes = getMockNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx >= 0 && notes[idx].sharedWith) {
    notes[idx].sharedWith = notes[idx].sharedWith.filter(s => s.email !== email);
    saveMockNotes(notes);
    return { sharedWith: notes[idx].sharedWith };
  }
  return { sharedWith: [] };
}

export async function getSharedWithMe() {
  await delay(400);
  return {
    brains: [
      { id: 'brain-shared-1', name: 'Shared Project', emoji: '🤝', noteCount: 5, color: '#f59e0b', createdAt: '2026-08-20T10:00:00Z' },
    ],
    notes: [
      { id: 'note-shared-1', type: 'markdown', title: 'Team Meeting Notes', content: 'Shared meeting notes from the project kickoff...', tags: ['meeting'], updatedAt: '2026-09-04T10:00:00Z', createdAt: '2026-08-20T10:00:00Z' },
    ],
  };
}

// ─── AI Q&A (mock) ──────────────────────────────────────────

export async function askAI(question, brainId = null) {
  await delay(800);
  // Return a simple JSON response (the real one streams SSE)
  return {
    answer: `Based on your notes, here's what I found about "${question}": This is a mock AI response. In production, this would stream a real answer from Gemini using your notes as context.`,
    sources: [
      { id: 'note-1', title: 'Linux Screen Brightness Fix', snippet: 'Relevant content about your question...', score: 0.92 },
      { id: 'note-5', title: 'Semantic vs Keyword Search', snippet: 'Additional context that helps answer this...', score: 0.85 },
    ],
  };
}

// ─── Profile ────────────────────────────────────────────────

export async function updateProfile(profile) {
  await delay(400);
  const token = getAuthToken() || (typeof window !== 'undefined' ? localStorage.getItem('mindmesh_token') : null);
  const currentUser = (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('mindmesh_user') || '{}') : {});
  const updated = { ...currentUser, ...profile };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('mindmesh_user', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
  return { user: updated };
}
