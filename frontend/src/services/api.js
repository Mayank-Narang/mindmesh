/**
 * MindMesh — Real API Service
 * Connects to the Express backend at VITE_API_BASE_URL.
 * Normalizes all entities so that `id` is the only identifier exposed to UI code.
 */

const BASE = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:5000/api';

let authToken = typeof window !== 'undefined' ? localStorage.getItem('mindmesh_token') : null;

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isForbidden = status === 403;
    this.isConflict = status === 409;
    this.isServiceUnavailable = status === 503;
    this.serverNote = data.serverNote || data.note || null;
    this.draft = data.draft || null;
  }
}

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

/**
 * Normalizes any entity from backend:
 * Guarantees `id: string` exists and strips out raw MongoDB `_id` so UI code
 * never relies on `_id`. Also normalizes relations (brain, author, sharedWith).
 */
export function normalizeEntity(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  if (Array.isArray(entity)) return entity.map(normalizeEntity);

  const normalized = { ...entity };
  if (normalized._id && !normalized.id) {
    normalized.id = typeof normalized._id === 'object' && normalized._id !== null
      ? normalized._id.toString()
      : String(normalized._id);
  }
  // Remove _id to enforce that UI code strictly relies on `id`
  delete normalized._id;

  if (normalized.brain && typeof normalized.brain === 'object') {
    normalized.brain = normalizeEntity(normalized.brain);
    normalized.brainId = normalized.brain.id;
  } else if (normalized.brain) {
    normalized.brainId = String(normalized.brain);
  }

  if (normalized.author && typeof normalized.author === 'object') {
    normalized.author = normalizeEntity(normalized.author);
  }

  if (Array.isArray(normalized.sharedWith)) {
    normalized.sharedWith = normalized.sharedWith.map((s) => {
      if (s && s.user && typeof s.user === 'object') {
        return { ...s, user: normalizeEntity(s.user) };
      }
      return s;
    });
  }

  return normalized;
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

    throw new ApiError(errorMessage, res.status, err);
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
  return {
    ...data,
    user: normalizeEntity(data.user),
  };
}

export async function signup(name, email, password) {
  const data = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  if (data.token) {
    setAuthToken(data.token);
  }
  return {
    ...data,
    user: normalizeEntity(data.user),
  };
}

export async function getMe() {
  const data = await request('/auth/me');
  return {
    ...data,
    user: normalizeEntity(data.user),
  };
}

// ─── Notes ──────────────────────────────────────────────────

export async function getNotes(brainId = null) {
  const params = new URLSearchParams();
  if (brainId && brainId !== 'unassigned') {
    params.set('brain', brainId);
  }
  params.set('sort', '-updatedAt');
  params.set('limit', '1000');
  const data = await request(`/notes?${params}`);
  return normalizeEntity(data.notes || []);
}

export async function getNoteById(id) {
  const data = await request(`/notes/${id}`);
  return normalizeEntity(data);
}

