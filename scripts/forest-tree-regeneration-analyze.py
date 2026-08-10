"""Measure loose geometry and ground-contact components in the Meshy 6 preview."""

import json
from collections import deque
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "scripts" / "forest-tree-regeneration.json").read_text(encoding="utf-8"))
CANDIDATE = MANIFEST["candidate"]
ASSET = ROOT / MANIFEST["outputDirectory"] / f"{CANDIDATE['id']}_preview.glb"
OUTPUT = ROOT / MANIFEST["evidenceDirectory"] / "forest-tree-regeneration-preview-topology.json"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ASSET))

payload = {"asset": str(ASSET), "meshes": []}
for obj in [candidate for candidate in bpy.context.scene.objects if candidate.type == "MESH"]:
    mesh = obj.data
    adjacency = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        first, second = edge.vertices
        adjacency[first].append(second)
        adjacency[second].append(first)

    unseen = set(range(len(mesh.vertices)))
    components = []
    while unseen:
        start = unseen.pop()
        queue = deque([start])
        indices = [start]
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    queue.append(neighbor)
                    indices.append(neighbor)
        points = [obj.matrix_world @ mesh.vertices[index].co for index in indices]
        minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
        maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
        components.append(
            {
                "vertices": len(indices),
                "minimum": list(minimum),
                "maximum": list(maximum),
                "dimensions": list(maximum - minimum),
            }
        )

    global_minimum_z = min(component["minimum"][2] for component in components)
    global_maximum_z = max(component["maximum"][2] for component in components)
    ground_tolerance = max(0.02, (global_maximum_z - global_minimum_z) * 0.015)
    for component in components:
        component["touchesGround"] = component["minimum"][2] <= global_minimum_z + ground_tolerance
    components.sort(key=lambda component: component["vertices"], reverse=True)
    payload["meshes"].append(
        {
            "name": obj.name,
            "vertices": len(mesh.vertices),
            "edges": len(mesh.edges),
            "polygons": len(mesh.polygons),
            "componentCount": len(components),
            "groundContactComponentCount": sum(1 for component in components if component["touchesGround"]),
            "largestComponents": components[:30],
        }
    )

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
