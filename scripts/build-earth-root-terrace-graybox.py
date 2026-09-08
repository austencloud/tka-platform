"""Build the Earth Root Terrace graybox in Blender: one carved shell.

The measured layout authority is buildEarthRootTerraceLayout (TypeScript);
scripts/export-earth-root-terrace-blender-plan.ts serialises the compiled room
to a hash-stamped JSON contract. This script verifies that digest, carves every
space the visitor occupies out of one block of rock, stands the brass rail, the
letters and the root growth in it, lights it for review, renders the QA views,
saves an editable .blend and exports the raw ET_ geometry.

Run from the repository root:

  pnpm exec tsx scripts/export-earth-root-terrace-blender-plan.ts
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background --factory-startup ^
    --python scripts/build-earth-root-terrace-graybox.py

Outputs:
  blender/earth-root-terrace-graybox.blend
  blender/exports/earth-root-terrace-graybox.raw.glb
  blender/qa/earth-root-terrace-graybox/*.png
  docs/superpowers/specs/earth-root-terrace/earth-root-terrace-graybox-report.json

The room in one paragraph (Blender frame: x east, y north, z up, metres, the
origin at the compiled room's plan centre): a mossy vestibule inside the west
door; a ramp climbing east along the north wall onto a railed terrace 2.8 m up;
the rootbed sunk 2.4 m below the datum under a dome and an aven, where G, H
and I stand in one row facing the rail; the descent down the east wall to a
landing on the row's axis, then on down past a cleft to the south door.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "docs" / "superpowers" / "specs" / "earth-root-terrace"
MANIFEST_PATH = SPEC_DIR / "earth-root-terrace-blender-plan.json"
FIRE_MANIFEST_PATH = (
    ROOT / "docs" / "superpowers" / "specs" / "first-fire-cinder-court"
    / "first-fire-cinder-court-blender-plan.json"
)
BLEND_PATH = ROOT / "blender" / "earth-root-terrace-graybox.blend"
RAW_GLB_PATH = ROOT / "blender" / "exports" / "earth-root-terrace-graybox.raw.glb"
QA_DIR = ROOT / "blender" / "qa" / "earth-root-terrace-graybox"
REPORT_PATH = SPEC_DIR / "earth-root-terrace-graybox-report.json"
RNG = random.Random(0xEA47)

_shell_spec = importlib.util.spec_from_file_location(
    "cave_shell", ROOT / "scripts" / "blender" / "cave_shell.py"
)
cave_shell = importlib.util.module_from_spec(_shell_spec)
_shell_spec.loader.exec_module(cave_shell)


def load_contract() -> tuple[dict, str]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    contract = manifest["contract"]
    canonical = json.dumps(
        contract, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if digest != manifest["sourceDigest"]:
        raise RuntimeError(
            "Earth Root Terrace Blender manifest digest mismatch. "
            "Regenerate it from the TypeScript layout before building."
        )
    return contract, digest


CONTRACT, SOURCE_DIGEST = load_contract()
if CONTRACT["coordinateSystem"]["gltfRuntime"]["integrationStatus"] != "compiled-cave-earth-room":
    raise RuntimeError("The shell must be built from the compiled cave-earth contract")

# Everything below carves the room the 2026-09 regrade replaced: one ramp onto
# a terrace 2.8 m up, then descent-a / landing / descent-b down the east wall.
# The layout now emits an overlook spur, a catwalk gallery with three alcoves,
# and four disjoint rail runs instead of one folded line, so this script cannot
# simply be re-pointed - the vault carving, the rail legs, the root placement
# and the QA cameras all have to be re-authored against the new decks. Fail
# here, naming that, rather than partway through on a KeyError.
BUILT_FOR_FLOORS = {"ramp", "terrace", "descent-a", "descent-b"}
_missing = sorted(BUILT_FOR_FLOORS - {floor["id"] for floor in CONTRACT["floors"]})
if _missing:
    raise RuntimeError(
        "This graybox script was written for the pre-regrade Root Terrace and "
        f"the contract no longer carries {_missing}. Re-author the carve against "
        "the current floors "
        f"({sorted(floor['id'] for floor in CONTRACT['floors'])}) "
        "and the contract's rails[] before rebuilding (scene gate 2)."
    )

DATUM = CONTRACT["datums"]
ROOM = CONTRACT["room"]
BOUNDS = ROOM["blenderBounds"]
FLOORS = {floor["id"]: floor for floor in CONTRACT["floors"]}
BED = CONTRACT["bed"]
CLEFT = CONTRACT["cleft"]
AVEN = CONTRACT["aven"]
DOORS = CONTRACT["doors"]
STATIONS = CONTRACT["stations"]
RAIL = CONTRACT["rail"]

DOOR_Y = DATUM["door"]
TERRACE_Y = DATUM["terrace"]
LANDING_Y = DATUM["landing"]
BED_Y = DATUM["bed"]
CLEFT_Y = DATUM["cleft"]
BED_CROWN = DATUM["bedCrown"]
TERRACE_CROWN = DATUM["terraceCrown"]
VESTIBULE_CROWN = DATUM["vestibuleCrown"]
AVEN_TOP = DATUM["avenTop"]
RAIL_H = DATUM["railHeight"]

# The First Fire's block reaches 1.8 m past its own east wall — straight into
# the corridor that runs south along that wall to its door. Earth's rock
# starts where Fire's ends, so the two shells never occupy the same metre;
# the corridor's west 0.8 m is Fire's to carve (build-first-fire-production).
FIRE_SHELL_MARGIN = 1.8
_fire = json.loads(FIRE_MANIFEST_PATH.read_text(encoding="utf-8"))["contract"]
FIRE_BLOCK_EAST_X = (
    _fire["room"]["planCentre"]["x"] + _fire["room"]["blenderBounds"]["maxX"]
    + FIRE_SHELL_MARGIN - ROOM["planCentre"]["x"]
)
corridor_rects = CONTRACT["approachCorridor"]["blenderRects"]
CORRIDOR_MIN_X = min(r["centre"]["x"] - r["sizeX"] / 2 for r in corridor_rects)
CORRIDOR_MAX_X = max(r["centre"]["x"] + r["sizeX"] / 2 for r in corridor_rects)
CORRIDOR_MIN_Y = min(r["centre"]["y"] - r["sizeY"] / 2 for r in corridor_rects)
if not CORRIDOR_MIN_X < FIRE_BLOCK_EAST_X < CORRIDOR_MAX_X:
    raise RuntimeError(
        f"Fire's block face x={FIRE_BLOCK_EAST_X:.2f} is not inside the corridor "
        f"({CORRIDOR_MIN_X}..{CORRIDOR_MAX_X}); the two shells no longer meet there"
    )

for path in (BLEND_PATH.parent, RAW_GLB_PATH.parent, QA_DIR, REPORT_PATH.parent):
    path.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = CONTRACT["sceneName"]
scene["earth_root_terrace_contract_schema"] = CONTRACT["schemaVersion"]
scene["earth_root_terrace_source_digest"] = SOURCE_DIGEST
scene["earth_root_terrace_source_modules"] = json.dumps(CONTRACT["sourceModules"])
scene["earth_root_terrace_stations"] = json.dumps(STATIONS)


def create_collection(name, parent=None):
    result = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(result)
    return result


export_root = create_collection("EXPORT_EarthRootTerrace")
COLLECTIONS = {
    name: create_collection(name, export_root) for name in ("SHELL", "FURNITURE", "GROWTH")
}
for name in ("LOCATORS", "CAMERAS", "QA_ONLY"):
    COLLECTIONS[name] = create_collection(name)
if set(CONTRACT["collections"]) != set(COLLECTIONS):
    raise RuntimeError("Blender collection contract is incomplete")


def move_to_collection(obj, target):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def material(name, color, roughness=0.85, metallic=0.0, emission=None, emission_strength=0.0):
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


ROCK = material("ET Rock", (0.16, 0.14, 0.11, 1.0), roughness=0.95)
# Brass at metallic 0: the museum has no environment map, and a metal with
# nothing to reflect renders as a flat cutout. The production bake gives the
# rail its highlights from the baked light instead.
BRASS = material("ET Brass", (0.62, 0.46, 0.22, 1.0), roughness=0.35)
LAMP = material(
    "ET Lamp", (1.0, 0.72, 0.4, 1.0), roughness=0.4,
    emission=(1.0, 0.7, 0.36, 1.0), emission_strength=5.0,
)
GROWTH = material(
    "ET Growth", (0.18, 0.52, 0.16, 1.0), roughness=0.8,
    emission=(0.22, 0.9, 0.26, 1.0), emission_strength=1.4,
)
SKY = material(
    "ET Sky", (0.78, 0.87, 1.0, 1.0), roughness=0.6,
    emission=(0.8, 0.9, 1.0, 1.0), emission_strength=6.0,
)
ROOT_MAT = material("ET Root", (0.2, 0.13, 0.08, 1.0), roughness=0.9)
STAMP = material("ET Cut Stone", (0.72, 0.66, 0.56, 1.0), roughness=0.7)
LOCATOR = material("Performer Locator", (0.82, 0.86, 0.82, 1.0), roughness=0.6)


def assign(obj, mat):
    if obj.type == "MESH":
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def add_box(name, location, dimensions, mat, target, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return move_to_collection(obj, target)


def add_cylinder(name, location, radius, depth, mat, target, vertices=24, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, mat)
    return move_to_collection(obj, target)


def add_curve_mesh(name, points, radius, mat, target, radii=None, resolution=3):
    """A bevelled bezier converted to a mesh; per-point radii taper it."""
    curve_data = bpy.data.curves.new(f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = resolution
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, (bezier, point) in enumerate(zip(spline.bezier_points, points)):
        bezier.co = point
        bezier.handle_left_type = "AUTO"
        bezier.handle_right_type = "AUTO"
        if radii:
            bezier.radius = radii[index]
    obj = bpy.data.objects.new(name, curve_data)
    target.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    obj.name = name
    assign(obj, mat)
    return obj


def add_text_mesh(name, text, location, rotation, scale, mat, target):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.extrude = 0.055
    obj.data.bevel_depth = 0.018
    obj.scale = (scale, scale, scale)
    move_to_collection(obj, target)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    obj.name = name
    assign(obj, mat)
    return obj


# ── The block ───────────────────────────────────────────────────────────────
# One block of rock around the interior and the corridor, the way the Drowned
# Gallery's and the First Fire's are. Every space is cut from it below, so
# floor, wall and vault come out as one continuous surface.
SHELL_MARGIN = 3.5
SHELL_FLOOR = CLEFT_Y - 2.0
SHELL_ROOF = AVEN_TOP + 2.5
CORRIDOR_CROWN = CONTRACT["approachCorridor"]["clearance"]

block_box = {
    "minX": FIRE_BLOCK_EAST_X,
    "maxX": BOUNDS["maxX"] + SHELL_MARGIN,
    "minY": BOUNDS["minY"] - SHELL_MARGIN,
    "maxY": BOUNDS["maxY"] + SHELL_MARGIN,
}
wing_box = {
    "minX": FIRE_BLOCK_EAST_X,
    "maxX": CORRIDOR_MAX_X + SHELL_MARGIN,
    "minY": CORRIDOR_MIN_Y - SHELL_MARGIN,
    "maxY": block_box["minY"] + 0.1,
}


def box_object(name, box, z0, z1, target):
    return add_box(
        name,
        ((box["minX"] + box["maxX"]) / 2, (box["minY"] + box["maxY"]) / 2, (z0 + z1) / 2),
        (box["maxX"] - box["minX"], box["maxY"] - box["minY"], z1 - z0),
        ROCK, target,
    )


shell_rock = box_object("ET_Shell_Rock", block_box, SHELL_FLOOR, SHELL_ROOF, COLLECTIONS["SHELL"])
shell_wing = box_object("ET_Shell_Wing", wing_box, SHELL_FLOOR, CORRIDOR_CROWN + 2.6, COLLECTIONS["SHELL"])
union = shell_rock.modifiers.new("Wing", "BOOLEAN")
union.operation = "UNION"
union.solver = "EXACT"
union.object = shell_wing
bpy.context.view_layer.objects.active = shell_rock
bpy.ops.object.modifier_apply(modifier="Wing")
bpy.data.objects.remove(shell_wing, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ── The voids ───────────────────────────────────────────────────────────────
carver = cave_shell.Carver("ET_CARVE_Negative", scene)
EXPAND = 0.22


def floor_box(floor_id):
    box = FLOORS[floor_id]["box"]
    return box["minX"], box["minY"], box["maxX"], box["maxY"]


def clamp01(value):
    return min(1.0, max(0.0, value))


def carve_vault(name, box, floor, crown, shape, corner_radius, expand=EXPAND, relief=0.14, segments=5):
    return carver.vault(
        f"ET_Void_{name}", box, floor, crown, shape=shape,
        corner_radius=corner_radius, expand=expand, corner_segments=segments,
        relief=relief, seed=len(carver.parts) * 1.31,
    )


# 1. The vestibule: a low dome inside the west door, the stamp on its east wall.
vx0, vy0, vx1, vy1 = floor_box("vestibule")
carve_vault("Vestibule", (vx0, vy0, vx1, vy1), DOOR_Y, VESTIBULE_CROWN, "dome", 1.6)

# 2. The ramp and the terrace: one barrel vault along the north wall, its
# floor climbing over the ramp's run and flat along the terrace.
rx0, ry0, rx1, ry1 = floor_box("ramp")
tx0, ty0, tx1, ty1 = floor_box("terrace")
RAMP_FROM, RAMP_TO = FLOORS["ramp"]["fromZ"], FLOORS["ramp"]["toZ"]


def north_floor(x, _y):
    return RAMP_FROM + (RAMP_TO - RAMP_FROM) * clamp01((x - rx0) / (rx1 - rx0))


carve_vault(
    "NorthRun", (min(rx0, tx0), min(ry0, ty0), max(rx1, tx1), max(ry1, ty1)),
    north_floor, TERRACE_CROWN, "tube", 1.1,
)

# 3. The east route: terrace corner → descent A → landing → descent B → door
# approach, one vault whose floor steps down by y and whose crown sits a
# metre lower than the terrace's, so the way out compresses.
EAST_CROWN = TERRACE_CROWN - 1.0
east_floors = [FLOORS[i] for i in ("descent-a", "landing", "descent-b", "door-approach")]
ex0 = min(f["box"]["minX"] for f in east_floors)
ex1 = max(f["box"]["maxX"] for f in east_floors)
ey0 = min(f["box"]["minY"] for f in east_floors)
ey1 = max(f["box"]["maxY"] for f in east_floors)


def east_floor(_x, y):
    for floor in east_floors:
        box = floor["box"]
        if box["minY"] - 1e-6 <= y <= box["maxY"] + 1e-6:
            if floor["kind"] == "flat":
                return floor["fromZ"]
            fraction = clamp01((y - box["minY"]) / (box["maxY"] - box["minY"]))
            return floor["fromZ"] + (floor["toZ"] - floor["fromZ"]) * fraction
    return DOOR_Y if y < ey0 else TERRACE_Y


carve_vault("EastRoute", (ex0, ey0, ex1, ey1), east_floor, EAST_CROWN, "tube", 1.1)

# 4. The rootbed: a pit with vertical walls from the bed to well above the
# terrace, so the walked edge the plan promises is exactly where the rock
# ends, then a domed cap over it. The pit's east face reaches past the
# descent's expanded footprint so no fin of rock stands between the landing
# and the row it looks at; the rail line stays where the contract put it.
PIT_TOP = BED_CROWN - 2.7
pit_box = (BED["minX"], BED["minY"], ex0 - EXPAND + 0.12, BED["maxY"])
carver.prism(
    "ET_Void_Bed", pit_box, [(0.0, BED_Y), (0.0, PIT_TOP)],
    corner_radius=2.6, corner_segments=7, relief=0.0,
)
bed_limit = min(pit_box[2] - pit_box[0], pit_box[3] - pit_box[1]) / 2
carver.prism(
    "ET_Void_BedCap", pit_box,
    [(0.0, PIT_TOP - 0.2), (bed_limit * 0.5, BED_CROWN - 1.0), (bed_limit * 0.85, BED_CROWN)],
    corner_radius=2.6, corner_segments=7, relief=0.22, seed=2.0,
)

# 5. The aven over H: a shaft that narrows toward a closed top, where the
# sky disc hangs. It is not open to the outside — the museum has no sky —
# so what the bed is lit by is the disc, and in production the spot behind it.
AVEN_R = AVEN["radius"]
aven_box = (
    AVEN["centre"]["x"] - AVEN_R, AVEN["centre"]["y"] - AVEN_R,
    AVEN["centre"]["x"] + AVEN_R, AVEN["centre"]["y"] + AVEN_R,
)
carver.prism(
    "ET_Void_Aven", aven_box,
    [(0.0, AVEN["base"]), (0.0, AVEN["base"] + 5.9), (0.9, AVEN_TOP - 1.8), (1.65, AVEN_TOP - 0.1)],
    corner_radius=AVEN_R, corner_segments=7, relief=0.12, seed=4.0,
)
SKY_Z = AVEN_TOP - 0.4
SKY_R = 1.5

# 6. The cleft at the bed's south-east corner: a slot dropping below the bed
# beside the door approach, so the floor falls away on the way out.
carve_vault(
    "Cleft", (CLEFT["minX"], CLEFT["minY"] - 0.2, pit_box[2], CLEFT["maxY"]),
    CLEFT_Y, 3.0, "slot", 0.8, expand=0.0, relief=0.1, segments=4,
)

# 7. The corridor from the First Fire, swept along its centreline with a joint
# at every bend (the Drowned Gallery's approach used the same trick: a chain
# of vaulted slices corrugates a passage). The sweep runs past Earth's block
# face into Fire's band, where Fire's own carve continues it.
JOINT_PROUD = 0.08
long_run = max(corridor_rects, key=lambda r: r["sizeY"])
door_row = min(corridor_rects, key=lambda r: r["centre"]["y"])
fire_door_y = door_row["centre"]["y"] + 0.75
corridor_x = long_run["centre"]["x"]
corridor_plan = [
    (DOORS["west"]["centre"]["x"] + 0.4, DOORS["west"]["centre"]["y"]),
    (corridor_x, DOORS["west"]["centre"]["y"]),
    (corridor_x, fire_door_y),
    (CORRIDOR_MIN_X - 0.8, fire_door_y),
]
CORRIDOR_W = long_run["sizeX"]
carver.swept("ET_Void_Corridor", corridor_plan, CORRIDOR_W, CORRIDOR_CROWN, shape="tube", base=DOOR_Y)
for index, bend in enumerate(corridor_plan[1:-1]):
    carver.chamber(
        f"ET_Void_Corridor-joint-{index}", bend, CORRIDOR_W / 2 + JOINT_PROUD,
        CORRIDOR_CROWN, shape="tube", segments=20, base=DOOR_Y,
    )

# 8. The south door bore out to Air, through the block's south face.
south = DOORS["south"]
carver.swept(
    "ET_Void_SouthDoor",
    [(south["centre"]["x"], south["centre"]["y"] + 1.0),
     (south["centre"]["x"], block_box["minY"] - 0.8)],
    (south["span"]["max"] - south["span"]["min"]) + 0.4, south["clearance"],
    shape="tube", extend=0.0, base=DOOR_Y,
)

SHELL_REPORT = carver.subtract_from(shell_rock)
SHELL_REPORT["margin"] = SHELL_MARGIN
SHELL_REPORT["fireBlockEastX"] = round(FIRE_BLOCK_EAST_X, 3)
SHELL_REPORT["block"] = {**block_box, "minZ": SHELL_FLOOR, "maxZ": SHELL_ROOF}
SHELL_REPORT["wing"] = wing_box
print(f"carved shell: {SHELL_REPORT}")


# ── Where the floor is under a point on the rail ────────────────────────────
def deck_floor(x, y):
    if y >= ty0 - 0.5:
        return north_floor(x, y)
    return east_floor(x, y)


# ── The rail ────────────────────────────────────────────────────────────────
# Brass posts every two metres along the contract's rail line, standing 15 cm
# inside it so every foot lands on the deck; a tube at rail height between
# them; a lantern head on every fourth post.
RAIL_INSET = 0.15
POST_R = 0.035
rail_pts = [(p["x"], p["y"]) for p in RAIL["points"]]
post_plan = []
# leg 1: west → east along the terrace edge (y = rail line, inset north)
x = rail_pts[0][0] + 0.12
while x < rail_pts[1][0] - RAIL_INSET - 0.5:
    post_plan.append((x, rail_pts[1][1] + RAIL_INSET))
    x += 2.0
corner = (rail_pts[1][0] + RAIL_INSET, rail_pts[1][1] + RAIL_INSET)
post_plan.append(corner)
# leg 2: north → south along the descent edge (x = rail line, inset east)
y = corner[1] - 2.0
while y > rail_pts[2][1] + 0.3:
    post_plan.append((rail_pts[2][0] + RAIL_INSET, y))
    y -= 2.0
post_plan.append((rail_pts[2][0] + RAIL_INSET, rail_pts[2][1] + 0.12))

rail_top = []
lamp_count = 0
for index, (px, py) in enumerate(post_plan):
    z0 = deck_floor(px, py)
    add_cylinder(
        f"ET_RailPost_{index:02d}", (px, py, z0 + RAIL_H / 2), POST_R, RAIL_H,
        BRASS, COLLECTIONS["FURNITURE"], vertices=12,
    )
    rail_top.append((px, py, z0 + RAIL_H))
    if index % 4 == 0 or index == len(post_plan) - 1:
        add_cylinder(
            f"ET_Lamp_{lamp_count:02d}", (px, py, z0 + RAIL_H + 0.2), 0.09, 0.24,
            LAMP, COLLECTIONS["FURNITURE"], vertices=12,
        )
        add_cylinder(
            f"ET_LampStem_{lamp_count:02d}", (px, py, z0 + RAIL_H + 0.05), 0.02, 0.1,
            BRASS, COLLECTIONS["FURNITURE"], vertices=8,
        )
        lamp_count += 1
add_curve_mesh("ET_Rail", rail_top, 0.03, BRASS, COLLECTIONS["FURNITURE"], resolution=4)

# A lamp on the landing's east wall, where the visitor stops for the ensemble.
landing = FLOORS["landing"]["box"]
lx = landing["maxX"] - 0.35
ly = (landing["minY"] + landing["maxY"]) / 2
add_cylinder(f"ET_LampStem_{lamp_count:02d}", (lx, ly, LANDING_Y + 0.8), 0.025, 1.6, BRASS, COLLECTIONS["FURNITURE"], vertices=8)
add_cylinder(f"ET_Lamp_{lamp_count:02d}", (lx, ly, LANDING_Y + 1.72), 0.09, 0.24, LAMP, COLLECTIONS["FURNITURE"], vertices=12)
lamp_count += 1

# ── The sky disc at the top of the aven ─────────────────────────────────────
add_cylinder(
    "ET_Sky", (AVEN["centre"]["x"], AVEN["centre"]["y"], SKY_Z), SKY_R, 0.05,
    SKY, COLLECTIONS["FURNITURE"], vertices=32,
)

# ── Growth: moss inside the west door, roots down the bed walls ─────────────
# Fire's extinction hands over to green growth at the threshold. Six moss
# discs on the vestibule floor just inside the door; nothing else on the
# floor, so the opener station (rendered at runtime) has the room.
opener = CONTRACT["opener"]["blender"]
door_x = DOORS["west"]["centre"]["x"]
for index in range(6):
    r = RNG.uniform(0.3, 0.6)
    # Ahead of the visitor, not underfoot: the first pass scattered them in
    # the two metres the arriving visitor is already standing in.
    mx = door_x + 2.0 + RNG.uniform(0.0, 3.0)
    my = RNG.uniform(-2.4, 2.0)
    add_cylinder(
        f"ET_Growth_Moss_{index:02d}", (mx, my, DOOR_Y + 0.015), r, 0.03,
        GROWTH, COLLECTIONS["GROWTH"], vertices=16,
    )

# Roots come out of the terrace's underside and the bed's walls and thin as
# they go. Along the east wall they get thinner toward the exit: by the door
# approach they are threads, and past the south door there are none — Air's
# handoff starts here.
root_count = 0


def root(points, base_radius, taper=(1.0, 0.75, 0.45, 0.25)):
    global root_count
    add_curve_mesh(
        f"ET_Root_{root_count:02d}", points, base_radius, ROOT_MAT,
        COLLECTIONS["GROWTH"], radii=list(taper[: len(points)]), resolution=4,
    )
    root_count += 1


# Every strand stays inside a hand's width of the wall it grew down. The
# first pass let them arc 0.6 m into the pit, and from the ramp a single
# root stood between the visitor and case H: the room's whole job is the
# sightline from the deck to the row, so nothing hangs in that air.
WALL_HUG = 0.12
north_wall_y = BED["maxY"]
# Between the cases, never in front of one.
for rx in (-6.6, -0.4, 6.5, 11.4):
    wobble = RNG.uniform(-0.35, 0.35)
    root([
        (rx, north_wall_y + 0.3, TERRACE_Y - 0.6),
        (rx + wobble, north_wall_y - WALL_HUG, 0.9),
        (rx - wobble * 0.6, north_wall_y - WALL_HUG * 0.7, -0.9),
        (rx + wobble * 0.3, north_wall_y - WALL_HUG, BED_Y + 0.1),
    ], 0.075)
east_wall_x = pit_box[2]
for ry, radius in ((3.5, 0.07), (-0.5, 0.05), (-4.5, 0.035)):
    wobble = RNG.uniform(-0.3, 0.3)
    root([
        (east_wall_x + 0.3, ry, east_floor(east_wall_x, ry) - 0.5),
        (east_wall_x - WALL_HUG, ry + wobble, 0.2),
        (east_wall_x - WALL_HUG * 0.7, ry - wobble * 0.5, -1.2),
        (east_wall_x - WALL_HUG, ry + wobble * 0.3, BED_Y + 0.1),
    ], radius)
# The south wall carries the letters, so its roots run the far corners only.
for rx in (-8.0, 11.4):
    wobble = RNG.uniform(-0.3, 0.3)
    root([
        (rx, BED["minY"] - 0.3, 3.2),
        (rx + wobble, BED["minY"] + WALL_HUG, 1.0),
        (rx - wobble * 0.5, BED["minY"] + WALL_HUG * 0.7, -1.0),
        (rx, BED["minY"] + WALL_HUG, BED_Y + 0.1),
    ], 0.07)
root([
    (BED["minX"] - 0.3, 0.5, 3.0), (BED["minX"] + WALL_HUG, 0.9, 0.8),
    (BED["minX"] + WALL_HUG * 0.7, 0.2, -1.0),
    (BED["minX"] + WALL_HUG, 0.6, BED_Y + 0.1),
], 0.07)
# Threads on the descent's east wall, fading out at the door approach.
descent_wall_x = ex1
for ry, radius in ((-5.0, 0.03), (-9.0, 0.018)):
    root([
        (descent_wall_x + 0.3, ry, east_floor(descent_wall_x, ry) + 2.6),
        (descent_wall_x - 0.12, ry + 0.3, east_floor(descent_wall_x, ry) + 1.6),
        (descent_wall_x - 0.12, ry - 0.2, east_floor(descent_wall_x, ry) + 0.7),
        (descent_wall_x - 0.1, ry, east_floor(descent_wall_x, ry) + 0.1),
    ], radius)

# ── Cut letters ─────────────────────────────────────────────────────────────
# The class stamp on the vestibule's east wall, read from the door; the case
# letters on the bed's south wall, read from the rail. Elemental words are
# never spoken in the room: the stamp names the class, the letters the cases.
# On the wall the door aims at, at the door's own y — the visitor reads the
# class name before anything else in the room. The first pass hung it two
# metres south of the doorway and it left the frame on arrival.
stamp = add_text_mesh(
    "ET_Stamp_TogetherSame", "TOGETHER-SAME",
    (vx1 + 0.2, DOORS["west"]["centre"]["y"], 2.3),
    (math.pi / 2, 0.0, -math.pi / 2), 0.42, STAMP, COLLECTIONS["FURNITURE"],
)
for station in STATIONS:
    add_text_mesh(
        f"ET_Letter_{station['letter']}", station["letter"],
        (station["blender"]["x"], BED["minY"] + 0.12, BED_Y + 1.6), (math.pi / 2, 0.0, math.pi), 1.2,
        STAMP, COLLECTIONS["FURNITURE"],
    )

# ── Locators (never exported) ───────────────────────────────────────────────
# A performer's height, not a half-height marker: these cones are the only
# thing standing on the bed in QA, and at 0.9 m they read as clear of the
# rail from viewpoints where a person would not be.
def add_locator(name, location, radius=0.3, depth=1.7):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, depth=depth, location=(location[0], location[1], location[2] + depth / 2))
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, LOCATOR)
    return move_to_collection(obj, COLLECTIONS["LOCATORS"])


for station in STATIONS:
    b = station["blender"]
    add_locator(f"LOC_Station_{station['letter']}", (b["x"], b["y"], b["z"]))
add_locator("LOC_Opener", (opener["x"], opener["y"], opener["z"]))
ens = CONTRACT["ensemble"]
add_locator("LOC_EnsembleEye", (ens["eye"]["x"], ens["eye"]["y"], ens["eye"]["z"]), 0.18, 0.5)

# ── QA lights ───────────────────────────────────────────────────────────────
qa_lights = []


def add_light(name, location, color, energy, radius=0.6, kind="POINT", spot_size=None, target=None):
    data = bpy.data.lights.new(name, kind)
    data.color = color
    data.energy = energy
    data.shadow_soft_size = radius
    if kind == "SPOT" and spot_size:
        data.spot_size = spot_size
        data.spot_blend = 0.4
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    COLLECTIONS["QA_ONLY"].objects.link(obj)
    if target is not None:
        direction = Vector(target) - Vector(location)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    qa_lights.append(obj)
    return obj


DAYLIGHT = (0.86, 0.91, 1.0)
WARM = (1.0, 0.76, 0.5)
# The aven is a shaft of daylight, not a searchlight. At 30000 W the first
# pass tone-mapped the whole rootbed to flat white and the row read as three
# cones on a sheet of paper: no floor, no relief, nothing to compare.
add_light(
    "QA_Aven", (AVEN["centre"]["x"], AVEN["centre"]["y"], AVEN_TOP - 1.2),
    DAYLIGHT, 5200, 1.6, "SPOT", math.radians(62),
    target=(AVEN["centre"]["x"], AVEN["centre"]["y"], BED_Y),
)
for station in STATIONS:
    b = station["blender"]
    add_light(
        "QA_Bed_" + station["letter"],
        (b["x"], b["y"] + 1.5, BED_Y + 4.8), DAYLIGHT, 180, 0.8,
    )
# Green at the threshold is the seam from Fire's extinction, but a pure green
# key turned the vestibule into a monochrome fog with no rock in it: a warm
# key with a green fill instead, so the moss is the thing that is green.
add_light("QA_Vestibule", ((vx0 + vx1) / 2, 0.8, 3.4), (0.95, 0.9, 0.78), 300, 0.8)
add_light("QA_VestibuleGrowth", (vx0 + 3.4, 0.0, 1.1), (0.42, 0.9, 0.4), 190, 0.7)
add_light("QA_Ramp", ((rx0 + rx1) / 2, (ry0 + ry1) / 2, 4.6), WARM, 360, 0.6)
add_light("QA_Terrace", ((tx0 + tx1) / 2, (ty0 + ty1) / 2, 5.4), WARM, 520, 0.6)
add_light("QA_Landing", (lx - 0.6, ly, LANDING_Y + 2.4), WARM, 380, 0.5)
add_light("QA_Approach", ((ex0 + ex1) / 2, -10.0, 2.6), WARM, 220, 0.5)
add_light("QA_Cleft", ((CLEFT["minX"] + CLEFT["maxX"]) / 2, (CLEFT["minY"] + CLEFT["maxY"]) / 2, CLEFT_Y + 3.0), (0.4, 0.5, 0.6), 140, 0.5)
add_light("QA_Corridor", (corridor_x, (DOORS["west"]["centre"]["y"] + fire_door_y) / 2, 2.4), (0.5, 0.8, 0.5), 260, 0.6)

# ── Cameras from the contract ───────────────────────────────────────────────
def look_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


PLAN_SECTION_Z = 3.0
cameras = {}
for camera_spec in CONTRACT["cameras"]:
    data = bpy.data.cameras.new(camera_spec["name"])
    camera = bpy.data.objects.new(camera_spec["name"], data)
    position = camera_spec["position"]
    camera.location = (position["x"], position["y"], position["z"])
    data.clip_start = 0.05
    data.clip_end = 250
    if camera_spec["id"] == "plan":
        # A section, not a cutaway: the near plane slices the room at 3 m so
        # the terrace, the corridor and the vestibule all read as void and
        # the rock between them as rock.
        data.clip_start = position["z"] - PLAN_SECTION_Z
    if camera_spec["type"] == "orthographic":
        data.type = "ORTHO"
        data.ortho_scale = camera_spec["orthographicScale"]
    else:
        horizontal_fov = math.radians(camera_spec["horizontalFovDegrees"])
        data.sensor_width = 36
        data.lens = data.sensor_width / (2 * math.tan(horizontal_fov / 2))
    target = camera_spec["target"]
    look_at(camera, Vector((target["x"], target["y"], target["z"])))
    COLLECTIONS["CAMERAS"].objects.link(camera)
    cameras[camera_spec["id"]] = camera

# ── Render setup ────────────────────────────────────────────────────────────
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.3
scene.world = bpy.data.worlds.new("Earth Root Terrace QA World")
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.006, 0.008, 0.01, 1.0)
background.inputs["Strength"].default_value = 0.12


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(c) for obj in objects if obj.type == "MESH" for c in obj.bound_box]
    return {
        "minX": min(p.x for p in points), "maxX": max(p.x for p in points),
        "minY": min(p.y for p in points), "maxY": max(p.y for p in points),
        "minZ": min(p.z for p in points), "maxZ": max(p.z for p in points),
    }


export_meshes = [o for o in scene.objects if o.type == "MESH" and o.name.startswith("ET_")]
if any(o.name.startswith("ET_") and o.type in ("LIGHT", "CAMERA") for o in scene.objects):
    raise RuntimeError("ET_ export prefix includes a QA light or camera")
for obj in export_meshes:
    if obj.type == "MESH" and (not obj.data.materials or obj.data.materials[0] is None):
        raise RuntimeError(f"{obj.name} has no material")
    for slot in obj.material_slots:
        bsdf = slot.material.node_tree.nodes.get("Principled BSDF")
        if bsdf and bsdf.inputs["Metallic"].default_value > 0.0:
            raise RuntimeError(f"{obj.name}: {slot.material.name} is metallic; the museum has no environment map")

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

render_paths = {}
CUTAWAY_CAMERAS = {"overview"}
for name, camera in cameras.items():
    shell_rock.hide_render = name in CUTAWAY_CAMERAS
    scene.camera = camera
    render_path = QA_DIR / f"earth-root-terrace-{name}.png"
    scene.render.filepath = str(render_path)
    bpy.ops.render.render(write_still=True)
    render_paths[name] = str(render_path.relative_to(ROOT)).replace("\\", "/")
shell_rock.hide_render = False
scene.camera = cameras["terrace-overlook"]
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

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
    "sourceDigest": SOURCE_DIGEST,
    "schemaVersion": CONTRACT["schemaVersion"],
    "blenderVersion": bpy.app.version_string,
    "blendPath": str(BLEND_PATH.relative_to(ROOT)).replace("\\", "/"),
    "manifestPath": str(MANIFEST_PATH.relative_to(ROOT)).replace("\\", "/"),
    "rawGlbPath": str(RAW_GLB_PATH.relative_to(ROOT)).replace("\\", "/"),
    "shell": SHELL_REPORT,
    "exportPrefix": CONTRACT["exportPrefix"],
    "exportMeshCount": len(export_meshes),
    "exportObjects": sorted(o.name for o in export_meshes),
    "materialCount": len(bpy.data.materials),
    "railPosts": len(post_plan),
    "lamps": lamp_count,
    "roots": root_count,
    "exportObjectBounds": world_bounds(export_meshes),
    "collections": sorted(COLLECTIONS),
    "renders": render_paths,
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Verified Earth Root Terrace source digest: {SOURCE_DIGEST}")
print(f"Saved editable graybox: {BLEND_PATH}")
print(f"Export meshes: {len(export_meshes)}; posts {len(post_plan)}; lamps {lamp_count}; roots {root_count}")
for name, path in render_paths.items():
    print(f"Rendered {name:>16}: {path}")
