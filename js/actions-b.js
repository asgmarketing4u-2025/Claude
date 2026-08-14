/* ============================================================
   NTM DEAL CENTER — Sheet B actions (Realtor)
   Extends the existing ACTIONS dispatch table and click-driven
   modal system from actions.js — same patterns, new handlers.
   ============================================================ */

let currentLeadDraftId = null;
let currentLeadDraftTab = 'call';

/* ---------- outreach copy: buyer/seller aware ---------- */

function buildLeadOutreach(l) {
  const name = firstName(l.name);
  const addr = l.area || 'your area';
  const isBuyer = l.role === 'buyer';

  let hook, pitch;
  if (isBuyer) {
    const loanNote = l.loanStatus === 'Pre-approved'
      ? "You're pre-approved, so the second the right place hits the market, we can move fast."
      : l.loanStatus === 'In process'
        ? 'Once your pre-approval clears, we can move the moment the right place shows up.'
        : "Getting you pre-approved first means we won't be scrambling when the right place shows up.";
    hook = `Checking in on your search in ${addr}${l.budget ? ` around ${fmtMoney(l.budget)}` : ''}.`;
    pitch = loanNote;
  } else {
    hook = `Checking in on your plans for your place in ${addr}.`;
    pitch = "Whenever you're ready, I can walk you through what it would likely sell for right now and what it'd take to get it market-ready.";
  }

  const callScript = [
    `Hi ${name}, this is calling to check in — got two minutes?`,
    hook,
    `(Listen first. Ask: "Has anything changed since we last talked?" and "What would make the next step easy for you?")`,
    pitch,
    `Want to grab 15 minutes this week to go over next steps?`,
  ].join('\n\n');

  const voicemail = `Hi ${name}, just checking in — ${hook} Give me a call back whenever's good, no rush. Talk soon.`;
  const text = `Hi ${name}! ${hook} ${pitch} Let me know if you want to catch up this week.`;
  const email = `Subject: Checking in\n\nHi ${name},\n\n${hook}\n\n${pitch}\n\nWould a quick call this week work? Happy to work around your schedule.\n\nTalk soon,\n${S.meta.brand}`;

  return { callScript, voicemail, text, email };
}

function buildMarketingPlan(listing) {
  return {
    launch: [
      'Professional photos & measurements scheduled',
      'MLS listing drafted and reviewed with seller',
      'Yard sign + lockbox installed',
      'Launch post across social channels',
      'Notify personal buyer/agent network',
    ],
    pressure: [
      'Open house weekend 1',
      'Follow up with every showing for feedback',
      'Boosted social post + retarget ad',
      'Price check against new comps',
      'Email blast to local agent network',
    ],
    convert: [
      'Second open house if still active',
      'Direct outreach to agents who showed it',
      'Price/terms conversation with seller if needed',
      'Highlight urgency (days on market, comps) in listing copy',
      'Push hardest for an accepted offer by week 3',
    ],
  };
}

/* ---------- new ACTIONS ---------- */

