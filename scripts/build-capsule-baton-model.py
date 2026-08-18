"""Build the production LED capsule baton prop and multi-angle proof renders.

Geometry is driven by static/images/props/pictograph/capsule_baton.svg, which is
the authority for the prop's shape: a braided cable running bare from end to
end, a coupler where the cable enters each clear polycarbonate tube, and a
frosted silicone cap over each tube's tip with the light capsule inside.

The two renderings share one station table, listed in the drawing's header and
repeated in the constants below. Where the drawing and the physical prop
disagree, the prop wins and the divergence is commented at the constant. The
only standing divergence is scale: the drawing exaggerates its cross-section
about 2.7x so a 12mm cable reads on a pictograph cell, and CROSS_SCALE divides
that back out here.

There is no grip. The drawing carried a 60-unit silicone grip across the pivot
for several revisions and the model followed it; the object has bare cable
there, so both dropped it.

Colour follows the object rather than the drawing: the SHAFT carries the
"Recolor" marker prop-model-recolor.ts looks for, so it takes the hand colour at
runtime, and the tube and cap stay clear on both hands. flowtoys sells the shaft
in colours under clear ends, and a lit end reads as its LED anyway -- tinting it
would fight the effect instead of telling the hands apart.

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

# --- The physical prop, measured -----------------------------------------
# flowtoys composite iso baton / lumina twirl baton, which is the object this
# prop is. Published numbers, not estimates:
#   shaft     12mm OD carbon fibre, bare braided cable, no grip section
#   end tube  1" OD (25.4mm) polycarbonate, 13.5cm long, one per end
#   capsule   88mm x 21mm light, sitting INSIDE the tube
#   flowcap   silicone, ~30mm across, blunt thimble, soft ribs, NO holes
#   overall   80cm with a 59cm shaft (90cm and 100cm options also exist)
TUBE_OD_M = 0.0254
TUBE_LENGTH_M = 0.135

#: The drawing states its own cross-section is about 2x the real object, because
#: a 25mm tube on a 660mm prop would otherwise be a hairline. 3D has no such
#: problem, so perpendicular measurements come back down by one factor and the
#: silhouette the drawing asserts -- thin middle, fat ends -- survives intact.
#:
#: The anchor is the END TUBE at its published 1" OD. An earlier build anchored
#: on the 3D staff's radius instead, assuming a baton shaft and a staff share a
#: cross-section. They do not: a staff tube is 25mm and a baton shaft is 12mm, so
#: that build came out almost exactly twice as thick as the real object at every
#: station -- a 25mm shaft and 50mm tubes. Anchoring on the tube puts the shaft
#: at 12.7mm and the cap at 30.2mm, both within a millimetre of the real prop.
CROSS_SCALE = (TUBE_OD_M / 2) / (10.0 * SVG_TO_M)


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

# Tapered coupler where the shaft enters the tube, drawn as
# <path d="M203 14.5 L214 11.5 L214 28.5 L203 25.5 Z">. On the real prop this is
# the short conical swell just inboard of each tube, so it climbs from the
# shaft's radius to the tube's and then disappears under it.
COLLAR_INNER_Y = axial(72.0)
COLLAR_OUTER_Y = axial(82.0)
COLLAR_INNER_R = radial(5.2)
COLLAR_OUTER_R = radial(9.6)

# Clear tube: <rect x="212" width="40.8" y="10" height="20" rx="4.5">, but its
# LENGTH comes from the real prop rather than from the drawing's edge.
TUBE_R = radial(10.0)
#: The tube is the long part of each end -- 13.5cm of clear polycarbonate with
#: the capsule inside it -- and the cap is a short blunt lid over its tip. An
#: earlier build had that ratio backwards, an 8.3cm tube under a 7.1cm cone, so
#: each end read as a bulb on a stick instead of as a lit tube.
#:
#: Run the tube a little way in under the cap so the two lathes never share a
#: surface, which reads as z-fighting on a prop this small on screen.
TUBE_OUTER_Y = axial(120.0)
TUBE_INNER_Y = TUBE_OUTER_Y - TUBE_LENGTH_M

# Open rim of the tube, at its inner end:
# <path d="M212.6 11.2 L215.4 11.2 L215.4 28.8 L212.6 28.8">
TUBE_RIM_INNER_Y = TUBE_INNER_Y
TUBE_RIM_OUTER_Y = TUBE_INNER_Y + axial(2.8)
TUBE_RIM_R = radial(10.35)

# No vents. The drawing rules a facing pair of holes near each tube's rim and an
# earlier build drilled four of them, but the real tube is sealed polycarbonate
# around a rechargeable light: holes in it would be a defect, and none of the
# reference photographs show any. Venting belongs to fire props.

# Frosted silicone flowcap. Two shapes were wrong before this one. The drawing's
#   <path d="M232 8.3 L244.5 10.1 C250.7 11.6 252.8 15.4 252.8 20 ...">
# read as a cone tapering to a near-point, which is a fire-torch. Correcting that
# over-corrected into a stubby lid barely wider than the tube it sat on, and a
# cap that does not step out from its tube is the one thing every photograph of
# this prop shows that it does.
#
# The real flowcap is a 1.5" silicone thimble pushed onto a 1" tube: it flares
# off the lip, runs out to a good 12mm wider than the tube, and only then domes
# over. That step is the whole silhouette of the lit end.
#
# Half-heights off the drawing's y=20 centreline, at pivot offsets, lip outward.
CAP_PROFILE = (
    (113.0, 11.6),
    (115.2, 13.3),
    (119.0, 14.5),
    (122.8, 15.0),
    (124.6, 15.0),
)
CAP_INNER_Y = axial(CAP_PROFILE[0][0])
CAP_TIP_Y = axial(126.4)
#: Widest point on the prop: the cap's shoulder, 38mm across.
CAP_MAX_R = max(radial(half_units) for _, half_units in CAP_PROFILE)
#: Cubic control points closing the dome, as (pivot offset, half-height).
CAP_CURVE = (
    (124.6, 15.0),
    (126.0, 14.7),
    (126.4, 9.2),
    (126.4, 0.0),
)
#: Eight soft ribs, running the body and over the dome, where they scallop the
#: cap's top edge the way the reference caps' petals do. On the real cap these
#: are shallow creases in frosted silicone, but "shallow" still has to survive a
#: smoothed normal: at 0.05 and again at 0.075 they vanished completely and the
#: cap rendered as a blank pill. The reference caps scallop their own silhouette,
#: so the ripple has to be deep enough to do that too.
CAP_FLUTES = 8
CAP_FLUTE_DEPTH = 0.12
#: Four columns per rib. 48 spread each rib over six columns so gently that
#: auto-smooth averaged it away; four keeps a real shading break at every valley
#: while staying round enough to read as moulded silicone.
CAP_SEGMENTS = 32

# No proud rim band around the cap. It existed to hide a z-fight between a
# constant-radius band and the old cap cone; the real cap is one piece of
# silicone whose lip flare is now part of CAP_PROFILE.

#: The tracked emitters sit at the centre of each cap, where the capsule's LED
#: fires into the frosted silicone and where the reference photographs show the
#: glow concentrated. Reported into the GLB's root extras so
#: verify-capsule-baton-glb.cjs and prop-tip-geometry-3d.ts hold one number.
#: The 2D drawing keeps its own +/-117 -- correct for its own, longer cap.
TRACKED_TIP_Y = axial(120.0)


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


def cap_sections(sign: float) -> tuple[tuple[float, float], ...]:
    """Cap profile, open lip to domed tip, on whichever end `sign` names."""
    stops: list[tuple[float, float]] = [
        (sign * axial(offset_units), radial(half_units))
        for offset_units, half_units in CAP_PROFILE
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
    # The SHAFT is what carries blue/red, and the ends stay clear. That is how
    # the object is actually sold -- flowtoys offers the shaft in several colours
    # under a clear tube and a clear cap -- and it is also the only split that
    # survives the light being on: a lit end reads as its LED, not as its
    # plastic, so colouring the cap fights the effect instead of identifying the
    # hand. Neutral by design, because prop-model-recolor.ts REPLACES this
    # colour; the name carries the "Recolor" marker that selects it.
    shaft_material = make_material(
        "TKA_Baton_Shaft_Recolor",
        (0.5210, 0.5210, 0.5210, 1.0),
        roughness=0.34,
        metallic=0.0,
        coat=0.22,
    )
    # Clear polycarbonate, so it is glossy and nearly white and the capsule
    # inside it is what the eye is meant to find.
    tube_material = make_material(  # #DCE6F0
        "TKA_Baton_Tube",
        (0.7157, 0.7913, 0.8714, 1.0),
        roughness=0.10,
        metallic=0.0,
        coat=0.60,
    )
    # Frosted silicone over that tube: the same near-white, diffused rather than
    # polished, which is what makes the cap read as the thing that glows.
    cap_material = make_material(  # #EDF2F7
        "TKA_Baton_Cap",
        (0.8469, 0.8879, 0.9301, 1.0),
        roughness=0.55,
        metallic=0.0,
        coat=0.15,
    )

    root = bpy.data.objects.new("TKA_CapsuleBaton", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "capsule_baton"
    root["authored_length_m"] = AUTHORED_LENGTH_M
    root["grip_origin"] = "0,0,0"
    root["local_long_axis"] = "+Y"
    root["recolor_material"] = "TKA_Baton_Shaft_Recolor"
    root["preserved_material"] = "TKA_Baton_Tube"
    root["tracked_tip_y"] = TRACKED_TIP_Y
    root["reference_form"] = "LED capsule baton, coloured shaft, clear lit ends"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    shaft = lathe(
        "TKA_Baton_Shaft",
        ((-SHAFT_HALF_Y, SHAFT_R), (SHAFT_HALF_Y, SHAFT_R)),
        shaft_material,
        segments=24,
    )

    fittings: list[bpy.types.Object] = []
    lit: list[bpy.types.Object] = []

    for label, sign in (("Left", -1.0), ("Right", 1.0)):
        fittings.append(
            lathe(
                f"TKA_Baton_Collar_{label}",
                (
                    (sign * COLLAR_INNER_Y, COLLAR_INNER_R),
                    (sign * COLLAR_OUTER_Y, COLLAR_OUTER_R),
                ),
                shaft_material,
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
                shaft_material,
                segments=24,
            )
        )
        lit.append(
            lathe(
                f"TKA_Baton_Tube_{label}",
                (
                    (sign * TUBE_INNER_Y, TUBE_R),
                    (sign * TUBE_OUTER_Y, TUBE_R),
                ),
                tube_material,
                segments=26,
            )
        )
        lit.append(
            lathe(
                f"TKA_Baton_Cap_{label}",
                cap_sections(sign),
                cap_material,
                segments=CAP_SEGMENTS,
                flutes=CAP_FLUTES,
                flute_depth=CAP_FLUTE_DEPTH,
            )
        )
    shaft_group = join_objects("TKA_Baton_Fittings", [shaft, *fittings])
    crease_by_angle(shaft_group)
    lit_group = join_objects("TKA_Baton_Lit", lit)
    crease_by_angle(lit_group)
    objects = [shaft_group, lit_group]
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
    # prop where the sword is dark steel, so the sword's key blew the cable and
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
    # the cap ribs and the coupler taper.
    camera.data.lens = 85
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 900
    for label, (location, rotation) in {
        "cap": ((0.0, 0.345, 0.52), (0.0, 0.0, 0.0)),
        "cap-profile": ((0.52, 0.345, 0.0), (0.0, math.radians(90), 0.0)),
        "pivot": ((0.0, 0.0, 0.62), (0.0, 0.0, 0.0)),
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
    print(f"BATON_CAP_R={CAP_MAX_R:.7f}")
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
