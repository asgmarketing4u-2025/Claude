/* ============================================================
   NTM DEAL CENTER — reference data & seed board
   Powered by ASG MARKETING
   ============================================================ */

// The 11 pipeline stages, in normal forward order.
// A declined offer's normal ADVANCE lands on Follow Up (index 6), same
// as any other stage's next-in-line — the loop is just sequential order.
const STAGES = [
  { key: 'research_lead',        label: 'Research Lead' },
  { key: 'contact_lead',         label: 'Contact Lead' },
  { key: 'appointment',          label: 'Make Appointment / Visit Property' },
  { key: 'make_offer',           label: 'Make Offer' },
  { key: 'accepted_offer',       label: 'Accepted Offer' },
  { key: 'declined_offer',       label: 'Declined Offer' },
  { key: 'follow_up',            label: 'Follow Up' },
  { key: 'under_contract',       label: 'Property Under Contract' },
  { key: 'buyer_under_contract', label: 'Buyer Under Contract' },
  { key: 'contract_title',       label: 'Contract Delivered Title Company' },
  { key: 'closed',               label: 'Deal Closed' },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

const STRATEGIES = [
  { key: 'wholesale', label: 'Wholesale' },
  { key: 'flip',      label: 'Flip' },
  { key: 'hold',      label: 'Hold' },
  { key: 'brrrr',     label: 'BRRRR' },
];

// Parametric "listing photo" house illustrations, generated client-side as inline
// SVG data URIs (no separate image files to host) — flat, blueprint-adjacent
// architectural style, varied enough that no two cards look alike.
const HOUSE_STYLES = [
  { name: 'rowhouse', siding: '#8B5A3C', roof: '#3B2F2F', door: '#C1440E', trim: '#F2E9DC', windows: 6 },
  { name: 'brick rambler', siding: '#9C4B3A', roof: '#5C4033', door: '#2E5339', trim: '#E8DFC8', windows: 3 },
  { name: 'cape cod', siding: '#D8CBB5', roof: '#4A4A4A', door: '#1B4B6B', trim: '#FFFFFF', windows: 4 },
  { name: 'colonial', siding: '#E7E2D8', roof: '#3E3E3E', door: '#8C1C1C', trim: '#FFFFFF', windows: 6 },
  { name: 'bungalow', siding: '#6E7F63', roof: '#3B2F2F', door: '#C1440E', trim: '#F2E9DC', windows: 3 },
  { name: 'formstone rowhouse', siding: '#B8ADA1', roof: '#2F2F2F', door: '#1B4B6B', trim: '#EDE6D8', windows: 6 },
  { name: 'split level', siding: '#C9B79C', roof: '#4A4A4A', door: '#2E5339', trim: '#FFFFFF', windows: 5 },
  { name: 'brick townhome', siding: '#A15C43', roof: '#2F2F2F', door: '#F2E9DC', trim: '#F2E9DC', windows: 6 },
  { name: 'ranch', siding: '#DCD3C0', roof: '#5C4033', door: '#8C1C1C', trim: '#FFFFFF', windows: 4 },
  { name: 'victorian', siding: '#7A6C5D', roof: '#2F2F2F', door: '#C1440E', trim: '#E8DFC8', windows: 5 },
  { name: 'blue rowhouse', siding: '#3F5F72', roof: '#20303A', door: '#F2E9DC', trim: '#DCE7EA', windows: 6 },
  { name: 'craftsman', siding: '#5B4636', roof: '#2F2F2F', door: '#2E5339', trim: '#E8DFC8', windows: 4 },
  { name: 'duplex', siding: '#8A7B6C', roof: '#3B2F2F', door: '#1B4B6B', trim: '#F2E9DC', windows: 8 },
  { name: 'cottage', siding: '#C7B299', roof: '#4A4A4A', door: '#8C1C1C', trim: '#FFFFFF', windows: 3 },
  { name: 'green rowhouse', siding: '#556B4F', roof: '#2F2F2F', door: '#C1440E', trim: '#E8DFC8', windows: 6 },
];

function houseSVGMarkup(s, i) {
  const w = 640, h = 480, groundY = 346, bodyLeft = 141, bodyRight = 499, bodyTop = 90, roofH = 60, bodyH = groundY - bodyTop;
  const cols = Math.min(s.windows, 4);
  const rows = Math.ceil(s.windows / cols);
  let windowsMarkup = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= s.windows) continue;
      const wx = bodyLeft + 30 + c * ((bodyRight - bodyLeft - 60) / (cols - 1 || 1));
      const wy = bodyTop + 30 + r * 70;
      windowsMarkup += `<rect x="${wx - 16}" y="${wy}" width="32" height="40" rx="2" fill="${s.trim}" stroke="#20303A" stroke-width="2"/><line x1="${wx}" y1="${wy}" x2="${wx}" y2="${wy + 40}" stroke="#20303A" stroke-width="1.5"/><line x1="${wx - 16}" y1="${wy + 20}" x2="${wx + 16}" y2="${wy + 20}" stroke="#20303A" stroke-width="1.5"/>`;
    }
  }
  const doorX = (bodyLeft + bodyRight) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#BFD9E8"/><rect x="0" y="${groundY}" width="${w}" height="${h - groundY}" fill="#A9B79C"/><rect x="0" y="${groundY - 4}" width="${w}" height="6" fill="#8A9A7D"/><rect x="${bodyLeft}" y="${bodyTop}" width="${bodyRight - bodyLeft}" height="${bodyH}" fill="${s.siding}"/><polygon points="${bodyLeft - 20},${bodyTop} ${(bodyLeft + bodyRight) / 2},${bodyTop - roofH} ${bodyRight + 20},${bodyTop}" fill="${s.roof}"/><rect x="${bodyLeft - 24}" y="${bodyTop - 4}" width="${bodyRight - bodyLeft + 48}" height="10" fill="${s.roof}"/>${windowsMarkup}<rect x="${doorX - 24}" y="${groundY - 90}" width="48" height="90" rx="2" fill="${s.door}" stroke="#20303A" stroke-width="2"/><circle cx="${doorX + 16}" cy="${groundY - 45}" r="2.5" fill="#F2E9DC"/><rect x="${doorX - 40}" y="${groundY - 2}" width="80" height="8" fill="#C9C2B4"/><text x="16" y="${h - 14}" font-family="monospace" font-size="13" fill="#3B4A3B" opacity="0.55">${s.name.toUpperCase()} — REF ${String(i + 1).padStart(2, '0')}</text></svg>`;
}

