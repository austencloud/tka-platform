# Echo → "Live Mandala" — Ground-Up Rethink

**Date:** 2026-06-28
**Status:** Approved (brainstorm: direction + trace style), ready for plan
**Supersedes:** the long-exposure-strobe direction (2026-06-27). That was still a
Trails variant — "show the past." This throws the concept out.

## Why the old Echo kept landing lame

Every prior Echo — phantoms, stroboscope, long-exposure — visualized *where the
prop was*. That is structurally a worse **Trails**: a tail of recent motion.
Trails owns that observable. No amount of bloom rescues a concept that's "a
chunkier trail." The fix is a different observable, not a nicer ghost.

## Concept

As the sequence plays, the prop tips draw their own **complete closed figure** in
light — the sequence's mandala. The curve traces in sync with playback
(progressive reveal). When the loop closes, it **blooms and locks** into the
finished, symmetric figure — held bright for a beat, then breathing gently.

Echo becomes "the sequence revealing its geometric soul." This is TKA's flagship
Sequence Mandala concept, but alive and in-animation.

## Unique slot (effects-earn-their-slot)

- **Uniquely visualizes:** the whole closed *periodic figure* the sequence
  traces, plus its completion + lock. Its geometric identity.
- **vs Trails:** Trails is a fading tail of recent motion — never the whole
  figure, never completes, never locks, no symmetry. **vs Bloom/Pulse:** live-tip
  halation / velocity shockwaves, no figure.
- **Test:** "It's a long trail" is false — a trail never closes into a held
  symmetric figure, and never draws the *distilled* mandala. The
  materialize-and-lock is Echo's alone.

## Key design decision — framed distilled figure, not a prop pixel-trace

`MandalaPathPreparer` scales the figure to **fill the frame** (standardized tip
dx=120, 5% pad, centered — `computeScale` in `mandala-path-preparer.ts`). So the
live mandala is the *iconic centered figure being born*, not a pixel-exact
overlay on the moving props. This is deliberate and better: a pixel-trace of the
tips would just look like a trail again. The mandala is the distilled artifact;
the props animate within/over it. Sidesteps mandala-space ↔ engine-space
alignment entirely. `progress` (playback position), not prop coordinates, drives
the reveal.

## Reuse map (~70% exists — never-hand-roll)

| Need | Reuse | Path |
|---|---|---|
| Tip-path figure from steps | `calculate(steps)` | `mandala/services/mandala-geometry-calculator.ts` |
| Path2D + measured length + fill-frame scale | `MandalaPathPreparer.prepare(steps, canvasSize, show)` (caches on `steps` ref) | `mandala/services/mandala-path-preparer.ts` |
| Progressive reveal | `setLineDash([progress×len, len])` technique | `mandala/services/mandala-overlay-canvas.ts` |
| Loop fade to 0 | `destination-out` + throttled `smoothAlphaDecay` | same + `TrailOverlayCanvas` |
| Loop detection + `seq.steps` + cacheKey + canvasSize | `FrameParameterBuilder` (already builds `fp.echoConfig`) | `animation-engine/services/frame-parameter-builder.ts` |
| Light styling (glow/gradient/overlap) | `renderMandalaToCanvas` patterns | `mandala/services/mandala-renderer.ts` |
| Effect plugin/overlay scaffolding | `EffectRenderer` base + `echoEffectPlugin` | built 2026-06-27 |

## Bridge architecture

Follows the existing `fp.echoConfig` pattern exactly:

1. **`FrameParameterBuilder`** owns a `MandalaPathPreparer` instance. When echo is
   enabled, each frame it: prepares paths from `seq.steps` (free after first call —
   preparer caches on `steps` ref), computes
   `progress = (currentStep mod totalSteps) / totalSteps`, derives `loopClosed`
   from the loop signal it already computes, and sets
   `fp.echoMandala = { preparedPaths, progress, loopClosed, currentStep, deltaTime }`.
   Null when echo disabled or steps unpreparable (non-motion sequence).
2. **`animation-render-loop.ts`** — the echo descriptor's `buildInput` changes from
   `{ emitters, currentStep }` to `ctx.params.echoMandala`. Echo stops consuming
   `buildEmitterTips`.
3. **`EchoOverlayRenderer.renderFrame(params, input)`** — drives the light-mandala
   renderer with the prepared input.

New input type `EchoMandalaInput` (replaces `EchoTipInput`):
`{ preparedPaths: PreparedMandalaPaths | null; progress: number; loopClosed: boolean; currentStep: number; deltaTime: number }`.

## The renderer (light-mandala)

Rewrite `Echo2DRenderer`. The revealed figure is a pure function of `progress`,
so **clear + redraw fresh each frame** (no reveal accumulation buffer needed):

1. Clear visible ctx. Bail if no `preparedPaths` (and not mid-lock-flash).
2. `displayProgress` = `loopClosed/locked ? 1 : progress`.
3. `translate(width/2, height/2)`, `scale(preparedPaths.scale)`.
4. Per path: `setLineDash([displayProgress×len, len])`, stroke as **light** —
   additive (`lighter`): colored body with `shadowBlur` bloom (`glow`) + a
   white-hot core pass (`depth` = core hotness). Blue + red drawn additively;
   overlap brightens naturally (the "purple" glow).
