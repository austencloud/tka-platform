"""Author Celestial Sky Citadel in Blender. Coordinates: Blender (x,-sceneZ,sceneY).

The editable source precedes batching. Water and sky belong to the shared world.
"""
from pathlib import Path
import bpy, math, random, os, json
import numpy as np
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'blender/celestial/sky-citadel.blend'
EVIDENCE=Path(os.environ.get('TKA_CITADEL_EVIDENCE',str(ROOT/'.citadel-evidence')))
SOURCE.parent.mkdir(parents=True,exist_ok=True); EVIDENCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; rng=random.Random(9062601)
LAYOUT=json.loads((ROOT/'scripts/celestial-citadel-layout.json').read_text())

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
 x,y,z=[v/2 for v in size]
 o=mesh(name,[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,role)
 o.location=at
 if width>=.04:bevel(o,width)
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

rock=material('Warm weathered cliff',(.43,.40,.32),.94,textured=True)
turf=material('Sage meadow',(.30,.36,.22),.97,textured=True)
roofmat=material('Patinated celestial copper',(.18,.34,.33),.52,.32)
windowmat=material('Deep blue window recess',(.025,.064,.083),.64)

def island(name,cx,cy,rx,ry,top,depth,seed):
 randomizer=random.Random(seed); n=128; layers=20; vs=[]; fs=[]
 phase=randomizer.random()*6.28
 def outline(a):return 1+.09*math.sin(3*a+phase)+.055*math.cos(7*a+phase)+.025*math.sin(13*a)
 for j in range(layers+1):
  t=j/layers
  for i in range(n):
   a=i/n*math.tau; lobe=outline(a)
   ridge=.025*math.sin(23*a+math.sin(t*6))+.017*math.cos(41*a-t*3)
   rr=(.46+.54*t**.37)*(lobe+ridge)* (1+.025*math.sin(t*18+a*7))
   z=top-depth*(1-t)+math.sin(a*9+t*7)*1.4*(1-t)+math.sin(a*5)*.45
   vs.append((cx+rx*rr*math.cos(a),cy+ry*rr*math.sin(a),z))
 for j in range(layers):
  for i in range(n):
   k=j*n+i; kn=j*n+(i+1)%n; fs.extend([(k,kn,kn+n),(k,kn+n,k+n)])
 fs.append(tuple(reversed(range(n))))
 o=mesh(name+' fluted cliff',vs,fs,rock,'landmass')
 # A mildly undulating top connects to the cliff and supports the gardens.
 tv=[(cx,cy,top-.3)]+vs[-n:]; tf=[(0,1+i,1+(i+1)%n) for i in range(n)]
 mesh(name+' meadow crown',tv,tf,turf,'ground')

def cylinder(name,x,y,z,r,h,mat,vertices=64):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=(x,y,z+h/2))
 o=bpy.context.object;o.name=name;o.data.materials.append(mat);o['sunwardRole']='architecture';bevel(o,.045,2);return o

def spire(name,x,y,z,r,h,mat):
 profile=[(0,1),(.07,1.04),(.16,.91),(.35,.68),(.57,.39),(.80,.16),(1,.015)]
 vs=[];fs=[];n=32
 for t,rr in profile:
  for i in range(n):
   a=i/n*math.tau;vs.append((x+r*rr*math.cos(a),y+r*rr*math.sin(a),z+h*t))
 for j in range(len(profile)-1):
  for i in range(n):k=j*n+i;kk=j*n+(i+1)%n;fs.append((k,kk,kk+n,k+n))
 return mesh(name,vs,fs,mat,'architecture',True)

def arch(name,x,y,z,width,height,depth,mat=ivory):
 r=width/2; spring=height-r
 for side in [-1,1]:box(name+' pier',(x+side*(r+.4),y,z+spring/2),(.8,depth,spring),mat,.07)
 o=upright_arc(name+' vault',x,y,z+spring,r,r+.8,0,math.pi,depth,mat,segments=24)
 return o

