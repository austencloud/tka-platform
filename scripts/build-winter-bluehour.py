"""Author Blue Hour Lodge in Blender; reuse the shipped Winter conifer family.

Run with Blender --background --factory-startup --threads 8 --python this-file.
The editable source is saved before export batching. No runtime effects are baked.
"""
from pathlib import Path
import bpy
import math
import random
import json
import os
from mathutils import Vector, Matrix
from mathutils.noise import noise_vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'static/models/winter'
SOURCE = ROOT / 'blender/winter/blue-hour-lodge.blend'
EVIDENCE = Path(os.environ.get('TKA_WINTER_EVIDENCE', str(ROOT / '.winter-evidence')))
rng = random.Random(90526)
EVIDENCE.mkdir(parents=True, exist_ok=True)
SOURCE.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Bring across the original, already shipped tree and scanned rock materials.
library = Path(os.environ.get('TKA_WINTER_SOURCE', str(ROOT / 'blender/winter_environment.blend')))
with bpy.data.libraries.load(str(library)) as (src, dst):
    wanted = ['Winter_Base_Near_middle_fir_000', 'Winter_Base_Near_lush_pine_002',
              'Winter_Base_Near_mature_spruce_011', 'Winter_Base_Near_young_sapling_001',
              'Winter_Base_PondBoulder_01_WinterBoulder_boulder_01',
              'Winter_Base_DeadwoodRock_01_WinterRock_rock_07']
    dst.objects = [n for n in wanted if n in src.objects]
templates = []
for obj in dst.objects:
    scene.collection.objects.link(obj)
    # Normalize in the source's local geometry frame, preserving the silhouette.
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    lo = Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
    hi = Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
    center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
    for v in obj.data.vertices: v.co = (v.co-center) / (hi.z-lo.z)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    dec = obj.modifiers.new('Distance-conscious source detail', 'DECIMATE')
    dec.ratio = .5 if 'Boulder' not in obj.name else .18
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for polygon in obj.data.polygons: polygon.use_smooth=True
    obj.select_set(False)
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes: continue
        p = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if p:
            p.inputs['Emission Strength'].default_value = 0
            for link in list(p.inputs['Emission Color'].links): mat.node_tree.links.remove(link)
            p.inputs['Roughness'].default_value = .85
    templates.append(obj)
    scene.collection.objects.unlink(obj)

