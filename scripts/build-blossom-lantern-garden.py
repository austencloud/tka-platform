"""Author Blossom's lantern garden, using botanical crowns and connected stonework."""
from pathlib import Path
import sys, os, math, random, json
import bpy, bmesh
from mathutils import Vector, Matrix, kdtree
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
from blossom_garden_mesh import Batch, material, surface_texture, MOSS, STONE, STONE_TOP, BARK, WOOD, GOLD, PAPER, WATER
OUT=ROOT/'static/models/blossom'
PLAN=ROOT/'src/lib/shared/3d/environments/scenes/cherry-blossom/blossom-plan.json'
EVIDENCE=ROOT/'docs/superpowers/specs/blossom-lantern-garden/evidence'
BLEND=ROOT/'blender/blossom/lantern-garden.blend'
EVIDENCE.mkdir(parents=True,exist_ok=True)
rng=random.Random(905730)
SLATE=material('Blossom court slate',(.085,.11,.13),.84)
surface_texture(SLATE,(.36,.42,.44))
DARK_MOSS=material('Deep bank moss',(.022,.045,.027),.98)
GRASS=material('Garden sedge',(.085,.18,.045),.93)


def clamp(v,a=0,b=1):return max(a,min(b,v))
def smooth(v):
    v=clamp(v)
    return v*v*(3-2*v)
def distance(x,y,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    t=clamp(((x-a[0])*dx+(y-a[1])*dy)/max(.001,dx*dx+dy*dy))
    return math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)
def route(points):
    p=[points[0],*points,points[-1]]
    result=[]
    for i in range(len(p)-3):
        a,b,c,d=[Vector(q) for q in p[i:i+4]]
        for j in range(40):
            t=j/40
            q=.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            if not result or math.dist(q,result[-1])>.45:result.append(tuple(q))
    return [*result,points[-1]]
ARRIVAL=route([(-21,-27),(-19,-20),(-15,-14),(-11,-9),(-7,-6)])
SERVICE=route([(24,-16),(20,-11),(15,-6),(10,-3),(8,-2)])
def route_distance(x,y):return min(distance(x,y,a,b) for r in (ARRIVAL,SERVICE) for a,b in zip(r,r[1:]))
def grade(x,y):return .55+clamp((math.hypot(x,y)-11)*.035,0,.9)


def pond_edges(x):
    front=6.5+.008*(x+7)**2
    width=7.8*max(0,1-((x+7)/18)**2)**.65
    return front,front+width
POND_MIN,POND_MAX=-25,11
xs=[POND_MIN+i*36/112 for i in range(113)]
outline=[(x,pond_edges(x)[0]) for x in xs]+[(x,pond_edges(x)[1]) for x in reversed(xs[1:-1])]
def pond_distance(x,y):
    if POND_MIN<x<POND_MAX and pond_edges(x)[0]<y<pond_edges(x)[1]:return 0
    return min(distance(x,y,a,b) for a,b in zip(outline,outline[1:]+outline[:1]))


def height(x,y):
    r=math.hypot(x,y)
    h=.10+.06*math.sin(x*.47)*math.sin(y*.42)
    # Nearby banks carry the visual enclosure; smooth distant hills disappear in fog.
    for bx,by,peak,spread in [(12,18,2.2,7),(-18,15,1.5,7),(23,-2,2,6),(-24,-5,1.9,7),(10,29,3.8,8),(-10,31,3.5,9)]:
        h+=peak*math.exp(-((x-bx)**2+(y-by)**2)/(2*spread**2))
    h+=smooth((r-26)/17)*(3+2*math.sin(math.atan2(y,x)*3+.4)**2)
    # The court and its apron are one excavated, level architectural plane.
    apron=max(abs(x)/8.8,abs(y)/6.8)
    if apron<1.35:h=h*(smooth((apron-1)/.35))+.10*(1-smooth((apron-1)/.35))
    pd=pond_distance(x,y)
    if pd<2.4:
        blend=smooth(pd/2.4)
        h=-.48*(1-blend)+h*blend
    if POND_MIN<x<POND_MAX and pond_edges(x)[0]<y<pond_edges(x)[1]:h=-.95
    rd=route_distance(x,y)
    if rd<3.7:
        blend=1-smooth((rd-1.9)/1.8)
        h=h*(1-blend)+(grade(x,y)-.07)*blend
    return h

