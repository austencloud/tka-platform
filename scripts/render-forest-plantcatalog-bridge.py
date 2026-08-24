"""Render fixed neutral qualification views for PlantCatalog bridge candidates."""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / os.environ.get(
    "TKA_PLANT_BRIDGE_MANIFEST", "scripts/forest-plantcatalog-bridge.json"
)
MANIFEST = json.loads(
    MANIFEST_PATH.read_text(encoding="utf-8")
)
EVIDENCE_ROOT = ROOT / MANIFEST["paths"]["evidenceRoot"]


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for block in list(datablocks):
            datablocks.remove(block)


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.95):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    return result


def aim_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name: str, location: tuple, energy: float, size: float, color: tuple, target: Vector):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)
    return light


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def bounds(objects) -> tuple[Vector, Vector]:
    points = []
    for obj in mesh_objects(objects):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("Candidate contains no mesh geometry")
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def enter_silhouette(objects):
    """Darken every material in place, KEEPING its alpha mask wired.

    Swapping the whole material out for an opaque black one is the obvious way to
    do this and it produces a false picture: the foliage is alpha-masked cards, so
    an opaque replacement renders each card as a solid rectangle and the canopy
    reads as blobs. The silhouette is the one view whose entire job is the tree's
    true outline, so it has to keep the cutout and change only the shading.
    """
    state = []
    seen = set()
    for obj in mesh_objects(objects):
        for source in obj.data.materials:
            if source is None or source.name in seen or source.node_tree is None:
                continue
            seen.add(source.name)
            bsdf = source.node_tree.nodes.get("Principled BSDF")
            if bsdf is None:
                continue
            base_color = bsdf.inputs.get("Base Color")
            link = base_color.links[0] if base_color.is_linked else None
            specular = bsdf.inputs.get("Specular IOR Level")
            record = {
                "tree": source.node_tree,
                "socket": base_color,
                "fromSocket": link.from_socket if link is not None else None,
                "baseColor": tuple(base_color.default_value),
                "roughness": bsdf.inputs["Roughness"].default_value,
                "specularInput": specular,
                "specular": specular.default_value if specular is not None else None,
            }
            if link is not None:
                source.node_tree.links.remove(link)
            base_color.default_value = (0.004, 0.005, 0.004, 1.0)
            bsdf.inputs["Roughness"].default_value = 1.0
            if specular is not None:
                specular.default_value = 0.0
            state.append(record)
    return state


def exit_silhouette(state) -> None:
    for record in state:
        record["socket"].default_value = record["baseColor"]
        if record["fromSocket"] is not None:
            record["tree"].links.new(record["fromSocket"], record["socket"])
        bsdf = record["tree"].nodes.get("Principled BSDF")
        if bsdf is not None:
            bsdf.inputs["Roughness"].default_value = record["roughness"]
        if record["specularInput"] is not None:
            record["specularInput"].default_value = record["specular"]


SUN_ELEVATION_DEGREES = 54.0
SUN_AZIMUTH_DEGREES = -35.0


