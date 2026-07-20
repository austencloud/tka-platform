"""Compose the Astral Reliquary stage in Blender.

Fourth pass (2026-07-19). Every Meshy-asset arrangement (five-asset complex,
then a lone arch) failed Austen's runtime review — sculpted organic assets do
not hold up under the orbiting camera, and the bright tiled regolith read as
concrete. Final direction: a dark minimal moonscape.

Near-black lunar plain with soft craters, the performance deck with amber
calibration marks and flush channels, and nothing else authored. Earth, the
nebula, starfield, god rays, and meteors carry the scene at runtime. No Meshy
assets ship; the raw GLBs stay on disk for a future human-directed pass.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils import noise


ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = ROOT / "blender" / "cosmic-reliquary.blend"
PREVIEW_DIR = ROOT / "blender" / "previews"
EXPORT_COLLECTION = "EXPORT_cosmic_reliquary"

# Runtime Earth sits at Three (-40, 2, -60) => Blender (-40, 60). The deck's
# main calibration channel points along this sight line.
EARTH_BLENDER = Vector((-40.0, 60.0))
SIGHT_ANGLE = math.atan2(EARTH_BLENDER.y, EARTH_BLENDER.x)  # ~123.7 degrees


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)


def collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def move_to_collection(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def principled_material(
    name: str,
    base_color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def terrain_material() -> bpy.types.Material:
    """Near-black regolith. The diffuse map is crushed almost to black so the
    runtime lights (hemisphere + directional + god rays) cannot wash it back
    to grey, and only subtle variation survives — no visible tiling."""
    material = bpy.data.materials.new("AR_LunarRegolith")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.012, 0.016, 0.03, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.92

    texture_root = ROOT / "static" / "textures" / "terrain" / "rock"
    diffuse_image = bpy.data.images.load(
        str(texture_root / "diffuse.jpg"), check_existing=True
    )
    diffuse_image.colorspace_settings.name = "sRGB"
    diffuse_texture = nodes.new("ShaderNodeTexImage")
    diffuse_texture.image = diffuse_image
    diffuse_texture.extension = "REPEAT"
    crush = nodes.new("ShaderNodeHueSaturation")
    crush.inputs["Saturation"].default_value = 0.45
    crush.inputs["Value"].default_value = 0.14
    links.new(diffuse_texture.outputs["Color"], crush.inputs["Color"])
    links.new(crush.outputs["Color"], bsdf.inputs["Base Color"])

    roughness_image = bpy.data.images.load(
        str(texture_root / "roughness.jpg"), check_existing=True
    )
    roughness_image.colorspace_settings.name = "Non-Color"
    roughness_texture = nodes.new("ShaderNodeTexImage")
    roughness_texture.image = roughness_image
    roughness_texture.extension = "REPEAT"
    links.new(roughness_texture.outputs["Color"], bsdf.inputs["Roughness"])

    normal_image = bpy.data.images.load(
        str(texture_root / "normal.jpg"), check_existing=True
    )
    normal_image.colorspace_settings.name = "Non-Color"
    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.image = normal_image
    normal_texture.extension = "REPEAT"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 1.3
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def terrain_height(x: float, y: float) -> float:
    """Quiet lunar plain: flat socket, gentle swells, a few soft craters."""
    radius = math.hypot(x, y)
    if radius <= 5.25:
        return 0.0

    broad = noise.fractal(Vector((x * 0.045, y * 0.045, 0.7)), 1.0, 2.0, 4)
    detail = noise.fractal(Vector((x * 0.16, y * 0.16, 3.1)), 0.8, 2.2, 3)
    height = broad * 0.5 + detail * 0.12

    craters = (
        (13.0, 11.0, 4.8, 1.0),
        (-17.0, 9.0, 6.2, 0.85),
        (11.0, -17.0, 5.1, 0.75),
        (-10.0, -21.0, 3.8, 0.55),
        (21.0, 3.0, 4.6, 0.6),
    )
    for cx, cy, crater_radius, depth in craters:
        distance = math.hypot(x - cx, y - cy)
        bowl = math.exp(-((distance / (crater_radius * 0.72)) ** 2))
        rim = math.exp(-(((distance - crater_radius) / 0.75) ** 2))
        height += -depth * bowl + depth * 0.28 * rim

    horizon = smoothstep(24.0, 33.0, radius)
    height += horizon * (0.45 + 0.7 * math.sin(math.atan2(y, x) * 5.0 + 0.4))
    return height * smoothstep(5.25, 8.0, radius)


def create_terrain(target: bpy.types.Collection, material: bpy.types.Material) -> bpy.types.Object:
    radial_segments = 76
    angular_segments = 192
    radius = 34.0
    vertices = [(0.0, 0.0, 0.0)]
    for ring in range(1, radial_segments + 1):
        ring_radius = radius * ring / radial_segments
        for segment in range(angular_segments):
            angle = math.tau * segment / angular_segments
            x = math.cos(angle) * ring_radius
            y = math.sin(angle) * ring_radius
            vertices.append((x, y, terrain_height(x, y)))

    faces = []
    for segment in range(angular_segments):
        current = 1 + segment
        following = 1 + (segment + 1) % angular_segments
        faces.append((0, current, following))
    for ring in range(1, radial_segments):
        current_start = 1 + (ring - 1) * angular_segments
        next_start = current_start + angular_segments
        for segment in range(angular_segments):
            following = (segment + 1) % angular_segments
            faces.append(
                (
                    current_start + segment,
                    next_start + segment,
                    next_start + following,
                    current_start + following,
                )
            )

    mesh = bpy.data.meshes.new("AR_TerrainMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    terrain = bpy.data.objects.new("AR_Terrain", mesh)
    target.objects.link(terrain)
    terrain.data.materials.append(material)

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            coordinate = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv_layer.data[loop_index].uv = (coordinate.x / 9.0, coordinate.y / 9.0)
    return terrain


def polar(radius: float, angle_degrees: float) -> tuple[float, float]:
    angle = math.radians(angle_degrees)
    return (math.cos(angle) * radius, math.sin(angle) * radius)


def add_block(
    target: bpy.types.Collection,
    name: str,
    material: bpy.types.Material,
    location: tuple[float, float, float],
    half_extents: tuple[float, float, float],
    rotation_degrees: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, scale=half_extents)
    block = bpy.context.object
    block.name = name
    block.rotation_euler = tuple(math.radians(v) for v in rotation_degrees)
    block.data.materials.append(material)
    move_to_collection(block, target)
    return block


def create_precision_dais(
    target: bpy.types.Collection,
    stone: bpy.types.Material,
    metal: bpy.types.Material,
    amber: bpy.types.Material,
) -> None:
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=4.05, depth=0.4, location=(0, 0, 0.2))
    deck = bpy.context.object
    deck.name = "AR_PerformanceDeck"
    deck.data.materials.append(stone)
    move_to_collection(deck, target)

    for radius, material, minor_radius in (
        (4.22, metal, 0.09),
        (4.48, metal, 0.045),
        (4.92, metal, 0.07),
    ):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius,
            minor_radius=minor_radius,
            major_segments=128,
            minor_segments=12,
            location=(0, 0, 0.43),
        )
        ring = bpy.context.object
        ring.name = f"AR_ActuatorRing_{radius:.2f}"
        ring.data.materials.append(material)
        move_to_collection(ring, target)

    # Twelve calibration marks; only every third one is a lit amber mark so
    # emission stays scarce.
    for index in range(12):
        angle = math.tau * index / 12
        radius = 4.7
        bpy.ops.mesh.primitive_cube_add(
            location=(math.cos(angle) * radius, math.sin(angle) * radius, 0.44),
            scale=(0.34, 0.035, 0.025),
        )
        inlay = bpy.context.object
        inlay.name = f"AR_CalibrationMark_{index:02d}"
        inlay.rotation_euler.z = angle + math.pi / 2
        inlay.data.materials.append(amber if index % 3 == 0 else metal)
        move_to_collection(inlay, target)


def create_deck_channels(target: bpy.types.Collection, amber: bpy.types.Material) -> None:
    """Three flush calibration channels running out from under the deck rim."""
    for label, angle_degrees, inner, outer in (
        ("route", math.degrees(SIGHT_ANGLE), 4.15, 5.9),
        ("east", 20.0, 4.15, 6.2),
        ("south", 262.0, 4.15, 5.7),
    ):
        mid = (inner + outer) / 2
        cx, cy = polar(mid, angle_degrees)
        inner_z = terrain_height(*polar(inner, angle_degrees))
        outer_z = terrain_height(*polar(outer, angle_degrees))
        # Follow the ground: pitch the strip along the local slope so neither
        # end floats when the apron starts rising past the socket edge.
        pitch = -math.degrees(math.atan2(outer_z - inner_z, outer - inner))
        add_block(
            target,
            f"AR_Channel_{label}",
            amber,
            (cx, cy, (inner_z + outer_z) / 2 + 0.004),
            ((outer - inner) / 2, 0.07, 0.026),
            (0, pitch, angle_degrees),
        )


def look_at(obj: bpy.types.Object, point: tuple[float, float, float]) -> None:
    direction = Vector(point) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def preview_material(name: str, color: tuple[float, float, float, float], strength: float):
    return principled_material(name, color, 0.22, emission=color, emission_strength=strength)


def create_preview_world(preview: bpy.types.Collection) -> bpy.types.Object:
    world = bpy.context.scene.world or bpy.data.worlds.new("AR_World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0015, 0.003, 0.012, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.08

    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=7.5, location=(-40, 60, 2))
    earth = bpy.context.object
    earth.name = "PREVIEW_Earth"
    earth.data.materials.append(preview_material("PREVIEW_EarthMat", (0.03, 0.23, 0.8, 1), 2.8))
    move_to_collection(earth, preview)

    lights = (
        ("AREA", (-14, -12, 22), (0.32, 0.5, 1.0), 1700, 10.0),
        ("AREA", (16, 10, 13), (0.38, 0.34, 1.0), 1200, 8.0),
        ("AREA", (-8, 4, 16), (0.16, 0.42, 1.0), 1500, 7.0),
        ("POINT", (0, 0, 6), (0.05, 0.55, 1.0), 600, 0.0),
    )
    for index, (light_type, location, color, energy, size) in enumerate(lights):
        data = bpy.data.lights.new(f"PREVIEW_LightData_{index}", light_type)
        data.color = color
        data.energy = energy
        if light_type == "AREA":
            data.shape = "DISK"
            data.size = size
        obj = bpy.data.objects.new(f"PREVIEW_Light_{index}", data)
        obj.location = location
        preview.objects.link(obj)
        look_at(obj, (0, 0, 2.5))

    camera_data = bpy.data.cameras.new("PREVIEW_CameraData")
    camera_data.lens = 34
    camera = bpy.data.objects.new("PREVIEW_Camera", camera_data)
    preview.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def render_previews(camera: bpy.types.Object) -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"

    views = {
        "front": ((20, -30, 15), (0, 4, 2.8), 34),
        "quarter": ((29, -9, 18), (0, 4, 3.0), 38),
        "side": ((-29, -4, 14), (0, 4, 2.8), 38),
        "top": ((0, -0.01, 54), (0, 0, 0), 44),
        "route": ((7.5, -10.5, 4.2), (-12.0, 18.0, 2.5), 30),
    }
    for name, (location, target, lens) in views.items():
        camera.location = location
        camera.data.lens = lens
        look_at(camera, target)
        scene.render.filepath = str(PREVIEW_DIR / f"cosmic-reliquary-{name}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    clear_scene()
    export = collection(EXPORT_COLLECTION)
    preview = collection("PREVIEW_not_exported")

    regolith = terrain_material()
    basalt = principled_material("AR_DarkBasalt", (0.016, 0.021, 0.034, 1), 0.82)
    metal = principled_material("AR_TarnishedMetal", (0.30, 0.32, 0.35, 1), 0.42, metallic=0.85)
    amber = principled_material(
        "AR_AmberMark",
        (0.25, 0.14, 0.03, 1),
        0.3,
        emission=(1.0, 0.52, 0.08, 1),
        emission_strength=2.0,
    )

    create_terrain(export, regolith)
    create_precision_dais(export, basalt, metal, amber)
    create_deck_channels(export, amber)

    camera = create_preview_world(preview)
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    render_previews(camera)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"COSMIC_RELIQUARY_BLEND={BLEND_PATH}")


if __name__ == "__main__":
    main()
