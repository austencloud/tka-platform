"""Extrude the reference-derived, threefold-symmetric Trigeng silhouette."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "trigeng.glb"
REFERENCE_SVG = ROOT / "scripts" / "assets" / "trigeng-reference.svg"
AUTHORED_SPAN_M = 0.56
PLATE_DEPTH_M = 0.012


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


def apply_modifier(obj: bpy.types.Object, name: str) -> None:
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=name)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    *,
    metallic: float = 0.0,
    coat: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat
    return material


def smart_uv(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or not obj.data.polygons:
        return
    activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66),
        island_margin=0.015,
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def finish_plate(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    solidify = obj.modifiers.new("12mm impact plate", "SOLIDIFY")
    solidify.thickness = PLATE_DEPTH_M
    solidify.offset = 0.0
    apply_modifier(obj, solidify.name)
    bevel = obj.modifiers.new("Continuous hand-safe edge", "BEVEL")
    bevel.width = 0.0022
    bevel.segments = 4
    bevel.limit_method = "ANGLE"
    apply_modifier(obj, bevel.name)
    for polygon in obj.data.polygons:
        # Keep the two broad plate faces optically flat. Only the routed edge
        # and narrow side wall receive interpolated shading.
        polygon.use_smooth = abs(polygon.normal.y) < 0.92
    smart_uv(obj)


def import_reference_body(
    svg_path: Path, material: bpy.types.Material
) -> tuple[bpy.types.Object, float]:
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(svg_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if len(imported) != 1:
        raise RuntimeError(
            f"Expected one compound SVG object, found {len(imported)} in {svg_path}"
        )

    body = imported[0]
    if body.type != "CURVE" or len(body.data.splines) != 2:
        raise RuntimeError("Trigeng trace must contain one perimeter and one grip hole")

    # The smallest spline is the central finger hole. Centering the authored
    # prop on it makes the runtime hand pivot agree with the physical grip.
    grip_spline = min(body.data.splines, key=lambda spline: len(spline.bezier_points))
    grip_points = [point.co.copy() for point in grip_spline.bezier_points]
    grip_center = sum(grip_points, Vector()) / len(grip_points)
    grip_radius_svg = sum(
        (point - grip_center).length for point in grip_points
    ) / len(grip_points)

    span_svg = max(body.dimensions.x, body.dimensions.y)
    if span_svg <= 0:
        raise RuntimeError("Trigeng reference SVG has no measurable span")
    scale = AUTHORED_SPAN_M / span_svg

    body.name = "TKA_Trigeng_ReferenceBody_Recolor"
    body.data.dimensions = "2D"
    body.data.fill_mode = "BOTH"
    body.data.resolution_u = 2
    activate(body)
    bpy.ops.object.convert(target="MESH")

    # SVG import already flips its screen-space Y coordinate. Move the exact
    # traced grip center to the origin and author the plate in Blender's XZ
    # plane, leaving local +Y as the hand-facing depth axis.
    for vertex in body.data.vertices:
        source = vertex.co - grip_center
        vertex.co = Vector((source.x * scale, 0.0, source.y * scale))

    finish_plate(body, material)
    body["tka_runtime_recolor"] = True
    body["reference_trace"] = "scripts/assets/trigeng-reference.svg"
    body["symmetry"] = "threefold 2-of-3 rotational vote"
    return body, grip_radius_svg * scale


def build_grip_liner(
    material: bpy.types.Material, grip_radius: float
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=grip_radius + 0.0011,
        minor_radius=0.0018,
        major_segments=72,
        minor_segments=12,
        location=(0.0, -PLATE_DEPTH_M * 0.52, 0.0),
        rotation=(math.pi / 2.0, 0.0, 0.0),
    )
    liner = bpy.context.object
    liner.name = "TKA_Trigeng_GripLiner"
    liner.data.materials.append(material)
    for polygon in liner.data.polygons:
        polygon.use_smooth = True
    smart_uv(liner)
    return liner


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    body_material = make_material(
        "TKA_Trigeng_Recolor",
        (0.018, 0.11, 0.62, 1.0),
        roughness=0.48,
        coat=0.08,
    )
    liner_material = make_material(
        "TKA_Trigeng_Grip",
        (0.015, 0.019, 0.027, 1.0),
        roughness=0.74,
    )

    root = bpy.data.objects.new("TKA_Trigeng", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "trigeng"
    root["authored_span_m"] = AUTHORED_SPAN_M
    root["plate_depth_m"] = PLATE_DEPTH_M
    root["grip_origin"] = "0,0,0"
    root["local_primary_axis"] = "+Y"
    root["recolor_material"] = "TKA_Trigeng_Recolor"
    root["reference_form"] = "threefold-symmetrized tri-blade reference silhouette"
    root["canonical_source"] = "scripts/assets/trigeng-reference.svg"
    root["symmetry_method"] = "2-of-3 vote at 0, 120, and 240 degrees"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot["tka_grip"] = True

    body, grip_radius = import_reference_body(REFERENCE_SVG, body_material)
    liner = build_grip_liner(liner_material, grip_radius)
    model_objects = [pivot, body, liner]
    for obj in model_objects:
        obj.parent = root
    return root, model_objects


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


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_proof_lighting() -> bpy.types.Object:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.005, 0.008, 0.016, 1.0)
    background.inputs["Strength"].default_value = 0.17
    for name, location, energy, size, color in (
        ("QA_Key", (-0.72, -0.82, 0.92), 145, 0.82, (0.94, 0.87, 0.74)),
        ("QA_Fill", (0.84, -0.30, 0.52), 90, 0.74, (0.40, 0.62, 1.00)),
        ("QA_Rim", (-0.48, 0.58, -0.58), 105, 0.68, (0.92, 0.24, 0.12)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, 0.0, 0.0)))
    bpy.ops.object.camera_add(location=(0.0, -1.08, 0.0))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 58
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
    views = {
        "front": (0.0, -1.08, 0.0),
        "three-quarter": (0.68, -0.84, 0.38),
        "profile": (1.08, -0.04, 0.0),
        "rear": (0.0, 1.08, 0.0),
    }
    for label, location in views.items():
        camera.location = location
        point_at(camera, Vector((0.0, 0.0, 0.0)))
        scene.render.filepath = str(render_dir / f"trigeng-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, model_objects: list[bpy.types.Object]) -> None:
    meshes = [obj for obj in model_objects if obj.type == "MESH"]
    print(f"TRIGENG_OUTPUT={output_path}")
    print(f"TRIGENG_BYTES={output_path.stat().st_size}")
    print(f"TRIGENG_MESHES={len(meshes)}")
    print(f"TRIGENG_VERTICES={sum(len(obj.data.vertices) for obj in meshes)}")
    print(f"TRIGENG_POLYGONS={sum(len(obj.data.polygons) for obj in meshes)}")
    print(f"TRIGENG_SPAN_M={AUTHORED_SPAN_M}")
    print(f"TRIGENG_PLATE_DEPTH_M={PLATE_DEPTH_M}")
    print("TRIGENG_HAND_PIVOT=0,0,0")


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
