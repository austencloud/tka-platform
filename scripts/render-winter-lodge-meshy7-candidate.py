"""Render a measured orbit review of the isolated Meshy 7 Winter lodge."""

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "static"
    / "models"
    / "winter"
    / "settlement"
    / "meshy7-candidates"
    / "winter-keeper-lodge-meshy7-r1_raw.glb"
)
OUTPUT_DIR = (
    ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "moonlit-winter-hollow"
    / "evidence"
    / "lodge-meshy7-r1"
)
BLEND_PATH = ROOT / "blender" / "winter_keeper_lodge_meshy7_r1_review.blend"
TARGET_DIMENSIONS = Vector((9.0, 7.0, 5.4))


def world_bounds(objects):
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    return minimum, maximum


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("Meshy lodge imported no mesh objects")

source_minimum, source_maximum = world_bounds(meshes)
source_dimensions = source_maximum - source_minimum
scale = Vector(
    (
        TARGET_DIMENSIONS.x / source_dimensions.x,
        TARGET_DIMENSIONS.y / source_dimensions.y,
        TARGET_DIMENSIONS.z / source_dimensions.z,
    )
)
for obj in meshes:
    obj.scale = Vector((obj.scale.x * scale.x, obj.scale.y * scale.y, obj.scale.z * scale.z))
bpy.context.view_layer.update()

minimum, maximum = world_bounds(meshes)
offset = Vector((-(minimum.x + maximum.x) * 0.5, -(minimum.y + maximum.y) * 0.5, -minimum.z))
for obj in meshes:
    obj.location += offset
bpy.context.view_layer.update()
minimum, maximum = world_bounds(meshes)
dimensions = maximum - minimum

for obj in meshes:
    obj["tka_asset_id"] = "winter-keeper-lodge-meshy7-r1"
    obj["tka_source"] = SOURCE.relative_to(ROOT).as_posix()
    obj["tka_review_target_dimensions"] = list(TARGET_DIMENSIONS)

bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, -0.02))
ground = bpy.context.object
ground.name = "QA_NeutralGround"
ground_material = bpy.data.materials.new("QA_NeutralGroundMaterial")
ground_material.diffuse_color = (0.11, 0.14, 0.18, 1.0)
ground.data.materials.append(ground_material)

world = bpy.data.worlds.new("QA_WinterLodgeWorld")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.025, 0.04, 0.07, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
bpy.context.scene.world = world

for name, location, energy, size, color in (
    ("Key", (7.0, -8.0, 11.0), 1650.0, 7.0, (0.72, 0.82, 1.0)),
    ("Fill", (-8.0, -3.0, 6.0), 900.0, 6.0, (0.4, 0.55, 0.9)),
    ("Warm", (0.0, 4.0, 5.0), 650.0, 4.0, (1.0, 0.35, 0.08)),
):
    light_data = bpy.data.lights.new(f"QA_{name}", type="AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light_data.color = color
    light = bpy.data.objects.new(f"QA_{name}", light_data)
    bpy.context.collection.objects.link(light)
    light.location = location
    look_at(light, (0, 0, 2.2))

camera_data = bpy.data.cameras.new("QA_WinterLodgeCamera")
camera_data.lens = 52
camera = bpy.data.objects.new("QA_WinterLodgeCamera", camera_data)
bpy.context.collection.objects.link(camera)
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 675
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.view_settings.look = "AgX - Medium High Contrast"

render_paths = []
radius = 16.0
for index, degrees in enumerate(range(0, 360, 45)):
    angle = math.radians(degrees)
    camera.location = (math.cos(angle) * radius, math.sin(angle) * radius, 6.2)
    look_at(camera, (0, 0, 2.25))
    output = OUTPUT_DIR / f"winter-keeper-lodge-meshy7-r1-orbit-{index + 1:02d}-{degrees:03d}.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    render_paths.append(output.relative_to(ROOT).as_posix())

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
triangles = sum(len(obj.data.polygons) for obj in meshes)
metrics = {
    "assetId": "winter-keeper-lodge-meshy7-r1",
    "source": SOURCE.relative_to(ROOT).as_posix(),
    "sourceDimensions": list(source_dimensions),
    "reviewDimensions": list(dimensions),
    "targetDimensions": list(TARGET_DIMENSIONS),
    "meshCount": len(meshes),
    "triangleCount": triangles,
    "materialCount": len({material.name for obj in meshes for material in obj.data.materials if material}),
    "renders": render_paths,
}
(OUTPUT_DIR / "winter-keeper-lodge-meshy7-r1-metrics.json").write_text(
    json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(metrics, indent=2))
