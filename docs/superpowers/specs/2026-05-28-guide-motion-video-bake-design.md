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

`VideoPreRenderer` is browser-only — it uses `MediaRecorder`, `IndexedDB`,
`document`, and `requestAnimationFrame` (verified in
`src/lib/shared/animation-engine/services/implementations/VideoPreRenderer.ts`).
It cannot run in a Node/Vite build step.

Two alternatives were rejected:

- **Headless Node + ffmpeg** — re-drive the animation services frame-by-frame
  onto `node-canvas`, pipe to ffmpeg. Adds an ffmpeg dependency, requires the
  animation services to run DOM-free, and re-implements the render path with a
  real risk of not matching the live canvas. Fidelity is the whole point, so
  this loses.
- **Headless Chrome (DevTools MCP)** — drives the in-browser bake
  automatically. Faithful but flaky and heavier than a 19-asset, rarely-rebaked
  set warrants.

Chosen path: **in-browser one-time bake** using the existing `VideoPreRenderer`
wholesale. It is pixel-identical (it *is* the live renderer), reuses existing
infra (no hand-rolling), bakes all assets from one click, and adds no
dependency. Precedent exists in `src/routes/test/card-back-capture/+page.svelte`,
which renders to blobs in-browser the same way.

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
2. Run `VideoPreRenderer` at 2× resolution (512×512), seamless loop (first
   frame == last frame), opaque (dark grid baked in).
3. Encode `{id}.webm` (VP9) and `{id}.mp4` (H.264 — required for iOS/Safari
   autoplay).
4. POST each blob to the dev write endpoint.

UI shows progress (`n / 19 baked`) and a preview grid so output is eyeballed
before commit. Content-hash dedup: configs that serialize identically share one
asset (Type1 #7 and #9 are byte-identical → 18 unique files from 19 instances).

### 3. Dev write endpoint — `+server.ts`

A dev-only `POST` handler that writes blobs to
`static/guide/level-1/motions/{id}.{webm,mp4}` via `fs.writeFile`. Guarded to
non-production (`import.meta.env.DEV`) so it never ships as a live write
surface. This is the bridge from browser blob to committed asset.

### 4. Runtime consumer — `GuideMotionVideo.svelte`

A dumb video element keyed by `id`:

```svelte
<video autoplay loop muted playsinline preload="metadata" aria-label={label}>
  <source src={`/guide/level-1/motions/${id}.webm`} type="video/webm" />
  <source src={`/guide/level-1/motions/${id}.mp4`} type="video/mp4" />
</video>
```

Square aspect ratio (`aspect-ratio: 1`), `loading` deferred below the fold.
Replaces all 19 `<GuideMotionDemo>` instances across the 8 section files —
each call site passes only `id` (and an `aria-label`/`alt` for accessibility).

`GuideMotionDemo.svelte` and its `AnimatorCanvas` usage are removed from the
guide entirely. The live builder logic is preserved only where the bake route
needs it (`buildGuideMotionSequence`).

## Data flow

```
guide-motion-configs.ts (19 configs, 18 unique)
        │
        ├──► bake route ──► VideoPreRenderer ──► blobs ──► POST ──► fs.writeFile
        │                                                          static/guide/level-1/motions/*.{webm,mp4}
        │
        └──► section files ──► <GuideMotionVideo id="…" /> ──► <video src="/guide/level-1/motions/{id}.webm">
```

The configs file is the shared contract. Bake produces assets keyed by `id`;
runtime reads assets by the same `id`. No drift possible — both sides import the
same array.

## Asset spec

- **Resolution:** 512×512 (2× the ~256px display ceiling; crisp on retina).
- **Formats:** VP9 webm (primary) + H.264 mp4 (iOS/Safari autoplay fallback).
  `MediaRecorder` mp4 output is browser-dependent (`VideoPreRenderer` falls back
  to webm when `MediaRecorder.isTypeSupported` rejects mp4). The bake route must
  guarantee an mp4 exists — if `MediaRecorder` won't emit it, transcode via the
  existing WebCodecs/Wasm encoder pipeline (`WebCodecsVideoEncoder` /
  `WasmVideoEncoder`). Exact mechanism is an implementation-plan detail.
- **Opaque:** dark grid + hand baked in; no alpha channel.
- **Loop:** one full animation cycle, first frame == last frame for a seamless
  seam. This is a quality gate verified visually on the bake route preview.
- **Budget:** short low-motion loops; expected ~100KB each, ~2MB total for 18
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

#7 and #9 serialize identically → 18 unique assets via content-hash dedup.

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

- Bake-route preview grid: all 18 assets render correct motion (shifts arc,
  dashes straight, statics hold) and loop seamlessly. Verified visually.
- Guide page after swap: `npm run check` clean; the page mounts no
  `AnimatorCanvas` (grep the guide tree for zero `AnimationPlaybackController` /
  `AnimatorCanvas` references); demos play instantly with no mount/unmount on
  scroll.
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
- `src/routes/(public)/guide/level-1/_components/guide-motion-configs.ts` — config array + `buildGuideMotionSequence` helper. (Grep found no existing guide-motion config module; configs are currently inline in section files.)
- `src/routes/(public)/guide/level-1/_components/GuideMotionVideo.svelte` — video consumer. (Grep found no existing `<video>`-loop primitive for guide demos.)
- `src/routes/test/guide-motion-bake/+page.svelte` — bake UI. (Follows the `card-back-capture` capture-route pattern.)
- `src/routes/test/guide-motion-bake/+server.ts` — dev-only write endpoint.
- `static/guide/level-1/motions/*.{webm,mp4}` — 18 baked assets (generated).

**Edit:**
- 8 section files in `_sections/ch10/` — swap `<GuideMotionDemo>` → `<GuideMotionVideo id="…">`.

**Remove from guide:**
- `GuideMotionDemo.svelte` — deleted once no section references it. The sequence
  builder logic it holds moves to `buildGuideMotionSequence` in the configs file.

## Reused infra (never-hand-roll justification)

- `VideoPreRenderer` — does the entire render→encode→blob pipeline. Reused as-is.
- `card-back-capture` route — the in-browser capture-to-blob pattern. Followed.
- `AnimatorCanvas` / animation services — invoked only inside `VideoPreRenderer`
  during bake; not re-implemented.
