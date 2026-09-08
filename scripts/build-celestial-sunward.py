"""Sunward Gardens: Blender-authored limestone, olive groves and cliff planting.

Run prepare-celestial-sunward.mjs first, then Blender in background mode.
Coordinates here are Blender Z-up; scene coordinates map to (x, -z, y).
"""
from pathlib import Path
import bpy, math, random, json, os
from mathutils import Vector
from mathutils.noise import noise_vector

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'blender/celestial/sunward-gardens.blend'
OUT=ROOT/'static/models/celestial'
EVIDENCE=Path(os.environ.get('TKA_CELESTIAL_EVIDENCE',str(ROOT/'.sunward-evidence')))
SOURCE.parent.mkdir(parents=True,exist_ok=True); EVIDENCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; rng=random.Random(9052607)

def mat(name,col,rough=.88):
 m=bpy.data.materials.new(name); m.diffuse_color=(*col,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*col,1); p.inputs['Roughness'].default_value=rough
 return m
stone=[mat('Travertine '+str(i),c) for i,c in enumerate([(.58,.43,.28),(.72,.58,.39),(.81,.69,.49),(.48,.36,.25),(.66,.54,.36)])]
floor=mat('Warm worn limestone',(.69,.60,.44)); court=mat('Honed performance stone',(.73,.65,.51))
soil=mat('Olive grove earth',(.24,.23,.12)); sage=mat('Silver sage',(.23,.30,.17)); grass=mat('Dry meadow gold',(.46,.43,.21)); lavender=mat('Lavender flowers',(.36,.26,.46)); stem=mat('Woody stems',(.19,.21,.10))
water=mat('Lagoon preview',(.12,.39,.38),.17)

# Bake mineral variation into the authored geometry so large cliffs have no
# repeating texture bands. The shared colour attribute survives glTF export.
for m in [*stone,floor,court]:
 nodes=m.node_tree.nodes; links=m.node_tree.links; p=nodes.get('Principled BSDF')
 color_node=nodes.new('ShaderNodeVertexColor'); color_node.layer_name='Mineral'
 links.new(color_node.outputs['Color'],p.inputs['Base Color'])
 m['stoneMetres']=1.6

def mesh(name,verts,faces,material,role='terrain',smooth=False):
 d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
 o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); d.materials.append(material); o['sunwardRole']=role
 for p in d.polygons:p.use_smooth=smooth
 return o

