"""
Merge the ruins dais INTO blender/ocean_scene.blend (the single ocean source).

Removes the legacy wooden Stage_* deck (doesn't fit the underwater vibe) and
builds the Dais_* geometry in-place, so the whole ocean — reef + dais — lives in
one .blend. The bioluminescent crack glow stays a runtime Threlte shader; the
deck keeps its own material/mesh name ("Dais_Deck" / "DaisDeck") that the runtime
targets for the shader swap. Everything else carries "DaisStone".

Dais local layout is Z-up with the base at z=0 (the seabed plane). The runtime
places the dais GLB at the seabed height; deck top sits at z = elevation + height.

Run headless (NO --factory-startup — we open the real scene file):
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \\
    --background blender/ocean_scene.blend \\
    --python scripts/merge-dais-into-ocean.py

Saves blender/ocean_scene.blend in place. Re-export the dais GLB after with:
  blender --background blender/ocean_scene.blend \\
    --python scripts/blender-export-glb.py -- --include Dais_ \\
    --output static/models/ocean/dais.glb
"""
import bpy
import os

# ── Dimensions (match the recovered RuinsPlatform config) ───────────────────
WIDTH = 8.0
DEPTH = 6.0
HEIGHT = 0.5        # body slab thickness
ELEVATION = 0.5     # pillar height (gap between sand and slab)
DECK_Z = ELEVATION + HEIGHT  # 1.0 — top surface

# ── Remove the legacy wooden stage ───────────────────────────────────────────
wooden = [o for o in bpy.data.objects if o.name.startswith("Stage_")]
for obj in wooden:
    bpy.data.objects.remove(obj, do_unlink=True)
print(f"Removed {len(wooden)} wooden Stage_* objects")

# ── Remove any prior dais (idempotent re-run) ────────────────────────────────
prior = [o for o in bpy.data.objects if o.name.startswith("Dais_")]
for obj in prior:
    bpy.data.objects.remove(obj, do_unlink=True)
if prior:
    print(f"Removed {len(prior)} stale Dais_* objects (re-run)")

# ── Materials (reuse if already present) ─────────────────────────────────────
def get_mat(name, rgba):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = False
    mat.diffuse_color = rgba
    return mat

stone_mat = get_mat("DaisStone", (0.10, 0.13, 0.16, 1.0))
deck_mat = get_mat("DaisDeck", (0.10, 0.16, 0.13, 1.0))


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def add_box(name, w, d, h, z, mat):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return obj


def add_plane(name, w, d, z, mat):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return obj


def add_cylinder(name, r_top, r_bot, h, x, y, z, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r_bot, depth=h, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, mat)
    return obj


# ── Body slab (z 0.5 → 1.0) ─────────────────────────────────────────────────
add_box("Dais_Body", WIDTH, DEPTH, HEIGHT, ELEVATION + HEIGHT / 2, stone_mat)

# ── Deck surface (the shader target), z = 1.0 ───────────────────────────────
add_plane("Dais_Deck", WIDTH, DEPTH, DECK_Z + 0.001, deck_mat)

# ── Support pillars (z 0 → 0.5), 6 around the slab ──────────────────────────
hw, hd = WIDTH * 0.4, DEPTH * 0.4
pillar_xy = [(-hw, -hd), (-hw, hd), (hw, -hd), (hw, hd), (0, -hd), (0, hd)]
for i, (px, py) in enumerate(pillar_xy):
    add_cylinder(f"Dais_Pillar_{i}", 0.2, 0.35, ELEVATION, px, py, ELEVATION / 2, stone_mat)

# ── Overgrown column stumps on top of the deck ──────────────────────────────
chw, chd = WIDTH * 0.46, DEPTH * 0.46
col_xy = [(-chw, -chd), (-chw, chd), (chw, -chd), (chw, chd), (0, -chd), (0, chd)]
for i, (cx, cy) in enumerate(col_xy):
    ch = 0.3 + (i % 3) * 0.12
    add_cylinder(f"Dais_Column_{i}", 0.12, 0.15, ch, cx, cy, DECK_Z + ch / 2, stone_mat)

# ── Save in place ────────────────────────────────────────────────────────────
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print(f"Saved: {bpy.data.filepath}")
print("Dais objects:", [o.name for o in bpy.data.objects if o.name.startswith("Dais_")])
print("Remaining Stage_*:", [o.name for o in bpy.data.objects if o.name.startswith("Stage_")])
