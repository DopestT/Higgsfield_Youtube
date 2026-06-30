#!/usr/bin/env node
/**
 * Higgsfield_Youtubengine — new-video
 *
 * Usage:  npm run new-video "VIDEO IDEA HERE"
 *         npm run new-video -- --ai "VIDEO IDEA HERE"   (use Claude for the copy)
 *
 * Turns one idea into a complete YouTube Shorts production package under /outputs.
 * Deterministic by default; uses Claude only when --ai/HF_AI=1 and ANTHROPIC_API_KEY are set.
 */

'use strict';

const path = require('path');
const pkg = require('../lib/package');
const llm = require('../lib/llm');

async function main() {
  const args = process.argv.slice(2);
  const ai = args.includes('--ai');
  const idea = args.filter((a) => a !== '--ai').join(' ').trim();
  if (!idea) {
    console.error('Usage: npm run new-video "VIDEO IDEA HERE"');
    process.exit(1);
  }

  const outputsDir = path.resolve(__dirname, '..', 'outputs');
  let copy = null;
  if (llm.aiEnabled({ ai })) {
    process.stdout.write('Generating copy with Claude…\n');
    copy = await llm.generateCopy(idea, { ai });
  }

  const ctx = pkg.buildGenericContext(idea, copy || {});
  const { outDir, files } = pkg.writePackage(outputsDir, ctx);

  console.log(`\n✅ Production package created${copy ? ' (AI copy)' : ''}:`);
  console.log(`   ${path.relative(process.cwd(), outDir)}\n`);
  console.log('   ' + files.join('\n   '));
  console.log('\nNext: open concept.md, then paste the Higgsfield prompts into Higgsfield.\n');
}

main();
