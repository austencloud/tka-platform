"""Build the deterministic Blender graybox for Vulcan Cave's Earth room."""

from __future__ import annotations

import json
import math
import os
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs/superpowers/specs/2026-08-08-earth-root-chasm-blender-plan.json"
BLEND_PATH = ROOT / "blender/earth-root-chasm-graybox.blend"
ARTIFACT_DIR = ROOT / "artifacts/earth-root-chasm-graybox"
REPORT_PATH = ROOT / "artifacts/earth-root-chasm-graybox-report.json"

with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
    manifest = json.load(handle)

contract = manifest["contract"]
source_digest = manifest["sourceDigest"]
rng = random.Random(20260808)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


reset_scene()
scene = bpy.context.scene
scene.name = contract["sceneName"]
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.use_file_extension = True
scene.world.color = (0.012, 0.016, 0.009)
scene.world.use_nodes = True
world_background = scene.world.node_tree.nodes.get("Background")
world_background.inputs["Color"].default_value = (0.012, 0.018, 0.009, 1)
world_background.inputs["Strength"].default_value = 0.16

collections: dict[str, bpy.types.Collection] = {}
for name in contract["collections"]:
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    collections[name] = collection


def move_to_collection(obj: bpy.types.Object, collection_name: str) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collections[collection_name].objects.link(obj)


def material(
    name: str,
    base: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = base
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


MAT_ROCK = material("EC_Rock", (0.19, 0.18, 0.13, 1), 0.96)
MAT_ROCK_WARM = material("EC_RockWarm", (0.31, 0.23, 0.13, 1), 0.91)
MAT_EARTH = material("EC_Earth", (0.19, 0.115, 0.055, 1), 1.0)
MAT_GULLY = material("EC_Gully", (0.11, 0.18, 0.07, 1), 0.98)
MAT_MOSS = material("EC_Moss", (0.12, 0.30, 0.08, 1), 0.94)
MAT_ROOT = material("EC_Root", (0.25, 0.115, 0.038, 1), 0.9)
MAT_SLAB = material("EC_Slab", (0.24, 0.19, 0.12, 1), 0.94)
MAT_BOSS = material("EC_Boss", (0.24, 0.22, 0.15, 1), 0.88)
MAT_VOID = material("EC_Void", (0.018, 0.016, 0.012, 1), 1.0)
MAT_G = material(
    "EC_PerformerG",
    (0.25, 0.55, 0.20, 1),
    0.63,
    0.08,
    (0.05, 0.30, 0.03, 1),
    0.65,
)
MAT_H = material(
    "EC_PerformerH",
    (0.71, 0.43, 0.12, 1),
    0.58,
    0.1,
    (0.38, 0.13, 0.02, 1),
    0.75,
)
MAT_I = material(
    "EC_PerformerI",
    (0.50, 0.67, 0.32, 1),
    0.60,
    0.08,
    (0.11, 0.31, 0.04, 1),
    0.65,
)
MAT_DAYLIGHT = material(
    "EC_DaylightGuide",
    (0.54, 0.73, 0.51, 1),
    0.65,
    0.0,
    (0.26, 0.56, 0.19, 1),
    1.3,
)
MAT_AIR = material(
    "EC_AirGuide",
    (0.20, 0.48, 0.62, 1),
    0.54,
    0.0,
    (0.12, 0.42, 0.72, 1),
    1.8,
)
MAT_LABEL = material(
    "EC_Label",
    (0.87, 0.84, 0.62, 1),
    0.52,
    0.0,
    (0.40, 0.32, 0.10, 1),
    0.9,
)
MAT_QA = material("QA_Magenta", (0.9, 0.03, 0.6, 1), 0.5)


def apply_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)


