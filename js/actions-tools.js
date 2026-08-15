/* ============================================================
   NTM DEAL CENTER — Session 3 paid-tool actions
   Client fetch wrappers for skip trace / court / socials / GHL, all
   gated the same way Lab Link is: the User Mode passcode header goes
   on every call via authHeaders() (js/sync.js), and the server rejects
   anything unlocked-only if it's missing.
   ============================================================ */

/* ---------- shared: file a trace/court result to the Pipeline ---------- */

// Reuses seedProperty() (js/data.js) so a filed lead gets every normal
// property field with sane defaults — not just the handful we know from
// a trace — and lands with the owner's contact in the real card fields
// (not buried in notes), so CALL/DRAFT show up immediately.
function fileToPipeline(info, sourceLabel) {
  const snap = snapshotState();
  const p = seedProperty({
    addr: { line1: info.address, city: info.city || 'Baltimore', state: info.state || 'MD', zip: info.zip || '' },
    stage: 'research_lead',
    situation: info.situation || 'standard',
    owner: info.owner || '',
    ownerPhone: info.ownerPhone || '',
    ownerEmail: info.ownerEmail || '',
    notes: `Filed from ${sourceLabel}.`,
  });
  S.properties.push(p);
  mutate(`Filed ${info.address} to the Pipeline as a Research Lead (${sourceLabel}).`, { undoSnapshot: snap, tone: 'ok' });
}

/* ---------- shared: a fetch wrapper for our own protected /api/* tools ---------- */

// Throws an object shaped for js/errors.js's classifyError(): either
// { notConfigured: true } or { status, body }. A rejected fetch (offline,
// DNS, CORS) throws the raw Error straight through unchanged, which
// classifyError() also knows how to read.
async function callToolApi(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (data && data.notConfigured) { const e = new Error('not configured'); e.notConfigured = true; throw e; }
  if (!res.ok || !data || data.ok === false) {
    const e = new Error((data && data.error) || 'Request failed');
    e.status = res.status;
    e.body = data;
    if (data && data.kind) e.kind = data.kind;
    throw e;
  }
  return data;
}

/* ---------- 07 SKIP TRACE ---------- */

function addSkipTraceResult(row) {
  row.id = uid('trace');
  row.ts = Date.now();
  S.skipTraceResults.unshift(row);
}

async function runSkipTraceSingle() {
  const address = (document.getElementById('stAddress').value || '').trim();
  if (!address) { showToast('Enter an address to trace.', { tone: 'danger' }); return; }
  const city = document.getElementById('stCity').value.trim();
  const state = document.getElementById('stState').value.trim();
  const zip = document.getElementById('stZip').value.trim();

  const progress = startProgress('Tracing owner', ['Contacting BatchData', 'Reading results']);
  progress.advance();
  try {
    const data = await callToolApi('/api/skiptrace', { address, city, state, zip });
    progress.advance();
    addSkipTraceResult({ address, city, state, zip, owner: data.owner, ownerPhone: data.ownerPhone, ownerEmail: data.ownerEmail, status: 'found' });
    mutate(`Traced an owner for ${address}.`, { silent: true });
    render();
    showToast('Owner found.', { tone: 'ok' });
  } catch (err) {
    handleSkipTraceError(err, { address, city, state, zip });
  }
}

function handleSkipTraceError(err, info) {
  skipTraceConfigured = err.notConfigured ? false : skipTraceConfigured;
  const kind = err.notConfigured ? 'notConfigured' : classifyError(err);
  if (kind === 'noMatch') {
    addSkipTraceResult(Object.assign({}, info, { status: 'noMatch' }));
    mutate('', { silent: true });
    render();
    showToast('No owner found for that address.', { tone: 'warn' });
    return;
  }
  if (kind !== 'notConfigured') addSkipTraceResult(Object.assign({}, info, { status: 'error' }));
  render();
  showToolError('skiptrace', err);
}

