"""
Export ocean flora as single GLB with baked material colors.

Pipeline:
1. For each material with a texture → sample average texture color
2. Set that average as the base color factor
3. Strip texture images (saves ~70 MB)
4. Draco compress geometry
5. Result: colored materials without heavy texture data

Run headless:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background blender/ocean_scene.blend ^
    --python scripts/blender-export-flora-scene-lean.py

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

# ── Select flora/structure objects ───────────────────────────

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

print(f"\nSelected: {len(selected)} objects, skipped: {len(skipped)}")

if not selected:
    raise SystemExit("No objects selected")

# ── Bake average texture colors into base color factors ──────

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    print("WARNING: numpy not available, using slow pixel sampling")

baked_count = 0
gray_count = 0

for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue

    bsdf = None
    for node in mat.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            bsdf = node
            break
    if not bsdf:
        continue

    base_input = bsdf.inputs.get('Base Color')
    if not base_input or not base_input.links:
        continue

    from_node = base_input.links[0].from_node
    if from_node.type != 'TEX_IMAGE' or not from_node.image:
        continue

    img = from_node.image
    if not img.pixels or len(img.pixels) < 4:
        gray_count += 1
        continue

    try:
        if HAS_NUMPY:
            pixels = np.array(img.pixels[:]).reshape(-1, 4)
            avg_r = float(pixels[:, 0].mean())
            avg_g = float(pixels[:, 1].mean())
            avg_b = float(pixels[:, 2].mean())
        else:
            raw = img.pixels[:]
            n = len(raw) // 4
            step = max(1, n // 10000)  # Sample ~10k pixels for speed
            r_sum = g_sum = b_sum = 0.0
            count = 0
            for i in range(0, n, step):
                r_sum += raw[i * 4]
                g_sum += raw[i * 4 + 1]
                b_sum += raw[i * 4 + 2]
                count += 1
            avg_r = r_sum / count
            avg_g = g_sum / count
            avg_b = b_sum / count

        bsdf.inputs['Base Color'].default_value = (avg_r, avg_g, avg_b, 1.0)
        baked_count += 1
        print(f"  {mat.name}: ({avg_r:.3f}, {avg_g:.3f}, {avg_b:.3f})")
    except Exception as e:
        gray_count += 1
        print(f"  {mat.name}: FAILED ({e})")

print(f"\nBaked {baked_count} material colors, {gray_count} remained default")

# ── Strip texture images ─────────────────────────────────────

stripped = 0
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for node in list(mat.node_tree.nodes):
        if node.type == 'TEX_IMAGE':
            mat.node_tree.nodes.remove(node)
            stripped += 1

print(f"Stripped {stripped} texture nodes")

# ── Export ────────────────────────────────────────────────────

bpy.ops.export_scene.gltf(
    filepath=output_path,
    use_selection=True,
    export_format='GLB',
    export_apply=True,
    export_yup=True,
    export_texcoords=False,
    export_normals=True,
    export_materials='EXPORT',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
)

file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"\nOutput: {output_path}")
print(f"Size:   {file_size_mb:.1f} MB")
