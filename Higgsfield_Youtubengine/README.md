# Higgsfield_Youtubengine

A repeatable YouTube Shorts production engine. Feed it **one video idea** and it
generates a complete, Higgsfield-ready production package — concept, hook, script,
voiceover, scene-by-scene breakdown, image + video prompts, captions, titles,
description, hashtags, thumbnail concept, social copy, and a metadata JSON.

> **MVP scope:** this version *generates the production package*. It does **not** render
> or upload the final video yet. That's intentional — render manually in Higgsfield first,
> then automate later (see below).

It is **product-agnostic and channel-agnostic** on purpose. Build the engine, test ideas,
then commit to a concept.

## What it produces (per idea)

1. Video concept · 2. Hook · 3. 30–60s script · 4. Voiceover script ·
5. Scene-by-scene breakdown · 6. Higgsfield image prompts · 7. Higgsfield video prompts ·
8. Character/style consistency notes · 9. Captions/SRT · 10. Title options ·
11. Description · 12. 5 hashtags · 13. Thumbnail concept · 14. Social posting copy ·
15. Metadata JSON

## Default video settings
- Vertical **9:16**
- **30–60s** total (default ~32s)
- **5–8 scenes** (default 6), **4–7s** per scene
- Cinematic, fast, clear, high-retention
- Built for YouTube Shorts, TikTok, Reels, and X

---

## 1. Installation

Requires **Node.js 16+** (no other dependencies).

```bash
cd Higgsfield_Youtubengine
npm install            # nothing to install yet, but sets the project up
```

## Usage

```bash
# Generic idea → full package
npm run new-video "a houseplant that thinks it can rule the world"

# Scan RSS feeds for what's trending → scored brief + data
npm run trend-scan

# Turn the top trend into a full package
npm run trend-video

# Turn the top trend matching a keyword/category into a package
npm run trend-video -- "AI"
npm run trend-video -- "creator economy"
npm run trend-video -- "crypto"
```

`new-video` creates `outputs/YYYY-MM-DD-<slug>/` with all files listed above. Re-running the
same idea on the same day creates `-2`, `-3`, … so nothing is overwritten.

### Optional: Claude-written copy
By default the copy is generated from deterministic templates (no API key needed). To have
**Claude** write the hook, script, titles, etc., set an API key and pass `--ai` (or
`HF_AI=1`):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run new-video -- --ai "AI is making one-person content studios possible"
npm run trend-video -- --ai "AI"
```

If the key is missing or the call fails, it silently falls back to templates. Model defaults
to `claude-opus-4-8` (override with `HF_MODEL`).

Project layout:

```
Higgsfield_Youtubengine/
  inputs/        ideas.txt, references.md, rss-sources.json
  outputs/       generated YYYY-MM-DD-slug/ packages
  trends/        generated YYYY-MM-DD-trend-scan.json + -trend-brief.md
  templates/     editable templates + metadata schema
  brand-kits/    placeholder-brand.md (copy per channel)
  analytics/     performance-log.csv
  bin/           new-video.js, trend-scan.js, trend-video.js
  lib/           package.js (shared engine), trends.js (RSS+scoring), llm.js (optional Claude)