Object.assign(ACTIONS, {
  gotoLeadPipeline() { S.meta.activeSheet = 'B'; S.meta.activeSubtabB = '01'; persistView(); },
  setSubtabB(el) { S.meta.activeSubtabB = el.dataset.subtab; persistView(); },
  setLeadFilter(el) { S.filters.leadPipeline = el.dataset.filter; persistView(); },

  openNewLeadModal() { openNewLeadModal(); },
  createLead() { createLead(); },

  advanceLeadStage(el) {
    const l = getLead(el.dataset.leadId);
    if (!l) return;
    const idx = LEAD_STAGE_INDEX[l.stage];
    const next = LEAD_STAGES[Math.min(idx + 1, LEAD_STAGES.length - 1)];
    const snap = snapshotState();
    l.stage = next.key;
    l.followUpDate = futureDate(LEAD_FOLLOWUP_DAYS[next.key] != null ? LEAD_FOLLOWUP_DAYS[next.key] : 3);
    mutate(`Advanced ${l.name} to ${next.label} — next follow-up ${l.followUpDate}.`, { undoSnapshot: snap, tone: 'ok' });
    followLeadCard(l.id);
  },
  moveLeadStage(el) {
    const card = el.closest('.lead-card');
    if (!card) return;
    const l = getLead(card.dataset.leadId);
    if (!l) return;
    const stage = LEAD_STAGES.find(s => s.key === el.dataset.stage);
    if (!stage) return;
    const snap = snapshotState();
    l.stage = stage.key;
    l.followUpDate = futureDate(LEAD_FOLLOWUP_DAYS[stage.key] != null ? LEAD_FOLLOWUP_DAYS[stage.key] : 3);
    closeAllMoveMenus();
    mutate(`Moved ${l.name} to ${stage.label}.`, { undoSnapshot: snap, tone: 'ok' });
    followLeadCard(l.id);
  },

  openLeadDraftModal(el) { openLeadDraftModal(el.dataset.leadId); },
  switchLeadDraftTab(el) { currentLeadDraftTab = el.dataset.channel; renderLeadDraftModalContent(); },
  copyAndLogLeadTouch(el) { copyAndLogLeadTouch(el.dataset.channel); },

  openNewListingModal() { openNewListingModal(); },
  createListing() { createListing(); },
  toggleMarketingItem(el) {
    const li = getListing(el.dataset.listingId);
    if (!li) return;
    const item = li.marketingChecklist.find(c => c.id === el.dataset.itemId);
    if (!item) return;
    item.done = !item.done;
    mutate(`Marked "${item.label}" ${item.done ? 'done' : 'not done'} on ${li.address}.`, { silent: true });
  },
  openScheduleShowingModal(el) { openScheduleShowingModal(el.dataset.listingId); },
  createShowing() { createShowing(); },
  openLogFeedbackModal(el) { openLogFeedbackModal(el.dataset.listingId, el.dataset.showingId); },
  saveFeedback() { saveFeedback(); },
  openMarketingPlanModal(el) { openMarketingPlanModal(el.dataset.listingId); },

  openNewContractModal() { openNewContractModal(); },
  createContract() { createContract(); },
  advanceContractMilestone(el) {
    const c = getContract(el.dataset.contractId);
    if (!c) return;
    const idx = Number(el.dataset.milestoneIndex);
    const doneCount = c.milestones.filter(m => m.done).length;
    if (idx !== doneCount) return; // only the current pulsing dot is clickable
    const snap = snapshotState();
    c.milestones[idx].done = true;
    const nowDone = c.milestones.filter(m => m.done).length;
    let msg = `Marked "${CONTRACT_MILESTONES[idx].label}" done on ${c.address}.`;
    if (nowDone >= CONTRACT_MILESTONES.length) {
      c.commissionStatus = 'paid';
      c.closedDate = todayISO();
      msg = `${c.address} is CLOSED — commission marked PAID.`;
    }
    mutate(msg, { undoSnapshot: snap, tone: 'ok' });
  },

  toggleRevealAmount(el) {
    const id = el.dataset.amountId;
    if (revealedAmounts.has(id)) revealedAmounts.delete(id); else revealedAmounts.add(id);
    persistView();
  },

  openNewReferralModal() { openNewReferralModal(); },
  createReferral() { createReferral(); },
  logReferralTouch(el) {
    const r = getReferral(el.dataset.referralId);
    if (!r) return;
    r.lastTouch = todayISO();
    r.nextTouchDate = futureDate(90);
    mutate(`Logged a touch with ${r.name} — next touch in 90 days.`, { tone: 'ok' });
  },
});

function followLeadCard(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById('lead-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('card--flash');
    setTimeout(() => el.classList.remove('card--flash'), 2500);
  });
}

/* ---------- New Lead modal ---------- */

