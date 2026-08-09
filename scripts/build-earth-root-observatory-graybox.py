"""Build the deterministic Gate 2 Blender graybox for Earth Root Observatory."""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "docs/superpowers/specs/earth-root-observatory"
MANIFEST_PATH = SPEC_DIR / "earth-root-observatory-gate2-blender-plan.json"
BLEND_PATH = ROOT / "blender/earth-root-observatory-graybox.blend"
RAW_GLB_PATH = ROOT / "artifacts/earth-root-observatory-graybox_raw.glb"
RENDER_DIR = SPEC_DIR / "gate2-renders"
REPORT_PATH = SPEC_DIR / "earth-root-observatory-gate2-report.json"
WALK_PATH = ROOT / "artifacts/earth-root-observatory-gate2-first-person-walk.mp4"
WALK_FRAMES_DIR = ROOT / "artifacts/earth-root-observatory-walk-frames"

with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
    manifest = json.load(handle)

contract = manifest["contract"]
source_digest = manifest["sourceDigest"]
sequence_fingerprints = manifest["sequenceFingerprints"]


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.fonts,
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
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.018, 0.023, 0.019, 1)
background.inputs["Strength"].default_value = 0.22

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
    color: tuple[float, float, float, float],
    roughness: float = 0.88,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color[:3], alpha)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color[:3], alpha)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1:
        if hasattr(result, "surface_render_method"):
            result.surface_render_method = "DITHERED"
        result.use_transparency_overlap = False
    return result


MAT_SHELL = material("ER_Shell", (0.20, 0.23, 0.21, 1))
MAT_BASIN = material("ER_Basin", (0.055, 0.045, 0.028, 1))
MAT_ROUTE = material("ER_Route", (0.25, 0.34, 0.24, 1), 0.82)
MAT_ROUTE_EDGE = material("ER_RouteEdge", (0.61, 0.72, 0.58, 1), 0.8)
MAT_STAGE = material("ER_Stage", (0.16, 0.12, 0.075, 1), 0.91)
MAT_TREE = material("ER_Tree", (0.35, 0.19, 0.08, 1), 0.94)
MAT_TREE_LIGHT = material("ER_TreeLight", (0.49, 0.31, 0.14, 1), 0.91)
MAT_CANOPY = material("ER_Canopy", (0.18, 0.35, 0.17, 1), 0.9)
MAT_G = material(
    "ER_G",
    (0.34, 0.72, 0.30, 1),
    0.58,
    (0.08, 0.38, 0.05, 1),
    0.7,
)
MAT_H = material(
    "ER_H",
    (0.85, 0.57, 0.18, 1),
    0.58,
    (0.45, 0.17, 0.03, 1),
    0.7,
)
MAT_I = material(
    "ER_I",
    (0.31, 0.61, 0.79, 1),
    0.58,
    (0.05, 0.24, 0.48, 1),
    0.7,
)
MAT_ROOT = material("ER_Root", (0.39, 0.24, 0.10, 1), 0.92)
MAT_AIR = material(
    "ER_Air",
    (0.38, 0.75, 0.94, 1),
    0.5,
    (0.10, 0.42, 0.72, 1),
    1.8,
)
MAT_FIRE = material(
    "ER_FireSeam",
    (0.42, 0.75, 0.31, 1),
    0.6,
    (0.13, 0.48, 0.06, 1),
    1.3,
)
MAT_INTERACTION = material(
    "ER_Interaction",
    (0.39, 0.55, 0.28, 1),
    0.72,
    (0.12, 0.25, 0.05, 1),
    0.4,
)
MAT_RECOGNITION = material(
    "ER_Recognition",
    (0.94, 0.78, 0.29, 1),
    0.45,
    (0.58, 0.33, 0.04, 1),
    1.0,
)
MAT_LABEL = material(
    "ER_Label",
    (0.93, 0.94, 0.86, 1),
    0.45,
    (0.45, 0.47, 0.36, 1),
    0.5,
)


def apply_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)