function houseImageDataUri(i) {
  const s = HOUSE_STYLES[i % HOUSE_STYLES.length];
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(houseSVGMarkup(s, i));
}

const HOUSE_IMAGES = HOUSE_STYLES.map((_, i) => houseImageDataUri(i));

const HERO_BLUEPRINT_DATA_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700" width="1600" height="700" preserveAspectRatio="xMidYMid slice"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#173252" stroke-width="1"/></pattern><pattern id="gridBig" width="200" height="200" patternUnits="userSpaceOnUse"><path d="M 200 0 L 0 0 0 200" fill="none" stroke="#1E3E63" stroke-width="1.5"/></pattern></defs><rect width="1600" height="700" fill="#0A1A2F"/><rect width="1600" height="700" fill="url(#grid)"/><rect width="1600" height="700" fill="url(#gridBig)"/><g fill="none" stroke="#DCE7EA" stroke-width="2.5" opacity="0.85"><rect x="230" y="220" width="520" height="340"/><line x1="230" y1="360" x2="750" y2="360"/><line x1="490" y1="220" x2="490" y2="360"/><line x1="490" y1="360" x2="490" y2="560"/><line x1="610" y1="360" x2="610" y2="560"/><rect x="340" y="255" width="70" height="10"/><rect x="560" y="255" width="70" height="10"/></g><g fill="none" stroke="#FF6B2C" stroke-width="3"><line x1="230" y1="590" x2="750" y2="590"/><line x1="230" y1="582" x2="230" y2="598"/><line x1="750" y1="582" x2="750" y2="598"/></g><text x="440" y="615" font-family="monospace" font-size="16" fill="#FF6B2C" opacity="0.9">52'-0"</text><g fill="none" stroke="#5FB6C9" stroke-width="1.5" opacity="0.55"><rect x="900" y="140" width="430" height="300" transform="rotate(2 900 140)"/><circle cx="1115" cy="290" r="90"/><line x1="900" y1="140" x2="1330" y2="440"/></g><g stroke="#DCE7EA" stroke-width="1" opacity="0.3"><line x1="0" y1="60" x2="1600" y2="60"/><line x1="0" y1="640" x2="1600" y2="640"/></g></svg>`);

