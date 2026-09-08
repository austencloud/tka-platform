"""Export the editable Blue Hour Lodge source; Blender owns all static scenery."""
from pathlib import Path
import bpy
import json
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'static/models/winter'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/winter/blue-hour-lodge.blend'))
scene=bpy.context.scene
# Merge built architecture by material, preserving conifer mesh reuse for
# EXT_mesh_gpu_instancing and separate semantic groups for runtime controls.
runtime=[o for o in scene.objects if o.type=='MESH' and o.get('bluehourRole') not in {None,'preview'}]
buckets={}
for o in runtime:
    if o.get('bluehourRole') in {'conifer','rock'}: continue
    buckets.setdefault((o.get('bluehourRole'),tuple(m.name for m in o.data.materials)),[]).append(o)
for (role,_),items in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in items: o.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1: bpy.ops.object.join()
    o=bpy.context.object; o.name='BlueHour_'+role+'_'+str(len(o.data.vertices)); o['bluehourRole']=role
bpy.ops.object.select_all(action='DESELECT')
runtime=[o for o in scene.objects if o.type=='MESH' and o.get('bluehourRole') not in {None,'preview'}]
for o in runtime: o.select_set(True)
# Let Three.js derive tangent frames from UVs. Exported tangents on this mixed
# scanned/authored asset corrupt the production HDR bloom output on this GPU;
# normal maps and derivative tangent frames render correctly in both backends.
bpy.ops.export_scene.gltf(filepath=str(OUT/'blue-hour-lodge.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animations=False,export_lights=False,export_cameras=False,export_tangents=False)
manifest={'source':'blender/winter/blue-hour-lodge.blend','courtRadius':7.7,'courtHeight':.45,'meshesBeforeInstancing':len(runtime),'trianglesBeforeInstancing':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in runtime),'trees':sum(o.get('bluehourRole')=='conifer' for o in runtime),'runtimePond':{'x':16,'z':-10,'y':.15},'chimney':[ -14,9.1,-21 ],'hearth':[-13,.4,-4]}
(OUT/'blue-hour-lodge-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('BLUEHOUR',json.dumps(manifest),flush=True)


