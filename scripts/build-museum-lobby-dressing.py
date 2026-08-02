"""Author the entrance lobby's static set dressing in Blender.

The tile grid remains responsible for walls, floors, collision, and room
streaming. This file owns the visual layer that makes the same room feel like
an Order-built internal archive: ceiling coffers and fixtures, brass trim,
reception and shop surrounds, age marks, and the quiet spiral inlay.

Run from the repository root:

  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background --factory-startup ^
    --python scripts/build-museum-lobby-dressing.py

Outputs:
  blender/museum_lobby_dressing.blend
  %TEMP%/tka-museum-lobby-evidence/museum_lobby_dressing_qa.png
"""

import math
import os
import tempfile

import bpy
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "museum_lobby_dressing.blend")
QA_DIR = os.path.join(tempfile.gettempdir(), "tka-museum-lobby-evidence")
QA_PATH = os.path.join(QA_DIR, "museum_lobby_dressing_qa.png")

ROOM_HALF_WIDTH = 6.0
ROOM_HALF_DEPTH = 9.0
CEILING_HEIGHT = 4.5

os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
os.makedirs(QA_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(
    name,
    color,
    roughness=0.72,
    metallic=0.0,
    emission=None,
    emission_strength=0.0,
):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission:
            emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            strength_input = bsdf.inputs.get("Emission Strength")
            if emission_input:
                emission_input.default_value = (*emission, 1.0)
            if strength_input:
                strength_input.default_value = emission_strength
    return mat


CEILING = material("Archive Ceiling", (0.44, 0.42, 0.36), roughness=0.93)
CEILING_REPLACEMENT = material("Replacement Ceiling Panel", (0.58, 0.56, 0.50), roughness=0.96)
GUNMETAL = material("Painted Gunmetal", (0.055, 0.065, 0.068), roughness=0.62, metallic=0.32)
BLACK_VOID = material("Open Ceiling Void", (0.008, 0.010, 0.010), roughness=1.0)
BRASS = material("Aged Archive Brass", (0.43, 0.265, 0.085), roughness=0.34, metallic=0.82)
BRASS_DULL = material("Worn Brass Inlay", (0.285, 0.185, 0.075), roughness=0.52, metallic=0.68)
WALNUT = material("Archive Walnut", (0.115, 0.052, 0.027), roughness=0.64)
TEAL = material("Institutional Teal", (0.045, 0.145, 0.15), roughness=0.78)
SHOP_SHUTTER = material("Shop Shutter", (0.075, 0.105, 0.11), roughness=0.66, metallic=0.36)
FLUORESCENT = material(
    "Aged Fluorescent Diffuser",
    (0.78, 0.73, 0.59),
    roughness=0.44,
    emission=(1.0, 0.88, 0.64),
    emission_strength=1.5,
)
WATER_STAIN = material("Old Water Stain", (0.18, 0.135, 0.085), roughness=1.0)
WATER_STAIN_FAINT = material("Faint Water Stain", (0.28, 0.245, 0.18), roughness=1.0)
QA_WALL = material("QA Wall", (0.68, 0.67, 0.62), roughness=0.88)
QA_FLOOR = material("QA Floor", (0.12, 0.115, 0.105), roughness=0.54)


def add_box(name, location, dimensions, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Edge Softening", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def add_polyline(name, points, mat, bevel_depth, cyclic=False):
    curve_data = bpy.data.curves.new(name=f"{name}Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = bevel_depth
    curve_data.bevel_resolution = 2
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.name = name
    return obj


def add_patch(name, points, height, mat):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    vertices = [(x, y, height) for x, y in points]
    mesh.from_pydata(vertices, [], [tuple(range(len(vertices)))])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_text(name, body, location, rotation, size, mat, extrude=0.012):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = extrude
    obj.data.bevel_depth = 0.002
    obj.data.materials.append(mat)
    bpy.ops.object.convert(target="MESH")
    obj.name = name
    return obj


def add_frame(prefix, center, width, height, depth, mat, bar=0.07, axis="north"):
    x, y, z = center
    if axis in ("north", "south"):
        add_box(f"{prefix}_Top", (x, y, z + height / 2), (width, depth, bar), mat)
        add_box(f"{prefix}_Bottom", (x, y, z - height / 2), (width, depth, bar), mat)
        add_box(f"{prefix}_Left", (x - width / 2, y, z), (bar, depth, height), mat)
        add_box(f"{prefix}_Right", (x + width / 2, y, z), (bar, depth, height), mat)
    else:
        add_box(f"{prefix}_Top", (x, y, z + height / 2), (depth, width, bar), mat)
        add_box(f"{prefix}_Bottom", (x, y, z - height / 2), (depth, width, bar), mat)
        add_box(f"{prefix}_Left", (x, y - width / 2, z), (depth, bar, height), mat)
        add_box(f"{prefix}_Right", (x, y + width / 2, z), (depth, bar, height), mat)


# Ceiling substrate and coffer grid. The runtime ceiling remains the structural
# fallback; this authored layer sits just below it and gives fixtures a home.
add_box(
    "Lobby_CeilingField",
    (0, 0, CEILING_HEIGHT - 0.16),
    (11.86, 17.86, 0.10),
    CEILING,
)
for x in [value * 1.5 for value in range(-4, 5)]:
    add_box(
        f"Lobby_CeilingGrid_X_{x:+.1f}",
        (x, 0, CEILING_HEIGHT - 0.24),
        (0.045, 17.82, 0.065),
        GUNMETAL,
    )
for y in [value * 1.5 for value in range(-6, 7)]:
    add_box(
        f"Lobby_CeilingGrid_Y_{y:+.1f}",
        (0, y, CEILING_HEIGHT - 0.24),
        (11.82, 0.045, 0.065),
        GUNMETAL,
    )


# The fixture centers mirror the geometry builder's institutional light grid.
# The emitted mesh provides the visible source while runtime lights illuminate.
for fixture_x in (-5.0, -2.0, 1.0, 4.0):
    for fixture_y in (-8.0, -4.0, 0.0, 4.0, 8.0):
        key = f"{fixture_x:+.0f}_{fixture_y:+.0f}".replace("+", "p").replace("-", "m")
        add_box(
            f"Lobby_FluorescentHousing_{key}",
            (fixture_x, fixture_y, CEILING_HEIGHT - 0.31),
            (1.15, 0.38, 0.11),
            GUNMETAL,
            bevel=0.025,
        )
        add_box(
            f"Lobby_FluorescentDiffuser_{key}",
            (fixture_x, fixture_y, CEILING_HEIGHT - 0.375),
            (0.96, 0.22, 0.025),
            FLUORESCENT,
            bevel=0.015,
        )


# A replaced panel, an open panel, and old water marks make the building's age
# legible without turning the maintained lobby into a ruin.
add_box(
    "Lobby_CeilingReplacementPanel",
    (-3.75, -5.25, CEILING_HEIGHT - 0.285),
    (1.42, 1.42, 0.025),
    CEILING_REPLACEMENT,
)
add_box(
    "Lobby_CeilingOpenPanel",
    (4.75, 4.5, CEILING_HEIGHT - 0.29),
    (1.38, 1.38, 0.028),
    BLACK_VOID,
)
add_patch(
    "Lobby_WaterStain_A",
    [(-5.6, 3.1), (-4.4, 2.7), (-3.5, 3.4), (-3.8, 4.4), (-5.1, 4.7)],
    CEILING_HEIGHT - 0.295,
    WATER_STAIN,
)
add_patch(
    "Lobby_WaterStain_B",
    [(-5.2, 2.8), (-4.3, 2.45), (-3.65, 3.1), (-4.0, 3.8), (-4.9, 4.1)],
    CEILING_HEIGHT - 0.302,
    WATER_STAIN_FAINT,
)
add_polyline(
    "Lobby_OpenPanelConduit",
    [
        (4.35, 4.25, 4.24),
        (4.45, 4.15, 3.95),
        (4.62, 4.25, 3.72),
        (4.82, 4.45, 3.86),
    ],
    GUNMETAL,
    bevel_depth=0.018,
)


# Lower-wall panels, brass chair rail, baseboards, and crown establish the
# 1980s archive vocabulary while preserving every opening in the tile plan.
for side_x in (-6.02, 6.02):
    add_box(f"Lobby_Wainscot_EW_{side_x:+.0f}", (side_x, 0, 0.43), (0.08, 17.70, 0.82), TEAL)
    add_box(f"Lobby_ChairRail_EW_{side_x:+.0f}", (side_x - math.copysign(0.045, side_x), 0, 0.88), (0.075, 17.75, 0.07), BRASS)
    add_box(f"Lobby_Baseboard_EW_{side_x:+.0f}", (side_x - math.copysign(0.05, side_x), 0, 0.11), (0.10, 17.78, 0.22), WALNUT)
    add_box(f"Lobby_Crown_EW_{side_x:+.0f}", (side_x - math.copysign(0.04, side_x), 0, 4.12), (0.09, 17.78, 0.18), BRASS_DULL)

for index, (center_x, length) in enumerate(((-3.85, 4.3), (3.85, 4.3))):
    add_box(f"Lobby_Wainscot_S_{index}", (center_x, -9.02, 0.43), (length, 0.08, 0.82), TEAL)
    add_box(f"Lobby_ChairRail_S_{index}", (center_x, -8.975, 0.88), (length, 0.075, 0.07), BRASS)
    add_box(f"Lobby_Baseboard_S_{index}", (center_x, -8.97, 0.11), (length, 0.10, 0.22), WALNUT)

add_box("Lobby_Wainscot_N_Left", (-2.0, 9.02, 0.43), (8.0, 0.08, 0.82), TEAL)
add_box("Lobby_ChairRail_N_Left", (-2.0, 8.975, 0.88), (8.0, 0.075, 0.07), BRASS)
add_box("Lobby_Baseboard_N_Left", (-2.0, 8.97, 0.11), (8.0, 0.10, 0.22), WALNUT)
add_box("Lobby_Crown_N", (0, 8.97, 4.12), (11.85, 0.09, 0.18), BRASS_DULL)
add_box("Lobby_Crown_S", (0, -8.97, 4.12), (11.85, 0.09, 0.18), BRASS_DULL)


# North wall: a dark reveal makes the first pictograph the visual destination;
# the adjacent archive portal receives a restrained brass threshold frame.
add_box("Lobby_OrientationReveal", (-0.25, 8.93, 2.15), (4.15, 0.09, 2.9), WALNUT)
add_frame(
    "Lobby_OrientationRevealFrame",
    (-0.25, 8.86, 2.15),
    width=4.32,
    height=3.05,
    depth=0.08,
    mat=BRASS,
    bar=0.075,
    axis="north",
)
add_frame(
    "Lobby_CaveThresholdFrame",
    (3.5, 8.87, 2.05),
    width=3.15,
    height=4.05,
    depth=0.10,
    mat=GUNMETAL,
    bar=0.14,
    axis="north",
)
add_box("Lobby_CaveThresholdCap", (3.5, 8.79, 3.98), (3.42, 0.18, 0.16), BRASS_DULL)


# East wall: permanent architectural framing stops reception and the shuttered
# shop from reading as loose furniture and floating plaques.
add_box("Lobby_ReceptionBack", (6.00, -2.25, 2.0), (0.10, 3.75, 2.72), WALNUT)
add_frame(
    "Lobby_ReceptionFrame",
    (5.93, -2.25, 2.0),
    width=3.90,
    height=2.92,
    depth=0.09,
    mat=BRASS,
    bar=0.075,
    axis="east",
)
add_box("Lobby_ReceptionCanopy", (5.72, -2.25, 3.36), (0.68, 4.0, 0.14), WALNUT, bevel=0.035)

add_box("Lobby_ShopShutter", (6.00, -7.0, 1.68), (0.10, 3.55, 2.75), SHOP_SHUTTER)
add_frame(
    "Lobby_ShopFrame",
    (5.91, -7.0, 1.68),
    width=3.75,
    height=2.95,
    depth=0.10,
    mat=BRASS,
    bar=0.09,
    axis="east",
)
for y in (-8.35, -7.9, -7.45, -7.0, -6.55, -6.1, -5.65):
    add_box(f"Lobby_ShopGrilleV_{y:+.2f}", (5.88, y, 1.68), (0.065, 0.045, 2.55), BRASS_DULL)
for z in (0.72, 1.35, 1.98, 2.61):
    add_box(f"Lobby_ShopGrilleH_{z:.2f}", (5.88, -7.0, z), (0.065, 3.32, 0.045), BRASS_DULL)
add_box("Lobby_ShopCanopy", (5.70, -7.0, 3.18), (0.72, 3.9, 0.16), WALNUT, bevel=0.035)


# The archive name sits over the entrance behind the initial player view. It is
# discovered by turning around, exactly where a real building would put it.
add_text(
    "Lobby_ArchiveName",
    "THE KINETIC ARCHIVE",
    (0, -8.88, 3.18),
    (-math.pi / 2, 0, 0),
    0.42,
    BRASS,
    extrude=0.014,
)


# The Scribe spiral is present from the first room but not announced. Most of it
# disappears beneath the kinetic sculpture rug; the outer turn rewards looking.
spiral_points = []
spiral_turns = 2.8
for index in range(150):
    fraction = index / 149
    angle = fraction * spiral_turns * math.tau
    radius = 0.10 + fraction * 2.15
    spiral_points.append(
        (
            -1.25 + math.cos(angle) * radius,
            0.75 + math.sin(angle) * radius,
            0.018,
        )
    )
add_polyline("Lobby_SpiralFloorInlay", spiral_points, BRASS_DULL, bevel_depth=0.018)


# The runtime hides ceilings in plan view. Keep ceiling elements in a separate
# export layer so the room dressing stays visible while the roof is suppressed.
ceiling_prefixes = (
    "Lobby_Ceiling",
    "Lobby_Fluorescent",
    "Lobby_OpenPanel",
    "Lobby_WaterStain",
)
for authored_object in list(bpy.context.scene.objects):
    if not authored_object.name.startswith("Lobby_"):
        continue
    export_prefix = (
        "LobbyCeiling_"
        if authored_object.name.startswith(ceiling_prefixes)
        else "LobbyDressing_"
    )
    authored_object.name = authored_object.name.replace("Lobby_", export_prefix, 1)


# QA-only room shell. The exporter selects the Lobby_ prefix, so these meshes
# never ship and cannot overlap the tile-driven runtime geometry.
add_box("QA_Floor", (0, 0, -0.08), (12.5, 18.5, 0.16), QA_FLOOR)
add_box("QA_WallWest", (-6.27, 0, 2.25), (0.22, 18.5, 4.5), QA_WALL)
add_box("QA_WallEast", (6.27, 0, 2.25), (0.22, 18.5, 4.5), QA_WALL)
add_box("QA_WallNorth", (0, 9.27, 2.25), (12.5, 0.22, 4.5), QA_WALL)
add_box("QA_WallSouth", (0, -9.27, 2.25), (12.5, 0.22, 4.5), QA_WALL)


def add_area_light(name, location, energy, size, color):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.shape = "RECTANGLE"
    light_data.size = size
    light_data.size_y = size * 0.4
    light_data.color = color
    obj = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (0, 0, 0)
    return obj


for light_x in (-3.5, 0.0, 3.5):
    for light_y in (-6.0, 0.0, 6.0):
        add_area_light(
            f"QA_Light_{light_x:+.1f}_{light_y:+.1f}",
            (light_x, light_y, 4.08),
            290,
            2.4,
            (1.0, 0.84, 0.62),
        )


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.camera_add(location=(0.0, -7.55, 1.65))
camera = bpy.context.active_object
camera.name = "QA_Camera"
camera.data.lens = 24
camera.data.sensor_width = 36
look_at(camera, (-0.4, 2.4, 1.75))
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = QA_PATH
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new("QA_World")
scene.world.color = (0.012, 0.014, 0.016)
scene.view_settings.look = "AgX - Medium High Contrast"

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
bpy.ops.render.render(write_still=True)

print(f"Saved editable lobby dressing: {BLEND_PATH}")
print(f"Rendered lobby dressing QA:    {QA_PATH}")
