# Blender Cosmic Scene Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Cosmic scene in Blender via MCP, import all 7 crystal GLB models at their current placement positions, configure lighting/ground/camera to approximate the web app, and build a sync-back script that exports Blender transforms to `placements.ts`.

**Architecture:** Two Python scripts executed via `mcp__blender__execute_blender_code`: (1) a setup script that builds the full Cosmic scene in Blender from scratch, and (2) a sync script that reads all crystal transforms from Blender and writes them back to `placements.ts`. Both scripts live in `scripts/blender/` for reuse.

**Tech Stack:** Blender 5.1 Python API (bpy), Blender MCP (execute_blender_code), TypeScript (placements.ts output)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/blender/cosmic_setup.py` | Create | Builds full Cosmic scene in Blender: imports GLBs, places crystals, creates ground/platform/lights/camera/exclusion zone |
| `scripts/blender/sync_to_placements.py` | Create | Reads all crystal object transforms from Blender, converts Z-up → Y-up, outputs TypeScript `placements.ts` content |
| `src/lib/shared/3d/environments/scenes/cosmic/placements.ts` | Modify (by sync script) | Updated with new transforms after Blender art direction |

---

## Task 1: Build the Cosmic Scene Setup Script

**Files:**
- Create: `scripts/blender/cosmic_setup.py`

This is the big task — one Python script that builds the entire scene. It will be executed via `mcp__blender__execute_blender_code` as a single call.

- [ ] **Step 1: Create the scripts/blender directory**

```bash
mkdir -p scripts/blender
```

- [ ] **Step 2: Write `cosmic_setup.py`**

Create `scripts/blender/cosmic_setup.py` with the full scene setup script:

```python
"""
Cosmic Scene Setup for Blender
Imports crystal GLBs, places them per placements.ts, adds ground/platform/lighting/camera.
Run via: mcp__blender__execute_blender_code

Coordinate conversion: Three.js Y-up → Blender Z-up
  position: (x, y, z)_three → (x, -z, y)_blender
  quaternion: [x, y, z, w]_three → (w, x, -z, y)_blender
"""

import bpy
import os
import math
from mathutils import Vector, Quaternion

# ── Configuration ──────────────────────────────────────────────────────────────

MODEL_DIR = r"E:\tka-platform\static\models\cosmic"

CRYSTAL_MODELS = [
    "crystal-spire-prismatic",
    "crystal-pyramid-blue",
    "crystal-cluster-aurora",
    "crystal-branch-moonlit",
    "crystal-spire-cyan",
    "crystal-cluster-emerald",
    "crystal-spire-amethyst",
]

