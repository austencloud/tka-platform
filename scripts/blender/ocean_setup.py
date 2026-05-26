"""
Ocean Scene Setup for Blender
Builds the full underwater seabed scene: terrain, water surface, flora, rocks,
formations, decorations, lighting, and camera.

Execute via: mcp__blender__execute_blender_code (paste full content)

Coordinate conversion: Three.js Y-up -> Blender Z-up
  position: (x, y, z)_three -> (x, -z, y)_blender
  Y-axis rotation in Three.js = Z-axis rotation in Blender
"""

import bpy
import os
import math
import random
from mathutils import Vector, Quaternion

# ── Configuration ──────────────────────────────────────────────────────────────

MODEL_DIR = r"E:\tka-platform\static\models\ocean"
MESHY_DIR = r"E:\tka-platform\static\models\ocean\meshy"

# Model definitions — key: filename (without .glb)
# File naming: underscores in files, dashes in keys
CORAL_MODELS = {
    "coral-0": "coral_0",
    "coral-1": "coral_1",
    "coral-2": "coral_2",
    "coral-3": "coral_3",
    "coral-4": "coral_4",
    "coral-5": "coral_5",
    "coral-6": "coral_6",
    "coral-large": "coral_large",
}

FLORA_MODELS = {
    "seaweed": "seaweed",
    "kelp-plant": "kelp_plant",
}

DECORATION_MODELS = {
    "starfish": "starfish",
    "sea-urchin": "sea_urchin",
    "shell": "shell",
    "anemone": "anemone",
}

ROCK_MODELS = {
    "rock-0": "rock_0",
    "rock-1": "rock_1",
    "rock-2": "rock_2",
    "rock-3": "rock_3",
    "rock-4": "rock_4",
    "rock-5": "rock_5",
}

MESHY_MODELS = {
    "meshy-basalt-pinnacle": "basalt_pinnacle",
    "meshy-coral-encrusted-rock": "coral_encrusted_rock",
    "meshy-coral-mountain": "coral_mountain",
    "meshy-neon-coral-summit": "neon_coral_summit",
    "meshy-submerged-coral-citadel": "submerged_coral_citadel",
    "meshy-sunlit-coral-arch": "sunlit_coral_arch",
    "meshy-underwater-coral-arch": "underwater_coral_arch",
    "meshy-underwater-rock-table": "underwater_rock_table",
    "meshy-photorealistic-coral-0": "photorealistic_coral_0",
    "meshy-photorealistic-coral-1": "photorealistic_coral_1",
    "meshy-photorealistic-coral-2": "photorealistic_coral_2",
    "meshy-photorealistic-coral-3": "photorealistic_coral_3",
}

# Colors
SEABED_COLOR = (0.15, 0.18, 0.25, 1.0)  # blue-gray
WATER_COLOR = (0.1, 0.3, 0.6, 1.0)  # translucent blue
SKY_AMBIENT = (0.02, 0.06, 0.12, 1.0)  # deep ocean darkness
SUN_COLOR = (0.4, 0.6, 0.8)  # blue-tinted
CAUSTIC_COLOR = (0.3, 0.7, 1.0, 1.0)

STAGE_EXCLUSION_RADIUS = 5.0
TERRAIN_SIZE = 50.0


def three_to_blender_pos(x, y, z):
    return Vector((x, -z, y))


def rotY_to_blender_quat(rot_y):
    return Quaternion((0, 0, 1), rot_y)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for col in list(bpy.data.collections):
        if col.name != "Scene Collection":
            bpy.data.collections.remove(col)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    for img in list(bpy.data.images):
        if img.users == 0:
            bpy.data.images.remove(img)


# ── Terrain ────────────────────────────────────────────────────────────────────

