/* ============================================================
   NTM DEAL CENTER — AC (the built-in assistant)
   Orange ASK button (bottom-right, blinking-eyes/talking-mouth face) that
   opens a chat panel. Self-contained: renders itself once at load and
   manages its own re-renders after that, independent of the main app's
   render() cycle (same reasoning City Radar/Skip Trace etc. don't touch
   render() either — this just never needed to).

   Chat is intentionally NOT persisted in S — it's a conversation, not
   board data, and starting fresh each visit keeps it simple.
   ============================================================ */

const AC_NAME = 'AC';

let igorOpen = false;
let igorChatLog = [];          // [{ role: 'user'|'assistant'|'receipt', text }]
let igorMessages = [];         // Anthropic-shaped conversation history sent to api/ask
let igorBusy = false;
let igorSpeaking = false;
let igorMicActive = false;
let igorLiveActive = false;

/* ---------- rendering ---------- */

function igorFaceSVG(extraClass) {
  return `
    <svg class="igor-face ${extraClass || ''}" viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="27" fill="var(--orange)"></circle>
      <ellipse class="igor-eye igor-eye--l" cx="20" cy="27" rx="4" ry="5" fill="#14100C"></ellipse>
      <ellipse class="igor-eye igor-eye--r" cx="40" cy="27" rx="4" ry="5" fill="#14100C"></ellipse>
      <rect class="igor-mouth" x="18" y="38" width="24" height="4" rx="2" fill="#14100C"></rect>
    </svg>`;
}

function renderIgorRoot() {
  const root = document.getElementById('igorPanelRoot');
  if (!root) return;
  const buttonHTML = `
    <button type="button" id="igorAskBtn" class="igor-btn" data-action="toggleIgorPanel" aria-label="Ask ${escapeHtml(AC_NAME)}">
      ${igorFaceSVG(igorSpeaking ? 'is-speaking' : '')}
      <span class="igor-btn__label">ASK ${escapeHtml(AC_NAME)}</span>
    </button>`;
  root.innerHTML = buttonHTML + (igorOpen ? igorPanelHTML() : '');
  if (igorOpen) afterRenderIgorPanel();
}

function igorLineHTML(line) {
  if (line.role === 'receipt') return `<div class="igor-line igor-line--receipt">${escapeHtml(line.text)}</div>`;
  return `<div class="igor-line igor-line--${line.role}"><span class="igor-line__who">${line.role === 'user' ? 'YOU' : AC_NAME.toUpperCase()}</span><span class="igor-line__text">${escapeHtml(line.text)}</span></div>`;
}

function igorPanelHTML() {
  return `
    <div class="igor-panel" data-action="none">
      <div class="igor-panel__head">
        <span class="igor-panel__title">${igorFaceSVG(igorSpeaking ? 'is-speaking' : '')} ASK ${escapeHtml(AC_NAME)}</span>
        <div class="igor-panel__head-actions">
          <button type="button" class="btn btn--ghost btn--xs ${igorLiveActive ? 'igor-live-btn--active' : ''}" id="igorLiveBtn" data-action="igorLiveToggle">${igorLiveActive ? '📞 END' : '📞 LIVE'}</button>
          <button type="button" class="btn btn--ghost btn--xs" data-action="stopIgorSpeaking" title="Stop speaking">🔇</button>
          <button type="button" class="btn btn--ghost btn--xs" data-action="closeIgorPanel">✕</button>
        </div>
      </div>
      <div class="igor-panel__log" id="igorLog">${igorChatLog.length ? igorChatLog.map(igorLineHTML).join('') : igorEmptyStateHTML()}</div>
      <form class="igor-panel__input-row" id="igorInputForm">
        <button type="button" class="btn btn--ghost btn--xs ${igorMicActive ? 'igor-mic-btn--active' : ''}" id="igorMicBtn" data-action="igorMicToggle" title="Ask with your voice">🎙</button>
        <input type="text" id="igorTextInput" placeholder="Ask ${escapeHtml(AC_NAME)} anything…" autocomplete="off" ${igorBusy ? 'disabled' : ''}>
        <button type="submit" class="btn btn--stamp btn--xs" ${igorBusy ? 'disabled' : ''}>SEND</button>
      </form>
    </div>`;
}

function igorEmptyStateHTML() {
  return `<p class="igor-empty">Hi, I'm ${escapeHtml(AC_NAME)}. Ask me anything about the board, or ask me to do something — like "add a lead named Jordan Reyes" or "what needs my attention today?"</p>`;
}

function afterRenderIgorPanel() {
  const log = document.getElementById('igorLog');
  if (log) log.scrollTop = log.scrollHeight;
  const form = document.getElementById('igorInputForm');
  if (form && !form.dataset.wired) {
    form.dataset.wired = '1';
    form.addEventListener('submit', (e) => { e.preventDefault(); submitIgorTextInput(); });
  }
  const input = document.getElementById('igorTextInput');
  if (input) input.focus();
}

function appendIgorChatLine(role, text) {
  if (!text) return;
  igorChatLog.push({ role, text });
  renderIgorRoot();
}