terrain=Batch('Amphitheatre_Terrain',[MOSS],'terrain')
for iy in range(192):
    y=-72+iy*.75
    for ix in range(192):
        x=-72+ix*.75
        tint=.42+.08*math.sin(x*.31)*math.sin(y*.23)
        terrain.face([(x,y,height(x,y)),(x+.75,y,height(x+.75,y)),(x+.75,y+.75,height(x+.75,y+.75)),(x,y+.75,height(x,y+.75))],tint=tint)
terrain.finish()
water=Batch('River_Water',[WATER],'water')
for a,b in zip(xs,xs[1:]):water.face([(a,pond_edges(a)[0],-.16),(b,pond_edges(b)[0],-.16),(b,pond_edges(b)[1],-.16),(a,pond_edges(a)[1],-.16)])
water.finish()


def rounded_outline(width,depth,radius,steps=12):
    result=[]
    for cx,cy,start in [(width/2-radius,depth/2-radius,0),(-width/2+radius,depth/2-radius,90),(-width/2+radius,-depth/2+radius,180),(width/2-radius,-depth/2+radius,270)]:
        for i in range(steps+1):
            a=math.radians(start+i*90/steps)
            result.append((cx+math.cos(a)*radius,cy+math.sin(a)*radius))
    return result

def slab(batch,width,depth,radius,top,bottom,ring=False):
    points=rounded_outline(width,depth,radius)
    if not ring:batch.face([(x,y,top) for x,y in points],tint=.94)
    for a,b in zip(points,points[1:]+points[:1]):batch.face([(*a,bottom),(*b,bottom),(*b,top),(*a,top)],tint=.78)
    return points

# A thick slate court rests inside the same stone apron as the garden paths.
foundation=Batch('Amphitheatre_Stage_Foundation',[STONE,STONE_TOP],'architecture')
outer=slab(foundation,16.8,12.8,2.8,.52,.08)
# Radial joints delineate generous coping stones without drawing a grid over the court.
inner=rounded_outline(12.3,8.3,1.35)
for i in range(len(inner)):
    j=(i+1)%len(inner)
    foundation.face([(*inner[i],.535),(*outer[i],.535),(*outer[j],.535),(*inner[j],.535)],1,rng.uniform(.66,.83))
# Broad arrival steps emerge from the apron; the side approach stays level.
for width,depth,top,y in [(10.8,.64,.18,-7.34),(12,.62,.36,-6.76)]:
    foundation.box((0,y,top/2),(width,depth,top),mat=1,tint=.73)
foundation.finish()
deck=Batch('Stage_Planks',[SLATE],'stage-proxy')
slab(deck,12,8,1.2,.55,.35)
deck.finish()['tka_stage_deck_top']=.55

paths=Batch('Amphitheatre_Arrival',[STONE_TOP],'path')
for path,width in [(ARRIVAL,3.1),(SERVICE,2.7)]:
    # Continuous paved ribbons with restrained irregular cross-joints.
    for i,(a,b) in enumerate(zip(path,path[1:])):
        dx,dy=b[0]-a[0],b[1]-a[1]
        length=math.hypot(dx,dy)
        nx,ny=-dy/length,dx/length
        edge=[]
        for q,sign in [(a,-1),(b,-1),(b,1),(a,1)]:
            x,y=q[0]+nx*width*.5*sign,q[1]+ny*width*.5*sign
            edge.append((x,y,grade(*q)+.012))
        paths.face(edge,tint=.62+(i%7)*.015)
paths.finish()

# Rounded, layered basalt with smaller pieces gathered into banks, never scattered on the court.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
prototype=bpy.context.object
rock_v=[tuple(v.co) for v in prototype.data.vertices]
rock_f=[tuple(p.vertices) for p in prototype.data.polygons]
bpy.data.objects.remove(prototype,do_unlink=True)
rocks=Batch('Amphitheatre_Shore_Stones',[STONE,STONE_TOP,DARK_MOSS],'stone')
def rock(center,scale,seed):
    local=random.Random(seed)
    angle=local.uniform(0,math.tau)
    points=[]
    for i,(a,b,c) in enumerate(rock_v):
        q=1+.09*math.sin(i*1.7+seed)
        a,b=a*scale[0]*q,b*scale[1]*q
        points.append((center[0]+a*math.cos(angle)-b*math.sin(angle),center[1]+a*math.sin(angle)+b*math.cos(angle),center[2]+c*scale[2]*q))
    for f in rock_f:
        z=sum(rock_v[j][2] for j in f)/3
        mat=2 if z>.38 and local.random()<.76 else 0
        rocks.face([points[j] for j in f],mat,local.uniform(.63,.89))
