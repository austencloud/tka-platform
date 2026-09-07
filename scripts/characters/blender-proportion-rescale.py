"""Rescale one already-licensed character rig along a single body proportion.

Why translation rather than bone scaling
----------------------------------------
The staff-grip solve reads three rotation-invariant quantities off the rig:
the upper-arm segment (``LeftArm``->``LeftForeArm``), the forearm segment
(``LeftForeArm``->``LeftHand``), and the world separation of the two arm-chain
roots. Each is a distance between two joints, so each is controlled exactly by
moving the *distal* joint of that segment.

Scaling a parent bone instead would drag every descendant's scale with it and
change several segments at once, which is precisely the confound this sweep
exists to remove. Translating ``LeftForeArm`` lengthens the upper arm and
leaves the forearm untouched; the skin between the two joints stretches and
everything below travels rigidly. One parameter, one measured dimension.

Stature is the deliberate exception: it is a uniform scale of the whole
armature, because a taller body really does have proportionally longer
segments. It is the control that shows the solve responds to absolute size.

Torso girth is applied as a bone scale on the spine with descendant scale
inheritance switched off, so the chest thickens without inflating the arms.

The imported animation is cleared before any of that, because the catalog rigs
carry a Mixamo clip whose first frame disagrees with their bind pose; see
``clear_imported_pose``. The pose is then baked: each mesh's armature deformation is applied into its
vertices and the pose becomes the new rest pose, so the exported GLB carries
the new proportions in its bind pose rather than in a pose the runtime would
overwrite on its first animated frame.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

MIXAMO_PREFIX = re.compile(r"^mixamorig\d*[:_]", re.IGNORECASE)

# Segment -> the joint whose movement defines that segment's length.
UPPER_ARM_DISTAL = ("LeftForeArm", "RightForeArm")
FOREARM_DISTAL = ("LeftHand", "RightHand")
ARM_CHAIN_ROOT = ("LeftArm", "RightArm")
SPINE_BONES = ("Spine", "Spine1", "Spine2")


def parse_args() -> argparse.Namespace:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--params-file",
        type=Path,
        required=True,
        help="JSON file of proportion multipliers (1.0 leaves a dimension alone)",
    )
    return parser.parse_args(args)


def canonical(name: str) -> str:
    return MIXAMO_PREFIX.sub("", name)


def find_armature() -> bpy.types.Object:
    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected exactly one armature, found {len(armatures)}")
    return armatures[0]


def bone_lookup(armature: bpy.types.Object) -> dict[str, str]:
    """Canonical bone name -> the rig's own bone name."""
    lookup: dict[str, str] = {}
    for bone in armature.data.bones:
        lookup.setdefault(canonical(bone.name), bone.name)
    return lookup


def require(lookup: dict[str, str], canonical_name: str) -> str:
    actual = lookup.get(canonical_name)
    if actual is None:
        raise RuntimeError(f"Rig is missing the {canonical_name} bone")
    return actual


def world_head(armature: bpy.types.Object, bone_name: str) -> Vector:
    return armature.matrix_world @ armature.pose.bones[bone_name].head


def disconnect(armature: bpy.types.Object, bone_names: list[str]) -> None:
    """A connected bone cannot be translated in pose mode."""
    bpy.ops.object.mode_set(mode="EDIT")
    for name in bone_names:
        edit_bone = armature.data.edit_bones.get(name)
        if edit_bone is not None:
            edit_bone.use_connect = False
    bpy.ops.object.mode_set(mode="POSE")


def translate_world(
    armature: bpy.types.Object, bone_name: str, offset: Vector
) -> None:
    """Move one pose bone by a world-space offset; descendants follow rigidly."""
    pose_bone = armature.pose.bones[bone_name]
    matrix = pose_bone.matrix.copy()
    matrix.translation = matrix.translation + (armature.matrix_world.inverted().to_3x3() @ offset)
    pose_bone.matrix = matrix
    bpy.context.view_layer.update()


def apply_shoulder_width(
    armature: bpy.types.Object, lookup: dict[str, str], scale: float
) -> None:
    """Move both arm-chain roots along the shoulder axis about the chest midline."""
    left = require(lookup, "LeftArm")
    right = require(lookup, "RightArm")
    left_head = world_head(armature, left)
    right_head = world_head(armature, right)
    axis = left_head - right_head
    span = axis.length
    if span == 0:
        raise RuntimeError("Arm-chain roots are coincident; cannot widen shoulders")
    direction = axis.normalized()
    shift = (span * (scale - 1.0)) / 2.0
    translate_world(armature, left, direction * shift)
    translate_world(armature, right, direction * -shift)


def apply_segment_scale(
    armature: bpy.types.Object,
    lookup: dict[str, str],
    proximal_names: tuple[str, str],
    distal_names: tuple[str, str],
    scale: float,
) -> None:
    """Lengthen a limb segment by moving its distal joint along the segment."""
    for proximal_canonical, distal_canonical in zip(proximal_names, distal_names):
        proximal = require(lookup, proximal_canonical)
        distal = require(lookup, distal_canonical)
        start = world_head(armature, proximal)
        end = world_head(armature, distal)
        segment = end - start
        if segment.length == 0:
            raise RuntimeError(f"{proximal_canonical} segment has zero length")
        translate_world(
            armature, distal, segment.normalized() * (segment.length * (scale - 1.0))
        )


