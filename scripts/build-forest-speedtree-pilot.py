"""Build the isolated SpeedTree White Oak evaluation candidate.

The ORCA source is noncommercial. This script deliberately writes only to the
evaluation-only candidate folder and never touches the production Forest tree.
"""

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "scripts" / "forest-speedtree-pilot.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
TARGET_HEIGHT = float(MANIFEST["candidate"]["targetHeightMetres"])


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        default=Path(MANIFEST["source"]["defaultSourceRoot"]),
    )
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(arguments)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            datablocks.remove(block)


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def world_bounds(objects):
    points = []
    for obj in mesh_objects(objects):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("SpeedTree source contains no mesh geometry")
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def join_meshes(objects):
    meshes = mesh_objects(objects)
    if len(meshes) == 1:
        return meshes[0]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    return bpy.context.object


def normalize_tree(tree):
    minimum, maximum = world_bounds([tree])
    height = maximum.z - minimum.z
    if height <= 0:
        raise RuntimeError("SpeedTree source has zero height")
    scale = TARGET_HEIGHT / height
    tree.scale = tuple(component * scale for component in tree.scale)
    bpy.context.view_layer.update()
    minimum, maximum = world_bounds([tree])
    tree.location.x -= (minimum.x + maximum.x) * 0.5
    tree.location.y -= (minimum.y + maximum.y) * 0.5
    tree.location.z -= minimum.z
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    tree.select_set(True)
    bpy.context.view_layer.objects.active = tree
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.view_layer.update()
    return world_bounds([tree])


def semantic_material_name(source_name):
    lowered = source_name.lower()
    if "leaves" in lowered and "hero_1" in lowered:
        return "ForestOak_Foliage_Outer"
    if "leaves" in lowered:
        return "ForestOak_Foliage_Inner"
    if "cap" in lowered:
        return "ForestOak_CutWood"
    if "bark" in lowered:
        return "ForestOak_Bark"
    raise RuntimeError(f"Unclassified SpeedTree material: {source_name}")


def configure_material(material):
    semantic_name = semantic_material_name(material.name)
    material.name = semantic_name
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        raise RuntimeError(f"{semantic_name} has no Principled BSDF")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.84 if "Foliage" in semantic_name else 0.92

    if "Foliage" in semantic_name:
        base_color = bsdf.inputs["Base Color"]
        source_node = base_color.links[0].from_node if base_color.is_linked else None
        if source_node is None or source_node.type != "TEX_IMAGE":
            raise RuntimeError(f"{semantic_name} has no diffuse image node")
        alpha_output = source_node.outputs.get("Alpha")
        if alpha_output is None:
            raise RuntimeError(f"{semantic_name} diffuse texture has no alpha output")
        material.node_tree.links.new(alpha_output, bsdf.inputs["Alpha"])
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        material.use_backface_culling = False
    else:
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        bsdf.inputs["Alpha"].default_value = 1.0
        material.use_backface_culling = True


def export_candidate(tree, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    tree.select_set(True)
    bpy.context.view_layer.objects.active = tree
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_extras=True,
    )


args = parse_args()
source_obj = args.source_root / MANIFEST["source"]["objectFile"]
if not source_obj.exists():
    raise FileNotFoundError(f"SpeedTree evaluation source missing: {source_obj}")

reset_scene()
before = set(bpy.data.objects)
bpy.ops.wm.obj_import(filepath=str(source_obj), forward_axis="NEGATIVE_Z", up_axis="Y")
imported = [obj for obj in bpy.data.objects if obj not in before]
tree = join_meshes(imported)
tree.name = "ForestOak_SpeedTree_ORCA_Evaluation"
tree.data.name = "ForestOak_SpeedTree_ORCA_Evaluation_Mesh"
tree["tka_role"] = "forest-tree-candidate"
tree["tka_source"] = MANIFEST["source"]["label"]
tree["tka_license"] = MANIFEST["source"]["license"]

for material in tree.data.materials:
    if material is not None:
        configure_material(material)
for polygon in tree.data.polygons:
    polygon.use_smooth = True

minimum, maximum = normalize_tree(tree)
raw_path = ROOT / MANIFEST["candidate"]["rawPath"]
review_path = ROOT / MANIFEST["candidate"]["reviewPath"]
export_candidate(tree, raw_path)
export_candidate(tree, review_path)

triangles = sum(len(polygon.vertices) - 2 for polygon in tree.data.polygons)
metrics = {
    "sourceObject": str(source_obj),
    "sourceLicense": MANIFEST["source"]["license"],
    "productionEligible": MANIFEST["source"]["commercialUseAllowed"],
    "meshObjects": 1,
    "vertices": len(tree.data.vertices),
    "triangles": triangles,
    "materials": [material.name for material in tree.data.materials if material],
    "minimum": list(minimum),
    "maximum": list(maximum),
    "dimensionsMetres": list(maximum - minimum),
}
evidence_dir = ROOT / MANIFEST["evidenceDirectory"]
evidence_dir.mkdir(parents=True, exist_ok=True)
(evidence_dir / "speedtree-pilot-build-metrics.json").write_text(
    json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(metrics, indent=2))