def bevel(obj: bpy.types.Object, width: float = 0.08, segments: int = 2) -> None:
    modifier = obj.modifiers.new("Graybox edge softening", "BEVEL")
    modifier.width = width
    modifier.segments = segments


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    collection: str,
    rotation_z: float = 0.0,
    bevel_width: float = 0.05,
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
    bevel(obj, min(0.08, depth * 0.15), 2)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius_bottom: float,
    radius_top: float,
    depth: float,
    mat: bpy.types.Material,
    collection: str,
    vertices: int = 20,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    bevel(obj, 0.08, 2)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_ico(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    collection: str,
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    collection: str,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    return obj


def add_curve(
    name: str,
    points: list[tuple[float, float, float]],
    bevel_depth: float,
    mat: bpy.types.Material,
    collection: str,
    cyclic: bool = False,
) -> bpy.types.Object:
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 2
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 3
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for index, point in enumerate(points):
        spline.points[index].co = (*point, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    collections[collection].objects.link(obj)
    apply_material(obj, mat)
    return obj


def add_radial_stage(
    name: str,
    centre: tuple[float, float, float],
    radius: float,
    height: float,
    mat: bpy.types.Material,
    lobes: int = 0,
    lobe_depth: float = 0.0,
) -> bpy.types.Object:
    """Create one closed, flat-topped stage with an optional lobed footprint."""
    x, y, bottom = centre
    top = bottom + height
    segments = 64
    vertices: list[tuple[float, float, float]] = [(x, y, bottom), (x, y, top)]
    for index in range(segments):
        angle = math.tau * index / segments
        multiplier = 1.0
        if lobes > 0:
            multiplier += lobe_depth * math.cos(lobes * angle)
        edge_radius = radius * multiplier
        edge_x = x + edge_radius * math.cos(angle)
        edge_y = y + edge_radius * math.sin(angle)
        vertices.extend([(edge_x, edge_y, bottom), (edge_x, edge_y, top)])

    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        following = (index + 1) % segments
        bottom_index = 2 + index * 2
        top_index = bottom_index + 1
        next_bottom = 2 + following * 2
        next_top = next_bottom + 1
        faces.extend(
            [
                (1, top_index, next_top),
                (0, next_bottom, bottom_index),
                (bottom_index, next_bottom, next_top, top_index),
            ]
        )

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collections["PERFORMERS"].objects.link(obj)
    bevel(obj, 0.06, 2)
    apply_material(obj, mat)
    return obj


def add_root_fin(occluder: dict) -> bpy.types.Object:
    """Keep the approved occluder volume while opening its upper corners."""
    centre = occluder["centre"]
    x, y = centre["x"], centre["y"]
    half_x = occluder["sizeX"] / 2
    half_y = occluder["sizeY"] / 2
    bottom = occluder["baseElevation"]
    top = occluder["topElevation"]
    if occluder["sizeY"] >= occluder["sizeX"]:
        vertices = [
            (x - half_x, y - half_y, bottom),
            (x + half_x, y - half_y, bottom),
            (x + half_x, y + half_y, bottom),
            (x - half_x, y + half_y, bottom),
            (x, y - half_y, top),
            (x, y + half_y, top),
        ]
        faces = [
            (0, 3, 2, 1),
            (0, 1, 4),
            (3, 5, 2),
            (0, 4, 5, 3),
            (1, 2, 5, 4),
        ]
    else:
        vertices = [
            (x - half_x, y - half_y, bottom),
            (x + half_x, y - half_y, bottom),
            (x + half_x, y + half_y, bottom),
            (x - half_x, y + half_y, bottom),
            (x - half_x, y, top),
            (x + half_x, y, top),
        ]
        faces = [
            (0, 3, 2, 1),
            (0, 1, 5, 4),
            (3, 4, 5, 2),
            (0, 4, 3),
            (1, 2, 5),
        ]
    mesh = bpy.data.meshes.new(f"ER_Occluder_{occluder['id']}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(mesh.name, mesh)
    collections["OCCLUDERS"].objects.link(obj)
    bevel(obj, 0.12, 2)
    apply_material(obj, MAT_ROOT)
    return obj


def add_text(
    name: str,
    text: str,
    location: tuple[float, float, float],
    size: float,
    mat: bpy.types.Material,
    collection: str = "REFERENCE",
    rotation: tuple[float, float, float] = (math.pi / 2, 0, 0),
) -> bpy.types.Object:
    data = bpy.data.curves.new(name, "FONT")
    data.body = text
    data.align_x = "CENTER"
    data.align_y = "CENTER"
    data.size = size
    data.extrude = 0.02
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    collections[collection].objects.link(obj)
    apply_material(obj, mat)
    return obj


def add_route_segment(segment: dict, index: int) -> bpy.types.Object:
    start = segment["from"]
    end = segment["to"]
    dx = end["x"] - start["x"]
    dy = end["y"] - start["y"]
    length = math.hypot(dx, dy)
    angle = math.atan2(dy, dx)
    width = segment["width"]
    thickness = 0.22
    centre = (
        (start["x"] + end["x"]) / 2,
        (start["y"] + end["y"]) / 2,
        (start["z"] + end["z"]) / 2 - thickness / 2,
    )
    rise = end["z"] - start["z"]
    run = max(length, 1e-6)
    obj = add_box(
        f"ER_Route_Segment_{index:02d}",
        centre,
        (math.hypot(run, rise) + 0.16, width, thickness),
        MAT_ROUTE,
        "ROUTE",
        rotation_z=0,
        bevel_width=0.04,
    )
    pitch = math.atan2(rise, run)
    obj.rotation_euler = (0, -pitch, angle)
    return obj


def add_wall_run(
    name: str,
    axis: str,
    fixed: float,
    start: float,
    end: float,
    base: float,
    top: float,
    thickness: float,
) -> bpy.types.Object | None:
    length = end - start
    if length <= 0.02:
        return None
    if axis == "x":
        location = ((start + end) / 2, fixed, (base + top) / 2)
        dimensions = (length, thickness, top - base)
    else:
        location = (fixed, (start + end) / 2, (base + top) / 2)
        dimensions = (thickness, length, top - base)
    return add_box(name, location, dimensions, MAT_SHELL, "SHELL", bevel_width=0.03)


def add_performer_stage(performer: dict) -> None:
    label = performer["label"]
    centre = performer["centre"]
    x, y, floor = centre["x"], centre["y"], centre["z"]
    stage_height = performer["stageHeight"]
    trace = performer["environmentTrace"]
    if trace == "ring":
        lobes, lobe_depth = 0, 0.0
    elif trace == "petal":
        lobes, lobe_depth = 4, 0.18
    else:
        lobes, lobe_depth = 4, 0.09
    stage = add_radial_stage(
        f"ER_Performer_{label}_Stage",
        (x, y, floor),
        performer["habitatRadius"] * 0.79,
        stage_height,
        MAT_STAGE,
        lobes,
        lobe_depth,
    )
    stage["performerId"] = performer["performerId"]
    stage["sequenceId"] = performer["sequenceId"]
    stage["letter"] = label
    stage["runtimeRepresentation"] = "MuseumPerformerStation3D"

    locator = bpy.data.objects.new(f"LOC_Performer_{label}", None)
    locator.location = (x, y, floor + stage_height)
    locator.empty_display_type = "ARROWS"
    locator.empty_display_size = 1.25
    locator["performerId"] = performer["performerId"]
    locator["sequenceId"] = performer["sequenceId"]
    collections["LOCATORS"].objects.link(locator)
    add_text(
        f"REF_Label_{label}",
        label,
        (x, y, floor + stage_height + 0.025),
        0.75,
        MAT_LABEL,
    )
    zone_z = floor + 0.06
    add_torus(
        f"ER_Interaction_{label}",
        (x, y, zone_z),
        performer["interactionRadius"],
        0.055,
        MAT_INTERACTION,
        "INTERACTIONS",
    )


room = contract["room"]
bounds = room["blenderBounds"]
base_z = room["performerFloorElevation"]
ceiling_z = room["ceilingElevation"]
wall_t = room["wallThickness"]

# The living basin under the visitor route.
add_box(
    "ER_Basin_Floor",
    (0, 0, base_z - 0.16),
    (room["width"], room["depth"], 0.32),
    MAT_BASIN,
    "SHELL",
    bevel_width=0,
)

# Four perimeter walls with the real Fire and Air door openings.
west_door = room["westDoor"]
south_door = room["southDoor"]
add_wall_run(
    "ER_Wall_West_North",
    "y",
    bounds["minX"],
    bounds["minY"],
    west_door["minY"],
    base_z,
    ceiling_z,
    wall_t,
)
add_wall_run(
    "ER_Wall_West_South",
    "y",
    bounds["minX"],
    west_door["maxY"],
    bounds["maxY"],
    base_z,
    ceiling_z,
    wall_t,
)
add_wall_run(
    "ER_Wall_East",
    "y",
    bounds["maxX"],
    bounds["minY"],
    bounds["maxY"],
    base_z,
    ceiling_z,
    wall_t,
)
add_wall_run(
    "ER_Wall_North",
    "x",
    bounds["maxY"],
    bounds["minX"],
    bounds["maxX"],
    base_z,
    ceiling_z,
    wall_t,
)
add_wall_run(
    "ER_Wall_South_West",
    "x",
    bounds["minY"],
    bounds["minX"],
    south_door["minX"],
    base_z,
    ceiling_z,
    wall_t,
)
add_wall_run(
    "ER_Wall_South_East",
    "x",
    bounds["minY"],
    south_door["maxX"],
    bounds["maxX"],
    base_z,
    ceiling_z,
    wall_t,
)

# Roof panels leave the approved opening around the tree.
tree = contract["tree"]
hole = tree["ceilingBreakRadius"]
hole_min_x = max(bounds["minX"], tree["centre"]["x"] - hole)
hole_max_x = min(bounds["maxX"], tree["centre"]["x"] + hole)
hole_min_y = max(bounds["minY"], tree["centre"]["y"] - hole)
hole_max_y = min(bounds["maxY"], tree["centre"]["y"] + hole)
roof_t = 0.32

def roof_panel(name: str, min_x: float, max_x: float, min_y: float, max_y: float) -> None:
    if max_x <= min_x or max_y <= min_y:
        return
    add_box(
        name,
        ((min_x + max_x) / 2, (min_y + max_y) / 2, ceiling_z + roof_t / 2),
        (max_x - min_x, max_y - min_y, roof_t),
        MAT_SHELL,
        "SHELL",
        bevel_width=0.02,
    )

roof_panel("ER_Roof_West", bounds["minX"], hole_min_x, bounds["minY"], bounds["maxY"])
roof_panel("ER_Roof_East", hole_max_x, bounds["maxX"], bounds["minY"], bounds["maxY"])
roof_panel("ER_Roof_North", hole_min_x, hole_max_x, hole_max_y, bounds["maxY"])
roof_panel("ER_Roof_South", hole_min_x, hole_max_x, bounds["minY"], hole_min_y)
add_torus(
    "ER_Roof_Break_Ring",
    (tree["centre"]["x"], tree["centre"]["y"], ceiling_z + 0.12),
    hole,
    0.16,
    MAT_ROUTE_EDGE,
    "TREE",
)

# Route ribbon and joints come directly from the approved polyline.
for index, segment in enumerate(contract["route"]["segments"], start=1):
    add_route_segment(segment, index)
for index, point in enumerate(contract["route"]["path"], start=1):
    add_cylinder(
        f"ER_Route_Joint_{index:02d}",
        (point["x"], point["y"], point["z"] - 0.11),
        contract["route"]["width"] / 2,
        0.22,
        MAT_ROUTE,
        "ROUTE",
        32,
    )
for stop in contract["stops"]:
    point = stop["position"]
    add_text(
        f"REF_Stop_{stop['number']}",
        str(stop["number"]),
        (point["x"], point["y"], point["z"] + 0.03),
        0.44,
        MAT_LABEL,
    )

# The hero tree deliberately exceeds the ceiling so its hierarchy is testable.
trunk_bottom = base_z
trunk_top = 9.2
trunk_height = trunk_top - trunk_bottom
add_cone(
    "ER_Hero_Tree_Trunk",
    (
        tree["centre"]["x"],
        tree["centre"]["y"],
        (trunk_bottom + trunk_top) / 2,
    ),
    tree["trunkRadius"] * 0.76,
    tree["trunkRadius"] * 0.44,
    trunk_height,
    MAT_TREE,
    "TREE",
    24,
)
for index, (dx, dy, dz, length, radius) in enumerate(
    [
        (-3.6, 0.8, 9.8, 7.2, 0.52),
        (3.3, 1.4, 10.8, 6.6, 0.48),
        (0.8, -3.2, 11.8, 5.8, 0.42),
        (-1.0, 2.8, 12.5, 5.2, 0.38),
    ],
    start=1,
):
    start = Vector((tree["centre"]["x"], tree["centre"]["y"], 7.4 + index * 0.5))
    end = Vector((tree["centre"]["x"] + dx, tree["centre"]["y"] + dy, dz))
    direction = end - start
    midpoint = (start + end) / 2
    branch = add_cylinder(
        f"ER_Hero_Tree_Branch_{index}",
        tuple(midpoint),
        radius,
        direction.length,
        MAT_TREE_LIGHT,
        "TREE",
        16,
    )
    branch.rotation_mode = "QUATERNION"
    branch.rotation_quaternion = direction.to_track_quat("Z", "Y")

for index, offset in enumerate(
    [
        (-3.2, 0.8, 11.7, 3.2, 2.4, 2.0),
        (2.5, 1.3, 12.4, 3.5, 2.6, 2.2),
        (0.6, -2.7, 13.1, 3.0, 2.4, 2.0),
        (-0.7, 2.6, 13.8, 2.8, 2.3, 1.8),
        (0.2, 0.2, 14.2, 3.4, 2.8, 1.4),
    ],
    start=1,
):
    dx, dy, z, sx, sy, sz = offset
    add_ico(
        f"ER_Hero_Tree_Canopy_{index}",
        (tree["centre"]["x"] + dx, tree["centre"]["y"] + dy, z),
        (sx, sy, sz),
        MAT_CANOPY,
        "TREE",
        2,
    )

# Root fins fill the approved occluder volumes without becoming solid walls.
for occluder in contract["occluders"]:
    add_root_fin(occluder)

# Flat motif stages carry locators for the live runtime avatar system.
performer_materials = {"G": MAT_G, "H": MAT_H, "I": MAT_I}
for performer in contract["performers"]:
    add_performer_stage(performer)
    centre = performer["centre"]
    trace_z = centre["z"] + performer["stageHeight"] + 0.025
    mat = performer_materials[performer["label"]]
    if performer["environmentTrace"] in ("ring", "ring-and-petal"):
        add_torus(
            f"ER_Trace_{performer['label']}_Ring",
            (centre["x"], centre["y"], trace_z),
            1.55,
            0.075,
            mat,
            "ROOT_TRACES",
        )
    if performer["environmentTrace"] in ("petal", "ring-and-petal"):
        petals: list[tuple[float, float, float]] = []
        for index in range(97):
            angle = math.tau * index / 96
            radius = 1.45 * math.cos(2 * angle)
            petals.append(
                (
                    centre["x"] + radius * math.cos(angle),
                    centre["y"] + radius * math.sin(angle),
                    trace_z + 0.025,
                )
            )
        add_curve(
            f"ER_Trace_{performer['label']}_Petal",
            petals,
            0.075,
            mat,
            "ROOT_TRACES",
            True,
        )
    add_curve(
        f"ER_Root_Link_{performer['label']}",
        [
            (centre["x"], centre["y"], trace_z),
            (
                (centre["x"] + tree["centre"]["x"]) / 2,
                (centre["y"] + tree["centre"]["y"]) / 2,
                base_z + 0.22,
            ),
            (tree["centre"]["x"], tree["centre"]["y"], base_z + 0.18),
        ],
        0.11,
        MAT_ROOT,
        "ROOT_TRACES",
    )

recognition = contract["recognitionZone"]
add_cylinder(
    "ER_Recognition_Platform",
    (
        recognition["centre"]["x"],
        recognition["centre"]["y"],
        recognition["centre"]["z"] - 0.09,
    ),
    recognition["radius"],
    0.18,
    MAT_STAGE,
    "INTERACTIONS",
    64,
)
add_torus(
    "ER_Recognition_Zone",
    (
        recognition["centre"]["x"],
        recognition["centre"]["y"],
        recognition["centre"]["z"] + 0.045,
    ),
    recognition["radius"],
    0.075,
    MAT_RECOGNITION,
    "INTERACTIONS",
)
add_torus(
    "ER_Recognition_Stand_Mark",
    (
        recognition["centre"]["x"],
        recognition["centre"]["y"],
        recognition["centre"]["z"] + 0.047,
    ),
    0.62,
    0.055,
    MAT_RECOGNITION,
    "INTERACTIONS",
)

# Three retained root seams ride the last approach and terminate at the place
# where the room can finally be read as one composition.
guide_start = contract["route"]["path"][8]
guide_end = recognition["centre"]
guide_dx = guide_end["x"] - guide_start["x"]
guide_dy = guide_end["y"] - guide_start["y"]
guide_length = math.hypot(guide_dx, guide_dy)
guide_perp_x = -guide_dy / guide_length
guide_perp_y = guide_dx / guide_length
for label, offset, mat in (
    ("G", -0.42, MAT_G),
    ("H", 0.0, MAT_H),
    ("I", 0.42, MAT_I),
):
    points: list[tuple[float, float, float]] = []
    for fraction in (0.0, 0.42, 0.76, 1.0):
        taper = 1.0 - fraction
        points.append(
            (
                guide_start["x"] + guide_dx * fraction + guide_perp_x * offset * taper,
                guide_start["y"] + guide_dy * fraction + guide_perp_y * offset * taper,
                guide_start["z"]
                + (guide_end["z"] - guide_start["z"]) * fraction
                + 0.045,
            )
        )
    add_curve(
        f"ER_Recognition_Guide_{label}",
        points,
        0.045,
        mat,
        "ROOT_TRACES",
    )

# Door cues make the Fire-to-Earth-to-Air direction readable without dressing.
add_box(
    "ER_Fire_Threshold_Cue",
    (bounds["minX"] + 0.18, (west_door["minY"] + west_door["maxY"]) / 2, 1.4),
    (0.12, west_door["width"] * 0.82, 2.8),
    MAT_FIRE,
    "REFERENCE",
    bevel_width=0.02,
)
add_box(
    "ER_Air_Threshold_Cue",
    ((south_door["minX"] + south_door["maxX"]) / 2, bounds["minY"] + 0.18, 1.8),
    (south_door["width"] * 0.82, 0.12, 3.6),
    MAT_AIR,
    "REFERENCE",
    bevel_width=0.02,
)


def add_camera(camera_spec: dict) -> bpy.types.Object:
    data = bpy.data.cameras.new(camera_spec["name"])
    data.sensor_fit = "HORIZONTAL"
    data.angle = math.radians(camera_spec["horizontalFovDegrees"])
    if camera_spec["type"] == "orthographic":
        data.type = "ORTHO"
        data.ortho_scale = camera_spec["orthographicScale"]
    obj = bpy.data.objects.new(camera_spec["name"], data)
    obj.location = (
        camera_spec["position"]["x"],
        camera_spec["position"]["y"],
        camera_spec["position"]["z"],
    )
    target = Vector(
        (
            camera_spec["target"]["x"],
            camera_spec["target"]["y"],
            camera_spec["target"]["z"],
        )
    )
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()
    collections["CAMERAS"].objects.link(obj)
    return obj


cameras = {camera["id"]: add_camera(camera) for camera in contract["cameras"]}


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    color: tuple[float, float, float],
    size: float,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    collections["LIGHTS"].objects.link(obj)
    return obj


key = add_area_light(
    "QA_Light_Roof",
    (tree["centre"]["x"], tree["centre"]["y"], ceiling_z + 7.5),
    1450,
    (0.78, 0.91, 0.73),
    8.5,
)
key.rotation_euler = (0, 0, 0)
fill = add_area_light(
    "QA_Light_South_Fill",
    (1.0, bounds["minY"] + 3.0, 5.2),
    900,
    (0.48, 0.64, 0.52),
    10,
)
fill.rotation_euler = (math.radians(18), 0, math.pi)
for performer in contract["performers"]:
    data = bpy.data.lights.new(f"QA_Light_{performer['label']}", "POINT")
    data.energy = 250
    data.color = {
        "G": (0.42, 0.80, 0.34),
        "H": (1.0, 0.58, 0.20),
        "I": (0.32, 0.68, 1.0),
    }[performer["label"]]
    data.shadow_soft_size = 2.2
    obj = bpy.data.objects.new(data.name, data)
    obj.location = (
        performer["centre"]["x"],
        performer["centre"]["y"],
        performer["centre"]["z"] + 3.4,
    )
    collections["LIGHTS"].objects.link(obj)

# Animate a real eye-height route camera with measured walking time and short review dwells.
walk_data = bpy.data.cameras.new("QA_Camera_FirstPerson_Walk")
walk_data.sensor_fit = "HORIZONTAL"
walk_data.angle = math.radians(75)
walk_camera = bpy.data.objects.new("QA_Camera_FirstPerson_Walk", walk_data)
collections["CAMERAS"].objects.link(walk_camera)
walk_camera.rotation_mode = "QUATERNION"
scene.render.fps = 12
fps = scene.render.fps
eye_height = 1.6
focus_targets = {
    2: (tree["centre"]["x"], tree["centre"]["y"], 4.2),
    3: (
        contract["performers"][0]["centre"]["x"],
        contract["performers"][0]["centre"]["y"],
        base_z + contract["performers"][0]["stageHeight"] + 0.9,
    ),
    5: (
        contract["performers"][1]["centre"]["x"],
        contract["performers"][1]["centre"]["y"],
        base_z + contract["performers"][1]["stageHeight"] + 0.9,
    ),
    7: (
        contract["performers"][2]["centre"]["x"],
        contract["performers"][2]["centre"]["y"],
        base_z + contract["performers"][2]["stageHeight"] + 0.9,
    ),
    9: (
        contract["cameras"][5]["target"]["x"],
        contract["cameras"][5]["target"]["y"],
        contract["cameras"][5]["target"]["z"],
    ),
}
frame = 1
route_points = contract["route"]["path"]
for index, point in enumerate(route_points):
    if index > 0:
        previous = route_points[index - 1]
        distance = math.hypot(point["x"] - previous["x"], point["y"] - previous["y"])
        frame += max(1, round((distance / contract["route"]["reviewSpeed"]) * fps))
    walk_camera.location = (point["x"], point["y"], point["z"] + eye_height)
    if index in focus_targets:
        target = Vector(focus_targets[index])
    elif index < len(route_points) - 1:
        next_point = route_points[index + 1]
        target = Vector((next_point["x"], next_point["y"], next_point["z"] + eye_height))
    else:
        target = Vector((point["x"], point["y"] - 3.0, point["z"] + eye_height))
    direction = target - walk_camera.location
    walk_camera.rotation_quaternion = direction.to_track_quat("-Z", "Y")
    walk_camera.keyframe_insert("location", frame=frame)
    walk_camera.keyframe_insert("rotation_quaternion", frame=frame)
    if index in focus_targets:
        frame += round(1.2 * fps)
        walk_camera.keyframe_insert("location", frame=frame)
        walk_camera.keyframe_insert("rotation_quaternion", frame=frame)

if walk_camera.animation_data and walk_camera.animation_data.action:
    action = walk_camera.animation_data.action
    # Blender 5 stores channel bags on layered actions instead of exposing the
    # legacy fcurves collection. The authored keyframes remain valid either way.
    for curve in getattr(action, "fcurves", []):
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"
scene.frame_start = 1
scene.frame_end = frame

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
RAW_GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
RENDER_DIR.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

# Fixed camera evidence. Hide the roof only for overview and plan frames.
roof_objects = [obj for obj in collections["SHELL"].objects if obj.name.startswith("ER_Roof_")]
canopy_objects = [obj for obj in collections["TREE"].objects if obj.name.startswith("ER_Hero_Tree_Canopy_")]
rendered_frames: list[str] = []
for camera_id, camera in cameras.items():
    for roof in roof_objects:
        roof.hide_render = camera_id in {"overview", "plan"}
    for canopy in canopy_objects:
        canopy.hide_render = camera_id == "plan"
    scene.camera = camera
    output = RENDER_DIR / f"earth-root-observatory-{camera_id}.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    rendered_frames.append(str(output.relative_to(ROOT)).replace("\\", "/"))
for roof in roof_objects:
    roof.hide_render = False
for canopy in canopy_objects:
    canopy.hide_render = False

# The web GLB contains only ER_ geometry. QA cameras, lights, and text references stay in Blender.
bpy.ops.object.select_all(action="DESELECT")
export_objects = [obj for obj in scene.objects if obj.name.startswith("ER_")]
for obj in export_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = export_objects[0]
bpy.ops.export_scene.gltf(
    filepath=str(RAW_GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_apply=True,
)

walk_duration_seconds = scene.frame_end / scene.render.fps
if os.environ.get("ER_RENDER_WALKTHROUGH", "1") == "1":
    resolved_frames_dir = WALK_FRAMES_DIR.resolve()
    resolved_artifacts_dir = (ROOT / "artifacts").resolve()
    if resolved_frames_dir.parent != resolved_artifacts_dir:
        raise RuntimeError(f"Unsafe walkthrough frame directory: {resolved_frames_dir}")
    if WALK_FRAMES_DIR.exists():
        shutil.rmtree(WALK_FRAMES_DIR)
    WALK_FRAMES_DIR.mkdir(parents=True)
    scene.camera = walk_camera
    scene.render.resolution_x = 768
    scene.render.resolution_y = 432
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = str(WALK_FRAMES_DIR / "frame_")
    bpy.ops.render.render(animation=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(WALK_FRAMES_DIR / "frame_%04d.png"),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(WALK_PATH),
        ],
        check=True,
    )
    shutil.rmtree(WALK_FRAMES_DIR)

report = {
    "schemaVersion": 1,
    "sceneId": "earth-root-observatory",
    "gate": 2,
    "sourceDigest": source_digest,
    "roomFootprint": {"width": room["width"], "depth": room["depth"]},
    "route": {
        "width": contract["route"]["width"],
        "length": contract["route"]["length"],
        "walkingDurationSeconds": contract["route"]["walkingDurationSeconds"],
        "capturedDurationSeconds": walk_duration_seconds,
        "segments": len(contract["route"]["segments"]),
    },
    "performerCount": len(contract["performers"]),
    "performerRepresentation": "runtime-avatar",
    "performerIds": [item["performerId"] for item in contract["performers"]],
    "sequenceIds": [item["sequenceId"] for item in contract["performers"]],
    "stageHeights": [item["stageHeight"] for item in contract["performers"]],
    "sequenceFingerprints": sequence_fingerprints,
    "reviewCameras": [camera["id"] for camera in contract["cameras"]],
    "renderedFrames": rendered_frames,
    "exportObjectCount": len(export_objects),
    "blendPath": str(BLEND_PATH.relative_to(ROOT)).replace("\\", "/"),
    "rawGlbPath": str(RAW_GLB_PATH.relative_to(ROOT)).replace("\\", "/"),
    "walkPath": str(WALK_PATH.relative_to(ROOT)).replace("\\", "/"),
}
with REPORT_PATH.open("w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
    handle.write("\n")

print(json.dumps(report, indent=2, sort_keys=True))
