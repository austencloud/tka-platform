"""Author Dawn Observatory in Blender. Coordinates: Blender (x,-sceneZ,sceneY).

The editable source precedes batching. Water and sky belong to the shared world.
"""
from pathlib import Path
import bpy, math, random, os, json
import numpy as np
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'blender/celestial/dawn-observatory.blend'
EVIDENCE=Path(os.environ.get('TKA_DAWN_EVIDENCE',str(ROOT/'.dawn-evidence')))
SOURCE.parent.mkdir(parents=True,exist_ok=True); EVIDENCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; rng=random.Random(9062601)
LAYOUT=json.loads((ROOT/'scripts/celestial-dawn-layout.json').read_text())

def mineral_image(name,base):
 """Periodic aggregate noise, without directional waves or UV-dependent baking."""
 size=512; randomizer=np.random.default_rng(926)
 noise=np.zeros((size,size),dtype=np.float32)
 for cells,amount in [(8,.018),(32,.026),(128,.025),(512,.025)]:
  grid=randomizer.random((cells,cells),dtype=np.float32)-.5
  q=np.arange(size)*cells/size; lo=np.floor(q).astype(int); f=q-lo
  a=grid[lo[:,None],lo[None,:]]; b=grid[lo[:,None],(lo[None,:]+1)%cells]
  c=grid[(lo[:,None]+1)%cells,lo[None,:]]; d=grid[(lo[:,None]+1)%cells,(lo[None,:]+1)%cells]
  noise+=(a*(1-f)[None,:]*(1-f)[:,None]+b*f[None,:]*(1-f)[:,None]+c*(1-f)[None,:]*f[:,None]+d*f[None,:]*f[:,None])*amount
 pixels=np.ones((size,size,4),dtype=np.float32)
 for channel in range(3):pixels[:,:,channel]=np.clip(base[channel]+noise,0,1)
 image=bpy.data.images.new(name,width=size,height=size); image.pixels.foreach_set(pixels.ravel()); image.update()
 image.filepath_raw=str(EVIDENCE/(name+'.png')); image.file_format='PNG'; image.save(); image.pack(); return image

def material(name,color,rough=.8,metal=0,emission=0,textured=False):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
 p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
 if textured:
  tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=mineral_image(name+' aggregate',color)
  m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']); m['uvMetres']=2.5
 return m
ivory=material('Warm cut travertine',(.79,.73,.61),.82,textured=True)
lightstone=material('Honed limestone edges',(.87,.81,.69),.7,textured=True)
darkstone=material('Charcoal basalt',(.15,.18,.19),.78,textured=True)
bronze=material('Brushed antique brass',(.46,.27,.085),.34,.64)
bronzedark=material('Oxidised bronze recess',(.10,.15,.14),.56,.48)
seam=material('Deep stone joints',(.085,.072,.055),.95)
soil=material('Planter earth',(.15,.12,.074),.96)
leaf=material('Silver sage leaves',(.24,.31,.22),.88)
opal=material('Amber inset glass',(.9,.46,.11),.3,.08,.65)
water=material('Review still water',(.035,.15,.19),.14,.12)

def mesh(name,verts,faces,mat,role='architecture',smooth=False):
 d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
 o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); d.materials.append(mat); o['sunwardRole']=role
 for p in d.polygons:p.use_smooth=smooth
 return o
def bevel(o,width=.06,segments=2):
 bpy.context.view_layer.objects.active=o; mod=o.modifiers.new('Light catching arris','BEVEL'); mod.width=width; mod.segments=segments
 bpy.ops.object.modifier_apply(modifier=mod.name)
def box(name,at,size,mat,width=.04,role='architecture'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at); o=bpy.context.object; o.name=name; o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat); o['sunwardRole']=role
 if width:bevel(o,width)
 return o
