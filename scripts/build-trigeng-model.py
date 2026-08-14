"""Build the production Trigeng prop and multi-angle proof renders.

The canonical TKA SVG owns the face silhouette. The model adds only the depth,
edge treatment, and center grip needed to make that silhouette believable as a
manufactured manipulation prop.

Usage:
  blender --background --factory-startup --python scripts/build-trigeng-model.py
  blender --background --factory-startup --python scripts/build-trigeng-model.py -- \
    --output static/models/props/trigeng.glb \
    --render-dir scratchpad/trigeng-review/r1 \
    --blend scratchpad/trigeng-review/trigeng-production.blend
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "trigeng.glb"
CANONICAL_SVG = ROOT / "static" / "images" / "props" / "trigeng.svg"
AUTHORED_SPAN_M = 0.63


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
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat
    if "Coat Roughness" in principled.inputs:
        principled.inputs["Coat Roughness"].default_value = min(roughness, 0.38)
    return material


def smooth_mesh(obj: bpy.types.Object) -> None:
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


def import_canonical_silhouette() -> bpy.types.Object:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_curve.svg(filepath=str(CANONICAL_SVG))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    candidates = [
        obj
        for obj in imported
        if obj.type == "CURVE"
        and 0.01 < obj.dimensions.x < 0.2
        and 0.01 < obj.dimensions.y < 0.2
    ]
    if not candidates:
        raise RuntimeError("The canonical Trigeng silhouette was not found in the SVG")

    # The first substantial filled path is the visible .st0 silhouette. The SVG
    # also contains an invisible mirrored construction path and zero-area guides.
    source = sorted(candidates, key=lambda obj: obj.name)[0]
    for obj in imported:
        if obj is not source:
            bpy.data.objects.remove(obj, do_unlink=True)

    minimum = Vector(
        tuple(min(corner[index] for corner in source.bound_box) for index in range(3))
    )
    maximum = Vector(
        tuple(max(corner[index] for corner in source.bound_box) for index in range(3))
    )
    center = (minimum + maximum) * 0.5
    scale = AUTHORED_SPAN_M / max(source.dimensions.x, source.dimensions.y)
    source.scale = (scale, scale, scale)
    source.location = (-center.x * scale, -center.y * scale, 0.0)
    activate(source)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    source["svg_scale_factor"] = scale
    source.name = "TKA_Trigeng_CanonicalTemplate"
    return source


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 0.0
    unit = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return unit * unit * (3.0 - 2.0 * unit)


def build_crowned_shell(
    template: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    obj = template.copy()
    obj.data = template.data.copy()
    bpy.context.collection.objects.link(obj)
    obj.name = "TKA_Trigeng_CrownedShell"
    obj.location = template.location.copy()
    obj.scale = template.scale.copy()
    obj.data.dimensions = "2D"
    obj.data.fill_mode = "BOTH"
    obj.data.resolution_u = 10
    obj.data.render_resolution_u = 10

    # The imported curve retains SVG-unit depth values. A wide roll produces a
    # padded, hollow-shell cross-section instead of a laser-cut slab.
    svg_scale = float(template.get("svg_scale_factor", 1.0))
    obj.data.extrude = 0.0045 / svg_scale
    obj.data.bevel_depth = 0.0105 / svg_scale
    obj.data.bevel_resolution = 6
    activate(obj)
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)

    # SVG fills convert to a handful of enormous, needle-shaped triangles.
    # A uniform voxel surface gives the radial crown enough interior topology
    # to bend continuously without exposing those triangulation scars.
    activate(obj)
    obj.data.remesh_voxel_size = 0.0055
    obj.data.remesh_voxel_adaptivity = 0.0
    obj.data.use_remesh_fix_poles = True
    obj.data.use_remesh_preserve_volume = True
    bpy.ops.object.voxel_remesh()

    # Build the grip and tip treatment into the shell itself. The center grows
    # into a shallow palm bolster while each outer hook loses thickness toward
    # its end. Both faces receive the same continuous crown.
    for vertex in obj.data.vertices:
        radius = math.hypot(vertex.co.x, vertex.co.y)
        center_bolster = math.exp(-((radius / 0.145) ** 2))
        tip_taper = smoothstep(0.20, 0.325, radius)
        thickness_scale = 1.0 + 0.78 * center_bolster - 0.35 * tip_taper
        vertex.co.z *= thickness_scale
    obj.data.update()
    return finish_mesh(obj, material)


def build_shell_seam(
    template: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    seam = template.copy()
    seam.data = template.data.copy()
    bpy.context.collection.objects.link(seam)
    seam.name = "TKA_Trigeng_MoldSeam"
    seam.location = template.location.copy()
    seam.scale = template.scale.copy()
    seam.data.dimensions = "3D"
    seam.data.resolution_u = 10
    seam.data.render_resolution_u = 10
    seam.data.extrude = 0.0
    seam.data.bevel_depth = 0.00115 / float(
        template.get("svg_scale_factor", 1.0)
    )
    seam.data.bevel_resolution = 3
    activate(seam)
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    return finish_mesh(seam, material)


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    recolor = make_material(
        "TKA_Trigeng_Recolor",
        (0.018, 0.11, 0.58, 1.0),
        roughness=0.55,
        coat=0.08,
    )
    seam = make_material(
        "TKA_Trigeng_ShellSeam",
        (0.018, 0.027, 0.046, 1.0),
        roughness=0.78,
    )

    root = bpy.data.objects.new("TKA_Trigeng", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "trigeng"
    root["authored_span_m"] = AUTHORED_SPAN_M
    root["grip_origin"] = "0,0,0"
    root["local_primary_axis"] = "+Y"
    root["recolor_material"] = "TKA_Trigeng_Recolor"
    root["canonical_source"] = "static/images/props/trigeng.svg"
    root["reference_form"] = "crowned hollow-molded three-arm flow shell"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.parent = root
    pivot["tka_grip"] = True

    template = import_canonical_silhouette()
    objects = [
        build_crowned_shell(template, recolor),
        build_shell_seam(template, seam),
    ]

    bpy.data.objects.remove(template, do_unlink=True)
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

    # Match the established scene-3d GLB export basis.
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
    background.inputs["Color"].default_value = (0.005, 0.008, 0.016, 1.0)
    background.inputs["Strength"].default_value = 0.18

    for name, location, energy, size, color in (
        ("QA_Key", (-0.72, 0.62, 1.00), 135, 0.78, (0.94, 0.87, 0.74)),
        ("QA_Fill", (0.82, -0.18, 0.78), 82, 0.70, (0.40, 0.62, 1.00)),
        ("QA_Rim", (-0.54, -0.45, -0.74), 96, 0.64, (0.90, 0.24, 0.12)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, 0.0, 0.0)))

    bpy.ops.object.camera_add(location=(0.0, -0.04, 1.18))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 62
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
    scene.view_settings.exposure = -1.55

    views = {
        "front": (0.0, -0.03, 1.18),
        "three-quarter": (0.70, -0.20, 0.95),
        "profile": (1.18, -0.03, 0.05),
        "rear": (0.0, -0.03, -1.18),
    }
    for label, location in views.items():
        camera.location = location
        point_at(camera, Vector((0.0, 0.0, 0.0)))
        scene.render.filepath = str(render_dir / f"trigeng-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, model_objects: list[bpy.types.Object]) -> None:
    meshes = [obj for obj in model_objects if obj.type == "MESH"]
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    polygons = sum(len(obj.data.polygons) for obj in meshes)
    print(f"TRIGENG_OUTPUT={output_path}")
    print(f"TRIGENG_BYTES={output_path.stat().st_size}")
    print(f"TRIGENG_MESHES={len(meshes)}")
    print(f"TRIGENG_VERTICES={vertices}")
    print(f"TRIGENG_POLYGONS={polygons}")
    print(f"TRIGENG_SPAN_M={AUTHORED_SPAN_M}")
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
