"""Build the Seraphic Vault Phase 2 spatial graybox from the approved Gate 1 contract.

The production Seraph shell remains untouched. This script opens that source,
saves a review-only copy, adds four primitive distant-platform families, renders
the registered viewport proofs, and exports an unoptimized review GLB.
"""

from __future__ import annotations

import json
import math
import os
import random
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
SOURCE_BLEND = PROJECT_ROOT / "blender" / "celestial_environment.blend"
COORDINATE_MANIFEST = (
    PROJECT_ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "seraphic-vault"
    / "seraphic-vault-gate2-coordinate-manifest.json"
)
OUTPUT_BLEND = PROJECT_ROOT / "blender" / "seraphic_vault_phase2_graybox.blend"
OUTPUT_GLB = (
    PROJECT_ROOT
    / "static"
    / "models"
    / "celestial"
    / "review"
    / "seraphic-vault-phase2-graybox.glb"
)
EVIDENCE_DIR = (
    PROJECT_ROOT / "docs" / "superpowers" / "specs" / "seraphic-vault"
)


def load_contract() -> dict:
    with COORDINATE_MANIFEST.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def runtime_to_blender(position: list[float] | tuple[float, float, float]) -> tuple[float, float, float]:
    return (-position[0], position[2], position[1])


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def create_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.86,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    if emission:
        emission.default_value = color
    emission_strength_input = bsdf.inputs.get("Emission Strength")
    if emission_strength_input:
        emission_strength_input.default_value = emission_strength
    return material


def tag_object(obj: bpy.types.Object, platform_id: str, role: str) -> None:
    obj["tka_scene"] = "seraphic-vault"
    obj["tka_gate"] = 2
    obj["tka_platform"] = platform_id
    obj["tka_role"] = role


def bevel_object(obj: bpy.types.Object, width: float) -> None:
    modifier = obj.modifiers.new("Gate2 softened silhouette", "BEVEL")
    modifier.width = width
    modifier.segments = 3
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    except RuntimeError:
        pass
    try:
        bpy.ops.object.shade_smooth_by_angle()
    except RuntimeError:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def create_irregular_slab(
    platform_id: str,
    width: float,
    depth: float,
    thickness: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
) -> bpy.types.Object:
    rng = random.Random(f"seraphic-vault:{platform_id}")
    segment_count = 14
    outline = []
    for index in range(segment_count):
        angle = math.tau * index / segment_count
        variation = 0.9 + rng.uniform(-0.08, 0.08)
        outline.append(
            (
                math.cos(angle) * width * 0.5 * variation,
                math.sin(angle) * depth * 0.5 * variation,
            )
        )

    vertices = [(x, y, thickness * 0.5) for x, y in outline]
    vertices.extend((x, y, -thickness * 0.5) for x, y in outline)
    faces = [tuple(range(segment_count)), tuple(reversed(range(segment_count, segment_count * 2)))]
    for index in range(segment_count):
        next_index = (index + 1) % segment_count
        faces.append((index, next_index, segment_count + next_index, segment_count + index))

    mesh = bpy.data.meshes.new(f"Gate2_{platform_id}_DeckMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Gate2_{platform_id}_Deck", mesh)
    collection.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(material)
    tag_object(obj, platform_id, "graybox-deck")
    bevel_object(obj, min(0.18, thickness * 0.2))
    return obj


def create_curve_mesh(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    platform_id: str,
    role: str,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
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
    y: float,
    z_offset: float,
    count: int = 16,
) -> list[tuple[float, float, float]]:
    return [
        (
            math.cos(math.radians(start_degrees + (end_degrees - start_degrees) * index / (count - 1))) * radius,
            y,
            math.sin(math.radians(start_degrees + (end_degrees - start_degrees) * index / (count - 1))) * radius + z_offset,
        )
        for index in range(count)
    ]


