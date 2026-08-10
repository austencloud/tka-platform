"""Author the Moonlit Winter Hollow environment in Blender.

The scene is a composed winter landscape, not a radial scatter. A level
eight-metre performance clearing is surrounded by sculpted snow banks, hero
conifers, a frozen pond basin, fallen timber, and a layered distant tree belt.
The approved Meshy 6 conifer family provides the tree geometry and PBR
materials; linked duplicates preserve GPU-instancing opportunities in the
exported glTF.

The editable ``blender/winter_environment.blend`` file is the source of truth.
QA renders are written to the system temp directory, while
``blender-export-winter-full.py`` creates the clean runtime GLB.
"""

import hashlib
import json
import math
import os
import random
import re
import subprocess
import tempfile

import bpy
from mathutils import Matrix, Quaternion, Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
SOURCE_DIR = os.path.join(PROJECT_ROOT, "assets", "3d-source", "winter")
TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "winter")
AUTUMN_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "autumn-floor")
ROCK_SOURCE_DIR = os.path.join(PROJECT_ROOT, "static", "models", "ocean", "polyhaven")
MESHY_TREE_DIR = os.path.join(PROJECT_ROOT, "static", "models", "winter", "trees")
MESHY_SETTLEMENT_DIR = os.path.join(
    PROJECT_ROOT, "static", "models", "winter", "settlement"
)
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
    "settlement": os.path.join(QA_DIR, "winter_environment_qa_settlement.png"),
    "lodge": os.path.join(QA_DIR, "winter_environment_qa_lodge.png"),
    "hearth": os.path.join(QA_DIR, "winter_environment_qa_hearth.png"),
}
SETTLEMENT_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "winter-settlement-layout.json")
with open(SETTLEMENT_LAYOUT_PATH, "rb") as settlement_layout_file:
    SETTLEMENT_LAYOUT_BYTES = settlement_layout_file.read()
SETTLEMENT_LAYOUT = json.loads(SETTLEMENT_LAYOUT_BYTES.decode("utf-8"))
SETTLEMENT_LAYOUT_SHA256 = hashlib.sha256(SETTLEMENT_LAYOUT_BYTES).hexdigest()
FIRE_COURT_CONTRACT_PATH = os.path.join(
    SCRIPT_DIR, "winter-fire-court-graybox-r1.json"
)
with open(FIRE_COURT_CONTRACT_PATH, "rb") as fire_court_contract_file:
    FIRE_COURT_CONTRACT_BYTES = fire_court_contract_file.read()
FIRE_COURT_CONTRACT = json.loads(FIRE_COURT_CONTRACT_BYTES.decode("utf-8"))
FIRE_COURT_CONTRACT_SHA256 = hashlib.sha256(FIRE_COURT_CONTRACT_BYTES).hexdigest()
COMPOSITION_PLAN_PATH = os.path.join(SCRIPT_DIR, "winter-composition-gate1-r2.json")
with open(COMPOSITION_PLAN_PATH, "rb") as composition_plan_file:
    COMPOSITION_PLAN_BYTES = composition_plan_file.read()
COMPOSITION_PLAN = json.loads(COMPOSITION_PLAN_BYTES.decode("utf-8"))
COMPOSITION_PLAN_SHA256 = hashlib.sha256(COMPOSITION_PLAN_BYTES).hexdigest()
LODGE_PRODUCTION_PATH = os.path.join(SCRIPT_DIR, "winter-lodge-production.json")
with open(LODGE_PRODUCTION_PATH, "rb") as lodge_production_file:
    LODGE_PRODUCTION_BYTES = lodge_production_file.read()
LODGE_PRODUCTION = json.loads(LODGE_PRODUCTION_BYTES.decode("utf-8"))
LODGE_PRODUCTION_SHA256 = hashlib.sha256(LODGE_PRODUCTION_BYTES).hexdigest()
HEARTH_PRODUCTION_PATH = os.path.join(SCRIPT_DIR, "winter-hearth-production.json")
with open(HEARTH_PRODUCTION_PATH, "rb") as hearth_production_file:
    HEARTH_PRODUCTION_BYTES = hearth_production_file.read()
HEARTH_PRODUCTION = json.loads(HEARTH_PRODUCTION_BYTES.decode("utf-8"))
HEARTH_PRODUCTION_SHA256 = hashlib.sha256(HEARTH_PRODUCTION_BYTES).hexdigest()
TREE_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "winter-tree-layout.json")
with open(TREE_LAYOUT_PATH, "rb") as tree_layout_file:
    TREE_LAYOUT_BYTES = tree_layout_file.read()
TREE_LAYOUT = json.loads(TREE_LAYOUT_BYTES.decode("utf-8"))
TREE_LAYOUT_SHA256 = hashlib.sha256(TREE_LAYOUT_BYTES).hexdigest()
TREE_ASSETS = {asset["id"]: asset for asset in TREE_LAYOUT["assets"]}
COMPOSER_PLACEMENTS_PATH = os.path.join(
    SCRIPT_DIR, "winter-composer-placements.json"
)
with open(COMPOSER_PLACEMENTS_PATH, "r", encoding="utf-8") as composer_file:
    COMPOSER_MANIFEST = json.load(composer_file)
COMPOSER_PLACEMENTS = {
    placement["id"]: placement
    for placement in COMPOSER_MANIFEST.get("placements", [])
}
COMPOSER_CATALOG_ASSETS = {
    "winter-pine-tall": os.path.join(
        PROJECT_ROOT, "static", "models", "winter", "tree_pineTallA.glb"
    ),
    "winter-pine-round": os.path.join(
        PROJECT_ROOT, "static", "models", "winter", "tree_pineRoundB.glb"
    ),
    "winter-pine-small": os.path.join(
        PROJECT_ROOT, "static", "models", "winter", "tree_pineSmallA.glb"
    ),
    "winter-rock-large-a": os.path.join(
        PROJECT_ROOT, "static", "models", "winter", "rock_largeA.glb"
    ),
    "winter-rock-large-b": os.path.join(
        PROJECT_ROOT, "static", "models", "winter", "rock_largeB.glb"
    ),
    "winter-fallen-log": os.path.join(
        PROJECT_ROOT, "static", "models", "winter", "log_large.glb"
    ),
}

RUNTIME_FROM_BLENDER = Matrix(
    (
        (1.0, 0.0, 0.0, 0.0),
        (0.0, 0.0, 1.0, 0.0),
        (0.0, -1.0, 0.0, 0.0),
        (0.0, 0.0, 0.0, 1.0),
    )
)
BLENDER_FROM_RUNTIME = RUNTIME_FROM_BLENDER.inverted()

COMPOSER_EDITABLE_ROLES = {
    "conifer",
    "rock",
    "deadwood",
    "stump",
    "settlement-seat",
    "settlement-hearth-stone",
    "settlement-hearth-fuel",
    "settlement-hearth-ember",
    "lodge-woodpile-log",
}


def normalize_composer_name(value):
    return re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def winter_composer_id(role, name):
    return f"winter:{normalize_composer_name(role)}:{normalize_composer_name(name)}"


def runtime_placement_matrix(placement):
    x, y, z = placement["position"]
    qx, qy, qz, qw = placement["rotation"]
    sx, sy, sz = placement["scale"]
    runtime_matrix = (
        Matrix.Translation(Vector((x, y, z)))
        @ Quaternion((qw, qx, qy, qz)).to_matrix().to_4x4()
        @ Matrix.Diagonal(Vector((sx, sy, sz, 1.0)))
    )
    return BLENDER_FROM_RUNTIME @ runtime_matrix @ RUNTIME_FROM_BLENDER


def apply_composer_placement(root, role, object_key=None):
    placement_id = winter_composer_id(role, root.name)
    members = [root, *root.children_recursive]
    for member in members:
        member["tka_composer_id"] = placement_id
        member["tka_composer_object_key"] = object_key or role
        member["tka_composer_locked"] = role not in COMPOSER_EDITABLE_ROLES

    placement = COMPOSER_PLACEMENTS.get(placement_id)
    if not placement or placement.get("source") != "native":
        return placement_id

    root.matrix_world = runtime_placement_matrix(placement)
    visible = placement.get("visible", True)
    for member in members:
        member.hide_render = not visible
        member.hide_set(not visible)

    if role == "conifer":
        bpy.context.view_layer.update()
        root["tka_plan_x"] = root.matrix_world.translation.x
        root["tka_plan_y"] = root.matrix_world.translation.y
        minimum_z = min(
            (member.matrix_world @ Vector(corner)).z
            for member in members
            if member.type == "MESH"
            for corner in member.bound_box
        )
        contact_height = terrain_contact_height(
            root["tka_plan_x"],
            root["tka_plan_y"],
            root["tka_root_contact_radius"],
        )
        intended_minimum_z = contact_height - root["tka_root_bed_depth"]
        root["tka_contact_height"] = contact_height
        root["tka_grounded_minimum_z"] = minimum_z
        root["tka_grounding_error"] = abs(minimum_z - intended_minimum_z)
    return placement_id
SETTLEMENT_PATH_CORRIDORS = tuple(
    {
        "id": path["id"],
        "role": path["role"],
        "halfWidth": path["treeHalfWidth"],
        "shoulderWidth": path["treeShoulderWidth"],
        "points": [[point[0], -point[1]] for point in path["points"]],
    }
    for path in SETTLEMENT_LAYOUT["paths"]
)
TREE_CORRIDORS = tuple(TREE_LAYOUT["corridors"]) + SETTLEMENT_PATH_CORRIDORS
HERO_APPROACH = next(
    corridor for corridor in TREE_CORRIDORS if corridor["id"] == "hero-approach"
)

CLEARING_RADIUS = 8.0
FIRE_COURT_LAYOUT = FIRE_COURT_CONTRACT["court"]
FIRE_COURT_X = FIRE_COURT_LAYOUT["center"][0]
FIRE_COURT_Y = -FIRE_COURT_LAYOUT["center"][1]
# The social clearing includes the court, every friend, both benches, the prop
# rack, and the lantern-marked entrance. Deriving the envelope from the same
# contract prevents a later seating adjustment from leaving somebody standing
# on the sloped snow just outside the fire-safe surface.
FIRE_COURT_SOCIAL_RUNTIME_POINTS = [
    (
        FIRE_COURT_LAYOUT["center"][0]
        + x_sign
        * (FIRE_COURT_LAYOUT["radiusX"] + FIRE_COURT_LAYOUT["safetyBuffer"]),
        FIRE_COURT_LAYOUT["center"][1]
        + z_sign
        * (FIRE_COURT_LAYOUT["radiusZ"] + FIRE_COURT_LAYOUT["safetyBuffer"]),
    )
    for x_sign in (-1, 1)
    for z_sign in (-1, 1)
]
FIRE_COURT_SOCIAL_RUNTIME_POINTS.extend(
    tuple(friend["position"]) for friend in FIRE_COURT_CONTRACT["friends"]
)
FIRE_COURT_SOCIAL_RUNTIME_POINTS.extend(
    tuple(bench["center"])
    for bench in FIRE_COURT_CONTRACT["furnishings"]["benchSegments"]
)
FIRE_COURT_SOCIAL_RUNTIME_POINTS.extend(
    tuple(lantern["position"])
    for lantern in FIRE_COURT_CONTRACT["furnishings"]["entryLanterns"]
)
FIRE_COURT_SOCIAL_RUNTIME_POINTS.append(
    tuple(FIRE_COURT_CONTRACT["furnishings"]["propRack"]["position"])
)
FIRE_COURT_SOCIAL_MARGIN = 1.5
FIRE_COURT_SOCIAL_MIN_X = min(
    point[0] for point in FIRE_COURT_SOCIAL_RUNTIME_POINTS
) - FIRE_COURT_SOCIAL_MARGIN
FIRE_COURT_SOCIAL_MAX_X = max(
    point[0] for point in FIRE_COURT_SOCIAL_RUNTIME_POINTS
) + FIRE_COURT_SOCIAL_MARGIN
FIRE_COURT_SOCIAL_MIN_Z = min(
    point[1] for point in FIRE_COURT_SOCIAL_RUNTIME_POINTS
) - FIRE_COURT_SOCIAL_MARGIN
FIRE_COURT_SOCIAL_MAX_Z = max(
    point[1] for point in FIRE_COURT_SOCIAL_RUNTIME_POINTS
) + FIRE_COURT_SOCIAL_MARGIN
FIRE_COURT_SOCIAL_X = (FIRE_COURT_SOCIAL_MIN_X + FIRE_COURT_SOCIAL_MAX_X) * 0.5
FIRE_COURT_SOCIAL_Y = -(
    (FIRE_COURT_SOCIAL_MIN_Z + FIRE_COURT_SOCIAL_MAX_Z) * 0.5
)
FIRE_COURT_SOCIAL_RADIUS_X = (
    FIRE_COURT_SOCIAL_MAX_X - FIRE_COURT_SOCIAL_MIN_X
) * 0.5
FIRE_COURT_SOCIAL_RADIUS_Y = (
    FIRE_COURT_SOCIAL_MAX_Z - FIRE_COURT_SOCIAL_MIN_Z
) * 0.5
# Continue the established zero-metre clearing grade beneath the court. The
# review court is a shallow inset whose slab intersects this surface; lowering
# terrain to the slab bottom would create a visible basin and break the flat
# gathering clearing where the two spaces meet.
FIRE_COURT_GROUND_HEIGHT = 0.0
POND_LAYOUT = SETTLEMENT_LAYOUT["pond"]
POND_X = POND_LAYOUT["center"][0]
POND_Y = -POND_LAYOUT["center"][1]
POND_RX = POND_LAYOUT["radiusX"]
POND_RY = POND_LAYOUT["radiusZ"]
POND_SEED = POND_LAYOUT["seed"]
POND_WATER_HEIGHT = POND_LAYOUT["surfaceElevation"]
STAGE_LAYOUT = SETTLEMENT_LAYOUT["stage"]
RAMP_LAYOUT = SETTLEMENT_LAYOUT["ramp"]
LODGE_LAYOUT = SETTLEMENT_LAYOUT["lodge"]
HEARTH_LAYOUT = SETTLEMENT_LAYOUT["hearth"]
LODGE_X = LODGE_LAYOUT["center"][0]
LODGE_Y = -LODGE_LAYOUT["center"][1]
HEARTH_X = HEARTH_LAYOUT["center"][0]
HEARTH_Y = -HEARTH_LAYOUT["center"][1]
WORLD_RADIUS = 170.0
WORLD_SKIRT_START = 0.86
WORLD_SKIRT_DEPTH = 14.0
TERRAIN_ANGULAR_SEGMENTS = 192
TERRAIN_RADIAL_SEGMENTS = 128
TERRAIN_UV_METRES = 14.0
RANDOM_SEED = 20260808

