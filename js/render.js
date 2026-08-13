/* ============================================================
   NTM DEAL CENTER — render layer
   render() is the single entry point that redraws everything from S.
   ============================================================ */

const SUBTABS_A = [
  { key: '01', label: 'PIPELINE', builtin: true },
  { key: '02', label: 'DEAL ANALYZER', builtin: true },
  { key: '03', label: 'PORTFOLIO & RENTALS', builtin: true },
  { key: '04', label: 'FINANCING', builtin: true },
  { key: '05', label: 'RENOVATION', builtin: true },
  { key: '06', label: 'DEADLINES & OFFERS', builtin: true },
  { key: '07', label: 'BUYERS LIST', builtin: false },
  { key: '08', label: 'COMPS', builtin: false },
  { key: '09', label: 'DOCUMENTS', builtin: false },
  { key: '10', label: 'REPORTS', builtin: false },
];

function render() {
  applyTheme();
  applyMaskedMode();
  renderTitleBlock();
  renderWelcomeStrip();
  renderHero();
  renderSheetTabs();
  renderSubTabs();
  renderPanel();
  renderFooter();
  safeUpdateUrl();
}

function applyTheme() {
  document.body.dataset.theme = S.meta.theme === 'light' ? 'light' : 'dark';
}

function applyMaskedMode() {
  document.body.classList.toggle('is-exposed', S.meta.masked === false);
  document.body.classList.toggle('is-masked', S.meta.masked !== false);
}

function renderTitleBlock() {
  const revEl = document.getElementById('tbRevValue');
  const dateEl = document.getElementById('tbDateValue');
  if (revEl) revEl.textContent = String(S.meta.rev).padStart(3, '0');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const maskBtn = document.getElementById('maskToggleBtn');
  if (maskBtn) {
    const exposed = S.meta.masked === false;
    maskBtn.textContent = exposed ? '⚠ EXPOSED' : '🔒 MASKED';
    maskBtn.classList.toggle('pill-toggle--danger', exposed);
  }

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.textContent = S.meta.theme === 'light' ? '☀ VELLUM DAY' : '🌙 BLUEPRINT NIGHT';

  const urgent = getUrgentItems();
  const badge = document.getElementById('needsYouBadge');
  if (badge) {
    if (urgent.length > 0) {
      badge.hidden = false;
      badge.textContent = '⚑ ' + urgent.length;
      badge.title = urgent.length + ' things need you right now';
    } else {
      badge.hidden = true;
    }
  }
}

function renderWelcomeStrip() {
  const root = document.getElementById('welcomeStripRoot');
  if (!root) return;
  if (S.meta.welcomeSeen) { root.innerHTML = ''; return; }
  root.innerHTML = `
    <div class="welcome-strip">
      <div class="welcome-strip__text">
        <strong>Everything here is practice data — you can't break it.</strong>
        Click around, close deals, delete stuff. When you're ready for your own numbers, wipe the board clean in one click.
      </div>
      <div class="welcome-strip__actions">
        <button type="button" class="btn btn--ghost" data-action="dismissWelcome">GOT IT</button>
        <button type="button" class="btn btn--stamp" data-action="startEmptyBoard">START WITH AN EMPTY BOARD</button>
      </div>
    </div>`;
}

function renderHero() {
  const root = document.getElementById('heroRoot');
  if (!root) return;
  const expanded = !!S.meta.heroExpanded;
  if (expanded) {
    root.innerHTML = `
      <section class="hero hero--full">
        <div class="hero__bg" style="background-image:url('${HERO_BLUEPRINT_DATA_URI}')"></div>
        <div class="hero__overlay">
          <p class="hero__eyebrow">DWG A-00 — REAL ESTATE COMMAND CENTER</p>
          <h1 class="hero__headline">Stop losing deals in your notes app.<br>Run your whole pipeline from one sheet.</h1>
          <p class="hero__sub">Every lead, every seller call, every number that decides APPROVED or REJECTED — tracked the second you touch it, saved before you even think to hit save.</p>
          <div class="hero__ctas">
            <button type="button" class="btn btn--stamp btn--lg" data-action="gotoNewLead">+ FILE A DEAL</button>
            <button type="button" class="btn btn--stamp-outline btn--lg" data-action="gotoPipeline">SEE THE PIPELINE</button>
          </div>
        </div>
        <button type="button" class="hero__collapse" data-action="collapseHero" title="Collapse">▲ COLLAPSE</button>
      </section>`;
  } else {
    root.innerHTML = `
      <section class="hero hero--slim">
        <span class="hero__slim-text">NTM DEAL CENTER — your numbers, not your notes app.</span>
        <button type="button" class="btn btn--ghost btn--xs" data-action="expandHero">▼ EXPAND</button>
      </section>`;
  }
}

