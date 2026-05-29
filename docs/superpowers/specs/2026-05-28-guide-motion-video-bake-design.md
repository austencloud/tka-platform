# Guide Motion Video Bake — Design

**Date:** 2026-05-28
**Status:** Approved design, pending implementation plan
**Scope:** Level 1 Guide, Chapter 10 hand-motion sections (`/guide/level-1`)

## Problem

The Level 1 Guide's hand-motion sections render 19 live animated demos via
`GuideMotionDemo.svelte`, each spinning up a full `AnimationPlaybackController`
(orchestrator, interpolator, `AnimationLoop` rAF). To cap concurrent cost, the
component lazy-mounts and unmounts on scroll via an `IntersectionObserver`. The
mount/unmount churn is visually jarring and the per-demo engine setup is heavy
for content that never changes.

These are deterministic, looping animations. They never respond to input. They
are a perfect candidate for rendering once and replaying as video — the guide
page should mount no animation engine at all.

## Goal

Replace the 19 live `GuideMotionDemo` instances with plain
`<video autoplay loop muted playsinline>` elements pointing at pre-baked,
pixel-identical loop assets. The guide page runs zero animation-engine code,
zero rAF, and demos appear instantly with no mount/unmount churn.

## Non-goals

- No theme adaptivity. The guide is dark-only; the dark grid is baked into the
  asset. (If a light theme is ever added, demos re-bake — out of scope here.)
- No runtime interactivity (scrub, pause, speed). These are passive loops.
- No CI-automated bake. The bake is a one-time dev action, re-run only when a
  config changes (see Re-bake Workflow).

## Why not a Node/CI build step

The animation render path is browser-only — `Canvas2DAnimationRenderer` needs
`document`/canvas, and the encoders (`WebCodecsVideoEncoder`,
`WasmVideoEncoder`) need `VideoEncoder`/`VideoFrame`. It cannot run in a
Node/Vite build step.

Two alternatives were rejected:

- **Headless Node + ffmpeg** — re-drive the animation services frame-by-frame
  onto `node-canvas`, pipe to ffmpeg. Adds an ffmpeg dependency, requires the
  animation services to run DOM-free, and re-implements the render path with a
  real risk of not matching the live canvas. Fidelity is the whole point, so
  this loses.
- **Headless Chrome (DevTools MCP)** — drives the in-browser bake
  automatically. Faithful but flaky and heavier than a 19-asset, rarely-rebaked
  set warrants.

Chosen path: **in-browser one-time bake** composing the existing
`Canvas2DAnimationRenderer` (the exact renderer behind the live
`AnimatorCanvas` — pixel-identical output) with the existing `VideoExporter`
(`getVideoExporter().createManualExporter`, which the app's Download Animation
feature already uses). Reuses existing infra, bakes all assets from one click,
and adds no dependency. Precedent exists in
`src/routes/test/card-back-capture/+page.svelte`, which renders to blobs
in-browser the same way.

### Why VideoExporter, not VideoPreRenderer

`VideoPreRenderer` also renders sequences in-browser, but it (a) captures via
`MediaRecorder` in real time — wall-clock-paced frame capture risks timing
jitter and a non-deterministic loop seam; (b) emits mp4 only when
`MediaRecorder.isTypeSupported("video/mp4")` (browser-dependent; Chrome falls
back to webm); and (c) hardcodes staff props, both-hands-visible, and light
theme (lines 220–223, 298–322, 367–391). `VideoExporter.createManualExporter`
instead pumps frames deterministically with explicit per-frame timestamps
(WebCodecs) and always emits H.264 mp4 (WASM fallback on Firefox), so the loop
seam is exact and the format is guaranteed. The bake drives
`Canvas2DAnimationRenderer` directly (passing hand prop type, per-color
visibility, dark mode, no nonradial points) and feeds each rendered frame to
the exporter.

## Architecture

Three units plus a dev-only write endpoint.

### 1. Config source of truth — `guide-motion-configs.ts`

Extract the 19 inline prop sets (currently scattered across 8 section files)
into one exported array. Each entry:

```ts
interface GuideMotionConfig {
  id: string;                    // stable slug → filename + lookup key
  red: { start: GridLocation; end: GridLocation; motionType: MotionType };
  blue?: { start: GridLocation; end: GridLocation; motionType: MotionType };
  showBlue: boolean;
}
```

`id` is a stable kebab slug (`hm-shift-wn`, `t6-static-beta`, …). It names both
the asset file and the lookup key the consumer uses. Single source of truth for
both the bake route and the runtime consumer.

Location: `src/routes/(public)/guide/level-1/_components/guide-motion-configs.ts`
(co-located with the components that consume it).

### 2. Bake route — `/test/guide-motion-bake`

