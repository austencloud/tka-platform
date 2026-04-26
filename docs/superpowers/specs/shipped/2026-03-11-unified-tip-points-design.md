# Unified Tip Point System

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Animation engine tip point definitions, Effects Lab editor, override providers

## Problem

Fire, LED, and trail effects each maintain separate registries of prop tip positions (`PropFirePoints.ts`, `PropLedPoints.ts`, `PropTrailPoints.ts`). All three define identical `dx`/`dy` positions per prop type, differing only in an effect-specific third property (`flameScale`, `brightness`, `trailWidth`). The charcoal effect reuses fire points.

This triplication means:
- Positioning tips requires editing three files (or using the Effects Lab editor three times, once per effect mode)
- Three separate override providers persist the same spatial data to different storage keys
- Three separate `set*OverrideProvider()` callbacks wire into the animation engine
- Any position correction must be applied three times

## Solution

One source of truth for tip positions. Each effect applies its own scaling at read time.

### Unified Type

```typescript
// PropTipPoints.ts
interface TipPoint {
  dx: number;
  dy: number;
}

interface PropTipConfig {
  points: TipPoint[];
}
```

One registry (`PROP_TIP_POINTS`), one lookup function (`getTipPoints()`), one override provider callback (`setTipPointOverrideProvider()`).

### How Effects Consume Shared Positions

Each effect renderer reads `getTipPoints(propType)` and applies its own global scaling:

| Effect | Scaling Source | Already Exists |
|--------|---------------|----------------|
| Fire | `FireOverlayConfig.intensity` | Yes (intensity slider) |
| Charcoal | Same as fire | Yes (shares fire config) |
| LED | `LedOverlayConfig.brightness` | Yes (brightness buttons) |
| Trails | Global trail width setting | Partially (per-point `trailWidth` becomes global) |

Per-point intensity variation (e.g., `flameScale` per tine on fans) is dropped. Current hardcoded defaults already use uniform intensity within each prop type, so this is not a meaningful loss.

Note: some prop types have different base scales (e.g., bigstaff uses `flameScale: 1.2` vs staff's `1.0`). These per-prop-type scale factors move into the effect renderers' prop-type configuration, not the shared tip positions. The unified tip registry stores only geometry.

### Override Provider Consolidation

Three providers collapse into one `TipPointOverrideProvider`:
- Firestore path: `config/effectPoints` (unchanged)
- localStorage cache: `tka-effect-points-cache` (unchanged)
- Strategy: localStorage instant + Firestore debounced 1s (unchanged)

The existing `FirePointOverrideProvider` is the most mature (Firestore-backed, admin defaults support). It becomes the basis for `TipPointOverrideProvider`. `LedPointOverrideProvider` and `TrailPointOverrideProvider` are deleted.

### Effects Lab Point Editor

- Single editor experience, no mode switching between fire/LED/charcoal
- All `EffectDescriptor` instances share `getTipPoints()` for `getDefaultPoints`
- Per-point intensity sliders removed from the point editor
- The `EffectDescriptor` interface simplifies: `getIntensity`, `setIntensity`, `createPoint` no longer need effect-specific point types

### Tip Tracker Changes

`FireTipTracker.update()` calls `getTipPoints()` instead of `getFirePoints()`. The `flameScale` field on `PropTipData` gets a constant value from the global fire intensity setting rather than per-point config.

`LedTipTracker.update()` calls `getTipPoints()` instead of `getLedPoints()`. The `brightness` field on `LedTipData` gets the global LED brightness rather than per-point config.

Trail consumers (`TrailCapturer`, `TrailPathGenerator`, `AnimationPathCache`) call `getTipPoints()` instead of `getTrailPoints()`. Trail width becomes a global setting.

### DI Container Changes

`effects-lab-container.ts` wires one `TipPointOverrideProvider` instead of separate fire/LED providers. One `setTipPointOverrideProvider()` call replaces three separate override registrations.

## Migration

1. Existing Firestore fire point overrides become the unified tip points (fire is the most complete dataset)
2. LED-specific overrides are dropped (positions are identical to fire)
3. Trail localStorage overrides are dropped (positions are identical)
4. The Firestore document shape stays the same: `{ staff: [{dx, dy}, ...], fan: [...], ... }`

## Files

| Action | File | Notes |
|--------|------|-------|
| New | `PropTipPoints.ts` | Unified registry, all prop types |
| Delete | `PropFirePoints.ts` | Replaced by PropTipPoints |
| Delete | `PropLedPoints.ts` | Replaced by PropTipPoints |
| Delete | `PropTrailPoints.ts` | Replaced by PropTipPoints |
| Delete | `LedPointOverrideProvider.ts` | Merged into TipPointOverrideProvider |
| Delete | `TrailPointOverrideProvider.ts` | Merged into TipPointOverrideProvider |
| Rename/Refactor | `FirePointOverrideProvider.ts` → `TipPointOverrideProvider.ts` | Remove fire-specific naming |
| Update | `FireTipTracker.ts` | Use `getTipPoints()` |
| Update | `LedTipTracker.ts` | Use `getTipPoints()` |
| Update | `EffectDescriptor.ts` | Simplify, all use `getTipPoints()` |
| Update | `EffectPointEditorTab.svelte` | Single provider, no mode branching |
| Update | `EffectPointEditorState` | Remove effect-specific point types |
| Update | `EffectPointSvgCanvas.svelte` | Remove `getIntensity`/`intensityLabel` refs |
| Update | `EffectPointListPanel.svelte` | Remove intensity sliders, copy-from UI |
| Update | `effects-lab-container.ts` | Wire single provider |
| Update | `FireDefaultsLoader.ts` | Adapt to unified type |

Note: `TrailCapturer.ts`, `TrailPathGenerator.ts`, `AnimationPathCache.ts`, `EffectsLayer.svelte` (3D), and `effect-state.svelte.ts` (3D) do NOT import from the old tip point registries. Their `getTrailPoints` methods are internal trail-history methods, not tip registry lookups. No changes needed.

## What Doesn't Change

- Effect-specific rendering (fire fluid sim, LED glow sprites, trail lines, charcoal sparks)
- Effect-specific tuning UI (fire intensity slider, LED brightness buttons, charcoal semantic sliders)
- The `EffectPointSvgCanvas` drag interaction mechanics
- Firestore persistence strategy
- The `EffectPointsPersister` service (storage layer is effect-agnostic already)
- `PropTipData` and `LedTipData` output types from trackers
