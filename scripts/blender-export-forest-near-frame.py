"""Export the conditional close-frame trees and attached static ecology.

Run after ``build-forest-environment.py``. The default Forest scene mounts this
asset. Callers that explicitly widen the clearing, including Coven Hub, omit it.

Output: static/models/forest/forest-near-frame_raw.glb
"""

import os

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "forest")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "forest-near-frame_raw.glb")

os.makedirs(OUTPUT_DIR, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")

selected = []
for obj in bpy.data.objects:
    if obj.type != "MESH" or obj.get("tka_export_layer") != "near-frame":
        continue
    obj.select_set(True)
    selected.append(obj.name)

if not selected:
    raise RuntimeError("Forest near-frame export found no production mesh objects")

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

print("\nForest near-frame export complete")
print(f"Selected mesh objects: {len(selected)}")
print(f"Output:                {OUTPUT_PATH}")
print(f"Size:                  {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.2f} MiB")