Dev-only page. For each config:

1. Build the same `SequenceData` `GuideMotionDemo` builds today (reuse that
   construction logic — extract a shared `buildGuideMotionSequence(config)`
   helper so the bake route and any future use share one builder).
2. Drive an offscreen `Canvas2DAnimationRenderer` at 2× resolution (512×512),
   dark mode on, hand props, no nonradial points, per-config blue visibility —
   stepping the orchestrator deterministically from position 0 to 1 (one
   animation period). Feed each rendered frame to
   `VideoExporter.createManualExporter`.
3. `finish()` → one `{id}.mp4` (H.264). H.264 plays everywhere including iOS
   Safari, so a single format covers all targets — no webm needed.
4. POST each blob to the dev write endpoint.

UI shows progress (`n / 19 baked`) and a preview grid so output is eyeballed
before commit. No content-hash dedup — all 19 are baked as their own file. (#7
and #9 render identically; baking the duplicate costs a few seconds of one-time
dev work, far cheaper than a runtime alias/manifest indirection. YAGNI.)

### 3. Dev write endpoint — `+server.ts`

A dev-only `POST` handler that writes the mp4 blob to
`static/guide/level-1/motions/{id}.mp4` via `fs.writeFile`. Guarded to
non-production (`import.meta.env.DEV`) so it never ships as a live write
surface. The `id` is validated against the known config-id allowlist before any
path is built (no traversal). This is the bridge from browser blob to committed
asset.

### 4. Runtime consumer — `GuideMotionVideo.svelte`

A dumb video element keyed by `id`:

```svelte
<video
  src={`/guide/level-1/motions/${id}.mp4`}
  autoplay loop muted playsinline preload="metadata"
  aria-label={label}
></video>
```

Square aspect ratio (`aspect-ratio: 1`), `preload="metadata"` so below-the-fold
demos stay cheap. Replaces all 19 `<GuideMotionDemo>` instances across the 8
section files — each call site passes only `id` and an `aria-label` for
accessibility.

`GuideMotionDemo.svelte` and its `AnimatorCanvas` usage are removed from the
guide entirely. The live builder logic is preserved only where the bake route
needs it (`buildGuideMotionSequence`).

## Data flow

```
guide-motion-configs.ts (19 configs)
        │
        ├──► bake route ──► Canvas2DAnimationRenderer ──► frames ──► VideoExporter ──► mp4 blob ──► POST ──► fs.writeFile
        │                                                                                          static/guide/level-1/motions/{id}.mp4
        │
        └──► section files ──► <GuideMotionVideo id="…" /> ──► <video src="/guide/level-1/motions/{id}.mp4">
```

The configs file is the shared contract. Bake produces assets keyed by `id`;
runtime reads assets by the same `id`. No drift possible — both sides import the
same array.

## Asset spec

- **Resolution:** 512×512 (2× the ~256px display ceiling; crisp on retina).
- **Format:** H.264 mp4 only. `VideoExporter` emits H.264 via WebCodecs
  (`WebCodecsVideoEncoder`, Chrome/Safari/Edge) or the WASM `h264-mp4-encoder`
  fallback (Firefox). H.264 mp4 autoplays inline everywhere including iOS
  Safari, so no second format is needed.
- **Opaque:** dark grid + hand baked in; no alpha channel (mp4 has none).
- **Loop:** the bake steps the orchestrator from position 0 (start pose) to
  position 1 (end pose) for the single step. `<video loop>` snaps end→start,
  exactly as the live `GuideMotionDemo` loop does today. Statics are uniform
  frames (perfectly seamless); shifts/dashes snap back like the live demo. This
  is a quality gate verified visually on the bake route preview.
- **Budget:** short low-motion loops; expected ~100KB each, ~2MB total for 19
  assets, lazy-loaded below the fold.

## The 19 configs (grounded enumeration)

red = right hand, blue = left hand. Motions: PRO/ANTI arc to an adjacent point;
DASH cuts straight across to the opposite point; STATIC stays.

