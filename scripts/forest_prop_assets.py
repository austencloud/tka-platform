"""Deterministic Blender builders for Forest Gate 8 authored prop candidates.

The functions in this module create review geometry only. Shipping materials
are baked and exported after the visual family passes its lineup gate.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


def _principled(material):
    material.use_nodes = True
    return material.node_tree.nodes.get("Principled BSDF")


def flat_material(name, base_color, roughness=0.8, metallic=0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    bsdf = _principled(material)
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def organic_material(
    name,
    dark_color,
    light_color,
    noise_scale,
    bump_scale,
    bump_strength,
    roughness,
):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = roughness

    texture_coordinate = nodes.new("ShaderNodeTexCoord")
    color_noise = nodes.new("ShaderNodeTexNoise")
    color_noise.inputs["Scale"].default_value = noise_scale
    color_noise.inputs["Detail"].default_value = 5.0
    color_noise.inputs["Roughness"].default_value = 0.72
    color_ramp = nodes.new("ShaderNodeValToRGB")
    color_ramp.color_ramp.elements[0].color = (*dark_color, 1.0)
    color_ramp.color_ramp.elements[1].color = (*light_color, 1.0)
    color_ramp.color_ramp.elements[0].position = 0.30
    color_ramp.color_ramp.elements[1].position = 0.76

    bump_noise = nodes.new("ShaderNodeTexNoise")
    bump_noise.inputs["Scale"].default_value = bump_scale
    bump_noise.inputs["Detail"].default_value = 3.0
    bump_noise.inputs["Roughness"].default_value = 0.76
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.08

    links.new(texture_coordinate.outputs["Generated"], color_noise.inputs["Vector"])
    links.new(color_noise.outputs["Fac"], color_ramp.inputs["Fac"])
    links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(texture_coordinate.outputs["Generated"], bump_noise.inputs["Vector"])
    links.new(bump_noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def create_review_materials():
    return {
        "canvas": organic_material(
            "Forest Shelter Waxed Canvas",
            (0.075, 0.090, 0.046),
            (0.24, 0.27, 0.125),
            5.5,
            115.0,
            0.22,
            0.82,
        ),
        "canvas_dark": flat_material(
            "Forest Shelter Canvas Underside", (0.025, 0.030, 0.020), 0.94
        ),
        "bark": organic_material(
            "Forest Shelter Weathered Oak",
            (0.075, 0.036, 0.016),
            (0.25, 0.14, 0.060),
            3.2,
            28.0,
            0.48,
            0.91,
        ),
        "cut": organic_material(
            "Forest Deadwood Cut",
            (0.13, 0.060, 0.022),
            (0.50, 0.29, 0.105),
            4.0,
            20.0,
            0.30,
            0.86,
        ),
        "rope": organic_material(
            "Forest Shelter Rope",
            (0.10, 0.050, 0.018),
            (0.33, 0.20, 0.075),
            7.0,
            44.0,
            0.28,
            0.91,
        ),
        "bedroll": organic_material(
            "Forest Shelter Bedroll",
            (0.13, 0.028, 0.020),
            (0.43, 0.14, 0.060),
            8.0,
            88.0,
            0.20,
            0.89,
        ),
        "bedroll_stripe": flat_material(
            "Forest Shelter Bedroll Stripe", (0.25, 0.085, 0.032), 0.91
        ),
        "groundcloth": organic_material(
            "Forest Shelter Groundcloth",
            (0.06, 0.035, 0.018),
            (0.16, 0.095, 0.040),
            8.0,
            90.0,
            0.18,
            0.92,
        ),
        "moss": organic_material(
            "Forest Deadwood Moss",
            (0.018, 0.050, 0.012),
            (0.10, 0.16, 0.035),
            6.0,
            75.0,
            0.30,
            1.0,
        ),
        "tent_spruce": organic_material(
            "Forest Tent Ripstop Spruce",
            (0.025, 0.060, 0.043),
            (0.105, 0.165, 0.115),
            7.5,
            165.0,
            0.12,
            0.78,
        ),
        "tent_teal": organic_material(
            "Forest Tent Ripstop Slate Teal",
            (0.025, 0.075, 0.082),
            (0.095, 0.205, 0.205),
            7.0,
            160.0,
            0.12,
            0.76,
        ),
        "tent_ochre": organic_material(
            "Forest Tent Ripstop Ochre",
            (0.19, 0.085, 0.018),
            (0.54, 0.295, 0.060),
            6.0,
            145.0,
            0.10,
            0.74,
        ),
        "tent_floor": flat_material(
            "Forest Tent Charcoal Floor", (0.012, 0.017, 0.018), 0.92
        ),
        "tent_mesh": flat_material(
            "Forest Tent Dark Mesh", (0.006, 0.011, 0.012), 0.98
        ),
        "aluminum": flat_material(
            "Forest Tent Aluminum Poles", (0.48, 0.53, 0.52), 0.28, 0.82
        ),
        "guyline": flat_material(
            "Forest Tent Ochre Guyline", (0.73, 0.315, 0.025), 0.58
        ),
        "mineral_soil": organic_material(
            "Forest Fire Mineral Soil",
            (0.028, 0.021, 0.016),
            (0.105, 0.072, 0.043),
            3.0,
            24.0,
            0.25,
            0.96,
        ),
        "fire_stone": organic_material(
            "Forest Fire Weathered Stone",
            (0.055, 0.055, 0.048),
            (0.24, 0.225, 0.185),
            3.8,
            19.0,
            0.33,
            0.94,
        ),
        "charcoal": organic_material(
            "Forest Fire Charred Split Wood",
            (0.006, 0.004, 0.003),
            (0.075, 0.030, 0.012),
            5.0,
            34.0,
            0.30,
            0.94,
        ),
        "ash": flat_material("Forest Fire Ash", (0.095, 0.088, 0.076), 1.0),
        "ember": flat_material("Forest Fire Ember", (0.70, 0.070, 0.006), 0.52),
    }


def _apply_modifier(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def cylinder_between(
    name,
    start,
    end,
    radius,
    material,
    radius_end=None,
    vertices=16,
):
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    midpoint = (start + end) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=radius if radius_end is None else radius_end,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft weathered edges", "BEVEL")
    bevel.width = min(radius * 0.12, 0.028)
    bevel.segments = 2
    _apply_modifier(obj, bevel)
    return obj


def rope_curve(name, points: Sequence[Sequence[float]], material, radius=0.018):
    curve_data = bpy.data.curves.new(name, "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_resolution = 2
    curve_data.bevel_depth = radius
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, point in enumerate(points):
        spline.bezier_points[index].co = point
        spline.bezier_points[index].handle_left_type = "AUTO"
        spline.bezier_points[index].handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def rounded_box(name, location, scale, material, bevel_width=0.10):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Worn soft corners", "BEVEL")
    bevel.width = bevel_width
    bevel.segments = 3
    _apply_modifier(obj, bevel)
    return obj


def _cloth_grid(name, width, depth, front_y, back_y, front_z, back_z, material):
    columns = 12
    rows = 10
    vertices = []
    faces = []
    for row in range(rows + 1):
        v = row / rows
        for column in range(columns + 1):
            u = column / columns
            x = (u - 0.5) * width
            y = front_y + (back_y - front_y) * v
            z = front_z + (back_z - front_z) * v
            sag = math.sin(math.pi * u) * math.sin(math.pi * v)
            z -= sag * (0.075 + 0.045 * v)
            x += math.sin(v * math.pi * 2.0 + u * math.pi) * 0.014
            vertices.append((x, y, z))
    stride = columns + 1
    for row in range(rows):
        for column in range(columns):
            a = row * stride + column
            b = a + 1
            c = a + stride + 1
            d = a + stride
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    solidify = obj.modifiers.new("Waxed canvas thickness", "SOLIDIFY")
    solidify.thickness = 0.028
    solidify.offset = 0.0
    _apply_modifier(obj, solidify)
    bevel = obj.modifiers.new("Canvas edge roll", "BEVEL")
    bevel.width = 0.014
    bevel.segments = 2
    _apply_modifier(obj, bevel)
    return obj


def _triangle_panel(name, vertices, material):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    solidify = obj.modifiers.new("Canvas side thickness", "SOLIDIFY")
    solidify.thickness = 0.026
    solidify.offset = 0.0
    _apply_modifier(obj, solidify)
    return obj


def create_bramble_shelter(origin=(0.0, 0.0, 0.0), name="BrambleLeanTo"):
    materials = create_review_materials()
    ox, oy, oz = origin
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)

    width = 4.25
    front_y = -1.55
    back_y = 1.62
    ridge_z = 2.52
    back_z = 0.38

    created = []
    created.append(
        _cloth_grid(
            f"{name}_Roof",
            width,
            back_y - front_y,
            front_y,
            back_y,
            ridge_z,
            back_z,
            materials["canvas"],
        )
    )
    created.append(
        _triangle_panel(
            f"{name}_LeftWall",
            [
                (-width * 0.5, front_y, ridge_z),
                (-width * 0.5, back_y, back_z),
                (-width * 0.5, front_y, 0.18),
            ],
            materials["canvas"],
        )
    )

    # Front fork supports and the load-bearing ridge pole.
    for side, x in (("L", -width * 0.5), ("R", width * 0.5)):
        created.append(
            cylinder_between(
                f"{name}_{side}ForkInner",
                (x - 0.14, front_y - 0.08, 0.02),
                (x, front_y, ridge_z + 0.27),
                0.105,
                materials["bark"],
                0.082,
            )
        )
        created.append(
            cylinder_between(
                f"{name}_{side}ForkOuter",
                (x + 0.18, front_y - 0.03, 0.02),
                (x + (0.16 if side == "R" else -0.16), front_y, ridge_z + 0.20),
                0.092,
                materials["bark"],
                0.065,
            )
        )
    created.append(
        cylinder_between(
            f"{name}_RidgePoleA",
            (-width * 0.5 - 0.22, front_y, ridge_z + 0.05),
            (0.0, front_y + 0.02, ridge_z - 0.02),
            0.115,
            materials["bark"],
            0.105,
        )
    )
    created.append(
        cylinder_between(
            f"{name}_RidgePoleB",
            (0.0, front_y + 0.02, ridge_z - 0.02),
            (width * 0.5 + 0.22, front_y, ridge_z + 0.04),
            0.105,
            materials["bark"],
            0.11,
        )
    )
    created.append(
        cylinder_between(
            f"{name}_RearGroundPole",
            (-width * 0.5, back_y, back_z),
            (width * 0.5, back_y, back_z),
            0.070,
            materials["bark"],
            0.075,
        )
    )

    # Ground cloth and a layered bedroll keep the shelter visibly inhabited.
    groundcloth = rounded_box(
        f"{name}_Groundcloth",
        (0.0, 0.06, 0.085),
        (1.82, 1.26, 0.045),
        materials["groundcloth"],
        0.055,
    )
    created.append(groundcloth)
    bedroll = rounded_box(
        f"{name}_Bedroll",
        (-0.15, 0.05, 0.255),
        (1.55, 0.88, 0.14),
        materials["bedroll"],
        0.16,
    )
    created.append(bedroll)
    for index, x in enumerate((-0.90, -0.32, 0.30, 0.92)):
        stripe = rounded_box(
            f"{name}_BedrollStripe{index + 1}",
            (x, 0.05, 0.405),
            (0.065, 0.88, 0.018),
            materials["bedroll_stripe"],
            0.02,
        )
        created.append(stripe)
    pillow = rounded_box(
        f"{name}_Pillow",
        (1.15, 0.36, 0.46),
        (0.37, 0.55, 0.17),
        materials["canvas_dark"],
        0.16,
    )
    pillow.rotation_euler[2] = math.radians(-8)
    created.append(pillow)

    # Rolled side flap, stitched roof seams, guy ropes, and physical stakes.
    created.append(
        cylinder_between(
            f"{name}_RolledFlap",
            (width * 0.5 + 0.02, -0.60, 0.46),
            (width * 0.5 + 0.02, 1.25, 0.46),
            0.105,
            materials["canvas"],
            0.105,
            18,
        )
    )
    for seam_x in (-width * 0.5, 0.0, width * 0.5):
        created.append(
            rope_curve(
                f"{name}_RoofSeam_{seam_x:+.2f}",
                [
                    (seam_x, front_y - 0.012, ridge_z + 0.025),
                    (seam_x, 0.05, 1.36),
                    (seam_x, back_y + 0.012, back_z + 0.025),
                ],
                materials["rope"],
                0.010,
            )
        )

    guy_specs = (
        ((-width * 0.5, front_y, ridge_z + 0.12), (-3.05, -2.76, 0.12)),
        ((width * 0.5, front_y, ridge_z + 0.12), (3.08, -2.70, 0.12)),
        ((-width * 0.5, back_y, back_z + 0.06), (-2.77, 2.45, 0.10)),
        ((width * 0.5, back_y, back_z + 0.06), (2.78, 2.44, 0.10)),
    )
    for index, (start, stake) in enumerate(guy_specs):
        middle = (
            (start[0] + stake[0]) * 0.5,
            (start[1] + stake[1]) * 0.5,
            (start[2] + stake[2]) * 0.5 - 0.06,
        )
        created.append(
            rope_curve(
                f"{name}_GuyLine_{index + 1}",
                [start, middle, stake],
                materials["rope"],
                0.016,
            )
        )
        created.append(
            cylinder_between(
                f"{name}_Stake_{index + 1}",
                (stake[0], stake[1], 0.0),
                (stake[0], stake[1], 0.36),
                0.038,
                materials["bark"],
                0.026,
                10,
            )
        )

    for obj in created:
        obj.parent = root
    root.location = (ox, oy, oz)
    root["tka_prop_candidate"] = "bramble-lean-to"
    root["tka_gate"] = 8
    return root


def _panel(name, vertices, faces, material, thickness=0.018):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    if thickness > 0:
        solidify = obj.modifiers.new("Technical fabric thickness", "SOLIDIFY")
        solidify.thickness = thickness
        solidify.offset = 0.0
        _apply_modifier(obj, solidify)
    return obj


def _arch_panel(name, y, width, height, material, forward=-1.0):
    points = [
        (-width * 0.50, y, 0.07),
        (-width * 0.48, y, height * 0.55),
        (-width * 0.30, y, height * 0.84),
        (0.0, y, height),
        (width * 0.30, y, height * 0.84),
        (width * 0.48, y, height * 0.55),
        (width * 0.50, y, 0.07),
    ]
    if forward > 0:
        points.reverse()
    return _panel(name, points, [tuple(range(len(points)))], material, 0.012)


def _stake_and_guy(name, start, stake, materials):
    line = rope_curve(name, [start, stake], materials["guyline"], 0.010)
    pin = cylinder_between(
        f"{name}_Stake",
        (stake[0], stake[1], 0.0),
        (stake[0], stake[1], 0.24),
        0.022,
        materials["aluminum"],
        0.016,
        10,
    )
    return line, pin


def create_modern_dome_tent(origin=(0.0, 0.0, 0.0), name="ModernDomeTent"):
    materials = create_review_materials()
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    created = []

    width, depth, height = 2.7, 3.0, 1.62
    rings, segments = 10, 32
    vertices = []
    for ring in range(rings + 1):
        elevation = (ring / rings) * (math.pi * 0.5)
        horizontal = math.cos(elevation)
        z = 0.08 + math.sin(elevation) * height
        for segment in range(segments):
            angle = math.tau * segment / segments
            vertices.append(
                (
                    math.cos(angle) * width * 0.5 * horizontal,
                    math.sin(angle) * depth * 0.5 * horizontal,
                    z,
                )
            )
    faces = []
    for ring in range(rings):
        start = ring * segments
        following = (ring + 1) * segments
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append(
                (start + segment, start + next_segment, following + next_segment, following + segment)
            )
    shell = _panel(f"{name}_TensionedFly", vertices, faces, materials["tent_spruce"], 0.024)
    for polygon in shell.data.polygons:
        polygon.use_smooth = True
    created.append(shell)

    floor = rounded_box(
        f"{name}_BathtubFloor", (0.0, 0.0, 0.07), (1.30, 1.42, 0.055), materials["tent_floor"], 0.10
    )
    created.append(floor)
    created.append(
        _arch_panel(
            f"{name}_MeshDoor",
            -depth * 0.5 - 0.025,
            1.30,
            1.27,
            materials["tent_mesh"],
        )
    )

    pole_points_x = []
    pole_points_y = []
    for index in range(13):
        t = index / 12
        x = -width * 0.5 + width * t
        y = -depth * 0.5 + depth * t
        z = 0.10 + math.sin(math.pi * t) * (height + 0.055)
        pole_points_x.append((x, 0.0, z))
        pole_points_y.append((0.0, y, z))
    created.append(rope_curve(f"{name}_CrossPoleA", pole_points_x, materials["aluminum"], 0.022))
    created.append(rope_curve(f"{name}_CrossPoleB", pole_points_y, materials["aluminum"], 0.022))

    guy_specs = (
        ((-0.82, -1.08, 1.08), (-1.83, -2.02, 0.04)),
        ((0.82, -1.08, 1.08), (1.83, -2.02, 0.04)),
        ((-0.82, 1.08, 1.08), (-1.83, 2.02, 0.04)),
        ((0.82, 1.08, 1.08), (1.83, 2.02, 0.04)),
    )
    for index, (start, stake) in enumerate(guy_specs):
        created.extend(_stake_and_guy(f"{name}_Guy_{index + 1}", start, stake, materials))

    for obj in created:
        obj.parent = root
    root.location = origin
    root["tka_prop_candidate"] = "modern-dome-two-person"
    root["tka_gate"] = 8
    return root


def create_modern_tunnel_tent(origin=(0.0, 0.0, 0.0), name="ModernTunnelTent"):
    materials = create_review_materials()
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    created = []

    width, depth, height = 3.0, 4.6, 1.64
    sections, arcs = 16, 20
    vertices = []
    for section in range(sections + 1):
        y = -depth * 0.5 + depth * (section / sections)
        taper = 0.96 + 0.04 * math.sin(math.pi * section / sections)
        for arc in range(arcs + 1):
            angle = math.pi * arc / arcs
            vertices.append(
                (
                    -math.cos(angle) * width * 0.5 * taper,
                    y,
                    0.07 + math.sin(angle) * height,
                )
            )
    faces = []
    stride = arcs + 1
    for section in range(sections):
        for arc in range(arcs):
            a = section * stride + arc
            faces.append((a, a + 1, a + stride + 1, a + stride))
    shell = _panel(f"{name}_TensionedFly", vertices, faces, materials["tent_teal"], 0.024)
    for polygon in shell.data.polygons:
        polygon.use_smooth = True
    created.append(shell)

    floor = rounded_box(
        f"{name}_BathtubFloor", (0.0, 0.0, 0.07), (1.43, 2.20, 0.055), materials["tent_floor"], 0.10
    )
    created.append(floor)
    created.append(
        _arch_panel(
            f"{name}_MeshDoor",
            -depth * 0.5 - 0.025,
            1.50,
            1.36,
            materials["tent_mesh"],
        )
    )
    ochre_panel = _panel(
        f"{name}_OchreVentPanel",
        [
            (-0.48, depth * 0.5 + 0.018, 0.08),
            (0.48, depth * 0.5 + 0.018, 0.08),
            (0.34, depth * 0.5 + 0.018, 0.82),
            (-0.34, depth * 0.5 + 0.018, 0.82),
        ],
        [(0, 1, 2, 3)],
        materials["tent_ochre"],
        0.012,
    )
    created.append(ochre_panel)

    for hoop_index, y in enumerate((-2.12, 0.0, 2.12)):
        points = []
        for arc in range(17):
            angle = math.pi * arc / 16
            points.append(
                (-math.cos(angle) * width * 0.5, y, 0.08 + math.sin(angle) * (height + 0.045))
            )
        created.append(rope_curve(f"{name}_Hoop_{hoop_index + 1}", points, materials["aluminum"], 0.023))

    guy_specs = (
        ((-0.72, -2.25, 1.28), (-1.75, -3.15, 0.04)),
        ((0.72, -2.25, 1.28), (1.75, -3.15, 0.04)),
        ((-0.72, 2.25, 1.28), (-1.75, 3.15, 0.04)),
        ((0.72, 2.25, 1.28), (1.75, 3.15, 0.04)),
    )
    for index, (start, stake) in enumerate(guy_specs):
        created.extend(_stake_and_guy(f"{name}_Guy_{index + 1}", start, stake, materials))

    for obj in created:
        obj.parent = root
    root.location = origin
    root["tka_prop_candidate"] = "modern-tunnel-three-person"
    root["tka_gate"] = 8
    return root


def create_modern_trekking_tent(origin=(0.0, 0.0, 0.0), name="ModernTrekkingTent"):
    materials = create_review_materials()
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    created = []

    width, depth = 2.2, 3.0
    vertices = [
        (-width * 0.5, -depth * 0.5, 0.08),
        (width * 0.5, -depth * 0.5, 0.08),
        (-width * 0.5, depth * 0.5, 0.08),
        (width * 0.5, depth * 0.5, 0.08),
        (0.0, -depth * 0.34, 1.48),
        (0.0, depth * 0.34, 1.28),
    ]
    faces = [(0, 2, 5, 4), (1, 4, 5, 3), (0, 4, 1), (2, 3, 5)]
    shell = _panel(f"{name}_TensionedFly", vertices, faces, materials["tent_spruce"], 0.024)
    created.append(shell)
    floor = rounded_box(
        f"{name}_BathtubFloor", (0.0, 0.0, 0.07), (1.04, 1.42, 0.05), materials["tent_floor"], 0.08
    )
    created.append(floor)
    door = _panel(
        f"{name}_MeshDoor",
        [(-0.55, -depth * 0.5 - 0.02, 0.09), (0.55, -depth * 0.5 - 0.02, 0.09), (0.0, -depth * 0.34 - 0.02, 1.36)],
        [(0, 1, 2)],
        materials["tent_mesh"],
        0.012,
    )
    created.append(door)
    ochre = _panel(
        f"{name}_OchreFootPanel",
        [(-1.08, 1.49, 0.09), (1.08, 1.49, 0.09), (0.0, 1.01, 1.20)],
        [(0, 1, 2)],
        materials["tent_ochre"],
        0.012,
    )
    created.append(ochre)

    for index, (x, y, height) in enumerate(((0.0, -depth * 0.34, 1.50), (0.0, depth * 0.34, 1.30))):
        created.append(
            cylinder_between(
                f"{name}_TrekkingPole_{index + 1}",
                (x, y, 0.02),
                (x, y, height),
                0.025,
                materials["aluminum"],
                0.019,
                12,
            )
        )
    for index, (start, stake) in enumerate(
        (
            ((0.0, -1.02, 1.48), (0.0, -2.18, 0.04)),
            ((0.0, 1.02, 1.28), (0.0, 2.18, 0.04)),
            ((-1.05, 0.0, 0.12), (-1.55, 0.0, 0.04)),
            ((1.05, 0.0, 0.12), (1.55, 0.0, 0.04)),
        )
    ):
        created.extend(_stake_and_guy(f"{name}_Guy_{index + 1}", start, stake, materials))

    for obj in created:
        obj.parent = root
    root.location = origin
    root["tka_prop_candidate"] = "modern-trekking-one-person"
    root["tka_gate"] = 8
    return root


def create_established_fire_bed(origin=(0.0, 0.0, 0.0), name="EstablishedFireBed"):
    materials = create_review_materials()
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    created = []

    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=1.18, depth=0.055, location=(0.0, 0.0, 0.025))
    mineral = bpy.context.object
    mineral.name = f"{name}_MineralSoil"
    mineral.scale = (1.0, 0.88, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mineral.data.materials.append(materials["mineral_soil"])
    created.append(mineral)

    for index in range(12):
        angle = math.tau * index / 12 + 0.055 * math.sin(index * 2.3)
        radius = 0.91 + 0.07 * math.sin(index * 1.7)
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2,
            radius=1.0,
            location=(math.cos(angle) * radius, math.sin(angle) * radius, 0.17),
        )
        stone = bpy.context.object
        stone.name = f"{name}_Stone_{index + 1:02d}"
        stone.scale = (
            0.34 + 0.06 * math.sin(index * 2.1),
            0.24 + 0.05 * math.cos(index * 1.3),
            0.20 + 0.035 * math.sin(index * 1.1),
        )
        stone.rotation_euler = (0.11 * math.sin(index), 0.10 * math.cos(index * 1.4), angle + 0.25)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        stone.data.materials.append(materials["fire_stone"])
        created.append(stone)

    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.67, depth=0.035, location=(0.0, 0.0, 0.075))
    ash = bpy.context.object
    ash.name = f"{name}_AshBed"
    ash.scale = (1.0, 0.82, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ash.data.materials.append(materials["ash"])
    created.append(ash)

    for index, (yaw, offset, z) in enumerate(
        ((0.58, (-0.08, -0.11), 0.26), (-0.58, (0.08, 0.10), 0.28), (0.58, (0.0, 0.02), 0.48), (-0.58, (0.02, -0.02), 0.50))
    ):
        log = rounded_box(
            f"{name}_SplitLog_{index + 1}",
            (offset[0], offset[1], z),
            (0.66, 0.115, 0.105),
            materials["charcoal"],
            0.065,
        )
        log.rotation_euler[2] = yaw
        created.append(log)

    for index in range(9):
        angle = index * 2.399
        radius = 0.18 + 0.28 * ((index * 7) % 9) / 8
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1,
            radius=0.055 + 0.018 * (index % 3),
            location=(math.cos(angle) * radius, math.sin(angle) * radius, 0.17 + 0.025 * (index % 2)),
        )
        ember = bpy.context.object
        ember.name = f"{name}_Ember_{index + 1}"
        ember.scale = (1.5, 0.75, 0.65)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        ember.data.materials.append(materials["ember"])
        created.append(ember)

    for obj in created:
        obj.parent = root
    root.location = origin
    root["tka_prop_candidate"] = "established-forest-fire-bed"
    root["tka_gate"] = 8
    root["tka_runtime_owners_preserved"] = "volumetric fire; smoke; primary light; fill light"
    return root


def create_modern_camp_chair(origin=(0.0, 0.0, 0.0), name="ModernCampChair", fabric="teal"):
    materials = create_review_materials()
    fabric_material = materials["tent_teal"] if fabric == "teal" else materials["tent_spruce"]
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    created = []

    frame_specs = (
        ((-0.31, -0.30, 0.02), (-0.25, 0.22, 0.47)),
        ((0.31, -0.30, 0.02), (0.25, 0.22, 0.47)),
        ((-0.31, 0.30, 0.02), (-0.25, -0.18, 0.47)),
        ((0.31, 0.30, 0.02), (0.25, -0.18, 0.47)),
        ((-0.25, 0.20, 0.44), (-0.29, 0.30, 1.16)),
        ((0.25, 0.20, 0.44), (0.29, 0.30, 1.16)),
    )
    for index, (start, end) in enumerate(frame_specs):
        created.append(
            cylinder_between(
                f"{name}_Frame_{index + 1}",
                start,
                end,
                0.018,
                materials["aluminum"],
                0.016,
                10,
            )
        )

    seat = _panel(
        f"{name}_Seat",
        [(-0.29, -0.25, 0.43), (0.29, -0.25, 0.43), (0.25, 0.23, 0.47), (-0.25, 0.23, 0.47)],
        [(0, 1, 2, 3)],
        fabric_material,
        0.026,
    )
    created.append(seat)
    back = _panel(
        f"{name}_Back",
        [(-0.27, 0.24, 0.48), (0.27, 0.24, 0.48), (0.29, 0.30, 1.13), (-0.29, 0.30, 1.13)],
        [(0, 1, 2, 3)],
        fabric_material,
        0.026,
    )
    created.append(back)

    for obj in created:
        obj.parent = root
    root.location = origin
    root["tka_prop_candidate"] = "modern-folding-camp-chair"
    root["tka_gate"] = 8
    return root


def create_split_root_stump(origin=(0.0, 0.0, 0.0), name="SplitRootStump"):
    materials = create_review_materials()
    ox, oy, oz = origin
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    created = []

    # The trunk uses three irregular rings and a broken, off-centre top. A
    # perfect cylinder plus radial spokes would recreate the artificial root
    # island this Forest pass explicitly rejected.
    segments = 19
    vertices = []
    for ring_index, (height, base_radius) in enumerate(((0.08, 0.72), (0.68, 0.61), (1.20, 0.54))):
        for segment in range(segments):
            angle = math.tau * segment / segments
            irregularity = (
                1.0
                + 0.10 * math.sin(angle * 3.0 + ring_index * 0.7)
                + 0.055 * math.cos(angle * 7.0 - ring_index * 0.4)
            )
            radius = base_radius * irregularity
            x = math.cos(angle) * radius * (1.06 - ring_index * 0.025)
            y = math.sin(angle) * radius * (0.80 + ring_index * 0.025)
            z = height
            if ring_index == 2:
                z += 0.16 * math.sin(angle * 2.0 + 0.45) + 0.08 * math.cos(angle * 5.0)
            vertices.append((x, y, z))
    top_center_index = len(vertices)
    vertices.append((-0.09, 0.05, 1.05))
    faces = []
    material_indices = []
    for ring_index in range(2):
        start = ring_index * segments
        following = (ring_index + 1) * segments
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append(
                (
                    start + segment,
                    start + next_segment,
                    following + next_segment,
                    following + segment,
                )
            )
            material_indices.append(0)
    top_start = 2 * segments
    for segment in range(segments):
        faces.append((top_start + segment, top_start + (segment + 1) % segments, top_center_index))
        material_indices.append(1)
    mesh = bpy.data.meshes.new(f"{name}_IrregularTrunkMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(materials["bark"])
    mesh.materials.append(materials["cut"])
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
        polygon.use_smooth = material_index == 0
    mesh.update()
    trunk = bpy.data.objects.new(f"{name}_IrregularTrunk", mesh)
    bpy.context.collection.objects.link(trunk)
    bevel = trunk.modifiers.new("Splintered weathered edges", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    _apply_modifier(trunk, bevel)
    created.append(trunk)

    root_paths = (
        ((0.34, 0.05, 0.34), (0.82, 0.16, 0.18), (1.58, 0.42, 0.025), 0.24),
        ((-0.30, 0.28, 0.30), (-0.72, 0.70, 0.15), (-1.20, 1.10, 0.02), 0.19),
        ((-0.32, -0.22, 0.28), (-0.88, -0.45, 0.12), (-1.52, -0.32, 0.02), 0.21),
        ((0.22, -0.30, 0.29), (0.50, -0.86, 0.13), (0.94, -1.22, 0.02), 0.17),
    )
    for index, (start, elbow, end, radius) in enumerate(root_paths):
        created.append(
            cylinder_between(
                f"{name}_Root_{index + 1}A",
                start,
                elbow,
                radius,
                materials["bark"],
                radius * 0.64,
                14,
            )
        )
        created.append(
            cylinder_between(
                f"{name}_Root_{index + 1}B",
                elbow,
                end,
                radius * 0.64,
                materials["bark"],
                radius * 0.16,
                12,
            )
        )

    # Two nonparallel splinters reinforce the broken top without forming a
    # decorative crown of evenly spaced spikes.
    for index, (start, tip, radius) in enumerate(
        (((-0.24, 0.10, 1.13), (-0.38, 0.12, 1.78), 0.15), ((0.30, -0.08, 1.08), (0.46, -0.20, 1.49), 0.12))
    ):
        created.append(
            cylinder_between(
                f"{name}_Splinter_{index + 1}",
                start,
                tip,
                radius,
                materials["bark"],
                0.018,
                10,
            )
        )

    for index, (location, scale) in enumerate(
        (((-0.32, 0.16, 1.27), (0.22, 0.13, 0.025)), ((0.39, -0.10, 0.78), (0.24, 0.11, 0.030)))
    ):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
        moss = bpy.context.object
        moss.name = f"{name}_Moss_{index + 1}"
        moss.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        moss.data.materials.append(materials["moss"])
        created.append(moss)

    for obj in created:
        obj.parent = root
    root.location = (ox, oy, oz)
    root["tka_prop_candidate"] = "split-root-stump"
    root["tka_gate"] = 8
    return root


def create_forked_windfall(origin=(0.0, 0.0, 0.0), name="ForkedWindfall"):
    materials = create_review_materials()
    ox, oy, oz = origin
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    created = []

    spine = (
        ((-2.05, -0.18, 0.30), (-0.85, -0.08, 0.39), 0.34, 0.31),
        ((-0.85, -0.08, 0.39), (0.48, 0.10, 0.46), 0.31, 0.27),
        ((0.48, 0.10, 0.46), (1.82, 0.26, 0.34), 0.27, 0.19),
    )
    for index, (start, end, radius, radius_end) in enumerate(spine):
        created.append(
            cylinder_between(
                f"{name}_Spine_{index + 1}",
                start,
                end,
                radius,
                materials["bark"],
                radius_end,
                18,
            )
        )
    branches = (
        ((0.16, 0.04, 0.43), (1.20, 1.18, 0.63), 0.19, 0.055),
        ((0.67, 0.14, 0.42), (1.42, -0.88, 0.31), 0.15, 0.045),
        ((-0.72, -0.07, 0.39), (-1.20, 0.78, 0.48), 0.13, 0.040),
    )
    for index, (start, end, radius, radius_end) in enumerate(branches):
        created.append(
            cylinder_between(
                f"{name}_Branch_{index + 1}",
                start,
                end,
                radius,
                materials["bark"],
                radius_end,
                14,
            )
        )
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=14,
            radius=radius_end * 1.05,
            depth=0.025,
            location=end,
        )
        cut = bpy.context.object
        cut.name = f"{name}_BrokenCap_{index + 1}"
        direction = Vector(end) - Vector(start)
        cut.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
        cut.data.materials.append(materials["cut"])
        created.append(cut)

    for index, (location, scale) in enumerate(
        (((-0.45, 0.0, 0.70), (0.58, 0.19, 0.060)), ((0.82, 0.16, 0.66), (0.42, 0.16, 0.050)))
    ):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
        moss = bpy.context.object
        moss.name = f"{name}_Moss_{index + 1}"
        moss.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        moss.data.materials.append(materials["moss"])
        created.append(moss)

    for obj in created:
        obj.parent = root
    root.location = (ox, oy, oz)
    root["tka_prop_candidate"] = "forked-windfall"
    root["tka_gate"] = 8
    return root


def descendants(root) -> Iterable[bpy.types.Object]:
    yield root
    for child in root.children_recursive:
        yield child


def set_visible(root, visible):
    for obj in descendants(root):
        obj.hide_render = not visible
        obj.hide_viewport = not visible
