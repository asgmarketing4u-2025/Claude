/* ============================================================
   NTM DEAL CENTER — 09 CITY RADAR (Sheet A tab 09)
   Free distressed-property leads straight from Baltimore's public
   ArcGIS server — no API key, no server function, fetched directly
   from the browser (the city's FeatureServer allows cross-origin
   requests). Self-contained: renderer + actions in one file, same as
   render-tools.js/actions-tools.js are for the paid tools.

   Built for Baltimore. If you invest somewhere else, swap the three
   URL constants below for your city/county's open-data ArcGIS server —
   the query/parsing logic is generic and doesn't assume Baltimore's
   field names (see detectField()), only that layer 1 is a point layer
   of vacant/distressed notices and layer 3 is building permits.
   ============================================================ */

const CITY_RADAR_BASE = 'https://egisdata.baltimorecity.gov/egis/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer';
const CITY_RADAR_VACANT_LAYER = 1;   // Vacant Building Notices
const CITY_RADAR_PERMIT_LAYER = 3;   // Building Permits
const CITY_RADAR_ZIP_URL = 'https://gisdata.baltimorecity.gov/egis/rest/services/CAD911/zipcode/FeatureServer/0';

/* ---------- generic ArcGIS helpers (no Baltimore-specific field names) ---------- */

async function arcgisFetch(layerUrl, params) {
  const qs = new URLSearchParams(Object.assign({ f: 'json', outFields: '*', outSR: '4326' }, params));
  const res = await fetch(`${layerUrl}/query?${qs.toString()}`);
  if (!res.ok) { const e = new Error('ArcGIS request failed'); e.status = res.status; throw e; }
  const data = await res.json();
  if (data.error) { const e = new Error(data.error.message || 'ArcGIS layer error'); e.status = 500; throw e; }
  return data.features || [];
}

// The user's own warning, encoded: ArcGIS layers advertise fields they
// don't actually hold data for. Pull one row first and detect real field
// names from what actually comes back, instead of hardcoding guesses.
async function arcgisProbe(layerUrl) {
  const features = await arcgisFetch(layerUrl, { resultRecordCount: 1 });
  return features[0] ? features[0].attributes : null;
}

function detectField(sampleAttrs, candidates) {
  if (!sampleAttrs) return null;
  const keys = Object.keys(sampleAttrs);
  const normKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const cand of candidates) {
    let idx = normKeys.indexOf(cand);
    if (idx === -1) idx = normKeys.findIndex(k => k.includes(cand));
    if (idx !== -1) return keys[idx];
  }
  return null;
}

/* ---------- ZIP assignment via point-in-polygon ---------- */

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function assignZip(x, y, zipShapes) {
  if (x == null || y == null || !zipShapes || !zipShapes.length) return null;
  for (const shape of zipShapes) {
    for (const ring of shape.rings) {
      if (pointInRing(x, y, ring)) return shape.zip;
    }
  }
  return null;
}

async function getZipShapes() {
  if (S.cityRadar.zipShapes && S.cityRadar.zipShapes.length) return S.cityRadar.zipShapes;
  const features = await arcgisFetch(CITY_RADAR_ZIP_URL, { resultRecordCount: 2000 });
  const sample = features[0] ? features[0].attributes : null;
  const zipField = detectField(sample, ['zipcode', 'zip_code', 'zip']);
  return features
    .map(f => ({ zip: zipField ? String(f.attributes[zipField] || '').trim() : '', rings: (f.geometry && f.geometry.rings) || [] }))
    .filter(s => s.zip && s.rings.length);
}

/* ---------- normalizing raw features into what the UI needs ---------- */

function normalizeVacantFeature(f, addrField) {
  const attrs = f.attributes || {};
  const geom = f.geometry || {};
  const idSeed = attrs.OBJECTID != null ? attrs.OBJECTID : (attrs.FID != null ? attrs.FID : `${geom.x}_${geom.y}`);
  return {
    id: 'vbn_' + idSeed,
    address: addrField ? String(attrs[addrField] || '').trim() : '',
    x: geom.x, y: geom.y,
    zip: null,
  };
}

