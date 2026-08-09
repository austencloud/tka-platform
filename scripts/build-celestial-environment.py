"""Author and review the Seraphic Vault environment in Blender.

The approved Meshy feather families become linked, mirrored set pieces around
one broad performance floor. Clouds, sun disk, lights, and cameras belong only
to the QA render. The clean exporter excludes every ``QA_`` and
``AssetSource_`` object from the runtime GLB.
"""

from __future__ import annotations

import math
import os
import random
import tempfile

import bpy
import numpy as np
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
SOURCE_DIR = os.path.join(PROJECT_ROOT, "static", "models", "celestial", "source")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "celestial_environment.blend")
QA_DIR = os.path.join(tempfile.gettempdir(), "tka-celestial-evidence")

ASSETS = {
    "outer": {
        "path": os.path.join(SOURCE_DIR, "outer-feather-rib_raw.glb"),
        "height": 14.0,
        "x": 9.2,
        "y": -1.5,
        "yaw": math.radians(6.0),
    },
    "middle": {
        "path": os.path.join(SOURCE_DIR, "middle-feather-rib_raw.glb"),
        "height": 10.0,
        "x": 6.4,
        "y": -5.2,
        "yaw": math.radians(4.0),
    },
    "inner": {
        "path": os.path.join(SOURCE_DIR, "inner-feather-spire_raw.glb"),
        "height": 7.0,
        "x": 3.8,
        "y": -8.2,
        "yaw": math.radians(2.0),
    },
}

CAMERAS = {
    "hero": ((0.0, 34.0, 7.8), (0.0, -3.8, 3.0), 50.0),
    "wide": ((0.0, 46.0, 13.0), (0.0, -3.0, 3.8), 54.0),
    "stage": ((13.0, 18.0, 4.5), (0.0, -0.5, 0.5), 46.0),
}


def reset_scene() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.worlds,
    ):
        for block in list(blocks):
            blocks.remove(block)


def principled_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        strength_input = bsdf.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = emission
        if strength_input:
            strength_input.default_value = emission_strength
    return material


def create_travertine_image(
    name: str,
    base_color: tuple[float, float, float],
    vein_color: tuple[float, float, float],
    phase: float,
    size: int = 1024,
) -> bpy.types.Image:
    """Create a restrained, tileable heaven-stone color map for glTF export."""
    y, x = np.mgrid[0:size, 0:size]
    u = x.astype(np.float32) / float(size)
    v = y.astype(np.float32) / float(size)

    broad_flow = v * 3.4 + np.sin((u + phase) * math.tau) * 0.12
    fine_flow = v * 13.0 + u * 1.7 + np.sin((u * 2.2 + phase) * math.tau) * 0.22
    grain = (
        np.sin((u * 5.0 + v * 2.3 + phase) * math.tau) * 0.018
        + np.sin((u * 17.0 - v * 9.0 + phase * 1.7) * math.tau) * 0.009
        + np.sin((u * 41.0 + v * 29.0) * math.tau) * 0.004
    )
    vein_distance = np.abs(np.sin(broad_flow * math.pi))
    veins = np.exp(-np.square(vein_distance / 0.13)) * 0.18
    pores = np.exp(-np.square(np.abs(np.sin(fine_flow * math.pi)) / 0.08)) * 0.035
    variation = grain[..., None]

    base = np.array(base_color, dtype=np.float32)
    vein = np.array(vein_color, dtype=np.float32)
    color = np.broadcast_to(base, (size, size, 3)).copy()
    color += variation
    color = color * (1.0 - veins[..., None]) + vein * veins[..., None]
    color -= pores[..., None]
    color = np.clip(color, 0.0, 1.0)

    alpha = np.ones((size, size, 1), dtype=np.float32)
    pixels = np.concatenate((color, alpha), axis=2)
    image = bpy.data.images.new(name, width=size, height=size, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels.reshape(-1))
    image.pack()
    return image


def attach_base_color_texture(material: bpy.types.Material, image: bpy.types.Image) -> None:
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = f"{material.name}_BaseColor"
    texture.image = image
    texture.interpolation = "Linear"
    links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])


def object_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    maximum = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    return minimum, maximum


def configure_imported_materials(obj: bpy.types.Object) -> None:
    for slot in obj.material_slots:
        material = slot.material
        if not material or not material.use_nodes:
            continue
        material.name = f"Celestial_{material.name}"
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            for link in list(emission_input.links):
                material.node_tree.links.remove(link)
            emission_input.default_value = (0.0, 0.0, 0.0, 1.0)
        strength_input = bsdf.inputs.get("Emission Strength")
        if strength_input:
            for link in list(strength_input.links):
                material.node_tree.links.remove(link)
            strength_input.default_value = 0.0


