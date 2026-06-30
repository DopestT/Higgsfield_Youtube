'use strict';

/**
 * Optional LLM copywriting layer (Claude Messages API via built-in fetch — no SDK).
 *
 * Enabled only when ANTHROPIC_API_KEY is set AND (env HF_AI=1 or opts.ai). Otherwise
 * callers fall back to the deterministic templates in lib/package.js. This keeps the
 * MVP runnable with zero config, and "smart" when a key is present.
 *
 * Returns a normalized object: { topicLabel, logline, altHooks, titles[5],
 * description, hashtags[5], scenes[{beat,subject,environment,voiceover,camera,motion,lighting}] }
 * or null on any failure (caller then uses templates).
 */

const MODEL = process.env.HF_MODEL || 'claude-opus-4-8';
const API_URL = 'https://api.anthropic.com/v1/messages';

function aiEnabled(opts = {}) {
  return !!process.env.ANTHROPIC_API_KEY && (opts.ai || process.env.HF_AI === '1');
}

const SCENE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['beat', 'subject', 'environment', 'voiceover', 'camera', 'motion', 'lighting'],
  properties: {
    beat: { type: 'string', enum: ['HOOK', 'SETUP', 'ESCALATION', 'TURN', 'PAYOFF', 'BUTTON'] },
    subject: { type: 'string' },
    environment: { type: 'string' },
    voiceover: { type: 'string' },
    camera: { type: 'string' },
    motion: { type: 'string' },
    lighting: { type: 'string' },
  },
};

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['topic_label', 'logline', 'alt_hooks', 'titles', 'description', 'hashtags', 'scenes'],
  properties: {
    topic_label: { type: 'string' },
    logline: { type: 'string' },
    alt_hooks: { type: 'array', items: { type: 'string' } },
    titles: { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    scenes: { type: 'array', items: SCENE_SCHEMA },
  },
};

function buildPrompt(idea, context) {
  const trendBlock = context
    ? `\nThis idea comes from a trending item. Use it as a SIGNAL and inspiration only — ` +
      `do NOT copy article text, do NOT invent facts beyond it, do NOT pose as a news authority. ` +
      `Favor an explainer / commentary / visual-argument angle.\nTrend context:\n${context}\n`
    : '';
  return (
    `You are a senior short-form video writer for a high-retention YouTube Shorts / TikTok / Reels channel.\n` +
    `Write a 6-scene, ~36-second vertical (9:16) cinematic Short package for this idea:\n\n"${idea}"\n${trendBlock}\n` +
    `Rules:\n` +
    `- The HOOK scene's voiceover must stop the scroll in 1–2 seconds (a sharp question or claim, no "in this video").\n` +
    `- Scenes follow the arc HOOK, SETUP, ESCALATION, TURN, PAYOFF, BUTTON. The BUTTON ends with a follow CTA.\n` +
    `- Each scene needs concrete, filmable subject + environment + camera + motion + lighting (think cinematic, not generic).\n` +
    `- Lean into a strong visual metaphor where possible.\n` +
    `- Titles: 5 punchy options. Hashtags: exactly 5, each starting with #.\n` +
    `- Keep it original; never plagiarize.\n`
  );
}

async function generateCopy(idea, opts = {}) {
  if (!aiEnabled(opts)) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [{ role: 'user', content: buildPrompt(idea, opts.context) }],
      }),
    });
    if (!res.ok) {
      console.warn(`[llm] ${res.status} ${res.statusText} — falling back to templates.`);
      return null;
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') {
      console.warn('[llm] request refused — falling back to templates.');
      return null;
    }
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) return null;
    const parsed = JSON.parse(textBlock.text);
    return {
      topicLabel: parsed.topic_label,
      logline: parsed.logline,
      altHooks: (parsed.alt_hooks || []).slice(0, 3),
      titles: (parsed.titles || []).slice(0, 5),
      description: parsed.description,
      hashtags: (parsed.hashtags || []).slice(0, 5),
      sceneSeeds: parsed.scenes || [],
    };
  } catch (err) {
    console.warn(`[llm] error: ${err.message} — falling back to templates.`);
    return null;
  }
}

module.exports = { aiEnabled, generateCopy, MODEL };
