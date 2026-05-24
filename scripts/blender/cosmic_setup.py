"""
Cosmic Scene Setup for Blender
Full scene: crystals, ground, platform, lighting, camera, Earth, avatar, staves,
nebula backdrop, starfield. Execute via mcp__blender__execute_blender_code.

Coordinate conversion: Three.js Y-up -> Blender Z-up
  position: (x, y, z)_three -> (x, -z, y)_blender
  Y-axis rotation in Three.js = Z-axis rotation in Blender
"""

import bpy
import os
import math
import random
from mathutils import Vector, Quaternion

# ── Configuration ──────────────────────────────────────────────────────────────

MODEL_DIR = r"E:\tka-platform\static\models\cosmic"
AVATAR_PATH = r"E:\tka-platform\static\models\avatars\ch01.glb"
EARTH_TEX = r"E:\tka-platform\static\textures\cosmic\earth-diffuse.jpg"
ROCK_TEX_DIR = r"E:\tka-platform\static\textures\terrain\rock"

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

# Colors from scene-configs.ts
GROUND_COLOR_TINT = (0.12, 0.12, 0.22, 1.0)
PLATFORM_COLOR = (0.04, 0.04, 0.1, 1.0)
PLATFORM_EMISSIVE = (0.27, 0.53, 1.0, 1.0)  # #4488ff
SKY_AMBIENT = (0.10, 0.16, 0.29, 1.0)  # #1a2a4a
FOG_COLOR = (0.03, 0.03, 0.09, 1.0)  # #080818
DIR_LIGHT_COLOR = (0.53, 0.6, 0.87)  # #8899dd
WARM_LIGHT_COLOR = (0.4, 0.53, 0.73)  # #6688bb
EARTH_RIM_COLOR = (0.27, 0.53, 1.0, 1.0)


def three_to_blender_pos(x, y, z):
    return Vector((x, -z, y))


def rotY_to_blender_quat(rot_y):
    return Quaternion((0, 0, 1), rot_y)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for col in list(bpy.data.collections):
        if col.name != "Scene Collection":
            bpy.data.collections.remove(col)


def create_ground():
    bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "LunarGround"

    mat = bpy.data.materials.new("LunarGround_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for n in nodes:
        nodes.remove(n)

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (800, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (400, 0)
    bsdf.inputs["Metallic"].default_value = 0.1
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-800, 0)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.location = (-600, 0)
    mapping.inputs["Scale"].default_value = (8, 8, 8)
    links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])

    tex_files = {"diffuse": "diffuse.jpg", "normal": "normal.jpg", "roughness": "roughness.jpg"}
    for tex_name, filename in tex_files.items():
        path = os.path.join(ROCK_TEX_DIR, filename)
        if not os.path.exists(path):
            continue
        tex_node = nodes.new("ShaderNodeTexImage")
        tex_node.image = bpy.data.images.load(path)
        links.new(mapping.outputs["Vector"], tex_node.inputs["Vector"])

        if tex_name == "diffuse":
            tex_node.location = (-200, 200)
            darken = nodes.new("ShaderNodeMixRGB")
            darken.location = (100, 200)
            darken.blend_type = 'MULTIPLY'
            darken.inputs["Fac"].default_value = 1.0
            darken.inputs["Color2"].default_value = GROUND_COLOR_TINT
            links.new(tex_node.outputs["Color"], darken.inputs["Color1"])
            links.new(darken.outputs["Color"], bsdf.inputs["Base Color"])
        elif tex_name == "normal":
            tex_node.location = (-200, -100)
            tex_node.image.colorspace_settings.name = 'Non-Color'
            nmap = nodes.new("ShaderNodeNormalMap")
            nmap.location = (100, -100)
            nmap.inputs["Strength"].default_value = 1.5
            links.new(tex_node.outputs["Color"], nmap.inputs["Color"])
            links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
        elif tex_name == "roughness":
            tex_node.location = (-200, -400)
            tex_node.image.colorspace_settings.name = 'Non-Color'
            links.new(tex_node.outputs["Color"], bsdf.inputs["Roughness"])

    ground.data.materials.append(mat)
    return ground


