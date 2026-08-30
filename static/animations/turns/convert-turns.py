"""Convert turn FBX files to GLB using Blender's Python API.
Run with: blender --background --python convert-turns.py
"""
import bpy
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
source_dir = os.path.normpath(os.path.join(script_dir, "..", "locomotion-pack"))

conversions = {
    "left turn 90.fbx": "turn-left-90.glb",
    "right turn 90.fbx": "turn-right-90.glb",
}

for fbx_name, glb_name in conversions.items():
    fbx_path = os.path.join(source_dir, fbx_name)
    glb_path = os.path.join(script_dir, glb_name)

    if not os.path.exists(fbx_path):
        print(f"SKIP (not found): {fbx_name}")
        continue

    print(f"Converting: {fbx_name} -> {glb_name}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
    )

    print(f"  Done: {glb_name}")

print("All turn conversions complete!")
