"""Deterministic Gate 7 ground-life placement for the authored Forest scene.

The JSON layout owns habitat locations. This module turns those locations into
plant-family variants and low ground modules while respecting the approved
terrain, paths, and tree composition.
"""

from collections import Counter
import json
import math
import os
import random

import bpy
from mathutils import Vector

from forest_ground_ecosystem import (
    _inside_tree_keep_out,
    create_forest_ground_ecosystem,
    set_tree_keep_outs,
)
from ground_life_geometry import (
    append_meadow_blade as _append_meadow_blade,
    append_meadow_seed_head as _append_meadow_seed_head,
)


VARIANT_DEFINITIONS = {
    "hazel-wide": {
        "source": "hazel",
        "deform": (1.20, 0.90, 0.94, 0.0, 0.0, 0.05),
    },
    "hazel-leaning": {
        "source": "hazel",
        "deform": (0.92, 1.02, 1.00, 0.42, 0.08, -0.08),
    },
    "hazel-young": {
        "source": "hazel",
        "deform": (0.62, 0.64, 0.72, -0.08, 0.0, 0.0),
    },
    "hazel-coppiced": {
        "source": "hazel",
        "deform": (0.82, 1.12, 0.88, -0.16, 0.0, 0.12),
    },
    "fern-mature": {
        "source": "fern",
        "deform": (1.06, 1.03, 1.02, 0.0, 0.0, 0.03),
    },
    "fern-fan": {
        "source": "fern",
        "deform": (1.23, 0.72, 0.91, 0.0, 0.08, 0.0),
    },
    "fern-leaning": {
        "source": "fern",
        "deform": (0.92, 1.02, 0.96, 0.28, 0.0, -0.11),
    },
    "fern-juvenile": {
        "source": "fern",
        "deform": (0.58, 0.62, 0.60, -0.05, 0.0, 0.0),
    },
    "sedge-upright": {
        "source": "sedge",
        "deform": (0.92, 0.96, 1.06, 0.0, 0.0, 0.02),
    },
    "sedge-wind-bent": {
        "source": "sedge",
        "deform": (0.94, 1.00, 0.96, 0.34, 0.0, -0.10),
    },
    "sedge-broad": {
        "source": "sedge",
        "deform": (1.22, 0.82, 0.86, 0.0, 0.06, 0.0),
    },
    "sedge-young": {
        "source": "sedge",
        "deform": (0.58, 0.60, 0.62, -0.06, 0.0, 0.0),
    },
}

FAMILY_VARIANTS = {
    "hazel": ("hazel-wide", "hazel-leaning", "hazel-young", "hazel-coppiced"),
    "fern": ("fern-mature", "fern-fan", "fern-leaning", "fern-juvenile"),
    "sedge": ("sedge-upright", "sedge-wind-bent", "sedge-broad", "sedge-young"),
    "mushroom": (
        "mushroom-single",
        "mushroom-pair",
        "mushroom-small-colony",
        "mushroom-mature-colony",
        "mushroom-spent-colony",
    ),
}

BASE_PLANT_COUNTS = {
    "damp-willow-hollow": {"sedge": 14, "mushroom": 6, "fern": 4},
    "beech-shade-fern-colony": {"fern": 18, "hazel": 2, "mushroom": 4},
    "fallen-log-decomposition": {"mushroom": 8, "fern": 9, "sedge": 3},
    "sunlit-hazel-edge": {"hazel": 6, "fern": 5, "sedge": 3},
    "root-crossing-litter-drift": {"fern": 7, "mushroom": 4},
    "sparse-path-shoulder": {"sedge": 4, "fern": 3, "hazel": 1},
}

BASE_MODULE_COUNTS = {
    "damp-willow-hollow": {"moss-mat": 2, "leaf-drift": 1, "twig": 2},
    "beech-shade-fern-colony": {
        "root-arc": 2,
        "moss-mat": 3,
        "leaf-drift": 2,
        "twig": 2,
    },
    "fallen-log-decomposition": {
        "fallen-log": 1,
        "moss-mat": 3,
        "leaf-drift": 2,
        "twig": 3,
    },
    "sunlit-hazel-edge": {"moss-mat": 1, "leaf-drift": 2, "twig": 2},
    "root-crossing-litter-drift": {
        "root-arc": 4,
        "leaf-drift": 2,
        "twig": 2,
    },
    "sparse-path-shoulder": {"moss-mat": 1, "leaf-drift": 1, "twig": 1},
}

PLANT_CLEARANCE = {
    "hazel": 0.92,
    "fern": 0.38,
    "sedge": 0.34,
    "mushroom": 0.24,
}

MUSHROOM_PATTERNS = {
    "mushroom-single": ((0.0, 0.0, 0.30, 0.16, "chestnut"),),
    "mushroom-pair": (
        (-0.11, 0.02, 0.28, 0.15, "honey"),
        (0.14, -0.05, 0.40, 0.19, "chestnut"),
    ),
    "mushroom-small-colony": (
        (-0.24, 0.10, 0.22, 0.13, "honey"),
        (0.02, -0.16, 0.34, 0.17, "chestnut"),
        (0.22, 0.08, 0.27, 0.14, "honey"),
        (0.38, -0.07, 0.18, 0.10, "chestnut"),
    ),
    "mushroom-spent-colony": (
        (-0.29, 0.12, 0.20, 0.16, "spent"),
        (-0.06, -0.15, 0.26, 0.19, "spent"),
        (0.19, 0.08, 0.18, 0.15, "spent"),
        (0.35, -0.10, 0.24, 0.17, "spent"),
        (0.08, 0.31, 0.16, 0.12, "spent"),
    ),
    "amanita-scouts": (
        (-0.14, 0.03, 0.36, 0.19, "amanita"),
        (0.18, -0.06, 0.48, 0.23, "amanita"),
    ),
    "amanita-family": (
        (-0.36, 0.14, 0.30, 0.17, "amanita"),
        (-0.12, -0.18, 0.48, 0.23, "amanita"),
        (0.18, 0.08, 0.38, 0.20, "amanita"),
        (0.39, -0.11, 0.24, 0.14, "amanita"),
        (0.06, 0.34, 0.20, 0.12, "amanita"),
    ),
    "amanita-ring": (
        (-0.42, 0.10, 0.28, 0.16, "amanita"),
        (-0.20, -0.31, 0.35, 0.18, "amanita"),
        (0.12, -0.37, 0.23, 0.13, "amanita"),
        (0.42, -0.10, 0.42, 0.21, "amanita"),
        (0.28, 0.29, 0.30, 0.16, "amanita"),
        (-0.10, 0.38, 0.20, 0.12, "amanita"),
    ),
}


def _flat_material(name, color, roughness=0.86):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def _transparent_flat_material(name, color, alpha, roughness=0.96):
    material = _flat_material(name, color, roughness)
    material.diffuse_color = (*color, alpha)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Alpha"].default_value = alpha
    material.surface_render_method = "DITHERED"
    return material


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


def _import_source(project_root, source, prototype_collection):
    path = os.path.join(project_root, source["path"])
    if not os.path.isfile(path):
        raise RuntimeError(f"Missing Forest ground-life source: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    created = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in created if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"Ground-life source imported no mesh: {source['id']}")

    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        _disable_emission(obj)

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
        tuple(
            min(vertex.co[index] for vertex in prototype.data.vertices)
            for index in range(3)
        )
    )
    maximum = Vector(
        tuple(
            max(vertex.co[index] for vertex in prototype.data.vertices)
            for index in range(3)
        )
    )
    height = maximum.z - minimum.z
    if height <= 0.001:
        raise RuntimeError(f"Ground-life source has invalid height: {source['id']}")
    normalized_scale = float(source["targetHeightMetres"]) / height
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    for vertex in prototype.data.vertices:
        vertex.co.x = (vertex.co.x - center_x) * normalized_scale
        vertex.co.y = (vertex.co.y - center_y) * normalized_scale
        vertex.co.z = (vertex.co.z - minimum.z) * normalized_scale
    prototype.data.update()
    prototype.name = f"ForestGroundLifeSource_{source['id']}"
    prototype.data.name = f"ForestGroundLifeSourceMesh_{source['id']}"
    prototype.hide_render = True
    prototype.hide_viewport = True
    _link_to_collection(prototype, prototype_collection)
    return prototype


