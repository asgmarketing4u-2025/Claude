/* ============================================================
   NTM DEAL CENTER — state core
   All state lives in S. Every change goes through save()/render()
   via mutate(). localStorage keys below are PERMANENT once launched.
   ============================================================ */

const STORAGE_KEY = 'ntmDealCenterState';           // main state blob — do not rename
const STORAGE_KEY_META = 'ntmDealCenterVisited';    // lightweight "has this browser been here before" flag

let S = null;

function buildInitialState() {
  return {
    meta: {
      brand: 'NTM DEAL CENTER',
      poweredBy: 'ASG MARKETING',
      rev: 0,
      theme: 'dark',
      masked: true,
      heroExpanded: true,
      heroPreferenceSet: false,
      welcomeSeen: false,
      activeSheet: 'A',
      activeSubtabA: '01',
      createdAt: Date.now(),
    },
    properties: buildSeedProperties(),
    lenders: LENDER_BENCH_SEED.slice(),
    loans: ACTIVE_LOANS_SEED.slice(),
    offersLog: OFFERS_LOG_SEED.slice(),
    activity: [{ ts: Date.now(), msg: 'Board initialized with practice data.' }],
    filters: { pipelineStrategy: 'all' },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage unavailable or corrupt — fall back to fresh state */ }
  return null;
}

// Fills in any fields added since a user's board was first saved, without touching their data.
function migrateState(state) {
  const fresh = buildInitialState();
  state.meta = Object.assign({}, fresh.meta, state.meta, {
    // preserve identity fields that must never reset on migration
    rev: state.meta && typeof state.meta.rev === 'number' ? state.meta.rev : 0,
    createdAt: (state.meta && state.meta.createdAt) || fresh.meta.createdAt,
  });
  if (!Array.isArray(state.properties)) state.properties = [];
  if (!Array.isArray(state.lenders)) state.lenders = [];
  if (!Array.isArray(state.loans)) state.loans = [];
  if (!Array.isArray(state.offersLog)) state.offersLog = [];
  if (!Array.isArray(state.activity)) state.activity = [];
  if (!state.filters) state.filters = { pipelineStrategy: 'all' };
  state.properties.forEach(p => {
    if (!Array.isArray(p.activityLog)) p.activityLog = [];
    if (!Array.isArray(p.outreachLog)) p.outreachLog = [];
    if (!Array.isArray(p.deadlines)) p.deadlines = [];
    if (!Array.isArray(p.offers)) p.offers = [];
  });
  return state;
}

function initState() {
  const existing = loadState();
  const returning = !!existing;
  if (existing) {
    S = migrateState(existing);
    // The cinematic hero only shows on a visitor's very first visit. On every
    // visit after, it starts collapsed — unless they've explicitly chosen
    // (via the EXPAND/COLLAPSE button) to keep it a particular way.
    if (!S.meta.heroPreferenceSet) S.meta.heroExpanded = false;
  } else {
    S = buildInitialState();
  }
  return returning;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    localStorage.setItem(STORAGE_KEY_META, '1');
  } catch (e) { /* quota exceeded or storage disabled — nothing more we can do here */ }
}

function snapshotState() {
  return JSON.parse(JSON.stringify(S));
}

// The one path for real changes: logs it, saves it, redraws it, tells the user.
function mutate(msg, opts) {
  opts = opts || {};
  S.meta.rev = (S.meta.rev || 0) + 1;
  if (msg) {
    S.activity.unshift({ ts: Date.now(), msg });
    if (S.activity.length > 300) S.activity.length = 300;
  }
  save();
  render();
  if (opts.silent) return;
  showToast(msg, {
    tone: opts.tone,
    duration: opts.duration,
    undo: opts.undoSnapshot ? () => {
      S = opts.undoSnapshot;
      save();
      render();
      showToast('Undone.', { tone: 'info' });
    } : undefined,
  });
}

// For view-only changes (theme, mask, hero collapse, active tab): persisted, but
// never counted as a "real" save, so the REV counter and activity log don't move.
function persistView(doRender) {
  save();
  if (doRender !== false) render();
}

function blankState() {
  const snap = snapshotState();
  S.properties = [];
  S.lenders = [];
  S.loans = [];
  S.offersLog = [];
  S.filters = { pipelineStrategy: 'all' };
  S.meta.welcomeSeen = true;
  mutate('Started a fresh, empty board.', { undoSnapshot: snap, tone: 'warn', duration: 10000 });
}

function dismissWelcome() {
  S.meta.welcomeSeen = true;
  persistView();
}

function getProperty(id) {
  return S.properties.find(p => p.id === id);
}

// Single source of truth for "needs you" — feeds the header badge now,
// and will feed the daily briefing's top-priority list in a later session.
function getUrgentItems() {
  const items = [];
  const today = todayISO();
  S.properties.forEach(p => {
    (p.deadlines || []).forEach(d => {
      if (d.cleared) return;
      const days = daysUntil(d.dueDate);
      if (days < 0) items.push({ type: 'overdue_deadline', label: `OVERDUE — ${d.label} at ${p.address}`, propertyId: p.id, days });
      else if (days === 0) items.push({ type: 'due_today', label: `DUE TODAY — ${d.label} at ${p.address}`, propertyId: p.id, days });
    });
    if (p.stage === 'follow_up') {
      items.push({ type: 'follow_up', label: `FOLLOW UP NEEDED — ${p.address}`, propertyId: p.id, days: 0 });
    }
    if (p.stage === 'make_offer' || p.stage === 'accepted_offer') {
      items.push({ type: 'awaiting_reply', label: `AWAITING REPLY — ${p.address}`, propertyId: p.id, days: 0 });
    }
  });
  items.sort((a, b) => a.days - b.days);
  return items;
}
