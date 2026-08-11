"""Build the isolated First Fire Cinder Court Gate 2 graybox in Blender.

The scene is derived only from the hash-stamped schema-v2 coordinate manifest.
It never opens or modifies the shared interactive Blender scene.

Run from the repository root:

  pnpm exec tsx scripts/export-first-fire-blender-plan.ts
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
    --background --factory-startup --python scripts/build-first-fire-graybox.py
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import random
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = (
    ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "first-fire-cinder-court"
    / "first-fire-cinder-court-blender-plan.json"
)
BLEND_PATH = ROOT / "blender" / "first-fire-cinder-court-graybox.blend"
RAW_GLB_PATH = ROOT / "artifacts" / "first-fire-cinder-court-raw.glb"
EVIDENCE_DIR = ROOT / "artifacts" / "first-fire-cinder-court"
REPORT_PATH = EVIDENCE_DIR / "first-fire-cinder-court-graybox-report.json"
QA_DIR = Path(tempfile.gettempdir()) / "tka-first-fire-cinder-court-evidence"
RNG = random.Random(0xC1D3C0)


def load_contract() -> tuple[dict, dict, str]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    contract = manifest["contract"]
    canonical = manifest["digestPayloadCanonical"]
    decoded_payload = json.loads(canonical)
    expected_payload = {
        "contract": contract,
        "sequenceSources": manifest["sequenceSources"],
        "sequenceFingerprints": manifest["sequenceFingerprints"],
    }
    if decoded_payload != expected_payload:
        raise RuntimeError(
            "First Fire Cinder Court canonical digest payload does not match its manifest fields."
        )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if digest != manifest["sourceDigest"]:
        raise RuntimeError(
            "First Fire Cinder Court manifest digest mismatch. "
            "Regenerate it from the TypeScript plan before building."
        )
    if contract["schemaVersion"] != 2:
        raise RuntimeError("The Cinder Court builder requires contract schema v2")
    if contract["room"]["width"] != 58 or contract["room"]["depth"] != 44:
        raise RuntimeError("Refusing to build a stale non-58-by-44 First Fire plan")
    return manifest, contract, digest


MANIFEST, CONTRACT, SOURCE_DIGEST = load_contract()
ROOM = CONTRACT["room"]
BOUNDS = ROOM["blenderBounds"]
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = CONTRACT["sceneName"]
scene["first_fire_scene_id"] = "first-fire-cinder-court"
scene["first_fire_contract_schema"] = CONTRACT["schemaVersion"]
scene["first_fire_source_digest"] = SOURCE_DIGEST
scene["first_fire_source_modules"] = json.dumps(CONTRACT["sourceModules"])
scene["first_fire_runtime_mount"] = CONTRACT["coordinateSystem"]["gltfRuntime"][
    "mount"
]


def create_collection(
    name: str, parent: bpy.types.Collection | None = None
) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(result)
    return result


export_root = create_collection("EXPORT_FirstFireCinderCourt")
COLLECTIONS: dict[str, bpy.types.Collection] = {}
for collection_name in CONTRACT["collections"]:
    parent = (
        export_root
        if collection_name
        not in {"REFERENCE", "LOCATORS", "CAMERAS", "QA_ONLY"}
        else None
    )
    COLLECTIONS[collection_name] = create_collection(collection_name, parent)


def move_to_collection(
    obj: bpy.types.Object, target: bpy.types.Collection
) -> bpy.types.Object:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float = 0.85,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = color
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission:
            bsdf.inputs["Emission Color"].default_value = emission
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return result


# One rock. The carved shell is a single continuous surface, so floor, wall and
# vault cannot be given three materials without lying about the geometry - the
# separate cinder-floor and fractured-edge stones the stacked shell needed are
# gone with it. What still separates the walked ground from the rock is the
# route ribbon laid on top of it.
BASALT = material("FF Basalt", (0.055, 0.043, 0.039, 1), roughness=0.96)
ROUTE = material("FF Safe Route", (0.28, 0.15, 0.085, 1), roughness=0.88)
COURT = material("FF Court Stone", (0.19, 0.105, 0.068, 1), roughness=0.92)
TRENCH = material(
    "FF Trench Ember", (0.74, 0.025, 0.005, 1), roughness=0.45,
    emission=(1, 0.015, 0.001, 1), emission_strength=3.3,
)
COAL = material(
    "FF Coal Memory", (0.28, 0.012, 0.004, 1), roughness=0.65,
    emission=(0.65, 0.012, 0.001, 1), emission_strength=1.4,
)
GROWTH = material(
    "FF Earth Growth", (0.02, 0.26, 0.045, 1), roughness=0.82,
    emission=(0.02, 0.34, 0.035, 1), emission_strength=1.1,
)
STEM = material("FF Charred Torch", (0.025, 0.009, 0.005, 1), roughness=0.95)
FLAME_MATERIALS = {
    "field": material(
        "FF Field Flame Guide", (1, 0.16, 0.008, 1), roughness=0.34,
        emission=(1, 0.025, 0.001, 1), emission_strength=4.2,
    ),
    "dj": material(
        "FF DJ Flame Guide", (1, 0.22, 0.009, 1), roughness=0.32,
        emission=(1, 0.04, 0.001, 1), emission_strength=4.5,
    ),
    "ek": material(
        "FF EK Flame Guide", (1, 0.38, 0.012, 1), roughness=0.32,
        emission=(1, 0.09, 0.001, 1), emission_strength=4.5,
    ),
    "fl": material(
        "FF FL Flame Guide", (0.95, 0.055, 0.014, 1), roughness=0.32,
        emission=(1, 0.008, 0.002, 1), emission_strength=4.5,
    ),
}
WATER = material(
    "FF Water Threshold", (0.04, 0.22, 0.30, 1), roughness=0.55,
    emission=(0.02, 0.16, 0.24, 1), emission_strength=0.55,
)
PERFORMER = material("FF Performer Locator", (0.36, 0.24, 0.13, 1), roughness=0.8)


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.type == "MESH":
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    rotation_z: float = 0,
    bevel: float = 0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=(0, 0, rotation_z))
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    move_to_collection(obj, target)
    if bevel:
        modifier = obj.modifiers.new("Fractured edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    vertices: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, mat)
    return move_to_collection(obj, target)


def add_polygon_prism(
    name: str,
    points: list[dict],
    bottom: float,
    top: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    count = len(points)
    vertices = [(point["x"], point["y"], bottom) for point in points]
    vertices += [(point["x"], point["y"], top) for point in points]
    faces: list[tuple[int, ...]] = []
    faces.append(tuple(reversed(range(count))))
    faces.append(tuple(range(count, count * 2)))
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    assign(obj, mat)
    return obj


def add_segment(
    name: str,
    start: dict,
    end: dict,
    width: float,
    height: float,
    elevation: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    dx = end["x"] - start["x"]
    dy = end["y"] - start["y"]
    length = math.hypot(dx, dy)
    return add_box(
        name,
        ((start["x"] + end["x"]) / 2, (start["y"] + end["y"]) / 2, elevation),
        (length, width, height),
        mat,
        target,
        rotation_z=math.atan2(dy, dx),
        bevel=min(0.12, width * 0.08),
    )


def add_ring(
    name: str,
    centre: dict,
    inner_radius: float,
    outer_radius: float,
    elevation: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    segments: int = 72,
    start_degrees: float = 0,
    sweep_degrees: float = 360,
) -> bpy.types.Object:
    """Ribbon between two radii. A partial sweep stays an open arc so a court's
    orbit lane never runs through the rock that defines the court."""
    closed = abs(sweep_degrees) >= 359.999
    ring_points = segments if closed else max(4, int(segments * abs(sweep_degrees) / 360)) + 1
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(ring_points):
        span = math.tau if closed else math.radians(sweep_degrees)
        divisor = ring_points if closed else ring_points - 1
        angle = math.radians(start_degrees) + span * index / divisor
        cosine, sine = math.cos(angle), math.sin(angle)
        vertices.append((centre["x"] + cosine * inner_radius, centre["y"] + sine * inner_radius, elevation))
        vertices.append((centre["x"] + cosine * outer_radius, centre["y"] + sine * outer_radius, elevation))
    quad_count = ring_points if closed else ring_points - 1
    for index in range(quad_count):
        nxt = (index + 1) % ring_points
        faces.append((index * 2, nxt * 2, nxt * 2 + 1, index * 2 + 1))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    assign(obj, mat)
    return obj


def add_flame_tongue(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    *,
    offset_x: float,
    offset_y: float,
    radius: float,
    height: float,
    phase: float,
    segments: int = 10,
) -> None:
    first = len(vertices)
    rings = [(0, radius), (0.27, radius * 0.92), (0.58, radius * 0.65), (0.82, radius * 0.38)]
    for fraction, ring_radius in rings:
        sway_x = math.sin(phase + fraction * 4.8) * radius * fraction * 0.48
        sway_y = math.cos(phase * 1.4 + fraction * 3.2) * radius * fraction * 0.25
        for index in range(segments):
            angle = math.tau * index / segments
            vertices.append((
                offset_x + sway_x + math.cos(angle) * ring_radius,
                offset_y + sway_y + math.sin(angle) * ring_radius * 0.82,
                fraction * height,
            ))
    tip = len(vertices)
    vertices.append((
        offset_x + math.sin(phase + 4.8) * radius * 0.62,
        offset_y + math.cos(phase * 1.4 + 3.2) * radius * 0.35,
        height,
    ))
    for ring_index in range(len(rings) - 1):
        ring_start = first + ring_index * segments
        next_start = ring_start + segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((ring_start + index, ring_start + nxt, next_start + nxt, next_start + index))
    last_ring = first + (len(rings) - 1) * segments
    for index in range(segments):
        faces.append((last_ring + index, last_ring + (index + 1) % segments, tip))
    faces.append(tuple(reversed(range(first, first + segments))))


def flame_mesh(category: str) -> bpy.types.Mesh:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    add_flame_tongue(vertices, faces, offset_x=0, offset_y=0, radius=0.28, height=1.35, phase=0.4)
    add_flame_tongue(vertices, faces, offset_x=-0.22, offset_y=0.04, radius=0.17, height=0.92, phase=2.1)
    add_flame_tongue(vertices, faces, offset_x=0.22, offset_y=-0.03, radius=0.15, height=0.76, phase=4.3)
    mesh = bpy.data.meshes.new(f"FF_{category}_OrganicFlame_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh.materials.append(FLAME_MATERIALS[category])
    return mesh


def sample_polyline(points: list[dict], count: int) -> list[tuple[float, float]]:
    segments: list[tuple[dict, dict, float]] = []
    total = 0.0
    for start, end in zip(points, points[1:]):
        length = math.hypot(end["x"] - start["x"], end["y"] - start["y"])
        if length > 1e-6:
            segments.append((start, end, length))
            total += length
    result: list[tuple[float, float]] = []
    for index in range(count):
        target = total * ((index + 0.5) / count)
        walked = 0.0
        for start, end, length in segments:
            if walked + length >= target:
                t = (target - walked) / length
                result.append((
                    start["x"] + (end["x"] - start["x"]) * t,
                    start["y"] + (end["y"] - start["y"]) * t,
                ))
                break
            walked += length
    return result


# ---------------------------------------------------------------------------
# The room shell: carved, not stacked.
#
# Gate 2 was reopened because the first shell was a navigation blockout wearing
# a room's name. One flat 58 by 44 metre slab, four perimeter boxes at the
# bounding box, no ceiling object of any kind, and every interior wall a
# free-standing prism standing on the slab - including nine `fill-*` masses
# whose only job was to occupy floor the route never uses. Floors met walls at
# a seam, walls stopped in mid-air, and the spacing read as arbitrary because
# it was: the prisms were placed to block movement, not to describe a space.
#
# This is a lava tube, so it is built the way a lava tube exists: as the absence
# of rock. The walked section is swept along each contract centreline, the
# courts are domed where the corridors open out, all of those volumes are joined
# into a single negative, and that negative is subtracted from one solid mass.
# Floor, wall and vault are then the same continuous surface by construction -
# there is no seam that can fail to connect, and no leftover floor to fill.
#
# The approved plan contract is consumed unchanged. Centrelines and widths come
# from pathSections, the chambers from courts/shrines, the apertures from doors,
# and the corridor clearance is the same 5.5m the contract's basalt walls carry.
# ---------------------------------------------------------------------------
min_x, max_x = BOUNDS["minX"], BOUNDS["maxX"]
min_y, max_y = BOUNDS["minY"], BOUNDS["maxY"]

SHELL_MARGIN = 1.8          # rock outboard of the plan bounds, so walls have body
SHELL_FLOOR_DEPTH = 1.4     # rock under the walked floor
SHELL_ROOF = 11.5           # top of the mass; clears the FL chimney crown

CORRIDOR_CLEARANCE = 5.5    # the contract's corridor basalt is 5.5m tall
MOUTH_CLEARANCE = 4.2       # a court mouth is a constriction, not a corridor
VESTIBULE_CLEARANCE = 4.6   # the Water arrival is low, so the corridor lifts
DOOR_CLEARANCE = 3.4

# Each court is its own chamber. The contract fixes the footprint (radius 7) and
# a 6m rim minimum; the SECTION is what makes three chambers cut from one rock
# read as three rooms instead of one room three times. These are the identities
# already named in first-fire-court-identity: magma chamber, burn, column.
COURT_SHELL = {
    "dj": {"clearance": 7.6, "shape": "slot"},   # magma chamber: a canyon slot
    "ek": {"clearance": 6.0, "shape": "dome"},   # the burn: a low, wide bowl
    "fl": {"clearance": 9.2, "shape": "shaft"},  # the column: a chimney throat
}

# Cross-sections as (multiple of the floor half-width, fraction of clearance),
# floor edge up to the crown. Expressing the lateral term as a multiple lets a
# 3m mouth and a 14m court share one section language at different scale.
WALL_PROFILES = {
    "tube":  [(1.00, 0.00), (1.03, 0.09), (1.07, 0.24), (1.08, 0.44), (1.00, 0.63), (0.81, 0.80), (0.46, 0.93), (0.00, 1.00)],
    "slot":  [(1.00, 0.00), (1.03, 0.10), (1.06, 0.30), (1.06, 0.52), (1.02, 0.70), (0.92, 0.85), (0.60, 0.95), (0.00, 1.00)],
    "dome":  [(1.00, 0.00), (1.05, 0.10), (1.08, 0.26), (1.04, 0.44), (0.94, 0.60), (0.78, 0.75), (0.47, 0.90), (0.00, 1.00)],
    "shaft": [(1.00, 0.00), (1.04, 0.08), (1.06, 0.24), (1.02, 0.42), (0.80, 0.56), (0.42, 0.68), (0.22, 0.86), (0.00, 1.00)],
}

# The wall foot stands outboard of the walked edge, so the collider set - which
# is derived from the same contract widths - always stops the visitor before
# the rock rather than inside it.
FLOOR_SHOULDER = 0.30

# A joint stands this much proud of the run it closes. Sized to match exactly,
# its wall is TANGENT to the tube's, and tangency is the one thing an exact
# boolean cannot resolve into a solid: it leaves a knife edge of rock along the
# whole contact, which the interior audit reads as a wall 1mm thick and the
# visitor reads as a fin standing in the corridor. Proud by a hand's width, the
# surfaces cross transversally instead, and the union is unambiguous. It is not
# visible - 8cm on a 5.5m passage - and it is the difference between a room and
# a room full of blades.
JOINT_PROUD = 0.08

CARVE_COLLECTION = create_collection("CARVE_Negative")


def wall_profile(walked_half_width: float, clearance: float, shape: str = "tube") -> list[tuple[float, float]]:
    foot = walked_half_width + FLOOR_SHOULDER
    return [(foot * u, clearance * h) for u, h in WALL_PROFILES[shape]]


def section_loop(walked_half_width: float, clearance: float, shape: str = "tube") -> list[tuple[float, float]]:
    """Closed cross-section of the void, as (lateral offset, height)."""
    profile = wall_profile(walked_half_width, clearance, shape)
    foot = profile[0][0]
    loop = [(-foot, 0.0), (foot, 0.0)]
    loop += profile[1:]                                     # right wall to crown
    loop += [(-u, h) for u, h in reversed(profile[1:-1])]   # left wall back down
    return loop


def void_mesh(name: str, vertices: list[tuple[float, float, float]], faces: list[tuple[int, ...]]) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    CARVE_COLLECTION.objects.link(obj)
    return obj


def unit(start: tuple[float, float], end: tuple[float, float]) -> tuple[float, float]:
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    return (dx / length, dy / length) if length > 1e-9 else (1.0, 0.0)


# The mitre widens the section through a bend so the corridor keeps its width
# instead of pinching. Past this the widening runs away, so it clamps; the joint
# chamber every vertex now carries is what actually closes the corner, so the
# clamp is free to be conservative - and it should be, because widening is not
# free. A mitred ring is a flat cross-section pushed out sideways, and once it
# is pushed further than the segments either side of it are long, it crosses
# them, and the sweep hands the solver a mesh that folds through itself.
#
# At 0.45 a 104-degree turn scaled the ring by 1.62, throwing it 4.1m out from
# the torch lane's last vertex on segments about 2m long. The solver resolved
# that fold into a triangular prism of rock 150mm across and 1.1m tall, standing
# a metre inside the dj court, 4.4m from that vertex. Nothing downstream could
# remove it: it is inboard of every wall, so no blunting cut reaches it, and it
# is welded to the shell, so no loose-part sweep sees it.
#
# 0.85 caps the widening at 1.18. Corners are closed by their joints, which is
# what they were added to do.
MITRE_LIMIT = 0.85

# The centreline each sweep actually used, overrun included. The needle pass
# below reasons about surfaces, and a surface built from a path that is not the
# path the mesh used would send it hunting wedges that are not there.
SWEPT_PATHS: dict[str, list[tuple[float, float]]] = {}


def swept_void(
    name: str,
    points: list[tuple[float, float]],
    width: float,
    clearance: float,
    shape: str = "tube",
    extend: float = 0.3,
) -> bpy.types.Object | None:
    """One continuous run of tunnel swept along a centreline.

    Mitred at every interior vertex. The first version of this built each
    segment as its own straight box, which left the corridor scalloped: at every
    bend the two boxes' square corners stood proud of the wall on the outside
    and notched it on the inside, and the plan view read as a chain of blobs
    rather than a passage.
    """
    path = [
        point for index, point in enumerate(points)
        if index == 0
        or math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > 1e-6
    ]
    if len(path) < 2:
        return None
    # Overrun both ends so consecutive sections overlap. Two sweeps meeting at a
    # shared vertex touch on a coplanar cap, which is the one case an exact
    # boolean is entitled to get wrong.
    if extend > 0:
        head = unit(path[0], path[1])
        tail = unit(path[-2], path[-1])
        path.insert(0, (path[0][0] - head[0] * extend, path[0][1] - head[1] * extend))
        path.append((path[-1][0] + tail[0] * extend, path[-1][1] + tail[1] * extend))

    SWEPT_PATHS[name] = list(path)
    loop = section_loop(width / 2, clearance, shape)
    count = len(loop)
    vertices: list[tuple[float, float, float]] = []
    for index, point in enumerate(path):
        if index == 0:
            direction = unit(path[0], path[1])
            scale = 1.0
        elif index == len(path) - 1:
            direction = unit(path[-2], path[-1])
            scale = 1.0
        else:
            incoming = unit(path[index - 1], path[index])
            outgoing = unit(path[index], path[index + 1])
            bisector = (incoming[0] + outgoing[0], incoming[1] + outgoing[1])
            length = math.hypot(*bisector)
            direction = incoming if length < 1e-6 else (bisector[0] / length, bisector[1] / length)
            normal = (-direction[1], direction[0])
            scale = 1.0 / max(MITRE_LIMIT, normal[0] * -incoming[1] + normal[1] * incoming[0])
        nx, ny = -direction[1], direction[0]
        for lateral, height in loop:
            vertices.append((
                point[0] + nx * lateral * scale,
                point[1] + ny * lateral * scale,
                height,
            ))

    faces: list[tuple[int, ...]] = [
        tuple(reversed(range(count))),
        tuple(range(count * (len(path) - 1), count * len(path))),
    ]
    for ring in range(len(path) - 1):
        base, top = ring * count, (ring + 1) * count
        for index in range(count):
            nxt = (index + 1) % count
            faces.append((base + index, base + nxt, top + nxt, top + index))
    return void_mesh(name, vertices, faces)


def chamber_void(
    name: str,
    centre: tuple[float, float],
    radius: float,
    clearance: float,
    shape: str = "tube",
    segments: int = 28,
) -> bpy.types.Object:
    """The same section revolved: a domed chamber, or the joint at a bend."""
    profile = wall_profile(radius, clearance, shape)
    rings = profile[:-1]
    vertices: list[tuple[float, float, float]] = []
    for ring_radius, ring_height in rings:
        for index in range(segments):
            angle = math.tau * index / segments
            vertices.append((
                centre[0] + math.cos(angle) * ring_radius,
                centre[1] + math.sin(angle) * ring_radius,
                ring_height,
            ))
    apex = len(vertices)
    vertices.append((centre[0], centre[1], profile[-1][1]))
    faces: list[tuple[int, ...]] = [tuple(reversed(range(segments)))]
    for level in range(len(rings) - 1):
        base, top = level * segments, (level + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((base + index, base + nxt, top + nxt, top + index))
    crown_ring = (len(rings) - 1) * segments
    for index in range(segments):
        faces.append((crown_ring + index, crown_ring + (index + 1) % segments, apex))
    return void_mesh(name, vertices, faces)


carve_parts: list[bpy.types.Object] = []

# What each carved volume IS, as opposed to how it was tessellated: a
# centreline, a walked half width, a profile and a height. The needle pass
# reasons about these, because a wedge between two spaces is a property of
# their surfaces, not of the triangles that approximate them.
VOLUME_PLAN: list[dict] = []


def carve(obj: bpy.types.Object | None) -> None:
    if obj is not None:
        carve_parts.append(obj)


def note_volume(kind: str, name: str, points, half_width: float,
                clearance: float, shape: str = "tube") -> None:
    VOLUME_PLAN.append({"kind": kind, "id": name, "points": list(points),
                        "half_width": half_width, "clearance": clearance,
                        "shape": shape})


def lateral_at(volume: dict, z: float) -> float:
    """How far this volume reaches sideways at that height. 0 above its crown."""
    if z < 0 or z > volume["clearance"]:
        return 0.0
    profile = wall_profile(volume["half_width"], volume["clearance"], volume["shape"])
    for (near, low), (far, high) in zip(profile, profile[1:]):
        if low <= z <= high:
            span = high - low
            return near if span < 1e-9 else near + (far - near) * (z - low) / span
    return 0.0


def plan_distance(points, probe) -> float:
    if len(points) == 1:
        return math.dist(points[0], probe)
    best = math.inf
    for start, end in zip(points, points[1:]):
        ux, uy = end[0] - start[0], end[1] - start[1]
        length = ux * ux + uy * uy
        t = 0.0 if length < 1e-12 else max(0.0, min(1.0, (
            (probe[0] - start[0]) * ux + (probe[1] - start[1]) * uy) / length))
        best = min(best, math.dist((start[0] + ux * t, start[1] + uy * t), probe))
    return best


# The Water vestibule. The contract's threshold footprint is the room the
# visitor steps into out of Water: wider than the corridor and deliberately
# lower, so the corridor beyond it reads as a lift rather than a continuation.
# It swallows the two short path sections (steam threshold, ember bridge) that
# live inside it.
#
# It stops AT minX. An earlier version ran it 0.6m past, "to meet the door
# aperture" - which it already meets: the Water door bores from x-1.2 (inside
# the room) out through the block face, so the two overlap by 1.2m with the
# vestibule ending on the bound. All the overrun did was eat a third of the
# 1.8m shell margin, leaving the end wall beside the door at exactly 1.2m -
# the audit's own floor, landed on to the millimetre. A wall that passes or
# fails on rounding is a wall built by accident.
_threshold = CONTRACT["threshold"]["blenderFootprint"]
carve(swept_void(
    "CARVE_Vestibule",
    [
        (_threshold["centre"]["x"] - _threshold["sizeX"] / 2, _threshold["centre"]["y"]),
        (_threshold["centre"]["x"] + _threshold["sizeX"] / 2, _threshold["centre"]["y"]),
    ],
    _threshold["sizeY"],
    VESTIBULE_CLEARANCE,
    extend=0,
))
note_volume("run", "CARVE_Vestibule", SWEPT_PATHS["CARVE_Vestibule"],
            _threshold["sizeY"] / 2, VESTIBULE_CLEARANCE)

# An orbit lane is already inside its court chamber; sweeping it as corridor
# would only bulge the chamber wall out at the visitor's shoulder.
SWALLOWED_KINDS = {"shrine-orbit", "steam-threshold", "ember-bridge"}
SECTION_CLEARANCE = {"shrine-mouth": MOUTH_CLEARANCE}

for section in CONTRACT["pathSections"]:
    if section["kind"] in SWALLOWED_KINDS:
        continue
    clearance = SECTION_CLEARANCE.get(section["kind"], CORRIDOR_CLEARANCE)
    points = [(point["x"], point["y"]) for point in section["blenderPoints"]]
    carve(swept_void(f"CARVE_{section['id']}", points, section["width"], clearance))
    note_volume("run", section["id"], SWEPT_PATHS[f"CARVE_{section['id']}"],
                section["width"] / 2, clearance)
    # A joint at EVERY vertex, ends included - not only where the mitre gave up.
    #
    # Gate 2 was rejected on 2026-08-10 for a hole in the wall that no mesh
    # statistic could see: the shell was watertight, normals were consistent,
    # and an interior ray audit still found 133 places where the rock between
    # two spaces ran under 1.2m, the thinnest at 1mm. They were all within 3m of
    # a section end or a bend.
    #
    # The cause was corner rock, not missing rock. Two tubes crossing at an
    # angle close on the INSIDE of the turn, where their caps overlap, and leave
    # a tapering wedge on the OUTSIDE, where nothing carves. `extend` overlaps
    # the caps and so only ever fixed the inside. Every section boundary on this
    # route - mouth into orbit into mouth into transfer - is such a crossing,
    # and none of them was a bend inside a single section, so the old 35-degree
    # joint rule never fired for any of them.
    #
    # A joint is a revolution of the same profile at the same half width, so its
    # wall meets the tube's exactly: the union is a round-cornered passage, and
    # a wedge cannot survive at a vertex that has one. Sweeping every vertex
    # costs about 40 more operands on one exact boolean and removes the entire
    # failure class, which is worth more than the seconds.
    for index in range(len(points)):
        carve(chamber_void(
            f"CARVE_{section['id']}_joint{index:02d}",
            points[index],
            section["width"] / 2 + JOINT_PROUD,
            clearance + JOINT_PROUD,
            segments=20,
        ))

for shrine in CONTRACT["shrines"]:
    spec = COURT_SHELL[shrine["id"]]
    outline = next(
        candidate for candidate in CONTRACT["courts"]
        if candidate["shrineId"] == shrine["id"]
    )["blenderOutline"]
    centre = (shrine["blenderCentre"]["x"], shrine["blenderCentre"]["y"])
    radius = max(
        math.hypot(point["x"] - centre[0], point["y"] - centre[1])
        for point in outline
    )
    carve(chamber_void(
        f"CARVE_Court_{shrine['id']}",
        centre, radius, spec["clearance"], spec["shape"], segments=36,
    ))
    note_volume("court", f"Court_{shrine['id']}", [centre], radius,
                spec["clearance"], spec["shape"])

# --- Blunt the needles -------------------------------------------------------
#
# Where a corridor crosses a court's wall, the rock between them goes to nothing
# at the crossing. That is not a defect - it is what an OPENING IS, and every
# doorway in the room has the same edge. What is a defect is when the two
# surfaces cross at so shallow an angle that the rock stays paper thin for
# metres: the spur then tapers to a knife, and from inside the room a knife of
# rock with void either side reads as a tear in the wall. That is what Gate 2
# was rejected for on 2026-08-10.
#
# EVERY crossing is walked at every rung of its height, and every arc of thin
# rock found is cut off - not only the arcs longer than NEEDLE_LIMIT. The volume
# carved runs ALONG the arc from the crossing to where the spur has earned its
# thickness back, so what is left is a spur that ends bluntly instead of one
# that ends in a blade. Cutting across the spur instead would strand its tip as
# a floating shard.
#
# The length gate is gone because it was wrong twice. It let through a rock
# column ten centimetres square standing free between z 1.22 and 2.62 beside the
# dj court, and a hanging wall ending in a point at z 3.81 beside the ek court -
# both on arcs too short to qualify as blades, neither of them anything a
# visitor would read as an edge. This is the same lesson the joint chambers
# above already learned: stop deciding WHICH crossings deserve treatment and
# treat them all. A cut on a short arc takes a small wedge off the lip of an
# opening, which is what rock does anyway; a knife edge is what rock never does.
#
# The count of cuts is deliberately NOT written down here. An earlier version of
# this comment recorded that twenty-one of twenty-four crossings tapered out
# within 1.25-1.31m and named the three that did not, which read as a survey and
# was really a description of three samples. `needlesCut` in the manifest is the
# live count; a number in a comment is a number that was true once.
NEEDLE_LIMIT = 1.8      # a strip of thin rock longer than this is a blade
MIN_WALL = 1.2          # rock thinner than this is not reading as rock
NEEDLE_STEPS = 720      # resolution of the walk around a court wall
NEEDLE_OFFSET = 0.55    # push the cut outboard, into the spur
NEEDLE_WIDTH = 1.6      # wide enough to span the spur and the wall's own lean
NEEDLE_HEADROOM = 1.0   # and to reach above the corridor's crown
NEEDLE_RISE = 0.25      # one rung of the ladder up the crossing
NEEDLE_TOE = 0.2        # the first rung, just clear of the floor slab


def height_ladder(top: float) -> list[float]:
    """Every rung of a crossing, from the toe to the crown.

    This used to be the literal tuple (0.5, 1.6, 2.6), on the reasoning that
    the court wall leans outward as it rises and three samples follow it. They
    do not. BOTH surfaces draw in as they rise, at rates set by their own
    profiles, so a court and a corridor that overlap generously at knee height
    can part company near the crown - and where they last touch they leave a
    blade hanging with its point in mid-air.

    The first shipped graybox had one: a fin over the dj court, 3.5m long,
    tapering to 30mm, hanging between z 4.2 and 5.4 with a matching stub on
    the floor. Four metres from the visitor's eye. Nothing was ever sampled
    above 2.6m, so nothing saw it, and the audit called the shell sound
    because a hanging point is not a blade by any measure taken at the wall.

    A crossing is 5.5m tall. Walk all of it.
    """
    rungs = max(1, math.ceil((top - NEEDLE_TOE) / NEEDLE_RISE))
    return [NEEDLE_TOE + index * (top - NEEDLE_TOE) / rungs for index in range(rungs + 1)]


def needle_arcs(court: dict, run: dict, z: float) -> list[dict]:
    """Walk the court wall at this height; return any long needles as arcs.

    A corridor crosses a court wall twice and each crossing leaves rock on one
    side of it, so both directions are followed. An arc is returned as angular
    indices rather than as points, so that the same needle found on twenty
    rungs is recognised as one needle and cut once. Twenty near-coincident
    cuts would be twenty chances for the boolean to leave scrap.
    """
    court_reach, run_reach = lateral_at(court, z), lateral_at(run, z)
    if court_reach <= 0 or run_reach <= 0:
        return []
    centre = court["points"][0]
    gaps = []
    for index in range(NEEDLE_STEPS):
        angle = math.tau * index / NEEDLE_STEPS
        probe = (centre[0] + math.cos(angle) * court_reach,
                 centre[1] + math.sin(angle) * court_reach)
        gaps.append(plan_distance(run["points"], probe) - run_reach)
    if min(gaps) > 0 or max(gaps) <= 0:
        return []

    arc = math.tau * court_reach / NEEDLE_STEPS
    found = []
    for index in range(NEEDLE_STEPS):
        following = (index + 1) % NEEDLE_STEPS
        if gaps[index] <= 0 < gaps[following]:
            cursor, stride = following, 1
        elif gaps[following] <= 0 < gaps[index]:
            cursor, stride = index, -1
        else:
            continue
        length, indices = 0.0, []
        while gaps[cursor] < MIN_WALL and length < 12.0:
            indices.append(cursor)
            length += arc
            cursor = (cursor + stride) % NEEDLE_STEPS
        if len(indices) >= 2:
            found.append({"indices": indices, "reach": court_reach})
    return found


def fold_arc(needles: list[dict], arc: dict, z: float) -> None:
    """File this rung's arc under the needle it belongs to, merging any it joins."""
    indices = set(arc["indices"])
    touching = [needle for needle in needles if needle["indices"] & indices]
    for needle in touching:
        needles.remove(needle)
        indices |= needle["indices"]
    reaches = [arc["reach"]] + [r for n in touching for r in (n["near"], n["far"])]
    needles.append({
        "indices": indices,
        "near": min(reaches),
        "far": max(reaches),
        "bottom": min([z] + [n["bottom"] for n in touching]),
        "top": max([z] + [n["top"] for n in touching]),
    })


