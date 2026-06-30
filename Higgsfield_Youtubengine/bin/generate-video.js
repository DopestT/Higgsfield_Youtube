#!/usr/bin/env node
'use strict';

/**
 * npm run generate-video [-- <output-dir>]
 *
 * Full production pipeline for a completed package:
 *   1. Reads metadata.json (scenes, title, slug)
 *   2. Generates 6 key frames via soul_cinematic + Soul ID
 *   3. Animates each with kling2_6 + --start-image
 *   4. Downloads all clips
 *   5. Stitches into final-cut.mp4 via ffmpeg
 *
 * Config lives in inputs/character.json:
 *   { "soulId": "...", "model": "kling2_6", "duration": 5 }
 */

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT      = path.join(__dirname, '..');
const INPUTS    = path.join(ROOT, 'inputs');
const OUTPUTS   = path.join(ROOT, 'outputs');
const CHAR_CFG  = path.join(INPUTS, 'character.json');
const HF        = process.env.HF_BIN || `${process.env.HOME}/.npm-global/bin/higgsfield`;

function loadConfig() {
  if (!fs.existsSync(CHAR_CFG)) {
    console.error(`❌  No character config found at ${CHAR_CFG}`);
    console.error(`    Create it with: { "soulId": "YOUR_SOUL_ID", "model": "kling2_6", "duration": 5 }`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CHAR_CFG, 'utf8'));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hf(...args) {
  const flat = args.flat().filter(Boolean);
  const res = spawnSync(HF, flat, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`higgsfield ${flat[0]} failed:\n${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

function hfJSON(...args) {
  return JSON.parse(hf(...args, '--json'));
}

function download(url, dest) {
  execSync(`curl -sL "${url}" -o "${dest}"`);
}

function pickOutputDir(arg) {
  if (arg) {
    const abs = path.isAbsolute(arg) ? arg : path.join(OUTPUTS, arg);
    if (!fs.existsSync(abs)) { console.error(`❌  Not found: ${abs}`); process.exit(1); }
    return abs;
  }
  // Latest by mtime
  const dirs = fs.readdirSync(OUTPUTS)
    .map(d => path.join(OUTPUTS, d))
    .filter(d => fs.statSync(d).isDirectory() && fs.existsSync(path.join(d, 'metadata.json')));
  if (!dirs.length) { console.error('❌  No output packages found.'); process.exit(1); }
  return dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

// ---------------------------------------------------------------------------
// Scene → character prompt
// ---------------------------------------------------------------------------
const BEAT_ACTION = {
  HOOK:        'looking directly into camera with intense focused expression',
  SETUP:       'at desk studying glowing screens with code and AI data, leaning forward',
  ESCALATION:  'leaning toward camera pointing at screen with urgency',
  TURN:        'expression shifts to impressed surprise, reacting to a revelation',
  PAYOFF:      'gesturing with both hands explaining, energetic and authoritative',
  BUTTON:      'leaning back arms crossed with a knowing smirk, owning the frame',
};

const BEAT_CAM = {
  HOOK:        'slow push-in, low-angle hero shot',
  SETUP:       'smooth orbit, dramatic side light',
  ESCALATION:  'handheld micro-shake, cool blue backlight',
  TURN:        'rapid push then settle, bright screen flash',
  PAYOFF:      'crane up reveal, neon teal and magenta light',
  BUTTON:      'whip-pan out, single hard spotlight deep shadows',
};

function sceneToImagePrompt(scene, charDesc) {
  const action = BEAT_ACTION[scene.beat] || 'focused and present';
  return `${charDesc}, ${action}, ${scene.lighting}, cinematic, high-contrast, shallow depth of field, filmic color grade, vertical 9:16`;
}

function sceneToVideoPrompt(scene, charDesc) {
  const action = BEAT_ACTION[scene.beat] || 'focused and present';
  const cam    = BEAT_CAM[scene.beat] || 'slow dolly-in';
  return `${charDesc}, ${action}, ${cam}, ${scene.lighting}, cinematic, high-contrast, filmic color grade`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const cfg    = loadConfig();
  const outDir = pickOutputDir(process.argv[2]);
  const meta   = JSON.parse(fs.readFileSync(path.join(outDir, 'metadata.json'), 'utf8'));

  const soulId    = cfg.soulId;
  const vidModel  = cfg.model    || 'kling2_6';
  const duration  = cfg.duration || 5;
  const charDesc  = cfg.characterDescription || 'underground tech analyst in black hoodie';

  console.log(`\n🎬  Generating video for: ${meta.primary_title}`);
  console.log(`    Package : ${outDir}`);
  console.log(`    Soul ID : ${soulId}`);
  console.log(`    Model   : ${vidModel}  (${duration}s/clip)\n`);

  const kfDir  = path.join(outDir, 'keyframes');
  const vidDir = path.join(outDir, 'videos');
  fs.mkdirSync(kfDir,  { recursive: true });
  fs.mkdirSync(vidDir, { recursive: true });

  const scenes = meta.scenes;

  // Step 1 — Generate key frames
  console.log('── Step 1: Key frames (soul_cinematic) ──');
  const kfPaths = [];
  for (const scene of scenes) {
    const kfPath = path.join(kfDir, `scene${scene.n}-${scene.beat.toLowerCase()}.png`);
    if (fs.existsSync(kfPath)) {
      console.log(`  ✓ Scene ${scene.n} ${scene.beat} (cached)`);
      kfPaths.push(kfPath);
      continue;
    }
    const prompt = sceneToImagePrompt(scene, charDesc);
    process.stdout.write(`  ⏳ Scene ${scene.n} ${scene.beat} …`);
    const result = hfJSON('generate', 'create', 'soul_cinematic',
      '--prompt', prompt,
      '--custom_reference_id', soulId,
      '--aspect_ratio', '9:16',
      '--wait', '--wait-timeout', '10m'
    );
    const url = result[0].result_url;
    download(url, kfPath);
    console.log(` ✓  ${path.basename(kfPath)}`);
    kfPaths.push(kfPath);
  }

  // Step 2 — Submit animation jobs
  console.log('\n── Step 2: Submit animation jobs ──');
  const jobIds = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene  = scenes[i];
    const kfPath = kfPaths[i];
    const prompt = sceneToVideoPrompt(scene, charDesc);
    process.stdout.write(`  ⏳ Scene ${scene.n} ${scene.beat} …`);
    const raw  = hf('generate', 'create', vidModel,
      '--prompt', prompt,
      '--start-image', kfPath,
      '--duration', String(duration),
      '--json'
    );
    const jid = JSON.parse(raw)[0];
    jobIds.push({ jid, scene });
    console.log(` queued ${jid.slice(0, 8)}…`);
  }

  // Step 3 — Wait & download
  console.log('\n── Step 3: Wait & download clips ──');
  const clipPaths = [];
  for (const { jid, scene } of jobIds) {
    const clipPath = path.join(vidDir, `scene${scene.n}-${scene.beat.toLowerCase()}.mp4`);
    if (fs.existsSync(clipPath)) {
      console.log(`  ✓ Scene ${scene.n} (cached)`);
      clipPaths.push(clipPath);
      continue;
    }
    process.stdout.write(`  ⏳ Scene ${scene.n} ${scene.beat} …`);
    const result = hfJSON('generate', 'wait', jid, '--timeout', '15m');
    const url    = result.result_url;
    download(url, clipPath);
    console.log(` ✓  ${path.basename(clipPath)}`);
    clipPaths.push(clipPath);
  }

  // Step 4 — Stitch
  console.log('\n── Step 4: Stitch final cut ──');
  const concatFile = path.join(outDir, '.concat.txt');
  fs.writeFileSync(concatFile, clipPaths.map(p => `file '${p}'`).join('\n'));
  const finalCut = path.join(outDir, 'final-cut.mp4');
  execSync(`ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy "${finalCut}" -y 2>/dev/null`);
  fs.unlinkSync(concatFile);

  const size = (fs.statSync(finalCut).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅  Done!`);
  console.log(`   final-cut.mp4 — ${size}MB`);
  console.log(`   ${finalCut}\n`);
}

main().catch(err => { console.error('❌ ', err.message); process.exit(1); });
