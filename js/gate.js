/* ============================================================
   NTM DEAL CENTER — Demo / User mode gate
   Loads FIRST, before every other script. Listens in the CAPTURE
   phase so it sees every click and form-change before the app does.
   DEMO is look-but-don't-touch: an ALLOW-LIST of safe/navigational
   data-actions, everything else pops the passcode box. That way
   anything added later is locked by default until explicitly
   allow-listed — the safe direction to be wrong in.
   ============================================================ */

const SITE_MODE_KEY = 'ntmSiteMode';          // 'user' or absent (= demo) — its own key, survives board resets
const SITE_PASSCODE_KEY = 'ntmSitePasscode';  // only set after a successful unlock; sent as an auth header for protected writes

const DEMO_ALLOWED_ACTIONS = new Set([
  'none', 'closeModalOverlay', 'closeModal', 'dismissWelcome',
  'collapseHero', 'expandHero',
  'setSheet', 'setSubtabA', 'setSubtabB', 'setSubtabC',
  'setPipelineFilter', 'setLeadFilter',
  // Session 3 — pure view/filter/navigation, same reasoning as the pipeline
  // filter above: no real board data changes, safe in DEMO MODE.
  'scrollToSection', 'cityRadarZipClick', 'cityRadarClearZip', 'cityRadarDotClick', 'cityRadarPermitSearch',
  // AC (Session 4) — opening/closing chat, mic, and mute are UI toggles
  // only. Asking a question is explicitly demo-safe by design (routed
  // through a form submit, not a data-action, so the gate never even sees
  // it) — but LIVE calls and every board-changing tool AC can run still
  // check isDemoLocked() themselves before doing anything real.
  'toggleIgorPanel', 'closeIgorPanel', 'igorMicToggle', 'igorLiveToggle', 'stopIgorSpeaking',
  'openFilmRoom',
  'toggleTheme', 'toggleMasked',
  'openFinder', 'closeFinder', 'jumpToResult', 'jumpToUrgent',
  'pipelinePagerPrev', 'pipelinePagerNext', 'toggleMoveMenu',
  'switchDraftTab', 'gotoPipeline', 'gotoNewLead',
  'openNewPropertyModal', 'openDraftModal', 'openNewLenderModal',
  'openNewDeadlineModal', 'openNewOfferModal',
  'openNewLeadModal', 'openLeadDraftModal', 'openScheduleShowingModal',
  'openLogFeedbackModal', 'openMarketingPlanModal', 'openNewListingModal',
  'openNewContractModal', 'openSnapshotModal', 'openLabKeyModal',
  'openDocumentModal', 'openCsvModal', 'toggleRevealAmount',
  'copyBriefingText', 'copyReportText',
  // gate's own actions are handled directly below, but keep them
  // allow-listed too so nothing accidentally re-blocks them
  'toggleSiteMode', 'submitPasscode', 'cancelPasscode',
]);

// Inputs/selects the visitor may freely interact with in demo mode (pure
// view/search state, nothing persisted to the real board).
const DEMO_ALLOWED_INPUT_IDS = new Set(['finderInput', 'passcodeInput', 'igorTextInput']);

function getSiteMode() {
  try { return localStorage.getItem(SITE_MODE_KEY) || 'demo'; } catch (e) { return 'demo'; }
}
function setSiteModeStored(mode) {
  try { localStorage.setItem(SITE_MODE_KEY, mode); } catch (e) { /* storage unavailable — mode just won't persist */ }
}
function isDemoLocked() { return getSiteMode() !== 'user'; }
function getStoredPasscode() {
  try { return localStorage.getItem(SITE_PASSCODE_KEY) || ''; } catch (e) { return ''; }
}

function updateModeButtons() {
  const demoBtn = document.getElementById('demoModeBtn');
  const userBtn = document.getElementById('userModeBtn');
  const unlocked = !isDemoLocked();
  if (demoBtn) demoBtn.classList.toggle('is-active-mode', !unlocked);
  if (userBtn) userBtn.classList.toggle('is-active-mode', unlocked);
  if (userBtn) userBtn.classList.toggle('is-user-unlocked', unlocked);
  document.body.classList.toggle('is-demo-mode', !unlocked);
  document.body.classList.toggle('is-user-mode', unlocked);
}