def tower(name,x,y,z,r,h):
 cylinder(name+' foundation',x,y,z,r*1.18,1.2,darkstone)
 cylinder(name+' shaft',x,y,z+1.2,r,h-1.2,ivory)
 for zz in [z+1.4,z+h*.5,z+h-.8]:cylinder(name+' moulding',x,y,zz,r*1.09,.28,lightstone)
 # Arched glazing and raised surrounds follow the radial tower wall.
 for a in [i/8*math.tau for i in range(8)]:
  xx=x+math.cos(a)*(r+.035);yy=y+math.sin(a)*(r+.035)
  width=r*.33; wh=h*.19; bottom=z+h*.64; spring=wh-width/2
  local=[(-width/2,0,0),(width/2,0,0)]+[(width/2*math.cos(t*math.pi/16),0,spring+width/2*math.sin(t*math.pi/16)) for t in range(17)]
  rot=Matrix.Rotation(a-math.pi/2,4,'Z'); origin=Vector((xx,yy,bottom))
  mesh(name+' arched glazing',[tuple(origin+rot@Vector(v)) for v in local],[tuple(range(len(local)))],windowmat)
  before=set(scene.objects);arch(name+' window surround',0,0,0,width,wh,.20,lightstone)
  for ob in set(scene.objects)-before:
   ob.rotation_euler.z+=a-math.pi/2;ob.location=origin+rot@ob.location
  beam(name+' window mullion',(xx,yy,bottom),(xx,yy,bottom+wh-.2),.06,bronze)
  # Slender engaged buttresses tie the lower shaft to the cornice.
  aa=a+math.pi/8
  beam(name+' engaged pier',(x+math.cos(aa)*r,y+math.sin(aa)*r,z+1.1),(x+math.cos(aa)*r,y+math.sin(aa)*r,z+h-.4),r*.12,lightstone)
 for zz in range(3,int(h*.55),3):
  arc(name+' stone course',x,y,z+zz,r+.008,r+.02,0,math.tau,.024,seam,segments=64)
 spire(name+' curved roof',x,y,z+h,r*1.24,h*.40,roofmat)
 profile=[(0,1),(.07,1.04),(.16,.91),(.35,.68),(.57,.39),(.80,.16),(1,.015)]
 for i in range(12):
  a=i/12*math.tau
  for (t,rr),(tt,rrr) in zip(profile,profile[1:]):
   beam(name+' roof seam',(x+r*1.245*rr*math.cos(a),y+r*1.245*rr*math.sin(a),z+h+h*.4*t),(x+r*1.245*rrr*math.cos(a),y+r*1.245*rrr*math.sin(a),z+h+h*.4*tt),.045,bronzedark)
 cylinder(name+' finial',x,y,z+h*1.4,.09,1.8,bronze,12)

def bridge(name,a,b,width,z):
 ax,ay=a;bx,by=b;dx=bx-ax;dy=by-ay;length=math.hypot(dx,dy);ang=math.atan2(dy,dx)
 o=box(name+' deck',((ax+bx)/2,(ay+by)/2,z-.4),(length,width,.8),ivory,.1);o.rotation_euler.z=ang
 for side in [-1,1]:
  off=Vector((-math.sin(ang),math.cos(ang),0))*width*.5*side
  beam(name+' parapet',(ax+off.x,ay+off.y,z+.6),(bx+off.x,by+off.y,z+.6),.34,lightstone,.55)
 for t in [.22,.48,.74]:
  x=ax+dx*t;y=ay+dy*t
  o=box(name+' soaring pier',(x,y,z-9),(2,width*.8,18),ivory,.2);o.rotation_euler.z=ang
  for side in [-1,1]:
   beam(name+' flying strut',(x,y,z-11),(x+math.cos(ang)*side*length*.12,y+math.sin(ang)*side*length*.12,z-.9),.7,ivory)

