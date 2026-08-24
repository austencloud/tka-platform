"""Build the real-photo-derived Double Star as a production GLB."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "doublestar.glb"
REFERENCE_SVG = ROOT / "scripts" / "assets" / "doublestar-reference.svg"
AUTHORED_LENGTH_M = 1.025
PLATE_DEPTH_M = 0.012
EDGE_RADIUS_M = 0.0032


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
    return material


def smart_uv(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or not obj.data.polygons:
        return
    activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(62),
        island_margin=0.012,
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def finish_plate(obj: bpy.types.Object, depth: float, bevel_width: float) -> None:
    solidify = obj.modifiers.new("Molded plate thickness", "SOLIDIFY")
    solidify.thickness = depth
    solidify.offset = 0.0
    apply_modifier(obj, solidify.name)
    bevel = obj.modifiers.new("Hand-safe molded edge", "BEVEL")
    bevel.width = bevel_width
    bevel.segments = 6
    bevel.limit_method = "ANGLE"
    apply_modifier(obj, bevel.name)
    # The front and back are large concave faces with two openings. Leaving
    # those as n-gons lets the glTF exporter choose its own diagonals, which can
    # cut across an opening and appear in the app as detached floating wedges.
    # Freeze Blender's valid tessellation into the mesh before it reaches glTF.
    triangulate = obj.modifiers.new("Stable glTF face tessellation", "TRIANGULATE")
    triangulate.quad_method = "BEAUTY"
    triangulate.ngon_method = "BEAUTY"
    apply_modifier(obj, triangulate.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = abs(polygon.normal.y) < 0.94
    smart_uv(obj)


def import_reference_body(material: bpy.types.Material) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(REFERENCE_SVG))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if len(imported) != 1:
        raise RuntimeError(
            f"Expected one compound Double Star SVG object, found {len(imported)}"
        )
    body = imported[0]
    if body.type != "CURVE" or len(body.data.splines) != 3:
        raise RuntimeError(
            "Double Star trace must contain one perimeter and two star openings"
        )

    body.name = "TKA_Doublestar_ReferenceBody_Recolor"
    body.data.dimensions = "2D"
    body.data.fill_mode = "BOTH"
    # The reference now uses short, sparse cubic segments measured from the
    # photograph. Four subdivisions per short segment keeps those rails visually
    # continuous at 4K without filling the GLB with redundant collinear points.
    body.data.resolution_u = 4
    activate(body)
    bpy.ops.object.convert(target="MESH")

    minimum = Vector(
        (
            min(vertex.co.x for vertex in body.data.vertices),
            min(vertex.co.y for vertex in body.data.vertices),
            0.0,
        )
    )
    maximum = Vector(
        (
            max(vertex.co.x for vertex in body.data.vertices),
            max(vertex.co.y for vertex in body.data.vertices),
            0.0,
        )
    )
    center = (minimum + maximum) * 0.5
    source_length = maximum.y - minimum.y
    if source_length <= 0:
        raise RuntimeError("Double Star SVG has no measurable length")
    scale = AUTHORED_LENGTH_M / source_length

    # The runtime prop convention is a plate in XZ with its long axis along +Y
    # after Blender's Z-up coordinates are converted to glTF's Y-up coordinates.
    for vertex in body.data.vertices:
        source = vertex.co - center
        vertex.co = Vector((source.x * scale, 0.0, source.y * scale))

    body.data.materials.clear()
    body.data.materials.append(material)
    finish_plate(body, PLATE_DEPTH_M, EDGE_RADIUS_M)
    body["tka_runtime_recolor"] = True
    body["reference_trace"] = "scripts/assets/doublestar-reference.svg"
    body["symmetry"] = "bilateral plus end-for-end from upper-half photo trace"
    return body


def prism_from_xz_polygon(
    name: str,
    points: list[tuple[float, float]],
    depth: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    half = depth * 0.5
    vertices = [(x, -half, z) for x, z in points] + [
        (x, half, z) for x, z in points
    ]
    count = len(points)
    faces = [
        tuple(range(count - 1, -1, -1)),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, count + following, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft reinforcement edge", "BEVEL")
    bevel.width = 0.00055
    bevel.segments = 3
    apply_modifier(obj, bevel.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = abs(polygon.normal.y) < 0.92
    smart_uv(obj)
    return obj


def build_center_reinforcement(material: bpy.types.Material) -> list[bpy.types.Object]:
    # The photograph shows the real two-piece assembly: a narrow tongue from
    # the upper half overlaps the receiver at the center seam.  It is not a
    # pair of mirrored decorative panels.  Keep the relief fully inset so it
    # never alters the measured outer silhouette.
    points = [
        (-0.0140, 0.006),
        (0.0140, 0.006),
        (0.0120, 0.116),
        (-0.0120, 0.116),
    ]
    return [
        prism_from_xz_polygon(
            "TKA_Doublestar_GripTongue_Top_Recolor",
            points,
            PLATE_DEPTH_M + 0.0007,
            material,
        )
    ]


def build_center_seams(material: bpy.types.Material) -> list[bpy.types.Object]:
    seams = []
    for face, depth_sign in (("Front", -1.0), ("Back", 1.0)):
        bpy.ops.mesh.primitive_cube_add(
            location=(0.0, depth_sign * PLATE_DEPTH_M * 0.515, 0.0)
        )
        seam = bpy.context.object
        seam.name = f"TKA_Doublestar_CenterJoint_{face}"
        seam.dimensions = (0.0380, 0.0003, 0.0014)
        activate(seam)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        seam.data.materials.append(material)
        bevel = seam.modifiers.new("Joint edge", "BEVEL")
        bevel.width = 0.00025
        bevel.segments = 2
        apply_modifier(seam, bevel.name)
        smart_uv(seam)
        seams.append(seam)
    return seams


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    body_material = make_material(
        "TKA_Doublestar_Recolor",
        (0.015, 0.52, 0.58, 1.0),
        roughness=0.42,
        coat=0.10,
    )
    seam_material = make_material(
        "TKA_Doublestar_GripJoint_Recolor",
        (0.030, 0.260, 0.290, 1.0),
        roughness=0.78,
    )

    root = bpy.data.objects.new("TKA_Doublestar", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "doublestar"
    root["authored_length_m"] = AUTHORED_LENGTH_M
    root["plate_depth_m"] = PLATE_DEPTH_M
    root["grip_origin"] = "0,0,0"
    root["local_primary_axis"] = "+Y"
    root["recolor_material"] = "TKA_Doublestar_Recolor"
    root["tka_recolor_mode"] = "palette-main"
    root["canonical_source"] = "scripts/assets/doublestar-reference-photo.png"
    root["reference_trace"] = "scripts/assets/doublestar-reference.svg"
    root["symmetry_method"] = "upper-half scanline trace mirrored left-right and end-for-end"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot["tka_grip"] = True

    body = import_reference_body(body_material)
    reinforcements = build_center_reinforcement(body_material)
    seams = build_center_seams(seam_material)
    model_objects = [pivot, body, *reinforcements, *seams]
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
    background.inputs["Color"].default_value = (0.004, 0.006, 0.012, 1.0)
    background.inputs["Strength"].default_value = 0.18
    for name, location, energy, size, color in (
        ("QA_Key", (-0.85, -1.20, 1.10), 105, 0.92, (0.92, 0.86, 0.76)),
        ("QA_Fill", (0.88, -0.42, 0.48), 68, 0.78, (0.36, 0.62, 1.00)),
        ("QA_Rim", (-0.58, 0.72, -0.64), 82, 0.72, (0.92, 0.20, 0.13)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((0.0, 0.0, 0.0)))
    bpy.ops.object.camera_add(location=(0.0, -2.15, 0.0))
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 64
    camera.data.sensor_width = 36
    bpy.context.scene.camera = camera
    return camera


def render_proofs(render_dir: Path) -> None:
    render_dir.mkdir(parents=True, exist_ok=True)
    camera = add_proof_lighting()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    views = {
        "front": (0.0, -2.15, 0.0),
        "three-quarter": (0.86, -1.86, 0.42),
        "profile": (1.75, -0.12, 0.0),
        "grip": (0.18, -0.52, 0.0),
    }
    for label, location in views.items():
        camera.location = location
        camera.data.lens = 64 if label != "grip" else 82
        point_at(camera, Vector((0.0, 0.0, 0.0)))
        scene.render.filepath = str(render_dir / f"doublestar-{label}.png")
        bpy.ops.render.render(write_still=True)


def print_summary(output_path: Path, model_objects: list[bpy.types.Object]) -> None:
    meshes = [obj for obj in model_objects if obj.type == "MESH"]
    print(f"DOUBLESTAR_OUTPUT={output_path}")
    print(f"DOUBLESTAR_BYTES={output_path.stat().st_size}")
    print(f"DOUBLESTAR_MESHES={len(meshes)}")
    print(f"DOUBLESTAR_VERTICES={sum(len(obj.data.vertices) for obj in meshes)}")
    print(f"DOUBLESTAR_POLYGONS={sum(len(obj.data.polygons) for obj in meshes)}")
    print(f"DOUBLESTAR_LENGTH_M={AUTHORED_LENGTH_M}")
    print(f"DOUBLESTAR_PLATE_DEPTH_M={PLATE_DEPTH_M}")
    print("DOUBLESTAR_HAND_PIVOT=0,0,0")


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
