"""Build the Doodle-style fire/day fan and optional two-faced cover.

The asset carries three independently switchable groups:

* ``Fan_Fire``: oil-darkened steel frame with five rolled kevlar wicks.
* ``Fan_Day``: the same reach as a thick HDPE practice frame.
* ``Fan_Cover``: a slip-on crescent with a solid front and striped back.

The scene-3d runtime chooses which groups are visible and recolors the day
frame and solid cover face. The hand pivot is the centre of the grip ring and
the fan reaches along local +Y, matching every other prop in scene-3d.

Usage:
  blender --background --factory-startup --python scripts/build-fan-model.py
  blender --background --factory-startup --python scripts/build-fan-model.py -- \
    --output static/models/props/fan.glb \
    --blend scratchpad/fan-review/fan-production.blend \
    --render-dir scratchpad/fan-review/r1
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "fan.glb"
DOODLEGRIP_CONTOURS = ROOT / "scripts" / "assets" / "doodlegrip-day-contours.json"
DOODLEGRIP_FIRE_REFERENCE = (
    ROOT / "scripts" / "assets" / "doodlegrip-fire-reference.json"
)

FIRE_WIDTH_M = 0.4826
FIRE_HEIGHT_M = 0.3302
FIRE_RING_DIAMETER_M = 0.0381
FIRE_WICK_LENGTH_M = 0.0381
FIRE_OUTER_SPINE_RADIUS_M = 0.00238125
FIRE_INNER_SPINE_RADIUS_M = 0.0015875
DAY_WIDTH_M = 0.51
DAY_HEIGHT_M = 0.35
DAY_DEPTH_M = 0.0095


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--blend", type=Path)
    parser.add_argument("--render-dir", type=Path)
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


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
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


def set_material_color(
    material: bpy.types.Material,
    color: tuple[float, float, float, float],
) -> None:
    material.diffuse_color = color
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color


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
    smooth: bool = True,
) -> bpy.types.Object:
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Soft prop edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if smooth:
        smooth_mesh(obj)
    smart_uv(obj)
    return obj


def add_empty(name: str, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def add_curve_strip(
    name: str,
    points: list[tuple[float, float, float]],
    width: float,
    depth: float,
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = width / 2
    curve.bevel_resolution = 3
    curve.resolution_u = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.scale.z = depth / width
    activate(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    return finish_mesh(obj, material)


def add_round_rod(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    activate(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    return finish_mesh(obj, material)


def add_torus(
    name: str,
    centre: tuple[float, float, float],
    inner_radius: float,
    tube_radius: float,
    depth: float,
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=inner_radius + tube_radius,
        minor_radius=tube_radius,
        major_segments=48,
        minor_segments=10,
        location=centre,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale.z = depth / (tube_radius * 2)
    obj.parent = parent
    return finish_mesh(obj, material)


def polygon_area(points: list[tuple[float, float]]) -> float:
    return sum(
        points[index][0] * points[(index + 1) % len(points)][1]
        - points[(index + 1) % len(points)][0] * points[index][1]
        for index in range(len(points))
    ) / 2


def add_cut_sheet(
    name: str,
    outline: list[tuple[float, float]],
    holes: list[list[tuple[float, float]]],
    depth: float,
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    """Extrude one continuous HDPE sheet with real cut-through openings."""
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "2D"
    curve.resolution_u = 2
    curve.fill_mode = "BOTH"
    curve.extrude = max(0.0, depth / 2 - 0.0012)
    curve.bevel_depth = min(0.0012, depth / 2)
    curve.bevel_resolution = 3
    curve.resolution_u = 2

    # Blender identifies holes by winding. Keep the outside counter-clockwise
    # and every cutout clockwise so the result is one plate, not stacked faces.
    contours = [outline if polygon_area(outline) > 0 else list(reversed(outline))]
    contours.extend(
        hole if polygon_area(hole) < 0 else list(reversed(hole)) for hole in holes
    )
    for contour in contours:
        # The extractor has already resampled and faired each loop. A dense
        # poly spline follows those audited points directly and cannot produce
        # the Bezier overshoot or wavering handles visible in the first pass.
        spline = curve.splines.new("POLY")
        spline.points.add(len(contour) - 1)
        for point, coordinate in zip(spline.points, contour):
            point.co = (coordinate[0], coordinate[1], 0.0, 1.0)
        spline.use_cyclic_u = True

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    activate(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    return finish_mesh(obj, material)


def add_cylinder_between(
    name: str,
    start: Vector,
    end: Vector,
    radius: float,
    material: bpy.types.Material,
    parent: bpy.types.Object,
    *,
    vertices: int = 20,
) -> bpy.types.Object:
    direction = end - start
    midpoint = (start + end) / 2
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.rotation_mode = "XYZ"
    obj.parent = parent
    return finish_mesh(obj, material, bevel=radius * 0.18)


def ellipse_arc(
    radius_x: float,
    radius_y: float,
    centre_y: float,
    *,
    segments: int = 32,
    z: float = 0.0,
    start_angle: float = 0.0,
    end_angle: float = math.pi,
) -> list[tuple[float, float, float]]:
    return [
        (
            radius_x
            * math.cos(start_angle + (end_angle - start_angle) * index / segments),
            centre_y
            + radius_y
            * math.sin(start_angle + (end_angle - start_angle) * index / segments),
            z,
        )
        for index in range(segments + 1)
    ]


def circle_arc(
    radius: float,
    centre_y: float,
    *,
    start_angle: float,
    end_angle: float,
    segments: int = 72,
) -> list[tuple[float, float, float]]:
    return ellipse_arc(
        radius,
        radius,
        centre_y,
        segments=segments,
        start_angle=start_angle,
        end_angle=end_angle,
    )


def quadratic_curve(
    start: tuple[float, float],
    control: tuple[float, float],
    end: tuple[float, float],
    *,
    segments: int = 16,
) -> list[tuple[float, float, float]]:
    points: list[tuple[float, float, float]] = []
    for index in range(segments + 1):
        t = index / segments
        u = 1 - t
        points.append(
            (
                u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
                u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
                0.0,
            )
        )
    return points


def catmull_rom_curve(
    anchors: list[tuple[float, float]], *, segments_per_span: int = 12
) -> list[tuple[float, float, float]]:
    """Interpolate measured landmarks without leaving polygonal corners."""
    points: list[tuple[float, float, float]] = []
    for span in range(len(anchors) - 1):
        p0 = Vector(anchors[max(span - 1, 0)])
        p1 = Vector(anchors[span])
        p2 = Vector(anchors[span + 1])
        p3 = Vector(anchors[min(span + 2, len(anchors) - 1)])
        for index in range(segments_per_span + 1):
            if span > 0 and index == 0:
                continue
            t = index / segments_per_span
            t2 = t * t
            t3 = t2 * t
            point = 0.5 * (
                2 * p1
                + (-p0 + p2) * t
                + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            )
            points.append((point.x, point.y, 0.0))
    return points


def cubic_bezier_curve(
    start: tuple[float, float],
    control_1: tuple[float, float],
    control_2: tuple[float, float],
    end: tuple[float, float],
    *,
    segments: int = 18,
) -> list[tuple[float, float, float]]:
    points: list[tuple[float, float, float]] = []
    for index in range(segments + 1):
        t = index / segments
        u = 1 - t
        points.append(
            (
                u**3 * start[0]
                + 3 * u * u * t * control_1[0]
                + 3 * u * t * t * control_2[0]
                + t**3 * end[0],
                u**3 * start[1]
                + 3 * u * u * t * control_1[1]
                + 3 * u * t * t * control_2[1]
                + t**3 * end[1],
                0.0,
            )
        )
    return points


def add_cover_surface(
    name: str,
    outer: list[tuple[float, float, float]],
    inner: list[tuple[float, float, float]],
    z: float,
    materials: list[bpy.types.Material],
    parent: bpy.types.Object,
    *,
    striped: bool,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(len(outer) - 1):
        base = len(vertices)
        vertices.extend(
            [
                (outer[index][0], outer[index][1], z),
                (outer[index + 1][0], outer[index + 1][1], z),
                (inner[index + 1][0], inner[index + 1][1], z),
                (inner[index][0], inner[index][1], z),
            ]
        )
        faces.append(
            (base, base + 1, base + 2, base + 3)
            if z >= 0
            else (base + 3, base + 2, base + 1, base)
        )
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    for material in materials:
        mesh.materials.append(material)
    if striped:
        stripe_count = 9
        segment_count = len(faces)
        for index, polygon in enumerate(mesh.polygons):
            stripe = min(stripe_count - 1, int(index * stripe_count / segment_count))
            polygon.material_index = stripe % 2
    smart_uv(obj)
    return obj


def build_day_frame(
    parent: bpy.types.Object,
    day_material: bpy.types.Material,
) -> list[bpy.types.Object]:
    # This is not an interpretation of DoodleGrip geometry. The contours are
    # mechanically traced from the upper white fan in the supplied front-on
    # product image: one real outside boundary and all 17 real cut-through
    # openings. The finger opening's centroid is the local hand pivot.
    trace = json.loads(DOODLEGRIP_CONTOURS.read_text(encoding="utf-8"))
    outline = [tuple(point) for point in trace["outline"]]
    holes = [[tuple(point) for point in contour] for contour in trace["holes"]]
    if trace["contour_count"] != 18 or len(holes) != 17:
        raise ValueError("DoodleGrip trace must contain one outline and 17 holes")
    if not math.isclose(trace["width_m"], DAY_WIDTH_M, abs_tol=1e-6):
        raise ValueError("DoodleGrip trace width no longer matches the physical build")
    if not math.isclose(trace["height_m"], DAY_HEIGHT_M, abs_tol=1e-6):
        raise ValueError("DoodleGrip trace height no longer matches the physical build")
    if not math.isclose(trace["ring_diameter_m"], 0.044, abs_tol=1e-6):
        raise ValueError("DoodleGrip trace no longer uses the selected 1.75-inch ring")
    if not trace.get("symmetry"):
        raise ValueError("DoodleGrip trace is missing its symmetry correction")

    draft = add_cut_sheet(
        "Fan_Day_DoodleGripPlate",
        outline,
        holes,
        DAY_DEPTH_M,
        day_material,
        parent,
    )
    # Curve smoothing and the rounded stock edge extend beyond the control
    # contour. Calibrate the finished mesh, after both operations, so its
    # exported envelope matches the manufacturer's 510 x 350 mm dimensions.
    finished_dimensions = draft.dimensions.copy()
    scale_x = DAY_WIDTH_M / finished_dimensions.x
    scale_y = DAY_HEIGHT_M / finished_dimensions.y
    bpy.data.objects.remove(draft, do_unlink=True)

    # The envelope correction is anisotropic by a fraction of a percent. Feed
    # its inverse into the central ring before the final build so the finished
    # control boundary remains a true 44mm circle after calibration.
    corrected_ring = [
        (point[0] / scale_x, point[1] / scale_y) for point in holes[-1]
    ]
    plate = add_cut_sheet(
        "Fan_Day_DoodleGripPlate",
        outline,
        [*holes[:-1], corrected_ring],
        DAY_DEPTH_M,
        day_material,
        parent,
    )
    for vertex in plate.data.vertices:
        vertex.co.x *= scale_x
        vertex.co.y *= scale_y
    plate.data.update()
    plate["tka_build"] = "DoodleGrip practice fan"
    plate["tka_construction"] = "single extruded HDPE cut sheet"
    plate["tka_trace_source"] = trace["source"]
    plate["tka_trace_contours"] = trace["contour_count"]
    plate["tka_trace_holes"] = len(holes)
    plate["tka_trace_points"] = len(outline) + sum(len(hole) for hole in holes)
    plate["tka_trace_pivot_px"] = trace["pivot_px"]
    plate["tka_ring_diameter_m"] = trace["ring_diameter_m"]
    plate["tka_symmetry"] = trace["symmetry"]
    plate["tka_official_dimensions_source"] = trace["official_dimensions_source"]
    plate["tka_finished_dimension_calibration"] = [scale_x, scale_y, 1.0]
    plate["tka_finished_ring_control_diameter_m"] = trace["ring_diameter_m"]
    plate["tka_minimum_web_m"] = trace["minimum_web_m"]
    return [plate]


def build_fire_frame(
    parent: bpy.types.Object,
    steel: bpy.types.Material,
    wick: bpy.types.Material,
    wick_band: bpy.types.Material,
) -> list[bpy.types.Object]:
    objects: list[bpy.types.Object] = []
    reference = json.loads(DOODLEGRIP_FIRE_REFERENCE.read_text(encoding="utf-8"))
    geometry = reference["geometry_m"]
    if reference["published_dimensions_m"] != [FIRE_WIDTH_M, FIRE_HEIGHT_M]:
        raise ValueError("Fire DoodleGrip reference no longer matches 19 x 13 inches")
    if reference["lower_fan_excluded_below_px"] != reference[
        "isolated_upper_fan_bbox_px"
    ]["bottom"]:
        raise ValueError("Fire DoodleGrip cutout includes pixels from the lower fan")
    parent["tka_build"] = "Forged Creations five-wick DoodleGrip fire fan"
    parent["tka_dimensions_m"] = [FIRE_WIDTH_M, FIRE_HEIGHT_M]
    parent["tka_spinning_ring_id_m"] = FIRE_RING_DIAMETER_M
    parent["tka_wick_length_m"] = FIRE_WICK_LENGTH_M
    parent["tka_outer_spine_diameter_m"] = FIRE_OUTER_SPINE_RADIUS_M * 2
    parent["tka_inner_spine_diameter_m"] = FIRE_INNER_SPINE_RADIUS_M * 2
    parent["tka_reference_source"] = "https://forgedfans.com/products/doodlegrip-fire-fans"
    parent["tka_reference_bbox_px"] = list(
        reference["isolated_upper_fan_bbox_px"].values()
    )
    parent["tka_reference_pivot_px"] = reference["pivot_px"]
    parent["tka_reference_pixel_scale_m"] = reference["pixel_scale_m"]
    parent["tka_reference_lower_fan_excluded"] = True

    # One 1.5-inch spinning ring sits at the hand pivot. The visible lower U
    # and three welded spokes are the DoodleGrip handle from the supplied
    # five-wick reference, not a Russian grip or a cluster of separate rings.
    objects.append(
        add_torus(
            "Fan_Fire_GripRing",
            (0.0, 0.0, 0.0),
            FIRE_RING_DIAMETER_M / 2,
            FIRE_OUTER_SPINE_RADIUS_M,
            FIRE_OUTER_SPINE_RADIUS_M * 2,
            steel,
            parent,
        )
    )
    # The supplied front-on photo gives two symmetric rail intersections and
    # the cradle's bottom. Those three points determine one circle. The measured
    # lower-side landmark lands on that same circle within the source image's
    # pixel tolerance, so the photographed handle is a constant-radius arc, not
    # a tall ellipse or a landmark-to-landmark spline.
    shell_top = tuple(geometry["handle_shell_top"])
    shell_lower = tuple(geometry["handle_shell_lower"])
    shell_bottom = tuple(geometry["handle_shell_bottom"])
    shell_vertical_span = shell_top[1] - shell_bottom[1]
    shell_center_y = (
        shell_top[0] ** 2 + shell_top[1] ** 2 - shell_bottom[1] ** 2
    ) / (2 * shell_vertical_span)
    shell_radius = shell_center_y - shell_bottom[1]
    shell_left_angle = math.atan2(
        shell_top[1] - shell_center_y,
        shell_top[0],
    )
    shell_right_angle = math.atan2(
        shell_top[1] - shell_center_y,
        -shell_top[0],
    )
    shell_path = circle_arc(
        shell_radius,
        shell_center_y,
        segments=72,
        start_angle=shell_left_angle,
        end_angle=math.tau + shell_right_angle,
    )
    parent["tka_grip_shell_geometry"] = "constant-radius circle"
    parent["tka_grip_shell_radius_m"] = shell_radius
    objects.append(
        add_round_rod(
            "Fan_Fire_GripShell",
            shell_path,
            FIRE_OUTER_SPINE_RADIUS_M,
            steel,
            parent,
        )
    )
    bridge_x = math.sqrt(
        max(0.0, shell_radius**2 - (shell_lower[1] - shell_center_y) ** 2)
    )
    left_bridge_end = (
        -bridge_x,
        shell_lower[1],
        0.0,
    )
    right_bridge_end = (-left_bridge_end[0], left_bridge_end[1], 0.0)
    grip_bridges = (
        [(-0.0155, -0.014, 0.0), left_bridge_end],
        [(0.0, -0.0214, 0.0), (*shell_bottom, 0.0)],
        [(0.0155, -0.014, 0.0), right_bridge_end],
    )
    for index, points in enumerate(grip_bridges, start=1):
        objects.append(
            add_round_rod(
                f"Fan_Fire_GripBridge_{index}",
                points,
                FIRE_INNER_SPINE_RADIUS_M,
                steel,
                parent,
            )
        )

    outer_wick_x, outer_wick_y = geometry["outer_wick_center"]
    diagonal_wick_x, diagonal_wick_y = geometry["diagonal_wick_center"]
    center_wick_y = geometry["center_wick_center_y"]
    tip_centres = [
        Vector((-outer_wick_x, outer_wick_y, 0.0)),
        Vector((-diagonal_wick_x, diagonal_wick_y, 0.0)),
        Vector((0.0, center_wick_y, 0.0)),
        Vector((diagonal_wick_x, diagonal_wick_y, 0.0)),
        Vector((outer_wick_x, outer_wick_y, 0.0)),
    ]
    roots = [
        Vector((-0.021, 0.010, 0.0)),
        Vector((-0.011, 0.020, 0.0)),
        Vector((0.0, 0.0214, 0.0)),
        Vector((0.011, 0.020, 0.0)),
        Vector((0.021, 0.010, 0.0)),
    ]
    shell_joints = [
        Vector((shell_top[0], shell_top[1], 0.0)),
        Vector((-shell_top[0], shell_top[1], 0.0)),
    ]
    root_point = (roots[0].x, roots[0].y)
    shell_point = (shell_joints[0].x, shell_joints[0].y)
    root_to_shell = cubic_bezier_curve(
        root_point,
        (-0.033, 0.016),
        (-0.047, 0.027),
        shell_point,
        segments=10,
    )
    shell_to_wick = cubic_bezier_curve(
        shell_point,
        (
            shell_point[0] + (shell_point[0] - (-0.047)),
            shell_point[1] + (shell_point[1] - 0.027),
        ),
        (-0.165, outer_wick_y),
        (tip_centres[0].x, tip_centres[0].y),
        segments=24,
    )
    left_outer = [*root_to_shell, *shell_to_wick[1:]]
    right_outer = [(-x, y, z) for x, y, z in left_outer]
    spine_paths: list[list[tuple[float, float, float]]] = [
        left_outer,
        [(roots[1].x, roots[1].y, 0.0), (tip_centres[1].x, tip_centres[1].y, 0.0)],
        [(roots[2].x, roots[2].y, 0.0), (tip_centres[2].x, tip_centres[2].y, 0.0)],
        [(roots[3].x, roots[3].y, 0.0), (tip_centres[3].x, tip_centres[3].y, 0.0)],
        right_outer,
    ]

    def path_direction(path: list[tuple[float, float, float]]) -> Vector:
        return (Vector(path[-1]) - Vector(path[-2])).normalized()

    for index, (path, centre) in enumerate(zip(spine_paths, tip_centres), start=1):
        direction = path_direction(path)
        spike_end = centre + direction * 0.008
        extended_path = [*path[:-1], (spike_end.x, spike_end.y, spike_end.z)]
        spine_name = (
            "Fan_Fire_LeftRail"
            if index == 1
            else "Fan_Fire_RightRail"
            if index == 5
            else f"Fan_Fire_Spine_{index}"
        )
        objects.append(
            add_round_rod(
                spine_name,
                extended_path,
                FIRE_OUTER_SPINE_RADIUS_M
                if index in (1, 5)
                else FIRE_INNER_SPINE_RADIUS_M,
                steel,
                parent,
            )
        )
        wick_half = FIRE_WICK_LENGTH_M / 2
        wick_start = centre - direction * wick_half
        wick_end = centre + direction * wick_half
        objects.append(
            add_cylinder_between(
                f"Fan_Fire_Wick_{index}",
                wick_start,
                wick_end,
                0.0135,
                wick,
                parent,
                vertices=32,
            )
        )
        for wrap in (-0.012, 0.0, 0.012):
            band_centre = centre + direction * wrap
            band_start = band_centre - direction * 0.0008
            band_end = band_centre + direction * 0.0008
            objects.append(
                add_cylinder_between(
                    f"Fan_Fire_WickWrap_{index}_{wrap:+.3f}",
                    band_start,
                    band_end,
                    0.0138,
                    wick_band,
                    parent,
                    vertices=32,
                )
            )

    diagonal_cross_x = 0.0676
    outer_wick_y = tip_centres[0].y

    # The reference has one straight horizon through the two outside wick
    # mounts and a four-brace star above it. These endpoints land on the three
    # straight inner spines, so every weld describes a buildable joint.
    webbing = (
        (
            "WickHorizon",
            [
                (tip_centres[0].x, outer_wick_y, 0.0),
                (tip_centres[4].x, outer_wick_y, 0.0),
            ],
        ),
        (
            "UpperLeftStar",
            [
                (tip_centres[2].x, tip_centres[2].y, 0.0),
                (-diagonal_cross_x, outer_wick_y, 0.0),
                (tip_centres[1].x, tip_centres[1].y, 0.0),
                (0.0, outer_wick_y, 0.0),
            ],
        ),
        (
            "UpperRightStar",
            [
                (tip_centres[2].x, tip_centres[2].y, 0.0),
                (diagonal_cross_x, outer_wick_y, 0.0),
                (tip_centres[3].x, tip_centres[3].y, 0.0),
                (0.0, outer_wick_y, 0.0),
            ],
        ),
    )
    for suffix, points in webbing:
        objects.append(
            add_round_rod(
                f"Fan_Fire_{suffix}",
                points,
                FIRE_INNER_SPINE_RADIUS_M,
                steel,
                parent,
            )
        )
    return objects


def build_cover(
    parent: bpy.types.Object,
    solid: bpy.types.Material,
    stripe_light: bpy.types.Material,
    stripe_dark: bpy.types.Material,
    seam: bpy.types.Material,
) -> list[bpy.types.Object]:
    # The sleeve follows the actual five-wick crown: its ends close around the
    # two horizontal outside wicks and its top clears the centre wick.
    reference = json.loads(DOODLEGRIP_FIRE_REFERENCE.read_text(encoding="utf-8"))
    geometry = reference["geometry_m"]
    outer_wick_x, outer_wick_y = geometry["outer_wick_center"]
    diagonal_wick_x, diagonal_wick_y = geometry["diagonal_wick_center"]
    centre_wick_top = geometry["center_wick_center_y"] + FIRE_WICK_LENGTH_M / 2
    cover_edge_x = outer_wick_x + FIRE_WICK_LENGTH_M / 2
    outer = ellipse_arc(
        cover_edge_x + 0.0022,
        centre_wick_top - outer_wick_y,
        outer_wick_y,
        segments=48,
    )
    # This is a physical sleeve over the intact fire fan, not a replacement
    # silhouette. Its lower seam follows just inside all five wick rolls, so the
    # fabric occludes them while the complete frame and wicks remain in the GLB.
    seam_clearance = 0.0022
    wick_clearance = 0.0138 + seam_clearance
    inner_edge_y = outer_wick_y - wick_clearance
    inner = catmull_rom_curve(
        [
            (cover_edge_x + seam_clearance, inner_edge_y),
            (outer_wick_x, inner_edge_y),
            (diagonal_wick_x, diagonal_wick_y - wick_clearance),
            (
                0.0,
                geometry["center_wick_center_y"]
                - FIRE_WICK_LENGTH_M / 2
                - seam_clearance,
            ),
            (-diagonal_wick_x, diagonal_wick_y - wick_clearance),
            (-outer_wick_x, inner_edge_y),
            (-cover_edge_x - seam_clearance, inner_edge_y),
        ],
        segments_per_span=8,
    )
    front = add_cover_surface(
        "Fan_Cover_SolidFace",
        outer,
        inner,
        0.0145,
        [solid],
        parent,
        striped=False,
    )
    back = add_cover_surface(
        "Fan_Cover_StripedFace",
        outer,
        inner,
        -0.0145,
        [stripe_dark, stripe_light],
        parent,
        striped=True,
    )
    objects = [front, back]
    for suffix, points in (
        ("OuterSeam", outer),
        ("InnerSeam", inner),
        ("LeftSeam", [outer[-1], inner[-1]]),
        ("RightSeam", [outer[0], inner[0]]),
    ):
        objects.append(
            add_round_rod(
                f"Fan_Cover_{suffix}", points, 0.0022, seam, parent
            )
        )
    return objects


def build_asset() -> tuple[
    bpy.types.Object,
    dict[str, bpy.types.Object],
    list[bpy.types.Object],
    dict[str, bpy.types.Material],
]:
    root = add_empty("TKA_Fan")
    root["tka_asset"] = "doodle-style fan"
    root["tka_hand_pivot"] = "grip ring centre"
    root["tka_day_dimensions_m"] = [DAY_WIDTH_M, DAY_HEIGHT_M, DAY_DEPTH_M]
    root["tka_day_ring_diameter_m"] = 0.044
    root["tka_fire_dimensions_m"] = [FIRE_WIDTH_M, FIRE_HEIGHT_M]

    groups = {
        "fire": add_empty("Fan_Fire", root),
        "day": add_empty("Fan_Day", root),
        "cover": add_empty("Fan_Cover", root),
    }
    materials = {
        "fire": make_material(
            "TKA_Fan_Fire_Steel", (0.045, 0.038, 0.032, 1), roughness=0.48, metallic=0.76
        ),
        "wick": make_material(
            "TKA_Fan_Wick", (0.72, 0.55, 0.29, 1), roughness=0.96
        ),
        "wick_band": make_material(
            "TKA_Fan_Wick_Wrap", (0.34, 0.22, 0.09, 1), roughness=0.82
        ),
        "day": make_material(
            "TKA_Fan_Day_Frame", (0.025, 0.028, 0.034, 1), roughness=0.72, coat=0.08
        ),
        "cover_solid": make_material(
            "TKA_Fan_Cover_Solid_Recolor", (0.73, 0.08, 0.18, 1), roughness=0.82
        ),
        "cover_dark": make_material(
            "TKA_Fan_Cover_Stripe_Dark", (0.012, 0.014, 0.02, 1), roughness=0.86
        ),
        "cover_light": make_material(
            "TKA_Fan_Cover_Stripe_Light", (0.91, 0.90, 0.84, 1), roughness=0.88
        ),
        "cover_seam": make_material(
            "TKA_Fan_Cover_Seam", (0.35, 0.025, 0.06, 1), roughness=0.78
        ),
    }

    objects: list[bpy.types.Object] = []
    objects.extend(build_day_frame(groups["day"], materials["day"]))
    objects.extend(
        build_fire_frame(
            groups["fire"], materials["fire"], materials["wick"], materials["wick_band"]
        )
    )
    objects.extend(
        build_cover(
            groups["cover"],
            materials["cover_solid"],
            materials["cover_light"],
            materials["cover_dark"],
            materials["cover_seam"],
        )
    )
    for obj in objects:
        obj["tka_runtime_layer"] = obj.parent.name if obj.parent else ""
    return root, groups, objects, materials


def export_glb(
    output_path: Path,
    root: bpy.types.Object,
    groups: dict[str, bpy.types.Object],
    objects: list[bpy.types.Object],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for item in [root, *groups.values(), *objects]:
        item.select_set(True)
    bpy.context.view_layer.objects.active = root
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


def configure_proof_scene() -> bpy.types.Object:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.009, 0.018, 1.0)
    background.inputs["Strength"].default_value = 0.25
    for name, location, energy, size, color in (
        ("QA_Key", (-0.65, -0.2, 0.85), 150, 0.72, (1.0, 0.84, 0.68)),
        ("QA_Fill", (0.7, 0.0, 0.55), 90, 0.62, (0.38, 0.62, 1.0)),
        ("QA_Rim", (0.0, 0.55, -0.7), 110, 0.56, (0.95, 0.16, 0.1)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, 0.11, 0.0)))
    bpy.ops.object.camera_add(location=(0.0, 0.11, 0.82))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 60
    point_at(camera, Vector((0.0, 0.11, 0.0)))
    bpy.context.scene.camera = camera
    return camera


def render_proofs(
    render_dir: Path,
    groups: dict[str, bpy.types.Object],
    materials: dict[str, bpy.types.Material],
) -> None:
    render_dir.mkdir(parents=True, exist_ok=True)
    camera = configure_proof_scene()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.0

    def show_group(group: bpy.types.Object, show: bool) -> None:
        # Blender does not consistently propagate an Empty's render flag to
        # converted curve meshes. Set every child explicitly so each proof is
        # one real configuration rather than several variants overlaid.
        group.hide_render = not show
        for child in group.children_recursive:
            child.hide_render = not show

    variants = (
        ("fire-bare", True, False, False, "black", False),
        ("fire-bare-back", True, False, False, "black", True),
        ("fire-covered-solid", True, False, True, "black", False),
        ("fire-covered-striped", True, False, True, "black", True),
        ("day-black-bare", False, True, False, "black", False),
        ("day-black-covered-solid", False, True, True, "black", False),
        ("day-white-bare", False, True, False, "white", False),
        ("day-white-covered-solid", False, True, True, "white", False),
        ("day-white-covered-striped", False, True, True, "white", True),
    )
    for label, fire, day, cover, day_color, rear in variants:
        show_group(groups["fire"], fire)
        show_group(groups["day"], day)
        show_group(groups["cover"], cover)
        set_material_color(
            materials["day"],
            (0.84, 0.86, 0.90, 1.0) if day_color == "white" else (0.025, 0.028, 0.034, 1.0),
        )
        camera.location.z = -0.82 if rear else 0.82
        point_at(camera, Vector((0.0, 0.11, 0.0)))
        scene.render.filepath = str(render_dir / f"fan-{label}.png")
        bpy.ops.render.render(write_still=True)

    # The handle is too small to judge honestly in the full-fan proof. Keep a
    # straight-on inspection frame that makes a flat spot, changing radius, or
    # left/right mismatch immediately visible.
    show_group(groups["fire"], True)
    show_group(groups["day"], False)
    show_group(groups["cover"], False)
    camera.location = (0.0, -0.006, 0.23)
    point_at(camera, Vector((0.0, -0.006, 0.0)))
    scene.render.filepath = str(render_dir / "fan-fire-grip-closeup.png")
    bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, objects: list[bpy.types.Object]) -> None:
    meshes = [obj for obj in objects if obj.type == "MESH"]
    triangles = sum(len(obj.data.loop_triangles) for obj in meshes)
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    print(f"FAN_OUTPUT={output_path}")
    print(f"FAN_BYTES={output_path.stat().st_size}")
    print(f"FAN_MESHES={len(meshes)}")
    print(f"FAN_VERTICES={vertices}")
    print(f"FAN_TRIANGLES={triangles}")
    print(f"FAN_DAY_SIZE_M={DAY_WIDTH_M},{DAY_HEIGHT_M},{DAY_DEPTH_M}")
    print(f"FAN_FIRE_SIZE_M={FIRE_WIDTH_M},{FIRE_HEIGHT_M}")
    print("FAN_HAND_PIVOT=0,0,0")


def main() -> None:
    args = parse_args()
    reset_scene()
    root, groups, objects, materials = build_asset()
    output_path = args.output.resolve()
    export_glb(output_path, root, groups, objects)
    if args.blend:
        blend_path = args.blend.resolve()
        blend_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    if args.render_dir:
        render_proofs(args.render_dir.resolve(), groups, materials)
    print_summary(output_path, objects)


if __name__ == "__main__":
    main()
