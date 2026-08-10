"""Render the generated Winter lodge at its approved measured envelope.

The four fixed angles are an inspection artifact. They prove the model's
silhouette, front orientation, ground contact, and material response before it
is composed into the complete Winter environment.
"""

import json
import math
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "static" / "models" / "winter" / "settlement" / "winter-keeper-lodge_raw.glb"
EVIDENCE_DIR = Path(tempfile.gettempdir()) / "tka-winter-evidence" / "lodge-candidate"
TARGET_DIMENSIONS = Vector((7.8, 6.4, 5.2))
VIEW_ANGLES = (0.0, 90.0, 180.0, 270.0)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def make_material(name, color, roughness=0.8):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return material


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


def mesh_bounds(objects):
    corners = []
    for obj in objects:
        if obj.type == "MESH":
            corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not corners:
        raise RuntimeError("The lodge GLB contains no mesh geometry")
    minimum = Vector(tuple(min(point[index] for point in corners) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in corners) for index in range(3)))
    return minimum, maximum


def import_and_normalize():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_PATH))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    minimum, maximum = mesh_bounds(imported)
    dimensions = maximum - minimum

    root = bpy.data.objects.new("Winter_Keeper_Lodge_Review_Root", None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)
    for obj in imported:
        if obj.parent not in imported_set:
            matrix = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = matrix

    root.scale = tuple(TARGET_DIMENSIONS[index] / dimensions[index] for index in range(3))
    root.location = (
        -((minimum.x + maximum.x) * 0.5) * root.scale.x,
        -((minimum.y + maximum.y) * 0.5) * root.scale.y,
        -minimum.z * root.scale.z,
    )
    bpy.context.view_layer.update()
    return root, imported, dimensions


def add_person(material):
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=0.18, depth=1.3, location=(-5.1, -1.8, 0.65))
    bpy.context.object.data.materials.append(material)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=10, radius=0.19, location=(-5.1, -1.8, 1.49))
    bpy.context.object.data.materials.append(material)


def setup_stage():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.35

    world = bpy.data.worlds.new("Winter Lodge Review World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.013, 0.026, 1.0)
    background.inputs["Strength"].default_value = 0.28
    scene.world = world

    ground_material = make_material("Review Snow", (0.62, 0.72, 0.84), 0.88)
    scale_material = make_material("Scale Figure", (0.76, 0.33, 0.16), 0.72)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0.0, 0.0, -0.015))
    bpy.context.object.data.materials.append(ground_material)
    add_person(scale_material)

    camera_data = bpy.data.cameras.new("Winter Lodge Review Camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 11.5
    camera = bpy.data.objects.new("Winter Lodge Review Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0.0, -15.0, 6.2)
    aim_at(camera, (0.0, 0.0, 2.35))
    scene.camera = camera

    target = (0.0, 0.0, 2.2)
    add_area_light("Moon Key", (-7.0, -9.0, 11.0), 1500, 7.0, (0.62, 0.76, 1.0), target)
    add_area_light("Warm Fill", (7.0, -4.0, 7.0), 900, 5.0, (1.0, 0.55, 0.3), target)
    add_area_light("Snow Rim", (2.0, 8.0, 10.0), 1200, 6.0, (0.55, 0.72, 1.0), target)
    return scene


if not SOURCE_PATH.is_file():
    raise FileNotFoundError(SOURCE_PATH)

EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
reset_scene()
scene = setup_stage()
root, imported, source_dimensions = import_and_normalize()

renders = []
for angle in VIEW_ANGLES:
    root.rotation_euler.z = math.radians(angle)
    bpy.context.view_layer.update()
    output_path = EVIDENCE_DIR / f"winter_keeper_lodge_{int(angle):03d}.png"
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    renders.append(str(output_path))

mesh_objects = [obj for obj in imported if obj.type == "MESH"]
for obj in mesh_objects:
    obj.data.calc_loop_triangles()

metrics = {
    "sourcePath": str(SOURCE_PATH),
    "sourceBytes": SOURCE_PATH.stat().st_size,
    "sourceDimensions": list(source_dimensions),
    "targetDimensions": list(TARGET_DIMENSIONS),
    "meshCount": len(mesh_objects),
    "vertices": sum(len(obj.data.vertices) for obj in mesh_objects),
    "triangles": sum(len(obj.data.loop_triangles) for obj in mesh_objects),
    "materials": len({material.name for obj in mesh_objects for material in obj.data.materials if material}),
    "renders": renders,
}
(EVIDENCE_DIR / "winter_keeper_lodge_metrics.json").write_text(
    json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
)

print(json.dumps(metrics, indent=2))
