"""Render Forest Gate 8 framing and prop-family evidence.

Run with the current Forest Blender scene so the baseline and candidate framing
share one camera, terrain, lighting rig, and approved authored environment:

  blender --background blender/forest_environment.blend \
    --python scripts/build-forest-prop-lineup.py

The script writes review-only renders and metrics under the operating-system
temporary directory. It never saves over the production Forest blend.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from forest_prop_assets import (  # noqa: E402
    create_established_fire_bed,
    create_modern_camp_chair,
    create_modern_dome_tent,
    create_modern_trekking_tent,
    create_modern_tunnel_tent,
    flat_material,
    rope_curve,
)


MANIFEST_PATH = SCRIPT_DIR / "forest-prop-lineup.json"
TREE_LAYOUT_PATH = SCRIPT_DIR / "forest-tree-layout.json"
PATH_LAYOUT_PATH = SCRIPT_DIR / "forest-path-layout.json"
CAMPSITE_LAYOUT_PATH = SCRIPT_DIR / "forest-campsite-layout.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf8"))
TREE_LAYOUT = json.loads(TREE_LAYOUT_PATH.read_text(encoding="utf8"))
PATH_LAYOUT = json.loads(PATH_LAYOUT_PATH.read_text(encoding="utf8"))
CAMPSITE_LAYOUT = json.loads(CAMPSITE_LAYOUT_PATH.read_text(encoding="utf8"))
TREE_ASSETS = {asset["id"]: asset for asset in TREE_LAYOUT["assets"]}

QA_DIR = Path(os.environ.get("TEMP", str(PROJECT_ROOT))) / "tka-forest-evidence" / "forest-gate8"
QA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS = {
    "framingBaseline": QA_DIR / "forest_gate8_framing_baseline.png",
    "framingCandidate": QA_DIR / "forest_gate8_framing_candidate.png",
    "legacyProps": QA_DIR / "forest_gate8_legacy_props.png",
    "modernTentFamily": QA_DIR / "forest_gate8_modern_tent_family.png",
    "campsitePlan": QA_DIR / "forest_gate8_campsite_plan.png",
    "campsiteGround": QA_DIR / "forest_gate8_campsite_ground.png",
    "metrics": QA_DIR / "forest_gate8_metrics.json",
}


def aim_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def configure_render(width=1600, height=900):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 18
    scene.view_settings.look = "AgX - Medium High Contrast"


def render(camera, path, location, target, lens):
    camera.data.type = "PERSP"
    camera.data.lens = lens
    camera.location = location
    aim_at(camera, target)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def distance_to_segment(x, y, start, end):
    ax, ay = float(start[0]), float(start[1])
    bx, by = float(end[0]), float(end[1])
    dx = bx - ax
    dy = by - ay
    denominator = dx * dx + dy * dy
    if denominator <= 1e-8:
        return math.hypot(x - ax, y - ay)
    t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / denominator))
    return math.hypot(x - (ax + dx * t), y - (ay + dy * t))


def distance_to_path(x, y, path):
    return min(
        distance_to_segment(x, y, start, end)
        for start, end in zip(path["points"], path["points"][1:])
    )


def clearing_edge_radius(angle):
    edge = PATH_LAYOUT["clearingEdge"]
    radius = float(edge["baseRadius"])
    for harmonic in edge["harmonics"]:
        argument = float(harmonic["frequency"]) * angle + float(harmonic["phase"])
        function = math.sin if harmonic["function"] == "sin" else math.cos
        radius += float(harmonic["amplitude"]) * function(argument)
    return radius


def inside_rotated_ellipse(x, y, opening):
    cx, cy = opening["center"]
    rx, ry = opening["radii"]
    rotation = math.radians(float(opening.get("rotationDegrees", 0.0)))
    local_x = (x - cx) * math.cos(rotation) + (y - cy) * math.sin(rotation)
    local_y = -(x - cx) * math.sin(rotation) + (y - cy) * math.cos(rotation)
    return (local_x / rx) ** 2 + (local_y / ry) ** 2 <= 1.0


def terrain_height(x, y):
    terrain = bpy.data.objects.get("Forest_Base_WoodlandBasin")
    if terrain is None:
        return 0.0
    inverse = terrain.matrix_world.inverted()
    local_origin = inverse @ Vector((x, y, 250.0))
    local_direction = (inverse.to_3x3() @ Vector((0.0, 0.0, -1.0))).normalized()
    hit, location, _normal, _face = terrain.ray_cast(local_origin, local_direction, distance=500.0)
    if not hit:
        raise RuntimeError(f"No Forest terrain below framing candidate at {(x, y)}")
    return (terrain.matrix_world @ location).z


def import_tree_prototype(asset):
    source = PROJECT_ROOT / asset["stagedPath"]
    if not source.is_file():
        raise RuntimeError(f"Missing staged Forest tree source: {source}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Framing source {asset['id']} imported {len(meshes)} meshes")
    prototype = meshes[0]
    for obj in imported:
        if obj is not prototype:
            bpy.data.objects.remove(obj, do_unlink=True)
    prototype.parent = None
    bpy.ops.object.select_all(action="DESELECT")
    prototype.select_set(True)
    bpy.context.view_layer.objects.active = prototype
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    prototype.select_set(False)
    prototype.location = (0.0, 0.0, 0.0)
    source_min_z = min(corner[2] for corner in prototype.bound_box)
    source_max_z = max(corner[2] for corner in prototype.bound_box)
    return prototype, source_min_z, source_max_z - source_min_z


def validate_framing_candidates():
    existing = [
        obj
        for obj in bpy.context.scene.objects
        if obj.get("tka_role") == "tree" and obj.get("tka_tree_asset") in TREE_ASSETS
    ]
    metrics = []
    previous = []
    for candidate in MANIFEST["framingCandidates"]:
        asset = TREE_ASSETS[candidate["assetId"]]
        x, y = map(float, candidate["position"])
        radius = math.hypot(x, y)
        clearing_required = float(MANIFEST["rules"]["defaultVisualClearingRadiusMetres"]) + float(
            asset["clearingSetback"]
        )
        path_clearances = []
        for path in PATH_LAYOUT["paths"]:
            actual = distance_to_path(x, y, path)
            required = (
                float(path["halfWidth"])
                + float(path["shoulderWidth"])
                + float(asset["pathClearance"])
            )
            path_clearances.append((path["id"], actual, required))
        if radius < clearing_required:
            raise RuntimeError(
                f"{candidate['id']} enters clearing: {radius:.3f} < {clearing_required:.3f} m"
            )
        maximum_radius = float(MANIFEST["rules"]["maximumNearFrameTrunkRadiusMetres"])
        if radius > maximum_radius:
            raise RuntimeError(
                f"{candidate['id']} is too distant to frame: {radius:.3f} > {maximum_radius:.3f} m"
            )
        blocked_paths = [entry for entry in path_clearances if entry[1] < entry[2]]
        if blocked_paths:
            raise RuntimeError(f"{candidate['id']} blocks path shoulders: {blocked_paths}")
        spacing_samples = []
        for obj in existing:
            other_asset = TREE_ASSETS[obj["tka_tree_asset"]]
            required = float(TREE_LAYOUT["spacingFactor"]) * (
                float(asset["footprintRadius"]) + float(other_asset["footprintRadius"])
            )
            actual = math.hypot(x - obj.location.x, y - obj.location.y)
            spacing_samples.append((obj.name, actual, required))
        for placed in previous:
            other_asset = TREE_ASSETS[placed["assetId"]]
            required = float(TREE_LAYOUT["spacingFactor"]) * (
                float(asset["footprintRadius"]) + float(other_asset["footprintRadius"])
            )
            actual = math.hypot(x - placed["x"], y - placed["y"])
            spacing_samples.append((placed["id"], actual, required))
        blocked_spacing = [entry for entry in spacing_samples if entry[1] < entry[2]]
        if blocked_spacing:
            closest = min(blocked_spacing, key=lambda entry: entry[1] - entry[2])
            raise RuntimeError(f"{candidate['id']} overlaps {closest}")

        closest_path = min(path_clearances, key=lambda entry: entry[1] - entry[2])
        closest_tree = min(spacing_samples, key=lambda entry: entry[1] - entry[2])
        metrics.append(
            {
                "id": candidate["id"],
                "assetId": candidate["assetId"],
                "position": [x, y],
                "radiusMetres": radius,
                "clearingRequiredMetres": clearing_required,
                "clearingMarginMetres": radius - clearing_required,
                "maximumFrameMarginMetres": maximum_radius - radius,
                "closestPath": closest_path[0],
                "pathMarginMetres": closest_path[1] - closest_path[2],
                "closestTree": closest_tree[0],
                "treeSpacingMarginMetres": closest_tree[1] - closest_tree[2],
            }
        )
        previous.append({"id": candidate["id"], "assetId": asset["id"], "x": x, "y": y})
    return metrics


def add_framing_candidates():
    by_asset = {}
    for candidate in MANIFEST["framingCandidates"]:
        by_asset.setdefault(candidate["assetId"], []).append(candidate)
    created = []
    for asset_id, candidates in by_asset.items():
        asset = TREE_ASSETS[asset_id]
        prototype, source_min_z, source_height = import_tree_prototype(asset)
        normalized_scale = float(asset["targetHeightMetres"]) / source_height
        for candidate in candidates:
            x, y = map(float, candidate["position"])
            scale = normalized_scale * float(candidate["scale"])
            tree = prototype.copy()
            tree.data = prototype.data
            bpy.context.scene.collection.objects.link(tree)
            tree.name = f"ForestGate8Frame_{candidate['id']}"
            tree.scale = (scale, scale, scale)
            tree.rotation_mode = "XYZ"
            tree.rotation_euler[2] = math.radians(float(candidate["rotationDegrees"]))
            tree.location = (x, y, terrain_height(x, y) - source_min_z * scale)
            tree["tka_role"] = "gate8-framing-candidate"
            tree["tka_tree_asset"] = asset_id
            created.append(tree)
        bpy.data.objects.remove(prototype, do_unlink=True)
    return created


def render_framing_study():
    configure_render()
    scene = bpy.context.scene
    camera = bpy.data.objects.get("QA_ForestCamera")
    if camera is None:
        raise RuntimeError("Forest QA camera is missing from the loaded production blend")
    scene.camera = camera
    render(
        camera,
        OUTPUTS["framingBaseline"],
        (0.0, -31.0, 8.0),
        (0.0, 0.0, 2.0),
        38,
    )
    framing_metrics = validate_framing_candidates()
    created = add_framing_candidates()
    render(
        camera,
        OUTPUTS["framingCandidate"],
        (0.0, -31.0, 8.0),
        (0.0, 0.0, 2.0),
        38,
    )
    for obj in created:
        bpy.data.objects.remove(obj, do_unlink=True)
    return framing_metrics


def reset_prop_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    configure_render()
    world = bpy.data.worlds.new("Forest Gate 8 Studio")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.018, 0.026, 0.023, 1.0)
    background.inputs["Strength"].default_value = 0.52
    scene.world = world

    floor_material = flat_material("Forest Gate 8 Ground", (0.055, 0.064, 0.047), 0.96)
    bpy.ops.mesh.primitive_plane_add(size=34, location=(0, 0, -0.015))
    floor = bpy.context.object
    floor.name = "Forest Gate 8 Review Ground"
    floor.data.materials.append(floor_material)

    def area_light(name, location, energy, color, size, target=(0, 0, 0.8)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        bpy.context.scene.collection.objects.link(obj)
        aim_at(obj, target)

    area_light("Gate8 Key", (-8.0, -10.0, 12.0), 2350, (0.72, 0.88, 0.82), 7.0)
    area_light("Gate8 Fill", (10.0, -3.0, 7.0), 1450, (0.95, 0.60, 0.34), 6.0)
    area_light("Gate8 Rim", (0.0, 9.0, 10.0), 1450, (0.36, 0.57, 0.49), 7.0)
    area_light("Gate8 Front Fill", (0.0, -12.0, 4.0), 780, (0.58, 0.72, 0.62), 5.0)

    camera_data = bpy.data.cameras.new("Forest Gate 8 Camera")
    camera_data.clip_start = 0.05
    camera_data.clip_end = 200.0
    camera = bpy.data.objects.new("Forest Gate 8 Camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera
    return camera


def world_bounds(root):
    corners = []
    objects = [root, *root.children_recursive]
    for obj in objects:
        if obj.type != "MESH":
            continue
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not corners:
        raise RuntimeError(f"Imported prop {root.name} has no mesh bounds")
    minimum = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    maximum = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    return minimum, maximum


def import_group(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)
    for obj in imported:
        if obj.parent not in imported_set:
            matrix_world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = matrix_world
    return root


def meshopt_readable(path):
    cache_dir = QA_DIR / "decoded-sources"
    cache_dir.mkdir(parents=True, exist_ok=True)
    output = cache_dir / path.name
    if not output.is_file() or output.stat().st_mtime < path.stat().st_mtime:
        npx = "npx.cmd" if os.name == "nt" else "npx"
        subprocess.run(
            [npx, "gltf-transform", "copy", str(path), str(output)],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    return output


def fit_and_place(root, target_longest, position, yaw_degrees=0.0):
    bpy.context.view_layer.update()
    minimum, maximum = world_bounds(root)
    extent = maximum - minimum
    longest = max(extent)
    scale = target_longest / longest
    root.scale = (scale, scale, scale)
    root.rotation_euler[2] = math.radians(yaw_degrees)
    bpy.context.view_layer.update()
    minimum, maximum = world_bounds(root)
    center = (minimum + maximum) * 0.5
    root.location.x += position[0] - center.x
    root.location.y += position[1] - center.y
    root.location.z += position[2] - minimum.z
    bpy.context.view_layer.update()
    return root


def source_for(candidate):
    source = candidate["source"]
    if source["kind"] == "blender-authored":
        return None
    path = PROJECT_ROOT / source["localPath"]
    if source["kind"] == "local-glb-meshopt":
        return meshopt_readable(path)
    return path


def create_scale_person(location, name):
    material = flat_material("Gate 8 Scale Person", (0.035, 0.050, 0.052), 0.72)
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=0.19, depth=1.28, location=(0, 0, 0.64))
    body = bpy.context.object
    body.data.materials.append(material)
    body.parent = root
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.23, location=(0, 0, 1.53))
    head = bpy.context.object
    head.data.materials.append(material)
    head.parent = root
    root.location = location
    return root


def clear_props_except_stage():
    for obj in list(bpy.context.scene.objects):
        if obj.name in {
            "Forest Gate 8 Review Ground",
            "Gate8 Key",
            "Gate8 Fill",
            "Gate8 Rim",
            "Gate8 Front Fill",
            "Forest Gate 8 Camera",
        }:
            continue
        bpy.data.objects.remove(obj, do_unlink=True)


def render_legacy_props(camera):
    candidates = {entry["id"]: entry for entry in MANIFEST["candidates"]}
    placements = (
        ("K4", 3.8, (-5.1, 0.6, 0.0), -8.0),
        ("K3", 2.8, (-1.1, -0.2, 0.0), 18.0),
        ("K1", 1.35, (2.3, 0.0, 0.0), 22.0),
        ("K2", 1.25, (5.0, 0.1, 0.0), -18.0),
    )
    for candidate_id, size, position, yaw in placements:
        candidate = candidates[candidate_id]
        root = import_group(source_for(candidate), f"Gate8_{candidate_id}_{candidate['label']}")
        fit_and_place(root, size, position, yaw)
    create_scale_person((0.9, 1.0, 0.0), "Gate8_LegacyScalePerson")
    render(camera, OUTPUTS["legacyProps"], (11.0, -18.0, 7.4), (0.0, 0.0, 1.0), 52)


def tent_yaw(position, fire_position):
    dx = float(fire_position[0]) - float(position[0])
    dy = float(fire_position[1]) - float(position[1])
    return math.atan2(dx, -dy)


def create_tent_pad(name, position, footprint, yaw):
    material = flat_material("Forest Campsite Durable Tent Pad", (0.095, 0.082, 0.057), 0.99)
    bpy.ops.mesh.primitive_cube_add(location=(position[0], position[1], 0.025))
    pad = bpy.context.object
    pad.name = name
    pad.scale = (float(footprint[0]) * 0.5, float(footprint[1]) * 0.5, 0.025)
    pad.rotation_euler[2] = yaw
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    pad.data.materials.append(material)
    bevel = pad.modifiers.new("Soft campsite pad edge", "BEVEL")
    bevel.width = 0.22
    bevel.segments = 4
    bpy.context.view_layer.objects.active = pad
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return pad


def place_tent_family(use_layout=True):
    fire_position = CAMPSITE_LAYOUT["fire"]["position"]
    builders = {
        "F1": create_modern_dome_tent,
        "F2": create_modern_tunnel_tent,
        "F3": create_modern_trekking_tent,
    }
    roots = []
    if use_layout:
        tents = CAMPSITE_LAYOUT["tents"]
    else:
        tents = (
            {"id": "dome-two-person", "assetId": "F1", "position": [-4.8, 0.1]},
            {"id": "tunnel-three-person", "assetId": "F2", "position": [0.0, 0.9]},
            {"id": "trekking-one-person", "assetId": "F3", "position": [5.0, -0.2]},
        )
    for tent in tents:
        position = tuple(map(float, tent["position"]))
        root = builders[tent["assetId"]](
            (position[0], position[1], 0.0),
            f"Gate8_{tent['assetId']}_{tent['id']}",
        )
        root.rotation_euler[2] = tent_yaw(position, fire_position) if use_layout else 0.0
        roots.append(root)
    return roots


def create_ring(name, center, radius, color, width=0.045):
    material = flat_material(name, color, 0.56)
    points = []
    for index in range(65):
        angle = math.tau * index / 64
        points.append(
            (
                center[0] + math.cos(angle) * radius,
                center[1] + math.sin(angle) * radius,
                0.10,
            )
        )
    return rope_curve(name, points, material, width)


def create_path_line():
    path = next(path for path in PATH_LAYOUT["paths"] if path["id"] == "camp-spur")
    material = flat_material("Forest Camp Spur Review", (0.34, 0.25, 0.12), 0.96)
    points = [(float(x), float(y), 0.07) for x, y in path["points"]]
    return rope_curve("Gate8_CampSpur", points, material, float(path["halfWidth"]) * 0.48)


def create_stage_footprint():
    material = flat_material("Forest Stage Footprint Review", (0.11, 0.17, 0.16), 0.92)
    bpy.ops.mesh.primitive_cube_add(location=(0.0, 0.0, 0.035))
    stage = bpy.context.object
    stage.name = "Gate8_StageFootprint"
    stage.scale = (3.0, 2.25, 0.035)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    stage.data.materials.append(material)
    return stage


def create_review_flame(position):
    material = flat_material("Gate8 Review Flame", (0.88, 0.12, 0.012), 0.34)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    if emission_input is not None:
        emission_input.default_value = (1.0, 0.075, 0.004, 1.0)
    strength_input = bsdf.inputs.get("Emission Strength")
    if strength_input is not None:
        strength_input.default_value = 4.0
    created = []
    for index, (offset, scale) in enumerate(
        (
            ((-0.18, 0.02, 0.70), (0.22, 0.18, 0.62)),
            ((0.16, 0.10, 0.58), (0.20, 0.16, 0.48)),
            ((0.0, -0.10, 0.78), (0.18, 0.15, 0.78)),
        )
    ):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2,
            radius=1.0,
            location=(position[0] + offset[0], position[1] + offset[1], offset[2]),
        )
        flame = bpy.context.object
        flame.name = f"Gate8_ReviewFlame_{index + 1}"
        flame.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        flame.data.materials.append(material)
        created.append(flame)
    light_data = bpy.data.lights.new("Gate8 Campfire Review Light", "POINT")
    light_data.energy = 650.0
    light_data.color = (1.0, 0.20, 0.035)
    light_data.shadow_soft_size = 2.1
    light = bpy.data.objects.new("Gate8 Campfire Review Light", light_data)
    light.location = (position[0], position[1], 1.4)
    bpy.context.scene.collection.objects.link(light)
    created.append(light)
    return created


def place_camp_seats():
    fire_x, fire_y = map(float, CAMPSITE_LAYOUT["fire"]["position"])
    radius = float(CAMPSITE_LAYOUT["communalZone"]["seatRadius"])
    roots = []
    for index, angle_degrees in enumerate(CAMPSITE_LAYOUT["communalZone"]["chairAnglesDegrees"]):
        angle = math.radians(float(angle_degrees))
        position = (fire_x + math.cos(angle) * radius, fire_y + math.sin(angle) * radius)
        root = create_modern_camp_chair(
            (position[0], position[1], 0.0),
            f"Gate8_CampChair_{index + 1}",
            "teal" if index != 1 else "spruce",
        )
        root.rotation_euler[2] = tent_yaw(position, (fire_x, fire_y))
        roots.append(root)
    return roots


def validate_campsite_layout():
    fire_x, fire_y = map(float, CAMPSITE_LAYOUT["fire"]["position"])
    minimum = float(CAMPSITE_LAYOUT["fire"]["minimumTentDistance"])
    stage_half_width = 3.0
    stage_half_depth = 2.25
    stage_dx = max(abs(fire_x) - stage_half_width, 0.0)
    stage_dy = max(abs(fire_y) - stage_half_depth, 0.0)
    stage_distance = math.hypot(stage_dx, stage_dy)
    if stage_distance < minimum:
        raise RuntimeError(
            f"Fire enters stage safety buffer: {stage_distance:.3f} < {minimum:.3f} m"
        )
    metrics = []
    for tent in CAMPSITE_LAYOUT["tents"]:
        x, y = map(float, tent["position"])
        width, depth = map(float, tent["footprint"])
        center_distance = math.hypot(x - fire_x, y - fire_y)
        footprint_radius = math.hypot(width * 0.5, depth * 0.5)
        conservative_edge_distance = center_distance - footprint_radius
        if conservative_edge_distance < minimum:
            raise RuntimeError(
                f"{tent['id']} enters 15-foot fire buffer: {conservative_edge_distance:.3f} < {minimum:.3f} m"
            )
        metrics.append(
            {
                "id": tent["id"],
                "capacity": int(tent["capacity"]),
                "centerDistanceMetres": center_distance,
                "conservativeFabricDistanceMetres": conservative_edge_distance,
                "minimumRequiredMetres": minimum,
                "safetyMarginMetres": conservative_edge_distance - minimum,
            }
        )
    return metrics, stage_distance


def render_ortho(camera, path, location, target, ortho_scale):
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    camera.location = location
    aim_at(camera, target)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render_modern_tent_family(camera):
    place_tent_family(use_layout=False)
    create_scale_person((7.2, -0.3, 0.0), "Gate8_ModernTentScalePerson")
    render(camera, OUTPUTS["modernTentFamily"], (12.0, -18.5, 7.4), (0.0, 0.2, 0.9), 52)


def render_campsite_plan(camera):
    fire_position = tuple(map(float, CAMPSITE_LAYOUT["fire"]["position"]))
    create_stage_footprint()
    create_path_line()
    for tent in CAMPSITE_LAYOUT["tents"]:
        yaw = tent_yaw(tent["position"], fire_position)
        create_tent_pad(
            f"Gate8_{tent['id']}_Pad",
            tent["position"],
            tent["padFootprint"],
            yaw,
        )
    place_tent_family(use_layout=True)
    create_established_fire_bed((fire_position[0], fire_position[1], 0.0), "Gate8_F4_FireBedPlan")
    place_camp_seats()
    create_ring(
        "Gate8_10ft_ClearedFuelCircle",
        fire_position,
        float(CAMPSITE_LAYOUT["fire"]["clearedFuelRadius"]),
        (0.78, 0.41, 0.06),
        0.055,
    )
    create_ring(
        "Gate8_15ft_TentBuffer",
        fire_position,
        float(CAMPSITE_LAYOUT["fire"]["minimumTentDistance"]),
        (0.76, 0.14, 0.06),
        0.065,
    )
    render_ortho(camera, OUTPUTS["campsitePlan"], (8.0, 0.0, 34.0), (8.0, 0.0, 0.0), 27.0)


def render_campsite_ground(camera):
    fire_position = tuple(map(float, CAMPSITE_LAYOUT["fire"]["position"]))
    for tent in CAMPSITE_LAYOUT["tents"]:
        create_tent_pad(
            f"Gate8_{tent['id']}_Pad",
            tent["position"],
            tent["padFootprint"],
            tent_yaw(tent["position"], fire_position),
        )
    place_tent_family(use_layout=True)
    create_established_fire_bed((fire_position[0], fire_position[1], 0.0), "Gate8_F4_FireBedGround")
    place_camp_seats()
    create_review_flame(fire_position)
    render(camera, OUTPUTS["campsiteGround"], (5.4, -24.5, 9.2), (10.0, 0.0, 1.0), 50)


def render_prop_studies():
    camera = reset_prop_scene()
    render_legacy_props(camera)
    clear_props_except_stage()
    render_modern_tent_family(camera)
    clear_props_except_stage()
    render_campsite_plan(camera)
    clear_props_except_stage()
    render_campsite_ground(camera)


def main():
    framing_metrics = render_framing_study()
    campsite_metrics, stage_distance = validate_campsite_layout()
    render_prop_studies()
    metrics = {
        "manifestVersion": MANIFEST["version"],
        "outputs": {key: str(path) for key, path in OUTPUTS.items() if key != "metrics"},
        "framingCandidateCount": len(MANIFEST["framingCandidates"]),
        "framingCandidates": framing_metrics,
        "campsite": {
            "firePosition": CAMPSITE_LAYOUT["fire"]["position"],
            "clearedFuelRadiusMetres": CAMPSITE_LAYOUT["fire"]["clearedFuelRadius"],
            "minimumTentDistanceMetres": CAMPSITE_LAYOUT["fire"]["minimumTentDistance"],
            "fireToStageDistanceMetres": stage_distance,
            "fireToStageSafetyMarginMetres": stage_distance
            - float(CAMPSITE_LAYOUT["fire"]["minimumTentDistance"]),
            "tentCount": len(CAMPSITE_LAYOUT["tents"]),
            "totalSleepingCapacity": sum(int(tent["capacity"]) for tent in CAMPSITE_LAYOUT["tents"]),
            "tents": campsite_metrics,
            "runtimeOwnersPreserved": ["volumetric fire", "smoke", "primary light", "fill light"],
        },
        "legacyCandidateCount": sum(
            1 for candidate in MANIFEST["candidates"] if candidate["verdict"] == "retire"
        ),
        "recommendedCandidateCount": sum(
            1 for candidate in MANIFEST["candidates"] if candidate["verdict"] == "recommend"
        ),
        "paidMeshyCredits": 0,
        "creditReserve": MANIFEST["rules"]["creditReserve"],
        "productionFilesChanged": False,
    }
    OUTPUTS["metrics"].write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf8")
    print(json.dumps(metrics, indent=2))


main()
