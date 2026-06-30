#!/usr/bin/env node
/**
 * Higgsfield_Youtubengine — new-video generator
 *
 * Usage:  npm run new-video "VIDEO IDEA HERE"
 *
 * Takes one video idea and writes a complete YouTube Shorts production package
 * into /outputs/YYYY-MM-DD-video-slug/. Deterministic, dependency-free, offline.
 * The output is a high-quality, editable scaffold — not a final render.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Default video settings (edit here to change the engine's defaults)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  aspectRatio: '9:16',
  totalSecondsTarget: 32, // 30–60s; default lands ~30s
  sceneCount: 6, // 5–8 scenes
  // per-scene duration is derived; 4–7s per scene
  platforms: ['YouTube Shorts', 'TikTok', 'Instagram Reels', 'X'],
  tone: 'cinematic, fast, clear, high-retention',
  style: 'cinematic, high-contrast, shallow depth of field, filmic color grade',
  negativePrompt:
    'no text, no watermark, no logo, no captions baked in, no extra fingers, ' +
    'no deformed hands, no warped faces, no duplicated limbs, no low-res, ' +
    'no blurry artifacts, no horizontal letterboxing, no 16:9 framing',
};

// Beat arc for a tight Shorts narrative. One entry per scene.
const SCENE_ARC = [
  { beat: 'HOOK', purpose: 'Stop the scroll with an immediate question or striking image.' },
  { beat: 'SETUP', purpose: 'Establish the subject and what is at stake in one clear line.' },
  { beat: 'ESCALATION', purpose: 'Raise tension; show the first complication or reveal.' },
  { beat: 'TURN', purpose: 'The twist, reversal, or key insight lands here.' },
  { beat: 'PAYOFF', purpose: 'Deliver the satisfying resolution or biggest visual moment.' },
  { beat: 'BUTTON', purpose: 'A short final beat + call to action / signature stamp.' },
];

// Cycled cinematography options so every scene looks distinct.
const CAMERA_ANGLES = [
  'low-angle hero shot',
  'slow push-in (dolly)',
  'over-the-shoulder medium',
  'top-down birds-eye',
  'tracking side profile',
  'close-up on face/detail',
  'wide establishing',
  'dutch-angle tension shot',
];
const MOTIONS = [
  'slow dolly-in, subtle parallax',
  'smooth orbit around subject',
  'handheld micro-shake for energy',
  'rapid push then settle',
  'crane up reveal',
  'whip-pan transition out',
  'slow-motion emphasis',
  'static hold with subject motion',
];
const LIGHTING = [
  'dramatic rim light, dark background',
  'soft golden-hour key light',
  'cool blue moody backlight',
  'high-key bright and clean',
  'neon practical lights, teal/magenta',
  'single hard spotlight, deep shadows',
  'overcast soft diffuse light',
  'warm firelight glow',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'untitled';
}

function titleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

function srtTime(totalSeconds) {
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  const s = Math.floor(totalSeconds) % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function uniqueDir(base) {
  if (!fs.existsSync(base)) return base;
  let i = 2;
  while (fs.existsSync(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

// ---------------------------------------------------------------------------
// Content builders
// ---------------------------------------------------------------------------
function buildScenes(idea) {
  const count = DEFAULTS.sceneCount;
  const per = Math.max(4, Math.min(7, Math.round(DEFAULTS.totalSecondsTarget / count)));
  let cursor = 0;
  return SCENE_ARC.slice(0, count).map((arc, i) => {
    const start = cursor;
    const duration = per;
    cursor += per;
    return {
      n: i + 1,
      beat: arc.beat,
      purpose: arc.purpose,
      start,
      end: cursor,
      duration,
      camera: CAMERA_ANGLES[i % CAMERA_ANGLES.length],
      motion: MOTIONS[i % MOTIONS.length],
      lighting: LIGHTING[i % LIGHTING.length],
      subject: `Primary subject of "${idea}" expressed for the ${arc.beat} beat`,
      environment: `Environment that visually communicates: ${arc.purpose.toLowerCase()}`,
      voiceover: buildVoiceLine(idea, arc.beat),
    };
  });
}

function buildVoiceLine(idea, beat) {
  const i = idea;
  switch (beat) {
    case 'HOOK':
      return `Stop scrolling. This is ${i} — and it's not what you think.`;
    case 'SETUP':
      return `Here's the thing about ${i} that almost nobody notices.`;
    case 'ESCALATION':
      return `But it gets bigger. Watch what happens next.`;
    case 'TURN':
      return `And that's when everything about ${i} changes.`;
    case 'PAYOFF':
      return `That's the part that sticks with you.`;
    case 'BUTTON':
      return `Follow for more. You'll want to see what's next.`;
    default:
      return `${i}.`;
  }
}

function buildCaptionsSRT(scenes) {
  let idx = 1;
  const lines = [];
  for (const s of scenes) {
    const words = s.voiceover.split(/\s+/);
    // ~4 words per caption chunk for Shorts readability
    const chunks = [];
    for (let i = 0; i < words.length; i += 4) chunks.push(words.slice(i, i + 4).join(' '));
    const slice = s.duration / chunks.length;
    chunks.forEach((text, ci) => {
      const start = s.start + ci * slice;
      const end = s.start + (ci + 1) * slice;
      lines.push(`${idx}`);
      lines.push(`${srtTime(start)} --> ${srtTime(end)}`);
      lines.push(text.toUpperCase());
      lines.push('');
      idx += 1;
    });
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// File templates
// ---------------------------------------------------------------------------
function conceptMD(ctx) {
  return `# Concept — ${ctx.title}

- **Idea:** ${ctx.idea}
- **Date:** ${ctx.date}
- **Slug:** ${ctx.slug}
- **Format:** ${DEFAULTS.aspectRatio} vertical · ~${DEFAULTS.totalSecondsTarget}s · ${DEFAULTS.sceneCount} scenes
- **Tone:** ${DEFAULTS.tone}
- **Platforms:** ${DEFAULTS.platforms.join(', ')}

## Logline
A short-form video exploring **${ctx.idea}**, told in a fast, cinematic, high-retention arc.

## Hook (first 1–2 seconds)
> ${ctx.scenes[0].voiceover}

Alternate hooks (pick the strongest after testing):
1. ${ctx.scenes[0].voiceover}
2. You've seen ${ctx.idea} a hundred times. You've never seen it like this.
3. Most people get ${ctx.idea} completely wrong. Here's the truth.

## Why it retains
- Opens on a pattern-interrupt, no intro fluff.
- One idea, one arc — no subplots.
- Biggest visual + payoff land before the 30s mark.
- Ends on a button + CTA to drive follows.

## Character / Style Consistency (carry across every scene)
- **Visual style:** ${DEFAULTS.style}
- **Color signature:** define one ownable accent color and keep it in every scene.
- **Subject continuity:** same wardrobe, proportions, and key features in all scenes.
- **Aspect ratio:** ${DEFAULTS.aspectRatio} for all images and video.
- **Seed strategy:** lock one seed / character reference in Higgsfield and reuse it.

## Title options
${ctx.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}
`;
}

function scriptMD(ctx) {
  const body = ctx.scenes
    .map(
      (s) =>
        `### Scene ${s.n} — ${s.beat} (${s.start}s–${s.end}s)\n` +
        `*Goal: ${s.purpose}*\n\n` +
        `**On screen:** ${s.subject} in ${s.environment}.\n\n` +
        `**Line:** ${s.voiceover}\n`
    )
    .join('\n');
  return `# Script — ${ctx.title}

**Target length:** ~${DEFAULTS.totalSecondsTarget}s · **Aspect:** ${DEFAULTS.aspectRatio}

${body}

---
**Editing notes:** cut to the hook in under 1s, keep every line tight, and end on the
button beat with the on-brand signature stamp.
`;
}

function voiceoverMD(ctx) {
  const lines = ctx.scenes
    .map((s) => `- **[${s.start}s] (${s.beat})** ${s.voiceover}`)
    .join('\n');
  return `# Voiceover Script — ${ctx.title}

Read at a brisk, confident, cinematic pace. ~${DEFAULTS.totalSecondsTarget}s total.

${lines}

---
**VO production notes**
- Recommended engine: ElevenLabs (lock one voice + fixed stability/style per channel).
- Leave ~0.2s breath between beats; emphasize the first word of the HOOK.
- Export mono WAV/MP3; normalize to ~ -14 LUFS for Shorts.
`;
}

function scenesMD(ctx) {
  const rows = ctx.scenes
    .map(
      (s) =>
        `| ${s.n} | ${s.beat} | ${s.start}–${s.end}s | ${s.duration}s | ${s.camera} | ${s.motion} | ${s.lighting} |`
    )
    .join('\n');
  return `# Scene-by-Scene Breakdown — ${ctx.title}

Default: ${DEFAULTS.sceneCount} scenes · ${DEFAULTS.aspectRatio} · 4–7s each.

| # | Beat | Time | Dur | Camera | Motion | Lighting |
|---|------|------|-----|--------|--------|----------|
${rows}

## Continuity checklist
- Same subject design, wardrobe, and accent color in every scene.
- Consistent lens feel and grade across scenes.
- Match cut or motivated transition between consecutive beats.
- Lock seed / character reference in Higgsfield before generating.
`;
}

function imagePromptsMD(ctx) {
  const blocks = ctx.scenes
    .map(
      (s) => `## Scene ${s.n} — ${s.beat} (image)

- **Subject:** ${s.subject}
- **Environment:** ${s.environment}
- **Camera angle:** ${s.camera}
- **Lighting:** ${s.lighting}
- **Style:** ${DEFAULTS.style}
- **Aspect ratio:** ${DEFAULTS.aspectRatio}
- **Continuity notes:** keep subject design, accent color, and grade identical to other scenes; reuse locked seed/reference.
- **Negative prompt:** ${DEFAULTS.negativePrompt}

**Paste-ready prompt:**
\`\`\`
${s.subject}, ${s.environment}, ${s.camera}, ${s.lighting}, ${DEFAULTS.style}, vertical ${DEFAULTS.aspectRatio} composition --no ${DEFAULTS.negativePrompt}
\`\`\`
`
    )
    .join('\n');
  return `# Higgsfield Image Prompts — ${ctx.title}

Generate the key frame for each scene first, lock the look, then animate (see video prompts).

${blocks}`;
}

function videoPromptsMD(ctx) {
  const blocks = ctx.scenes
    .map(
      (s) => `## Scene ${s.n} — ${s.beat} (video)

- **Subject:** ${s.subject}
- **Environment:** ${s.environment}
- **Camera angle:** ${s.camera}
- **Motion:** ${s.motion}
- **Lighting:** ${s.lighting}
- **Style:** ${DEFAULTS.style}
- **Duration:** ${s.duration}s
- **Aspect ratio:** ${DEFAULTS.aspectRatio} (vertical)
- **Continuity notes:** start from the locked Scene ${s.n} key frame; preserve subject design + accent color; smooth match into Scene ${s.n + 1 <= ctx.scenes.length ? s.n + 1 : 'end'}.
- **Negative prompt:** ${DEFAULTS.negativePrompt}

**Paste-ready prompt:**
\`\`\`
${s.subject}, ${s.environment}, ${s.motion}, ${s.camera}, ${s.lighting}, ${DEFAULTS.style}, ${s.duration}s, vertical ${DEFAULTS.aspectRatio} --no ${DEFAULTS.negativePrompt}
\`\`\`
`
    )
    .join('\n');
  return `# Higgsfield Video Prompts — ${ctx.title}

Vertical ${DEFAULTS.aspectRatio}. Animate each locked key frame into a ${'4–7'}s clip, then assemble in order.

${blocks}`;
}

function thumbnailMD(ctx) {
  return `# Thumbnail Concept — ${ctx.title}

- **Primary image:** the most striking frame from Scene ${ctx.scenes[3] ? 4 : 1} (the TURN/PAYOFF beat).
- **Composition:** subject large, off-center; eyes/face or key object in top two-thirds.
- **Text:** 2–4 huge words, high contrast (e.g. "${ctx.titles[0].toUpperCase().slice(0, 24)}").
- **Color:** lead with the channel's ownable accent color; dark vignette for pop.
- **Emotion:** one clear emotion on the subject (curiosity, shock, awe).
- **Readability:** must read at phone-thumbnail size; test at 120px wide.
- **Consistency:** same font + placement every video to build channel recognition.
`;
}

function socialPostsMD(ctx) {
  return `# Social Posting Copy — ${ctx.title}

## Description
${ctx.description}

## Hashtags
${ctx.hashtags.join(' ')}

## Per-platform copy
- **YouTube Shorts:** ${ctx.titles[0]} ${ctx.hashtags.slice(0, 3).join(' ')}
- **TikTok:** ${ctx.idea} — wait for the turn 👀 ${ctx.hashtags.join(' ')}
- **Instagram Reels:** ${ctx.titles[1] || ctx.titles[0]}\n${ctx.hashtags.join(' ')}
- **X:** ${ctx.idea}. The part at the end got me. ${ctx.hashtags.slice(0, 2).join(' ')}

## CTA
Follow for more. New drops on the regular.
`;
}

function metadataJSON(ctx) {
  return JSON.stringify(
    {
      slug: ctx.slug,
      date: ctx.date,
      idea: ctx.idea,
      title_options: ctx.titles,
      primary_title: ctx.titles[0],
      description: ctx.description,
      hashtags: ctx.hashtags,
      format: {
        aspect_ratio: DEFAULTS.aspectRatio,
        target_seconds: DEFAULTS.totalSecondsTarget,
        scene_count: ctx.scenes.length,
        seconds_per_scene_range: '4-7',
      },
      platforms: DEFAULTS.platforms,
      tone: DEFAULTS.tone,
      style: DEFAULTS.style,
      scenes: ctx.scenes.map((s) => ({
        n: s.n,
        beat: s.beat,
        start: s.start,
        end: s.end,
        duration: s.duration,
        camera: s.camera,
        motion: s.motion,
        lighting: s.lighting,
        voiceover: s.voiceover,
      })),
      assets: {
        concept: 'concept.md',
        script: 'script.md',
        voiceover: 'voiceover.md',
        scenes: 'scenes.md',
        image_prompts: 'higgsfield-image-prompts.md',
        video_prompts: 'higgsfield-video-prompts.md',
        captions: 'captions.srt',
        thumbnail: 'thumbnail.md',
        social: 'social-posts.md',
      },
      status: 'draft',
      generated_by: 'Higgsfield_Youtubengine/new-video',
    },
    null,
    2
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const idea = process.argv.slice(2).join(' ').trim();
  if (!idea) {
    console.error('Usage: npm run new-video "VIDEO IDEA HERE"');
    process.exit(1);
  }

  const root = path.resolve(__dirname, '..');
  const date = todayISO();
  const slug = slugify(idea);
  const title = titleCase(idea);

  const scenes = buildScenes(idea);
  const titles = [
    `${title}? Here's the truth`,
    `The ${title} thing nobody tells you`,
    `You're wrong about ${title}`,
    `${title} — explained in 30 seconds`,
    `Watch this before you judge ${title}`,
  ];
  const description = `A fast, cinematic short about ${idea}. Watch to the end for the turn. ` +
    `New shorts regularly — follow so you don't miss the next one.`;
  const hashtags = ['#shorts', `#${slug.replace(/-/g, '')}`, '#cinematic', '#fyp', '#storytime'];

  const ctx = { idea, date, slug, title, scenes, titles, description, hashtags };

  const outDir = uniqueDir(path.join(root, 'outputs', `${date}-${slug}`));
  fs.mkdirSync(outDir, { recursive: true });

  const files = {
    'concept.md': conceptMD(ctx),
    'script.md': scriptMD(ctx),
    'voiceover.md': voiceoverMD(ctx),
    'scenes.md': scenesMD(ctx),
    'higgsfield-image-prompts.md': imagePromptsMD(ctx),
    'higgsfield-video-prompts.md': videoPromptsMD(ctx),
    'captions.srt': buildCaptionsSRT(scenes),
    'thumbnail.md': thumbnailMD(ctx),
    'social-posts.md': socialPostsMD(ctx),
    'metadata.json': metadataJSON(ctx),
  };

  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), content);
  }

  console.log(`\n✅ Production package created:\n   ${path.relative(process.cwd(), outDir)}\n`);
  console.log('   ' + Object.keys(files).join('\n   '));
  console.log(`\nNext: open concept.md, then paste the Higgsfield prompts into Higgsfield.\n`);
}

main();
