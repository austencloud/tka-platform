"""Add subordinate downhill lava branches to the approved R2 mountain asset.

Blender 5.0 --background --factory-startup --python scripts/build-ember-tributaries.py
Append -- --distant to extend the R1 network across the distant flanks.
The existing terrain, cooled bench and close river are retained verbatim.
"""
from array import array
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
DISTANT = '--distant' in sys.argv
REVISION = 'r2' if DISTANT else 'r1'
OUT = ROOT / f'docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-tributaries-{REVISION}'
SOURCE = ROOT / ('blender/ember-mountain-tributaries-r1.blend' if DISTANT else 'blender/ember-midflank-lava-flow-r2.blend')
BLEND = ROOT / f'blender/ember-mountain-tributaries-{REVISION}.blend'
RAW = ROOT / f'static/models/ember/ember-mountain-tributaries-{REVISION}_raw.glb'
heights = np.fromfile(ROOT / 'static/data/ember/review/ember-midflank-fire-pilgrimage-r5-height.f32', dtype='<f4').reshape(336,381)


def height(x,z):
    c,r = x+190,z+145
    i,j = min(379,max(0,int(c))),min(334,max(0,int(r)))
    u,v = c-i,r-j
    return float((1-v)*((1-u)*heights[j,i]+u*heights[j,i+1])+v*((1-u)*heights[j+1,i]+u*heights[j+1,i+1]))


def digest(mesh):
    data=array('f',[0])*(len(mesh.vertices)*3)
    mesh.vertices.foreach_get('co',data)
    return hashlib.sha256(data.tobytes()).hexdigest()


def centerline(controls):
    # A sub-metre terrain-conforming ribbon, not a chain of flat tiles.
    z=np.arange(controls[0][1],controls[-1][1]-.01,-.5)
    xs=np.interp(z,[p[1] for p in controls[::-1]],[p[0] for p in controls[::-1]])
    for _ in range(18):
        xs[1:-1]=(xs[:-2]+2*xs[1:-1]+xs[2:])/4
    fade=np.minimum(1,np.minimum(z[0]-z,z-z[-1])/10)
    irregular=fade*(1.6*np.sin(z*.17)+.55*np.sin(z*.47+1))
    for strength in (1,.7,.4,0):
        result=[[float(x),height(x,float(zi)),float(zi)] for x,zi in zip(xs+strength*irregular,z)]
        if all(b[1]<a[1] for a,b in zip(result,result[1:])):
            return result
    raise ValueError('No downhill route through controls')


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
world=bpy.data.objects['EMBER_WorldRoot']
main=bpy.data.objects['EMBER_LavaSimulatorDeposit']
def surface_tree(obj):
    return BVHTree.FromPolygons([v.co for v in obj.data.vertices],[list(p.vertices) for p in obj.data.polygons])

source_surfaces=[surface_tree(o) for o in bpy.context.scene.objects
                 if o.type=='MESH' and (o==main or o.get('ember_flow_surface'))]
existing_paths=[path for o in bpy.context.scene.objects if o.type=='MESH'
                for path in o.get('ember_flow_paths',[])]
locked={o.name:digest(o.data) for o in bpy.context.scene.objects if o.type=='MESH'}
datum=.32
# Branch roots overlap the existing upper river. The outer branch returns to
# the eastern stream; the old west channel is a non-emissive earlier overflow.
specs=[
    dict(name='EMBER_EastDistributary',width=3.0,heat=.64,
         controls=[(-29,108),(-17,94),(1,79),(20,61),(32,43),(35,22),(34,0),(40,-25),(53,-60),(62,-100),(68,-145)]),
    dict(name='EMBER_UpperBraidedBranch',width=1.65,heat=.48,
         controls=[(-33,129),(-19,117),(3,106),(26,87),(48,64),(53,44),(46,21),(36,-6)]),
    dict(name='EMBER_AbandonedOverflow',width=3.6,heat=0,
         controls=[(-24,64),(-37,51),(-51,30),(-58,5),(-53,-24),(-46,-47),(-42,-65)]),
]
if DISTANT:
    specs=[
        dict(name='EMBER_WestDistantFlow',width=3.8,heat=.55,exposure=.85,
             controls=[(-33,129),(-53,111),(-75,82),(-97,43),(-116,0),(-128,-45),(-120,-91),(-110,-145)]),
        dict(name='EMBER_FarEastFlow',width=2.8,heat=.50,exposure=.9,
             controls=[(26,87),(53,76),(80,49),(96,8),(104,-35),(116,-77),(135,-145)]),
        dict(name='EMBER_LowerWestBreakout',width=1.8,heat=.42,exposure=.95,
             source='EMBER_WestDistantFlow',
             controls=[(-116,0),(-139,-28),(-156,-65),(-159,-101),(-153,-145)]),
    ]
