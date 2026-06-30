# Higgsfield Prompt Template

Every scene prompt — image **and** video — must include all of these fields.

## Image prompt
- **Subject:** [who/what is in frame]
- **Environment:** [where, mood of place]
- **Camera angle:** [low-angle / push-in / OTS / top-down / tracking / close-up / wide / dutch]
- **Lighting:** [rim / golden-hour / neon / high-key / spotlight / etc.]
- **Style:** cinematic, high-contrast, shallow depth of field, filmic color grade
- **Aspect ratio:** 9:16
- **Continuity notes:** [keep subject design + accent color + grade identical; reuse locked seed]
- **Negative prompt:** no text, no watermark, no logo, no extra fingers, no deformed hands, no warped faces, no low-res, no blurry artifacts, no 16:9 framing

**Paste-ready:**
```
[subject], [environment], [camera angle], [lighting], cinematic style, vertical 9:16 --no [negatives]
```

## Video prompt (adds motion + duration)
- **Motion:** [dolly-in / orbit / handheld / crane / whip-pan / slow-mo / static]
- **Duration:** [4–7]s
- **Aspect ratio:** 9:16 (vertical)
- **Continuity notes:** start from the locked key frame; smooth match into next scene

**Paste-ready:**
```
[subject], [environment], [motion], [camera angle], [lighting], cinematic style, [4-7]s, vertical 9:16 --no [negatives]
```
