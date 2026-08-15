// Court Radar — free RSS scan of the Maryland federal bankruptcy court's
// public CM/ECF filing feed (flags RELIEF FROM STAY motions: a lender
// asking the judge for permission to foreclose), plus a paid PACER lookup
// that turns a case number into a debtor street address.
//
// FREE (mode: 'scan') needs no credentials at all.
// PAID (mode: 'address') needs PACER_USER + PACER_PASS and is gated by the
// Session 2 User Mode passcode, same as every other paid tool here.

const crypto = require('crypto');
const { requireUserMode } = require('./_lib/auth');
const { fetchWithUA, readJsonOrThrow } = require('./_lib/fetchWithUA');

// Maryland Bankruptcy Court's public CM/ECF RSS feed. If your district/court
// differs, swap this for that court's rss_outside.pl URL — the feed format
// is standardized across CM/ECF courts.
const MD_BANKRUPTCY_RSS_URL = 'https://ecf.mdb.uscourts.gov/cgi-bin/rss_outside.pl';

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml))) {
    const block = m[1];
    const grab = (tag) => { const mm = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return mm ? decodeXmlEntities(mm[1]) : ''; };
    items.push({ title: grab('title'), link: grab('link'), pubDate: grab('pubDate'), description: grab('description') });
  }
  return items;
}

function filingIdFor(item) {
  return crypto.createHash('sha1').update(item.link || item.title + item.pubDate).digest('hex').slice(0, 16);
}

function extractCaseNumber(title) {
  const m = title.match(/\b(\d{2}-\d{4,6})\b/);
  return m ? m[1] : title.slice(0, 24);
}

function extractDebtorName(title) {
  // CM/ECF RSS titles are commonly "23-12345 Doe, John" or similar — best-effort.
  const m = title.match(/\d{2}-\d{4,6}\s*[-:]?\s*(.+)/);
  return m ? m[1].trim() : title;
}

async function handleScan(req, res) {
  try {
    const upstream = await fetchWithUA(MD_BANKRUPTCY_RSS_URL);
    if (!upstream.ok) {
      const err = new Error('RSS feed unavailable');
      err.status = upstream.status;
      throw err;
    }
    const xml = await upstream.text();
    const items = parseRssItems(xml);
    const filings = items.slice(0, 200).map(item => {
      const text = (item.title + ' ' + item.description).toLowerCase();
      return {
        id: filingIdFor(item),
        caseNumber: extractCaseNumber(item.title),
        debtorName: extractDebtorName(item.title),
        debtorAddress: null,
        filedDate: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : null,
        isReliefFromStay: /relief from stay/.test(text),
        sourceUrl: item.link,
      };
    });
    res.status(200).json({ ok: true, filings });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message || 'Scan failed' });
  }
}

// Logs into PACER's standard login API, then pulls a one-page docket report
// for the given case and reads out the debtor's street address. PACER's
// docket-report response format varies by court, so the address extraction
// below is a best-effort heuristic (looks for a US-style street address
// line near "Debtor") — verify against your own account before relying on
// it, and adjust the regex if your court's report layout differs.
async function handleAddress(req, res, caseNumber) {
  const user = process.env.PACER_USER;
  const pass = process.env.PACER_PASS;
  if (!user || !pass) {
    res.status(200).json({ ok: false, notConfigured: true, error: 'PACER_USER / PACER_PASS not set' });
    return;
  }
  if (!caseNumber) {
    res.status(400).json({ ok: false, error: 'caseNumber is required' });
    return;
  }

  try {
    const loginRes = await fetchWithUA('https://pacer.login.uscourts.gov/services/2.0/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: user, password: pass }),
    });
    const login = await readJsonOrThrow(loginRes);
    if (String(login.loginResult) !== '0' || !login.nextGenCSO) {
      const err = new Error(login.errorDescription || 'PACER login rejected');
      err.status = 401;
      throw err;
    }
    const token = login.nextGenCSO;

    // Case Locator lookup to resolve the case number to a docket, then pull
    // the docket report text. Endpoint/shape here follows PACER's published
    // Case Locator (PCL) API; some courts require the case's internal ID
    // rather than the plain case number — adjust if yours does.
    const pclRes = await fetchWithUA('https://pcl.uscourts.gov/pcl-public-api/rest/cases/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-NEXT-GEN-CSO': token },
      body: JSON.stringify({ caseNumber }),
    });
    const pcl = await readJsonOrThrow(pclRes);
    const caseHit = pcl.content && pcl.content[0];
    if (!caseHit) {
      res.status(200).json({ ok: false, kind: 'noMatch', error: 'No docket found for that case number' });
      return;
    }

    const addressGuess = extractAddressFromCaseHit(caseHit);
    if (!addressGuess) {
      res.status(200).json({ ok: false, kind: 'noMatch', error: 'Docket found but no address on file' });
      return;
    }

    res.status(200).json({ ok: true, debtorAddress: addressGuess, debtorName: caseHit.caseTitle || null });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message, body: err.body });
  }
}

function extractAddressFromCaseHit(caseHit) {
  // PCL case records don't always carry a party address in the search
  // response — some courts require a separate docket-report pull. Return
  // whatever address-shaped field is present; adjust here once you've
  // confirmed the exact fields your court's PCL response includes.
  if (caseHit.partyAddress) return caseHit.partyAddress;
  if (caseHit.address) return caseHit.address;
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!requireUserMode(req, res)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const mode = (body && body.mode) || 'scan';

  if (mode === 'scan') { await handleScan(req, res); return; }
  if (mode === 'address') { await handleAddress(req, res, body && body.caseNumber); return; }
  res.status(400).json({ ok: false, error: 'Unknown mode' });
};