report={'source':SOURCE.relative_to(ROOT).as_posix(),'preservedMeshes':locked,'streams':[]}
plan_lines=[]
for spec in specs:
    if spec.get('source'):
        parent_path=bpy.data.objects[spec['source']]['ember_flow_paths'][0]
        root=min(parent_path,key=lambda p:abs(p[2]-spec['controls'][0][1]))
        spec['controls'][0]=(root[0],root[2])
    centers=centerline(spec['controls'])
    root=centers[0]
    root_contact=any(tree.ray_cast(Vector((root[0],300,root[2])),Vector((0,-1,0)))[0] is not None
                     for tree in source_surfaces)
    assert root_contact, (spec['name'],'branch must originate on existing river')
    lengths=[0.]
    for a,b in zip(centers,centers[1:]):
        lengths.append(lengths[-1]+math.dist(a,b))
    rises=[b[1]-a[1] for a,b in zip(centers,centers[1:])]
    print(spec['name'],'maximum step rise',max(rises),'descent',centers[0][1]-centers[-1][1])
    # Tiny DEM roughness may locally interrupt a thin sheet, but a route cannot
    # cross a ridge or climb a sustained grade.
    assert max(rises)<0, (spec['name'],max(rises))
    vertices,faces,weights,uvs=[],[],[],[]
    bank_vertices,bank_faces=[],[]
    across=8
    for i,(x,y,z) in enumerate(centers):
        a,b=centers[max(0,i-1)],centers[min(len(centers)-1,i+1)]
        dx,dz=b[0]-a[0],b[2]-a[2]
        norm=math.hypot(dx,dz)
        nx,nz=-dz/norm,dx/norm
        progress=i/(len(centers)-1)
        width=spec['width']*(.84+.19*math.sin(lengths[i]*.13)+.12*math.sin(lengths[i]*.61+2))
        exposure=spec.get('exposure',0)
        if exposure:
            width*=.85+.35*math.sin(lengths[i]*.047+1)**4
        if spec['heat']==0:
            width*=min(1,(1-progress)*10+.08)
        for j in range(across+1):
            f=2*j/across-1
            bank=(1-abs(f))**.6
            offset=f*width*.5
            px,pz=x+nx*offset,z+nz*offset
            # The bed rests on the terrain; the molten centre sits above its
            # cooled fringe. No exposed vertical box walls.
            py=height(px,pz)+.024+(.065 if spec['heat'] else .014)*bank
            vertices.append((px,py,pz))
            warmth=.67+.23*math.sin(lengths[i]*.073+1)+.1*math.sin(lengths[i]*.23)
            # Fixed cooler reaches interrupt the distant glow while the molten
            # pattern continues travelling underneath, using the same shader.
            warmth*=1-exposure*(.5+.5*math.sin(lengths[i]*.091+2))**3
            weights.append((bank,bank*spec['heat']*warmth,bank*(.06 if exposure else 1),1))
            uvs.append((offset,-lengths[i]))  # exported V=1+distance downhill
            if i and j:
                k=i*(across+1)+j
                faces.append((k-across-2,k-across-1,k,k-1))
        if spec['heat']:
            for side in (-1,1):
                for shoulder in (0,.32,.78):
                    offset=side*(width*.5+shoulder)
                    px,pz=x+nx*offset,z+nz*offset
                    relief=(.035,.13,-.018)[int(round(shoulder/.32))] if shoulder<.7 else -.018
                    relief*=.75+.25*math.sin(lengths[i]*1.3)
                    bank_vertices.append((px,height(px,pz)+relief,pz))
            if i:
                k=i*6
                for j in (0,1,3,4):
                    bank_faces.append((k+j-6,k+j-5,k+j+1,k+j))
    mesh=bpy.data.meshes.new(spec['name']+'_Mesh')
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth=True
    uv=mesh.uv_layers.new(name='FlowMetres')
    for loop in mesh.loops:
        uv.data[loop.index].uv=uvs[loop.vertex_index]
    colors=mesh.color_attributes.new(name='FlowBank',type='FLOAT_COLOR',domain='POINT')
    mesh.color_attributes.active_color=colors
    for i,color in enumerate(weights):
        colors.data[i].color=color
    material=main.data.materials[0].copy()
    material.name=spec['name']+'_Export'
    if not spec['heat']:
        # Cooled history remains rock, not another glowing line.
        material=bpy.data.materials['Ember_Midflank_R5_clinker']
    mesh.materials.append(material)
    obj=bpy.data.objects.new(spec['name'],mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent=world
    obj['tka_role']='secondary-lava' if spec['heat'] else 'cooled-overflow'
    obj['ember_flow_surface']=bool(spec['heat'])
    if bank_vertices:
        bank_mesh=bpy.data.meshes.new(spec['name']+'_Levees_Mesh')
        bank_mesh.from_pydata(bank_vertices,[],bank_faces)
        bank_mesh.materials.append(bpy.data.materials['Ember_Midflank_R5_clinker'])
        bank_obj=bpy.data.objects.new(spec['name']+'_Levees',bank_mesh)
        bpy.context.collection.objects.link(bank_obj)
        bank_obj.parent=world
        bank_obj['tka_role']='cooled-channel-levees'
    if spec['heat']:
        obj['ember_flow_paths']=[[[x,y+datum+.07,z] for x,y,z in centers]]
        obj['ember_flow_paths_space']='world-relative-to-groundY'
        source_surfaces.append(surface_tree(obj))
    clearance=min(math.hypot(v[0],v[2]) for v in vertices)-4.5
    assert clearance>20, (spec['name'],clearance)
    report['streams'].append({**spec,'samples':len(centers),'lengthMeters':lengths[-1],
        'descentMeters':centers[0][1]-centers[-1][1],'maxHalfMetreRise':max(rises),
        'actionEnvelopeClearanceMeters':clearance,'sourceOverlapsExistingRiver':True,'path':centers})
    plan_lines.append((spec['name'],spec['heat'],centers))
assert locked=={name:digest(bpy.data.objects[name].data) for name in locked}
for obj in bpy.context.scene.objects:
    obj.select_set(obj==world or (obj.type=='MESH' and not obj.hide_render))
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(RAW),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
report['nativeBlendSha256']=hashlib.sha256(BLEND.read_bytes()).hexdigest()
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#191d20"/><g font-family="sans-serif" fill="#eee"><text x="30" y="35" font-size="23">Ember — connected mountain flows</text><text x="30" y="63" font-size="15">Authored downhill branches · terrain and performance bench retained</text>']
def polyline(points,color,width):
    coords=' '.join(f'{400+p[0]*1.8:.1f},{400-p[2]*1.8:.1f}' for p in points)
    return f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'
for path in existing_paths:
    svg.append(polyline(path,'#ff902e',4))
for name,heat,path in plan_lines:
    svg.append(polyline(path,'#f36528' if heat else '#746b64',3 if heat else 5))
legend=('Orange: existing active network · red: new distant branches' if DISTANT else
        'Orange: existing close river · red: subordinate active branches')
orientation=('Cold overflow omitted · north/uphill at top · scale 1.8 px/m' if DISTANT else
             'Grey: cooled western overflow · north/uphill at top · scale 1.8 px/m')
svg.append(f'<circle cx="400" cy="400" r="8.1" fill="#a9c7cf"/><text x="415" y="404" font-size="14">4.5 m action envelope</text><text x="30" y="715" font-size="15">{legend}</text><text x="30" y="742" font-size="15">{orientation}</text><text x="30" y="770" font-size="15">Active outflows continue through the south scene boundary.</text></g></svg>')
(OUT/'measured-flow-plan.svg').write_text(''.join(svg),encoding='utf8')
