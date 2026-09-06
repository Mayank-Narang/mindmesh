/**
 * MindMesh — Real API Service
 * Connects to the Express backend at VITE_API_BASE_URL.
 */

const BASE = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:5000/api';

let authToken = typeof window !== 'undefined' ? localStorage.getItem('mindmesh_token') : null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  if (!authToken && typeof window !== 'undefined') {
    try {
      authToken = localStorage.getItem('mindmesh_token');
    } catch {
      authToken = null;
    }
  }
  return authToken;
}

export function onUnauthorized(handler) {
  if (typeof window !== 'undefined') {
    window.addEventListener('mindmesh:unauthorized', handler);
    return () => window.removeEventListener('mindmesh:unauthorized', handler);
  }
  return () => {};
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const errorMessage = err.error || err.message || `Request failed: ${res.status}`;

    // Handle 401 Unauthorized
    if (res.status === 401) {
      const isAuthEndpoint = path.includes('/auth/login') || path.includes('/auth/signup');
      if (!isAuthEndpoint) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('mindmesh_token');
            localStorage.removeItem('mindmesh_user');
          } catch {
            // ignore storage errors
          }
          setAuthToken(null);
          window.dispatchEvent(new CustomEvent('mindmesh:unauthorized'));
        }
      }
    }

    throw new Error(errorMessage);
  }
  return res.json();
}

// ─── Authentication ─────────────────────────────────────────

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function signup(name, email, password) {
  const data = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function getMe() {
  return request('/auth/me');
}

// ─── Notes ──────────────────────────────────────────────────

export async function getNotes(brainId = null) {
  const params = new URLSearchParams();
  if (brainId) params.set('brain', brainId);
  params.set('sort', '-updatedAt');
  params.set('limit', '50');
  const data = await request(`/notes?${params}`);
  return data.notes;
}

export async function getNoteById(id) {
  return request(`/notes/${id}`);
}

export async function saveDraft(note) {
  if (note._id || note.id) {
    // Update existing note
    const id = note._id || note.id;
    const result = await request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(note),
    });
    return { success: true, savedAt: result.updatedAt, note: result };
  }
  // Create new note
  const result = await request('/notes', {
    method: 'POST',
    body: JSON.stringify(note),
  });
  return { success: true, savedAt: result.createdAt, note: result };
}

export async function deleteNote(id) {
  return request(`/notes/${id}`, { method: 'DELETE' });
}

// ─── Search ─────────────────────────────────────────────────

export async function searchNotes(query) {
  if (!query || !query.trim()) return [];
  const data = await request('/notes/search', {
    method: 'POST',
    body: JSON.stringify({ query: query.trim(), limit: 10 }),
  });
  return data.results.map((r) => ({
    ...r,
    id: r._id,
    score: r.score,
    snippet: r.content ? r.content.substring(0, 150) + '...' : '',
  }));
}

// ─── Brains (placeholder until backend has brain routes) ────

export async function getBrains() {
  // Backend doesn't have brain routes yet — derive from notes
  const notes = await getNotes();
  const brainMap = new Map();
  notes.forEach((n) => {
    const bid = n.brain || 'default';
    if (!brainMap.has(bid)) {
      brainMap.set(bid, { id: bid, name: bid === 'default' ? 'General' : bid, emoji: '🧠', noteCount: 0, color: '#22d3ee', createdAt: n.createdAt });
    }
    brainMap.get(bid).noteCount++;
  });
  return Array.from(brainMap.values());
}

// ─── URL Metadata ───────────────────────────────────────────

export async function getUrlMetadata(url) {
  // No backend route for this yet — return a basic stub
  return {
    url,
    title: new URL(url).hostname,
    description: '',
    siteName: new URL(url).hostname,
    image: null,
    favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
  };
}

// ─── Brains ─────────────────────────────────────────────────

export async function createBrain(brain) {
  return request('/brains', {
    method: 'POST',
    body: JSON.stringify(brain),
  });
}

export async function updateBrain(id, brain) {
  return request(`/brains/${id}`, {
    method: 'PUT',
    body: JSON.stringify(brain),
  });
}

export async function deleteBrain(id) {
  return request(`/brains/${id}`, { method: 'DELETE' });
}

export async function getBrainById(id) {
  return request(`/brains/${id}`);
}

// ─── Sharing ────────────────────────────────────────────────

export async function shareBrain(id, email, permission = 'read') {
  return request(`/brains/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  });
}

export async function unshareBrain(id, email) {
  return request(`/brains/${id}/share/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
}

export async function shareNote(id, email, permission = 'read') {
  return request(`/notes/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  });
}

export async function unshareNote(id, email) {
  return request(`/notes/${id}/share/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
}

export async function getSharedWithMe() {
  return request('/shares/shared-with-me');
}

// ─── AI Q&A ─────────────────────────────────────────────────

export async function askAI(question, brainId = null) {
  return request('/ai/ask', {
    method: 'POST',
    body: JSON.stringify({ question, brainId }),
  });
}

// ─── Profile ────────────────────────────────────────────────

export async function updateProfile(profile) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}
