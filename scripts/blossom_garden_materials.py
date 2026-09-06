"""Pack existing project surface maps into the authored garden."""
import bpy


def apply_garden_materials(root):
    # Preserve four near trees through glTF deduplication. Their separate nodes
    # carry shadow ownership; distant trees can share GPU instance batches.
    near=('Ancient_Cherry_','Garden_Cherry_1_','Garden_Cherry_2_','Garden_Cherry_3_')
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or not obj.name.startswith(near) or obj.get('blossomShadowTint'):continue
        index=next(i for i,prefix in enumerate(near) if obj.name.startswith(prefix))
        obj.data=obj.data.copy()
        colors=obj.data.color_attributes.get('Color')
        if colors:
            for color in colors.data:
                r,g,b,a=color.color
                factor=.96+index*.008
                color.color=(r*factor,g*factor,b*factor,a)
        obj['blossomShadowTint']=True
    bark=root/'blender/blossom-plantfactory-family-r1/raw/open-crown-s19/maps'
    definitions=[
        ('Amphitheatre moss',root/'static/textures/autumn-floor/moss-albedo.jpg',root/'static/textures/terrain/dirt/normal.jpg',.45),
        ('Weathered blue basalt',root/'static/textures/terrain/rock/diffuse.jpg',root/'static/textures/terrain/rock/normal.jpg',.7),
        ('Ancient cherry bark',next(bark.glob('*Bark*Color.png')),next(bark.glob('*Bark*Normal.png')),.8),
    ]
    for name,color,normal,strength in definitions:
        mat=bpy.data.materials.get(name)
        if mat is None:continue
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        shader=nodes.get('Principled BSDF')
        for node in list(nodes):
            if node.type in ('TEX_IMAGE','NORMAL_MAP'):nodes.remove(node)
        for path,socket in [(color,'Base Color'),(normal,'Normal')]:
            image=bpy.data.images.load(str(path),check_existing=True)
            if socket=='Normal':image.colorspace_settings.name='Non-Color'
            image.pack()
            tex=nodes.new('ShaderNodeTexImage');tex.image=image
            if socket=='Normal':
                converter=nodes.new('ShaderNodeNormalMap')
                converter.inputs['Strength'].default_value=strength
                links.new(tex.outputs['Color'],converter.inputs['Color'])
                links.new(converter.outputs['Normal'],shader.inputs[socket])
            else:links.new(tex.outputs['Color'],shader.inputs[socket])
