/* ============================================================
   NTM DEAL CENTER — actions & modals
   ONE document-level click listener reads data-action off the
   clicked element. Never stopPropagation inside a modal — the
   modal panel carries data-action="none" so closest() stops there
   instead of bubbling to the overlay's close action.
   ============================================================ */

let newPropertyPhotoDataUrl = null;
let currentDraftPropertyId = null;
let currentDraftTab = 'call';

function isMobileViewport() {
  return window.innerWidth <= 720;
}

function openModal(html) {
  const root = document.getElementById('modalRoot');
  if (!root) return;
  root.innerHTML = html;
}

function closeModal() {
  const root = document.getElementById('modalRoot');
  if (root) root.innerHTML = '';
  newPropertyPhotoDataUrl = null;
}

function closeAllMoveMenus() {
  document.querySelectorAll('.move-menu-wrap.is-open').forEach(el => el.classList.remove('is-open'));
}

function followCard(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById('prop-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('card--flash');
    setTimeout(() => el.classList.remove('card--flash'), 2500);
  });
}

/* ============================================================
   Seller outreach draft generator — situation-aware copy
   ============================================================ */

function outreachAngle(p) {
  if (p.situation === 'foreclosure') return 'foreclosure';
  if (p.situation === 'vacant') return 'vacant';
  return 'standard';
}

const ANGLE_COPY = {
  foreclosure: {
    hook: (addr) => `I know the timeline with the bank on ${addr} isn't waiting for anyone, and I'd like to help you get ahead of it instead of behind it.`,
    pitch: () => `I can move fast and close on your timeline — no repairs, no listing, no waiting on the bank's clock. Just a cash offer, as-is.`,
  },
  vacant: {
    hook: (addr) => `I noticed ${addr} has been sitting empty. I buy houses just like it as-is — no cleanout, no repairs, no showings.`,
    pitch: () => `You don't have to fix a thing or haul anything out. I'll buy it exactly how it sits and handle the rest myself.`,
  },
  standard: {
    hook: (addr) => `I'm a local investor and I'd like to make you a fair, straightforward cash offer on ${addr}.`,
    pitch: () => `No repairs, no agent commissions, no waiting around — a simple cash offer and a closing date that works for you.`,
  },
};

function buildOutreach(p) {
  const name = firstName(p.owner);
  const addr = p.address;
  const a = ANGLE_COPY[outreachAngle(p)];
  const hook = a.hook(addr);
  const pitch = a.pitch();

  const callScript = [
    `Hi ${name}, this is calling about ${addr} — do you have two minutes?`,
    hook,
    `Before I say anything else — can I ask what's going on with the property, and what would make this easy for you?`,
    `(Listen first. Let them talk. Ask: "What's your timeline?" and "What matters most to you in a sale?")`,
    pitch,
    `Would it be alright if I took a quick look and got you a real number, no obligation?`,
  ].join('\n\n');

  const voicemail = `Hi ${name}, this is calling about ${addr}. ${hook} Give me a call back whenever works — no pressure, just want to see if I can help. Thanks, talk soon.`;

  const text = `Hi ${name}, this is regarding ${addr}. ${pitch} Any interest in a no-obligation cash offer? Happy to work around your schedule.`;

  const email = `Subject: Quick question about ${addr}\n\nHi ${name},\n\n${hook}\n\n${pitch}\n\nIf you're open to it, I'd love to set up a quick call or stop by — completely no-obligation. Just reply to this email or call/text whenever is easiest for you.\n\nThanks for your time,\n${S.meta.brand}`;

  return { callScript, voicemail, text, email };
}

/* ============================================================
   The single click dispatcher
   ============================================================ */