def material(name, color, rough=.8, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m

snow = material('Wind packed snow', (.72,.81,.87), .9)
snow_high = material('Fresh roof snow', (.85,.91,.95), .86)
stone = material('Blue grey mountain granite', (.26,.32,.38), .95)
stone_light = material('Split granite pavers', (.32,.37,.4), .83)
wood = material('Honey larch end grain', (.27,.115,.043), .73)
wood_light = material('Oiled larch beams', (.42,.22,.085), .66)
charcoal = material('Charred timber and standing seam zinc', (.026,.04,.049), .68, .1)
brass = material('Aged bronze details', (.34,.20,.078), .36, .6)
window = material('Warm interior glazing', (.32,.21,.105), .17, .18, .06)
window.surface_render_method='DITHERED'
window.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.26
interior = material('Warm interior plaster', (.72,.43,.2), .9, 0, .22)
light = material('Lantern opal', (1,.57,.21), .4, 0, 3)
ice = material('Blue Hour frozen tarn preview', (.14,.29,.38), .25, .08)
court = material('Cleared slate court', (.16,.21,.24), .71)

# Use the Winter snow set already shipped under ambientCG's CC0 license.
for m in [snow,snow_high]:
    m['surfaceUVMetres']=3.5
    nodes=m.node_tree.nodes; links=m.node_tree.links
    p=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(str(ROOT/'static/textures/winter/snow-albedo.jpg'),check_existing=True)
    links.new(tex.outputs['Color'],p.inputs['Base Color'])
    normal=nodes.new('ShaderNodeTexImage'); normal.image=bpy.data.images.load(str(ROOT/'static/textures/winter/snow-normal.jpg'),check_existing=True)
    normal.image.colorspace_settings.name='Non-Color'
    bump=nodes.new('ShaderNodeNormalMap'); bump.inputs['Strength'].default_value=.24
    links.new(normal.outputs['Color'],bump.inputs['Color']); links.new(bump.outputs['Normal'],p.inputs['Normal'])

def mesh(name, vertices, faces, mat, role='venue', smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    o['bluehourRole'] = role
    for p in data.polygons: p.use_smooth = smooth
    return o

def box(name, at, size, mat, bevel=0, role='venue'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    o['bluehourRole'] = role
    if bevel:
        m=o.modifiers.new('Soft crafted edges','BEVEL'); m.width=bevel; m.segments=2
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def beam(name, a, b, width, mat, depth=None):
    a,b=Vector(a),Vector(b)
    o=box(name,(a+b)*.5,(width,depth or width,(b-a).length),mat,.012)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def ribbon(name, coords, width, mat, role='venue'):
    verts=[]
    for i,p in enumerate(coords):
        tangent=Vector(coords[min(i+1,len(coords)-1)])-Vector(coords[max(0,i-1)])
        side=Vector((-tangent.y,tangent.x,0)).normalized()*width/2
        verts.extend([Vector(p)+side,Vector(p)-side])
    return mesh(name,verts,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(coords)-1)],mat,role)

def terrain_z(x,y):
    d=math.hypot(x,y)
    clear=max(0,min(1,(d-8.7)/12))
    waves=.9+.75*math.sin(x*.074+y*.025)+.6*math.cos(y*.113-x*.016)
    foothills=max(0,(abs(x)-35)/45)**1.4*3+max(0,(y-35)/60)*5
    value=clear*(waves+foothills)
    # The tarn is cut into the snow, and the lodge has a grounded level shelf.
    basin=((x-16)/7)**2+((y-10)/5.4)**2
    if basin<1.2: value=min(value,-.25+max(0,basin-.6)*2)
    if -20<x<6 and 10<y<25: value=min(value,.15)
    if -18<x<-9 and -1<y<9: value=min(value,.08)
    return value

N=180; span=360
verts=[]
for j in range(N+1):
    for i in range(N+1):
        x=(i/N-.5)*span; y=(j/N-.5)*span
        verts.append((x,y,terrain_z(x,y)))
faces=[]
for j in range(N):
    for i in range(N):
        k=j*(N+1)+i; faces.append((k,k+1,k+N+2,k+N+1))
mesh('Sculpted alpine basin',verts,faces,snow,'terrain',True)

# Continuous irregular ridgelines, with snow settling by slope and elevation.
for ridge,(cy,height,depth) in enumerate([(102,25,58),(182,46,85),(-136,29,58)]):
    verts=[]; nx=160; ny=34
    for j in range(ny+1):
        t=j/ny
        for i in range(nx+1):
            x=(i/nx-.5)*420
            peak=height*(.62+.22*math.sin(x*.039+ridge)+.18*math.sin(x*.082+1.1)+.12*math.cos(x*.151))
            spine=.48+.08*math.sin(x*.055)
            profile=max(0,1-abs(t-spine)/.53)
            y=cy+(t-.5)*depth
            z=2+peak*profile**1.35+noise_vector(Vector((x*.045,y*.04,2+ridge))).z*profile*1.7
            verts.append((x,y,z))
    faces=[]
    for j in range(ny):
        for i in range(nx):
            k=j*(nx+1)+i
            faces.extend([(k,k+1,k+nx+1),(k+1,k+nx+2,k+nx+1)])
    mountain=mesh(f'Glacial ridge {ridge}',verts,faces,stone,'mountain',True)
    mountain.data.materials.append(snow_high)
    for p in mountain.data.polygons:
        p.material_index=1 if p.normal.z>.67 and p.center.z>height*.22 else 0

# An open performance court meets a wider paved forecourt and a gentle arrival.
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=7.7,depth=.45,location=(0,0,.225))
o=bpy.context.object; o.name='Level slate performance court'; o.data.materials.append(court); o['bluehourRole']='court'
# Cut-stone sectors give the floor readable scale without distracting markings.
slates=[material(f'Court slate {i}',(.19+i*.016,.245+i*.015,.28+i*.014),.79) for i in range(4)]
for ring in range(9):
    inner=ring*.85+.014; outer=min(7.69,(ring+1)*.85-.014)
    segments=max(8,round(math.tau*(inner+outer)/2/1.1))
    for k in range(segments):
        a=(k/segments)*math.tau+.5*(ring%2)*math.tau/segments
        b=a+math.tau/segments-.004
        vs=[(math.cos(t)*r,math.sin(t)*r,.454) for r,t in [(inner,a),(outer,a),(outer,b),(inner,b)]]
        mesh('Cut slate sector',vs,[(0,1,2,3)],slates[(ring+k)%4],'court')
