"""Blossom R3 composition boards — honest graybox renders with real canopy.

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
    --background --python scripts/render-blossom-boards-r3.py -- --board A

Renders one board per invocation (A, B, or C) to
docs/superpowers/specs/blossom-boards-r3/evidence/.

Why this exists: R2 was approved from a top-down infographic whose grove was
flat labeled circles, and the built result had no trees at all. These boards
place the two APPROVED PlantFactory cherry GLBs (open-crown-s19 hero,
open-crown-s71 secondary — the only approved variants as of 2026-08-23) as
real geometry so canopy scale is present in the very first spatial review.
Everything else is deliberately graybox: proportioned proxies, not final art.

Plan space here is Blender world space: X east, Y north, Z up, metres.
"""

import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CANDIDATE_DIR = os.path.join(
    PROJECT_ROOT, "static", "models", "blossom", "candidates", "plantfactory-family-r1"
)
OUT_DIR = os.path.join(
    PROJECT_ROOT, "docs", "superpowers", "specs", "blossom-boards-r3", "evidence"
)

TREE_SOURCES = {
    "s19": os.path.join(CANDIDATE_DIR, "open-crown-s19-proof.glb"),
    "s71": os.path.join(CANDIDATE_DIR, "open-crown-s71-proof.glb"),
}

# ---------------------------------------------------------------------------
# Terrain: analytic height so meshes, props, and trees all agree exactly.
# Gentle relief inside the clearing, a wooded berm closing the horizon.
# ---------------------------------------------------------------------------

WORLD_RADIUS = 92.0
BERM_START = 38.0
BERM_TOP = 78.0
BERM_HEIGHT = 7.5


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def relief(x, y):
    return 0.32 * math.sin(x * 0.11 + 1.7) * math.cos(y * 0.09 - 0.6) + 0.18 * math.sin(
        (x + y) * 0.05
    )


def berm(x, y):
    r = math.hypot(x, y)
    return BERM_HEIGHT * smoothstep(BERM_START, BERM_TOP, r)


def point_segment_distance(px, py, ax, ay, bx, by):
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    ab2 = abx * abx + aby * aby
    t = 0.0 if ab2 == 0 else max(0.0, min(1.0, (apx * abx + apy * aby) / ab2))
    cx, cy = ax + abx * t, ay + aby * t
    return math.hypot(px - cx, py - cy)


