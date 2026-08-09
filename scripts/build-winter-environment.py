"""Author the Moonlit Winter Hollow environment in Blender.

The scene is a composed winter landscape, not a radial scatter. A level
eight-metre performance clearing is surrounded by sculpted snow banks, hero
conifers, a frozen pond basin, fallen timber, and a layered distant tree belt.
Poly Haven CC0 saplings provide the tree geometry and PBR materials; linked
duplicates preserve GPU-instancing opportunities in the exported glTF.

The editable ``blender/winter_environment.blend`` file is the source of truth.
QA renders are written to the system temp directory, while
``blender-export-winter-full.py`` creates the clean runtime GLB.
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
SOURCE_DIR = os.path.join(PROJECT_ROOT, "assets", "3d-source", "winter")
TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "winter")
ROCK_SOURCE_DIR = os.path.join(PROJECT_ROOT, "static", "models", "ocean", "polyhaven")
MESHY_TREE_DIR = os.path.join(PROJECT_ROOT, "static", "models", "winter", "trees")
AUTUMN_MODEL_DIR = os.path.join(PROJECT_ROOT, "static", "models", "autumn")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "winter_environment.blend")
QA_DIR = os.path.join(tempfile.gettempdir(), "tka-winter-evidence")
QA_PATHS = {
    "hero": os.path.join(QA_DIR, "winter_environment_qa.png"),
    "pond": os.path.join(QA_DIR, "winter_environment_qa_pond.png"),
    "trees": os.path.join(QA_DIR, "winter_environment_qa_trees.png"),
    "props": os.path.join(QA_DIR, "winter_environment_qa_props.png"),
    "reverse": os.path.join(QA_DIR, "winter_environment_qa_reverse.png"),
    "walk": os.path.join(QA_DIR, "winter_environment_qa_walk.png"),
    "world": os.path.join(QA_DIR, "winter_environment_qa_world.png"),
}

CLEARING_RADIUS = 8.0
POND_X = -14.0
POND_Y = -8.0
POND_RX = 6.0
POND_RY = 4.4
POND_SEED = 2.6
POND_WATER_HEIGHT = 0.05
WORLD_RADIUS = 170.0
WORLD_SKIRT_START = 0.86
WORLD_SKIRT_DEPTH = 14.0
TERRAIN_ANGULAR_SEGMENTS = 192
TERRAIN_RADIAL_SEGMENTS = 128
TERRAIN_UV_METRES = 14.0
RANDOM_SEED = 20260808

# name, source family, x, y, target height, crown width, yaw, age class, tier
TREE_PLACEMENTS = (
    ("Winter_Base_MatureFir_West", "spruce_mature_a", -21.0, 4.0, 17.5, 1.30, -0.18, "mature", "base"),
    ("Winter_Base_MatureFir_East", "pine_lush_a", 16.5, 4.5, 18.5, 1.38, 0.36, "mature", "base"),
    ("Winter_Base_MatureFir_RearWest", "spruce_mature_a", -8.5, 18.5, 16.2, 1.26, 2.72, "mature", "base"),
    ("Winter_Base_MatureFir_RearEast", "pine_lush_a", 10.5, 19.5, 17.0, 1.34, -2.38, "mature", "base"),
    ("Winter_Base_MatureFir_WestRear", "spruce_mature_a", -22.5, 15.0, 15.2, 1.22, 0.58, "mature", "base"),
    ("Winter_Base_MatureFir_EastRear", "pine_lush_a", 22.0, 13.5, 15.8, 1.28, -1.48, "mature", "base"),
    ("Winter_Base_MatureFir_FrontEast", "spruce_mature_a", 15.5, -12.5, 14.5, 1.24, 1.14, "mature", "base"),
    ("Winter_Base_MatureFir_FarWest", "spruce_mature_a", -27.0, 9.0, 14.2, 1.20, 0.93, "mature", "base"),
    ("Winter_Base_MidFir_NorthWest", "fir_mid_a", -14.0, 25.0, 11.8, 1.10, -1.42, "mid", "base"),
    ("Winter_Base_MidFir_NorthEast", "fir_mid_a", 15.5, 25.0, 11.5, 1.12, 1.90, "mid", "base"),
    ("Winter_Base_MidFir_East", "fir_mid_a", 27.5, 3.0, 10.8, 1.08, -2.12, "mid", "base"),
    ("Winter_Base_MidFir_SouthEast", "fir_mid_a", 24.0, -11.0, 10.2, 1.10, 1.32, "mid", "base"),
    ("Winter_Base_MidFir_South", "fir_mid_a", 7.0, -21.0, 10.8, 1.06, 0.18, "mid", "base"),
    ("Winter_Base_MidFir_West", "fir_mid_a", -30.0, -2.0, 10.5, 1.12, 2.65, "mid", "base"),
    ("Winter_Medium_MidFir_01", "fir_mid_a", -27.0, 23.0, 9.8, 1.06, 0.72, "mid", "medium"),
    ("Winter_Medium_MidFir_02", "fir_mid_a", 27.0, 21.0, 10.3, 1.08, -0.55, "mid", "medium"),
    ("Winter_Medium_MidFir_03", "fir_mid_a", 18.0, -21.0, 9.6, 1.04, -2.72, "mid", "medium"),
    ("Winter_Medium_MidFir_04", "fir_mid_a", -18.0, 19.0, 9.4, 1.06, 0.85, "mid", "medium"),
    ("Winter_Medium_MidFir_05", "fir_mid_a", -29.0, 19.0, 9.2, 1.04, 0.26, "mid", "medium"),
    ("Winter_Medium_MidPine_06", "pine_lush_a", 30.0, -9.0, 8.0, 1.12, 1.38, "mid", "medium"),
    ("Winter_Base_YoungFir_01", "sapling_young_a", -10.0, 12.0, 7.2, 1.02, -0.85, "young", "base"),
    ("Winter_Base_YoungPine_02", "sapling_young_a", 10.0, 12.0, 7.5, 1.06, 2.18, "young", "base"),
    ("Winter_Base_YoungFir_03", "sapling_young_a", 1.0, 14.0, 6.6, 1.00, -2.38, "young", "base"),
    ("Winter_Base_YoungPine_04", "sapling_young_a", 10.5, -12.5, 6.8, 1.08, 0.52, "young", "base"),
    ("Winter_Medium_YoungFir_05", "sapling_young_a", -21.0, 28.0, 6.4, 1.02, 1.46, "young", "medium"),
    ("Winter_Medium_YoungPine_06", "sapling_young_a", 5.0, 30.0, 6.8, 1.04, -0.28, "young", "medium"),
    ("Winter_Medium_YoungFir_07", "sapling_young_a", 30.0, 16.0, 6.2, 1.04, 2.52, "young", "medium"),
    ("Winter_Medium_YoungPine_08", "sapling_young_a", 30.0, -20.0, 6.5, 1.06, -1.55, "young", "medium"),
    ("Winter_Medium_YoungFir_09", "sapling_young_a", -25.0, 15.0, 6.0, 1.02, 0.62, "young", "medium"),
    ("Winter_High_YoungPine_10", "conifer_distant_a", -31.0, 16.0, 5.8, 1.04, -2.12, "young", "high"),
    ("Winter_High_YoungFir_11", "conifer_distant_a", 20.0, 29.0, 5.5, 1.00, 1.08, "young", "high"),
    ("Winter_High_YoungPine_12", "conifer_distant_a", 33.0, 5.0, 5.2, 1.04, -0.62, "young", "high"),
    ("Winter_High_YoungFir_13", "conifer_distant_a", 10.0, -31.0, 4.8, 1.00, 0.44, "young", "high"),
    ("Winter_High_YoungPine_14", "conifer_distant_a", -5.0, -32.0, 4.6, 1.02, -1.20, "young", "high"),
)

ROCK_PLACEMENTS = (
    ("Winter_Base_PondBoulder_01", "boulder", -20.0, -8.0, 2.4, 1.7, 1.25, 0.22, 0.10, -0.06, 0.24, "base"),
    ("Winter_Base_PondStone_02", "stone", -8.0, -10.5, 1.5, 1.1, 0.78, -0.35, -0.08, 0.04, 0.22, "base"),
    ("Winter_Base_DeadwoodRock_01", "rock", 11.2, 10.0, 1.7, 1.3, 0.88, 0.52, 0.06, -0.10, 0.28, "base"),
    ("Winter_Base_WestRock_01", "boulder", -9.0, 12.0, 2.0, 1.45, 1.02, -0.18, 0.05, 0.08, 0.25, "base"),
    ("Winter_Medium_EastRock_01", "stone", 18.0, 9.5, 1.8, 1.35, 0.92, 0.30, -0.06, 0.12, 0.22, "medium"),
    ("Winter_Medium_RearRock_01", "rock", -18.5, 16.0, 1.9, 1.4, 0.96, -0.52, 0.08, -0.05, 0.30, "medium"),
    ("Winter_Medium_FrontRock_01", "boulder", 16.5, -14.5, 2.2, 1.55, 1.08, 0.74, -0.10, 0.06, 0.26, "medium"),
    ("Winter_High_FarRock_01", "stone", -26.0, -18.0, 1.6, 1.1, 0.74, 0.15, 0.04, -0.07, 0.24, "high"),
)

DEADWOOD_PLACEMENTS = (
    ("Winter_Base_FallenLog_East", "fallen_log", 12.5, 10.8, 5.6, 1.65, 1.20, 0.34, 0.06, -0.10, 0.20, "base"),
    ("Winter_Base_DeadTrunk_West", "dead_trunk", -20.0, 8.5, 4.8, 1.45, 1.15, -0.55, -0.08, 0.05, 0.24, "base"),
    ("Winter_Medium_FallenLog_Front", "fallen_log", 11.5, -15.5, 5.0, 1.50, 1.08, 1.08, 0.04, 0.08, 0.22, "medium"),
)

for path in (os.path.dirname(BLEND_PATH), QA_DIR):
    os.makedirs(path, exist_ok=True)


def reset_scene_contents():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.worlds,
    ):
        for block in list(blocks):
            blocks.remove(block)


reset_scene_contents()
random.seed(RANDOM_SEED)


def principled_material(name, color, roughness=0.82, metallic=0.0, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (*emission, 1.0)
        strength_input = bsdf.inputs.get("Emission Strength")
        if strength_input:
            strength_input.default_value = emission_strength
    return material


def snow_material():
    material = principled_material("Winter Snow PBR", (0.64, 0.75, 0.88), 0.92)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    image_specs = (
        ("snow-albedo.jpg", "sRGB", "Base Color", None),
        ("snow-roughness.jpg", "Non-Color", "Roughness", None),
        ("snow-normal.jpg", "Non-Color", None, "Normal"),
    )
    for filename, colorspace, direct_input, special in image_specs:
        path = os.path.join(TEXTURE_DIR, filename)
        if not os.path.isfile(path):
            raise RuntimeError(f"Winter texture missing: {path}")
        texture = nodes.new("ShaderNodeTexImage")
        texture.name = f"Winter Snow {filename}"
        texture.image = bpy.data.images.load(path, check_existing=True)
        texture.image.colorspace_settings.name = colorspace
        texture.extension = "REPEAT"
        if direct_input:
            links.new(texture.outputs["Color"], bsdf.inputs[direct_input])
        elif special == "Normal":
            normal = nodes.new("ShaderNodeNormalMap")
            normal.inputs["Strength"].default_value = 0.34
            links.new(texture.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def ice_material():
    material = principled_material("Winter QA Frozen Pond", (0.62, 0.82, 0.94), 0.34)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    for filename, colorspace, input_name in (
        ("ice-surface.webp", "sRGB", "Base Color"),
        ("ice-roughness.webp", "Non-Color", "Roughness"),
    ):
        path = os.path.join(TEXTURE_DIR, filename)
        if not os.path.isfile(path):
            raise RuntimeError(f"Winter ice texture missing: {path}")
        texture = nodes.new("ShaderNodeTexImage")
        texture.name = f"Winter Ice {filename}"
        texture.image = bpy.data.images.load(path, check_existing=True)
        texture.image.colorspace_settings.name = colorspace
        texture.extension = "EXTEND"
        links.new(texture.outputs["Color"], bsdf.inputs[input_name])
    bsdf.inputs["Coat Weight"].default_value = 0.72
    bsdf.inputs["Coat Roughness"].default_value = 0.16
    return material


SNOW = snow_material()
ICE = ice_material()


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def pond_metric(x, y, margin=0.0):
    return math.sqrt(
        ((x - POND_X) / (POND_RX + margin)) ** 2
        + ((y - POND_Y) / (POND_RY + margin)) ** 2
    )


def terrain_boundary_radius(angle):
    """Return the authored outer edge for one direction from the clearing."""
    return (
        WORLD_RADIUS
        + 8.5 * math.sin(angle * 3.0 + 0.7)
        + 5.5 * math.sin(angle * 5.0 - 1.1)
        + 3.0 * math.cos(angle * 9.0 + 0.2)
    )


def terrain_mound(x, y, center_x, center_y, radius, height):
    distance = math.hypot(x - center_x, y - center_y)
    influence = 1.0 - smoothstep(radius * 0.22, radius, distance)
    return height * influence * influence


def terrain_height(x, y):
    radius = math.hypot(x, y)
    if radius <= CLEARING_RADIUS:
        return 0.0
    # The performer zone is mathematically flat. The surrounding terrain rises
    # slowly, then gathers into deeper snow banks near the tree belt.
    bowl = smoothstep(CLEARING_RADIUS, 29.0, radius) * 2.6
    woodland_noise = smoothstep(CLEARING_RADIUS + 0.8, 16.0, radius) * (
        0.25 * math.sin(x * 0.31 + y * 0.17)
        + 0.18 * math.sin(x * 0.13 - y * 0.27)
        + 0.10 * math.cos((x + y) * 0.49)
    )
    outer_influence = smoothstep(27.0, 72.0, radius)
    outer_undulation = outer_influence * (
        0.62 * math.sin(x * 0.058 + y * 0.031)
        + 0.44 * math.cos(x * 0.037 - y * 0.052)
        + 0.28 * math.sin(radius * 0.12 + math.atan2(y, x) * 3.0)
    )
    distant_forms = (
        terrain_mound(x, y, -55.0, 35.0, 31.0, 6.4)
        + terrain_mound(x, y, 43.0, 52.0, 36.0, 5.2)
        + terrain_mound(x, y, 58.0, -28.0, 29.0, 6.0)
        + terrain_mound(x, y, -45.0, -50.0, 35.0, 4.6)
        + terrain_mound(x, y, -105.0, 75.0, 55.0, 7.5)
        + terrain_mound(x, y, 95.0, 82.0, 65.0, 8.0)
        + terrain_mound(x, y, 118.0, -56.0, 55.0, 9.0)
        + terrain_mound(x, y, -90.0, -105.0, 68.0, 7.0)
    )
    base_height = bowl + woodland_noise + outer_undulation + distant_forms
    metric = pond_metric(x, y)
    pond_depression = -(base_height + 0.72) * (
        1.0 - smoothstep(0.55, 1.15, metric)
    )
    pond_bank = 0.18 * (1.0 - smoothstep(0.0, 0.55, abs(metric - 1.0)))
    angle = math.atan2(y, x)
    boundary_radius = terrain_boundary_radius(angle)
    skirt = smoothstep(WORLD_SKIRT_START, 1.0, radius / boundary_radius)
    return base_height + pond_depression + pond_bank - skirt * WORLD_SKIRT_DEPTH


def terrain_snow_uv(x, y):
    """World-planar snow mapping with a smooth warp that breaks grid cadence."""
    warped_x = x + 2.4 * math.sin(y * 0.055) + 1.2 * math.sin((x + y) * 0.037)
    warped_y = y + 2.1 * math.sin(x * 0.049) - 1.0 * math.sin((x - y) * 0.041)
    return (warped_x / TERRAIN_UV_METRES, warped_y / TERRAIN_UV_METRES)


def create_terrain():
    vertices = [(0.0, 0.0, terrain_height(0.0, 0.0))]
    faces = []
    uvs = [terrain_snow_uv(0.0, 0.0)]
    for ring in range(1, TERRAIN_RADIAL_SEGMENTS + 1):
        radial_fraction = ring / TERRAIN_RADIAL_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            angle = math.tau * segment / TERRAIN_ANGULAR_SEGMENTS
            radius = terrain_boundary_radius(angle) * radial_fraction
            x = math.cos(angle) * radius
            y = math.sin(angle) * radius
            vertices.append((x, y, terrain_height(x, y)))
            uvs.append(terrain_snow_uv(x, y))

    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        current = 1 + segment
        following = 1 + (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
        faces.append((0, current, following))

    for ring in range(1, TERRAIN_RADIAL_SEGMENTS):
        inner_start = 1 + (ring - 1) * TERRAIN_ANGULAR_SEGMENTS
        outer_start = inner_start + TERRAIN_ANGULAR_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
            faces.append(
                (
                    inner_start + segment,
                    outer_start + segment,
                    outer_start + following,
                    inner_start + following,
                )
            )

    mesh = bpy.data.meshes.new("Winter Sculpted Snow Mesh")
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=True):
        raise RuntimeError("Winter terrain mesh required validation corrections")
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    uv_layer = mesh.uv_layers.new(name="Winter Snow UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv_layer.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]
    terrain = bpy.data.objects.new("Winter_Base_SculptedSnowHollow", mesh)
    bpy.context.collection.objects.link(terrain)
    terrain.data.materials.append(SNOW)
    terrain["tka_role"] = "terrain"
    terrain["tka_clearing_radius"] = CLEARING_RADIUS
    terrain["tka_boundary_shape"] = "irregular-radial"
    terrain["tka_boundary_min_radius"] = min(
        terrain_boundary_radius(math.tau * segment / TERRAIN_ANGULAR_SEGMENTS)
        for segment in range(TERRAIN_ANGULAR_SEGMENTS)
    )
    terrain["tka_boundary_max_radius"] = max(
        terrain_boundary_radius(math.tau * segment / TERRAIN_ANGULAR_SEGMENTS)
        for segment in range(TERRAIN_ANGULAR_SEGMENTS)
    )
    terrain["tka_skirt_depth"] = WORLD_SKIRT_DEPTH
    terrain["tka_radial_segments"] = TERRAIN_RADIAL_SEGMENTS
    terrain["tka_angular_segments"] = TERRAIN_ANGULAR_SEGMENTS
    terrain["tka_snow_surface_source"] = "ambientcg-snow004"
    terrain["tka_snow_uv_metres"] = TERRAIN_UV_METRES
    return terrain


def organic_outline(cx, cy, rx, ry, count=64):
    points = []
    for index in range(count):
        angle = math.tau * index / count
        irregularity = (
            1.0
            + 0.075 * math.sin(angle * 2.7 + POND_SEED)
            + 0.045 * math.cos(angle * 4.6 + POND_SEED * 1.3)
            + 0.025 * math.sin(angle * 7.1 - POND_SEED * 0.4)
        )
        points.append((cx + math.cos(angle) * rx * irregularity, cy + math.sin(angle) * ry * irregularity))
    return points


def create_pond_preview():
    outline = organic_outline(POND_X, POND_Y, POND_RX, POND_RY)
    vertices = [(POND_X, POND_Y, POND_WATER_HEIGHT)] + [
        (x, y, POND_WATER_HEIGHT) for x, y in outline
    ]
    faces = []
    for index in range(len(outline)):
        faces.append((0, index + 1, ((index + 1) % len(outline)) + 1))
    mesh = bpy.data.meshes.new("Winter QA Pond Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="Winter Pond UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            coordinate = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv_layer.data[loop_index].uv = (
                (coordinate.x - POND_X) / (POND_RX * 2.4) + 0.5,
                (coordinate.y - POND_Y) / (POND_RY * 2.4) + 0.5,
            )
    pond = bpy.data.objects.new("QA_WinterFrozenPond", mesh)
    bpy.context.collection.objects.link(pond)
    pond.data.materials.append(ICE)
    pond["tka_role"] = "qa-pond-preview"
    return pond


def import_tree_sources():
    paths = {
        "stump": (os.path.join(SOURCE_DIR, "tree_stump_01", "tree_stump_01_1k.gltf"), 1),
        # Winter Meshy 6 conifer lineup (Gate 6), replacing the Poly Haven
        # sapling stand-ins. One variant per family; yaw + scale in the
        # placement table provide the visual variety.
        "spruce_mature": (os.path.join(MESHY_TREE_DIR, "mature-snow-spruce_raw.glb"), 1),
        "pine_lush": (os.path.join(MESHY_TREE_DIR, "lush-snow-pine_raw.glb"), 1),
        "fir_mid": (os.path.join(MESHY_TREE_DIR, "mid-snow-fir_raw.glb"), 1),
        "sapling_young": (os.path.join(MESHY_TREE_DIR, "young-snow-sapling_raw.glb"), 1),
        "conifer_distant": (os.path.join(MESHY_TREE_DIR, "distant-snow-conifer_raw.glb"), 1),
    }
    sources = {}
    for family, (path, expected_count) in paths.items():
        if not os.path.isfile(path):
            raise RuntimeError(f"Winter source model missing: {path}")
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
        imported.sort(key=lambda obj: obj.name)
        if len(imported) < expected_count:
            raise RuntimeError(f"Expected {expected_count} {family} variants, found {len(imported)}")
        for index, obj in enumerate(imported[:expected_count]):
            key = f"{family}_{chr(ord('a') + index)}"
            obj.name = f"AssetSource_{key}"
            obj.hide_render = True
            obj.hide_set(True)
            sources[key] = obj
    return sources


def duplicate_tree(source, name, x, y, target_height, crown_width, yaw, age_class, tier):
    tree = source.copy()
    tree.data = source.data
    bpy.context.collection.objects.link(tree)
    tree.name = name
    source_height = max(source.dimensions.z, 0.001)
    scale = target_height / source_height
    tree.scale = (scale * crown_width, scale * crown_width, scale)
    tree.rotation_euler[2] = yaw
    tree.location = (x, y, terrain_height(x, y))
    tree.hide_render = False
    tree.hide_set(False)
    tree["tka_detail_tier"] = tier
    tree["tka_role"] = "conifer"
    tree["tka_age_class"] = age_class
    tree["tka_target_height"] = target_height
    tree["tka_crown_ratio"] = (
        max(source.dimensions.x, source.dimensions.y) / source_height * crown_width
    )
    return tree


def imported_asset_root(asset_id, path):
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Missing required Winter asset: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise RuntimeError(f"Blender imported no objects from {path}")
    root = bpy.data.objects.new(f"AssetSource_{asset_id}", None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)
    for obj in imported:
        obj.name = f"AssetSource_{asset_id}_{obj.name}"
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
    minimum = Vector(
        (min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))
    )
    maximum = Vector(
        (max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))
    )
    return minimum, maximum


def duplicate_hierarchy(source_root, name):
    mapping = {}
    ordered = [source_root, *source_root.children_recursive]
    for source in ordered:
        copy = source.copy()
        copy.data = source.data
        copy.name = source.name.replace("AssetSource_", f"{name}_", 1)
        bpy.context.scene.collection.objects.link(copy)
        mapping[source] = copy
    for source, copy in mapping.items():
        copy.parent = mapping.get(source.parent)
        copy.matrix_parent_inverse = source.matrix_parent_inverse.copy()
        copy.matrix_basis = source.matrix_basis.copy()
    return mapping[source_root]


def place_asset_to_dimensions(
    source_root,
    name,
    position,
    dimensions,
    yaw,
    tilt_x=0.0,
    tilt_y=0.0,
):
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
        @ Matrix.Rotation(yaw, 4, "Z")
        @ Matrix.Rotation(tilt_y, 4, "Y")
        @ Matrix.Rotation(tilt_x, 4, "X")
        @ Matrix.Diagonal(Vector((scale_x, scale_y, scale_z, 1.0)))
        @ normalize
    )
    return root


def hide_source(root):
    root.hide_render = True
    root.hide_viewport = True
    for obj in root.children_recursive:
        obj.hide_render = True
        obj.hide_viewport = True


def blender_readable_rock_source(filename):
    source = os.path.join(ROCK_SOURCE_DIR, filename)
    cache_dir = os.path.join(QA_DIR, "rock-sources")
    output = os.path.join(cache_dir, filename)
    os.makedirs(cache_dir, exist_ok=True)
    if not os.path.isfile(source):
        raise FileNotFoundError(f"Missing Autumn rock source: {source}")
    if not os.path.isfile(output) or os.path.getmtime(output) < os.path.getmtime(source):
        npx = "npx.cmd" if os.name == "nt" else "npx"
        subprocess.run(
            [npx, "gltf-transform", "copy", source, output],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    return output


def import_prop_sources():
    sources = {
        "boulder": imported_asset_root(
            "WinterBoulder", blender_readable_rock_source("boulder_01.glb")
        ),
        "rock": imported_asset_root(
            "WinterRock", blender_readable_rock_source("rock_07.glb")
        ),
        "stone": imported_asset_root(
            "WinterStone", blender_readable_rock_source("stone_01.glb")
        ),
        "fallen_log": imported_asset_root(
            "WinterFallenLog", os.path.join(AUTUMN_MODEL_DIR, "fallen-log_raw.glb")
        ),
        "dead_trunk": imported_asset_root(
            "WinterDeadTrunk",
            os.path.join(SOURCE_DIR, "dead_tree_trunk_02", "dead_tree_trunk_02_1k.gltf"),
        ),
    }
    return sources


def annotate_prop(root, tier, role, family, burial):
    for obj in [root, *root.children_recursive]:
        obj["tka_detail_tier"] = tier
        obj["tka_role"] = role
        obj["tka_source_family"] = family
        obj["tka_burial_fraction"] = burial


def create_rocks(sources):
    for name, family, x, y, sx, sy, sz, yaw, tilt_x, tilt_y, burial, tier in ROCK_PLACEMENTS:
        root = place_asset_to_dimensions(
            sources[family],
            name,
            (x, y, terrain_height(x, y) - sz * burial),
            (sx, sy, sz),
            yaw,
            tilt_x,
            tilt_y,
        )
        annotate_prop(root, tier, "rock", family, burial)


def create_deadwood(sources):
    for name, family, x, y, sx, sy, sz, yaw, tilt_x, tilt_y, burial, tier in DEADWOOD_PLACEMENTS:
        root = place_asset_to_dimensions(
            sources[family],
            name,
            (x, y, terrain_height(x, y) - sz * burial),
            (sx, sy, sz),
            yaw,
            tilt_x,
            tilt_y,
        )
        annotate_prop(root, tier, "deadwood", family, burial)

    for source in sources.values():
        hide_source(source)


def create_cylinder_between(name, start, end, radius, material, vertices=18):
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    return obj


def create_stumps(source):
    placements = (("Winter_Base_DeadwoodStump_East", 9.3, 10.7, 1.35, 1.24, -0.35, 0.22, "base"),)
    source_height = max(source.dimensions.z, 0.001)
    for name, x, y, target_height, width, yaw, burial, tier in placements:
        stump = source.copy()
        stump.data = source.data
        bpy.context.collection.objects.link(stump)
        stump.name = name
        scale = target_height / source_height
        stump.scale = (scale * width, scale * width, scale)
        stump.rotation_euler = (0.05, -0.08, yaw)
        stump.location = (x, y, terrain_height(x, y) - target_height * burial)
        stump.hide_render = False
        stump.hide_set(False)
        stump["tka_detail_tier"] = tier
        stump["tka_role"] = "stump"
        stump["tka_source_family"] = "tree_stump_01"
        stump["tka_burial_fraction"] = burial

def verify_layout(tree_records):
    flat_samples = []
    for y in range(-8, 9):
        for x in range(-8, 9):
            if math.hypot(x, y) <= CLEARING_RADIUS:
                flat_samples.append(abs(terrain_height(x, y)))
    maximum_flat_deviation = max(flat_samples)
    if maximum_flat_deviation > 0.02:
        raise RuntimeError(f"Performance clearing is not flat: {maximum_flat_deviation:.4f}m")

    boundary_radii = [
        terrain_boundary_radius(math.tau * segment / TERRAIN_ANGULAR_SEGMENTS)
        for segment in range(TERRAIN_ANGULAR_SEGMENTS)
    ]
    minimum_boundary_radius = min(boundary_radii)
    maximum_boundary_radius = max(boundary_radii)
    if minimum_boundary_radius < 148.0:
        raise RuntimeError(
            f"Terrain envelope is too small: {minimum_boundary_radius:.3f}m"
        )
    if maximum_boundary_radius - minimum_boundary_radius < 20.0:
        raise RuntimeError("Terrain boundary lost its irregular silhouette")
    skirt_drops = []
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        angle = math.tau * segment / TERRAIN_ANGULAR_SEGMENTS
        boundary_radius = terrain_boundary_radius(angle)
        inner_radius = boundary_radius * WORLD_SKIRT_START
        inner_height = terrain_height(
            math.cos(angle) * inner_radius,
            math.sin(angle) * inner_radius,
        )
        edge_height = terrain_height(
            math.cos(angle) * boundary_radius,
            math.sin(angle) * boundary_radius,
        )
        skirt_drops.append(inner_height - edge_height)
    minimum_skirt_drop = min(skirt_drops)
    if minimum_skirt_drop < 8.0:
        raise RuntimeError(
            f"Terrain skirt is too shallow: {minimum_skirt_drop:.3f}m"
        )
    pond_angle = math.atan2(-POND_Y, -POND_X)
    pond_directional_radius = 1.0 / math.sqrt(
        (math.cos(pond_angle) / POND_RX) ** 2
        + (math.sin(pond_angle) / POND_RY) ** 2
    )
    nearest_pond_edge = math.hypot(POND_X, POND_Y) - pond_directional_radius
    if nearest_pond_edge < CLEARING_RADIUS + 1.0:
        raise RuntimeError(f"Pond enters the clearing: nearest edge {nearest_pond_edge:.3f}m")
    for tree in tree_records:
        if math.hypot(tree.location.x, tree.location.y) < CLEARING_RADIUS + 1.0:
            raise RuntimeError(f"Tree entered the performance buffer: {tree.name}")
        if pond_metric(tree.location.x, tree.location.y, 1.0) < 1.0:
            raise RuntimeError(f"Tree entered the pond buffer: {tree.name}")
        if tree["tka_age_class"] == "young" and tree["tka_target_height"] > 8.0:
            raise RuntimeError(f"Sapling exceeded eight metres: {tree.name}")

    age_counts = {
        age: sum(1 for tree in tree_records if tree["tka_age_class"] == age)
        for age in ("mature", "mid", "young")
    }
    if age_counts != {"mature": 8, "mid": 12, "young": 14}:
        raise RuntimeError(f"Tree age-class contract drifted: {age_counts}")
    tier_counts = {
        tier: sum(1 for tree in tree_records if tree["tka_detail_tier"] == tier)
        for tier in ("base", "medium", "high")
    }
    if tier_counts != {"base": 18, "medium": 11, "high": 5}:
        raise RuntimeError(f"Tree tier contract drifted: {tier_counts}")
    lush_count = sum(1 for tree in tree_records if tree["tka_crown_ratio"] >= 0.30)
    if lush_count < 8:
        raise RuntimeError(f"Only {lush_count} trees meet the lush-crown contract")

    prop_placements = [*ROCK_PLACEMENTS, *DEADWOOD_PLACEMENTS]
    for placement in prop_placements:
        name, _family, x, y, sx, sy, _sz, _yaw, _tilt_x, _tilt_y, burial, _tier = placement
        nearest_edge = math.hypot(x, y) - max(sx, sy) * 0.5
        if nearest_edge < CLEARING_RADIUS + 1.0:
            raise RuntimeError(f"Prop entered the performance buffer: {name}")
        if burial < 0.15 or burial > 0.35:
            raise RuntimeError(f"Prop burial left the approved range: {name}={burial:.2f}")

    print("\nWinter ecology verification")
    print(f"Flat clearing maximum deviation: {maximum_flat_deviation:.4f} m")
    print(
        "Terrain boundary radius:         "
        f"{minimum_boundary_radius:.3f} to {maximum_boundary_radius:.3f} m"
    )
    print(f"Minimum outer skirt drop:        {minimum_skirt_drop:.3f} m")
    print(f"Nearest pond bank:              {nearest_pond_edge:.3f} m")
    print(f"Tree age classes:               {age_counts}")
    print(f"Tree tiers:                     {tier_counts}")
    print(f"Lush crown count:               {lush_count}")


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, color, energy, size, target):
    data = bpy.data.lights.new(name, type="AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(f"QA_{name}", data)
    bpy.context.collection.objects.link(light)
    light.location = location
    aim_at(light, target)
    return light


def create_qa_performer():
    material = principled_material("QA Performer", (0.018, 0.023, 0.034), 0.55)
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.13, location=(0.0, 0.0, 1.62))
    parts.append(bpy.context.object)
    torso = create_cylinder_between("QA_PerformerTorso", (0.0, 0.0, 0.72), (0.0, 0.0, 1.49), 0.115, material, 16)
    parts.append(torso)
    for suffix, start, end in (
        ("ArmL", (-0.06, 0.0, 1.35), (-0.56, 0.0, 1.02)),
        ("ArmR", (0.06, 0.0, 1.35), (0.56, 0.0, 1.02)),
        ("LegL", (-0.05, 0.0, 0.76), (-0.22, 0.0, 0.04)),
        ("LegR", (0.05, 0.0, 0.76), (0.22, 0.0, 0.04)),
    ):
        parts.append(create_cylinder_between(f"QA_Performer{suffix}", start, end, 0.055, material, 12))
    for part in parts:
        part.name = part.name if part.name.startswith("QA_") else f"QA_{part.name}"
        if material not in part.data.materials.values():
            part.data.materials.append(material)
    return parts


def render_qa_view(camera, location, target, path, lens=42):
    camera.location = location
    camera.data.lens = lens
    aim_at(camera, target)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def setup_qa_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 18
    scene.render.resolution_percentage = 100
    scene.render.engine = "BLENDER_EEVEE"
    scene.world = bpy.data.worlds.new("Winter Moonlit World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.018, 0.045, 0.12, 1.0)
    background.inputs["Strength"].default_value = 0.48

    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.color_mode = "RGB"

    add_area_light("MoonKey", (-16.0, -11.0, 28.0), (0.48, 0.67, 1.0), 3300.0, 16.0, (0.0, 4.0, 0.0))
    add_area_light("MoonRim", (18.0, 20.0, 20.0), (0.32, 0.52, 1.0), 2300.0, 12.0, (0.0, 5.0, 3.0))
    add_area_light("FireBounce", (7.0, -3.5, 5.0), (1.0, 0.20, 0.045), 620.0, 4.0, (2.0, 1.0, 0.0))

    camera_data = bpy.data.cameras.new("Winter QA Camera")
    camera = bpy.data.objects.new("QA_WinterCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    create_qa_performer()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    render_qa_view(camera, (0.0, -31.0, 8.0), (-3.0, -2.0, 2.0), QA_PATHS["hero"], 38)
    render_qa_view(camera, (-2.0, -18.0, 5.5), (POND_X, POND_Y, 0.2), QA_PATHS["pond"], 43)
    render_qa_view(camera, (2.0, -20.0, 6.0), (16.0, -4.0, 6.0), QA_PATHS["trees"], 41)
    render_qa_view(camera, (1.0, -2.0, 3.6), (11.0, 11.0, 0.3), QA_PATHS["props"], 42)
    render_qa_view(camera, (0.0, 30.0, 10.0), (0.0, 0.0, 2.0), QA_PATHS["reverse"], 38)
    render_qa_view(camera, (0.0, -7.0, 2.1), (0.0, 0.0, 1.3), QA_PATHS["walk"], 31)
    render_qa_view(camera, (0.0, -36.0, 48.0), (0.0, 0.0, 2.0), QA_PATHS["world"], 34)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


terrain = create_terrain()
pond_preview = create_pond_preview()
tree_sources = import_tree_sources()
prop_sources = import_prop_sources()
tree_records = []
for name, source_key, x, y, target_height, crown_width, yaw, age_class, tier in TREE_PLACEMENTS:
    tree = duplicate_tree(
        tree_sources[source_key],
        name,
        x,
        y,
        target_height,
        crown_width,
        yaw,
        age_class,
        tier,
    )
    tree_records.append(tree)

snow_cap_count = 0
create_rocks(prop_sources)
create_deadwood(prop_sources)
create_stumps(tree_sources["stump_a"])
verify_layout(tree_records)
setup_qa_render()

print("\nMoonlit Winter Hollow authored")
print(f"Trees:     {len(tree_records)}")
print(f"Snow caps: {snow_cap_count}")
print(f"Blend:     {BLEND_PATH}")
for label, path in QA_PATHS.items():
    print(f"QA {label:8}: {path}")
