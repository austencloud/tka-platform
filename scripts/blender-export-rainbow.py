"""Export the approved Spectrum Commons Blender source as a runtime venue.

blender --background --threads 8 --python scripts/blender-export-rainbow.py
The source retains the review figures, lighting and cameras. Only authored
venue geometry is exported; the viewer owns performers, water and illumination.
"""
from pathlib import Path
import json
import bpy

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'blender/rainbow/spectrum-commons.blend'
OUTPUT = ROOT / 'static/models/rainbow/spectrum-commons.glb'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
scene.cycles.samples = 16

# Bake the three procedural surface colors into small portable PBR textures.
for prefix, metres in [('Basalt', 2), ('Thermally', 3), ('Lakeside meadow', 12)]:
    mat = next(m for m in bpy.data.materials if m.name.startswith(prefix))
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 500))
    plane = bpy.context.object
    plane.data.materials.append(mat)
    image = bpy.data.images.new('Spectrum '+prefix, width=256, height=256)
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    mat.node_tree.nodes.active = node
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    shader = mat.node_tree.nodes.get('Principled BSDF')
    mat.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    image.pack()
    bpy.data.objects.remove(plane, do_unlink=True)
    mat['texture_metres'] = metres

exported = []
for obj in list(scene.objects):
    groups = [c.name[:2] for c in obj.users_collection]
    if obj.type not in {'MESH', 'CURVE'} or not any(g in {'01','02','03','04','05'} for g in groups):
        continue
    if obj.name == 'Lake surface':
        continue
    role = 'venue'
    if obj.name.startswith('Sail '): role = 'sail'
    elif obj.name.startswith('12 metre'): role = 'court'
    elif obj.name == 'Quiet star field': role = 'stars'
    elif '05' in groups: role = 'terraces'
    obj['rainbowRole'] = role
    exported.append(obj)

bpy.ops.object.select_all(action='DESELECT')
for obj in exported: obj.select_set(True)
bpy.context.view_layer.objects.active = exported[0]
bpy.ops.object.convert(target='MESH')
exported = list(bpy.context.selected_objects)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Procedural fabric nodes are reduced to their authored PBR base and emission.
for obj in exported:
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes: continue
        shader = mat.node_tree.nodes.get('Principled BSDF')
        output = mat.node_tree.nodes.get('Material Output')
        if shader and output:
            mat.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
        if obj.get('rainbowRole') == 'sail':
            mat.use_backface_culling = False
    textured = next((m for m in obj.data.materials if m and m.get('texture_metres')), None)
    if textured:
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='SurfaceUV')
        scale = textured['texture_metres']
        for polygon in obj.data.polygons:
            for loop_index in polygon.loop_indices:
                co = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (co.x / scale, co.y / scale + co.z / scale)

# Shared materials are merged inside each semantic role, keeping the seven
# sails and floor separately addressable without hundreds of runtime draws.
buckets = {}
for obj in exported:
    key = (obj.get('rainbowRole'), tuple(m.name for m in obj.data.materials))
    buckets.setdefault(key, []).append(obj)
for index, ((role, _), objects) in enumerate(buckets.items()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1: bpy.ops.object.join()
    result = bpy.context.object
    result.name = f'Rainbow_{role}_{index:02d}'
    result['rainbowRole'] = role

bpy.ops.object.select_all(action='DESELECT')
runtime = [o for o in scene.objects if o.type == 'MESH' and o.get('rainbowRole')]
for obj in runtime: obj.select_set(True)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', use_selection=True,
    export_extras=True, export_yup=True, export_animations=False, export_lights=False,
    export_cameras=False, export_materials='EXPORT')
manifest = {'source': 'blender/rainbow/spectrum-commons.blend', 'meshes': len(runtime),
    'triangles': sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in runtime),
    'bytes': OUTPUT.stat().st_size, 'nativeCourtHeight': .45, 'courtRadius': 6,
    'roles': {role: sum(o.get('rainbowRole') == role for o in runtime) for role in ['venue','sail','court','stars','terraces']}}
(OUTPUT.parent / 'spectrum-commons-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest), flush=True)
