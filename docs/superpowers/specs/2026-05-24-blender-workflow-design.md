# Blender Workflow — Scene Composition & Animation Pipeline

**Date:** 2026-05-24
**Status:** Draft
**Scope:** Bidirectional Blender ↔ TKA app workflow for scene art direction and sequence animation

---

## Vision

Blender becomes TKA's visual scene editor. Austen composes environments, art-directs crystal/coral/object placement, and previews sequence animations inside Blender. Changes flow back to the web app through a Claude-mediated sync pipeline. Both Blender and the web app consume the same shared data sources — no algorithm drift.

**Growth path:** Start with layout/composition (Phase 1), grow into full scene authoring and animation (Phases 2-3).

---

## Phase 1: Scene Layout & Composition

### Goal

Art-direct object placement for TKA 3D scenes in Blender. Export transforms back to `placements.ts` files that the app's rendering pipeline already consumes.

### Architecture

```
Blender (visual editor)
    │
    ├─ GLB models imported at positions from placements.ts
    ├─ Ground plane (approximate terrain)
    ├─ Stage platform (cylinder)
    ├─ Lighting (hemisphere + directional + point)
    ├─ Camera (orbit-style)
    └─ Exclusion zone marker (wireframe sphere)
    │
    │  Austen moves/rotates/scales objects in Blender
    │
    ▼
Claude reads via Blender MCP
    │  get_scene_info / execute_blender_code
    │  → reads all object transforms
    │
    ▼
Writes placements.ts
    │  ComposerPlacement[] with position, rotation (quaternion), scale
    │
    ▼
Web app hot-reloads
    │  CrystalFormations.svelte / ReefStructures.svelte
    │  imports placements.ts → renders real scene
```

### Scene Setup Script (Cosmic — First Scene)

A Python script executed via `mcp__blender__execute_blender_code` that:

1. **Clears default scene** (delete cube, keep camera + light as starting points)
2. **Sets coordinate system** — Blender is Z-up natively, Three.js is Y-up. All position data in `placements.ts` uses Y-up. The setup script converts: `blender_x = three_x, blender_y = -three_z, blender_z = three_y`
3. **Creates ground plane** — disc mesh, radius 50m, material color `#0f0f1e` (lunar dark)
4. **Creates stage platform** — cylinder, radius from config (~3m), height 0.1m, semi-transparent material
5. **Imports 7 crystal GLBs** from `static/models/cosmic/`:
   - `crystal-spire-prismatic.glb`
   - `crystal-pyramid-blue.glb`
   - `crystal-cluster-aurora.glb`
   - `crystal-branch-moonlit.glb`
   - `crystal-spire-cyan.glb`
   - `crystal-cluster-emerald.glb`
   - `crystal-spire-amethyst.glb`
