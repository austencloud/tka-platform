"""Ocean floor height, UV and depth-darkening math for the Fathom reef.

Pure math, no `bpy`. Kept separate from build-ocean-terrain.py so the shape of
the world can be tested without launching Blender.

Coordinates are Blender's: x/y horizontal, z up. The seabed top is z = 0 and
the water plane is z = +12. North (+y) is upstage, behind the proscenium arch.

Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
"""

import math

CLEARING_RADIUS = 8.0
SHELF_OUTER_RADIUS = 24.0
WATER_PLANE_Z = 12.0
WALL_CREST_Z = 15.0
# Starts at 22, not 16: placements now run to the 24 m lip, and a wall ramping
# from 16 puts ~1.9 m of rise under coral at r=20 that was authored on a flat
# plate. From 22 the shelf stays walkable and the wall climbs mostly outside
# the placement boundary.
WALL_RAMP_START = 22.0
WALL_RAMP_END = 34.0
ABYSS_DEPTH = 45.0
ABYSS_RAMP_METRES = 10.0
WORLD_RADIUS = 110.0
TERRAIN_ANGULAR_SEGMENTS = 192
TERRAIN_RADIAL_SEGMENTS = 128
TERRAIN_UV_METRES = 12.0
DARKEN_START_Z = -2.0
DARKEN_FULL_Z = -38.0


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 0.0 if value < edge0 else 1.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def north_gate(x, y):
    """1.0 due north, 0.0 due south, smooth across east and west.

    Gates the wall onto the upstage half without producing a seam at the
    east/west meridian, which a hard `y > 0` test would.
    """
    radius = math.hypot(x, y)
    if radius < 1e-6:
        return 0.0
    return smoothstep(-0.15, 0.55, y / radius)


def lip_radius(angle):
    """Where the shelf ends and the abyss begins, for one direction.

    Three harmonics, same technique as build-winter-environment.py's
    terrain_boundary_radius. Amplitude sums to +/- 2.5 m on a 24 m nominal
    radius, holding the siblings' ~10% proportion so the edge is never a circle.
    """
    return (
        SHELF_OUTER_RADIUS
        + 1.3 * math.sin(angle * 3.0 + 0.7)
        + 0.8 * math.sin(angle * 5.0 - 1.1)
        + 0.4 * math.cos(angle * 9.0 + 0.2)
    )


def shelf_relief(x, y, radius):
    """Gentle broken ground across the reef shelf.

    Capped at +/- 0.6 m deliberately: 348 objects re-run ground_snap against
    this surface, and steeper relief tilts coral that was authored flat.
    """
    gate = smoothstep(CLEARING_RADIUS, CLEARING_RADIUS + 3.0, radius)
    return gate * (
        0.26 * math.sin(x * 0.29 + y * 0.19)
        + 0.19 * math.sin(x * 0.15 - y * 0.24)
        + 0.11 * math.cos((x + y) * 0.44)
    )


def ocean_floor_height(x, y):
    radius = math.hypot(x, y)
    if radius <= CLEARING_RADIUS:
        # The performer zone is mathematically flat. The stage, the torches and
        # every inner placement depend on this being exactly 0.
        return 0.0

    height = shelf_relief(x, y, radius)

    gate = north_gate(x, y)

    # Upstage wall: climbs past the water plane so it breaks the surface and
    # reads as a landmark rather than a backdrop.
    height += gate * smoothstep(WALL_RAMP_START, WALL_RAMP_END, radius) * WALL_CREST_Z

    # Abyss: everywhere the wall is not. Steep -- 45 m over 10 m of radius is a
    # reef drop-off, not a slope.
    angle = math.atan2(y, x)
    lip = lip_radius(angle)
    plunge = smoothstep(lip, lip + ABYSS_RAMP_METRES, radius) * ABYSS_DEPTH
    height -= (1.0 - gate) * plunge

    return height


def ocean_floor_uv(x, y):
    """World-planar mapping with a warp that breaks grid-repeat cadence.

    Same treatment as build-winter-environment.py's terrain_snow_uv. Without
    the warp the sand texture visibly tiles across the open shelf.
    """
    warped_x = x + 2.1 * math.sin(y * 0.061) + 1.1 * math.sin((x + y) * 0.041)
    warped_y = y + 1.9 * math.sin(x * 0.054) - 0.9 * math.sin((x - y) * 0.045)
    return (warped_x / TERRAIN_UV_METRES, warped_y / TERRAIN_UV_METRES)


def depth_darkening(z):
    """0 at shelf level, 1 in the deep, for the baked vertex-colour ramp.

    FogExp2 has no height term: it fades geometry toward one colour, so without
    this the drop face fogs BRIGHTER than the void behind it and the depth read
    inverts. This is the correction for that.
    """
    return 1.0 - smoothstep(DARKEN_FULL_Z, DARKEN_START_Z, z)
