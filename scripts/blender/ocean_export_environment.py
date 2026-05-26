"""
Export ocean Terrain + Structures collections as a single GLB file.
Only exports objects in the Terrain and Structures collections — flora,
decorations, rocks, and formations are handled by the scene composer at runtime.

Execute via: mcp__blender__execute_blender_code (paste full content)

Output: E:\tka-platform\static\models\ocean\ocean-environment.glb
"""

import bpy
import os

OUTPUT_PATH = r"E:\tka-platform\static\models\ocean\ocean-environment.glb"
COLLECTIONS_TO_EXPORT = ["Terrain", "Structures"]


def main():
    print("=" * 60)
    print("OCEAN ENVIRONMENT EXPORT")
    print("=" * 60)

    # Deselect everything
    bpy.ops.object.select_all(action='DESELECT')

    # Select only objects in target collections
    export_count = 0
    for col_name in COLLECTIONS_TO_EXPORT:
        col = bpy.data.collections.get(col_name)
        if not col:
            print(f"WARNING: No '{col_name}' collection found, skipping.")
            continue
        for obj in col.objects:
            obj.select_set(True)
            export_count += 1
            print(f"  Selected: {obj.name} ({col_name})")

    if export_count == 0:
        print("ERROR: No objects found in Terrain or Structures collections.")
        print("Run ocean_setup.py first to create the scene.")
        return

    # Ensure output directory exists
    out_dir = os.path.dirname(OUTPUT_PATH)
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)

    # Check for meshopt compression addon
    use_meshopt = False
    try:
        if hasattr(bpy.ops.export_scene, 'gltf'):
            # meshopt is available if the gltf exporter supports it
            use_meshopt = True
    except Exception:
        pass

    # Export as GLB
    export_kwargs = {
        "filepath": OUTPUT_PATH,
        "use_selection": True,
        "export_format": "GLB",
        "export_apply": True,
        "export_texcoords": True,
        "export_normals": True,
        "export_materials": "EXPORT",
        "export_colors": True,
        "export_cameras": False,
        "export_lights": False,
        "export_extras": False,
        "export_yup": True,  # Blender Z-up -> glTF Y-up
    }

    # Enable meshopt compression if available
    if use_meshopt:
        try:
            export_kwargs["export_draco_mesh_compression_enable"] = False
            # meshopt is preferred over draco for runtime performance
        except Exception:
            pass

    bpy.ops.export_scene.gltf(**export_kwargs)

    file_size = os.path.getsize(OUTPUT_PATH) if os.path.exists(OUTPUT_PATH) else 0
    size_mb = file_size / (1024 * 1024)

    print(f"\nExported {export_count} objects to:")
    print(f"  {OUTPUT_PATH}")
    print(f"  File size: {size_mb:.2f} MB")
    print(f"  Collections: {', '.join(COLLECTIONS_TO_EXPORT)}")
    print(f"  Format: GLB (Y-up)")


main()
