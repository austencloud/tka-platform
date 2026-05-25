"""
Dynamic stage manager for Blender Cosmic scene.
Resize platform, reposition performers, adjust formation.

Execute via: mcp__blender__execute_blender_code (paste full content)

Usage: Call set_performer_count(N) where N is 1-8.
Stage auto-sizes, performers arrange in circle formation.
"""

import bpy
import bmesh
import math


# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

PLATFORM_HEIGHT = 0.4
STAFF_LENGTH = 1.2
STAFF_RADIUS = 0.02
PERFORMER_SPACING = 2.0  # meters (matches app STAGE.PERFORMER_SPACING)
MIN_ARC = 2.0  # 2m minimum arc per performer


# ═══════════════════════════════════════════════════════════════════════════
# STAGE GEOMETRY
# ═══════════════════════════════════════════════════════════════════════════

def get_stage_radius(performer_count):
    if performer_count <= 1:
        return 3.5
    elif performer_count <= 2:
        return 4.0
    elif performer_count <= 4:
        return 5.0
    elif performer_count <= 6:
        return 6.0
    return 7.5


def build_octagon_platform(radius):
    old = bpy.data.objects.get("CosmicPlatform")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    mesh = bpy.data.meshes.new("CosmicPlatform_mesh")
    bm = bmesh.new()

    top_verts, bot_verts = [], []
    for i in range(8):
        angle = 2 * math.pi * i / 8 + math.pi / 8
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        top_verts.append(bm.verts.new((x, y, PLATFORM_HEIGHT)))
        bot_verts.append(bm.verts.new((x, y, 0.0)))

    bm.faces.new(top_verts)
    bm.faces.new(list(reversed(bot_verts)))
    for i in range(8):
        ni = (i + 1) % 8
        bm.faces.new([bot_verts[i], bot_verts[ni], top_verts[ni], top_verts[i]])

    uv_layer = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for loop in face.loops:
            co = loop.vert.co
            if abs(face.normal.z) > 0.5:
                loop[uv_layer].uv = (co.x / (2 * radius) + 0.5, co.y / (2 * radius) + 0.5)
            else:
                a = math.atan2(co.y, co.x)
                loop[uv_layer].uv = (a / (2 * math.pi) + 0.5, co.z / PLATFORM_HEIGHT)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("CosmicPlatform", mesh)
    bpy.context.scene.collection.objects.link(obj)
    for poly in obj.data.polygons:
        if abs(poly.normal.z) < 0.5:
            poly.use_smooth = True

    mat = bpy.data.materials.get("CosmicPlatform_Mat")
    if not mat:
        mat = bpy.data.materials.new("CosmicPlatform_Mat")
        mat.use_nodes = True
        p = mat.node_tree.nodes["Principled BSDF"]
        p.inputs["Base Color"].default_value = (0.005, 0.005, 0.01, 1.0)
        p.inputs["Roughness"].default_value = 1.0
        p.inputs["Specular IOR Level"].default_value = 0.0
    obj.data.materials.append(mat)
    return obj


def build_border_ring(radius):
    old = bpy.data.objects.get("CosmicBorder")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius, minor_radius=0.04,
        major_segments=8, minor_segments=12,
        location=(0, 0, PLATFORM_HEIGHT),
    )
    obj = bpy.context.active_object
    obj.name = "CosmicBorder"
    for p in obj.data.polygons:
        p.use_smooth = True

    mat = bpy.data.materials.get("CosmicBorder_Mat")
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    return obj


def build_edge_glow(radius):
    old = bpy.data.objects.get("CosmicEdgeGlow")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius + 0.05, minor_radius=0.1,
        major_segments=8, minor_segments=8,
        location=(0, 0, PLATFORM_HEIGHT),
    )
    obj = bpy.context.active_object
    obj.name = "CosmicEdgeGlow"
    for p in obj.data.polygons:
        p.use_smooth = True

    mat = bpy.data.materials.get("CosmicEdgeGlow_Mat")
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    return obj


# ═══════════════════════════════════════════════════════════════════════════
# PERFORMER POSITIONING
# ═══════════════════════════════════════════════════════════════════════════

def get_circle_positions(count):
    base_radius = 1.5
    radius = max(base_radius, (count * MIN_ARC) / (2 * math.pi))
    positions = []
    for i in range(count):
        angle = (i / count) * 2 * math.pi - math.pi / 2
        x = math.cos(angle) * radius
        z_three = math.sin(angle) * radius
        facing = angle + math.pi / 2
        positions.append({"x": x, "y": -z_three, "facing": -facing})
    return positions, radius


def get_grid_positions(count):
    positions = []
    rows = math.ceil(count / 2)
    last_row = rows - 1
    last_row_singleton = count % 2 == 1

    for i in range(count):
        row = i // 2
        col = i % 2
        row_z = -row * PERFORMER_SPACING

        if row == last_row and last_row_singleton and col == 0:
            positions.append({"x": 0, "y": row_z, "facing": 0})
        else:
            x = (-1 if col == 0 else 1) * (PERFORMER_SPACING / 2)
            positions.append({"x": x, "y": row_z, "facing": 0})

    min_y = min(p["y"] for p in positions)
    max_y = max(p["y"] for p in positions)
    center_y = (min_y + max_y) / 2
    for p in positions:
        p["y"] -= center_y

    return positions