def rock(name,x,y,z,rx,ry,h,seed,role='limestone'):
 # Correlated erosion around stratified rings, with undercut shelves and broken caps.
 r=random.Random(seed); n=64 if rx>3 else 20; levels=20 if h>3 else 5; phase=r.random()*6.28
 verts=[]
 for j in range(levels+1):
  t=j/levels; profile=.48+.48*math.sin(t*math.pi*.65)+.016*math.sin(t*math.pi*11+phase)
  for i in range(n):
   a=i/n*math.tau
   wobble=1+.105*math.sin(3*a+phase)+.06*math.sin(7*a-phase)+.028*math.sin(13*a+phase)
   erosion=noise_vector(Vector((math.cos(a)*2,math.sin(a)*2,t*3+seed))).x*.18
   xx=x+rx*math.cos(a)*(profile*wobble+erosion); yy=y+ry*math.sin(a)*(profile*wobble+erosion)
   zz=z-h+t*h+min(.12,h*.025)*math.sin(a*5+phase)+min(.07,h*.025)*math.sin(a*11)
   verts.append((xx,yy,zz))
 faces=[]
 for j in range(levels):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 faces.append(tuple(range(levels*n,(levels+1)*n)))
 o=mesh(name,verts,faces,stone[0],role,True)
 for m in stone[1:]:o.data.materials.append(m)
 for p in o.data.polygons:
  level=int((p.index//n)/levels*18); p.material_index=[0,0,3,0,1,1,4,1,2,1,0,1,4,1,2,2,1,2,2][min(level,18)]
 return o

# A continuous larger landmass, with a broad dry approach behind the camera.
# The top is modelled separately so the lagoon cuts below its actual water plane.
def height(x,y):
 if math.hypot(x,y-1)<10.2:return .215
 edge=max(0,min(1,(abs(x)-9)/9))
 return .16+edge*(.22+.22*math.sin(y*.29)+.10*math.sin(x*.62+y*.43))

outline=[(-25,-55),(25,-55),(23,-24),(22,-10),(23,1),(20,10),(13,17),(3,19),(-10,18),(-20,12),(-22,0),(-22,-20)]
lagoon=[(x+4,-z) for x,z in json.loads((ROOT/'scripts/seraphic-vault-cloudbreak-layout.json').read_text())['lagoon']['outlineXZ']]
def inside(x,y,poly):
 result=False; j=len(poly)-1
 for i in range(len(poly)):
  a,b=poly[i],poly[j]
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
  j=i
 return result
verts=[]; faces=[]; N=110; M=152
for j in range(M+1):
 y=-55+j*.5
 for i in range(N+1):
  x=-27.5+i*.5; z=height(x,y)
  if inside(x,y,lagoon):z=-.8
  verts.append((x,y,z))
for j in range(M):
 for i in range(N):
  x=-27.5+(i+.5)*.5; y=-55+(j+.5)*.5
  if inside(x,y,outline):
   k=j*(N+1)+i; faces.append((k,k+1,k+N+2,k+N+1))
ground=mesh('Continuous weathered limestone shelf',verts,faces,floor,'ground',True)
# Fractured cliff skirt follows the terrace perimeter, with ledges of different widths.
for i,(x,y) in enumerate(outline):
 nx,ny=outline[(i+1)%len(outline)]; dist=math.hypot(nx-x,ny-y)
 for k in range(max(1,int(dist/4))):
  t=(k+.5)/max(1,int(dist/4)); xx=x+(nx-x)*t; yy=y+(ny-y)*t
  rock('Shelf buttress',xx*.96,yy,.0,4.2,4.6,10+rng.random()*6,100+i*20+k)

# Authored court is the only mesh scaled for growing performer formations.
bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=6.08,depth=.045,location=(0,1,.2025))
o=bpy.context.object; o.name='Dry performance terrace'; o.data.materials.append(court); o['sunwardRole']='court'
bev=o.modifiers.new('Worn lip','BEVEL'); bev.width=.025; bev.segments=2; bpy.ops.object.modifier_apply(modifier=bev.name)

# Organic shelves enclose the olive roots. Keep all trunks outside a 10m dry lane.
for i,(x,y,rx,ry) in enumerate([(-13,1,3.6,4.6),(12,-1.6,2.8,3.6),(-15,11,4.7,3.1),(-17,-13,3.4,5),(20,-13,3.2,4.5)]):
 rock('Grove limestone ledge',x,y,.48,rx,ry,1.35,330+i)

templates=[]
for name in ['olive-west-ancient','olive-east-windswept','coast-rocks-05','sand-rocks-small-01']:
 before=set(scene.objects); bpy.ops.import_scene.gltf(filepath=str(ROOT/'.sunward-source'/name/'olive.gltf'))
 imported=[o for o in scene.objects if o not in before and o.type=='MESH']
 bpy.ops.object.select_all(action='DESELECT')
 for o in imported:o.select_set(True)
 bpy.context.view_layer.objects.active=imported[0]
 if len(imported)>1:bpy.ops.object.join()
 o=bpy.context.object; o.parent=None; bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 low=Vector(tuple(min(v.co[i] for v in o.data.vertices) for i in range(3))); high=Vector(tuple(max(v.co[i] for v in o.data.vertices) for i in range(3)))
 center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z)); scale=high.z-low.z
 for v in o.data.vertices:v.co=(v.co-center)/scale
 if not name.startswith('olive'):
  dec=o.modifiers.new('Reusable scanned stone detail','DECIMATE'); dec.ratio=min(1,2200/max(1,len(o.data.polygons))); bpy.ops.object.modifier_apply(modifier=dec.name)
  o.data.materials.clear(); o.data.materials.append(stone[1])
  for p in o.data.polygons:p.use_smooth=True
 for m in o.data.materials:
  if not m or not m.use_nodes:continue
  p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if p:
   p.inputs['Emission Strength'].default_value=0; p.inputs['Roughness'].default_value=.85; p.inputs['Metallic'].default_value=0
   for socket in ['Metallic','Roughness']:
    for link in list(p.inputs[socket].links):m.node_tree.links.remove(link)
   for link in list(p.inputs['Emission Color'].links):m.node_tree.links.remove(link)
 scene.collection.objects.unlink(o); templates.append(o)

