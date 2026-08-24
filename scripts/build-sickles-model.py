"""Build one matched competition sickle (kama) for the TKA prop renderer.

The model follows the real Fire & Ice competition-kama reference and its
published 36 x 19 x 4 cm envelope. One GLB is instanced into both hands; the
runtime recolors the handle shells and blade spine red/blue while preserving
the silver blade, black grip, and chrome hardware.

The hand pivot sits in the lower wrapped grip, close to the butt of the handle.
The blade apex is then aligned to runtime +Y, so TKA orientation describes the
visible cutting end instead of the decorative angle of the handle.

Usage:
  blender --background --factory-startup --python scripts/build-sickles-model.py
  blender --background --factory-startup --python scripts/build-sickles-model.py -- \
    --render-dir scratchpad/sickles-review/r1
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "static" / "models" / "props" / "sickles.glb"
REFERENCE_SVG = ROOT / "scripts" / "assets" / "sickles-blade-reference.svg"

AUTHORED_HEIGHT_M = 0.36
AUTHORED_WIDTH_M = 0.19
AUTHORED_DEPTH_M = 0.04
BLADE_HEIGHT_M = 0.110
BLADE_DEPTH_M = 0.008
EDGE_RADIUS_M = 0.0016
HANDLE_RADIUS_M = 0.0125
GRIP_PIVOT_Z_M = -0.125
# The reference blade apex sits here before kinetic-axis alignment. Rotate the
# physical kama around its hand pivot so that this tracked point, rather than
# the wooden handle, defines runtime +Y. That is the same convention the 2D
# prop uses and keeps letters faithful while the handle visibly crosses them at
# the real kama's characteristic angle.
BLADE_APEX_X_M = 0.190
BLADE_APEX_Z_M = 0.073
BLADE_APEX_FROM_GRIP_Z_M = BLADE_APEX_Z_M - GRIP_PIVOT_Z_M
KINETIC_AXIS_ROTATION_Y = -math.atan2(BLADE_APEX_X_M, BLADE_APEX_FROM_GRIP_Z_M)
TRACKED_TIP_REACH_M = math.hypot(BLADE_APEX_X_M, BLADE_APEX_FROM_GRIP_Z_M)


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
        bpy.data.images,
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
        angle_limit=math.radians(62),
        island_margin=0.012,
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def finish_mesh(
    obj: bpy.types.Object,
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
) -> bpy.types.Object:
    activate(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Hand-safe edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        apply_modifier(obj, modifier.name)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    smart_uv(obj)
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    z: float,
    material: bpy.types.Material,
    *,
    vertices: int = 48,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=(0.0, 0.0, z),
    )
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, material, bevel=min(radius * 0.16, 0.0014))


def torus_ring(
    name: str,
    z: float,
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=10,
        location=(0.0, 0.0, z),
    )
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, material)


def import_blade(material: bpy.types.Material) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(REFERENCE_SVG))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if len(imported) != 1:
        raise RuntimeError(f"Expected one compound sickle path, found {len(imported)}")
    blade = imported[0]
    blade.name = "TKA_Sickles_Blade"
    blade.data.dimensions = "2D"
    blade.data.fill_mode = "BOTH"
    blade.data.resolution_u = 6
    activate(blade)
    bpy.ops.object.convert(target="MESH")

    minimum = Vector(
        (
            min(vertex.co.x for vertex in blade.data.vertices),
            min(vertex.co.y for vertex in blade.data.vertices),
            0.0,
        )
    )
    maximum = Vector(
        (
            max(vertex.co.x for vertex in blade.data.vertices),
            max(vertex.co.y for vertex in blade.data.vertices),
            0.0,
        )
    )
    source_width = maximum.x - minimum.x
    source_height = maximum.y - minimum.y
    if source_width <= 0 or source_height <= 0:
        raise RuntimeError("Sickle blade SVG has no measurable area")

    for vertex in blade.data.vertices:
        source_x = (vertex.co.x - minimum.x) / source_width
        source_y = (vertex.co.y - minimum.y) / source_height
        vertex.co = Vector(
            (
                source_x * AUTHORED_WIDTH_M,
                0.0,
                0.065 + source_y * BLADE_HEIGHT_M,
            )
        )

    blade.data.materials.clear()
    blade.data.materials.append(material)
    solidify = blade.modifiers.new("Competition blade thickness", "SOLIDIFY")
    solidify.thickness = BLADE_DEPTH_M
    solidify.offset = 0.0
    apply_modifier(blade, solidify.name)
    bevel = blade.modifiers.new("Rounded polished blade edge", "BEVEL")
    bevel.width = EDGE_RADIUS_M
    bevel.segments = 5
    apply_modifier(blade, bevel.name)
    triangulate = blade.modifiers.new("Stable glTF tessellation", "TRIANGULATE")
    triangulate.quad_method = "BEAUTY"
    triangulate.ngon_method = "BEAUTY"
    apply_modifier(blade, triangulate.name)
    for polygon in blade.data.polygons:
        polygon.use_smooth = abs(polygon.normal.y) < 0.94
    smart_uv(blade)
    return blade


def bezier_spine(
    material: bpy.types.Material,
    side: float,
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(f"TKA_Sickles_BladeSpine_{side:+.0f}", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 16
    curve_data.bevel_depth = 0.00145
    curve_data.bevel_resolution = 4
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(3)
    points = (
        ((0.002, 0.169), "AUTO"),
        ((0.064, 0.171), "AUTO"),
        ((0.132, 0.149), "AUTO"),
        ((0.190, 0.073), "AUTO"),
    )
    for point, ((x, z), handle_type) in zip(spline.bezier_points, points):
        point.co = (x, side * (BLADE_DEPTH_M * 0.5 + 0.00055), z)
        point.handle_left_type = handle_type
        point.handle_right_type = handle_type
    obj = bpy.data.objects.new(
        f"TKA_Sickles_BladeSpine_Recolor_{'Front' if side < 0 else 'Back'}",
        curve_data,
    )
    bpy.context.collection.objects.link(obj)
    curve_data.materials.append(material)
    activate(obj)
    bpy.ops.object.convert(target="MESH")
    return finish_mesh(obj, material)


def yin_yang_divider(
    material: bpy.types.Material,
    side: float,
) -> bpy.types.Object:
    """The real blade's circular window keeps a slim S-shaped bridge."""
    curve_data = bpy.data.curves.new(f"TKA_Sickles_YinYang_{side:+.0f}", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 12
    curve_data.bevel_depth = 0.0040
    curve_data.bevel_resolution = 4
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(3)
    points = (
        (0.095, 0.147),
        (0.077, 0.132),
        (0.113, 0.110),
        (0.095, 0.096),
    )
    for point, (x, z) in zip(spline.bezier_points, points):
        point.co = (x, side * (BLADE_DEPTH_M * 0.5 + 0.00045), z)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(
        f"TKA_Sickles_YinYangBridge_{'Front' if side < 0 else 'Back'}",
        curve_data,
    )
    bpy.context.collection.objects.link(obj)
    curve_data.materials.append(material)
    activate(obj)
    bpy.ops.object.convert(target="MESH")
    return finish_mesh(obj, material)


def bolt(
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48,
        radius=0.0092,
        depth=0.013,
        location=(0.019, 0.0, 0.147),
        rotation=(math.pi / 2, 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = "TKA_Sickles_BladePivotBolt"
    return finish_mesh(obj, material, bevel=0.0007)


def build_prop() -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    recolor = make_material(
        "TKA_Sickles_Recolor",
        (0.78, 0.025, 0.035, 1.0),
        roughness=0.30,
        metallic=0.18,
        coat=0.22,
    )
    blade_material = make_material(
        "TKA_Sickles_Blade_Silver",
        (0.72, 0.76, 0.82, 1.0),
        roughness=0.20,
        metallic=0.86,
        coat=0.15,
    )
    chrome = make_material(
        "TKA_Sickles_Chrome",
        (0.42, 0.46, 0.52, 1.0),
        roughness=0.14,
        metallic=0.95,
    )
    grip_material = make_material(
        "TKA_Sickles_Grip",
        (0.012, 0.014, 0.018, 1.0),
        roughness=0.72,
        coat=0.04,
    )
    grip_ridge = make_material(
        "TKA_Sickles_Grip_Ridge",
        (0.045, 0.050, 0.060, 1.0),
        roughness=0.58,
    )

    root = bpy.data.objects.new("TKA_Sickles", None)
    bpy.context.collection.objects.link(root)
    root["tka_prop_type"] = "sickles"
    root["published_dimensions_m"] = "0.36 x 0.19 x 0.04"
    root["grip_origin"] = "lower wrapped handle at runtime 0,0,0"
    root["physical_grip_z_m"] = GRIP_PIVOT_Z_M
    root["local_primary_axis"] = "+Y"
    root["tracked_tip_runtime"] = "blade apex"
    root["recolor_material"] = "TKA_Sickles_Recolor"
    root["tka_recolor_mode"] = "palette-main"
    root["canonical_source"] = "Century Competition Kama Fire and Ice"
    root["reference_trace"] = "scripts/assets/sickles-blade-reference.svg"

    pivot = bpy.data.objects.new("TKA_Hand_Pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot["tka_grip"] = True

    kinetic_axis = bpy.data.objects.new("TKA_Sickles_KineticAxis", None)
    bpy.context.collection.objects.link(kinetic_axis)
    kinetic_axis.rotation_euler[1] = KINETIC_AXIS_ROTATION_Y
    kinetic_axis["tracked_tip_reach_m"] = TRACKED_TIP_REACH_M
    kinetic_axis["alignment"] = "blade apex to runtime +Y"
    kinetic_axis.parent = root
    pivot.parent = root

    objects: list[bpy.types.Object] = [pivot, kinetic_axis]
    objects.append(cylinder("TKA_Sickles_Grip", HANDLE_RADIUS_M, 0.105, -0.125, grip_material))
    objects.append(cylinder("TKA_Sickles_LowerShell_Recolor", 0.0137, 0.012, -0.174, recolor))
    objects.append(cylinder("TKA_Sickles_UpperShell_Recolor", 0.0137, 0.214, 0.040, recolor))
    objects.append(cylinder("TKA_Sickles_ButtCap", 0.0152, 0.010, -0.175, chrome))
    objects.append(cylinder("TKA_Sickles_BladeCollar", 0.0152, 0.013, 0.1585, chrome))
    for index, z in enumerate((-0.168, -0.068, 0.150)):
        objects.append(torus_ring(f"TKA_Sickles_ChromeCollar_{index}", z, 0.0135, 0.0017, chrome))
    for index, z in enumerate((-0.158, -0.141, -0.124, -0.107, -0.090, -0.073)):
        objects.append(torus_ring(f"TKA_Sickles_GripWrap_{index}", z, 0.0122, 0.00075, grip_ridge))
    objects.append(import_blade(blade_material))
    objects.append(bezier_spine(recolor, -1.0))
    objects.append(bezier_spine(recolor, 1.0))
    objects.append(yin_yang_divider(blade_material, -1.0))
    objects.append(yin_yang_divider(blade_material, 1.0))
    objects.append(bolt(chrome))

    for obj in objects:
        if obj not in (pivot, kinetic_axis):
            # The original trace is measured from the handle's midpoint. Moving
            # every physical part together keeps that manufactured shape intact
            # while putting the performer's hand at the useful end of it.
            obj.location.z -= GRIP_PIVOT_Z_M
            obj.parent = kinetic_axis
    return root, objects


def export_glb(output_path: Path, root: bpy.types.Object, objects: list[bpy.types.Object]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in objects:
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
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_proofs(render_dir: Path) -> None:
    render_dir.mkdir(parents=True, exist_ok=True)
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.004, 0.006, 0.012, 1.0)
    background.inputs["Strength"].default_value = 0.20
    for name, location, energy, size, color in (
        ("QA_Key", (-0.48, -0.72, 0.55), 130, 0.55, (1.00, 0.82, 0.68)),
        ("QA_Fill", (0.58, -0.22, 0.20), 84, 0.48, (0.34, 0.62, 1.00)),
        ("QA_Rim", (0.08, 0.58, -0.28), 96, 0.42, (1.00, 0.18, 0.12)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, Vector((-0.06, 0.0, 0.015)))
    bpy.ops.object.camera_add(location=(-0.06, -1.15, 0.015))
    camera = bpy.context.object
    camera.data.lens = 68
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    views = {
        "front": (-0.06, -1.15, 0.015),
        "three-quarter": (0.54, -0.98, 0.22),
        "profile": (0.92, -0.05, 0.015),
        "grip": (-0.02, -0.55, -0.035),
    }
    for label, location in views.items():
        camera.location = location
        camera.data.lens = 56 if label != "grip" else 72
        point_at(camera, Vector((-0.06, 0.0, 0.015)))
        scene.render.filepath = str(render_dir / f"sickles-{label}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    reset_scene()
    root, objects = build_prop()
    export_glb(args.output.resolve(), root, objects)
    if args.blend:
        args.blend.resolve().parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    if args.render_dir:
        render_proofs(args.render_dir.resolve())
    meshes = [obj for obj in objects if obj.type == "MESH"]
    print(f"SICKLES_OUTPUT={args.output.resolve()}")
    print(f"SICKLES_BYTES={args.output.resolve().stat().st_size}")
    print(f"SICKLES_MESHES={len(meshes)}")
    print(f"SICKLES_VERTICES={sum(len(obj.data.vertices) for obj in meshes)}")
    print(f"SICKLES_POLYGONS={sum(len(obj.data.polygons) for obj in meshes)}")
    print(f"SICKLES_DIMENSIONS_M={AUTHORED_HEIGHT_M}x{AUTHORED_WIDTH_M}x{AUTHORED_DEPTH_M}")
    print(f"SICKLES_TRACKED_TIP_REACH_M={TRACKED_TIP_REACH_M}")
    print("SICKLES_HAND_PIVOT=0,0,0")


if __name__ == "__main__":
    main()
