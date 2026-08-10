"""Render isolated Forest regeneration evidence without touching the production scene."""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "scripts" / "forest-tree-regeneration.json").read_text(encoding="utf-8"))
CANDIDATE = MANIFEST["candidate"]
EVIDENCE_DIR = ROOT / MANIFEST["evidenceDirectory"]
OUTPUT_DIR = ROOT / MANIFEST["outputDirectory"]
SOURCE = "final"
if "--source" in sys.argv:
    SOURCE = sys.argv[sys.argv.index("--source") + 1]
if SOURCE not in {"preview", "final"}:
    raise ValueError("--source must be preview or final")

suffix = "_preview.glb" if SOURCE == "preview" else "_review.glb"
ASSET_PATH = OUTPUT_DIR / f"{CANDIDATE['id']}{suffix}"
TARGET_HEIGHT = float(CANDIDATE["targetHeightMetres"])


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            datablocks.remove(block)


def make_material(name, color, roughness=0.85):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, (0.0, 0.0, TARGET_HEIGHT * 0.42))


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def bounds(objects):
    points = []
    for obj in mesh_objects(objects):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("Candidate import contains no mesh objects")
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def normalize(objects):
    root = bpy.data.objects.new("Forest_Tree_Regeneration_Review_Root", None)
    bpy.context.scene.collection.objects.link(root)
    object_set = set(objects)
    for obj in objects:
        if obj.parent not in object_set:
            matrix = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = matrix
    minimum, maximum = bounds(objects)
    dimensions = maximum - minimum
    scale = TARGET_HEIGHT / dimensions.z
    root.scale = (scale, scale, scale)
    root.location = (
        -((minimum.x + maximum.x) * 0.5) * scale,
        -((minimum.y + maximum.y) * 0.5) * scale,
        -minimum.z * scale,
    )
    bpy.context.view_layer.update()
    return root, dimensions * scale


def replace_materials(objects, material):
    originals = []
    for obj in mesh_objects(objects):
        originals.append((obj, list(obj.data.materials)))
        obj.data.materials.clear()
        obj.data.materials.append(material)
    return originals


def restore_materials(originals):
    for obj, materials in originals:
        obj.data.materials.clear()
        for material in materials:
            obj.data.materials.append(material)


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.25

    world = bpy.data.worlds.new("Neutral Woodland Review World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.055, 0.075, 0.085, 1.0)
    background.inputs["Strength"].default_value = 0.5
    scene.world = world

    ground_material = make_material("Neutral Ground", (0.15, 0.18, 0.16), 0.92)
    bpy.ops.mesh.primitive_plane_add(size=50, location=(0.0, 0.0, -0.025))
    bpy.context.object.data.materials.append(ground_material)

    camera_data = bpy.data.cameras.new("Candidate Review Camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("Candidate Review Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    add_area_light("Day Key", (-9.0, -12.0, 18.0), 1700, 8.0, (1.0, 0.92, 0.78))
    add_area_light("Sky Fill", (11.0, -3.0, 11.0), 1150, 9.0, (0.62, 0.78, 1.0))
    add_area_light("Canopy Rim", (4.0, 10.0, 17.0), 1500, 7.0, (0.78, 0.92, 0.76))
    return scene, camera


def render(scene, camera, root, name, rotation, location, target, ortho_scale):
    camera.data.type = "ORTHO"
    root.rotation_euler.z = math.radians(rotation)
    camera.location = location
    camera.data.ortho_scale = ortho_scale
    aim_at(camera, target)
    bpy.context.view_layer.update()
    output = EVIDENCE_DIR / f"forest-tree-regeneration-{SOURCE}-{name}.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(output)


def render_human_height(scene, camera, root):
    root.rotation_euler.z = math.radians(32)
    camera.data.type = "PERSP"
    camera.data.lens = 48
    camera.location = (8.5, -15.5, 1.7)
    aim_at(camera, (0.0, 0.0, 5.8))
    bpy.context.view_layer.update()
    output = EVIDENCE_DIR / "forest-tree-regeneration-final-human-height-three-quarter.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(output)


EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
reset_scene()
scene, camera = setup_scene()
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ASSET_PATH))
objects = [obj for obj in bpy.data.objects if obj not in before]
root, dimensions = normalize(objects)

clay = make_material("Preview Clay", (0.42, 0.46, 0.41), 0.9)
silhouette = make_material("Silhouette", (0.006, 0.008, 0.007), 0.96)
if SOURCE == "preview":
    replace_materials(objects, clay)

full_scale = max(TARGET_HEIGHT * 1.2, dimensions.x * 1.18, dimensions.y * 1.18)
render(scene, camera, root, "front", 0, (0.0, -28.0, 8.0), (0.0, 0.0, 8.0), full_scale)
render(scene, camera, root, "three-quarter", 38, (0.0, -28.0, 8.0), (0.0, 0.0, 8.0), full_scale)

originals = replace_materials(objects, silhouette)
render(scene, camera, root, "silhouette", 72, (0.0, -28.0, 8.0), (0.0, 0.0, 8.0), full_scale)
restore_materials(originals)

if SOURCE == "final":
    render_human_height(scene, camera, root)
    render(scene, camera, root, "trunk", 18, (0.0, -18.0, 3.2), (0.0, 0.0, 3.2), 6.4)

metrics = {
    "source": SOURCE,
    "assetPath": str(ASSET_PATH),
    "normalizedDimensionsMetres": [dimensions.x, dimensions.y, dimensions.z],
    "reviewHeightMetres": TARGET_HEIGHT,
}
(EVIDENCE_DIR / f"forest-tree-regeneration-{SOURCE}-render-metrics.json").write_text(
    json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
)