for side in [0,1]:
    for i in range(72):
        x=-24.7+i*35.4/71
        y=pond_edges(x)[side]+(-.24 if side==0 else .24)
        if abs(x)<8.9 and y<7.2:continue
        rock((x,y,-.01),(rng.uniform(.42,.90),rng.uniform(.4,.85),rng.uniform(.26,.60)),i+side*100)
for i in range(310):
    x,y=rng.uniform(-35,35),rng.uniform(-28,36)
    if abs(x)<9.5 and abs(y)<7.5:continue
    if route_distance(x,y)<4.8 or pond_distance(x,y)<1.2:continue
    # Tight groups on the raised banks, with a few large outcrops.
    cluster=max(math.exp(-((x-bx)**2+(y-by)**2)/70) for bx,by in [(12,18),(-18,15),(22,-4),(-22,-8)])
    if rng.random()>cluster*.85:continue
    s=rng.uniform(.5,1.8)
    rock((x,y,height(x,y)+.1),(s*1.3,s,s*.55),500+i)
for group,(gx,gy) in enumerate([(-12,1),(-13,5),(12,4),(17,8),(-24,9),(20,-8),(-10,-15)]):
    for k in range(9):
        x,y=gx+rng.uniform(-2.6,2.6),gy+rng.uniform(-2.4,2.4)
        s=rng.uniform(.45,1.4)
        if route_distance(x,y)<2+s*1.6 or pond_distance(x,y)<1.3:continue
        if abs(x)<9.6 and abs(y)<8:continue
        rock((x,y,height(x,y)-.12),(s*1.5,s,s*.75),1000+group*20+k)
rocks.finish()

# Botanical branching from the existing licensed PlantFactory family. Replace
# elongated oak-leaf polygons with rectangular flower-cluster cards, using the
# original cherry flower atlas with complete UVs.
FLOWER=material('Sakura flower clusters',(.95,.82,.86),.87)
shader=FLOWER.node_tree.nodes.get('Principled BSDF')
image=bpy.data.images.load(str(ROOT/'blender/blossom-plantfactory-family-r1/raw/open-crown-s19/maps/English_Oak_Cherry_Flower_FlowerCherry1_Color.png'),check_existing=True)
image.pack()
texture=FLOWER.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
FLOWER.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
FLOWER.node_tree.links.new(texture.outputs['Alpha'],shader.inputs['Alpha'])
FLOWER.surface_render_method='DITHERED'
FLOWER.use_backface_culling=False
FLOWER['alphaCutoff']=.4


