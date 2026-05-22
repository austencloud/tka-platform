# Boat Silhouette Above Water Surface — Design Spec

**Date:** 2026-05-22
**Status:** Draft
**Scene:** Ocean (all variants)

## Motivation

The ocean scene is an underwater environment. When looking up, the user sees the WaterSurface plane with Snell's window at Y = `groundY + 12`. Above that is the SkyGradient sphere (radius 80). Adding a boat hull silhouette floating at the water surface gives the scene a sense of scale and narrative context: "we're underwater, that's the surface up there, and there's a boat."

ABZU and Subnautica both use distant surface objects (boats, debris, light shafts from a vessel) as environmental storytelling. A dark hull shape against the brighter Snell's window is high-impact, low-cost geometry. Both games also use the hull as an *occluder* in god ray passes — the boat casts a visible shadow into light shafts, creating dramatic "light streaming around the hull edges" framing.

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

### Hull Geometry — Meshy AI GLB Model (Primary) + Procedural Fallback

**Primary approach: Meshy AI-generated GLB model.**

The codebase already loads 10+ Meshy AI-generated GLB models in `OceanScene.svelte` (corals, seaweed, kelp, jellyfish, starfish, sea urchin) via the `useGltf`/`useDraco` pipeline. A tapered `BoxGeometry` will read as "floating rectangle" from most viewing angles — it lacks the keel curvature, gunwale flare, and stern shape that make a hull recognizable as a boat in silhouette.

**Meshy generation prompt:** "wooden fishing boat hull, low-poly, seen from below, dark silhouette, no textures, solid hull, simple keel"

Generate 1-2 hull variants. Export as GLB with Draco compression (matching the existing `/draco/` decoder path). Target: under 2K triangles. The model only needs to read as a recognizable hull shape — no deck detail, no cabin, no mast. Pure silhouette geometry.

**Loading pattern** (matches existing ocean model loading):

```typescript
const dracoLoader = useDraco("/draco/");
const opts = { dracoLoader };
const hullGlb = useGltf("/models/ocean/boat_hull.glb", opts);
```

Store the GLB at `static/models/ocean/boat_hull.glb`.

**Procedural fallback:** Until the GLB is generated, or as a loading fallback while the model streams, use a tapered `BoxGeometry(6, 0.8, 2.5, 1, 1, 1)` with bow/stern vertices pinched inward. This gives a recognizable-enough hull in ~20 lines of procedural code. The component should render the procedural hull when `hullGlb` hasn't resolved yet, then swap to the GLB mesh once loaded. A flat keel fin (`BoxGeometry(4, 0.6, 0.08)`) underneath the procedural hull adds recognizability from below.

### Material

**Hull exterior — `MeshBasicMaterial`:**
- `color: "#0a1520"` (very dark blue-black)
- `transparent: false`
- `side: DoubleSide`

No lighting response needed for the exterior. The boat reads as a dark silhouette against the bright Snell's window and god ray light from above. `MeshBasicMaterial` is cheaper than `MeshStandardMaterial` and the silhouette effect is purely about contrast, not surface detail.

**Hull underside — Caustic projection (nice-to-have):**

Switch the hull underside face group from `MeshBasicMaterial` to a `ShaderMaterial` that composites a subtle Voronoi caustic pattern onto the dark base color. This gives the hull a living underwater quality: dark silhouette from the side, faint dancing light patterns on the underside when viewed from directly below.

Implementation: reuse the Voronoi noise function from the existing `VoronoiCaustics` system. Composite at low intensity (~0.15 mix factor) over the `#0a1520` base. The caustic UV can be derived from world-space XZ coordinates so the pattern swims across the hull as it rocks.

```glsl
// Simplified hull-underside caustic fragment
uniform float uTime;
uniform float uCausticIntensity; // ~0.15
uniform vec3 uBaseColor;         // #0a1520

void main() {
  vec2 causticUV = vWorldPosition.xz * 0.3 + uTime * 0.05;
  float caustic = voronoiCaustic(causticUV); // reuse existing noise
  vec3 color = uBaseColor + vec3(0.4, 0.6, 0.8) * caustic * uCausticIntensity;
  gl_FragColor = vec4(color, 1.0);
}
```

Source reference: NVIDIA GPU Gems Chapter 2 (caustic projection), Sea of Thieves underwater hull rendering.

This is a nice-to-have — the boat reads perfectly well without it. Add only after the basic silhouette and god ray integration are verified.

