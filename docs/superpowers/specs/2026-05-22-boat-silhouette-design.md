# Boat Silhouette Above Water Surface — Design Spec

**Date:** 2026-05-22
**Status:** Draft
**Scene:** Ocean (all variants)

## Motivation

The ocean scene is an underwater environment. When looking up, the user sees the WaterSurface plane with Snell's window at Y = `groundY + 12`. Above that is the SkyGradient sphere (radius 80). Adding a boat hull silhouette floating at the water surface gives the scene a sense of scale and narrative context: "we're underwater, that's the surface up there, and there's a boat."

ABZU and Subnautica both use distant surface objects (boats, debris, light shafts from a vessel) as environmental storytelling. A dark hull shape against the brighter Snell's window is high-impact, low-cost geometry.

## Coordinate System Reference

Values from `OceanScene.svelte` and `scene-configs.ts`:

| Reference | Y Position |
|---|---|
| Seabed / ground plane | `groundY` (from `userProportionsState.groundY`, typically ~-1.6) |
| Performer feet | `groundY` |
| Water surface | `groundY + 12` (`waterSurface.height: 12`) |
| God ray shafts top | `groundY + 18` |
| SkyGradient sphere | Radius 80, centered at origin |
| Warm fill light | `groundY + 12` |

## Design

### Geometry

A low-poly hull shape built from Three.js primitives. No loaded model needed.

**Approach: Tapered BoxGeometry via BufferGeometry manipulation.**

Create a `BoxGeometry(6, 0.8, 2.5, 1, 1, 1)` and taper the bow and stern by manipulating vertex positions on the X-axis extremes: pinch the front and back faces inward to form a roughly boat-shaped silhouette. This gives a recognizable hull shape in ~20 lines of procedural code, no external model.

Alternatively, `ExtrudeGeometry` with a 2D hull cross-section path (half-ellipse) extruded along the length. Either approach produces the same visual result; the tapered box is simpler.

A flat keel fin (`BoxGeometry(4, 0.6, 0.08)`) attached underneath adds recognizability from below. Optional.

### Material

`MeshBasicMaterial` with:
- `color: "#0a1520"` (very dark blue-black)
- `transparent: false`
- `side: DoubleSide`

No lighting response needed. The boat reads as a dark silhouette against the bright Snell's window and god ray light from above. `MeshBasicMaterial` is cheaper than `MeshStandardMaterial` and the silhouette effect is purely about contrast, not surface detail.

### Position

- **Y:** `groundY + 12.3` (just above the water surface plane at `groundY + 12`)
- **X:** `8` to `12` (offset from center, NOT directly above the performance area)
- **Z:** `-4` to `0` (slightly behind and to the side)
- **Rotation Y:** ~0.3 rad (~17 degrees) to break axis alignment

The boat must never overlap the stage radius (3m) or clearing radius (7m) when viewed from below. An X offset of 8-12m places it in the reef/background zone overhead, visible when glancing up but not blocking the performance.

### Animation (optional, recommended)

Gentle rocking to sell the "floating on water" feel:

```
rotation.x = sin(time * 0.4) * 0.015  // pitch: bow-to-stern rock
rotation.z = sin(time * 0.3 + 1.0) * 0.02  // roll: side-to-side
position.y += sin(time * 0.5) * 0.05  // heave: slight vertical bob
```

Frequencies 0.3-0.5 Hz, amplitudes 1-2 degrees rotation and ~5cm vertical. Slow enough to feel like ocean swell, not engine vibration. Driven by the existing `useTask` loop in `OceanScene.svelte`.

### Rope / Anchor Line (optional, stretch goal)

A thin vertical line descending from the hull center toward the seabed, fading out with depth.

**Implementation:** A `CylinderGeometry(0.02, 0.02, 8, 4)` with a custom shader or `MeshBasicMaterial` that uses vertex alpha to fade from opaque at the top to transparent at the bottom. Position: centered under the hull, extending ~8m downward.

This is a stretch goal. The boat reads well without it. Add only after the hull silhouette is verified.

### God Rays / Light Shafts from Surface

The existing `GodRayShafts` component already renders additive-blended light beams from above, scattered across a 22m x 22m area. No new god ray implementation needed for the boat.

If desired later, a single additional god ray shaft could be placed near the boat to create a "light streaming past the hull" effect. This is a parameter-only change: add one more entry to the god ray shaft placement with position near the boat's X/Z coordinates. Not in initial scope.

The post-processing pipeline (`ScenePostProcessing.svelte`) already applies bloom, chromatic aberration, and vignette to the ocean scene. The boat silhouette will benefit from bloom automatically: the bright Snell's window sky color around the dark hull will create a natural glow halo at the hull edges. No post-processing changes needed.

## Config Interface

Add to `OceanSceneConfig` in `scene-configs.ts`:

```typescript
export interface OceanBoatSilhouetteConfig {
  enabled: boolean;
  /** X offset from origin (meters). Keep outside clearing radius. */
  offsetX: number;
  /** Z offset from origin (meters). */
  offsetZ: number;
  /** Y offset above water surface height (meters). 0.3 = just above surface. */
  heightAboveSurface: number;
  /** Hull length (meters). */
  length: number;
  /** Hull width / beam (meters). */
  width: number;
  /** Hull depth / draft (meters). */
  depth: number;
  /** Hull silhouette color. Dark blue-black for underwater contrast. */
  color: string;
  /** Rotation around Y axis (radians). */
  rotationY: number;
  /** Enable gentle rocking animation. */
  animated: boolean;
  /** Enable keel fin underneath hull. */
  keelEnabled: boolean;
}
```

Add to `OceanSceneConfig`:

```typescript
boatSilhouette: OceanBoatSilhouetteConfig | null;
```

Default config in `createDefaultOceanAbyssConfig()`:

```typescript
boatSilhouette: {
  enabled: true,
  offsetX: 10,
  offsetZ: -2,
  heightAboveSurface: 0.3,
  length: 6,
  width: 2.5,
  depth: 0.8,
  color: "#0a1520",
  rotationY: 0.3,
  animated: true,
  keelEnabled: true,
},
```

## Files to Create

| File | Purpose |
|---|---|
| `src/lib/shared/3d/environments/scenes/ocean/BoatSilhouette.svelte` | Svelte component: hull geometry, material, animation loop |

## Files to Modify

| File | Change |
|---|---|
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `OceanBoatSilhouetteConfig` interface + `boatSilhouette` field to `OceanSceneConfig` + default values |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Import and render `<BoatSilhouette>` conditionally on `activeConfig.boatSilhouette?.enabled` |

## What This Does NOT Include

- Detailed boat model (mast, cabin, deck). The silhouette works best as a simple dark shape.
- Propeller wake, engine sounds, or wave disturbance on the water surface.
- Multiple boats. One is atmospheric; more is cluttered.
- Any changes to the post-processing pipeline.
- Anchor rope (stretch goal, separate follow-up).

## Verification Plan

1. Load ocean scene (abyss variant).
2. Orbit camera to look upward toward the water surface.
3. Confirm: dark hull shape visible against the Snell's window bright spot.
4. Confirm: hull is NOT directly above the performance area (offset 8-12m).
5. Confirm: gentle rocking animation is visible and smooth.
6. Confirm: hull does not clip through the WaterSurface plane.
7. Run `npm run check` for type safety.
