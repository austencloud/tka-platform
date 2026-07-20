"""Author the Blossom twilight garden in Blender.

This is the editable source-of-truth pass for the Blossom environment. Static
set dressing is authored here, saved as a .blend, and rendered for visual QA.
The clean runtime GLB is exported in a separate pass by
``blender-export-blossom-full.py``.

Run headless from the repository root:

  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background --factory-startup ^
    --python scripts/build-blossom-environment.py

Outputs:
  blender/blossom_environment.blend
  %TEMP%/tka-blossom-evidence/blossom_environment_qa.png
"""

import math
import os
import tempfile

import bpy
from mathutils import Euler, Matrix, Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "static", "models", "blossom")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "blossom_environment.blend")
QA_DIR = os.path.join(tempfile.gettempdir(), "tka-blossom-evidence")
QA_PATH = os.path.join(QA_DIR, "blossom_environment_qa.png")
STAGE_DECK_TOP = 0.35

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
os.makedirs(QA_DIR, exist_ok=True)

# Keep web-served storage limited to runtime GLBs. These exact legacy outputs
# were produced by earlier revisions of this authoring script.
for stale_name in (
    "blossom_environment.blend",
    "blossom_environment.blend1",
    "blossom_environment_qa.png",
):
    stale_path = os.path.join(OUTPUT_DIR, stale_name)
    if os.path.isfile(stale_path):
        os.remove(stale_path)

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness=0.72, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission:
            emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            strength_input = bsdf.inputs.get("Emission Strength")
            if emission_input:
                emission_input.default_value = (*emission, 1.0)
            if strength_input:
                strength_input.default_value = emission_strength
    return mat


GROUND = material("Garden Earth", (0.105, 0.082, 0.075), roughness=0.96)
GROUND_EDGE = material("Garden Edge", (0.038, 0.034, 0.045), roughness=1.0)
GRAVEL = material("Moon Garden Gravel", (0.205, 0.185, 0.185), roughness=0.98)
MOSS = material("Riverbank Moss", (0.055, 0.105, 0.065), roughness=0.96)
SHRUB = material("Garden Shrub", (0.035, 0.075, 0.052), roughness=0.93)
CEDAR = material("Cedar Warm", (0.43, 0.175, 0.095), roughness=0.68)
CEDAR_LIGHT = material("Cedar Honey", (0.69, 0.34, 0.15), roughness=0.62)
CEDAR_DARK = material("Cedar Shadow", (0.16, 0.065, 0.045), roughness=0.78)
BARK = material("Sakura Bark", (0.205, 0.090, 0.085), roughness=0.9)
BLOSSOM_DEEP = material("Blossom Rose Shadow", (0.40, 0.065, 0.19), roughness=0.84)
BLOSSOM_MID = material("Blossom Sakura", (0.82, 0.27, 0.47), roughness=0.76)
BLOSSOM_LIGHT = material("Blossom Moonlit", (1.0, 0.64, 0.78), roughness=0.72)
TORII = material("Torii Vermilion", (0.57, 0.055, 0.038), roughness=0.66)
TORII_DARK = material("Torii Lacquer Shadow", (0.16, 0.018, 0.025), roughness=0.58)
STONE = material("Lantern Stone", (0.30, 0.29, 0.34), roughness=0.98)
STONE_DARK = material("River Stone", (0.12, 0.145, 0.19), roughness=0.94)
WATER = material(
    "Moonlit River",
    (0.022, 0.09, 0.17),
    roughness=0.14,
    metallic=0.08,
    emission=(0.012, 0.035, 0.075),
    emission_strength=0.22,
)
LANTERN_GLOW = material(
    "Lantern Glow",
    (1.0, 0.36, 0.09),
    roughness=0.5,
    emission=(1.0, 0.22, 0.045),
    emission_strength=7.0,
)
HORIZON = material("Twilight Horizon", (0.20, 0.055, 0.105), roughness=1.0, emission=(0.20, 0.055, 0.105), emission_strength=0.34)
TWILIGHT = material("Twilight Mid", (0.035, 0.030, 0.105), roughness=1.0, emission=(0.035, 0.030, 0.105), emission_strength=0.28)
ZENITH = material("Twilight Zenith", (0.006, 0.010, 0.032), roughness=1.0, emission=(0.006, 0.010, 0.032), emission_strength=0.24)
MOUNTAIN_NEAR = material("Mountain Near", (0.040, 0.065, 0.095), roughness=1.0)
MOUNTAIN_FAR = material("Mountain Far", (0.090, 0.070, 0.125), roughness=1.0)
MOON = material(
    "Moon Glow",
    (1.0, 0.73, 0.42),
    roughness=0.82,
    emission=(1.0, 0.43, 0.16),
    emission_strength=4.5,
)


