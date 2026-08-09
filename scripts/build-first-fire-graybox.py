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


BASALT = material("FF Basalt", (0.055, 0.043, 0.039, 1), roughness=0.96)
BASALT_EDGE = material(
    "FF Fractured Basalt", (0.13, 0.095, 0.073, 1), roughness=0.93
)
FLOOR = material("FF Cinder Floor", (0.105, 0.065, 0.048, 1), roughness=0.97)
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


# Shell and transition thresholds.
min_x, max_x = BOUNDS["minX"], BOUNDS["maxX"]
min_y, max_y = BOUNDS["minY"], BOUNDS["maxY"]
wall_height = 8.5
wall_thickness = 0.8
add_box("FF_Shell_Floor", (0, 0, -0.22), (ROOM["width"], ROOM["depth"], 0.44), FLOOR, COLLECTIONS["SHELL"])
add_box("FF_Shell_North", (0, max_y + wall_thickness / 2, wall_height / 2), (ROOM["width"] + wall_thickness * 2, wall_thickness, wall_height), BASALT, COLLECTIONS["SHELL"])
add_box("FF_Shell_South", (0, min_y - wall_thickness / 2, wall_height / 2), (ROOM["width"] + wall_thickness * 2, wall_thickness, wall_height), BASALT, COLLECTIONS["SHELL"])


def add_split_side(side: str, door: dict) -> None:
    x = min_x - wall_thickness / 2 if side == "water" else max_x + wall_thickness / 2
    door_y = door["blender"]["y"]
    half = door["clearWidth"] / 2
    lower_end, upper_start = door_y - half, door_y + half
    for suffix, start, end in (("Lower", min_y, lower_end), ("Upper", upper_start, max_y)):
        if end <= start:
            continue
        add_box(
            f"FF_Shell_{side.title()}_{suffix}",
            (x, (start + end) / 2, wall_height / 2),
            (wall_thickness, end - start, wall_height),
            BASALT,
            COLLECTIONS["SHELL"],
        )


add_split_side("water", CONTRACT["doors"]["water"])
add_split_side("earth", CONTRACT["doors"]["earth"])
water_door = CONTRACT["doors"]["water"]
add_box(
    "FF_Water_Threshold",
    (min_x + 1.2, water_door["blender"]["y"], 0.025),
    (2.4, water_door["clearWidth"], 0.05),
    WATER,
    COLLECTIONS["ROUTE"],
    bevel=0.12,
)

# Walk ribbon and returning hub. The hub is a circular chamber, so its floor is
# a disc rather than a slab that would square off the ring of basalt arcs.
hub = CONTRACT["hub"]["blenderFootprint"]
add_cylinder(
    "FF_Hub_ReturningCourt",
    (hub["centre"]["x"], hub["centre"]["y"], 0.035),
    min(hub["sizeX"], hub["sizeY"]) / 2,
    0.07,
    COURT,
    COLLECTIONS["COURTS"],
    48,
)
for section in CONTRACT["pathSections"]:
    mat = GROWTH if section["kind"] == "growth-path" else ROUTE
    for index, (start, end) in enumerate(zip(section["blenderPoints"], section["blenderPoints"][1:])):
        add_segment(
            f"FF_Route_{section['id']}_{index + 1:02d}", start, end,
            section["width"], 0.075, 0.055, mat, COLLECTIONS["ROUTE"],
        )

# Permanent basalt is the only interior collision owner. Court-defining masses
# carry their authored height exactly — that is what makes the DJ canyon slot,
# the low EK bowl rim, and the FL chimney shaft read as three different rooms.
# Only the generic corridor and fill rock gets a silhouette jitter.
for index, mass in enumerate(CONTRACT["basalt"]):
    court_defining = "court" in mass["id"]
    height = mass["minimumHeight"] + (0 if court_defining else (index % 4) * 0.48)
    obj = add_polygon_prism(
        f"FF_Basalt_{mass['id']}", mass["blenderPolygon"], 0, height,
        BASALT if index % 2 == 0 else BASALT_EDGE, COLLECTIONS["BASALT"],
    )
    obj.rotation_euler.z = ((index % 3) - 1) * 0.008

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
    mat = GROWTH if guide["kind"] == "green-growth" else COAL
    for index, (start, end) in enumerate(zip(guide["blenderPoints"], guide["blenderPoints"][1:])):
        add_segment(
            f"FF_Guide_{guide['id']}_{index + 1:02d}", start, end,
            guide["width"], 0.045, 0.09, mat, COLLECTIONS["FIRE_GUIDES"],
        )

# Exactly 126 organic multi-tongue guide flames: 72 field + 18 per court.
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


active_guides = [guide for guide in CONTRACT["fireGuides"] if guide["kind"] in {"torch-field", "fire-wall"}]
guide_lengths = []
for guide in active_guides:
    length = sum(
        math.hypot(end["x"] - start["x"], end["y"] - start["y"])
        for start, end in zip(guide["blenderPoints"], guide["blenderPoints"][1:])
    )
    guide_lengths.append(length)
length_total = sum(guide_lengths)
allocations = [max(3, round(72 * length / length_total)) for length in guide_lengths]
while sum(allocations) > 72:
    allocations[allocations.index(max(allocations))] -= 1
while sum(allocations) < 72:
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
    count = CONTRACT["torchBudget"]["perimeterStemsPerShrine"]
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

if len(anchor_records) != 126:
    raise RuntimeError(f"Expected 126 flame anchors, built {len(anchor_records)}")

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
earth_light = add_light("QA_EarthLight", (max_x - 4, -12, 2.4), (0.18, 0.9, 0.14), 980, 2.7)


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
render_paths: dict[str, str] = {}
for camera_id, camera in cameras.items():
    show_red = camera_id not in {"blackout", "earth-reveal"}
    show_growth = camera_id in {"plan", "earth-reveal"}
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
    "counts": {
        "basaltMasses": len(CONTRACT["basalt"]),
        "courts": len(CONTRACT["courts"]),
        "pathSections": len(CONTRACT["pathSections"]),
        "fieldFlames": CONTRACT["torchBudget"]["fieldStems"],
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
