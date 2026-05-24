# QR Scan Page: Live 2D Animation

**Date:** 2026-05-24
**Status:** Draft
**Replaces:** MP4 web worker rendering pipeline

## Problem

The QR scan page (`/q/[code]`) renders sequences by spawning a web worker that
precomputes animation frames, encodes them as MP4, then plays the video. This
creates a 10-30 second render wait on first scan, requires R2 infrastructure for
caching, and produces approximated effects that don't match the production
renderer. On poor networks the MP4 download (~500KB-2MB) is slower than the
live alternative.

## Decision

Replace the MP4 worker pipeline with a lazy-loaded `AnimationPlayer` component
that plays live 2D Canvas animation using the production animation engine. The
same renderer that powers the sequence viewer — accurate effects, prop switching,
tempo control — all for ~100KB of browser-cacheable JS + SVG assets.

## Architecture

### Flow

```
BEFORE: shortcode → hydrate → R2 HEAD → cache miss → spawn worker
        → precompute frames → render MP4 → play <video>

AFTER:  shortcode → hydrate → lazy-load AnimationPlayer → play live animation
```

### Component Stack

```
/q/[code]/+page.svelte
  └─ AnimationPlayer (lazy-loaded via dynamic import)
       ├─ AnimatorCanvas (production 2D renderer)
       │    ├─ AnimationEngine (orchestration)
       │    ├─ Canvas2DAnimationRenderer (drawing)
       │    └─ Effect renderers (trails, bloom, fire, etc.)
       └─ Playback controller (play/pause/speed/step)
```

`AnimationPlayer` is the existing component at
`src/lib/shared/sequence-viewer/components/AnimationPlayer.svelte`. It handles:
- Service initialization (playback controller, motion loader)
- Sequence loading + motion data hydration
- BPM → speed conversion
- Step progression
- Canvas setup

The QR page wraps it with its own UI (prop picker, effect picker, tempo
control, scrubber bar, download button, TKAWordGlyph title).

### Lazy Loading

```typescript
const AnimationPlayer = (await import(
  "$lib/shared/sequence-viewer/components/AnimationPlayer.svelte"
)).default;
```

The import runs after shortcode resolution succeeds. During shortcode
resolution, the page shows its existing loading spinner. Once the sequence
resolves AND the component loads (parallel), playback begins.

### Prop / Effect Switching

**Props:** Pass `bluePropType` and `redPropType` props to AnimationPlayer.
When the user selects a new prop from the picker, update these reactive props.
AnimationPlayer and AnimatorCanvas handle the rest — texture reload, re-render.
No worker spawn, no re-encoding.

**Effects:** The QR page creates its own `EffectsConfigState` and provides it
via context or prop to AnimatorCanvas. When the user picks a different effect
from the overlay, update the config state. The engine picks up the change on
the next frame.

### Tempo / Scrubber

- Tempo: `handleBpmChange` on AnimationPlayer already converts BPM to speed
- Scrubber: Use `onControllerReady` callback to get a reference to the
  `AnimationPlaybackController`. Bind scrubber position to
  `animState.currentStep`. Seek via `controller.seekToStep()`.
- Play/pause: Use `onTogglePlaybackRef` callback for the play button.

### Download

The download button triggers the normal export flow:
1. User taps Download
2. Lazy-load the export orchestrator
3. Render the current sequence + prop + effect combo to MP4 using the
   standard `VideoExportOrchestrator` path
4. Trigger browser download of the resulting file

This is the same flow used by "Download Animation" in the sequence viewer.
Renders with accurate effects since it uses the production renderer.

## What Gets Removed

| File / concept | Action |
|---|---|
| `HeadlessAnimationOrchestrator` usage in QR page | Remove from +page.svelte |
| `precomputeFrames()` function | Remove from +page.svelte |
| Worker spawn logic (`spawnWorker()`) | Remove from +page.svelte |
| `headless-video-renderer.worker.ts` import | Remove from +page.svelte |
| `WorkerAssetLoader.ts` imports (`loadAssets`, `loadLetterGlyphs`) | Remove from +page.svelte |
| R2 cache check (`checkR2Cache`, `computeHash`, `videoUrl`) | Remove from +page.svelte |
| R2 upload (`uploadToR2`) | Remove from +page.svelte |
| `<video>` element + video playback state | Remove from +page.svelte |
| `bgRenderPercent`/`bgRenderPhase` background render state | Remove from +page.svelte |
| `/api/qr-video/[hash]/+server.ts` | Keep for now (may be useful for pre-rendered social previews) |

The worker files themselves (`HeadlessAnimationOrchestrator`,
`headless-video-renderer.worker.ts`, `WorkerAssetLoader.ts`) remain in the
codebase — they're used by other features (compose module video export).

## What Stays

- Shortcode resolution + hydration (`ShortCodeManager`, `hydrateSequence`)
- GlyphCache initialization (for TKAWordGlyph title)
- TKAWordGlyph word title
- Tempo control component
- Prop picker overlay
- Effect picker overlay
- Scrubber bar (re-wired to animation engine)
- Download button (re-wired to export flow)
- Analytics capture
- OG meta tags
- Error state handling

## Page States

```
loading    → resolving shortcode + lazy-loading AnimationPlayer
error      → shortcode not found / hydration failed
playing    → AnimationPlayer mounted and playing
```

The "rendering" state is eliminated — there is no render wait.

## Bundle Impact

| Asset | Size (estimated) | Cached |
|---|---|---|
| AnimationPlayer + AnimatorCanvas + AnimationEngine | ~80-120KB gzipped | Yes (immutable hash) |
| Effect renderers (all 16) | ~40-60KB gzipped | Yes |
| Prop/grid SVGs | ~20-30KB | Yes |
| GlyphCache letter SVGs | ~15-20KB | Yes |
| **Total first load** | **~155-230KB** | |
| **Repeat visits** | **~0KB** (browser cache) | |

vs. current MP4 approach: ~500KB-2MB per video, not browser-cacheable across
different sequences.

## Success Criteria

1. QR scan → animation playing in < 3 seconds on 4G
2. Prop switching is instantaneous (no render wait)
3. Effects match what users see in the main app
4. Download produces an MP4 with correct effects
5. Scrubber, tempo, play/pause all work
6. No Three.js or 3D code in the dependency chain