def bevel(obj: bpy.types.Object, width: float = 0.1, segments: int = 2) -> None:
    modifier = obj.modifiers.new("Edge softening", "BEVEL")
    modifier.width = width
    modifier.segments = segments


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    collection: str,
    bevel_width: float = 0.08,
    rotation_z: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0, 0, rotation_z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel_width > 0:
        bevel(obj, bevel_width)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    collection: str,
    vertices: int = 48,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    bevel(obj, min(0.1, depth * 0.16), 2)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_ico(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    collection: str,
    subdivisions: int = 1,
    rotation: tuple[float, float, float] | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation or (
        rng.uniform(-0.2, 0.2),
        rng.uniform(-0.2, 0.2),
        rng.uniform(0, math.tau),
    )
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, 0.08, 2)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    mat: bpy.types.Material,
    collection: str,
    vertices: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_ramp(
    name: str,
    authored: dict,
    mat: bpy.types.Material,
    collection: str,
    thickness: float = 0.35,
) -> bpy.types.Object:
    footprint = authored["blenderFootprint"]
    centre = footprint["centre"]
    half_x = footprint["sizeX"] / 2
    half_y = footprint["sizeY"] / 2
    x0, x1 = centre["x"] - half_x, centre["x"] + half_x
    y0, y1 = centre["y"] - half_y, centre["y"] + half_y
    z_from = authored["fromElevation"]
    z_to = authored["toElevation"]
    if authored["kind"] == "ramp-x":
        top = [(x0, y0, z_from), (x0, y1, z_from), (x1, y1, z_to), (x1, y0, z_to)]
    elif authored["kind"] == "ramp-y":
        # Plan min-Z is Blender max-Y, so `from` sits on y1.
        top = [(x0, y1, z_from), (x1, y1, z_from), (x1, y0, z_to), (x0, y0, z_to)]
    else:
        top = [(x0, y0, z_from), (x0, y1, z_from), (x1, y1, z_from), (x1, y0, z_from)]
    bottom_z = min(z_from, z_to) - thickness
    vertices = top + [(x, y, bottom_z) for x, y, _ in top]
    faces = [
        (0, 1, 2, 3),
        (7, 6, 5, 4),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collections[collection].objects.link(obj)
    bevel(obj, 0.07, 2)
    apply_material(obj, mat)
    return obj


def add_annulus(
    name: str,
    centre: tuple[float, float],
    inner_radius: float,
    outer_radius: float,
    top_z: float,
    depth: float,
    mat: bpy.types.Material,
    collection: str,
    segments: int = 96,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    for z in (top_z, top_z - depth):
        for radius in (inner_radius, outer_radius):
            for index in range(segments):
                angle = math.tau * index / segments
                vertices.append(
                    (
                        centre[0] + math.cos(angle) * radius,
                        centre[1] + math.sin(angle) * radius,
                        z,
                    )
                )
    top_inner = 0
    top_outer = segments
    bottom_inner = segments * 2
    bottom_outer = segments * 3
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((top_inner + index, top_outer + index, top_outer + nxt, top_inner + nxt))
        faces.append((bottom_inner + nxt, bottom_outer + nxt, bottom_outer + index, bottom_inner + index))
        faces.append((top_outer + index, bottom_outer + index, bottom_outer + nxt, top_outer + nxt))
        faces.append((top_inner + nxt, bottom_inner + nxt, bottom_inner + index, top_inner + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collections[collection].objects.link(obj)
    apply_material(obj, mat)
    bevel(obj, 0.08, 2)
    return obj


def add_chasm_wall(
    name: str,
    centre: tuple[float, float],
    radius: float,
    top_z: float,
    bottom_z: float,
    arc: dict,
    mat: bpy.types.Material,
    collection: str,
    segments: int = 88,
) -> bpy.types.Object:
    start = arc["start"]
    length = arc["length"]
    vertices: list[tuple[float, float, float]] = []
    for index in range(segments + 1):
        angle = start + length * index / segments
        rough_radius = radius + math.sin(index * 1.91) * 0.18 + math.sin(index * 0.47) * 0.12
        x = centre[0] + math.sin(angle) * rough_radius
        y = centre[1] + math.cos(angle) * rough_radius
        vertices.append((x, y, top_z + math.sin(index * 1.3) * 0.08))
        vertices.append((x, y, bottom_z + math.sin(index * 0.73) * 0.25))
    faces = [(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2) for i in range(segments)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collections[collection].objects.link(obj)
    apply_material(obj, mat)
    return obj


def add_tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    mat: bpy.types.Material,
    collection: str,
    resolution: int = 2,
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = resolution
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 2
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bezier, point in zip(spline.bezier_points, points):
        bezier.co = point
        bezier.handle_left_type = "AUTO"
        bezier.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    collections[collection].objects.link(obj)
    apply_material(obj, mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    obj.name = name
    return obj


def add_text_mesh(
    name: str,
    text: str,
    location: tuple[float, float, float],
    scale: float,
    mat: bpy.types.Material,
    collection: str,
) -> bpy.types.Object:
    bpy.ops.object.text_add(location=location, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.extrude = 0.055
    obj.data.bevel_depth = 0.018
    obj.scale = (scale, scale, scale)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    obj.name = name
    return obj


def add_light(
    name: str,
    kind: str,
    location: tuple[float, float, float],
    color: tuple[float, float, float],
    energy: float,
    size: float,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, type=kind)
    data.color = color
    data.energy = energy
    if kind == "AREA":
        data.shape = "DISK"
        data.size = size
    else:
        data.shadow_soft_size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    collections["QA_ONLY"].objects.link(obj)
    return obj


def aim_object(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera(
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    lens: float,
) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = 36
    data.dof.use_dof = False
    data.clip_start = 0.08
    data.clip_end = 250
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    aim_object(obj, target)
    collections["QA_ONLY"].objects.link(obj)
    return obj


# Measured route surfaces.
for segment in contract["gully"]:
    add_ramp(f"EC_Gully_{segment['id'].title()}", segment, MAT_GULLY, "GULLY", 0.42)

for item in (contract["overlook"]["ramp"], contract["overlook"]["apron"]):
    add_ramp(f"EC_Overlook_{item['id']}", item, MAT_SLAB, "OVERLOOK", 0.42)
add_ramp(
    "EC_Overlook_FracturedNose",
    contract["overlook"]["fracturedNose"],
    MAT_SLAB,
    "OVERLOOK",
    0.5,
)
for item in (contract["exit"]["ramp"], contract["exit"]["landing"]):
    add_ramp(f"EC_Exit_{item['id']}", item, MAT_ROCK_WARM, "OVERLOOK", 0.4)

void = contract["chamber"]["void"]
void_centre = (void["blenderCentre"]["x"], void["blenderCentre"]["y"])
rim_z = contract["chamber"]["rimElevation"]
floor = contract["chamber"]["floorDisc"]

# The circular chasm replaces the procedural room's rectangular-stage read.
add_annulus("EC_Chasm_RimRing", void_centre, void["radius"], 10.1, rim_z, 0.55, MAT_EARTH, "CHASM")
for band in contract["chamber"]["rimBands"]:
    fp = band["blenderFootprint"]
    add_box(
        f"EC_Rim_{band['id'].replace('-', '_')}",
        (fp["centre"]["x"], fp["centre"]["y"], rim_z - 0.26),
        (fp["sizeX"], fp["sizeY"], 0.52),
        MAT_EARTH,
        "CHASM",
        0.12,
    )

add_chasm_wall(
    "EC_Chasm_InnerWall",
    void_centre,
    void["radius"],
    rim_z - 0.16,
    floor["elevation"] - 1.25,
    void["wallArc"],
    MAT_ROCK,
    "CHASM",
)
add_cylinder(
    "EC_Chasm_PerformanceFloor",
    (floor["blenderCentre"]["x"], floor["blenderCentre"]["y"], floor["elevation"] - 0.32),
    floor["radius"],
    0.64,
    MAT_VOID,
    "CHASM",
    72,
)

# Broken ledges continue beneath the performance disc, so the canyon does not
# terminate in a flat bowl.
for index, radius in enumerate((8.2, 9.7, 11.4)):
    add_annulus(
        f"EC_Chasm_DeepLedge_{index + 1}",
        void_centre,
        radius - 0.7,
        radius,
        -10.5 - index * 3.7,
        0.55,
        MAT_ROCK,
        "CHASM",
        72,
    )

# Canyon strata north of the room keep the reveal open rather than ending on a wall.
for index, shelf in enumerate(contract["canyonShelves"]):
    fp = shelf["blenderFootprint"]
    add_box(
        f"EC_CanyonShelf_{index + 1}",
        (fp["centre"]["x"], fp["centre"]["y"], shelf["elevation"] - 0.6),
        (fp["sizeX"], fp["sizeY"], 1.2),
        MAT_ROCK,
        "CHASM",
        0.22,
    )

# Performer bosses and a unified, same-direction trio pose.
performer_materials = [MAT_G, MAT_H, MAT_I]
for index, performer in enumerate(contract["performers"]):
    x = performer["blenderCentre"]["x"]
    y = performer["blenderCentre"]["y"]
    boss_z = performer["bossElevation"]
    slug = performer["id"].upper()
    mat = performer_materials[index]
    add_cylinder(
        f"EC_Boss_{slug}",
        (x, y, boss_z - 0.28),
        performer["bossRadius"],
        0.56,
        MAT_BOSS,
        "BOSS_STATIONS",
        48,
    )
    add_cylinder(
        f"EC_BossRing_{slug}",
        (x, y, boss_z + 0.035),
        performer["bossRadius"] * 0.78,
        0.07,
        mat,
        "BOSS_STATIONS",
        48,
    )
    add_cylinder(
        f"EC_Performer_{slug}_Torso",
        (x, y, boss_z + 1.18),
        0.26,
        1.25,
        mat,
        "BOSS_STATIONS",
        10,
    )
    add_ico(
        f"EC_Performer_{slug}_Head",
        (x, y, boss_z + 2.02),
        (0.31, 0.28, 0.34),
        mat,
        "BOSS_STATIONS",
        2,
        (0, 0, 0),
    )
    # Every figure carries the same rising diagonal, making Together/Same read
    # as one ensemble before the letters are close enough to read.
    add_tube(
        f"EC_Performer_{slug}_LeadArm",
        [(x - 0.08, y, boss_z + 1.55), (x + 0.48, y - 0.03, boss_z + 1.9), (x + 0.93, y, boss_z + 2.28)],
        0.11,
        mat,
        "BOSS_STATIONS",
    )
    add_tube(
        f"EC_Performer_{slug}_TrailArm",
        [(x + 0.06, y, boss_z + 1.48), (x - 0.44, y + 0.02, boss_z + 1.2), (x - 0.86, y, boss_z + 0.95)],
        0.11,
        mat,
        "BOSS_STATIONS",
    )
    add_text_mesh(
        f"EC_Station_{slug}_Label",
        performer["label"],
        (x, y - 0.37, boss_z + 0.2),
        0.62,
        MAT_LABEL,
        "BOSS_STATIONS",
    )

# Root crown: stone-and-root buttresses rise from the rim and frame an open aven.
for index in range(11):
    angle = math.tau * index / 11 + 0.13
    if 1.1 < angle < 2.7:
        continue
    outer_radius = 9.4 + rng.uniform(-0.35, 0.35)
    crown_radius = 5.2 + rng.uniform(-0.25, 0.25)
    base = (
        void_centre[0] + math.cos(angle) * outer_radius,
        void_centre[1] + math.sin(angle) * outer_radius,
        rim_z - 0.25,
    )
    middle = (
        void_centre[0] + math.cos(angle + 0.08) * 7.2,
        void_centre[1] + math.sin(angle + 0.08) * 7.2,
        2.4 + rng.uniform(-0.4, 0.5),
    )
    crown = (
        void_centre[0] + math.cos(angle + 0.2) * crown_radius,
        void_centre[1] + math.sin(angle + 0.2) * crown_radius,
        6.4 + rng.uniform(-0.45, 0.75),
    )
    add_tube(
        f"EC_RootCrown_{index + 1:02d}",
        [base, middle, crown],
        0.36 + rng.uniform(-0.06, 0.09),
        MAT_ROOT,
        "ROOT_CROWN",
        3,
    )
    add_ico(
        f"EC_RootButtress_{index + 1:02d}",
        (base[0], base[1], rim_z + 0.2),
        (0.95, 0.58, 1.05 + rng.random() * 0.65),
        MAT_ROCK_WARM,
        "ROOT_CROWN",
        1,
    )

# Broken roof ring and daylight marker above the trio.
add_annulus("EC_Aven_RoofRing", void_centre, 4.9, 11.4, 4.1, 0.65, MAT_ROCK, "SHELL", 96)
for index in range(8):
    angle = math.tau * index / 8 + 0.2
    add_ico(
        f"EC_Aven_Fracture_{index + 1:02d}",
        (
            void_centre[0] + math.cos(angle) * 5.25,
            void_centre[1] + math.sin(angle) * 5.25,
            4.0 + rng.uniform(-0.25, 0.35),
        ),
        (1.9, 1.0, 0.75),
        MAT_ROCK_WARM,
        "SHELL",
        1,
    )
add_annulus(
    "EC_Aven_DaylightRing",
    void_centre,
    4.02,
    4.28,
    4.46,
    0.06,
    MAT_DAYLIGHT,
    "SHELL",
    72,
)

# Gully banks, low ceiling ribs, and vegetation. These deliberately tighten the
# entrance before the room opens at the reveal.
gully_bounds = contract["gully"]
for segment_index, segment in enumerate(gully_bounds):
    fp = segment["blenderFootprint"]
    cx, cy = fp["centre"]["x"], fp["centre"]["y"]
    sx, sy = fp["sizeX"], fp["sizeY"]
    if segment["kind"] == "ramp-x":
        count = max(4, round(sx / 1.15))
        for side in (-1, 1):
            for step in range(count + 1):
                x = cx - sx / 2 + sx * step / count
                y = cy + side * (sy / 2 + 1.0)
                z = segment["fromElevation"] + (segment["toElevation"] - segment["fromElevation"]) * step / count
                add_ico(
                    f"EC_GullyBank_{segment_index}_{side}_{step}",
                    (x + rng.uniform(-0.18, 0.18), y, z + 0.4 + rng.random() * 0.3),
                    (0.36 + rng.random() * 0.20, 0.33 + rng.random() * 0.16, 0.42 + rng.random() * 0.28),
                    MAT_ROCK_WARM if step % 3 == 0 else MAT_ROCK,
                    "GULLY",
                    1,
                )
    else:
        count = max(6, round(sy / 1.25))
        for side in (-1, 1):
            for step in range(count + 1):
                y = cy - sy / 2 + sy * step / count
                x = cx + side * (sx / 2 + 1.0)
                z = segment["toElevation"] + (segment["fromElevation"] - segment["toElevation"]) * step / count
                add_ico(
                    f"EC_GullyBank_{segment_index}_{side}_{step}",
                    (x, y + rng.uniform(-0.18, 0.18), z + 0.4 + rng.random() * 0.3),
                    (0.33 + rng.random() * 0.16, 0.36 + rng.random() * 0.20, 0.42 + rng.random() * 0.28),
                    MAT_ROCK_WARM if step % 3 == 0 else MAT_ROCK,
                    "GULLY",
                    1,
                )

# A stone screen terminates the Fire sightline at the measured turn. The route
# remains open on Blender +Y, where the gully bends north toward the reveal.
for index, y in enumerate((-1.9, -1.0, -0.1)):
    add_ico(
        f"EC_Gully_TurnScreen_{index + 1}",
        (-10.65 + rng.uniform(-0.12, 0.12), y, 0.35 + rng.random() * 0.22),
        (0.62 + rng.random() * 0.20, 0.48 + rng.random() * 0.16, 0.72 + rng.random() * 0.32),
        MAT_ROCK_WARM if index in {1, 4} else MAT_ROCK,
        "GULLY",
        1,
    )

for index, (x, y, z, cross_axis) in enumerate(
    [
        (-15.0, 0.0, 2.7, "y"),
        (-12.2, 0.0, 2.45, "y"),
        (-9.0, 3.2, 2.35, "x"),
        (-9.0, 7.3, 2.25, "x"),
        (-6.0, 10.0, 2.05, "y"),
    ]
):
    if cross_axis == "y":
        rib_points = [(x, y - 2.2, z - 1.2), (x, y, z + 0.55), (x, y + 2.2, z - 1.2)]
    else:
        rib_points = [(x - 2.2, y, z - 1.2), (x, y, z + 0.55), (x + 2.2, y, z - 1.2)]
    add_tube(
        f"EC_Gully_RootRib_{index + 1}",
        rib_points,
        0.28 + index * 0.018,
        MAT_ROOT,
        "GULLY",
    )

for index in range(54):
    segment = gully_bounds[index % len(gully_bounds)]
    fp = segment["blenderFootprint"]
    x = fp["centre"]["x"] + rng.uniform(-fp["sizeX"] * 0.44, fp["sizeX"] * 0.44)
    y = fp["centre"]["y"] + rng.choice((-1, 1)) * fp["sizeY"] * rng.uniform(0.31, 0.46)
    z = min(segment["fromElevation"], segment["toElevation"]) + 0.16
    add_cone(
        f"EC_Vegetation_{index + 1:03d}",
        (x, y, z + 0.17),
        0.11 + rng.random() * 0.09,
        0.0,
        0.34 + rng.random() * 0.35,
        MAT_MOSS,
        "VEGETATION_GUIDES",
        7,
    )

# Boulder parapet and room edge masses keep the rim tactile without rebuilding
# the old rectangular stage walls.
parapet = contract["chamber"]["parapet"]["blenderFootprint"]
for index in range(18):
    x = parapet["centre"]["x"] - parapet["sizeX"] / 2 + parapet["sizeX"] * index / 17
    add_ico(
        f"EC_ParapetBoulder_{index + 1:02d}",
        (x, parapet["centre"]["y"], rim_z + 0.34 + rng.random() * 0.22),
        (0.72 + rng.random() * 0.52, 0.55 + rng.random() * 0.32, 0.55 + rng.random() * 0.55),
        MAT_ROCK_WARM if index % 4 == 0 else MAT_ROCK,
        "SHELL",
        1,
    )

# Fracture seams on the overlook are geometry, not a texture placeholder.
nose = contract["overlook"]["fracturedNose"]["blenderFootprint"]
for index, offset in enumerate((-1.25, 0.15, 1.2)):
    add_box(
        f"EC_Overlook_Crack_{index + 1}",
        (nose["centre"]["x"] + offset, nose["centre"]["y"], -2.25 - index * 0.23),
        (0.09, nose["sizeY"] * 0.7, 0.06),
        MAT_VOID,
        "OVERLOOK",
        0.01,
        rng.uniform(-0.28, 0.28),
    )

# Air portal: the south-east ramp climbs toward a cool, unmistakable forward cue.
add_box("EC_AirPortal_NorthPier", (17.15, -8.65, 1.15), (0.85, 0.9, 3.3), MAT_ROCK, "SHELL", 0.15)
add_box("EC_AirPortal_SouthPier", (17.15, -12.35, 1.15), (0.85, 0.9, 3.3), MAT_ROCK, "SHELL", 0.15)
add_box("EC_AirPortal_Lintel", (17.15, -10.5, 2.85), (0.85, 4.6, 0.65), MAT_ROCK_WARM, "SHELL", 0.14)
add_box("EC_AirPortal_Glow", (17.22, -10.5, 1.35), (0.08, 2.2, 1.8), MAT_AIR, "SHELL", 0.02)

# Artist locators remain in the .blend and are excluded from the GLB.
for anchor_name, anchor in contract["route"].items():
    p = anchor["blender"]
    add_cylinder(
        f"LOC_{anchor_name}",
        (p["x"], p["y"], p["z"] + 0.025),
        0.25,
        0.05,
        MAT_QA,
        "LOCATORS",
        24,
    )

collections["LOCATORS"].hide_render = True
collections["REFERENCE"].hide_render = True

# Review lighting. Lights are QA-only and runtime lighting stays app-owned.
day = add_light("QA_AvenKey", "AREA", (void_centre[0], void_centre[1], 10.5), (0.67, 0.88, 0.58), 1850, 8.0)
aim_object(day, (void_centre[0], void_centre[1], -4.0))
rim_fill = add_light("QA_RimFill", "AREA", (-1.0, 5.8, 5.4), (0.82, 0.63, 0.34), 1250, 7.0)
aim_object(rim_fill, (5.0, 1.5, -2.5))
gully_light = add_light("QA_GullyFill", "AREA", (-10.0, 5.0, 2.8), (0.28, 0.62, 0.18), 900, 6.0)
aim_object(gully_light, (-9.0, 5.0, -0.6))
for index, performer in enumerate(contract["performers"]):
    p = performer["blenderCentre"]
    add_light(
        f"QA_Performer_{performer['id'].upper()}",
        "POINT",
        (p["x"], p["y"] - 0.4, p["z"] + 2.7),
        ((0.42, 0.82, 0.25), (0.98, 0.52, 0.16), (0.58, 0.78, 0.28))[index],
        470,
        1.6,
    )
exit_light = add_light("QA_AirExit", "AREA", (16.0, -10.2, 4.8), (0.48, 0.72, 0.95), 1000, 4.0)
aim_object(exit_light, (14.3, -9.6, -0.2))

# Review cameras prove the full route and the three-performer composition.
cameras = {
    "entry": add_camera("QA_Camera_Entry", (-15.1, 0.0, 1.52), (-11.2, 0.0, 0.45), 38),
    "reveal": add_camera("QA_Camera_Reveal", (-0.3, 7.75, 0.18), (6.25, -0.25, -5.4), 28),
    "trio": add_camera("QA_Camera_Trio", (6.25, 7.6, 0.16), (6.25, -0.25, -5.9), 43),
    "overlook": add_camera("QA_Camera_Overlook", (6.25, -4.55, 0.48), (6.25, -0.25, -5.85), 38),
    "air_exit": add_camera("QA_Camera_AirExit", (11.1, -10.5, 0.18), (17.1, -10.5, 1.15), 36),
    "overview": add_camera("QA_Camera_Overview", (20.0, -17.5, 17.0), (4.0, 1.2, -3.2), 46),
    "plan": add_camera("QA_Camera_Plan", (2.0, 0.5, 43.0), (2.0, 0.5, -2.0), 52),
}
cameras["plan"].data.type = "ORTHO"
cameras["plan"].data.ortho_scale = 47

# Save the artist file before rendering proof frames.
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

roof_render_objects = [
    bpy.data.objects.get("EC_Aven_RoofRing"),
    bpy.data.objects.get("EC_Aven_DaylightRing"),
]
for name, camera in cameras.items():
    hide_roof = name in {"overview", "plan"}
    for roof_object in roof_render_objects:
        if roof_object is not None:
            roof_object.hide_render = hide_roof
    scene.camera = camera
    scene.render.filepath = str(ARTIFACT_DIR / f"earth-root-chasm-{name}.png")
    bpy.ops.render.render(write_still=True)

mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
export_meshes = [obj for obj in mesh_objects if obj.name.startswith("EC_")]
performer_meshes = [obj.name for obj in export_meshes if obj.name.startswith("EC_Performer_")]
report = {
    "sceneName": contract["sceneName"],
    "sourceDigest": source_digest,
    "blendPath": str(BLEND_PATH.relative_to(ROOT)).replace(os.sep, "/"),
    "roomFootprint": {
        "width": contract["room"]["width"],
        "depth": contract["room"]["depth"],
    },
    "performerStations": len(contract["performers"]),
    "performerIds": [item["performerId"] for item in contract["performers"]],
    "performerMeshCount": len(performer_meshes),
    "exportMeshCount": len(export_meshes),
    "collectionObjectCounts": {
        name: len(collection.objects) for name, collection in collections.items()
    },
    "reviewRenders": [
        str((ARTIFACT_DIR / f"earth-root-chasm-{name}.png").relative_to(ROOT)).replace(os.sep, "/")
        for name in cameras
    ],
}
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
with REPORT_PATH.open("w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
    handle.write("\n")

print(json.dumps(report, indent=2, sort_keys=True))
