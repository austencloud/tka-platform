"""Author the complete Gate 5 sanctuary field in local space.

The approved coordinate manifest remains the placement owner. This builder
extends the Gate 4 Broken Vigil asset and adds the three silhouettes approved
at Gates 1 through 3. Runtime code places the four tagged roots for each
registered viewport.
"""

from __future__ import annotations

import importlib.util
import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
GATE4_BUILDER_PATH = SCRIPT_DIR / "build-seraphic-vault-production-slice.py"
CONTRACT_PATH = (
    PROJECT_ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "seraphic-vault"
    / "seraphic-vault-gate2-coordinate-manifest.json"
)
INNER_FEATHER_PATH = (
    PROJECT_ROOT
    / "static"
    / "models"
    / "celestial"
    / "source"
    / "inner-feather-spire_raw.glb"
)
BLEND_PATH = PROJECT_ROOT / "blender" / "seraphic_vault_integrated_sanctuaries.blend"
RAW_GLB_PATH = (
    PROJECT_ROOT
    / "static"
    / "models"
    / "celestial"
    / "seraphic-vault-integrated-sanctuaries_raw.glb"
)


def load_gate4_builder():
    spec = importlib.util.spec_from_file_location(
        "seraphic_vault_gate4_builder", GATE4_BUILDER_PATH
    )
    if not spec or not spec.loader:
        raise RuntimeError(f"Unable to load Gate 4 builder: {GATE4_BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gate4 = load_gate4_builder()


def load_contract() -> dict:
    with CONTRACT_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def tag_object(obj: bpy.types.Object, platform_id: str, role: str) -> None:
    obj["tka_scene"] = "seraphic-vault"
    obj["tka_gate"] = 5
    obj["tka_platform"] = platform_id
    obj["tka_role"] = role


def create_root(platform_id: str) -> bpy.types.Object:
    root = bpy.data.objects.new(f"Sanctuary_{platform_id}_Root", None)
    bpy.context.scene.collection.objects.link(root)
    root.empty_display_type = "CIRCLE"
    root.empty_display_size = 0.6
    tag_object(root, platform_id, "responsive-platform-root")
    return root


def bevel_and_smooth(obj: bpy.types.Object, width: float) -> None:
    modifier = obj.modifiers.new("Weathered sanctuary edge", "BEVEL")
    modifier.width = width
    modifier.segments = 3
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    try:
        bpy.ops.object.shade_smooth_by_angle()
    except RuntimeError:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def create_deck(
    platform: dict,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    platform_id = platform["id"]
    dimensions = platform["dimensions"]
    width = dimensions["solidSilhouetteWidth"]
    depth = dimensions["depth"]
    thickness = dimensions["thickness"]
    rng = random.Random(f"seraphic-vault-gate5:{platform_id}")
    segment_count = 14
    outline = []
    for index in range(segment_count):
        angle = math.tau * index / segment_count
        variation = 0.91 + rng.uniform(-0.075, 0.075)
        outline.append(
            (
                math.cos(angle) * width * 0.5 * variation,
                math.sin(angle) * depth * 0.5 * variation,
            )
        )

    vertices = [(x, y, 0.0) for x, y in outline]
    vertices.extend((x, y, -thickness) for x, y in outline)
    faces: list[tuple[int, ...]] = [
        tuple(range(segment_count)),
        tuple(reversed(range(segment_count, segment_count * 2))),
    ]
    for index in range(segment_count):
        next_index = (index + 1) % segment_count
        faces.append(
            (
                index,
                next_index,
                segment_count + next_index,
                segment_count + index,
            )
        )

    mesh = bpy.data.meshes.new(f"{platform_id}_DeckMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    deck = bpy.data.objects.new(f"{platform_id}_Deck", mesh)
    bpy.context.scene.collection.objects.link(deck)
    deck.parent = root
    deck.data.materials.append(material)
    tag_object(deck, platform_id, "distant-sanctuary-deck")
    bevel_and_smooth(deck, min(0.16, thickness * 0.22))
    return deck


def create_curve(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    root: bpy.types.Object,
    material: bpy.types.Material,
    platform_id: str,
    role: str,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(material)
    tag_object(obj, platform_id, role)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.select_set(False)
    return obj


def arc_points(
    radius: float,
    start_degrees: float,
    end_degrees: float,
    center_z: float,
    count: int = 26,
) -> list[tuple[float, float, float]]:
    return [
        (
            math.cos(
                math.radians(
                    start_degrees
                    + (end_degrees - start_degrees) * index / (count - 1)
                )
            )
            * radius,
            0.0,
            math.sin(
                math.radians(
                    start_degrees
                    + (end_degrees - start_degrees) * index / (count - 1)
                )
            )
            * radius
            + center_z,
        )
        for index in range(count)
    ]


def create_cloud_collar(
    platform: dict,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    platform_id = platform["id"]
    radius = platform["dimensions"]["cloudCollarRadius"]
    depth = platform["dimensions"]["depth"]
    rng = random.Random(f"seraphic-vault-cloud-collar:{platform_id}")
    puff_count = {
        "broken-vigil": 10,
        "twin-choir": 9,
        "eroded-halo": 7,
        "cloud-crown": 6,
    }[platform_id]
    for index in range(puff_count):
        angle = math.tau * index / puff_count + rng.uniform(-0.08, 0.08)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
        puff = bpy.context.object
        puff.name = f"{platform_id}_CloudCollar_{index:02d}"
        puff.parent = root
        puff.location = (
            math.cos(angle) * radius * 0.58,
            math.sin(angle) * min(radius * 0.3, depth * 0.52),
            -platform["dimensions"]["thickness"] * 0.28
            + rng.uniform(-0.14, 0.1),
        )
        scale = radius * rng.uniform(0.11, 0.17)
        puff.scale = (scale * 1.75, scale, scale * 0.64)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        puff.data.materials.append(material)
        tag_object(puff, platform_id, "distant-sanctuary-cloud-collar")
        bpy.ops.object.shade_smooth()


def create_deck_inlay(
    platform: dict,
    root: bpy.types.Object,
    material: bpy.types.Material,
    radius_ratio: float,
    start_degrees: float,
    end_degrees: float,
    index: int,
) -> None:
    width = platform["dimensions"]["solidSilhouetteWidth"]
    points = [
        (
            math.cos(math.radians(angle)) * width * radius_ratio,
            math.sin(math.radians(angle))
            * platform["dimensions"]["depth"]
            * radius_ratio,
            0.035,
        )
        for angle in [
            start_degrees
            + (end_degrees - start_degrees) * point_index / 30
            for point_index in range(31)
        ]
    ]
    create_curve(
        f"{platform['id']}_Inlay_{index}",
        points,
        max(0.018, width * 0.0032),
        root,
        material,
        platform["id"],
        "distant-sanctuary-inlay",
    )


def object_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector(
        (
            min(value.x for value in corners),
            min(value.y for value in corners),
            min(value.z for value in corners),
        )
    )
    maximum = Vector(
        (
            max(value.x for value in corners),
            max(value.y for value in corners),
            max(value.z for value in corners),
        )
    )
    return minimum, maximum


def import_inner_feather(target_height: float) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(INNER_FEATHER_PATH))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Twin Choir source imported without mesh geometry")
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
    for obj in imported:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    feather = bpy.context.view_layer.objects.active
    feather.name = "TwinChoir_FeatherSpire_Source"
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    minimum, maximum = object_bounds(feather)
    height = maximum.z - minimum.z
    if height <= 0:
        raise RuntimeError(f"Twin Choir source height is invalid: {height}")
    scale = target_height / height
    feather.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    minimum, maximum = object_bounds(feather)
    center = (minimum + maximum) * 0.5
    feather.location.x -= center.x
    feather.location.y -= center.y
    feather.location.z -= minimum.z
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    gate4.configure_imported_materials(feather)
    for slot in feather.material_slots:
        if slot.material:
            slot.material.name = slot.material.name.replace(
                "BrokenVigil_", "TwinChoir_"
            )
    return feather


def build_broken_vigil(platform: dict, materials: dict[str, bpy.types.Material]) -> None:
    root = create_root(platform["id"])
    gate4.create_extruded_slab(materials["stone"])
    gate4.create_inlay(
        3.55, math.radians(16), math.radians(164), materials["inlay"], 1
    )
    gate4.create_inlay(
        4.5, math.radians(205), math.radians(338), materials["inlay"], 2
    )
    gate4.import_feather()
    gate4.create_break_stones(materials["fracture"])
    gate4.create_break_face(materials["fracture"])
    for obj in bpy.data.objects:
        if obj.get("tka_platform") != platform["id"] or obj is root:
            continue
        obj.parent = root
        obj["tka_gate"] = 5
    create_cloud_collar(platform, root, materials["cloud"])


def build_twin_choir(platform: dict, materials: dict[str, bpy.types.Material]) -> None:
    root = create_root(platform["id"])
    create_deck(platform, root, materials["stone"])
    create_deck_inlay(platform, root, materials["inlay"], 0.36, 8, 172, 1)
    base = import_inner_feather(platform["dimensions"]["width"] * 0.55)
    for side in (-1, 1):
        spire = base if side < 0 else base.copy()
        if side > 0:
            spire.data = base.data
            bpy.context.scene.collection.objects.link(spire)
        spire.name = f"TwinChoir_FeatherSpire_{'Left' if side < 0 else 'Right'}"
        spire.parent = root
        spire.location = (
            side * platform["dimensions"]["width"] * 0.2,
            -0.1,
            0.12,
        )
        spire.rotation_euler = (
            math.radians(4.0),
            math.radians(side * -9.0),
            math.radians(side * 8.0),
        )
        tag_object(spire, platform["id"], "distant-sanctuary-feather-spire")
    create_cloud_collar(platform, root, materials["cloud"])


def build_eroded_halo(platform: dict, materials: dict[str, bpy.types.Material]) -> None:
    root = create_root(platform["id"])
    create_deck(platform, root, materials["stone"])
    create_deck_inlay(platform, root, materials["inlay"], 0.4, 192, 344, 1)
    width = platform["dimensions"]["solidSilhouetteWidth"]
    radius = width * 0.38
    center_z = radius * 0.96
    for suffix, start, end in (("Left", 31, 153), ("Right", 205, 327)):
        create_curve(
            f"ErodedHalo_Ring_{suffix}",
            arc_points(radius, start, end, center_z),
            width * 0.064,
            root,
            materials["fracture"],
            platform["id"],
            "distant-sanctuary-eroded-ring",
        )
    rng = random.Random("seraphic-vault-eroded-halo-fragments")
    for index in range(5):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2,
            radius=width * rng.uniform(0.04, 0.075),
            location=(
                rng.uniform(-width * 0.33, width * 0.33),
                rng.uniform(-width * 0.08, width * 0.08),
                rng.uniform(0.05, width * 0.16),
            ),
        )
        fragment = bpy.context.object
        fragment.name = f"ErodedHalo_Fragment_{index:02d}"
        fragment.parent = root
        fragment.scale = (1.25, 0.72, 0.58)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        fragment.data.materials.append(materials["fracture"])
        tag_object(fragment, platform["id"], "distant-sanctuary-fracture")
    create_cloud_collar(platform, root, materials["cloud"])


def build_cloud_crown(platform: dict, materials: dict[str, bpy.types.Material]) -> None:
    root = create_root(platform["id"])
    create_deck(platform, root, materials["stone"])
    width = platform["dimensions"]["width"]
    profiles = (
        (-0.28, 0.32),
        (-0.13, 0.48),
        (0.0, 0.62),
        (0.14, 0.45),
        (0.29, 0.3),
    )
    for index, (x_factor, height_factor) in enumerate(profiles):
        height = width * height_factor
        bpy.ops.mesh.primitive_cone_add(
            vertices=7,
            radius1=width * (0.085 if index == 2 else 0.068),
            radius2=width * 0.012,
            depth=height,
            location=(width * x_factor, 0.0, height * 0.5),
        )
        point = bpy.context.object
        point.name = f"CloudCrown_Point_{index:02d}"
        point.parent = root
        point.rotation_euler[1] = math.radians((index - 2) * 3.5)
        point.data.materials.append(materials["stone"])
        tag_object(point, platform["id"], "distant-sanctuary-cloud-crown")
        bevel_and_smooth(point, width * 0.012)
    create_cloud_collar(platform, root, materials["cloud"])


def platform_materials(platform: dict) -> dict[str, bpy.types.Material]:
    platform_id = platform["id"]
    blue_shift = platform["blueShift"]
    stone_colors = {
        "broken-vigil": (0.65, 0.7, 0.78, 1.0),
        "twin-choir": (0.56, 0.66, 0.76, 1.0),
        "eroded-halo": (0.47, 0.59, 0.72, 1.0),
        "cloud-crown": (0.42, 0.55, 0.7, 1.0),
    }
    return {
        "stone": gate4.pearl_material(
            f"{platform_id}_CoolAlabaster", stone_colors[platform_id], 0.82
        ),
        "inlay": gate4.pearl_material(
            f"{platform_id}_IridescentInlay",
            (0.5 - blue_shift * 0.08, 0.68, 0.82, 1.0),
            0.48,
        ),
        "fracture": gate4.pearl_material(
            f"{platform_id}_FracturedStone",
            (0.46 - blue_shift * 0.08, 0.54, 0.67, 1.0),
            0.9,
        ),
        "cloud": gate4.pearl_material(
            f"{platform_id}_CloudCollar",
            (0.76 - blue_shift * 0.08, 0.84, 0.92, 1.0),
            1.0,
        ),
    }


def export_environment() -> None:
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAW_GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(RAW_GLB_PATH),
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )


def main() -> None:
    gate4.reset_scene()
    contract = load_contract()
    builders = {
        "broken-vigil": build_broken_vigil,
        "twin-choir": build_twin_choir,
        "eroded-halo": build_eroded_halo,
        "cloud-crown": build_cloud_crown,
    }
    for platform in contract["platforms"]:
        builders[platform["id"]](platform, platform_materials(platform))
    export_environment()
    print(f"Seraphic Vault Gate 5 blend: {BLEND_PATH}")
    print(f"Seraphic Vault Gate 5 raw GLB: {RAW_GLB_PATH}")


if __name__ == "__main__":
    main()
