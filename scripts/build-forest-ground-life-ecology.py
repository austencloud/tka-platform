"""Build the revised Forest Gate 6 ecology vignette board.

The source plant models become silhouette families, while roots, moss, litter,
twigs, logs, and small mushroom stages are composed as modular ground systems.
Each eight-metre patch has a named ecological cause and deliberate negative
space. This script never writes the full Forest placement.
"""

import hashlib
import json
import math
import random
import tempfile
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / "scripts" / "forest-ground-life-ecology.json"
BLEND_PATH = ROOT / "blender" / "forest_ground_life_ecology_board.blend"
EVIDENCE_DIR = Path(tempfile.gettempdir()) / "tka-forest-evidence" / "ground-life-ecology"
METRICS_PATH = EVIDENCE_DIR / "forest_ground_life_ecology_metrics.json"

CONTRACT_BYTES = CONTRACT_PATH.read_bytes()
CONTRACT = json.loads(CONTRACT_BYTES)
PATCH_SIZE = float(CONTRACT["patchSizeMetres"])
SOURCE_BY_ID = {source["id"]: source for source in CONTRACT["sources"]}

PROTOTYPES = {}
VARIANTS = {}
MATERIALS = {}
LEAF_PROTOTYPES = []
MUSHROOM_PARTS = {}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.collections,
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablocks is bpy.data.collections and datablock.name == "Collection":
                continue
            datablocks.remove(datablock)


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def register_object(obj, collection, root):
    move_to_collection(obj, collection)
    if root is not None:
        obj.parent = root
    return obj


def make_noise_material(name, dark, light, roughness=0.88, scale=5.0, bump=0.16):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness

    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.68
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*dark, 1.0)
    ramp.color_ramp.elements[1].color = (*light, 1.0)
    bump_node = nodes.new("ShaderNodeBump")
    bump_node.inputs["Strength"].default_value = bump
    bump_node.inputs["Distance"].default_value = 0.11
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def make_flat_material(name, color, roughness=0.9):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def setup_materials():
    MATERIALS.update(
        {
            "duff": make_noise_material(
                "Forest Ecology Leaf Duff",
                (0.032, 0.02, 0.01),
                (0.11, 0.067, 0.027),
                0.96,
                7.5,
                0.2,
            ),
            "damp": make_noise_material(
                "Forest Ecology Damp Soil",
                (0.025, 0.026, 0.018),
                (0.075, 0.082, 0.052),
                0.9,
                8.5,
                0.24,
            ),
            "path": make_noise_material(
                "Forest Ecology Compacted Path",
                (0.055, 0.041, 0.023),
                (0.14, 0.105, 0.052),
                0.98,
                11.0,
                0.12,
            ),
            "moss": make_noise_material(
                "Forest Ecology Moss",
                (0.012, 0.045, 0.018),
                (0.055, 0.17, 0.035),
                0.99,
                6.0,
                0.3,
            ),
            "bark": make_noise_material(
                "Forest Ecology Bark",
                (0.055, 0.032, 0.016),
                (0.23, 0.13, 0.056),
                0.94,
                9.0,
                0.34,
            ),
            "pale-bark": make_noise_material(
                "Forest Ecology Pale Bark",
                (0.13, 0.12, 0.09),
                (0.38, 0.34, 0.25),
                0.94,
                12.0,
                0.28,
            ),
            "twig": make_noise_material(
                "Forest Ecology Twig",
                (0.045, 0.026, 0.012),
                (0.16, 0.085, 0.032),
                0.96,
                13.0,
                0.2,
            ),
            "wet": make_flat_material("Forest Ecology Wet Seep", (0.018, 0.045, 0.038), 0.36),
            "stem": make_flat_material("Forest Mushroom Stem", (0.58, 0.52, 0.39), 0.82),
            "cap-chestnut": make_noise_material(
                "Forest Mushroom Chestnut Cap",
                (0.16, 0.045, 0.018),
                (0.52, 0.20, 0.052),
                0.72,
                4.0,
                0.12,
            ),
            "cap-honey": make_noise_material(
                "Forest Mushroom Honey Cap",
                (0.24, 0.095, 0.025),
                (0.66, 0.35, 0.09),
                0.74,
                4.6,
                0.11,
            ),
            "cap-spent": make_noise_material(
                "Forest Mushroom Spent Cap",
                (0.055, 0.032, 0.02),
                (0.18, 0.10, 0.055),
                0.96,
                5.0,
                0.18,
            ),
        }
    )
    leaf_colors = (
        (0.24, 0.105, 0.025),
        (0.36, 0.17, 0.045),
        (0.12, 0.065, 0.02),
        (0.48, 0.25, 0.07),
    )
    for index, color in enumerate(leaf_colors):
        MATERIALS[f"leaf-{index}"] = make_flat_material(
            f"Forest Ecology Leaf {index + 1}", color, 0.98
        )


def disable_imported_emission(obj):
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