distant_olives=[]
for template in templates[:2]:
 o=template.copy(); o.data=template.data.copy(); scene.collection.objects.link(o)
 bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
 dec=o.modifiers.new('Distant olive silhouette','DECIMATE'); dec.ratio=.18; bpy.ops.object.modifier_apply(modifier=dec.name)
 scene.collection.objects.unlink(o); distant_olives.append(o)

def olive(i,x,y,z,h,angle):
 source=distant_olives[i%2] if z>3 else templates[i%2]
 o=source.copy(); o.data=source.data; scene.collection.objects.link(o)
 o.name='Wind shaped olive'; o.location=(x,y,z-.04*h); o.scale=(h,h,h); o.rotation_euler.z=angle; o['sunwardRole']='distant-olive' if z>3 else 'olive'
for args in [(0,-13,1,.60,8.6,-.28),(1,12,-1.6,.60,7.6,.42),(1,-18,-17,.25,6.4,1.1),(0,20,-25,.25,7.5,2.4)]:olive(*args)

def scanned_stone(i,x,y,z,sx,sy,sz):
 template=templates[2+i%2]; o=template.copy(); o.data=template.data; scene.collection.objects.link(o)
 o.name='Scanned weathered limestone'; o['sunwardRole']='scanned-rock'
 o.location=(x,y,z-sz*.14); o.scale=(sx,sy,sz); o.rotation_euler.z=rng.random()*math.tau
 return o

# Broad eroded mesas replace straight-sided tower placeholders. Peripheral ledges
# and smaller caps provide geological scale without filling the performer band.
mesas=[(-27,43,6.5,11,7.2,23),(28,52,9.1,13,8,28),(12,73,13,9,7,30),(48,83,5,18,10,27),(-47,83,12,17,10,34)]
for i,(x,y,z,rx,ry,h) in enumerate(mesas):
 rock('Distant eroded mesa',x,y,z,rx,ry,h,500+i,'mesa')
 rock('Mesa shoulder',x-rx*.6,y+1,z-h*.22,rx*.7,ry*.85,h*.75,550+i,'mesa')
 rock('Mesa cap',x,y,z+.45,rx*1.01,ry*1.01,1.1,600+i,'mesa')
 olive(i,x-1,y,z+.58,3.8 if i!=2 else 5,1.2+i)
 if i<3:olive(i+1,x+rx*.5,y+2,z+.52,2.5,.6)

# Small boulders and lavender / silver sage establish a Mediterranean scale.
for i in range(90):
 a=rng.uniform(0,math.tau); rr=rng.uniform(11.2,20); x=math.cos(a)*rr; y=math.sin(a)*rr
 if not inside(x,y,outline) or inside(x,y,lagoon) or x>10 and y<7 and y>-8:continue
 scanned_stone(i,x,y,height(x,y),rng.uniform(.35,.9),rng.uniform(.4,1.1),rng.uniform(.25,.7))

def plants(name,material,flower=False):
 verts=[]; faces=[]
 for i in range(1600 if not flower else 550):
  a=rng.uniform(0,math.tau); rr=rng.uniform(10.8,20.5); x=math.cos(a)*rr; y=math.sin(a)*rr
  if not inside(x,y,outline) or inside(x,y,lagoon) or (x>10 and -8<y<7):continue
  if math.sin(x*.75+y*.31)+math.sin(y*.67)<-.1:continue
  base=height(x,y)+.01; h=rng.uniform(.15,.55) if not flower else rng.uniform(.28,.65)
  for k in range(7):
   angle=rng.random()*math.tau; w=.025 if flower else .035; dx=math.cos(angle)*w; dy=math.sin(angle)*w; n=len(verts)
   lean=.14; lx=math.cos(angle+1)*lean; ly=math.sin(angle+1)*lean
   verts.extend([(x,y,base),(x+dx+lx*.5,y+dy+ly*.5,base+h*.55),(x+lx,y+ly,base+h),(x-dx+lx*.5,y-dy+ly*.5,base+h*.55)])
   faces.append((n,n+1,n+2,n+3))
 return mesh(name,verts,faces,material,'planting')
