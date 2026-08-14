/* ============================================================
   NTM DEAL CENTER — Lab Link cloud sync client
   Wraps the existing save() so every real change schedules a debounced
   push; polls every ~45s and on window focus; last-write-wins by
   revision number; ignores its own echoes; strips uploaded photos
   before anything leaves the browser.
   ============================================================ */

const LAB_BOARD_ID_KEY = 'ntmLabBoardId';   // SHA-256 hash of the Lab Key — the board's ID. Raw key is never stored.
const DEVICE_ID_KEY = 'ntmDeviceId';

let syncPushTimer = null;
let syncInFlight = false;
let syncPollTimer = null;

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) { return 'dev_unknown'; }
}

function getLabBoardId() {
  try { return localStorage.getItem(LAB_BOARD_ID_KEY) || ''; } catch (e) { return ''; }
}

function setLabBoardIdStored(hash) {
  try {
    if (hash) localStorage.setItem(LAB_BOARD_ID_KEY, hash);
    else localStorage.removeItem(LAB_BOARD_ID_KEY);
  } catch (e) { /* ignore */ }
}

function authHeaders() {
  const pass = typeof getStoredPasscode === 'function' ? getStoredPasscode() : '';
  return pass ? { 'x-ntm-passcode': pass } : {};
}

// Uploaded property photos are ~900px JPEG data URLs and can be tens of KB
// each — strip them before syncing so a board doesn't balloon in cloud
// storage. Our generated house/hero art is inline SVG (data:image/svg+xml)
// and stays, since it's tiny.
function stripPhotosForSync(state) {
  const clone = JSON.parse(JSON.stringify(state));
  (clone.properties || []).forEach(p => {
    if (p.photo && typeof p.photo === 'string' && p.photo.indexOf('data:image/jpeg') === 0) {
      p.photo = null;
    }
  });
  (clone.documents || []).forEach(d => {
    if (d.dataUrl && d.dataUrl.length > 20000) d.dataUrl = null; // large attachments stay local-only too
  });
  return clone;
}

function updateSyncStatusPill(text, tone) {
  const el = document.getElementById('syncStatusPill');
  if (!el) return;
  el.textContent = text;
  el.className = 'sync-pill sync-pill--' + (tone || 'muted');
}

function refreshSyncStatusIdle() {
  if (!getLabBoardId()) { updateSyncStatusPill('LOCAL', 'muted'); return; }
  if (isDemoLocked()) { updateSyncStatusPill('LOCAL', 'muted'); return; }
  updateSyncStatusPill('SYNCED', 'ok');
}

function scheduleSyncPush() {
  if (!getLabBoardId() || isDemoLocked()) return;
  if (syncPushTimer) clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => { pushBoard(); }, 4000);
}

async function pushBoard() {
  const boardId = getLabBoardId();
  if (!boardId || isDemoLocked() || syncInFlight) return;
  syncInFlight = true;
  updateSyncStatusPill('SYNCING…', 'busy');
  try {
    const nextRev = (S.meta.syncRev || 0) + 1;
    const payload = stripPhotosForSync(S);
    const res = await fetch('/api/board-save', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ boardId, rev: nextRev, deviceId: getDeviceId(), state: payload }),
    });
    if (!res.ok) throw new Error('save failed');
    S.meta.syncRev = nextRev;
    S.meta.syncSavedBy = getDeviceId();
    _originalSave();
    updateSyncStatusPill('SYNCED', 'ok');
  } catch (e) {
    updateSyncStatusPill('OFFLINE', 'danger');
  } finally {
    syncInFlight = false;
  }
}

// Pulls the newest cloud copy. If it's strictly newer than our local
// revision, it wins (last-write-wins) and we adopt it. Never pulls over
// unsynced local edits that are already ahead.
async function pullBoard(opts) {
  opts = opts || {};
  const boardId = getLabBoardId();
  if (!boardId || syncInFlight) return null;
  syncInFlight = true;
  if (!opts.silent) updateSyncStatusPill('SYNCING…', 'busy');
  try {
    const res = await fetch('/api/board-load?boardId=' + encodeURIComponent(boardId));
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    if (!data.found) { if (!opts.silent) updateSyncStatusPill('SYNCED', 'ok'); return null; }
    const localRev = S.meta.syncRev || 0;
    if (data.rev > localRev && data.state) {
      if (opts.applyDirectly) {
        S = data.state;
        S.meta.syncRev = data.rev;
        _originalSave();
        render();
      }
      updateSyncStatusPill('SYNCED', 'ok');
      return data;
    }
    updateSyncStatusPill('SYNCED', 'ok');
    return null;
  } catch (e) {
    updateSyncStatusPill('OFFLINE', 'danger');
    return null;
  } finally {
    syncInFlight = false;
  }
}

// Called once, right after the user enters a Lab Key for the first time on
// this device (or reconnects to one). Checks whether a cloud board already
// exists under that key and, if so, asks before clobbering either copy.
async function connectLabKey(labKey) {
  const hash = await sha256Hex(labKey);
  setLabBoardIdStored(hash);
  updateSyncStatusPill('SYNCING…', 'busy');
  const remote = await pullBoard({ silent: true, applyDirectly: false });
  if (remote && remote.state) {
    openLabConflictModal(remote);
  } else if (!isDemoLocked()) {
    pushBoard();
  } else {
    updateSyncStatusPill('LOCAL', 'muted');
  }
}

function disconnectLabKey() {
  setLabBoardIdStored('');
  if (syncPollTimer) clearInterval(syncPollTimer);
  updateSyncStatusPill('LOCAL', 'muted');
}

function openLabConflictModal(remote) {
  const root = document.getElementById('gateModalRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay" data-action="none">
      <div class="modal" data-action="none">
        <div class="modal__head"><h3>CLOUD BOARD FOUND</h3></div>
        <div class="modal__body">
          <p>This Lab Key already has a board saved in the cloud (saved ${escapeHtml(new Date(remote.savedAt).toLocaleString())}). Load it here, or keep this device's board and overwrite the cloud copy?</p>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="labKeepLocal">KEEP THIS DEVICE'S BOARD</button>
          <button type="button" class="btn btn--stamp" data-action="labLoadCloud">LOAD CLOUD BOARD</button>
        </div>
      </div>
    </div>`;
  window.__ntmPendingRemote = remote;
}

function onUserModeUnlocked() {
  // Once unlocked, this device is allowed to sync up — push anything pending.
  if (getLabBoardId()) scheduleSyncPush();
}

// Wrap the existing save() (defined in state.js) so every real change also
// schedules a debounced cloud push — without touching state.js itself.
const _originalSave = save;
save = function () {
  _originalSave();
  scheduleSyncPush();
};

document.addEventListener('DOMContentLoaded', () => {
  refreshSyncStatusIdle();
  syncPollTimer = setInterval(() => { if (getLabBoardId() && !isDemoLocked()) pullBoard({ silent: true, applyDirectly: true }); }, 45000);
  window.addEventListener('focus', () => { if (getLabBoardId() && !isDemoLocked()) pullBoard({ silent: true, applyDirectly: true }); });
});
