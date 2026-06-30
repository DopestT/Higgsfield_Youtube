#!/usr/bin/env node
/**
 * Higgsfield_Youtubengine — pitch-topics
 *
 * Usage:  npm run pitch-topics
 *
 * Loads the latest trend scan, ranks the top 5 usable trends, and writes:
 *   queue/YYYY-MM-DD-topic-pitches.md   (daily brief — the "producer pitch")
 *   queue/YYYY-MM-DD-topic-pitches/     (one topic-pitch.md per candidate)
 *
 * Each pitch explains why the topic deserves one of today's 2 video slots,
 * covering: why now, audience fit, hook potential, visual potential, commentary
 * angle, risk, score breakdown, and a final maker decision prompt.
 *
 * Does NOT auto-approve or auto-generate. All decisions are yours.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const trends = require('../lib/trends');
const pitch = require('../lib/pitch');

const ROOT = path.resolve(__dirname, '..');
const TOP_N = 5;

function latestScan() {
  const dir = path.join(ROOT, 'trends');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /-trend-scan\.json$/.test(f)).sort();
  if (!files.length) return null;
  return path.join(dir, files[files.length - 1]);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'untitled';
}

async function main() {
  const scanPath = latestScan();
  if (!scanPath) {
    console.error('No trend scan found. Run:  npm run trend-scan');
    process.exit(1);
  }

  const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
  const allItems = (scan.items || []);
  const usable = allItems.filter((i) => i.usable_for_video).slice(0, TOP_N);

  if (!usable.length) {
    console.error('No usable trends found in latest scan. Re-run npm run trend-scan.');
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const queueDir = path.join(ROOT, 'queue');
  const pitchDir = path.join(queueDir, `${date}-topic-pitches`);
  fs.mkdirSync(pitchDir, { recursive: true });

  // Write individual pitch files
  const pitchFiles = [];
  usable.forEach((item, i) => {
    const rank = i + 1;
    const md = pitch.buildPitchMD(item, allItems, rank);
    const fname = `rank-${rank}-${slugify(item.source)}.md`;
    const fpath = path.join(pitchDir, fname);
    fs.writeFileSync(fpath, md);
    pitchFiles.push(fname);
    console.log(`  #${rank} [${item.trend_score}] ${item.title.slice(0, 60)}${item.title.length > 60 ? '…' : ''}`);
    console.log(`      → ${path.relative(process.cwd(), fpath)}`);
  });

  // Write daily brief
  const briefPath = path.join(queueDir, `${date}-topic-pitches.md`);
  fs.writeFileSync(briefPath, pitch.buildDailyBriefMD(date, allItems, pitchFiles));

  console.log(`\n✅ Pitched ${usable.length} topics.`);
  console.log(`   Brief:   ${path.relative(process.cwd(), briefPath)}`);
  console.log(`   Detail:  ${path.relative(process.cwd(), pitchDir)}/`);
  console.log(`\n   Top pick [${usable[0].trend_score}]: ${usable[0].title}`);
  console.log(`   Recommendation: ${pitch.recommendation(usable[0], 1)}`);
  console.log(`\n   → Review the brief, then run: npm run trend-video`);
}

main();