def botanical_template(candidate,seed,keep):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'static/models/blossom/candidates/plantfactory-family-r1/{candidate}-proof.glb'))
    bpy.context.view_layer.update()
    imported=[o for o in bpy.data.objects if o not in before]
    meshes=[o for o in imported if o.type=='MESH']
    all_points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    low=min(p.z for p in all_points);high=max(p.z for p in all_points);span=high-low
    root_points=[p for p in all_points if p.z<low+span*.025]
    origin=Vector((sum(p.x for p in root_points)/len(root_points),sum(p.y for p in root_points)/len(root_points),low))
    wood=Batch('Botanical_Wood_'+str(seed),[BARK],'bark')
    petals=Batch('Botanical_Flowers_'+str(seed),[FLOWER],'petals')
    local=random.Random(seed)
    card_count=0
    for obj in meshes:
        mesh=obj.data
        points=[(obj.matrix_world@v.co-origin)/span for v in mesh.vertices]
        foliage={i for i,m in enumerate(mesh.materials) if m and 'Foliage' in m.name}
        parent=list(range(len(points)))
        def find(i):
            while parent[i]!=i:
                parent[i]=parent[parent[i]];i=parent[i]
            return i
        for face in mesh.polygons:
            if face.material_index not in foliage:
                uv=[tuple(mesh.uv_layers.active.data[j].uv) for j in face.loop_indices] if mesh.uv_layers.active else None
                wood.face([points[j] for j in face.vertices],uv=uv)
            else:
                root=find(face.vertices[0])
                for j in face.vertices[1:]:parent[find(j)]=root
        cards={}
        for face in mesh.polygons:
            if face.material_index in foliage:cards.setdefault(find(face.vertices[0]),set()).update(face.vertices)
        for indices in cards.values():
            if local.random()>keep:continue
            center=sum((points[j] for j in indices),Vector())/len(indices)
            # Crown branches retain their shape while flower clusters have real
            # full-rectangle UVs. Small clusters prevent oversized paper shards.
            normal=Vector((local.uniform(-1,1),local.uniform(-1,1),local.uniform(-.5,1))).normalized()
            side=normal.cross(Vector((0,0,1))).normalized()
            up=normal.cross(side).normalized()
            size=local.uniform(.008,.016)
            petals.face([center-side*size-up*size,center+side*size-up*size,center+side*size+up*size,center-side*size+up*size],tint=local.uniform(.82,1.12),uv=[(0,0),(1,0),(1,1),(0,1)])
            card_count+=1
    for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
    wood_obj=wood.finish();flower_obj=petals.finish()
    bpy.context.view_layer.objects.active=wood_obj
    modifier=wood_obj.modifiers.new('Botanical branch budget','DECIMATE');modifier.ratio=.6
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print('BOTANICAL',candidate,card_count,'flower clusters',flush=True)
    return [wood_obj,flower_obj]

TEMPLATES=[botanical_template('open-crown-s19',19,.30),botanical_template('open-crown-s71',71,.24)]
tree_bounds=[]
placements=[(13.5,13.5,17,1.4,-.24),(-22,21.5,11,1.25,.6),(21,-2,12,1.18,2.7),(-17.5,-7,11.8,1.12,1.3),
            (14.5,-15,11,1.18,2.1),(-29,-22,12.5,1.2,.3),(-7,29,11.6,1.2,2),(23,23,12,1.13,1),(-27,26,11,1.16,3)]
for i in range(17):
    a=i*math.tau/17
    radius=45 if i==11 else 38
    placements.append((radius*math.cos(a),radius*math.sin(a),rng.uniform(8,12),rng.uniform(1,1.3),rng.uniform(0,math.tau)))
for i,(x,y,h,spread,yaw) in enumerate(placements):
    # Reserve the entire near-ground root system, not only a trunk center point.
    if pond_distance(x,y)<3.5:raise RuntimeError(f'Tree {i} is too close to the pond')
    if route_distance(x,y)<3.6:raise RuntimeError(f'Tree {i} blocks an approach')
    base=height(x,y)-.025
    template=TEMPLATES[i%2]
    for part,source in enumerate(template):
        obj=source.copy();obj.data=source.data
        if i<4:obj.data=source.data.copy()
        obj.name=('Ancient_Cherry_' if i==0 else 'Garden_Cherry_'+str(i)+'_')+('Wood' if part==0 else 'Flowers')
        obj.location=(x,y,base);obj.scale=(h*spread,h*spread,h);obj.rotation_euler.z=yaw
        obj['blossomRole']=('bark' if part==0 else 'petals') if i<9 else ('grove-bark' if part==0 else 'grove-petals')
        bpy.context.collection.objects.link(obj)
    tree_bounds.append({'id':str(i),'root':[x,y,base],'height':h,'rootClearance':pond_distance(x,y),'scale':h})
for pair in TEMPLATES:
    for obj in pair:bpy.data.objects.remove(obj,do_unlink=True)

# Low lanterns provide intimate pools of light and a consistent human scale.
lantern_positions=[(-6,-8.5),(7.8,-7.8),(-10,-14),(12.5,-8.8),(-17,7.5),(10,13.5),(18.5,14),(-22,-18.7)]
frames=Batch('Amphitheatre_Lantern_Frames',[WOOD,GOLD],'lantern')
washi=Batch('Amphitheatre_Lantern_Washi',[PAPER],'glow')
for x,y in lantern_positions:
    z=height(x,y)
    frames.box((x,y,z+.10),(.62,.62,.20),tint=.50)
    for dx in [-.23,.23]:
        for dy in [-.23,.23]:frames.box((x+dx,y+dy,z+.62),(.045,.045,.94),tint=.44)
    frames.box((x,y,z+1.11),(.67,.67,.10),tint=.43)
    frames.box((x,y,z+.34),(.52,.52,.025),tint=.47)
    frames.box((x,y,z+.82),(.52,.52,.025),tint=.47)
    washi.box((x,y,z+.64),(.43,.43,.85))