6. **Places 24 crystal instances** per current `placements.ts` — position, rotation (quaternion Y→Z converted), scale
7. **Configures lighting:**
   - Hemisphere light approximation: World environment with sky/ground gradient (#1a1a2e / #0f0f1e)
   - Sun lamp: color #4a7ba7, intensity 0.4, direction from [10, 20, 15] (Y→Z converted)
   - Point lamp: color #ffaa00, intensity 1.5, position above stage center
   - **Intensity note:** Blender uses watts, Three.js uses arbitrary units. Manual tuning factor needed — start at 1:1 and adjust visually.
8. **Sets camera** — orbit-style position ~15m from center, looking at origin
9. **Adds exclusion zone** — wireframe sphere at origin, radius 5m, non-renderable (display only)
10. **Sets viewport shading** to Material Preview for approximate visual match

### Sync Flow (Blender → App)

When Austen says "sync to app":

1. Claude calls `execute_blender_code` with a script that iterates all crystal objects, reads their `location`, `rotation_quaternion`, `scale`
2. Converts Z-up → Y-up: `three_x = blender_x, three_y = blender_z, three_z = -blender_y`
3. Converts quaternion: Blender `(w, x, y, z)` → ComposerPlacement `[x, y, z, w]` with Y↔Z swap
4. Writes updated `placements.ts` with the new transforms
5. Vite hot-reloads the app

### Object Naming Convention

Blender objects use format: `{modelType}_{index}` (e.g., `crystal-spire-prismatic_0`, `crystal-cluster-aurora_3`). The sync script parses `objectKey` from the name prefix (everything before the last `_`).

### File Outputs

- `scripts/blender/cosmic-setup.py` — scene setup script (run via MCP)
- `scripts/blender/sync-to-placements.py` — export transforms script (run via MCP)
- Updates to `src/lib/shared/3d/environments/scenes/cosmic/placements.ts`

---

## Phase 2: Full Scene Authoring

### Goal

Graduate from layout-only to authoring more scene elements in Blender — exported terrain, materials, additional decorative objects. The app still handles runtime-only elements (shaders, particles, post-processing).

### Terrain Export Pipeline

The procedural terrain (LunarGroundPlane for Cosmic, ProceduralSeabed for Ocean) is generated at runtime from noise functions. To mirror in Blender:

1. **Build step script** (`scripts/blender/export-terrain.ts`): runs the terrain generation code in Node.js, serializes the resulting mesh geometry as `.glb`
2. **Import in Blender**: terrain mesh with baked vertex colors/materials
3. **Limitation**: terrain is a static snapshot. Config changes require re-export.

### Full Scene glTF Export (Future)

Using `@threlte/gltf` v3.1.0 (current as of May 2026):

```bash
npx @threlte/gltf@latest ./cosmic-scene.glb --transform --types
```

Generates a typed Svelte component with `<T/>` elements for every object. The component can replace or supplement the current hand-coded scene components.

**What transfers via glTF:**
- Object transforms (position, rotation, scale)
- PBR materials (Principled BSDF only)
- Lights: point, spot, directional via KHR_lights_punctual
- Cameras: perspective and orthographic
- Skeletal animations

**What does NOT transfer (stays in code):**
- Custom GLSL shaders (nebula, caustics, water surface, prismatic)
- Particle systems (cosmic dust, energy particles, meteor streaks, bubbles)
- Post-processing (god rays, bloom)
- Procedural animation (fish schooling, jellyfish verlet physics)
- Svelte reactivity and state management
- Area lights, world/environment lighting (no glTF support)

### Light Intensity Gotcha

Blender exports light intensity in watts. Three.js/glTF expects candelas. No automatic conversion exists in the Blender 5.1 glTF exporter. Solutions:
- Manual intensity scaling factor per light type (calibrate once, document)
- Or: skip light export via glTF, keep lights defined in code (simpler for TKA since lights are config-driven)

---

## Phase 3: Animation Pipeline

### Goal

Visualize TKA sequences in Blender — avatars performing letter transitions with correct hand positions, prop rotations, and body poses. Both Blender and the web app consume the same sequence data from the Flow Arts Knowledge MCP server.

### Shared Data Architecture

```
Flow Arts Knowledge MCP (single source of truth)
    │
    get_sequence_data(word, constraintPreset)
    │
    Returns per-step:
    │  - letter
    │  - startPosition (grid location name)
    │  - endPosition (grid location name)
    │  - motionType (shift/dash/static)
    │  - rotation (turns)
    │  - orientation
    │  - timing
    │
    ┌──────┴──────┐
    │             │
TypeScript       Python
(web app)        (Blender)
    │             │
Map grid pos    Map grid pos
→ bone xforms   → IK targets
    │             │
Three.js        bpy keyframes
renders         render/preview
```

No algorithm porting. Both sides consume the same MCP output and map it to their respective animation systems.

### Python Module Structure

All files under `scripts/blender/tka_animation/`:

#### `tka_types.py` (~50 lines)
Enums and dataclasses mirroring the TypeScript domain types:
```python
from enum import Enum
from dataclasses import dataclass

class MotionType(Enum):
    SHIFT = "shift"
    DASH = "dash"
    STATIC = "static"

class GridLocation(Enum):
    NORTH = "n"
    NORTHEAST = "ne"
    EAST = "e"
    SOUTHEAST = "se"
    SOUTH = "s"
    SOUTHWEST = "sw"
    WEST = "w"
    NORTHWEST = "nw"

@dataclass
class SequenceStep:
    letter: str
    start_position: str
    end_position: str
    motion_type: MotionType
    rotation: float
    blue_start: GridLocation
    blue_end: GridLocation
    red_start: GridLocation
    red_end: GridLocation
```

#### `grid_positions.py` (~80 lines)
Maps 8 grid locations to world coordinates with Y↔Z conversion:
```python
import mathutils

GRID_RADIUS = 2.0  # meters from center to cardinal point

# Three.js Y-up positions (canonical)
GRID_POSITIONS_YUP = {
    "n":  (0, GRID_RADIUS, 0),
    "ne": (GRID_RADIUS * 0.707, GRID_RADIUS * 0.707, 0),
    "e":  (GRID_RADIUS, 0, 0),
    # ... all 8 positions
}

def grid_to_blender(location: str) -> mathutils.Vector:
    """Convert grid location name to Blender Z-up coordinates."""
    x, y, z = GRID_POSITIONS_YUP[location]
    return mathutils.Vector((x, -z, y))  # Y-up → Z-up
```

#### `sequence_animator.py` (~200 lines)
Core animation engine:
1. Reads sequence step data (from MCP JSON output or file)
2. For each step/beat:
   - Sets IK target positions for blue hand and red hand at start frame
   - Sets IK target positions at end frame
   - Keyframes prop rotation (staff angle) on prop objects
   - Keyframes torso rotation (performer facing) on spine bone
3. Blender's IK solver automatically calculates arm poses
4. Bezier interpolation between keyframes handles smooth motion

#### `scene_setup.py` (~100 lines)
One-time scene preparation:
1. Import avatar GLB (skeleton + mesh)
2. Create 2 Empty objects as IK targets (`IK_Target_Blue`, `IK_Target_Red`)
3. Add IK constraints to hand bones with chain_count=3 (upper arm → forearm → hand)
4. Import prop GLBs (staff meshes)
5. Parent props to hand bones
6. Set up camera for viewing

### IK-Driven Animation (Why This Works)

TKA defines hand POSITIONS on a grid. The body pose is derived from where the hands need to be. This maps directly to Blender's Inverse Kinematics:

- TKA says "blue hand at south, red hand at east" → set IK target empties to those world positions
- Blender's IK solver calculates shoulder rotation, elbow bend, wrist angle automatically
- No need to port the FK (forward kinematics) arm solver from TypeScript
- Prop rotation is a simple quaternion keyframe on the staff object

### Coordinate System Reference

| Axis | Three.js (Y-up) | Blender (Z-up) |
|------|-----------------|-----------------|
| Right | +X | +X |
| Up | +Y | +Z |
| Forward | -Z | -Y |

**Position conversion:** `(x, y, z)_three → (x, -z, y)_blender`
**Quaternion conversion:** `(x, y, z, w)_three → (w, x, -z, y)_blender`

### MCP Integration

Two options for getting sequence data into Blender:

**Option A (Recommended):** Claude calls `get_sequence_data` via Flow Arts Knowledge MCP, gets JSON, passes it to `execute_blender_code` which runs `sequence_animator.py` with the data inline.

**Option B (Future):** Extend Flow Arts Knowledge MCP with `get_animation_frames(sequence, fps)` tool that returns pre-computed bone transforms per frame. Both web app and Blender consume these directly. Eliminates the Python animation module entirely — but requires MCP server changes.

---

## Scene Roadmap

### Cosmic (First)
- Phase 1: 7 crystal GLBs + ground + stage + lights + 24 placements
- Phase 2: Exported lunar terrain mesh, nebula approximation
- Phase 3: Avatar + staves animation

### Ocean (Second)
- Phase 1: 30+ coral/rock GLBs + seabed approximation + ruins platform
- Phase 2: Exported procedural seabed mesh, water surface proxy
- Phase 3: Same animation pipeline (shared module)

### Other Scenes (Future)
- Forest/Autumn: tree models + campfire + ground
- Winter: ice platform + rock formations
- Each scene reuses the same sync pipeline and animation module

---

## Tools & Versions (Verified May 2026)

| Tool | Version | Purpose |
|------|---------|---------|
| Blender | 5.1 (March 2026) | Scene editor |
| Blender MCP | 1.5.6 (installed) | Claude ↔ Blender bridge |
| @threlte/gltf | 3.1.0 (May 2026) | GLB → typed Svelte component |
| gltf-transform | current | Asset optimization pipeline |
| three-inspect | 0.7.2 | Runtime scene debugging |
| KHR_lights_punctual | glTF 2.0 ext | Light export (point/spot/directional) |
| mathutils | Blender built-in | Quaternion/vector math in Python |

### What Was Evaluated and Rejected

| Tool | Why Rejected |
|------|-------------|
| Needle Engine | Replaces Threlte with its own component system. Good for greenfield, wrong for existing app. |
| Verge3D | Commercial ($290-$2990), wraps Three.js in proprietary runtime |
| Spline | No Blender integration, separate editor |
| Triplex | R3F only, no Svelte/Threlte support |
| USD/USDZ pipeline | Immature for web; glTF is the standard |
| TypeScript→Python transpilers | Fragile for logic; types-only tools exist but manual port is faster for ~400 lines |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Light intensity mismatch (watts vs candelas) | Calibrate scaling factor once per light type; or keep lights in code |
| Blender 5.1 glTF exporter instability | Use for object transforms only (stable); materials/shaders stay in code |
| Quaternion ordering bugs (wxyz vs xyzw) | Conversion functions with unit tests; validate first crystal placement visually |
| IK solver gives unexpected arm poses | Add pole targets for elbow direction; constrain joint limits on import |
| MCP call latency for large scenes | Batch all transforms in single `execute_blender_code` call, not per-object |

---

## Success Criteria

**Phase 1 complete when:**
- [ ] Cosmic scene exists in Blender with all 24 crystal placements matching the app
- [ ] Austen can move/rotate/scale crystals in Blender
- [ ] Claude syncs transforms back to `placements.ts` and app renders correctly
- [ ] Round-trip verified: move crystal in Blender → sync → see change in app

**Phase 2 complete when:**
- [ ] Terrain mesh exported and visible in Blender
- [ ] Full scene glTF export produces a usable Svelte component via @threlte/gltf
- [ ] Ocean scene also set up with coral/rock placements

**Phase 3 complete when:**
- [ ] Avatar imported into Blender with IK constraints on both arms
- [ ] A TKA sequence plays in Blender with correct hand positions per beat
- [ ] Same sequence in web app matches Blender preview (visual parity)
- [ ] Props (staves) rotate correctly per letter definition

---

## References

- [@threlte/gltf documentation](https://threlte.xyz/docs/reference/gltf/getting-started/)
- [Blender 5.1 glTF manual](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [KHR_lights_punctual spec](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_lights_punctual/README.md)
- [Blender IK constraint docs](https://docs.blender.org/manual/en/latest/animation/constraints/tracking/ik_solver.html)
- [Blender Python KinematicConstraint API](https://docs.blender.org/api/current/bpy.types.KinematicConstraint.html)
- [three-inspect (GitHub)](https://github.com/threlte/three-inspect)
- [Needle Engine](https://needle.tools/) (evaluated, not adopted)
- [CGWire — Forward vs Inverse Kinematics in Blender 2026](https://blog.cg-wire.com/forward-vs-inverse-kinematics-blender/)