ribbon('Level arrival ramp',[(0,-11,.1),(0,-7.4,.45)],2.8,stone_light)
for i in range(-10,11):
    for j in range(8,13):
        box('Forecourt paving',(i*.9,j*.83,.24),(.87,.8,.4),stone_light,.025)
for i in range(28):
    y=-9-i*.95; x=math.sin(i*.09)*2.6
    box('Arrival path slab',(x,y,terrain_z(x,y)+.09),(2.8,.9,.16),stone_light,.035)

# The longhouse has one generous gable, deep eaves, structural ribs, and a
# sheltered promenade looking directly onto the gathering ground.
cx=-6; front=14; back=24; half=12; eave=3.35; ridge=9.6
box('Lodge stone plinth',(cx,19,.4),(25,12,.8),stone,.08)
box('Lodge rear wall',(cx,back-.1,2.05),(24,.28,3.3),charcoal,.03)
box('Interior amber wall',(cx,back-.28,2.1),(23.7,.08,3),interior,.02)
box('Interior floor',(cx,19,.85),(23.7,9.7,.1),wood,.02)
for xx in [-14,-6,2]:
    box('Reading sofa',(xx,20,1.25),(3,1.1,.6),wood,.12)
    box('Reading sofa back',(xx,20.5,1.75),(3,.22,.9),interior,.08)
    box('Low gathering table',(xx,18.2,1.15),(2,.85,.14),wood_light,.06)
    for dx in [-.8,.8]: box('Table foot',(xx+dx,18.2,.99),(.08,.5,.25),charcoal,.015)
    beam('Pendant cable',(xx,18,3.4),(xx,18,6),.018,charcoal)
    box('Pendant diffuser',(xx,18,3.4),(1.1,.5,.12),light,.04,'lantern')
for y in [front,back]:
    mesh('Gable glazing' if y==front else 'Gable timber',[(cx-half,y,.8),(cx+half,y,.8),(cx+half,y,eave),(cx,y,ridge),(cx-half,y,eave)],[(0,1,2,3,4)],window if y==front else wood,'window' if y==front else 'venue')
for side in [-1,1]:
    x=cx+side*half
    box('Longhouse side wall',(x,19,2.05),(.25,10,2.5),wood,.025)
    points=[(cx,front-1.6,ridge+.2),(x+side*1.3,front-1.6,eave),(x+side*1.3,back+1.1,eave),(cx,back+1.1,ridge+.2)]
    roof=mesh('Snow loaded roof',points,[(0,1,2,3)],snow_high,'roof')
    solid=roof.modifiers.new('Snow over standing seam','SOLIDIFY'); solid.thickness=.32
    bpy.context.view_layer.objects.active=roof; bpy.ops.object.modifier_apply(modifier=solid.name)
    beam('Roof fascia',points[0],points[1],.27,charcoal,.42)
    beam('Eave fascia',points[1],points[2],.25,charcoal,.42)
    # Fine snow rails and zinc seams articulate the large roof surface.
    for yy in range(14,25,2):
        beam('Roof seam',(cx,yy,ridge+.27),(x+side*1.2,yy,eave+.12),.033,charcoal)
for x in range(-18,7,2):
    top=eave+(ridge-eave)*(1-abs(x-cx)/half)
    beam('Larch facade mullion',(x,front-.14,.78),(x,front-.14,top),.13,wood_light,.2)
    if -16<=x<=4:
        beam('Promenade column',(x,front-1.3,.55),(x,front-1.3,max(eave,top-.6)),.2,wood_light)
beam('Facade crossbeam',(-18,front-.23,3.1),(6,front-.23,3.1),.21,wood_light)
beam('Gable left truss',(-18,front-.3,eave),(cx,front-.3,ridge),.25,wood_light)
beam('Gable right truss',(cx,front-.3,ridge),(6,front-.3,eave),.25,wood_light)
for x in [-14,-6,2]:
    box('Door dark reveal',(x,front-.21,1.72),(1.6,.18,2.0),charcoal,.02)
    box('Door warm inset',(x,front-.32,1.85),(1.26,.035,1.55),window,.01,'window')
    beam('Bronze door handle',(x+.48,front-.4,1.4),(x+.48,front-.4,1.9),.035,brass)
