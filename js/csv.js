/* ============================================================
   NTM DEAL CENTER — loose CSV parsing for Data Intake
   ============================================================ */

// Handles quoted fields (with embedded commas/newlines) and both \n and \r\n.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // skip — \n (or end) handles the row break
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim().length));
}

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Loose column matching: finds the first header that matches any of the
// candidate names (normalized), so "Full Name", "name", "Contact Name" all work.
function findColumn(headers, candidates) {
  const normHeaders = headers.map(normalizeHeader);
  for (const cand of candidates) {
    const idx = normHeaders.indexOf(normalizeHeader(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Parses CSV text into row objects keyed by a column map, skipping and
// counting rows that fail the required check (loose — usually just "name").
function parseCsvRows(text, columnMap, requiredKey) {
  const rows = parseCSV(text);
  if (!rows.length) return { records: [], skipped: 0, total: 0 };
  const headers = rows[0];
  const colIndex = {};
  Object.keys(columnMap).forEach(key => { colIndex[key] = findColumn(headers, columnMap[key]); });

  const records = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rec = {};
    Object.keys(colIndex).forEach(key => {
      const idx = colIndex[key];
      rec[key] = idx !== -1 && r[idx] !== undefined ? r[idx].trim() : '';
    });
    if (requiredKey && !rec[requiredKey]) { skipped++; continue; }
    records.push(rec);
  }
  return { records, skipped, total: rows.length - 1 };
}
