"""Build the production fire-sword prop and multi-angle proof renders.

Geometry starts from static/images/props/sword.svg, which owns the prop's reach,
pivot, and knightly arming-sword identity. A literal extrusion of that 2D mark
collapses into a gold line once it is moving beside the performer, though, so
the production model gives the wick, guard, grip wrap, and wheel pommel a
deliberate 3D readability envelope. The hardware material name carries the
"Recolor" marker prop-model-recolor.ts looks for. The dark grip and layered
gold kevlar blade deliberately do not, so they keep their material identity at
runtime instead of turning into one flat hand-color silhouette.

The model is authored around the scene-3d hand pivot. Its long axis is local Y,
with the blade toward +Y and the pommel toward -Y. The origin sits at the
cross-guard, which is where sword.svg's viewBox center falls -- the same
centerPoint convention staff.svg marks explicitly.

Usage:
  blender --background --factory-startup --python scripts/build-sword-model.py
  blender --background --factory-startup --python scripts/build-sword-model.py -- \
    --output static/models/props/sword.glb \
    --render-dir scratchpad/sword-review/r1 \
    --blend scratchpad/sword-review/sword-production.blend
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "sword.glb"

# --- sword.svg, converted once -------------------------------------------
# The drawing spans x 112.5 (back of the pommel) to 566 (the point), and its
# viewBox center -- the TKA prop pivot -- sits at 286.15, inside the guard bar.
# Everything below is (svg_x - SVG_PIVOT_X) * SVG_TO_M, so the numbers in this
# file can be checked against the artwork by eye.
SVG_SPAN_UNITS = 453.5
SVG_PIVOT_X = 286.15
#: A 34" sword, the same overall length as the default staff in
#: config/user-proportions.ts. The artwork owns shape; published sizes own size.
AUTHORED_LENGTH_M = 0.8636
SVG_TO_M = AUTHORED_LENGTH_M / SVG_SPAN_UNITS


def svg_y(svg_x: float) -> float:
    """Blade-axis position, in metres, of an svg x coordinate."""
    return (svg_x - SVG_PIVOT_X) * SVG_TO_M


def svg_r(svg_units: float) -> float:
    """A perpendicular svg measurement, in metres."""
    return svg_units * SVG_TO_M


# Pommel: <circle cx="126" cy="32" r="13.5">. The 3D wheel is enlarged toward
# the grip, keeping the drawing's back edge fixed so the 34-inch reach does not
# drift while the pommel becomes visible beyond a closed hand.
POMMEL_RADIUS = svg_r(16.0)
POMMEL_CENTER_Y = svg_y(126.0) + (POMMEL_RADIUS - svg_r(13.5))
#: A wheel pommel is a disc, so its thickness stays well under its diameter --
#: the drawing gives no depth, and at parity it reads as a ball on a stick. It
#: still has to sit proud of the grip on every axis, which puts the floor at the
#: grip's own half-depth rather than anywhere the drawing could tell us.
POMMEL_HALF_THICKNESS = svg_r(7.0)

# Grip: <rect x="138" width="146" y="25.5" height="13" rx="6.5">
GRIP_START_Y = svg_y(138.0)
GRIP_END_Y = svg_y(284.0)
GRIP_HALF_WIDTH = svg_r(7.2)
#: The grip is oval, not round: a real hilt indexes edge alignment in the palm.
#: The narrow axis runs perpendicular to the blade's flat.
GRIP_HALF_DEPTH = svg_r(5.8)
#: The five cord-wrap lines the drawing rules across the grip. The drawing
#: strokes them as hairlines, so they are fine risers -- at the relief a raw
#: reading of "ring" suggests, five of them merge into a bamboo stalk.
CORD_RING_Y = tuple(svg_y(x) for x in (162.0, 186.0, 210.0, 234.0, 258.0))
CORD_RELIEF = svg_r(0.18)
CORD_RIDGE_WIDTH = svg_r(2.4)
# The relief above changes the silhouette. These raised bands change the
# material too, so the wrapped handle is still legible from the stage camera.
CORD_BAND_HALF_WIDTH = svg_r(1.45)
CORD_BAND_RELIEF = svg_r(0.72)

# Cross-guard: <rect x="280" width="16" y="9" height="46"> plus quillon balls
# <circle r="5"> at y 9 and y 55. The bar's own half-span is 23 units.
GUARD_CENTER_Y = svg_y(288.0)
GUARD_HALF_SPAN = svg_r(34.0)
GUARD_HALF_THICKNESS = svg_r(9.0)
QUILLON_RADIUS = svg_r(6.5)

# Blade: M292 23 L548 28.5 L566 32 L548 35.5 L292 41 Z
BLADE_SHOULDER_Y = svg_y(292.0)
BLADE_TAPER_END_Y = svg_y(548.0)
BLADE_TIP_Y = svg_y(566.0)
BLADE_SHOULDER_HALF_WIDTH = svg_r(14.0)
BLADE_TAPER_END_HALF_WIDTH = svg_r(5.5)
#: Thickness is NOT slaved to width. A wick wrap is a near-constant sleeve, and
#: even a bare blade only loses a third of its thickness over a distal taper --
#: driving depth off width turns the profile silhouette into a wire.
BLADE_SHOULDER_HALF_DEPTH = svg_r(7.4)
BLADE_DISTAL_THINNING = 0.34
#: The blade root runs back inside the guard bar so the two never gap.
BLADE_ROOT_Y = GUARD_CENTER_Y - GUARD_HALF_THICKNESS * 0.55

#: One kevlar weave tile, in metres. Drives the blade's generated UVs so the
#: weave holds a constant physical density from the shoulder to the point.
WEAVE_TILE_M = 0.030


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
        bpy.data.images,
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


def add_kevlar_weave_normal(material: bpy.types.Material) -> None:
    """Embed a seamless plain-weave normal map in the exported GLB.

    A fire sword's blade is wrapped wick, not polished steel. Without this the
    gold reads as flat paint at any distance the prop is actually seen from.
    """
    size = 256
    tile = 32
    strand = tile // 4
    heights = [0.0] * (size * size)

    for y in range(size):
        for x in range(size):
            u = x % tile
            v = y % tile
            # Plain weave: warp and weft alternate which one passes over.
            warp_over = ((u // strand) + (v // strand)) % 2 == 0
            across = (v % strand) if warp_over else (u % strand)
            centered = (across + 0.5) / strand - 0.5
            height = math.cos(centered * math.pi) ** 2
            # A shallow trough between neighbouring strands, so the tile does
            # not read as a grid of identical pillows.
            along = (u % strand if warp_over else v % strand) / strand - 0.5
            height -= 0.18 * (along * along)
            heights[y * size + x] = height

    pixels: list[float] = []
    for y in range(size):
        for x in range(size):
            left = heights[y * size + ((x - 1) % size)]
            right = heights[y * size + ((x + 1) % size)]
            down = heights[((y - 1) % size) * size + x]
            up = heights[((y + 1) % size) * size + x]
            normal = Vector((-(right - left) * 1.35, -(up - down) * 1.35, 1.0))
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
        "TKA_Sword_KevlarWeaveNormal",
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
    texture_node.name = "Kevlar wick weave"
    texture_node.image = image
    texture_node.extension = "REPEAT"
    texture_node.interpolation = "Linear"
    normal_node = nodes.new("ShaderNodeNormalMap")
    normal_node.name = "Wick weave relief"
    normal_node.inputs["Strength"].default_value = 1.0
    links.new(texture_node.outputs["Color"], normal_node.inputs["Color"])
    links.new(normal_node.outputs["Normal"], principled.inputs["Normal"])


def smooth_mesh(obj: bpy.types.Object) -> None:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def smart_uv(obj: bpy.types.Object) -> None:
    if len(obj.data.polygons) == 0:
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
    project_uv: bool = True,
) -> bpy.types.Object:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    if bevel > 0:
        modifier = obj.modifiers.new("Machined edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        apply_modifier(obj, modifier.name)

    obj.data.materials.clear()
    obj.data.materials.append(material)
    smooth_mesh(obj)
    if project_uv:
        smart_uv(obj)
    return obj


def oval_shaft(
    name: str,
    sections: tuple[tuple[float, float, float], ...],
    material: bpy.types.Material,
    *,
    segments: int = 28,
    uv_tile: float | None = None,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    """A closed tube of elliptical rings swept along local Y.

    Each section is (y, half_width_x, half_depth_z). The seam column is
    duplicated so a generated UV can wrap without smearing the last quad, which
    is what makes the blade's weave tile cleanly.
    """
    if len(sections) < 2:
        raise ValueError(f"Shaft {name} needs at least two sections")

    columns = segments + 1
    vertices: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    arclength = 0.0

    for index, (y, half_x, half_z) in enumerate(sections):
        if index > 0:
            arclength += abs(y - sections[index - 1][0])
        mean_radius = 0.5 * (half_x + half_z)
        for column in range(columns):
            angle = math.tau * column / segments
            vertices.append(
                (half_x * math.cos(angle), y, half_z * math.sin(angle))
            )
            if uv_tile:
                span = math.tau * mean_radius / uv_tile
                uvs.append((column / segments * span, arclength / uv_tile))
            else:
                uvs.append((column / segments, index / (len(sections) - 1)))

    faces: list[tuple[int, ...]] = []
    for ring in range(len(sections) - 1):
        start = ring * columns
        following = (ring + 1) * columns
        for column in range(segments):
            faces.append(
                (
                    start + column,
                    start + column + 1,
                    following + column + 1,
                    following + column,
                )
            )
    faces.append(tuple(reversed(range(segments))))
    last_ring = (len(sections) - 1) * columns
    faces.append(tuple(last_ring + column for column in range(segments)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uvs[loop.vertex_index]

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler = rotation
    obj.location = location
    return finish_mesh(obj, material, project_uv=uv_tile is None)


def swept_path(
    name: str,
    sections: tuple[tuple[float, float, float, float], ...],
    material: bpy.types.Material,
    *,
    segments: int = 22,
) -> bpy.types.Object:
    """Sweep an elliptical section along an XY path.

    Each section is (x, y, in-plane half-width, z half-depth). The guard uses
    this instead of a rotated straight shaft so its quillons can rise toward
    the blade without turning into a stack of visible cylinders.
    """
    if len(sections) < 2:
        raise ValueError(f"Path {name} needs at least two sections")

    columns = segments + 1
    vertices: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    distances = [0.0]
    for index in range(1, len(sections)):
        x0, y0, _, _ = sections[index - 1]
        x1, y1, _, _ = sections[index]
        distances.append(distances[-1] + math.hypot(x1 - x0, y1 - y0))
    total_distance = max(distances[-1], 0.000001)

    for index, (x, y, half_width, half_depth) in enumerate(sections):
        previous = sections[max(0, index - 1)]
        following = sections[min(len(sections) - 1, index + 1)]
        tangent_x = following[0] - previous[0]
        tangent_y = following[1] - previous[1]
        tangent_length = max(math.hypot(tangent_x, tangent_y), 0.000001)
        normal_x = -tangent_y / tangent_length
        normal_y = tangent_x / tangent_length

        for column in range(columns):
            angle = math.tau * column / segments
            in_plane = math.cos(angle) * half_width
            vertices.append(
                (
                    x + normal_x * in_plane,
                    y + normal_y * in_plane,
                    math.sin(angle) * half_depth,
                )
            )
            uvs.append((column / segments, distances[index] / total_distance))

    faces: list[tuple[int, ...]] = []
    for ring in range(len(sections) - 1):
        start = ring * columns
        following = (ring + 1) * columns
        for column in range(segments):
            faces.append(
                (
                    start + column,
                    start + column + 1,
                    following + column + 1,
                    following + column,
                )
            )
    faces.append(tuple(reversed(range(segments))))
    last_ring = (len(sections) - 1) * columns
    faces.append(tuple(last_ring + column for column in range(segments)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uvs[loop.vertex_index]

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_mesh(obj, material, project_uv=False)


def ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    segments: int = 24,
    rings: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=location
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return finish_mesh(obj, material)


def join_objects(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for item in objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = objects[0]
    result.name = name
    return result


def grip_sections() -> tuple[tuple[float, float, float], ...]:
    """The ringed grip, sampled finely enough to raise real cord relief."""
    steps = 92
    span = GRIP_END_Y - GRIP_START_Y
    sections: list[tuple[float, float, float]] = []
    for step in range(steps + 1):
        t = step / steps
        y = GRIP_START_Y + span * t
        # A hilt swells slightly toward the guard rather than running dead
        # parallel; the drawing's flat rect reads as a pipe once it has depth.
        taper = 0.94 + 0.09 * t
        relief = CORD_RELIEF * sum(
            math.exp(-(((y - ring) / CORD_RIDGE_WIDTH) ** 2)) for ring in CORD_RING_Y
        )
        sections.append(
            (y, GRIP_HALF_WIDTH * taper + relief, GRIP_HALF_DEPTH * taper + relief)
        )
    return tuple(sections)


def blade_half_depth(half_width: float, distal_t: float) -> float:
    """Lenticular cross-section, thinning along the blade rather than with it.

    The clamp against half_width only bites in the point, where the section has
    to close in both axes or the tip would end as a fat rod.
    """
    depth = BLADE_SHOULDER_HALF_DEPTH * (
        1.0 - BLADE_DISTAL_THINNING * min(max(distal_t, 0.0), 1.0)
    )
    return max(0.0005, min(depth, half_width * 0.72))


def blade_sections() -> tuple[tuple[float, float, float], ...]:
    sections: list[tuple[float, float, float]] = [
        (
            BLADE_ROOT_Y,
            BLADE_SHOULDER_HALF_WIDTH,
            blade_half_depth(BLADE_SHOULDER_HALF_WIDTH, 0.0),
        ),
    ]
    steps = 16
    for step in range(steps + 1):
        t = step / steps
        y = BLADE_SHOULDER_Y + (BLADE_TAPER_END_Y - BLADE_SHOULDER_Y) * t
        half_width = BLADE_SHOULDER_HALF_WIDTH + (
            BLADE_TAPER_END_HALF_WIDTH - BLADE_SHOULDER_HALF_WIDTH
        ) * t
        sections.append((y, half_width, blade_half_depth(half_width, t)))

    # The drawing's point is a separate 18-unit run, not a continuation of the
    # taper. Four rings close it without faceting the tip.
    tip_span = BLADE_TIP_Y - BLADE_TAPER_END_Y
    for t, width_fraction in ((0.42, 0.62), (0.72, 0.36), (0.90, 0.17), (1.0, 0.05)):
        half_width = BLADE_TAPER_END_HALF_WIDTH * width_fraction
        sections.append(
            (
                BLADE_TAPER_END_Y + tip_span * t,
                half_width,
                blade_half_depth(half_width, 1.0),
            )
        )
    return tuple(sections)


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    # sword.svg: .st0 #989498 is the recolorable hardware, .st1 #ffd540 the
    # preserved gold wick. Both converted from sRGB to linear.
    hardware = make_material(
        "TKA_Sword_Hardware_Recolor",
        (0.3139, 0.2962, 0.3139, 1.0),
        roughness=0.31,
        metallic=0.88,
    )
    grip_material = make_material(
        "TKA_Sword_Grip",
        (0.014, 0.018, 0.027, 1.0),
        roughness=0.84,
        metallic=0.02,
    )
    # #ffd540 converted straight to linear renders as cream, not gold: the red
    # channel pins at 1.0 and the highlight blows out. Backed off to hold the
    # drawing's hue once a light actually hits it.
    wick = make_material(
        "TKA_Sword_Wick",
        (0.88, 0.5350, 0.0450, 1.0),
        roughness=0.80,
        metallic=0.0,
    )
    add_kevlar_weave_normal(wick)
    wick_spine = make_material(
        "TKA_Sword_WickSpine",
        (0.22, 0.075, 0.008, 1.0),
        roughness=0.68,
        metallic=0.04,
    )

    root = bpy.data.objects.new("TKA_Sword", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "sword"
    root["authored_length_m"] = AUTHORED_LENGTH_M
    root["grip_origin"] = "0,0,0"
    root["local_long_axis"] = "+Y"
    root["recolor_material"] = "TKA_Sword_Hardware_Recolor"
    root["preserved_material"] = "TKA_Sword_Wick"
    root["reference_form"] = (
        "knightly arming fire sword, layered gold kevlar wick blade"
    )

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    pommel_profile = (
        (-1.00, 0.72),
        (-0.76, 0.90),
        (-0.33, 0.988),
        (0.0, 1.0),
        (0.33, 0.988),
        (0.76, 0.90),
        (1.00, 0.72),
    )
    pommel = oval_shaft(
        "TKA_Sword_Pommel",
        tuple(
            (
                POMMEL_HALF_THICKNESS * position,
                POMMEL_RADIUS * radius_scale,
                POMMEL_RADIUS * radius_scale,
            )
            for position, radius_scale in pommel_profile
        ),
        hardware,
        segments=32,
        # A wheel pommel's flat faces sit on the flats of the blade, so its axis
        # runs out of the drawing plane.
        rotation=(math.pi / 2, 0.0, 0.0),
        location=(0.0, POMMEL_CENTER_Y, 0.0),
    )

    grip = oval_shaft(
        "TKA_Sword_Grip",
        grip_sections(),
        grip_material,
        segments=26,
    )
    grip_bands = join_objects(
        "TKA_Sword_GripBands",
        [
            oval_shaft(
                f"TKA_Sword_GripBand_{index + 1}",
                (
                    (
                        ring_y - CORD_BAND_HALF_WIDTH,
                        GRIP_HALF_WIDTH + CORD_BAND_RELIEF,
                        GRIP_HALF_DEPTH + CORD_BAND_RELIEF,
                    ),
                    (
                        ring_y + CORD_BAND_HALF_WIDTH,
                        GRIP_HALF_WIDTH + CORD_BAND_RELIEF,
                        GRIP_HALF_DEPTH + CORD_BAND_RELIEF,
                    ),
                ),
                hardware,
                segments=22,
            )
            for index, ring_y in enumerate(CORD_RING_Y)
        ],
    )

    # Two continuous wings form a shallow V toward the blade. A straight
    # capsule looked like a toy crossbar once the sword was in the performer's
    # hand; this rise creates a clear throat and keeps the guard readable while
    # the prop rolls through profile.
    wing_profile = (
        (0.00, 0.00, 1.00, 1.00),
        (0.34, 0.08, 0.98, 0.96),
        (0.68, 0.24, 0.90, 0.88),
        (0.88, 0.41, 0.79, 0.80),
        (1.00, 0.58, 0.68, 0.74),
    )
    wing_depth = GUARD_HALF_THICKNESS * 0.58
    guard_wings = [
        swept_path(
            f"TKA_Sword_GuardWing_{label}",
            tuple(
                (
                    side * GUARD_HALF_SPAN * along,
                    GUARD_CENTER_Y + GUARD_HALF_THICKNESS * rise,
                    GUARD_HALF_THICKNESS * width_scale,
                    wing_depth * depth_scale,
                )
                for along, rise, width_scale, depth_scale in wing_profile
            ),
            hardware,
            segments=22,
        )
        for label, side in (("Left", -1.0), ("Right", 1.0))
    ]
    quillons = [
        ellipsoid(
            f"TKA_Sword_Quillon_{label}",
            (
                side * GUARD_HALF_SPAN,
                GUARD_CENTER_Y + GUARD_HALF_THICKNESS * 0.62,
                0.0,
            ),
            # Teardrop terminals continue the upswept line instead of capping
            # each side with the old spherical bead.
            (
                QUILLON_RADIUS,
                QUILLON_RADIUS * 1.28,
                wing_depth * 0.78,
            ),
            hardware,
            segments=20,
            rings=14,
        )
        for label, side in (("Left", -1.0), ("Right", 1.0))
    ]
    guard = join_objects("TKA_Sword_Guard", [*guard_wings, *quillons])
    smooth_mesh(guard)

    blade = oval_shaft(
        "TKA_Sword_Blade",
        blade_sections(),
        wick,
        segments=24,
        uv_tile=WEAVE_TILE_M,
    )
    # A darker raised centre lane gives the broad wick a front/back face in
    # motion. Without it, the woven sleeve is one evenly lit gold paddle and
    # loses the blade hierarchy that makes the object read as a sword.
    blade_spine = oval_shaft(
        "TKA_Sword_BladeSpine",
        tuple(
            (
                y,
                max(svg_r(0.55), half_width * 0.26),
                half_depth + svg_r(0.42),
            )
            for y, half_width, half_depth in blade_sections()
        ),
        wick_spine,
        segments=18,
    )

    objects = [pommel, grip, grip_bands, guard, blade, blade_spine]
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

    # Blender exports its Z-up basis to glTF's Y-up basis. The sword is kept
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
    background.inputs["Strength"].default_value = 0.22

    for name, location, energy, size, color in (
        ("QA_Key", (-0.70, 0.50, 1.00), 105, 0.80, (1.0, 0.94, 0.84)),
        ("QA_Fill", (0.90, -0.18, 0.65), 62, 0.70, (0.48, 0.66, 1.0)),
        ("QA_Rim", (-0.60, -0.38, -0.80), 70, 0.60, (1.0, 0.32, 0.16)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, 0.0, 0.0)))

    bpy.ops.object.camera_add(location=(0.0, 0.0, 1.65))
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
    scene.render.resolution_x = 800
    scene.render.resolution_y = 1300
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.05

    views = {
        "front": ((0.0, 0.10, 1.65), (0.0, 0.0, 0.0)),
        "three-quarter": ((0.95, 0.10, 1.35), (0.0, math.radians(35), 0.0)),
        "profile": ((1.65, 0.10, 0.0), (0.0, math.radians(90), 0.0)),
        "rear": ((0.0, 0.10, -1.65), (0.0, math.pi, 0.0)),
    }
    for label, (location, rotation) in views.items():
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"sword-{label}.png")
        bpy.ops.render.render(write_still=True)

    # The hilt is small next to a 34" blade; a tight pass is the only way to
    # judge the cord relief and the quillon balls.
    camera.data.lens = 105
    for label, (location, rotation) in (
        ("hilt", ((0.0, -0.16, 0.60), (0.0, 0.0, 0.0))),
        ("hilt-profile", ((0.60, -0.16, 0.0), (0.0, math.radians(90), 0.0))),
        ("point", ((0.0, 0.46, 0.42), (0.0, 0.0, 0.0))),
    ):
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"sword-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(
    output_path: Path,
    model_objects: list[bpy.types.Object],
) -> None:
    meshes = [item for item in model_objects if item.type == "MESH"]
    vertices = sum(len(item.data.vertices) for item in meshes)
    polygons = sum(len(item.data.polygons) for item in meshes)
    print(f"SWORD_OUTPUT={output_path}")
    print(f"SWORD_BYTES={output_path.stat().st_size}")
    print(f"SWORD_MESHES={len(meshes)}")
    print(f"SWORD_VERTICES={vertices}")
    print(f"SWORD_POLYGONS={polygons}")
    print(f"SWORD_LENGTH_M={AUTHORED_LENGTH_M}")
    print(f"SWORD_TIP_Y={BLADE_TIP_Y:.7f}")
    print(f"SWORD_POMMEL_Y={POMMEL_CENTER_Y - POMMEL_RADIUS:.7f}")
    print("SWORD_HAND_PIVOT=0,0,0")


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
