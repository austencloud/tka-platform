"""Inspect conditioned dimensions and topology for the scanned Forest ground ecosystem."""

import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "scripts/forest-ground-ecosystem-assets.json").read_text())
OUTPUT = ROOT / "docs/superpowers/specs/moonlit-firefly-forest/evidence/ground-ecosystem-r1/source-inspection.json"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def inspect(candidate):
    clear_scene()
    path = ROOT / candidate["source"]["localPath"]
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = [min(point[i] for point in corners) for i in range(3)]
    maximum = [max(point[i] for point in corners) for i in range(3)]
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    variants = []
    for obj in meshes:
        local_minimum = [min(vertex.co[i] for vertex in obj.data.vertices) for i in range(3)]
        local_maximum = [max(vertex.co[i] for vertex in obj.data.vertices) for i in range(3)]
        world_corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        world_minimum = [min(point[i] for point in world_corners) for i in range(3)]
        world_maximum = [max(point[i] for point in world_corners) for i in range(3)]
        obj.data.calc_loop_triangles()
        variants.append({
            "name": obj.name,
            "triangles": len(obj.data.loop_triangles),
            "localDimensions": [local_maximum[i] - local_minimum[i] for i in range(3)],
            "worldDimensions": [world_maximum[i] - world_minimum[i] for i in range(3)],
            "location": list(obj.location),
            "rotation": list(obj.rotation_euler),
            "scale": list(obj.scale),
        })
    return {
        "id": candidate["id"],
        "source": str(path.relative_to(ROOT)),
        "meshCount": len(meshes),
        "triangles": triangles,
        "dimensionsMetres": [maximum[i] - minimum[i] for i in range(3)],
        "targetHeightMetres": candidate["targetHeightMetres"],
        "materials": sorted(
            {
                material.name
                for obj in meshes
                for material in obj.data.materials
                if material is not None
            }
        ),
        "variants": variants,
    }


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
payload = {"manifestVersion": MANIFEST["version"], "sources": [inspect(item) for item in MANIFEST["candidates"]]}
OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
