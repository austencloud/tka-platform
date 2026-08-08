"""Build the authored terrain envelope for Moonlit Firefly Forest.

Phase 1 owns terrain form only. The existing runtime trees, rocks, bushes,
deadwood, camp, stage, particles, lighting, and sky stay outside this file.
Run with Blender 5.0 in background mode, then export with
``blender-export-forest-full.py``.
"""

import math
import os

import bpy
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "forest_environment.blend")
TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "forest-floor")
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
    )
}

CLEARING_RADIUS = 30.0
WORLD_RADIUS = 170.0
WORLD_SKIRT_START = 0.84
WORLD_SKIRT_DEPTH = 18.0
TERRAIN_ANGULAR_SEGMENTS = 192
TERRAIN_RADIAL_SEGMENTS = 128
TERRAIN_UV_METRES = 1.25


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


def terrain_boundary_radius(angle):
    """Return a deterministic, non-circular woodland boundary."""
    return (
        WORLD_RADIUS
        + 9.0 * math.sin(angle * 3.0 + 0.35)
        + 6.0 * math.sin(angle * 5.0 - 1.25)
        + 3.5 * math.cos(angle * 9.0 + 0.8)
    )


def terrain_mound(x, y, center_x, center_y, radius, height):
    distance = math.hypot(x - center_x, y - center_y)
    influence = 1.0 - smoothstep(radius * 0.18, radius, distance)
    return height * influence * influence


def terrain_height(x, y):
    radius = math.hypot(x, y)
    if radius <= CLEARING_RADIUS:
        return 0.0

    # The current Forest and Coven Hub both depend on a broad level clearing.
    # Woodland relief begins outside their maximum authored performance area.
    basin_rise = smoothstep(CLEARING_RADIUS, 64.0, radius) * 2.2
    bank_noise = smoothstep(CLEARING_RADIUS, 42.0, radius) * (
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


def forest_floor_material():
    material = bpy.data.materials.new("Moonlit Forest Floor")
    material.use_nodes = True
    material.diffuse_color = (0.16, 0.23, 0.12, 1.0)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.16, 0.23, 0.12, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.94

    diffuse_path = os.path.join(TEXTURE_DIR, "diffuse.jpg")
    normal_path = os.path.join(TEXTURE_DIR, "normal.jpg")
    roughness_path = os.path.join(TEXTURE_DIR, "roughness.jpg")

    if os.path.isfile(diffuse_path):
        diffuse = nodes.new("ShaderNodeTexImage")
        diffuse.name = "Forest Floor Diffuse"
        diffuse.image = bpy.data.images.load(diffuse_path, check_existing=True)
        diffuse.image.colorspace_settings.name = "sRGB"
        links.new(diffuse.outputs["Color"], bsdf.inputs["Base Color"])

    if os.path.isfile(roughness_path):
        roughness = nodes.new("ShaderNodeTexImage")
        roughness.name = "Forest Floor Roughness"
        roughness.image = bpy.data.images.load(roughness_path, check_existing=True)
        roughness.image.colorspace_settings.name = "Non-Color"
        links.new(roughness.outputs["Color"], bsdf.inputs["Roughness"])

    if os.path.isfile(normal_path):
        normal = nodes.new("ShaderNodeTexImage")
        normal.name = "Forest Floor Normal"
        normal.image = bpy.data.images.load(normal_path, check_existing=True)
        normal.image.colorspace_settings.name = "Non-Color"
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = 0.72
        links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    return material


def create_terrain(material):
    vertices = [(0.0, 0.0, terrain_height(0.0, 0.0))]
    faces = []
    uvs = [(0.0, 0.0)]

    for ring in range(1, TERRAIN_RADIAL_SEGMENTS + 1):
        radial_fraction = ring / TERRAIN_RADIAL_SEGMENTS
        for segment in range(TERRAIN_ANGULAR_SEGMENTS):
            angle = math.tau * segment / TERRAIN_ANGULAR_SEGMENTS
            radius = terrain_boundary_radius(angle) * radial_fraction
            x = math.cos(angle) * radius
            y = math.sin(angle) * radius
            vertices.append((x, y, terrain_height(x, y)))
            uvs.append((x / TERRAIN_UV_METRES, y / TERRAIN_UV_METRES))

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

    uv_layer = mesh.uv_layers.new(name="Forest Floor UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]

    terrain = bpy.data.objects.new("Forest_Base_WoodlandBasin", mesh)
    bpy.context.collection.objects.link(terrain)
    terrain.data.materials.append(material)
    terrain["tka_role"] = "terrain"
    terrain["tka_phase"] = "world-envelope"
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
    camera.location = location
    camera.data.lens = lens
    aim_at(camera, target)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def setup_qa_render():
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
    camera_data.clip_end = 500.0
    camera = bpy.data.objects.new("QA_ForestCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    create_qa_performer()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    # Blender uses Z-up. These positions map to the runtime Y-up camera presets.
    render_qa_view(camera, (0.0, -31.0, 8.0), (0.0, 0.0, 2.0), QA_PATHS["hero"], 38)
    render_qa_view(camera, (0.0, 31.0, 9.0), (0.0, 0.0, 2.0), QA_PATHS["reverse"], 38)
    render_qa_view(camera, (0.0, -9.0, 2.2), (0.0, 0.0, 1.35), QA_PATHS["walk"], 31)
    render_qa_view(camera, (2.0, -20.0, 6.5), (16.0, -3.0, 5.5), QA_PATHS["trees"], 41)
    render_qa_view(camera, (1.0, -12.0, 3.1), (9.0, -2.0, 0.15), QA_PATHS["floor"], 41)
    render_qa_view(camera, (11.0, -11.0, 4.8), (5.5, 3.5, 1.1), QA_PATHS["camp"], 42)
    render_qa_view(camera, (-8.0, -12.0, 4.5), (0.0, 0.0, 1.0), QA_PATHS["stage"], 41)
    render_qa_view(camera, (0.0, -40.0, 52.0), (0.0, 0.0, 1.0), QA_PATHS["world"], 34)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


reset_scene()
terrain_material = forest_floor_material()
create_terrain(terrain_material)
verify_terrain()
setup_qa_render()

print("\nMoonlit Firefly Forest terrain authored")
print(f"Blend: {BLEND_PATH}")
for label, path in QA_PATHS.items():
    print(f"QA {label:8}: {path}")