# From placements.ts — Three.js Y-up coordinates
# rotation is [x, y, z, w] quaternion (Y-axis rotation only)
PLACEMENTS = [
    {"id": "cosmic-0",  "key": "crystal-spire-amethyst",   "pos": [-12, 0, -10],     "rotY": 0.3,  "scale": 0.9},
    {"id": "cosmic-1",  "key": "crystal-cluster-emerald",  "pos": [-10.5, 0, -11.5], "rotY": 1.2,  "scale": 0.6},
    {"id": "cosmic-2",  "key": "crystal-spire-amethyst",   "pos": [-13.5, 0, -8.5],  "rotY": 2.1,  "scale": 0.5},
    {"id": "cosmic-3",  "key": "crystal-cluster-emerald",  "pos": [-11, 0, -9],      "rotY": 0.8,  "scale": 0.35},
    {"id": "cosmic-4",  "key": "crystal-spire-amethyst",   "pos": [-14, 0, -11],     "rotY": 1.5,  "scale": 0.4},
    {"id": "cosmic-5",  "key": "crystal-spire-cyan",       "pos": [-8, 0, -14],      "rotY": 0.6,  "scale": 0.7},
    {"id": "cosmic-6",  "key": "crystal-spire-cyan",       "pos": [-9.5, 0, -15.5],  "rotY": 2.4,  "scale": 0.4},
    {"id": "cosmic-7",  "key": "crystal-cluster-aurora",   "pos": [-7, 0, -13],      "rotY": 1.8,  "scale": 0.45},
    {"id": "cosmic-8",  "key": "crystal-spire-prismatic",  "pos": [-16, 0, -5],      "rotY": 0.2,  "scale": 0.8},
    {"id": "cosmic-9",  "key": "crystal-pyramid-blue",     "pos": [-15, 0, -3.5],    "rotY": 1.0,  "scale": 0.55},
    {"id": "cosmic-10", "key": "crystal-spire-prismatic",  "pos": [-17, 0, -6.5],    "rotY": 1.6,  "scale": 0.4},
    {"id": "cosmic-11", "key": "crystal-pyramid-blue",     "pos": [9, 0, -7],        "rotY": -0.5, "scale": 0.7},
    {"id": "cosmic-12", "key": "crystal-spire-prismatic",  "pos": [10.5, 0, -8.5],   "rotY": 0.4,  "scale": 0.45},
    {"id": "cosmic-13", "key": "crystal-pyramid-blue",     "pos": [8, 0, -6],        "rotY": 1.2,  "scale": 0.3},
    {"id": "cosmic-14", "key": "crystal-cluster-aurora",   "pos": [-7, 0, 8],        "rotY": 2.2,  "scale": 0.6},
    {"id": "cosmic-15", "key": "crystal-branch-moonlit",   "pos": [-6, 0, 9.5],      "rotY": 1.1,  "scale": 0.4},
    {"id": "cosmic-16", "key": "crystal-spire-amethyst",   "pos": [14, 0, 12],       "rotY": -1.8, "scale": 1.0},
    {"id": "cosmic-17", "key": "crystal-cluster-emerald",  "pos": [15, 0, 13],       "rotY": 0.3,  "scale": 0.35},
    {"id": "cosmic-18", "key": "crystal-spire-cyan",       "pos": [16, 0, -13],      "rotY": -0.5, "scale": 0.6},
    {"id": "cosmic-19", "key": "crystal-branch-moonlit",   "pos": [5, 0, 10],        "rotY": 1.4,  "scale": 0.45},
    {"id": "cosmic-20", "key": "crystal-cluster-emerald",  "pos": [6, 0, 9],         "rotY": 0.8,  "scale": 0.3},
    {"id": "cosmic-21", "key": "crystal-spire-prismatic",  "pos": [-4, 0, -16],      "rotY": 0.9,  "scale": 0.3},
    {"id": "cosmic-22", "key": "crystal-pyramid-blue",     "pos": [12, 0, -3],       "rotY": 1.7,  "scale": 0.35},
    {"id": "cosmic-23", "key": "crystal-cluster-aurora",   "pos": [-16, 0, 7],       "rotY": 0.4,  "scale": 0.4},
]

# Scene config values from createDefaultCosmicNightConfig()
GROUND_COLOR = (0x1a / 255, 0x1a / 255, 0x2e / 255, 1.0)
GROUND_SIZE = 60
PLATFORM_RADIUS = 3.5
PLATFORM_HEIGHT = 0.4
PLATFORM_COLOR = (0x0a / 255, 0x0a / 255, 0x1a / 255, 1.0)
SKY_TOP = (0x05 / 255, 0x05 / 255, 0x10 / 255, 1.0)
FOG_COLOR = (0x08 / 255, 0x08 / 255, 0x18 / 255, 1.0)
FOG_DENSITY = 0.008
EXCLUSION_RADIUS = 5.0

# Lighting from config
AMBIENT_SKY = (0x2a / 255, 0x2a / 255, 0x55 / 255, 1.0)
AMBIENT_GROUND = (0x15 / 255, 0x15 / 255, 0x25 / 255, 1.0)
DIR_LIGHT_COLOR = (0x88 / 255, 0x99 / 255, 0xdd / 255, 1.0)
DIR_LIGHT_INTENSITY = 1.2
DIR_LIGHT_POS_THREE = (-30, 20, -40)  # Y-up
WARM_LIGHT_COLOR = (0x66 / 255, 0x88 / 255, 0xbb / 255, 1.0)
WARM_LIGHT_INTENSITY = 25
WARM_LIGHT_DISTANCE = 12


# ── Coordinate conversion helpers ─────────────────────────────────────────────