### Position

- **Y:** `groundY + 12.3` (just above the water surface plane at `groundY + 12`)
- **X:** `8` to `12` (offset from center, NOT directly above the performance area)
- **Z:** `-4` to `0` (slightly behind and to the side)
- **Rotation Y:** ~0.3 rad (~17 degrees) to break axis alignment

The boat must never overlap the stage radius (3m) or clearing radius (7m) when viewed from below. An X offset of 8-12m places it in the reef/background zone overhead, visible when glancing up but not blocking the performance.

### Animation (recommended)

Gentle rocking to sell the "floating on water" feel:

```
rotation.x = sin(time * 0.4) * 0.015  // pitch: bow-to-stern rock
rotation.z = sin(time * 0.3 + 1.0) * 0.02  // roll: side-to-side
position.y += sin(time * 0.5) * 0.05  // heave: slight vertical bob
```

Frequencies 0.3-0.5 Hz, amplitudes 1-2 degrees rotation and ~5cm vertical. Slow enough to feel like ocean swell, not engine vibration. Driven by the existing `useTask` loop in `OceanScene.svelte`.

### Screen-Space God Rays with Hull as Occluder

The existing `GodRayShafts` component (`ocean/GodRayShafts.svelte`) renders additive-blended geometric planes — ambient light beams scattered across a 22m x 22m area. These cannot respond to occluders. They stay for ambient fill.

**New: screen-space god ray pass using `three-good-godrays`** with the boat mesh as occlusion source.

The `three-good-godrays` library is already installed (`package.json`: `"three-good-godrays": "^0.11.2"`) and was researched during the ocean scene redesign (see `docs/reference/ocean-scene-research.md`). It implements volumetric screen-space raymarching via shadow-map sampling, Beer's law density accumulation, and Henyey-Greenstein phase function. Blue noise dithering eliminates banding.

**Integration approach:**

1. Create a `DirectionalLight` positioned at the Snell's window bright spot (directly above the scene), casting shadows. The hull mesh is the only shadow caster — everything else in the ocean scene uses baked/unlit materials and doesn't need to cast into this pass.
2. Instantiate a `GodraysPass` from `three-good-godrays`:

```typescript
import { GodraysPass } from 'three-good-godrays';

const godraysPass = new GodraysPass(godRayLight, camera, {
  density: 0.04,        // subtle, not overwhelming
  maxDensity: 0.2,
  edgeStrength: 2.0,    // sharpen hull edge shadows
  distanceAttenuation: 1.5,
  color: new Color('#88bbdd'), // match existing water absorption tint
  raymarchSteps: 60,
  blur: true,
  gammaCorrection: true,
});
```

3. Add the pass to the existing `EffectComposer` in `ScenePostProcessing.svelte`, after bloom but before the final output pass.

**Result:** When looking up toward the Snell's window, light shafts visibly stream around the hull edges. The hull casts a soft shadow cone into the water volume below it. This is the signature ABZU/Subnautica look that makes the boat feel like it belongs in the light environment rather than being a pasted-on shape.

**Performance:** `three-good-godrays` renders at half resolution by default. With a single shadow caster (the hull) and 60 raymarch steps, GPU cost is ~0.5ms on mid-range hardware. The existing geometric `GodRayShafts` remain unchanged — the screen-space pass is additive.

### Rope / Anchor Line (stretch goal)

A thin vertical line descending from the hull center toward the seabed, fading out with depth.

**Implementation:** A `CylinderGeometry(0.02, 0.02, 8, 4)` with a custom shader or `MeshBasicMaterial` that uses vertex alpha to fade from opaque at the top to transparent at the bottom. Position: centered under the hull, extending ~8m downward.

This is a stretch goal. The boat reads well without it. Add only after the hull silhouette and god ray integration are verified.

### Wave Distortion at Hull Edges (nice-to-have, verify only)

The hull sits at `groundY + 12.3`, just 0.3m above the water surface plane at `groundY + 12`. The camera is always below the water surface. The existing `UnderwaterDistortionEffect.ts` post-processing pass applies sinusoidal UV distortion to simulate looking through water.

**Verification needed:** Confirm that `UnderwaterDistortionEffect` applies to objects at/near the water surface height. The hull edges should naturally shimmer with wave refraction since they're viewed through the distortion layer. If the effect only applies to objects below a certain depth threshold, the threshold may need adjusting to include the hull's Y position.

