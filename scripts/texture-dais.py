"""
Texture the ruins dais IN blender/ocean_scene.blend so the Blender view matches
the app (no more flat gray). Bakes procedural stone/moss/crack to image textures
that ride the GLB, then assigns them to the Dais materials.

- DaisStone (body, pillars, columns): baked rock + crack + moss albedo.
- DaisDeck: baked green bioluminescent-crack albedo + emission so the deck reads
  green/glowing even in Blender. The RUNTIME still swaps the live breathing
  shader onto Dais_Deck at load — this baked image is the static stand-in that
  makes Blender WYSIWYG.

Baking uses Cycles EMIT (pure color, no lighting) on a clean 0-1 temp plane, so
the result is a tileable albedo each Dais face samples through its primitive UVs.

Run headless (open the real scene; NO --factory-startup):
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \\
    --background blender/ocean_scene.blend \\
    --python scripts/texture-dais.py

Saves ocean_scene.blend + PNGs under blender/textures/. Re-export the GLB after:
  blender --background blender/ocean_scene.blend \\
    --python scripts/blender-export-glb.py -- --include Dais_ \\
    --output static/models/ocean/dais.glb
"""
import bpy
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(bpy.data.filepath or __file__)))
TEX_DIR = os.path.join(os.path.dirname(bpy.data.filepath), "textures")
os.makedirs(TEX_DIR, exist_ok=True)
RES = 1024


# ── Cycles for baking ────────────────────────────────────────────────────────
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 8
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False


def new_node(nt, kind, x, y):
    n = nt.nodes.new(kind)
    n.location = (x, y)
    return n


def build_stone_emission(nt, out_emit):
    """Rock albedo: noise-graded stone, voronoi crack lines darkened, moss tint."""
    tc = new_node(nt, "ShaderNodeTexCoord", -1400, 0)

    # Base stone: noise -> ramp dark..light slate.
    n_stone = new_node(nt, "ShaderNodeTexNoise", -1100, 200)
    n_stone.inputs["Scale"].default_value = 6.0
    n_stone.inputs["Detail"].default_value = 8.0
    nt.links.new(tc.outputs["Generated"], n_stone.inputs["Vector"])
    ramp_stone = new_node(nt, "ShaderNodeValToRGB", -850, 250)
    ramp_stone.color_ramp.elements[0].color = (0.06, 0.08, 0.10, 1)
    ramp_stone.color_ramp.elements[1].color = (0.16, 0.19, 0.22, 1)
    nt.links.new(n_stone.outputs["Fac"], ramp_stone.inputs["Fac"])

    # Cracks: voronoi distance -> thin dark lines.
    vor = new_node(nt, "ShaderNodeTexVoronoi", -1100, -150)
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 7.0
    nt.links.new(tc.outputs["Generated"], vor.inputs["Vector"])
    ramp_crack = new_node(nt, "ShaderNodeValToRGB", -850, -150)
    ramp_crack.color_ramp.elements[0].position = 0.0
    ramp_crack.color_ramp.elements[0].color = (0, 0, 0, 1)      # crack line = dark
    ramp_crack.color_ramp.elements[1].position = 0.05
    ramp_crack.color_ramp.elements[1].color = (1, 1, 1, 1)      # away = keep stone
    nt.links.new(vor.outputs["Distance"], ramp_crack.inputs["Fac"])
    crack_mix = new_node(nt, "ShaderNodeMixRGB", -550, 100)
    crack_mix.blend_type = "MULTIPLY"
    crack_mix.inputs["Fac"].default_value = 0.6
    nt.links.new(ramp_stone.outputs["Color"], crack_mix.inputs["Color1"])
    nt.links.new(ramp_crack.outputs["Color"], crack_mix.inputs["Color2"])

    # Moss: second noise masked, green tint mixed on top.
    n_moss = new_node(nt, "ShaderNodeTexNoise", -1100, -480)
    n_moss.inputs["Scale"].default_value = 3.5
    nt.links.new(tc.outputs["Generated"], n_moss.inputs["Vector"])
    ramp_moss = new_node(nt, "ShaderNodeValToRGB", -850, -480)
    ramp_moss.color_ramp.elements[0].position = 0.45
    ramp_moss.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp_moss.color_ramp.elements[1].position = 0.62
    ramp_moss.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(n_moss.outputs["Fac"], ramp_moss.inputs["Fac"])
    moss_mix = new_node(nt, "ShaderNodeMixRGB", -300, 0)
    moss_mix.blend_type = "MIX"
    moss_mix.inputs["Color2"].default_value = (0.07, 0.16, 0.09, 1)  # moss green
    nt.links.new(crack_mix.outputs["Color"], moss_mix.inputs["Color1"])
    nt.links.new(ramp_moss.outputs["Color"], moss_mix.inputs["Fac"])

    nt.links.new(moss_mix.outputs["Color"], out_emit.inputs["Color"])


