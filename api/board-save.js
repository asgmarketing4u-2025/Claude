// Lab Link write endpoint. Protected: requires the User Mode passcode header,
// so an anonymous demo visitor can never spam junk boards into storage.
//
// CRITICAL Vercel Blob gotcha: a path's CDN response is cached forever, so we
// NEVER overwrite a path — every save writes a brand-new timestamped path
// (boards/<boardId>/<timestamp>.json). Loaders list the folder and take the
// newest. We keep only the last 4 here so storage doesn't grow unbounded.

const { put, list, del } = require('@vercel/blob');
const { requireUserMode } = require('./_lib/auth');

const KEEP_LAST = 4;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!requireUserMode(req, res)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const boardId = body && body.boardId;
  const state = body && body.state;
  const rev = body && body.rev;
  if (!boardId || !/^[a-f0-9]{64}$/i.test(boardId)) {
    res.status(400).json({ ok: false, error: 'Missing or invalid boardId' });
    return;
  }
  if (!state) {
    res.status(400).json({ ok: false, error: 'Missing state' });
    return;
  }

  try {
    const prefix = `boards/${boardId}/`;
    const ts = Date.now();
    const path = `${prefix}${ts}.json`;

    await put(path, JSON.stringify({ rev: rev || 0, savedAt: ts, state }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    // Prune old snapshots for this board, keeping only the most recent KEEP_LAST.
    const { blobs } = await list({ prefix });
    const sorted = blobs.slice().sort((a, b) => b.pathname.localeCompare(a.pathname));
    const toDelete = sorted.slice(KEEP_LAST).map(b => b.url);
    if (toDelete.length) await del(toDelete);

    res.status(200).json({ ok: true, savedAt: ts });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Save failed' });
  }
};