def create_platform():
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=3.5, depth=0.4, location=(0, 0, 0.2))
    platform = bpy.context.active_object
    platform.name = "StationPlatform"

    pmat = bpy.data.materials.new("Platform_Mat")
    pmat.use_nodes = True
    bsdf = pmat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = PLATFORM_COLOR
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Emission Color"].default_value = PLATFORM_EMISSIVE
    bsdf.inputs["Emission Strength"].default_value = 0.3
    platform.data.materials.append(pmat)

    # Edge ring
    bpy.ops.mesh.primitive_torus_add(major_radius=3.5, minor_radius=0.03,
                                     major_segments=8, minor_segments=8,
                                     location=(0, 0, 0.4))
    ring = bpy.context.active_object
    ring.name = "PlatformEdgeRing"
    rmat = bpy.data.materials.new("PlatformRing_Mat")
    rmat.use_nodes = True
    rbsdf = rmat.node_tree.nodes["Principled BSDF"]
    rbsdf.inputs["Base Color"].default_value = PLATFORM_EMISSIVE
    rbsdf.inputs["Emission Color"].default_value = PLATFORM_EMISSIVE
    rbsdf.inputs["Emission Strength"].default_value = 5.0
    ring.data.materials.append(rmat)

    # 8 accent lights
    for i in range(8):
        angle = (2 * math.pi * i) / 8
        x = 3.5 * math.cos(angle)
        y = 3.5 * math.sin(angle)
        bpy.ops.object.light_add(type='POINT', location=(x, y, 0.5))
        accent = bpy.context.active_object
        accent.name = f"AccentLight_{i}"
        accent.data.color = PLATFORM_EMISSIVE[:3]
        accent.data.energy = 5.0
        accent.data.shadow_soft_size = 0.5

    return platform


