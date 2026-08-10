"""Build the Gate 10 Moonlit Firefly Forest stage and review renders.

The asset keeps the canonical 0.55 m performer surface while replacing the
generic festival platform with one Forest-owned timber deck, earth-and-moss
contact apron, rooted retaining details, and an upstage woodland approach.

Outputs:
  blender/forest_stage.blend
  %TEMP%/tka-forest-evidence/forest_stage_qa_*.png
  %TEMP%/tka-forest-evidence/forest_stage_metrics.json
"""

import hashlib
import json
import math
import os

import bpy
from mathutils import Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LAYOUT_PATH = os.path.join(SCRIPT_DIR, "forest-stage-layout.json")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "forest_stage.blend")
QA_DIR = os.path.join(os.environ.get("TEMP", PROJECT_ROOT), "tka-forest-evidence")
QA_PATHS = {
    "hero": os.path.join(QA_DIR, "forest_stage_qa_hero.png"),
    "contact": os.path.join(QA_DIR, "forest_stage_qa_contact.png"),
    "plan": os.path.join(QA_DIR, "forest_stage_qa_plan.png"),
}
METRICS_PATH = os.path.join(QA_DIR, "forest_stage_metrics.json")


with open(LAYOUT_PATH, "rb") as handle:
    layout_bytes = handle.read()
LAYOUT = json.loads(layout_bytes.decode("utf8"))
LAYOUT_SHA256 = hashlib.sha256(layout_bytes).hexdigest()


def resolve_project_path(relative_path):
    return os.path.join(PROJECT_ROOT, relative_path.replace("/", os.sep))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def load_image(relative_path, color_space):
    path = resolve_project_path(relative_path)
    if not os.path.exists(path):
        raise RuntimeError(f"Missing Forest stage texture: {path}")
    image = bpy.data.images.load(path, check_existing=True)
    image.colorspace_settings.name = color_space
    return image


def textured_material(name, definition, normal_strength=0.6):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (0.35, 0.28, 0.2, 1)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (720, 0)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (420, 0)
    principled.inputs["Roughness"].default_value = 0.88
    principled.inputs["Metallic"].default_value = 0.0
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    diffuse = nodes.new("ShaderNodeTexImage")
    diffuse.name = f"{name}_Diffuse"
    diffuse.image = load_image(definition["diffuse"], "sRGB")
    diffuse.location = (-520, 140)
    links.new(diffuse.outputs["Color"], principled.inputs["Base Color"])

    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = f"{name}_Normal"
    normal_texture.image = load_image(definition["normal"], "Non-Color")
    normal_texture.location = (-520, -80)
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = normal_strength
    normal.location = (-120, -80)
    links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], principled.inputs["Normal"])

    roughness = nodes.new("ShaderNodeTexImage")
    roughness.name = f"{name}_Roughness"
    roughness.image = load_image(definition["roughness"], "Non-Color")
    roughness.location = (-520, -300)
    links.new(roughness.outputs["Color"], principled.inputs["Roughness"])
    return material


