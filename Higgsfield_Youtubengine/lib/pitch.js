'use strict';

/**
 * Topic pitch generator.
 *
 * Takes a scored trend item (from trends.scoreItems) and produces a structured
 * topic-pitch.md file that a producer can use to decide whether to make the video.
 *
 * Output is opinion + framing, not a news summary.
 */

// Audience profiles keyed by category
const AUDIENCE_MAP = {
  'AI / Tech': ['tech-curious general audience', 'AI creators and developers', 'startup founders', 'creators using AI tools', 'early adopters'],
  'Creator economy': ['YouTubers and content creators', 'aspiring creators', 'creators using automation', 'social media managers', 'brand builders'],
  'YouTube / social platforms': ['YouTubers and content creators', 'social media managers', 'digital marketers', 'small business owners using social'],
  'Crypto / markets': ['crypto traders', 'DeFi and Web3 builders', 'crypto-curious general audience', 'retail investors'],
  'Politics / power': ['political viewers', 'civically engaged general audience', 'news followers', 'policy watchers'],
  'Business / startups': ['startup founders', 'small business owners', 'operators and entrepreneurs', 'investors and VCs', 'MBA and business students'],
  'Culture / internet': ['gen-z and millennial general audience', 'internet culture followers', 'creators building personal brands', 'marketers tracking trends'],
};

// Commentary angles by category — what I Swear I'm Not Crazy's stance is
const COMMENTARY_ANGLES = {
  'AI / Tech': 'The pattern to find: is this a genuine capability leap, or a rebrand of existing tech? What does it mean for creators and builders right now?',
  'Creator economy': 'The pattern: platform power shifts. Who benefits, who gets squeezed, and what should creators do about it today — not next year.',
  'YouTube / social platforms': 'The pattern: algorithm and monetization signals hidden in product news. Every announcement is a policy shift in disguise.',
  'Crypto / markets': 'The pattern: sentiment cycle vs. fundamentals. What\'s the actual change in the underlying protocol or market structure?',
  'Politics / power': 'The pattern: follow the incentives, not the rhetoric. What does each actor actually gain or lose from this outcome?',
  'Business / startups': 'The pattern: hype vs. structural change. Is this a narrative moment or a real market shift? What do operators actually do with this?',
  'Culture / internet': 'The pattern: what does mass behavior reveal about the underlying need? Every viral moment is an insight into audience psychology.',
};

