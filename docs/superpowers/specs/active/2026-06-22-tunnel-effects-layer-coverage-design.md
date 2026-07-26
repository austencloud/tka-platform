---
status: active
value: 3
effort: M
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Tunnel Effects — Layer Coverage Design

**Date:** 2026-06-22
**Status:** Active
**Scope:** Extend the 10 particle/stroke effects to render on tunnel kaleidoscope layer props (propIndex ≥ 2), matching the coverage bloom + pulse already have.

## Problem

The tunnel kaleidoscope builds `additionalLayers` (rotated/mirrored prop copies). The tip trackers (fire, LED) already emit tips for every layer prop. **bloom** and **pulse** render on all of them because they consume `buildArrayTips` — a flat array of every matching tip including layers.

The other 10 effects — **zap, sparkles, echo, water, bubbles, petals, smoke, ink, frost, silk** — consume `buildFourPosTips`, which hard-collapses to 4 fixed slots (`bluePosA/B`, `redPosA/B`) and only reads `propIndex 0` (blue) and `propIndex 1` (red). Every layer tip is dropped. So those effects show only on the two base props, never on the kaleidoscope copies.

## Ground truth (verified)

- `animation-render-loop.ts`
  - `buildFourPosTips` (lines ~397-420): collapses to 4 slots, propIndex 0/1 only.
  - `buildArrayTips` (lines ~426-482): flat `{x,y,propIndex,tipIndex,blueColor,redColor}[]` + center fallback; bloom/pulse use it; covers layers.
  - `EffectDispatchContext.params: RenderFrameParams` exposes everything the new builder needs:
    - `params.props.additionalLayers.length` → **layerCount**
    - `params.props.tunnelSpectrum` → **spectrum** flag
    - `params.trailSettings.blueColor` / `.redColor` → **base colors**
  - `sharedTips: PropTipData[]` already contains layer tips (propIndex ≥ 2).
- `tunnel-prop-colors.ts` → `tunnelPropColor(propIndex, layerCount).hex`. Even propIndex = blue family, odd = red. base 0/1; layer li → blue `2+2li`, red `3+2li`.
- Per-renderer state today is keyed by a fixed `TipKey = "bluePosA"|"bluePosB"|"redPosA"|"redPosB"` union. Every renderer also has a per-frame pool cap already (water 1024, bubbles 1024, petals 2048, frost ~6144, sparkles 1500, zap MAX_SPARKS 400, silk MAX_SAMPLES 300, echo MAX_PHANTOMS 200). The pool cap is **shared across all emitters** — adding layer emitters fills the same pool faster, so "full density + soft cap" needs no new pool code.

## Two structural categories

**A. Independent per-tip spawners (8):** water, bubbles, petals, smoke, ink, frost, sparkles, silk.
Each spawns particles from each tip independently and keys per-tip velocity/trail state by `TipKey`. Palette-driven — they ignore prop color (use `resolvedPalette` / `colorMode` solid/rainbow/palette). Uniform transform.

**B. Pair-based (2):** echo, zap.
- **echo** captures each prop's **(A,B) pair** as one phantom and draws the staff line A→B; phantoms are split into `phantomsBlue` / `phantomsRed`, colored by `tips.blueColor` / `tips.redColor` (`colorMode === "prop-matched"`). Needs per-prop pairs + per-prop color.
- **zap** arcs bolts between blue↔red **pairs** (`[bluePosA,redPosA]`, `[bluePosB,redPosB]`) and has a `web` style meshing all visible tips. Relational between families.

## The contract

New shared type + builder, additive (do not touch `buildFourPosTips`/`buildArrayTips`/bloom/pulse):

```ts
// effects/renderers/emitter-tip.ts
export interface EmitterTip {
  x: number;
  y: number;
  /** base blue=0, red=1; layer li blue=2+2li, red=3+2li. */
  propIndex: number;
  /** 0 = end A, 1 = end B. */
  tipIndex: number;
  /** Derived from tipIndex: 0→"A", else "B". For tracking-mode filtering. */
  end: "A" | "B";
  /** Per-prop resolved color (hex). Consumed only by prop-colored effects
   *  (echo, zap web same-prop). Mirrors the trail-overlay spectrum gating. */
  color: string;
}
```

