"""Render isolated semantic summer-tree candidates without touching production Forest assets."""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "scripts" / "forest-semantic-tree-family.json").read_text(encoding="utf-8"))
EVIDENCE = ROOT / MANIFEST["evidenceDirectory"]
OUTPUT = ROOT / MANIFEST["outputDirectory"]
SOURCE = "preview"
SPECIES = None
if "--source" in sys.argv:
    SOURCE = sys.argv[sys.argv.index("--source") + 1]
if "--species" in sys.argv:
    SPECIES = set(sys.argv[sys.argv.index("--species") + 1].split(","))
if SOURCE not in {"preview", "raw", "semantic"}:
    raise ValueError("--source must be preview, raw, or semantic")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for block in list(datablocks):
            datablocks.remove(block)


def material(name, color, roughness=0.9):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = (*color, 1.0)
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = roughness
    return result


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, color, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def bounds(objects):
    points = []
    for obj in mesh_objects(objects):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("Candidate import contains no mesh objects")
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def normalize(objects, target_height, target_crown_width):
    root = bpy.data.objects.new("Candidate_Normalization_Root", None)
    bpy.context.scene.collection.objects.link(root)
    object_set = set(objects)
    for obj in objects:
        if obj.parent not in object_set:
            world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world
    minimum, maximum = bounds(objects)
    source_dimensions = maximum - minimum
    scale = min(
        target_height / source_dimensions.z,
        target_crown_width / max(source_dimensions.x, source_dimensions.y),
    )
    root.scale = (scale, scale, scale)
    root.location = (
        -((minimum.x + maximum.x) * 0.5) * scale,
        -((minimum.y + maximum.y) * 0.5) * scale,
        -minimum.z * scale,
    )
    bpy.context.view_layer.update()
    return root, source_dimensions, source_dimensions * scale


def replace_materials(objects, replacement):
    originals = []
    for obj in mesh_objects(objects):
        originals.append((obj, list(obj.data.materials)))
        obj.data.materials.clear()
        obj.data.materials.append(replacement)
    return originals


def restore_materials(originals):
    for obj, materials in originals:
        obj.data.materials.clear()
        for original in materials:
            obj.data.materials.append(original)


def setup_scene(target_height):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.15

    world = bpy.data.worlds.new("Neutral Candidate World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.07, 0.09, 0.085, 1.0)
    background.inputs["Strength"].default_value = 0.65
    scene.world = world

    ground = material("Neutral Ground", (0.17, 0.2, 0.17), 0.95)
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0.0, 0.0, -0.025))
    bpy.context.object.data.materials.append(ground)

    camera_data = bpy.data.cameras.new("Candidate Camera")
    camera = bpy.data.objects.new("Candidate Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    target = (0.0, 0.0, target_height * 0.46)
    add_area_light("Sun Key", (-12.0, -14.0, target_height * 1.12), 1900, 9.0, (1.0, 0.92, 0.78), target)
    add_area_light("Sky Fill", (13.0, -4.0, target_height * 0.76), 1250, 10.0, (0.64, 0.8, 1.0), target)
    add_area_light("Leaf Rim", (6.0, 13.0, target_height * 1.05), 1600, 8.0, (0.72, 0.93, 0.68), target)
    return scene, camera


def render(scene, camera, root, output, rotation, location, target, ortho_scale=None, lens=52):
    root.rotation_euler.z = math.radians(rotation)
    camera.location = location
    if ortho_scale is None:
        camera.data.type = "PERSP"
        camera.data.lens = lens
    else:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = ortho_scale
    aim_at(camera, target)
    bpy.context.view_layer.update()
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def render_candidate(candidate):
    clear_scene()
    target_height = float(candidate["targetHeightMetres"])
    scene, camera = setup_scene(target_height)
    suffix = {
        "preview": "preview",
        "raw": "refined_raw",
        "semantic": "semantic_proof",
    }[SOURCE]
    asset = OUTPUT / f"{candidate['id']}_{suffix}.glb"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    root, source_dimensions, normalized_dimensions = normalize(
        imported, target_height, float(candidate["targetCrownWidthMetres"])
    )

    clay = material("Preview Clay", (0.38, 0.43, 0.37), 0.92)
    silhouette = material("Silhouette", (0.004, 0.006, 0.004), 0.98)
    if SOURCE == "preview":
        replace_materials(imported, clay)

    scale = max(target_height * 1.17, normalized_dimensions.x * 1.16, normalized_dimensions.y * 1.16)
    target = (0.0, 0.0, target_height * 0.48)
    prefix = EVIDENCE / f"{candidate['species']}-{SOURCE}"
    render(scene, camera, root, prefix.with_name(prefix.name + "-front.png"), 0, (0.0, -32.0, target_height * 0.5), target, scale)
    render(scene, camera, root, prefix.with_name(prefix.name + "-three-quarter.png"), 38, (0.0, -32.0, target_height * 0.5), target, scale)
    originals = replace_materials(imported, silhouette)
    render(scene, camera, root, prefix.with_name(prefix.name + "-silhouette.png"), 71, (0.0, -32.0, target_height * 0.5), target, scale)
    restore_materials(originals)
    if SOURCE in {"raw", "semantic"}:
        render(scene, camera, root, prefix.with_name(prefix.name + "-human-height.png"), 28, (8.0, -16.0, 1.7), (0.0, 0.0, 5.2), None, 48)
        render(scene, camera, root, prefix.with_name(prefix.name + "-close.png"), 14, (4.2, -8.8, 2.25), (0.0, 0.0, 3.2), None, 58)

    return {
        "id": candidate["id"],
        "species": candidate["species"],
        "asset": str(asset),
        "sourceDimensions": list(source_dimensions),
        "normalizedDimensionsMetres": list(normalized_dimensions),
        "targetHeightMetres": target_height,
        "targetCrownWidthMetres": candidate["targetCrownWidthMetres"],
        "widthToHeight": normalized_dimensions.x / normalized_dimensions.z,
        "depthToHeight": normalized_dimensions.y / normalized_dimensions.z,
    }


EVIDENCE.mkdir(parents=True, exist_ok=True)
selected = [candidate for candidate in MANIFEST["candidates"] if SPECIES is None or candidate["species"] in SPECIES]
metrics = [render_candidate(candidate) for candidate in selected]
(EVIDENCE / f"{SOURCE}-render-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metrics, indent=2))
