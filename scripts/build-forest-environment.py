"""Build the authored terrain, paths, trees, ground ecology, and close frame.

Gates 1 through 3 own terrain form, material zones, paths, and clearing edges.
Gate 5 adds tree transforms. Gate 7 composes the approved ground-life families
through the dedicated ``forest_ground_life`` owner. Gate 9 adds one conditional
near-frame layer containing the approved close trees and their attached rock and
deadwood vignettes. Camp, stage, particles, lighting, and sky stay outside this
file. Run with Blender 5.0 in background mode, then export the main environment
and near-frame layer separately.
"""

import hashlib
import json
import math
import os
import random
import subprocess
import sys

import bpy
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from forest_ground_life import build_ground_life


BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "forest_environment.blend")
TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "forest-floor")
ZONED_DIFFUSE_PATH = os.path.join(TEXTURE_DIR, "forest-floor-zoned.jpg")
PATH_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "forest-path-layout.json")
with open(PATH_LAYOUT_PATH, "rb") as path_layout_file:
    PATH_LAYOUT_BYTES = path_layout_file.read()
PATH_LAYOUT = json.loads(PATH_LAYOUT_BYTES.decode("utf-8"))
PATH_LAYOUT_SHA256 = hashlib.sha256(PATH_LAYOUT_BYTES).hexdigest()
TREE_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "forest-tree-layout.json")
with open(TREE_LAYOUT_PATH, "rb") as tree_layout_file:
    TREE_LAYOUT_BYTES = tree_layout_file.read()
TREE_LAYOUT = json.loads(TREE_LAYOUT_BYTES.decode("utf-8"))
TREE_LAYOUT_SHA256 = hashlib.sha256(TREE_LAYOUT_BYTES).hexdigest()
TREE_ASSETS = {asset["id"]: asset for asset in TREE_LAYOUT["assets"]}
GROUND_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "forest-ground-life-layout.json")
with open(GROUND_LAYOUT_PATH, "rb") as ground_layout_file:
    GROUND_LAYOUT_BYTES = ground_layout_file.read()
GROUND_LAYOUT = json.loads(GROUND_LAYOUT_BYTES.decode("utf-8"))
GROUND_LAYOUT_SHA256 = hashlib.sha256(GROUND_LAYOUT_BYTES).hexdigest()
GROUND_ECOLOGY_PATH = os.path.join(PROJECT_ROOT, GROUND_LAYOUT["ecologyContractPath"])
with open(GROUND_ECOLOGY_PATH, "rb") as ground_ecology_file:
    GROUND_ECOLOGY_BYTES = ground_ecology_file.read()
GROUND_ECOLOGY = json.loads(GROUND_ECOLOGY_BYTES.decode("utf-8"))
GROUND_ECOLOGY_SHA256 = hashlib.sha256(GROUND_ECOLOGY_BYTES).hexdigest()
STATIC_PROP_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "forest-static-prop-layout.json")
with open(STATIC_PROP_LAYOUT_PATH, "rb") as static_prop_layout_file:
    STATIC_PROP_LAYOUT_BYTES = static_prop_layout_file.read()
STATIC_PROP_LAYOUT = json.loads(STATIC_PROP_LAYOUT_BYTES.decode("utf-8"))
STATIC_PROP_LAYOUT_SHA256 = hashlib.sha256(STATIC_PROP_LAYOUT_BYTES).hexdigest()
STATIC_PROP_SOURCES = {
    source["id"]: source for source in STATIC_PROP_LAYOUT["sources"]
}
PROP_LINEUP_PATH = os.path.join(SCRIPT_DIR, "forest-prop-lineup.json")
with open(PROP_LINEUP_PATH, "r", encoding="utf-8") as prop_lineup_file:
    PROP_LINEUP = json.load(prop_lineup_file)
CAMPSITE_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "forest-campsite-layout.json")
with open(CAMPSITE_LAYOUT_PATH, "r", encoding="utf-8") as campsite_layout_file:
    CAMPSITE_LAYOUT = json.load(campsite_layout_file)
QA_DIR = os.path.join(os.environ.get("TEMP", PROJECT_ROOT), "tka-forest-evidence")
QA_PATHS = {
    name: os.path.join(QA_DIR, f"forest_environment_qa_{name}.png")
    for name in (
        "hero",
        "reverse",
        "walk",
        "world",
        "trees",
        "floor",
        "camp",
        "stage",
        "paths",
        "pathwalk",
        "ecology-edge",
        "ecology-hollow",
        "ecology-root",
        "frame-southwest",
        "frame-southeast",
        "near-frame-plan",
        "coven-frame-omitted",
    )
}

CLEARING_RADIUS = float(PATH_LAYOUT["clearingRadius"])
PERFORMANCE_KEEP_CLEAR_RADIUS = float(PATH_LAYOUT["performanceKeepClearRadius"])
WORLD_RADIUS = float(PATH_LAYOUT["worldBoundary"]["baseRadius"])
WORLD_SKIRT_START = 0.84
WORLD_SKIRT_DEPTH = 18.0
TERRAIN_ANGULAR_SEGMENTS = 320
TERRAIN_RADIAL_SEGMENTS = 160
TERRAIN_UV_METRES = 5.2
MATERIAL_ZONE_NAMES = (
    "Packed Performance Clearing",
    "Path Soil",
    "Leaf Duff",
    "Shade Moss",
    "Damp Hollow",
    "Quiet Distant Ground",
)
DAMP_HOLLOWS = (
    (-58.0, 34.0, 23.0, 14.0, -0.28),
    (56.0, 47.0, 27.0, 16.0, 0.42),
    (73.0, -43.0, 24.0, 15.0, -0.62),
    (-66.0, -58.0, 31.0, 17.0, 0.24),
)
PATHS = tuple(PATH_LAYOUT["paths"])
ROOT_CROSSINGS = tuple(PATH_LAYOUT["rootCrossings"])


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def harmonic_radius(angle, definition):
    radius = float(definition["baseRadius"])
    for harmonic in definition["harmonics"]:
        phase = angle * float(harmonic["frequency"]) + float(harmonic["phase"])
        wave = math.cos(phase) if harmonic["function"] == "cos" else math.sin(phase)
        radius += float(harmonic["amplitude"]) * wave
    return radius


def terrain_boundary_radius(angle):
    """Return the deterministic, non-circular woodland boundary."""
    return harmonic_radius(angle, PATH_LAYOUT["worldBoundary"])


def clearing_edge_radius(angle):
    """Return an irregular edge outside the locked performance clearing."""
    return harmonic_radius(angle, PATH_LAYOUT["clearingEdge"])


