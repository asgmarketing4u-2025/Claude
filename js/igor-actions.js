/* ============================================================
   NTM DEAL CENTER — AC's hands (tool execution in the browser)
   Every tool from tools.js executes here, against the real S, through
   the existing mutate() — so it saves, redraws, logs, and syncs exactly
   like a button click would. Fuzzy name-matching resolves "which
   property/lead did you mean" loosely; ambiguous matches come back to
   the chat UI as a "which one?" question instead of guessing wrong.
   ============================================================ */

/* ---------- fuzzy matching ---------- */

function normalizeForFuzzy(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fuzzyScore(query, candidateLabel) {
  const q = normalizeForFuzzy(query);
  const c = normalizeForFuzzy(candidateLabel);
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.includes(q) || q.includes(c)) return 70;
  const qTokens = q.split(' ');
  const cTokens = c.split(' ');
  const overlap = qTokens.filter(t => cTokens.includes(t)).length;
  return overlap * 20;
}

// Returns { match, ambiguous, candidates }. Ambiguous when more than one
// item scores close to the top match — the chat asks "which one?" rather
// than silently picking one.
function fuzzyFind(query, items, getLabel) {
  const scored = items.map(item => ({ item, score: fuzzyScore(query, getLabel(item)) })).filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return { match: null, ambiguous: false, candidates: [] };
  const top = scored[0];
  const contenders = scored.filter(s => s.score >= top.score - 15);
  if (contenders.length > 1) return { match: null, ambiguous: true, candidates: contenders.map(c => c.item) };
  return { match: top.item, ambiguous: false, candidates: [] };
}

function resolveStageKey(stagesArr, input) {
  if (!input) return null;
  if (stagesArr.some(s => s.key === input)) return input;
  const norm = normalizeForFuzzy(input);
  const found = stagesArr.find(s => normalizeForFuzzy(s.label) === norm) ||
    stagesArr.find(s => normalizeForFuzzy(s.label).includes(norm) || norm.includes(normalizeForFuzzy(s.label)));
  return found ? found.key : null;
}

/* ---------- spoken-money shorthand ("152" about a house = 152000) ---------- */

function expandMoneyShorthand(value) {
  const n = typeof value === 'number' ? value : parseMoney(value);
  if (n > 0 && n < 10000) return Math.round(n * 1000);
  return n;
}

/* ---------- tool handlers ---------- */

function toolAddProperty(input) {
  if (!input.address) return { ok: false, message: 'I need a street address to add a property.' };
  const snap = snapshotState();
  const p = seedProperty({
    addr: { line1: input.address, city: input.city || 'Baltimore', state: input.state || 'MD', zip: input.zip || '' },
    strategy: input.strategy || 'flip',
    situation: input.situation || 'standard',
    askingPrice: input.askingPrice != null ? expandMoneyShorthand(input.askingPrice) : 150000,
    price: input.askingPrice != null ? expandMoneyShorthand(input.askingPrice) : 150000,
    repairs: input.repairs != null ? expandMoneyShorthand(input.repairs) : 35000,
    arv: input.arv != null ? expandMoneyShorthand(input.arv) : 260000,
    owner: input.owner || '', ownerPhone: input.ownerPhone || '', ownerEmail: input.ownerEmail || '',
  });
  S.properties.push(p);
  mutate(`AC added ${input.address} to the Pipeline.`, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message: `Added ${input.address} to the Pipeline as a Research Lead.` };
}

function toolMoveProperty(input) {
  const found = fuzzyFind(input.propertyMatch, S.properties, p => p.address);
  if (found.ambiguous) return { ok: false, ambiguous: true, message: `Which one did you mean — ${found.candidates.map(p => p.address).join(', ')}?` };
  if (!found.match) return { ok: false, message: `I couldn't find a property matching "${input.propertyMatch}".` };
  const stageKey = resolveStageKey(STAGES, input.stage);
  if (!stageKey) return { ok: false, message: `I don't recognize the stage "${input.stage}".` };
  const snap = snapshotState();
  found.match.stage = stageKey;
  const label = STAGES.find(s => s.key === stageKey).label;
  mutate(`AC moved ${found.match.address} to ${label}.`, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message: `Moved ${found.match.address} to ${label}.` };
}

function toolUpdateProperty(input) {
  const found = fuzzyFind(input.propertyMatch, S.properties, p => p.address);
  if (found.ambiguous) return { ok: false, ambiguous: true, message: `Which one — ${found.candidates.map(p => p.address).join(', ')}?` };
  if (!found.match) return { ok: false, message: `I couldn't find a property matching "${input.propertyMatch}".` };
  const moneyFields = ['askingPrice', 'repairs', 'arv'];
  let value = input.value;
  if (moneyFields.includes(input.field)) value = expandMoneyShorthand(value);
  const snap = snapshotState();
  found.match[input.field] = value;
  if (input.field === 'askingPrice') found.match.price = value;
  mutate(`AC updated ${input.field} on ${found.match.address}.`, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message: `Updated ${input.field} on ${found.match.address} to ${value}.` };
}