| # | id | red | blue | showBlue |
|---|-----|-----|------|----------|
| 1 | `hm-start` | W static | — | no |
| 2 | `hm-shift-wn` | W→N pro | — | no |
| 3 | `hm-shift-ws` | W→S pro | — | no |
| 4 | `hm-dash-we` | W→E dash | — | no |
| 5 | `hm-static-w` | W static | — | no |
| 6 | `t1-split-same` | E→N pro | W→S pro | yes |
| 7 | `t1-together-same` | S→E pro | S→W pro | yes |
| 8 | `t1-split-to-together` | E→S pro | W→S pro | yes |
| 9 | `t1-together-to-split` | S→E pro | S→W pro | yes (dupe of #7) |
| 10 | `t1-gamma-to-gamma` | E→S pro | S→W pro | yes |
| 11 | `t1-gamma-opposite` | E→N pro | S→E pro | yes |
| 12 | `t2-red-shifts` | E→S pro | W static | yes |
| 13 | `t2-blue-shifts` | E static | W→N pro | yes |
| 14 | `t3-cross-shift` | E→S pro | W→E dash | yes |
| 15 | `t4-dash` | S→N dash | W static | yes |
| 16 | `t5-dual-dash` | E→W dash | W→E dash | yes |
| 17 | `t6-static-alpha` | E static | W static | yes |
| 18 | `t6-static-beta` | S static | S static | yes |
| 19 | `t6-static-gamma` | E static | S static | yes |

#7 and #9 render identically but are baked as separate files (`t1-together-same.mp4`,
`t1-together-to-split.mp4`) — no dedup, see Bake route §2.

## Error handling

- **Bake route:** per-config try/catch; a failed config is reported in the
  progress UI and does not abort the batch. The preview grid surfaces any visibly
  wrong render before commit.
- **Write endpoint:** rejects in production; validates `id` against the known
  config slugs to prevent arbitrary path writes (no traversal).
- **Runtime:** if an asset 404s, the `<video>` simply shows nothing — acceptable
  for a one-time-verified static set. No runtime fallback to the live engine
  (that would defeat the goal of removing it).

## Testing / verification

- Unit (vitest, jsdom): `buildGuideMotionSequence` produces correct motions
  (arc vs linear pathShape, `PropType.HAND`, correct start/end locations, blue
  visibility); `GUIDE_MOTION_CONFIGS` has 19 entries with unique slug ids;
  `isKnownMotionId` accepts known ids and rejects traversal/unknown strings.
- Bake-route preview grid (visual): all 19 assets render correct motion (shifts
  arc, dashes straight, statics hold) and loop cleanly.
- Guide page after swap: `npm run check` clean; the guide tree greps to zero
  `AnimationPlaybackController` / `AnimatorCanvas` references; demos play
  instantly with no mount/unmount on scroll.
- Asset budget: total `static/guide/level-1/motions/` size under ~3MB.

## Re-bake workflow

1. Edit `guide-motion-configs.ts`.
2. Run dev server, open `/test/guide-motion-bake`, click Bake.
3. Eyeball the preview grid.
4. Commit the changed `static/guide/level-1/motions/*` assets.

Documented at the top of `guide-motion-configs.ts` so the next editor knows the
assets are generated, not hand-authored.

## Files

**Create:**
- `src/routes/(public)/guide/level-1/_components/guide-motion-configs.ts` — `GuideMotionConfig` interface, `GUIDE_MOTION_CONFIGS` array, `buildGuideMotionSequence` helper, `GUIDE_MOTION_IDS` set + `isKnownMotionId`. (Grep found no existing guide-motion config module; configs are currently inline in section files.)
- `src/routes/(public)/guide/level-1/_components/GuideMotionVideo.svelte` — video consumer. (Grep found no existing `<video>`-loop primitive for guide demos.)
- `src/routes/test/guide-motion-bake/bake-motion.ts` — browser-only bake helper composing `Canvas2DAnimationRenderer` + `VideoExporter`.
- `src/routes/test/guide-motion-bake/+page.svelte` — bake UI. (Follows the `card-back-capture` capture-route pattern.)
- `src/routes/test/guide-motion-bake/+server.ts` — dev-only write endpoint.
- `static/guide/level-1/motions/*.mp4` — 19 baked assets (generated).
- `tests/unit/guide/guide-motion-configs.test.ts` — unit tests for the configs module.

**Edit:**
- 8 section files in `_sections/ch10/` — swap `<GuideMotionDemo>` → `<GuideMotionVideo id="…">`.

**Remove from guide:**
- `GuideMotionDemo.svelte` — deleted once no section references it. The sequence
  builder logic it holds moves to `buildGuideMotionSequence` in the configs file.

## Reused infra (never-hand-roll justification)

- `Canvas2DAnimationRenderer` — the exact renderer behind the live
  `AnimatorCanvas`; reused directly so baked frames are pixel-identical.
- `VideoExporter` (`getVideoExporter().createManualExporter`) — the app's
  existing manual-frame-pump H.264 encoder (WebCodecs + WASM fallback). Reused
  as-is for the render→mp4 step.
- `getSequenceAnimationOrchestrator` / `generateBluePropSvg` / `generateRedPropSvg`
  — the same state + asset helpers `VideoPreRenderer` uses; reused for prop
  state and dimensions.
- `card-back-capture` route — the in-browser capture-to-blob page pattern.
  Followed for the bake UI.
