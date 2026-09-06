/**
 * tests/e2e/harness/sseReader.js
 * Streaming reader for Server-Sent Events (SSE) (text/event-stream).
 * Designed for /api/ai/ask wire protocol to consume and parse event streams
 * containing `sources`, `message`, `done`, and `error` events.
 */

/**
 * Async generator that connects to an SSE endpoint and yields structured event records.
 * @param {string} url - Full URL or path
 * @param {object} options - Fetch options (method, headers, body)
 * @yields {{ event: string, data: any, raw: string }}
 */
async function* readSseStream(url, options = {}) {
  const headers = {
    Accept: 'text/event-stream',
    ...(options.headers || {})
  };

  let body = options.body;
  if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof Uint8Array)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method: (options.method || 'POST').toUpperCase(),
    headers,
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `SSE request failed with HTTP ${response.status} ${response.statusText}: ${errorText}`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`Expected text/event-stream response, received: ${contentType}`);
  }

  if (!response.body) {
    throw new Error('SSE response body is null or undefined');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // SSE message blocks are separated by double newlines (\n\n or \r\n\r\n)
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;

        let event = 'message';
        let dataStr = '';
        const lines = block.split(/\r?\n/);

        for (const line of lines) {
          if (line.startsWith(':')) {
            // SSE comment line, ignore
            continue;
          }
          if (line.startsWith('event:')) {
            event = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            const dataSegment = line.substring(5).trim();
            dataStr = dataStr ? `${dataStr}\n${dataSegment}` : dataSegment;
          }
        }

        let parsedData = dataStr;
        try {
          parsedData = JSON.parse(dataStr);
        } catch {
          parsedData = dataStr;
        }

        yield { event, data: parsedData, raw: block };
      }
    }

    // Process any remaining buffered block
    if (buffer.trim()) {
      let event = 'message';
      let dataStr = '';
      const lines = buffer.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          event = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          const dataSegment = line.substring(5).trim();
          dataStr = dataStr ? `${dataStr}\n${dataSegment}` : dataSegment;
        }
      }
      let parsedData = dataStr;
      try {
        parsedData = JSON.parse(dataStr);
      } catch {
        parsedData = dataStr;
      }
      yield { event, data: parsedData, raw: buffer };
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Collect and aggregate an entire SSE stream response into structured metrics.
 * @param {string} url - SSE endpoint URL
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in ms
 * @returns {Promise<{
 *   events: Array<{ event: string, data: any }>,
 *   citations: Array<any>,
 *   fullText: string,
 *   isDone: boolean,
 *   error: any
 * }>}
 */
async function collectSseResponse(url, options = {}, timeoutMs = 15000) {
  const events = [];
  const citations = [];
  let fullText = '';
  let isDone = false;
  let error = null;

  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error(`SSE collection timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  const streamPromise = (async () => {
    for await (const msg of readSseStream(url, options)) {
      events.push(msg);

      if (msg.event === 'sources') {
        if (Array.isArray(msg.data?.sources)) {
          citations.push(...msg.data.sources);
        } else if (Array.isArray(msg.data)) {
          citations.push(...msg.data);
        }
      } else if (msg.event === 'message') {
        const chunk =
          typeof msg.data === 'string'
            ? msg.data
            : msg.data?.text || msg.data?.token || '';
        fullText += chunk;
      } else if (msg.event === 'done') {
        isDone = true;
      } else if (msg.event === 'error') {
        error = msg.data?.error || msg.data;
      }
    }
  })();

  try {
    await Promise.race([streamPromise, timeoutPromise]);
  } finally {
    clearTimeout(timerId);
  }

  return {
    events,
    citations,
    fullText,
    isDone,
    error
  };
}

module.exports = {
  readSseStream,
  collectSseResponse
};