def place_performers(count, formation="circle"):
    if formation == "circle":
        positions, _ = get_circle_positions(count)
    else:
        positions = get_grid_positions(count)

    performer = bpy.data.objects.get("Performer_Armature")
    if not performer:
        print("ERROR: No Performer_Armature found")
        return

    # Remove old duplicates
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Performer_") and obj.name != "Performer_Armature":
            if obj.type == "ARMATURE":
                for child in list(obj.children):
                    bpy.data.objects.remove(child, do_unlink=True)
                bpy.data.objects.remove(obj, do_unlink=True)

    # Remove old staff props
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Staff_"):
            bpy.data.objects.remove(obj, do_unlink=True)

    # Reposition main performer
    pos = positions[0]
    performer.location = (pos["x"], pos["y"], PLATFORM_HEIGHT)
    performer.rotation_euler = (0, 0, pos["facing"])

    # Duplicate for remaining
    for i in range(1, count):
        pos = positions[i]
        new_arm = performer.copy()
        new_arm.data = performer.data
        new_arm.name = f"Performer_{i}"
        new_arm.location = (pos["x"], pos["y"], PLATFORM_HEIGHT)
        new_arm.rotation_euler = (0, 0, pos["facing"])
        bpy.context.scene.collection.objects.link(new_arm)

        for child in performer.children:
            if child.type == "MESH":
                new_child = child.copy()
                new_child.data = child.data
                new_child.parent = new_arm
                new_child.name = f"{child.name}_{i}"
                bpy.context.scene.collection.objects.link(new_child)

    # Add staves
    red_mat = bpy.data.materials.get("RedStaff_Mat")
    blue_mat = bpy.data.materials.get("BlueStaff_Mat")

    if not red_mat or not blue_mat:
        for name, base, emit in [
            ("RedStaff_Mat", (0.8, 0.1, 0.05), (1.0, 0.2, 0.1)),
            ("BlueStaff_Mat", (0.05, 0.3, 0.9), (0.1, 0.4, 1.0)),
        ]:
            m = bpy.data.materials.new(name)
            m.use_nodes = True
            p = m.node_tree.nodes["Principled BSDF"]
            p.inputs["Base Color"].default_value = (*base, 1.0)
            p.inputs["Metallic"].default_value = 0.3
            p.inputs["Roughness"].default_value = 0.4
            p.inputs["Emission Color"].default_value = (*emit, 1.0)
            p.inputs["Emission Strength"].default_value = 1.5
        red_mat = bpy.data.materials.get("RedStaff_Mat")
        blue_mat = bpy.data.materials.get("BlueStaff_Mat")

    staff_mesh = bpy.data.meshes.get("StaffCylinder")
    if not staff_mesh:
        bpy.ops.mesh.primitive_cylinder_add(radius=STAFF_RADIUS, depth=STAFF_LENGTH, vertices=8)
        tmp = bpy.context.active_object
        staff_mesh = tmp.data
        staff_mesh.name = "StaffCylinder"
        bpy.data.objects.remove(tmp, do_unlink=True)

    all_performers = [performer]
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        if obj.type == "ARMATURE" and obj.name.startswith("Performer_") and obj.name != "Performer_Armature":
            if "Audience" not in obj.name:
                all_performers.append(obj)

    for i, perf in enumerate(all_performers):
        loc = perf.location
        facing = perf.rotation_euler.z
        for side, mat, label in [(-1, red_mat, "Red"), (1, blue_mat, "Blue")]:
            obj = bpy.data.objects.new(f"Staff_{label}_{i}", staff_mesh)
            lateral = side * 0.4
            forward = 0.3
            ox = lateral * math.cos(facing) - forward * math.sin(facing)
            oy = lateral * math.sin(facing) + forward * math.cos(facing)
            obj.location = (loc.x + ox, loc.y + oy, loc.z + 0.8)
            obj.rotation_euler = (math.radians(10), side * math.radians(15), facing)
            obj.data.materials.clear()
            obj.data.materials.append(mat)
            bpy.context.scene.collection.objects.link(obj)

    print(f"Placed {count} performers ({formation}) with staves")


# ═══════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

def set_performer_count(count, formation="circle"):
    """Resize stage and place N performers. Call this to update the scene."""
    radius = get_stage_radius(count)
    build_octagon_platform(radius)
    build_border_ring(radius)
    build_edge_glow(radius)
    place_performers(count, formation)
    bpy.ops.wm.save_mainfile()
    print(f"\nStage set for {count} performers (radius={radius}m, formation={formation})")
    print("Saved.")


# ── Run with desired count ──
# Change this number to adjust performer count:
set_performer_count(8, "circle")
