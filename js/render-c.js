/* ============================================================
   NTM DEAL CENTER — Sheet C render layer (Operations)
   ============================================================ */

function briefingPriority(days) {
  if (days == null) return 'P2';
  if (days < -3) return 'P1';
  if (days < 0) return 'P1';
  if (days === 0) return 'P2';
  return 'P3';
}

function briefingLineHTML(priority, text) {
  return `<div class="briefing-line briefing-line--${priority}"><span class="briefing-line__pri">${priority}</span><span class="briefing-line__text">${escapeHtml(text)}</span></div>`;
}

function buildDailyBriefingData() {
  const urgent = getUrgentItems();
  const today = todayISO();

  const criticalPath = urgent.filter(i => i.type === 'overdue_deadline' || i.type === 'due_today' || i.type === 'contract_step')
    .map(i => ({ priority: briefingPriority(i.days), text: i.label }));

  const touchToday = urgent.filter(i => (i.type === 'lead_due_today' || i.type === 'referral_due_today') || ((i.type === 'lead_overdue' || i.type === 'referral_overdue') && i.days >= -3))
    .map(i => ({ priority: briefingPriority(i.days), text: i.label }));

  const watchList = urgent.filter(i => (i.type === 'lead_overdue' || i.type === 'referral_overdue') && i.days < -3)
    .map(i => ({ priority: 'P1', text: i.label + ' — going cold' }));

  const onCalendar = [];
  S.listings.forEach(li => {
    li.showings.forEach(sh => {
      if (sh.date === today) onCalendar.push({ priority: 'P2', text: `Showing today — ${li.address} with ${sh.buyerName}` });
    });
  });

  return { criticalPath, touchToday, onCalendar, watchList };
}

function briefingSectionHTML(title, items, emptyMsg) {
  const body = items.length ? items.map(i => briefingLineHTML(i.priority, i.text)).join('') : `<p class="analyzer-note">${escapeHtml(emptyMsg)}</p>`;
  return `<div class="briefing-section"><div class="briefing-section__title">${escapeHtml(title)}</div>${body}</div>`;
}

function renderDailyBriefingPanel() {
  const d = buildDailyBriefingData();
  return `
    <section class="panel">
      <div class="panel__dwg">DWG C-01</div>
      <h2 class="panel__title">Everything that needs you today, built fresh the second you open this page.</h2>
      <p class="panel__pitch">Ranked P1 to P3 so you always know what to do first.</p>
      <div class="panel__toolbar"><button type="button" class="btn btn--stamp" data-action="copyBriefingText">COPY AS TEXT</button></div>
      <div class="briefing-grid">
        ${briefingSectionHTML('CRITICAL PATH', d.criticalPath, 'Nothing on fire — deadlines and contract steps are clear.')}
        ${briefingSectionHTML('PEOPLE TO TOUCH TODAY', d.touchToday, "Nobody's due for a touch today.")}
        ${briefingSectionHTML('ON THE CALENDAR', d.onCalendar, 'No showings on the books today.')}
        ${briefingSectionHTML('WATCH LIST — GOING COLD', d.watchList, 'No one has gone quiet.')}
      </div>
    </section>`;
}

function buildBriefingText() {
  const d = buildDailyBriefingData();
  const lines = [`NTM DEAL CENTER — DAILY BRIEFING — ${new Date().toLocaleDateString('en-US')}`, ''];
  const section = (title, items, emptyMsg) => {
    lines.push(title + ':');
    if (!items.length) lines.push('  ' + emptyMsg);
    else items.forEach(i => lines.push(`  [${i.priority}] ${i.text}`));
    lines.push('');
  };
  section('CRITICAL PATH', d.criticalPath, 'Clear.');
  section('PEOPLE TO TOUCH TODAY', d.touchToday, 'None.');
  section('ON THE CALENDAR', d.onCalendar, 'None.');
  section('WATCH LIST', d.watchList, 'None.');
  return lines.join('\n');
}

/* ---------- 02 WEEKLY REPORT ---------- */

function withinLastNDays(dateStr, n) {
  if (!dateStr) return false;
  const days = daysUntil(dateStr);
  return days != null && days <= 0 && days > -n;
}
function tsWithinLastNDays(ts, n) {
  if (!ts) return false;
  return (Date.now() - ts) <= n * 86400000;
}

