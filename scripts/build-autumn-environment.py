"""Author the Enchanted Autumn Dusk environment in Blender.

The scene is laid out as an ecology rather than a scatter pass. A protected
performance clearing, an irregular pond basin, tree and log footprints, and
rock footprints are used as explicit placement masks. Ferns grow in shaded
clusters, leaves collect in root and log drifts, and every shoreline object is
kept out of the water volume. The resulting editable ``.blend`` is the source
of truth; ``blender-export-autumn-full.py`` creates the clean runtime GLB.
"""

import math
import os
import random
import subprocess
import tempfile

import bpy
from mathutils import Matrix, Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MODEL_DIR = os.path.join(PROJECT_ROOT, "static", "models", "autumn")
AUTUMN_FLOOR_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "autumn-floor")
FOREST_FLOOR_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "forest-floor")
DIRT_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "terrain", "dirt")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "autumn_environment.blend")
QA_DIR = os.path.join(tempfile.gettempdir(), "tka-autumn-evidence")
QA_PATHS = {
    "hero": os.path.join(QA_DIR, "autumn_environment_qa.png"),
    "floor": os.path.join(QA_DIR, "autumn_environment_qa_floor.png"),
    "pond": os.path.join(QA_DIR, "autumn_environment_qa_pond.png"),
    "reverse": os.path.join(QA_DIR, "autumn_environment_qa_reverse.png"),
    "owl": os.path.join(QA_DIR, "autumn_environment_qa_owl.png"),
}

CLEARING_RADIUS = 6.5
POND_X = -10.5
POND_Y = -7.0
POND_RX = 4.45
POND_RY = 3.35
POND_SEED = 4.2
POND_WATER_HEIGHT = -0.32

TREE_PLACEMENTS = (
    ("HeroTreeA_01", "HeroA", -12.8, 6.5, 12.8, -0.20, 1.0, False, 2.55),
    ("HeroTreeA_02", "HeroA", 13.6, 8.5, 11.2, 2.48, 1.0, True, 2.35),
    # The back-center tree moves right to create a second, staggered sightline.
    ("HeroTreeA_03", "HeroA", 6.2, 18.3, 13.8, 3.03, 1.0, False, 2.75),
    ("HeroTreeA_04", "HeroA", -20.5, -0.4, 10.4, 0.72, 1.0, True, 2.25),
    ("HeroTreeB_01", "HeroB", -18.2, -9.2, 10.8, -0.58, 1.0, False, 2.45),
    ("HeroTreeB_02", "HeroB", 16.0, -6.8, 10.2, 1.08, 1.0, True, 2.30),
    ("HeroTreeB_03", "HeroB", -10.4, 16.8, 9.6, 2.66, 1.0, True, 2.20),
    ("HeroTreeB_04", "HeroB", 18.8, 13.0, 9.2, -2.20, 1.0, False, 2.15),
)

# A second, lower canopy tier closes the empty horizon without turning the
# performance clearing into a wall. Four deliberately different families form
# its rhythm: white birch clusters, bare snags, conical golden larches, and
# low drooping willows. The central gap remains open for the moon.
DISTANT_TREE_PLACEMENTS = (
    ("DistantBirch_01", "Birch", -26.0, 4.5, 7.8, -0.44, 0.94, False, 1.55),
    ("DistantLarch_01", "Larch", -24.2, 13.4, 8.8, 0.72, 1.02, True, 1.45),
    ("DistantSnag_01", "Snag", -20.0, 20.5, 9.5, -0.18, 1.0, False, 1.35),
    ("DistantWillow_01", "Willow", -13.8, 23.8, 7.8, 1.82, 0.96, False, 1.78),
    ("DistantSnag_02", "Snag", 2.4, 25.8, 8.0, 0.38, 0.92, True, 1.25),
    ("DistantBirch_02", "Birch", 10.2, 24.8, 8.9, -1.28, 1.04, True, 1.70),
    ("DistantSnag_03", "Snag", 17.8, 22.0, 9.2, 0.93, 0.96, False, 1.30),
    ("DistantWillow_02", "Willow", 23.2, 16.8, 7.9, 2.52, 1.0, False, 1.82),
    ("DistantSnag_04", "Snag", 26.4, 8.5, 9.4, -0.70, 1.02, True, 1.35),
    ("DistantLarch_02", "Larch", 26.0, -1.8, 8.0, 1.17, 0.93, True, 1.38),
    ("DistantBirch_03", "Birch", -26.2, -5.0, 7.5, -2.14, 0.92, False, 1.45),
    # Lower secondary crowns close the exposed terrain band while keeping the
    # tall-tree spacing and moon opening readable.
    ("DistantWillow_03", "Willow", -26.0, 17.2, 6.4, 0.42, 0.95, True, 1.52),
    ("DistantLarch_03", "Larch", -18.0, 25.5, 6.9, -1.62, 1.0, False, 1.18),
    ("DistantBirch_04", "Birch", -10.8, 26.0, 6.5, 2.18, 0.92, True, 1.22),
    ("DistantLarch_04", "Larch", 6.2, 26.5, 6.9, -0.82, 0.96, False, 1.18),
    ("DistantBirch_05", "Birch", 15.5, 25.0, 6.9, 1.42, 0.98, True, 1.28),
    ("DistantSnag_05", "Snag", 25.5, 18.0, 7.2, -2.34, 0.94, False, 1.18),
)

SAPLING_PLACEMENTS = (
    ("Sapling_01", -2.5, 13.5, 2.9, -0.34, False, 0.90),
    ("Sapling_02", 10.5, -12.2, 3.2, 1.52, True, 0.95),
    ("Sapling_03", -18.0, 8.5, 2.7, -1.05, False, 0.85),
    ("Sapling_04", 17.0, 17.5, 3.0, 2.42, True, 0.90),
)

LOG_PLACEMENTS = (
    ("FallenLog_01", 8.5, 7.0, 1.4, -0.42, 1.0, False, 2.6),
    ("FallenLog_02", -14.0, 13.0, 1.15, 1.33, 1.0, True, 2.35),
    ("FallenLog_03", 17.5, 1.5, 1.0, 0.32, 1.0, False, 2.15),
)

FERN_CLUSTERS = (
    (-15.6, 3.5, 4),
    (10.8, 5.3, 4),
    (-7.0, 13.1, 4),
    (9.7, 14.6, 4),
    (13.0, -3.0, 3),
    (-15.6, -3.0, 3),
    (-7.2, -10.5, 4),
    (-11.0, -2.7, 4),
    (7.3, -3.0, 4),
    (4.8, 7.7, 4),
    (-6.9, 5.4, 4),
    (2.8, 8.3, 4),
    (-3.2, -8.0, 4),
    (8.8, 1.8, 4),
)

MUSHROOM_RINGS = (
    ("FairyRing_East", 9.0, 1.0, 1.65, 9, 0.15),
    ("FairyRing_North", -4.8, 10.8, 1.45, 7, 0.63),
)

GRASS_COLONIES = (
    (-7.0, 5.5, 2.4, 1.5),
    (5.8, 6.9, 2.6, 1.5),
    (7.8, -3.4, 2.4, 1.7),
    (-3.8, -8.5, 2.8, 1.7),
    (1.5, 10.0, 3.2, 1.8),
    (11.8, 3.2, 2.8, 1.8),
    (-14.8, 2.2, 3.0, 2.0),
    (12.4, -9.7, 3.1, 1.9),
    (-7.0, 14.0, 2.9, 1.8),
    (15.3, 11.8, 2.6, 1.7),
    (-17.0, -5.2, 3.0, 1.8),
    (0.0, 17.0, 3.2, 1.8),
)

OWL_POSITION = (5.3, 17.55, 7.0)

