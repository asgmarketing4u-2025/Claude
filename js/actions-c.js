/* ============================================================
   NTM DEAL CENTER — Sheet C actions (Operations)
   ============================================================ */

const SNAPSHOTS_KEY = 'ntmDealCenterSnapshots';

// Transient (not persisted) — mutate() re-renders the whole panel right after
// an import, which would otherwise wipe the "N of M rows" message before
// anyone could read it.
let lastCsvContactsResult = '';
let lastCsvPropertiesResult = '';

function loadSnapshotsList() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveSnapshotsList(list) {
  try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list)); } catch (e) { /* storage full/unavailable */ }
}

function copyToClipboard(text, onDone) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onDone).catch(onDone);
  } else {
    onDone();
  }
}

Object.assign(ACTIONS, {
  setSubtabC(el) { S.meta.activeSubtabC = el.dataset.subtab; persistView(); },

  copyBriefingText() {
    copyToClipboard(buildBriefingText(), () => showToast('Daily briefing copied.', { tone: 'ok' }));
  },
  copyReportText() {
    const d = buildWeeklyReportData();
    const w = buildWeeklyWriteup(d);
    const text = [
      `NTM DEAL CENTER — WEEKLY REPORT — ${new Date().toLocaleDateString('en-US')}`,
      '',
      `New Leads: ${d.newLeads}`,
      `Showings: ${d.showings}`,
      `Contracts Closed: ${d.closedContracts.length}`,
      `Commission Earned: ${fmtMoney(d.commissionThisWeek)}`,
      `New Investor Deals: ${d.newInvestorDeals}`,
      `Open Items: ${d.urgentCount}`,
      '',
      'INVESTOR: ' + w.investor,
      'REALTOR: ' + w.realtor,
      'RISKS: ' + w.risks,
      'NEXT 7 DAYS: ' + w.next7,
    ].join('\n');
    copyToClipboard(text, () => showToast('Weekly report copied.', { tone: 'ok' }));
  },

  openSnapshotModal() { openSnapshotModal(); },
  saveSnapshotNow() { saveSnapshotNow(); },
  reopenSnapshot(el) { reopenSnapshot(el.dataset.snapshotId); },
  duplicateSnapshot(el) { duplicateSnapshot(el.dataset.snapshotId); },
  deleteSnapshot(el) { deleteSnapshot(el.dataset.snapshotId); },

  copyShareLink() { copyShareLink(); },
  downloadBackup() { downloadBackup(); },
  openRestoreModal() { openRestoreModal(); },
  confirmResetSample() { confirmResetSample(); },

  connectLabKeyBtn() { connectLabKeyBtn(); },
  disconnectLabKeyBtn() { disconnectLabKey(); persistView(); },
  labKeepLocal() { closeModal(); if (!isDemoLocked()) pushBoard(); },
  labLoadCloud() {
    const remote = window.__ntmPendingRemote;
    closeModal();
    if (remote && remote.state) {
      S = remote.state;
      S.meta.syncRev = remote.rev;
      _originalSave();
      render();
      showToast('Loaded the cloud board.', { tone: 'ok' });
    }
  },
});

/* ---------- Snapshots ---------- */

