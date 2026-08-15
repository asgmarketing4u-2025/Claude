/* ============================================================
   NTM DEAL CENTER — Fix-It Ledger (shared error dictionary)
   ONE file, used by every paid tool's popups AND by the public
   troubleshooting.html page — so the explanation the user sees in
   the app and the explanation on the docs page can never drift apart.

   Loads as a plain global in the browser (no export) and via
   module.exports under Node (test.mjs, and any server function that
   wants to build a friendly error before it leaves api/).

   A "kind" is a failure category, not a raw code — never show a raw
   HTTP status or provider error string to the user. classifyError()
   turns whatever a tool threw or returned into a kind; ERROR_DICTIONARY
   turns a (tool, kind) pair into {title, meaning, action}.
   ============================================================ */

// Per-tool identity used to fill in generic wording (where to add funds,
// where to find/replace a key) without repeating it in every row.
const TOOL_INFO = {
  skiptrace: { label: 'Skip Trace', provider: 'BatchData', keyPlace: 'batchdata.com → API', billingPlace: 'batchdata.com → Billing', envVars: ['BATCHDATA_API_KEY'] },
  court: { label: 'Court Radar', provider: 'PACER', keyPlace: 'pacer.uscourts.gov', billingPlace: 'pacer.uscourts.gov → Account → Billing History', envVars: ['PACER_USER', 'PACER_PASS'] },
  socials: { label: 'Find Socials', provider: 'People Data Labs', keyPlace: 'peopledatalabs.com → API Keys', billingPlace: 'peopledatalabs.com → Billing', envVars: ['PDL_API_KEY'] },
  ghl: { label: 'GHL Link', provider: 'GoHighLevel', keyPlace: 'GHL → Settings → Private Integrations', billingPlace: 'GHL → Settings → Billing', envVars: ['GHL_PIT', 'GHL_LOCATION_ID'] },
  cityradar: { label: 'City Radar', provider: 'Baltimore Open Data', keyPlace: '', billingPlace: '', envVars: [] },
  sync: { label: 'Lab Link', provider: 'Vercel Blob', keyPlace: 'Vercel → Storage', billingPlace: 'Vercel → Storage → Billing', envVars: ['BLOB_READ_WRITE_TOKEN'] },
};

function envVarList(tool) {
  const info = TOOL_INFO[tool];
  return info && info.envVars.length ? info.envVars.join(' and ') : 'its API key';
}

// Rows that don't depend on which tool failed — the message is the same
// regardless of what you were trying to do when the connection dropped.
const GENERIC_ROWS = {
  offline: {
    title: 'You appear to be offline',
    meaning: 'Your browser could not reach the server at all — this is a connection problem, not something the tool rejected.',
    action: 'Check your internet connection and try again. Nothing was sent, so there is nothing to undo.',
  },
  unknown: {
    title: 'Something went wrong',
    meaning: 'This tool hit an error that doesn’t match a known cause.',
    action: 'Try again in a moment. If it keeps happening, check the Fix-It Ledger (troubleshooting.html) for updates or contact support.',
  },
};

