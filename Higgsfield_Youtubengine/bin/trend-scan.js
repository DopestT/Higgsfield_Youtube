#!/usr/bin/env node
/**
 * Higgsfield_Youtubengine — trend-scan
 *
 * Usage:  npm run trend-scan
 *
 * Reads inputs/rss-sources.json (override with HF_RSS_SOURCES=path), fetches enabled
 * feeds, parses + normalizes + scores recent items, and writes:
 *   trends/YYYY-MM-DD-trend-scan.json   (full scored data)
 *   trends/YYYY-MM-DD-trend-brief.md    (human brief, grouped by category)
 *
 * Network note: needs outbound HTTPS to the feed hosts. Restricted sandboxes may
 * block general news domains — failed sources are reported, not fatal.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const trends = require('../lib/trends');

const ROOT = path.resolve(__dirname, '..');
const ITEMS_PER_FEED = 12;
const FETCH_TIMEOUT_MS = 15000;

async function fetchFeed(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'Higgsfield_Youtubengine trend-scan/1.0', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const sourcesPath = process.env.HF_RSS_SOURCES || path.join(ROOT, 'inputs', 'rss-sources.json');
  if (!fs.existsSync(sourcesPath)) {
    console.error(`Sources file not found: ${sourcesPath}`);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  const enabled = (cfg.sources || []).filter((s) => s.enabled);
  console.log(`Scanning ${enabled.length} enabled source(s) from ${path.relative(process.cwd(), sourcesPath)}…\n`);

  const all = [];
  const status = [];
  await Promise.all(
    enabled.map(async (src) => {
      try {
        const xml = await fetchFeed(src.feed_url);
        const items = trends.parseFeed(xml, src).slice(0, ITEMS_PER_FEED);
        all.push(...items);
        status.push({ name: src.name, category: src.category, ok: true, items: items.length });
        console.log(`  ✓ ${src.name} — ${items.length} items`);
      } catch (err) {
        status.push({ name: src.name, category: src.category, ok: false, error: err.message });
        console.log(`  ✗ ${src.name} — ${err.message}`);
      }
    })
  );

  trends.scoreItems(all);

  const date = new Date().toISOString().slice(0, 10);
  const trendsDir = path.join(ROOT, 'trends');
  fs.mkdirSync(trendsDir, { recursive: true });

  const scan = {
    generated_at: new Date().toISOString(),
    sources_scanned: status,
    item_count: all.length,
    items: all,
  };
  const jsonPath = path.join(trendsDir, `${date}-trend-scan.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(scan, null, 2));

  const mdPath = path.join(trendsDir, `${date}-trend-brief.md`);
  fs.writeFileSync(mdPath, renderBrief(date, status, all));

  console.log(`\n✅ ${all.length} items scored across ${status.filter((s) => s.ok).length}/${status.length} live sources.`);
  console.log(`   ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`   ${path.relative(process.cwd(), mdPath)}`);
  if (all.length) {
    const top = all[0];
    console.log(`\n   Top trend (${top.trend_score}): ${top.title}`);
    console.log(`   → npm run trend-video   (or: npm run trend-video -- "${top.category}")`);
  } else {
    console.log('\n   No items fetched — check network access to the feed hosts, then re-run.');
  }
}

function renderBrief(date, status, items) {
  const byCat = {};
  for (const it of items) (byCat[it.category] = byCat[it.category] || []).push(it);

  let md = `# Trend Brief — ${date}\n\n`;
  md += `Sources: ${status.filter((s) => s.ok).length} live / ${status.length} configured · ${items.length} items scored.\n\n`;
  md += `> Items are trend **signals**, not source material. Don't copy article text. For political, legal, medical, financial, or breaking topics, treat the risk note as mandatory human review before posting.\n\n`;

  const usable = items.filter((i) => i.usable_for_video).slice(0, 10);
  md += `## 🔥 Top usable trends\n\n`;
  if (!usable.length) md += `_None scored above threshold this scan._\n\n`;
  usable.forEach((it, i) => {
    md += `${i + 1}. **[${it.trend_score}] ${it.title}** — ${it.source} (${it.category})${it.needs_human_review ? ' · ⚠️ review' : ''}\n`;
  });
  md += `\n`;

  for (const cat of Object.keys(byCat)) {
    md += `## ${cat}\n\n`;
    byCat[cat].slice(0, 8).forEach((it) => {
      md += `- **[${it.trend_score}] ${it.title}**\n`;
      md += `  - Source: ${it.source}${it.published ? ` · ${it.published}` : ''}${it.link ? ` · ${it.link}` : ''}\n`;
      if (it.summary) md += `  - Snippet: ${it.summary}\n`;
      md += `  - Angle: ${it.suggested_angle}\n`;
      md += `  - Hook: ${it.suggested_hook}\n`;
      md += `  - Visual: ${it.visual_metaphor}\n`;
      if (it.risk_notes) md += `  - ⚠️ ${it.risk_notes}\n`;
      md += `\n`;
    });
  }
  return md;
}

main();