5. **Lock moment** — on `loopClosed` false→true: start a flash timer; draw an
   expanding bloom-pop + brightness boost (`flash`) that decays over ~1 beat, then
   **hold** the full figure for `decay` beats, then a gentle breathing alpha pulse.
6. **Symmetry glow** (`streak` repurposed) — on lock, a soft mirror-glow pass
   keyed to the figure's symmetry (cheap: re-stroke the figure flipped, low alpha).
   `0` = off.

Small renderer state: `prevLoopClosed`, `lockFlashTimer`, `holdTimer`. Uses
`deltaTime`. `reset()`/`dispose()` clear it. Seeks handled by `progress` jumping
(deterministic redraw — no stale content).

## Param model — repurpose `EchoIntent` (no field add/remove; stable type)

| Field | New meaning |
|---|---|
| `intensity` | mandala brightness / composite alpha |
| `glow` | bloom amount (shadowBlur) |
| `thickness` | stroke width |
| `colorMode` | `prop-matched` (blue/red/purple — **new default**), `solid`, `rainbow`, `gradient` |
| `color` | solid tint |
| `flash` | lock-flash brightness on loop close |
| `decay` | hold length (beats) of the locked figure before breathing fade |
| `depth` | white-hot core intensity |
| `streak` | symmetry mirror-glow on lock (0 = off) |
| `interval` | unused by the mandala; hidden from controls (kept in type for config stability) |

Default `colorMode` flips `solid` → `prop-matched`. Other defaults keep their
numbers (still sensible). Bump `EFFECTS_CONFIG_VERSION` 25 → 26 (provenance; no
field mutation, merge handles nothing new). Drop `interval` from the echo control
manifest + customize panel; keep the field in the type.

## Files

**Modify:**
- `effects/renderers/echo-2d-renderer.ts` — rewrite to the light-mandala renderer
  (`EchoMandalaInput`, progressive reveal, lock moment, symmetry glow).
- `effects/renderers/echo-2d-renderer.test.ts` — rewrite: progress→setLineDash,
  locked→progress=1, lock-flash triggers on loopClosed transition, per-path stroke.
- `animation-engine/services/echo-overlay-renderer.ts` — pass `EchoMandalaInput`
  through; drop the accumulator (the renderer redraws fresh).
- `animation-engine/services/frame-parameter-builder.ts` — own a
  `MandalaPathPreparer`; build `fp.echoMandala`.
- `animation-engine/services/animation-render-loop.ts` — echo descriptor
  `buildInput` → `ctx.params.echoMandala`.
- `animation-engine/services/<RenderFrameParams type>` — add `echoMandala` field.
- `effects/translators/canvas2d-types.ts` — no change (`Echo2DParams` unchanged).
- `effects/domain/effects-config.ts` — re-doc EchoIntent semantics; bump version 26.
- `effects/domain/defaults.ts` — `echo.colorMode: "prop-matched"`.
- `effects/domain/migrations.ts` — v25→v26 comment.
- `effects/domain/effect-control-manifest.ts` — drop `interval`; relabel
  decay→"Hold", flash→"Lock", depth→"Core", streak→"Symmetry".
- `effects-panel/customize/EchoCustomize.svelte` — match the relabeled controls.
- `effects-panel/presets/echo-presets.ts` — re-tune for the mandala model.

**Reuse unchanged:** all of `src/lib/shared/mandala/services/*`.

## Migration (v25 → v26)

No field add/remove. Default `colorMode` flips to `prop-matched`; a persisted
`solid` (the prior default) is the old default echoing back — remap to
`prop-matched` only when it equals the old default (same pattern as the v17 bloom
/ v20 pulse remaps), leaving deliberate `solid` choices alone. Bump version.

## Testing

Renderer unit tests (node, mock ctx with `setLineDash`/`stroke` spies, fake
`preparedPaths`):
- `setLineDash([progress×len, len])` per path; stroke called per path.
- `progress` clamped [0,1]; `loopClosed` forces displayProgress = 1.
- lock-flash fires once on `loopClosed` false→true (not while already locked).
- `streak===0` → no symmetry pass; `streak>0` → extra stroke pass on lock.
- null `preparedPaths` → no draw, no throw.
- `reset()`/`dispose()` clear lock state.

Bridge: `FrameParameterBuilder` builds `fp.echoMandala` (preparer cache hit on
stable `steps`; progress wraps with `currentStep`). Verify via existing FPB test
harness if present, else a focused unit test.

## Verification

- `npx vitest run echo-2d-renderer` + FPB tests green.
- One full `npm run check` at the gate.
- Visual: can't self-verify without the browser. Give the live route
  (effect-tuner / a real LOOP in the viewer with Echo on), ask Austen to eyeball,
  or DevTools screenshot with permission. No "should look great."

## Out of scope (follow-up)

- WebGL 3D echo parity.
- True purple-overlap masking (additive `lighter` approximates it; the static
  `renderMandalaToCanvas` mask path is the upgrade if needed).
- Head-of-reveal comet glow (would need the preparer to retain `d` /
  `getPointAtLength`; deferred to keep the preparer untouched).
