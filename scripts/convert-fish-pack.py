"""
Fish Pack FBX -> GLB Converter with Vertex Color Baking

Usage:
  blender --background --python scripts/convert-fish-pack.py -- <input_dir> <output_dir>

Processes all FBX files in input_dir:
1. Import FBX
2. Strip armatures/bones, join all meshes
3. Normalize to unit bounding box, center origin
4. Bake vertex colors (R=spine gradient, G=pectoral mask, B=dorsal/caudal mask)
5. Export GLB with embedded textures + Draco compression
"""

import bpy
import bmesh
import re
import sys
from pathlib import Path
from mathutils import Vector


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in [bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                       bpy.data.textures, bpy.data.images]:
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def import_fbx(filepath):
    print(f"  Importing: {filepath}")
    bpy.ops.import_scene.fbx(
        filepath=filepath,
        use_anim=False,
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
    )


def strip_armatures():
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'ARMATURE':
            bpy.data.objects.remove(obj, do_unlink=True)


def join_all_meshes():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if len(meshes) == 0:
        return None
    if len(meshes) == 1:
        return meshes[0]

    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    return bpy.context.active_object


def normalize_and_center(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bbox = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    min_co = Vector((min(v.x for v in bbox), min(v.y for v in bbox), min(v.z for v in bbox)))
    max_co = Vector((max(v.x for v in bbox), max(v.y for v in bbox), max(v.z for v in bbox)))
    size = max_co - min_co
    max_dim = max(size.x, size.y, size.z)

    if max_dim > 0.001:
        scale_factor = 1.0 / max_dim
        obj.scale = (scale_factor, scale_factor, scale_factor)
        bpy.ops.object.transform_apply(scale=True)

    bbox = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    center = sum((Vector(v) for v in bbox), Vector()) / 8
    obj.location = -center
    bpy.ops.object.transform_apply(location=True)


def bake_vertex_colors(obj):
    mesh = obj.data

    if mesh.color_attributes:
        for attr in list(mesh.color_attributes):
            mesh.color_attributes.remove(attr)
    mesh.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()

    color_layer = bm.loops.layers.color.active
    if not color_layer:
        color_layer = bm.loops.layers.color.new("Col")

    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    body_width = max_x - min_x
    body_height = max_y - min_y
    body_length = max_z - min_z

    for face in bm.faces:
        for loop in face.loops:
            v = loop.vert.co

            # Red: spine gradient (0 at head/min_z, 1 at tail/max_z)
            r = (v.z - min_z) / body_length if body_length > 0.001 else 0.0

            # Green: pectoral fin mask — lateral protrusions in mid-body
            lateral_extent = abs(v.x) / (body_width * 0.5) if body_width > 0.001 else 0.0
            y_norm = (v.y - min_y) / body_height if body_height > 0.001 else 0.5
            z_norm = (v.z - min_z) / body_length if body_length > 0.001 else 0.0
            is_pectoral = lateral_extent > 0.4 and 0.3 < y_norm < 0.7 and 0.2 < z_norm < 0.5
            g = 1.0 if is_pectoral else 0.0

            # Blue: dorsal (top ridge) + caudal (tail) fin mask
            is_caudal = z_norm > 0.7
            is_dorsal = y_norm > 0.75 and 0.2 < z_norm < 0.7
            b = 1.0 if (is_caudal or is_dorsal) else 0.0

            loop[color_layer] = (r, g, b, 1.0)

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def export_glb(obj, output_path):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_vertex_color='ACTIVE',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format='AUTO',
    )


def pascal_to_snake(name):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


def process_fish(fbx_path, output_dir):
    clear_scene()
    import_fbx(str(fbx_path))
    strip_armatures()

    obj = join_all_meshes()
    if not obj:
        print(f"  WARNING: No mesh found in {fbx_path.name}, skipping")
        return False

    normalize_and_center(obj)
    bake_vertex_colors(obj)

    snake = pascal_to_snake(fbx_path.stem)
    output_path = Path(output_dir) / f"{snake}.glb"
    export_glb(obj, output_path)
    print(f"  Exported: {output_path.name}")
    return True


def main():
    argv = sys.argv
    separator_idx = argv.index('--') if '--' in argv else -1
    if separator_idx < 0 or len(argv) < separator_idx + 3:
        print("Usage: blender --background --python convert-fish-pack.py -- <input_dir> <output_dir>")
        sys.exit(1)

    input_dir = Path(argv[separator_idx + 1])
    output_dir = Path(argv[separator_idx + 2])

    if not input_dir.is_dir():
        print(f"Input directory not found: {input_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    fbx_files = sorted(input_dir.glob("*.fbx"))
    print(f"Found {len(fbx_files)} FBX files\n")

    success = 0
    failed = []
    for i, fbx in enumerate(fbx_files, 1):
        print(f"[{i}/{len(fbx_files)}] {fbx.stem}")
        try:
            if process_fish(fbx, output_dir):
                success += 1
            else:
                failed.append(fbx.stem)
        except Exception as e:
            print(f"  ERROR: {e}")
            failed.append(fbx.stem)

    print(f"\nDone: {success}/{len(fbx_files)} converted successfully")
    if failed:
        print(f"Failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