bpy.context.view_layer.update()
hero=bpy.data.objects['Ancient_Cherry_Wood']
branches=[hero.matrix_world @ v.co for v in hero.data.vertices]
hanging=[]
for target in [(8,10,10),(12,8,11),(18,10,12),(20,15,10)]:
    candidates=[p for p in branches if p.z>8 and p.z<14]
    anchor=min(candidates,key=lambda p:(p-Vector(target)).length)
    x,y,z=anchor.x,anchor.y,anchor.z-1.5
    frames.box((x,y,anchor.z-.6),(.016,.016,1.2),tint=.32)
    frames.box((x,y,z-.4),(.54,.54,.07),tint=.5)
    frames.box((x,y,z+.4),(.60,.60,.08),tint=.5)
    for dx in [-.24,.24]:
        for dy in [-.24,.24]:frames.box((x+dx,y+dy,z),(.025,.025,.82),tint=.5)
    washi.box((x,y,z),(.45,.45,.74))
    hanging.append({'anchor':list(anchor),'center':[x,y,z]})
frames.finish();washi.finish()

# Layered sedge and small flowering shrubs replace the exposed flat lawn.
plants=Batch('Amphitheatre_Understory',[GRASS,DARK_MOSS],'understory')
for i in range(64000):
    x,y=rng.uniform(-36,36),rng.uniform(-30,36)
    if abs(x)<9.4 and abs(y)<7.5:continue
    if route_distance(x,y)<2.8 or pond_distance(x,y)<.9:continue
    near_bank=pond_distance(x,y)<4.8
    near_tree=min(math.hypot(x-t['root'][0],y-t['root'][1]) for t in tree_bounds)<5
    if not near_bank and not near_tree and rng.random()>.14:continue
    z=height(x,y)
    for blade in range(5):
        a=rng.uniform(0,math.tau);h=rng.uniform(.12,.38);w=rng.uniform(.045,.10)
        side=Vector((-math.sin(a)*w,math.cos(a)*w,0))
        base=Vector((x,y,z));mid=base+Vector((math.cos(a)*h*.23,math.sin(a)*h*.23,h*.62))
        tip=base+Vector((math.cos(a)*h*.64,math.sin(a)*h*.64,h))
        plants.face([base-side,base+side,mid+side*.45,mid-side*.45],tint=rng.uniform(.65,1.1))
        plants.face([mid-side*.45,mid+side*.45,tip],tint=rng.uniform(.75,1.2))
# Ferns give the nearby banks broad, readable leaves among the finer sedge.
for i in range(2200):
    x,y=rng.uniform(-27,27),rng.uniform(-23,27)
    if abs(x)<9.5 and abs(y)<7.6:continue
    if route_distance(x,y)<3.0 or pond_distance(x,y)<1:continue
    if pond_distance(x,y)>5 and min(math.hypot(x-t['root'][0],y-t['root'][1]) for t in tree_bounds)>6:continue
    z=height(x,y)
    for frond in range(5):
        a=frond*math.tau/5+rng.random()*.3
        axis=Vector((math.cos(a),math.sin(a),0));across=Vector((-axis.y,axis.x,0))
        length=rng.uniform(.45,.9)
        for station in range(1,7):
            t=station/7;center=Vector((x,y,z))+axis*length*t+Vector((0,0,math.sin(t*2)*length*.7))
            for sign in [-1,1]:
                tip=center+across*sign*length*.26*(1-t)+axis*length*.12
                plants.face([center-axis*.06,tip,center+axis*.06],tint=rng.uniform(.8,1.3))
