"""
Build the ocean ruins dais in Blender and export it as a GLB.

This authors the dais GEOMETRY in Blender (the all-Blender pipeline). The
bioluminescent crack glow stays a runtime Threlte shader — glTF can't carry a
live procedural shader — so the deck is given its own material/mesh name
("Dais_Deck" / material "DaisDeck") that the runtime targets for the shader
swap. Everything else carries material "DaisStone".

Local layout is Z-up with the base at z=0 (the seabed plane). The runtime places
the whole GLB at the seabed height; deck top sits at z = elevation + height.

Run headless:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \\
    --background --factory-startup \\
    --python scripts/build-ocean-dais.py

Output: static/models/ocean/dais.glb
"""
import bpy
import os
import math

# ── Dimensions (match the recovered RuinsPlatform config) ───────────────────
WIDTH = 8.0
DEPTH = 6.0
HEIGHT = 0.5        # body slab thickness
ELEVATION = 0.5     # pillar height (gap between sand and slab)
DECK_Z = ELEVATION + HEIGHT  # 1.0 — top surface

# ── Clean slate ─────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)

stone_mat = bpy.data.materials.new("DaisStone")
stone_mat.use_nodes = False
stone_mat.diffuse_color = (0.10, 0.13, 0.16, 1.0)

deck_mat = bpy.data.materials.new("DaisDeck")
deck_mat.use_nodes = False
deck_mat.diffuse_color = (0.10, 0.16, 0.13, 1.0)


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
    # Taper: scale top ring by r_top/r_bot via a simple uniform-ish stand-in.
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

# ── Export ──────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="SELECT")

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
output_dir = os.path.join(project_root, "static", "models", "ocean")
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "dais.glb")

export_kwargs = dict(
    filepath=output_path,
    use_selection=True,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
)
try:
    bpy.ops.export_scene.gltf(
        **export_kwargs,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    compression = "Draco"
except TypeError:
    bpy.ops.export_scene.gltf(**export_kwargs)
    compression = "none"

size_kb = os.path.getsize(output_path) / 1024
print(f"\nDais GLB written: {output_path}")
print(f"Compression: {compression}  Size: {size_kb:.1f} KB")

# Save a real .blend so the dais can be opened and edited in Blender — the GLB
# is the runtime artifact; this .blend is the editable source.
blend_path = os.path.join(project_root, "blender", "ocean_dais.blend")
os.makedirs(os.path.dirname(blend_path), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Editable source: {blend_path}")
print("Objects:", [o.name for o in bpy.data.objects])
