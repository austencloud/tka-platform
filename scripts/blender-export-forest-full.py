"""Export the authored Moonlit Firefly Forest environment to an uncompressed GLB.

Run after ``build-forest-environment.py``. QA cameras, lights, and performer
markers are excluded.

Output: static/models/forest/forest-environment_raw.glb
"""

import os

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "forest")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "forest-environment_raw.glb")
SKIP_PREFIXES = ("Camera", "Light", "QA_")

os.makedirs(OUTPUT_DIR, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")

selected = []
for obj in bpy.data.objects:
    if obj.type != "MESH" or any(
        obj.name.startswith(prefix) for prefix in SKIP_PREFIXES
    ):
        continue
    obj.select_set(True)
    selected.append(obj.name)

if not selected:
    raise RuntimeError("Forest export found no production mesh objects")

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    use_selection=True,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_extras=True,
)

print("\nForest clean export complete")
print(f"Selected mesh objects: {len(selected)}")
print(f"Output:                {OUTPUT_PATH}")
print(f"Size:                  {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.2f} MiB")