function normalizePermitFeature(f, addrField, valueField, dateField) {
  const attrs = f.attributes || {};
  const geom = f.geometry || {};
  const idSeed = attrs.OBJECTID != null ? attrs.OBJECTID : (attrs.FID != null ? attrs.FID : `${geom.x}_${geom.y}`);
  return {
    id: 'permit_' + idSeed,
    address: addrField ? String(attrs[addrField] || '').trim() : '',
    value: valueField ? (Number(attrs[valueField]) || 0) : 0,
    date: dateField && attrs[dateField] ? new Date(attrs[dateField]).toISOString().slice(0, 10) : null,
    x: geom.x, y: geom.y,
    zip: null,
  };
}

/* ---------- SCAN THE CITY ---------- */

async function scanTheCity() {
  const progress = startProgress('Scanning the city', ['Vacant Building Notices', 'Building Permits', 'Assigning ZIPs', 'Comparing to last scan']);
  try {
    const vacantLayerUrl = `${CITY_RADAR_BASE}/${CITY_RADAR_VACANT_LAYER}`;
    const permitLayerUrl = `${CITY_RADAR_BASE}/${CITY_RADAR_PERMIT_LAYER}`;

    const vacantSample = await arcgisProbe(vacantLayerUrl);
    if (!vacantSample) throw new Error('Vacant Building Notices layer returned no test row — it may be empty or the layer number has changed.');
    const vacantAddrField = detectField(vacantSample, ['fulladdress', 'address', 'propaddress', 'siteaddress', 'location']);
    const vacantDateField = detectField(vacantSample, ['noticedate', 'issuedate', 'filedate', 'createdate', 'date']);

    const vacantFeatures = await arcgisFetch(vacantLayerUrl, {
      resultRecordCount: 600,
      orderByFields: vacantDateField ? `${vacantDateField} DESC` : undefined,
    });
    progress.advance();

    let permits = [];
    const permitSample = await arcgisProbe(permitLayerUrl).catch(() => null);
    if (permitSample) {
      const permitAddrField = detectField(permitSample, ['fulladdress', 'address', 'propaddress', 'siteaddress', 'location']);
      const valueField = detectField(permitSample, ['estimatedcost', 'declaredvaluation', 'permitvalue', 'totalvalue', 'value', 'cost']);
      const permitDateField = detectField(permitSample, ['issuedate', 'permitissuedate', 'createdate', 'date']);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const whereParts = [];
      if (permitDateField) whereParts.push(`${permitDateField} >= DATE '${oneYearAgo.toISOString().slice(0, 10)}'`);
      if (valueField) whereParts.push(`${valueField} >= 20000`);

      const permitFeatures = await arcgisFetch(permitLayerUrl, {
        where: whereParts.length ? whereParts.join(' AND ') : '1=1',
        resultRecordCount: 1000,
      });
      permits = permitFeatures.map(f => normalizePermitFeature(f, permitAddrField, valueField, permitDateField));
    }
    progress.advance();

    const zipShapes = await getZipShapes().catch(() => []);
    const notices = vacantFeatures
      .map(f => normalizeVacantFeature(f, vacantAddrField))
      .map(n => Object.assign(n, { zip: assignZip(n.x, n.y, zipShapes) }));
    permits.forEach(p => { p.zip = assignZip(p.x, p.y, zipShapes); });
    progress.advance();

    const seen = new Set(S.cityRadar.seenNoticeIds || []);
    notices.forEach(n => { n.isNew = !seen.has(n.id); });
    const newCount = notices.filter(n => n.isNew).length;

    S.cityRadar = {
      notices,
      permits,
      seenNoticeIds: notices.map(n => n.id),
      zipShapes,
      lastScanAt: Date.now(),
      lastScanSummary: { scannedAt: Date.now(), newVacants: newCount, totalVacants: notices.length, permitCount: permits.length },
    };
    progress.done();
    mutate(`Scanned the city — ${newCount} new vacant notice(s), ${permits.length} recent permits over $20k.`, { tone: 'ok' });
  } catch (err) {
    progress.error(friendlyError('cityradar', err).title);
    showToolError('cityradar', err);
  }
}

/* ---------- filtering ---------- */

function filteredCityRadarNotices() {
  const q = (S.filters.cityRadarQuery || '').trim().toLowerCase();
  const zipFilter = S.filters.cityRadarZip || '';
  let list = (S.cityRadar.notices || []);
  if (zipFilter) list = list.filter(n => n.zip === zipFilter);
  if (q) list = list.filter(n => n.address.toLowerCase().includes(q) || (n.zip || '').includes(q));
  return list;
}

