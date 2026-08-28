"""Render the six budgeted Ember Meshy candidates as one neutral comparison plate."""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CANDIDATE_DIR = PROJECT_ROOT / "static" / "models" / "ember" / "meshy-candidates"
OUTPUT_PATH = (
    PROJECT_ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "ember-spatial-directions"
    / "evidence"
    / "gate-4-meshy-r1"
    / "ember-meshy-geometry-comparison.png"
)
TURNTABLE_OUTPUT_PATH = OUTPUT_PATH.with_name("ember-meshy-finalist-turntable.png")

CANDIDATES = [
    ("hero-columnar-escarpment-a", "HERO A", -4.5, 8.3),
    ("hero-columnar-escarpment-b", "HERO B", 4.5, 8.3),
    ("collapsed-lava-bank-a", "LAVA BANK A", -4.5, 3.75),
    ("collapsed-lava-bank-b", "LAVA BANK B", 4.5, 3.75),
    ("obsidian-fumarole-talus-a", "FUMAROLE A", -4.5, -0.8),
    ("obsidian-fumarole-talus-b", "FUMAROLE B", 4.5, -0.8),
]


def make_material(name: str, color: tuple[float, float, float, float], roughness: float):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    return material


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(tuple(min(corner[i] for corner in corners) for i in range(3))),
        Vector(tuple(max(corner[i] for corner in corners) for i in range(3))),
    )


def import_candidate(
    candidate_id: str,
    x: float,
    z: float,
    material: bpy.types.Material,
    *,
    max_extent: float = 3.45,
    rotation_degrees: float = -14.0,
) -> None:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(CANDIDATE_DIR / f"{candidate_id}-review.glb"))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]
    minimum, maximum = bounds(imported)
    size = maximum - minimum
    scale = max_extent / max(size.x, size.y, size.z)
    center = (minimum + maximum) * 0.5
    for obj in imported:
        obj.scale *= scale
        obj.location -= center * scale
        obj.location += Vector((x, 0.0, z))
        obj.rotation_euler[2] = math.radians(rotation_degrees)
        if not obj.data.materials:
            obj.data.materials.append(material)


def add_label(text: str, x: float, z: float, material: bpy.types.Material) -> None:
    bpy.ops.object.text_add(location=(x, -0.8, z - 2.1), rotation=(math.radians(90), 0.0, 0.0))
    label = bpy.context.object
    label.data.body = text
    label.data.align_x = "CENTER"
    label.data.align_y = "CENTER"
    label.data.size = 0.45
    label.data.extrude = 0.006
    label.data.materials.append(material)


def add_area_light(name: str, location: tuple[float, float, float], energy: float, color):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = 8.0
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0.0, 0.0, 4.2)) - light.location).to_track_quat("-Z", "Y").to_euler()


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    basalt = make_material("Neutral basalt review", (0.16, 0.18, 0.19, 1.0), 0.78)
    label_material = make_material("Labels", (0.93, 0.49, 0.16, 1.0), 0.5)

    for candidate_id, label, x, z in CANDIDATES:
        import_candidate(candidate_id, x, z, basalt)
        add_label(label, x, z, label_material)

    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.006, 0.009, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.24

    add_area_light("Warm key", (-9.0, -11.0, 13.0), 3200.0, (1.0, 0.43, 0.16))
    add_area_light("Cool rim", (9.0, 2.0, 9.0), 2400.0, (0.16, 0.34, 0.62))
    add_area_light("Soft front", (0.0, -13.0, 3.0), 2200.0, (0.62, 0.67, 0.7))

    camera_data = bpy.data.cameras.new("Comparison camera")
    camera = bpy.data.objects.new("Comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (0.0, -31.0, 4.0)
    camera.rotation_euler = (Vector((0.0, 0.0, 3.7)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 15.4
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1440
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.filepath = str(OUTPUT_PATH)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print(OUTPUT_PATH)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    finalists = [
        ("hero-columnar-escarpment-b", "HERO B", 6.25),
        ("collapsed-lava-bank-b", "LAVA BANK B", 1.3),
        ("obsidian-fumarole-talus-b", "FUMAROLE B", -3.65),
    ]
    angles = ((0.0, -6.0), (90.0, -2.0), (180.0, 2.0), (270.0, 6.0))
    for candidate_id, label, z in finalists:
        for angle, x in angles:
            import_candidate(
                candidate_id,
                x,
                z,
                basalt,
                max_extent=2.75,
                rotation_degrees=angle,
            )
            add_label(f"{int(angle)}°", x, z - 0.15, label_material)
        add_label(label, 0.0, z + 4.25, label_material)

    add_area_light("Turntable warm key", (-9.0, -11.0, 13.0), 3600.0, (1.0, 0.43, 0.16))
    add_area_light("Turntable cool rim", (9.0, 2.0, 9.0), 2700.0, (0.16, 0.34, 0.62))
    add_area_light("Turntable front", (0.0, -13.0, 3.0), 2400.0, (0.62, 0.67, 0.7))
    camera_data = bpy.data.cameras.new("Turntable camera")
    camera = bpy.data.objects.new("Turntable camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (0.0, -31.0, 1.25)
    camera.rotation_euler = (Vector((0.0, 0.0, 1.25)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 15.4
    scene.camera = camera
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 1500
    scene.render.filepath = str(TURNTABLE_OUTPUT_PATH)
    bpy.ops.render.render(write_still=True)
    print(TURNTABLE_OUTPUT_PATH)


if __name__ == "__main__":
    main()