def three_to_blender_pos(x, y, z):
    """Convert Three.js Y-up position to Blender Z-up."""
    return Vector((x, -z, y))

def rotY_to_blender_quat(rot_y):
    """Convert a Y-axis rotation (radians) to a Blender Z-up quaternion.
    In Three.js, Y is up, so rotation around Y = rotation around Blender Z."""
    return Quaternion((0, 0, 1), rot_y)


# ── Scene cleanup ─────────────────────────────────────────────────────────────

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for col in bpy.data.collections:
        if col.name != "Scene Collection":
            bpy.data.collections.remove(col)


# ── Import and cache GLB templates ────────────────────────────────────────────

def import_glb_templates():
    """Import each GLB once as a template, then hide it. Placements are linked duplicates."""
    templates = {}
    template_col = bpy.data.collections.new("_Templates")
    bpy.context.scene.collection.children.link(template_col)

    for model_name in CRYSTAL_MODELS:
        glb_path = os.path.join(MODEL_DIR, f"{model_name}.glb")
        if not os.path.exists(glb_path):
            print(f"WARNING: Missing GLB: {glb_path}")
            continue

        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=glb_path)
        after = set(bpy.data.objects.keys())
        new_objs = after - before

        if not new_objs:
            print(f"WARNING: No objects imported from {glb_path}")
            continue

        root = bpy.data.objects[sorted(new_objs)[0]]

        for obj_name in new_objs:
            obj = bpy.data.objects[obj_name]
            for col in obj.users_collection:
                col.objects.unlink(obj)
            template_col.objects.link(obj)

        root.name = f"_template_{model_name}"
        root.hide_set(True)
        root.hide_render = True
        templates[model_name] = root

    template_col.hide_viewport = True
    return templates


# ── Place crystals ────────────────────────────────────────────────────────────

def place_crystals(templates):
    crystal_col = bpy.data.collections.new("Crystals")
    bpy.context.scene.collection.children.link(crystal_col)

    for p in PLACEMENTS:
        key = p["key"]
        template = templates.get(key)
        if not template:
            print(f"WARNING: No template for {key}, skipping {p['id']}")
            continue

        obj = template.copy()
        if template.data:
            obj.data = template.data.copy()

        obj.name = f"{key}_{p['id'].split('-')[-1]}"
        obj.hide_set(False)
        obj.hide_render = False

        bpos = three_to_blender_pos(*p["pos"])
        obj.location = bpos

        bquat = rotY_to_blender_quat(p["rotY"])
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = bquat

        s = p["scale"]
        obj.scale = (s, s, s)

        obj["tka_id"] = p["id"]
        obj["tka_objectKey"] = key

        crystal_col.objects.link(obj)

    return crystal_col


# ── Ground plane ──────────────────────────────────────────────────────────────

