"""Measure how much authored tree foliage survives steep viewing angles.

Run with Blender in background mode and pass one or more staged GLB paths after
``--``.  The report is intentionally geometry-based so it can gate canopy
changes without relying on a particular camera or screenshot.
"""

import json
import math
import os
import sys

import bpy


FOLIAGE_MARKERS = ("leaf", "leaves", "twig", "foliage", "needle")


def source_paths():
    try:
        separator = sys.argv.index("--")
    except ValueError:
        return []
    return [os.path.abspath(path) for path in sys.argv[separator + 1 :]]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def polygon_area(mesh, polygon):
    return polygon.area


def inspect_source(path):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one mesh in {path}, found {len(meshes)}")

    obj = meshes[0]
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    mesh = obj.data
    foliage_slots = {
        index
        for index, slot in enumerate(obj.material_slots)
        if slot.material
        and any(marker in slot.material.name.lower() for marker in FOLIAGE_MARKERS)
    }
    if not foliage_slots:
        raise RuntimeError(f"No foliage material found in {path}")

    buckets = {
        "verticalCard": {"area": 0.0, "faces": 0},
        "oblique": {"area": 0.0, "faces": 0},
        "topFacing": {"area": 0.0, "faces": 0},
    }
    total_area = 0.0
    total_faces = 0
    foliage_polygons = []
    for polygon in mesh.polygons:
        if polygon.material_index not in foliage_slots:
            continue
        foliage_polygons.append(polygon)
        area = polygon_area(mesh, polygon)
        total_area += area
        total_faces += 1
        absolute_z = abs(polygon.normal.z)
        if absolute_z < 0.25:
            bucket = "verticalCard"
        elif absolute_z < 0.7:
            bucket = "oblique"
        else:
            bucket = "topFacing"
        buckets[bucket]["area"] += area
        buckets[bucket]["faces"] += 1

    polygons_by_vertex = {}
    for polygon in foliage_polygons:
        for vertex_index in polygon.vertices:
            polygons_by_vertex.setdefault(vertex_index, []).append(polygon.index)
    foliage_indices = {polygon.index for polygon in foliage_polygons}
    visited = set()
    component_sizes = []
    for start_index in foliage_indices:
        if start_index in visited:
            continue
        stack = [start_index]
        visited.add(start_index)
        component_size = 0
        while stack:
            polygon_index = stack.pop()
            component_size += 1
            polygon = mesh.polygons[polygon_index]
            for vertex_index in polygon.vertices:
                for neighbor_index in polygons_by_vertex[vertex_index]:
                    if neighbor_index not in visited:
                        visited.add(neighbor_index)
                        stack.append(neighbor_index)
        component_sizes.append(component_size)
    component_sizes.sort()

    for bucket in buckets.values():
        bucket["areaShare"] = (
            round(bucket["area"] / total_area, 6) if total_area else 0.0
        )
        bucket["area"] = round(bucket["area"], 4)

    return {
        "source": os.path.relpath(path, os.getcwd()).replace("\\", "/"),
        "materials": [
            obj.material_slots[index].material.name for index in sorted(foliage_slots)
        ],
        "foliageFaces": total_faces,
        "foliageArea": round(total_area, 4),
        "connectedComponents": {
            "count": len(component_sizes),
            "minimumFaces": component_sizes[0] if component_sizes else 0,
            "medianFaces": component_sizes[len(component_sizes) // 2]
            if component_sizes
            else 0,
            "p90Faces": component_sizes[math.floor((len(component_sizes) - 1) * 0.9)]
            if component_sizes
            else 0,
            "maximumFaces": component_sizes[-1] if component_sizes else 0,
        },
        "orientation": buckets,
        "overheadCoverageScore": round(
            buckets["topFacing"]["areaShare"]
            + 0.45 * buckets["oblique"]["areaShare"],
            6,
        ),
    }


paths = source_paths()
if not paths:
    raise SystemExit("Pass staged GLB paths after --")

print("FOREST_FOLIAGE_ORIENTATION_BEGIN")
print(json.dumps([inspect_source(path) for path in paths], indent=2))
print("FOREST_FOLIAGE_ORIENTATION_END")
