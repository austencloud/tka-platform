"""
Export all ocean flora/structure objects as a single GLB.
Blender handles Z-up → Y-up conversion and transform preservation.
The resulting GLB renders identically to the Blender viewport —
no runtime normalization, no coordinate conversion, no placement data.

Run headless:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background blender/ocean_scene.blend ^
    --python scripts/blender-export-flora-scene.py

Output: static/models/ocean/ocean_flora_scene.glb
"""
import bpy
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
output_dir = os.path.join(project_root, "static", "models", "ocean")
output_path = os.path.join(output_dir, "ocean_flora_scene.glb")

os.makedirs(output_dir, exist_ok=True)

SKIP_PREFIXES = [
    "Stage_", "Seabed", "Water", "Torch", "Light", "Camera", "Plane",
    "Performer", "Grid", "Circle", "Cube", "Sphere", "Empty", "Armature",
]

bpy.ops.object.select_all(action='DESELECT')

selected = []
skipped = []

for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    name = obj.name
    if any(name.startswith(p) for p in SKIP_PREFIXES):
        skipped.append(name)
        continue
    obj.select_set(True)
    selected.append(name)

print(f"\n{'='*60}")
print(f"Ocean Flora Scene Export")
print(f"{'='*60}")
print(f"Selected: {len(selected)} flora/structure objects")
print(f"Skipped:  {len(skipped)} non-flora objects")

if not selected:
    print("ERROR: No objects selected for export!")
    raise SystemExit(1)

export_kwargs = dict(
    filepath=output_path,
    use_selection=True,
    export_format='GLB',
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
)

try:
    bpy.ops.export_scene.gltf(
        **export_kwargs,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
    )
    compression = "Draco (level 6)"
except TypeError:
    bpy.ops.export_scene.gltf(**export_kwargs)
    compression = "None (Draco not available)"

file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"\nCompression: {compression}")
print(f"Output:      {output_path}")
print(f"Size:        {file_size_mb:.1f} MB")

from collections import Counter
prefixes = Counter()
for name in selected:
    prefix = name.split('.')[0].rsplit('_', 1)[0] if '_' in name else name.split('.')[0]
    prefixes[prefix] += 1

print(f"\nObject breakdown:")
for prefix, count in prefixes.most_common():
    print(f"  {prefix}: {count}")
