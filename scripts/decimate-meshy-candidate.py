"""Create a triangle-budgeted review copy of one Meshy geometry candidate."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--target-triangles", type=int, required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def triangle_count(obj: bpy.types.Object) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(input_path))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh objects found in {input_path}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()

    candidate = bpy.context.view_layer.objects.active
    source_triangles = triangle_count(candidate)
    ratio = min(1.0, max(0.001, args.target_triangles / source_triangles))

    modifier = candidate.modifiers.new(name="Runtime triangle budget", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    result_triangles = triangle_count(candidate)

    bpy.ops.object.select_all(action="DESELECT")
    candidate.select_set(True)
    bpy.context.view_layer.objects.active = candidate
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
    )
    print(
        json.dumps(
            {
                "input": str(input_path),
                "output": str(output_path),
                "sourceTriangles": source_triangles,
                "targetTriangles": args.target_triangles,
                "resultTriangles": result_triangles,
                "ratio": ratio,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
