"""Check actual Blender vertices against the court and both circulation aisles."""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector, kdtree

ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender/blossom/lantern-garden.blend'))
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
root_water_hits=[]
outline=plan['water']['outline']
def in_water(x,y):
    inside=False
    for a,b in zip(outline,outline[1:]+outline[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside
for obj in bpy.context.scene.objects:
    role=obj.get('blossomRole')
    if obj.type!='MESH' or role not in ('bark','petals','grove-bark','grove-petals','stone','lantern','glow','understory'):
        continue
    tested+=1
    path_hits=set()
    path_examples=[]
    court_hits=0
    water_hits=0
    for vertex in obj.data.vertices:
        p=obj.matrix_world @ vertex.co
        if role in ('bark','grove-bark') and p.z<obj.location.z+1.4 and in_water(p.x,p.y):
            water_hits+=1
        if (envelope['minX']<=p.x<=envelope['maxX'] and envelope['minY']<=p.y<=envelope['maxY']
                and envelope['minZ']+.02<=p.z<=envelope['maxZ']):
            court_hits+=1
        if p.z>4: continue
        for _,sample_index,distance in index.find_n(Vector((p.x,p.y,0)),4):
            sample,width,path_id=samples[sample_index]
            if sample[2]+.25<p.z<sample[2]+2.4 and distance<width+.05:
                path_hits.add(path_id)
                if len(path_examples)<5:path_examples.append([round(v,2) for v in p])
    if court_hits or path_hits:
        failures.append({'object':obj.name,'courtVertices':court_hits,'paths':sorted(path_hits),'examples':path_examples})
    if water_hits:
        root_water_hits.append({'object':obj.name,'rootVerticesInWater':water_hits})
failures.extend(root_water_hits)

# The previous grass batch stopped around 36m, revealing bare outer terrain.
understory=bpy.data.objects['Amphitheatre_Understory']
cover_points=[understory.matrix_world @ v.co for v in understory.data.vertices]
cover_bounds={'minX':min(p.x for p in cover_points),'maxX':max(p.x for p in cover_points),
              'minY':min(p.y for p in cover_points),'maxY':max(p.y for p in cover_points)}
if any(cover_bounds[k]>-68 for k in ('minX','minY')) or any(cover_bounds[k]<68 for k in ('maxX','maxY')):
    failures.append({'groundCoverEndsTooEarly':cover_bounds})
deck=bpy.data.objects['Stage_Planks']
deck_top=max((deck.matrix_world @ vertex.co).z for vertex in deck.data.vertices)
if abs(deck_top-.55)>.0001:failures.append({'stageDeckTop':deck_top})
grades={}
for path in plan['circulation']['paths']:
    grades[path['id']]=max(abs(b[2]-a[2])/math.dist(a[:2],b[:2])*100
                           for a,b in zip(path['centerline'],path['centerline'][1:]) if math.dist(a[:2],b[:2])>.001)
    if grades[path['id']]>5.01:failures.append({'routeGrade':grades[path['id']]})
report={'valid':not failures,'failures':failures,'testedMeshes':tested,'deckTop':deck_top,
        'rootWaterIntersections':root_water_hits,'groundCoverBounds':cover_bounds,
        'maximumRouteGradePercent':grades,'pathHeadroomMetres':2.4,'samplingAllowanceMetres':.05,
        'scope':'Actual mesh vertices; path checks exclude objects below 0.25m above walking grade. Root-water checks cover the first 1.4m above each tree base.'}
output=ROOT/'docs/superpowers/specs/blossom-lantern-garden/evidence/geometry-validation.json'
output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
if failures:raise RuntimeError('Lantern garden clearance audit failed')

