# Fathom Ocean — World Boundary and Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ocean's flat 2,561-vert seabed plate with generated terrain that bounds the world with geology — a reef wall upstage, a drop into the abyss elsewhere — so the scene stops reading as a ring floating in a void.

**Architecture:** A pure-Python height function (`ocean_terrain_profile.py`, no `bpy`, therefore unit-testable) is consumed by a Blender build script (`build-ocean-terrain.py`) that generates a 128×192 polar mesh, exactly mirroring `scripts/build-winter-environment.py`. Depth darkness comes from two cooperating parts: a camera-locked gradient dome on the `SkyGradient` pattern, and a baked vertex-colour ramp on terrain below the shelf lip. The camera clamps below the water plane so the unsupported above-water state cannot be reached.

**Tech Stack:** Blender 5.0 Python API (`bpy`), Three.js / Threlte (Svelte 5 runes), `gltf-transform`, Cloudflare R2.

**Design:** `docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md`

---

## Coordinate System — read this before any task

Getting this wrong silently produces a wall in the wrong place.

- **Blender is Z-up.** `x`/`y` are horizontal, `z` is height. Runtime applies Z-up→Y-up as `(x, z, -y)`.
- **Seabed top sits at Blender `z = 0`.** All heights below are Blender Z.
- **The water plane is 12 m above the seabed**, Blender `z = +12`. (Runtime: `groundY = -1.5`, `waterY = groundY + 12 = +10.5`.)
- **North is `+y` in Blender, which is `-z` in three.js.** North is **upstage** — the `proscenium-arch-north` zone is there, and the default camera sits at three.js `z = +19` looking toward `-z`. The wall goes on `+y`.

## Blender is not on PATH

Every Blender invocation in this plan uses the full path:

```bash
"/c/Program Files/Blender Foundation/Blender 5.0/blender.exe"
```

## File Structure

Build-time (Python / Blender):

| File | Task | Responsibility |
|---|---|---|
| `scripts/ocean_terrain_profile.py` | 2 | **Create.** Pure height/UV/darkening math. No `bpy` import — that is what makes it testable. |
| `scripts/test_ocean_terrain_profile.py` | 2 | **Create.** Plain-python assertions over the profile. |
| `scripts/build-ocean-terrain.py` | 3 | **Create.** Mesh generation; replaces the `Seabed` object. |
| `scripts/wire-ocean-depth-colour.py` | 4 | **Create.** Multiplies the baked depth colour into seabed albedo. Idempotent. |
| `scripts/ocean-zone-layout.json` | 5 | **Modify.** `outerBoundaryMetres` 20 → 24. |
| `scripts/retune-ocean-palette.py` | 6 | **Create.** Two hue families plus one allow-listed accent. |
| `scripts/dress-ocean-wall.py` | 11 | **Create, conditional.** Linked-duplicate rock band on the wall face. |

Runtime (Svelte / TypeScript):

| File | Task | Responsibility |
|---|---|---|
| `.../scenes/ocean/runtime/OceanDepthGradient.svelte` | 8 | **Create.** Camera-locked depth dome — the abyss. |
| `.../scenes/ocean/OceanScene.svelte` | 8 | **Modify.** Render the gradient dome. |
| `.../scenes/ocean/ocean-camera-bounds.ts` | 9 | **Create.** Preset clamp below the water plane. |
| `tests/unit/ocean-camera-bounds.test.ts` | 9 | **Create.** Clamp behaviour. |
| `src/routes/test/ocean-scene/+page.svelte` | 9 | **Modify.** Apply the clamp; `?clamp=0` escape for verification. |

All Svelte paths above are under
`src/lib/shared/3d/environments/`.

**`EnvironmentReviewCamera.svelte` is deliberately NOT modified.** Four other
scenes use it and must keep free cameras; the ocean's constraint is the ocean's
to own. See Task 9.

---

### Task 1: Snapshot the blend before anything destructive

The repo convention is a `.pre-<pass>.blend` snapshot before each destructive pass (`ocean_scene.pre-dais.blend`, `.pre-pass3.blend`, `.pre-zone-pass.blend`, `.pre-refine-pass.blend` all exist). This task is not optional — the terrain replacement deletes the `Seabed` object.

**Files:**
- Create: `blender/ocean_scene.pre-terrain.blend`

- [ ] **Step 1: Copy the blend**

```bash
cd E:/tka-platform && cp blender/ocean_scene.blend blender/ocean_scene.pre-terrain.blend
```

- [ ] **Step 2: Verify the snapshot is a real file of the same size**

```bash
cd E:/tka-platform && ls -la blender/ocean_scene.blend blender/ocean_scene.pre-terrain.blend
```

Expected: two files, byte sizes identical.

- [ ] **Step 3: Do NOT commit the snapshot**

`.blend` snapshots are large binaries. Confirm git ignores it or leave it untracked:

```bash
cd E:/tka-platform && git status --short blender/ | head
```

Expected: `ocean_scene.pre-terrain.blend` either absent (ignored) or shown as untracked `??`. Do not `git add` it.

---

### Task 2: The height function, test-first

This is the only genuinely unit-testable piece and it is where all the design decisions live. It imports nothing from Blender, so it runs under plain python.

**Files:**
- Create: `scripts/ocean_terrain_profile.py`
- Test: `scripts/test_ocean_terrain_profile.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/test_ocean_terrain_profile.py`:

```python
"""Assertions over the ocean terrain profile. Runs without Blender.

Every number here traces to
docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md.
Heights are Blender Z: seabed top is 0, the water plane is +12.
"""

import math
import sys

from ocean_terrain_profile import (
    CLEARING_RADIUS,
    SHELF_OUTER_RADIUS,
    WATER_PLANE_Z,
    WORLD_RADIUS,
    ABYSS_DEPTH,
    depth_darkening,
    lip_radius,
    ocean_floor_height,
)

FAILURES = []


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label} {detail}")
        FAILURES.append(label)


def sample_ring(radius, count=64):
    """Yield (x, y, height) evenly around a ring."""
    for index in range(count):
        angle = math.tau * index / count
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius
        yield x, y, ocean_floor_height(x, y)


print("clearing is mathematically flat")
flat = [h for r in (0.0, 2.0, 5.0, 7.9) for _, _, h in sample_ring(r)]
check(
    "every sample inside the clearing is exactly 0.0",
    all(h == 0.0 for h in flat),
    f"max abs deviation {max(abs(h) for h in flat)}",
)

print("shelf relief stays inside the ground-snap tolerance")
# 348 objects re-snap onto this. Relief steeper than the tolerance tilts coral
# that was authored on a flat plate.
shelf = [h for r in (9.0, 12.0, 16.0, 20.0) for _, _, h in sample_ring(r)]
check(
    "shelf relief within +/- 0.6 m out to r=20",
    all(abs(h) <= 0.6 for h in shelf),
    f"max abs {max(abs(h) for h in shelf):.3f}",
)
# At the outer rim the wall has begun to climb on the north side. That is
# correct — the wall has to meet the shelf somewhere — but it must stay gentle
# enough that the outermost placements do not end up on a slope.
rim_north = ocean_floor_height(0.0, 24.0)
check(
    "north rim rise at the lip stays under 1.5 m",
    rim_north < 1.5,
    f"{rim_north:.2f} m",
)

print("the upstage wall crests above the water plane")
north = [ocean_floor_height(0.0, r) for r in (32.0, 34.0, 36.0, 38.0)]
check(
    "due north crests above the water plane",
    max(north) > WATER_PLANE_Z,
    f"max {max(north):.2f} vs water {WATER_PLANE_Z}",
)

print("the wall is directional, not a ring")
south_far = [ocean_floor_height(0.0, -r) for r in (32.0, 34.0, 36.0, 38.0)]
check(
    "due south at the same radii is far below the water plane",
    max(south_far) < 0.0,
    f"max {max(south_far):.2f}",
)
check(
    "north and south differ by more than the abyss depth",
    max(north) - max(south_far) > ABYSS_DEPTH,
)

print("the shelf lip is irregular, never a circle")
lips = [lip_radius(math.tau * i / 64) for i in range(64)]
check(
    "lip radius varies by at least 3 m across directions",
    max(lips) - min(lips) >= 3.0,
    f"min {min(lips):.2f} max {max(lips):.2f}",
)
check(
    "lip radius stays within +/- 3 m of the nominal shelf outer radius",
    all(abs(r - SHELF_OUTER_RADIUS) <= 3.0 for r in lips),
)

print("the abyss actually plunges")
south_deep = [ocean_floor_height(0.0, -r) for r in (40.0, 60.0, 90.0)]
# Tolerance of 1 m: shelf_relief still contributes up to +0.56 m in the abyss,
# so an exact -ABYSS_DEPTH assertion would be flaky by design.
check(
    "south floor reaches the authored abyss depth within 1 m",
    min(south_deep) <= -(ABYSS_DEPTH - 1.0),
    f"min {min(south_deep):.2f} vs -{ABYSS_DEPTH}",
)

print("height is continuous — no cliffs the mesh cannot represent")
worst_step = 0.0
worst_at = None
for angle_index in range(48):
    angle = math.tau * angle_index / 48
    previous = None
    radius = 0.0
    while radius <= WORLD_RADIUS:
        x, y = math.cos(angle) * radius, math.sin(angle) * radius
        height = ocean_floor_height(x, y)
        if previous is not None and abs(height - previous) > worst_step:
            worst_step = abs(height - previous)
            worst_at = (round(radius, 1), round(math.degrees(angle)))
        previous = height
        radius += 0.5
check(
    "no 0.5 m radial step changes height by more than 8 m",
    worst_step <= 8.0,
    f"worst {worst_step:.2f} m at radius/bearing {worst_at}",
)

print("depth darkening ramps the right way")
check("shelf height is undarkened", depth_darkening(0.0) == 0.0)
check("deep abyss is fully darkened", depth_darkening(-ABYSS_DEPTH) == 1.0)
check(
    "darkening is monotonic downward",
    all(
        depth_darkening(-z) <= depth_darkening(-z - 1.0)
        for z in range(0, int(ABYSS_DEPTH))
    ),
)

print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED: {', '.join(FAILURES)}")
    sys.exit(1)
print("all ocean terrain profile checks passed")
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd E:/tka-platform/scripts && python test_ocean_terrain_profile.py
```

Expected: `ModuleNotFoundError: No module named 'ocean_terrain_profile'`

- [ ] **Step 3: Write the profile module**

Create `scripts/ocean_terrain_profile.py`:

```python
"""Ocean floor height, UV and depth-darkening math for the Fathom reef.

Pure math, no `bpy`. Kept separate from build-ocean-terrain.py so the shape of
the world can be tested without launching Blender.

Coordinates are Blender's: x/y horizontal, z up. The seabed top is z = 0 and
the water plane is z = +12. North (+y) is upstage, behind the proscenium arch.

Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
"""

import math

CLEARING_RADIUS = 8.0
SHELF_OUTER_RADIUS = 24.0
WATER_PLANE_Z = 12.0
WALL_CREST_Z = 15.0
# Starts at 22, not 16: placements now run to the 24 m lip, and a wall ramping
# from 16 puts ~1.9 m of rise under coral at r=20 that was authored on a flat
# plate. From 22 the shelf stays walkable and the wall climbs mostly outside
# the placement boundary.
WALL_RAMP_START = 22.0
WALL_RAMP_END = 34.0
ABYSS_DEPTH = 45.0
ABYSS_RAMP_METRES = 10.0
WORLD_RADIUS = 110.0
TERRAIN_ANGULAR_SEGMENTS = 192
TERRAIN_RADIAL_SEGMENTS = 128
TERRAIN_UV_METRES = 12.0
DARKEN_START_Z = -2.0
DARKEN_FULL_Z = -38.0


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0 if value < edge0 else 1.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def north_gate(x, y):
    """1.0 due north, 0.0 due south, smooth across east and west.

    Gates the wall onto the upstage half without producing a seam at the
    east/west meridian, which a hard `y > 0` test would.
    """
    radius = math.hypot(x, y)
    if radius < 1e-6:
        return 0.0
    return smoothstep(-0.15, 0.55, y / radius)


def lip_radius(angle):
    """Where the shelf ends and the abyss begins, for one direction.

    Three harmonics, same technique as build-winter-environment.py's
    terrain_boundary_radius. Amplitude sums to +/- 2.5 m on a 24 m nominal
    radius, holding the siblings' ~10% proportion so the edge is never a circle.
    """
    return (
        SHELF_OUTER_RADIUS
        + 1.3 * math.sin(angle * 3.0 + 0.7)
        + 0.8 * math.sin(angle * 5.0 - 1.1)
        + 0.4 * math.cos(angle * 9.0 + 0.2)
    )


def shelf_relief(x, y, radius):
    """Gentle broken ground across the reef shelf.

    Capped at +/- 0.6 m deliberately: 348 objects re-run ground_snap against
    this surface, and steeper relief tilts coral that was authored flat.
    """
    gate = smoothstep(CLEARING_RADIUS, CLEARING_RADIUS + 3.0, radius)
    return gate * (
        0.26 * math.sin(x * 0.29 + y * 0.19)
        + 0.19 * math.sin(x * 0.15 - y * 0.24)
        + 0.11 * math.cos((x + y) * 0.44)
    )


def ocean_floor_height(x, y):
    radius = math.hypot(x, y)
    if radius <= CLEARING_RADIUS:
        # The performer zone is mathematically flat. The stage, the torches and
        # every inner placement depend on this being exactly 0.
        return 0.0

    height = shelf_relief(x, y, radius)

    gate = north_gate(x, y)

    # Upstage wall: climbs past the water plane so it breaks the surface and
    # reads as a landmark rather than a backdrop.
    height += gate * smoothstep(WALL_RAMP_START, WALL_RAMP_END, radius) * WALL_CREST_Z

    # Abyss: everywhere the wall is not. Steep — 45 m over 10 m of radius is a
    # reef drop-off, not a slope.
    angle = math.atan2(y, x)
    lip = lip_radius(angle)
    plunge = smoothstep(lip, lip + ABYSS_RAMP_METRES, radius) * ABYSS_DEPTH
    height -= (1.0 - gate) * plunge

    return height


def ocean_floor_uv(x, y):
    """World-planar mapping with a warp that breaks grid-repeat cadence.

    Same treatment as build-winter-environment.py's terrain_snow_uv. Without
    the warp the sand texture visibly tiles across the open shelf.
    """
    warped_x = x + 2.1 * math.sin(y * 0.061) + 1.1 * math.sin((x + y) * 0.041)
    warped_y = y + 1.9 * math.sin(x * 0.054) - 0.9 * math.sin((x - y) * 0.045)
    return (warped_x / TERRAIN_UV_METRES, warped_y / TERRAIN_UV_METRES)


def depth_darkening(z):
    """0 at shelf level, 1 in the deep, for the baked vertex-colour ramp.

    FogExp2 has no height term: it fades geometry toward one colour, so without
    this the drop face fogs BRIGHTER than the void behind it and the depth read
    inverts. This is the correction for that.
    """
    return 1.0 - smoothstep(DARKEN_FULL_Z, DARKEN_START_Z, z)
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd E:/tka-platform/scripts && python test_ocean_terrain_profile.py
```