def arc_path(centre, indices: set[int], radius: float) -> list[tuple[float, float]]:
    """The cut's centreline: the arc walked in order, starting after its widest gap."""
    ordered = sorted(indices)
    seam = max(range(len(ordered)),
               key=lambda i: (ordered[i] - ordered[i - 1]) % NEEDLE_STEPS)
    return [(centre[0] + math.cos(math.tau * index / NEEDLE_STEPS) * radius,
             centre[1] + math.sin(math.tau * index / NEEDLE_STEPS) * radius)
            for index in ordered[seam:] + ordered[:seam]]


NEEDLES_CUT: list[dict] = []
for _court in [v for v in VOLUME_PLAN if v["kind"] == "court"]:
    for _run in [v for v in VOLUME_PLAN if v["kind"] == "run"]:
        _needles: list[dict] = []
        for _height in height_ladder(_run["clearance"]):
            for _arc in needle_arcs(_court, _run, _height):
                fold_arc(_needles, _arc, _height)
        for _index, _needle in enumerate(_needles):
            # The court's reach drifts as the ladder climbs, so one cut for the
            # whole needle is centred on the middle of that drift and widened by
            # it. Centring on the widest rung instead would leave the lowest
            # rung's needle standing outside the cut, which is the same bug in a
            # new place.
            _spread = _needle["far"] - _needle["near"]
            _radius = (_needle["near"] + _needle["far"]) / 2 + NEEDLE_OFFSET
            _path = arc_path(_court["points"][0], _needle["indices"], _radius)
            carve(swept_void(
                f"CARVE_Blunt_{_court['id']}_{_run['id']}_{_index}",
                _path, NEEDLE_WIDTH + _spread,
                max(_run["clearance"], _needle["top"]) + NEEDLE_HEADROOM, extend=0))
            NEEDLES_CUT.append({
                "court": _court["id"], "run": _run["id"],
                "heights": [round(_needle["bottom"], 2), round(_needle["top"], 2)],
                "at": [round(_path[0][0], 2), round(_path[0][1], 2)],
                "length": round(len(_needle["indices"]) * math.tau
                                * _needle["far"] / NEEDLE_STEPS, 2),
            })