function appendIgorReceipt(toolName, result) {
  const prefix = result.ok ? '✓' : '✕';
  appendIgorChatLine('receipt', `${prefix} ${result.message}`);
}

/* ---------- open/close ---------- */

function openIgorPanel() {
  igorOpen = true;
  renderIgorRoot();
}
function closeIgorPanel() {
  igorOpen = false;
  stopIgorLiveCall();
  renderIgorRoot();
}
function toggleIgorPanel() {
  if (igorOpen) closeIgorPanel(); else openIgorPanel();
}

/* ---------- chat orchestration (BRAIN + HANDS) ---------- */

function submitIgorTextInput() {
  const input = document.getElementById('igorTextInput');
  if (!input || igorBusy) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendIgorMessage(text);
}

async function sendIgorMessage(userText) {
  appendIgorChatLine('user', userText);
  igorMessages.push({ role: 'user', content: userText });
  igorBusy = true;
  renderIgorRoot();
  try {
    await runIgorConversation();
  } finally {
    igorBusy = false;
    renderIgorRoot();
  }
}

const IGOR_MAX_ROUNDS = 5;

async function runIgorConversation() {
  for (let round = 0; round < IGOR_MAX_ROUNDS; round++) {
    let data;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ messages: igorMessages }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok && !data.notConfigured) { const e = new Error('ask failed'); e.status = res.status; e.body = data; throw e; }
    } catch (err) {
      igorAnswerFromKb(err && err.notConfigured ? 'notConfigured' : 'offline');
      return;
    }
    if (data.notConfigured) { igorAnswerFromKb('notConfigured'); return; }
    if (!data.ok) { igorAnswerFromKb('error'); return; }

    const message = data.message;
    const content = (message && message.content) || [];
    igorMessages.push({ role: 'assistant', content });

    const textBlocks = content.filter(b => b.type === 'text' && b.text);
    const toolUses = content.filter(b => b.type === 'tool_use');
    const spokenText = textBlocks.map(b => b.text).join(' ');
    if (spokenText) appendIgorChatLine('assistant', spokenText);

    if (!toolUses.length) {
      if (spokenText) speakIgorText(spokenText);
      return;
    }

    const toolResults = [];
    for (const tu of toolUses) {
      const result = await runIgorTool(tu.name, tu.input);
      appendIgorReceipt(tu.name, result);
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    igorMessages.push({ role: 'user', content: toolResults });
    // loop continues so AC can read the tool result(s) and answer
  }
  appendIgorChatLine('assistant', "That turned into more steps than expected — try asking me one thing at a time.");
}

// Used when api/ask can't be reached at all (offline) or isn't configured
// (no ANTHROPIC_API_KEY) — falls back to a plain keyword search over
// kb.js, running entirely in the browser.
function igorAnswerFromKb(reason) {
  const lastUser = igorMessages.slice().reverse().find(m => m.role === 'user' && typeof m.content === 'string');
  const query = lastUser ? lastUser.content : '';
  const hits = searchKb(query, 2);
  const lead = reason === 'notConfigured'
    ? `My full brain isn't set up yet, but here's what I know from the manual:`
    : `I can't reach my brain right now, but here's what I know from the manual:`;
  if (hits.length) {
    appendIgorChatLine('assistant', `${lead} ${hits.map(h => h.text).join(' ')}`);
  } else {
    appendIgorChatLine('assistant', reason === 'notConfigured'
      ? "My full brain isn't set up yet, and I couldn't find anything about that in the manual."
      : "I can't reach my brain right now, and I couldn't find anything about that in the manual — try again in a bit.");
  }
}

/* ---------- VOICE OUT (ElevenLabs, browser speechSynthesis fallback) ---------- */

let igorCurrentAudio = null;

// The one path every "stop talking" case routes through — closing the
// panel, starting a new question, or clicking the mute button all call
// this, so AC is never still talking after you've moved on.
function stopIgorSpeaking() {
  if (igorCurrentAudio) {
    igorCurrentAudio.pause();
    igorCurrentAudio.currentTime = 0;
    igorCurrentAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  setIgorSpeaking(false);
}

function setIgorSpeaking(isSpeaking) {
  igorSpeaking = isSpeaking;
  document.querySelectorAll('.igor-face').forEach(el => el.classList.toggle('is-speaking', isSpeaking));
}

async function speakIgorText(text) {
  stopIgorSpeaking();
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ text }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || ct.indexOf('audio') === -1) throw new Error('tts unavailable');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    igorCurrentAudio = new Audio(url);
    igorCurrentAudio.onended = () => { setIgorSpeaking(false); URL.revokeObjectURL(url); };
    igorCurrentAudio.onerror = () => { setIgorSpeaking(false); URL.revokeObjectURL(url); };
    setIgorSpeaking(true);
    await igorCurrentAudio.play().catch(() => { setIgorSpeaking(false); });
  } catch (e) {
    speakWithBrowserFallback(text);
  }
}