def import_normalized_source(family: str, path: str, target_height: float) -> bpy.types.Object:
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{family} imported without mesh geometry")

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
    source = bpy.context.view_layer.objects.active
    source.name = f"AssetSource_{family.title()}FeatherRib"

    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.view_layer.update()
    minimum, maximum = object_bounds(source)
    height = maximum.z - minimum.z
    if height <= 0:
        raise RuntimeError(f"{family} source height is invalid: {height}")
    uniform_scale = target_height / height
    source.scale = (uniform_scale, uniform_scale, uniform_scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.view_layer.update()

    minimum, maximum = object_bounds(source)
    center = (minimum + maximum) * 0.5
    source.location.x -= center.x
    source.location.y -= center.y
    source.location.z -= minimum.z
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    configure_imported_materials(source)

    source["tka_role"] = "asset-source"
    source["tka_family"] = family
    source["tka_target_height"] = target_height
    source.hide_render = True
    source.hide_set(True)
    return source


def place_rib_pair(family: str, source: bpy.types.Object, config: dict[str, float]) -> None:
    target_collection = bpy.context.scene.collection
    for side, x, mirror, yaw_sign in (
        ("left", -config["x"], 1.0, 1.0),
        ("right", config["x"], -1.0, -1.0),
    ):
        placed = source.copy()
        placed.data = source.data
        target_collection.objects.link(placed)
        placed.name = f"FeatherRib_{family.title()}_{side.title()}"
        placed.hide_render = False
        placed.hide_set(False)
        placed.location = (x, config["y"], 0.0)
        placed.scale = (mirror, 1.0, 1.0)
        placed.rotation_euler[2] = config["yaw"] * yaw_sign
        placed["tka_role"] = "feather-rib"
        placed["tka_family"] = family
        placed["tka_side"] = side
        placed["tka_target_height"] = config["height"]
        placed["tka_performer_clearance"] = abs(x)


def create_extruded_slab(
    name: str,
    outline: list[tuple[float, float]],
    top: float,
    bottom: float,
    material: bpy.types.Material,
    role: str,
) -> bpy.types.Object:
    count = len(outline)
    vertices = [(x, y, top) for x, y in outline] + [(x, y, bottom) for x, y in outline]
    faces: list[tuple[int, ...]] = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    min_x = min(x for x, _ in outline)
    max_x = max(x for x, _ in outline)
    min_y = min(y for _, y in outline)
    max_y = max(y for _, y in outline)
    width = max(max_x - min_x, 0.001)
    depth = max(max_y - min_y, 0.001)
    for polygon_index, polygon in enumerate(mesh.polygons):
        if polygon_index < 2:
            for loop_index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv_layer.data[loop_index].uv = (
                    (vertex.x - min_x) / width,
                    (vertex.y - min_y) / depth,
                )
        else:
            side_uvs = ((0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0))
            for side_index, loop_index in enumerate(polygon.loop_indices):
                uv_layer.data[loop_index].uv = side_uvs[side_index]
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["tka_role"] = role
    obj["tka_surface_y"] = top
    obj["tka_performance_clear_radius"] = 5.5 if role == "performance-floor" else 0.0
    bevel = obj.modifiers.new("Soft ancient edges", "BEVEL")
    bevel.width = 0.12
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth_by_angle()
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)
    return obj


def create_floor() -> None:
    floor_image = create_travertine_image(
        "SeraphicTravertine",
        (0.88, 0.83, 0.73),
        (0.57, 0.61, 0.67),
        phase=0.17,
    )
    edge_image = create_travertine_image(
        "SeraphicTravertineEdges",
        (0.64, 0.67, 0.70),
        (0.37, 0.43, 0.51),
        phase=0.61,
    )
    alabaster = principled_material(
        "AlabasterPerformanceFloor",
        (1.0, 1.0, 1.0, 1.0),
        roughness=0.76,
    )
    edge_stone = principled_material(
        "AlabasterBrokenEdges",
        (1.0, 1.0, 1.0, 1.0),
        roughness=0.86,
    )
    attach_base_color_texture(alabaster, floor_image)
    attach_base_color_texture(edge_stone, edge_image)
    main_outline = [
        (-9.7, -7.7), (-5.8, -9.5), (2.5, -9.8), (8.6, -8.6),
        (10.3, -3.9), (10.7, 2.2), (8.7, 6.2), (3.5, 7.4),
        (-2.7, 7.6), (-8.2, 6.8), (-10.4, 2.9), (-10.1, -2.4),
    ]
    create_extruded_slab("Stage_Main", main_outline, 0.01, -0.52, alabaster, "performance-floor")
    create_extruded_slab(
        "Stage_LeftFragment",
        [(-12.4, -3.8), (-10.8, -5.2), (-10.5, 0.8), (-12.7, 2.3), (-13.4, -0.8)],
        -0.06,
        -0.64,
        edge_stone,
        "stage-fragment",
    )
    create_extruded_slab(
        "Stage_RightFragment",
        [(10.8, -6.4), (13.0, -5.3), (13.7, -1.6), (12.2, 0.2), (10.7, -1.4)],
        -0.09,
        -0.68,
        edge_stone,
        "stage-fragment",
    )
    create_extruded_slab(
        "Stage_RearFragment",
        [(-4.8, -11.0), (1.2, -11.4), (4.9, -10.2), (2.5, -9.9), (-4.1, -9.8)],
        -0.11,
        -0.66,
        edge_stone,
        "stage-fragment",
    )


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_qa_clouds() -> None:
    random.seed(20260809)
    cloud_material = principled_material(
        "QA_CloudMaterial",
        (0.78, 0.84, 0.94, 1.0),
        roughness=1.0,
        emission=(0.20, 0.24, 0.31, 1.0),
        emission_strength=0.12,
    )
    banks = [
        (-12.0, 0.0, 0.0, 4.8, 2.0),
        (12.0, -0.5, 0.1, 4.5, 2.0),
        (-8.5, -9.5, 0.0, 5.3, 2.2),
        (8.8, -10.2, -0.1, 5.5, 2.3),
        (0.0, -15.0, 0.6, 7.0, 2.4),
        (-7.5, 6.8, -1.0, 2.7, 1.1),
        (7.5, 7.2, -1.0, 2.7, 1.1),
    ]
    puff_index = 0
    for bank_x, bank_y, bank_z, width, height in banks:
        for _ in range(6):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
            puff = bpy.context.object
            puff.name = f"QA_Cloud_{puff_index:03d}"
            puff_index += 1
            puff.location = (
                bank_x + random.uniform(-width, width),
                bank_y + random.uniform(-width * 0.35, width * 0.35),
                bank_z + random.uniform(-0.3, height * 0.55),
            )
            scale = random.uniform(0.85, 1.8)
            puff.scale = (scale * random.uniform(1.3, 2.1), scale * random.uniform(0.9, 1.4), scale)
            puff.data.materials.append(cloud_material)
            bpy.ops.object.shade_smooth()


