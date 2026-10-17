/**
 * tests/e2e/harness/serverLauncher.js
 * Express server lifecycle manager, health detector, and standalone mock adapter.
 * Handles pre-existing server detection on port 5000, ephemeral child process launch,
 * and high-fidelity fallback mock server for standalone offline/CI testing.
 */

const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

/**
 * Check if MindMesh server is alive and responding at /api/health.
 * @param {string} url - Target server base URL
 * @param {number} timeoutMs - Max wait time in ms
 * @returns {Promise<boolean>}
 */
async function isServerHealthy(url, timeoutMs = 2000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/health`, {
      signal: controller.signal
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Poll until server becomes healthy or timeout expires.
 * @param {string} url - Target server base URL
 * @param {number} maxWaitMs - Timeout in ms
 * @param {number} intervalMs - Polling interval in ms
 * @returns {Promise<boolean>}
 */
async function waitForHealth(url, maxWaitMs = 12000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isServerHealthy(url)) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return false;
}

/**
 * Create an in-process, high-fidelity HTTP mock server implementing the MindMesh API contracts.
 * Useful for standalone offline testing without MongoDB Atlas or external dependencies.
 * @param {number} port - Port to listen on (0 for OS ephemeral port)
 * @returns {Promise<{ server: http.Server, port: number, url: string, stop: () => Promise<void> }>}
 */
function createMockServer(port = 0) {
  return new Promise((resolve, reject) => {
    // In-memory state
    const users = new Map();
    const brains = new Map();
    const notes = new Map();
    const rateLimitMap = new Map(); // ip -> { count, resetTime }

    const defaultSecret = process.env.JWT_SECRET || 'mindmesh-test-secret-key-32-chars-long-e2e';

    // Helper: basic base64url JWT encode/decode for mock server
    function createToken(user) {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role, exp })).toString('base64url');
      const crypto = require('node:crypto');
      const sig = crypto.createHmac('sha256', defaultSecret).update(`${header}.${payload}`).digest('base64url');
      return `${header}.${payload}.${sig}`;
    }

    function verifyToken(token) {
      if (!token) return null;
      try {
        const [h, p, s] = token.split('.');
        if (!h || !p || !s) return null;
        const crypto = require('node:crypto');
        const expectedSig = crypto.createHmac('sha256', defaultSecret).update(`${h}.${p}`).digest('base64url');
        if (s !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf-8'));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
      } catch {
        return null;
      }
    }

    const server = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;
      const method = req.method.toUpperCase();

      // Read body
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      let body = {};
      if (rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = {};
        }
      }

      // Standard headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }

      // Rate limit tracking for login route
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      const now = Date.now();
      let rateData = rateLimitMap.get(clientIp);
      if (!rateData || now > rateData.resetTime) {
        rateData = { count: 0, resetTime: now + 5 * 60 * 1000 };
        rateLimitMap.set(clientIp, rateData);
      }

      const sendJson = (status, obj, extraHeaders = {}) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        for (const [k, v] of Object.entries(extraHeaders)) {
          res.setHeader(k, v);
        }
        res.end(JSON.stringify(obj));
      };

      // Extract bearer token
      const authHeader = req.headers['authorization'] || '';
      let currentUser = null;
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        currentUser = verifyToken(token);
      }

      // Rate limit headers
      const rlLimit = 100;
      const rlRemaining = Math.max(0, rlLimit - rateData.count);
      const rlReset = Math.ceil(rateData.resetTime / 1000);
      res.setHeader('X-RateLimit-Limit', String(rlLimit));
      res.setHeader('X-RateLimit-Remaining', String(rlRemaining));
      res.setHeader('X-RateLimit-Reset', String(rlReset));

      // 1. Health check
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(200, { status: 'ok', mongo: 'connected' });
      }

      // 2. Auth: Signup
      if (pathname === '/api/auth/signup' && method === 'POST') {
        const { name, email, password } = body;
        if (!name || !email || !password) {
          return sendJson(400, { error: 'Missing required fields: name, email, password' });
        }
        if (users.has(email.toLowerCase())) {
          return sendJson(409, { error: 'Email already registered' });
        }
        const user = {
          id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          email: email.toLowerCase(),
          role: 'user',
          password,
          createdAt: new Date().toISOString()
        };
        users.set(user.email, user);
        const token = createToken(user);
        return sendJson(201, {
          token,
          user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
      }

      // 3. Auth: Login
      if (pathname === '/api/auth/login' && method === 'POST') {
        rateData.count++;
        if (rateData.count > 5) {
          res.setHeader('Retry-After', '300');
          return sendJson(429, { error: 'Too many login attempts, please try again later' });
        }

        const { email, password } = body;
        if (!email || !password) {
          return sendJson(400, { error: 'Email and password required' });
        }
        const user = users.get(email.toLowerCase());
        if (!user || user.password !== password) {
          return sendJson(401, { error: 'Invalid credentials' });
        }
        const token = createToken(user);
        return sendJson(200, {
          token,
          user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
      }

      // 4. Auth: Me
      if (pathname === '/api/auth/me' && method === 'GET') {
        if (!currentUser) {
          return sendJson(401, { error: 'Authentication required' });
        }
        return sendJson(200, {
          user: {
            id: currentUser.id,
            name: currentUser.name || 'Test User',
            email: currentUser.email,
            role: currentUser.role || 'user',
            createdAt: new Date().toISOString()
          }
        });
      }

      // Protected routes require authentication
      if (pathname.startsWith('/api/brains') || pathname.startsWith('/api/notes') || pathname.startsWith('/api/shares') || pathname.startsWith('/api/ai')) {
        if (!currentUser && !authHeader) {
          return sendJson(401, { error: 'Authentication required' });
        }
      }

      // 5. Brains Routes
      if (pathname === '/api/brains' && method === 'POST') {
        if (!currentUser) return sendJson(401, { error: 'Authentication required' });
        const brain = {
          _id: `brain_${Date.now()}`,
          name: body.name || 'Untitled Brain',
          description: body.description || '',
          author: currentUser.id,
          color: body.color || '#22d3ee',
          icon: body.icon || '🧠',
          sharedWith: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        brains.set(brain._id, brain);
        return sendJson(201, { brain });
      }

      if (pathname === '/api/brains' && method === 'GET') {
        if (!currentUser) return sendJson(401, { error: 'Authentication required' });
        const userBrains = Array.from(brains.values())
          .filter(b => b.author === currentUser.id)
          .map(b => ({
            ...b,
            noteCount: Array.from(notes.values()).filter(n => n.brain === b._id).length
          }));
        return sendJson(200, { brains: userBrains });
      }

      const brainIdMatch = pathname.match(/^\/api\/brains\/([^/]+)$/);
      if (brainIdMatch) {
        const id = brainIdMatch[1];
        const brain = brains.get(id);
        if (!brain) return sendJson(404, { error: 'Brain not found' });

        if (method === 'GET') {
          const brainNotes = Array.from(notes.values()).filter(n => n.brain === id);
          return sendJson(200, { brain, notes: brainNotes });
        }
        if (method === 'PUT') {
          Object.assign(brain, body, { updatedAt: new Date().toISOString() });
          return sendJson(200, { brain });
        }
        if (method === 'DELETE') {
          // Unlink notes
          for (const note of notes.values()) {
            if (note.brain === id) note.brain = null;
          }
          brains.delete(id);
          return sendJson(200, { message: 'Brain deleted, notes unlinked' });
        }
      }

      // 6. Notes Routes
      if (pathname === '/api/notes' && method === 'POST') {
        if (!currentUser) return sendJson(401, { error: 'Authentication required' });
        const note = {
          _id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: body.title || 'Untitled Note',
          content: body.content || '',
          type: body.type || 'text',
          url: body.url || null,
          urlMeta: body.type === 'url' ? { title: body.title, siteName: 'MindMesh Web' } : null,
          tags: body.tags || [],
          brain: body.brain || null,
          author: currentUser.id,
          isEmbedded: true,
          sharedWith: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        notes.set(note._id, note);
        return sendJson(201, note);
      }

      if (pathname === '/api/notes' && method === 'GET') {
        if (!currentUser) return sendJson(401, { error: 'Authentication required' });
        let list = Array.from(notes.values());
        if (currentUser) {
          list = list.filter(n => n.author === currentUser.id);
        }
        return sendJson(200, { notes: list, total: list.length });
      }

      if (pathname === '/api/notes/search' && method === 'POST') {
        const query = (body.query || '').toLowerCase();
        const results = Array.from(notes.values()).filter(n =>
          (n.title && n.title.toLowerCase().includes(query)) ||
          (n.content && n.content.toLowerCase().includes(query))
        );
        return sendJson(200, { results });
      }

      const noteShareMatch = pathname.match(/^\/api\/notes\/([^/]+)\/share(?:\/([^/]+))?$/);
      if (noteShareMatch) {
        const id = noteShareMatch[1];
        const note = notes.get(id);
        if (!note) return sendJson(404, { error: 'Note not found' });
        if (note.author !== currentUser?.id) return sendJson(403, { error: 'Only owner can share note' });

        if (method === 'POST') {
          const { email, permission = 'read' } = body;
          note.sharedWith = note.sharedWith || [];
          note.sharedWith = note.sharedWith.filter(s => s.email !== email);
          note.sharedWith.push({ email, permission });
          return sendJson(200, { sharedWith: note.sharedWith });
        }
        if (method === 'DELETE') {
          const email = decodeURIComponent(noteShareMatch[2] || '');
          note.sharedWith = (note.sharedWith || []).filter(s => s.email !== email);
          return sendJson(200, { sharedWith: note.sharedWith });
        }
      }

      const noteIdMatch = pathname.match(/^\/api\/notes\/([^/]+)$/);
      if (noteIdMatch) {
        const id = noteIdMatch[1];
        const note = notes.get(id);
        if (!note) return sendJson(404, { error: 'Note not found' });

        if (method === 'GET') return sendJson(200, note);
        if (method === 'PUT') {
          Object.assign(note, body, { updatedAt: new Date().toISOString() });
          return sendJson(200, note);
        }
        if (method === 'DELETE') {
          if (note.author !== currentUser?.id) {
            return sendJson(403, { error: 'Only the author can delete this note' });
          }
          notes.delete(id);
          return sendJson(200, { message: 'Note deleted' });
        }
      }

      // 7. AI Q&A SSE Route (/api/ai/ask)
      if (pathname === '/api/ai/ask' && method === 'POST') {
        if (!currentUser && !authHeader) {
          return sendJson(401, { error: 'Authentication required' });
        }
        const question = body.question;
        if (!question) {
          return sendJson(400, { error: 'Question is required' });
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Emit sources event
        const sampleSources = [
          { id: 'note_1', title: 'Research Overview', snippet: 'MindMesh uses vector embeddings...', score: 0.92 }
        ];
        res.write(`event: sources\ndata: ${JSON.stringify({ sources: sampleSources })}\n\n`);

        // Emit message chunks
        const tokens = ['MindMesh ', 'is ', 'a ', 'semantic ', 'knowledge ', 'system.'];
        for (const token of tokens) {
          res.write(`event: message\ndata: ${JSON.stringify({ text: token })}\n\n`);
        }

        // Emit done event
        res.write(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      }

      // 8. Shares Routes
      if (pathname === '/api/shares/shared-with-me' && method === 'GET') {
        return sendJson(200, { brains: [], notes: [] });
      }

      // 404 fallback
      return sendJson(404, { error: `Cannot ${method} ${pathname}` });
    });

    server.listen(port, () => {
      const allocatedPort = server.address().port;
      const url = `http://127.0.0.1:${allocatedPort}`;
      resolve({
        server,
        port: allocatedPort,
        url,
        stop: () => new Promise((res) => server.close(res))
      });
    });

    server.on('error', reject);
  });
}

