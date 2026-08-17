"""Retune authored Forest canopy LOD islands in the current production blend.

This avoids regenerating terrain and ground ecology when only the registered
LOD scale changes. Blender should open ``blender/forest_environment.blend``
before running this script.
"""

import hashlib
import json
import os

import bmesh
import bpy
from mathutils import Vector


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYOUT_PATH = os.path.join(PROJECT_ROOT, "scripts", "forest-tree-layout.json")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "forest_environment.blend")
INITIAL_XY_SCALE = {
    "gnarled-spreader": 2.35,
    "slender-broadleaf": 2.05,
    "riparian-spreader": 2.3,
    "summer-understory": 2.2,
}
INITIAL_Z_SCALE = {
    "gnarled-spreader": 1.28,
    "slender-broadleaf": 1.25,
    "riparian-spreader": 1.3,
    "summer-understory": 1.3,
}


with open(LAYOUT_PATH, "rb") as layout_file:
    layout_bytes = layout_file.read()
layout = json.loads(layout_bytes.decode("utf-8"))
layout_sha256 = hashlib.sha256(layout_bytes).hexdigest()

assets = {
    asset["id"]: asset
    for asset in layout["assets"]
    if asset.get("overheadFoliageSupport")
}

for mesh in bpy.data.meshes:
    prefix = "ForestTreeMesh_"
    if not mesh.name.startswith(prefix):
        continue
    asset_id = next((asset_id for asset_id in assets if f"_{asset_id}_" in mesh.name), None)
    if not asset_id:
        continue
    support_material_indices = {
        index
        for index, material in enumerate(mesh.materials)
        if material and "_canopy_lod" in material.name.lower()
    }
    if not support_material_indices:
        # The separate near-frame copies deliberately keep the original source
        # foliage and therefore have no distance-only support primitive.
        continue

    target = assets[asset_id]["overheadFoliageSupport"]
    current_xy = float(
        mesh.get("tka_canopy_lod_xy_scale", INITIAL_XY_SCALE[asset_id])
    )
    current_z = float(
        mesh.get("tka_canopy_lod_z_scale", INITIAL_Z_SCALE[asset_id])
    )
    target_xy = float(target["xyScale"])
    target_z = float(target["zScale"])
    xy_factor = target_xy / current_xy
    z_factor = target_z / current_z
    if abs(xy_factor - 1.0) < 0.0001 and abs(z_factor - 1.0) < 0.0001:
        continue

    bm = bmesh.new()
    bm.from_mesh(mesh)
    support_faces = {
        face for face in bm.faces if face.material_index in support_material_indices
    }
    components = []
    remaining = set(support_faces)
    while remaining:
        start = remaining.pop()
        component = [start]
        stack = [start]
        while stack:
            face = stack.pop()
            for vertex in face.verts:
                for neighbor in vertex.link_faces:
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        component.append(neighbor)
                        stack.append(neighbor)
        components.append(component)

    for component in components:
        vertices = {vertex for face in component for vertex in face.verts}
        center = sum((vertex.co for vertex in vertices), Vector()) / len(vertices)
        for vertex in vertices:
            relative = vertex.co - center
            relative.x *= xy_factor
            relative.y *= xy_factor
            relative.z *= z_factor
            vertex.co = center + relative

    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh["tka_canopy_lod_xy_scale"] = target_xy
    mesh["tka_canopy_lod_z_scale"] = target_z
    print(
        f"Retuned {asset_id}: {len(components)} support islands, "
        f"xy {current_xy:.2f}->{target_xy:.2f}, z {current_z:.2f}->{target_z:.2f}"
    )

for obj in bpy.context.scene.objects:
    if obj.get("tka_role") == "terrain" or obj.get("tka_role") == "tree":
        obj["tka_tree_layout_version"] = int(layout["version"])
        obj["tka_tree_layout_sha256"] = layout_sha256

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