# Doorways punch clean through the mass at the contract's clear width, so the
# seam to Water and to Earth is an opening in rock rather than a missing wall.
for side, door in CONTRACT["doors"].items():
    outward = -1 if door["side"] == "west" else 1
    carve(swept_void(
        f"CARVE_Door_{side}",
        [
            (door["blender"]["x"] - outward * 1.2, door["blender"]["y"]),
            (door["blender"]["x"] + outward * (SHELL_MARGIN + 0.8), door["blender"]["y"]),
        ],
        door["clearWidth"],
        DOOR_CLEARANCE,
        extend=0,
    ))

# One negative, one subtraction. Joining first keeps this to a single exact
# boolean instead of ~70 sequential ones; `use_self` is what lets the
# overlapping sweeps and chambers behave as their union.
# When the audit finds a blade, the useful question is never "where" - it is
# "between which two spaces", and after the join nothing in the result
# remembers. Answer it from the plan, by asking which volumes actually reach
# that point at that height.
#
# The first version of this ranked volumes by distance to their nearest VERTEX,
# which is not the same question and quietly gives the wrong answer: a court's
# dome is covered in vertices, so anything standing on a court wall reports the
# court as 0.4m away and looks like the culprit. It sent a whole session
# hunting corridor-against-court tangencies that the plan does not contain.
def volumes_around(point, count: int = 2) -> list[str]:
    height = point[2]
    ranked = sorted(
        (
            (plan_distance(volume["points"], (point[0], point[1]))
             - lateral_at(volume, height), volume["id"])
            for volume in VOLUME_PLAN
        ),
        key=lambda entry: entry[0],
    )
    return [f"{name} ({gap:+.2f}m)" for gap, name in ranked[:count]]