def create_terrain():
    terrain_col = bpy.data.collections.new("Terrain")
    bpy.context.scene.collection.children.link(terrain_col)

    # Subdivided plane for seabed
    bpy.ops.mesh.primitive_plane_add(size=TERRAIN_SIZE, location=(0, 0, 0))
    seabed = bpy.context.active_object
    seabed.name = "Seabed"

    # Subdivide for displacement
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.subdivide(number_cuts=30)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Fractal displacement for natural topology
    displace_mod = seabed.modifiers.new("FractalDisplace", 'DISPLACE')
    noise_tex = bpy.data.textures.new("SeabedNoise", 'CLOUDS')
    noise_tex.noise_scale = 3.0
    noise_tex.noise_depth = 4
    displace_mod.texture = noise_tex
    displace_mod.strength = 1.2
    displace_mod.mid_level = 0.5

    # Flatten the stage exclusion zone via vertex group
    vg = seabed.vertex_groups.new(name="StageZone")
    for v in seabed.data.vertices:
        dist = math.sqrt(v.co.x ** 2 + v.co.y ** 2)
        if dist < STAGE_EXCLUSION_RADIUS:
            # Weight 1.0 at center, 0.0 at edge
            weight = 1.0 - (dist / STAGE_EXCLUSION_RADIUS)
            vg.add([v.index], weight, 'REPLACE')

    # Apply smooth modifier to flatten stage area
    smooth_mod = seabed.modifiers.new("StageFlatten", 'SMOOTH')
    smooth_mod.factor = 2.0
    smooth_mod.iterations = 10
    smooth_mod.vertex_group = "StageZone"

    # Material
    mat = bpy.data.materials.new("Seabed_Mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = SEABED_COLOR
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    seabed.data.materials.append(mat)

    # Move to collection
    for col in seabed.users_collection:
        col.objects.unlink(seabed)
    terrain_col.objects.link(seabed)

    return terrain_col


# ── Water Surface ──────────────────────────────────────────────────────────────

def create_water_surface():
    structures_col = bpy.data.collections.get("Structures")
    if not structures_col:
        structures_col = bpy.data.collections.new("Structures")
        bpy.context.scene.collection.children.link(structures_col)

    # Water surface at y=10 in Three.js = z=10 in Blender
    water_pos = three_to_blender_pos(0, 10, 0)
    bpy.ops.mesh.primitive_plane_add(size=80, location=water_pos)
    water = bpy.context.active_object
    water.name = "WaterSurface"

    mat = bpy.data.materials.new("Water_Mat")
    mat.use_nodes = True
    mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = WATER_COLOR
    bsdf.inputs["Alpha"].default_value = 0.2
    bsdf.inputs["Roughness"].default_value = 0.1
    bsdf.inputs["IOR"].default_value = 1.33
    bsdf.inputs["Transmission Weight"].default_value = 0.8
    water.data.materials.append(mat)

    for col in water.users_collection:
        col.objects.unlink(water)
    structures_col.objects.link(water)

    return structures_col


# ── Lighting ───────────────────────────────────────────────────────────────────

def setup_lighting():
    # Main sun — blue-tinted, from above (Three.js direction [10, 30, -20])
    sun_pos = three_to_blender_pos(10, 30, -20)
    bpy.ops.object.light_add(type='SUN', location=sun_pos)
    sun = bpy.context.active_object
    sun.name = "OceanSun"
    sun.data.color = SUN_COLOR
    sun.data.energy = 2.0
    target_dir = Vector((0, 0, 0)) - sun_pos
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = target_dir.to_track_quat('-Z', 'Y')

    # Caustic fill from below (simulates light filtering through water)
    bpy.ops.object.light_add(type='AREA', location=(0, 0, -2))
    caustic = bpy.context.active_object
    caustic.name = "CausticFill"
    caustic.data.color = CAUSTIC_COLOR[:3]
    caustic.data.energy = 5.0
    caustic.data.size = 20.0
    caustic.rotation_euler = (math.pi, 0, 0)  # point up

    # Hemisphere ambient — subtle green-blue from sides
    bpy.ops.object.light_add(type='POINT', location=(0, 0, 5))
    ambient = bpy.context.active_object
    ambient.name = "AmbientFill"
    ambient.data.color = (0.1, 0.3, 0.4)
    ambient.data.energy = 20.0
    ambient.data.shadow_soft_size = 30.0


# ── Camera ─────────────────────────────────────────────────────────────────────

def setup_camera():
    # Underwater perspective, looking slightly up
    cam_pos = Vector((12, -12, 4))
    bpy.ops.object.camera_add(location=cam_pos)
    cam = bpy.context.active_object
    cam.name = "UnderwaterCamera"
    look_at = Vector((0, 0, 2))
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (look_at - cam_pos).to_track_quat('-Z', 'Y')
    cam.data.lens = 28
    cam.data.clip_start = 0.1
    cam.data.clip_end = 150
    bpy.context.scene.camera = cam


# ── World ──────────────────────────────────────────────────────────────────────

def setup_world():
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("OceanWorld")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = SKY_AMBIENT
        bg.inputs["Strength"].default_value = 0.5

    # Volume scatter for underwater fog
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    vol = nodes.new(type='ShaderNodeVolumeScatter')
    vol.inputs["Color"].default_value = (0.05, 0.15, 0.25, 1.0)
    vol.inputs["Density"].default_value = 0.04
    output = nodes.get("World Output")
    if output:
        links.new(vol.outputs["Volume"], output.inputs["Volume"])


# ── Model Import ───────────────────────────────────────────────────────────────

def import_glb(filepath):
    """Import a GLB and return the set of new object names."""
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {filepath}")
        return set()
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=filepath)
    after = set(bpy.data.objects.keys())
    return after - before


