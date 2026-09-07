"""Add geological hierarchy and a cooled performance plate to the R2 lava world.

Blender 5.0 --background --factory-startup --python scripts/build-ember-geology-stage.py
The six-channel lava asset and original terrain remain the spatial baseline.
"""
from array import array
import hashlib
import json
import math
from pathlib import Path
import random

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'blender/ember-mountain-tributaries-r2.blend'
BLEND = ROOT / 'blender/ember-geology-stage-r1.blend'
RAW = ROOT / 'static/models/ember/ember-geology-stage-r1_raw.glb'
OUT = ROOT / 'docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-geology-stage-r1'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
world = bpy.data.objects['EMBER_WorldRoot']
terrain = bpy.data.objects['EMBER_Terrain']
rng = random.Random(90538)
heights = np.fromfile(ROOT / 'static/data/ember/review/ember-midflank-fire-pilgrimage-r5-height.f32', dtype='<f4').reshape(336,381)


def height(x,z):
    c,r=x+190,z+145
    i,j=min(379,max(0,int(c))),min(334,max(0,int(r)))
    u,v=c-i,r-j
    return float((1-v)*((1-u)*heights[j,i]+u*heights[j,i+1])+v*((1-u)*heights[j+1,i]+u*heights[j+1,i+1]))


def mesh_digest(obj):
    result=hashlib.sha256()
    values=array('f',[0])*(len(obj.data.vertices)*3)
    obj.data.vertices.foreach_get('co',values)
    result.update(values.tobytes())
    for uv in obj.data.uv_layers:
        values=array('f',[0])*(len(uv.data)*2)
        uv.data.foreach_get('uv',values)
        result.update(values.tobytes())
    for colors in obj.data.color_attributes:
        values=array('f',[0])*(len(colors.data)*4)
        colors.data.foreach_get('color',values)
        result.update(values.tobytes())
    result.update(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode())
    result.update(json.dumps([[list(p) for p in path] for path in obj.get('ember_flow_paths',[])]).encode())
    return result.hexdigest()


locked={o.name:mesh_digest(o) for o in bpy.context.scene.objects
        if o.type=='MESH' and o.name!='EMBER_BakedTalus'}
lava=[o for o in bpy.context.scene.objects if o.type=='MESH'
      and (o.name=='EMBER_LavaSimulatorDeposit' or o.get('ember_flow_surface'))]
points=[(v.co.x,0,v.co.z) for o in lava for v in o.data.vertices]
river_tree=KDTree(len(points))
for index,p in enumerate(points):
    river_tree.insert(p,index)
river_tree.balance()


def lava_distance(x,z):
    return river_tree.find((x,0,z))[2]


def mesh(name,vertices,faces,mat,role='midflank-geology',smooth=False):
    data=bpy.data.meshes.new(name+'_Mesh')
    data.from_pydata(vertices,[],faces)
    data.materials.append(mat)
    data.update()
    for p in data.polygons:
        p.use_smooth=smooth
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.parent=world
    obj['tka_role']=role
    return obj


basalt=bpy.data.materials['Ember_Midflank_R5_basalt']
clinker=bpy.data.materials['Ember_Midflank_R5_clinker']
# Long, broken ribs subdivide the slope without inventing another summit or
# raising the ground under any established river or performer.
ribs=[
    dict(name='EMBER_WestErodedRib',x=-58,z=63,width=17,length=53,rise=16,angle=-.20,
         shoulder=(.7,1.4),gully=.30,phase=1.2,
         crest=[(-1,0,.4,.1),(-.65,-.25,.8,.65),(-.2,.18,1,1),(.1,.28,.7,.48),(.48,-.05,.9,.9),(1,.1,.3,.1)]),
    dict(name='EMBER_EastBrokenButtress',x=73,z=27,width=15,length=36,rise=12,angle=.13,
         shoulder=(1.9,.65),gully=.12,phase=3.7,
         crest=[(-1,-.2,.5,.1),(-.5,-.3,1.2,.5),(.05,.1,1.1,1),(.5,.05,.85,.95),(1,.2,.3,.1)]),
    dict(name='EMBER_UpperBasaltFin',x=14,z=142,width=15,length=30,rise=19,angle=.42,
         shoulder=(.6,.95),gully=.08,phase=5.1,
         crest=[(-1,.1,.25,.1),(-.35,-.1,.6,.8),(.1,0,.55,1),(.3,.08,.5,.68),(1,.3,.25,.1)]),
    dict(name='EMBER_LowerRelictRidge',x=-57,z=-79,width=17,length=38,rise=9,angle=.18,
         shoulder=(1.65,1.2),gully=.06,phase=2.4,
         crest=[(-1,-.2,.5,.1),(-.4,.25,1.1,.65),(0,.4,1.3,.8),(.3,.2,1,.5),(.6,-.3,.75,.7),(1,-.3,.3,.1)]),
]


