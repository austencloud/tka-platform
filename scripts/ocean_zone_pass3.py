"""Ocean zone pass 3 — hard separation at the basalt canyon.

Run: blender --background blender/ocean_scene.blend --python scripts/ocean_zone_pass3.py

Austen's screenshot (2026-08-09): coral bed + reef ledge + basalt column all
occupying the same footprint at the canyon south flank. Pass 2's 0.72
combined-radius tolerance is too lenient for large irregular meshes. This pass
uses 0.95 for any pair involving a basalt or other large body, and explicitly
re-homes the two objects that were parked against the pinnacle.
"""

import bpy
import math
import random
import shutil
from pathlib import Path
from mathutils import Vector

SEED = 733331
rng = random.Random(SEED)
STAGE_CLEAR = 5.5
# Matches placementRules.outerBoundaryMetres in scripts/ocean-zone-layout.json.
# 20 was what literally encoded the ring: content stopped at 20 because this
# said 20. It is now the shelf lip, past which the floor falls into the abyss.
# NOTE: ground_snap below still snaps to an ABSOLUTE z and knows nothing about
# terrain height. Run scripts/reground-ocean-placements.py after this script.
BOUNDARY = 24.0


def obj(name):
    o = bpy.data.objects.get(name)
    if o is None:
        print(f"WARN missing object: {name}")
    return o


def ground_snap(o, target_min_z=-0.15):
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
    min_z = min(c.z for c in corners)
    o.location.z += target_min_z - min_z


def xy_radius(o):
    return 0.5 * max(o.dimensions.x, o.dimensions.y) * 0.9


def clamp_position(o):
    x, y = o.location.x, o.location.y
    d = math.hypot(x, y)
    if d < STAGE_CLEAR and d > 0:
        s = STAGE_CLEAR / d
        o.location.x, o.location.y = x * s, y * s
    elif d > BOUNDARY:
        s = BOUNDARY / d
        o.location.x, o.location.y = x * s, y * s


# Explicit re-homes: clear the canyon south flank entirely.
for name, x, y, rot in [
    ("Reef_Ledge", -16.5, -8.5, 55),       # canyon outflow shelf, well clear
    ("Living_Rock", -6.5, -8.0, 0),        # west stepping-stone core, off flank
]:
    o = obj(name)
    if o:
        o.location.x, o.location.y = x, y
        o.rotation_mode = "XYZ"
        o.rotation_euler.z = math.radians(rot)
        ground_snap(o)

ANCHORS = {
    "Sunlit_Arch_001", "Underwater_Arch_001", "Coral_Arch",
    "Coral_Mountain", "Coral_Citadel_001", "Coral_Tower",
    "Basalt_Columns", "Basalt_Pinnacle", "Reef_Wall", "Seabed",
}
LARGE_PREFIXES = (
    "Basalt_", "Coral_", "Reef_", "Photo_", "Neon_", "Sunlit_",
    "Underwater_", "Encrusted", "Living_Rock", "Rock_Table", "PH_",
    "Tall_Kelp",
)
large = [
    o for o in bpy.data.objects
    if o.type == "MESH"
    and o.name.startswith(LARGE_PREFIXES)
    and not o.name.endswith("_template")
    and o.name != "Seabed"
]


def sep_factor(a, b):
    # big irregular bodies need near-full clearance; small stuff can nestle
    if xy_radius(a) > 2.5 or xy_radius(b) > 2.5:
        return 0.95
    return 0.72


moved = 0
for _ in range(14):
    any_push = False
    for i in range(len(large)):
        for j in range(i + 1, len(large)):
            a, b = large[i], large[j]
            if a.name in ANCHORS and b.name in ANCHORS:
                continue
            if a.name.startswith("Tall_Kelp") and b.name.startswith("Tall_Kelp"):
                continue
            ra, rb = xy_radius(a), xy_radius(b)
            dx = b.location.x - a.location.x
            dy = b.location.y - a.location.y
            d = math.hypot(dx, dy)
            min_d = (ra + rb) * sep_factor(a, b)
            if d >= min_d:
                continue
            if a.name in ANCHORS:
                mover, sx, sy = b, dx, dy
            elif b.name in ANCHORS:
                mover, sx, sy = a, -dx, -dy
            elif ra >= rb:
                mover, sx, sy = b, dx, dy
            else:
                mover, sx, sy = a, -dx, -dy
            if d < 0.01:
                ang = rng.random() * 2 * math.pi
                sx, sy, d = math.cos(ang), math.sin(ang), 1.0
            push = (min_d - d) + 0.3
            mover.location.x += sx / d * push
            mover.location.y += sy / d * push
            clamp_position(mover)
            any_push = True
            moved += 1
    if not any_push:
        break
print(f"PASS3 pushes applied: {moved}")

for o in large:
    ground_snap(o)

# Residual audit: report any large pair still under hard clearance.
bpy.context.view_layer.update()
residual = []
for i in range(len(large)):
    for j in range(i + 1, len(large)):
        a, b = large[i], large[j]
        if a.name in ANCHORS and b.name in ANCHORS:
            continue
        if a.name.startswith("Tall_Kelp") and b.name.startswith("Tall_Kelp"):
            continue
        ra, rb = xy_radius(a), xy_radius(b)
        d = math.hypot(b.location.x - a.location.x, b.location.y - a.location.y)
        if d < (ra + rb) * sep_factor(a, b) - 0.05:
            residual.append((a.name, b.name, round(d, 1)))
print("RESIDUAL OVERLAPS:", residual if residual else "none")

violations = []
for o in bpy.data.objects:
    if o.type != "MESH" or o.name.startswith(("Dais", "Torch", "Seabed", "src_")) or o.name.endswith("_template"):
        continue
    if math.hypot(o.location.x, o.location.y) < 5.0:
        violations.append((o.name, round(o.location.x, 2), round(o.location.y, 2)))
print("EXCLUSION VIOLATIONS:", violations if violations else "none")

# Renders
REPO = Path(bpy.data.filepath).resolve().parent.parent
PREVIEWS = REPO / "blender" / "previews"
cam_data = bpy.data.cameras.new("P3Cam")
cam = bpy.data.objects.new("P3Cam", cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.engine = "BLENDER_EEVEE"
sun = bpy.data.objects.new("P3Sun", bpy.data.lights.new("P3Sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(20))
bpy.context.scene.collection.objects.link(sun)


def aim(camera, target):
    d = Vector(target) - camera.location
    camera.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


shots = [
    ("pass3-canyon-southeast.png", (0, -14, 5), (-14, 2, 3), None),
    ("pass3-default-cam.png", (0, -26, 9), (0, 6, 2), None),
    ("pass3-top-down.png", (0, 4, 60), None, 55),
]
for fname, loc, target, ortho in shots:
    cam.location = loc
    if ortho:
        cam.rotation_euler = (0, 0, 0)
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho
    else:
        cam_data.type = "PERSP"
        aim(cam, target)
    bpy.context.scene.render.filepath = str(PREVIEWS / fname)
    bpy.ops.render.render(write_still=True)

for tmp in (cam, sun):
    bpy.data.objects.remove(tmp, do_unlink=True)

blend_path = Path(bpy.data.filepath)
backup = blend_path.with_name("ocean_scene.pre-pass3.blend")
if not backup.exists():
    shutil.copy2(blend_path, backup)
    print(f"BACKUP -> {backup}")
bpy.ops.wm.save_mainfile()
print("SAVED", blend_path)