def make_mesh(name, vertices, faces, materials, material_indices=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for mat in materials:
        mesh.materials.append(mat)
    if material_indices:
        for polygon, index in zip(mesh.polygons, material_indices):
            polygon.material_index = index
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    return mesh


def link_object(name, mesh, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    obj.scale = scale
    return obj


def create_icosphere_mesh(name, mat, subdivisions=1):
    """Create one reusable rounded mesh for instanced stones and planting."""
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions,
        radius=1.0,
        location=(0, 0, -50),
    )
    template = bpy.context.active_object
    template.data.name = name
    template.data.materials.append(mat)
    for polygon in template.data.polygons:
        polygon.use_smooth = True
    mesh = template.data
    bpy.data.objects.remove(template, do_unlink=True)
    return mesh


def append_box(vertices, faces, center, size, rotation=(0, 0, 0)):
    start = len(vertices)
    x, y, z = (axis * 0.5 for axis in size)
    local = [
        (-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
        (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z),
    ]
    transform = Matrix.LocRotScale(Vector(center), Euler(rotation).to_quaternion(), Vector((1, 1, 1)))
    vertices.extend([tuple(transform @ Vector(point)) for point in local])
    faces.extend([
        (start, start + 3, start + 2, start + 1),
        (start + 4, start + 5, start + 6, start + 7),
        (start, start + 1, start + 5, start + 4),
        (start + 1, start + 2, start + 6, start + 5),
        (start + 2, start + 3, start + 7, start + 6),
        (start + 3, start, start + 4, start + 7),
    ])


def append_tapered_segment(vertices, faces, start_point, end_point, radius_start, radius_end, sides=8):
    start_point = Vector(start_point)
    end_point = Vector(end_point)
    axis = (end_point - start_point).normalized()
    reference = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((0, 1, 0))
    tangent = axis.cross(reference).normalized()
    bitangent = axis.cross(tangent).normalized()
    start = len(vertices)
    for point, radius in ((start_point, radius_start), (end_point, radius_end)):
        for index in range(sides):
            angle = 2 * math.pi * index / sides
            radial = tangent * math.cos(angle) + bitangent * math.sin(angle)
            vertices.append(tuple(point + radial * radius))
    for index in range(sides):
        nxt = (index + 1) % sides
        faces.append((start + index, start + nxt, start + sides + nxt, start + sides + index))
    faces.append(tuple(start + index for index in reversed(range(sides))))
    faces.append(tuple(start + sides + index for index in range(sides)))


def append_cylinder(vertices, faces, center, radius_bottom, radius_top, height, sides=16):
    z0 = center[2] - height * 0.5
    z1 = center[2] + height * 0.5
    append_tapered_segment(
        vertices,
        faces,
        (center[0], center[1], z0),
        (center[0], center[1], z1),
        radius_bottom,
        radius_top,
        sides,
    )


def append_ellipsoid(vertices, faces, center, radii, segments=14, rings=7):
    """Append one smooth, economical blossom cluster and return its face count."""
    face_start = len(faces)
    vertex_start = len(vertices)
    cx, cy, cz = center
    rx, ry, rz = radii
    vertices.append((cx, cy, cz + rz))
    for ring in range(1, rings):
        phi = math.pi * ring / rings
        for segment in range(segments):
            angle = 2 * math.pi * segment / segments
            vertices.append((
                cx + rx * math.sin(phi) * math.cos(angle),
                cy + ry * math.sin(phi) * math.sin(angle),
                cz + rz * math.cos(phi),
            ))
    bottom = len(vertices)
    vertices.append((cx, cy, cz - rz))
    first_ring = vertex_start + 1
    for segment in range(segments):
        nxt = (segment + 1) % segments
        faces.append((vertex_start, first_ring + segment, first_ring + nxt))
    for ring in range(rings - 2):
        current = first_ring + ring * segments
        following = current + segments
        for segment in range(segments):
            nxt = (segment + 1) % segments
            faces.append((current + segment, following + segment, following + nxt, current + nxt))
    last_ring = first_ring + (rings - 2) * segments
    for segment in range(segments):
        nxt = (segment + 1) % segments
        faces.append((last_ring + segment, bottom, last_ring + nxt))
    return len(faces) - face_start


def create_backdrop():
    segments = 40
    rings = ((-2.0, 54.0), (8.0, 53.0), (22.0, 48.0), (38.0, 36.0), (49.0, 12.0))
    vertices, faces, indices = [], [], []
    for z, radius in rings:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
    for ring_index in range(len(rings) - 1):
        current = ring_index * segments
        following = (ring_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((current + index, current + nxt, following + nxt, following + index))
            indices.append(0 if ring_index == 0 else 1 if ring_index < 3 else 2)
    top = len(vertices)
    vertices.append((0, 0, 52))
    last_ring = (len(rings) - 1) * segments
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((last_ring + index, last_ring + nxt, top))
        indices.append(2)
    backdrop = link_object(
        "Twilight_Backdrop",
        make_mesh("Twilight Backdrop Mesh", vertices, faces, [HORIZON, TWILIGHT, ZENITH], indices, smooth=True),
    )
    backdrop.visible_shadow = False


def create_mountain_ring(
    name,
    inner_radius,
    ridge_radius,
    outer_radius,
    base_height,
    amplitude,
    phase,
    mat,
):
    """Build a closed, viewable-from-any-angle mountain silhouette band."""
    segments = 72
    vertices = []
    for radius_kind in ("inner", "ridge", "outer"):
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            if radius_kind == "inner":
                radius = inner_radius * (1.0 + 0.012 * math.sin(angle * 5 + phase))
                z = -0.25
            elif radius_kind == "ridge":
                radius = ridge_radius * (1.0 + 0.026 * math.sin(angle * 4 + phase * 0.7))
                wave = (
                    0.54
                    + 0.22 * math.sin(angle * 3 + phase)
                    + 0.15 * math.sin(angle * 7 - phase * 0.6)
                    + 0.09 * math.sin(angle * 13 + phase * 1.4)
                )
                z = base_height + amplitude * max(0.18, wave)
            else:
                radius = outer_radius
                z = -0.8
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))

    faces = []
    for ring_index in range(2):
        current = ring_index * segments
        following = (ring_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((current + index, current + nxt, following + nxt, following + index))

    link_object(
        name,
        make_mesh(f"{name} Mesh", vertices, faces, [mat], smooth=True),
    )


def create_moon():
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=12,
        radius=1.85,
        location=(12.5, 43.0, 13.8),
    )
    moon = bpy.context.active_object
    moon.name = "Moon_Disc"
    moon.data.name = "Moon Disc Mesh"
    moon.data.materials.append(MOON)
    moon.visible_shadow = False
    for polygon in moon.data.polygons:
        polygon.use_smooth = True


def create_ground():
    segments = 40
    rings = ((0.0, 0.0), (6.2, 0.0), (11.5, 0.12), (18.0, 0.34), (23.0, 0.08), (30.0, 0.12))
    vertices = [(0.0, 0.0, 0.0)]
    for ring_index, (radius, lift) in enumerate(rings[1:], 1):
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            edge = 1.0 + 0.028 * math.sin(angle * 5 + ring_index * 0.7)
            x = radius * edge * math.cos(angle)
            y = radius * edge * 0.84 * math.sin(angle)
            z = lift + (0.07 * math.sin(angle * 3 + 0.4) if ring_index > 1 else 0.0)
            vertices.append((x, y, z))
    faces = []
    for index in range(segments):
        faces.append((0, 1 + index, 1 + (index + 1) % segments))
    for ring_index in range(1, len(rings) - 1):
        inner = 1 + (ring_index - 1) * segments
        outer = 1 + ring_index * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((inner + index, outer + index, outer + nxt, inner + nxt))
    ground = link_object("Garden_Ground", make_mesh("Garden Ground Mesh", vertices, faces, [GROUND], smooth=True))
    bevel = ground.modifiers.new("Soft garden edge", "SOLIDIFY")
    bevel.thickness = 0.18
    bevel.material_offset = 0

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=64,
        radius=7.55,
        depth=0.07,
        location=(0, 0, 0.035),
    )
    clearing = bpy.context.active_object
    clearing.name = "Garden_Clearing"
    clearing.data.name = "Moon Garden Gravel Clearing Mesh"
    clearing.data.materials.append(GRAVEL)
    for polygon in clearing.data.polygons:
        polygon.use_smooth = True


