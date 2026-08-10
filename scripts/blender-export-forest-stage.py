"""Export the Forest-owned Gate 10 stage from its deterministic Blender file.

Run after ``build-forest-stage.py``.

Output: static/models/forest/forest-stage_raw.glb
"""

import os

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "forest")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "forest-stage_raw.glb")

os.makedirs(OUTPUT_DIR, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")

selected = []
for obj in bpy.data.objects:
    if obj.type != "MESH" or obj.get("tka_export_layer") != "forest-stage":
        continue
    obj.select_set(True)
    selected.append(obj.name)

if not selected:
    raise RuntimeError("Forest stage export found no production mesh objects")

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

print("\nForest stage export complete")
print(f"Selected mesh objects: {len(selected)}")
print(f"Output:                {OUTPUT_PATH}")
print(f"Size:                  {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.2f} MiB")
