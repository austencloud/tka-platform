"""Render the Forest Gate 4 tree candidates at one measured scale.

The lineup is an offline review artifact only. It imports each candidate from
the versioned lineup contract, normalizes it to the same twelve-metre height,
renders three fixed angles, records geometry metrics, and removes it before the
next candidate. No candidate is placed in the Forest environment.
"""

import argparse
import json
import hashlib
import math
import os
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent


def script_arguments():
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        default="scripts/forest-tree-lineup.json",
    )
    return parser.parse_args(arguments)


ARGS = script_arguments()
MANIFEST_PATH = (ROOT / ARGS.manifest).resolve()

CONTRACT_BYTES = MANIFEST_PATH.read_bytes()
CONTRACT = json.loads(CONTRACT_BYTES)

BLEND_PATH = (ROOT / CONTRACT.get("blendPath", "blender/forest_tree_lineup.blend")).resolve()
EVIDENCE_DIR = (
    (ROOT / CONTRACT["evidenceDirectory"]).resolve()
    if CONTRACT.get("evidenceDirectory")
    else Path(tempfile.gettempdir()) / "tka-forest-evidence" / "tree-lineup"
)
METRICS_PATH = EVIDENCE_DIR / "forest_tree_lineup_metrics.json"

REVIEW_FRAME_HEIGHT = float(
    CONTRACT.get(
        "reviewFrameHeightMetres",
        CONTRACT.get("targetHeightMetres", 18.0),
    )
)
ANGLES = tuple(float(angle) for angle in CONTRACT["reviewAnglesDegrees"])
VIEW_NAMES = ("front", "three-quarter", "silhouette")


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def make_material(name, color, roughness=0.8):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def add_area_light(name, location, energy, size, color):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light_data.color = color
    light = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, (0.0, 0.0, REVIEW_FRAME_HEIGHT * 0.42))
    return light


def add_scale_reference(material):
    parts = []

    reference_x = -REVIEW_FRAME_HEIGHT * 0.38
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.17, depth=1.05, location=(reference_x, 0.0, 0.525))
    torso = bpy.context.object
    torso.name = "Scale_Reference_Torso"
    torso.data.materials.append(material)
    parts.append(torso)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.19, location=(reference_x, 0.0, 1.64))
    head = bpy.context.object
    head.name = "Scale_Reference_Head"
    head.data.materials.append(material)
    parts.append(head)

    for x in (reference_x - 0.12, reference_x + 0.12):
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.065, depth=0.7, location=(x, 0.0, 0.35))
        leg = bpy.context.object
        leg.data.materials.append(material)
        parts.append(leg)

    return parts


