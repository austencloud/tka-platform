"""The trench floor — one height field, three consumers.

The seabed shipped as a flat untextured plane and 712 reef specimens were
placed on it. Every frame bottomed out in dead teal no matter how the
composition was tuned, because there was nothing down there to look at and no
route through it: the visitor could walk anywhere, so nowhere read as the way.

This module is the floor's single owner. It is imported by:

  build-traverse-seabed.py   bakes the visual mesh (Blender -> GLB)
  generate-traverse-reef.py  samples it so specimens sit ON the ground
  water-traverse-seabed-heights.json  the coarse grid the runtime walks

A fourth consumer deriving its own idea of where the ground is would be the
whole bug again, so there isn't one. The JSON is generated here, never hand
edited.

── The shape ───────────────────────────────────────────────────────────────

Relief is measured UP from the analytic base floor (flat trench, plus the
descent and ascent ramps). It is never negative, which is what lets the runtime
keep a flat safety plane underneath and tile the walkable surface on top.

  |x| <= PATH_HALF_W      0.0    the cleared route. Flat, and flat on purpose:
                                 a worn path is the ground that has had its
                                 rubble taken away.
  PATH_HALF_W .. VERGE    ramp   the lip of the path, smoothstepped so the
                                 route has an edge you can see without a kerb.
  beyond VERGE            dunes  layered ridges and rubble, amplitude growing
                                 with distance out, so the flanks rise and the
                                 middle stays legible from eye height.

The route is straight because the walk is forward-only and the arches stand on
the centreline. A meandering path would put the arches off it.
"""

import json
import math
import os

# ── Datums, mirrored from water-traverse-terrain.ts ─────────────────────────
# These are the ONLY duplicated numbers, and the ones least likely to move:
# they are the leg seams the whole piece is built on. build_base_profile below
# reproduces that file's floorYAt for the underwater legs.

WATERLINE_Y = 0.0
SNOW_Y = WATERLINE_Y + 0.28
SEA_FLOOR_Y = -18.0
SPRING_FLOOR_Y = WATERLINE_Y - 0.9
EYE_ABOVE_FLOOR = 1.6
SURFACE_BREAK_Y = WATERLINE_Y - EYE_ABOVE_FLOOR

SNOW_END_Z = 52.0
DESCENT_END_Z = 92.0
SEA_END_Z = 144.0
ASCENT_END_Z = 190.0

CHANNEL_HALF_W = 4.5

# ── The field ───────────────────────────────────────────────────────────────

#: The floor this module covers: the whole underwater leg, ramps included.
FIELD_MIN_Z = SNOW_END_Z
FIELD_MAX_Z = ASCENT_END_Z
FIELD_HALF_W = 42.0

#: The cleared route. Slightly wider than the water channel above it so the
#: path reads as generous rather than as a slot to thread.
PATH_HALF_W = 5.2
#: Where the path's lip finishes rising into open seabed.
VERGE_HALF_W = 8.4

#: Relief cap at the far flanks. Tall enough to close the frame off-route,
#: short enough that the ridge walls behind are never hidden.
MAX_RELIEF = 2.6

#: Mesh resolution for the baked visual. 0.9 m holds the dune crests without
#: turning the GLB into a million triangles.
MESH_STEP = 0.9
#: Collider resolution. Coarser on purpose: these are stepped cuboids, and a
#: 3 m cell keeps the step under the controller's autostep everywhere the
#: gradient is walkable.
TILE_STEP = 3.0


def base_floor_y(z: float) -> float:
    """Elevation of the analytic floor at a route Z, ramps included.

    Reproduces floorYAt() from water-traverse-terrain.ts across the underwater
    legs. The ascent's split is derived the same way it is there — the landing
    is placed so the visitor's eye breaks the surface on flat ground — so this
    tracks the ramps rather than approximating them.
    """
    if z <= SNOW_END_Z:
        return SNOW_Y
    if z < DESCENT_END_Z:
        t = (z - SNOW_END_Z) / (DESCENT_END_Z - SNOW_END_Z)
        return SNOW_Y + (SEA_FLOOR_Y - SNOW_Y) * t
    if z <= SEA_END_Z:
        return SEA_FLOOR_Y

    landing_length = 4.0
    rise = SPRING_FLOOR_Y - SEA_FLOOR_Y
    to_break = SURFACE_BREAK_Y - SEA_FLOOR_Y
    span = ASCENT_END_Z - SEA_END_Z - landing_length
    lower_run = span * (to_break / rise)
    lower_end_z = SEA_END_Z + lower_run
    landing_end_z = lower_end_z + landing_length

    if z < lower_end_z:
        t = (z - SEA_END_Z) / lower_run
        return SEA_FLOOR_Y + (SURFACE_BREAK_Y - SEA_FLOOR_Y) * t
    if z <= landing_end_z:
        return SURFACE_BREAK_Y
    t = (z - landing_end_z) / (ASCENT_END_Z - landing_end_z)
    return SURFACE_BREAK_Y + (SPRING_FLOOR_Y - SURFACE_BREAK_Y) * t


