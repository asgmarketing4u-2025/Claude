/* ============================================================
   NTM DEAL CENTER — deal analyzer math
   ============================================================ */

// --- assumptions (kept in one place so they're easy to see/tune) ---
const ASSUME_CLOSING_COST_PCT = 0.03;
const ASSUME_SELLING_COST_PCT = 0.08;
const ASSUME_VACANCY_PCT = 0.05;
const ASSUME_MAINTENANCE_PCT = 0.05;
const ASSUME_MANAGEMENT_PCT = 0.08;
const FLIP_HOLD_MONTHS = 6;

function loanAmount(p) {
  const down = (p.price || 0) * (p.downPct || 0) / 100;
  return Math.max(0, (p.price || 0) - down);
}

// The critical rule: hard-money loans of 3 years or less are interest-only.
// Amortizing them would make every short-term flip loan look like it's paying
// down principal it never pays down — and wrongly tank the flip profit number.
function isInterestOnly(p) {
  return p.loanType === 'hard' && (p.loanTermYears || 0) <= 3;
}

function monthlyPI(p) {
  const principal = loanAmount(p);
  if (!principal) return 0;
  const rate = (p.loanRate || 0) / 100 / 12;
  if (isInterestOnly(p)) return principal * rate;
  const n = (p.loanTermYears || 30) * 12;
  if (rate === 0) return principal / n;
  return principal * rate / (1 - Math.pow(1 + rate, -n));
}

function mao(p) {
  return (p.arv || 0) * 0.70 - (p.repairs || 0);
}

function equityAtARV(p) {
  return (p.arv || 0) - (p.price || 0) - (p.repairs || 0);
}

// Used as the quick "potential profit" figure on kanban column headers.
function potentialProfit(p) {
  return equityAtARV(p);
}

function annualNOI(p) {
  const grossAnnualRent = (p.rent || 0) * 12;
  const vacancy = grossAnnualRent * ASSUME_VACANCY_PCT;
  const maintenance = grossAnnualRent * ASSUME_MAINTENANCE_PCT;
  const management = grossAnnualRent * ASSUME_MANAGEMENT_PCT;
  const opex = (p.taxes || 0) + (p.insurance || 0) + vacancy + maintenance + management;
  return grossAnnualRent - opex;
}

function capRate(p) {
  if (!p.price) return 0;
  return annualNOI(p) / p.price * 100;
}

function annualDebtService(p) {
  return monthlyPI(p) * 12;
}

function dscr(p) {
  const ds = annualDebtService(p);
  if (!ds) return 0;
  return annualNOI(p) / ds;
}

function cashInvested(p) {
  const down = (p.price || 0) * (p.downPct || 0) / 100;
  const closing = (p.price || 0) * ASSUME_CLOSING_COST_PCT;
  return down + closing + (p.repairs || 0);
}

function annualCashFlow(p) {
  return annualNOI(p) - annualDebtService(p);
}

function cashOnCash(p) {
  const invested = cashInvested(p);
  if (!invested) return 0;
  return annualCashFlow(p) / invested * 100;
}

function flipProfit(p) {
  const sellingCosts = (p.arv || 0) * ASSUME_SELLING_COST_PCT;
  const holdingInterest = monthlyPI(p) * FLIP_HOLD_MONTHS;
  const points = loanAmount(p) * (p.loanPoints || 0) / 100;
  return (p.arv || 0) - sellingCosts - (p.price || 0) - (p.repairs || 0) - holdingInterest - points;
}

function brrrrNumbers(p) {
  const refiAmount = (p.arv || 0) * 0.75;
  const originalLoan = loanAmount(p);
  const cashPulledOut = Math.max(0, refiAmount - originalLoan);
  const totalCashIn = cashInvested(p);
  const cashLeftIn = Math.max(0, totalCashIn - cashPulledOut);
  return { refiAmount, cashPulledOut, cashLeftIn, totalCashIn };
}

// Verdict thresholds are strategy-specific — a flip lives or dies on flip
// profit, a wholesale deal on MAO spread, a hold/BRRRR on debt coverage + CoC.
function dealVerdict(p) {
  if (p.strategy === 'wholesale') {
    const spread = mao(p) - (p.price || 0);
    if (spread >= 15000) return 'APPROVED';
    if (spread >= 5000) return 'REDLINE';
    return 'REJECTED';
  }
  if (p.strategy === 'flip') {
    const fp = flipProfit(p);
    if (fp >= 25000) return 'APPROVED';
    if (fp >= 10000) return 'REDLINE';
    return 'REJECTED';
  }
  // hold + brrrr
  const d = dscr(p), coc = cashOnCash(p);
  if (d >= 1.25 && coc >= 8) return 'APPROVED';
  if (d >= 1.0 && coc >= 4) return 'REDLINE';
  return 'REJECTED';
}

function capitalStackSegments(p) {
  const purchase = p.price || 0;
  const closing = purchase * ASSUME_CLOSING_COST_PCT;
  const rehab = p.repairs || 0;
  const selling = (p.arv || 0) * ASSUME_SELLING_COST_PCT;
  const total = purchase + closing + rehab + selling;
  const arv = p.arv || 0;
  const profit = Math.max(0, arv - total);
  return { purchase, closing, rehab, selling, total, arv, profit };
}