def import_templates():
    """Import all model GLBs as hidden templates."""
    templates = {}
    template_col = bpy.data.collections.new("_Templates")
    bpy.context.scene.collection.children.link(template_col)

    def import_category(models_dict, base_dir):
        for key, filename in models_dict.items():
            glb_path = os.path.join(base_dir, f"{filename}.glb")
            new_objs = import_glb(glb_path)
            if not new_objs:
                continue
            root = bpy.data.objects[sorted(new_objs)[0]]
            for obj_name in new_objs:
                obj = bpy.data.objects[obj_name]
                for col in obj.users_collection:
                    col.objects.unlink(obj)
                template_col.objects.link(obj)
            root.name = f"_template_{key}"
            root.hide_set(True)
            root.hide_render = True
            templates[key] = root

    import_category(CORAL_MODELS, MODEL_DIR)
    import_category(FLORA_MODELS, MODEL_DIR)
    import_category(DECORATION_MODELS, MODEL_DIR)
    import_category(ROCK_MODELS, MODEL_DIR)
    import_category(MESHY_MODELS, MESHY_DIR)

    template_col.hide_viewport = True
    return templates


# ── Placement ──────────────────────────────────────────────────────────────────

def place_objects(templates):
    """Place initial template objects in a ring around the stage for manual arrangement."""
    # Create collections
    flora_col = bpy.data.collections.new("Flora")
    bpy.context.scene.collection.children.link(flora_col)
    rocks_col = bpy.data.collections.new("Rocks")
    bpy.context.scene.collection.children.link(rocks_col)
    formations_col = bpy.data.collections.new("Formations")
    bpy.context.scene.collection.children.link(formations_col)
    decorations_col = bpy.data.collections.new("Decorations")
    bpy.context.scene.collection.children.link(decorations_col)

    # Map keys to collections
    key_to_col = {}
    for key in CORAL_MODELS:
        key_to_col[key] = flora_col
    for key in FLORA_MODELS:
        key_to_col[key] = flora_col
    for key in DECORATION_MODELS:
        key_to_col[key] = decorations_col
    for key in ROCK_MODELS:
        key_to_col[key] = rocks_col
    for key in MESHY_MODELS:
        key_to_col[key] = formations_col

    # Place one instance of each model in a spiral outside the exclusion zone
    all_keys = list(templates.keys())
    placement_id = 0
    radius_start = STAGE_EXCLUSION_RADIUS + 3
    angle_step = (2 * math.pi) / max(len(all_keys), 1)

    for i, key in enumerate(all_keys):
        template = templates[key]
        col = key_to_col.get(key, flora_col)

        # Spiral layout for initial placement
        angle = i * angle_step
        radius = radius_start + (i * 0.3)
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)

        obj = template.copy()
        if template.data:
            obj.data = template.data.copy()
        obj.name = f"{key}_initial"
        obj.hide_set(False)
        obj.hide_render = False
        obj.location = Vector((x, y, 0))
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = Quaternion((0, 0, 1), random.uniform(0, 2 * math.pi))
        obj.scale = (1, 1, 1)

        # Custom properties for sync
        obj["tka_id"] = f"ocean-{placement_id}"
        obj["tka_objectKey"] = key
        col.objects.link(obj)
        placement_id += 1

    total = placement_id
    print(f"  Placed {total} initial objects across Flora/Rocks/Formations/Decorations")
    return total


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("OCEAN SCENE SETUP")
    print("=" * 60)

    clear_scene()
    print("Scene cleared.")

    setup_world()
    print("World configured (underwater fog).")

    terrain_col = create_terrain()
    print("Terrain created (seabed with fractal displacement).")

    structures_col = create_water_surface()
    print("Water surface created at y=10.")

    setup_lighting()
    print("Lighting configured (blue sun + caustics + ambient).")

    setup_camera()
    print("Camera positioned (underwater perspective).")

    templates = import_templates()
    print(f"Imported {len(templates)} model templates.")

    total = place_objects(templates)

    # Viewport settings
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    break

    bpy.context.view_layer.update()
    print(f"\nOcean scene ready. Total objects: {len(bpy.data.objects)}")
    print(f"  Templates: {len(templates)}")
    print(f"  Placed objects: {total}")
    print("  Collections: Terrain, Structures, Flora, Rocks, Formations, Decorations")
    print("\nNext steps:")
    print("  1. Arrange objects manually in Blender viewport")
    print("  2. Run ocean_sync_to_placements.py to export transforms")


main()