function toolAddLead(input) {
  if (!input.name) return { ok: false, message: 'I need a name to add a lead.' };
  const snap = snapshotState();
  const l = seedLead({ name: input.name, role: input.role || 'buyer', area: input.area || '', phone: input.phone || '', email: input.email || '' });
  S.leads.push(l);
  mutate(`AC added lead ${input.name}.`, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message: `Added ${input.name} to the Lead Pipeline.` };
}

function toolMoveLead(input) {
  const found = fuzzyFind(input.leadMatch, S.leads, l => l.name);
  if (found.ambiguous) return { ok: false, ambiguous: true, message: `Which lead — ${found.candidates.map(l => l.name).join(', ')}?` };
  if (!found.match) return { ok: false, message: `I couldn't find a lead matching "${input.leadMatch}".` };
  const stageKey = resolveStageKey(LEAD_STAGES, input.stage);
  if (!stageKey) return { ok: false, message: `I don't recognize the stage "${input.stage}".` };
  const snap = snapshotState();
  found.match.stage = stageKey;
  found.match.followUpDate = futureDate(LEAD_FOLLOWUP_DAYS[stageKey] != null ? LEAD_FOLLOWUP_DAYS[stageKey] : 3);
  const label = LEAD_STAGES.find(s => s.key === stageKey).label;
  mutate(`AC moved ${found.match.name} to ${label}.`, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message: `Moved ${found.match.name} to ${label}.` };
}

function toolLogTouch(input) {
  const found = fuzzyFind(input.leadMatch, S.leads, l => l.name);
  if (found.ambiguous) return { ok: false, ambiguous: true, message: `Which lead — ${found.candidates.map(l => l.name).join(', ')}?` };
  if (!found.match) return { ok: false, message: `I couldn't find a lead matching "${input.leadMatch}".` };
  const channel = input.channel || 'call';
  const snap = snapshotState();
  found.match.outreachLog = found.match.outreachLog || [];
  found.match.outreachLog.push({ channel, ts: Date.now(), text: `Logged by AC (${channel}).` });
  found.match.followUpDate = futureDate(LEAD_FOLLOWUP_DAYS[found.match.stage] != null ? LEAD_FOLLOWUP_DAYS[found.match.stage] : 3);
  mutate(`AC logged a ${channel} touch with ${found.match.name}.`, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message: `Logged a ${channel} touch with ${found.match.name} — next follow-up ${found.match.followUpDate}.` };
}

function toolScheduleShowing(input) {
  const found = fuzzyFind(input.listingMatch, S.listings, li => li.address);
  if (found.ambiguous) return { ok: false, ambiguous: true, message: `Which listing — ${found.candidates.map(l => l.address).join(', ')}?` };
  if (!found.match) return { ok: false, message: `I couldn't find a listing matching "${input.listingMatch}".` };
  if (!input.date) return { ok: false, message: 'What date should I schedule the showing for?' };
  const snap = snapshotState();
  found.match.showings.push({ id: uidShort(), date: input.date, buyerName: input.buyerName || 'Buyer TBD', feedback: '' });
  mutate(`AC scheduled a showing at ${found.match.address} for ${input.date}.`, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message: `Scheduled a showing at ${found.match.address} on ${input.date}.` };
}

function toolCompleteMilestone(input) {
  const found = fuzzyFind(input.contractMatch, S.contracts, c => c.address);
  if (found.ambiguous) return { ok: false, ambiguous: true, message: `Which contract — ${found.candidates.map(c => c.address).join(', ')}?` };
  if (!found.match) return { ok: false, message: `I couldn't find a contract matching "${input.contractMatch}".` };
  const c = found.match;
  const doneCount = c.milestones.filter(m => m.done).length;
  if (doneCount >= CONTRACT_MILESTONES.length) return { ok: false, message: `${c.address} is already fully closed.` };
  const snap = snapshotState();
  c.milestones[doneCount].done = true;
  const nowDone = c.milestones.filter(m => m.done).length;
  let message = `Completed "${CONTRACT_MILESTONES[doneCount].label}" on ${c.address}.`;
  if (nowDone >= CONTRACT_MILESTONES.length) {
    c.commissionStatus = 'paid';
    c.closedDate = todayISO();
    message += ' That was the last step — the contract is now CLOSED and PAID.';
  }
  mutate(message, { undoSnapshot: snap, tone: 'ok' });
  return { ok: true, message };
}

