/* ============================================================
   NTM DEAL CENTER — Session 3 paid-tool panels (Sheet A 07, 08, 10)
   Skip Trace (07), GHL Link (08), Court Radar (10). City Radar (09)
   lives in js/cityradar.js since it's a whole feature on its own.

   Loads after render.js/render-b.js/render-c.js but BEFORE main.js's
   boot() call — same as those files. render()/renderPanel() only ever
   run from boot() (after every script has already executed and defined
   its top-level functions), so calling renderSkipTracePanel() etc.
   directly from render.js's switch is safe regardless of file order —
   there is no risk of the "calls a function that doesn't exist yet"
   crash, because nothing calls render() until the whole page is loaded.
   ============================================================ */

/* ---------- shared "not configured" banner ---------- */

function toolBannerHTML(tool) {
  const row = errorRow(tool, 'notConfigured');
  return `
    <div class="tool-banner tool-banner--warn">
      <div class="tool-banner__title">${escapeHtml(row.title)}</div>
      <p>${escapeHtml(row.meaning)} ${escapeHtml(row.action)}</p>
    </div>`;
}

/* ---------- 07 SKIP TRACE ---------- */

let skipTraceConfigured = null; // null = unknown yet, true/false once checked
let skipTraceBatchStatus = '';  // transient — survives re-renders during a batch run, not persisted

function renderSkipTracePanel() {
  const results = S.skipTraceResults || [];
  const rows = results.length ? results.map(skipTraceRowHTML).join('') : `
    <tr><td colspan="6" class="data-table__empty">No lookups yet — trace a single address or run a CSV batch above.</td></tr>`;

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-07</div>
      <h2 class="panel__title">Find the owner behind any property — before anyone else does.</h2>
      <p class="panel__pitch">One address or a whole CSV of them — Skip Trace comes back with a name, phone, and email so you can call today instead of mailing and waiting.</p>

      ${skipTraceConfigured === false ? toolBannerHTML('skiptrace') : ''}

      <div class="tool-form-row">
        <label class="field"><span class="field__label">ADDRESS *</span><input type="text" id="stAddress" placeholder="123 Main St"></label>
        <label class="field"><span class="field__label">CITY</span><input type="text" id="stCity" value="Baltimore"></label>
        <label class="field"><span class="field__label">STATE</span><input type="text" id="stState" value="MD"></label>
        <label class="field"><span class="field__label">ZIP</span><input type="text" id="stZip"></label>
        <button type="button" class="btn btn--stamp" data-action="runSkipTraceSingle">TRACE OWNER</button>
      </div>

      <div class="tool-form-row tool-form-row--batch">
        <label class="field field--wide">
          <span class="field__label">BATCH CSV (up to 100 rows, needs an ADDRESS column)</span>
          <input type="file" id="stCsvInput" accept=".csv,text/csv">
        </label>
        <button type="button" class="btn btn--stamp-outline" data-action="runSkipTraceBatch" id="stBatchBtn" disabled>RUN BATCH</button>
      </div>
      ${skipTraceBatchStatus ? `<p class="tool-status">${escapeHtml(skipTraceBatchStatus)}</p>` : ''}

      <div class="panel__row-between">
        <p class="modal__section-label">RESULTS</p>
        <button type="button" class="btn btn--ghost btn--xs" data-action="exportSkipTraceCsv" ${results.length ? '' : 'disabled'}>EXPORT CSV</button>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Address</th><th>Owner</th><th>Phone</th><th>Email</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function skipTraceRowHTML(r) {
  const statusLabel = { found: 'FOUND', noMatch: 'NO MATCH', error: 'ERROR' }[r.status] || r.status.toUpperCase();
  return `
    <tr>
      <td>${escapeHtml(r.address)}</td>
      <td>${maskText(r.owner) || '—'}</td>
      <td>${maskText(r.ownerPhone) || '—'}</td>
      <td>${maskText(r.ownerEmail) || '—'}</td>
      <td><span class="tag tag--${r.status === 'found' ? 'ok' : r.status === 'noMatch' ? 'muted' : 'danger'}">${statusLabel}</span></td>
      <td>${r.status === 'found' ? `<button type="button" class="btn btn--mint-outline btn--xs" data-action="pipelineFromSkipTrace" data-result-id="${r.id}">→ PIPELINE</button>` : ''}</td>
    </tr>`;
}

function afterRenderSkipTrace() {
  const csvInput = document.getElementById('stCsvInput');
  const batchBtn = document.getElementById('stBatchBtn');
  if (csvInput && batchBtn) {
    csvInput.addEventListener('change', () => { batchBtn.disabled = !csvInput.files.length; });
  }
  // Probe configuration status once per page load so the banner shows before
  // the user even tries a lookup — cheap, GET-free check via a HEAD-less POST
  // would spend nothing but still hit the network, so instead we just let the
  // first real action reveal it; the banner only appears after that. This
  // keeps behavior identical to sync.js's OFFLINE pattern: fail silently
  // until actually used, never block the panel from rendering.
}

/* ---------- 10 COURT RADAR ---------- */

function renderCourtRadarPanel() {
  const filings = (S.courtRadar && S.courtRadar.filings) || [];
  const rows = filings.length ? filings.slice().sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)).map(courtFilingRowHTML).join('') : `
    <tr><td colspan="5" class="data-table__empty">No filings scanned yet — click CHECK THE COURT to pull the latest feed.</td></tr>`;
  const lastScan = S.courtRadar && S.courtRadar.lastScanAt ? new Date(S.courtRadar.lastScanAt).toLocaleString() : 'never';

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-10</div>
      <h2 class="panel__title">Owners weeks from foreclosure, straight from the federal docket.</h2>
      <p class="panel__pitch">The free feed flags RELIEF FROM STAY motions — a lender asking a judge for permission to foreclose. That owner is often ready to deal. GET ADDRESS and TRACE OWNER (paid) turn a case number into a phone call.</p>

      ${(S.courtRadar && S.courtRadar.pacerConfigured === false) ? toolBannerHTML('court') : ''}

      <div class="tool-form-row">
        <button type="button" class="btn btn--stamp" data-action="checkTheCourt">CHECK THE COURT</button>
        <span class="tool-status">Last scan: ${escapeHtml(lastScan)}</span>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Filed</th><th>Case</th><th>Type</th><th>Debtor / Address</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function courtFilingRowHTML(f) {
  const addrKnown = !!f.debtorAddress;
  return `
    <tr class="${f.isNew ? 'row--new' : ''}">
      <td>${escapeHtml(f.filedDate || '—')} ${f.isNew ? '<span class="tag tag--new">NEW</span>' : ''}</td>
      <td>${escapeHtml(f.caseNumber || '—')}</td>
      <td>${f.isReliefFromStay ? '<span class="tag tag--danger">RELIEF FROM STAY</span>' : '<span class="tag tag--muted">FILING</span>'}</td>
      <td>${addrKnown ? maskText(f.debtorAddress) : maskText(f.debtorName || 'Debtor on file')}</td>
      <td class="tool-row-actions">
        ${!addrKnown ? `<button type="button" class="btn btn--mint-outline btn--xs" data-action="getCourtAddress" data-filing-id="${f.id}">GET ADDRESS</button>` : ''}
        <button type="button" class="btn btn--mint-outline btn--xs" data-action="findSocialsFor" data-source="court" data-filing-id="${f.id}">FIND SOCIALS</button>
        ${addrKnown ? `<button type="button" class="btn btn--stamp-outline btn--xs" data-action="pipelineFromCourt" data-filing-id="${f.id}">→ PIPELINE</button>` : ''}
      </td>
    </tr>`;
}