# A large terrestrial crown replaces the exposed board. The courtyard is a
# connected part of this island, with a rear arrival route and lateral gardens.
island('Citadel island',0,18,77,105,-1.15,64,41)
box('Courtyard retaining podium',(0,-4,-2.0),(48,73,2.8),ivory,.20,'foundation')
# Preserve the measured performance floor and existing inset water channel.
for x,y,w,h in [(-4.5,-7,35,69),(21.2,-7,1.6,69),(16.7,-24.25,7.4,34.5),(16.7,19.25,7.4,16.5)]:
 box('Courtyard paving',(x,y,-.285),(w,h,1.0),ivory,.025,'ground')
box('Quiet performance floor',(0,1,.2025),(12.16,12.16,.045),ivory,.012,'court')
for x in [-18,-14,-10.3,10.3]:box('Stone paving joint',(x,-7,.219),(.027,68,.006),seam,0)
for y in range(-38,29,4):
 if -10<y<12:box('Perimeter joint',(-16,y,.22),(11.4,.027,.006),seam,0)
 else:box('Courtyard joint',(0,y,.22),(43.7,.027,.006),seam,0)
box('Reflecting channel floor',(16.7,2,-.5),(7.4,18,.25),darkstone,.04,'basin')
for x in [12.8,20.6]:box('Pool coping',(x,2,.24),(.4,18.5,.24),lightstone,.06,'shore')
for y in [-7.25,11.25]:box('Pool coping',(16.7,y,.24),(8.1,.4,.24),lightstone,.06,'shore')
box('Pool bridge',(16.7,8.5,.58),(8.5,1.9,.40),ivory,.06)
for x in [13.3,20.1]:beam('Water clock support',(x,-5,.35),(x,-5,3.5),.10,bronze)
beam('Water clock crossbar',(13.3,-5,3.5),(20.1,-5,3.5),.12,bronze)
pool=[(x,-z) for x,z in LAYOUT['lagoon']['outlineXZ']]
mesh('REVIEW water',[(x,y,.175) for x,y in pool],[tuple(range(len(pool)))],water,'preview')

# A genuine arcaded enclosure provides the coliseum memory at human scale.
for side in [-1,1]:
 for j in range(6):
  x=side*29;y=-17+j*8
  o=arch('Garden cloister',0,0,0,6.2,7.3,1.2)
  # arch() has piers in world space; rotate the whole bay as one assembly.
  bay=[ob for ob in scene.objects if ob.name.startswith('Garden cloister') and not ob.get('placed')]
  for ob in bay:
   ob.rotation_euler.z+=math.pi/2;ob.location=Vector((x,y,0))+Matrix.Rotation(math.pi/2,4,'Z')@ob.location;ob['placed']=True
  box('Cloister cornice',(x,y,7.9),(2.4,8,.55),lightstone,.09)
  if j%2==0:spire('Cloister pinnacle',x,y,8.15,.65,2.3,ivory)
 box('Cloister promenade',(side*29,3,-.30),(8,51,1.0),ivory,.12,'foundation')

# The citadel is asymmetric and inhabitable: a gate, stepped wings, round keeps,
# high chapel, copper roofs, and a constellation of smaller roof pinnacles.
box('Castle broad terrace',(0,66,.3),(83,70,2.7),ivory,.3,'foundation')
for step in range(10):box('Great stair',(0,25+step*.85,.1+step*.15),(17,.88,.3),lightstone,.04)
for side in [-1,1]:
 box('Castle gatehouse wing',(side*18,56,10.2),(23,17,18),ivory,.18)
 box('Gatehouse roof terrace',(side*18,56,19.7),(24,18,.75),lightstone,.1)
 for x in [side*18-7,side*18,side*18+7]:
  arch('Gatehouse facade arch',x,47.35,2.0,4.8,10.5,1.0)
  mesh('Gatehouse arched glazing',[(x-2.4,47.28,2),(x+2.4,47.28,2)]+[(x+2.4*math.cos(t*math.pi/24),47.28,10.1+2.4*math.sin(t*math.pi/24)) for t in range(25)],[tuple(range(27))],windowmat)
  for zz in [7.2,11.3]:box('Window crossbar',(x,47.28,zz),(3.5,.14,.16),bronze,.02)
  spire('Roof pinnacle',x,48,20.1,.9,4.0,ivory)
