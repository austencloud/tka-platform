"""Build four deterministic Ember spatial grayboxes and render them fairly.

This script is an exploration tool, not the production Ember asset builder.
Every direction lives at the origin in its own Blender collection. Only one
direction is rendered at a time, using identical hero and plan cameras.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions"
EVIDENCE_DIR = SPEC_DIR / "evidence/r1"
BLEND_PATH = ROOT / "blender/ember-spatial-directions-r1.blend"
REPORT_PATH = EVIDENCE_DIR / "ember-spatial-directions-r1-report.json"

EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)

RNG = random.Random(20260825)
OPTION_IDS = (
    "a-basalt-arch",
    "b-oculus-lava-tube",
    "c-faultline-causeway",
    "d-basalt-organ-canyon",
    "e-broken-rift-gate",
)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.worlds,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


reset_scene()
scene = bpy.context.scene
scene.name = "Ember Spatial Directions R1"
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.compression = 35
scene.render.use_file_extension = True
scene.render.resolution_percentage = 100
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 1.25

world = bpy.data.worlds.new("Ember Graybox World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (
    0.004,
    0.008,
    0.018,
    1,
)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.38
scene.world = world


def create_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    return collection


OPTIONS = {option_id: create_collection(f"OPTION_{option_id.upper()}") for option_id in OPTION_IDS}
SHARED = create_collection("SHARED_CAMERAS_AND_LIGHTS")


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


MAT_BASALT = make_material("GB_Basalt", (0.095, 0.135, 0.18, 1), 0.84)
MAT_BASALT_LIGHT = make_material("GB_Basalt_Light", (0.17, 0.235, 0.29, 1), 0.8)
MAT_BASALT_DARK = make_material("GB_Basalt_Dark", (0.035, 0.052, 0.078, 1), 0.9)
MAT_OBSIDIAN = make_material("GB_Obsidian", (0.035, 0.055, 0.085, 1), 0.24, 0.42)
MAT_ASH = make_material("GB_Ash", (0.12, 0.11, 0.12, 1), 0.96)
MAT_LAVA = make_material(
    "GB_Lava",
    (0.48, 0.035, 0.004, 1),
    0.42,
    0.0,
    (1.0, 0.075, 0.005, 1),
    4.0,
)
MAT_LAVA_DIM = make_material(
    "GB_Lava_Dim",
    (0.08, 0.012, 0.003, 1),
    0.58,
    0.0,
    (0.18, 0.009, 0.001, 1),
    0.7,
)
MAT_PERFORMER = make_material(
    "GB_Performer",
    (0.44, 0.82, 1.0, 1),
    0.34,
    0.05,
    (0.05, 0.32, 0.65, 1),
    1.2,
)


def apply_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(material)


def bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    if width <= 0:
        return
    modifier = obj.modifiers.new("Graybox edge break", "BEVEL")
    modifier.width = width
    modifier.segments = segments


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel_width: float = 0.08,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, bevel_width)
    apply_material(obj, material)
    move_to_collection(obj, collection)
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    bevel(obj, min(0.12, radius * 0.12), 2)
    apply_material(obj, material)
    move_to_collection(obj, collection)
    return obj


def add_ico(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (0, 0, 0),
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_material(obj, material)
    move_to_collection(obj, collection)
    return obj


def add_curve(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinates in zip(spline.bezier_points, points):
        point.co = coordinates
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    apply_material(obj, material)
    return obj


def add_segment(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    vertices: int = 12,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    midpoint = (start_v + end_v) / 2
    obj = add_cylinder(
        name,
        tuple(midpoint),
        radius,
        direction.length,
        material,
        collection,
        vertices,
    )
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def add_prism(
    name: str,
    footprint: list[tuple[float, float]],
    bottom: float,
    top: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    bevel_width: float = 0.12,
) -> bpy.types.Object:
    count = len(footprint)
    vertices = [(x, y, bottom) for x, y in footprint] + [(x, y, top) for x, y in footprint]
    faces: list[tuple[int, ...]] = []
    faces.append(tuple(range(count - 1, -1, -1)))
    faces.append(tuple(range(count, count * 2)))
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, following + count, index + count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    apply_material(obj, material)
    bevel(obj, bevel_width, 3)
    return obj


def add_irregular_shelf(
    name: str,
    radius: float,
    bottom: float,
    top: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    phase: float,
    x_scale: float = 1.0,
    y_scale: float = 1.0,
) -> bpy.types.Object:
    points: list[tuple[float, float]] = []
    segments = 48
    for index in range(segments):
        angle = math.tau * index / segments
        distortion = 1 + 0.08 * math.sin(angle * 3 + phase) + 0.045 * math.sin(angle * 7 - phase)
        points.append(
            (
                math.cos(angle) * radius * distortion * x_scale,
                math.sin(angle) * radius * distortion * y_scale,
            )
        )
    return add_prism(name, points, bottom, top, material, collection, 0.16)


def add_arch(
    name: str,
    center: tuple[float, float, float],
    inner_radius: float,
    outer_radius: float,
    thickness: float,
    start_angle: float,
    end_angle: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    segments: int = 44,
) -> bpy.types.Object:
    cx, cy, cz = center
    y_front = cy - thickness / 2
    y_back = cy + thickness / 2
    vertices: list[tuple[float, float, float]] = []
    for index in range(segments + 1):
        t = index / segments
        angle = start_angle + (end_angle - start_angle) * t
        for y in (y_front, y_back):
            vertices.append(
                (
                    cx + math.cos(angle) * outer_radius,
                    y,
                    cz + math.sin(angle) * outer_radius,
                )
            )
            vertices.append(
                (
                    cx + math.cos(angle) * inner_radius,
                    y,
                    cz + math.sin(angle) * inner_radius,
                )
            )
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        base = index * 4
        following = base + 4
        faces.extend(
            [
                (base, following, following + 1, base + 1),
                (base + 2, base + 3, following + 3, following + 2),
                (base, base + 2, following + 2, following),
                (base + 1, following + 1, following + 3, base + 3),
            ]
        )
    faces.extend(
        [
            (0, 1, 3, 2),
            (segments * 4, segments * 4 + 2, segments * 4 + 3, segments * 4 + 1),
        ]
    )
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    apply_material(obj, material)
    bevel(obj, 0.18, 3)
    return obj


def add_point_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    collection: bpy.types.Collection,
    color: tuple[float, float, float] = (1.0, 0.12, 0.015),
    radius: float = 2.5,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.color = color
    data.energy = energy
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    collection.objects.link(obj)
    return obj


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    energy: float,
    size: float,
    collection: bpy.types.Collection,
    color: tuple[float, float, float],
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    collection.objects.link(obj)
    return obj


def add_boulder_field(
    prefix: str,
    collection: bpy.types.Collection,
    placements: list[tuple[float, float, float, float, float, float]],
    material: bpy.types.Material = MAT_BASALT,
) -> None:
    for index, (x, y, z, sx, sy, sz) in enumerate(placements, start=1):
        add_ico(
            f"{prefix}_Boulder_{index:02d}",
            (x, y, z),
            (sx, sy, sz),
            material if index % 3 else MAT_BASALT_LIGHT,
            collection,
            rotation=(RNG.uniform(-0.2, 0.2), RNG.uniform(-0.3, 0.3), RNG.uniform(0, math.tau)),
        )


def add_performer(prefix: str, collection: bpy.types.Collection) -> None:
    add_cylinder(
        f"{prefix}_PerformerBody",
        (0, 0, 0.92),
        0.18,
        1.18,
        MAT_PERFORMER,
        collection,
        16,
    )
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.17, location=(0, 0, 1.67))
    head = bpy.context.object
    head.name = f"{prefix}_PerformerHead"
    apply_material(head, MAT_PERFORMER)
    move_to_collection(head, collection)
    add_segment(
        f"{prefix}_LeftProp",
        (-0.28, 0, 0.58),
        (-0.74, 0, 1.82),
        0.025,
        MAT_PERFORMER,
        collection,
        10,
    )
    add_segment(
        f"{prefix}_RightProp",
        (0.28, 0, 0.58),
        (0.74, 0, 1.82),
        0.025,
        MAT_PERFORMER,
        collection,
        10,
    )


def add_ground(name: str, collection: bpy.types.Collection, z: float = -0.7) -> None:
    add_box(name, (0, 3, z - 0.35), (46, 48, 0.7), MAT_ASH, collection, bevel_width=0)


def add_back_cliffs(prefix: str, collection: bpy.types.Collection, y: float, count: int = 13) -> None:
    for index in range(count):
        x = -20 + index * (40 / max(1, count - 1))
        height = 4.5 + 4.8 * (0.5 + 0.5 * math.sin(index * 1.73 + 0.5))
        width = 2.6 + 1.2 * (0.5 + 0.5 * math.cos(index * 1.41))
        add_box(
            f"{prefix}_BackCliff_{index + 1:02d}",
            (x, y + RNG.uniform(-1.2, 1.2), height / 2 - 0.15),
            (width, RNG.uniform(2.8, 5.4), height),
            MAT_BASALT_DARK if index % 2 else MAT_BASALT,
            collection,
            rotation=(RNG.uniform(-0.08, 0.08), RNG.uniform(-0.08, 0.08), RNG.uniform(-0.18, 0.18)),
            bevel_width=0.16,
        )


def build_basalt_arch() -> None:
    option = "a-basalt-arch"
    collection = OPTIONS[option]
    prefix = "EA"
    add_ground(f"{prefix}_CalderaFloor", collection)
    add_irregular_shelf(f"{prefix}_PerformanceShelf", 6.5, -0.25, 0.18, MAT_OBSIDIAN, collection, 0.6, 1.08, 0.92)
    add_arch(
        f"{prefix}_CollapsedLavaTubeArch",
        (-1.3, 3.1, -0.15),
        9.4,
        12.2,
        3.0,
        0.08,
        math.pi - 0.33,
        MAT_BASALT,
        collection,
    )
    # Unequal supports prevent the arch from becoming a perfect logo mark.
    add_boulder_field(
        prefix,
        collection,
        [
            (-12.0, 2.4, 1.4, 3.4, 2.5, 2.8),
            (-10.0, 0.9, 0.8, 2.8, 2.0, 2.2),
            (8.8, 4.2, 1.0, 2.2, 2.4, 2.4),
            (10.7, 5.0, 0.6, 2.8, 2.0, 1.9),
            (-15.4, -3.0, 1.1, 4.2, 2.7, 2.5),
            (14.6, 9.0, 1.2, 4.0, 3.2, 2.7),
        ],
    )
    add_curve(
        f"{prefix}_MoltenFaultMain",
        [(6.6, -18, -0.28), (5.2, -12, -0.2), (2.7, -8, -0.1), (3.2, -3.5, 0.0), (1.5, 0.5, 0.12)],
        0.18,
        MAT_LAVA,
        collection,
    )
    add_curve(
        f"{prefix}_MoltenFaultBranch",
        [(5.1, -11, -0.18), (8.0, -8.5, -0.15), (9.8, -5.0, -0.2)],
        0.08,
        MAT_LAVA_DIM,
        collection,
    )
    add_back_cliffs(prefix, collection, 19.0)
    add_performer(prefix, collection)
    add_point_light(f"{prefix}_FaultLight", (4.1, -6.0, 1.2), 1000, collection, radius=4.5)
    add_point_light(f"{prefix}_CalderaLight", (0, 12, 3.5), 850, collection, radius=6.0)


def build_oculus_lava_tube() -> None:
    option = "b-oculus-lava-tube"
    collection = OPTIONS[option]
    prefix = "EB"
    add_ground(f"{prefix}_CaveFloor", collection, -0.85)
    add_irregular_shelf(f"{prefix}_CooledCrustShelf", 6.1, -0.35, 0.12, MAT_OBSIDIAN, collection, 1.7, 1.08, 1.0)
    for index, (y, inner, outer, thickness, start, end) in enumerate(
        [
            (-1.5, 8.8, 12.4, 3.7, 0.02, math.pi - 0.16),
            (3.0, 9.4, 13.6, 4.2, 0.14, math.pi - 0.08),
            (7.3, 8.2, 12.8, 4.0, 0.28, math.pi - 0.36),
        ],
        start=1,
    ):
        add_arch(
            f"{prefix}_TubeRib_{index:02d}",
            (0.3 if index == 2 else -0.4, y, -0.7),
            inner,
            outer,
            thickness,
            start,
            end,
            MAT_BASALT_DARK if index == 2 else MAT_BASALT,
            collection,
            36,
        )
    # The roof is a broken field around a five-metre oculus, not a closed dome.
    roof_rocks: list[tuple[float, float, float, float, float, float]] = []
    for index in range(14):
        angle = math.tau * index / 14
        radius = 7.3 + 1.2 * math.sin(index * 1.9)
        roof_rocks.append(
            (
                math.cos(angle) * radius,
                2.8 + math.sin(angle) * radius * 0.72,
                10.4 + 0.8 * math.sin(index * 1.4),
                3.0,
                2.3,
                1.5,
            )
        )
    add_boulder_field(f"{prefix}_Roof", collection, roof_rocks, MAT_BASALT_DARK)
    add_curve(
        f"{prefix}_LavaShelfLeft",
        [(-8.0, -6.0, -0.45), (-7.1, -1.0, -0.25), (-7.8, 4.5, -0.35), (-5.8, 9.0, -0.5)],
        0.34,
        MAT_LAVA,
        collection,
    )
    add_curve(
        f"{prefix}_LavaShelfRight",
        [(7.4, -5.0, -0.45), (6.6, 0.0, -0.24), (7.3, 4.2, -0.35), (5.0, 9.5, -0.5)],
        0.24,
        MAT_LAVA_DIM,
        collection,
    )
    add_boulder_field(
        f"{prefix}_Floor",
        collection,
        [
            (-9.5, -8.0, 1.2, 3.8, 3.0, 2.8),
            (9.0, -6.2, 1.0, 3.0, 2.7, 2.4),
            (-10.8, 6.4, 1.8, 4.4, 3.2, 3.7),
            (10.4, 8.0, 1.5, 4.0, 3.3, 3.2),
        ],
    )
    add_performer(prefix, collection)
    add_area_light(f"{prefix}_OculusLight", (0, 3, 15), (0, 0, 0), 1100, 6.0, collection, (0.26, 0.48, 1.0))
    add_point_light(f"{prefix}_LavaLight", (-6.8, 0, 1.0), 900, collection, radius=5.0)


def build_faultline_causeway() -> None:
    option = "c-faultline-causeway"
    collection = OPTIONS[option]
    prefix = "EC"
    add_box(f"{prefix}_MoltenRift", (0, 2, -2.8), (38, 44, 1.0), MAT_LAVA_DIM, collection, bevel_width=0)
    shelf = [
        (-3.3, -18.0),
        (2.6, -17.0),
        (3.2, -11.5),
        (4.7, -7.5),
        (6.5, -3.0),
        (6.2, 3.8),
        (4.2, 8.0),
        (2.0, 16.0),
        (-2.6, 17.5),
        (-3.6, 9.8),
        (-5.6, 4.0),
        (-5.4, -2.5),
        (-4.0, -8.5),
    ]
    add_prism(f"{prefix}_ObsidianCauseway", shelf, -1.2, 0.18, MAT_OBSIDIAN, collection, 0.18)
    add_curve(
        f"{prefix}_WestFaultEdge",
        [(-3.4, -17, -0.7), (-4.1, -9, -0.5), (-5.1, -2.5, -0.55), (-5.2, 4, -0.6), (-3.4, 10, -0.75)],
        0.18,
        MAT_LAVA,
        collection,
    )
    add_curve(
        f"{prefix}_EastFaultEdge",
        [(2.7, -16.5, -0.7), (4.2, -8, -0.55), (6.0, -2.5, -0.5), (5.7, 4.0, -0.55), (3.7, 9, -0.7)],
        0.11,
        MAT_LAVA_DIM,
        collection,
    )
    # Cliff banks stay unequal so the rift reads as a diagonal tear.
    for side, base_x, offset in (("West", -13.0, 0.0), ("East", 13.5, 0.8)):
        for index in range(10):
            y = -16 + index * 4.2
            x = base_x + math.sin(index * 1.6 + offset) * 2.1
            height = 3.5 + (index % 4) * 1.7 + (1.2 if side == "West" else 0)
            add_ico(
                f"{prefix}_{side}Bank_{index + 1:02d}",
                (x, y, height / 2 - 1.8),
                (4.4, 3.3, height / 1.7),
                MAT_BASALT if index % 2 else MAT_BASALT_DARK,
                collection,
                rotation=(0.0, RNG.uniform(-0.2, 0.2), RNG.uniform(-0.4, 0.4)),
            )
    add_ico(
        f"{prefix}_LeaningSentinel",
        (-17.0, 14.0, 5.4),
        (2.4, 2.0, 7.2),
        MAT_BASALT_LIGHT,
        collection,
        rotation=(0.0, -0.34, -0.2),
    )
    add_performer(prefix, collection)
    add_point_light(f"{prefix}_RiftLightNear", (1.0, -6.0, -0.2), 1450, collection, radius=7.0)
    add_point_light(f"{prefix}_RiftLightFar", (0.0, 10.0, -0.3), 950, collection, radius=7.0)


def build_basalt_organ_canyon() -> None:
    option = "d-basalt-organ-canyon"
    collection = OPTIONS[option]
    prefix = "ED"
    add_ground(f"{prefix}_CanyonFloor", collection, -0.72)
    add_irregular_shelf(f"{prefix}_CanyonShelf", 6.35, -0.3, 0.14, MAT_OBSIDIAN, collection, 2.8, 1.1, 0.92)
    for side, sign, y_shift in (("Left", -1, -0.8), ("Right", 1, 1.1)):
        for row in range(3):
            for index in range(8):
                y = -13 + index * 4.4 + row * 0.6 + y_shift
                x = sign * (7.2 + row * 2.0 + 0.8 * math.sin(index * 1.3 + row))
                height = 5.4 + 1.6 * row + 4.8 * (0.5 + 0.5 * math.sin(index * 1.77 + row))
                radius = 1.0 + row * 0.18 + 0.22 * math.cos(index * 1.4)
                add_cylinder(
                    f"{prefix}_{side}Column_R{row + 1}_{index + 1:02d}",
                    (x, y, height / 2 - 0.25),
                    radius,
                    height,
                    MAT_BASALT_LIGHT if (index + row) % 4 == 0 else MAT_BASALT,
                    collection,
                    vertices=6,
                    rotation=(RNG.uniform(-0.08, 0.08), RNG.uniform(-0.12, 0.12), RNG.uniform(-0.12, 0.12)),
                )
    add_box(
        f"{prefix}_DistantLavaFall",
        (0.8, 20.5, 5.0),
        (2.2, 0.36, 9.0),
        MAT_LAVA,
        collection,
        bevel_width=0.28,
    )
    add_box(
        f"{prefix}_DistantChasm",
        (0.8, 21.3, 4.2),
        (7.5, 2.6, 11.5),
        MAT_BASALT_DARK,
        collection,
        bevel_width=0.2,
    )
    # Re-add the fall in front of the dark slot after the backing mass.
    add_box(
        f"{prefix}_DistantLavaFallFront",
        (0.8, 19.85, 5.0),
        (1.7, 0.3, 8.4),
        MAT_LAVA,
        collection,
        bevel_width=0.18,
    )
    add_curve(
        f"{prefix}_CanyonSeam",
        [(6.2, -11, -0.25), (6.0, -5, -0.12), (6.8, 1.0, -0.1), (5.5, 7.0, -0.2), (3.2, 13.0, -0.35)],
        0.15,
        MAT_LAVA_DIM,
        collection,
    )
    add_boulder_field(
        f"{prefix}_ColumnRoots",
        collection,
        [
            (-7.6, -5.5, 0.7, 2.4, 2.2, 1.8),
            (7.8, -2.2, 0.5, 2.0, 2.4, 1.6),
            (-8.4, 7.0, 0.9, 2.8, 2.0, 2.2),
            (8.7, 8.8, 1.0, 2.7, 2.3, 2.4),
        ],
    )
    add_performer(prefix, collection)
    add_point_light(f"{prefix}_LavaFallLight", (0.8, 16.5, 4.5), 1300, collection, radius=6.0)
    add_point_light(f"{prefix}_SeamLight", (5.8, 0.0, 1.0), 720, collection, radius=4.0)


def build_broken_rift_gate() -> None:
    option = "e-broken-rift-gate"
    collection = OPTIONS[option]
    prefix = "EE"
    add_box(f"{prefix}_MoltenRift", (0, 2, -2.8), (40, 46, 1.0), MAT_LAVA_DIM, collection, bevel_width=0)
    shelf = [
        (-4.8, -18.0),
        (0.4, -18.0),
        (1.4, -13.0),
        (0.4, -9.0),
        (2.0, -5.0),
        (6.0, -2.0),
        (6.2, 3.5),
        (3.4, 7.4),
        (5.0, 12.4),
        (2.6, 18.0),
        (-1.5, 18.0),
        (-1.3, 12.0),
        (-4.1, 8.0),
        (-6.0, 3.0),
        (-5.8, -2.0),
        (-3.8, -7.0),
        (-4.8, -12.0),
    ]
    add_prism(f"{prefix}_RiftShelf", shelf, -1.15, 0.18, MAT_OBSIDIAN, collection, 0.18)
    add_curve(
        f"{prefix}_WestFaultEdge",
        [(-4.7, -17, -0.65), (-4.5, -10, -0.5), (-5.5, -2, -0.48), (-4.0, 7, -0.58), (-1.3, 13, -0.7)],
        0.16,
        MAT_LAVA,
        collection,
    )
    add_curve(
        f"{prefix}_EastFaultEdge",
        [(0.5, -17, -0.65), (1.0, -11, -0.52), (5.7, -2, -0.46), (3.2, 7, -0.55), (4.6, 12, -0.7)],
        0.1,
        MAT_LAVA_DIM,
        collection,
    )
    # The landmark belongs to the horizon, not the performer clearing. Its
    # missing crown keeps the silhouette geological rather than triumphal.
    add_arch(
        f"{prefix}_GateRightFragment",
        (1.4, 15.0, -0.4),
        7.0,
        9.2,
        2.6,
        0.06,
        1.18,
        MAT_BASALT,
        collection,
        24,
    )
    add_arch(
        f"{prefix}_GateLeftFragment",
        (1.4, 15.0, -0.4),
        7.0,
        9.2,
        2.6,
        1.54,
        math.pi - 0.2,
        MAT_BASALT_LIGHT,
        collection,
        26,
    )
    add_back_cliffs(prefix, collection, 23.5, 11)
    add_boulder_field(
        f"{prefix}_RiftBanks",
        collection,
        [
            (-11.5, -10.5, 1.8, 4.4, 3.6, 3.6),
            (-12.5, -2.0, 2.1, 4.8, 3.8, 4.2),
            (-10.0, 7.0, 1.7, 3.8, 3.2, 3.5),
            (11.8, -8.0, 1.5, 4.1, 3.3, 3.2),
            (12.6, 1.5, 2.0, 4.7, 3.6, 4.0),
            (10.8, 8.8, 1.6, 3.7, 3.0, 3.4),
        ],
    )
    add_ico(
        f"{prefix}_WestSentinel",
        (-17.0, 16.0, 5.0),
        (2.2, 2.0, 6.4),
        MAT_BASALT_LIGHT,
        collection,
        rotation=(0.0, -0.24, 0.16),
    )
    add_performer(prefix, collection)
    add_point_light(f"{prefix}_RiftLightNear", (1.0, -5.0, -0.1), 1200, collection, radius=6.0)
    add_point_light(f"{prefix}_GateLight", (1.4, 13.0, 3.2), 1250, collection, radius=6.5)


build_basalt_arch()
build_oculus_lava_tube()
build_faultline_causeway()
build_basalt_organ_canyon()
build_broken_rift_gate()


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_camera(
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    lens: float | None = None,
    ortho_scale: float | None = None,
) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    camera = bpy.data.objects.new(name, data)
    camera.location = location
    look_at(camera, target)
    data.clip_start = 0.05
    data.clip_end = 250
    if ortho_scale is not None:
        data.type = "ORTHO"
        data.ortho_scale = ortho_scale
    else:
        data.lens = lens or 42
        data.sensor_width = 36
    SHARED.objects.link(camera)
    return camera


CAMERAS = {
    "hero": add_camera("CAM_EmberSharedHero", (0, -21.5, 7.0), (0, 2.8, 2.0), lens=44),
    "oblique": add_camera("CAM_EmberSharedOblique", (12.5, -18.0, 8.0), (0, 2.0, 2.0), lens=44),
    "reverse": add_camera("CAM_EmberSharedReverse", (-12.5, 10.0, 7.5), (0, 0.5, 2.0), lens=44),
    "plan": add_camera("CAM_EmberSharedPlan", (0, 2.0, 48), (0, 2.0, 0), ortho_scale=45),
}

add_area_light(
    "Shared_Moon_Key",
    (-12, -12, 24),
    (0, 2, 0),
    5200,
    11,
    SHARED,
    (0.24, 0.42, 1.0),
)
add_area_light(
    "Shared_Ash_Fill",
    (14, -3, 12),
    (0, 3, 1),
    3100,
    9,
    SHARED,
    (0.18, 0.25, 0.46),
)
add_area_light(
    "Shared_Lava_Rim",
    (0, 17, 11),
    (0, 1, 1),
    2400,
    10,
    SHARED,
    (1.0, 0.11, 0.018),
)


def set_visible_option(active_option: str) -> None:
    for option_id, collection in OPTIONS.items():
        visible = option_id == active_option
        collection.hide_render = not visible
        collection.hide_viewport = not visible


render_paths: dict[str, dict[str, str]] = {}
for option_id in OPTION_IDS:
    set_visible_option(option_id)
    render_paths[option_id] = {}
    for camera_id, camera in CAMERAS.items():
        scene.camera = camera
        path = EVIDENCE_DIR / f"{option_id}-{camera_id}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        render_paths[option_id][camera_id] = str(path.relative_to(ROOT)).replace("\\", "/")

# Leave Direction A visible when Austen opens the file; every alternative is
# one collection toggle away and remains at the same coordinates.
set_visible_option("a-basalt-arch")
scene.camera = CAMERAS["hero"]
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


def collection_bounds(collection: bpy.types.Collection) -> dict[str, list[float]]:
    points: list[Vector] = []
    for obj in collection.all_objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return {"min": [0, 0, 0], "max": [0, 0, 0]}
    return {
        "min": [round(min(point[index] for point in points), 3) for index in range(3)],
        "max": [round(max(point[index] for point in points), 3) for index in range(3)],
    }


report = {
    "revision": "r1",
    "purpose": "Compare Ember spatial topologies before selecting a production direction.",
    "blenderVersion": bpy.app.version_string,
    "blendPath": str(BLEND_PATH.relative_to(ROOT)).replace("\\", "/"),
    "sharedContract": {
        "performerHeightMeters": 1.75,
        "clearActionRadiusMeters": 4.5,
        "heroCamera": {"position": [0, -21.5, 7], "target": [0, 2.8, 2], "lensMm": 44},
        "obliqueCamera": {"position": [12.5, -18, 8], "target": [0, 2, 2], "lensMm": 44},
        "reverseCamera": {"position": [-12.5, 10, 7.5], "target": [0, 0.5, 2], "lensMm": 44},
        "planCamera": {"position": [0, 2, 48], "target": [0, 2, 0], "orthoScale": 45},
        "renderResolution": [1280, 720],
    },
    "options": {
        option_id: {
            "collection": OPTIONS[option_id].name,
            "objectCount": len(OPTIONS[option_id].all_objects),
            "meshCount": sum(obj.type == "MESH" for obj in OPTIONS[option_id].all_objects),
            "lightCount": sum(obj.type == "LIGHT" for obj in OPTIONS[option_id].all_objects),
            "bounds": collection_bounds(OPTIONS[option_id]),
            "renders": render_paths[option_id],
        }
        for option_id in OPTION_IDS
    },
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

print(f"Saved editable Ember spatial exploration: {BLEND_PATH}")
print(f"Rendered {len(OPTION_IDS)} directions from {len(CAMERAS)} shared cameras")
print(f"Wrote verification report: {REPORT_PATH}")