def create_qa_lighting() -> None:
    world = bpy.data.worlds.new("SeraphicSky")
    world.use_nodes = True
    nodes = world.node_tree.nodes
    background = nodes.get("Background")
    background.inputs["Color"].default_value = (0.36, 0.58, 0.88, 1.0)
    background.inputs["Strength"].default_value = 0.72
    bpy.context.scene.world = world

    sun_material = principled_material(
        "QA_SunMaterial",
        (1.0, 0.72, 0.30, 1.0),
        roughness=0.2,
        emission=(1.0, 0.56, 0.18, 1.0),
        emission_strength=8.0,
    )
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.5, location=(0.0, -30.0, 3.2))
    sun_disk = bpy.context.object
    sun_disk.name = "QA_SunDisk"
    sun_disk.data.materials.append(sun_material)

    sun_data = bpy.data.lights.new("QA_SunKey", type="SUN")
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.72, 0.42)
    sun = bpy.data.objects.new("QA_SunKey", sun_data)
    bpy.context.scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(24.0), math.radians(-12.0), math.radians(-168.0))

    area_data = bpy.data.lights.new("QA_SunBloom", type="AREA")
    area_data.energy = 2100.0
    area_data.shape = "DISK"
    area_data.size = 8.0
    area_data.color = (1.0, 0.65, 0.34)
    area = bpy.data.objects.new("QA_SunBloom", area_data)
    bpy.context.scene.collection.objects.link(area)
    area.location = (0.0, -18.0, 10.0)
    look_at(area, (0.0, 0.0, 1.0))

    fill_data = bpy.data.lights.new("QA_CoolFill", type="AREA")
    fill_data.energy = 1800.0
    fill_data.size = 18.0
    fill_data.color = (0.48, 0.66, 1.0)
    fill = bpy.data.objects.new("QA_CoolFill", fill_data)
    bpy.context.scene.collection.objects.link(fill)
    fill.location = (-12.0, 9.0, 13.0)
    look_at(fill, (0.0, -2.0, 3.0))

    front_data = bpy.data.lights.new("QA_FrontFill", type="AREA")
    front_data.energy = 3600.0
    front_data.size = 22.0
    front_data.color = (0.68, 0.80, 1.0)
    front = bpy.data.objects.new("QA_FrontFill", front_data)
    bpy.context.scene.collection.objects.link(front)
    front.location = (0.0, 22.0, 13.0)
    look_at(front, (0.0, -3.0, 3.0))


def create_camera(name: str, position: tuple[float, float, float], target: tuple[float, float, float], lens: float) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = 36.0
    camera = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = position
    look_at(camera, target)
    return camera


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium Low Contrast"


def render_qa() -> None:
    os.makedirs(QA_DIR, exist_ok=True)
    scene = bpy.context.scene
    for name, (position, target, lens) in CAMERAS.items():
        camera = create_camera(f"QA_Camera_{name.title()}", position, target, lens)
        scene.camera = camera
        scene.render.filepath = os.path.join(QA_DIR, f"celestial_environment_{name}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    reset_scene()
    create_floor()
    for family, config in ASSETS.items():
        source = import_normalized_source(family, config["path"], config["height"])
        place_rib_pair(family, source, config)
    create_qa_clouds()
    create_qa_lighting()
    configure_render()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    render_qa()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"Seraphic Vault blend: {BLEND_PATH}")
    print(f"QA renders: {QA_DIR}")


main()