def _deform_variant(base, variant_id, definition, prototype_collection):
    width_x, width_y, height_scale, lean_x, lean_y, twist = definition["deform"]
    mesh = base.data.copy()
    mesh.name = f"ForestGroundLifeVariantMesh_{variant_id}"
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
    variant = bpy.data.objects.new(f"ForestGroundLifeVariant_{variant_id}", mesh)
    prototype_collection.objects.link(variant)
    variant.hide_render = True
    variant.hide_viewport = True
    return variant


def _curve_prototype(name, points, thickness, material, prototype_collection):
    curve_data = bpy.data.curves.new(f"{name}Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = thickness
    curve_data.bevel_resolution = 1
    curve_data.resolution_u = 2
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, values in zip(spline.points, points):
        point.co = (*values[:3], 1.0)
        point.radius = values[3] if len(values) > 3 else 1.0
    curve = bpy.data.objects.new(name, curve_data)
    prototype_collection.objects.link(curve)
    curve.data.materials.append(material)
    bpy.ops.object.select_all(action="DESELECT")
    curve.select_set(True)
    bpy.context.view_layer.objects.active = curve
    bpy.ops.object.convert(target="MESH")
    prototype = bpy.context.object
    prototype.data.name = f"ForestGroundModuleMesh_{name}"
    prototype.hide_render = True
    prototype.hide_viewport = True
    return prototype


def _moss_cluster_prototype(name, seed, material, prototype_collection):
    rng = random.Random(seed)
    vertices = []
    faces = []
    for cushion_index in range(7):
        center_x = rng.uniform(-0.58, 0.58)
        center_y = rng.uniform(-0.42, 0.42)
        radius_x = rng.uniform(0.26, 0.52)
        radius_y = rng.uniform(0.22, 0.46)
        height = rng.uniform(0.055, 0.13)
        center_index = len(vertices)
        vertices.append((center_x, center_y, height))
        segments = 10
        boundary_start = len(vertices)
        for segment in range(segments):
            angle = math.tau * segment / segments
            wobble = 1.0 + 0.12 * math.sin(segment * 2.7 + cushion_index)
            vertices.append(
                (
                    center_x + math.cos(angle) * radius_x * wobble,
                    center_y + math.sin(angle) * radius_y * wobble,
                    0.008,
                )
            )
        for segment in range(segments):
            faces.append(
                (
                    center_index,
                    boundary_start + segment,
                    boundary_start + (segment + 1) % segments,
                )
            )
    mesh = bpy.data.meshes.new(f"ForestGroundModuleMesh_{name}")
    mesh.from_pydata(vertices, [], faces)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh.materials.append(material)
    prototype = bpy.data.objects.new(name, mesh)
    prototype_collection.objects.link(prototype)
    prototype.hide_render = True
    prototype.hide_viewport = True
    return prototype


def _leaf_drift_prototype(name, seed, material, prototype_collection):
    rng = random.Random(seed)
    vertices = []
    faces = []
    for index in range(18):
        center_x = rng.uniform(-0.95, 0.95)
        center_y = rng.gauss(0.0, 0.24)
        length = rng.uniform(0.16, 0.30)
        width = length * rng.uniform(0.34, 0.52)
        angle = rng.uniform(-0.55, 0.55)
        forward = (math.cos(angle) * length, math.sin(angle) * length)
        side = (-math.sin(angle) * width, math.cos(angle) * width)
        z = 0.018 + rng.uniform(0.0, 0.025)
        start = len(vertices)
        vertices.extend(
            (
                (center_x - forward[0], center_y - forward[1], z),
                (center_x + side[0], center_y + side[1], z + 0.012),
                (center_x + forward[0], center_y + forward[1], z),
                (center_x - side[0], center_y - side[1], z - 0.006),
            )
        )
        faces.append((start, start + 1, start + 2, start + 3))
    mesh = bpy.data.meshes.new(f"ForestGroundModuleMesh_{name}")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    prototype = bpy.data.objects.new(name, mesh)
    prototype_collection.objects.link(prototype)
    prototype.hide_render = True
    prototype.hide_viewport = True
    return prototype


def _make_prototypes(project_root, ecology, prototype_collection):
    materials = {
        "moss": _flat_material("Forest Ground Moss", (0.055, 0.145, 0.055), 0.97),
        "leaf": _flat_material("Forest Leaf Drift", (0.13, 0.07, 0.028), 0.94),
        "root": _flat_material("Forest Root Bark", (0.27, 0.15, 0.065), 0.91),
        "twig": _flat_material("Forest Fallen Twig", (0.12, 0.062, 0.027), 0.95),
        "log": _flat_material("Forest Decomposition Log", (0.105, 0.055, 0.025), 0.96),
        "stem": _flat_material("Forest Mushroom Stem", (0.54, 0.47, 0.34), 0.82),
        "stem-amanita": _flat_material("Forest Amanita Stem", (0.78, 0.72, 0.58), 0.80),
        "cap-chestnut": _flat_material("Forest Mushroom Chestnut", (0.31, 0.105, 0.035), 0.84),
        "cap-honey": _flat_material("Forest Mushroom Honey", (0.48, 0.23, 0.065), 0.84),
        "cap-spent": _flat_material("Forest Mushroom Spent", (0.20, 0.115, 0.055), 0.94),
        "cap-amanita": _flat_material("Forest Amanita Cap", (0.62, 0.018, 0.012), 0.80),
        "amanita-spot": _flat_material("Forest Amanita Spots", (0.89, 0.84, 0.68), 0.88),
    }

    sources = {}
    for source in ecology["sources"]:
        sources[source["id"]] = _import_source(project_root, source, prototype_collection)

    variants = {}
    for variant_id, definition in VARIANT_DEFINITIONS.items():
        variants[variant_id] = _deform_variant(
            sources[definition["source"]],
            variant_id,
            definition,
            prototype_collection,
        )
    mature = sources["mature-mushroom-colony"]
    mature.data.name = "ForestGroundLifeVariantMesh_mushroom-mature-colony"
    variants["mushroom-mature-colony"] = mature

    modules = {
        "root-arc": [
            _curve_prototype(
                "root-arc-1",
                ((-1.0, 0.0, 0.018, 0.55), (-0.25, 0.28, 0.035, 1.0), (0.55, -0.22, 0.027, 0.72), (1.0, 0.12, 0.012, 0.24)),
                0.042,
                materials["root"],
                prototype_collection,
            ),
            _curve_prototype(
                "root-arc-2",
                ((-1.0, -0.15, 0.012, 0.35), (-0.45, 0.30, 0.028, 0.8), (0.15, -0.12, 0.040, 1.0), (0.7, -0.32, 0.024, 0.55), (1.0, 0.08, 0.010, 0.2)),
                0.038,
                materials["root"],
                prototype_collection,
            ),
            _curve_prototype(
                "root-arc-3",
                ((-1.0, 0.20, 0.010, 0.28), (-0.48, -0.24, 0.025, 0.65), (0.0, 0.28, 0.038, 1.0), (0.52, 0.12, 0.025, 0.58), (1.0, -0.25, 0.008, 0.18)),
                0.034,
                materials["root"],
                prototype_collection,
            ),
        ],
        "moss-mat": [
            _moss_cluster_prototype("moss-mat-1", 131, materials["moss"], prototype_collection),
            _moss_cluster_prototype("moss-mat-2", 173, materials["moss"], prototype_collection),
            _moss_cluster_prototype("moss-mat-3", 211, materials["moss"], prototype_collection),
        ],
        "leaf-drift": [
            _leaf_drift_prototype("leaf-drift-1", 31, materials["leaf"], prototype_collection),
            _leaf_drift_prototype("leaf-drift-2", 47, materials["leaf"], prototype_collection),
            _leaf_drift_prototype("leaf-drift-3", 71, materials["leaf"], prototype_collection),
        ],
        "twig": [
            _curve_prototype(
                "twig-1",
                ((-1.0, 0.0, 0.02, 0.75), (-0.1, 0.08, 0.055, 1.0), (1.0, -0.04, 0.02, 0.25)),
                0.025,
                materials["twig"],
                prototype_collection,
            ),
            _curve_prototype(
                "twig-2",
                ((-1.0, -0.05, 0.018, 0.55), (-0.35, 0.10, 0.05, 1.0), (0.25, -0.02, 0.04, 0.72), (1.0, 0.08, 0.015, 0.18)),
                0.022,
                materials["twig"],
                prototype_collection,
            ),
        ],
        "fallen-log": [
            _curve_prototype(
                "fallen-log-1",
                ((-1.0, 0.0, 0.28, 0.82), (-0.45, 0.05, 0.34, 1.0), (0.18, -0.04, 0.31, 0.92), (0.72, 0.06, 0.27, 0.74), (1.0, 0.0, 0.23, 0.45)),
                0.28,
                materials["log"],
                prototype_collection,
            ),
            _curve_prototype(
                "fallen-log-2",
                ((-1.0, -0.04, 0.23, 0.62), (-0.58, 0.08, 0.29, 0.88), (-0.08, -0.03, 0.33, 1.0), (0.48, 0.07, 0.27, 0.78), (1.0, -0.02, 0.21, 0.36)),
                0.25,
                materials["log"],
                prototype_collection,
            ),
        ],
    }

    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.12, radius2=0.075, depth=1.0)
    stem = bpy.context.object
    stem.name = "ForestGroundMushroomStem"
    stem.data.name = "ForestGroundMushroomMesh_stem"
    stem.data.materials.append(materials["stem"])
    stem.hide_render = True
    stem.hide_viewport = True
    _link_to_collection(stem, prototype_collection)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.13, radius2=0.072, depth=1.0)
    amanita_stem = bpy.context.object
    amanita_stem.name = "ForestGroundAmanitaStem"
    amanita_stem.data.name = "ForestGroundMushroomMesh_stem-amanita"
    amanita_stem.data.materials.append(materials["stem-amanita"])
    amanita_stem.hide_render = True
    amanita_stem.hide_viewport = True
    _link_to_collection(amanita_stem, prototype_collection)
    mushroom_parts = {"stem": stem, "stem-amanita": amanita_stem}
    for key in ("chestnut", "honey", "spent", "amanita"):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8)
        cap = bpy.context.object
        cap.name = f"ForestGroundMushroomCap_{key}"
        cap.data.name = f"ForestGroundMushroomMesh_cap-{key}"
        cap.data.materials.append(materials[f"cap-{key}"])
        cap.hide_render = True
        cap.hide_viewport = True
        _link_to_collection(cap, prototype_collection)
        mushroom_parts[key] = cap

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0)
    spot = bpy.context.object
    spot.name = "ForestGroundAmanitaSpot"
    spot.data.name = "ForestGroundMushroomMesh_amanita-spot"
    spot.data.materials.append(materials["amanita-spot"])
    spot.hide_render = True
    spot.hide_viewport = True
    _link_to_collection(spot, prototype_collection)
    mushroom_parts["amanita-spot"] = spot

    return sources, variants, modules, mushroom_parts