// Picks the least-used image across the current board so cards never repeat randomly.
// Guarded for the moment the initial seed board is being built, before S exists yet.
function nextHouseImage() {
  if (typeof S === 'undefined' || !S || !S.properties) return nextSeedImage();
  const counts = Object.fromEntries(HOUSE_IMAGES.map(img => [img, 0]));
  S.properties.forEach(p => { if (p.photo && counts[p.photo] !== undefined) counts[p.photo]++; });
  let best = HOUSE_IMAGES[0], bestCount = Infinity;
  HOUSE_IMAGES.forEach(img => { if (counts[img] < bestCount) { best = img; bestCount = counts[img]; } });
  return best;
}

let seedImageCounter = 0;
function nextSeedImage() {
  const img = HOUSE_IMAGES[seedImageCounter % HOUSE_IMAGES.length];
  seedImageCounter++;
  return img;
}

const REAL_STREETS_BALTIMORE = [
  { line1: '1414 Greenmount Ave', city: 'Baltimore', state: 'MD', zip: '21218' },
  { line1: '3221 Belair Road',    city: 'Baltimore', state: 'MD', zip: '21213' },
  { line1: '612 S Broadway',      city: 'Baltimore', state: 'MD', zip: '21231' },
  { line1: '5511 York Road',      city: 'Baltimore', state: 'MD', zip: '21212' },
];

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function seedProperty(overrides) {
  const addr = overrides.addr || REAL_STREETS_BALTIMORE[0];
  const base = {
    id: uid('prop'),
    address: addr.line1,
    city: addr.city, state: addr.state, zip: addr.zip,
    strategy: 'flip',
    stage: 'research_lead',
    situation: 'standard', // 'foreclosure' | 'vacant' | 'standard'
    askingPrice: 150000,
    price: 150000, // analyzer working price (starts = asking)
    repairs: 35000,
    arv: 260000,
    beds: 3, baths: 2, sqft: 1400,
    owner: '', ownerPhone: '', ownerEmail: '',
    photo: nextHouseImage(),
    notes: '',
    rent: 0, taxes: 0, insurance: 0,
    loanType: 'hard', loanRate: 11, loanPoints: 2, loanTermYears: 1, downPct: 15,
    activityLog: [],
    outreachLog: [],
    deadlines: [],
    offers: [],
    renovation: null,
    financingLoanId: null,
    createdAt: Date.now(),
  };
  return Object.assign(base, overrides, { address: addr.line1, city: addr.city, state: addr.state, zip: addr.zip });
}

