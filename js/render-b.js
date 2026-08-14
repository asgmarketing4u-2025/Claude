/* ============================================================
   NTM DEAL CENTER — Sheet B render layer (Realtor)
   ============================================================ */

function followUpTone(days) {
  if (days < 0) return 'red';
  if (days <= 1) return 'red';
  if (days <= 3) return 'orange';
  return 'green';
}

function followUpDaysLabel(days) {
  if (days < 0) return Math.abs(days) + 'd overdue';
  if (days === 0) return 'DUE TODAY';
  return days + 'd left';
}

/* ---------- 01 LEAD PIPELINE ---------- */

function filteredLeads() {
  const f = S.filters.leadPipeline || 'all';
  if (f === 'all') return S.leads;
  return S.leads.filter(l => l.role === f);
}

function renderLeadPipelinePanel() {
  const leads = filteredLeads();
  const chips = [
    { key: 'all', label: 'ALL' }, { key: 'buyer', label: 'BUYERS' }, { key: 'seller', label: 'SELLERS' },
  ].map(c => `<button type="button" class="chip ${(S.filters.leadPipeline || 'all') === c.key ? 'is-active' : ''}" data-action="setLeadFilter" data-filter="${c.key}">${c.label}</button>`).join('');

  const columnsHTML = LEAD_STAGES.map((st, i) => {
    const colLeads = leads.filter(l => l.stage === st.key);
    const cardsHTML = colLeads.length ? colLeads.map(leadCardHTML).join('') : `<div class="kanban-col__empty">Nobody here yet.</div>`;
    return `
      <div class="kanban-col" data-stage-index="${i}" data-stage-key="${st.key}">
        <div class="kanban-col__head">
          <div class="kanban-col__name">${i + 1}. ${st.label}</div>
          <div class="kanban-col__stats"><span>${colLeads.length} ${colLeads.length === 1 ? 'person' : 'people'}</span></div>
        </div>
        <div class="kanban-col__cards">${cardsHTML}</div>
      </div>`;
  }).join('');

  const board = S.leads.length === 0
    ? emptyStateHTML('No leads on the board yet.', 'A lead you never follow up with is a lead you never close. Add your first one and the follow-up clock starts ticking automatically.', '+ NEW LEAD', 'openNewLeadModal')
    : `<div class="kanban-board">${columnsHTML}</div>`;

  return `
    <section class="panel">
      <div class="panel__dwg">DWG B-01</div>
      <h2 class="panel__title">Every buyer and seller you're working, one glance — nobody falls through the cracks.</h2>
      <p class="panel__pitch">Move someone forward and their next follow-up date automatically tightens, so the pipeline polices itself.</p>
      <div class="panel__toolbar">
        <div class="chip-row">${chips}</div>
        <button type="button" class="btn btn--stamp" data-action="openNewLeadModal">+ NEW LEAD</button>
      </div>
      ${board}
    </section>`;
}

function afterRenderLeadPipeline() {}

function leadStageOptionsHTML(currentKey) {
  return LEAD_STAGES.map(s => `<button type="button" class="move-menu__item ${s.key === currentKey ? 'is-current' : ''}" data-action="moveLeadStage" data-stage="${s.key}">${s.label}</button>`).join('');
}

function leadCardHTML(l) {
  const idx = LEAD_STAGE_INDEX[l.stage];
  const nextStage = LEAD_STAGES[Math.min(idx + 1, LEAD_STAGES.length - 1)];
  const days = daysUntil(l.followUpDate);
  const tone = followUpTone(days);
  return `
    <article class="card lead-card" id="lead-${l.id}" data-lead-id="${l.id}">
      <div class="card__body">
        <div class="card__address">${escapeHtml(l.name)} <span class="lead-role lead-role--${l.role}">${l.role.toUpperCase()}</span></div>
        <div class="card__meta">${escapeHtml(l.source)}${l.area ? ' · ' + escapeHtml(l.area) : ''}</div>
        <div class="card__nums">
          ${l.role === 'buyer' ? `<span>BUDGET <b>${maskMoney(l.budget)}</b></span>` : ''}
          <span>LOAN <b>${escapeHtml(l.loanStatus)}</b></span>
        </div>
        <div class="card__seller">
          <span class="card__seller-phone">${maskText(l.phone)}</span>
        </div>
        <div class="deadline-chip deadline-chip--${tone}" style="margin-bottom:10px;">
          <span class="deadline-chip__label">Next follow-up</span>
          <span class="deadline-chip__days">${followUpDaysLabel(days)}</span>
        </div>
        <div class="card__seller-actions">
          <button type="button" class="btn btn--mint-outline btn--xs" data-action="openLeadDraftModal" data-lead-id="${l.id}">TOUCH</button>
        </div>
        <div class="card__actions">
          <button type="button" class="btn btn--stamp-outline btn--xs" data-action="advanceLeadStage" data-lead-id="${l.id}" ${idx >= LEAD_STAGES.length - 1 ? 'disabled' : ''}>ADVANCE → ${escapeHtml(nextStage.label)}</button>
          <div class="move-menu-wrap">
            <button type="button" class="btn btn--ghost btn--xs" data-action="toggleMoveMenu" data-property-id="lead-${l.id}">MOVE ▾</button>
            <div class="move-menu" data-action="none">${leadStageOptionsHTML(l.stage)}</div>
          </div>
        </div>
      </div>
    </article>`;
}

