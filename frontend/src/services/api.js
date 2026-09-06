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
  params.set('limit', '1000');
  const data = await request(`/notes?${params}`);
  return data.notes;
}

export async function getNoteById(id) {
  return request(`/notes/${id}`);
}

export async function saveDraft(note) {
  const payload = { ...note };
  if (payload.brainId === 'unassigned') {
    payload.brain = null;
  } else if (payload.brainId) {
    payload.brain = payload.brainId;
  }
  
  if (note._id || note.id) {
    // Update existing note
    const id = note._id || note.id;
    const result = await request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: true, savedAt: result.updatedAt, note: result };
  }
  // Create new note
  const result = await request('/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
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
  const data = await request('/brains');
  return data.brains || data;
}

// ─── URL Metadata ───────────────────────────────────────────

export async function getUrlMetadata(url) {
  const data = await request(`/notes/metadata?url=${encodeURIComponent(url)}`);
  return data;
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

export async function askAI(question, brainId = null, { onSources, onMessage, onError, onDone } = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${BASE}/ai/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question, brainId }),
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // keep the last incomplete part in the buffer

      for (const part of parts) {
        if (part.startsWith('event: ')) {
          const lines = part.split('\n');
          const eventMatch = lines[0].match(/event: (.*)/);
          const dataMatch = lines[1]?.match(/data: (.*)/);
          
          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (event === 'sources' && onSources) onSources(data.sources);
            if (event === 'message' && onMessage) onMessage(data.text);
            if (event === 'error' && onError) onError(data.error);
            if (event === 'done' && onDone) onDone();
          }
        }
      }
    }
  } catch (err) {
    if (onError) onError(err.message);
  }
}

// ─── Profile ────────────────────────────────────────────────

export async function updateProfile(profile) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}
