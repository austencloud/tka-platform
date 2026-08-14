"""Build the production rubber-chicken prop and multi-angle proof renders.

The model is authored around the scene-3d hand pivot. Its long axis is local Y,
with the head toward +Y and the feet toward -Y.

Usage:
  blender --background --factory-startup --python scripts/build-chicken-model.py
  blender --background --factory-startup --python scripts/build-chicken-model.py -- \
    --output static/models/props/chicken.glb \
    --render-dir scratchpad/chicken-review/r1 \
    --blend scratchpad/chicken-review/chicken-production.blend
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "chicken.glb"
AUTHORED_LENGTH_M = 0.80


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--render-dir", type=Path)
    parser.add_argument("--blend", type=Path)
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.curves,
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifier(obj: bpy.types.Object, name: str) -> None:
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=name)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    coat: float = 0.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    principled = result.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat
    if "Coat Roughness" in principled.inputs:
        principled.inputs["Coat Roughness"].default_value = min(roughness, 0.3)
    return result


def add_classic_latex_normal(material: bpy.types.Material) -> None:
    """Embed a seamless plucked-skin normal map in the exported GLB."""
    size = 256
    tile = 32
    centers = ((7.0, 8.0, 2.0), (22.0, 13.0, 1.7), (13.0, 25.0, 1.5))
    heights = [0.0] * (size * size)

    for y in range(size):
        for x in range(size):
            u = x % tile
            v = y % tile
            height = 0.0
            for center_x, center_y, spread in centers:
                dx = min(abs(u - center_x), tile - abs(u - center_x))
                dy = min(abs(v - center_y), tile - abs(v - center_y))
                height += 0.75 * math.exp(-(dx * dx + dy * dy) / (2.0 * spread * spread))
            height += 0.08 * math.sin((u + v * 0.37) * math.tau / tile)
            heights[y * size + x] = height

    pixels: list[float] = []
    for y in range(size):
        for x in range(size):
            left = heights[y * size + ((x - 1) % size)]
            right = heights[y * size + ((x + 1) % size)]
            down = heights[((y - 1) % size) * size + x]
            up = heights[((y + 1) % size) * size + x]
            normal = Vector((-(right - left) * 0.72, -(up - down) * 0.72, 1.0))
            normal.normalize()
            pixels.extend(
                (
                    normal.x * 0.5 + 0.5,
                    normal.y * 0.5 + 0.5,
                    normal.z * 0.5 + 0.5,
                    1.0,
                )
            )

    image = bpy.data.images.new(
        "TKA_ClassicChicken_PluckedNormal",
        width=size,
        height=size,
        alpha=False,
        float_buffer=False,
    )
    image.pixels.foreach_set(pixels)
    image.pack()
    image.colorspace_settings.name = "Non-Color"

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture_node = nodes.new("ShaderNodeTexImage")
    texture_node.name = "Classic plucked latex"
    texture_node.image = image
    texture_node.extension = "REPEAT"
    texture_node.interpolation = "Linear"
    normal_node = nodes.new("ShaderNodeNormalMap")
    normal_node.name = "Molded rubber relief"
    normal_node.inputs["Strength"].default_value = 0.52
    links.new(texture_node.outputs["Color"], normal_node.inputs["Color"])
    links.new(normal_node.outputs["Normal"], principled.inputs["Normal"])


def smooth_mesh(obj: bpy.types.Object) -> None:
    if obj.type != "MESH":
        return
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def smart_uv(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or len(obj.data.polygons) == 0:
        return
    activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66),
        island_margin=0.015,
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def finish_mesh(
    obj: bpy.types.Object,
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
    latex_texture: float = 0.0,
) -> bpy.types.Object:
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if latex_texture > 0:
        texture = bpy.data.textures.new(f"{obj.name}_LatexTexture", type="CLOUDS")
        texture.noise_scale = 0.009
        texture.noise_depth = 1
        displacement = obj.modifiers.new("Molded latex texture", "DISPLACE")
        displacement.texture = texture
        displacement.texture_coords = "GLOBAL"
        displacement.strength = latex_texture
        displacement.mid_level = 0.5
        apply_modifier(obj, displacement.name)

    if bevel > 0:
        modifier = obj.modifiers.new("Soft molded edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        apply_modifier(obj, modifier.name)

    obj.data.materials.clear()
    obj.data.materials.append(material)
    smooth_mesh(obj)
    smart_uv(obj)
    return obj


def ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    segments: int = 24,
    rings: int = 16,
    latex_texture: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return finish_mesh(obj, material, latex_texture=latex_texture)


def join_objects(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for item in objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = objects[0]
    result.name = name
    return result


def tapered_tube(
    name: str,
    points: tuple[tuple[float, float, float], ...],
    radii: tuple[float, ...],
    material: bpy.types.Material | None,
    *,
    segments: int = 14,
) -> bpy.types.Object:
    """Build a capped, smoothly tapered tube through an arbitrary 3D path."""
    if len(points) < 2 or len(points) != len(radii):
        raise ValueError(f"Tube {name} needs matching point and radius lists")

    path = [Vector(point) for point in points]
    vertices: list[tuple[float, float, float]] = []
    for index, (point, radius) in enumerate(zip(path, radii, strict=True)):
        if index == 0:
            tangent = (path[1] - point).normalized()
        elif index == len(path) - 1:
            tangent = (point - path[index - 1]).normalized()
        else:
            tangent = (path[index + 1] - path[index - 1]).normalized()

        reference = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((1.0, 0.0, 0.0))
        side = tangent.cross(reference).normalized()
        up = side.cross(tangent).normalized()
        for segment in range(segments):
            angle = math.tau * segment / segments
            offset = radius * (math.cos(angle) * side + math.sin(angle) * up)
            vertices.append(tuple(point + offset))

    faces: list[tuple[int, ...]] = []
    for ring in range(len(path) - 1):
        start = ring * segments
        following = (ring + 1) * segments
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append(
                (
                    start + segment,
                    start + next_segment,
                    following + next_segment,
                    following + segment,
                )
            )
    faces.append(tuple(reversed(range(segments))))
    last_ring = (len(path) - 1) * segments
    faces.append(tuple(last_ring + segment for segment in range(segments)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    smooth_mesh(obj)
    return finish_mesh(obj, material) if material is not None else obj


def embossed_side_wing(
    name: str,
    side_sign: float,
    material: bpy.types.Material,
    *,
    y_offset: float,
) -> bpy.types.Object:
    """Build the classic shallow wing relief directly against the torso wall."""
    outline = (
        (0.060 + y_offset, -0.010),
        (0.032 + y_offset, 0.020),
        (-0.020 + y_offset, 0.026),
        (-0.071 + y_offset, 0.014),
        (-0.101 + y_offset, -0.004),
        (-0.061 + y_offset, -0.016),
        (0.006 + y_offset, -0.017),
    )
    vertices: list[tuple[float, float, float]] = []
    for outer in (False, True):
        for y, z in outline:
            surface_term = max(
                0.08,
                1.0 - ((y + 0.024) / 0.151) ** 2 - ((z + 0.006) / 0.047) ** 2,
            )
            surface_x = 0.063 * math.sqrt(surface_term)
            relief = 0.0023 if outer else -0.0008
            vertices.append((side_sign * (surface_x + relief), y, z))

    count = len(outline)
    faces: list[tuple[int, ...]] = [
        tuple(reversed(range(count))),
        tuple(count + index for index in range(count)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, count + following, count + index))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    wing = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(wing)
    return finish_mesh(wing, material, bevel=0.0014)


def fuse_molded_form(
    name: str,
    parts: list[bpy.types.Object],
    material: bpy.types.Material,
    *,
    voxel_size: float,
    smooth_iterations: int = 4,
    decimate_ratio: float = 1.0,
) -> bpy.types.Object:
    """Voxel-fuse overlapping parts into one watertight molded surface."""
    result = join_objects(name, parts)
    activate(result)
    result.data.remesh_voxel_size = voxel_size
    result.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()

    smoothing = result.modifiers.new("Soft latex transitions", "SMOOTH")
    smoothing.factor = 0.28
    smoothing.iterations = smooth_iterations
    apply_modifier(result, smoothing.name)

    if decimate_ratio < 1.0:
        decimation = result.modifiers.new("Runtime mesh budget", "DECIMATE")
        decimation.ratio = decimate_ratio
        decimation.use_collapse_triangulate = True
        apply_modifier(result, decimation.name)
    return finish_mesh(result, material)


def forward_wedge(
    name: str,
    base_z: float,
    tip_z: float,
    base_y: float,
    tip_y: float,
    half_width: float,
    tip_half_width: float,
    half_height: float,
    material: bpy.types.Material,
    *,
    warp_x: float = 0.0,
) -> bpy.types.Object:
    vertices = [
        (-half_width, base_y - half_height, base_z),
        (half_width, base_y - half_height, base_z),
        (half_width, base_y + half_height, base_z),
        (-half_width, base_y + half_height, base_z),
        (-tip_half_width + warp_x, tip_y - half_height * 0.3, tip_z),
        (tip_half_width + warp_x, tip_y - half_height * 0.3, tip_z),
        (tip_half_width + warp_x, tip_y + half_height * 0.3, tip_z),
        (-tip_half_width + warp_x, tip_y + half_height * 0.3, tip_z),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (3, 2, 6, 7),
        (1, 5, 6, 2),
        (0, 3, 7, 4),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_mesh(obj, material, bevel=0.003)


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    body = make_material(
        "TKA_Body_Recolor",
        (0.72, 0.38, 0.006, 1.0),
        roughness=0.66,
        coat=0.035,
    )
    add_classic_latex_normal(body)
    red = make_material(
        "TKA_Chicken_Red",
        (0.52, 0.006, 0.010, 1.0),
        roughness=0.58,
        coat=0.035,
    )
    beak = make_material(
        "TKA_Chicken_Beak",
        (0.72, 0.065, 0.004, 1.0),
        roughness=0.58,
        coat=0.04,
    )
    mouth = make_material(
        "TKA_Chicken_Mouth",
        (0.095, 0.006, 0.008, 1.0),
        roughness=0.52,
    )
    root = bpy.data.objects.new("TKA_Chicken", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "chicken"
    root["authored_length_m"] = AUTHORED_LENGTH_M
    root["grip_origin"] = "0,0,0"
    root["local_long_axis"] = "+Y"
    root["recolor_material"] = "TKA_Body_Recolor"
    root["reference_form"] = "molded squeaking rubber chicken"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    objects: list[bpy.types.Object] = []
    molded_parts: list[bpy.types.Object] = []

    # The yellow latex is fused into one watertight shell. A single sagging
    # torso and one tapered neck path eliminate the stacked-sphere ridges that
    # give procedural sculpts away.
    molded_parts.extend(
        (
            ellipsoid(
                "TKA_Chicken_Torso",
                (0.0, -0.024, -0.006),
                (0.063, 0.151, 0.047),
                body,
                rotation=(0.018, 0.0, 0.0),
                segments=32,
                rings=22,
            ),
            tapered_tube(
                "TKA_Chicken_Neck",
                (
                    (0.0, 0.076, -0.002),
                    (-0.002, 0.132, 0.002),
                    (0.001, 0.192, 0.010),
                    (0.003, 0.248, 0.018),
                    (0.001, 0.286, 0.021),
                ),
                (0.038, 0.035, 0.032, 0.029, 0.032),
                body,
                segments=24,
            ),
            ellipsoid(
                "TKA_Chicken_Head",
                (0.0, 0.298, 0.021),
                (0.044, 0.052, 0.039),
                body,
                segments=32,
                rings=20,
            ),
        )
    )

    # Curved, tapered legs grow out of the torso and become narrower toward the
    # ankles. Their slightly different paths read as limp rubber, not straws.
    leg_paths = {
        "Left": (
            ((-0.027, -0.117, -0.004), 0.017),
            ((-0.030, -0.169, -0.003), 0.0145),
            ((-0.033, -0.223, 0.001), 0.0115),
            ((-0.031, -0.282, 0.000), 0.0085),
        ),
        "Right": (
            ((0.027, -0.116, -0.004), 0.017),
            ((0.030, -0.171, 0.001), 0.014),
            ((0.028, -0.226, -0.002), 0.011),
            ((0.033, -0.279, 0.001), 0.0082),
        ),
    }
    for side, path in leg_paths.items():
        molded_parts.append(
            tapered_tube(
                f"TKA_Chicken_Leg_{side}",
                tuple(point for point, _radius in path),
                tuple(radius for _point, radius in path),
                body,
                segments=16,
            )
        )

    molded_body = fuse_molded_form(
        "TKA_Chicken_MoldedBody",
        molded_parts,
        body,
        voxel_size=0.0040,
        smooth_iterations=5,
        decimate_ratio=0.50,
    )

    # A subtle palm-pressure waist communicates the real grip without adding a
    # separate sleeve or changing the hand pivot.
    for vertex in molded_body.data.vertices:
        if abs(vertex.co.y) < 0.075 and abs(vertex.co.x) < 0.068:
            pressure = math.exp(-((vertex.co.y / 0.043) ** 2))
            wrinkle = 0.016 * math.sin(vertex.co.y * math.tau / 0.030) * math.exp(
                -((vertex.co.y / 0.065) ** 2)
            )
            vertex.co.x *= 1.0 - 0.12 * pressure + wrinkle
            vertex.co.z *= 1.0 - 0.08 * pressure + wrinkle * 0.72
    molded_body.data.update()
    finish_mesh(molded_body, body, latex_texture=0.00105)

    objects.append(molded_body)
    objects.append(
        tapered_tube(
            "TKA_Chicken_TailSpur",
            (
                (0.0, -0.103, -0.041),
                (-0.002, -0.112, -0.056),
                (0.001, -0.121, -0.069),
            ),
            (0.012, 0.008, 0.0022),
            body,
            segments=14,
        )
    )
    objects.append(
        embossed_side_wing(
            "TKA_Chicken_EmbossedWing_Left",
            -1.0,
            body,
            y_offset=-0.002,
        )
    )
    objects.append(
        embossed_side_wing(
            "TKA_Chicken_EmbossedWing_Right",
            1.0,
            body,
            y_offset=0.001,
        )
    )

    # Open screaming beak with a readable dark gap.
    objects.append(
        forward_wedge(
            "TKA_Chicken_Beak_Upper",
            base_z=0.044,
            tip_z=0.143,
            base_y=0.307,
            tip_y=0.302,
            half_width=0.031,
            tip_half_width=0.004,
            half_height=0.0105,
            material=beak,
            warp_x=0.0015,
        )
    )
    objects.append(
        forward_wedge(
            "TKA_Chicken_Beak_Lower",
            base_z=0.042,
            tip_z=0.132,
            base_y=0.279,
            tip_y=0.267,
            half_width=0.028,
            tip_half_width=0.004,
            half_height=0.008,
            material=beak,
            warp_x=-0.0010,
        )
    )
    objects.append(
        ellipsoid(
            "TKA_Chicken_MouthInterior",
            (0.0, 0.291, 0.087),
            (0.024, 0.007, 0.047),
            mouth,
            segments=20,
            rings=12,
        )
    )

    # The original novelty chicken has tiny red side-set eyes, not white mascot
    # eyeballs. Their lateral placement keeps the head convincingly molded.
    for side, x in (("Left", -0.041), ("Right", 0.041)):
        objects.append(
            ellipsoid(
                f"TKA_Chicken_RedEye_{side}",
                (x, 0.311 if side == "Left" else 0.308, 0.036),
                (0.0042, 0.0070, 0.0062),
                red,
                segments=16,
                rings=10,
            )
        )

    # Comb ridge and lobes follow the dorsal line of the head.
    objects.append(
        ellipsoid(
            "TKA_Chicken_Comb_Base",
            (0.0, 0.339, 0.014),
            (0.010, 0.014, 0.043),
            red,
            segments=20,
            rings=12,
        )
    )
    for index, (x, y, z, scale) in enumerate(
        (
            (-0.002, 0.345, -0.014, (0.011, 0.020, 0.013)),
            (0.002, 0.356, 0.010, (0.013, 0.025, 0.014)),
            (-0.001, 0.344, 0.034, (0.011, 0.020, 0.013)),
        )
    ):
        objects.append(
            ellipsoid(
                f"TKA_Chicken_Comb_Lobe_{index + 1}",
                (x, y, z),
                scale,
                red,
                segments=20,
                rings=12,
            )
        )

    for side, x in (("Left", -0.014), ("Right", 0.014)):
        objects.append(
            ellipsoid(
                f"TKA_Chicken_Wattle_{side}",
                (x, 0.257, 0.063),
                (0.012, 0.026, 0.017),
                red,
                rotation=(math.radians(-8), 0.0, math.radians(-7 if x < 0 else 7)),
                segments=20,
                rings=12,
            )
        )

    # The 19-inch classic ends in narrow, limp orange toes with almost no web.
    # They read as part of a flexible novelty casting rather than bird anatomy.
    feet = {
        "Left": {
            "center": -0.031,
            "toes": (
                ((-0.033, -0.290, 0.002), (-0.034, -0.342, 0.003), (-0.032, -0.397, 0.002)),
                ((-0.038, -0.291, 0.001), (-0.057, -0.334, 0.002), (-0.074, -0.377, 0.001)),
                ((-0.025, -0.291, 0.000), (-0.011, -0.330, -0.001), (0.005, -0.366, -0.001)),
            ),
        },
        "Right": {
            "center": 0.033,
            "toes": (
                ((0.034, -0.288, 0.002), (0.036, -0.339, 0.003), (0.035, -0.394, 0.002)),
                ((0.040, -0.289, 0.001), (0.058, -0.329, 0.002), (0.078, -0.372, 0.001)),
                ((0.027, -0.289, 0.000), (0.013, -0.327, -0.001), (-0.002, -0.363, -0.001)),
            ),
        },
    }
    for side, foot in feet.items():
        foot_parts = [
            ellipsoid(
                f"TKA_Chicken_FootHeel_{side}",
                (foot["center"], -0.294, 0.0),
                (0.012, 0.019, 0.009),
                beak,
                segments=18,
                rings=10,
            ),
        ]
        for toe_index, path in enumerate(foot["toes"]):
            foot_parts.append(
                tapered_tube(
                    f"TKA_Chicken_Toe_{side}_{toe_index + 1}",
                    path,
                    (0.0066, 0.0042, 0.0018),
                    beak,
                    segments=14,
                )
            )
        objects.append(
            fuse_molded_form(
                f"TKA_Chicken_LimpFoot_{side}",
                foot_parts,
                beak,
                voxel_size=0.0018,
                smooth_iterations=2,
                decimate_ratio=0.52,
            )
        )

    for item in objects:
        item.parent = root
        item["tka_runtime_recolor"] = any(
            material.name.endswith("Recolor") for material in item.data.materials
        )

    return root, [pivot, *objects]


def export_glb(
    output_path: Path,
    root: bpy.types.Object,
    model_objects: list[bpy.types.Object],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for item in model_objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = root

    # Blender exports its Z-up basis to glTF's Y-up basis. The sculpt is kept
    # upright along Blender Y for readable proof renders, then rotated into the
    # runtime basis only for export so the loaded prop remains long on local Y.
    root.rotation_euler.x = math.pi / 2
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_extras=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=False,
            export_materials="EXPORT",
            export_cameras=False,
            export_lights=False,
            export_animations=False,
        )
    finally:
        root.rotation_euler.x = 0.0


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_proof_lighting() -> bpy.types.Object:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.009, 0.013, 0.025, 1.0)
    background.inputs["Strength"].default_value = 0.18

    for name, location, energy, size, color in (
        ("QA_Key", (-0.65, 0.45, 0.95), 150, 0.75, (1.0, 0.94, 0.84)),
        ("QA_Fill", (0.85, -0.15, 0.60), 90, 0.65, (0.48, 0.66, 1.0)),
        ("QA_Rim", (-0.55, -0.35, -0.75), 100, 0.55, (1.0, 0.32, 0.16)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, 0.0, 0.0)))

    bpy.ops.object.camera_add(location=(0.0, 0.0, 1.55))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 63
    camera.data.sensor_width = 36
    bpy.context.scene.camera = camera
    return camera


def render_proofs(render_dir: Path) -> None:
    render_dir.mkdir(parents=True, exist_ok=True)
    camera = add_proof_lighting()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.15

    views = {
        "front": ((0.0, 0.0, 1.55), (0.0, 0.0, 0.0)),
        "three-quarter": ((0.89, 0.0, 1.27), (0.0, math.radians(35), 0.0)),
        "profile": ((1.55, 0.0, 0.0), (0.0, math.radians(90), 0.0)),
        "rear": ((0.0, 0.0, -1.55), (0.0, math.pi, 0.0)),
    }
    for label, (location, rotation) in views.items():
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"chicken-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(
    output_path: Path,
    model_objects: list[bpy.types.Object],
) -> None:
    meshes = [item for item in model_objects if item.type == "MESH"]
    vertices = sum(len(item.data.vertices) for item in meshes)
    polygons = sum(len(item.data.polygons) for item in meshes)
    print(f"CHICKEN_OUTPUT={output_path}")
    print(f"CHICKEN_BYTES={output_path.stat().st_size}")
    print(f"CHICKEN_MESHES={len(meshes)}")
    print(f"CHICKEN_VERTICES={vertices}")
    print(f"CHICKEN_POLYGONS={polygons}")
    print(f"CHICKEN_LENGTH_M={AUTHORED_LENGTH_M}")
    print("CHICKEN_HAND_PIVOT=0,0,0")


def main() -> None:
    args = parse_args()
    output_path = args.output.resolve()
    reset_scene()
    root, model_objects = build_prop()
    export_glb(output_path, root, model_objects)

    if args.blend:
        blend_path = args.blend.resolve()
        blend_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    if args.render_dir:
        render_proofs(args.render_dir.resolve())

    print_summary(output_path, model_objects)


if __name__ == "__main__":
    main()