function openNewLeadModal() {
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ NEW LEAD</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">NAME *</span><input type="text" id="nlLeadName" placeholder="Jane Smith"></label>
            <label class="field"><span class="field__label">ROLE</span><select id="nlLeadRole"><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label>
            <label class="field"><span class="field__label">SOURCE</span><input type="text" id="nlLeadSource" placeholder="Referral, Zillow, sign call..."></label>
            <label class="field"><span class="field__label">FOLLOW-UP DATE</span><input type="date" id="nlLeadFollowUp" value="${futureDate(3)}"></label>
            <label class="field"><span class="field__label">PHONE</span><input type="tel" id="nlLeadPhone" placeholder="(410) 555-0100"></label>
            <label class="field"><span class="field__label">EMAIL</span><input type="email" id="nlLeadEmail" placeholder="jane@example.com"></label>
            <label class="field"><span class="field__label">BUDGET (BUYER)</span><input type="text" inputmode="numeric" id="nlLeadBudget" placeholder="300,000"></label>
            <label class="field"><span class="field__label">AREA</span><input type="text" id="nlLeadArea" placeholder="Canton, Hampden..."></label>
            <label class="field"><span class="field__label">LOAN STATUS</span>
              <select id="nlLeadLoan"><option>Not started</option><option>In process</option><option>Pre-approved</option><option>Cash</option><option>N/A</option></select>
            </label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createLead">ADD LEAD</button>
        </div>
      </div>
    </div>`);
  const budget = document.getElementById('nlLeadBudget');
  if (budget) attachMoneyInput(budget);
}

function createLead() {
  const name = document.getElementById('nlLeadName').value.trim();
  if (!name) { showToast('Name is required.', { tone: 'danger' }); return; }
  const l = seedLead({
    name,
    role: document.getElementById('nlLeadRole').value,
    source: document.getElementById('nlLeadSource').value.trim() || 'Other',
    followUpDate: document.getElementById('nlLeadFollowUp').value || futureDate(3),
    phone: document.getElementById('nlLeadPhone').value.trim(),
    email: document.getElementById('nlLeadEmail').value.trim(),
    budget: parseMoney(document.getElementById('nlLeadBudget').value),
    area: document.getElementById('nlLeadArea').value.trim(),
    loanStatus: document.getElementById('nlLeadLoan').value,
  });
  S.leads.push(l);
  closeModal();
  mutate(`Added new lead: ${name}.`, { tone: 'ok' });
  followLeadCard(l.id);
}

/* ---------- Lead DRAFT modal ---------- */

function openLeadDraftModal(leadId) {
  currentLeadDraftId = leadId;
  currentLeadDraftTab = 'call';
  renderLeadDraftModalContent();
}

function renderLeadDraftModalContent() {
  const l = getLead(currentLeadDraftId);
  if (!l) { closeModal(); return; }
  const outreach = buildLeadOutreach(l);
  const tabs = [{ key: 'call', label: 'CALL' }, { key: 'text', label: 'TEXT' }, { key: 'email', label: 'EMAIL' }];
  const tabsHTML = tabs.map(t => `<button type="button" class="draft-tab ${currentLeadDraftTab === t.key ? 'is-active' : ''}" data-action="switchLeadDraftTab" data-channel="${t.key}">${t.label}</button>`).join('');
  let body;
  if (currentLeadDraftTab === 'call') body = `<div class="draft-copy"><h4>CALL SCRIPT</h4><pre>${escapeHtml(outreach.callScript)}</pre><h4>VOICEMAIL</h4><pre>${escapeHtml(outreach.voicemail)}</pre></div>`;
  else if (currentLeadDraftTab === 'text') body = `<div class="draft-copy"><h4>TEXT MESSAGE</h4><pre>${escapeHtml(outreach.text)}</pre></div>`;
  else body = `<div class="draft-copy"><h4>EMAIL</h4><pre>${escapeHtml(outreach.email)}</pre></div>`;

  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>DRAFT — ${escapeHtml(l.name)}</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="draft-tabs">${tabsHTML}</div>
        <div class="modal__body">${body}</div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CLOSE</button>
          <button type="button" class="btn btn--stamp" data-action="copyAndLogLeadTouch" data-channel="${currentLeadDraftTab}">COPY & LOG TOUCH</button>
        </div>
      </div>
    </div>`);
}