def _smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge1 <= edge0:
        return 0.0
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def _noise(x: float, z: float) -> float:
    """Deterministic layered relief in roughly [-1, 1].

    Sines rather than a gradient-noise implementation: the ground is dunes and
    rubble banks, which ARE periodic at a couple of scales, and a closed form
    means the Blender bake, the collider grid and the reef sampler cannot
    disagree about a single vertex.
    """
    ridges = (
        math.sin(x * 0.083 + z * 0.041)
        + 0.72 * math.sin(x * 0.147 - z * 0.109 + 1.7)
        + 0.48 * math.sin(x * 0.052 + z * 0.211 + 4.1)
    ) / 2.2
    rubble = (
        0.30 * math.sin(x * 0.61 + z * 0.44 + 2.3)
        + 0.22 * math.sin(x * 0.93 - z * 0.77 + 5.2)
        + 0.14 * math.sin(x * 1.71 + z * 1.33 + 0.9)
    )
    return ridges + rubble


def relief_at(x: float, z: float) -> float:
    """Height of the seabed ABOVE the analytic base floor. Never negative."""
    lip = _smoothstep(PATH_HALF_W, VERGE_HALF_W, abs(x))
    if lip <= 0.0:
        return 0.0

    # Amplitude grows with distance from the route: gentle where the visitor
    # steps off, tall enough at the flanks to give the frame a bottom edge.
    reach = _smoothstep(VERGE_HALF_W, FIELD_HALF_W * 0.85, abs(x))
    amplitude = 0.34 + reach * (MAX_RELIEF - 0.34)

    # The field is lifted to [0, 1] rather than clamped: clamping flattens
    # every trough into the same dead plateau, which is what the graybox
    # already looked like.
    height = (_noise(x, z) + 1.35) / 2.7
    height = min(1.0, max(0.0, height))

    # Both ends taper out so the sculpted floor meets the snowfield and the
    # spring plain without a wall at the seam.
    ends = min(
        _smoothstep(FIELD_MIN_Z, FIELD_MIN_Z + 10.0, z),
        1.0 - _smoothstep(FIELD_MAX_Z - 10.0, FIELD_MAX_Z, z),
    )

    return lip * ends * amplitude * height


def surface_y(x: float, z: float) -> float:
    """Walkable elevation of the sculpted seabed at a world point."""
    return base_floor_y(z) + relief_at(x, z)


# ── The collider grid ───────────────────────────────────────────────────────


def build_height_grid() -> dict:
    """Coarse grid the runtime tiles its floor colliders from.

    Cell height is the MAXIMUM of the cell's corners and centre, not the mean:
    a tile that sits at the average of a crest and a trough leaves the crest
    poking through the floor the visitor is standing on.
    """
    cols = int(round((FIELD_HALF_W * 2) / TILE_STEP))
    rows = int(round((FIELD_MAX_Z - FIELD_MIN_Z) / TILE_STEP))
    heights = []

    for row in range(rows):
        z0 = FIELD_MIN_Z + row * TILE_STEP
        z1 = z0 + TILE_STEP
        line = []
        for col in range(cols):
            x0 = -FIELD_HALF_W + col * TILE_STEP
            x1 = x0 + TILE_STEP
            samples = [
                relief_at(x0, z0),
                relief_at(x1, z0),
                relief_at(x0, z1),
                relief_at(x1, z1),
                relief_at((x0 + x1) / 2, (z0 + z1) / 2),
            ]
            line.append(round(max(samples), 3))
        heights.append(line)

    return {
        "note": (
            "Generated by scripts/traverse_seabed.py. Relief in metres ABOVE "
            "the analytic base floor, never below it. Do not hand edit."
        ),
        "minX": -FIELD_HALF_W,
        "minZ": FIELD_MIN_Z,
        "step": TILE_STEP,
        "cols": cols,
        "rows": rows,
        "pathHalfWidth": PATH_HALF_W,
        "relief": heights,
    }


def write_height_grid(path: str) -> dict:
    grid = build_height_grid()
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(grid, handle, indent=1)
        handle.write("\n")
    return grid


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    # Written into the feature's data directory rather than scripts/, because
    # the runtime imports it directly — the grid IS the floor the visitor
    # walks, not a build intermediate.
    out = os.path.join(
        repo,
        "src",
        "lib",
        "features",
        "water-traverse",
        "data",
        "seabed-heights.json",
    )
    grid = write_height_grid(out)
    peak = max(max(line) for line in grid["relief"])
    print(f"wrote {out}")
    print(f"  {grid['cols']} x {grid['rows']} cells, peak relief {peak:.2f} m")