Expected: every line `PASS`, final line `all ocean terrain profile checks passed`, exit 0.

If `no 0.5 m radial step changes height by more than 8 m` fails, `ABYSS_RAMP_METRES` is too small for `ABYSS_DEPTH` — raise the ramp rather than reducing the depth.

- [ ] **Step 5: Commit**

```bash
cd E:/tka-platform && git add scripts/ocean_terrain_profile.py scripts/test_ocean_terrain_profile.py && git commit -m "feat(ocean): ocean floor height profile, tested without Blender

Pure math module so the shape of the world can be asserted without launching
Blender. Clearing forced flat to r=8 because 348 placements ground-snap to it,
shelf relief capped at +/- 0.6 m for the same reason, upstage wall crests at
z=15 (3 m above the water plane at z=12), abyss plunges 45 m past an irregular
3-harmonic lip so the edge is never a circle.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- scripts/ocean_terrain_profile.py scripts/test_ocean_terrain_profile.py
```

---

### Task 3: Generate the mesh in Blender and replace the Seabed

**Files:**
- Create: `scripts/build-ocean-terrain.py`
- Modify: `blender/ocean_scene.blend` (binary, not committed)

- [ ] **Step 1: Write the build script**

Create `scripts/build-ocean-terrain.py`:

```python
"""Replace the flat ocean Seabed plate with generated terrain.

Structure mirrors scripts/build-winter-environment.py: a polar grid driven by a
height function, a closed underside so low cameras never see a paper-thin edge,
and warped world-planar UVs.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/build-ocean-terrain.py -- --save

Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
"""

import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocean_terrain_profile import (  # noqa: E402
    ABYSS_DEPTH,
    CLEARING_RADIUS,
    TERRAIN_ANGULAR_SEGMENTS,
    TERRAIN_RADIAL_SEGMENTS,
    TERRAIN_UV_METRES,
    WORLD_RADIUS,
    depth_darkening,
    lip_radius,
    ocean_floor_height,
    ocean_floor_uv,
)

TERRAIN_NAME = "Seabed"
VERTEX_COLOUR_LAYER = "OceanDepth"


def existing_seabed_material():
    """Reuse Seabed_Sand_PBR so the palette pass has one material to retune."""
    old = bpy.data.objects.get(TERRAIN_NAME)
    if old and old.data.materials:
        return old.data.materials[0]
    material = bpy.data.materials.get("Seabed_Sand_PBR")
    if material is None:
        raise RuntimeError(
            "Seabed_Sand_PBR not found. The terrain rebuild must not invent a "
            "new material — the palette pass retunes this one."
        )
    return material


def build_terrain_mesh():
    vertices = [(0.0, 0.0, ocean_floor_height(0.0, 0.0))]
    uvs = [ocean_floor_uv(0.0, 0.0)]
    faces = []

    for ring in range(1, TERRAIN_RADIAL_SEGMENTS + 1):
        radial_fraction = ring / TERRAIN_RADIAL_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            angle = math.tau * segment / TERRAIN_ANGULAR_SEGMENTS
            radius = WORLD_RADIUS * radial_fraction
            x = math.cos(angle) * radius
            y = math.sin(angle) * radius
            vertices.append((x, y, ocean_floor_height(x, y)))
            uvs.append(ocean_floor_uv(x, y))

    # Centre fan.
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
        faces.append((0, 1 + segment, 1 + following))

    # Ring quads.
    for ring in range(1, TERRAIN_RADIAL_SEGMENTS):
        inner_start = 1 + (ring - 1) * TERRAIN_ANGULAR_SEGMENTS
        outer_start = inner_start + TERRAIN_ANGULAR_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
            faces.append(
                (
                    inner_start + segment,
                    outer_start + segment,
                    outer_start + following,
                    inner_start + following,
                )
            )

    # Close the shell underneath. Review cameras dip below the horizon and an
    # open terrain mesh reads as a paper-thin plate from those angles.
    outer_start = 1 + (TERRAIN_RADIAL_SEGMENTS - 1) * TERRAIN_ANGULAR_SEGMENTS
    bottom_z = min(vertex[2] for vertex in vertices) - 0.6
    bottom_centre = len(vertices)
    vertices.append((0.0, 0.0, bottom_z))
    uvs.append(ocean_floor_uv(0.0, 0.0))
    bottom_start = len(vertices)
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        top = vertices[outer_start + segment]
        vertices.append((top[0], top[1], bottom_z))
        uvs.append(ocean_floor_uv(top[0], top[1]))
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
        faces.append(
            (
                outer_start + segment,
                bottom_start + segment,
                bottom_start + following,
                outer_start + following,
            )
        )
        faces.append((bottom_centre, bottom_start + following, bottom_start + segment))

    mesh = bpy.data.meshes.new("Ocean Sculpted Seabed Mesh")
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=True):
        raise RuntimeError("Ocean terrain mesh required validation corrections")
    mesh.update()

    for polygon in mesh.polygons:
        polygon.use_smooth = True

    uv_layer = mesh.uv_layers.new(name="Ocean Seabed UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv_layer.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]

    # Baked depth darkening. Without this the drop face fogs brighter than the
    # void behind it, because FogExp2 has no height term.
    colour_layer = mesh.color_attributes.new(
        name=VERTEX_COLOUR_LAYER, type="FLOAT_COLOR", domain="POINT"
    )
    for index, vertex in enumerate(vertices):
        lightness = 1.0 - depth_darkening(vertex[2])
        colour_layer.data[index].color = (lightness, lightness, lightness, 1.0)

    return mesh


def main():
    material = existing_seabed_material()

    old = bpy.data.objects.get(TERRAIN_NAME)
    if old is not None:
        old_mesh = old.data
        bpy.data.objects.remove(old, do_unlink=True)
        if old_mesh.users == 0:
            bpy.data.meshes.remove(old_mesh)

    mesh = build_terrain_mesh()
    terrain = bpy.data.objects.new(TERRAIN_NAME, mesh)
    bpy.context.collection.objects.link(terrain)
    terrain.data.materials.append(material)

    terrain["tka_role"] = "terrain"
    terrain["tka_clearing_radius"] = CLEARING_RADIUS
    terrain["tka_boundary_shape"] = "wall-north-abyss-elsewhere"
    terrain["tka_lip_min_radius"] = min(
        lip_radius(math.tau * s / TERRAIN_ANGULAR_SEGMENTS)
        for s in range(TERRAIN_ANGULAR_SEGMENTS)
    )
    terrain["tka_lip_max_radius"] = max(
        lip_radius(math.tau * s / TERRAIN_ANGULAR_SEGMENTS)
        for s in range(TERRAIN_ANGULAR_SEGMENTS)
    )
    terrain["tka_abyss_depth"] = ABYSS_DEPTH
    terrain["tka_world_radius"] = WORLD_RADIUS
    terrain["tka_underside_closed"] = True
    terrain["tka_radial_segments"] = TERRAIN_RADIAL_SEGMENTS
    terrain["tka_angular_segments"] = TERRAIN_ANGULAR_SEGMENTS
    terrain["tka_seabed_uv_metres"] = TERRAIN_UV_METRES
    terrain["tka_depth_colour_layer"] = VERTEX_COLOUR_LAYER

    print(
        f"TERRAIN_BUILT verts={len(mesh.vertices)} polys={len(mesh.polygons)} "
        f"min_z={min(v.co.z for v in mesh.vertices):.2f} "
        f"max_z={max(v.co.z for v in mesh.vertices):.2f}"
    )

    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("TERRAIN_SAVED")


main()
```