function renderSheetTabs() {
  const root = document.getElementById('sheetTabsRoot');
  if (!root) return;
  const sheets = [
    { key: 'A', label: 'SHEET A — INVESTOR' },
    { key: 'B', label: 'SHEET B — REALTOR' },
    { key: 'C', label: 'SHEET C — OPERATIONS' },
  ];
  root.innerHTML = sheets.map(s => `
    <button type="button" class="sheet-tab ${S.meta.activeSheet === s.key ? 'is-active' : ''}" data-action="setSheet" data-sheet="${s.key}">${s.label}</button>
  `).join('');
}

function renderSubTabs() {
  const root = document.getElementById('subTabsRoot');
  if (!root) return;
  if (S.meta.activeSheet !== 'A') {
    root.innerHTML = `<button type="button" class="subtab is-active" data-action="none">01 &nbsp; COMING NEXT</button>`;
    return;
  }
  root.innerHTML = SUBTABS_A.map(t => `
    <button type="button" class="subtab ${S.meta.activeSubtabA === t.key ? 'is-active' : ''} ${t.builtin ? '' : 'subtab--soon'}" data-action="setSubtabA" data-subtab="${t.key}">${t.key} &nbsp; ${t.label}</button>
  `).join('');
}

function renderPanel() {
  const root = document.getElementById('panelRoot');
  if (!root) return;

  if (S.meta.activeSheet === 'B') { root.innerHTML = comingNextPanelHTML('SHEET B — REALTOR', 'Your listings, showings, and buyer pipeline are landing here in the next build session.'); return; }
  if (S.meta.activeSheet === 'C') { root.innerHTML = comingNextPanelHTML('SHEET C — OPERATIONS', 'Team tasks, KPIs, and the daily briefing roll up here in a future session.'); return; }

  const key = S.meta.activeSubtabA;
  const builtin = SUBTABS_A.find(t => t.key === key);
  if (!builtin || !builtin.builtin) {
    root.innerHTML = comingNextPanelHTML(`DWG A-${key} — ${builtin ? builtin.label : ''}`, 'This panel is coming in a future session. Everything you build now in Pipeline, Analyzer, Portfolio, Financing, Renovation, and Deadlines will still be right here.');
    return;
  }

  switch (key) {
    case '01': root.innerHTML = renderPipelinePanel(); afterRenderPipeline(); break;
    case '02': root.innerHTML = renderAnalyzerPanel(); afterRenderAnalyzer(); break;
    case '03': root.innerHTML = renderPortfolioPanel(); break;
    case '04': root.innerHTML = renderFinancingPanel(); break;
    case '05': root.innerHTML = renderRenovationPanel(); break;
    case '06': root.innerHTML = renderDeadlinesPanel(); break;
    default: root.innerHTML = comingNextPanelHTML('DWG A-' + key, 'Coming next.');
  }
}

function comingNextPanelHTML(title, pitch) {
  return `
    <section class="panel panel--soon">
      <div class="panel__dwg">DWG — COMING NEXT</div>
      <h2 class="panel__title">${escapeHtml(title)}</h2>
      <p class="panel__pitch">${escapeHtml(pitch)}</p>
      <p class="handwritten">more soon — promise.</p>
    </section>`;
}

function renderFooter() {
  const sheetEl = document.getElementById('footerSheetValue');
  if (sheetEl) sheetEl.textContent = 'A-' + (S.meta.activeSheet === 'A' ? (S.meta.activeSubtabA || '01') : '00');
}

/* ============================================================
   01 — PIPELINE
   ============================================================ */

function filteredProperties() {
  const f = S.filters.pipelineStrategy || 'all';
  if (f === 'all') return S.properties;
  return S.properties.filter(p => p.strategy === f);
}

