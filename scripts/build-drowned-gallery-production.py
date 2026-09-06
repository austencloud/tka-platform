"""Finish the Drowned Gallery graybox into the production shell the museum walks.

Pipeline (each step regenerates the next from source, nothing is hand-edited):

    pnpm exec tsx scripts/export-drowned-gallery-blender-plan.ts
        -> docs/superpowers/specs/2026-08-09-drowned-gallery-blender-plan.json
    blender --background --factory-startup --python scripts/build-drowned-gallery-graybox.py
        -> blender/drowned-gallery-graybox.blend   (the measured carve; geometry authority)
    blender --background --factory-startup --python scripts/build-drowned-gallery-production.py [-- --fast]
        -> blender/drowned-gallery-production.blend
        -> blender/exports/drowned-gallery-production.raw.glb
        -> static/models/museum/cave/drowned-gallery.glb   (gltf-transform optimised)
        -> blender/qa/drowned-gallery-production/*.png     (Cycles views to look at)

What this pass adds to the graybox, and what it deliberately leaves alone:

  * The carved shell is voxel-remeshed and displaced along its normals so
    every arris is rock rather than a boolean edge. Displacement is +/-0.11 m
    (a third of the wall shoulder the colliders already keep), so nothing the
    visitor can touch moves: the walked slabs are separate objects and stay
    where the layout put them. Physics never reads this file.
  * Materials are PolyHaven PBR, box-projected in Blender for the bake and
    UV-tiled (KHR_texture_transform) in the export. The lit result is baked
    with Cycles into one lightmap per object and exported on the EMISSIVE
    channel, so the room arrives pre-lit and the runtime lights are free to be
    what the design wants them to be: the key-light lift on a performer, the
    flicker in an apse, the glow under a pedestal.
  * Water is NOT exported. Blender's mirror slab exports as metalness 1 with no
    environment and renders black in three.js; the walk owns its water at
    runtime (ReflectivePool), exactly as the review harness does. The water
    meshes stay in the scene for the bake so the waterline still lights the
    rock teal.
  * Pedestals, consoles and the performer stages are NOT exported either. The
    museum-wide pedestal standard renders them at runtime from the layout, so
    a stage baked into rock here would be a second, disagreeing authority.

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
GRAYBOX_BLEND = ROOT / "blender" / "drowned-gallery-graybox.blend"
PROD_BLEND = ROOT / "blender" / "drowned-gallery-production.blend"
MANIFEST_PATH = (
    ROOT / "docs" / "superpowers" / "specs" / "2026-08-09-drowned-gallery-blender-plan.json"
)
TEX_DIR = ROOT / "blender" / "polyhaven_textures"
RAW_GLB_PATH = ROOT / "blender" / "exports" / "drowned-gallery-production.raw.glb"
FINAL_GLB_PATH = ROOT / "static" / "models" / "museum" / "cave" / "drowned-gallery.glb"
QA_DIR = ROOT / "blender" / "qa" / "drowned-gallery-production"
REPORT_PATH = (
    ROOT / "docs" / "superpowers" / "specs" / "drowned-gallery" / "production-build-report.json"
)

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
FAST = "--fast" in ARGS
RENDER = "--no-render" not in ARGS
OPTIMIZE = "--skip-optimize" not in ARGS

SHELL_LIGHTMAP_PX = 1024 if FAST else 4096
FLOOR_LIGHTMAP_PX = 512 if FAST else 2048
THRESHOLD_LIGHTMAP_PX = 256 if FAST else 1024
BAKE_SAMPLES = 32 if FAST else 256
VIEW_SAMPLES = 32 if FAST else 128

# PolyHaven CC0 sets, 2k JPG. Walls and vault, walked-on cave floor, and the
# cut stone of the causeway. Downloaded on first run; blender/ is gitignored.
TEXTURE_SETS = {
    "rock": "rock_wall_02",
    "cavefloor": "dry_riverbed_rock",
    "slab": "monastery_stone_floor",
}
TEXTURE_MAPS = ("diff", "nor_gl", "rough", "ao")
# Real-world period of each set, metres per tile.
TEXTURE_PERIOD_M = {"rock": 3.2, "cavefloor": 2.6, "slab": 2.4}


def log(message: str) -> None:
    print(f"[dg-production] {message}", flush=True)


# ── Source ──────────────────────────────────────────────────────────────────
if not GRAYBOX_BLEND.exists():
    raise RuntimeError(
        f"Missing {GRAYBOX_BLEND}. Run scripts/build-drowned-gallery-graybox.py first."
    )
manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
bpy.ops.wm.open_mainfile(filepath=str(GRAYBOX_BLEND))
scene = bpy.context.scene
if scene.get("drowned_gallery_source_digest") != manifest["sourceDigest"]:
    raise RuntimeError(
        "The graybox blend was built from a different plan than the manifest on "
        "disk. Rebuild the graybox before finishing it."
    )
SOURCE_DIGEST = manifest["sourceDigest"]
CONTRACT = manifest["contract"]
DATUM = CONTRACT["datums"]
WATERLINE = DATUM["WATERLINE_Y"]
GROTTO_WATERLINE = DATUM["GROTTO_WATERLINE_Y"]
CAUSEWAY = DATUM["CAUSEWAY_Y"]
SHELF = DATUM["SHELF_Y"]

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


shell = bpy.data.objects["DG_Shell_Rock"]
floors = objects_with_prefix("DG_Floor_")
rails = objects_with_prefix("DG_Rail_")
# Every piece of the Order's gilt metalwork: the threshold arch and the three
# apse sconces. They share one material, so they share one object and one
# lightmap, and the walk pays for a single draw call.
metalwork_parts = objects_with_prefix("DG_Threshold_") + objects_with_prefix("DG_Sconce_")
glowworms = objects_with_prefix("DG_Glowworm_")
water_meshes = (
    objects_with_prefix("DG_WaterSurface_")
    + objects_with_prefix("DG_WaterVolume_")
    + objects_with_prefix("DG_Waterfall_")
)

# Stages go: the pedestal standard renders the real pedestal at runtime.
for obj in objects_with_prefix("DG_Stage_"):
    bpy.data.objects.remove(obj, do_unlink=True)

# The lamps arrive finished from the graybox: a small warm core inside a gilt
# sconce, high on the apse's back wall above the performer's head, so the bake
# rims each performer from behind and the runtime key light owns the front.
lamps = objects_with_prefix("DG_Apse_Lamp_")


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def triangle_count(obj) -> int:
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ── Shell: from boolean solid to rock ───────────────────────────────────────
# The voxel remesher discards every enclosed cavity — a carved block comes back
# solid whatever its normals say (probed 2026-09-05: 98k faces, all skin). So
# the remesh runs on the VOID instead: block minus shell is exactly the space
# the visitor occupies, a positive solid with no cavities. Remeshed, its
# surface IS the rock surface; flipping the normals turns it to face inward.
log(f"shell before: {len(shell.data.polygons)} faces")
select_only([shell])
bpy.ops.object.mode_set(mode="OBJECT")
outer = [shell.matrix_world @ Vector(c) for c in shell.bound_box]
bounds = {
    "minX": min(p.x for p in outer),
    "maxX": max(p.x for p in outer),
    "minY": min(p.y for p in outer),
    "maxY": max(p.y for p in outer),
    "minZ": min(p.z for p in outer),
    "maxZ": max(p.z for p in outer),
}


def add_cube(name, centre, dims):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=centre)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


# A hair inside the block, so the difference is the voids and not a skin.
RIM = 0.01
void = add_cube(
    "DG_Void_Solid",
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

# The north mouth. The graybox never cut it: the review harness spawns inside,
# but the museum's own corridor arrives at the approach's north door and would
# otherwise meet 3.5 m of rock. Same width as the approach, floor a slab under
# the museum datum, up to the shaft ceiling, and out through the skin.
ORIGIN = CONTRACT["coordinateSystem"]["origin"]
approach = CONTRACT["layout"]["approach"]
SLAB_T = 0.3
mouth_x0 = approach["minX"] - ORIGIN["x"]
mouth_x1 = approach["maxX"] - ORIGIN["x"]
mouth_y0 = ORIGIN["z"] - approach["maxZ"] + 0.75
mouth_y1 = bounds["minY"] - 0.5
mouth_z0 = -SLAB_T - 0.05
mouth_z1 = DATUM["SHAFT_CEILING_Y"]
mouth = add_cube(
    "DG_Void_Mouth",
    ((mouth_x0 + mouth_x1) / 2, (mouth_y0 + mouth_y1) / 2, (mouth_z0 + mouth_z1) / 2),
    (mouth_x1 - mouth_x0, abs(mouth_y1 - mouth_y0), mouth_z1 - mouth_z0),
)
select_only([void, mouth])
bpy.ops.object.join()
void = bpy.context.view_layer.objects.active

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

# The remeshed void replaces the carved block under the same name, so every
# later reference — QA cutaway, export list, report — reads the finished rock.
shell_collections = list(shell.users_collection)
bpy.data.objects.remove(shell, do_unlink=True)
void.name = "DG_Shell_Rock"
for collection in list(void.users_collection):
    collection.objects.unlink(void)
for collection in shell_collections:
    collection.objects.link(void)
shell = void

# Drop the caps where the void meets the block skin: those are the two mouths,
# and a cap there would be a wall across a doorway.
SKIN_TOLERANCE = 0.45
bm = bmesh.new()
bm.from_mesh(shell.data)
bm.faces.ensure_lookup_table()
mw = shell.matrix_world
doomed = []
for face in bm.faces:
    c = mw @ face.calc_center_median()
    if (
        c.x < bounds["minX"] + SKIN_TOLERANCE
        or c.x > bounds["maxX"] - SKIN_TOLERANCE
        or c.y < bounds["minY"] + SKIN_TOLERANCE
        or c.y > bounds["maxY"] - SKIN_TOLERANCE
        or c.z < bounds["minZ"] + SKIN_TOLERANCE
        or c.z > bounds["maxZ"] - SKIN_TOLERANCE
    ):
        doomed.append(face)
bmesh.ops.delete(bm, geom=doomed, context="FACES")
bm.to_mesh(shell.data)
bm.free()
shell.data.update()
log(f"shell skin removed: {len(shell.data.polygons)} faces")

# Relief weight: full on walls and vaults, gentle on anything that faces up so
# the rock under a slab stays under it.
relief = shell.vertex_groups.new(name="Relief")
for vertex in shell.data.vertices:
    up = vertex.normal.z
    t = min(1.0, max(0.0, (up - 0.35) / 0.4))
    relief.add([vertex.index], 1.0 - t * 0.7, "REPLACE")

coarse_tex = bpy.data.textures.new("DG_Relief_Coarse", "CLOUDS")
coarse_tex.noise_scale = 2.4
coarse_tex.noise_depth = 2
coarse_tex.noise_basis = "IMPROVED_PERLIN"
fine_tex = bpy.data.textures.new("DG_Relief_Fine", "CLOUDS")
fine_tex.noise_scale = 0.75
fine_tex.noise_depth = 3
fine_tex.noise_basis = "VORONOI_F1"

mid_tex = bpy.data.textures.new("DG_Relief_Mid", "CLOUDS")
mid_tex.noise_scale = 1.1
mid_tex.noise_depth = 2
mid_tex.noise_basis = "BLENDER_ORIGINAL"

# Peak inward travel is half the sum: 0.185 m, inside the 0.30 m wall shoulder
# the colliders keep, plus whatever the 0.30 m voxel already moved (< 0.15).
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

SHELL_TRI_BUDGET = 220_000
tris = triangle_count(shell)
if tris > SHELL_TRI_BUDGET:
    dec = shell.modifiers.new("Decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = SHELL_TRI_BUDGET / tris
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="Decimate")
bpy.ops.object.shade_smooth()
log(f"shell final: {triangle_count(shell)} tris")

# ── Floors: one object of cut stone ─────────────────────────────────────────
select_only(floors)
bpy.ops.object.join()
floors_obj = bpy.context.view_layer.objects.active
floors_obj.name = "DG_Floors"
bevel = floors_obj.modifiers.new("Bevel", "BEVEL")
bevel.width = 0.035
bevel.segments = 2
bevel.limit_method = "ANGLE"
bevel.angle_limit = math.radians(50)
bpy.ops.object.modifier_apply(modifier="Bevel")
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
log(f"floors: {triangle_count(floors_obj)} tris")

select_only(rails)
bpy.ops.object.join()
rails_obj = bpy.context.view_layer.objects.active
rails_obj.name = "DG_Rails"

# One mesh, and every arris beveled: a boolean arch with unbeveled arrises is
# still a boolean arch to look at. 12 mm puts a highlight on every edge.
select_only(metalwork_parts)
bpy.ops.object.join()
threshold_obj = bpy.context.view_layer.objects.active
threshold_obj.name = "DG_Metalwork"
th_bevel = threshold_obj.modifiers.new("Bevel", "BEVEL")
th_bevel.width = 0.012
th_bevel.segments = 2
th_bevel.limit_method = "ANGLE"
th_bevel.angle_limit = math.radians(35)
bpy.ops.object.modifier_apply(modifier="Bevel")
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
log(f"metalwork: {triangle_count(threshold_obj)} tris")


# ── UVs ─────────────────────────────────────────────────────────────────────
def unwrap(obj, margin=0.002) -> float:
    """Smart-project one UV layer and return metres per UV unit, so a tiling
    period in metres can be turned into a texture repeat."""
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


shell_m_per_uv = unwrap(shell, margin=0.0015)
floors_m_per_uv = unwrap(floors_obj, margin=0.004)
unwrap(rails_obj, margin=0.01)
threshold_m_per_uv = unwrap(threshold_obj, margin=0.004)
log(f"UV density shell {shell_m_per_uv:.1f} m/uv, floors {floors_m_per_uv:.1f} m/uv")


# ── Materials ───────────────────────────────────────────────────────────────
def new_material(name: str):
    # Blender does not replace a name, it appends ".001". The graybox already
    # owns "DG Gilded Threshold", so the exported gilt material silently shipped
    # as "DG Gilded Threshold.001" -- and the runtime looks its materials up by
    # exact name. Move the authoring material out of the way so every name in
    # the exported glTF is the one this script asked for.
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


def bake_material(name, wall_set, floor_set, wet_below, lightmap_image, wall_tint=(1, 1, 1)):
    """Box-projected PBR for the bake. Walls take one set, up-facing surfaces
    another, everything under `wet_below` darkens and tightens, and a green
    band rides each waterline. The active node is the lightmap target."""
    mat, tree, bsdf = new_material(name)
    links = tree.links
    wall_scale = 1.0 / TEXTURE_PERIOD_M[wall_set]
    floor_scale = 1.0 / TEXTURE_PERIOD_M[floor_set]

    def pbr(set_key, scale):
        diff = box_texture(tree, set_key, "diff", scale)
        nor = box_texture(tree, set_key, "nor_gl", scale)
        rough = box_texture(tree, set_key, "rough", scale)
        ao = box_texture(tree, set_key, "ao", scale)
        colour = rgb_mix(tree, "MULTIPLY")
        colour.inputs["Factor"].default_value = 0.8
        links.new(diff.outputs["Color"], colour.inputs[6])
        links.new(ao.outputs["Color"], colour.inputs[7])
        return colour.outputs[2], nor.outputs["Color"], rough.outputs["Color"]

    wall_c, wall_n, wall_r = pbr(wall_set, wall_scale)
    floor_c, floor_n, floor_r = pbr(floor_set, floor_scale)

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

    colour = mix_by_up(wall_c, floor_c)
    normal_c = mix_by_up(wall_n, floor_n)
    rough = mix_by_up(wall_r, floor_r)

    tint = rgb_mix(tree, "MULTIPLY")
    tint.inputs["Factor"].default_value = 1.0
    links.new(colour, tint.inputs[6])
    tint.inputs[7].default_value = (*wall_tint, 1.0)
    colour = tint.outputs[2]

    # Wet zone: below the datum the rock is darker and glossier. Object
    # coordinates are world-aligned here (identity rotation, origin at 0).
    obj_z = tree.nodes.new("ShaderNodeSeparateXYZ")
    coords = tree.nodes.new("ShaderNodeTexCoord")
    links.new(coords.outputs["Object"], obj_z.inputs["Vector"])
    wet = tree.nodes.new("ShaderNodeMapRange")
    wet.inputs["From Min"].default_value = wet_below - 0.5
    wet.inputs["From Max"].default_value = wet_below + 0.15
    wet.inputs["To Min"].default_value = 1.0
    wet.inputs["To Max"].default_value = 0.0
    links.new(obj_z.outputs["Z"], wet.inputs["Value"])
    wet_col = rgb_mix(tree, "MULTIPLY")
    links.new(wet.outputs["Result"], wet_col.inputs["Factor"])
    links.new(colour, wet_col.inputs[6])
    wet_col.inputs[7].default_value = (0.42, 0.5, 0.5, 1.0)
    colour = wet_col.outputs[2]
    wet_rough = rgb_mix(tree)
    links.new(wet.outputs["Result"], wet_rough.inputs["Factor"])
    links.new(rough, wet_rough.inputs[6])
    wet_rough.inputs[7].default_value = (0.32, 0.32, 0.32, 1.0)
    rough = wet_rough.outputs[2]

    # Algae band at each waterline.
    for line in (WATERLINE, GROTTO_WATERLINE):
        off = tree.nodes.new("ShaderNodeMath")
        off.operation = "SUBTRACT"
        off.inputs[1].default_value = line + 0.12
        links.new(obj_z.outputs["Z"], off.inputs[0])
        dist = tree.nodes.new("ShaderNodeMath")
        dist.operation = "ABSOLUTE"
        links.new(off.outputs[0], dist.inputs[0])
        band = tree.nodes.new("ShaderNodeMapRange")
        band.inputs["From Min"].default_value = 0.0
        band.inputs["From Max"].default_value = 0.45
        band.inputs["To Min"].default_value = 0.85
        band.inputs["To Max"].default_value = 0.0
        links.new(dist.outputs[0], band.inputs["Value"])
        algae = rgb_mix(tree)
        links.new(band.outputs["Result"], algae.inputs["Factor"])
        links.new(colour, algae.inputs[6])
        algae.inputs[7].default_value = (0.11, 0.2, 0.13, 1.0)
        colour = algae.outputs[2]

    links.new(colour, bsdf.inputs["Base Color"])
    links.new(rough, bsdf.inputs["Roughness"])
    normal_map = tree.nodes.new("ShaderNodeNormalMap")
    normal_map.space = "OBJECT"
    normal_map.inputs["Strength"].default_value = 0.8
    links.new(normal_c, normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    target = tree.nodes.new("ShaderNodeTexImage")
    target.image = lightmap_image
    target.select = True
    tree.nodes.active = target
    return mat


def gilt_bake_material(name, lightmap_image):
    """Gold leaf over cut stone, for the bake only.

    Metallic is honest here because Cycles has the whole grotto to reflect, and
    the bake runs with the glossy pass ON, so the highlight the apse lamps put
    on the arch is written into the lightmap. That is what lets the exported
    material be an ordinary lit surface: three.js gets no environment map in
    the museum, and a metal without one has neither diffuse nor reflection --
    which is exactly how this threshold came to render as a cream cardboard
    cutout in the first place."""
    mat, tree, bsdf = new_material(name)
    links = tree.links
    scale = 1.0 / TEXTURE_PERIOD_M["slab"]
    diff = box_texture(tree, "slab", "diff", scale)
    rough = box_texture(tree, "slab", "rough", scale)
    nor = box_texture(tree, "slab", "nor_gl", scale)

    tint = rgb_mix(tree, "MULTIPLY")
    tint.inputs["Factor"].default_value = 1.0
    links.new(diff.outputs["Color"], tint.inputs[6])
    tint.inputs[7].default_value = (1.26, 1.0, 0.60, 1.0)
    links.new(tint.outputs[2], bsdf.inputs["Base Color"])

    # Leaf is thin. The stone roughness still reads through it, pulled most of
    # the way down so the gold is burnished rather than mirrored.
    soften = rgb_mix(tree)
    soften.inputs["Factor"].default_value = 0.7
    links.new(rough.outputs["Color"], soften.inputs[6])
    soften.inputs[7].default_value = (0.2, 0.2, 0.2, 1.0)
    links.new(soften.outputs[2], bsdf.inputs["Roughness"])

    normal_map = tree.nodes.new("ShaderNodeNormalMap")
    normal_map.space = "OBJECT"
    normal_map.inputs["Strength"].default_value = 0.5
    links.new(nor.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Metallic"].default_value = 0.75

    target = tree.nodes.new("ShaderNodeTexImage")
    target.image = lightmap_image
    target.select = True
    tree.nodes.active = target
    return mat


def export_material(name, set_key, lightmap_image, m_per_uv, albedo=(0.55, 0.55, 0.55)):
    """What the GLB carries: tiled albedo + normal + roughness on UVMap with a
    KHR_texture_transform repeat, and the lightmap on Emission at 1.0."""
    mat, tree, bsdf = new_material(name)
    links = tree.links
    repeat = m_per_uv / TEXTURE_PERIOD_M[set_key]
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


shell_lightmap = new_lightmap("DG_Shell_Lightmap", SHELL_LIGHTMAP_PX)
floors_lightmap = new_lightmap("DG_Floors_Lightmap", FLOOR_LIGHTMAP_PX)
rails_lightmap = new_lightmap("DG_Rails_Lightmap", 256)
threshold_lightmap = new_lightmap("DG_Threshold_Lightmap", THRESHOLD_LIGHTMAP_PX)

shell_bake = bake_material("DG Rock (bake)", "rock", "cavefloor", GROTTO_WATERLINE, shell_lightmap)
floors_bake = bake_material(
    "DG Slab (bake)", "slab", "slab", WATERLINE, floors_lightmap, wall_tint=(0.9, 0.86, 0.8)
)
rails_bake = bake_material(
    "DG Rail (bake)", "rock", "rock", GROTTO_WATERLINE, rails_lightmap, wall_tint=(0.55, 0.5, 0.46)
)

threshold_bake = gilt_bake_material("DG Gilt (bake)", threshold_lightmap)

for obj, mat in (
    (shell, shell_bake),
    (floors_obj, floors_bake),
    (rails_obj, rails_bake),
    (threshold_obj, threshold_bake),
):
    obj.data.materials.clear()
    obj.data.materials.append(mat)

# ── Bake lighting ───────────────────────────────────────────────────────────
# The graybox's QA lights are the room's lighting design; they were tuned for
# EEVEE and Cycles wants Watts, so they scale rather than get redesigned.
LIGHT_SCALE = {"POINT": 1.15, "AREA": 1.0}
for obj in scene.objects:
    if obj.type == "LIGHT":
        obj.data.energy *= LIGHT_SCALE.get(obj.data.type, 1.0)
        obj.data.use_shadow = True

world = scene.world
background = world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.02, 0.05, 0.06, 1.0)
background.inputs["Strength"].default_value = 0.35

# The exported emissives light the bake as mesh lights; strengths tuned for
# Cycles here and restored for the export below.
glow_mat = bpy.data.materials["DG Glowworm"]
lamp_mat = bpy.data.materials["DG Alcove Firelight"]
glow_bsdf = glow_mat.node_tree.nodes["Principled BSDF"]
lamp_bsdf = lamp_mat.node_tree.nodes["Principled BSDF"]
# 106 glowworms at 14 painted a cyan stripe across every wall the dome could
# see and drowned the apses. The dome should glimmer; the shelf should be lit by
# the lamps in the apses, warm, so the three cases read as the room's altar.
glow_bsdf.inputs["Emission Strength"].default_value = 5.0
lamp_bsdf.inputs["Emission Strength"].default_value = 30.0

# The waterline surface is a light SOURCE for the submerged gallery (nothing
# else reaches the bend), but at the graybox's 0.9 it renders as a flat cyan
# slab in the QA views and dyes the rock teal. A third of that still carries
# the gallery; the pooled runtime lights do the rest in the walk.
for mat_name, strength in (("DG Water Surface", 0.3), ("DG Water Body", 0.1), ("DG Waterfall", 0.9)):
    mat = bpy.data.materials.get(mat_name)
    if mat and mat.node_tree:
        node = mat.node_tree.nodes.get("Principled BSDF")
        if node:
            node.inputs["Emission Strength"].default_value = strength


def bake(obj, image, samples, glossy=False):
    select_only([obj])
    scene.cycles.samples = samples
    settings = scene.render.bake
    settings.target = "IMAGE_TEXTURES"
    settings.use_pass_direct = True
    settings.use_pass_indirect = True
    settings.use_pass_color = True
    settings.use_pass_emit = True
    settings.use_pass_diffuse = True
    settings.use_pass_glossy = glossy
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
    """OIDN through the compositor, since Cycles does not denoise bakes.

    Blender 5 moved the compositor off `scene.node_tree`: a scene now points at
    a CompositorNodeTree node group whose result is the group's own output
    socket, and Denoise's HDR toggle became an input socket."""
    if FAST:
        return image
    tmp = bpy.data.scenes.new("DG_Denoise")
    tree = bpy.data.node_groups.new("DG_Denoise_Tree", "CompositorNodeTree")
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


