"""Batch convert FBX files to GLB using Blender's Python API.
Run with: blender --background --python convert.py
"""
import bpy
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))

fbx_files = [f for f in os.listdir(script_dir) if f.endswith('.fbx')]

for fbx_name in fbx_files:
    fbx_path = os.path.join(script_dir, fbx_name)
    glb_name = fbx_name.replace('.fbx', '.glb')
    glb_path = os.path.join(script_dir, glb_name)

    print(f"Converting: {fbx_name} -> {glb_name}")

    # Clear scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import FBX
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    # Export as GLB
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
    )

    print(f"  Done: {glb_name}")

print("All conversions complete!")
