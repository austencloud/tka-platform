"""Ocean zone pass 2 — intersection separation + species-logical placement.

Run: blender --background blender/ocean_scene.blend --python scripts/ocean_zone_refine.py

Fixes from Austen's review of pass 1 (2026-08-09):
1. Coral/reef beds interpenetrating the relocated basalt masses — resolve all
   large-object overlaps by pushing the smaller object clear (anchors stay put).
2. "AI blend" randomness in the small scatter — reassign species to locations
   that make biological sense: urchins hug rock bases, shells drift on open
   sand, starfish work the sand near stepping stones and the garden apron,
   anemones live in the garden and on stepping stones, never in empty midwater
   sand alone.
3. Reef_Ledge floated alone mid-sand — now shelves against the basalt canyon's
   south flank.
"""

import bpy
import math
import random
import shutil
from pathlib import Path
from mathutils import Vector

SEED = 911527
rng = random.Random(SEED)

STAGE_CLEAR = 5.5
BOUNDARY = 20.0


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


# ---------------------------------------------------------------- pass 2.3
# Reef_Ledge shelves against the basalt canyon south flank instead of floating
# alone on open sand.
ledge = obj("Reef_Ledge")
if ledge:
    ledge.location.x, ledge.location.y = -11.0, -5.5
    ledge.rotation_mode = "XYZ"
    ledge.rotation_euler.z = math.radians(100)
    ground_snap(ledge)

# ---------------------------------------------------------------- pass 2.1
# Large-object interpenetration resolve. Anchors (composition-critical) never
# move; everything else yields, pushed radially apart until clear.
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

moved = 0
for _ in range(10):
    any_push = False
    for i in range(len(large)):
        for j in range(i + 1, len(large)):
            a, b = large[i], large[j]
            ra, rb = xy_radius(a), xy_radius(b)
            dx = b.location.x - a.location.x
            dy = b.location.y - a.location.y
            d = math.hypot(dx, dy)
            min_d = (ra + rb) * 0.72
            if d >= min_d or (a.name in ANCHORS and b.name in ANCHORS):
                continue
            # kelp-vs-kelp crowding is the curtain working as designed
            if a.name.startswith("Tall_Kelp") and b.name.startswith("Tall_Kelp"):
                continue
            # push the non-anchor (or smaller) object
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
print(f"OVERLAP pushes applied: {moved}")

# ---------------------------------------------------------------- pass 2.2
# Species-logical scatter. Deterministic, seeded.
bpy.context.view_layer.update()
rock_anchors = [
    o for o in bpy.data.objects
    if o.type == "MESH"
    and o.name.startswith(("Basalt_", "PH_boulder", "PH_coast", "PH_stone", "Rock_Table", "Living_Rock", "Encrusted"))
    and not o.name.endswith("_template")
]


def scatter_ring(anchor, r_min, r_max):
    ang = rng.random() * 2 * math.pi
    r = r_min + rng.random() * (r_max - r_min)
    return anchor.location.x + math.cos(ang) * r, anchor.location.y + math.sin(ang) * r


def scatter_ellipse(cx, cy, rx, ry, rot_deg=0.0):
    t = rng.random() * 2 * math.pi
    r = math.sqrt(rng.random())
    ex, ey = math.cos(t) * rx * r, math.sin(t) * ry * r
    rot = math.radians(rot_deg)
    return (cx + ex * math.cos(rot) - ey * math.sin(rot),
            cy + ex * math.sin(rot) + ey * math.cos(rot))


def family(prefix):
    return sorted(
        (o for o in bpy.data.objects if o.name.startswith(prefix) and not o.name.startswith("src_")),
        key=lambda o: o.name,
    )


# Urchins hug rock bases (crevice feeders).
for u in family("Sea_Urchin"):
    anchor = rng.choice(rock_anchors)
    base_r = xy_radius(anchor)
    u.location.x, u.location.y = scatter_ring(anchor, base_r * 0.95, base_r * 1.25)
    clamp_position(u)
    ground_snap(u)

# Shells drift on the open southern sand and the foreground fringe.
for s in family("Shell"):
    if rng.random() < 0.7:
        s.location.x, s.location.y = scatter_ellipse(0, -12, 8, 5)
    else:
        s.location.x, s.location.y = scatter_ellipse(0, -8, 9, 2)
    clamp_position(s)
    ground_snap(s)