function renderPipelinePanel() {
  const props = filteredProperties();
  const chips = [{ key: 'all', label: 'ALL' }].concat(STRATEGIES.map(s => ({ key: s.key, label: s.label.toUpperCase() })));

  const chipsHTML = chips.map(c => `
    <button type="button" class="chip ${S.filters.pipelineStrategy === c.key || (c.key === 'all' && !S.filters.pipelineStrategy) ? 'is-active' : ''}" data-action="setPipelineFilter" data-filter="${c.key}">${c.label}</button>
  `).join('');

  const mobileIdx = S.meta.mobileStageIndex || 0;
  const stage = STAGES[mobileIdx];

  const columnsHTML = STAGES.map((st, i) => {
    const colProps = props.filter(p => p.stage === st.key);
    const totalProfit = colProps.reduce((sum, p) => sum + potentialProfit(p), 0);
    const cardsHTML = colProps.length
      ? colProps.map(p => propertyCardHTML(p)).join('')
      : `<div class="kanban-col__empty">No deals here yet.</div>`;
    return `
      <div class="kanban-col" data-stage-index="${i}" data-stage-key="${st.key}">
        <div class="kanban-col__head">
          <div class="kanban-col__name">${i + 1}. ${st.label}</div>
          <div class="kanban-col__stats"><span>${colProps.length} deal${colProps.length === 1 ? '' : 's'}</span><span class="kanban-col__profit">${fmtMoney(totalProfit)} potential</span></div>
        </div>
        <div class="kanban-col__cards">${cardsHTML}</div>
      </div>`;
  }).join('');

  const boardOrEmpty = S.properties.length === 0
    ? emptyStateHTML('No deals on the board yet.', 'Your pipeline is worth nothing until a lead is on it. File your first one and watch the whole board come alive.', '+ FILE YOUR FIRST DEAL', 'openNewPropertyModal')
    : `
      <div class="pipeline-pager">
        <button type="button" class="btn btn--ghost btn--xs" data-action="pipelinePagerPrev">◀</button>
        <div class="pipeline-pager__label">${stage.label} <span class="pipeline-pager__count">stage ${mobileIdx + 1} of ${STAGES.length}</span></div>
        <button type="button" class="btn btn--ghost btn--xs" data-action="pipelinePagerNext">▶</button>
      </div>
      <div class="kanban-board" id="kanbanBoard" data-mobile-stage-index="${mobileIdx}">${columnsHTML}</div>`;

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-01</div>
      <h2 class="panel__title">Your pipeline, at a glance — no more digging through texts to remember where a deal stands.</h2>
      <p class="panel__pitch">Every lead lives here from first drive-by to closing table. Move it forward the second something happens.</p>
      <div class="panel__toolbar">
        <div class="chip-row">${chipsHTML}</div>
        <button type="button" class="btn btn--stamp" data-action="openNewPropertyModal">+ NEW PROPERTY LEAD</button>
      </div>
      ${boardOrEmpty}
    </section>`;
}

function afterRenderPipeline() {
  // no-op hook kept for symmetry with afterRenderAnalyzer; swipe/scroll wiring lives in main.js
}

function stageOptionsHTML(currentKey) {
  return STAGES.map(s => `<button type="button" class="move-menu__item ${s.key === currentKey ? 'is-current' : ''}" data-action="moveStage" data-stage="${s.key}">${s.label}</button>`).join('');
}

function propertyCardHTML(p) {
  const idx = STAGE_INDEX[p.stage];
  const nextStage = STAGES[Math.min(idx + 1, STAGES.length - 1)];
  const profit = potentialProfit(p);
  const hasOwner = !!(p.owner || p.ownerPhone || p.ownerEmail);
  const strategyLabel = (STRATEGIES.find(s => s.key === p.strategy) || {}).label || p.strategy;

  return `
    <article class="card" id="prop-${p.id}" data-property-id="${p.id}">
      <div class="card__photo" style="background-image:url('${escapeHtml(p.photo)}')">
        <span class="card__strategy card__strategy--${p.strategy}">${escapeHtml(strategyLabel)}</span>
      </div>
      <div class="card__body">
        <div class="card__address">${escapeHtml(p.address)}</div>
        <div class="card__meta">${p.beds}bd · ${p.baths}ba · ${p.sqft.toLocaleString()} sqft</div>
        <div class="card__nums">
          <span>ASK <b>${maskMoney(p.askingPrice)}</b></span>
          <span>ARV <b>${fmtMoney(p.arv)}</b></span>
          <span class="card__profit">${profit >= 0 ? '+' : ''}${fmtMoney(profit)} potential</span>
        </div>
        ${hasOwner ? `
          <div class="card__seller">
            <span class="card__seller-name">${maskText(p.owner || 'Seller on file')}</span>
            <span class="card__seller-phone">${maskText(p.ownerPhone)}</span>
          </div>
          <div class="card__seller-actions">
            ${p.ownerPhone ? `<a class="btn btn--mint btn--xs" href="tel:${escapeHtml(p.ownerPhone.replace(/[^0-9+]/g, ''))}" data-action="logCallTap" data-property-id="${p.id}">☎ CALL</a>` : ''}
            <button type="button" class="btn btn--mint-outline btn--xs" data-action="openDraftModal" data-property-id="${p.id}">DRAFT</button>
          </div>` : ''}
        <div class="card__actions">
          <button type="button" class="btn btn--stamp-outline btn--xs" data-action="advanceStage" data-property-id="${p.id}" ${idx >= STAGES.length - 1 ? 'disabled' : ''}>ADVANCE → ${escapeHtml(nextStage.label)}</button>
          <div class="move-menu-wrap">
            <button type="button" class="btn btn--ghost btn--xs" data-action="toggleMoveMenu" data-property-id="${p.id}">MOVE ▾</button>
            <div class="move-menu" data-action="none">${stageOptionsHTML(p.stage)}</div>
          </div>
        </div>
      </div>
    </article>`;
}

/* ============================================================
   02 — DEAL ANALYZER
   ============================================================ */

function renderAnalyzerPanel() {
  if (S.properties.length === 0) {
    return `
      <section class="panel">
        <div class="panel__dwg">DWG A-02</div>
        <h2 class="panel__title">Know if a deal is money before you say a word to the seller.</h2>
        ${emptyStateHTML('No deals to analyze yet.', 'The analyzer needs a property on the board first. File one and the numbers will be waiting for you here.', '+ FILE YOUR FIRST DEAL', 'openNewPropertyModal')}
      </section>`;
  }
  if (!S.meta.analyzerPropertyId || !getProperty(S.meta.analyzerPropertyId)) {
    S.meta.analyzerPropertyId = S.properties[0].id;
  }
  const p = getProperty(S.meta.analyzerPropertyId);

  const pickerHTML = S.properties.map(pr => `<option value="${pr.id}" ${pr.id === p.id ? 'selected' : ''}>${escapeHtml(pr.address)}</option>`).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-02</div>
      <h2 class="panel__title">Know if a deal is money before you say a word to the seller.</h2>
      <p class="panel__pitch">Type real numbers, get a real verdict — MAO, cap rate, cash-on-cash, DSCR, flip profit, and a BRRRR refinance, recalculated the instant you type.</p>

      <label class="field field--picker">
        <span class="field__label">PROPERTY</span>
        <select id="analyzerPicker">${pickerHTML}</select>
      </label>

      <div id="analyzerBody">${analyzerBodyHTML(p)}</div>
    </section>`;
}

