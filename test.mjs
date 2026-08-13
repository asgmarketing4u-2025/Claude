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
    if (/Failed to load resource|net::ERR_/.test(text)) return;
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
  check('Sheet B shows a coming-next placeholder', await page.$eval('.panel--soon .panel__title', el => el.textContent.includes('REALTOR')));
  await page.click('[data-action="setSheet"][data-sheet="C"]');
  check('Sheet C shows a coming-next placeholder', await page.$eval('.panel--soon .panel__title', el => el.textContent.includes('OPERATIONS')));
  await page.click('[data-action="setSheet"][data-sheet="A"]');
  check('Sheet A returns to the Pipeline board', await page.$('.kanban-board') !== null);
  await page.click('[data-action="setSubtabA"][data-subtab="07"]');
  check('Investor subtab 07 (unbuilt) shows coming-next placeholder', await page.$('.panel--soon') !== null);
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

  console.log('\n=== BLANK BOARD + EMPTY STATES (fresh context) ===');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.welcome-strip');
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
