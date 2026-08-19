"""Build the production fire double staff prop and multi-angle proof renders.

Geometry is driven by scripts/fire-double-staff-stations.json, which
scripts/build-fire-double-staff-svg.py emits from the same measurement table the
pictograph drawing is generated from. The two renderings therefore cannot drift
into different objects, which is what happened repeatedly on the capsule baton
while each one carried its own copy of the stations.

The one standing divergence is scale: the drawing exaggerates its cross-section
1.15x so a 16mm tube reads on a pictograph cell. The generator publishes the
unexaggerated millimetres alongside, and this script reads only those.

The wick is not a lathe. A monkey fist is three sets of three turns around three
mutually perpendicular axes, so it is built that way -- nine swept loops around a
small core -- and then stretched along the staff's axis to the 74 by 54 the
reference photographs measure. Lathing a lumpy ellipsoid and calling it a knot
was the shortcut available here, and it produces a bud, not a bundle of rope.

Colour follows the object. The TUBE carries the "Recolor" marker
prop-model-recolor.ts looks for, so it takes the hand colour at runtime;
anodized aluminium is the part these are actually sold in colours of. The wick
stays kevlar tan on both hands, because kevlar is never blue or red, and the
thumb bands stay gold so the reference end is readable at any hand colour.

The model is authored around the scene-3d hand pivot: long axis local Y, origin
at the drawing's viewBox centre, both ends live. It is bilaterally symmetric
apart from the thumb bands, so it needs no grip offset and no flipLongAxis.

Usage:
  blender --background --factory-startup --python scripts/build-fire-double-staff-model.py
  blender --background --factory-startup --python scripts/build-fire-double-staff-model.py -- \
    --output static/models/props/fire-double-staff.glb \
    --render-dir scratchpad/fire-review/r1 \
    --blend scratchpad/fire-review/fire-double-staff-production.blend
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "fire-double-staff.glb"

# The station table is NOT repeated here. Re-run the SVG generator first if the
# JSON is stale; it is the single source both renderings read.
STATIONS = json.loads(
    (ROOT / "scripts" / "fire-double-staff-stations.json").read_text("utf-8")
)

#: Every measurement below is read in REAL MILLIMETRES from the station table.
#: The drawing's unit stations carry a 1.15x cross exaggeration so a 16mm tube
#: reads on a pictograph cell, and its knot is stretched to match; undoing that
#: here would be two conversions that have to agree. The generator publishes the
#: unexaggerated millimetres alongside, so 3D reads those and the question never
#: comes up.
MM = 0.001

AUTHORED_LENGTH_M = STATIONS["length_mm"] * MM
HALF_LENGTH = STATIONS["half_length_mm"] * MM

TUBE_R = STATIONS["tube_od_mm"] / 2 * MM
GRIP_R = STATIONS["grip_od_mm"] / 2 * MM
KNOT_R = STATIONS["knot_od_mm"] / 2 * MM

GRIP_HALF_Y = STATIONS["grip_half_mm"] * MM
KNOT_LENGTH = STATIONS["knot_length_mm"] * MM
KNOT_MOUTH_Y = HALF_LENGTH - KNOT_LENGTH
#: The tube does not stop at the wick's mouth -- it runs on inside it, which is
#: what the wick is bolted to.
TUBE_HALF_Y = KNOT_MOUTH_Y + KNOT_LENGTH * 0.35

#: A bright ferrule where the tube enters the wick. Real staffs have a collar or
#: a bolt head here, and without it the rope appears to grow out of the tube.
FERRULE_OUTER_Y = KNOT_MOUTH_Y
FERRULE_INNER_Y = KNOT_MOUTH_Y - STATIONS["collar_mm"] * MM
FERRULE_R = TUBE_R * 1.14

#: Two bands of marker tape at the outer end of the grip. The gold pair is TKA's
#: reference-end marker -- simple_staff and staff_v2 carry the same one -- and it
#: is also what performers do to find the thumb end by feel. One end only: that
#: is the entire point of it.
BAND_R = GRIP_R * 1.10
BAND_WIDTH = 11.0 * MM
BAND_CENTRES = (GRIP_HALF_Y - 57.0 * MM, GRIP_HALF_Y - 31.0 * MM)

# --- The wick ---------------------------------------------------------------
#: 54mm across by 74mm long in the reference photographs. It is built round, so
#: the rope bends in circles the way rope does, and then stretched along the
#: staff's axis to that 1.37. Building it stretched would give elliptical loops.
KNOT_CENTRE_Y = STATIONS["tracked_tip_mm"] * MM
KNOT_STRETCH = KNOT_LENGTH / (KNOT_R * 2)

#: Three turns per axis, three axes. That is the knot, not an impression of one.
#: The rope is about a fifth of the knot across, which is where a 1.5in kevlar
#: strip rolled into a working wick lands.
KNOT_TURNS = 4
ROPE_R = KNOT_R * 0.155
#: Every turn dives under the sets it crosses and rides over them in between,
#: which is the whole difference between a knot and three nested cages. Stacking
#: the sets at three fixed radii instead just hides the inner two behind the
#: outer one, and the result reads as a lantern.
WEAVE_AMPLITUDE = ROPE_R * 0.55
#: Each turn crosses the other two sets four times on its way round.
WEAVE_FREQUENCY = 4
LOOP_MAJOR_R = KNOT_R - ROPE_R - WEAVE_AMPLITUDE
#: Adjacent turns leave a shallow valley between them. Touching turns merge into
#: one fat band, which is what makes a rendered knot read as sausages instead of
#: rope; too much gap and the wick reads as a cage.
LOOP_PITCH = ROPE_R * 2.28
#: Rope is round and soft. Coarse rings read as a folded paper lantern at any
#: distance close enough to see the wick at all.
LOOP_MAJOR_SEGMENTS = 44
LOOP_MINOR_SEGMENTS = 12

#: A small core inside the loops so the wick is never see-through where three
#: sets of rope happen to leave a gap. It sits well under them, so it only ever
#: shows as shadow.
CORE_R = LOOP_MAJOR_R - WEAVE_AMPLITUDE - ROPE_R * 0.15

#: The flame sits ON the wick, so every emitter that reads a tip fires from the
#: knot's centre rather than off the far rim. Written into the GLB's root extras
#: so the verifier and the runtime hold one number.
TRACKED_TIP_Y = KNOT_CENTRE_Y


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
    """Smooth along a surface but keep its hard edges hard."""
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

    Nothing here is textured, but scripts/lib/glb-measure.cjs requires UVs on
    every primitive and it is right to: a mesh that ships without them cannot be
    textured later without a rebuild.
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


def build_mesh(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    material: bpy.types.Material,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
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
    segments: int = 26,
    helix_ridges: int = 0,
    helix_depth: float = 0.0,
    helix_pitch: float = 1.0,
) -> bpy.types.Object:
    """A closed tube of circular rings swept along local Y.

    Each section is (y, radius). `helix_ridges` adds a ripple whose phase
    advances with y, which is what makes the grip read as tape spiralling up the
    tube rather than as a stack of separate rings. `helix_pitch` is the axial
    distance one wrap covers.
    """
    if len(sections) < 2:
        raise ValueError(f"Lathe {name} needs at least two sections")

    vertices: list[tuple[float, float, float]] = []
    for y, radius in sections:
        phase = math.tau * y / helix_pitch if helix_ridges else 0.0
        for column in range(segments):
            angle = math.tau * column / segments
            ripple = (
                1.0
                + helix_depth * math.sin(helix_ridges * angle + phase)
                if helix_ridges
                else 1.0
            )
            scaled = radius * ripple
            vertices.append((scaled * math.cos(angle), y, scaled * math.sin(angle)))

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
    return build_mesh(name, vertices, faces, material)


def loop(
    name: str,
    material: bpy.types.Material,
    *,
    centre: tuple[float, float, float],
    normal: str,
    major_r: float,
    minor_r: float,
    weave_phase: float = 0.0,
) -> bpy.types.Object:
    """One turn of rope: a torus whose plane is perpendicular to `normal`.

    Its major radius breathes as it goes round, so the turn passes under the
    sets it crosses and back over them in between.
    """
    vertices: list[tuple[float, float, float]] = []
    for i in range(LOOP_MAJOR_SEGMENTS):
        a = math.tau * i / LOOP_MAJOR_SEGMENTS
        ca, sa = math.cos(a), math.sin(a)
        woven = major_r + WEAVE_AMPLITUDE * math.cos(
            WEAVE_FREQUENCY * a + weave_phase
        )
        for j in range(LOOP_MINOR_SEGMENTS):
            b = math.tau * j / LOOP_MINOR_SEGMENTS
            r = woven + minor_r * math.cos(b)
            h = minor_r * math.sin(b)
            if normal == "y":
                p = (r * ca, h, r * sa)
            elif normal == "x":
                p = (h, r * ca, r * sa)
            else:
                p = (r * ca, r * sa, h)
            vertices.append(
                (p[0] + centre[0], p[1] + centre[1], p[2] + centre[2])
            )

    faces: list[tuple[int, ...]] = []
    for i in range(LOOP_MAJOR_SEGMENTS):
        ni = (i + 1) % LOOP_MAJOR_SEGMENTS
        for j in range(LOOP_MINOR_SEGMENTS):
            nj = (j + 1) % LOOP_MINOR_SEGMENTS
            faces.append(
                (
                    i * LOOP_MINOR_SEGMENTS + j,
                    ni * LOOP_MINOR_SEGMENTS + j,
                    ni * LOOP_MINOR_SEGMENTS + nj,
                    i * LOOP_MINOR_SEGMENTS + nj,
                )
            )
    return build_mesh(name, vertices, faces, material)


def uv_sphere(
    name: str, material: bpy.types.Material, *, centre: tuple[float, float, float], r: float
) -> bpy.types.Object:
    rings, segments = 10, 16
    vertices: list[tuple[float, float, float]] = []
    for i in range(rings + 1):
        phi = math.pi * i / rings
        for j in range(segments):
            theta = math.tau * j / segments
            vertices.append(
                (
                    centre[0] + r * math.sin(phi) * math.cos(theta),
                    centre[1] + r * math.cos(phi),
                    centre[2] + r * math.sin(phi) * math.sin(theta),
                )
            )
    faces: list[tuple[int, ...]] = []
    for i in range(rings):
        for j in range(segments):
            nj = (j + 1) % segments
            faces.append(
                (
                    i * segments + j,
                    i * segments + nj,
                    (i + 1) * segments + nj,
                    (i + 1) * segments + j,
                )
            )
    return build_mesh(name, vertices, faces, material)


def join_objects(name: str, objects: list[bpy.types.Object]) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for item in objects:
        item.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


def wick(label: str, sign: float, material: bpy.types.Material) -> bpy.types.Object:
    """One monkey fist: three turns around each of three perpendicular axes.

    Built at the origin, stretched along the staff's axis THERE, and only then
    moved out to its end. Stretching it in place at the end would have scaled
    its distance from the pivot too, which throws the knot clean off the staff.
    """
    parts = [
        uv_sphere(
            f"TKA_FireStaff_WickCore_{label}",
            material,
            centre=(0.0, 0.0, 0.0),
            r=CORE_R,
        )
    ]
    spread = [(k - (KNOT_TURNS - 1) / 2) * LOOP_PITCH for k in range(KNOT_TURNS)]
    for normal, axis, phase in (
        ("y", 1, 0.0),
        ("x", 0, math.pi),
        ("z", 2, math.pi / 2),
    ):
        for index, offset in enumerate(spread):
            centre = [0.0, 0.0, 0.0]
            centre[axis] += offset
            parts.append(
                loop(
                    f"TKA_FireStaff_Wick{normal.upper()}{index}_{label}",
                    material,
                    centre=(centre[0], centre[1], centre[2]),
                    normal=normal,
                    # turns near the poles of the ball sit on a smaller
                    # circle, which is what rounds the wick off instead of
                    # leaving it a boxy bundle
                    major_r=LOOP_MAJOR_R
                    * math.sqrt(max(0.12, 1.0 - (offset / KNOT_R) ** 2)),
                    minor_r=ROPE_R,
                    weave_phase=phase,
                )
            )
    knot = join_objects(f"TKA_FireStaff_Wick_{label}", parts)
    # Stretch to the MEASURED extent, not by a nominal ratio. Woven rope does
    # not fill its bounding sphere -- the turns near the poles sit on smaller
    # circles -- so a knot built to a 54mm radius measures under 54mm across,
    # and stretching it by 74/54 leaves the staff several millimetres short of
    # the length its spec sheet publishes.
    built = max(vertex.co.y for vertex in knot.data.vertices) - min(
        vertex.co.y for vertex in knot.data.vertices
    )
    knot.scale = (1.0, KNOT_LENGTH / built, 1.0)
    knot.location = (0.0, sign * KNOT_CENTRE_Y, 0.0)
    activate(knot)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    return knot


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    # Every colour below is its fire_double_staff.svg fill converted sRGB to
    # linear, so the model and the drawing stay the same prop. The TUBE is what
    # carries blue/red -- anodized aluminium is the part these are sold in
    # colours of -- and the wick stays kevlar on both hands. Neutral by design,
    # because prop-model-recolor.ts REPLACES this colour; the name carries the
    # "Recolor" marker that selects it.
    tube_material = make_material(
        "TKA_FireStaff_Tube_Recolor",
        (0.4508, 0.4508, 0.4508, 1.0),
        roughness=0.30,
        metallic=0.55,
        coat=0.18,
    )
    # #C9AC68 kevlar. Rough and unlacquered: rope, not plastic.
    wick_material = make_material(
        "TKA_FireStaff_Wick",
        (0.5776, 0.4072, 0.1444, 1.0),
        roughness=0.86,
        metallic=0.0,
        coat=0.0,
    )
    # #C9AC68 again, but polished: marker tape reads as a band because it is
    # shinier than everything around it, not because it is a different hue.
    band_material = make_material(
        "TKA_FireStaff_ThumbBand",
        (0.5776, 0.4072, 0.1444, 1.0),
        roughness=0.22,
        metallic=0.30,
        coat=0.45,
    )

    root = bpy.data.objects.new("TKA_FireDoubleStaff", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "fire_double_staff"
    root["authored_length_m"] = AUTHORED_LENGTH_M
    root["grip_origin"] = "0,0,0"
    root["local_long_axis"] = "+Y"
    root["recolor_material"] = "TKA_FireStaff_Tube_Recolor"
    root["preserved_material"] = "TKA_FireStaff_Wick"
    root["tracked_tip_y"] = TRACKED_TIP_Y
    root["reference_form"] = "kevlar fire double staff, coloured tube, monkey-fist wicks"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    metal: list[bpy.types.Object] = [
        lathe(
            "TKA_FireStaff_Tube",
            ((-TUBE_HALF_Y, TUBE_R), (TUBE_HALF_Y, TUBE_R)),
            tube_material,
            segments=20,
        ),
        lathe(
            "TKA_FireStaff_Grip",
            tuple(
                (-GRIP_HALF_Y + (2 * GRIP_HALF_Y) * i / 96, GRIP_R)
                for i in range(97)
            ),
            tube_material,
            segments=24,
            helix_ridges=1,
            helix_depth=0.075,
            helix_pitch=13.0 * MM,
        ),
    ]
    for label, sign in (("Left", -1.0), ("Right", 1.0)):
        metal.append(
            lathe(
                f"TKA_FireStaff_Ferrule_{label}",
                (
                    (sign * FERRULE_INNER_Y, FERRULE_R),
                    (sign * FERRULE_OUTER_Y, FERRULE_R),
                ),
                tube_material,
                segments=20,
            )
        )

    bands = [
        lathe(
            f"TKA_FireStaff_ThumbBand{index}",
            ((centre - BAND_WIDTH / 2, BAND_R), (centre + BAND_WIDTH / 2, BAND_R)),
            band_material,
            segments=20,
        )
        for index, centre in enumerate(BAND_CENTRES)
    ]

    wicks = [
        wick(label, sign, wick_material)
        for label, sign in (("Left", -1.0), ("Right", 1.0))
    ]

    metal_group = join_objects("TKA_FireStaff_Metal", [*metal, *bands])
    crease_by_angle(metal_group)
    wick_group = join_objects("TKA_FireStaff_Wicks", wicks)
    crease_by_angle(wick_group, degrees=75.0)

    objects = [metal_group, wick_group]
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

    # Blender exports its Z-up basis to glTF's Y-up basis. The staff is kept
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

    for name, location, energy, size, color in (
        ("QA_Key", (-0.70, 0.50, 1.00), 46, 0.80, (1.0, 0.94, 0.84)),
        ("QA_Fill", (0.90, -0.18, 0.65), 26, 0.70, (0.48, 0.66, 1.0)),
        ("QA_Rim", (-0.60, -0.38, -0.80), 30, 0.60, (1.0, 0.32, 0.16)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, (0.0, 0.0, 0.0))

    bpy.ops.object.camera_add(location=(0.0, 0.0, 1.70))
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
    scene.view_settings.exposure = -0.85

    for label, (location, rotation) in {
        "front": ((0.0, 0.0, 1.70), (0.0, 0.0, 0.0)),
        "three-quarter": ((0.98, 0.0, 1.38), (0.0, math.radians(35), 0.0)),
        "profile": ((1.70, 0.0, 0.0), (0.0, math.radians(90), 0.0)),
    }.items():
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"fire-double-staff-{label}.png")
        bpy.ops.render.render(write_still=True)

    # The wick is a twelfth of the prop; a tight pass is the only way to judge
    # whether the rope weaves or just looks lumpy.
    camera.data.lens = 85
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 900
    for label, (location, rotation) in {
        "wick": ((0.0, KNOT_CENTRE_Y, 0.30), (0.0, 0.0, 0.0)),
        "wick-profile": ((0.30, KNOT_CENTRE_Y, 0.0), (0.0, math.radians(90), 0.0)),
        "grip": ((0.0, GRIP_HALF_Y * 0.75, 0.30), (0.0, 0.0, 0.0)),
    }.items():
        camera.location = location
        camera.rotation_euler = rotation
        scene.render.filepath = str(render_dir / f"fire-double-staff-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, model_objects: list[bpy.types.Object]) -> None:
    meshes = [item for item in model_objects if item.type == "MESH"]
    print(f"FIRESTAFF_OUTPUT={output_path}")
    print(f"FIRESTAFF_BYTES={output_path.stat().st_size}")
    print(f"FIRESTAFF_MESHES={len(meshes)}")
    print(f"FIRESTAFF_VERTICES={sum(len(m.data.vertices) for m in meshes)}")
    print(f"FIRESTAFF_POLYGONS={sum(len(m.data.polygons) for m in meshes)}")
    print(f"FIRESTAFF_LENGTH_M={AUTHORED_LENGTH_M}")
    print(f"FIRESTAFF_TUBE_R={TUBE_R:.7f}")
    print(f"FIRESTAFF_GRIP_R={GRIP_R:.7f}")
    print(f"FIRESTAFF_KNOT_R={KNOT_R:.7f}")
    print(f"FIRESTAFF_KNOT_NOMINAL_STRETCH={KNOT_STRETCH:.7f}")
    print(f"FIRESTAFF_ROPE_R={ROPE_R:.7f}")
    print(f"FIRESTAFF_TRACKED_TIP_Y={TRACKED_TIP_Y:.7f}")
    print("FIRESTAFF_HAND_PIVOT=0,0,0")


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