# Starfish work the sand aprons of the stepping stones and the garden edge.
STARFISH_SPOTS = [(9, -2, 3.5, 2.5, 0), (-9, -3, 3.5, 2.5, 0), (10.5, 1.5, 3, 2, -25), (0, -9, 7, 2, 0)]
for st in family("Starfish"):
    cx, cy, rx, ry, rot = rng.choice(STARFISH_SPOTS)
    st.location.x, st.location.y = scatter_ellipse(cx, cy, rx, ry, rot)
    clamp_position(st)
    ground_snap(st)

# Anemones live in the coral garden and on the stepping stones — never alone
# in empty sand.
ANEMONE_SPOTS = [(14, 6, 6, 4, -25), (9, -2, 3, 2, 0), (-8.5, 3, 3, 2, 0)]
for a in family("Anemone"):
    cx, cy, rx, ry, rot = rng.choice(ANEMONE_SPOTS)
    a.location.x, a.location.y = scatter_ellipse(cx, cy, rx, ry, rot)
    clamp_position(a)
    ground_snap(a)

# Small flora standing inside a large object's footprint (the pass-1 "coral
# beds stuck through the basalts") — expel radially to just outside the base.
big_bodies = [o for o in large if xy_radius(o) > 2.5]
SMALL_PREFIXES = ("Sea_Grass", "Shale_Rock", "Mesh_0", "Volcanic_Rock", "Starfish", "Shell", "Anemone")
expelled = 0
for o in bpy.data.objects:
    if o.type != "MESH" or not o.name.startswith(SMALL_PREFIXES) or o.name.startswith("src_"):
        continue
    for big in big_bodies:
        if big.name == o.name:
            continue
        br = xy_radius(big)
        dx = o.location.x - big.location.x
        dy = o.location.y - big.location.y
        d = math.hypot(dx, dy)
        if d < br * 0.95:
            if d < 0.01:
                ang = rng.random() * 2 * math.pi
                dx, dy, d = math.cos(ang), math.sin(ang), 1.0
            s = (br * 1.08) / d
            o.location.x = big.location.x + dx * s
            o.location.y = big.location.y + dy * s
            clamp_position(o)
            ground_snap(o)
            expelled += 1
print(f"EXPELLED from large footprints: {expelled}")

# Ground-snap everything large that the overlap resolver moved.
for o in large:
    ground_snap(o)

# ------------------------------------------------------- exclusion audit
violations = []
bpy.context.view_layer.update()
for o in bpy.data.objects:
    if o.type != "MESH" or o.name.startswith(("Dais", "Torch", "Seabed", "src_")) or o.name.endswith("_template"):
        continue
    if math.hypot(o.location.x, o.location.y) < 5.0:
        violations.append((o.name, round(o.location.x, 2), round(o.location.y, 2)))
print("EXCLUSION VIOLATIONS:", violations if violations else "none")

# ------------------------------------------------------------- renders
REPO = Path(bpy.data.filepath).resolve().parent.parent
PREVIEWS = REPO / "blender" / "previews"
PREVIEWS.mkdir(exist_ok=True)

cam_data = bpy.data.cameras.new("RefineCam")
cam = bpy.data.objects.new("RefineCam", cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.engine = "BLENDER_EEVEE"

sun = bpy.data.objects.new("RefineSun", bpy.data.lights.new("RefineSun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(20))
bpy.context.scene.collection.objects.link(sun)


def aim(camera, target):
    d = Vector(target) - camera.location
    camera.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


shots = [
    ("refine-default-cam.png", (0, -26, 9), (0, 6, 2), None),
    ("refine-canyon-west.png", (2, -2, 6), (-16, 3, 3), None),
    ("refine-top-down.png", (0, 4, 60), None, 55),
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
backup = blend_path.with_name("ocean_scene.pre-refine-pass.blend")
if not backup.exists():
    shutil.copy2(blend_path, backup)
    print(f"BACKUP -> {backup}")
bpy.ops.wm.save_mainfile()
print("SAVED", blend_path)
