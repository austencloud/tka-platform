"""Scanned, habitat-driven ground ecosystem for the Moonlit Firefly Forest.

The static prop layout remains the placement authority. This owner conditions
the approved Poly Haven plant library, evaluates each authored habitat patch,
applies priority competition, and emits linked Blender objects that collapse to
EXT_mesh_gpu_instancing during optimization.
"""

from collections import Counter, defaultdict
import json
import math
import os
import random

import bpy
from mathutils import Vector


ECOSYSTEM_VERSION = 7
MEADOW_SYSTEM_VERSION = 10


GRASS_STRATA = {
    "worn": {
        "weight": 0.0,
        "height": (0.080, 0.180),
        "bladeCount": (36, 52),
        "radius": 0.32,
        "lean": (0.12, 0.30),
        "windResponse": 0.12,
    },
    "carpet": {
        "weight": 0.54,
        "height": (0.085, 0.20),
        "bladeCount": (38, 50),
        "radius": 0.31,
        "lean": (0.030, 0.11),
        "windResponse": 0.58,
    },
    "meadow": {
        "weight": 0.37,
        "height": (0.22, 0.43),
        "bladeCount": (24, 34),
        "radius": 0.29,
        "lean": (0.055, 0.18),
        "windResponse": 1.0,
    },
    "seed": {
        "weight": 0.09,
        "height": (0.36, 0.64),
        "bladeCount": (14, 22),
        "radius": 0.27,
        "lean": (0.07, 0.21),
        "windResponse": 1.22,
    },
}


SPECIES = {
    "summer-sward": {
        "family": "grass",
        "palette": "base",
        "spacing": 0.27,
        "attemptDensity": 8.8,
        "scale": (0.78, 1.18),
        "patchAffinity": {"base": 1.00, "lush": 0.78, "shade": 0.56},
        "clearance": 0.18,
    },
    "woodland-grass": {
        "family": "grass",
        "palette": "shade",
        "spacing": 0.42,
        "attemptDensity": 2.2,
        "scale": (0.70, 1.06),
        "patchAffinity": {"base": 0.58, "lush": 0.78, "shade": 1.00},
        "clearance": 0.26,
    },
    "summer-forb": {
        "family": "forb",
        "palette": "base",
        "spacing": 0.72,
        "attemptDensity": 0.045,
        "scale": (0.72, 1.20),
        "patchAffinity": {"base": 1.00, "lush": 0.86, "shade": 0.34},
        "clearance": 0.36,
    },
    "bracken-fern": {
        "family": "fern",
        "palette": "shade",
        "spacing": 1.10,
        "attemptDensity": 0.055,
        "scale": (0.72, 1.24),
        "patchAffinity": {"base": 0.38, "lush": 0.82, "shade": 1.00},
        "clearance": 0.62,
    },
    "nettle-colony": {
        "family": "forb",
        "palette": "lush",
        "spacing": 1.18,
        "attemptDensity": 0.012,
        "scale": (0.68, 1.08),
        "patchAffinity": {"base": 0.26, "lush": 1.00, "shade": 0.82},
        "clearance": 0.68,
    },
    "periwinkle-patch": {
        "family": "flower",
        "palette": "lush",
        "spacing": 1.08,
        "attemptDensity": 0.016,
        "scale": (0.70, 1.16),
        "patchAffinity": {"base": 0.52, "lush": 1.00, "shade": 0.78},
        "clearance": 0.62,
    },
    "forest-moss": {
        "family": "moss",
        "palette": "shade",
        "spacing": 0.48,
        "attemptDensity": 0.08,
        "scale": (0.82, 1.54),
        "patchAffinity": {"base": 0.18, "lush": 0.86, "shade": 1.00},
        "clearance": 0.22,
    },
    "summer-wildflower": {
        "family": "flower",
        "palette": "base",
        "spacing": 0.86,
        "attemptDensity": 0.018,
        "scale": (0.78, 1.18),
        "patchAffinity": {"base": 1.00, "lush": 0.78, "shade": 0.16},
        "clearance": 0.52,
    },
}


def _stable_seed(value):
    return sum((index + 1) * ord(character) for index, character in enumerate(value))


def _smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def _disable_emission(obj):
    for material in obj.data.materials:
        if material is None or not material.use_nodes:
            continue
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf is None:
            continue
        emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        strength = bsdf.inputs.get("Emission Strength")
        if emission is not None:
            for link in list(emission.links):
                material.node_tree.links.remove(link)
            emission.default_value = (0.0, 0.0, 0.0, 1.0)
        if strength is not None:
            strength.default_value = 0.0


def _link_to_collection(obj, collection):
    for source_collection in list(obj.users_collection):
        source_collection.objects.unlink(obj)
    collection.objects.link(obj)


def _configure_cutout_material(material, opacity_path):
    if material is None or not material.use_nodes:
        return
    material.surface_render_method = "DITHERED"
    material.use_transparency_overlap = False
    material.diffuse_color[3] = 1.0
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        return
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.88
    alpha_input = bsdf.inputs.get("Alpha")
    if alpha_input is None or not os.path.isfile(opacity_path):
        return
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for link in list(alpha_input.links):
        links.remove(link)
    opacity = nodes.get("Forest Ecosystem Opacity") or nodes.new("ShaderNodeTexImage")
    opacity.name = "Forest Ecosystem Opacity"
    opacity.label = "Authored Poly Haven opacity"
    opacity.image = bpy.data.images.load(opacity_path, check_existing=True)
    opacity.image.colorspace_settings.name = "Non-Color"
    links.new(opacity.outputs["Color"], alpha_input)