```

---

## 2. How to connect Higgsfield MCP or CLI later

The generator writes **paste-ready prompts** today. To automate generation later:

- **MCP route:** add a Higgsfield MCP server to your Claude Code / agent config, then have
  the agent read each `higgsfield-image-prompts.md` / `higgsfield-video-prompts.md` block
  and call the Higgsfield image/video tools per scene, saving returned assets next to the
  package.
- **CLI/API route:** add a `render` script (`bin/render.js`) that parses `metadata.json`,
  loops scenes, and POSTs each prompt to the Higgsfield API, downloading results into an
  `assets/` subfolder of the output package.
- Keep the locked **seed / character reference** in `brand-kits/` so automated renders stay
  consistent.

Nothing in the MVP blocks this — `metadata.json` already lists every scene with its prompt
fields, so an automated renderer just iterates it.

## 3. How to manually use the generated prompts inside Higgsfield (do this first)

1. Run `npm run new-video "..."`.
2. Open `higgsfield-image-prompts.md`. For **Scene 1**, copy the paste-ready prompt into
   Higgsfield's image generator. Generate, pick the best frame, **lock the seed/reference**.
3. Reuse that locked reference for Scenes 2–6 so the subject stays consistent.
4. Open `higgsfield-video-prompts.md`. For each scene, animate its locked key frame using
   the paste-ready video prompt (vertical 9:16, 4–7s).
5. Drop all clips into your editor in scene order, add the voiceover (`voiceover.md`) and
   captions (`captions.srt`), end on your signature stamp, export 9:16.

## 4. How to expand into automated rendering later

- Add `bin/render.js` to call Higgsfield (MCP or API) from `metadata.json`.
- Add a voiceover step (ElevenLabs API) reading `voiceover.md`.
- Add an assembly step (e.g. ffmpeg/Remotion) to stitch clips + VO + `captions.srt`.
- Add a publish step (YouTube/TikTok APIs) using `social-posts.md` + `metadata.json`.
- Keep human approval before publishing.

---

## 5. RSS trend research layer

Move packages closer to what's actually trending. Three pieces:

### How it works
1. **`inputs/rss-sources.json`** lists RSS/Atom feeds grouped by category.
2. **`npm run trend-scan`** fetches the enabled feeds, parses recent items, scores each, and
   writes `trends/YYYY-MM-DD-trend-scan.json` (full data) + `trends/YYYY-MM-DD-trend-brief.md`
   (human brief grouped by category).
3. **`npm run trend-video`** loads the latest scan, picks a trend, and writes a full
   production package to `outputs/` — seeded by the trend (angle, hook, visual metaphor, risk
   notes), not a generic idea.

### Editing `inputs/rss-sources.json`
Each source has `name`, `category`, `feed_url`, `weight` (0.0–1.0, how much to trust it), and
`enabled` (true/false). Add/remove freely, flip `enabled`, tune `weight`. Categories seeded:
AI / Tech, Creator economy, YouTube / social platforms, Crypto / markets, Politics / power,
Business / startups, Culture / internet. Point at a different file with `HF_RSS_SOURCES=path`.

### How items are scored
Each item gets a `trend_score` (0–100) from: recency, source weight, repeated keywords across
feeds, emotional intensity, creator relevance, visual potential, Shorts hook potential, and
business/tech relevance. It also gets `suggested_angle`, `suggested_hook`, `visual_metaphor`,
`risk_notes`, and `usable_for_video`.

### Manual keyword / category override
```bash
npm run trend-video -- "AI"               # highest-scoring usable trend matching the category/word
npm run trend-video -- "creator economy"
npm run trend-video -- "crypto"
```
Matching is category-substring or whole-word in the title/summary (so `"AI"` won't match
*available*). With no argument, it picks the top usable trend overall.

### Limitations
- **Network required.** `trend-scan` needs outbound HTTPS to the feed hosts. Restricted
  networks/sandboxes may block some domains — failed sources are reported, not fatal.
- **Feeds drift.** Publishers change or remove RSS URLs; prune/replace in `rss-sources.json`.
- **Scoring is heuristic**, keyword-based — a strong signal, not editorial judgment. Read the
  brief before producing.
- **No rendering or uploading** — this layer only identifies trends and builds the package.
- **Recency depends on feed dates;** items without a parseable date score lower on recency.

### Editorial rules (built in)
- Items are **signals, not source text** — never copy article wording; summaries are truncated
  snippets for context only.
- Don't claim facts beyond what the item supports; favor explainers, commentary, and visual
  arguments over posing as a news authority.
- Political, legal, medical, financial, or breaking-news topics are auto-flagged with a
  `risk_notes` field and `needs_human_review: true` in the package.

---

## 6. Seven-day launch workflow

- **Day 1 — Setup.** Install, fill `inputs/references.md`, copy `placeholder-brand.md` to a
  real brand kit, lock accent color + caption style.
- **Day 2 — Idea batch.** Add 10 ideas to `inputs/ideas.txt`. Run `new-video` on the best 3.
- **Day 3 — Look lock.** Generate Scene 1 images in Higgsfield for each; lock the seed/style.
- **Day 4 — Produce pilot #1.** Render all scenes, add VO + captions, edit, export.
- **Day 5 — Produce pilots #2 and #3.** Reuse the locked look to go faster.
- **Day 6 — Publish + cross-post.** Post all 3 to Shorts/TikTok/Reels/X using `social-posts.md`.
- **Day 7 — Measure.** Log results in `analytics/performance-log.csv`; keep the winner's
  format, kill the rest, queue next batch.

## 7. Quality checklist before posting

- [ ] Hook lands a question/visual in the first 1–2s (no intro fluff).
- [ ] Total length 30–60s; each scene 4–7s; 5–8 scenes.
- [ ] Vertical 9:16 throughout; no letterboxing.
- [ ] Same subject design + accent color in every scene (continuity holds).
- [ ] Captions readable, synced, on-brand, all-caps, safe from UI overlap.
- [ ] Voiceover clear, normalized (~ -14 LUFS), tight pacing.
- [ ] Payoff/biggest moment lands before ~30s.
- [ ] Ends on the signature stamp + CTA.
- [ ] Title, description, 5 hashtags, thumbnail set per platform.
- [ ] No copied IP, characters, scripts, or art.

## 8. Safety checklist for trend-based videos

Run this in addition to the checklist above for anything from `trend-video`:

- [ ] Read the original item — the package is an **angle**, not a report. Don't restate the
      article; say something about it.
- [ ] No claimed facts beyond the headline/snippet. No fabricated stats, quotes, or numbers.
- [ ] If `needs_human_review` is true (political/legal/medical/financial/breaking), a human
      verifies every claim against the source **before** posting.
- [ ] No financial / medical / legal advice. Frame as commentary or explainer.
- [ ] Tone is commentary/explainer, not "breaking news authority."
- [ ] Nothing defamatory about named people or companies; opinions are clearly opinions.
- [ ] Topic is still timely (trends decay fast — check the item's date).
