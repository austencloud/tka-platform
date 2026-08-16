"""Render fixed neutral qualification views for PlantCatalog bridge candidates."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads(
    (ROOT / "scripts" / "forest-plantcatalog-bridge.json").read_text(encoding="utf-8")
)
EVIDENCE_ROOT = ROOT / MANIFEST["paths"]["evidenceRoot"]


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for block in list(datablocks):
            datablocks.remove(block)


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.95):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    return result


def aim_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name: str, location: tuple, energy: float, size: float, color: tuple, target: Vector):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)
    return light


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def bounds(objects) -> tuple[Vector, Vector]:
    points = []
    for obj in mesh_objects(objects):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("Candidate contains no mesh geometry")
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def replace_materials(objects, replacement):
    originals = []
    for obj in mesh_objects(objects):
        originals.append((obj, list(obj.data.materials)))
        obj.data.materials.clear()
        obj.data.materials.append(replacement)
    return originals


def restore_materials(originals) -> None:
    for obj, source_materials in originals:
        obj.data.materials.clear()
        for source in source_materials:
            obj.data.materials.append(source)


def setup_scene(width: float, height: float):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.color_depth = "8"
    world = bpy.data.worlds.new("PlantCatalog Qualification World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.075, 0.07, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.24
    scene.world = world

    ground = material("PlantCatalog Neutral Ground", (0.13, 0.17, 0.12, 1.0), 0.98)
    bpy.ops.mesh.primitive_plane_add(size=max(width, height) * 4.0, location=(0, 0, -0.015))
    bpy.context.object.data.materials.append(ground)

    camera_data = bpy.data.cameras.new("PlantCatalog Qualification Camera")
    camera = bpy.data.objects.new("PlantCatalog Qualification Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    target = Vector((0.0, 0.0, height * 0.46))
    add_area_light("Key", (-width * 0.9, -height * 0.55, height * 1.05), 1650, height * 0.58, (1.0, 0.87, 0.69), target)
    add_area_light("Fill", (width * 0.85, -height * 0.25, height * 0.52), 620, height * 0.7, (0.55, 0.72, 1.0), target)
    add_area_light("Rim", (0.0, height * 0.65, height * 0.78), 980, height * 0.48, (0.75, 0.9, 1.0), target)
    return scene, camera


def render(scene, camera, root, output: Path, rotation: float, location: tuple, target: tuple, lens: float = 52.0):
    root.rotation_euler[2] = math.radians(rotation)
    camera.data.type = "PERSP"
    camera.data.lens = lens
    camera.location = location
    aim_at(camera, Vector(target))
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def render_job(job: dict) -> dict:
    clear_scene()
    candidate_path = ROOT / MANIFEST["paths"]["candidateRoot"] / job["candidateFilename"]
    if not candidate_path.exists():
        raise FileNotFoundError("Optimized PlantCatalog candidate missing: {}".format(candidate_path))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(candidate_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = mesh_objects(imported)
    minimum, maximum = bounds(meshes)
    dimensions = maximum - minimum
    height = dimensions.z
    width = max(dimensions.x, dimensions.y)
    root = bpy.data.objects.new("PlantCatalog_Render_Root", None)
    bpy.context.scene.collection.objects.link(root)
    for obj in imported:
        if obj.parent is None:
            obj.parent = root
    scene, camera = setup_scene(width, height)
    prefix = EVIDENCE_ROOT / job["id"]
    EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
    distance = max(width * 1.55, height * 1.35)
    target = (0.0, 0.0, height * 0.48)
    render(scene, camera, root, prefix.with_name(prefix.name + "-front.png"), 0, (0, -distance, height * 0.48), target, 56)
    render(scene, camera, root, prefix.with_name(prefix.name + "-three-quarter.png"), 35, (0, -distance, height * 0.52), target, 56)
    silhouette = material("PlantCatalog Silhouette", (0.003, 0.005, 0.003, 1.0), 0.99)
    originals = replace_materials(meshes, silhouette)
    render(scene, camera, root, prefix.with_name(prefix.name + "-silhouette.png"), 73, (0, -distance, height * 0.5), target, 58)
    restore_materials(originals)
    render(scene, camera, root, prefix.with_name(prefix.name + "-human-height.png"), 24, (width * 0.45, -width * 0.85, 1.7), (0, 0, min(4.6, height * 0.3)), 48)
    render(scene, camera, root, prefix.with_name(prefix.name + "-bark-close.png"), 12, (width * 0.22, -width * 0.44, 2.2), (0, 0, min(2.8, height * 0.2)), 62)
    render(scene, camera, root, prefix.with_name(prefix.name + "-canopy.png"), 48, (width * 0.45, -width * 0.55, height * 1.32), (0, 0, height * 0.58), 52)
    return {
        "id": job["id"],
        "candidate": candidate_path.relative_to(ROOT).as_posix(),
        "dimensionsMetres": list(dimensions),
        "views": ["front", "three-quarter", "silhouette", "human-height", "bark-close", "canopy"],
    }


requested = [argument.split("=", 1)[1] for argument in sys.argv if argument.startswith("--job=")]
selected_ids = requested or MANIFEST["exportSets"][MANIFEST["activeExportSet"]]
jobs_by_id = {job["id"]: job for job in MANIFEST["jobs"]}
metrics = [render_job(jobs_by_id[job_id]) for job_id in selected_ids]
(EVIDENCE_ROOT / "plantcatalog-render-metrics.json").write_text(
    json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(metrics, indent=2))