export async function saveDraft(note) {
  const noteId = note.id || note._id;
  const payload = { ...note };
  delete payload.id;
  delete payload._id;

  if (payload.brainId === 'unassigned') {
    payload.brain = null;
  } else if (payload.brainId) {
    payload.brain = payload.brainId;
  }

  if (noteId) {
    // Update existing note: MUST issue PUT
    const result = await request(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const normalized = normalizeEntity(result);
    return {
      success: true,
      savedAt: normalized.updatedAt || new Date().toISOString(),
      note: normalized,
    };
  }

  // Create new note: issues POST
  const result = await request('/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const normalized = normalizeEntity(result);
  return {
    success: true,
    savedAt: normalized.createdAt || new Date().toISOString(),
    note: normalized,
  };
}

export async function deleteNote(id) {
  return request(`/notes/${id}`, { method: 'DELETE' });
}

// ─── Search ─────────────────────────────────────────────────

export async function searchNotes(query, options = {}) {
  if (!query || !query.trim()) return [];
  const { mode = 'semantic', brain, type, tags, dateFrom, dateTo, limit = 20 } = options;

  const payload = {
    query: query.trim(),
    limit: Math.max(limit, 20),
    mode,
  };
  if (brain && brain !== 'all') payload.brain = brain;
  if (type && type !== 'all') payload.type = type;

  const data = await request('/notes/search', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  let rawResults = (data.results || []).map((r) => {
    const norm = normalizeEntity(r);
    const scoreVal = typeof norm.score === 'number' ? norm.score : 0.85;
    return {
      ...norm,
      score: scoreVal,
      snippet: norm.snippet || (norm.content ? norm.content.substring(0, 160) + (norm.content.length > 160 ? '...' : '') : ''),
      mode,
    };
  });

  // Client-side filtering support across search modes
  if (type && type !== 'all') {
    rawResults = rawResults.filter((r) => r.type === type);
  }
  if (brain && brain !== 'all') {
    rawResults = rawResults.filter((r) => r.brainId === brain || r.brain === brain);
  }
  if (tags && tags.length > 0) {
    rawResults = rawResults.filter((r) => r.tags && tags.some((t) => r.tags.includes(t)));
  }
  if (dateFrom) {
    const fromTime = new Date(dateFrom).getTime();
    rawResults = rawResults.filter((r) => new Date(r.updatedAt || r.createdAt).getTime() >= fromTime);
  }
  if (dateTo) {
    const toTime = new Date(dateTo).getTime();
    rawResults = rawResults.filter((r) => new Date(r.updatedAt || r.createdAt).getTime() <= toTime);
  }

  const lowerQ = query.toLowerCase();
  if (mode === 'keyword') {
    rawResults.sort((a, b) => {
      const aMatches = ((a.title || '').toLowerCase().match(new RegExp(lowerQ, 'g')) || []).length * 2 +
                       ((a.content || '').toLowerCase().match(new RegExp(lowerQ, 'g')) || []).length;
      const bMatches = ((b.title || '').toLowerCase().match(new RegExp(lowerQ, 'g')) || []).length * 2 +
                       ((b.content || '').toLowerCase().match(new RegExp(lowerQ, 'g')) || []).length;
      return bMatches - aMatches;
    });
  } else if (mode === 'recency') {
    rawResults.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  } else if (mode === 'hybrid') {
    rawResults.sort((a, b) => (b.score || 0.5) - (a.score || 0.5));
  }

  return rawResults.slice(0, limit);
}

// ─── Brains ─────────────────────────────────────────────────

export async function getBrains() {
  const data = await request('/brains');
  const rawList = data.brains || (Array.isArray(data) ? data : []);
  return normalizeEntity(rawList);
}

export async function getBrainById(id) {
  const data = await request(`/brains/${id}`);
  return {
    brain: normalizeEntity(data.brain),
    notes: normalizeEntity(data.notes || []),
  };
}

export async function createBrain(brain) {
  const data = await request('/brains', {
    method: 'POST',
    body: JSON.stringify(brain),
  });
  return { brain: normalizeEntity(data.brain || data) };
}

export async function updateBrain(id, brain) {
  const data = await request(`/brains/${id}`, {
    method: 'PUT',
    body: JSON.stringify(brain),
  });
  return { brain: normalizeEntity(data.brain || data) };
}

export async function deleteBrain(id) {
  return request(`/brains/${id}`, { method: 'DELETE' });
}

// ─── URL Metadata ───────────────────────────────────────────

export async function getUrlMetadata(url) {
  const data = await request(`/notes/metadata?url=${encodeURIComponent(url)}`);
  return data;
}

// ─── Sharing ────────────────────────────────────────────────

export async function shareBrain(id, email, permission = 'read') {
  const data = await request(`/brains/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  });
  return normalizeEntity(data);
}

export async function unshareBrain(id, email) {
  const data = await request(`/brains/${id}/share/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  return normalizeEntity(data);
}

export async function shareNote(id, email, permission = 'read') {
  const data = await request(`/notes/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  });
  return normalizeEntity(data);
}

export async function unshareNote(id, email) {
  const data = await request(`/notes/${id}/share/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  return normalizeEntity(data);
}

export async function getSharedWithMe() {
  const data = await request('/shares/shared-with-me');
  return {
    brains: normalizeEntity(data.brains || []),
    notes: normalizeEntity(data.notes || []),
  };
}

// ─── Note Locking Adapter ───────────────────────────────────

export async function acquireNoteLock(noteId) {
  try {
    const data = await request(`/notes/${noteId}/lock`, { method: 'POST' });
    return normalizeEntity(data);
  } catch (err) {
    if (err.status === 404 || err.status === 501 || err.status === 405) {
      // Backend lock endpoint fallback
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('mindmesh_user') || '{}') : {};
      return {
        locked: true,
        holder: { id: user.id || 'user-current', name: user.name || 'You', email: user.email },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
    }
    throw err;
  }
}

export async function renewNoteLock(noteId) {
  try {
    const data = await request(`/notes/${noteId}/lock/renew`, { method: 'POST' });
    return normalizeEntity(data);
  } catch (err) {
    if (err.status === 404 || err.status === 501 || err.status === 405) {
      return {
        locked: true,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
    }
    throw err;
  }
}

export async function releaseNoteLock(noteId) {
  try {
    const data = await request(`/notes/${noteId}/lock`, { method: 'DELETE' });
    return normalizeEntity(data);
  } catch (err) {
    if (err.status === 404 || err.status === 501 || err.status === 405) {
      return { locked: false };
    }
    throw err;
  }
}

// ─── AI Q&A with SSE Stream ─────────────────────────────────

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
      body: JSON.stringify({ question, brainId: brainId || undefined }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(err.error || `Request failed: ${res.status}`, res.status, err);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split('\n');
        let currentEvent = 'message';
        let currentData = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              currentData = JSON.parse(line.substring(6));
            } catch {
              currentData = { text: line.substring(6) };
            }
          }
        }

        if (currentData) {
          if (currentEvent === 'sources' && onSources) {
            onSources(normalizeEntity(currentData.sources || []));
          } else if (currentEvent === 'message' && onMessage) {
            onMessage(currentData.text || '');
          } else if (currentEvent === 'error' && onError) {
            onError(currentData.error || 'AI generation encountered an error.');
          } else if (currentEvent === 'done' && onDone) {
            onDone();
          }
        }
      }
    }

    if (onDone) onDone();
  } catch (err) {
    if (onError) onError(err.message || 'Failed to stream response.');
  }
}

// ─── Profile ────────────────────────────────────────────────

export async function updateProfile(profile) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}