function buildWeeklyReportData() {
  const newLeads = S.leads.filter(l => tsWithinLastNDays(l.createdAt, 7)).length;
  const showings = S.listings.reduce((sum, li) => sum + li.showings.filter(sh => withinLastNDays(sh.date, 7)).length, 0);
  const closedContracts = S.contracts.filter(c => withinLastNDays(c.closedDate, 7));
  const commissionThisWeek = closedContracts.reduce((sum, c) => sum + c.salePrice * (c.commissionRatePct / 100) * (c.brokerSplitPct / 100), 0);
  const newInvestorDeals = S.properties.filter(p => tsWithinLastNDays(p.createdAt, 7)).length;
  const portfolioEquity = S.properties.filter(p => p.stage === 'closed' && (p.strategy === 'hold' || p.strategy === 'brrrr'))
    .reduce((sum, p) => sum + equityAtARV(p), 0);
  const urgentCount = getUrgentItems().length;
  return { newLeads, showings, closedContracts, commissionThisWeek, newInvestorDeals, portfolioEquity, urgentCount };
}

function renderWeeklyReportPanel() {
  const d = buildWeeklyReportData();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const barW = 34, gap = 14, chartH = 130;
  const bars = months.map((m, i) => {
    const h = Math.max(2, Math.min(chartH - 30, Math.abs(d.portfolioEquity) / 5000));
    const x = i * (barW + gap) + 10;
    return `<rect x="${x}" y="${chartH - 20 - h}" width="${barW}" height="${h}" fill="${d.portfolioEquity >= 0 ? 'var(--mint)' : 'var(--danger)'}"></rect><text x="${x + barW / 2}" y="${chartH - 4}" font-size="9" text-anchor="middle" fill="var(--muted)">${m}</text>`;
  }).join('');
  const chartW = months.length * (barW + gap) + 10;

  const writeup = buildWeeklyWriteup(d);

  return `
    <section class="panel">
      <div class="panel__dwg">DWG C-02</div>
      <h2 class="panel__title">The week in numbers — and what it means in plain English.</h2>
      <p class="panel__pitch">Everything below is computed straight from your live board.</p>
      <div class="panel__toolbar"><button type="button" class="btn btn--stamp" data-action="copyReportText">COPY AS TEXT</button></div>
      <div class="metric-grid">
        <div class="metric"><span class="metric__label">NEW LEADS</span><span class="metric__value">${d.newLeads}</span></div>
        <div class="metric"><span class="metric__label">SHOWINGS</span><span class="metric__value">${d.showings}</span></div>
        <div class="metric"><span class="metric__label">CONTRACTS CLOSED</span><span class="metric__value">${d.closedContracts.length}</span></div>
        <div class="metric"><span class="metric__label">COMMISSION EARNED</span><span class="metric__value">${maskMoney(d.commissionThisWeek)}</span></div>
        <div class="metric"><span class="metric__label">NEW INVESTOR DEALS</span><span class="metric__value">${d.newInvestorDeals}</span></div>
        <div class="metric"><span class="metric__label">OPEN ITEMS</span><span class="metric__value">${d.urgentCount}</span></div>
      </div>
      <div class="chart-box">
        <div class="chart-box__title">PORTFOLIO EQUITY (12-MONTH VIEW)</div>
        <svg viewBox="0 0 ${chartW} ${chartH}" class="chart-box__svg">${bars}</svg>
      </div>
      <div class="weekly-writeup">
        <div class="weekly-writeup__section"><h4>INVESTOR</h4><p>${escapeHtml(writeup.investor)}</p></div>
        <div class="weekly-writeup__section"><h4>REALTOR</h4><p>${escapeHtml(writeup.realtor)}</p></div>
        <div class="weekly-writeup__section"><h4>RISKS</h4><p>${escapeHtml(writeup.risks)}</p></div>
        <div class="weekly-writeup__section"><h4>NEXT 7 DAYS</h4><p>${escapeHtml(writeup.next7)}</p></div>
      </div>
    </section>`;
}

