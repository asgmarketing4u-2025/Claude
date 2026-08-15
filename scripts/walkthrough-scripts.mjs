/* ============================================================
   NTM DEAL CENTER — Film Room walkthrough scripts
   One entry per panel: its DWG code (matches the "DWG X-XX" text in
   that panel's header, which js/filmroom-ui.js reads to know which
   video goes with which WATCH button), the clicks to make it happen,
   and narration lines spoken in AC's voice (via api/tts.js) while
   each step plays.

   Consumed by scripts/record-walkthrough.mjs. Pure data — no Puppeteer
   here, so it's easy to add a new panel without touching the recorder.
   ============================================================ */

// steps[].click is a CSS selector clicked with an animated cursor move
// first. steps[].wait (ms) pads before the next step so the narration
// has room to breathe. steps[].narration is spoken over that step.
export const WALKTHROUGHS = [
  {
    dwg: 'DWG A-01', slug: 'pipeline', title: 'Pipeline',
    steps: [
      { narration: "This is your Pipeline — every deal, in one place, sorted by stage.", wait: 2000 },
      { click: '[data-action="setPipelineFilter"][data-filter="flip"]', narration: "Filter chips narrow it down by strategy — here's just the flips.", wait: 1800 },
      { click: '[data-action="setPipelineFilter"][data-filter="all"]', narration: "And back to everything.", wait: 1200 },
    ],
  },
  {
    dwg: 'DWG A-02', slug: 'deal-analyzer', title: 'Deal Analyzer',
    steps: [
      { narration: "The Deal Analyzer runs the 70% rule the second you type a number — no spreadsheet required.", wait: 2200 },
    ],
  },
  {
    dwg: 'DWG A-03', slug: 'portfolio', title: 'Portfolio & Rentals',
    steps: [{ narration: "Every rental you kept, with a real cash-flow chart behind it.", wait: 2000 }],
  },
  {
    dwg: 'DWG A-04', slug: 'financing', title: 'Financing',
    steps: [{ narration: "Your lender bench and every active loan, at a glance.", wait: 2000 }],
  },
  {
    dwg: 'DWG A-05', slug: 'renovation', title: 'Renovation',
    steps: [{ narration: "Track every reno job against budget, so nothing quietly goes over.", wait: 2000 }],
  },
  {
    dwg: 'DWG A-06', slug: 'deadlines-offers', title: 'Deadlines & Offers',
    steps: [{ narration: "Every countdown clock across every deal, in one list.", wait: 2000 }],
  },
  {
    dwg: 'DWG A-07', slug: 'skip-trace', title: 'Skip Trace',
    steps: [{ narration: "Type an address, get an owner's name and number — or run a whole CSV at once.", wait: 2200 }],
  },
  {
    dwg: 'DWG A-08', slug: 'ghl-link', title: 'GHL Link',
    steps: [{ narration: "Connect once, and your board and your CRM stay in sync both ways.", wait: 2000 }],
  },
  {
    dwg: 'DWG A-09', slug: 'city-radar', title: 'City Radar',
    steps: [{ narration: "Free distressed-property leads, straight from the city's own records — no key needed.", wait: 2200 }],
  },
  {
    dwg: 'DWG A-10', slug: 'court-radar', title: 'Court Radar',
    steps: [{ narration: "Owners weeks from foreclosure, flagged straight from the federal docket.", wait: 2000 }],
  },
  {
    dwg: 'DWG B-01', slug: 'lead-pipeline', title: 'Lead Pipeline',
    steps: [{ narration: "Every buyer and seller lead, with follow-ups that tighten automatically as they heat up.", wait: 2200 }],
  },
  {
    dwg: 'DWG B-02', slug: 'listings-showings', title: 'Listings & Showings',
    steps: [{ narration: "A marketing checklist per listing, and showings that schedule their own follow-up.", wait: 2200 }],
  },
  {
    dwg: 'DWG B-03', slug: 'contracts', title: 'Contracts',
    steps: [{ narration: "Six milestones to closing — only the current step is ever clickable, so nothing gets skipped.", wait: 2200 }],
  },
  {
    dwg: 'DWG B-04', slug: 'commissions', title: 'Commissions',
    steps: [{ narration: "Your gross, your split, your net — masked until you click to see it.", wait: 2000 }],
  },
  {
    dwg: 'DWG B-05', slug: 'followups-marketing', title: 'Follow-ups & Marketing',
    steps: [{ narration: "Everyone owed a touch today, with a personalized message already written.", wait: 2000 }],
  },
  {
    dwg: 'DWG B-06', slug: 'referrals', title: 'Referrals',
    steps: [{ narration: "Your past clients are your best lead source — this keeps you from letting them go quiet.", wait: 2200 }],
  },
  {
    dwg: 'DWG C-01', slug: 'daily-briefing', title: 'Daily Briefing',
    steps: [{ narration: "Built fresh every time you open it — exactly what needs you today, ranked P1 to P3.", wait: 2200 }],
  },
  {
    dwg: 'DWG C-02', slug: 'weekly-report', title: 'Weekly Report',
    steps: [{ narration: "This week's numbers, written up in plain English, ready to copy and send.", wait: 2000 }],
  },
  {
    dwg: 'DWG C-03', slug: 'data-intake', title: 'Data Intake',
    steps: [{ narration: "Drop in a CSV of contacts or properties — loose column matching means it just works.", wait: 2200 }],
  },
  {
    dwg: 'DWG C-04', slug: 'vault-sharing', title: 'Vault & Sharing',
    steps: [{ narration: "Snapshots, share links, backups, and Lab Link cloud sync — all your safety nets in one place.", wait: 2200 }],
  },
];