function buildSeedProperties() {
  const S1 = REAL_STREETS_BALTIMORE[0], S2 = REAL_STREETS_BALTIMORE[1], S3 = REAL_STREETS_BALTIMORE[2], S4 = REAL_STREETS_BALTIMORE[3];
  const mk = (n, addr, o) => seedProperty(Object.assign({ addr: Object.assign({}, addr, { line1: `${n} ${addr.line1.split(' ').slice(1).join(' ')}` }) }, o));

  const list = [
    mk(1414, S1, { strategy: 'flip', stage: 'research_lead', askingPrice: 118000, price: 118000, repairs: 42000, arv: 235000, beds: 3, baths: 1, sqft: 1350, situation: 'standard', notes: 'Corner rowhome, needs full kitchen gut.' }),
    mk(1432, S1, { strategy: 'wholesale', stage: 'contact_lead', askingPrice: 95000, price: 95000, repairs: 55000, arv: 210000, beds: 3, baths: 1, sqft: 1280, situation: 'vacant', owner: 'Denise Carroll', ownerPhone: '(410) 555-0142', ownerEmail: 'denise.carroll@example.com', notes: 'Vacant 8 months, absentee owner.' }),
    mk(1468, S1, { strategy: 'flip', stage: 'appointment', askingPrice: 129000, price: 129000, repairs: 38000, arv: 245000, beds: 3, baths: 2, sqft: 1420, situation: 'foreclosure', owner: 'Marcus Webb', ownerPhone: '(410) 555-0118', ownerEmail: 'marcus.webb@example.com', notes: 'Pre-foreclosure, auction date pending.' }),
    mk(1501, S1, { strategy: 'hold', stage: 'make_offer', askingPrice: 105000, price: 98000, repairs: 22000, arv: 190000, beds: 3, baths: 1.5, sqft: 1300, rent: 1650, taxes: 2200, insurance: 900, situation: 'standard', owner: 'Ruth Alston', ownerPhone: '(410) 555-0177', notes: 'Long-term tenant in place, cash flow candidate.' }),

    mk(3221, S2, { strategy: 'flip', stage: 'accepted_offer', askingPrice: 89000, price: 82000, repairs: 48000, arv: 205000, beds: 3, baths: 1, sqft: 1240, situation: 'vacant', owner: 'Terrence Boyd', ownerPhone: '(410) 555-0163', ownerEmail: 'terrence.boyd@example.com', notes: 'Seller accepted at $82k, inspection next week.' }),
    mk(3247, S2, { strategy: 'wholesale', stage: 'declined_offer', askingPrice: 92000, price: 92000, repairs: 51000, arv: 198000, beds: 3, baths: 1, sqft: 1260, situation: 'standard', owner: 'Angela Ford', ownerPhone: '(410) 555-0129', notes: 'Countered $18k above our offer.' }),
    mk(3260, S2, { strategy: 'brrrr', stage: 'follow_up', askingPrice: 110000, price: 102000, repairs: 30000, arv: 215000, beds: 4, baths: 2, sqft: 1550, rent: 1900, taxes: 2500, insurance: 1050, situation: 'foreclosure', owner: 'Vernon Hicks', ownerPhone: '(410) 555-0104', ownerEmail: 'vernon.hicks@example.com', notes: 'Bank clock is ticking, following up weekly.' }),
    mk(3288, S2, { strategy: 'flip', stage: 'under_contract', askingPrice: 99000, price: 94000, repairs: 40000, arv: 220000, beds: 3, baths: 2, sqft: 1380, situation: 'standard', notes: 'Title work in progress, closing in 3 weeks.',
      deadlines: [{ id: uid('dl'), label: 'Inspection contingency', dueDate: futureDate(5), cleared: false }, { id: uid('dl'), label: 'Financing contingency', dueDate: futureDate(14), cleared: false }] }),

    mk(612, S3, { strategy: 'flip', stage: 'buyer_under_contract', askingPrice: 165000, price: 158000, repairs: 52000, arv: 340000, beds: 3, baths: 2.5, sqft: 1600, situation: 'standard', notes: 'Buyer locked, appraisal ordered.',
      deadlines: [{ id: uid('dl'), label: 'Appraisal due', dueDate: futureDate(3), cleared: false }] }),
    mk(628, S3, { strategy: 'hold', stage: 'contract_title', askingPrice: 210000, price: 205000, repairs: 15000, arv: 280000, beds: 2, baths: 2, sqft: 1150, rent: 2100, taxes: 2900, insurance: 1200, situation: 'standard', notes: 'At title company, docs signed.' }),
    mk(645, S3, { strategy: 'flip', stage: 'closed', askingPrice: 175000, price: 172000, repairs: 46000, arv: 315000, beds: 3, baths: 2, sqft: 1500, situation: 'standard', notes: 'Closed and flipped, sold to owner-occupant.' }),
    mk(660, S3, { strategy: 'hold', stage: 'closed', askingPrice: 195000, price: 188000, repairs: 20000, arv: 260000, beds: 3, baths: 2, sqft: 1420, rent: 2050, taxes: 2700, insurance: 1150, situation: 'standard', loanType: 'conventional', loanRate: 7.25, loanTermYears: 30, downPct: 25, notes: 'Rented, cash flowing nicely.',
      renovation: { contractor: 'Fells Point Builders', nextMilestone: 'Punch list', budget: 20000, spent: 18500, lineItems: [{ id: uid('li'), name: 'Kitchen', status: 'done', cost: 9000 }, { id: uid('li'), name: 'Baths', status: 'done', cost: 6500 }, { id: uid('li'), name: 'Paint & flooring', status: 'active', cost: 3000 }] } }),

    mk(5511, S4, { strategy: 'brrrr', stage: 'closed', askingPrice: 230000, price: 222000, repairs: 35000, arv: 340000, beds: 4, baths: 2.5, sqft: 1900, rent: 2400, taxes: 3400, insurance: 1300, situation: 'standard', loanType: 'hard', loanRate: 10.5, loanPoints: 2, loanTermYears: 1, downPct: 10, notes: 'Refinanced into a 30-yr conventional after rehab.',
      renovation: { contractor: 'Govans Restoration Co.', nextMilestone: 'Final inspection', budget: 35000, spent: 37500, lineItems: [{ id: uid('li'), name: 'Roof', status: 'done', cost: 12000 }, { id: uid('li'), name: 'HVAC', status: 'done', cost: 9500 }, { id: uid('li'), name: 'Kitchen', status: 'active', cost: 11000 }, { id: uid('li'), name: 'Landscaping', status: 'pending', cost: 5000 }] } }),
    mk(5529, S4, { strategy: 'wholesale', stage: 'research_lead', askingPrice: 140000, price: 140000, repairs: 33000, arv: 250000, beds: 3, baths: 2, sqft: 1450, situation: 'vacant', owner: 'Patricia Snow', ownerPhone: '(410) 555-0191', notes: 'Driving for dollars find, overgrown yard.' }),
    mk(5548, S4, { strategy: 'flip', stage: 'contact_lead', askingPrice: 175000, price: 175000, repairs: 40000, arv: 300000, beds: 4, baths: 2, sqft: 1750, situation: 'standard', owner: 'Harold Jennings', ownerPhone: '(410) 555-0155', ownerEmail: 'harold.jennings@example.com', notes: 'Left voicemail, texted follow-up.' }),
  ];

  return list;
}

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const LENDER_BENCH_SEED = [
  { id: uid('len'), name: 'Redline Capital Partners', type: 'Hard Money', rate: 11.0, points: 2, maxLTV: 80, contact: 'Dana Ruiz — (410) 555-0301', email: 'dana@example.com' },
  { id: uid('len'), name: 'Harborview Private Lending', type: 'Hard Money', rate: 10.5, points: 2.5, maxLTV: 75, contact: 'Cole Whitman — (410) 555-0322', email: 'cole@example.com' },
  { id: uid('len'), name: 'First Chesapeake Bank', type: 'Conventional', rate: 7.1, points: 0.5, maxLTV: 80, contact: 'Priya Nair — (410) 555-0356', email: 'priya@example.com' },
  { id: uid('len'), name: 'Crabtown Community Credit Union', type: 'DSCR', rate: 8.2, points: 1, maxLTV: 75, contact: 'Sam Okafor — (410) 555-0388', email: 'sam@example.com' },
];