/* ---------- 02 LISTINGS & SHOWINGS ---------- */

const LISTING_STATUS_LABEL = { coming_soon: 'Coming Soon', active: 'Active', pending: 'Pending', sold: 'Sold' };

function renderListingsPanel() {
  if (S.listings.length === 0) {
    return `
      <section class="panel">
        <div class="panel__dwg">DWG B-02</div>
        <h2 class="panel__title">Every listing's marketing gaps, spotted before a seller has to ask.</h2>
        ${emptyStateHTML('No listings yet.', 'Add your first listing and the marketing checklist keeps you honest — orange means something is missing.', '+ NEW LISTING', 'openNewListingModal')}
      </section>`;
  }
  const cards = S.listings.map(li => {
    const dom = Math.max(0, -daysUntil(li.listDate));
    const doneCount = li.marketingChecklist.filter(c => c.done).length;
    const checklistHTML = li.marketingChecklist.map(c => `
      <li class="reno-item ${c.done ? 'reno-item--done' : 'reno-item--pending'}" data-action="toggleMarketingItem" data-listing-id="${li.id}" data-item-id="${c.id}">
        <span class="reno-item__dot"></span> ${escapeHtml(c.label)} <span class="reno-item__status">${c.done ? 'done' : 'gap'}</span>
      </li>`).join('');
    const showingsHTML = li.showings.length ? li.showings.map(sh => `
      <div class="ledger-row">
        <div class="ledger-row__addr">${escapeHtml(sh.date)} — ${escapeHtml(sh.buyerName)}</div>
        <div class="ledger-row__line">${sh.feedback ? escapeHtml(sh.feedback) : `<button type="button" class="btn btn--ghost btn--xs" data-action="openLogFeedbackModal" data-listing-id="${li.id}" data-showing-id="${sh.id}">LOG FEEDBACK</button>`}</div>
      </div>`).join('') : '<p class="analyzer-note">No showings logged yet.</p>';
    return `
      <div class="reno-card">
        <div class="reno-card__head">
          <span class="reno-card__addr">${escapeHtml(li.address)}</span>
          <span class="card__strategy card__strategy--${li.status}">${LISTING_STATUS_LABEL[li.status] || li.status}</span>
        </div>
        <div class="card__nums" style="margin-bottom:8px;">
          <span>PRICE <b>${maskMoney(li.price)}</b></span>
          <span>DOM <b>${dom}</b></span>
          <span>MARKETING <b>${doneCount}/${li.marketingChecklist.length}</b></span>
        </div>
        <ul class="reno-items" style="margin-bottom:12px;">${checklistHTML}</ul>
        <div class="panel__toolbar" style="margin-bottom:8px;">
          <button type="button" class="btn btn--stamp-outline btn--xs" data-action="openScheduleShowingModal" data-listing-id="${li.id}">SCHEDULE SHOWING</button>
          <button type="button" class="btn btn--ghost btn--xs" data-action="openMarketingPlanModal" data-listing-id="${li.id}">3-WEEK MARKETING PLAN</button>
        </div>
        <div class="ledger">${showingsHTML}</div>
      </div>`;
  }).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG B-02</div>
      <h2 class="panel__title">Every listing's marketing gaps, spotted before a seller has to ask.</h2>
      <p class="panel__pitch">Orange means something on the checklist is still missing. Schedule a showing and the follow-up is already set.</p>
      <div class="panel__toolbar"><button type="button" class="btn btn--stamp" data-action="openNewListingModal">+ NEW LISTING</button></div>
      <div class="reno-grid">${cards}</div>
    </section>`;
}

/* ---------- 03 CONTRACTS ---------- */

function renderContractsPanel() {
  if (S.contracts.length === 0) {
    return `
      <section class="panel">
        <div class="panel__dwg">DWG B-03</div>
        <h2 class="panel__title">Six dots between an accepted offer and a paid commission — click them as they happen.</h2>
        ${emptyStateHTML('No contracts yet.', 'Once an offer is accepted, track it here milestone by milestone until it closes.', '+ NEW CONTRACT', 'openNewContractModal')}
      </section>`;
  }
  const rows = S.contracts.map(c => {
    const doneCount = c.milestones.filter(m => m.done).length;
    const closed = doneCount >= CONTRACT_MILESTONES.length;
    const dotsHTML = c.milestones.map((m, i) => {
      const isCurrent = !m.done && i === doneCount;
      const cls = m.done ? 'milestone-dot--done' : isCurrent ? 'milestone-dot--current' : 'milestone-dot--pending';
      return `<button type="button" class="milestone-dot ${cls}" data-action="advanceContractMilestone" data-contract-id="${c.id}" data-milestone-index="${i}" title="${escapeHtml(CONTRACT_MILESTONES[i].label)}">
        <span class="milestone-dot__mark"></span>
        <span class="milestone-dot__label">${escapeHtml(CONTRACT_MILESTONES[i].label)}</span>
      </button>`;
    }).join('<span class="milestone-connector"></span>');
    const gross = c.salePrice * (c.commissionRatePct / 100);
    const net = gross * (c.brokerSplitPct / 100);
    return `
      <div class="reno-card">
        <div class="reno-card__head">
          <span class="reno-card__addr">${escapeHtml(c.address)}</span>
          <span class="card__strategy card__strategy--${closed ? 'closed' : 'flip'}">${closed ? 'CLOSED' : 'IN PROGRESS'}</span>
        </div>
        <div class="reno-card__contractor">${escapeHtml(c.buyerName)} ↔ ${escapeHtml(c.sellerName)}</div>
        <div class="milestone-row">${dotsHTML}</div>
        <div class="card__nums" style="margin-top:10px;">
          <span>SALE PRICE <b>${maskMoney(c.salePrice)}</b></span>
          <span>NET COMMISSION <b>${maskMoney(net)}</b></span>
          <span class="card__profit">${c.commissionStatus === 'paid' ? 'PAID' : 'PENDING'}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG B-03</div>
      <h2 class="panel__title">Six dots between an accepted offer and a paid commission — click them as they happen.</h2>
      <p class="panel__pitch">The current step pulses orange. Click it the moment it's real, and it turns green and moves the deal forward.</p>
      <div class="panel__toolbar"><button type="button" class="btn btn--stamp" data-action="openNewContractModal">+ NEW CONTRACT</button></div>
      <div class="reno-grid">${rows}</div>
    </section>`;
}

/* ---------- 04 COMMISSIONS ---------- */

function renderCommissionsPanel() {
  if (S.contracts.length === 0) {
    return `
      <section class="panel">
        <div class="panel__dwg">DWG B-04</div>
        <h2 class="panel__title">Your commission income, tracked deal by deal — click any number to see it.</h2>
        ${emptyStateHTML('No commission data yet.', 'Once you have a contract on the board, the math runs itself here.', '+ NEW CONTRACT', 'openNewContractModal')}
      </section>`;
  }
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const now = new Date();
  const monthTotals = new Array(12).fill(0);
  S.contracts.forEach(c => {
    if (c.commissionStatus !== 'paid' || !c.closedDate) return;
    const d = new Date(c.closedDate + 'T00:00:00');
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo < 0 || monthsAgo > 11) return;
    const idx = (now.getMonth() - monthsAgo + 12) % 12;
    const gross = c.salePrice * (c.commissionRatePct / 100);
    monthTotals[idx] += gross * (c.brokerSplitPct / 100);
  });
  const maxVal = Math.max(1, ...monthTotals);
  const barW = 34, gap = 14, chartH = 130;
  const bars = months.map((m, i) => {
    const h = Math.max(2, monthTotals[i] / maxVal * (chartH - 30));
    const x = i * (barW + gap) + 10;
    return `<rect x="${x}" y="${chartH - 20 - h}" width="${barW}" height="${h}" fill="var(--mint)"></rect><text x="${x + barW / 2}" y="${chartH - 4}" font-size="9" text-anchor="middle" fill="var(--muted)">${m}</text>`;
  }).join('');
  const chartW = months.length * (barW + gap) + 10;

  const rows = S.contracts.map(c => {
    const gross = c.salePrice * (c.commissionRatePct / 100);
    const net = gross * (c.brokerSplitPct / 100);
    return `
      <tr>
        <td>${escapeHtml(c.address)}</td>
        <td class="reveal-money" data-action="toggleRevealAmount" data-amount-id="${c.id}-sp">${maskMoney(c.salePrice, revealedAmounts.has(c.id + '-sp'))}</td>
        <td>${fmtPct(c.commissionRatePct)}</td>
        <td class="reveal-money" data-action="toggleRevealAmount" data-amount-id="${c.id}-gross">${maskMoney(gross, revealedAmounts.has(c.id + '-gross'))}</td>
        <td>${fmtPct(c.brokerSplitPct)}</td>
        <td class="reveal-money text-mint" data-action="toggleRevealAmount" data-amount-id="${c.id}-net">${maskMoney(net, revealedAmounts.has(c.id + '-net'))}</td>
        <td>${c.commissionStatus === 'paid' ? 'PAID' : 'PENDING'}</td>
      </tr>`;
  }).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG B-04</div>
      <h2 class="panel__title">Your commission income, tracked deal by deal — click any number to see it.</h2>
      <p class="panel__pitch">Sale price × your rate = gross. Gross × your broker split = the part that's actually yours.</p>
      <div class="chart-box">
        <div class="chart-box__title">12-MONTH COMMISSION INCOME</div>
        <svg viewBox="0 0 ${chartW} ${chartH}" class="chart-box__svg">${bars}</svg>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Property</th><th>Sale Price</th><th>Rate</th><th>Gross</th><th>Split</th><th>Net (Yours)</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

const revealedAmounts = new Set();

/* ---------- 05 FOLLOW-UPS & MARKETING ---------- */

function renderFollowUpsPanel() {
  const leadRows = S.leads.filter(l => l.stage !== 'closed').map(l => ({ kind: 'lead', id: l.id, name: l.name, days: daysUntil(l.followUpDate), sub: l.role === 'buyer' ? `Buyer · ${l.area || 'area TBD'}` : `Seller · ${l.area || 'area TBD'}` }));
  const referralRows = S.referrals.map(r => ({ kind: 'referral', id: r.id, name: r.name, days: daysUntil(r.nextTouchDate), sub: 'Past client' }));
  const all = leadRows.concat(referralRows).sort((a, b) => a.days - b.days);

  const rowsHTML = all.length ? all.map(item => {
    const tone = followUpTone(item.days);
    return `
      <div class="deadline-chip deadline-chip--${tone}">
        <span class="deadline-chip__label">${escapeHtml(item.name)} — ${escapeHtml(item.sub)}</span>
        <span class="deadline-chip__days">${followUpDaysLabel(item.days)}</span>
        ${item.kind === 'lead'
          ? `<button type="button" class="btn btn--mint btn--xs" data-action="openLeadDraftModal" data-lead-id="${item.id}">DRAFT</button>`
          : `<button type="button" class="btn btn--mint btn--xs" data-action="logReferralTouch" data-referral-id="${item.id}">LOG TOUCH</button>`}
      </div>`;
  }).join('') : emptyStateHTML('Nobody is owed a touch right now.', 'When a lead or referral comes due, they will show up here, most overdue first.', 'GO TO LEAD PIPELINE', 'gotoLeadPipeline');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG B-05</div>
      <h2 class="panel__title">Everyone owed a touch today, most overdue at the top — so nobody goes cold.</h2>
      <p class="panel__pitch">DRAFT writes a finished, personalized message from their real details. Copy & log it and the next follow-up sets itself.</p>
      <div class="deadline-list">${rowsHTML}</div>
    </section>`;
}

