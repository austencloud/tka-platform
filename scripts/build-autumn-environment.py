"""Author the Enchanted Autumn Dusk environment in Blender.

The scene is laid out as an ecology rather than a scatter pass. A protected
performance clearing, an irregular pond basin, tree and log footprints, and
rock footprints are used as explicit placement masks. Ferns grow in shaded
clusters, leaves collect in root and log drifts, and every shoreline object is
kept out of the water volume. The resulting editable ``.blend`` is the source
of truth; ``blender-export-autumn-full.py`` creates the clean runtime GLB.
"""

import hashlib
import json
import math
import os
import random
import subprocess
import tempfile

import bpy
from mathutils import Matrix, Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
GROUND_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "autumn-ground-layout.json")
with open(GROUND_LAYOUT_PATH, "rb") as ground_layout_file:
    GROUND_LAYOUT_BYTES = ground_layout_file.read()
GROUND_LAYOUT = json.loads(GROUND_LAYOUT_BYTES)
GROUND_LAYOUT_SHA256 = hashlib.sha256(GROUND_LAYOUT_BYTES).hexdigest()

MUSHROOM_LAYOUT_PATH = os.path.join(SCRIPT_DIR, "autumn-mushroom-layout.json")
with open(MUSHROOM_LAYOUT_PATH, "r", encoding="utf-8") as mushroom_layout_file:
    MUSHROOM_LAYOUT = json.load(mushroom_layout_file)
MODEL_DIR = os.path.join(PROJECT_ROOT, "static", "models", "autumn")
AUTUMN_FLOOR_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "autumn-floor")
FOREST_FLOOR_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "forest-floor")
DIRT_TEXTURE_DIR = os.path.join(PROJECT_ROOT, "static", "textures", "terrain", "dirt")
BLEND_PATH = os.path.join(PROJECT_ROOT, "blender", "autumn_environment.blend")
QA_DIR = os.path.join(tempfile.gettempdir(), "tka-autumn-evidence")
QA_PATHS = {
    "hero": os.path.join(QA_DIR, "autumn_environment_qa.png"),
    "floor": os.path.join(QA_DIR, "autumn_environment_qa_floor.png"),
    "pond": os.path.join(QA_DIR, "autumn_environment_qa_pond.png"),
    "reverse": os.path.join(QA_DIR, "autumn_environment_qa_reverse.png"),
    "owl": os.path.join(QA_DIR, "autumn_environment_qa_owl.png"),
    "owl_root": os.path.join(QA_DIR, "autumn_environment_qa_owl_root.png"),
    "champignon": os.path.join(QA_DIR, "autumn_environment_qa_champignon.png"),
    "amethyst": os.path.join(QA_DIR, "autumn_environment_qa_amethyst.png"),
    "honey": os.path.join(QA_DIR, "autumn_environment_qa_honey.png"),
    "depth": os.path.join(QA_DIR, "autumn_environment_qa_depth.png"),
    "shack": os.path.join(QA_DIR, "autumn_environment_qa_shack.png"),
    "settlement": os.path.join(QA_DIR, "autumn_environment_qa_settlement.png"),
}

CLEARING_RADIUS = float(GROUND_LAYOUT["clearingRadius"])
STAGE_HALF_WIDTH = 3.0
STAGE_HALF_DEPTH = 3.0
STAGE_EDGE_LEAF_COUNT = 96
POND_X = -10.5
POND_Y = -7.0
POND_RX = 4.45
POND_RY = 3.35
POND_SEED = 4.2
POND_WATER_HEIGHT = -0.32

# The Meshy fern source is a 44K-triangle hero scan, but every authored fern is
# 0.6-0.8m tall and sits outside the protected clearing. Reusing that source 54
# times spent more geometry than the rest of the grove combined. Collapse it
# once before the hierarchy is duplicated: all placements retain the same
# textures, silhouette, wind-independent grounding, and shared mesh identity.
FERN_SOURCE_DECIMATE_RATIO = 0.16
FERN_SOURCE_MAX_TRIANGLES = 8_000

# Hero ring. Review found the right-hand crowns reading as the same asset at
# the same scale: they shared height, rotation and mirroring closely enough that
# the canopy layering, root buttress and vine drape lined up. Heights now spread
# 8.4-13.8m instead of 9.2-13.8, every neighbour alternates mirroring, rotations
# are spaced so no two adjacent crowns present the same face, and radii cluster
# rather than sitting on one circle.
TREE_PLACEMENTS = (
    ("HeroTreeA_01", "HeroA", -12.8, 6.5, 12.8, -0.20, 1.0, False, 2.55),
    ("HeroTreeA_02", "HeroA", 14.9, 9.6, 10.1, 0.42, 0.94, True, 2.20),
    # The back-center tree stays right of centre for a staggered sightline.
    ("HeroTreeA_03", "HeroA", 6.2, 18.3, 13.8, 3.03, 1.0, False, 2.75),
    ("HeroTreeA_04", "HeroA", -20.5, -0.4, 10.4, 0.72, 1.0, True, 2.25),
    ("HeroTreeB_01", "HeroB", -18.2, -9.2, 10.8, -0.58, 1.0, False, 2.45),
    ("HeroTreeB_02", "HeroB", 16.0, -6.8, 8.4, 1.94, 0.86, False, 1.95),
    # HeroTreeB_03 was removed after exact-view review. Its pale photographic
    # atlas never shared the foreground grove's material language, and its
    # back-left placement made that mismatch a focal point from the stage.
    ("HeroTreeB_04", "HeroB", 20.4, 14.6, 12.2, -1.05, 1.08, True, 2.45),
)

# The hero ring shares two detailed meshes to preserve GPU instancing. Small
# per-instance aspect and lean changes break the repeated crown/root silhouette
# without copying vertex buffers or asking a generator for replacement trees.
# Values stay close enough to 1.0 that the authored footprint clearances remain
# valid. Lean is expressed in radians around the asset's rooted local origin.
HERO_TREE_SHAPE_VARIANTS = {
    "HeroTreeA_01": ((1.06, 0.95), (0.018, -0.032)),
    "HeroTreeA_02": ((0.93, 1.07), (-0.036, 0.015)),
    "HeroTreeA_03": ((1.04, 1.08), (0.026, 0.038)),
    "HeroTreeA_04": ((0.92, 1.05), (-0.022, -0.041)),
    "HeroTreeB_01": ((1.08, 0.94), (0.032, -0.018)),
    "HeroTreeB_02": ((0.94, 1.08), (-0.041, 0.024)),
    "HeroTreeB_04": ((0.95, 1.06), (-0.028, -0.035)),
}

# Tree assets have broad, uneven root plates. Their object origins cannot tell
# us whether the underside of those roots actually meets a rolling terrain
# surface, especially after per-instance scale, rotation, mirroring, and lean.
# Every tree is therefore seated from the transformed mesh itself. The lowest
# surface in each XY root cell must finish beneath the exact terrain height at
# that point, with enough overlap to survive mesh simplification and uneven
# ground interpolation in the runtime GLB.
TREE_ROOT_CONTACT_MARGIN = 0.14
TREE_ROOT_CELL_SIZE = 0.42
# Four samples cover the cardinal sides of the deliberately low-poly far-tree
# trunks; scanned hero trees naturally contribute hundreds of envelope cells.
TREE_ROOT_MIN_CONTACT_SAMPLES = 4
TREE_ROOT_CONTACT_STRATEGY = "transformed-root-envelope-v1"
TREE_GROUNDING_RESULTS = {}

# A second, lower canopy tier closes the empty horizon without turning the
# performance clearing into a wall. Four deliberately different families form
# its rhythm: white birch clusters, bare snags, conical golden larches, and
# low drooping willows. The central gap remains open for the moon.
# The belt used to sit at a near-constant 26m radius, which read as a literal
# ring of trees around a circular clearing at wide framings. Radii now range
# 21.5-29.5m in deliberate clusters with gaps between them, and heights spread
# 5.8-10.4m so the silhouette against the sky varies instead of forming an even
# hedge. Two members are pulled inside 22m as near-field framing elements. The
# central gap above the moon stays open.
DISTANT_TREE_PLACEMENTS = (
    ("DistantBirch_01", "Birch", -27.4, 4.5, 8.6, -0.44, 0.94, False, 1.55),
    ("DistantLarch_01", "Larch", -23.1, 13.4, 10.4, 0.72, 1.02, True, 1.45),
    ("DistantSnag_01", "Snag", -21.5, 21.8, 9.5, -0.18, 1.0, False, 1.35),
    ("DistantWillow_01", "Willow", -13.8, 25.4, 7.1, 1.82, 0.96, False, 1.78),
    ("DistantSnag_02", "Snag", 2.4, 28.2, 6.4, 0.38, 0.92, True, 1.25),
    ("DistantBirch_02", "Birch", 10.2, 23.6, 9.7, -1.28, 1.04, True, 1.70),
    ("DistantSnag_03", "Snag", 18.9, 22.0, 8.2, 0.93, 0.96, False, 1.30),
    ("DistantWillow_02", "Willow", 24.6, 15.1, 7.9, 2.52, 1.0, False, 1.82),
    ("DistantSnag_04", "Snag", 28.1, 8.5, 10.1, -0.70, 1.02, True, 1.35),
    ("DistantLarch_02", "Larch", 25.2, -1.8, 6.7, 1.17, 0.93, True, 1.38),
    ("DistantBirch_03", "Birch", -26.2, -5.0, 7.5, -2.14, 0.92, False, 1.45),
    # Lower secondary crowns close the exposed terrain band while keeping the
    # tall-tree spacing and moon opening readable.
    ("DistantWillow_03", "Willow", -29.5, 17.2, 5.8, 0.42, 0.95, True, 1.52),
    ("DistantLarch_03", "Larch", -18.0, 27.6, 6.9, -1.62, 1.0, False, 1.18),
    ("DistantBirch_04", "Birch", -10.8, 26.0, 6.5, 2.18, 0.92, True, 1.22),
    ("DistantLarch_04", "Larch", 6.2, 29.1, 8.4, -0.82, 0.96, False, 1.18),
    # Pulled inside the belt radius as near-field framing rather than ring fill.
    ("DistantBirch_05", "Birch", 16.8, 21.6, 6.2, 1.42, 0.98, True, 1.28),
    ("DistantSnag_05", "Snag", -22.4, -13.8, 7.2, -2.34, 0.94, False, 1.18),
)

# Forest gains its depth from overlapping masses, not a larger ring. Autumn's
# original 21-30m belt remains the readable middle silhouette; this third tier
# bridges it to the horizon in asymmetric left/right groves while keeping a
# winding opening behind the stage. These still use the textured Autumn tree
# families because they are close enough for bark and canopy structure to read.
MID_DEPTH_TREE_PLACEMENTS = (
    ("MidDepthBirch_NW_01", "Birch", -34.0, 10.0, 7.6, -0.42, 0.94, False, 1.45),
    ("MidDepthLarch_NW_01", "Larch", -39.0, 24.0, 8.8, 0.68, 1.03, True, 1.40),
    ("MidDepthWillow_NW_01", "Willow", -31.0, 36.0, 6.9, 1.72, 0.92, False, 1.65),
    ("MidDepthSnag_NW_01", "Snag", -22.0, 44.0, 7.8, -0.18, 0.96, False, 1.10),
    ("MidDepthBirch_NW_02", "Birch", -17.0, 56.0, 6.2, 2.06, 0.90, True, 1.28),
    ("MidDepthLarch_NW_02", "Larch", -30.0, 58.0, 7.4, -1.14, 0.98, False, 1.24),
    ("MidDepthBirch_NE_01", "Birch", 34.0, 10.0, 7.2, 0.38, 0.92, True, 1.40),
    ("MidDepthWillow_NE_01", "Willow", 39.0, 24.0, 7.5, -1.52, 0.96, True, 1.68),
    ("MidDepthLarch_NE_01", "Larch", 31.0, 36.0, 8.5, 1.04, 1.02, False, 1.38),
    ("MidDepthSnag_NE_01", "Snag", 23.0, 44.0, 7.4, -0.76, 0.94, True, 1.08),
    ("MidDepthBirch_NE_02", "Birch", 18.0, 56.0, 6.4, 2.52, 0.91, False, 1.30),
    ("MidDepthLarch_NE_02", "Larch", 32.0, 58.0, 7.6, -2.20, 0.97, True, 1.26),
    # Bridge trees overlap the old belt in depth without closing the sightline.
    ("MidDepthWillow_WBridge", "Willow", -16.0, 34.0, 6.2, 0.55, 0.90, True, 1.52),
    ("MidDepthBirch_EBridge", "Birch", 15.0, 33.0, 6.8, -0.92, 0.95, False, 1.35),
    ("MidDepthSnag_WBridge", "Snag", -12.0, 48.0, 6.3, 1.44, 0.90, False, 1.02),
    ("MidDepthLarch_EBridge", "Larch", 13.0, 47.0, 7.2, -1.84, 0.96, True, 1.20),
    # Side and reverse masses prevent the composition collapsing when the
    # viewer orbits away from the hero axis.
    ("MidDepthBirch_SW_01", "Birch", -42.0, -12.0, 6.8, 0.24, 0.92, False, 1.34),
    ("MidDepthSnag_SW_01", "Snag", -34.0, -26.0, 7.0, -1.20, 0.95, True, 1.06),
    ("MidDepthLarch_SW_01", "Larch", -20.0, -36.0, 7.8, 2.12, 0.98, False, 1.26),
    ("MidDepthWillow_SE_01", "Willow", 38.0, -14.0, 6.6, -0.48, 0.91, False, 1.58),
    ("MidDepthBirch_SE_01", "Birch", 32.0, -28.0, 6.5, 1.82, 0.94, True, 1.32),
    ("MidDepthSnag_SE_01", "Snag", 18.0, -38.0, 7.2, -2.56, 0.96, False, 1.08),
)

# The far tier is deliberately low-poly. At 50-105m, textured hero geometry
# would spend millions of rasterized vertices on silhouettes softened by fog.
# Four procedural families preserve Autumn's broadleaf/larch/snag rhythm for a
# few hundred triangles per family, then reuse those meshes through instancing.
FAR_DEPTH_TREE_PLACEMENTS = (
    ("FarDepthRed_NW_01", "FarRed", -50.0, 48.0, 7.2, -0.30, 0.94, False),
    ("FarDepthGold_NW_01", "FarGold", -42.0, 59.0, 6.4, 0.72, 1.02, True),
    ("FarDepthLarch_NW_01", "FarLarch", -34.0, 70.0, 7.8, -1.16, 0.98, False),
    ("FarDepthRed_NW_02", "FarRed", -24.0, 80.0, 6.8, 1.88, 0.93, True),
    ("FarDepthSnag_NW_01", "FarSnag", -16.0, 90.0, 7.1, -0.62, 0.96, False),
    ("FarDepthGold_NW_02", "FarGold", -57.0, 75.0, 6.9, 2.34, 0.92, False),
    ("FarDepthLarch_NW_02", "FarLarch", -41.0, 95.0, 7.4, -2.40, 1.02, True),
    ("FarDepthGold_NE_01", "FarGold", 50.0, 47.0, 7.0, 0.26, 0.95, True),
    ("FarDepthRed_NE_01", "FarRed", 43.0, 60.0, 6.7, -0.84, 1.00, False),
    ("FarDepthLarch_NE_01", "FarLarch", 35.0, 71.0, 8.0, 1.24, 0.97, True),
    ("FarDepthGold_NE_02", "FarGold", 24.0, 81.0, 6.5, -1.72, 0.93, False),
    ("FarDepthSnag_NE_01", "FarSnag", 17.0, 92.0, 7.3, 0.54, 0.98, True),
    ("FarDepthRed_NE_02", "FarRed", 58.0, 73.0, 7.1, -2.08, 0.94, True),
    ("FarDepthLarch_NE_02", "FarLarch", 42.0, 96.0, 7.6, 2.64, 1.01, False),
    # A single gold larch terminates the path without becoming a landmark prop.
    ("FarDepthGoldenSentinel", "FarLarch", 8.0, 103.0, 8.3, -0.18, 1.04, False),
    ("FarDepthRed_W_01", "FarRed", -72.0, 12.0, 7.0, 0.44, 0.95, False),
    ("FarDepthLarch_W_01", "FarLarch", -79.0, 32.0, 7.8, -1.32, 1.00, True),
    ("FarDepthSnag_W_01", "FarSnag", -74.0, -13.0, 7.2, 1.90, 0.96, False),
    ("FarDepthGold_W_01", "FarGold", -65.0, -33.0, 6.5, -2.44, 0.94, True),
    ("FarDepthRed_W_02", "FarRed", -83.0, -43.0, 7.4, 0.96, 0.98, False),
    ("FarDepthGold_E_01", "FarGold", 72.0, 11.0, 6.8, -0.36, 0.94, True),
    ("FarDepthLarch_E_01", "FarLarch", 79.0, 31.0, 8.1, 1.46, 1.01, False),
    ("FarDepthSnag_E_01", "FarSnag", 74.0, -15.0, 7.0, -1.96, 0.95, True),
    ("FarDepthRed_E_01", "FarRed", 65.0, -35.0, 6.9, 2.36, 0.96, False),
    ("FarDepthGold_E_02", "FarGold", 83.0, -45.0, 7.3, -0.88, 0.98, True),
    ("FarDepthRed_S_01", "FarRed", -51.0, -51.0, 7.2, 0.18, 0.96, True),
    ("FarDepthGold_S_01", "FarGold", -33.0, -65.0, 6.8, -1.04, 0.93, False),
    ("FarDepthLarch_S_01", "FarLarch", -15.0, -77.0, 7.9, 1.58, 1.00, True),
    ("FarDepthSnag_S_01", "FarSnag", 18.0, -76.0, 7.2, -2.16, 0.96, False),
    ("FarDepthRed_S_02", "FarRed", 36.0, -63.0, 7.0, 0.74, 0.94, True),
    ("FarDepthGold_S_02", "FarGold", 53.0, -49.0, 6.6, -1.74, 0.95, False),
    ("FarDepthLarch_SW_01", "FarLarch", -67.0, -70.0, 8.0, 2.46, 0.98, False),
    ("FarDepthRed_SE_01", "FarRed", 68.0, -72.0, 7.5, -2.62, 0.97, True),
    # The first complete orbit exposed an empty reverse/side backlot between
    # the hero grove and the outer silhouette belt. These inexpensive inner
    # silhouettes close that gap without spending imported-tree geometry.
    ("FarDepthGold_SW_Inner", "FarGold", -42.0, -34.0, 6.5, -0.62, 0.94, False),
    ("FarDepthRed_SW_Inner", "FarRed", -30.0, -46.0, 7.0, 1.18, 0.96, True),
    ("FarDepthLarch_S_Inner", "FarLarch", -10.0, -48.0, 7.6, -1.86, 0.98, False),
    ("FarDepthGold_S_Inner", "FarGold", 10.0, -50.0, 6.7, 2.38, 0.93, True),
    ("FarDepthRed_SE_Inner", "FarRed", 30.0, -45.0, 7.1, -0.94, 0.95, False),
    ("FarDepthLarch_SE_Inner", "FarLarch", 43.0, -34.0, 7.8, 1.72, 0.97, True),
    ("FarDepthSnag_W_Inner", "FarSnag", -49.0, -8.0, 7.0, -2.24, 0.96, False),
    ("FarDepthGold_W_Inner", "FarGold", -51.0, 18.0, 6.6, 0.82, 0.94, True),
    ("FarDepthRed_E_Inner", "FarRed", 50.0, -8.0, 6.9, -1.42, 0.95, True),
    ("FarDepthLarch_E_Inner", "FarLarch", 52.0, 18.0, 7.7, 2.16, 0.98, False),
    ("FarDepthSnag_S_Inner", "FarSnag", 0.0, -56.0, 7.2, 0.34, 0.97, True),
    ("FarDepthGold_S_Closer", "FarGold", -13.0, -35.0, 7.1, -1.08, 0.97, True),
    ("FarDepthRed_S_Closer", "FarRed", 0.0, -38.0, 7.4, 0.46, 0.98, False),
    ("FarDepthLarch_S_Closer", "FarLarch", 14.0, -34.0, 7.8, 1.94, 0.97, True),
    ("FarDepthRed_S_Grove_01", "FarRed", -25.0, -43.0, 7.5, 0.82, 0.96, False),
    ("FarDepthLarch_S_Grove_01", "FarLarch", -19.0, -37.0, 8.4, -1.64, 0.98, True),
    ("FarDepthGold_S_Grove_01", "FarGold", -7.0, -44.0, 7.0, 2.28, 0.95, False),
    ("FarDepthGold_S_Grove_02", "FarGold", 7.0, -42.0, 7.2, -0.72, 0.96, True),
    ("FarDepthLarch_S_Grove_02", "FarLarch", 19.0, -38.0, 8.2, 1.42, 0.97, False),
    ("FarDepthRed_S_Grove_02", "FarRed", 26.0, -44.0, 7.4, -2.08, 0.96, True),
)