- [ ] **Step 2: Dry-run without saving, to check the numbers**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/build-ocean-terrain.py 2>&1 | grep -E "TERRAIN_|Error|error"
```

Expected exactly one line, of this shape:

```
TERRAIN_BUILT verts=24769 polys=24960 min_z=-45.60 max_z=15.00
```

Check three things before continuing:
- `max_z` is above 12.0 (the wall breaks the water plane)
- `min_z` is at or below -45.0 (the abyss reaches depth)
- `verts` is roughly 24–25k, not millions

If `Seabed_Sand_PBR not found` is raised, stop — do not let the script invent a
material. Find the real material name with:

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python-expr "import bpy; print([m.name for m in bpy.data.materials if 'and' in m.name.lower() or 'seabed' in m.name.lower()])" 2>&1 | grep "\["
```

- [ ] **Step 3: Run for real, saving the blend**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/build-ocean-terrain.py -- --save 2>&1 | grep -E "TERRAIN_|Error"
```

Expected: the `TERRAIN_BUILT` line, then `TERRAIN_SAVED`.

- [ ] **Step 4: Verify the saved blend holds the new terrain**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python-expr "
import bpy
o = bpy.data.objects['Seabed']
print('VERIFY verts=%d dims=%s colour_layers=%s role=%s' % (
    len(o.data.vertices), tuple(round(v,1) for v in o.dimensions),
    [c.name for c in o.data.color_attributes], o.get('tka_role')))
" 2>&1 | grep VERIFY
```

Expected: `verts` ~24769, `dims` roughly `(220.0, 220.0, 60.6)`, `colour_layers` containing `OceanDepth`, `role=terrain`.

- [ ] **Step 5: Commit the script only**

```bash
cd E:/tka-platform && git add scripts/build-ocean-terrain.py && git commit -m "feat(ocean): generate seabed terrain, replacing the flat plate

128x192 polar grid on the winter build pattern: centre fan, ring quads, closed
underside so review cameras dipping below the horizon never see a paper-thin
edge. Reuses Seabed_Sand_PBR rather than creating a material, because the
palette pass retunes that one.

Bakes an OceanDepth vertex colour layer carrying the depth darkening ramp. That
layer is load-bearing: FogExp2 has no height term, so without it the drop face
fogs brighter than the void behind it and the depth read inverts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- scripts/build-ocean-terrain.py
```

---

### Task 4: Wire the depth vertex colour into the material

The vertex layer exists but nothing reads it yet. Without this step the bake is inert.

**Files:**
- Modify: `blender/ocean_scene.blend` (the `Seabed_Sand_PBR` node graph)
- Create: `scripts/wire-ocean-depth-colour.py`

- [ ] **Step 1: Write the wiring script**

Create `scripts/wire-ocean-depth-colour.py`:

```python
"""Multiply the baked OceanDepth vertex colour into the seabed albedo.

Idempotent: re-running finds the existing Mix node instead of stacking another.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/wire-ocean-depth-colour.py -- --save
"""

import sys

import bpy

MATERIAL_NAME = "Seabed_Sand_PBR"
COLOUR_LAYER = "OceanDepth"
MIX_NODE_NAME = "OceanDepthDarken"


def main():
    material = bpy.data.materials.get(MATERIAL_NAME)
    if material is None:
        raise RuntimeError(f"{MATERIAL_NAME} not found")
    tree = material.node_tree

    principled = next(
        (n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None
    )
    if principled is None:
        raise RuntimeError(f"{MATERIAL_NAME} has no Principled BSDF")

    base_input = principled.inputs["Base Color"]
    if not base_input.is_linked:
        raise RuntimeError("Base Color is unlinked; nothing to darken")

    existing = tree.nodes.get(MIX_NODE_NAME)
    if existing is not None:
        print("DEPTH_WIRE already present, nothing to do")
        return

    upstream = base_input.links[0].from_socket

    attribute = tree.nodes.new("ShaderNodeVertexColor")
    attribute.name = "OceanDepthAttribute"
    attribute.layer_name = COLOUR_LAYER
    attribute.location = (principled.location.x - 700, principled.location.y - 320)

    mix = tree.nodes.new("ShaderNodeMix")
    mix.name = MIX_NODE_NAME
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.location = (principled.location.x - 320, principled.location.y - 120)
    mix.inputs["Factor"].default_value = 1.0

    tree.links.new(mix.inputs[6], upstream)          # A
    tree.links.new(mix.inputs[7], attribute.outputs["Color"])  # B
    tree.links.new(base_input, mix.outputs[2])       # Result

    print(f"DEPTH_WIRE connected {upstream.node.name} -> {MIX_NODE_NAME} -> Base Color")

    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("DEPTH_WIRE_SAVED")


main()
```

- [ ] **Step 2: Run it**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/wire-ocean-depth-colour.py -- --save 2>&1 | grep -E "DEPTH_WIRE|Error"
```

Expected: `DEPTH_WIRE connected ... -> OceanDepthDarken -> Base Color` then `DEPTH_WIRE_SAVED`.

If it raises on the `ShaderNodeMix` socket indices, Blender 5.0 changed the Mix
node sockets. Fall back to `ShaderNodeMixRGB` with `inputs['Color1']`,
`inputs['Color2']`, `outputs['Color']`.

- [ ] **Step 3: Verify idempotency**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/wire-ocean-depth-colour.py 2>&1 | grep DEPTH_WIRE
```

Expected: `DEPTH_WIRE already present, nothing to do`

- [ ] **Step 4: Commit**

```bash
cd E:/tka-platform && git add scripts/wire-ocean-depth-colour.py && git commit -m "feat(ocean): multiply baked depth colour into seabed albedo

Idempotent shader wiring. Without this the OceanDepth vertex layer is inert and
the drop face reads brighter than the abyss behind it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- scripts/wire-ocean-depth-colour.py
```

---

### Task 5: Re-ground the 348 placements onto the new surface

Every object was ground-snapped to a flat plate. The shelf now has ±0.6 m of
relief, so anything not re-snapped floats or sinks. This is the highest-risk
task in the plan.

**Files:**
- Modify: `scripts/ocean-zone-layout.json` (`outerBoundaryMetres`)
- Modify: `blender/ocean_scene.blend`

- [ ] **Step 1: Raise the placement boundary to the shelf lip**

In `scripts/ocean-zone-layout.json`, inside `placementRules`, change:

```json
"outerBoundaryMetres": 20,
```

to:

```json
"outerBoundaryMetres": 24,
```

This value is what encoded the ring. 24 is the nominal shelf lip from
`ocean_terrain_profile.SHELF_OUTER_RADIUS`.

- [ ] **Step 2: Re-run the zone pass so every object re-snaps**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/ocean_zone_pass3.py 2>&1 | tail -20
```

Expected: the script's own placement summary, no traceback. `Seabed` is in its
protected skip-list (`ocean_zone_pass3.py:69`), so the new terrain is not moved.

- [ ] **Step 3: Verify nothing floats or sinks**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python-expr "
import bpy, math, sys, os
sys.path.append(os.path.abspath('scripts'))
from ocean_terrain_profile import ocean_floor_height
bad = []
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name in ('Seabed',) or o.name.startswith(('Dais','Torch','src_')):
        continue
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    if not zs: continue
    ground = ocean_floor_height(o.location.x, o.location.y)
    gap = min(zs) - ground
    if gap > 0.5 or gap < -1.5:
        bad.append((o.name, round(gap,2)))
print('FLOATERS %d' % len(bad))
for name, gap in sorted(bad, key=lambda p: -abs(p[1]))[:15]:
    print('   %s gap=%s' % (name, gap))
" 2>&1 | grep -E "FLOATERS|   "
```