def polyline_distance(x, y, pts):
    return min(
        point_segment_distance(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
        for i in range(len(pts) - 1)
    )


# A trunk this far from a path centerline clears the walking surface and its
# root flare. Canopy OVERHANG above that is wanted — it makes the blossom
# tunnel — so this bounds the trunk, not the crown.
PATH_HALF_WIDTH = 0.85
TRUNK_FLARE_RADIUS = 1.45


class Plantability:
    """Where a trunk may legally stand. Distance is measured to whole
    polylines, not to their vertices — sampling vertices alone lets a tree
    land mid-segment, which is exactly how one ended up in a path."""

    def __init__(self, layout):
        self.paths = layout["paths"]
        self.river = layout["river"]
        sx, sy, sw, sd, _ = layout["stage"]
        self.stage = (sx, sy, max(sw, sd) / 2 + 2.0)
        tx, ty, _ = layout["torii"]
        self.torii = (tx, ty, 5.0)
        bx, by, _, blen, _ = layout["bridge"]
        self.bridge = (bx, by, blen / 2 + 3.0)
        # The lawn is an angular SECTOR, not a disc. Treating it as a disc
        # blocks the whole ring around the stage, including the sides where
        # the framing heroes are supposed to stand.
        self.lawn_sectors = layout["audience"]

    def _in_lawn(self, x, y, trunk):
        for cx, cy, _r0, r1, a0, a1 in self.lawn_sectors:
            dx, dy = x - cx, y - cy
            if math.hypot(dx, dy) > r1 + trunk + 1.0:
                continue
            a = math.degrees(math.atan2(dx, dy)) % 360
            lo, hi = a0 % 360, a1 % 360
            inside = lo <= a <= hi if lo <= hi else (a >= lo or a <= hi)
            if inside:
                return True
        return False

    def blocked_by(self, x, y, scale=1.0):
        """Return the name of the first thing this trunk would obstruct."""
        trunk = TRUNK_FLARE_RADIUS * scale
        for i, pts in enumerate(self.paths):
            if polyline_distance(x, y, pts) < PATH_HALF_WIDTH + trunk:
                return f"path{i}"
        if polyline_distance(x, y, self.river["pts"]) < self.river["half_width"] + trunk * 0.5:
            return "river"
        for name, (cx, cy, r) in (
            ("stage", self.stage),
            ("torii", self.torii),
            ("bridge", self.bridge),
        ):
            if math.hypot(x - cx, y - cy) < r + trunk:
                return name
        if self._in_lawn(x, y, trunk):
            return "lawn"
        return None


class Site:
    """One board's layout. River carve is part of the height function."""

    def __init__(self, board):
        self.board = board
        self.river = board["river"]  # dict: pts, half_width, depth, water_z

    def height(self, x, y):
        h = relief(x, y) + berm(x, y)
        river = self.river
        d = polyline_distance(x, y, river["pts"])
        hw = river["half_width"]
        if d < hw + 2.2:
            carve = river["depth"] * (1.0 - smoothstep(hw * 0.55, hw + 2.2, d))
            h -= carve
        return h


# ---------------------------------------------------------------------------
# Mesh helpers
# ---------------------------------------------------------------------------


def make_material(name, rgba, rough=0.85, emit=None, emit_strength=0.0, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = emit
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def new_object(name, mesh, mat=None):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def build_terrain(site, mat):
    step = 1.4
    n = int((WORLD_RADIUS * 2) / step) + 1
    verts = []
    for j in range(n):
        for i in range(n):
            x = -WORLD_RADIUS + i * step
            y = -WORLD_RADIUS + j * step
            verts.append((x, y, site.height(x, y)))
    faces = []
    for j in range(n - 1):
        for i in range(n - 1):
            a = j * n + i
            faces.append((a, a + 1, a + n + 1, a + n))
    mesh = bpy.data.meshes.new("terrain")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return new_object("Terrain", mesh, mat)


def build_ribbon(name, site, pts, width, z_offset, mat, z_abs=None):
    """A flat strip following a polyline, conformed to terrain (or absolute z)."""
    samples = []
    for i in range(len(pts) - 1):
        ax, ay = pts[i]
        bx, by = pts[i + 1]
        seg = math.hypot(bx - ax, by - ay)
        steps = max(2, int(seg / 0.8))
        for s in range(steps):
            t = s / steps
            samples.append((ax + (bx - ax) * t, ay + (by - ay) * t))
    samples.append(pts[-1])
    verts = []
    for i, (x, y) in enumerate(samples):
        if i == 0:
            dx, dy = samples[1][0] - x, samples[1][1] - y
        else:
            dx, dy = x - samples[i - 1][0], y - samples[i - 1][1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L, dx / L
        for side in (-1, 1):
            px, py = x + nx * side * width / 2, y + ny * side * width / 2
            pz = z_abs if z_abs is not None else site.height(px, py) + z_offset
            verts.append((px, py, pz))
    faces = []
    for i in range(len(samples) - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return new_object(name, mesh, mat)


def build_disc(name, site, cx, cy, r0, r1, a0, a1, z_offset, mat):
    """Annular sector pad (audience lawn), conformed to terrain."""
    verts, faces = [], []
    radial, angular = 6, 24
    for j in range(radial + 1):
        r = r0 + (r1 - r0) * j / radial
        for i in range(angular + 1):
            a = math.radians(a0 + (a1 - a0) * i / angular)
            # angle convention: 0 = north, 90 = east, 180 = south
            x, y = cx + r * math.sin(a), cy + r * math.cos(a)
            verts.append((x, y, site.height(x, y) + z_offset))
    for j in range(radial):
        for i in range(angular):
            a = j * (angular + 1) + i
            faces.append((a, a + 1, a + angular + 2, a + angular + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return new_object(name, mesh, mat)


def add_box(name, size, loc, mat, rot_z=0.0):
    # size=1 cube has half-extent 0.5, so scale by the FULL dimensions.
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(0, 0, rot_z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_cylinder(name, r, depth, loc, mat):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_sphere(name, r, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=12)
    obj = bpy.context.active_object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Props (proportioned proxies)
# ---------------------------------------------------------------------------


def build_stage(site, cx, cy, w, d, mats, rot_z=0.0):
    z = site.height(cx, cy)
    # extra depth buries the deck bottom through terrain relief
    add_box("Stage_Deck", (w, d, 0.75), (cx, cy, z + 0.08), mats["wood"], rot_z)
    cr, sr = math.cos(rot_z), math.sin(rot_z)
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        lx, ly = sx * (w / 2 - 0.25), sy * (d / 2 - 0.25)
        px, py = cx + lx * cr - ly * sr, cy + lx * sr + ly * cr
        add_cylinder("Stage_Post", 0.05, 1.25, (px, py, z + 1.1), mats["wood_dark"])
        add_sphere("Stage_Orb", 0.09, (px, py, z + 1.78), mats["lamp"])
    # performer scale figure (1.75 m to head top, on the deck surface)
    deck_top = z + 0.455
    add_cylinder("Performer", 0.13, 1.45, (cx, cy, deck_top + 0.73), mats["figure"])
    add_sphere("Performer_Head", 0.12, (cx, cy, deck_top + 1.60), mats["figure"])
    return z


def build_audience_figures(site, spots, mats):
    for i, (x, y) in enumerate(spots):
        z = site.height(x, y)
        add_cylinder(f"Guest{i}", 0.15, 1.35, (x, y, z + 0.75), mats["figure_dim"])
        add_sphere(f"Guest{i}_Head", 0.13, (x, y, z + 1.55), mats["figure_dim"])


def build_torii(site, cx, cy, rot_z, mats, width=8.6, height=5.4):
    z = site.height(cx, cy)
    cr, sr = math.cos(rot_z), math.sin(rot_z)
    half = width / 2 - 0.5
    for side in (-1, 1):
        px, py = cx + side * half * cr, cy + side * half * sr
        add_cylinder("Torii_Post", 0.30, height, (px, py, z + height / 2), mats["vermillion"])
    add_box("Torii_Kasagi", (width + 1.2, 0.55, 0.5), (cx, cy, z + height + 0.1), mats["vermillion"], rot_z)
    add_box("Torii_Shimaki", (width + 0.6, 0.45, 0.32), (cx, cy, z + height - 0.42), mats["vermillion_dark"], rot_z)
    add_box("Torii_Nuki", (width - 0.4, 0.32, 0.4), (cx, cy, z + height * 0.68), mats["vermillion"], rot_z)


def build_bridge(site, cx, cy, rot_z, length, width, water_z, mats):
    deck_z = water_z + 1.05
    add_box("Bridge_Deck", (length, width, 0.22), (cx, cy, deck_z), mats["wood"], rot_z)
    cr, sr = math.cos(rot_z), math.sin(rot_z)
    for side in (-1, 1):
        rx, ry = -sr * side * (width / 2), cr * side * (width / 2)
        add_box(
            "Bridge_Rail",
            (length, 0.09, 0.85),
            (cx + rx, cy + ry, deck_z + 0.53),
            mats["wood_dark"],
            rot_z,
        )
    for end in (-1, 1):
        ex, ey = cx + cr * end * (length / 2 + 1.2), cy + sr * end * (length / 2 + 1.2)
        gz = site.height(ex, ey)
        add_box("Bridge_Ramp", (2.6, width + 0.5, 0.18), (ex, ey, (deck_z + gz) / 2 + 0.05), mats["wood"], rot_z)


def build_lantern(site, x, y, mats, idx=0):
    z = site.height(x, y)
    add_box(f"Lantern{idx}_Base", (0.5, 0.5, 0.25), (x, y, z + 0.12), mats["stone"])
    add_cylinder(f"Lantern{idx}_Pillar", 0.09, 0.75, (x, y, z + 0.62), mats["stone"])
    add_box(f"Lantern{idx}_House", (0.42, 0.42, 0.4), (x, y, z + 1.2), mats["stone"])
    add_box(f"Lantern{idx}_Glow", (0.30, 0.30, 0.28), (x, y, z + 1.2), mats["lamp"])
    add_box(f"Lantern{idx}_Cap", (0.56, 0.56, 0.12), (x, y, z + 1.46), mats["stone"])
    lamp = bpy.data.lights.new(f"Lantern{idx}_Light", type="POINT")
    lamp.color = (1.0, 0.66, 0.32)
    lamp.energy = 60.0
    lamp.shadow_soft_size = 0.3
    obj = bpy.data.objects.new(f"Lantern{idx}_Light", lamp)
    obj.location = (x, y, z + 1.35)
    bpy.context.scene.collection.objects.link(obj)


# ---------------------------------------------------------------------------
# Trees: import the approved proof GLBs once, then linked-duplicate instances.
# ---------------------------------------------------------------------------


def import_tree_sources():
    sources = {}
    for key, path in TREE_SOURCES.items():
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        imported = [o for o in set(bpy.data.objects) - before]
        # Keep the source collection OUT of the scene tree (so originals don't
        # render at the world origin) but do not hide it — hiding a collection
        # also hides every instance of it.
        coll = bpy.data.collections.new(f"Tree_{key}")
        for obj in imported:
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            coll.objects.link(obj)
        sources[key] = coll
    return sources


def place_tree(sources, site, variant, x, y, scale, rot_deg, name):
    inst = bpy.data.objects.new(name, None)
    inst.instance_type = "COLLECTION"
    inst.instance_collection = sources[variant]
    inst.location = (x, y, site.height(x, y) - 0.05)
    inst.rotation_euler = (0, 0, math.radians(rot_deg))
    inst.scale = (scale, scale, scale)
    bpy.context.scene.collection.objects.link(inst)


def scatter_ring(
    rng, site, sources, plantable, count, r0, r1, keep_out, scale_range, tag, gap_sectors=()
):
    placed = 0
    attempts = 0
    trees = []
    while placed < count and attempts < count * 80:
        attempts += 1
        a = rng.uniform(0, 360)
        if any(lo <= a <= hi for lo, hi in gap_sectors):
            continue
        r = rng.uniform(r0, r1)
        # same convention as build_disc: 0 = north, 180 = south
        x, y = r * math.sin(math.radians(a)), r * math.cos(math.radians(a))
        s = rng.uniform(*scale_range)
        if plantable.blocked_by(x, y, s):
            continue
        if any(math.hypot(x - kx, y - ky) < kr for kx, ky, kr in keep_out):
            continue
        v = "s19" if rng.random() < 0.55 else "s71"
        place_tree(sources, site, v, x, y, s, rng.uniform(0, 360), f"{tag}{placed}")
        trees.append((x, y, s))
        keep_out = keep_out + [(x, y, 4.2 * s)]
        placed += 1
    if placed < count:
        print(f"WARNING: {tag} ring placed {placed}/{count} — keep-outs too tight")
    return trees


# ---------------------------------------------------------------------------
# Board layouts
# ---------------------------------------------------------------------------


def board_layouts():
    return {
        "A": {
            "title": "Amphitheater Axis",
            "thesis": "South-to-north axis: arrival, audience crescent, stage, river, bridge, torii threshold. The R2 idea at intimate Forest/Autumn scale.",
            "river": {
                "pts": [(-34, 24), (-18, 18), (-4, 15.5), (10, 16.5), (22, 20), (34, 27)],
                "half_width": 2.6,
                "depth": 1.25,
                "water_z": -0.42,
            },
            "stage": (0.0, 0.0, 10.0, 7.0, 0.0),
            "torii": (0.0, 26.0, 0.0),
            "bridge": (-7.5, 16.4, math.radians(78), 9.0, 2.4),
            "audience": [(0, 0, 8.5, 16.5, 125, 235)],
            "guests": [(-4, -11), (0, -12.5), (4.5, -11.5), (-7, -14), (7, -13.5), (1.5, -15)],
            "paths": [
                [(14, -34), (10, -24), (5, -18.5)],       # arrival SE
                [(-5, -18.5), (-11, -14), (-14, -6), (-12, 5), (-9.5, 12)],  # garden walk W to bridge
                [(-6.5, 20.5), (-3.5, 23.5), (0, 25.8), (0, 33)],  # shrine walk
                [(5, -18.5), (-5, -18.5)],                # crescent rim connector
                [(16, -22), (22, -14), (24, -4)],          # service spur E (discreet)
            ],
            "lanterns": [(11.5, -26), (6.4, -19.6), (-10.3, -13.2), (-13.2, -5.4), (-8.6, 13.4), (-1.6, 24.4), (1.6, 29.6), (22.8, -12.4)],
            "heroes": [
                ("s19", -16.5, 4.0, 1.32, 40),
                ("s71", 13.0, 8.0, 1.24, 210),
                ("s19", 7.0, 22.5, 1.12, 120),
                ("s71", -17.0, 23.0, 1.05, 300),
            ],
            "mid_ring": dict(count=11, r0=21, r1=33, scale=(0.9, 1.15), gaps=[(150, 210)]),
            "horizon_ring": dict(count=30, r0=42, r1=66, scale=(1.15, 1.6), gaps=[]),
            "tq_camera": ((25, -23, 12.0), (-2, 7, 1.0)),
        },
        "B": {
            "title": "Riverside Diagonal",
            "thesis": "The river runs NW-SE past the stage; the garden walk follows the bank, crosses the bridge, and finds the torii three-quarter across the water. Asymmetric, discovered in orbit.",
            "river": {
                "pts": [(-30, 30), (-20, 18), (-13, 8), (-10, -2), (-12, -14), (-18, -26), (-26, -34)],
                "half_width": 2.9,
                "depth": 1.3,
                "water_z": -0.45,
            },
            "stage": (2.5, 0.0, 10.0, 7.0, math.radians(12)),
            "torii": (-19.5, 13.5, math.radians(-38)),
            "bridge": (-11.2, -7.5, math.radians(8), 9.5, 2.4),
            "audience": [(2.5, 0, 8.5, 15.5, 95, 205)],
            "guests": [(6, -11), (10.5, -9), (2, -12.5), (13, -5), (8, -13), (4, -14.5)],
            "paths": [
                [(26, -30), (18, -20), (12, -14.5)],       # arrival SE
                [(12, -14.5), (4, -16.8), (-4, -14.5), (-8.2, -9.5)],  # to bridge along bank
                [(-14.4, -6.2), (-18, -0.5), (-19.5, 6.5), (-19.8, 11)],  # far-bank shrine walk
                [(12, -14.5), (17, -8), (18.5, 0), (16, 8), (11, 13)],  # east bank garden loop
                [(24, -24), (28, -14), (28.5, -4)],        # service spur far E
            ],
            "lanterns": [(19.4, -21.4), (12.8, -15.8), (-3.2, -15.2), (-8.0, -10.6), (-17.2, -2.2), (-19.6, 8.8), (17.6, -9.2), (12.2, 12.0)],
            "heroes": [
                ("s71", 11.0, 7.5, 1.35, 15),
                ("s19", -5.5, 12.5, 1.18, 250),
                ("s19", -24.0, 6.0, 1.1, 90),
                ("s71", 19.5, -15.5, 1.0, 180),
            ],
            "mid_ring": dict(count=11, r0=20, r1=33, scale=(0.9, 1.15), gaps=[(120, 175)]),
            "horizon_ring": dict(count=30, r0=42, r1=66, scale=(1.15, 1.6), gaps=[]),
            "tq_camera": ((30, -22, 13), (-8, 4, 0)),
        },
        "C": {
            "title": "Grove Room",
            "thesis": "The stage sits inside a grove pocket with hero canopies leaning over its edges. The stream wraps behind; the torii is off-axis, found during orbit. The most intimate and most canopied of the three.",
            "river": {
                "pts": [(-30, 6), (-20, 12), (-9, 16), (3, 17.5), (14, 15.5), (24, 10), (32, 2)],
                "half_width": 2.2,
                "depth": 1.1,
                "water_z": -0.38,
            },
            "stage": (0.0, -1.0, 9.0, 6.5, 0.0),
            "torii": (16.5, 21.5, math.radians(35)),
            "bridge": (10.0, 15.9, math.radians(75), 6.5, 2.2),
            "audience": [(0, -1, 7.5, 14.0, 135, 225)],
            "guests": [(-3.5, -10.5), (0, -12), (3.8, -10.8), (-6, -12.8), (6, -12.5)],
            "paths": [
                [(10, -30), (6, -21), (3.5, -15.8)],       # arrival S
                [(3.5, -15.8), (-3.5, -15.8)],             # crescent rim
                [(-3.5, -15.8), (-9.5, -11), (-12, -3), (-10.5, 6), (-7, 11.5)],  # west walk to stream
                [(8.5, -14.5), (12, -8), (13, 0), (11.5, 8), (10.3, 13)],  # east walk to bridge
                [(9.8, 19.3), (12.5, 20.6), (16.5, 21.4)],  # cross the bridge, arrive at the gate
            ],
            "lanterns": [(7.2, -22.4), (4.2, -16.8), (-8.4, -11.8), (-11.4, -3.0), (12.4, -8.6), (11.6, 8.4), (12.6, 21.6), (15.8, 21.2)],
            "heroes": [
                ("s19", -7.5, 3.5, 1.38, 65),
                ("s71", 8.5, 2.0, 1.30, 195),
                ("s19", -13.0, 9.0, 1.1, 320),
                ("s71", 3.0, 21.5, 1.08, 140),
                ("s19", 16.0, -6.5, 1.05, 20),
            ],
            "mid_ring": dict(count=13, r0=17, r1=30, scale=(0.9, 1.18), gaps=[(160, 200)]),
            "horizon_ring": dict(count=32, r0=40, r1=62, scale=(1.15, 1.6), gaps=[]),
            "tq_camera": ((-9, -22, 5.0), (3, 8, 1.5)),
        },
    }


# ---------------------------------------------------------------------------
# Scene assembly
# ---------------------------------------------------------------------------


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_world_and_lights():
    world = bpy.data.worlds.new("Night")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.020, 0.024, 0.058, 1.0)
    bg.inputs[1].default_value = 1.0

    moon = bpy.data.lights.new("Moon", type="SUN")
    moon.energy = 2.2
    moon.color = (0.78, 0.84, 1.0)
    moon.angle = math.radians(1.5)
    obj = bpy.data.objects.new("Moon", moon)
    obj.rotation_euler = (math.radians(52), 0, math.radians(-35))
    bpy.context.scene.collection.objects.link(obj)

    fill = bpy.data.lights.new("Fill", type="SUN")
    fill.energy = 0.35
    fill.color = (0.55, 0.5, 0.75)
    fobj = bpy.data.objects.new("Fill", fill)
    fobj.rotation_euler = (math.radians(65), 0, math.radians(140))
    bpy.context.scene.collection.objects.link(fobj)


def make_camera(name, loc, target, lens=32, ortho=None):
    cam_data = bpy.data.cameras.new(name)
    if ortho:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho
    else:
        cam_data.lens = lens
    cam_data.clip_end = 500
    cam = bpy.data.objects.new(name, cam_data)
    cam.location = loc
    bpy.context.scene.collection.objects.link(cam)
    tgt = bpy.data.objects.new(f"{name}_target", None)
    tgt.location = target
    bpy.context.scene.collection.objects.link(tgt)
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    return cam


def render_view(cam, path, res=(1600, 900), exposure=0.0):
    scene = bpy.context.scene
    scene.camera = cam
    scene.view_settings.exposure = exposure
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def build_and_render(board_key):
    layout = board_layouts()[board_key]
    clear_scene()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 32
    setup_world_and_lights()

    site = Site(layout)
    rng = random.Random(hash(board_key) & 0xFFFF)

    mats = {
        "terrain": make_material("terrain", (0.075, 0.105, 0.062, 1)),
        "lawn": make_material("lawn", (0.105, 0.148, 0.080, 1)),
        "path": make_material("path", (0.24, 0.185, 0.13, 1)),
        "water": make_material("water", (0.028, 0.065, 0.105, 1), rough=0.06),
        "wood": make_material("wood", (0.30, 0.20, 0.115, 1), rough=0.6),
        "wood_dark": make_material("wood_dark", (0.15, 0.10, 0.06, 1), rough=0.6),
        "stone": make_material("stone", (0.35, 0.34, 0.31, 1)),
        "lamp": make_material("lamp", (1, 0.7, 0.35, 1), emit=(1, 0.62, 0.28, 1), emit_strength=6.0),
        "vermillion": make_material("vermillion", (0.55, 0.10, 0.055, 1), rough=0.5),
        "vermillion_dark": make_material("vermillion_dark", (0.16, 0.05, 0.035, 1), rough=0.5),
        "figure": make_material("figure", (0.72, 0.45, 0.35, 1)),
        "figure_dim": make_material("figure_dim", (0.36, 0.30, 0.28, 1)),
    }

    build_terrain(site, mats["terrain"])
    # water sits INSIDE the carved channel so a visible bank lip remains
    build_ribbon("River_Water", site, layout["river"]["pts"],
                 layout["river"]["half_width"] * 1.4, 0,
                 mats["water"], z_abs=layout["river"]["water_z"])

    sx, sy, sw, sd, srot = layout["stage"]
    build_stage(site, sx, sy, sw, sd, mats, srot)

    for cx, cy, r0, r1, a0, a1 in layout["audience"]:
        build_disc("Audience_Lawn", site, cx, cy, r0, r1, a0, a1, 0.06, mats["lawn"])
    build_audience_figures(site, layout["guests"], mats)

    for pts in layout["paths"]:
        build_ribbon("Path", site, pts, 1.7, 0.07, mats["path"])

    tx, ty, trot = layout["torii"]
    build_torii(site, tx, ty, trot, mats)

    bx, by, brot, blen, bwid = layout["bridge"]
    build_bridge(site, bx, by, brot, blen, bwid, layout["river"]["water_z"], mats)

    for i, (lx, ly) in enumerate(layout["lanterns"]):
        build_lantern(site, lx, ly, mats, i)

    sources = import_tree_sources()
    plantable = Plantability(layout)

    # Authored hero positions are checked by the SAME rule as the scattered
    # rings — a hand-placed trunk in a walkway is still a trunk in a walkway.
    keep_out = []
    hero_records = []
    hero_violations = []
    for v, x, y, s, rot in layout["heroes"]:
        blocker = plantable.blocked_by(x, y, s)
        if blocker:
            hero_violations.append(f"hero {v} at ({x}, {y}) obstructs {blocker}")
            continue
        place_tree(sources, site, v, x, y, s, rot, f"Hero_{v}_{x}_{y}")
        hero_records.append((x, y, s))
        keep_out.append((x, y, 5.0 * s))
    for violation in hero_violations:
        print(f"BLOCKED: {violation}")

    mid = layout["mid_ring"]
    mids = scatter_ring(rng, site, sources, plantable, mid["count"], mid["r0"], mid["r1"],
                        keep_out, mid["scale"], "Mid", mid["gaps"])
    hz = layout["horizon_ring"]
    horizon = scatter_ring(rng, site, sources, plantable, hz["count"], hz["r0"], hz["r1"],
                           keep_out + [(x, y, 3.5) for x, y, _ in mids],
                           hz["scale"], "Horizon", hz["gaps"])

    # ---- metrics ---------------------------------------------------------
    river_pts = layout["river"]["pts"]
    metrics = {
        "board": board_key,
        "title": layout["title"],
        "thesis": layout["thesis"],
        "stage": {"center": [sx, sy], "size": [sw, sd]},
        "riverWidthMetres": layout["river"]["half_width"] * 2,
        "stageToRiverMetres": round(polyline_distance(sx, sy, river_pts), 1),
        "stageToToriiMetres": round(math.hypot(tx - sx, ty - sy), 1),
        "stageToBridgeMetres": round(math.hypot(bx - sx, by - sy), 1),
        "heroTrees": len(hero_records),
        "heroViolations": hero_violations,
        "midTrees": len(mids),
        "horizonTrees": len(horizon),
        "treeVariantsUsed": ["open-crown-s19", "open-crown-s71"],
        "lanterns": len(layout["lanterns"]),
        "audienceLawnDepthMetres": [layout["audience"][0][2], layout["audience"][0][3]],
        "hero_nearest_to_stage": round(
            min(math.hypot(x - sx, y - sy) for x, y, _ in hero_records), 1
        ),
        "proposedOrbitCapMetres": 30,
        "clearingRadiusMetres": BERM_START,
        "worldRadiusMetres": WORLD_RADIUS,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, f"board-{board_key}-metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # ---- cameras ---------------------------------------------------------
    stage_z = site.height(sx, sy)
    fwd = (math.sin(srot), -math.cos(srot))  # audience side (south when rot=0)
    front_cam = make_camera(
        "front",
        (sx + fwd[0] * 15.5, sy + fwd[1] * 15.5, stage_z + 2.9),
        (sx - fwd[0] * 8.0, sy - fwd[1] * 8.0, stage_z + 2.0),
        lens=30,
    )
    audience_cam = make_camera(
        "audience",
        (sx + fwd[0] * 20.0 - fwd[1] * 3.0, sy + fwd[1] * 20.0 + fwd[0] * 3.0, stage_z + 2.2),
        (sx - fwd[0] * 2.0, sy - fwd[1] * 2.0, stage_z + 2.0),
        lens=34,
    )
    tq_pos, tq_target = layout.get(
        "tq_camera",
        ((sx - 26, sy - 21, stage_z + 10.5), (sx + 1, sy + 7, stage_z + 1)),
    )
    tq_cam = make_camera("threequarter", tq_pos, tq_target, lens=30)
    top_cam = make_camera("top", (sx, sy + 4, 95), (sx, sy + 4, 0), ortho=95)

    render_view(front_cam, os.path.join(OUT_DIR, f"board-{board_key}-front.png"))
    render_view(audience_cam, os.path.join(OUT_DIR, f"board-{board_key}-audience.png"))
    render_view(tq_cam, os.path.join(OUT_DIR, f"board-{board_key}-threequarter.png"))
    render_view(top_cam, os.path.join(OUT_DIR, f"board-{board_key}-top.png"), res=(1300, 1300), exposure=1.4)
    print(f"BOARD {board_key} DONE")


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    board = "A"
    if "--board" in args:
        board = args[args.index("--board") + 1]
    build_and_render(board)


if __name__ == "__main__":
    main()