def build_deck_emission(nt, out_emit):
    """Green bioluminescent crack network: voronoi edges glow teal-green."""
    tc = new_node(nt, "ShaderNodeTexCoord", -1400, 0)

    # Dark green-stone base.
    n_stone = new_node(nt, "ShaderNodeTexNoise", -1100, 250)
    n_stone.inputs["Scale"].default_value = 6.0
    nt.links.new(tc.outputs["Generated"], n_stone.inputs["Vector"])
    ramp_stone = new_node(nt, "ShaderNodeValToRGB", -850, 250)
    ramp_stone.color_ramp.elements[0].color = (0.05, 0.09, 0.07, 1)
    ramp_stone.color_ramp.elements[1].color = (0.10, 0.16, 0.13, 1)
    nt.links.new(n_stone.outputs["Fac"], ramp_stone.inputs["Fac"])

    # Glowing crack lines: voronoi distance -> bright green near edges.
    vor = new_node(nt, "ShaderNodeTexVoronoi", -1100, -200)
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 5.0
    nt.links.new(tc.outputs["Generated"], vor.inputs["Vector"])
    ramp_glow = new_node(nt, "ShaderNodeValToRGB", -850, -200)
    ramp_glow.color_ramp.elements[0].position = 0.0
    ramp_glow.color_ramp.elements[0].color = (0.27, 0.87, 0.67, 1)  # bright glow #44ddaa
    ramp_glow.color_ramp.elements[1].position = 0.12
    ramp_glow.color_ramp.elements[1].color = (0, 0, 0, 1)           # away = no glow
    nt.links.new(vor.outputs["Distance"], ramp_glow.inputs["Fac"])

    add = new_node(nt, "ShaderNodeMixRGB", -400, 0)
    add.blend_type = "ADD"
    add.inputs["Fac"].default_value = 1.0
    nt.links.new(ramp_stone.outputs["Color"], add.inputs["Color1"])
    nt.links.new(ramp_glow.outputs["Color"], add.inputs["Color2"])
    nt.links.new(add.outputs["Color"], out_emit.inputs["Color"])


def bake_albedo(name, builder):
    """Bake a procedural emission graph to a PNG, return its filepath."""
    # Temp plane with clean 0-1 UV.
    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0, 0, 1000))
    plane = bpy.context.active_object
    plane.name = f"__bake_{name}"

    mat = bpy.data.materials.new(f"__bake_mat_{name}")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = new_node(nt, "ShaderNodeOutputMaterial", 200, 0)
    emit = new_node(nt, "ShaderNodeEmission", -50, 0)
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    builder(nt, emit)

    img = bpy.data.images.new(name, RES, RES)
    img_node = new_node(nt, "ShaderNodeTexImage", -50, 350)
    img_node.image = img
    nt.nodes.active = img_node
    for n in nt.nodes:
        n.select = (n == img_node)

    plane.data.materials.clear()
    plane.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    plane.select_set(True)
    bpy.context.view_layer.objects.active = plane
    bpy.ops.object.bake(type="EMIT")

    path = os.path.join(TEX_DIR, f"{name}.png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    print(f"Baked: {path}")

    bpy.data.objects.remove(plane, do_unlink=True)
    return path, img


stone_path, stone_img = bake_albedo("dais_stone", build_stone_emission)
deck_path, deck_img = bake_albedo("dais_deck", build_deck_emission)


# ── Reassign real materials to use the baked images ──────────────────────────
def textured_material(name, img, emissive=False):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = new_node(nt, "ShaderNodeOutputMaterial", 300, 0)
    bsdf = new_node(nt, "ShaderNodeBsdfPrincipled", 0, 0)
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = new_node(nt, "ShaderNodeTexImage", -450, 0)
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if emissive:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.6
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


textured_material("DaisStone", stone_img, emissive=False)
textured_material("DaisDeck", deck_img, emissive=True)

# Pack images so the .blend is self-contained.
bpy.ops.file.pack_all()

bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print(f"Saved: {bpy.data.filepath}")
print("Textures:", os.listdir(TEX_DIR))
