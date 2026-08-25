"""Author the approved Blossom R2.1 site in Blender.

This is the editable source-of-truth pass for the Blossom environment. Static
set dressing is authored here, saved as a .blend, and rendered for visual QA.
The clean runtime GLB is exported in a separate pass by
``blender-export-blossom-full.py``.

Run headless from the repository root:

  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background --factory-startup ^
    --python scripts/build-blossom-environment.py

Outputs:
  blender/blossom_environment.blend
  %TEMP%/tka-blossom-evidence/blossom_environment_qa.png
"""

import json
import math
import os
import random
import struct
import sys
import tempfile
import zlib

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ground_life_geometry import append_meadow_blade, append_meadow_seed_head

OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "blossom")
SOURCE_ASSET_DIR = os.path.join(OUTPUT_DIR, "assets")
PLANTFACTORY_CANDIDATE_DIR = os.path.join(
    OUTPUT_DIR, "candidates", "plantfactory-family-r1"
)
POLYHAVEN_ROCK_DIR = os.path.join(PROJECT_ROOT, "blender", "polyhaven_rocks")
VERTEX_TINT_LAYER = "Color"
MASTERPLAN_PATH = os.path.join(
    PROJECT_ROOT,
    "docs",
    "superpowers",
    "specs",
    "blossom-masterplan-r2",
    "blossom-masterplan-r2.json",
)
GROUND_MASK_PATH = os.path.join(
    PROJECT_ROOT,
    "static",
    "textures",
    "blossom-floor",
    "blossom-ground-family-mask.png",
)
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "blossom_environment.blend")
QA_DIR = os.path.join(tempfile.gettempdir(), "tka-blossom-evidence")
QA_PATH = os.path.join(QA_DIR, "blossom_environment_qa.png")
with open(MASTERPLAN_PATH, "r", encoding="utf-8") as plan_file:
    MASTERPLAN = json.load(plan_file)

# "rejected-visual-review" is the state R2.1 entered on 2026-08-23 when Austen
# rejected the built result. Authoring stays open in that state so the
# composition can be worked on, but nothing here may present the result as
# approved: verify-blossom-composition.mjs still refuses to certify a rejected
# plan, and that refusal is the gate that matters.
BLOSSOM_AUTHORING_STATES = ("approved-for-production", "rejected-visual-review")
if MASTERPLAN.get("status") not in BLOSSOM_AUTHORING_STATES:
    raise RuntimeError(
        f"Blossom R2.1 is at an unrecognized gate: {MASTERPLAN.get('status')!r}"
    )
if not MASTERPLAN.get("approvalGate", {}).get("productionChangesAllowed"):
    print(
        "NOTE: Blossom R2.1 has not passed visual review. Authoring a revision;\n"
        "      this build is not a certified composition."
    )

STAGE_DECK_TOP = MASTERPLAN["stage"]["deckTop"]


def resolve_lantern_position(lantern):
    attachment = lantern["attachment"]
    path = next(
        item
        for item in MASTERPLAN["circulation"]["paths"]
        if item["id"] == attachment["pathId"]
    )
    first = path["centerline"][attachment["segmentIndex"]]
    second = path["centerline"][attachment["segmentIndex"] + 1]
    amount = attachment["progress"]
    x = first[0] + (second[0] - first[0]) * amount
    y = first[1] + (second[1] - first[1]) * amount
    tangent_x = second[0] - first[0]
    tangent_y = second[1] - first[1]
    length = math.hypot(tangent_x, tangent_y) or 1.0
    side = 1.0 if attachment["side"] == "left" else -1.0
    offset = path["width"] * 0.5 + attachment["pathEdgeClearance"]
    return [
        x - tangent_y / length * offset * side,
        y + tangent_x / length * offset * side,
        first[2] + (second[2] - first[2]) * amount,
    ]


PUBLIC_PATHS = [
    path
    for path in MASTERPLAN["circulation"]["paths"]
    if path["kind"] == "primary-accessible"
]
SERVICE_PATHS = [
    path
    for path in MASTERPLAN["circulation"]["paths"]
    if path["kind"] == "restricted-service"
]

# The Blender authoring functions below consume narrow contracts instead of
# reaching into several retired R1 plans. These adapters contain no authored
# coordinates: every value is derived from the approved R2.1 masterplan.
COMPOSITION_PLAN = {
    "planId": MASTERPLAN["planId"],
    "water": {
        "width": MASTERPLAN["water"]["surfaceWidth"],
        "centerline": MASTERPLAN["water"]["centerline"],
        "localWidenings": MASTERPLAN["water"]["localWidenings"],
        "surfaceElevation": MASTERPLAN["water"]["surfaceElevation"],
        "bedDepth": MASTERPLAN["water"]["bedDepth"],
        "bankTransitionWidth": MASTERPLAN["water"]["bankTransitionWidth"],
        "bankTerraceWidth": MASTERPLAN["water"]["bankTerraceWidth"],
        "runOut": MASTERPLAN["water"]["runOut"],
    },
    "bridge": MASTERPLAN["bridge"],
    "torii": MASTERPLAN["torii"],
    "trees": [],
    "ecologyIslands": [],
    "lanterns": [
        {
            **lantern,
            "position": resolve_lantern_position(lantern),
        }
        for lantern in MASTERPLAN["lanterns"]
    ],
    "densityBudget": {
        "majorTrees": 0,
        "lanterns": len(MASTERPLAN["lanterns"]),
        "ecologyIslands": 0,
    },
    "defaultView": {
        "camera": MASTERPLAN["camera"]["default"]["position"],
        "target": MASTERPLAN["camera"]["default"]["target"],
        "lensMm": 40.5,
    },
}

terrain_bounds = MASTERPLAN["site"]["terrainBounds"]
GROUND_PLAN = {
    "planId": MASTERPLAN["planId"],
    "terrain": {
        "bounds": terrain_bounds,
        "gridSpacing": 1.2,
        "stageFlatHalfSize": [MASTERPLAN["stage"]["width"] * 0.5, MASTERPLAN["stage"]["depth"] * 0.5],
        "riverSplineSubdivisions": 8,
        "riverChannelDepth": MASTERPLAN["water"]["surfaceElevation"] - MASTERPLAN["water"]["bedDepth"],
        "riverWaterHeight": MASTERPLAN["water"]["surfaceElevation"],
        "mask": {
            "worldMin": [terrain_bounds["minX"], terrain_bounds["minY"]],
            "worldMax": [terrain_bounds["maxX"], terrain_bounds["maxY"]],
            "resolution": 512,
        },
    },
    "paths": [
        {
            "id": path["id"],
            "halfWidth": path["width"] * 0.5,
            "points": [[point[0], point[1]] for point in path["centerline"]],
        }
        for path in MASTERPLAN["circulation"]["paths"]
    ],
    "stageContact": {
        "edgeInset": 0.4,
        "feather": 1.8,
        "noise": 0.18,
        "strength": 0.72,
    },
    "grassPatches": [],
    "qualityTiers": {"baseFraction": 0.36, "mediumFraction": 0.34},
    "exclusions": {
        "stageHalfSize": [9.0, 9.5],
        "pathMargin": 0.35,
        "waterMargin": 0.55,
        "grassFootprintRadius": 0.72,
        "bridgeHalfSize": [2.8, 6.0],
    },
    "budgets": {
        "maximumAssetMiB": 32,
        "minimumGrassClumps": 0,
        "minimumGrassBlades": 0,
        "maximumGrassPrototypeMeshes": 0,
    },
}

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
os.makedirs(QA_DIR, exist_ok=True)
os.makedirs(os.path.dirname(GROUND_MASK_PATH), exist_ok=True)

# Keep web-served storage limited to runtime GLBs. These exact legacy outputs
# were produced by earlier revisions of this authoring script.
for stale_name in (
    "blossom_environment.blend",
    "blossom_environment.blend1",
    "blossom_environment_qa.png",
):
    stale_path = os.path.join(OUTPUT_DIR, stale_name)
    if os.path.isfile(stale_path):
        os.remove(stale_path)

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness=0.72, metallic=0.0, emission=None, emission_strength=0.0):
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


def textured_material(
    name,
    diffuse_path,
    normal_path,
    roughness_path,
    roughness_value=0.92,
    tint=None,
):
    for path in (diffuse_path, normal_path, roughness_path):
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Missing Blossom PBR texture: {path}")
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness_value

    diffuse = nodes.new("ShaderNodeTexImage")
    diffuse.name = f"{name} Diffuse"
    diffuse.image = bpy.data.images.load(diffuse_path, check_existing=True)
    diffuse.image.colorspace_settings.name = "sRGB"
    if tint is None:
        links.new(diffuse.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        # This must be ShaderNodeMix, never the legacy ShaderNodeMixRGB. The
        # glTF exporter recognises exactly one tinted-texture form and folds its
        # constant into baseColorFactor; anything else exports a white factor and
        # the authored tint vanishes without a warning. Probed against Blender
        # 5.0 with all four wirings: a direct texture link and a MixRGB multiply
        # both shipped factor [1,1,1,1], while ShaderNodeMix in MULTIPLY mode
        # shipped the authored colour with either input ordering. Both path
        # materials had been tinted through MixRGB since the first build, so the
        # garden's walks were rendering as raw untinted sand.
        tint_multiply = nodes.new("ShaderNodeMix")
        tint_multiply.name = f"{name} Tint"
        tint_multiply.data_type = "RGBA"
        tint_multiply.blend_type = "MULTIPLY"
        tint_multiply.inputs["Factor"].default_value = 1.0
        links.new(diffuse.outputs["Color"], tint_multiply.inputs[6])
        tint_multiply.inputs[7].default_value = (*tint, 1.0)
        links.new(tint_multiply.outputs[2], bsdf.inputs["Base Color"])

    normal = nodes.new("ShaderNodeTexImage")
    normal.name = f"{name} Normal"
    normal.image = bpy.data.images.load(normal_path, check_existing=True)
    normal.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.62
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    roughness = nodes.new("ShaderNodeTexImage")
    roughness.name = f"{name} Roughness"
    roughness.image = bpy.data.images.load(roughness_path, check_existing=True)
    roughness.image.colorspace_settings.name = "Non-Color"
    links.new(roughness.outputs["Color"], bsdf.inputs["Roughness"])
    return mat


FOREST_FLOOR_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "forest-floor")
FOREST_STAGE_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "forest-stage")
TERRAIN_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "terrain")
GROUND = textured_material(
    "Blossom Living Garden Ground",
    os.path.join(FOREST_FLOOR_TEXTURE_DIR, "forest-ground-detail-neutral.jpg"),
    os.path.join(FOREST_FLOOR_TEXTURE_DIR, "normal.jpg"),
    os.path.join(FOREST_FLOOR_TEXTURE_DIR, "roughness.jpg"),
    0.98,
)
CEDAR = textured_material(
    "Weathered Cedar PBR",
    os.path.join(FOREST_STAGE_TEXTURE_DIR, "wooden-planks-diffuse.jpg"),
    os.path.join(FOREST_STAGE_TEXTURE_DIR, "wooden-planks-normal.jpg"),
    os.path.join(FOREST_STAGE_TEXTURE_DIR, "wooden-planks-roughness.jpg"),
    0.72,
)
CEDAR_LIGHT = material("Cedar Honey", (0.69, 0.34, 0.15), roughness=0.62)
CEDAR_DARK = material("Cedar Shadow", (0.16, 0.065, 0.045), roughness=0.78)
PETAL_IVORY = material("Fallen Petal Ivory", (1.0, 0.78, 0.84), roughness=0.86)
PETAL_BLUSH = material("Fallen Petal Blush", (0.92, 0.35, 0.55), roughness=0.88)
PETAL_SHADOW = material("Fallen Petal Shadow", (0.50, 0.08, 0.22), roughness=0.92)
GRASS_MATERIALS = {
    "deep": material("Blossom Grass Deep", (0.035, 0.115, 0.045), roughness=0.99),
    "living": material("Blossom Grass Living", (0.070, 0.235, 0.075), roughness=0.99),
    "moonlit": material("Blossom Grass Moonlit", (0.095, 0.270, 0.125), roughness=0.99),
    "damp": material("Blossom Grass Damp", (0.045, 0.185, 0.115), roughness=0.99),
}
TORII = material("Torii Vermilion", (0.57, 0.055, 0.038), roughness=0.66)
TORII_DARK = material("Torii Lacquer Shadow", (0.16, 0.018, 0.025), roughness=0.58)
STONE = material("Lantern Stone", (0.30, 0.29, 0.34), roughness=0.98)


# Every walking surface is crushed stone, because the sand set these used before
# is a single flat mud-brown with no grain at any scale. Tiled across a path it
# resolved to one uniform colour, which is what made the walks read as smears
# painted on the lawn rather than a built surface. The rock set carries visible
# aggregate, so at a walking-scale repeat the eye gets something to hold on to.
#
# The albedo is the rock set lifted out of wet-slate darkness by
# scripts/build-blossom-path-albedo.mjs; its normal and roughness are reused
# unchanged. Raw `rock` is a mean of about sRGB 0.31 with an olive-blue cast, so
# a walk cut through this lawn rendered darker than the turf beside it and read
# as asphalt. baseColorFactor cannot undo that — glTF clamps it to one, so it
# only ever darkens — which is why the lift happens once, offline, in texture
# space. What is left here is the per-surface differentiation: a hint of warmth
# on the public fines, grey and slightly darker for service routes, cooler and
# flatter for the nobedan paving.
BLOSSOM_FLOOR_TEXTURE_DIR = os.path.join(
    PROJECT_ROOT, "static", "textures", "blossom-floor"
)
PATH_ALBEDO = os.path.join(BLOSSOM_FLOOR_TEXTURE_DIR, "path-fines-albedo.jpg")
PATH_NORMAL = os.path.join(TERRAIN_TEXTURE_DIR, "rock", "normal.jpg")
PATH_ROUGHNESS = os.path.join(TERRAIN_TEXTURE_DIR, "rock", "roughness.jpg")


def path_material(name, roughness_value, tint):
    return textured_material(
        name, PATH_ALBEDO, PATH_NORMAL, PATH_ROUGHNESS, roughness_value, tint=tint
    )


PATH_PUBLIC = path_material(
    "Blossom Compacted Stone Fines", 0.99, (0.92, 0.89, 0.82)
)
# Back-of-house at half the value of the public walks. Service routes and the
# operations pads carry the same aggregate, but a technical position that reads
# as brightly as the promenade puts the loudest surface in the garden behind the
# audience. Held down here, it recedes to what it is: gravel you stand equipment
# on.
PATH_SERVICE = path_material("Blossom Service Gravel", 0.99, (0.50, 0.50, 0.48))
PATH_EDGING = path_material("Blossom Path Edging Stone", 0.93, (0.80, 0.79, 0.78))
PATH_PAVING = path_material("Blossom Nobedan Paving", 0.88, (0.84, 0.84, 0.87))
PATH_FINES_REPEAT = 1.15
PATH_SERVICE_REPEAT = 1.7
PATH_PAVING_REPEAT = 2.0
PATH_EDGING_REPEAT = 0.9


