"""Build the production LED capsule baton prop and multi-angle proof renders.

Geometry is driven by static/images/props/pictograph/capsule_baton.svg, which is
the authority for the prop's shape: a braided silver shaft, a silicone grip
centred on the pivot, a tapered collar where the shaft enters each clear
polycarbonate tube, paired vent holes near each tube's open rim, and a frosted
fluted cap over each end with the light capsule inside it.

The drawing's colour contract splits the prop in two, and this build follows both
halves: the lit section (tube + cap) carries the "Recolor" marker
prop-model-recolor.ts looks for, so it takes the hand colour at runtime, and the
hardware materials deliberately do not, so the shaft stays silver on both hands.

The model is authored around the scene-3d hand pivot: long axis local Y, origin
at the drawing's viewBox centre, both ends live. It is bilateral, so it needs no
grip offset and no flipLongAxis.

Usage:
  blender --background --factory-startup --python scripts/build-capsule-baton-model.py
  blender --background --factory-startup --python scripts/build-capsule-baton-model.py -- \
    --output static/models/props/capsule-baton.glb \
    --render-dir scratchpad/baton-review/r1 \
    --blend scratchpad/baton-review/capsule-baton-production.blend
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "capsule-baton.glb"

# --- capsule_baton.svg, converted once ------------------------------------
# viewBox 252.8 x 40, so the prop pivot -- the drawing's centre -- sits at
# x 126.4. Every axial number below is an offset from that pivot in drawing
# units, so it can be checked against the artwork by eye.
SVG_SPAN_UNITS = 252.8
#: A 34" baton, the same overall length as the default staff in
#: config/user-proportions.ts. The artwork owns shape; published sizes own size.
AUTHORED_LENGTH_M = 0.8636
SVG_TO_M = AUTHORED_LENGTH_M / SVG_SPAN_UNITS

#: The drawing states its own cross-section is about 2x the real object, the same
#: exaggeration staff.svg uses, because a 25mm tube on a 660mm prop would
#: otherwise be a hairline. 3D has no such problem, so perpendicular measurements
#: come back down. The anchor is the 3D staff itself: user-proportions.ts draws a
#: 2.5cm-diameter staff, so its radius is 1.448% of a 34" length, where the
#: drawing's shaft half-height is 5/252.8 = 1.978%. One factor, applied to every
#: perpendicular measurement, so the silhouette the drawing asserts -- thin
#: middle, fat ends -- survives intact.
STAFF_RADIUS_M = 0.0125
CROSS_SCALE = STAFF_RADIUS_M / (5.0 * SVG_TO_M)


def axial(offset_units: float) -> float:
    """Position along the prop's long axis, in metres, of a pivot offset."""
    return offset_units * SVG_TO_M


def radial(svg_units: float) -> float:
    """A perpendicular svg measurement, in metres, de-exaggerated."""
    return svg_units * SVG_TO_M * CROSS_SCALE


# Shaft: <rect x="40.4" width="172" y="15" height="10" rx="5">
# 126.4 - 40.4 = 86.0 and 212 - 126.4 = 85.6; the 0.4-unit difference is a
# drafting artifact, not a design, so the 3D shaft is symmetric on the larger.
SHAFT_HALF_Y = axial(86.0)
SHAFT_R = radial(5.0)

# Grip: <rect x="96.4" width="60" y="13.7" height="12.6" rx="6.3">
GRIP_HALF_Y = axial(30.0)
GRIP_R = radial(6.3)

# Grip end rings: <rect x="98.6" width="1.8" ...> and its mirror at x="152.4".
GRIP_RING_Y = axial(26.9)
GRIP_RING_HALF_Y = axial(0.9)
GRIP_RING_R = radial(6.6)

# Tapered collar: <path d="M203 14.5 L214 11.5 L214 28.5 L203 25.5 Z">
COLLAR_INNER_Y = axial(76.6)
COLLAR_OUTER_Y = axial(87.6)
COLLAR_INNER_R = radial(5.5)
COLLAR_OUTER_R = radial(8.5)

# Clear tube: <rect x="212" width="40.8" y="10" height="20" rx="4.5">
TUBE_INNER_Y = axial(85.6)
TUBE_R = radial(10.0)
#: The tube runs to the drawing's edge, but the cap slides over it from 105.6
#: out. Stopping the tube just inside the cap keeps the two lathes from sharing a
#: surface, which reads as z-fighting on a prop this small on screen.
TUBE_OUTER_Y = axial(110.0)