// Per-tool rows, keyed by failure kind. Only kinds that make sense for a
// given tool need an entry — buildRow() falls back to a generic phrasing
// (built from TOOL_INFO) for any kind not explicitly written out below.
const ERROR_DICTIONARY = {
  skiptrace: {
    notConfigured: {
      title: 'Skip Trace isn’t set up yet',
      meaning: 'No BatchData API key is on file for this site.',
      action: 'Add BATCHDATA_API_KEY in Vercel → Settings → Environment Variables, then redeploy. Until then this tool stays off — nothing is charged.',
    },
    outOfCredit: {
      title: 'Out of skip trace credit',
      meaning: 'Your BatchData account balance ran out mid-lookup.',
      action: 'Add funds at batchdata.com → Billing — a failed lookup is never charged.',
    },
    rateLimited: {
      title: 'Too many lookups too fast',
      meaning: 'BatchData is throttling requests for a moment.',
      action: 'Wait a minute and try again — the blocked request was never charged.',
    },
    keyRejected: {
      title: 'Skip trace key not accepted',
      meaning: 'The BatchData API key on file was rejected — it may be missing, revoked, or mistyped.',
      action: 'Check the key at batchdata.com → API, then update BATCHDATA_API_KEY in Vercel → Settings → Environment Variables and redeploy.',
    },
    serviceDown: {
      title: 'BatchData is unreachable',
      meaning: 'The lookup service didn’t respond in time.',
      action: 'Try again in a few minutes — this is on BatchData’s end, not yours.',
    },
    noMatch: {
      title: 'No owner found',
      meaning: 'BatchData searched but couldn’t match an owner to this address.',
      action: 'Double-check the address and try again — public records get updated over time.',
    },
  },
  court: {
    notConfigured: {
      title: 'GET ADDRESS isn’t set up yet',
      meaning: 'No PACER account is on file for this site (the free RSS foreclosure feed above still works without one).',
      action: 'Add PACER_USER and PACER_PASS in Vercel → Settings → Environment Variables, then redeploy. A free "Case Search Only" account works — fees are waived under $30/quarter.',
    },
    keyRejected: {
      title: 'PACER login not accepted',
      meaning: 'PACER_USER / PACER_PASS were rejected by PACER’s login.',
      action: 'Confirm your account at pacer.uscourts.gov, then update PACER_USER and PACER_PASS in Vercel and redeploy.',
    },
    outOfCredit: {
      title: 'PACER fee limit reached',
      meaning: 'This account has used up its waived quarterly fee allowance ($30).',
      action: 'Check your billing history at pacer.uscourts.gov → Account → Billing History.',
    },
    serviceDown: {
      title: 'PACER is unreachable',
      meaning: 'The docket lookup didn’t respond in time — PACER has occasional maintenance windows.',
      action: 'Try again in a few minutes.',
    },
    noMatch: {
      title: 'No docket found',
      meaning: 'PACER couldn’t find a matching case for this filing.',
      action: 'Double-check the case number on the source RSS entry and try again.',
    },
  },
  socials: {
    notConfigured: {
      title: 'Find Socials isn’t set up yet',
      meaning: 'No People Data Labs API key is on file for this site.',
      action: 'Add PDL_API_KEY in Vercel → Settings → Environment Variables, then redeploy — a free self-serve account gets ~100 lookups a month.',
    },
    outOfCredit: {
      title: 'Out of free lookups this month',
      meaning: 'People Data Labs’ free tier caps at about 100 lookups a month, and this account has used them up.',
      action: 'Upgrade or wait for next month’s reset at peopledatalabs.com → Billing.',
    },
    keyRejected: {
      title: 'Socials key not accepted',
      meaning: 'The People Data Labs API key on file was rejected.',
      action: 'Check the key at peopledatalabs.com → API Keys, then update PDL_API_KEY in Vercel and redeploy.',
    },
    serviceDown: {
      title: 'People Data Labs is unreachable',
      meaning: 'The enrichment service didn’t respond in time.',
      action: 'Try again in a few minutes.',
    },
    noMatch: {
      title: 'No profiles found',
      meaning: 'People Data Labs couldn’t match any social profiles to this name/phone.',
      action: 'This happens for people with a light online footprint — nothing to fix, just no result this time.',
    },
  },
  ghl: {
    notConfigured: {
      title: 'GHL Link isn’t set up yet',
      meaning: 'No GoHighLevel Private Integration Token is on file for this site.',
      action: 'In GHL go to Settings → Private Integrations, create a token with contacts + opportunities read/write, then add GHL_PIT and GHL_LOCATION_ID in Vercel and redeploy.',
    },
    keyRejected: {
      title: 'GoHighLevel token not accepted',
      meaning: 'The Private Integration Token was rejected — it may be missing scopes, revoked, or mistyped.',
      action: 'In GHL go to Settings → Private Integrations, confirm contacts + opportunities read/write are checked, copy the token again, then update GHL_PIT in Vercel and redeploy.',
    },
    rateLimited: {
      title: 'GoHighLevel is throttling requests',
      meaning: 'Too many CRM calls too fast.',
      action: 'Wait a minute and try PULL or PUSH again.',
    },
    serviceDown: {
      title: 'GoHighLevel is unreachable',
      meaning: 'The CRM didn’t respond in time.',
      action: 'Try again in a few minutes — this is on GoHighLevel’s end.',
    },
    noMatch: {
      title: 'No matching pipeline found',
      meaning: 'None of this location’s GHL pipelines have stage names close enough to auto-map.',
      action: 'Pick a pipeline manually from the CONNECT list, or rename stages in GHL to match the board.',
    },
  },
  cityradar: {
    serviceDown: {
      title: 'Baltimore Open Data is unreachable',
      meaning: 'The city’s ArcGIS server didn’t respond in time.',
      action: 'Try SCAN THE CITY again in a few minutes — this is on the city’s server, not yours.',
    },
    rateLimited: {
      title: 'Too many requests to the city server',
      meaning: 'The open-data server is asking clients to slow down.',
      action: 'Wait a minute and scan again.',
    },
    noMatch: {
      title: 'No records returned',
      meaning: 'The layer responded but had nothing in it for this query — ArcGIS layers occasionally advertise fields they don’t actually hold data for.',
      action: 'Try again, or check the layer directly in the data portal to confirm it still has records.',
    },
  },
  sync: {
    notConfigured: {
      title: 'Lab Link isn’t set up yet',
      meaning: 'No cloud Blob store is connected to this site.',
      action: 'In Vercel, open Storage → Create Database → Blob, connect it to this project, then redeploy.',
    },
    serviceDown: {
      title: 'Cloud sync is unreachable',
      meaning: 'The sync server didn’t respond in time.',
      action: 'Your board keeps working locally — it will sync again once the connection is back.',
    },
  },
};

