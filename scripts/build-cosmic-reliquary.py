"""Compose the Astral Reliquary in Blender from Meshy-authored prototypes.

Second pass (2026-07-19). The first pass placed five assets in four quadrants
around the stage; this pass builds one lunar observatory complex:

- Three elevation zones: flat performance socket, a raised fractured terrace
  around the lens (on the Earth sight line), and a crater basin opposite.
- A crescent of connected ruins across ~120 degrees (arch -> pavilion ->
  orrery) tied together with broken retaining walls and fallen columns.
- One readable route from the performance deck up broken stairs to the lens.
- The arch sunk and tilted into the terrace so it reads as excavated
  machinery, with a broken metal ring rib reaching toward the stage.
- Meshy materials graded toward one palette: near-black basalt, tarnished
  pale metal, sparse moon ice, and very limited amber calibration marks.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from mathutils import noise


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "static" / "models" / "cosmic" / "reliquary"
BLEND_PATH = ROOT / "blender" / "cosmic-reliquary.blend"
PREVIEW_DIR = ROOT / "blender" / "previews"
EXPORT_COLLECTION = "EXPORT_cosmic_reliquary"

# Runtime Earth sits at Three (-40, 2, -60) => Blender (-40, 60). Everything on
# this sight line frames Earth through the lens from the stage.
EARTH_BLENDER = Vector((-40.0, 60.0))
SIGHT_ANGLE = math.atan2(EARTH_BLENDER.y, EARTH_BLENDER.x)  # ~123.7 degrees

RNG = random.Random(20260719)


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
    material = bpy.data.materials.new("AR_LunarRegolith")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.025, 0.035, 0.06, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.88

    texture_specs = (
        ("diffuse.jpg", "Base Color", "sRGB"),
        ("roughness.jpg", "Roughness", "Non-Color"),
    )
    texture_root = ROOT / "static" / "textures" / "terrain" / "rock"
    for filename, socket, color_space in texture_specs:
        image = bpy.data.images.load(str(texture_root / filename), check_existing=True)
        image.colorspace_settings.name = color_space
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        texture.extension = "REPEAT"
        links.new(texture.outputs["Color"], bsdf.inputs[socket])

    normal_image = bpy.data.images.load(
        str(texture_root / "normal.jpg"), check_existing=True
    )
    normal_image.colorspace_settings.name = "Non-Color"
    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.image = normal_image
    normal_texture.extension = "REPEAT"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 1.15
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def angular_distance(a: float, b: float) -> float:
    difference = (a - b + math.pi) % math.tau - math.pi
    return abs(difference)


def terrain_height(x: float, y: float) -> float:
    """Three zones: flat socket, raised lens terrace, crater basin opposite."""
    radius = math.hypot(x, y)
    if radius <= 5.25:
        return 0.0

    broad = noise.fractal(Vector((x * 0.055, y * 0.055, 0.7)), 1.0, 2.0, 4)
    detail = noise.fractal(Vector((x * 0.16, y * 0.16, 3.1)), 0.8, 2.2, 3)
    height = broad * 0.58 + detail * 0.18

    # Raised observatory terrace around the Earth sight line. Full strength
    # inside +-45 degrees of the line, gone by +-85, rising radially from the
    # socket apron and relaxing again toward the horizon.
    span = angular_distance(math.atan2(y, x), SIGHT_ANGLE)
    sector = smoothstep(math.radians(85.0), math.radians(45.0), span)
    radial = smoothstep(7.2, 10.6, radius) * (1.0 - smoothstep(19.0, 25.0, radius))
    fracture = noise.fractal(Vector((x * 0.34, y * 0.34, 7.7)), 0.9, 2.1, 2)
    height += sector * radial * (1.85 + fracture * 0.38)

    # Crater basin on the opposite side so the stage sits between machinery
    # above and a dead excavation below.
    basin_distance = math.hypot(x - 9.5, y + 12.5)
    bowl = math.exp(-((basin_distance / 7.0) ** 2))
    basin_rim = math.exp(-(((basin_distance - 7.0) / 1.7) ** 2))
    height += -1.75 * bowl + 0.42 * basin_rim

    # Two distant impact craters keep the far field from reading flat.
    for cx, cy, crater_radius, depth in ((-17.0, -14.0, 5.4, 0.9), (21.0, 3.0, 4.6, 0.75)):
        distance = math.hypot(x - cx, y - cy)
        crater_bowl = math.exp(-((distance / (crater_radius * 0.72)) ** 2))
        rim = math.exp(-(((distance - crater_radius) / 0.75) ** 2))
        height += -depth * crater_bowl + depth * 0.28 * rim

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
            uv_layer.data[loop_index].uv = (coordinate.x / 4.0, coordinate.y / 4.0)
    return terrain


def polar(radius: float, angle_degrees: float) -> tuple[float, float]:
    angle = math.radians(angle_degrees)
    return (math.cos(angle) * radius, math.sin(angle) * radius)


def grade_asset(obj: bpy.types.Object, saturation: float, value: float, emission_cap: float) -> None:
    """Pull a Meshy asset's baked palette toward basalt/pale-metal/ice."""
    for slot in obj.material_slots:
        material = slot.material
        if material is None or not material.use_nodes or material.get("AR_graded"):
            continue
        material["AR_graded"] = True
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        bsdf = nodes.get("Principled BSDF")
        if bsdf is None:
            bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue

        base_input = bsdf.inputs["Base Color"]
        if base_input.links:
            source = base_input.links[0].from_socket
            hsv = nodes.new("ShaderNodeHueSaturation")
            hsv.inputs["Saturation"].default_value = saturation
            hsv.inputs["Value"].default_value = value
            links.new(source, hsv.inputs["Color"])
            links.new(hsv.outputs["Color"], base_input)
        else:
            color = list(base_input.default_value)
            grey = (color[0] + color[1] + color[2]) / 3.0
            base_input.default_value = (
                (grey + (color[0] - grey) * saturation) * value,
                (grey + (color[1] - grey) * saturation) * value,
                (grey + (color[2] - grey) * saturation) * value,
                color[3],
            )

        strength = bsdf.inputs["Emission Strength"]
        if not strength.links:
            strength.default_value = min(strength.default_value, emission_cap)


