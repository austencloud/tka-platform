"""Export authored Sunward Gardens while retaining olive mesh instancing."""
from pathlib import Path
import bpy,json
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/celestial/sunward-gardens.blend'))
buckets={}
for o in bpy.context.scene.objects:
 role=o.get('sunwardRole')
 if o.type!='MESH' or role in {None,'preview','olive','distant-olive','court','scanned-rock'}:continue
 buckets.setdefault((role,tuple(m.name for m in o.data.materials)),[]).append(o)
for (role,_),items in buckets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in items:o.select_set(True)
 bpy.context.view_layer.objects.active=items[0]
 if len(items)>1:bpy.ops.object.join()
 bpy.context.object.name='Sunward_'+role; bpy.context.object['sunwardRole']=role
bpy.ops.object.select_all(action='DESELECT')
runtime=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('sunwardRole') not in {None,'preview'}]
for o in runtime:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'static/models/celestial/sunward-gardens.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animations=False,export_lights=False,export_cameras=False,export_tangents=False)
manifest={'source':'blender/celestial/sunward-gardens.blend','courtRadius':6.08,'courtSurfaceY':.225,'clearRadius':10.2,'meshesBeforeInstancing':len(runtime),'trianglesBeforeInstancing':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in runtime),'oliveCount':sum(o.get('sunwardRole') in {'olive','distant-olive'} for o in runtime),'provenance':'Original Blender geology and planting; reused shipped Meshy olive-west-ancient and olive-east-windswept assets, Poly Haven coast_rocks_05 / sand_rocks_small_01 (CC0). No new external assets.'}
(ROOT/'static/models/celestial/sunward-gardens-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('SUNWARD',json.dumps(manifest),flush=True)
