/**
 * tests/e2e/harness/httpClient.js
 * Opaque HTTP Client wrapping Node.js 22 native globalThis.fetch.
 * Supports GET, POST, PUT, DELETE, PATCH, Bearer token injection, automatic JSON
 * serialization and parsing, status inspection, and non-throwing error handling.
 */

class HttpClient {
  /**
   * @param {string} baseUrl - Base URL (default: 'http://localhost:5000')
   * @param {Record<string, string>} defaultHeaders - Default request headers
   */
  constructor(baseUrl = 'http://localhost:5000', defaultHeaders = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultHeaders = {
      Accept: 'application/json',
      ...defaultHeaders
    };
  }

  /**
   * Return a new HttpClient clone configured with Authorization Bearer header.
   * @param {string} token - JWT bearer token
   * @returns {HttpClient}
   */
  withToken(token) {
    return new HttpClient(this.baseUrl, {
      ...this.defaultHeaders,
      Authorization: `Bearer ${token}`
    });
  }

  /**
   * Return a new HttpClient clone with additional headers.
   * @param {Record<string, string>} headers
   * @returns {HttpClient}
   */
  withHeaders(headers) {
    return new HttpClient(this.baseUrl, {
      ...this.defaultHeaders,
      ...headers
    });
  }

  /**
   * Dispatch an HTTP request and return parsed response object without throwing on 4xx/5xx.
   * @param {string} path - URL path or absolute URL
   * @param {object} options - Fetch options including method, headers, body, query/params, timeout
   */
  async request(path, options = {}) {
    let url = path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    // Handle query parameters if provided
    const queryParams = options.params || options.query;
    if (queryParams && typeof queryParams === 'object') {
      const urlObj = new URL(url);
      for (const [k, v] of Object.entries(queryParams)) {
        if (v !== undefined && v !== null) {
          urlObj.searchParams.set(k, String(v));
        }
      }
      url = urlObj.toString();
    }

    const headers = {
      ...this.defaultHeaders,
      ...(options.headers || {})
    };

    let body = options.body;
    if (
      body !== undefined &&
      body !== null &&
      typeof body === 'object' &&
      !(body instanceof Uint8Array) &&
      typeof FormData !== 'undefined' &&
      !(body instanceof FormData)
    ) {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      body = JSON.stringify(body);
    } else if (
      body !== undefined &&
      body !== null &&
      typeof body === 'object' &&
      !(body instanceof Uint8Array)
    ) {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = options.timeout || 15000;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: (options.method || 'GET').toUpperCase(),
        headers,
        body,
        signal: controller.signal
      });

      const rawText = await response.text();
      let data = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = rawText;
        }
      }

      const responseHeaders = {};
      for (const [key, value] of response.headers.entries()) {
        responseHeaders[key.toLowerCase()] = value;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: responseHeaders,
        data,
        rawText
      };
    } finally {
      clearTimeout(timer);
    }
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, { ...options, method: 'POST', body });
  }

  put(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PUT', body });
  }

  delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }

  patch(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PATCH', body });
  }
}

module.exports = { HttpClient };