def point_segment_distance(x, y, first, second):
    segment_x = second[0] - first[0]
    segment_y = second[1] - first[1]
    length_squared = segment_x * segment_x + segment_y * segment_y
    if length_squared == 0.0:
        return math.hypot(x - first[0], y - first[1])
    amount = max(
        0.0,
        min(
            1.0,
            ((x - first[0]) * segment_x + (y - first[1]) * segment_y)
            / length_squared,
        ),
    )
    closest_x = first[0] + segment_x * amount
    closest_y = first[1] + segment_y * amount
    return math.hypot(x - closest_x, y - closest_y)


def distance_to_path(x, y, path):
    points = path["points"]
    return min(
        point_segment_distance(x, y, points[index], points[index + 1])
        for index in range(len(points) - 1)
    )


def path_depression(x, y):
    if math.hypot(x, y) <= CLEARING_RADIUS:
        return 0.0
    depth = 0.0
    for path in PATHS:
        maximum_depth = float(path["depression"])
        if maximum_depth <= 0.0:
            continue
        distance = distance_to_path(x, y, path)
        half_width = float(path["halfWidth"])
        shoulder = float(path["shoulderWidth"])
        influence = 1.0 - smoothstep(half_width, half_width + shoulder, distance)
        depth = max(depth, maximum_depth * influence)
    return depth


def root_crossing_height(x, y):
    height = 0.0
    for crossing in ROOT_CROSSINGS:
        tangent_x, tangent_y = crossing["tangent"]
        tangent_length = math.hypot(tangent_x, tangent_y)
        tangent_x /= tangent_length
        tangent_y /= tangent_length
        delta_x = x - crossing["center"][0]
        delta_y = y - crossing["center"][1]
        along = abs(delta_x * tangent_x + delta_y * tangent_y)
        across = abs(-delta_x * tangent_y + delta_y * tangent_x)
        along_influence = 1.0 - smoothstep(
            float(crossing["halfWidth"]),
            float(crossing["halfWidth"]) * 2.4,
            along,
        )
        across_influence = 1.0 - smoothstep(
            float(crossing["halfLength"]),
            float(crossing["halfLength"]) + 0.9,
            across,
        )
        height += float(crossing["height"]) * along_influence * across_influence
    return height


def terrain_mound(x, y, center_x, center_y, radius, height):
    distance = math.hypot(x - center_x, y - center_y)
    influence = 1.0 - smoothstep(radius * 0.18, radius, distance)
    return height * influence * influence


def base_terrain_height(x, y):
    radius = math.hypot(x, y)
    if radius <= CLEARING_RADIUS:
        return 0.0

    # The current Forest and Coven Hub both depend on a broad level clearing.
    # Woodland relief begins outside their maximum authored performance area.
    edge_radius = clearing_edge_radius(math.atan2(y, x))
    basin_rise = smoothstep(edge_radius, 64.0, radius) * 2.2
    bank_noise = smoothstep(edge_radius, 42.0, radius) * (
        0.36 * math.sin(x * 0.19 + y * 0.11)
        + 0.22 * math.sin(x * 0.09 - y * 0.23)
        + 0.14 * math.cos((x + y) * 0.31)
    )
    outer_influence = smoothstep(48.0, 102.0, radius)
    outer_undulation = outer_influence * (
        0.78 * math.sin(x * 0.047 + y * 0.026)
        + 0.51 * math.cos(x * 0.034 - y * 0.051)
        + 0.32 * math.sin(radius * 0.095 + math.atan2(y, x) * 4.0)
    )
    distant_forms = (
        terrain_mound(x, y, -49.0, 38.0, 34.0, 5.4)
        + terrain_mound(x, y, 48.0, 51.0, 39.0, 4.6)
        + terrain_mound(x, y, 66.0, -32.0, 34.0, 5.8)
        + terrain_mound(x, y, -58.0, -51.0, 42.0, 5.1)
        + terrain_mound(x, y, -112.0, 72.0, 62.0, 7.8)
        + terrain_mound(x, y, 103.0, 91.0, 70.0, 8.4)
        + terrain_mound(x, y, 124.0, -68.0, 61.0, 8.9)
        + terrain_mound(x, y, -96.0, -112.0, 74.0, 7.2)
    )
    base_height = basin_rise + bank_noise + outer_undulation + distant_forms

    angle = math.atan2(y, x)
    boundary_radius = terrain_boundary_radius(angle)
    skirt = smoothstep(WORLD_SKIRT_START, 1.0, radius / boundary_radius)
    return base_height - skirt * WORLD_SKIRT_DEPTH


def terrain_height(x, y):
    radius = math.hypot(x, y)
    if radius <= CLEARING_RADIUS:
        return 0.0
    return (
        base_terrain_height(x, y)
        - path_depression(x, y)
        + root_crossing_height(x, y)
    )


