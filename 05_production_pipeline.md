# 05 — Production Pipeline

A practical, AI-assisted workflow you can run **this week** with a small toolset. The
principle: lock a reusable character + style reference once, then mass-produce episodes
against it. Don't rebuild the look every video — that's what kills consistency and speed.

Target: **1 producible episode in under ~90 minutes** once the references are locked.

---

## 0. One-time setup (do this once per concept, ~half a day)
- Fill out the series bible (`04`).
- Generate and **lock**: a character reference sheet (front/side/expressions), the
  signature color, the caption font, and the end-card. Save them in a `/assets` folder.
- Create 3 reusable prompt templates (image, animation, VO) with the locked references
  baked in. Everything downstream reuses these.

---

## 1. Writing workflow
- **Input:** the format-episode templates from the bible + a running idea list.
- **Process:** batch-write 10 episodes at once using the Module 2 beat sheet. Write the
  punchline first, then work backward to the hook.
- **Output:** a script doc per episode (action + dialogue + caption text + tag).
- **Tools:** Claude (script drafting + batching), a simple Google Doc/Notion board for the
  episode queue. Keep one "format prompt" so every script comes out in the same shape.

## 2. Character design workflow
- **Goal:** a consistent, reusable character you never have to redesign.
- **Process:** generate a reference sheet (multiple angles + 4–6 expressions) once;
  pick the winner; save seed/style settings.
- **Tools:** Midjourney or DALL·E / Higgsfield for the look; lock a **style reference +
  character reference** so every later frame matches. Save the exact prompt + seed.

## 3. Image generation workflow
- **Goal:** episode key frames/backgrounds in the locked style.
- **Process:** per scene, generate the frame using the locked character + style refs; keep
  the same set/background plate across episodes to maximize consistency and speed.
- **Tools:** Higgsfield / Midjourney for frames; keep a backgrounds library so recurring
  scenes are reused, not regenerated.

## 4. Animation workflow
- **Goal:** turn key frames into 35–90s of motion cheaply.
- **Process:** image-to-video on each key frame for subtle motion; talking-head lip-sync
  for dialogue-driven shows (e.g. Sprout/Two Stars). Favor limited motion + strong VO over
  full animation — it's faster, cheaper, and reads fine on a phone.
- **Tools:** Higgsfield, Runway (Gen-3), Kling, or Pika for image-to-video; a lip-sync
  tool (e.g. Hedra/Runway act-one style) for talking characters.

## 5. Voiceover workflow
- **Goal:** consistent character voices.
- **Process:** assign one locked voice per character; generate VO from the script's
  dialogue; keep settings per character so they sound identical every episode.
- **Tools:** ElevenLabs (primary). Save a named voice + fixed stability/style settings per
  character in the bible.

## 6. Caption workflow
- **Goal:** on-brand, accessibility-friendly captions (most Shorts are watched muted).
- **Process:** auto-transcribe, then apply the locked caption font/placement/animation;
  highlight punchline words.
- **Tools:** CapCut auto-captions or Submagic/Captions app; lock one caption preset.

## 7. Editing workflow
- **Goal:** assemble to the beat sheet with the brand stamp.
- **Process:** drop frames/clips on the timeline in beat order, cut to the hook in <1s,
  add VO + captions + one sound-design pass, end on the signature end-card every time.
- **Tools:** CapCut (fastest, free, template-able) or DaVinci Resolve (more control). Build
  a **CapCut template** with intro pacing, caption style, and end-card pre-placed so each
  episode is a fill-in.

## 8. Publishing workflow
- **Goal:** post everywhere with platform-correct framing.
- **Process:** export one 9:16 master; publish to YouTube Shorts + TikTok + Reels + X with
  per-platform titles/bios from the bible; schedule for evenings.
- **Tools:** native uploaders (best reach) or a scheduler (Metricool/Buffer/Later) for
  batch posting. Keep titles in the bible's title formula.

## 9. Analytics feedback loop
- **Goal:** let data, not taste, choose the winning concept.
- **Process:** review weekly against the scorecard below; double down on top hooks/formats,
  kill underperformers, feed winners back into the writing queue.
- **Tools:** native analytics (YT Studio, TikTok, Instagram) + one simple tracking sheet.

---

## Weekly scorecard (fill per episode)

| Metric | What it tells you | Target signal |
|--------|-------------------|---------------|
| **1–3s retention / hook rate** | Is the cold open working? | >70% past 3s |
| **Avg % viewed** | Is the middle holding? | >60% |
| **Rewatch / loops** | Joke + ending strength | High = strong format |
| **Shares** | Is it spreading? | Best leading indicator of a hit |
| **Saves** | Comfort/character loyalty | Strong for IP depth |
| **Comments mentioning the character/catchphrase** | Is the IP landing? | Names/quotes = brand forming |
| **Follower conversion** | Turning views into an audience | Rising = keep this concept |

**Decision rule:** after ~2 weeks / ~20 posts per concept, **kill the bottom concept,
double the production budget on the top one.** Promote the winner to a series and start
building merch around its catchphrase + silhouette.

---

## Minimum viable stack (start here, don't over-buy)
- **Write:** Claude
- **Design + frames:** Higgsfield (or Midjourney)
- **Motion:** Higgsfield / Runway / Kling
- **Voice:** ElevenLabs
- **Edit + captions:** CapCut
- **Publish:** native apps + a free scheduler
- **Track:** one Google Sheet

That's enough to ship 3 pilots of 3 concepts (9 episodes) in week one.
