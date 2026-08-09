"""Ocean zone recomposition — stage heroes per scripts/ocean-zone-layout.json.

Run: blender --background blender/ocean_scene.blend --python scripts/ocean_zone_recompose.py
Coordinate frame: runtime [x, y, z] = Blender (x, z, -y). Zone centers in the
layout JSON are runtime [x, z], so Blender (x, y) = (x, -z).

Copies the .blend to ocean_scene.pre-zone-pass.blend before saving over the
original, renders verification frames to blender/previews/, and prints a 5 m
stage-exclusion audit.
"""

import bpy
import math
import random
import shutil
from pathlib import Path

REPO = Path(bpy.data.filepath).resolve().parent.parent
PREVIEWS = REPO / "blender" / "previews"
PREVIEWS.mkdir(exist_ok=True)

SEED = 840917
rng = random.Random(SEED)


def obj(name):
    o = bpy.data.objects.get(name)
    if o is None:
        print(f"WARN missing object: {name}")
    return o


def ground_snap(o, target_min_z=-0.15):
    """Drop the object so its world bbox base sits just under the seabed top."""
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ mathutils_v(c) for c in o.bound_box]
    min_z = min(c.z for c in corners)
    o.location.z += target_min_z - min_z


def mathutils_v(c):
    from mathutils import Vector
    return Vector(c)


def place(name, x, y, rot_z_deg=None, scale_mul=None, snap=True):
    o = obj(name)
    if o is None:
        return
    o.location.x = x
    o.location.y = y
    if rot_z_deg is not None:
        o.rotation_mode = "XYZ"
        o.rotation_euler.z = math.radians(rot_z_deg)
    if scale_mul is not None:
        o.scale = [s * scale_mul for s in o.scale]
    if snap:
        ground_snap(o)


# ---------------------------------------------------------------- heroes
# 1. Proscenium: sunlit arch dead-center upstage, scaled to frame the 8x6 dais.
#    Absolute scale (original authored scale was 3.0) so reruns stay idempotent.
_arch = obj("Sunlit_Arch_001")
if _arch:
    _arch.scale = (4.8, 4.8, 4.8)
place("Sunlit_Arch_001", 0.0, 13.0, rot_z_deg=0)

# 2. Arch colonnade curving from the proscenium toward the kelp curtain (NW).
place("Underwater_Arch_001", -5.0, 15.5, rot_z_deg=-25)
place("Coral_Arch", -10.0, 18.0, rot_z_deg=-50)

# 3. Coral skyline trio behind/right of the proscenium — three stepped heights
#    (mountain 4.8 m > citadel 3.6 m > tower 3.2 m), no two equal from camera.
place("Coral_Mountain", -4.0, 18.5)
place("Coral_Citadel_001", 5.5, 17.5)
place("Coral_Tower", 9.5, 14.0)

# 4. Wide reef broadside as the eastern backdrop shoulder of the coral garden.
place("Reef_Wall", 15.0, 8.5, rot_z_deg=0)

# 5. Basalt slot canyon west: two staggered lines, ~3.5 m navigable gap,
#    taller stack upstage.
# Footprints are ~8 m each; centers must sit ~12 m apart for a real gap.
place("Basalt_Columns", -20.0, 7.5, rot_z_deg=75)
place("Basalt_Pinnacle", -12.0, -1.5, rot_z_deg=100)
place("Encrusted_Rock", -19.0, -2.5)

# 6. Coral garden east — museum specimen pads, each with clear space.
place("Neon_Summit_001", 12.0, 4.0)
place("Photo_Coral_0_001", 17.0, 4.5)
place("Photo_Coral_1_001", 11.0, 7.5)
place("Photo_Coral_2_001", 16.0, 7.5)
place("Photo_Coral_3_001", 13.5, 10.0)
place("Coral_Bommie", 12.0, 1.5)

# 7. Mid-ground stepping-stone cores (bridge the dead zone, outside 5 m).
place("Rock_Table_001", 9.0, -2.0)
place("Living_Rock", -9.0, -3.0)
place("Reef_Ledge", -8.5, 3.0, rot_z_deg=20)

# ------------------------------------------------- kelp curtain (NW wall)
# Mass all Tall_Kelp into one elliptical curtain, seeded, instead of scatter.
CURTAIN_C = (-12.0, 14.0)
CURTAIN_R = (8.0, 4.0)
CURTAIN_ROT = math.radians(35)
kelps = sorted((o for o in bpy.data.objects if o.name.startswith("Tall_Kelp")), key=lambda o: o.name)
for k in kelps:
    # rejection-free: uniform in ellipse via sqrt radius
    t = rng.random() * 2 * math.pi
    r = math.sqrt(rng.random())
    ex = math.cos(t) * CURTAIN_R[0] * r
    ey = math.sin(t) * CURTAIN_R[1] * r
    x = CURTAIN_C[0] + ex * math.cos(CURTAIN_ROT) - ey * math.sin(CURTAIN_ROT)
    y = CURTAIN_C[1] + ex * math.sin(CURTAIN_ROT) + ey * math.cos(CURTAIN_ROT)
    k.location.x, k.location.y = x, y
    k.rotation_euler.z = rng.random() * 2 * math.pi

# Reef_medium_027 sat inside the 5 m performer exclusion — move to the east
# stepping-stone band.
place("Reef_medium_027_mesh", 6.5, 6.5)

# ------------------------------------------------------- exclusion audit
KEEP_PREFIXES = ("Dais", "Torch", "Seabed", "src_")
violations = []
bpy.context.view_layer.update()
for o in bpy.data.objects:
    if o.type != "MESH" or o.name.startswith(KEEP_PREFIXES) or o.name.endswith("_template"):
        continue
    if math.hypot(o.location.x, o.location.y) < 5.0:
        violations.append((o.name, round(o.location.x, 2), round(o.location.y, 2)))
print("EXCLUSION VIOLATIONS:", violations if violations else "none")

# ------------------------------------------------------------- renders
from mathutils import Vector

cam_data = bpy.data.cameras.new("ZonePassCam")
cam = bpy.data.objects.new("ZonePassCam", cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.engine = "BLENDER_EEVEE"

sun = bpy.data.objects.new("ZonePassSun", bpy.data.lights.new("ZonePassSun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(20))
bpy.context.scene.collection.objects.link(sun)


def aim(camera, target):
    d = Vector(target) - camera.location
    camera.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


# Default-camera-ish view (runtime camera sits downstage +Z = Blender -Y).
cam.location = (0, -26, 9)
aim(cam, (0, 6, 2))
bpy.context.scene.render.filepath = str(PREVIEWS / "zone-pass-default-cam.png")
bpy.ops.render.render(write_still=True)

# Top-down contact sheet.
cam.location = (0, 4, 60)
cam.rotation_euler = (0, 0, 0)
cam_data.type = "ORTHO"
cam_data.ortho_scale = 55
bpy.context.scene.render.filepath = str(PREVIEWS / "zone-pass-top-down.png")
bpy.ops.render.render(write_still=True)

# ------------------------------------------------------------- save
for tmp in (cam, sun):
    bpy.data.objects.remove(tmp, do_unlink=True)

blend_path = Path(bpy.data.filepath)
backup = blend_path.with_name("ocean_scene.pre-zone-pass.blend")
if not backup.exists():
    shutil.copy2(blend_path, backup)
    print(f"BACKUP -> {backup}")
bpy.ops.wm.save_mainfile()
print("SAVED", blend_path)