def _local_to_world(patch, local_x, local_y):
    angle = math.radians(float(patch.get("rotationDegrees", 0.0)))
    cosine = math.cos(angle)
    sine = math.sin(angle)
    return (
        float(patch["center"][0]) + local_x * cosine - local_y * sine,
        float(patch["center"][1]) + local_x * sine + local_y * cosine,
    )


def _sample_local(patch, habitat_id, family, rng, index):
    radius_x, radius_y = map(float, patch["radii"])
    if habitat_id == "damp-willow-hollow":
        angle = rng.uniform(-0.15 * math.pi, 1.45 * math.pi)
        radius = rng.uniform(0.38, 0.94)
        if family == "mushroom":
            angle = rng.choice((rng.uniform(0.60, 1.65), rng.uniform(3.55, 4.65)))
            radius = rng.uniform(0.50, 0.88)
        return math.cos(angle) * radius_x * radius, math.sin(angle) * radius_y * radius

    if habitat_id == "beech-shade-fern-colony":
        lobe = index % 3
        anchors = ((-0.28, 0.12), (0.28, 0.34), (0.14, -0.33))
        anchor_x, anchor_y = anchors[lobe]
        local_x = rng.gauss(anchor_x * radius_x, radius_x * 0.20)
        local_y = rng.gauss(anchor_y * radius_y, radius_y * 0.22)
        if family == "hazel":
            local_x = rng.choice((-1.0, 1.0)) * rng.uniform(0.52, 0.82) * radius_x
            local_y = rng.uniform(0.15, 0.64) * radius_y
        return local_x, local_y

    if habitat_id == "fallen-log-decomposition":
        local_x = rng.uniform(-0.82, 0.82) * radius_x
        shade_side = -0.24 if family in ("mushroom", "fern") else 0.20
        local_y = rng.gauss(shade_side * radius_y, radius_y * 0.19)
        return local_x, local_y

    if habitat_id == "sunlit-hazel-edge":
        if family == "hazel":
            return (
                rng.uniform(-0.78, 0.78) * radius_x,
                rng.uniform(0.18, 0.78) * radius_y,
            )
        return (
            rng.uniform(-0.84, 0.84) * radius_x,
            rng.uniform(-0.36, 0.34) * radius_y,
        )

    if habitat_id == "root-crossing-litter-drift":
        return (
            rng.uniform(-0.82, 0.82) * radius_x,
            rng.choice((-1.0, 1.0)) * rng.uniform(0.28, 0.76) * radius_y,
        )

    if habitat_id == "sparse-path-shoulder":
        pockets = ((-0.58, 0.18), (0.04, -0.24), (0.62, 0.25))
        anchor_x, anchor_y = pockets[index % len(pockets)]
        return (
            rng.gauss(anchor_x * radius_x, radius_x * 0.12),
            rng.gauss(anchor_y * radius_y, radius_y * 0.18),
        )

    raise RuntimeError(f"Unknown ground-life habitat: {habitat_id}")


def _inside_patch(local_x, local_y, patch):
    radius_x, radius_y = map(float, patch["radii"])
    return (local_x / radius_x) ** 2 + (local_y / radius_y) ** 2 <= 0.96**2


def _plant_position_is_valid(
    x,
    y,
    family,
    layout,
    clearing_edge_radius,
    terrain_boundary_radius,
    distance_to_path,
    paths,
    tree_placements,
    tree_assets,
    occupied,
):
    rules = layout["placementRules"]
    radius = math.hypot(x, y)
    angle = math.atan2(y, x)
    if radius < clearing_edge_radius(angle) + float(rules["clearingBufferMetres"]):
        return False
    if radius > terrain_boundary_radius(angle) * float(rules["outerBoundaryFraction"]):
        return False
    for path in paths:
        if distance_to_path(x, y, path) < float(path["halfWidth"]) + float(
            rules["pathCoreBufferMetres"]
        ):
            return False
    for tree in tree_placements:
        tree_asset = tree_assets[tree["assetId"]]
        trunk_clearance = 0.45 + float(tree_asset["footprintRadius"]) * 0.12
        if math.hypot(x - tree["x"], y - tree["y"]) < trunk_clearance:
            return False
    if _inside_tree_keep_out(x, y):
        return False
    clearance = PLANT_CLEARANCE[family]
    for occupied_x, occupied_y, occupied_clearance in occupied:
        if math.hypot(x - occupied_x, y - occupied_y) < (
            clearance + occupied_clearance
        ) * 0.68:
            return False
    return True


