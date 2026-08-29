"""Build four-step grapevine loops from the shipped Mixamo strafe captures.

Each source contains a captured two-step lateral crossover with root travel and
weight transfer. This offline authoring pass repeats the cycle and changes only
the crossing ankle's fore/aft target while that leg swings, alternating behind
and in front. Blender's visual constraint baker records the resulting joint
rotations. Runtime IK remains a contact-correction layer.

Run with:
  blender --background --python build-grapevine.py
"""

from __future__ import annotations

import hashlib
import json
import math
import os

import bpy
from mathutils import Matrix


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FRAME_RATE = 30
PHASE_FRAMES = tuple(range(10, 33)) + tuple(range(1, 10))
SWING_START = 16
SWING_END = len(PHASE_FRAMES) - 1
MINIMUM_CROSS_DEPTH = 0.12
MINIMUM_FOOT_CLEARANCE = 0.12
CLEARANCE_MARGIN = 0.05
MAXIMUM_EXTRA_FOOT_HEIGHT = 0.08
MAXIMUM_LEG_LENGTH_ERROR = 0.002
VALIDATION_SUBSTEPS = 4
OUTPUT_FRAMES = len(PHASE_FRAMES) * 2

HIP_NAMES = ("mixamorig:Hips", "Hips")
LEFT_UP_LEG_NAMES = ("mixamorig:LeftUpLeg", "LeftUpLeg")
LEFT_LEG_NAMES = ("mixamorig:LeftLeg", "LeftLeg")
LEFT_FOOT_NAMES = ("mixamorig:LeftFoot", "LeftFoot")
RIGHT_UP_LEG_NAMES = ("mixamorig:RightUpLeg", "RightUpLeg")
RIGHT_LEG_NAMES = ("mixamorig:RightLeg", "RightLeg")
RIGHT_FOOT_NAMES = ("mixamorig:RightFoot", "RightFoot")

CLIPS = (
    {
        "name": "grapevine-left",
        "source": "left strafe walking.fbx",
        "crossing_side": "right",
    },
    {
        "name": "grapevine-right",
        "source": "right strafe walking.fbx",
        "crossing_side": "left",
    },
)


def find_pose_bone(armature: bpy.types.Object, names: tuple[str, ...]):
    for name in names:
        bone = armature.pose.bones.get(name)
        if bone is not None:
            return bone
    return None


def required_pose_bone(armature: bpy.types.Object, names: tuple[str, ...]):
    bone = find_pose_bone(armature, names)
    if bone is None:
        raise RuntimeError(f"Missing required bone: {names}")
    return bone


def bone_depth(bone) -> int:
    depth = 0
    parent = bone.parent
    while parent is not None:
        depth += 1
        parent = parent.parent
    return depth


def smooth(value: float) -> float:
    clamped = min(1.0, max(0.0, value))
    return clamped * clamped * (3.0 - 2.0 * clamped)


def role_at(cycle: int, phase_index: int, base_sign: float) -> float:
    start_role = base_sign if cycle == 0 else -base_sign
    end_role = -start_role
    if phase_index <= SWING_START:
        return start_role
    if phase_index >= SWING_END:
        return end_role
    blend = smooth((phase_index - SWING_START) / (SWING_END - SWING_START))
    return start_role + (end_role - start_role) * blend


def source_sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def world_head(armature: bpy.types.Object, bone: bpy.types.PoseBone):
    return armature.matrix_world @ bone.head


def world_foot(armature: bpy.types.Object, bone: bpy.types.PoseBone):
    return (armature.matrix_world @ bone.matrix).translation