const ACTIONS = {
  none() {},

  closeModalOverlay() { closeModal(); },
  closeModal() { closeModal(); },

  dismissWelcome() { dismissWelcome(); },
  startEmptyBoard() { blankState(); },

  collapseHero() { S.meta.heroExpanded = false; S.meta.heroPreferenceSet = true; persistView(); },
  expandHero() { S.meta.heroExpanded = true; S.meta.heroPreferenceSet = true; persistView(); },

  gotoPipeline() { S.meta.activeSheet = 'A'; S.meta.activeSubtabA = '01'; persistView(); },
  gotoNewLead() { S.meta.activeSheet = 'A'; S.meta.activeSubtabA = '01'; persistView(); openNewPropertyModal(); },

  setSheet(el) { S.meta.activeSheet = el.dataset.sheet; persistView(); },
  setSubtabA(el) { S.meta.activeSubtabA = el.dataset.subtab; persistView(); },
  setPipelineFilter(el) { S.filters.pipelineStrategy = el.dataset.filter; persistView(); },

  toggleTheme() { S.meta.theme = S.meta.theme === 'light' ? 'dark' : 'light'; persistView(); },
  toggleMasked() { S.meta.masked = S.meta.masked === false ? true : false; persistView(); },

  openFinder() { openFinder(); },
  jumpToUrgent() { S.meta.activeSheet = 'A'; S.meta.activeSubtabA = '06'; persistView(); },

  pipelinePagerPrev() {
    S.meta.mobileStageIndex = Math.max(0, (S.meta.mobileStageIndex || 0) - 1);
    persistView();
  },
  pipelinePagerNext() {
    S.meta.mobileStageIndex = Math.min(STAGES.length - 1, (S.meta.mobileStageIndex || 0) + 1);
    persistView();
  },

  toggleMoveMenu(el) {
    const wrap = el.closest('.move-menu-wrap');
    if (!wrap) return;
    const wasOpen = wrap.classList.contains('is-open');
    closeAllMoveMenus();
    if (!wasOpen) wrap.classList.add('is-open');
  },

  advanceStage(el) {
    const p = getProperty(el.dataset.propertyId);
    if (!p) return;
    const idx = STAGE_INDEX[p.stage];
    const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
    const snap = snapshotState();
    p.stage = next.key;
    if (isMobileViewport()) S.meta.mobileStageIndex = STAGE_INDEX[next.key];
    mutate(`Advanced ${p.address} to ${next.label}.`, { undoSnapshot: snap, tone: 'ok' });
    followCard(p.id);
  },

  moveStage(el) {
    const card = el.closest('.card');
    if (!card) return;
    const p = getProperty(card.dataset.propertyId);
    if (!p) return;
    const stageKey = el.dataset.stage;
    const stage = STAGES.find(s => s.key === stageKey);
    if (!stage) return;
    const snap = snapshotState();
    p.stage = stage.key;
    if (isMobileViewport()) S.meta.mobileStageIndex = STAGE_INDEX[stage.key];
    closeAllMoveMenus();
    mutate(`Moved ${p.address} to ${stage.label}.`, { undoSnapshot: snap, tone: 'ok' });
    followCard(p.id);
  },

  logCallTap(el) {
    const p = getProperty(el.dataset.propertyId);
    if (!p) return;
    p.outreachLog.push({ channel: 'call', ts: Date.now(), text: 'Tapped to call ' + (p.owner || 'seller') });
    mutate(`Logged a call tap with ${p.owner || 'the seller'} at ${p.address}.`, { silent: true });
  },

  setAskToMao(el) {
    const p = getProperty(el.dataset.propertyId);
    if (!p) return;
    const newPrice = Math.max(0, Math.round(mao(p)));
    p.askingPrice = newPrice;
    p.price = newPrice;
    mutate(`Set asking price on ${p.address} to the 70% rule MAO of ${fmtMoney(newPrice)}.`);
  },

  openNewPropertyModal() { openNewPropertyModal(); },
  createProperty() { createProperty(); },

  openDraftModal(el) { openDraftModal(el.dataset.propertyId); },
  switchDraftTab(el) { currentDraftTab = el.dataset.channel; renderDraftModalContent(); },
  copyAndLogTouch(el) { copyAndLogTouch(el.dataset.channel); },

  openNewLenderModal() { openNewLenderModal(); },
  createLender() { createLender(); },

  openNewDeadlineModal() { openNewDeadlineModal(); },
  createDeadline() { createDeadline(); },
  clearDeadline(el) {
    const p = getProperty(el.dataset.propertyId);
    if (!p) return;
    const dl = (p.deadlines || []).find(d => d.id === el.dataset.deadlineId);
    if (!dl) return;
    const snap = snapshotState();
    dl.cleared = true;
    mutate(`Cleared "${dl.label}" on ${p.address}.`, { undoSnapshot: snap, tone: 'warn' });
  },

  openNewOfferModal() { openNewOfferModal(); },
  createOffer() { createOffer(); },

  cycleLineItem(el) {
    const p = getProperty(el.dataset.propertyId);
    if (!p || !p.renovation) return;
    const li = (p.renovation.lineItems || []).find(i => i.id === el.dataset.itemId);
    if (!li) return;
    const order = ['pending', 'active', 'done'];
    li.status = order[(order.indexOf(li.status) + 1) % order.length];
    mutate(`Marked "${li.name}" ${li.status} on ${p.address}.`, { silent: true });
  },
};