def create_earth():
    earth_col = bpy.data.collections.new("Earth")
    bpy.context.scene.collection.children.link(earth_col)

    earth_pos = three_to_blender_pos(-40, 12, -60)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=8, segments=48, ring_count=48, location=earth_pos)
    earth = bpy.context.active_object
    earth.name = "EarthSphere"
    for col in earth.users_collection:
        col.objects.unlink(earth)
    earth_col.objects.link(earth)

    mat = bpy.data.materials.new("Earth_Mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8

    if os.path.exists(EARTH_TEX):
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(EARTH_TEX)
        mapping = nodes.new("ShaderNodeMapping")
        texcoord = nodes.new("ShaderNodeTexCoord")
        links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    # Fresnel rim glow
    fresnel = nodes.new("ShaderNodeFresnel")
    fresnel.inputs["IOR"].default_value = 1.5
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = EARTH_RIM_COLOR
    emission.inputs["Strength"].default_value = 2.0
    mix = nodes.new("ShaderNodeMixShader")
    links.new(fresnel.outputs["Fac"], mix.inputs["Fac"])
    links.new(bsdf.outputs["BSDF"], mix.inputs[1])
    links.new(emission.outputs["Emission"], mix.inputs[2])
    output = nodes["Material Output"]
    links.new(mix.outputs["Shader"], output.inputs["Surface"])
    earth.data.materials.append(mat)

    # Glow sphere
    bpy.ops.mesh.primitive_uv_sphere_add(radius=9.2, segments=32, ring_count=32, location=earth_pos)
    glow = bpy.context.active_object
    glow.name = "EarthGlow"
    for col in glow.users_collection:
        col.objects.unlink(glow)
    earth_col.objects.link(glow)

    gmat = bpy.data.materials.new("EarthGlow_Mat")
    gmat.use_nodes = True
    gn = gmat.node_tree.nodes
    gl = gmat.node_tree.links
    gbsdf = gn["Principled BSDF"]
    gbsdf.inputs["Alpha"].default_value = 0.15
    gbsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    gf = gn.new("ShaderNodeFresnel")
    gf.inputs["IOR"].default_value = 2.0
    ge = gn.new("ShaderNodeEmission")
    ge.inputs["Color"].default_value = EARTH_RIM_COLOR
    ge.inputs["Strength"].default_value = 1.0
    gm = gn.new("ShaderNodeMixShader")
    gl.new(gf.outputs["Fac"], gm.inputs["Fac"])
    gl.new(gbsdf.outputs["BSDF"], gm.inputs[1])
    gl.new(ge.outputs["Emission"], gm.inputs[2])
    go = gn["Material Output"]
    gl.new(gm.outputs["Shader"], go.inputs["Surface"])
    glow.data.materials.append(gmat)


def create_nebula():
    env_col = bpy.data.collections.get("Environment")
    if not env_col:
        env_col = bpy.data.collections.new("Environment")
        bpy.context.scene.collection.children.link(env_col)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=70, segments=32, ring_count=32, location=(0, 0, 0))
    nebula = bpy.context.active_object
    nebula.name = "NebulaSphere"
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.flip_normals()
    bpy.ops.object.mode_set(mode='OBJECT')

    for col in nebula.users_collection:
        col.objects.unlink(nebula)
    env_col.objects.link(nebula)

    mat = bpy.data.materials.new("Nebula_Mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for n in nodes:
        nodes.remove(n)

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (1200, 0)
    emission = nodes.new("ShaderNodeEmission")
    emission.location = (900, 100)
    emission.inputs["Strength"].default_value = 1.5
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    transparent.location = (900, -100)
    mix = nodes.new("ShaderNodeMixShader")
    mix.location = (1050, 0)
    links.new(emission.outputs["Emission"], mix.inputs[2])
    links.new(transparent.outputs["BSDF"], mix.inputs[1])
    links.new(mix.outputs["Shader"], output.inputs["Surface"])

    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-600, 0)
    noise1 = nodes.new("ShaderNodeTexNoise")
    noise1.location = (-200, 200)
    noise1.inputs["Scale"].default_value = 1.5
    noise1.inputs["Detail"].default_value = 6.0
    noise1.inputs["Roughness"].default_value = 0.7
    links.new(texcoord.outputs["Object"], noise1.inputs["Vector"])

    noise2 = nodes.new("ShaderNodeTexNoise")
    noise2.location = (-200, -100)
    noise2.inputs["Scale"].default_value = 3.0
    noise2.inputs["Detail"].default_value = 4.0
    noise2.inputs["Roughness"].default_value = 0.5
    links.new(texcoord.outputs["Object"], noise2.inputs["Vector"])

    mix_noise = nodes.new("ShaderNodeMixRGB")
    mix_noise.location = (100, 100)
    mix_noise.blend_type = 'MULTIPLY'
    mix_noise.inputs["Fac"].default_value = 0.5
    links.new(noise1.outputs["Fac"], mix_noise.inputs["Color1"])
    links.new(noise2.outputs["Fac"], mix_noise.inputs["Color2"])

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (350, 100)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.02, 0.01, 0.04, 1.0)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.16, 0.06, 0.33, 1.0)
    mid = ramp.color_ramp.elements.new(0.5)
    mid.color = (0.10, 0.04, 0.25, 1.0)
    links.new(mix_noise.outputs["Color"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emission.inputs["Color"])

    alpha_ramp = nodes.new("ShaderNodeValToRGB")
    alpha_ramp.location = (350, -200)
    alpha_ramp.color_ramp.elements[0].position = 0.35
    alpha_ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    alpha_ramp.color_ramp.elements[1].position = 0.65
    alpha_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(mix_noise.outputs["Color"], alpha_ramp.inputs["Fac"])
    links.new(alpha_ramp.outputs["Color"], mix.inputs["Fac"])

    nebula.data.materials.append(mat)
    nebula.visible_shadow = False


def create_starfield():
    env_col = bpy.data.collections.get("Environment")
    stars_col = bpy.data.collections.new("Starfield")
    env_col.children.link(stars_col)

    bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=1, location=(0, 0, 0))
    template = bpy.context.active_object
    template.name = "_star_template"
    template.hide_set(True)
    template.hide_render = True

    smat = bpy.data.materials.new("Star_Mat")
    smat.use_nodes = True
    sbsdf = smat.node_tree.nodes["Principled BSDF"]
    sbsdf.inputs["Base Color"].default_value = (1.0, 1.0, 0.95, 1.0)
    sbsdf.inputs["Emission Color"].default_value = (1.0, 1.0, 0.9, 1.0)
    sbsdf.inputs["Emission Strength"].default_value = 8.0
    template.data.materials.append(smat)
    for col in template.users_collection:
        col.objects.unlink(template)
    env_col.objects.link(template)

    random.seed(42)
    for i in range(500):
        theta = random.uniform(0, 2 * math.pi)
        phi = random.uniform(0, math.pi * 0.6)
        r = 65
        x = r * math.sin(phi) * math.cos(theta)
        y = r * math.sin(phi) * math.sin(theta)
        z = r * math.cos(phi)
        size = 0.05 + 0.20 * (random.random() ** 3)

        star = template.copy()
        star.data = template.data
        star.name = f"star_{i:03d}"
        star.location = (x, y, z)
        star.scale = (size, size, size)
        star.hide_set(False)
        star.hide_render = False
        stars_col.objects.link(star)