def leg_lengths(armature: bpy.types.Object) -> dict[str, float]:
    left_upper = required_pose_bone(armature, LEFT_UP_LEG_NAMES)
    left_lower = required_pose_bone(armature, LEFT_LEG_NAMES)
    left_foot = required_pose_bone(armature, LEFT_FOOT_NAMES)
    right_upper = required_pose_bone(armature, RIGHT_UP_LEG_NAMES)
    right_lower = required_pose_bone(armature, RIGHT_LEG_NAMES)
    right_foot = required_pose_bone(armature, RIGHT_FOOT_NAMES)
    return {
        "leftUpper": (world_head(armature, left_upper) - world_head(armature, left_lower)).length,
        "leftLower": (world_head(armature, left_lower) - world_head(armature, left_foot)).length,
        "rightUpper": (world_head(armature, right_upper) - world_head(armature, right_lower)).length,
        "rightLower": (world_head(armature, right_lower) - world_head(armature, right_foot)).length,
    }


def sample_source(armature: bpy.types.Object):
    ordered = sorted(armature.pose.bones, key=bone_depth)
    hips = required_pose_bone(armature, HIP_NAMES)
    left_foot = required_pose_bone(armature, LEFT_FOOT_NAMES)
    right_foot = required_pose_bone(armature, RIGHT_FOOT_NAMES)

    samples = []
    height_maximum = {"left": float("-inf"), "right": float("-inf")}
    length_reference = None
    for frame in PHASE_FRAMES:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        left_world = world_foot(armature, left_foot)
        right_world = world_foot(armature, right_foot)
        height_maximum["left"] = max(height_maximum["left"], float(left_world.z))
        height_maximum["right"] = max(height_maximum["right"], float(right_world.z))
        if length_reference is None:
            length_reference = leg_lengths(armature)
        samples.append(
            {
                "frame": frame,
                "basis": {bone.name: bone.matrix_basis.copy() for bone in ordered},
                "hips_x": float(hips.location.x),
                "left_world": left_world.copy(),
                "right_world": right_world.copy(),
            }
        )
    return ordered, samples, height_maximum, length_reference


def unwrap_root(samples, armature: bpy.types.Object) -> tuple[list[float], float]:
    action = armature.animation_data.action
    hips = required_pose_bone(armature, HIP_NAMES)
    start_frame, end_frame = map(lambda value: int(round(value)), action.frame_range)
    bpy.context.scene.frame_set(start_frame)
    bpy.context.view_layer.update()
    start_x = float(hips.location.x)
    bpy.context.scene.frame_set(end_frame)
    bpy.context.view_layer.update()
    cycle_travel = float(hips.location.x) - start_x
    if abs(cycle_travel) < 1e-4:
        raise RuntimeError("The source has no lateral root travel")

    unwrapped = []
    offset = 0.0
    previous_frame = PHASE_FRAMES[0]
    for sample in samples:
        sample_frame = int(sample["frame"])
        if sample_frame < previous_frame:
            offset += cycle_travel
        unwrapped.append(float(sample["hips_x"]) + offset)
        previous_frame = sample_frame
    origin = unwrapped[0]
    return [value - origin for value in unwrapped], cycle_travel


def apply_source_basis(ordered, basis: dict[str, Matrix]) -> None:
    for bone in ordered:
        bone.matrix_basis = basis[bone.name].copy()


def key_current_basis(ordered, frame: int) -> None:
    for bone in ordered:
        location, rotation, scale = bone.matrix_basis.decompose()
        bone.rotation_mode = "QUATERNION"
        bone.location = location
        bone.rotation_quaternion = rotation
        bone.scale = scale
        bone.keyframe_insert("location", frame=frame, group=bone.name)
        bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
        bone.keyframe_insert("scale", frame=frame, group=bone.name)