for k in range(3):
    box('Wide approach step',(cx,12.3-k*.55,.64-k*.16),(24,.62,.18),stone_light,.025)
for i in range(100):
    x=-18+i*.24
    box('Promenade larch board',(x,13.4,.82),(.226,2.2,.1),wood_light if i%5 else wood,.005)
# End-grain slatted benches create gathering pockets away from the floor.
for x,y,angle in [(-11,2,.3),(-14,6,-.2),(10,5,-.5),(8.5,10,0),(-12,10,0)]:
    for d in [-.22,0,.22]:
        o=box('Bench seat',(x,y+d,.74),(2.8,.2,.12),wood_light,.025)
        o.rotation_euler.z=angle
    for dx in [-1,1]: box('Bench granite foot',(x+dx,y,.34),(.3,.72,.65),stone,.03)
box('Copper chimney',(-14,21,7.3),(.7,.85,3.5),charcoal,.04)
box('Chimney cap',(-14,21,9.08),(1,1.12,.15),brass,.03)

def lantern(x,y,height=.85):
    z=terrain_z(x,y)
    box('Lantern footing',(x,y,z+.08),(.42,.42,.16),stone,.035)
    box('Lantern housing',(x,y,z+height/2),(.22,.22,height),charcoal,.02)
    box('Lantern warm slit',(x,y-.116,z+height-.18),(.15,.014,.3),light,.005,'lantern')
    box('Lantern snow cap',(x,y,z+height+.04),(.3,.3,.09),snow_high,.04)
for x,y in [(-3,-10),(4,-17),(5,-25),(-11,9),(8,9),(12,2),(-14,1),(22,8)]: lantern(x,y)

# A small shore deck connects the promenade to the frozen tarn.
for k in range(15): box('Tarn overlook board',(10.1+k*.28,8.1,.46),(.264,2.25,.16),wood_light,.008)
for x in [10,12,14]:
    beam('Tarn deck pier',(x,8.8,-.5),(x,8.8,.43),.16,charcoal)

def place_template(template, name, x,y,height,role='conifer',tier='Base'):
    obj=template.copy(); obj.data=template.data
    obj.name=f'Winter_{tier}_{name}'
    scene.collection.objects.link(obj)
    obj.location=(x,y,terrain_z(x,y)-height*(.22 if role=='rock' else .035))
    obj.scale=(height,height,height)
    obj.rotation_euler=(0,0,rng.uniform(0,math.tau))
    obj['bluehourRole']=role
    # Old composer IDs describe the old placements; do not apply them here.
    for key in list(obj.keys()):
        if key.startswith('tka_'): del obj[key]
    return obj

# Mixed-age stands follow the basin shoulders, with clear entry and lake views.
tree_positions=[]
for cluster,(x,y,n) in enumerate([(-27,4,9),(-30,29,10),(-13,36,7),(10,34,7),(30,23,10),(34,-8,7),(-24,-25,7),(27,-31,6),(-53,53,11),(48,56,11),(-62,-51,9),(65,-57,9)]):
    for k in range(n):
        xx=x+rng.uniform(-7,7); yy=y+rng.uniform(-7,7)
        if any(math.hypot(xx-a,yy-b)<3.6 for a,b in tree_positions): continue
        tree_positions.append((xx,yy))
        family=rng.randrange(4)
        h=rng.uniform(3.1,5.5) if family==3 else rng.uniform(8,15)
        place_template(templates[family],f'Alpine_fir_{cluster}_{k}',xx,yy,h,tier='Base' if cluster<8 else 'Medium')
for i,(x,y,h) in enumerate([(-20,-12,13),(31,-20,12),(-27,18,15),(27,18,14),(-17,34,12),(18,28,10)]):
    place_template(templates[i%3],f'Hero_fir_{i}',x,y,h)
# Keep complete canopies outside the longhouse, not just their trunk origins.
bpy.context.view_layer.update()
for tree in [o for o in scene.objects if o.get('bluehourRole')=='conifer']:
    corners=[tree.matrix_world @ Vector(c) for c in tree.bound_box]
    lo_x=min(c.x for c in corners); hi_x=max(c.x for c in corners)
    lo_y=min(c.y for c in corners); hi_y=max(c.y for c in corners)
    if hi_x>-19 and lo_x<7 and hi_y>13 and lo_y<25:
        shifts=[(-19.5-hi_x,0),(7.5-lo_x,0),(0,12.5-hi_y),(0,25.5-lo_y)]
        dx,dy=min(shifts,key=lambda p:abs(p[0])+abs(p[1]))
        tree.location.x+=dx; tree.location.y+=dy
        tree.location.z=terrain_z(tree.location.x,tree.location.y)-tree.scale.z*.035

