"""Finish the First Fire graybox into the production shell the museum walks.

Pipeline (each step regenerates the next from source, nothing is hand-edited):

    pnpm exec tsx scripts/export-first-fire-blender-plan.ts
        -> docs/superpowers/specs/first-fire-cinder-court/first-fire-cinder-court-blender-plan.json
    blender --background --factory-startup --python scripts/build-first-fire-graybox.py
        -> blender/first-fire-cinder-court-graybox.blend   (the measured carve; geometry authority)
    blender --background --factory-startup --python scripts/build-first-fire-production.py [-- --fast]
        -> blender/first-fire-cinder-court-production.blend
        -> blender/exports/first-fire-cinder-court.raw.glb
        -> static/models/museum/cave/first-fire-cinder-court.glb   (gltf-transform optimised)
        -> blender/qa/first-fire-production/*.png                  (Cycles views to look at)

What this pass adds to the graybox, and what it deliberately leaves alone:

  * The carved shell is voxel-remeshed on its VOID and displaced along its
    normals, so every arris is rock rather than a boolean edge. The corridor
    from the grotto (the museum's own 2 m passage; both rooms suppress their
    tile geometry) is added to the void before the remesh, so the rock runs
    unbroken from the Water door to the Cinder Court.
  * The shell is split into four rock objects - one per shrine court and one
    for the torch lane and transfers - so each court carries its own baked
    lightmap and the runtime can dim a court to coals, then to nothing, as the
    procession moves on. Every photon in those lightmaps comes from something
    burning: the trench embers, the torch flames, the court keys.
  * Torches are re-placed against the REAL rock with ray casts: wall sconces
    stand off the remeshed surface, floor torches only where no wall is in
    reach. The graybox placed them from nominal corridor widths and they
    floated 0.9 m from the carve (the Gate 2 defect).
  * Performer pads are NOT exported: the museum pedestal standard renders the
    stations at runtime from the plan.

Flags after `--`:  --fast   1024 px lightmaps, 32 samples, no denoise, 2 views
                   --no-render   skip the QA views
                   --skip-optimize   leave the raw GLB only
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import urllib.request
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
GRAYBOX_BLEND = ROOT / "blender" / "first-fire-cinder-court-graybox.blend"
PROD_BLEND = ROOT / "blender" / "first-fire-cinder-court-production.blend"
MANIFEST_PATH = (
    ROOT / "docs" / "superpowers" / "specs" / "first-fire-cinder-court"
    / "first-fire-cinder-court-blender-plan.json"
)
TEX_DIR = ROOT / "blender" / "polyhaven_textures"
RAW_GLB_PATH = ROOT / "blender" / "exports" / "first-fire-cinder-court.raw.glb"
FINAL_GLB_PATH = ROOT / "static" / "models" / "museum" / "cave" / "first-fire-cinder-court.glb"
QA_DIR = ROOT / "blender" / "qa" / "first-fire-production"
REPORT_PATH = (
    ROOT / "docs" / "superpowers" / "specs" / "first-fire-cinder-court"
    / "first-fire-cinder-court-production-report.json"
)

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
FAST = "--fast" in ARGS
RENDER = "--no-render" not in ARGS
OPTIMIZE = "--skip-optimize" not in ARGS

COURT_LIGHTMAP_PX = 1024 if FAST else 2048
LANE_LIGHTMAP_PX = 1024 if FAST else 4096
BAKE_SAMPLES = 32 if FAST else 256
VIEW_SAMPLES = 32 if FAST else 128

# CC0 PolyHaven sets. The walls are dark cracked basalt, the court chambers a
# near-black shale, and the walked floor burned ground: cinders underfoot.
TEXTURE_SETS = {
    "basalt": "dark_rock_02",
    "shale": "dark_rock",
    "cinder": "burned_ground_01",
}
TEXTURE_MAPS = ("diff", "nor_gl", "rough", "ao")
TEXTURE_PERIOD_M = {"basalt": 3.0, "shale": 2.6, "cinder": 2.4}


def log(message: str) -> None:
    print(f"[ff-production] {message}", flush=True)


# ── Source ──────────────────────────────────────────────────────────────────
if not GRAYBOX_BLEND.exists():
    raise RuntimeError(
        f"Missing {GRAYBOX_BLEND}. Run scripts/build-first-fire-graybox.py first."
    )
manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
bpy.ops.wm.open_mainfile(filepath=str(GRAYBOX_BLEND))
scene = bpy.context.scene
if scene.get("first_fire_source_digest") != manifest["sourceDigest"]:
    raise RuntimeError(
        "The graybox blend was built from a different plan than the manifest on "
        "disk. Rebuild the graybox before finishing it."
    )
SOURCE_DIGEST = manifest["sourceDigest"]
CONTRACT = manifest["contract"]
if CONTRACT["coordinateSystem"]["gltfRuntime"]["integrationStatus"] != "compiled-cave-fire-room":
    raise RuntimeError("The production shell must be built from the compiled cave-fire contract")
ROOM = CONTRACT["room"]
BOUNDS = ROOM["blenderBounds"]
CENTRE = ROOM["planCentre"]

for path in (
    PROD_BLEND.parent,
    RAW_GLB_PATH.parent,
    FINAL_GLB_PATH.parent,
    QA_DIR,
    REPORT_PATH.parent,
):
    path.mkdir(parents=True, exist_ok=True)


# ── Textures ────────────────────────────────────────────────────────────────
def texture_path(set_key: str, map_key: str) -> Path:
    asset = TEXTURE_SETS[set_key]
    return TEX_DIR / asset / f"{asset}_{map_key}_2k.jpg"


for set_key, asset in TEXTURE_SETS.items():
    for map_key in TEXTURE_MAPS:
        target = texture_path(set_key, map_key)
        if target.exists() and target.stat().st_size > 0:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{asset}/{target.name}"
        log(f"downloading {url}")
        urllib.request.urlretrieve(url, target)


def load_image(set_key: str, map_key: str) -> bpy.types.Image:
    path = texture_path(set_key, map_key)
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = "sRGB" if map_key == "diff" else "Non-Color"
    return image


# ── GPU ─────────────────────────────────────────────────────────────────────
def enable_gpu() -> str:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for device_type in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = device_type
            prefs.get_devices()
        except Exception as exc:  # noqa: BLE001
            log(f"{device_type} unavailable: {exc}")
            continue
        gpus = [d for d in prefs.devices if d.type == device_type]
        if not gpus:
            continue
        for device in prefs.devices:
            device.use = device.type == device_type
        scene.cycles.device = "GPU"
        return device_type
    scene.cycles.device = "CPU"
    return "CPU"


scene.render.engine = "CYCLES"
COMPUTE = enable_gpu()
log(f"Cycles device: {COMPUTE}")
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 2
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False


# ── Objects ─────────────────────────────────────────────────────────────────
def objects_with_prefix(prefix: str) -> list[bpy.types.Object]:
    return [o for o in scene.objects if o.type == "MESH" and o.name.startswith(prefix)]


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def triangle_count(obj) -> int:
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def remove_objects(objs) -> int:
    for obj in list(objs):
        bpy.data.objects.remove(obj, do_unlink=True)
    return len(objs)


shell = bpy.data.objects["FF_Shell_Rock"]
# The graybox's flat route ribbons and steam slab were a plan drawn on the
# floor. The finished floor IS the route: burned ground where the visitor
# walks, and the torches say where to go. The pedestal standard renders the
# performer pads at runtime, and the QA lights are replaced below by the fires.
removed = {
    "routeRibbons": remove_objects(objects_with_prefix("FF_Route_")),
    "steamThreshold": remove_objects(objects_with_prefix("FF_Steam_Threshold")),
    "performerPads": remove_objects(objects_with_prefix("FF_PerformerPad_")),
    "qaLights": remove_objects([o for o in scene.objects if o.type == "LIGHT"]),
}
log(f"removed graybox-only objects: {removed}")

bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object else None
select_only([shell])
outer = [shell.matrix_world @ Vector(c) for c in shell.bound_box]
bounds = {
    "minX": min(p.x for p in outer),
    "maxX": max(p.x for p in outer),
    "minY": min(p.y for p in outer),
    "maxY": max(p.y for p in outer),
    "minZ": min(p.z for p in outer),
    "maxZ": max(p.z for p in outer),
}
log(f"shell block {bounds}")


def add_cube(name, centre, dims):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=centre)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


# ── Shell: from boolean solid to rock ───────────────────────────────────────
# Same trick as the Drowned Gallery: the voxel remesher discards enclosed
# cavities, so the remesh runs on the VOID (block minus shell), whose surface
# is the rock surface, and the normals are flipped afterwards.
RIM = 0.01
void = add_cube(
    "FF_Void_Solid",
    (
        (bounds["minX"] + bounds["maxX"]) / 2,
        (bounds["minY"] + bounds["maxY"]) / 2,
        (bounds["minZ"] + bounds["maxZ"]) / 2,
    ),
    (
        bounds["maxX"] - bounds["minX"] - RIM * 2,
        bounds["maxY"] - bounds["minY"] - RIM * 2,
        bounds["maxZ"] - bounds["minZ"] - RIM * 2,
    ),
)
carve = void.modifiers.new("Void", "BOOLEAN")
carve.operation = "DIFFERENCE"
carve.solver = "EXACT"
carve.use_hole_tolerant = True
carve.object = shell
bpy.ops.object.modifier_apply(modifier="Void")
log(f"void solid: {len(void.data.polygons)} faces")

# The approach corridor from the grotto. The museum's own 2 m passage between
# the Water and Fire doors is drawn by neither room's tiles (both suppress
# their tile geometry), so the rock has to run along it. Its rects are added
# to the void before the remesh; the far end at the grotto door is opened
# with the other skin caps below. Floor a hair under the datum so it meets
# the sunk cinder floor (FLOOR_SINK) without a step.
CORRIDOR = CONTRACT["approachCorridor"]
FLOOR_SINK = 0.12
corridor_parts = []
if CORRIDOR:
    for index, rect in enumerate(CORRIDOR["blenderRects"]):
        z0 = -FLOOR_SINK
        z1 = CORRIDOR["clearance"]
        corridor_parts.append(
            add_cube(
                f"FF_Void_Corridor_{index:02d}",
                (rect["centre"]["x"], rect["centre"]["y"], (z0 + z1) / 2),
                (rect["sizeX"] + 0.02, rect["sizeY"] + 0.02, z1 - z0),
            )
        )
# The skin the caps are cut from is the BLOCK's, widened by the corridor:
# the void's own bbox hugs the outermost room walls, and cutting there would
# take the north wall of the DJ court with it (14k faces, first run).
union_bounds = dict(bounds)
for part in corridor_parts:
    corners = [part.matrix_world @ Vector(c) for c in part.bound_box]
    union_bounds["minX"] = min(union_bounds["minX"], min(p.x for p in corners))
    union_bounds["maxX"] = max(union_bounds["maxX"], max(p.x for p in corners))
    union_bounds["minY"] = min(union_bounds["minY"], min(p.y for p in corners))
    union_bounds["maxY"] = max(union_bounds["maxY"], max(p.y for p in corners))
select_only([void, *corridor_parts])
bpy.ops.object.join()
void = bpy.context.view_layer.objects.active
# Local space IS world space from here: the BVH casts and the split below
# read local coordinates, and the cube primitive left its origin mid-block.
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

remesh = void.modifiers.new("Remesh", "REMESH")
remesh.mode = "VOXEL"
remesh.voxel_size = 0.30
remesh.adaptivity = 0.0
remesh.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier="Remesh")
log(f"void remeshed: {len(void.data.polygons)} faces")

# The void's outside is the rock's inside.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.flip_normals()
bpy.ops.object.mode_set(mode="OBJECT")

shell_collections = list(shell.users_collection)
bpy.data.objects.remove(shell, do_unlink=True)
void.name = "FF_Shell_Rock"
for collection in list(void.users_collection):
    collection.objects.unlink(void)
for collection in shell_collections:
    collection.objects.link(void)
shell = void

# Drop the caps where the void meets the outside: the Earth door on the east
# skin and the grotto end of the approach corridor on the west. Everything
# else the void touches is rock.
SKIN_TOLERANCE = 0.45
bm = bmesh.new()
bm.from_mesh(shell.data)
bm.faces.ensure_lookup_table()
mw = shell.matrix_world
doomed = []
for face in bm.faces:
    c = mw @ face.calc_center_median()
    if (
        c.x < union_bounds["minX"] + SKIN_TOLERANCE
        or c.x > union_bounds["maxX"] - SKIN_TOLERANCE
        or c.y < union_bounds["minY"] + SKIN_TOLERANCE
        or c.y > union_bounds["maxY"] - SKIN_TOLERANCE
        or c.z < union_bounds["minZ"] + SKIN_TOLERANCE
        or c.z > union_bounds["maxZ"] - SKIN_TOLERANCE
    ):
        doomed.append(face)
bmesh.ops.delete(bm, geom=doomed, context="FACES")
bm.to_mesh(shell.data)
bm.free()
shell.data.update()
log(f"shell skin removed: {len(doomed)} caps, {len(shell.data.polygons)} faces left")

# Relief weight: full on walls and vaults, gentle on anything that faces up.
# A second group sinks the floor a hand's width under the museum datum, so the
# court slabs, trench rings and torch feet sit ON the rock instead of in it,
# and the voxel's own +-0.15 m never lifts the floor above the visitor's feet.
relief = shell.vertex_groups.new(name="Relief")
floor_group = shell.vertex_groups.new(name="Floor")
for vertex in shell.data.vertices:
    up = vertex.normal.z
    t = min(1.0, max(0.0, (up - 0.35) / 0.4))
    relief.add([vertex.index], 1.0 - t * 0.7, "REPLACE")
    f = min(1.0, max(0.0, (up - 0.5) / 0.35))
    floor_group.add([vertex.index], f * f * (3 - 2 * f), "REPLACE")

coarse_tex = bpy.data.textures.new("FF_Relief_Coarse", "CLOUDS")
coarse_tex.noise_scale = 2.4
coarse_tex.noise_depth = 2
coarse_tex.noise_basis = "IMPROVED_PERLIN"
mid_tex = bpy.data.textures.new("FF_Relief_Mid", "CLOUDS")
mid_tex.noise_scale = 1.1
mid_tex.noise_depth = 2
mid_tex.noise_basis = "BLENDER_ORIGINAL"
fine_tex = bpy.data.textures.new("FF_Relief_Fine", "CLOUDS")
fine_tex.noise_scale = 0.75
fine_tex.noise_depth = 3
fine_tex.noise_basis = "VORONOI_F1"

for name, tex, strength in (
    ("Relief", coarse_tex, 0.22),
    ("ReliefMid", mid_tex, 0.10),
    ("ReliefFine", fine_tex, 0.05),
):
    mod = shell.modifiers.new(name, "DISPLACE")
    mod.texture = tex
    mod.texture_coords = "GLOBAL"
    mod.direction = "NORMAL"
    mod.mid_level = 0.5
    mod.strength = strength
    mod.vertex_group = "Relief"
    bpy.ops.object.modifier_apply(modifier=name)

sink = shell.modifiers.new("FloorSink", "DISPLACE")
sink.direction = "Z"
sink.mid_level = 0.0
sink.strength = -FLOOR_SINK
sink.vertex_group = "Floor"
bpy.ops.object.modifier_apply(modifier="FloorSink")

SHELL_TRI_BUDGET = 260_000
tris = triangle_count(shell)
if tris > SHELL_TRI_BUDGET:
    dec = shell.modifiers.new("Decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = SHELL_TRI_BUDGET / tris
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="Decimate")
bpy.ops.object.shade_smooth()
log(f"shell final: {triangle_count(shell)} tris")


# ── Torches against the real rock ───────────────────────────────────────────
# The graybox scattered its stems from nominal corridor widths and they stood
# 0.9 m off the carve. Now the rock exists: cast round each stem, and where a
# wall is in reach stand the torch against it; where none is, it stays a
# floor torch on the lane. Every stem's foot is then dropped onto the floor.
from mathutils.bvhtree import BVHTree

depsgraph = bpy.context.evaluated_depsgraph_get()
shell_bvh = BVHTree.FromObject(shell, depsgraph)
WALL_REACH = 1.9
STANDOFF = 0.42
RAY_HEIGHT = 1.1
torch_report = {"wallMounted": 0, "floorStanding": 0, "unmoved": 0}


def floor_under(x: float, y: float, fallback: float) -> float:
    hit = shell_bvh.ray_cast(Vector((x, y, 1.6)), Vector((0, 0, -1)), 4.0)
    return hit[0].z if hit[0] is not None else fallback


def nearest_wall(x: float, y: float):
    best = None
    origin = Vector((x, y, RAY_HEIGHT))
    for step in range(24):
        angle = step * math.tau / 24
        direction = Vector((math.cos(angle), math.sin(angle), 0.0))
        location, normal, _index, distance = shell_bvh.ray_cast(origin, direction, WALL_REACH)
        if location is None or abs(normal.z) > 0.55:
            continue
        if best is None or distance < best[2]:
            inward = normal if normal.dot(direction) < 0 else -normal
            best = (location, inward, distance)
    return best


stems = objects_with_prefix("FF_TorchStem_")
for stem in stems:
    suffix = stem.name[len("FF_TorchStem_"):]
    flame = bpy.data.objects.get(f"FF_FlameGuide_{suffix}")
    if flame is None:
        torch_report["unmoved"] += 1
        continue
    height = stem.dimensions.z
    x, y = stem.location.x, stem.location.y
    wall = nearest_wall(x, y)
    if wall is not None:
        target = wall[0] + wall[1] * STANDOFF
        x, y = target.x, target.y
        torch_report["wallMounted"] += 1
    else:
        torch_report["floorStanding"] += 1
    floor_z = floor_under(x, y, -FLOOR_SINK)
    stem.location = (x, y, floor_z + height / 2)
    flame.location = (x, y, floor_z + height * 0.92)
log(f"torches: {torch_report}")

# ── One rock, four objects ──────────────────────────────────────────────────
# Each shrine court carries its own lightmap so the runtime can take a court
# down to coals, and then to nothing, while the lane and the other courts keep
# their light. A face belongs to the court whose shrine is within COURT_REACH
# of it; everything else is the torch lane and its transfers.
COURT_REACH = 10.5
court_ids = [shrine["id"] for shrine in CONTRACT["shrines"]]
court_centres = {
    shrine["id"]: Vector((shrine["blenderCentre"]["x"], shrine["blenderCentre"]["y"]))
    for shrine in CONTRACT["shrines"]
}
split_names = ["lane", *court_ids]
shell.data.materials.clear()
for name in split_names:
    shell.data.materials.append(bpy.data.materials.new(f"FF split {name}"))
bm = bmesh.new()
bm.from_mesh(shell.data)
for face in bm.faces:
    centre = face.calc_center_median()
    xy = Vector((centre.x, centre.y))
    nearest = min(court_ids, key=lambda cid: (court_centres[cid] - xy).length)
    if (court_centres[nearest] - xy).length <= COURT_REACH:
        face.material_index = 1 + court_ids.index(nearest)
    else:
        face.material_index = 0
bm.to_mesh(shell.data)
bm.free()
shell.data.update()
assigned = {name: 0 for name in split_names}
for poly in shell.data.polygons:
    assigned[split_names[poly.material_index]] += 1
log(f"rock faces by court: {assigned}")
if min(assigned.values()) == 0:
    raise RuntimeError(f"a court received no rock faces: {assigned}")
select_only([shell])
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="MATERIAL")
bpy.ops.object.mode_set(mode="OBJECT")

rock_objects: dict[str, bpy.types.Object] = {}
pieces = [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("FF_Shell_Rock")]
log("split pieces: " + ", ".join(
    f"{o.name}[{sorted({p.material_index for p in o.data.polygons})}]" for o in pieces))
for obj in pieces:
    if len(obj.data.polygons) == 0:
        raise RuntimeError(f"{obj.name} came out of the split with no faces")
    # Separate-by-material leaves each piece with just its own slot, so the
    # polygon material_index is 0 everywhere: identify the piece by slot name.
    slot = obj.material_slots[obj.data.polygons[0].material_index].material
    key = slot.name.removeprefix("FF split ")
    if key not in split_names:
        raise RuntimeError(f"{obj.name} carries unexpected material {slot.name}")
    obj.name = f"FF_Rock_{key.upper() if key != 'lane' else 'Lane'}"
    obj.data.name = obj.name
    obj.data.materials.clear()
    rock_objects[key] = obj
if set(rock_objects) != set(split_names):
    raise RuntimeError(f"shell split produced {sorted(rock_objects)}, expected {split_names}")
for name in split_names:
    bpy.data.materials.remove(bpy.data.materials[f"FF split {name}"])
log("rock split: " + ", ".join(f"{k} {triangle_count(o)} tris" for k, o in rock_objects.items()))

# ── Court stone: the slab and the orbit ring, one object per court ──────────
court_stone: dict[str, bpy.types.Object] = {}
for cid in court_ids:
    parts = [bpy.data.objects[f"FF_Court_{cid}"], bpy.data.objects[f"FF_Orbit_{cid}"]]
    select_only(parts)
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = f"FF_CourtStone_{cid.upper()}"
    obj.data.name = obj.name
    bevel = obj.modifiers.new("Bevel", "BEVEL")
    bevel.width = 0.02
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(50)
    bpy.ops.object.modifier_apply(modifier="Bevel")
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    court_stone[cid] = obj

# Every trench gets its own material so the runtime can cool one court's
# embers by name while the next court still burns.
TRENCH_EMBER_COLOUR = {
    "dj": (1.0, 0.16, 0.02, 1.0),
    "ek": (1.0, 0.24, 0.04, 1.0),
    "fl": (1.0, 0.10, 0.01, 1.0),
}
trench_objects: dict[str, bpy.types.Object] = {}
for cid in court_ids:
    obj = bpy.data.objects[f"FF_Trench_{cid}"]
    # The three rings are linked duplicates of one mesh datablock: give each
    # its own before touching the slots, or the last court's material lands
    # on all three and the optimiser folds them into one instanced ring.
    obj.data = obj.data.copy()
    obj.data.name = f"FF_Trench_{cid}_Mesh"
    base = bpy.data.materials["FF Trench Ember"]
    mat = base.copy()
    mat.name = f"FF Trench Ember {cid.upper()}"
    # Each court's embers burn their own colour. This also keeps the three
    # materials distinct under gltf-transform's dedup, which folds
    # byte-identical materials into one and would hand every trench to DJ.
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Emission Color"].default_value = TRENCH_EMBER_COLOUR[cid]
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    trench_objects[cid] = obj


# ── UVs ─────────────────────────────────────────────────────────────────────
def unwrap(obj, margin=0.002) -> float:
    """Smart-project one UV layer and return metres per UV unit."""
    select_only([obj])
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66),
        island_margin=margin,
        area_weight=0.0,
        correct_aspect=True,
        scale_to_bounds=False,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    mesh = obj.data
    uv = mesh.uv_layers.active.data
    world_area = 0.0
    uv_area = 0.0
    for poly in mesh.polygons:
        world_area += poly.area
        loops = [uv[i].uv for i in poly.loop_indices]
        acc = 0.0
        for i in range(len(loops)):
            a, b = loops[i], loops[(i + 1) % len(loops)]
            acc += a.x * b.y - b.x * a.y
        uv_area += abs(acc) / 2
    if uv_area <= 1e-9:
        raise RuntimeError(f"{obj.name}: unwrap produced no UV area")
    return math.sqrt(world_area / uv_area)


m_per_uv: dict[str, float] = {}
for key, obj in rock_objects.items():
    m_per_uv[f"rock-{key}"] = unwrap(obj, margin=0.0015 if key == "lane" else 0.002)
for cid, obj in court_stone.items():
    m_per_uv[f"stone-{cid}"] = unwrap(obj, margin=0.004)
log("UV density " + ", ".join(f"{k} {v:.1f} m/uv" for k, v in m_per_uv.items()))


# ── Materials ───────────────────────────────────────────────────────────────
def new_material(name: str):
    # Blender appends ".001" on a name collision and the runtime looks its
    # materials up by exact name, so the authoring material moves aside first.
    existing = bpy.data.materials.get(name)
    if existing is not None:
        existing.name = f"{name} (authoring)"
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat, tree, bsdf


def box_texture(tree, set_key, map_key, scale):
    node = tree.nodes.new("ShaderNodeTexImage")
    node.image = load_image(set_key, map_key)
    node.projection = "BOX"
    node.projection_blend = 0.3
    node.interpolation = "Linear"
    coords = tree.nodes.new("ShaderNodeTexCoord")
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    tree.links.new(coords.outputs["Object"], mapping.inputs["Vector"])
    tree.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
    return node


def rgb_mix(tree, blend_type="MIX"):
    node = tree.nodes.new("ShaderNodeMix")
    node.data_type = "RGBA"
    node.blend_type = blend_type
    return node


def bake_material(name, wall_set, floor_set, lightmap_image, wall_tint=(1, 1, 1), floor_tint=(1, 1, 1)):
    """Box-projected PBR for the bake: one set on the walls and vault, another
    on whatever faces up (the walked cinder), each with its own tint. No wet
    zone and no algae: this is a dry room. The active node is the lightmap."""
    mat, tree, bsdf = new_material(name)
    links = tree.links
    wall_scale = 1.0 / TEXTURE_PERIOD_M[wall_set]
    floor_scale = 1.0 / TEXTURE_PERIOD_M[floor_set]

    def pbr(set_key, scale, tint_rgb):
        diff = box_texture(tree, set_key, "diff", scale)
        nor = box_texture(tree, set_key, "nor_gl", scale)
        rough = box_texture(tree, set_key, "rough", scale)
        ao = box_texture(tree, set_key, "ao", scale)
        colour = rgb_mix(tree, "MULTIPLY")
        colour.inputs["Factor"].default_value = 0.8
        links.new(diff.outputs["Color"], colour.inputs[6])
        links.new(ao.outputs["Color"], colour.inputs[7])
        tint = rgb_mix(tree, "MULTIPLY")
        tint.inputs["Factor"].default_value = 1.0
        links.new(colour.outputs[2], tint.inputs[6])
        tint.inputs[7].default_value = (*tint_rgb, 1.0)
        return tint.outputs[2], nor.outputs["Color"], rough.outputs["Color"]

    wall_c, wall_n, wall_r = pbr(wall_set, wall_scale, wall_tint)
    floor_c, floor_n, floor_r = pbr(floor_set, floor_scale, floor_tint)

    geometry = tree.nodes.new("ShaderNodeNewGeometry")
    sep = tree.nodes.new("ShaderNodeSeparateXYZ")
    links.new(geometry.outputs["Normal"], sep.inputs["Vector"])
    up = tree.nodes.new("ShaderNodeMapRange")
    up.inputs["From Min"].default_value = 0.45
    up.inputs["From Max"].default_value = 0.8
    links.new(sep.outputs["Z"], up.inputs["Value"])

    def mix_by_up(a, b):
        node = rgb_mix(tree)
        links.new(up.outputs["Result"], node.inputs["Factor"])
        links.new(a, node.inputs[6])
        links.new(b, node.inputs[7])
        return node.outputs[2]

    links.new(mix_by_up(wall_c, floor_c), bsdf.inputs["Base Color"])
    links.new(mix_by_up(wall_r, floor_r), bsdf.inputs["Roughness"])
    normal_map = tree.nodes.new("ShaderNodeNormalMap")
    normal_map.space = "OBJECT"
    normal_map.inputs["Strength"].default_value = 0.8
    links.new(mix_by_up(wall_n, floor_n), normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    target = tree.nodes.new("ShaderNodeTexImage")
    target.image = lightmap_image
    target.select = True
    tree.nodes.active = target
    return mat


def export_material(name, set_key, lightmap_image, m_per_uv_value, albedo=(0.55, 0.55, 0.55)):
    """What the GLB carries: tiled albedo + normal + roughness on UVMap with a
    KHR_texture_transform repeat, and the lightmap on Emission at 1.0."""
    mat, tree, bsdf = new_material(name)
    links = tree.links
    repeat = m_per_uv_value / TEXTURE_PERIOD_M[set_key]
    uv = tree.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.vector_type = "POINT"
    mapping.inputs["Scale"].default_value = (repeat, repeat, 1.0)
    links.new(uv.outputs["UV"], mapping.inputs["Vector"])

    def tiled(map_key):
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = load_image(set_key, map_key)
        links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    diff = tiled("diff")
    darken = rgb_mix(tree, "MULTIPLY")
    darken.inputs["Factor"].default_value = 1.0
    links.new(diff.outputs["Color"], darken.inputs[6])
    darken.inputs[7].default_value = (*albedo, 1.0)
    links.new(darken.outputs[2], bsdf.inputs["Base Color"])
    rough = tiled("rough")
    links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    nor = tiled("nor_gl")
    normal_map = tree.nodes.new("ShaderNodeNormalMap")
    normal_map.uv_map = "UVMap"
    normal_map.inputs["Strength"].default_value = 0.9
    links.new(nor.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    lm = tree.nodes.new("ShaderNodeTexImage")
    lm.image = lightmap_image
    lm_uv = tree.nodes.new("ShaderNodeUVMap")
    lm_uv.uv_map = "UVMap"
    links.new(lm_uv.outputs["UV"], lm.inputs["Vector"])
    links.new(lm.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    return mat


def new_lightmap(name, size):
    image = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "sRGB"
    image.generated_color = (0, 0, 0, 1)
    return image


lightmaps: dict[str, bpy.types.Image] = {}
bake_targets: list[tuple[str, bpy.types.Object, bpy.types.Image]] = []
for key, obj in rock_objects.items():
    px = LANE_LIGHTMAP_PX if key == "lane" else COURT_LIGHTMAP_PX
    image = new_lightmap(f"FF_Rock_{key}_Lightmap", px)
    lightmaps[f"rock-{key}"] = image
    if key == "lane":
        mat = bake_material("FF Rock Lane (bake)", "basalt", "cinder", image,
                            wall_tint=(0.9, 0.86, 0.84), floor_tint=(0.8, 0.74, 0.7))
    else:
        mat = bake_material(f"FF Rock {key.upper()} (bake)", "shale", "cinder", image,
                            wall_tint=(0.95, 0.9, 0.88), floor_tint=(0.82, 0.76, 0.72))
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bake_targets.append((f"rock-{key}", obj, image))
for cid, obj in court_stone.items():
    image = new_lightmap(f"FF_CourtStone_{cid}_Lightmap", 1024)
    lightmaps[f"stone-{cid}"] = image
    mat = bake_material(f"FF Court Stone {cid.upper()} (bake)", "shale", "shale", image,
                        wall_tint=(0.7, 0.62, 0.58), floor_tint=(0.72, 0.62, 0.56))
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bake_targets.append((f"stone-{cid}", obj, image))

# ── Bake lighting: every photon from something burning ─────────────────────
# The QA point lights are gone. What lights the bake is a point light in each
# torch flame, a ring of them in each ember trench, and the emissive meshes
# themselves; the water threshold at the west door is the one cool source.
world = scene.world
world.use_nodes = True
background = world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.012, 0.006, 0.005, 1.0)
background.inputs["Strength"].default_value = 0.25

FLAME_COLOUR = {
    "field": (1.0, 0.52, 0.18),
    "dj": (1.0, 0.5, 0.16),
    "ek": (1.0, 0.6, 0.22),
    "fl": (1.0, 0.36, 0.1),
}
bake_lights: list[bpy.types.Object] = []


def bake_light(name, location, colour, energy, radius):
    data = bpy.data.lights.new(name, "POINT")
    data.color = colour
    data.energy = energy
    data.shadow_soft_size = radius
    data.use_shadow = True
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    scene.collection.objects.link(obj)
    bake_lights.append(obj)
    return obj


for flame in objects_with_prefix("FF_FlameGuide_"):
    category = flame.name.split("_")[2]
    bake_light(
        f"BAKE_{flame.name}",
        (flame.location.x, flame.location.y, flame.location.z + 0.18),
        FLAME_COLOUR.get(category, FLAME_COLOUR["field"]), 55.0, 0.12,
    )
for shrine in CONTRACT["shrines"]:
    radius = (shrine["trenchInnerRadius"] + shrine["trenchOuterRadius"]) / 2
    cx, cy = shrine["blenderCentre"]["x"], shrine["blenderCentre"]["y"]
    for step in range(10):
        angle = step * math.tau / 10
        bake_light(
            f"BAKE_Trench_{shrine['id']}_{step:02d}",
            (cx + math.cos(angle) * radius, cy + math.sin(angle) * radius, 0.14),
            (1.0, 0.22, 0.03), 34.0, 0.25,
        )
log(f"bake lights: {len(bake_lights)}")


def set_emission(mat_name: str, strength: float) -> None:
    mat = bpy.data.materials.get(mat_name)
    node = mat.node_tree.nodes.get("Principled BSDF") if mat and mat.node_tree else None
    if node:
        node.inputs["Emission Strength"].default_value = strength


BAKE_EMISSION = {
    "FF Field Flame Guide": 14.0, "FF DJ Flame Guide": 14.0,
    "FF EK Flame Guide": 14.0, "FF FL Flame Guide": 14.0,
    "FF Coal Memory": 0.6, "FF Water Threshold": 2.5,
}
for cid in court_ids:
    BAKE_EMISSION[f"FF Trench Ember {cid.upper()}"] = 7.0
for mat_name, strength in BAKE_EMISSION.items():
    set_emission(mat_name, strength)

# The guides bake in the same warm colour as the torch lights. The graybox
# gave them a crimson emission, and baked through the dark rock that became
# a lava-red floor under an amber flame: two fires in one cave.
GUIDE_MATERIAL = {"field": "FF Field Flame Guide", "dj": "FF DJ Flame Guide",
                  "ek": "FF EK Flame Guide", "fl": "FF FL Flame Guide"}
for category, mat_name in GUIDE_MATERIAL.items():
    mat = bpy.data.materials.get(mat_name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat and mat.node_tree else None
    if bsdf is None:
        raise RuntimeError(f"guide material {mat_name} has no Principled BSDF")
    bsdf.inputs["Emission Color"].default_value = (*FLAME_COLOUR[category], 1.0)

# The green growth is a runtime reveal: it must not light the bake.
growth_objects = objects_with_prefix("FF_Growth_")
for obj in growth_objects:
    obj.hide_render = True


def bake(obj, image, samples):
    select_only([obj])
    scene.cycles.samples = samples
    settings = scene.render.bake
    settings.target = "IMAGE_TEXTURES"
    settings.use_pass_direct = True
    settings.use_pass_indirect = True
    settings.use_pass_color = True
    settings.use_pass_emit = True
    settings.use_pass_diffuse = True
    settings.use_pass_glossy = False
    settings.use_pass_transmission = False
    settings.margin = 6 if image.size[0] <= 1024 else 12
    settings.margin_type = "ADJACENT_FACES"
    settings.use_clear = True
    log(f"baking {obj.name} -> {image.name} {image.size[0]}px @ {samples} spp")
    bpy.ops.object.bake(type="COMBINED")
    path = QA_DIR / f"{image.name}.png"
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    return path


def denoise(image, path: Path) -> bpy.types.Image:
    """OIDN through the compositor, since Cycles does not denoise bakes."""
    if FAST:
        return image
    tmp = bpy.data.scenes.new("FF_Denoise")
    tree = bpy.data.node_groups.new("FF_Denoise_Tree", "CompositorNodeTree")
    tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    tmp.compositing_node_group = tree
    if hasattr(tmp, "use_nodes"):
        tmp.use_nodes = True
    src = tree.nodes.new("CompositorNodeImage")
    src.image = image
    dn = tree.nodes.new("CompositorNodeDenoise")
    if "HDR" in dn.inputs:
        dn.inputs["HDR"].default_value = False
    out = tree.nodes.new("NodeGroupOutput")
    tree.links.new(src.outputs["Image"], dn.inputs["Image"])
    tree.links.new(dn.outputs["Image"], out.inputs[0])
    tmp.render.resolution_x = image.size[0]
    tmp.render.resolution_y = image.size[1]
    tmp.render.resolution_percentage = 100
    tmp.render.image_settings.file_format = "PNG"
    tmp.render.image_settings.color_mode = "RGB"
    tmp.view_settings.view_transform = "Standard"
    tmp.render.engine = "BLENDER_EEVEE"
    tmp.render.filepath = str(path)
    try:
        bpy.ops.render.render(write_still=True, scene=tmp.name)
    except Exception as exc:  # noqa: BLE001
        log(f"denoise failed, keeping the raw bake: {exc}")
        bpy.data.scenes.remove(tmp)
        bpy.data.node_groups.remove(tree)
        return image
    bpy.data.scenes.remove(tmp)
    bpy.data.node_groups.remove(tree)
    clean = bpy.data.images.load(str(path), check_existing=False)
    clean.name = image.name + "_dn"
    clean.colorspace_settings.name = "sRGB"
    log(f"denoised {image.name}")
    return clean


final_lightmaps: dict[str, bpy.types.Image] = {}
for key, obj, image in bake_targets:
    samples = BAKE_SAMPLES if key.startswith("rock") else max(32, BAKE_SAMPLES // 2)
    bake(obj, image, samples)
    final_lightmaps[key] = denoise(image, QA_DIR / f"{image.name}_dn.png")
for image in final_lightmaps.values():
    image.pack()

# ── Swap to export materials ────────────────────────────────────────────────
for key, obj in rock_objects.items():
    label = "Lane" if key == "lane" else key.upper()
    mat = export_material(
        f"FF Rock {label}", "basalt" if key == "lane" else "shale",
        final_lightmaps[f"rock-{key}"], m_per_uv[f"rock-{key}"], albedo=(0.5, 0.48, 0.47),
    )
    obj.data.materials.clear()
    obj.data.materials.append(mat)
for cid, obj in court_stone.items():
    mat = export_material(
        f"FF Court Stone {cid.upper()}", "shale",
        final_lightmaps[f"stone-{cid}"], m_per_uv[f"stone-{cid}"], albedo=(0.5, 0.44, 0.4),
    )
    obj.data.materials.clear()
    obj.data.materials.append(mat)

# Export strengths: the runtime tunes every lightmap-less emissive by name
# (FirstFireAuthored.svelte), so they ship at unity.
for mat_name in BAKE_EMISSION:
    set_emission(mat_name, 1.0)
for obj in bake_lights:
    bpy.data.objects.remove(obj, do_unlink=True)
bake_lights.clear()
for obj in growth_objects:
    obj.hide_render = False

# ── QA views ────────────────────────────────────────────────────────────────
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.4
scene.cycles.samples = VIEW_SAMPLES
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = "OPTIX" if COMPUTE == "OPTIX" else "OPENIMAGEDENOISE"
except TypeError:
    pass

# The QA views are lit by the same fires the bake saw, so they show the room
# as the lightmaps carry it; the export emissives are back at unity, so the
# flames themselves read dim here. What matters in these frames is the rock.
for mat_name, strength in BAKE_EMISSION.items():
    set_emission(mat_name, strength)
for flame in objects_with_prefix("FF_FlameGuide_"):
    category = flame.name.split("_")[2]
    bake_light(f"VIEW_{flame.name}", (flame.location.x, flame.location.y, flame.location.z + 0.18),
               FLAME_COLOUR.get(category, FLAME_COLOUR["field"]), 55.0, 0.12)

render_paths: dict[str, str] = {}
VIEWS = ["ember-bridge", "dj-threshold"] if FAST else [
    "water-entry", "ember-bridge", "dj-threshold", "ek-threshold",
    "fl-threshold", "earth-reveal", "overview", "plan",
]
if RENDER:
    for view_id in VIEWS:
        spec = next((c for c in CONTRACT["cameras"] if c["id"] == view_id), None)
        camera = bpy.data.objects.get(spec["name"]) if spec else None
        if camera is None:
            log(f"no camera for view {view_id}")
            continue
        for obj in growth_objects:
            obj.hide_render = view_id not in {"earth-reveal", "plan"}
        for obj in rock_objects.values():
            obj.hide_render = view_id == "overview"
        scene.camera = camera
        path = QA_DIR / f"first-fire-{view_id}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        render_paths[view_id] = str(path)
        log(f"rendered {view_id}")
for obj in (*growth_objects, *rock_objects.values()):
    obj.hide_render = False
for mat_name in BAKE_EMISSION:
    set_emission(mat_name, 1.0)
for obj in bake_lights:
    bpy.data.objects.remove(obj, do_unlink=True)

# ── Export ──────────────────────────────────────────────────────────────────
export_objects = [
    *rock_objects.values(),
    *court_stone.values(),
    *trench_objects.values(),
    *objects_with_prefix("FF_Water_Threshold"),
    *objects_with_prefix("FF_Guide_"),
    *growth_objects,
    *objects_with_prefix("FF_TorchStem_"),
    *objects_with_prefix("FF_FlameGuide_"),
]
if any(o.type != "MESH" for o in export_objects):
    raise RuntimeError("a non-mesh leaked into the FF_ export set")
for mat in bpy.data.materials:
    if mat.name in {o.data.materials[0].name for o in export_objects if o.data.materials}:
        node = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
        if node and node.inputs["Metallic"].default_value > 0:
            raise RuntimeError(f"{mat.name} is metallic; the museum has no environment map")

bpy.ops.wm.save_as_mainfile(filepath=str(PROD_BLEND))

select_only(export_objects)
bpy.ops.export_scene.gltf(
    filepath=str(RAW_GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
)
raw_size = RAW_GLB_PATH.stat().st_size
log(f"raw GLB {raw_size / 1e6:.1f} MB -> {RAW_GLB_PATH}")

final_size = None
if OPTIMIZE:
    cli = ROOT / "node_modules" / "@gltf-transform" / "cli" / "bin" / "cli.js"
    command = [
        "node", str(cli), "optimize", str(RAW_GLB_PATH), str(FINAL_GLB_PATH),
        "--texture-compress", "webp", "--texture-size", str(LANE_LIGHTMAP_PX),
        "--compress", "draco", "--simplify", "false",
        # The runtime tunes and drives the untextured emissives BY NAME and
        # reads a flame anchor off EVERY guide node: the palette pass would
        # fold those materials into one atlas material, and instance/join
        # would collapse the sixty guides into four nodes.
        "--palette", "false", "--instance", "false", "--join", "false",
    ]
    log("optimising: " + " ".join(command))
    result = subprocess.run(command, capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        log(result.stdout[-2000:])
        log(result.stderr[-2000:])
        raise RuntimeError("gltf-transform optimize failed")
    final_size = FINAL_GLB_PATH.stat().st_size
    log(f"final GLB {final_size / 1e6:.1f} MB -> {FINAL_GLB_PATH}")

report = {
    "sourceDigest": SOURCE_DIGEST,
    "blenderVersion": bpy.app.version_string,
    "computeDevice": COMPUTE,
    "fast": FAST,
    "removedGrayboxObjects": removed,
    "torches": torch_report,
    "rockTriangles": {k: triangle_count(o) for k, o in rock_objects.items()},
    "courtStoneTriangles": {k: triangle_count(o) for k, o in court_stone.items()},
    "lightmaps": {
        key: {"px": image.size[0], "samples": BAKE_SAMPLES if key.startswith("rock") else max(32, BAKE_SAMPLES // 2)}
        for key, _obj, image in bake_targets
    },
    "textureSets": TEXTURE_SETS,
    "uvMetresPerUnit": m_per_uv,
    "exportObjects": sorted({o.name.rsplit("_", 1)[0] if o.name[-3:].isdigit() else o.name for o in export_objects}),
    "exportObjectCount": len(export_objects),
    "rawGlbBytes": raw_size,
    "finalGlbBytes": final_size,
    "finalGlbPath": str(FINAL_GLB_PATH.relative_to(ROOT)).replace("\\", "/"),
    "renders": render_paths,
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
log(f"report -> {REPORT_PATH}")
