/* ============================================================
   NTM DEAL CENTER — utility helpers
   ============================================================ */

function fmtMoney(n) {
  n = Number(n) || 0;
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtMoneySigned(n) {
  n = Number(n) || 0;
  const s = n < 0 ? '-' : '';
  return s + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
}

function fmtPct(n, digits) {
  n = Number(n) || 0;
  return n.toFixed(digits == null ? 1 : digits) + '%';
}

function parseMoney(str) {
  if (typeof str === 'number') return str;
  return Number(String(str || '').replace(/[^0-9.-]/g, '')) || 0;
}

// Live comma formatting for money inputs. Call on an <input inputmode="numeric">.
function attachMoneyInput(el) {
  el.addEventListener('input', () => {
    const caretFromEnd = el.value.length - el.selectionStart;
    const raw = parseMoney(el.value);
    el.value = raw ? raw.toLocaleString('en-US') : '';
    const pos = Math.max(0, el.value.length - caretFromEnd);
    el.setSelectionRange(pos, pos);
  });
}

function uidShort() {
  return Math.random().toString(36).slice(2, 9);
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// MASKED mode: renders dots unless EXPOSED, or the element has been click-revealed.
function maskText(value, revealed) {
  if (!value) return '';
  if (revealed || (typeof S !== 'undefined' && S.meta && S.meta.masked === false)) return escapeHtml(value);
  return '•'.repeat(Math.min(10, Math.max(4, String(value).length)));
}

function maskMoney(value, revealed) {
  const display = fmtMoney(value);
  if (revealed || (typeof S !== 'undefined' && S.meta && S.meta.masked === false)) return display;
  return '•'.repeat(Math.min(8, display.length));
}

function firstName(fullName) {
  if (!fullName) return 'there';
  return String(fullName).trim().split(/\s+/)[0];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function relTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  return days + 'd ago';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ---------- Toasts ----------
let toastContainer = null;
function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toastStack');
  }
  return toastContainer;
}

const MAX_VISIBLE_TOASTS = 3;

function showToast(message, opts) {
  opts = opts || {};
  const stack = ensureToastContainer();
  if (!stack) return;
  // Cap how many toasts can stack up — otherwise a burst of quick actions
  // piles toasts high enough to cover the buttons underneath them.
  while (stack.children.length >= MAX_VISIBLE_TOASTS) {
    stack.removeChild(stack.firstElementChild);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (opts.tone ? ' toast--' + opts.tone : '');
  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast__msg';
  msgSpan.textContent = message;
  el.appendChild(msgSpan);

  if (opts.undo) {
    const btn = document.createElement('button');
    btn.className = 'toast__undo';
    btn.type = 'button';
    btn.textContent = 'UNDO';
    btn.addEventListener('click', () => {
      opts.undo();
      el.remove();
    });
    el.appendChild(btn);
  }
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--in'));
  const life = opts.duration || (opts.undo ? 10000 : 3200);
  const timer = setTimeout(() => {
    el.classList.remove('toast--in');
    setTimeout(() => el.remove(), 250);
  }, life);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  return el;
}

// ---------- Staged progress box (toast corner, one at a time) ----------
let activeProgress = null;
function startProgress(title, steps) {
  const stack = ensureToastContainer();
  if (!stack) return { advance() {}, error() {}, done() {} };
  if (activeProgress && activeProgress.el) activeProgress.el.remove();

  const el = document.createElement('div');
  el.className = 'progressbox';
  const h = document.createElement('div');
  h.className = 'progressbox__title';
  h.textContent = title;
  el.appendChild(h);
  const list = document.createElement('ul');
  list.className = 'progressbox__steps';
  steps.forEach((s, i) => {
    const li = document.createElement('li');
    li.dataset.i = i;
    li.innerHTML = `<span class="progressbox__mark">${i === 0 ? '▸' : '○'}</span><span>${escapeHtml(s)}</span>`;
    list.appendChild(li);
  });
  el.appendChild(list);
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--in'));

  let current = 0;
  const items = () => list.querySelectorAll('li');
  const api = {
    el,
    advance() {
      const lis = items();
      if (lis[current]) { lis[current].querySelector('.progressbox__mark').textContent = '✓'; lis[current].classList.add('is-done'); }
      current++;
      if (lis[current]) { lis[current].querySelector('.progressbox__mark').textContent = '▸'; lis[current].classList.add('is-current'); }
      if (current >= steps.length) api.done();
    },
    error(msg) {
      const lis = items();
      if (lis[current]) {
        lis[current].querySelector('.progressbox__mark').textContent = '✕';
        lis[current].classList.add('is-error');
      }
      if (msg) {
        const errEl = document.createElement('div');
        errEl.className = 'progressbox__error';
        errEl.textContent = msg;
        el.appendChild(errEl);
      }
      setTimeout(() => { el.classList.remove('toast--in'); setTimeout(() => el.remove(), 250); }, 3000);
    },
    done() {
      setTimeout(() => { el.classList.remove('toast--in'); setTimeout(() => el.remove(), 250); }, 900);
    },
  };
  activeProgress = api;
  return api;
}

// ---------- Image resize to ~900px JPEG data URL ----------
function resizeImageFile(file, maxDim) {
  maxDim = maxDim || 900;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Empty state helper ----------
function emptyStateHTML(headline, pitch, actionLabel, action) {
  return `
    <div class="empty-state">
      <div class="empty-state__headline">${escapeHtml(headline)}</div>
      <p class="empty-state__pitch">${escapeHtml(pitch)}</p>
      <button type="button" class="btn btn--stamp" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>
    </div>`;
}