def _mesh_bounds(obj):
    minimum = Vector(tuple(min(vertex.co[index] for vertex in obj.data.vertices) for index in range(3)))
    maximum = Vector(tuple(max(vertex.co[index] for vertex in obj.data.vertices) for index in range(3)))
    return minimum, maximum


def _normalize_prototype(obj, target_height):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    minimum, maximum = _mesh_bounds(obj)
    height = maximum.z - minimum.z
    if height <= 0.001:
        raise RuntimeError(f"Forest ecosystem source {obj.name} has invalid height")
    scale = float(target_height) / height
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    for vertex in obj.data.vertices:
        vertex.co.x = (vertex.co.x - center_x) * scale
        vertex.co.y = (vertex.co.y - center_y) * scale
        vertex.co.z = (vertex.co.z - minimum.z) * scale
    obj.data.update()


def _build_sward_tufts(source_prototypes, prototype_collection):
    """Assemble scanned sprigs into reusable field-scale turf modules."""
    rng = random.Random(18471)
    tuft_prototypes = []
    viable = [
        source
        for source in source_prototypes
        if not any(
            token in str(source.get("tka_source_variant", "")).lower()
            for token in ("dead", "flattened", "single")
        )
    ]
    if not viable:
        viable = source_prototypes
    for tuft_index in range(9):
        parts = []
        # A Poly Haven "sprig" is already a photographed cluster. Packing ten
        # or more into one prototype produced opaque shrub-like islands once
        # thousands of instances overlapped at middle distance. Four to six
        # clusters preserve blade diversity without turning the sward into a
        # dark hedge.
        blade_count = rng.randint(4, 6)
        for blade_index in range(blade_count):
            source = rng.choice(viable)
            part = source.copy()
            part.data = source.data.copy()
            part.hide_render = False
            part.hide_viewport = False
            radius = math.sqrt(rng.random()) * rng.uniform(0.11, 0.25)
            angle = rng.uniform(0.0, math.tau)
            part.location = (
                math.cos(angle) * radius,
                math.sin(angle) * radius,
                0.0,
            )
            part.rotation_euler.z = rng.uniform(0.0, math.tau)
            blade_scale = rng.uniform(0.62, 1.04)
            part.scale = (
                blade_scale * rng.uniform(0.82, 1.18),
                blade_scale * rng.uniform(0.82, 1.18),
                blade_scale,
            )
            prototype_collection.objects.link(part)
            bpy.ops.object.select_all(action="DESELECT")
            part.select_set(True)
            bpy.context.view_layer.objects.active = part
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            part.select_set(False)
            parts.append(part)
        bpy.ops.object.select_all(action="DESELECT")
        for part in parts:
            part.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        tuft = parts[0]
        tuft.name = f"ForestEcosystemPrototype_summer-sward_tuft_{tuft_index + 1:02d}"
        tuft.data.name = f"ForestEcosystemMesh_summer-sward_tuft_{tuft_index + 1:02d}"
        tuft.hide_render = True
        tuft.hide_viewport = True
        tuft_prototypes.append(tuft)
    for source in source_prototypes:
        if source.name in bpy.data.objects:
            bpy.data.objects.remove(source, do_unlink=True)
    return tuft_prototypes


def _import_species(project_root, manifest, prototype_collection):
    prototypes = {}
    source_metrics = {}
    for candidate in manifest["candidates"]:
        species_id = candidate["id"]
        source = candidate["source"]
        source_path = os.path.join(project_root, source["localPath"])
        if not os.path.isfile(source_path):
            raise RuntimeError(f"Missing Forest ecosystem source: {source_path}")
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=source_path)
        created = [obj for obj in bpy.data.objects if obj not in before]
        meshes = [obj for obj in created if obj.type == "MESH"]
        if not meshes:
            raise RuntimeError(f"Forest ecosystem source imported no mesh: {species_id}")
        opacity_path = os.path.join(
            os.path.dirname(source_path), "textures", source["opacityMap"]
        )
        normalized = []
        triangles = 0
        for index, obj in enumerate(meshes):
            source_variant = obj.name
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world
            _disable_emission(obj)
            for material in obj.data.materials:
                _configure_cutout_material(material, opacity_path)
            _normalize_prototype(obj, candidate["targetHeightMetres"])
            obj.name = f"ForestEcosystemPrototype_{species_id}_{index + 1:02d}"
            obj.data.name = f"ForestEcosystemMesh_{species_id}_{index + 1:02d}"
            obj["tka_source_variant"] = source_variant
            obj.hide_render = True
            obj.hide_viewport = True
            _link_to_collection(obj, prototype_collection)
            obj.data.calc_loop_triangles()
            triangles += len(obj.data.loop_triangles)
            normalized.append(obj)
        for obj in created:
            if obj not in normalized and obj.name in bpy.data.objects:
                bpy.data.objects.remove(obj, do_unlink=True)
        if species_id == "summer-sward":
            normalized = _build_sward_tufts(normalized, prototype_collection)
        prototypes[species_id] = normalized
        triangles = 0
        for prototype in normalized:
            prototype.data.calc_loop_triangles()
            triangles += len(prototype.data.loop_triangles)
        source_metrics[species_id] = {
            "source": source["provenance"],
            "license": source["license"],
            "variants": len(normalized),
            "triangles": triangles,
            "targetHeightMetres": float(candidate["targetHeightMetres"]),
        }
    return prototypes, source_metrics


