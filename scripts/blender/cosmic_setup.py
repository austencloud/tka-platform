"""
Cosmic Scene Setup for Blender
Imports crystal GLBs, places them per placements.ts, adds ground/platform/lighting/camera.
Execute via: mcp__blender__execute_blender_code (paste full content)

Coordinate conversion: Three.js Y-up -> Blender Z-up
  position: (x, y, z)_three -> (x, -z, y)_blender
  Y-axis rotation in Three.js = Z-axis rotation in Blender
"""

import bpy
import os
from mathutils import Vector, Quaternion

# ── Configuration ──────────────────────────────────────────────────────────────

MODEL_DIR = r"E:\tka-platform\static\models\cosmic"

CRYSTAL_MODELS = [
    "crystal-spire-prismatic",
    "crystal-pyramid-blue",
    "crystal-cluster-aurora",
    "crystal-branch-moonlit",
    "crystal-spire-cyan",
    "crystal-cluster-emerald",
    "crystal-spire-amethyst",
]

PLACEMENTS = [
    {"id": "cosmic-0",  "key": "crystal-spire-amethyst",   "pos": [-12, 0, -10],     "rotY": 0.3,  "scale": 0.9},
    {"id": "cosmic-1",  "key": "crystal-cluster-emerald",  "pos": [-10.5, 0, -11.5], "rotY": 1.2,  "scale": 0.6},
    {"id": "cosmic-2",  "key": "crystal-spire-amethyst",   "pos": [-13.5, 0, -8.5],  "rotY": 2.1,  "scale": 0.5},
    {"id": "cosmic-3",  "key": "crystal-cluster-emerald",  "pos": [-11, 0, -9],      "rotY": 0.8,  "scale": 0.35},
    {"id": "cosmic-4",  "key": "crystal-spire-amethyst",   "pos": [-14, 0, -11],     "rotY": 1.5,  "scale": 0.4},
    {"id": "cosmic-5",  "key": "crystal-spire-cyan",       "pos": [-8, 0, -14],      "rotY": 0.6,  "scale": 0.7},
    {"id": "cosmic-6",  "key": "crystal-spire-cyan",       "pos": [-9.5, 0, -15.5],  "rotY": 2.4,  "scale": 0.4},
    {"id": "cosmic-7",  "key": "crystal-cluster-aurora",   "pos": [-7, 0, -13],      "rotY": 1.8,  "scale": 0.45},
    {"id": "cosmic-8",  "key": "crystal-spire-prismatic",  "pos": [-16, 0, -5],      "rotY": 0.2,  "scale": 0.8},
    {"id": "cosmic-9",  "key": "crystal-pyramid-blue",     "pos": [-15, 0, -3.5],    "rotY": 1.0,  "scale": 0.55},
    {"id": "cosmic-10", "key": "crystal-spire-prismatic",  "pos": [-17, 0, -6.5],    "rotY": 1.6,  "scale": 0.4},
    {"id": "cosmic-11", "key": "crystal-pyramid-blue",     "pos": [9, 0, -7],        "rotY": -0.5, "scale": 0.7},
    {"id": "cosmic-12", "key": "crystal-spire-prismatic",  "pos": [10.5, 0, -8.5],   "rotY": 0.4,  "scale": 0.45},
    {"id": "cosmic-13", "key": "crystal-pyramid-blue",     "pos": [8, 0, -6],        "rotY": 1.2,  "scale": 0.3},
    {"id": "cosmic-14", "key": "crystal-cluster-aurora",   "pos": [-7, 0, 8],        "rotY": 2.2,  "scale": 0.6},
    {"id": "cosmic-15", "key": "crystal-branch-moonlit",   "pos": [-6, 0, 9.5],      "rotY": 1.1,  "scale": 0.4},
    {"id": "cosmic-16", "key": "crystal-spire-amethyst",   "pos": [14, 0, 12],       "rotY": -1.8, "scale": 1.0},
    {"id": "cosmic-17", "key": "crystal-cluster-emerald",  "pos": [15, 0, 13],       "rotY": 0.3,  "scale": 0.35},
    {"id": "cosmic-18", "key": "crystal-spire-cyan",       "pos": [16, 0, -13],      "rotY": -0.5, "scale": 0.6},
    {"id": "cosmic-19", "key": "crystal-branch-moonlit",   "pos": [5, 0, 10],        "rotY": 1.4,  "scale": 0.45},
    {"id": "cosmic-20", "key": "crystal-cluster-emerald",  "pos": [6, 0, 9],         "rotY": 0.8,  "scale": 0.3},
    {"id": "cosmic-21", "key": "crystal-spire-prismatic",  "pos": [-4, 0, -16],      "rotY": 0.9,  "scale": 0.3},
    {"id": "cosmic-22", "key": "crystal-pyramid-blue",     "pos": [12, 0, -3],       "rotY": 1.7,  "scale": 0.35},
    {"id": "cosmic-23", "key": "crystal-cluster-aurora",   "pos": [-16, 0, 7],       "rotY": 0.4,  "scale": 0.4},
]

GROUND_COLOR = (0x1a / 255, 0x1a / 255, 0x2e / 255, 1.0)
PLATFORM_COLOR = (0x0a / 255, 0x0a / 255, 0x1a / 255, 1.0)
SKY_TOP = (0x05 / 255, 0x05 / 255, 0x10 / 255, 1.0)
FOG_COLOR = (0x08 / 255, 0x08 / 255, 0x18 / 255, 1.0)