def import_source_prototype(source, prototype_collection):
    path = ROOT / source["path"]
    if not path.is_file():
        raise RuntimeError(f"Missing ecology source: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    created = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in created if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"Ecology source imported no mesh: {source['id']}")

    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        disable_imported_emission(obj)

    if len(meshes) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in meshes:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        prototype = bpy.context.object
    else:
        prototype = meshes[0]

    for obj in created:
        if obj is not prototype and obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    prototype.select_set(True)
    bpy.context.view_layer.objects.active = prototype
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    prototype.select_set(False)

    minimum = Vector(
        tuple(min(vertex.co[index] for vertex in prototype.data.vertices) for index in range(3))
    )
    maximum = Vector(
        tuple(max(vertex.co[index] for vertex in prototype.data.vertices) for index in range(3))
    )
    height = maximum.z - minimum.z
    if height <= 0.001:
        raise RuntimeError(f"Ecology source has invalid height: {source['id']}")
    scale = float(source["targetHeightMetres"]) / height
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    for vertex in prototype.data.vertices:
        vertex.co.x = (vertex.co.x - center_x) * scale
        vertex.co.y = (vertex.co.y - center_y) * scale
        vertex.co.z = (vertex.co.z - minimum.z) * scale
    prototype.data.update()
    prototype.name = f"EcologySource_{source['id']}"
    prototype.data.name = f"EcologySourceMesh_{source['id']}"
    prototype.hide_render = True
    move_to_collection(prototype, prototype_collection)
    PROTOTYPES[source["id"]] = prototype
    return {
        "id": source["id"],
        "path": str(path),
        "bytes": path.stat().st_size,
        "triangles": sum(len(polygon.vertices) - 2 for polygon in prototype.data.polygons),
        "materials": len(prototype.data.materials),
    }


def deform_mesh(base, name, width_x, width_y, height_scale, lean_x=0.0, lean_y=0.0, twist=0.0):
    mesh = base.data.copy()
    mesh.name = f"EcologyVariantMesh_{name}"
    maximum_z = max(vertex.co.z for vertex in mesh.vertices)
    for vertex in mesh.vertices:
        amount = max(0.0, min(1.0, vertex.co.z / max(maximum_z, 0.001)))
        angle = twist * amount
        cosine = math.cos(angle)
        sine = math.sin(angle)
        x = vertex.co.x * width_x
        y = vertex.co.y * width_y
        vertex.co.x = x * cosine - y * sine + lean_x * amount**1.45
        vertex.co.y = x * sine + y * cosine + lean_y * amount**1.45
        vertex.co.z *= height_scale
    mesh.update()
    variant = bpy.data.objects.new(f"EcologyVariant_{name}", mesh)
    bpy.data.collections["Forest Ecology Prototypes"].objects.link(variant)
    variant.hide_render = True
    VARIANTS[name] = variant


def build_plant_variants():
    hazel = PROTOTYPES["hazel"]
    deform_mesh(hazel, "hazel-wide", 1.2, 0.9, 0.94, twist=0.05)
    deform_mesh(hazel, "hazel-leaning", 0.92, 1.02, 1.0, lean_x=0.42, lean_y=0.08, twist=-0.08)
    deform_mesh(hazel, "hazel-young", 0.62, 0.64, 0.72, lean_x=-0.08)
    deform_mesh(hazel, "hazel-coppiced", 0.82, 1.12, 0.88, lean_x=-0.16, twist=0.12)

    fern = PROTOTYPES["fern"]
    deform_mesh(fern, "fern-mature", 1.06, 1.03, 1.02, twist=0.03)
    deform_mesh(fern, "fern-fan", 1.23, 0.72, 0.91, lean_y=0.08)
    deform_mesh(fern, "fern-leaning", 0.92, 1.02, 0.96, lean_x=0.28, twist=-0.11)
    deform_mesh(fern, "fern-juvenile", 0.58, 0.62, 0.6, lean_x=-0.05)

    sedge = PROTOTYPES["sedge"]
    deform_mesh(sedge, "sedge-upright", 0.92, 0.96, 1.06, twist=0.02)
    deform_mesh(sedge, "sedge-wind-bent", 0.94, 1.0, 0.96, lean_x=0.34, twist=-0.1)
    deform_mesh(sedge, "sedge-broad", 1.22, 0.82, 0.86, lean_y=0.06)
    deform_mesh(sedge, "sedge-young", 0.58, 0.6, 0.62, lean_x=-0.06)

    mature = PROTOTYPES["mature-mushroom-colony"]
    VARIANTS["mushroom-mature-colony"] = mature


def create_leaf_prototypes(prototype_collection):
    vertices = (
        (-0.5, 0.0, 0.0),
        (-0.12, 0.24, 0.025),
        (0.5, 0.0, 0.055),
        (-0.12, -0.24, -0.01),
        (0.0, 0.0, 0.09),
    )
    faces = ((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4))
    for index in range(4):
        mesh = bpy.data.meshes.new(f"EcologyLeafMesh_{index + 1}")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(MATERIALS[f"leaf-{index}"])
        leaf = bpy.data.objects.new(f"EcologyLeaf_{index + 1}", mesh)
        prototype_collection.objects.link(leaf)
        leaf.hide_render = True
        LEAF_PROTOTYPES.append(leaf)


def create_mushroom_prototypes(prototype_collection):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.12, radius2=0.075, depth=1.0)
    stem = bpy.context.object
    stem.name = "EcologyMushroomStem"
    stem.data.materials.append(MATERIALS["stem"])
    stem.hide_render = True
    move_to_collection(stem, prototype_collection)
    MUSHROOM_PARTS["stem"] = stem

    for key, material in (
        ("chestnut", MATERIALS["cap-chestnut"]),
        ("honey", MATERIALS["cap-honey"]),
        ("spent", MATERIALS["cap-spent"]),
    ):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8)
        cap = bpy.context.object
        cap.name = f"EcologyMushroomCap_{key}"
        cap.data.materials.append(material)
        cap.hide_render = True
        move_to_collection(cap, prototype_collection)
        MUSHROOM_PARTS[key] = cap


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.35
    scene.render.resolution_percentage = 100

    world = bpy.data.worlds.new("Forest Ecology Review World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.008, 0.018, 0.012, 1.0)
    background.inputs["Strength"].default_value = 0.46
    scene.world = world

    camera_data = bpy.data.cameras.new("Forest Ecology Camera")
    camera_data.lens = 47
    camera = bpy.data.objects.new("Forest Ecology Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (6.9, -8.9, 5.8)
    aim_at(camera, (0.0, 0.0, 0.42))
    scene.camera = camera

    lights = []
    for name, location, energy, size, color in (
        ("Ecology Key", (-4.5, -5.0, 8.5), 1120, 5.5, (0.80, 0.93, 0.82)),
        ("Ecology Fill", (5.0, -0.5, 5.5), 690, 5.0, (0.50, 0.67, 0.82)),
        ("Ecology Rim", (0.0, 5.5, 7.0), 1040, 4.5, (0.72, 0.82, 1.0)),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light_data.color = color
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        aim_at(light, (0.0, 0.0, 0.35))
        lights.append(light)

    sun_data = bpy.data.lights.new("Ecology Sun", "SUN")
    sun_data.energy = 1.4
    sun_data.angle = math.radians(18)
    sun = bpy.data.objects.new("Ecology Sun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(32), math.radians(-18), math.radians(-38))
    return scene, camera, lights, sun


def terrain_height(habitat_id, x, y):
    ripple = 0.025 * math.sin(x * 1.3 + y * 0.7) + 0.018 * math.cos(y * 1.8 - x * 0.45)
    if habitat_id == "damp-willow-hollow":
        return ripple - 0.16 * math.exp(-((x / 2.2) ** 2 + (y / 1.55) ** 2))
    if habitat_id == "beech-shade-fern-colony":
        return ripple + 0.07 * math.exp(-(((x - 2.3) / 1.8) ** 2 + ((y - 1.4) / 1.5) ** 2))
    if habitat_id == "fallen-log-decomposition":
        return ripple - 0.035 * math.exp(-((x / 2.6) ** 2 + (y / 1.3) ** 2))
    if habitat_id == "sunlit-hazel-edge":
        return ripple + 0.055 * math.exp(-(((x + 0.5) / 2.8) ** 2 + ((y - 1.4) / 1.7) ** 2))
    if habitat_id == "root-crossing-litter-drift":
        return ripple - 0.07 * math.exp(-((x / 0.9) ** 2))
    if habitat_id == "sparse-path-shoulder":
        return ripple - 0.08 * math.exp(-((x / 1.0) ** 4))
    return ripple


def create_ground(habitat, collection, root):
    segments = 40
    vertices = []
    faces = []
    half = PATCH_SIZE * 0.58
    for row in range(segments + 1):
        y = -half + row * (half * 2.0 / segments)
        for column in range(segments + 1):
            x = -half + column * (half * 2.0 / segments)
            vertices.append((x, y, terrain_height(habitat["id"], x, y)))
    for row in range(segments):
        for column in range(segments):
            start = row * (segments + 1) + column
            faces.append((start, start + 1, start + segments + 2, start + segments + 1))
    mesh = bpy.data.meshes.new(f"EcologyGroundMesh_{habitat['id']}")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(MATERIALS["duff"])
    mesh.materials.append(MATERIALS["damp"])
    mesh.materials.append(MATERIALS["path"])
    ground = bpy.data.objects.new(f"EcologyGround_{habitat['id']}", mesh)
    register_object(ground, collection, root)
    for polygon in mesh.polygons:
        center = ground.data.vertices[polygon.vertices[0]].co
        if habitat["id"] == "damp-willow-hollow" and (center.x / 2.6) ** 2 + (center.y / 1.8) ** 2 < 1.0:
            polygon.material_index = 1
        elif habitat["id"] in {"root-crossing-litter-drift", "sparse-path-shoulder"} and abs(center.x) < 0.95:
            polygon.material_index = 2
        else:
            polygon.material_index = 0
    ground["tka_habitat"] = habitat["id"]
    ground["tka_negative_space_fraction"] = float(habitat["negativeSpaceFraction"])
    return ground


def place_plant(habitat, metric, collection, root, variant_id, x, y, yaw, scale=1.0, mirror=False, bury=0.0):
    prototype = VARIANTS[variant_id]
    clone = prototype.copy()
    clone.data = prototype.data
    collection.objects.link(clone)
    clone.parent = root
    clone.hide_render = False
    clone.hide_viewport = False
    clone.hide_set(False)
    z = terrain_height(habitat["id"], x, y) - bury
    clone.location = (x, y, z)
    clone.rotation_euler = (0.0, 0.0, yaw)
    clone.scale = ((-scale if mirror else scale), scale, scale)
    clone.name = f"{habitat['id']}_{variant_id}"
    clone["tka_variant"] = variant_id
    metric["plantInstances"].append(
        {
            "variant": variant_id,
            "position": [round(x, 3), round(y, 3)],
            "scale": scale,
            "mirror": mirror,
        }
    )
    return clone


def create_curve(name, points, thickness, material, collection, root, metric, module_type):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = thickness
    curve.bevel_resolution = 3
    curve.use_fill_caps = True
    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for index, point in enumerate(points):
        spline.points[index].co = (*point[:3], 1.0)
        spline.points[index].radius = point[3] if len(point) > 3 else 1.0
    spline.order_u = min(3, len(points))
    spline.use_endpoint_u = True
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    register_object(obj, collection, root)
    obj["tka_ground_module"] = module_type
    metric["groundModules"][module_type] += 1
    return obj


def create_root_arc(habitat, metric, collection, root, name, points, thickness=0.13, pale=False):
    lifted = [
        (
            x,
            y,
            terrain_height(habitat["id"], x, y) + z,
            radius,
        )
        for x, y, z, radius in points
    ]
    return create_curve(
        name,
        lifted,
        thickness,
        MATERIALS["pale-bark" if pale else "bark"],
        collection,
        root,
        metric,
        "root-arc",
    )


def create_tree_trunk(habitat, metric, collection, root, name, x, y, radius, height, pale=False, root_angles=()):
    z = terrain_height(habitat["id"], x, y)
    bpy.ops.mesh.primitive_cone_add(
        vertices=24,
        radius1=radius * 1.34,
        radius2=radius * 0.76,
        depth=height,
        location=(x, y, z + height * 0.5),
    )
    trunk = bpy.context.object
    trunk.name = name
    for vertex in trunk.data.vertices:
        angle = math.atan2(vertex.co.y, vertex.co.x)
        radial = 1.0 + 0.065 * math.sin(angle * 5.0 + vertex.co.z * 1.4) + 0.035 * math.cos(
            angle * 3.0 - vertex.co.z * 1.9
        )
        vertex.co.x *= radial
        vertex.co.y *= radial
    trunk.data.update()
    trunk.data.materials.append(MATERIALS["pale-bark" if pale else "bark"])
    register_object(trunk, collection, root)
    for index, angle in enumerate(root_angles):
        length = radius * (3.0 + index * 0.45)
        points = []
        for step in range(5):
            amount = step / 4
            curve = math.sin(amount * math.pi) * 0.09
            points.append(
                (
                    x + math.cos(angle) * length * amount + math.sin(angle) * curve,
                    y + math.sin(angle) * length * amount - math.cos(angle) * curve,
                    0.05 + 0.06 * math.sin(amount * math.pi),
                    1.0 - amount * 0.72,
                )
            )
        create_root_arc(
            habitat,
            metric,
            collection,
            root,
            f"{name}_Root_{index + 1}",
            points,
            radius * 0.23,
            pale,
        )
    return trunk


def create_moss_mat(habitat, metric, collection, root, name, x, y, sx, sy, yaw=0.0, z_offset=0.0):
    segments = 18
    vertices = [(x, y, terrain_height(habitat["id"], x, y) + z_offset + 0.055)]
    rings = ((0.34, 0.065), (0.7, 0.045), (1.0, 0.012))
    for ring_index, (radius, lift) in enumerate(rings):
        for index in range(segments):
            angle = index * math.tau / segments
            irregular = 1.0 + 0.11 * math.sin(angle * 3.0 + ring_index * 0.7) + 0.055 * math.cos(
                angle * 7.0 - ring_index
            )
            local_x = math.cos(angle) * sx * radius * irregular
            local_y = math.sin(angle) * sy * radius * irregular
            world_x = x + local_x * math.cos(yaw) - local_y * math.sin(yaw)
            world_y = y + local_x * math.sin(yaw) + local_y * math.cos(yaw)
            vertices.append(
                (
                    world_x,
                    world_y,
                    terrain_height(habitat["id"], world_x, world_y) + z_offset + lift,
                )
            )
    faces = []
    for index in range(segments):
        faces.append((0, 1 + index, 1 + (index + 1) % segments))
    for ring_index in range(len(rings) - 1):
        first = 1 + ring_index * segments
        second = first + segments
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append(
                (
                    first + index,
                    second + index,
                    second + next_index,
                    first + next_index,
                )
            )
    mesh = bpy.data.meshes.new(f"{name} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(MATERIALS["moss"])
    moss = bpy.data.objects.new(name, mesh)
    register_object(moss, collection, root)
    moss["tka_ground_module"] = "moss-mat"
    metric["groundModules"]["moss-mat"] += 1
    return moss


def create_leaf_drift(habitat, metric, collection, root, center, spread, count, yaw, seed):
    rng = random.Random(seed)
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    for index in range(count):
        along = rng.gauss(0.0, spread[0] * 0.44)
        across = rng.gauss(0.0, spread[1] * 0.34)
        x = center[0] + along * cosine - across * sine
        y = center[1] + along * sine + across * cosine
        if abs(x) > PATCH_SIZE * 0.48 or abs(y) > PATCH_SIZE * 0.48:
            continue
        prototype = LEAF_PROTOTYPES[index % len(LEAF_PROTOTYPES)]
        leaf = prototype.copy()
        leaf.data = prototype.data
        collection.objects.link(leaf)
        leaf.parent = root
        leaf.hide_render = False
        leaf.hide_viewport = False
        leaf.hide_set(False)
        leaf.location = (
            x,
            y,
            terrain_height(habitat["id"], x, y) + 0.025 + rng.uniform(0.0, 0.025),
        )
        leaf.rotation_euler = (
            rng.uniform(-0.12, 0.12),
            rng.uniform(-0.12, 0.12),
            rng.uniform(0.0, math.tau),
        )
        size = rng.uniform(0.10, 0.22)
        leaf.scale = (size, size * rng.uniform(0.72, 1.08), size)
        leaf.name = f"{habitat['id']}_Leaf_{metric['leafCount'] + 1:03d}"
        metric["leafCount"] += 1
    metric["groundModules"]["leaf-drift"] += 1


def create_twig(habitat, metric, collection, root, name, start, end, thickness=0.025):
    midpoint = ((start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5)
    points = (
        (
            start[0],
            start[1],
            terrain_height(habitat["id"], start[0], start[1]) + 0.035,
            1.0,
        ),
        (
            midpoint[0],
            midpoint[1],
            terrain_height(habitat["id"], midpoint[0], midpoint[1]) + 0.055,
            0.75,
        ),
        (
            end[0],
            end[1],
            terrain_height(habitat["id"], end[0], end[1]) + 0.025,
            0.35,
        ),
    )
    return create_curve(
        name,
        points,
        thickness,
        MATERIALS["twig"],
        collection,
        root,
        metric,
        "twig",
    )


def create_fallen_log(habitat, metric, collection, root, start, end, thickness=0.34):
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    points = []
    for index in range(6):
        amount = index / 5
        x = start[0] + dx * amount
        y = start[1] + dy * amount
        z = terrain_height(habitat["id"], x, y) + thickness * 0.72 + math.sin(amount * math.pi) * 0.08
        points.append((x, y, z, 1.0 - amount * 0.16))
    log = create_curve(
        "Ecology Fallen Log",
        points,
        thickness,
        MATERIALS["bark"],
        collection,
        root,
        metric,
        "fallen-log",
    )
    create_curve(
        "Ecology Fallen Branch",
        (
            (start[0] + dx * 0.42, start[1] + dy * 0.42, points[2][2], 0.8),
            (start[0] + dx * 0.38 - 0.25, start[1] + dy * 0.38 + 0.58, points[2][2] + 0.15, 0.2),
        ),
        thickness * 0.22,
        MATERIALS["bark"],
        collection,
        root,
        metric,
        "fallen-log",
    )
    return log


def place_small_mushroom(habitat, collection, root, x, y, height, cap_radius, cap_key, yaw, tilt):
    z = terrain_height(habitat["id"], x, y)
    mushroom_root = bpy.data.objects.new("Ecology Mushroom", None)
    collection.objects.link(mushroom_root)
    mushroom_root.parent = root
    mushroom_root.location = (x, y, z)
    mushroom_root.rotation_euler = (tilt[0], tilt[1], yaw)

    stem_source = MUSHROOM_PARTS["stem"]
    stem = stem_source.copy()
    stem.data = stem_source.data
    collection.objects.link(stem)
    stem.parent = mushroom_root
    stem.hide_render = False
    stem.hide_viewport = False
    stem.hide_set(False)
    stem.location = (0.0, 0.0, height * 0.5)
    stem.scale = (cap_radius * 0.42, cap_radius * 0.42, height)

    cap_source = MUSHROOM_PARTS[cap_key]
    cap = cap_source.copy()
    cap.data = cap_source.data
    collection.objects.link(cap)
    cap.parent = mushroom_root
    cap.hide_render = False
    cap.hide_viewport = False
    cap.hide_set(False)
    cap.location = (0.0, 0.0, height)
    cap.scale = (
        cap_radius,
        cap_radius * (0.9 if cap_key != "spent" else 1.08),
        cap_radius * (0.34 if cap_key != "spent" else 0.16),
    )


def create_mushroom_cluster(habitat, metric, collection, root, variant, x, y, yaw, scale=1.0):
    patterns = {
        "single": ((0.0, 0.0, 0.30, 0.16, "chestnut"),),
        "pair": (
            (-0.11, 0.02, 0.28, 0.15, "honey"),
            (0.14, -0.05, 0.40, 0.19, "chestnut"),
        ),
        "small-colony": (
            (-0.24, 0.10, 0.22, 0.13, "honey"),
            (0.02, -0.16, 0.34, 0.17, "chestnut"),
            (0.22, 0.08, 0.27, 0.14, "honey"),
            (0.38, -0.07, 0.18, 0.10, "chestnut"),
        ),
        "spent-colony": (
            (-0.29, 0.12, 0.20, 0.16, "spent"),
            (-0.06, -0.15, 0.26, 0.19, "spent"),
            (0.19, 0.08, 0.18, 0.15, "spent"),
            (0.35, -0.10, 0.24, 0.17, "spent"),
            (0.08, 0.31, 0.16, 0.12, "spent"),
        ),
    }
    pattern = patterns[variant]
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    for index, (local_x, local_y, height, cap_radius, cap_key) in enumerate(pattern):
        px = x + (local_x * cosine - local_y * sine) * scale
        py = y + (local_x * sine + local_y * cosine) * scale
        place_small_mushroom(
            habitat,
            collection,
            root,
            px,
            py,
            height * scale,
            cap_radius * scale,
            cap_key,
            yaw + index * 0.73,
            (0.03 * math.sin(index * 1.7), 0.04 * math.cos(index * 1.3)),
        )
    metric["plantInstances"].append(
        {
            "variant": f"mushroom-{variant}",
            "position": [round(x, 3), round(y, 3)],
            "scale": scale,
            "mirror": False,
        }
    )


def create_wet_seep(habitat, collection, root):
    center_x = 0.35
    center_y = -0.1
    yaw = -0.18
    segments = 48
    vertices = [
        (
            center_x,
            center_y,
            terrain_height(habitat["id"], center_x, center_y) + 0.012,
        )
    ]
    for index in range(segments):
        angle = index * math.tau / segments
        radius = 1.0 + 0.13 * math.sin(angle * 3.0 + 0.4) + 0.07 * math.cos(angle * 7.0 - 0.8)
        local_x = math.cos(angle) * 1.35 * radius
        local_y = math.sin(angle) * 0.68 * radius
        x = center_x + local_x * math.cos(yaw) - local_y * math.sin(yaw)
        y = center_y + local_x * math.sin(yaw) + local_y * math.cos(yaw)
        vertices.append((x, y, terrain_height(habitat["id"], x, y) + 0.012))
    faces = [(0, 1 + index, 1 + (index + 1) % segments) for index in range(segments)]
    mesh = bpy.data.meshes.new("Damp Hollow Seep Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(MATERIALS["wet"])
    seep = bpy.data.objects.new("Damp Hollow Seep", mesh)
    register_object(seep, collection, root)


def habitat_metric(habitat):
    return {
        "id": habitat["id"],
        "label": habitat["label"],
        "premise": habitat["premise"],
        "placementGrammar": habitat["placementGrammar"],
        "negativeSpaceFraction": float(habitat["negativeSpaceFraction"]),
        "plantInstances": [],
        "groundModules": Counter(),
        "leafCount": 0,
        "fullRootIslandInstances": 0,
    }


def build_damp_willow(habitat, metric, collection, root):
    create_tree_trunk(
        habitat,
        metric,
        collection,
        root,
        "Willow Trunk",
        -2.9,
        2.0,
        0.42,
        4.1,
        True,
        (0.05, 0.68, -0.72),
    )
    create_wet_seep(habitat, collection, root)
    for args in (
        ("sedge-upright", -1.65, -0.15, 0.2, 0.95, False),
        ("sedge-wind-bent", 0.45, 1.62, 1.55, 0.9, True),
        ("sedge-broad", 2.05, 0.45, 2.7, 0.92, False),
        ("sedge-young", 1.05, -1.62, -0.65, 0.9, True),
        ("fern-fan", -2.05, 0.75, 0.4, 0.86, False),
        ("fern-juvenile", 2.65, 1.72, 2.0, 0.92, True),
    ):
        place_plant(habitat, metric, collection, root, *args)
    place_plant(
        habitat,
        metric,
        collection,
        root,
        "mushroom-mature-colony",
        -1.05,
        1.42,
        -0.3,
        0.82,
        False,
        0.04,
    )
    create_mushroom_cluster(habitat, metric, collection, root, "pair", 1.72, 1.22, 0.7, 0.9)
    for index, values in enumerate(
        ((-1.6, -0.85, 0.72, 0.45, 0.2), (0.25, 1.0, 0.85, 0.48, -0.4), (1.7, 0.7, 0.62, 0.36, 0.6), (-2.45, 1.25, 0.55, 0.32, 1.1))
    ):
        create_moss_mat(habitat, metric, collection, root, f"Damp Moss {index + 1}", *values)
    create_leaf_drift(habitat, metric, collection, root, (-1.55, 1.5), (2.5, 0.85), 42, 0.22, habitat["seed"])
    create_twig(habitat, metric, collection, root, "Damp Twig", (-2.2, -1.55), (-0.8, -1.28))


def build_beech_fern(habitat, metric, collection, root):
    create_tree_trunk(
        habitat,
        metric,
        collection,
        root,
        "Beech Trunk",
        2.55,
        1.55,
        0.62,
        4.7,
        False,
        (2.8, -2.55, -1.8, 1.55),
    )
    for args in (
        ("fern-mature", -1.75, 0.75, 0.15, 1.0, False),
        ("fern-fan", -0.25, 1.5, 1.2, 0.94, True),
        ("fern-leaning", 0.95, -0.15, -0.7, 0.9, False),
        ("fern-juvenile", -2.45, -1.45, 2.25, 0.95, True),
        ("hazel-young", -2.9, 2.28, -0.3, 0.82, False),
    ):
        place_plant(habitat, metric, collection, root, *args)
    create_mushroom_cluster(habitat, metric, collection, root, "single", 1.5, 0.85, -0.4, 0.92)
    for index, values in enumerate(
        ((1.55, 0.78, 0.62, 0.4, 0.3), (2.0, -0.2, 0.72, 0.45, -0.5), (-0.8, 0.45, 0.5, 0.32, 0.8))
    ):
        create_moss_mat(habitat, metric, collection, root, f"Beech Moss {index + 1}", *values)
    create_leaf_drift(habitat, metric, collection, root, (0.9, 1.0), (4.8, 1.65), 88, 0.12, habitat["seed"])
    create_twig(habitat, metric, collection, root, "Beech Twig One", (-1.2, -1.9), (0.7, -1.45))
    create_twig(habitat, metric, collection, root, "Beech Twig Two", (-2.8, 0.1), (-1.3, 0.35), 0.02)


def build_fallen_log_patch(habitat, metric, collection, root):
    create_fallen_log(habitat, metric, collection, root, (-3.2, 1.45), (2.85, -0.82), 0.31)
    for args in (
        ("fern-leaning", -2.35, 1.95, 0.25, 0.92, False),
        ("fern-mature", 0.35, 1.2, 1.8, 0.86, True),
        ("fern-juvenile", 2.55, 0.35, -0.55, 0.9, False),
        ("sedge-young", -2.75, -1.55, 1.1, 0.78, True),
    ):
        place_plant(habitat, metric, collection, root, *args)
    create_mushroom_cluster(habitat, metric, collection, root, "small-colony", -1.05, 0.78, -0.3, 0.9)
    create_mushroom_cluster(habitat, metric, collection, root, "pair", 0.75, 0.08, 1.25, 0.75)
    create_mushroom_cluster(habitat, metric, collection, root, "spent-colony", 2.05, -0.72, 2.4, 0.82)
    for index, values in enumerate(
        ((-2.15, 1.2, 0.75, 0.38, 0.3), (-0.2, 0.55, 0.9, 0.42, -0.25), (1.75, -0.28, 0.74, 0.36, 0.55), (2.65, -0.9, 0.45, 0.28, -0.8))
    ):
        create_moss_mat(habitat, metric, collection, root, f"Log Moss {index + 1}", *values, 0.08)
    create_leaf_drift(habitat, metric, collection, root, (0.15, 0.75), (5.5, 1.1), 70, -0.36, habitat["seed"])
    create_twig(habitat, metric, collection, root, "Log Twig", (0.4, -1.55), (2.2, -1.1))


def build_sunlit_hazel(habitat, metric, collection, root):
    for args in (
        ("hazel-wide", -2.15, 1.45, 0.15, 1.0, False),
        ("hazel-leaning", -0.15, 2.05, -0.65, 0.94, True),
        ("hazel-coppiced", 1.75, 1.35, 0.9, 0.92, False),
        ("hazel-young", 2.8, 0.05, 2.2, 0.88, True),
        ("fern-juvenile", -1.65, -0.25, -0.2, 0.78, False),
        ("sedge-young", 1.5, -1.05, 1.4, 0.8, True),
    ):
        place_plant(habitat, metric, collection, root, *args)
    create_root_arc(
        habitat,
        metric,
        collection,
        root,
        "Hazel Edge Root",
        ((-2.3, 1.35, 0.04, 1.0), (-1.65, 0.95, 0.08, 0.72), (-0.95, 0.4, 0.03, 0.28)),
        0.08,
    )
    for index, values in enumerate(
        ((-2.0, 1.0, 0.55, 0.28, 0.2), (0.15, 1.45, 0.5, 0.26, -0.5), (1.6, 0.95, 0.42, 0.24, 0.7))
    ):
        create_moss_mat(habitat, metric, collection, root, f"Hazel Moss {index + 1}", *values)
    create_leaf_drift(habitat, metric, collection, root, (-0.25, 1.15), (4.9, 1.0), 38, 0.05, habitat["seed"])
    create_twig(habitat, metric, collection, root, "Hazel Twig", (-2.7, -1.55), (-1.1, -1.72))


def build_root_crossing(habitat, metric, collection, root):
    create_tree_trunk(
        habitat,
        metric,
        collection,
        root,
        "Crossing Beech Trunk",
        -3.72,
        1.72,
        0.46,
        4.2,
        False,
        (),
    )
    root_sets = (
        (
            (-3.55, 1.55, 0.07, 1.0),
            (-2.45, 1.1, 0.13, 0.9),
            (-1.35, 0.42, 0.18, 0.72),
            (-0.1, 0.08, 0.14, 0.54),
            (1.35, 0.42, 0.09, 0.32),
            (3.25, 0.12, 0.03, 0.12),
        ),
        (
            (-3.5, 1.62, 0.06, 0.95),
            (-2.62, 0.88, 0.12, 0.78),
            (-1.72, 0.02, 0.15, 0.58),
            (-0.65, -0.55, 0.1, 0.4),
            (0.62, -0.82, 0.04, 0.16),
        ),
        (
            (-1.55, 0.5, 0.1, 0.72),
            (-0.82, 1.02, 0.13, 0.55),
            (0.15, 1.35, 0.09, 0.36),
            (1.48, 1.18, 0.03, 0.14),
        ),
        (
            (-2.48, 1.08, 0.08, 0.58),
            (-1.72, 1.62, 0.09, 0.4),
            (-0.72, 1.95, 0.025, 0.12),
        ),
    )
    for index, points in enumerate(root_sets):
        create_root_arc(
            habitat,
            metric,
            collection,
            root,
            f"Crossing Root {index + 1}",
            points,
            (0.16, 0.125, 0.09, 0.06)[index],
        )
    for args in (
        ("fern-fan", -2.35, 1.65, 0.5, 0.9, False),
        ("fern-juvenile", 2.55, -1.55, -0.9, 0.92, True),
        ("fern-leaning", 2.45, 1.82, 2.1, 0.78, False),
    ):
        place_plant(habitat, metric, collection, root, *args)
    create_mushroom_cluster(habitat, metric, collection, root, "single", -1.25, 0.12, 0.2, 0.88)
    create_mushroom_cluster(habitat, metric, collection, root, "pair", 1.45, 0.65, 2.0, 0.72)
    create_moss_mat(habitat, metric, collection, root, "Crossing Moss One", -1.35, -0.25, 0.65, 0.34, 0.3)
    create_moss_mat(habitat, metric, collection, root, "Crossing Moss Two", 1.25, 0.48, 0.55, 0.28, -0.4)
    create_leaf_drift(habitat, metric, collection, root, (1.15, 0.85), (4.9, 0.72), 78, 0.18, habitat["seed"])
    create_twig(habitat, metric, collection, root, "Crossing Twig", (-2.65, 1.0), (-0.8, 1.2))


def build_sparse_path(habitat, metric, collection, root):
    for args in (
        ("sedge-upright", -1.8, 1.75, 0.2, 0.82, False),
        ("sedge-young", 2.1, -1.45, 2.2, 0.9, True),
        ("fern-juvenile", -2.65, -1.55, -0.7, 0.72, False),
        ("hazel-young", 2.95, 2.25, 1.85, 0.78, True),
    ):
        place_plant(habitat, metric, collection, root, *args)
    create_root_arc(
        habitat,
        metric,
        collection,
        root,
        "Sparse Shoulder Root",
        ((-3.1, 2.15, 0.03, 1.0), (-2.45, 1.85, 0.07, 0.64), (-1.85, 1.35, 0.025, 0.22)),
        0.075,
    )
    create_moss_mat(habitat, metric, collection, root, "Sparse Moss", -2.0, 1.55, 0.45, 0.24, 0.5)
    create_leaf_drift(habitat, metric, collection, root, (-2.2, 0.0), (1.7, 2.5), 22, math.pi * 0.48, habitat["seed"])
    create_twig(habitat, metric, collection, root, "Sparse Twig", (1.55, 1.2), (2.65, 0.92), 0.02)


BUILDERS = {
    "damp-willow-hollow": build_damp_willow,
    "beech-shade-fern-colony": build_beech_fern,
    "fallen-log-decomposition": build_fallen_log_patch,
    "sunlit-hazel-edge": build_sunlit_hazel,
    "root-crossing-litter-drift": build_root_crossing,
    "sparse-path-shoulder": build_sparse_path,
}


def object_triangles(root):
    triangles = 0
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    return triangles


def configure_habitat_light(habitat_id, lights, sun):
    sunlight = {
        "damp-willow-hollow": 0.85,
        "beech-shade-fern-colony": 0.72,
        "fallen-log-decomposition": 0.82,
        "sunlit-hazel-edge": 1.75,
        "root-crossing-litter-drift": 1.0,
        "sparse-path-shoulder": 1.35,
    }[habitat_id]
    sun.data.energy = sunlight
    lights[0].data.energy = 1120 * (0.82 + sunlight * 0.18)


def build_and_render_habitat(scene, habitat, lights, sun, prior_collections):
    for previous in prior_collections:
        previous.hide_render = True

    collection = bpy.data.collections.new(f"Habitat_{habitat['id']}")
    scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"HabitatRoot_{habitat['id']}", None)
    collection.objects.link(root)
    root["tka_habitat"] = habitat["id"]
    root["tka_ecological_premise"] = habitat["premise"]
    root["tka_placement_grammar"] = habitat["placementGrammar"]
    metric = habitat_metric(habitat)

    create_ground(habitat, collection, root)
    BUILDERS[habitat["id"]](habitat, metric, collection, root)
    configure_habitat_light(habitat["id"], lights, sun)
    bpy.context.view_layer.update()

    render_path = EVIDENCE_DIR / f"forest_ground_life_ecology_{habitat['id']}.png"
    scene.render.filepath = str(render_path)
    bpy.ops.render.render(write_still=True)
    metric["render"] = str(render_path)
    metric["triangles"] = object_triangles(root)
    metric["variantCounts"] = dict(
        sorted(Counter(instance["variant"] for instance in metric["plantInstances"]).items())
    )
    metric["groundModules"] = dict(sorted(metric["groundModules"].items()))
    return collection, root, metric


reset_scene()
setup_materials()
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
prototype_collection = bpy.data.collections.new("Forest Ecology Prototypes")
bpy.context.scene.collection.children.link(prototype_collection)
source_metrics = [
    import_source_prototype(source, prototype_collection) for source in CONTRACT["sources"]
]
build_plant_variants()
create_leaf_prototypes(prototype_collection)
create_mushroom_prototypes(prototype_collection)
scene, camera, lights, sun = setup_scene()

habitat_roots = []
habitat_collections = []
habitat_metrics = []
for habitat in CONTRACT["habitats"]:
    collection, root, metric = build_and_render_habitat(
        scene, habitat, lights, sun, habitat_collections
    )
    habitat_collections.append(collection)
    habitat_roots.append(root)
    habitat_metrics.append(metric)

for index, (collection, root) in enumerate(zip(habitat_collections, habitat_roots)):
    collection.hide_render = False
    column = index % 3
    row = index // 3
    root.location = ((column - 1) * 11.5, (0.5 - row) * 11.5, 0.0)

all_variants = sorted(
    {
        instance["variant"]
        for habitat in habitat_metrics
        for instance in habitat["plantInstances"]
    }
)
all_ground_modules = sorted(
    {
        module
        for habitat in habitat_metrics
        for module, count in habitat["groundModules"].items()
        if count > 0
    }
)
payload = {
    "contractVersion": CONTRACT["version"],
    "contractSha256": hashlib.sha256(CONTRACT_BYTES).hexdigest(),
    "patchSizeMetres": PATCH_SIZE,
    "sources": source_metrics,
    "habitats": habitat_metrics,
    "distinctPlantVariants": all_variants,
    "groundModuleTypes": all_ground_modules,
    "fullRootIslandInstances": sum(
        habitat["fullRootIslandInstances"] for habitat in habitat_metrics
    ),
}
METRICS_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
print(
    json.dumps(
        {
            "blend": str(BLEND_PATH),
            "metrics": str(METRICS_PATH),
            "habitats": len(habitat_metrics),
            "distinctPlantVariants": len(all_variants),
            "groundModuleTypes": all_ground_modules,
        },
        indent=2,
    )
)
