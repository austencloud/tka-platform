"""Build the standalone Drowned Gallery graybox in Blender.

The measured layout authority is buildDrownedGalleryLayout (TypeScript);
scripts/export-drowned-gallery-blender-plan.ts serialises it to a hash-stamped
JSON contract. This script verifies that digest, extrudes every layout rect
into graybox massing, lights it for review, renders the QA views, and saves an
editable .blend. It never opens the shared interactive Blender scene.

Run from the repository root:

  pnpm exec tsx scripts/export-drowned-gallery-blender-plan.ts
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" ^
    --background --factory-startup ^
    --python scripts/build-drowned-gallery-graybox.py

Outputs:
  blender/drowned-gallery-graybox.blend
  %TEMP%/tka-drowned-gallery-evidence/*.png
  artifacts/drowned-gallery-graybox-report.json
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
    ROOT / "docs" / "superpowers" / "specs" / "2026-08-09-drowned-gallery-blender-plan.json"
)
BLEND_PATH = ROOT / "blender" / "drowned-gallery-graybox.blend"
REPORT_PATH = ROOT / "artifacts" / "drowned-gallery-graybox-report.json"
RAW_GLB_PATH = ROOT / "artifacts" / "drowned-gallery-graybox_raw.glb"
QA_DIR = Path(tempfile.gettempdir()) / "tka-drowned-gallery-evidence"
RNG = random.Random(0xD601)

SLAB_T = 0.3

# The shell is CARVED out of one block, the way First Fire's is. Blender runs
# this file as a loose script with no package on the path, so the shared module
# is loaded by location rather than imported.
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
            "Drowned Gallery Blender manifest digest mismatch. "
            "Regenerate it from the TypeScript layout before building."
        )
    return contract, digest


CONTRACT, SOURCE_DIGEST = load_contract()
LAYOUT = CONTRACT["layout"]
DATUM = CONTRACT["datums"]
ORIGIN = CONTRACT["coordinateSystem"]["origin"]

WATERLINE = DATUM["WATERLINE_Y"]
GALLERY_FLOOR = DATUM["GALLERY_FLOOR_Y"]
GALLERY_ROOF = DATUM["GALLERY_ROOF_Y"]
CAUSEWAY = DATUM["CAUSEWAY_Y"]
SHELF = DATUM["SHELF_Y"]
CHANNEL_BED = DATUM["CHANNEL_BED_Y"]
POOL_BOTTOM = DATUM["POOL_BOTTOM_Y"]
DOME_APEX = DATUM["DOME_APEX_Y"]
SHAFT_CEILING = DATUM["SHAFT_CEILING_Y"]
SHALLOWS = DATUM["SHALLOWS_Y"]

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = CONTRACT["sceneName"]
scene["drowned_gallery_contract_schema"] = CONTRACT["schemaVersion"]
scene["drowned_gallery_source_digest"] = SOURCE_DIGEST
scene["drowned_gallery_source_module"] = CONTRACT["sourceModule"]
scene["drowned_gallery_performers"] = json.dumps(CONTRACT["performers"])


def create_collection(name, parent=None):
    result = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(result)
    return result


export_root = create_collection("EXPORT_DrownedGallery")
COLLECTIONS = {
    name: create_collection(name, export_root)
    for name in CONTRACT["collections"]
    if name not in ("REFERENCE", "LOCATORS", "QA_ONLY")
}
COLLECTIONS["REFERENCE"] = create_collection("REFERENCE")
COLLECTIONS["LOCATORS"] = create_collection("LOCATORS")
COLLECTIONS["QA_ONLY"] = create_collection("QA_ONLY")


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
        if color[3] < 1.0:
            bsdf.inputs["Alpha"].default_value = color[3]
            try:
                result.surface_render_method = "DITHERED"
            except AttributeError:
                pass
    return result


ROCK = material("DG Cave Rock", (0.088, 0.078, 0.064, 1.0), roughness=0.97)
ROCK_WET = material("DG Wet Rock", (0.115, 0.10, 0.082, 1.0), roughness=0.9)
STONE_WALK = material("DG Walkway Stone", (0.30, 0.24, 0.165, 1.0), roughness=0.92)
STONE_DEEP = material("DG Drowned Stone", (0.14, 0.13, 0.105, 1.0), roughness=0.95)
GOLD = material(
    "DG Gilded Threshold", (0.72, 0.52, 0.18, 1.0), roughness=0.35, metallic=0.7,
    emission=(0.72, 0.45, 0.12, 1.0), emission_strength=0.5,
)
WATER_SURFACE = material(
    "DG Water Surface", (0.05, 0.26, 0.36, 0.62), roughness=0.08,
    emission=(0.03, 0.20, 0.28, 1.0), emission_strength=0.9,
)
WATER_BODY = material(
    "DG Water Body", (0.035, 0.16, 0.24, 0.28), roughness=0.3,
    emission=(0.015, 0.09, 0.14, 1.0), emission_strength=0.25,
)
# The grotto's brimming water. A BLACK MIRROR, not a lit pool: the room's one
# job is to show A, B and C doubled, and you cannot see a reflection in a
# surface that is busy glowing. Near-black base, metallic, almost no roughness,
# zero emission — all the brightness in it has to be the reflected firelight.
# The previous emissive teal (strength 0.7) read as a swimming pool and hid the
# doubling entirely.
POOL_MIRROR = material(
    "DG Mirror Pool", (0.012, 0.028, 0.035, 1.0), roughness=0.02, metallic=1.0,
)
WATERFALL = material(
    "DG Waterfall", (0.30, 0.62, 0.72, 0.8), roughness=0.15,
    emission=(0.18, 0.45, 0.55, 1.0), emission_strength=1.6,
)
GLOWWORM = material(
    "DG Glowworm", (0.35, 0.95, 0.78, 1.0), roughness=0.3,
    emission=(0.30, 0.95, 0.72, 1.0), emission_strength=6.0,
)
FIRELIGHT = material(
    "DG Alcove Firelight", (1.0, 0.55, 0.2, 1.0), roughness=0.4,
    emission=(1.0, 0.42, 0.12, 1.0), emission_strength=3.2,
)
STAGE = material("DG Performer Stage", (0.42, 0.34, 0.22, 1.0), roughness=0.8)
RAIL = material("DG Balustrade", (0.24, 0.20, 0.15, 1.0), roughness=0.9)
LOCATOR = material("Performer Locator", (0.82, 0.86, 0.82, 1.0), roughness=0.6)


def assign(obj, mat):
    if obj.type == "MESH":
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def bx(x: float) -> float:
    return x - ORIGIN["x"]


def by(z: float) -> float:
    return ORIGIN["z"] - z


def plan_to_blender(x, z, elevation=0.0):
    return Vector((bx(x), by(z), elevation))


def add_box(name, location, dimensions, mat, target, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return move_to_collection(obj, target)


def rect_dims(rect):
    return rect["maxX"] - rect["minX"], rect["maxZ"] - rect["minZ"]


def rect_centre(rect):
    return (rect["minX"] + rect["maxX"]) / 2, (rect["minZ"] + rect["maxZ"]) / 2


def rect_box(name, rect, base_y, top_y, mat, target):
    w, d = rect_dims(rect)
    cx, cz = rect_centre(rect)
    if w <= 0.005 or d <= 0.005 or top_y - base_y <= 0.005:
        return None
    return add_box(
        name,
        (bx(cx), by(cz), (base_y + top_y) / 2),
        (w, d, top_y - base_y),
        mat,
        target,
    )


def floor_slab(floor: dict, mat, target):
    rect = floor["rect"]
    w, d = rect_dims(rect)
    cx, cz = rect_centre(rect)
    from_y = floor["fromY"]
    to_y = floor["toY"]
    mid = (from_y + to_y) / 2 - SLAB_T / 2
    if floor["kind"] == "flat":
        return add_box(
            f"DG_Floor_{floor['id']}",
            (bx(cx), by(cz), from_y - SLAB_T / 2),
            (w, d, SLAB_T),
            mat,
            target,
        )
    rise = to_y - from_y
    if floor["kind"] == "ramp-z":
        run = d
        # World +Z maps to Blender -Y; elevation goes fromY at minZ (large
        # Blender Y) to toY at maxZ (small Blender Y).
        angle_x = math.atan2(from_y - to_y, run)
        return add_box(
            f"DG_Floor_{floor['id']}",
            (bx(cx), by(cz), mid),
            (w, math.hypot(run, rise), SLAB_T),
            mat,
            target,
            rotation=(angle_x, 0.0, 0.0),
        )
    run = w
    angle_y = -math.atan2(rise, run)
    return add_box(
        f"DG_Floor_{floor['id']}",
        (bx(cx), by(cz), mid),
        (math.hypot(run, rise), d, SLAB_T),
        mat,
        target,
        rotation=(0.0, angle_y, 0.0),
    )


# ── Floors ──────────────────────────────────────────────────────────────────
for floor in LAYOUT["floorRects"]:
    fid = floor["id"]
    if fid in ("pool-bottom", "channel-bed", "shore-shelf"):
        mat = ROCK_WET
    elif floor["fromY"] <= GALLERY_FLOOR + 0.6 or fid.startswith(
        ("descent", "west-run", "north-run", "east-bend", "surfacing")
    ):
        mat = STONE_DEEP
    else:
        mat = STONE_WALK
    floor_slab(floor, mat, COLLECTIONS["FLOORS"])

# ── The cave shell, carved ──────────────────────────────────────────────────
# This room used to be built the way the contract describes it: wallRects,
# ceilingRects, roofRects and rockFill each extruded into a box. Every measure
# was right and it still did not read as a cave — 90-degree arrises everywhere
# and a flat lid over the grotto. Austen, walking it (2026-08-11): "this does
# not feel like it's in a cave."
#
# So the same measurements now drive a CARVE instead. One block of rock spans
# the bay plus a margin; every space the visitor occupies is cut out of it as a
# negative volume, and floor, wall and vault come out as one continuous surface
# because they were never separate objects. Nothing here moves a walked edge:
# each void is the contract's own rectangle, and each void floor sits exactly
# one slab-thickness under the floor the contract specifies, so the cut-stone
# slabs above drop into their troughs flush.
#
# wallRects and rockFill are consumed rather than built: in a carve, the rock
# between two voids IS the wall, and the block IS the fill. They stay in the
# contract because the collider set and the runtime layout still read them.
SHELL_MARGIN = 3.5
SHELL_FLOOR = POOL_BOTTOM - SLAB_T - 1.7
SHELL_ROOF = DOME_APEX + 2.5
DECK_VOID = CAUSEWAY - SLAB_T
# The apses behind the three performers: domes hollowed BACK into the south
# wall from a centre that sits inside the rock, so each alcove is a recess a
# performer stands in rather than a light box stuck on a flat wall.
APSE_CENTRE_Z = 3.6
APSE_RADIUS = 2.2
APSE_CLEARANCE = 3.6
# Where the apse's rock actually is: the section stands its foot a shoulder
# outboard of the walked radius, so the back of the recess is further from the
# room than the radius alone implies.
APSE_BACK_Z = APSE_CENTRE_Z - (APSE_RADIUS + cave_shell.FLOOR_SHOULDER)

carver = cave_shell.Carver("DG_CARVE_Negative", scene)
FLOORS = {floor["id"]: floor for floor in LAYOUT["floorRects"]}


def blender_box(rect):
    """A plan rect as a Blender-space (x0, y0, x1, y1). World +Z is Blender -Y,
    so the rect's max Z is the box's minimum Y."""
    return bx(rect["minX"]), by(rect["maxZ"]), bx(rect["maxX"]), by(rect["minZ"])


def sub_rect(rect, min_z=None, max_z=None):
    result = dict(rect)
    if min_z is not None:
        result["minZ"] = min_z
    if max_z is not None:
        result["maxZ"] = max_z
    return result


def elevation_at_z(floor, z):
    rect = floor["rect"]
    span = rect["maxZ"] - rect["minZ"]
    fraction = 0.0 if span < 1e-9 else (z - rect["minZ"]) / span
    return floor["fromY"] + (floor["toY"] - floor["fromY"]) * fraction


def void_floor(rect, kind, from_y, to_y):
    """Elevation of the rock under a slab, as a constant or a slope function."""
    if kind == "flat":
        return from_y - SLAB_T
    along_z = kind == "ramp-z"
    low, high = (
        (by(rect["minZ"]), by(rect["maxZ"])) if along_z
        else (bx(rect["minX"]), bx(rect["maxX"]))
    )
    span = high - low

    def at(vx, vy):
        # Clamped, so the overlap each void is expanded by carries the ramp's
        # end elevation rather than running the slope past its own rect.
        value = vy if along_z else vx
        fraction = 0.0 if abs(span) < 1e-9 else (value - low) / span
        return from_y + (to_y - from_y) * min(1.0, max(0.0, fraction)) - SLAB_T

    return at


def carve_vault(name, rect, kind, from_y, to_y, crown, shape):
    span = min(rect["maxX"] - rect["minX"], rect["maxZ"] - rect["minZ"])
    return carver.vault(
        f"DG_Void_{name}",
        blender_box(rect),
        void_floor(rect, kind, from_y, to_y),
        crown,
        shape=shape,
        corner_radius=min(1.1, span / 3),
        # Neighbouring rooms in a measured plan share a face, and two volumes
        # meeting on a coplanar face is the one case an exact boolean is
        # entitled to get wrong. A hand's width of overlap settles it.
        expand=0.22,
        corner_segments=5,
        relief=min(0.16, 0.05 * span),
        seed=len(carver.parts) * 1.31,
    )


# The approach dogleg and the submerged runs are passages, not rooms: the
# contract slices them into rects, and vaulting each slice separately would
# corrugate the ceiling into one barrel per slice. Sweep their centrelines
# instead, with a joint chamber standing proud at every bend so the mitre —
# which is clamped, and so under-fills a right angle — cannot leave a notch.
JOINT_PROUD = 0.08


def sweep_run(name, points, width, base, crown, shape):
    plan = [(bx(x), by(z)) for x, z in points]
    carver.swept(f"DG_Void_{name}", plan, width, crown - base, shape=shape, base=base)
    for index, bend in enumerate(plan[1:-1]):
        carver.chamber(
            f"DG_Void_{name}-joint-{index}", bend, width / 2 + JOINT_PROUD,
            crown - base, shape=shape, segments=20, base=base,
        )


approach_ramp = FLOORS["approach-ramp"]
carve_vault(
    "approach-ramp", approach_ramp["rect"], approach_ramp["kind"],
    approach_ramp["fromY"], approach_ramp["toY"], SHAFT_CEILING, "tube",
)
sweep_run(
    "approach-corridor",
    [(13.5, 58.75), (13.5, 56.0), (20.0, 56.0), (20.0, 53.75)],
    1.5, SHALLOWS - SLAB_T, SHAFT_CEILING, "tube",
)

descent = FLOORS["descent-stair"]
descent_split = LAYOUT["descentOpen"]["minZ"]
descent_mid = elevation_at_z(descent, descent_split)
carve_vault(
    "descent-roofed", sub_rect(descent["rect"], max_z=descent_split), "ramp-z",
    descent["fromY"], descent_mid, GALLERY_ROOF, "slot",
)
carve_vault(
    "descent-shaft", sub_rect(descent["rect"], min_z=descent_split), "ramp-z",
    descent_mid, descent["toY"], SHAFT_CEILING, "shaft",
)

sweep_run(
    "gallery-runs",
    [(19.5, 48.9), (19.5, 47.0), (10.0, 47.0), (10.0, 39.0), (13.75, 39.0),
     (13.75, 37.4)],
    2.5, GALLERY_FLOOR - SLAB_T, GALLERY_ROOF, "slot",
)

surfacing = FLOORS["surfacing-lower"]
surfacing_split = LAYOUT["surfacingRoofed"]["minZ"]
surfacing_mid = elevation_at_z(surfacing, surfacing_split)
carve_vault(
    "surfacing-roofed", sub_rect(surfacing["rect"], min_z=surfacing_split),
    "ramp-z", surfacing_mid, surfacing["toY"], GALLERY_ROOF, "slot",
)
carve_vault(
    "surfacing-lower", sub_rect(surfacing["rect"], max_z=surfacing_split),
    "ramp-z", surfacing["fromY"], surfacing_mid, SHAFT_CEILING, "shaft",
)
for floor_id, section in (
    ("surfacing-landing", "shaft"),
    ("surfacing-upper", "shaft"),
    ("gallery-corridor-0", "tube"),
):
    piece = FLOORS[floor_id]
    carve_vault(
        floor_id, piece["rect"], piece["kind"], piece["fromY"], piece["toY"],
        SHAFT_CEILING, section,
    )

# The grotto: one cloister vault over the whole bay. Its walls stand vertical
# for the first 4.4 m — above every balustrade, jamb and performer — and only
# then draw in toward the crown, so nothing the visitor can reach is pinched by
# the curve and the dome is read rather than ducked under.
carver.vault(
    "DG_Void_grotto", blender_box(LAYOUT["grotto"]), DECK_VOID, DOME_APEX,
    shape="dome", corner_radius=2.6, expand=0.0, corner_segments=7,
    relief=0.22, seed=4.7,
)

# Channel, pool and shelf are troughs cut down out of that deck, not boxes set
# on a floor. Each rim sits above the deck so the trough and the room overlap
# in height instead of meeting on the deck plane.
for basin_id, source, floor_y, radius, foot, wobble, seed in (
    ("shore", LAYOUT["shore"], SHELF, 1.6, 0.30, 0.10, 1.2),
    ("channel", LAYOUT["channel"], CHANNEL_BED, 1.4, 0.35, 0.12, 2.4),
    ("pool", LAYOUT["pool"], POOL_BOTTOM, 1.8, 0.45, 0.14, 3.6),
):
    carver.basin(
        f"DG_Void_{basin_id}", blender_box(source), floor_y - SLAB_T, CAUSEWAY,
        corner_radius=radius, foot_inset=foot, corner_segments=5,
        relief=wobble, seed=seed,
    )

for letter, anchor in zip("ABC", LAYOUT["alcoves"]):
    carver.chamber(
        f"DG_Void_Apse_{letter}", (bx(anchor["x"]), by(APSE_CENTRE_Z)),
        APSE_RADIUS, APSE_CLEARANCE, shape="dome", segments=24,
        base=SHELF - SLAB_T,
    )

# The exit runs east off the ramp and breaks out through the block's own skin,
# so the room ends in a mouth rather than in a wall the visitor walks into.
carver.vault(
    "DG_Void_exit",
    (bx(26.05), by(24.25), bx(LAYOUT["grotto"]["maxX"] + SHELL_MARGIN + 1.0),
     by(22.25)),
    0.0, SHAFT_CEILING, shape="tube", corner_radius=0.7, expand=0.0,
    corner_segments=4, relief=0.08, seed=5.9,
)

_bay = LAYOUT["bayBounds"]
shell_rock = add_box(
    "DG_Shell_Rock",
    (
        (bx(_bay["minX"]) + bx(_bay["maxX"])) / 2,
        (by(_bay["minZ"]) + by(_bay["maxZ"])) / 2,
        (SHELL_FLOOR + SHELL_ROOF) / 2,
    ),
    (
        _bay["maxX"] - _bay["minX"] + SHELL_MARGIN * 2,
        _bay["maxZ"] - _bay["minZ"] + SHELL_MARGIN * 2,
        SHELL_ROOF - SHELL_FLOOR,
    ),
    ROCK,
    COLLECTIONS["SHELL"],
)
SHELL_REPORT = carver.subtract_from(shell_rock)
SHELL_REPORT["margin"] = SHELL_MARGIN
SHELL_REPORT["floor"] = SHELL_FLOOR
SHELL_REPORT["roof"] = SHELL_ROOF

# ── Water ───────────────────────────────────────────────────────────────────
# Every body carries its own surfaceY. The submerged gallery sits at
# WATERLINE_Y; the grotto brims at GROTTO_WATERLINE_Y, 0.15 m under its deck.
# Rendering both at one datum sank the grotto into a 1.2 m trench and read as
# two disconnected slabs (2026-08-09).
GROTTO_WATERLINE = DATUM["GROTTO_WATERLINE_Y"]
pool_rect = LAYOUT["pool"]

for index, plane in enumerate(LAYOUT["waterPlanes"]):
    surface = plane["surfaceY"]
    # Both brimming grotto bodies are mirrors: the channel doubles A/B/C
    # standing on the north shore, the pool carries the wide still reflection.
    mat = POOL_MIRROR if surface == GROTTO_WATERLINE else WATER_SURFACE
    rect_box(
        f"DG_WaterSurface_{index}", plane, surface - 0.04, surface, mat,
        COLLECTIONS["WATER"],
    )

for volume in LAYOUT["waterVolumes"]:
    rect_box(
        f"DG_WaterVolume_{volume['id']}", volume["rect"], volume["floorY"],
        volume["surfaceY"] - 0.05, WATER_BODY, COLLECTIONS["WATER"],
    )

# Waterfall sheet feeding the channel from the west.
wf = LAYOUT["waterfall"]
wf_w, wf_d = rect_dims(wf)
wf_cx, wf_cz = rect_centre(wf)
add_box(
    "DG_Waterfall_Sheet",
    (bx(wf["minX"] + 0.25), by(wf_cz), (CHANNEL_BED + 5.6) / 2),
    (0.35, wf_d, 5.6 - CHANNEL_BED),
    WATERFALL,
    COLLECTIONS["FEATURES"],
)

# ── Grotto features ─────────────────────────────────────────────────────────
for index, rect in enumerate(LAYOUT["balustrades"]):
    rect_box(
        f"DG_Rail_{index}", rect, CAUSEWAY, CAUSEWAY + 0.55, RAIL,
        COLLECTIONS["FEATURES"],
    )

for index, rect in enumerate(LAYOUT["thresholdJambs"]):
    rect_box(
        f"DG_Threshold_Jamb_{index}", rect, CAUSEWAY, CAUSEWAY + 3.4, GOLD,
        COLLECTIONS["FEATURES"],
    )
opening = LAYOUT["thresholdOpening"]
rect_box(
    "DG_Threshold_Lintel", opening, CAUSEWAY + 3.0, CAUSEWAY + 3.4, GOLD,
    COLLECTIONS["FEATURES"],
)

# Alcove stages, firelight niches and performer locators (A, B, C west→east).
grotto = LAYOUT["grotto"]
for letter, anchor in zip("ABC", LAYOUT["alcoves"]):
    loc = plan_to_blender(anchor["x"], anchor["z"], SHELF + 0.31)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=1.1, depth=0.62, location=loc
    )
    stage = bpy.context.active_object
    stage.name = f"DG_Stage_{letter}"
    assign(stage, STAGE)
    move_to_collection(stage, COLLECTIONS["FEATURES"])

    # Set against the back of the carved apse, not against the old flat wall.
    # A 2.6 m panel at the plane the wall used to occupy now floats in mid-air
    # inside the recess; this one is sized and placed to sit into the curve.
    add_box(
        f"DG_Niche_Fire_{letter}",
        (bx(anchor["x"]), by(APSE_BACK_Z + 0.45), SHELF + 1.0),
        (1.8, 0.5, 1.6),
        FIRELIGHT,
        COLLECTIONS["FEATURES"],
    )

    body_loc = plan_to_blender(anchor["x"], anchor["z"], SHELF + 0.62 + 0.9)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10, radius=0.24, depth=1.8, location=body_loc
    )
    body = bpy.context.active_object
    body.name = f"LOC_Performer_{letter}"
    assign(body, LOCATOR)
    move_to_collection(body, COLLECTIONS["LOCATORS"])

# ── Glowworm dome ───────────────────────────────────────────────────────────
worm_mesh = None
gcx, gcz = rect_centre(grotto)
gw, gd = rect_dims(grotto)
rx, rz = gw / 2 - 1.0, gd / 2 - 1.0
worm_count = 0
for index in range(150):
    dx = RNG.uniform(-rx, rx)
    dz = RNG.uniform(-rz, rz)
    fall = 1.0 - ((dx / rx) ** 2 + (dz / rz) ** 2)
    if fall <= 0.05:
        continue
    height = 4.0 + (DOME_APEX - 4.6) * fall + RNG.uniform(-0.35, 0.2)
    if worm_mesh is None:
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1, radius=0.06, location=(0, 0, -50)
        )
        template = bpy.context.active_object
        worm_mesh = template.data
        assign(template, GLOWWORM)
        template.name = "DG_Glowworm_0"
        template.location = plan_to_blender(gcx + dx, gcz + dz, height)
        move_to_collection(template, COLLECTIONS["DOME"])
        worm_count += 1
        continue
    obj = bpy.data.objects.new(f"DG_Glowworm_{worm_count}", worm_mesh)
    obj.location = plan_to_blender(gcx + dx, gcz + dz, height)
    COLLECTIONS["DOME"].objects.link(obj)
    worm_count += 1

# ── QA lights (never exported) ──────────────────────────────────────────────


def add_light(name, plan_location, color, energy, radius=6.0):
    bpy.ops.object.light_add(
        type="POINT",
        location=plan_to_blender(*plan_location[:2], plan_location[2]),
    )
    light = bpy.context.active_object
    light.name = name
    light.data.color = color
    light.data.energy = energy
    light.data.shadow_soft_size = radius / 6
    return move_to_collection(light, COLLECTIONS["QA_ONLY"])


def add_area_light(name, plan_location, color, energy, size):
    bpy.ops.object.light_add(
        type="AREA",
        location=plan_to_blender(*plan_location[:2], plan_location[2]),
    )
    light = bpy.context.active_object
    light.name = name
    light.data.color = color
    light.data.energy = energy
    light.data.size = size
    return move_to_collection(light, COLLECTIONS["QA_ONLY"])


add_area_light("QA_Area_GrottoKey", (gcx, gcz, DOME_APEX - 1.0), (0.55, 0.9, 0.8), 2600, 14)
add_area_light("QA_Area_GalleryFill", (14.0, 42.0, SHAFT_CEILING + 4.0), (0.25, 0.5, 0.62), 1600, 16)
for letter, anchor in zip("ABC", LAYOUT["alcoves"]):
    add_light(
        f"QA_Point_Alcove_{letter}", (anchor["x"], anchor["z"] - 0.6, SHELF + 2.4),
        (1.0, 0.62, 0.28), 950,
    )
add_light("QA_Point_Dome", (gcx, gcz, DOME_APEX - 1.2), (0.45, 0.95, 0.8), 1800, 12)
# Soft fill well ABOVE the brimming surface. At WATERLINE + 1.4 this sat 0.35 m
# off the raised water and blew it out to flat cyan, which is not what a mirror
# does. Height is measured from the grotto's own datum now.
add_light(
    "QA_Point_Pool",
    ((pool_rect["minX"] + pool_rect["maxX"]) / 2,
     (pool_rect["minZ"] + pool_rect["maxZ"]) / 2, GROTTO_WATERLINE + 4.2),
    (0.2, 0.6, 0.7), 420,
)
for index, shaft in enumerate(LAYOUT["openShafts"]):
    scx, scz = rect_centre(shaft)
    add_light(
        f"QA_Point_Shaft_{index}", (scx, scz, SHAFT_CEILING - 0.4),
        (0.35, 0.7, 0.75), 520,
    )
bloom = LAYOUT["bloomAnchor"]
add_light(
    "QA_Point_Bloom", (bloom["x"], bloom["z"], GALLERY_FLOOR + 2.0),
    (0.4, 0.85, 0.75), 460,
)
approach = LAYOUT["approach"]
add_light(
    "QA_Point_Approach",
    ((approach["minX"] + approach["maxX"]) / 2,
     (approach["minZ"] + approach["maxZ"]) / 2, 1.8),
    (0.3, 0.55, 0.65), 520,
)

# ── QA cameras ──────────────────────────────────────────────────────────────


def look_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def camera_from_plan(name, plan_location, plan_target, lens=24.0):
    location = plan_to_blender(*plan_location[:2], plan_location[2])
    target = plan_to_blender(*plan_target[:2], plan_target[2])
    bpy.ops.object.camera_add(location=location)
    camera = bpy.context.active_object
    camera.name = name
    camera.data.lens = lens
    camera.data.sensor_width = 36
    camera.data.clip_start = 0.05
    camera.data.clip_end = 250
    look_at(camera, target)
    return move_to_collection(camera, COLLECTIONS["QA_ONLY"])


bay = LAYOUT["bayBounds"]
bay_cx = (bay["minX"] + bay["maxX"]) / 2
bay_cz = (bay["minZ"] + bay["maxZ"]) / 2
bpy.ops.object.camera_add(location=(bx(bay_cx), by(bay_cz), 80.0))
camera_plan = bpy.context.active_object
camera_plan.name = "QA_Camera_Plan"
camera_plan.data.type = "ORTHO"
# The bay is much deeper (N-S) than wide, and ortho_scale sets the LONG side
# of a 16:9 frame — fit the depth against the frame's short side.
camera_plan.data.ortho_scale = max(
    bay["maxX"] - bay["minX"],
    (bay["maxZ"] - bay["minZ"]) * (16 / 9),
) + 4
camera_plan.data.clip_end = 250
look_at(camera_plan, Vector((bx(bay_cx), by(bay_cz), 0.0)))
move_to_collection(camera_plan, COLLECTIONS["QA_ONLY"])

landing = LAYOUT["surfacingLanding"]
landing_cx = (landing["minX"] + landing["maxX"]) / 2
landing_cz = (landing["minZ"] + landing["maxZ"]) / 2
LANDING = DATUM["LANDING_Y"]

cameras = {
    "plan": camera_plan,
    "overview": camera_from_plan(
        "QA_Camera_Overview", (bay_cx + 26, bay_cz + 20, 30.0),
        (bay_cx, bay_cz - 6, -1.0), 38,
    ),
    "approach": camera_from_plan(
        "QA_Camera_Approach", (14.0, 69.5, 1.6), (14.0, 58.5, -1.2), 26
    ),
    "descent": camera_from_plan(
        "QA_Camera_Descent", (14.0, 53.2, SHALLOWS + 1.6),
        (13.0, 46.0, GALLERY_FLOOR + 1.0), 24,
    ),
    "bloom": camera_from_plan(
        "QA_Camera_Bloom", (bloom["x"], bloom["z"] + 4.5, GALLERY_FLOOR + 1.6),
        (bloom["x"], bloom["z"] - 4.0, GALLERY_FLOOR + 1.2), 24,
    ),
    "reveal": camera_from_plan(
        "QA_Camera_Reveal", (landing_cx, landing_cz, LANDING + 1.7),
        (landing_cx, 8.0, 0.6), 24,
    ),
    "procession": camera_from_plan(
        "QA_Camera_Procession", (13.25, 12.2, CAUSEWAY + 1.6),
        (13.75, 4.5, SHELF + 1.4), 26,
    ),
    "threshold": camera_from_plan(
        "QA_Camera_Threshold", (24.5, 20.6, CAUSEWAY + 1.6),
        (24.5, 16.8, CAUSEWAY + 1.6), 27,
    ),
}

# ── Render setup ────────────────────────────────────────────────────────────
scene.render.engine = "BLENDER_EEVEE"
# Reflections are the subject of this room, so the QA evidence has to actually
# trace them. Without raytracing the mirror pool renders as a flat dark slab
# and the doubling — the entire point of Water — is invisible in every frame.
try:
    scene.eevee.use_raytracing = True
    scene.eevee.ray_tracing_options.resolution_scale = "1"
except (AttributeError, TypeError) as exc:  # older EEVEE without raytracing
    print(f"EEVEE raytracing unavailable, reflections will not render: {exc}")
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.35
scene.world = bpy.data.worlds.new("Drowned Gallery QA World")
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.004, 0.008, 0.012, 1.0)
background.inputs["Strength"].default_value = 0.12


def object_world_bounds(objects):
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    return {
        "minX": min(p.x for p in points),
        "maxX": max(p.x for p in points),
        "minY": min(p.y for p in points),
        "maxY": max(p.y for p in points),
        "minZ": min(p.z for p in points),
        "maxZ": max(p.z for p in points),
    }


export_meshes = [
    obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith("DG_")
]
export_lights_or_cameras = [
    obj
    for obj in scene.objects
    if obj.name.startswith("DG_") and obj.type in ("LIGHT", "CAMERA")
]
if export_lights_or_cameras:
    raise RuntimeError("DG_ export prefix includes a QA light or camera")
if worm_count < 100:
    raise RuntimeError(f"Glowworm dome is too sparse: {worm_count}")
if set(CONTRACT["collections"]) != {c.name for c in COLLECTIONS.values()}:
    raise RuntimeError("Blender collection contract is incomplete")

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

render_paths = {}
# The shell is one carved solid now, so the lid cannot be stripped by name the
# way a stack of ceiling boxes could. Hide the whole block for the two frames
# that look into the room from outside it; every interior camera keeps it.
CUTAWAY_CAMERAS = {"plan", "overview"}
for name, camera in cameras.items():
    shell_rock.hide_render = name in CUTAWAY_CAMERAS
    scene.camera = camera
    render_path = QA_DIR / f"drowned-gallery-{name}.png"
    scene.render.filepath = str(render_path)
    bpy.ops.render.render(write_still=True)
    render_paths[name] = str(render_path)
shell_rock.hide_render = False

scene.camera = cameras["overview"]
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

# The web GLB carries only DG_ geometry; QA cameras and lights stay in Blender.
# This step used to live outside the repo, which meant the optimizer's input
# could not be regenerated from source — the shell you walked was whatever a
# hand-run export happened to leave behind.
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
    "sourceDigest": SOURCE_DIGEST,
    "schemaVersion": CONTRACT["schemaVersion"],
    "blenderVersion": bpy.app.version_string,
    "blendPath": str(BLEND_PATH),
    "manifestPath": str(MANIFEST_PATH),
    "rawGlbPath": str(RAW_GLB_PATH.relative_to(ROOT)).replace("\\", "/"),
    "shell": SHELL_REPORT,
    "exportPrefix": "DG_",
    "exportMeshCount": len(export_meshes),
    "materialCount": len(bpy.data.materials),
    "glowworms": worm_count,
    "bayBounds": bay,
    "exportObjectBounds": object_world_bounds(export_meshes),
    "collections": sorted(c.name for c in COLLECTIONS.values()),
    "renders": render_paths,
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

print(f"Verified Drowned Gallery source digest: {SOURCE_DIGEST}")
print(f"Saved editable graybox: {BLEND_PATH}")
print(f"Export meshes: {len(export_meshes)}; glowworms: {worm_count}")
print(f"Wrote QA report: {REPORT_PATH}")
for name, path in render_paths.items():
    print(f"Rendered {name:>11}: {path}")
