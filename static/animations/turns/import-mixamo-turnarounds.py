"""Build canonical Mixamo 180-degree turnaround clips and contact metadata.

Run from Blender 5.0 or newer:

    blender --background --factory-startup --python import-mixamo-turnarounds.py

The source clips are the standing left/right 180-degree turns from the public
Mixamo animation snapshot on Hugging Face. Pass ``-- --source-dir <path>`` to
reuse already-downloaded FBXs; otherwise they are cached in the OS temp folder.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import tempfile
import urllib.request

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PAGE = "https://huggingface.co/datasets/Linzhan/Mixamo-Animations-Characters"
DOWNLOAD_BASE = (
    "https://huggingface.co/datasets/Linzhan/"
    "Mixamo-Animations-Characters/resolve/main/animation_motion/"
)
OUTPUT_FPS = 30
BLEND_FRAMES = 2

CLIPS = (
    {
        "name": "turn-left-180",
        "source": "Left_Turn_3.fbx",
        "angleDeg": 180,
    },
    {
        "name": "turn-right-180",
        "source": "Right_Turn_9.fbx",
        "angleDeg": -180,
    },
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", help="Directory containing the source FBXs")
    argv = []
    if "--" in __import__("sys").argv:
        argv = __import__("sys").argv[__import__("sys").argv.index("--") + 1 :]
    return parser.parse_args(argv)


def source_path(source_dir: str | None, filename: str) -> str:
    if source_dir:
        resolved = os.path.abspath(os.path.join(source_dir, filename))
        if not os.path.exists(resolved):
            raise FileNotFoundError(resolved)
        return resolved

    cache_dir = os.path.join(tempfile.gettempdir(), "tka-mixamo-turnarounds")
    os.makedirs(cache_dir, exist_ok=True)
    cached = os.path.join(cache_dir, filename)
    if not os.path.exists(cached):
        url = f"{DOWNLOAD_BASE}{filename}?download=true"
        print(f"Downloading {url}")
        urllib.request.urlretrieve(url, cached)
    return cached


def find_bone(armature: bpy.types.Object, suffix: str):
    return next(bone for bone in armature.pose.bones if bone.name.endswith(suffix))


def blend_contacts(raw: list[float]) -> list[float]:
    result = list(raw)
    for index in range(1, len(raw)):
        if raw[index] == raw[index - 1]:
            continue
        for offset in range(BLEND_FRAMES):
            target = index + offset
            if target >= len(raw):
                break
            phase = (offset + 1) / (BLEND_FRAMES + 1)
            result[target] = phase if raw[index] > raw[index - 1] else 1 - phase
    return result


def contact_curve(positions, ground: float, body_height: float) -> list[float]:
    height_limit = ground + 0.035 * body_height
    velocity_limit = 0.006 * body_height
    raw = []
    for index, position in enumerate(positions):
        velocity = 0.0 if index == 0 else (position - positions[index - 1]).length
        raw.append(
            1.0
            if position.z <= height_limit and velocity <= velocity_limit
            else 0.0
        )
    return blend_contacts(raw)


def unwrap_yaw(previous: float | None, current: float) -> float:
    if previous is None:
        return current
    while current - previous > math.pi:
        current -= math.tau
    while current - previous < -math.pi:
        current += math.tau
    return current


def sample_metadata(armature: bpy.types.Object, frame_start: int, frame_end: int) -> dict:
    hips = find_bone(armature, "Hips")
    left_toe = find_bone(armature, "LeftToeBase")
    right_toe = find_bone(armature, "RightToeBase")
    frames = list(range(frame_start, frame_end + 1))
    yaw = []
    root_positions = []
    left_positions = []
    right_positions = []
    all_heights = []

    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        current_yaw = hips.rotation_quaternion.to_euler("XYZ").y
        yaw.append(unwrap_yaw(yaw[-1] if yaw else None, current_yaw))
        root_positions.append(
            (armature.matrix_world @ hips.matrix).to_translation().copy()
        )
        left_positions.append(
            (armature.matrix_world @ left_toe.matrix).to_translation().copy()
        )
        right_positions.append(
            (armature.matrix_world @ right_toe.matrix).to_translation().copy()
        )
        for bone in armature.pose.bones:
            all_heights.append(
                (armature.matrix_world @ bone.matrix).to_translation().z
            )

    ground = min(position.z for position in left_positions + right_positions)
    body_height = max(all_heights) - ground
    start = root_positions[0]
    end = root_positions[-1]
    root_x = []
    root_z = []
    for index, position in enumerate(root_positions):
        phase = index / max(1, len(root_positions) - 1)
        baseline = start.lerp(end, phase)
        root_x.append(round((position.x - baseline.x) * 100, 5))
        root_z.append(round((position.y - baseline.y) * 100, 5))

    first_yaw = yaw[0]
    return {
        "frameRate": OUTPUT_FPS,
        "frameCount": len(frames),
        "rootYaw": [round(value - first_yaw, 7) for value in yaw],
        "rootX": root_x,
        "rootZ": root_z,
        "leftFoot": [
            round(value, 3)
            for value in contact_curve(left_positions, ground, body_height)
        ],
        "rightFoot": [
            round(value, 3)
            for value in contact_curve(right_positions, ground, body_height)
        ],
    }


def export_clip(armature: bpy.types.Object, output_path: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=True,
        export_frame_range=True,
        export_force_sampling=True,
    )


def build(source_dir: str | None, clip: dict) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = source_path(source_dir, clip["source"])
    bpy.ops.import_scene.fbx(filepath=source)
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    action = armature.animation_data.action
    frame_start = int(action.frame_range[0])
    frame_end = int(action.frame_range[1])
    metadata = sample_metadata(armature, frame_start, frame_end)
    action.name = clip["name"]
    bpy.context.scene.render.fps = OUTPUT_FPS
    bpy.context.scene.render.fps_base = 1
    bpy.context.scene.frame_start = frame_start
    bpy.context.scene.frame_end = frame_end

    output_path = os.path.join(SCRIPT_DIR, f"{clip['name']}.glb")
    export_clip(armature, output_path)
    metadata.update(
        {
            "clipName": clip["name"],
            "source": DATASET_PAGE,
            "sourceClip": clip["source"],
            "angleDeg": clip["angleDeg"],
        }
    )
    json_path = os.path.join(SCRIPT_DIR, f"{clip['name']}.contact.json")
    with open(json_path, "w", encoding="utf-8") as target:
        json.dump(metadata, target, indent=2)
        target.write("\n")

    left_frames = sum(value > 0.5 for value in metadata["leftFoot"])
    right_frames = sum(value > 0.5 for value in metadata["rightFoot"])
    print(
        f"Built {clip['name']}: {metadata['frameCount']} frames, "
        f"left contact {left_frames}, right contact {right_frames}"
    )


def main() -> None:
    args = parse_args()
    for clip in CLIPS:
        build(args.source_dir, clip)


if __name__ == "__main__":
    main()
