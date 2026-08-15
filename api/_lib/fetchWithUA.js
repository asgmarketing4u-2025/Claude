// Shared outbound-fetch helper for every server function that calls a paid
// API. Several providers (BatchData, PACER, GoHighLevel) sit behind
// Cloudflare or similar bot protection that blocks the default Node/Vercel
// script user-agent outright — sending a real browser UA avoids that.

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchWithUA(url, options) {
  options = options || {};
  const headers = Object.assign({ 'User-Agent': BROWSER_USER_AGENT }, options.headers || {});
  return fetch(url, Object.assign({}, options, { headers }));
}

// Reads a fetch Response and, if it wasn't ok, throws an error shaped the
// way js/errors.js's classifyError() expects: { status, body, message }.
// Callers can just `await readJsonOrThrow(res)` and let the catch block
// hand the thrown value straight to classifyError/friendlyError.
async function readJsonOrThrow(res) {
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch (e) { body = text; }
  if (!res.ok) {
    const err = new Error(`Upstream returned ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

module.exports = { fetchWithUA, readJsonOrThrow, BROWSER_USER_AGENT };