def import_asset(
    asset_id: str,
    target: bpy.types.Collection,
    *,
    width: float,
    height: float,
    location: tuple[float, float, float],
    rotation_degrees: float,
    tilt_degrees: float = 0.0,
    saturation: float = 0.45,
    value: float = 0.62,
    emission_cap: float = 0.7,
) -> bpy.types.Object:
    path = ASSET_DIR / f"{asset_id}_raw.glb"
    if not path.exists():
        raise FileNotFoundError(f"Missing Meshy source asset: {path}")

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if not imported:
        raise RuntimeError(f"No mesh objects imported from {path}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in imported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = imported[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = f"AR_{asset_id.replace('-', '_')}"
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bounds = [Vector(corner) for corner in result.bound_box]
    minimum = Vector((min(p.x for p in bounds), min(p.y for p in bounds), min(p.z for p in bounds)))
    maximum = Vector((max(p.x for p in bounds), max(p.y for p in bounds), max(p.z for p in bounds)))
    center = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
    result.data.transform(Matrix.Translation(-center))

    size = maximum - minimum
    horizontal_scale = width / max(size.x, size.y)
    vertical_scale = height / max(size.z, 0.001)
    result.scale = (horizontal_scale, horizontal_scale, vertical_scale)
    result.rotation_euler = (
        math.radians(tilt_degrees),
        0.0,
        math.radians(rotation_degrees),
    )
    result.location = location
    grade_asset(result, saturation, value, emission_cap)
    move_to_collection(result, target)
    return result


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


def add_tube(
    target: bpy.types.Collection,
    name: str,
    material: bpy.types.Material,
    location: tuple[float, float, float],
    radius: float,
    length: float,
    rotation_degrees: tuple[float, float, float],
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=length, location=location)
    tube = bpy.context.object
    tube.name = name
    tube.rotation_euler = tuple(math.radians(v) for v in rotation_degrees)
    tube.data.materials.append(material)
    move_to_collection(tube, target)
    return tube


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


def create_deck_anchors(
    target: bpy.types.Collection,
    basalt: bpy.types.Material,
    metal: bpy.types.Material,
    amber: bpy.types.Material,
) -> None:
    """Two asymmetrical actuator housings + channel cuts tie the deck to the site."""
    # Housing A: rectangular actuator at the route mouth, slightly off-axis.
    ax, ay = polar(4.95, 102.0)
    ground_a = terrain_height(ax, ay)
    add_block(target, "AR_ActuatorHousing_A", basalt, (ax, ay, ground_a + 0.26), (0.62, 0.46, 0.34), (0, 0, 102 + 90))
    add_block(target, "AR_ActuatorSlit_A", amber, (ax, ay, ground_a + 0.56), (0.4, 0.05, 0.03), (0, 0, 102 + 90))

    # Housing B: low cylindrical winch drum on the far side.
    bx, by = polar(4.8, 262.0)
    ground_b = terrain_height(bx, by)
    add_tube(target, "AR_ActuatorHousing_B", metal, (bx, by, ground_b + 0.28), 0.5, 0.62, (0, 0, 0))
    add_block(target, "AR_ActuatorSlit_B", amber, (bx, by, ground_b + 0.62), (0.3, 0.045, 0.025), (0, 0, 262))

    # Shallow calibration channels running out from under the deck rim.
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


def create_route(target: bpy.types.Collection, basalt: bpy.types.Material) -> None:
    """One readable path: pads across the apron, broken stairs up the terrace."""
    axis_degrees = math.degrees(SIGHT_ANGLE)
    for index, pad_radius in enumerate((5.15, 6.35, 7.5)):
        px, py = polar(pad_radius, axis_degrees + RNG.uniform(-2.5, 2.5))
        add_block(
            target,
            f"AR_RoutePad_{index}",
            basalt,
            (px, py, terrain_height(px, py) + 0.05),
            (0.82, 0.6, 0.1),
            (0, 0, axis_degrees + RNG.uniform(-14, 14)),
        )

    for index in range(7):
        step_radius = 8.3 + index * 0.42
        lateral = RNG.uniform(-0.14, 0.14)
        angle = axis_degrees + math.degrees(lateral / step_radius)
        sx, sy = polar(step_radius, angle)
        add_block(
            target,
            f"AR_Stair_{index}",
            basalt,
            (sx, sy, terrain_height(sx, sy) + 0.03),
            (0.86, 0.34, 0.26),
            (0, 0, axis_degrees + 90 + RNG.uniform(-6, 6)),
        )


def create_walls(target: bpy.types.Collection, basalt: bpy.types.Material) -> None:
    """Broken revetments that bind the crescent into one structure."""
    # Terrace lip revetment below the arch. The three segments nearest the
    # sight line are omitted: the stair route climbs through that breach.
    for index, angle_degrees in enumerate(range(96, 167, 7)):
        if angle_degrees in (117, 124, 131):
            continue
        wx, wy = polar(10.15, angle_degrees + RNG.uniform(-1.5, 1.5))
        wall_height = RNG.uniform(0.5, 1.05)
        add_block(
            target,
            f"AR_Revetment_{index}",
            basalt,
            (wx, wy, terrain_height(wx, wy) - 0.2),
            (1.05, 0.28, wall_height),
            (RNG.uniform(-4, 4), RNG.uniform(-3, 3), angle_degrees + 90),
        )
    # Two toppled revetment slabs at the terrace foot.
    for index, angle_degrees in enumerate((104.0, 138.0)):
        fx, fy = polar(9.05, angle_degrees)
        add_block(
            target,
            f"AR_RevetmentFallen_{index}",
            basalt,
            (fx, fy, terrain_height(fx, fy) + 0.16),
            (1.0, 0.26, 0.62),
            (78, 0, angle_degrees + 90 + RNG.uniform(-10, 10)),
        )

    # Ruined wall run linking the pavilion mass to the orrery and carrying
    # the crescent on toward its southeast tail.
    for index, angle_degrees in enumerate((50.0, 55.5, 61.0, 66.5, 72.0, 77.5, 83.0)):
        wx, wy = polar(13.7, angle_degrees + RNG.uniform(-1.0, 1.0))
        wall_height = RNG.uniform(0.4, 0.85)
        add_block(
            target,
            f"AR_LinkWall_{index}",
            basalt,
            (wx, wy, terrain_height(wx, wy) - 0.15),
            (1.15, 0.3, wall_height),
            (RNG.uniform(-4, 4), 0, angle_degrees + 90),
        )
    # Fallen columns between the masses.
    add_tube(target, "AR_FallenColumn_A", basalt, (5.2, 12.6, terrain_height(5.2, 12.6) + 0.24), 0.27, 3.1, (90, 0, 158))
    add_tube(target, "AR_FallenColumn_B", basalt, (12.4, 6.2, terrain_height(12.4, 6.2) + 0.22), 0.24, 2.6, (90, 0, 30))


def create_ring_rib(target: bpy.types.Collection, metal: bpy.types.Material) -> None:
    """A broken metal ring half-buried between the lens and the stage."""
    center = Vector((-2.9, 13.6))
    rib_radius = 3.6
    for index, angle_degrees in enumerate(range(196, 317, 24)):
        if index == 2:
            continue  # the break in the ring
        angle = math.radians(angle_degrees)
        px = center.x + math.cos(angle) * rib_radius
        py = center.y + math.sin(angle) * rib_radius
        add_tube(
            target,
            f"AR_RingRib_{index}",
            metal,
            (px, py, terrain_height(px, py) + 0.16),
            0.14,
            1.55,
            (90, 0, angle_degrees + 90),
        )
    # One snapped rib standing near the arch footing, leaning stageward.
    add_block(
        target,
        "AR_RingRib_Upright",
        metal,
        (-6.7, 10.4, terrain_height(-6.7, 10.4) + 0.9),
        (0.14, 0.14, 1.05),
        (-16, 0, math.degrees(SIGHT_ANGLE)),
    )


def make_rock_prototypes(basalt: bpy.types.Material) -> list[bpy.types.Object]:
    prototypes = []
    for index in range(3):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0, 0, -60 - index * 5))
        rock = bpy.context.object
        rock.name = f"AR_RockProto_{index}"
        seed_offset = Vector((index * 11.3, index * 7.9, index * 3.1))
        for vertex in rock.data.vertices:
            sample = noise.noise(vertex.co * 1.7 + seed_offset)
            vertex.co += vertex.co.normalized() * sample * 0.38
        squash = 0.62 + index * 0.12
        rock.data.transform(Matrix.Diagonal(Vector((1.0, 0.9 + index * 0.08, squash, 1.0))))
        rock.data.materials.append(basalt)
        prototypes.append(rock)
    return prototypes


