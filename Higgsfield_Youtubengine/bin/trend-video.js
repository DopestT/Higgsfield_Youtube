#!/usr/bin/env node
/**
 * Higgsfield_Youtubengine — trend-video
 *
 * Usage:  npm run trend-video                         (top usable trend)
 *         npm run trend-video -- "AI"                 (top trend matching keyword/category)
 *         npm run trend-video -- "creator economy"
 *         npm run trend-video -- --ai "crypto"        (use Claude for the copy)
 *
 * Loads the latest trends/*-trend-scan.json, picks a trend, and writes a full
 * production package to /outputs using the same engine as new-video — but seeded
 * by the trend (angle, hook, visual metaphor, risk notes), not a generic idea.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const pkg = require('../lib/package');
const llm = require('../lib/llm');

const ROOT = path.resolve(__dirname, '..');

function latestScan() {
  const dir = path.join(ROOT, 'trends');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /-trend-scan\.json$/.test(f)).sort();
  if (!files.length) return null;
  return path.join(dir, files[files.length - 1]);
}

function matches(item, q) {
  const query = q.toLowerCase().trim();
  // Category match (substring is fine for category, e.g. "crypto" → "Crypto / markets").
  if (item.category.toLowerCase().includes(query)) return true;
  // Title/summary match by whole word, so short queries like "AI" don't hit "available".
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i').test(`${item.title} ${item.summary}`);
}

// Deterministic, trend-specific scene seeds (used when LLM mode is off).
function trendSceneSeeds(item) {
  const cat = item.category;
  const subj = item.visual_metaphor;
  return [
    { beat: 'HOOK', subject: subj, environment: `a dark cinematic stage that frames the ${cat.toLowerCase()} story`, voiceover: item.suggested_hook },
    { beat: 'SETUP', subject: subj, environment: 'a clean explainer space with one focal object', voiceover: `Here's the actual story, fast: ${item.title}.` },
    { beat: 'ESCALATION', subject: subj, environment: 'the same world, tension rising, elements multiplying', voiceover: `And it's moving quicker than people realize.` },
    { beat: 'TURN', subject: subj, environment: 'a sharp reveal moment, one element ignites', voiceover: `But here's the part that actually matters.` },
    { beat: 'PAYOFF', subject: subj, environment: 'the metaphor resolves into a single clear image', voiceover: `That's the takeaway — the thing to remember.` },
    { beat: 'BUTTON', subject: subj, environment: 'a clean end frame with room for a text stamp', voiceover: `Follow for the trends that actually matter — explained fast.` },
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const ai = args.includes('--ai');
  const query = args.filter((a) => a !== '--ai').join(' ').trim();

  const scanPath = latestScan();
  if (!scanPath) {
    console.error('No trend scan found. Run:  npm run trend-scan');
    process.exit(1);
  }
  const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
  let pool = (scan.items || []).filter((i) => i.usable_for_video);
  if (query) pool = pool.filter((i) => matches(i, query));
  if (!pool.length) {
    console.error(
      query
        ? `No usable trend matched "${query}" in ${path.basename(scanPath)}.`
        : `No usable trends in ${path.basename(scanPath)}. Re-run npm run trend-scan.`
    );
    process.exit(1);
  }
  pool.sort((a, b) => b.trend_score - a.trend_score);
  const item = pool[0];
  console.log(`Selected trend [${item.trend_score}]: ${item.title}`);
  console.log(`  source: ${item.source} (${item.category})${item.needs_human_review ? ' · ⚠️ needs human review' : ''}`);

  let copy = null;
  if (llm.aiEnabled({ ai })) {
    process.stdout.write('Generating trend-aware copy with Claude…\n');
    const context = `Headline: ${item.title}\nCategory: ${item.category}\nSnippet: ${item.summary || '(none)'}`;
    copy = await llm.generateCopy(item.suggested_angle, { ai, context });
  }

  const idea = (copy && copy.logline) ? copy.logline : item.suggested_angle;
  const ctx = pkg.buildGenericContext(idea, {
    slug: `trend-${item.title}`,
    title: item.title,
    topicLabel: copy ? copy.topicLabel : item.category,
    logline: copy ? copy.logline : item.suggested_angle,
    altHooks: copy ? copy.altHooks : [item.suggested_hook],
    titles: copy ? copy.titles : [
      `${item.title} — what actually matters`,
      `The real story behind "${item.title.slice(0, 40)}"`,
      `${item.category}: the 30-second version`,
      `Why everyone's about to talk about this`,
      `${item.title.slice(0, 50)} — explained fast`,
    ],
    description: copy ? copy.description :
      `A fast, original explainer on a trending ${item.category.toLowerCase()} story: ${item.title}. ` +
      `Commentary and context, not a news report. Follow for the trends that actually matter.`,
    hashtags: copy ? copy.hashtags :
      ['#shorts', '#trending', `#${item.category.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`, '#explained', '#fyp'],
    sceneSeeds: copy ? copy.sceneSeeds : trendSceneSeeds(item),
    source: { name: item.source, category: item.category, link: item.link },
    riskNotes: item.risk_notes,
    needsReview: item.needs_human_review,
    trendScore: item.trend_score,
    generatedBy: 'Higgsfield_Youtubengine/trend-video',
  });

  const { outDir, files } = pkg.writePackage(path.join(ROOT, 'outputs'), ctx);
  console.log(`\n✅ Trend production package created${copy ? ' (AI copy)' : ''}:`);
  console.log(`   ${path.relative(process.cwd(), outDir)}\n`);
  console.log('   ' + files.join('\n   '));
  if (item.needs_human_review) {
    console.log('\n⚠️  This trend is flagged for HUMAN REVIEW before posting (see concept.md / metadata.json).');
  }
  console.log('\nNext: review concept.md, then paste the Higgsfield prompts into Higgsfield.\n');
}

main();
