"""Build one clothed MPFB evaluation avatar without installing into user Blender.

Run with Blender --background --factory-startup --python-exit-code 1 --python
this-file -- --source <mpfb2 checkout> --assets <system pack directory>
--output <persistent output directory>. Use an isolated BLENDER_USER_RESOURCES.
MPFB source and the official CC0 system asset pack are external prerequisites.
"""

import argparse
import importlib
import json
import sys
import types
from pathlib import Path

import bpy


parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--assets", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
args.output.mkdir(parents=True, exist_ok=True)

# Blender's extension APIs require a three-part package name. Load the pinned
# checkout in a process-local namespace; no add-on install or preference save.
namespace = types.ModuleType("bl_ext.mpfbproof")
namespace.__path__ = [str(args.source / "src")]
sys.modules[namespace.__name__] = namespace
mpfb = importlib.import_module("bl_ext.mpfbproof.mpfb")
bpy.context.preferences.use_preferences_save = False
bpy.context.preferences.addons.new().module = mpfb.__name__
mpfb.register()

HumanService = importlib.import_module(mpfb.__name__ + ".services.humanservice").HumanService
TargetService = importlib.import_module(mpfb.__name__ + ".services.targetservice").TargetService
ExportService = importlib.import_module(mpfb.__name__ + ".services.exportservice").ExportService
ObjectService = importlib.import_module(mpfb.__name__ + ".services.objectservice").ObjectService


def asset(subdir, name):
    matches = list((args.assets / subdir).rglob(name))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {subdir}/{name}, found {matches}")
    return str(matches[0])


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
macros = TargetService.get_default_macro_info_dict()
macros.update(gender=0.0, age=0.35, muscle=0.5, weight=0.5)
macros["race"] = {"african": 0.0, "asian": 0.0, "caucasian": 1.0}
body = HumanService.create_human(macro_detail_dict=macros)
body.name = "MPFB Proof"
HumanService.set_character_skin(
    asset("skins", "young_caucasian_female.mhmat"), body, skin_type="GAMEENGINE"
)
# This is MPFB's authored rig/weights, not a Mixamo cloud re-rig.
HumanService.add_builtin_rig(body, "mixamo")
# TKA's staff poses flex fingers around local +X. MPFB's Mixamo-named bones
# use different rolls, so names alone do not establish that convention.
# Orient local +Z into the palm: positive X then bends +Y toward the palm.
# Change only rest frames, before export, preserving joints and skin weights.
rig = body.parent
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for side, handedness in [("Left", 1), ("Right", -1)]:
    bones = rig.data.edit_bones
    prefix = f"mixamorig:{side}Hand"
    forward = bones[prefix + "Middle1"].head - bones[prefix].head
    across = bones[prefix + "Index1"].head - bones[prefix + "Pinky1"].head
    palm_normal = forward.cross(across).normalized() * handedness
    for finger in ["Thumb", "Index", "Middle", "Ring", "Pinky"]:
        for joint in range(1, 4):
            bones[f"{prefix}{finger}{joint}"].align_roll(palm_normal)
bpy.ops.object.mode_set(mode="OBJECT")
parts = [
    ("eyes", "low-poly.mhclo", "Eyes"),
    ("eyebrows", "eyebrow001.mhclo", "Eyebrows"),
    ("eyelashes", "eyelashes01.mhclo", "Eyelashes"),
    ("tongue", "tongue01.mhclo", "Tongue"),
    ("teeth", "teeth_base.mhclo", "Teeth"),
    ("hair", "ponytail01.mhclo", "Hair"),
    ("clothes", "female_sportsuit01.mhclo", "Clothes"),
    ("clothes", "shoes01.mhclo", "Clothes"),
]
for subdir, name, kind in parts:
    HumanService.add_mhclo_asset(
        asset(subdir, name), body, asset_type=kind, material_type="GAMEENGINE",
        subdiv_levels=0,
    )

bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "mpfb-proof-source.blend"))
root = ExportService.create_character_copy(body, name_suffix="_export")
export_body = ObjectService.find_object_of_type_amongst_nearest_relatives(root, "Basemesh")
# glTF with export_morph=False otherwise exports the unshaped Basis, while
# clothes and the rig were fitted to the shaped human. Freeze the evaluated
# modelling keys on the export copy before applying topology-changing masks.
for obj in ObjectService.get_list_of_children(root):
    if obj.type == "MESH" and obj.data.shape_keys:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
ExportService.bake_modifiers_remove_helpers(
    export_body, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=True
)
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for child in ObjectService.get_list_of_children(root):
    child.select_set(True)
bpy.context.view_layer.objects.active = root
for obj in bpy.context.selected_objects:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
bpy.ops.export_scene.gltf(
    filepath=str(args.output / "mpfb-proof.glb"), export_format="GLB",
    use_selection=True, export_animations=False, export_morph=False,
)
rigs = [o for o in bpy.context.selected_objects if o.type == "ARMATURE"]
(args.output / "generation.json").write_text(json.dumps({
    "mpfbVersion": list(mpfb.VERSION), "blenderVersion": bpy.app.version_string,
    "macros": macros, "rig": "mixamo", "assets": parts,
    "bones": {r.name: [b.name for b in r.data.bones] for r in rigs},
}, indent=2))
print("MPFB_PROOF_COMPLETE", args.output)
