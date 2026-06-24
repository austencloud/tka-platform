# Silk Serpent Form — Design Spec

**Date:** 2026-06-24
**Status:** Approved, implementing
**Author:** Claude (Opus 4.8) + Austen

## Summary

Add a **serpent form** to the existing Silk 2D effect: the prop tip becomes the
**head** of a fixed-length living creature whose body trails and **undulates**, a
wagging tail behind it. Two new presets — **Serpent** and **Dragon** — flip it
on. Snake is a clean undulating creature with eyes + a flicking forked tongue;
Dragon adds a dorsal spike crest, swept-back horns, and trailing whiskers.

This is a new **form** of the existing Silk slot, not a new effect slot. It
reuses Silk's palettes, multi-layer painterly fill, per-tip emitter loop, and
tracking modes.

## Unique observable (effects-earn-their-slot check)

Silk-ribbon visualizes *the recent velocity path as a fading taut ribbon*.
Silk-serpent visualizes *the prop tip as the head of a fixed-length creature
whose body follows the head's path and undulates with its own life*. The
fixed-length follow-the-leader body + active slither + head/face is mechanically
distinct from every trailing effect (Trails = point trail, Echo = strobed
phantoms, ribbon Silk = lifetime fade). It does not read as a tweak of any
existing look.

## Backward compatibility

`form` defaults to `"ribbon"`. The config migration already deep-merges
`silk: { ...DEFAULT_EFFECTS_CONFIG.silk, ...(input.silk ?? {}) }`, so every
persisted `tka_effects_config` and all 6 existing silk presets keep `form:
"ribbon"` for free — only the default object + the version bump are needed, no
mutation code. Existing ribbon rendering path is left untouched.

## New SilkIntent fields

```ts
export interface SilkIntent {
  // ...existing: intensity, width, duration, flutter, tautness, palette,
  //              customColor, trackingMode...

  /** Render mode. "ribbon" = the velocity ribbon (default, unchanged).
   *  "serpent" = fixed-length creature whose head is the prop tip. */
  form: "ribbon" | "serpent";
  /** Serpent ornamentation. snake = eyes + flicking tongue.
   *  dragon = + dorsal spikes, horns, whiskers. Only used when form="serpent". */
  creature: "snake" | "dragon";
  /** 0-1. Fixed body length. Maps to ~120-480px arc-length. Serpent only. */
  bodyLength: number;
  /** 0-1. Undulation amplitude (the wag). Ramps 0 at head -> max at tail. */
  slither: number;
}
```

`duration` / `tautness` / `flutter` stay ribbon-only (ignored in serpent mode).
`intensity` (opacity + width mult), `width` (base half-width), `palette` /
`customColor`, and `trackingMode` are shared by both forms.

Defaults (`defaults.ts`, `DEFAULT_EFFECTS_CONFIG.silk`):
`form: "ribbon"`, `creature: "snake"`, `bodyLength: 0.5`, `slither: 0.5`.

## Derived params (Silk2DParams, from resolveSilk2D)

```ts
bodyLengthPx: 120 + intent.bodyLength * 360, // 120-480px total spine length
segmentCount: 40,                            // chain nodes
slitherAmpPx: intent.slither * 42,           // max lateral wave amplitude (px)
```

## Renderer — serpent geometry (silk-2d-renderer.ts)

`render()` branches on `params.form`. `"ribbon"` keeps the existing
`tipTrails` + `drawRibbon` path verbatim. `"serpent"` uses a separate per-tip
state map of spine nodes and a new `drawSerpent` path.

### Follow-the-leader chain (fixed length)

Per tracked emitter keep `Vec2[] nodes` of length `segmentCount`. Each frame:

1. `nodes[0] = { head tip x, y }`.
2. For `i = 1..N-1`: pull `nodes[i]` toward `nodes[i-1]` to hold a fixed
   `segLen = bodyLengthPx / (N-1)`:
   `nodes[i] = nodes[i-1] + normalize(nodes[i] - nodes[i-1]) * segLen`.
3. On `loopDetected` (tip teleports at loop seam): snap the whole chain straight
   behind the head along its heading so there's no whip across the seam.
4. First frame / newly-present emitter: initialize all nodes at the head pos.

Total length is always `(N-1)·segLen` — holds even when the prop is still. This
is the standard distance-constraint chain (snake-game / FABRIK-lite).

### Slither (render-time, not in chain state)

Applied when building the render centerline so it never destabilizes the
constraint and the head stays locked to the prop tip:

```
center[i] = nodes[i] + perp[i] * slitherAmpPx
                       * sin(WAVENUMBER * s[i] - SLITHER_SPEED * time)
                       * tailRamp(i)
```

- `s[i]` = cumulative arc-length along the chain.
- `perp[i]` = unit normal to the local tangent.
- `tailRamp(i) = (i/(N-1))^1.3` -> 0 at head (head pinned to prop), max at tail.
- Constants tuned in-renderer: `WAVENUMBER ≈ 0.045`, `SLITHER_SPEED ≈ 3.2`.