function handleDocumentClick(e) {
  const actionEl = e.target.closest('[data-action]');
  const insideMoveMenu = actionEl && actionEl.closest('.move-menu-wrap');
  if (!insideMoveMenu) closeAllMoveMenus();

  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const handler = ACTIONS[action];
  if (handler) handler(actionEl, e);
}

/* ============================================================
   New Property modal
   ============================================================ */

function openNewPropertyModal() {
  newPropertyPhotoDataUrl = null;
  const situationOptions = `
    <option value="standard">Standard</option>
    <option value="foreclosure">Foreclosure / pre-foreclosure</option>
    <option value="vacant">Vacant</option>`;
  const strategyOptions = STRATEGIES.map(s => `<option value="${s.key}">${s.label}</option>`).join('');

  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal modal--lg" data-action="none">
        <div class="modal__head">
          <h3>+ NEW PROPERTY LEAD</h3>
          <button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button>
        </div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">STREET ADDRESS *</span><input type="text" id="npAddress" placeholder="123 Main St"></label>
            <label class="field"><span class="field__label">CITY</span><input type="text" id="npCity" value="Baltimore"></label>
            <label class="field"><span class="field__label">STATE</span><input type="text" id="npState" value="MD"></label>
            <label class="field"><span class="field__label">ZIP</span><input type="text" id="npZip" value="21201"></label>
            <label class="field"><span class="field__label">STRATEGY</span><select id="npStrategy">${strategyOptions}</select></label>
            <label class="field"><span class="field__label">SITUATION</span><select id="npSituation">${situationOptions}</select></label>
            <label class="field"><span class="field__label">ASKING PRICE</span><input type="text" inputmode="numeric" id="npAsking" placeholder="150,000"></label>
            <label class="field"><span class="field__label">REPAIRS</span><input type="text" inputmode="numeric" id="npRepairs" placeholder="30,000"></label>
            <label class="field"><span class="field__label">ARV</span><input type="text" inputmode="numeric" id="npArv" placeholder="250,000"></label>
            <label class="field"><span class="field__label">BEDS</span><input type="number" id="npBeds" value="3"></label>
            <label class="field"><span class="field__label">BATHS</span><input type="number" step="0.5" id="npBaths" value="1.5"></label>
            <label class="field"><span class="field__label">SQFT</span><input type="number" id="npSqft" value="1400"></label>
          </div>
          <p class="modal__section-label">SELLER (OPTIONAL)</p>
          <div class="field-grid">
            <label class="field"><span class="field__label">OWNER NAME</span><input type="text" id="npOwner" placeholder="Jane Smith"></label>
            <label class="field"><span class="field__label">OWNER PHONE</span><input type="tel" id="npOwnerPhone" placeholder="(410) 555-0100"></label>
            <label class="field"><span class="field__label">OWNER EMAIL</span><input type="email" id="npOwnerEmail" placeholder="jane@example.com"></label>
          </div>
          <p class="modal__section-label">PHOTO (OPTIONAL)</p>
          <div class="photo-upload">
            <div class="photo-upload__preview" id="npPhotoPreview"></div>
            <input type="file" accept="image/*" id="npPhoto">
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createProperty">FILE THIS LEAD</button>
        </div>
      </div>
    </div>`);

  ['npAsking', 'npRepairs', 'npArv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) attachMoneyInput(el);
  });

  const photoInput = document.getElementById('npPhoto');
  if (photoInput) {
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;
      const progress = startProgress('Adding photo', ['Reading file', 'Shrinking to 900px JPEG', 'Ready']);
      progress.advance();
      try {
        const dataUrl = await resizeImageFile(file, 900);
        progress.advance();
        newPropertyPhotoDataUrl = dataUrl;
        const preview = document.getElementById('npPhotoPreview');
        if (preview) preview.style.backgroundImage = `url('${dataUrl}')`;
        progress.advance();
      } catch (err) {
        progress.error('Could not process that image — try another file.');
      }
    });
  }
}

function createProperty() {
  const address = (document.getElementById('npAddress').value || '').trim();
  if (!address) { showToast('Street address is required.', { tone: 'danger' }); return; }
  const p = {
    id: uid('prop'),
    address,
    city: document.getElementById('npCity').value.trim(),
    state: document.getElementById('npState').value.trim(),
    zip: document.getElementById('npZip').value.trim(),
    strategy: document.getElementById('npStrategy').value,
    stage: 'research_lead',
    situation: document.getElementById('npSituation').value,
    askingPrice: parseMoney(document.getElementById('npAsking').value),
    price: parseMoney(document.getElementById('npAsking').value),
    repairs: parseMoney(document.getElementById('npRepairs').value),
    arv: parseMoney(document.getElementById('npArv').value),
    beds: Number(document.getElementById('npBeds').value) || 0,
    baths: Number(document.getElementById('npBaths').value) || 0,
    sqft: Number(document.getElementById('npSqft').value) || 0,
    owner: document.getElementById('npOwner').value.trim(),
    ownerPhone: document.getElementById('npOwnerPhone').value.trim(),
    ownerEmail: document.getElementById('npOwnerEmail').value.trim(),
    photo: newPropertyPhotoDataUrl || nextHouseImage(),
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
  S.properties.push(p);
  closeModal();
  mutate(`Filed a new lead at ${address}.`, { tone: 'ok' });
  followCard(p.id);
}

/* ============================================================
   Seller DRAFT modal
   ============================================================ */

function openDraftModal(propertyId) {
  currentDraftPropertyId = propertyId;
  currentDraftTab = 'call';
  renderDraftModalContent();
}

function renderDraftModalContent() {
  const p = getProperty(currentDraftPropertyId);
  if (!p) { closeModal(); return; }
  const outreach = buildOutreach(p);
  const tabs = [
    { key: 'call', label: 'CALL' },
    { key: 'text', label: 'TEXT' },
    { key: 'email', label: 'EMAIL' },
  ];
  const tabsHTML = tabs.map(t => `<button type="button" class="draft-tab ${currentDraftTab === t.key ? 'is-active' : ''}" data-action="switchDraftTab" data-channel="${t.key}">${t.label}</button>`).join('');

  let body = '';
  if (currentDraftTab === 'call') {
    body = `<div class="draft-copy"><h4>CALL SCRIPT</h4><pre>${escapeHtml(outreach.callScript)}</pre><h4>20-SECOND VOICEMAIL</h4><pre>${escapeHtml(outreach.voicemail)}</pre></div>`;
  } else if (currentDraftTab === 'text') {
    body = `<div class="draft-copy"><h4>TEXT MESSAGE</h4><pre>${escapeHtml(outreach.text)}</pre></div>`;
  } else {
    body = `<div class="draft-copy"><h4>EMAIL</h4><pre>${escapeHtml(outreach.email)}</pre></div>`;
  }

  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head">
          <h3>DRAFT — ${escapeHtml(p.owner || 'Seller')} · ${escapeHtml(p.address)}</h3>
          <button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button>
        </div>
        <div class="draft-tabs">${tabsHTML}</div>
        <div class="modal__body">${body}</div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CLOSE</button>
          <button type="button" class="btn btn--stamp" data-action="copyAndLogTouch" data-channel="${currentDraftTab}">COPY & LOG TOUCH</button>
        </div>
      </div>
    </div>`);
}

