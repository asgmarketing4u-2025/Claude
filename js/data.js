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

const HOUSE_IMAGES = Array.from({ length: 15 }, (_, i) => `images/house-${String(i + 1).padStart(2, '0')}.svg`);

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
