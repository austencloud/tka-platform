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
OUT = ROOT / 'docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-distant-valley-r5'
OUT.mkdir(parents=True, exist_ok=True)
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


def drainage(z):
    """One connected route, in metres, from the existing river to the horizon.

    The floor loses height everywhere; the broad middle reach is a crusted
    flow field, not a level lake or a second uphill river. Every visual layer
    uses this same route: terrain, cooled deposit, hot channel and breach.
    """
    t = np.maximum(0, -np.asarray(z)-143)
    center = 18 - 62*smooth(0,210,t) + 180*smooth(240,560,t)
    center += 210*smooth(650,1110,t)
    # Integrate a positive slope, easing from the mountain into the lowland.
    floor = float(old_height(np.asarray(18.),np.asarray(-143.)))
    floor -= .065*t + .65*240*(1-np.exp(-t/140))
    field = smooth(130,290,t)*(1-smooth(470,680,t))
    half_width = 2.5 + 4.5*smooth(0,55,t) + 47*field + 9*smooth(350,900,t)
    return center, floor, half_width, field


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
    route_center, _, _, _ = drainage(z)
    # The outflow occupies a broad saddle already present in the large forms,
    # not a narrow slot gouged through a finished mountain wall.
    near *= smooth(150,430,np.abs(x-route_center))
    far *= smooth(210,510,np.abs(x-route_center))
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
    natural = continuation*(1-blend)+basin*blend
    center, floor, width, field = drainage(z)
    offset = np.abs(x-center)
    # A broad asymmetric opening through BOTH ranges. Leave enclosing massifs
    # to either side, but never put a mountain wall across the outflow.
    flat = width + 24
    shoulder = flat + 95 + 65*field
    channel_floor = floor + 3*smooth(width,flat,offset)
    # Grade the whole bed, including depressions in the former backdrop. A
    # min(natural, floor) cut leaves pits that force the visible stream uphill.
    carved = channel_floor
    cut = (1-smooth(flat,shoulder,offset))*smooth(0,32,-z-145)
    return natural*(1-cut)+carved*cut


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
    center, floor, width, field = drainage(z)
    distance = np.abs(x-center)
    envelope = smooth(145,190,-z)*(1-smooth(1280,1380,-z))
    # A coherent black flow field with irregular cooled margins and overlapping
    # lobes. It stays much larger than its exposed incandescent channels.
    margin = width + 15 + noise2(x,z,19,47)*9
    deposit = (1-smooth(margin,margin+23,distance))*envelope
    crust = np.array([.019,.017,.016])*(.9+.2*noise2(x,z,8,48))[...,None]
    color = color*(1-deposit[...,None]*.88)+crust*deposit[...,None]*.88
    glow = np.exp(-(distance/(width+12))**2)*envelope*.018
    color += glow[...,None]*np.array([1,.115,.006])
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

# Connected lowland flow. Cool rafts interrupt the exposed surface, not the
# underlying drainage. No arbitrary disconnected stripes across mountains.
vertices, faces, colors = [], [], []
stations = np.arange(-143.,-1230.,-2.)
crossings = np.linspace(-1,1,33)
profile = []
for j,z in enumerate(stations):
    center, floor, width, field = drainage(z)
    width *= (.90+.1*math.sin(z*.073)**2)*(1-.96*smooth(1120,1230,-z))
    row = len(vertices)
    center_height = None
    for k,side in enumerate(crossings):
        vx = center + side*width
        # Join the unchanged source terrain before the new annulus begins.
        hit = surface.ray_cast(Vector((vx,500,z)),Vector((0,-1,0)))[0]
        y = float(hit.y) if hit is not None else float(old_height(np.asarray(vx),np.asarray(z)))
        # Independent surface/terrain triangulation consumes some clearance
        # between vertices. Leave room for quantization and animated heave.
        lift = .20+.18*float(smooth(143,180,-z))
        vertices.append((vx,y+lift,z))
        if k == len(crossings)//2:
            center_height = y+lift
        bank = 1-smooth(.79,1,abs(side))
        # These are the SAME shader masks as the near river, not baked RGB
        # artwork: bank coverage, thermal strength, and reflected-light strength.
        heat = 1-.30*float(smooth(175,600,-z))
        reflection = 1-.94*float(smooth(145,230,-z))
        colors.append((bank,bank*heat,bank*reflection))
        if j and k:
            a = row+k
            faces.append((a-len(crossings)-1,a-len(crossings),a,a-1))
    profile.append([float(center),center_height,float(z)])
traces = mesh('EMBER_DistantValleyHeat', vertices, faces, colors, material('Ember_DistantValley_BakedHeat'), 'distant-valley')
flow_uv = traces.data.uv_layers.new(name='FlowMetres')
for loop in traces.data.loops:
    p = traces.data.vertices[loop.vertex_index].co
    center, _, _, _ = drainage(p.z)
    # Preserve one metre of surface per UV unit even where the field widens.
    # glTF flips V; +Z in Blender becomes 1-Z, matching the upstream shader.
    flow_uv.data[loop.index].uv = (p.x-center-.5*(1-smooth(0,35,-p.z-143)),p.z)
traces['ember_distant_flow_surface'] = True
traces['ember_drainage_profile'] = profile
traces['ember_drainage_kind'] = 'connected-descending-crusted-flow-field'

# Test the actual triangulated support, not just the desired analytic profile.
uphill = [(i,profile[i][1]-profile[i-1][1]) for i in range(1,len(profile)) if profile[i][1]>profile[i-1][1]+.025]
assert not uphill, f'Drainage climbs delivered terrain: {uphill[:8]}'

assert locked == {name: digest(bpy.data.objects[name]) for name in locked}
assert sum(len(p.vertices)-2 for o in (terrain,traces) for p in o.data.polygons) < 140000
for obj in bpy.context.scene.objects:
    obj.select_set(obj == world or (obj.type == 'MESH' and not obj.hide_render))
blend = ROOT / 'blender/ember-distant-valley-r5.blend'
raw = ROOT / 'static/models/ember/ember-distant-valley-r5_raw.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', use_selection=True, export_extras=True, export_yup=True, export_cameras=False, export_lights=False)
OUT.mkdir(parents=True, exist_ok=True)
report = {'source':SOURCE.relative_to(ROOT).as_posix(),'lockedMeshDigests':locked,
          'backdropMeshes':2,'backdropFaces':len(terrain.data.polygons)+len(traces.data.polygons),
          'drainageProfile':profile,'uphillSegments':uphill,
          'outerRadiusMeters':max(math.hypot(v.co.x,v.co.z) for v in terrain.data.vertices),
          'nativeBlendSha256':hashlib.sha256(blend.read_bytes()).hexdigest()}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ('lockedMeshDigests','drainageProfile')},indent=2))
