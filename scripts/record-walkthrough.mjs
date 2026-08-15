#!/usr/bin/env node
/* ============================================================
   NTM DEAL CENTER — Film Room recording factory
   Records a short, narrated screen-capture walkthrough of each panel
   in scripts/walkthrough-scripts.js, using an animated cursor, real
   per-frame wall-clock timestamps (so ffmpeg encodes idle gaps as
   correctly-long frames instead of the recorder silently dropping or
   time-warping them), and AC's own voice for narration.

   Requirements to actually produce video files (this script degrades
   gracefully and tells you exactly what's missing otherwise):
     - ffmpeg on PATH (frame-sequence -> mp4 encoding, and audio muxing)
     - ELEVENLABS_API_KEY, either in this shell's env or reachable via
       a deployed site's /api/tts (set SITE_URL to that deployment) —
       without it, walkthroughs record silently (no narration track)
     - SITE_PASSCODE set the same way as the deployed site, if you're
       recording against a live deployment rather than a local file

   Usage:
     node scripts/record-walkthrough.mjs                  # all panels
     node scripts/record-walkthrough.mjs pipeline city-radar   # just these slugs
     SITE_URL=https://your-deploy.vercel.app node scripts/record-walkthrough.mjs

   Gotchas this script exists to avoid (learned the hard way):
     - The demo passcode gate blocks every clickable action in a fresh
       browser profile — this script unlocks User Mode via localStorage
       BEFORE touching anything, exactly once, up front.
     - A screen recorder that only captures on DOM change will silently
       compress "AC is talking but nothing on screen is moving" into
       nothing — this script keeps one tiny pulsing dot animating in a
       corner for the entire recording so frames never stop arriving,
       and it timestamps every frame with real Date.now() at receipt
       rather than trusting a monotonic/assumed frame rate.
   ============================================================ */

import puppeteer from 'puppeteer';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WALKTHROUGHS } from './walkthrough-scripts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'film-room');
const SITE_URL = process.env.SITE_URL || ('file://' + path.join(ROOT, 'index.html'));
const HAS_REMOTE = SITE_URL.startsWith('http');

function checkFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version']);
  return !r.error;
}

async function synthesizeNarration(text, outFile) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  if (!apiKey) return false;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outFile, buf);
    return true;
  } catch (e) {
    return false;
  }
}

// Moves a fake cursor element smoothly to `selector`'s center, then clicks
// it for real — so the recording shows deliberate motion, not a teleport.
async function animatedClick(page, selector) {
  const el = await page.$(selector);
  if (!el) return false;
  const box = await el.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate((x, y) => {
    let cursor = document.getElementById('__filmroomCursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = '__filmroomCursor';
      cursor.style.cssText = 'position:fixed;width:18px;height:18px;border-radius:50%;background:rgba(255,107,44,0.85);border:2px solid #fff;z-index:999999;pointer-events:none;transition:left 0.5s ease,top 0.5s ease;';
      document.body.appendChild(cursor);
    }
    cursor.style.left = (x - 9) + 'px';
    cursor.style.top = (y - 9) + 'px';
  }, x, y);
  await new Promise(r => setTimeout(r, 550)); // let the transition play before clicking
  await el.click().catch(() => {});
  return true;
}

async function injectAlwaysAnimatingOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById('__filmroomPulse')) return;
    const dot = document.createElement('div');
    dot.id = '__filmroomPulse';
    dot.style.cssText = 'position:fixed;top:6px;left:6px;width:6px;height:6px;border-radius:50%;background:#FF6B2C;z-index:999999;animation:__filmroomPulse 1s infinite;';
    const style = document.createElement('style');
    style.textContent = '@keyframes __filmroomPulse{0%,100%{opacity:1}50%{opacity:0.2}}';
    document.head.appendChild(style);
    document.body.appendChild(dot);
  });
}

// Captures raw PNG frames via CDP screencast, each tagged with the real
// wall-clock ms elapsed since capture started (NOT an assumed frame rate) —
// this is what lets the encoder give idle gaps their true duration instead
// of compressing or dropping them.
async function captureFrames(page, durationMs, frameDir) {
  fs.mkdirSync(frameDir, { recursive: true });
  const client = await page.target().createCDPSession();
  const frames = [];
  const t0 = Date.now();
  let frameIndex = 0;

  client.on('Page.screencastFrame', async (frame) => {
    const tRelative = Date.now() - t0;
    const file = path.join(frameDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(frame.data, 'base64'));
    frames.push({ file, tRelative });
    frameIndex++;
    client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });

  await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await new Promise(r => setTimeout(r, durationMs));
  await client.send('Page.stopScreencast');
  await client.detach().catch(() => {});
  return frames;
}

// ffmpeg's concat demuxer takes an explicit duration per input frame, so
// gaps of real silence/idle time encode as correctly-long stretches of
// that frame rather than the encoder guessing a constant fps.
function writeConcatManifest(frames, manifestPath, tailPadMs) {
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const next = frames[i + 1];
    const durationMs = next ? Math.max(16, next.tRelative - frames[i].tRelative) : (tailPadMs || 800);
    lines.push(`file '${frames[i].file.replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${(durationMs / 1000).toFixed(3)}`);
  }
  if (frames.length) lines.push(`file '${frames[frames.length - 1].file.replace(/'/g, "'\\''")}'`);
  fs.writeFileSync(manifestPath, lines.join('\n'));
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code))));
  });
}

