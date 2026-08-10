"""Build the Olive Cloudbreak Gate 2 graybox from the approved coordinate manifest."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SPEC_DIR = PROJECT_ROOT / "docs" / "superpowers" / "specs" / "seraphic-vault"
REVISION = "olive-cloudbreak-r2"
REVISION_SUFFIX = "r2"
MANIFEST_PATH = SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-coordinate-manifest.json"
OUTPUT_BLEND = PROJECT_ROOT / "blender" / f"olive_cloudbreak_graybox_{REVISION_SUFFIX}.blend"
OUTPUT_GLB = (
    PROJECT_ROOT
    / "static"
    / "models"
    / "celestial"
    / "review"
    / f"olive-cloudbreak-graybox-{REVISION_SUFFIX}.glb"
)
RENDER_PATHS = {
    "desktop": SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-desktop.png",
    "portrait": SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-portrait.png",
    "landscapePhone": SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-landscape-phone.png",
    "overview": SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-overview.png",
    "profile": SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-profile.png",
}


def load_manifest() -> dict:
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def create_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.78,
    metallic: float = 0.0,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    if emission:
        emission.default_value = color
    emission_strength_input = bsdf.inputs.get("Emission Strength")
    if emission_strength_input:
        emission_strength_input.default_value = emission_strength
    return material


def tag(obj: bpy.types.Object, role: str, element_id: str | None = None) -> None:
    obj["tka_scene"] = "seraphic-vault"
    obj["tka_revision"] = REVISION
    obj["tka_gate"] = 2
    obj["tka_role"] = role
    if element_id:
        obj["tka_element"] = element_id


def bevel(obj: bpy.types.Object, width: float = 0.16) -> None:
    modifier = obj.modifiers.new("Cloudbreak softened edge", "BEVEL")
    modifier.width = width
    modifier.segments = 3
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    except RuntimeError:
        pass
    try:
        bpy.ops.object.shade_smooth_by_angle()
    except RuntimeError:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def create_extruded_polygon(
    name: str,
    outline_xy: list[list[float]],
    top_z: float,
    thickness: float,
    material: bpy.types.Material,
    role: str,
    element_id: str | None = None,
) -> bpy.types.Object:
    count = len(outline_xy)
    bottom_z = top_z - thickness
    vertices = [(x, y, top_z) for x, y in outline_xy]
    vertices.extend((x, y, bottom_z) for x, y in outline_xy)
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    bevel(obj, min(0.28, thickness * 0.035))
    return obj


def add_cube(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    role: str,
    element_id: str | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    bevel(obj, min(dimensions) * 0.2)
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    role: str,
    vertices: int = 32,
    element_id: str | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    bevel(obj, min(0.18, depth * 0.15))
    return obj


def add_ico(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    role: str,
    subdivisions: int = 2,
    element_id: str | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=1.0,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    bpy.ops.object.shade_smooth()
    return obj


def add_cone(
    name: str,
    location: tuple[float, float, float],
    bottom_radius: float,
    top_radius: float,
    depth: float,
    material: bpy.types.Material,
    role: str,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=14,
        radius1=bottom_radius,
        radius2=top_radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    tag(obj, role)
    bevel(obj, 0.12)
    return obj


def add_irregular_mesa(
    name: str,
    center_x: float,
    center_y: float,
    base_z: float,
    top_z: float,
    width: float,
    material: bpy.types.Material,
    role: str,
    element_id: str | None = None,
) -> bpy.types.Object:
    rng = random.Random(f"olive-cloudbreak:{name}")
    segments = 12
    levels = [
        (base_z, width * 0.47, width * 0.02, -width * 0.03),
        (base_z + (top_z - base_z) * 0.22, width * 0.42, -width * 0.035, width * 0.015),
        (base_z + (top_z - base_z) * 0.58, width * 0.32, width * 0.025, -width * 0.018),
        (top_z, width * 0.41, -width * 0.018, width * 0.025),
    ]
    vertices = []
    for level_index, (z, radius, offset_x, offset_y) in enumerate(levels):
        for index in range(segments):
            angle = math.tau * index / segments
            variation = 1.0 + rng.uniform(-0.13, 0.1)
            vertices.append(
                (
                    center_x + offset_x + math.cos(angle) * radius * variation,
                    center_y + offset_y + math.sin(angle) * radius * variation,
                    z,
                )
            )
    faces = [tuple(reversed(range(segments)))]
    for level_index in range(len(levels) - 1):
        lower = level_index * segments
        upper = (level_index + 1) * segments
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append((lower + index, lower + next_index, upper + next_index, upper + index))
    top_start = (len(levels) - 1) * segments
    faces.append(tuple(top_start + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    bevel(obj, 0.16)
    return obj


def irregular_outline(
    center_x: float,
    center_y: float,
    width: float,
    seed: str,
    segments: int = 12,
) -> list[list[float]]:
    rng = random.Random(seed)
    return [
        [
            center_x
            + math.cos(math.tau * index / segments)
            * width
            * 0.5
            * (1.0 + rng.uniform(-0.1, 0.08)),
            center_y
            + math.sin(math.tau * index / segments)
            * width
            * 0.5
            * (1.0 + rng.uniform(-0.1, 0.08)),
        ]
        for index in range(segments)
    ]


def add_curve(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
    role: str,
    element_id: str | None = None,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    return obj


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_camera(
    name: str,
    position: tuple[float, float, float],
    target: tuple[float, float, float],
    fov_degrees: float,
) -> bpy.types.Object:
    camera_data = bpy.data.cameras.new(name)
    camera_data.sensor_fit = "VERTICAL"
    camera_data.angle_y = math.radians(fov_degrees)
    camera = bpy.data.objects.new(name, camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = position
    look_at(camera, target)
    camera["tka_scene"] = "seraphic-vault"
    camera["tka_revision"] = REVISION
    camera["tka_gate"] = 2
    camera["tka_role"] = "registered-camera"
    return camera


def render_camera(camera: bpy.types.Object, path: Path, size: tuple[int, int]) -> None:
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x = size[0]
    scene.render.resolution_y = size[1]
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def configure_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_mode = "RGBA"
    scene.world.color = (0.68, 0.79, 0.84)
    world = scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.58, 0.72, 0.8, 1.0)
    background.inputs["Strength"].default_value = 0.55
    scene.view_settings.look = "AgX - Medium High Contrast"


def add_lighting() -> None:
    sun_data = bpy.data.lights.new("Cloudbreak_SunLight", type="SUN")
    sun_data.energy = 2.1
    sun_data.color = (1.0, 0.78, 0.5)
    sun = bpy.data.objects.new("Cloudbreak_SunLight", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(34), math.radians(-18), math.radians(-22))

    area_data = bpy.data.lights.new("Cloudbreak_SkyFill", type="AREA")
    area_data.energy = 1300
    area_data.shape = "DISK"
    area_data.size = 45
    area_data.color = (0.72, 0.84, 1.0)
    area = bpy.data.objects.new("Cloudbreak_SkyFill", area_data)
    bpy.context.collection.objects.link(area)
    area.location = (0, 5, 42)
    look_at(area, (0, -10, 0))


def build_scene(manifest: dict) -> None:
    materials = {
        "landmass": create_material("GB_Limestone", (0.69, 0.58, 0.4, 1.0), 0.9),
        "terrace": create_material("GB_DryTerrace", (0.94, 0.82, 0.58, 1.0), 0.84),
        "lagoon": create_material("GB_Lagoon", (0.2, 0.58, 0.72, 1.0), 0.26, 0.08),
        "olive": create_material("GB_Olive", (0.23, 0.33, 0.16, 1.0), 0.92),
        "trunk": create_material("GB_OliveTrunk", (0.2, 0.12, 0.07, 1.0), 0.96),
        "mesa": create_material("GB_DistantMesa", (0.62, 0.54, 0.41, 1.0), 0.9),
        "waterfall": create_material("GB_Waterfall", (0.52, 0.82, 0.95, 1.0), 0.24, 0.0, 0.12),
        "cloud": create_material("GB_CloudOcean", (0.82, 0.87, 0.86, 1.0), 1.0),
        "sun": create_material("GB_FarSun", (1.0, 0.56, 0.12, 1.0), 0.25, 0.0, 4.5),
        "guide": create_material("GB_Guide", (1.0, 0.54, 0.08, 1.0), 0.65, 0.0, 0.35),
        "figure": create_material("GB_ScaleFigure", (0.08, 0.16, 0.18, 1.0), 0.88),
    }

    landmass = manifest["landmass"]
    create_extruded_polygon(
        "Cloudbreak_Landmass",
        landmass["outlineBlenderXY"],
        landmass["surfaceY"],
        landmass["minimumThickness"],
        materials["landmass"],
        "graybox-landmass",
        "landmass",
    )

    terrace = manifest["performanceTerrace"]
    center_x, center_y = -terrace["centerXZ"][0], terrace["centerXZ"][1]
    add_cylinder(
        "Cloudbreak_DryPerformance",
        (center_x, center_y, terrace["surfaceY"] + 0.08),
        terrace["clearRadius"],
        0.16,
        materials["terrace"],
        "graybox-performance-zone",
        64,
        "performance-terrace",
    )

    lagoon = manifest["lagoon"]
    create_extruded_polygon(
        "Cloudbreak_OneLagoon",
        lagoon["outlineBlenderXY"],
        lagoon["surfaceY"],
        0.1,
        materials["lagoon"],
        "graybox-lagoon",
        "lagoon",
    )
    overflow_x, overflow_y = lagoon["overflowBlenderXY"]
    add_curve(
        "Cloudbreak_LagoonOverflow",
        [
            (overflow_x, overflow_y, lagoon["surfaceY"]),
            (overflow_x + 0.25, overflow_y - 0.2, -2.8),
            (overflow_x + 0.55, overflow_y - 0.5, -8.5),
        ],
        0.18,
        materials["waterfall"],
        "graybox-lagoon-overflow",
        "lagoon",
    )

    for edge_x in (-manifest["approach"]["minimumWidth"] / 2, manifest["approach"]["minimumWidth"] / 2):
        add_cube(
            f"Cloudbreak_ApproachGuide_{'L' if edge_x < 0 else 'R'}",
            (edge_x, 29, 0.18),
            (0.12, 38, 0.1),
            materials["guide"],
            "graybox-approach-guide",
        )

    for tree in manifest["oliveTrees"]:
        x, y, surface_z = tree["blenderPosition"]
        trunk_height = tree["height"] * 0.56
        add_cylinder(
            f"Cloudbreak_{tree['id']}_Trunk",
            (x, y, surface_z + trunk_height / 2),
            0.42,
            trunk_height,
            materials["trunk"],
            "graybox-olive-trunk",
            16,
            tree["id"],
        )
        add_ico(
            f"Cloudbreak_{tree['id']}_Canopy",
            (x, y, surface_z + tree["height"] * 0.72),
            (2.25, 1.45, 1.1),
            materials["olive"],
            "graybox-olive-canopy",
            element_id=tree["id"],
        )

    for mesa in manifest["distantMesas"]:
        x, y, top_z = mesa["blenderPosition"]
        base_z = mesa["cloudBaseY"]
        add_irregular_mesa(
            f"Cloudbreak_Mesa_{mesa['id']}_Body",
            x,
            y,
            base_z,
            top_z,
            mesa["width"],
            materials["mesa"],
            "graybox-distant-mesa",
            mesa["id"],
        )
        create_extruded_polygon(
            f"Cloudbreak_Mesa_{mesa['id']}_Top",
            irregular_outline(
                x,
                y,
                mesa["width"],
                f"olive-cloudbreak-top:{mesa['id']}",
            ),
            top_z + 0.36,
            0.36,
            materials["terrace"],
            "graybox-distant-mesa-top",
            mesa["id"],
        )
        if mesa.get("waterfall"):
            add_curve(
                f"Cloudbreak_Mesa_{mesa['id']}_Fall",
                [
                    (x + mesa["width"] * 0.23, y, top_z + 0.18),
                    (x + mesa["width"] * 0.23, y - 0.12, base_z + 1.2),
                ],
                0.12,
                materials["waterfall"],
                "graybox-distant-waterfall",
                mesa["id"],
            )
        if mesa.get("tinyOlive"):
            add_cylinder(
                "Cloudbreak_DistantOlive_Trunk",
                (x, y, top_z + 0.7),
                0.13,
                1.4,
                materials["trunk"],
                "graybox-distant-olive",
                10,
                mesa["id"],
            )
            add_ico(
                "Cloudbreak_DistantOlive_Canopy",
                (x, y, top_z + 1.65),
                (0.8, 0.6, 0.45),
                materials["olive"],
                "graybox-distant-olive",
                1,
                mesa["id"],
            )

    cloud = manifest["cloudOcean"]
    add_cube(
        "Cloudbreak_CloudOcean",
        (0, -42, cloud["averageTopY"] - 0.9),
        (180, 190, 2.0),
        materials["cloud"],
        "graybox-cloud-ocean",
        "cloud-ocean",
    )
    for index, (x, y, scale) in enumerate(
        [(-38, -18, 9), (38, -24, 11), (-26, -72, 8), (28, -82, 10), (0, -95, 9)]
    ):
        add_ico(
            f"Cloudbreak_CloudBank_{index + 1}",
            (x, y, cloud["averageTopY"] + 0.5),
            (scale, scale * 0.42, scale * 0.28),
            materials["cloud"],
            "graybox-cloud-bank",
            2,
            f"cloud-bank-{index + 1}",
        )

    sun_position = tuple(manifest["sun"]["blenderPosition"])
    add_ico(
        "Cloudbreak_FarSun",
        sun_position,
        (manifest["sun"]["visualDiameter"] / 2,) * 3,
        materials["sun"],
        "graybox-far-sun",
        3,
        "far-sun",
    )

    figure = manifest["scaleFigure"]
    figure_x, figure_y, figure_z = figure["blenderPosition"]
    height = figure["height"]
    add_cylinder(
        "Cloudbreak_ScaleFigure_Body",
        (figure_x, figure_y, figure_z + height * 0.42),
        0.22,
        height * 0.75,
        materials["figure"],
        "graybox-scale-figure",
        12,
        "scale-figure",
    )
    add_ico(
        "Cloudbreak_ScaleFigure_Head",
        (figure_x, figure_y, figure_z + height * 0.89),
        (0.25, 0.25, 0.25),
        materials["figure"],
        "graybox-scale-figure",
        2,
        "scale-figure",
    )


def create_cameras(manifest: dict) -> dict[str, bpy.types.Object]:
    cameras = {}
    for name, preset in manifest["cameraPresets"].items():
        cameras[name] = add_camera(
            f"Cloudbreak_Camera_{name}",
            tuple(preset["blenderPosition"]),
            tuple(preset["blenderTarget"]),
            preset["fovDegrees"],
        )
    cameras["overview"] = add_camera(
        "Cloudbreak_Camera_overview",
        (0, 14, 86),
        (0, 12, -1),
        52,
    )
    cameras["profile"] = add_camera(
        "Cloudbreak_Camera_profile",
        (64, 18, 24),
        (0, -42, 1.5),
        56,
    )
    return cameras


def main() -> None:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(
            f"Coordinate manifest is missing: {MANIFEST_PATH}. Run the Gate 2 coordinate generator first."
        )
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    clean_scene()
    configure_scene()
    build_scene(manifest)
    add_lighting()
    cameras = create_cameras(manifest)
    bpy.context.view_layer.update()

    render_sizes = {
        "desktop": (1600, 900),
        "portrait": (675, 1200),
        "landscapePhone": (1600, 687),
        "overview": (1600, 900),
        "profile": (1600, 900),
    }
    for name, camera in cameras.items():
        render_camera(camera, RENDER_PATHS[name], render_sizes[name])

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_apply=True,
    )
    print(
        json.dumps(
            {
                "blend": str(OUTPUT_BLEND),
                "glb": str(OUTPUT_GLB),
                "renders": {name: str(path) for name, path in RENDER_PATHS.items()},
                "objects": len(bpy.data.objects),
            },
            indent=2,
        )
    )


main()
