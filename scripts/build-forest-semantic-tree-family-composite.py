"""Assemble the isolated semantic tree family into one neutral Blender review file."""

import json
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "scripts" / "forest-semantic-tree-family.json").read_text(encoding="utf-8"))
OUTPUT_DIRECTORY = ROOT / MANIFEST["outputDirectory"]
BLEND_PATH = ROOT / "blender" / "candidates" / "forest-semantic-summer-r1.blend"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

positions = [-18.0, 0.0, 17.0]
for candidate, x_position in zip(MANIFEST["candidates"], positions):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUTPUT_DIRECTORY / f"{candidate['id']}_semantic_proof.glb"))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    root = bpy.data.objects.new(f"{candidate['label']}_ReviewRoot", None)
    bpy.context.scene.collection.objects.link(root)
    for obj in imported:
        if obj.parent is None:
            obj.parent = root
    root.location.x = x_position

bpy.ops.mesh.primitive_plane_add(size=75, location=(0.0, 0.0, -0.03))
ground = bpy.context.object
ground.name = "Neutral_Review_Ground"
ground_material = bpy.data.materials.new("Neutral_Review_Ground")
ground_material.diffuse_color = (0.12, 0.15, 0.12, 1.0)
ground.data.materials.append(ground_material)

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
print(BLEND_PATH)