def _sample_colony_centers(rng, base_count, radius_x, radius_y, species_id):
    divisor = 44.0 if SPECIES[species_id]["family"] == "grass" else 72.0
    center_count = max(2, min(11, round(base_count / divisor)))
    centers = []
    for _index in range(center_count):
        angle = rng.uniform(0.0, math.tau)
        normalized_radius = math.sqrt(rng.random()) * 0.78
        spread = rng.uniform(0.11, 0.24)
        centers.append(
            (
                math.cos(angle) * radius_x * normalized_radius,
                math.sin(angle) * radius_y * normalized_radius,
                spread * radius_x,
                spread * radius_y,
            )
        )
    return centers


def _sample_patch_point(rng, centers, radius_x, radius_y, species_id):
    colony_weight = (
        0.62
        if species_id == "summer-sward"
        else 0.78
        if species_id == "woodland-grass"
        else 0.88
    )
    if rng.random() < colony_weight:
        center_x, center_y, spread_x, spread_y = rng.choice(centers)
        local_x = center_x + rng.gauss(0.0, spread_x)
        local_y = center_y + rng.gauss(0.0, spread_y)
    else:
        angle = rng.uniform(0.0, math.tau)
        radius = math.sqrt(rng.random())
        local_x = math.cos(angle) * radius_x * radius
        local_y = math.sin(angle) * radius_y * radius
    normalized = math.sqrt((local_x / radius_x) ** 2 + (local_y / radius_y) ** 2)
    return local_x, local_y, normalized


def _habitat_suitability(x, y, normalized_radius, patch, species_id):
    species = SPECIES[species_id]
    palette = patch["palette"]
    affinity = species["patchAffinity"][palette]
    edge = 1.0 - _smoothstep(0.73, 1.0, normalized_radius)
    micro = (
        0.56
        + 0.20 * math.sin(x * 0.37 + y * 0.19 + _stable_seed(species_id) * 0.013)
        + 0.14 * math.cos(x * 0.11 - y * 0.29)
        + 0.10 * math.sin((x + y) * 0.71)
    )
    moisture = 0.5 + 0.5 * math.sin(x * 0.028 - y * 0.047 + 1.7)
    if species_id in {"forest-moss", "bracken-fern", "periwinkle-patch"}:
        micro *= 0.60 + moisture * 0.72
    elif species_id == "summer-sward":
        micro *= 1.18 - moisture * 0.32
    return max(0.0, min(1.0, affinity * edge * micro))


def _distance_band_weight(x, y, species_id):
    distance = math.hypot(x, y)
    family = SPECIES[species_id]["family"]
    if family == "grass":
        return 1.0 - _smoothstep(72.0, 98.0, distance)
    if family in {"fern", "forb"}:
        return 1.0 - _smoothstep(48.0, 78.0, distance)
    return 1.0 - _smoothstep(36.0, 62.0, distance)


def _protected(x, y, minimum_core_radius, path_margin, distance_to_path, paths, mushroom_positions):
    if math.hypot(x, y) < minimum_core_radius:
        return True
    if any(
        distance_to_path(x, y, path) < float(path["halfWidth"]) + path_margin
        for path in paths
    ):
        return True
    if any(math.hypot(x - mx, y - my) < 0.78 for mx, my in mushroom_positions):
        return True
    return False


def _competes(x, y, clearance, occupied):
    cell_size = 1.3
    cell_x = math.floor(x / cell_size)
    cell_y = math.floor(y / cell_size)
    for near_x in range(cell_x - 2, cell_x + 3):
        for near_y in range(cell_y - 2, cell_y + 3):
            for other_x, other_y, other_clearance in occupied.get((near_x, near_y), ()):
                required = max(clearance, other_clearance)
                if (x - other_x) ** 2 + (y - other_y) ** 2 < required**2:
                    return True
    occupied[(cell_x, cell_y)].append((x, y, clearance))
    return False


def _quality_tier(species_id):
    family = SPECIES[species_id]["family"]
    if species_id in {"nettle-colony", "periwinkle-patch", "summer-wildflower"}:
        return "High"
    if family in {"fern", "forb", "moss"}:
        return "Medium"
    return "Base"


def _inside_rotated_ellipse(x, y, center, radii, rotation_degrees, margin=0.0):
    center_x, center_y = map(float, center)
    radius_x, radius_y = map(float, radii)
    radius_x += margin
    radius_y += margin
    rotation = math.radians(float(rotation_degrees))
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    delta_x = x - center_x
    delta_y = y - center_y
    local_x = delta_x * cosine + delta_y * sine
    local_y = -delta_x * sine + delta_y * cosine
    return (local_x / radius_x) ** 2 + (local_y / radius_y) ** 2 <= 1.0


def _rotated_ellipse_normalized_distance(x, y, center, radii, rotation_degrees):
    center_x, center_y = map(float, center)
    radius_x, radius_y = map(float, radii)
    rotation = math.radians(float(rotation_degrees))
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    delta_x = x - center_x
    delta_y = y - center_y
    local_x = delta_x * cosine + delta_y * sine
    local_y = -delta_x * sine + delta_y * cosine
    return math.sqrt((local_x / radius_x) ** 2 + (local_y / radius_y) ** 2)


def _path_distance_and_tangent(x, y, path):
    """Return distance, direction, side, and distance travelled along a path."""
    nearest_distance = math.inf
    nearest_tangent = 0.0
    nearest_signed_distance = 0.0
    nearest_progress = 0.0
    accumulated_length = 0.0
    points = path["points"]
    for index in range(len(points) - 1):
        first = points[index]
        second = points[index + 1]
        segment_x = float(second[0]) - float(first[0])
        segment_y = float(second[1]) - float(first[1])
        length_squared = segment_x * segment_x + segment_y * segment_y
        if length_squared <= 1e-8:
            continue
        amount = max(
            0.0,
            min(
                1.0,
                (
                    (x - float(first[0])) * segment_x
                    + (y - float(first[1])) * segment_y
                )
                / length_squared,
            ),
        )
        closest_x = float(first[0]) + segment_x * amount
        closest_y = float(first[1]) + segment_y * amount
        distance = math.hypot(x - closest_x, y - closest_y)
        segment_length = math.sqrt(length_squared)
        if distance < nearest_distance:
            nearest_distance = distance
            nearest_tangent = math.atan2(segment_y, segment_x)
            nearest_signed_distance = (
                (x - closest_x) * -segment_y
                + (y - closest_y) * segment_x
            ) / segment_length
            nearest_progress = accumulated_length + amount * segment_length
        accumulated_length += segment_length
    return (
        nearest_distance,
        nearest_tangent,
        nearest_signed_distance,
        nearest_progress,
    )