def rib_coords(spec,x,z):
    dx,dz=x-spec['x'],z-spec['z']
    c,s=math.cos(spec['angle']),math.sin(spec['angle'])
    return c*dx-s*dz,s*dx+c*dz


def relief(spec,x,z):
    u,v=rib_coords(spec,x,z)
    along=v/spec['length']
    if abs(along)>=1:
        return 0
    # Separate authored crest profiles give each formation its own broken
    # silhouette: long divided rib, broad buttress, narrow fin, weathered mound.
    profile=spec['crest']
    a,b=next((a,b) for a,b in zip(profile,profile[1:]) if a[0]<=along<=b[0])
    t=(along-a[0])/(b[0]-a[0])
    spine,width,rise=[a[i]+(b[i]-a[i])*t for i in range(1,4)]
    across=(u-spine*spec['width'])/(spec['width']*width)
    exponent=spec['shoulder'][0 if across<0 else 1]
    envelope=max(0,1-abs(across)**exponent-abs(along)**6)
    h=spec['rise']*rise*envelope
    incision=(.5+.5*math.sin(u*.39+spec['phase']+math.sin(v*.087)))**12
    h*=1-spec['gully']*incision
    h*=.94+.06*math.sin(v*.31+u*.19+spec['phase'])
    distance=lava_distance(x,z)
    channel=max(0,min(1,(distance-2.5)/5))
    return h*channel*channel*(3-2*channel)


report={'source':SOURCE.relative_to(ROOT).as_posix(),'lockedMeshDigests':locked,
        'lavaChannels':len(lava),'landforms':ribs,'boulders':[]}
for spec in ribs:
    vertices,faces=[],[]
    extent=spec['length']+spec['width']
    count=math.ceil(extent*2/1.25)
    for j in range(count+1):
        for i in range(count+1):
            x=spec['x']-extent+2*extent*i/count
            z=spec['z']-extent+2*extent*j/count
            if not(-188<x<188 and -143<z<188):
                vertices.append((x,-200,z))
                continue
            h=relief(spec,x,z)
            vertices.append((x,height(x,z)+h-.045,z))
            if i and j:
                k=j*(count+1)+i
                indices=(k-count-2,k-count-1,k,k-1)
                if any(vertices[n][1]-height(vertices[n][0],vertices[n][2])>.01 for n in indices):
                    faces.extend(((indices[0],indices[2],indices[1]),(indices[0],indices[3],indices[2])))
    # Discard the unused grid; only the embedded outcrop is delivered.
    used=sorted({v for face in faces for v in face})
    lookup={old:new for new,old in enumerate(used)}
    mesh(spec['name'],[vertices[v] for v in used],[[lookup[v] for v in f] for f in faces],basalt,smooth=True)

# Retain existing talus where it has a source or a channel to collect against.
# Original connected fragments are selected intact, not sliced through faces.
talus=bpy.data.objects['EMBER_BakedTalus']
data=talus.data
parent=list(range(len(data.vertices)))
def find(v):
    while parent[v]!=v:
        parent[v]=parent[parent[v]]
        v=parent[v]
    return v
for edge in data.edges:
    a,b=edge.vertices
    parent[find(a)]=find(b)
groups={}
for v in data.vertices:
    groups.setdefault(find(v.index),[]).append(v.index)
retained=set()
for indices in groups.values():
    x=sum(data.vertices[i].co.x for i in indices)/len(indices)
    z=sum(data.vertices[i].co.z for i in indices)/len(indices)
    near_rib=any(abs(rib_coords(r,x,z)[0])<r['width']*1.4 and abs(rib_coords(r,x,z)[1])<r['length']*1.2 for r in ribs)
    keep=lava_distance(x,z)<6 or (near_rib and rng.random()<.7) or rng.random()<.1
    if keep:
        retained.update(indices)
indices=sorted(retained)
lookup={old:new for new,old in enumerate(indices)}
replacement=bpy.data.meshes.new('EMBER_GroupedTalus_Mesh')
replacement.from_pydata([data.vertices[i].co[:] for i in indices],[],
                       [[lookup[i] for i in p.vertices] for p in data.polygons if p.vertices[0] in retained])
replacement.materials.append(basalt)
talus.data=replacement
report['talus']={'originalFragments':len(groups),'retainedFragments':sum(bool(set(g)&retained) for g in groups.values())}