def setup_scene(width: float, height: float):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"

    # Foliage is alpha-masked and EEVEE resolves that dithered, across temporal
    # samples. At the default sample count the cutout never converges and a dense
    # canopy renders as blotchy mush -- which is exactly what the first canopy view
    # looked like. Samples are the fix, not a material change.
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 128
        if hasattr(scene.eevee, "use_raytracing"):
            scene.eevee.use_raytracing = True

    # These trees have to hold up in summer daylight, so they are qualified in
    # summer daylight: a physical sky for skylight and bounce colour, plus a single
    # sun. The previous three-point rig at world strength 0.24 was studio lighting
    # for a night scene, and it underexposed every view badly enough that leaf
    # colour could not be judged at all.
    looks = {item.identifier for item in scene.view_settings.bl_rna.properties["look"].enum_items}
    for candidate_look in ("AgX - Medium High Contrast", "AgX - Base Contrast", "None"):
        if candidate_look in looks:
            scene.view_settings.look = candidate_look
            break
    scene.view_settings.exposure = 0.0
    world = bpy.data.worlds.new("PlantCatalog Qualification World")
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    sky = nodes.new("ShaderNodeTexSky")
    # Blender 5.0 split the old NISHITA model into explicit scattering modes;
    # MULTIPLE_SCATTERING is its higher-quality successor. Fall back rather than
    # crash if this runs on a build with a different set.
    sky_types = {item.identifier for item in sky.bl_rna.properties["sky_type"].enum_items}
    for candidate_type in ("MULTIPLE_SCATTERING", "NISHITA", "HOSEK_WILKIE"):
        if candidate_type in sky_types:
            sky.sky_type = candidate_type
            break
    sky.sun_elevation = math.radians(SUN_ELEVATION_DEGREES)
    sky.sun_rotation = math.radians(SUN_AZIMUTH_DEGREES)
    if hasattr(sky, "dust_density"):
        sky.dust_density = 0.5
    # The sun disc belongs to the sun lamp below; drawing it here too double-lights
    # the canopy and blows out whichever view happens to face it.
    if hasattr(sky, "sun_disc"):
        sky.sun_disc = False
    background = nodes.new("ShaderNodeBackground")
    # Skylight is FILL. At full strength the sky dome out-lights the sun, which
    # flattens every shadow and turns the whole frame into pale haze -- the tree
    # loses its modelling and the foliage desaturates to grey-green.
    background.inputs["Strength"].default_value = 0.42
    world_output = nodes.new("ShaderNodeOutputWorld")
    links.new(sky.outputs["Color"], background.inputs["Color"])
    links.new(background.outputs["Background"], world_output.inputs["Surface"])
    scene.world = world

    # Large enough that its edge never enters frame. The old plane was 4x the tree
    # and its far edge cut a hard seam across the backdrop of every wide view.
    ground = material("PlantCatalog Neutral Ground", (0.115, 0.135, 0.085, 1.0), 1.0)
    bpy.ops.mesh.primitive_plane_add(size=max(width, height) * 60.0, location=(0, 0, -0.015))
    bpy.context.object.data.materials.append(ground)

    camera_data = bpy.data.cameras.new("PlantCatalog Qualification Camera")
    camera = bpy.data.objects.new("PlantCatalog Qualification Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    target = Vector((0.0, 0.0, height * 0.46))
    elevation = math.radians(SUN_ELEVATION_DEGREES)
    azimuth = math.radians(SUN_AZIMUTH_DEGREES)
    reach = max(width, height) * 3.0
    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 9.0
    sun_data.color = (1.0, 0.96, 0.9)
    sun_data.angle = math.radians(1.6)
    sun = bpy.data.objects.new("Sun", sun_data)
    scene.collection.objects.link(sun)
    sun.location = (
        reach * math.cos(elevation) * math.sin(azimuth),
        -reach * math.cos(elevation) * math.cos(azimuth),
        reach * math.sin(elevation),
    )
    aim_at(sun, target)
    # One soft fill from camera-left keeps the shaded side of the trunk readable
    # without pretending to be a second sun.
    add_area_light("Fill", (width * 1.1, -height * 0.35, height * 0.45), 260, height * 0.8, (0.68, 0.78, 1.0), target)
    return scene, camera


def render(scene, camera, root, output: Path, rotation: float, location: tuple, target: tuple, lens: float = 52.0):
    root.rotation_euler[2] = math.radians(rotation)
    camera.data.type = "PERSP"
    camera.data.lens = lens
    camera.location = location
    aim_at(camera, Vector(target))
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def render_job(job: dict) -> dict:
    clear_scene()
    # The proof GLB, not the runtime one. Blender has no meshopt importer, and
    # the two files hold identical geometry and materials -- the proof simply
    # stops short of the codec. Rendering the runtime file is not possible, and
    # rendering the pre-optimizer conditioned mesh would show a tree that is not
    # the one being shipped.
    candidate_path = (
        ROOT
        / MANIFEST["paths"]["candidateRoot"]
        / job["candidateFilename"].replace(".glb", "-proof.glb")
    )
    if not candidate_path.exists():
        raise FileNotFoundError("Optimized PlantCatalog candidate missing: {}".format(candidate_path))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(candidate_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = mesh_objects(imported)
    minimum, maximum = bounds(meshes)
    dimensions = maximum - minimum
    height = dimensions.z
    width = max(dimensions.x, dimensions.y)
    root = bpy.data.objects.new("PlantCatalog_Render_Root", None)
    bpy.context.scene.collection.objects.link(root)
    for obj in imported:
        if obj.parent is None:
            obj.parent = root
    scene, camera = setup_scene(width, height)
    prefix = EVIDENCE_ROOT / job["id"]
    EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
    distance = max(width * 1.55, height * 1.35)
    target = (0.0, 0.0, height * 0.48)
    render(scene, camera, root, prefix.with_name(prefix.name + "-front.png"), 0, (0, -distance, height * 0.48), target, 56)
    render(scene, camera, root, prefix.with_name(prefix.name + "-three-quarter.png"), 35, (0, -distance, height * 0.52), target, 56)
    silhouette_state = enter_silhouette(meshes)
    render(scene, camera, root, prefix.with_name(prefix.name + "-silhouette.png"), 73, (0, -distance, height * 0.5), target, 58)
    exit_silhouette(silhouette_state)
    render(scene, camera, root, prefix.with_name(prefix.name + "-human-height.png"), 24, (width * 0.45, -width * 0.85, 1.7), (0, 0, min(4.6, height * 0.3)), 48)
    render(scene, camera, root, prefix.with_name(prefix.name + "-bark-close.png"), 12, (width * 0.22, -width * 0.44, 2.2), (0, 0, min(2.8, height * 0.2)), 62)
    render(scene, camera, root, prefix.with_name(prefix.name + "-canopy.png"), 48, (width * 0.45, -width * 0.55, height * 1.32), (0, 0, height * 0.58), 52)
    return {
        "id": job["id"],
        "candidate": candidate_path.relative_to(ROOT).as_posix(),
        "dimensionsMetres": list(dimensions),
        "views": ["front", "three-quarter", "silhouette", "human-height", "bark-close", "canopy"],
    }


requested = [argument.split("=", 1)[1] for argument in sys.argv if argument.startswith("--job=")]
selected_ids = requested or MANIFEST["exportSets"][MANIFEST["activeExportSet"]]
jobs_by_id = {job["id"]: job for job in MANIFEST["jobs"]}
metrics = [render_job(jobs_by_id[job_id]) for job_id in selected_ids]
(EVIDENCE_ROOT / "plantcatalog-render-metrics.json").write_text(
    json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(metrics, indent=2))
