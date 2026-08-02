# Echo → "Long-Exposure Strobe" — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorm), ready for plan
**Scope:** Canvas2D `echo` effect. WebGL 3D echo parity is an explicit follow-up.

## Problem

Echo today is a beat-onset stroboscope: on each beat it snapshots the staff's
tip-pair into a phantom, ages the phantoms, and renders them as fading glowing
line-ghosts. The renderer **clears the canvas every frame and recomputes all
phantoms from a capped ring buffer**.

Austen's verdict: lame. Diagnosis (confirmed with him): "looks cheap / static"
+ "underwhelming vs real strobe photography." Not "concept boring," not
"overlaps Trails." So the **concept is good** (beat-frozen prop = visual strobe);
the **rendering** doesn't reach the bar. Real strobe photography of an LED staff
is gorgeous because the flash freezes crisp prop clones *and the long exposure
bakes them all into one image*. Echo does the freeze but throws the exposure
away every frame — the root cause of the cheap blink.

## Unique slot (effects-earn-their-slot)

- **Uniquely visualizes:** where the prop *was* on every beat, all at once — one
  staff frozen as a march of crisp light-painted bodies baked into a single long
  exposure. Reveals the rhythmic/spatial skeleton of the choreography.
- **Confused with:** Trails (continuous Catmull-Rom ribbon of *one tip point*,
  no bodies, no rhythm) and Bloom (live-tip halation, no persistence, no clones).
- **Mechanical distinction:** Echo stamps the *whole staff body*, beat-locked,
  into a persistent accumulation buffer that fades over the exposure window.
  Trails draws a continuous fading spline of a single tip point. Bloom glows live
  tips only.
- **Uniqueness test:** "It's Trails with blinking" is false — Trails has no
  frozen bodies and no beat-discreteness. The beat-locked clone-march is Echo's
  and only Echo's.

## Architecture: clear-every-frame → accumulation buffer

Mirror the shipped `TrailOverlayCanvas` accumulation pattern (reuse, not
hand-roll: `destination-out` fade + throttled `smoothAlphaDecay` + `drawImage`
composite). Responsibilities split cleanly:

### `EchoOverlayRenderer` (owns persistence)
Extends `EffectRenderer`, already has `width`/`height`/`scale`/visible `ctx`.
New responsibilities each `renderFrame(params, tips)`:
1. **Loop detect** — if `currentStep` jumps backward past `LOOP_THRESHOLD`,
   clear the accumulator and call `renderer.reset()`.
2. **Fade** the offscreen accumulator (`destination-out`, amount derived from
   `decay` + per-frame `Δstep` + `depth`; see Fade math).
3. **Throttled `smoothAlphaDecay`** on the accumulator (every N frames) so
   stamps fade fully to 0 despite 8-bit rounding — lifted from `TrailOverlayCanvas`.
4. `renderer.render(accumulatorCtx, params, tips, scale)` — stamps clones +
   streak **only on beat-onset**; no-op on non-beat frames.
5. Clear the visible `ctx`; `globalAlpha = intensity`; `drawImage(accumulator)`.

Owns one `OffscreenCanvas` accumulator (created in `onInitialized`, resized in
`resize`, cleared in `onClear`, freed in `onDispose`). Browser-only — never
constructed in the node unit-test path (the renderer is unit-tested in isolation;
the overlay is not).

### `Echo2DRenderer` (owns the stamp)
Rewritten. Per `render(targetCtx, params, tips, scale)`:
- **Beat-onset detection** — unchanged math: `floor(currentStep / interval)`
  advancing is the onset. Group emitters into per-`propIndex` (A,B) pairs.
- On onset, for each pair, **stamp a crisp clone** into `targetCtx` (additive
  `lighter`): luminous staff bar (white-hot core + colored body + bloom halo via
  `shadowBlur`) and/or radiant tip orbs, per `shape`.
- **Faint body-to-body streak** — from the pair's previous clone position (kept
  per `propIndex` in `lastClonePos`) to the new one, velocity-aware, dim, gated
  by the new `streak` param. `streak === 0` → pure stamps.
- **Flash** — the bright expanding capture pop, stamped at the clone midpoint,
  gated by `flash`.
- Keep cross-frame state only: `lastStepIndex`, `previousStep`, `prevTips`
  (per-end velocity), `lastClonePos` (per propIndex, for the streak). No growing
  phantom array, no `MAX_PHANTOMS` cap — the accumulator IS the history. This is
  also a perf win (stamp on beats only vs redraw N phantoms every frame).
- Self-detect loop (reset internal state) so the renderer stays self-contained
  and unit-testable across a backward `currentStep` jump; the overlay also
  detects to clear the accumulator.

## Param model

`EchoIntent` keeps every existing field; one net-new field. Range/UI unchanged
except the new slider.