# Few large broken blocks and their smaller companions, all grounded and clear
# of channels. One mesh keeps this hierarchy inexpensive in either renderer.
vertices,faces=[],[]
clusters=[(-39,25,3.3),(-78,48,4.5),(51,17,2.5),(88,3,3.5),(-35,-42,2.6),(25,91,4.0)]
for cx,cz,scale in clusters:
    for n in range(7):
        size=scale if n==0 else scale*rng.uniform(.16,.48)
        x=cx+(0 if n==0 else rng.uniform(-7,7))
        z=cz+(0 if n==0 else rng.uniform(-11,3))
        if math.hypot(x,z)<27 or lava_distance(x,z)<size*1.7+3:
            continue
        bm=bmesh.new()
        bmesh.ops.create_icosphere(bm,subdivisions=2,radius=1)
        bm.verts.ensure_lookup_table()
        bm.verts.index_update()
        base=len(vertices)
        angle=rng.random()*math.tau
        for v in bm.verts:
            q=v.co
            rough=.86+rng.random()*.22
            px,pz=q.x*size*rough,q.z*size*.76*rough
            px,pz=math.cos(angle)*px-math.sin(angle)*pz,math.sin(angle)*px+math.cos(angle)*pz
            py=min(q.y,.54+.18*q.x)*size*.95
            vertices.append((x+px,height(x,z)+py+size*.20,z+pz))
        faces.extend(tuple(base+v.index for v in f.verts) for f in bm.faces)
        bm.free()
        report['boulders'].append({'x':x,'z':z,'radius':size})
mesh('EMBER_StructuralBoulderFields',vertices,faces,basalt)

# The clear footing is an old cooled plate, not a new elevated platform.
# The rim follows the existing slope and irregular fracture boundaries.
plate_mat=clinker.copy()
plate_mat.name='Ember_Midflank_R5_cooled-performance-plate'
plate_mat.diffuse_color=(.024,.034,.038,1)
plate_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=plate_mat.diffuse_color
plate_mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.86
outline=[(-6.7,-2.9),(-4.4,-5.2),(2.8,-5.4),(6.5,-2.2),(6.0,3.4),(2.4,5.1),(-3.4,4.8),(-6.8,1.5)]
vertices=[(0,height(0,0)+.02,0)]
faces=[]
segments=64
rings=14
for ring in range(1,rings+1):
    for i in range(segments):
        edge=i*len(outline)/segments
        j=int(edge)
        t=edge-j
        a,b=outline[j],outline[(j+1)%len(outline)]
        x=((1-t)*a[0]+t*b[0])*ring/rings
        z=((1-t)*a[1]+t*b[1])*ring/rings
        vertices.append((x,height(x,z)+.02,z))
        k=1+(ring-1)*segments+i
        nxt=1+(ring-1)*segments+(i+1)%segments
        if ring==1:
            faces.append((0,nxt,k))
        else:
            faces.append((k-segments,nxt-segments,nxt,k))
plate=mesh('EMBER_CooledPerformancePlate',vertices,faces,plate_mat,'playable-surface',True)
plate['ember_safe_action_radius']=4.5
plate['ember_surface_clearance']=.02
report['stage']={'outlineXZ':outline,'maximumSurfaceOffsetMeters':.02,'actionRadiusMeters':4.5,'emissive':False}

# A few ember-bearing fractures stop outside the clear footing. They mark the
# cooled plate's geological edge without drawing a glowing ring around it.
fracture_mat=bpy.data.materials.new('Ember_CooledPlate_PeripheralEmbers')
fracture_mat.use_nodes=True
bsdf=fracture_mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value=(.035,.012,.005,1)
bsdf.inputs['Roughness'].default_value=.95
bsdf.inputs['Emission Color'].default_value=(.25,.038,.001,1)
bsdf.inputs['Emission Strength'].default_value=.9
fractures=[ [(-5.8,2.8),(-6.2,1.5),(-5.6,.8)],
            [(4.6,3.8),(5.7,2.9),(5.9,1.6)],
            [(-3.8,-4.6),(-2.7,-5.0),(-1.2,-4.9)] ]
vertices,faces=[],[]
for path in fractures:
    for a,b in zip(path,path[1:]):
        length=math.dist(a,b)
        for step in range(12):
            t0,t1=step/12,(step+1)/12
            k=len(vertices)
            for t,side in ((t0,-1),(t0,1),(t1,1),(t1,-1)):
                width=.025+.016*math.sin(t*9+1)**2
                x=a[0]+(b[0]-a[0])*t-side*(b[1]-a[1])*width/length
                z=a[1]+(b[1]-a[1])*t+side*(b[0]-a[0])*width/length
                assert math.hypot(x,z)>4.5
                vertices.append((x,height(x,z)+.029,z))
            faces.append((k,k+1,k+2,k+3))
mesh('EMBER_CooledPlatePeripheralFractures',vertices,faces,fracture_mat,'stage-crust-transition')
report['stage']['peripheralFracturesXZ']=fractures

assert len(lava)==6
assert locked=={name:mesh_digest(bpy.data.objects[name]) for name in locked}
for obj in bpy.context.scene.objects:
    obj.select_set(obj==world or (obj.type=='MESH' and not obj.hide_render))
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(RAW),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
report['nativeBlendSha256']=hashlib.sha256(BLEND.read_bytes()).hexdigest()
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ('lockedMeshDigests','boulders')},indent=2))
