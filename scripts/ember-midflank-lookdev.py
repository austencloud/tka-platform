"""R5 material study, invoked by build-ember-lookdev-matrix.py --midflank-r5.

Loads the approved Blender file verbatim. Only shaders, lighting and atmosphere
change; source mesh coordinates, topology, transforms and cameras are checked.
"""
from __future__ import annotations

from array import array
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "docs/superpowers/specs/ember-spatial-directions"
OUT = SPEC / "evidence/gate-3-midflank-r5"
SOURCE = ROOT / "blender/ember-midflank-fire-pilgrimage-graybox-r5.blend"
BLEND = ROOT / "blender/ember-midflank-fire-pilgrimage-visual-target-r5.blend"
LOCK = SPEC / "evidence/gate-2-geology-graybox-r5/ember-midflank-fire-pilgrimage-r5-coordinate-manifest.json"
HEIGHT = ROOT / "static/textures/ember-surface-r11/rock-ground-height.jpg"
REPORT = OUT / "registered-target-report.json"
PREVIEW = "--preview" in sys.argv
VERIFY = "--verify" in sys.argv
CAMERAS = ["default-audience"] + [f"orbit-{a:03}" for a in range(0, 360, 45)] + ["midflank-oblique", "director-overview"]


def relative(path):
    return path.relative_to(ROOT).as_posix()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def geometry_snapshot(scene):
    result = {}
    for obj in scene.objects:
        if obj.type != "MESH" or obj.name.startswith("LD_"):
            continue
        positions = array("f", [0]) * (len(obj.data.vertices) * 3)
        indices = array("i", [0]) * len(obj.data.loops)
        starts = array("i", [0]) * len(obj.data.polygons)
        totals = array("i", [0]) * len(obj.data.polygons)
        obj.data.vertices.foreach_get("co", positions)
        obj.data.loops.foreach_get("vertex_index", indices)
        obj.data.polygons.foreach_get("loop_start", starts)
        obj.data.polygons.foreach_get("loop_total", totals)
        result[obj.name] = {
            "vertices": len(obj.data.vertices), "faces": len(obj.data.polygons),
            "geometrySha256": hashlib.sha256(positions.tobytes() + indices.tobytes() + starts.tobytes() + totals.tobytes()).hexdigest(),
            "matrixWorld": [list(row) for row in obj.matrix_world],
            "collision": bool(obj.get("tka_camera_collision", False)),
            "hidden": obj.hide_render,
            "modifiers": [(mod.name, mod.type) for mod in obj.modifiers],
        }
    return result


def camera_snapshot():
    result = {}
    for name in CAMERAS:
        obj = bpy.data.objects[f"EMBER_Camera_{name}"]
        result[name] = {
            "matrixWorld": [list(row) for row in obj.matrix_world],
            "type": obj.data.type, "lens": obj.data.lens,
            "sensorWidth": obj.data.sensor_width, "sensorHeight": obj.data.sensor_height,
            "sensorFit": obj.data.sensor_fit, "shift": [obj.data.shift_x, obj.data.shift_y],
            "clip": [obj.data.clip_start, obj.data.clip_end],
        }
    return result


def color(value):
    channels = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + .055) / 1.055) ** 2.4 for c in channels) + (1,)


def node(tree, kind, name, **inputs):
    item = tree.nodes.new(kind)
    item.label = name
    item.name = name
    for key, value in inputs.items():
        item.inputs[key].default_value = value
    return item


def wire(tree, source, target):
    tree.links.new(source, target)


def math_node(tree, operation, a, b):
    item = node(tree, "ShaderNodeMath", operation)
    item.operation = operation
    for index, value in enumerate((a, b)):
        if isinstance(value, (int, float)):
            item.inputs[index].default_value = value
        else:
            wire(tree, value, item.inputs[index])
    return item.outputs[0]