def make_crossing_targets(
    armature: bpy.types.Object,
    ordered,
    samples,
    crossing_side: str,
) -> tuple[list[object], list[float], float]:
    hips = required_pose_bone(armature, HIP_NAMES)
    root_x, cycle_travel = unwrap_root(samples, armature)
    first = samples[0]
    left_depth = float(first["left_world"].y)
    right_depth = float(first["right_world"].y)
    base_depth = left_depth - right_depth
    if crossing_side == "right":
        base_depth *= -1.0
    base_sign = 1.0 if base_depth >= 0 else -1.0

    targets = []
    authored_depth = []
    left_foot = required_pose_bone(armature, LEFT_FOOT_NAMES)
    right_foot = required_pose_bone(armature, RIGHT_FOOT_NAMES)
    crossing_lower = required_pose_bone(
        armature,
        LEFT_LEG_NAMES if crossing_side == "left" else RIGHT_LEG_NAMES,
    )
    for output_frame in range(OUTPUT_FRAMES):
        cycle = output_frame // len(PHASE_FRAMES)
        phase_index = output_frame % len(PHASE_FRAMES)
        sample = samples[phase_index]
        apply_source_basis(ordered, sample["basis"])
        hips.location.x = root_x[phase_index] + cycle * cycle_travel
        bpy.context.view_layer.update()

        left_world = world_foot(armature, left_foot)
        right_world = world_foot(armature, right_foot)
        crossing_world = left_world if crossing_side == "left" else right_world
        support_world = right_world if crossing_side == "left" else left_world
        source_depth = abs(crossing_world.y - support_world.y)
        desired_depth = max(MINIMUM_CROSS_DEPTH, source_depth)
        desired_world = crossing_world.copy()
        role = role_at(cycle, phase_index, base_sign)
        desired_world.y = support_world.y + desired_depth * role
        if SWING_START < phase_index < SWING_END:
            # The crossing foot must pass the support foot while changing from
            # front to back (or vice versa). Preserve the captured lateral arc,
            # then add only the vertical separation the current horizontal gap
            # needs. This avoids a fixed high-knee exaggeration on wider rigs.
            horizontal_squared = (
                (desired_world.x - support_world.x) ** 2
                + (desired_world.y - support_world.y) ** 2
            )
            required_vertical = math.sqrt(
                max(0.0, MINIMUM_FOOT_CLEARANCE**2 - horizontal_squared)
            )
            desired_world.z = max(
                desired_world.z,
                support_world.z + required_vertical + CLEARANCE_MARGIN,
            )
        # Mixamo ankle bones are not guaranteed to start exactly on the lower
        # leg's tail. The IK target therefore follows the captured tail plus the
        # desired ankle delta, preserving that authored skeleton offset.
        source_tail_world = armature.matrix_world @ crossing_lower.tail
        desired_tail_world = source_tail_world + (desired_world - crossing_world)
        targets.append(armature.matrix_world.inverted() @ desired_tail_world)
        authored_depth.append(float(desired_depth * role))
    return targets, authored_depth, cycle_travel


def configure_linear_interpolation(action: bpy.types.Action) -> None:
    if hasattr(action, "fcurves"):
        curves = action.fcurves
    else:
        curves = (
            curve
            for layer in action.layers
            for strip in layer.strips
            for channelbag in strip.channelbags
            for curve in channelbag.fcurves
        )
    for curve in curves:
        for keyframe in curve.keyframe_points:
            keyframe.interpolation = "LINEAR"


