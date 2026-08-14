// Checks a submitted passcode against the server-only SITE_PASSCODE env var.
// The passcode itself never ships in browser code — this endpoint is the only
// place it's compared. If SITE_PASSCODE isn't set at all, unlock always
// succeeds (so a missing env var never locks the owner out of their own site).

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  const expected = process.env.SITE_PASSCODE;
  if (!expected) {
    res.status(200).json({ ok: true, note: 'no passcode configured' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const supplied = body && body.passcode;
  if (supplied && supplied === expected) {
    res.status(200).json({ ok: true });
    return;
  }
  res.status(401).json({ ok: false });
};
