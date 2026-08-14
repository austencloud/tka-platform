"""Build the production Double Contact Ball prop and proof renders.

The canonical TKA artwork owns the two-ball proportion. The model turns that
flat pair into two soft weighted stage balls pressed together at the hand
origin, with enough surface detail to keep both lobes readable in motion.

Usage:
  blender --background --factory-startup --python scripts/build-double-contact-ball-model.py
  blender --background --factory-startup --python scripts/build-double-contact-ball-model.py -- \
    --output static/models/props/double-contact-ball.glb \
    --render-dir scratchpad/double-contact-ball-review/r1 \
    --blend scratchpad/double-contact-ball-review/double-contact-ball-production.blend
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "double-contact-ball.glb"
CANONICAL_SVG = (
    ROOT / "static" / "images" / "props" / "pictograph" / "doublecontactball.svg"
)
BALL_DIAMETER_M = 0.115
BALL_RADIUS_M = BALL_DIAMETER_M / 2
BALL_CENTER_M = 0.055
AUTHORED_SPAN_M = (BALL_CENTER_M + BALL_RADIUS_M) * 2


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--render-dir", type=Path)
    parser.add_argument("--blend", type=Path)
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.curves,
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    *,
    coat: float = 0.0,
    transmission: float = 0.0,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    if "Metallic" in principled.inputs:
        principled.inputs["Metallic"].default_value = 0.0
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat
    if "Coat Roughness" in principled.inputs:
        principled.inputs["Coat Roughness"].default_value = min(roughness, 0.42)
    if "Transmission Weight" in principled.inputs:
        principled.inputs["Transmission Weight"].default_value = transmission
    if "Emission Color" in principled.inputs:
        principled.inputs["Emission Color"].default_value = color
    if "Emission Strength" in principled.inputs:
        principled.inputs["Emission Strength"].default_value = emission_strength
    return material


def smooth_mesh(obj: bpy.types.Object) -> None:
    if obj.type != "MESH":
        return
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def smart_uv(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or not obj.data.polygons:
        return
    activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66),
        island_margin=0.012,
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def finish_mesh(obj: bpy.types.Object, material: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    smooth_mesh(obj)
    smart_uv(obj)
    return obj


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 0.0
    unit = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return unit * unit * (3.0 - 2.0 * unit)


def build_soft_ball(
    label: str,
    center_y: float,
    shell_material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=64,
        ring_count=32,
        radius=BALL_RADIUS_M,
        location=(0.0, center_y, 0.0),
    )
    ball = bpy.context.object
    ball.name = f"TKA_DoubleContactBall_{label}_Shell"

    # Two soft balls flatten against one another around a small circular patch.
    # The outer silhouette stays spherical while the center no longer looks
    # like two mathematically intersecting primitives.
    inward_sign = -1.0 if center_y > 0 else 1.0
    cap_start = 0.0485
    cap_plane = 0.05535
    for vertex in ball.data.vertices:
        inward = vertex.co.y * inward_sign
        if inward > cap_start:
            blend = smoothstep(cap_start, BALL_RADIUS_M, inward)
            flattened = inward + (cap_plane - inward) * blend
            vertex.co.y = flattened * inward_sign
    ball.data.update()
    return finish_mesh(ball, shell_material)


def build_port(
    label: str,
    side: float,
    port_material: bpy.types.Material,
    lip_material: bpy.types.Material,
) -> list[bpy.types.Object]:
    outer_y = side * (BALL_CENTER_M + BALL_RADIUS_M - 0.0002)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32,
        radius=0.0041,
        depth=0.0005,
        location=(0.0, outer_y, 0.0),
        rotation=(math.pi / 2, 0.0, 0.0),
    )
    lip = bpy.context.object
    lip.name = f"TKA_DoubleContactBall_{label}_PortLip"
    finish_mesh(lip, lip_material)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32,
        radius=0.0027,
        depth=0.00055,
        location=(0.0, outer_y + side * 0.00028, 0.0),
        rotation=(math.pi / 2, 0.0, 0.0),
    )
    port = bpy.context.object
    port.name = f"TKA_DoubleContactBall_{label}_FillPort"
    finish_mesh(port, port_material)
    return [lip, port]


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    shell = make_material(
        "TKA_DoubleContactBall_Recolor_Shell",
        (0.006, 0.055, 0.42, 1.0),
        roughness=0.62,
        coat=0.02,
    )
    port = make_material(
        "TKA_DoubleContactBall_Port",
        (0.012, 0.018, 0.03, 1.0),
        roughness=0.88,
    )

    root = bpy.data.objects.new("TKA_DoubleContactBall", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "doublecontactball"
    root["authored_span_m"] = AUTHORED_SPAN_M
    root["sphere_diameter_m"] = BALL_DIAMETER_M
    root["grip_origin"] = "0,0,0"
    root["local_primary_axis"] = "+Y"
    root["recolor_material"] = "TKA_DoubleContactBall_Recolor_Shell"
    root["canonical_source"] = (
        "static/images/props/pictograph/doublecontactball.svg"
    )
    root["reference_form"] = "two soft weighted stage balls held as one cluster"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    objects: list[bpy.types.Object] = []
    for label, center_y, side in (
        ("Negative", -BALL_CENTER_M, -1.0),
        ("Positive", BALL_CENTER_M, 1.0),
    ):
        objects.append(build_soft_ball(label, center_y, shell))
        objects.extend(build_port(label, side, port, shell))

    for obj in objects:
        obj.parent = root
        obj["tka_runtime_recolor"] = any(
            "Recolor" in material.name for material in obj.data.materials
        )

    return root, [pivot, *objects]


def export_glb(
    output_path: Path,
    root: bpy.types.Object,
    model_objects: list[bpy.types.Object],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in model_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root

    root.rotation_euler.x = math.pi / 2
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_extras=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=False,
            export_materials="EXPORT",
            export_cameras=False,
            export_lights=False,
            export_animations=False,
        )
    finally:
        root.rotation_euler.x = 0.0


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_proof_lighting() -> bpy.types.Object:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.004, 0.006, 0.012, 1.0)
    background.inputs["Strength"].default_value = 0.16

    for name, location, energy, size, color in (
        ("QA_Key", (-0.34, -0.26, 0.46), 88, 0.36, (0.92, 0.88, 0.78)),
        ("QA_Fill", (0.38, 0.18, 0.30), 54, 0.30, (0.36, 0.58, 1.00)),
        ("QA_Rim", (-0.24, 0.22, -0.32), 72, 0.28, (0.94, 0.22, 0.14)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, 0.0, 0.0)))

    bpy.ops.object.camera_add(location=(0.0, -0.01, 0.44))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 66
    camera.data.sensor_width = 36
    bpy.context.scene.camera = camera
    return camera


def render_proofs(render_dir: Path) -> None:
    render_dir.mkdir(parents=True, exist_ok=True)
    camera = add_proof_lighting()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.45

    views = {
        "front": (0.0, -0.01, 0.44),
        "three-quarter": (0.30, -0.25, 0.31),
        "side": (0.44, -0.01, 0.04),
        "end": (0.0, -0.44, 0.02),
        "rear": (0.0, -0.01, -0.44),
        "grip": (0.22, -0.15, 0.22),
    }
    for label, location in views.items():
        camera.location = location
        point_at(camera, Vector((0.0, 0.0, 0.0)))
        scene.render.filepath = str(render_dir / f"double-contact-ball-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, model_objects: list[bpy.types.Object]) -> None:
    meshes = [obj for obj in model_objects if obj.type == "MESH"]
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    polygons = sum(len(obj.data.polygons) for obj in meshes)
    print(f"DOUBLE_CONTACT_BALL_OUTPUT={output_path}")
    print(f"DOUBLE_CONTACT_BALL_BYTES={output_path.stat().st_size}")
    print(f"DOUBLE_CONTACT_BALL_MESHES={len(meshes)}")
    print(f"DOUBLE_CONTACT_BALL_VERTICES={vertices}")
    print(f"DOUBLE_CONTACT_BALL_POLYGONS={polygons}")
    print(f"DOUBLE_CONTACT_BALL_SPAN_M={AUTHORED_SPAN_M}")
    print("DOUBLE_CONTACT_BALL_HAND_PIVOT=0,0,0")


def main() -> None:
    args = parse_args()
    output_path = args.output.resolve()
    reset_scene()
    root, model_objects = build_prop()
    export_glb(output_path, root, model_objects)

    if args.blend:
        blend_path = args.blend.resolve()
        blend_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    if args.render_dir:
        render_proofs(args.render_dir.resolve())

    print_summary(output_path, model_objects)


if __name__ == "__main__":
    main()