APPROVED_ARRANGEMENT = COMPOSITION_PLAN["proposedArrangement"]
for landmark_id, settlement_landmark in (
    ("stage", STAGE_LAYOUT),
    ("lodge", LODGE_LAYOUT),
    ("hearth", HEARTH_LAYOUT),
    ("pond", POND_LAYOUT),
):
    if settlement_landmark["center"] != APPROVED_ARRANGEMENT[landmark_id]["center"]:
        raise RuntimeError(
            f"Winter {landmark_id} drifted from the approved Gate 1 composition"
        )
if COMPOSITION_PLAN["status"] != "approved":
    raise RuntimeError("Winter production requires an approved Gate 1 composition")

# The generated and scanned sources contain dense reconstruction topology that
# cannot be reduced effectively after glTF export because UV and normal seams
# become hard simplification boundaries. Decimate each shared source once in
# Blender; every linked placement then inherits the lighter authored mesh.
TREE_SOURCE_DECIMATION = {
    "spruce_mature": 0.52,
    "pine_lush": 0.52,
    "fir_mid": 0.48,
    "sapling_young": 0.44,
    # Horizon trees reuse the approved detailed Meshy families at a measured
    # distance LOD. The retired 8k silhouette source is intentionally absent.
    "fir_distant": 0.26,
    "sapling_distant": 0.24,
    "spruce_windswept": 0.30,
}
PROP_SOURCE_DECIMATION = {
    "boulder": 0.22,
    "rock": 0.18,
    "stone": 0.28,
    "fallen_log": 0.34,
    "dead_trunk": 0.34,
}

ROCK_PLACEMENTS = (
    ("Winter_Base_PondBoulder_01", "boulder", 9.5, 10.2, 2.4, 1.7, 1.25, 0.22, 0.10, -0.06, 0.24, "base"),
    ("Winter_Base_PondStone_02", "stone", 22.8, 12.0, 1.5, 1.1, 0.78, -0.35, -0.08, 0.04, 0.22, "base"),
    ("Winter_Base_DeadwoodRock_01", "rock", 28.0, 7.0, 1.7, 1.3, 0.88, 0.52, 0.06, -0.10, 0.28, "base"),
    ("Winter_Base_WestRock_01", "boulder", -24.0, 13.0, 2.0, 1.45, 1.02, -0.18, 0.05, 0.08, 0.25, "base"),
    ("Winter_Medium_EastRock_01", "stone", 24.0, 5.0, 1.8, 1.35, 0.92, 0.30, -0.06, 0.12, 0.22, "medium"),
    ("Winter_Medium_RearRock_01", "rock", -18.5, 16.0, 1.9, 1.4, 0.96, -0.52, 0.08, -0.05, 0.30, "medium"),
    ("Winter_Medium_FrontRock_01", "boulder", 16.5, -14.5, 2.2, 1.55, 1.08, 0.74, -0.10, 0.06, 0.26, "medium"),
    ("Winter_High_FarRock_01", "stone", -26.0, -18.0, 1.6, 1.1, 0.74, 0.15, 0.04, -0.07, 0.24, "high"),
    ("Winter_Medium_PathRock_WestNear", "stone", -10.2, -26.0, 1.35, 0.95, 0.70, -0.44, 0.05, 0.08, 0.25, "medium"),
    ("Winter_Medium_PathRock_EastNear", "rock", 11.4, -29.0, 1.45, 1.05, 0.76, 0.38, -0.06, 0.04, 0.26, "medium"),
    ("Winter_High_PathRock_WestFar", "boulder", -11.5, -46.0, 1.25, 0.92, 0.68, 0.18, 0.04, -0.05, 0.24, "high"),
    ("Winter_High_PathRock_EastFar", "stone", 11.0, -50.0, 1.30, 0.90, 0.66, -0.28, -0.05, 0.07, 0.24, "high"),
)