def enable_vertex_tint(mat):
    """Multiply the surface albedo by a per-vertex colour.

    A path whose base colour is constant to its last vertex ends on a drawn
    line, which is what makes a ribbon read as a decal pasted over terrain.
    Routing the diffuse through a vertex-colour multiply lets each ribbon darken
    toward a mossy fringe at its outer edge, so the boundary dissolves instead of
    stopping. Blender's glTF exporter carries the attribute as COLOR_0 and
    three.js multiplies it automatically, so runtime needs no shader work.
    """
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        return mat
    base_color = bsdf.inputs["Base Color"]
    if not base_color.links:
        # A flat-colour material needs no node graph at all, and must not have
        # one. glTF already multiplies COLOR_0 into the base colour, and the
        # exporter emits COLOR_0 whether or not a shader node reads it — but it
        # only writes baseColorFactor from an UNLINKED Base Color socket. Any
        # wiring here (an RGB node, or the constant parked on a mix input)
        # exports the factor as white, which is how the river shipped as a
        # glowing sheet lit only by its own tint. Verified against Blender 5.0:
        # unlinked and orphan-attribute materials both carry the authored
        # factor plus COLOR_0; a material whose Base Color is linked loses it.
        # The cost is that Blender's viewport shows this surface untinted.
        return mat
    attribute = nodes.new("ShaderNodeVertexColor")
    attribute.name = f"{mat.name} Vertex Tint"
    attribute.layer_name = VERTEX_TINT_LAYER
    multiply = nodes.new("ShaderNodeMixRGB")
    multiply.name = f"{mat.name} Vertex Tint Multiply"
    multiply.blend_type = "MULTIPLY"
    multiply.inputs["Fac"].default_value = 1.0
    links.new(base_color.links[0].from_socket, multiply.inputs[1])
    links.new(attribute.outputs["Color"], multiply.inputs[2])
    links.new(multiply.outputs["Color"], base_color)
    return mat


# The path materials deliberately skip enable_vertex_tint. Wrapping their tint
# node in a second multiply puts a MixRGB at the Base Color socket, which is the
# one wiring the glTF exporter refuses to read a factor from, so the tint would
# be lost again. Nothing is given up: the exporter writes COLOR_0 from the mesh
# colour attribute regardless of the node graph, and glTF multiplies it into the
# base colour natively. Only Blender's own viewport misses the per-vertex shade.
RIVER_BED = material(
    "Blossom River Bed",
    (0.075, 0.11, 0.115),
    roughness=0.94,
)
# Authored at the shallow bank colour, not the deep one. Vertex tint can only
# darken, so the section reaches its deep channel colour by tinting inward from
# this. Authoring the deep colour instead would leave no way to lighten the
# edges, which is what made the ribbon read as one flat navy band.
WATER = material(
    "Moonlit River",
    (0.055, 0.148, 0.176),
    roughness=0.12,
    metallic=0.08,
    emission=(0.012, 0.034, 0.066),
    emission_strength=0.14,
)
enable_vertex_tint(WATER)
WATER_EDGE_TINT = (1.0, 1.0, 1.0)
WATER_SHALLOW_TINT = (0.72, 0.74, 0.82)
WATER_MID_TINT = (0.42, 0.44, 0.60)
WATER_DEEP_TINT = (0.26, 0.24, 0.40)
# Columns across the half-section, as a fraction of the local half width. The
# outer pair sits marginally below the waterline so the surface tucks under the
# graded bank instead of ending on a visible cut line.
WATER_SECTION = (
    (-1.0, WATER_EDGE_TINT, -0.055),
    (-0.74, WATER_SHALLOW_TINT, -0.012),
    (-0.36, WATER_MID_TINT, 0.0),
    (0.0, WATER_DEEP_TINT, 0.0),
    (0.36, WATER_MID_TINT, 0.0),
    (0.74, WATER_SHALLOW_TINT, -0.012),
    (1.0, WATER_EDGE_TINT, -0.055),
)
LANTERN_GLOW = material(
    "Lantern Glow",
    (1.0, 0.36, 0.09),
    roughness=0.5,
    emission=(1.0, 0.22, 0.045),
    emission_strength=7.0,
)
HORIZON = material("Twilight Horizon", (0.20, 0.055, 0.105), roughness=1.0, emission=(0.20, 0.055, 0.105), emission_strength=0.34)
TWILIGHT = material("Twilight Mid", (0.035, 0.030, 0.105), roughness=1.0, emission=(0.035, 0.030, 0.105), emission_strength=0.28)
ZENITH = material("Twilight Zenith", (0.006, 0.010, 0.032), roughness=1.0, emission=(0.006, 0.010, 0.032), emission_strength=0.24)
MOUNTAIN_NEAR = material("Mountain Near", (0.040, 0.065, 0.095), roughness=1.0)
MOUNTAIN_FAR = material("Mountain Far", (0.090, 0.070, 0.125), roughness=1.0)
MOON = material(
    "Moon Glow",
    (1.0, 0.73, 0.42),
    roughness=0.82,
    emission=(1.0, 0.43, 0.16),
    emission_strength=4.5,
)

GROUND_AUTHORING_STATS = {
    "grassClumps": 0,
    "grassBlades": 0,
    "grassPrototypeMeshes": 0,
    "grassTierCounts": {},
    "grassPatchCounts": {},
}


