"""Render matched Meshy-versus-SpeedTree oak evidence."""

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "scripts" / "forest-speedtree-pilot.json").read_text(encoding="utf-8"))
EVIDENCE_DIR = ROOT / MANIFEST["evidenceDirectory"]
TARGET_HEIGHT = float(MANIFEST["candidate"]["targetHeightMetres"])


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for block in list(datablocks):
            datablocks.remove(block)


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def bounds(objects):
    points = []
    for obj in mesh_objects(objects):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def import_tree(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [obj for obj in bpy.data.objects if obj not in before]
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    object_set = set(objects)
    for obj in objects:
        if obj.parent not in object_set:
            matrix = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = matrix
        if obj.type == "MESH":
            obj.select_set(False)
    minimum, maximum = bounds(objects)
    scale = TARGET_HEIGHT / (maximum.z - minimum.z)
    root.scale = (scale, scale, scale)
    root.location = (
        -((minimum.x + maximum.x) * 0.5) * scale,
        -((minimum.y + maximum.y) * 0.5) * scale,
        -minimum.z * scale,
    )
    bpy.context.view_layer.update()
    return {"root": root, "objects": objects, "meshes": mesh_objects(objects)}


def make_material(name, color, roughness=0.9):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = roughness
    return material


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


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.2

    world = bpy.data.worlds.new("Forest Oak Review World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.035, 0.055, 0.07, 1.0)
    background.inputs["Strength"].default_value = 0.5
    scene.world = world

    ground_material = make_material("Review Ground", (0.13, 0.17, 0.15), 0.94)
    bpy.ops.mesh.primitive_plane_add(size=90, location=(0.0, 0.0, -0.03))
    ground = bpy.context.object
    ground.name = "Review Ground"
    ground.data.materials.append(ground_material)

    camera_data = bpy.data.cameras.new("Matched Review Camera")
    camera = bpy.data.objects.new("Matched Review Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    target = (0.0, 0.0, 6.5)
    add_area_light("Warm Key", (-11.0, -13.0, 20.0), 1850, 8.0, (1.0, 0.9, 0.72), target)
    add_area_light("Sky Fill", (12.0, -4.0, 14.0), 1350, 10.0, (0.56, 0.76, 1.0), target)
    add_area_light("Canopy Rim", (5.0, 13.0, 19.0), 1700, 8.0, (0.72, 0.94, 0.68), target)
    return scene, camera


def set_visible(tree, visible):
    tree["root"].hide_render = not visible
    for obj in tree["objects"]:
        obj.hide_render = not visible


def place_tree(tree, x=0.0, rotation=0.0):
    tree["root"].location.x = x
    tree["root"].rotation_euler.z = math.radians(rotation)


def render(scene, camera, filename, resolution, camera_location, target, lens=None, ortho_scale=None):
    scene.render.resolution_x, scene.render.resolution_y = resolution
    camera.location = camera_location
    if ortho_scale is not None:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = ortho_scale
    else:
        camera.data.type = "PERSP"
        camera.data.lens = lens
    aim_at(camera, target)
    bpy.context.view_layer.update()
    output = EVIDENCE_DIR / filename
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(output)


EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
reset_scene()
scene, camera = setup_scene()
meshy = import_tree(ROOT / MANIFEST["comparison"]["meshyReviewPath"], "Meshy Oak Review Root")
speedtree = import_tree(ROOT / MANIFEST["candidate"]["reviewPath"], "SpeedTree Oak Review Root")

set_visible(meshy, True)
set_visible(speedtree, True)
place_tree(meshy, -9.0, -12.0)
place_tree(speedtree, 9.0, 12.0)
render(
    scene,
    camera,
    "speedtree-pilot-lineup.png",
    (1600, 900),
    (0.0, -34.0, 8.0),
    (0.0, 0.0, 8.0),
    ortho_scale=19.0,
)

for label, tree, rotation in (("meshy", meshy, 24.0), ("speedtree", speedtree, 24.0)):
    set_visible(meshy, tree is meshy)
    set_visible(speedtree, tree is speedtree)
    place_tree(tree, 0.0, rotation)
    render(
        scene,
        camera,
        f"speedtree-pilot-{label}-neutral.png",
        (1000, 1000),
        (0.0, -28.0, 8.0),
        (0.0, 0.0, 8.0),
        ortho_scale=18.8,
    )
    render(
        scene,
        camera,
        f"speedtree-pilot-{label}-human-height.png",
        (1000, 1000),
        (8.0, -16.0, 1.7),
        (0.0, 0.0, 5.4),
        lens=48,
    )
    render(
        scene,
        camera,
        f"speedtree-pilot-{label}-trunk.png",
        (1000, 1000),
        (0.0, -16.0, 3.0),
        (0.0, 0.0, 3.0),
        ortho_scale=6.2,
    )
