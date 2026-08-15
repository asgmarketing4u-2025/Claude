// Skip Trace — looks up a property owner's name/phone/email via BatchData.
// One address per call; the browser drives the CSV batch loop itself (with
// a delay between calls) so it can inspect each response and stop early.
//
// Protected by the Session 2 User Mode passcode gate — a demo visitor can
// never spend real skip-trace credit. Fails gracefully with
// { notConfigured: true } if BATCHDATA_API_KEY was never set, so the panel
// shows a friendly message instead of crashing.

const { requireUserMode } = require('./_lib/auth');
const { fetchWithUA, readJsonOrThrow } = require('./_lib/fetchWithUA');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!requireUserMode(req, res)) return;

  const apiKey = process.env.BATCHDATA_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: false, notConfigured: true, error: 'BATCHDATA_API_KEY not set' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const address = body && body.address;
  if (!address) {
    res.status(400).json({ ok: false, error: 'address is required' });
    return;
  }
  const city = (body && body.city) || '';
  const state = (body && body.state) || '';
  const zip = (body && body.zip) || '';

  try {
    const upstream = await fetchWithUA('https://api.batchdata.com/api/v3/property/skip-trace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ propertyAddress: { street: address, city, state, zip } }],
      }),
    });
    const data = await readJsonOrThrow(upstream);

    // NOTE: BatchData's exact response shape can vary by plan/endpoint version —
    // this reads the common "results.persons[0]" skip-trace shape. If your
    // account returns a different structure, adjust this block to match.
    const result = (data.results && Array.isArray(data.results) && data.results[0]) || data.results || {};
    const person = (result.persons && result.persons[0]) || result.person || {};
    const phoneEntry = (person.phoneNumbers && person.phoneNumbers[0]) || {};
    const emailEntry = (person.emails && person.emails[0]) || {};
    const owner = person.name && (person.name.full || [person.name.first, person.name.last].filter(Boolean).join(' ').trim()) || '';
    const ownerPhone = phoneEntry.number || phoneEntry.phoneNumber || '';
    const ownerEmail = emailEntry.email || emailEntry.address || '';

    if (!owner && !ownerPhone && !ownerEmail) {
      res.status(200).json({ ok: false, kind: 'noMatch', error: 'No owner found for this address' });
      return;
    }

    res.status(200).json({ ok: true, owner, ownerPhone, ownerEmail });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message, body: err.body });
  }
};