def apply_torso_girth(
    armature: bpy.types.Object, lookup: dict[str, str], scale: float
) -> None:
    """Thicken the chest without moving the joints the staff solve measures.

    Switching descendant scale inheritance off stops the arms from inflating,
    but it does not stop them from *travelling*: a clavicle parented to a
    laterally scaled spine still has its head carried outward, which showed up
    as a 10 %% shoulder-span change on a body that was only supposed to change
    girth. That is a confounded fixture, which is exactly what this sweep
    exists to avoid, so the arm-chain roots are pinned back to the world
    positions they held before the spine was touched.
    """
    spine_names = [lookup[name] for name in SPINE_BONES if name in lookup]
    if not spine_names:
        raise RuntimeError("Rig exposes no spine bones to scale")
    spine_set = set(spine_names)

    pinned = {
        require(lookup, name): world_head(armature, require(lookup, name))
        for name in ARM_CHAIN_ROOT
    }

    bpy.ops.object.mode_set(mode="EDIT")
    for edit_bone in armature.data.edit_bones:
        parent = edit_bone.parent
        if parent is not None and parent.name in spine_set and edit_bone.name not in spine_set:
            edit_bone.inherit_scale = "NONE"
    bpy.ops.object.mode_set(mode="POSE")

    for name in spine_names:
        pose_bone = armature.pose.bones[name]
        pose_bone.scale = (scale, 1.0, scale)
    bpy.context.view_layer.update()

    for bone_name, original in pinned.items():
        translate_world(armature, bone_name, original - world_head(armature, bone_name))


def clear_imported_pose(armature: bpy.types.Object) -> None:
    """Start from the file's bind pose, not frame 1 of its animation.

    The shipped catalog rigs carry a Mixamo clip: `ch12.glb` has one animation
    with 47 channels. Blender imports it as an action on the armature, and the
    armature therefore evaluates to that clip's first frame rather than to its
    bind pose. The two disagree about the legs — `ch12` binds with its feet
    29.52 cm apart and evaluates with them 17.40 cm apart, exactly under the
    hips.

    Anything that then bakes pose to rest freezes that animated frame as the
    new bind pose, so the rig ships standing at attention and the authored
    stance is gone. Because the pose is driven by an action rather than by
    stored channel values, `transforms_clear` alone does not hold: the next
    depsgraph evaluation re-applies the clip. Clearing the animation data is
    what makes the clear stick.

    The clip itself is not carried into the output — the export below writes
    skins without animations — so dropping it here costs nothing.
    """
    armature.animation_data_clear()
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.transforms_clear()
    bpy.context.view_layer.update()


def bake_pose_to_rest(armature: bpy.types.Object) -> None:
    """Bake deformation into the meshes, then make the pose the new rest pose."""
    bpy.ops.object.mode_set(mode="OBJECT")
    for mesh in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        modifiers = [m for m in mesh.modifiers if m.type == "ARMATURE"]
        if not modifiers:
            continue
        if mesh.data.shape_keys is not None:
            raise RuntimeError(
                f"{mesh.name} carries shape keys; the armature bake would drop them"
            )
        bpy.context.view_layer.objects.active = mesh
        for modifier in modifiers:
            # Duplicate so the mesh keeps a live modifier bound to the new rest
            # pose after the copy is applied into its vertices.
            copied = mesh.modifiers.new(name="__bake__", type="ARMATURE")
            copied.object = modifier.object
            copied.use_deform_preserve_volume = modifier.use_deform_preserve_volume
            bpy.ops.object.modifier_apply(modifier=copied.name)

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply()
    bpy.ops.object.mode_set(mode="OBJECT")


def main() -> None:
    args = parse_args()
    params = json.loads(args.params_file.read_text(encoding="utf8"))
    source = args.input.resolve()
    output = args.output.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    armature = find_armature()
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    lookup = bone_lookup(armature)

    movable = [
        require(lookup, name)
        for name in ARM_CHAIN_ROOT + UPPER_ARM_DISTAL + FOREARM_DISTAL
    ]
    bpy.ops.object.mode_set(mode="POSE")
    clear_imported_pose(armature)
    disconnect(armature, movable)

    # Parent-first, so each later offset is measured against the geometry the
    # earlier ones already produced and the axes stay independent.
    shoulder = float(params.get("shoulderWidthScale", 1.0))
    if shoulder != 1.0:
        apply_shoulder_width(armature, lookup, shoulder)

    upper_arm = float(params.get("upperArmScale", 1.0))
    if upper_arm != 1.0:
        apply_segment_scale(
            armature, lookup, ARM_CHAIN_ROOT, UPPER_ARM_DISTAL, upper_arm
        )

    forearm = float(params.get("forearmScale", 1.0))
    if forearm != 1.0:
        apply_segment_scale(
            armature, lookup, UPPER_ARM_DISTAL, FOREARM_DISTAL, forearm
        )

    girth = float(params.get("torsoGirthScale", 1.0))
    if girth != 1.0:
        apply_torso_girth(armature, lookup, girth)

    bake_pose_to_rest(armature)

    stature = float(params.get("statureScale", 1.0))
    if stature != 1.0:
        bpy.ops.object.select_all(action="DESELECT")
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature
        armature.scale = (stature, stature, stature)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_skins=True,
        export_animations=False,
        export_yup=True,
        export_apply=False,
    )
    print(f"Rescaled {source.name} -> {output.name} with {json.dumps(params)}")


if __name__ == "__main__":
    main()