function openPasscodeBox(message) {
  const root = document.getElementById('gateModalRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay" data-action="cancelPasscode">
      <div class="modal modal--gate" data-action="none">
        <div class="modal__head"><h3>UNLOCK USER MODE</h3><button type="button" class="btn btn--ghost btn--xs" data-action="cancelPasscode">✕</button></div>
        <div class="modal__body">
          <p class="gate-message">${message ? escapeHtmlSafe(message) : "This board is in DEMO MODE — look, don't touch. Enter the passcode to unlock editing and cloud sync."}</p>
          <label class="field field--wide">
            <span class="field__label">PASSCODE</span>
            <input type="password" id="passcodeInput" autocomplete="off">
          </label>
          <p class="gate-error" id="gateError" hidden></p>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="cancelPasscode">CANCEL</button>
          <button type="button" class="btn btn--stamp" data-action="submitPasscode">UNLOCK</button>
        </div>
      </div>
    </div>`;
  const input = document.getElementById('passcodeInput');
  if (input) {
    setTimeout(() => input.focus(), 0);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitPasscodeNow(); } });
  }
}

function closePasscodeBox() {
  const root = document.getElementById('gateModalRoot');
  if (root) root.innerHTML = '';
}

function escapeHtmlSafe(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function submitPasscodeNow() {
  const input = document.getElementById('passcodeInput');
  const errEl = document.getElementById('gateError');
  const passcode = input ? input.value : '';
  if (!passcode) return;
  try {
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.ok) {
      setSiteModeStored('user');
      try { localStorage.setItem(SITE_PASSCODE_KEY, passcode); } catch (e) { /* ignore */ }
      closePasscodeBox();
      updateModeButtons();
      if (typeof showToast === 'function') showToast('User Mode unlocked.', { tone: 'ok' });
      if (typeof onUserModeUnlocked === 'function') onUserModeUnlocked();
      return;
    }
    if (errEl) { errEl.hidden = false; errEl.textContent = 'Wrong passcode. Try again.'; }
  } catch (e) {
    if (errEl) { errEl.hidden = false; errEl.textContent = 'Could not reach the server to verify — try again.'; }
  }
}

function handleToggleSiteMode(el) {
  const target = el.dataset.targetMode;
  if (target === 'demo') {
    setSiteModeStored('demo');
    updateModeButtons();
    if (typeof showToast === 'function') showToast('Switched to DEMO MODE.', { tone: 'info' });
    return;
  }
  if (target === 'user') {
    if (!isDemoLocked()) { updateModeButtons(); return; }
    openPasscodeBox();
  }
}

function gateClickHandler(e) {
  const actionEl = e.target.closest('[data-action]');
  const action = actionEl ? actionEl.dataset.action : null;

  if (action === 'toggleSiteMode') { e.preventDefault(); e.stopPropagation(); handleToggleSiteMode(actionEl); return; }
  if (action === 'submitPasscode') { e.preventDefault(); e.stopPropagation(); submitPasscodeNow(); return; }
  if (action === 'cancelPasscode') { e.preventDefault(); e.stopPropagation(); closePasscodeBox(); return; }

  if (!isDemoLocked()) return; // unlocked — everything goes through to the app
  if (!action) return; // no data-action here — nothing for the gate to guard
  if (DEMO_ALLOWED_ACTIONS.has(action)) return; // on the allow-list — let it through

  e.preventDefault();
  e.stopPropagation();
  openPasscodeBox();
}

function gateFocusHandler(e) {
  if (!isDemoLocked()) return;
  const t = e.target;
  if (!t || !t.matches || !t.matches('input,select,textarea')) return;
  if (DEMO_ALLOWED_INPUT_IDS.has(t.id)) return;
  if (t.closest('[data-demo-allow]')) return;
  e.preventDefault();
  e.stopPropagation();
  t.blur();
  openPasscodeBox();
}

document.addEventListener('click', gateClickHandler, true);
document.addEventListener('focusin', gateFocusHandler, true);
document.addEventListener('DOMContentLoaded', updateModeButtons);
