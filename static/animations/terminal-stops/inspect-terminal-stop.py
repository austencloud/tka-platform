"""Report root travel, foot contacts, and terminal stance for a stop FBX.

Run with Blender so the measurements use the same importer as the GLB build:

    blender --background --python inspect-terminal-stop.py -- clip.fbx

This is deliberately a measurement tool. It does not modify the source clip.
"""

from __future__ import annotations

import json
import math
import os
import sys

import bpy


FOOT_BONES = {
    "left": ("mixamorig:LeftToeBase", "mixamorig:LeftFoot", "LeftToeBase", "LeftFoot"),
    "right": ("mixamorig:RightToeBase", "mixamorig:RightFoot", "RightToeBase", "RightFoot"),
}
HIP_BONES = ("mixamorig:Hips", "Hips")


def script_arguments() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def find_pose_bone(armature: bpy.types.Object, candidates: tuple[str, ...]):
    for name in candidates:
        bone = armature.pose.bones.get(name)
        if bone is not None:
            return bone
    return None


def world_position(armature: bpy.types.Object, bone) -> tuple[float, float, float]:
    point = (armature.matrix_world @ bone.matrix).to_translation()
    return (float(point.x), float(point.y), float(point.z))


def distance(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.sqrt(sum((left - right) ** 2 for left, right in zip(a, b)))


def main() -> None:
    arguments = script_arguments()
    if len(arguments) != 1:
        raise SystemExit("Pass exactly one FBX path after --")

    fbx_path = os.path.abspath(arguments[0])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    armature = next(
        (candidate for candidate in bpy.context.scene.objects if candidate.type == "ARMATURE"),
        None,
    )
    if armature is None or armature.animation_data is None or armature.animation_data.action is None:
        raise RuntimeError(f"No animated armature found in {fbx_path}")

    action = armature.animation_data.action
    start = int(math.ceil(action.frame_range[0]))
    end = int(math.floor(action.frame_range[1]))
    frames = list(range(start, end + 1))
    fps = float(bpy.context.scene.render.fps)

    hips = find_pose_bone(armature, HIP_BONES)
    feet = {
        side: find_pose_bone(armature, candidates)
        for side, candidates in FOOT_BONES.items()
    }
    if hips is None or any(foot is None for foot in feet.values()):
        raise RuntimeError("The clip does not expose the expected Mixamo hips and foot bones")

    samples: dict[str, list[tuple[float, float, float]]] = {
        "hips": [],
        "left": [],
        "right": [],
    }
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        samples["hips"].append(world_position(armature, hips))
        samples["left"].append(world_position(armature, feet["left"]))
        samples["right"].append(world_position(armature, feet["right"]))

    all_foot_points = samples["left"] + samples["right"]
    axis_ranges = [
        max(point[axis] for point in all_foot_points)
        - min(point[axis] for point in all_foot_points)
        for axis in range(3)
    ]
    up_axis = min(range(3), key=lambda axis: axis_ranges[axis])
    horizontal_axes = [axis for axis in range(3) if axis != up_axis]

    hip_start = samples["hips"][0]
    hip_end = samples["hips"][-1]
    root_delta = [hip_end[axis] - hip_start[axis] for axis in horizontal_axes]
    root_travel = math.hypot(*root_delta)

    ground = min(point[up_axis] for point in all_foot_points)
    bpy.context.scene.frame_set(start)
    bpy.context.view_layer.update()
    all_bone_points = [world_position(armature, bone) for bone in armature.pose.bones]
    body_height = max(point[up_axis] for point in all_bone_points) - ground
    height_threshold = ground + 0.035 * body_height
    velocity_threshold = 0.02 * body_height

    contacts: dict[str, list[bool]] = {}
    for side in ("left", "right"):
        positions = samples[side]
        contact = []
        for index, point in enumerate(positions):
            velocity = 0.0 if index == 0 else distance(point, positions[index - 1])
            contact.append(point[up_axis] <= height_threshold and velocity <= velocity_threshold)
        contacts[side] = contact

    landing_frames: dict[str, list[int]] = {}
    for side in ("left", "right"):
        contact = contacts[side]
        landings = []
        for index in range(1, len(contact)):
            if contact[index] and not contact[index - 1]:
                sustained = contact[index : min(len(contact), index + 3)]
                if len(sustained) >= 2 and all(sustained):
                    landings.append(frames[index])
        landing_frames[side] = landings

    last_quarter = max(1, len(frames) // 4)
    terminal_contact_share = {
        side: sum(contacts[side][-last_quarter:]) / last_quarter
        for side in ("left", "right")
    }
    latest_landing = {
        side: landing_frames[side][-1] if landing_frames[side] else start - 1
        for side in ("left", "right")
    }
    terminal_foot = max(latest_landing, key=latest_landing.get)

    final_feet = {side: samples[side][-1] for side in ("left", "right")}
    final_spread = distance(final_feet["left"], final_feet["right"])

    report = {
        "clip": os.path.basename(fbx_path),
        "frames": len(frames),
        "fps": fps,
        "durationSeconds": round((len(frames) - 1) / fps, 4),
        "upAxis": "XYZ"[up_axis],
        "bodyHeightSourceUnits": round(body_height, 4),
        "heightThresholdSourceUnits": round(height_threshold - ground, 4),
        "velocityThresholdSourceUnitsPerFrame": round(velocity_threshold, 4),
        "rootTravelSourceUnits": round(root_travel, 4),
        "finalFootSpreadSourceUnits": round(final_spread, 4),
        "terminalFoot": terminal_foot,
        "terminalContactShare": {
            side: round(share, 4) for side, share in terminal_contact_share.items()
        },
        "contactFrames": {
            side: sum(contact) for side, contact in contacts.items()
        },
        "landingFrames": landing_frames,
    }
    print("TERMINAL_STOP_REPORT=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