function analyzerBodyHTML(p) {
  return `
    <div class="analyzer-grid">
      <form class="analyzer-form" id="analyzerForm" data-property-id="${p.id}">
        <div class="field-grid">
          <label class="field"><span class="field__label">STRATEGY</span>
            <select data-field="strategy">${STRATEGIES.map(s => `<option value="${s.key}" ${s.key === p.strategy ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
          </label>
          <label class="field"><span class="field__label">PRICE</span><input type="text" inputmode="numeric" data-field="price" value="${Math.round(p.price || 0).toLocaleString('en-US')}"></label>
          <label class="field"><span class="field__label">REPAIRS</span><input type="text" inputmode="numeric" data-field="repairs" value="${Math.round(p.repairs || 0).toLocaleString('en-US')}"></label>
          <label class="field"><span class="field__label">ARV</span><input type="text" inputmode="numeric" data-field="arv" value="${Math.round(p.arv || 0).toLocaleString('en-US')}"></label>
          <label class="field"><span class="field__label">MONTHLY RENT</span><input type="text" inputmode="numeric" data-field="rent" value="${Math.round(p.rent || 0).toLocaleString('en-US')}"></label>
          <label class="field"><span class="field__label">ANNUAL TAXES</span><input type="text" inputmode="numeric" data-field="taxes" value="${Math.round(p.taxes || 0).toLocaleString('en-US')}"></label>
          <label class="field"><span class="field__label">ANNUAL INSURANCE</span><input type="text" inputmode="numeric" data-field="insurance" value="${Math.round(p.insurance || 0).toLocaleString('en-US')}"></label>
          <label class="field"><span class="field__label">LOAN TYPE</span>
            <select data-field="loanType"><option value="hard" ${p.loanType === 'hard' ? 'selected' : ''}>Hard Money</option><option value="conventional" ${p.loanType === 'conventional' ? 'selected' : ''}>Conventional</option></select>
          </label>
          <label class="field"><span class="field__label">LOAN RATE %</span><input type="number" step="0.01" data-field="loanRate" value="${p.loanRate || 0}"></label>
          <label class="field"><span class="field__label">LOAN POINTS</span><input type="number" step="0.1" data-field="loanPoints" value="${p.loanPoints || 0}"></label>
          <label class="field"><span class="field__label">LOAN TERM (YRS)</span><input type="number" step="1" data-field="loanTermYears" value="${p.loanTermYears || 0}"></label>
          <label class="field"><span class="field__label">DOWN %</span><input type="number" step="1" data-field="downPct" value="${p.downPct || 0}"></label>
        </div>
      </form>
      <div class="analyzer-outputs" id="analyzerOutputs">${analyzerOutputsHTML(p)}</div>
    </div>`;
}

function analyzerOutputsHTML(p) {
  const verdict = dealVerdict(p);
  const stack = capitalStackSegments(p);
  const brrrr = brrrrNumbers(p);
  const io = isInterestOnly(p);

  return `
    <div class="stamp stamp--${verdict.toLowerCase()}">${verdict}</div>
    ${verdict === 'REJECTED' ? `<button type="button" class="btn btn--stamp-outline btn--xs" data-action="setAskToMao" data-property-id="${p.id}">SET ASK TO MAO (${fmtMoney(mao(p))})</button>` : ''}

    <div class="metric-grid">
      <div class="metric"><span class="metric__label">MAO (70% RULE)</span><span class="metric__value">${fmtMoney(mao(p))}</span></div>
      <div class="metric"><span class="metric__label">EQUITY AT ARV</span><span class="metric__value">${fmtMoneySigned(equityAtARV(p))}</span></div>
      <div class="metric"><span class="metric__label">CAP RATE</span><span class="metric__value">${fmtPct(capRate(p))}</span></div>
      <div class="metric"><span class="metric__label">CASH-ON-CASH</span><span class="metric__value">${fmtPct(cashOnCash(p))}</span></div>
      <div class="metric"><span class="metric__label">DSCR</span><span class="metric__value">${dscr(p).toFixed(2)}</span></div>
      <div class="metric"><span class="metric__label">FLIP PROFIT</span><span class="metric__value">${fmtMoneySigned(flipProfit(p))}</span></div>
    </div>
    <p class="analyzer-note">${io ? 'Interest-only hard money loan — no principal paydown assumed.' : 'Amortizing loan — payment includes principal + interest.'}</p>

    <div class="brrrr-box">
      <div class="brrrr-box__title">BRRRR REFINANCE (75% OF ARV)</div>
      <div class="metric-grid metric-grid--tight">
        <div class="metric"><span class="metric__label">REFI AMOUNT</span><span class="metric__value">${fmtMoney(brrrr.refiAmount)}</span></div>
        <div class="metric"><span class="metric__label">CASH PULLED OUT</span><span class="metric__value">${fmtMoney(brrrr.cashPulledOut)}</span></div>
        <div class="metric"><span class="metric__label">CASH LEFT IN</span><span class="metric__value">${fmtMoney(brrrr.cashLeftIn)}</span></div>
      </div>
    </div>

    <div class="capital-stack">
      <div class="capital-stack__title">CAPITAL STACK</div>
      ${capitalStackSVG(stack)}
    </div>`;
}

function capitalStackSVG(stack) {
  const w = 560, h = 120, pad = 10;
  const scaleMax = Math.max(stack.total, stack.arv, 1);
  const scale = (w - pad * 2) / scaleMax;
  const segs = [
    { label: 'PURCHASE', val: stack.purchase, color: 'var(--ink)' },
    { label: 'CLOSING', val: stack.closing, color: 'var(--cyan)' },
    { label: 'REHAB', val: stack.rehab, color: 'var(--orange)' },
    { label: 'SELLING', val: stack.selling, color: 'var(--muted)' },
  ];
  let x = pad;
  const bars = segs.map(seg => {
    const width = Math.max(0, seg.val * scale);
    const rect = `<rect x="${x}" y="30" width="${width}" height="40" fill="${seg.color}"></rect>`;
    x += width;
    return rect;
  }).join('');
  const arvX = pad + stack.arv * scale;
  const profitX = pad + stack.total * scale;
  const profitWidth = Math.max(0, arvX - profitX);
  return `
    <svg viewBox="0 0 ${w} ${h}" class="capital-stack__svg" role="img" aria-label="Capital stack chart">
      ${bars}
      ${profitWidth > 0 ? `<rect x="${profitX}" y="30" width="${profitWidth}" height="40" fill="var(--mint)" opacity="0.85"></rect>` : ''}
      <line x1="${arvX}" y1="20" x2="${arvX}" y2="80" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 3"></line>
      <text x="${Math.min(arvX + 4, w - 90)}" y="18" font-size="11" fill="var(--ink)">ARV ${fmtMoney(stack.arv)}</text>
      <text x="${pad}" y="90" font-size="11" fill="var(--ink)">TOTAL COST ${fmtMoney(stack.total)}</text>
      ${profitWidth > 0 ? `<text x="${profitX}" y="105" font-size="11" fill="var(--mint)">PROFIT GAP ${fmtMoney(stack.profit)}</text>` : ''}
    </svg>`;
}

function afterRenderAnalyzer() {
  const form = document.getElementById('analyzerForm');
  const picker = document.getElementById('analyzerPicker');
  if (picker) {
    picker.addEventListener('change', () => {
      S.meta.analyzerPropertyId = picker.value;
      persistView();
    });
  }
  if (!form) return;
  form.querySelectorAll('[data-field]').forEach(el => {
    if (el.matches('input[inputmode="numeric"]')) attachMoneyInput(el);
    el.addEventListener('input', onAnalyzerFieldLive);
    el.addEventListener('change', onAnalyzerFieldCommit);
  });
}

function onAnalyzerFieldLive(e) {
  const form = e.target.closest('#analyzerForm');
  if (!form) return;
  const p = getProperty(form.dataset.propertyId);
  if (!p) return;
  applyAnalyzerField(p, e.target);
  const outputs = document.getElementById('analyzerOutputs');
  if (outputs) outputs.innerHTML = analyzerOutputsHTML(p);
  save();
}

function onAnalyzerFieldCommit(e) {
  const form = e.target.closest('#analyzerForm');
  if (!form) return;
  const p = getProperty(form.dataset.propertyId);
  if (!p) return;
  applyAnalyzerField(p, e.target);
  mutate(`Updated deal analyzer for ${p.address}.`, { silent: true });
}

function applyAnalyzerField(p, el) {
  const field = el.dataset.field;
  if (!field) return;
  if (el.matches('input[inputmode="numeric"]')) {
    p[field] = parseMoney(el.value);
  } else if (el.matches('input[type="number"]')) {
    p[field] = Number(el.value) || 0;
  } else {
    p[field] = el.value;
  }
}

/* ============================================================
   03 — PORTFOLIO & RENTALS
   ============================================================ */

function renderPortfolioPanel() {
  const kept = S.properties.filter(p => p.stage === 'closed' && (p.strategy === 'hold' || p.strategy === 'brrrr'));
  if (kept.length === 0) {
    return `
      <section class="panel">
        <div class="panel__dwg">DWG A-03</div>
        <h2 class="panel__title">Your rentals, cash flow, and equity — the payoff for every deal you closed.</h2>
        ${emptyStateHTML('No rentals in the portfolio yet.', 'Close a Hold or BRRRR deal and it lands here automatically — with cash flow, cap rate, and cash-on-cash tracked for you.', 'GO TO PIPELINE', 'gotoPipeline')}
      </section>`;
  }

  const rows = kept.map(p => {
    const basis = (p.price || 0) + (p.repairs || 0);
    const cf = annualCashFlow(p) / 12;
    return `<tr>
      <td>${escapeHtml(p.address)}</td>
      <td>${fmtMoney(basis)}</td>
      <td>${fmtMoney(p.repairs)}</td>
      <td>${fmtMoney(p.arv)}</td>
      <td class="${cf >= 0 ? 'text-mint' : 'text-danger'}">${fmtMoneySigned(cf)}/mo</td>
      <td>${fmtPct(capRate(p))}</td>
      <td>${fmtPct(cashOnCash(p))}</td>
    </tr>`;
  }).join('');

  const monthlyTotal = kept.reduce((sum, p) => sum + annualCashFlow(p) / 12, 0);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const maxAbs = Math.max(1, Math.abs(monthlyTotal));
  const chartH = 120;
  const barW = 34, gap = 14;
  const bars = months.map((m, i) => {
    const h = Math.max(4, Math.abs(monthlyTotal) / maxAbs * (chartH - 30));
    const x = i * (barW + gap) + 10;
    const y = monthlyTotal >= 0 ? chartH - 20 - h : chartH - 20;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${monthlyTotal >= 0 ? 'var(--mint)' : 'var(--danger)'}"></rect><text x="${x + barW/2}" y="${chartH - 4}" font-size="9" text-anchor="middle" fill="var(--muted)">${m}</text>`;
  }).join('');
  const chartW = months.length * (barW + gap) + 10;

  const ledgerRows = kept.map(p => {
    const grossAnnualRent = (p.rent || 0) * 12;
    const vacancy = grossAnnualRent * ASSUME_VACANCY_PCT;
    const maintenance = grossAnnualRent * ASSUME_MAINTENANCE_PCT;
    const management = grossAnnualRent * ASSUME_MANAGEMENT_PCT;
    const debtService = annualDebtService(p);
    const net = grossAnnualRent - (p.taxes || 0) - (p.insurance || 0) - vacancy - maintenance - management - debtService;
    return `
      <div class="ledger-row">
        <div class="ledger-row__addr">${escapeHtml(p.address)}</div>
        <div class="ledger-row__line">Rent ${fmtMoney(grossAnnualRent)} − Taxes ${fmtMoney(p.taxes)} − Insurance ${fmtMoney(p.insurance)} − Mgmt ${fmtMoney(management)} − Maint. ${fmtMoney(maintenance)} − Vacancy ${fmtMoney(vacancy)} − Loan ${fmtMoney(debtService)} = <b class="${net >= 0 ? 'text-mint' : 'text-danger'}">${fmtMoneySigned(net)}/yr</b></div>
      </div>`;
  }).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-03</div>
      <h2 class="panel__title">Your rentals, cash flow, and equity — the payoff for every deal you closed.</h2>
      <p class="panel__pitch">${kept.length} propert${kept.length === 1 ? 'y' : 'ies'} kept and cash flowing ${fmtMoneySigned(monthlyTotal)}/mo combined.</p>

      <div class="chart-box">
        <div class="chart-box__title">12-MONTH CASH FLOW</div>
        <svg viewBox="0 0 ${chartW} ${chartH}" class="chart-box__svg">${bars}</svg>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Property</th><th>Basis</th><th>Rehab</th><th>ARV</th><th>Cash Flow</th><th>Cap</th><th>CoC</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="ledger">
        <div class="ledger__title">RENTAL LEDGER</div>
        ${ledgerRows}
      </div>
    </section>`;
}

/* ============================================================
   04 — FINANCING
   ============================================================ */

function renderFinancingPanel() {
  const lenderCards = S.lenders.length ? S.lenders.map(l => `
    <div class="lender-card">
      <div class="lender-card__name">${escapeHtml(l.name)}</div>
      <div class="lender-card__type">${escapeHtml(l.type)}</div>
      <div class="lender-card__row"><span>RATE</span><b>${fmtPct(l.rate)}</b></div>
      <div class="lender-card__row"><span>POINTS</span><b>${l.points}</b></div>
      <div class="lender-card__row"><span>MAX LTV</span><b>${fmtPct(l.maxLTV, 0)}</b></div>
      <div class="lender-card__contact">${maskText(l.contact)}</div>
    </div>`).join('') : emptyStateHTML('No lenders on the bench yet.', 'Add the hard-money and conventional contacts you actually call, and their terms live right here.', '+ ADD LENDER', 'openNewLenderModal');

  const loanRows = S.loans.length ? S.loans.map(l => `
    <tr><td>${escapeHtml(l.lender)}</td><td>${escapeHtml(l.propertyAddr)}</td><td>${fmtMoney(l.amount)}</td><td>${fmtPct(l.rate)}</td><td>${escapeHtml(l.term)}</td><td>${escapeHtml(l.status)}</td></tr>
  `).join('') : `<tr><td colspan="6" class="table-empty">No active loans logged yet.</td></tr>`;

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-04</div>
      <h2 class="panel__title">Your money bench — so you know exactly who to call the second you need capital.</h2>
      <p class="panel__pitch">Rates, points, and max LTV for every lender you work with, plus every loan you've got live.</p>
      <div class="panel__toolbar">
        <button type="button" class="btn btn--stamp" data-action="openNewLenderModal">+ ADD LENDER</button>
      </div>
      <div class="lender-grid">${lenderCards}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Lender</th><th>Property</th><th>Amount</th><th>Rate</th><th>Term</th><th>Status</th></tr></thead>
          <tbody>${loanRows}</tbody>
        </table>
      </div>
    </section>`;
}