for i,(x,y,h) in enumerate([(25,16,1.8),(26,8,1.3),(12,20,1),(22,2,1.2),(-20,7,1.8),(-18,-8,1.2),(31,-15,2.4)]):
    boulder=place_template(templates[4+i%2],f'Glacial_boulder_{i}',x,y,h,'rock')
    boulder.data.materials.clear(); boulder.data.materials.append(stone)

# Seat scans against the triangulated terrain, including the cut pond banks.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
basin_mesh=bpy.data.objects['Sculpted alpine basin'].data
basin_bvh=BVHTree.FromPolygons([v.co for v in basin_mesh.vertices], [p.vertices[:] for p in basin_mesh.polygons])
for boulder in [o for o in scene.objects if o.get('bluehourRole')=='rock']:
    gaps=[]
    for vertex in boulder.data.vertices:
        point=boulder.matrix_world @ vertex.co
        hit,_,_,_=basin_bvh.ray_cast(Vector((point.x,point.y,1000)),Vector((0,0,-1)))
        if hit is not None: gaps.append(point.z-hit.z)
    if gaps:
        gaps.sort()
        boulder.location.z-=gaps[int(len(gaps)*.12)]

# Runtime owns this pond; the preview surface is only for Blender reviews.
pondverts=[(16,10,.15)]
for i in range(65):
    a=i/64*math.tau; wobble=1+.08*math.sin(3*a+2.6)+.04*math.cos(5*a-1.82)
    pondverts.append((16+math.cos(a)*6*wobble,10+math.sin(a)*4.4*wobble,.15))
mesh('REVIEW frozen tarn',pondverts,[(0,i+1,i+2) for i in range(64)],ice,'preview')

# Hearth is a crafted bronze bowl; its fire stays in the shared volumetric owner.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=12,radius=1,location=(-13,4,.15))
o=bpy.context.object; o.name='Bronze hearth bowl'; o.scale=(1.05,1.05,.32); o.data.materials.append(charcoal); o['bluehourRole']='venue'
for i in range(9):
    a=i*2.4
    beam('Hearth split fuel',(-13+math.cos(a)*.62,4+math.sin(a)*.62,.37),(-13-math.cos(a)*.65,4-math.sin(a)*.65,.5),.14,wood)

def area(name,at,target,power,color,size):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
    o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=at; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Cool moon',(-25,-10,40),(0,0,0),6500,(.62,.78,1),22)
area('Open sky',(20,-5,28),(0,10,0),4300,(.49,.69,1),30)
area('Lodge warmth',(-6,12,5),(-6,0,0),2200,(1,.46,.17),14)
for xx in [-14,-6,2]: area('Interior pendant',(xx,18,4),(xx,19,0),180,(1,.61,.29),2)
scene.world=bpy.data.worlds.new('Blue hour atmosphere'); scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.11,.2,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1600; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
camera_data=bpy.data.cameras.new('Blue Hour arrival camera'); camera=bpy.data.objects.new('Blue Hour arrival camera',camera_data)
scene.collection.objects.link(camera); scene.camera=camera
camera.location=(26,-36,15); target=Vector((-3,9,3)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); camera_data.lens=40
for obj in scene.objects:
    if obj.type!='MESH': continue
    textured=next((m for m in obj.data.materials if m and m.get('surfaceUVMetres')),None)
    if not textured: continue
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='MetreUV')
    metres=textured['surfaceUVMetres']
    for p in obj.data.polygons:
        for loop in p.loop_indices:
            co=obj.matrix_world @ obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv=(co.x/metres,co.y/metres)
for image in bpy.data.images:
    if image.size[0]>1024 or image.size[1]>1024:
        image.scale(1024,1024)
    if image.has_data: image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
scene.render.filepath=str(EVIDENCE/'blender-arrival.png')
bpy.ops.render.render(write_still=True)

import runpy
runpy.run_path(str(ROOT / 'scripts/blender-export-winter-bluehour.py'))

