"""Build Moonlit Blossom: a sculpted cherry amphitheatre, with portable mesh art.

Run in background Blender with --factory-startup --threads 6. The authored
layout also emits the runtime water/camera contract. Set BLOSSOM_SKIP_RENDER=1
to export without the Cycles review render. No external assets are required.
"""
from pathlib import Path
import json
import math
import os
import random

import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.noise import noise

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'static/models/blossom'
BLEND = ROOT / 'blender/blossom/moonlit-amphitheatre.blend'
EVIDENCE = ROOT / 'docs/superpowers/specs/blossom-amphitheatre/evidence'
for directory in (OUT, BLEND.parent, EVIDENCE):
    directory.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
rng = random.Random(9062026)


def material(name, color, roughness=.85, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


MOSS = material('Amphitheatre moss', (.045, .075, .052))
STONE = material('Weathered blue basalt', (.075, .091, .10))
STONE_TOP = material('Worn silver stone', (.19, .21, .20))
BARK = material('Ancient cherry bark', (.095, .051, .036))
WOOD = material('Smoked cedar', (.21, .098, .044))
GOLD = material('Aged bronze', (.20, .12, .052), .47)
PAPER = material('Warm washi', (1, .46, .13), .72, 2.3)
WATER = material('Still midnight water', (.016, .038, .052), .17)
PETALS = [material('Sakura '+name, color, .88) for name, color in [
    ('ivory', (.85, .55, .62)), ('blush', (.70, .25, .36)),
    ('rose', (.42, .09, .18)), ('moon', (.96, .77, .79))]]


def surface_texture(mat, palette, bark=False):
    """Pack a portable procedural albedo; no Blender-only shader is required."""
    size=512
    image=bpy.data.images.new(mat.name+' albedo',width=size,height=size)
    pixels=[]
    for y in range(size):
        for x in range(size):
            u,v=x/size,y/size
            broad=noise(Vector((u*7,v*7,1.3)))
            grain=noise(Vector((u*75,v*75,4)))
            fine=noise(Vector((u*220,v*220,8)))
            value=.62+broad*.20+grain*.16+fine*.10
            if bark:
                value*=.60+.40*abs(math.sin(u*85+noise(Vector((u*15,v*3,2)))*3))
            pixels.extend((palette[0]*value,palette[1]*value,palette[2]*value,1))
    image.pixels.foreach_set(pixels)
    image.pack()
    nodes=mat.node_tree.nodes
    texture=nodes.new('ShaderNodeTexImage')
    texture.image=image
    mat.node_tree.links.new(texture.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])


surface_texture(MOSS,(.40,.47,.35))
surface_texture(STONE,(.35,.40,.44))
surface_texture(STONE_TOP,(.51,.54,.51))
surface_texture(BARK,(.38,.23,.18),True)
surface_texture(WOOD,(.42,.27,.16),True)


class Batch:
    def __init__(self, name, mats, role='venue'):
        self.name, self.mats, self.role = name, mats, role
        self.v, self.f, self.mi, self.colors, self.uv = [], [], [], [], []

    def face(self, points, mat=0, tint=1, uv=None):
        start = len(self.v)
        self.v.extend(tuple(p) for p in points)
        self.f.append(tuple(range(start, start+len(points))))
        self.mi.append(mat)
        self.colors.extend([(tint, tint, tint, 1)] * len(points))
        repeat=5 if self.role=='terrain' else 2.2
        self.uv.extend(uv if uv is not None else [(p[0]/repeat,(p[1]+p[2])/repeat) for p in points])

    def box(self, center, size, yaw=0, mat=0, tint=1):
        x, y, z = center
        sx, sy, sz = [a/2 for a in size]
        points = []
        for dx, dy, dz in [(-sx,-sy,-sz),(sx,-sy,-sz),(sx,sy,-sz),(-sx,sy,-sz),
                           (-sx,-sy,sz),(sx,-sy,sz),(sx,sy,sz),(-sx,sy,sz)]:
            points.append((x+dx*math.cos(yaw)-dy*math.sin(yaw),
                           y+dx*math.sin(yaw)+dy*math.cos(yaw),z+dz))
        for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
            self.face([points[i] for i in face], mat, tint)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name+' Mesh')
        mesh.from_pydata(self.v, [], self.f)
        mesh.materials.clear()
        for mat in self.mats:
            mesh.materials.append(mat)
        colors = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
        for i, value in enumerate(self.colors):
            colors.data[i].color = value
        for poly, mat in zip(mesh.polygons, self.mi):
            poly.material_index = mat
            poly.use_smooth = self.role in ('bark', 'terrain', 'petals')
        uv=mesh.uv_layers.new(name='SurfaceUV')
        for loop in mesh.loops:
            uv.data[loop.index].uv=self.uv[loop.vertex_index]
        if self.role in ('bark', 'terrain'):
            # Faces are batched independently; weld their common positions so
            # smooth normals continue around the trunk and across the lawn.
            bm=bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
            bm.to_mesh(mesh)
            bm.free()
            mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        obj['blossomRole'] = self.role
        return obj