arch('Great heavenly gate',0,47,1.6,12,20,4,lightstone)
upright_arc('Gate solar rose',0,44.9,21.8,2.3,2.65,0,math.tau,.25,bronze,segments=72)
for i in range(12):
 a=i/12*math.tau;beam('Rose stone tracery',(0,44.9,21.8),(2.3*math.cos(a),44.9,21.8+2.3*math.sin(a)),.10,lightstone)
tower('Western keep',-32,53,1.65,5.2,24)
tower('Eastern keep',33,57,1.65,5.7,30)
tower('High astronomical chapel',14,85,1.65,7.4,44)
tower('West library',-16,77,1.65,4.6,31)
tower('Eastern bell tower',25,80,1.65,3.8,35)
for x in [-20,24]:box('Castle rear hall',(x,74,11),(12,23,18.7),ivory,.15)
for yy in [65,81]:arch('Inner courtyard passage',0,yy,1.65,12,15,1.4,lightstone)
for yy in [70,80,90]:beam('Chapel flying buttress',(36,yy,2),(20,yy,28),1.05,lightstone,1.35)

# Swept stone feathers recover the original heavenly motif. These are sculpted
# blades, anchored as wings at the gate rather than floating ornaments.
for side in [-1,1]:
 for i in range(8):
  length=8.5+i*.68;vs=[];fs=[];rings=12;n=8
  for j in range(rings+1):
   t=j/rings;cx=side*(8+i*.38+t*(3.0+i*.8));cy=45.5+t*t*2.6;cz=19+t*length
   width=.58*math.sin(math.pi*t)**.6+.015
   for k in range(n):
    a=k/n*math.tau;vs.append((cx+width*math.cos(a),cy+width*.24*math.sin(a),cz))
  for j in range(rings):
   for k in range(n):p=j*n+k;q=j*n+(k+1)%n;fs.append((p,q,q+n,p+n))
  mesh('Gate swept feather',vs,fs,lightstone,'architecture',True)
  beam('Feather golden quill',(side*(8+i*.38),45.25,19),(side*(8+i*.38+3+i*.8),48,19+length),.045,bronze)

# Astronomy survives as a courtyard instrument and facade carving, subordinated
# to the castle. The garden retains the earlier olives and reflective water.
cylinder('Armillary garden pedestal',-19,17,.2,1.4,1.5,ivory)
for tilt in [0,.9,-.65]:upright_arc('Garden armillary',-19,17,4,2.0,2.10,0,math.tau,.12,bronze,tilt=tilt,segments=72)
beam('Garden polar axis',(-20.2,17,1.3),(-17.8,17,6.7),.10,bronze)
with bpy.data.libraries.load(str(ROOT/'blender/celestial/sunward-gardens.blend')) as (src,dst):dst.objects=[n for n in src.objects if n.startswith('Wind shaped olive')][:1]
olive=dst.objects[0];scene.collection.objects.link(olive);olive.parent=None;olive.matrix_world=Matrix.Identity(4);olive.data=olive.data.copy()
lo=Vector(tuple(min(v.co[i] for v in olive.data.vertices) for i in range(3)));hi=Vector(tuple(max(v.co[i] for v in olive.data.vertices) for i in range(3)))
for v in olive.data.vertices:v.co=(v.co-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))/(hi.z-lo.z)
for index,(x,y,h) in enumerate([(-16,0,8.2),(23,22,7.5),(-43,30,9),(45,3,8),(-38,-32,7),(33,-35,6)]):
 o=olive if index==0 else olive.copy()
 if index:scene.collection.objects.link(o)
 o.location=(x,y,.65 if index==0 else -1.7);o.scale=(h,h,h);o.rotation_euler.z=index*1.71;o.name='Citadel olive';o['sunwardRole']='olive'
 if index==0:
  box('Olive planter',(x,y,.37),(6.4,7.6,.6),darkstone,.1)
  box('Planter soil',(x,y,.69),(5.8,7,.08),soil,.04)
  for xx in [x-3.3,x+3.3]:box('Planter bench',(xx,y,.85),(.65,8,.3),lightstone,.08)