def make_mesh(name, vertices, faces, materials, material_indices=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for mat in materials:
        mesh.materials.append(mat)
    if material_indices:
        for polygon, index in zip(mesh.polygons, material_indices):
            polygon.material_index = index
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    return mesh


def add_vertex_tint(mesh, tints):
    layer = mesh.color_attributes.new(
        name=VERTEX_TINT_LAYER, type="BYTE_COLOR", domain="CORNER"
    )
    for loop in mesh.loops:
        red, green, blue = tints[loop.vertex_index]
        layer.data[loop.index].color = (red, green, blue, 1.0)
    return mesh


def add_planar_uv(mesh, metres_per_repeat=4.0):
    uv_layer = mesh.uv_layers.new(name="UVMap")
    inverse = 1.0 / metres_per_repeat
    for loop in mesh.loops:
        vertex = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = (vertex.x * inverse, vertex.y * inverse)
    return mesh


def link_object(name, mesh, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    obj.scale = scale
    return obj


def append_box(vertices, faces, center, size, rotation=(0, 0, 0)):
    start = len(vertices)
    x, y, z = (axis * 0.5 for axis in size)
    local = [
        (-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
        (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z),
    ]
    transform = Matrix.LocRotScale(Vector(center), Euler(rotation).to_quaternion(), Vector((1, 1, 1)))
    vertices.extend([tuple(transform @ Vector(point)) for point in local])
    faces.extend([
        (start, start + 3, start + 2, start + 1),
        (start + 4, start + 5, start + 6, start + 7),
        (start, start + 1, start + 5, start + 4),
        (start + 1, start + 2, start + 6, start + 5),
        (start + 2, start + 3, start + 7, start + 6),
        (start + 3, start, start + 4, start + 7),
    ])


def append_tapered_segment(vertices, faces, start_point, end_point, radius_start, radius_end, sides=8):
    start_point = Vector(start_point)
    end_point = Vector(end_point)
    axis = (end_point - start_point).normalized()
    reference = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((0, 1, 0))
    tangent = axis.cross(reference).normalized()
    bitangent = axis.cross(tangent).normalized()
    start = len(vertices)
    for point, radius in ((start_point, radius_start), (end_point, radius_end)):
        for index in range(sides):
            angle = 2 * math.pi * index / sides
            radial = tangent * math.cos(angle) + bitangent * math.sin(angle)
            vertices.append(tuple(point + radial * radius))
    for index in range(sides):
        nxt = (index + 1) % sides
        faces.append((start + index, start + nxt, start + sides + nxt, start + sides + index))
    faces.append(tuple(start + index for index in reversed(range(sides))))
    faces.append(tuple(start + sides + index for index in range(sides)))


def append_cylinder(vertices, faces, center, radius_bottom, radius_top, height, sides=16):
    z0 = center[2] - height * 0.5
    z1 = center[2] + height * 0.5
    append_tapered_segment(
        vertices,
        faces,
        (center[0], center[1], z0),
        (center[0], center[1], z1),
        radius_bottom,
        radius_top,
        sides,
    )


def create_backdrop():
    segments = 40
    rings = ((-2.0, 54.0), (8.0, 53.0), (22.0, 48.0), (38.0, 36.0), (49.0, 12.0))
    vertices, faces, indices = [], [], []
    for z, radius in rings:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
    for ring_index in range(len(rings) - 1):
        current = ring_index * segments
        following = (ring_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((current + index, current + nxt, following + nxt, following + index))
            indices.append(0 if ring_index == 0 else 1 if ring_index < 3 else 2)
    top = len(vertices)
    vertices.append((0, 0, 52))
    last_ring = (len(rings) - 1) * segments
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((last_ring + index, last_ring + nxt, top))
        indices.append(2)
    backdrop = link_object(
        "Twilight_Backdrop",
        make_mesh("Twilight Backdrop Mesh", vertices, faces, [HORIZON, TWILIGHT, ZENITH], indices, smooth=True),
    )
    backdrop.visible_shadow = False


def create_mountain_ring(
    name,
    inner_radius,
    ridge_radius,
    outer_radius,
    base_height,
    amplitude,
    phase,
    mat,
):
    """Build a closed, viewable-from-any-angle mountain silhouette band."""
    segments = 72
    vertices = []
    for radius_kind in ("inner", "ridge", "outer"):
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            if radius_kind == "inner":
                radius = inner_radius * (1.0 + 0.012 * math.sin(angle * 5 + phase))
                z = -0.25
            elif radius_kind == "ridge":
                radius = ridge_radius * (1.0 + 0.026 * math.sin(angle * 4 + phase * 0.7))
                wave = (
                    0.54
                    + 0.22 * math.sin(angle * 3 + phase)
                    + 0.15 * math.sin(angle * 7 - phase * 0.6)
                    + 0.09 * math.sin(angle * 13 + phase * 1.4)
                )
                z = base_height + amplitude * max(0.18, wave)
            else:
                radius = outer_radius
                z = -0.8
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))

    faces = []
    for ring_index in range(2):
        current = ring_index * segments
        following = (ring_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((current + index, current + nxt, following + nxt, following + index))

    link_object(
        name,
        make_mesh(f"{name} Mesh", vertices, faces, [mat], smooth=True),
    )


def create_moon():
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=12,
        radius=1.85,
        location=(12.5, 43.0, 13.8),
    )
    moon = bpy.context.active_object
    moon.name = "Moon_Disc"
    moon.data.name = "Moon Disc Mesh"
    moon.data.materials.append(MOON)
    moon.visible_shadow = False
    for polygon in moon.data.polygons:
        polygon.use_smooth = True


def clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    amount = clamp((value - edge0) / (edge1 - edge0))
    return amount * amount * (3.0 - 2.0 * amount)


def point_segment_distance(x, y, first, second):
    first_x, first_y = first
    second_x, second_y = second
    dx = second_x - first_x
    dy = second_y - first_y
    length_squared = dx * dx + dy * dy
    if length_squared <= 1e-8:
        return math.hypot(x - first_x, y - first_y)
    amount = clamp(((x - first_x) * dx + (y - first_y) * dy) / length_squared)
    return math.hypot(x - (first_x + dx * amount), y - (first_y + dy * amount))


def polyline_distance(x, y, points):
    return min(
        point_segment_distance(x, y, first, second)
        for first, second in zip(points, points[1:])
    )


def point_segment_distance_with_height(x, y, first, second):
    dx = second[0] - first[0]
    dy = second[1] - first[1]
    length_squared = dx * dx + dy * dy
    if length_squared <= 1e-8:
        return math.hypot(x - first[0], y - first[1]), first[2]
    amount = clamp(((x - first[0]) * dx + (y - first[1]) * dy) / length_squared)
    closest_x = first[0] + dx * amount
    closest_y = first[1] + dy * amount
    elevation = first[2] + (second[2] - first[2]) * amount
    return math.hypot(x - closest_x, y - closest_y), elevation


def point_in_polygon(x, y, polygon):
    inside = False
    previous = polygon[-1]
    for current in polygon:
        if (current[1] > y) != (previous[1] > y):
            edge_x = (previous[0] - current[0]) * (y - current[1]) / (
                previous[1] - current[1]
            ) + current[0]
            if x < edge_x:
                inside = not inside
        previous = current
    return inside


def catmull_rom_point(first, second, third, fourth, amount):
    return tuple(
        0.5
        * (
            2.0 * second[axis]
            + (-first[axis] + third[axis]) * amount
            + (2.0 * first[axis] - 5.0 * second[axis] + 4.0 * third[axis] - fourth[axis])
            * amount
            * amount
            + (-first[axis] + 3.0 * second[axis] - 3.0 * third[axis] + fourth[axis])
            * amount
            * amount
            * amount
        )
        for axis in range(2)
    )


RIVER_RUN_OUT_SPACING = 4.0


def river_run_out_stations(anchor, inward):
    """Stations continuing an end tangent until the water has left the site.

    The authored centerline spans 85 m inside a 256 m field, so stopping at its
    last control point leaves the river ending in a square cap in open ground.
    Extending both end tangents past the terrain boundary is what lets it read
    as arriving from the hills rather than beginning nowhere.
    """
    dx = anchor[0] - inward[0]
    dy = anchor[1] - inward[1]
    length = math.hypot(dx, dy) or 1.0
    bounds = MASTERPLAN["site"]["terrainBounds"]
    margin = COMPOSITION_PLAN["water"]["runOut"]["marginMetres"]
    stations = []
    distance = RIVER_RUN_OUT_SPACING
    while distance < 400.0:
        point = (
            anchor[0] + dx / length * distance,
            anchor[1] + dy / length * distance,
        )
        stations.append(point)
        if (
            point[0] < bounds["minX"] - margin
            or point[0] > bounds["maxX"] + margin
            or point[1] < bounds["minY"] - margin
            or point[1] > bounds["maxY"] + margin
        ):
            break
        distance += RIVER_RUN_OUT_SPACING
    return stations


_RIVER_COURSE = None


def river_course():
    """Resampled centerline, cumulative arc lengths, and the authored span.

    Everything downstream — the channel carve, the bank terrace, the water
    ribbon, habitat damping and grove clearance — reads this one course, so the
    terrain and the surface can never disagree about where the river is.
    """
    global _RIVER_COURSE
    if _RIVER_COURSE is not None:
        return _RIVER_COURSE

    control_points = COMPOSITION_PLAN["water"]["centerline"]
    subdivisions = GROUND_PLAN["terrain"]["riverSplineSubdivisions"]
    authored = []
    for segment in range(len(control_points) - 1):
        first = control_points[max(0, segment - 1)]
        second = control_points[segment]
        third = control_points[segment + 1]
        fourth = control_points[min(len(control_points) - 1, segment + 2)]
        for step in range(subdivisions):
            authored.append(
                catmull_rom_point(first, second, third, fourth, step / subdivisions)
            )
    authored.append(tuple(control_points[-1]))

    head = river_run_out_stations(authored[0], authored[1])
    head.reverse()
    tail = river_run_out_stations(authored[-1], authored[-2])
    stations = [*head, *authored, *tail]

    arcs = [0.0]
    for index in range(1, len(stations)):
        arcs.append(arcs[-1] + math.dist(stations[index - 1], stations[index]))

    _RIVER_COURSE = {
        "stations": tuple(stations),
        "arcs": tuple(arcs),
        "authoredStartArc": arcs[len(head)],
        "authoredEndArc": arcs[len(head) + len(authored) - 1],
    }
    return _RIVER_COURSE


def river_centerline_samples():
    return river_course()["stations"]


def river_run_out_amount(arc_length):
    """0 across the authored reach, 1 once the run-out section is fully open."""
    course = river_course()
    open_from = COMPOSITION_PLAN["water"]["runOut"]["openFromMetres"]
    if arc_length < course["authoredStartArc"]:
        return smoothstep(0.0, open_from, course["authoredStartArc"] - arc_length)
    if arc_length > course["authoredEndArc"]:
        return smoothstep(0.0, open_from, arc_length - course["authoredEndArc"])
    return 0.0


def river_half_width(arc_length):
    run_out = COMPOSITION_PLAN["water"]["runOut"]
    open_amount = river_run_out_amount(arc_length)
    width = COMPOSITION_PLAN["water"]["width"] + (
        run_out["surfaceWidth"] - COMPOSITION_PLAN["water"]["width"]
    ) * open_amount
    return width * 0.5


def river_bank_terrace_width(arc_length):
    run_out = COMPOSITION_PLAN["water"]["runOut"]
    open_amount = river_run_out_amount(arc_length)
    terrace = COMPOSITION_PLAN["water"]["bankTerraceWidth"]
    return terrace + (run_out["bankTerraceWidth"] - terrace) * open_amount


def river_projection(x, y):
    """Distance to the centerline and how far along it the closest point lies."""
    course = river_course()
    stations = course["stations"]
    arcs = course["arcs"]
    best_distance = None
    best_arc = 0.0
    for index in range(len(stations) - 1):
        first = stations[index]
        second = stations[index + 1]
        dx = second[0] - first[0]
        dy = second[1] - first[1]
        length_squared = dx * dx + dy * dy
        if length_squared <= 1e-8:
            amount = 0.0
        else:
            amount = clamp(((x - first[0]) * dx + (y - first[1]) * dy) / length_squared)
        distance = math.hypot(x - (first[0] + dx * amount), y - (first[1] + dy * amount))
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_arc = arcs[index] + math.sqrt(length_squared) * amount
    return best_distance, best_arc


def river_distance(x, y):
    return river_projection(x, y)[0]


def river_bank_profile(x, y):
    """Signed distance to the water's edge, and the terrace width in force there."""
    distance, arc_length = river_projection(x, y)
    signed_distance = distance - river_half_width(arc_length)
    for widening in COMPOSITION_PLAN["water"]["localWidenings"]:
        signed_distance = min(
            signed_distance,
            math.hypot(x - widening["center"][0], y - widening["center"][1])
            - widening["surfaceRadius"],
        )
    return signed_distance, river_bank_terrace_width(arc_length)


def river_surface_distance(x, y):
    return river_bank_profile(x, y)[0]


def river_bed_depth(x, y):
    depth = COMPOSITION_PLAN["water"]["bedDepth"]
    for widening in COMPOSITION_PLAN["water"]["localWidenings"]:
        if (
            math.hypot(x - widening["center"][0], y - widening["center"][1])
            <= widening["surfaceRadius"]
        ):
            depth = max(depth, widening["minimumDepth"])
    return depth


def path_distance(x, y):
    return min(
        polyline_distance(x, y, path["points"]) - path["halfWidth"]
        for path in GROUND_PLAN["paths"]
    )


def closest_path_surface(x, y):
    closest = None
    for path in MASTERPLAN["circulation"]["paths"]:
        if path["id"] == "bridge-crossing":
            continue
        for first, second in zip(path["centerline"], path["centerline"][1:]):
            distance, elevation = point_segment_distance_with_height(
                x, y, first, second
            )
            signed = distance - path["width"] * 0.5
            if closest is None or signed < closest[0]:
                closest = (signed, elevation)
    return closest


def rectangle_distance(x, y, half_width, half_depth):
    delta_x = abs(x) - half_width
    delta_y = abs(y) - half_depth
    outside = math.hypot(max(delta_x, 0.0), max(delta_y, 0.0))
    inside = min(max(delta_x, delta_y), 0.0)
    return outside + inside


def garden_ground_height(x, y):
    playable = MASTERPLAN["site"]["playableClearingBounds"]
    outside_x = max(playable["minX"] - x, 0.0, x - playable["maxX"])
    outside_y = max(playable["minY"] - y, 0.0, y - playable["maxY"])
    outside_distance = math.hypot(outside_x, outside_y)
    berm_amount = smoothstep(
        0.0,
        MASTERPLAN["site"]["softHorizonBandMetres"],
        outside_distance,
    )
    berm_minimum, berm_maximum = MASTERPLAN["site"]["gradeStrategy"][
        "perimeterBermRange"
    ]
    berm_height = (
        berm_minimum
        + (berm_maximum - berm_minimum)
        * (0.5 + 0.5 * math.sin(x * 0.055 + y * 0.037))
    ) * berm_amount

    height = (
        0.05
        + 0.035 * math.sin(x * 0.17 + y * 0.11)
        + 0.018 * math.sin(x * -0.39 + y * 0.23 + 1.7)
        + berm_height
    )

    if y >= 20.0:
        north_amount = smoothstep(20.0, 34.0, y)
        height = max(
            height,
            MASTERPLAN["site"]["gradeStrategy"]["northBankElevation"]
            * north_amount,
        )

    for zone in MASTERPLAN["audience"]["zones"]:
        if not point_in_polygon(x, y, zone["polygon"]):
            continue
        if zone["id"] == "central-hanami-lawn":
            target = 0.18 + smoothstep(-11.0, -26.0, y) * 0.53
        elif zone["id"] == "accessible-overlook":
            target = 0.30
        else:
            target = 0.28 + smoothstep(-12.0, -25.0, y) * 0.44
        height = target
        break

    surface_distance, terrace_width = river_bank_profile(x, y)

    # Grade the ground down toward the waterline before the channel itself
    # cuts. The 1.4 m bank transition is barely wider than one 1.2 m terrain
    # cell, so on its own the shoreline resolves as a single polygonal step and
    # the water reads as a decal. The terrace gives the bank several cells of
    # real slope. It runs before the path blend so a route beside the river
    # still sits at its authored elevation above the graded bank.
    terrace_weight = (1.0 - smoothstep(0.0, terrace_width, surface_distance)) * 0.85
    terrace_target = COMPOSITION_PLAN["water"]["surfaceElevation"] + 0.35
    height = height * (1.0 - terrace_weight) + terrace_target * terrace_weight

    path_surface = closest_path_surface(x, y)
    if path_surface:
        signed_distance, path_elevation = path_surface
        path_weight = 1.0 - smoothstep(0.0, 1.15, signed_distance)
        height = height * (1.0 - path_weight) + path_elevation * path_weight

    stage_clearance = MASTERPLAN["stage"]["protectedClearance"]
    if (
        stage_clearance["minX"] <= x <= stage_clearance["maxX"]
        and stage_clearance["minY"] <= y <= stage_clearance["maxY"]
    ):
        edge_distance = min(
            x - stage_clearance["minX"],
            stage_clearance["maxX"] - x,
            y - stage_clearance["minY"],
            stage_clearance["maxY"] - y,
        )
        stage_weight = smoothstep(0.0, 1.4, edge_distance)
        height *= 1.0 - stage_weight

    bank_width = COMPOSITION_PLAN["water"]["bankTransitionWidth"]
    surface_elevation = COMPOSITION_PLAN["water"]["surfaceElevation"]
    # Put the terrain's crossing of water level slightly outside the water
    # polygon rather than exactly on its edge.
    #
    # The terrain grid is 1.2 m and the river is 5.4 m wide, so the shoreline
    # almost never lands on a vertex. With the crossing on the edge itself, the
    # cell straddling it interpolates ground a centimetre or two above the
    # surface for part of its span, and that lit sliver shows through the water
    # as a dashed white line down the bank. Drowning the last third of a metre
    # keeps the ground strictly under the surface everywhere the water covers
    # it, and the dry lip left outside is shallower than the grass on it.
    drowned_margin = 0.35
    surface_distance -= drowned_margin
    if surface_distance > 0.0:
        # Above the waterline, bring the grade down to meet the water exactly at
        # its edge. Carving straight to bed depth here instead left a metre of
        # terrain sitting below the water level with no water over it, so every
        # bank read as a dry trench beside a floating ribbon.
        bank_weight = 1.0 - smoothstep(0.0, bank_width, surface_distance)
        height = height * (1.0 - bank_weight) + surface_elevation * bank_weight
    else:
        # Below it, a bowl rather than a slab, so the bed is visibly deepest in
        # the channel and shallows as it approaches either bank.
        submerged = smoothstep(0.0, bank_width, -surface_distance)
        height = surface_elevation - river_bed_depth(x, y) * submerged
    return height


def habitat_weights(x, y):
    noise = 0.5 + 0.5 * math.sin(x * 0.19 + y * 0.27) * math.sin(
        x * -0.41 + y * 0.13 + 0.9
    )
    weights = [0.04, 0.76 + 0.08 * noise, 0.20 - 0.04 * noise, 0.0]

    for zone in MASTERPLAN["audience"]["zones"]:
        if not point_in_polygon(x, y, zone["polygon"]):
            continue
        if "turf" in zone["surface"]:
            weights = [0.06, 0.84, 0.10, 0.0]
        else:
            weights = [0.88, 0.08, 0.04, 0.0]
            break

    # A damp margin, not a beach. At 3.4 m the silt family reached almost the
    # river's own width, so from the bank the eye read a broad tan shore with a
    # dark channel behind it rather than grass running down to water. Holding it
    # to 1.5 m keeps the pale fringe that separates turf from surface without
    # letting it become the dominant ground plane at eye level.
    damp_weight = 1.0 - smoothstep(0.2, 1.5, river_surface_distance(x, y))
    weights = [
        value * (1.0 - damp_weight * 0.84) + target * damp_weight * 0.84
        for value, target in zip(weights, (0.0, 0.14, 0.08, 0.78))
    ]

    # path_distance is signed from the built edge, so a 1.55 m falloff painted a
    # compacted band 3.1 m wider than the walk itself — on a 2.2 m route, more
    # than twice the surface, with a metre and a half of gradient on each side.
    # That band, not the ribbon, was what the eye actually read as "the path",
    # and it is why the walks looked like stains with no edges. Holding it to
    # 0.45 m leaves the wear a real path scuffs into the turf beside it and
    # hands the boundary back to the geometry and the edging stones.
    compacted_weight = 1.0 - smoothstep(-0.30, 0.45, path_distance(x, y))
    weights = [
        value * (1.0 - compacted_weight * 0.9) + target * compacted_weight * 0.9
        for value, target in zip(weights, (0.94, 0.04, 0.02, 0.0))
    ]
    total = max(0.001, sum(weights))
    return tuple(value / total for value in weights)


def png_chunk(label, data):
    return (
        struct.pack(">I", len(data))
        + label
        + data
        + struct.pack(">I", zlib.crc32(label + data) & 0xFFFFFFFF)
    )


def create_ground_family_mask():
    mask = GROUND_PLAN["terrain"]["mask"]
    width = height = int(mask["resolution"])
    min_x, min_depth = mask["worldMin"]
    max_x, max_depth = mask["worldMax"]
    rows = []
    for row in range(height):
        viewer_depth = max_depth - (row + 0.5) / height * (max_depth - min_depth)
        pixels = bytearray()
        for column in range(width):
            viewer_x = min_x + (column + 0.5) / width * (max_x - min_x)
            # Runtime rotates the authored GLB 180 degrees around world Y.
            # Viewer X therefore maps back to negative Blender X, while depth
            # retains the authored Y direction.
            red, green, blue, _fourth = habitat_weights(-viewer_x, viewer_depth)
            pixels.extend(
                (
                    round(clamp(red) * 255),
                    round(clamp(green) * 255),
                    round(clamp(blue) * 255),
                )
            )
        rows.append(b"\x00" + bytes(pixels))

    raw = b"".join(rows)
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    encoded = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )
    with open(GROUND_MASK_PATH, "wb") as mask_file:
        mask_file.write(encoded)


def create_ground():
    terrain = GROUND_PLAN["terrain"]
    bounds = terrain["bounds"]
    spacing = terrain["gridSpacing"]
    x_count = round((bounds["maxX"] - bounds["minX"]) / spacing)
    y_count = round((bounds["maxY"] - bounds["minY"]) / spacing)
    x_values = [
        bounds["minX"] + (bounds["maxX"] - bounds["minX"]) * index / x_count
        for index in range(x_count + 1)
    ]
    y_values = [
        bounds["minY"] + (bounds["maxY"] - bounds["minY"]) * index / y_count
        for index in range(y_count + 1)
    ]
    vertices = [
        (x, y, garden_ground_height(x, y))
        for y in y_values
        for x in x_values
    ]
    faces = []
    row_width = len(x_values)
    for row in range(len(y_values) - 1):
        for column in range(len(x_values) - 1):
            first = row * row_width + column
            second = first + 1
            fourth = (row + 1) * row_width + column
            third = fourth + 1
            if (row + column) % 2 == 0:
                faces.extend(((first, second, third), (first, third, fourth)))
            else:
                faces.extend(((first, second, fourth), (second, third, fourth)))

    ground_mesh = make_mesh(
        "Blossom Continuous Garden Ground Mesh",
        vertices,
        faces,
        [GROUND],
        smooth=True,
    )
    add_planar_uv(ground_mesh, metres_per_repeat=3.4)
    ground = link_object("Garden_Ground", ground_mesh)
    ground["tka_role"] = "blossom-continuous-ground"
    ground["tka_ground_plan"] = GROUND_PLAN["planId"]
    ground["tka_terrain_min_x"] = bounds["minX"]
    ground["tka_terrain_max_x"] = bounds["maxX"]
    ground["tka_terrain_min_y"] = bounds["minY"]
    ground["tka_terrain_max_y"] = bounds["maxY"]
    solidify = ground.modifiers.new("Living garden soil depth", "SOLIDIFY")
    solidify.thickness = 0.16
    solidify.material_offset = 0
    create_ground_family_mask()


SURFACE_SAMPLE_SPACING = 1.4
SURFACE_LIFT = 0.025
SURFACE_FRINGE_DROP = -0.012


def densify_outline(polygon, spacing=SURFACE_SAMPLE_SPACING):
    dense = []
    for index, current in enumerate(polygon):
        following = polygon[(index + 1) % len(polygon)]
        span = math.dist(current, following)
        steps = max(1, int(math.ceil(span / spacing)))
        for step in range(steps):
            amount = step / steps
            dense.append(
                (
                    current[0] + (following[0] - current[0]) * amount,
                    current[1] + (following[1] - current[1]) * amount,
                )
            )
    return dense


def create_surface_polygon(
    name,
    polygon,
    surface_material,
    role,
    metres_per_repeat=2.8,
    core_tint=None,
    edge_tint=None,
    edge_drop=SURFACE_FRINGE_DROP,
):
    """Build a terrain-conforming surface patch as a polar grid.

    Fanning straight from the centroid to each corner leaves spokes many metres
    long, so a large rectangle only touches the ground at its corners and cuts
    through every rise between them. Densifying the outline and stepping outward
    in rings samples the graded terrain across the whole patch instead.
    """
    core_tint = PATH_CORE_TINT if core_tint is None else core_tint
    edge_tint = PATH_SKIRT_TINT if edge_tint is None else edge_tint
    outline = densify_outline(polygon)
    center_x = sum(point[0] for point in outline) / len(outline)
    center_y = sum(point[1] for point in outline) / len(outline)
    rings = max(
        2,
        int(
            math.ceil(
                max(math.dist((center_x, center_y), point) for point in outline)
                / SURFACE_SAMPLE_SPACING
            )
        ),
    )

    vertices = [
        (center_x, center_y, garden_ground_height(center_x, center_y) + SURFACE_LIFT)
    ]
    tints = [core_tint]
    for ring in range(1, rings + 1):
        amount = ring / rings
        is_edge = ring == rings
        lift = edge_drop if is_edge else SURFACE_LIFT
        tint = edge_tint if is_edge else core_tint
        for x, y in outline:
            sample_x = center_x + (x - center_x) * amount
            sample_y = center_y + (y - center_y) * amount
            vertices.append(
                (sample_x, sample_y, garden_ground_height(sample_x, sample_y) + lift)
            )
            tints.append(tint)

    count = len(outline)
    faces = [(0, 1 + index, 1 + (index + 1) % count) for index in range(count)]
    for ring in range(rings - 1):
        inner = 1 + ring * count
        outer = inner + count
        for index in range(count):
            following = (index + 1) % count
            faces.append(
                (
                    inner + index,
                    outer + index,
                    outer + following,
                    inner + following,
                )
            )

    surface = link_object(
        name,
        add_vertex_tint(
            add_planar_uv(
                make_mesh(
                    f"{name} Mesh", vertices, faces, [surface_material], smooth=True
                ),
                metres_per_repeat=metres_per_repeat,
            ),
            tints,
        ),
    )
    surface["tka_role"] = role
    surface.visible_shadow = False
    return surface


PATH_STATION_SPACING = 0.45

# A built walk is full-brightness surface right out to a defined edge, and only
# then gives way to turf. The five-column section this replaces spent the outer
# forty per cent of every path fading to a mossy green, so a 2.2 m walk showed a
# 1.3 m core and two soft green ramps — no edge anywhere, at any distance. Here
# the crushed stone holds its value to the built edge and the handover to grass
# happens in a skirt a quarter of a metre wide, tucked below grade so turf laps
# over it the way it does against real edging.
PATH_CORE_FRACTION = 0.78
PATH_SKIRT_WIDTH = 0.26
PATH_CROWN_LIFT = 0.045
PATH_CORE_LIFT = 0.036
PATH_EDGE_LIFT = 0.020
PATH_SKIRT_DROP = -0.020
PATH_CORE_TINT = (1.0, 1.0, 1.0)
PATH_SHOULDER_TINT = (0.93, 0.92, 0.89)
PATH_EDGE_TINT = (0.76, 0.75, 0.70)
PATH_SKIRT_TINT = (0.42, 0.46, 0.34)

# Edging stones (fuchi-ishi) set along both sides of every public walk. They are
# what makes a path read as laid rather than worn: a hard silhouette at the
# boundary that survives being seen from across the garden, where a colour
# gradient does not. Service routes get none, which is also how the eye tells
# the two apart without reading a label.
PATH_EDGING_SPACING = 0.82
PATH_EDGING_LENGTH = 0.34
PATH_EDGING_WIDTH = 0.20
PATH_EDGING_RISE = 0.085
PATH_EDGING_BURIAL = 0.11


def resample_centerline(centerline, spacing=PATH_STATION_SPACING):
    """Catmull-Rom the authored control points into evenly spaced stations.

    The masterplan authors each route as a handful of control points. Walking
    those raw points produces one quad per authored segment, so every direction
    change becomes a visible crease and the route reads as a chain of flat
    facets. Resampling along the spline first gives the ribbon real curvature.
    """
    points = [(point[0], point[1]) for point in centerline]
    if len(points) < 2:
        return points

    padded = [points[0], *points, points[-1]]
    stations = []
    for index in range(len(padded) - 3):
        first, second, third, fourth = padded[index : index + 4]
        span = math.hypot(third[0] - second[0], third[1] - second[1])
        steps = max(1, int(math.ceil(span / spacing)))
        for step in range(steps):
            stations.append(
                catmull_rom_point(first, second, third, fourth, step / steps)
            )
    stations.append(points[-1])
    return stations


def path_edge_offset(arc_length, side_seed):
    """Low-frequency wander applied to a ribbon's outer edge.

    Hand-laid edging is never ruled, but it is also not a desire line. Three
    octaves reaching sixteen per cent of the half-width gave a 2.2 m walk a
    boundary that visibly breathed in and out over every few paces, which reads
    as erosion rather than construction. Two octaves at a third of that keep the
    variance a mason would leave. Keying both to arc length keeps the sides
    independent and the result deterministic, so a rebuild produces the same
    garden.
    """
    return 0.035 * math.sin(arc_length * 0.61 + side_seed * 11.37) + 0.018 * math.sin(
        arc_length * 1.73 + side_seed * 4.11 + 1.3
    )


LANDING_RIBBON_TUCK = 0.30


def trim_stations_at_landings(stations, landings):
    """Stop a ribbon under the pad that receives it.

    A ribbon that runs to its authored endpoint crosses every other ribbon
    arriving at the same node, and the crossing is what produced the raised
    cross-shaped scar in the middle of the lawn. Ending each one a little inside
    the landing rim lets the pad cover all of them at once.
    """
    if not landings:
        return stations
    kept = [
        index
        for index, point in enumerate(stations)
        if all(
            math.dist(point, position[:2]) > radius - LANDING_RIBBON_TUCK
            for radius, position in landings
        )
    ]
    if len(kept) < 2:
        return stations

    # Keep the longest unbroken run, so a pad sitting across the middle of a
    # route cannot silently split it into two disconnected ribbons.
    best = run = [kept[0]]
    for index in kept[1:]:
        run = run + [index] if index == run[-1] + 1 else [index]
        if len(run) > len(best):
            best = run
    return stations[best[0] : best[-1] + 1] if len(best) >= 2 else stations


def create_path_ribbon(path, edging_sink, landings):
    stations = trim_stations_at_landings(
        resample_centerline(path["centerline"]), landings
    )
    half_width = path["width"] * 0.5
    is_service = path["kind"] == "restricted-service"
    vertices = []
    tints = []
    arc_length = 0.0
    next_edging_arc = PATH_EDGING_SPACING * 0.5

    for index, point in enumerate(stations):
        if index > 0:
            arc_length += math.dist(stations[index - 1], point)
        previous = stations[max(0, index - 1)]
        following = stations[min(len(stations) - 1, index + 1)]
        tangent_x = following[0] - previous[0]
        tangent_y = following[1] - previous[1]
        length = math.hypot(tangent_x, tangent_y) or 1.0
        normal_x = -tangent_y / length
        normal_y = tangent_x / length

        # Offsetting every station by half the width along its own normal pinches
        # the ribbon on the inside of a corner. Dividing by the cosine of the
        # half-turn restores the authored width through the bend. The cap used to
        # sit at 2.4, which let a tight bend balloon a 2.2 m walk to more than
        # five metres and produced the lumpy widenings that showed from overhead
        # as blobs. A real path does not fatten into a turn; it turns, and where
        # several turns coincide a landing absorbs them. 1.3 keeps the width
        # honest and leaves the junction pads to do that work.
        incoming_x, incoming_y = point[0] - previous[0], point[1] - previous[1]
        outgoing_x, outgoing_y = following[0] - point[0], following[1] - point[1]
        incoming_length = math.hypot(incoming_x, incoming_y)
        outgoing_length = math.hypot(outgoing_x, outgoing_y)
        if incoming_length > 1e-6 and outgoing_length > 1e-6:
            alignment = (incoming_x * outgoing_x + incoming_y * outgoing_y) / (
                incoming_length * outgoing_length
            )
            miter = min(1.0 / math.sqrt(max(0.08, 0.5 * (1.0 + alignment))), 1.3)
        else:
            miter = 1.0

        left_edge = half_width * miter * (1.0 + path_edge_offset(arc_length, 0.0))
        right_edge = half_width * miter * (1.0 + path_edge_offset(arc_length, 5.0))
        cross_section = (
            (-left_edge - PATH_SKIRT_WIDTH, PATH_SKIRT_TINT, PATH_SKIRT_DROP),
            (-left_edge, PATH_EDGE_TINT, PATH_EDGE_LIFT),
            (-left_edge * PATH_CORE_FRACTION, PATH_SHOULDER_TINT, PATH_CORE_LIFT),
            (0.0, PATH_CORE_TINT, PATH_CROWN_LIFT),
            (right_edge * PATH_CORE_FRACTION, PATH_SHOULDER_TINT, PATH_CORE_LIFT),
            (right_edge, PATH_EDGE_TINT, PATH_EDGE_LIFT),
            (right_edge + PATH_SKIRT_WIDTH, PATH_SKIRT_TINT, PATH_SKIRT_DROP),
        )

        for offset, tint, lift in cross_section:
            x = point[0] + normal_x * offset
            y = point[1] + normal_y * offset
            # Sampling the graded terrain rather than the authored control-point
            # elevation is what keeps the ribbon on the ground between stations.
            vertices.append((x, y, garden_ground_height(x, y) + lift))
            tints.append(tint)

        if not is_service and arc_length >= next_edging_arc:
            next_edging_arc += PATH_EDGING_SPACING
            heading = math.atan2(tangent_y, tangent_x)
            for side, edge in ((-1.0, left_edge), (1.0, right_edge)):
                lateral = edge * side
                edging_sink.append(
                    (
                        point[0] + normal_x * lateral,
                        point[1] + normal_y * lateral,
                        heading,
                        arc_length,
                        side,
                    )
                )

    columns = 7
    faces = []
    for index in range(len(stations) - 1):
        base = index * columns
        for column in range(columns - 1):
            faces.append(
                (
                    base + column,
                    base + column + 1,
                    base + columns + column + 1,
                    base + columns + column,
                )
            )
    path_object = link_object(
        f"Path_{path['id']}",
        add_vertex_tint(
            add_planar_uv(
                make_mesh(
                    f"Blossom {path['label']} Mesh",
                    vertices,
                    faces,
                    [PATH_SERVICE if is_service else PATH_PUBLIC],
                    smooth=True,
                ),
                metres_per_repeat=(
                    PATH_SERVICE_REPEAT if is_service else PATH_FINES_REPEAT
                ),
            ),
            tints,
        ),
    )
    path_object["tka_role"] = (
        "restricted-service-route" if is_service else "public-accessible-route"
    )
    path_object["tka_path_id"] = path["id"]
    path_object["tka_path_width"] = path["width"]
    path_object.visible_shadow = False


def create_rectangle_surface(name, rectangle, surface_material, role, **options):
    polygon = [
        (rectangle["minX"], rectangle["minY"]),
        (rectangle["maxX"], rectangle["minY"]),
        (rectangle["maxX"], rectangle["maxY"]),
        (rectangle["minX"], rectangle["maxY"]),
    ]
    return create_surface_polygon(name, polygon, surface_material, role, **options)


# Nodes that deserve a paved landing. Every one of these is a place where two or
# more routes arrive, or where a route meets something built, and until now each
# was rendered by simply letting the ribbons overlap: two crowned surfaces
# crossing at a shallow angle, which showed from overhead as the cross-shaped
# blot at the centre of the lawn. Laying a nobedan pad there makes the meeting
# deliberate, gives the walker somewhere to stand while choosing a direction,
# and hides every ribbon end underneath cut stone.
# bridge-landing is absent on purpose: the bridge already lays its own rectangle
# at each abutment, and a second pad on top of it would z-fight.
LANDING_NODE_MARGINS = {
    "junction": 0.6,
    "public-entry": 0.5,
    "service-entry": 0.4,
    "stage-access": 0.5,
    "destination": 0.5,
    "audience-access": 0.3,
}
LANDING_SIDES = 12
LANDING_SNAP_RADIUS = 1.2


def landing_polygon(center, radius):
    return [
        (
            center[0] + radius * math.cos(math.tau * index / LANDING_SIDES),
            center[1] + radius * math.sin(math.tau * index / LANDING_SIDES),
        )
        for index in range(LANDING_SIDES)
    ]


def resolve_junction_landings():
    """Choose every node that earns a paved landing, sized to its widest route.

    Node positions and route endpoints are authored independently and disagree by
    up to half a metre in several places, so this matches by proximity rather
    than by an exact coordinate key. Keying exactly would have silently skipped
    the stage-west, central-lawn and overlook nodes, which are three of the
    places a landing matters most.
    """
    candidates = []
    for node in MASTERPLAN["circulation"]["nodes"]:
        margin = LANDING_NODE_MARGINS.get(node["kind"])
        if margin is None:
            continue
        position = node["position"]
        width = 0.0
        for path in MASTERPLAN["circulation"]["paths"]:
            for end in (path["centerline"][0], path["centerline"][-1]):
                if math.dist(position[:2], end[:2]) <= LANDING_SNAP_RADIUS:
                    width = max(width, path["width"])
        if width <= 0.0:
            continue
        candidates.append((width * 0.5 + margin, node, position))

    # Largest first, then drop any landing whose centre already falls inside one
    # that has been laid. Two overlapping pads a metre apart read as a single
    # lumpy blot, which is the artefact these are here to remove.
    accepted = []
    for radius, node, position in sorted(candidates, key=lambda item: -item[0]):
        if any(
            math.dist(position[:2], other[:2]) < other_radius
            for other_radius, other, _ in accepted
        ):
            continue
        accepted.append((radius, position, node))
    return accepted


def create_junction_landings(landings):
    for radius, position, node in landings:
        service = node["kind"] == "service-entry"
        create_surface_polygon(
            f"Landing_{node['id']}",
            landing_polygon(position, radius),
            PATH_SERVICE if service else PATH_PAVING,
            f"circulation-landing-{node['kind']}",
            metres_per_repeat=(
                PATH_SERVICE_REPEAT if service else PATH_PAVING_REPEAT
            ),
            core_tint=PATH_CORE_TINT,
            edge_tint=PATH_SHOULDER_TINT if service else PATH_EDGE_TINT,
        )


def create_path_edging(placements):
    """Merge every set edging stone into one mesh.

    Four hundred separate objects would each carry a node, a draw call and an
    optimizer pass for eighteen triangles of geometry. One mesh costs a single
    node and still reads as individual stones, because what the eye resolves at
    this size is the broken silhouette along the boundary rather than any one
    stone.
    """
    if not placements:
        return
    vertices = []
    faces = []
    tints = []
    sides = 6
    for index, (x, y, heading, arc_length, side) in enumerate(placements):
        wobble = math.sin(arc_length * 3.7 + side * 2.3 + index * 0.9)
        length = PATH_EDGING_LENGTH * (1.0 + 0.22 * wobble)
        width = PATH_EDGING_WIDTH * (1.0 - 0.18 * wobble)
        rise = PATH_EDGING_RISE * (1.0 + 0.3 * math.sin(index * 1.7))
        angle = heading + 0.14 * math.sin(index * 2.11)
        base = garden_ground_height(x, y) - PATH_EDGING_BURIAL
        first = len(vertices)
        for ring, height in ((0, base), (1, base + PATH_EDGING_BURIAL + rise)):
            taper = 1.0 if ring == 0 else 0.82
            for step in range(sides):
                theta = math.tau * step / sides
                local_x = math.cos(theta) * length * 0.5 * taper
                local_y = math.sin(theta) * width * 0.5 * taper
                vertices.append(
                    (
                        x + local_x * math.cos(angle) - local_y * math.sin(angle),
                        y + local_x * math.sin(angle) + local_y * math.cos(angle),
                        height,
                    )
                )
                tints.append((0.74, 0.74, 0.72) if ring else (0.42, 0.44, 0.40))
        for step in range(sides):
            following = (step + 1) % sides
            faces.append(
                (
                    first + step,
                    first + following,
                    first + sides + following,
                    first + sides + step,
                )
            )
        faces.append(tuple(first + sides + step for step in range(sides)))

    edging = link_object(
        "Path_Edging_Stones",
        add_vertex_tint(
            add_planar_uv(
                make_mesh(
                    "Blossom Path Edging Mesh",
                    vertices,
                    faces,
                    [PATH_EDGING],
                    smooth=False,
                ),
                metres_per_repeat=PATH_EDGING_REPEAT,
            ),
            tints,
        ),
    )
    edging["tka_role"] = "path-edging"
    edging["tka_edging_stone_count"] = len(placements)


def create_site_surfaces():
    landings = resolve_junction_landings()
    trim_zones = [(radius, position) for radius, position, _ in landings]
    edging_placements = []
    for path in MASTERPLAN["circulation"]["paths"]:
        if path["id"] == "bridge-crossing":
            continue
        create_path_ribbon(path, edging_placements, trim_zones)

    create_junction_landings(landings)
    create_path_edging(edging_placements)

    operations = MASTERPLAN["stage"]["operations"]
    create_rectangle_surface(
        "Operations_Backstage_Staging",
        operations["backstageStagingArea"],
        PATH_SERVICE,
        "backstage-staging",
        metres_per_repeat=PATH_SERVICE_REPEAT,
    )
    create_rectangle_surface(
        "Operations_Prop_Storage",
        operations["propStorageArea"],
        PATH_SERVICE,
        "prop-storage",
        metres_per_repeat=PATH_SERVICE_REPEAT,
    )
    create_rectangle_surface(
        "Operations_Technical_Position",
        operations["technicalPosition"],
        PATH_SERVICE,
        "technical-position",
        metres_per_repeat=PATH_SERVICE_REPEAT,
    )

    for landing_name, landing in (
        ("South", MASTERPLAN["bridge"]["southLanding"]),
        ("North", MASTERPLAN["bridge"]["northLanding"]),
    ):
        create_rectangle_surface(
            f"Bridge_{landing_name}_Landing",
            landing,
            PATH_PAVING,
            "bridge-landing",
            metres_per_repeat=PATH_PAVING_REPEAT,
            core_tint=PATH_CORE_TINT,
            edge_tint=PATH_EDGE_TINT,
        )


def create_stage():
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=5.25, depth=0.34, location=(0, 0, 0.17))
    base = bpy.context.active_object
    base.name = "Stage_Base"
    base["tka_stage_role"] = "base"
    base["tka_stage_surface_max"] = 0.34
    base.data.materials.append(CEDAR_DARK)
    for polygon in base.data.polygons:
        polygon.use_smooth = True

    bpy.ops.mesh.primitive_torus_add(
        major_radius=5.13,
        minor_radius=0.13,
        major_segments=48,
        minor_segments=8,
        location=(0, 0, STAGE_DECK_TOP - 0.13),
    )
    rim = bpy.context.active_object
    rim.name = "Stage_Rim"
    rim["tka_stage_role"] = "rim"
    rim["tka_stage_surface_max"] = STAGE_DECK_TOP
    rim.data.materials.append(CEDAR_LIGHT)

    vertices, faces, material_indices = [], [], []
    plank_depth = 0.72
    for index, y in enumerate([value * plank_depth for value in range(-6, 7)]):
        half_chord = math.sqrt(max(0.1, 5.0 ** 2 - y ** 2))
        before = len(faces)
        append_box(
            vertices,
            faces,
            (0, y, STAGE_DECK_TOP - 0.075),
            (half_chord * 2 - 0.09, plank_depth - 0.055, 0.15),
        )
        material_indices.extend([index % 2] * (len(faces) - before))
    plank_mesh = make_mesh(
        "Stage Cedar Plank Mesh",
        vertices,
        faces,
        [CEDAR, CEDAR_LIGHT],
        material_indices,
    )
    add_planar_uv(plank_mesh, metres_per_repeat=2.4)
    planks = link_object("Stage_Planks", plank_mesh)
    planks["tka_stage_role"] = "playable_deck"
    planks["tka_stage_deck_top"] = STAGE_DECK_TOP
    planks["tka_stage_surface_max"] = STAGE_DECK_TOP
    bevel = planks.modifiers.new("Hand-finished plank edges", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 2

    vertices, faces = [], []
    for x, y in ((-3.7, -2.7), (3.7, -2.7), (-3.7, 2.7), (3.7, 2.7), (0, -3.8), (0, 3.8)):
        append_cylinder(vertices, faces, (x, y, 0.02), 0.20, 0.16, 0.36, sides=10)
    feet = link_object("Stage_Feet", make_mesh("Stage Foot Mesh", vertices, faces, [CEDAR_DARK], smooth=True))
    feet["tka_stage_role"] = "supports"
    feet["tka_stage_surface_max"] = 0.20


def verify_stage_authoring_bounds():
    bpy.context.view_layer.update()
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    stage_maxima = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not obj.name.startswith("Stage_"):
            continue
        evaluated = obj.evaluated_get(dependency_graph)
        maximum = max((evaluated.matrix_world @ Vector(corner)).z for corner in evaluated.bound_box)
        stage_maxima[obj.name] = maximum

    deck_maximum = stage_maxima.get("Stage_Planks")
    if deck_maximum is None or abs(deck_maximum - STAGE_DECK_TOP) > 0.0001:
        raise RuntimeError(f"Stage deck top must be {STAGE_DECK_TOP:.3f}; got {deck_maximum}")
    too_high = {name: value for name, value in stage_maxima.items() if value > STAGE_DECK_TOP + 0.0001}
    if too_high:
        raise RuntimeError(f"Stage geometry exceeds the playable deck: {too_high}")

    print("Stage authoring bounds (Z-up):")
    for name, maximum in sorted(stage_maxima.items()):
        print(f"  {name}: max Z={maximum:.6f}")


ASSET_SOURCES = {}


def imported_asset_root(asset_id, path):
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Missing required Blossom source asset: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise RuntimeError(f"Blender imported no objects from {path}")
    root = bpy.data.objects.new(f"AssetSource_{asset_id}", None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)
    mesh_index = 0
    for obj in imported:
        if obj.type == "MESH":
            mesh_index += 1
            obj.data.name = f"Blossom {asset_id} Mesh {mesh_index}"
        if obj.parent not in imported_set:
            world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world
    return root


def asset_bounds(root):
    points = []
    for obj in root.children_recursive:
        if obj.type == "MESH":
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError(f"Asset {root.name} has no mesh bounds")
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def duplicate_hierarchy(source_root, name):
    mapping = {}
    ordered = [source_root, *source_root.children_recursive]
    for source in ordered:
        copy = source.copy()
        copy.data = source.data
        copy.name = name if source is source_root else f"{name}_{source.name}"
        bpy.context.scene.collection.objects.link(copy)
        mapping[source] = copy
    for source, copy in mapping.items():
        copy.parent = mapping.get(source.parent)
        copy.matrix_parent_inverse = source.matrix_parent_inverse.copy()
        copy.matrix_basis = source.matrix_basis.copy()
    return mapping[source_root]


def place_asset(source_root, name, position, target_height, rotation=0.0, mirror=False, width=1.0):
    root = duplicate_hierarchy(source_root, name)
    minimum, maximum = asset_bounds(source_root)
    height = max(0.001, maximum.z - minimum.z)
    scale = target_height / height
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    normalize = Matrix.Translation(Vector((-center_x, -center_y, -minimum.z)))
    root.matrix_world = (
        Matrix.Translation(Vector(position))
        @ Matrix.Rotation(rotation, 4, "Z")
        @ Matrix.Diagonal(Vector(((-scale * width if mirror else scale * width), scale, scale, 1.0)))
        @ normalize
    )
    for obj in root.children_recursive:
        if obj.type == "MESH":
            obj.visible_shadow = True
    return root


def tune_imported_asset_materials(source_root, label, roughness_floor):
    seen = set()
    for obj in source_root.children_recursive:
        if obj.type != "MESH":
            continue
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        for index, mat in enumerate(obj.data.materials):
            if mat is None or mat in seen:
                continue
            seen.add(mat)
            mat.name = f"Blossom {label} PBR {index + 1}"
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if not bsdf:
                continue
            metallic = bsdf.inputs.get("Metallic")
            roughness = bsdf.inputs.get("Roughness")
            emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            strength = bsdf.inputs.get("Emission Strength")
            if metallic and not metallic.is_linked:
                metallic.default_value = 0.0
            if roughness and not roughness.is_linked:
                roughness.default_value = max(roughness_floor, roughness.default_value)
            if emission:
                for link in list(emission.links):
                    mat.node_tree.links.remove(link)
                emission.default_value = (0.0, 0.0, 0.0, 1.0)
            if strength:
                strength.default_value = 0.0


def hide_source(root):
    root.hide_render = True
    root.hide_viewport = True
    for obj in root.children_recursive:
        obj.hide_render = True
        obj.hide_viewport = True


# Only two PlantFactory crowns have passed visual approval, against sixteen
# authored positions. Baking each crown into an upright and a leaning cut, and
# giving each cut its own canopy thinning, yields four distinct meshes; rotation,
# height and width then vary per placement. The masterplan still asks for ten
# distinct approved variants across four new families, so this is the honest
# floor, not the finished grove.
GROVE_VARIANTS = (
    {
        "id": "cherry-open-a",
        "candidateId": "open-crown-s19",
        "leanDegrees": 0.0,
        "leanAzimuth": 0.0,
        "canopyNoise": 0.22,
        "cardSeed": 11,
    },
    {
        "id": "cherry-open-a-lean",
        "candidateId": "open-crown-s19",
        "leanDegrees": 7.5,
        "leanAzimuth": 34.0,
        "canopyNoise": 0.55,
        "cardSeed": 29,
    },
    {
        "id": "cherry-open-b",
        "candidateId": "open-crown-s71",
        "leanDegrees": 0.0,
        "leanAzimuth": 0.0,
        "canopyNoise": 0.20,
        "cardSeed": 47,
    },
    {
        "id": "cherry-open-b-lean",
        "candidateId": "open-crown-s71",
        "leanDegrees": 6.2,
        "leanAzimuth": 205.0,
        "canopyNoise": 0.50,
        "cardSeed": 83,
    },
)
GROVE_FOLIAGE_KEEP = 0.24
GROVE_FOLIAGE_CARD_GAIN = 1.9
GROVE_WOOD_DECIMATE = 0.34
GROVE_TRUNK_SINK = 0.12
GROVE_PATH_CLEARANCE = 0.5

# Sixteen hero trees on a 30-48 m ring do not enclose anything; they read as
# scattered specimens with sky between them. The masterplan asks for a midground
# and a horizon layer behind them, which is what turns the ring into a grove.
# Those layers are never seen up close, so each tier drops most of its remaining
# leaf cards and collapses more of its branches. The reductions compound on top
# of the hero tier, so the far tier keeps roughly 3% of the original canopy.
GROVE_LOD_TIERS = {
    "hero": {"suffix": "", "relativeKeep": 1.0, "cardGain": 1.0, "woodRatio": 1.0},
    "mid": {"suffix": "-mid", "relativeKeep": 0.34, "cardGain": 1.7, "woodRatio": 0.45},
    "far": {"suffix": "-far", "relativeKeep": 0.13, "cardGain": 2.7, "woodRatio": 0.22},
}
GROVE_BACKGROUND_LAYERS = (
    {
        "id": "midground-grove",
        "tier": "mid",
        "count": 36,
        "band": (42.0, 78.0),
        "heightRange": (7.0, 11.5),
    },
    {
        "id": "horizon-grove",
        "tier": "far",
        "count": 72,
        # The masterplan band runs to 148 m, past the authored terrain edge.
        # Clamping to 132 m keeps every trunk on ground that actually exists.
        "band": (76.0, 132.0),
        "heightRange": (6.5, 12.5),
    },
)
GROVE_BACKGROUND_SPACING = 5.5
GROVE_BACKGROUND_SEED = 20260825


def resolve_grove_plan():
    """Turn the masterplan's authored positions into placeable instances.

    Variants cycle around the authored ring, and sixteen positions over four
    variants means no two neighbours ever share a mesh, including across the
    wrap from the last position back to the first.
    """
    trees = []
    for index, tree in enumerate(MASTERPLAN["grove"]["trees"]):
        x, y = tree["position"]
        variant = GROVE_VARIANTS[index % len(GROVE_VARIANTS)]
        trees.append(
            {
                "id": tree["id"],
                "candidateId": variant["id"],
                "authoredSlot": tree["variantSlot"],
                "position": (
                    x,
                    y,
                    garden_ground_height(x, y) - GROVE_TRUNK_SINK,
                ),
                "height": tree["height"],
                "width": clamp(
                    tree["canopyRadius"] / (0.52 * tree["height"]), 0.82, 1.30
                ),
                "rotationDegrees": (index * 47.0) % 360.0,
                "trunkRadius": tree["trunkRadius"],
            }
        )
    return trees


def resolve_background_grove(hero_trees):
    """Scatter the midground and horizon layers behind the hero ring.

    Placement is rejection-sampled against the same site contract the hero ring
    answers to, plus a spacing test against everything already placed, so the
    layers never overlap each other or a hero crown. The seeded generator keeps
    a rebuild identical.
    """
    rng = random.Random(GROVE_BACKGROUND_SEED)
    bounds = MASTERPLAN["site"]["terrainBounds"]
    margin = 6.0
    occupied = [(tree["position"][0], tree["position"][1]) for tree in hero_trees]
    placements = []

    for layer in GROVE_BACKGROUND_LAYERS:
        inner, outer = layer["band"]
        minimum_height, maximum_height = layer["heightRange"]
        placed = 0
        attempts = 0
        attempt_budget = layer["count"] * 600
        while placed < layer["count"] and attempts < attempt_budget:
            attempts += 1
            angle = rng.uniform(0.0, math.tau)
            # Sampling the squared radius keeps the ring evenly covered instead
            # of crowding the inner edge.
            radius = math.sqrt(rng.uniform(inner * inner, outer * outer))
            x = math.cos(angle) * radius
            y = math.sin(angle) * radius
            if not bounds["minX"] + margin <= x <= bounds["maxX"] - margin:
                continue
            if not bounds["minY"] + margin <= y <= bounds["maxY"] - margin:
                continue
            if path_distance(x, y) < 1.6:
                continue
            if river_surface_distance(x, y) < 2.5:
                continue
            if any(
                math.dist((x, y), point) < GROVE_BACKGROUND_SPACING
                for point in occupied
            ):
                continue

            variant = GROVE_VARIANTS[len(placements) % len(GROVE_VARIANTS)]
            occupied.append((x, y))
            placements.append(
                {
                    "id": f"{layer['id']}-{placed:03d}",
                    "layerId": layer["id"],
                    "candidateId": f"{variant['id']}{GROVE_LOD_TIERS[layer['tier']]['suffix']}",
                    "position": (x, y, garden_ground_height(x, y) - GROVE_TRUNK_SINK),
                    "height": rng.uniform(minimum_height, maximum_height),
                    "width": rng.uniform(0.85, 1.25),
                    "rotationDegrees": rng.uniform(0.0, 360.0),
                }
            )
            placed += 1

        if placed < layer["count"]:
            raise RuntimeError(
                f"Background layer {layer['id']} placed only {placed} of "
                f"{layer['count']} trees within the site contract"
            )
        print(f"  {layer['id']}: {placed} trees in {attempts} attempts")

    return placements


def verify_grove_clearances(trees):
    """Refuse to plant a tree in a walkway, the channel, or the audience lawn.

    A trunk standing in a path is the defect that got the previous composition
    boards rejected. Distance is measured against the whole polyline rather than
    its control points, so a tree cannot slip through mid-segment.
    """
    problems = []
    for tree in trees:
        x, y, _ = tree["position"]
        trunk = tree["trunkRadius"]
        path_clearance = path_distance(x, y) - trunk
        if path_clearance < GROVE_PATH_CLEARANCE:
            problems.append(
                f"{tree['id']} leaves {path_clearance:.2f} m to the nearest path edge"
            )
        river_clearance = river_surface_distance(x, y) - trunk
        if river_clearance < 0.4:
            problems.append(
                f"{tree['id']} leaves {river_clearance:.2f} m to the river surface"
            )
        for zone in MASTERPLAN["audience"]["zones"]:
            if point_in_polygon(x, y, zone["polygon"]):
                problems.append(f"{tree['id']} stands inside audience zone {zone['id']}")
    if problems:
        raise RuntimeError(
            "Grove placement violates the site contract:\n  " + "\n  ".join(problems)
        )
    print(f"Grove clearances verified for {len(trees)} trees")


def reduce_foliage_cards(obj, foliage_slots, keep_ratio, card_gain, seed):
    """Thin a PlantFactory canopy down to a real-time card budget.

    Each approved crown ships roughly a hundred thousand leaf cards. Sixteen of
    those is several million triangles for the grove alone, and a generic
    simplifier cannot help: collapsing cutout cards welds neighbouring blossoms
    into shards. Dropping whole cards and enlarging the survivors about their own
    centres preserves canopy coverage and silhouette at a fraction of the cost.

    Cards are recovered by unioning vertices that share a face, so the routine
    does not assume anything about vertex ordering in the imported file. Keying
    the keep/drop decision on a quantised card centroid keeps a rebuild
    reproducible, and mixing the seed in gives each variant a different canopy.
    """
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    parent = list(range(len(bm.verts)))

    def find(node):
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(first, second):
        first_root, second_root = find(first), find(second)
        if first_root != second_root:
            parent[second_root] = first_root

    foliage_faces = [
        face for face in bm.faces if face.material_index in foliage_slots
    ]
    for face in foliage_faces:
        indices = [vertex.index for vertex in face.verts]
        for other in indices[1:]:
            union(indices[0], other)

    cards = {}
    for face in foliage_faces:
        cards.setdefault(find(face.verts[0].index), []).append(face)

    doomed = []
    kept = 0
    for card_faces in cards.values():
        card_vertices = {vertex for face in card_faces for vertex in face.verts}
        centroid = Vector((0.0, 0.0, 0.0))
        for vertex in card_vertices:
            centroid += vertex.co
        centroid /= len(card_vertices)
        key = (
            int(centroid.x * 97.0) * 73856093
            ^ int(centroid.y * 97.0) * 19349663
            ^ int(centroid.z * 97.0) * 83492791
            ^ seed * 2654435761
        )
        if ((key >> 7) & 0xFFFF) / 65535.0 > keep_ratio:
            doomed.extend(card_faces)
            continue
        kept += 1
        for vertex in card_vertices:
            vertex.co = centroid + (vertex.co - centroid) * card_gain

    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return kept, len(cards)


def decimate_wood(obj, wood_slots, ratio):
    """Collapse the branch mesh only, leaving foliage cards untouched.

    The crowns arrive as a single mesh with a foliage slot and a wood slot, so a
    plain Decimate would shred the cards. Weighting the modifier by a wood-only
    vertex group confines the collapse to the branches.
    """
    mesh = obj.data
    wood_vertices = set()
    for polygon in mesh.polygons:
        if polygon.material_index in wood_slots:
            wood_vertices.update(polygon.vertices)
    if not wood_vertices:
        return

    group = obj.vertex_groups.new(name="Wood")
    group.add(sorted(wood_vertices), 1.0, "REPLACE")
    modifier = obj.modifiers.new("Branch decimation", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.vertex_group = group.name
    modifier.vertex_group_factor = 1.0
    modifier.use_collapse_triangulate = True

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Applying the modifier rebuilds the object's deform-group table, so the
    # handle taken above no longer resolves. Re-look it up before removing.
    applied_group = obj.vertex_groups.get("Wood")
    if applied_group is not None:
        obj.vertex_groups.remove(applied_group)


def sculpt_grove_variant(obj, lean_degrees, lean_azimuth_degrees, canopy_noise):
    """Lean and rough up a crown so repeated placements stop reading as copies.

    Lean and canopy displacement are baked into the mesh because they are the
    only variation a transform cannot express. Rotation, height and width stay
    per-instance so the exporter can still collapse placements to GPU instances.
    """
    mesh = obj.data
    if not mesh.vertices:
        return
    base = min(vertex.co.z for vertex in mesh.vertices)
    top = max(vertex.co.z for vertex in mesh.vertices)
    span = max(0.001, top - base)
    lean = math.tan(math.radians(lean_degrees))
    azimuth = math.radians(lean_azimuth_degrees)
    lean_x = math.cos(azimuth) * lean * span
    lean_y = math.sin(azimuth) * lean * span

    for vertex in mesh.vertices:
        amount = clamp((vertex.co.z - base) / span)
        bend = amount**1.4
        vertex.co.x += lean_x * bend
        vertex.co.y += lean_y * bend
        if canopy_noise <= 0.0 or amount <= 0.35:
            continue
        canopy = (amount - 0.35) / 0.65
        vertex.co.x += (
            canopy_noise * canopy * math.sin(vertex.co.z * 0.9 + vertex.co.y * 0.5)
        )
        vertex.co.y += (
            canopy_noise
            * canopy
            * math.sin(vertex.co.x * 0.7 - vertex.co.z * 1.1 + 2.1)
        )
        vertex.co.z += (
            canopy_noise
            * 0.45
            * canopy
            * math.sin(vertex.co.x * 0.6 + vertex.co.y * 0.8)
        )
    mesh.update()


def build_grove_variant(variant):
    # The shipped candidate is meshopt-compressed, which Blender cannot import.
    # The proof export carries identical geometry uncompressed, and compression
    # is the delivery pipeline's job anyway (optimize-blossom-glb.mjs re-applies
    # meshopt to the whole garden after export).
    source_path = os.path.join(
        PLANTFACTORY_CANDIDATE_DIR, f"{variant['candidateId']}-proof.glb"
    )
    root = imported_asset_root(variant["id"], source_path)
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        foliage_slots = {
            index
            for index, mat in enumerate(obj.data.materials)
            if mat and "Foliage" in mat.name
        }
        wood_slots = {
            index
            for index, mat in enumerate(obj.data.materials)
            if mat and "Wood" in mat.name
        }
        # Recorded on the mesh because tune_imported_asset_materials renames the
        # slots by index straight after this, and the distance tiers still need
        # to tell a leaf card from a branch.
        obj.data["tka_foliage_slots"] = sorted(foliage_slots)
        obj.data["tka_wood_slots"] = sorted(wood_slots)
        if foliage_slots:
            kept, total = reduce_foliage_cards(
                obj,
                foliage_slots,
                GROVE_FOLIAGE_KEEP,
                GROVE_FOLIAGE_CARD_GAIN,
                variant["cardSeed"],
            )
            print(f"  {variant['id']}: kept {kept}/{total} foliage cards")
        if wood_slots:
            decimate_wood(obj, wood_slots, GROVE_WOOD_DECIMATE)
        sculpt_grove_variant(
            obj,
            variant["leanDegrees"],
            variant["leanAzimuth"],
            variant["canopyNoise"],
        )
    tune_imported_asset_materials(root, f"Cherry {variant['id']}", 0.86)
    return root


def derive_grove_lod(source_root, variant, tier):
    """Cut a cheaper copy of an already-baked crown for a distance band.

    The copy takes its own mesh data so thinning it cannot reach back into the
    hero tier, and it reuses the hero's materials so the exporter still sees one
    texture set per crown.
    """
    label = f"{variant['id']}{tier['suffix']}"
    root = duplicate_hierarchy(source_root, f"AssetSource_{label}")

    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        # duplicate_hierarchy shares mesh data with the hero tier. Thinning a
        # shared mesh would strip the hero crowns too, so each tier takes its own.
        obj.data = obj.data.copy()
        obj.data.name = f"Blossom Cherry {label} Mesh"
        foliage_slots = set(obj.data.get("tka_foliage_slots", []))
        wood_slots = set(obj.data.get("tka_wood_slots", []))
        if foliage_slots:
            kept, total = reduce_foliage_cards(
                obj,
                foliage_slots,
                tier["relativeKeep"],
                tier["cardGain"],
                variant["cardSeed"] + 7,
            )
            print(f"  {label}: kept {kept}/{total} foliage cards")
        if wood_slots:
            decimate_wood(obj, wood_slots, tier["woodRatio"])

    return root


def load_asset_sources():
    sources = {
        "lantern": imported_asset_root("KasugaLantern", os.path.join(SOURCE_ASSET_DIR, "kasuga-lantern_raw.glb")),
    }
    tune_imported_asset_materials(
        sources["lantern"], "Kasuga Lantern", 0.90
    )
    print("Baking grove variants from the approved PlantFactory crowns:")
    for variant in GROVE_VARIANTS:
        hero = build_grove_variant(variant)
        sources[variant["id"]] = hero
        for tier_name, tier in GROVE_LOD_TIERS.items():
            if tier_name == "hero":
                continue
            sources[f"{variant['id']}{tier['suffix']}"] = derive_grove_lod(
                hero, variant, tier
            )
    return sources


def create_grove():
    for tree in COMPOSITION_PLAN["trees"]:
        candidate_id = tree["candidateId"]
        x, y, z = tree["position"]
        place_asset(
            ASSET_SOURCES[candidate_id],
            f"PlantFactory_{tree['id']}",
            (x, y, z),
            tree["height"],
            math.radians(tree["rotationDegrees"]),
            False,
            tree["width"],
        )
    # The backdrop carries its own name prefix so the composition contract keeps
    # counting the authored hero ring rather than the scatter behind it.
    for tree in COMPOSITION_PLAN["backgroundTrees"]:
        x, y, z = tree["position"]
        place_asset(
            ASSET_SOURCES[tree["candidateId"]],
            f"GroveBackdrop_{tree['id']}",
            (x, y, z),
            tree["height"],
            math.radians(tree["rotationDegrees"]),
            False,
            tree["width"],
        )


def create_torii():
    plan = COMPOSITION_PLAN["torii"]
    origin_x, origin_y = plan["center"]
    ground_z = 0.12
    width_scale = plan["width"] / 10.35
    height_scale = plan["height"] / 6.40
    radial_scale = min(width_scale, height_scale)
    vertices, faces, indices = [], [], []
    for local_x in (-3.0, 3.0):
        before = len(faces)
        append_cylinder(
            vertices,
            faces,
            (local_x * width_scale, 0, 2.95 * height_scale),
            0.42 * radial_scale,
            0.31 * radial_scale,
            5.9 * height_scale,
            sides=12,
        )
        indices.extend([0] * (len(faces) - before))
    for local_center, local_size, rotation in (
        ((0, 11.7, 5.05), (7.2, 0.48, 0.42), (0, 0, 0)),
        ((0, 11.7, 6.00), (8.6, 0.62, 0.48), (0, 0, 0)),
        ((-4.55, 11.7, 6.18), (1.25, 0.62, 0.42), (0, -0.14, 0)),
        ((4.55, 11.7, 6.18), (1.25, 0.62, 0.42), (0, 0.14, 0)),
    ):
        center = (
            local_center[0] * width_scale,
            0,
            local_center[2] * height_scale,
        )
        size = (
            local_size[0] * width_scale,
            local_size[1] * radial_scale,
            local_size[2] * height_scale,
        )
        before = len(faces)
        append_box(vertices, faces, center, size, rotation)
        indices.extend([0] * (len(faces) - before))
    for local_x in (-3.0, 3.0):
        before = len(faces)
        append_cylinder(
            vertices,
            faces,
            (local_x * width_scale, 0, 0.28 * height_scale),
            0.58 * radial_scale,
            0.50 * radial_scale,
            0.56 * height_scale,
            sides=12,
        )
        indices.extend([1] * (len(faces) - before))
    link_object(
        "Torii_Gate",
        make_mesh("Torii Gate Mesh", vertices, faces, [TORII, TORII_DARK], indices, smooth=True),
        (origin_x, origin_y, ground_z),
        (0, 0, math.radians(plan["rotationDegrees"])),
    )


def create_river_and_bridge():
    water_plan = COMPOSITION_PLAN["water"]
    # Ground and water share one contract: the terrain carves a channel below
    # this height, so the ribbon reads as water contained by banks from every
    # orbit instead of a blue mesh laid over unrelated terrain.
    water_height = GROUND_PLAN["terrain"]["riverWaterHeight"]
    course = river_course()
    centerline = [Vector((x, y, water_height)) for x, y in course["stations"]]
    arcs = course["arcs"]

    def water_half_width(point, arc_length):
        half_width = river_half_width(arc_length)
        for widening in water_plan["localWidenings"]:
            distance = math.hypot(
                point.x - widening["center"][0],
                point.y - widening["center"][1],
            )
            widening_half_width = math.sqrt(
                max(0.0, widening["surfaceRadius"] ** 2 - distance**2)
            )
            half_width = max(half_width, widening_half_width)
        return half_width

    vertices = []
    tints = []
    for index, point in enumerate(centerline):
        previous = centerline[max(0, index - 1)]
        following = centerline[min(len(centerline) - 1, index + 1)]
        tangent = (following - previous).normalized()
        normal = Vector((-tangent.y, tangent.x, 0))
        edge_softening = 0.94 + 0.06 * math.sin(index * 1.73 + 0.35)
        half_width = water_half_width(point, arcs[index]) * edge_softening
        for offset, tint, drop in WATER_SECTION:
            vertices.append(tuple(point + normal * half_width * offset + Vector((0, 0, drop))))
            tints.append(tint)

    columns = len(WATER_SECTION)
    faces = []
    for index in range(len(centerline) - 1):
        base = index * columns
        for column in range(columns - 1):
            faces.append(
                (
                    base + column,
                    base + column + 1,
                    base + columns + column + 1,
                    base + columns + column,
                )
            )
    water = link_object(
        "River_Water",
        add_vertex_tint(
            make_mesh("Moonlit River Mesh", vertices, faces, [WATER], smooth=True),
            tints,
        ),
    )
    water.visible_shadow = False
    water["tka_role"] = "blossom-water-surface"
    water["tka_water_plan"] = MASTERPLAN["water"]["id"]
    water["tka_surface_elevation"] = water_height

    bridge_plan = COMPOSITION_PLAN["bridge"]
    bridge_x, bridge_y = bridge_plan["center"]
    bridge_width = bridge_plan["width"]
    bridge_length = bridge_plan["length"]
    bridge_rotation = math.radians(bridge_plan["rotationDegrees"])

    def bridge_point(local_x, local_y, z):
        return (
            bridge_x + math.cos(bridge_rotation) * local_x - math.sin(bridge_rotation) * local_y,
            bridge_y + math.sin(bridge_rotation) * local_x + math.cos(bridge_rotation) * local_y,
            z,
        )

    node_by_id = {
        node["id"]: node for node in MASTERPLAN["circulation"]["nodes"]
    }
    south_z = node_by_id["south-bridge-landing"]["position"][2]
    north_z = node_by_id["north-bridge-landing"]["position"][2]
    slope_angle = math.atan2(north_z - south_z, bridge_length)
    vertices, faces, indices = [], [], []
    plank_count = 20
    for index in range(plank_count):
        t = index / (plank_count - 1)
        local_y = -bridge_length * 0.5 + bridge_length * t
        z = south_z + (north_z - south_z) * t + 0.09
        before = len(faces)
        append_box(
            vertices,
            faces,
            bridge_point(0, local_y, z),
            (bridge_width, bridge_length / plank_count * 0.88, 0.16),
            (slope_angle, 0, bridge_rotation),
        )
        indices.extend([index % 2] * (len(faces) - before))
    bridge = link_object(
        "Bridge_Planks",
        add_planar_uv(
            make_mesh("Arched Bridge Plank Mesh", vertices, faces, [CEDAR, CEDAR_LIGHT], indices),
            metres_per_repeat=1.8,
        ),
    )
    bridge["tka_role"] = "accessible-bridge-deck"
    bridge["tka_bridge_slope_percent"] = round(
        abs(north_z - south_z) / bridge_length * 100, 3
    )
    bevel = bridge.modifiers.new("Bridge plank edges", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 2

    vertices, faces = [], []
    for side_x in (-bridge_width * 0.5, bridge_width * 0.5):
        points = []
        for index in range(7):
            t = index / 6
            local_y = -bridge_length * 0.5 + 0.12 + (bridge_length - 0.24) * t
            deck_z = south_z + (north_z - south_z) * t + 0.09
            z = deck_z + 0.92
            point = bridge_point(side_x, local_y, z)
            points.append(point)
            append_tapered_segment(
                vertices,
                faces,
                bridge_point(side_x, local_y, deck_z),
                point,
                0.075,
                0.065,
                sides=7,
            )
        for index in range(len(points) - 1):
            append_tapered_segment(vertices, faces, points[index], points[index + 1], 0.075, 0.075, sides=7)
    rails = link_object(
        "Bridge_Rails",
        make_mesh(
            "Accessible Bridge Rail Mesh",
            vertices,
            faces,
            [CEDAR_DARK],
            smooth=True,
        ),
    )
    rails["tka_role"] = "bridge-guardrail"


LANTERN_PLACEMENTS = tuple(
    (
        lantern["position"][0],
        lantern["position"][1],
        lantern["position"][2],
        -0.34 + index * 0.47,
        lantern["height"],
    )
    for index, lantern in enumerate(COMPOSITION_PLAN["lanterns"])
)


def create_lanterns():
    glow_vertices, glow_faces = [], []
    append_box(glow_vertices, glow_faces, (0, 0, 0), (0.42, 0.42, 0.38))
    glow_mesh = make_mesh("Stone Lantern Glow Mesh", glow_vertices, glow_faces, [LANTERN_GLOW])
    for index, (x, y, z, rotation, height) in enumerate(LANTERN_PLACEMENTS):
        place_asset(
            ASSET_SOURCES["lantern"],
            f"KasugaLantern_{index + 1:02d}",
            (x, y, z),
            height,
            rotation,
            index % 2 == 1,
            1.0,
        )
        link_object(
            f"LanternGlow_{index + 1:02d}",
            glow_mesh,
            (x, y, z + height * 0.70),
            (0, 0, rotation),
            (height / 2.3, height / 2.3, height / 2.3),
        )


def create_stepping_stones():
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.0, depth=0.18, location=(0, 0, -20))
    template = bpy.context.active_object
    template.name = "Path_Stone_Template"
    template.data.name = "Stepping Stone Mesh"
    template.data.materials.append(STONE)
    for polygon in template.data.polygons:
        polygon.use_smooth = True
    bpy.data.objects.remove(template, do_unlink=True)
    mesh = bpy.data.meshes["Stepping Stone Mesh"]
    placements = (
        (4.2, 5.7),
        (4.7, 6.8),
        (5.2, 7.9),
        (5.7, 9.0),
        (6.1, 10.1),
        (6.45, 11.2),
        (6.75, 12.3),
        (6.95, 13.35),
        (7.1, 14.35),
    )
    for index, (x, y) in enumerate(placements):
        scale = 0.46 + 0.035 * math.sin(index * 2.0)
        link_object(f"Path_Stone_{index + 1:02d}", mesh, (x, y, 0.18), (0.03, 0.04, index * 0.38), (scale * 1.30, scale, 0.72))


def create_ground_details():
    for index, island in enumerate(COMPOSITION_PLAN["ecologyIslands"]):
        x, y = island["center"]
        height = 0.86 + 0.08 * (index % 3)
        width = island["radiusX"] / max(1.0, island["radiusY"])
        place_asset(
            ASSET_SOURCES["ecology"],
            f"GardenEcology_{index + 1:02d}",
            (x, y, 0.08),
            height,
            0.31 + index * 0.91,
            index % 2 == 1,
            width,
        )


def create_petal_carpet_and_grass():
    """Root petals and authored meadow colonies into the continuous terrain."""
    petal_vertices, petal_faces, petal_indices = [], [], []

    def append_petal(center, length, width, angle, material_index):
        cx, cy, cz = center
        forward = Vector((math.cos(angle), math.sin(angle), 0))
        side = Vector((-forward.y, forward.x, 0))
        center_v = Vector((cx, cy, cz))
        tip = center_v + forward * (length * 0.58) + Vector((0, 0, length * 0.035))
        heel = center_v - forward * (length * 0.42)
        left = center_v + side * (width * 0.5)
        right = center_v - side * (width * 0.5)
        start = len(petal_vertices)
        petal_vertices.extend((tuple(tip), tuple(left), tuple(heel), tuple(right)))
        petal_faces.extend(((start, start + 1, start + 2), (start, start + 2, start + 3)))
        petal_indices.extend((material_index, material_index))

    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    # Petals caught in the meadow, path edges, and tree litter beyond the deck.
    for index in range(360):
        radius = 5.65 + ((index * 71) % 997) / 997 * 12.4
        angle = index * golden_angle + math.sin(index * 1.71) * 0.18
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius * 0.82
        ground_height = garden_ground_height(x, y)
        length = 0.105 + 0.07 * (0.5 + 0.5 * math.sin(index * 2.37))
        width = length * (0.42 + 0.12 * math.sin(index * 1.13))
        append_petal(
            (x, y, ground_height + 0.014),
            length,
            width,
            angle * 1.7 + index * 0.43,
            0 if index % 7 < 3 else 1 if index % 7 < 6 else 2,
        )

    # A restrained scatter on the stage catches the lantern and moon keys and
    # visually ties the performer surface back into the garden.
    for index in range(54):
        radius = 0.45 + ((index * 43) % 211) / 211 * 4.25
        angle = index * golden_angle + 0.31
        append_petal(
            (math.cos(angle) * radius, math.sin(angle) * radius, STAGE_DECK_TOP + 0.012),
            0.11 + 0.035 * (index % 4),
            0.052 + 0.008 * (index % 3),
            angle * 0.6 + index,
            0 if index % 5 < 2 else 1,
        )

    petals = link_object(
        "Fallen_Petal_Carpet",
        make_mesh(
            "Fallen Petal Carpet Mesh",
            petal_vertices,
            petal_faces,
            [PETAL_IVORY, PETAL_BLUSH, PETAL_SHADOW],
            petal_indices,
        ),
    )
    petals.visible_shadow = False

    create_grass_ecosystem()


def rotated_ellipse_sample(rng, patch):
    angle = rng.uniform(0.0, math.tau)
    radius = math.sqrt(rng.random())
    local_x = math.cos(angle) * patch["radii"][0] * radius
    local_y = math.sin(angle) * patch["radii"][1] * radius
    rotation = math.radians(patch["rotationDegrees"])
    return (
        patch["center"][0] + math.cos(rotation) * local_x - math.sin(rotation) * local_y,
        patch["center"][1] + math.sin(rotation) * local_x + math.cos(rotation) * local_y,
    )


def inside_rotated_rectangle(x, y, center, half_size, rotation_degrees=0.0):
    offset_x = x - center[0]
    offset_y = y - center[1]
    rotation = math.radians(-rotation_degrees)
    local_x = math.cos(rotation) * offset_x - math.sin(rotation) * offset_y
    local_y = math.sin(rotation) * offset_x + math.cos(rotation) * offset_y
    return abs(local_x) <= half_size[0] and abs(local_y) <= half_size[1]


def grass_position_allowed(x, y):
    ellipse = GROUND_PLAN["terrain"]["edgeEllipse"]
    normalized_edge = (x / (ellipse["radiusX"] - 0.7)) ** 2 + (
        (y - ellipse["centerY"]) / (ellipse["radiusY"] - 0.7)
    ) ** 2
    if normalized_edge >= 1.0:
        return False

    exclusions = GROUND_PLAN["exclusions"]
    if inside_rotated_rectangle(x, y, (0.0, 0.0), exclusions["stageHalfSize"]):
        return False
    if path_distance(x, y) <= exclusions["pathMargin"]:
        return False
    # Measured from the water's edge, so the run-out's wider section and the
    # koi pools push grass back the same way the authored reach does.
    if river_surface_distance(x, y) <= (
        exclusions["waterMargin"] + exclusions["grassFootprintRadius"]
    ):
        return False

    bridge = COMPOSITION_PLAN["bridge"]
    if inside_rotated_rectangle(
        x,
        y,
        bridge["center"],
        exclusions["bridgeHalfSize"],
        bridge["rotationDegrees"],
    ):
        return False

    for tree in COMPOSITION_PLAN["trees"]:
        if math.hypot(x - tree["position"][0], y - tree["position"][1]) < 1.1:
            return False
    for lantern in COMPOSITION_PLAN["lanterns"]:
        if math.hypot(x - lantern["position"][0], y - lantern["position"][1]) < 0.72:
            return False
    torii_x, torii_y = COMPOSITION_PLAN["torii"]["center"]
    if abs(y - torii_y) < 1.0 and abs(x - torii_x) < 6.2:
        return False
    return True


def grass_tier_targets(count):
    tiers = GROUND_PLAN["qualityTiers"]
    base_count = round(count * tiers["baseFraction"])
    medium_count = round(count * tiers["mediumFraction"])
    return {
        "Base": base_count,
        "Medium": medium_count,
        "High": count - base_count - medium_count,
    }


def make_grass_prototype(tier, palette, habitat_form, prototype_index, rng):
    tier_rules = {
        "Base": {
            "blades": (14, 18),
            "radius": (0.11, 0.18),
            "forms": (("basal", 0.48), ("fine", 0.36), ("broad", 0.16)),
        },
        "Medium": {
            "blades": (18, 24),
            "radius": (0.14, 0.22),
            "forms": (("basal", 0.24), ("fine", 0.30), ("broad", 0.30), ("arching", 0.16)),
        },
        "High": {
            "blades": (24, 31),
            "radius": (0.17, 0.27),
            "forms": (
                ("basal", 0.10),
                ("fine", 0.24),
                ("broad", 0.30),
                ("arching", 0.25),
                ("seed", 0.11),
            ),
        },
    }
    palette_height = {"deep": 0.90, "living": 1.04, "moonlit": 0.96, "damp": 1.12}[palette]
    rules = tier_rules[tier]
    form_names = [item[0] for item in rules["forms"]]
    form_weights = [item[1] for item in rules["forms"]]
    vertices, faces, vertex_uvs = [], [], []
    blade_count = rng.randint(*rules["blades"])
    colony_radius = rng.uniform(*rules["radius"])
    forms_used = set()
    for _blade_index in range(blade_count):
        offset_angle = rng.uniform(0.0, math.tau)
        offset_radius = math.sqrt(rng.random()) * colony_radius
        root_x = math.cos(offset_angle) * offset_radius
        root_y = math.sin(offset_angle) * offset_radius
        yaw = rng.uniform(0.0, math.tau)
        form = rng.choices(form_names, weights=form_weights, k=1)[0]
        if habitat_form == "bank" and rng.random() < 0.16:
            form = "seed" if tier == "High" else "arching"
        forms_used.add(form)
        lean_angle = yaw + rng.uniform(-0.62, 0.62)
        if form == "basal":
            width = rng.uniform(0.010, 0.021)
            height = rng.uniform(0.075, 0.16) * palette_height
            lean = height * rng.uniform(0.52, 0.92)
        elif form == "broad":
            width = rng.uniform(0.016, 0.031)
            height = rng.uniform(0.14, 0.30) * palette_height
            lean = height * rng.uniform(0.34, 0.68)
        elif form == "arching":
            width = rng.uniform(0.008, 0.016)
            height = rng.uniform(0.27, 0.50) * palette_height
            lean = height * rng.uniform(0.30, 0.54)
        elif form == "seed":
            width = 0.0045
            height = rng.uniform(0.44, 0.68) * palette_height
            lean = height * rng.uniform(0.08, 0.18)
        else:
            width = rng.uniform(0.0065, 0.0135)
            height = rng.uniform(0.12, 0.31) * palette_height
            lean = height * rng.uniform(0.14, 0.36)

        if form == "seed":
            append_meadow_seed_head(
                vertices,
                faces,
                vertex_uvs,
                root_x,
                root_y,
                0.0,
                yaw,
                height,
                lean_angle,
                lean,
            )
        else:
            append_meadow_blade(
                vertices,
                faces,
                vertex_uvs,
                root_x,
                root_y,
                0.0,
                yaw,
                width,
                height,
                lean_angle,
                lean,
            )

    mesh = bpy.data.meshes.new(
        f"Blossom Grass {tier} {palette.title()} {habitat_form.title()} "
        f"Prototype {prototype_index + 1} Mesh"
    )
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(GRASS_MATERIALS[palette])
    uv_layer = mesh.uv_layers.new(name="Blossom Grass Root Weight")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = vertex_uvs[vertex_index]
    mesh["tka_grass_blades"] = blade_count
    mesh["tka_grass_forms"] = "|".join(sorted(forms_used))
    return mesh, blade_count, forms_used


def create_grass_ecosystem():
    positions = []
    occupied = {}
    minimum_spacing = 0.34
    cell_size = minimum_spacing
    patch_counts = {}

    for patch_index, patch in enumerate(GROUND_PLAN["grassPatches"]):
        rng = random.Random(99173 + patch_index * 7919)
        accepted = []
        attempts = 0
        while len(accepted) < patch["count"] and attempts < patch["count"] * 100:
            attempts += 1
            x, y = rotated_ellipse_sample(rng, patch)
            if not grass_position_allowed(x, y):
                continue
            cell_x = math.floor(x / cell_size)
            cell_y = math.floor(y / cell_size)
            if any(
                (x - other_x) ** 2 + (y - other_y) ** 2 < minimum_spacing**2
                for neighbour_x in range(cell_x - 1, cell_x + 2)
                for neighbour_y in range(cell_y - 1, cell_y + 2)
                for other_x, other_y in occupied.get((neighbour_x, neighbour_y), ())
            ):
                continue
            occupied.setdefault((cell_x, cell_y), []).append((x, y))
            accepted.append((x, y))
        if len(accepted) != patch["count"]:
            raise RuntimeError(
                f"Grass patch {patch['id']} expected {patch['count']} clumps; "
                f"placed {len(accepted)} after {attempts} attempts"
            )

        rng.shuffle(accepted)
        offset = 0
        for tier, tier_count in grass_tier_targets(patch["count"]).items():
            for x, y in accepted[offset : offset + tier_count]:
                positions.append((tier, patch["palette"], patch["form"], patch["id"], x, y))
            offset += tier_count
        patch_counts[patch["id"]] = len(accepted)

    grouped = {}
    for tier, palette, habitat_form, patch_id, x, y in positions:
        grouped.setdefault((tier, palette, habitat_form), []).append((patch_id, x, y))

    tier_counts = {"Base": 0, "Medium": 0, "High": 0}
    total_blades = 0
    prototype_meshes = 0
    object_counter = 0
    for (tier, palette, habitat_form), group_positions in sorted(grouped.items()):
        rng = random.Random(
            71003
            + sum(ord(character) for character in f"{tier}:{palette}:{habitat_form}") * 101
        )
        prototypes = [
            make_grass_prototype(tier, palette, habitat_form, index, rng)
            for index in range(3)
        ]
        prototype_meshes += len(prototypes)
        for patch_id, x, y in group_positions:
            mesh, blade_count, forms_used = prototypes[rng.randrange(len(prototypes))]
            object_counter += 1
            grass = bpy.data.objects.new(
                f"Blossom_Grass_{tier}_{palette.title()}_{object_counter:04d}",
                mesh,
            )
            bpy.context.scene.collection.objects.link(grass)
            grass.location = (x, y, garden_ground_height(x, y) + 0.010)
            grass.rotation_euler.z = rng.uniform(0.0, math.tau)
            scale = rng.uniform(0.82, 1.18)
            grass.scale = (scale, scale * rng.uniform(0.88, 1.12), scale)
            grass.visible_shadow = False
            grass["tka_role"] = "blossom-ground-life"
            grass["tka_ground_plan"] = GROUND_PLAN["planId"]
            grass["tka_ground_quality_tier"] = tier.lower()
            grass["tka_ground_palette"] = palette
            grass["tka_grass_clumps"] = 1
            grass["tka_grass_blades"] = blade_count
            grass["tka_grass_forms"] = "|".join(sorted(forms_used))
            grass["tka_grass_patch_id"] = patch_id
            tier_counts[tier] += 1
            total_blades += blade_count

    GROUND_AUTHORING_STATS.update(
        {
            "grassClumps": len(positions),
            "grassBlades": total_blades,
            "grassPrototypeMeshes": prototype_meshes,
            "grassTierCounts": tier_counts,
            "grassPatchCounts": patch_counts,
            "minimumGrassRootWaterClearance": min(
                river_surface_distance(x, y)
                for _tier, _palette, _form, _patch_id, x, y in positions
            ),
        }
    )
    minimum_visible_clearance = (
        GROUND_AUTHORING_STATS["minimumGrassRootWaterClearance"]
        - GROUND_PLAN["exclusions"]["grassFootprintRadius"]
    )
    GROUND_AUTHORING_STATS["minimumGrassVisibleWaterClearance"] = (
        minimum_visible_clearance
    )

    ground = bpy.data.objects.get("Garden_Ground")
    if ground is None:
        raise RuntimeError("Continuous Blossom ground is missing before grass authoring")
    ground["tka_river_spline_subdivisions"] = GROUND_PLAN["terrain"][
        "riverSplineSubdivisions"
    ]
    ground["tka_grass_minimum_root_water_clearance"] = round(
        GROUND_AUTHORING_STATS["minimumGrassRootWaterClearance"], 4
    )
    ground["tka_grass_minimum_visible_water_clearance"] = round(
        minimum_visible_clearance, 4
    )


def verify_composition_authoring():
    # Blender defers child world-matrix evaluation after hierarchy placement.
    # Force one dependency-graph update before measuring the approved layout.
    bpy.context.view_layer.update()

    expected_counts = {
        "PlantFactory_": COMPOSITION_PLAN["densityBudget"]["majorTrees"],
        "GroveBackdrop_": COMPOSITION_PLAN["densityBudget"]["backdropTrees"],
        "KasugaLantern_": COMPOSITION_PLAN["densityBudget"]["lanterns"],
        "GardenEcology_": COMPOSITION_PLAN["densityBudget"]["ecologyIslands"],
    }
    for prefix, expected in expected_counts.items():
        roots = [
            obj
            for obj in bpy.data.objects
            if obj.type == "EMPTY" and obj.name.startswith(prefix)
        ]
        if len(roots) != expected:
            raise RuntimeError(
                f"Composition contract expected {expected} {prefix} roots; found {len(roots)}"
            )

    for required_object in (
        "Garden_Ground",
        "River_Water",
        "Bridge_Planks",
        "Bridge_Rails",
        "Torii_Gate",
    ):
        if bpy.data.objects.get(required_object) is None:
            raise RuntimeError(f"Missing composition object: {required_object}")

    for path in MASTERPLAN["circulation"]["paths"]:
        if path["id"] == "bridge-crossing":
            continue
        path_object = bpy.data.objects.get(f"Path_{path['id']}")
        if path_object is None:
            raise RuntimeError(f"Missing circulation path: {path['id']}")
        if abs(path_object["tka_path_width"] - path["width"]) > 0.001:
            raise RuntimeError(f"Circulation width drifted: {path['id']}")

    bridge = bpy.data.objects["Bridge_Planks"]
    if bridge["tka_bridge_slope_percent"] > 5.0:
        raise RuntimeError(
            f"Bridge exceeds accessible slope: {bridge['tka_bridge_slope_percent']}%"
        )

    ground = bpy.data.objects["Garden_Ground"]
    bounds = MASTERPLAN["site"]["terrainBounds"]
    for key, expected in (
        ("tka_terrain_min_x", bounds["minX"]),
        ("tka_terrain_max_x", bounds["maxX"]),
        ("tka_terrain_min_y", bounds["minY"]),
        ("tka_terrain_max_y", bounds["maxY"]),
    ):
        if abs(ground[key] - expected) > 0.001:
            raise RuntimeError(f"Terrain envelope drifted at {key}")

    forbidden_ground_names = {
        "Garden_Clearing",
        "Moon Garden Gravel Clearing Mesh",
        "Garden Grass Bank Mesh",
    }
    legacy_ground = sorted(
        name
        for name in forbidden_ground_names
        if bpy.data.objects.get(name) is not None or bpy.data.meshes.get(name) is not None
    )
    if legacy_ground:
        raise RuntimeError(f"Legacy Blossom ground remains authored: {legacy_ground}")

    grass_roots = [
        obj
        for obj in bpy.data.objects
        if obj.get("tka_role") == "blossom-ground-life"
    ]
    if grass_roots:
        raise RuntimeError(
            "Phase 2 spatial graybox must not contain decorative grass"
        )

    visible_legacy_trees = [
        obj.name
        for obj in bpy.data.objects
        if not obj.hide_render
        and (obj.name.startswith("HeroSakura_") or obj.name.startswith("WeepingSakura_"))
    ]
    if visible_legacy_trees:
        raise RuntimeError(f"Legacy Blossom trees remain visible: {visible_legacy_trees}")

    print("Composition contract verified:")
    for prefix, count in expected_counts.items():
        print(f"  {prefix}: {count}")
    print("  Protected major props: River_Water, Bridge_Planks, Bridge_Rails, Torii_Gate")
    print(f"  Continuous ground: Garden_Ground ({GROUND_PLAN['planId']})")
    print(f"  Audience zones: {len(MASTERPLAN['audience']['zones'])}")
    print(f"  Circulation paths: {len(MASTERPLAN['circulation']['paths'])}")
    print(
        f"  Grove variants baked from approved crowns: {len(GROVE_VARIANTS)}"
    )
    print("  Decorative grass: gated for later production phases")


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, color, energy, size, target=(0, 0, 2.5)):
    data = bpy.data.lights.new(name, "AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)


def setup_render():
    scene = bpy.context.scene
    # Blender 5 exposes the Eevee Next renderer under the stable EEVEE enum.
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = QA_PATH
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"

    world = bpy.data.worlds.new("Blossom Twilight")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.018, 0.055, 1.0)
    background.inputs["Strength"].default_value = 0.48
    scene.world = world

    add_area_light("Light_Stage_Warmth", (0, -8, 13), (1.0, 0.53, 0.32), 2850, 8.0, (0, 0, 0.4))
    add_area_light("Light_Moon_Fill", (10, 20, 23), (0.25, 0.38, 1.0), 2850, 12.0, (0, 7, 2.4))
    add_area_light("Light_Sunset_Rim", (-18, 26, 11), (1.0, 0.20, 0.16), 1550, 8.0, (0, 14, 4))
    for index, (x, y, z, _rotation, height) in enumerate(LANTERN_PLACEMENTS):
        data = bpy.data.lights.new(f"Light_Lantern_{index + 1:02d}", "POINT")
        data.color = (1.0, 0.31, 0.12)
        data.energy = 56 * height
        data.shadow_soft_size = 0.72
        light = bpy.data.objects.new(data.name, data)
        bpy.context.scene.collection.objects.link(light)
        light.location = (x, y, z + height * 0.70)

    camera_data = bpy.data.cameras.new("Camera_Blossom")
    camera = bpy.data.objects.new("Camera_Blossom", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera_plan = COMPOSITION_PLAN["defaultView"]
    camera.location = tuple(camera_plan["camera"])
    camera.data.lens = camera_plan["lensMm"]
    camera.data.sensor_width = 36
    aim_at(camera, tuple(camera_plan["target"]))
    scene.camera = camera

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    scene.render.image_settings.color_depth = "8"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    bpy.ops.render.render(write_still=True)


ASSET_SOURCES.update(load_asset_sources())
create_backdrop()
create_moon()
create_ground()
create_site_surfaces()
create_stage()
verify_stage_authoring_bounds()
create_river_and_bridge()
create_torii()
create_lanterns()
COMPOSITION_PLAN["trees"] = resolve_grove_plan()
COMPOSITION_PLAN["densityBudget"]["majorTrees"] = len(COMPOSITION_PLAN["trees"])
verify_grove_clearances(COMPOSITION_PLAN["trees"])
print("Scattering the backdrop layers behind the hero ring:")
COMPOSITION_PLAN["backgroundTrees"] = resolve_background_grove(
    COMPOSITION_PLAN["trees"]
)
COMPOSITION_PLAN["densityBudget"]["backdropTrees"] = len(
    COMPOSITION_PLAN["backgroundTrees"]
)
create_grove()
verify_composition_authoring()
for source in ASSET_SOURCES.values():
    hide_source(source)
setup_render()

print("\nBlossom environment authored successfully")
print(f"Editable source: {BLEND_PATH}")
print(f"QA render:       {QA_PATH}")
print(f"Mesh objects:    {sum(1 for obj in bpy.data.objects if obj.type == 'MESH')}")
print(f"Unique meshes:   {len(bpy.data.meshes)}")
print(f"Materials:       {len(bpy.data.materials)}")
