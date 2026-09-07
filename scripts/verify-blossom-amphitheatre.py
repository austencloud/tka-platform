"""Check actual Blender vertices against the court and both circulation aisles."""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector, kdtree

ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/blossom/moonlit-amphitheatre.blend'))
plan=json.loads((ROOT/'static/models/blossom/amphitheatre-plan.json').read_text())
samples=[]
for path in plan['circulation']['paths']:
    for a,b in zip(path['centerline'],path['centerline'][1:]):
        count=max(1,math.ceil(math.dist(a,b)/.1))
        for i in range(count+1):
            t=i/count
            samples.append((tuple(a[j]*(1-t)+b[j]*t for j in range(3)),path['width']/2,path['id']))
index=kdtree.KDTree(len(samples))
for i,(point,_,_) in enumerate(samples):
    index.insert(Vector((point[0],point[1],0)),i)
index.balance()
envelope=plan['stage']['performanceEnvelope']
failures=[]
tested=0
for obj in bpy.context.scene.objects:
    role=obj.get('blossomRole')
    if obj.type!='MESH' or role not in ('bark','petals','grove-bark','grove-petals','stone','lantern','glow','understory'):
        continue
    tested+=1
    path_hits=set()
    court_hits=0
    for vertex in obj.data.vertices:
        p=obj.matrix_world @ vertex.co
        if (envelope['minX']<=p.x<=envelope['maxX'] and envelope['minY']<=p.y<=envelope['maxY']
                and envelope['minZ']+.02<=p.z<=envelope['maxZ']):
            court_hits+=1
        if p.z>4: continue
        for _,sample_index,distance in index.find_n(Vector((p.x,p.y,0)),4):
            sample,width,path_id=samples[sample_index]
            if sample[2]+.25<p.z<sample[2]+2.4 and distance<width+.05:
                path_hits.add(path_id)
    if court_hits or path_hits:
        failures.append({'object':obj.name,'courtVertices':court_hits,'paths':sorted(path_hits)})
deck=bpy.data.objects['Stage_Planks']
deck_top=max((deck.matrix_world @ vertex.co).z for vertex in deck.data.vertices)
if abs(deck_top-.55)>.0001:failures.append({'stageDeckTop':deck_top})
grades={}
for path in plan['circulation']['paths']:
    grades[path['id']]=max(abs(b[2]-a[2])/math.dist(a[:2],b[:2])*100
                           for a,b in zip(path['centerline'],path['centerline'][1:]) if math.dist(a[:2],b[:2])>.001)
    if grades[path['id']]>5.01:failures.append({'routeGrade':grades[path['id']]})
report={'valid':not failures,'failures':failures,'testedMeshes':tested,'deckTop':deck_top,
        'maximumRouteGradePercent':grades,'pathHeadroomMetres':2.4,'samplingAllowanceMetres':.05,
        'scope':'Evaluated mesh vertices; path checks exclude objects below 0.25m above the walking grade.'}
output=ROOT/'docs/superpowers/specs/blossom-amphitheatre/evidence/geometry-validation.json'
output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
if failures:raise RuntimeError('Amphitheatre clearance audit failed')