def scatter_rubble(
    prototypes: list[bpy.types.Object],
    target: bpy.types.Collection,
    clusters: list[tuple[float, float, float, int, float, float]],
) -> None:
    """clusters: (x, y, ring_radius, count, min_scale, max_scale)."""
    instance_index = 0
    for cx, cy, ring_radius, count, min_scale, max_scale in clusters:
        for _ in range(count):
            angle = RNG.uniform(0, math.tau)
            distance = ring_radius * math.sqrt(RNG.uniform(0.35, 1.0))
            x = cx + math.cos(angle) * distance
            y = cy + math.sin(angle) * distance
            scale = RNG.uniform(min_scale, max_scale)
            prototype = prototypes[instance_index % len(prototypes)]
            rock = prototype.copy()
            rock.data = prototype.data
            rock.name = f"AR_Rubble_{instance_index:03d}"
            rock.location = (x, y, terrain_height(x, y) + scale * 0.22)
            rock.rotation_euler = (RNG.uniform(0, 0.5), RNG.uniform(0, 0.5), RNG.uniform(0, math.tau))
            rock.scale = (scale, scale, scale)
            target.objects.link(rock)
            instance_index += 1


def duplicate_linked(
    source: bpy.types.Object,
    target: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    rotation_degrees: float,
    scale: float,
) -> bpy.types.Object:
    duplicate = source.copy()
    duplicate.data = source.data
    duplicate.name = name
    duplicate.location = location
    duplicate.rotation_euler = (0.0, 0.0, math.radians(rotation_degrees))
    duplicate.scale = tuple(component * scale for component in source.scale)
    target.objects.link(duplicate)
    return duplicate


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
        "route": ((7.5, -10.5, 4.2), (-8.3, 12.5, 4.0), 30),
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
    create_deck_anchors(export, basalt, metal, amber)
    create_route(export, basalt)
    create_walls(export, basalt)
    create_ring_rib(export, metal)

    sight_degrees = math.degrees(SIGHT_ANGLE)

    # The lens: sunk into the terrace on the Earth sight line, tilted back so
    # the housing reads as excavated machinery rather than a standing portal.
    arch_x, arch_y = polar(15.0, sight_degrees)
    import_asset(
        "celestial-arch",
        export,
        width=13.0,
        height=13.2,
        location=(arch_x, arch_y, terrain_height(arch_x, arch_y) - 1.35),
        rotation_degrees=-18,
        tilt_degrees=-6,
        saturation=0.45,
        value=0.6,
        emission_cap=1.2,
    )

    # Foundation ring buried under the deck.
    import_asset(
        "reliquary-dais",
        export,
        width=9.8,
        height=0.6,
        location=(0, 0, -0.25),
        rotation_degrees=0,
        saturation=0.4,
        value=0.55,
        emission_cap=0.8,
    )

    # Secondary mass: pavilion and orrery clustered on the terrace flank,
    # linked to the arch and each other by the revetment walls.
    pavilion_x, pavilion_y = polar(14.0, 88.0)
    import_asset(
        "shattered-pavilion",
        export,
        width=9.0,
        height=5.0,
        location=(pavilion_x, pavilion_y, terrain_height(pavilion_x, pavilion_y) - 0.6),
        rotation_degrees=145,
        saturation=0.26,
        value=0.48,
        emission_cap=0.5,
    )
    orrery_x, orrery_y = polar(13.8, 45.0)
    import_asset(
        "ruined-orrery",
        export,
        width=7.5,
        height=6.2,
        location=(orrery_x, orrery_y, terrain_height(orrery_x, orrery_y) - 0.5),
        rotation_degrees=-35,
        saturation=0.2,
        value=0.68,
        emission_cap=0.5,
    )

    # Moon ice: one seam in the crater basin, one small outcrop on the
    # terrace, one shard at the basin rim. Sparse by design.
    fault = import_asset(
        "crystal-fault",
        export,
        width=6.0,
        height=2.7,
        location=(8.8, -11.2, terrain_height(8.8, -11.2) - 0.35),
        rotation_degrees=18,
        saturation=0.7,
        value=0.75,
        emission_cap=0.9,
    )
    duplicate_linked(
        fault, export, "AR_crystal_fault_B",
        (-12.8, 8.2, terrain_height(-12.8, 8.2) - 0.4), 118, 0.7,
    )
    duplicate_linked(
        fault, export, "AR_crystal_fault_C",
        (13.0, -7.6, terrain_height(13.0, -7.6) - 0.25), -68, 0.55,
    )

    # Rubble collars sink every mass into the terrain.
    prototypes = make_rock_prototypes(basalt)
    for prototype in prototypes:
        move_to_collection(prototype, preview)  # prototypes stay out of export
    scatter_rubble(
        prototypes,
        export,
        [
            (arch_x, arch_y, 5.6, 9, 0.4, 1.0),
            (pavilion_x, pavilion_y, 4.6, 6, 0.35, 0.8),
            (orrery_x, orrery_y, 4.0, 6, 0.3, 0.75),
            (8.8, -11.2, 3.6, 4, 0.3, 0.7),
            (polar(9.6, sight_degrees)[0], polar(9.6, sight_degrees)[1], 2.6, 6, 0.22, 0.5),
            (polar(10.2, 124)[0], polar(10.2, 124)[1], 5.0, 6, 0.3, 0.7),
            (13.0, -7.6, 2.4, 4, 0.25, 0.55),
            (-16.0, -2.0, 3.4, 4, 0.3, 0.8),
        ],
    )

    camera = create_preview_world(preview)
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    render_previews(camera)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"COSMIC_RELIQUARY_BLEND={BLEND_PATH}")


if __name__ == "__main__":
    main()