const ACTIVE_LOANS_SEED = [
  { id: uid('loan'), lender: 'Redline Capital Partners', propertyAddr: '3221 Belair Road', amount: 82000, rate: 11.0, term: '12 mo IO', status: 'Active' },
  { id: uid('loan'), lender: 'First Chesapeake Bank', propertyAddr: '660 S Broadway', amount: 141000, rate: 7.25, term: '30 yr', status: 'Active' },
  { id: uid('loan'), lender: 'Harborview Private Lending', propertyAddr: '5511 York Road', amount: 199800, rate: 10.5, term: '12 mo IO', status: 'Refinanced' },
];

const OFFERS_LOG_SEED = [];

/* ============================================================
   SHEET B — Realtor reference data & seed board (Session 2)
   ============================================================ */

const LEAD_STAGES = [
  { key: 'new_lead',      label: 'New Lead' },
  { key: 'contacted',     label: 'Contacted' },
  { key: 'appt_set',      label: 'Appt Set' },
  { key: 'active_client', label: 'Active Client' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'closed',        label: 'Closed' },
];
const LEAD_STAGE_INDEX = Object.fromEntries(LEAD_STAGES.map((s, i) => [s.key, i]));

// How many days out the next follow-up gets set to when a lead advances a stage —
// the funnel tightens the closer someone gets to closing.
const LEAD_FOLLOWUP_DAYS = {
  new_lead: 3, contacted: 3, appt_set: 2, active_client: 2, under_contract: 1, closed: 30,
};

