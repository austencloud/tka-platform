"""Export the approved Forest campsite from its deterministic Blender file.

Run after ``build-forest-campsite.py``.

Output: static/models/forest/forest-campsite_raw.glb
"""

import os

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "forest")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "forest-campsite_raw.glb")

os.makedirs(OUTPUT_DIR, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")

selected = []
for obj in bpy.data.objects:
    if obj.get("tka_export_layer") != "forest-campsite":
        continue
    obj.select_set(True)
    selected.append(obj.name)

if not selected:
    raise RuntimeError("Forest campsite export found no production objects")

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    use_selection=True,
    export_format="GLB",
    export_apply=False,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_extras=True,
)

print("\nForest campsite export complete")
print(f"Selected objects: {len(selected)}")
print(f"Output:           {OUTPUT_PATH}")
print(f"Size:             {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.2f} MiB")