function speakWithBrowserFallback(text) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.onend = () => setIgorSpeaking(false);
  utter.onerror = () => setIgorSpeaking(false);
  setIgorSpeaking(true);
  window.speechSynthesis.speak(utter);
}

/* ---------- MIC dictation (single question) ---------- */

let igorRecognition = null;

function igorMicToggle() {
  if (igorRecognition) { igorRecognition.stop(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice dictation is not supported in this browser.', { tone: 'danger' }); return; }
  igorRecognition = new SR();
  igorRecognition.lang = 'en-US';
  igorRecognition.interimResults = false;
  igorRecognition.maxAlternatives = 1;
  igorRecognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const input = document.getElementById('igorTextInput');
    if (input) input.value = text;
    sendIgorMessage(text);
  };
  igorRecognition.onend = () => { igorRecognition = null; igorMicActive = false; renderIgorRoot(); };
  igorRecognition.onerror = () => { igorRecognition = null; igorMicActive = false; renderIgorRoot(); };
  try {
    igorRecognition.start();
    igorMicActive = true;
    renderIgorRoot();
  } catch (e) {
    igorRecognition = null;
  }
}

/* ---------- LIVE hands-free call (OpenAI Realtime, WebRTC) ---------- */

let igorLivePc = null;
let igorLiveStream = null;
let igorLiveAudioEl = null;
let igorLiveTranscriptBuffer = '';

async function igorLiveToggle() {
  if (igorLiveActive) { stopIgorLiveCall(); return; }
  await startIgorLiveCall();
}

async function startIgorLiveCall() {
  if (typeof isDemoLocked === 'function' && isDemoLocked()) {
    appendIgorChatLine('assistant', "LIVE calls need User Mode — switch over and tap LIVE again.");
    return;
  }
  if (!navigator.mediaDevices || !window.RTCPeerConnection) {
    appendIgorChatLine('assistant', "This browser doesn't support live voice calls.");
    return;
  }
  try {
    const res = await fetch('/api/voice-session', { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (data.notConfigured) { appendIgorChatLine('assistant', friendlyError('voice', { notConfigured: true }).action); return; }
    if (!res.ok || !data.ok) throw new Error('session failed');

    const ephemeralKey = data.session && data.session.client_secret && data.session.client_secret.value;
    if (!ephemeralKey) throw new Error('no ephemeral key returned');

    const pc = new RTCPeerConnection();
    igorLiveStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    igorLiveStream.getTracks().forEach(track => pc.addTrack(track, igorLiveStream));

    igorLiveAudioEl = document.createElement('audio');
    igorLiveAudioEl.autoplay = true;
    pc.ontrack = (e) => { igorLiveAudioEl.srcObject = e.streams[0]; };

    const dc = pc.createDataChannel('oai-events');
    dc.addEventListener('message', handleIgorLiveEvent);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(data.model || 'gpt-4o-realtime-preview-2024-12-17')}`, {
      method: 'POST',
      body: offer.sdp,
      headers: { Authorization: `Bearer ${ephemeralKey}`, 'Content-Type': 'application/sdp' },
    });
    if (!sdpRes.ok) throw new Error('realtime handshake failed');
    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    igorLivePc = pc;
    igorLiveActive = true;
    appendIgorChatLine('receipt', "LIVE call connected — go ahead and talk.");
    renderIgorRoot();
  } catch (e) {
    appendIgorChatLine('assistant', "Couldn't start the live call — check your mic permission and try again.");
    stopIgorLiveCall();
  }
}

function handleIgorLiveEvent(e) {
  let evt;
  try { evt = JSON.parse(e.data); } catch (err) { return; }
  if (evt.type === 'response.audio_transcript.delta' && evt.delta) {
    igorLiveTranscriptBuffer += evt.delta;
  } else if (evt.type === 'response.audio_transcript.done') {
    if (igorLiveTranscriptBuffer) appendIgorChatLine('assistant', igorLiveTranscriptBuffer);
    igorLiveTranscriptBuffer = '';
  } else if (evt.type === 'response.function_call_arguments.done' && evt.name) {
    let args = {};
    try { args = JSON.parse(evt.arguments || '{}'); } catch (err) { /* ignore */ }
    runIgorTool(evt.name, args).then(result => appendIgorReceipt(evt.name, result));
  }
}

function stopIgorLiveCall() {
  if (igorLivePc) { igorLivePc.close(); igorLivePc = null; }
  if (igorLiveStream) { igorLiveStream.getTracks().forEach(t => t.stop()); igorLiveStream = null; }
  igorLiveAudioEl = null;
  if (igorLiveActive) { igorLiveActive = false; renderIgorRoot(); }
}

/* ---------- dispatch wiring ---------- */

Object.assign(ACTIONS, {
  toggleIgorPanel() { toggleIgorPanel(); },
  closeIgorPanel() { closeIgorPanel(); },
  igorMicToggle() { igorMicToggle(); },
  igorLiveToggle() { igorLiveToggle(); },
  stopIgorSpeaking() { stopIgorSpeaking(); },
});

document.addEventListener('DOMContentLoaded', renderIgorRoot);
