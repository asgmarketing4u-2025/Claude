// AC's brain — a thin, stateless proxy to the Anthropic Messages API.
//
// The browser (js/igor-ui.js) owns the conversation loop: it sends the
// running message history (including any tool_result blocks from tools it
// already ran), and this function just forwards to Anthropic and returns
// the raw response. If that response contains a tool_use block, the
// browser executes it (js/igor-actions.js) and calls back here again with
// the result appended — up to a few rounds — until AC gives a final
// text answer.
//
// NOT gated behind the User Mode passcode — per spec, AC may answer
// questions and read the board for anyone, in Demo Mode or not. What IS
// gated is every individual TOOL call: js/igor-actions.js's runIgorTool()
// checks isDemoLocked() before running anything that changes the board or
// spends money, and returns a polite "switch to User Mode" tool_result
// instead — so even a demo visitor asking AC to "add a lead" can't cause
// a real mutation, no matter what this endpoint returns.

const { fetchWithUA, readJsonOrThrow } = require('./_lib/fetchWithUA');
const { kbAsPromptText } = require('../kb');
const { TOOL_DEFS } = require('../tools');

// The real, dated model ID for "Claude Haiku 4.5".
const MODEL = 'claude-haiku-4-5-20251001';

function systemPrompt() {
  return [
    'You are AC, the built-in assistant inside NTM Deal Center, a real estate command center app (Investor / Realtor / Operations sheets).',
    'Answer questions using the knowledge base below. When the user asks you to DO something (add a lead, move a deal, trace an owner, etc), use the matching tool instead of just describing how — the app will actually perform the action and tell you the result.',
    'Keep answers short and conversational — this may be read aloud.',
    'If a tool result comes back saying the user needs User Mode, explain that plainly and do not retry the tool.',
    '',
    '--- KNOWLEDGE BASE ---',
    kbAsPromptText(),
  ].join('\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: false, notConfigured: true, error: 'ANTHROPIC_API_KEY not set' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const messages = (body && body.messages) || [];
  if (!Array.isArray(messages) || !messages.length) {
    res.status(400).json({ ok: false, error: 'messages is required' });
    return;
  }

  try {
    const upstream = await fetchWithUA('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(),
        tools: TOOL_DEFS,
        messages,
      }),
    });
    const data = await readJsonOrThrow(upstream);
    res.status(200).json({ ok: true, message: data });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message, body: err.body });
  }
};
