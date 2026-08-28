"""Bake foot contact curves from turn FBX files.
Run with: blender --background --python bake-contact-curves.py

For each FBX, outputs a JSON sidecar with per-frame contact state
for left and right feet. Contact = 1 when foot is planted (low height
AND low velocity), 0 when airborne. Values between 0-1 are blend ramps.

Output format matches ContactCurveData from IContactCurveCache.ts.
"""
import bpy
import json
import math
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
source_dir = os.path.normpath(os.path.join(script_dir, "..", "locomotion-pack"))

# Map FBX source -> clip name (matches the GLB clip names)
clips = {
    "left turn 90.fbx": "turn-left-90",
    "right turn 90.fbx": "turn-right-90",
}

BLEND_FRAMES = 2          # frames to ramp contact weight in/out

# Mixamo bone names to search for
LEFT_FOOT_NAMES = ["mixamorig:LeftToeBase", "mixamorig1LeftToeBase", "LeftToeBase"]
RIGHT_FOOT_NAMES = ["mixamorig:RightToeBase", "mixamorig1RightToeBase", "RightToeBase"]


def find_bone(armature, name_candidates):
    """Find a bone by trying multiple naming conventions."""
    for name in name_candidates:
        bone = armature.pose.bones.get(name)
        if bone:
            return bone
    return None


def get_bone_world_pos(armature, bone, frame):
    """Get world-space position of a pose bone at a given frame."""
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    return (armature.matrix_world @ bone.matrix).to_translation()


def bake_contact_curve(fbx_path, clip_name):
    """Load FBX, sample foot positions per frame, derive contact states."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    # Find the armature
    armature = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if not armature:
        print(f"  ERROR: No armature found in {fbx_path}")
        return None

    left_toe = find_bone(armature, LEFT_FOOT_NAMES)
    right_toe = find_bone(armature, RIGHT_FOOT_NAMES)

    if not left_toe or not right_toe:
        print(f"  ERROR: Could not find foot bones in {fbx_path}")
        print(f"  Available bones: {[b.name for b in armature.pose.bones]}")
        return None

    # Get animation frame range
    action = armature.animation_data.action if armature.animation_data else None
    if not action:
        print(f"  ERROR: No animation action in {fbx_path}")
        return None

    frame_start = int(action.frame_range[0])
    frame_end = int(action.frame_range[1])
    frame_count = frame_end - frame_start + 1
    fps = bpy.context.scene.render.fps

    print(f"  Frames: {frame_start}-{frame_end} ({frame_count} frames at {fps}fps)")

    # Sample foot positions per frame
    left_positions = []
    right_positions = []

    for frame in range(frame_start, frame_end + 1):
        left_pos = get_bone_world_pos(armature, left_toe, frame)
        right_pos = get_bone_world_pos(armature, right_toe, frame)
        left_positions.append(left_pos)
        right_positions.append(right_pos)

    # Mixamo FBXs do not all arrive with the same Blender up axis or unit
    # scale. The feet move least along the vertical axis, so use their sampled
    # range to find up, then derive contact tolerances from the rig's height.
    all_foot_positions = left_positions + right_positions
    axis_ranges = [
        max(position[axis] for position in all_foot_positions)
        - min(position[axis] for position in all_foot_positions)
        for axis in range(3)
    ]
    up_axis = min(range(3), key=lambda axis: axis_ranges[axis])
    ground = min(position[up_axis] for position in all_foot_positions)

    bpy.context.scene.frame_set(frame_start)
    bpy.context.view_layer.update()
    bone_positions = [
        (armature.matrix_world @ bone.matrix).to_translation()
        for bone in armature.pose.bones
    ]
    body_height = max(position[up_axis] for position in bone_positions) - ground
    height_threshold = ground + 0.035 * body_height
    # A turn may keep a foot low while rolling around the heel or forefoot.
    # Height alone calls that whole pivot "planted" and a loose velocity gate
    # pins the moving toe to the floor. Only declare a toe-owned anchor while
    # that toe is genuinely stationary; moving low frames stay authored and
    # are not fought by the late IK pass.
    velocity_threshold = 0.006 * body_height
    print(
        f"  Up axis: {'XYZ'[up_axis]}, body height: {body_height:.4f}, "
        f"height threshold: {height_threshold:.4f}, "
        f"velocity threshold: {velocity_threshold:.4f}"
    )

    for label, positions in (("left", left_positions), ("right", right_positions)):
        velocities = [
            (positions[index] - positions[index - 1]).length / body_height
            for index in range(1, len(positions))
        ]
        velocities.sort()
        print(
            f"  {label} normalized velocity/frame: "
            f"p25={velocities[len(velocities) // 4]:.4f}, "
            f"p50={velocities[len(velocities) // 2]:.4f}, "
            f"p75={velocities[(len(velocities) * 3) // 4]:.4f}, "
            f"max={velocities[-1]:.4f}"
        )

    # Compute per-frame: height (Y in Blender = up) and velocity
    def compute_raw_contact(positions):
        """Returns per-frame raw contact state: 1 = planted, 0 = airborne."""
        raw = []
        for i, pos in enumerate(positions):
            height = pos[up_axis]
            if i == 0:
                velocity = 0
            else:
                prev = positions[i - 1]
                dx = pos.x - prev.x
                dy = pos.y - prev.y
                dz = pos.z - prev.z
                velocity = math.sqrt(dx*dx + dy*dy + dz*dz)

            is_low = height <= height_threshold
            is_slow = velocity <= velocity_threshold
            raw.append(1.0 if (is_low and is_slow) else 0.0)
        return raw

    left_raw = compute_raw_contact(left_positions)
    right_raw = compute_raw_contact(right_positions)

    # Apply blend ramps (smooth transitions between planted/airborne)
    def apply_blend_ramps(raw):
        """Smooth 0->1 and 1->0 transitions over BLEND_FRAMES."""
        result = list(raw)
        n = len(result)
        for i in range(1, n):
            if raw[i] != raw[i - 1]:
                # Transition detected — apply ramp
                for j in range(BLEND_FRAMES):
                    idx = i + j
                    if idx >= n:
                        break
                    t = (j + 1) / (BLEND_FRAMES + 1)
                    if raw[i] > raw[i - 1]:
                        # 0->1 transition (foot landing)
                        result[idx] = t
                    else:
                        # 1->0 transition (foot lifting)
                        result[idx] = 1.0 - t
        return result

    left_contact = apply_blend_ramps(left_raw)
    right_contact = apply_blend_ramps(right_raw)

    return {
        "clipName": clip_name,
        "frameRate": fps,
        "frameCount": frame_count,
        "leftFoot": [round(v, 3) for v in left_contact],
        "rightFoot": [round(v, 3) for v in right_contact],
    }


# Process each clip
for fbx_name, clip_name in clips.items():
    fbx_path = os.path.join(source_dir, fbx_name)
    json_path = os.path.join(script_dir, f"{clip_name}.contact.json")

    if not os.path.exists(fbx_path):
        print(f"SKIP (not found): {fbx_name}")
        continue

    print(f"Baking contact curves: {fbx_name}")
    data = bake_contact_curve(fbx_path, clip_name)

    if data:
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"  Written: {json_path}")
        print(f"  Left foot planted frames: {sum(1 for v in data['leftFoot'] if v > 0.5)}/{data['frameCount']}")
        print(f"  Right foot planted frames: {sum(1 for v in data['rightFoot'] if v > 0.5)}/{data['frameCount']}")

print("\nAll contact curves baked!")
