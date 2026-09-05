"""Replace the R5 cell boxes with a continuous skin and bake raft trajectories.

Run with Blender --background --factory-startup --python this-file.
The approved mountain, bench, talus and scientific reference stay untouched.
"""
from array import array
import hashlib
import json
import math
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "blender/ember-midflank-production-r5.blend"
OUT = ROOT / "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-lava-flow-r1"
BLEND = ROOT / "blender/ember-midflank-lava-flow-r1.blend"
RAW = ROOT / "static/models/ember/ember-midflank-lava-flow-r1_raw.glb"
SPEC = ROOT / "docs/superpowers/specs/ember-spatial-directions"
contract = json.loads((SPEC / "evidence/gate-2-geology-graybox-r5/ember-midflank-fire-pilgrimage-r5-coordinate-manifest.json").read_text())
heights = np.fromfile(ROOT / contract["terrain"]["dataPath"], dtype="<f4").reshape(336,381)
thickness = np.fromfile(ROOT / contract["sourceAuthority"]["simulatorDepositSource"], dtype="<f4").reshape(336,381)


def height(x,z):
    col,row = x+190,z+145
    i,j = min(379,max(0,int(col))),min(334,max(0,int(row)))
    u,v = col-i,row-j
    return float((1-v)*((1-u)*heights[j,i]+u*heights[j,i+1])+v*((1-u)*heights[j+1,i]+u*heights[j+1,i+1]))


def digest(mesh):
    positions = array('f',[0])*(len(mesh.vertices)*3)
    mesh.vertices.foreach_get('co',positions)
    return hashlib.sha256(positions.tobytes()).hexdigest()


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
terrain = bpy.data.objects['EMBER_Terrain']
reference = bpy.data.objects['EMBER_SimulatorReference']
locked = {o.name:digest(o.data) for o in (terrain,reference)}
old = bpy.data.objects['EMBER_LavaSimulatorDeposit']
world,mat = old.parent,old.data.materials[0]
count = int(old['ember_registered_top_face_count'])
# Weld only the top faces by their grid corner. Never retain box walls or bottoms.
keys,verts,sums,faces = {},[],[],[]
for face in list(reference.data.polygons)[:count]:
    indices=[]
    for vi in face.vertices:
        p=reference.data.vertices[vi].co
        key=(round(p.x,4),round(p.z,4))
        if key not in keys:
            keys[key]=len(verts)
            verts.append((p.x,p.y,p.z))
            sums.append([])
        index=keys[key]
        sums[index].append(p.y)
        indices.append(index)
    faces.append(indices)
verts=[(p[0],sum(sums[i])/len(sums[i]),p[2]) for i,p in enumerate(verts)]
mesh=bpy.data.meshes.new('EmberContinuousFlowSkin')
mesh.from_pydata(verts,[],faces)
mesh.materials.append(mat)
mesh.update()
bm=bmesh.new()
bm.from_mesh(mesh)
for v in bm.verts:
    if v.is_boundary:
        v.co.y=height(v.co.x,v.co.z)+.025
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(mesh)
bm.free()
bpy.data.objects.remove(old,do_unlink=True)
bpy.data.objects.remove(bpy.data.objects['EMBER_BakedLavaClinker'],do_unlink=True)
surface=bpy.data.objects.new('EMBER_LavaSimulatorDeposit',mesh)
bpy.context.collection.objects.link(surface)
surface.parent=world
bpy.context.view_layer.objects.active=surface
surface.select_set(True)
sub=surface.modifiers.new('Rounded connected banks','SUBSURF')
sub.levels=2
sub.render_levels=2
bpy.ops.object.modifier_apply(modifier=sub.name)
# The rim meets the unchanged mountain, instead of exposing a vertical extrusion.
bm=bmesh.new()
bm.from_mesh(surface.data)
boundary_count=0
bank_points=[]
for v in bm.verts:
    if v.is_boundary:
        v.co.y=height(v.co.x,v.co.z)+.025
        boundary_count+=1
        bank_points.append((v.co.x,0,v.co.z))
    else:
        v.co.y=max(v.co.y,height(v.co.x,v.co.z)+.035)
bm.to_mesh(surface.data)
bm.free()
for face in surface.data.polygons:
    face.use_smooth=True
surface.data.update()


def intervals(z):
    row=min(335,max(0,int(round(z+145))))
    occupied=np.flatnonzero(thickness[row]>.01)
    groups=np.split(occupied,np.where(np.diff(occupied)>1)[0]+1)
    return [(float(g[0]-190-.5),float(g[-1]-190+.5)) for g in groups if len(g)>1]


# Across-channel coordinates bend with the measured deposit; longitudinal UV is
# metres downhill. This is also the domain used by the moving thermal pattern.
uv=surface.data.uv_layers.new(name='FlowMetres')
for loop in surface.data.loops:
    p=surface.data.vertices[loop.vertex_index].co
    spans=intervals(p.z)
    left,right=min(spans,key=lambda s:abs((s[0]+s[1])*.5-p.x)) if spans else (p.x-1,p.x+1)
    centers=[]
    for offset in (-2,-1,0,1,2):
        neighbours=intervals(p.z+offset)
        if neighbours:
            span=min(neighbours,key=lambda s:abs((s[0]+s[1])*.5-p.x))
            centers.append((span[0]+span[1])*.5)
    uv.data[loop.index].uv=(p.x-sum(centers)/len(centers) if centers else p.x,-p.z)