# Open rim of the tube: <path d="M212.6 11.2 L215.4 11.2 L215.4 28.8 L212.6 28.8">
TUBE_RIM_INNER_Y = axial(86.2)
TUBE_RIM_OUTER_Y = axial(89.0)
TUBE_RIM_R = radial(10.35)

# Paired vent holes: <circle cx="220.5" cy="15.8" r="1.35"> and cy="24.2".
VENT_Y = axial(94.1)
VENT_R = radial(1.35)
#: A vent is a disc, not a peg. Half a millimetre thick, seated so a third of a
#: millimetre shows above the tube -- clear of the tube's surface, so nothing
#: z-fights, and far too shallow to read as a lump.
VENT_DISC_HALF = 0.0005
VENT_PROUD_M = 0.0003

# Frosted fluted cap:
#   <path d="M232 8.3 L244.5 10.1 C250.7 11.6 252.8 15.4 252.8 20 ...">
# Read as half-heights off the drawing's y=20 centreline, the outline runs
# straight from 11.7 at the cap's inner edge down to 9.9, then curves to the tip.
CAP_INNER_Y = axial(105.6)
CAP_INNER_R = radial(11.7)
CAP_SHOULDER_Y = axial(118.1)
CAP_SHOULDER_R = radial(9.9)
CAP_TIP_Y = axial(126.4)
#: Cubic control points of that closing curve, as (pivot offset, half-height).
CAP_CURVE = (
    (118.1, 9.9),
    (124.3, 8.4),
    (126.4, 4.6),
    (126.4, 0.0),
)
#: The drawing rules four flute lines across each cap. Eight shallow flutes read
#: as a fluted silicone cap from any angle; four only read from the front. The
#: depth has to survive smoothing: at 0.055 the creases washed out completely in
#: the first proof pass and the cap read as a blank plastic bullet.
CAP_FLUTES = 8
CAP_FLUTE_DEPTH = 0.09
#: Enough columns that eight flutes each get a readable shoulder rather than one
#: facet. 26 put the flute crease and the segment crease on the same edge.
CAP_SEGMENTS = 48

# Rim where the cap slides over the tube: <path d="M232 8.3 L235.2 8.8 ...">
CAP_RIM_INNER_Y = axial(105.6)
CAP_RIM_OUTER_Y = axial(108.8)
#: The rim is a band around the cap, so it follows the cap's taper and stands a
#: fixed margin proud of it. A constant radius instead left the band's flat disc
#: ends near-tangent to the cap cone, and the intersection z-fought into a
#: visibly ragged line in the first proof pass.
CAP_RIM_PROUD_M = 0.0009

#: Where prop-tip-points.ts puts the tracked emitters: the cap centre, +/-117,
#: not the outer edge. Reported so verify-capsule-baton-glb.cjs can hold the
#: model and the 2D tip table to the same number.
TRACKED_TIP_Y = axial(117.0)


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


def smooth_mesh(obj: bpy.types.Object) -> None:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def crease_by_angle(obj: bpy.types.Object, degrees: float = 35.0) -> None:
    """Smooth along a surface but keep its hard edges hard.

    Blanket smoothing is what erased the cap flutes and melted the collar
    shoulders in the first proof pass: every crease the profile asserts got
    averaged away. Auto-smooth keeps a crease wherever the surface turns harder
    than `degrees`, which is exactly the set of edges the drawing draws.
    """
    smooth_mesh(obj)
    activate(obj)
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(degrees))
    except (AttributeError, RuntimeError, TypeError):
        return
    for modifier in list(obj.modifiers):
        if modifier.type == "NODES":
            bpy.ops.object.modifier_apply(modifier=modifier.name)


def smart_uv(obj: bpy.types.Object) -> None:
    """Give the mesh a UV layer.

    Nothing on this prop is textured -- every material is a flat authored color
    -- but `scripts/lib/glb-measure.cjs` requires UVs on every primitive, and it
    is right to: a mesh that ships without them cannot be textured later without
    a rebuild.
    """
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
    obj: bpy.types.Object, material: bpy.types.Material
) -> bpy.types.Object:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    smooth_mesh(obj)
    smart_uv(obj)
    return obj