def beam(name,a,b,width,mat,depth=None):
 a,b=Vector(a),Vector(b); o=box(name,(a+b)/2,(width,depth or width,(b-a).length),mat,min(width*.15,.05))
 o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return o
def arc(name,cx,cy,z,r0,r1,a0,a1,depth,mat,segments=64,role='architecture'):
 vs=[]; fs=[]
 for zz in [z-depth,z]:
  for rr in [r0,r1]:
   for i in range(segments+1):
    a=a0+(a1-a0)*i/segments; vs.append((cx+rr*math.cos(a),cy+rr*math.sin(a),zz))
 n=segments+1
 for i in range(segments):
  fs.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
 fs.extend([(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)])
 return mesh(name,vs,fs,mat,role)
def upright_arc(name,cx,cy,cz,r0,r1,a0,a1,depth,mat,tilt=0,segments=80):
 o=arc(name,0,0,depth/2,r0,r1,a0,a1,depth,mat,segments)
 o.rotation_euler=(math.pi/2,0,tilt); o.location=(cx,cy,cz); return o

# The terrace is a cantilever from a larger inhabited structure. The dark
# underside, layered rim and buttresses give the pale floor a visible thickness.
box('Continuous suspended foundation',(0,-7,-2.55),(45,70,3.6),darkstone,.4,'foundation')
def deck_with_channel(name,z,depth,mat,role):
 # Four pieces leave a real open basin, including below the water plane.
 for x,y,w,h in [(-4.5,-7,35,69),(21.2,-7,1.6,69),(16.7,-24.25,7.4,34.5),(16.7,19.25,7.4,16.5)]:
  box(name,(x,y,z),(w,h,depth),mat,.025,role)
deck_with_channel('Travertine deck fascia',-.37,.92,ivory,'foundation')
deck_with_channel('Brass shadow gap',-.03,.09,bronze,'foundation')
box('Quiet performance floor',(0,1,.2025),(12.16,12.16,.045),ivory,.012,'court')
# A thin continuous substrate supports formations beyond the solo court.
deck_with_channel('Terrace surface',.08,.27,ivory,'ground')
box('Raised perimeter curb',(22,-7,.37),(.32,69,.32),lightstone,.07)
for y in [-41.5,27.5]:box('End parapet curb',(0,y,.37),(44,.32,.32),lightstone,.07)

# Large rectangular cuts around a quiet movement envelope. Thin joints terminate
# at the performance floor, never produce a decorative target around the actor.
for x in [-18,-14,-10.3,10.3]:box('Longitudinal paving joint',(x,-7,.219),(.025,68,.008),seam,0)
for y in range(-40,29,4):
 if -10<y<12:
  box('Perimeter paving joint',(-16,y,.22),(11.4,.025,.008),seam,0)
 else:box('Transverse paving joint',(0,y,.22),(43.7,.025,.008),seam,0)
for x in [-10.3,10.3]:box('Survey brass line',(x,-7,.224),(.04,66,.01),bronze,0)

# A sweeping colonnade frames the west side. Thin bronze screens alternate with
# deep stone piers; the east stays open to water and the cloud ocean.
arc('Colonnade cantilever foundation',0,3,-.18,21.5,25.7,math.radians(111),math.radians(225),3.6,darkstone,84,'foundation')
arc('Curved promenade',0,3,.215,21.5,25.6,math.radians(111),math.radians(225),.4,ivory,84,'ground')
arc('Promenade outer curb',0,3,.48,25.35,25.65,math.radians(111),math.radians(225),.28,lightstone,84)
for i in range(12):
 a=math.radians(116+i*9.5); x=math.cos(a)*24; y=3+math.sin(a)*24
 base=box('Colonnade pier plinth',(x,y,.52),(1.7,1.7,.65),darkstone,.10)
 o=box('Slender travertine pier',(x,y,4.75),(.80,1.25,8.1),ivory,.09); o.rotation_euler.z=a
 o=box('Bronze pier capital',(x,y,8.85),(1.3,1.65,.25),bronze,.04); o.rotation_euler.z=a
 if i%3!=1:
  for k in [-.33,0,.33]:
   xx=x+math.cos(a+math.pi/2)*k; yy=y+math.sin(a+math.pi/2)*k
   beam('Fine bronze screen',(xx,yy,1.1),(xx,yy,8.6),.035,bronzedark)