# The arrival side and horizon are designed too. Bridges arrive at substantial
# islands. Their varied heights and overlap establish a surrounding archipelago.
bridge('Western sky bridge',(-35,34),(-113,63),7,1.0)
bridge('Eastern sky bridge',(38,30),(117,65),6,1.0)
for name,x,y,rx,ry,z,depth,seed in [('West monastery',-139,72,43,58,-2,72,92),('East aerie',143,74,46,64,-2,82,13),('Far high sanctuary',-95,235,65,55,6,95,61),('Far east ridge',205,241,86,63,-8,85,122),('Far west ridge',-265,205,81,73,-3,105,34),('Rear garden island',80,-130,47,62,-9,64,71)]:
 island(name,x,y,rx,ry,z,depth,seed)
 if seed==92:
  for i in range(2):tower(name+' bell keep',x+(i*2-1)*17,y,z-.65,4.7,24+i*10)
  box(name+' long hall',(x,y, z+6),(32,13,13.3),ivory,.15)
  for i in range(5):arch(name+' abbey arcade',x-12+i*6,y-7,z-.4,4,10,1)
 elif seed==13:
  tower(name+' watchtower',x,y,z-.65,7,39)
  for i in range(7):arch(name+' open rotunda',x-23+i*7,y-13,z-.4,5.5,9,1)
 elif seed==61:
  tower(name+' high beacon',x,y,z-.65,6,48)
 elif seed==122:
  for i in range(5):tower(name+' ridge village',x-35+i*16,y+math.sin(i)*13,z-.65,2.7+i*.35,10+i*3)
 elif seed==34:
  for i in range(7):arch(name+' ancient colonnade',x-33+i*11,y,z-.4,8,19-i%3*3,2)
 else:
  tower(name+' pilgrim lodge',x,y,z-.65,5,19)
 # Rooted groves break the bare plateau silhouette without new asset downloads.
 for i in range(4 if seed in [92,13,71] else 2):
  ob=olive.copy();scene.collection.objects.link(ob);ob.name=name+' olive';ob.location=(x-rx*.55+i*rx*.30,y-ry*.40,z-.8);hh=6+(i%3);ob.scale=(hh,hh,hh)
bridge('Rear arrival viaduct',(0,-39),(58,-119),10,-.1)
for x in [-12,12]:tower('Arrival gate',x,-38,.2,3.0,14)
arch('Arrival portal',0,-39,.2,18,13,2.0)

# Project real face coordinates to packed mineral textures before saving source.
bpy.context.view_layer.update()
for ob in scene.objects:
 if ob.type!='MESH' or not any(m and m.get('uvMetres') for m in ob.data.materials):continue
 uv=ob.data.uv_layers.active or ob.data.uv_layers.new(name='MetreUV')
 for face in ob.data.polygons:
  a,b,c=[ob.matrix_world@ob.data.vertices[i].co for i in face.vertices[:3]];normal=(b-a).cross(c-a);axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
  for loop in face.loop_indices:
   co=ob.matrix_world@ob.data.vertices[ob.data.loops[loop].vertex_index].co;uv.data[loop].uv=(co[axes[0]]/2.5,co[axes[1]]/2.5)
scene.world=bpy.data.worlds.new('Celestial dawn');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.40,.56,.76,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
d=bpy.data.lights.new('Warm dawn sun','SUN');d.energy=3;d.angle=.08;d.color=(1,.82,.62);o=bpy.data.objects.new('Warm dawn sun',d);scene.collection.objects.link(o);o.rotation_euler=(math.radians(35),math.radians(-22),math.radians(-32))
cd=bpy.data.cameras.new('Citadel arrival');cam=bpy.data.objects.new('Citadel arrival',cd);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(45,-70,30);target=Vector((0,42,21));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cd.lens=29
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
for im in bpy.data.images:
 if im.has_data:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
scene.render.filepath=str(EVIDENCE/'blender-citadel.png');bpy.ops.render.render(write_still=True)
import runpy
runpy.run_path(str(ROOT/'scripts/blender-export-celestial-citadel.py'))
