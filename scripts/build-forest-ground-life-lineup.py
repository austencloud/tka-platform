"""Render the Forest Gate 6 ground-life candidates at shipping scale.

Each candidate comes from the versioned lineup contract, is normalized to its
authored target height, and is rendered from front, three-quarter, overhead,
and silhouette views beside a one-metre quartered scale post. No candidate is
placed in the Forest environment by this review rig.
"""

import hashlib
import json
import math
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "scripts" / "forest-ground-life-lineup.json"
BLEND_PATH = ROOT / "blender" / "forest_ground_life_lineup.blend"
EVIDENCE_DIR = Path(tempfile.gettempdir()) / "tka-forest-evidence" / "ground-life-lineup"
METRICS_PATH = EVIDENCE_DIR / "forest_ground_life_lineup_metrics.json"

CONTRACT_BYTES = MANIFEST_PATH.read_bytes()
CONTRACT = json.loads(CONTRACT_BYTES)
VIEWS = tuple(CONTRACT["reviewViews"])


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def make_material(name, color, roughness=0.8):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def add_area_light(name, location, energy, size, color, target):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light_data.color = color
    light = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)


def setup_stage():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.4

    world = bpy.data.worlds.new("Forest Ground-Life Review World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.025, 0.021, 1.0)
    background.inputs["Strength"].default_value = 0.4
    scene.world = world

    ground_material = make_material("Review Ground", (0.055, 0.083, 0.064), 0.96)
    scale_light = make_material("Scale Light", (0.76, 0.72, 0.62), 0.8)
    scale_dark = make_material("Scale Dark", (0.16, 0.23, 0.18), 0.88)
    silhouette = make_material("Ground-Life Silhouette", (0.006, 0.010, 0.008), 0.94)
    silhouette.use_fake_user = True

    bpy.ops.mesh.primitive_plane_add(size=12, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "Review Ground"
    ground.data.materials.append(ground_material)

    camera_data = bpy.data.cameras.new("Ground-Life Lineup Camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("Ground-Life Lineup Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    add_area_light("Review Key", (-3.5, -4.5, 5.0), 850, 4.0, (0.82, 0.93, 1.0), (0, 0, 0.5))
    add_area_light("Review Fill", (4.0, -1.0, 3.5), 620, 3.5, (0.58, 0.76, 0.63), (0, 0, 0.4))
    add_area_light("Review Rim", (1.0, 4.0, 4.5), 900, 3.0, (0.64, 0.85, 1.0), (0, 0, 0.5))
    return scene, camera, silhouette, scale_light, scale_dark


def imported_objects(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    created = [obj for obj in bpy.data.objects if obj not in before]
    if not created:
        raise RuntimeError(f"Import created no objects: {path}")
    return created


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def object_bounds(objects):
    corners = []
    for obj in mesh_objects(objects):
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not corners:
        raise RuntimeError("Candidate contains no mesh geometry")
    minimum = Vector(tuple(min(point[index] for point in corners) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in corners) for index in range(3)))
    return minimum, maximum


def normalize_candidate(objects, candidate):
    root = bpy.data.objects.new(f"{candidate['id']}_Review_Root", None)
    bpy.context.scene.collection.objects.link(root)
    object_set = set(objects)
    for obj in objects:
        if obj.parent not in object_set:
            world_matrix = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world_matrix

    minimum, maximum = object_bounds(objects)
    dimensions = maximum - minimum
    if dimensions.z <= 0.001:
        raise RuntimeError(f"Candidate {candidate['id']} has zero height")
    target_height = float(candidate["targetHeightMetres"])
    scale = target_height / dimensions.z
    root.scale = (scale, scale, scale)
    root.location = (
        -((minimum.x + maximum.x) * 0.5) * scale,
        -((minimum.y + maximum.y) * 0.5) * scale,
        -minimum.z * scale,
    )
    bpy.context.view_layer.update()
    scaled_width = max(dimensions.x, dimensions.y) * scale
    return root, dimensions, scale, scaled_width


def add_scale_post(x, scale_light, scale_dark):
    objects = []
    for index in range(4):
        bpy.ops.mesh.primitive_cube_add(
            location=(x, 0.0, index * 0.25 + 0.125),
            scale=(0.045, 0.045, 0.125),
        )
        segment = bpy.context.object
        segment.name = f"Scale_Post_{index + 1}"
        segment.data.materials.append(scale_light if index % 2 == 0 else scale_dark)
        objects.append(segment)
    return objects


def candidate_metrics(candidate, path, objects, dimensions, scale):
    meshes = mesh_objects(objects)
    triangles = 0
    materials = set()
    images = set()
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        for material in obj.data.materials:
            if material is None:
                continue
            materials.add(material.name)
            if material.use_nodes:
                for node in material.node_tree.nodes:
                    image = getattr(node, "image", None)
                    if image is not None:
                        images.add(image.name)
    source_paths = [path]
    if candidate["source"]["kind"] == "r2-gltf":
        source_paths.extend(path.parent / Path(url).name for url in candidate["source"].get("dependencies", []))
    return {
        "id": candidate["id"],
        "label": candidate["label"],
        "family": candidate["family"],
        "roles": candidate["roles"],
        "targetHeightMetres": float(candidate["targetHeightMetres"]),
        "sourcePath": str(path),
        "sourceBytes": sum(item.stat().st_size for item in set(source_paths) if item.is_file()),
        "meshCount": len(meshes),
        "triangles": triangles,
        "materials": len(materials),
        "images": len(images),
        "sourceDimensions": list(dimensions),
        "reviewScale": scale,
    }


def set_silhouette(objects, material):
    originals = []
    for obj in mesh_objects(objects):
        slots = list(obj.data.materials)
        originals.append((obj, slots))
        obj.data.materials.clear()
        obj.data.materials.append(material)
    return originals


def restore_materials(originals):
    for obj, materials in originals:
        obj.data.materials.clear()
        for material in materials:
            obj.data.materials.append(material)


def configure_camera(camera, view, frame_size, target_height):
    camera.data.ortho_scale = frame_size
    if view == "overhead":
        camera.location = (0.0, 0.0, 8.0)
        aim_at(camera, (0.0, 0.0, 0.0))
    else:
        camera.location = (0.0, -6.0, max(0.65, target_height * 0.55))
        aim_at(camera, (0.0, 0.0, target_height * 0.42))


def render_candidate(scene, camera, candidate, path, silhouette, scale_light, scale_dark):
    objects = imported_objects(path)
    root, dimensions, scale, scaled_width = normalize_candidate(objects, candidate)
    target_height = float(candidate["targetHeightMetres"])
    frame_size = max(2.0, target_height * 1.55, scaled_width * 1.35)
    scale_post = add_scale_post(-(scaled_width * 0.5 + 0.22), scale_light, scale_dark)
    metric = candidate_metrics(candidate, path, objects, dimensions, scale)
    renders = {}

    for view in VIEWS:
        root.rotation_euler[2] = math.radians(45 if view == "three-quarter" else 0)
        originals = set_silhouette(objects, silhouette) if view == "silhouette" else None
        configure_camera(camera, view, frame_size, target_height)
        output = EVIDENCE_DIR / f"{candidate['id']}_{view}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        renders[view] = str(output)
        if originals is not None:
            restore_materials(originals)

    metric["renders"] = renders
    for obj in [*objects, root, *scale_post]:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    return metric


reset_scene()
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
scene, camera, silhouette, scale_light, scale_dark = setup_stage()
metrics = []
for candidate in CONTRACT["candidates"]:
    source_path = ROOT / candidate["source"]["localPath"]
    if not source_path.is_file():
        raise RuntimeError(f"Missing lineup source: {source_path}")
    metrics.append(
        render_candidate(
            scene,
            camera,
            candidate,
            source_path,
            silhouette,
            scale_light,
            scale_dark,
        )
    )

payload = {
    "contractVersion": CONTRACT["version"],
    "contractSha256": hashlib.sha256(CONTRACT_BYTES).hexdigest(),
    "views": list(VIEWS),
    "candidates": metrics,
}
METRICS_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
print(json.dumps({"blend": str(BLEND_PATH), "metrics": str(METRICS_PATH), "candidates": len(metrics)}, indent=2))
