"""Bake a low-cost distant valley around the unchanged Ember geology/stage asset.

Blender --background --factory-startup --python-exit-code 1 --python scripts/build-ember-distant-valley.py
"""
from array import array
import hashlib
import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'blender/ember-geology-stage-r1.blend'
OUT = ROOT / 'docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-distant-valley-r2'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
world = bpy.data.objects['EMBER_WorldRoot']
heights = np.fromfile(ROOT / 'static/data/ember/review/ember-midflank-fire-pilgrimage-r5-height.f32', dtype='<f4').reshape(336,381)


def digest(obj):
    result = hashlib.sha256()
    values = array('f', [0]) * (len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get('co', values)
    result.update(values.tobytes())
    for uv in obj.data.uv_layers:
        values = array('f', [0]) * (len(uv.data) * 2)
        uv.data.foreach_get('uv', values)
        result.update(values.tobytes())
    for colors in obj.data.color_attributes:
        values = array('f', [0]) * (len(colors.data) * 4)
        colors.data.foreach_get('color', values)
        result.update(values.tobytes())
    result.update(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode())
    result.update(str(obj.matrix_world).encode())
    return result.hexdigest()


locked = {o.name: digest(o) for o in bpy.context.scene.objects if o.type == 'MESH'}


def old_height(x, z):
    c, r = np.clip(x+190, 0, 380), np.clip(z+145, 0, 335)
    i, j = np.minimum(379, c.astype(int)), np.minimum(334, r.astype(int))
    u, v = c-i, r-j
    return (1-v)*((1-u)*heights[j,i]+u*heights[j,i+1])+v*((1-u)*heights[j+1,i]+u*heights[j+1,i+1])


def smooth(a, b, value):
    t = np.clip((value-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def noise2(x, z, scale, seed=0):
    """Repeatable, array-compatible rock noise for the offline geometry/bake."""
    x, z = np.asarray(x)/scale, np.asarray(z)/scale
    ix, iz = np.floor(x), np.floor(z)
    u, v = x-ix, z-iz
    u, v = u*u*u*(u*(u*6-15)+10), v*v*v*(v*(v*6-15)+10)
    def hash2(a, b):
        value = np.sin(a*127.1+b*311.7+seed*74.7)*43758.5453
        return (value-np.floor(value))*2-1
    return ((1-u)*hash2(ix,iz)+u*hash2(ix+1,iz))*(1-v) + ((1-u)*hash2(ix,iz+1)+u*hash2(ix+1,iz+1))*v


def ridge(value, width):
    return np.exp(-(value/width)**2)


def valley_height(x, z):
    x, z = np.asarray(x), np.asarray(z)
    edge_x, edge_z = np.clip(x, -190, 190), np.clip(z, -145, 190)
    distance = np.hypot(x-edge_x, z-edge_z)
    edge_y = old_height(edge_x, edge_z)
    # Broad overlapping massifs, with branching spurs on their flanks rather
    # than a row of triangular teeth. Their low saddle opens the valley view.
    warp = noise2(x,z,190,4)*48 + noise2(x,z,75,5)*15
    near = ridge(z+690+warp+65*np.sin(x*.004), 140)
    far = ridge(z+1090+warp+80*np.sin(x*.003+2), 175)
    west = ridge(x+780+warp, 180)
    east = ridge(x-870+warp, 210)
    basin = -192 + noise2(x,z,150,8)*15
    basin += near*(150+72*noise2(x,z,210,2))
    basin += far*(265+92*noise2(x,z,250,7))
    basin += west*(240+76*noise2(x,z,210,11))
    basin += east*(290+90*noise2(x,z,250,13))
    relief = np.clip(near+far+west+east,0,1)
    # The warp makes nested drainage grooves; the smallest layer roughens
    # slopes without making a serrated horizon.
    grooves = 1-np.abs(noise2(x+warp,z,42,17))
    basin += relief*(14*grooves + 3*noise2(x+warp,z,19,19) + .7*noise2(x,z,8,21))
    basin += smooth(80, 530, z)*355
    continuation = edge_y - distance*np.where(z < 190, .27, -.12)
    blend = smooth(20, 240, distance)
    return continuation*(1-blend)+basin*blend


def material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    mat.node_tree.links.new(color.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1
    return mat


def mesh(name, vertices, faces, colors, mat, role):
    data = bpy.data.meshes.new(name+'_Mesh')
    data.from_pydata(vertices, [], faces)
    data.materials.append(mat)
    data.update()
    attr = data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for i, color in enumerate(colors):
        attr.data[i].color = (*color, 1)
    for face in data.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = world
    obj['tka_role'] = role
    obj['ember_backdrop'] = True
    obj['tka_camera_collision'] = False
    return obj


def terrain_color(x, z):
    y = valley_height(x,z)
    dx = (valley_height(x+1.5,z)-valley_height(x-1.5,z))/3
    dz = (valley_height(x,z+1.5)-valley_height(x,z-1.5))/3
    length = np.sqrt(1+dx*dx+dz*dz)
    light = np.clip((.64+.65*dx+.41*dz)/length,0,1)
    shadow = np.ones_like(y)
    for distance in (12,28,60,110,200):
        blocker = valley_height(x-distance*.85,z-distance*.53)-y-distance*.64
        shadow *= 1-smooth(0,18,blocker)*.65
    light = .18 + .82*light*(.24+.76*shadow)
    mineral = smooth(-.45,.6,noise2(x,z,57,30))
    rock = np.array([.095,.103,.106]) + mineral[...,None]*np.array([.05,.014,-.016])
    grain = .9 + .14*noise2(x,z,3.2,31) + .07*noise2(x,z,1.5,32)
    strata = .92+.08*np.sin(y*.62+noise2(x,z,15,33)*4)
    # Talus in hollows is warmer and lighter; exposed scarps stay charcoal.
    talus = (1-smooth(.35,1.15,np.hypot(dx,dz)))*smooth(-.1,.5,noise2(x,z,26,34))
    rock += talus[...,None]*np.array([.032,.022,.012])
    color = rock*(light*grain*strata)[...,None]
    for route in range(2):
        center = (-25 if route == 0 else -175)+24*np.sin(z*.012+route)+.09*(z+210)
        channel = np.exp(-((x-center)/(5 if route == 0 else 3.5))**2)
        envelope = smooth(225,250,-z)*(1-smooth(465,500,-z))
        color *= (1-.5*channel*envelope)[...,None]
        glow = np.exp(-((x-center)/9)**2)*envelope*.018
        color += glow[...,None]*np.array([1,.13,.008])
    # Do not let horizon haze wash out the near basin. The low basin retains
    # warm ash while far peaks gradually approach the storm-sky color.
    haze = smooth(230,1500,np.hypot(x,z))*.7
    color = color*(1-haze[...,None])+np.array([.09,.111,.124])*haze[...,None]
    edge_distance = np.hypot(x-np.clip(x,-190,190),z-np.clip(z,-145,190))
    join = smooth(0,125,edge_distance)[...,None]
    # The distant lighting must not expose a pale outline around the original
    # mountain. Start with its dark basalt, then ease into the valley light.
    return np.array([.037,.034,.03])*grain[...,None]*(1-join)+color*join


vertices, faces, colors = [], [], []
segments = 512
distances = [0, 3, 9, *range(18,1161,12)]
for ring, distance in enumerate(distances):
    for i in range(segments):
        angle = math.tau*i/segments
        dx, dz = math.cos(angle), math.sin(angle)
        reach = min(190/max(abs(dx),1e-9), (190 if dz >= 0 else 145)/max(abs(dz),1e-9))
        x, z = dx*(reach+distance), dz*(reach+distance)
        y = valley_height(x,z) - (0.3 if ring == 0 else 0)
        vertices.append((x,y,z))
        colors.append((1,1,1))
        if ring:
            a, b = (ring-1)*segments+i, (ring-1)*segments+(i+1)%segments
            c, d = ring*segments+(i+1)%segments, ring*segments+i
            faces.extend(((a,b,c),(a,c,d)))
terrain = mesh('EMBER_DistantValley', vertices, faces, colors, material('Ember_DistantValley_BakedAtmosphere'), 'distant-valley')
surface = BVHTree.FromPolygons(vertices, faces, all_triangles=True)

# One non-repeating atlas carries the offline erosion shading and rock detail.
# The renderer still submits a single unlit terrain mesh, with no shadow pass.
atlas_size, extent = 2048, 1440
uv = terrain.data.uv_layers.new(name='ValleyAtlas')
for loop in terrain.data.loops:
    x, _, z = vertices[loop.vertex_index]
    uv.data[loop.index].uv = ((x+extent)/(2*extent),(z+extent)/(2*extent))
pixels = np.ones((atlas_size,atlas_size,4),dtype=np.float32)
axis = (np.arange(atlas_size,dtype=np.float32)+.5)/atlas_size*(2*extent)-extent
for start in range(0,atlas_size,64):
    x, z = np.meshgrid(axis,axis[start:start+64])
    linear = terrain_color(x,z)
    # Blender's generated-image buffer is stored as sRGB for this base-color
    # export. Encode our linear lighting once; otherwise the browser darkens
    # the already-baked relief a second time when it decodes the texture.
    pixels[start:start+64,:,:3] = np.where(linear <= .0031308, linear*12.92, 1.055*np.power(linear,1/2.4)-.055)
atlas = bpy.data.images.new('Ember_Valley_Relief_Atlas',width=atlas_size,height=atlas_size)
atlas.pixels.foreach_set(pixels.ravel())
atlas.pack()
nodes = terrain.data.materials[0].node_tree.nodes
texture = nodes.new('ShaderNodeTexImage')
texture.image = atlas
terrain.data.materials[0].node_tree.links.new(texture.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])

# Small isolated glimpses of two channels down in the basin. Their dark
# intervals are real gaps, so the valley never becomes a striped orange field.
vertices, faces, colors = [], [], []
for route in range(2):
    for j in range(75):
        z = -245-j*3
        if -378 < z < -332 or -526 < z < -486:
            continue
        def center(v):
            return (-25 if route == 0 else -175) + 24*math.sin(v*.012+route)+.09*(v+210)
        x = center(z)
        opening = smooth(245,259,-z) if z >= -332 else smooth(378,389,-z)
        closing = 1-smooth(320,332,-z) if z >= -332 else 1-smooth(451,470,-z)
        width = (2.1 if route == 0 else 1.2)*(.66+.34*math.sin(z*.29+route)**2)*opening*closing
        if width < .03:
            continue
        base = len(vertices)
        for vz in (z,z-3):
            for side in (-1,-.62,-.17,.17,.62,1):
                vx = center(vz)+side*width
                hit = surface.ray_cast(Vector((vx,500,vz)),Vector((0,-1,0)))[0]
                assert hit is not None
                vertices.append((vx,hit.y+.18,vz))
                heat = (.75+.25*math.sin(vz*.36+route)**2)*(1-smooth(430,500,-vz))
                tint = (.032,.019,.015) if abs(side)==1 else ((.66,.092,.006) if abs(side)>.2 else (1.7,.55,.028))
                colors.append(tuple(c*heat for c in tint))
        for strip in range(5):
            faces.append((base+strip,base+strip+1,base+strip+7,base+strip+6))
traces = mesh('EMBER_DistantValleyHeat', vertices, faces, colors, material('Ember_DistantValley_BakedHeat'), 'distant-valley')

assert locked == {name: digest(bpy.data.objects[name]) for name in locked}
assert sum(len(p.vertices)-2 for o in (terrain,traces) for p in o.data.polygons) < 110000
for obj in bpy.context.scene.objects:
    obj.select_set(obj == world or (obj.type == 'MESH' and not obj.hide_render))
blend = ROOT / 'blender/ember-distant-valley-r2.blend'
raw = ROOT / 'static/models/ember/ember-distant-valley-r2_raw.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', use_selection=True, export_extras=True, export_yup=True, export_cameras=False, export_lights=False)
OUT.mkdir(parents=True, exist_ok=True)
report = {'source':SOURCE.relative_to(ROOT).as_posix(),'lockedMeshDigests':locked,
          'backdropMeshes':2,'backdropFaces':len(terrain.data.polygons)+len(traces.data.polygons),
          'outerRadiusMeters':max(math.hypot(v.co.x,v.co.z) for v in terrain.data.vertices),
          'nativeBlendSha256':hashlib.sha256(blend.read_bytes()).hexdigest()}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='lockedMeshDigests'},indent=2))