# The settlement now has a route with an actual destination. The broad lane
# leaves the rear of the stage, opens into a shared yard between the hero
# trees, then narrows toward the shack's south-facing door. A quieter branch
# continues toward the golden larch so the original depth sightline survives
# without making the cabin feel unrelated to the path.
GROUND_PATHS_BY_ID = {path["id"]: path for path in GROUND_LAYOUT["paths"]}
CABIN_LANE_DEFINITION = GROUND_PATHS_BY_ID["cabin_lane"]
FOREST_TRAIL_DEFINITION = GROUND_PATHS_BY_ID["forest_trail"]
CABIN_LANE_POINTS = tuple(tuple(point) for point in CABIN_LANE_DEFINITION["points"])
FOREST_TRAIL_POINTS = tuple(tuple(point) for point in FOREST_TRAIL_DEFINITION["points"])

GROUND_YARDS_BY_NAME = {yard["name"]: yard for yard in GROUND_LAYOUT["yards"]}


def yard_region(name):
    yard = GROUND_YARDS_BY_NAME[name]
    return (
        *yard["center"],
        *yard["radii"],
        yard["rotation"],
        yard["seed"],
    )


SHARED_YARD = yard_region("Autumn_Shared_Yard")
SHACK_DOOR_YARD = yard_region("Autumn_Shack_Door_Yard")

# The only distant sign of habitation sits off the worn route, behind the
# western bridge snag. From the performance camera it should read as a roofline
# and dark window discovered between trunks, never as the scene's main subject.
DISTANT_CABIN_PLACEMENT = (
    "DistantWoodlandShack",
    -10.0,
    56.0,
    4.9,
    0.08,
    False,
)

SAPLING_PLACEMENTS = (
    ("Sapling_01", 10.0, 31.0, 2.9, -0.34, False, 0.90),
    ("Sapling_02", 10.5, -12.2, 3.2, 1.52, True, 0.95),
    ("Sapling_03", -18.0, 8.5, 2.7, -1.05, False, 0.85),
    ("Sapling_04", 17.0, 17.5, 3.0, 2.42, True, 0.90),
)

LOG_PLACEMENTS = (
    ("FallenLog_01", 8.5, 7.0, 1.4, -0.42, 1.0, False, 2.6),
    ("FallenLog_02", -14.0, 13.0, 1.15, 1.33, 1.0, True, 2.35),
    ("FallenLog_03", 17.5, 1.5, 1.0, 0.32, 1.0, False, 2.15),
)

FERN_CLUSTERS = (
    (-15.6, 3.5, 4),
    (10.8, 5.3, 4),
    (-7.0, 13.1, 4),
    (9.7, 14.6, 4),
    (13.0, -3.0, 3),
    (-15.6, -3.0, 3),
    (-7.2, -10.5, 4),
    (-11.0, -2.7, 4),
    (7.3, -3.0, 4),
    (4.8, 7.7, 4),
    (-6.9, 5.4, 4),
    (2.8, 8.3, 4),
    (-3.2, -8.0, 4),
    (8.8, 1.8, 4),
)

# Mushroom fruiting bodies follow substrate and host ecology instead of using
# one Meshy clump as a decorative stamp. The only actual fairy ring is a broken
# arc of small buff champignons in the open grass. Purple amethyst deceivers
# appear as loose individuals in leaf litter near mature roots, while denser
# honey-fungus colonies are reserved for fallen wood.
_FAIRY_CHAMPIGNON_ARC = MUSHROOM_LAYOUT["fairyChampignonArc"]
FAIRY_CHAMPIGNON_ARC = (
    _FAIRY_CHAMPIGNON_ARC["name"],
    *_FAIRY_CHAMPIGNON_ARC["center"],
    _FAIRY_CHAMPIGNON_ARC["radius"],
    _FAIRY_CHAMPIGNON_ARC["count"],
    _FAIRY_CHAMPIGNON_ARC["phase"],
)
FAIRY_CHAMPIGNON_GAPS = set(_FAIRY_CHAMPIGNON_ARC["gaps"])

AMETHYST_DECEIVER_DRIFTS = tuple(
    (
        drift["name"],
        *drift["center"],
        drift["count"],
        *drift["spread"],
    )
    for drift in MUSHROOM_LAYOUT["amethystDeceiverDrifts"]
)

HONEY_FUNGUS_COLONIES = tuple(
    (
        colony["name"],
        *colony["center"],
        colony["count"],
        *colony["spread"],
    )
    for colony in MUSHROOM_LAYOUT["honeyFungusColonies"]
)

GRASS_COLONIES = (
    (-7.0, 5.5, 2.4, 1.5),
    (5.8, 6.9, 2.6, 1.5),
    (7.8, -3.4, 2.4, 1.7),
    (-3.8, -8.5, 2.8, 1.7),
    (1.5, 10.0, 3.2, 1.8),
    (11.8, 3.2, 2.8, 1.8),
    (-14.8, 2.2, 3.0, 2.0),
    (12.4, -9.7, 3.1, 1.9),
    (-7.0, 14.0, 2.9, 1.8),
    (15.3, 11.8, 2.6, 1.7),
    (-17.0, -5.2, 3.0, 1.8),
    (0.0, 17.0, 3.2, 1.8),
    # Outer colonies. Review found grass existing only as an annulus with a hard
    # outer termination and completely bare terrain beyond the tree ring. These
    # sit past the old edge and, combined with the radial acceptance ramp in
    # sample_grass_positions, let density fade to nothing instead of stopping.
    (-20.5, 9.5, 3.4, 2.2),
    (19.5, 4.0, 3.4, 2.2),
    (-9.5, 21.0, 3.2, 2.0),
    (9.0, 21.5, 3.2, 2.0),
    (-19.0, -13.0, 3.0, 2.0),
    (17.5, -14.0, 3.0, 2.0),
)

# Beyond this radius grass thins out rather than stopping dead.
GRASS_FEATHER_START = 17.5
GRASS_FEATHER_END = 26.0

# Owl perch. Review found the owl unlocatable at every runtime framing: at 7.0m
# up it sat inside the canopy mass of HeroTreeA_03, a dark shape against dark
# leaves. Dropping it to 5.4m puts it on the open trunk below the crown, where
# it silhouettes against fog-lit background instead, and the size below is the
# largest that still reads as a real owl rather than a prop.
OWL_POSITION = (5.3, 17.55, 5.4)
OWL_HEIGHT = 1.42
# The Meshy owl carries a short branch under its closed talons; the connector
# meets that branch, not the owl's own origin.
OWL_BRANCH_DROP = 0.52

for path in (MODEL_DIR, os.path.dirname(BLEND_PATH), QA_DIR):
    os.makedirs(path, exist_ok=True)