DEADWOOD_PLACEMENTS = (
    ("Winter_Base_FallenLog_East", "fallen_log", 29.0, 13.5, 5.6, 1.65, 1.20, 0.34, 0.06, -0.10, 0.20, "base"),
    ("Winter_Base_DeadTrunk_West", "dead_trunk", -20.0, 8.5, 4.8, 1.45, 1.15, -0.55, -0.08, 0.05, 0.24, "base"),
    ("Winter_Medium_FallenLog_Front", "fallen_log", 11.5, -15.5, 5.0, 1.50, 1.08, 1.08, 0.04, 0.08, 0.22, "medium"),
    ("Winter_Medium_PathLog_West", "fallen_log", -12.5, -36.0, 3.7, 1.08, 0.82, -0.72, 0.03, -0.07, 0.24, "medium"),
    ("Winter_High_PathTrunk_East", "dead_trunk", 12.8, -40.0, 3.4, 1.02, 0.78, 0.64, -0.05, 0.06, 0.24, "high"),
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


def snow_material(
    name="Winter Snow PBR",
    albedo_tint=None,
    normal_strength=0.34,
):
    material = principled_material(name, (0.64, 0.75, 0.88), 0.92)
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
            normal.inputs["Strength"].default_value = normal_strength
            links.new(texture.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    if albedo_tint:
        albedo = nodes.get("Winter Snow snow-albedo.jpg")
        for link in list(bsdf.inputs["Base Color"].links):
            links.remove(link)
        tint = nodes.new("ShaderNodeMixRGB")
        tint.blend_type = "MULTIPLY"
        tint.inputs[0].default_value = 1.0
        tint.inputs[2].default_value = (*albedo_tint, 1.0)
        links.new(albedo.outputs["Color"], tint.inputs[1])
        links.new(tint.outputs["Color"], bsdf.inputs["Base Color"])
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


def hearth_soil_material():
    """Reuse the authored soil scan so the exposed fire bed has real grain."""
    material = principled_material(
        "Winter Hearth Mineral Bed", (0.085, 0.066, 0.052), 0.99
    )
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    texture_path = os.path.join(AUTUMN_TEXTURE_DIR, "soil-albedo.jpg")
    if not os.path.isfile(texture_path):
        raise RuntimeError(f"Winter hearth soil texture missing: {texture_path}")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Winter Hearth Soil Albedo"
    texture.image = bpy.data.images.load(texture_path, check_existing=True)
    texture.image.colorspace_settings.name = "sRGB"
    texture.extension = "REPEAT"
    links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    return material


SNOW = snow_material()
ICE = ice_material()
SETTLEMENT_PATH = snow_material(
    "Winter Settlement Packed Snow", (0.82, 0.88, 0.94), 0.12
)
SETTLEMENT_TIMBER = principled_material(
    "Winter Settlement Graybox Timber", (0.22, 0.15, 0.11), 0.88
)
SETTLEMENT_WALL = principled_material(
    "Winter Settlement Graybox Wall", (0.32, 0.34, 0.35), 0.9
)
SETTLEMENT_ROOF = principled_material(
    "Winter Settlement Graybox Roof", (0.16, 0.19, 0.22), 0.86
)
LODGE_BARK = principled_material(
    "Winter Lodge Split Firewood Bark", (0.19, 0.105, 0.055), 0.94
)
LODGE_CUT_WOOD = principled_material(
    "Winter Lodge Split Firewood Ends", (0.50, 0.30, 0.14), 0.84
)
HEARTH_MELT = snow_material(
    "Winter Hearth Heat-darkened Snow", (0.38, 0.44, 0.52), 0.24
)
HEARTH_MINERAL = hearth_soil_material()
HEARTH_ASH = principled_material(
    "Winter Hearth Ash", (0.115, 0.105, 0.095), 1.0
)
HEARTH_CHARCOAL = principled_material(
    "Winter Hearth Charred Fuel", (0.028, 0.018, 0.014), 0.92
)
HEARTH_CUT_WOOD = principled_material(
    "Winter Hearth Split Fuel Ends", (0.31, 0.135, 0.045), 0.88
)
HEARTH_EMBER = principled_material(
    "Winter Hearth Ember", (0.45, 0.035, 0.005), 0.62, emission=(1.0, 0.055, 0.004), emission_strength=5.0
)


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def runtime_point_to_blender(point):
    return (point[0], -point[1])


def local_front_yaw(center, target):
    """Rotate a local -Y front so it faces a Blender-plan target."""
    direction_x = target[0] - center[0]
    direction_y = target[1] - center[1]
    return math.atan2(direction_x, -direction_y)


def settlement_local_coordinates(x, y, center, yaw):
    dx = x - center[0]
    dy = y - center[1]
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    return (
        dx * cosine + dy * sine,
        -dx * sine + dy * cosine,
    )


LODGE_CENTER = (LODGE_X, LODGE_Y)
LODGE_FRONT_TARGET = runtime_point_to_blender(LODGE_LAYOUT["frontFaces"])
LODGE_YAW = local_front_yaw(LODGE_CENTER, LODGE_FRONT_TARGET)


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


def hero_path_profile(x, y):
    """Carve a subtle curved snow trough with irregular raised shoulders."""
    radius = math.hypot(x, y)
    if radius <= CLEARING_RADIUS or radius >= 86.0:
        return 0.0
    distance = distance_to_corridor(x, y, HERO_APPROACH)
    half_width = HERO_APPROACH["halfWidth"]
    core = 1.0 - smoothstep(half_width * 0.36, half_width * 0.96, distance)
    shoulder_distance = abs(distance - (half_width + 0.85))
    shoulder = 1.0 - smoothstep(0.15, 1.55, shoulder_distance)
    clearing_fade = smoothstep(CLEARING_RADIUS + 0.5, 17.0, radius)
    far_fade = 1.0 - smoothstep(72.0, 86.0, radius)
    irregularity = 0.88 + 0.12 * math.sin(x * 0.19 - y * 0.11)
    return clearing_fade * far_fade * (
        -0.16 * core + 0.48 * shoulder * irregularity
    )


def natural_terrain_height(x, y):
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
    base_height = (
        bowl
        + woodland_noise
        + outer_undulation
        + distant_forms
        + hero_path_profile(x, y)
    )
    metric = pond_metric(x, y)
    pond_depression = -(base_height + 0.72) * (
        1.0 - smoothstep(0.55, 1.15, metric)
    )
    pond_bank = 0.18 * (1.0 - smoothstep(0.0, 0.55, abs(metric - 1.0)))
    angle = math.atan2(y, x)
    boundary_radius = terrain_boundary_radius(angle)
    skirt = smoothstep(WORLD_SKIRT_START, 1.0, radius / boundary_radius)
    return base_height + pond_depression + pond_bank - skirt * WORLD_SKIRT_DEPTH


def grade_settlement_routes(height, x, y):
    """Blend the authored routes into terrain while preserving a level stage."""
    if math.hypot(x, y) <= CLEARING_RADIUS:
        return height

    # The primary retreat route owns shared junction surfaces. Branches blend
    # first, then the through-route restores its continuous longitudinal grade.
    ordered_paths = sorted(
        SETTLEMENT_LAYOUT["paths"],
        key=lambda path: path["id"] == "stage-to-lodge",
    )
    for path in ordered_paths:
        target_elevations = path.get("targetElevations")
        if target_elevations is None:
            continue
        route_distance, route_progress = route_distance_and_progress(x, y, path)
        clearing_exit_progress = path.get("clearingExitProgress", 0.0)
        route_progress = max(
            0.0,
            (route_progress - clearing_exit_progress)
            / (1.0 - clearing_exit_progress),
        )
        route_height = target_elevations[0] + (
            target_elevations[1] - target_elevations[0]
        ) * route_progress
        route_core = path["width"] * 0.5
        route_influence = 1.0 - smoothstep(
            route_core,
            route_core + path["treeShoulderWidth"],
            route_distance,
        )
        height = height * (1.0 - route_influence) + route_height * route_influence
    return height


def terrain_height(x, y):
    """Grade the approved retreat routes, lodge yard, and hearth pocket."""
    height = grade_settlement_routes(natural_terrain_height(x, y), x, y)

    lodge_local_x, lodge_local_y = settlement_local_coordinates(
        x, y, LODGE_CENTER, LODGE_YAW
    )
    lodge_inner_x = LODGE_LAYOUT["footprint"][0] * 0.5 + 0.65
    lodge_inner_y = LODGE_LAYOUT["footprint"][1] * 0.5 + 0.65
    lodge_outside = math.hypot(
        max(0.0, abs(lodge_local_x) - lodge_inner_x),
        max(0.0, abs(lodge_local_y) - lodge_inner_y),
    )
    lodge_influence = 1.0 - smoothstep(0.0, 10.0, lodge_outside)
    primary_route = next(
        path for path in SETTLEMENT_LAYOUT["paths"] if path["id"] == "stage-to-lodge"
    )
    primary_route_to_lodge = {
        **primary_route,
        "points": [*primary_route["points"], LODGE_LAYOUT["center"]],
    }
    primary_route_distance, _ = route_distance_and_progress(
        x, y, primary_route_to_lodge
    )
    lodge_influence *= smoothstep(
        primary_route["width"] * 0.5,
        primary_route["width"] * 0.5 + 1.5,
        primary_route_distance,
    )
    height = height * (1.0 - lodge_influence) + LODGE_PAD_HEIGHT * lodge_influence

    hearth_distance = math.hypot(x - HEARTH_X, y - HEARTH_Y)
    hearth_inner = HEARTH_LAYOUT["clearedRadius"] + 0.35
    hearth_influence = 1.0 - smoothstep(hearth_inner, hearth_inner + 4.0, hearth_distance)
    height = height * (1.0 - hearth_influence) + HEARTH_PAD_HEIGHT * hearth_influence

    # Grade the entire ten-friend gathering into one calm snow clearing. The
    # court, benches, standing friends, rack, and entry lights share this pad;
    # stopping at the court curb leaves the audience stranded on a snowbank.
    # Use the rectangle's Chebyshev distance rather than an inscribed ellipse.
    # The extrema above are a hard occupancy envelope, so every contract point
    # (including the diagonal bench and entrance corners) must remain inside the
    # fully graded region instead of falling into an ellipse's corner cut-outs.
    social_metric = max(
        abs((x - FIRE_COURT_SOCIAL_X) / FIRE_COURT_SOCIAL_RADIUS_X),
        abs((y - FIRE_COURT_SOCIAL_Y) / FIRE_COURT_SOCIAL_RADIUS_Y),
    )
    court_influence = 1.0 - smoothstep(1.0, 1.38, social_metric)
    height = (
        height * (1.0 - court_influence)
        + FIRE_COURT_GROUND_HEIGHT * court_influence
    )

    # Routes keep the final word through the lodge and hearth pads, but the
    # occupied fire-court envelope is a deliberate level destination. Reapply
    # its mask after route grading so a crossing path cannot lift a bench or a
    # standing guest back into a snowbank.
    height = grade_settlement_routes(height, x, y)
    return (
        height * (1.0 - court_influence)
        + FIRE_COURT_GROUND_HEIGHT * court_influence
    )


def point_segment_distance(x, y, start, end):
    segment_x = end[0] - start[0]
    segment_y = end[1] - start[1]
    length_squared = segment_x * segment_x + segment_y * segment_y
    if length_squared <= 0.000001:
        return math.hypot(x - start[0], y - start[1])
    projection = (
        (x - start[0]) * segment_x + (y - start[1]) * segment_y
    ) / length_squared
    projection = max(0.0, min(1.0, projection))
    nearest_x = start[0] + segment_x * projection
    nearest_y = start[1] + segment_y * projection
    return math.hypot(x - nearest_x, y - nearest_y)


def route_distance_and_progress(x, y, path):
    points = [runtime_point_to_blender(point) for point in path["points"]]
    segment_lengths = [
        math.hypot(end[0] - start[0], end[1] - start[1])
        for start, end in zip(points, points[1:])
    ]
    total_length = sum(segment_lengths)
    best_distance = float("inf")
    best_progress = 0.0
    traversed = 0.0
    for start, end, segment_length in zip(points, points[1:], segment_lengths):
        segment_x = end[0] - start[0]
        segment_y = end[1] - start[1]
        if segment_length <= 0.000001:
            continue
        projection = max(
            0.0,
            min(
                1.0,
                ((x - start[0]) * segment_x + (y - start[1]) * segment_y)
                / (segment_length * segment_length),
            ),
        )
        nearest_x = start[0] + segment_x * projection
        nearest_y = start[1] + segment_y * projection
        distance = math.hypot(x - nearest_x, y - nearest_y)
        if distance < best_distance:
            best_distance = distance
            best_progress = (traversed + segment_length * projection) / total_length
        traversed += segment_length
    return best_distance, best_progress


def distance_to_corridor(x, y, corridor):
    points = corridor["points"]
    return min(
        point_segment_distance(x, y, points[index], points[index + 1])
        for index in range(len(points) - 1)
    )


LODGE_PAD_HEIGHT = LODGE_LAYOUT["targetPadElevation"]
HEARTH_PAD_HEIGHT = HEARTH_LAYOUT["targetPadElevation"]


def sample_cluster_point(rng, cluster):
    angle = rng.random() * math.tau
    radius = math.sqrt(rng.random())
    local_x = math.cos(angle) * cluster["radii"][0] * radius
    local_y = math.sin(angle) * cluster["radii"][1] * radius
    rotation = math.radians(cluster["rotationDegrees"])
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    return (
        cluster["center"][0] + local_x * cosine - local_y * sine,
        cluster["center"][1] + local_x * sine + local_y * cosine,
    )


def tree_enters_settlement_exclusion(x, y, asset):
    margin = SETTLEMENT_LAYOUT["requirements"][
        "minimumTreeExclusionMarginMetres"
    ]
    for exclusion in SETTLEMENT_LAYOUT["treeExclusions"]:
        center = runtime_point_to_blender(exclusion["center"])
        padding = asset["footprintRadius"] + margin
        if exclusion["shape"] == "circle":
            if math.hypot(x - center[0], y - center[1]) < exclusion["radius"] + padding:
                return True
            continue
        if exclusion["shape"] == "lodge-rectangle":
            target = runtime_point_to_blender(exclusion["frontFaces"])
            yaw = local_front_yaw(center, target)
            local_x, local_y = settlement_local_coordinates(x, y, center, yaw)
            if (
                abs(local_x) < exclusion["halfSize"][0] + padding
                and abs(local_y) < exclusion["halfSize"][1] + padding
            ):
                return True
            continue
        raise RuntimeError(
            f"Unsupported Winter settlement exclusion: {exclusion['shape']}"
        )
    return False


def tree_position_is_valid(x, y, asset, cluster, placements):
    band = TREE_LAYOUT["bands"][cluster["band"]]
    radius = math.hypot(x, y)
    if radius < band["minimumRadius"] or radius > band["maximumRadius"]:
        return False
    if radius < CLEARING_RADIUS + asset["clearingSetback"]:
        return False
    boundary = terrain_boundary_radius(math.atan2(y, x))
    if radius > boundary * TREE_LAYOUT["outerBoundaryFraction"]:
        return False
    if pond_metric(x, y, asset["footprintRadius"] * 0.45) < 1.0:
        return False
    if tree_enters_settlement_exclusion(x, y, asset):
        return False
    for corridor in TREE_CORRIDORS:
        required_clearance = (
            corridor["halfWidth"]
            + corridor["shoulderWidth"]
            + asset["corridorClearance"]
            + TREE_LAYOUT["requirements"]["minimumCorridorClearanceMetres"]
        )
        if distance_to_corridor(x, y, corridor) < required_clearance:
            return False
    for placement in placements:
        other_asset = TREE_ASSETS[placement["assetId"]]
        required_spacing = TREE_LAYOUT["spacingFactor"] * (
            asset["footprintRadius"] + other_asset["footprintRadius"]
        )
        if math.hypot(x - placement["x"], y - placement["y"]) < required_spacing:
            return False
    return True


def build_tree_placements():
    placements = []
    for cluster_index, cluster in enumerate(TREE_LAYOUT["clusters"]):
        requested_assets = [
            asset_id
            for asset_id, count in cluster["counts"].items()
            for _ in range(count)
        ]
        rng = random.Random(TREE_LAYOUT["seed"] + cluster_index * 104729)
        rng.shuffle(requested_assets)
        for asset_id in requested_assets:
            asset = TREE_ASSETS[asset_id]
            for _attempt in range(5000):
                x, y = sample_cluster_point(rng, cluster)
                if not tree_position_is_valid(x, y, asset, cluster, placements):
                    continue
                target_height = asset["targetHeightMetres"] * rng.uniform(
                    *asset["heightRange"]
                )
                crown_width = rng.uniform(*asset["crownWidthRange"])
                placements.append(
                    {
                        "assetId": asset_id,
                        "clusterId": cluster["id"],
                        "depthBand": cluster["band"],
                        "detailTier": TREE_LAYOUT["bands"][cluster["band"]][
                            "detailTier"
                        ],
                        "x": x,
                        "y": y,
                        "targetHeight": target_height,
                        "crownWidth": crown_width,
                        "yaw": rng.random() * math.tau,
                    }
                )
                break
            else:
                raise RuntimeError(
                    "Could not satisfy the winter tree layout contract for "
                    f"{cluster['id']} / {asset_id}"
                )
    return placements


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

    # Close the authored snow shell beneath the irregular outer skirt. Free
    # orbit cameras can dip below the horizon, and an open terrain mesh reads
    # as a paper-thin plate from those otherwise valid review angles.
    outer_start = 1 + (TERRAIN_RADIAL_SEGMENTS - 1) * TERRAIN_ANGULAR_SEGMENTS
    bottom_z = min(vertex[2] for vertex in vertices) - 0.6
    bottom_center = len(vertices)
    vertices.append((0.0, 0.0, bottom_z))
    uvs.append(terrain_snow_uv(0.0, 0.0))
    bottom_start = len(vertices)
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        top = vertices[outer_start + segment]
        vertices.append((top[0], top[1], bottom_z))
        uvs.append(terrain_snow_uv(top[0], top[1]))
    for segment in range(TERRAIN_ANGULAR_SEGMENTS):
        following = (segment + 1) % TERRAIN_ANGULAR_SEGMENTS
        faces.append(
            (
                outer_start + segment,
                bottom_start + segment,
                bottom_start + following,
                outer_start + following,
            )
        )
        faces.append((bottom_center, bottom_start + following, bottom_start + segment))

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
    terrain["tka_underside_closed"] = True
    terrain["tka_radial_segments"] = TERRAIN_RADIAL_SEGMENTS
    terrain["tka_angular_segments"] = TERRAIN_ANGULAR_SEGMENTS
    terrain["tka_snow_surface_source"] = "ambientcg-snow004"
    terrain["tka_snow_uv_metres"] = TERRAIN_UV_METRES
    terrain["tka_hero_path_profile"] = "curved-snow-trough-v1"
    terrain["tka_hero_path_half_width"] = HERO_APPROACH["halfWidth"]
    terrain["tka_hero_path_shoulders"] = HERO_APPROACH["shoulderWidth"]
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


def annotate_settlement(obj, role):
    obj["tka_role"] = role
    obj["tka_detail_tier"] = "base"
    obj["tka_settlement_layout_version"] = SETTLEMENT_LAYOUT["version"]
    obj["tka_settlement_layout_sha256"] = SETTLEMENT_LAYOUT_SHA256
    obj["tka_composition_plan_version"] = COMPOSITION_PLAN["version"]
    obj["tka_composition_plan_sha256"] = COMPOSITION_PLAN_SHA256
    apply_composer_placement(obj, role)
    return obj


def create_box(name, center, dimensions, material, yaw=0.0, role="settlement-part"):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
    box = bpy.context.object
    box.name = name
    box.dimensions = dimensions
    box.rotation_euler[2] = yaw
    box.data.materials.append(material)
    annotate_settlement(box, role)
    return box


def local_to_world(center, yaw, local_x, local_y):
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    return (
        center[0] + local_x * cosine - local_y * sine,
        center[1] + local_x * sine + local_y * cosine,
    )


def create_gable_shell(name, center, yaw, width, depth, eave_z, peak_z, material, role):
    local_vertices = [
        (-width * 0.5, -depth * 0.5, eave_z),
        (width * 0.5, -depth * 0.5, eave_z),
        (width * 0.5, depth * 0.5, eave_z),
        (-width * 0.5, depth * 0.5, eave_z),
        (0.0, -depth * 0.5, peak_z),
        (0.0, depth * 0.5, peak_z),
    ]
    vertices = []
    for local_x, local_y, z in local_vertices:
        world_x, world_y = local_to_world(center, yaw, local_x, local_y)
        vertices.append((world_x, world_y, z))
    faces = [
        (0, 1, 4),
        (3, 5, 2),
        (0, 4, 5, 3),
        (1, 2, 5, 4),
        (0, 3, 2, 1),
    ]
    mesh = bpy.data.meshes.new(f"{name} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    shell = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(shell)
    shell.data.materials.append(material)
    annotate_settlement(shell, role)
    return shell


def create_path_ribbon(path):
    control_points = [runtime_point_to_blender(point) for point in path["points"]]
    points = []
    path_rng = random.Random(f"winter-settlement-path-{path['id']}")
    maximum_step = 0.55
    for start, end in zip(control_points, control_points[1:]):
        segment_length = math.hypot(end[0] - start[0], end[1] - start[1])
        steps = max(1, math.ceil(segment_length / maximum_step))
        for step in range(steps):
            amount = step / steps
            points.append(
                (
                    start[0] + (end[0] - start[0]) * amount,
                    start[1] + (end[1] - start[1]) * amount,
                )
            )
    points.append(control_points[-1])
    vertices = []
    for index, point in enumerate(points):
        if index == 0:
            tangent = Vector((points[1][0] - point[0], points[1][1] - point[1]))
        elif index == len(points) - 1:
            tangent = Vector((point[0] - points[index - 1][0], point[1] - points[index - 1][1]))
        else:
            tangent = Vector((points[index + 1][0] - points[index - 1][0], points[index + 1][1] - points[index - 1][1]))
        tangent.normalize()
        width_variation = 0.91 + path_rng.uniform(-0.055, 0.055)
        normal = Vector((-tangent.y, tangent.x)) * (
            path["width"] * 0.5 * width_variation
        )
        for sign in (-1.0, 1.0):
            edge_jitter = path_rng.uniform(-0.065, 0.065)
            x = point[0] + normal.x * sign + normal.x * edge_jitter
            y = point[1] + normal.y * sign + normal.y * edge_jitter
            vertices.append((x, y, terrain_height(x, y) + 0.008))
    faces = [
        (index * 2, index * 2 + 2, index * 2 + 3, index * 2 + 1)
        for index in range(len(points) - 1)
    ]
    mesh = bpy.data.meshes.new(f"Winter Settlement {path['id']} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    ribbon = bpy.data.objects.new(
        f"Winter_Base_SettlementPath_{path['id'].replace('-', '_')}", mesh
    )
    bpy.context.collection.objects.link(ribbon)
    ribbon.data.materials.append(SETTLEMENT_PATH)
    annotate_settlement(ribbon, "settlement-path")
    ribbon["tka_settlement_path_id"] = path["id"]
    ribbon["tka_route_width"] = path["width"]
    return ribbon


def create_stage_ramp():
    inner = runtime_point_to_blender(RAMP_LAYOUT["inner"])
    outer = runtime_point_to_blender(RAMP_LAYOUT["outer"])
    direction = Vector((inner[0] - outer[0], inner[1] - outer[1]))
    run = direction.length
    direction.normalize()
    normal = Vector((-direction.y, direction.x)) * (RAMP_LAYOUT["width"] * 0.5)
    outer_z = max(
        terrain_height(outer[0] + normal.x, outer[1] + normal.y),
        terrain_height(outer[0] - normal.x, outer[1] - normal.y),
    ) + 0.025
    top_z = RAMP_LAYOUT["topHeight"]
    thickness = 0.14
    vertices = [
        (outer[0] + normal.x, outer[1] + normal.y, outer_z),
        (outer[0] - normal.x, outer[1] - normal.y, outer_z),
        (inner[0] - normal.x, inner[1] - normal.y, top_z),
        (inner[0] + normal.x, inner[1] + normal.y, top_z),
        (outer[0] + normal.x, outer[1] + normal.y, outer_z - thickness),
        (outer[0] - normal.x, outer[1] - normal.y, outer_z - thickness),
        (inner[0] - normal.x, inner[1] - normal.y, top_z - thickness),
        (inner[0] + normal.x, inner[1] + normal.y, top_z - thickness),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new("Winter Settlement Stage Ramp Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    ramp = bpy.data.objects.new("Winter_Base_SettlementStageRamp", mesh)
    bpy.context.collection.objects.link(ramp)
    ramp.data.materials.append(SNOW)
    annotate_settlement(ramp, "settlement-ramp")
    ramp["tka_ramp_run"] = run
    ramp["tka_ramp_rise"] = top_z - outer_z
    ramp["tka_ramp_grade"] = (top_z - outer_z) / run
    ramp["tka_ramp_width"] = RAMP_LAYOUT["width"]
    return ramp


def create_hearth_clearing():
    radius = HEARTH_LAYOUT["clearedRadius"]
    z = HEARTH_PAD_HEIGHT + 0.008
    segment_count = 48
    vertices = [(HEARTH_X, HEARTH_Y, z)]
    for index in range(segment_count):
        angle = math.tau * index / segment_count
        irregularity = 1.0 + 0.035 * math.sin(angle * 5.0 + 0.8)
        vertices.append(
            (
                HEARTH_X + math.cos(angle) * radius * irregularity,
                HEARTH_Y + math.sin(angle) * radius * irregularity,
                z,
            )
        )
    faces = [
        (0, index + 1, ((index + 1) % segment_count) + 1)
        for index in range(segment_count)
    ]
    mesh = bpy.data.meshes.new("Winter Settlement Hearth Clearing Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    clearing = bpy.data.objects.new("Winter_Base_SettlementHearthClearing", mesh)
    bpy.context.collection.objects.link(clearing)
    clearing.data.materials.append(SETTLEMENT_PATH)
    annotate_settlement(clearing, "settlement-hearth")
    clearing["tka_cleared_radius"] = radius
    clearing["tka_runtime_x"] = HEARTH_LAYOUT["center"][0]
    clearing["tka_runtime_z"] = HEARTH_LAYOUT["center"][1]
    return clearing


def create_irregular_hearth_disc(name, radius, z, material, role, seed):
    rng = random.Random(seed)
    segment_count = 52
    vertices = [(HEARTH_X, HEARTH_Y, z)]
    for index in range(segment_count):
        angle = math.tau * index / segment_count
        irregularity = (
            1.0
            + 0.045 * math.sin(angle * 5.0 + seed * 0.11)
            + 0.025 * math.cos(angle * 9.0 - seed * 0.07)
            + rng.uniform(-0.018, 0.018)
        )
        vertices.append(
            (
                HEARTH_X + math.cos(angle) * radius * irregularity,
                HEARTH_Y + math.sin(angle) * radius * irregularity,
                z,
            )
        )
    faces = [
        (0, index + 1, ((index + 1) % segment_count) + 1)
        for index in range(segment_count)
    ]
    mesh = bpy.data.meshes.new(f"{name} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv_layer.data[loop_index].uv = (
                0.5 + (vertex.x - HEARTH_X) / (radius * 2.0),
                0.5 + (vertex.y - HEARTH_Y) / (radius * 2.0),
            )
    disc = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(disc)
    disc.data.materials.append(material)
    annotate_settlement(disc, role)
    disc["tka_hearth_production_version"] = HEARTH_PRODUCTION["version"]
    disc["tka_hearth_production_sha256"] = HEARTH_PRODUCTION_SHA256
    return disc


def create_split_firewood_log(
    name,
    center,
    length,
    radius,
    yaw,
    seed,
    role="lodge-woodpile-log",
    bark_material=None,
    cut_material=None,
    tilt_y=0.0,
):
    rng = random.Random(seed)
    bark_material = bark_material or LODGE_BARK
    cut_material = cut_material or LODGE_CUT_WOOD
    segments = 10
    rings = (-length * 0.5, 0.0, length * 0.5)
    vertices = []
    for ring_index, axis_x in enumerate(rings):
        center_y = (ring_index - 1) * rng.uniform(-0.018, 0.018)
        center_z = (ring_index - 1) * rng.uniform(-0.014, 0.014)
        for segment in range(segments):
            angle = math.tau * segment / segments
            irregularity = 0.86 + rng.random() * 0.22
            vertices.append(
                (
                    axis_x,
                    center_y + math.cos(angle) * radius * irregularity,
                    center_z + math.sin(angle) * radius * irregularity,
                )
            )
    faces = []
    for ring_index in range(len(rings) - 1):
        start = ring_index * segments
        next_start = (ring_index + 1) * segments
        for segment in range(segments):
            following = (segment + 1) % segments
            faces.append(
                (
                    start + segment,
                    start + following,
                    next_start + following,
                    next_start + segment,
                )
            )
    faces.append(tuple(reversed(range(segments))))
    final_start = (len(rings) - 1) * segments
    faces.append(tuple(final_start + segment for segment in range(segments)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    obj.rotation_euler = (0.0, tilt_y, yaw)
    obj.data.materials.append(bark_material)
    obj.data.materials.append(cut_material)
    for polygon in obj.data.polygons[-2:]:
        polygon.material_index = 1
    annotate_settlement(obj, role)
    return obj


def create_lodge_woodpile(ground, burial):
    layout = LODGE_PRODUCTION["woodpile"]
    center_local_x, center_local_y = layout["centerLocal"]
    rows = layout["rows"]
    columns = layout["columns"]
    radius = layout["logRadius"]
    length = layout["logLength"]
    for row in range(rows):
        for column in range(columns):
            local_x = center_local_x
            local_y = center_local_y + (column - (columns - 1) * 0.5) * radius * 2.18
            world_x, world_y = local_to_world(
                LODGE_CENTER, LODGE_YAW, local_x, local_y
            )
            create_split_firewood_log(
                f"Winter_Base_LodgeWoodpileLog_{row * columns + column + 1:02d}",
                (
                    world_x,
                    world_y,
                    ground - burial + radius * 1.18 + row * radius * 2.05,
                ),
                length * (0.92 + 0.04 * ((row + column) % 3)),
                radius * (0.92 + 0.035 * row),
                LODGE_YAW,
                f"winter-lodge-firewood-{row}-{column}",
            )

    rack_half_width = layout["rackWidth"] * 0.5
    for suffix, local_y in (("North", center_local_y + rack_half_width), ("South", center_local_y - rack_half_width)):
        world_x, world_y = local_to_world(
            LODGE_CENTER, LODGE_YAW, center_local_x - length * 0.5 - 0.04, local_y
        )
        create_box(
            f"Winter_Base_LodgeWoodpileRack_{suffix}",
            (world_x, world_y, ground - burial + layout["rackHeight"] * 0.5),
            (0.09, 0.09, layout["rackHeight"]),
            SETTLEMENT_TIMBER,
            LODGE_YAW,
            "lodge-woodpile-rack",
        )


def create_lodge_production():
    asset = LODGE_PRODUCTION["asset"]
    source_path = os.path.join(PROJECT_ROOT, *asset["source"].split("/"))
    source = imported_asset_root("WinterKeeperLodge", source_path)
    for obj in source.children_recursive:
        if obj.type == "MESH":
            decimate_mesh_object(obj, asset["decimationRatio"])

    burial = asset["burialDepth"]
    yaw = LODGE_YAW + math.radians(asset["yawCorrectionDegrees"])
    lodge = place_asset_to_dimensions(
        source,
        "Winter_Base_SettlementLodge",
        (LODGE_X, LODGE_Y, LODGE_PAD_HEIGHT - burial),
        tuple(asset["targetDimensions"]),
        yaw,
    )
    annotate_settlement(lodge, "lodge-production-root")
    lodge["tka_lodge_production_version"] = LODGE_PRODUCTION["version"]
    lodge["tka_lodge_production_sha256"] = LODGE_PRODUCTION_SHA256
    lodge["tka_source_asset"] = asset["id"]
    lodge["tka_burial_depth"] = burial
    for child in lodge.children_recursive:
        if child.type == "MESH":
            annotate_settlement(child, "settlement-lodge")
        child["tka_lodge_production_version"] = LODGE_PRODUCTION["version"]
        child["tka_lodge_production_sha256"] = LODGE_PRODUCTION_SHA256
        child["tka_source_asset"] = asset["id"]

    for window in LODGE_PRODUCTION["windows"]:
        local_x, local_y, local_z = window["local"]
        world_x, world_y = local_to_world(
            LODGE_CENTER, yaw, local_x, local_y
        )
        window_anchor = bpy.data.objects.new(
            f"Winter_Base_SettlementLodgeWindow_{window['id'].replace('-', '_')}",
            None,
        )
        bpy.context.collection.objects.link(window_anchor)
        window_anchor.location = (
            world_x,
            world_y,
            LODGE_PAD_HEIGHT - burial + local_z,
        )
        window_anchor.rotation_euler.z = yaw + math.radians(window["yawDegrees"])
        annotate_settlement(window_anchor, "settlement-window")
        window_anchor["tka_window_id"] = window["id"]
        window_anchor["tka_runtime_light_reference"] = True

    chimney = LODGE_PRODUCTION["chimney"]
    chimney_x, chimney_y = local_to_world(
        LODGE_CENTER, yaw, chimney["local"][0], chimney["local"][1]
    )
    chimney_anchor = bpy.data.objects.new(
        "Winter_Base_SettlementLodgeChimneyAnchor", None
    )
    bpy.context.collection.objects.link(chimney_anchor)
    chimney_anchor.location = (
        chimney_x,
        chimney_y,
        LODGE_PAD_HEIGHT - burial + chimney["local"][2],
    )
    annotate_settlement(chimney_anchor, "settlement-chimney")
    chimney_anchor["tka_runtime_smoke_anchor"] = True

    create_lodge_woodpile(LODGE_PAD_HEIGHT, burial)
    hide_source(source)
    return lodge


def annotate_hearth_asset(root, role, source_asset):
    root["tka_role"] = "hearth-production-root"
    root["tka_detail_tier"] = "base"
    root["tka_hearth_production_version"] = HEARTH_PRODUCTION["version"]
    root["tka_hearth_production_sha256"] = HEARTH_PRODUCTION_SHA256
    root["tka_source_asset"] = source_asset
    renderables = [child for child in root.children_recursive if child.type == "MESH"]
    if not renderables:
        raise RuntimeError(f"Hearth production asset has no renderable mesh: {root.name}")
    for index, child in enumerate(renderables):
        annotate_settlement(child, role if index == 0 else "hearth-production-mesh")
        child["tka_detail_tier"] = "base"
        child["tka_hearth_production_version"] = HEARTH_PRODUCTION["version"]
        child["tka_hearth_production_sha256"] = HEARTH_PRODUCTION_SHA256
        child["tka_source_asset"] = source_asset
    return renderables[0]


def create_hearth_chairs():
    chair_contract = HEARTH_PRODUCTION["chair"]
    source_path = os.path.join(PROJECT_ROOT, *chair_contract["source"].split("/"))
    source = imported_asset_root("WinterHearthChair", source_path)
    for obj in source.children_recursive:
        if obj.type == "MESH":
            decimate_mesh_object(obj, chair_contract["decimationRatio"])

    seats = []
    radius = HEARTH_LAYOUT["seatRadius"]
    base_dimensions = chair_contract["targetDimensions"]
    correction = math.radians(chair_contract["yawCorrectionDegrees"])
    for index, angle_degrees in enumerate(HEARTH_LAYOUT["seatAnglesDegrees"]):
        angle = math.radians(angle_degrees)
        runtime_center = (
            HEARTH_LAYOUT["center"][0] + math.cos(angle) * radius,
            HEARTH_LAYOUT["center"][1] + math.sin(angle) * radius,
        )
        center = runtime_point_to_blender(runtime_center)
        yaw = (
            local_front_yaw(center, (HEARTH_X, HEARTH_Y))
            + correction
            + math.radians(chair_contract["yawJitterDegrees"][index])
        )
        multiplier = chair_contract["scaleMultipliers"][index]
        dimensions = tuple(value * multiplier for value in base_dimensions)
        ground = terrain_height(center[0], center[1])
        seat_root = place_asset_to_dimensions(
            source,
            f"Winter_Base_HearthChair_{index + 1:02d}",
            (center[0], center[1], ground - chair_contract["burialDepth"]),
            dimensions,
            yaw,
        )
        seat = annotate_hearth_asset(
            seat_root, "settlement-seat", chair_contract["id"]
        )
        seat["tka_seat_index"] = index + 1
        seat["tka_seat_angle_degrees"] = angle_degrees
        seat["tka_burial_depth"] = chair_contract["burialDepth"]
        seat["tka_target_dimensions"] = dimensions
        seats.append(seat)

    hide_source(source)
    return seats


def create_hearth_stones(prop_sources):
    fire_bed = HEARTH_PRODUCTION["fireBed"]
    base_dimensions = fire_bed["stoneDimensions"]
    # One scanned stone family keeps the ring cohesive; deterministic scale and
    # rotation changes prevent the repeated source from reading as a stamp.
    families = ("stone",)
    stones = []
    for index in range(fire_bed["stoneCount"]):
        angle = math.tau * index / fire_bed["stoneCount"] + 0.025 * math.sin(index * 1.7)
        radial_jitter = 1.0 + 0.045 * math.sin(index * 2.35)
        radius = fire_bed["stoneRingRadius"] * radial_jitter
        x = HEARTH_X + math.cos(angle) * radius
        y = HEARTH_Y + math.sin(angle) * radius
        family = families[index % len(families)]
        width = base_dimensions[0] * (0.88 + 0.14 * ((index * 7) % 5) / 4.0)
        depth = base_dimensions[1] * (0.88 + 0.15 * ((index * 3) % 7) / 6.0)
        height = base_dimensions[2] * (0.90 + 0.12 * ((index * 5) % 6) / 5.0)
        burial = fire_bed["stoneBurialFraction"]
        stone_root = place_asset_to_dimensions(
            prop_sources[family],
            f"Winter_Base_HearthStone_{index + 1:02d}",
            (x, y, HEARTH_PAD_HEIGHT + 0.012 - height * burial),
            (width, depth, height),
            angle + 0.32 * math.sin(index * 1.41),
            0.08 * math.sin(index * 1.13),
            0.07 * math.cos(index * 1.67),
        )
        stone = annotate_hearth_asset(
            stone_root, "settlement-hearth-stone", family
        )
        stone["tka_burial_fraction"] = burial
        stone["tka_hearth_stone_index"] = index + 1
        stones.append(stone)
    return stones


def create_hearth_fuel_and_embers():
    fire_bed = HEARTH_PRODUCTION["fireBed"]
    # A low log-cabin stack: two supported base logs, two cross logs, and one
    # gently pitched top split. Every piece visibly bears on the layer below.
    log_specs = (
        (-0.57, -0.12, -0.15, 0.135, 0.0),
        (-0.57, 0.13, 0.15, 0.14, 0.0),
        (0.59, -0.12, 0.12, 0.315, 0.05),
        (0.59, 0.13, -0.12, 0.32, -0.05),
        (1.55, 0.00, 0.00, 0.47, 0.18),
    )
    fuel = []
    for index, (yaw, offset_x, offset_y, height, tilt_y) in enumerate(log_specs):
        fuel.append(
            create_split_firewood_log(
                f"Winter_Base_HearthFuel_{index + 1:02d}",
                (
                    HEARTH_X + offset_x,
                    HEARTH_Y + offset_y,
                    HEARTH_PAD_HEIGHT + height,
                ),
                fire_bed["fuelLogLength"] * (0.94 + 0.025 * index),
                fire_bed["fuelLogRadius"] * (0.96 + 0.02 * (index % 3)),
                yaw,
                20260920 + index,
                "settlement-hearth-fuel",
                HEARTH_CHARCOAL,
                HEARTH_CUT_WOOD,
                tilt_y,
            )
        )
        fuel[-1]["tka_hearth_production_version"] = HEARTH_PRODUCTION["version"]
        fuel[-1]["tka_hearth_production_sha256"] = HEARTH_PRODUCTION_SHA256

    embers = []
    for index in range(fire_bed["emberCount"]):
        angle = index * 2.399963
        radius = 0.13 + 0.39 * ((index * 7) % fire_bed["emberCount"]) / max(
            1, fire_bed["emberCount"] - 1
        )
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1,
            radius=0.035 + 0.014 * (index % 3),
            location=(
                HEARTH_X + math.cos(angle) * radius,
                HEARTH_Y + math.sin(angle) * radius,
                HEARTH_PAD_HEIGHT + 0.072 + 0.018 * (index % 2),
            ),
        )
        ember = bpy.context.object
        ember.name = f"Winter_Base_HearthEmber_{index + 1:02d}"
        ember.scale = (1.55, 0.74, 0.58)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        ember.data.materials.append(HEARTH_EMBER)
        annotate_settlement(ember, "settlement-hearth-ember")
        ember["tka_hearth_production_version"] = HEARTH_PRODUCTION["version"]
        ember["tka_hearth_production_sha256"] = HEARTH_PRODUCTION_SHA256
        embers.append(ember)
    return fuel, embers


def create_hearth_production(prop_sources):
    fire_bed = HEARTH_PRODUCTION["fireBed"]
    contact = create_irregular_hearth_disc(
        "Winter_Base_HearthHeatContact",
        fire_bed["meltedSnowRadius"],
        HEARTH_PAD_HEIGHT + 0.012,
        HEARTH_MELT,
        "settlement-hearth-contact-zone",
        20260911,
    )
    mineral = create_irregular_hearth_disc(
        "Winter_Base_HearthMineralBed",
        fire_bed["mineralSoilRadius"],
        HEARTH_PAD_HEIGHT + 0.016,
        HEARTH_MINERAL,
        "settlement-hearth-mineral-bed",
        20260912,
    )
    ash = create_irregular_hearth_disc(
        "Winter_Base_HearthAshBed",
        fire_bed["ashRadius"],
        HEARTH_PAD_HEIGHT + 0.020,
        HEARTH_ASH,
        "settlement-hearth-ash-bed",
        20260913,
    )
    stones = create_hearth_stones(prop_sources)
    fuel, embers = create_hearth_fuel_and_embers()
    seats = create_hearth_chairs()
    return {
        "contact": contact,
        "mineral": mineral,
        "ash": ash,
        "stones": stones,
        "fuel": fuel,
        "embers": embers,
        "seats": seats,
    }


def create_settlement_graybox():
    path_objects = [create_path_ribbon(path) for path in SETTLEMENT_LAYOUT["paths"]]
    ramp = create_stage_ramp()
    hearth = create_hearth_clearing()
    lodge = create_lodge_production()
    return {
        "paths": path_objects,
        "ramp": ramp,
        "hearth": hearth,
        "lodge": lodge,
    }


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
        "fir_distant": (os.path.join(MESHY_TREE_DIR, "mid-snow-fir_raw.glb"), 1),
        "sapling_distant": (os.path.join(MESHY_TREE_DIR, "young-snow-sapling_raw.glb"), 1),
        "spruce_windswept": (os.path.join(MESHY_TREE_DIR, "sparse-windswept-spruce_raw.glb"), 1),
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
            # Meshy GLBs arrive with their origin at the model centre. Bake the
            # import transform once so every placement can use stable local
            # bounds and ground the actual root geometry, not the object origin.
            bpy.ops.object.select_all(action="DESELECT")
            if obj.parent is not None:
                world_transform = obj.matrix_world.copy()
                obj.parent = None
                obj.matrix_world = world_transform
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            if family in TREE_SOURCE_DECIMATION:
                decimate_mesh_object(obj, TREE_SOURCE_DECIMATION[family])
            obj["tka_source_file"] = os.path.basename(path)
            obj["tka_source_key"] = key
            obj.hide_render = True
            obj.hide_set(True)
            sources[key] = obj
    return sources


def decimate_mesh_object(obj, ratio):
    before = len(obj.data.polygons)
    if before == 0 or ratio >= 1.0:
        return
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new(name="Winter delivery decimation", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    after = len(obj.data.polygons)
    obj["tka_source_polygon_count"] = after
    obj["tka_source_decimation_ratio"] = ratio
    print(f"Winter source decimation {obj.name}: {before} -> {after} polygons")


def local_vertical_bounds(source):
    minimum = min(corner[2] for corner in source.bound_box)
    maximum = max(corner[2] for corner in source.bound_box)
    if maximum - minimum < 0.001:
        raise RuntimeError(f"Tree source has no usable height: {source.name}")
    return minimum, maximum


def terrain_contact_height(x, y, footprint_radius):
    samples = [terrain_height(x, y)]
    for index in range(12):
        angle = math.tau * index / 12
        samples.append(
            terrain_height(
                x + math.cos(angle) * footprint_radius,
                y + math.sin(angle) * footprint_radius,
            )
        )
    return min(samples)


def duplicate_tree(
    source,
    name,
    x,
    y,
    target_height,
    crown_width,
    yaw,
    age_class,
    tier,
    asset_id,
    cluster_id,
    depth_band,
):
    tree = source.copy()
    tree.data = source.data
    bpy.context.collection.objects.link(tree)
    tree.name = name
    source_minimum_z, source_maximum_z = local_vertical_bounds(source)
    source_height = source_maximum_z - source_minimum_z
    scale = target_height / source_height
    tree.scale = (scale * crown_width, scale * crown_width, scale)
    tree.rotation_euler = (0.0, 0.0, yaw)
    footprint_radius = min(1.1, max(0.35, target_height * crown_width * 0.055))
    contact_height = terrain_contact_height(x, y, footprint_radius)
    minimum_bed_depth = {"mature": 0.38, "mid": 0.30, "young": 0.34}[age_class]
    if depth_band == "far":
        minimum_bed_depth = max(
            minimum_bed_depth,
            TREE_LAYOUT["requirements"]["minimumFarTreeBedDepthMetres"],
        )
    bed_depth = min(0.48, max(minimum_bed_depth, target_height * 0.035))
    intended_minimum_z = contact_height - bed_depth
    tree.location = (x, y, intended_minimum_z - source_minimum_z * scale)
    tree.hide_render = False
    tree.hide_set(False)
    tree["tka_detail_tier"] = tier
    tree["tka_role"] = "conifer"
    tree["tka_age_class"] = age_class
    tree["tka_tree_asset"] = asset_id
    tree["tka_cluster_id"] = cluster_id
    tree["tka_depth_band"] = depth_band
    tree["tka_tree_layout_version"] = TREE_LAYOUT["version"]
    tree["tka_tree_layout_sha256"] = TREE_LAYOUT_SHA256
    tree["tka_source_file"] = source["tka_source_file"]
    tree["tka_source_key"] = source["tka_source_key"]
    tree["tka_source_decimation_ratio"] = source["tka_source_decimation_ratio"]
    tree["tka_plan_x"] = x
    tree["tka_plan_y"] = y
    tree["tka_target_height"] = target_height
    tree["tka_crown_ratio"] = (
        max(source.dimensions.x, source.dimensions.y) / source_height * crown_width
    )
    grounded_minimum_z = tree.location.z + source_minimum_z * scale
    grounding_error = abs(grounded_minimum_z - intended_minimum_z)
    tree["tka_source_minimum_z"] = source_minimum_z
    tree["tka_root_contact_radius"] = footprint_radius
    tree["tka_contact_height"] = contact_height
    tree["tka_root_bed_depth"] = bed_depth
    tree["tka_grounded_minimum_z"] = grounded_minimum_z
    tree["tka_grounding_error"] = grounding_error
    tree["tka_horizon_root_contact"] = depth_band == "far"
    apply_composer_placement(tree, "conifer", asset_id)
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


def create_composer_catalog_additions():
    placements = [
        placement
        for placement in COMPOSER_MANIFEST.get("placements", [])
        if placement.get("source", "catalog") != "native"
        and placement.get("visible", True)
    ]
    if not placements:
        return []

    source_roots = {}
    additions = []
    for placement in placements:
        object_key = placement["objectKey"]
        source_path = COMPOSER_CATALOG_ASSETS.get(object_key)
        if not source_path:
            raise RuntimeError(
                f"No Winter Blender asset mapping for composer item {object_key}"
            )
        source = source_roots.get(object_key)
        if source is None:
            source = imported_asset_root(
                f"WinterComposer_{normalize_composer_name(object_key)}",
                source_path,
            )
            source_roots[object_key] = source

        root = duplicate_hierarchy(
            source,
            f"Winter_Composer_{normalize_composer_name(placement['id'])}",
        )
        root.matrix_world = runtime_placement_matrix(placement)
        for member in [root, *root.children_recursive]:
            member["tka_role"] = "composer-catalog"
            member["tka_composer_id"] = placement["id"]
            member["tka_composer_object_key"] = object_key
            member["tka_composer_locked"] = False
        additions.append(root)

    for source in source_roots.values():
        hide_source(source)
    return additions


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
    for family, root in sources.items():
        for obj in root.children_recursive:
            if obj.type == "MESH":
                decimate_mesh_object(obj, PROP_SOURCE_DECIMATION[family])
    return sources


def annotate_prop(root, tier, role, family, burial):
    for obj in [root, *root.children_recursive]:
        obj["tka_detail_tier"] = tier
        obj["tka_role"] = role
        obj["tka_source_family"] = family
        obj["tka_burial_fraction"] = burial
    apply_composer_placement(root, role, family)


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
    placements = (("Winter_Base_DeadwoodStump_East", 30.0, 4.0, 0.78, 0.96, -0.35, 0.22, "base"),)
    source_minimum_z, source_maximum_z = local_vertical_bounds(source)
    source_height = source_maximum_z - source_minimum_z
    for name, x, y, target_height, width, yaw, burial, tier in placements:
        stump = source.copy()
        stump.data = source.data
        bpy.context.collection.objects.link(stump)
        stump.name = name
        scale = target_height / source_height
        stump.scale = (scale * width, scale * width, scale)
        stump.rotation_euler = (0.05, -0.08, yaw)
        footprint_radius = max(0.28, target_height * width * 0.36)
        contact_height = terrain_contact_height(x, y, footprint_radius)
        stump.location = (
            x,
            y,
            contact_height - target_height * burial - source_minimum_z * scale,
        )
        stump.hide_render = False
        stump.hide_set(False)
        stump["tka_detail_tier"] = tier
        stump["tka_role"] = "stump"
        stump["tka_source_family"] = "tree_stump_01"
        stump["tka_burial_fraction"] = burial
        apply_composer_placement(stump, "stump", "tree_stump_01")

def verify_layout(tree_records):
    flat_samples = []
    for y in range(-8, 9):
        for x in range(-8, 9):
            if math.hypot(x, y) <= CLEARING_RADIUS:
                flat_samples.append(abs(terrain_height(x, y)))
    maximum_flat_deviation = max(flat_samples)
    if maximum_flat_deviation > 0.02:
        raise RuntimeError(f"Performance clearing is not flat: {maximum_flat_deviation:.4f}m")

    fire_court_ground = terrain_height(FIRE_COURT_X, FIRE_COURT_Y)
    if abs(fire_court_ground - FIRE_COURT_GROUND_HEIGHT) > 0.02:
        raise RuntimeError(
            "Fire court was not graded to its contract: "
            f"{fire_court_ground:.4f}m instead of {FIRE_COURT_GROUND_HEIGHT:.4f}m"
        )

    social_ground_deviation = max(
        abs(terrain_height(runtime_x, -runtime_z) - FIRE_COURT_GROUND_HEIGHT)
        for runtime_x, runtime_z in FIRE_COURT_SOCIAL_RUNTIME_POINTS
    )
    if social_ground_deviation > 0.02:
        raise RuntimeError(
            "Fire-court social clearing leaves a guest on sloped snow: "
            f"{social_ground_deviation:.4f}m maximum deviation"
        )

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

    stage_center = STAGE_LAYOUT["center"]
    stage_to_hearth = math.hypot(
        HEARTH_LAYOUT["center"][0] - stage_center[0],
        HEARTH_LAYOUT["center"][1] - stage_center[1],
    )
    if (
        stage_to_hearth
        < SETTLEMENT_LAYOUT["requirements"]["minimumStageToHearthMetres"]
    ):
        raise RuntimeError(
            f"Hearth is too close to the stage: {stage_to_hearth:.3f}m"
        )
    stage_to_lodge = math.hypot(
        LODGE_LAYOUT["center"][0] - stage_center[0],
        LODGE_LAYOUT["center"][1] - stage_center[1],
    )
    if (
        stage_to_lodge
        < SETTLEMENT_LAYOUT["requirements"]["minimumStageToLodgeMetres"]
    ):
        raise RuntimeError(
            f"Lodge is too close to the stage: {stage_to_lodge:.3f}m"
        )
    hearth_to_lodge = math.hypot(
        HEARTH_LAYOUT["center"][0] - LODGE_LAYOUT["center"][0],
        HEARTH_LAYOUT["center"][1] - LODGE_LAYOUT["center"][1],
    )
    if (
        hearth_to_lodge
        < SETTLEMENT_LAYOUT["requirements"]["minimumHearthToLodgeMetres"]
    ):
        raise RuntimeError(
            f"Lodge is too close to the hearth: {hearth_to_lodge:.3f}m"
        )
    stage_to_pond = math.hypot(
        POND_LAYOUT["center"][0] - stage_center[0],
        POND_LAYOUT["center"][1] - stage_center[1],
    )
    if (
        stage_to_pond
        < SETTLEMENT_LAYOUT["requirements"]["minimumPondToStageMetres"]
    ):
        raise RuntimeError(
            f"Pond is too close to the stage: {stage_to_pond:.3f}m"
        )
    route_grades = []
    for path in SETTLEMENT_LAYOUT["paths"]:
        if path["width"] < SETTLEMENT_LAYOUT["requirements"]["minimumRouteWidthMetres"]:
            raise RuntimeError(f"Settlement route is too narrow: {path['id']}")
        points = [runtime_point_to_blender(point) for point in path["points"]]
        for start, end in zip(points, points[1:]):
            segment_length = math.hypot(end[0] - start[0], end[1] - start[1])
            steps = max(1, math.ceil(segment_length / 0.5))
            previous = (*start, terrain_height(start[0], start[1]))
            for step in range(1, steps + 1):
                amount = step / steps
                current = (
                    start[0] + (end[0] - start[0]) * amount,
                    start[1] + (end[1] - start[1]) * amount,
                )
                current_height = terrain_height(current[0], current[1])
                run = math.hypot(current[0] - previous[0], current[1] - previous[1])
                route_grades.append(
                    (
                        abs(current_height - previous[2]) / run,
                        path["id"],
                        previous,
                        (*current, current_height),
                    )
                )
                previous = (*current, current_height)
    maximum_route_grade, steepest_route_id, steepest_route_start, steepest_route_end = max(
        route_grades, key=lambda sample: sample[0]
    )
    if maximum_route_grade > SETTLEMENT_LAYOUT["requirements"]["maximumRouteGrade"]:
        raise RuntimeError(
            "Settlement route is too steep: "
            f"{maximum_route_grade:.4f} on {steepest_route_id} from "
            f"{steepest_route_start} to {steepest_route_end}"
        )
    ramp = bpy.data.objects["Winter_Base_SettlementStageRamp"]
    if ramp["tka_ramp_grade"] > SETTLEMENT_LAYOUT["requirements"]["maximumRampGrade"]:
        raise RuntimeError(
            f"Stage ramp is too steep: {ramp['tka_ramp_grade']:.4f}"
        )
    if math.hypot(*RAMP_LAYOUT["inner"]) > STAGE_LAYOUT["radius"] + 0.05:
        raise RuntimeError("Stage ramp no longer meets the ice-platform edge")

    settlement_roles = {}
    for obj in bpy.data.objects:
        role = obj.get("tka_role")
        if role and role.startswith("settlement-"):
            settlement_roles.setdefault(role, []).append(obj)
    expected_role_counts = {
        "settlement-lodge": 1,
        "settlement-hearth": 1,
        "settlement-seat": HEARTH_LAYOUT["seatCount"],
        "settlement-hearth-contact-zone": 1,
        "settlement-hearth-mineral-bed": 1,
        "settlement-hearth-ash-bed": 1,
        "settlement-hearth-stone": HEARTH_PRODUCTION["fireBed"]["stoneCount"],
        "settlement-hearth-fuel": HEARTH_PRODUCTION["fireBed"]["fuelLogCount"],
        "settlement-hearth-ember": HEARTH_PRODUCTION["fireBed"]["emberCount"],
        "settlement-path": len(SETTLEMENT_LAYOUT["paths"]),
        "settlement-ramp": 1,
        "settlement-window": 2,
        "settlement-chimney": 1,
    }
    for role, expected_count in expected_role_counts.items():
        actual_count = len(settlement_roles.get(role, []))
        if actual_count != expected_count:
            raise RuntimeError(
                f"Expected {expected_count} {role} objects, found {actual_count}"
            )
    for objects in settlement_roles.values():
        for obj in objects:
            if (
                obj.get("tka_settlement_layout_version")
                != SETTLEMENT_LAYOUT["version"]
                or obj.get("tka_settlement_layout_sha256")
                != SETTLEMENT_LAYOUT_SHA256
                or obj.get("tka_composition_plan_version")
                != COMPOSITION_PLAN["version"]
                or obj.get("tka_composition_plan_sha256")
                != COMPOSITION_PLAN_SHA256
            ):
                raise RuntimeError(f"Settlement metadata drifted: {obj.name}")

    lodge = settlement_roles["settlement-lodge"][0]
    if (
        lodge.get("tka_lodge_production_version") != LODGE_PRODUCTION["version"]
        or lodge.get("tka_lodge_production_sha256") != LODGE_PRODUCTION_SHA256
        or lodge.get("tka_source_asset") != LODGE_PRODUCTION["asset"]["id"]
    ):
        raise RuntimeError("The production lodge no longer matches its asset contract")
    if tuple(LODGE_PRODUCTION["asset"]["targetDimensions"][:2]) != tuple(
        LODGE_LAYOUT["footprint"]
    ) or LODGE_PRODUCTION["asset"]["targetDimensions"][2] != LODGE_LAYOUT["ridgeHeight"]:
        raise RuntimeError("The production lodge drifted outside the approved envelope")
    woodpile_logs = [
        obj for obj in bpy.data.objects if obj.get("tka_role") == "lodge-woodpile-log"
    ]
    if len(woodpile_logs) < LODGE_PRODUCTION["requirements"]["minimumWoodpileLogs"]:
        raise RuntimeError(f"The lodge woodpile is incomplete: {len(woodpile_logs)} logs")
    chimney_anchor = settlement_roles["settlement-chimney"][0]

    chair_contract = HEARTH_PRODUCTION["chair"]
    hearth_seats = settlement_roles["settlement-seat"]
    if len(hearth_seats) != HEARTH_PRODUCTION["requirements"]["chairCount"]:
        raise RuntimeError("The hearth chair count drifted from its production contract")
    for seat in hearth_seats:
        if (
            seat.get("tka_hearth_production_version") != HEARTH_PRODUCTION["version"]
            or seat.get("tka_hearth_production_sha256") != HEARTH_PRODUCTION_SHA256
            or seat.get("tka_source_asset") != chair_contract["id"]
        ):
            raise RuntimeError(f"The production hearth chair drifted: {seat.name}")
        if seat.get("tka_burial_depth", 0.0) < HEARTH_PRODUCTION["clearances"]["minimumChairBurialMetres"]:
            raise RuntimeError(f"The production hearth chair is not grounded: {seat.name}")

    angles = sorted(HEARTH_LAYOUT["seatAnglesDegrees"])
    seat_gaps = [
        angles[index + 1] - angles[index]
        for index in range(len(angles) - 1)
    ] + [angles[0] + 360.0 - angles[-1]]
    maximum_seat_gap = max(seat_gaps)
    if maximum_seat_gap < HEARTH_PRODUCTION["clearances"]["minimumRouteOpeningDegrees"]:
        raise RuntimeError("The hearth seating arc no longer leaves a usable route opening")
    chair_depth = chair_contract["targetDimensions"][1] * max(
        chair_contract["scaleMultipliers"]
    )
    stone_width = HEARTH_PRODUCTION["fireBed"]["stoneDimensions"][0]
    seat_to_stone_clearance = (
        HEARTH_LAYOUT["seatRadius"]
        - chair_depth * 0.5
        - HEARTH_PRODUCTION["fireBed"]["stoneRingRadius"]
        - stone_width * 0.5
    )
    if seat_to_stone_clearance < HEARTH_PRODUCTION["clearances"]["minimumSeatToStoneMetres"]:
        raise RuntimeError(
            f"The hearth seating is too close to the stone ring: {seat_to_stone_clearance:.3f}m"
        )

    path_bank_reliefs = []
    path_points = HERO_APPROACH["points"]
    bank_offset = HERO_APPROACH["halfWidth"] + 0.85
    for start, end in zip(path_points, path_points[1:]):
        midpoint_x = (start[0] + end[0]) * 0.5
        midpoint_y = (start[1] + end[1]) * 0.5
        midpoint_radius = math.hypot(midpoint_x, midpoint_y)
        if midpoint_radius < 17.0 or midpoint_radius > 72.0:
            continue
        segment_x = end[0] - start[0]
        segment_y = end[1] - start[1]
        segment_length = math.hypot(segment_x, segment_y)
        normal_x = -segment_y / segment_length
        normal_y = segment_x / segment_length
        center_height = terrain_height(midpoint_x, midpoint_y)
        bank_heights = (
            terrain_height(
                midpoint_x + normal_x * bank_offset,
                midpoint_y + normal_y * bank_offset,
            ),
            terrain_height(
                midpoint_x - normal_x * bank_offset,
                midpoint_y - normal_y * bank_offset,
            ),
        )
        path_bank_reliefs.append(sum(bank_heights) * 0.5 - center_height)
    minimum_path_bank_relief = min(path_bank_reliefs)
    if (
        minimum_path_bank_relief
        < TREE_LAYOUT["requirements"]["minimumPathBankReliefMetres"]
    ):
        raise RuntimeError(
            "Hero approach lost its snow-bank relief: "
            f"{minimum_path_bank_relief:.3f}m"
        )
    expected_cluster_counts = {
        cluster["id"]: sum(cluster["counts"].values())
        for cluster in TREE_LAYOUT["clusters"]
    }
    expected_band_counts = {
        band: sum(
            sum(cluster["counts"].values())
            for cluster in TREE_LAYOUT["clusters"]
            if cluster["band"] == band
        )
        for band in TREE_LAYOUT["bands"]
    }
    expected_age_counts = {age: 0 for age in ("mature", "mid", "young")}
    expected_tier_counts = {tier: 0 for tier in ("base", "medium", "high")}
    for cluster in TREE_LAYOUT["clusters"]:
        tier = TREE_LAYOUT["bands"][cluster["band"]]["detailTier"]
        for asset_id, count in cluster["counts"].items():
            expected_age_counts[TREE_ASSETS[asset_id]["ageClass"]] += count
            expected_tier_counts[tier] += count

    minimum_corridor_clearance = math.inf
    for tree in tree_records:
        if math.hypot(tree.location.x, tree.location.y) < CLEARING_RADIUS + 1.0:
            raise RuntimeError(f"Tree entered the performance buffer: {tree.name}")
        if pond_metric(tree.location.x, tree.location.y, 1.0) < 1.0:
            raise RuntimeError(f"Tree entered the pond buffer: {tree.name}")
        if tree["tka_age_class"] == "young" and tree["tka_target_height"] > 8.0:
            raise RuntimeError(f"Sapling exceeded eight metres: {tree.name}")
        if tree["tka_grounding_error"] > 0.015:
            raise RuntimeError(
                f"Tree root contact drifted: {tree.name}="
                f"{tree['tka_grounding_error']:.4f}m"
            )
        expected_bed = tree["tka_contact_height"] - tree["tka_root_bed_depth"]
        if abs(tree["tka_grounded_minimum_z"] - expected_bed) > 0.015:
            raise RuntimeError(f"Tree is floating above its snow bed: {tree.name}")

        asset = TREE_ASSETS[tree["tka_tree_asset"]]
        if tree_enters_settlement_exclusion(
            tree["tka_plan_x"], tree["tka_plan_y"], asset
        ):
            raise RuntimeError(f"Tree entered a settlement pocket: {tree.name}")
        if tree["tka_source_file"] != asset["sourceFile"]:
            raise RuntimeError(f"Tree source file drifted: {tree.name}")
        if tree["tka_source_key"] != asset["sourceKey"]:
            raise RuntimeError(f"Tree source key drifted: {tree.name}")
        if (
            tree["tka_source_decimation_ratio"]
            < asset["minimumSourceDecimationRatio"]
        ):
            raise RuntimeError(f"Tree source over-decimated: {tree.name}")
        if tree["tka_source_file"] in TREE_LAYOUT["requirements"]["forbiddenSourceFiles"]:
            raise RuntimeError(f"Retired distant source survived: {tree.name}")
        if (
            tree["tka_depth_band"] == "far"
            and tree["tka_root_bed_depth"]
            < TREE_LAYOUT["requirements"]["minimumFarTreeBedDepthMetres"]
        ):
            raise RuntimeError(f"Far tree is not bedded into the snow: {tree.name}")
        band = TREE_LAYOUT["bands"][tree["tka_depth_band"]]
        radius = math.hypot(tree["tka_plan_x"], tree["tka_plan_y"])
        if radius < band["minimumRadius"] or radius > band["maximumRadius"]:
            raise RuntimeError(f"Tree escaped its depth band: {tree.name}")
        for corridor in TREE_CORRIDORS:
            clearance = distance_to_corridor(
                tree["tka_plan_x"], tree["tka_plan_y"], corridor
            ) - (
                corridor["halfWidth"]
                + corridor["shoulderWidth"]
                + asset["corridorClearance"]
            )
            minimum_corridor_clearance = min(minimum_corridor_clearance, clearance)
            if clearance < TREE_LAYOUT["requirements"]["minimumCorridorClearanceMetres"]:
                raise RuntimeError(
                    f"Tree entered the {corridor['id']} sightline: {tree.name}"
                )

    hero_foreground = [
        tree
        for tree in tree_records
        if tree["tka_depth_band"] == "near" and tree.location.y <= -10.0
    ]
    if not any(tree.location.x <= -16.0 for tree in hero_foreground):
        raise RuntimeError("Hero foreground is missing its west framing mass")
    if not any(tree.location.x >= 16.0 for tree in hero_foreground):
        raise RuntimeError("Hero foreground is missing its east framing mass")
    rear_wall = [tree for tree in tree_records if tree.location.y >= 20.0]
    if len(rear_wall) < 70:
        raise RuntimeError(f"Rear forest wall is too sparse: {len(rear_wall)} trees")
    if not any(tree.location.x <= -10.0 for tree in rear_wall):
        raise RuntimeError("Rear forest wall is missing its west mass")
    if not any(tree.location.x >= 10.0 for tree in rear_wall):
        raise RuntimeError("Rear forest wall is missing its east mass")

    age_counts = {
        age: sum(1 for tree in tree_records if tree["tka_age_class"] == age)
        for age in ("mature", "mid", "young")
    }
    if age_counts != expected_age_counts:
        raise RuntimeError(f"Tree age-class contract drifted: {age_counts}")
    tier_counts = {
        tier: sum(1 for tree in tree_records if tree["tka_detail_tier"] == tier)
        for tier in ("base", "medium", "high")
    }
    if tier_counts != expected_tier_counts:
        raise RuntimeError(f"Tree tier contract drifted: {tier_counts}")
    band_counts = {
        band: sum(1 for tree in tree_records if tree["tka_depth_band"] == band)
        for band in TREE_LAYOUT["bands"]
    }
    if band_counts != expected_band_counts:
        raise RuntimeError(f"Tree depth-band contract drifted: {band_counts}")
    for band, minimum_count in TREE_LAYOUT["requirements"]["minimumBandCounts"].items():
        if band_counts[band] < minimum_count:
            raise RuntimeError(f"Winter {band} band is too sparse: {band_counts[band]}")
    cluster_counts = {
        cluster_id: sum(
            1 for tree in tree_records if tree["tka_cluster_id"] == cluster_id
        )
        for cluster_id in expected_cluster_counts
    }
    if cluster_counts != expected_cluster_counts:
        raise RuntimeError(f"Tree cluster contract drifted: {cluster_counts}")
    if len(cluster_counts) != TREE_LAYOUT["requirements"]["clusterCount"]:
        raise RuntimeError(f"Tree cluster count drifted: {len(cluster_counts)}")
    if len(tree_records) != TREE_LAYOUT["requirements"]["treeCount"]:
        raise RuntimeError(f"Tree count drifted: {len(tree_records)}")

    radial_positions = sorted(
        math.hypot(tree["tka_plan_x"], tree["tka_plan_y"])
        for tree in tree_records
    )
    maximum_radial_gap = max(
        right - left for left, right in zip(radial_positions, radial_positions[1:])
    )
    if maximum_radial_gap > TREE_LAYOUT["requirements"]["maximumRadialGapMetres"]:
        raise RuntimeError(
            f"Tree layers leave an abrupt radial gap: {maximum_radial_gap:.3f}m"
        )

    far_trees = [tree for tree in tree_records if tree["tka_depth_band"] == "far"]
    if not any(tree.location.x < -90.0 for tree in far_trees):
        raise RuntimeError("Far tree belt is missing its west horizon mass")
    if not any(tree.location.x > 90.0 for tree in far_trees):
        raise RuntimeError("Far tree belt is missing its east horizon mass")
    if not any(tree.location.y > 105.0 for tree in far_trees):
        raise RuntimeError("Far tree belt is missing its north horizon mass")

    lush_count = sum(1 for tree in tree_records if tree["tka_crown_ratio"] >= 0.30)
    minimum_lush_count = math.ceil(len(tree_records) * 0.95)
    if lush_count < minimum_lush_count:
        raise RuntimeError(f"Only {lush_count} trees meet the lush-crown contract")

    prop_placements = [*ROCK_PLACEMENTS, *DEADWOOD_PLACEMENTS]
    for placement in prop_placements:
        name, _family, x, y, sx, sy, _sz, _yaw, _tilt_x, _tilt_y, burial, _tier = placement
        nearest_edge = math.hypot(x, y) - max(sx, sy) * 0.5
        if nearest_edge < CLEARING_RADIUS + 1.0:
            raise RuntimeError(f"Prop entered the performance buffer: {name}")
        if burial < 0.15 or burial > 0.35:
            raise RuntimeError(f"Prop burial left the approved range: {name}={burial:.2f}")

    terrain_object = bpy.data.objects["Winter_Base_SculptedSnowHollow"]
    terrain_object["tka_hero_path_minimum_bank_relief"] = minimum_path_bank_relief
    terrain_object["tka_settlement_layout_version"] = SETTLEMENT_LAYOUT["version"]
    terrain_object["tka_settlement_layout_sha256"] = SETTLEMENT_LAYOUT_SHA256
    terrain_object["tka_composition_plan_version"] = COMPOSITION_PLAN["version"]
    terrain_object["tka_composition_plan_sha256"] = COMPOSITION_PLAN_SHA256
    terrain_object["tka_stage_to_hearth_distance"] = stage_to_hearth
    terrain_object["tka_stage_to_lodge_distance"] = stage_to_lodge
    terrain_object["tka_hearth_to_lodge_distance"] = hearth_to_lodge
    terrain_object["tka_stage_to_pond_distance"] = stage_to_pond
    terrain_object["tka_maximum_route_grade"] = maximum_route_grade
    terrain_object["tka_lodge_production_version"] = LODGE_PRODUCTION["version"]
    terrain_object["tka_lodge_production_sha256"] = LODGE_PRODUCTION_SHA256
    terrain_object["tka_hearth_production_version"] = HEARTH_PRODUCTION["version"]
    terrain_object["tka_hearth_production_sha256"] = HEARTH_PRODUCTION_SHA256

    print("\nWinter ecology verification")
    print(f"Flat clearing maximum deviation: {maximum_flat_deviation:.4f} m")
    print(f"Fire-court social deviation:     {social_ground_deviation:.4f} m")
    print(
        "Terrain boundary radius:         "
        f"{minimum_boundary_radius:.3f} to {maximum_boundary_radius:.3f} m"
    )
    print(f"Minimum outer skirt drop:        {minimum_skirt_drop:.3f} m")
    print(f"Nearest pond bank:              {nearest_pond_edge:.3f} m")
    print(f"Stage to hearth:               {stage_to_hearth:.3f} m")
    print(f"Stage to lodge:                {stage_to_lodge:.3f} m")
    print(f"Hearth to lodge:               {hearth_to_lodge:.3f} m")
    print(f"Stage to pond:                 {stage_to_pond:.3f} m")
    print(f"Maximum route grade:           {maximum_route_grade:.4f}")
    print(f"Stage ramp grade:              {ramp['tka_ramp_grade']:.4f}")
    print(f"Settlement role counts:        {expected_role_counts}")
    print(f"Lodge woodpile logs:           {len(woodpile_logs)}")
    print(f"Hearth seat-to-stone gap:      {seat_to_stone_clearance:.3f} m")
    print(f"Hearth route opening:          {maximum_seat_gap:.1f} degrees")
    print(f"Minimum path bank relief:       {minimum_path_bank_relief:.3f} m")
    print(f"Tree age classes:               {age_counts}")
    print(f"Tree tiers:                     {tier_counts}")
    print(f"Tree depth bands:               {band_counts}")
    print(f"Authored tree clusters:         {len(cluster_counts)}")
    print(f"Minimum sightline clearance:    {minimum_corridor_clearance:.3f} m")
    print(f"Maximum radial layer gap:       {maximum_radial_gap:.3f} m")
    print(f"Lush crown count:               {lush_count}")
    print(f"Hero foreground frame trees:   {len(hero_foreground)}")
    print(f"Rear forest wall trees:        {len(rear_wall)}")
    print(
        "Maximum tree grounding error:  "
        f"{max(tree['tka_grounding_error'] for tree in tree_records):.4f} m"
    )
    with open(
        os.path.join(QA_DIR, "winter_environment_tree_metrics.json"),
        "w",
        encoding="utf-8",
    ) as metrics_file:
        json.dump(
            {
                "layoutVersion": TREE_LAYOUT["version"],
                "layoutSha256": TREE_LAYOUT_SHA256,
                "treeCount": len(tree_records),
                "clusterCount": len(cluster_counts),
                "bandCounts": band_counts,
                "ageCounts": age_counts,
                "tierCounts": tier_counts,
                "minimumCorridorClearanceMetres": minimum_corridor_clearance,
                "maximumRadialGapMetres": maximum_radial_gap,
                "minimumPathBankReliefMetres": minimum_path_bank_relief,
                "settlementLayoutVersion": SETTLEMENT_LAYOUT["version"],
                "settlementLayoutSha256": SETTLEMENT_LAYOUT_SHA256,
                "fireCourtContractRevision": FIRE_COURT_CONTRACT["revisionId"],
                "fireCourtContractSha256": FIRE_COURT_CONTRACT_SHA256,
                "fireCourtGroundHeight": FIRE_COURT_GROUND_HEIGHT,
                "fireCourtSocialGroundMaximumDeviation": social_ground_deviation,
                "compositionPlanVersion": COMPOSITION_PLAN["version"],
                "compositionPlanSha256": COMPOSITION_PLAN_SHA256,
                "stageToHearthMetres": stage_to_hearth,
                "stageToLodgeMetres": stage_to_lodge,
                "hearthToLodgeMetres": hearth_to_lodge,
                "stageToPondMetres": stage_to_pond,
                "maximumRouteGrade": maximum_route_grade,
                "rampGrade": ramp["tka_ramp_grade"],
                "settlementRoleCounts": expected_role_counts,
                "lodgeProductionVersion": LODGE_PRODUCTION["version"],
                "lodgeProductionSha256": LODGE_PRODUCTION_SHA256,
                "lodgeWoodpileLogs": len(woodpile_logs),
                "hearthProductionVersion": HEARTH_PRODUCTION["version"],
                "hearthProductionSha256": HEARTH_PRODUCTION_SHA256,
                "hearthSeatToStoneClearanceMetres": seat_to_stone_clearance,
                "hearthRouteOpeningDegrees": maximum_seat_gap,
                "hearthPadHeight": HEARTH_PAD_HEIGHT,
                "lodgePadHeight": LODGE_PAD_HEIGHT,
                "lodgeChimneyAnchorBlender": list(chimney_anchor.location),
                "maximumGroundingErrorMetres": max(
                    tree["tka_grounding_error"] for tree in tree_records
                ),
            },
            metrics_file,
            indent=2,
        )


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
    add_area_light(
        "FireBounce",
        (HEARTH_X, HEARTH_Y, HEARTH_PAD_HEIGHT + 5.0),
        (1.0, 0.20, 0.045),
        620.0,
        4.0,
        (HEARTH_X, HEARTH_Y, HEARTH_PAD_HEIGHT),
    )

    camera_data = bpy.data.cameras.new("Winter QA Camera")
    camera = bpy.data.objects.new("QA_WinterCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    create_qa_performer()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    render_qa_view(camera, (10.0, -30.0, 5.2), (-6.0, 9.0, 1.8), QA_PATHS["hero"], 45)
    render_qa_view(camera, (6.0, -18.0, 5.5), (POND_X, POND_Y, POND_WATER_HEIGHT), QA_PATHS["pond"], 43)
    render_qa_view(camera, (8.0, -24.0, 6.0), (18.0, 10.0, 6.0), QA_PATHS["trees"], 41)
    render_qa_view(camera, (2.0, -4.0, 3.6), (18.0, 10.0, 0.3), QA_PATHS["props"], 42)
    render_qa_view(camera, (-12.0, 28.0, 10.0), (0.0, 0.0, 2.0), QA_PATHS["reverse"], 38)
    render_qa_view(camera, (8.0, -38.0, 1.65), (0.0, -9.0, 1.2), QA_PATHS["walk"], 36)
    render_qa_view(camera, (10.0, -30.0, 52.0), (-6.0, 9.0, 2.0), QA_PATHS["world"], 36)
    render_qa_view(
        camera,
        (10.0, -30.0, 18.0),
        (-8.0, 15.0, 2.6),
        QA_PATHS["settlement"],
        42,
    )
    render_qa_view(
        camera,
        (-4.0, -2.0, 6.0),
        (LODGE_X, LODGE_Y, LODGE_PAD_HEIGHT + 2.5),
        QA_PATHS["lodge"],
        46,
    )
    render_qa_view(
        camera,
        (-16.0, 9.0, 5.5),
        (HEARTH_X, HEARTH_Y, HEARTH_PAD_HEIGHT + 0.9),
        QA_PATHS["hearth"],
        48,
    )
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


terrain = create_terrain()
pond_preview = create_pond_preview()
settlement_graybox = create_settlement_graybox()
tree_sources = import_tree_sources()
prop_sources = import_prop_sources()
tree_placements = build_tree_placements()
terrain["tka_tree_layout_version"] = TREE_LAYOUT["version"]
terrain["tka_tree_layout_sha256"] = TREE_LAYOUT_SHA256
terrain["tka_tree_count"] = len(tree_placements)
terrain["tka_tree_cluster_count"] = len(TREE_LAYOUT["clusters"])
terrain["tka_settlement_layout_version"] = SETTLEMENT_LAYOUT["version"]
terrain["tka_settlement_layout_sha256"] = SETTLEMENT_LAYOUT_SHA256
terrain["tka_fire_court_contract_revision"] = FIRE_COURT_CONTRACT["revisionId"]
terrain["tka_fire_court_contract_sha256"] = FIRE_COURT_CONTRACT_SHA256
terrain["tka_tree_corridors"] = ",".join(
    corridor["id"] for corridor in TREE_CORRIDORS
)
tree_records = []
for index, placement in enumerate(tree_placements):
    asset = TREE_ASSETS[placement["assetId"]]
    name = (
        f"Winter_{placement['detailTier'].capitalize()}_"
        f"{placement['depthBand'].capitalize()}_"
        f"{placement['assetId'].replace('-', '_')}_{index:03d}"
    )
    tree = duplicate_tree(
        tree_sources[asset["sourceKey"]],
        name,
        placement["x"],
        placement["y"],
        placement["targetHeight"],
        placement["crownWidth"],
        placement["yaw"],
        asset["ageClass"],
        placement["detailTier"],
        placement["assetId"],
        placement["clusterId"],
        placement["depthBand"],
    )
    tree_records.append(tree)

snow_cap_count = 0
create_rocks(prop_sources)
hearth_production = create_hearth_production(prop_sources)
create_deadwood(prop_sources)
create_stumps(tree_sources["stump_a"])
composer_catalog_additions = create_composer_catalog_additions()
verify_layout(tree_records)
setup_qa_render()

print("\nMoonlit Winter Hollow authored")
print(f"Trees:     {len(tree_records)}")
print(f"Snow caps: {snow_cap_count}")
print(f"Composer additions: {len(composer_catalog_additions)}")
print(f"Blend:     {BLEND_PATH}")
for label, path in QA_PATHS.items():
    print(f"QA {label:8}: {path}")