| Field | Before | After (accumulation model) |
|---|---|---|
| `intensity` | phantom peak alpha | exposure composite alpha (`drawImage` globalAlpha) |
| `decay` (1–8 beats) | beats before a phantom is culled | **exposure length** — beats before a stamp fades to ~0 |
| `interval` (0.25–2 beats) | capture interval | unchanged (strobe rate) |
| `shape` staff/tips/both | which to draw | unchanged |
| `colorMode` | per-phantom | unchanged; `gradient` keys off **capture-beat** (color bakes at stamp time, can't change post-bake) |
| `color` | solid tint | unchanged |
| `thickness` (1–8) | stroke / dot px | unchanged |
| `glow` (0–1) | shadowBlur halo | unchanged (bloom on clone + orbs) |
| `depth` (0–1) | older phantoms shrink+blur | **exposure falloff steepness** — higher = older stamps recede (dim) faster. Can't shrink baked pixels; expresses recede via fade curve. |
| `flash` (0–1) | capture pop | unchanged |
| **`streak` (0–1) NEW** | — | connective body-to-body thread strength. Default **0.35**. 0 = pure stamps. |

`Echo2DParams` already extends `EchoIntent`, so `streak` flows through
`resolveEcho2D` (pure spread) with no translator change.

## Fade math

Per-frame `Δstep = currentStep − previousStep` (fractional beats). Want a stamp
to retain `TARGET_REMAINING` (≈0.04) of its alpha after `decay` beats,
frame-rate independent:

```
perFrameRemaining = TARGET_REMAINING ^ (Δstep / decay)
fadeAmount        = 1 − perFrameRemaining        // destination-out alpha
```

`depth` biases the tail: fold a `depth`-scaled term into the throttled
`smoothAlphaDecay` subtractive step so older/dimmer pixels die faster at higher
depth (the "recede" cue, expressed temporally rather than by shrinking baked
pixels). `Δstep ≤ 0` (paused/seek-back) skips the fade so a paused exposure
holds.

## Clone rendering detail

- **Staff bar:** `lineWidth = thickness * scale * recede`; additive; colored body
  stroke with `shadowBlur = glow * thickness * k`; a thinner white-hot core
  stroke on top for the fresh stamp. (Reuses the current `orb`/`drawPhantom`
  light-painting techniques, stamped once instead of redrawn aging.)
- **Tip orbs:** radial gradient white→color→transparent (kept from current impl).
- **Streak:** for each end, a dim stroke from `lastClonePos` end to the new end,
  alpha `= streak * STREAK_BASE`, width `< body width`, velocity-aware curve
  (offset by the frozen per-end velocity so it leans the way the prop moved).
  Distinct from Trails: faint, body-to-body, beat-gated, additive — not a bright
  tapered tip ribbon.
- **Flash:** expanding additive radial pop at the staff midpoint, alpha `flash`.

## Files

**Modify:**
- `src/lib/shared/effects/renderers/echo-2d-renderer.ts` — rewrite to the stamp
  model (beat-onset stamp + streak + flash; drop phantom ring buffer; add
  `lastClonePos`, `reset()`).
- `src/lib/shared/animation-engine/services/echo-overlay-renderer.ts` — own the
  OffscreenCanvas accumulator; fade + smoothAlphaDecay + composite; loop clear.
- `src/lib/shared/effects/domain/effects-config.ts` — add `streak` to
  `EchoIntent`; bump `EFFECTS_CONFIG_VERSION` 24 → 25; rewrite `decay`/`depth`/
  `colorMode.gradient` JSDoc to the accumulation semantics.
- `src/lib/shared/effects/domain/defaults.ts` — `echo.streak: 0.35`.
- `src/lib/shared/effects/domain/migrations.ts` — v24→v25 comment (net-new
  `streak` resolves via the catch-all merge; no field mutation).
- `src/lib/shared/effects/domain/effect-control-manifest.ts` — add
  `slider("echo", "streak", "Streak", { tier: "advanced" })` (mirror Bloom).
- `src/lib/shared/animation-engine/components/effects-panel/customize/EchoCustomize.svelte`
  — add the Streak slider.
- `src/lib/shared/animation-engine/components/effects-panel/presets/echo-presets.ts`
  — re-tune the 4 presets for the exposure model + a `streak` per preset.
- `src/lib/shared/effects/renderers/echo-2d-renderer.test.ts` — rewrite to the
  stamp model (assert beat-onset stamping, no-op off-beat, loop reset, streak
  draw when `streak>0`, shape gating, `reset()`/`dispose()`).

**No change:** `canvas2d-translator.ts` (`streak` flows via the existing
`resolveEcho2D` spread), `canvas2d-types.ts` (`Echo2DParams` inherits `streak`),
`frame-parameter-builder.ts` (`EchoTipInput` contract unchanged).

## Migration (v24 → v25)

`streak` is net-new; absent values resolve to `DEFAULT_EFFECTS_CONFIG.echo.streak`
(0.35) via the existing `echo: { ...DEFAULT, ...input.echo }` merge — same pattern
as the v18→v19 echo glow/depth/flash add and the v20→v21 petals add. `decay`/
`depth` keep their stored numeric values; only the renderer's interpretation
changes, so no field mutation. Add the documenting comment; bump the version.

## Testing

Renderer unit tests (node, hand-built mock ctx — no DOM, no OffscreenCanvas), so
all accumulation lives in the overlay and the renderer is tested in isolation:
- Stamps on beat-onset (`moveTo`/`lineTo`/`stroke` for staff, `arc`/`fill` for
  tips), no-op when `currentStep` stays in the same beat cell.
- New stamp at the next beat boundary; both blue+red and tunnel-layer
  (`propIndex≥2`) pairs stamped at the same beat.
- `streak>0` draws the connective thread (extra stroke once a prior clone exists);
  `streak===0` draws none.
- Shape gating: `staff` strokes + no arcs; `tips` arcs + no strokes.
- `reset()` / loop (`currentStep` jumps backward) clears `lastClonePos` +
  `lastStepIndex`; `dispose()` clears state.
- `scale` propagates to `lineWidth`.

## Verification

- `npx vitest run echo-2d-renderer` green.
- One full `npm run check` at the gate (no inner-loop builds per
  `fast-iteration-loop`).
- Visual: cannot self-verify without the browser. Will provide the live route
  and ask Austen to eyeball, or screenshot via DevTools MCP only with explicit
  permission (per `browser-verification`). State this honestly — no "should look
  great now."

## Out of scope (follow-up)

WebGL 3D echo path (`webgl3d-translator.ts` + its overlay) keeps the old look
until a parity pass. Flag the mismatch; don't silently leave it.
