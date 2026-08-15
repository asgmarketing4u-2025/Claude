// AC's voice out — speaks AC's answers aloud via ElevenLabs.
//
// NOT gated behind the User Mode passcode, same reasoning as api/ask.js:
// AC answering (and now speaking) a question is allowed in Demo Mode.
// Returns raw audio/mpeg on success, or a normal JSON error/notConfigured
// body on failure — the client (js/igor-ui.js) checks the response
// content-type and falls back to the browser's built-in speechSynthesis
// if this isn't audio.

const { fetchWithUA } = require('./_lib/fetchWithUA');

// ElevenLabs' public premade "Rachel" voice — swap via ELEVENLABS_VOICE_ID
// env var if you want a different one (Voice Library -> copy Voice ID).
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: false, notConfigured: true, error: 'ELEVENLABS_API_KEY not set' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const text = body && body.text;
  if (!text) {
    res.status(400).json({ ok: false, error: 'text is required' });
    return;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const upstream = await fetchWithUA(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: String(text).slice(0, 2000),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      const err = new Error('ElevenLabs request failed');
      err.status = upstream.status;
      err.body = errText;
      throw err;
    }

    const arrayBuf = await upstream.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(Buffer.from(arrayBuf));
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message, body: err.body });
  }
};