bpy.ops.object.select_all(action="DESELECT")
for part in carve_parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = carve_parts[0]
bpy.ops.object.join()
carve_void = bpy.context.view_layer.objects.active
carve_void.name = "CARVE_Void"
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")

shell_rock = add_box(
    "FF_Shell_Rock",
    (0, 0, (SHELL_ROOF - SHELL_FLOOR_DEPTH) / 2),
    (
        ROOM["width"] + SHELL_MARGIN * 2,
        ROOM["depth"] + SHELL_MARGIN * 2,
        SHELL_ROOF + SHELL_FLOOR_DEPTH,
    ),
    BASALT,
    COLLECTIONS["SHELL"],
)
carve_modifier = shell_rock.modifiers.new("Carve", "BOOLEAN")
carve_modifier.operation = "DIFFERENCE"
carve_modifier.solver = "EXACT"
carve_modifier.use_self = True
carve_modifier.use_hole_tolerant = True
carve_modifier.object = carve_void
bpy.context.view_layer.objects.active = shell_rock
bpy.ops.object.modifier_apply(modifier="Carve")
carve_faces = len(shell_rock.data.polygons)
if carve_faces <= 6:
    raise RuntimeError(
        f"The shell carve produced {carve_faces} faces: the boolean did not cut."
    )