function toolClearDeadline(input) {
  const found = fuzzyFind(input.propertyMatch, S.properties, p => p.address);
  if (found.ambiguous) return { ok: false, ambiguous: true, message: `Which property — ${found.candidates.map(p => p.address).join(', ')}?` };
  if (!found.match) return { ok: false, message: `I couldn't find a property matching "${input.propertyMatch}".` };
  const open = (found.match.deadlines || []).filter(d => !d.cleared);
  if (!open.length) return { ok: false, message: `${found.match.address} has no open deadlines.` };
  let dl = open[0];
  if (input.deadlineLabel) {
    const found2 = fuzzyFind(input.deadlineLabel, open, d => d.label);
    if (found2.match) dl = found2.match;
  }
  const snap = snapshotState();
  dl.cleared = true;
  mutate(`AC cleared "${dl.label}" on ${found.match.address}.`, { undoSnapshot: snap, tone: 'warn' });
  return { ok: true, message: `Cleared "${dl.label}" on ${found.match.address}.` };
}

async function toolSkipTrace(input) {
  if (!input.address) return { ok: false, message: 'I need an address to skip trace.' };
  try {
    const data = await callToolApi('/api/skiptrace', { address: input.address, city: input.city, state: input.state, zip: input.zip });
    addSkipTraceResult({ address: input.address, city: input.city, state: input.state, zip: input.zip, owner: data.owner, ownerPhone: data.ownerPhone, ownerEmail: data.ownerEmail, status: 'found' });
    mutate(`AC traced an owner for ${input.address}.`, { tone: 'ok' });
    return { ok: true, message: `Found: ${data.owner || 'name unknown'}${data.ownerPhone ? ', ' + data.ownerPhone : ''}.` };
  } catch (err) {
    const row = friendlyError('skiptrace', err);
    return { ok: false, message: `${row.title} — ${row.action}` };
  }
}

async function toolGhlSync(input) {
  const mode = input.mode || 'connect';
  try {
    if (mode === 'connect') await ghlConnect();
    else if (mode === 'pull') await ghlPull();
    else if (mode === 'push') await ghlPush();
    else return { ok: false, message: `I don't recognize the GHL mode "${mode}".` };
    return { ok: true, message: `GHL ${mode} finished.` };
  } catch (err) {
    return { ok: false, message: friendlyError('ghl', err).title };
  }
}

async function toolCityRadar() {
  const before = S.cityRadar.lastScanAt;
  await scanTheCity();
  if (S.cityRadar.lastScanAt === before) return { ok: false, message: 'The city scan failed — check the Fix-It Ledger in the footer for what to do.' };
  const s = S.cityRadar.lastScanSummary;
  return { ok: true, message: `Scanned the city — ${s.newVacants} new vacant notice(s), ${s.permitCount} recent permits over $20k.` };
}

function toolGetBoardSummary() {
  const urgent = getUrgentItems();
  const openLeads = S.leads.filter(l => l.stage !== 'closed').length;
  return {
    ok: true,
    message: `${S.properties.length} deals on the board (${urgent.length} need attention), ${openLeads} open leads.`,
  };
}

const IGOR_TOOL_HANDLERS = {
  add_property: toolAddProperty,
  move_property: toolMoveProperty,
  update_property: toolUpdateProperty,
  add_lead: toolAddLead,
  move_lead: toolMoveLead,
  log_touch: toolLogTouch,
  schedule_showing: toolScheduleShowing,
  complete_milestone: toolCompleteMilestone,
  clear_deadline: toolClearDeadline,
  skip_trace: toolSkipTrace,
  ghl_sync: toolGhlSync,
  city_radar: toolCityRadar,
  get_board_summary: toolGetBoardSummary,
};

// The one entry point the chat UI calls. Checks the Demo Mode gate BEFORE
// running anything that changes the board or spends money — a demo
// visitor asking AC to "add a lead" gets a polite redirect, never a
// silent no-op and never a real mutation.
async function runIgorTool(name, input) {
  const meta = TOOL_META[name];
  if (!meta) return { ok: false, message: `AC doesn't have a tool called "${name}".` };
  if (meta.mutating && typeof isDemoLocked === 'function' && isDemoLocked()) {
    return { ok: false, demoBlocked: true, message: "I can look things up and answer questions, but I can't change the board or spend money in Demo Mode — switch to User Mode and ask me again." };
  }
  const handler = IGOR_TOOL_HANDLERS[name];
  if (!handler) return { ok: false, message: `AC doesn't have a handler for "${name}" yet.` };
  try {
    return await handler(input || {});
  } catch (e) {
    return { ok: false, message: 'Something went wrong running that — try again.' };
  }
}