def reset_scene_contents():
    """Clear authored data without disabling the live Blender MCP add-on."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for data_blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.worlds,
    ):
        for data_block in list(data_blocks):
            data_blocks.remove(data_block)


reset_scene_contents()
random.seed(20260806)


def principled_material(name, color, roughness=0.82, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
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


def forest_floor_material(
    name,
    tint,
    tint_strength=0.62,
    roughness_value=0.94,
    texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    diffuse_name="albedo.png",
    normal_name="normal.png",
    roughness_name="roughness.png",
    normal_texture_dir=None,
    roughness_texture_dir=None,
    saturation=0.86,
    grade_value=1.0,
    diffuse_uv_name=None,
    detail_uv_name=None,
):
    """Build one texture family with distinct ecological color regions."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*tint, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness_value

    diffuse_path = os.path.join(texture_dir, diffuse_name)
    normal_path = os.path.join(normal_texture_dir or texture_dir, normal_name)
    roughness_path = os.path.join(roughness_texture_dir or texture_dir, roughness_name)
    if os.path.isfile(diffuse_path):
        diffuse = nodes.new("ShaderNodeTexImage")
        diffuse.name = f"{name} Diffuse"
        diffuse.image = bpy.data.images.load(diffuse_path, check_existing=True)
        diffuse.image.colorspace_settings.name = "sRGB"
        if diffuse_uv_name:
            diffuse_uv = nodes.new("ShaderNodeUVMap")
            diffuse_uv.name = f"{name} Diffuse UV"
            diffuse_uv.uv_map = diffuse_uv_name
            links.new(diffuse_uv.outputs["UV"], diffuse.inputs["Vector"])
        if tint_strength <= 0.0:
            # Runtime floor families are pre-graded as image pixels. A direct
            # texture connection is faithfully represented by glTF, unlike
            # Blender-only color grading nodes that exporters may ignore.
            links.new(diffuse.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            grade = nodes.new("ShaderNodeHueSaturation")
            grade.name = f"{name} Woodland Grade"
            grade.inputs["Saturation"].default_value = saturation
            grade.inputs["Value"].default_value = grade_value
            tint_node = nodes.new("ShaderNodeRGB")
            tint_node.name = f"{name} Tint"
            tint_node.outputs[0].default_value = (*tint, 1.0)
            multiply = nodes.new("ShaderNodeMixRGB")
            multiply.name = f"{name} Tint Multiply"
            multiply.blend_type = "MULTIPLY"
            multiply.inputs[0].default_value = tint_strength
            links.new(diffuse.outputs["Color"], grade.inputs["Color"])
            links.new(grade.outputs["Color"], multiply.inputs[1])
            links.new(tint_node.outputs[0], multiply.inputs[2])
            links.new(multiply.outputs[0], bsdf.inputs["Base Color"])
    if os.path.isfile(roughness_path):
        roughness = nodes.new("ShaderNodeTexImage")
        roughness.name = f"{name} Roughness"
        roughness.image = bpy.data.images.load(roughness_path, check_existing=True)
        roughness.image.colorspace_settings.name = "Non-Color"
        if detail_uv_name:
            detail_uv = nodes.new("ShaderNodeUVMap")
            detail_uv.name = f"{name} Detail UV"
            detail_uv.uv_map = detail_uv_name
            links.new(detail_uv.outputs["UV"], roughness.inputs["Vector"])
        links.new(roughness.outputs["Color"], bsdf.inputs["Roughness"])
    if os.path.isfile(normal_path):
        normal = nodes.new("ShaderNodeTexImage")
        normal.name = f"{name} Normal"
        normal.image = bpy.data.images.load(normal_path, check_existing=True)
        normal.image.colorspace_settings.name = "Non-Color"
        if detail_uv_name:
            detail_uv = nodes.get(f"{name} Detail UV") or nodes.new("ShaderNodeUVMap")
            detail_uv.name = f"{name} Detail UV"
            detail_uv.uv_map = detail_uv_name
            links.new(detail_uv.outputs["UV"], normal.inputs["Vector"])
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = 0.58
        links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def preview_water_material():
    mat = bpy.data.materials.new("QA Pond Water")
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.018, 0.070, 0.095, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.28
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.333
    bsdf.inputs["Alpha"].default_value = 0.88
    emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    emission_strength = bsdf.inputs.get("Emission Strength")
    if emission:
        emission.default_value = (0.008, 0.040, 0.058, 1.0)
    if emission_strength:
        emission_strength.default_value = 0.11
    ior_level = bsdf.inputs.get("IOR Level")
    if ior_level:
        ior_level.default_value = 0.2
    coat = bsdf.inputs.get("Coat Weight") or bsdf.inputs.get("Clearcoat")
    coat_roughness = bsdf.inputs.get("Coat Roughness") or bsdf.inputs.get("Clearcoat Roughness")
    transmission = bsdf.inputs.get("Transmission Weight") or bsdf.inputs.get("Transmission")
    if coat:
        coat.default_value = 0.42
    if coat_roughness:
        coat_roughness.default_value = 0.10
    if transmission:
        transmission.default_value = 0.05
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.4
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.68
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.17
    bump.inputs["Distance"].default_value = 0.10
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


EARTH = forest_floor_material(
    "Autumn Living Forest Floor",
    (1.0, 1.0, 1.0),
    0.0,
    texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    diffuse_name="autumn-ground-zoned.jpg",
    normal_name="normal.png",
    roughness_name="roughness.png",
    normal_texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    roughness_texture_dir=AUTUMN_FLOOR_TEXTURE_DIR,
    diffuse_uv_name="Autumn Ground Macro UV",
    detail_uv_name="Autumn Ground Detail UV",
)
DAMP_EARTH = forest_floor_material(
    "Damp Pond Bank",
    (1.0, 1.0, 1.0),
    0.0,
    0.88,
    AUTUMN_FLOOR_TEXTURE_DIR,
    "shadow-albedo.jpg",
    "normal.jpg",
    "roughness.jpg",
    FOREST_FLOOR_TEXTURE_DIR,
    FOREST_FLOOR_TEXTURE_DIR,
)
ROCK = principled_material("Weathered Basalt", (0.115, 0.100, 0.110), roughness=0.91)
ROCK_DAMP = principled_material("Damp Basalt", (0.075, 0.068, 0.078), roughness=0.56)
ROCK_MOSS = principled_material("Moss on Stone", (0.105, 0.185, 0.075), roughness=0.96)
# Leaf duff, not confetti. The previous values (0.43/0.72/0.82 red) sat far
# above the forest floor's value range, so every card popped as a bright chip
# against dark soil regardless of its shape. Real fallen leaves are dark,
# desaturated and close in value to the duff they lie on; these are pulled down
# roughly 45% and slightly desaturated so the drifts read as accumulation.
LEAF_RED = principled_material("Leaf Litter Crimson", (0.145, 0.034, 0.026), roughness=0.92)
LEAF_ORANGE = principled_material("Leaf Litter Copper", (0.245, 0.082, 0.030), roughness=0.91)
LEAF_GOLD = principled_material("Leaf Litter Gold", (0.315, 0.165, 0.050), roughness=0.90)
TWIG = principled_material("Autumn Twig Litter", (0.10, 0.045, 0.022), roughness=0.96)
HABITATION_WOOD = principled_material(
    "Weathered Settlement Timber", (0.12, 0.052, 0.021), roughness=0.92
)
HABITATION_CUT_WOOD = principled_material(
    "Weathered Cut Timber", (0.31, 0.18, 0.075), roughness=0.88
)
HABITATION_METAL = principled_material(
    "Blackened Settlement Iron", (0.045, 0.042, 0.040), roughness=0.68, metallic=0.62
)
HABITATION_LANTERN = principled_material(
    "Low Amber Wayfinding Lantern",
    (0.34, 0.14, 0.025),
    roughness=0.42,
    emission=(1.0, 0.20, 0.025),
    emission_strength=1.35,
)
HABITATION_CABIN_GLOW = principled_material(
    "Low Amber Cabin Window",
    (0.32, 0.11, 0.018),
    roughness=0.46,
    emission=(1.0, 0.16, 0.018),
    emission_strength=1.8,
)
FAR_TRUNK = principled_material("Far Autumn Trunk", (0.075, 0.043, 0.052), roughness=0.98)
FAR_CANOPY_RED = principled_material(
    "Far Autumn Canopy Red", (0.20, 0.048, 0.035), roughness=0.96
)
FAR_CANOPY_GOLD = principled_material(
    "Far Autumn Canopy Gold", (0.28, 0.13, 0.035), roughness=0.95
)
FAR_CANOPY_SHADOW = principled_material(
    "Far Autumn Canopy Shadow", (0.085, 0.035, 0.065), roughness=0.98
)
GRASS_BASE = principled_material("Autumn Wind Grass Base", (0.095, 0.125, 0.035), roughness=0.95)
GRASS_MEDIUM = principled_material("Autumn Wind Grass Medium", (0.075, 0.105, 0.028), roughness=0.96)
GRASS_HIGH = principled_material("Autumn Wind Grass High", (0.115, 0.135, 0.040), roughness=0.94)
MUSHROOM_STEM_PALE = principled_material(
    "Autumn Mushroom Pale Stem", (0.46, 0.38, 0.27), roughness=0.91
)
MUSHROOM_STEM_LILAC = principled_material(
    "Autumn Mushroom Lilac Stem", (0.24, 0.11, 0.24), roughness=0.88
)
MUSHROOM_CHAMPIGNON_CAP = principled_material(
    "Autumn Fairy Champignon Cap",
    (0.38, 0.25, 0.13),
    roughness=0.90,
    emission=(0.20, 0.08, 0.018),
    emission_strength=0.12,
)
MUSHROOM_AMETHYST_CAP = principled_material(
    "Autumn Amethyst Deceiver Cap",
    (0.24, 0.055, 0.28),
    roughness=0.82,
    emission=(0.15, 0.025, 0.18),
    emission_strength=0.18,
)
MUSHROOM_HONEY_CAP = principled_material(
    "Autumn Honey Fungus Cap",
    (0.47, 0.21, 0.055),
    roughness=0.87,
    emission=(0.28, 0.075, 0.012),
    emission_strength=0.15,
)
for grass_material in (GRASS_BASE, GRASS_MEDIUM, GRASS_HIGH):
    grass_material.diffuse_color = (*grass_material.diffuse_color[:3], 1.0)
    grass_material.surface_render_method = "DITHERED"
# The pond bed. The old values were so close to black that looking "into" the
# water revealed nothing, so the surface read as an opaque cut-out in the
# ground no matter how transparent it was made. A silty bed that is actually
# visible is what makes water look like water.
POND_GLOW = principled_material(
    "Pond Underlight",
    (0.070, 0.095, 0.090),
    roughness=0.78,
    emission=(0.008, 0.040, 0.044),
    emission_strength=0.12,
)
QA_WATER = preview_water_material()


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def pond_metric(x, y, margin=0.0):
    rx = max(0.1, POND_RX + margin)
    ry = max(0.1, POND_RY + margin)
    return math.sqrt(((x - POND_X) / rx) ** 2 + ((y - POND_Y) / ry) ** 2)


def in_pond(x, y, margin=0.0):
    return pond_metric(x, y, margin) < 1.0


def pond_irregularity(angle):
    return (
        math.sin(angle * 2.7 + POND_SEED) * 0.075
        + math.cos(angle * 4.6 + POND_SEED * 1.3) * 0.045
        + math.sin(angle * 7.1 - POND_SEED * 0.4) * 0.025
    )


def terrain_height(x, y):
    radius = math.hypot(x, y)
    clearing = smoothstep(CLEARING_RADIUS, 10.0, radius)
    outer_rise = 2.1 * smoothstep(17.0, 30.0, radius) ** 1.35
    broad = 0.20 * math.sin(x * 0.31) + 0.16 * math.cos(y * 0.27) + 0.09 * math.sin((x + y) * 0.54)
    fine = 0.055 * math.sin(x * 1.17 + y * 0.83)
    height = clearing * (broad + fine) + outer_rise
    distance = pond_metric(x, y)
    if distance < 1.7:
        depression = 0.68 * (1.0 - smoothstep(0.42, 1.7, distance))
        height -= depression * smoothstep(CLEARING_RADIUS, CLEARING_RADIUS + 1.0, radius)
    return height


TERRAIN_HALF_SIZE = 31.0
TERRAIN_SEGMENTS = 96
GROUND_ATLAS_HALF_SIZE = float(GROUND_LAYOUT["worldExtent"])
# The authored ecology and its macro atlas end at 165m. The visible ground must
# continue much farther: high review cameras can look through the tree belt and
# intersect the floor hundreds of metres away. At 1,024m the shipped fog has
# effectively zero remaining transmittance, so the geometric edge cannot read.
APRON_OUTER_HALF_SIZE = 1_024.0


def chaikin_path(points, iterations=2):
    """Round authored path corners while retaining its two destinations."""
    smoothed = list(points)
    for _iteration in range(iterations):
        next_points = [smoothed[0]]
        for first, second in zip(smoothed, smoothed[1:]):
            next_points.extend(
                (
                    tuple(first[index] * 0.75 + second[index] * 0.25 for index in range(3)),
                    tuple(first[index] * 0.25 + second[index] * 0.75 for index in range(3)),
                )
            )
        next_points.append(smoothed[-1])
        smoothed = next_points
    return tuple(smoothed)


CABIN_LANE_PATH = chaikin_path(CABIN_LANE_POINTS)
FOREST_TRAIL_PATH = chaikin_path(FOREST_TRAIL_POINTS)


def point_segment_distance(x, y, first, second):
    segment_x = second[0] - first[0]
    segment_y = second[1] - first[1]
    length_squared = segment_x * segment_x + segment_y * segment_y
    if length_squared <= 0.000001:
        return math.hypot(x - first[0], y - first[1])
    amount = max(
        0.0,
        min(
            1.0,
            ((x - first[0]) * segment_x + (y - first[1]) * segment_y)
            / length_squared,
        ),
    )
    closest_x = first[0] + segment_x * amount
    closest_y = first[1] + segment_y * amount
    return math.hypot(x - closest_x, y - closest_y)


def distance_to_path(x, y, path):
    return min(
        point_segment_distance(x, y, path[index], path[index + 1])
        for index in range(len(path) - 1)
    )


def distance_to_cabin_lane(x, y):
    return distance_to_path(x, y, CABIN_LANE_PATH)


def distance_to_forest_trail(x, y):
    return distance_to_path(x, y, FOREST_TRAIL_PATH)


def oval_metric(x, y, region, margin=0.0):
    center_x, center_y, radius_x, radius_y, rotation, _seed = region
    dx = x - center_x
    dy = y - center_y
    cos_r = math.cos(-rotation)
    sin_r = math.sin(-rotation)
    local_x = dx * cos_r - dy * sin_r
    local_y = dx * sin_r + dy * cos_r
    return math.sqrt(
        (local_x / max(0.1, radius_x + margin)) ** 2
        + (local_y / max(0.1, radius_y + margin)) ** 2
    )


def in_maintained_ground(x, y, lane_clearance=1.45, trail_clearance=0.78, yard_margin=0.0):
    return (
        distance_to_cabin_lane(x, y) < lane_clearance
        or distance_to_forest_trail(x, y) < trail_clearance
        or oval_metric(x, y, SHARED_YARD, yard_margin) < 1.0
        or oval_metric(x, y, SHACK_DOOR_YARD, yard_margin) < 1.0
    )


def world_surface_height(x, y):
    """Match the terrain and its fog apron at any authored scenery position."""
    half_size = max(abs(x), abs(y))
    if half_size <= TERRAIN_HALF_SIZE:
        return terrain_height(x, y)
    blend = min(
        1.0,
        (half_size - TERRAIN_HALF_SIZE)
        / (GROUND_ATLAS_HALF_SIZE - TERRAIN_HALF_SIZE),
    )
    far = -1.0 - 7.5 * blend**1.15
    far += (1.4 * math.sin(x * 0.041) + 1.1 * math.cos(y * 0.035)) * blend
    return terrain_height(x, y) * (1.0 - blend) + far * blend


def autumn_ground_uv(x, y):
    """Repeat close surface response without exposing a square texture grid."""
    macro_u = 0.075 * math.sin(y * 0.29) + 0.032 * math.sin(x * 0.73 + y * 0.18)
    macro_v = 0.068 * math.cos(x * 0.31) + 0.028 * math.sin(y * 0.67 - x * 0.16)
    detail_metres = float(GROUND_LAYOUT["detailMetres"])
    return (x / detail_metres + macro_u, y / detail_metres + macro_v)


def autumn_ground_macro_uv(x, y):
    """Map every ground mesh into the same baked world-space ecology."""
    world_extent = GROUND_ATLAS_HALF_SIZE
    return (
        min(1.0, max(0.0, (x + world_extent) / (world_extent * 2.0))),
        min(1.0, max(0.0, (y + world_extent) / (world_extent * 2.0))),
    )


def create_terrain():
    size = TERRAIN_HALF_SIZE
    segments = TERRAIN_SEGMENTS
    vertices = []
    faces = []
    for iy in range(segments + 1):
        y = -size + (2 * size * iy / segments)
        for ix in range(segments + 1):
            x = -size + (2 * size * ix / segments)
            # The old `edge_drop` pulled the rim down by up to 0.4m, carving a
            # circular cliff inside the square terrain. That cliff IS the
            # "finite island" the review saw at wide framings. The apron mesh
            # below now continues the ground instead, so the rim stays level.
            vertices.append((x, y, terrain_height(x, y)))
    row = segments + 1
    for iy in range(segments):
        for ix in range(segments):
            a = iy * row + ix
            faces.extend(((a, a + 1, a + row + 1), (a, a + row + 1, a + row)))

    mesh = bpy.data.meshes.new("Autumn Terrain Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    # The base color already contains every soft ecological transition. One
    # material removes all polygon seams and overlay z-fighting while the two UV
    # sets keep macro composition independent from close normal detail.
    mesh.materials.append(EARTH)
    detail_uv = mesh.uv_layers.new(name="Autumn Ground Detail UV")
    macro_uv = mesh.uv_layers.new(name="Autumn Ground Macro UV")
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            detail_uv.data[loop_index].uv = autumn_ground_uv(vertex.co.x, vertex.co.y)
            macro_uv.data[loop_index].uv = autumn_ground_macro_uv(vertex.co.x, vertex.co.y)
    terrain = bpy.data.objects.new("Autumn_Terrain", mesh)
    bpy.context.scene.collection.objects.link(terrain)
    terrain["tka_performance_clearing_radius"] = CLEARING_RADIUS
    terrain["tka_ground_height"] = 0.0
    terrain["tka_pond_center"] = (POND_X, POND_Y)
    terrain["tka_pond_radii"] = (POND_RX, POND_RY)
    terrain["tka_ground_treatment"] = "baked-living-floor"
    terrain["tka_ground_layout_version"] = int(GROUND_LAYOUT["version"])
    terrain["tka_ground_layout_sha256"] = GROUND_LAYOUT_SHA256
    terrain["tka_ground_macro_diffuse"] = "autumn-ground-zoned.jpg"
    terrain["tka_ground_world_extent"] = float(GROUND_LAYOUT["worldExtent"])


def square_perimeter_points(half_size, segments):
    """Walk a square's perimeter with the same parametrisation at any size.

    Two rings sampled this way have matching point counts and matching corner
    placement, so consecutive rings can be stitched without any seam. The inner
    ring reproduces the authored terrain's own boundary vertices exactly.
    """
    points = []
    step = 2.0 * half_size / segments
    for i in range(segments):  # bottom edge, left to right
        points.append((-half_size + step * i, -half_size))
    for i in range(segments):  # right edge, bottom to top
        points.append((half_size, -half_size + step * i))
    for i in range(segments):  # top edge, right to left
        points.append((half_size - step * i, half_size))
    for i in range(segments):  # left edge, top to bottom
        points.append((-half_size, half_size - step * i))
    return points


def create_terrain_apron():
    """Extend the ground far past the authored terrain so no camera sees an edge.

    Raising fog density cannot solve a finite world. The terrain rim sits ~31m
    out and the performance camera sits ~34m back, so the edge is at roughly the
    same depth as the trees framing it - any fog thick enough to hide the rim
    also erases the scene. The fix is geometric: keep going. This apron carries
    the ground out to 1,024m. The first 165m retain the authored macro atlas;
    beyond that the texture edge is extended under accumulating fog. At the
    scene's density, the outer edge has effectively zero transmittance.

    It is deliberately cheap: logarithmic quad rings on the same perimeter
    parametrisation as the terrain boundary, ~7.7k triangles total, one
    material, no textures of its own.
    """
    ring_half_sizes = (
        TERRAIN_HALF_SIZE,
        38.0,
        52.0,
        76.0,
        112.0,
        GROUND_ATLAS_HALF_SIZE,
        256.0,
        384.0,
        512.0,
        768.0,
        APRON_OUTER_HALF_SIZE,
    )
    segments = TERRAIN_SEGMENTS

    vertices = []
    for _ring_index, half_size in enumerate(ring_half_sizes):
        for x, y in square_perimeter_points(half_size, segments):
            vertices.append((x, y, world_surface_height(x, y)))

    perimeter = segments * 4
    faces = []
    for ring_index in range(len(ring_half_sizes) - 1):
        base = ring_index * perimeter
        nxt = (ring_index + 1) * perimeter
        for i in range(perimeter):
            j = (i + 1) % perimeter
            faces.append((base + i, base + j, nxt + j, nxt + i))

    mesh = bpy.data.meshes.new("Autumn Terrain Apron Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(EARTH)
    detail_uv = mesh.uv_layers.new(name="Autumn Ground Detail UV")
    macro_uv = mesh.uv_layers.new(name="Autumn Ground Macro UV")
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            detail_uv.data[loop_index].uv = autumn_ground_uv(vertex.co.x, vertex.co.y)
            macro_uv.data[loop_index].uv = autumn_ground_macro_uv(vertex.co.x, vertex.co.y)
    apron = bpy.data.objects.new("Autumn_Terrain_Apron", mesh)
    bpy.context.scene.collection.objects.link(apron)
    apron["tka_ground_treatment"] = "baked-living-floor"
    apron["tka_ground_layout_version"] = int(GROUND_LAYOUT["version"])
    apron["tka_ground_layout_sha256"] = GROUND_LAYOUT_SHA256
    apron["tka_ground_visible_extent"] = APRON_OUTER_HALF_SIZE
    return len(faces)


def create_path_contract(name, path_points, role, destination):
    """Export path semantics after the visible route has moved into the atlas."""
    distance_along = 0.0
    previous_center = None
    for x, y, _half_width in path_points:
        if previous_center is not None:
            distance_along += math.hypot(x - previous_center[0], y - previous_center[1])
        previous_center = (x, y)

    path = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(path)
    first_x, first_y, _first_width = path_points[0]
    path.location = (first_x, first_y, world_surface_height(first_x, first_y))
    path["tka_role"] = role
    path["tka_path_length_metres"] = distance_along
    path["tka_path_destination"] = destination
    path["tka_path_surface"] = "baked-into-autumn-ground-atlas"
    path["tka_ground_layout_version"] = int(GROUND_LAYOUT["version"])
    path["tka_ground_layout_sha256"] = GROUND_LAYOUT_SHA256
    return distance_along


def create_autumn_paths():
    """Retain semantic routes whose visible surfaces are baked into the floor."""
    return {
        "cabin_lane": create_path_contract(
            CABIN_LANE_DEFINITION["name"],
            CABIN_LANE_PATH,
            CABIN_LANE_DEFINITION["role"],
            CABIN_LANE_DEFINITION["destination"],
        ),
        "forest_trail": create_path_contract(
            FOREST_TRAIL_DEFINITION["name"],
            FOREST_TRAIL_PATH,
            FOREST_TRAIL_DEFINITION["role"],
            FOREST_TRAIL_DEFINITION["destination"],
        ),
    }


def organic_outline(cx, cy, rx, ry, seed, count=32, rotation=0.0):
    """Generate the irregular pond and basin silhouette shared by water meshes."""
    points = []
    for index in range(count):
        angle = index * math.tau / count
        jitter = (
            math.sin(angle * 2.7 + seed) * 0.075
            + math.cos(angle * 4.6 + seed * 1.3) * 0.045
            + math.sin(angle * 7.1 - seed * 0.4) * 0.025
        )
        px = math.cos(angle) * rx * (1.0 + jitter)
        py = math.sin(angle) * ry * (1.0 + jitter)
        cos_r = math.cos(rotation)
        sin_r = math.sin(rotation)
        points.append((cx + px * cos_r - py * sin_r, cy + px * sin_r + py * cos_r))
    return points


def create_ground_regions():
    """Keep settlement anchors without retaining visible overlay geometry."""
    for name, region in ((yard["name"], yard_region(yard["name"])) for yard in GROUND_LAYOUT["yards"]):
        x, y, rx, ry, rotation, seed = region
        anchor = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(anchor)
        anchor.location = (x, y, world_surface_height(x, y))
        anchor["tka_role"] = "maintained-settlement-ground"
        anchor["tka_ground_surface"] = "baked-into-autumn-ground-atlas"
        anchor["tka_ground_region"] = (x, y, rx, ry, rotation, seed)
        anchor["tka_ground_layout_version"] = int(GROUND_LAYOUT["version"])
        anchor["tka_ground_layout_sha256"] = GROUND_LAYOUT_SHA256


def add_habitation_box(name, location, dimensions, material, rotation=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0.0, 0.0, rotation))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj["tka_role"] = "settlement-detail"
    return obj


def add_habitation_cylinder(
    name,
    location,
    radius,
    depth,
    material,
    vertices=10,
    direction=None,
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    if direction is not None:
        obj.rotation_euler = Vector(direction).to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    obj["tka_role"] = "settlement-detail"
    return obj


def create_habitation_props():
    """Add a few practical objects that explain who keeps using this route."""
    props = []

    # A single warm pane makes the distant destination readable through the
    # trunks. It is emissive only: no extra light or shadow pass at runtime.
    cabin_window_x, cabin_window_y = -11.05, 53.92
    cabin_window_ground = world_surface_height(cabin_window_x, cabin_window_y)
    props.append(
        add_habitation_box(
            "Autumn_Cabin_Window_Glow",
            (cabin_window_x, cabin_window_y, cabin_window_ground + 1.92),
            (0.54, 0.045, 0.62),
            HABITATION_CABIN_GLOW,
            DISTANT_CABIN_PLACEMENT[4],
        )
    )
    for name, dimensions in (
        ("Autumn_Cabin_Window_Mullion_V", (0.045, 0.052, 0.64)),
        ("Autumn_Cabin_Window_Mullion_H", (0.56, 0.052, 0.045)),
    ):
        props.append(
            add_habitation_box(
                name,
                (cabin_window_x, cabin_window_y - 0.012, cabin_window_ground + 1.92),
                dimensions,
                HABITATION_WOOD,
                DISTANT_CABIN_PLACEMENT[4],
            )
        )

    # Three irregular stones finish the lane at the south-facing shack door.
    for index, (x, y, scale_x, scale_y, rotation) in enumerate(
        (
            (-8.95, 50.75, 1.08, 0.84, 0.18),
            (-9.45, 52.00, 0.90, 1.05, -0.24),
            (-9.82, 53.25, 1.12, 0.82, 0.31),
        )
    ):
        z = world_surface_height(x, y)
        step = add_habitation_cylinder(
            f"Autumn_Door_Step_{index + 1:02d}",
            (x, y, z + 0.045),
            0.34,
            0.09,
            ROCK,
            vertices=9,
        )
        step.scale.x = scale_x
        step.scale.y = scale_y
        step.rotation_euler.z = rotation
        props.append(step)

    # Firewood is stacked beside the door rather than scattered as decoration.
    for row in range(3):
        for column in range(2):
            x = -13.15
            y = 52.45 + column * 0.24 + row * 0.035
            ground = world_surface_height(x, y)
            props.append(
                add_habitation_cylinder(
                    f"Autumn_Woodpile_Log_{row * 2 + column + 1:02d}",
                    (x, y, ground + 0.12 + row * 0.18),
                    0.095 + row * 0.006,
                    1.25 - column * 0.08,
                    HABITATION_WOOD,
                    vertices=8,
                    direction=(1.0, 0.0, 0.0),
                )
            )
    for index, x in enumerate((-13.82, -12.48)):
        y = 52.72
        ground = world_surface_height(x, y)
        props.append(
            add_habitation_cylinder(
                f"Autumn_Woodpile_Rack_{index + 1:02d}",
                (x, y, ground + 0.36),
                0.055,
                0.72,
                HABITATION_WOOD,
                vertices=8,
            )
        )

    block_x, block_y = -12.15, 50.55
    block_ground = world_surface_height(block_x, block_y)
    props.append(
        add_habitation_cylinder(
            "Autumn_Chopping_Block",
            (block_x, block_y, block_ground + 0.24),
            0.34,
            0.48,
            HABITATION_WOOD,
            vertices=11,
        )
    )

    # A rough bench and two stump seats make the central wear patch a shared
    # yard, but they stay outside the lane so performers still have a clean run.
    bench_x, bench_y, bench_rotation = 1.45, 20.25, -0.22
    bench_ground = world_surface_height(bench_x, bench_y)
    props.append(
        add_habitation_box(
            "Autumn_Rough_Bench_Seat",
            (bench_x, bench_y, bench_ground + 0.54),
            (2.15, 0.44, 0.17),
            HABITATION_WOOD,
            bench_rotation,
        )
    )
    for index, offset in enumerate((-0.70, 0.70)):
        leg_x = bench_x + math.cos(bench_rotation) * offset
        leg_y = bench_y + math.sin(bench_rotation) * offset
        props.append(
            add_habitation_box(
                f"Autumn_Rough_Bench_Leg_{index + 1:02d}",
                (leg_x, leg_y, world_surface_height(leg_x, leg_y) + 0.27),
                (0.18, 0.34, 0.54),
                HABITATION_WOOD,
                bench_rotation,
            )
        )
    for index, (x, y, radius, height, taper, scale_y, rotation) in enumerate(
        (
            (-6.15, 19.10, 0.38, 0.46, 0.89, 0.91, 0.24),
            (1.35, 14.85, 0.34, 0.42, 0.86, 1.08, -0.31),
        )
    ):
        ground = world_surface_height(x, y)
        bpy.ops.mesh.primitive_cone_add(
            vertices=11,
            radius1=radius,
            radius2=radius * taper,
            depth=height,
            location=(x, y, ground + height * 0.5),
        )
        stump = bpy.context.object
        stump.name = f"Autumn_Stump_Seat_{index + 1:02d}"
        stump.scale.y = scale_y
        stump.rotation_euler.z = rotation
        stump.data.materials.append(HABITATION_WOOD)
        stump["tka_role"] = "settlement-detail"
        props.append(stump)

        # A separate, slightly uneven cut face keeps the low-poly stump from
        # reading as a single-color cylinder under the red autumn lighting.
        cut_face = add_habitation_cylinder(
            f"Autumn_Stump_Seat_Cut_{index + 1:02d}",
            (x, y, ground + height + 0.007),
            radius * taper * 0.94,
            0.014,
            HABITATION_CUT_WOOD,
            vertices=11,
        )
        cut_face.scale.y = scale_y * 0.96
        cut_face.rotation_euler.z = rotation
        props.append(cut_face)

    # One small bucket by the door is enough to suggest water and chores.
    pail_x, pail_y = -11.55, 52.05
    pail_ground = world_surface_height(pail_x, pail_y)
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=0.22,
        radius2=0.26,
        depth=0.34,
        location=(pail_x, pail_y, pail_ground + 0.17),
    )
    pail = bpy.context.object
    pail.name = "Autumn_Water_Pail"
    pail.data.materials.append(HABITATION_METAL)
    pail["tka_role"] = "settlement-detail"
    props.append(pail)

    # The only new light cue marks the final bend. It is emissive but carries
    # no point light, so it remains readable without adding a runtime shadow or
    # lighting cost.
    lantern_x, lantern_y = -7.25, 40.45
    lantern_ground = world_surface_height(lantern_x, lantern_y)
    props.append(
        add_habitation_cylinder(
            "Autumn_Wayfinding_Lantern_Post",
            (lantern_x, lantern_y, lantern_ground + 0.62),
            0.045,
            1.24,
            HABITATION_METAL,
            vertices=8,
        )
    )
    props.append(
        add_habitation_box(
            "Autumn_Wayfinding_Lantern_Housing",
            (lantern_x, lantern_y, lantern_ground + 1.31),
            (0.30, 0.30, 0.34),
            HABITATION_METAL,
            0.12,
        )
    )
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12,
        ring_count=6,
        radius=0.105,
        location=(lantern_x, lantern_y, lantern_ground + 1.31),
    )
    glow = bpy.context.object
    glow.name = "Autumn_Wayfinding_Lantern_Glow"
    glow.data.materials.append(HABITATION_LANTERN)
    glow["tka_role"] = "settlement-detail"
    props.append(glow)
    return props


def create_pond_basin():
    ring_scales = (1.055, 1.012, 0.82, 0.43)
    count = 64
    vertices = []
    for ring_index, scale in enumerate(ring_scales):
        for index in range(count):
            angle = index * math.tau / count
            irregular = 1.0 + pond_irregularity(angle)
            x = POND_X + math.cos(angle) * POND_RX * scale * irregular
            y = POND_Y + math.sin(angle) * POND_RY * scale * irregular
            if ring_index == 0:
                # Tucked slightly UNDER the terrain rather than standing 25mm
                # proud of it. Standing proud gave the bank a lip that caught
                # the pond light at a grazing angle and ringed the water with a
                # hard pale rim.
                z = terrain_height(x, y) - 0.03
            elif ring_index == 1:
                z = POND_WATER_HEIGHT - 0.10
            elif ring_index == 2:
                z = POND_WATER_HEIGHT - 0.55
            else:
                z = POND_WATER_HEIGHT - 0.72
            vertices.append((x, y, z))
    vertices.append((POND_X, POND_Y, POND_WATER_HEIGHT - 0.76))
    center_index = len(vertices) - 1

    faces = []
    materials = []
    for ring_index in range(len(ring_scales) - 1):
        for index in range(count):
            current = ring_index * count + index
            following = ring_index * count + (index + 1) % count
            inner = (ring_index + 1) * count + index
            inner_following = (ring_index + 1) * count + (index + 1) % count
            faces.append((current, following, inner_following, inner))
            materials.append(0 if ring_index == 0 else (1 if ring_index == 1 else 2))
    final_ring = (len(ring_scales) - 1) * count
    for index in range(count):
        faces.append((final_ring + index, final_ring + (index + 1) % count, center_index))
        materials.append(2)

    mesh = bpy.data.meshes.new("Sculpted Pond Basin Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in (DAMP_EARTH, ROCK_DAMP, POND_GLOW):
        mesh.materials.append(material)
    uv = mesh.uv_layers.new(name="Pond Basin UV")
    for polygon, material_index in zip(mesh.polygons, materials):
        polygon.material_index = material_index
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            # The bank shares the terrain's damp-earth material, so it must
            # share the same world-space tiling. Without UVs Blender exported
            # the whole bank sampling one pale texel, which produced the chalk
            # crescent visible along the near shoreline at runtime.
            uv.data[loop_index].uv = (vertex.co.x / 5.2, vertex.co.y / 5.2)
    basin = bpy.data.objects.new("Pond_Sculpted_Basin", mesh)
    bpy.context.scene.collection.objects.link(basin)

    water_outline = organic_outline(POND_X, POND_Y, POND_RX, POND_RY, POND_SEED, 48)
    water_vertices = [(POND_X, POND_Y, POND_WATER_HEIGHT)]
    water_vertices.extend((x, y, POND_WATER_HEIGHT) for x, y in water_outline)
    water_faces = [
        (0, index + 1, ((index + 1) % len(water_outline)) + 1)
        for index in range(len(water_outline))
    ]
    water_mesh = bpy.data.meshes.new("QA Pond Water Mesh")
    water_mesh.from_pydata(water_vertices, [], water_faces)
    water_mesh.update()
    water_mesh.materials.append(QA_WATER)
    water = bpy.data.objects.new("QA_Pond_Water", water_mesh)
    bpy.context.scene.collection.objects.link(water)


def create_floating_pond_leaves():
    """Add a quiet autumn-specific detail that remains above runtime water."""
    leaf_rng = random.Random(8812)
    vertices = []
    faces = []
    material_indices = []
    for index in range(16):
        angle = leaf_rng.uniform(0.0, math.tau)
        distance = math.sqrt(leaf_rng.uniform(0.08 ** 2, 0.72 ** 2))
        x = POND_X + math.cos(angle) * POND_RX * distance
        y = POND_Y + math.sin(angle) * POND_RY * distance
        z = POND_WATER_HEIGHT + 0.032 + leaf_rng.uniform(0.0, 0.008)
        face_count = append_leaf_card(
            vertices,
            faces,
            x,
            y,
            z,
            leaf_rng.uniform(0.20, 0.38),
            leaf_rng.uniform(0.70, 1.10),
            leaf_rng.uniform(0.0, math.tau),
            leaf_rng.uniform(0.003, 0.010),
            0.0,
        )
        material_indices.extend([index % 3] * face_count)
    mesh = bpy.data.meshes.new("Floating Pond Leaves Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in (LEAF_RED, LEAF_ORANGE, LEAF_GOLD):
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
        polygon.use_smooth = True
    obj = bpy.data.objects.new("Pond_Floating_Autumn_Leaves", mesh)
    bpy.context.scene.collection.objects.link(obj)
    return 16


def imported_asset_root(asset_id, path):
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Missing required Autumn asset: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise RuntimeError(f"Blender imported no objects from {path}")
    root = bpy.data.objects.new(f"AssetSource_{asset_id}", None)
    bpy.context.scene.collection.objects.link(root)
    imported_set = set(imported)
    for obj in imported:
        if obj.parent not in imported_set:
            world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = world
    return root


def decimate_asset_source(root, label, ratio, maximum_triangles):
    """Build one web LOD before linked placements duplicate the source mesh."""
    mesh_objects = [obj for obj in root.children_recursive if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError(f"Cannot decimate {label}: source has no meshes")

    before = sum(len(obj.data.polygons) for obj in mesh_objects)
    for obj in mesh_objects:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new(f"{label} Web LOD", "DECIMATE")
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)

    after = sum(len(obj.data.polygons) for obj in mesh_objects)
    if after <= 0 or after > maximum_triangles:
        raise RuntimeError(
            f"{label} web LOD has {after:,} triangles; maximum is "
            f"{maximum_triangles:,}"
        )
    print(f"{label} web LOD: {before:,} -> {after:,} triangles")
    return after


def asset_bounds(root):
    points = []
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError(f"Asset {root.name} has no mesh bounds")
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def duplicate_hierarchy(source_root, name):
    mapping = {}
    ordered = [source_root, *source_root.children_recursive]
    for source in ordered:
        copy = source.copy()
        copy.data = source.data
        copy.name = source.name.replace("AssetSource_", f"{name}_", 1) if source is source_root else f"{name}_{source.name}"
        bpy.context.scene.collection.objects.link(copy)
        mapping[source] = copy
    for source, copy in mapping.items():
        copy.parent = mapping.get(source.parent)
        copy.matrix_parent_inverse = source.matrix_parent_inverse.copy()
        copy.matrix_basis = source.matrix_basis.copy()
    return mapping[source_root]


def place_asset(
    source_root,
    name,
    position,
    target_height,
    rotation=0.0,
    scale_variation=1.0,
    mirror=False,
    horizontal_scale=(1.0, 1.0),
    lean=(0.0, 0.0),
):
    root = duplicate_hierarchy(source_root, name)
    minimum, maximum = asset_bounds(source_root)
    height = max(0.001, maximum.z - minimum.z)
    scale = target_height / height * scale_variation
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    scale_x = scale * horizontal_scale[0]
    scale_y = scale * horizontal_scale[1]
    mirror_x = -scale_x if mirror else scale_x
    normalize = Matrix.Translation(Vector((-center_x, -center_y, -minimum.z)))
    root.matrix_world = (
        Matrix.Translation(Vector(position))
        @ Matrix.Rotation(rotation, 4, "Z")
        @ Matrix.Rotation(lean[0], 4, "X")
        @ Matrix.Rotation(lean[1], 4, "Y")
        @ Matrix.Diagonal(Vector((mirror_x, scale_y, scale, 1.0)))
        @ normalize
    )
    for obj in root.children_recursive:
        if obj.type == "MESH":
            obj.name = f"{name}_{obj.name.split('_')[-1]}"
            obj.visible_shadow = True
    return root


def transformed_mesh_vertices(root):
    """Return authored mesh vertices after the instance's full world transform."""
    bpy.context.view_layer.update()
    return [
        obj.matrix_world @ vertex.co
        for obj in root.children_recursive
        if obj.type == "MESH"
        for vertex in obj.data.vertices
    ]


def root_contact_envelope(root, target_height, footprint):
    """Measure the underside of a transformed tree root plate in world space.

    A single lowest vertex only proves that one root tip touches the ground.
    The visible floating-tree failure happened because distant tips touched
    while the broad central root plate remained in the air. We instead divide
    the whole lower root band into XY cells and retain the lowest mesh point in
    every occupied cell. Those points form a conservative underside envelope
    across the central plate and every radiating root.
    """
    points = transformed_mesh_vertices(root)
    if not points:
        raise RuntimeError(f"Cannot ground {root.name}: no transformed mesh vertices")

    minimum_z = min(point.z for point in points)
    root_band_height = max(0.62, min(1.18, target_height * 0.082))
    root_band = [point for point in points if point.z <= minimum_z + root_band_height]
    if len(root_band) < TREE_ROOT_MIN_CONTACT_SAMPLES:
        raise RuntimeError(
            f"Cannot ground {root.name}: root band has only {len(root_band)} vertices"
        )

    cell_size = min(TREE_ROOT_CELL_SIZE, max(0.28, footprint / 6.0))
    cells = {}
    for point in root_band:
        cell = (
            math.floor(point.x / cell_size),
            math.floor(point.y / cell_size),
        )
        existing = cells.get(cell)
        if existing is None or point.z < existing.z:
            cells[cell] = point.copy()

    contacts = tuple(cells.values())
    if len(contacts) < TREE_ROOT_MIN_CONTACT_SAMPLES:
        raise RuntimeError(
            f"Cannot ground {root.name}: root envelope has only {len(contacts)} cells"
        )
    return contacts, root_band_height, cell_size


def ground_tree_instance(root, name, target_height, footprint):
    """Seat a tree from its root geometry and prove the contact after moving it."""
    contacts, root_band_height, cell_size = root_contact_envelope(
        root, target_height, footprint
    )
    clearances_before = [
        point.z - world_surface_height(point.x, point.y) for point in contacts
    ]
    grounding_depth = max(0.0, max(clearances_before) + TREE_ROOT_CONTACT_MARGIN)
    if grounding_depth > 0.0:
        root.matrix_world = (
            Matrix.Translation(Vector((0.0, 0.0, -grounding_depth)))
            @ root.matrix_world
        )
        bpy.context.view_layer.update()

    clearances_after = [
        point.z - grounding_depth - world_surface_height(point.x, point.y)
        for point in contacts
    ]
    maximum_clearance_after = max(clearances_after)
    if maximum_clearance_after > -TREE_ROOT_CONTACT_MARGIN + 0.002:
        raise RuntimeError(
            f"Tree grounding failed for {name}: root envelope still clears terrain "
            f"by {maximum_clearance_after:.4f}m"
        )

    result = {
        "depth": grounding_depth,
        "offset_z": -grounding_depth,
        "samples": len(contacts),
        "root_band_height": root_band_height,
        "cell_size": cell_size,
        "maximum_clearance_before": max(clearances_before),
        "maximum_clearance_after": maximum_clearance_after,
    }
    TREE_GROUNDING_RESULTS[name] = result
    grounding_metadata = {
        "tka_grounding_strategy": TREE_ROOT_CONTACT_STRATEGY,
        "tka_grounding_depth": grounding_depth,
        "tka_root_contact_samples": len(contacts),
        "tka_root_band_height": root_band_height,
        "tka_root_cell_size": cell_size,
        "tka_root_max_clearance_before": max(clearances_before),
        "tka_root_max_clearance_after": maximum_clearance_after,
        "tka_root_contact_margin": TREE_ROOT_CONTACT_MARGIN,
    }
    for key, value in grounding_metadata.items():
        root[key] = value
    # The runtime exporter selects mesh objects. Copy the proof onto those
    # children so the optimized GLB retains the same verifiable contract.
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        for key, value in grounding_metadata.items():
            obj[key] = value

    print(
        f"Tree grounded: {name} sank {grounding_depth:.3f}m from "
        f"{len(contacts)} root-envelope samples "
        f"(max clearance {maximum_clearance_after:.3f}m)"
    )
    return result


def tree_grounding_offset(name):
    result = TREE_GROUNDING_RESULTS.get(name)
    if result is None:
        raise RuntimeError(f"Tree grounding result missing for {name}")
    return result["offset_z"]


def place_asset_to_dimensions(source_root, name, position, dimensions, rotation=0.0, mirror=False):
    """Place a scanned asset at exact world dimensions with its base buried."""
    root = duplicate_hierarchy(source_root, name)
    minimum, maximum = asset_bounds(source_root)
    source_dimensions = maximum - minimum
    scale_x = dimensions[0] / max(0.001, source_dimensions.x)
    scale_y = dimensions[1] / max(0.001, source_dimensions.y)
    scale_z = dimensions[2] / max(0.001, source_dimensions.z)
    center_x = (minimum.x + maximum.x) * 0.5
    center_y = (minimum.y + maximum.y) * 0.5
    normalize = Matrix.Translation(Vector((-center_x, -center_y, -minimum.z)))
    root.matrix_world = (
        Matrix.Translation(Vector(position))
        @ Matrix.Rotation(rotation, 4, "Z")
        @ Matrix.Diagonal(Vector(((-scale_x if mirror else scale_x), scale_y, scale_z, 1.0)))
        @ normalize
    )
    for obj in root.children_recursive:
        if obj.type == "MESH":
            obj.name = f"{name}_{obj.name.split('_')[-1]}"
            obj.visible_shadow = True
    return root


def hide_source(root):
    root.hide_render = True
    root.hide_viewport = True
    for obj in root.children_recursive:
        obj.hide_render = True
        obj.hide_viewport = True


def append_far_frustum(
    vertices,
    faces,
    material_indices,
    start,
    end,
    start_radius,
    end_radius,
    material_index=0,
    segments=7,
):
    """Append one low-poly trunk or branch aligned between two points."""
    start = Vector(start)
    end = Vector(end)
    direction = (end - start).normalized()
    reference = Vector((0.0, 0.0, 1.0)) if abs(direction.z) < 0.88 else Vector((1.0, 0.0, 0.0))
    right = direction.cross(reference).normalized()
    forward = direction.cross(right).normalized()
    first_ring = []
    second_ring = []
    for segment in range(segments):
        angle = segment * math.tau / segments
        radial = right * math.cos(angle) + forward * math.sin(angle)
        first_ring.append(len(vertices))
        vertices.append(tuple(start + radial * start_radius))
        second_ring.append(len(vertices))
        vertices.append(tuple(end + radial * end_radius))
    for segment in range(segments):
        following = (segment + 1) % segments
        faces.append(
            (
                first_ring[segment],
                first_ring[following],
                second_ring[following],
                second_ring[segment],
            )
        )
        material_indices.append(material_index)


def append_far_lobe(
    vertices,
    faces,
    material_indices,
    center,
    radii,
    material_index=1,
    segments=8,
):
    """Append a faceted ellipsoid that keeps a readable crown in deep fog."""
    center = Vector(center)
    radius_x, radius_y, radius_z = radii
    bottom = len(vertices)
    vertices.append((center.x, center.y, center.z - radius_z))
    lower_ring = []
    upper_ring = []
    for segment in range(segments):
        angle = segment * math.tau / segments
        cosine = math.cos(angle)
        sine = math.sin(angle)
        lower_ring.append(len(vertices))
        vertices.append(
            (
                center.x + cosine * radius_x * 0.86,
                center.y + sine * radius_y * 0.86,
                center.z - radius_z * 0.28,
            )
        )
        upper_ring.append(len(vertices))
        vertices.append(
            (
                center.x + cosine * radius_x,
                center.y + sine * radius_y,
                center.z + radius_z * 0.34,
            )
        )
    top = len(vertices)
    vertices.append((center.x, center.y, center.z + radius_z))
    for segment in range(segments):
        following = (segment + 1) % segments
        faces.extend(
            (
                (bottom, lower_ring[following], lower_ring[segment]),
                (
                    lower_ring[segment],
                    lower_ring[following],
                    upper_ring[following],
                    upper_ring[segment],
                ),
                (upper_ring[segment], upper_ring[following], top),
            )
        )
        material_indices.extend((material_index, material_index, material_index))


def append_far_cone(
    vertices,
    faces,
    material_indices,
    center_z,
    radius,
    height,
    material_index=1,
    segments=8,
):
    base_ring = []
    for segment in range(segments):
        angle = segment * math.tau / segments
        base_ring.append(len(vertices))
        vertices.append((math.cos(angle) * radius, math.sin(angle) * radius, center_z - height * 0.5))
    tip = len(vertices)
    vertices.append((0.0, 0.0, center_z + height * 0.5))
    for segment in range(segments):
        following = (segment + 1) % segments
        faces.append((base_ring[segment], base_ring[following], tip))
        material_indices.append(material_index)


def create_far_depth_tree_source(asset_id, style, canopy_material):
    vertices = []
    faces = []
    material_indices = []
    append_far_frustum(
        vertices,
        faces,
        material_indices,
        (0.0, 0.0, 0.0),
        (0.0, 0.0, 6.2 if style == "snag" else 5.4),
        0.32,
        0.12,
    )
    if style == "broadleaf":
        append_far_lobe(vertices, faces, material_indices, (-1.0, 0.0, 4.3), (1.55, 1.15, 1.35))
        append_far_lobe(vertices, faces, material_indices, (1.0, 0.1, 4.5), (1.45, 1.18, 1.25))
        append_far_lobe(vertices, faces, material_indices, (0.0, -0.1, 5.5), (1.75, 1.30, 1.45))
    elif style == "larch":
        append_far_cone(vertices, faces, material_indices, 2.8, 1.85, 3.0)
        append_far_cone(vertices, faces, material_indices, 4.2, 1.45, 3.0)
        append_far_cone(vertices, faces, material_indices, 5.6, 0.95, 2.7)
    else:
        append_far_frustum(
            vertices,
            faces,
            material_indices,
            (0.0, 0.0, 3.5),
            (1.45, 0.25, 5.2),
            0.16,
            0.055,
        )
        append_far_frustum(
            vertices,
            faces,
            material_indices,
            (-0.02, 0.0, 4.5),
            (-1.05, 0.35, 5.9),
            0.13,
            0.045,
        )

    mesh = bpy.data.meshes.new(f"{asset_id} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(FAR_TRUNK)
    mesh.materials.append(canopy_material)
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
        polygon.use_smooth = False
    root = bpy.data.objects.new(f"AssetSource_{asset_id}", None)
    bpy.context.scene.collection.objects.link(root)
    tree = bpy.data.objects.new(f"{asset_id}_Mesh", mesh)
    bpy.context.scene.collection.objects.link(tree)
    tree.parent = root
    return root


def far_depth_tree_sources():
    return {
        "FarRed": create_far_depth_tree_source("FarRed", "broadleaf", FAR_CANOPY_RED),
        "FarGold": create_far_depth_tree_source("FarGold", "broadleaf", FAR_CANOPY_GOLD),
        "FarLarch": create_far_depth_tree_source("FarLarch", "larch", FAR_CANOPY_GOLD),
        "FarSnag": create_far_depth_tree_source("FarSnag", "snag", FAR_CANOPY_SHADOW),
    }


def tree_footprints():
    hero = [(placement[2], placement[3], placement[8]) for placement in TREE_PLACEMENTS]
    saplings = [(placement[1], placement[2], placement[6]) for placement in SAPLING_PLACEMENTS]
    distant = [
        (placement[2], placement[3], placement[8])
        for placement in DISTANT_TREE_PLACEMENTS
    ]
    middle = [
        (placement[2], placement[3], placement[8])
        for placement in MID_DEPTH_TREE_PLACEMENTS
    ]
    return [*hero, *saplings, *distant, *middle]


def log_footprints():
    return [(placement[1], placement[2], placement[7]) for placement in LOG_PLACEMENTS]


def point_clear_of_footprints(x, y, extra=0.0):
    for ox, oy, radius in (*tree_footprints(), *log_footprints()):
        if math.hypot(x - ox, y - oy) < radius + extra:
            return False
    return True


def create_asset_placements():
    sources = {
        "HeroA": imported_asset_root("HeroA", os.path.join(MODEL_DIR, "hero-tree-a_raw.glb")),
        "HeroB": imported_asset_root("HeroB", os.path.join(MODEL_DIR, "hero-tree-b_raw.glb")),
        "Birch": imported_asset_root("Birch", os.path.join(MODEL_DIR, "silver-birch-cluster_raw.glb")),
        "Snag": imported_asset_root("Snag", os.path.join(MODEL_DIR, "autumn-snag_raw.glb")),
        "Larch": imported_asset_root("Larch", os.path.join(MODEL_DIR, "golden-larch_raw.glb")),
        "Willow": imported_asset_root("Willow", os.path.join(MODEL_DIR, "autumn-willow_raw.glb")),
        "Fern": imported_asset_root("Fern", os.path.join(MODEL_DIR, "fern-clump_raw.glb")),
        "Log": imported_asset_root("Log", os.path.join(MODEL_DIR, "fallen-log_raw.glb")),
        "Cabin": imported_asset_root(
            "DistantWoodlandShack",
            os.path.join(MODEL_DIR, "distant-woodland-shack_raw.glb"),
        ),
    }
    sources.update(far_depth_tree_sources())

    decimate_asset_source(
        sources["Fern"],
        "Autumn fern",
        FERN_SOURCE_DECIMATE_RATIO,
        FERN_SOURCE_MAX_TRIANGLES,
    )

    # Every imported source enters the same physically based material grammar.
    # Color grading for texture-driven inputs happens later in the glTF
    # optimizer, where baseColorFactor is guaranteed to survive export.
    for source_key, material_label, roughness_floor in (
        ("HeroA", "Hero A", 0.76),
        ("HeroB", "Hero B", 0.76),
        ("Birch", "Birch", 0.80),
        ("Snag", "Snag", 0.84),
        ("Larch", "Larch", 0.80),
        ("Willow", "Willow", 0.82),
        ("Fern", "Fern", 0.86),
        ("Log", "Fallen Log", 0.84),
        ("Cabin", "Woodland Cabin", 0.82),
    ):
        tune_imported_asset_materials(
            sources[source_key], material_label, roughness_floor
        )

    for name, source_key, x, y, target_height, rotation, variation, mirror, footprint in TREE_PLACEMENTS:
        horizontal_scale, lean = HERO_TREE_SHAPE_VARIANTS[name]
        root = place_asset(
            sources[source_key],
            name,
            (x, y, world_surface_height(x, y)),
            target_height,
            rotation,
            variation,
            mirror,
            horizontal_scale,
            lean,
        )
        ground_tree_instance(root, name, target_height * variation, footprint)
    for name, source_key, x, y, target_height, rotation, variation, mirror, footprint in DISTANT_TREE_PLACEMENTS:
        root = place_asset(
            sources[source_key],
            name,
            (x, y, world_surface_height(x, y)),
            target_height,
            rotation,
            variation,
            mirror,
        )
        root.name = name
        root["tka_scenery_tier"] = "distant-tree-belt"
        ground_tree_instance(root, name, target_height * variation, footprint)
    for name, source_key, x, y, target_height, rotation, variation, mirror, footprint in MID_DEPTH_TREE_PLACEMENTS:
        root = place_asset(
            sources[source_key],
            name,
            (x, y, world_surface_height(x, y)),
            target_height,
            rotation,
            variation,
            mirror,
        )
        root.name = name
        root["tka_scenery_tier"] = "mid-depth-grove"
        ground_tree_instance(root, name, target_height * variation, footprint)
    for name, source_key, x, y, target_height, rotation, variation, mirror in FAR_DEPTH_TREE_PLACEMENTS:
        root = place_asset(
            sources[source_key],
            name,
            (x, y, world_surface_height(x, y)),
            target_height,
            rotation,
            variation,
            mirror,
        )
        root.name = name
        root["tka_scenery_tier"] = "far-depth-silhouette"
        ground_tree_instance(root, name, target_height * variation, max(0.8, target_height * 0.22))
    cabin_name, cabin_x, cabin_y, cabin_height, cabin_rotation, cabin_mirror = DISTANT_CABIN_PLACEMENT
    cabin = place_asset(
        sources["Cabin"],
        cabin_name,
        (cabin_x, cabin_y, world_surface_height(cabin_x, cabin_y) - 0.08),
        cabin_height,
        cabin_rotation,
        1.0,
        cabin_mirror,
    )
    cabin.name = cabin_name
    cabin["tka_scenery_tier"] = "distant-civilization"
    cabin["tka_path_reveal"] = "partial"
    for name, x, y, target_height, rotation, mirror, footprint in SAPLING_PLACEMENTS:
        root = place_asset(
            sources["HeroB"],
            name,
            (x, y, world_surface_height(x, y)),
            target_height,
            rotation,
            1.0,
            mirror,
        )
        ground_tree_instance(root, name, target_height, footprint)
    for name, x, y, target_height, rotation, variation, mirror, _footprint in LOG_PLACEMENTS:
        place_asset(
            sources["Log"],
            name,
            (x, y, terrain_height(x, y)),
            target_height,
            rotation,
            variation,
            mirror,
        )

    fern_positions = []
    cluster_rng = random.Random(84391)
    for cluster_index, (center_x, center_y, target_count) in enumerate(FERN_CLUSTERS):
        added = 0
        attempts = 0
        while added < target_count and attempts < 100:
            attempts += 1
            angle = cluster_rng.uniform(0.0, math.tau)
            distance = math.sqrt(cluster_rng.uniform(0.15 ** 2, 2.0 ** 2))
            x = center_x + math.cos(angle) * distance
            y = center_y + math.sin(angle) * distance * 0.72
            if math.hypot(x, y) < CLEARING_RADIUS + 0.8:
                continue
            if in_pond(x, y, margin=0.45):
                continue
            if in_maintained_ground(x, y, lane_clearance=1.55, trail_clearance=0.82, yard_margin=0.15):
                continue
            if not point_clear_of_footprints(x, y, extra=0.38):
                continue
            if any(math.hypot(x - px, y - py) < 0.72 for px, py in fern_positions):
                continue
            fern_positions.append((x, y))
            added += 1
        if added != target_count:
            raise RuntimeError(f"Fern cluster {cluster_index + 1} placed {added}/{target_count}")

    for index, (x, y) in enumerate(fern_positions):
        variation = 0.76 + 0.24 * (0.5 + 0.5 * math.sin(index * 1.71))
        place_asset(
            sources["Fern"],
            f"Fern_{index + 1:02d}",
            (x, y, terrain_height(x, y)),
            0.82,
            index * 1.93,
            variation,
            index % 3 == 0,
        )

    for source in sources.values():
        hide_source(source)
    return fern_positions


def shoreline_rock_placements():
    placements = []
    # Paired clusters leave stretches of living bank exposed; an evenly spaced
    # ring would read as a landscaping border instead of a forest pond.
    angles = (0.08, 0.34, 1.28, 1.58, 2.68, 3.02, 4.24, 5.42, 5.76)
    for index, angle in enumerate(angles):
        irregular = 1.10 + 0.055 * math.sin(index * 2.31) + pond_irregularity(angle)
        x = POND_X + math.cos(angle) * POND_RX * irregular
        y = POND_Y + math.sin(angle) * POND_RY * irregular
        sx = 0.72 + 0.30 * (0.5 + 0.5 * math.sin(index * 2.17))
        sy = 0.62 + 0.25 * (0.5 + 0.5 * math.cos(index * 1.73))
        sz = 0.48 + 0.24 * (0.5 + 0.5 * math.sin(index * 1.29 + 0.6))
        placements.append((x, y, sx, sy, sz, angle + 0.43, index % 4, "Shore"))
    placements.extend(
        (
            (-16.0, 4.0, 1.28, 0.88, 0.70, 0.5, 1, "Forest"),
            (15.0, 4.0, 1.12, 0.84, 0.62, 1.7, 2, "Forest"),
            (-18.5, 10.5, 1.42, 0.96, 0.76, 2.3, 3, "Forest"),
            (19.0, 11.0, 1.48, 1.02, 0.78, 0.9, 0, "Forest"),
            (-8.0, 23.0, 1.02, 0.74, 0.58, 2.8, 1, "Forest"),
            (11.0, 18.6, 1.18, 0.82, 0.64, 0.2, 2, "Forest"),
        )
    )
    return placements


def blender_readable_rock_source(filename):
    """Decode meshopt once because Blender's importer does not support it."""
    source = os.path.join(PROJECT_ROOT, "static", "models", "ocean", "polyhaven", filename)
    cache_dir = os.path.join(QA_DIR, "rock-sources")
    output = os.path.join(cache_dir, filename)
    os.makedirs(cache_dir, exist_ok=True)
    if not os.path.isfile(output) or os.path.getmtime(output) < os.path.getmtime(source):
        npx = "npx.cmd" if os.name == "nt" else "npx"
        result = subprocess.run(
            [npx, "gltf-transform", "copy", source, output],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        if result.stdout.strip():
            print(result.stdout.strip())
    return output


def create_rocks():
    sources = {
        "Boulder": imported_asset_root("Rock_Boulder", blender_readable_rock_source("boulder_01.glb")),
        "Rock": imported_asset_root("Rock_Round", blender_readable_rock_source("rock_07.glb")),
        "Stone": imported_asset_root("Rock_Stone", blender_readable_rock_source("stone_01.glb")),
    }
    for source_key, material_label in (
        ("Boulder", "Boulder"),
        ("Rock", "Rounded Rock"),
        ("Stone", "Field Stone"),
    ):
        tune_imported_asset_materials(sources[source_key], material_label, 0.86)
    placements = shoreline_rock_placements()
    source_order = ("Rock", "Stone", "Rock", "Boulder")
    for index, (x, y, sx, sy, sz, rotation, prototype, region) in enumerate(placements):
        source_key = "Boulder" if region == "Forest" and index % 2 else source_order[prototype]
        root = place_asset_to_dimensions(
            sources[source_key],
            f"{region}_Boulder_{index + 1:02d}",
            (x, y, terrain_height(x, y) - sz * 0.24),
            (sx * 1.8, sy * 1.75, sz * 1.55),
            rotation,
            index % 5 == 0,
        )
        root["tka_region"] = region.lower()
    for source in sources.values():
        hide_source(source)
    return placements


def point_clear_of_rocks(x, y, rock_placements, extra=0.0):
    for rx, ry, sx, sy, _sz, _rotation, _prototype, _region in rock_placements:
        if math.hypot(x - rx, y - ry) < max(sx, sy) * 1.1 + extra:
            return False
    return True


def create_mushroom_source(
    asset_id,
    cap_material,
    stem_material,
    stem_height,
    stem_radius,
    cap_radius,
    cap_height,
):
    """Build one low-poly mushroom prototype with reusable stem and cap meshes."""
    root = bpy.data.objects.new(f"AssetSource_{asset_id}", None)
    bpy.context.scene.collection.objects.link(root)

    bpy.ops.mesh.primitive_cone_add(
        vertices=10,
        radius1=stem_radius * 1.12,
        radius2=stem_radius,
        depth=stem_height,
        location=(0.0, 0.0, stem_height * 0.5),
    )
    stem = bpy.context.object
    stem.name = f"{asset_id}_Stem"
    stem.data.materials.append(stem_material)
    stem.parent = root
    for polygon in stem.data.polygons:
        polygon.use_smooth = True

    # A closed shallow dome reads as a mushroom cap rather than the pill-shaped
    # ellipsoid produced by scaling a UV sphere. The tucked underside also
    # catches a thin rim of light when a fruiting body is seen at ground level.
    segment_count = 12
    cap_vertices = [(0.0, 0.0, stem_height + cap_height)]
    ring_indices = []
    for radius_fraction, height_fraction in (
        (0.36, 0.86),
        (0.72, 0.54),
        (1.00, 0.18),
        (0.72, 0.04),
    ):
        ring = []
        for segment in range(segment_count):
            angle = segment * math.tau / segment_count
            ring.append(len(cap_vertices))
            cap_vertices.append(
                (
                    math.cos(angle) * cap_radius * radius_fraction,
                    math.sin(angle) * cap_radius * radius_fraction * 0.93,
                    stem_height + cap_height * height_fraction,
                )
            )
        ring_indices.append(ring)
    underside_center = len(cap_vertices)
    cap_vertices.append((0.0, 0.0, stem_height + cap_height * 0.035))

    cap_faces = []
    first_ring = ring_indices[0]
    for segment in range(segment_count):
        next_segment = (segment + 1) % segment_count
        cap_faces.append((0, first_ring[segment], first_ring[next_segment]))
    for inner_ring, outer_ring in zip(ring_indices, ring_indices[1:]):
        for segment in range(segment_count):
            next_segment = (segment + 1) % segment_count
            cap_faces.append(
                (
                    inner_ring[segment],
                    outer_ring[segment],
                    outer_ring[next_segment],
                    inner_ring[next_segment],
                )
            )
    underside_ring = ring_indices[-1]
    for segment in range(segment_count):
        next_segment = (segment + 1) % segment_count
        cap_faces.append(
            (underside_center, underside_ring[next_segment], underside_ring[segment])
        )

    cap_mesh = bpy.data.meshes.new(f"{asset_id}_Cap_Mesh")
    cap_mesh.from_pydata(cap_vertices, [], cap_faces)
    cap_mesh.update()
    cap = bpy.data.objects.new(f"{asset_id}_Cap", cap_mesh)
    bpy.context.scene.collection.objects.link(cap)
    cap.data.materials.append(cap_material)
    cap.parent = root
    for polygon in cap.data.polygons:
        polygon.use_smooth = True

    return root


def mushroom_point_is_valid(x, y, rock_placements, allow_deadwood=False):
    if math.hypot(x, y) < CLEARING_RADIUS + 0.55:
        return False
    if in_pond(x, y, margin=0.55):
        return False
    if in_maintained_ground(x, y, lane_clearance=1.45, trail_clearance=0.75, yard_margin=0.08):
        return False
    if not point_clear_of_rocks(x, y, rock_placements, extra=0.12):
        return False
    if not allow_deadwood and not point_clear_of_footprints(x, y, extra=0.08):
        return False
    return True


def place_mushroom(
    source,
    name,
    species,
    habitat,
    x,
    y,
    target_height,
    rotation,
    width_scale,
):
    root = place_asset(
        source,
        name,
        (x, y, terrain_height(x, y) - 0.012),
        target_height,
        rotation,
    )
    root.matrix_world = root.matrix_world @ Matrix.Diagonal(
        Vector((width_scale, width_scale * 0.94, 1.0, 1.0))
    )
    root["tka_ground_life"] = habitat
    root["tka_species"] = species
    return {
        "name": name,
        "species": species,
        "habitat": habitat,
        "x": x,
        "y": y,
    }


def create_mushroom_ecology(rock_placements):
    """Place small fruiting bodies according to ring, root, and deadwood ecology."""
    sources = {
        "fairy-champignon": create_mushroom_source(
            "FairyChampignon",
            MUSHROOM_CHAMPIGNON_CAP,
            MUSHROOM_STEM_PALE,
            0.76,
            0.050,
            0.30,
            0.14,
        ),
        "amethyst-deceiver": create_mushroom_source(
            "AmethystDeceiver",
            MUSHROOM_AMETHYST_CAP,
            MUSHROOM_STEM_LILAC,
            0.70,
            0.046,
            0.34,
            0.11,
        ),
        "honey-fungus": create_mushroom_source(
            "HoneyFungus",
            MUSHROOM_HONEY_CAP,
            MUSHROOM_STEM_PALE,
            0.64,
            0.060,
            0.33,
            0.15,
        ),
    }
    records = []
    mushroom_rng = random.Random(14731)

    ring_name, center_x, center_y, radius, count, phase = FAIRY_CHAMPIGNON_ARC
    for index in range(count):
        if index in FAIRY_CHAMPIGNON_GAPS:
            continue
        angle = phase + index * math.tau / count
        local_radius = radius * mushroom_rng.uniform(0.93, 1.08)
        x = center_x + math.cos(angle) * local_radius
        y = center_y + math.sin(angle) * local_radius * 0.88
        if not mushroom_point_is_valid(x, y, rock_placements):
            raise RuntimeError(f"{ring_name} entered a protected footprint at {(x, y)}")
        records.append(
            place_mushroom(
                sources["fairy-champignon"],
                f"{ring_name}_{index + 1:02d}",
                "Marasmius oreades",
                "broken-fairy-ring",
                x,
                y,
                mushroom_rng.uniform(0.18, 0.30),
                angle + mushroom_rng.uniform(-0.35, 0.35),
                mushroom_rng.uniform(0.82, 1.18),
            )
        )

    for drift_name, center_x, center_y, count, spread_x, spread_y in AMETHYST_DECEIVER_DRIFTS:
        placed = 0
        attempts = 0
        while placed < count and attempts < count * 40:
            attempts += 1
            x = mushroom_rng.gauss(center_x, spread_x)
            y = mushroom_rng.gauss(center_y, spread_y)
            if not mushroom_point_is_valid(x, y, rock_placements):
                continue
            if any(math.hypot(x - item["x"], y - item["y"]) < 0.18 for item in records):
                continue
            records.append(
                place_mushroom(
                    sources["amethyst-deceiver"],
                    f"{drift_name}_{placed + 1:02d}",
                    "Laccaria amethystina",
                    "root-zone-leaf-litter",
                    x,
                    y,
                    mushroom_rng.uniform(0.18, 0.29),
                    mushroom_rng.uniform(-math.pi, math.pi),
                    mushroom_rng.uniform(0.78, 1.12),
                )
            )
            placed += 1
        if placed != count:
            raise RuntimeError(f"Could not place all mushrooms in {drift_name}: {placed}/{count}")

    for colony_name, center_x, center_y, count, spread_x, spread_y in HONEY_FUNGUS_COLONIES:
        for index in range(count):
            angle = mushroom_rng.uniform(-math.pi, math.pi)
            radius_scale = math.sqrt(mushroom_rng.random())
            x = center_x + math.cos(angle) * spread_x * radius_scale
            y = center_y + math.sin(angle) * spread_y * radius_scale
            if not mushroom_point_is_valid(x, y, rock_placements, allow_deadwood=True):
                raise RuntimeError(f"{colony_name} entered a protected footprint at {(x, y)}")
            records.append(
                place_mushroom(
                    sources["honey-fungus"],
                    f"{colony_name}_{index + 1:02d}",
                    "Armillaria species",
                    "fallen-deadwood",
                    x,
                    y,
                    mushroom_rng.uniform(0.22, 0.36),
                    angle + mushroom_rng.uniform(-0.4, 0.4),
                    mushroom_rng.uniform(0.82, 1.15),
                )
            )

    for source in sources.values():
        hide_source(source)
    return records


def tune_imported_asset_materials(source_root, label, roughness_floor):
    """Normalize imported PBR contracts before scene-specific color grading.

    Generated organics often arrive with an emissive copy of their albedo,
    which makes bark and leaves hold brightness through shadow and fog. Every
    imported source now enters the same non-metallic, non-emissive contract.
    Texture color and normal strength are graded after export because glTF
    factors survive the delivery pipeline while arbitrary Blender nodes do not.
    """
    materials = []
    seen = set()
    for obj in source_root.children_recursive:
        if obj.type != "MESH":
            continue
        for material in obj.data.materials:
            if material is None or material in seen:
                continue
            seen.add(material)
            materials.append(material)

    for index, material in enumerate(materials):
        suffix = f" {index + 1}" if len(materials) > 1 else ""
        material.name = f"Autumn {label} PBR{suffix}"
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue

        base = bsdf.inputs.get("Base Color")
        metallic = bsdf.inputs.get("Metallic")
        roughness = bsdf.inputs.get("Roughness")
        emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        strength = bsdf.inputs.get("Emission Strength")

        if metallic and not metallic.is_linked:
            metallic.default_value = 0.0
        if roughness and not roughness.is_linked:
            roughness.default_value = max(roughness_floor, roughness.default_value)
        if emission:
            for link in list(emission.links):
                material.node_tree.links.remove(link)
            emission.default_value = (0.0, 0.0, 0.0, 1.0)
        if strength:
            strength.default_value = 0.0

        base_mode = "textured" if base and base.is_linked else "factor"
        print(
            f"Material normalized: {material.name} "
            f"({base_mode}, roughness floor {roughness_floor:.2f})"
        )


def create_owl_perch():
    source = imported_asset_root("PerchedOwl", os.path.join(MODEL_DIR, "perched-owl_raw.glb"))
    tune_imported_asset_materials(source, "Owl", 0.84)
    x, y, height = OWL_POSITION
    owl_tree_offset = tree_grounding_offset("HeroTreeA_03")
    root = place_asset(
        source,
        "Autumn_Owl_Perch",
        (x, y, terrain_height(x, y) + height + owl_tree_offset),
        OWL_HEIGHT,
        # Turned to present its profile to the performance camera rather than
        # its back, which is what made it read as a lumpy grey shape.
        -1.15,
        1.0,
        False,
    )
    root.name = "Autumn_Owl_Perch"
    root["tka_ground_life"] = "owl"
    root["tka_attachment_tree"] = "HeroTreeA_03"
    root["tka_attachment_tree_offset_z"] = owl_tree_offset
    hide_source(source)
    return root


def create_owl_tree_connector():
    """Grow a short branch from HeroTreeA_03 into the owl's baked perch.

    The Meshy owl already includes a branch under its closed talons. This
    tapered connector buries that branch into the nearby trunk fork so the
    combined GLB reads as one physical tree-and-owl asset from every camera.
    """
    owl_x, owl_y, owl_height = OWL_POSITION
    owl_tree_offset = tree_grounding_offset("HeroTreeA_03")
    # Derived from OWL_POSITION so moving the owl can never leave the branch
    # behind. The start is buried inside HeroTreeA_03's trunk fork.
    trunk_x = owl_x + 0.62
    trunk_y = owl_y + 0.47
    start = Vector(
        (
            trunk_x,
            trunk_y,
            terrain_height(trunk_x, trunk_y) + owl_height - 0.50 + owl_tree_offset,
        )
    )
    end = Vector(
        (
            owl_x - 0.12,
            owl_y - 0.12,
            terrain_height(owl_x, owl_y)
            + owl_height
            - OWL_BRANCH_DROP
            + owl_tree_offset,
        )
    )
    direction = end - start
    midpoint = (start + end) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=0.17,
        radius2=0.072,
        depth=direction.length,
        location=midpoint,
    )
    connector = bpy.context.object
    connector.name = "Autumn_Owl_Tree_Connector"
    connector.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    connector.data.materials.append(TWIG)
    connector["tka_ground_life"] = "owl-tree-connector"
    connector["tka_attachment_tree"] = "HeroTreeA_03"
    connector["tka_attachment_tree_offset_z"] = owl_tree_offset
    return connector


def grass_point_is_valid(x, y, rock_placements, mushroom_positions):
    radius = math.hypot(x, y)
    # Hard bounds only. The density falloff toward the outer edge lives in the
    # sampler so this stays a deterministic predicate the validator can reuse.
    if radius < CLEARING_RADIUS + 0.35 or radius > GRASS_FEATHER_END:
        return False
    if in_pond(x, y, margin=0.62):
        return False
    if in_maintained_ground(x, y, lane_clearance=1.35, trail_clearance=0.72, yard_margin=0.18):
        return False
    if not point_clear_of_footprints(x, y, extra=0.24):
        return False
    if not point_clear_of_rocks(x, y, rock_placements, extra=0.20):
        return False
    if any(math.hypot(x - mx, y - my) < 0.14 for mx, my in mushroom_positions):
        return False
    return True


def sample_grass_positions(count, seed, rock_placements, mushroom_positions, occupied):
    rng = random.Random(seed)
    positions = []
    cell_size = 0.16
    attempts = 0
    while len(positions) < count and attempts < count * 80:
        attempts += 1
        center_x, center_y, spread_x, spread_y = GRASS_COLONIES[rng.randrange(len(GRASS_COLONIES))]
        x = rng.gauss(center_x, spread_x * 0.48)
        y = rng.gauss(center_y, spread_y * 0.48)
        if not grass_point_is_valid(x, y, rock_placements, mushroom_positions):
            continue
        # Feather the outer boundary. Acceptance falls from 1 to 0 across the
        # last several metres so the grass thins out; the old hard cut left a
        # visible line where every blade stopped at once.
        radius = math.hypot(x, y)
        if radius > GRASS_FEATHER_START:
            keep = 1.0 - smoothstep(GRASS_FEATHER_START, GRASS_FEATHER_END, radius)
            if rng.random() > keep:
                continue
        cell_x = math.floor(x / cell_size)
        cell_y = math.floor(y / cell_size)
        blocked = False
        for neighbor_x in range(cell_x - 1, cell_x + 2):
            for neighbor_y in range(cell_y - 1, cell_y + 2):
                for ox, oy in occupied.get((neighbor_x, neighbor_y), ()):
                    if (x - ox) ** 2 + (y - oy) ** 2 < cell_size**2:
                        blocked = True
                        break
                if blocked:
                    break
            if blocked:
                break
        if blocked:
            continue
        occupied.setdefault((cell_x, cell_y), []).append((x, y))
        positions.append((x, y))
    if len(positions) != count:
        raise RuntimeError(f"Grass tier placed {len(positions)}/{count} clumps")
    return positions


def create_grass_tier(name, count, seed, material, rock_placements, mushroom_positions, occupied):
    positions = sample_grass_positions(
        count,
        seed,
        rock_placements,
        mushroom_positions,
        occupied,
    )
    rng = random.Random(seed + 991)
    vertices = []
    faces = []
    vertex_uvs = []

    for clump_x, clump_y in positions:
        blade_count = 7 + rng.randrange(6)
        for _blade in range(blade_count):
            offset_angle = rng.uniform(0.0, math.tau)
            offset_radius = math.sqrt(rng.random()) * 0.11
            root_x = clump_x + math.cos(offset_angle) * offset_radius
            root_y = clump_y + math.sin(offset_angle) * offset_radius
            root_z = terrain_height(root_x, root_y) + 0.014
            yaw = rng.uniform(0.0, math.tau)
            right_x = math.cos(yaw)
            right_y = math.sin(yaw)
            lean_angle = yaw + rng.uniform(-0.65, 0.65)
            lean_x = math.cos(lean_angle)
            lean_y = math.sin(lean_angle)
            width = rng.uniform(0.009, 0.022)
            height = rng.uniform(0.12, 0.34)
            mid_lean = rng.uniform(0.008, 0.025)
            tip_lean = rng.uniform(0.025, 0.072)
            start = len(vertices)
            vertices.extend(
                (
                    (root_x - right_x * width, root_y - right_y * width, root_z),
                    (root_x + right_x * width, root_y + right_y * width, root_z),
                    (
                        root_x - right_x * width * 0.72 + lean_x * mid_lean,
                        root_y - right_y * width * 0.72 + lean_y * mid_lean,
                        root_z + height * 0.56,
                    ),
                    (
                        root_x + right_x * width * 0.72 + lean_x * mid_lean,
                        root_y + right_y * width * 0.72 + lean_y * mid_lean,
                        root_z + height * 0.56,
                    ),
                    (
                        root_x - right_x * width * 0.10 + lean_x * tip_lean,
                        root_y - right_y * width * 0.10 + lean_y * tip_lean,
                        root_z + height,
                    ),
                    (
                        root_x + right_x * width * 0.10 + lean_x * tip_lean,
                        root_y + right_y * width * 0.10 + lean_y * tip_lean,
                        root_z + height,
                    ),
                )
            )
            vertex_uvs.extend(
                ((0.0, 0.0), (1.0, 0.0), (0.12, 0.56), (0.88, 0.56), (0.45, 1.0), (0.55, 1.0))
            )
            faces.extend(
                (
                    (start, start + 1, start + 3, start + 2),
                    (start + 2, start + 3, start + 5, start + 4),
                )
            )

    mesh = bpy.data.meshes.new(f"{name} Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="Autumn Grass Root Weight")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = vertex_uvs[vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["tka_grass_clumps"] = count
    obj["tka_quality_tier"] = name.rsplit("_", 1)[-1].lower()
    return positions


def create_grass_system(rock_placements, mushroom_positions):
    occupied = {}
    return {
        "base": create_grass_tier(
            "Autumn_Grass_Base",
            500,
            5101,
            GRASS_BASE,
            rock_placements,
            mushroom_positions,
            occupied,
        ),
        "medium": create_grass_tier(
            "Autumn_Grass_Medium",
            600,
            6101,
            GRASS_MEDIUM,
            rock_placements,
            mushroom_positions,
            occupied,
        ),
        "high": create_grass_tier(
            "Autumn_Grass_High",
            900,
            7101,
            GRASS_HIGH,
            rock_placements,
            mushroom_positions,
            occupied,
        ),
    }


def create_twig_litter(grass_positions):
    rng = random.Random(29071)
    candidates = [position for tier in grass_positions.values() for position in tier]
    vertices = []
    faces = []
    positions = []
    count = 150
    for index in range(count):
        base_x, base_y = candidates[(index * 13) % len(candidates)]
        x = base_x + rng.uniform(-0.35, 0.35)
        y = base_y + rng.uniform(-0.35, 0.35)
        if math.hypot(x, y) < CLEARING_RADIUS + 0.20 or in_pond(x, y, margin=0.30):
            x, y = base_x, base_y
        z = terrain_height(x, y) + 0.026
        positions.append((x, y))
        angle = rng.uniform(0.0, math.tau)
        half_length = rng.uniform(0.08, 0.24)
        half_width = rng.uniform(0.008, 0.019)
        height = rng.uniform(0.010, 0.026)
        forward = Vector((math.cos(angle), math.sin(angle)))
        right = Vector((-forward.y, forward.x))
        corners = (
            Vector((x, y)) - forward * half_length - right * half_width,
            Vector((x, y)) + forward * half_length - right * half_width,
            Vector((x, y)) + forward * half_length + right * half_width,
            Vector((x, y)) - forward * half_length + right * half_width,
        )
        start = len(vertices)
        vertices.extend((corner.x, corner.y, z) for corner in corners)
        vertices.extend((corner.x, corner.y, z + height) for corner in corners)
        faces.extend(
            (
                (start, start + 1, start + 2, start + 3),
                (start + 4, start + 7, start + 6, start + 5),
                (start, start + 4, start + 5, start + 1),
                (start + 1, start + 5, start + 6, start + 2),
                (start + 2, start + 6, start + 7, start + 3),
                (start + 3, start + 7, start + 4, start),
            )
        )
    mesh = bpy.data.meshes.new("Autumn Twig Litter Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(TWIG)
    obj = bpy.data.objects.new("Autumn_Twig_Litter", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["tka_twig_count"] = count
    return positions


def leaf_outline(samples=5):
    """Normalized half-profile of an ovate leaf blade.

    Returns (along, half_width) pairs from the petiole to the tip. The
    fractional power swells the profile quickly off the base so the blade reads
    rounded where it joins the stem and tapers to a point, and the cosine term
    puts shallow lobes on the margin. Mirroring this across the midrib gives the
    full outline.

    This replaces the four-vertex rhombus the litter used to be. Those quads
    were geometrically diamonds, and at every camera distance they read as
    scattered paper confetti rather than leaves.
    """
    profile = []
    for index in range(samples + 1):
        along = index / samples
        half = 0.34 * math.sin(pow(along, 0.58) * math.pi)
        half *= 0.88 + 0.12 * math.cos(along * 17.0)
        profile.append((along, half))
    return profile


LEAF_PROFILE = leaf_outline()


def append_leaf_card(vertices, faces, x, y, z, length, width_scale, yaw, curl, tilt):
    """Emit one leaf-shaped fan at (x, y, z), returning the face count."""
    forward = Vector((math.cos(yaw), math.sin(yaw)))
    right = Vector((-forward.y, forward.x))
    start = len(vertices)

    # Centre of the fan sits slightly proud so the blade is not perfectly flat.
    vertices.append((x, y, z + curl * 0.45))

    ring = []
    # Up one margin from the petiole to the tip...
    for along, half in LEAF_PROFILE:
        ring.append((along, half))
    # ...and back down the other, skipping the shared tip and base points.
    for along, half in reversed(LEAF_PROFILE[1:-1]):
        ring.append((along, -half))

    for along, half in ring:
        # `along` runs 0 at the petiole to 1 at the tip; recentre it so the leaf
        # pivots about its middle like the old quad did.
        offset = forward * ((along - 0.45) * length) + right * (half * length * width_scale)
        # Curl lifts the margins, tilt leans the whole blade off the ground.
        margin_lift = curl * (abs(half) / 0.34)
        vertices.append(
            (
                x + offset.x,
                y + offset.y,
                z + margin_lift + (along - 0.45) * tilt,
            )
        )

    count = len(ring)
    for index in range(count):
        faces.append(
            (
                start,
                start + 1 + index,
                start + 1 + ((index + 1) % count),
            )
        )
    return count


def create_leaf_litter(rock_placements):
    vertices = []
    faces = []
    material_indices = []
    drift_rng = random.Random(22917)
    drift_centers = []
    for _name, _source, x, y, _height, _rotation, _variation, _mirror, footprint in TREE_PLACEMENTS:
        drift_centers.append((x + footprint * 0.65, y - footprint * 0.35, footprint * 1.25, 64))
    for _name, x, y, _height, rotation, _mirror, footprint in SAPLING_PLACEMENTS:
        drift_centers.append((x - math.sin(rotation) * 0.3, y + math.cos(rotation) * 0.3, footprint, 28))
    for _name, x, y, _height, rotation, _variation, _mirror, footprint in LOG_PLACEMENTS:
        drift_centers.append((x - math.sin(rotation) * 0.8, y + math.cos(rotation) * 0.8, footprint, 48))
    drift_centers.extend(
        (
            (7.8, -9.0, 3.2, 46),
            (1.5, 10.0, 3.0, 42),
            (-7.0, 5.5, 2.6, 44),
            (5.8, 6.9, 2.6, 54),
            (7.8, -3.4, 2.4, 50),
            (-3.8, -8.5, 2.8, 56),
            (11.8, 3.2, 2.6, 48),
            (-7.0, 14.0, 2.8, 52),
            # Denser, larger foreground drifts make the generated material read
            # as layered leaf duff rather than one repeated flat texture.
            (-12.5, -12.0, 3.2, 45),
            (-5.0, -12.5, 3.0, 45),
            (5.3, -12.2, 3.0, 45),
            (12.4, -11.0, 3.2, 45),
            # Six offset wind pockets spend the former edge-scatter budget on
            # a readable approach to the clearing. They tighten as they near
            # the stage, producing an S-shaped processional rhythm while the
            # clearing rejection below keeps every performer footprint clean.
            (-2.7, -15.0, 2.1, 53),
            (3.0, -14.2, 2.0, 53),
            (-3.8, -9.6, 1.7, 28),
            (3.9, -9.0, 1.7, 28),
            (-5.6, -5.4, 1.35, 20),
            (5.7, -4.9, 1.35, 20),
            # The same 108-leaf route budget now follows the cabin lane all the
            # way to the door. Banks shrink with distance, while the maintained
            # ground predicate keeps the compacted centre and shared yard open.
            (-4.0, 10.0, 1.10, 12),
            (1.0, 10.0, 1.08, 12),
            (-8.0, 16.0, 1.00, 12),
            (3.0, 16.0, 0.98, 12),
            (-5.0, 24.0, 1.12, 10),
            (0.4, 24.0, 1.10, 10),
            (-6.1, 34.0, 1.06, 8),
            (-1.0, 34.0, 1.04, 8),
            (-7.9, 42.0, 0.98, 6),
            (-3.1, 42.0, 0.96, 6),
            (-10.9, 50.0, 0.90, 6),
            (-6.1, 50.0, 0.88, 6),
            # Two distant wind pockets break the dark horizon floor between
            # trunks without competing with the moon opening.
            (-15.5, 18.0, 3.6, 27),
            (15.5, 19.0, 3.6, 27),
        )
    )

    leaf_total = 0
    for center_x, center_y, spread, count in drift_centers:
        count *= 2
        placed = 0
        attempts = 0
        while placed < count and attempts < count * 40:
            attempts += 1
            x = drift_rng.gauss(center_x, spread * 0.58)
            y = drift_rng.gauss(center_y, spread * 0.30)
            if math.hypot(x, y) < CLEARING_RADIUS + 0.45:
                continue
            if in_pond(x, y, margin=0.18):
                continue
            if in_maintained_ground(
                x,
                y,
                lane_clearance=1.02,
                trail_clearance=0.42,
                yard_margin=-0.70,
            ):
                continue
            if any(math.hypot(x - rx, y - ry) < max(rsx, rsy) * 0.78 for rx, ry, rsx, rsy, *_ in rock_placements):
                continue
            # Alternating low layers catch silhouettes and shadows while still
            # behaving like flat litter under a performer's feet.
            layer = (placed + attempts) % 4
            z = world_surface_height(x, y) + 0.026 + layer * 0.010
            foreground_emphasis = center_y < -10.0 and abs(center_x) < 15.0
            length = (
                drift_rng.uniform(0.11, 0.26)
                if foreground_emphasis
                else drift_rng.uniform(0.08, 0.20)
            )
            yaw = drift_rng.uniform(0.0, math.tau)
            # Narrow and broad blades in the same drift; a single width read as
            # one stamp repeated across the floor.
            width_scale = drift_rng.uniform(0.62, 1.15)
            curl = drift_rng.uniform(0.006, 0.032)
            tilt = drift_rng.uniform(-0.018, 0.018)
            face_count = append_leaf_card(
                vertices, faces, x, y, z, length, width_scale, yaw, curl, tilt
            )
            # Colour is spatially coherent rather than strictly alternating, so
            # drifts show patches of one species instead of even rainbow noise.
            species = int((math.sin(x * 0.7) + math.cos(y * 0.9) + 2.0) * 1.4) % 3
            material_indices.extend([species] * face_count)
            placed += 1
            leaf_total += 1
        if placed != count:
            raise RuntimeError(
                f"Leaf drift at {(center_x, center_y)} placed {placed}/{count}"
            )

    # Reallocate 96 existing leaves to the stage perimeter. The authored
    # clearing rejection is correct for performers, but it also left a sterile
    # ring around the shared stage. Six small wind banks touch the outside of
    # the platform without placing a single card on its top or blocking the
    # cabin lane behind it.
    stage_bank_rng = random.Random(51173)
    stage_banks = (
        (-3.34, -1.75),
        (-3.36, 0.95),
        (3.34, -1.10),
        (3.37, 1.72),
        (-1.62, -3.34),
        (1.58, -3.36),
    )
    stage_leaf_count = 0
    for center_x, center_y in stage_banks:
        placed = 0
        attempts = 0
        while placed < STAGE_EDGE_LEAF_COUNT // len(stage_banks) and attempts < 640:
            attempts += 1
            x = stage_bank_rng.gauss(center_x, 0.34)
            y = stage_bank_rng.gauss(center_y, 0.48)
            if abs(x) < STAGE_HALF_WIDTH + 0.08 and abs(y) < STAGE_HALF_DEPTH + 0.08:
                continue
            if in_maintained_ground(x, y, lane_clearance=0.36, trail_clearance=0.24):
                continue
            z = world_surface_height(x, y) + 0.028 + (placed % 3) * 0.009
            length = stage_bank_rng.uniform(0.10, 0.22)
            yaw = stage_bank_rng.uniform(0.0, math.tau)
            width_scale = stage_bank_rng.uniform(0.68, 1.08)
            curl = stage_bank_rng.uniform(0.008, 0.026)
            tilt = stage_bank_rng.uniform(-0.012, 0.012)
            face_count = append_leaf_card(
                vertices, faces, x, y, z, length, width_scale, yaw, curl, tilt
            )
            species = int((math.sin(x * 0.9) + math.cos(y * 0.8) + 2.0) * 1.3) % 3
            material_indices.extend([species] * face_count)
            placed += 1
            leaf_total += 1
            stage_leaf_count += 1
        if placed != STAGE_EDGE_LEAF_COUNT // len(stage_banks):
            raise RuntimeError(
                f"Stage leaf bank at {(center_x, center_y)} placed "
                f"{placed}/{STAGE_EDGE_LEAF_COUNT // len(stage_banks)}"
            )

    mesh = bpy.data.meshes.new("Ecological Leaf Drift Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for material in (LEAF_RED, LEAF_ORANGE, LEAF_GOLD):
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
        polygon.use_smooth = True
    obj = bpy.data.objects.new("Autumn_Leaf_Drifts", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["tka_leaf_count"] = leaf_total
    obj["tka_leaf_faces"] = len(faces)
    obj["tka_stage_edge_leaf_count"] = stage_leaf_count
    return leaf_total


def verify_ecology(
    fern_positions,
    rock_placements,
    leaf_count,
    mushroom_records,
    mushroom_positions,
    grass_positions,
    twig_positions,
):
    clearing_probes = []
    for ring in (0.0, 2.0, 4.0, 6.0):
        for index in range(16):
            x = ring * math.cos(index * math.tau / 16)
            y = ring * math.sin(index * math.tau / 16)
            clearing_probes.append(abs(terrain_height(x, y)))
    maximum = max(clearing_probes)
    if maximum > 0.001:
        raise RuntimeError(f"Performance clearing is not level: max deviation {maximum}")

    pond_fern_collisions = [(x, y) for x, y in fern_positions if in_pond(x, y, margin=0.35)]
    footprint_fern_collisions = [
        (x, y) for x, y in fern_positions if not point_clear_of_footprints(x, y, extra=0.28)
    ]
    stage_fern_collisions = [(x, y) for x, y in fern_positions if math.hypot(x, y) < CLEARING_RADIUS + 0.65]
    settlement_fern_collisions = [
        (x, y)
        for x, y in fern_positions
        if in_maintained_ground(x, y, lane_clearance=1.45, trail_clearance=0.78, yard_margin=0.10)
    ]
    shoreline_errors = [
        (x, y) for x, y, _sx, _sy, _sz, _rotation, _prototype, region in rock_placements
        if region == "Shore" and not (0.92 <= pond_metric(x, y) <= 1.35)
    ]
    settlement_rock_collisions = [
        (x, y)
        for x, y, sx, sy, _sz, _rotation, _prototype, region in rock_placements
        if region == "Forest"
        and in_maintained_ground(
            x,
            y,
            lane_clearance=max(sx, sy) + 0.45,
            trail_clearance=max(sx, sy) + 0.20,
            yard_margin=max(sx, sy) * 0.35,
        )
    ]
    all_grass = [position for tier in grass_positions.values() for position in tier]
    grass_errors = [
        (x, y)
        for x, y in all_grass
        if not grass_point_is_valid(x, y, rock_placements, mushroom_positions)
    ]
    mushroom_errors = [
        record
        for record in mushroom_records
        if not mushroom_point_is_valid(
            record["x"],
            record["y"],
            rock_placements,
            allow_deadwood=record["habitat"] == "fallen-deadwood",
        )
    ]
    deadwood_errors = [
        record
        for record in mushroom_records
        if record["habitat"] == "fallen-deadwood"
        and min(
            math.hypot(record["x"] - placement[1], record["y"] - placement[2])
            for placement in LOG_PLACEMENTS
        )
        > 2.8
    ]
    mushroom_species_counts = {}
    for record in mushroom_records:
        species = record["species"]
        mushroom_species_counts[species] = mushroom_species_counts.get(species, 0) + 1
    expected_mushroom_species = {
        "Marasmius oreades": 20,
        "Laccaria amethystina": 15,
        "Armillaria species": 15,
    }
    mushroom_species_error = (
        mushroom_species_counts
        if mushroom_species_counts != expected_mushroom_species
        else None
    )
    twig_errors = [
        (x, y)
        for x, y in twig_positions
        if math.hypot(x, y) < CLEARING_RADIUS + 0.20 or in_pond(x, y, margin=0.30)
    ]
    expected_grass = {"base": 500, "medium": 600, "high": 900}
    # Every hero root drift authors 64 placements and doubles them into two
    # depth layers. Keep the contract joined to TREE_PLACEMENTS so an approved
    # tree removal cannot leave the asset builder expecting an orphaned drift.
    leaf_expected = 2480 + len(TREE_PLACEMENTS) * 128
    count_errors = {
        tier: len(grass_positions[tier])
        for tier, expected in expected_grass.items()
        if len(grass_positions[tier]) != expected
    }
    distant_tree_errors = [
        name
        for name, *_rest in DISTANT_TREE_PLACEMENTS
        if bpy.data.objects.get(name) is None
    ]
    distant_family_counts = {}
    for _name, family, *_rest in DISTANT_TREE_PLACEMENTS:
        distant_family_counts[family] = distant_family_counts.get(family, 0) + 1
    expected_distant_families = {"Birch": 5, "Snag": 5, "Larch": 4, "Willow": 3}
    distant_family_error = (
        distant_family_counts
        if distant_family_counts != expected_distant_families
        else None
    )
    middle_tree_errors = [
        name
        for name, *_rest in MID_DEPTH_TREE_PLACEMENTS
        if bpy.data.objects.get(name) is None
    ]
    middle_family_counts = {}
    for _name, family, *_rest in MID_DEPTH_TREE_PLACEMENTS:
        middle_family_counts[family] = middle_family_counts.get(family, 0) + 1
    expected_middle_families = {"Birch": 7, "Larch": 6, "Willow": 4, "Snag": 5}
    middle_family_error = (
        middle_family_counts
        if middle_family_counts != expected_middle_families
        else None
    )
    far_tree_errors = [
        name
        for name, *_rest in FAR_DEPTH_TREE_PLACEMENTS
        if bpy.data.objects.get(name) is None
    ]
    far_family_counts = {}
    for _name, family, *_rest in FAR_DEPTH_TREE_PLACEMENTS:
        far_family_counts[family] = far_family_counts.get(family, 0) + 1
    expected_far_families = {"FarRed": 16, "FarGold": 15, "FarLarch": 15, "FarSnag": 7}
    far_family_error = (
        far_family_counts
        if far_family_counts != expected_far_families
        else None
    )
    cabin_lane = bpy.data.objects.get("Autumn_Cabin_Lane")
    forest_trail = bpy.data.objects.get("Autumn_Forest_Trail")
    cabin_lane_length = (
        float(cabin_lane.get("tka_path_length_metres", 0.0)) if cabin_lane else 0.0
    )
    forest_trail_length = (
        float(forest_trail.get("tka_path_length_metres", 0.0)) if forest_trail else 0.0
    )
    cabin_lane_tree_errors = [
        name
        for name, _family, x, y, _height, _rotation, _variation, _mirror, footprint in TREE_PLACEMENTS
        if distance_to_cabin_lane(x, y) < footprint + 1.25
    ]
    cabin_lane_tree_errors.extend(
        name
        for name, _family, x, y, _height, _rotation, _variation, _mirror, footprint in DISTANT_TREE_PLACEMENTS
        if distance_to_cabin_lane(x, y) < footprint + 1.25
    )
    cabin_lane_tree_errors.extend(
        name
        for name, _family, x, y, _height, _rotation, _variation, _mirror, footprint in MID_DEPTH_TREE_PLACEMENTS
        if distance_to_cabin_lane(x, y) < footprint + 1.25
    )
    forest_trail_tree_errors = [
        name
        for name, _family, x, y, _height, _rotation, _variation, _mirror, footprint in MID_DEPTH_TREE_PLACEMENTS
        if distance_to_forest_trail(x, y) < footprint + 0.9
    ]
    forest_trail_tree_errors.extend(
        name
        for name, _family, x, y, *_rest in FAR_DEPTH_TREE_PLACEMENTS
        if distance_to_forest_trail(x, y) < 2.5
    )
    path_error = (
        cabin_lane is None
        or forest_trail is None
        or cabin_lane_length < 48.0
        or forest_trail_length < 70.0
        or math.hypot(CABIN_LANE_PATH[0][0], CABIN_LANE_PATH[0][1]) > CLEARING_RADIUS + 1.0
        or oval_metric(FOREST_TRAIL_PATH[0][0], FOREST_TRAIL_PATH[0][1], SHARED_YARD) > 1.2
        or math.hypot(FOREST_TRAIL_PATH[-1][0], FOREST_TRAIL_PATH[-1][1]) < 90.0
        or bool(cabin_lane_tree_errors)
        or bool(forest_trail_tree_errors)
    )
    cabin_name, cabin_x, cabin_y, *_cabin_rest = DISTANT_CABIN_PLACEMENT
    cabin = bpy.data.objects.get(cabin_name)
    cabin_radius = math.hypot(cabin_x, cabin_y)
    cabin_path_distance = distance_to_cabin_lane(cabin_x, cabin_y)
    cabin_error = (
        cabin is None
        or not 50.0 <= cabin_radius <= 62.0
        or not 0.8 <= cabin_path_distance <= 2.4
        or cabin.get("tka_scenery_tier") != "distant-civilization"
        or cabin.get("tka_path_reveal") != "partial"
    )
    expected_grounded_tree_names = [
        placement[0]
        for placements in (
            TREE_PLACEMENTS,
            DISTANT_TREE_PLACEMENTS,
            MID_DEPTH_TREE_PLACEMENTS,
            FAR_DEPTH_TREE_PLACEMENTS,
            SAPLING_PLACEMENTS,
        )
        for placement in placements
    ]
    tree_grounding_errors = [
        name
        for name in expected_grounded_tree_names
        if name not in TREE_GROUNDING_RESULTS
        or TREE_GROUNDING_RESULTS[name]["samples"] < TREE_ROOT_MIN_CONTACT_SAMPLES
        or TREE_GROUNDING_RESULTS[name]["maximum_clearance_after"]
        > -TREE_ROOT_CONTACT_MARGIN + 0.002
    ]
    owl_tree_errors = [
        name
        for name in ("Autumn_Owl_Perch", "Autumn_Owl_Tree_Connector")
        if bpy.data.objects.get(name) is None
    ]
    habitation_errors = [
        name
        for name in (
            "Autumn_Shared_Yard",
            "Autumn_Shack_Door_Yard",
            "Autumn_Rough_Bench_Seat",
            "Autumn_Stump_Seat_01",
            "Autumn_Stump_Seat_02",
            "Autumn_Chopping_Block",
            "Autumn_Water_Pail",
            "Autumn_Wayfinding_Lantern_Glow",
            "Autumn_Cabin_Window_Glow",
            "Autumn_Door_Step_01",
        )
        if bpy.data.objects.get(name) is None
    ]
    if (
        pond_fern_collisions
        or footprint_fern_collisions
        or stage_fern_collisions
        or settlement_fern_collisions
        or shoreline_errors
        or settlement_rock_collisions
        or grass_errors
        or mushroom_errors
        or deadwood_errors
        or mushroom_species_error
        or twig_errors
        or count_errors
        or distant_tree_errors
        or distant_family_error
        or middle_tree_errors
        or middle_family_error
        or far_tree_errors
        or far_family_error
        or path_error
        or cabin_error
        or tree_grounding_errors
        or owl_tree_errors
        or habitation_errors
        or leaf_count != leaf_expected
        or len(mushroom_positions) != 50
    ):
        raise RuntimeError(
            "Ecology validation failed: "
            f"pond ferns={len(pond_fern_collisions)}, "
            f"footprint ferns={len(footprint_fern_collisions)}, "
            f"stage ferns={len(stage_fern_collisions)}, "
            f"settlement ferns={len(settlement_fern_collisions)}, "
            f"shoreline rocks={len(shoreline_errors)}, "
            f"settlement rocks={len(settlement_rock_collisions)}, "
            f"grass={len(grass_errors)}, mushrooms={len(mushroom_errors)}, "
            f"deadwood mushrooms={len(deadwood_errors)}, "
            f"mushroom species={mushroom_species_error}, "
            f"twigs={len(twig_errors)}, count errors={count_errors}, "
            f"distant trees={distant_tree_errors}, families={distant_family_error}, "
            f"middle trees={middle_tree_errors}, families={middle_family_error}, "
            f"far trees={far_tree_errors}, families={far_family_error}, "
            f"path error={path_error}, cabin blockers={cabin_lane_tree_errors}, "
            f"forest blockers={forest_trail_tree_errors}, "
            f"distant cabin error={cabin_error}, "
            f"tree grounding={tree_grounding_errors}, "
            f"owl tree={owl_tree_errors}, "
            f"habitation details={habitation_errors}, "
            f"leaves={leaf_count}"
        )
    print(f"Performance clearing verified: max deviation {maximum:.6f}m")
    print(
        f"Tree grounding verified: {len(expected_grounded_tree_names)} placements, "
        f"{sum(result['samples'] for result in TREE_GROUNDING_RESULTS.values())} "
        f"root-envelope samples, max clearance "
        f"{max(result['maximum_clearance_after'] for result in TREE_GROUNDING_RESULTS.values()):.3f}m"
    )
    outer_grass = [1 for x, y in all_grass if math.hypot(x, y) > GRASS_FEATHER_START]
    print(
        "Ecology verified: "
        f"{len(fern_positions)} ferns, {len(rock_placements)} boulders, {leaf_count} leaves, "
        f"{len(all_grass)} grass clumps, {len(mushroom_positions)} mushroom fruiting bodies, "
        f"{len(twig_positions)} twigs, 0 forbidden-placement collisions"
    )
    print(f"Mushroom ecology verified: {mushroom_species_counts}")
    print(
        f"Grass feathering: {len(outer_grass)} clumps beyond {GRASS_FEATHER_START}m "
        f"(hard edge was 22.5m, now ramps to {GRASS_FEATHER_END}m)"
    )
    print(
        f"Distant tree belt verified: {len(DISTANT_TREE_PLACEMENTS)} placements "
        f"{distant_family_counts}; owl branch connector present"
    )
    print(
        "Depth composition verified: "
        f"{len(MID_DEPTH_TREE_PLACEMENTS)} middle trees {middle_family_counts}, "
        f"{len(FAR_DEPTH_TREE_PLACEMENTS)} far silhouettes {far_family_counts}, "
        f"{cabin_lane_length:.1f}m cabin lane + {forest_trail_length:.1f}m forest trail"
    )
    print(
        "Distant cabin verified: "
        f"{cabin_radius:.1f}m from stage, {cabin_path_distance:.1f}m from the lane, "
        "partial tree-screen reveal"
    )
    print("Settlement verified: shared yard, door apron, seating, chores, and one lantern")


def aim_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, color, energy, size, target):
    data = bpy.data.lights.new(name, "AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    aim_at(light, target)


def render_qa_view(camera, location, target, path, lens=38):
    camera.location = location
    camera.data.lens = lens
    aim_at(camera, target)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def create_qa_performer_reference():
    """Add a 1.76 m reference silhouette that is excluded from the GLB export.

    The proxy previously stood on legs centred at z=0.42 with depth 0.62, so its
    feet ended at z=0.11 - 11cm above the ground. Every floor QA render it
    appeared in therefore showed a visible gap under it, which meant the
    "level performance footprint" evidence never actually demonstrated contact.
    Parts below are stacked from z=0 so the soles touch the clearing.
    """
    material = principled_material(
        "QA Performer Scale Reference",
        (0.95, 0.30, 0.08),
        roughness=0.48,
        emission=(0.45, 0.055, 0.012),
        emission_strength=0.16,
    )
    parts = []

    leg_depth = 0.62
    leg_center = leg_depth * 0.5              # soles at exactly z = 0
    torso_depth = 0.92
    torso_center = leg_depth + torso_depth * 0.5
    head_radius = 0.16
    head_center = leg_depth + torso_depth + head_radius * 0.65

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.19, depth=torso_depth, location=(0, 0, torso_center)
    )
    torso = bpy.context.object
    torso.name = "QA_Performer_Torso"
    torso.scale = (1.0, 0.62, 1.0)
    parts.append(torso)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=8, radius=head_radius, location=(0, 0, head_center)
    )
    head = bpy.context.object
    head.name = "QA_Performer_Head"
    parts.append(head)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12,
            radius=0.065,
            depth=leg_depth,
            location=(side * 0.105, 0, leg_center),
        )
        leg = bpy.context.object
        leg.name = f"QA_Performer_Leg_{'L' if side < 0 else 'R'}"
        parts.append(leg)

    for part in parts:
        part.data.materials.append(material)

    proxy_height = head_center + head_radius
    print(f"QA performer proxy: soles at z=0.000m, crown at z={proxy_height:.3f}m")
    return parts


def setup_qa_render():
    scene = bpy.context.scene
    # The EEVEE identifier moved between Blender releases (BLENDER_EEVEE ->
    # BLENDER_EEVEE_NEXT -> back again). Pick whichever this build advertises so
    # the QA renders work headless on any installed version.
    engines = {
        item.identifier
        for item in scene.render.bl_rna.properties["engine"].enum_items
    }
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        if candidate in engines:
            scene.render.engine = candidate
            break
    print(f"QA render engine: {scene.render.engine}")
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    world = bpy.data.worlds.new("Autumn Dusk World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.045, 0.012, 0.068, 1.0)
    background.inputs["Strength"].default_value = 0.28
    scene.world = world

    add_area_light("Light_Sunset_Key", (-12, -18, 18), (1.0, 0.25, 0.07), 2800, 11.0, (0, 2, 3))
    add_area_light("Light_Violet_Fill", (16, 8, 16), (0.22, 0.12, 1.0), 2300, 13.0, (0, 4, 4))
    add_area_light("Light_Amber_Rim", (-18, 22, 10), (1.0, 0.52, 0.12), 1950, 9.0, (-2, 10, 5))
    add_area_light("Light_Pond_Glint", (POND_X - 3, POND_Y - 4, 8), (0.18, 0.38, 1.0), 520, 8.0, (POND_X, POND_Y, 0))

    camera_data = bpy.data.cameras.new("Camera_Autumn_QA")
    camera = bpy.data.objects.new("Camera_Autumn_QA", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.data.sensor_width = 36
    scene.camera = camera
    performer_reference = create_qa_performer_reference()

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except (TypeError, ValueError):
        pass

    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    render_qa_view(camera, (0.0, -36.0, 14.2), (0.0, 4.0, 3.0), QA_PATHS["hero"], 39)
    render_qa_view(camera, (0.0, -13.0, 2.7), (0.0, -4.8, 0.35), QA_PATHS["floor"], 52)
    render_qa_view(camera, (-1.5, -27.0, 8.5), (POND_X, POND_Y + 1.2, 0.3), QA_PATHS["pond"], 48)
    render_qa_view(camera, (4.0, 34.0, 13.5), (0.0, 1.5, 2.8), QA_PATHS["reverse"], 40)
    render_qa_view(camera, (0.0, -29.0, 9.5), (0.0, 42.0, 2.2), QA_PATHS["depth"], 46)
    render_qa_view(
        camera,
        (2.0, -18.0, 8.4),
        (-4.5, 29.0, 1.0),
        QA_PATHS["settlement"],
        43,
    )
    render_qa_view(
        camera,
        (DISTANT_CABIN_PLACEMENT[1], 48.0, 4.0),
        (DISTANT_CABIN_PLACEMENT[1], DISTANT_CABIN_PLACEMENT[2], 2.0),
        QA_PATHS["shack"],
        58,
    )
    for part in performer_reference:
        part.hide_render = True
        part.hide_set(True)
    owl_x, owl_y, owl_height = OWL_POSITION
    owl_center_z = (
        terrain_height(owl_x, owl_y)
        + owl_height
        + tree_grounding_offset("HeroTreeA_03")
        + OWL_HEIGHT * 0.5
    )
    render_qa_view(
        camera,
        (owl_x - 3.4, owl_y - 5.65, owl_center_z + 1.0),
        (owl_x, owl_y, owl_center_z),
        QA_PATHS["owl"],
        66,
    )
    render_qa_view(
        camera,
        (0.0, 2.0, 2.4),
        (TREE_PLACEMENTS[2][2], TREE_PLACEMENTS[2][3], 0.7),
        QA_PATHS["owl_root"],
        52,
    )
    render_qa_view(
        camera,
        (4.0, 8.7, 0.75),
        (4.0, 12.0, 0.09),
        QA_PATHS["champignon"],
        58,
    )
    render_qa_view(
        camera,
        (-9.55, 3.65, 0.55),
        (-9.55, 5.45, 0.08),
        QA_PATHS["amethyst"],
        66,
    )
    render_qa_view(
        camera,
        (10.35, 4.95, 0.58),
        (10.35, 6.75, 0.10),
        QA_PATHS["honey"],
        66,
    )
    # Return the editable file to the hero camera view for the visible host.
    camera.location = (0.0, -36.0, 14.2)
    camera.data.lens = 39
    aim_at(camera, (0.0, 4.0, 3.0))
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


create_terrain()
apron_face_count = create_terrain_apron()
create_ground_regions()
path_lengths = create_autumn_paths()
create_pond_basin()
floating_leaf_count = create_floating_pond_leaves()
fern_positions = create_asset_placements()
rock_placements = create_rocks()
habitation_props = create_habitation_props()
mushroom_records = create_mushroom_ecology(rock_placements)
mushroom_positions = [(record["x"], record["y"]) for record in mushroom_records]
owl_perch = create_owl_perch()
owl_tree_connector = create_owl_tree_connector()
grass_positions = create_grass_system(rock_placements, mushroom_positions)
twig_positions = create_twig_litter(grass_positions)
leaf_count = create_leaf_litter(rock_placements)
verify_ecology(
    fern_positions,
    rock_placements,
    leaf_count,
    mushroom_records,
    mushroom_positions,
    grass_positions,
    twig_positions,
)
setup_qa_render()

print("\nAutumn environment authored successfully")
print(f"Editable source: {BLEND_PATH}")
for label, path in QA_PATHS.items():
    print(f"QA {label:7}:      {path}")
print(f"Mesh objects:    {sum(1 for obj in bpy.data.objects if obj.type == 'MESH' and obj.visible_get())}")
print(f"Unique meshes:   {len(bpy.data.meshes)}")
print(f"Materials:       {len(bpy.data.materials)}")
print(f"Terrain apron:   {apron_face_count} quads out to {APRON_OUTER_HALF_SIZE:.0f}m")
print(
    f"Settlement paths: {path_lengths['cabin_lane']:.1f}m to shack + "
    f"{path_lengths['forest_trail']:.1f}m to golden larch sentinel"
)
print(f"Habitation cues: {len(habitation_props)} practical prop pieces")
print(f"Floating leaves: {floating_leaf_count}")
print(f"Grass clumps:    {sum(len(tier) for tier in grass_positions.values())}")
print(f"Mushroom fruit:  {len(mushroom_positions)} individuals")
print(f"Twig litter:     {len(twig_positions)} pieces")
print(f"Owl tree:        {owl_perch.name} + {owl_tree_connector.name}")