plants('Silver sage meadow',sage); plants('Golden grasses',grass); plants('Lavender drifts',lavender,True)

# The lagoon is authored with rounded layered lips; runtime owns its water.
cx=sum(p[0] for p in lagoon)/len(lagoon); cy=sum(p[1] for p in lagoon)/len(lagoon)
for band,(outer,inner,z,material) in enumerate([(1.16,1.03,.18,stone[2]),(1.03,.98,.10,stone[3])]):
 vs=[]; fs=[]; n=len(lagoon)
 for scale in [outer,inner]:
  for x,y in lagoon:vs.append((cx+(x-cx)*scale,cy+(y-cy)*scale,z))
 for i in range(n):fs.append((i,(i+1)%n,(i+1)%n+n,i+n))
 mesh('Water worn lagoon lip',vs,fs,material,'shore')
mesh('REVIEW lagoon water',[(x,y,.175) for x,y in lagoon],[tuple(range(len(lagoon)))],water,'preview')

# Rear hemisphere is an eroded mountain shoulder, continuing beyond the camera.
for i,(x,y,z,rx,ry,h) in enumerate([(-22,-46,12,13,17,23),(24,-49,16,14,18,29),(-31,-65,24,20,15,36),(32,-70,28,22,19,40)]):
 rock('Rear limestone escarpment',x,y,z,rx,ry,h,1200+i)
 olive(i,x,y,z+.2,6,1)

# A single eroded natural arch joins the mountain shoulders in the rear view.
verts=[]; faces=[]; segments=72; sides=16
for j in range(segments+1):
 a=j/segments*math.pi
 for k in range(sides):
  b=k/sides*math.tau; thickness=3.2+.7*math.sin(a*5+.8)+.25*math.sin(b*3+a*7)
  verts.append(((18+math.cos(b)*thickness)*math.cos(a),-59+math.sin(b)*thickness*1.8,(24+math.cos(b)*thickness)*math.sin(a)-.5))
for j in range(segments):
 for k in range(sides):faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
mesh('Eroded mountain arch',verts,faces,stone[2],'limestone',True)

world=bpy.data.worlds.new('Warm cloud light'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.66,.82,1); world.node_tree.nodes['Background'].inputs[1].default_value=.5
ld=bpy.data.lights.new('Late sun','SUN'); ld.energy=2.4; ld.angle=.12; ld.color=(1,.79,.52)
lo=bpy.data.objects.new('Late sun',ld); scene.collection.objects.link(lo); lo.rotation_euler=(math.radians(28),math.radians(-18),math.radians(-25))
camdata=bpy.data.cameras.new('Sunward arrival'); camera=bpy.data.objects.new('Sunward arrival',camdata); scene.collection.objects.link(camera); scene.camera=camera
camera.location=(10,-28,10); target=Vector((0,8,1.5)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); camdata.lens=39
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1600; scene.render.resolution_y=1000; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'
bpy.context.view_layer.update()
for obj in scene.objects:
 if obj.type!='MESH' or not any(m and m.get('stoneMetres') for m in obj.data.materials):continue
 colors=obj.data.color_attributes.get('Mineral') or obj.data.color_attributes.new(name='Mineral',type='FLOAT_COLOR',domain='CORNER')
 for p in obj.data.polygons:
  base=obj.data.materials[p.material_index].diffuse_color
  for loop in p.loop_indices:
   co=obj.matrix_world @ obj.data.vertices[obj.data.loops[loop].vertex_index].co
   n=noise_vector(co*.45).x*.065+noise_vector(co*2.1).x*.022
   colors.data[loop].color=(max(.01,base[0]+n),max(.01,base[1]+n),max(.01,base[2]+n),1)
for image in bpy.data.images:
 if image.size[0]>1024 or image.size[1]>1024:image.scale(1024,1024)
 if image.has_data:image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
scene.render.filepath=str(EVIDENCE/'blender-arrival.png'); bpy.ops.render.render(write_still=True)
import runpy
runpy.run_path(str(ROOT/'scripts/blender-export-celestial-sunward.py'))