plants.finish()
petal_mat=material('Settled pale petals',(.56,.30,.33),.9)
petals=Batch('Amphitheatre_Fallen_Petals',[petal_mat],'settled-petals')
for i in range(4600):
    x,y=rng.uniform(-25,26),rng.uniform(-20,28)
    if pond_distance(x,y)==0:continue
    if abs(x)<6.2 and abs(y)<4.2:continue
    nearest=min(math.hypot(x-t['root'][0],y-t['root'][1]) for t in tree_bounds)
    if nearest>9 and rng.random()>.1:continue
    z=height(x,y)+.012
    if abs(x)<8.3 and abs(y)<6.3:z=.549
    if route_distance(x,y)<1.5:z=grade(x,y)+.021
    r=rng.uniform(.02,.048)
    petals.face([(x-r,y,z),(x,y-r*.6,z),(x+r,y,z),(x,y+r*.6,z)],tint=rng.uniform(.5,.95))
petals.finish()

# Reuse the public runtime contract while recording the new authored composition.
plan=json.loads(PLAN.read_text())
plan.update(planId='blossom-lantern-garden',status='authored',trees=tree_bounds,lanterns=[[x,y,height(x,y)+.65] for x,y in lantern_positions])
plan['hangingLanterns']=hanging
plan['site']['terrainBounds']={'minX':-72,'maxX':72,'minY':-72,'maxY':72}
plan['water']={'outline':outline,'centerline':[[x,sum(pond_edges(x))/2] for x in xs],'surfaceElevation':-.16,'bedDepth':.79,'shoreFadeMetres':.6}
plan['circulation']['paths']=[{'id':name,'label':name,'kind':kind,'width':width,'from':name+'-entry','to':'stage','crossSlopePercent':0,'centerline':[[x,y,grade(x,y)] for x,y in points]} for name,kind,width,points in [('arrival','primary-accessible',3.1,ARRIVAL),('service','restricted-service',2.7,SERVICE)]]
plan['camera']['default']={'position':[0,-24,6.8],'target':[0,7,2.8],'fov':48}
plan['camera']['portrait']={'position':[3,-38,8.6],'target':[3,7,2.8],'fov':48}
plan['approvalGate']['visualAcceptance']='pending-user-review'
plan['stage']['operations']={'minimumAudienceSetbackFromDeck':2,'backstageAccessSide':'east','backstageServicePathId':'service',
    'backstageStagingArea':{'minX':10,'maxX':16,'minY':-1,'maxY':4},
    'propStorageArea':{'minX':16,'maxX':18,'minY':1,'maxY':4},
    'technicalPosition':{'minX':9,'maxX':11,'minY':-6,'maxY':-4,'accessPathId':'service'},
    'emergencyCorridors':[{'id':'east','minX':7,'maxX':10,'minY':-8,'maxY':1}]}
(OUT/'amphitheatre-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
PLAN.write_text(json.dumps(plan,indent=2)+'\n')
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.12,.22,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35

def area(name,position,power,color,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Silver garden moon',(-10,8,28),5000,(.55,.72,1),12,(0,0,0))
area('Cherry blossom rim',(15,15,23),4500,(1,.67,.57),10,(10,17,6))
area('Quiet court fill',(-7,-12,15),1200,(.66,.78,1),14,(0,0,0))
for x,y in lantern_positions:
    data=bpy.data.lights.new('Lantern pool','POINT');data.energy=65;data.color=(1,.46,.14);data.shadow_soft_size=.28
    obj=bpy.data.objects.new('Lantern pool',data);bpy.context.collection.objects.link(obj);obj.location=(x,y,height(x,y)+.65)
cam_data=bpy.data.cameras.new('Lantern garden review');camera=bpy.data.objects.new('Lantern garden review',cam_data);bpy.context.collection.objects.link(camera)
camera.location=(0,-24,6.8);camera.rotation_euler=(Vector((0,7,2.8))-camera.location).to_track_quat('-Z','Y').to_euler();cam_data.lens=39
scene.camera=camera;scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=str(EVIDENCE/'blender-review.png')
from blossom_garden_materials import apply_garden_materials
apply_garden_materials(ROOT)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
objects=[o for o in scene.objects if o.type=='MESH' and o.get('blossomRole')]
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'blossom_environment_raw.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_lights=False,export_cameras=False,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
manifest={'design':'Blossom lantern garden','meshes':len(objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'heroTrees':1,'companionTrees':len(tree_bounds)-1,'stageDeckTop':.55,'sourceFamily':'blossom-plantfactory-family-r1'}
(OUT/'amphitheatre-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest),flush=True)
if not os.environ.get('BLOSSOM_SKIP_RENDER'):bpy.ops.render.render(write_still=True)
