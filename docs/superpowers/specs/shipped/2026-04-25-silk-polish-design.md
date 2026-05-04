---
status: shipped
value: 3
effort: M
remaining: ""
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-05-04
---
# Silk Polish: MVP → Stunning

**Status:** Approved 2026-04-25. Immediate implementation.

**Goal:** Six visual quality upgrades to Silk2DRenderer, transforming flat polygon ribbon into a gorgeous multi-layer fabric simulation.

## Upgrades

### 1. Smooth Alpha Fade
Replace 4 coarse `FADE_BANDS` with 16 equal-age segments. Each segment gets `alpha = 1 - ageFrac²` (quadratic ease-out). Eliminates visible banding in tail.

### 2. Cross-Ribbon Gradient (3-Layer Draw)
Three draw layers per segment fake perpendicular gradient depth:
- **Glow** (Layer 1): Thick soft stroke along spine, body color, 15% alpha. Bleeds outward.
- **Body** (Layer 2): Filled polygon, body color, 70% alpha. Opaque center mass.
- **Sheen** (Layer 3): Thin stroke on left edge only, edge color, 30% alpha. Light catch.

### 3. Catmull-Rom Curve Smoothing
Replace `lineTo` with `bezierCurveTo` using Catmull-Rom→cubic conversion:
```
CP1 = P[i-1] + (P[i] - P[i-2]) / 6
CP2 = P[i] - (P[i+1] - P[i-1]) / 6
```
Applied to left edge, right edge, and spine paths. Backward path reverses control points.

### 4. Highlight/Sheen Stroke
Left edge only, 1.5px × scale, edge color at 30% alpha. Asymmetric = realistic overhead light simulation.

### 5. Velocity-Reactive Flutter
`freqMul = 0.5 + speedFrac × 1.5`. Fast motion = tight rapid flutter (2×). Slow = lazy billowing (0.5×). Matches real fabric physics.

### 6. Ember Aura Glow
Emissive palettes only. Radial gradient circles every 8th sample along spine. Radius = halfWidth × 3, edge color fading to transparent, `lighter` blend. Volumetric hot-air envelope.

## Palette Change

Add optional `bodyAlt` to `SilkPalette` for full-ribbon hue-shift. Ethereal palette: body shifts violet→cyan, edge shifts cyan→pink. All three draw layers interpolate both colors.

## Files Modified

- `src/lib/shared/effects/domain/SilkPalettes.ts` — add `bodyAlt` field
- `src/lib/shared/effects/renderers/Silk2DRenderer.ts` — full rewrite, ~280 lines

## Performance

16 segments × 3 layers × 4 tips = 192 draw calls worst case. Each segment is ~15 samples → tiny polygons. Ember aura adds ~12 radial gradients per tip per segment where active. Well within 60fps budget.
