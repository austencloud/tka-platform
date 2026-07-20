"""Export the authored Blossom garden to an uncompressed intermediate GLB.

Run after ``build-blossom-environment.py``:

  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background blender/blossom_environment.blend ^
    --python scripts/blender-export-blossom-full.py

Output: static/models/blossom/blossom_environment_raw.glb
"""

import os

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "blossom")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "blossom_environment_raw.glb")
SKIP_PREFIXES = ("Camera", "Light", "Focus", "QA_")

os.makedirs(OUTPUT_DIR, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")

selected = []
for obj in bpy.data.objects:
    if obj.type != "MESH" or any(obj.name.startswith(prefix) for prefix in SKIP_PREFIXES):
        continue
    obj.select_set(True)
    selected.append(obj.name)

if not selected:
    raise RuntimeError("Blossom export found no mesh objects")

export_kwargs = dict(
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

try:
    bpy.ops.export_scene.gltf(**export_kwargs, export_gpu_instances=True)
    gpu_instances = "requested"
except TypeError:
    bpy.ops.export_scene.gltf(**export_kwargs)
    gpu_instances = "exporter fallback"

print("\nBlossom clean export complete")
print(f"Selected mesh objects: {len(selected)}")
print(f"GPU instances:         {gpu_instances}")
print(f"Output:                {OUTPUT_PATH}")
print(f"Size:                  {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")
