"""
Parameterized Blender → GLB exporter for TKA 3D scenes.

Supersedes the clone-per-scene export scripts. Two modes:

  --list                 Print every MESH object name and exit (no export).
                         Use this to discover object names before exporting.

  --include <prefix>     Whitelist: export ONLY objects whose name starts with
                         this prefix. May be passed multiple times. When omitted,
                         falls back to the default SKIP_PREFIXES blacklist (the
                         old "export everything except runtime objects" behavior).

  --output <path>        Output .glb path (relative to project root). Required
                         unless --list.

Z-up → Y-up, textures, normals, and Draco level 6 are always applied (mirrors
blender-export-ocean-full.py). Run gltf-transform afterward to optimize.

Examples:
  # discover object names
  blender --background blender/ocean_scene.blend \\
    --python scripts/blender-export-glb.py -- --list

  # export only the stage objects
  blender --background blender/ocean_scene.blend \\
    --python scripts/blender-export-glb.py -- \\
    --include Stage_ --output static/models/ocean/stage_raw.glb
"""
import bpy
import os
import sys

# ── Parse args after "--" ──────────────────────────────────────────────────
argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []

list_only = "--list" in argv
includes = []
output_rel = None

i = 0
while i < len(argv):
    if argv[i] == "--include" and i + 1 < len(argv):
        includes.append(argv[i + 1])
        i += 2
    elif argv[i] == "--output" and i + 1 < len(argv):
        output_rel = argv[i + 1]
        i += 2
    else:
        i += 1

# Default blacklist (runtime-owned objects the app provides itself).
SKIP_PREFIXES = [
    "Water", "Torch", "Light", "Camera",
    "Performer", "Grid", "Empty", "Armature",
]

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]

# ── --list mode ─────────────────────────────────────────────────────────────
if list_only:
    print(f"\n{'='*60}\nMESH objects in {bpy.data.filepath}\n{'='*60}")
    for obj in sorted(mesh_objects, key=lambda o: o.name):
        print(f"  {obj.name}")
    print(f"\nTotal: {len(mesh_objects)} mesh objects")
    raise SystemExit(0)

if not output_rel:
    print("ERROR: --output <path> is required (unless --list).")
    raise SystemExit(1)

output_path = os.path.join(project_root, output_rel.replace("/", os.sep))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

# ── Selection ───────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
selected, skipped = [], []

for obj in mesh_objects:
    name = obj.name
    if includes:
        keep = any(name.startswith(p) for p in includes)
    else:
        keep = not any(name.startswith(p) for p in SKIP_PREFIXES)
    if keep:
        obj.select_set(True)
        selected.append(name)
    else:
        skipped.append(name)

mode = f"include {includes}" if includes else f"exclude {SKIP_PREFIXES}"
print(f"\n{'='*60}\nGLB Export  ({mode})\n{'='*60}")
print(f"Selected: {len(selected)}  |  Skipped: {len(skipped)}")
for n in selected:
    print(f"  + {n}")

if not selected:
    print("ERROR: No objects matched the selection.")
    raise SystemExit(1)

# ── Export ──────────────────────────────────────────────────────────────────
export_kwargs = dict(
    filepath=output_path,
    use_selection=True,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
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