def _choose_grass_stratum(rng, palette, traffic_factor, habitat_signal):
    if traffic_factor < 0.48:
        return "worn"
    if traffic_factor < 0.72:
        return "carpet"
    seed_weight = GRASS_STRATA["seed"]["weight"]
    meadow_weight = GRASS_STRATA["meadow"]["weight"]
    if palette == "shade":
        seed_weight *= 0.38
        meadow_weight *= 1.08
    elif palette == "lush":
        seed_weight *= 1.22
        meadow_weight *= 1.12
    seed_weight *= 0.68 + habitat_signal * 0.62
    meadow_weight *= 0.78 + habitat_signal * 0.42
    choice = rng.random()
    if choice < seed_weight:
        return "seed"
    if choice < seed_weight + meadow_weight:
        return "meadow"
    return "carpet"


def _continuous_turf_positions(
    layout,
    terrain_boundary_radius,
    clearing_edge_radius,
    distance_to_path,
    paths,
    mushroom_positions,
):
    """Cover the Forest with one continuous summer sward.

    Habitat patches still determine color, blade height, and botanical accents.
    They no longer determine whether grass exists. Only authored circulation,
    durable camp surfaces, the stage contact, mushrooms, and the very edge of
    the world interrupt the turf.
    """
    rules = layout["rules"]
    contract = layout["groundEcosystem"]
    patches = layout["grassPatches"]
    camp = contract["turfFloor"]["camp"]
    stage_radius = float(contract["turfFloor"]["stageContactRadiusMetres"])
    outer_fade = float(contract["turfFloor"]["outerBoundaryFadeMetres"])
    near_spacing = float(contract["turfFloor"]["nearSpacingMetres"])
    middle_spacing = float(contract["turfFloor"]["middleSpacingMetres"])
    far_spacing = float(contract["turfFloor"]["farSpacingMetres"])
    maximum_radius = float(contract["turfFloor"]["maximumRadiusMetres"])

    positions = []
    coverage_samples = 0
    protected_samples = 0
    path_samples = 0
    path_core_candidates = 0
    retained_path_core_samples = 0
    path_core_side_candidates = Counter()
    retained_path_core_side_samples = Counter()
    stage_samples = 0
    camp_samples = 0
    world_edge_samples = 0
    patch_counts = Counter()
    tier_counts = Counter()
    tier_patch_counts = defaultdict(Counter)

    y = -maximum_radius
    row = 0
    while y <= maximum_radius:
        x = -maximum_radius + (row % 2) * near_spacing * 0.5
        while x <= maximum_radius:
            distance = math.hypot(x, y)
            spacing = (
                near_spacing
                if distance <= 34.0
                else middle_spacing
                if distance <= 72.0
                else far_spacing
            )
            cell_seed = _stable_seed(
                f"turf:{round(x / spacing)}:{round(y / spacing)}:{MEADOW_SYSTEM_VERSION}"
            )
            rng = random.Random(cell_seed)
            sample_x = x + rng.uniform(-spacing * 0.34, spacing * 0.34)
            sample_y = y + rng.uniform(-spacing * 0.34, spacing * 0.34)
            sample_distance = math.hypot(sample_x, sample_y)
            angle = math.atan2(sample_y, sample_x)
            boundary = min(
                float(terrain_boundary_radius(angle)),
                maximum_radius + 12.0,
            )
            if sample_distance > boundary - outer_fade:
                world_edge_samples += 1
                x += spacing
                continue
            traffic_factor = 1.0
            if sample_distance < stage_radius - 0.42:
                stage_samples += 1
                x += spacing
                continue
            if sample_distance < stage_radius + 0.72:
                traffic_factor = min(
                    traffic_factor,
                    _smoothstep(stage_radius - 0.42, stage_radius + 0.72, sample_distance),
                )
            path_tangent = None
            inside_path_core = False
            path_side = "center"
            for path in paths:
                (
                    _distance_from_authored_path,
                    tangent,
                    signed_distance,
                    path_progress,
                ) = _path_distance_and_tangent(
                    sample_x, sample_y, path
                )
                margin = (
                    float(rules["minimumGrassPathCoreMarginMetres"])
                    if path["role"] == "forest-exit"
                    else 0.18
                )
                half_width = float(path["halfWidth"])
                path_seed = _stable_seed(path["id"]) * 0.0031
                center_drift = (
                    math.sin(path_progress * 0.105 + path_seed) * 0.16
                    + math.sin(path_progress * 0.037 - path_seed * 0.43) * 0.08
                )
                lived_lateral = signed_distance - center_drift
                distance_from_path = abs(lived_lateral)
                candidate_side = "left" if lived_lateral < 0.0 else "right"
                edge_noise = 0.5 + 0.5 * math.sin(
                    path_progress * 0.39
                    + (1.47 if candidate_side == "right" else 0.0)
                    + math.sin(path_progress * 0.093 + path_seed) * 1.7
                )
                side_asymmetry = (
                    0.92 + edge_noise * 0.14
                    if candidate_side == "left"
                    else 0.86 + edge_noise * 0.22
                )
                worn_core = max(
                    0.24,
                    half_width * (0.44 + edge_noise * 0.17) * side_asymmetry,
                )
                feather_edge = (
                    half_width
                    + margin
                    + 0.46
                    + edge_noise * 0.34
                    + (0.12 if candidate_side == "left" else -0.05)
                )
                path_traffic = max(
                    0.07 + edge_noise * 0.05,
                    _smoothstep(worn_core, feather_edge, distance_from_path),
                )
                if path_traffic < traffic_factor:
                    traffic_factor = path_traffic
                    path_tangent = tangent
                    inside_path_core = distance_from_path < worn_core
                    path_side = candidate_side
            camp_distance = _rotated_ellipse_normalized_distance(
                sample_x, sample_y, camp["center"], camp["radii"], camp["rotationDegrees"]
            )
            if camp_distance < 0.66:
                camp_samples += 1
                x += spacing
                continue
            if camp_distance < 1.12:
                traffic_factor = min(
                    traffic_factor,
                    _smoothstep(0.66, 1.12, camp_distance),
                )
            if any(
                math.hypot(sample_x - mushroom_x, sample_y - mushroom_y) < 0.54
                for mushroom_x, mushroom_y in mushroom_positions
            ):
                protected_samples += 1
                x += spacing
                continue
            if inside_path_core:
                path_core_candidates += 1
                path_core_side_candidates[path_side] += 1
            if traffic_factor < 0.94:
                # A used trail is compressed living grass with exposed soil
                # between tufts. Deleting its centre made it look chemically
                # erased instead of walked through.
                survival_noise = 0.5 + 0.5 * math.sin(
                    sample_x * 0.71
                    - sample_y * 0.53
                    + math.sin(sample_x * 0.19 + sample_y * 0.23) * 1.9
                )
                retention = min(
                    0.84,
                    0.56 + traffic_factor * 0.34 + survival_noise * 0.12,
                )
                if rng.random() > retention:
                    protected_samples += 1
                    x += spacing
                    continue

            weighted_patches = []
            for patch in patches:
                center_x, center_y = map(float, patch["center"])
                radius_x, radius_y = map(float, patch["radii"])
                patch_rotation = math.radians(float(patch["rotationDegrees"]))
                cosine = math.cos(patch_rotation)
                sine = math.sin(patch_rotation)
                delta_x = sample_x - center_x
                delta_y = sample_y - center_y
                local_x = delta_x * cosine + delta_y * sine
                local_y = -delta_x * sine + delta_y * cosine
                normalized = math.sqrt(
                    (local_x / radius_x) ** 2 + (local_y / radius_y) ** 2
                )
                weight = 1.0 - _smoothstep(0.45, 1.35, normalized)
                if weight > 0.0:
                    weighted_patches.append((weight, patch))
            if weighted_patches:
                weighted_total = sum(weight ** 1.45 for weight, _patch in weighted_patches)
                selection = rng.random() * weighted_total
                patch = weighted_patches[-1][1]
                for weight, candidate in weighted_patches:
                    selection -= weight ** 1.45
                    if selection <= 0.0:
                        patch = candidate
                        break
            else:
                patch = min(
                    patches,
                    key=lambda item: math.hypot(
                        sample_x - float(item["center"][0]),
                        sample_y - float(item["center"][1]),
                    ),
                )

            palette = patch["palette"]
            patch_weight = max((weight for weight, _patch in weighted_patches), default=0.18)
            habitat_signal = max(
                0.0,
                min(
                    1.0,
                    0.52
                    + patch_weight * 0.38
                    + 0.12 * math.sin(sample_x * 0.21 - sample_y * 0.17),
                ),
            )
            species_id = "woodland-grass" if palette == "shade" and rng.random() < 0.38 else "summer-sward"
            tier = _quality_tier(species_id)
            stratum = _choose_grass_stratum(
                rng, palette, traffic_factor, habitat_signal
            )
            scale = rng.uniform(0.78, 1.22)
            if stratum == "worn":
                scale *= 0.88 + traffic_factor * 0.18
            else:
                scale *= 0.34 + 0.66 * max(0.12, traffic_factor)
            if stratum == "meadow":
                scale *= 0.96 + habitat_signal * 0.22
            elif stratum == "seed":
                scale *= 1.02 + habitat_signal * 0.28
            if sample_distance > 72.0:
                scale *= 0.72
            scale_y = scale * rng.uniform(0.80, 1.18)
            yaw = (
                path_tangent + rng.uniform(-0.22, 0.22)
                if stratum == "worn" and path_tangent is not None
                else rng.uniform(0.0, math.tau)
            )
            positions.append(
                (
                    sample_x,
                    sample_y,
                    yaw,
                    scale,
                    scale_y,
                    patch["id"],
                    species_id,
                    stratum,
                    traffic_factor,
                )
            )
            if inside_path_core:
                retained_path_core_samples += 1
                retained_path_core_side_samples[path_side] += 1
            coverage_samples += 1
            patch_counts[patch["id"]] += 1
            tier_counts[tier] += 1
            tier_patch_counts[tier][patch["id"]] += 1
            x += spacing
        row += 1
        y += near_spacing

    return positions, {
        "coverageSamples": coverage_samples,
        "protectedSamples": protected_samples,
        "pathSamples": path_samples,
        "pathCoreCandidates": path_core_candidates,
        "retainedPathCoreSamples": retained_path_core_samples,
        "pathCoreSideCandidates": dict(path_core_side_candidates),
        "retainedPathCoreSideSamples": dict(retained_path_core_side_samples),
        "pathCoreRetention": (
            retained_path_core_samples / path_core_candidates
            if path_core_candidates
            else 0.0
        ),
        "stageSamples": stage_samples,
        "campSamples": camp_samples,
        "worldEdgeSamples": world_edge_samples,
        "patchCounts": dict(patch_counts),
        "tierCounts": dict(tier_counts),
        "tierPatchCounts": {
            tier: dict(counts) for tier, counts in tier_patch_counts.items()
        },
        "stratumCounts": dict(Counter(position[7] for position in positions)),
        "compressedTrafficSamples": sum(1 for position in positions if position[8] < 0.94),
        "spacingMetres": {
            "near": near_spacing,
            "middle": middle_spacing,
            "far": far_spacing,
        },
    }