arc('Sweeping colonnade cornice',0,3,9.25,22.8,25.3,math.radians(111),math.radians(225),.52,ivory,84)
arc('Cornice bronze crown',0,3,9.34,22.7,25.4,math.radians(111),math.radians(225),.09,bronze,84)
arc('Recessed cornice shadow',0,3,8.65,23.1,25,math.radians(112),math.radians(224),.12,bronzedark,84)

# The solar instrument is the defining silhouette: segmented stone, a recessed
# brass measuring circle, and a separate inclined meridian with measured ticks.
cx,cy,cz=0,31,18
for i in range(36):
 a0=i/36*math.tau+.010; a1=(i+1)/36*math.tau-.010
 # A single missing upper segment makes the scale and construction legible.
 if i==13:continue
 o=upright_arc('Solar ring voussoir',cx,cy,cz,15.75,18.0,a0,a1,2.1,ivory,segments=5); bevel(o,.10,3)
upright_arc('Outer brass rim',cx,cy-.08,cz,18.04,18.22,0,math.tau,2.22,bronze,segments=192)
upright_arc('Inset shadow channel',cx,cy-1.15,cz,15.4,15.82,0,math.tau,.13,bronzedark,segments=192)
upright_arc('Inner measurement bezel',cx,cy-1.27,cz,15.14,15.38,0,math.tau,.16,bronze,segments=192)
for i in range(120):
 a=i/120*math.tau; r=15.0; length=.52 if i%10==0 else .27 if i%5==0 else .12
 a0=(cx+(r-length)*math.cos(a),cy-1.38,cz+(r-length)*math.sin(a)); a1=(cx+r*math.cos(a),cy-1.38,cz+r*math.sin(a))
 beam('Solar azimuth engraving',a0,a1,.035,bronze,.03)
# Inclination is expressed in a second circle; it intersects the main ring twice.
meridian=upright_arc('Inclined meridian',cx,cy,cz,15.85,16.02,0,math.tau,.24,bronze,tilt=math.radians(51),segments=192)
# An armillary suspended on a diagonal gnomon makes this a measuring instrument,
# with an inner globe at the intersection of its celestial reference planes.
for radius,angle in [(5.4,0),(4.95,math.radians(62)),(4.65,math.radians(-43))]:
 upright_arc('Armillary reference circle',cx,cy,cz,radius-.09,radius+.09,0,math.tau,.18,bronze,tilt=angle,segments=128)
beam('Inclined polar spindle',(-7.4,31,5.1),(7.4,31,30.9),.10,bronze)
beam('Equatorial suspension',(-14.7,31,18),(14.7,31,18),.055,bronzedark)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=1.45,location=(0,31,18))
globe=bpy.context.object; globe.name='Golden solar globe'; globe.data.materials.append(bronze); globe['sunwardRole']='architecture'
for p in globe.data.polygons:p.use_smooth=True
upright_arc('Solar globe latitude',cx,cy,cz,1.49,1.53,0,math.tau,.04,opal,tilt=.55,segments=96)
for x in [-11.5,11.5]:
 box('Instrument anchor',(x,30,2.2),(4.5,8.0,6.0),darkstone,.22)
 box('Instrument anchor coping',(x,30,5.32),(4.8,8.3,.28),lightstone,.07)
 for yy in [26.5,33.5]:box('Anchor bronze strap',(x,yy,2.3),(4.6,.10,5.7),bronze,.02)

