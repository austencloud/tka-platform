"""Verify tree count, cutout materials, ground contacts and performer clearance."""
from pathlib import Path
import bpy,json,math
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/celestial/sky-citadel.blend'))
scene=bpy.context.scene
anchors=[o for o in scene.objects if o.get('citadelTreeAnchor')]
trees=[o for o in scene.objects if o.get('sunwardRole')=='ez-tree']
assert len(anchors)==24 and len(trees)==48
assert not any(o.get('sunwardRole')=='olive' for o in scene.objects)
assert len({o.get('ezTreeVariant') for o in anchors})==3
assert all(o.parent in anchors for o in trees)
bpy.context.view_layer.update()
clearance=float('inf')
for tree in trees:
    for vertex in tree.data.vertices:
        p=tree.matrix_world@vertex.co
        clearance=min(clearance,math.hypot(p.x,p.y-1))
assert clearance>10.2,('Tree enters the protected performance area',clearance)
report=json.loads((ROOT/'static/models/celestial/ez-tree-manifest.json').read_text())
assert all(abs(c['soilZ']-c['position'][2]-.04)<1e-5 for c in report['contacts'])
assert any(abs(a.location.x+47)<.01 and abs(a.location.y-24)<.01 for a in anchors)
packed=[image.name for image in bpy.data.images if image.packed_file and ('oak_' in image.name or 'ash_color' in image.name)]
assert len(packed)>=4
result={'trees':len(anchors),'meshParts':len(trees),'variants':3,'minimumPerformerClearance':clearance,'protectedRadius':10.2,'rootBurial':.04,'packedTreeTextures':packed}
print('EZ_TREE_VERIFIED',json.dumps(result),flush=True)