def tube(batch, controls, radii, steps=30, sides=10, rough=.05, mat=0):
    """A tapered, irregular Bezier limb; radius remains continuous at forks."""
    controls = [Vector(p) for p in controls]
    rings = []
    for i in range(steps+1):
        t = i/steps
        p = controls[0]*(1-t)**3 + controls[1]*3*t*(1-t)**2 + controls[2]*3*t*t*(1-t) + controls[3]*t**3
        tangent = ((controls[1]-controls[0])*3*(1-t)**2 + (controls[2]-controls[1])*6*t*(1-t) + (controls[3]-controls[2])*3*t*t).normalized()
        side = tangent.cross(Vector((0,1,0))).normalized()
        if side.length < .1:
            side = tangent.cross(Vector((1,0,0))).normalized()
        up = tangent.cross(side).normalized()
        radius = radii[0]*(1-t)**1.1+radii[1]*t
        ring = []
        for j in range(sides):
            a = j*math.tau/sides
            ripple = 1+rough*math.sin(j*2.4+t*13)+rough*.5*math.cos(j*4.3-t*9)
            ring.append(p+(side*math.cos(a)+up*math.sin(a))*radius*ripple)
        rings.append(ring)
    for i in range(steps):
        for j in range(sides):
            k = (j+1)%sides
            batch.face([rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]], mat,
                       .72+.27*(.5+.5*math.sin(j*2.1)),
                       [(j/sides,i/steps*5),((j+1)/sides,i/steps*5),
                        ((j+1)/sides,(i+1)/steps*5),(j/sides,(i+1)/steps*5)])


ARRIVAL = [(25,-34),(23,-27),(18,-21),(14,-16),(12,-10),(8,-6.5)]
SERVICE = [(-27,-32),(-23,-22),(-18,-15),(-11,-8),(-8,-6.5)]


def smooth_route(route):
    padded=[route[0],*route,route[-1]]
    points=[]
    for i in range(len(padded)-3):
        a,b,c,d=[Vector(p) for p in padded[i:i+4]]
        for j in range(32):
            t=j/32
            point=(b*2+(-a+c)*t+(a*2-b*5+c*4-d)*t*t+(-a+b*3-c*3+d)*t*t*t)*.5
            if not points or math.dist(point,points[-1])>=.68:
                points.append(tuple(point))
    points.append(route[-1])
    return points


ARRIVAL=smooth_route(ARRIVAL)
SERVICE=smooth_route(SERVICE)


def segment_distance(x,y,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/max(dx*dx+dy*dy,.0001)))
    return math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)


def route_distance(x,y):
    return min(segment_distance(x,y,a,b) for route in (ARRIVAL,SERVICE) for a,b in zip(route,route[1:]))


def pool_edges(x):
    front=5.6+.0125*x*x
    width=8.1*max(0,1-(x/27)**2)**.55
    return front,front+width


def height(x,y):
    r=math.hypot(x,y)
    h=.035*math.sin(x*.4)*math.sin(y*.45)
    if y<0 and r>11:
        h+=max(0,min(1,(r-11)/2))*.22
        h+=max(0,min(1,(r-16)/2))*.38
        h+=max(0,min(1,(r-21)/2))*.48
    if r>27:
        h+=min(6,(r-27)*.19)*(1+.35*math.sin(math.atan2(y,x)*3+1))
        h+=max(0,(r-36)/18)*(.8+.6*math.sin(x*.13+y*.08))
    # The two arrival aisles rise continuously through the terraces.
    distance=route_distance(x,y)
    if distance<2.5:
        grade=max(0,min(1.4,(r-9)*.047))
        blend=max(0,min(1,(2.5-distance)/.65))
        h=h*(1-blend)+grade*blend
    if abs(x)<27:
        front,back=pool_edges(x)
        if front-.6<y<back+.6:
            shore=min(y-front,back-y)
            h=min(h, -.19-max(0,min(1,shore/.65))*.75)
    if abs(x)<7 and abs(y)<4.8:
        h=0
    return h