# A low observation dais beyond the performer's lane connects the instrument to
# the terrace. The rear pavilion stays on the same accessible level.
for step in range(5):
 box('Instrument approach stair',(0,19+step*1.15,.20+step*.16),(14,1.18,.32),lightstone,.04)
box('Instrument observation landing',(0,26,1.0),(14,9,.32),ivory,.07)

# A single contained reflecting channel, with a dark basin and precise coping.
pool=[(x,-z) for x,z in LAYOUT['lagoon']['outlineXZ']]
box('Reflection channel basin',(16.7,2,-.5),(7.4,18,.25),darkstone,.05,'basin')
for x in [12.8,20.6]:box('Pool side coping',(x,2,.23),(.38,18.5,.22),lightstone,.06,'shore')
for y in [-7.25,11.25]:box('Pool end coping',(16.7,y,.23),(8.1,.38,.22),lightstone,.06,'shore')
mesh('REVIEW reflecting channel',[(x,y,.175) for x,y in pool],[tuple(range(len(pool)))],water,'preview')
# Place a stone footbridge over the channel at its far end, leaving most water open.
box('Channel crossing',(16.7,8.5,.58),(8.5,1.9,.40),ivory,.06)
for x in [13.3,20.1]:beam('Water clock support',(x,-5,.35),(x,-5,3.5),.10,bronze)
beam('Water clock crossbar',(13.3,-5,3.5),(20.1,-5,3.5),.12,bronze)
for i in range(7):
 x=14+i*.9
 beam('Hanging water clock rod',(x,-5,3.5),(x,-5,1.9+.5*math.sin(i*.7)),.035,bronze)

# One olive has a deliberate role: human scale and organic shade on the west.
library=ROOT/'blender/celestial/sunward-gardens.blend'
with bpy.data.libraries.load(str(library)) as (src,dst):dst.objects=[n for n in src.objects if n.startswith('Wind shaped olive')][:1]
olive=dst.objects[0]; scene.collection.objects.link(olive); olive.parent=None; olive.matrix_world=Matrix.Identity(4)
lo=Vector(tuple(min(v.co[i] for v in olive.data.vertices) for i in range(3))); hi=Vector(tuple(max(v.co[i] for v in olive.data.vertices) for i in range(3)))
olive.data=olive.data.copy()
for v in olive.data.vertices:v.co=(v.co-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))/(hi.z-lo.z)
olive.name='Solitary wind shaped olive'; olive.location=(-14,1,.43); olive.scale=(8.2,8.2,8.2); olive.rotation_euler.z=-.6; olive['sunwardRole']='olive'
box('Olive planter outer',(-14,1,.44),(6.1,7.4,.78),darkstone,.18)
box('Olive planter soil',(-14,1,.845),(5.5,6.8,.045),soil,.02)
olive.location.z=.58
for xx in [-17.1,-10.9]:box('Planter stone bench',(xx,1,.9),(.6,7.7,.25),lightstone,.07)
for yy in [-2.75,4.75]:box('Planter return bench',(-14,yy,.9),(6.8,.6,.25),lightstone,.07)
for i in range(28):
 x=rng.uniform(-16.5,-11.5); y=rng.uniform(-2.1,4.1)
 if math.hypot(x+14,y-1)<1.3:continue
 vs=[]; fs=[]
 for k in range(8):
  a=rng.random()*math.tau; length=rng.uniform(.20,.46); n=len(vs)
  vs.extend([(x,y,.88),(x+math.cos(a)*length*.5-.04,y+math.sin(a)*length*.5,.98),(x+math.cos(a)*length,y+math.sin(a)*length,1.0),(x+math.cos(a)*length*.5+.04,y+math.sin(a)*length*.5,.98)])
  fs.append((n,n+1,n+2,n+3))
 mesh('Contained sage planting',vs,fs,leaf,'planting')

# Architectural lighting is recessed and subordinate to daylight.
for x in [-21.8,21.8]:
 for y in [-32,-20,-8,4,16]:
  box('Recessed wayfinding lamp',(x,y,.53),(.12,.8,.10),opal,.02,'lamp')