Expected: `FLOATERS 0`.

If floaters are reported, they are almost certainly objects the zone script's
skip-list protects (`Basalt_Columns`, `Basalt_Pinnacle`, `Reef_Wall`). Snap
those individually rather than removing them from the protected list — they are
protected because their placement was hand-tuned:

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python-expr "
import bpy, sys, os
sys.path.append(os.path.abspath('scripts'))
from ocean_terrain_profile import ocean_floor_height
for name in ('Basalt_Columns','Basalt_Pinnacle','Reef_Wall'):
    o = bpy.data.objects.get(name)
    if not o: continue
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    o.location.z += ocean_floor_height(o.location.x, o.location.y) - min(zs) - 0.15
    print('SNAPPED', name, round(o.location.z,3))
bpy.ops.wm.save_mainfile()
" 2>&1 | grep SNAPPED
```

- [ ] **Step 4: Commit the layout change**

```bash
cd E:/tka-platform && git add scripts/ocean-zone-layout.json && git commit -m "feat(ocean): raise placement boundary from 20 m to the 24 m shelf lip

outerBoundaryMetres: 20 is what literally encoded the ring. Content stopped at
20 because the contract said stop at 20. It now runs to the shelf lip, past
which the floor falls into the abyss.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- scripts/ocean-zone-layout.json
```

---

### Task 6: Palette pass

Folded into this Blender trip deliberately — one export, one optimize, one R2
upload rather than three.

**Files:**
- Modify: `blender/ocean_scene.blend` (materials)
- Create: `scripts/retune-ocean-palette.py`

- [ ] **Step 1: Inventory the current hue families**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python-expr "
import bpy, colorsys
rows = []
for m in bpy.data.materials:
    if not m.use_nodes: continue
    p = next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'), None)
    if not p: continue
    c = p.inputs['Base Color']
    if c.is_linked: continue
    r,g,b,_ = c.default_value
    h,l,s = colorsys.rgb_to_hls(r,g,b)
    rows.append((round(h*360), round(s,2), round(l,2), m.name, m.users))
for row in sorted(rows):
    print('HUE %3d sat=%.2f lum=%.2f  %s (users=%d)' % row)
" 2>&1 | grep "^HUE"
```

Record the output. It is the input to the next step — the hue families to
collapse are whatever this actually reports, not an assumed list.

- [ ] **Step 2: Write the retune script**

Create `scripts/retune-ocean-palette.py`. Fill `HUE_TARGETS` from Step 1's
output — two families plus one accent, per the design:

```python
"""Collapse the ocean palette to two hue families plus one accent.

Run Step 1 of Task 6 first; HUE_TARGETS below must be filled from that
inventory rather than guessed.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/retune-ocean-palette.py -- --save
"""

import colorsys
import sys

import bpy

# Two families plus one accent. Source hues map to the nearest target.
FAMILY_TEAL = 186.0
FAMILY_VIOLET = 268.0
ACCENT_CORAL = 14.0
TARGETS = (FAMILY_TEAL, FAMILY_VIOLET, ACCENT_CORAL)

# Accent is rationed: only materials named here keep the warm hue. Everything
# else collapses to a cool family, which is what stops the floor reading salmon.
ACCENT_MATERIALS = set()

SAND_SATURATION_SCALE = 0.35
SAND_HUE = FAMILY_TEAL


def nearest_target(hue_degrees):
    def distance(target):
        delta = abs(hue_degrees - target) % 360.0
        return min(delta, 360.0 - delta)

    return min(TARGETS, key=distance)


def main():
    changed = 0
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        principled = next(
            (n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"),
            None,
        )
        if principled is None:
            continue
        socket = principled.inputs["Base Color"]
        if socket.is_linked:
            continue

        r, g, b, a = socket.default_value
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        hue_degrees = h * 360.0

        if material.name == "Seabed_Sand_PBR" or "sand" in material.name.lower():
            # The salmon floor. Cool it and drain most of the saturation.
            target_hue = SAND_HUE
            s *= SAND_SATURATION_SCALE
        elif material.name in ACCENT_MATERIALS:
            target_hue = ACCENT_CORAL
        else:
            target_hue = nearest_target(hue_degrees)
            if target_hue == ACCENT_CORAL:
                # Unlisted materials never claim the accent.
                target_hue = FAMILY_TEAL

        nr, ng, nb = colorsys.hls_to_rgb(target_hue / 360.0, l, s)
        socket.default_value = (nr, ng, nb, a)
        changed += 1
        print(
            "RETUNE %-32s %3d -> %3d sat=%.2f"
            % (material.name, round(hue_degrees), round(target_hue), s)
        )

    print(f"RETUNE_DONE {changed} materials")
    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("RETUNE_SAVED")


main()
```

- [ ] **Step 3: Populate `ACCENT_MATERIALS` from the Step 1 inventory**

Pick at most a third of the coral materials — the ones with the highest `users`
count, so the accent lands where it is seen. Add their exact names to the set.
Leaving the set empty is a valid first pass (everything cools), but the design
calls for one accent, so it should not ship empty.

- [ ] **Step 4: Dry-run and read the mapping**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/retune-ocean-palette.py 2>&1 | grep -E "RETUNE"
```

Expected: one `RETUNE` line per material, a `RETUNE_DONE` count. Confirm
`Seabed_Sand_PBR` shows a hue moving toward 186 with reduced saturation.

- [ ] **Step 5: Run for real**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/retune-ocean-palette.py -- --save 2>&1 | grep -E "RETUNE_DONE|RETUNE_SAVED"
```

- [ ] **Step 6: Commit**

```bash
cd E:/tka-platform && git add scripts/retune-ocean-palette.py && git commit -m "feat(ocean): collapse palette to two hue families plus one rationed accent

Cools the salmon sand by moving Seabed_Sand_PBR to the teal family at 35%
saturation. Accent is allow-listed rather than nearest-match, so unlisted
materials can never drift warm — that drift is what produced 6-7 competing hue
families.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- scripts/retune-ocean-palette.py
```

---

### Task 7: Export and optimize

**Files:**
- Modify: `static/models/ocean/` (GLB output)

- [ ] **Step 1: Export**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/blender-export-ocean-full.py 2>&1 | tail -20
```

Expected: the script's completion message and a written `*_raw.glb`. Confirm the
path it printed exists:

```bash
cd E:/tka-platform && ls -la $(find . -name "*ocean*_raw.glb" -newermt "-10 minutes" 2>/dev/null | head -1)
```

- [ ] **Step 2: Optimize**

```bash
cd E:/tka-platform && node scripts/optimize-ocean-glb.mjs 2>&1 | tail -20
```

- [ ] **Step 3: Confirm the optimized GLB grew by roughly the terrain, not by orders of magnitude**

```bash
cd E:/tka-platform && ls -la static/models/ocean/
```

Expected: the ocean GLB near its previous ~36 MB. The terrain adds ~25k verts
against ~54M, so any large jump means something else changed — most likely a
new high-vert asset crept in. Investigate before continuing rather than
shipping it.

- [ ] **Step 4: Commit the GLB**

```bash
cd E:/tka-platform && git status --short static/models/ocean/
```

Then add only the ocean model paths that command lists, and commit:

```bash
cd E:/tka-platform && git commit -m "feat(ocean): rebuild GLB with sculpted terrain and retuned palette

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- static/models/ocean/
```

---

### Task 8: The camera-locked depth gradient

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/runtime/OceanDepthGradient.svelte`
- Modify: `src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte`

- [ ] **Step 1: Write the component**

Create `src/lib/shared/3d/environments/scenes/ocean/runtime/OceanDepthGradient.svelte`:

```svelte
<script lang="ts">
  /**
   * Ocean Depth Gradient
   *
   * The abyss. FogExp2 has no height term — it fades everything toward one
   * colour, so looking DOWN past the shelf lip would resolve to exactly the
   * same navy as looking OUT at the horizon, and the drop-off would read as a
   * ledge over a glowing blue nothing.
   *
   * Same construction as primitives/SkyGradient.svelte: an inverted sphere
   * with a vertical gradient, re-centred on the camera every frame. Being
   * camera-locked is the load-bearing part — a backdrop that cannot be outrun
   * has no seam, which is what lets the forest's horizon feel infinite.
   *
   * depthTest:false + renderOrder:-1 means this always loses to real geometry
   * and only shows through gaps, so the shelf lip silhouettes against black.
   */

  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    BackSide,
    Color,
    ShaderMaterial,
    SphereGeometry,
    type Mesh,
  } from "three";

  interface Props {
    /** Just under the water plane, where light still reaches. */
    shallowColor?: string;
    /** Eye level. Matches the scene fog so geometry and void agree. */
    midColor?: string;
    /** Straight down. The abyss. */
    deepColor?: string;
    radius?: number;
  }

  let {
    shallowColor = "#1d5f74",
    midColor = "#0a2438",
    deepColor = "#01060b",
    radius = 180,
  }: Props = $props();

  const geometry = untrack(() => new SphereGeometry(radius, 32, 32));
  const { camera } = useThrelte();

  const material = untrack(
    () =>
      new ShaderMaterial({
        uniforms: {
          uShallowColor: { value: new Color(shallowColor) },
          uMidColor: { value: new Color(midColor) },
          uDeepColor: { value: new Color(deepColor) },
        },
        vertexShader: /* glsl */ `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,
        fragmentShader: /* glsl */ `
        uniform vec3 uShallowColor;
        uniform vec3 uMidColor;
        uniform vec3 uDeepColor;
        varying vec3 vDirection;

        void main() {
          float height = vDirection.y;

          // Downward half ramps mid -> deep, upward half ramps mid -> shallow.
          // Split at the horizon so eye level always matches the scene fog and
          // geometry fading into the distance meets the void seamlessly.
          vec3 color = height < 0.0
            ? mix(uMidColor, uDeepColor, smoothstep(0.0, -0.55, height))
            : mix(uMidColor, uShallowColor, smoothstep(0.0, 0.75, height));

          gl_FragColor = vec4(color, 1.0);
        }
        `,
        side: BackSide,
        depthTest: false,
        depthWrite: false,
      })
  );

  $effect(() => {
    material.uniforms.uShallowColor!.value.set(shallowColor);
    material.uniforms.uMidColor!.value.set(midColor);
    material.uniforms.uDeepColor!.value.set(deepColor);
  });

  let domeMesh: Mesh | undefined;

  useTask(() => {
    const activeCamera = camera.current;
    if (activeCamera && domeMesh) {
      domeMesh.position.copy(activeCamera.position);
    }
  });

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>

<T.Mesh
  bind:ref={domeMesh}
  {geometry}
  {material}
  renderOrder={-1}
  frustumCulled={false}
/>
```

- [ ] **Step 2: Render it from the ocean scene**

In `src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte`, add the
import alongside the other runtime imports:

```ts
import OceanDepthGradient from "./runtime/OceanDepthGradient.svelte";
```

and render it as the first child of the scene's markup, before any geometry:

```svelte
<OceanDepthGradient />
```

Position in the markup does not affect draw order — `renderOrder={-1}` owns
that — but putting it first keeps the reading order honest.

- [ ] **Step 3: Typecheck**

Per `resource-budget.md`, confirm no other `svelte-check` is running first:

```bash
cd E:/tka-platform && powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'svelte-check' } | Measure-Object | Select-Object -ExpandProperty Count"
```

Expected: `0`. Then:

```bash
cd E:/tka-platform && npm run check > /tmp/ocean-check.log 2>&1; grep -niE "error|warning" /tmp/ocean-check.log | head -20
```

Expected: `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 4: Commit**

```bash
cd E:/tka-platform && git add src/lib/shared/3d/environments/scenes/ocean/runtime/OceanDepthGradient.svelte src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte && git commit -m "feat(ocean): camera-locked depth gradient so the abyss reads as depth

FogExp2 has no height term. Without this, looking down past the shelf lip fades
to exactly the same navy as the horizon and the drop-off reads as a ledge over
a glowing blue nothing.

Built on the SkyGradient pattern rather than a new one: inverted sphere,
BackSide, depthTest false, renderOrder -1, re-centred on the camera every
frame. Camera-locking is the load-bearing part — a backdrop that cannot be
outrun has no seam.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/lib/shared/3d/environments/scenes/ocean/runtime/OceanDepthGradient.svelte src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte
```

---

### Task 9: Clamp the camera below the water plane

Austen chose to keep the scene underwater and skip the surface break entirely.
This closes "it feels like I'm still underwater even when my camera is above the
supposed surface" by making the above-water state unreachable, rather than by
building a state the scene does not support.

`EnvironmentReviewCamera` takes `preset.position` / `preset.target` as props
(lines 55, 76, 81) and hands them to the shared camera package. So the clamp
belongs **on the preset**, before it is passed down — not inside the shared
component. Clamping the preset needs no new prop on a component four other
scenes use, and it is directly verifiable from the rendered frame.

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/ocean-camera-bounds.ts`
- Modify: `src/routes/test/ocean-scene/+page.svelte`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ocean-camera-bounds.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  OCEAN_CAMERA_CEILING_Y,
  clampPresetBelowWater,
} from "$lib/shared/3d/environments/scenes/ocean/ocean-camera-bounds";

describe("clampPresetBelowWater", () => {
  it("leaves a preset already below the water plane untouched", () => {
    const preset = {
      position: [0, 4.5, 19] as const,
      target: [0, 1.6, -2] as const,
      fov: 46,
    };
    expect(clampPresetBelowWater(preset)).toEqual(preset);
  });

  it("pulls a preset above the water plane down to the ceiling", () => {
    const clamped = clampPresetBelowWater({
      position: [0, 26, 30] as const,
      target: [0, 0, 0] as const,
      fov: 52,
    });
    expect(clamped.position[1]).toBe(OCEAN_CAMERA_CEILING_Y);
  });

  it("preserves the horizontal position and the fov", () => {
    const clamped = clampPresetBelowWater({
      position: [3, 26, 30] as const,
      target: [0, 0, 0] as const,
      fov: 52,
    });
    expect(clamped.position[0]).toBe(3);
    expect(clamped.position[2]).toBe(30);
    expect(clamped.fov).toBe(52);
  });

  it("clamps the target too, so a clamped camera does not stare upward", () => {
    const clamped = clampPresetBelowWater({
      position: [0, 26, 30] as const,
      target: [0, 18, 0] as const,
      fov: 52,
    });
    expect(clamped.target[1]).toBe(OCEAN_CAMERA_CEILING_Y);
  });

  it("keeps the ceiling below the runtime water plane", () => {
    expect(OCEAN_CAMERA_CEILING_Y).toBeLessThan(10.5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd E:/tka-platform && npx vitest run tests/unit/ocean-camera-bounds.test.ts 2>&1 | tail -20
```

Expected: failure resolving `ocean-camera-bounds`.

- [ ] **Step 3: Write the module**

Create `src/lib/shared/3d/environments/scenes/ocean/ocean-camera-bounds.ts`:

