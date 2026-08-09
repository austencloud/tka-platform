"""Export ONLY the sculpted seabed terrain to its own GLB.

The ocean runtime loads two GLBs, and the split is load-bearing:

  ocean-environment.glb  the seabed  — loaded at EVERY quality tier
  ocean_flora_scene.glb  the reef    — skipped entirely on LOW

So the terrain cannot ride along inside the flora export: LOW would lose its
floor, and every other tier would render two floors stacked on each other.
blender-export-ocean-full.py therefore skips "Seabed", and this script is the
only thing that produces it.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/blender-export-ocean-seabed.py

Then: node scripts/optimize-ocean-seabed.mjs

Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
"""

import os

import bpy

script_dir = os.path.dirname(os.path.abspath(bpy.data.filepath))
project_root = os.path.dirname(script_dir)
output_path = os.path.join(
    project_root, "static", "models", "ocean", "ocean_seabed_raw.glb"
)

seabed = bpy.data.objects.get("Seabed")
if seabed is None:
    raise SystemExit("ERROR: no object named 'Seabed' in this .blend")

bpy.ops.object.select_all(action="DESELECT")
seabed.select_set(True)
bpy.context.view_layer.objects.active = seabed

colour_layers = [layer.name for layer in seabed.data.color_attributes]
print(f"SEABED verts={len(seabed.data.vertices)} colour_layers={colour_layers}")
if "OceanDepth" not in colour_layers:
    # The depth ramp is what makes the drop-off read as depth rather than as a
    # ledge over flat colour. Exporting without it silently ships the ring back.
    raise SystemExit("ERROR: OceanDepth colour layer missing; run wire-ocean-depth-colour.py")

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    # Blender 5.0 renamed the old `export_colors` flag. This is the whole point
    # of the export — COLOR_0 carries the depth ramp — so name it explicitly
    # rather than trusting a default.
    export_vertex_color="MATERIAL",
    export_all_vertex_colors=True,
)

size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"SEABED_EXPORTED {output_path} {size_mb:.1f} MB")