bpy.data.objects.remove(carve_void, do_unlink=True)
bpy.data.collections.remove(CARVE_COLLECTION)

# An exact boolean leaves scrap behind: zero-area faces lying on top of real
# ones, 49 of them at the last count. The visitor never sees them, but they
# double every ray crossing they sit on, which is enough to make a measuring
# instrument report walls that are not there. Sweep them up at the source
# rather than teaching every downstream tool to ignore them.
SCRAP_WELD = 1e-4
bpy.context.view_layer.objects.active = shell_rock
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=SCRAP_WELD)
bpy.ops.mesh.dissolve_degenerate(threshold=SCRAP_WELD)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")

# The shell has to survive being looked at, not merely be closed. A watertight
# carve shipped a room with 133 sub-1.2m walls once; the audit walks the floor,
# fans rays from three eye heights and measures the rock behind every wall the
# visitor can see. The build fails rather than hand that on to a dressing pass.
_audit_spec = importlib.util.spec_from_file_location(
    "first_fire_shell_audit", ROOT / "scripts" / "audit-first-fire-shell.py"
)
_audit_module = importlib.util.module_from_spec(_audit_spec)
_audit_spec.loader.exec_module(_audit_module)
SHELL_AUDIT = _audit_module.audit_shell(
    shell_rock,
    CONTRACT,
    min_wall=1.2,
    # Coarser than the standalone sweep so it costs seconds inside a build. A
    # fin is metres long, so a 2m grid with a 36-ray fan still lands on it.
    #
    # The pitch fan is NOT trimmed, though. It used to be `(0.0,)` - horizontal
    # rays only - which meant this gate could not see a ceiling at all, and it
    # passed a shell with a blade hanging over the dj court. Coarse sampling of
    # the whole room is thrift; fine sampling of a third of it is a gate that
    # reports on the part it chose to look at.
    grid_step=2.0,
    ray_count=36,
)
for defect in (SHELL_AUDIT["thin_wall_defects"] + SHELL_AUDIT["thin_margin_defects"]
               + SHELL_AUDIT["splinters"]):
    defect["between"] = volumes_around(defect["at"])