def lathe(
    name: str,
    sections: tuple[tuple[float, float], ...],
    material: bpy.types.Material,
    *,
    segments: int = 28,
    flutes: int = 0,
    flute_depth: float = 0.0,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    """A closed tube of circular rings swept along local Y.

    Each section is (y, radius). `flutes` adds a cosine ripple to the radius
    around the axis, which is how the cap gets its axial flutes without a
    separate mesh per ridge.
    """
    if len(sections) < 2:
        raise ValueError(f"Lathe {name} needs at least two sections")

    vertices: list[tuple[float, float, float]] = []
    for y, radius in sections:
        for column in range(segments):
            angle = math.tau * column / segments
            ripple = (
                1.0 - flute_depth * (0.5 - 0.5 * math.cos(flutes * angle))
                if flutes
                else 1.0
            )
            scaled = radius * ripple
            vertices.append(
                (scaled * math.cos(angle), y, scaled * math.sin(angle))
            )

    faces: list[tuple[int, ...]] = []
    for ring in range(len(sections) - 1):
        start = ring * segments
        following = (ring + 1) * segments
        for column in range(segments):
            nxt = (column + 1) % segments
            faces.append(
                (start + column, start + nxt, following + nxt, following + column)
            )
    faces.append(tuple(reversed(range(segments))))
    last_ring = (len(sections) - 1) * segments
    faces.append(tuple(last_ring + column for column in range(segments)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler = rotation
    obj.location = location
    return finish_mesh(obj, material)


def join_objects(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for item in objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


def bezier_point(
    curve: tuple[tuple[float, float], ...], t: float
) -> tuple[float, float]:
    (x0, r0), (x1, r1), (x2, r2), (x3, r3) = curve
    u = 1.0 - t
    w = (u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t)
    return (
        w[0] * x0 + w[1] * x1 + w[2] * x2 + w[3] * x3,
        w[0] * r0 + w[1] * r1 + w[2] * r2 + w[3] * r3,
    )


def cap_radius_at(offset_units: float) -> float:
    """Cap radius, in metres, at a pivot offset inside its straight taper."""
    span = CAP_SHOULDER_Y - CAP_INNER_Y
    t = (axial(offset_units) - CAP_INNER_Y) / span
    return CAP_INNER_R + t * (CAP_SHOULDER_R - CAP_INNER_R)


def cap_sections(sign: float) -> tuple[tuple[float, float], ...]:
    """Cap profile, inner edge to rounded tip, on whichever end `sign` names."""
    stops: list[tuple[float, float]] = [
        (sign * CAP_INNER_Y, CAP_INNER_R),
        (sign * CAP_SHOULDER_Y, CAP_SHOULDER_R),
    ]
    steps = 9
    for index in range(1, steps + 1):
        offset_units, half_units = bezier_point(CAP_CURVE, index / steps)
        stops.append((sign * axial(offset_units), radial(half_units)))
    # A radius of exactly zero collapses the tip ring onto a point, which leaves
    # `segments` degenerate quads; a hair of radius keeps the cap watertight.
    stops[-1] = (stops[-1][0], max(stops[-1][1], radial(0.22)))
    return tuple(stops)


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    # Every colour below is its capsule_baton.svg fill converted sRGB -> linear,
    # so the model and the drawing stay the same prop.
    hardware = make_material(  # #C3CDDC, the shaft and every silver fitting
        "TKA_Baton_Hardware",
        (0.5462, 0.6106, 0.7159, 1.0),
        roughness=0.30,
        metallic=0.72,
        coat=0.18,
    )
    grip_material = make_material(  # #7C8899, the silicone grip
        "TKA_Baton_Grip",
        (0.2018, 0.2464, 0.3186, 1.0),
        roughness=0.72,
        metallic=0.05,
    )
    # Neutral by design: prop-model-recolor.ts drives this material to the hand
    # colour, exactly as the drawing's neutral #B4B4B4 tube and #C9C9C9 cap are
    # driven by the 2D fill pass. The name carries the "Recolor" marker.
    led = make_material(
        "TKA_Baton_LED_Recolor",
        (0.5164, 0.5164, 0.5164, 1.0),
        roughness=0.42,
        metallic=0.0,
        coat=0.35,
    )
    vent_material = make_material(  # #2A313B, the vent holes
        "TKA_Baton_Vent",
        (0.0232, 0.0307, 0.0436, 1.0),
        roughness=0.85,
        metallic=0.0,
    )

    root = bpy.data.objects.new("TKA_CapsuleBaton", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "capsule_baton"
    root["authored_length_m"] = AUTHORED_LENGTH_M
    root["grip_origin"] = "0,0,0"
    root["local_long_axis"] = "+Y"
    root["recolor_material"] = "TKA_Baton_LED_Recolor"
    root["preserved_material"] = "TKA_Baton_Hardware"
    root["tracked_tip_y"] = TRACKED_TIP_Y
    root["reference_form"] = "LED capsule baton, silver shaft, lit ends"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    shaft = lathe(
        "TKA_Baton_Shaft",
        ((-SHAFT_HALF_Y, SHAFT_R), (SHAFT_HALF_Y, SHAFT_R)),
        hardware,
        segments=24,
    )

    # The drawing draws the grip as a rounded rect, so its ends are domed rather
    # than cut square.
    grip_profile = (
        (-1.00, 0.42),
        (-0.97, 0.78),
        (-0.93, 0.95),
        (-0.50, 1.00),
        (0.50, 1.00),
        (0.93, 0.95),
        (0.97, 0.78),
        (1.00, 0.42),
    )
    grip = lathe(
        "TKA_Baton_Grip",
        tuple(
            (GRIP_HALF_Y * position, GRIP_R * radius_scale)
            for position, radius_scale in grip_profile
        ),
        grip_material,
        segments=26,
    )

    fittings: list[bpy.types.Object] = []
    lit: list[bpy.types.Object] = []
    vents: list[bpy.types.Object] = []

    for label, sign in (("Left", -1.0), ("Right", 1.0)):
        fittings.append(
            lathe(
                f"TKA_Baton_GripRing_{label}",
                (
                    (sign * (GRIP_RING_Y - GRIP_RING_HALF_Y), GRIP_RING_R),
                    (sign * (GRIP_RING_Y + GRIP_RING_HALF_Y), GRIP_RING_R),
                ),
                hardware,
                segments=20,
            )
        )
        fittings.append(
            lathe(
                f"TKA_Baton_Collar_{label}",
                (
                    (sign * COLLAR_INNER_Y, COLLAR_INNER_R),
                    (sign * COLLAR_OUTER_Y, COLLAR_OUTER_R),
                ),
                hardware,
                segments=24,
            )
        )
        fittings.append(
            lathe(
                f"TKA_Baton_TubeRim_{label}",
                (
                    (sign * TUBE_RIM_INNER_Y, TUBE_RIM_R),
                    (sign * TUBE_RIM_OUTER_Y, TUBE_RIM_R),
                ),
                hardware,
                segments=24,
            )
        )
        fittings.append(
            lathe(
                f"TKA_Baton_CapRim_{label}",
                (
                    (
                        sign * CAP_RIM_INNER_Y,
                        cap_radius_at(105.6) + CAP_RIM_PROUD_M,
                    ),
                    (
                        sign * CAP_RIM_OUTER_Y,
                        cap_radius_at(108.8) + CAP_RIM_PROUD_M,
                    ),
                ),
                hardware,
                segments=32,
            )
        )
        lit.append(
            lathe(
                f"TKA_Baton_Tube_{label}",
                (
                    (sign * TUBE_INNER_Y, TUBE_R),
                    (sign * TUBE_OUTER_Y, TUBE_R),
                ),
                led,
                segments=26,
            )
        )
        lit.append(
            lathe(
                f"TKA_Baton_Cap_{label}",
                cap_sections(sign),
                led,
                segments=CAP_SEGMENTS,
                flutes=CAP_FLUTES,
                flute_depth=CAP_FLUTE_DEPTH,
            )
        )
        # The drawing shows a facing pair, which is a schematic's way of saying a
        # vented tube: a real one is drilled all the way round. Four at ninety
        # degrees means every view has one facing it, where a facing pair leaves
        # both edge-on from the profile and reads as a scratch.
        #
        # Each disc's axis is radial, so it sits flat on the tube wall. `lathe`
        # sweeps along +Y, and rotation_euler (X, Y, Z) applies X first: Rx(pi/2)
        # turns +Y into +Z, then Ry(pi/2 - angle) spins that into the tube's
        # radial direction at `angle`.
        for index in range(4):
            angle = index * math.pi / 2
            seat = TUBE_R - VENT_DISC_HALF + VENT_PROUD_M
            vents.append(
                lathe(
                    f"TKA_Baton_Vent_{label}_{index}",
                    ((-VENT_DISC_HALF, VENT_R), (VENT_DISC_HALF, VENT_R)),
                    vent_material,
                    segments=14,
                    rotation=(math.pi / 2, math.pi / 2 - angle, 0.0),
                    location=(
                        seat * math.cos(angle),
                        sign * VENT_Y,
                        seat * math.sin(angle),
                    ),
                )
            )

    hardware_group = join_objects("TKA_Baton_Fittings", [shaft, *fittings])
    crease_by_angle(hardware_group)
    crease_by_angle(grip)
    lit_group = join_objects("TKA_Baton_Lit", lit)
    crease_by_angle(lit_group)
    vent_group = join_objects("TKA_Baton_Vents", vents)
    crease_by_angle(vent_group)

    objects = [hardware_group, grip, lit_group, vent_group]
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

    # Blender exports its Z-up basis to glTF's Y-up basis. The baton is kept
    # upright along Blender Y for readable proof renders, then rotated into the
    # runtime basis only for export so the loaded prop stays long on local Y.
    root.rotation_euler.x = math.pi / 2
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_extras=True,
            # Nothing here is textured, but glb-measure.cjs requires UVs and a
            # mesh exported without them cannot be textured without a rebuild.
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


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    from mathutils import Vector

    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_proof_lighting() -> bpy.types.Object:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.009, 0.013, 0.025, 1.0)
    background.inputs["Strength"].default_value = 0.22

    # Dimmer than the sword rig by roughly a third. The baton is a pale silver
    # prop where the sword is dark steel, so the sword's key blew the grip and
    # the caps to the same white in the first proof pass and no material read.
    for name, location, energy, size, color in (
        ("QA_Key", (-0.70, 0.50, 1.00), 34, 0.80, (1.0, 0.94, 0.84)),
        ("QA_Fill", (0.90, -0.18, 0.65), 20, 0.70, (0.48, 0.66, 1.0)),
        ("QA_Rim", (-0.60, -0.38, -0.80), 24, 0.60, (1.0, 0.32, 0.16)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, (0.0, 0.0, 0.0))

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
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.05

    for label, (location, rotation) in {
        "front": ((0.0, 0.0, 1.65), (0.0, 0.0, 0.0)),
        "three-quarter": ((0.95, 0.0, 1.35), (0.0, math.radians(35), 0.0)),
        "profile": ((1.65, 0.0, 0.0), (0.0, math.radians(90), 0.0)),
    }.items():
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"capsule-baton-{label}.png")
        bpy.ops.render.render(write_still=True)

    # The lit end is a fifth of a 34" prop; a tight pass is the only way to judge
    # the cap flutes, the vent holes and the collar taper.
    camera.data.lens = 85
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 900
    for label, (location, rotation) in {
        "cap": ((0.0, 0.345, 0.52), (0.0, 0.0, 0.0)),
        "cap-profile": ((0.52, 0.345, 0.0), (0.0, math.radians(90), 0.0)),
        "grip": ((0.0, 0.0, 0.62), (0.0, 0.0, 0.0)),
    }.items():
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"capsule-baton-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(
    output_path: Path, model_objects: list[bpy.types.Object]
) -> None:
    meshes = [item for item in model_objects if item.type == "MESH"]
    print(f"BATON_OUTPUT={output_path}")
    print(f"BATON_BYTES={output_path.stat().st_size}")
    print(f"BATON_MESHES={len(meshes)}")
    print(f"BATON_VERTICES={sum(len(m.data.vertices) for m in meshes)}")
    print(f"BATON_POLYGONS={sum(len(m.data.polygons) for m in meshes)}")
    print(f"BATON_LENGTH_M={AUTHORED_LENGTH_M}")
    print(f"BATON_SHAFT_R={SHAFT_R:.7f}")
    print(f"BATON_TUBE_R={TUBE_R:.7f}")
    print(f"BATON_CAP_R={CAP_INNER_R:.7f}")
    print(f"BATON_TIP_Y={CAP_TIP_Y:.7f}")
    print(f"BATON_TRACKED_TIP_Y={TRACKED_TIP_Y:.7f}")
    print(f"BATON_CROSS_SCALE={CROSS_SCALE:.7f}")
    print("BATON_HAND_PIVOT=0,0,0")


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