bank_tree=KDTree(len(bank_points))
for index,p in enumerate(bank_points):
    bank_tree.insert(p,index)
bank_tree.balance()
bank_color=surface.data.color_attributes.new(name='FlowBank',type='FLOAT_COLOR',domain='POINT')
surface.data.color_attributes.active_color=bank_color
for v in surface.data.vertices:
    distance=bank_tree.find((v.co.x,0,v.co.z))[2]
    weight=min(1,distance/.8)
    bank_color.data[v.index].color=(weight,weight,weight,1)
# glTF's material-driven exporter otherwise emits a white placeholder COLOR_0
# and puts this mask in COLOR_1, which the runtime shader does not consume.
flow_material=mat.copy()
flow_material.name='Ember_FlowBank_Export'
color_node=flow_material.node_tree.nodes.new('ShaderNodeVertexColor')
color_node.layer_name='FlowBank'
principled=next(n for n in flow_material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
flow_material.node_tree.links.new(color_node.outputs['Color'],principled.inputs['Base Color'])
surface.data.materials[0]=flow_material
surface['ember_flow_surface']=True
surface['tka_role']='midflank-lava'

# Bake narrow drifting lanes by sampling the finished surface, not by guessing
# a height in the browser. Misses split a path; rafts never bridge a dry gap.
tree=BVHTree.FromPolygons([v.co for v in surface.data.vertices],[list(p.vertices) for p in surface.data.polygons])
paths=[]
for fraction in (-.56,0,.56):
    path=[]
    previous=None
    for z in np.arange(132,-144,-.5):
        spans=intervals(z)
        if not spans:
            continue
        left,right=min(spans,key=lambda s:abs((s[0]+s[1])*.5-previous)) if previous is not None else max(spans,key=lambda s:s[1]-s[0])
        center=(left+right)*.5
        previous=center
        x=center+fraction*max(0,(right-left)*.5-.9)
        hit=tree.ray_cast(Vector((x,300,z)),Vector((0,-1,0)))[0]
        if hit is None or (path and (hit-Vector(path[-1])).length>3):
            if len(path)>20:
                paths.append(path)
            path=[]
        if hit is not None:
            path.append([round(float(v),5) for v in hit])
    if len(path)>20:
        paths.append(path)
datum=.5-contract['terrain']['performerElevationMeters']
surface['ember_flow_paths']=[[[p[0],round(p[1]+datum,5),p[2]] for p in path] for path in paths]
surface['ember_flow_paths_space']='world-relative-to-groundY'

# One thin, irregular authored plate is instanced by the runtime; no fixed rocks
# remain on the channel. The template is hidden before the first runtime frame.
plate_verts=[]
for y,scale in ((0,1),(.055,.86)):
    for k in range(9):
        a=k*math.tau/9
        radius=(.48+.085*math.sin(k*7.3))*scale
        plate_verts.append((math.cos(a)*radius,y,math.sin(a)*radius*.72))
plate_faces=[tuple(range(9,18))]+[(k,(k+1)%9,(k+1)%9+9,k+9) for k in range(9)]
plate_mesh=bpy.data.meshes.new('EmberFloatingCrustPlate')
plate_mesh.from_pydata(plate_verts,[],plate_faces)
plate_mesh.materials.append(bpy.data.materials['Ember_Midflank_R5_clinker'])
plate=bpy.data.objects.new('EMBER_FloatingCrustTemplate',plate_mesh)
bpy.context.collection.objects.link(plate)
plate.parent=world
plate['tka_role']='runtime-crust-template'
plate.location.y=0

keep=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render and o!=reference]
for o in (surface,plate):
    if o not in keep:
        keep.append(o)
for obj in bpy.context.scene.objects:
    obj.select_set(obj in keep or obj==world)
    if obj.type=='MESH':
        obj.hide_render=obj not in keep
assert locked=={o.name:digest(o.data) for o in (terrain,reference)}
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(RAW),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
report={'source':str(SOURCE.relative_to(ROOT)),'preservedMeshes':locked,'sourceTopCells':count,'flowVertices':len(surface.data.vertices),'flowFaces':len(surface.data.polygons),'roundedBoundaryVertices':boundary_count,'paths':len(paths),'pathSamples':sum(len(p) for p in paths),'fixedChannelClinkerRemoved':True,'terrainAndBenchUnchanged':True,'surfaceTreatment':'Welded top-only Catmull-Clark skin, two subdivisions; bank vertices meet original terrain. Original scientific reference is retained, not rendered.','nativeBlendSha256':hashlib.sha256(BLEND.read_bytes()).hexdigest()}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps(report,indent=2))