MOSS_PATCHES = (
    ("MossPatch_01", -15.2, 4.1, 3.8, 2.4, 0.20, 2.0),
    ("MossPatch_02", 11.0, 5.5, 3.4, 2.0, -0.45, 3.0),
    ("MossPatch_03", -7.4, 13.6, 3.6, 2.2, 0.55, 4.0),
    ("MossPatch_04", 10.2, 14.8, 3.2, 1.8, -0.20, 5.0),
    ("MossPatch_05", -15.4, -3.2, 2.6, 1.6, 0.35, 6.0),
    ("MossPatch_06", 14.4, -2.8, 2.9, 1.7, -0.50, 7.0),
    ("MossPatch_07", -6.8, 5.3, 2.8, 1.5, 0.18, 8.0),
    ("MossPatch_08", 5.0, 7.8, 2.6, 1.4, -0.28, 9.0),
    ("MossPatch_09", -3.2, -8.0, 2.8, 1.5, 0.52, 10.0),
    ("MossPatch_10", 8.7, 1.6, 2.6, 1.5, -0.12, 11.0),
)

for path in (MODEL_DIR, os.path.dirname(BLEND_PATH), QA_DIR):
    os.makedirs(path, exist_ok=True)


def reset_scene_contents():
    """Clear authored data without disabling the live Blender MCP add-on."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for data_blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.worlds,
    ):
        for data_block in list(data_blocks):
            data_blocks.remove(data_block)


reset_scene_contents()
random.seed(20260806)


def principled_material(name, color, roughness=0.82, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
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


def forest_floor_material(
    name,
    tint,
    tint_strength=0.62,
    roughness_value=0.94,
    texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    diffuse_name="albedo.png",
    normal_name="normal.png",
    roughness_name="roughness.png",
    normal_texture_dir=None,
    roughness_texture_dir=None,
    saturation=0.86,
    grade_value=1.0,
):
    """Build one texture family with distinct ecological color regions."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*tint, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness_value

    diffuse_path = os.path.join(texture_dir, diffuse_name)
    normal_path = os.path.join(normal_texture_dir or texture_dir, normal_name)
    roughness_path = os.path.join(roughness_texture_dir or texture_dir, roughness_name)
    if os.path.isfile(diffuse_path):
        diffuse = nodes.new("ShaderNodeTexImage")
        diffuse.name = f"{name} Diffuse"
        diffuse.image = bpy.data.images.load(diffuse_path, check_existing=True)
        diffuse.image.colorspace_settings.name = "sRGB"
        if tint_strength <= 0.0:
            # Runtime floor families are pre-graded as image pixels. A direct
            # texture connection is faithfully represented by glTF, unlike
            # Blender-only color grading nodes that exporters may ignore.
            links.new(diffuse.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            grade = nodes.new("ShaderNodeHueSaturation")
            grade.name = f"{name} Woodland Grade"
            grade.inputs["Saturation"].default_value = saturation
            grade.inputs["Value"].default_value = grade_value
            tint_node = nodes.new("ShaderNodeRGB")
            tint_node.name = f"{name} Tint"
            tint_node.outputs[0].default_value = (*tint, 1.0)
            multiply = nodes.new("ShaderNodeMixRGB")
            multiply.name = f"{name} Tint Multiply"
            multiply.blend_type = "MULTIPLY"
            multiply.inputs[0].default_value = tint_strength
            links.new(diffuse.outputs["Color"], grade.inputs["Color"])
            links.new(grade.outputs["Color"], multiply.inputs[1])
            links.new(tint_node.outputs[0], multiply.inputs[2])
            links.new(multiply.outputs[0], bsdf.inputs["Base Color"])
    if os.path.isfile(roughness_path):
        roughness = nodes.new("ShaderNodeTexImage")
        roughness.name = f"{name} Roughness"
        roughness.image = bpy.data.images.load(roughness_path, check_existing=True)
        roughness.image.colorspace_settings.name = "Non-Color"
        links.new(roughness.outputs["Color"], bsdf.inputs["Roughness"])
    if os.path.isfile(normal_path):
        normal = nodes.new("ShaderNodeTexImage")
        normal.name = f"{name} Normal"
        normal.image = bpy.data.images.load(normal_path, check_existing=True)
        normal.image.colorspace_settings.name = "Non-Color"
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = 0.58
        links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def preview_water_material():
    mat = bpy.data.materials.new("QA Pond Water")
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.018, 0.070, 0.095, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.28
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.333
    bsdf.inputs["Alpha"].default_value = 0.88
    emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    emission_strength = bsdf.inputs.get("Emission Strength")
    if emission:
        emission.default_value = (0.008, 0.040, 0.058, 1.0)
    if emission_strength:
        emission_strength.default_value = 0.11
    ior_level = bsdf.inputs.get("IOR Level")
    if ior_level:
        ior_level.default_value = 0.2
    coat = bsdf.inputs.get("Coat Weight") or bsdf.inputs.get("Clearcoat")
    coat_roughness = bsdf.inputs.get("Coat Roughness") or bsdf.inputs.get("Clearcoat Roughness")
    transmission = bsdf.inputs.get("Transmission Weight") or bsdf.inputs.get("Transmission")
    if coat:
        coat.default_value = 0.42
    if coat_roughness:
        coat_roughness.default_value = 0.10
    if transmission:
        transmission.default_value = 0.05
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.4
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.68
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.17
    bump.inputs["Distance"].default_value = 0.10
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


EARTH = forest_floor_material(
    "Autumn Woodland Soil",
    (1.0, 1.0, 1.0),
    0.0,
    texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    diffuse_name="soil-albedo.jpg",
    normal_name="normal.jpg",
    roughness_name="roughness.jpg",
    normal_texture_dir=FOREST_FLOOR_TEXTURE_DIR,
    roughness_texture_dir=FOREST_FLOOR_TEXTURE_DIR,
)
PACKED_EARTH = forest_floor_material(
    "Packed Performance Clearing",
    (1.0, 1.0, 1.0),
    0.0,
    0.95,
    AUTUMN_FLOOR_TEXTURE_DIR,
    "packed-albedo.jpg",
    "normal.jpg",
    "roughness.jpg",
    DIRT_TEXTURE_DIR,
    DIRT_TEXTURE_DIR,
)
MOSS = forest_floor_material(
    "Shade Moss",
    (1.0, 1.0, 1.0),
    0.0,
    texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    diffuse_name="moss-albedo.jpg",
    normal_name="normal.jpg",
    roughness_name="roughness.jpg",
    normal_texture_dir=DIRT_TEXTURE_DIR,
    roughness_texture_dir=DIRT_TEXTURE_DIR,
)
DAMP_EARTH = forest_floor_material(
    "Damp Pond Bank",
    (1.0, 1.0, 1.0),
    0.0,
    0.88,
    AUTUMN_FLOOR_TEXTURE_DIR,
    "shadow-albedo.jpg",
    "normal.jpg",
    "roughness.jpg",
    FOREST_FLOOR_TEXTURE_DIR,
    FOREST_FLOOR_TEXTURE_DIR,
)
DARK_EARTH = forest_floor_material(
    "Shadowed Forest Floor",
    (1.0, 1.0, 1.0),
    0.0,
    texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    diffuse_name="shadow-albedo.jpg",
    normal_name="normal.jpg",
    roughness_name="roughness.jpg",
    normal_texture_dir=FOREST_FLOOR_TEXTURE_DIR,
    roughness_texture_dir=FOREST_FLOOR_TEXTURE_DIR,
)
ROCK = principled_material("Weathered Basalt", (0.115, 0.100, 0.110), roughness=0.91)
ROCK_DAMP = principled_material("Damp Basalt", (0.075, 0.068, 0.078), roughness=0.56)
ROCK_MOSS = principled_material("Moss on Stone", (0.105, 0.185, 0.075), roughness=0.96)
LEAF_RED = principled_material("Leaf Litter Crimson", (0.43, 0.045, 0.025), roughness=0.88)
LEAF_ORANGE = principled_material("Leaf Litter Copper", (0.72, 0.19, 0.035), roughness=0.86)
LEAF_GOLD = principled_material("Leaf Litter Gold", (0.82, 0.43, 0.07), roughness=0.84)
TWIG = principled_material("Autumn Twig Litter", (0.10, 0.045, 0.022), roughness=0.96)
GRASS_BASE = principled_material("Autumn Wind Grass Base", (0.18, 0.23, 0.070), roughness=0.93)
GRASS_MEDIUM = principled_material("Autumn Wind Grass Medium", (0.14, 0.19, 0.055), roughness=0.94)
GRASS_HIGH = principled_material("Autumn Wind Grass High", (0.22, 0.25, 0.080), roughness=0.92)
for grass_material in (GRASS_BASE, GRASS_MEDIUM, GRASS_HIGH):
    grass_material.diffuse_color = (*grass_material.diffuse_color[:3], 1.0)
    grass_material.surface_render_method = "DITHERED"
POND_GLOW = principled_material(
    "Pond Underlight",
    (0.004, 0.018, 0.024),
    roughness=0.62,
    emission=(0.003, 0.018, 0.021),
    emission_strength=0.025,
)
QA_WATER = preview_water_material()


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def pond_metric(x, y, margin=0.0):
    rx = max(0.1, POND_RX + margin)
    ry = max(0.1, POND_RY + margin)
    return math.sqrt(((x - POND_X) / rx) ** 2 + ((y - POND_Y) / ry) ** 2)


def in_pond(x, y, margin=0.0):
    return pond_metric(x, y, margin) < 1.0


def pond_irregularity(angle):
    return (
        math.sin(angle * 2.7 + POND_SEED) * 0.075
        + math.cos(angle * 4.6 + POND_SEED * 1.3) * 0.045
        + math.sin(angle * 7.1 - POND_SEED * 0.4) * 0.025
    )


def terrain_height(x, y):
    radius = math.hypot(x, y)
    clearing = smoothstep(CLEARING_RADIUS, 10.0, radius)
    outer_rise = 2.1 * smoothstep(17.0, 30.0, radius) ** 1.35
    broad = 0.20 * math.sin(x * 0.31) + 0.16 * math.cos(y * 0.27) + 0.09 * math.sin((x + y) * 0.54)
    fine = 0.055 * math.sin(x * 1.17 + y * 0.83)
    height = clearing * (broad + fine) + outer_rise
    distance = pond_metric(x, y)
    if distance < 1.7:
        depression = 0.68 * (1.0 - smoothstep(0.42, 1.7, distance))
        height -= depression * smoothstep(CLEARING_RADIUS, CLEARING_RADIUS + 1.0, radius)
    return height


def create_terrain():
    size = 31.0
    segments = 96
    vertices = []
    faces = []
    for iy in range(segments + 1):
        y = -size + (2 * size * iy / segments)
        for ix in range(segments + 1):
            x = -size + (2 * size * ix / segments)
            radius = math.hypot(x, y)
            edge_drop = max(0.0, radius - 29.5) * 0.24
            vertices.append((x, y, terrain_height(x, y) - edge_drop))
    row = segments + 1
    for iy in range(segments):
        for ix in range(segments):
            a = iy * row + ix
            faces.extend(((a, a + 1, a + row + 1), (a, a + row + 1, a + row)))

    mesh = bpy.data.meshes.new("Autumn Terrain Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in (EARTH, PACKED_EARTH, MOSS, DAMP_EARTH, DARK_EARTH):
        mesh.materials.append(material)
    uv = mesh.uv_layers.new(name="Autumn Ground UV")
    for polygon in mesh.polygons:
        center = polygon.center
        radius = math.hypot(center.x, center.y)
        distance = pond_metric(center.x, center.y)
        if radius <= CLEARING_RADIUS + 0.25:
            polygon.material_index = 1
        elif distance < 1.32:
            polygon.material_index = 3
        elif radius > 23:
            polygon.material_index = 4
        else:
            polygon.material_index = 0
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            # One tile spans about 5.2 meters. The source contains dozens of
            # small leaves, so this remains believable while pushing obvious
            # texture repetition beyond the main stage-camera foreground.
            uv.data[loop_index].uv = (vertex.co.x / 5.2, vertex.co.y / 5.2)
    terrain = bpy.data.objects.new("Autumn_Terrain", mesh)
    bpy.context.scene.collection.objects.link(terrain)
    terrain["tka_performance_clearing_radius"] = CLEARING_RADIUS
    terrain["tka_ground_height"] = 0.0
    terrain["tka_pond_center"] = (POND_X, POND_Y)
    terrain["tka_pond_radii"] = (POND_RX, POND_RY)


def organic_outline(cx, cy, rx, ry, seed, count=32, rotation=0.0):
    points = []
    for index in range(count):
        angle = index * math.tau / count
        jitter = (
            math.sin(angle * 2.7 + seed) * 0.075
            + math.cos(angle * 4.6 + seed * 1.3) * 0.045
            + math.sin(angle * 7.1 - seed * 0.4) * 0.025
        )
        px = math.cos(angle) * rx * (1.0 + jitter)
        py = math.sin(angle) * ry * (1.0 + jitter)
        cos_r = math.cos(rotation)
        sin_r = math.sin(rotation)
        points.append((cx + px * cos_r - py * sin_r, cy + px * sin_r + py * cos_r))
    return points


def create_organic_patch(name, cx, cy, rx, ry, material, rotation, seed, z_offset=0.018):
    outline = organic_outline(cx, cy, rx, ry, seed, 72, rotation)
    vertices = [(cx, cy, terrain_height(cx, cy) + z_offset)]
    vertices.extend((x, y, terrain_height(x, y) + z_offset) for x, y in outline)
    faces = []
    for index in range(len(outline)):
        faces.append((0, index + 1, ((index + 1) % len(outline)) + 1))
    mesh = bpy.data.meshes.new(f"{name} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(material)
    uv = mesh.uv_layers.new(name=f"{name} UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            uv.data[loop_index].uv = (vertex.co.x / 4.7, vertex.co.y / 4.7)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_ground_regions():
    # The textured patch makes the performance area read as deliberately worn,
    # while surrounding moss islands explain where fern clusters grow.
    create_organic_patch(
        "Packed_Performance_Clearing",
        0.0,
        0.0,
        CLEARING_RADIUS - 0.15,
        CLEARING_RADIUS - 0.25,
        PACKED_EARTH,
        0.0,
        12.0,
        0.012,
    )
    for name, x, y, rx, ry, rotation, seed in MOSS_PATCHES:
        create_organic_patch(name, x, y, rx, ry, MOSS, rotation, seed)

    # Macro-scale color variation comes from physical leaf-card drifts below,
    # not flat overlay meshes. That keeps transitions irregular at leaf scale
    # and avoids visible material cut-outs when the camera moves.


def create_pond_basin():
    ring_scales = (1.055, 1.012, 0.82, 0.43)
    count = 64
    vertices = []
    for ring_index, scale in enumerate(ring_scales):
        for index in range(count):
            angle = index * math.tau / count
            irregular = 1.0 + pond_irregularity(angle)
            x = POND_X + math.cos(angle) * POND_RX * scale * irregular
            y = POND_Y + math.sin(angle) * POND_RY * scale * irregular
            if ring_index == 0:
                z = terrain_height(x, y) + 0.025
            elif ring_index == 1:
                z = POND_WATER_HEIGHT - 0.10
            elif ring_index == 2:
                z = POND_WATER_HEIGHT - 0.55
            else:
                z = POND_WATER_HEIGHT - 0.72
            vertices.append((x, y, z))
    vertices.append((POND_X, POND_Y, POND_WATER_HEIGHT - 0.76))
    center_index = len(vertices) - 1

    faces = []
    materials = []
    for ring_index in range(len(ring_scales) - 1):
        for index in range(count):
            current = ring_index * count + index
            following = ring_index * count + (index + 1) % count
            inner = (ring_index + 1) * count + index
            inner_following = (ring_index + 1) * count + (index + 1) % count
            faces.append((current, following, inner_following, inner))
            materials.append(0 if ring_index == 0 else (1 if ring_index == 1 else 2))
    final_ring = (len(ring_scales) - 1) * count
    for index in range(count):
        faces.append((final_ring + index, final_ring + (index + 1) % count, center_index))
        materials.append(2)

    mesh = bpy.data.meshes.new("Sculpted Pond Basin Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in (DAMP_EARTH, ROCK_DAMP, POND_GLOW):
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, materials):
        polygon.material_index = material_index
        polygon.use_smooth = True
    basin = bpy.data.objects.new("Pond_Sculpted_Basin", mesh)
    bpy.context.scene.collection.objects.link(basin)

    water_outline = organic_outline(POND_X, POND_Y, POND_RX, POND_RY, POND_SEED, 48)
    water_vertices = [(POND_X, POND_Y, POND_WATER_HEIGHT)]
    water_vertices.extend((x, y, POND_WATER_HEIGHT) for x, y in water_outline)
    water_faces = [
        (0, index + 1, ((index + 1) % len(water_outline)) + 1)
        for index in range(len(water_outline))
    ]
    water_mesh = bpy.data.meshes.new("QA Pond Water Mesh")
    water_mesh.from_pydata(water_vertices, [], water_faces)
    water_mesh.update()
    water_mesh.materials.append(QA_WATER)
    water = bpy.data.objects.new("QA_Pond_Water", water_mesh)
    bpy.context.scene.collection.objects.link(water)


def create_floating_pond_leaves():
    """Add a quiet autumn-specific detail that remains above runtime water."""
    leaf_rng = random.Random(8812)
    vertices = []
    faces = []
    material_indices = []
    for index in range(16):
        angle = leaf_rng.uniform(0.0, math.tau)
        distance = math.sqrt(leaf_rng.uniform(0.08 ** 2, 0.72 ** 2))
        x = POND_X + math.cos(angle) * POND_RX * distance
        y = POND_Y + math.sin(angle) * POND_RY * distance
        half = leaf_rng.uniform(0.08, 0.17)
        yaw = leaf_rng.uniform(0.0, math.tau)
        dx = math.cos(yaw) * half
        dy = math.sin(yaw) * half
        px = -dy * 0.42
        py = dx * 0.42
        z = POND_WATER_HEIGHT + 0.032 + leaf_rng.uniform(0.0, 0.008)
        start = len(vertices)
        vertices.extend(
            (
                (x - dx, y - dy, z),
                (x + px, y + py, z + 0.004),
                (x + dx, y + dy, z),
                (x - px, y - py, z + 0.003),
            )
        )
        faces.append((start, start + 1, start + 2, start + 3))
        material_indices.append(index % 3)
    mesh = bpy.data.meshes.new("Floating Pond Leaves Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in (LEAF_RED, LEAF_ORANGE, LEAF_GOLD):
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
    obj = bpy.data.objects.new("Pond_Floating_Autumn_Leaves", mesh)
    bpy.context.scene.collection.objects.link(obj)
    return len(faces)


def imported_asset_root(asset_id, path):
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Missing required Autumn asset: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise RuntimeError(f"Blender imported no objects from {path}")
    root = bpy.data.objects.new(f"AssetSource_{asset_id}", None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)
    for obj in imported:
        if obj.parent not in imported_set:
            world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world
    return root


def asset_bounds(root):
    points = []
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
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
        copy.name = source.name.replace("AssetSource_", f"{name}_", 1) if source is source_root else f"{name}_{source.name}"
        bpy.context.scene.collection.objects.link(copy)
        mapping[source] = copy
    for source, copy in mapping.items():
        copy.parent = mapping.get(source.parent)
        copy.matrix_parent_inverse = source.matrix_parent_inverse.copy()
        copy.matrix_basis = source.matrix_basis.copy()
    return mapping[source_root]


def place_asset(source_root, name, position, target_height, rotation=0.0, scale_variation=1.0, mirror=False):
    root = duplicate_hierarchy(source_root, name)
    minimum, maximum = asset_bounds(source_root)
    height = max(0.001, maximum.z - minimum.z)
    scale = target_height / height * scale_variation
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    mirror_x = -scale if mirror else scale
    normalize = Matrix.Translation(Vector((-center_x, -center_y, -minimum.z)))
    root.matrix_world = (
        Matrix.Translation(Vector(position))
        @ Matrix.Rotation(rotation, 4, "Z")
        @ Matrix.Diagonal(Vector((mirror_x, scale, scale, 1.0)))
        @ normalize
    )
    for obj in root.children_recursive:
        if obj.type == "MESH":
            obj.name = f"{name}_{obj.name.split('_')[-1]}"
            obj.visible_shadow = True
    return root


def place_asset_to_dimensions(source_root, name, position, dimensions, rotation=0.0, mirror=False):
    """Place a scanned asset at exact world dimensions with its base buried."""
    root = duplicate_hierarchy(source_root, name)
    minimum, maximum = asset_bounds(source_root)
    source_dimensions = maximum - minimum
    scale_x = dimensions[0] / max(0.001, source_dimensions.x)
    scale_y = dimensions[1] / max(0.001, source_dimensions.y)
    scale_z = dimensions[2] / max(0.001, source_dimensions.z)
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    normalize = Matrix.Translation(Vector((-center_x, -center_y, -minimum.z)))
    root.matrix_world = (
        Matrix.Translation(Vector(position))
        @ Matrix.Rotation(rotation, 4, "Z")
        @ Matrix.Diagonal(Vector(((-scale_x if mirror else scale_x), scale_y, scale_z, 1.0)))
        @ normalize
    )
    for obj in root.children_recursive:
        if obj.type == "MESH":
            obj.name = f"{name}_{obj.name.split('_')[-1]}"
            obj.visible_shadow = True
    return root


def hide_source(root):
    root.hide_render = True
    root.hide_viewport = True
    for obj in root.children_recursive:
        obj.hide_render = True
        obj.hide_viewport = True


def tree_footprints():
    hero = [(placement[2], placement[3], placement[8]) for placement in TREE_PLACEMENTS]
    saplings = [(placement[1], placement[2], placement[6]) for placement in SAPLING_PLACEMENTS]
    distant = [
        (placement[2], placement[3], placement[8])
        for placement in DISTANT_TREE_PLACEMENTS
    ]
    return [*hero, *saplings, *distant]


def log_footprints():
    return [(placement[1], placement[2], placement[7]) for placement in LOG_PLACEMENTS]


def point_clear_of_footprints(x, y, extra=0.0):
    for ox, oy, radius in (*tree_footprints(), *log_footprints()):
        if math.hypot(x - ox, y - oy) < radius + extra:
            return False
    return True


def create_asset_placements():
    sources = {
        "HeroA": imported_asset_root("HeroA", os.path.join(MODEL_DIR, "hero-tree-a_raw.glb")),
        "HeroB": imported_asset_root("HeroB", os.path.join(MODEL_DIR, "hero-tree-b_raw.glb")),
        "Birch": imported_asset_root("Birch", os.path.join(MODEL_DIR, "silver-birch-cluster_raw.glb")),
        "Snag": imported_asset_root("Snag", os.path.join(MODEL_DIR, "autumn-snag_raw.glb")),
        "Larch": imported_asset_root("Larch", os.path.join(MODEL_DIR, "golden-larch_raw.glb")),
        "Willow": imported_asset_root("Willow", os.path.join(MODEL_DIR, "autumn-willow_raw.glb")),
        "Fern": imported_asset_root("Fern", os.path.join(MODEL_DIR, "fern-clump_raw.glb")),
        "Log": imported_asset_root("Log", os.path.join(MODEL_DIR, "fallen-log_raw.glb")),
    }
    for source_key in ("Birch", "Snag", "Larch", "Willow"):
        tune_background_tree_materials(sources[source_key], source_key)

    for name, source_key, x, y, target_height, rotation, variation, mirror, _footprint in TREE_PLACEMENTS:
        place_asset(
            sources[source_key],
            name,
            (x, y, terrain_height(x, y)),
            target_height,
            rotation,
            variation,
            mirror,
        )
    for name, source_key, x, y, target_height, rotation, variation, mirror, _footprint in DISTANT_TREE_PLACEMENTS:
        root = place_asset(
            sources[source_key],
            name,
            (x, y, terrain_height(x, y) - 0.12),
            target_height,
            rotation,
            variation,
            mirror,
        )
        root.name = name
        root["tka_scenery_tier"] = "distant-tree-belt"
    for name, x, y, target_height, rotation, mirror, _footprint in SAPLING_PLACEMENTS:
        place_asset(
            sources["HeroB"],
            name,
            (x, y, terrain_height(x, y)),
            target_height,
            rotation,
            1.0,
            mirror,
        )
    for name, x, y, target_height, rotation, variation, mirror, _footprint in LOG_PLACEMENTS:
        place_asset(
            sources["Log"],
            name,
            (x, y, terrain_height(x, y)),
            target_height,
            rotation,
            variation,
            mirror,
        )

    fern_positions = []
    cluster_rng = random.Random(84391)
    for cluster_index, (center_x, center_y, target_count) in enumerate(FERN_CLUSTERS):
        added = 0
        attempts = 0
        while added < target_count and attempts < 100:
            attempts += 1
            angle = cluster_rng.uniform(0.0, math.tau)
            distance = math.sqrt(cluster_rng.uniform(0.15 ** 2, 2.0 ** 2))
            x = center_x + math.cos(angle) * distance
            y = center_y + math.sin(angle) * distance * 0.72
            if math.hypot(x, y) < CLEARING_RADIUS + 0.8:
                continue
            if in_pond(x, y, margin=0.45):
                continue
            if not point_clear_of_footprints(x, y, extra=0.38):
                continue
            if any(math.hypot(x - px, y - py) < 0.72 for px, py in fern_positions):
                continue
            fern_positions.append((x, y))
            added += 1
        if added != target_count:
            raise RuntimeError(f"Fern cluster {cluster_index + 1} placed {added}/{target_count}")

    for index, (x, y) in enumerate(fern_positions):
        variation = 0.76 + 0.24 * (0.5 + 0.5 * math.sin(index * 1.71))
        place_asset(
            sources["Fern"],
            f"Fern_{index + 1:02d}",
            (x, y, terrain_height(x, y)),
            0.82,
            index * 1.93,
            variation,
            index % 3 == 0,
        )

    for source in sources.values():
        hide_source(source)
    return fern_positions


def shoreline_rock_placements():
    placements = []
    # Paired clusters leave stretches of living bank exposed; an evenly spaced
    # ring would read as a landscaping border instead of a forest pond.
    angles = (0.08, 0.34, 1.28, 1.58, 2.68, 3.02, 4.24, 5.42, 5.76)
    for index, angle in enumerate(angles):
        irregular = 1.10 + 0.055 * math.sin(index * 2.31) + pond_irregularity(angle)
        x = POND_X + math.cos(angle) * POND_RX * irregular
        y = POND_Y + math.sin(angle) * POND_RY * irregular
        sx = 0.72 + 0.30 * (0.5 + 0.5 * math.sin(index * 2.17))
        sy = 0.62 + 0.25 * (0.5 + 0.5 * math.cos(index * 1.73))
        sz = 0.48 + 0.24 * (0.5 + 0.5 * math.sin(index * 1.29 + 0.6))
        placements.append((x, y, sx, sy, sz, angle + 0.43, index % 4, "Shore"))
    placements.extend(
        (
            (-16.0, 4.0, 1.28, 0.88, 0.70, 0.5, 1, "Forest"),
            (15.0, 4.0, 1.12, 0.84, 0.62, 1.7, 2, "Forest"),
            (-18.5, 10.5, 1.42, 0.96, 0.76, 2.3, 3, "Forest"),
            (19.0, 11.0, 1.48, 1.02, 0.78, 0.9, 0, "Forest"),
            (-4.3, 17.4, 1.02, 0.74, 0.58, 2.8, 1, "Forest"),
            (11.0, 18.6, 1.18, 0.82, 0.64, 0.2, 2, "Forest"),
        )
    )
    return placements


def blender_readable_rock_source(filename):
    """Decode meshopt once because Blender's importer does not support it."""
    source = os.path.join(PROJECT_ROOT, "static", "models", "ocean", "polyhaven", filename)
    cache_dir = os.path.join(QA_DIR, "rock-sources")
    output = os.path.join(cache_dir, filename)
    os.makedirs(cache_dir, exist_ok=True)
    if not os.path.isfile(output) or os.path.getmtime(output) < os.path.getmtime(source):
        npx = "npx.cmd" if os.name == "nt" else "npx"
        result = subprocess.run(
            [npx, "gltf-transform", "copy", source, output],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        if result.stdout.strip():
            print(result.stdout.strip())
    return output


def create_rocks():
    sources = {
        "Boulder": imported_asset_root("Rock_Boulder", blender_readable_rock_source("boulder_01.glb")),
        "Rock": imported_asset_root("Rock_Round", blender_readable_rock_source("rock_07.glb")),
        "Stone": imported_asset_root("Rock_Stone", blender_readable_rock_source("stone_01.glb")),
    }
    placements = shoreline_rock_placements()
    source_order = ("Rock", "Stone", "Rock", "Boulder")
    for index, (x, y, sx, sy, sz, rotation, prototype, region) in enumerate(placements):
        source_key = "Boulder" if region == "Forest" and index % 2 else source_order[prototype]
        root = place_asset_to_dimensions(
            sources[source_key],
            f"{region}_Boulder_{index + 1:02d}",
            (x, y, terrain_height(x, y) - sz * 0.24),
            (sx * 1.8, sy * 1.75, sz * 1.55),
            rotation,
            index % 5 == 0,
        )
        root["tka_region"] = region.lower()
    for source in sources.values():
        hide_source(source)
    return placements


def point_clear_of_rocks(x, y, rock_placements, extra=0.0):
    for rx, ry, sx, sy, _sz, _rotation, _prototype, _region in rock_placements:
        if math.hypot(x - rx, y - ry) < max(sx, sy) * 1.1 + extra:
            return False
    return True


def tune_mushroom_materials(source_root):
    """Keep the Meshy texture while giving the fairy rings a quiet teal pulse."""
    seen = set()
    for obj in source_root.children_recursive:
        if obj.type != "MESH":
            continue
        materials = obj.data.materials
        for index, material in enumerate(materials):
            if material is None or material in seen:
                continue
            seen.add(material)
            material.name = f"Autumn Fairy Mushroom {index + 1}"
            material.use_nodes = True
            bsdf = material.node_tree.nodes.get("Principled BSDF")
            if not bsdf:
                continue
            emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            strength = bsdf.inputs.get("Emission Strength")
            if emission and not emission.is_linked:
                emission.default_value = (0.015, 0.22, 0.19, 1.0)
            if strength:
                strength.default_value = 0.22


def create_mushroom_rings(rock_placements):
    source = imported_asset_root("MushroomGrove", os.path.join(MODEL_DIR, "mushroom-grove_raw.glb"))
    tune_mushroom_materials(source)
    positions = []
    ring_rng = random.Random(14731)
    for ring_name, center_x, center_y, radius, count, phase in MUSHROOM_RINGS:
        for index in range(count):
            angle = phase + index * math.tau / count
            radius_variation = radius * (0.92 + ring_rng.uniform(-0.08, 0.10))
            x = center_x + math.cos(angle) * radius_variation
            y = center_y + math.sin(angle) * radius_variation * 0.82
            if math.hypot(x, y) < CLEARING_RADIUS + 0.55:
                raise RuntimeError(f"{ring_name} entered the performance clearing at {(x, y)}")
            if in_pond(x, y, margin=0.55):
                raise RuntimeError(f"{ring_name} entered the pond at {(x, y)}")
            if not point_clear_of_footprints(x, y, extra=0.28):
                raise RuntimeError(f"{ring_name} hit a tree or log at {(x, y)}")
            if not point_clear_of_rocks(x, y, rock_placements, extra=0.18):
                raise RuntimeError(f"{ring_name} hit a boulder at {(x, y)}")
            target_height = 0.34 + ring_rng.uniform(0.0, 0.24)
            root = place_asset(
                source,
                f"{ring_name}_{index + 1:02d}",
                (x, y, terrain_height(x, y) - 0.025),
                target_height,
                angle + math.pi + ring_rng.uniform(-0.25, 0.25),
                1.0,
                index % 3 == 0,
            )
            root["tka_ground_life"] = "mushroom-ring"
            positions.append((x, y))
    hide_source(source)
    return positions


def tune_owl_materials(source_root):
    """The owl should read through feather color, not a generated emissive map."""
    seen = set()
    for obj in source_root.children_recursive:
        if obj.type != "MESH":
            continue
        for material in obj.data.materials:
            if material is None or material in seen:
                continue
            seen.add(material)
            material.name = "Autumn Owl PBR"
            material.use_nodes = True
            bsdf = material.node_tree.nodes.get("Principled BSDF")
            if not bsdf:
                continue
            emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            strength = bsdf.inputs.get("Emission Strength")
            if emission:
                for link in list(emission.links):
                    material.node_tree.links.remove(link)
                emission.default_value = (0.0, 0.0, 0.0, 1.0)
            if strength:
                strength.default_value = 0.0


def tune_background_tree_materials(source_root, label):
    """Keep distant trees in the dusk value range instead of self-lighting."""
    seen = set()
    for obj in source_root.children_recursive:
        if obj.type != "MESH":
            continue
        for material in obj.data.materials:
            if material is None or material in seen:
                continue
            seen.add(material)
            material.name = f"Autumn {label} PBR"
            material.use_nodes = True
            bsdf = material.node_tree.nodes.get("Principled BSDF")
            if not bsdf:
                continue
            emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            strength = bsdf.inputs.get("Emission Strength")
            roughness = bsdf.inputs.get("Roughness")
            if emission:
                for link in list(emission.links):
                    material.node_tree.links.remove(link)
                emission.default_value = (0.0, 0.0, 0.0, 1.0)
            if strength:
                strength.default_value = 0.0
            if roughness and not roughness.is_linked:
                roughness.default_value = max(0.72, roughness.default_value)


def create_owl_perch():
    source = imported_asset_root("PerchedOwl", os.path.join(MODEL_DIR, "perched-owl_raw.glb"))
    tune_owl_materials(source)
    x, y, height = OWL_POSITION
    root = place_asset(
        source,
        "Autumn_Owl_Perch",
        (x, y, terrain_height(x, y) + height),
        1.18,
        -0.18,
        1.0,
        False,
    )
    root.name = "Autumn_Owl_Perch"
    root["tka_ground_life"] = "owl"
    hide_source(source)
    return root


def create_owl_tree_connector():
    """Grow a short branch from HeroTreeA_03 into the owl's baked perch.

    The Meshy owl already includes a branch under its closed talons. This
    tapered connector buries that branch into the nearby trunk fork so the
    combined GLB reads as one physical tree-and-owl asset from every camera.
    """
    start = Vector((5.92, 18.02, terrain_height(5.92, 18.02) + 6.50))
    end = Vector((5.18, 17.43, terrain_height(5.3, 17.55) + 6.48))
    direction = end - start
    midpoint = (start + end) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=0.17,
        radius2=0.072,
        depth=direction.length,
        location=midpoint,
    )
    connector = bpy.context.object
    connector.name = "Autumn_Owl_Tree_Connector"
    connector.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    connector.data.materials.append(TWIG)
    connector["tka_ground_life"] = "owl-tree-connector"
    return connector


def grass_point_is_valid(x, y, rock_placements, mushroom_positions):
    radius = math.hypot(x, y)
    if radius < CLEARING_RADIUS + 0.35 or radius > 22.5:
        return False
    if in_pond(x, y, margin=0.62):
        return False
    if not point_clear_of_footprints(x, y, extra=0.24):
        return False
    if not point_clear_of_rocks(x, y, rock_placements, extra=0.20):
        return False
    if any(math.hypot(x - mx, y - my) < 0.30 for mx, my in mushroom_positions):
        return False
    return True


def sample_grass_positions(count, seed, rock_placements, mushroom_positions, occupied):
    rng = random.Random(seed)
    positions = []
    cell_size = 0.16
    attempts = 0
    while len(positions) < count and attempts < count * 80:
        attempts += 1
        center_x, center_y, spread_x, spread_y = GRASS_COLONIES[rng.randrange(len(GRASS_COLONIES))]
        x = rng.gauss(center_x, spread_x * 0.48)
        y = rng.gauss(center_y, spread_y * 0.48)
        if not grass_point_is_valid(x, y, rock_placements, mushroom_positions):
            continue
        cell_x = math.floor(x / cell_size)
        cell_y = math.floor(y / cell_size)
        blocked = False
        for neighbor_x in range(cell_x - 1, cell_x + 2):
            for neighbor_y in range(cell_y - 1, cell_y + 2):
                for ox, oy in occupied.get((neighbor_x, neighbor_y), ()):
                    if (x - ox) ** 2 + (y - oy) ** 2 < cell_size**2:
                        blocked = True
                        break
                if blocked:
                    break
            if blocked:
                break
        if blocked:
            continue
        occupied.setdefault((cell_x, cell_y), []).append((x, y))
        positions.append((x, y))
    if len(positions) != count:
        raise RuntimeError(f"Grass tier placed {len(positions)}/{count} clumps")
    return positions


def create_grass_tier(name, count, seed, material, rock_placements, mushroom_positions, occupied):
    positions = sample_grass_positions(
        count,
        seed,
        rock_placements,
        mushroom_positions,
        occupied,
    )
    rng = random.Random(seed + 991)
    vertices = []
    faces = []
    vertex_uvs = []

    for clump_x, clump_y in positions:
        blade_count = 5 + rng.randrange(4)
        for _blade in range(blade_count):
            offset_angle = rng.uniform(0.0, math.tau)
            offset_radius = math.sqrt(rng.random()) * 0.13
            root_x = clump_x + math.cos(offset_angle) * offset_radius
            root_y = clump_y + math.sin(offset_angle) * offset_radius
            root_z = terrain_height(root_x, root_y) + 0.014
            yaw = rng.uniform(0.0, math.tau)
            right_x = math.cos(yaw)
            right_y = math.sin(yaw)
            lean_angle = yaw + rng.uniform(-0.65, 0.65)
            lean_x = math.cos(lean_angle)
            lean_y = math.sin(lean_angle)
            width = rng.uniform(0.018, 0.036)
            height = rng.uniform(0.18, 0.44)
            mid_lean = rng.uniform(0.008, 0.025)
            tip_lean = rng.uniform(0.025, 0.072)
            start = len(vertices)
            vertices.extend(
                (
                    (root_x - right_x * width, root_y - right_y * width, root_z),
                    (root_x + right_x * width, root_y + right_y * width, root_z),
                    (
                        root_x - right_x * width * 0.72 + lean_x * mid_lean,
                        root_y - right_y * width * 0.72 + lean_y * mid_lean,
                        root_z + height * 0.56,
                    ),
                    (
                        root_x + right_x * width * 0.72 + lean_x * mid_lean,
                        root_y + right_y * width * 0.72 + lean_y * mid_lean,
                        root_z + height * 0.56,
                    ),
                    (
                        root_x - right_x * width * 0.10 + lean_x * tip_lean,
                        root_y - right_y * width * 0.10 + lean_y * tip_lean,
                        root_z + height,
                    ),
                    (
                        root_x + right_x * width * 0.10 + lean_x * tip_lean,
                        root_y + right_y * width * 0.10 + lean_y * tip_lean,
                        root_z + height,
                    ),
                )
            )
            vertex_uvs.extend(
                ((0.0, 0.0), (1.0, 0.0), (0.12, 0.56), (0.88, 0.56), (0.45, 1.0), (0.55, 1.0))
            )
            faces.extend(
                (
                    (start, start + 1, start + 3, start + 2),
                    (start + 2, start + 3, start + 5, start + 4),
                )
            )

    mesh = bpy.data.meshes.new(f"{name} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="Autumn Grass Root Weight")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = vertex_uvs[vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["tka_grass_clumps"] = count
    obj["tka_quality_tier"] = name.rsplit("_", 1)[-1].lower()
    return positions


def create_grass_system(rock_placements, mushroom_positions):
    occupied = {}
    return {
        "base": create_grass_tier(
            "Autumn_Grass_Base",
            500,
            5101,
            GRASS_BASE,
            rock_placements,
            mushroom_positions,
            occupied,
        ),
        "medium": create_grass_tier(
            "Autumn_Grass_Medium",
            600,
            6101,
            GRASS_MEDIUM,
            rock_placements,
            mushroom_positions,
            occupied,
        ),
        "high": create_grass_tier(
            "Autumn_Grass_High",
            900,
            7101,
            GRASS_HIGH,
            rock_placements,
            mushroom_positions,
            occupied,
        ),
    }


def create_twig_litter(grass_positions):
    rng = random.Random(29071)
    candidates = [position for tier in grass_positions.values() for position in tier]
    vertices = []
    faces = []
    positions = []
    count = 150
    for index in range(count):
        base_x, base_y = candidates[(index * 13) % len(candidates)]
        x = base_x + rng.uniform(-0.35, 0.35)
        y = base_y + rng.uniform(-0.35, 0.35)
        if math.hypot(x, y) < CLEARING_RADIUS + 0.20 or in_pond(x, y, margin=0.30):
            x, y = base_x, base_y
        z = terrain_height(x, y) + 0.026
        positions.append((x, y))
        angle = rng.uniform(0.0, math.tau)
        half_length = rng.uniform(0.08, 0.24)
        half_width = rng.uniform(0.008, 0.019)
        height = rng.uniform(0.010, 0.026)
        forward = Vector((math.cos(angle), math.sin(angle)))
        right = Vector((-forward.y, forward.x))
        corners = (
            Vector((x, y)) - forward * half_length - right * half_width,
            Vector((x, y)) + forward * half_length - right * half_width,
            Vector((x, y)) + forward * half_length + right * half_width,
            Vector((x, y)) - forward * half_length + right * half_width,
        )
        start = len(vertices)
        vertices.extend((corner.x, corner.y, z) for corner in corners)
        vertices.extend((corner.x, corner.y, z + height) for corner in corners)
        faces.extend(
            (
                (start, start + 1, start + 2, start + 3),
                (start + 4, start + 7, start + 6, start + 5),
                (start, start + 4, start + 5, start + 1),
                (start + 1, start + 5, start + 6, start + 2),
                (start + 2, start + 6, start + 7, start + 3),
                (start + 3, start + 7, start + 4, start),
            )
        )
    mesh = bpy.data.meshes.new("Autumn Twig Litter Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(TWIG)
    obj = bpy.data.objects.new("Autumn_Twig_Litter", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["tka_twig_count"] = count
    return positions


def create_leaf_litter(rock_placements):
    vertices = []
    faces = []
    material_indices = []
    drift_rng = random.Random(22917)
    drift_centers = []
    for _name, _source, x, y, _height, _rotation, _variation, _mirror, footprint in TREE_PLACEMENTS:
        drift_centers.append((x + footprint * 0.65, y - footprint * 0.35, footprint * 1.25, 64))
    for _name, x, y, _height, rotation, _mirror, footprint in SAPLING_PLACEMENTS:
        drift_centers.append((x - math.sin(rotation) * 0.3, y + math.cos(rotation) * 0.3, footprint, 28))
    for _name, x, y, _height, rotation, _variation, _mirror, footprint in LOG_PLACEMENTS:
        drift_centers.append((x - math.sin(rotation) * 0.8, y + math.cos(rotation) * 0.8, footprint, 48))
    drift_centers.extend(
        (
            (7.8, -9.0, 3.2, 56),
            (1.5, 10.0, 3.0, 52),
            (-7.0, 5.5, 2.6, 54),
            (5.8, 6.9, 2.6, 54),
            (7.8, -3.4, 2.4, 50),
            (-3.8, -8.5, 2.8, 56),
            (11.8, 3.2, 2.6, 48),
            (-7.0, 14.0, 2.8, 52),
            # Denser, larger foreground drifts make the generated material read
            # as layered leaf duff rather than one repeated flat texture.
            (-12.5, -12.0, 3.2, 120),
            (-5.0, -12.5, 3.0, 120),
            (5.3, -12.2, 3.0, 120),
            (12.4, -11.0, 3.2, 120),
            # Two distant wind pockets break the dark horizon floor between
            # trunks without competing with the moon opening.
            (-15.5, 18.0, 3.6, 65),
            (15.5, 19.0, 3.6, 65),
        )
    )

    for center_x, center_y, spread, count in drift_centers:
        placed = 0
        attempts = 0
        while placed < count and attempts < count * 12:
            attempts += 1
            x = drift_rng.gauss(center_x, spread * 0.58)
            y = drift_rng.gauss(center_y, spread * 0.30)
            if math.hypot(x, y) < CLEARING_RADIUS + 0.45:
                continue
            if in_pond(x, y, margin=0.18):
                continue
            if any(math.hypot(x - rx, y - ry) < max(rsx, rsy) * 0.78 for rx, ry, rsx, rsy, *_ in rock_placements):
                continue
            # Alternating low layers catch silhouettes and shadows while still
            # behaving like flat litter under a performer's feet.
            layer = (placed + attempts) % 4
            z = terrain_height(x, y) + 0.026 + layer * 0.010
            foreground_emphasis = center_y < -10.0 and abs(center_x) < 15.0
            half = drift_rng.uniform(0.08, 0.20) if foreground_emphasis else drift_rng.uniform(0.055, 0.15)
            yaw = drift_rng.uniform(0.0, math.tau)
            dx = math.cos(yaw) * half
            dy = math.sin(yaw) * half
            px = -dy * drift_rng.uniform(0.34, 0.54)
            py = dx * drift_rng.uniform(0.34, 0.54)
            curl = drift_rng.uniform(0.004, 0.025)
            start = len(vertices)
            vertices.extend(
                (
                    (x - dx, y - dy, z),
                    (x + px, y + py, z + curl),
                    (x + dx, y + dy, z + curl * 0.25),
                    (x - px, y - py, z + curl * 0.65),
                )
            )
            faces.append((start, start + 1, start + 2, start + 3))
            material_indices.append((placed + attempts) % 3)
            placed += 1

    mesh = bpy.data.meshes.new("Ecological Leaf Drift Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in (LEAF_RED, LEAF_ORANGE, LEAF_GOLD):
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
    obj = bpy.data.objects.new("Autumn_Leaf_Drifts", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["tka_leaf_count"] = len(faces)
    return len(faces)


def verify_ecology(
    fern_positions,
    rock_placements,
    leaf_count,
    mushroom_positions,
    grass_positions,
    twig_positions,
):
    clearing_probes = []
    for ring in (0.0, 2.0, 4.0, 6.0):
        for index in range(16):
            x = ring * math.cos(index * math.tau / 16)
            y = ring * math.sin(index * math.tau / 16)
            clearing_probes.append(abs(terrain_height(x, y)))
    maximum = max(clearing_probes)
    if maximum > 0.001:
        raise RuntimeError(f"Performance clearing is not level: max deviation {maximum}")

    pond_fern_collisions = [(x, y) for x, y in fern_positions if in_pond(x, y, margin=0.35)]
    footprint_fern_collisions = [
        (x, y) for x, y in fern_positions if not point_clear_of_footprints(x, y, extra=0.28)
    ]
    stage_fern_collisions = [(x, y) for x, y in fern_positions if math.hypot(x, y) < CLEARING_RADIUS + 0.65]
    shoreline_errors = [
        (x, y) for x, y, _sx, _sy, _sz, _rotation, _prototype, region in rock_placements
        if region == "Shore" and not (0.92 <= pond_metric(x, y) <= 1.35)
    ]
    all_grass = [position for tier in grass_positions.values() for position in tier]
    grass_errors = [
        (x, y)
        for x, y in all_grass
        if not grass_point_is_valid(x, y, rock_placements, mushroom_positions)
    ]
    mushroom_errors = [
        (x, y)
        for x, y in mushroom_positions
        if math.hypot(x, y) < CLEARING_RADIUS + 0.55
        or in_pond(x, y, margin=0.55)
        or not point_clear_of_footprints(x, y, extra=0.28)
        or not point_clear_of_rocks(x, y, rock_placements, extra=0.18)
    ]
    twig_errors = [
        (x, y)
        for x, y in twig_positions
        if math.hypot(x, y) < CLEARING_RADIUS + 0.20 or in_pond(x, y, margin=0.30)
    ]
    expected_grass = {"base": 500, "medium": 600, "high": 900}
    count_errors = {
        tier: len(grass_positions[tier])
        for tier, expected in expected_grass.items()
        if len(grass_positions[tier]) != expected
    }
    distant_tree_errors = [
        name
        for name, *_rest in DISTANT_TREE_PLACEMENTS
        if bpy.data.objects.get(name) is None
    ]
    distant_family_counts = {}
    for _name, family, *_rest in DISTANT_TREE_PLACEMENTS:
        distant_family_counts[family] = distant_family_counts.get(family, 0) + 1
    expected_distant_families = {"Birch": 5, "Snag": 5, "Larch": 4, "Willow": 3}
    distant_family_error = (
        distant_family_counts
        if distant_family_counts != expected_distant_families
        else None
    )
    owl_tree_errors = [
        name
        for name in ("Autumn_Owl_Perch", "Autumn_Owl_Tree_Connector")
        if bpy.data.objects.get(name) is None
    ]
    if (
        pond_fern_collisions
        or footprint_fern_collisions
        or stage_fern_collisions
        or shoreline_errors
        or grass_errors
        or mushroom_errors
        or twig_errors
        or count_errors
        or distant_tree_errors
        or distant_family_error
        or owl_tree_errors
        or leaf_count != 1800
        or len(mushroom_positions) != 16
    ):
        raise RuntimeError(
            "Ecology validation failed: "
            f"pond ferns={len(pond_fern_collisions)}, "
            f"footprint ferns={len(footprint_fern_collisions)}, "
            f"stage ferns={len(stage_fern_collisions)}, "
            f"shoreline rocks={len(shoreline_errors)}, "
            f"grass={len(grass_errors)}, mushrooms={len(mushroom_errors)}, "
            f"twigs={len(twig_errors)}, count errors={count_errors}, "
            f"distant trees={distant_tree_errors}, families={distant_family_error}, "
            f"owl tree={owl_tree_errors}, "
            f"leaves={leaf_count}"
        )
    print(f"Performance clearing verified: max deviation {maximum:.6f}m")
    print(
        "Ecology verified: "
        f"{len(fern_positions)} ferns, {len(rock_placements)} boulders, {leaf_count} leaves, "
        f"{len(all_grass)} grass clumps, {len(mushroom_positions)} mushroom clusters, "
        f"{len(twig_positions)} twigs, 0 forbidden-placement collisions"
    )
    print(
        f"Distant tree belt verified: {len(DISTANT_TREE_PLACEMENTS)} placements "
        f"{distant_family_counts}; owl branch connector present"
    )


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, color, energy, size, target):
    data = bpy.data.lights.new(name, "AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)


def render_qa_view(camera, location, target, path, lens=38):
    camera.location = location
    camera.data.lens = lens
    aim_at(camera, target)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def create_qa_performer_reference():
    """Add a 1.75 m reference silhouette that is excluded from the GLB export."""
    material = principled_material(
        "QA Performer Scale Reference",
        (0.95, 0.30, 0.08),
        roughness=0.48,
        emission=(0.45, 0.055, 0.012),
        emission_strength=0.16,
    )
    parts = []

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.19, depth=0.92, location=(0, 0, 1.02))
    torso = bpy.context.object
    torso.name = "QA_Performer_Torso"
    torso.scale = (1.0, 0.62, 1.0)
    parts.append(torso)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.16, location=(0, 0, 1.62))
    head = bpy.context.object
    head.name = "QA_Performer_Head"
    parts.append(head)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12,
            radius=0.065,
            depth=0.62,
            location=(side * 0.105, 0, 0.42),
        )
        leg = bpy.context.object
        leg.name = f"QA_Performer_Leg_{'L' if side < 0 else 'R'}"
        parts.append(leg)

    for part in parts:
        part.data.materials.append(material)
    return parts


def setup_qa_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    world = bpy.data.worlds.new("Autumn Dusk World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.045, 0.012, 0.068, 1.0)
    background.inputs["Strength"].default_value = 0.28
    scene.world = world

    add_area_light("Light_Sunset_Key", (-12, -18, 18), (1.0, 0.25, 0.07), 2800, 11.0, (0, 2, 3))
    add_area_light("Light_Violet_Fill", (16, 8, 16), (0.22, 0.12, 1.0), 2300, 13.0, (0, 4, 4))
    add_area_light("Light_Amber_Rim", (-18, 22, 10), (1.0, 0.52, 0.12), 1950, 9.0, (-2, 10, 5))
    add_area_light("Light_Pond_Glint", (POND_X - 3, POND_Y - 4, 8), (0.18, 0.38, 1.0), 520, 8.0, (POND_X, POND_Y, 0))

    camera_data = bpy.data.cameras.new("Camera_Autumn_QA")
    camera = bpy.data.objects.new("Camera_Autumn_QA", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.data.sensor_width = 36
    scene.camera = camera
    performer_reference = create_qa_performer_reference()

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except (TypeError, ValueError):
        pass

    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    render_qa_view(camera, (0.0, -36.0, 14.2), (0.0, 4.0, 3.0), QA_PATHS["hero"], 39)
    render_qa_view(camera, (0.0, -13.0, 2.7), (0.0, -4.8, 0.35), QA_PATHS["floor"], 52)
    render_qa_view(camera, (-1.5, -27.0, 8.5), (POND_X, POND_Y + 1.2, 0.3), QA_PATHS["pond"], 48)
    render_qa_view(camera, (4.0, 34.0, 13.5), (0.0, 1.5, 2.8), QA_PATHS["reverse"], 40)
    for part in performer_reference:
        part.hide_render = True
        part.hide_set(True)
    render_qa_view(camera, (1.9, 11.9, 8.5), (5.3, 17.55, 7.58), QA_PATHS["owl"], 66)
    # Return the editable file to the hero camera view for the visible host.
    camera.location = (0.0, -36.0, 14.2)
    camera.data.lens = 39
    aim_at(camera, (0.0, 4.0, 3.0))
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


create_terrain()
create_ground_regions()
create_pond_basin()
floating_leaf_count = create_floating_pond_leaves()
fern_positions = create_asset_placements()
rock_placements = create_rocks()
mushroom_positions = create_mushroom_rings(rock_placements)
owl_perch = create_owl_perch()
owl_tree_connector = create_owl_tree_connector()
grass_positions = create_grass_system(rock_placements, mushroom_positions)
twig_positions = create_twig_litter(grass_positions)
leaf_count = create_leaf_litter(rock_placements)
verify_ecology(
    fern_positions,
    rock_placements,
    leaf_count,
    mushroom_positions,
    grass_positions,
    twig_positions,
)
setup_qa_render()

print("\nAutumn environment authored successfully")
print(f"Editable source: {BLEND_PATH}")
for label, path in QA_PATHS.items():
    print(f"QA {label:7}:      {path}")
print(f"Mesh objects:    {sum(1 for obj in bpy.data.objects if obj.type == 'MESH' and obj.visible_get())}")
print(f"Unique meshes:   {len(bpy.data.meshes)}")
print(f"Materials:       {len(bpy.data.materials)}")
print(f"Floating leaves: {floating_leaf_count}")
print(f"Grass clumps:    {sum(len(tier) for tier in grass_positions.values())}")
print(f"Mushroom ring:   {len(mushroom_positions)} clusters")
print(f"Twig litter:     {len(twig_positions)} pieces")
print(f"Owl tree:        {owl_perch.name} + {owl_tree_connector.name}")
