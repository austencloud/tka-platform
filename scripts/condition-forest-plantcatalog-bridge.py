"""Condition PlantFactory FBX exports into semantic Forest tree GLBs.

Run with Blender in background mode after the in-app PlantFactory export gate.
The script preserves the PlantCatalog geometry, normalizes scene scale and
origin, restores foliage alpha, and authors a reusable rooted-wind vertex mask.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "scripts" / "forest-plantcatalog-bridge.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
STATE_PATH = ROOT / MANIFEST["paths"]["statePath"]
EVIDENCE_ROOT = ROOT / MANIFEST["paths"]["evidenceRoot"]
CONDITIONED_ROOT = ROOT / MANIFEST["paths"]["conditionedRoot"]

FOLIAGE_TOKENS = (
    "leaf",
    "leaves",
    "foliage",
    "needle",
    "twig",
    "frond",
    "blade",
)
WOOD_TOKENS = (
    "bark",
    "branch",
    "trunk",
    "wood",
    "stem",
    "root",
    "cap",
)
NON_COLOR_TOKENS = (
    "alpha",
    "opacity",
    "normal",
    "bump",
    "rough",
    "metal",
    "ambient",
    "occlusion",
    "height",
    "displacement",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", action="append", default=[])
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(arguments)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.curves,
    ):
        for block in list(datablocks):
            datablocks.remove(block)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mesh_objects(objects) -> list[bpy.types.Object]:
    converted = []
    for obj in objects:
        if obj.type == "MESH":
            converted.append(obj)
        elif obj.type in {"CURVE", "SURFACE", "FONT"}:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.convert(target="MESH")
            converted.append(bpy.context.object)
    return converted


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("PlantFactory FBX contains no mesh geometry")
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def join_meshes(objects: list[bpy.types.Object]) -> bpy.types.Object:
    meshes = mesh_objects(objects)
    if not meshes:
        raise RuntimeError("PlantFactory FBX contains no convertible mesh objects")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    return bpy.context.object


def image_nodes(material: bpy.types.Material) -> list[bpy.types.ShaderNodeTexImage]:
    if not material.use_nodes or material.node_tree is None:
        return []
    return [
        node
        for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image is not None
    ]


def sampled_alpha_range(image: bpy.types.Image) -> tuple[float, float] | None:
    if image.channels < 4 or image.size[0] <= 0 or image.size[1] <= 0:
        return None
    try:
        pixels = image.pixels
        pixel_count = image.size[0] * image.size[1]
        step = max(1, pixel_count // 4096)
        sampled = [pixels[index * 4 + 3] for index in range(0, pixel_count, step)]
        if not sampled:
            return None
        return min(sampled), max(sampled)
    except Exception:
        return None


def material_search_text(material: bpy.types.Material) -> str:
    parts = [material.name]
    for node in image_nodes(material):
        parts.extend((node.name, node.label, node.image.name, node.image.filepath))
    return " ".join(parts).lower()


def classify_material(material: bpy.types.Material) -> tuple[str, str]:
    search_text = material_search_text(material)
    if any(token in search_text for token in FOLIAGE_TOKENS):
        return "foliage", "name-or-texture-token"
    if any(token in search_text for token in WOOD_TOKENS):
        return "wood", "name-or-texture-token"
    for node in image_nodes(material):
        alpha_range = sampled_alpha_range(node.image)
        if alpha_range is not None and alpha_range[0] < 0.95 and alpha_range[1] > 0.05:
            return "foliage", "sampled-cutout-alpha"
    return "wood", "opaque-fallback"


def principled_input(bsdf: bpy.types.ShaderNodeBsdfPrincipled, *names: str):
    for name in names:
        value = bsdf.inputs.get(name)
        if value is not None:
            return value
    return None


def linked_image_node(shader_input):
    if shader_input is None or not shader_input.is_linked:
        return None
    source = shader_input.links[0].from_node
    return source if source.type == "TEX_IMAGE" and source.image is not None else None


def choose_base_color_node(material: bpy.types.Material, bsdf):
    linked = linked_image_node(principled_input(bsdf, "Base Color"))
    if linked is not None:
        return linked
    candidates = []
    for node in image_nodes(material):
        lowered = " ".join((node.name, node.label, node.image.name, node.image.filepath)).lower()
        if not any(token in lowered for token in NON_COLOR_TOKENS):
            candidates.append(node)
    return candidates[0] if candidates else None


def choose_alpha_node(material: bpy.types.Material, base_color_node):
    if base_color_node is not None:
        alpha_range = sampled_alpha_range(base_color_node.image)
        if alpha_range is not None and alpha_range[0] < 0.95:
            return base_color_node, "Alpha"
    for node in image_nodes(material):
        lowered = " ".join((node.name, node.label, node.image.name, node.image.filepath)).lower()
        if "alpha" in lowered or "opacity" in lowered:
            return node, "Color"
    return None, None


def configure_material(material: bpy.types.Material, job_id: str, index: int) -> dict:
    role, classification = classify_material(material)
    original_name = material.name
    material.name = "ForestPlantCatalog_{}_{}_{}".format(
        re.sub(r"[^a-zA-Z0-9]+", "_", job_id).strip("_"),
        "Foliage" if role == "foliage" else "Wood",
        str(index + 1).zfill(2),
    )
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        raise RuntimeError("Material has no Principled BSDF: {}".format(original_name))

    metallic = principled_input(bsdf, "Metallic")
    roughness = principled_input(bsdf, "Roughness")
    alpha = principled_input(bsdf, "Alpha")
    if metallic is not None:
        metallic.default_value = 0.0
    if roughness is not None:
        roughness.default_value = float(
            MANIFEST["conditioning"]["foliageRoughness"]
            if role == "foliage"
            else MANIFEST["conditioning"]["woodRoughness"]
        )
    for emission_name in ("Emission Color", "Emission"):
        emission = principled_input(bsdf, emission_name)
        if emission is not None and not emission.is_linked:
            emission.default_value = (0.0, 0.0, 0.0, 1.0)
    emission_strength = principled_input(bsdf, "Emission Strength")
    if emission_strength is not None:
        emission_strength.default_value = 0.0

    base_color_node = choose_base_color_node(material, bsdf)
    if base_color_node is None:
        raise RuntimeError("Material has no base-color texture: {}".format(original_name))
    base_color_node.image.name = material.name + "_BaseColor"
    if not principled_input(bsdf, "Base Color").is_linked:
        material.node_tree.links.new(
            base_color_node.outputs["Color"], principled_input(bsdf, "Base Color")
        )

    alpha_source = None
    if role == "foliage":
        alpha_node, alpha_socket = choose_alpha_node(material, base_color_node)
        if alpha_node is None or alpha is None:
            raise RuntimeError("Foliage material has no usable alpha: {}".format(original_name))
        material.node_tree.links.new(alpha_node.outputs[alpha_socket], alpha)
        alpha_source = alpha_node.image.name
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        if hasattr(material, "use_transparency_overlap"):
            material.use_transparency_overlap = False
        material.use_backface_culling = False
    else:
        if alpha is not None:
            alpha.default_value = 1.0
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        material.use_backface_culling = True

    return {
        "originalName": original_name,
        "name": material.name,
        "role": role,
        "classification": classification,
        "baseColorTexture": base_color_node.image.name,
        "alphaTexture": alpha_source,
    }


def normalize_tree(tree: bpy.types.Object, target_height: float) -> tuple[Vector, Vector]:
    minimum, maximum = world_bounds([tree])
    height = maximum.z - minimum.z
    if height <= 0:
        raise RuntimeError("PlantFactory tree has zero height")
    uniform_scale = target_height / height
    tree.scale = tuple(component * uniform_scale for component in tree.scale)
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


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 0.0
    normalized = min(1.0, max(0.0, (value - edge0) / (edge1 - edge0)))
    return normalized * normalized * (3.0 - 2.0 * normalized)


def author_rooted_wind_mask(tree: bpy.types.Object, height: float) -> dict:
    mesh = tree.data
    existing = mesh.color_attributes.get("COLOR_0")
    if existing is not None:
        mesh.color_attributes.remove(existing)
    attribute = mesh.color_attributes.new(name="COLOR_0", type="FLOAT_COLOR", domain="POINT")
    foliage_material_indices = {
        index
        for index, material in enumerate(mesh.materials)
        if material is not None and "_Foliage_" in material.name
    }
    foliage_vertices = set()
    for polygon in mesh.polygons:
        if polygon.material_index in foliage_material_indices:
            foliage_vertices.update(polygon.vertices)
    for vertex in mesh.vertices:
        rooted = smoothstep(0.03, 0.72, vertex.co.z / max(height, 0.001))
        phase = 0.5 + 0.5 * math.sin(vertex.co.x * 0.71 + vertex.co.y * 1.13)
        flutter = 1.0 if vertex.index in foliage_vertices else 0.18
        attribute.data[vertex.index].color = (rooted, phase, flutter, 1.0)
    mesh.color_attributes.active_color = attribute
    return {
        "attribute": attribute.name,
        "rootedChannel": "R",
        "phaseChannel": "G",
        "leafFlutterChannel": "B",
        "foliageVertices": len(foliage_vertices),
        "totalVertices": len(mesh.vertices),
    }


def export_glb(tree: bpy.types.Object, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    tree.select_set(True)
    bpy.context.view_layer.objects.active = tree
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_extras=True,
        export_attributes=True,
    )


def condition_job(job: dict, export_state: dict) -> dict:
    job_state = export_state["jobs"].get(job["id"])
    if not job_state or job_state.get("status") != "complete":
        raise RuntimeError("PlantFactory job is not complete: {}".format(job["id"]))
    source_fbx = Path(job_state["outputFbx"])
    if not source_fbx.exists():
        raise FileNotFoundError("PlantFactory FBX missing: {}".format(source_fbx))

    reset_scene()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(
        filepath=str(source_fbx),
        use_image_search=True,
        automatic_bone_orientation=True,
    )
    imported = [obj for obj in bpy.data.objects if obj not in before]
    tree = join_meshes(imported)
    tree.name = "ForestPlantCatalog_{}".format(job["id"])
    tree.data.name = tree.name + "_Mesh"
    tree["tka_role"] = "forest-tree-candidate"
    tree["tka_source_family"] = "PlantCatalog"
    tree["tka_species"] = job["species"]
    tree["tka_seed"] = int(job["seed"])
    tree["tka_source_sha256"] = job["sourceSha256"]
    tree["tka_license_reference"] = MANIFEST["source"]["licenseReference"]

    material_metrics = []
    for index, material in enumerate(tree.data.materials):
        if material is not None:
            material_metrics.append(configure_material(material, job["id"], index))
    roles = {material["role"] for material in material_metrics}
    if "wood" not in roles or "foliage" not in roles:
        raise RuntimeError(
            "PlantCatalog semantic classification requires wood and foliage; got {}".format(
                sorted(roles)
            )
        )
    for polygon in tree.data.polygons:
        polygon.use_smooth = True

    minimum, maximum = normalize_tree(tree, float(job["targetHeightMetres"]))
    dimensions = maximum - minimum
    wind_mask = author_rooted_wind_mask(tree, dimensions.z)
    output = CONDITIONED_ROOT / (job["id"] + "-review.glb")
    export_glb(tree, output)

    triangles = sum(max(0, len(polygon.vertices) - 2) for polygon in tree.data.polygons)
    return {
        "id": job["id"],
        "species": job["species"],
        "sourceFbx": str(source_fbx),
        "sourceFbxSha256": sha256(source_fbx),
        "reviewGlb": output.relative_to(ROOT).as_posix(),
        "reviewGlbSha256": sha256(output),
        "reviewGlbBytes": output.stat().st_size,
        "meshObjects": 1,
        "vertices": len(tree.data.vertices),
        "triangles": triangles,
        "materials": material_metrics,
        "minimumMetres": list(minimum),
        "maximumMetres": list(maximum),
        "dimensionsMetres": list(dimensions),
        "windMask": wind_mask,
    }


args = parse_args()
if not STATE_PATH.exists():
    raise FileNotFoundError("PlantFactory state missing: {}".format(STATE_PATH))
state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
jobs_by_id = {job["id"]: job for job in MANIFEST["jobs"]}
selected_ids = args.job or MANIFEST["exportSets"][MANIFEST["activeExportSet"]]
unknown = [job_id for job_id in selected_ids if job_id not in jobs_by_id]
if unknown:
    raise RuntimeError("Unknown PlantCatalog job IDs: {}".format(unknown))
metrics = [condition_job(jobs_by_id[job_id], state) for job_id in selected_ids]
EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
metrics_path = EVIDENCE_ROOT / "plantcatalog-conditioning-metrics.json"
metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metrics, indent=2))