def _grass_blade_palette(rng, palette):
    """Return restrained summer-green variation for authored turf blades."""
    colors = {
        "base": ((0.055, 0.30, 0.042, 1.0), (0.12, 0.48, 0.075, 1.0)),
        "lush": ((0.045, 0.28, 0.040, 1.0), (0.10, 0.44, 0.065, 1.0)),
        "shade": ((0.040, 0.21, 0.038, 1.0), (0.085, 0.36, 0.060, 1.0)),
    }
    low, high = colors[palette]
    amount = rng.random()
    return tuple(low[index] + (high[index] - low[index]) * amount for index in range(4))


def _living_grass_material(palette, stratum, variant_index):
    tone_index = variant_index % 4
    name = (
        f"Forest Ecosystem Living Grass {palette.title()} "
        f"{stratum.title()} Tone {tone_index + 1:02d}"
    )
    material = bpy.data.materials.get(name)
    if material is not None:
        return material
    colors = {
        "base": {
            "worn": (0.125, 0.29, 0.070, 1.0),
            "carpet": (0.115, 0.40, 0.075, 1.0),
            "meadow": (0.095, 0.35, 0.058, 1.0),
            "seed": (0.125, 0.34, 0.070, 1.0),
        },
        "lush": {
            "worn": (0.105, 0.27, 0.060, 1.0),
            "carpet": (0.090, 0.39, 0.060, 1.0),
            "meadow": (0.070, 0.34, 0.050, 1.0),
            "seed": (0.105, 0.33, 0.060, 1.0),
        },
        "shade": {
            "worn": (0.085, 0.22, 0.052, 1.0),
            "carpet": (0.075, 0.30, 0.055, 1.0),
            "meadow": (0.060, 0.27, 0.045, 1.0),
            "seed": (0.090, 0.29, 0.055, 1.0),
        },
    }
    base_color = colors[palette][stratum]
    tone_offsets = (
        (-0.006, -0.022, 0.004),
        (0.008, 0.012, -0.003),
        (-0.002, 0.028, 0.002),
        (0.010, -0.006, -0.004),
    )
    offset = tone_offsets[tone_index]
    color = tuple(
        max(0.0, min(1.0, base_color[index] + offset[index]))
        for index in range(3)
    ) + (1.0,)
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.98
    specular = bsdf.inputs.get("Specular IOR Level") or bsdf.inputs.get("Specular")
    if specular is not None:
        specular.default_value = 0.08
    coat = bsdf.inputs.get("Coat Weight") or bsdf.inputs.get("Clearcoat")
    if coat is not None:
        coat.default_value = 0.0
    return material


