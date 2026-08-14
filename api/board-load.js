// Lab Link read endpoint. Reads stay open — the only thing needed to fetch a
// board is its 64-hex boardId (the SHA-256 hash of the Lab Key), and that
// hash IS the secret. Lists the board's folder and returns the newest save.

const { list } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  const boardId = req.query && req.query.boardId;
  if (!boardId || !/^[a-f0-9]{64}$/i.test(String(boardId))) {
    res.status(400).json({ ok: false, error: 'Missing or invalid boardId' });
    return;
  }

  try {
    const prefix = `boards/${boardId}/`;
    const { blobs } = await list({ prefix });
    if (!blobs.length) {
      res.status(200).json({ ok: true, found: false });
      return;
    }
    const newest = blobs.slice().sort((a, b) => b.pathname.localeCompare(a.pathname))[0];
    const fetched = await fetch(newest.url);
    if (!fetched.ok) {
      res.status(200).json({ ok: true, found: false });
      return;
    }
    const payload = await fetched.json();
    res.status(200).json({ ok: true, found: true, rev: payload.rev, savedAt: payload.savedAt, state: payload.state });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Load failed' });
  }
};