function copyAndLogLeadTouch(channel) {
  const l = getLead(currentLeadDraftId);
  if (!l) return;
  const outreach = buildLeadOutreach(l);
  const map = { call: outreach.callScript, text: outreach.text, email: outreach.email };
  const payload = map[channel] || '';
  const logIt = () => {
    l.outreachLog.push({ channel, ts: Date.now(), text: payload });
    l.followUpDate = futureDate(LEAD_FOLLOWUP_DAYS[l.stage] != null ? LEAD_FOLLOWUP_DAYS[l.stage] : 3);
    closeModal();
    mutate(`Copied & logged a ${channel} touch with ${l.name} — next follow-up ${l.followUpDate}.`, { tone: 'ok' });
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(logIt).catch(logIt);
  else logIt();
}

/* ---------- New Listing modal ---------- */

function openNewListingModal() {
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ NEW LISTING</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">ADDRESS *</span><input type="text" id="nlListAddr" placeholder="123 Main St"></label>
            <label class="field"><span class="field__label">PRICE</span><input type="text" inputmode="numeric" id="nlListPrice" placeholder="350,000"></label>
            <label class="field"><span class="field__label">STATUS</span><select id="nlListStatus"><option value="coming_soon">Coming Soon</option><option value="active" selected>Active</option><option value="pending">Pending</option><option value="sold">Sold</option></select></label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createListing">ADD LISTING</button>
        </div>
      </div>
    </div>`);
  const price = document.getElementById('nlListPrice');
  if (price) attachMoneyInput(price);
}

function createListing() {
  const address = document.getElementById('nlListAddr').value.trim();
  if (!address) { showToast('Address is required.', { tone: 'danger' }); return; }
  const li = seedListing({
    address,
    price: parseMoney(document.getElementById('nlListPrice').value),
    status: document.getElementById('nlListStatus').value,
    listDate: todayISO(),
  });
  S.listings.push(li);
  closeModal();
  mutate(`Added new listing: ${address}.`, { tone: 'ok' });
}

/* ---------- Schedule Showing modal ---------- */

function openScheduleShowingModal(listingId) {
  const li = getListing(listingId);
  if (!li) return;
  const leadOptions = S.leads.filter(l => l.role === 'buyer').map(l => `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`).join('');
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>SCHEDULE SHOWING — ${escapeHtml(li.address)}</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">BUYER NAME</span><input type="text" id="ssBuyer" list="ssBuyerList" placeholder="Pick or type a name"><datalist id="ssBuyerList">${leadOptions}</datalist></label>
            <label class="field"><span class="field__label">DATE</span><input type="date" id="ssDate" value="${futureDate(2)}"></label>
            <label class="field"><span class="field__label">FOLLOW UP (DAYS AFTER)</span><input type="number" id="ssFollowUpDays" value="1" min="0"></label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createShowing" data-listing-id="${li.id}">SCHEDULE</button>
        </div>
      </div>
    </div>`);
}

function createShowing() {
  const btn = document.querySelector('[data-action="createShowing"]');
  const listingId = btn ? btn.dataset.listingId : null;
  const li = getListing(listingId);
  if (!li) return;
  const buyerName = document.getElementById('ssBuyer').value.trim() || 'Prospect';
  const date = document.getElementById('ssDate').value || futureDate(2);
  const followUpDays = Number(document.getElementById('ssFollowUpDays').value) || 1;
  li.showings.push({ id: uidShort(), date, buyerName, feedback: '' });
  const lead = S.leads.find(l => l.name === buyerName);
  if (lead) lead.followUpDate = futureDate(followUpDays);
  closeModal();
  mutate(`Scheduled a showing at ${li.address} for ${buyerName}.`, { tone: 'ok' });
}