def _build_grass_tuft_mesh(name, species_id, palette, stratum, variant_index):
    """Build one reusable grass stratum for GPU instancing."""
    vertices = []
    faces = []
    vertex_uvs = []
    rng = random.Random(
        _stable_seed(f"{species_id}:{palette}:{stratum}:{variant_index}")
        + ECOSYSTEM_VERSION * 983
    )
    woodland = species_id == "woodland-grass"
    stratum_contract = GRASS_STRATA[stratum]
    blade_minimum, blade_maximum = stratum_contract["bladeCount"]
    blade_count = rng.randint(blade_minimum, blade_maximum)
    if woodland:
        blade_count = max(16, round(blade_count * 0.86))
    clump_radius = float(stratum_contract["radius"]) * (1.04 if woodland else 1.0)
    for blade_index in range(blade_count):
        offset_angle = rng.uniform(0.0, math.tau)
        offset_radius = math.sqrt(rng.random()) * clump_radius
        root_x = math.cos(offset_angle) * offset_radius
        root_y = math.sin(offset_angle) * offset_radius
        blade_yaw = rng.uniform(-math.pi, math.pi)
        right_x = math.cos(blade_yaw)
        right_y = math.sin(blade_yaw)
        lean_angle = (
            rng.uniform(-0.28, 0.28)
            if stratum == "worn"
            else blade_yaw + rng.uniform(-0.72, 0.72)
        )
        lean_x = math.cos(lean_angle)
        lean_y = math.sin(lean_angle)
        width = rng.uniform(0.006, 0.017 if woodland else 0.014)
        height_minimum, height_maximum = stratum_contract["height"]
        height = rng.uniform(height_minimum, height_maximum)
        if woodland:
            height *= rng.uniform(1.02, 1.14)
        lean_minimum, lean_maximum = stratum_contract["lean"]
        tip_lean = rng.uniform(lean_minimum, lean_maximum)
        mid_lean = tip_lean * rng.uniform(0.28, 0.54)
        start = len(vertices)
        vertices.extend(
            (
                (root_x - right_x * width, root_y - right_y * width, 0.0),
                (root_x + right_x * width, root_y + right_y * width, 0.0),
                (root_x - right_x * width * 0.70 + lean_x * mid_lean, root_y - right_y * width * 0.70 + lean_y * mid_lean, height * 0.56),
                (root_x + right_x * width * 0.70 + lean_x * mid_lean, root_y + right_y * width * 0.70 + lean_y * mid_lean, height * 0.56),
                (root_x - right_x * width * 0.08 + lean_x * tip_lean, root_y - right_y * width * 0.08 + lean_y * tip_lean, height),
                (root_x + right_x * width * 0.08 + lean_x * tip_lean, root_y + right_y * width * 0.08 + lean_y * tip_lean, height),
            )
        )
        vertex_uvs.extend(
            (
                (0.0, 0.0),
                (1.0, 0.0),
                (0.12, 0.56),
                (0.88, 0.56),
                (0.46, 1.0),
                (0.54, 1.0),
            )
        )
        faces.extend(
            (
                (start, start + 1, start + 3, start + 2),
                (start + 2, start + 3, start + 5, start + 4),
            )
        )

        if stratum == "seed" and blade_index < max(2, blade_count // 7):
            seed_start = len(vertices)
            seed_height = height * rng.uniform(1.05, 1.22)
            seed_width = width * rng.uniform(1.8, 2.6)
            seed_length = rng.uniform(0.045, 0.075)
            seed_x = root_x + lean_x * tip_lean
            seed_y = root_y + lean_y * tip_lean
            vertices.extend(
                (
                    (seed_x - right_x * seed_width, seed_y - right_y * seed_width, seed_height - seed_length),
                    (seed_x + right_x * seed_width, seed_y + right_y * seed_width, seed_height - seed_length),
                    (seed_x - right_x * seed_width * 0.18, seed_y - right_y * seed_width * 0.18, seed_height),
                    (seed_x + right_x * seed_width * 0.18, seed_y + right_y * seed_width * 0.18, seed_height),
                )
            )
            vertex_uvs.extend(((0.0, 0.76), (1.0, 0.76), (0.42, 1.0), (0.58, 1.0)))
            faces.append((seed_start, seed_start + 1, seed_start + 3, seed_start + 2))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="Forest Rooted Wind Weight")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = vertex_uvs[vertex_index]
    mesh.materials.append(_living_grass_material(palette, stratum, variant_index))
    return mesh