def setup_review_stage():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 840
    scene.render.resolution_y = 840
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"

    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.55

    world = bpy.data.worlds.new("Forest Tree Review World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.22, 0.37, 0.5, 1.0)
    background.inputs["Strength"].default_value = 0.62
    scene.world = world

    ground_material = make_material("Review Ground", (0.2, 0.25, 0.16), 0.96)
    reference_material = make_material("Human Scale Reference", (0.9, 0.72, 0.44), 0.78)
    silhouette_material = make_material("Tree Silhouette", (0.008, 0.012, 0.010), 0.92)
    silhouette_material.use_fake_user = True

    bpy.ops.mesh.primitive_plane_add(size=REVIEW_FRAME_HEIGHT * 3.0, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "Review Ground"
    ground.data.materials.append(ground_material)

    metre_extent = math.ceil(REVIEW_FRAME_HEIGHT * 0.48)
    for metre in range(-metre_extent, metre_extent + 1):
        if metre == 0:
            continue
        bpy.ops.mesh.primitive_cube_add(location=(metre, 0.55, 0.006), scale=(0.012, 0.34, 0.012))
        tick = bpy.context.object
        tick.name = f"Metre_Tick_{metre:+d}"
        tick.data.materials.append(reference_material)

    add_scale_reference(reference_material)

    camera_data = bpy.data.cameras.new("Tree Lineup Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = REVIEW_FRAME_HEIGHT
    camera = bpy.data.objects.new("Tree Lineup Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0.0, -REVIEW_FRAME_HEIGHT * 1.5, REVIEW_FRAME_HEIGHT * 0.47)
    aim_at(camera, (0.0, 0.0, REVIEW_FRAME_HEIGHT * 0.47))
    scene.camera = camera

    add_area_light("Review Key", (-8.0, -10.0, 14.0), 3100, 8.0, (1.0, 0.94, 0.84))
    add_area_light("Review Fill", (9.0, -2.0, 9.0), 1900, 7.0, (0.68, 0.82, 1.0))
    add_area_light("Review Rim", (2.0, 9.0, 12.0), 2300, 6.0, (0.76, 0.9, 1.0))

    return scene, silhouette_material


def imported_objects(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    created = [obj for obj in bpy.data.objects if obj not in before]
    if not created:
        raise RuntimeError(f"Import created no objects: {path}")
    return created


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def object_bounds(objects):
    corners = []
    for obj in mesh_objects(objects):
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not corners:
        raise RuntimeError("Candidate contains no mesh geometry")
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    return minimum, maximum


def normalize_candidate(objects, candidate):
    candidate_id = candidate["id"]
    root = bpy.data.objects.new(f"{candidate_id}_Review_Root", None)
    bpy.context.scene.collection.objects.link(root)
    object_set = set(objects)
    for obj in objects:
        if obj.parent not in object_set:
            world_matrix = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world_matrix

    minimum, maximum = object_bounds(objects)
    dimensions = maximum - minimum
    if dimensions.z <= 0.001:
        raise RuntimeError(f"Candidate {candidate_id} has zero height")

    target_height = float(
        candidate.get(
            "targetHeightMetres",
            CONTRACT.get("targetHeightMetres", dimensions.z),
        )
    )
    scale = target_height / dimensions.z
    root.scale = (scale, scale, scale)
    root.location = (
        -((minimum.x + maximum.x) * 0.5) * scale,
        -((minimum.y + maximum.y) * 0.5) * scale,
        -minimum.z * scale,
    )
    bpy.context.view_layer.update()
    return root, minimum, maximum, dimensions, scale, target_height


def source_files(path):
    paths = {path}
    if path.suffix.lower() != ".gltf":
        return paths

    document = json.loads(path.read_text(encoding="utf-8"))
    for entry in (*document.get("buffers", []), *document.get("images", [])):
        uri = entry.get("uri")
        if uri and not uri.startswith("data:"):
            paths.add((path.parent / uri).resolve())
    return paths


def candidate_metrics(candidate, path, objects, dimensions, scale, target_height):
    meshes = mesh_objects(objects)
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    triangles = 0
    materials = set()
    images = set()
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        for material in obj.data.materials:
            if material is None:
                continue
            materials.add(material.name)
            if material.use_nodes:
                for node in material.node_tree.nodes:
                    image = getattr(node, "image", None)
                    if image is not None:
                        images.add(image.name)

    source_paths = source_files(path)
    source_bytes = sum(source_path.stat().st_size for source_path in source_paths if source_path.is_file())

    metrics = {
        "id": candidate["id"],
        "label": candidate["label"],
        "family": candidate["family"],
        "roles": candidate["roles"],
        "sourcePath": str(path),
        "sourceBytes": source_bytes,
        "meshCount": len(meshes),
        "vertices": vertices,
        "triangles": triangles,
        "materials": len(materials),
        "materialNames": sorted(materials),
        "images": len(images),
        "sourceDimensionsMetres": [dimensions.x, dimensions.y, dimensions.z],
        "reviewScale": scale,
        "reviewHeightMetres": target_height,
    }
    runtime_path_value = candidate.get("source", {}).get("runtimePath")
    if runtime_path_value:
        runtime_path = (ROOT / runtime_path_value).resolve()
        if not runtime_path.is_file():
            raise FileNotFoundError(f"Missing runtime candidate: {runtime_path}")
        metrics["runtimePath"] = str(runtime_path)
        metrics["runtimeBytes"] = runtime_path.stat().st_size
    return metrics


def set_silhouette_material(objects, silhouette_material):
    originals = []
    for obj in mesh_objects(objects):
        slots = list(obj.data.materials)
        originals.append((obj, slots))
        obj.data.materials.clear()
        obj.data.materials.append(silhouette_material)
    return originals


def restore_materials(originals):
    for obj, materials in originals:
        obj.data.materials.clear()
        for material in materials:
            obj.data.materials.append(material)


def render_candidate(scene, candidate, path, silhouette_material):
    objects = imported_objects(path)
    root, _minimum, _maximum, dimensions, scale, target_height = normalize_candidate(objects, candidate)
    metrics = candidate_metrics(candidate, path, objects, dimensions, scale, target_height)

    for index, (view_name, angle) in enumerate(zip(VIEW_NAMES, ANGLES)):
        root.rotation_euler.z = math.radians(angle)
        bpy.context.view_layer.update()
        originals = None
        if view_name == "silhouette":
            originals = set_silhouette_material(objects, silhouette_material)

        output_path = EVIDENCE_DIR / f"forest_tree_{candidate['id'].lower()}_{view_name}.png"
        scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
        metrics.setdefault("renders", {})[view_name] = str(output_path)

        if originals is not None:
            restore_materials(originals)

    bpy.data.objects.remove(root, do_unlink=True)
    for obj in objects:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    return metrics


def resolve_candidate_path(candidate):
    path = ROOT / candidate["source"]["localPath"]
    if not path.is_file():
        raise FileNotFoundError(f"Missing Gate 4 candidate source: {path}")
    return path


EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
reset_scene()
scene, silhouette_material = setup_review_stage()

results = []
for candidate in CONTRACT["candidates"]:
    source_path = resolve_candidate_path(candidate)
    print(f"Rendering {candidate['id']}: {candidate['label']}")
    results.append(render_candidate(scene, candidate, source_path, silhouette_material))

payload = {
    "contractVersion": CONTRACT["version"],
    "contractSha256": hashlib.sha256(CONTRACT_BYTES).hexdigest(),
    "reviewFrameHeightMetres": REVIEW_FRAME_HEIGHT,
    "reviewAnglesDegrees": ANGLES,
    "candidates": results,
}
with METRICS_PATH.open("w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
    handle.write("\n")

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

print("\nForest Gate 4 tree lineup rendered")
print(f"Candidates: {len(results)}")
print(f"Review frame: {REVIEW_FRAME_HEIGHT:.1f} m")
print(f"Metrics: {METRICS_PATH}")