bake(shell, shell_lightmap, BAKE_SAMPLES)
bake(floors_obj, floors_lightmap, BAKE_SAMPLES)
bake(rails_obj, rails_lightmap, max(32, BAKE_SAMPLES // 4))
# Glossy ON for this one object: the burnished highlight IS the gilding.
bake(threshold_obj, threshold_lightmap, max(64, BAKE_SAMPLES // 2), glossy=True)
shell_lightmap_final = denoise(shell_lightmap, QA_DIR / "DG_Shell_Lightmap_dn.png")
floors_lightmap_final = denoise(floors_lightmap, QA_DIR / "DG_Floors_Lightmap_dn.png")
rails_lightmap_final = rails_lightmap
threshold_lightmap_final = denoise(
    threshold_lightmap, QA_DIR / "DG_Threshold_Lightmap_dn.png"
)
for image in (
    shell_lightmap_final,
    floors_lightmap_final,
    rails_lightmap_final,
    threshold_lightmap_final,
):
    image.pack()

# ── Swap to export materials ────────────────────────────────────────────────
shell_export = export_material("DG Rock", "rock", shell_lightmap_final, shell_m_per_uv, albedo=(0.5, 0.5, 0.5))
floors_export = export_material("DG Slab", "slab", floors_lightmap_final, floors_m_per_uv, albedo=(0.6, 0.58, 0.55))
rails_export = export_material("DG Rail", "rock", rails_lightmap_final, shell_m_per_uv, albedo=(0.3, 0.29, 0.28))
threshold_export = export_material(
    "DG Gilded Threshold", "slab", threshold_lightmap_final, threshold_m_per_uv,
    albedo=(0.38, 0.31, 0.19),
)
for obj, mat in (
    (shell, shell_export),
    (floors_obj, floors_export),
    (rails_obj, rails_export),
    (threshold_obj, threshold_export),
):
    obj.data.materials.clear()
    obj.data.materials.append(mat)

# Export strengths are read under the museum's ACES at exposure 1.1 with a
# 2.6x lift on the lightmapped materials only. The glowworms and the apse
# lamps are emissive with no lightmap, so they are tuned by name at runtime
# (DrownedGalleryAuthored.svelte) and anything above ~2 here clips to a white
# block. The threshold left that list when it gained a lightmap of its own.
glow_bsdf.inputs["Emission Strength"].default_value = 1.6
lamp_bsdf.inputs["Emission Strength"].default_value = 0.9

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

render_paths = {}
VIEWS = (
    ["procession", "threshold"]
    if FAST
    else ["approach", "descent", "bloom", "reveal", "procession", "threshold", "overview"]
)
if RENDER:
    for name in VIEWS:
        camera = bpy.data.objects.get(f"QA_Camera_{name.capitalize()}")
        if camera is None:
            log(f"no camera for view {name}")
            continue
        shell.hide_render = name == "overview"
        scene.camera = camera
        path = QA_DIR / f"drowned-gallery-{name}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        render_paths[name] = str(path)
        log(f"rendered {name}")
    shell.hide_render = False

# ── Export ──────────────────────────────────────────────────────────────────
export_objects = [shell, floors_obj, rails_obj, threshold_obj, *glowworms, *lamps]
for obj in water_meshes:
    obj.hide_render = True
    obj.hide_viewport = True

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
        "node",
        str(cli),
        "optimize",
        str(RAW_GLB_PATH),
        str(FINAL_GLB_PATH),
        "--texture-compress",
        "webp",
        "--texture-size",
        str(SHELL_LIGHTMAP_PX),
        "--compress",
        "draco",
        "--simplify",
        "false",
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
    "shellTriangles": triangle_count(shell),
    "metalworkTriangles": triangle_count(threshold_obj),
    "floorTriangles": triangle_count(floors_obj),
    "lightmaps": {
        "shell": {"px": SHELL_LIGHTMAP_PX, "samples": BAKE_SAMPLES},
        "floors": {"px": FLOOR_LIGHTMAP_PX, "samples": BAKE_SAMPLES},
        "threshold": {
            "px": THRESHOLD_LIGHTMAP_PX,
            "samples": max(64, BAKE_SAMPLES // 2),
        },
    },
    "textureSets": TEXTURE_SETS,
    "uvMetresPerUnit": {
        "shell": shell_m_per_uv,
        "floors": floors_m_per_uv,
        "threshold": threshold_m_per_uv,
    },
    "exportObjects": [o.name for o in export_objects if not o.name.startswith("DG_Glowworm_")]
    + [f"glowworms x{len(glowworms)}"],
    "rawGlbBytes": raw_size,
    "finalGlbBytes": final_size,
    "finalGlbPath": str(FINAL_GLB_PATH.relative_to(ROOT)).replace("\\", "/"),
    "renders": render_paths,
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
log(f"report -> {REPORT_PATH}")