def color_material(name, color, roughness=0.9, emissive=None, emissive_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    rgba = (*color, 1.0)
    principled.inputs["Base Color"].default_value = rgba
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = 0.0
    if emissive is not None:
        emission_input = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
        if emission_input is not None:
            emission_input.default_value = (*emissive, 1.0)
        strength_input = principled.inputs.get("Emission Strength")
        if strength_input is not None:
            strength_input.default_value = emissive_strength
    material.diffuse_color = rgba
    return material


def mark_stage_object(obj, role, authored_id):
    obj["tka_export_layer"] = "forest-stage"
    obj["tka_role"] = role
    obj["tka_stage_id"] = authored_id
    obj["tka_stage_layout_version"] = int(LAYOUT["version"])
    obj["tka_stage_layout_sha256"] = LAYOUT_SHA256


def assign_uvs(mesh, repeat_metres):
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if abs(polygon.normal.z) > 0.7:
                uv_layer.data[loop_index].uv = (vertex.x / repeat_metres, vertex.y / repeat_metres)
            elif abs(polygon.normal.x) > abs(polygon.normal.y):
                uv_layer.data[loop_index].uv = (vertex.y / repeat_metres, vertex.z / repeat_metres)
            else:
                uv_layer.data[loop_index].uv = (vertex.x / repeat_metres, vertex.z / repeat_metres)


def extruded_polygon(name, points, bottom_z, top_z, top_material, side_material, role, authored_id, repeat_metres):
    count = len(points)
    vertices = [(x, y, bottom_z) for x, y in points] + [(x, y, top_z) for x, y in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(top_material)
    obj.data.materials.append(side_material)
    for polygon in mesh.polygons:
        polygon.material_index = 0 if polygon.index == 1 else 1
    assign_uvs(mesh, repeat_metres)
    mark_stage_object(obj, role, authored_id)
    return obj


def contact_apron(name, inner_points, outer_points, material):
    count = len(inner_points)
    if len(outer_points) != count:
        raise RuntimeError("Forest stage deck and apron outlines need matching point counts")
    vertices = [(x, y, 0.004) for x, y in outer_points]
    vertices += [(x, y, 0.18) for x, y in inner_points]
    faces = []
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    assign_uvs(mesh, LAYOUT["materials"]["contact"]["realWorldRepeatMetres"])
    mark_stage_object(obj, "stage-ground-contact", "forest-stage-contact-apron")
    return obj


def add_box(name, center, dimensions, material, role, authored_id, bevel_width=0.025):
    bpy.ops.mesh.primitive_cube_add(location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel_width > 0:
        bevel = obj.modifiers.new("Weathered edges", "BEVEL")
        bevel.width = bevel_width
        bevel.segments = 2
    obj.data.materials.append(material)
    mark_stage_object(obj, role, authored_id)
    return obj


def add_flat_polygon(name, points, bottom_z, top_z, material, role, authored_id, repeat_metres=1.0):
    return extruded_polygon(
        name,
        points,
        bottom_z,
        top_z,
        material,
        material,
        role,
        authored_id,
        repeat_metres,
    )


def add_disc(name, center, radius, height, material, role, authored_id, vertices=28):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=(center[0], center[1], center[2]),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    mark_stage_object(obj, role, authored_id)
    return obj


def hex_to_rgb(value):
    value = value.lstrip("#")
    srgb = tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))
    return tuple(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in srgb)


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_qa_scene(contact_material):
    bpy.ops.mesh.primitive_plane_add(size=26, location=(0, 0, -0.012))
    floor = bpy.context.object
    floor.name = "QA_ForestFloor"
    floor.data.materials.append(contact_material)

    world = bpy.context.scene.world or bpy.data.worlds.new("ForestStageWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.028, 0.024, 1)
    background.inputs["Strength"].default_value = 0.28

    bpy.ops.object.light_add(type="AREA", location=(4.5, -6.0, 8.5))
    key = bpy.context.object
    key.name = "QA_Key"
    key.data.energy = 1200
    key.data.color = (0.78, 0.9, 0.82)
    key.data.shape = "DISK"
    key.data.size = 5.5
    look_at(key, (0, 0, 0.5))

    bpy.ops.object.light_add(type="AREA", location=(-5.0, 2.0, 4.5))
    fill = bpy.context.object
    fill.name = "QA_Fill"
    fill.data.energy = 750
    fill.data.color = (0.35, 0.52, 0.42)
    fill.data.size = 4.0
    look_at(fill, (0, 0, 0.3))

    bpy.ops.object.light_add(type="POINT", location=(0, -4.8, 2.4))
    edge = bpy.context.object
    edge.name = "QA_WarmEdge"
    edge.data.energy = 220
    edge.data.color = (1.0, 0.48, 0.18)
    edge.data.shadow_soft_size = 1.2


def render_view(name, position, target, lens):
    bpy.ops.object.camera_add(location=position)
    camera = bpy.context.object
    camera.name = f"QA_Camera_{name}"
    camera.data.lens = lens
    look_at(camera, target)
    bpy.context.scene.camera = camera
    bpy.context.scene.render.filepath = QA_PATHS[name]
    bpy.ops.render.render(write_still=True)


def polygon_area(points):
    return abs(sum(
        points[index][0] * points[(index + 1) % len(points)][1]
        - points[(index + 1) % len(points)][0] * points[index][1]
        for index in range(len(points))
    )) / 2


def build():
    clear_scene()
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    os.makedirs(QA_DIR, exist_ok=True)

    dimensions = LAYOUT["baseDimensions"]
    deck_points = LAYOUT["deckOutline"]
    apron_points = LAYOUT["contactApronOutline"]
    wood = textured_material("ForestStage_WeatheredTimber", LAYOUT["materials"]["deck"], 0.72)
    contact = textured_material("ForestStage_ForestContact", LAYOUT["materials"]["contact"], 0.48)
    plinth = textured_material("ForestStage_StonePlinth", LAYOUT["materials"]["plinth"], 0.66)
    fascia = color_material("ForestStage_DarkTimberFascia", (0.13, 0.085, 0.045), 0.94)

    plinth_points = [[x * 0.965, y * 0.965] for x, y in deck_points]
    extruded_polygon(
        "ForestStage_Platform",
        deck_points,
        dimensions["plinthTopHeightMetres"],
        dimensions["deckTopHeightMetres"],
        wood,
        fascia,
        "stage-deck",
        "forest-stage-deck",
        LAYOUT["materials"]["deck"]["realWorldRepeatMetres"],
    )
    extruded_polygon(
        "ForestStage_Plinth",
        plinth_points,
        -0.04,
        dimensions["plinthTopHeightMetres"],
        plinth,
        plinth,
        "stage-plinth",
        "forest-stage-plinth",
        2.0,
    )
    contact_apron("ForestStage_ContactApron", plinth_points, apron_points, contact)

    for step in LAYOUT["approachSteps"]:
        add_box(
            f"ForestStageStep_{step['id']}",
            (step["center"][0], step["center"][1], step["topHeightMetres"] / 2),
            (step["widthMetres"], step["depthMetres"], step["topHeightMetres"]),
            wood,
            "stage-approach",
            step["id"],
            0.035,
        )

    cues = LAYOUT["directionCues"]
    cue_z = dimensions["deckTopHeightMetres"] + 0.009
    amber = color_material(
        "ForestStage_DownstageAmber",
        hex_to_rgb(cues["downstage"]["color"]),
        0.58,
        hex_to_rgb(cues["downstage"]["color"]),
        0.18,
    )
    blue = color_material(
        "ForestStage_UpstageBlue",
        hex_to_rgb(cues["upstage"]["color"]),
        0.66,
        hex_to_rgb(cues["upstage"]["color"]),
        0.1,
    )
    right = color_material("ForestStage_RightCue", hex_to_rgb(cues["performerRight"]["color"]), 0.7)
    left = color_material("ForestStage_LeftCue", hex_to_rgb(cues["performerLeft"]["color"]), 0.72)

    add_box(
        "ForestStageCue_DownstageLine",
        (0, cues["downstage"]["lineCenterY"], cue_z),
        (4.7, 0.045, 0.018),
        amber,
        "stage-direction-cue",
        "downstage-line",
        0.008,
    )
    triangle_center = cues["downstage"]["triangleCenter"]
    radius = cues["downstage"]["triangleRadiusMetres"]
    triangle_points = [
        [triangle_center[0] + math.cos(-math.pi / 2 + index * math.tau / 3) * radius,
         triangle_center[1] + math.sin(-math.pi / 2 + index * math.tau / 3) * radius]
        for index in range(3)
    ]
    add_flat_polygon(
        "ForestStageCue_DownstageTriangle",
        triangle_points,
        cue_z,
        cue_z + 0.012,
        amber,
        "stage-direction-cue",
        "downstage-triangle",
    )
    add_box(
        "ForestStageCue_UpstageLine",
        (0, cues["upstage"]["lineCenterY"], cue_z),
        (4.45, 0.04, 0.015),
        blue,
        "stage-direction-cue",
        "upstage-line",
        0.007,
    )
    add_disc(
        "ForestStageCue_Right",
        (*cues["performerRight"]["center"], cue_z),
        0.13,
        0.016,
        right,
        "stage-direction-cue",
        "performer-right",
    )
    add_disc(
        "ForestStageCue_Left",
        (*cues["performerLeft"]["center"], cue_z),
        0.13,
        0.016,
        left,
        "stage-direction-cue",
        "performer-left",
    )

    deck_width = max(x for x, _ in deck_points) - min(x for x, _ in deck_points)
    deck_depth = max(y for _, y in deck_points) - min(y for _, y in deck_points)
    maximum_contact_radius = max(math.hypot(x, y) for x, y in apron_points)
    campfire_x, campfire_z = LAYOUT["rules"]["campfireCenterRuntime"]
    campfire_edge_distance = min(
        math.hypot(campfire_x - x, campfire_z - (-y)) for x, y in apron_points
    )
    minimum_contact_core_radius = min(math.hypot(x, y) for x, y in plinth_points)
    metrics = {
        "layoutVersion": LAYOUT["version"],
        "layoutSha256": LAYOUT_SHA256,
        "deckWidthMetres": deck_width,
        "deckDepthMetres": deck_depth,
        "deckTopHeightMetres": dimensions["deckTopHeightMetres"],
        "deckAreaSquareMetres": polygon_area(deck_points),
        "maximumContactRadiusMetres": maximum_contact_radius,
        "minimumCampfireEdgeDistanceMetres": campfire_edge_distance,
        "minimumContactCoreRadiusMetres": minimum_contact_core_radius,
        "approachStepCount": len(LAYOUT["approachSteps"]),
        "rootButtressCount": len(LAYOUT["rootButtresses"]),
        "mossPatchCount": len(LAYOUT["mossPatches"]),
    }
    with open(METRICS_PATH, "w", encoding="utf8") as handle:
        json.dump(metrics, handle, indent=2)

    add_qa_scene(contact)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 850
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"

    render_view("hero", (7.8, -10.8, 5.2), (0, 0, 0.45), 50)
    render_view("contact", (-7.2, -7.6, 2.3), (-1.6, -0.6, 0.22), 56)
    render_view("plan", (0, 0, 13.5), (0, 0, 0), 54)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(json.dumps(metrics, indent=2))
    print(f"Saved Forest stage: {BLEND_PATH}")
    for qa_path in QA_PATHS.values():
        print(f"Saved QA render: {qa_path}")


build()
