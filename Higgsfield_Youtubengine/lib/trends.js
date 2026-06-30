'use strict';

/**
 * RSS/Atom parsing + trend scoring (dependency-free).
 *
 * Editorial stance baked in: items are SIGNALS, never source text. We never copy
 * article bodies — summaries are truncated to a snippet for context only, and the
 * generator turns the topic into an original explainer/commentary angle.
 */

// ---------------------------------------------------------------------------
// Minimal RSS/Atom parser
// ---------------------------------------------------------------------------
function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}
function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, ' ');
}
function clean(s, max) {
  let out = decodeEntities(stripTags(decodeEntities(s || ''))).replace(/\s+/g, ' ').trim();
  if (max && out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return out;
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function atomLink(block) {
  const links = block.match(/<link\b[^>]*>/gi) || [];
  let fallback = '';
  for (const l of links) {
    const href = (l.match(/\bhref="([^"]+)"/i) || [])[1];
    if (!href) continue;
    if (/\brel="alternate"/i.test(l) || !/\brel=/i.test(l)) return href;
    fallback = fallback || href;
  }
  return fallback;
}

function parseFeed(xml, source) {
  if (!xml) return [];
  let blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi);
  const isAtom = !blocks;
  if (isAtom) blocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const title = clean(tag(b, 'title'), 220);
    let link = clean(tag(b, 'link'), 500);
    if (!link || /[<>]/.test(link)) link = atomLink(b) || link;
    const pub =
      tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const summary = clean(
      tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'),
      300
    );
    const ts = pub ? Date.parse(clean(pub)) : NaN;
    return {
      title,
      link: clean(link, 500),
      source: source.name,
      category: source.category,
      source_weight: source.weight,
      published: pub ? clean(pub) : null,
      published_ts: Number.isNaN(ts) ? null : ts,
      summary,
    };
  }).filter((it) => it.title);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
const STOP = new Set(
  ('the a an and or of to in on for with from at by as is are be this that it its ' +
    'how why what when who new your you we our they their will can has have not but ' +
    'about into over after before more most just like via amid says say said could ' +
    'would should now then than out up down off here there').split(' ')
);
const EMOTIONAL = 'shock shocking crisis soar soars plunge plummet ban banned breakthrough lawsuit sue sued war dead dies died killed explodes viral backlash outrage warning danger record massive huge collapse crash boom fear panic scandal fired quit leak leaked exposed slams surge surges'.split(' ');
const CREATOR = 'creator creators youtube youtuber tiktok reels shorts influencer influencers monetize monetization subscriber subscribers algorithm content viral channel streamer twitch podcast sponsorship views creators'.split(' ');
const VISUAL = 'robot robots ai space rocket chip chips brain city car cars game games money gold chart charts energy solar drone phone glasses headset vr ar satellite android iphone humanoid'.split(' ');
const BIZTECH = 'ai startup startups funding raise raised ipo market markets stock stocks revenue model models gpt llm openai google apple microsoft nvidia meta amazon chip acquisition acquire valuation billion million launch launches'.split(' ');
const SENSITIVE = 'election vote votes senate congress court lawsuit sue sued indict arrest vaccine fda sec war ukraine gaza shooting died dies killed death bankrupt fraud charged trial ban banned hack breach recall outbreak crash invest investment buy sell price token coin'.split(' ');
const SENSITIVE_CATS = new Set(['Politics / power', 'Crypto / markets']);

