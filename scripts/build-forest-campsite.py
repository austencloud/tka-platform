"""Build the approved Moonlit Firefly Forest campsite for runtime.

The measured campsite layout remains the spatial owner. This builder composes
the approved Meshy tent and fire-pit assets with the authored pads and chairs
without taking over the runtime flame, smoke, or light systems.

Outputs:
  blender/forest_campsite.blend
  %TEMP%/tka-forest-evidence/forest_campsite_qa_*.png
  %TEMP%/tka-forest-evidence/forest_campsite_metrics.json
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from forest_prop_assets import (  # noqa: E402
    create_modern_camp_chair,
    create_production_campsite_materials,
    create_tent_pad,
    flat_material,
)


LAYOUT_PATH = os.path.join(SCRIPT_DIR, "forest-campsite-layout.json")
MESHY_MANIFEST_PATH = os.path.join(SCRIPT_DIR, "forest-campsite-meshy-images.json")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "forest_campsite.blend")
QA_DIR = os.path.join(os.environ.get("TEMP", PROJECT_ROOT), "tka-forest-evidence")
QA_PATHS = {
    "hero": os.path.join(QA_DIR, "forest_campsite_qa_hero.png"),
    "plan": os.path.join(QA_DIR, "forest_campsite_qa_plan.png"),
}
METRICS_PATH = os.path.join(QA_DIR, "forest_campsite_metrics.json")
RIPSTOP_TEXTURE_PATH = os.path.join(
    PROJECT_ROOT,
    "static",
    "textures",
    "forest-campsite",
    "ripstop-neutral-v1.png",
)

with open(LAYOUT_PATH, "rb") as handle:
    LAYOUT_BYTES = handle.read()
LAYOUT = json.loads(LAYOUT_BYTES.decode("utf8"))
LAYOUT_SHA256 = hashlib.sha256(LAYOUT_BYTES).hexdigest()
with open(MESHY_MANIFEST_PATH, "r", encoding="utf8") as handle:
    MESHY_MANIFEST = json.load(handle)
MESHY_ASSETS = {asset["id"]: asset for asset in MESHY_MANIFEST["assets"]}

TENT_MATERIAL_GRADES = {
    "dome-two-person": {
        "fabricSrgb": (0.43, 0.54, 0.39),
        "nightLift": 0.035,
    },
    "tunnel-three-person": {
        "fabricSrgb": (0.27, 0.52, 0.62),
        "nightLift": 0.045,
    },
    "trekking-one-person": {
        "fabricSrgb": (0.49, 0.54, 0.31),
        "nightLift": 0.035,
    },
}


def clear_scene():
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
            if datablock.users == 0:
                datablocks.remove(datablock)


def runtime_to_blender(position):
    """Convert a runtime ground-plane x/z coordinate to Blender x/y."""
    return (float(position[0]), -float(position[1]), 0.0)


def face_negative_y_toward(origin_runtime, target_runtime):
    origin = runtime_to_blender(origin_runtime)
    target = runtime_to_blender(target_runtime)
    dx = target[0] - origin[0]
    dy = target[1] - origin[1]
    return math.atan2(dx, -dy)


def descendants(root):
    pending = list(root.children)
    while pending:
        child = pending.pop()
        yield child
        pending.extend(child.children)


def object_bounds(objects):
    bpy.context.view_layer.update()
    minimum = Vector((float("inf"), float("inf"), float("inf")))
    maximum = Vector((float("-inf"), float("-inf"), float("-inf")))
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
    return minimum, maximum


def tint_clean_ripstop_albedo(image, item_id):
    """Tint a neutral ripstop scan without retaining any Meshy studio shading."""
    grade = TENT_MATERIAL_GRADES[item_id]
    pixel_count = int(image.size[0]) * int(image.size[1])
    pixels = np.empty(pixel_count * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape((-1, 4))
    neutral = rgba[:, :3].copy()
    neutral_luma = (
        neutral[:, 0] * 0.2126
        + neutral[:, 1] * 0.7152
        + neutral[:, 2] * 0.0722
    )
    fabric = np.asarray(grade["fabricSrgb"], dtype=np.float32)
    neutral_median = max(float(np.median(neutral_luma)), 0.001)
    weave = np.clip(neutral_luma / neutral_median, 0.94, 1.06).reshape((-1, 1))
    corrected = fabric[None, :] * weave
    corrected = np.clip(corrected, 0.0, 1.0)
    rgba[:, :3] = corrected
    rgba[:, 3] = 1.0
    image.pixels.foreach_set(pixels)
    image.update()
    image.pack()

    corrected_luma = (
        corrected[:, 0] * 0.2126
        + corrected[:, 1] * 0.7152
        + corrected[:, 2] * 0.0722
    )
    return {
        "grade": "forest-clean-ripstop-v3",
        "sourceTexture": os.path.relpath(RIPSTOP_TEXTURE_PATH, PROJECT_ROOT),
        "neutralMeanLuminance": float(neutral_luma.mean()),
        "correctedMeanLuminance": float(corrected_luma.mean()),
        "correctedP10Luminance": float(np.percentile(corrected_luma, 10)),
        "maximumTextureVariation": 0.06,
        "emissiveStrength": float(grade["nightLift"]),
    }


def retune_tent_materials(meshes, item_id):
    grade = TENT_MATERIAL_GRADES[item_id]
    metrics = []
    seen_materials = set()
    for mesh in meshes:
        for slot in mesh.material_slots:
            material = slot.material
            if material is None or material in seen_materials:
                continue
            seen_materials.add(material)
            if not material.use_nodes:
                raise RuntimeError(f"{item_id} imported a non-node tent material")

            bsdf = material.node_tree.nodes.get("Principled BSDF")
            if bsdf is None:
                raise RuntimeError(f"{item_id} tent material has no Principled BSDF")
            base_input = bsdf.inputs.get("Base Color")
            if base_input is None or not base_input.is_linked:
                raise RuntimeError(f"{item_id} tent material has no base-color atlas")
            source_node = base_input.links[0].from_node
            if source_node.type != "TEX_IMAGE" or source_node.image is None:
                raise RuntimeError(f"{item_id} base color is not an image texture")

            corrected_image = bpy.data.images.load(
                RIPSTOP_TEXTURE_PATH,
                check_existing=False,
            )
            corrected_image.name = f"Forest Tent {item_id} Clean Ripstop Albedo"
            source_node.image = corrected_image
            source_node.interpolation = "Linear"
            grade_metrics = tint_clean_ripstop_albedo(corrected_image, item_id)

            metallic_input = bsdf.inputs.get("Metallic")
            if metallic_input is not None:
                for link in list(metallic_input.links):
                    material.node_tree.links.remove(link)
                metallic_input.default_value = 0.0
            roughness_input = bsdf.inputs.get("Roughness")
            if roughness_input is not None:
                for link in list(roughness_input.links):
                    material.node_tree.links.remove(link)
                roughness_input.default_value = 0.94
            specular_input = bsdf.inputs.get("Specular IOR Level")
            if specular_input is not None:
                for link in list(specular_input.links):
                    material.node_tree.links.remove(link)
                specular_input.default_value = 0.10
            coat_input = bsdf.inputs.get("Coat Weight")
            if coat_input is not None:
                for link in list(coat_input.links):
                    material.node_tree.links.remove(link)
                coat_input.default_value = 0.0
            emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            if emission_input is not None:
                for link in list(emission_input.links):
                    material.node_tree.links.remove(link)
                emission_input.default_value = (*grade["fabricSrgb"], 1.0)
            emission_strength = bsdf.inputs.get("Emission Strength")
            if emission_strength is not None:
                emission_strength.default_value = grade["nightLift"]
            normal_input = bsdf.inputs.get("Normal")
            if normal_input is not None and normal_input.is_linked:
                normal_node = normal_input.links[0].from_node
                if normal_node.type == "NORMAL_MAP":
                    normal_node.inputs["Strength"].default_value = 0.12

            material.name = f"Forest Tent Clean Ripstop {item_id}"
            material.diffuse_color = (*TENT_MATERIAL_GRADES[item_id]["fabricSrgb"], 1.0)
            material["tka_material_grade"] = grade_metrics["grade"]
            material["tka_material_item"] = item_id
            material["tka_material_emissive_strength"] = grade["nightLift"]
            metrics.append({"material": material.name, **grade_metrics})

    if not metrics:
        raise RuntimeError(f"{item_id} imported no material to retune")
    return metrics


def import_meshy_asset(asset_id, item_id, role, target_dimensions, position_runtime, yaw):
    source_path = os.path.join(
        PROJECT_ROOT,
        MESHY_MANIFEST["outputDirectory"],
        f"{asset_id}_raw.glb",
    )
    if not os.path.isfile(source_path):
        raise RuntimeError(f"Missing Meshy campsite asset: {source_path}")

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=source_path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"Meshy campsite asset imported no mesh: {asset_id}")

    material_metrics = []
    if role == "tent":
        material_metrics = retune_tent_materials(meshes, item_id)

    source_root = bpy.data.objects.new(f"ForestCampsite_Source_{asset_id}", None)
    bpy.context.scene.collection.objects.link(source_root)
    imported_set = set(imported)
    for obj in imported:
        if obj.parent not in imported_set:
            world = obj.matrix_world.copy()
            obj.parent = source_root
            obj.matrix_world = world

    minimum, maximum = object_bounds(meshes)
    dimensions = maximum - minimum
    target_width, target_depth, target_height = map(float, target_dimensions)
    if min(dimensions.x, dimensions.y, dimensions.z) <= 0.001:
        raise RuntimeError(f"Meshy campsite asset has invalid bounds: {asset_id}")
    if role == "tent":
        scale_xyz = Vector(
            (
                target_width / dimensions.x,
                target_depth / dimensions.y,
                target_height / dimensions.z,
            )
        )
        normalization_mode = "measured-target-bounds"
    else:
        uniform_scale = target_height / dimensions.z
        scale_xyz = Vector((uniform_scale, uniform_scale, uniform_scale))
        normalization_mode = "target-height"

    source_root.scale = scale_xyz
    source_root.location = (
        -((minimum.x + maximum.x) * 0.5) * scale_xyz.x,
        -((minimum.y + maximum.y) * 0.5) * scale_xyz.y,
        -minimum.z * scale_xyz.z,
    )

    placement = bpy.data.objects.new(f"ForestCampsite_{item_id}", None)
    bpy.context.scene.collection.objects.link(placement)
    source_root.parent = placement
    placement.location = runtime_to_blender(position_runtime)
    placement.rotation_euler[2] = yaw
    tagged = tag_renderables(placement, role, item_id)
    return placement, tagged, {
        "sourcePath": source_path,
        "sourceDimensions": [dimensions.x, dimensions.y, dimensions.z],
        "normalizedScale": [scale_xyz.x, scale_xyz.y, scale_xyz.z],
        "normalizationMode": normalization_mode,
        "targetDimensions": [target_width, target_depth, target_height],
        "finalDimensions": [
            dimensions.x * scale_xyz.x,
            dimensions.y * scale_xyz.y,
            dimensions.z * scale_xyz.z,
        ],
        "materialMetrics": material_metrics,
    }


def tag_renderables(root, role, item_id):
    root["tka_export_layer"] = "forest-campsite"
    root["tka_role"] = role
    root["tka_campsite_item"] = item_id
    root["tka_campsite_layout_version"] = int(LAYOUT["version"])
    root["tka_campsite_layout_sha256"] = LAYOUT_SHA256
    tagged = []
    for obj in descendants(root):
        if obj.type not in {"MESH", "CURVE"}:
            continue
        obj["tka_export_layer"] = "forest-campsite"
        obj["tka_role"] = role
        obj["tka_campsite_item"] = item_id
        obj["tka_campsite_layout_version"] = int(LAYOUT["version"])
        obj["tka_campsite_layout_sha256"] = LAYOUT_SHA256
        tagged.append(obj)
    return tagged


def tag_mesh(obj, role, item_id):
    obj["tka_export_layer"] = "forest-campsite"
    obj["tka_role"] = role
    obj["tka_campsite_item"] = item_id
    obj["tka_campsite_layout_version"] = int(LAYOUT["version"])
    obj["tka_campsite_layout_sha256"] = LAYOUT_SHA256
    return obj


def build_production_geometry():
    materials = create_production_campsite_materials()
    fire_runtime = tuple(map(float, LAYOUT["fire"]["position"]))
    role_counts = {role: 0 for role in LAYOUT["production"]["roles"]}
    item_ids = []
    source_metrics = []

    for tent in LAYOUT["tents"]:
        item_id = str(tent["id"])
        position_runtime = tuple(map(float, tent["position"]))
        position_blender = runtime_to_blender(position_runtime)
        yaw = face_negative_y_toward(position_runtime, fire_runtime)
        pad = create_tent_pad(
            f"ForestCampsite_{item_id}_Pad",
            position_blender,
            tent["padFootprint"],
            yaw,
        )
        tag_mesh(pad, "tent-pad", f"{item_id}-pad")
        role_counts["tent-pad"] += 1
        item_ids.append(f"{item_id}-pad")

        asset = MESHY_ASSETS[item_id]
        root, tagged, metrics = import_meshy_asset(
            item_id,
            item_id,
            "tent",
            (
                tent["footprint"][0],
                tent["footprint"][1],
                asset["targetHeightMetres"],
            ),
            position_runtime,
            yaw + math.radians(float(tent.get("sourceYawDegrees", 0))),
        )
        role_counts["tent"] += len(tagged)
        item_ids.append(item_id)
        source_metrics.append({"id": item_id, **metrics})

    fire_asset = MESHY_ASSETS["modern-smokeless-fire-pit"]
    fire_root, fire_renderables, fire_metrics = import_meshy_asset(
        "modern-smokeless-fire-pit",
        "modern-smokeless-fire-pit",
        "fire-pit",
        (
            fire_asset["targetDiameterMetres"],
            fire_asset["targetDiameterMetres"],
            fire_asset["targetHeightMetres"],
        ),
        fire_runtime,
        0.0,
    )
    role_counts["fire-pit"] += len(fire_renderables)
    item_ids.append("modern-smokeless-fire-pit")
    source_metrics.append({"id": "modern-smokeless-fire-pit", **fire_metrics})

    fire_x, fire_z = fire_runtime
    radius = float(LAYOUT["communalZone"]["seatRadius"])
    for index, angle_degrees in enumerate(LAYOUT["communalZone"]["chairAnglesDegrees"]):
        angle = math.radians(float(angle_degrees))
        position_runtime = (
            fire_x + math.cos(angle) * radius,
            fire_z + math.sin(angle) * radius,
        )
        item_id = f"chair-{index + 1}"
        chair = create_modern_camp_chair(
            runtime_to_blender(position_runtime),
            f"ForestCampsite_Chair_{index + 1}",
            "spruce" if index == 1 else "teal",
            materials,
        )
        chair.rotation_euler[2] = face_negative_y_toward(position_runtime, fire_runtime)
        tagged = tag_renderables(chair, "camp-chair", item_id)
        role_counts["camp-chair"] += len(tagged)
        item_ids.append(item_id)

    return role_counts, item_ids, source_metrics


def validate_layout(role_counts, item_ids, source_metrics):
    fire_x, fire_z = map(float, LAYOUT["fire"]["position"])
    minimum = float(LAYOUT["fire"]["minimumTentDistance"])
    tent_metrics = []
    for tent in LAYOUT["tents"]:
        x, z = map(float, tent["position"])
        width, depth = map(float, tent["footprint"])
        center_distance = math.hypot(x - fire_x, z - fire_z)
        footprint_radius = math.hypot(width * 0.5, depth * 0.5)
        edge_distance = center_distance - footprint_radius
        if edge_distance < minimum:
            raise RuntimeError(
                f"{tent['id']} enters the 15-foot fire buffer: {edge_distance:.3f} < {minimum:.3f} m"
            )
        tent_metrics.append(
            {
                "id": tent["id"],
                "centerDistanceMetres": center_distance,
                "conservativeFabricDistanceMetres": edge_distance,
                "safetyMarginMetres": edge_distance - minimum,
            }
        )

    if len(set(item_ids)) != len(item_ids):
        raise RuntimeError("Campsite item identifiers must be unique")
    if role_counts["tent-pad"] != len(LAYOUT["tents"]):
        raise RuntimeError("Each approved tent needs one durable pad")
    if role_counts["fire-pit"] <= 0:
        raise RuntimeError("The approved modern fire pit is missing")
    if role_counts["camp-chair"] < len(LAYOUT["communalZone"]["chairAnglesDegrees"]):
        raise RuntimeError("The approved modern chair arc is incomplete")

    stage_x, stage_z = map(float, LAYOUT["siteLogic"]["stageCenter"])
    stage_to_fire = math.hypot(fire_x - stage_x, fire_z - stage_z)
    minimum_stage_to_fire = float(
        LAYOUT["siteLogic"]["minimumStageToFireCenterMetres"]
    )
    if stage_to_fire < minimum_stage_to_fire:
        raise RuntimeError(
            f"Camp social core crowds the stage: {stage_to_fire:.3f} < {minimum_stage_to_fire:.3f} m"
        )

    metrics = {
        "layoutVersion": LAYOUT["version"],
        "layoutSha256": LAYOUT_SHA256,
        "firePositionRuntime": LAYOUT["fire"]["position"],
        "tentCount": len(LAYOUT["tents"]),
        "totalSleepingCapacity": sum(int(tent["capacity"]) for tent in LAYOUT["tents"]),
        "chairCount": len(LAYOUT["communalZone"]["chairAnglesDegrees"]),
        "itemIds": item_ids,
        "roleCounts": role_counts,
        "sourceMetrics": source_metrics,
        "tentSafety": tent_metrics,
        "stageToFireCenterMetres": stage_to_fire,
        "runtimeOwnersPreserved": [
            "volumetric fire",
            "smoke",
            "primary light",
            "fill light",
        ],
    }
    os.makedirs(QA_DIR, exist_ok=True)
    with open(METRICS_PATH, "w", encoding="utf8") as handle:
        json.dump(metrics, handle, indent=2)
        handle.write("\n")
    return metrics


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_review_scene():
    ground_material = flat_material("Forest Campsite QA Ground", (0.035, 0.055, 0.032), 0.98)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=22.0, depth=0.035, location=(18.0, -4.0, -0.035))
    ground = bpy.context.object
    ground.name = "QA_CampsiteGround"
    ground.data.materials.append(ground_material)

    flame_material = flat_material("Forest Campsite QA Flame", (1.0, 0.11, 0.012), 0.38)
    flame_bsdf = flame_material.node_tree.nodes.get("Principled BSDF")
    emission_input = flame_bsdf.inputs.get("Emission Color") or flame_bsdf.inputs.get("Emission")
    if emission_input is not None:
        emission_input.default_value = (1.0, 0.035, 0.002, 1.0)
    strength_input = flame_bsdf.inputs.get("Emission Strength")
    if strength_input is not None:
        strength_input.default_value = 3.5
    fire_blender = runtime_to_blender(LAYOUT["fire"]["position"])
    for index, (offset, scale) in enumerate(
        (((-0.16, 0.02, 0.62), (0.22, 0.18, 0.58)), ((0.13, -0.04, 0.54), (0.18, 0.16, 0.48)))
    ):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2,
            radius=1.0,
            location=(fire_blender[0] + offset[0], fire_blender[1] + offset[1], offset[2]),
        )
        flame = bpy.context.object
        flame.name = f"QA_CampsiteFlame_{index + 1}"
        flame.scale = scale
        flame.data.materials.append(flame_material)

    light_data = bpy.data.lights.new("QA_CampsiteFireLight", "POINT")
    light_data.energy = 900.0
    light_data.color = (1.0, 0.21, 0.045)
    light_data.shadow_soft_size = 2.4
    light = bpy.data.objects.new("QA_CampsiteFireLight", light_data)
    light.location = (fire_blender[0], fire_blender[1], 1.7)
    bpy.context.scene.collection.objects.link(light)

    fill_data = bpy.data.lights.new("QA_CampsiteMoonFill", "AREA")
    fill_data.energy = 780.0
    fill_data.color = (0.20, 0.34, 0.50)
    fill_data.shape = "DISK"
    fill_data.size = 18.0
    fill = bpy.data.objects.new("QA_CampsiteMoonFill", fill_data)
    fill.location = (-2.0, -7.0, 14.0)
    aim_at(fill, (18.0, -4.0, 0.0))
    bpy.context.scene.collection.objects.link(fill)

    camera_data = bpy.data.cameras.new("QA_CampsiteCamera")
    camera = bpy.data.objects.new("QA_CampsiteCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def render_review(camera):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.003, 0.007, 0.012)

    fire_x, fire_runtime_z = map(float, LAYOUT["fire"]["position"])
    fire_y = -fire_runtime_z
    shelf_center_x = fire_x + 2.5
    shelf_center_y = fire_y - 2.5

    camera.data.type = "PERSP"
    camera.data.lens = 50
    camera.location = (fire_x - 10.5, fire_y - 21.0, 8.6)
    aim_at(camera, (fire_x + 1.0, fire_y - 2.5, 0.8))
    scene.render.filepath = QA_PATHS["hero"]
    bpy.ops.render.render(write_still=True)

    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 25.0
    camera.location = (shelf_center_x, shelf_center_y, 32.0)
    aim_at(camera, (shelf_center_x, shelf_center_y, 0.0))
    scene.render.filepath = QA_PATHS["plan"]
    bpy.ops.render.render(write_still=True)


def build():
    clear_scene()
    role_counts, item_ids, source_metrics = build_production_geometry()
    metrics = validate_layout(role_counts, item_ids, source_metrics)
    camera = add_review_scene()
    render_review(camera)
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(json.dumps(metrics, indent=2))
    print(f"Saved Forest campsite: {BLEND_PATH}")
    for path in QA_PATHS.values():
        print(f"Saved QA render: {path}")


build()