if not SHELL_AUDIT["pass"]:
    lines = "\n".join(
        [
            f"  a blade {d['span']}m across and {d['thickness']}m thick at {d['at']},"
            f" between {' and '.join(d['between'])}"
            for d in SHELL_AUDIT["thin_wall_defects"][:10]
        ]
        + [
            f"  the block's own skin {d['thickness']}m from the room over"
            f" {d['span']}m at {d['at']}, behind {' and '.join(d['between'])}"
            for d in SHELL_AUDIT["thin_margin_defects"][:10]
        ]
        + [
            f"  a splinter of rock {d['thickness']}m thick standing in open air"
            f" at {d['at']} - only {d['bulk'] * 100:.0f}% of its surroundings is"
            f" rock - between {' and '.join(d['between'])}"
            for d in SHELL_AUDIT["splinters"][:10]
        ]
    )
    raise RuntimeError(
        "The carved shell failed its interior audit: "
        f"{SHELL_AUDIT['thin_wall_defect_count']} blades of rock wider than "
        f"{SHELL_AUDIT['needle_limit']}m and thinner than "
        f"{SHELL_AUDIT['min_wall']}m, "
        f"{SHELL_AUDIT['thin_margin_defect_count']} stretches where the room "
        f"comes within {SHELL_AUDIT['min_margin']}m of the outdoors, "
        f"{SHELL_AUDIT['splinter_count']} splinters standing in open air, "
        f"{SHELL_AUDIT['leak_count']} sightlines out "
        f"of the room.\n{lines}"
    )

water_door = CONTRACT["doors"]["water"]
add_box(
    "FF_Water_Threshold",
    (min_x + 1.2, water_door["blender"]["y"], 0.025),
    (2.4, water_door["clearWidth"], 0.05),
    WATER,
    COLLECTIONS["ROUTE"],
    bevel=0.12,
)

# Walk ribbon and the steam threshold. The S never returns anywhere, so this is
# a landing slab at the water door rather than a hub the visitor keeps crossing.
threshold = CONTRACT["threshold"]["blenderFootprint"]
add_box(
    "FF_Steam_Threshold",
    (threshold["centre"]["x"], threshold["centre"]["y"], 0.035),
    (threshold["sizeX"], threshold["sizeY"], 0.07),
    COURT,
    COLLECTIONS["COURTS"],
    bevel=0.14,
)
for section in CONTRACT["pathSections"]:
    green = section["kind"] == "growth-path"
    mat = GROWTH if green else ROUTE
    # Anything green is staged by the runtime and stays hidden until the fire is
    # out. The walking ribbon needs the same prefix as the guide, or the Earth
    # route is visible from the FL court and the reveal is spent early.
    prefix = "FF_Growth_Route" if green else "FF_Route"
    for index, (start, end) in enumerate(zip(section["blenderPoints"], section["blenderPoints"][1:])):
        add_segment(
            f"{prefix}_{section['id']}_{index + 1:02d}", start, end,
            section["width"], 0.075, 0.055, mat, COLLECTIONS["ROUTE"],
        )

