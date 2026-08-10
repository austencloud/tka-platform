"""Build the Olive Cloudbreak Gate 4 production slice.

The approved Gate 2 coordinate manifest remains the geometry owner. This pass
adds production stone, lagoon, olive, mesa, and waterfall treatment without
changing the registered layout.
"""

from __future__ import annotations

import json
import math
import random
import struct
import zlib
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = PROJECT_ROOT / "docs" / "superpowers" / "specs" / "seraphic-vault"
MANIFEST_PATH = SPEC_DIR / "seraphic-vault-gate2-cloudbreak-r2-coordinate-manifest.json"
TEXTURE_DIR = PROJECT_ROOT / "static" / "textures" / "celestial" / "olive-cloudbreak"
BLEND_PATH = PROJECT_ROOT / "blender" / "olive_cloudbreak_production_slice.blend"
RAW_GLB_PATH = (
    PROJECT_ROOT
    / "static"
    / "models"
    / "celestial"
    / "olive-cloudbreak-production-slice_raw.glb"
)
REVISION = "olive-cloudbreak-gate4-r1"


def load_manifest() -> dict:
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def tag(obj: bpy.types.Object, role: str, element_id: str | None = None) -> None:
    obj["tka_scene"] = "seraphic-vault"
    obj["tka_revision"] = REVISION
    obj["tka_gate"] = 4
    obj["tka_role"] = role
    if element_id:
        obj["tka_element"] = element_id


def smooth_noise(values: np.ndarray, passes: int) -> np.ndarray:
    result = values
    for _ in range(passes):
        result = (
            result
            + np.roll(result, 1, axis=0)
            + np.roll(result, -1, axis=0)
            + np.roll(result, 1, axis=1)
            + np.roll(result, -1, axis=1)
        ) / 5.0
    return result


