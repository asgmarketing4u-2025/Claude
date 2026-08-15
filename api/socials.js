// Find Socials — turns a name/phone/email into social profile links via
// People Data Labs' Person Enrichment API. Gated by the Session 2 User
// Mode passcode. Fails gracefully with { notConfigured: true } if
// PDL_API_KEY was never set.

const { requireUserMode } = require('./_lib/auth');
const { fetchWithUA, readJsonOrThrow } = require('./_lib/fetchWithUA');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!requireUserMode(req, res)) return;

  const apiKey = process.env.PDL_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: false, notConfigured: true, error: 'PDL_API_KEY not set' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { name, phone, email } = body || {};
  if (!name && !phone && !email) {
    res.status(400).json({ ok: false, error: 'name, phone, or email is required' });
    return;
  }

  try {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (phone) params.set('phone', phone);
    if (email) params.set('email', email);
    params.set('pretty', 'false');

    const upstream = await fetchWithUA(`https://api.peopledatalabs.com/v5/person/enrich?${params.toString()}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    const data = await readJsonOrThrow(upstream);

    const person = data.data || {};
    const verifiedEmail = person.emails && person.emails.some(e => e.address && email && e.address.toLowerCase() === String(email).toLowerCase());
    const verifiedPhone = person.phone_numbers && person.phone_numbers.some(p => phone && String(p).replace(/\D/g, '') === String(phone).replace(/\D/g, ''));
    const confidence = (verifiedEmail || verifiedPhone) ? 'confident' : 'possible';

    const profiles = [];
    const addProfile = (network, url) => { if (url) profiles.push({ network, url, confidence }); };
    addProfile('Facebook', person.facebook_url);
    addProfile('Instagram', person.instagram_url ? `https://instagram.com/${person.instagram_url}` : (person.profiles || []).find(p => p.network === 'instagram') && (person.profiles.find(p => p.network === 'instagram').url));
    addProfile('LinkedIn', person.linkedin_url);
    addProfile('X', person.twitter_url);
    (person.profiles || []).forEach(p => {
      if (p.network && p.network.toLowerCase().includes('tiktok')) addProfile('TikTok', p.url);
    });

    if (!profiles.length) {
      res.status(200).json({ ok: false, kind: 'noMatch', error: 'No social profiles found' });
      return;
    }

    res.status(200).json({ ok: true, profiles });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message, body: err.body });
  }
};
