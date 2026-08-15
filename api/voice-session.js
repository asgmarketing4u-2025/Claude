// AC's LIVE line — mints a short-lived OpenAI Realtime API session key so
// the browser can open a hands-free WebRTC voice call directly with
// OpenAI (the ephemeral key is safe to hand to the browser; the real
// OPENAI_API_KEY never leaves this server).
//
// Gated by the Session 2 User Mode passcode: unlike a single typed/spoken
// question, a LIVE call is an extended, higher-cost session, and the
// client already blocks starting one in Demo Mode before it ever reaches
// here — this is defense in depth, not the primary gate.

const { requireUserMode } = require('./_lib/auth');
const { fetchWithUA, readJsonOrThrow } = require('./_lib/fetchWithUA');

const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!requireUserMode(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: false, notConfigured: true, error: 'OPENAI_API_KEY not set' });
    return;
  }

  try {
    const upstream = await fetchWithUA('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: REALTIME_MODEL, voice: 'alloy' }),
    });
    const data = await readJsonOrThrow(upstream);
    res.status(200).json({ ok: true, session: data, model: REALTIME_MODEL });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message, body: err.body });
  }
};
