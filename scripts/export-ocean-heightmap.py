"""Bake the ocean floor height function to a grid the JS generator can sample.

The placement generator needs elevation, slope and substrate at arbitrary
(x, y). Porting ocean_floor_height to JavaScript would create a second
implementation of the world's shape, and the first time the shelf is retuned
the two would disagree -- silently, by floating or burying every object.

So Python stays the only place the height function is written, and exports a
grid. The JS sampler bilinearly interpolates it.

No `bpy`: this is pure math and runs without Blender.

Run:
  python scripts/export-ocean-heightmap.py

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import json
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocean_terrain_profile import (  # noqa: E402
    ABYSS_DEPTH,
    CLEARING_RADIUS,
    SHELF_OUTER_RADIUS,
    WALL_CREST_Z,
    WALL_RAMP_END,
    WALL_RAMP_START,
    WATER_PLANE_Z,
    WORLD_RADIUS,
    ocean_floor_height,
)

# 256 samples across 220 m is ~0.86 m spacing. The shelf relief's shortest
# wavelength is ~14 m (the 0.44 rad/m cosine term), so this is ~16 samples per
# wavelength -- far above Nyquist for the shape the generator cares about. The
# abyss wall is steeper than the grid can express, which is fine: nothing is
# placed past the lip.
RESOLUTION = 256

OUTPUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "ocean-terrain-heightmap.json"
)

# Recorded so the JS sampler can refuse to run against a stale bake. These are
# every constant that changes the shape of the world.
PROFILE_CONSTANTS = {
    "CLEARING_RADIUS": CLEARING_RADIUS,
    "SHELF_OUTER_RADIUS": SHELF_OUTER_RADIUS,
    "WATER_PLANE_Z": WATER_PLANE_Z,
    "WALL_CREST_Z": WALL_CREST_Z,
    "WALL_RAMP_START": WALL_RAMP_START,
    "WALL_RAMP_END": WALL_RAMP_END,
    "ABYSS_DEPTH": ABYSS_DEPTH,
    "WORLD_RADIUS": WORLD_RADIUS,
}


def main():
    step = (2.0 * WORLD_RADIUS) / (RESOLUTION - 1)
    heights = []
    for row in range(RESOLUTION):
        y = -WORLD_RADIUS + row * step
        for column in range(RESOLUTION):
            x = -WORLD_RADIUS + column * step
            heights.append(round(ocean_floor_height(x, y), 4))

    payload = {
        "resolution": RESOLUTION,
        "extent": WORLD_RADIUS,
        "step": step,
        "profile": PROFILE_CONSTANTS,
        # Row-major, row index over y, column index over x, both from -extent.
        "heights": heights,
    }

    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"))
        handle.write("\n")

    lo = min(heights)
    hi = max(heights)
    print(f"Wrote {OUTPUT}")
    print(f"  {RESOLUTION}x{RESOLUTION} over +/-{WORLD_RADIUS} m, step {step:.4f} m")
    print(f"  height range {lo:.3f} .. {hi:.3f}")


if __name__ == "__main__":
    main()