function openSnapshotModal() {
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>+ SAVE SNAPSHOT</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <label class="field field--wide"><span class="field__label">NAME</span><input type="text" id="snapName" placeholder="Before spring cleanup..."></label>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="saveSnapshotNow">SAVE</button>
        </div>
      </div>
    </div>`);
}

function saveSnapshotNow() {
  const name = (document.getElementById('snapName').value || '').trim() || `Snapshot ${new Date().toLocaleString()}`;
  const list = loadSnapshotsList();
  list.unshift({ id: uid('snap'), name, ts: Date.now(), data: JSON.stringify(S) });
  saveSnapshotsList(list.slice(0, 20));
  closeModal();
  mutate(`Saved snapshot "${name}".`, { silent: true });
}

function reopenSnapshot(id) {
  const list = loadSnapshotsList();
  const snap = list.find(s => s.id === id);
  if (!snap) return;
  const before = snapshotState();
  try {
    S = JSON.parse(snap.data);
    mutate(`Reopened snapshot "${snap.name}".`, { undoSnapshot: before, tone: 'warn' });
  } catch (e) {
    showToast('Could not read that snapshot.', { tone: 'danger' });
  }
}

function duplicateSnapshot(id) {
  const list = loadSnapshotsList();
  const snap = list.find(s => s.id === id);
  if (!snap) return;
  list.unshift({ id: uid('snap'), name: snap.name + ' (copy)', ts: Date.now(), data: snap.data });
  saveSnapshotsList(list.slice(0, 20));
  persistView();
  showToast('Snapshot duplicated.', { tone: 'ok' });
}

function deleteSnapshot(id) {
  const list = loadSnapshotsList().filter(s => s.id !== id);
  saveSnapshotsList(list);
  persistView();
  showToast('Snapshot deleted.', { tone: 'warn' });
}

/* ---------- Share link / backup / restore / reset ---------- */

function copyShareLink() {
  const stripped = stripPhotosForSync(S);
  const json = JSON.stringify(stripped);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const url = location.origin + location.pathname + '#board=' + b64;
  copyToClipboard(url, () => showToast('Share link copied — anyone who opens it sees this board (view-only unless they unlock).', { tone: 'ok', duration: 5000 }));
}

function downloadBackup() {
  try {
    const json = JSON.stringify(S, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ntm-deal-center-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup downloaded.', { tone: 'ok' });
  } catch (e) {
    showToast('Could not create the backup file.', { tone: 'danger' });
  }
}

function openRestoreModal() {
  openModal(`
    <div class="modal-overlay" data-action="closeModalOverlay">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>RESTORE FROM FILE</h3><button type="button" class="btn btn--ghost btn--xs" data-action="closeModal">✕</button></div>
        <div class="modal__body">
          <p class="analyzer-note">This replaces your current board. You'll get a 10-second undo after.</p>
          <input type="file" id="restoreFileInput" accept="application/json,.json" data-demo-allow="1">
        </div>
        <div class="modal__foot"><button type="button" class="btn btn--ghost" data-action="closeModal">CANCEL</button></div>
      </div>
    </div>`);
  const input = document.getElementById('restoreFileInput');
  if (input) {
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const before = snapshotState();
          S = migrateState(parsed);
          closeModal();
          mutate('Restored board from backup file.', { undoSnapshot: before, tone: 'warn', duration: 10000 });
        } catch (e) {
          showToast('That file could not be read as a backup.', { tone: 'danger' });
        }
      };
      reader.readAsText(file);
    });
  }
}

function confirmResetSample() {
  resetToSampleData();
}

/* ---------- Lab Link connect/disconnect ---------- */

function connectLabKeyBtn() {
  const input = document.getElementById('labKeyInput');
  const key = input ? input.value.trim() : '';
  if (!key) { showToast('Enter a Lab Key first.', { tone: 'danger' }); return; }
  connectLabKey(key).then(() => persistView());
}

/* ---------- CSV intake + document attach wiring ---------- */

function afterRenderDataIntake() {
  const contactsInput = document.getElementById('csvContactsInput');
  if (contactsInput) contactsInput.addEventListener('change', () => handleContactsCsv(contactsInput));

  const propsInput = document.getElementById('csvPropertiesInput');
  if (propsInput) propsInput.addEventListener('change', () => handlePropertiesCsv(propsInput));

  const linkType = document.getElementById('docLinkType');
  const propGroup = document.getElementById('docLinkPropertyGroup');
  const ctrGroup = document.getElementById('docLinkContractGroup');
  function syncDocGroups() {
    if (!linkType || !propGroup || !ctrGroup) return;
    propGroup.hidden = linkType.value !== 'property';
    ctrGroup.hidden = linkType.value !== 'contract';
  }
  if (linkType) { linkType.addEventListener('change', syncDocGroups); syncDocGroups(); }

  const docInput = document.getElementById('docFileInput');
  if (docInput) docInput.addEventListener('change', () => handleDocumentUpload(docInput));
}

function handleContactsCsv(input) {
  const file = input.files[0];
  if (!file) return;
  const progress = startProgress('Importing contacts', ['Reading file', 'Matching columns', 'Creating leads']);
  progress.advance();
  const reader = new FileReader();
  reader.onload = () => {
    progress.advance();
    const { records, skipped, total } = parseCsvRows(reader.result, {
      name: ['name', 'full name', 'contact name'],
      role: ['role', 'type'],
      source: ['source'],
      phone: ['phone', 'phone number'],
      email: ['email'],
      budget: ['budget', 'price'],
      area: ['area', 'neighborhood'],
      loanStatus: ['loan status', 'loan'],
    }, 'name');
    const created = records.map(r => seedLead({
      name: r.name,
      role: (r.role || '').toLowerCase().indexOf('sell') === 0 ? 'seller' : 'buyer',
      source: r.source || 'CSV Import',
      phone: r.phone, email: r.email,
      budget: parseMoney(r.budget), area: r.area,
      loanStatus: r.loanStatus || 'Not started',
    }));
    S.leads.push(...created);
    progress.advance();
    lastCsvContactsResult = `Imported ${created.length} of ${total} rows (${skipped} skipped — missing a name).`;
    mutate(`Imported ${created.length} lead${created.length === 1 ? '' : 's'} from CSV.`, { tone: 'ok' });
  };
  reader.onerror = () => progress.error('Could not read that file.');
  reader.readAsText(file);
}

function handlePropertiesCsv(input) {
  const file = input.files[0];
  if (!file) return;
  const progress = startProgress('Importing properties', ['Reading file', 'Matching columns', 'Creating deals']);
  progress.advance();
  const reader = new FileReader();
  reader.onload = () => {
    progress.advance();
    const { records, skipped, total } = parseCsvRows(reader.result, {
      address: ['address', 'street address', 'property address'],
      strategy: ['strategy'],
      askingPrice: ['asking price', 'price'],
      repairs: ['repairs', 'rehab'],
      arv: ['arv'],
      beds: ['beds', 'bedrooms'],
      baths: ['baths', 'bathrooms'],
      sqft: ['sqft', 'square feet'],
    }, 'address');
    const strategies = STRATEGIES.map(s => s.key);
    const created = records.map(r => {
      const askingPrice = parseMoney(r.askingPrice);
      return seedProperty({
        addr: { line1: r.address, city: 'Baltimore', state: 'MD', zip: '21201' },
        strategy: strategies.indexOf((r.strategy || '').toLowerCase()) !== -1 ? r.strategy.toLowerCase() : 'flip',
        askingPrice, price: askingPrice,
        repairs: parseMoney(r.repairs), arv: parseMoney(r.arv),
        beds: Number(r.beds) || 3, baths: Number(r.baths) || 1, sqft: Number(r.sqft) || 1200,
      });
    });
    S.properties.push(...created);
    progress.advance();
    lastCsvPropertiesResult = `Imported ${created.length} of ${total} rows (${skipped} skipped — missing an address).`;
    mutate(`Imported ${created.length} propert${created.length === 1 ? 'y' : 'ies'} from CSV.`, { tone: 'ok' });
  };
  reader.onerror = () => progress.error('Could not read that file.');
  reader.readAsText(file);
}

function handleDocumentUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const linkType = document.getElementById('docLinkType').value;
  const linkId = document.getElementById('docLinkId').value;
  if (!linkId) { showToast('Pick something to attach the document to.', { tone: 'danger' }); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const linkedLabel = linkType === 'property' ? (getProperty(linkId) || {}).address : (getContract(linkId) || {}).address;
    S.documents.push({
      id: uid('doc'), name: file.name, dataUrl: reader.result,
      linkedType: linkType, linkedId: linkId, linkedLabel: linkedLabel || linkId,
      uploadedAt: Date.now(),
    });
    mutate(`Attached "${file.name}" to ${linkedLabel || linkId}.`, { tone: 'ok' });
  };
  reader.onerror = () => showToast('Could not read that file.', { tone: 'danger' });
  reader.readAsDataURL(file);
}