def import_avatar():
    performer_col = bpy.data.collections.new("Performer")
    bpy.context.scene.collection.children.link(performer_col)

    if not os.path.exists(AVATAR_PATH):
        print(f"WARNING: Avatar not found: {AVATAR_PATH}")
        return None

    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=AVATAR_PATH)
    after = set(bpy.data.objects.keys())
    new_objs = after - before

    armature = None
    for obj_name in new_objs:
        obj = bpy.data.objects[obj_name]
        for col in obj.users_collection:
            col.objects.unlink(obj)
        performer_col.objects.link(obj)
        if obj.type == 'ARMATURE':
            armature = obj

    if armature:
        armature.name = "Performer_Armature"
        armature.location = (0, 0, 0.4)
    return armature


def create_staves(armature, performer_col):
    STAFF_LENGTH = 1.2
    STAFF_RADIUS = 0.015
    TIP_RADIUS = 0.025

    def make_staff(name, color, bone_name):
        bpy.ops.mesh.primitive_cylinder_add(radius=STAFF_RADIUS, depth=STAFF_LENGTH, location=(0, 0, 0))
        shaft = bpy.context.active_object
        shaft.name = name

        shaft_mat = bpy.data.materials.new(f"{name}_Shaft_Mat")
        shaft_mat.use_nodes = True
        bsdf = shaft_mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (0.15, 0.15, 0.15, 1.0)
        bsdf.inputs["Metallic"].default_value = 0.9
        bsdf.inputs["Roughness"].default_value = 0.3
        shaft.data.materials.append(shaft_mat)

        for end, offset in [("Top", STAFF_LENGTH / 2), ("Bot", -STAFF_LENGTH / 2)]:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=TIP_RADIUS, location=(0, 0, offset))
            tip = bpy.context.active_object
            tip.name = f"{name}_{end}Tip"
            tip.parent = shaft
            tmat = bpy.data.materials.new(f"{name}_{end}_Mat")
            tmat.use_nodes = True
            tbsdf = tmat.node_tree.nodes["Principled BSDF"]
            c = color if end == "Top" else tuple(v * 0.5 for v in color[:3]) + (1.0,)
            tbsdf.inputs["Base Color"].default_value = c
            tbsdf.inputs["Emission Color"].default_value = c
            tbsdf.inputs["Emission Strength"].default_value = 3.0 if end == "Top" else 1.5
            tip.data.materials.append(tmat)
            for col in tip.users_collection:
                col.objects.unlink(tip)
            performer_col.objects.link(tip)

        for col in shaft.users_collection:
            col.objects.unlink(shaft)
        performer_col.objects.link(shaft)

        if armature and bone_name in [b.name for b in armature.data.bones]:
            shaft.parent = armature
            shaft.parent_type = 'BONE'
            shaft.parent_bone = bone_name
        return shaft

    make_staff("BlueStaff", (0.2, 0.4, 1.0, 1.0), "mixamorig12:LeftHand")
    make_staff("RedStaff", (1.0, 0.2, 0.2, 1.0), "mixamorig12:RightHand")


