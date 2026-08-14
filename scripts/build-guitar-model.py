"""Build the production acoustic-guitar prop and multi-angle proof renders.

The model is authored around the scene-3d hand pivot. Its long axis is local Y,
with the headstock toward +Y and the body toward -Y.

Usage:
  blender --background --factory-startup --python scripts/build-guitar-model.py
  blender --background --factory-startup --python scripts/build-guitar-model.py -- \
    --output static/models/props/guitar.glb \
    --render-dir scratchpad/guitar-review/r1 \
    --blend scratchpad/guitar-review/guitar-production.blend
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "guitar.glb"
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
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat
    if "Coat Roughness" in principled.inputs:
        principled.inputs["Coat Roughness"].default_value = min(roughness, 0.3)
    return material


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
        island_margin=0.012,
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
    bevel_segments: int = 3,
    smooth: bool = True,
) -> bpy.types.Object:
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Rounded stage-safe edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = bevel_segments
        modifier.limit_method = "ANGLE"
        apply_modifier(obj, modifier.name)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if smooth:
        smooth_mesh(obj)
    smart_uv(obj)
    return obj


def add_cube(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    return finish_mesh(obj, material, bevel=bevel, smooth=False)


def add_ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    segments: int = 20,
    rings: int = 12,
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
    return finish_mesh(obj, material)


def join_objects(
    name: str,
    objects: list[bpy.types.Object],
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for item in objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = objects[0]
    result.name = name
    result.data.materials.clear()
    result.data.materials.append(material)
    smart_uv(result)
    return result


def cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    *,
    vertices: int = 10,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(
        direction.normalized()
    )
    obj.rotation_mode = "XYZ"
    return finish_mesh(obj, material)


BODY_WIDTH_SAMPLES = (
    (-0.430, 0.037),
    (-0.422, 0.082),
    (-0.405, 0.120),
    (-0.378, 0.146),
    (-0.343, 0.158),
    (-0.309, 0.156),
    (-0.276, 0.142),
    (-0.246, 0.117),
    (-0.216, 0.092),
    (-0.190, 0.087),
    (-0.163, 0.093),
    (-0.135, 0.108),
    (-0.106, 0.123),
    (-0.078, 0.126),
    (-0.054, 0.113),
    (-0.035, 0.087),
    (-0.022, 0.050),
)


def catmull_rom_open(
    points: tuple[tuple[float, float], ...], subdivisions: int = 5
) -> list[tuple[float, float]]:
    """Densify an open control polyline without losing its end points."""
    result: list[tuple[float, float]] = []
    for index in range(len(points) - 1):
        p0 = points[max(0, index - 1)]
        p1 = points[index]
        p2 = points[index + 1]
        p3 = points[min(len(points) - 1, index + 2)]
        for step in range(subdivisions):
            t = step / subdivisions
            t2 = t * t
            t3 = t2 * t
            x = 0.5 * (
                2.0 * p1[0]
                + (-p0[0] + p2[0]) * t
                + (2.0 * p0[0] - 5.0 * p1[0] + 4.0 * p2[0] - p3[0]) * t2
                + (-p0[0] + 3.0 * p1[0] - 3.0 * p2[0] + p3[0]) * t3
            )
            y = 0.5 * (
                2.0 * p1[1]
                + (-p0[1] + p2[1]) * t
                + (2.0 * p0[1] - 5.0 * p1[1] + 4.0 * p2[1] - p3[1]) * t2
                + (-p0[1] + 3.0 * p1[1] - 3.0 * p2[1] + p3[1]) * t3
            )
            result.append((x, y))
    result.append(points[-1])
    return result


def catmull_rom_closed(
    points: list[tuple[float, float]], subdivisions: int = 4
) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    count = len(points)
    for index in range(count):
        p0 = points[(index - 1) % count]
        p1 = points[index]
        p2 = points[(index + 1) % count]
        p3 = points[(index + 2) % count]
        for step in range(subdivisions):
            t = step / subdivisions
            t2 = t * t
            t3 = t2 * t
            result.append(
                (
                    0.5
                    * (
                        2.0 * p1[0]
                        + (-p0[0] + p2[0]) * t
                        + (2.0 * p0[0] - 5.0 * p1[0] + 4.0 * p2[0] - p3[0])
                        * t2
                        + (-p0[0] + 3.0 * p1[0] - 3.0 * p2[0] + p3[0])
                        * t3
                    ),
                    0.5
                    * (
                        2.0 * p1[1]
                        + (-p0[1] + p2[1]) * t
                        + (2.0 * p0[1] - 5.0 * p1[1] + 4.0 * p2[1] - p3[1])
                        * t2
                        + (-p0[1] + 3.0 * p1[1] - 3.0 * p2[1] + p3[1])
                        * t3
                    ),
                )
            )
    return result


def guitar_outline(scale_x: float = 1.0, scale_y: float = 1.0) -> list[tuple[float, float]]:
    center_y = -0.226
    samples = catmull_rom_open(BODY_WIDTH_SAMPLES)
    right = [
        (width * scale_x, center_y + (y - center_y) * scale_y)
        for y, width in samples
    ]
    left = [(-x, y) for x, y in reversed(right)]
    return right + left


def extruded_outline(
    name: str,
    outline: list[tuple[float, float]],
    center_z: float,
    depth: float,
    material: bpy.types.Material,
    *,
    bevel: float,
) -> bpy.types.Object:
    half_depth = depth * 0.5
    vertices = [(x, y, center_z - half_depth) for x, y in outline]
    vertices.extend((x, y, center_z + half_depth) for x, y in outline)
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
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_mesh(obj, material, bevel=bevel)


def tapered_box(
    name: str,
    bottom_y: float,
    top_y: float,
    bottom_width: float,
    top_width: float,
    center_z: float,
    depth: float,
    material: bpy.types.Material,
    *,
    bevel: float,
    bevel_segments: int = 3,
    bottom_depth: float | None = None,
    top_depth: float | None = None,
    front_z: float | None = None,
) -> bpy.types.Object:
    resolved_bottom_depth = bottom_depth if bottom_depth is not None else depth
    resolved_top_depth = top_depth if top_depth is not None else depth
    bottom_z1 = front_z if front_z is not None else center_z + resolved_bottom_depth * 0.5
    top_z1 = front_z if front_z is not None else center_z + resolved_top_depth * 0.5
    bottom_z0 = bottom_z1 - resolved_bottom_depth
    top_z0 = top_z1 - resolved_top_depth
    vertices = [
        (-bottom_width * 0.5, bottom_y, bottom_z0),
        (bottom_width * 0.5, bottom_y, bottom_z0),
        (-top_width * 0.5, top_y, top_z0),
        (top_width * 0.5, top_y, top_z0),
        (-bottom_width * 0.5, bottom_y, bottom_z1),
        (bottom_width * 0.5, bottom_y, bottom_z1),
        (-top_width * 0.5, top_y, top_z1),
        (top_width * 0.5, top_y, top_z1),
    ]
    faces = [
        (0, 2, 3, 1),
        (4, 5, 7, 6),
        (0, 1, 5, 4),
        (2, 6, 7, 3),
        (0, 4, 6, 2),
        (1, 3, 7, 5),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_mesh(
        obj,
        material,
        bevel=bevel,
        bevel_segments=bevel_segments,
    )


def arch_back_surface(obj: bpy.types.Object, strength: float = 1.0) -> None:
    """Give a flat shell a restrained acoustic back arch and neckward taper."""
    for vertex in obj.data.vertices:
        if vertex.co.z > -0.018:
            continue
        neckward = max(0.0, min(1.0, (vertex.co.y + 0.43) / 0.408))
        across = max(0.0, 1.0 - (vertex.co.x / 0.158) ** 2)
        along = max(0.0, 1.0 - ((vertex.co.y + 0.235) / 0.215) ** 2)
        vertex.co.z += strength * (0.0055 * neckward - 0.0042 * across * along)
    obj.data.update()


def headstock_outline() -> list[tuple[float, float]]:
    return [
        (-0.019, 0.264),
        (-0.029, 0.281),
        (-0.032, 0.326),
        (-0.028, 0.355),
        (-0.013, 0.373),
        (0.000, 0.365),
        (0.013, 0.373),
        (0.028, 0.355),
        (0.032, 0.326),
        (0.029, 0.281),
        (0.019, 0.264),
    ]


def flat_plate(
    name: str,
    outline: list[tuple[float, float]],
    z: float,
    depth: float,
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
) -> bpy.types.Object:
    return extruded_outline(name, outline, z, depth, material, bevel=bevel)


def width_at_y(y: float, bottom_width: float, top_width: float) -> float:
    ratio = (y - (-0.054)) / (0.278 - (-0.054))
    return bottom_width + (top_width - bottom_width) * max(0.0, min(1.0, ratio))


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    recolor = make_material(
        "TKA_Guitar_Recolor",
        (0.055, 0.24, 0.70, 1.0),
        roughness=0.42,
        coat=0.16,
    )
    fretboard = make_material(
        "TKA_Guitar_Fretboard",
        (0.026, 0.018, 0.014, 1.0),
        roughness=0.56,
        coat=0.03,
    )
    binding = make_material(
        "TKA_Guitar_Binding",
        (0.60, 0.47, 0.28, 1.0),
        roughness=0.43,
        coat=0.08,
    )
    metal = make_material(
        "TKA_Guitar_Metal",
        (0.58, 0.64, 0.70, 1.0),
        roughness=0.26,
        metallic=0.86,
    )
    sound_hole = make_material(
        "TKA_Guitar_SoundHole",
        (0.003, 0.004, 0.008, 1.0),
        roughness=0.92,
    )

    root = bpy.data.objects.new("TKA_Guitar", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "guitar"
    root["authored_length_m"] = AUTHORED_LENGTH_M
    root["grip_origin"] = "0,0,0"
    root["local_long_axis"] = "+Y"
    root["recolor_material"] = "TKA_Guitar_Recolor"
    root["reference_form"] = "compact steel-string acoustic stage prop"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    objects: list[bpy.types.Object] = []

    # A shallow, rounded shell is credible as a reinforced performance prop.
    # Two inset face plates leave a thin warm binding line around the silhouette.
    body_shell = extruded_outline(
        "TKA_Guitar_BodyShell",
        guitar_outline(),
        center_z=0.0,
        depth=0.074,
        material=recolor,
        bevel=0.0075,
    )
    arch_back_surface(body_shell)
    objects.append(body_shell)
    objects.append(
        flat_plate(
            "TKA_Guitar_FrontBinding",
            guitar_outline(scale_x=0.978, scale_y=0.986),
            z=0.039,
            depth=0.006,
            material=binding,
            bevel=0.0032,
        )
    )
    objects.append(
        flat_plate(
            "TKA_Guitar_Soundboard",
            guitar_outline(scale_x=0.954, scale_y=0.973),
            z=0.043,
            depth=0.005,
            material=recolor,
            bevel=0.0026,
        )
    )
    rear_binding = flat_plate(
        "TKA_Guitar_RearBinding",
        guitar_outline(scale_x=0.978, scale_y=0.986),
        z=-0.039,
        depth=0.006,
        material=binding,
        bevel=0.0032,
    )
    arch_back_surface(rear_binding)
    objects.append(rear_binding)
    back = flat_plate(
        "TKA_Guitar_Back",
        guitar_outline(scale_x=0.954, scale_y=0.973),
        z=-0.043,
        depth=0.005,
        material=recolor,
        bevel=0.0026,
    )
    arch_back_surface(back)
    objects.append(back)

    # The neck is the actual runtime grip. Its rounded back thickens by only a
    # few millimeters at the origin so a hand looks planted without a sleeve.
    neck = tapered_box(
        "TKA_Guitar_NeckGrip",
        bottom_y=-0.054,
        top_y=0.278,
        bottom_width=0.057,
        top_width=0.042,
        center_z=0.024,
        depth=0.043,
        material=recolor,
        bevel=0.007,
        bevel_segments=5,
        bottom_depth=0.047,
        top_depth=0.035,
        front_z=0.046,
    )
    for vertex in neck.data.vertices:
        pressure = math.exp(-((vertex.co.y / 0.055) ** 2))
        vertex.co.x *= 1.0 + 0.035 * pressure
        if vertex.co.z < 0.024:
            vertex.co.z -= 0.0015 * pressure
    neck.data.update()
    objects.append(neck)
    objects.append(
        add_ellipsoid(
            "TKA_Guitar_NeckHeel",
            (0.0, -0.046, -0.015),
            (0.031, 0.046, 0.034),
            recolor,
            segments=24,
            rings=14,
        )
    )
    objects.append(
        tapered_box(
            "TKA_Guitar_Fretboard",
            bottom_y=-0.072,
            top_y=0.281,
            bottom_width=0.051,
            top_width=0.036,
            center_z=0.048,
            depth=0.007,
            material=fretboard,
            bevel=0.0015,
        )
    )

    objects.append(
        flat_plate(
            "TKA_Guitar_Headstock",
            headstock_outline(),
            z=0.027,
            depth=0.039,
            material=recolor,
            bevel=0.004,
        )
    )
    objects.append(
        flat_plate(
            "TKA_Guitar_HeadstockFace",
            [(x * 0.88, 0.319 + (y - 0.319) * 0.91) for x, y in headstock_outline()],
            z=0.049,
            depth=0.004,
            material=fretboard,
            bevel=0.0015,
        )
    )

    # Sound hole and rosette are actual layered geometry, so the cavity stays
    # black under stage lighting instead of reading as paint.
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48,
        radius=0.047,
        depth=0.004,
        location=(0.0, -0.181, 0.048),
    )
    hole = bpy.context.object
    hole.name = "TKA_Guitar_SoundHole"
    objects.append(finish_mesh(hole, sound_hole))
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.053,
        minor_radius=0.0025,
        major_segments=48,
        minor_segments=8,
        location=(0.0, -0.181, 0.052),
    )
    rosette_outer = bpy.context.object
    rosette_outer.name = "TKA_Guitar_RosetteOuter"
    objects.append(finish_mesh(rosette_outer, binding))
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.0585,
        minor_radius=0.0012,
        major_segments=48,
        minor_segments=6,
        location=(0.0, -0.181, 0.0525),
    )
    rosette_inner = bpy.context.object
    rosette_inner.name = "TKA_Guitar_RosettePinstripe"
    objects.append(finish_mesh(rosette_inner, fretboard))
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.044,
        minor_radius=0.003,
        major_segments=48,
        minor_segments=8,
        location=(0.0, -0.181, 0.047),
    )
    inner_lip = bpy.context.object
    inner_lip.name = "TKA_Guitar_SoundHoleInnerLip"
    objects.append(finish_mesh(inner_lip, sound_hole))

    objects.append(
        add_cube(
            "TKA_Guitar_Bridge",
            (0.0, -0.304, 0.052),
            (0.112, 0.028, 0.010),
            fretboard,
            bevel=0.004,
        )
    )
    objects.append(
        add_cube(
            "TKA_Guitar_Saddle",
            (0.0, -0.298, 0.059),
            (0.081, 0.004, 0.006),
            binding,
            bevel=0.001,
        )
    )
    objects.append(
        add_cube(
            "TKA_Guitar_Nut",
            (0.0, 0.277, 0.055),
            (0.038, 0.005, 0.006),
            binding,
            bevel=0.0008,
        )
    )

    # A low, asymmetric pickguard provides the one visual asymmetry expected
    # on a real acoustic guitar without introducing fragile protrusions.
    pickguard_outline = catmull_rom_closed(
        [
            (0.046, -0.157),
            (0.066, -0.160),
            (0.080, -0.173),
            (0.084, -0.192),
            (0.080, -0.212),
            (0.070, -0.229),
            (0.056, -0.239),
            (0.049, -0.226),
            (0.047, -0.208),
            (0.051, -0.191),
            (0.056, -0.178),
            (0.044, -0.168),
        ]
    )
    objects.append(
        flat_plate(
            "TKA_Guitar_Pickguard",
            pickguard_outline,
            z=0.047,
            depth=0.0012,
            material=fretboard,
            bevel=0.00035,
        )
    )

    bridge_pin_parts: list[bpy.types.Object] = []
    for index, x in enumerate((-0.0180, -0.0108, -0.0036, 0.0036, 0.0108, 0.0180)):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12,
            radius=0.0019,
            depth=0.0022,
            location=(x, -0.312, 0.059),
        )
        pin = bpy.context.object
        pin.name = f"TKA_Guitar_BridgePin_{index + 1}"
        bridge_pin_parts.append(finish_mesh(pin, binding))
    objects.append(join_objects("TKA_Guitar_BridgePins", bridge_pin_parts, binding))

    # Equal-tempered fret spacing and tapered widths preserve the real visual
    # cadence. Individual bars are joined into one runtime mesh.
    scale_length = 0.575
    nut_y = 0.277
    fret_parts: list[bpy.types.Object] = []
    fret_positions: list[float] = []
    for fret_number in range(1, 19):
        y = nut_y - scale_length * (1.0 - 2.0 ** (-fret_number / 12.0))
        fret_positions.append(y)
        width = width_at_y(y, 0.051, 0.036) * 0.96
        fret_parts.append(
            add_cube(
                f"TKA_Guitar_Fret_{fret_number:02d}",
                (0.0, y, 0.0532),
                (width, 0.0016, 0.0020),
                metal,
                bevel=0.00045,
            )
        )
    objects.append(join_objects("TKA_Guitar_Frets", fret_parts, metal))

    marker_parts: list[bpy.types.Object] = []
    for fret_number in (3, 5, 7, 9, 12, 15, 17):
        before = nut_y if fret_number == 1 else fret_positions[fret_number - 2]
        after = fret_positions[fret_number - 1]
        y = (before + after) * 0.5
        xs = (-0.008, 0.008) if fret_number == 12 else (0.0,)
        for index, x in enumerate(xs):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=16,
                radius=0.0026,
                depth=0.0012,
                location=(x, y, 0.0548),
            )
            marker = bpy.context.object
            marker.name = f"TKA_Guitar_Marker_{fret_number:02d}_{index + 1}"
            marker_parts.append(finish_mesh(marker, binding))
    objects.append(join_objects("TKA_Guitar_PositionMarkers", marker_parts, binding))

    # Six strings run continuously from bridge to nut, then fan toward their
    # individual tuner posts. Slightly graduated gauges survive antialiasing.
    string_parts: list[bpy.types.Object] = []
    bridge_xs = (-0.0180, -0.0108, -0.0036, 0.0036, 0.0108, 0.0180)
    nut_xs = (-0.0140, -0.0084, -0.0028, 0.0028, 0.0084, 0.0140)
    tuner_points = (
        (-0.022, 0.294, 0.055),
        (-0.024, 0.321, 0.055),
        (-0.020, 0.348, 0.055),
        (0.020, 0.348, 0.055),
        (0.024, 0.321, 0.055),
        (0.022, 0.294, 0.055),
    )
    for index, (bridge_x, nut_x, tuner_point) in enumerate(
        zip(bridge_xs, nut_xs, tuner_points, strict=True)
    ):
        radius = 0.00048 + index * 0.000055
        string_parts.append(
            cylinder_between(
                f"TKA_Guitar_String_Main_{index + 1}",
                (bridge_x, -0.301, 0.063),
                (nut_x, 0.278, 0.058),
                radius,
                metal,
                vertices=8,
            )
        )
        string_parts.append(
            cylinder_between(
                f"TKA_Guitar_String_Head_{index + 1}",
                (nut_x, 0.278, 0.058),
                tuner_point,
                radius,
                metal,
                vertices=8,
            )
        )
    objects.append(join_objects("TKA_Guitar_SixStrings", string_parts, metal))

    tuner_parts: list[bpy.types.Object] = []
    for index, (x, y, z) in enumerate(tuner_points):
        tuner_parts.append(
            cylinder_between(
                f"TKA_Guitar_TunerPost_{index + 1}",
                (x, y, 0.047),
                (x, y, 0.062),
                0.0031,
                metal,
                vertices=12,
            )
        )
        side = -1.0 if x < 0 else 1.0
        tuner_parts.append(
            cylinder_between(
                f"TKA_Guitar_TunerAxle_{index + 1}",
                (x, y, 0.032),
                (side * 0.033, y, 0.032),
                0.0021,
                metal,
                vertices=10,
            )
        )
        tuner_parts.append(
            add_ellipsoid(
                f"TKA_Guitar_TunerKey_{index + 1}",
                (side * 0.037, y, 0.032),
                (0.0050, 0.0042, 0.0018),
                metal,
                segments=14,
                rings=8,
            )
        )
    objects.append(join_objects("TKA_Guitar_TuningMachines", tuner_parts, metal))

    # Small hardware details anchor both ends and make rear/profile views feel
    # finished, while remaining tucked inside the silhouette.
    objects.append(
        add_ellipsoid(
            "TKA_Guitar_HeadstockInlay",
            (0.0, 0.337, 0.0525),
            (0.007, 0.011, 0.0015),
            binding,
            rotation=(0.0, 0.0, math.radians(45)),
            segments=16,
            rings=8,
        )
    )
    objects.append(
        add_ellipsoid(
            "TKA_Guitar_EndPin",
            (0.0, -0.431, 0.0),
            (0.007, 0.010, 0.007),
            metal,
            segments=14,
            rings=8,
        )
    )

    for item in objects:
        item.parent = root
        item["tka_runtime_recolor"] = any(
            "Recolor" in material.name for material in item.data.materials
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

    # Match the proven scene-3d export basis used by the production Chicken.
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
    background.inputs["Color"].default_value = (0.006, 0.009, 0.018, 1.0)
    background.inputs["Strength"].default_value = 0.22

    for name, location, energy, size, color in (
        ("QA_Key", (-0.72, 0.48, 1.05), 210, 0.78, (1.0, 0.88, 0.72)),
        ("QA_Fill", (0.88, -0.10, 0.72), 135, 0.66, (0.42, 0.62, 1.0)),
        ("QA_Rim", (-0.55, -0.42, -0.82), 155, 0.60, (0.90, 0.26, 0.12)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, -0.04, 0.0)))

    bpy.ops.object.camera_add(location=(0.0, -0.02, 1.35))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 58
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
    scene.view_settings.exposure = -0.75

    views = {
        "front": ((0.0, -0.03, 1.35), (0.0, 0.0, 0.0)),
        "three-quarter": ((0.73, -0.03, 1.06), (0.0, math.radians(35), 0.0)),
        "profile": ((1.34, -0.03, 0.0), (0.0, math.radians(90), 0.0)),
        "rear": ((0.0, -0.03, -1.35), (0.0, math.pi, 0.0)),
    }
    for label, (location, rotation) in views.items():
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"guitar-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, model_objects: list[bpy.types.Object]) -> None:
    meshes = [item for item in model_objects if item.type == "MESH"]
    vertices = sum(len(item.data.vertices) for item in meshes)
    polygons = sum(len(item.data.polygons) for item in meshes)
    print(f"GUITAR_OUTPUT={output_path}")
    print(f"GUITAR_BYTES={output_path.stat().st_size}")
    print(f"GUITAR_MESHES={len(meshes)}")
    print(f"GUITAR_VERTICES={vertices}")
    print(f"GUITAR_POLYGONS={polygons}")
    print(f"GUITAR_LENGTH_M={AUTHORED_LENGTH_M}")
    print("GUITAR_HAND_PIVOT=0,0,0")


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
