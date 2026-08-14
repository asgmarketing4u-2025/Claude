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
      activeSubtabB: '01',
      activeSubtabC: '01',
      createdAt: Date.now(),
    },
    properties: buildSeedProperties(),
    lenders: LENDER_BENCH_SEED.slice(),
    loans: ACTIVE_LOANS_SEED.slice(),
    offersLog: OFFERS_LOG_SEED.slice(),
    leads: buildSeedLeads(),
    listings: buildSeedListings(),
    contracts: buildSeedContracts(),
    referrals: buildSeedReferrals(),
    documents: buildSeedDocuments(),
    activity: [{ ts: Date.now(), msg: 'Board initialized with practice data.' }],
    filters: { pipelineStrategy: 'all', leadPipeline: 'all' },
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
  if (state.filters.leadPipeline === undefined) state.filters.leadPipeline = 'all';
  // Sheet B/C were introduced in Session 2 — a board saved before then won't have
  // these yet. Seed them fresh (same as a brand-new board) rather than leaving
  // Sheet B/C empty, since the user hasn't touched them either way.
  if (!Array.isArray(state.leads)) state.leads = buildSeedLeads();
  if (!Array.isArray(state.listings)) state.listings = buildSeedListings();
  if (!Array.isArray(state.contracts)) state.contracts = buildSeedContracts();
  if (!Array.isArray(state.referrals)) state.referrals = buildSeedReferrals();
  if (!Array.isArray(state.documents)) state.documents = buildSeedDocuments();
  if (state.meta.activeSubtabB === undefined) state.meta.activeSubtabB = '01';
  if (state.meta.activeSubtabC === undefined) state.meta.activeSubtabC = '01';
  state.properties.forEach(p => {
    if (!Array.isArray(p.activityLog)) p.activityLog = [];
    if (!Array.isArray(p.outreachLog)) p.outreachLog = [];
    if (!Array.isArray(p.deadlines)) p.deadlines = [];
    if (!Array.isArray(p.offers)) p.offers = [];
  });
  state.leads.forEach(l => {
    if (!Array.isArray(l.activityLog)) l.activityLog = [];
    if (!Array.isArray(l.outreachLog)) l.outreachLog = [];
  });
  state.listings.forEach(li => {
    if (!Array.isArray(li.marketingChecklist)) li.marketingChecklist = [];
    if (!Array.isArray(li.showings)) li.showings = [];
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
  S.leads = [];
  S.listings = [];
  S.contracts = [];
  S.referrals = [];
  S.documents = [];
  S.filters = { pipelineStrategy: 'all', leadPipeline: 'all' };
  S.meta.welcomeSeen = true;
  mutate('Started a fresh, empty board.', { undoSnapshot: snap, tone: 'warn', duration: 10000 });
}

// Vault & Sharing's "RESET TO SAMPLE DATA" — puts the whole board (all three
// sheets) back to the practice data it shipped with.
function resetToSampleData() {
  const snap = snapshotState();
  const fresh = buildInitialState();
  S.properties = fresh.properties;
  S.lenders = fresh.lenders;
  S.loans = fresh.loans;
  S.offersLog = fresh.offersLog;
  S.leads = fresh.leads;
  S.listings = fresh.listings;
  S.contracts = fresh.contracts;
  S.referrals = fresh.referrals;
  S.documents = fresh.documents;
  S.filters = fresh.filters;
  mutate('Reset the whole board to sample data.', { undoSnapshot: snap, tone: 'warn', duration: 10000 });
}

function dismissWelcome() {
  S.meta.welcomeSeen = true;
  persistView();
}

function getLead(id) { return S.leads.find(l => l.id === id); }
function getListing(id) { return S.listings.find(l => l.id === id); }
function getContract(id) { return S.contracts.find(c => c.id === id); }
function getReferral(id) { return S.referrals.find(r => r.id === id); }

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
  (S.leads || []).forEach(l => {
    if (l.stage === 'closed') return;
    const days = daysUntil(l.followUpDate);
    if (days < 0) items.push({ type: 'lead_overdue', label: `OVERDUE FOLLOW-UP — ${l.name}`, leadId: l.id, days });
    else if (days === 0) items.push({ type: 'lead_due_today', label: `FOLLOW UP TODAY — ${l.name}`, leadId: l.id, days });
  });
  (S.referrals || []).forEach(r => {
    const days = daysUntil(r.nextTouchDate);
    if (days < 0) items.push({ type: 'referral_overdue', label: `OVERDUE REFERRAL TOUCH — ${r.name}`, referralId: r.id, days });
    else if (days === 0) items.push({ type: 'referral_due_today', label: `REFERRAL TOUCH TODAY — ${r.name}`, referralId: r.id, days });
  });
  (S.contracts || []).forEach(c => {
    if (c.commissionStatus === 'paid') return;
    const doneCount = c.milestones.filter(m => m.done).length;
    if (doneCount >= CONTRACT_MILESTONES.length) return;
    const nextLabel = CONTRACT_MILESTONES[doneCount].label;
    items.push({ type: 'contract_step', label: `NEXT STEP — ${nextLabel} on ${c.address}`, contractId: c.id, days: 0 });
  });
  items.sort((a, b) => a.days - b.days);
  return items;
}