async function encodePanel(frames, narrationFile, outFile, tmpDir) {
  const concatManifest = path.join(tmpDir, 'frames.txt');
  writeConcatManifest(frames, concatManifest);
  const silentVideo = path.join(tmpDir, 'video.mp4');
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatManifest, '-vsync', 'vfr', '-pix_fmt', 'yuv420p', silentVideo]);
  if (narrationFile && fs.existsSync(narrationFile)) {
    await runFfmpeg(['-y', '-i', silentVideo, '-i', narrationFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', outFile]);
  } else {
    fs.copyFileSync(silentVideo, outFile);
  }
}

async function recordPanel(page, entry, requestedSheetTab) {
  console.log(`\n--- Recording ${entry.dwg} — ${entry.title} ---`);
  await requestedSheetTab(entry.dwg);
  await new Promise(r => setTimeout(r, 400));
  await injectAlwaysAnimatingOverlay(page);

  const tmpDir = path.join(OUT_DIR, '.tmp-' + entry.slug);
  const frameDir = path.join(tmpDir, 'frames');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const narrationText = entry.steps.map(s => s.narration).filter(Boolean).join(' ');
  const narrationFile = path.join(tmpDir, 'narration.mp3');
  fs.mkdirSync(tmpDir, { recursive: true });
  const gotNarration = narrationText ? await synthesizeNarration(narrationText, narrationFile) : false;
  if (narrationText && !gotNarration) console.log('  (no ELEVENLABS_API_KEY / narration failed — recording silent)');

  const totalWaitMs = entry.steps.reduce((sum, s) => sum + (s.wait || 1500), 0) + 500;

  const capturePromise = captureFrames(page, totalWaitMs, frameDir);
  for (const step of entry.steps) {
    if (step.click) await animatedClick(page, step.click);
    await new Promise(r => setTimeout(r, step.wait || 1500));
  }
  const frames = await capturePromise;

  if (!frames.length) {
    console.log('  No frames captured — skipping encode.');
    return null;
  }

  const outFile = path.join(OUT_DIR, `${entry.slug}.mp4`);
  const hasFfmpeg = checkFfmpeg();
  if (!hasFfmpeg) {
    console.log(`  ffmpeg not found — captured ${frames.length} raw frames to ${frameDir}, but can't encode them into a video. Install ffmpeg and re-run to finish this one.`);
    return null;
  }
  await encodePanel(frames, gotNarration ? narrationFile : null, outFile, tmpDir);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`  Wrote ${outFile}`);
  return { slug: entry.slug, title: entry.title, dwg: entry.dwg, file: `film-room/${entry.slug}.mp4`, createdAt: new Date().toISOString(), narrated: gotNarration };
}

async function main() {
  const requestedSlugs = process.argv.slice(2);
  const entries = requestedSlugs.length ? WALKTHROUGHS.filter(w => requestedSlugs.includes(w.slug)) : WALKTHROUGHS;
  if (!entries.length) {
    console.log('No matching walkthroughs. Known slugs:', WALKTHROUGHS.map(w => w.slug).join(', '));
    process.exit(1);
  }

  if (!checkFfmpeg()) {
    console.log('ffmpeg is not installed or not on PATH — frames will still be captured for the first panel as a sanity check, but nothing will be encoded to video. Install ffmpeg (e.g. `brew install ffmpeg` or `apt install ffmpeg`) and re-run.');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(SITE_URL, { waitUntil: 'load' });
  // Unlock User Mode BEFORE anything else — the demo gate blocks every
  // clickable action otherwise, and a locked recording is a useless one.
  await page.evaluate(() => localStorage.setItem('ntmSiteMode', 'user'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#panelRoot');
  await page.evaluate(() => { if (typeof updateModeButtons === 'function') updateModeButtons(); });

  const gotoDwg = async (dwg) => {
    const [sheet, tab] = dwg.replace('DWG ', '').split('-');
    await page.click(`[data-action="setSheet"][data-sheet="${sheet}"]`);
    await new Promise(r => setTimeout(r, 150));
    await page.click(`[data-action="setSubtabA"][data-subtab="${tab}"], [data-action="setSubtabB"][data-subtab="${tab}"], [data-action="setSubtabC"][data-subtab="${tab}"]`).catch(() => {});
  };

  const manifest = [];
  for (const entry of entries) {
    const result = await recordPanel(page, entry, gotoDwg).catch((e) => { console.log('  FAILED:', e.message); return null; });
    if (result) manifest.push(result);
  }

  await browser.close();

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const bySlug = Object.fromEntries(existing.map(e => [e.slug, e]));
  manifest.forEach(e => { bySlug[e.slug] = e; });
  fs.writeFileSync(manifestPath, JSON.stringify(Object.values(bySlug), null, 2));

  // The full panel list (recorded or not) — film-room.html reads this to
  // show every panel with a WATCH state, not just the ones already done.
  const panelsPath = path.join(OUT_DIR, 'panels.json');
  fs.writeFileSync(panelsPath, JSON.stringify(WALKTHROUGHS.map(w => ({ slug: w.slug, title: w.title, dwg: w.dwg })), null, 2));

  console.log(`\nDone. ${manifest.length} walkthrough(s) recorded. Manifest: ${manifestPath}`);
  if (!HAS_REMOTE) console.log('Recorded against the local file:// copy — set SITE_URL to record against your live deployment instead.');
}

main().catch((err) => {
  console.error('Recording run crashed:', err);
  process.exit(1);
});