const CONTRACT_MILESTONES = [
  { key: 'accepted',       label: 'Accepted' },
  { key: 'emd_in',         label: 'EMD In' },
  { key: 'inspection',     label: 'Inspection' },
  { key: 'appraisal',      label: 'Appraisal' },
  { key: 'clear_to_close', label: 'Clear to Close' },
  { key: 'settlement',     label: 'Settlement' },
];

function freshMilestones() {
  return CONTRACT_MILESTONES.map(m => ({ key: m.key, done: false }));
}

function uidLead() { return uid('lead'); }

function seedLead(overrides) {
  const base = {
    id: uidLead(),
    name: '', role: 'buyer', source: 'Referral',
    stage: 'new_lead',
    phone: '', email: '', budget: 0, area: '', loanStatus: 'Not started',
    followUpDate: futureDate(LEAD_FOLLOWUP_DAYS.new_lead),
    notes: '',
    activityLog: [], outreachLog: [],
    createdAt: Date.now(),
  };
  return Object.assign(base, overrides);
}

function buildSeedLeads() {
  return [
    seedLead({ name: 'Jamal Whitfield', role: 'buyer', source: 'Zillow', stage: 'new_lead', phone: '(410) 555-0210', email: 'jamal.whitfield@example.com', budget: 320000, area: 'Hampden / Remington', loanStatus: 'Not started', followUpDate: futureDate(2), notes: 'First-time buyer, wants a fixer-upper.' }),
    seedLead({ name: 'Priya Adams', role: 'seller', source: 'Past Client Referral', stage: 'contacted', phone: '(410) 555-0221', email: 'priya.adams@example.com', budget: 0, area: 'Canton', loanStatus: 'N/A', followUpDate: futureDate(1), notes: 'Downsizing, wants to list by spring.' }),
    seedLead({ name: 'Devon Marsh', role: 'buyer', source: 'Open House', stage: 'appt_set', phone: '(410) 555-0233', email: 'devon.marsh@example.com', budget: 275000, area: 'Hamilton', loanStatus: 'Pre-approved', followUpDate: futureDate(1), notes: 'Showing Saturday 10am.' }),
    seedLead({ name: 'Renee Castillo', role: 'buyer', source: 'Facebook Ad', stage: 'active_client', phone: '(410) 555-0247', email: 'renee.castillo@example.com', budget: 410000, area: 'Federal Hill', loanStatus: 'Pre-approved', followUpDate: futureDate(2), notes: 'Made two offers, both lost. Adjusting budget.' }),
    seedLead({ name: 'Terrence Fields', role: 'seller', source: 'Referral', stage: 'under_contract', phone: '(410) 555-0258', email: 'terrence.fields@example.com', budget: 0, area: 'Roland Park', loanStatus: 'N/A', followUpDate: futureDate(1), notes: 'Under contract, closing in 3 weeks.' }),
    seedLead({ name: 'Alicia Byrne', role: 'buyer', source: 'Google', stage: 'contacted', phone: '(410) 555-0264', email: 'alicia.byrne@example.com', budget: 250000, area: 'Belair-Edison', loanStatus: 'In process', followUpDate: futureDate(0), notes: 'Waiting on pre-approval letter.' }),
    seedLead({ name: 'Marcus Webb', role: 'buyer', source: 'Sign Call', stage: 'new_lead', phone: '(410) 555-0118', email: 'marcus.webb@example.com', budget: 245000, area: 'Greenmount West', loanStatus: 'Not started', followUpDate: futureDate(-1), notes: 'Left a voicemail, no callback yet.' }),
    seedLead({ name: 'Sandra Okafor', role: 'seller', source: 'Referral', stage: 'appt_set', phone: '(410) 555-0388', email: 'sandra.okafor@example.com', budget: 0, area: 'Govans', loanStatus: 'N/A', followUpDate: futureDate(3), notes: 'Listing consult booked.' }),
  ];
}