### Width profile + fill

`halfWidth[i] = baseHalfWidth * scale * intensity * profile(u)` where
`u = i/(N-1)`:
- snout ramp: `u in [0, 0.06]` width `0.35 -> 1.0`
- neck->tail taper: `u in [0.06, 1]` smoothstep `1.0 -> 0` (point tail).

Edges are built from `center[i] ± perp[i]*halfWidth[i]`, then fed through the
**existing** Catmull-Rom `traceForward`/`traceBackward` + 4-layer painterly fill
(aura glow for emissive palettes, underpaint, body fill, sheen highlight). Body
alpha uses a flat `intensity` (no lifetime fade — the body is solid).

### Head + face (characterful)

At `nodes[0]`, oriented along heading `nodes[0]-nodes[1]`:
- Rounded head: filled ellipse ~`1.5 * neckHalfWidth`, palette `edge` color.
- Eyes: two filled dots offset ±perp and forward; dark pupil + white catch-light.
- Tongue (snake only): thin forked line from the snout. Flick timer — every
  ~3s, a ~0.4s extend/retract via a smooth pulse. Pink/red.

### Dragon ornaments (creature === "dragon")

Same spine + width, extra passes:
- **Dorsal crest:** sawtooth spikes on one perpendicular side every ~3 nodes,
  spike height ∝ `halfWidth[i]`.
- **Horns:** two swept-back lines from the head, ~`1.6 * headRadius`.
- **Whiskers:** two thin trailing lines from the snout, each a short 6-node lag
  sub-chain following the snout with delay (Eastern flow). Ember = fire dragon,
  ethereal = spirit dragon.

### Tracking

Serpent honors `trackingMode` via the existing `isEndEnabled` filter. Single end
= one snake; `both_ends` = twin serpents (falls out of the per-emitter loop).
"Head at the prop head" = whichever tracked end.

## Presets (silk-presets.ts)

Add before `silk-custom`:

```ts
{
  id: "silk-serpent", name: "Serpent", previewColor: "#3aa655",
  patch: { form: "serpent", creature: "snake", palette: "velvet",
           intensity: 0.85, width: 0.55, bodyLength: 0.55, slither: 0.55,
           trackingMode: "right_end" },
},
{
  id: "silk-dragon", name: "Dragon", previewColor: "#ff6000", previewColor2: "#ffcc00",
  patch: { form: "serpent", creature: "dragon", palette: "ember",
           intensity: 0.9, width: 0.6, bodyLength: 0.7, slither: 0.45,
           trackingMode: "right_end" },
},
```

The 6 existing ribbon presets are unchanged; they inherit `form: "ribbon"` from
the default merge (their patches don't set `form`).

## UI controls (effect-control-manifest.ts)

Silk control block gains, gated by `showWhen: i => i.form === "serpent"` for the
serpent-only ones:

```ts
{ id: "silk-form", label: "Form", type: "segmented", field: "form",
  options: [{value:"ribbon",label:"Ribbon"},{value:"serpent",label:"Serpent"}],
  tier: "primary" },
{ id: "silk-creature", label: "Creature", type: "segmented", field: "creature",
  options: [{value:"snake",label:"Snake"},{value:"dragon",label:"Dragon"}],
  tier: "primary", showWhen: isSerpent },
slider("silk", "bodyLength", "Length", { tier: "advanced", showWhen: isSerpent }),
slider("silk", "slither", "Slither", { tier: "advanced", showWhen: isSerpent }),
```

`SilkCustomize.svelte` surfaces the same Form/Creature segmented + Length/Slither
sliders (shown when `form === "serpent"`).

## Files touched

1. `effects-config.ts` — 4 fields on `SilkIntent`.
2. `defaults.ts` — `DEFAULT_EFFECTS_CONFIG.silk` defaults + a v→v+1 note.
3. `effects-config.ts` `EFFECTS_CONFIG_VERSION` — bump (+ migration comment).
4. `canvas2d-types.ts` — `Silk2DParams` gains `bodyLengthPx`, `segmentCount`, `slitherAmpPx`.
5. `canvas2d-translator.ts` `resolveSilk2D` — map new fields.
6. `silk-2d-renderer.ts` — `render()` form branch + serpent chain/slither/head/dragon methods; `drawRibbon` untouched.
7. `silk-presets.ts` — `silk-serpent` + `silk-dragon`.
8. `effect-control-manifest.ts` — Form/Creature segmented + Length/Slither sliders.
9. `SilkCustomize.svelte` — serpent controls.

## Verification

Mount Silk in the 2D viewer test route with a sequence, select Serpent then
Dragon. Confirm: fixed length holds when paused; tail wags at rest; head leads on
motion and stays pinned to the prop tip; dragon spikes/horns/whiskers render;
existing ribbon presets unchanged; `npm run check` green.
