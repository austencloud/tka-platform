"""
Export ocean scene from Blender WITH textures and seabed terrain.

Exports all flora, structures, AND the seabed as a single GLB.
Textures are preserved — gltf-transform handles compression afterward.
Blender handles Z-up → Y-up conversion automatically.

Run headless:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background blender/ocean_scene.blend ^
    --python scripts/blender-export-ocean-full.py

Output: static/models/ocean/ocean_scene_raw.glb
Then run: node scripts/optimize-ocean-glb.mjs
"""
import bpy
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
output_dir = os.path.join(project_root, "static", "models", "ocean")
output_path = os.path.join(output_dir, "ocean_scene_raw.glb")

os.makedirs(output_dir, exist_ok=True)

SKIP_PREFIXES = [
    "Stage_", "Water", "Torch", "Light", "Camera",
    "Performer", "Grid", "Empty", "Armature",
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
print(f"Ocean Scene Full Export (with textures + seabed)")
print(f"{'='*60}")
print(f"Selected: {len(selected)} objects")
print(f"Skipped:  {len(skipped)} non-scene objects")

if not selected:
    print("ERROR: No objects selected!")
    raise SystemExit(1)

has_seabed = any("Seabed" in n or "seabed" in n for n in selected)
print(f"Seabed included: {has_seabed}")

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
