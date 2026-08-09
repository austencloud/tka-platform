"""Slope, surface normal and substrate for the ocean floor.

Sits directly on ocean_terrain_profile.ocean_floor_height so there is exactly
one implementation of the world's shape. Substrate is DERIVED from that shape,
never painted: retuning the terrain moves the substrate with it, and the two
cannot disagree.

Pure math, no `bpy`.

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import math

from ocean_terrain_profile import (
    CLEARING_RADIUS,
    WATER_PLANE_Z,
    ocean_floor_height,
)

# Past this the ground is bare rock: it holds no sediment and the sand texture
# stretches visibly. Below it the shelf keeps its sand.
ROCK_SLOPE_DEGREES = 35.0
# How far above the local mean counts as raised reef rather than flat sand.
REEF_RELIEF_METRES = 0.12
# Radius the local mean is measured over. The shelf relief's wavelengths run
# 14-26 m, so a 3 m radius sampled almost the same phase as the centre: the
# mean tracked the value, the difference vanished, and only 12% of the shelf
# ever read as reef. 8 m lands near the opposite phase, which is what makes the
# comparison mean anything.
LOCAL_MEAN_RADIUS = 8.0
# Central-difference step. Matches the terrain mesh's finest spacing, so the
# gradient reflects the surface the mesh actually has.
GRADIENT_STEP = 0.5


def surface_gradient(x, y):
    """Return (dz/dx, dz/dy) by central difference."""
    h = GRADIENT_STEP
    dzdx = (ocean_floor_height(x + h, y) - ocean_floor_height(x - h, y)) / (2 * h)
    dzdy = (ocean_floor_height(x, y + h) - ocean_floor_height(x, y - h)) / (2 * h)
    return dzdx, dzdy


def surface_normal(x, y):
    """Unit normal, z positive."""
    dzdx, dzdy = surface_gradient(x, y)
    length = math.sqrt(dzdx * dzdx + dzdy * dzdy + 1.0)
    return (-dzdx / length, -dzdy / length, 1.0 / length)


def slope_degrees(x, y):
    dzdx, dzdy = surface_gradient(x, y)
    return math.degrees(math.atan(math.hypot(dzdx, dzdy)))


def local_mean_height(x, y, radius=LOCAL_MEAN_RADIUS):
    return (
        ocean_floor_height(x + radius, y)
        + ocean_floor_height(x - radius, y)
        + ocean_floor_height(x, y + radius)
        + ocean_floor_height(x, y - radius)
    ) / 4.0


def substrate(x, y):
    """One of "rock", "reef", "sand"."""
    if slope_degrees(x, y) > ROCK_SLOPE_DEGREES:
        return "rock"
    if math.hypot(x, y) <= CLEARING_RADIUS:
        # The performer clearing is mathematically flat and stays open sand.
        return "sand"
    if ocean_floor_height(x, y) > local_mean_height(x, y) + REEF_RELIEF_METRES:
        return "reef"
    return "sand"


def sample(x, y):
    """Everything the placement generator needs about one point of ground."""
    height = ocean_floor_height(x, y)
    return {
        "height": height,
        "normal": surface_normal(x, y),
        "slope": slope_degrees(x, y),
        "substrate": substrate(x, y),
        # Metres below the water plane. Ecology rules are written in depth
        # because that is how the biology is documented, not in world z.
        "depth": WATER_PLANE_Z - height,
    }
