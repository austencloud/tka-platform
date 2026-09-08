"""Import actual EZ-Tree geometry and fit its trunk origins to the citadel's soil."""
import bpy, json, math
from mathutils import Vector

def replace_citadel_trees(root, scene):
    assets = root/'blender/celestial/ez-tree-assets'
    family = json.loads((assets/'family.json').read_text())
    anchors = [o for o in scene.objects if o.get('sunwardRole') == 'olive' or o.get('citadelTreeAnchor')]
    if not anchors:
        raise RuntimeError('No authored Celestial tree anchors found')
    for old in list(scene.objects):
        if old.get('sunwardRole') == 'ez-tree':
            bpy.data.objects.remove(old, do_unlink=True)

    def image_node(nodes, name, noncolor=False):
        node = nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(assets/name), check_existing=True)
        if noncolor: node.image.colorspace_settings.name = 'Non-Color'
        node.image.pack()
        return node

    bark = bpy.data.materials.new('EZ-Tree oak bark'); bark.use_nodes = True; bark.use_backface_culling = True
    nodes=bark.node_tree.nodes; links=bark.node_tree.links; shader=nodes.get('Principled BSDF')
    color=image_node(nodes,'oak_color_1k.jpg'); links.new(color.outputs['Color'],shader.inputs['Base Color'])
    rough=image_node(nodes,'oak_roughness_1k.jpg',True); links.new(rough.outputs['Color'],shader.inputs['Roughness'])
    normal=image_node(nodes,'oak_normal_1k.jpg',True); convert=nodes.new('ShaderNodeNormalMap'); convert.inputs['Strength'].default_value=.7
    links.new(normal.outputs['Color'],convert.inputs['Color']); links.new(convert.outputs['Normal'],shader.inputs['Normal'])
    leaves=bpy.data.materials.new('EZ-Tree silver ash foliage'); leaves.use_nodes=True
    nodes=leaves.node_tree.nodes; links=leaves.node_tree.links; shader=nodes.get('Principled BSDF')
    atlas=image_node(nodes,'ash_color.png'); links.new(atlas.outputs['Color'],shader.inputs['Base Color']); links.new(atlas.outputs['Alpha'],shader.inputs['Alpha'])
    shader.inputs['Roughness'].default_value=.82
    leaves.surface_render_method='DITHERED'; leaves.use_backface_culling=False
    # glTF exporter recognizes a greater-than alpha node as an explicit cutout.
    cutoff=nodes.new('ShaderNodeMath'); cutoff.operation='GREATER_THAN'; cutoff.inputs[1].default_value=.45
    links.new(atlas.outputs['Alpha'],cutoff.inputs[0]); links.new(cutoff.outputs[0],shader.inputs['Alpha'])

    meshes={}
    for variant in family['variants']:
        data=json.loads((assets/(variant['id']+'.json')).read_text()); height=data['height']
        for kind, material in [('wood',bark),('leaves',leaves)]:
            raw=data[kind]; coords=raw['verts']; indices=raw['indices']
            verts=[(coords[i]/height,-coords[i+2]/height,coords[i+1]/height) for i in range(0,len(coords),3)]
            if kind=='wood':
                # Root flare stays attached to the trunk's real origin.
                flared=[]
                for x,y,z in verts:
                    t=max(0,min(1,z/.055)); falloff=1-t*t*(3-2*t)
                    flare=1+falloff*(.65+.12*math.cos(math.atan2(y,x)*5))
                    flared.append((x*flare,y*flare,z))
                verts=flared
            faces=[tuple(indices[i:i+3]) for i in range(0,len(indices),3)]
            mesh=bpy.data.meshes.new('EZ '+variant['id']+' '+kind); mesh.from_pydata(verts,[],faces); mesh.update(); mesh.materials.append(material)
            uv=mesh.uv_layers.new(name='EZ-Tree UV')
            for loop in mesh.loops:
                u,v=raw['uvs'][loop.vertex_index*2:loop.vertex_index*2+2]
                if kind=='wood': u*=data['options']['bark']['textureScale']['x']; v/=data['options']['bark']['textureScale']['y']
                uv.data[loop.index].uv=(u,1-v)
            for face in mesh.polygons: face.use_smooth=kind=='wood'
            meshes[(variant['id'],kind)]=mesh

    terrain=[o for o in scene.objects if o.type=='MESH' and o.get('sunwardRole')=='ground' and 'meadow crown' in o.name]
    contacts=[]
    for index, old in enumerate(anchors):
        position=old.location.copy(); height=float(old.get('treeHeight',old.scale.z)); angle=old.rotation_euler.z
        name=old.name
        if not old.get('citadelTreeAnchor'):
            anchor=bpy.data.objects.new(name+' anchor',None);scene.collection.objects.link(anchor)
            bpy.data.objects.remove(old,do_unlink=True)
        else:anchor=old
        # The old canopy-centred origin put this trunk through the terrace edge.
        if abs(position.x+43)<.1 and abs(position.y-30)<.1:position.x=-47;position.y=24
        if abs(position.x+16)<.1 and abs(position.y)<.1:
            surface=.73
        else:
            hits=[]
            for ground in terrain:
                inv=ground.matrix_world.inverted()
                hit,point,_,_=ground.ray_cast(inv@Vector((position.x,position.y,150)),Vector((0,0,-1)))
                if hit:hits.append((ground.matrix_world@point).z)
            if not hits:raise RuntimeError('No meadow under tree '+name)
            surface=max(hits)
        position.z=surface-.04
        anchor.location=position;anchor.rotation_euler.z=angle;anchor.scale=(1,1,1)
        anchor['citadelTreeAnchor']=True;anchor['treeHeight']=height
        variant=anchor.get('ezTreeVariant',family['variants'][index%len(family['variants'])]['id'])
        anchor['ezTreeVariant']=variant
        for kind in ['wood','leaves']:
            obj=bpy.data.objects.new('EZ '+variant+' '+kind,meshes[(variant,kind)]);scene.collection.objects.link(obj)
            obj.parent=anchor;obj.location=(0,0,0);obj.scale=(height,height,height)
            obj['sunwardRole']='ez-tree';obj['ezTreeVariant']=variant;obj['ezTreePart']=kind
        contacts.append({'anchor':anchor.name,'position':list(position),'height':height,'variant':variant,'soilZ':surface,'rootBurial':.04})
    for image in bpy.data.images:
        if image.has_data:image.pack()
    report={'generator':family['generator'],'treeCount':len(contacts),'variants':family['variants'],'contacts':contacts}
    (root/'static/models/celestial/ez-tree-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    return report