def validate_bake(
    armature: bpy.types.Object,
    crossing_side: str,
    source_height_maximum: dict[str, float],
    source_leg_lengths: dict[str, float],
) -> dict[str, object]:
    left_foot = required_pose_bone(armature, LEFT_FOOT_NAMES)
    right_foot = required_pose_bone(armature, RIGHT_FOOT_NAMES)
    depths = []
    clearance = []
    foot_pairs = []
    height_ranges = {
        "left": [float("inf"), float("-inf")],
        "right": [float("inf"), float("-inf")],
    }
    maximum_length_error = 0.0
    sampled_frames = [
        sample / VALIDATION_SUBSTEPS
        for sample in range((OUTPUT_FRAMES - 1) * VALIDATION_SUBSTEPS + 1)
    ]
    for sampled_frame in sampled_frames:
        whole_frame = int(sampled_frame)
        bpy.context.scene.frame_set(
            whole_frame,
            subframe=sampled_frame - whole_frame,
        )
        bpy.context.view_layer.update()
        left_world = world_foot(armature, left_foot)
        right_world = world_foot(armature, right_foot)
        crossing_world = left_world if crossing_side == "left" else right_world
        support_world = right_world if crossing_side == "left" else left_world
        depths.append(float(crossing_world.y - support_world.y))
        clearance.append(float((left_world - right_world).length))
        foot_pairs.append((left_world.copy(), right_world.copy()))
        for side, foot in (("left", left_world), ("right", right_world)):
            height_ranges[side][0] = min(height_ranges[side][0], float(foot.z))
            height_ranges[side][1] = max(height_ranges[side][1], float(foot.z))
        current_lengths = leg_lengths(armature)
        for name, reference in source_leg_lengths.items():
            maximum_length_error = max(
                maximum_length_error,
                abs(current_lengths[name] - reference),
            )

    if min(depths) > -MINIMUM_CROSS_DEPTH + 0.005:
        raise RuntimeError(f"{crossing_side} clip never reaches its back crossover")
    if max(depths) < MINIMUM_CROSS_DEPTH - 0.005:
        raise RuntimeError(f"{crossing_side} clip never reaches its front crossover")
    minimum_clearance = min(clearance)
    if minimum_clearance < MINIMUM_FOOT_CLEARANCE:
        minimum_index = clearance.index(minimum_clearance)
        minimum_frame = sampled_frames[minimum_index]
        left_world, right_world = foot_pairs[minimum_index]
        raise RuntimeError(
            f"{crossing_side} foot clearance collapsed to {minimum_clearance:.3f}m "
            f"at frame {minimum_frame:.2f}; depth was {depths[minimum_index]:.3f}m; "
            f"left={tuple(round(value, 3) for value in left_world)}, "
            f"right={tuple(round(value, 3) for value in right_world)}"
        )
    for side in ("left", "right"):
        allowed = source_height_maximum[side] + MAXIMUM_EXTRA_FOOT_HEIGHT
        if height_ranges[side][1] > allowed:
            raise RuntimeError(
                f"{side} foot rose to {height_ranges[side][1]:.3f}m; "
                f"source maximum was {source_height_maximum[side]:.3f}m"
            )
    if maximum_length_error > MAXIMUM_LEG_LENGTH_ERROR:
        raise RuntimeError(
            f"Leg length drifted by {maximum_length_error:.6f}m during bake"
        )
    return {
        "depthMinimum": round(min(depths), 6),
        "depthMaximum": round(max(depths), 6),
        "minimumFootClearance": round(minimum_clearance, 6),
        "heightRanges": {
            side: [round(value, 6) for value in height_ranges[side]]
            for side in ("left", "right")
        },
        "maximumLegLengthError": round(maximum_length_error, 9),
    }


