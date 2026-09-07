"""Bake a rigged Meshy character into a T-pose so Mixamo can auto-rig it.

Meshy's own auto-rigger emits 24 bones and no fingers, so a Meshy performer
cannot drive the runtime finger grip. Mixamo's auto-rigger does emit finger
chains, but it rejects Meshy's default A-pose: every attempt returns
``ERROR occured on rig: Unknown error while generating motion``. Straightening
the arms into a true T first is what makes the Mixamo job succeed.

This script uses the Meshy rig that already ships in ``<id>.glb`` to pose the
arms, bakes the pose into the mesh, throws the 24-bone skeleton away, and
writes an unrigged FBX (and OBJ) ready to upload to
https://www.mixamo.com. Bring the Mixamo download back through
``characters:intake``.

Usage::

    blender --background --python scripts/characters/meshy-tpose-bake.py -- \
        D:/Downloads/meshy-performers/marcus.glb D:/Downloads/meshy-tpose marcus

Arguments after ``--`` are: source GLB, output directory, output file stem.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ARM_BONES = ("Arm", "ForeArm", "Hand")


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1:]
    if len(args) < 3:
        raise SystemExit(
            "usage: blender -b --python meshy-tpose-bake.py -- <src.glb> <out_dir> <stem>"
        )
    src, out_dir, stem = Path(args[0]), Path(args[1]), args[2]
    out_dir.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(src), merge_vertices=True)
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    mesh = max(
        (
            o
            for o in bpy.data.objects
            if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)
        ),
        key=lambda o: len(o.data.vertices),
    )
    # Meshy ships a stray icosphere beside the body; Mixamo treats extra loose
    # parts as part of the character and the rig job fails.
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj is not mesh:
            print("removing stray mesh", obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    print(f"mesh {mesh.name} verts={len(mesh.data.vertices)} armature={arm.name}")

    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    depsgraph = bpy.context.evaluated_depsgraph_get()

    def head_world(name: str) -> Vector:
        return (arm.matrix_world @ arm.pose.bones[name].matrix).translation.copy()

    def group_verts_world(group_name: str, min_weight: float = 0.5) -> list[Vector]:
        depsgraph.update()
        evaluated = mesh.evaluated_get(depsgraph)
        index = mesh.vertex_groups[group_name].index
        points = []
        for vert, evaluated_vert in zip(mesh.data.vertices, evaluated.data.vertices):
            if any(g.group == index and g.weight >= min_weight for g in vert.groups):
                points.append(mesh.matrix_world @ evaluated_vert.co)
        return points

    def rotate_bone_world(name: str, rotation: Matrix) -> None:
        pose_bone = arm.pose.bones[name]
        world = arm.matrix_world @ pose_bone.matrix
        head = world.translation.copy()
        posed = (
            Matrix.Translation(head)
            @ rotation.to_4x4()
            @ Matrix.Translation(-head)
            @ world
        )
        pose_bone.matrix = arm.matrix_world.inverted() @ posed
        bpy.context.view_layer.update()
        depsgraph.update()

    def align(name: str, current: Vector, target: Vector) -> None:
        rotate_bone_world(
            name, current.normalized().rotation_difference(target.normalized()).to_matrix()
        )

    for side, sign in (("Left", 1.0), ("Right", -1.0)):
        target = Vector((sign, 0.0, 0.0))
        upper, fore, hand = (f"{side}{part}" for part in ARM_BONES)
        align(upper, head_world(fore) - head_world(upper), target)
        align(fore, head_world(hand) - head_world(fore), target)

        points = group_verts_world(hand)
        align(hand, (sum(points, Vector()) / len(points)) - head_world(hand), target)

        # Roll the hand so the palm faces down: the thinnest axis of the hand
        # cloud, measured in the plane perpendicular to the arm, becomes +Z.
        points = group_verts_world(hand)
        centre = sum(points, Vector()) / len(points)
        syy = szz = syz = 0.0
        for point in points:
            delta = point - centre
            syy += delta.y * delta.y
            szz += delta.z * delta.z
            syz += delta.y * delta.z
        theta = 0.5 * math.atan2(2 * syz, syy - szz)
        axes = (
            Vector((0.0, math.cos(theta), math.sin(theta))),
            Vector((0.0, -math.sin(theta), math.cos(theta))),
        )
        spread = [syy * a.y**2 + 2 * syz * a.y * a.z + szz * a.z**2 for a in axes]
        thin = axes[0] if spread[0] < spread[1] else axes[1]
        if thin.z < 0:
            thin = -thin
        rotate_bone_world(hand, thin.rotation_difference(Vector((0, 0, 1))).to_matrix())
        print(f"{side}: hand={head_world(hand)}")

    bpy.ops.object.mode_set(mode="OBJECT")

    bpy.context.view_layer.objects.active = mesh
    modifier = next(m for m in mesh.modifiers if m.type == "ARMATURE")
    with bpy.context.temp_override(
        object=mesh, active_object=mesh, selected_objects=[mesh]
    ):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(arm, do_unlink=True)
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)

    # Meshy exports split every face, leaving ~2100 loose parts. Mixamo's
    # rigger wants one connected shell.
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()

    coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    print(
        "posed bounds"
        f" x[{min(c.x for c in coords):.3f},{max(c.x for c in coords):.3f}]"
        f" z[{min(c.z for c in coords):.3f},{max(c.z for c in coords):.3f}]"
        f" verts={len(mesh.data.vertices)}"
    )

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    fbx_path = out_dir / f"{stem}.fbx"
    bpy.ops.export_scene.fbx(
        filepath=str(fbx_path),
        use_selection=True,
        apply_scale_options="FBX_SCALE_ALL",
        path_mode="COPY",
        embed_textures=True,
        mesh_smooth_type="FACE",
        add_leaf_bones=False,
        bake_anim=False,
    )
    print("exported", fbx_path, fbx_path.stat().st_size)

    obj_path = out_dir / f"{stem}.obj"
    bpy.ops.wm.obj_export(
        filepath=str(obj_path),
        export_selected_objects=True,
        export_uv=True,
        export_normals=True,
        export_materials=False,
        export_triangulated_mesh=True,
        forward_axis="NEGATIVE_Z",
        up_axis="Y",
    )
    print("exported", obj_path, obj_path.stat().st_size)


if __name__ == "__main__":
    main()