def create_stage():
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=5.25, depth=0.34, location=(0, 0, 0.17))
    base = bpy.context.active_object
    base.name = "Stage_Base"
    base["tka_stage_role"] = "base"
    base["tka_stage_surface_max"] = 0.34
    base.data.materials.append(CEDAR_DARK)
    for polygon in base.data.polygons:
        polygon.use_smooth = True

    bpy.ops.mesh.primitive_torus_add(
        major_radius=5.13,
        minor_radius=0.13,
        major_segments=48,
        minor_segments=8,
        location=(0, 0, STAGE_DECK_TOP - 0.13),
    )
    rim = bpy.context.active_object
    rim.name = "Stage_Rim"
    rim["tka_stage_role"] = "rim"
    rim["tka_stage_surface_max"] = STAGE_DECK_TOP
    rim.data.materials.append(CEDAR_LIGHT)

    vertices, faces, material_indices = [], [], []
    plank_depth = 0.72
    for index, y in enumerate([value * plank_depth for value in range(-6, 7)]):
        half_chord = math.sqrt(max(0.1, 5.0 ** 2 - y ** 2))
        before = len(faces)
        append_box(
            vertices,
            faces,
            (0, y, STAGE_DECK_TOP - 0.075),
            (half_chord * 2 - 0.09, plank_depth - 0.055, 0.15),
        )
        material_indices.extend([index % 2] * (len(faces) - before))
    plank_mesh = make_mesh(
        "Stage Cedar Plank Mesh",
        vertices,
        faces,
        [CEDAR, CEDAR_LIGHT],
        material_indices,
    )
    planks = link_object("Stage_Planks", plank_mesh)
    planks["tka_stage_role"] = "playable_deck"
    planks["tka_stage_deck_top"] = STAGE_DECK_TOP
    planks["tka_stage_surface_max"] = STAGE_DECK_TOP
    bevel = planks.modifiers.new("Hand-finished plank edges", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 2

    vertices, faces = [], []
    for x, y in ((-3.7, -2.7), (3.7, -2.7), (-3.7, 2.7), (3.7, 2.7), (0, -3.8), (0, 3.8)):
        append_cylinder(vertices, faces, (x, y, 0.02), 0.20, 0.16, 0.36, sides=10)
    feet = link_object("Stage_Feet", make_mesh("Stage Foot Mesh", vertices, faces, [CEDAR_DARK], smooth=True))
    feet["tka_stage_role"] = "supports"
    feet["tka_stage_surface_max"] = 0.20


def verify_stage_authoring_bounds():
    bpy.context.view_layer.update()
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    stage_maxima = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not obj.name.startswith("Stage_"):
            continue
        evaluated = obj.evaluated_get(dependency_graph)
        maximum = max((evaluated.matrix_world @ Vector(corner)).z for corner in evaluated.bound_box)
        stage_maxima[obj.name] = maximum

    deck_maximum = stage_maxima.get("Stage_Planks")
    if deck_maximum is None or abs(deck_maximum - STAGE_DECK_TOP) > 0.0001:
        raise RuntimeError(f"Stage deck top must be {STAGE_DECK_TOP:.3f}; got {deck_maximum}")
    too_high = {name: value for name, value in stage_maxima.items() if value > STAGE_DECK_TOP + 0.0001}
    if too_high:
        raise RuntimeError(f"Stage geometry exceeds the playable deck: {too_high}")

    print("Stage authoring bounds (Z-up):")
    for name, maximum in sorted(stage_maxima.items()):
        print(f"  {name}: max Z={maximum:.6f}")


TREE_SPECS = (
    {
        "trunk": [(0, 0, 0), (0.10, 0.0, 2.0), (-0.08, 0.04, 3.8), (-0.38, 0.08, 5.25)],
        "branches": [
            ((0.02, 0.02, 2.8), (-2.1, 0.15, 4.65), 0.25, 0.09),
            ((-0.08, 0.03, 3.6), (1.75, -0.15, 5.05), 0.22, 0.08),
            ((-0.22, 0.06, 4.25), (-1.1, -1.15, 5.5), 0.16, 0.055),
        ],
        "canopy": ((-0.35, 0.0), 3.15, 2.20, 0.15),
    },
    {
        "trunk": [(0, 0, 0), (-0.08, 0.04, 1.9), (0.20, 0.0, 3.6), (0.58, -0.1, 5.1)],
        "branches": [
            ((0.05, 0.02, 2.7), (2.25, 0.25, 4.55), 0.26, 0.085),
            ((0.18, 0.0, 3.45), (-1.7, -0.4, 5.0), 0.20, 0.07),
            ((0.38, -0.05, 4.15), (1.35, 1.25, 5.45), 0.15, 0.05),
        ],
        "canopy": ((0.42, -0.04), 3.05, 2.34, 1.15),
    },
    {
        "trunk": [(0, 0, 0), (0.04, -0.08, 2.15), (0.0, 0.17, 4.05), (-0.12, 0.2, 5.55)],
        "branches": [
            ((0.02, 0.02, 2.9), (-1.85, -0.55, 4.8), 0.23, 0.075),
            ((0.0, 0.14, 3.65), (1.95, 0.55, 5.0), 0.22, 0.07),
            ((-0.06, 0.18, 4.25), (-1.0, 1.45, 5.65), 0.16, 0.05),
        ],
        "canopy": ((-0.08, 0.12), 2.85, 2.44, 2.0),
    },
    {
        "trunk": [(0, 0, 0), (-0.12, 0.0, 1.8), (-0.35, -0.08, 3.45), (-0.68, -0.15, 4.85)],
        "branches": [
            ((-0.2, -0.04, 2.6), (-2.35, 0.15, 4.2), 0.25, 0.09),
            ((-0.31, -0.08, 3.2), (1.45, -0.6, 4.75), 0.19, 0.065),
            ((-0.48, -0.12, 3.85), (-1.55, 1.15, 5.05), 0.15, 0.05),
        ],
        "canopy": ((-0.58, -0.08), 3.35, 2.0, 2.75),
    },
)


def create_tree_prototype(index, spec):
    vertices, faces = [], []
    trunk = spec["trunk"]
    center, radius_x, radius_y, phase = spec["canopy"]
    for segment_index in range(len(trunk) - 1):
        append_tapered_segment(
            vertices,
            faces,
            trunk[segment_index],
            trunk[segment_index + 1],
            0.38 - segment_index * 0.08,
            0.29 - segment_index * 0.075,
            sides=9,
        )
    branch_gestures = list(spec["branches"]) + [
        (trunk[2], (center[0], center[1] + radius_y * 0.86, 5.10), 0.18, 0.055),
        (trunk[3], (center[0] + radius_x * 0.48, center[1] - radius_y * 0.62, 5.72), 0.14, 0.045),
    ]
    for gesture_index, (branch_start, branch_end, radius_start, radius_end) in enumerate(branch_gestures):
        start = Vector(branch_start)
        end = Vector(branch_end)
        direction = end - start
        sideways = Vector((-direction.y, direction.x, 0)).normalized()
        bend = sideways * (0.14 if gesture_index % 2 else -0.14) + Vector((0, 0, 0.16))
        midpoint = start.lerp(end, 0.54) + bend
        middle_radius = radius_start * 0.58
        append_tapered_segment(vertices, faces, start, midpoint, radius_start, middle_radius, sides=8)
        append_tapered_segment(vertices, faces, midpoint, end, middle_radius, radius_end, sides=8)

    # A second tier of fine branchlets keeps the dark branching structure
    # visible through the blossom sprays instead of reading as a pink blob.
    twig_targets = (
        (-0.96, -0.18, 4.78),
        (-0.82, 0.48, 5.18),
        (-0.66, -0.68, 4.98),
        (-0.48, 0.82, 5.62),
        (-0.26, -0.92, 5.18),
        (-0.12, 0.94, 5.82),
        (0.18, -0.88, 5.28),
        (0.34, 0.88, 5.74),
        (0.58, -0.64, 5.08),
        (0.78, 0.54, 5.38),
        (0.96, -0.08, 4.86),
        (-0.38, 0.06, 6.18),
        (0.22, 0.10, 6.34),
        (0.66, 0.02, 5.92),
    )
    anchors = [Vector(gesture[1]) for gesture in branch_gestures]
    for twig_index, (x_norm, y_norm, z) in enumerate(twig_targets):
        target = Vector((
            center[0] + x_norm * radius_x,
            center[1] + y_norm * radius_y,
            z,
        ))
        anchor = min(anchors, key=lambda point: (target - point).length_squared)
        direction = target - anchor
        sideways = Vector((-direction.y, direction.x, 0)).normalized()
        midpoint = anchor.lerp(target, 0.55) + sideways * (0.09 if twig_index % 2 else -0.09)
        append_tapered_segment(vertices, faces, anchor, midpoint, 0.060, 0.034, sides=6)
        append_tapered_segment(vertices, faces, midpoint, target, 0.034, 0.014, sides=6)
    trunk_mesh = make_mesh(f"Sakura Trunk Prototype {index + 1}", vertices, faces, [BARK], smooth=True)

    # Many smaller sprays leave breathing room between blossoms and expose the
    # branch silhouette. A deterministic golden-angle layout avoids cloning a
    # single obvious cloud shape across all four prototypes.
    clusters = []
    cluster_count = 72
    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    for cluster_index in range(cluster_count):
        radial = math.sqrt((cluster_index + 0.55) / cluster_count)
        angle = cluster_index * golden_angle + phase * 0.31
        x_norm = math.cos(angle) * radial
        y_norm = math.sin(angle) * radial * 0.88
        z = (
            5.18
            + 0.98 * (1.0 - radial ** 1.55)
            + 0.13 * math.sin(cluster_index * 1.73 + phase)
        )
        sx = 0.080 + 0.036 * (0.5 + 0.5 * math.sin(cluster_index * 2.11 + phase))
        sy = 0.105 + 0.040 * (0.5 + 0.5 * math.cos(cluster_index * 1.57 - phase))
        sz = 0.145 + 0.070 * (0.5 + 0.5 * math.sin(cluster_index * 1.19 + phase))
        material_index = 2 if z > 5.72 else 1 if cluster_index % 3 else 0
        clusters.append((x_norm, y_norm, z, sx, sy, sz, material_index))

    vertices, faces, indices = [], [], []
    crown_rotation = phase * 0.13
    cos_rotation = math.cos(crown_rotation)
    sin_rotation = math.sin(crown_rotation)
    for x_norm, y_norm, z, sx, sy, sz, material_index in clusters:
        rotated_x = x_norm * cos_rotation - y_norm * sin_rotation
        rotated_y = x_norm * sin_rotation + y_norm * cos_rotation
        count = append_ellipsoid(
            vertices,
            faces,
            (center[0] + rotated_x * radius_x, center[1] + rotated_y * radius_y, z),
            (radius_x * sx, radius_y * sy, sz),
            segments=10,
            rings=5,
        )
        indices.extend([material_index] * count)
    canopy_mesh = make_mesh(
        f"Sakura Cluster Crown Prototype {index + 1}",
        vertices,
        faces,
        [BLOSSOM_DEEP, BLOSSOM_MID, BLOSSOM_LIGHT],
        indices,
        smooth=True,
    )
    return trunk_mesh, canopy_mesh


def create_grove():
    prototypes = [create_tree_prototype(index, spec) for index, spec in enumerate(TREE_SPECS)]
    placements = (
        (-15.8, -4.7, 0.00, 0, 1.18, 0.12),
        (15.6, -4.2, 0.00, 1, 1.16, -0.46),
        (-17.3, 2.1, 0.00, 2, 1.06, 0.88),
        (17.1, 2.8, 0.00, 3, 1.04, -1.08),
        (-18.0, 8.8, 0.08, 1, 1.02, 1.42),
        (18.2, 9.5, 0.08, 0, 1.02, -0.82),
        (-16.2, 16.7, 0.20, 3, 1.00, 0.52),
        (17.0, 17.2, 0.22, 2, 1.04, -0.18),
        (-9.2, 20.5, 0.22, 0, 1.02, 1.12),
        (-1.2, 22.0, 0.18, 2, 0.98, -0.54),
        (11.4, 20.8, 0.24, 1, 1.02, 0.34),
        (-11.7, 13.8, 0.42, 3, 0.88, -1.22),
        (-5.8, 14.8, 0.40, 0, 0.86, 0.72),
        (11.6, 18.2, 0.45, 2, 0.82, -0.66),
        (-20.2, 18.5, 0.18, 1, 0.76, 0.38),
        (-14.0, 22.2, 0.16, 2, 0.72, -0.92),
        (-6.2, 24.0, 0.16, 3, 0.68, 0.16),
        (3.0, 24.4, 0.16, 0, 0.70, -0.44),
        (12.2, 22.8, 0.18, 3, 0.74, 0.84),
        (20.0, 18.8, 0.20, 1, 0.76, -0.24),
    )
    for index, (x, y, z, prototype_index, scale, rotation_z) in enumerate(placements):
        trunk_mesh, canopy_mesh = prototypes[prototype_index]
        rotation = (0, 0, rotation_z)
        link_object(f"Sakura_{index + 1:02d}_Trunk", trunk_mesh, (x, y, z), rotation, (scale, scale, scale))
        link_object(f"Sakura_{index + 1:02d}_Canopy", canopy_mesh, (x, y, z), rotation, (scale, scale, scale))


def create_torii(position=(7.2, 18.0, 0.60), scale=0.64):
    origin_x, origin_y, ground_z = position
    vertices, faces, indices = [], [], []
    for local_x in (-3.0, 3.0):
        before = len(faces)
        append_cylinder(
            vertices,
            faces,
            (origin_x + local_x * scale, origin_y, ground_z + 2.95 * scale),
            0.42 * scale,
            0.31 * scale,
            5.9 * scale,
            sides=12,
        )
        indices.extend([0] * (len(faces) - before))
    for local_center, local_size, rotation in (
        ((0, 11.7, 5.05), (7.2, 0.48, 0.42), (0, 0, 0)),
        ((0, 11.7, 6.00), (8.6, 0.62, 0.48), (0, 0, 0)),
        ((-4.55, 11.7, 6.18), (1.25, 0.62, 0.42), (0, -0.14, 0)),
        ((4.55, 11.7, 6.18), (1.25, 0.62, 0.42), (0, 0.14, 0)),
    ):
        center = (
            origin_x + local_center[0] * scale,
            origin_y,
            ground_z + local_center[2] * scale,
        )
        size = tuple(axis * scale for axis in local_size)
        before = len(faces)
        append_box(vertices, faces, center, size, rotation)
        indices.extend([0] * (len(faces) - before))
    for local_x in (-3.0, 3.0):
        before = len(faces)
        append_cylinder(
            vertices,
            faces,
            (origin_x + local_x * scale, origin_y, ground_z + 0.28 * scale),
            0.58 * scale,
            0.50 * scale,
            0.56 * scale,
            sides=12,
        )
        indices.extend([1] * (len(faces) - before))
    link_object("Torii_Gate", make_mesh("Torii Gate Mesh", vertices, faces, [TORII, TORII_DARK], indices, smooth=True))


def create_river_and_bridge():
    center = (0.0, 13.2, 0.11)
    radius_x = 21.8
    radius_y = 6.8
    segments = 72
    vertices = [(center[0], center[1], center[2])]
    for index in range(segments):
        angle = 2 * math.pi * index / segments
        ripple = 1.0 + 0.025 * math.sin(angle * 5 + 0.4) + 0.014 * math.sin(angle * 11)
        vertices.append((
            center[0] + radius_x * ripple * math.cos(angle),
            center[1] + radius_y * ripple * math.sin(angle),
            center[2],
        ))
    faces = [(0, 1 + index, 1 + (index + 1) % segments) for index in range(segments)]
    water = link_object("River_Water", make_mesh("Moonlit River Mesh", vertices, faces, [WATER], smooth=True))
    water.visible_shadow = False

    island_mesh = create_icosphere_mesh("River Island Mesh", MOSS, subdivisions=2)
    island_placements = (
        (-11.7, 13.7, 0.16, 4.7, 3.0, 0.62),
        (-5.2, 16.2, 0.14, 3.7, 2.35, 0.50),
        (7.2, 17.0, 0.17, 5.2, 3.35, 0.70),
        (16.0, 13.8, 0.13, 3.4, 2.2, 0.48),
    )
    for index, (x, y, z, scale_x, scale_y, scale_z) in enumerate(island_placements):
        link_object(
            f"River_Island_{index + 1:02d}",
            island_mesh,
            (x, y, z),
            (0, 0, 0.17 * index),
            (scale_x, scale_y, scale_z),
        )

    stone_mesh = create_icosphere_mesh("River Bank Stone Mesh", STONE_DARK)
    shoreline_x = tuple(-19.0 + index * 2.0 for index in range(20))
    stone_index = 0
    for x in shoreline_x:
        normalized_x = max(-0.98, min(0.98, x / radius_x))
        y = center[1] - radius_y * math.sqrt(1.0 - normalized_x * normalized_x)
        if abs(x + 11.7) < 1.5:
            continue
        stone_index += 1
        scale = 0.48 + 0.08 * math.sin(stone_index * 1.7)
        link_object(
            f"Riverbank_Stone_{stone_index:02d}",
            stone_mesh,
            (x, y, 0.20),
            (0.04 * math.sin(stone_index), 0.06 * math.cos(stone_index), stone_index * 0.47),
            (scale * 1.35, scale, scale * 0.58),
        )

    bridge_x = -11.7
    bridge_start_y = 6.35
    bridge_end_y = 12.55
    vertices, faces, indices = [], [], []
    plank_count = 12
    for index in range(plank_count):
        t = index / (plank_count - 1)
        y = bridge_start_y + (bridge_end_y - bridge_start_y) * t
        z = 0.44 + 0.84 * math.sin(math.pi * t)
        before = len(faces)
        append_box(
            vertices,
            faces,
            (bridge_x, y, z),
            (2.10, 0.56, 0.17),
            (0.11 * math.cos(math.pi * t), 0, 0),
        )
        indices.extend([index % 2] * (len(faces) - before))
    bridge = link_object(
        "Bridge_Planks",
        make_mesh("Arched Bridge Plank Mesh", vertices, faces, [CEDAR, CEDAR_LIGHT], indices),
    )
    bevel = bridge.modifiers.new("Bridge plank edges", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 2

    vertices, faces = [], []
    for side_x in (bridge_x - 1.05, bridge_x + 1.05):
        points = []
        for index in range(7):
            t = index / 6
            y = bridge_start_y + 0.12 + (bridge_end_y - bridge_start_y - 0.24) * t
            z = 1.26 + 0.82 * math.sin(math.pi * t)
            points.append((side_x, y, z))
            append_tapered_segment(vertices, faces, (side_x, y, z - 0.82), (side_x, y, z), 0.075, 0.065, sides=7)
        for index in range(len(points) - 1):
            append_tapered_segment(vertices, faces, points[index], points[index + 1], 0.075, 0.075, sides=7)
    link_object("Bridge_Rails", make_mesh("Arched Bridge Rail Mesh", vertices, faces, [CEDAR_DARK], smooth=True))


LANTERN_PLACEMENTS = (
    (-7.0, 4.9, -0.14, 0.68),
    (7.0, 4.8, 0.18, 0.68),
    (-13.2, 5.9, -0.32, 0.62),
    (6.1, 9.7, 0.26, 0.58),
    (7.1, 14.3, -0.18, 0.58),
)


def create_lanterns():
    vertices, faces = [], []
    append_box(vertices, faces, (0, 0, 0.18), (1.15, 1.15, 0.36))
    append_box(vertices, faces, (0, 0, 0.48), (0.72, 0.72, 0.25))
    append_box(vertices, faces, (0, 0, 1.45), (0.34, 0.34, 1.70))
    append_box(vertices, faces, (0, 0, 2.34), (1.0, 1.0, 0.20))
    for x in (-0.38, 0.38):
        for y in (-0.38, 0.38):
            append_box(vertices, faces, (x, y, 2.78), (0.16, 0.16, 0.82))
    append_box(vertices, faces, (0, 0, 3.22), (1.38, 1.38, 0.22))
    append_box(vertices, faces, (0, 0, 3.40), (0.78, 0.78, 0.18))
    stone_mesh = make_mesh("Stone Lantern Body Mesh", vertices, faces, [STONE])
    glow_vertices, glow_faces = [], []
    append_box(glow_vertices, glow_faces, (0, 0, 2.78), (0.68, 0.68, 0.64))
    glow_mesh = make_mesh("Stone Lantern Glow Mesh", glow_vertices, glow_faces, [LANTERN_GLOW])
    for index, (x, y, rotation, scale) in enumerate(LANTERN_PLACEMENTS):
        link_object(f"StoneLantern_{index + 1:02d}", stone_mesh, (x, y, 0), (0, 0, rotation), (scale, scale, scale))
        link_object(f"LanternGlow_{index + 1:02d}", glow_mesh, (x, y, 0), (0, 0, rotation), (scale, scale, scale))


def create_stepping_stones():
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.0, depth=0.18, location=(0, 0, -20))
    template = bpy.context.active_object
    template.name = "Path_Stone_Template"
    template.data.name = "Stepping Stone Mesh"
    template.data.materials.append(STONE)
    for polygon in template.data.polygons:
        polygon.use_smooth = True
    bpy.data.objects.remove(template, do_unlink=True)
    mesh = bpy.data.meshes["Stepping Stone Mesh"]
    placements = (
        (4.2, 5.7),
        (4.7, 6.8),
        (5.2, 7.9),
        (5.7, 9.0),
        (6.1, 10.1),
        (6.45, 11.2),
        (6.75, 12.3),
        (6.95, 13.35),
        (7.1, 14.35),
    )
    for index, (x, y) in enumerate(placements):
        scale = 0.46 + 0.035 * math.sin(index * 2.0)
        link_object(f"Path_Stone_{index + 1:02d}", mesh, (x, y, 0.18), (0.03, 0.04, index * 0.38), (scale * 1.30, scale, 0.72))


def create_ground_details():
    shrub_mesh = create_icosphere_mesh("Garden Shrub Mesh", SHRUB, subdivisions=2)
    rock_mesh = create_icosphere_mesh("Garden Accent Rock Mesh", STONE_DARK)
    shrub_placements = (
        (-9.0, -3.4, 0.12, 0.95, 0.62, 0.44),
        (-10.4, 1.0, 0.10, 1.15, 0.72, 0.50),
        (-9.1, 4.2, 0.12, 0.84, 0.56, 0.40),
        (9.2, -3.1, 0.12, 0.90, 0.60, 0.42),
        (10.6, 0.7, 0.10, 1.10, 0.70, 0.48),
        (9.6, 4.0, 0.12, 0.82, 0.55, 0.38),
        (-14.2, 3.6, 0.16, 1.20, 0.76, 0.52),
        (14.5, 4.0, 0.15, 1.18, 0.74, 0.50),
        (-15.8, 9.7, 0.28, 1.05, 0.70, 0.46),
        (15.6, 10.0, 0.26, 1.08, 0.72, 0.46),
        (-12.8, 14.4, 0.54, 0.92, 0.58, 0.40),
        (-10.4, 13.2, 0.52, 0.84, 0.54, 0.38),
        (5.0, 17.1, 0.58, 0.92, 0.60, 0.42),
        (8.9, 16.3, 0.60, 1.02, 0.64, 0.44),
        (15.4, 13.8, 0.48, 0.82, 0.54, 0.38),
    )
    for index, (x, y, z, scale_x, scale_y, scale_z) in enumerate(shrub_placements):
        link_object(
            f"Garden_Shrub_{index + 1:02d}",
            shrub_mesh,
            (x, y, z),
            (0, 0, index * 0.63),
            (scale_x, scale_y, scale_z),
        )

    rock_placements = (
        (-8.4, 5.0, 0.22, 0.70, 0.52, 0.38),
        (-15.0, 5.8, 0.24, 0.88, 0.58, 0.42),
        (10.7, 5.3, 0.22, 0.76, 0.52, 0.36),
        (14.1, 7.0, 0.23, 0.92, 0.62, 0.40),
        (-16.5, 12.0, 0.34, 1.12, 0.70, 0.48),
        (17.0, 12.0, 0.32, 1.08, 0.68, 0.46),
        (-8.8, 14.2, 0.54, 0.72, 0.50, 0.36),
        (4.1, 16.4, 0.56, 0.74, 0.52, 0.36),
        (10.2, 17.0, 0.58, 0.82, 0.56, 0.38),
    )
    for index, (x, y, z, scale_x, scale_y, scale_z) in enumerate(rock_placements):
        link_object(
            f"Garden_Rock_{index + 1:02d}",
            rock_mesh,
            (x, y, z),
            (0.05 * math.sin(index), 0.08 * math.cos(index), index * 0.71),
            (scale_x, scale_y, scale_z),
        )


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, color, energy, size, target=(0, 0, 2.5)):
    data = bpy.data.lights.new(name, "AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)


def setup_render():
    scene = bpy.context.scene
    # Blender 5 exposes the Eevee Next renderer under the stable EEVEE enum.
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = QA_PATH
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"

    world = bpy.data.worlds.new("Blossom Twilight")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.018, 0.055, 1.0)
    background.inputs["Strength"].default_value = 0.48
    scene.world = world

    add_area_light("Light_Stage_Warmth", (0, -8, 13), (1.0, 0.53, 0.32), 2850, 8.0, (0, 0, 0.4))
    add_area_light("Light_Moon_Fill", (10, 20, 23), (0.25, 0.38, 1.0), 2850, 12.0, (0, 7, 2.4))
    add_area_light("Light_Sunset_Rim", (-18, 26, 11), (1.0, 0.20, 0.16), 1550, 8.0, (0, 14, 4))
    for index, (x, y, _rotation, scale) in enumerate(LANTERN_PLACEMENTS):
        data = bpy.data.lights.new(f"Light_Lantern_{index + 1:02d}", "POINT")
        data.color = (1.0, 0.18, 0.045)
        data.energy = 150 * scale
        data.shadow_soft_size = 1.15
        light = bpy.data.objects.new(data.name, data)
        bpy.context.scene.collection.objects.link(light)
        light.location = (x, y, 2.75 * scale)

    camera_data = bpy.data.cameras.new("Camera_Blossom")
    camera = bpy.data.objects.new("Camera_Blossom", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (0.0, -38.5, 15.5)
    camera.data.lens = 40
    camera.data.sensor_width = 36
    aim_at(camera, (0, 8.0, 3.4))
    scene.camera = camera

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    scene.render.image_settings.color_depth = "8"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    bpy.ops.render.render(write_still=True)


create_backdrop()
create_mountain_ring("Mountain_Far", 36.5, 44.0, 52.0, 2.0, 5.0, 1.45, MOUNTAIN_FAR)
create_mountain_ring("Mountain_Near", 24.5, 30.8, 37.0, 1.2, 4.6, 0.20, MOUNTAIN_NEAR)
create_moon()
create_ground()
create_stage()
verify_stage_authoring_bounds()
create_river_and_bridge()
create_grove()
create_torii()
create_lanterns()
create_stepping_stones()
create_ground_details()
setup_render()

print("\nBlossom environment authored successfully")
print(f"Editable source: {BLEND_PATH}")
print(f"QA render:       {QA_PATH}")
print(f"Mesh objects:    {sum(1 for obj in bpy.data.objects if obj.type == 'MESH')}")
print(f"Unique meshes:   {len(bpy.data.meshes)}")
print(f"Materials:       {len(bpy.data.materials)}")