async function runSkipTraceBatch() {
  const input = document.getElementById('stCsvInput');
  const file = input && input.files && input.files[0];
  if (!file) return;
  const text = await file.text();
  const { records } = parseCsvRows(text, {
    address: ['address', 'street', 'streetaddress', 'propertyaddress'],
    city: ['city'],
    state: ['state'],
    zip: ['zip', 'zipcode'],
  }, 'address');

  if (!records.length) { showToast('No usable ADDRESS column found in that CSV.', { tone: 'danger' }); return; }
  const capped = records.slice(0, 100);

  const confirmed = window.confirm(
    `This runs ${capped.length} skip trace lookup${capped.length === 1 ? '' : 's'} against BatchData at your account's per-lookup rate. ` +
    `Continue?`
  );
  if (!confirmed) return;

  let ran = 0, stoppedEarly = false, stopTitle = '';
  for (let i = 0; i < capped.length; i++) {
    const row = capped[i];
    skipTraceBatchStatus = `Running ${i + 1} of ${capped.length}…`;
    render();
    try {
      const data = await callToolApi('/api/skiptrace', row);
      addSkipTraceResult({ address: row.address, city: row.city, state: row.state, zip: row.zip, owner: data.owner, ownerPhone: data.ownerPhone, ownerEmail: data.ownerEmail, status: 'found' });
      ran++;
    } catch (err) {
      const kind = err.notConfigured ? 'notConfigured' : classifyError(err);
      // Every remaining row would fail identically to a credit/key problem —
      // no point burning the rest of the batch (or the user's patience).
      if (kind === 'outOfCredit' || kind === 'keyRejected' || kind === 'notConfigured') {
        stoppedEarly = true;
        stopTitle = friendlyError('skiptrace', err).title;
        if (kind === 'notConfigured') skipTraceConfigured = false;
        break;
      }
      addSkipTraceResult({ address: row.address, city: row.city, state: row.state, zip: row.zip, status: kind === 'noMatch' ? 'noMatch' : 'error' });
      ran++;
    }
    if (i < capped.length - 1) await sleep(350);
  }

  skipTraceBatchStatus = stoppedEarly
    ? `Stopped early after ${ran} of ${capped.length} — ${stopTitle}.`
    : `Done — ran all ${capped.length} rows.`;
  if (input) input.value = '';
  mutate(`Ran a ${capped.length}-row skip trace batch (${ran} completed${stoppedEarly ? ', stopped early' : ''}).`, { tone: stoppedEarly ? 'warn' : 'ok' });
}

