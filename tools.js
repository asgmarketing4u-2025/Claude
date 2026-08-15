/* ============================================================
   NTM DEAL CENTER — AC's tools
   Defined ONCE here, shared by:
     - api/ask.js — passed to the Anthropic Messages API as `tools`
       (Claude decides which one to call and with what arguments).
     - js/igor-actions.js — reads TOOL_DEFS to know each tool's shape
       and TOOL_META to know whether it's safe to run in Demo Mode.

   Every "*Match" argument is a loose text description of an existing
   record (an address, a name) — js/igor-actions.js resolves it with
   fuzzy matching against the board and asks "which one?" if more than
   one record matches closely enough.
   ============================================================ */

const TOOL_DEFS = [
  {
    name: 'add_property',
    description: 'Add a new property to the Pipeline (Sheet A) as a Research Lead.',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Street address, required.' },
        city: { type: 'string' }, state: { type: 'string' }, zip: { type: 'string' },
        strategy: { type: 'string', enum: ['wholesale', 'flip', 'hold', 'brrrr'] },
        situation: { type: 'string', enum: ['standard', 'foreclosure', 'vacant'] },
        askingPrice: { type: 'number', description: 'In dollars, e.g. 152000 (spoken shorthand like "152" for a house means 152000).' },
        repairs: { type: 'number' },
        arv: { type: 'number' },
        owner: { type: 'string' }, ownerPhone: { type: 'string' }, ownerEmail: { type: 'string' },
      },
      required: ['address'],
    },
  },
  {
    name: 'move_property',
    description: 'Move an existing property to a different Pipeline stage.',
    input_schema: {
      type: 'object',
      properties: {
        propertyMatch: { type: 'string', description: 'Address or partial address of the property.' },
        stage: { type: 'string', description: 'Target stage label or key, e.g. "Make Offer" or "make_offer".' },
      },
      required: ['propertyMatch', 'stage'],
    },
  },
  {
    name: 'update_property',
    description: 'Update a single field on an existing property (asking price, repairs, ARV, notes, owner contact, etc).',
    input_schema: {
      type: 'object',
      properties: {
        propertyMatch: { type: 'string', description: 'Address or partial address of the property.' },
        field: { type: 'string', enum: ['askingPrice', 'repairs', 'arv', 'notes', 'owner', 'ownerPhone', 'ownerEmail', 'beds', 'baths', 'sqft'] },
        value: { description: 'New value. Money fields accept spoken shorthand ("152" = 152000).' },
      },
      required: ['propertyMatch', 'field', 'value'],
    },
  },
  {
    name: 'add_lead',
    description: 'Add a new buyer or seller lead to the realtor Lead Pipeline (Sheet B).',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role: { type: 'string', enum: ['buyer', 'seller'] },
        area: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'move_lead',
    description: 'Move an existing lead to a different stage in the Lead Pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        leadMatch: { type: 'string', description: 'Name (or partial name) of the lead.' },
        stage: { type: 'string', description: 'Target stage label or key, e.g. "Contacted" or "contacted".' },
      },
      required: ['leadMatch', 'stage'],
    },
  },
  {
    name: 'log_touch',
    description: 'Log an outreach touch with a lead and reschedule their next follow-up automatically.',
    input_schema: {
      type: 'object',
      properties: {
        leadMatch: { type: 'string' },
        channel: { type: 'string', enum: ['call', 'text', 'email'] },
      },
      required: ['leadMatch'],
    },
  },
  {
    name: 'schedule_showing',
    description: 'Schedule a showing for a listing (Sheet B, Listings & Showings).',
    input_schema: {
      type: 'object',
      properties: {
        listingMatch: { type: 'string', description: 'Address or partial address of the listing.' },
        date: { type: 'string', description: 'ISO date, e.g. 2026-08-20.' },
        buyerName: { type: 'string' },
      },
      required: ['listingMatch', 'date'],
    },
  },
  {
    name: 'complete_milestone',
    description: 'Advance a contract to its next closing milestone (Sheet B, Contracts). Only the current step can be completed.',
    input_schema: {
      type: 'object',
      properties: { contractMatch: { type: 'string', description: 'Address or partial address of the contract.' } },
      required: ['contractMatch'],
    },
  },
  {
    name: 'clear_deadline',
    description: 'Clear a deadline on a property (Sheet A, Deadlines & Offers).',
    input_schema: {
      type: 'object',
      properties: {
        propertyMatch: { type: 'string', description: 'Address or partial address of the property.' },
        deadlineLabel: { type: 'string', description: 'Label or partial label of the deadline, e.g. "inspection".' },
      },
      required: ['propertyMatch'],
    },
  },
  {
    name: 'skip_trace',
    description: 'Look up a property owner\'s name/phone/email by address (real cost per lookup via BatchData). Requires User Mode.',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, zip: { type: 'string' },
      },
      required: ['address'],
    },
  },
  {
    name: 'ghl_sync',
    description: 'Connect to, pull from, or push to the GoHighLevel CRM (Sheet A, GHL Link). Requires User Mode.',
    input_schema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['connect', 'pull', 'push'] } },
      required: ['mode'],
    },
  },
  {
    name: 'city_radar',
    description: 'Run a City Radar scan for new vacant building notices and permits (Sheet A, tab 09). Free, but still requires User Mode since it changes the board.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_board_summary',
    description: 'Read-only: get a summary of the board right now — urgent items, deal counts by stage, lead counts, upcoming deadlines. Safe to call in Demo Mode.',
    input_schema: { type: 'object', properties: {} },
  },
];

// Which tools change real data (need User Mode) vs. are pure reads (safe
// in Demo Mode). Kept as a lookup separate from the schema above so
// js/igor-actions.js can check it before ever running a tool.
const TOOL_META = {
  add_property: { mutating: true },
  move_property: { mutating: true },
  update_property: { mutating: true },
  add_lead: { mutating: true },
  move_lead: { mutating: true },
  log_touch: { mutating: true },
  schedule_showing: { mutating: true },
  complete_milestone: { mutating: true },
  clear_deadline: { mutating: true },
  skip_trace: { mutating: true },
  ghl_sync: { mutating: true },
  city_radar: { mutating: true },
  get_board_summary: { mutating: false },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOOL_DEFS, TOOL_META };
}