ground=Batch('Amphitheatre_Terrain',[MOSS],'terrain')
size=160
step=1
for iy in range(size):
    y=iy-size/2
    for ix in range(size):
        x=ix-size/2
        noise=.70+.22*math.sin(x*.27+y*.17)*math.cos(y*.21-x*.1)+rng.random()*.10
        ground.face([(x,y,height(x,y)),(x+step,y,height(x+step,y)),
                     (x+step,y+step,height(x+step,y+step)),(x,y+step,height(x,y+step))],tint=noise)
ground.finish()

# A closed crescent is shared verbatim with the runtime reflector.
xs=[-27+i*54/96 for i in range(97)]
outline=[(x,pool_edges(x)[0]) for x in xs]+[(x,pool_edges(x)[1]) for x in reversed(xs[1:-1])]
water=Batch('River_Water',[WATER],'water')
for a,b in zip(xs,xs[1:]):
    water.face([(a,pool_edges(a)[0],-.16),(b,pool_edges(b)[0],-.16),
                (b,pool_edges(b)[1],-.16),(a,pool_edges(a)[1],-.16)])
water.finish()

# Three seating terraces, interrupted at both continuous circulation aisles.
walls=Batch('Amphitheatre_Terraces',[STONE,STONE_TOP],'stone')
for radius,top in [(13.5,.67),(18.5,1.05),(23.5,1.53)]:
    for degree in range(191,350,2):
        a=math.radians(degree)
        x,y=radius*math.cos(a),radius*math.sin(a)
        if route_distance(x,y)<2.0:
            continue
        length=radius*math.radians(2)*1.02
        walls.box((x,y,top-.28),(length,.68,.56),a+math.pi/2,tint=rng.uniform(.70,1.12))
        walls.box((x,y,top+.025),(length+.02,.79,.09),a+math.pi/2,mat=1,tint=rng.uniform(.75,1))
walls.finish()