function copyAndLogTouch(channel) {
  const p = getProperty(currentDraftPropertyId);
  if (!p) return;
  const outreach = buildOutreach(p);
  const textMap = { call: outreach.callScript, text: outreach.text, email: outreach.email };
  const payload = textMap[channel] || '';

  const logIt = () => {
    p.outreachLog.push({ channel, ts: Date.now(), text: payload });
    closeModal();
    mutate(`Copied & logged a ${channel} touch with ${p.owner || 'the seller'} at ${p.address}.`, { tone: 'ok' });
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payload).then(logIt).catch(logIt);
  } else {
    logIt();
  }
}

/* ============================================================
   New Lender modal
   ============================================================ */

function openNewLenderModal() {
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ ADD LENDER</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">NAME</span><input type="text" id="nlName"></label>
            <label class="field"><span class="field__label">TYPE</span>
              <select id="nlType"><option>Hard Money</option><option>Conventional</option><option>DSCR</option><option>Other</option></select>
            </label>
            <label class="field"><span class="field__label">RATE %</span><input type="number" step="0.01" id="nlRate" value="10"></label>
            <label class="field"><span class="field__label">POINTS</span><input type="number" step="0.1" id="nlPoints" value="2"></label>
            <label class="field"><span class="field__label">MAX LTV %</span><input type="number" step="1" id="nlLtv" value="75"></label>
            <label class="field field--wide"><span class="field__label">CONTACT</span><input type="text" id="nlContact" placeholder="Name — phone"></label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createLender">ADD LENDER</button>
        </div>
      </div>
    </div>`);
}

function createLender() {
  const name = document.getElementById('nlName').value.trim();
  if (!name) { showToast('Lender name is required.', { tone: 'danger' }); return; }
  S.lenders.push({
    id: uid('len'), name,
    type: document.getElementById('nlType').value,
    rate: Number(document.getElementById('nlRate').value) || 0,
    points: Number(document.getElementById('nlPoints').value) || 0,
    maxLTV: Number(document.getElementById('nlLtv').value) || 0,
    contact: document.getElementById('nlContact').value.trim(),
  });
  closeModal();
  mutate(`Added ${name} to the lender bench.`, { tone: 'ok' });
}

/* ============================================================
   New Deadline modal
   ============================================================ */

function propertyPickerOptions() {
  return S.properties.map(p => `<option value="${p.id}">${escapeHtml(p.address)}</option>`).join('');
}

function openNewDeadlineModal() {
  if (S.properties.length === 0) { showToast('File a property lead first.', { tone: 'danger' }); return; }
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ ADD DEADLINE</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">PROPERTY</span><select id="ndProperty">${propertyPickerOptions()}</select></label>
            <label class="field field--wide"><span class="field__label">LABEL</span><input type="text" id="ndLabel" placeholder="Inspection contingency"></label>
            <label class="field"><span class="field__label">DUE DATE</span><input type="date" id="ndDue" value="${futureDate(7)}"></label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createDeadline">ADD DEADLINE</button>
        </div>
      </div>
    </div>`);
}

