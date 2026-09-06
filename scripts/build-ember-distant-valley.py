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
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'blender/ember-geology-stage-r1.blend'
OUT = ROOT / 'docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-distant-valley-r1'
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
    c, r = min(380, max(0, x+190)), min(335, max(0, z+145))
    i, j = min(379, int(c)), min(334, int(r))
    u, v = c-i, r-j
    return float((1-v)*((1-u)*heights[j,i]+u*heights[j,i+1])+v*((1-u)*heights[j+1,i]+u*heights[j+1,i+1]))


def smooth(a, b, value):
    t = min(1, max(0, (value-a)/(b-a)))
    return t*t*(3-2*t)


def ridge(value, width):
    return math.exp(-abs(value/width)**1.25)


def crest(value, seed):
    # Unequal peaks at several scales avoid a repeating sine-wave skyline.
    return .72 + .22*noise.noise(Vector((value*.006,seed,0))) + .13*noise.noise(Vector((value*.022,seed,0))) + .06*noise.noise(Vector((value*.055,seed,0)))


def valley_height(x, z):
    edge_x, edge_z = min(190, max(-190, x)), min(190, max(-145, z))
    distance = math.hypot(x-edge_x, z-edge_z)
    edge_y = old_height(edge_x, edge_z)
    # The southern apron eases into an ash basin; uneven ridges enclose it well
    # beyond the existing mountain. Northern continuation stays uphill.
    basin = -154 + 13*math.sin(x*.008+z*.003) + 8*math.sin(z*.017+x*.012)
    basin += 155*ridge(z+690+60*math.sin(x*.006), 85)*crest(x,2.7)
    basin += 265*ridge(z+1060+85*math.sin(x*.004+2), 125)*crest(x,8.3)
    basin += 190*ridge(x+760+80*math.sin(z*.005), 115)*crest(z,5.4)
    basin += 245*ridge(x-880+65*math.sin(z*.004), 135)*crest(z,12.8)
    basin += smooth(80, 530, z)*355
    continuation = edge_y - distance*(.27 if z < 190 else -.12)
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
    epsilon = 3
    dx = (valley_height(x+epsilon,z)-valley_height(x-epsilon,z))/(2*epsilon)
    dz = (valley_height(x,z+epsilon)-valley_height(x,z-epsilon))/(2*epsilon)
    shade = max(.32, min(1, (.65-.30*dx+.30*dz)/math.sqrt(1+dx*dx+dz*dz)))
    detail = .91 + .09*math.sin(x*.042+math.sin(z*.031))*math.sin(z*.059)
    cold = np.array([.075,.078,.073])*shade*detail
    # Baked aerial perspective avoids lights, shadow passes and extra shader
    # noise. It is deliberately independent of the dense foreground fog.
    haze = smooth(180, 1350, math.hypot(x,z))*.84
    return cold*(1-haze)+np.array([.115,.134,.141])*haze


vertices, faces, colors = [], [], []
segments = 256
distances = [0, 3, 9, 18, 32, 50, 75, 105, 140, 185, 235, 290, 355, 430, 515, 610, 720, 850, 1000, 1160]
for ring, distance in enumerate(distances):
    for i in range(segments):
        angle = math.tau*i/segments
        dx, dz = math.cos(angle), math.sin(angle)
        reach = min(190/max(abs(dx),1e-9), (190 if dz >= 0 else 145)/max(abs(dz),1e-9))
        x, z = dx*(reach+distance), dz*(reach+distance)
        y = valley_height(x,z) - (0.3 if ring == 0 else 0)
        vertices.append((x,y,z))
        colors.append(terrain_color(x,z))
        if ring:
            a, b = (ring-1)*segments+i, (ring-1)*segments+(i+1)%segments
            c, d = ring*segments+(i+1)%segments, ring*segments+i
            faces.extend(((a,b,c),(a,c,d)))
terrain = mesh('EMBER_DistantValley', vertices, faces, colors, material('Ember_DistantValley_BakedAtmosphere'), 'distant-valley')
surface = BVHTree.FromPolygons(vertices, faces, all_triangles=True)

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
        width = (1.6 if route == 0 else .85)*(.7+.3*math.sin(z*.07)**2)
        base = len(vertices)
        for vz, side in ((z,-1),(z,1),(z-3,1),(z-3,-1)):
            vx = center(vz)+side*width
            hit = surface.ray_cast(Vector((vx,500,vz)),Vector((0,-1,0)))[0]
            assert hit is not None
            vertices.append((vx,hit.y+.18,vz))
            heat = (.24+.12*math.sin(vz*.061+route)**2)*(1-smooth(460,680,-vz))
            colors.append((heat,.24*heat,.012*heat))
        faces.append((base,base+1,base+2,base+3))
traces = mesh('EMBER_DistantValleyHeat', vertices, faces, colors, material('Ember_DistantValley_BakedHeat'), 'distant-valley')

assert locked == {name: digest(bpy.data.objects[name]) for name in locked}
assert sum(len(o.data.polygons) for o in (terrain,traces)) < 11000
for obj in bpy.context.scene.objects:
    obj.select_set(obj == world or (obj.type == 'MESH' and not obj.hide_render))
blend = ROOT / 'blender/ember-distant-valley-r1.blend'
raw = ROOT / 'static/models/ember/ember-distant-valley-r1_raw.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', use_selection=True, export_extras=True, export_yup=True, export_cameras=False, export_lights=False)
OUT.mkdir(parents=True, exist_ok=True)
report = {'source':SOURCE.relative_to(ROOT).as_posix(),'lockedMeshDigests':locked,
          'backdropMeshes':2,'backdropFaces':len(terrain.data.polygons)+len(traces.data.polygons),
          'outerRadiusMeters':max(math.hypot(v.co.x,v.co.z) for v in terrain.data.vertices),
          'nativeBlendSha256':hashlib.sha256(blend.read_bytes()).hexdigest()}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='lockedMeshDigests'},indent=2))
