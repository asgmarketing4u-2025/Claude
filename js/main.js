/* ============================================================
   NTM DEAL CENTER — boot
   ============================================================ */

function measureHeaderHeight() {
  const header = document.getElementById('titleBlock');
  if (!header) return;
  const h = header.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--header-h', h + 'px');
}

function safeUpdateUrl() {
  try {
    const hash = '#' + S.meta.activeSheet + '-' + (S.meta.activeSheet === 'A' ? S.meta.activeSubtabA : '00');
    history.replaceState(null, '', hash);
  } catch (e) {
    // file:// throws a SecurityError on history.replaceState — safe to ignore.
  }
}

// A pasted share link looks like #board=<base64 JSON>. Loads it straight into
// memory for viewing without touching localStorage — nothing is persisted
// until a real (unlocked) action saves it. Returns true if it consumed one.
function tryLoadSharedBoardFromHash() {
  const hash = location.hash || '';
  const m = hash.match(/^#board=(.+)$/);
  if (!m) return false;
  try {
    const json = decodeURIComponent(escape(atob(m[1])));
    const parsed = JSON.parse(json);
    S = migrateState(parsed);
    return true;
  } catch (e) {
    return false;
  }
}

function onGlobalKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openFinder();
    return;
  }
  if (e.key === 'Escape') {
    const finderRoot = document.getElementById('finderRoot');
    if (finderRoot && finderRoot.innerHTML.trim()) { closeFinder(); return; }
    const modalRoot = document.getElementById('modalRoot');
    if (modalRoot && modalRoot.innerHTML.trim()) { closeModal(); return; }
  }
}

// Mobile one-stage board: only counts as a swipe when clearly horizontal,
// so ordinary vertical scrolling through a column is never hijacked.
function setupSwipeHandlers() {
  let touchActive = false, startX = 0, startY = 0;

  document.addEventListener('touchstart', (e) => {
    const board = e.target.closest && e.target.closest('#kanbanBoard');
    if (!board || !e.touches[0]) { touchActive = false; return; }
    touchActive = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0) ACTIONS.pipelinePagerNext();
      else ACTIONS.pipelinePagerPrev();
    }
  }, { passive: true });
}

function boot() {
  const loadedFromShareLink = tryLoadSharedBoardFromHash();
  if (!loadedFromShareLink) initState();
  render();
  measureHeaderHeight();
  window.addEventListener('load', measureHeaderHeight);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measureHeaderHeight).catch(() => {});
  }
  window.addEventListener('resize', debounce(measureHeaderHeight, 150));
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', onGlobalKeydown);
  setupSwipeHandlers();
  // Same-URL hash navigation doesn't reload the page, so a pasted share
  // link needs its own listener to actually take effect.
  window.addEventListener('hashchange', () => { if (tryLoadSharedBoardFromHash()) render(); });
}

boot();
