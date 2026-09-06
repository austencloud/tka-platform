"""Export Moonlit Blossom's saved Blender source with portable material colors.

Use --factory-startup to avoid unrelated UI addons in the headless export.
"""
from pathlib import Path
import json
import bpy

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'blender/blossom/moonlit-amphitheatre.blend'
OUTPUT=ROOT/'static/models/blossom/blossom_environment_raw.glb'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('blossomRole')]
# Distant instances provide enclosure; casting the entire grove into the
# near-stage shadow map adds cost without useful visible contact shadows.
for obj in objects:
    if obj.name.startswith('Companion_Cherry_Wood_30'):
        obj['blossomRole']='grove-bark'
    elif obj.name.startswith('Companion_Cherry_Blossoms_30'):
        obj['blossomRole']='grove-petals'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',use_selection=True,
    export_extras=True,export_yup=True,export_animations=False,export_lights=False,
    export_cameras=False,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
print(json.dumps({'source':str(SOURCE),'output':str(OUTPUT),'bytes':OUTPUT.stat().st_size,'meshes':len(objects)}))