def three_to_blender_pos(x, y, z):
    return Vector((x, -z, y))

def rotY_to_blender_quat(rot_y):
    return Quaternion((0, 0, 1), rot_y)


def main():
    # Clear scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Ground plane
    bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "LunarGround"
    mat = bpy.data.materials.new("LunarGround_Mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = GROUND_COLOR
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.1
    ground.data.materials.append(mat)

    # Stage platform
    bpy.ops.mesh.primitive_cylinder_add(radius=3.5, depth=0.4, location=(0, 0, 0.2))
    platform = bpy.context.active_object
    platform.name = "StationPlatform"
    pmat = bpy.data.materials.new("Platform_Mat")
    pmat.use_nodes = True
    pbsdf = pmat.node_tree.nodes["Principled BSDF"]
    pbsdf.inputs["Base Color"].default_value = PLATFORM_COLOR
    pbsdf.inputs["Metallic"].default_value = 0.8
    pbsdf.inputs["Roughness"].default_value = 0.2
    pbsdf.inputs["Emission Color"].default_value = (0x44/255, 0x88/255, 0xff/255, 1.0)
    pbsdf.inputs["Emission Strength"].default_value = 0.6
    platform.data.materials.append(pmat)

    # Exclusion zone
    bpy.ops.mesh.primitive_uv_sphere_add(radius=5.0, segments=32, ring_count=16, location=(0, 0, 2.5))
    zone = bpy.context.active_object
    zone.name = "ExclusionZone_5m"
    zone.display_type = 'WIRE'
    zone.hide_render = True

    # World + fog
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("CosmicWorld")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = SKY_TOP
        bg.inputs["Strength"].default_value = 0.3
    vol = world.node_tree.nodes.new(type='ShaderNodeVolumeScatter')
    vol.inputs["Color"].default_value = FOG_COLOR
    vol.inputs["Density"].default_value = 0.08
    output = world.node_tree.nodes.get("World Output")
    if output:
        world.node_tree.links.new(vol.outputs["Volume"], output.inputs["Volume"])

    # Directional light — Three.js [-30, 20, -40] -> Blender (-30, 40, 20)
    dir_pos = Vector((-30, 40, 20))
    bpy.ops.object.light_add(type='SUN', location=dir_pos)
    sun = bpy.context.active_object
    sun.name = "ColdDirectional"
    sun.data.color = (0x88/255, 0x99/255, 0xdd/255)
    sun.data.energy = 1.2
    target_dir = Vector((0, 0, 0)) - dir_pos
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = target_dir.to_track_quat('-Z', 'Y')

    # Warm point light
    bpy.ops.object.light_add(type='POINT', location=(0, 0, 0.5))
    warm = bpy.context.active_object
    warm.name = "WarmStation"
    warm.data.color = (0x66/255, 0x88/255, 0xbb/255)
    warm.data.energy = 25
    warm.data.shadow_soft_size = 12

    # Camera — Three.js (12, 8, -12) -> Blender (12, 12, 8)
    cam_pos = Vector((12, 12, 8))
    bpy.ops.object.camera_add(location=cam_pos)
    cam = bpy.context.active_object
    cam.name = "OrbitCamera"
    look_at = Vector((0, 0, 1.5))
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (look_at - cam_pos).to_track_quat('-Z', 'Y')
    cam.data.lens = 50
    cam.data.clip_start = 0.1
    cam.data.clip_end = 200
    bpy.context.scene.camera = cam

    # Import GLB templates
    template_col = bpy.data.collections.new("_Templates")
    bpy.context.scene.collection.children.link(template_col)
    templates = {}

    for model_name in CRYSTAL_MODELS:
        glb_path = os.path.join(MODEL_DIR, f"{model_name}.glb")
        if not os.path.exists(glb_path):
            print(f"MISSING: {glb_path}")
            continue
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=glb_path)
        after = set(bpy.data.objects.keys())
        new_objs = after - before
        if not new_objs:
            continue
        for obj_name in new_objs:
            obj = bpy.data.objects[obj_name]
            for col in obj.users_collection:
                col.objects.unlink(obj)
            template_col.objects.link(obj)
        root = bpy.data.objects[sorted(new_objs)[0]]
        root.name = f"_template_{model_name}"
        root.hide_set(True)
        root.hide_render = True
        templates[model_name] = root

    template_col.hide_viewport = True

    # Place crystals
    crystal_col = bpy.data.collections.new("Crystals")
    bpy.context.scene.collection.children.link(crystal_col)

    for p in PLACEMENTS:
        template = templates.get(p["key"])
        if not template:
            continue
        obj = template.copy()
        if template.data:
            obj.data = template.data.copy()
        idx = p["id"].split("-")[-1]
        obj.name = f"{p['key']}_{idx}"
        obj.hide_set(False)
        obj.hide_render = False
        obj.location = three_to_blender_pos(*p["pos"])
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = rotY_to_blender_quat(p["rotY"])
        s = p["scale"]
        obj.scale = (s, s, s)
        obj["tka_id"] = p["id"]
        obj["tka_objectKey"] = p["key"]
        crystal_col.objects.link(obj)

    # Viewport settings
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    break

    bpy.context.view_layer.update()
    print(f"Cosmic scene ready. Objects: {len(bpy.data.objects)}, Crystals: {len(crystal_col.objects)}")


main()