// Builds the {title, meaning, action} row for a (tool, kind) pair, falling
// back to a generic-but-still-plain-English row built from TOOL_INFO when
// that exact tool+kind combo hasn't been written out above, then to the
// fully generic rows, so a call site NEVER has nothing to show.
function errorRow(tool, kind) {
  const toolRows = ERROR_DICTIONARY[tool];
  if (toolRows && toolRows[kind]) return toolRows[kind];
  if (GENERIC_ROWS[kind]) return GENERIC_ROWS[kind];

  const info = TOOL_INFO[tool] || { label: tool, provider: 'the service', keyPlace: 'its dashboard', billingPlace: 'its dashboard' };
  const generic = {
    outOfCredit: { title: `Out of ${info.provider} credit`, meaning: `Your ${info.provider} account balance ran out.`, action: `Add funds at ${info.billingPlace}.` },
    rateLimited: { title: `${info.provider} is throttling requests`, meaning: 'Too many calls too fast.', action: 'Wait a minute and try again.' },
    keyRejected: { title: `${info.label} key not accepted`, meaning: `The key on file for ${info.provider} was rejected.`, action: `Check it at ${info.keyPlace}, then update ${envVarList(tool)} in Vercel and redeploy.` },
    serviceDown: { title: `${info.provider} is unreachable`, meaning: 'The service didn’t respond in time.', action: 'Try again in a few minutes.' },
    noMatch: { title: 'No results found', meaning: 'The lookup completed but found nothing to return.', action: 'Try again with different details, or accept there’s nothing there this time.' },
    notConfigured: { title: `${info.label} isn’t set up yet`, meaning: `No ${info.provider} credentials are on file for this site.`, action: `Add ${envVarList(tool)} in Vercel → Settings → Environment Variables, then redeploy.` },
  };
  return generic[kind] || GENERIC_ROWS.unknown;
}

// Turns whatever a tool threw or returned into a failure kind. Never trust
// raw provider text to reach the user — this is the one place that reads it.
//
// Accepts:
//  - a thrown Error/TypeError from a rejected fetch (network down) -> 'offline'
//  - { status, body, notConfigured } shaped like a parsed API response
//  - { kind: '...' } when the server already knows exactly what happened
function classifyError(err) {
  if (!err) return 'unknown';

  if (typeof err === 'object' && err.notConfigured) return 'notConfigured';
  if (typeof err === 'object' && err.kind) return err.kind;

  // A rejected fetch() throws a plain Error/TypeError before any response
  // exists at all (offline, DNS failure, CORS block) — never a coded status.
  const isThrown = err instanceof Error || err.name === 'TypeError' || err.name === 'FetchError';
  const msg = String((err && err.message) || err || '').toLowerCase();
  if (isThrown && !('status' in err)) {
    if (/failed to fetch|networkerror|load failed|net::err|offline/.test(msg)) return 'offline';
  }

  const status = err.status || (err.response && err.response.status);
  if (status === 401 || status === 403) return 'keyRejected';
  if (status === 402) return 'outOfCredit';
  if (status === 429) return 'rateLimited';
  if (typeof status === 'number' && status >= 500) return 'serviceDown';

  const bodyStr = (typeof err.body === 'string' ? err.body : JSON.stringify(err.body || '')).toLowerCase() + ' ' + msg;
  if (/insufficient (funds|credit|balance)|out of credit|no credit|billing/.test(bodyStr)) return 'outOfCredit';
  if (/rate limit|too many requests|quota exceeded|throttl/.test(bodyStr)) return 'rateLimited';
  if (/invalid.*key|unauthorized|forbidden|login failed|invalid credentials|auth failed|not authenticated/.test(bodyStr)) return 'keyRejected';
  if (/no match|no results|not found|no records/.test(bodyStr)) return 'noMatch';
  if (typeof status === 'number') return 'serviceDown';
  return 'unknown';
}

// One-call convenience: classify + look up the row for a given tool.
function friendlyError(tool, err) {
  return errorRow(tool, classifyError(err));
}

// A consistent client-side popup for any tool — never a raw code on screen.
function showToolError(tool, err, opts) {
  const row = friendlyError(tool, err);
  if (typeof showToast === 'function') {
    showToast(row.title + ' — ' + row.action, Object.assign({ tone: 'danger', duration: 6000 }, opts));
  }
  return row;
}

// Every tool + kind combo, flattened for troubleshooting.html's ledger and
// for a quick completeness check in tests. Falls back through errorRow()
// so the page always matches exactly what the app itself would show.
const ALL_KINDS = ['notConfigured', 'outOfCredit', 'rateLimited', 'keyRejected', 'serviceDown', 'noMatch'];
function buildFixItLedger() {
  return Object.keys(TOOL_INFO).map(tool => ({
    tool,
    label: TOOL_INFO[tool].label,
    rows: ALL_KINDS.map(kind => Object.assign({ kind }, errorRow(tool, kind))),
  }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOOL_INFO, ERROR_DICTIONARY, GENERIC_ROWS, ALL_KINDS, errorRow, classifyError, friendlyError, showToolError, buildFixItLedger };
}