def save_texture(name: str, pixels: np.ndarray, colorspace: str = "sRGB") -> bpy.types.Image:
    height, width, _ = pixels.shape
    texture_path = TEXTURE_DIR / f"{name}.png"
    rgba = np.rint(np.clip(pixels, 0.0, 1.0) * 255.0).astype(np.uint8)
    scanlines = b"".join(b"\x00" + row.tobytes() for row in rgba)

    def png_chunk(kind: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    texture_path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk("IHDR".encode(), struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + png_chunk("IDAT".encode(), zlib.compress(scanlines, 9))
        + png_chunk("IEND".encode(), b"")
    )
    image = bpy.data.images.load(str(texture_path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = colorspace
    return image


def create_limestone_textures(size: int = 768) -> tuple[bpy.types.Image, bpy.types.Image, bpy.types.Image]:
    rng = np.random.default_rng(240810)
    fine = smooth_noise(rng.random((size, size), dtype=np.float32), 5)
    medium = smooth_noise(rng.random((size, size), dtype=np.float32), 22)
    broad = smooth_noise(rng.random((size, size), dtype=np.float32), 64)
    x = np.linspace(0.0, math.tau * 6.0, size, dtype=np.float32)
    y = np.linspace(0.0, math.tau * 3.5, size, dtype=np.float32)
    bands = np.sin(y[:, None] + np.sin(x[None, :] * 0.42) * 0.7) * 0.5 + 0.5
    height = fine * 0.24 + medium * 0.34 + broad * 0.3 + bands * 0.12
    height = (height - height.min()) / max(0.0001, float(height.max() - height.min()))

    base = np.array([0.54, 0.42, 0.28], dtype=np.float32)
    warm = np.array([0.96, 0.79, 0.52], dtype=np.float32)
    blend = (0.18 + height * 0.72)[:, :, None]
    color_rgb = base[None, None, :] * (1.0 - blend) + warm[None, None, :] * blend
    mineral = np.clip((bands - 0.58) * 2.2, 0.0, 1.0)[:, :, None]
    color_rgb = color_rgb * (1.0 - mineral * 0.13) + np.array([0.48, 0.36, 0.24], dtype=np.float32) * mineral * 0.13
    alpha = np.ones((size, size, 1), dtype=np.float32)
    color = np.concatenate((color_rgb, alpha), axis=2)

    roughness_value = np.clip(0.54 + height * 0.3 + fine * 0.09, 0.5, 0.91)
    roughness = np.concatenate((np.repeat(roughness_value[:, :, None], 3, axis=2), alpha), axis=2)

    gradient_y, gradient_x = np.gradient(height)
    normal = np.dstack((-gradient_x * 16.0, -gradient_y * 16.0, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    normal_rgb = normal * 0.5 + 0.5
    normal_map = np.concatenate((normal_rgb, alpha), axis=2)

    return (
        save_texture("limestone-color", color),
        save_texture("limestone-roughness", roughness, "Non-Color"),
        save_texture("limestone-normal", normal_map, "Non-Color"),
    )


def create_stone_material(
    name: str,
    textures: tuple[bpy.types.Image, bpy.types.Image, bpy.types.Image],
    tint: tuple[float, float, float, float],
    roughness: float,
) -> bpy.types.Material:
    color_image, roughness_image, normal_image = textures
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = tint
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0

    color_node = nodes.new("ShaderNodeTexImage")
    color_node.name = f"{name}_Color"
    color_node.image = color_image
    color_node.extension = "REPEAT"
    links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])

    roughness_node = nodes.new("ShaderNodeTexImage")
    roughness_node.name = f"{name}_Roughness"
    roughness_node.image = roughness_image
    roughness_node.extension = "REPEAT"
    roughness_node.image.colorspace_settings.name = "Non-Color"
    links.new(roughness_node.outputs["Color"], bsdf.inputs["Roughness"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = f"{name}_Normal"
    normal_node.image = normal_image
    normal_node.extension = "REPEAT"
    normal_node.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.34
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def create_plain_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    if emission:
        emission.default_value = color
    emission_strength_input = bsdf.inputs.get("Emission Strength")
    if emission_strength_input:
        emission_strength_input.default_value = emission_strength
    return material


def create_water_material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = create_plain_material(name, color, 0.16, 0.08)
    material.diffuse_color = color
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "DITHERED"
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Alpha"].default_value = color[3]
    transmission = bsdf.inputs.get("Transmission Weight") or bsdf.inputs.get("Transmission")
    if transmission:
        transmission.default_value = 0.22
    ior = bsdf.inputs.get("IOR")
    if ior:
        ior.default_value = 1.333
    return material


def bevel(obj: bpy.types.Object, width: float, segments: int = 3) -> None:
    modifier = obj.modifiers.new("Wind-softened edge", "BEVEL")
    modifier.width = width
    modifier.segments = segments
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


def project_uv(obj: bpy.types.Object, scale: float) -> None:
    if obj.type != "MESH" or not obj.data.polygons:
        return
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    try:
        bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    except RuntimeError:
        pass
    bpy.ops.object.mode_set(mode="OBJECT")
    if obj.data.uv_layers.active:
        for loop in obj.data.uv_layers.active.data:
            loop.uv *= scale
    obj.select_set(False)


def scaled_outline(outline: list[list[float]], scale: float) -> list[list[float]]:
    center_x = sum(point[0] for point in outline) / len(outline)
    center_y = sum(point[1] for point in outline) / len(outline)
    return [
        [center_x + (x - center_x) * scale, center_y + (y - center_y) * scale]
        for x, y in outline
    ]


def create_extruded_polygon(
    name: str,
    outline_xy: list[list[float]],
    top_z: float,
    thickness: float,
    material: bpy.types.Material,
    role: str,
    element_id: str | None = None,
    uv_scale: float = 4.0,
) -> bpy.types.Object:
    count = len(outline_xy)
    bottom_z = top_z - thickness
    vertices = [(x, y, top_z) for x, y in outline_xy]
    vertices.extend((x, y, bottom_z) for x, y in outline_xy)
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    bevel(obj, min(0.24, thickness * 0.035), 4)
    project_uv(obj, uv_scale)
    return obj


def create_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    role: str,
    element_id: str,
    vertices: int = 64,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    bevel(obj, min(0.12, depth * 0.06), 3)
    project_uv(obj, 3.0)
    return obj


def create_branch(
    name: str,
    start: Vector,
    end: Vector,
    start_radius: float,
    end_radius: float,
    material: bpy.types.Material,
    element_id: str,
) -> bpy.types.Object:
    direction = end - start
    midpoint = (start + end) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=start_radius,
        radius2=end_radius,
        depth=direction.length,
        location=midpoint,
    )
    branch = bpy.context.object
    branch.name = name
    branch.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    branch.data.materials.append(material)
    tag(branch, "cloudbreak-olive-trunk", element_id)
    bevel(branch, min(0.08, end_radius * 0.5), 2)
    return branch


def create_foliage_cluster(
    name: str,
    center: Vector,
    width: float,
    material: bpy.types.Material,
    element_id: str,
    seed: int,
) -> bpy.types.Object:
    rng = random.Random(seed)
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    bm = bmesh.new()
    for index in range(15):
        angle = math.tau * index / 15 + rng.uniform(-0.24, 0.24)
        radial = width * (0.12 + rng.random() * 0.34)
        offset = Vector(
            (
                math.cos(angle) * radial,
                math.sin(angle) * radial * 0.62,
                rng.uniform(-0.34, 0.46),
            )
        )
        scale = Vector(
            (
                width * rng.uniform(0.19, 0.31),
                width * rng.uniform(0.14, 0.24),
                width * rng.uniform(0.09, 0.16),
            )
        )
        result = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        verts = result["verts"]
        transform = Matrix.Translation(offset) @ Matrix.Diagonal((*scale, 1.0))
        bmesh.ops.transform(bm, matrix=transform, verts=verts)
    bm.to_mesh(mesh)
    bm.free()
    foliage = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(foliage)
    foliage.location = center
    foliage.data.materials.append(material)
    tag(foliage, "cloudbreak-olive-canopy", element_id)
    bpy.context.view_layer.objects.active = foliage
    foliage.select_set(True)
    bpy.ops.object.shade_smooth()
    foliage.select_set(False)
    return foliage


def create_olive_tree(
    tree: dict,
    bark_material: bpy.types.Material,
    foliage_material: bpy.types.Material,
    stone_material: bpy.types.Material,
    seed: int,
) -> None:
    x, y, surface_z = tree["blenderPosition"]
    height = tree["height"]
    root = Vector((x, y, surface_z + 0.04))
    elbow = root + Vector((0.22 if seed % 2 else -0.2, -0.05, height * 0.34))
    crown = root + Vector((-0.18 if seed % 2 else 0.16, 0.02, height * 0.66))
    branches = [
        create_branch(f"{tree['id']}_TrunkLower", root, elbow, 0.52, 0.38, bark_material, tree["id"]),
        create_branch(f"{tree['id']}_TrunkUpper", elbow, crown, 0.39, 0.24, bark_material, tree["id"]),
    ]
    for index, (dx, dy, dz) in enumerate(
        [(-1.5, 0.05, 1.1), (1.55, -0.1, 0.95), (-0.78, 0.62, 1.35), (0.82, 0.5, 1.28), (0.1, -0.72, 1.12)]
    ):
        start = crown + Vector((dx * 0.12, dy * 0.12, index * 0.04))
        end = crown + Vector((dx, dy, dz))
        branches.append(
            create_branch(
                f"{tree['id']}_Branch_{index:02d}",
                start,
                end,
                0.2,
                0.075,
                bark_material,
                tree["id"],
            )
        )

    bpy.ops.object.select_all(action="DESELECT")
    for branch in branches:
        branch.select_set(True)
    bpy.context.view_layer.objects.active = branches[0]
    bpy.ops.object.join()
    trunk = bpy.context.object
    trunk.name = f"{tree['id']}_Trunk"
    tag(trunk, "cloudbreak-olive-trunk", tree["id"])
    trunk.select_set(False)

    create_foliage_cluster(
        f"{tree['id']}_Canopy",
        crown + Vector((0.0, 0.0, height * 0.22)),
        5.0,
        foliage_material,
        tree["id"],
        seed,
    )

    for index in range(9):
        angle = math.tau * index / 9 + seed * 0.31
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1,
            radius=0.32 + (index % 3) * 0.07,
            location=(x + math.cos(angle) * 0.72, y + math.sin(angle) * 0.56, surface_z + 0.12),
        )
        root_stone = bpy.context.object
        root_stone.name = f"{tree['id']}_RootStone_{index:02d}"
        root_stone.scale = (1.4, 0.9, 0.55)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        root_stone.data.materials.append(stone_material)
        tag(root_stone, "cloudbreak-root-stone", tree["id"])
        project_uv(root_stone, 1.5)


def irregular_outline(center_x: float, center_y: float, width: float, seed: str, segments: int = 18) -> list[list[float]]:
    rng = random.Random(seed)
    return [
        [
            center_x + math.cos(math.tau * index / segments) * width * 0.5 * (1.0 + rng.uniform(-0.12, 0.09)),
            center_y + math.sin(math.tau * index / segments) * width * 0.5 * (1.0 + rng.uniform(-0.12, 0.09)),
        ]
        for index in range(segments)
    ]


def create_irregular_mesa(
    mesa: dict,
    stone_material: bpy.types.Material,
    cap_material: bpy.types.Material,
) -> None:
    x, y, top_z = mesa["blenderPosition"]
    base_z = mesa["cloudBaseY"]
    width = mesa["width"]
    rng = random.Random(f"cloudbreak-mesa:{mesa['id']}")
    segments = 26
    levels = [
        (base_z, 0.34),
        (base_z + (top_z - base_z) * 0.16, 0.37),
        (base_z + (top_z - base_z) * 0.34, 0.4),
        (base_z + (top_z - base_z) * 0.53, 0.39),
        (base_z + (top_z - base_z) * 0.71, 0.44),
        (base_z + (top_z - base_z) * 0.87, 0.47),
        (top_z, 0.52),
    ]
    vertices: list[tuple[float, float, float]] = []
    for level_index, (z, radius_factor) in enumerate(levels):
        offset_x = math.sin(level_index * 1.7) * width * 0.025
        offset_y = math.cos(level_index * 1.3) * width * 0.018
        for index in range(segments):
            angle = math.tau * index / segments
            variation = 1.0 + rng.uniform(-0.13, 0.1)
            vertices.append(
                (
                    x + offset_x + math.cos(angle) * width * radius_factor * variation,
                    y + offset_y + math.sin(angle) * width * radius_factor * variation,
                    z,
                )
            )
    faces = [tuple(reversed(range(segments)))]
    for level_index in range(len(levels) - 1):
        lower = level_index * segments
        upper = (level_index + 1) * segments
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append((lower + index, lower + next_index, upper + next_index, upper + index))
    top_start = (len(levels) - 1) * segments
    faces.append(tuple(top_start + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"Mesa_{mesa['id']}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    body = bpy.data.objects.new(f"Mesa_{mesa['id']}_Body", mesh)
    bpy.context.collection.objects.link(body)
    body.data.materials.append(stone_material)
    tag(body, "cloudbreak-distant-mesa", mesa["id"])
    bevel(body, 0.14, 3)
    for polygon in body.data.polygons:
        polygon.use_smooth = False
    project_uv(body, 3.0)

    create_extruded_polygon(
        f"Mesa_{mesa['id']}_Cap",
        irregular_outline(x, y, width, f"mesa-cap:{mesa['id']}"),
        top_z + 0.28,
        0.36,
        cap_material,
        "cloudbreak-distant-mesa-cap",
        mesa["id"],
        2.0,
    )


def create_waterfall_ribbon(
    name: str,
    start: Vector,
    end: Vector,
    width: float,
    material: bpy.types.Material,
    element_id: str,
) -> bpy.types.Object:
    segments = 12
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments + 1):
        progress = index / segments
        point = start.lerp(end, progress)
        point.y += math.sin(progress * math.tau * 1.6) * 0.06
        taper = 1.0 - progress * 0.36
        vertices.extend(
            [
                (point.x - width * taper * 0.5, point.y, point.z),
                (point.x + width * taper * 0.5, point.y, point.z),
            ]
        )
        if index > 0:
            previous = (index - 1) * 2
            current = index * 2
            faces.append((previous, previous + 1, current + 1, current))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    waterfall = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(waterfall)
    waterfall.data.materials.append(material)
    tag(waterfall, "cloudbreak-waterfall", element_id)
    return waterfall


def create_lagoon_rim(
    outline: list[list[float]],
    surface_z: float,
    material: bpy.types.Material,
) -> None:
    mesh = bpy.data.meshes.new("LagoonRimMesh")
    bm = bmesh.new()
    for index, point in enumerate(outline):
        next_point = outline[(index + 1) % len(outline)]
        for step in range(3):
            progress = step / 3
            x = point[0] + (next_point[0] - point[0]) * progress
            y = point[1] + (next_point[1] - point[1]) * progress
            result = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.42 + (index % 3) * 0.06)
            verts = result["verts"]
            scale = Vector((1.45, 0.85, 0.5))
            transform = Matrix.Translation(Vector((x, y, surface_z + 0.08))) @ Matrix.Diagonal((*scale, 1.0))
            bmesh.ops.transform(bm, matrix=transform, verts=verts)
    bm.to_mesh(mesh)
    bm.free()
    rim = bpy.data.objects.new("Lagoon_NaturalStoneRim", mesh)
    bpy.context.collection.objects.link(rim)
    rim.data.materials.append(material)
    tag(rim, "cloudbreak-lagoon-rim", "lagoon")
    project_uv(rim, 2.0)


def point_in_polygon(x: float, y: float, outline: list[list[float]]) -> bool:
    inside = False
    previous = outline[-1]
    for current in outline:
        x1, y1 = previous
        x2, y2 = current
        crosses = (y1 > y) != (y2 > y)
        if crosses and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
        previous = current
    return inside


def create_surface_stone_field(
    outline: list[list[float]],
    surface_z: float,
    material: bpy.types.Material,
) -> None:
    rng = random.Random("olive-cloudbreak-surface-stones")
    mesh = bpy.data.meshes.new("Cloudbreak_SurfaceStoneFieldMesh")
    bm = bmesh.new()
    placed = 0
    attempts = 0
    while placed < 72 and attempts < 1_400:
        attempts += 1
        x = rng.uniform(-17.0, 17.0)
        y = rng.uniform(-12.5, 31.0)
        if not point_in_polygon(x, y, outline):
            continue
        if math.hypot(x, y + 1.0) < 7.2:
            continue
        if abs(x) < 4.8 and y > -0.5:
            continue
        if x < -7.2 and -8.0 < y < 8.5:
            continue
        if min(math.hypot(x - 9.2, y + 0.5), math.hypot(x + 8.2, y - 1.6)) < 1.9:
            continue

        radius = rng.uniform(0.14, 0.46)
        result = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
        verts = result["verts"]
        scale = Vector((rng.uniform(1.2, 2.3), rng.uniform(0.72, 1.35), rng.uniform(0.34, 0.68)))
        transform = (
            Matrix.Translation(Vector((x, y, surface_z + radius * 0.28)))
            @ Matrix.Rotation(rng.uniform(0.0, math.tau), 4, "Z")
            @ Matrix.Diagonal((*scale, 1.0))
        )
        bmesh.ops.transform(bm, matrix=transform, verts=verts)
        placed += 1

    bm.to_mesh(mesh)
    bm.free()
    field = bpy.data.objects.new("Cloudbreak_SurfaceStoneField", mesh)
    bpy.context.collection.objects.link(field)
    field.data.materials.append(material)
    tag(field, "cloudbreak-surface-stone", "landmass")
    project_uv(field, 2.4)


def create_weathered_surface(
    outline: list[list[float]],
    surface_z: float,
    material: bpy.types.Material,
) -> None:
    step = 0.72
    xs = np.arange(-18.0, 18.001, step)
    ys = np.arange(-14.5, 42.001, step)
    vertices: list[tuple[float, float, float]] = []
    grid: dict[tuple[int, int], int] = {}

    for ix, x in enumerate(xs):
        for iy, y in enumerate(ys):
            if not point_in_polygon(float(x), float(y), outline):
                continue
            if math.hypot(float(x), float(y) + 1.0) < 6.45:
                continue
            if x < -8.2 and -7.2 < y < 8.0:
                continue
            height = (
                0.075
                + math.sin(x * 0.67 + y * 0.19) * 0.034
                + math.sin(y * 0.43 - x * 0.21) * 0.028
                + math.sin((x + y) * 1.37) * 0.012
            )
            grid[(ix, iy)] = len(vertices)
            vertices.append((float(x), float(y), surface_z + max(0.018, height)))

    faces: list[tuple[int, int, int, int]] = []
    for ix in range(len(xs) - 1):
        for iy in range(len(ys) - 1):
            corners = [
                grid.get((ix, iy)),
                grid.get((ix + 1, iy)),
                grid.get((ix + 1, iy + 1)),
                grid.get((ix, iy + 1)),
            ]
            if all(index is not None for index in corners):
                faces.append(tuple(int(index) for index in corners))

    mesh = bpy.data.meshes.new("Cloudbreak_WeatheredSurfaceMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    surface = bpy.data.objects.new("Cloudbreak_WeatheredSurface", mesh)
    bpy.context.collection.objects.link(surface)
    surface.data.materials.append(material)
    tag(surface, "cloudbreak-weathered-surface", "landmass")
    project_uv(surface, 6.0)


def build_scene(manifest: dict) -> None:
    textures = create_limestone_textures()
    materials = {
        "stone": create_stone_material("Cloudbreak_Limestone", textures, (0.95, 0.82, 0.61, 1.0), 0.76),
        "terrace": create_stone_material("Cloudbreak_DryTerrace", textures, (1.0, 0.9, 0.72, 1.0), 0.64),
        "cap": create_stone_material("Cloudbreak_SunlitCaps", textures, (1.0, 0.86, 0.64, 1.0), 0.7),
        "bark": create_plain_material("Cloudbreak_OliveBark", (0.17, 0.11, 0.065, 1.0), 0.92),
        "foliage": create_plain_material("Cloudbreak_OliveLeaves", (0.28, 0.32, 0.17, 1.0), 0.84, 0.012),
        "water": create_water_material("Cloudbreak_LagoonWater", (0.23, 0.68, 0.73, 0.82)),
        "waterfall": create_water_material("Cloudbreak_Waterfall", (0.72, 0.9, 0.96, 0.7)),
    }

    landmass = manifest["landmass"]
    outline = landmass["outlineBlenderXY"]
    create_extruded_polygon(
        "Cloudbreak_Landmass",
        outline,
        landmass["surfaceY"],
        landmass["minimumThickness"],
        materials["stone"],
        "cloudbreak-landmass",
        "landmass",
        7.0,
    )
    for index, (depth, scale) in enumerate([(-1.25, 1.012), (-2.75, 0.992), (-4.35, 1.018), (-5.9, 1.006)]):
        create_extruded_polygon(
            f"Cloudbreak_Strata_{index:02d}",
            scaled_outline(outline, scale),
            depth,
            0.22,
            materials["cap" if index % 2 else "stone"],
            "cloudbreak-landmass-strata",
            "landmass",
            5.5,
        )
    create_weathered_surface(outline, landmass["surfaceY"], materials["stone"])
    create_surface_stone_field(outline, landmass["surfaceY"], materials["cap"])

    terrace = manifest["performanceTerrace"]
    center_x, center_y = -terrace["centerXZ"][0], terrace["centerXZ"][1]
    create_cylinder(
        "Cloudbreak_DryPerformanceTerrace",
        (center_x, center_y, terrace["surfaceY"] + 0.025),
        terrace["clearRadius"],
        0.05,
        materials["terrace"],
        "cloudbreak-performance-terrace",
        "performance-terrace",
        96,
    )

    lagoon = manifest["lagoon"]
    create_extruded_polygon(
        "Cloudbreak_OneLagoon",
        lagoon["outlineBlenderXY"],
        lagoon["surfaceY"] + 0.025,
        0.05,
        materials["water"],
        "cloudbreak-lagoon-water",
        "lagoon",
        2.0,
    )
    create_lagoon_rim(lagoon["outlineBlenderXY"], lagoon["surfaceY"], materials["cap"])
    overflow_x, overflow_y = lagoon["overflowBlenderXY"]
    create_waterfall_ribbon(
        "Cloudbreak_LagoonOverflow",
        Vector((overflow_x, overflow_y, lagoon["surfaceY"] + 0.05)),
        Vector((overflow_x + 0.5, overflow_y - 0.35, -7.8)),
        0.62,
        materials["waterfall"],
        "lagoon",
    )

    for index, tree in enumerate(manifest["oliveTrees"]):
        create_olive_tree(tree, materials["bark"], materials["foliage"], materials["stone"], 712 + index * 97)

    for mesa in manifest["distantMesas"]:
        create_irregular_mesa(mesa, materials["stone"], materials["cap"])
        if mesa.get("waterfall"):
            x, y, top_z = mesa["blenderPosition"]
            base_z = mesa["cloudBaseY"]
            fall_x = x + mesa["width"] * 0.23
            create_waterfall_ribbon(
                f"Mesa_{mesa['id']}_Waterfall",
                Vector((fall_x, y - mesa["width"] * 0.12, top_z + 0.25)),
                Vector((fall_x + 0.08, y - mesa["width"] * 0.16, base_z + 1.15)),
                max(0.3, mesa["width"] * 0.055),
                materials["waterfall"],
                mesa["id"],
            )
        if mesa.get("tinyOlive"):
            x, y, top_z = mesa["blenderPosition"]
            tiny_tree = {
                "id": "high-olive-distant-tree",
                "blenderPosition": [x, y, top_z + 0.28],
                "height": 2.0,
            }
            create_olive_tree(tiny_tree, materials["bark"], materials["foliage"], materials["stone"], 944)


def export_scene() -> None:
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
        export_apply=True,
    )


def main() -> None:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(MANIFEST_PATH)
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    clean_scene()
    build_scene(manifest)
    export_scene()
    role_counts: dict[str, int] = {}
    for obj in bpy.data.objects:
        role = obj.get("tka_role")
        if role:
            role_counts[role] = role_counts.get(role, 0) + 1
    print(
        json.dumps(
            {
                "blend": str(BLEND_PATH),
                "rawGlb": str(RAW_GLB_PATH),
                "objects": len(bpy.data.objects),
                "roles": role_counts,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