# The contract's basalt masses no longer build geometry. They were the stacked
# shell's interior walls, and the carve now expresses the same volume as the
# rock the tunnel was cut out of: the corridor walls ARE the swept section's
# flanks, the court rims ARE the chamber walls, and the nine `fill-*` masses
# that existed only to occupy unwalked floor are simply rock that was never
# removed. Nothing here is discarded - the masses still own collision, which
# first-fire-graybox-colliders.ts derives from this same contract, and the
# carve's wall foot stands FLOOR_SHOULDER outboard of every collider face so
# the visitor stops before the rock rather than inside it.

# Court floors, orbit rings, ember trenches, and runtime performer pads.
for shrine in CONTRACT["shrines"]:
    court = next(candidate for candidate in CONTRACT["courts"] if candidate["shrineId"] == shrine["id"])
    add_polygon_prism(
        f"FF_Court_{shrine['id']}", court["blenderOutline"], 0.005, 0.055,
        COURT, COLLECTIONS["COURTS"],
    )
    add_ring(
        f"FF_Trench_{shrine['id']}", shrine["blenderCentre"],
        shrine["trenchInnerRadius"], shrine["trenchOuterRadius"], 0.075,
        TRENCH, COLLECTIONS["COURTS"],
    )
    add_ring(
        f"FF_Orbit_{shrine['id']}", shrine["blenderCentre"],
        shrine["orbitRadius"] - shrine["orbitWidth"] / 2,
        shrine["orbitRadius"] + shrine["orbitWidth"] / 2, 0.062,
        ROUTE, COLLECTIONS["ROUTE"],
        start_degrees=shrine["orbitStartDegrees"],
        sweep_degrees=shrine["orbitSweepDegrees"],
    )
    add_cylinder(
        f"FF_PerformerPad_{shrine['id']}",
        (shrine["blenderCentre"]["x"], shrine["blenderCentre"]["y"], 0.22),
        shrine["habitatRadius"], 0.44, PERFORMER, COLLECTIONS["PERFORMERS"], 20,
    )

# Non-colliding coal memory and final Earth growth cues.
for guide in CONTRACT["fireGuides"]:
    if guide["kind"] not in {"coal-memory", "green-growth"}:
        continue
    green = guide["kind"] == "green-growth"
    mat = GROWTH if green else COAL
    # The runtime stages anything named FF_Growth_ and reveals it only after the
    # blackout, so the green route must carry that prefix or it never appears.
    prefix = "FF_Growth" if green else "FF_Guide"
    for index, (start, end) in enumerate(zip(guide["blenderPoints"], guide["blenderPoints"][1:])):
        add_segment(
            f"{prefix}_{guide['id']}_{index + 1:02d}", start, end,
            guide["width"], 0.045, 0.09, mat, COLLECTIONS["FIRE_GUIDES"],
        )

# Organic multi-tongue guide flames, budgeted by the manifest: every stem sits
# on the walked lane or on one court perimeter, never scattered off-route.
flame_meshes = {category: flame_mesh(category) for category in FLAME_MATERIALS}
anchor_records: list[dict] = []


def add_torch_anchor(category: str, x: float, y: float, index: int) -> None:
    stem_height = RNG.uniform(0.72, 1.85)
    stem_radius = RNG.uniform(0.07, 0.115)
    add_cylinder(
        f"FF_TorchStem_{category}_{index:03d}",
        (x, y, stem_height / 2), stem_radius, stem_height,
        STEM, COLLECTIONS["FIRE_GUIDES"], 8,
    )
    flame = bpy.data.objects.new(
        f"FF_FlameGuide_{category}_{index:03d}", flame_meshes[category]
    )
    flame.location = (x, y, stem_height * 0.92)
    scale = RNG.uniform(0.72, 1.18)
    flame.scale = (scale, scale * RNG.uniform(0.86, 1.12), scale * RNG.uniform(0.9, 1.28))
    flame.rotation_euler.z = RNG.uniform(-math.pi, math.pi)
    COLLECTIONS["FIRE_GUIDES"].objects.link(flame)
    anchor_records.append({"category": category, "x": x, "y": y, "height": stem_height})


active_guides = [guide for guide in CONTRACT["fireGuides"] if guide["kind"] in {"torch-lane", "fire-wall"}]
guide_lengths = []
for guide in active_guides:
    length = sum(
        math.hypot(end["x"] - start["x"], end["y"] - start["y"])
        for start, end in zip(guide["blenderPoints"], guide["blenderPoints"][1:])
    )
    guide_lengths.append(length)
length_total = sum(guide_lengths)
LANE_STEMS = CONTRACT["torchBudget"]["laneStems"]
PERIMETER_STEMS = CONTRACT["torchBudget"]["perimeterStemsPerShrine"]
EXPECTED_ANCHORS = LANE_STEMS + PERIMETER_STEMS * len(CONTRACT["shrines"])
allocations = [max(2, round(LANE_STEMS * length / length_total)) for length in guide_lengths]
while sum(allocations) > LANE_STEMS:
    allocations[allocations.index(max(allocations))] -= 1
while sum(allocations) < LANE_STEMS:
    allocations[allocations.index(min(allocations))] += 1

field_index = 0
for guide, count in zip(active_guides, allocations):
    for x, y in sample_polyline(guide["blenderPoints"], count):
        field_index += 1
        lateral = RNG.uniform(-0.45, 0.45)
        add_torch_anchor("field", x, y + lateral, field_index)

def court_jamb_points(court: dict, count: int) -> list[tuple[float, float]]:
    """Stems for a partial-sweep court ride the carved wall, not a full ring the
    court has no room for. Inset from the authored outline toward its centroid."""
    outline = court["blenderOutline"]
    centroid_x = sum(point["x"] for point in outline) / len(outline)
    centroid_y = sum(point["y"] for point in outline) / len(outline)
    inset: list[dict] = []
    for point in outline:
        dx, dy = centroid_x - point["x"], centroid_y - point["y"]
        length = math.hypot(dx, dy) or 1.0
        inset.append({
            "x": point["x"] + dx / length * 0.6,
            "y": point["y"] + dy / length * 0.6,
        })
    return sample_polyline(inset + [inset[0]], count)


perimeter_index = {shrine["id"]: 0 for shrine in CONTRACT["shrines"]}
for shrine in CONTRACT["shrines"]:
    category = shrine["id"]
    count = PERIMETER_STEMS
    radius = shrine["trenchOuterRadius"] + 0.38
    if abs(shrine["orbitSweepDegrees"]) >= 359.999:
        placements = [
            (
                shrine["blenderCentre"]["x"] + math.cos(math.tau * index / count) * radius,
                shrine["blenderCentre"]["y"] + math.sin(math.tau * index / count) * radius,
            )
            for index in range(count)
        ]
    else:
        court = next(
            candidate for candidate in CONTRACT["courts"]
            if candidate["shrineId"] == shrine["id"]
        )
        placements = court_jamb_points(court, count)
    for x, y in placements:
        perimeter_index[category] += 1
        add_torch_anchor(category, x, y, perimeter_index[category])

if len(anchor_records) != EXPECTED_ANCHORS:
    raise RuntimeError(
        f"Expected {EXPECTED_ANCHORS} flame anchors, built {len(anchor_records)}"
    )

# QA lighting and cameras are excluded from the FF_ export.
scene.world = bpy.data.worlds.new("FF_CinderCourt_World")
scene.world.color = (0.002, 0.001, 0.001)