def import_glb_templates():
    templates = {}
    template_col = bpy.data.collections.new("_Templates")
    bpy.context.scene.collection.children.link(template_col)

    for model_name in CRYSTAL_MODELS:
        glb_path = os.path.join(MODEL_DIR, f"{model_name}.glb")
        if not os.path.exists(glb_path):
            continue
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=glb_path)
        after = set(bpy.data.objects.keys())
        new_objs = after - before
        if not new_objs:
            continue
        root = bpy.data.objects[sorted(new_objs)[0]]
        for obj_name in new_objs:
            obj = bpy.data.objects[obj_name]
            for col in obj.users_collection:
                col.objects.unlink(obj)
            template_col.objects.link(obj)
        root.name = f"_template_{model_name}"
        root.hide_set(True)
        root.hide_render = True
        templates[model_name] = root

    template_col.hide_viewport = True
    return templates


def place_crystals(templates):
    crystal_col = bpy.data.collections.new("Crystals")
    bpy.context.scene.collection.children.link(crystal_col)

    for p in PLACEMENTS:
        template = templates.get(p["key"])
        if not template:
            continue
        obj = template.copy()
        if template.data:
            obj.data = template.data.copy()
        obj.name = f"{p['key']}_{p['id'].split('-')[-1]}"
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

    return crystal_col


def setup_lighting():
    # Directional light — Three.js [-30, 20, -40] -> Blender (-30, 40, 20)
    dir_pos = Vector((-30, 40, 20))
    bpy.ops.object.light_add(type='SUN', location=dir_pos)
    sun = bpy.context.active_object
    sun.name = "ColdDirectional"
    sun.data.color = DIR_LIGHT_COLOR
    sun.data.energy = 0.6
    target_dir = Vector((0, 0, 0)) - dir_pos
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = target_dir.to_track_quat('-Z', 'Y')

    # Warm station light
    bpy.ops.object.light_add(type='POINT', location=(0, 0, 2.0))
    warm = bpy.context.active_object
    warm.name = "WarmStation"
    warm.data.color = WARM_LIGHT_COLOR
    warm.data.energy = 15
    warm.data.shadow_soft_size = 12

    # Earth fill light
    bpy.ops.object.light_add(type='SUN', location=(-10, 15, 5))
    fill = bpy.context.active_object
    fill.name = "EarthFill"
    fill.data.color = (0.3, 0.5, 0.8)
    fill.data.energy = 0.15
    target = Vector((0, 0, 0)) - Vector((-10, 15, 5))
    fill.rotation_mode = 'QUATERNION'
    fill.rotation_quaternion = target.to_track_quat('-Z', 'Y')


def setup_camera():
    cam_pos = Vector((15, -15, 10))
    bpy.ops.object.camera_add(location=cam_pos)
    cam = bpy.context.active_object
    cam.name = "OrbitCamera"
    look_at = Vector((0, 0, 1.5))
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (look_at - cam_pos).to_track_quat('-Z', 'Y')
    cam.data.lens = 35
    cam.data.clip_start = 0.1
    cam.data.clip_end = 200
    bpy.context.scene.camera = cam


def setup_world():
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("CosmicWorld")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = SKY_AMBIENT
        bg.inputs["Strength"].default_value = 0.15
    vol = world.node_tree.nodes.new(type='ShaderNodeVolumeScatter')
    vol.inputs["Color"].default_value = FOG_COLOR
    vol.inputs["Density"].default_value = 0.02
    output = world.node_tree.nodes.get("World Output")
    if output:
        world.node_tree.links.new(vol.outputs["Volume"], output.inputs["Volume"])


def main():
    clear_scene()
    setup_world()
    ground = create_ground()
    platform = create_platform()
    create_earth()
    create_nebula()
    create_starfield()
    setup_lighting()
    setup_camera()

    templates = import_glb_templates()
    crystal_col = place_crystals(templates)

    armature = import_avatar()
    if armature:
        performer_col = bpy.data.collections.get("Performer")
        create_staves(armature, performer_col)

    # Viewport settings
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    break

    bpy.context.view_layer.update()
    total = len(bpy.data.objects)
    crystals = len(crystal_col.objects) if crystal_col else 0
    print(f"Cosmic scene ready. Objects: {total}, Crystals: {crystals}")


main()