```ts
// animation-render-loop.ts — new static builder
private static buildEmitterTips(
  tips: PropTipData[],
  tipMap: TipEffectMap,
  effect: EffectType,
  params: RenderFrameParams,
): EmitterTip[] {
  const layerCount = params.props.additionalLayers.length;
  const spectrum = params.props.tunnelSpectrum ?? true;
  const baseBlue = params.trailSettings.blueColor;
  const baseRed = params.trailSettings.redColor;
  const out: EmitterTip[] = [];
  for (const t of tips) {
    if (resolveEffect(t.propIndex, t.tipIndex, tipMap, {}) !== effect) continue;
    const isBlue = t.propIndex % 2 === 0;
    const color =
      t.propIndex <= 1
        ? (isBlue ? baseBlue : baseRed)
        : spectrum
          ? tunnelPropColor(t.propIndex, layerCount).hex
          : (isBlue ? baseBlue : baseRed);
    out.push({
      x: t.x, y: t.y,
      propIndex: t.propIndex,
      tipIndex: t.tipIndex,
      end: t.tipIndex === 0 ? "A" : "B",
      color,
    });
  }
  return out;
}
```

Emitter identity: `id = ${propIndex}:${tipIndex}` (stable across frames).

## Per-renderer transform

### Category A (8 — uniform)

1. Input type `XxxTipInput {bluePosA,...}` → `EmitterTip[]`.
2. Per-tip state `Partial<Record<TipKey, …>>` → `Map<string, …>` keyed by emitter id.
3. The `for (const key of TIP_KEYS)` loop → `for (const e of emitters)`. Replace `tips[key]` with `e`.
4. `isTipEnabled(key,…)` → check `e.end` vs `params.trackingMode`:
   - `both_ends` → true; `left_end` → `e.end === "A"`; else `e.end === "B"`.
5. **Prune:** build a `Set<string>` of ids seen this frame; after the loop, delete Map entries whose id isn't in the set (replaces the per-key `delete` on null tips). Preserves velocity/trail continuity per emitter; bounds Map size.
6. Color: unchanged (palette / colorMode). Ignore `e.color`.
7. `dispose()` clears the Maps.
8. Pool cap: unchanged (the existing shared cap is the soft cap).

`water` is the reference implementation — the other 7 follow its diff exactly.

### Category B (2 — pair-based)

**echo:** group emitters by `propIndex` into `{A, B, color}`. For each prop with both ends present, capture a phantom into a per-prop buffer `Map<number, Phantom[]>` (keyed by propIndex). Per-prop color = the group's `color` (already spectrum-gated by the builder; base props get trail color, layers get spectrum/base per the gate). `prevTips` keyed by `${propIndex}:${end}`. Draw iterates the map, passing each prop's color. Keep `MAX_PHANTOMS` as a per-buffer cap. Loop-reset clears all buffers.

**zap:** group emitters by `propIndex`. Family pairing: for each layer index li (0 = base), arc between blue prop `2li`(base 0) end-A↔red prop `2li+1`(base 1) end-A and end-B — i.e. pair blue-family-li with red-family-li. `web` style meshes all emitters (already all-tips). `prevTip` keyed by emitter id. Per-prop/family color from `e.color` for same-prop edges; cross-prop stays violet. Keep `MAX_SPARKS`.

## Registry wiring

Swap each of the 10 `buildInput` entries from `buildFourPosTips(…)` to `buildEmitterTips(ctx.sharedTips, ctx.tipMap, "<effect>", ctx.params)`. echo keeps its extra spread fields (`currentStep`, but `blueColor`/`redColor` move into per-emitter `color`, so echo's input becomes `{ emitters, currentStep }`). After all 10 are migrated, delete `buildFourPosTips`.

## Perf

Full per-emitter density. The existing shared per-renderer pool cap clamps the worst case (oldest particles recycled). No per-fold scaling, no new pool logic. This is the user-chosen "full density + soft cap."

## Testing

- New unit test for `buildEmitterTips`: base + layer tips, tracking-mode is renderer-side (builder emits all), color = base for propIndex 0/1, `tunnelPropColor` for layers when spectrum on, base when off.
- Each renderer's existing `*.test.ts`: migrate constructed inputs to `EmitterTip[]`; add one layer-emitter case asserting a layer emitter (propIndex ≥ 2) produces particles/phantoms/bolts.

## Out of scope

- Export path spectrum honoring (offscreen export defaults spectrum on) — separate thread.
- The `effectsConfig.trails` → 2D-viewer bridge debt — separate thread.

## Execution order (keeps `npm run check` green throughout)

1. Add `EmitterTip` type + `buildEmitterTips` builder **alongside** `buildFourPosTips` (no removal). Check green.
2. Migrate `water` + its registry entry + test (reference). Check green.
3. Migrate remaining 7 Category-A renderers (parallelizable — disjoint files) + their registry entries + tests.
4. Migrate echo, zap + registry entries + tests.
5. Delete `buildFourPosTips`. Full `npm run check` + full effects test suite green.