def add_light(
    name: str,
    location: tuple[float, float, float],
    color: tuple[float, float, float],
    energy: float,
    radius: float,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.color = color
    data.energy = energy
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    COLLECTIONS["QA_ONLY"].objects.link(obj)
    return obj


add_light("QA_WaterLight", (min_x + 2, 0, 2.5), (0.12, 0.58, 0.8), 820, 2.2)
red_lights: list[bpy.types.Object] = []
for index, shrine in enumerate(CONTRACT["shrines"]):
    red_lights.append(add_light(
        f"QA_Fire_{shrine['id']}",
        (shrine["blenderCentre"]["x"], shrine["blenderCentre"]["y"], 2.1),
        (1, 0.12 + index * 0.04, 0.015), 1350, 2.5,
    ))
# On the growth path's last leg, not at the room's east edge. The room is a
# carved tunnel now, so a light placed off the centreline sits inside solid
# rock and lights nothing.
earth_light = add_light("QA_EarthLight", (27.75, -10, 2.4), (0.18, 0.9, 0.14), 980, 2.7)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


cameras: dict[str, bpy.types.Object] = {}
for camera_spec in CONTRACT["cameras"]:
    data = bpy.data.cameras.new(camera_spec["name"])
    camera = bpy.data.objects.new(camera_spec["name"], data)
    camera.location = (
        camera_spec["position"]["x"],
        camera_spec["position"]["y"],
        camera_spec["position"]["z"],
    )
    data.clip_start = 0.05
    data.clip_end = 250
    if camera_spec["id"] == "plan":
        # A real section cut, not a cutaway. The near plane slices the room at
        # 2.2m so the top-down view shows the carved walls as solid rock with
        # the tunnel as the void between them. Hiding the shell instead - which
        # is what this did while the shell was a slab with no ceiling - draws a
        # plan of the route ribbons and says nothing about the room.
        data.clip_start = camera_spec["position"]["z"] - 2.2
    if camera_spec["type"] == "orthographic":
        data.type = "ORTHO"
        data.ortho_scale = camera_spec["orthographicScale"]
    else:
        horizontal_fov = math.radians(camera_spec["horizontalFovDegrees"])
        data.sensor_width = 36
        data.lens = data.sensor_width / (2 * math.tan(horizontal_fov / 2))
    look_at(camera, Vector((
        camera_spec["target"]["x"],
        camera_spec["target"]["y"],
        camera_spec["target"]["z"],
    )))
    COLLECTIONS["CAMERAS"].objects.link(camera)
    cameras[camera_spec["id"]] = camera

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = False
scene.render.image_settings.color_depth = "8"
scene.view_settings.look = "AgX - Medium High Contrast"


def world_bounds(objects: list[bpy.types.Object]) -> dict[str, float]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return {
        "minX": min(point.x for point in points),
        "maxX": max(point.x for point in points),
        "minY": min(point.y for point in points),
        "maxY": max(point.y for point in points),
        "minZ": min(point.z for point in points),
        "maxZ": max(point.z for point in points),
    }


export_meshes = [obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith("FF_")]
if any(obj.type in {"LIGHT", "CAMERA"} for obj in export_meshes):
    raise RuntimeError("QA light or camera leaked into the FF_ export set")

growth_objects = [obj for obj in export_meshes if "Earth" in obj.name or "earth" in obj.name]
red_objects = [
    obj for obj in export_meshes
    if obj.name.startswith("FF_FlameGuide_")
    or obj.name.startswith("FF_Trench_")
    or "Coal" in obj.name
]
# The overview looks at the room from outside it, and a carved room has a roof,
# so it is a cutaway. The plan keeps the rock and cuts through it instead; every
# eye-height camera stands inside the tunnel and keeps it too.
CUTAWAY_CAMERAS = {"overview"}

render_paths: dict[str, str] = {}
for camera_id, camera in cameras.items():
    show_red = camera_id not in {"blackout", "earth-reveal"}
    show_growth = camera_id in {"plan", "earth-reveal"}
    shell_rock.hide_render = camera_id in CUTAWAY_CAMERAS
    for obj in red_objects:
        obj.hide_render = not show_red
    for obj in growth_objects:
        obj.hide_render = not show_growth
    for light in red_lights:
        light.hide_render = not show_red
    earth_light.hide_render = not show_growth
    scene.camera = camera
    path = QA_DIR / f"first-fire-cinder-court-{camera_id}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    render_paths[camera_id] = str(path)

for obj in export_meshes:
    obj.hide_render = False
for light in red_lights:
    light.hide_render = False
earth_light.hide_render = False
scene.camera = cameras["overview"]
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

# The web GLB carries only FF_ geometry; QA cameras and lights stay in Blender.
RAW_GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
for obj in export_meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = export_meshes[0]
bpy.ops.export_scene.gltf(
    filepath=str(RAW_GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_apply=True,
)

report = {
    "sceneId": "first-fire-cinder-court",
    "schemaVersion": CONTRACT["schemaVersion"],
    "sourceDigest": SOURCE_DIGEST,
    "manifestPath": str(MANIFEST_PATH),
    "blendPath": str(BLEND_PATH),
    "rawGlbPath": str(RAW_GLB_PATH.relative_to(ROOT)).replace("\\", "/"),
    "blenderVersion": bpy.app.version_string,
    "exportPrefix": "FF_",
    "exportMeshCount": len(export_meshes),
    "materialCount": len(bpy.data.materials),
    "roomFootprint": {
        "width": ROOM["width"],
        "depth": ROOM["depth"],
        "blenderBounds": BOUNDS,
    },
    "shell": {
        "model": "carved",
        "object": shell_rock.name,
        "carveOperands": len(carve_parts),
        "carvedFaces": carve_faces,
        "cleanedFaces": len(shell_rock.data.polygons),
        "needlesCut": NEEDLES_CUT,
        "interiorAudit": SHELL_AUDIT,
        "corridorClearance": CORRIDOR_CLEARANCE,
        "mouthClearance": MOUTH_CLEARANCE,
        "floorShoulder": FLOOR_SHOULDER,
        "courtSections": {
            shrine_id: dict(spec) for shrine_id, spec in COURT_SHELL.items()
        },
    },
    "counts": {
        "basaltMasses": len(CONTRACT["basalt"]),
        "basaltMassesBuiltAsGeometry": 0,
        "courts": len(CONTRACT["courts"]),
        "pathSections": len(CONTRACT["pathSections"]),
        "laneFlames": CONTRACT["torchBudget"]["laneStems"],
        "perimeterFlames": CONTRACT["torchBudget"]["perimeterStemsPerShrine"] * len(CONTRACT["shrines"]),
        "totalFlameAnchors": len(anchor_records),
        "maximumDetailedShrines": CONTRACT["torchBudget"]["maximumDetailedShrines"],
    },
    "flameCategories": {
        category: sum(1 for anchor in anchor_records if anchor["category"] == category)
        for category in FLAME_MATERIALS
    },
    "exportObjectBounds": world_bounds(export_meshes),
    "collections": list(CONTRACT["collections"]),
    "renders": render_paths,
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

print(f"Verified Cinder Court source digest: {SOURCE_DIGEST}")
print(f"Built {len(anchor_records)} organic flame guides; no cone guides used")
print(f"Saved editable graybox: {BLEND_PATH}")
print(f"Wrote QA report: {REPORT_PATH}")
for camera_id, path in render_paths.items():
    print(f"Rendered {camera_id:>14}: {path}")