// Visual framing guidance per category
const VISUAL_GUIDANCE = {
  'AI / Tech': 'Neural networks, chip architectures, glowing UI elements, the contrast between a human hand and a machine. Strong metaphor: a brain being rewired.',
  'Creator economy': 'A creator at a desk as the world expands around them — rising subscriber counts, studio lights turning on. Scale and intimacy in tension.',
  'YouTube / social platforms': 'The feed itself is the visual — infinite scroll, algorithmic sorting, one tile that glows brighter than the rest.',
  'Crypto / markets': 'Candlestick charts as a skyline. Price action as weather. The contrast between financial abstraction and physical reality.',
  'Politics / power': 'Chess pieces. Maps. Faces under hard directional light. Power as geometry and shadow.',
  'Business / startups': 'A small object doing something it shouldn\'t be able to do — the underdog visual. Contrast between scale of ambition and physical smallness of the team.',
  'Culture / internet': 'Memes spreading like liquid. Comment sections as architecture. The moment a trend tips from niche to mainstream.',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function recencyLabel(signals) {
  const r = signals && signals.recency != null ? signals.recency : 0.3;
  if (r >= 0.9) return 'breaking / last 12h';
  if (r >= 0.7) return 'fresh / last 24h';
  if (r >= 0.5) return 'recent / last 48h';
  if (r >= 0.3) return 'this week';
  return 'older / archive';
}

function riskLevel(item) {
  if (!item.needs_human_review) return 'low';
  const signals = item.signals || {};
  if (signals.emotional_intensity >= 0.7) return 'high';
  return 'medium';
}

function recommendation(item, rank) {
  const score = item.trend_score || 0;
  const sensitive = item.needs_human_review;
  if (score >= 65 && !sensitive) return 'Make this now';
  if (score >= 60 && sensitive) return 'Needs research first';
  if (score >= 50 && !sensitive) return rank <= 2 ? 'Make this now' : 'Save for later';
  if (score >= 40 && sensitive) return 'Needs research first';
  if (score >= 40) return 'Save for later';
  return 'Skip';
}

function hooks(item) {
  const cat = item.category || 'this topic';
  const catShort = cat.split(' ')[0].toLowerCase();
  return [
    item.suggested_hook || `You'll see headlines about this. You won't see the part that matters.`,
    `The ${catShort} story everyone's going to talk about — but not for the reason you think.`,
    `Here's what \"${item.title.slice(0, 45)}...\" actually signals for you.`,
  ];
}

function whyNow(item) {
  const r = (item.signals && item.signals.recency) || 0.3;
  const label = recencyLabel(item.signals);
  const lines = [];

  if (r >= 0.8) {
    lines.push(`This story broke in the last 12 hours — it's in the window where commentary gets traction before the take-pile-on starts.`);
  } else if (r >= 0.5) {
    lines.push(`Published in the last 24–48 hours. The initial wave of coverage is out; a clear explainer/commentary angle hasn't landed yet.`);
  } else {
    lines.push(`The item is ${label}. The news cycle may have moved, but the underlying pattern it reveals is still live.`);
  }

  const repeat = (item.signals && item.signals.keyword_repeat) || 0;
  if (repeat >= 0.5) {
    lines.push(`Multiple sources covered related topics in this scan — cross-source signal suggests this is a genuine conversation cluster, not a single outlet's push.`);
  }

  const emotional = (item.signals && item.signals.emotional_intensity) || 0;
  if (emotional >= 0.5) {
    lines.push(`The topic carries emotional signal (controversy, urgency, or high stakes) — those stories earn outsized attention on Shorts.`);
  }

  return lines.join(' ');
}

function whyBeatsOthers(item, allItems) {
  const others = allItems
    .filter((o) => o !== item && o.usable_for_video)
    .slice(0, 4);

  if (!others.length) return 'No comparable usable topics in this scan — this is the clear priority.';

  const lines = [`Score ${item.trend_score} vs. next best ${others.map((o) => o.trend_score).join(', ')}.`];

  const higherVisual = others.filter(
    (o) => (item.signals && item.signals.visual_potential || 0) > (o.signals && o.signals.visual_potential || 0)
  ).length;
  if (higherVisual >= 2) {
    lines.push(`Stronger visual potential than ${higherVisual} of the next ${others.length} candidates.`);
  }

  const higherCreator = others.filter(
    (o) => (item.signals && item.signals.creator_relevance || 0) > (o.signals && o.signals.creator_relevance || 0)
  ).length;
  if (higherCreator >= 2) {
    lines.push(`More relevant to the creator audience than most alternatives.`);
  }

  const lowerRisk = others.filter((o) => o.needs_human_review && !item.needs_human_review).length;
  if (lowerRisk >= 2) {
    lines.push(`Lower risk profile than ${lowerRisk} competitors — can go faster with less review overhead.`);
  }

  if (item.signals && item.signals.hook_potential >= 0.6) {
    lines.push(`Above-average hook signal — the title structure lends itself to a strong open without much rewriting.`);
  }

  return lines.join(' ');
}

/**
 * Build a full topic-pitch.md string for a single item.
 * @param {object} item — scored trend item
 * @param {object[]} allItems — full ranked list (for "why beats others")
 * @param {number} rank — 1-based rank of this item in today's candidates
 */
function buildPitchMD(item, allItems, rank = 1) {
  const date = todayISO();
  const sig = item.signals || {};
  const rec = recommendation(item, rank);
  const risk = riskLevel(item);
  const hookList = hooks(item);
  const audience = AUDIENCE_MAP[item.category] || ['general audience', 'curious generalists'];
  const visual = VISUAL_GUIDANCE[item.category] || 'The subject itself — isolated, lit dramatically, with a single clear visual metaphor.';
  const angle = COMMENTARY_ANGLES[item.category] || 'Find the pattern behind the headline. What does this reveal that the article doesn\'t say?';

  const scoreTable = [
    `| Metric                  | Value                                           |`,
    `|-------------------------|-------------------------------------------------|`,
    `| Trend score             | ${item.trend_score}/100                                     |`,
    `| Recency                 | ${recencyLabel(sig)} (${(sig.recency != null ? sig.recency * 100 : 30).toFixed(0)}%)           |`,
    `| Creator relevance       | ${Math.round((sig.creator_relevance || 0) * 100)}%                                          |`,
    `| Visual potential        | ${Math.round((sig.visual_potential || 0.2) * 100)}%                                          |`,
    `| Shorts hook potential   | ${Math.round((sig.hook_potential || 0) * 100)}%                                          |`,
    `| Business/tech relevance | ${Math.round((sig.business_tech_relevance || 0) * 100)}%                                          |`,
    `| Emotional intensity     | ${Math.round((sig.emotional_intensity || 0) * 100)}%                                          |`,
    `| Risk level              | ${risk}${item.needs_human_review ? ' ⚠️' : ' ✓'}                                          |`,
  ].join('\n');

  return `# Topic Pitch — ${item.title}

> **Rank:** #${rank} of today's candidates  
> **Recommendation: ${rec}**  
> **Generated:** ${date}

---

## 1. Topic

- **Title:** ${item.title}
- **Source:** ${item.source} (${item.category})
- **Published:** ${item.published || 'unknown'}
- **Link:** ${item.link || 'n/a'}

---

## 2. One-line pitch

${item.suggested_angle}

---

## 3. Why now?

${whyNow(item)}

---

## 4. Audience fit

Primary:
${audience.slice(0, 3).map((a) => `- ${a}`).join('\n')}

Secondary:
${audience.slice(3).map((a) => `- ${a}`).join('\n') || '- none identified'}

---

## 5. Hook potential

${hookList.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

---

## 6. Visual potential

${visual}

**Visual metaphor for this piece:** ${item.visual_metaphor || 'a single striking object isolated on a dark stage'}

---

## 7. Commentary angle

${angle}

**Applied to this topic:** ${item.suggested_angle}

The goal is not to summarize what Google/TechCrunch/whoever published. The goal is to find the one thing they didn't say — the pattern underneath the headline.

---

## 8. Risk notes

${item.risk_notes || 'No elevated risk flags for this topic. Standard editorial judgment applies.'}

Risk level: **${risk}**${item.needs_human_review ? '  \n⚠️ Flagged for human review before posting.' : '  \n✓ No mandatory review triggered.'}

---

## 9. Why this beats other topics today

${whyBeatsOthers(item, allItems)}

---

## 10. Score breakdown

${scoreTable}

---

## 11. Recommendation

**${rec}**

${rec === 'Make this now' ? '→ Slot this into one of today\'s 2 video slots. The window is open.' : ''}
${rec === 'Save for later' ? '→ Queue this for tomorrow or next scan cycle. Not urgent enough to bump today\'s slots.' : ''}
${rec === 'Needs research first' ? '→ Do not produce blind. Read the source, verify the key claim, confirm the angle before generating.' : ''}
${rec === 'Skip' ? '→ Not worth a slot today. Too low signal or too much risk for the return.' : ''}

---

## 12. Final creator decision

Review the angle, hook, and risk notes above.

**Decision: approve / revise / save / skip?**

_Write your decision here before generating the production package._
`;
}

/**
 * Build a short pitch summary (2–3 lines) for daily plan lists.
 */
function buildPitchSummary(item, rank) {
  const rec = recommendation(item, rank);
  return `**[${item.trend_score}] ${item.title}** (${item.source}, ${item.category})  
${item.suggested_hook || item.suggested_angle}  
→ ${rec}${item.needs_human_review ? ' · ⚠️ review required' : ''}`;
}

/**
 * Build the full daily pitch brief (queue/YYYY-MM-DD-topic-pitches.md).
 */
function buildDailyBriefMD(date, items, pitches) {
  const usable = items.filter((i) => i.usable_for_video).slice(0, 5);

  let md = `# Topic Pitches — ${date}

> Produced by Higgsfield_Youtubengine / pitch-topics  
> Format: I Swear I'm Not Crazy — 2 videos per day, cinematic, fast, commentary-led
> Tone: vindication-forward, sharp, contrarian-but-right, grounded (never unhinged)

---

## Today's slots

You have **2 video slots** today. Here are the top ${usable.length} candidates, ranked.

---

`;

  usable.forEach((item, i) => {
    const rank = i + 1;
    const rec = recommendation(item, rank);
    const sig = item.signals || {};
    md += `## Slot candidate #${rank} — Score ${item.trend_score}

**${item.title}**  
Source: ${item.source} · Category: ${item.category}  
Published: ${item.published || 'unknown'}

**Why make this today:**  
${whyNow(item)}

**Hook:**  
> "${item.suggested_hook || item.suggested_angle}"

**Audience:** ${(AUDIENCE_MAP[item.category] || ['general audience']).slice(0, 2).join(', ')}

**Visual metaphor:** ${item.visual_metaphor || 'single striking object, dark stage'}

**Risk:** ${riskLevel(item)}${item.needs_human_review ? ' ⚠️ — needs review before posting' : ' ✓'}

**Recommendation: ${rec}**

See full pitch: \`queue/${date}-topic-pitches/${item.source.toLowerCase().replace(/[^a-z0-9]/g, '-')}-rank-${rank}.md\`  
Decision: approve / revise / save / skip

---

`;
  });

  md += `## Why these ${usable.length} and not the rest

The candidates above cleared the usability threshold (score ≥ 40, title 10–200 chars). Below-threshold items were not pitched — too low signal, too similar to above candidates, or too high risk for the return.

## Next steps

1. Pick 2 candidates and mark them "approve" above.
2. Run: \`npm run trend-video\` — it will generate the package for the top approved topic.
3. Or specify a category: \`npm run trend-video -- "AI"\`
4. Review \`concept.md\` and \`topic-pitch.md\` in the output folder before touching Higgsfield.
5. Paste the Higgsfield prompts after you've confirmed the angle.

---
_Generated ${new Date().toISOString()}_
`;

  return md;
}

module.exports = { buildPitchMD, buildPitchSummary, buildDailyBriefMD, recommendation };