def ramp(tree, source, stops, name):
    item = node(tree, "ShaderNodeValToRGB", name)
    elements = item.color_ramp.elements
    elements.remove(elements[1])
    for index, (position, rgba) in enumerate(stops):
        element = elements[0] if index == 0 else elements.new(position)
        element.position = position
        element.color = rgba
    wire(tree, source, item.inputs["Fac"])
    return item.outputs["Color"]


def noise(tree, vector, scale, detail=4):
    item = node(tree, "ShaderNodeTexNoise", f"Noise {scale} per metre", Scale=scale, Detail=detail, Roughness=.72)
    wire(tree, vector, item.inputs["Vector"])
    return item


def new_material(name):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = node(tree, "ShaderNodeOutputMaterial", "Surface output")
    bsdf = node(tree, "ShaderNodeBsdfPrincipled", "Dielectric volcanic rock", Roughness=.86, Metallic=0)
    wire(tree, bsdf.outputs[0], output.inputs["Surface"])
    geo = node(tree, "ShaderNodeNewGeometry", "Metre scale position")
    return material, tree, bsdf, geo.outputs["Position"]


def fracture_field(tree, position, scale):
    distort = noise(tree, position, .42, 3)
    mult = node(tree, "ShaderNodeVectorMath", "Warp magnitude")
    mult.operation = "SCALE"
    mult.inputs["Scale"].default_value = .85
    wire(tree, distort.outputs["Color"], mult.inputs[0])
    add = node(tree, "ShaderNodeVectorMath", "Warped metre space")
    add.operation = "ADD"
    wire(tree, position, add.inputs[0])
    wire(tree, mult.outputs[0], add.inputs[1])
    vor = node(tree, "ShaderNodeTexVoronoi", "Irregular cooling fracture", Scale=scale)
    vor.feature = "DISTANCE_TO_EDGE"
    wire(tree, add.outputs[0], vor.inputs["Vector"])
    return vor.outputs["Distance"]


def rock_material(name, dark, light, roughness, bump_distance, older=False):
    material, tree, bsdf, position = new_material(name)
    bsdf.inputs["Roughness"].default_value = roughness
    macro = noise(tree, position, .18, 5)
    base_color = ramp(tree, macro.outputs["Fac"], [(.22, color(dark)), (.8, color(light))], "Weathered basalt value")
    tex = node(tree, "ShaderNodeTexImage", "Poly Haven rock ground / CC0")
    tex.image = bpy.data.images.load(str(HEIGHT), check_existing=True)
    tex.image.colorspace_settings.name = "Non-Color"
    tex.projection = "BOX"
    tex.projection_blend = .35
    mapping = node(tree, "ShaderNodeVectorMath", "3 metre scan repeat")
    mapping.operation = "SCALE"
    mapping.inputs["Scale"].default_value = 1 / 3
    wire(tree, position, mapping.inputs[0])
    wire(tree, mapping.outputs[0], tex.inputs["Vector"])
    scan_value = ramp(tree, tex.outputs["Color"], [(.15, (.32,.32,.32,1)), (.8, (1,1,1,1))], "Scan value breakup")
    tint = node(tree, "ShaderNodeMixRGB", "Basalt tint times scan")
    tint.blend_type = "MULTIPLY"
    tint.inputs[0].default_value = .8
    wire(tree, base_color, tint.inputs[1])
    wire(tree, scan_value, tint.inputs[2])
    wire(tree, tint.outputs[0], bsdf.inputs["Base Color"])
    detail = node(tree, "ShaderNodeBump", "Scan surface relief", Strength=.58, Distance=bump_distance)
    wire(tree, tex.outputs["Color"], detail.inputs["Height"])
    cracks = fracture_field(tree, position, .74)
    relief = ramp(tree, cracks, [(0, (0,0,0,1)), (.04, (.6,.6,.6,1)), (.14, (1,1,1,1))], "Shallow cold fractures")
    bump = node(tree, "ShaderNodeBump", "Old flow fractures", Strength=.16 if older else .055, Distance=.07)
    wire(tree, relief, bump.inputs["Height"])
    wire(tree, detail.outputs["Normal"], bump.inputs["Normal"])
    wire(tree, bump.outputs["Normal"], bsdf.inputs["Normal"])
    if older:
        sep = node(tree, "ShaderNodeSeparateXYZ", "Position for peripheral fracture mask")
        wire(tree, position, sep.inputs[0])
        # Same geological cracks in both variants. Heat is confined to the lava-facing
        # outer contact, never the action envelope (the latter is centred at x=0).
        west = math_node(tree, "LESS_THAN", sep.outputs["X"], -6)
        near = math_node(tree, "GREATER_THAN", sep.outputs["Y"], -6)
        far = math_node(tree, "LESS_THAN", sep.outputs["Y"], 8)
        thin = math_node(tree, "LESS_THAN", cracks, .019)
        speckle = math_node(tree, "GREATER_THAN", noise(tree, position, 1.1, 2).outputs["Fac"], .63)
        mask = thin
        for value in (west, near, far, speckle):
            mask = math_node(tree, "MULTIPLY", mask, value)
        strength = node(tree, "ShaderNodeValue", "Optional ember peak (invention)")
        strength.outputs[0].default_value = 0
        wire(tree, math_node(tree, "MULTIPLY", mask, strength.outputs[0]), bsdf.inputs["Emission Strength"])
        bsdf.inputs["Emission Color"].default_value = (1, .06, .002, 1)
    return material