function exportSkipTraceCsv() {
  const rows = S.skipTraceResults || [];
  if (!rows.length) return;
  const header = ['Address', 'City', 'State', 'Zip', 'Owner', 'Owner Phone', 'Owner Email', 'Status'];
  const csvLines = [header.join(',')].concat(rows.map(r => [r.address, r.city, r.state, r.zip, r.owner, r.ownerPhone, r.ownerEmail, r.status]
    .map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')));
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skip-trace-results.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Skip trace results exported.', { tone: 'ok' });
}

function pipelineFromSkipTrace(resultId) {
  const r = (S.skipTraceResults || []).find(x => x.id === resultId);
  if (!r) return;
  fileToPipeline(r, 'Skip Trace');
}

/* ---------- 10 COURT RADAR ---------- */

async function checkTheCourt() {
  const progress = startProgress('Checking the court', ['Reading CM/ECF RSS feed', 'Flagging new filings']);
  progress.advance();
  try {
    const data = await callToolApi('/api/court', { mode: 'scan' });
    progress.advance();
    const seen = new Set((S.courtRadar && S.courtRadar.seenIds) || []);
    const filings = (data.filings || []).map(f => Object.assign({}, f, { isNew: !seen.has(f.id) }));
    S.courtRadar = {
      filings,
      seenIds: filings.map(f => f.id),
      lastScanAt: Date.now(),
      pacerConfigured: S.courtRadar ? S.courtRadar.pacerConfigured : undefined,
    };
    mutate(`Checked the court — ${filings.filter(f => f.isNew).length} new filing(s).`, { tone: 'ok' });
  } catch (err) {
    progress.error(friendlyError('court', err).title);
    showToolError('court', err);
  }
}

async function getCourtAddress(filingId) {
  const filing = (S.courtRadar.filings || []).find(f => f.id === filingId);
  if (!filing) return;
  const progress = startProgress('Getting address', ['Logging into PACER', 'Reading docket report']);
  progress.advance();
  try {
    const data = await callToolApi('/api/court', { mode: 'address', caseNumber: filing.caseNumber });
    progress.advance();
    filing.debtorAddress = data.debtorAddress;
    filing.debtorName = data.debtorName || filing.debtorName;
    mutate(`Pulled the docket address for case ${filing.caseNumber}.`, { tone: 'ok' });
  } catch (err) {
    if (err.notConfigured) { S.courtRadar.pacerConfigured = false; }
    progress.error(friendlyError('court', err).title);
    render();
    showToolError('court', err);
  }
}

function pipelineFromCourt(filingId) {
  const filing = (S.courtRadar.filings || []).find(f => f.id === filingId);
  if (!filing || !filing.debtorAddress) return;
  fileToPipeline({ address: filing.debtorAddress, owner: filing.debtorName, situation: 'foreclosure' }, 'Court Radar');
}

/* ---------- FIND SOCIALS (button reused on Skip Trace + Court rows) ---------- */

async function findSocialsFor(el) {
  const source = el.dataset.source;
  let name = '', phone = '', email = '';
  if (source === 'skiptrace') {
    const r = (S.skipTraceResults || []).find(x => x.id === el.dataset.resultId);
    if (!r) return;
    name = r.owner; phone = r.ownerPhone; email = r.ownerEmail;
  } else if (source === 'court') {
    const f = (S.courtRadar.filings || []).find(x => x.id === el.dataset.filingId);
    if (!f) return;
    name = f.debtorName;
  } else if (source === 'cityradar') {
    const n = (S.cityRadar.notices || []).find(x => x.id === el.dataset.noticeId);
    if (!n) return;
    name = n.owner; phone = n.ownerPhone; email = n.ownerEmail;
  }
  if (!name) { showToast('No name on file to search yet.', { tone: 'danger' }); return; }

  const progress = startProgress('Finding socials', ['Searching People Data Labs']);
  try {
    const data = await callToolApi('/api/socials', { name, phone, email });
    progress.advance();
    openSocialsModal(name, data.profiles || []);
  } catch (err) {
    progress.error(friendlyError('socials', err).title);
    showToolError('socials', err);
  }
}

function openSocialsModal(name, profiles) {
  const chips = profiles.length ? profiles.map(p => `
    <a class="social-chip" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
      ${escapeHtml(p.network)} <span class="confidence-tag confidence-tag--${p.confidence}">${escapeHtml(p.confidence)}</span>
    </a>`).join('') : '<p>No profiles found for this person.</p>';

  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>SOCIALS — ${escapeHtml(name)}</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body"><div class="social-chip-row">${chips}</div></div>
        <div class="modal__foot"><button type="button" class="btn btn--ghost" data-action="closeModal">CLOSE</button></div>
      </div>
    </div>`);
}

/* ---------- 08 GHL LINK ---------- */

async function ghlConnect() {
  const progress = startProgress('Connecting to GoHighLevel', ['Listing pipelines', 'Mapping stages']);
  progress.advance();
  try {
    const data = await callToolApi('/api/ghl', { mode: 'connect', boardStages: STAGES });
    progress.advance();
    S.ghl = Object.assign({}, S.ghl, {
      connected: true,
      configured: true,
      locationId: data.locationId,
      pipelineId: data.pipelineId,
      stageMap: data.stageMap || {},
    });
    mutate('Connected to GoHighLevel.', { tone: 'ok' });
  } catch (err) {
    if (err.notConfigured) S.ghl = Object.assign({}, S.ghl, { configured: false });
    progress.error(friendlyError('ghl', err).title);
    render();
    showToolError('ghl', err);
  }
}

async function ghlPull() {
  const progress = startProgress('Pulling from GoHighLevel', ['Fetching opportunities', 'Merging onto board']);
  progress.advance();
  try {
    const data = await callToolApi('/api/ghl', { mode: 'pull', pipelineId: S.ghl.pipelineId, stageMap: S.ghl.stageMap });
    progress.advance();
    let updated = 0, created = 0;
    (data.opportunities || []).forEach(op => {
      const existing = S.properties.find(p => p.ghlId === op.id);
      if (existing) {
        existing.stage = op.boardStage || existing.stage;
        updated++;
      } else {
        S.properties.push(seedProperty({
          addr: { line1: op.address || op.name, city: 'Baltimore', state: 'MD', zip: '' },
          stage: op.boardStage || 'research_lead',
          owner: op.contactName || '',
          ownerPhone: op.contactPhone || '',
          ghlId: op.id,
          notes: 'Pulled from GoHighLevel.',
        }));
        created++;
      }
    });
    S.ghl.lastSyncAt = Date.now();
    mutate(`Pulled from GoHighLevel — ${created} new, ${updated} updated.`, { tone: 'ok' });
  } catch (err) {
    progress.error(friendlyError('ghl', err).title);
    showToolError('ghl', err);
  }
}

async function ghlPush() {
  const newOnes = S.properties.filter(p => !p.ghlId);
  if (newOnes.length && !window.confirm(`${newOnes.length} propert${newOnes.length === 1 ? 'y has' : 'ies have'} never synced to GoHighLevel. Create them there too?`)) {
    return;
  }
  const progress = startProgress('Pushing to GoHighLevel', ['Sending stage changes']);
  progress.advance();
  try {
    const payload = S.properties.map(p => ({ ghlId: p.ghlId || null, address: p.address, stage: p.stage, owner: p.owner, ownerPhone: p.ownerPhone }));
    const data = await callToolApi('/api/ghl', { mode: 'push', pipelineId: S.ghl.pipelineId, stageMap: S.ghl.stageMap, opportunities: payload });
    (data.created || []).forEach(c => {
      const p = S.properties.find(x => x.address === c.address && !x.ghlId);
      if (p) p.ghlId = c.id;
    });
    S.ghl.lastSyncAt = Date.now();
    mutate(`Pushed to GoHighLevel — ${(data.created || []).length} created, ${(data.updated || 0)} updated.`, { tone: 'ok' });
  } catch (err) {
    progress.error(friendlyError('ghl', err).title);
    showToolError('ghl', err);
  }
}

/* ---------- dispatch wiring ---------- */

Object.assign(ACTIONS, {
  runSkipTraceSingle() { runSkipTraceSingle(); },
  runSkipTraceBatch() { runSkipTraceBatch(); },
  exportSkipTraceCsv() { exportSkipTraceCsv(); },
  pipelineFromSkipTrace(el) { pipelineFromSkipTrace(el.dataset.resultId); },

  checkTheCourt() { checkTheCourt(); },
  getCourtAddress(el) { getCourtAddress(el.dataset.filingId); },
  pipelineFromCourt(el) { pipelineFromCourt(el.dataset.filingId); },

  findSocialsFor(el) { findSocialsFor(el); },

  ghlConnect() { ghlConnect(); },
  ghlPull() { ghlPull(); },
  ghlPush() { ghlPush(); },
});