function openLogFeedbackModal(listingId, showingId) {
  const li = getListing(listingId);
  if (!li) return;
  const sh = li.showings.find(s => s.id === showingId);
  if (!sh) return;
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>LOG FEEDBACK — ${escapeHtml(sh.buyerName)}</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <label class="field field--wide"><span class="field__label">WHAT DID THEY SAY?</span><input type="text" id="lfText" placeholder="Loved the kitchen, thought the yard was small..."></label>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="saveFeedback" data-listing-id="${li.id}" data-showing-id="${sh.id}">SAVE</button>
        </div>
      </div>
    </div>`);
}

function saveFeedback() {
  const btn = document.querySelector('[data-action="saveFeedback"]');
  const li = getListing(btn.dataset.listingId);
  if (!li) return;
  const sh = li.showings.find(s => s.id === btn.dataset.showingId);
  if (!sh) return;
  sh.feedback = document.getElementById('lfText').value.trim() || 'No specific feedback given.';
  closeModal();
  mutate(`Logged showing feedback at ${li.address}.`, { tone: 'ok' });
}

function openMarketingPlanModal(listingId) {
  const li = getListing(listingId);
  if (!li) return;
  const plan = buildMarketingPlan(li);
  const section = (title, items) => `<h4>${title}</h4><ul class="reno-items">${items.map(i => `<li class="reno-item reno-item--pending"><span class="reno-item__dot"></span> ${escapeHtml(i)}</li>`).join('')}</ul>`;
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>3-WEEK MARKETING PLAN — ${escapeHtml(li.address)}</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          ${section('WEEK 1 — LAUNCH', plan.launch)}
          ${section('WEEK 2 — PRESSURE', plan.pressure)}
          ${section('WEEK 3 — CONVERT', plan.convert)}
        </div>
        <div class="modal__foot"><button type="button" class="btn btn--stamp" data-action="closeModal">CLOSE</button></div>
      </div>
    </div>`);
}

/* ---------- New Contract modal ---------- */

function openNewContractModal() {
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ NEW CONTRACT</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">ADDRESS *</span><input type="text" id="ncAddr" placeholder="123 Main St"></label>
            <label class="field"><span class="field__label">BUYER</span><input type="text" id="ncBuyer" placeholder="Buyer name"></label>
            <label class="field"><span class="field__label">SELLER</span><input type="text" id="ncSeller" placeholder="Seller name"></label>
            <label class="field"><span class="field__label">SALE PRICE</span><input type="text" inputmode="numeric" id="ncPrice" placeholder="300,000"></label>
            <label class="field"><span class="field__label">COMMISSION RATE %</span><input type="number" step="0.1" id="ncRate" value="3"></label>
            <label class="field"><span class="field__label">BROKER SPLIT %</span><input type="number" step="1" id="ncSplit" value="80"></label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createContract">ADD CONTRACT</button>
        </div>
      </div>
    </div>`);
  const price = document.getElementById('ncPrice');
  if (price) attachMoneyInput(price);
}

function createContract() {
  const address = document.getElementById('ncAddr').value.trim();
  if (!address) { showToast('Address is required.', { tone: 'danger' }); return; }
  const c = seedContract({
    address,
    buyerName: document.getElementById('ncBuyer').value.trim() || 'TBD',
    sellerName: document.getElementById('ncSeller').value.trim() || 'TBD',
    salePrice: parseMoney(document.getElementById('ncPrice').value),
    commissionRatePct: Number(document.getElementById('ncRate').value) || 3,
    brokerSplitPct: Number(document.getElementById('ncSplit').value) || 80,
  });
  S.contracts.push(c);
  closeModal();
  mutate(`Added new contract: ${address}.`, { tone: 'ok' });
}

/* ---------- New Referral modal ---------- */

function openNewReferralModal() {
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ ADD REFERRAL</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">NAME *</span><input type="text" id="nrName"></label>
            <label class="field"><span class="field__label">PHONE</span><input type="tel" id="nrPhone"></label>
            <label class="field"><span class="field__label">EMAIL</span><input type="email" id="nrEmail"></label>
            <label class="field"><span class="field__label">NEXT TOUCH DATE</span><input type="date" id="nrNextTouch" value="${futureDate(90)}"></label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createReferral">ADD REFERRAL</button>
        </div>
      </div>
    </div>`);
}

function createReferral() {
  const name = document.getElementById('nrName').value.trim();
  if (!name) { showToast('Name is required.', { tone: 'danger' }); return; }
  const r = seedReferral({
    name,
    phone: document.getElementById('nrPhone').value.trim(),
    email: document.getElementById('nrEmail').value.trim(),
    lastTouch: todayISO(),
    nextTouchDate: document.getElementById('nrNextTouch').value || futureDate(90),
  });
  S.referrals.push(r);
  closeModal();
  mutate(`Added referral: ${name}.`, { tone: 'ok' });
}