def forest_floor_material(
    name,
    diffuse_path,
    normal_path,
    roughness_path,
    roughness_scale,
    normal_strength,
):
    """Build one glTF-safe floor material from an existing texture family."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness_scale

    if os.path.isfile(diffuse_path):
        diffuse = nodes.new("ShaderNodeTexImage")
        diffuse.name = f"{name} Diffuse"
        diffuse.image = bpy.data.images.load(diffuse_path, check_existing=True)
        diffuse.image.colorspace_settings.name = "sRGB"
        macro_uv = nodes.new("ShaderNodeUVMap")
        macro_uv.name = f"{name} Macro UV"
        macro_uv.uv_map = "Forest Macro UV"
        links.new(macro_uv.outputs["UV"], diffuse.inputs["Vector"])
        links.new(diffuse.outputs["Color"], bsdf.inputs["Base Color"])

    if os.path.isfile(roughness_path):
        roughness = nodes.new("ShaderNodeTexImage")
        roughness.name = f"{name} Roughness"
        roughness.image = bpy.data.images.load(roughness_path, check_existing=True)
        roughness.image.colorspace_settings.name = "Non-Color"
        roughness_factor = nodes.new("ShaderNodeMath")
        roughness_factor.name = f"{name} Roughness Factor"
        roughness_factor.operation = "MULTIPLY"
        roughness_factor.inputs[1].default_value = roughness_scale
        detail_uv = nodes.new("ShaderNodeUVMap")
        detail_uv.name = f"{name} Detail UV"
        detail_uv.uv_map = "Forest Detail UV"
        links.new(detail_uv.outputs["UV"], roughness.inputs["Vector"])
        links.new(roughness.outputs["Color"], roughness_factor.inputs[0])
        links.new(roughness_factor.outputs["Value"], bsdf.inputs["Roughness"])

    if os.path.isfile(normal_path):
        normal = nodes.new("ShaderNodeTexImage")
        normal.name = f"{name} Normal"
        normal.image = bpy.data.images.load(normal_path, check_existing=True)
        normal.image.colorspace_settings.name = "Non-Color"
        detail_uv = nodes.get(f"{name} Detail UV") or nodes.new("ShaderNodeUVMap")
        detail_uv.name = f"{name} Detail UV"
        detail_uv.uv_map = "Forest Detail UV"
        links.new(detail_uv.outputs["UV"], normal.inputs["Vector"])
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = normal_strength
        links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    return material


def create_floor_materials():
    if not os.path.isfile(ZONED_DIFFUSE_PATH):
        raise RuntimeError(
            "Missing zoned Forest diffuse. Run node scripts/build-forest-floor-texture.mjs"
        )
    forest_diffuse = ZONED_DIFFUSE_PATH
    forest_normal = os.path.join(TEXTURE_DIR, "normal.jpg")
    forest_roughness = os.path.join(TEXTURE_DIR, "roughness.jpg")

    definitions = (
        (
            MATERIAL_ZONE_NAMES[0],
            forest_diffuse,
            forest_normal,
            forest_roughness,
            0.96,
            0.38,
        ),
        (
            MATERIAL_ZONE_NAMES[1],
            forest_diffuse,
            forest_normal,
            forest_roughness,
            0.96,
            0.58,
        ),
        (
            MATERIAL_ZONE_NAMES[2],
            forest_diffuse,
            forest_normal,
            forest_roughness,
            0.98,
            0.64,
        ),
        (
            MATERIAL_ZONE_NAMES[3],
            forest_diffuse,
            forest_normal,
            forest_roughness,
            1.0,
            0.46,
        ),
        (
            MATERIAL_ZONE_NAMES[4],
            forest_diffuse,
            forest_normal,
            forest_roughness,
            0.76,
            0.72,
        ),
        (
            MATERIAL_ZONE_NAMES[5],
            forest_diffuse,
            forest_normal,
            forest_roughness,
            1.0,
            0.42,
        ),
    )
    return [forest_floor_material(*definition) for definition in definitions]


def zone_noise(x, y):
    return (
        0.54 * math.sin(x * 0.057 + y * 0.031)
        + 0.31 * math.cos(x * 0.029 - y * 0.063)
        + 0.15 * math.sin((x + y) * 0.101)
    )


def shade_pattern(x, y):
    return 0.62 * math.sin(x * 0.043 - y * 0.026) + 0.38 * math.cos(
        x * 0.024 + y * 0.052
    )


def ellipse_metric(x, y, center_x, center_y, radius_x, radius_y, rotation=0.0):
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    local_x = (x - center_x) * cosine + (y - center_y) * sine
    local_y = -(x - center_x) * sine + (y - center_y) * cosine
    return math.sqrt((local_x / radius_x) ** 2 + (local_y / radius_y) ** 2)


def terrain_material_zone(x, y):
    """Assign ecological material families without changing the landform."""
    radius = math.hypot(x, y)
    noise = zone_noise(x, y)
    if radius <= PERFORMANCE_KEEP_CLEAR_RADIUS:
        return 0
    for path in PATHS:
        path_width = float(path["halfWidth"]) + noise * 0.18
        if distance_to_path(x, y, path) <= path_width:
            return 1
    edge_radius = clearing_edge_radius(math.atan2(y, x))
    if radius <= edge_radius + noise * 0.45:
        return 0
    if radius >= 119.0 + noise * 11.0:
        return 5

    if min(
        ellipse_metric(x, y, center_x, center_y, radius_x, radius_y, rotation)
        for center_x, center_y, radius_x, radius_y, rotation in DAMP_HOLLOWS
    ) < 1.0 + noise * 0.08:
        return 4

    if shade_pattern(x, y) + noise * 0.30 > 0.43:
        return 3
    return 2


def terrain_detail_uv(x, y):
    """Keep detail continuous while bending the large repeating grid."""
    warped_x = x + 0.78 * math.sin(y * 0.031) + 0.32 * math.cos((x + y) * 0.057)
    warped_y = y + 0.71 * math.cos(x * 0.029) - 0.29 * math.sin((x - y) * 0.061)
    return warped_x / TERRAIN_UV_METRES, warped_y / TERRAIN_UV_METRES


def terrain_macro_uv(x, y):
    world_extent = 200.0
    return (
        (x + world_extent) / (world_extent * 2.0),
        (y + world_extent) / (world_extent * 2.0),
    )


def create_terrain(materials):
    vertices = [(0.0, 0.0, terrain_height(0.0, 0.0))]
    faces = []
    detail_uvs = [terrain_detail_uv(0.0, 0.0)]
    macro_uvs = [terrain_macro_uv(0.0, 0.0)]

    for ring in range(1, TERRAIN_RADIAL_SEGMENTS + 1):
        radial_fraction = ring / TERRAIN_RADIAL_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            angle = math.tau * segment / TERRAIN_ANGULAR_SEGMENTS
            radius = terrain_boundary_radius(angle) * radial_fraction
            x = math.cos(angle) * radius
            y = math.sin(angle) * radius
            vertices.append((x, y, terrain_height(x, y)))
            detail_uvs.append(terrain_detail_uv(x, y))
            macro_uvs.append(terrain_macro_uv(x, y))

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

    mesh = bpy.data.meshes.new("Forest Sculpted Terrain Mesh")
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=True):
        raise RuntimeError("Forest terrain mesh required validation corrections")
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True

    detail_uv_layer = mesh.uv_layers.new(name="Forest Detail UV")
    macro_uv_layer = mesh.uv_layers.new(name="Forest Macro UV")
    for material in materials:
        mesh.materials.append(material)
    zone_counts = [0] * len(materials)
    for polygon in mesh.polygons:
        zone_index = terrain_material_zone(polygon.center.x, polygon.center.y)
        polygon.material_index = zone_index
        zone_counts[zone_index] += 1
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            detail_uv_layer.data[loop_index].uv = detail_uvs[vertex_index]
            macro_uv_layer.data[loop_index].uv = macro_uvs[vertex_index]

    terrain = bpy.data.objects.new("Forest_Base_WoodlandBasin", mesh)
    bpy.context.collection.objects.link(terrain)
    terrain["tka_role"] = "terrain"
    terrain["tka_phase"] = "world-envelope"
    terrain["tka_material_phase"] = "forest-floor-zones"
    terrain["tka_material_zone_names"] = "|".join(MATERIAL_ZONE_NAMES)
    terrain["tka_material_zone_counts"] = zone_counts
    terrain["tka_uv_metres_per_tile"] = TERRAIN_UV_METRES
    terrain["tka_macro_diffuse"] = os.path.basename(ZONED_DIFFUSE_PATH)
    terrain["tka_path_phase"] = "path-and-clearing-composition"
    terrain["tka_path_layout_version"] = int(PATH_LAYOUT["version"])
    terrain["tka_path_layout_sha256"] = PATH_LAYOUT_SHA256
    terrain["tka_path_names"] = "|".join(path["name"] for path in PATHS)
    terrain["tka_path_roles"] = "|".join(path["role"] for path in PATHS)
    terrain["tka_root_crossing_count"] = len(ROOT_CROSSINGS)
    terrain["tka_clearing_radius"] = CLEARING_RADIUS
    clearing_edge_radii = [
        clearing_edge_radius(math.tau * segment / TERRAIN_ANGULAR_SEGMENTS)
        for segment in range(TERRAIN_ANGULAR_SEGMENTS)
    ]
    terrain["tka_clearing_edge_min_radius"] = min(clearing_edge_radii)
    terrain["tka_clearing_edge_max_radius"] = max(clearing_edge_radii)
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
    return terrain


def verify_terrain():
    flat_samples = []
    for y in range(-30, 31):
        for x in range(-30, 31):
            if math.hypot(x, y) <= CLEARING_RADIUS:
                flat_samples.append(abs(terrain_height(x, y)))
    maximum_flat_deviation = max(flat_samples)
    if maximum_flat_deviation > 0.02:
        raise RuntimeError(
            f"Performance clearing is not flat: {maximum_flat_deviation:.4f}m"
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
    if minimum_skirt_drop < 10.0:
        raise RuntimeError(
            f"Terrain skirt is too shallow: {minimum_skirt_drop:.3f}m"
        )

    print("\nForest terrain verification")
    print(f"Flat clearing maximum deviation: {maximum_flat_deviation:.4f} m")
    print(
        "Terrain boundary radius:         "
        f"{minimum_boundary_radius:.3f} to {maximum_boundary_radius:.3f} m"
    )
    print(f"Minimum outer skirt drop:        {minimum_skirt_drop:.3f} m")


def verify_path_layout():
    roles = [path["role"] for path in PATHS]
    if roles.count("stage-to-camp") != 1:
        raise RuntimeError("Forest needs one stage-to-camp path")
    if roles.count("forest-exit") != 2:
        raise RuntimeError("Forest needs two exit paths")
    if roles.count("secondary-loop") != 1:
        raise RuntimeError("Forest needs one secondary loop")

    clearing_edges = [
        clearing_edge_radius(math.tau * segment / TERRAIN_ANGULAR_SEGMENTS)
        for segment in range(TERRAIN_ANGULAR_SEGMENTS)
    ]
    if min(clearing_edges) < CLEARING_RADIUS:
        raise RuntimeError("Irregular clearing edge entered the performance area")
    if max(clearing_edges) - min(clearing_edges) < 2.5:
        raise RuntimeError("Clearing edge lost its irregular silhouette")

    for path in PATHS:
        if len(path["points"]) < 2:
            raise RuntimeError(f"Path has too few points: {path['name']}")
        if not any(
            terrain_material_zone(point[0], point[1]) == 1
            for point in path["points"]
        ):
            raise RuntimeError(f"Path has no soil material sample: {path['name']}")
        for point in path["points"]:
            radius = math.hypot(point[0], point[1])
            boundary = terrain_boundary_radius(math.atan2(point[1], point[0]))
            if radius > boundary + 0.5:
                raise RuntimeError(f"Path leaves the terrain: {path['name']}")

        expected_depth = float(path["depression"])
        if expected_depth > 0.0:
            probe = next(
                point
                for point in path["points"]
                if math.hypot(point[0], point[1]) > CLEARING_RADIUS + 8.0
            )
            actual_depth = path_depression(probe[0], probe[1])
            if actual_depth < expected_depth * 0.95:
                raise RuntimeError(f"Path grade is too shallow: {path['name']}")

    for crossing in ROOT_CROSSINGS:
        crossing_height = root_crossing_height(
            crossing["center"][0], crossing["center"][1]
        )
        if crossing_height < float(crossing["height"]) * 0.95:
            raise RuntimeError(f"Root crossing lost its grade: {crossing['id']}")

    print("\nForest path verification")
    print(f"Authored paths:                   {len(PATHS)}")
    print(f"Root grade crossings:             {len(ROOT_CROSSINGS)}")
    print(
        "Irregular clearing edge:         "
        f"{min(clearing_edges):.3f} to {max(clearing_edges):.3f} m"
    )


def inside_rotated_ellipse(x, y, definition):
    center_x, center_y = definition["center"]
    radius_x, radius_y = definition["radii"]
    angle = math.radians(float(definition.get("rotationDegrees", 0.0)))
    cosine = math.cos(angle)
    sine = math.sin(angle)
    delta_x = x - float(center_x)
    delta_y = y - float(center_y)
    local_x = delta_x * cosine + delta_y * sine
    local_y = -delta_x * sine + delta_y * cosine
    return (local_x / float(radius_x)) ** 2 + (local_y / float(radius_y)) ** 2 <= 1.0


def sample_cluster_point(rng, cluster):
    amount = math.sqrt(rng.random())
    angle = rng.random() * math.tau
    local_x = math.cos(angle) * float(cluster["radii"][0]) * amount
    local_y = math.sin(angle) * float(cluster["radii"][1]) * amount
    rotation = math.radians(float(cluster.get("rotationDegrees", 0.0)))
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    return (
        float(cluster["center"][0]) + local_x * cosine - local_y * sine,
        float(cluster["center"][1]) + local_x * sine + local_y * cosine,
    )


def tree_position_is_valid(x, y, asset, placements):
    radius = math.hypot(x, y)
    angle = math.atan2(y, x)
    if radius < clearing_edge_radius(angle) + float(asset["clearingSetback"]):
        return False
    if radius > terrain_boundary_radius(angle) * float(TREE_LAYOUT["outerBoundaryFraction"]):
        return False
    for path in PATHS:
        required = (
            float(path["halfWidth"])
            + float(path["shoulderWidth"])
            + float(asset["pathClearance"])
        )
        if distance_to_path(x, y, path) < required:
            return False
    if any(inside_rotated_ellipse(x, y, opening) for opening in TREE_LAYOUT["openings"]):
        return False
    for placed in placements:
        other = TREE_ASSETS[placed["assetId"]]
        minimum = float(TREE_LAYOUT["spacingFactor"]) * (
            float(asset["footprintRadius"]) + float(other["footprintRadius"])
        )
        if math.hypot(x - placed["x"], y - placed["y"]) < minimum:
            return False
    return True


def build_tree_placements():
    placements = []
    for cluster_index, cluster in enumerate(TREE_LAYOUT["clusters"]):
        rng = random.Random(int(TREE_LAYOUT["seed"]) + cluster_index * 104729)
        requested = [
            asset_id
            for asset_id, count in cluster["counts"].items()
            for _ in range(int(count))
        ]
        rng.shuffle(requested)
        for asset_id in requested:
            asset = TREE_ASSETS.get(asset_id)
            if asset is None:
                raise RuntimeError(f"Unknown tree asset in cluster: {asset_id}")
            for _ in range(5000):
                x, y = sample_cluster_point(rng, cluster)
                if not tree_position_is_valid(x, y, asset, placements):
                    continue
                placements.append(
                    {
                        "assetId": asset_id,
                        "clusterId": cluster["id"],
                        "x": x,
                        "y": y,
                        "rotation": rng.random() * math.tau,
                        "scaleVariation": rng.uniform(
                            float(asset["scaleRange"][0]),
                            float(asset["scaleRange"][1]),
                        ),
                    }
                )
                break
            else:
                raise RuntimeError(
                    f"Could not place {asset_id} in cluster {cluster['id']} without overlap"
                )
    return placements


def import_tree_prototype(asset):
    source_path = os.path.join(PROJECT_ROOT, asset["stagedPath"])
    if not os.path.isfile(source_path):
        raise RuntimeError(
            f"Missing staged tree source {source_path}; run prepare-forest-composition-sources.mjs"
        )
    before = {obj.name for obj in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=source_path)
    imported = [obj for obj in bpy.data.objects if obj.name not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(
            f"Tree {asset['id']} must import as one mesh, found {len(meshes)}"
        )
    prototype = meshes[0]
    for obj in imported:
        if obj is not prototype:
            bpy.data.objects.remove(obj, do_unlink=True)
    prototype.parent = None
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = prototype
    prototype.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    prototype.select_set(False)
    prototype.location = (0.0, 0.0, 0.0)
    source_min_z = min(corner[2] for corner in prototype.bound_box)
    source_max_z = max(corner[2] for corner in prototype.bound_box)
    source_height = source_max_z - source_min_z
    if source_height <= 0.01:
        raise RuntimeError(f"Tree {asset['id']} has invalid height {source_height}")
    prototype.data.name = f"ForestTreeMesh_{asset['id']}"
    return prototype, source_min_z, source_height


def distance_to_rectangle_edge(x, y, half_width, half_depth):
    delta_x = max(abs(x) - half_width, 0.0)
    delta_y = max(abs(y) - half_depth, 0.0)
    return math.hypot(delta_x, delta_y)


def decoded_prop_source(source):
    source_path = os.path.join(PROJECT_ROOT, source["path"])
    if not os.path.isfile(source_path):
        raise RuntimeError(f"Missing Forest static prop source: {source_path}")
    cache_dir = os.path.join(QA_DIR, "forest-static-prop-sources")
    os.makedirs(cache_dir, exist_ok=True)
    output_path = os.path.join(cache_dir, os.path.basename(source_path))
    if not os.path.isfile(output_path) or os.path.getmtime(output_path) < os.path.getmtime(source_path):
        npx = "npx.cmd" if os.name == "nt" else "npx"
        subprocess.run(
            [npx, "gltf-transform", "copy", source_path, output_path],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    return output_path


def import_prop_prototype(source):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=decoded_prop_source(source))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"Static prop source imported no meshes: {source['id']}")
    root = bpy.data.objects.new(f"ForestStaticPrototype_{source['id']}", None)
    bpy.context.collection.objects.link(root)
    imported_set = set(imported)
    for obj in imported:
        if obj.parent not in imported_set:
            matrix_world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = matrix_world
    return root


def clone_group(prototype, name):
    root = prototype.copy()
    root.name = name
    bpy.context.scene.collection.objects.link(root)
    mapping = {prototype: root}
    for original in prototype.children_recursive:
        clone = original.copy()
        if original.data is not None:
            clone.data = original.data
        clone.name = f"{name}_{original.name}"
        bpy.context.scene.collection.objects.link(clone)
        clone.parent = mapping[original.parent]
        mapping[original] = clone
    return root


def remove_group(root):
    for obj in [*root.children_recursive, root]:
        bpy.data.objects.remove(obj, do_unlink=True)


def group_world_bounds(root):
    corners = []
    for obj in [root, *root.children_recursive]:
        if obj.type != "MESH":
            continue
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not corners:
        raise RuntimeError(f"Forest static prop {root.name} has no mesh bounds")
    minimum = Vector(
        (
            min(corner.x for corner in corners),
            min(corner.y for corner in corners),
            min(corner.z for corner in corners),
        )
    )
    maximum = Vector(
        (
            max(corner.x for corner in corners),
            max(corner.y for corner in corners),
            max(corner.z for corner in corners),
        )
    )
    return minimum, maximum


def fit_static_prop(root, placement):
    bpy.context.view_layer.update()
    minimum, maximum = group_world_bounds(root)
    extent = maximum - minimum
    longest = max(extent)
    if longest <= 0.001:
        raise RuntimeError(f"Static prop {placement['id']} has invalid bounds")
    scale = float(placement["targetLongestMetres"]) / longest
    root.scale = (scale, scale, scale)
    root.rotation_mode = "XYZ"
    root.rotation_euler[2] = math.radians(float(placement["rotationDegrees"]))
    bpy.context.view_layer.update()
    minimum, maximum = group_world_bounds(root)
    center = (minimum + maximum) * 0.5
    x, y = map(float, placement["position"])
    root.location.x += x - center.x
    root.location.y += y - center.y
    root.location.z += (
        terrain_height(x, y)
        - float(placement["buryDepthMetres"])
        - minimum.z
    )
    bpy.context.view_layer.update()


def mark_near_frame_object(obj, role, source_id, vignette_id):
    obj["tka_role"] = role
    obj["tka_export_layer"] = "near-frame"
    obj["tka_static_prop_source"] = source_id
    obj["tka_static_prop_vignette"] = vignette_id
    obj["tka_static_prop_layout_version"] = int(STATIC_PROP_LAYOUT["version"])
    obj["tka_static_prop_layout_sha256"] = STATIC_PROP_LAYOUT_SHA256


def validate_static_prop_layout(tree_placements):
    approved_frames = {
        candidate["id"]: candidate for candidate in PROP_LINEUP["framingCandidates"]
    }
    frames = STATIC_PROP_LAYOUT["frameTrees"]
    if STATIC_PROP_LAYOUT["visibility"] != "default-forest-only":
        raise RuntimeError("Forest near-frame layer must remain default-only")
    if len(frames) != 2:
        raise RuntimeError("Forest Gate 9 requires exactly two approved frame trees")
    for frame in frames:
        approved = approved_frames.get(frame["id"])
        if approved is None:
            raise RuntimeError(f"Unapproved Forest frame tree: {frame['id']}")
        for field in ("assetId", "position", "scale", "rotationDegrees"):
            if frame[field] != approved[field]:
                raise RuntimeError(f"Forest frame tree drifted from Gate 8: {frame['id']} {field}")
        asset = TREE_ASSETS[frame["assetId"]]
        x, y = map(float, frame["position"])
        for path in PATHS:
            required = (
                float(path["halfWidth"])
                + float(path["shoulderWidth"])
                + float(asset["pathClearance"])
            )
            if distance_to_path(x, y, path) < required:
                raise RuntimeError(f"Forest frame tree blocks path: {frame['id']}")
        for placed in tree_placements:
            other = TREE_ASSETS[placed["assetId"]]
            required = float(TREE_LAYOUT["spacingFactor"]) * (
                float(asset["footprintRadius"]) + float(other["footprintRadius"])
            )
            if math.hypot(x - placed["x"], y - placed["y"]) < required:
                raise RuntimeError(f"Forest frame tree overlaps approved composition: {frame['id']}")

    rules = STATIC_PROP_LAYOUT["rules"]
    fire_x, fire_y = map(float, CAMPSITE_LAYOUT["fire"]["position"])
    source_counts = {source_id: 0 for source_id in STATIC_PROP_SOURCES}
    prop_count = 0
    path_margins = []
    camp_margins = []
    anchor_distances = []
    frame_by_id = {frame["id"]: frame for frame in frames}
    for vignette in STATIC_PROP_LAYOUT["vignettes"]:
        anchor = frame_by_id.get(vignette["anchorTreeId"])
        if anchor is None:
            raise RuntimeError(f"Static vignette has no frame-tree anchor: {vignette['id']}")
        anchor_x, anchor_y = map(float, anchor["position"])
        if len(vignette["props"]) != 3:
            raise RuntimeError(f"Static vignette must contain three related props: {vignette['id']}")
        for placement in vignette["props"]:
            source_id = placement["sourceId"]
            if source_id not in STATIC_PROP_SOURCES:
                raise RuntimeError(f"Unknown Forest static prop source: {source_id}")
            source_counts[source_id] += 1
            prop_count += 1
            x, y = map(float, placement["position"])
            radius = float(placement["targetLongestMetres"]) * 0.5
            if math.hypot(x, y) - radius < float(rules["performanceKeepClearRadiusMetres"]):
                raise RuntimeError(f"Static prop enters performance keep-clear: {placement['id']}")
            anchor_distance = math.hypot(x - anchor_x, y - anchor_y)
            anchor_distances.append(anchor_distance)
            if anchor_distance > float(rules["maximumPropDistanceFromAnchorMetres"]):
                raise RuntimeError(f"Static prop lost its vignette anchor: {placement['id']}")
            for path in PATHS:
                margin = (
                    distance_to_path(x, y, path)
                    - float(path["halfWidth"])
                    - float(path["shoulderWidth"])
                    - radius
                )
                path_margins.append(margin)
                if margin < float(rules["minimumPathShoulderMarginMetres"]):
                    raise RuntimeError(f"Static prop blocks path shoulder: {placement['id']}")
            camp_margin = math.hypot(x - fire_x, y - fire_y) - radius
            camp_margins.append(camp_margin)
            if camp_margin < float(rules["minimumCampfireCenterDistanceMetres"]):
                raise RuntimeError(f"Static prop enters campfire pocket: {placement['id']}")

    if sum(1 for count in source_counts.values() if count > 0) < int(rules["minimumDistinctSourceFamilies"]):
        raise RuntimeError("Forest static prop layer lost source-family diversity")
    if max(source_counts.values()) > int(rules["maximumInstancesPerSource"]):
        raise RuntimeError("Forest static prop source repeats too often")
    return {
        "frameTreeCount": len(frames),
        "vignetteCount": len(STATIC_PROP_LAYOUT["vignettes"]),
        "propCount": prop_count,
        "sourceCounts": source_counts,
        "minimumPathShoulderMarginMetres": min(path_margins),
        "minimumCampfireCenterDistanceMetres": min(camp_margins),
        "maximumPropAnchorDistanceMetres": max(anchor_distances),
    }


def create_near_frame_layer(tree_placements):
    metrics = validate_static_prop_layout(tree_placements)
    created_meshes = []
    frames_by_asset = {}
    for frame in STATIC_PROP_LAYOUT["frameTrees"]:
        frames_by_asset.setdefault(frame["assetId"], []).append(frame)
    for asset_id, frames in frames_by_asset.items():
        asset = TREE_ASSETS[asset_id]
        prototype, source_min_z, source_height = import_tree_prototype(asset)
        normalized_scale = float(asset["targetHeightMetres"]) / source_height
        for frame in frames:
            x, y = map(float, frame["position"])
            scale = normalized_scale * float(frame["scale"])
            tree = prototype.copy()
            tree.data = prototype.data
            bpy.context.scene.collection.objects.link(tree)
            tree.name = f"ForestNearFrameTree_{frame['id']}"
            tree.scale = (scale, scale, scale)
            tree.rotation_mode = "XYZ"
            tree.rotation_euler[2] = math.radians(float(frame["rotationDegrees"]))
            tree.location = (x, y, terrain_height(x, y) - source_min_z * scale)
            mark_near_frame_object(tree, "near-frame-tree", asset_id, frame["id"])
            tree["tka_frame_tree_id"] = frame["id"]
            created_meshes.append(tree)
        bpy.data.objects.remove(prototype, do_unlink=True)

    props_by_source = {source_id: [] for source_id in STATIC_PROP_SOURCES}
    vignette_by_prop = {}
    for vignette in STATIC_PROP_LAYOUT["vignettes"]:
        for placement in vignette["props"]:
            props_by_source[placement["sourceId"]].append(placement)
            vignette_by_prop[placement["id"]] = vignette["id"]

    for source_id, placements in props_by_source.items():
        if not placements:
            continue
        prototype = import_prop_prototype(STATIC_PROP_SOURCES[source_id])
        for placement in placements:
            root = clone_group(prototype, f"ForestNearFrameProp_{placement['id']}")
            fit_static_prop(root, placement)
            root["tka_export_layer"] = "near-frame"
            for obj in root.children_recursive:
                if obj.type != "MESH":
                    continue
                mark_near_frame_object(
                    obj,
                    "near-frame-static-prop",
                    source_id,
                    vignette_by_prop[placement["id"]],
                )
                obj["tka_static_prop_id"] = placement["id"]
                created_meshes.append(obj)
        remove_group(prototype)

    metrics_path = os.path.join(QA_DIR, "forest_near_frame_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as metrics_file:
        json.dump(
            {
                "contractVersion": STATIC_PROP_LAYOUT["version"],
                "contractSha256": STATIC_PROP_LAYOUT_SHA256,
                "visibility": STATIC_PROP_LAYOUT["visibility"],
                **metrics,
            },
            metrics_file,
            indent=2,
        )
        metrics_file.write("\n")

    print("\nForest near-frame verification")
    print(f"Frame trees:                       {metrics['frameTreeCount']}")
    print(f"Anchored vignettes:                {metrics['vignetteCount']}")
    print(f"Static prop instances:             {metrics['propCount']}")
    print(f"Minimum path shoulder margin:      {metrics['minimumPathShoulderMarginMetres']:.3f} m")
    print(f"Minimum campfire center distance:  {metrics['minimumCampfireCenterDistanceMetres']:.3f} m")
    print(f"Maximum prop-anchor distance:      {metrics['maximumPropAnchorDistanceMetres']:.3f} m")
    print(f"Near-frame metrics:                {metrics_path}")
    return created_meshes, metrics


def create_tree_composition(terrain):
    placements = build_tree_placements()
    counts = {asset_id: 0 for asset_id in TREE_ASSETS}
    by_asset = {asset_id: [] for asset_id in TREE_ASSETS}
    for placement in placements:
        by_asset[placement["assetId"]].append(placement)

    for asset_id, asset_placements in by_asset.items():
        if not asset_placements:
            continue
        asset = TREE_ASSETS[asset_id]
        prototype, source_min_z, source_height = import_tree_prototype(asset)
        normalized_scale = float(asset["targetHeightMetres"]) / source_height
        for index, placement in enumerate(asset_placements):
            scale = normalized_scale * placement["scaleVariation"]
            tree = prototype.copy()
            tree.data = prototype.data
            bpy.context.collection.objects.link(tree)
            tree.name = f"ForestTree_{asset_id}_{index:03d}"
            tree.scale = (scale, scale, scale)
            # Imported glTF nodes use quaternion rotation mode. Switch the
            # linked instance before assigning its authored random yaw or the
            # Euler value is stored but omitted from the exported transform.
            tree.rotation_mode = "XYZ"
            tree.rotation_euler[2] = placement["rotation"]
            tree.location = (
                placement["x"],
                placement["y"],
                terrain_height(placement["x"], placement["y"]) - source_min_z * scale,
            )
            tree["tka_role"] = "tree"
            tree["tka_phase"] = "forest-composition"
            tree["tka_tree_asset"] = asset_id
            tree["tka_tree_family"] = asset["family"]
            tree["tka_tree_roles"] = "|".join(asset["roles"])
            tree["tka_target_height_metres"] = float(asset["targetHeightMetres"])
            tree["tka_tree_layout_version"] = int(TREE_LAYOUT["version"])
            tree["tka_tree_layout_sha256"] = TREE_LAYOUT_SHA256
            counts[asset_id] += 1
        bpy.data.objects.remove(prototype, do_unlink=True)

    terrain["tka_tree_phase"] = "forest-composition"
    terrain["tka_tree_layout_version"] = int(TREE_LAYOUT["version"])
    terrain["tka_tree_layout_sha256"] = TREE_LAYOUT_SHA256
    terrain["tka_tree_count"] = len(placements)
    terrain["tka_tree_asset_ids"] = "|".join(TREE_ASSETS.keys())
    terrain["tka_tree_asset_counts"] = [counts[asset_id] for asset_id in TREE_ASSETS]
    terrain["tka_tree_cluster_names"] = "|".join(
        cluster["id"] for cluster in TREE_LAYOUT["clusters"]
    )
    terrain["tka_tree_cluster_count"] = len(TREE_LAYOUT["clusters"])
    terrain["tka_gpu_instances_required"] = True
    return placements, counts


def verify_tree_composition(placements, counts):
    expected = sum(
        int(count)
        for cluster in TREE_LAYOUT["clusters"]
        for count in cluster["counts"].values()
    )
    if len(placements) != expected:
        raise RuntimeError(f"Expected {expected} trees, placed {len(placements)}")
    if len(TREE_LAYOUT["clusters"]) < 8:
        raise RuntimeError("Forest composition needs connected near and far masses")
    for placement in placements:
        asset = TREE_ASSETS[placement["assetId"]]
        if not tree_position_is_valid(
            placement["x"], placement["y"], asset,
            [other for other in placements if other is not placement],
        ):
            raise RuntimeError(f"Tree composition contract failed at {placement}")

    minimum_spacing = min(
        math.hypot(first["x"] - second["x"], first["y"] - second["y"])
        for index, first in enumerate(placements)
        for second in placements[index + 1 :]
    )
    minimum_path_clearance = min(
        distance_to_path(placement["x"], placement["y"], path)
        - float(path["halfWidth"])
        - float(path["shoulderWidth"])
        for placement in placements
        for path in PATHS
    )
    role_counts = {}
    for asset_id, count in counts.items():
        for role in TREE_ASSETS[asset_id]["roles"]:
            role_counts[role] = role_counts.get(role, 0) + count
    for role in ("mature-canopy", "irregular-middle", "young", "snag"):
        if role_counts.get(role, 0) <= 0:
            raise RuntimeError(f"Forest composition lost the {role} role")

    metrics_path = os.path.join(QA_DIR, "forest_environment_tree_metrics.json")
    os.makedirs(QA_DIR, exist_ok=True)
    with open(metrics_path, "w", encoding="utf-8") as metrics_file:
        json.dump(
            {
                "contractVersion": TREE_LAYOUT["version"],
                "contractSha256": TREE_LAYOUT_SHA256,
                "treeCount": len(placements),
                "clusterCount": len(TREE_LAYOUT["clusters"]),
                "assetCounts": counts,
                "roleCounts": role_counts,
                "minimumTrunkSpacingMetres": minimum_spacing,
                "minimumPathShoulderClearanceMetres": minimum_path_clearance,
            },
            metrics_file,
            indent=2,
        )
        metrics_file.write("\n")

    print("\nForest tree verification")
    print(f"Tree instances:                    {len(placements)}")
    print(f"Connected masses:                  {len(TREE_LAYOUT['clusters'])}")
    print(f"Minimum trunk spacing:             {minimum_spacing:.3f} m")
    print(f"Minimum path shoulder clearance:   {minimum_path_clearance:.3f} m")
    print(f"Asset counts:                      {counts}")
    print(f"Tree metrics:                      {metrics_path}")


def principled_material(name, color, roughness=0.8):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def aim_at(obj, target):
    obj.rotation_euler = (
        Vector(target) - obj.location
    ).to_track_quat("-Z", "Y").to_euler()


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


def add_sun_light(name, direction, color, energy):
    data = bpy.data.lights.new(name, type="SUN")
    data.color = color
    data.energy = energy
    data.angle = math.radians(18.0)
    light = bpy.data.objects.new(f"QA_{name}", data)
    bpy.context.collection.objects.link(light)
    light.location = direction
    aim_at(light, (0.0, 0.0, 0.0))
    return light


def create_qa_performer():
    material = principled_material("QA Performer", (0.035, 0.045, 0.06), 0.55)
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20,
        ring_count=12,
        radius=0.13,
        location=(0.0, 0.0, 1.62),
    )
    parts.append(bpy.context.object)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16,
        radius=0.115,
        depth=0.77,
        location=(0.0, 0.0, 1.105),
    )
    parts.append(bpy.context.object)
    for index, x in enumerate((-0.12, 0.12)):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12,
            radius=0.055,
            depth=0.72,
            location=(x, 0.0, 0.39),
        )
        parts.append(bpy.context.object)
        parts[-1].name = f"QA_PerformerLeg{index}"
    for index, part in enumerate(parts):
        part.name = part.name if part.name.startswith("QA_") else f"QA_PerformerPart{index}"
        part.data.materials.append(material)


def render_qa_view(camera, location, target, path, lens):
    camera.data.type = "PERSP"
    camera.location = location
    camera.data.lens = lens
    aim_at(camera, target)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_qa_orthographic(camera, location, target, path, scale):
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = scale
    camera.location = location
    aim_at(camera, target)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def setup_qa_render(near_frame_objects):
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    os.makedirs(QA_DIR, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 18
    scene.world = bpy.data.worlds.new("Forest Moonlit World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.035, 0.038, 1.0)
    background.inputs["Strength"].default_value = 0.42
    scene.view_settings.look = "AgX - Medium High Contrast"

    add_sun_light(
        "AmbientMoon",
        (-42.0, -28.0, 58.0),
        (0.34, 0.52, 0.58),
        1.35,
    )

    add_area_light(
        "MoonKey",
        (-18.0, -14.0, 30.0),
        (0.44, 0.67, 0.86),
        3100.0,
        18.0,
        (0.0, 0.0, 0.0),
    )
    add_area_light(
        "CanopyFill",
        (0.0, 0.0, 72.0),
        (0.25, 0.42, 0.34),
        4200.0,
        48.0,
        (0.0, 0.0, 0.0),
    )
    add_area_light(
        "WarmBounce",
        (10.0, -6.0, 7.0),
        (1.0, 0.30, 0.08),
        520.0,
        5.0,
        (2.0, 0.0, 0.0),
    )

    camera_data = bpy.data.cameras.new("Forest QA Camera")
    camera_data.clip_end = 1200.0
    camera = bpy.data.objects.new("QA_ForestCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    create_qa_performer()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    # Blender uses Z-up. These positions map to the runtime Y-up camera presets.
    render_qa_view(camera, (0.0, -31.0, 8.0), (0.0, 0.0, 2.0), QA_PATHS["hero"], 38)
    render_qa_view(camera, (0.0, 31.0, 9.0), (0.0, 0.0, 2.0), QA_PATHS["reverse"], 38)
    render_qa_view(camera, (0.0, -9.0, 2.2), (0.0, 0.0, 1.35), QA_PATHS["walk"], 31)
    render_qa_view(camera, (8.0, -24.0, 5.5), (39.0, 4.0, 7.0), QA_PATHS["trees"], 41)
    render_qa_view(camera, (1.0, -12.0, 3.1), (9.0, -2.0, 0.15), QA_PATHS["floor"], 41)
    render_qa_view(camera, (11.0, -11.0, 4.8), (5.5, 3.5, 1.1), QA_PATHS["camp"], 42)
    render_qa_view(camera, (-8.0, -12.0, 4.5), (0.0, 0.0, 1.0), QA_PATHS["stage"], 41)
    render_qa_view(
        camera,
        (0.0, -180.0, 520.0),
        (0.0, 0.0, 1.0),
        QA_PATHS["world"],
        24,
    )
    render_qa_orthographic(
        camera,
        (0.0, 0.0, 520.0),
        (0.0, 0.0, 0.0),
        QA_PATHS["paths"],
        390.0,
    )
    render_qa_view(
        camera,
        (7.0, -45.0, 2.2),
        (1.0, -18.0, 0.65),
        QA_PATHS["pathwalk"],
        34,
    )
    render_qa_view(
        camera,
        (9.0, -26.0, terrain_height(9.0, -26.0) + 2.35),
        (25.0, -29.0, terrain_height(25.0, -29.0) + 0.72),
        QA_PATHS["ecology-edge"],
        42,
    )
    render_qa_view(
        camera,
        (62.0, -30.0, terrain_height(62.0, -30.0) + 3.35),
        (73.0, -43.0, terrain_height(73.0, -43.0) + 0.62),
        QA_PATHS["ecology-hollow"],
        40,
    )
    render_qa_view(
        camera,
        (6.0, -43.0, terrain_height(6.0, -43.0) + 3.0),
        (12.0, -52.0, terrain_height(12.0, -52.0) + 0.46),
        QA_PATHS["ecology-root"],
        43,
    )
    render_qa_view(
        camera,
        (-17.5, -22.0, 4.0),
        (-8.5, -10.7, 1.25),
        QA_PATHS["frame-southwest"],
        44,
    )
    render_qa_view(
        camera,
        (22.5, -24.0, 4.4),
        (14.8, -11.6, 1.15),
        QA_PATHS["frame-southeast"],
        44,
    )
    render_qa_orthographic(
        camera,
        (0.0, -1.0, 55.0),
        (0.0, -1.0, 0.0),
        QA_PATHS["near-frame-plan"],
        46.0,
    )
    for obj in near_frame_objects:
        obj.hide_render = True
    render_qa_view(
        camera,
        (0.0, -31.0, 8.0),
        (0.0, 0.0, 2.0),
        QA_PATHS["coven-frame-omitted"],
        38,
    )
    for obj in near_frame_objects:
        obj.hide_render = False
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


reset_scene()
terrain_materials = create_floor_materials()
terrain = create_terrain(terrain_materials)
verify_terrain()
verify_path_layout()
tree_placements, tree_counts = create_tree_composition(terrain)
verify_tree_composition(tree_placements, tree_counts)
ground_life_metrics = build_ground_life(
    project_root=PROJECT_ROOT,
    layout=GROUND_LAYOUT,
    layout_sha256=GROUND_LAYOUT_SHA256,
    ecology=GROUND_ECOLOGY,
    ecology_sha256=GROUND_ECOLOGY_SHA256,
    terrain=terrain,
    terrain_height=terrain_height,
    terrain_boundary_radius=terrain_boundary_radius,
    clearing_edge_radius=clearing_edge_radius,
    distance_to_path=distance_to_path,
    paths=PATHS,
    tree_placements=tree_placements,
    tree_assets=TREE_ASSETS,
    qa_dir=QA_DIR,
)
near_frame_objects, near_frame_metrics = create_near_frame_layer(tree_placements)
setup_qa_render(near_frame_objects)

print("\nMoonlit Firefly Forest terrain, trees, ground ecology, and close frame authored")
print(f"Blend: {BLEND_PATH}")
for label, path in QA_PATHS.items():
    print(f"QA {label:8}: {path}")