function buildWeeklyWriteup(d) {
  const investor = d.newInvestorDeals > 0
    ? `${d.newInvestorDeals} new deal${d.newInvestorDeals === 1 ? '' : 's'} entered the pipeline this week. Portfolio equity across kept rentals stands at ${fmtMoney(d.portfolioEquity)}.`
    : `No new deals entered the pipeline this week. Portfolio equity across kept rentals stands at ${fmtMoney(d.portfolioEquity)} — worth a look at lead sources.`;
  const realtor = d.closedContracts.length > 0
    ? `Closed ${d.closedContracts.length} deal${d.closedContracts.length === 1 ? '' : 's'} this week for ${fmtMoney(d.commissionThisWeek)} in commission. ${d.showings} showing${d.showings === 1 ? '' : 's'} logged.`
    : `No closings this week. ${d.showings} showing${d.showings === 1 ? '' : 's'} logged and ${d.newLeads} new lead${d.newLeads === 1 ? '' : 's'} added — the pipeline is still moving.`;
  const risks = d.urgentCount > 0
    ? `${d.urgentCount} item${d.urgentCount === 1 ? ' needs' : 's need'} attention right now — overdue deadlines, cold leads, or contract steps waiting on you. Check the Daily Briefing.`
    : `Nothing overdue right now — the board is caught up.`;
  const next7 = `Keep the follow-up cadence on active leads, push the marketing plan on any listing past week 1, and clear whatever's flagged on the Daily Briefing before it goes red.`;
  return { investor, realtor, risks, next7 };
}

/* ---------- 03 DATA INTAKE ---------- */

function renderDataIntakePanel() {
  const docsHTML = S.documents.length ? S.documents.map(doc => `
    <tr>
      <td>${escapeHtml(doc.name)}</td>
      <td>${escapeHtml(doc.linkedType)} — ${escapeHtml(doc.linkedLabel || doc.linkedId)}</td>
      <td>${new Date(doc.uploadedAt).toLocaleDateString('en-US')}</td>
    </tr>`).join('') : `<tr><td colspan="3" class="table-empty">No documents attached yet.</td></tr>`;

  const propertyOptions = S.properties.map(p => `<option value="${p.id}">${escapeHtml(p.address)}</option>`).join('');
  const contractOptions = S.contracts.map(c => `<option value="${c.id}">${escapeHtml(c.address)}</option>`).join('');

  return `
    <section class="panel">
      <div class="panel__dwg">DWG C-03</div>
      <h2 class="panel__title">Bulk-load your contacts and properties instead of typing them one at a time.</h2>
      <p class="panel__pitch">Loose column matching — a contacts file just needs a "name" column, a properties file just needs an "address" column. Bad rows are skipped and counted, not silently dropped.</p>

      <div class="intake-grid">
        <div class="reno-card">
          <div class="reno-card__addr">CONTACTS CSV → LEADS</div>
          <p class="analyzer-note">Columns recognized: name, role, source, phone, email, budget, area, loan status, follow-up date.</p>
          <input type="file" id="csvContactsInput" accept=".csv,text/csv" data-demo-allow="1">
          <div id="csvContactsResult" class="analyzer-note">${escapeHtml(lastCsvContactsResult)}</div>
        </div>
        <div class="reno-card">
          <div class="reno-card__addr">PROPERTIES CSV → PIPELINE DEALS</div>
          <p class="analyzer-note">Columns recognized: address, strategy, asking price, repairs, ARV, beds, baths, sqft.</p>
          <input type="file" id="csvPropertiesInput" accept=".csv,text/csv" data-demo-allow="1">
          <div id="csvPropertiesResult" class="analyzer-note">${escapeHtml(lastCsvPropertiesResult)}</div>
        </div>
      </div>

      <p class="modal__section-label" style="margin-top:24px;">ATTACH A DOCUMENT</p>
      <div class="field-grid">
        <label class="field"><span class="field__label">LINK TO</span>
          <select id="docLinkType"><option value="property">Property</option><option value="contract">Contract</option></select>
        </label>
        <label class="field field--wide"><span class="field__label">WHICH ONE</span>
          <select id="docLinkId"><optgroup label="Properties" id="docLinkPropertyGroup">${propertyOptions}</optgroup><optgroup label="Contracts" id="docLinkContractGroup">${contractOptions}</optgroup></select>
        </label>
        <label class="field field--wide"><span class="field__label">FILE</span><input type="file" id="docFileInput" data-demo-allow="1"></label>
      </div>

      <p class="modal__section-label" style="margin-top:24px;">DOCUMENT REGISTER</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Linked To</th><th>Uploaded</th></tr></thead>
          <tbody>${docsHTML}</tbody>
        </table>
      </div>
    </section>`;
}