/**
 * High-level server orchestrator for tests.
 * Detects if pre-existing server is running, or launches ephemeral server or mock server.
 * @param {object} options
 * @returns {Promise<{ url: string, managed: boolean, stop: () => Promise<void> }>}
 */
async function startServer(options = {}) {
  const targetUrl = options.url || process.env.TEST_API_URL || 'http://localhost:5000';
  const mode = options.mode || 'auto'; // 'auto' | 'live' | 'mock' | 'ephemeral'

  // 1. If mode is explicitly 'mock', spin up mock adapter
  if (mode === 'mock' || options.mockServer) {
    const mock = await createMockServer(options.port || 0);
    return {
      url: mock.url,
      managed: true,
      stop: mock.stop
    };
  }

  // 2. Check if server already running
  if (await isServerHealthy(targetUrl)) {
    return {
      url: targetUrl,
      managed: false,
      stop: async () => {}
    };
  }

  // 3. If mode is 'live' and not running, throw error
  if (mode === 'live') {
    throw new Error(`Target server at ${targetUrl} is not running or not healthy.`);
  }

  // 4. Try starting backend server child process
  try {
    const port = options.port || process.env.TEST_PORT || 5001;
    const projectRoot = path.resolve(__dirname, '../../../');
    const backendDir = path.join(projectRoot, 'backend');

    const env = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'mindmesh-test-secret-key-32-chars-long-e2e',
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mindmesh_test'
    };

    const child = spawn('node', ['src/server.js'], {
      cwd: backendDir,
      env,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const spawnedUrl = `http://127.0.0.1:${port}`;
    const isHealthy = await waitForHealth(spawnedUrl, 4000);

    if (isHealthy) {
      const stop = async () => {
        return new Promise((resolve) => {
          if (child.killed || child.exitCode !== null) return resolve();
          child.on('exit', () => resolve());
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 2000);
        });
      };

      process.on('exit', () => child.kill('SIGKILL'));
      return {
        url: spawnedUrl,
        managed: true,
        process: child,
        stop
      };
    } else {
      child.kill('SIGKILL');
    }
  } catch {
    // Child process spawn failed
  }

  // 5. Fallback: Spin up in-process mock server adapter
  const mock = await createMockServer(options.port || 0);
  return {
    url: mock.url,
    managed: true,
    stop: mock.stop
  };
}

module.exports = {
  isServerHealthy,
  waitForHealth,
  createMockServer,
  startServer
};
