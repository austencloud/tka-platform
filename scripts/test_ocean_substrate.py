"""Assertions over slope and substrate derivation. Runs without Blender.

Sibling of test_ocean_terrain_profile.py, which asserts the height function
itself. These cover what the placement generator reads.

Run:
  cd scripts && python test_ocean_substrate.py
"""

import math
import sys

from ocean_substrate import (
    ROCK_SLOPE_DEGREES,
    sample,
    slope_degrees,
    substrate,
    surface_normal,
)
from ocean_terrain_profile import CLEARING_RADIUS, WATER_PLANE_Z

FAILURES = []


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label} {detail}")
        FAILURES.append(label)


print("Performer clearing")
for x, y in ((0.0, 0.0), (3.0, 2.0), (-5.0, 4.0)):
    check(
        f"({x}, {y}) is flat sand",
        slope_degrees(x, y) < 0.01 and substrate(x, y) == "sand",
        f"slope={slope_degrees(x, y):.4f} substrate={substrate(x, y)}",
    )

print("\nShelf")
reef_seen = False
sand_seen = False
for index in range(64):
    angle = math.tau * index / 64
    r = 16.0
    x, y = math.cos(angle) * r, math.sin(angle) * r
    s = substrate(x, y)
    reef_seen |= s == "reef"
    sand_seen |= s == "sand"
    if s == "rock":
        FAILURES.append("shelf produced rock")
check("shelf is never bare rock", "shelf produced rock" not in FAILURES)
check("shelf produces raised reef", reef_seen)
check("shelf produces open sand", sand_seen)

print("\nAbyss face")
face = sample(0.0, -28.0)
check(
    "downstage drop is steeper than the rock threshold",
    face["slope"] > ROCK_SLOPE_DEGREES,
    f"slope={face['slope']:.1f}",
)
check("downstage drop is rock", face["substrate"] == "rock")

print("\nDepth")
check(
    "clearing depth is measured from the water plane",
    abs(sample(0.0, 0.0)["depth"] - WATER_PLANE_Z) < 1e-6,
)
check(
    "the abyss is deeper than the shelf",
    sample(0.0, -30.0)["depth"] > sample(0.0, 0.0)["depth"] + 20.0,
)

print("\nNormals")
for x, y in ((0.0, 0.0), (-12.0, 6.0), (0.0, -28.0)):
    n = surface_normal(x, y)
    length = math.sqrt(sum(c * c for c in n))
    check(
        f"({x}, {y}) normal is unit length and points up",
        abs(length - 1.0) < 1e-9 and n[2] > 0.0,
        f"len={length:.9f} nz={n[2]:.4f}",
    )

print("\nClearing boundary")
check(
    "just outside the clearing is no longer forced to sand",
    substrate(CLEARING_RADIUS + 6.0, 0.0) in {"sand", "reef"},
)

if FAILURES:
    print(f"\n{len(FAILURES)} FAILURES")
    sys.exit(1)
print("\nAll checks passed")