def add_cloud_collar(
    platform: dict,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    platform_id = platform["id"]
    radius = platform["dimensions"]["cloudCollarRadius"]
    deck_depth = platform["dimensions"]["depth"]
    rng = random.Random(f"seraphic-clouds:{platform_id}")
    puff_count = 9 if platform_id == "broken-vigil" else 7
    for index in range(puff_count):
        angle = math.tau * index / puff_count + rng.uniform(-0.1, 0.1)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
        puff = bpy.context.object
        puff.name = f"Gate2_{platform_id}_Cloud_{index:02d}"
        move_to_collection(puff, collection)
        puff.parent = root
        puff.location = (
            math.cos(angle) * radius * 0.64,
            math.sin(angle) * min(radius * 0.34, deck_depth * 0.58),
            -platform["dimensions"]["thickness"] * 0.12 + rng.uniform(-0.18, 0.15),
        )
        scale = radius * rng.uniform(0.12, 0.19)
        puff.scale = (scale * 1.8, scale, scale * 0.62)
        puff.data.materials.append(material)
        tag_object(puff, platform_id, "graybox-cloud-collar")
        bpy.ops.object.shade_smooth()


def add_broken_vigil(
    platform: dict,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    width = platform["dimensions"]["width"]
    top = platform["dimensions"]["thickness"] * 0.5
    radius = width * 0.28
    for suffix, start, end in (("Lower", 18, 72), ("Upper", 88, 147)):
        create_curve_mesh(
            f"Gate2_broken-vigil_Arc_{suffix}",
            arc_points(radius, start, end, width * 0.02, top + 0.1),
            width * 0.032,
            material,
            collection,
            root,
            platform["id"],
            "graybox-broken-feather-arc",
        )
    create_curve_mesh(
        "Gate2_broken-vigil_Quill",
        [(-radius * 0.78, 0.0, top + 0.16), (-radius * 0.1, 0.0, top + radius * 0.94)],
        width * 0.026,
        material,
        collection,
        root,
        platform["id"],
        "graybox-broken-feather-quill",
    )


def add_twin_choir(
    platform: dict,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    width = platform["dimensions"]["width"]
    top = platform["dimensions"]["thickness"] * 0.5
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cone_add(
            vertices=7,
            radius1=width * 0.095,
            radius2=width * 0.018,
            depth=width * 0.58,
        )
        spire = bpy.context.object
        spire.name = f"Gate2_twin-choir_Spire_{'Left' if side < 0 else 'Right'}"
        move_to_collection(spire, collection)
        spire.parent = root
        spire.location = (side * width * 0.22, width * 0.02, top + width * 0.29)
        spire.rotation_euler[1] = math.radians(side * -8.0)
        spire.data.materials.append(material)
        tag_object(spire, platform["id"], "graybox-feather-spire")
        bevel_object(spire, width * 0.018)


def add_eroded_halo(
    platform: dict,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    solid_width = platform["dimensions"]["solidSilhouetteWidth"]
    top = platform["dimensions"]["thickness"] * 0.5
    radius = solid_width * 0.39
    for suffix, start, end in (("Left", 34, 156), ("Right", 204, 328)):
        create_curve_mesh(
            f"Gate2_eroded-halo_Ring_{suffix}",
            arc_points(radius, start, end, 0.0, top + radius * 0.95),
            solid_width * 0.07,
            material,
            collection,
            root,
            platform["id"],
            "graybox-eroded-ring",
        )


def add_cloud_crown(
    platform: dict,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    material: bpy.types.Material,
) -> None:
    width = platform["dimensions"]["width"]
    top = platform["dimensions"]["thickness"] * 0.5
    for index, (x_factor, height_factor) in enumerate(
        ((-0.27, 0.32), (-0.12, 0.48), (0.0, 0.6), (0.14, 0.44), (0.29, 0.3))
    ):
        bpy.ops.mesh.primitive_cone_add(
            vertices=6,
            radius1=width * (0.075 if index != 2 else 0.09),
            radius2=0.0,
            depth=width * height_factor,
        )
        crown = bpy.context.object
        crown.name = f"Gate2_cloud-crown_Crown_{index:02d}"
        move_to_collection(crown, collection)
        crown.parent = root
        crown.location = (width * x_factor, 0.0, top + width * height_factor * 0.5)
        crown.data.materials.append(material)
        tag_object(crown, platform["id"], "graybox-cloud-crown")
        bevel_object(crown, width * 0.012)


def create_platforms(contract: dict) -> tuple[bpy.types.Collection, dict[str, bpy.types.Object]]:
    old_collection = bpy.data.collections.get("Gate2_DistantPlatforms")
    if old_collection:
        for obj in list(old_collection.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old_collection)

    collection = bpy.data.collections.new("Gate2_DistantPlatforms")
    bpy.context.scene.collection.children.link(collection)
    stone_colors = {
        "broken-vigil": (0.78, 0.73, 0.64, 1.0),
        "twin-choir": (0.56, 0.68, 0.79, 1.0),
        "eroded-halo": (0.40, 0.56, 0.71, 1.0),
        "cloud-crown": (0.30, 0.47, 0.64, 1.0),
    }
    roots = {}
    for platform in contract["platforms"]:
        platform_id = platform["id"]
        stone = create_material(
            f"Gate2_{platform_id}_Stone",
            stone_colors[platform_id],
            roughness=0.82,
            emission_strength=0.025 + platform["blueShift"] * 0.05,
        )
        cloud = create_material(
            f"Gate2_{platform_id}_Cloud",
            (
                0.72 - platform["blueShift"] * 0.12,
                0.82 - platform["blueShift"] * 0.05,
                0.94,
                1.0,
            ),
            roughness=1.0,
            emission_strength=0.08,
        )
        root = bpy.data.objects.new(f"Gate2_{platform_id}_Root", None)
        collection.objects.link(root)
        root.empty_display_type = "CIRCLE"
        root.empty_display_size = max(0.4, platform["dimensions"]["width"] * 0.08)
        tag_object(root, platform_id, "responsive-platform-root")
        roots[platform_id] = root
        create_irregular_slab(
            platform_id,
            platform["dimensions"]["solidSilhouetteWidth"],
            platform["dimensions"]["depth"],
            platform["dimensions"]["thickness"],
            stone,
            collection,
            root,
        )
        add_cloud_collar(platform, collection, root, cloud)
        if platform_id == "broken-vigil":
            add_broken_vigil(platform, collection, root, stone)
        elif platform_id == "twin-choir":
            add_twin_choir(platform, collection, root, stone)
        elif platform_id == "eroded-halo":
            add_eroded_halo(platform, collection, root, stone)
        elif platform_id == "cloud-crown":
            add_cloud_crown(platform, collection, root, stone)
    return collection, roots


def set_platform_positions(contract: dict, roots: dict[str, bpy.types.Object], preset_name: str) -> None:
    for platform in contract["platforms"]:
        roots[platform["id"]].location = runtime_to_blender(platform["positions"][preset_name])
    bpy.context.view_layer.update()


def create_registered_camera(name: str, preset: dict) -> bpy.types.Object:
    existing = bpy.data.objects.get(name)
    if existing:
        bpy.data.objects.remove(existing, do_unlink=True)
    data = bpy.data.cameras.new(f"{name}Data")
    data.type = "PERSP"
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 36.0
    data.lens = data.sensor_height / (2.0 * math.tan(math.radians(preset["fovDegrees"]) * 0.5))
    data.clip_end = 300.0
    camera = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = runtime_to_blender(preset["position"])
    look_at(camera, runtime_to_blender(preset["target"]))
    camera["tka_registered_fov_degrees"] = preset["fovDegrees"]
    camera["tka_registered_aspect"] = preset["aspect"]
    return camera


def create_orthographic_camera(
    name: str,
    position: tuple[float, float, float],
    target: tuple[float, float, float],
    scale: float,
) -> bpy.types.Object:
    data = bpy.data.cameras.new(f"{name}Data")
    data.type = "ORTHO"
    data.ortho_scale = scale
    data.clip_end = 400.0
    camera = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = position
    look_at(camera, target)
    return camera


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium Low Contrast"
    scene.render.image_settings.compression = 35


def render_registered_views(contract: dict, roots: dict[str, bpy.types.Object]) -> list[str]:
    scene = bpy.context.scene
    outputs = []
    render_settings = {
        "desktop": (1600, 900, "seraphic-vault-gate2-desktop.png"),
        "portrait": (675, 1200, "seraphic-vault-gate2-portrait.png"),
        "landscapePhone": (1600, 687, "seraphic-vault-gate2-landscape-phone.png"),
    }
    for preset_name, (width, height, filename) in render_settings.items():
        set_platform_positions(contract, roots, preset_name)
        camera = create_registered_camera(
            f"Gate2_Camera_{preset_name}", contract["cameraPresets"][preset_name]
        )
        scene.camera = camera
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.filepath = str(EVIDENCE_DIR / filename)
        bpy.ops.render.render(write_still=True)
        outputs.append(scene.render.filepath)

    set_platform_positions(contract, roots, "desktop")
    spatial_cameras = (
        (
            "Gate2_Camera_Overview",
            (0.0, -14.0, 90.0),
            (0.0, -14.0, 0.0),
            106.0,
            1600,
            900,
            "seraphic-vault-gate2-overview.png",
        ),
        (
            "Gate2_Camera_Profile",
            (90.0, -14.0, 12.0),
            (0.0, -14.0, 1.0),
            90.0,
            1600,
            900,
            "seraphic-vault-gate2-profile.png",
        ),
    )
    cloud_visibility = {
        obj.name: obj.hide_render
        for obj in bpy.data.objects
        if obj.name.startswith("QA_Cloud_")
    }
    for object_name in cloud_visibility:
        bpy.data.objects[object_name].hide_render = True
    for name, position, target, scale, width, height, filename in spatial_cameras:
        camera = create_orthographic_camera(name, position, target, scale)
        scene.camera = camera
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.filepath = str(EVIDENCE_DIR / filename)
        bpy.ops.render.render(write_still=True)
        outputs.append(scene.render.filepath)
    for object_name, was_hidden in cloud_visibility.items():
        bpy.data.objects[object_name].hide_render = was_hidden
    return outputs


def export_graybox() -> list[str]:
    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    selected = []
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.name.startswith("AssetSource_") or obj.hide_render:
            continue
        obj.select_set(True)
        selected.append(obj.name)
    if not selected:
        raise RuntimeError("No visible graybox meshes were available for export")
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )
    return selected


def main() -> None:
    if not SOURCE_BLEND.exists():
        raise FileNotFoundError(SOURCE_BLEND)
    if not COORDINATE_MANIFEST.exists():
        raise FileNotFoundError(COORDINATE_MANIFEST)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    contract = load_contract()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
    _, roots = create_platforms(contract)
    set_platform_positions(contract, roots, "desktop")
    configure_render()
    renders = render_registered_views(contract, roots)
    set_platform_positions(contract, roots, "desktop")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    selected = export_graybox()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(json.dumps({
        "blend": str(OUTPUT_BLEND),
        "glb": str(OUTPUT_GLB),
        "renderCount": len(renders),
        "renders": renders,
        "exportedMeshCount": len(selected),
    }, indent=2))


main()
