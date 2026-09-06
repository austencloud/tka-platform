"""Portable material and mesh construction for the Blossom garden."""
import math
import bpy
import bmesh
from mathutils import Vector
from mathutils.noise import noise

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
            if any(word in mat.name.lower() for word in ('slate','silver stone')):
                row=math.floor(v*3)
                bx=(u*2+(row%2)*.5)%1
                by=(v*3)%1
                joint=min(bx,1-bx,by,1-by)
                value=.70+broad*.07+grain*.12+fine*.08
                value*=.43 if joint<.008 else (.84 if joint<.017 else 1)
            if bark:
                value*=.60+.40*abs(math.sin(u*85+noise(Vector((u*15,v*3,2)))*3))
            pixels.extend((palette[0]*value,palette[1]*value,palette[2]*value,1))
    image.pixels.foreach_set(pixels)
    image.pack()
    nodes=mat.node_tree.nodes
    texture=nodes.new('ShaderNodeTexImage')
    texture.image=image
    mat.node_tree.links.new(texture.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])


surface_texture(MOSS,(.19,.29,.16))
surface_texture(STONE,(.35,.40,.44))
surface_texture(STONE_TOP,(.38,.43,.43))
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
            poly.use_smooth = self.role in ('bark', 'terrain', 'petals', 'stone')
        uv=mesh.uv_layers.new(name='SurfaceUV')
        for loop in mesh.loops:
            uv.data[loop.index].uv=self.uv[loop.vertex_index]
        if self.role in ('bark', 'terrain', 'stone'):
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