def create_forest_ground_ecosystem(
    project_root,
    layout,
    layout_sha256,
    terrain_height,
    terrain_boundary_radius,
    clearing_edge_radius,
    distance_to_path,
    paths,
    mushroom_positions,
):
    contract = layout["groundEcosystem"]
    manifest_path = os.path.join(project_root, contract["sourceManifest"])
    with open(manifest_path, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    prototype_collection = bpy.data.collections.new("Forest Ground Ecosystem Prototypes")
    bpy.context.scene.collection.children.link(prototype_collection)
    prototypes, source_metrics = _import_species(project_root, manifest, prototype_collection)

    rules = layout["rules"]
    minimum_core_radius = float(rules["minimumGrassCoreRadiusMetres"])
    path_margin = float(rules["minimumGrassPathCoreMarginMetres"])
    occupied = defaultdict(list)
    patch_counts = {patch["id"]: 0 for patch in layout["grassPatches"]}
    species_counts = Counter()
    family_counts = Counter()
    tier_counts = Counter()
    tier_patch_counts = defaultdict(Counter)
    positions_by_species_variant = defaultdict(list)

    patches = {patch["id"]: patch for patch in layout["grassPatches"]}
    for species_id in contract["speciesPriority"]:
        species = SPECIES[species_id]
        if species["family"] == "grass":
            continue
        for patch_id, guild in contract["patchGuilds"].items():
            if species_id not in guild:
                continue
            patch = patches[patch_id]
            center_x, center_y = map(float, patch["center"])
            radius_x, radius_y = map(float, patch["radii"])
            rotation = math.radians(float(patch["rotationDegrees"]))
            cosine = math.cos(rotation)
            sine = math.sin(rotation)
            patch_area = math.pi * radius_x * radius_y
            rng = random.Random(
                int(layout["version"]) * 100003
                + _stable_seed(f"{patch_id}:{species_id}:ecosystem")
            )
            attempts = max(2, round(patch_area * species["attemptDensity"]))
            centers = _sample_colony_centers(
                rng,
                max(int(patch["count"]), attempts),
                radius_x,
                radius_y,
                species_id,
            )
            for _attempt in range(attempts):
                local_x, local_y, normalized = _sample_patch_point(
                    rng, centers, radius_x, radius_y, species_id
                )
                if normalized >= 1.0:
                    continue
                x = center_x + local_x * cosine - local_y * sine
                y = center_y + local_x * sine + local_y * cosine
                suitability = _habitat_suitability(x, y, normalized, patch, species_id)
                suitability *= _distance_band_weight(x, y, species_id)
                if rng.random() > suitability:
                    continue
                if _protected(
                    x,
                    y,
                    minimum_core_radius,
                    path_margin,
                    distance_to_path,
                    paths,
                    mushroom_positions,
                ):
                    continue
                if _competes(x, y, float(species["clearance"]), occupied):
                    continue
                variant_index = rng.randrange(len(prototypes[species_id]))
                scale = rng.uniform(*species["scale"])
                scale_y = scale * rng.uniform(0.88, 1.12)
                positions_by_species_variant[(species_id, variant_index)].append(
                    (x, y, rng.uniform(0.0, math.tau), scale, scale_y, patch_id)
                )
                patch_counts[patch_id] += 1
                species_counts[species_id] += 1
                family_counts[species["family"]] += 1
                tier = _quality_tier(species_id)
                tier_counts[tier] += 1
                tier_patch_counts[tier][patch_id] += 1

    turf_positions, turf_metrics = _continuous_turf_positions(
        layout,
        terrain_boundary_radius,
        clearing_edge_radius,
        distance_to_path,
        paths,
        mushroom_positions,
    )
    grass_positions_by_species_stratum = {
        (species_id, stratum): [
            position
            for position in turf_positions
            if position[6] == species_id and position[7] == stratum
        ]
        for species_id in ("summer-sward", "woodland-grass")
        for stratum in GRASS_STRATA
    }
    for (species_id, _stratum), positions in grass_positions_by_species_stratum.items():
        tier = _quality_tier(species_id)
        species_counts[species_id] += len(positions)
        family_counts["grass"] += len(positions)
        tier_counts[tier] += len(positions)
        for position in positions:
            patch_id = position[5]
            patch_counts[patch_id] += 1
            tier_patch_counts[tier][patch_id] += 1

    created = []
    for (species_id, stratum), positions in grass_positions_by_species_stratum.items():
        if not positions:
            continue
        tier = _quality_tier(species_id)
        positions_by_palette_variant = defaultdict(list)
        variant_count = 7 if species_id == "summer-sward" else 5
        for position in positions:
            palette = patches[position[5]]["palette"]
            variant_index = _stable_seed(
                f"{round(position[0] * 7)}:{round(position[1] * 7)}:{species_id}:{stratum}"
            ) % variant_count
            positions_by_palette_variant[(palette, variant_index)].append(position)
        for (palette, variant_index), variant_positions in positions_by_palette_variant.items():
            mesh = _build_grass_tuft_mesh(
                f"ForestEcosystemMesh_{species_id}_{stratum}_{palette}-tuft-{variant_index + 1:02d}",
                species_id,
                palette,
                stratum,
                variant_index,
            )
            for index, position in enumerate(variant_positions):
                x, y, yaw, scale, scale_y, patch_id = position[:6]
                obj = bpy.data.objects.new(
                    f"Forest_Ecosystem_{tier}_{species_id}_{stratum}_{palette}_{variant_index + 1:02d}_{index + 1:05d}",
                    mesh,
                )
                bpy.context.scene.collection.objects.link(obj)
                obj.location = (x, y, terrain_height(x, y) + 0.012)
                obj.rotation_euler.z = yaw
                obj.scale = (scale, scale_y, scale)
                obj["tka_role"] = "near-frame-ground-ecosystem"
                obj["tka_export_layer"] = "near-frame"
                obj["tka_static_prop_layout_version"] = int(layout["version"])
                obj["tka_static_prop_layout_sha256"] = layout_sha256
                obj["tka_meadow_system_version"] = MEADOW_SYSTEM_VERSION
                obj["tka_ground_ecosystem_version"] = ECOSYSTEM_VERSION
                obj["tka_ground_species"] = species_id
                obj["tka_ground_family"] = "grass"
                obj["tka_ground_stratum"] = stratum
                obj["tka_wind_response"] = float(GRASS_STRATA[stratum]["windResponse"])
                obj["tka_ground_patch_id"] = patch_id
                obj["tka_grass_quality_tier"] = tier.lower()
                obj["tka_grass_clumps"] = 1
                created.append(obj)

    for (species_id, variant_index), positions in positions_by_species_variant.items():
        prototype = prototypes[species_id][variant_index]
        tier = _quality_tier(species_id)
        for index, (x, y, yaw, scale, scale_y, patch_id) in enumerate(positions):
            obj = bpy.data.objects.new(
                f"Forest_Ecosystem_{tier}_{species_id}_{variant_index + 1:02d}_{index + 1:04d}",
                prototype.data,
            )
            bpy.context.scene.collection.objects.link(obj)
            obj.location = (x, y, terrain_height(x, y) + 0.012)
            obj.rotation_euler.z = yaw
            obj.scale = (scale, scale_y, scale)
            obj["tka_role"] = "near-frame-ground-ecosystem"
            obj["tka_export_layer"] = "near-frame"
            obj["tka_static_prop_layout_version"] = int(layout["version"])
            obj["tka_static_prop_layout_sha256"] = layout_sha256
            obj["tka_meadow_system_version"] = MEADOW_SYSTEM_VERSION
            obj["tka_ground_ecosystem_version"] = ECOSYSTEM_VERSION
            obj["tka_ground_species"] = species_id
            obj["tka_ground_family"] = SPECIES[species_id]["family"]
            obj["tka_ground_patch_id"] = patch_id
            obj["tka_grass_quality_tier"] = tier.lower()
            obj["tka_grass_clumps"] = 1
            created.append(obj)

    metrics = {
        "version": ECOSYSTEM_VERSION,
        "meadowSystemVersion": MEADOW_SYSTEM_VERSION,
        "sourceManifest": os.path.relpath(manifest_path, project_root).replace("\\", "/"),
        "sourceMetrics": source_metrics,
        "instanceCount": sum(species_counts.values()),
        "runtimeObjectCount": len(created),
        "speciesCounts": dict(species_counts),
        "familyCounts": dict(family_counts),
        "patchCounts": patch_counts,
        "tierCounts": dict(tier_counts),
        "tierPatchCounts": {tier: dict(counts) for tier, counts in tier_patch_counts.items()},
        "distanceBandsMetres": contract["distanceBandsMetres"],
        "populationModel": contract["populationModel"],
        "densityModel": "continuous deterministic turf floor with habitat-gated botanical accents",
        "turfFloor": turf_metrics,
    }
    for prototype_group in prototypes.values():
        for prototype in prototype_group:
            if prototype.name in bpy.data.objects:
                bpy.data.objects.remove(prototype, do_unlink=True)
    bpy.data.collections.remove(prototype_collection)
    return created, metrics