function seedListing(overrides) {
  const base = {
    id: uid('list'),
    address: '', price: 0, status: 'active', listDate: todayISO(),
    marketingChecklist: [
      { id: uidShort(), label: 'Professional photos', done: false },
      { id: uidShort(), label: 'Yard sign installed', done: false },
      { id: uidShort(), label: 'MLS listing live', done: false },
      { id: uidShort(), label: 'Social media post', done: false },
      { id: uidShort(), label: 'Brochure / flyer', done: false },
      { id: uidShort(), label: 'Open house scheduled', done: false },
    ],
    showings: [],
  };
  return Object.assign(base, overrides);
}

function buildSeedListings() {
  return [
    seedListing({ address: '2210 Eastern Ave', price: 289000, status: 'active', listDate: futureDate(-12),
      marketingChecklist: [
        { id: uidShort(), label: 'Professional photos', done: true },
        { id: uidShort(), label: 'Yard sign installed', done: true },
        { id: uidShort(), label: 'MLS listing live', done: true },
        { id: uidShort(), label: 'Social media post', done: false },
        { id: uidShort(), label: 'Brochure / flyer', done: false },
        { id: uidShort(), label: 'Open house scheduled', done: true },
      ],
      showings: [{ id: uidShort(), date: futureDate(-3), buyerName: 'Devon Marsh', feedback: 'Loved the kitchen, worried about street parking.' }] }),
    seedListing({ address: '4417 Roland Ave', price: 615000, status: 'active', listDate: futureDate(-5),
      marketingChecklist: [
        { id: uidShort(), label: 'Professional photos', done: true },
        { id: uidShort(), label: 'Yard sign installed', done: true },
        { id: uidShort(), label: 'MLS listing live', done: true },
        { id: uidShort(), label: 'Social media post', done: true },
        { id: uidShort(), label: 'Brochure / flyer', done: false },
        { id: uidShort(), label: 'Open house scheduled', done: false },
      ] }),
    seedListing({ address: '1319 Light St', price: 349000, status: 'pending', listDate: futureDate(-28),
      marketingChecklist: [
        { id: uidShort(), label: 'Professional photos', done: true },
        { id: uidShort(), label: 'Yard sign installed', done: true },
        { id: uidShort(), label: 'MLS listing live', done: true },
        { id: uidShort(), label: 'Social media post', done: true },
        { id: uidShort(), label: 'Brochure / flyer', done: true },
        { id: uidShort(), label: 'Open house scheduled', done: true },
      ] }),
    seedListing({ address: '6602 Hillen Rd', price: 219000, status: 'coming_soon', listDate: futureDate(2),
      marketingChecklist: [
        { id: uidShort(), label: 'Professional photos', done: false },
        { id: uidShort(), label: 'Yard sign installed', done: false },
        { id: uidShort(), label: 'MLS listing live', done: false },
        { id: uidShort(), label: 'Social media post', done: false },
        { id: uidShort(), label: 'Brochure / flyer', done: false },
        { id: uidShort(), label: 'Open house scheduled', done: false },
      ] }),
  ];
}

