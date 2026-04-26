# Ink Renderer Rewrite: Brush Stamp Compositing

**Status:** Spec (2026-04-24). Replaces the Phase 1j.i stroke renderer. Infrastructure (palettes, config types, overlay wiring, render loop integration, presets, UI) is unchanged.

**Problem:** Current `Ink2DRenderer` draws `ctx.lineTo()` polyline paths with `ctx.stroke()`. Produces flat, uniform lines that read as a marker tool, not ink. No texture, no organic edge variation, no opacity variation within strokes.

**Solution:** Replace the stroke-path rendering with **brush stamp compositing** — the standard technique used by Procreate, Krita, and Photoshop for digital ink. Pre-render a procedural brush tip texture to an offscreen canvas, then `drawImage` it at each path point with per-stamp rotation, scale, and opacity variation. Matches the `Water2DRenderer` sprite cache pattern already proven in this codebase.

## Architecture

### BrushStampCache (new, nested in Ink2DRenderer)

Offscreen canvas that holds the brush tip texture. Regenerated on palette/intensity change (signature-keyed, same pattern as Water2D's `DropletSpriteCache`).

**Stamp size:** 64px (smaller than Water2D's 128px — ink needs more stamps at tighter spacing, so smaller sprites keep the memory budget low).

**Four-layer composite:**

| Layer | Technique | Purpose |
|-------|-----------|---------|
| 1. Core pigment | Radial gradient: `palette.pigment` at center (alpha 0.95) → transparent at R | Dense center of the brush mark |
| 2. Wet edge ring | Radial gradient: transparent → `palette.pigment` (alpha 0.4) → transparent, band at 0.65R–0.85R | Ink pooling at stroke boundary — darker ring near edge |
| 3. Edge bleed | Radial gradient: transparent center → `palette.edge` (alpha 0.2) at R*1.1, clipped to canvas | Soft feathering beyond the sharp pigment boundary |
| 4. Fiber noise | Per-pixel alpha modulation using simple hash noise (2 octaves) | Organic irregularity — simulates paper fiber interaction |

**Fiber noise generation:** Iterate over all pixels of the offscreen canvas. For each pixel at `(px, py)`:
- Sample 2-octave value noise: `n = noise(px * 0.15, py * 0.15) * 0.6 + noise(px * 0.3, py * 0.3) * 0.4`
- Modulate existing alpha: `pixel.a *= lerp(0.5, 1.0, n)` (range: 50%-100% of base alpha)
- This creates visible fiber texture without killing the base gradient structure

**Noise function:** Simple integer hash noise (NOT Perlin/Simplex — overkill for a 64px texture). A fast `hash(x, y) → [0,1]` with bilinear interpolation between grid points at scale 8px. Generated once at cache time, not per frame.

**Signature:** `${palette.pigment}|${palette.edge}|${intensity.toFixed(2)}|${palette.watercolor ? 'w' : ''}|${palette.emissive ? 'e' : ''}`

### Modified InkPoint

```ts
interface InkPoint {
  x: number;
  y: number;
  age: number;
  spawnSpeedPx: number;
  /** Direction of tip motion at spawn (radians). Drives stamp rotation. */
  tangentAngle: number;
  /** Deterministic seed for per-stamp jitter. Set once at spawn, never changes. */
  jitterSeed: number;
}
```

Two new fields. `tangentAngle` comes from `atan2(smoothedVy, smoothedVx)` at spawn time. `jitterSeed` is `Math.random()` at spawn time — used to derive rotation/scale/opacity jitter deterministically so stamps don't flicker frame-to-frame.

### Stamp Spacing (Emit-Time Control)

Current renderer emits points based on a rate accumulator (points per second). This creates uneven spacing — slow tips emit many close points, fast tips leave gaps.

**New rule:** enforce minimum distance between consecutive points: `minSpacing = currentBrushWidth * 0.22`. When tip velocity is high, accumulator fires faster but the spacing gate prevents over-stamping. When tip velocity is low, the accumulator naturally spaces points wider.

This means we control density at emit time, not render time. No interpolation needed during rendering — every stored point gets one stamp.

### drawStamps() — Replaces drawStrokes()

Per frame, for each tip with >= 1 point:

```
for each point in tip.points:
  1. Compute age-based opacity fade (same curve as current: opaque for 60% of life, fade last 40%)
  2. Compute velocity-based stamp scale:
     - scale = stampScaleMax + (stampScaleMin - stampScaleMax) * speedT
     - where speedT = min(1, spawnSpeedPx / SPEED_CEILING_PX)
     - Slow = large stamp (loaded brush pressing). Fast = small stamp (brush lifting).
  3. Compute per-stamp jitter from jitterSeed:
     - rotationJitter = (hash(jitterSeed, 0) - 0.5) * MAX_ROTATION_JITTER  // ±0.14 rad (~8°)
     - scaleJitter = 1.0 + (hash(jitterSeed, 1) - 0.5) * MAX_SCALE_JITTER  // ±12%
     - opacityJitter = 1.0 - hash(jitterSeed, 2) * MAX_OPACITY_JITTER  // 0-15% reduction
  4. Draw:
     ctx.save()
     ctx.globalAlpha = opacity * opacityJitter
     ctx.translate(point.x, point.y)
     ctx.rotate(tangentAngle + rotationJitter)
     ctx.scale(scale * scaleJitter, scale * scaleJitter * squashFactor)
     ctx.drawImage(stampCanvas, -STAMP_SIZE/2, -STAMP_SIZE/2)
     ctx.restore()
```

**Squash factor:** When speed > threshold, elongate stamp in direction of motion: `squashFactor = 1.0 / sqrt(1.0 + speedT * 0.4)`. This stretches the stamp along the tangent, bridging gaps between stamps at high velocity. Matches Water2D's velocity-stretch pattern.

**Composite operation:** `source-over` for all palettes except neon (`lighter`). Same as current.

### Edge Bleed Pass

Before the pigment stamps, draw a second pass with:
- Same points, same positions
- Scale multiplied by 1.7× (wider footprint)
- Alpha multiplied by 0.18
- Uses edge color from palette instead of pigment
- Composite: `source-over`

This replaces the current "wider stroke at low alpha" feathering with actual stamp-based bleed. Reads as ink spreading into paper fibers rather than a hard-edged line with a shadow.

### Watercolor Palette Special Behavior

When `palette.watercolor === true`:
- Stamp opacity capped at 0.35 (translucent wash)
- Stamp scale multiplied by 1.8× (wider bleed, thinner marks)
- Edge bleed pass alpha increased to 0.3 (more spread)
- Fiber noise intensity reduced (smoother wash, less texture)
- No wet-edge ring (layer 2 skipped in sprite generation)

### Neon Palette Special Behavior

When `palette.emissive === true`:
- Composite switches to `lighter` (additive blend, glow)
- Edge bleed pass uses `lighter` too
- Fiber noise intensity reduced to 20% (clean glow lines, not textured)
- Wet-edge ring alpha increased to 0.6 (hot core edge)

### Light Gravity Preview

Phase 1j.ii adds full gravity sag. As a preview, the rewritten 1j.i applies light downward drift to aged points:

```ts
// In ageAndCullPoints, after aging:
if (point.age > lifetimeSeconds * 0.4) {
  const sagT = (point.age - lifetimeSeconds * 0.4) / (lifetimeSeconds * 0.6);
  point.y += LIGHT_SAG_PX * sagT * sagT * dt * 60;  // quadratic ease-in
}
```

`LIGHT_SAG_PX = 0.8` — barely perceptible but enough to break the "gravity-free ribbon" read of trails. Points droop ~15-20px total over their lifetime. Full gravity (1j.ii) will replace this with proper per-point velocity accumulation.

## Performance Budget

**Worst case:** 4 tips × 40 points × 2 passes (bleed + pigment) = 320 stamps/frame.

**Per-stamp cost:** `save/translate/rotate/scale/drawImage/restore` = 6 Canvas2D ops. At 64px sprite size, `drawImage` is GPU-texture-sampled in all modern browsers.

**Measured baseline:** Water2DRenderer runs 1024 droplets with 128px sprites including atmospheric blur at <2ms. Our 320 stamps with 64px sprites is well under that budget.

**Sprite cache regeneration:** ~1ms for a 64px canvas with noise pass. Happens only on palette/intensity change (amortized to zero per frame).

## What Stays Unchanged

- `InkPalettes.ts` — palette registry, custom derivation, all hex colors
- `InkOverlayRenderer.ts` — overlay wiring, canvas lifecycle, resize, clear, dispose
- `AnimationRenderLoop.ts` — ink integration in render loop, tip mapping, error handling
- `EffectsConfig.ts` — InkIntent interface, all fields
- `canvas2d-types.ts` — Ink2DParams (may add 1-2 resolved fields for stamp sizes)
- `canvas2d-translator.ts` — resolveInk2D (may add stamp size resolution)
- `built-in-ink-presets.ts` — all 6 presets
- `InkCustomize.svelte` — customization UI
- `Ink2DRenderer.test.ts` — tests updated to match new rendering (stamp calls instead of stroke calls)

## What Changes

| File | Change |
|------|--------|
| `Ink2DRenderer.ts` | Full rewrite of rendering logic. Point model gains tangentAngle + jitterSeed. drawStrokes → drawStamps. New BrushStampCache class. Spacing gate in updateTip. Light gravity in ageAndCullPoints. |
| `Ink2DRenderer.test.ts` | Update assertions: drawImage instead of stroke, composite operation tests stay, new tests for stamp cache signature, spacing gate, gravity sag. |
| `canvas2d-types.ts` | Add `stampScaleMin`, `stampScaleMax` to Ink2DParams (resolved from intensity). |
| `canvas2d-translator.ts` | Add stamp scale resolution in `resolveInk2D`. |

## Files

### Modified
- `src/lib/shared/effects/renderers/Ink2DRenderer.ts` — full rewrite
- `src/lib/shared/effects/renderers/Ink2DRenderer.test.ts` — updated assertions
- `src/lib/shared/effects/translators/canvas2d-types.ts` — 2 new Ink2DParams fields
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — stamp size resolution

### New
None. All changes are within existing files.

## Testing

- Unit: BrushStampCache generates canvas with correct dimensions (64×64)
- Unit: BrushStampCache invalidates on signature change
- Unit: Stamp spacing gate enforces minimum distance between consecutive points
- Unit: drawImage called (not stroke) during rendering
- Unit: composite operation stays source-over for opaque, lighter for neon
- Unit: Light gravity shifts point.y downward for aged points
- Unit: Watercolor palette caps opacity at 0.35 and scales stamps 1.8×
- Unit: dispose clears stamp cache + point history
- Visual: enable ink in browser, confirm strokes have visible texture/fiber variation
- Visual: confirm edge bleed reads as soft ink spread, not hard line
- Visual: confirm thin fast strokes look different from thick slow strokes (calligraphic pressure)
- Visual: confirm ink looks NOTHING like trails (opaque, textured, slight sag vs emissive, smooth, gravity-free)

## Known Risks

- **"String of pearls" at low density:** If stamp spacing is too wide relative to stamp size, individual stamps become visible. Mitigation: the 22% spacing rule + edge bleed pass bridges gaps.
- **Fiber noise too subtle at 64px:** At small display sizes the texture may be invisible. Acceptable — the wet-edge ring and organic edges carry the ink read even without visible fiber.
- **Light gravity may conflict with full gravity (1j.ii):** The preview sag directly modifies point.y. When 1j.ii ships, it replaces this with velocity-based accumulation. Clean swap — no compatibility concern.