This is likely already handled by the existing post-processing — the distortion is applied in screen space to the full render. Just needs a visual check during implementation. No new code expected.

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
  /** Hull GLB model path. Null = use procedural fallback only. */
  modelPath: string | null;
  /** Hull length for procedural fallback (meters). Ignored when GLB loads. */
  length: number;
  /** Hull width / beam for procedural fallback (meters). */
  width: number;
  /** Hull depth / draft for procedural fallback (meters). */
  depth: number;
  /** Hull silhouette color. Dark blue-black for underwater contrast. */
  color: string;
  /** Rotation around Y axis (radians). */
  rotationY: number;
  /** Enable gentle rocking animation. */
  animated: boolean;
  /** Enable keel fin underneath procedural hull. */
  keelEnabled: boolean;
  /** Enable screen-space god rays with hull as occluder. */
  godRayOcclusion: boolean;
  /** Enable caustic projection on hull underside. */
  undersideCaustics: boolean;
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
  modelPath: "/models/ocean/boat_hull.glb",
  length: 6,
  width: 2.5,
  depth: 0.8,
  color: "#0a1520",
  rotationY: 0.3,
  animated: true,
  keelEnabled: true,
  godRayOcclusion: true,
  undersideCaustics: false,
},
```

Note: `undersideCaustics` defaults to `false` — it's a nice-to-have that should be enabled only after the basic silhouette and god ray passes are working.

## Files to Create

| File | Purpose |
|---|---|
| `src/lib/shared/3d/environments/scenes/ocean/BoatSilhouette.svelte` | Hull geometry (GLB primary + procedural fallback), material, animation loop, shadow caster setup |
| `src/lib/shared/3d/environments/scenes/ocean/BoatGodRays.svelte` | Screen-space god ray pass using `three-good-godrays` with hull mesh as occluder |
| `static/models/ocean/boat_hull.glb` | Meshy AI-generated hull model (Draco-compressed, <2K triangles) |

## Files to Modify

| File | Change |
|---|---|
| `src/lib/shared/3d/environments/domain/models/scene-configs.ts` | Add `OceanBoatSilhouetteConfig` interface + `boatSilhouette` field to `OceanSceneConfig` + default values |
| `src/lib/shared/3d/environments/scenes/OceanScene.svelte` | Import and render `<BoatSilhouette>` conditionally on `activeConfig.boatSilhouette?.enabled` |
| `src/lib/shared/3d/effects/post-processing/ScenePostProcessing.svelte` | Wire `BoatGodRays` pass into the effect composer chain (after bloom, before output) |

## Implementation Order

1. **Hull silhouette** — procedural fallback geometry, `MeshBasicMaterial`, position, animation. Verify dark shape visible against Snell's window.
2. **Meshy AI model** — generate GLB, swap in via `useGltf`/`useDraco`, confirm silhouette quality improvement over procedural.
3. **Screen-space god rays** — wire `three-good-godrays` pass with hull as shadow caster. Verify light-streaming-around-edges effect.
4. **Wave distortion verification** — orbit camera to view hull edges, confirm `UnderwaterDistortionEffect` shimmer applies.
5. **Underside caustics** (nice-to-have) — `ShaderMaterial` with Voronoi noise on hull underside faces.
6. **Anchor rope** (stretch goal) — fading cylinder from hull to depth.

## What This Does NOT Include

- Detailed boat model (mast, cabin, deck). The silhouette works best as a simple dark shape.
- Propeller wake, engine sounds, or wave disturbance on the water surface.
- Multiple boats. One is atmospheric; more is cluttered.
- Replacement of existing geometric `GodRayShafts`. The screen-space pass is additive alongside them.
- Anchor rope in initial scope (stretch goal, separate follow-up).

## Verification Plan

1. Load ocean scene (abyss variant).
2. Orbit camera to look upward toward the water surface.
3. Confirm: dark hull shape visible against the Snell's window bright spot.
4. Confirm: hull is NOT directly above the performance area (offset 8-12m).
5. Confirm: gentle rocking animation is visible and smooth.
6. Confirm: hull does not clip through the WaterSurface plane.
7. Confirm: screen-space god rays cast visible shadow around hull edges (light streams around, not through, the hull).
8. Confirm: existing geometric `GodRayShafts` still render (additive, unaffected by new pass).
9. Confirm: hull edges shimmer due to `UnderwaterDistortionEffect` post-processing.
10. Run `npm run check` for type safety.