def _choose_variant(family, habitat_id, index, patch_seed):
    variants = FAMILY_VARIANTS[family]
    if family != "mushroom":
        return variants[(index + patch_seed) % len(variants)]
    if index == 0 and habitat_id in (
        "damp-willow-hollow",
        "beech-shade-fern-colony",
        "fallen-log-decomposition",
    ):
        return "mushroom-mature-colony"
    small_variants = (
        "mushroom-single",
        "mushroom-pair",
        "mushroom-small-colony",
        "mushroom-spent-colony",
    )
    return small_variants[(index + patch_seed) % len(small_variants)]


def _place_linked_object(prototype, collection, name, location, yaw, scale):
    obj = prototype.copy()
    obj.data = prototype.data
    collection.objects.link(obj)
    obj.name = name
    obj.hide_render = False
    obj.hide_viewport = False
    obj.hide_set(False)
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0.0, 0.0, yaw)
    obj.location = location
    obj.scale = scale
    return obj


def _place_small_mushroom_cluster(
    variant_id,
    x,
    y,
    yaw,
    scale,
    collection,
    mushroom_parts,
    terrain_height,
    name_prefix,
):
    pattern = MUSHROOM_PATTERNS[variant_id]
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    created = []
    for index, (local_x, local_y, height, cap_radius, cap_key) in enumerate(pattern):
        px = x + (local_x * cosine - local_y * sine) * scale
        py = y + (local_x * sine + local_y * cosine) * scale
        ground_z = terrain_height(px, py)
        stem = _place_linked_object(
            mushroom_parts["stem-amanita" if cap_key == "amanita" else "stem"],
            collection,
            f"{name_prefix}_Stem_{index:02d}",
            (px, py, ground_z + height * scale * 0.5),
            yaw + index * 0.73,
            (cap_radius * scale * 0.42, cap_radius * scale * 0.42, height * scale),
        )
        stem["tka_role"] = "ground-life-mushroom-part"
        created.append(stem)
        cap = _place_linked_object(
            mushroom_parts[cap_key],
            collection,
            f"{name_prefix}_Cap_{index:02d}",
            (px, py, ground_z + height * scale),
            yaw + index * 0.73,
            (
                cap_radius * scale,
                cap_radius * scale * (0.9 if cap_key != "spent" else 1.08),
                cap_radius * scale * (0.34 if cap_key != "spent" else 0.16),
            ),
        )
        cap["tka_role"] = "ground-life-mushroom-part"
        created.append(cap)
        if cap_key == "amanita":
            spot_count = 5 + index % 3
            for spot_index in range(spot_count):
                spot_angle = yaw + index * 0.83 + spot_index * 2.399963
                radial_fraction = 0.14 + 0.12 * ((spot_index * 3 + index) % 5)
                radial = cap_radius * scale * radial_fraction
                spot_radius = cap_radius * scale * (0.085 + 0.012 * (spot_index % 3))
                spot = _place_linked_object(
                    mushroom_parts["amanita-spot"],
                    collection,
                    f"{name_prefix}_Spot_{index:02d}_{spot_index:02d}",
                    (
                        px + math.cos(spot_angle) * radial,
                        py + math.sin(spot_angle) * radial,
                        ground_z
                        + height * scale
                        + cap_radius * scale * (0.34 - radial_fraction * 0.10),
                    ),
                    spot_angle,
                    (spot_radius, spot_radius, spot_radius * 0.48),
                )
                spot["tka_role"] = "ground-life-mushroom-part"
                created.append(spot)
    return created


def _stable_seed(value):
    return sum((index + 1) * ord(character) for index, character in enumerate(value))


def _smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0
    amount = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return amount * amount * (3.0 - 2.0 * amount)


def _meadow_distance_weight(x, y, tier):
    """Fade physical blades into the world-space ground atlas.

    Base coverage reaches furthest so every capable device keeps the clearing's
    silhouette. Medium and high tiers concentrate their extra blades where a
    walking camera can actually resolve them.
    """
    distance = math.hypot(x, y)
    broad_fade = 1.0 - _smoothstep(36.0, 86.0, distance)
    exponent = {"Base": 0.68, "Medium": 1.08, "High": 1.52}[tier]
    return broad_fade**exponent


def _sample_meadow_colony_centers(rng, base_count, radius_x, radius_y):
    """Create irregular macro-colonies instead of an even point field."""
    center_count = max(3, min(12, round(base_count / 38.0)))
    centers = []
    for _index in range(center_count):
        angle = rng.uniform(0.0, math.tau)
        normalized_radius = math.sqrt(rng.random()) * 0.72
        centers.append(
            (
                math.cos(angle) * radius_x * normalized_radius,
                math.sin(angle) * radius_y * normalized_radius,
                rng.uniform(0.13, 0.27) * radius_x,
                rng.uniform(0.13, 0.27) * radius_y,
            )
        )
    return centers


def _sample_meadow_colony_point(rng, centers, radius_x, radius_y):
    """Sample a point from an authored patch's overlapping plant colonies."""
    if rng.random() < 0.88:
        center_x, center_y, spread_x, spread_y = rng.choice(centers)
        local_x = center_x + rng.gauss(0.0, spread_x)
        local_y = center_y + rng.gauss(0.0, spread_y)
    else:
        angle = rng.uniform(0.0, math.tau)
        normalized_radius = math.sqrt(rng.random())
        local_x = math.cos(angle) * radius_x * normalized_radius
        local_y = math.sin(angle) * radius_y * normalized_radius
    normalized_radius = math.sqrt(
        (local_x / radius_x) ** 2 + (local_y / radius_y) ** 2
    )
    return local_x, local_y, normalized_radius


