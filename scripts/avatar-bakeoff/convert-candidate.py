"""Convert one evaluation-only FBX avatar into a browser-loadable GLB.

The bake-off keeps downloaded vendor files outside Git. This script makes the
conversion reproducible without changing the source rig, skin weights, or
materials before TKA evaluates them.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    return parser.parse_args(args)


def main() -> None:
    args = parse_args()
    source = args.input.resolve()
    output = args.output.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False)

    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    # FBX roots arrive with a +90° X rotation that makes them upright in
    # Blender's Z-up scene. Bake that root correction into the armature before
    # the glTF exporter converts the scene to Y-up. Leaving it as an object
    # transform makes the browser skin lie along Z even though the bones map.
    roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
    for root in roots:
        bpy.ops.object.select_all(action="DESELECT")
        root.select_set(True)
        bpy.context.view_layer.objects.active = root
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_skins=True,
        export_animations=False,
        export_yup=True,
        export_apply=False,
    )
    print(f"Converted {source.name} -> {output}")


if __name__ == "__main__":
    main()
