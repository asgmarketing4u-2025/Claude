/* ============================================================
   NTM DEAL CENTER — AC's knowledge base
   ~25 short, plain-English entries — one per feature. Shared by:
     - api/ask.js — folded into the system prompt so AC's answers stay
       grounded in what the app actually does.
     - js/igor-ui.js — a simple keyword-search fallback for when
       api/ask can't be reached (no key, offline, service down).
   IMPORTANT: keep this updated whenever a feature changes — it's the
   single source of truth for what AC knows about the app.
   ============================================================ */

const KB_ENTRIES = [
  {
    id: 'pipeline',
    title: 'Pipeline (Sheet A, tab 01)',
    keywords: ['pipeline', 'kanban', 'stage', 'deal', 'board', 'research lead', 'closed'],
    text: 'The Pipeline is an 11-stage kanban board for investing deals, from Research Lead through Deal Closed. Every card shows the numbers (asking price, ARV, potential profit) and, once you have a seller on file, their name, phone, and CALL/DRAFT buttons right on the card. ADVANCE moves a deal to the next stage; MOVE jumps it to any stage directly.',
  },
  {
    id: 'deal_analyzer',
    title: 'Deal Analyzer (Sheet A, tab 02)',
    keywords: ['analyzer', 'mao', '70% rule', 'arv', 'repairs', 'flip', 'profit', 'reject'],
    text: 'The Deal Analyzer runs the numbers on any deal instantly as you type: the 70% rule (MAO = ARV x 0.70 - repairs), interest-only vs amortizing loan payments, and a flip profit estimate. Weak deals get a REJECTED stamp with a SET ASK TO MAO button to fix the price in one click.',
  },
  {
    id: 'portfolio',
    title: 'Portfolio & Rentals (Sheet A, tab 03)',
    keywords: ['portfolio', 'rental', 'hold', 'brrrr', 'cash flow', 'equity'],
    text: 'Portfolio & Rentals tracks every property you kept (hold or BRRRR strategy): a per-property table, a 12-month cash-flow chart, and a rental income/expense ledger breakdown.',
  },
  {
    id: 'financing',
    title: 'Financing (Sheet A, tab 04)',
    keywords: ['financing', 'lender', 'loan', 'hard money', 'rate', 'points'],
    text: 'Financing shows your lender bench (hard money, conventional, DSCR options with rates and points) and a table of active loans against your deals. Lender contact info is masked until you click to reveal it.',
  },
  {
    id: 'renovation',
    title: 'Renovation (Sheet A, tab 05)',
    keywords: ['renovation', 'reno', 'contractor', 'budget', 'line item', 'over budget'],
    text: 'Renovation tracks every reno job as a card: contractor, next milestone, budget vs. spent, and line items you can click to cycle through pending/active/done. Jobs that go over budget show an orange warning bar.',
  },
  {
    id: 'deadlines_offers',
    title: 'Deadlines & Offers (Sheet A, tab 06)',
    keywords: ['deadline', 'offer', 'contingency', 'clear', 'countdown', 'log offer'],
    text: 'Deadlines & Offers shows countdown chips for every deadline across every deal, with a CLEAR button (10-second undo) once handled, plus a log of every offer made.',
  },
  {
    id: 'skip_trace',
    title: 'Skip Trace (Sheet A, tab 07)',
    keywords: ['skip trace', 'owner', 'batchdata', 'find owner', 'csv batch', 'trace'],
    text: 'Skip Trace finds a property owner’s name, phone, and email from just an address, via BatchData (a real cost per lookup). Trace one address or run a whole CSV of up to 100 at once — the batch confirms the cost first and stops early if you run out of credit. Filing a result to the Pipeline puts the owner right in the card’s contact fields. Needs a BatchData account (BATCHDATA_API_KEY) — shows a friendly "not configured" message if that’s not set up yet.',
  },
  {
    id: 'ghl_link',
    title: 'GHL Link (Sheet A, tab 08)',
    keywords: ['ghl', 'gohighlevel', 'crm', 'sync', 'pipeline stages', 'pull', 'push'],
    text: 'GHL Link syncs this board with a GoHighLevel CRM pipeline both ways: CONNECT finds your pipeline and maps its stages to this board, PULL brings CRM changes here, PUSH sends this board’s stage moves back (creating brand-new CRM records always asks you first). Needs a GoHighLevel Private Integration Token — shows "not configured" if that’s missing.',
  },
  {
    id: 'city_radar',
    title: 'City Radar (Sheet A, tab 09)',
    keywords: ['city radar', 'vacant', 'permit', 'baltimore', 'distressed', 'map', 'zip'],
    text: 'City Radar is free — no API key needed. SCAN THE CITY pulls the newest vacant building notices and a year of $20k+ renovation permits straight from Baltimore’s public records, badges anything new since your last scan, and plots it all on a live map by ZIP code. PERMIT INTELLIGENCE ranks ZIPs by how much renovation money is already flowing in, so you know where to buy.',
  },
  {
    id: 'court_radar',
    title: 'Court Radar (Sheet A, tab 10)',
    keywords: ['court radar', 'bankruptcy', 'foreclosure', 'relief from stay', 'pacer', 'docket'],
    text: 'Court Radar’s free part scans the federal bankruptcy court’s public filings and flags RELIEF FROM STAY motions — a lender asking to foreclose, meaning that owner is often weeks from losing the house and ready to deal. GET ADDRESS (paid, via PACER) turns a case number into a real address. Needs a PACER account for that part — shows "not configured" otherwise.',
  },
  {
    id: 'find_socials',
    title: 'Find Socials',
    keywords: ['find socials', 'social media', 'facebook', 'instagram', 'linkedin', 'people data labs'],
    text: 'FIND SOCIALS is a button on Skip Trace and Court Radar rows that turns a name/phone/email into Facebook, Instagram, LinkedIn, TikTok, and X profile links, each tagged with a confidence level. Needs a People Data Labs account (a free tier covers about 100 lookups a month) — shows "not configured" otherwise.',
  },
  {
    id: 'lead_pipeline',
    title: 'Lead Pipeline (Sheet B, tab 01)',
    keywords: ['lead', 'realtor', 'buyer', 'seller', 'follow up', 'kanban'],
    text: 'The realtor-side Lead Pipeline is a 6-stage kanban for buyer and seller leads. ADVANCE tightens the next follow-up date automatically as a lead gets hotter, so nobody goes cold by accident.',
  },
  {
    id: 'listings_showings',
    title: 'Listings & Showings (Sheet B, tab 02)',
    keywords: ['listing', 'showing', 'marketing checklist', 'feedback', 'schedule'],
    text: 'Listings & Showings tracks a marketing checklist per listing (gaps show in orange), lets you schedule a showing with an automatic follow-up reminder, log buyer feedback, and pull up a ready-made 3-week marketing plan.',
  },
  {
    id: 'contracts',
    title: 'Contracts (Sheet B, tab 03)',
    keywords: ['contract', 'milestone', 'closing', 'emd', 'inspection', 'appraisal', 'commission'],
    text: 'Contracts shows the 6 milestones from accepted offer to settlement as a row of dots — only the current pulsing one is clickable, so you can’t skip a step. Completing all six flips the deal to CLOSED and PAID.',
  },
  {
    id: 'commissions',
    title: 'Commissions (Sheet B, tab 04)',
    keywords: ['commission', 'gross', 'net', 'split', 'chart', 'money'],
    text: 'Commissions shows a 12-month chart plus a table of every deal’s gross commission, broker split, and your net — amounts stay masked until you click to reveal them.',
  },
  {
    id: 'followups_marketing',
    title: 'Follow-ups & Marketing (Sheet B, tab 05)',
    keywords: ['follow up', 'draft', 'call script', 'text', 'email', 'copy and log'],
    text: 'Follow-ups & Marketing lists everyone owed a touch today, most overdue first. DRAFT writes a personalized call script, text, or email from their real details; COPY & LOG TOUCH copies it and reschedules their next follow-up automatically.',
  },
  {
    id: 'referrals',
    title: 'Referrals (Sheet B, tab 06)',
    keywords: ['referral', 'past client', 'next touch', 'countdown'],
    text: 'Referrals tracks your past clients — your best lead source — with a next-touch countdown so you never let a relationship go quiet. LOG TOUCH resets the countdown.',
  },
  {
    id: 'daily_briefing',
    title: 'Daily Briefing (Sheet C, tab 01)',
    keywords: ['daily briefing', 'priority', 'p1', 'p2', 'p3', 'critical path', 'today'],
    text: 'The Daily Briefing is built fresh every time you open it from live board data — critical path items, people to touch today, what’s on the calendar, a going-cold watch list, and a City Radar summary — ranked P1 to P3 so you always know what to do first. COPY AS TEXT grabs the whole thing to paste anywhere.',
  },
  {
    id: 'weekly_report',
    title: 'Weekly Report (Sheet C, tab 02)',
    keywords: ['weekly report', 'kpi', 'writeup', 'equity chart'],
    text: 'The Weekly Report shows this week’s KPIs (new leads, showings, contracts closed, commission earned), a 4-section writeup, and a portfolio equity chart — also copyable as plain text.',
  },
  {
    id: 'data_intake',
    title: 'Data Intake (Sheet C, tab 03)',
    keywords: ['csv', 'import', 'bulk', 'contacts', 'properties', 'document'],
    text: 'Data Intake bulk-imports contacts or properties from a CSV with loose column matching (so "Full Name", "name", or "Contact Name" all work), reports how many rows imported vs. were skipped, and keeps a register of attached documents.',
  },
  {
    id: 'vault_sharing',
    title: 'Vault & Sharing (Sheet C, tab 04)',
    keywords: ['vault', 'snapshot', 'share link', 'backup', 'restore', 'reset', 'lab link'],
    text: 'Vault & Sharing lets you save named snapshots of the whole board, generate a read-only share link, back up or restore the board as a file, reset to sample data (with a 10-second undo), and connect a Lab Key for Lab Link cloud sync.',
  },
  {
    id: 'lab_link',
    title: 'Lab Link (cloud sync)',
    keywords: ['lab link', 'cloud sync', 'lab key', 'sync status', 'multiple devices'],
    text: 'Lab Link keeps the same board in sync across every device you use it on, through a Lab Key (never your real passcode) that identifies the board in the cloud. It saves automatically a few seconds after every change and checks for updates every 45 seconds — last-write-wins if two devices edit at once.',
  },
  {
    id: 'demo_user_mode',
    title: 'Demo Mode vs. User Mode',
    keywords: ['demo mode', 'user mode', 'passcode', 'unlock', 'gate', 'lock'],
    text: 'DEMO MODE is look-but-don’t-touch — anyone can browse and try the board, but nothing they do actually changes real data. USER MODE (the passcode-protected owner mode) unlocks real editing, real skip traces, real CRM syncs — anything that spends money or changes the board for real.',
  },
  {
    id: 'fix_it_ledger',
    title: 'Fix-It Ledger (troubleshooting.html)',
    keywords: ['error', 'troubleshoot', 'fix it ledger', 'not configured', 'failed'],
    text: 'The Fix-It Ledger (linked from the footer) explains every error a paid tool can show — what you’ll see, what it means, and exactly what to do about it — in plain English, grouped by tool.',
  },
  {
    id: 'finder',
    title: 'Find Anything (Ctrl-K)',
    keywords: ['find', 'search', 'ctrl k', 'finder', 'jump'],
    text: 'Ctrl-K (or the FIND button) opens a quick search across every property and lead by address, owner name, or phone — Enter jumps straight to it.',
  },
  {
    id: 'ac_assistant',
    title: 'AC (this assistant)',
    keywords: ['ac', 'assistant', 'ask', 'voice', 'live', 'chat', 'help'],
    text: 'AC is the built-in assistant — click ASK in the bottom-right corner to chat, ask a question with your voice using the mic button, or start a hands-free LIVE call. AC can also do the work for you (add a lead, move a deal, trace an owner) by name, in plain English. In Demo Mode, AC can answer questions and read the board, but will ask you to switch to User Mode before doing anything that changes real data or spends money.',
  },
  {
    id: 'film_room',
    title: 'Film Room',
    keywords: ['film room', 'video', 'walkthrough', 'watch', 'narrated'],
    text: 'Film Room (linked from the footer) is a set of short, narrated video walkthroughs — one per panel, in AC\'s own voice. Click WATCH in any panel\'s header to jump straight to that one.',
  },
];

function searchKb(query, limit) {
  limit = limit || 3;
  const terms = String(query || '').toLowerCase().split(/\W+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = KB_ENTRIES.map(entry => {
    const hay = (entry.title + ' ' + entry.keywords.join(' ') + ' ' + entry.text).toLowerCase();
    let score = 0;
    terms.forEach(t => {
      if (entry.keywords.some(k => k.toLowerCase() === t)) score += 3;
      if (hay.includes(t)) score += 1;
    });
    return { entry, score };
  }).filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.entry);
}

function kbAsPromptText() {
  return KB_ENTRIES.map(e => `### ${e.title}\n${e.text}`).join('\n\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KB_ENTRIES, searchKb, kbAsPromptText };
}