function createDeadline() {
  const propId = document.getElementById('ndProperty').value;
  const p = getProperty(propId);
  if (!p) return;
  const label = document.getElementById('ndLabel').value.trim() || 'Deadline';
  const due = document.getElementById('ndDue').value || futureDate(7);
  p.deadlines.push({ id: uid('dl'), label, dueDate: due, cleared: false });
  closeModal();
  mutate(`Added deadline "${label}" to ${p.address}.`, { tone: 'ok' });
}

/* ============================================================
   New Offer modal
   ============================================================ */

function openNewOfferModal() {
  if (S.properties.length === 0) { showToast('File a property lead first.', { tone: 'danger' }); return; }
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ LOG OFFER</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <div class="field-grid">
            <label class="field field--wide"><span class="field__label">PROPERTY</span><select id="noProperty">${propertyPickerOptions()}</select></label>
            <label class="field"><span class="field__label">TYPE</span><select id="noType"><option value="offer">Offer</option><option value="counter">Counteroffer</option></select></label>
            <label class="field"><span class="field__label">AMOUNT</span><input type="text" inputmode="numeric" id="noAmount" placeholder="150,000"></label>
            <label class="field"><span class="field__label">DATE</span><input type="date" id="noDate" value="${todayISO()}"></label>
            <label class="field field--wide"><span class="field__label">NOTE</span><input type="text" id="noNote" placeholder="Optional"></label>
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="createOffer">LOG OFFER</button>
        </div>
      </div>
    </div>`);
  const amt = document.getElementById('noAmount');
  if (amt) attachMoneyInput(amt);
}

function createOffer() {
  const propId = document.getElementById('noProperty').value;
  const p = getProperty(propId);
  if (!p) return;
  const offer = {
    id: uid('offer'),
    type: document.getElementById('noType').value,
    amount: parseMoney(document.getElementById('noAmount').value),
    date: document.getElementById('noDate').value || todayISO(),
    note: document.getElementById('noNote').value.trim(),
  };
  p.offers.push(offer);
  closeModal();
  mutate(`Logged ${offer.type === 'counter' ? 'a counteroffer' : 'an offer'} of ${fmtMoney(offer.amount)} on ${p.address}.`, { tone: 'ok' });
}
