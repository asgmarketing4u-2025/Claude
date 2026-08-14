// Shared passcode check for every protected endpoint (unlock, board-save, and
// any paid tool added in a later session). The passcode lives ONLY in the
// SITE_PASSCODE server env var — it is never present in browser code.
//
// Fails OPEN if SITE_PASSCODE isn't set, so a missing env var never locks the
// owner out. Fails CLOSED (401) if it is set and the header is missing/wrong.

function requireUserMode(req, res) {
  const expected = process.env.SITE_PASSCODE;
  if (!expected) return true; // no passcode configured — nothing to protect yet
  const supplied = req.headers['x-ntm-passcode'];
  if (supplied === expected) return true;
  res.status(401).json({ ok: false, error: 'User Mode required.' });
  return false;
}

module.exports = { requireUserMode };