function seedContract(overrides) {
  const base = {
    id: uid('ctr'),
    address: '', buyerName: '', sellerName: '', salePrice: 0,
    commissionRatePct: 3, brokerSplitPct: 80,
    milestones: freshMilestones(),
    commissionStatus: 'pending',
    closedDate: null,
    createdAt: Date.now(),
  };
  return Object.assign(base, overrides);
}

function markMilestonesDone(count) {
  return CONTRACT_MILESTONES.map((m, i) => ({ key: m.key, done: i < count }));
}

function buildSeedContracts() {
  return [
    seedContract({ address: '1319 Light St', buyerName: 'Renee Castillo', sellerName: 'Priya Adams', salePrice: 349000, commissionRatePct: 3, brokerSplitPct: 80, milestones: markMilestonesDone(3) }),
    seedContract({ address: '918 S Ann St', buyerName: 'Terrence Fields', sellerName: 'Owner (rep. seller)', salePrice: 298000, commissionRatePct: 3, brokerSplitPct: 80, milestones: markMilestonesDone(5) }),
    seedContract({ address: '3708 Elm Ave', buyerName: 'Kevin Ortiz', sellerName: 'Marta Ellison', salePrice: 262000, commissionRatePct: 2.5, brokerSplitPct: 75, milestones: markMilestonesDone(6), commissionStatus: 'paid', closedDate: futureDate(-40) }),
    seedContract({ address: '512 Cathedral St', buyerName: 'Aisha Grant', sellerName: 'Ben Torres', salePrice: 455000, commissionRatePct: 3, brokerSplitPct: 80, milestones: markMilestonesDone(6), commissionStatus: 'paid', closedDate: futureDate(-15) }),
  ];
}

function seedReferral(overrides) {
  const base = {
    id: uid('ref'),
    name: '', phone: '', email: '', lastTouch: todayISO(), nextTouchDate: futureDate(90), notes: '',
  };
  return Object.assign(base, overrides);
}

function buildSeedReferrals() {
  return [
    seedReferral({ name: 'Kevin Ortiz', phone: '(410) 555-0301', email: 'kevin.ortiz@example.com', lastTouch: futureDate(-40), nextTouchDate: futureDate(5), notes: 'Closed last spring, loves referring coworkers.' }),
    seedReferral({ name: 'Aisha Grant', phone: '(410) 555-0312', email: 'aisha.grant@example.com', lastTouch: futureDate(-70), nextTouchDate: futureDate(-2), notes: 'Anniversary of closing is next month — send a gift.' }),
    seedReferral({ name: 'Marta Ellison', phone: '(410) 555-0329', email: 'marta.ellison@example.com', lastTouch: futureDate(-100), nextTouchDate: futureDate(20), notes: 'Sold her rowhouse, still a fan.' }),
    seedReferral({ name: 'Ben Torres', phone: '(410) 555-0341', email: 'ben.torres@example.com', lastTouch: futureDate(-15), nextTouchDate: futureDate(60), notes: 'Just closed on Cathedral St.' }),
  ];
}

/* ============================================================
   SHEET C — Operations reference data (Session 2)
   ============================================================ */

function buildSeedDocuments() {
  return [];
}