def lava_material():
    material, tree, bsdf, position = new_material("LD_R5_CrustWithExposedInterior")
    cracks = fracture_field(tree, position, .62)
    exposure = ramp(tree, cracks, [(0, (1,1,1,1)), (.004, (.7,.7,.7,1)), (.023, (0,0,0,1))], "Thin exposed joints")
    # A second scale opens occasional irregular breakout patches.
    broad = noise(tree, position, .65, 4)
    window = ramp(tree, broad.outputs["Fac"], [(.65, (0,0,0,1)), (.78, (1,1,1,1))], "Sparse breakout windows")
    crust = ramp(tree, noise(tree, position, .24, 4).outputs["Fac"], [(.36, (0,0,0,1)), (.58, (1,1,1,1))], "Crust interrupts the seam network")
    heat = math_node(tree, "MAXIMUM", math_node(tree, "MULTIPLY", exposure, crust), window)
    wire(tree, ramp(tree, heat, [(0, color("111518")), (.15, color("322323")), (.4, color("de2707")), (1, color("ffad32"))], "Crust to exposed interior"), bsdf.inputs["Base Color"])
    bsdf.inputs["Emission Color"].default_value = (1, .16, .004, 1)
    wire(tree, math_node(tree, "MULTIPLY", heat, 3.4), bsdf.inputs["Emission Strength"])
    bsdf.inputs["Roughness"].default_value = .73
    bump = node(tree, "ShaderNodeBump", "Crust breakup", Strength=.65, Distance=.12)
    wire(tree, broad.outputs["Fac"], bump.inputs["Height"])
    wire(tree, bump.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def apply_materials(scene):
    basalt = rock_material("LD_R5_FracturedBasalt", "242a2d", "686a64", .89, .24)
    older = rock_material("LD_R5_CooledBench", "16191b", "414640", .76, .055, older=True)
    ash = rock_material("LD_R5_AshInLowerCountry", "252624", "636056", .96, .07)
    lava = lava_material()
    person, _, shader, _ = new_material("LD_R5_ScaleProxy")
    shader.inputs["Base Color"].default_value = color("c5bdb0")
    audience, _, shader, _ = new_material("LD_R5_AudienceProxy")
    shader.inputs["Base Color"].default_value = color("746356")
    for obj in scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        for i, mat in enumerate(obj.data.materials):
            if mat is None:
                continue
            if "Audience" in mat.name:
                replacement = audience
            elif "Performer" in mat.name:
                replacement = person
            elif any(key in mat.name for key in ("Crust", "Heat", "HotCore", "Fissure")):
                replacement = lava
            elif "OlderCooled" in mat.name:
                replacement = older
            elif "LowerCountry" in mat.name:
                replacement = ash
            else:
                replacement = basalt
            obj.data.materials[i] = replacement
    return older


def lighting(scene):
    for obj in list(scene.objects):
        if obj.type == "LIGHT":
            obj.hide_render = True
    world = bpy.data.worlds.new("LD_R5_AshSky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.19, .23, .29, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .6
    scene.world = world
    sun = bpy.data.lights.new("LD_R5_OvercastSun", "SUN")
    sun.energy = 2.3
    sun.angle = .20
    sun.color = (1, .89, .77)
    obj = bpy.data.objects.new(sun.name, sun)
    scene.collection.objects.link(obj)
    obj.rotation_euler = (math.radians(37), math.radians(-24), math.radians(-42))
    contract = json.loads(LOCK.read_text())
    lava = bpy.data.objects["EMBER_LavaSimulatorDeposit"]
    for index, point in enumerate(contract["lavaPlan"]["diagnosticCenterlineWorldXZ"][1::2]):
        x, z = point
        v = min(lava.data.vertices, key=lambda v: (v.co.x-x)**2 + (v.co.z-z)**2)
        light = bpy.data.lights.new(f"LD_R5_LavaBounce_{index}", "POINT")
        light.energy = 1300
        light.color = (1, .15, .012)
        light.shadow_soft_size = 3.0
        obj = bpy.data.objects.new(light.name, light)
        obj.location = (x, -z, v.co.y + 1.1)
        scene.collection.objects.link(obj)
    # The volume has no surface and cannot alter the approved terrain silhouette.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -20, 48))
    volume = bpy.context.object
    volume.name = "LD_R5_DistanceHaze"
    volume.scale = (450, 420, 330)
    material = bpy.data.materials.new("LD_R5_AshHaze")
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    out = node(tree, "ShaderNodeOutputMaterial", "Volume only")
    scatter = node(tree, "ShaderNodeVolumePrincipled", "Thin ash atmosphere", Density=.0017, Color=(.42,.45,.49,1), Anisotropy=.20)
    wire(tree, scatter.outputs[0], out.inputs["Volume"])
    volume.data.materials.append(material)


def configure(scene):
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    devices = [d for d in prefs.devices if d.type == "OPTIX"]
    for device in prefs.devices:
        device.use = device in devices
    scene.cycles.device = "GPU" if devices else "CPU"
    scene.cycles.samples = 16 if PREVIEW else 48
    scene.cycles.use_denoising = True
    scene.cycles.volume_bounces = 1
    scene.cycles.max_bounces = 6
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 8
    scene.render.resolution_x = 960 if PREVIEW else 1600
    scene.render.resolution_y = 540 if PREVIEW else 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = .4
    # No compositor bloom: the seam widths and surface detail stay inspectable.
    scene.use_nodes = False
    scene.render.filepath = "//ember-r5-visual-target.png"
    scene["ember_gate"] = 3
    scene["ember_gate2_approval"] = "3XyhXLyzv8ASNl2fLoCo"
    print("RENDER_DEVICES", [(d.name, d.type) for d in devices], flush=True)


def render(scene, camera_name, path):
    scene.camera = bpy.data.objects[f"EMBER_Camera_{camera_name}"]
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("TARGET_RENDERED", path.name, flush=True)


def verify():
    report = json.loads(REPORT.read_text())
    for path, expected in report["inputs"].items():
        if sha(ROOT / path) != expected:
            raise ValueError(f"Input changed: {path}")
    for path, expected in report["artifacts"].items():
        if sha(ROOT / path) != expected:
            raise ValueError(f"Artifact changed: {path}")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    original = bpy.context.scene
    original_geometry, original_cameras = geometry_snapshot(original), camera_snapshot()
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    if geometry_snapshot(bpy.context.scene) != original_geometry:
        raise ValueError("Source geometry, visibility or transform drift")
    if camera_snapshot() != original_cameras:
        raise ValueError("Camera registration drift")
    if bpy.context.scene.render.resolution_x / bpy.context.scene.render.resolution_y != 16/9:
        raise ValueError("Camera aspect changed")
    if not all(check["passed"] for check in report["checks"].values()):
        raise ValueError("Recorded check failure")
    print("PASS Gate 3 exact source mesh/camera equality and artifact digests", flush=True)


def main():
    if VERIFY:
        verify()
        return
    gates = json.loads((SPEC / "scene-gates.json").read_text())
    gate2 = next(g for g in gates["gates"] if g["id"] == "playable-graybox")
    if gate2["status"] != "approved":
        raise ValueError("Gate 2 approval required")
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    before_geometry, before_cameras = geometry_snapshot(scene), camera_snapshot()
    older = apply_materials(scene)
    lighting(scene)
    configure(scene)
    scene.name = "Ember R5 | Cooled flank and crusted flow"
    after_geometry, after_cameras = geometry_snapshot(scene), camera_snapshot()
    if before_geometry != after_geometry or before_cameras != after_cameras:
        raise ValueError("Material pass changed the approved geometry or cameras")
    paths = []
    names = ["default-audience", "midflank-oblique"] if PREVIEW else CAMERAS
    for index, name in enumerate(names):
        path = OUT / f"{'preview' if PREVIEW else 'target'}-{name}.png"
        render(scene, name, path)
        paths.append(path)
    if PREVIEW:
        return
    older.node_tree.nodes["Optional ember peak (invention)"].outputs[0].default_value = 1.4
    peak = OUT / "alternative-peripheral-ember-peak.png"
    render(scene, "default-audience", peak)
    paths.append(peak)
    older.node_tree.nodes["Optional ember peak (invention)"].outputs[0].default_value = 0
    scene.camera = bpy.data.objects["EMBER_Camera_default-audience"]
    scene.render.filepath = "//ember-r5-visual-target.png"
    # Preserve portable scene render paths from the original section scene too.
    for item in bpy.data.images:
        if item.source == "FILE" and item.has_data:
            item.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    inputs = [SOURCE, LOCK, HEIGHT, Path(__file__), ROOT / "scripts/build-ember-lookdev-matrix.py"]
    report = {
        "revision": "gate3-midflank-r5", "status": "awaiting-visual-review",
        "gate2Approval": "3XyhXLyzv8ASNl2fLoCo", "gate3Approval": None,
        "sourceBlend": relative(SOURCE), "targetBlend": relative(BLEND),
        "inputs": {relative(path): sha(path) for path in inputs},
        "checks": {
            "camera-registration": {"passed": before_cameras == after_cameras, "cameraCount": len(CAMERAS), "aspect": "16:9", "cameraSha256": digest(before_cameras)},
            "silhouette-read": {"passed": before_geometry == after_geometry, "scope": "Exact geometry, visibility and world matrices. Material readability requires visual review."},
            "geometry-lock": {"passed": before_geometry == after_geometry, "sourceMeshCount": len(before_geometry), "geometrySha256": digest(before_geometry)},
            "review-only": {"passed": True, "runtimeChanged": False, "meshyCalls": 0},
        },
        "lockedCameras": before_cameras, "lockedGeometry": before_geometry,
        "renders": [relative(p) for p in paths],
        "artifacts": {relative(p): sha(p) for p in [BLEND, *paths]},
        "renderSettings": {"engine": scene.render.engine, "samples": scene.cycles.samples, "resolution": [1600,900], "viewTransform": "AgX", "exposure": scene.view_settings.exposure},
        "limitations": ["Static material targets do not prove lava transport, pulse timing or runtime frame cost.", "Approved metre raster cell edges and human scale proxies remain visible. Hero mesh refinement belongs to the production slice."],
    }
    write_json(REPORT, report)
    print("PASS Gate 3 material target construction", flush=True)


if __name__ == "__main__":
    main()