/* ---------- PERMIT INTELLIGENCE ---------- */

function permitZipRanking() {
  const counts = {};
  (S.cityRadar.permits || []).forEach(p => {
    if (!p.zip) return;
    counts[p.zip] = (counts[p.zip] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/* ---------- SVG DISTRESS RADAR MAP (no map library) ---------- */

function projectLonLat(lon, lat, bounds, w, h) {
  const x = ((lon - bounds.minX) / (bounds.maxX - bounds.minX)) * w;
  const y = h - ((lat - bounds.minY) / (bounds.maxY - bounds.minY)) * h; // flip: lat increases upward, SVG y downward
  return [x, y];
}

function computeBounds(zipShapes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  zipShapes.forEach(s => s.rings.forEach(ring => ring.forEach(([x, y]) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  })));
  if (!isFinite(minX)) return { minX: -76.71, minY: 39.20, maxX: -76.53, maxY: 39.37 }; // Baltimore fallback bbox
  return { minX, minY, maxX, maxY };
}

function cityRadarMapSVG() {
  const zipShapes = S.cityRadar.zipShapes || [];
  const notices = S.cityRadar.notices || [];
  const permits = S.cityRadar.permits || [];
  if (!zipShapes.length) {
    return `<div class="empty-state"><div class="empty-state__headline">No map yet</div><p class="empty-state__pitch">Run SCAN THE CITY to load ZIP shapes and plot notices.</p></div>`;
  }
  const W = 760, H = 520;
  const bounds = computeBounds(zipShapes);

  const vacantCountByZip = {};
  notices.forEach(n => { if (n.zip) vacantCountByZip[n.zip] = (vacantCountByZip[n.zip] || 0) + 1; });
  const permitDollarsByZip = {};
  permits.forEach(p => { if (p.zip) permitDollarsByZip[p.zip] = (permitDollarsByZip[p.zip] || 0) + p.value; });
  const maxVacant = Math.max(1, ...Object.values(vacantCountByZip));

  const activeZip = S.filters.cityRadarZip || '';

  const zipPaths = zipShapes.map(shape => {
    const d = shape.rings.map(ring => 'M' + ring.map(([lon, lat]) => projectLonLat(lon, lat, bounds, W, H).join(',')).join('L') + 'Z').join(' ');
    const intensity = (vacantCountByZip[shape.zip] || 0) / maxVacant;
    const fillOpacity = 0.08 + intensity * 0.45;
    const isActive = activeZip === shape.zip;
    return `<path d="${d}" class="radar-zip ${isActive ? 'radar-zip--active' : ''}" fill="var(--orange)" fill-opacity="${fillOpacity.toFixed(2)}" stroke="var(--line)" stroke-width="${isActive ? 2 : 1}" data-action="cityRadarZipClick" data-zip="${escapeHtml(shape.zip)}"><title>ZIP ${escapeHtml(shape.zip)} — ${vacantCountByZip[shape.zip] || 0} vacant, ${fmtMoney(permitDollarsByZip[shape.zip] || 0)} in permits</title></path>`;
  }).join('');

  const noticeDots = notices.filter(n => n.x != null && n.y != null).slice(0, 600).map(n => {
    const [x, y] = projectLonLat(n.x, n.y, bounds, W, H);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="radar-dot radar-dot--notice ${n.isNew ? 'radar-dot--new' : ''}" data-action="cityRadarDotClick" data-notice-id="${n.id}"><title>${escapeHtml(n.address || 'Vacant notice')}</title></circle>`;
  }).join('');

  const permitDots = permits.filter(p => p.x != null && p.y != null).slice(0, 600).map(p => {
    const [x, y] = projectLonLat(p.x, p.y, bounds, W, H);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" class="radar-dot radar-dot--permit" data-action="cityRadarDotClick" data-permit-id="${p.id}"><title>${escapeHtml(p.address || 'Permit')} — ${fmtMoney(p.value)}</title></circle>`;
  }).join('');

  return `
    <svg class="radar-map" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distress radar map of Baltimore ZIP codes">
      <g>${zipPaths}</g>
      <g>${permitDots}</g>
      <g>${noticeDots}</g>
    </svg>
    <div class="radar-legend">
      <span><i class="radar-legend__dot radar-legend__dot--notice"></i> Vacant notice (pulsing = new)</span>
      <span><i class="radar-legend__dot radar-legend__dot--permit"></i> $20k+ permit</span>
      <span><i class="radar-legend__swatch"></i> Darker ZIP = more vacants</span>
    </div>`;
}

/* ---------- panel ---------- */

function jumpChipsHTML() {
  const targets = [
    { id: 'cityRadarScanSection', label: 'SCAN' },
    { id: 'cityRadarMapSection', label: 'MAP' },
    { id: 'cityRadarNoticesSection', label: 'NOTICES' },
    { id: 'cityRadarPermitsSection', label: 'PERMIT INTEL' },
  ];
  return `<div class="jump-chips">${targets.map(t => `<button type="button" class="chip" data-action="scrollToSection" data-target="${t.id}">${t.label}</button>`).join('')}</div>`;
}

function renderCityRadarPanel() {
  const summary = S.cityRadar.lastScanSummary;
  const notices = filteredCityRadarNotices();
  const noticeRows = notices.length ? notices.slice(0, 200).map(cityRadarNoticeRowHTML).join('') : `
    <tr><td colspan="5" class="data-table__empty">No notices yet — click SCAN THE CITY.</td></tr>`;
  const ranking = permitZipRanking();
  const rankingRows = ranking.length ? ranking.slice(0, 15).map(([zip, count]) => `
    <tr><td>${escapeHtml(zip)}</td><td>${count}</td></tr>`).join('') : `<tr><td colspan="2" class="data-table__empty">No permits scanned yet.</td></tr>`;

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-09</div>
      <h2 class="panel__title">Free distressed-property leads, straight from the city's own records.</h2>
      <p class="panel__pitch">No key, no cost. SCAN pulls the newest vacant building notices and a year of big renovation permits, badges anything new since your last look, and maps every one of them.</p>
      ${jumpChipsHTML()}

      <section id="cityRadarScanSection">
        <div class="tool-form-row">
          <button type="button" class="btn btn--stamp" data-action="scanTheCity">SCAN THE CITY</button>
          <input type="text" id="cityRadarFilterInput" placeholder="Filter by street, neighborhood, or ZIP" value="${escapeHtml(S.filters.cityRadarQuery || '')}">
          <span class="tool-status">${summary ? `Last scan: ${new Date(summary.scannedAt).toLocaleString()} — ${summary.newVacants} new of ${summary.totalVacants}` : 'No scan yet'}</span>
        </div>
      </section>

      <section id="cityRadarMapSection">
        <p class="modal__section-label">DISTRESS RADAR MAP ${S.filters.cityRadarZip ? `— ZIP ${escapeHtml(S.filters.cityRadarZip)} <button type="button" class="btn btn--ghost btn--xs" data-action="cityRadarClearZip">CLEAR</button>` : ''}</p>
        <div class="radar-map-wrap">${cityRadarMapSVG()}</div>
      </section>

      <section id="cityRadarNoticesSection">
        <p class="modal__section-label">VACANT BUILDING NOTICES</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Address</th><th>ZIP</th><th></th><th></th><th></th></tr></thead>
            <tbody>${noticeRows}</tbody>
          </table>
        </div>
      </section>

      <section id="cityRadarPermitsSection">
        <p class="modal__section-label">PERMIT INTELLIGENCE — ZIPs ranked by permit COUNT (not dollars, so one huge permit can't skew it)</p>
        <div class="table-scroll">
          <table class="data-table"><thead><tr><th>ZIP</th><th>$20k+ permits (last 12mo)</th></tr></thead><tbody>${rankingRows}</tbody></table>
        </div>
        <div class="tool-form-row">
          <input type="text" id="cityRadarPermitSearch" placeholder="Search permits by address (verify a comp)">
          <button type="button" class="btn btn--stamp-outline" data-action="cityRadarPermitSearch">SEARCH</button>
        </div>
        <div id="cityRadarPermitSearchResults"></div>
      </section>
    </section>`;
}

function cityRadarNoticeRowHTML(n) {
  return `
    <tr class="${n.isNew ? 'row--new' : ''}">
      <td>${escapeHtml(n.address || 'Address unknown')} ${n.isNew ? '<span class="tag tag--new">NEW</span>' : ''}</td>
      <td>${escapeHtml(n.zip || '—')}</td>
      <td><button type="button" class="btn btn--mint-outline btn--xs" data-action="cityRadarTraceOwner" data-notice-id="${n.id}">TRACE OWNER</button></td>
      <td><button type="button" class="btn btn--mint-outline btn--xs" data-action="findSocialsFor" data-source="cityradar" data-notice-id="${n.id}">FIND SOCIALS</button></td>
      <td>${n.owner ? `<button type="button" class="btn btn--stamp-outline btn--xs" data-action="pipelineFromCityRadar" data-notice-id="${n.id}">→ PIPELINE</button>` : ''}</td>
    </tr>`;
}

function afterRenderCityRadar() {
  const input = document.getElementById('cityRadarFilterInput');
  if (input) {
    input.addEventListener('input', debounce(() => {
      S.filters.cityRadarQuery = input.value;
      persistView();
    }, 250));
  }
}

/* ---------- actions ---------- */

async function cityRadarTraceOwner(noticeId) {
  const n = (S.cityRadar.notices || []).find(x => x.id === noticeId);
  if (!n || !n.address) return;
  const progress = startProgress('Tracing owner', ['Contacting BatchData']);
  try {
    const data = await callToolApi('/api/skiptrace', { address: n.address, zip: n.zip });
    progress.advance();
    n.owner = data.owner; n.ownerPhone = data.ownerPhone; n.ownerEmail = data.ownerEmail;
    addSkipTraceResult({ address: n.address, zip: n.zip, owner: data.owner, ownerPhone: data.ownerPhone, ownerEmail: data.ownerEmail, status: 'found' });
    mutate(`Traced the owner for ${n.address}.`, { tone: 'ok' });
  } catch (err) {
    if (err.notConfigured) skipTraceConfigured = false;
    progress.error(friendlyError('skiptrace', err).title);
    render();
    showToolError('skiptrace', err);
  }
}

function pipelineFromCityRadar(noticeId) {
  const n = (S.cityRadar.notices || []).find(x => x.id === noticeId);
  if (!n || !n.owner) return;
  fileToPipeline({ address: n.address, zip: n.zip, owner: n.owner, ownerPhone: n.ownerPhone, ownerEmail: n.ownerEmail, situation: 'vacant' }, 'City Radar');
}

function cityRadarPermitSearchRun() {
  const q = (document.getElementById('cityRadarPermitSearch').value || '').trim().toLowerCase();
  const root = document.getElementById('cityRadarPermitSearchResults');
  if (!root) return;
  if (!q) { root.innerHTML = ''; return; }
  const matches = (S.cityRadar.permits || []).filter(p => p.address.toLowerCase().includes(q));
  root.innerHTML = matches.length
    ? `<ul class="permit-search-list">${matches.map(p => `<li>${escapeHtml(p.address)} — ${fmtMoney(p.value)}${p.date ? ' — ' + escapeHtml(p.date) : ''}</li>`).join('')}</ul>`
    : `<p class="tool-status">No permits within the last 12 months near that address — worth a discount on the comp.</p>`;
}

function scrollToSection(el) {
  const target = document.getElementById(el.dataset.target);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

Object.assign(ACTIONS, {
  scanTheCity() { scanTheCity(); },
  cityRadarZipClick(el) {
    const zip = el.dataset.zip;
    S.filters.cityRadarZip = S.filters.cityRadarZip === zip ? '' : zip;
    persistView();
  },
  cityRadarClearZip() { S.filters.cityRadarZip = ''; persistView(); },
  cityRadarDotClick(el) {
    if (el.dataset.noticeId) {
      S.filters.cityRadarQuery = '';
      const n = (S.cityRadar.notices || []).find(x => x.id === el.dataset.noticeId);
      if (n) { S.filters.cityRadarZip = n.zip || ''; persistView(); showToast(n.address || 'Vacant notice', { tone: 'info' }); }
    } else if (el.dataset.permitId) {
      const p = (S.cityRadar.permits || []).find(x => x.id === el.dataset.permitId);
      if (p) showToast(`${p.address || 'Permit'} — ${fmtMoney(p.value)}`, { tone: 'info' });
    }
  },
  cityRadarTraceOwner(el) { cityRadarTraceOwner(el.dataset.noticeId); },
  pipelineFromCityRadar(el) { pipelineFromCityRadar(el.dataset.noticeId); },
  cityRadarPermitSearch() { cityRadarPermitSearchRun(); },
  scrollToSection(el) { scrollToSection(el); },
});