/* ============================================================
   05 — RENOVATION
   ============================================================ */

function renderRenovationPanel() {
  const jobs = S.properties.filter(p => p.renovation);
  if (jobs.length === 0) {
    return `
      <section class="panel">
        <div class="panel__dwg">DWG A-05</div>
        <h2 class="panel__title">Every job, every contractor, every dollar — before the budget runs away from you.</h2>
        ${emptyStateHTML('No renovation jobs tracked yet.', 'Once a deal is under contract, start a reno job here and watch the budget bar in real time.', 'GO TO PIPELINE', 'gotoPipeline')}
      </section>`;
  }
  const cards = jobs.map(p => {
    const r = p.renovation;
    const pct = r.budget ? Math.min(999, Math.round((r.spent / r.budget) * 100)) : 0;
    const over = r.spent > r.budget;
    const items = (r.lineItems || []).map(li => `
      <li class="reno-item reno-item--${li.status}" data-action="cycleLineItem" data-property-id="${p.id}" data-item-id="${li.id}">
        <span class="reno-item__dot"></span> ${escapeHtml(li.name)} <b>${fmtMoney(li.cost)}</b> <span class="reno-item__status">${li.status}</span>
      </li>`).join('');
    return `
      <div class="reno-card">
        <div class="reno-card__head">
          <span class="reno-card__addr">${escapeHtml(p.address)}</span>
          <span class="reno-card__contractor">${escapeHtml(r.contractor)}</span>
        </div>
        <div class="reno-card__milestone">Next: ${escapeHtml(r.nextMilestone)}</div>
        <div class="progress-bar ${over ? 'progress-bar--over' : ''}">
          <div class="progress-bar__fill" style="width:${Math.min(100, pct)}%"></div>
        </div>
        <div class="reno-card__budget">${fmtMoney(r.spent)} / ${fmtMoney(r.budget)} (${pct}%)${over ? ' — OVER BUDGET' : ''}</div>
        <ul class="reno-items">${items}</ul>
      </div>`;
  }).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-05</div>
      <h2 class="panel__title">Every job, every contractor, every dollar — before the budget runs away from you.</h2>
      <p class="panel__pitch">Click a line item to cycle it done → active → pending. The bar turns orange the moment you're over budget.</p>
      <div class="reno-grid">${cards}</div>
    </section>`;
}

/* ============================================================
   06 — DEADLINES & OFFERS
   ============================================================ */

function renderDeadlinesPanel() {
  const allDeadlines = [];
  S.properties.forEach(p => (p.deadlines || []).forEach(d => allDeadlines.push({ ...d, propertyId: p.id, address: p.address })));
  allDeadlines.sort((a, b) => (a.cleared === b.cleared ? daysUntil(a.dueDate) - daysUntil(b.dueDate) : a.cleared ? 1 : -1));

  const chips = allDeadlines.length ? allDeadlines.map(d => {
    const days = daysUntil(d.dueDate);
    let tone = 'green';
    if (days <= 0) tone = 'red'; else if (days <= 3) tone = 'orange'; else if (days <= 7) tone = 'orange';
    return `
      <div class="deadline-chip deadline-chip--${d.cleared ? 'cleared' : tone}">
        <span class="deadline-chip__label">${escapeHtml(d.label)} — ${escapeHtml(d.address)}</span>
        <span class="deadline-chip__days">${d.cleared ? 'CLEARED' : (days < 0 ? Math.abs(days) + 'd overdue' : days === 0 ? 'DUE TODAY' : days + 'd left')}</span>
        ${!d.cleared ? `<button type="button" class="btn btn--ghost btn--xs" data-action="clearDeadline" data-property-id="${d.propertyId}" data-deadline-id="${d.id}">CLEAR</button>` : ''}
      </div>`;
  }).join('') : emptyStateHTML('No due-diligence clocks running.', 'Add a deadline to any deal under contract and it counts down right here — green, then orange, then red.', '+ ADD DEADLINE', 'openNewDeadlineModal');

  const allOffers = [];
  S.properties.forEach(p => (p.offers || []).forEach(o => allOffers.push({ ...o, address: p.address })));
  allOffers.sort((a, b) => b.date.localeCompare(a.date));
  const offerRows = allOffers.length ? allOffers.map(o => `
    <tr><td>${escapeHtml(o.date)}</td><td>${escapeHtml(o.address)}</td><td>${o.type === 'counter' ? 'Counteroffer' : 'Offer'}</td><td>${fmtMoney(o.amount)}</td><td>${escapeHtml(o.note || '')}</td></tr>
  `).join('') : `<tr><td colspan="5" class="table-empty">No offers logged yet.</td></tr>`;

  return `
    <section class="panel">
      <div class="panel__dwg">DWG A-06</div>
      <h2 class="panel__title">Never blow a deadline again — and always know exactly what's on the table.</h2>
      <p class="panel__pitch">Countdown chips for every due-diligence clock, plus a running log of every offer and counter.</p>
      <div class="panel__toolbar">
        <button type="button" class="btn btn--stamp" data-action="openNewDeadlineModal">+ ADD DEADLINE</button>
        <button type="button" class="btn btn--stamp-outline" data-action="openNewOfferModal">+ LOG OFFER</button>
      </div>
      <div class="deadline-list">${chips}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Property</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>${offerRows}</tbody>
        </table>
      </div>
    </section>`;
}
