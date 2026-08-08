"""Export the authored Moonlit Winter Hollow to an uncompressed GLB.

Run after ``build-winter-environment.py``. QA cameras, lights, performer,
preview pond, and source prototypes are excluded. Linked scenery remains linked
so the optimization pass can convert it to GPU instance batches.

Output: static/models/winter/winter-environment_raw.glb
"""

import os

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "winter")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "winter-environment_raw.glb")
SKIP_PREFIXES = ("Camera", "Light", "QA_", "AssetSource_")

os.makedirs(OUTPUT_DIR, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")

selected = []
for obj in bpy.data.objects:
    if obj.type != "MESH" or any(obj.name.startswith(prefix) for prefix in SKIP_PREFIXES):
        continue
    obj.select_set(True)
    selected.append(obj.name)

if not selected:
    raise RuntimeError("Winter export found no production mesh objects")

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

print("\nWinter clean export complete")
print(f"Selected mesh objects: {len(selected)}")
print(f"GPU instances:         {gpu_instances}")
print(f"Output:                {OUTPUT_PATH}")
print(f"Size:                  {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.2f} MiB")