for x in [-8,8]:
 box('Observation bench base',(x,14,.43),(3.8,1.3,.52),darkstone,.09)
 box('Observation bench seat',(x,14,.75),(4.1,1.6,.18),lightstone,.06)

# Rear view is a real inhabited pavilion rather than an unrelated backdrop.
for x in [-18,-12,-6,0,6,12,18]:
 box('Rear gallery blade',(x,-39,4.2),(.45,4.2,8),ivory,.09)
box('Rear gallery roof',(0,-39,8.45),(44.5,7,.55),ivory,.11)
box('Rear gallery bronze edge',(0,-35.45,8.34),(44.7,.13,.21),bronze,.03)
for y in [-35,-40]:beam('Gallery long bronze rail',(-21,y,1.15),(21,y,1.15),.065,bronze)
for x in [-17,-9,9,17]:box('Rear gallery bench',(x,-38,1.05),(4,1.4,.35),lightstone,.09)
# A distant, lower platform and its slender connecting causeway establish scale.
box('Eastern satellite terrace',(53,30,-3.2),(17,23,1.1),darkstone,.25,'distant')
box('Eastern satellite top',(53,30,-2.56),(17.4,23.4,.18),ivory,.06,'distant')
beam('Slender connecting causeway',(21,24,-.7),(46,29,-3.0),2.4,ivory,.55)
for i in range(6):box('Satellite fins',(48+i*2,38,1),(.25,4,7),ivory,.04,'distant')

# Metre UVs are calculated from actual face vertices.
bpy.context.view_layer.update(); uv_checked=0
for obj in scene.objects:
 if obj.type!='MESH' or not any(m and m.get('uvMetres') for m in obj.data.materials):continue
 uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='MetreUV')
 for face in obj.data.polygons:
  a,b,c=[obj.matrix_world @ obj.data.vertices[i].co for i in face.vertices[:3]]
  normal=(b-a).cross(c-a); axis=max(range(3),key=lambda i:abs(normal[i])); axes=[i for i in range(3) if i!=axis]
  for loop in face.loop_indices:
   co=obj.matrix_world @ obj.data.vertices[obj.data.loops[loop].vertex_index].co
   uv.data[loop].uv=(co[axes[0]]/2.5,co[axes[1]]/2.5)
 uv_checked+=1

scene.world=bpy.data.worlds.new('Clear dawn sky'); scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.45,.67,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
light=bpy.data.lights.new('Low warm sun','SUN'); light.energy=3.0; light.angle=.10; light.color=(1,.76,.48)
o=bpy.data.objects.new('Low warm sun',light); scene.collection.objects.link(o); o.rotation_euler=(math.radians(35),math.radians(-24),math.radians(-38))
fill=bpy.data.lights.new('Open sky bounce','AREA'); fill.energy=2600; fill.shape='DISK'; fill.size=32; fill.color=(.64,.78,1)
o=bpy.data.objects.new('Open sky bounce',fill); scene.collection.objects.link(o); o.location=(0,-10,26)
camera_data=bpy.data.cameras.new('Arrival'); camera=bpy.data.objects.new('Arrival',camera_data); scene.collection.objects.link(camera); scene.camera=camera
camera.location=(27,-44,21); target=Vector((0,16,14)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); camera_data.lens=32
scene.render.engine='CYCLES'; scene.cycles.samples=48; scene.cycles.use_denoising=True
scene.render.resolution_x=1600; scene.render.resolution_y=1000; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'
for image in bpy.data.images:
 if image.has_data:image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
scene.render.filepath=str(EVIDENCE/'blender-arrival.png'); bpy.ops.render.render(write_still=True)
print('UV_OBJECTS',uv_checked,flush=True)
import runpy
runpy.run_path(str(ROOT/'scripts/blender-export-celestial-dawn.py'))
