// GHL Link — two-way sync with GoHighLevel CRM.
//
// Auth gotcha (per GoHighLevel's own docs): use a PRIVATE INTEGRATION TOKEN
// (GHL → Settings → Private Integrations, with contacts + opportunities
// read/write) sent as `Authorization: Bearer pit-...` — NOT OAuth — plus a
// `Version: 2021-07-28` header on every call. Gated by the Session 2 User
// Mode passcode. Fails gracefully with { notConfigured: true } if GHL_PIT /
// GHL_LOCATION_ID were never set.
//
// Note: GoHighLevel's opportunity search index lags a few seconds behind a
// write, so a PUSH immediately followed by a PULL can miss what was just
// written — that's expected, not a bug here.

const { requireUserMode } = require('./_lib/auth');
const { fetchWithUA, readJsonOrThrow } = require('./_lib/fetchWithUA');

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

function ghlHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Version': GHL_VERSION,
    'Content-Type': 'application/json',
  };
}

function normalizeForMatch(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Picks the pipeline whose stage names best overlap the board's stage
// labels, then maps each board stage to its closest-named GHL stage.
function autoMapPipeline(pipelines, boardStages) {
  let best = null, bestScore = -1;
  pipelines.forEach(p => {
    const stages = p.stages || [];
    let score = 0;
    boardStages.forEach(bs => {
      const bsNorm = normalizeForMatch(bs.label);
      if (stages.some(s => normalizeForMatch(s.name).includes(bsNorm) || bsNorm.includes(normalizeForMatch(s.name)))) score++;
    });
    if (score > bestScore) { bestScore = score; best = p; }
  });
  if (!best && pipelines.length) best = pipelines[0];
  if (!best) return { pipeline: null, stageMap: {} };

  const stageMap = {};
  boardStages.forEach(bs => {
    const bsNorm = normalizeForMatch(bs.label);
    const match = (best.stages || []).find(s => normalizeForMatch(s.name).includes(bsNorm) || bsNorm.includes(normalizeForMatch(s.name)));
    if (match) stageMap[bs.key] = match.id;
  });
  return { pipeline: best, stageMap };
}

async function handleConnect(req, res, token, locationId, boardStages) {
  const upstream = await fetchWithUA(`${GHL_API_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`, {
    headers: ghlHeaders(token),
  });
  const data = await readJsonOrThrow(upstream);
  const pipelines = data.pipelines || [];
  if (!pipelines.length) {
    res.status(200).json({ ok: false, kind: 'noMatch', error: 'No pipelines found on this GHL location' });
    return;
  }
  const { pipeline, stageMap } = autoMapPipeline(pipelines, boardStages || []);
  res.status(200).json({
    ok: true,
    locationId,
    pipelineId: pipeline ? pipeline.id : null,
    stageMap,
    stageMapNames: Object.fromEntries(Object.entries(stageMap).map(([k, ghlId]) => [k, (pipeline.stages.find(s => s.id === ghlId) || {}).name || ghlId])),
  });
}

async function handlePull(req, res, token, locationId, pipelineId, stageMap) {
  const reverseMap = Object.fromEntries(Object.entries(stageMap || {}).map(([k, v]) => [v, k]));
  const upstream = await fetchWithUA(`${GHL_API_BASE}/opportunities/search?location_id=${encodeURIComponent(locationId)}&pipeline_id=${encodeURIComponent(pipelineId)}`, {
    headers: ghlHeaders(token),
  });
  const data = await readJsonOrThrow(upstream);
  const opportunities = (data.opportunities || []).map(op => ({
    id: op.id,
    name: op.name,
    address: op.name,
    boardStage: reverseMap[op.pipelineStageId] || null,
    contactName: op.contact && op.contact.name,
    contactPhone: op.contact && op.contact.phone,
  }));
  res.status(200).json({ ok: true, opportunities });
}

async function handlePush(req, res, token, locationId, pipelineId, stageMap, opportunities) {
  const created = [];
  let updated = 0;
  for (const op of (opportunities || [])) {
    const ghlStageId = stageMap && stageMap[op.stage];
    if (op.ghlId) {
      if (!ghlStageId) continue;
      const upd = await fetchWithUA(`${GHL_API_BASE}/opportunities/${encodeURIComponent(op.ghlId)}`, {
        method: 'PUT',
        headers: ghlHeaders(token),
        body: JSON.stringify({ pipelineStageId: ghlStageId }),
      });
      if (upd.ok) updated++;
    } else {
      const cre = await fetchWithUA(`${GHL_API_BASE}/opportunities/`, {
        method: 'POST',
        headers: ghlHeaders(token),
        body: JSON.stringify({
          locationId,
          pipelineId,
          pipelineStageId: ghlStageId,
          name: op.address,
          contact: { name: op.owner, phone: op.ownerPhone },
        }),
      });
      if (cre.ok) {
        const body = await cre.json().catch(() => ({}));
        created.push({ address: op.address, id: body.id || (body.opportunity && body.opportunity.id) });
      }
    }
  }
  res.status(200).json({ ok: true, created, updated });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!requireUserMode(req, res)) return;

  const token = process.env.GHL_PIT;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    res.status(200).json({ ok: false, notConfigured: true, error: 'GHL_PIT / GHL_LOCATION_ID not set' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const mode = (body && body.mode) || 'connect';

  try {
    if (mode === 'connect') { await handleConnect(req, res, token, locationId, body.boardStages); return; }
    if (mode === 'pull') { await handlePull(req, res, token, locationId, body.pipelineId, body.stageMap); return; }
    if (mode === 'push') { await handlePush(req, res, token, locationId, body.pipelineId, body.stageMap, body.opportunities); return; }
    res.status(400).json({ ok: false, error: 'Unknown mode' });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message, body: err.body });
  }
};