def _create_near_frame_grass(
    layout,
    layout_sha256,
    terrain_height,
    distance_to_path,
    paths,
    mushroom_positions,
):
    rules = layout["rules"]
    minimum_core_radius = float(rules["minimumGrassCoreRadiusMetres"])
    path_margin = float(rules["minimumGrassPathCoreMarginMetres"])
    palette_colors = {
        "base": (0.115, 0.285, 0.045),
        "lush": (0.085, 0.335, 0.050),
        "shade": (0.075, 0.215, 0.038),
    }
    materials = {
        palette: _flat_material(
            f"Forest Clearing Grass {palette.title()}",
            color,
            0.94,
        )
        for palette, color in palette_colors.items()
    }
    tiers = {
        "Base": {
            "attemptScale": 1.34,
            "spacing": 0.34,
            "blades": (28, 38),
            "colonyRadius": (0.32, 0.52),
            "forms": (("fine", 0.63), ("basal", 0.25), ("broad", 0.12)),
        },
        "Medium": {
            "attemptScale": 0.90,
            "spacing": 0.48,
            "blades": (18, 26),
            "colonyRadius": (0.34, 0.56),
            "forms": (
                ("fine", 0.32),
                ("broad", 0.38),
                ("arching", 0.25),
                ("seed", 0.05),
            ),
        },
        "High": {
            "attemptScale": 0.44,
            "spacing": 0.60,
            "blades": (10, 16),
            "colonyRadius": (0.36, 0.60),
            "forms": (
                ("fine", 0.16),
                ("broad", 0.26),
                ("arching", 0.42),
                ("seed", 0.16),
            ),
        },
    }
    positions_by_tier_palette = {
        tier: {palette: [] for palette in palette_colors} for tier in tiers
    }
    patch_counts = {patch["id"]: 0 for patch in layout["grassPatches"]}
    tier_counts = {tier: 0 for tier in tiers}
    tier_patch_counts = {
        tier: {patch["id"]: 0 for patch in layout["grassPatches"]} for tier in tiers
    }
    blade_counts = {tier: 0 for tier in tiers}
    form_counts = Counter()
    occupied_by_tier = {tier: {} for tier in tiers}

    for patch in layout["grassPatches"]:
        palette = patch["palette"]
        if palette not in palette_colors:
            raise RuntimeError(f"Unknown Forest clearing-grass palette: {palette}")
        center_x, center_y = map(float, patch["center"])
        radius_x, radius_y = map(float, patch["radii"])
        rotation = math.radians(float(patch["rotationDegrees"]))
        cosine = math.cos(rotation)
        sine = math.sin(rotation)
        base_count = int(patch["count"])
        for tier, tier_rules in tiers.items():
            rng = random.Random(
                int(layout["version"]) * 100003
                + _stable_seed(f"{patch['id']}:{tier}")
            )
            colony_centers = _sample_meadow_colony_centers(
                rng, base_count, radius_x, radius_y
            )
            attempts = round(base_count * tier_rules["attemptScale"])
            for _attempt in range(attempts):
                local_x, local_y, normalized_radius = _sample_meadow_colony_point(
                    rng, colony_centers, radius_x, radius_y
                )
                if normalized_radius >= 1.0:
                    continue
                x = center_x + local_x * cosine - local_y * sine
                y = center_y + local_x * sine + local_y * cosine
                habitat_weight = 1.0 - _smoothstep(0.78, 1.0, normalized_radius)
                habitat_weight *= _meadow_distance_weight(x, y, tier)
                if rng.random() > habitat_weight:
                    continue
                if math.hypot(x, y) < minimum_core_radius:
                    continue
                if any(
                    distance_to_path(x, y, path)
                    < float(path["halfWidth"]) + path_margin
                    for path in paths
                ):
                    continue
                if any(
                    math.hypot(x - mx, y - my) < 0.72
                    for mx, my in mushroom_positions
                ):
                    continue
                spacing = float(tier_rules["spacing"])
                cell_size = spacing
                occupied = occupied_by_tier[tier]
                cell_x = math.floor(x / cell_size)
                cell_y = math.floor(y / cell_size)
                if any(
                    (x - ox) ** 2 + (y - oy) ** 2 < spacing**2
                    for nx in range(cell_x - 2, cell_x + 3)
                    for ny in range(cell_y - 2, cell_y + 3)
                    for ox, oy in occupied.get((nx, ny), ())
                ):
                    continue
                occupied.setdefault((cell_x, cell_y), []).append((x, y))
                position = (x, y, patch["id"])
                positions_by_tier_palette[tier][palette].append(position)
                patch_counts[patch["id"]] += 1
                tier_counts[tier] += 1
                tier_patch_counts[tier][patch["id"]] += 1

    created = []
    for tier, palettes in positions_by_tier_palette.items():
        for palette, positions in palettes.items():
            if not positions:
                continue
            rng = random.Random(71003 + _stable_seed(f"{tier}:{palette}"))
            height_scale = {"base": 0.92, "lush": 1.08, "shade": 0.84}[palette]
            minimum_blades, maximum_blades = tiers[tier]["blades"]
            radius_minimum, radius_maximum = tiers[tier]["colonyRadius"]
            forms = tiers[tier]["forms"]
            form_names = [item[0] for item in forms]
            form_weights = [item[1] for item in forms]
            mesh_form_counts = Counter()
            prototypes = []
            prototype_count = 4
            for prototype_index in range(prototype_count):
                vertices = []
                faces = []
                vertex_uvs = []
                blade_count = rng.randint(minimum_blades, maximum_blades)
                colony_radius = rng.uniform(radius_minimum, radius_maximum)
                prototype_form_counts = Counter()
                for _blade_index in range(blade_count):
                    offset_angle = rng.uniform(0.0, math.tau)
                    offset_radius = math.sqrt(rng.random()) * colony_radius
                    root_x = math.cos(offset_angle) * offset_radius
                    root_y = math.sin(offset_angle) * offset_radius
                    yaw = rng.uniform(0.0, math.tau)
                    form = rng.choices(form_names, weights=form_weights, k=1)[0]
                    lean_angle = yaw + rng.uniform(-0.62, 0.62)
                    if form == "basal":
                        width = rng.uniform(0.010, 0.021)
                        height = rng.uniform(0.075, 0.16) * height_scale
                        lean = height * rng.uniform(0.52, 0.92)
                    elif form == "broad":
                        width = rng.uniform(0.016, 0.031)
                        height = rng.uniform(0.14, 0.30) * height_scale
                        lean = height * rng.uniform(0.34, 0.68)
                    elif form == "arching":
                        width = rng.uniform(0.008, 0.016)
                        height = rng.uniform(0.27, 0.50) * height_scale
                        lean = height * rng.uniform(0.30, 0.54)
                    elif form == "seed":
                        width = 0.0045
                        height = rng.uniform(0.44, 0.68) * height_scale
                        lean = height * rng.uniform(0.08, 0.18)
                    else:
                        width = rng.uniform(0.0065, 0.0135)
                        height = rng.uniform(0.12, 0.31) * height_scale
                        lean = height * rng.uniform(0.14, 0.36)

                    if form == "seed":
                        _append_meadow_seed_head(
                            vertices,
                            faces,
                            vertex_uvs,
                            root_x,
                            root_y,
                            0.0,
                            yaw,
                            height,
                            lean_angle,
                            lean,
                        )
                    else:
                        _append_meadow_blade(
                            vertices,
                            faces,
                            vertex_uvs,
                            root_x,
                            root_y,
                            0.0,
                            yaw,
                            width,
                            height,
                            lean_angle,
                            lean,
                        )
                    prototype_form_counts[form] += 1

                mesh = bpy.data.meshes.new(
                    f"Forest Clearing Grass {tier} {palette.title()} Prototype {prototype_index + 1} Mesh"
                )
                mesh.from_pydata(vertices, [], faces)
                mesh.update()
                mesh.materials.append(materials[palette])
                uv_layer = mesh.uv_layers.new(name="Forest Grass Root Weight")
                for polygon in mesh.polygons:
                    for loop_index in polygon.loop_indices:
                        vertex_index = mesh.loops[loop_index].vertex_index
                        uv_layer.data[loop_index].uv = vertex_uvs[vertex_index]
                prototypes.append((mesh, prototype_form_counts))

            for clump_x, clump_y, _patch_id in positions:
                prototype_index = rng.randrange(prototype_count)
                mesh, prototype_form_counts = prototypes[prototype_index]
                obj = bpy.data.objects.new(
                    f"Forest_Grass_{tier}_{palette.title()}_{len(created) + 1:04d}",
                    mesh,
                )
                bpy.context.scene.collection.objects.link(obj)
                obj.location = (
                    clump_x,
                    clump_y,
                    terrain_height(clump_x, clump_y) + 0.010,
                )
                obj.rotation_euler.z = rng.uniform(0.0, math.tau)
                scale = rng.uniform(0.82, 1.18)
                obj.scale = (scale, scale * rng.uniform(0.88, 1.12), scale)
                obj["tka_role"] = "near-frame-grass"
                obj["tka_export_layer"] = "near-frame"
                obj["tka_static_prop_layout_version"] = int(layout["version"])
                obj["tka_static_prop_layout_sha256"] = layout_sha256
                obj["tka_meadow_system_version"] = 3
                obj["tka_grass_quality_tier"] = tier.lower()
                obj["tka_grass_clumps"] = 1
                obj["tka_grass_blades"] = sum(prototype_form_counts.values())
                obj["tka_grass_forms"] = "|".join(sorted(prototype_form_counts))
                obj["tka_grass_patch_ids"] = _patch_id
                created.append(obj)
                for form, count in prototype_form_counts.items():
                    mesh_form_counts[form] += count
                    form_counts[form] += count
                    blade_counts[tier] += count

    return (
        created,
        patch_counts,
        tier_counts,
        tier_patch_counts,
        blade_counts,
        dict(form_counts),
    )


def _resample_polyline(points, spacing, maximum_length):
    samples = [tuple(map(float, points[0]))]
    travelled = 0.0
    for first, second in zip(points, points[1:]):
        first_x, first_y = map(float, first)
        second_x, second_y = map(float, second)
        segment_length = math.hypot(second_x - first_x, second_y - first_y)
        segment_steps = max(1, math.ceil(segment_length / spacing))
        for step in range(1, segment_steps + 1):
            amount = step / segment_steps
            distance = segment_length / segment_steps
            if travelled + distance > maximum_length:
                remaining = maximum_length - travelled
                if remaining > 0.001:
                    final_amount = (step - 1 + remaining / distance) / segment_steps
                    samples.append(
                        (
                            first_x + (second_x - first_x) * final_amount,
                            first_y + (second_y - first_y) * final_amount,
                        )
                    )
                return samples
            samples.append(
                (
                    first_x + (second_x - first_x) * amount,
                    first_y + (second_y - first_y) * amount,
                )
            )
            travelled += distance
    return samples