```ts
/**
 * The ocean is authored to be viewed from below the surface only. There is no
 * sky, no surface break, and nothing in the scene reads camera Y — the fog and
 * background are set in an effect with no camera dependency. Rising above the
 * water plane therefore shows the underwater treatment from outside it, which
 * reads as a bug rather than as surfacing.
 *
 * Austen chose to clamp rather than build the above-water state:
 * docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
 *
 * Runtime water plane: groundY (-1.5) + 12 = +10.5. The 0.6 m margin keeps the
 * near plane from clipping through the surface at grazing angles.
 */

export const OCEAN_WATER_PLANE_Y = 10.5;
export const OCEAN_CAMERA_CEILING_Y = OCEAN_WATER_PLANE_Y - 0.6;

export interface OceanCameraPreset {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
}

export function clampPresetBelowWater(
  preset: OceanCameraPreset
): OceanCameraPreset {
  const [px, py, pz] = preset.position;
  const [tx, ty, tz] = preset.target;

  if (py <= OCEAN_CAMERA_CEILING_Y && ty <= OCEAN_CAMERA_CEILING_Y) {
    return preset;
  }

  return {
    // Clamp the target as well. Clamping only the position would leave a
    // high-target preset craning upward at the underside of the water plane.
    position: [px, Math.min(py, OCEAN_CAMERA_CEILING_Y), pz],
    target: [tx, Math.min(ty, OCEAN_CAMERA_CEILING_Y), tz],
    fov: preset.fov,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd E:/tka-platform && npx vitest run tests/unit/ocean-camera-bounds.test.ts 2>&1 | tail -20
```

Expected: 5 passed.

- [ ] **Step 5: Apply it in the harness**

In `src/routes/test/ocean-scene/+page.svelte`, add the import:

```ts
import { clampPresetBelowWater } from "$lib/shared/3d/environments/scenes/ocean/ocean-camera-bounds";
```

and wrap the derived preset, with an explicit opt-out:

```ts
// `?clamp=0` disables the clamp for verification only. The `world` preset sits
// at y=26 — above the surface, and the shot that exposed the ring-in-a-void
// boundary — so it stays reachable for before/after comparison and for
// inspecting the terrain silhouette from outside. Product surfaces never pass
// it; the clamp is the default precisely because the above-water view is not a
// state the scene supports.
const clampDisabled = $derived(page.url.searchParams.get("clamp") === "0");
const cameraPreset = $derived(
  clampDisabled ? VIEW_PRESETS[view] : clampPresetBelowWater(VIEW_PRESETS[view])
);
```

This changes the default `world` preset from `y = 26` to `y = 9.9`, which is
what Task 10 Step 6 verifies.

- [ ] **Step 6: Typecheck and commit**

```bash
cd E:/tka-platform && npm run check > /tmp/ocean-check.log 2>&1; grep -niE "error|warning" /tmp/ocean-check.log | head
```

Expected: 0 errors, 0 warnings.

```bash
cd E:/tka-platform && git add src/lib/shared/3d/environments/scenes/ocean/ocean-camera-bounds.ts tests/unit/ocean-camera-bounds.test.ts src/routes/test/ocean-scene/+page.svelte && git commit -m "feat(ocean): clamp review camera presets below the water plane

The ocean is authored to be viewed from below only — no sky, no surface break,
and nothing in the scene reads camera Y — so rising above the water plane shows
the underwater treatment from outside it. Clamping closes that by construction
rather than building a state the scene does not support.

Clamps the preset rather than the shared EnvironmentReviewCamera, which four
other scenes use and which must keep free cameras. Clamps the target as well as
the position, or a high-target preset cranes upward at the underside of the
surface.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/lib/shared/3d/environments/scenes/ocean/ocean-camera-bounds.ts tests/unit/ocean-camera-bounds.test.ts src/routes/test/ocean-scene/+page.svelte
```

---

### Task 10: Visual verification — the actual gate

Per `visual-verification-mandatory.md` and `verification-protocol.md`, this task
is what makes the work done. A green typecheck is not verification of a visual
change.

For a 3D scene, **aspect ratio changes framing, width alone does not** — so the
sweep covers distinct ratios, not every width in the standard table.

**Files:** none modified unless defects are found.

- [ ] **Step 1: Start the shared browser**

```bash
cd E:/tka-platform && pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

Never pass `--force-device-scale-factor`.

- [ ] **Step 2: Open a task-owned background page and keep its page ID**

Navigate to [https://localhost:5173/test/ocean-scene?view=world](https://localhost:5173/test/ocean-scene?view=world) via `new_page(..., background: true)`. HTTPS — the dev server is HTTP/2 and `http://` returns ERR_EMPTY_RESPONSE.

- [ ] **Step 3: Take the before/after shot that started this**

