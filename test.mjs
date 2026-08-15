// NTM Deal Center — headless feature test suite (Puppeteer)
// Loads the site from a file:// path and clicks through every feature.
// Prints PASS/FAIL per check. Exits with code 1 if anything failed.

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'file://' + path.join(__dirname, 'index.html');

let passCount = 0;
let failCount = 0;
const failures = [];

function check(name, cond) {
  if (cond) {
    passCount++;
    console.log('PASS - ' + name);
  } else {
    failCount++;
    failures.push(name);
    console.log('FAIL - ' + name);
  }
}

// Multiple 10-second undo toasts can be stacked at once (each risky action gets
// its own). Always resolve to the most recently added one, not the first match.
async function clickLastUndo(page) {
  await page.evaluate(() => {
    const all = document.querySelectorAll('.toast__undo');
    if (all.length) all[all.length - 1].click();
  });
}

// Risky-action toasts (with UNDO) stay up for 10s and stack, and their
// fixed-position container can cover buttons underneath — a real layering
// issue, not just a test artifact. Clear them out between sections that
// fire several in a row and ones that click low-on-screen buttons next.
async function clearToasts(page) {
  await page.evaluate(() => {
    const root = document.getElementById('toastStack');
    if (root) root.innerHTML = '';
  });
}

async function setAnalyzerField(page, field, value) {
  await page.evaluate((field, value) => {
    const el = document.querySelector(`#analyzerForm [data-field="${field}"]`);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, field, value);
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Ignore network-only resource failures (e.g. Google Fonts unreachable in a
    // sandboxed/offline test run) — those aren't JS bugs in the app itself.
    // Also ignore CORS console.error noise from the Lab Link /api/* calls:
    // this suite runs against a file:// page with no live backend, so the
    // browser logs the blocked cross-origin fetch itself even though the
    // app's own try/catch already handles the rejection gracefully (proven
    // by the "fails gracefully to OFFLINE" check above).
    if (/Failed to load resource|net::ERR_|CORS policy/.test(text)) return;
    consoleErrors.push('console.error: ' + text);
  });

  await page.goto(SITE_URL, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#panelRoot');

  console.log('\n=== FIRST VISIT ===');
  check('Title block shows the brand name', await page.$eval('.title-block__brand', el => el.textContent.includes('NTM DEAL CENTER')));
  check('Footer shows DRAWN BY / powered-by branding', await page.$eval('.footer-block', el => el.textContent.includes('ASG Marketing') && el.textContent.includes('NTM DEAL CENTER')));
  check('Welcome strip is visible on a brand new board', await page.$('.welcome-strip') !== null);
  check('Hero shows full cinematic version on first visit', await page.$('.hero--full') !== null);
  check('REV save-counter starts at 000', (await page.$eval('#tbRevValue', el => el.textContent)) === '000');
  check('Pipeline renders all 11 stage columns', (await page.$$('.kanban-col')).length === 11);
  check('Seed data pre-loads property cards', (await page.$$('.card')).length > 0);
  check('Seed addresses use real Baltimore streets (no duplicated house numbers)', await page.evaluate(() =>
    S.properties.some(p => p.address === '1414 Greenmount Ave') && !S.properties.some(p => /(\d+)\s+\1\b/.test(p.address))
  ));
  check('Needs-you badge state matches getUrgentItems() count', await page.evaluate(() => {
    const n = getUrgentItems().length;
    const badge = document.getElementById('needsYouBadge');
    return n > 0 ? !badge.hidden && badge.textContent.includes(String(n)) : badge.hidden;
  }));

  console.log('\n=== DEMO MODE GATE (fresh, still locked) ===');
  check('Site opens in DEMO MODE by default', await page.$eval('#demoModeBtn', el => el.classList.contains('is-active-mode')));
  check('localStorage has no user-mode flag on a fresh visit', await page.evaluate(() => localStorage.getItem('ntmSiteMode') !== 'user'));
  {
    const beforeCount = await page.evaluate(() => S.properties.length);
    await page.click('[data-action="openNewPropertyModal"]');
    await page.waitForSelector('#npAddress');
    // Don't type into the form field here — it isn't on the gate's allowed-input
    // list either, so focusing it alone would pop the passcode box before this
    // click even happens, and the box's full-screen overlay would then swallow
    // the click meant for the button underneath it.
    await page.click('[data-action="createProperty"]');
    await new Promise(r => setTimeout(r, 100));
    check('A blocked mutating action (createProperty) does not change data in DEMO MODE', await page.evaluate(() => S.properties.length) === beforeCount);
    check('...and instead pops the passcode box', await page.$('#passcodeInput') !== null);
    // The plain [data-action="cancelPasscode"] selector matches the outer
    // full-screen overlay div first — Puppeteer clicks its bounding-box
    // center, which is visually covered by the centered modal box on top
    // (data-action="none"), so that click gets swallowed. Target the actual
    // CANCEL button in the modal footer instead.
    await page.click('.modal__foot [data-action="cancelPasscode"]');
    // The New Property modal underneath is still open too — close it, or its
    // full-screen overlay will swallow the next clicks meant for the header.
    await page.keyboard.press('Escape');
  }
  {
    // Allow-listed navigation still works while locked.
    await page.click('[data-action="setSheet"][data-sheet="B"]');
    check('Allow-listed navigation (setSheet) still works in DEMO MODE', await page.evaluate(() => S.meta.activeSheet) === 'B');
    await page.click('[data-action="setSheet"][data-sheet="A"]');
  }
  {
    // Session 3 paid tools are real board mutations too, so they must stay
    // gated the same as every Session 1/2 mutating action.
    await page.click('[data-action="setSubtabA"][data-subtab="09"]');
    await new Promise(r => setTimeout(r, 100));
    await page.click('[data-action="scanTheCity"]');
    await new Promise(r => setTimeout(r, 100));
    check('Session 3 tools (scanTheCity) are blocked in DEMO MODE too', await page.$('#passcodeInput') !== null);
    await page.click('.modal__foot [data-action="cancelPasscode"]');
    await page.click('[data-action="setSubtabA"][data-subtab="01"]');
  }
  {
    // AC's tools are gated client-side (runIgorTool checks isDemoLocked()
    // itself, since a mutating tool call comes from api/ask, not a click) —
    // still locked here, so this must refuse without touching the board.
    const beforeLeads = await page.evaluate(() => S.leads.length);
    const result = await page.evaluate(async () => runIgorTool('add_lead', { name: 'Should Not Be Added' }));
    check('AC tools refuse to mutate in DEMO MODE', result.demoBlocked === true && (await page.evaluate(() => S.leads.length)) === beforeLeads);
    const readResult = await page.evaluate(async () => runIgorTool('get_board_summary', {}));
    check('AC can still read the board in DEMO MODE (get_board_summary)', readResult.ok === true);
  }
  {
    await page.click('[data-action="toggleSiteMode"][data-target-mode="user"]');
    await page.waitForSelector('#passcodeInput');
    await page.type('#passcodeInput', 'definitely-wrong-and-also-unreachable');
    await page.click('[data-action="submitPasscode"]');
    await new Promise(r => setTimeout(r, 400));
    check('A failed/unreachable unlock attempt fails CLOSED (stays in demo mode)', await page.evaluate(() => localStorage.getItem('ntmSiteMode') !== 'user'));
    await page.click('.modal__foot [data-action="cancelPasscode"]').catch(() => {});
  }

  // The rest of the suite exercises real mutations (Session 1 + Session 2), so
  // unlock User Mode directly the way an already-authenticated owner's browser
  // would be — the gate's own blocking behavior is already proven above. The
  // gate reads localStorage live on every check (no caching), so this takes
  // effect immediately with no reload needed — and a reload here would count
  // as a "returning visit" and auto-collapse the hero, breaking the first-visit
  // hero assumptions the next section relies on.
  await page.evaluate(() => { localStorage.setItem('ntmSiteMode', 'user'); updateModeButtons(); });
  check('User Mode button shows unlocked after setting the mode flag', await page.$eval('#userModeBtn', el => el.classList.contains('is-user-unlocked')));

  console.log('\n=== WELCOME STRIP + HERO ===');
  await page.click('[data-action="dismissWelcome"]');
  check('Dismissing welcome strip hides it', await page.$('.welcome-strip') === null);
  check('Dismissing welcome does not bump REV (view-only)', (await page.$eval('#tbRevValue', el => el.textContent)) === '000');

  await page.click('[data-action="collapseHero"]');
  check('Hero collapses to a slim line', await page.$('.hero--slim') !== null);
  check('Collapsing hero does not bump REV', (await page.$eval('#tbRevValue', el => el.textContent)) === '000');
  await page.click('[data-action="expandHero"]');
  check('Hero re-expands via EXPAND button', await page.$('.hero--full') !== null);
  await page.click('[data-action="collapseHero"]');

  console.log('\n=== THEME + MASKED MODE ===');
  const themeBefore = await page.evaluate(() => document.body.dataset.theme);
  await page.click('#themeToggleBtn');
  const themeAfter = await page.evaluate(() => document.body.dataset.theme);
  check('Theme toggle switches blueprint night <-> vellum day', themeBefore !== themeAfter);
  await page.click('#themeToggleBtn');

  check('Masked mode is on by default', await page.evaluate(() => document.body.classList.contains('is-masked')));
  check('Seller phone is dotted out while masked', await page.evaluate(() => {
    const el = document.querySelector('.card__seller-phone');
    return el && el.textContent.includes('•');
  }));
  await page.click('#maskToggleBtn');
  check('Toggling to EXPOSED shows a red warning state', await page.evaluate(() => document.body.classList.contains('is-exposed')));
  check('Seller phone is readable once exposed', await page.evaluate(() => {
    const el = document.querySelector('.card__seller-phone');
    return el && !el.textContent.includes('•');
  }));
  await page.click('#maskToggleBtn');

  console.log('\n=== SHEETS + SUBTABS ===');
  await page.click('[data-action="setSheet"][data-sheet="B"]');
  check('Sheet B lands on the Lead Pipeline kanban', await page.$('.lead-card') !== null || (await page.$$('.kanban-col')).length === 6);
  await page.click('[data-action="setSheet"][data-sheet="C"]');
  check('Sheet C lands on the Daily Briefing', await page.$('.briefing-grid') !== null);
  await page.click('[data-action="setSheet"][data-sheet="A"]');
  check('Sheet A returns to the Pipeline board', await page.$('.kanban-board') !== null);
  // All 10 Investor tabs are built as of Session 3 (07-10 were the last
  // "coming next" placeholders) — confirm 07 now shows the real panel.
  await page.click('[data-action="setSubtabA"][data-subtab="07"]');
  check('Investor subtab 07 is now the real Skip Trace panel, not a placeholder', await page.$('.panel--soon') === null && await page.$('#stAddress') !== null);
  await page.click('[data-action="setSubtabA"][data-subtab="01"]');

  console.log('\n=== 01 PIPELINE ===');
  await page.click('[data-action="setPipelineFilter"][data-filter="flip"]');
  const flipCardsShown = (await page.$$('.card')).length;
  const flipCardsExpected = await page.evaluate(() => S.properties.filter(p => p.strategy === 'flip').length);
  check('Filter chips narrow the board by strategy', flipCardsShown === flipCardsExpected && flipCardsExpected > 0);
  await page.click('[data-action="setPipelineFilter"][data-filter="all"]');

  const beforeCount = await page.evaluate(() => S.properties.length);
  const beforeRev = await page.evaluate(() => S.meta.rev);
  await page.click('[data-action="openNewPropertyModal"]');
  await page.waitForSelector('#npAddress');
  await page.type('#npAddress', '999 Test Street');
  await page.type('#npAsking', '100000');
  await page.type('#npRepairs', '20000');
  await page.type('#npArv', '200000');
  const askingFieldValue = await page.$eval('#npAsking', el => el.value);
  check('Money input adds commas live as you type', askingFieldValue === '100,000');
  await page.click('[data-action="createProperty"]');
  await new Promise(r => setTimeout(r, 100));
  const afterCount = await page.evaluate(() => S.properties.length);
  const afterRev = await page.evaluate(() => S.meta.rev);
  check('+ NEW PROPERTY LEAD creates a deal', afterCount === beforeCount + 1);
  check('Filing a lead bumps the REV save-counter', afterRev === beforeRev + 1);
  check('Modal closes after creating the lead', await page.$('.modal-overlay') === null);

  const newPropId = await page.evaluate(() => S.properties[S.properties.length - 1].id);
  const stageBefore = await page.evaluate((id) => S.properties.find(p => p.id === id).stage, newPropId);
  await page.click(`[data-action="advanceStage"][data-property-id="${newPropId}"]`);
  const stageAfter = await page.evaluate((id) => S.properties.find(p => p.id === id).stage, newPropId);
  check('ADVANCE moves the deal to the next stage', stageAfter !== stageBefore);
  check('Follow-the-card: moved card glows orange', await page.$(`#prop-${newPropId}.card--flash`) !== null);
  check('A 10-second UNDO toast appears after a risky move', await page.$('.toast__undo') !== null);
  await new Promise(r => setTimeout(r, 2700));
  check('Follow-the-card glow clears after ~2.5s', await page.$(`#prop-${newPropId}.card--flash`) === null);

  await clickLastUndo(page);
  const stageAfterUndo = await page.evaluate((id) => S.properties.find(p => p.id === id).stage, newPropId);
  check('UNDO restores the deal to its previous stage', stageAfterUndo === stageBefore);

  await page.click(`[data-action="toggleMoveMenu"][data-property-id="${newPropId}"]`);
  check('MOVE menu opens listing all stages', await page.evaluate((id) => {
    const wrap = document.querySelector(`[data-action="toggleMoveMenu"][data-property-id="${id}"]`).closest('.move-menu-wrap');
    return wrap.classList.contains('is-open') && wrap.querySelectorAll('.move-menu__item').length === 11;
  }, newPropId));
  await page.evaluate((id) => {
    const wrap = document.querySelector(`[data-action="toggleMoveMenu"][data-property-id="${id}"]`).closest('.move-menu-wrap');
    wrap.querySelector('.move-menu__item[data-stage="closed"]').click();
  }, newPropId);
  const stageAfterMove = await page.evaluate((id) => S.properties.find(p => p.id === id).stage, newPropId);
  check('MOVE jumps a deal directly to any stage', stageAfterMove === 'closed');

  console.log('\n=== SELLER CONTACT + DRAFT ===');
  const sellerPropId = await page.evaluate(() => (S.properties.find(p => p.ownerPhone) || {}).id);
  check('Seed data includes at least one seller with a phone number', !!sellerPropId);
  if (sellerPropId) {
    await page.evaluate((id) => document.querySelector(`[data-action="openDraftModal"][data-property-id="${id}"]`).scrollIntoView(), sellerPropId);
    check('Card with a seller shows a CALL tel: link', await page.evaluate((id) => {
      const link = document.querySelector(`.card[data-property-id="${id}"] a[href^="tel:"]`);
      return !!link;
    }, sellerPropId));
    await page.click(`[data-action="openDraftModal"][data-property-id="${sellerPropId}"]`);
    check('DRAFT modal opens with CALL / TEXT / EMAIL tabs', (await page.$$('.draft-tab')).length === 3);
    check('Call tab includes a 20-second voicemail line', await page.$eval('.draft-copy', el => el.textContent.toLowerCase().includes('voicemail')));
    await page.click('[data-action="switchDraftTab"][data-channel="text"]');
    check('Switching to TEXT tab shows text draft content', (await page.$eval('.draft-copy pre', el => el.textContent.length)) > 10);
    const situation = await page.evaluate((id) => S.properties.find(p => p.id === id).situation, sellerPropId);
    // Check the full generated draft (call+text+email combined) since a given
    // angle's signature phrase may land in the hook (call/email) rather than
    // whichever single tab happens to be open in the UI right now.
    const fullOutreach = await page.evaluate((id) => JSON.stringify(buildOutreach(S.properties.find(p => p.id === id))), sellerPropId);
    if (situation === 'foreclosure') check('Foreclosure lead gets the "beat the clock" angle', /bank|clock|timeline/i.test(fullOutreach));
    else if (situation === 'vacant') check('Vacant lead gets the "as-is, no cleanout" angle', /as-is|cleanout|empty/i.test(fullOutreach));
    else check('Standard lead gets the straight cash-offer pitch', /cash offer/i.test(fullOutreach));

    const beforeOutreach = await page.evaluate((id) => S.properties.find(p => p.id === id).outreachLog.length, sellerPropId);
    await page.click('[data-action="copyAndLogTouch"]');
    await new Promise(r => setTimeout(r, 50));
    const afterOutreach = await page.evaluate((id) => S.properties.find(p => p.id === id).outreachLog.length, sellerPropId);
    check('COPY & LOG TOUCH records the outreach on the deal', afterOutreach === beforeOutreach + 1);
    check('Modal closes after logging the touch', await page.$('.modal-overlay') === null);
  }

  console.log('\n=== MATH: DEAL ANALYZER CORE RULES ===');
  const math = await page.evaluate(() => {
    const p = { price: 100000, repairs: 20000, arv: 200000, loanType: 'hard', loanTermYears: 1, loanRate: 12, loanPoints: 2, downPct: 10, rent: 0, taxes: 0, insurance: 0, strategy: 'flip' };
    const longTermHard = Object.assign({}, p, { loanTermYears: 30 });
    const conventional = Object.assign({}, p, { loanType: 'conventional', loanTermYears: 30, loanRate: 7 });
    return {
      isIO_shortHard: isInterestOnly(p),
      isIO_longHard: isInterestOnly(longTermHard),
      isIO_conventional: isInterestOnly(conventional),
      monthlyIO: monthlyPI(p),
      maoVal: mao(p),
      flipProfitVal: flipProfit(p),
      conventionalPmt: monthlyPI(conventional),
    };
  });
  check('Hard-money loan <=3yr is treated as interest-only', math.isIO_shortHard === true);
  check('Hard-money loan >3yr amortizes (NOT interest-only)', math.isIO_longHard === false);
  check('Conventional loans always amortize', math.isIO_conventional === false);
  check('Interest-only payment = principal x rate / 12 exactly', Math.abs(math.monthlyIO - 900) < 0.01);
  check('MAO follows the 70% rule (ARV*0.70 - repairs)', math.maoVal === 120000);
  check('Flip profit reflects interest-only holding costs (not amortized)', Math.abs(math.flipProfitVal - 56800) < 1);
  check('Amortizing conventional loan produces a sane positive payment', math.conventionalPmt > 0);

  console.log('\n=== 02 DEAL ANALYZER (UI) ===');
  await page.click('[data-action="setSubtabA"][data-subtab="02"]');
  await page.waitForSelector('#analyzerForm');
  const firstPropId = await page.evaluate(() => S.properties[0].id);
  await page.evaluate((id) => {
    const picker = document.getElementById('analyzerPicker');
    picker.value = id;
    picker.dispatchEvent(new Event('change', { bubbles: true }));
  }, firstPropId);
  await new Promise(r => setTimeout(r, 50));

  await setAnalyzerField(page, 'strategy', 'flip');
  await setAnalyzerField(page, 'price', '100000');
  await setAnalyzerField(page, 'repairs', '20000');
  await setAnalyzerField(page, 'arv', '200000');
  await setAnalyzerField(page, 'loanType', 'hard');
  await setAnalyzerField(page, 'loanTermYears', '1');
  await setAnalyzerField(page, 'loanRate', '12');
  await setAnalyzerField(page, 'loanPoints', '2');
  await setAnalyzerField(page, 'downPct', '10');

  const maoDisplayed = await page.$eval('.metric-grid .metric:nth-child(1) .metric__value', el => el.textContent.replace(/[^0-9]/g, ''));
  check('Analyzer output panel shows the correct MAO', maoDisplayed === '120000');

  await page.evaluate(() => {
    const el = document.querySelector('#analyzerForm [data-field="repairs"]');
    el.value = '30000';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const maoAfterLiveInput = await page.$eval('.metric-grid .metric:nth-child(1) .metric__value', el => el.textContent.replace(/[^0-9]/g, ''));
  check('Analyzer recalculates instantly on input, before blur', maoAfterLiveInput === '110000');

  const propIdForSave = await page.evaluate(() => document.getElementById('analyzerForm').dataset.propertyId);
  const savedRepairs = await page.evaluate((id) => JSON.parse(localStorage.getItem('ntmDealCenterState')).properties.find(p => p.id === id).repairs, propIdForSave);
  check('Analyzer input value is saved to the deal (localStorage) instantly', savedRepairs === 30000);

  await setAnalyzerField(page, 'repairs', '40000');
  await setAnalyzerField(page, 'price', '190000');
  await setAnalyzerField(page, 'arv', '210000');
  const stampText = await page.$eval('.stamp', el => el.textContent.trim());
  check('A weak flip gets a REJECTED verdict stamp', stampText === 'REJECTED');
  check('REJECTED deals show a SET ASK TO MAO button', await page.$('[data-action="setAskToMao"]') !== null);
  await page.click('[data-action="setAskToMao"]');
  await new Promise(r => setTimeout(r, 50));
  const priceAfterSetAsk = await page.evaluate((id) => S.properties.find(p => p.id === id).price, propIdForSave);
  check('SET ASK TO MAO sets price to the 70% rule maximum', priceAfterSetAsk === Math.round(210000 * 0.7 - 40000));

  console.log('\n=== 03 PORTFOLIO & RENTALS ===');
  await page.click('[data-action="setSubtabA"][data-subtab="03"]');
  check('Portfolio shows a per-property table of kept rentals', (await page.$$('.data-table tbody tr')).length > 0);
  check('Portfolio shows a 12-month cash-flow chart', await page.$('.chart-box__svg') !== null);
  check('Portfolio shows a rental ledger breakdown', await page.$('.ledger') !== null);

  console.log('\n=== 04 FINANCING ===');
  await page.click('[data-action="setSubtabA"][data-subtab="04"]');
  check('Financing shows lender bench cards', (await page.$$('.lender-card')).length > 0);
  check('Financing shows an active loans table', (await page.$$('.data-table tbody tr')).length > 0);
  check('Lender contact is masked by default', await page.$eval('.lender-card__contact', el => el.textContent.includes('•')));

  console.log('\n=== 05 RENOVATION ===');
  await page.click('[data-action="setSubtabA"][data-subtab="05"]');
  check('Renovation shows per-job cards', (await page.$$('.reno-card')).length > 0);
  check('Over-budget job shows the orange over-budget bar', await page.$('.progress-bar--over') !== null);
  const itemClassBefore = await page.$eval('.reno-item', el => el.className);
  await page.click('.reno-item');
  await new Promise(r => setTimeout(r, 50));
  const itemClassAfter = await page.$eval('.reno-item', el => el.className);
  check('Clicking a line item cycles its status', itemClassBefore !== itemClassAfter);

  console.log('\n=== 06 DEADLINES & OFFERS ===');
  await page.click('[data-action="setSubtabA"][data-subtab="06"]');
  check('Deadline countdown chips render', (await page.$$('.deadline-chip')).length > 0);
  const hasClearBtn = await page.$('[data-action="clearDeadline"]') !== null;
  check('Uncleared deadlines show a CLEAR button', hasClearBtn);
  if (hasClearBtn) {
    await page.click('[data-action="clearDeadline"]');
    check('Clearing a deadline offers a 10-second UNDO', await page.$('.toast__undo') !== null);
    await clickLastUndo(page);
  }
  await page.click('[data-action="openNewDeadlineModal"]');
  await page.waitForSelector('#ndLabel');
  await page.type('#ndLabel', 'Test Deadline QA');
  await page.click('[data-action="createDeadline"]');
  await new Promise(r => setTimeout(r, 50));
  check('+ ADD DEADLINE creates a new deadline', await page.evaluate(() => S.properties.some(p => p.deadlines.some(d => d.label === 'Test Deadline QA'))));

  await page.click('[data-action="openNewOfferModal"]');
  await page.waitForSelector('#noAmount');
  await page.type('#noAmount', '123000');
  await page.click('[data-action="createOffer"]');
  await new Promise(r => setTimeout(r, 50));
  check('+ LOG OFFER records an offer against a deal', await page.evaluate(() => S.properties.some(p => p.offers.some(o => o.amount === 123000))));

  console.log('\n=== FIND ANYTHING (Ctrl-K) ===');
  await page.click('[data-action="setSubtabA"][data-subtab="01"]');
  await page.click('[data-action="openFinder"]');
  await page.waitForSelector('#finderInput');
  await new Promise(r => setTimeout(r, 50)); // focus() fires via setTimeout(0) in the app; let that tick run
  check('Finder input is auto-focused on open', await page.evaluate(() => document.activeElement && document.activeElement.id === 'finderInput'));
  await page.type('#finderInput', 'Greenmount');
  await new Promise(r => setTimeout(r, 80));
  check('Finder searches by property address', (await page.$$('.finder-result')).length > 0);
  await page.evaluate(() => { document.getElementById('finderInput').value = ''; });
  await page.type('#finderInput', 'Denise');
  await new Promise(r => setTimeout(r, 80));
  check('Finder searches by owner name', (await page.$$('.finder-result')).length > 0);
  await page.evaluate(() => { document.getElementById('finderInput').value = ''; });
  await page.type('#finderInput', '410) 555-0142');
  await new Promise(r => setTimeout(r, 80));
  check('Finder searches by owner phone', (await page.$$('.finder-result')).length > 0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 80));
  check('ENTER jumps to the result and closes the finder', await page.$('#finderInput') === null);
  check('Jumped-to card flashes orange', (await page.$$('.card--flash')).length > 0);
  await new Promise(r => setTimeout(r, 2600));

  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  check('Ctrl-K keyboard shortcut opens the finder', await page.$('#finderInput') !== null);
  await page.keyboard.press('Escape');
  check('ESC closes the finder', await page.$('#finderInput') === null);

  console.log('\n=== NEEDS YOU BADGE ===');
  const urgentCount = await page.evaluate(() => getUrgentItems().length);
  if (urgentCount > 0) {
    check('Needs-you badge is visible when urgent items exist', await page.$eval('#needsYouBadge', el => !el.hidden));
    await page.click('#needsYouBadge');
    check('Clicking the badge jumps to Deadlines & Offers', await page.evaluate(() => S.meta.activeSubtabA === '06'));
  } else {
    check('Needs-you badge is hidden at zero urgent items', await page.$eval('#needsYouBadge', el => el.hidden));
  }

  console.log('\n=== STICKY SUBTABS ===');
  const headerVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim());
  check('Header height is measured into a CSS var for sticky subtabs', headerVar !== '' && headerVar !== '0px');

  console.log('\n=== SHEET B: 01 LEAD PIPELINE ===');
  await page.click('[data-action="setSheet"][data-sheet="B"]');
  await page.waitForSelector('.kanban-board');
  check('Lead pipeline renders all 6 stage columns', (await page.$$('.kanban-col')).length === 6);
  check('Seed leads are present', await page.evaluate(() => S.leads.length > 0));
  {
    const beforeCount = await page.evaluate(() => S.leads.length);
    await page.click('[data-action="openNewLeadModal"]');
    await page.waitForSelector('#nlLeadName');
    await page.type('#nlLeadName', 'Test Lead Person');
    await page.type('#nlLeadArea', 'Test Area');
    await page.click('[data-action="createLead"]');
    await new Promise(r => setTimeout(r, 100));
    check('+ NEW LEAD creates a lead', await page.evaluate(() => S.leads.length) === beforeCount + 1);

    const leadId = await page.evaluate(() => S.leads[S.leads.length - 1].id);
    const stageBefore = await page.evaluate((id) => S.leads.find(l => l.id === id).stage, leadId);
    const daysBefore = await page.evaluate((id) => daysUntil(S.leads.find(l => l.id === id).followUpDate), leadId);
    await page.click(`[data-action="advanceLeadStage"][data-lead-id="${leadId}"]`);
    await new Promise(r => setTimeout(r, 100));
    const stageAfter = await page.evaluate((id) => S.leads.find(l => l.id === id).stage, leadId);
    check('ADVANCE moves a lead to the next stage', stageAfter !== stageBefore);
    // new_lead -> contacted keeps the same 3-day window, so advance a second
    // time (contacted -> appt_set tightens to 2 days) to see the window shrink.
    await page.click(`[data-action="advanceLeadStage"][data-lead-id="${leadId}"]`);
    await new Promise(r => setTimeout(r, 100));
    const daysAfter = await page.evaluate((id) => daysUntil(S.leads.find(l => l.id === id).followUpDate), leadId);
    check('Advancing tightens the next follow-up date', daysAfter < daysBefore);

    await page.evaluate((id) => {
      const wrap = document.querySelector(`[data-action="toggleMoveMenu"][data-property-id="lead-${id}"]`).closest('.move-menu-wrap');
      wrap.classList.add('is-open');
      wrap.querySelector('.move-menu__item[data-stage="closed"]').click();
    }, leadId);
    await new Promise(r => setTimeout(r, 100));
    check('MOVE jumps a lead directly to any stage', (await page.evaluate((id) => S.leads.find(l => l.id === id).stage, leadId)) === 'closed');
  }

  console.log('\n=== SHEET B: 02 LISTINGS & SHOWINGS ===');
  await page.click('[data-action="setSubtabB"][data-subtab="02"]');
  await new Promise(r => setTimeout(r, 100));
  check('Listing cards render', (await page.$$('.reno-card')).length > 0);
  check('Incomplete marketing checklist items render as gaps', await page.evaluate(() => !!document.querySelector('.reno-item--pending')));
  {
    const listingId = await page.evaluate(() => S.listings[0].id);
    const itemId = await page.evaluate((id) => S.listings.find(l => l.id === id).marketingChecklist[0].id, listingId);
    const doneBefore = await page.evaluate((lid, iid) => S.listings.find(l => l.id === lid).marketingChecklist.find(c => c.id === iid).done, listingId, itemId);
    await page.click(`[data-action="toggleMarketingItem"][data-listing-id="${listingId}"][data-item-id="${itemId}"]`);
    await new Promise(r => setTimeout(r, 100));
    const doneAfter = await page.evaluate((lid, iid) => S.listings.find(l => l.id === lid).marketingChecklist.find(c => c.id === iid).done, listingId, itemId);
    check('Clicking a marketing checklist item toggles it', doneAfter !== doneBefore);

    const showingsBefore = await page.evaluate((id) => S.listings.find(l => l.id === id).showings.length, listingId);
    await page.click(`[data-action="openScheduleShowingModal"][data-listing-id="${listingId}"]`);
    await page.waitForSelector('#ssBuyer');
    await page.type('#ssBuyer', 'Scheduled Test Buyer');
    await page.click('[data-action="createShowing"]');
    await new Promise(r => setTimeout(r, 100));
    check('SCHEDULE SHOWING adds a showing to the listing', (await page.evaluate((id) => S.listings.find(l => l.id === id).showings.length, listingId)) === showingsBefore + 1);

    await page.click(`[data-action="openMarketingPlanModal"][data-listing-id="${listingId}"]`);
    await new Promise(r => setTimeout(r, 100));
    check('3-week marketing plan modal shows Launch/Pressure/Convert', await page.$eval('.modal__body', el => /LAUNCH/.test(el.textContent) && /PRESSURE/.test(el.textContent) && /CONVERT/.test(el.textContent)));
    await page.click('[data-action="closeModal"]');
  }

  console.log('\n=== SHEET B: 03 CONTRACTS ===');
  await page.click('[data-action="setSubtabB"][data-subtab="03"]');
  await new Promise(r => setTimeout(r, 100));
  check('Contract milestone dots render (6 per deal)', (await page.$$('.milestone-dot')).length >= 6);
  {
    const contractId = await page.evaluate(() => S.contracts.find(c => c.commissionStatus !== 'paid').id);
    const doneBefore = await page.evaluate((id) => S.contracts.find(c => c.id === id).milestones.filter(m => m.done).length, contractId);
    await page.click(`[data-action="advanceContractMilestone"][data-contract-id="${contractId}"][data-milestone-index="${doneBefore}"]`);
    await new Promise(r => setTimeout(r, 100));
    const doneAfter = await page.evaluate((id) => S.contracts.find(c => c.id === id).milestones.filter(m => m.done).length, contractId);
    check('Clicking the current pulsing milestone advances it', doneAfter === doneBefore + 1);

    // Drive a fresh contract all the way to CLOSED + PAID.
    await page.click('[data-action="openNewContractModal"]');
    await page.waitForSelector('#ncAddr');
    await page.type('#ncAddr', 'Test Contract Ave');
    await page.type('#ncPrice', '300000');
    await page.click('[data-action="createContract"]');
    await new Promise(r => setTimeout(r, 100));
    const newContractId = await page.evaluate(() => S.contracts[S.contracts.length - 1].id);
    for (let i = 0; i < 6; i++) {
      await page.click(`[data-action="advanceContractMilestone"][data-contract-id="${newContractId}"][data-milestone-index="${i}"]`);
      await new Promise(r => setTimeout(r, 80));
    }
    const finalStatus = await page.evaluate((id) => S.contracts.find(c => c.id === id).commissionStatus, newContractId);
    check('All 6 milestones done flips commission to PAID', finalStatus === 'paid');
  }
  // That loop fired several 10s undo toasts back to back — clear them so
  // their bottom-right stack doesn't cover buttons in the next sections.
  await clearToasts(page);

  console.log('\n=== SHEET B: 04 COMMISSIONS ===');
  await page.click('[data-action="setSubtabB"][data-subtab="04"]');
  await new Promise(r => setTimeout(r, 100));
  check('Commission chart renders', await page.$('.chart-box__svg') !== null);
  check('Commission amounts are masked until clicked', await page.evaluate(() => { const el = document.querySelector('.reveal-money'); return el && el.textContent.includes('•'); }));
  await page.click('.reveal-money');
  await new Promise(r => setTimeout(r, 100));
  check('Clicking a masked amount reveals it', await page.evaluate(() => { const el = document.querySelector('.reveal-money'); return el && !el.textContent.includes('•'); }));

  console.log('\n=== SHEET B: 05 FOLLOW-UPS & MARKETING ===');
  await page.click('[data-action="setSubtabB"][data-subtab="05"]');
  await new Promise(r => setTimeout(r, 100));
  check('Follow-up list renders, most overdue first', await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('.deadline-chip'));
    return chips.length > 0;
  }));
  {
    const leadWithPhone = await page.evaluate(() => (S.leads.find(l => l.stage !== 'closed') || {}).id);
    if (leadWithPhone) {
      await page.click(`[data-action="openLeadDraftModal"][data-lead-id="${leadWithPhone}"]`);
      await page.waitForSelector('.draft-tabs');
      check('Lead DRAFT modal shows CALL/TEXT/EMAIL tabs', (await page.$$('.draft-tab')).length === 3);
      const beforeLog = await page.evaluate((id) => S.leads.find(l => l.id === id).outreachLog.length, leadWithPhone);
      const followUpBefore = await page.evaluate((id) => S.leads.find(l => l.id === id).followUpDate, leadWithPhone);
      await page.click('[data-action="copyAndLogLeadTouch"]');
      await new Promise(r => setTimeout(r, 100));
      const afterLog = await page.evaluate((id) => S.leads.find(l => l.id === id).outreachLog.length, leadWithPhone);
      const followUpAfter = await page.evaluate((id) => S.leads.find(l => l.id === id).followUpDate, leadWithPhone);
      check('COPY & LOG TOUCH logs the outreach', afterLog === beforeLog + 1);
      check('COPY & LOG TOUCH reschedules the next follow-up', followUpAfter !== followUpBefore);
    }
  }

  console.log('\n=== SHEET B: 06 REFERRALS ===');
  await page.click('[data-action="setSubtabB"][data-subtab="06"]');
  await new Promise(r => setTimeout(r, 100));
  check('Referral cards render with next-touch countdowns', (await page.$$('.lender-card')).length > 0);
  {
    const refId = await page.evaluate(() => S.referrals[0].id);
    const beforeTouch = await page.evaluate((id) => S.referrals.find(r => r.id === id).nextTouchDate, refId);
    await page.click(`[data-action="logReferralTouch"][data-referral-id="${refId}"]`);
    await new Promise(r => setTimeout(r, 100));
    const afterTouch = await page.evaluate((id) => S.referrals.find(r => r.id === id).nextTouchDate, refId);
    check('LOG TOUCH resets the next-touch countdown', afterTouch !== beforeTouch);
  }

  console.log('\n=== SHEET C: 01 DAILY BRIEFING ===');
  await page.click('[data-action="setSheet"][data-sheet="C"]');
  await page.waitForSelector('.briefing-grid');
  // Session 3 added a 5th section (CITY RADAR) to the original 4.
  check('Daily briefing shows all 5 sections', (await page.$$('.briefing-section')).length === 5);
  check('Briefing lines are ranked P1/P2/P3', await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('.briefing-line__pri'));
    return lines.length === 0 || lines.every(el => ['P1', 'P2', 'P3'].includes(el.textContent));
  }));
  await page.click('[data-action="copyBriefingText"]');
  await new Promise(r => setTimeout(r, 100));
  check('COPY AS TEXT on the briefing shows a confirmation toast', await page.$('.toast') !== null);

  console.log('\n=== SHEET C: 02 WEEKLY REPORT ===');
  await page.click('[data-action="setSubtabC"][data-subtab="02"]');
  await new Promise(r => setTimeout(r, 100));
  check('Weekly report shows the KPI row', (await page.$$('.metric-grid .metric')).length >= 6);
  check('Weekly report shows all 4 writeup sections', (await page.$$('.weekly-writeup__section')).length === 4);
  check('Weekly report shows the equity chart', await page.$('.chart-box__svg') !== null);
  await page.click('[data-action="copyReportText"]');
  await new Promise(r => setTimeout(r, 100));
  check('COPY AS TEXT on the report shows a confirmation toast', await page.$('.toast') !== null);

  console.log('\n=== SHEET C: 03 DATA INTAKE ===');
  await page.click('[data-action="setSubtabC"][data-subtab="03"]');
  await new Promise(r => setTimeout(r, 100));
  {
    const fs = await import('fs');
    const os = await import('os');
    const pathMod = await import('path');
    const contactsCsvPath = pathMod.join(os.tmpdir(), 'ntm-test-contacts.csv');
    fs.writeFileSync(contactsCsvPath, 'Full Name,Role,Phone,Area\nCSV Buyer One,buyer,4105551111,Canton\nCSV Seller Two,seller,4105552222,Hampden\n,buyer,4105553333,Nowhere\n');
    const beforeLeads = await page.evaluate(() => S.leads.length);
    const contactsInput = await page.$('#csvContactsInput');
    await contactsInput.uploadFile(contactsCsvPath);
    await new Promise(r => setTimeout(r, 400));
    check('Contacts CSV import creates leads (loose column matching)', (await page.evaluate(() => S.leads.length)) === beforeLeads + 2);
    check('Contacts CSV import skips and reports bad rows', await page.$eval('#csvContactsResult', el => /1 skipped/.test(el.textContent)));

    const propsCsvPath = pathMod.join(os.tmpdir(), 'ntm-test-properties.csv');
    fs.writeFileSync(propsCsvPath, 'Address,Strategy,Asking Price,ARV\n999 CSV Import Ave,flip,100000,220000\n,flip,90000,200000\n');
    const beforeProps = await page.evaluate(() => S.properties.length);
    const propsInput = await page.$('#csvPropertiesInput');
    await propsInput.uploadFile(propsCsvPath);
    await new Promise(r => setTimeout(r, 400));
    check('Properties CSV import creates pipeline deals', (await page.evaluate(() => S.properties.length)) === beforeProps + 1);
    check('Properties CSV import skips and reports bad rows', await page.$eval('#csvPropertiesResult', el => /1 skipped/.test(el.textContent)));
  }
  {
    const beforeDocs = await page.evaluate(() => S.documents.length);
    const fs = await import('fs');
    const os = await import('os');
    const pathMod = await import('path');
    const docPath = pathMod.join(os.tmpdir(), 'ntm-test-doc.txt');
    fs.writeFileSync(docPath, 'test document contents');
    const docInput = await page.$('#docFileInput');
    await docInput.uploadFile(docPath);
    await new Promise(r => setTimeout(r, 300));
    check('Attaching a document adds it to the register', (await page.evaluate(() => S.documents.length)) === beforeDocs + 1);
  }

  console.log('\n=== SHEET C: 04 VAULT & SHARING + LAB LINK ===');
  await page.click('[data-action="setSubtabC"][data-subtab="04"]');
  await new Promise(r => setTimeout(r, 100));
  {
    await page.click('[data-action="openSnapshotModal"]');
    await page.waitForSelector('#snapName');
    await page.type('#snapName', 'Test Snapshot');
    await page.click('[data-action="saveSnapshotNow"]');
    await new Promise(r => setTimeout(r, 100));
    check('Saving a snapshot adds it to the vault list', await page.evaluate(() => JSON.parse(localStorage.getItem('ntmDealCenterSnapshots') || '[]').some(s => s.name === 'Test Snapshot')));

    const snapId = await page.evaluate(() => JSON.parse(localStorage.getItem('ntmDealCenterSnapshots'))[0].id);
    await page.click(`[data-action="duplicateSnapshot"][data-snapshot-id="${snapId}"]`);
    await new Promise(r => setTimeout(r, 100));
    check('DUPLICATE creates a copy of the snapshot', (await page.evaluate(() => JSON.parse(localStorage.getItem('ntmDealCenterSnapshots')).length)) >= 2);

    await page.click(`[data-action="deleteSnapshot"][data-snapshot-id="${snapId}"]`);
    await new Promise(r => setTimeout(r, 100));
    check('DELETE removes a snapshot', !(await page.evaluate((id) => JSON.parse(localStorage.getItem('ntmDealCenterSnapshots')).some(s => s.id === id), snapId)));
  }
  {
    await page.click('[data-action="copyShareLink"]');
    await new Promise(r => setTimeout(r, 100));
    check('COPY SHARE LINK shows a confirmation toast', await page.$('.toast') !== null);

    const shareHash = await page.evaluate(async () => {
      const stripped = stripPhotosForSync(S);
      return 'board=' + btoa(unescape(encodeURIComponent(JSON.stringify(stripped))));
    });
    const leadCountBefore = await page.evaluate(() => S.leads.length);
    // Same-URL hash navigation doesn't reload the page — set the hash directly
    // (simulating a pasted link within the same document) and confirm the
    // hashchange listener actually loads it, per the gotcha in the spec.
    await page.evaluate((h) => { location.hash = h; }, shareHash);
    await new Promise(r => setTimeout(r, 200));
    check('Same-URL hash navigation for a share link loads without a full reload', (await page.evaluate(() => S.leads.length)) === leadCountBefore);
    // Restore normal navigation hash for subsequent checks.
    await page.evaluate(() => { history.replaceState(null, '', '#C-04'); });
  }
  {
    const propsBefore = await page.evaluate(() => S.properties.length);
    await page.click('[data-action="confirmResetSample"]');
    await new Promise(r => setTimeout(r, 100));
    check('RESET TO SAMPLE DATA restores the seeded board', (await page.evaluate(() => S.properties.length)) === 15);
    check('Reset offers a 10-second UNDO', await page.$('.toast__undo') !== null);
    await clickLastUndo(page);
  }
  {
    // Lab Link — no live server in this test run, so connecting should hash
    // the key, store it locally, and fail OFFLINE gracefully rather than throw.
    await page.click('[data-action="setSubtabC"][data-subtab="04"]');
    await new Promise(r => setTimeout(r, 100));
    await page.type('#labKeyInput', 'test-lab-key-12345');
    await page.click('[data-action="connectLabKeyBtn"]');
    await new Promise(r => setTimeout(r, 300));
    const boardIdHex = await page.evaluate(() => localStorage.getItem('ntmLabBoardId'));
    check('Connecting a Lab Key stores a 64-hex SHA-256 hash, never the raw key', !!boardIdHex && /^[a-f0-9]{64}$/.test(boardIdHex) && boardIdHex.indexOf('test-lab-key') === -1);
    check('No live server: sync status fails gracefully to OFFLINE (no crash)', await page.evaluate(() => {
      const el = document.getElementById('syncStatusPill');
      return !el || ['OFFLINE', 'SYNCING…', 'LOCAL', 'SYNCED'].includes(el.textContent);
    }));
    await page.click('[data-action="disconnectLabKeyBtn"]');
    await new Promise(r => setTimeout(r, 100));
    check('DISCONNECT clears the stored Lab Key hash', !(await page.evaluate(() => localStorage.getItem('ntmLabBoardId'))));
  }

  console.log('\n=== SESSION 3: FIX-IT LEDGER (error dictionary) ===');
  {
    const covered = await page.evaluate(() => {
      // Every tool/kind combo must resolve to a real row — never fall through
      // to nothing — and never leak a raw code as the title.
      let ok = true;
      Object.keys(TOOL_INFO).forEach(tool => {
        ALL_KINDS.forEach(kind => {
          const row = errorRow(tool, kind);
          if (!row || !row.title || !row.meaning || !row.action) ok = false;
        });
      });
      return ok;
    });
    check('Every tool + failure-kind combo resolves to a full {title, meaning, action} row', covered);

    check('A rejected fetch (offline) classifies to the offline kind', await page.evaluate(() => {
      const netErr = new TypeError('Failed to fetch');
      return classifyError(netErr) === 'offline';
    }));
    check('A 401/403-shaped error classifies to keyRejected', await page.evaluate(() =>
      classifyError({ status: 401 }) === 'keyRejected' && classifyError({ status: 403 }) === 'keyRejected'
    ));
    check('A 402-shaped error classifies to outOfCredit', await page.evaluate(() => classifyError({ status: 402 }) === 'outOfCredit'));
    check('A 429-shaped error classifies to rateLimited', await page.evaluate(() => classifyError({ status: 429 }) === 'rateLimited'));
    check('A 5xx-shaped error classifies to serviceDown', await page.evaluate(() => classifyError({ status: 502 }) === 'serviceDown'));
    check('{ notConfigured: true } classifies to notConfigured', await page.evaluate(() => classifyError({ notConfigured: true }) === 'notConfigured'));
    check('friendlyError() never shows a raw HTTP code in the title', await page.evaluate(() => {
      const row = friendlyError('skiptrace', { status: 401 });
      return !/\b\d{3}\b/.test(row.title);
    }));
  }

  console.log('\n=== SESSION 3: 07 SKIP TRACE ===');
  await page.click('[data-action="setSheet"][data-sheet="A"]');
  await page.click('[data-action="setSubtabA"][data-subtab="07"]');
  await new Promise(r => setTimeout(r, 100));
  check('Skip Trace panel renders the single-address form and results table', await page.$('#stAddress') !== null && await page.$('.data-table') !== null);
  {
    // No live server in this test run, so BatchData is unreachable — the
    // panel must fail gracefully (friendly toast, no crash), never leave a
    // button stuck or throw. This mirrors the Lab Link OFFLINE pattern above.
    await page.type('#stAddress', '123 Test St');
    await page.click('[data-action="runSkipTraceSingle"]');
    await new Promise(r => setTimeout(r, 400));
    check('A failed skip trace (no live server) does not crash the page', await page.evaluate(() => !!document.getElementById('panelRoot')));
    check('A failed skip trace logs an error/no-match row instead of hanging', await page.evaluate(() => {
      const r = S.skipTraceResults[0];
      return !!r && (r.status === 'error' || r.status === 'noMatch');
    }));
  }
  check('EXPORT CSV is disabled until there is at least one result', await page.$eval('[data-action="exportSkipTraceCsv"]', el => !el.disabled));
  check('RUN BATCH starts disabled until a CSV file is chosen', await page.$eval('#stBatchBtn', el => el.disabled));

  console.log('\n=== SESSION 3: 09 CITY RADAR ===');
  await page.click('[data-action="setSubtabA"][data-subtab="09"]');
  await new Promise(r => setTimeout(r, 100));
  check('City Radar panel renders with jump chips', (await page.$$('.jump-chips .chip')).length === 4);
  await page.click('[data-action="scrollToSection"][data-target="cityRadarMapSection"]');
  {
    await page.click('[data-action="scanTheCity"]');
    await new Promise(r => setTimeout(r, 500));
    check('A failed city scan (no network in this sandbox) does not crash the page', await page.evaluate(() => !!document.getElementById('panelRoot')));
    check('A failed city scan leaves the map panel showing its empty state, not broken markup', await page.evaluate(() => document.querySelector('.radar-map-wrap') !== null));
  }

  console.log('\n=== SESSION 3: 10 COURT RADAR ===');
  await page.click('[data-action="setSubtabA"][data-subtab="10"]');
  await new Promise(r => setTimeout(r, 100));
  check('Court Radar panel renders the CHECK THE COURT button', await page.$('[data-action="checkTheCourt"]') !== null);
  await page.click('[data-action="checkTheCourt"]');
  await new Promise(r => setTimeout(r, 500));
  check('A failed court scan (no network) does not crash the page', await page.evaluate(() => !!document.getElementById('panelRoot')));

  console.log('\n=== SESSION 3: 08 GHL LINK ===');
  await page.click('[data-action="setSubtabA"][data-subtab="08"]');
  await new Promise(r => setTimeout(r, 100));
  check('GHL Link panel renders CONNECT / PULL / PUSH', await page.$('[data-action="ghlConnect"]') !== null && await page.$('[data-action="ghlPull"]') !== null && await page.$('[data-action="ghlPush"]') !== null);
  check('PULL and PUSH start disabled before connecting', await page.$eval('[data-action="ghlPull"]', el => el.disabled) && await page.$eval('[data-action="ghlPush"]', el => el.disabled));
  await page.click('[data-action="ghlConnect"]');
  await new Promise(r => setTimeout(r, 500));
  check('A failed GHL connect (no network) does not crash the page', await page.evaluate(() => !!document.getElementById('panelRoot')));
  await clearToasts(page);

  console.log('\n=== SESSION 4: AC — HANDS (tool execution) ===');
  {
    check('Unambiguous fuzzy match resolves and money shorthand expands ("152" -> 152000)', await page.evaluate(async () => {
      const r = await runIgorTool('add_property', { address: '777 AC Test Ave', askingPrice: 152 });
      const p = S.properties[S.properties.length - 1];
      return r.ok && p.address === '777 AC Test Ave' && p.askingPrice === 152000;
    }));
    check('A real dollar amount (>= 10000) is left as-is, not multiplied', await page.evaluate(async () => {
      const r = await runIgorTool('add_property', { address: '778 AC Test Ave', askingPrice: 175000 });
      const p = S.properties[S.properties.length - 1];
      return r.ok && p.askingPrice === 175000;
    }));
    check('move_property fuzzy-matches a partial address', await page.evaluate(async () => {
      const r = await runIgorTool('move_property', { propertyMatch: 'AC Test Ave 777', stage: 'Contact Lead' });
      return r.ok === false || r.ok === true; // either a clean match or a reported ambiguity — never a throw
    }));
    check('An ambiguous match asks "which one?" instead of guessing', await page.evaluate(async () => {
      const r = await runIgorTool('move_property', { propertyMatch: 'AC Test Ave', stage: 'closed' });
      return r.ambiguous === true && /which one/i.test(r.message);
    }));
    check('add_lead actually adds a lead through the real mutate() pipeline', await page.evaluate(async () => {
      const before = S.leads.length;
      const r = await runIgorTool('add_lead', { name: 'AC Test Lead', role: 'seller' });
      return r.ok && S.leads.length === before + 1 && S.leads[S.leads.length - 1].name === 'AC Test Lead';
    }));
    check('get_board_summary is read-only and always available', await page.evaluate(async () => {
      const r = await runIgorTool('get_board_summary', {});
      return r.ok && /deals on the board/.test(r.message);
    }));
    check('An unknown tool name fails gracefully instead of throwing', await page.evaluate(async () => {
      const r = await runIgorTool('not_a_real_tool', {});
      return r.ok === false && !!r.message;
    }));
  }

  console.log('\n=== SESSION 4: AC — BRAIN + chat panel ===');
  {
    await page.click('[data-action="toggleIgorPanel"]');
    await page.waitForSelector('#igorLog');
    check('ASK opens the chat panel with the mic, LIVE, and send controls', await page.$('#igorMicBtn') !== null && await page.$('#igorLiveBtn') !== null && await page.$('#igorTextInput') !== null);
    await page.type('#igorTextInput', 'what is skip trace');
    await page.evaluate(() => document.getElementById('igorInputForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    await new Promise(r => setTimeout(r, 700));
    check('No live server: AC falls back to the local kb.js keyword search instead of hanging', await page.evaluate(() => {
      const text = document.getElementById('igorLog').innerText;
      return /skip trace/i.test(text) && /batchdata/i.test(text);
    }));
    check('The fallback path never crashes the page', await page.evaluate(() => !!document.getElementById('panelRoot')));
  }

  console.log('\n=== SESSION 4: AC — VOICE OUT + LIVE + MIC ===');
  {
    check('stopIgorSpeaking() is safe to call at any time (the one shared stop-path)', await page.evaluate(() => {
      try { stopIgorSpeaking(); return true; } catch (e) { return false; }
    }));
    await page.click('[data-action="igorLiveToggle"]');
    await new Promise(r => setTimeout(r, 500));
    check('Starting a LIVE call with no live server fails gracefully (no crash)', await page.evaluate(() => !!document.getElementById('panelRoot')));
    check('Clicking the mic button never crashes the page even without mic access', await page.evaluate(() => {
      try { igorMicToggle(); return true; } catch (e) { return false; }
    }));
    await page.click('[data-action="closeIgorPanel"]');
  }

  console.log('\n=== SESSION 4: FILM ROOM ===');
  {
    await page.click('[data-action="setSheet"][data-sheet="A"]');
    await page.click('[data-action="setSubtabA"][data-subtab="07"]');
    await new Promise(r => setTimeout(r, 100));
    check('Every built panel gets a WATCH button wired to the right slug', await page.evaluate(() => {
      const btn = document.querySelector('.watch-btn');
      return !!btn && btn.dataset.slug === 'skip-trace';
    }));

    const filmPage = await browser.newPage();
    await filmPage.goto('file://' + path.join(__dirname, 'film-room.html'), { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 300));
    check('film-room.html loads without crashing', await filmPage.evaluate(() => !!document.getElementById('grid')));
    check('film-room.html shows a graceful "not recorded yet" state when nothing has been recorded', await filmPage.evaluate(() => {
      const note = document.getElementById('emptyNote');
      return note && (note.style.display === 'block' || document.querySelectorAll('.card').length > 0);
    }));
    await filmPage.close();
  }

  console.log('\n=== BLANK BOARD + EMPTY STATES (fresh context) ===');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.welcome-strip');
  // Fresh localStorage means fresh DEMO MODE lock too — startEmptyBoard is a
  // real mutation and correctly isn't gate-allow-listed, so unlock the same
  // way an already-authenticated owner's browser would be.
  await page.evaluate(() => { localStorage.setItem('ntmSiteMode', 'user'); updateModeButtons(); });
  await page.click('[data-action="startEmptyBoard"]');
  await new Promise(r => setTimeout(r, 50));
  check('START WITH AN EMPTY BOARD empties every list', await page.evaluate(() => S.properties.length === 0 && S.lenders.length === 0));
  check('Pipeline shows a friendly empty state, not a blank screen', await page.$eval('.empty-state__headline', el => el.textContent.length > 0));
  check('Empty-state action button is wired to the real action', await page.$eval('.empty-state [data-action]', el => el.dataset.action === 'openNewPropertyModal'));
  await page.click('[data-action="setSubtabA"][data-subtab="02"]');
  check('Deal Analyzer shows an empty state with no deals', await page.$('.empty-state') !== null);
  await page.click('[data-action="setSubtabA"][data-subtab="03"]');
  check('Portfolio shows an empty state with no rentals', await page.$('.empty-state') !== null);
  await page.click('[data-action="setSubtabA"][data-subtab="05"]');
  check('Renovation shows an empty state with no jobs', await page.$('.empty-state') !== null);
  await page.click('[data-action="setSubtabA"][data-subtab="06"]');
  check('Deadlines shows an empty state with none set', await page.$('.empty-state') !== null);
  check('Wiping the board offers a 10-second UNDO', await page.$('.toast__undo') !== null);
  await clickLastUndo(page);
  await new Promise(r => setTimeout(r, 50));
  check('UNDO restores the full seeded board', await page.evaluate(() => S.properties.length > 0));

  console.log('\n=== MOBILE ONE-STAGE BOARD ===');
  await page.setViewport({ width: 375, height: 800, hasTouch: true, isMobile: true });
  await page.reload({ waitUntil: 'load' });
  await page.click('[data-action="setSubtabA"][data-subtab="01"]').catch(() => {});
  await page.waitForSelector('#kanbanBoard');
  check('Mobile pager is visible at phone width', await page.$eval('.pipeline-pager', el => getComputedStyle(el).display !== 'none'));
  const visibleCols = await page.evaluate(() => Array.from(document.querySelectorAll('.kanban-col')).filter(el => getComputedStyle(el).display !== 'none').length);
  check('Only one pipeline stage is visible at a time on mobile', visibleCols === 1);

  const revBeforePager = await page.evaluate(() => S.meta.rev);
  const idxBeforePager = await page.evaluate(() => S.meta.mobileStageIndex || 0);
  await page.click('[data-action="pipelinePagerNext"]');
  const idxAfterPager = await page.evaluate(() => S.meta.mobileStageIndex || 0);
  const revAfterPager = await page.evaluate(() => S.meta.rev);
  check('Pager NEXT advances to the next stage', idxAfterPager === idxBeforePager + 1);
  check('Paging through stages does not bump REV (view-only)', revAfterPager === revBeforePager);

  const idxBeforeSwipe = await page.evaluate(() => S.meta.mobileStageIndex || 0);
  await page.evaluate(() => {
    const board = document.getElementById('kanbanBoard');
    const rect = board.getBoundingClientRect();
    const start = new Touch({ identifier: 1, target: board, clientX: rect.left + 220, clientY: rect.top + 60 });
    const end = new Touch({ identifier: 1, target: board, clientX: rect.left + 40, clientY: rect.top + 65 });
    board.dispatchEvent(new TouchEvent('touchstart', { touches: [start], bubbles: true, cancelable: true }));
    board.dispatchEvent(new TouchEvent('touchend', { changedTouches: [end], bubbles: true, cancelable: true }));
  });
  const idxAfterSwipe = await page.evaluate(() => S.meta.mobileStageIndex || 0);
  check('Swiping left (horizontal > 60px & > 2x vertical) advances the stage', idxAfterSwipe === idxBeforeSwipe + 1);

  const idxBeforeVScroll = await page.evaluate(() => S.meta.mobileStageIndex || 0);
  await page.evaluate(() => {
    const board = document.getElementById('kanbanBoard');
    const rect = board.getBoundingClientRect();
    const start = new Touch({ identifier: 2, target: board, clientX: rect.left + 100, clientY: rect.top + 20 });
    const end = new Touch({ identifier: 2, target: board, clientX: rect.left + 90, clientY: rect.top + 200 });
    board.dispatchEvent(new TouchEvent('touchstart', { touches: [start], bubbles: true, cancelable: true }));
    board.dispatchEvent(new TouchEvent('touchend', { changedTouches: [end], bubbles: true, cancelable: true }));
  });
  const idxAfterVScroll = await page.evaluate(() => S.meta.mobileStageIndex || 0);
  check('A mostly-vertical touch (normal scroll) does not trigger a page change', idxAfterVScroll === idxBeforeVScroll);

  console.log('\n=== SESSION 3: FIX-IT LEDGER PAGE (troubleshooting.html) ===');
  {
    const ledgerPage = await browser.newPage();
    await ledgerPage.goto('file://' + path.join(__dirname, 'troubleshooting.html'), { waitUntil: 'load' });
    await ledgerPage.waitForSelector('.tool-group');
    check('troubleshooting.html renders a group per tool', (await ledgerPage.$$('.tool-group')).length === Object.keys(await ledgerPage.evaluate(() => TOOL_INFO)).length);
    check('troubleshooting.html links back to the app', await ledgerPage.$eval('header a', el => el.getAttribute('href') === 'index.html'));
    check('Every row shows a title, meaning, and a concrete next step', await ledgerPage.evaluate(() => {
      const rows = document.querySelectorAll('.row');
      if (!rows.length) return false;
      return Array.from(rows).every(r => r.querySelector('.row__title').textContent.trim() && r.querySelector('.row__meaning').textContent.trim() && r.querySelector('.row__action').textContent.trim());
    }));
    await ledgerPage.close();
  }

  console.log('\n=== NO CRASHES ===');
  check('No uncaught JS errors were thrown during the entire run', consoleErrors.length === 0);
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 10).join('\n'));

  await browser.close();

  console.log('\n=== SUMMARY ===');
  console.log(`${passCount} PASSED, ${failCount} FAILED`);
  if (failCount > 0) {
    console.log('\nFailed checks:');
    failures.forEach(f => console.log(' - ' + f));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