def _create_near_frame_trail(
    layout,
    layout_sha256,
    terrain_height,
    paths,
):
    accent = layout["trailAccent"]
    path = next((item for item in paths if item["id"] == accent["pathId"]), None)
    if path is None:
        raise RuntimeError(f"Forest trail accent references an unknown path: {accent['pathId']}")

    samples = _resample_polyline(
        path["points"],
        float(accent["sampleSpacingMetres"]),
        float(accent["maximumDistanceMetres"]),
    )
    rng = random.Random(91009 + _stable_seed(accent["id"]))
    core_material = _transparent_flat_material(
        "Forest Worn Trail Core",
        (0.49, 0.33, 0.17),
        0.5,
        0.98,
    )
    edge_material = _transparent_flat_material(
        "Forest Worn Trail Edge",
        (0.43, 0.29, 0.15),
        0.18,
        0.99,
    )
    vertices = []
    faces = []
    width_scale = float(accent["halfWidthScale"])
    edge_jitter = float(accent["edgeJitterMetres"])
    row_width = 5

    for index, (x, y) in enumerate(samples):
        previous = samples[max(0, index - 1)]
        following = samples[min(len(samples) - 1, index + 1)]
        tangent_x = following[0] - previous[0]
        tangent_y = following[1] - previous[1]
        tangent_length = max(0.0001, math.hypot(tangent_x, tangent_y))
        normal_x = -tangent_y / tangent_length
        normal_y = tangent_x / tangent_length
        half_width = float(path["halfWidth"]) * width_scale
        left_width = half_width + rng.uniform(-edge_jitter, edge_jitter)
        right_width = half_width + rng.uniform(-edge_jitter, edge_jitter)
        for band, amount in enumerate((-1.0, -0.48, 0.0, 0.48, 1.0)):
            width = left_width if amount < 0 else right_width
            px = x + normal_x * width * amount
            py = y + normal_y * width * amount
            crown = 0.008 + 0.003 * (1.0 - abs(amount))
            undulation = 0.001 * math.sin(index * 1.71 + band * 0.83)
            vertices.append((px, py, terrain_height(px, py) + crown + undulation))

    for row in range(len(samples) - 1):
        start = row * row_width
        next_start = (row + 1) * row_width
        for band in range(row_width - 1):
            faces.append(
                (
                    start + band,
                    start + band + 1,
                    next_start + band + 1,
                    next_start + band,
                )
            )

    mesh = bpy.data.meshes.new("Forest Worn Trail Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(core_material)
    mesh.materials.append(edge_material)
    for polygon in mesh.polygons:
        polygon.material_index = 0 if polygon.index % (row_width - 1) in (1, 2) else 1
    obj = bpy.data.objects.new("Forest_Trail_UpstageWoodland", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.visible_shadow = False
    obj["tka_role"] = "near-frame-trail"
    obj["tka_export_layer"] = "near-frame"
    obj["tka_static_prop_layout_version"] = int(layout["version"])
    obj["tka_static_prop_layout_sha256"] = layout_sha256
    obj["tka_trail_accent_id"] = accent["id"]
    obj["tka_trail_path_id"] = accent["pathId"]
    obj["tka_trail_sample_count"] = len(samples)
    return obj, {
        "id": accent["id"],
        "pathId": accent["pathId"],
        "sampleCount": len(samples),
        "maximumDistanceMetres": float(accent["maximumDistanceMetres"]),
    }


def _module_local_position(habitat_id, module_type, index, count, patch, rng):
    radius_x, radius_y = map(float, patch["radii"])
    if module_type == "fallen-log":
        return 0.0, 0.04 * radius_y, 0.0, (radius_x * 0.58, 1.0, 1.0)
    if module_type == "root-arc":
        if habitat_id == "root-crossing-litter-drift":
            fan_offsets = (-0.62, -0.20, 0.24, 0.68)
            yaw = math.pi * 0.5 + fan_offsets[index % len(fan_offsets)]
            length_scale = (1.35, 1.72, 1.55, 1.18)[index % 4]
            origin_x = -radius_x * 0.18
            origin_y = -radius_y * 0.78
            return (
                origin_x + math.cos(yaw) * length_scale,
                origin_y + math.sin(yaw) * length_scale,
                yaw,
                (length_scale, 0.62, 0.62),
            )
        yaw = (-0.62, 0.52)[index % 2]
        length_scale = (1.28, 1.52)[index % 2]
        return (
            math.cos(yaw) * length_scale,
            math.sin(yaw) * length_scale,
            yaw,
            (length_scale, 0.68, 0.68),
        )
    if module_type == "leaf-drift":
        side = -0.22 if habitat_id in ("fallen-log-decomposition", "root-crossing-litter-drift") else 0.08
        return (
            rng.uniform(-0.56, 0.56) * radius_x,
            rng.gauss(side * radius_y, radius_y * 0.16),
            rng.uniform(-0.35, 0.35),
            (rng.uniform(0.76, 1.04), rng.uniform(0.68, 0.96), 1.0),
        )
    if module_type == "moss-mat":
        if habitat_id == "root-crossing-litter-drift":
            return (
                rng.uniform(-0.56, 0.56) * radius_x,
                rng.choice((-1.0, 1.0)) * rng.uniform(0.74, 0.88) * radius_y,
                rng.uniform(0.0, math.tau),
                (rng.uniform(0.68, 0.92), rng.uniform(0.62, 0.88), 1.0),
            )
        return (
            rng.uniform(-0.65, 0.65) * radius_x,
            rng.uniform(-0.55, 0.55) * radius_y,
            rng.uniform(0.0, math.tau),
            (rng.uniform(0.62, 0.94), rng.uniform(0.58, 0.88), 1.0),
        )
    if module_type == "twig":
        return (
            rng.uniform(-0.72, 0.72) * radius_x,
            rng.uniform(-0.62, 0.62) * radius_y,
            rng.uniform(0.0, math.tau),
            (rng.uniform(0.7, 1.3), rng.uniform(0.8, 1.1), rng.uniform(0.8, 1.1)),
        )
    raise RuntimeError(f"Unknown Forest ground module: {module_type}")


def _nearest_tree_distance(center, tree_placements):
    return min(
        math.hypot(float(center[0]) - tree["x"], float(center[1]) - tree["y"])
        for tree in tree_placements
    )


def _nearest_neighbour_cv(points):
    if len(points) < 3:
        return 0.0
    nearest = []
    for index, point in enumerate(points):
        nearest.append(
            min(
                math.hypot(point[0] - other[0], point[1] - other[1])
                for other_index, other in enumerate(points)
                if other_index != index
            )
        )
    mean = sum(nearest) / len(nearest)
    if mean <= 0.0001:
        return 0.0
    variance = sum((value - mean) ** 2 for value in nearest) / len(nearest)
    return math.sqrt(variance) / mean


def build_ground_life(
    *,
    project_root,
    layout,
    layout_sha256,
    ecology,
    ecology_sha256,
    terrain,
    terrain_height,
    terrain_boundary_radius,
    clearing_edge_radius,
    distance_to_path,
    paths,
    tree_placements,
    tree_assets,
    qa_dir,
    near_frame_layout=None,
    near_frame_layout_sha256=None,
    tree_grass_keep_outs=None,
):
    set_tree_keep_outs(tree_grass_keep_outs or [])
    habitat_definitions = {habitat["id"]: habitat for habitat in ecology["habitats"]}
    ground_collection = bpy.data.collections.new("Forest Ground Life")
    bpy.context.scene.collection.children.link(ground_collection)
    prototype_collection = bpy.data.collections.new("Forest Ground Life Prototypes")
    bpy.context.scene.collection.children.link(prototype_collection)
    sources, variants, modules, mushroom_parts = _make_prototypes(
        project_root,
        ecology,
        prototype_collection,
    )

    global_rng = random.Random(int(layout["seed"]))
    occupied = []
    plant_records = []
    module_records = []
    patch_metrics = []
    variant_counts = Counter()
    family_counts = Counter()
    habitat_counts = Counter()
    module_counts = Counter()
    near_frame_objects = []
    near_frame_metrics = {
        "grassPatchCounts": {},
        "grassClumpCount": 0,
        "grassTierCounts": {},
        "grassTierPatchCounts": {},
        "grassBladeCounts": {},
        "grassFormCounts": {},
        "groundEcosystem": None,
        "mushroomColonies": [],
        "mushroomPartCount": 0,
        "trail": None,
    }

    for patch_index, patch in enumerate(layout["patches"]):
        habitat_id = patch["habitatId"]
        if habitat_id not in habitat_definitions:
            raise RuntimeError(f"Unknown habitat in ground-life layout: {habitat_id}")
        habitat = habitat_definitions[habitat_id]
        patch_seed = int(layout["seed"]) + int(patch["seed"]) + patch_index * 104729
        rng = random.Random(patch_seed)
        density_scale = float(patch["densityScale"])
        patch_points = []
        patch_family_counts = Counter()
        patch_variant_counts = Counter()
        patch_module_counts = Counter()
        mature_colonies = 0

        for family, base_count in BASE_PLANT_COUNTS[habitat_id].items():
            count = max(1, round(base_count * density_scale))
            for family_index in range(count):
                variant_id = _choose_variant(family, habitat_id, family_index, patch_seed)
                if variant_id == "mushroom-mature-colony":
                    mature_colonies += 1
                for _ in range(2500):
                    local_x, local_y = _sample_local(
                        patch,
                        habitat_id,
                        family,
                        rng,
                        family_index,
                    )
                    if not _inside_patch(local_x, local_y, patch):
                        continue
                    x, y = _local_to_world(patch, local_x, local_y)
                    if not _plant_position_is_valid(
                        x,
                        y,
                        family,
                        layout,
                        clearing_edge_radius,
                        terrain_boundary_radius,
                        distance_to_path,
                        paths,
                        tree_placements,
                        tree_assets,
                        occupied,
                    ):
                        continue
                    break
                else:
                    raise RuntimeError(
                        f"Could not place {family} in Forest habitat patch {patch['id']}"
                    )

                yaw = rng.uniform(0.0, math.tau)
                scale = rng.uniform(0.86, 1.14)
                z = terrain_height(x, y) + 0.012
                object_name = f"ForestGround_{patch['id']}_{variant_id}_{family_index:02d}"
                if variant_id in MUSHROOM_PATTERNS:
                    _place_small_mushroom_cluster(
                        variant_id,
                        x,
                        y,
                        yaw,
                        scale,
                        ground_collection,
                        mushroom_parts,
                        terrain_height,
                        object_name,
                    )
                else:
                    obj = _place_linked_object(
                        variants[variant_id],
                        ground_collection,
                        object_name,
                        (x, y, z),
                        yaw,
                        (scale, scale, scale),
                    )
                    obj["tka_role"] = "ground-life"
                    obj["tka_ground_family"] = family
                    obj["tka_ground_variant"] = variant_id
                    obj["tka_ground_habitat"] = habitat_id
                    obj["tka_ground_patch"] = patch["id"]

                occupied.append((x, y, PLANT_CLEARANCE[family]))
                patch_points.append((x, y))
                record = {
                    "patchId": patch["id"],
                    "habitatId": habitat_id,
                    "family": family,
                    "variant": variant_id,
                    "position": [round(x, 4), round(y, 4), round(z, 4)],
                    "rotationRadians": round(yaw, 5),
                    "scale": round(scale, 5),
                }
                plant_records.append(record)
                family_counts[family] += 1
                variant_counts[variant_id] += 1
                habitat_counts[habitat_id] += 1
                patch_family_counts[family] += 1
                patch_variant_counts[variant_id] += 1

        maximum_mature = int(
            layout["placementRules"]["maximumMatureMushroomColoniesPerPatch"]
        )
        if mature_colonies > maximum_mature:
            raise RuntimeError(
                f"Patch {patch['id']} has {mature_colonies} mature mushroom colonies"
            )

        for module_type, base_count in BASE_MODULE_COUNTS[habitat_id].items():
            count = max(1, round(base_count * math.sqrt(density_scale)))
            for module_index in range(count):
                for _ in range(250):
                    local_x, local_y, local_yaw, module_scale = _module_local_position(
                        habitat_id,
                        module_type,
                        module_index,
                        count,
                        patch,
                        rng,
                    )
                    x, y = _local_to_world(patch, local_x, local_y)
                    if module_type == "root-arc" or all(
                        distance_to_path(x, y, path)
                        >= float(path["halfWidth"]) + 0.18
                        for path in paths
                    ):
                        break
                else:
                    raise RuntimeError(
                        f"Could not keep {module_type} out of a path core in {patch['id']}"
                    )
                patch_yaw = math.radians(float(patch.get("rotationDegrees", 0.0)))
                prototype_options = modules[module_type]
                prototype = prototype_options[
                    (module_index + patch_seed) % len(prototype_options)
                ]
                module_ground_offset = -0.018 if module_type == "root-arc" else 0.008
                module = _place_linked_object(
                    prototype,
                    ground_collection,
                    f"ForestGround_{patch['id']}_{module_type}_{module_index:02d}",
                    (x, y, terrain_height(x, y) + module_ground_offset),
                    patch_yaw + local_yaw,
                    module_scale,
                )
                module["tka_role"] = "ground-module"
                module["tka_ground_module"] = module_type
                module["tka_ground_habitat"] = habitat_id
                module["tka_ground_patch"] = patch["id"]
                module_records.append(
                    {
                        "patchId": patch["id"],
                        "habitatId": habitat_id,
                        "type": module_type,
                        "position": [round(x, 4), round(y, 4)],
                    }
                )
                module_counts[module_type] += 1
                patch_module_counts[module_type] += 1

        nearest_tree_distance = _nearest_tree_distance(patch["center"], tree_placements)
        nearest_path_core_clearance = min(
            distance_to_path(point[0], point[1], path) - float(path["halfWidth"])
            for point in patch_points
            for path in paths
        )
        patch_metrics.append(
            {
                "id": patch["id"],
                "habitatId": habitat_id,
                "premise": habitat["premise"],
                "negativeSpaceFraction": float(habitat["negativeSpaceFraction"]),
                "plantCount": len(patch_points),
                "familyCounts": dict(patch_family_counts),
                "variantCounts": dict(patch_variant_counts),
                "moduleCounts": dict(patch_module_counts),
                "matureMushroomColonies": mature_colonies,
                "nearestTreeDistanceMetres": nearest_tree_distance,
                "minimumPathCoreClearanceMetres": nearest_path_core_clearance,
                "nearestNeighbourCv": _nearest_neighbour_cv(patch_points),
            }
        )

    if near_frame_layout is not None:
        if near_frame_layout_sha256 is None:
            raise RuntimeError("Forest near-frame ground life requires a layout hash")
        mushroom_positions = []
        for colony in near_frame_layout["mushroomColonies"]:
            pattern = colony["pattern"]
            if pattern not in MUSHROOM_PATTERNS:
                raise RuntimeError(f"Unknown Forest near-frame mushroom pattern: {pattern}")
            x, y = map(float, colony["position"])
            mushroom_positions.append((x, y))
            created = _place_small_mushroom_cluster(
                pattern,
                x,
                y,
                math.radians(float(colony["rotationDegrees"])),
                float(colony["scale"]),
                ground_collection,
                mushroom_parts,
                terrain_height,
                f"ForestNearFrameMushroom_{colony['id']}",
            )
            for obj in created:
                obj["tka_role"] = "near-frame-mushroom-part"
                obj["tka_export_layer"] = "near-frame"
                obj["tka_static_prop_layout_version"] = int(near_frame_layout["version"])
                obj["tka_static_prop_layout_sha256"] = near_frame_layout_sha256
                obj["tka_mushroom_colony_id"] = colony["id"]
                obj["tka_mushroom_pattern"] = pattern
            near_frame_objects.extend(created)
            near_frame_metrics["mushroomColonies"].append(colony["id"])
            near_frame_metrics["mushroomPartCount"] += len(created)

        grass_objects, ecosystem_metrics = create_forest_ground_ecosystem(
            project_root=project_root,
            layout=near_frame_layout,
            layout_sha256=near_frame_layout_sha256,
            terrain_height=terrain_height,
            terrain_boundary_radius=terrain_boundary_radius,
            clearing_edge_radius=clearing_edge_radius,
            distance_to_path=distance_to_path,
            paths=paths,
            mushroom_positions=mushroom_positions,
        )
        near_frame_objects.extend(grass_objects)
        near_frame_metrics["grassPatchCounts"] = ecosystem_metrics["patchCounts"]
        near_frame_metrics["grassClumpCount"] = sum(
            ecosystem_metrics["speciesCounts"].values()
        )
        near_frame_metrics["grassTierCounts"] = ecosystem_metrics["tierCounts"]
        near_frame_metrics["grassTierPatchCounts"] = ecosystem_metrics["tierPatchCounts"]
        near_frame_metrics["groundEcosystem"] = ecosystem_metrics

        trail_object, trail_metrics = _create_near_frame_trail(
            near_frame_layout,
            near_frame_layout_sha256,
            terrain_height,
            paths,
        )
        near_frame_objects.append(trail_object)
        near_frame_metrics["trail"] = trail_metrics

    prototype_names = {
        prototype.name
        for prototype in (
            list(sources.values())
            + list(variants.values())
            + [prototype for group in modules.values() for prototype in group]
            + list(mushroom_parts.values())
        )
    }
    for prototype_name in prototype_names:
        prototype = bpy.data.objects.get(prototype_name)
        if prototype is not None:
            bpy.data.objects.remove(prototype, do_unlink=True)
    bpy.data.collections.remove(prototype_collection)

    expected_variant_ids = [
        f"{family['id']}-{variant}"
        for family in ecology["families"]
        for variant in family["variants"]
    ]
    expected_module_types = list(ecology["groundModules"])
    rules = layout["placementRules"]
    furthest_tree_patch = max(
        patch_metrics,
        key=lambda metric: metric["nearestTreeDistanceMetres"],
    )
    maximum_tree_anchor_distance = furthest_tree_patch["nearestTreeDistanceMetres"]
    minimum_path_clearance = min(
        metric["minimumPathCoreClearanceMetres"] for metric in patch_metrics
    )
    minimum_clearing_clearance = min(
        math.hypot(record["position"][0], record["position"][1])
        - clearing_edge_radius(math.atan2(record["position"][1], record["position"][0]))
        for record in plant_records
    )

    terrain["tka_ground_life_phase"] = "ground-life-ecology"
    terrain["tka_ground_layout_version"] = int(layout["version"])
    terrain["tka_ground_layout_sha256"] = layout_sha256
    terrain["tka_ground_ecology_version"] = int(ecology["version"])
    terrain["tka_ground_ecology_sha256"] = ecology_sha256
    terrain["tka_ground_patch_count"] = len(layout["patches"])
    terrain["tka_ground_plant_count"] = len(plant_records)
    terrain["tka_ground_habitat_ids"] = "|".join(habitat_definitions.keys())
    terrain["tka_ground_habitat_counts"] = [
        habitat_counts[habitat_id] for habitat_id in habitat_definitions
    ]
    terrain["tka_ground_variant_ids"] = "|".join(expected_variant_ids)
    terrain["tka_ground_variant_counts"] = [
        variant_counts[variant_id] for variant_id in expected_variant_ids
    ]
    terrain["tka_ground_module_types"] = "|".join(expected_module_types)
    terrain["tka_ground_module_counts"] = [
        module_counts[module_type] for module_type in expected_module_types
    ]
    terrain["tka_ground_full_root_island_count"] = 0
    terrain["tka_ground_minimum_clearing_clearance"] = minimum_clearing_clearance
    terrain["tka_ground_minimum_path_core_clearance"] = minimum_path_clearance

    if len(plant_records) < int(rules["minimumPlantInstances"]):
        raise RuntimeError(
            f"Forest ground life is too sparse: {len(plant_records)} plants"
        )
    if len(layout["patches"]) < int(rules["minimumHabitatPatches"]):
        raise RuntimeError("Forest ground life lost required habitat patches")
    if sum(1 for count in variant_counts.values() if count > 0) < int(
        rules["minimumVariantCoverage"]
    ):
        raise RuntimeError("Forest ground life lost approved family variants")
    if sum(1 for count in module_counts.values() if count > 0) < int(
        rules["minimumModuleTypeCoverage"]
    ):
        raise RuntimeError("Forest ground life lost approved module types")
    if maximum_tree_anchor_distance > float(rules["maximumTreeAnchorDistanceMetres"]):
        raise RuntimeError(
            "Forest ground-life patch drifted away from the canopy: "
            f"{furthest_tree_patch['id']} at {maximum_tree_anchor_distance:.3f} m"
        )
    if minimum_path_clearance < float(rules["pathCoreBufferMetres"]) - 0.001:
        raise RuntimeError(
            f"Forest ground life entered a path core: {minimum_path_clearance:.3f} m"
        )
    if minimum_clearing_clearance < float(rules["clearingBufferMetres"]) - 0.001:
        raise RuntimeError(
            "Forest ground life entered the clearing: "
            f"{minimum_clearing_clearance:.3f} m"
        )

    os.makedirs(qa_dir, exist_ok=True)
    metrics_path = os.path.join(qa_dir, "forest_environment_ground_life_metrics.json")
    metrics = {
        "layoutVersion": int(layout["version"]),
        "layoutSha256": layout_sha256,
        "ecologyVersion": int(ecology["version"]),
        "ecologySha256": ecology_sha256,
        "patchCount": len(layout["patches"]),
        "plantInstanceCount": len(plant_records),
        "moduleInstanceCount": len(module_records),
        "familyCounts": dict(family_counts),
        "habitatCounts": dict(habitat_counts),
        "variantCounts": {variant_id: variant_counts[variant_id] for variant_id in expected_variant_ids},
        "moduleCounts": {module_type: module_counts[module_type] for module_type in expected_module_types},
        "fullRootIslandInstances": 0,
        "minimumClearingClearanceMetres": minimum_clearing_clearance,
        "minimumPathCoreClearanceMetres": minimum_path_clearance,
        "maximumTreeAnchorDistanceMetres": maximum_tree_anchor_distance,
        "patches": patch_metrics,
        "plants": plant_records,
        "modules": module_records,
        "determinismProbe": global_rng.random(),
    }
    with open(metrics_path, "w", encoding="utf-8") as metrics_file:
        json.dump(metrics, metrics_file, indent=2)
        metrics_file.write("\n")

    print("\nForest ground-life verification")
    print(f"Habitat patches:                   {len(layout['patches'])}")
    print(f"Plant instances:                  {len(plant_records)}")
    print(f"Ground modules:                   {len(module_records)}")
    print(f"Minimum clearing clearance:       {minimum_clearing_clearance:.3f} m")
    print(f"Minimum path-core clearance:      {minimum_path_clearance:.3f} m")
    print(f"Maximum tree-anchor distance:     {maximum_tree_anchor_distance:.3f} m")
    print(f"Family counts:                    {dict(family_counts)}")
    print(f"Module counts:                    {dict(module_counts)}")
    print(f"Ground-life metrics:              {metrics_path}")
    return metrics, near_frame_objects, near_frame_metrics