/* ---------- 08 GHL LINK ---------- */

function renderGhlPanel() {
  const ghl = S.ghl || {};
  const stageRows = Object.keys(ghl.stageMap || {}).length
    ? Object.entries(ghl.stageMap).map(([board, crm]) => `<tr><td>${escapeHtml(board)}</td><td>${escapeHtml(crm)}</td></tr>`).join('')
    : `<tr><td colspan="2" class="data-table__empty">Connect to see the stage map.</td></tr>`;

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-08</div>
      <h2 class="panel__title">Two-way sync with GoHighLevel — one pipeline, not two.</h2>
      <p class="panel__pitch">CONNECT finds your pipeline and maps its stages to this board. PULL brings the CRM's changes here (CRM wins). PUSH sends this board's stage moves back — new records ask you first.</p>

      ${ghl.configured === false ? toolBannerHTML('ghl') : ''}

      <div class="tool-form-row">
        <button type="button" class="btn btn--stamp" data-action="ghlConnect">${ghl.connected ? 'RECONNECT' : 'CONNECT'}</button>
        <button type="button" class="btn btn--stamp-outline" data-action="ghlPull" ${ghl.connected ? '' : 'disabled'}>PULL FROM CRM</button>
        <button type="button" class="btn btn--stamp-outline" data-action="ghlPush" ${ghl.connected ? '' : 'disabled'}>PUSH TO CRM</button>
        <span class="tool-status">${ghl.connected ? `Connected · last sync ${ghl.lastSyncAt ? new Date(ghl.lastSyncAt).toLocaleString() : 'never'}` : 'Not connected'}</span>
      </div>

      <p class="modal__section-label">STAGE MAP (board → GHL)</p>
      <div class="table-scroll">
        <table class="data-table"><thead><tr><th>Board stage</th><th>GHL stage</th></tr></thead><tbody>${stageRows}</tbody></table>
      </div>
    </section>`;
}
