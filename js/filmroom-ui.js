/* ============================================================
   NTM DEAL CENTER — Film Room WATCH buttons
   Adds a small WATCH button to whichever panel is currently on screen,
   without touching render.js / render-b.js / render-c.js / render-tools.js
   / cityradar.js at all — same "wrap the existing function" pattern
   js/sync.js already uses on save().

   DWG_TO_SLUG mirrors film-room/panels.json (kept in sync manually —
   there are only 20 panels, and both lists are short enough that a
   comment here is enough of a guardrail against drift).
   ============================================================ */

const DWG_TO_SLUG = {
  'DWG A-01': 'pipeline', 'DWG A-02': 'deal-analyzer', 'DWG A-03': 'portfolio',
  'DWG A-04': 'financing', 'DWG A-05': 'renovation', 'DWG A-06': 'deadlines-offers',
  'DWG A-07': 'skip-trace', 'DWG A-08': 'ghl-link', 'DWG A-09': 'city-radar', 'DWG A-10': 'court-radar',
  'DWG B-01': 'lead-pipeline', 'DWG B-02': 'listings-showings', 'DWG B-03': 'contracts',
  'DWG B-04': 'commissions', 'DWG B-05': 'followups-marketing', 'DWG B-06': 'referrals',
  'DWG C-01': 'daily-briefing', 'DWG C-02': 'weekly-report', 'DWG C-03': 'data-intake', 'DWG C-04': 'vault-sharing',
};

function injectFilmRoomWatchButton() {
  const dwgEl = document.querySelector('.panel__dwg');
  if (!dwgEl || dwgEl.querySelector('.watch-btn')) return;
  const code = dwgEl.textContent.trim();
  const slug = DWG_TO_SLUG[code];
  if (!slug) return; // unbuilt/placeholder panel — nothing to watch yet
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--ghost btn--xs watch-btn';
  btn.textContent = '▶ WATCH';
  btn.dataset.action = 'openFilmRoom';
  btn.dataset.slug = slug;
  dwgEl.appendChild(btn);
}

Object.assign(ACTIONS, {
  openFilmRoom(el) {
    window.open('film-room.html#' + el.dataset.slug, '_blank', 'noopener');
  },
});

// Wraps the existing render() (defined in render.js) so a WATCH button
// appears after every redraw — never modifies render.js itself.
const _originalRenderForFilmRoom = render;
render = function () {
  _originalRenderForFilmRoom();
  injectFilmRoomWatchButton();
};