function tokenize(s) {
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));
}
function countHits(text, list) {
  let n = 0;
  for (const w of list) if (text.includes(w)) n += 1;
  return n;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function scoreItems(items) {
  const freq = Object.create(null);
  for (const it of items) for (const t of tokenize(it.title)) freq[t] = (freq[t] || 0) + 1;
  const now = Date.now();

  for (const it of items) {
    const text = `${it.title} ${it.summary}`.toLowerCase();
    const tokens = tokenize(it.title);

    let recency;
    if (!it.published_ts) recency = 0.3;
    else {
      const hours = (now - it.published_ts) / 3.6e6;
      recency = hours <= 12 ? 1 : hours >= 168 ? 0.05 : 1 - ((hours - 12) / 156) * 0.95;
    }
    const sourceWeight = clamp01(it.source_weight != null ? it.source_weight : 0.6);
    const repeat = clamp01(tokens.reduce((a, t) => a + Math.min((freq[t] || 1) - 1, 3), 0) / 6);
    const emotional = clamp01(countHits(text, EMOTIONAL) / 4);
    const creator = clamp01(countHits(text, CREATOR) / 3);
    const visual = clamp01(0.2 + countHits(text, VISUAL) / 3);
    const biztech = clamp01(countHits(text, BIZTECH) / 3);
    const hookSignals =
      (/\d/.test(it.title) ? 1 : 0) +
      (/\?/.test(it.title) ? 1 : 0) +
      (/^(why|how|this|what|the truth|inside)\b/i.test(it.title) ? 1 : 0) +
      (/\b(best|worst|first|biggest|never|always|secret|nobody)\b/i.test(it.title) ? 1 : 0);
    const hook = clamp01(hookSignals / 3);

    const W = { recency: 0.2, sourceWeight: 0.12, repeat: 0.13, emotional: 0.1, creator: 0.1, visual: 0.1, hook: 0.15, biztech: 0.1 };
    const score =
      recency * W.recency + sourceWeight * W.sourceWeight + repeat * W.repeat +
      emotional * W.emotional + creator * W.creator + visual * W.visual +
      hook * W.hook + biztech * W.biztech;

    it.signals = {
      recency: +recency.toFixed(2), source_weight: +sourceWeight.toFixed(2),
      keyword_repeat: +repeat.toFixed(2), emotional_intensity: +emotional.toFixed(2),
      creator_relevance: +creator.toFixed(2), visual_potential: +visual.toFixed(2),
      hook_potential: +hook.toFixed(2), business_tech_relevance: +biztech.toFixed(2),
    };
    it.trend_score = Math.round(score * 100);

    const sensitive = SENSITIVE_CATS.has(it.category) || countHits(text, SENSITIVE) > 0;
    Object.assign(it, buildSuggestions(it, sensitive));
    it.usable_for_video = it.trend_score >= 40 && it.title.length >= 10 && it.title.length <= 200;
  }
  items.sort((a, b) => b.trend_score - a.trend_score);
  return items;
}

const METAPHORS = {
  'AI / Tech': 'a glowing neural brain wired into a dark circuit-city',
  'Creator economy': 'a lone creator at a laptop as a studio of holographic panels blooms around them',
  'YouTube / social platforms': 'an endless scrolling wall of feeds with one tile glowing',
  'Crypto / markets': 'candlestick charts rising like a neon city skyline',
  'Politics / power': 'chess pieces on a map under hard directional light',
  'Business / startups': 'a tiny rocket built from office objects straining to lift off',
  'Culture / internet': 'a meme spreading like ink through water',
};

function buildSuggestions(it, sensitive) {
  const cat = it.category;
  const metaphor = METAPHORS[cat] || 'a single striking object isolated on a dark stage';
  const hookOptions = [
    `Everyone's about to be talking about this. Here's what actually matters.`,
    `This ${cat.split(' ')[0].toLowerCase()} story sounds boring. It isn't — here's why.`,
    `You'll see headlines about this. You won't see the part that matters.`,
    `Here's the 30-second version nobody's explaining clearly.`,
  ];
  const idx = it.title.length % hookOptions.length;
  const angle = `A fast, original explainer/commentary on what "${it.title}" really signals for ${cat.toLowerCase()} — no hype, no copying the article, just the clear takeaway and why it matters.`;

  let risk_notes = null;
  if (sensitive) {
    risk_notes =
      'NEEDS HUMAN REVIEW before posting. This topic is political/legal/financial/medical or breaking-news adjacent. ' +
      'Do not state facts beyond the headline, do not give financial/medical/legal advice, frame as commentary/explainer, and verify claims against the source.';
  }
  return {
    suggested_angle: angle,
    suggested_hook: hookOptions[idx],
    visual_metaphor: metaphor,
    risk_notes,
    needs_human_review: !!sensitive,
  };
}

module.exports = { parseFeed, scoreItems, clean };