Use [https://localhost:5173/test/ocean-scene?view=world&clamp=0](https://localhost:5173/test/ocean-scene?view=world&clamp=0) — the `clamp=0` escape from Task 9 Step 5, which keeps the y=26 vantage that exposed the ring. Without it the clamp pulls this shot underwater and the comparison is not like-for-like.

`emulate` to `2112x1188x1` (1920×1080 target with the ×1.1 dpr correction from
`reference_devtools_emulate_dpr`), then `take_screenshot` with
`format: "webp", quality: 70`.

Read the frame against these, all of which were true before and must now be false:
- a visible circular boundary in any direction
- the reef reading as an annulus with a void outside it
- the seabed reading as a flat plate

- [ ] **Step 4: Sweep the remaining presets at the same viewport**

`?view=hero`, `?view=shaft`, `?view=reef`, `?view=walk`. For each, reload,
screenshot, and read:

| Preset | Must be true |
|---|---|
| `hero` | the upstage wall reads as a landmark with mass, not a flat backdrop |
| `shaft` | god-ray columns read against dark water, not navy haze |
| `reef` | the shelf lip silhouettes against black |
| `walk` | at eye level the abyss reads as depth, not as a hole in the floor |

- [ ] **Step 5: Measure the depth ordering rather than eyeballing it**

On the `reef` view, run via `evaluate_script`:

```js
const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true })
  ?? canvas.getContext("webgl", { preserveDrawingBuffer: true });
const w = canvas.width, h = canvas.height;
const px = new Uint8Array(4);
function lum(xf, yf) {
  gl.readPixels(Math.round(w * xf), Math.round(h * (1 - yf)), 1, 1,
    gl.RGBA, gl.UNSIGNED_BYTE, px);
  return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
}
// Sample points are for the `reef` preset; adjust the fractions if the
// composition differs, but keep the three regions distinct.
JSON.stringify({
  shelf: lum(0.35, 0.55),
  dropFace: lum(0.55, 0.35),
  void: lum(0.75, 0.12),
});
```

Required ordering: `shelf > dropFace > void`.

If `dropFace <= void`, the vertex-colour ramp is missing or too weak. Do not
proceed — that is the specific failure this gate exists to catch. Fix by
lowering `DARKEN_FULL_Z` in `ocean_terrain_profile.py` (Task 2), then re-run
Tasks 3, 4 and 7.

- [ ] **Step 6: Verify the camera clamp holds**

`?view=world` is the test case: its authored preset is `y = 26`, well above the
`9.9` ceiling, so a working clamp visibly pulls the shot under the surface.

Load [https://localhost:5173/test/ocean-scene?view=world](https://localhost:5173/test/ocean-scene?view=world) and screenshot.

Expected: the framing is from **below** the water plane — you see the underside
of the surface above you and the reef below, not a top-down view of the scene
from 26 m up.

If the shot is still from above, `clampPresetBelowWater` is not wrapping the
derived preset. Return to Task 9 Step 5.

Note this is the one place the clamp trades something away: `world` was the shot
that exposed the ring, and it can no longer be taken from 26 m. Judge the ring
from `hero` and `reef` instead, which is what a viewer actually sees.

- [ ] **Step 7: Two more aspect ratios**

`3840x2160` → emulate `4224x2376x1`, and `375x667` → emulate `412x734x1`.
The tall phone ratio is the one that will expose a wall that only composes at
16:9. Screenshot and read both.

- [ ] **Step 8: Clear emulation and close only the task-owned page**

Never close or resize the shared browser window.

- [ ] **Step 9: Record the verification in the design doc**

Append a `## Verification record` section to
`docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md`
stating which frames were taken, the measured luminance triple, and anything
that remains wrong. State residuals honestly rather than omitting them.

```bash
cd E:/tka-platform && git commit -m "docs(ocean): Gate 3 verification record

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
```

---

### Task 11: Dress the wall face — only if Task 10 says it needs it

The design (§3) calls for a sparse outer band of silhouette-scale rocks on the
upstage wall, borrowing forest's far-depth trick. **This task is conditional.**
Bare rock at 30–38 m under 0.026 fog may already read as mass; adding geometry
the frame does not need is how a 102M-vert blend got that way.

Run Task 10 first. Do this only if the `hero` frame shows the wall reading as a
flat backdrop rather than as something with depth. If it reads fine, tick this
task as deferred with that reason and move on.

**Files:**
- Create: `scripts/dress-ocean-wall.py`
- Modify: `blender/ocean_scene.blend`

- [ ] **Step 1: Confirm the need from the Task 10 `hero` frame**

State explicitly which frame you are reacting to and what is wrong with it. If
you cannot name the defect, skip the task.

- [ ] **Step 2: Write the dressing script**

Create `scripts/dress-ocean-wall.py`:

```python
"""Scatter a sparse band of existing rocks across the upstage wall face.

Reuses already-imported meshes as linked duplicates. Does NOT import new
assets: Reef_Wall alone is 41,617 verts for one 6 m rock, and the blend is
already 102.6M verts across 348 meshes. Volume comes from reuse or not at all.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/dress-ocean-wall.py -- --save
"""

import math
import os
import random
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocean_terrain_profile import ocean_floor_height  # noqa: E402

SOURCE_NAMES = ("Basalt_Pinnacle", "Basalt_Columns", "Reef_Wall")
BAND_INNER = 27.0
BAND_OUTER = 37.0
COUNT = 14
BEARING_SPREAD_DEGREES = 120.0  # centred due north
SEED = 20260809
PREFIX = "Ocean_WallDressing_"


def clear_previous():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)


def main():
    sources = [bpy.data.objects.get(name) for name in SOURCE_NAMES]
    sources = [s for s in sources if s is not None]
    if not sources:
        raise RuntimeError(
            f"None of {SOURCE_NAMES} found. Do not import a replacement — "
            "the vert budget forbids new assets."
        )

    clear_previous()
    rng = random.Random(SEED)
    half = math.radians(BEARING_SPREAD_DEGREES) * 0.5

    for index in range(COUNT):
        source = sources[index % len(sources)]
        # Golden-angle-ish spread across the northern arc, jittered so the band
        # does not read as a row.
        fraction = (index + 0.5) / COUNT
        bearing = math.pi * 0.5 + (fraction * 2.0 - 1.0) * half
        bearing += rng.uniform(-0.06, 0.06)
        radius = rng.uniform(BAND_INNER, BAND_OUTER)

        x = math.cos(bearing) * radius
        y = math.sin(bearing) * radius

        duplicate = source.copy()  # linked: shares mesh data, adds no verts
        duplicate.name = f"{PREFIX}{index:02d}"
        duplicate.location = (x, y, 0.0)
        duplicate.rotation_euler = (0.0, 0.0, rng.uniform(0.0, math.tau))
        scale = source.scale.x * rng.uniform(0.8, 1.45)
        duplicate.scale = (scale, scale, scale)
        bpy.context.collection.objects.link(duplicate)

        bpy.context.view_layer.update()
        zs = [(duplicate.matrix_world @ v.co).z for v in duplicate.data.vertices]
        duplicate.location.z += ocean_floor_height(x, y) - min(zs) - 0.15

        print(f"DRESS {duplicate.name} r={radius:.1f} z={duplicate.location.z:.2f}")

    print(f"DRESS_DONE {COUNT} placed, 0 new mesh datablocks")

    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("DRESS_SAVED")


main()
```

- [ ] **Step 3: Run it and confirm no vert growth**

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/dress-ocean-wall.py -- --save 2>&1 | grep -E "DRESS|Error"
```

Expected: 14 `DRESS` lines, `DRESS_DONE`, `DRESS_SAVED`.

Then confirm the mesh datablock count did not rise — `object.copy()` shares mesh
data, so 14 new objects must add zero new meshes:

```bash
cd E:/tka-platform && "/c/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python-expr "
import bpy
print('MESHDATA %d objects=%d' % (len(bpy.data.meshes), len([o for o in bpy.data.objects if o.type=='MESH'])))
" 2>&1 | grep MESHDATA
```

Expected: object count up by 14, mesh datablock count unchanged from before.

- [ ] **Step 4: Re-run Task 7 (export and optimize), then re-shoot the `hero` frame**

The wall must now read with depth. If it does not, remove the dressing
(`clear_previous` runs on every invocation) rather than adding more.

- [ ] **Step 5: Commit**

```bash
cd E:/tka-platform && git add scripts/dress-ocean-wall.py && git commit -m "feat(ocean): sparse rock band on the upstage wall face

Linked duplicates of already-imported rocks, so 14 placements add zero mesh
datablocks. New assets are not an option here: Reef_Wall alone is 41,617 verts
for one 6 m rock against a blend already at 102.6M verts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- scripts/dress-ocean-wall.py
```

---

### Task 12: R2 upload

Carried debt: production currently serves the **old** GLB. This upload is not
optional — without it none of the preceding work reaches production.

**Files:** none in-repo.

- [ ] **Step 1: Find the established upload path**

```bash
cd E:/tka-platform && grep -rn "r2\|R2" package.json scripts/*.mjs scripts/*.sh 2>/dev/null | grep -i "upload\|put\|sync" | head
```

- [ ] **Step 2: Upload the rebuilt ocean GLB using whatever that reveals**

Do not invent a new upload mechanism. If Step 1 finds none, stop and report
that rather than guessing at credentials or bucket names — R2 credentials are
Austen's, and this is a genuine blocker under
`autonomy-and-completeness.md`.

- [ ] **Step 3: Verify production serves the new asset**

```bash
curl -sI "<the R2 or CDN URL for the ocean GLB>" | grep -iE "content-length|etag|last-modified"
```

Expected: `content-length` matching the freshly built local GLB, and a
`last-modified` from today.

---

## Notes for whoever executes this

- **Work on `main` in `E:/tka-platform`.** No branch, no worktree — see
  `.claude/rules/worktree-workflow.md`. Branch creation needs an explicit
  request from Austen in the conversation.
- **Every commit uses an explicit pathspec** (`git commit -m "..." -- <paths>`).
  The index is shared with other sessions; a bare `git commit` sweeps their
  staged work into yours. See `.claude/rules/commit-only-your-own-changes.md`.
- **Port 5173 is Austen's dev server.** Never run `npm run dev`, never kill it.
  Use `curl` against it, or `vite --port 5174` for your own.
- **One `svelte-check` machine-wide.** Check for a running one before starting
  another (`.claude/rules/resource-budget.md`).
- **`.blend` files are large binaries.** Commit the scripts, not the blend
  snapshots.
- **The riskiest task is 5**, re-grounding 348 objects. If it goes wrong, the
  scene looks broken in an obvious way (things floating or buried), so it fails
  loudly rather than silently. `blender/ocean_scene.pre-terrain.blend` from
  Task 1 is the way back.
