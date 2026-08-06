"""Build the standalone First Fire Torch Procession graybox in Blender.

The measured TypeScript plan is exported first to a hash-stamped JSON contract.
This script verifies that digest, creates an editable Blender scene, and renders
the six review views required by the handoff. It never opens or modifies the
shared interactive Blender scene.

Run from the repository root:

  pnpm exec tsx scripts/export-first-fire-blender-plan.ts
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background --factory-startup ^
    --python scripts/build-first-fire-graybox.py

Outputs:
  blender/first-fire-torch-procession-graybox.blend
  %TEMP%/tka-first-fire-graybox-evidence/*.png
  artifacts/first-fire-graybox-report.json
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import random
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = (
    ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "2026-08-06-first-fire-blender-plan.json"
)
BLEND_PATH = ROOT / "blender" / "first-fire-torch-procession-graybox.blend"
REPORT_PATH = ROOT / "artifacts" / "first-fire-graybox-report.json"
QA_DIR = Path(tempfile.gettempdir()) / "tka-first-fire-graybox-evidence"
RNG = random.Random(0xF1F1)


def load_contract() -> tuple[dict, str]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    contract = manifest["contract"]
    canonical = json.dumps(
        contract,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if digest != manifest["sourceDigest"]:
        raise RuntimeError(
            "First Fire Blender manifest digest mismatch. "
            "Regenerate it from the TypeScript plan before building."
        )
    return contract, digest


CONTRACT, SOURCE_DIGEST = load_contract()
ROOM = CONTRACT["room"]
ROOM_BOUNDS = ROOM["blenderBounds"]

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = CONTRACT["sceneName"]
scene["first_fire_contract_schema"] = CONTRACT["schemaVersion"]
scene["first_fire_source_digest"] = SOURCE_DIGEST
scene["first_fire_source_module"] = CONTRACT["sourceModule"]
scene["first_fire_runtime_mount"] = CONTRACT["coordinateSystem"]["gltfRuntime"][
    "mount"
]
scene["first_fire_axis_transform"] = CONTRACT["coordinateSystem"]["gltfRuntime"][
    "exporterTransform"
]


def create_collection(
    name: str, parent: bpy.types.Collection | None = None
) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(result)
    return result


export_root = create_collection("EXPORT_FirstFire")
COLLECTIONS = {
    name: create_collection(name, export_root)
    for name in CONTRACT["collections"]
    if name not in ("REFERENCE", "LOCATORS", "QA_ONLY")
}
COLLECTIONS["REFERENCE"] = create_collection("REFERENCE")
COLLECTIONS["LOCATORS"] = create_collection("LOCATORS")
COLLECTIONS["QA_ONLY"] = create_collection("QA_ONLY")


def move_to_collection(
    obj: bpy.types.Object, target: bpy.types.Collection
) -> bpy.types.Object:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.8,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = color
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission:
            bsdf.inputs["Emission Color"].default_value = emission
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        if color[3] < 1.0:
            bsdf.inputs["Alpha"].default_value = color[3]
            try:
                result.surface_render_method = "DITHERED"
            except AttributeError:
                pass
    return result


BASALT = material("FF Basalt", (0.075, 0.068, 0.064, 1.0), roughness=0.95)
BASALT_DARK = material(
    "FF Basalt Shadow", (0.026, 0.025, 0.027, 1.0), roughness=0.98
)
BASALT_EDGE = material(
    "FF Fractured Edge", (0.145, 0.125, 0.105, 1.0), roughness=0.9
)
PATH_STONE = material(
    "FF Walkable Stone", (0.20, 0.17, 0.14, 1.0), roughness=0.92
)
PATH_STEAM = material(
    "FF Steam Threshold", (0.18, 0.32, 0.38, 1.0), roughness=0.65
)
PATH_BRIDGE = material(
    "FF Ember Bridge", (0.30, 0.16, 0.075, 1.0), roughness=0.82
)
PATH_GROWTH = material(
    "FF Earth Growth", (0.035, 0.22, 0.055, 1.0), roughness=0.84,
    emission=(0.015, 0.22, 0.03, 1.0), emission_strength=0.45
)
MAGMA = material(
    "FF Magma Placeholder", (0.78, 0.055, 0.012, 1.0), roughness=0.42,
    emission=(1.0, 0.025, 0.002, 1.0), emission_strength=3.4
)
EMBER = material(
    "FF Ember Placeholder", (0.48, 0.038, 0.006, 1.0), roughness=0.55,
    emission=(1.0, 0.055, 0.004, 1.0), emission_strength=2.4
)
WOOD = material("FF Charred Torch Wood", (0.055, 0.023, 0.012, 1.0), roughness=0.93)
DJ_FLAME = material(
    "FF DJ Flame Guide", (1.0, 0.18, 0.015, 1.0), roughness=0.3,
    emission=(1.0, 0.035, 0.002, 1.0), emission_strength=2.8
)
EK_FLAME = material(
    "FF EK Flame Guide", (1.0, 0.33, 0.015, 1.0), roughness=0.3,
    emission=(1.0, 0.085, 0.002, 1.0), emission_strength=2.8
)
FL_FLAME = material(
    "FF FL Flame Guide", (0.95, 0.07, 0.025, 1.0), roughness=0.3,
    emission=(1.0, 0.012, 0.003, 1.0), emission_strength=2.8
)
STEAM = material(
    "FF Steam", (0.16, 0.34, 0.40, 1.0), roughness=0.55,
    emission=(0.05, 0.20, 0.25, 1.0), emission_strength=0.3
)
GROWTH = material(
    "FF Moss Growth", (0.055, 0.43, 0.08, 1.0), roughness=0.86,
    emission=(0.02, 0.25, 0.035, 1.0), emission_strength=0.7
)
LOCATOR_DJ = material("DJ Locator", (0.96, 0.78, 0.40, 1.0), roughness=0.6)
LOCATOR_EK = material("EK Locator", (0.86, 0.64, 0.30, 1.0), roughness=0.6)
LOCATOR_FL = material("FL Locator", (0.98, 0.54, 0.25, 1.0), roughness=0.6)
REFERENCE_CYAN = material(
    "QA Coordinate Reference", (0.04, 0.75, 0.95, 0.55), roughness=0.4
)
SIGHTLINE_RED = material(
    "QA Sightline", (0.95, 0.05, 0.05, 0.65), roughness=0.4,
    emission=(0.65, 0.01, 0.01, 1.0), emission_strength=1.0
)


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.type == "MESH":
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    bevel: float = 0.0,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    move_to_collection(obj, target)
    if bevel:
        modifier = obj.modifiers.new(name="Fractured edge softening", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, mat)
    return move_to_collection(obj, target)


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    vertices: int = 10,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
    )
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, mat)
    return move_to_collection(obj, target)


def add_rock(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=1,
        radius=1.0,
        location=location,
        rotation=(
            RNG.uniform(-0.25, 0.25),
            RNG.uniform(-0.25, 0.25),
            RNG.uniform(-math.pi, math.pi),
        ),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return move_to_collection(obj, target)


def add_ring(
    name: str,
    centre: tuple[float, float],
    inner_radius: float,
    outer_radius: float,
    z: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    segments: int = 96,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments):
        angle = math.tau * index / segments
        cosine = math.cos(angle)
        sine = math.sin(angle)
        vertices.append(
            (centre[0] + cosine * inner_radius, centre[1] + sine * inner_radius, z)
        )
        vertices.append(
            (centre[0] + cosine * outer_radius, centre[1] + sine * outer_radius, z)
        )
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index * 2, following * 2, following * 2 + 1, index * 2 + 1))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    solidify = obj.modifiers.new(name="Trench depth", type="SOLIDIFY")
    solidify.thickness = 0.12
    return obj


def add_ribbon(
    name: str,
    points: list[dict],
    width: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    half = width / 2
    for index, point in enumerate(points):
        previous = points[max(0, index - 1)]
        following = points[min(len(points) - 1, index + 1)]
        tangent_x = following["x"] - previous["x"]
        tangent_y = following["y"] - previous["y"]
        length = math.hypot(tangent_x, tangent_y) or 1.0
        normal_x = -tangent_y / length
        normal_y = tangent_x / length
        vertices.append(
            (
                point["x"] + normal_x * half,
                point["y"] + normal_y * half,
                point["z"],
            )
        )
        vertices.append(
            (
                point["x"] - normal_x * half,
                point["y"] - normal_y * half,
                point["z"],
            )
        )
    for index in range(len(points) - 1):
        base = index * 2
        faces.append((base, base + 2, base + 3, base + 1))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    solidify = obj.modifiers.new(name="Walkable surface thickness", type="SOLIDIFY")
    solidify.thickness = 0.06
    bevel = obj.modifiers.new(name="Walkable edge softening", type="BEVEL")
    bevel.width = 0.06
    bevel.segments = 2
    return obj


def plan_to_blender(x: float, z: float, elevation: float = 0.0) -> Vector:
    centre = ROOM["planCentre"]
    return Vector((x - centre["x"], centre["z"] - z, elevation))


def add_curve_between(
    name: str,
    start: Vector,
    end: Vector,
    bevel_depth: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(1)
    spline.points[0].co = (*start, 1.0)
    spline.points[1].co = (*end, 1.0)
    obj = bpy.data.objects.new(name, curve)
    target.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_text(
    name: str,
    body: str,
    location: tuple[float, float, float],
    size: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.025
    obj.data.bevel_depth = 0.006
    obj.data.materials.append(mat)
    return move_to_collection(obj, target)


def unit_cylinder_mesh(
    name: str, mat: bpy.types.Material, segments: int = 8
) -> bpy.types.Mesh:
    vertices = []
    for z in (-0.5, 0.5):
        for index in range(segments):
            angle = math.tau * index / segments
            vertices.append((math.cos(angle), math.sin(angle), z))
    faces = []
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index, following, segments + following, segments + index))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(segments, segments * 2)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    return mesh


def unit_cone_mesh(
    name: str, mat: bpy.types.Material, segments: int = 9
) -> bpy.types.Mesh:
    vertices = [
        (math.cos(math.tau * index / segments), math.sin(math.tau * index / segments), -0.5)
        for index in range(segments)
    ]
    vertices.append((0.0, 0.0, 0.5))
    faces = [
        (index, (index + 1) % segments, segments) for index in range(segments)
    ]
    faces.append(tuple(reversed(range(segments))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    return mesh


TORCH_STEM_MESH = unit_cylinder_mesh("FF_Shared_TorchStem_Mesh", WOOD)
TORCH_FLAME_MESHES = {
    mat.name: unit_cone_mesh(f"FF_Shared_{key}_Flame_Mesh", mat)
    for key, mat in (
        ("DJ", DJ_FLAME),
        ("EK", EK_FLAME),
        ("FL", FL_FLAME),
    )
}


# The floor is the exact nominal room footprint. Runtime tile geometry remains
# responsible for collision; this slab only gives the graybox a spatial shell.
add_box(
    "FF_Shell_Floor",
    (0.0, 0.0, -0.18),
    (ROOM["width"], ROOM["depth"], 0.36),
    BASALT_DARK,
    COLLECTIONS["SHELL"],
    bevel=0.12,
)


def wall_segment(
    name: str,
    centre: tuple[float, float],
    dimensions: tuple[float, float],
    seed_offset: int,
) -> None:
    height = 5.7
    add_box(
        f"FF_Shell_{name}_Core",
        (centre[0], centre[1], height / 2),
        (dimensions[0], dimensions[1], height),
        BASALT,
        COLLECTIONS["SHELL"],
        bevel=0.55,
    )
    count = max(2, int(max(dimensions) / 2.8))
    along_x = dimensions[0] >= dimensions[1]
    for index in range(count):
        fraction = (index + 0.5) / count - 0.5
        x = centre[0] + (fraction * dimensions[0] if along_x else RNG.uniform(-0.5, 0.5))
        y = centre[1] + (RNG.uniform(-0.5, 0.5) if along_x else fraction * dimensions[1])
        rock_height = RNG.uniform(3.8, 7.4)
        add_rock(
            f"FF_Shell_{name}_Rock_{seed_offset + index:03d}",
            (x, y, rock_height * 0.52),
            (RNG.uniform(1.0, 2.1), RNG.uniform(0.9, 1.7), rock_height * 0.55),
            BASALT_EDGE if index % 4 == 0 else BASALT,
            COLLECTIONS["SHELL"],
        )


# Perimeter shell, with the exact Water and Earth door openings left clear.
wall_segment("North", (0.0, 15.55), (61.6, 1.1), 0)
wall_segment("South", (0.0, -15.55), (61.6, 1.1), 30)
wall_segment("WestNorth", (-30.55, 8.0), (1.1, 14.0), 60)
wall_segment("WestSouth", (-30.55, -8.0), (1.1, 14.0), 70)
wall_segment("EastNorth", (30.55, 1.5), (1.1, 27.0), 80)
wall_segment("EastSouth", (30.55, -14.5), (1.1, 1.0), 95)


# Walkable route surfaces. Their widths come directly from the plan contract.
path_materials = {
    "steam-threshold": PATH_STEAM,
    "ember-bridge": PATH_BRIDGE,
    "torch-field": PATH_STONE,
    "shrine-orbit": PATH_STONE,
    "transfer": PATH_STONE,
    "growth-path": PATH_STONE,
}
for section in CONTRACT["pathSections"]:
    add_ribbon(
        f"FF_Path_{section['id'].replace('-', '_')}",
        section["blenderPoints"],
        section["width"],
        path_materials[section["kind"]],
        COLLECTIONS["SHELL"],
    )

growth_section = next(
    section for section in CONTRACT["pathSections"] if section["kind"] == "growth-path"
)
add_ribbon(
    "FF_Growth_CrackGuide",
    growth_section["blenderPoints"],
    0.28,
    PATH_GROWTH,
    COLLECTIONS["SHELL"],
)


# Steam occupies a low Water threshold before the bridge and first visible fire.
# Narrow rising wisps preserve visibility; broad transparent volumes produced
# misleading full-frame fog in first-person review.
for index in range(11):
    base_x = -28.1 + (index % 6) * 0.72
    base_y = -1.25 + (index // 6) * 2.25 + RNG.uniform(-0.18, 0.18)
    height = RNG.uniform(1.35, 2.8)
    curve = bpy.data.curves.new(f"FF_Steam_Wisp_{index + 1:02d}Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = RNG.uniform(0.055, 0.11)
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(3)
    for point_index, point in enumerate(spline.bezier_points):
        fraction = point_index / 3
        point.co = (
            base_x + math.sin(fraction * math.pi * 2 + index) * 0.14,
            base_y + math.cos(fraction * math.pi * 1.5 + index) * 0.12,
            0.08 + height * fraction,
        )
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    wisp = bpy.data.objects.new(f"FF_Steam_Wisp_{index + 1:02d}", curve)
    COLLECTIONS["SHELL"].objects.link(wisp)
    wisp.data.materials.append(STEAM)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = wisp
    wisp.select_set(True)
    bpy.ops.object.convert(target="MESH")
    wisp.select_set(False)


# Ember bridge: six uneven basalt slabs span a shallow incandescent fissure.
add_box(
    "FF_Bridge_EmberBed",
    (-22.25, 0.0, -0.10),
    (5.0, 4.8, 0.16),
    EMBER,
    COLLECTIONS["BRIDGE"],
    bevel=0.18,
)
for index in range(6):
    x = -24.15 + index * 0.76
    add_box(
        f"FF_Bridge_Slab_{index + 1:02d}",
        (x, RNG.uniform(-0.08, 0.08), 0.14 + RNG.uniform(-0.025, 0.025)),
        (0.68, 3.0 + RNG.uniform(-0.18, 0.18), 0.30),
        BASALT_EDGE if index in (0, 5) else BASALT,
        COLLECTIONS["BRIDGE"],
        bevel=0.10,
        rotation=(0.0, RNG.uniform(-0.025, 0.025), RNG.uniform(-0.035, 0.035)),
    )


# Rock ribs are full-height sightline blockers, not decorative piles. Irregular
# boulders soften their rectangular measured footprints without opening gaps.
for occluder_index, occluder in enumerate(CONTRACT["occluders"]):
    footprint = occluder["blenderFootprint"]
    centre = footprint["centre"]
    if occluder["kind"] == "torch-curtain":
        continue
    height = 5.3 + occluder_index * 0.22
    add_box(
        f"FF_RockRib_{occluder['id'].replace('-', '_')}_Core",
        (centre["x"], centre["y"], height / 2),
        (footprint["sizeX"], footprint["sizeY"], height),
        BASALT,
        COLLECTIONS["ROCK_RIBS"],
        bevel=min(0.65, min(footprint["sizeX"], footprint["sizeY"]) * 0.18),
    )
    long_axis = max(footprint["sizeX"], footprint["sizeY"])
    count = max(3, int(long_axis / 2.3))
    along_x = footprint["sizeX"] >= footprint["sizeY"]
    for index in range(count):
        fraction = (index + 0.5) / count - 0.5
        x = centre["x"] + (
            fraction * footprint["sizeX"] if along_x else RNG.uniform(-0.65, 0.65)
        )
        y = centre["y"] + (
            RNG.uniform(-0.65, 0.65) if along_x else fraction * footprint["sizeY"]
        )
        rock_height = RNG.uniform(3.6, 6.8)
        add_rock(
            f"FF_RockRib_{occluder_index:02d}_Rock_{index:02d}",
            (x, y, rock_height / 2),
            (RNG.uniform(0.8, 1.5), RNG.uniform(0.8, 1.6), rock_height * 0.54),
            BASALT_EDGE if index % 3 == 0 else BASALT,
            COLLECTIONS["ROCK_RIBS"],
        )


locator_materials = {"dj": LOCATOR_DJ, "ek": LOCATOR_EK, "fl": LOCATOR_FL}
flame_materials = {"dj": DJ_FLAME, "ek": EK_FLAME, "fl": FL_FLAME}


def add_performer_locator(shrine: dict) -> None:
    centre = shrine["blenderCentre"]
    mat = locator_materials[shrine["id"]]
    add_cylinder(
        f"LOC_Performer_{shrine['label']}_Body",
        (centre["x"], centre["y"], 1.05),
        0.28,
        1.45,
        mat,
        COLLECTIONS["LOCATORS"],
        vertices=10,
    )
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=2,
        radius=0.34,
        location=(centre["x"], centre["y"], 1.96),
    )
    head = bpy.context.active_object
    head.name = f"LOC_Performer_{shrine['label']}_Head"
    assign(head, mat)
    move_to_collection(head, COLLECTIONS["LOCATORS"])
    add_text(
        f"LOC_Label_{shrine['label']}",
        shrine["label"],
        (centre["x"], centre["y"], 0.23),
        1.15,
        mat,
        COLLECTIONS["LOCATORS"],
    )


for shrine in CONTRACT["shrines"]:
    centre = shrine["blenderCentre"]
    add_cylinder(
        f"FF_Shrine_{shrine['label']}_Habitat",
        (centre["x"], centre["y"], -0.02),
        shrine["habitatRadius"],
        0.22,
        BASALT_EDGE,
        COLLECTIONS["SHRINES"],
        vertices=48,
    )
    add_ring(
        f"FF_Trench_{shrine['label']}_Magma",
        (centre["x"], centre["y"]),
        shrine["trenchInnerRadius"],
        shrine["trenchOuterRadius"],
        0.015,
        MAGMA,
        COLLECTIONS["TRENCHES"],
    )
    for ring_index, radius in enumerate(
        (shrine["trenchInnerRadius"] - 0.08, shrine["trenchOuterRadius"] + 0.08)
    ):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius,
            minor_radius=0.12,
            major_segments=64,
            minor_segments=8,
            location=(centre["x"], centre["y"], 0.09),
        )
        rim = bpy.context.active_object
        rim.name = f"FF_Trench_{shrine['label']}_Rim_{ring_index + 1}"
        assign(rim, BASALT)
        move_to_collection(rim, COLLECTIONS["TRENCHES"])
    add_performer_locator(shrine)


def add_torch(
    index: int,
    category: str,
    location: Vector,
    height: float,
    flame_mat: bpy.types.Material,
) -> None:
    tilt_x = RNG.uniform(-0.075, 0.075)
    tilt_y = RNG.uniform(-0.075, 0.075)
    radius = RNG.uniform(0.075, 0.13)
    stem = bpy.data.objects.new(
        f"FF_TorchStem_{category}_{index:03d}", TORCH_STEM_MESH
    )
    COLLECTIONS["TORCH_GUIDES"].objects.link(stem)
    stem.location = (location.x, location.y, height / 2)
    stem.scale = (radius, radius, height)
    stem.rotation_euler = (tilt_x, tilt_y, RNG.uniform(-0.08, 0.08))

    flame_radius = RNG.uniform(0.19, 0.27)
    flame_depth = RNG.uniform(0.62, 0.92)
    flame = bpy.data.objects.new(
        f"FF_FlameGuide_{category}_{index:03d}",
        TORCH_FLAME_MESHES[flame_mat.name],
    )
    COLLECTIONS["TORCH_GUIDES"].objects.link(flame)
    flame.location = (location.x, location.y, height + 0.34)
    flame.scale = (flame_radius, flame_radius, flame_depth)


def sample_field_paths(count: int) -> list[tuple[Vector, Vector, float]]:
    segments: list[tuple[dict, dict, float, float]] = []
    for section in CONTRACT["pathSections"]:
        if section["kind"] not in ("torch-field", "transfer"):
            continue
        points = section["planPoints"]
        for start, end in zip(points, points[1:]):
            length = math.hypot(end["x"] - start["x"], end["z"] - start["z"])
            segments.append((start, end, section["width"], length))
    total = sum(segment[3] for segment in segments)
    result: list[tuple[Vector, Vector, float]] = []
    for index in range(count):
        distance = total * (index + 0.5) / count
        travelled = 0.0
        for start, end, width, length in segments:
            if travelled + length < distance:
                travelled += length
                continue
            fraction = (distance - travelled) / length
            plan_x = start["x"] + (end["x"] - start["x"]) * fraction
            plan_z = start["z"] + (end["z"] - start["z"]) * fraction
            tangent = Vector((end["x"] - start["x"], -(end["z"] - start["z"]), 0))
            tangent.normalize()
            result.append((plan_to_blender(plan_x, plan_z), tangent, width))
            break
    return result


# Ten tall stems form the first curtain. The remaining 62 line both sides of
# the authored transfers, keeping the total field budget exactly at 72.
field_torch_index = 0
curtain = next(
    occluder for occluder in CONTRACT["occluders"] if occluder["kind"] == "torch-curtain"
)
rect = curtain["planRect"]
for index in range(10):
    fraction = (index + 0.5) / 10
    point = plan_to_blender(
        (rect["minX"] + rect["maxX"]) / 2,
        rect["minZ"] + (rect["maxZ"] - rect["minZ"]) * fraction,
    )
    field_torch_index += 1
    add_torch(
        field_torch_index,
        "Field",
        point,
        2.45 + 0.75 * math.sin(fraction * math.pi),
        DJ_FLAME,
    )

for sample_index, (point, tangent, width) in enumerate(sample_field_paths(31)):
    normal = Vector((-tangent.y, tangent.x, 0))
    for side in (-1, 1):
        field_torch_index += 1
        offset = width / 2 + 0.82 + 0.24 * math.sin(sample_index * 1.71 + side)
        torch_point = point + normal * offset * side
        add_torch(
            field_torch_index,
            "Field",
            torch_point,
            0.95 + 1.35 * (0.5 + 0.5 * math.sin(sample_index * 0.83 + side)),
            DJ_FLAME if sample_index < 11 else EK_FLAME if sample_index < 21 else FL_FLAME,
        )

perimeter_torch_count = 0
for shrine in CONTRACT["shrines"]:
    centre = shrine["blenderCentre"]
    for index in range(CONTRACT["torchBudget"]["perimeterStemsPerShrine"]):
        angle = math.tau * index / CONTRACT["torchBudget"]["perimeterStemsPerShrine"]
        radius = shrine["trenchInnerRadius"] + 0.28
        point = Vector(
            (
                centre["x"] + math.cos(angle) * radius,
                centre["y"] + math.sin(angle) * radius,
                0.0,
            )
        )
        if shrine["id"] == "dj":
            height = 1.35 + 0.45 * (0.5 + 0.5 * math.sin(angle * 2))
        elif shrine["id"] == "ek":
            height = 1.20 + 0.85 * abs(math.sin(angle * 3))
        else:
            height = 1.05 + (0.95 if math.cos(angle) > 0 else 0.35)
        perimeter_torch_count += 1
        add_torch(
            index + 1,
            f"{shrine['label']}_Perimeter",
            point,
            height,
            flame_materials[shrine["id"]],
        )


# The final route makes green the only saturated direction after the planned
# extinction. These markers are static graybox cues, not the runtime animation.
growth_points = growth_section["blenderPoints"]
for index in range(18):
    fraction = index / 17
    segment_position = fraction * (len(growth_points) - 1)
    segment_index = min(len(growth_points) - 2, int(segment_position))
    local = segment_position - segment_index
    start = growth_points[segment_index]
    end = growth_points[segment_index + 1]
    x = start["x"] + (end["x"] - start["x"]) * local
    y = start["y"] + (end["y"] - start["y"]) * local
    add_rock(
        f"FF_Growth_Moss_{index + 1:02d}",
        (x + RNG.uniform(-0.35, 0.35), y + RNG.uniform(-0.35, 0.35), 0.07),
        (RNG.uniform(0.18, 0.42), RNG.uniform(0.18, 0.55), RNG.uniform(0.04, 0.10)),
        GROWTH,
        COLLECTIONS["SHELL"],
    )


# Artist locators: doors, route eye-height samples, performer anchors, and
# sightline rays remain in the .blend but are excluded from the FF_ export.
for door_id, door in CONTRACT["doors"].items():
    point = door["blender"]
    add_box(
        f"LOC_Door_{door_id.title()}",
        (point["x"], point["y"], 1.2),
        (0.18, door["clearWidth"], 2.4),
        REFERENCE_CYAN,
        COLLECTIONS["LOCATORS"],
        bevel=0.04,
    )
for sightline in CONTRACT["sightlines"]:
    add_curve_between(
        f"REF_Sightline_{sightline['id']}",
        Vector(tuple(sightline["from"].values())),
        Vector(tuple(sightline["to"].values())),
        0.035,
        SIGHTLINE_RED,
        COLLECTIONS["REFERENCE"],
    )
for index, point in enumerate(
    [
        (-28.5, 0.0),
        (-18.0, -0.5),
        (-4.2, -10.2),
        (11.5, 9.0),
        (24.5, -11.5),
    ]
):
    add_cylinder(
        f"REF_Visitor_Eye_{index + 1:02d}",
        (point[0], point[1], 0.85),
        0.22,
        1.7,
        REFERENCE_CYAN,
        COLLECTIONS["REFERENCE"],
        vertices=12,
    )

COLLECTIONS["REFERENCE"].hide_render = True


def add_light(
    name: str,
    light_type: str,
    location: tuple[float, float, float],
    energy: float,
    color: tuple[float, float, float],
    size: float = 5.0,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name=name, type=light_type)
    data.energy = energy
    data.color = color
    if light_type == "AREA":
        data.shape = "DISK"
        data.size = size
    if light_type == "POINT":
        data.shadow_soft_size = size
    obj = bpy.data.objects.new(name, data)
    COLLECTIONS["QA_ONLY"].objects.link(obj)
    obj.location = location
    return obj


add_light("QA_Area_WarmKey", "AREA", (-8.0, 1.0, 11.5), 1800, (1.0, 0.42, 0.13), 10.0)
add_light("QA_Area_CoolFill", "AREA", (8.0, -3.0, 10.0), 1300, (0.18, 0.35, 0.58), 12.0)
add_light("QA_Point_Bridge", "POINT", (-22.0, 0.0, 1.0), 520, (1.0, 0.07, 0.01), 2.0)
for shrine in CONTRACT["shrines"]:
    centre = shrine["blenderCentre"]
    add_light(
        f"QA_Point_{shrine['label']}",
        "POINT",
        (centre["x"], centre["y"], 1.4),
        640,
        (1.0, 0.055 if shrine["id"] != "ek" else 0.12, 0.008),
        2.4,
    )
add_light("QA_Point_Earth", "POINT", (27.0, -11.0, 1.4), 900, (0.04, 0.55, 0.07), 3.4)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def camera_from_plan(
    name: str,
    plan_location: tuple[float, float, float],
    plan_target: tuple[float, float, float],
    lens: float = 24.0,
) -> bpy.types.Object:
    location = plan_to_blender(plan_location[0], plan_location[1], plan_location[2])
    target = plan_to_blender(plan_target[0], plan_target[1], plan_target[2])
    bpy.ops.object.camera_add(location=location)
    camera = bpy.context.active_object
    camera.name = name
    camera.data.lens = lens
    camera.data.sensor_width = 36
    camera.data.clip_start = 0.05
    camera.data.clip_end = 250
    look_at(camera, target)
    return move_to_collection(camera, COLLECTIONS["QA_ONLY"])


bpy.ops.object.camera_add(location=(0.0, 0.0, 67.0))
camera_plan = bpy.context.active_object
camera_plan.name = "QA_Camera_Plan"
camera_plan.data.type = "ORTHO"
camera_plan.data.ortho_scale = 68.0
camera_plan.data.clip_end = 250
look_at(camera_plan, Vector((0.0, 0.0, 0.0)))
move_to_collection(camera_plan, COLLECTIONS["QA_ONLY"])

cameras = {
    "plan": camera_plan,
    "overview": camera_from_plan(
        "QA_Camera_Overview", (30.0, 35.0, 38.0), (30.0, 15.0, 0.75), 42
    ),
    "threshold": camera_from_plan(
        "QA_Camera_Threshold", (0.5, 15.0, 1.7), (15.5, 9.5, 1.8), 23
    ),
    "dj": camera_from_plan(
        "QA_Camera_DJ", (11.2, 15.6, 1.7), (16.5, 8.5, 1.15), 24
    ),
    "ek": camera_from_plan(
        "QA_Camera_EK", (25.2, 25.4, 1.7), (31.5, 21.5, 1.15), 25
    ),
    "fl": camera_from_plan(
        "QA_Camera_FL", (41.2, 6.0, 1.7), (47.0, 8.5, 1.15), 24
    ),
    "earth": camera_from_plan(
        "QA_Camera_Earth", (51.2, 11.2, 1.7), (58.5, 27.5, 0.75), 23
    ),
}


scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -0.45
scene.world = bpy.data.worlds.new("First Fire QA World")
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.004, 0.006, 0.012, 1.0)
background.inputs["Strength"].default_value = 0.09


def object_world_bounds(objects: list[bpy.types.Object]) -> dict[str, float]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    return {
        "minX": min(point.x for point in points),
        "maxX": max(point.x for point in points),
        "minY": min(point.y for point in points),
        "maxY": max(point.y for point in points),
        "minZ": min(point.z for point in points),
        "maxZ": max(point.z for point in points),
    }


export_meshes = [
    obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith("FF_")
]
export_lights_or_cameras = [
    obj
    for obj in scene.objects
    if obj.name.startswith("FF_") and obj.type in ("LIGHT", "CAMERA")
]
field_stems = [
    obj for obj in export_meshes if obj.name.startswith("FF_TorchStem_Field_")
]
perimeter_stems = [
    obj for obj in export_meshes if "_Perimeter_" in obj.name and "TorchStem" in obj.name
]

if len(field_stems) != CONTRACT["torchBudget"]["fieldStems"]:
    raise RuntimeError(
        f"Expected {CONTRACT['torchBudget']['fieldStems']} field stems, "
        f"built {len(field_stems)}"
    )
expected_perimeter = (
    len(CONTRACT["shrines"])
    * CONTRACT["torchBudget"]["perimeterStemsPerShrine"]
)
if len(perimeter_stems) != expected_perimeter:
    raise RuntimeError(
        f"Expected {expected_perimeter} perimeter stems, built {len(perimeter_stems)}"
    )
if export_lights_or_cameras:
    raise RuntimeError("FF_ export prefix includes a QA light or camera")
if set(CONTRACT["collections"]) != {
    collection.name for collection in COLLECTIONS.values()
}:
    raise RuntimeError("Blender collection contract is incomplete")

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

render_paths: dict[str, str] = {}
growth_objects = [
    obj
    for obj in scene.objects
    if obj.name.startswith("FF_Growth_")
]
red_objects = [
    obj
    for obj in scene.objects
    if obj.name.startswith("FF_FlameGuide_")
    or obj.name.startswith("FF_Trench_") and "Magma" in obj.name
    or obj.name == "FF_Bridge_EmberBed"
]
red_lights = [
    obj
    for obj in scene.objects
    if obj.name.startswith("QA_Point_") and obj.name != "QA_Point_Earth"
]
earth_light = scene.objects.get("QA_Point_Earth")
for name, camera in cameras.items():
    show_growth = name in ("plan", "earth")
    show_red = name != "earth"
    for obj in growth_objects:
        obj.hide_render = not show_growth
    for obj in red_objects:
        obj.hide_render = not show_red
    for light in red_lights:
        light.hide_render = not show_red
    if earth_light:
        earth_light.hide_render = not show_growth
    scene.camera = camera
    render_path = QA_DIR / f"first-fire-graybox-{name}.png"
    scene.render.filepath = str(render_path)
    bpy.ops.render.render(write_still=True)
    render_paths[name] = str(render_path)

scene.camera = cameras["overview"]
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

report = {
    "sourceDigest": SOURCE_DIGEST,
    "schemaVersion": CONTRACT["schemaVersion"],
    "blenderVersion": bpy.app.version_string,
    "blendPath": str(BLEND_PATH),
    "manifestPath": str(MANIFEST_PATH),
    "exportPrefix": "FF_",
    "exportMeshCount": len(export_meshes),
    "materialCount": len(bpy.data.materials),
    "fieldTorchStems": len(field_stems),
    "perimeterTorchStems": len(perimeter_stems),
    "roomFootprint": {
        "width": ROOM["width"],
        "depth": ROOM["depth"],
        "blenderBounds": ROOM_BOUNDS,
    },
    "exportObjectBounds": object_world_bounds(export_meshes),
    "collections": sorted(collection.name for collection in COLLECTIONS.values()),
    "renders": render_paths,
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

print(f"Verified First Fire source digest: {SOURCE_DIGEST}")
print(f"Saved editable graybox: {BLEND_PATH}")
print(f"Wrote QA report: {REPORT_PATH}")
for name, path in render_paths.items():
    print(f"Rendered {name:>9}: {path}")