def create_ground():
    bpy.ops.mesh.primitive_plane_add(size=GROUND_SIZE * 2, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "LunarGround"

    mat = bpy.data.materials.new("LunarGround_Mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = GROUND_COLOR
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.1
    ground.data.materials.append(mat)
    return ground


# ── Stage platform ────────────────────────────────────────────────────────────

def create_platform():
    bpy.ops.mesh.primitive_cylinder_add(
        radius=PLATFORM_RADIUS,
        depth=PLATFORM_HEIGHT,
        location=(0, 0, PLATFORM_HEIGHT / 2),
    )
    platform = bpy.context.active_object
    platform.name = "StationPlatform"

    mat = bpy.data.materials.new("Platform_Mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = PLATFORM_COLOR
    bsdf.inputs["Metallic"].default_value = 0.8
    bsdf.inputs["Roughness"].default_value = 0.2
    bsdf.inputs["Emission Color"].default_value = (0x44 / 255, 0x88 / 255, 0xff / 255, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.6
    platform.data.materials.append(mat)
    return platform


# ── Lighting ──────────────────────────────────────────────────────────────────

def setup_lighting():
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("CosmicWorld")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs["Color"].default_value = SKY_TOP
        bg_node.inputs["Strength"].default_value = 0.3

    dir_pos = three_to_blender_pos(*DIR_LIGHT_POS_THREE)
    bpy.ops.object.light_add(type='SUN', location=dir_pos)
    sun = bpy.context.active_object
    sun.name = "ColdDirectional"
    sun.data.color = DIR_LIGHT_COLOR[:3]
    sun.data.energy = DIR_LIGHT_INTENSITY

    target_dir = Vector((0, 0, 0)) - dir_pos
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = target_dir.to_track_quat('-Z', 'Y')

    warm_pos = Vector((0, 0, 0.5))
    bpy.ops.object.light_add(type='POINT', location=warm_pos)
    warm = bpy.context.active_object
    warm.name = "WarmStation"
    warm.data.color = WARM_LIGHT_COLOR[:3]
    warm.data.energy = WARM_LIGHT_INTENSITY
    warm.data.shadow_soft_size = WARM_LIGHT_DISTANCE

    return sun, warm


# ── Camera ────────────────────────────────────────────────────────────────────

def setup_camera():
    cam_pos = three_to_blender_pos(12, 8, -12)
    bpy.ops.object.camera_add(location=cam_pos)
    cam = bpy.context.active_object
    cam.name = "OrbitCamera"

    target = Vector((0, 0, 1.5))
    direction = target - cam_pos
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = direction.to_track_quat('-Z', 'Y')

    cam.data.lens = 50
    cam.data.clip_start = 0.1
    cam.data.clip_end = 200

    bpy.context.scene.camera = cam
    return cam


# ── Exclusion zone marker ────────────────────────────────────────────────────

def create_exclusion_zone():
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=EXCLUSION_RADIUS,
        segments=32,
        ring_count=16,
        location=(0, 0, EXCLUSION_RADIUS / 2),
    )
    zone = bpy.context.active_object
    zone.name = "ExclusionZone_5m"
    zone.display_type = 'WIRE'
    zone.hide_render = True

    mat = bpy.data.materials.new("ExclusionZone_Mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1.0, 0.2, 0.2, 0.3)
    bsdf.inputs["Alpha"].default_value = 0.1
    mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
    zone.data.materials.append(mat)
    return zone


# ── Fog approximation ────────────────────────────────────────────────────────

def setup_fog():
    world = bpy.context.scene.world
    if not world or not world.use_nodes:
        return
    nodes = world.node_tree.nodes
    links = world.node_tree.links

    volume_scatter = nodes.new(type='ShaderNodeVolumeScatter')
    volume_scatter.inputs["Color"].default_value = FOG_COLOR
    volume_scatter.inputs["Density"].default_value = FOG_DENSITY * 10

    output = nodes.get("World Output")
    if output:
        links.new(volume_scatter.outputs["Volume"], output.inputs["Volume"])


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== TKA Cosmic Scene Setup ===")

    print("Clearing scene...")
    clear_scene()

    print("Creating ground plane...")
    create_ground()

    print("Creating stage platform...")
    create_platform()

    print("Importing crystal GLB templates...")
    templates = import_glb_templates()
    print(f"  Loaded {len(templates)} / {len(CRYSTAL_MODELS)} models")

    print("Placing 24 crystals...")
    place_crystals(templates)

    print("Setting up lighting...")
    setup_lighting()

    print("Setting up camera...")
    setup_camera()

    print("Creating exclusion zone marker...")
    create_exclusion_zone()

    print("Setting up fog...")
    setup_fog()

    bpy.context.view_layer.update()

    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    break

    print("=== Cosmic Scene Setup Complete ===")
    print(f"  Objects: {len(bpy.data.objects)}")
    print(f"  Crystal placements: {len(PLACEMENTS)}")
    print(f"  Exclusion zone: {EXCLUSION_RADIUS}m radius")


main()
```

- [ ] **Step 3: Verify the script file exists**

```bash
ls scripts/blender/cosmic_setup.py
```

Expected: file listed.

- [ ] **Step 4: Execute the setup script in Blender via MCP**

Call `mcp__blender__execute_blender_code` with the entire content of `scripts/blender/cosmic_setup.py`.

Expected output: Print statements showing each step completing, final summary with object count.

- [ ] **Step 5: Verify scene in Blender via MCP**

Call `mcp__blender__get_scene_info` to confirm:
- Object count should be ~30+ (24 crystals + ground + platform + 2 lights + camera + exclusion zone + template collection)
- Crystal objects should have names matching `crystal-*_N` pattern
- Lights named "ColdDirectional" and "WarmStation"

- [ ] **Step 6: Take a viewport screenshot**

Call `mcp__blender__get_viewport_screenshot` to visually verify the scene layout.

- [ ] **Step 7: Commit**

```bash
git add scripts/blender/cosmic_setup.py
git commit -m "feat(blender): add Cosmic scene setup script for Blender MCP

Imports 7 crystal GLBs, places 24 instances per placements.ts,
creates ground plane, stage platform, lighting, camera, and
exclusion zone marker. Converts Three.js Y-up to Blender Z-up."
```

---

## Task 2: Build the Sync-Back Script

**Files:**
- Create: `scripts/blender/sync_to_placements.py`

This script reads crystal transforms from Blender and outputs TypeScript `placements.ts` content.

- [ ] **Step 1: Write `sync_to_placements.py`**

Create `scripts/blender/sync_to_placements.py`:

```python
"""
Sync Blender crystal transforms back to placements.ts
Reads all objects in the "Crystals" collection, converts Blender Z-up → Three.js Y-up,
and outputs the TypeScript file content.

Run via: mcp__blender__execute_blender_code
Output: prints the full placements.ts content to stdout (Claude captures and writes to file)
"""

import bpy
import json
import math
from mathutils import Quaternion

def blender_to_three_pos(loc):
    """Convert Blender Z-up position to Three.js Y-up."""
    return (round(loc.x, 2), round(loc.z, 2), round(-loc.y, 2))

def blender_quat_to_rotY(quat):
    """Extract Y-axis rotation (Three.js) from Blender quaternion.
    In Blender, what was a Y rotation in Three.js is a Z rotation."""
    euler = quat.to_euler('XYZ')
    return round(euler.z, 4)

def main():
    crystals_col = bpy.data.collections.get("Crystals")
    if not crystals_col:
        print("ERROR: No 'Crystals' collection found")
        return

    placements = []
    for obj in sorted(crystals_col.objects, key=lambda o: o.name):
        tka_id = obj.get("tka_id", obj.name)
        tka_key = obj.get("tka_objectKey", "")

        if not tka_key:
            parts = obj.name.rsplit("_", 1)
            tka_key = parts[0] if len(parts) > 1 else obj.name

        pos = blender_to_three_pos(obj.location)
        rot_y = blender_quat_to_rotY(obj.rotation_quaternion)
        scale = round(obj.scale.x, 2)

        placements.append({
            "id": tka_id,
            "objectKey": tka_key,
            "position": list(pos),
            "rotY": rot_y,
            "scale": scale,
        })

    # Generate TypeScript output
    lines = [
        'import type { ComposerPlacement } from "$lib/shared/3d/scene-composer/types";',
        '',
        'function q(rotY: number): [number, number, number, number] {',
        '\treturn [0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2)];',
        '}',
        '',
        'export const COSMIC_PLACEMENTS: ComposerPlacement[] = [',
    ]

    for p in placements:
        lines.append('\t{')
        lines.append(f'\t\tid: "{p["id"]}",')
        lines.append(f'\t\tobjectKey: "{p["objectKey"]}",')
        lines.append(f'\t\tposition: [{p["position"][0]}, {p["position"][1]}, {p["position"][2]}],')
        lines.append(f'\t\trotation: q({p["rotY"]}),')
        lines.append(f'\t\tscale: [{p["scale"]}, {p["scale"]}, {p["scale"]}],')
        lines.append('\t},')

    lines.append('];')
    lines.append('')

    output = '\n'.join(lines)
    print("__PLACEMENTS_TS_START__")
    print(output)
    print("__PLACEMENTS_TS_END__")

main()
```

- [ ] **Step 2: Test the sync script (dry run)**

Call `mcp__blender__execute_blender_code` with the content of `sync_to_placements.py`.

Expected: Output between `__PLACEMENTS_TS_START__` and `__PLACEMENTS_TS_END__` markers should be valid TypeScript matching the current `placements.ts` structure. Positions should round-trip back to the original values (within floating point tolerance).

- [ ] **Step 3: Verify round-trip fidelity**

Compare a few crystal positions from the sync output against the original `placements.ts` values:
- `cosmic-0`: should be position `[-12, 0, -10]`, rotY `0.3`, scale `0.9`
- `cosmic-16`: should be position `[14, 0, 12]`, rotY `-1.8`, scale `1.0`

Any deviation beyond ±0.01 indicates a coordinate conversion bug.

- [ ] **Step 4: Commit**

```bash
git add scripts/blender/sync_to_placements.py
git commit -m "feat(blender): add sync script to export Blender transforms to placements.ts

Reads crystal objects from Blender Crystals collection,
converts Z-up to Y-up, outputs TypeScript placements.ts format.
Uses sentinel markers for Claude to extract the content."
```

---

## Task 3: End-to-End Validation

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/cosmic/placements.ts` (test round-trip)

- [ ] **Step 1: Move one crystal in Blender**

Call `mcp__blender__execute_blender_code` with:

```python
import bpy
obj = bpy.data.objects.get("crystal-spire-amethyst_0")
if obj:
    obj.location.x += 2.0  # shift 2m in Blender X (= Three.js X)
    print(f"Moved {obj.name} to {obj.location}")
else:
    print("Object not found")
```

- [ ] **Step 2: Run sync script to capture new transforms**

Execute `sync_to_placements.py` via MCP. Extract the TypeScript content between the sentinel markers.

- [ ] **Step 3: Verify the moved crystal has updated position**

In the output, `cosmic-0` should now show position `[-10, 0, -10]` (was `[-12, 0, -10]`, shifted +2 in X).

- [ ] **Step 4: Write the updated placements.ts**

Write the extracted TypeScript content to `src/lib/shared/3d/environments/scenes/cosmic/placements.ts`.

- [ ] **Step 5: Verify app still builds**

```bash
npm run check
```

Expected: No type errors. The placements.ts format is unchanged — same imports, same types, same structure.

- [ ] **Step 6: Revert the test change**

Restore the original `placements.ts` (the test was just to prove the pipeline works):

```bash
git checkout -- src/lib/shared/3d/environments/scenes/cosmic/placements.ts
```

- [ ] **Step 7: Take final Blender screenshot for visual comparison**

Call `mcp__blender__get_viewport_screenshot` to capture the scene for Austen to compare against the web app.

- [ ] **Step 8: Commit all scripts**

If not already committed, ensure both scripts are committed:

```bash
git status
```

---

## Task 4: Document the Workflow

**Files:**
- Create: `scripts/blender/README.md`

- [ ] **Step 1: Write usage documentation**

Create `scripts/blender/README.md`:

```markdown
# Blender Scene Scripts

Scripts for art-directing TKA 3D scenes in Blender via Claude + Blender MCP.

## Prerequisites

- Blender 5.1+ running with BlenderMCP addon active on port 9876
- Claude Code with `blender` MCP server connected

## Cosmic Scene

### Initial Setup

Tell Claude: "Run the cosmic setup script in Blender"

Claude executes `cosmic_setup.py` via MCP, which:
- Imports 7 crystal GLB models from `static/models/cosmic/`
- Places 24 crystal instances per `placements.ts`
- Creates ground plane, stage platform, lighting, camera
- Adds exclusion zone marker (5m wireframe sphere)

### Art Direction

Move, rotate, and scale crystals directly in Blender. Stay outside the
5m exclusion zone (wireframe sphere around the stage).

### Sync Back to App

Tell Claude: "Sync the Blender crystals back to the app"

Claude executes `sync_to_placements.py`, reads all transforms, converts
Blender Z-up to Three.js Y-up, and writes updated `placements.ts`.
The app hot-reloads with the new positions.

## Coordinate Systems

| Axis | Three.js (Y-up) | Blender (Z-up) |
|------|------------------|-----------------|
| Right | +X | +X |
| Up | +Y | +Z |
| Forward | -Z | -Y |

Conversions are handled automatically by the scripts.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/blender/README.md
git commit -m "docs: add Blender workflow documentation for scene scripts"
```
