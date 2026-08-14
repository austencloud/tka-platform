"""Build the production Buugeng prop and an optional studio proof render.

The 2D prop silhouette is the canonical shape source. Blender gives that
silhouette physical depth, rounded edges, clean materials, UVs, and the
local-axis contract expected by the scene-3d prop renderer.

Usage:
  blender --background --factory-startup --python scripts/build-buugeng-model.py
  blender --background --factory-startup --python scripts/build-buugeng-model.py -- \
    --output static/models/props/buugeng.glb \
    --render C:/path/to/buugeng-proof.png
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SVG = ROOT / "static" / "images" / "props" / "buugeng.svg"
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "buugeng.glb"

MODEL_LENGTH_M = 0.83
BLADE_DEPTH_M = 0.010


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--svg", type=Path, default=DEFAULT_SVG)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--render", type=Path)
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


def material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    principled = result.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return result


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifier(obj: bpy.types.Object, name: str) -> None:
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=name)


def smart_uv(obj: bpy.types.Object) -> None:
    activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66),
        island_margin=0.02,
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def build_body(
    svg_path: Path,
    body_material: bpy.types.Material,
) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(svg_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if len(imported) != 1:
        raise RuntimeError(
            f"Expected one SVG path object, found {len(imported)} in {svg_path}"
        )

    body = imported[0]
    body.name = "TKA_Buugeng_Body"
    body.data.dimensions = "2D"
    body.data.fill_mode = "BOTH"
    body.data.resolution_u = 12
    activate(body)
    bpy.ops.object.convert(target="MESH")

    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    for vertex in body.data.vertices:
        minimum.x = min(minimum.x, vertex.co.x)
        minimum.y = min(minimum.y, vertex.co.y)
        minimum.z = min(minimum.z, vertex.co.z)
        maximum.x = max(maximum.x, vertex.co.x)
        maximum.y = max(maximum.y, vertex.co.y)
        maximum.z = max(maximum.z, vertex.co.z)

    center = (minimum + maximum) * 0.5
    svg_length = maximum.x - minimum.x
    if svg_length <= 0:
        raise RuntimeError("Buugeng SVG has no measurable length")
    scale = MODEL_LENGTH_M / svg_length

    # Blender is Z-up while glTF is Y-up. This proper rotation leaves the
    # exported mesh long on local Y, wide on X, and thin on Z.
    for vertex in body.data.vertices:
        source = vertex.co - center
        vertex.co = Vector(
            (-source.y * scale, -source.z * scale, source.x * scale)
        )

    body.data.materials.clear()
    body.data.materials.append(body_material)
    for polygon in body.data.polygons:
        polygon.material_index = 0

    solidify = body.modifiers.new("Blade depth", "SOLIDIFY")
    solidify.thickness = BLADE_DEPTH_M
    solidify.offset = 0.0
    solidify.material_offset = 0
    apply_modifier(body, solidify.name)

    bevel = body.modifiers.new("Routed edge", "BEVEL")
    bevel.width = 0.0012
    bevel.segments = 3
    bevel.limit_method = "ANGLE"
    bevel.material = 0
    apply_modifier(body, bevel.name)

    activate(body)
    bpy.ops.object.shade_smooth_by_angle(
        angle=math.radians(38), keep_sharp_edges=True
    )
    smart_uv(body)
    return body


def build_prop(svg_path: Path) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    body_surface = material(
        "TKA_Body_Recolor", (0.025, 0.19, 0.8, 1.0), roughness=0.32, metallic=0.04
    )
    body = build_body(svg_path, body_surface)

    root = bpy.data.objects.new("TKA_Buugeng", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "buugeng"
    root["authored_length_m"] = MODEL_LENGTH_M
    root["grip_origin"] = "0,0,0"
    root["local_long_axis"] = "+Y"
    root["recolor_material"] = "TKA_Body_Recolor"

    children = [body]
    for child in children:
        child.parent = root
        child["tka_runtime_recolor"] = True
        smart_uv(child)
    return root, children


def export_glb(
    output_path: Path,
    root: bpy.types.Object,
    children: list[bpy.types.Object],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

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


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_proof(render_path: Path) -> None:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.016, 0.028, 1.0)
    background.inputs["Strength"].default_value = 0.22

    bpy.ops.mesh.primitive_plane_add(size=6.0, location=(0.0, 0.11, 0.0))
    backdrop = bpy.context.object
    backdrop.name = "QA_Backdrop"
    backdrop.rotation_euler = (math.pi / 2, 0.0, 0.0)
    backdrop.data.materials.append(
        material(
            "QA_Backdrop_Material",
            (0.018, 0.025, 0.047, 1.0),
            roughness=0.62,
            metallic=0.0,
        )
    )

    bpy.ops.object.light_add(type="AREA", location=(-0.8, -1.4, 1.15))
    key = bpy.context.object
    key.name = "QA_Key"
    key.data.energy = 170
    key.data.shape = "DISK"
    key.data.size = 1.4
    point_camera(key, Vector((0.0, 0.0, 0.08)))

    bpy.ops.object.light_add(type="AREA", location=(1.15, -0.5, -0.1))
    rim = bpy.context.object
    rim.name = "QA_Rim"
    rim.data.energy = 115
    rim.data.color = (0.26, 0.5, 1.0)
    rim.data.size = 1.0
    point_camera(rim, Vector((0.0, 0.0, 0.0)))

    bpy.ops.object.light_add(type="AREA", location=(-0.25, 0.65, -0.65))
    fill = bpy.context.object
    fill.name = "QA_Fill"
    fill.data.energy = 75
    fill.data.color = (1.0, 0.24, 0.16)
    fill.data.size = 0.8
    point_camera(fill, Vector((0.0, 0.0, -0.08)))

    bpy.ops.object.camera_add(location=(0.7, -2.45, 0.32))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 72
    point_camera(camera, Vector((0.0, 0.0, 0.0)))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.filepath = str(render_path)
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.resolution_percentage = 100
    render_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, root: bpy.types.Object) -> None:
    meshes = [obj for obj in root.children if obj.type == "MESH"]
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    polygons = sum(len(obj.data.polygons) for obj in meshes)
    print(f"BUUGENG_OUTPUT={output_path}")
    print(f"BUUGENG_BYTES={output_path.stat().st_size}")
    print(f"BUUGENG_MESHES={len(meshes)}")
    print(f"BUUGENG_VERTICES={vertices}")
    print(f"BUUGENG_POLYGONS={polygons}")
    print("BUUGENG_LENGTH_M=0.83")
    print("BUUGENG_HAND_PIVOT=0,0,0")


def main() -> None:
    args = parse_args()
    svg_path = args.svg.resolve()
    output_path = args.output.resolve()
    if not svg_path.exists():
        raise FileNotFoundError(svg_path)

    reset_scene()
    root, children = build_prop(svg_path)
    export_glb(output_path, root, children)
    if args.blend:
        args.blend.resolve().parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    if args.render:
        render_proof(args.render.resolve())
    print_summary(output_path, root)


if __name__ == "__main__":
    main()
