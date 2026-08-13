/* ============================================================
   NTM DEAL CENTER — Ctrl-K finder
   ============================================================ */

let finderResults = [];
let finderIndex = -1;

function searchProperties(query) {
  const q = query.trim().toLowerCase();
  if (!q) return S.properties.slice(0, 8);
  return S.properties.filter(p => {
    const stageLabel = (STAGES.find(s => s.key === p.stage) || {}).label || '';
    return [p.address, p.city, p.owner, p.ownerPhone, p.ownerEmail, stageLabel, p.strategy]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
  }).slice(0, 25);
}

function openFinder() {
  const root = document.getElementById('finderRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay" data-action="closeFinder">
      <div class="modal modal--finder" data-action="none">
        <input type="text" id="finderInput" class="finder-input" placeholder="Find by address, owner, phone, or stage..." autocomplete="off">
        <div class="finder-results" id="finderResults"></div>
        <div class="finder-hint">↑↓ to move · ENTER to jump · ESC to close</div>
      </div>
    </div>`;
  const input = document.getElementById('finderInput');
  input.addEventListener('input', () => runFinderSearch(input.value));
  input.addEventListener('keydown', onFinderKeydown);
  runFinderSearch('');
  setTimeout(() => input.focus(), 0);
}

function closeFinder() {
  const root = document.getElementById('finderRoot');
  if (root) root.innerHTML = '';
  finderResults = [];
  finderIndex = -1;
}

function runFinderSearch(query) {
  finderResults = searchProperties(query);
  finderIndex = finderResults.length ? 0 : -1;
  renderFinderResults();
}

function renderFinderResults() {
  const box = document.getElementById('finderResults');
  if (!box) return;
  if (!finderResults.length) { box.innerHTML = `<div class="finder-empty">No matches yet — try a different address, name, or phone.</div>`; return; }
  box.innerHTML = finderResults.map((p, i) => {
    const stageLabel = (STAGES.find(s => s.key === p.stage) || {}).label || '';
    return `
      <div class="finder-result ${i === finderIndex ? 'is-active' : ''}" data-action="jumpToResult" data-property-id="${p.id}" data-index="${i}">
        <span class="finder-result__addr">${escapeHtml(p.address)}</span>
        <span class="finder-result__meta">${escapeHtml(stageLabel)}${p.owner ? ' · ' + escapeHtml(p.owner) : ''}${p.ownerPhone ? ' · ' + escapeHtml(p.ownerPhone) : ''}</span>
      </div>`;
  }).join('');
}

function scrollFinderActiveIntoView() {
  const box = document.getElementById('finderResults');
  if (!box) return;
  const active = box.querySelector('.finder-result.is-active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function onFinderKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (finderResults.length) finderIndex = Math.min(finderResults.length - 1, finderIndex + 1);
    renderFinderResults();
    scrollFinderActiveIntoView();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (finderResults.length) finderIndex = Math.max(0, finderIndex - 1);
    renderFinderResults();
    scrollFinderActiveIntoView();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const p = finderResults[finderIndex];
    if (p) jumpToPropertyId(p.id);
  } else if (e.key === 'Escape') {
    closeFinder();
  }
}

function jumpToPropertyId(id) {
  const p = getProperty(id);
  if (!p) return;
  closeFinder();
  S.meta.activeSheet = 'A';
  S.meta.activeSubtabA = '01';
  S.filters.pipelineStrategy = 'all';
  S.meta.mobileStageIndex = STAGE_INDEX[p.stage];
  persistView();
  followCard(id);
}

ACTIONS.closeFinder = function () { closeFinder(); };
ACTIONS.jumpToResult = function (el) { jumpToPropertyId(el.dataset.propertyId); };