paths=Batch('Amphitheatre_Arrival',[STONE_TOP],'path')
for route in (ARRIVAL,SERVICE):
    for a,b in zip(route,route[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1]
        length=math.hypot(dx,dy)
        nx,ny=-dy/length,dx/length
        count=math.ceil(length/.72)
        for i in range(count):
            t=(i+.5)/count
            x,y=a[0]+dx*t,a[1]+dy*t
            z=max(0,min(1.4,(math.hypot(x,y)-9)*.047))
            paths.box((x,y,z+.04),(2.5,length/count-.045,.11),math.atan2(dy,dx)-math.pi/2,
                      tint=rng.uniform(.64,.95))
paths.finish()

rim=Batch('Amphitheatre_Stage_Foundation',[STONE,STONE_TOP],'stone')
rim.box((0,0,.13),(12.6,8.6,.25))
rim.finish()
deck=Batch('Stage_Planks',[WOOD],'stage-proxy')
for i in range(28):
    deck.box((0,-4+(i+.5)*8/28,.47),(12,8/28-.014,.16),tint=rng.uniform(.74,1.04))
proxy=deck.finish()
proxy['tka_stage_deck_top']=.55

# River stones have varied silhouettes and moss-darkened lower faces.
rocks=Batch('Amphitheatre_Shore_Stones',[STONE,STONE_TOP],'stone')
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
rock_source=bpy.context.object
rock_v=[tuple(v.co) for v in rock_source.data.vertices]
rock_f=[tuple(p.vertices) for p in rock_source.data.polygons]
bpy.data.objects.remove(rock_source,do_unlink=True)


def boulder(batch,center,scale):
    points=[]
    angle=rng.uniform(0,math.tau)
    for i,(x,y,z) in enumerate(rock_v):
        rough=1+.12*math.sin(i*3.7)
        x,y=x*scale[0]*rough,y*scale[1]*rough
        points.append((center[0]+x*math.cos(angle)-y*math.sin(angle),
                       center[1]+x*math.sin(angle)+y*math.cos(angle),center[2]+z*scale[2]*rough))
    for face in rock_f:
        batch.face([points[i] for i in face],tint=rng.uniform(.76,1.04))
for side in (0,1):
    for i in range(100):
        x=-26.8+i*53.6/99
        y=pool_edges(x)[side]+(-.22 if side==0 else .22)
        if 8<x<16 and side==0:
            continue
        sx=rng.uniform(.28,.62)
        sy=rng.uniform(.30,.58)
        sz=rng.uniform(.14,.36)
        boulder(rocks,(x,y,-.03),(sx,sy,sz))
for x,y in [(15,6),(17,5),(-22,17),(-24,-8),(27,-12),(-18,-23),(11,-29)]:
    boulder(rocks,(x,y,height(x,y)+.20),(rng.uniform(1,1.7),rng.uniform(.8,1.3),rng.uniform(.6,.95)))
rocks.finish()

trunk=Batch('Ancient_Cherry_Wood',[BARK],'bark')
flowers=Batch('Ancient_Cherry_Blossoms',PETALS,'petals')
tree_bounds=[]


def blossom_cloud(batch, center, scale, count, seed):
    local=random.Random(seed)
    center=Vector(center)
    for i in range(count):
        az=local.uniform(0,math.tau)
        nz=local.uniform(-1,1)
        radial=math.sqrt(max(0,1-nz*nz))
        shell=local.uniform(.76,1.04)
        normal=Vector((radial*math.cos(az),radial*math.sin(az),nz))
        p=center+Vector((normal.x*scale[0],normal.y*scale[1],normal.z*scale[2]))*shell
        normal=(normal+Vector((0,0,.35))).normalized()
        tangent=normal.cross(Vector((0,1,0))).normalized()
        up=normal.cross(tangent).normalized()
        radius=local.uniform(.10,.18)
        turn=local.uniform(0,math.tau)
        mat=local.choices([0,1,2,3],[45,25,10,20])[0]
        tint=local.uniform(.72,1.04)
        for petal in range(5):
            a=turn+petal*math.tau/5
            axis=tangent*math.cos(a)+up*math.sin(a)
            across=-tangent*math.sin(a)+up*math.cos(a)
            base=p+axis*radius*.14
            left=p+axis*radius*.61+across*radius*.35+normal*radius*.15
            tip=p+axis*radius+normal*radius*.29
            right=p+axis*radius*.61-across*radius*.35+normal*radius*.15
            batch.face([base,right,tip,left],mat,tint)


def cherry(base, scale, seed, hero=False):
    local=random.Random(seed)
    x,y=base
    z=height(x,y)
    wood=trunk if hero else Batch('Companion_Cherry_Wood_'+str(seed),[BARK],'bark')
    petals=flowers if hero else Batch('Companion_Cherry_Blossoms_'+str(seed),PETALS,'petals')
    rotation=0 if hero else local.uniform(0,math.tau)
    spread=1 if hero else local.uniform(.82,1.16)
    def p(a,b,c):
        return (x+(a*math.cos(rotation)-b*math.sin(rotation))*scale*spread,
                y+(a*math.sin(rotation)+b*math.cos(rotation))*scale*spread,z+c*scale)
    # The old trunk bends toward the court; its forks stay above the prop volume.
    tube(wood,[p(0,0,0),p(.8,-.8,2.4),p(-1.8,-.1,4.5),p(-2.4,.6,6.4)],
         (1.12*scale,.43*scale),36,14,.14)
    for root in range(7):
        a=root*math.tau/7+.2
        end=p(math.cos(a)*3.1,math.sin(a)*2.5,.02)
        tube(wood,[p(0,0,.6),p(math.cos(a),math.sin(a),.3),
                   p(math.cos(a)*2.5,math.sin(a)*2,.1),end],(.42*scale,.025*scale),12,8,.08)
    crown=[]
    for branch in range(8):
        angle=branch*math.tau/8+.28+local.uniform(-.16,.16)
        reach=local.uniform(3.6,6.4)
        if hero and branch in (3,4):
            reach+=3.4
        end=(-2.4+math.cos(angle)*reach,.6+math.sin(angle)*reach,local.uniform(7.6,9.5))
        tube(wood,[p(-1.5,.1,4.6),p(-3,.6,6.7),p(end[0]*.8,end[1]*.8,end[2]-.5),p(*end)],
             (.39*scale,.08*scale),23,10,.09)
        # Flowering side forks break up the spoke silhouette and carry blossom
        # back through the canopy, rather than collecting only at branch tips.
        for fork in range(2 if hero else 1):
            t=.58+fork*.18
            root=Vector((-1.5,.1,4.6))*(1-t)**3+Vector((-3,.6,6.7))*3*t*(1-t)**2+Vector((end[0]*.8,end[1]*.8,end[2]-.5))*3*t*t*(1-t)+Vector(end)*t**3
            sign=-1 if (branch+fork)%2 else 1
            tip=root+Vector((math.cos(angle+sign*.85)*1.5,math.sin(angle+sign*.85)*1.5,local.uniform(.6,1.3)))
            bend=root+Vector((math.cos(angle+sign*1.2)*.8,math.sin(angle+sign*1.2)*.8,.8))
            tube(wood,[p(*root),p(*bend),p(tip.x,tip.y,tip.z+.3),p(*tip)],(.12*scale,.016*scale),12,8,.07)
            center=p(*tip)
            crown.append(center)
            blossom_cloud(petals,center,(1.12*scale,.9*scale,.7*scale),340 if hero else (90 if seed>=300 else 180),seed*1000+branch*2+fork)
        for twig in range(4):
            angle2=angle+(twig-1.5)*.55
            reach2=local.uniform(1.3,2.3)
            tip=(end[0]+math.cos(angle2)*reach2,end[1]+math.sin(angle2)*reach2,end[2]+local.uniform(-.15,1.1))
            tube(wood,[p(end[0]-.5,end[1],end[2]-.5),p(*end),
                       p(tip[0],tip[1],tip[2]-.3),p(*tip)],(.085*scale,.012*scale),10,6,.04)
            center=p(*tip)
            crown.append(center)
            blossom_cloud(petals,center,(local.uniform(1.1,1.7)*scale,local.uniform(.85,1.4)*scale,local.uniform(.55,.85)*scale),
                          620 if hero else (130 if seed>=300 else 300),seed*100+branch*4+twig)
    if not hero:
        wood_object=wood.finish()
        petal_object=petals.finish()
        if seed>=300:
            wood_object['blossomRole']='grove-bark'
            petal_object['blossomRole']='grove-petals'
    tree_bounds.append({'id':'ancient' if hero else str(seed),'root':[x,y,z],
                        'crownCenters':crown,'scale':scale})


cherry((12,7),1.28,101,True)
trunk.finish()
flowers.finish()
for i,(x,y,s) in enumerate([(-18,16,.80),(-26,8,.68),(-28,-8,.73),(-27,-20,.60),
                            (-10,-29,.53),(8,-31,.64),(28,-13,.77),(30,8,.68),
                            (18,28,.58),(-5,29,.70),(-29,28,.60)]):
    cherry((x,y),s,201+i)

# Three authored grove forms are instanced into a continuous enclosing canopy.
grove_templates=[]
for i in range(38):
    angle=i*math.tau/38+.13
    r=38+rng.uniform(-3,3)
    base=(math.cos(angle)*r,math.sin(angle)*r)
    if route_distance(*base)<5:
        r+=10
        base=(math.cos(angle)*r,math.sin(angle)*r)
    if i<3:
        cherry(base,rng.uniform(.53,.69),301+i)
        grove_templates.append((base,height(*base),301+i))
    else:
        origin,origin_z,seed=grove_templates[i%3]
        turn=rng.uniform(-.9,.9)
        growth=rng.uniform(.87,1.18)
        transform=(Matrix.Translation(Vector((*base,height(*base)))) @
                   Matrix.Rotation(turn,4,'Z') @ Matrix.Scale(growth,4) @
                   Matrix.Translation(Vector((-origin[0],-origin[1],-origin_z))))
        for prefix in ('Companion_Cherry_Wood_','Companion_Cherry_Blossoms_'):
            source=bpy.data.objects[prefix+str(seed)]
            clone=source.copy()
            clone.data=source.data
            clone.matrix_world=transform
            bpy.context.collection.objects.link(clone)
        tree_bounds.append({'id':str(301+i),'root':[*base,height(*base)],'instanceOf':str(seed),'scale':growth})

lantern_positions=[(-5,-8),(-18.7,-10.5),(7,-9.5),(20.5,-18),(-20,-26),(7,-25),(-19,17),(21,18)]
frames=Batch('Amphitheatre_Lantern_Frames',[WOOD,GOLD],'lantern')
paper=Batch('Amphitheatre_Lantern_Washi',[PAPER],'glow')
for x,y in lantern_positions:
    z=height(x,y)
    frames.box((x,y,z+.15),(.65,.65,.3))
    frames.box((x,y,z+.85),(.12,.12,1.5))
    for dx in (-.24,.24):
        for dy in (-.24,.24): frames.box((x+dx,y+dy,z+1.55),(.045,.045,.70))
    frames.box((x,y,z+1.2),(.60,.60,.07))
    frames.box((x,y,z+1.93),(.69,.69,.10))
    paper.box((x,y,z+1.55),(.43,.43,.61))
frames.finish()
paper.finish()

# Fern-like ground plants gather in banks and under trees, leaving the court
# and the two circulation aisles open.
fern_mat=material('Fern shadow green',(.055,.095,.044))
ferns=Batch('Amphitheatre_Understory',[fern_mat],'understory')
for i in range(8500):
    x,y=rng.uniform(-38,38),rng.uniform(-35,34)
    r=math.hypot(x,y)
    bank=abs(x)<26 and min(abs(y-pool_edges(x)[0]),abs(y-pool_edges(x)[1]))<2.4
    beneath=any(math.hypot(x-tree['root'][0],y-tree['root'][1])<3.5 for tree in tree_bounds)
    if not(bank or beneath or (r>25 and rng.random()<.3)):continue
    if route_distance(x,y)<2.5:continue
    if abs(x)<8 and abs(y)<6:continue
    if -27<x<27 and pool_edges(x)[0]<y<pool_edges(x)[1]:continue
    z=height(x,y)+.015
    for frond in range(rng.randint(3,5)):
        a=rng.uniform(0,math.tau)
        length=rng.uniform(.40,.95)
        for leaf in range(1,9):
            t=leaf/9
            middle=Vector((x+math.cos(a)*length*t,y+math.sin(a)*length*t,z+math.sin(t*math.pi*.8)*length*.50))
            across=Vector((-math.sin(a),math.cos(a),.1))
            forward=Vector((math.cos(a),math.sin(a),.04))
            width=.17*math.sin(t*math.pi)*length
            for side in (-1,1):
                tip=middle+across*width*side+forward*.07
                ferns.face([middle-forward*.025,tip,middle+forward*.035],tint=rng.uniform(.65,1.12))
ferns.finish()

petal_drift=Batch('Amphitheatre_Fallen_Petals',PETALS,'settled-petals')
for i in range(5800):
    x=rng.gauss(10,7.5)
    y=rng.gauss(5,7)
    if abs(x)<6.5 and abs(y)<4.8: continue
    if -27<x<27 and pool_edges(x)[0]<y<pool_edges(x)[1]: continue
    z=height(x,y)+.016
    a=rng.uniform(0,math.tau)
    r=rng.uniform(.03,.072)
    petal_drift.face([(x+math.cos(a+j*math.tau/4)*r,y+math.sin(a+j*math.tau/4)*r*.6,z)
                      for j in range(4)],rng.choice([0,0,1,3]),rng.uniform(.6,1))
petal_drift.finish()

# A small timber entry portal marks the arrival without competing with the tree.
entry=Batch('Amphitheatre_Entry_Portal',[WOOD,GOLD],'stone')
entry_z=height(24,-29)
for x in (21.5,26.5): entry.box((x,-29,entry_z+1.9),(.30,.30,3.8))
entry.box((24,-29,entry_z+3.8),(6.4,.43,.32))
entry.box((24,-29,entry_z+3.3),(5.5,.22,.15),mat=1)
entry.finish()

stage_ops={'minimumAudienceSetbackFromDeck':2,'backstageAccessSide':'west',
           'backstageServicePathId':'service',
           'backstageStagingArea':{'minX':-16,'maxX':-10,'minY':-6,'maxY':-1},
           'propStorageArea':{'minX':-18,'maxX':-16,'minY':-6,'maxY':-3},
           'technicalPosition':{'minX':-10,'maxX':-8,'minY':-12,'maxY':-9,'accessPathId':'service'},
           'emergencyCorridors':[{'id':'west','minX':-10,'maxX':-7,'minY':-8,'maxY':1}]}
plan={'planId':'blossom-moonlit-amphitheatre','status':'authored','activeProductionPhase':5,
      'approvalGate':{'productionChangesAllowed':True,'visualAcceptance':'pending-user-review'},
      'site':{'terrainBounds':{'minX':-80,'maxX':80,'minY':-80,'maxY':80},
              'playableClearingBounds':{'minX':-7,'maxX':7,'minY':-5,'maxY':5},'softHorizonBandMetres':18,
              'gradeStrategy':{'stageElevation':.55,'audienceLawnSlopePercent':4.7,'northBankElevation':0,'perimeterBermRange':[3,10]}},
      'stage':{'center':[0,0],'width':12,'depth':8,'deckTop':.55,
               'performanceEnvelope':{'minX':-7,'maxX':7,'minY':-5,'maxY':5,'minZ':.55,'maxZ':6},
               'protectedClearance':{'minX':-8,'maxX':8,'minY':-5.4,'maxY':5.4},'operations':stage_ops},
      'audience':{'capacity':48,'zones':[]},
      'circulation':{'paths':[{'id':name,'label':name,'kind':kind,'width':2.5,'from':name+'-entry','to':'stage',
                              'crossSlopePercent':0,'centerline':[[x,y,max(0,min(1.4,(math.hypot(x,y)-9)*.047))] for x,y in route]}
                             for name,kind,route in [('arrival','primary-accessible',ARRIVAL),('service','restricted-service',SERVICE)]]},
      'water':{'outline':outline,'centerline':[[x,sum(pool_edges(x))/2] for x in xs],
               'surfaceElevation':-.16,'bedDepth':.78,'shoreFadeMetres':.8},
      'camera':{'default':{'position':[-19,-26,15],'target':[1,3,3],'fov':48},
                'controls':{'minimumDistance':10,'maximumDistance':48,'minimumPolarAngleDegrees':20,
                            'maximumPolarAngleDegrees':82,'panTargetBounds':{'minX':-5,'maxX':5,'minY':-5,'maxY':5}}},
      'trees':tree_bounds,'lanterns':[[x,y,height(x,y)+1.55] for x,y in lantern_positions]}
(OUT/'amphitheatre-plan.json').write_text(json.dumps(plan,indent=2)+'\n',encoding='utf-8')

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.world.color=(.08,.08,.08)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.085,.16,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.34


def area(name,position,power,color,size,target):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.color=color
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


area('Silver moon',(0,8,32),10500,(.65,.76,1),15,(0,0,0))
area('Warm stage',(-4,-9,12),1800,(1,.72,.45),10,(0,0,0))
area('Petal rim',(20,15,22),8000,(1,.57,.65),11,(10,7,7))
for x,y in lantern_positions:
    data=bpy.data.lights.new('Lantern','POINT')
    data.energy=35
    data.color=(1,.48,.16)
    data.shadow_soft_size=.4
    obj=bpy.data.objects.new('Lantern',data)
    bpy.context.collection.objects.link(obj)
    obj.location=(x,y,height(x,y)+1.6)
camera_data=bpy.data.cameras.new('Moonlit garden review')
camera=bpy.data.objects.new('Moonlit garden review',camera_data)
bpy.context.collection.objects.link(camera)
camera.location=(-28,-37,24)
camera.rotation_euler=(Vector((2,3,4))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.lens=44
scene.camera=camera
scene.render.resolution_x=1440
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.render.filepath=str(EVIDENCE/'blender-overview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
runtime=[o for o in scene.objects if o.type=='MESH' and o.get('blossomRole')]
bpy.ops.object.select_all(action='DESELECT')
for obj in runtime: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'blossom_environment_raw.glb'),export_format='GLB',use_selection=True,
                         export_extras=True,export_yup=True,export_animations=False,export_lights=False,export_cameras=False,
                         export_vertex_color='ACTIVE',export_all_vertex_colors=False)
manifest={'design':'Moonlit Blossom amphitheatre','meshes':len(runtime),
          'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in runtime),
          'heroTrees':1,'companionTrees':len(tree_bounds)-1,'stageDeckTop':.55}
(OUT/'amphitheatre-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest),flush=True)
if not os.environ.get('BLOSSOM_SKIP_RENDER'):
    bpy.ops.render.render(write_still=True)