def bake_clip(config: dict[str, str]) -> dict[str, object]:
    source_path = os.path.join(SCRIPT_DIR, config["source"])
    if not os.path.exists(source_path):
        raise FileNotFoundError(source_path)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FRAME_RATE
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = OUTPUT_FRAMES - 1
    bpy.ops.import_scene.fbx(filepath=source_path)
    armature = next(
        (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"),
        None,
    )
    if armature is None or armature.animation_data is None:
        raise RuntimeError("No animated armature found in the source FBX")

    ordered, samples, source_height_maximum, source_leg_lengths = sample_source(armature)
    targets, authored_depth, cycle_travel = make_crossing_targets(
        armature,
        ordered,
        samples,
        config["crossing_side"],
    )
    hips = required_pose_bone(armature, HIP_NAMES)
    root_x, _ = unwrap_root(samples, armature)
    source_action = armature.animation_data.action
    armature.animation_data.action = None
    if source_action is not None:
        bpy.data.actions.remove(source_action)
    action = bpy.data.actions.new(config["name"])
    armature.animation_data.action = action

    target = bpy.data.objects.new(f"{config['name']}-foot-target", None)
    bpy.context.scene.collection.objects.link(target)
    target.parent = armature
    target.matrix_parent_inverse = Matrix.Identity(4)
    for output_frame in range(OUTPUT_FRAMES):
        cycle = output_frame // len(PHASE_FRAMES)
        phase_index = output_frame % len(PHASE_FRAMES)
        apply_source_basis(ordered, samples[phase_index]["basis"])
        hips.location.x = root_x[phase_index] + cycle * cycle_travel
        key_current_basis(ordered, output_frame)
        target.location = targets[output_frame]
        target.keyframe_insert("location", frame=output_frame)

    crossing_lower = required_pose_bone(
        armature,
        LEFT_LEG_NAMES if config["crossing_side"] == "left" else RIGHT_LEG_NAMES,
    )
    crossing_upper = required_pose_bone(
        armature,
        LEFT_UP_LEG_NAMES
        if config["crossing_side"] == "left"
        else RIGHT_UP_LEG_NAMES,
    )
    constraint = crossing_lower.constraints.new("IK")
    constraint.name = "GrapevineBake"
    constraint.target = target
    constraint.chain_count = 2
    constraint.use_tail = True
    constraint.use_rotation = False
    if hasattr(constraint, "use_stretch"):
        constraint.use_stretch = False
    crossing_upper.ik_stretch = 0.0
    crossing_lower.ik_stretch = 0.0

    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.context.scene.frame_set(0)
    bpy.ops.nla.bake(
        frame_start=0,
        frame_end=OUTPUT_FRAMES - 1,
        step=1,
        only_selected=False,
        visual_keying=True,
        clear_constraints=True,
        clear_parents=False,
        use_current_action=True,
        clean_curves=False,
        bake_types={"POSE"},
    )
    configure_linear_interpolation(action)
    bpy.data.objects.remove(target, do_unlink=True)
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()

    measured = validate_bake(
        armature,
        config["crossing_side"],
        source_height_maximum,
        source_leg_lengths,
    )
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(SCRIPT_DIR, f"{config['name']}.glb"),
        export_format="GLB",
        export_animations=True,
        export_skins=True,
    )
    return {
        "source": {
            "file": config["source"],
            "sha256": source_sha256(source_path),
            "provider": "Adobe Mixamo",
            "motionId": None,
            "motionIdStatus": "not preserved in the original 2026-04-04 import",
            "license": "https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html",
        },
        "crossingSide": config["crossing_side"],
        "cycleTravelMeters": round(cycle_travel / 100, 6),
        "authoredDepthMinimum": round(min(authored_depth), 6),
        "authoredDepthMaximum": round(max(authored_depth), 6),
        "measured": measured,
    }


def write_metadata(clips: dict[str, object]) -> None:
    metadata = {
        "version": 1,
        "clipFamily": "grapevine",
        "authoring": {
            "frameRate": FRAME_RATE,
            "frameCount": OUTPUT_FRAMES,
            "stepsPerLoop": 4,
            "phaseSourceFrames": list(PHASE_FRAMES),
            "crossingRoles": ["back crossover", "front crossover"],
            "minimumCrossDepthMeters": MINIMUM_CROSS_DEPTH,
            "minimumFootClearanceMeters": MINIMUM_FOOT_CLEARANCE,
            "runtimeOwner": "@austencloud/scene-3d LocomotionAnimator",
            "contactCorrectionOwner": "@austencloud/scene-3d FootPlanter",
            "method": "offline Blender visual constraint bake",
        },
        "clips": clips,
    }
    with open(
        os.path.join(SCRIPT_DIR, "grapevine.motion.json"),
        "w",
        encoding="utf-8",
    ) as metadata_file:
        json.dump(metadata, metadata_file, indent=2)
        metadata_file.write("\n")


def main() -> None:
    results = {}
    for config in CLIPS:
        results[config["name"]] = bake_clip(config)
    write_metadata(results)
    for name, result in results.items():
        measured = result["measured"]
        print(
            f"Built {name}: {OUTPUT_FRAMES} frames, four steps, "
            f"depth {measured['depthMinimum']:.3f}..{measured['depthMaximum']:.3f}m, "
            f"clearance {measured['minimumFootClearance']:.3f}m"
        )


if __name__ == "__main__":
    main()