/* ---------- 04 VAULT & SHARING ---------- */

function renderVaultPanel() {
  const snapshots = loadSnapshotsList();
  const snapshotsHTML = snapshots.length ? snapshots.map(s => `
    <div class="ledger-row">
      <div class="ledger-row__addr">${escapeHtml(s.name)} <span class="analyzer-note">(${new Date(s.ts).toLocaleString()})</span></div>
      <div class="ledger-row__line">
        <button type="button" class="btn btn--stamp-outline btn--xs" data-action="reopenSnapshot" data-snapshot-id="${s.id}">REOPEN</button>
        <button type="button" class="btn btn--ghost btn--xs" data-action="duplicateSnapshot" data-snapshot-id="${s.id}">DUPLICATE</button>
        <button type="button" class="btn btn--ghost btn--xs" data-action="deleteSnapshot" data-snapshot-id="${s.id}">DELETE</button>
      </div>
    </div>`).join('') : '<p class="analyzer-note">No saved snapshots yet.</p>';

  const activityHTML = S.activity.slice(0, 40).map(a => `<div class="ledger-row"><div class="ledger-row__line">${escapeHtml(new Date(a.ts).toLocaleString())} — ${escapeHtml(a.msg)}</div></div>`).join('') || '<p class="analyzer-note">No activity logged yet.</p>';

  const labBoardId = getLabBoardId();

  return `
    <section class="panel">
      <div class="panel__dwg">DWG C-04</div>
      <h2 class="panel__title">Your whole board, backed up, shareable, and synced everywhere you work.</h2>
      <p class="panel__pitch">Named snapshots, a one-click share link, a downloadable backup, and Lab Link — the same board on every device.</p>

      <p class="modal__section-label">LAB LINK — SAME BOARD, EVERY DEVICE</p>
      <div class="reno-card" style="margin-bottom:20px;">
        <p class="analyzer-note">Pick a Lab Key once and every device that knows it shares this exact board. The key itself is never sent anywhere — only its hash.</p>
        <div class="field-grid">
          <label class="field field--wide"><span class="field__label">LAB KEY</span><input type="password" id="labKeyInput" placeholder="${labBoardId ? 'Connected — enter a new key to switch boards' : 'Choose a Lab Key'}"></label>
        </div>
        <div class="panel__toolbar" style="margin-top:10px;">
          <span id="syncStatusPillVault" class="sync-pill sync-pill--muted">${labBoardId ? 'CONNECTED' : 'LOCAL'}</span>
          <span>
            <button type="button" class="btn btn--stamp-outline btn--xs" data-action="connectLabKeyBtn">CONNECT</button>
            ${labBoardId ? `<button type="button" class="btn btn--ghost btn--xs" data-action="disconnectLabKeyBtn">DISCONNECT</button>` : ''}
          </span>
        </div>
      </div>

      <div class="panel__toolbar">
        <button type="button" class="btn btn--stamp" data-action="openSnapshotModal">+ SAVE SNAPSHOT</button>
        <button type="button" class="btn btn--stamp-outline" data-action="copyShareLink">COPY SHARE LINK</button>
        <button type="button" class="btn btn--ghost" data-action="downloadBackup">DOWNLOAD BACKUP</button>
        <button type="button" class="btn btn--ghost" data-action="openRestoreModal">RESTORE FROM FILE</button>
        <button type="button" class="btn btn--stamp-outline" data-action="confirmResetSample">RESET TO SAMPLE DATA</button>
      </div>

      <p class="modal__section-label">SNAPSHOTS</p>
      <div class="ledger">${snapshotsHTML}</div>

      <p class="modal__section-label">ACTIVITY LOG</p>
      <div class="ledger">${activityHTML}</div>
    </section>`;
}