/* ---------- 06 REFERRALS ---------- */

function renderReferralsPanel() {
  if (S.referrals.length === 0) {
    return `
      <section class="panel">
        <div class="panel__dwg">DWG B-06</div>
        <h2 class="panel__title">Your past clients are your best lead source — as long as you don't forget them.</h2>
        ${emptyStateHTML('No past clients tracked yet.', 'Add someone you closed for and their next-touch countdown starts here.', '+ ADD REFERRAL', 'openNewReferralModal')}
      </section>`;
  }
  const cards = S.referrals.slice().sort((a, b) => daysUntil(a.nextTouchDate) - daysUntil(b.nextTouchDate)).map(r => {
    const days = daysUntil(r.nextTouchDate);
    const tone = followUpTone(days);
    return `
      <div class="lender-card">
        <div class="lender-card__name">${escapeHtml(r.name)}</div>
        <div class="lender-card__contact">${maskText(r.phone)} · ${maskText(r.email)}</div>
        <div class="deadline-chip deadline-chip--${tone}" style="margin-top:10px;">
          <span class="deadline-chip__label">Next touch</span>
          <span class="deadline-chip__days">${followUpDaysLabel(days)}</span>
        </div>
        <div class="panel__toolbar" style="margin-top:10px;">
          <button type="button" class="btn btn--mint btn--xs" data-action="logReferralTouch" data-referral-id="${r.id}">LOG TOUCH</button>
        </div>
      </div>`;
  }).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG B-06</div>
      <h2 class="panel__title">Your past clients are your best lead source — as long as you don't forget them.</h2>
      <p class="panel__pitch">A quiet countdown for every relationship worth keeping warm.</p>
      <div class="panel__toolbar"><button type="button" class="btn btn--stamp" data-action="openNewReferralModal">+ ADD REFERRAL</button></div>
      <div class="lender-grid">${cards}</div>
    </section>`;
}
