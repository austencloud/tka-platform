"""Assertions over the ocean terrain profile. Runs without Blender.

Every number here traces to
docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md.
Heights are Blender Z: seabed top is 0, the water plane is +12.

Run:
  cd scripts && python test_ocean_terrain_profile.py
"""

import math
import sys

from ocean_terrain_profile import (
    ABYSS_DEPTH,
    CLEARING_RADIUS,
    SHELF_OUTER_RADIUS,
    WATER_PLANE_Z,
    WORLD_RADIUS,
    depth_darkening,
    lip_radius,
    ocean_floor_height,
)

FAILURES = []


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label} {detail}")
        FAILURES.append(label)


def sample_ring(radius, count=64):
    """Yield (x, y, height) evenly around a ring."""
    for index in range(count):
        angle = math.tau * index / count
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius
        yield x, y, ocean_floor_height(x, y)


print("clearing is mathematically flat")
flat = [h for r in (0.0, 2.0, 5.0, 7.9) for _, _, h in sample_ring(r)]
check(
    "every sample inside the clearing is exactly 0.0",
    all(h == 0.0 for h in flat),
    f"max abs deviation {max(abs(h) for h in flat)}",
)

print("shelf relief stays inside the ground-snap tolerance")
# 348 objects re-snap onto this. Relief steeper than the tolerance tilts coral
# that was authored on a flat plate.
shelf = [h for r in (9.0, 12.0, 16.0, 20.0) for _, _, h in sample_ring(r)]
check(
    "shelf relief within +/- 0.6 m out to r=20",
    all(abs(h) <= 0.6 for h in shelf),
    f"max abs {max(abs(h) for h in shelf):.3f}",
)
# At the outer rim the wall has begun to climb on the north side. That is
# correct -- the wall has to meet the shelf somewhere -- but it must stay gentle
# enough that the outermost placements do not end up on a slope.
rim_north = ocean_floor_height(0.0, 24.0)
check(
    "north rim rise at the lip stays under 1.5 m",
    rim_north < 1.5,
    f"{rim_north:.2f} m",
)

print("the upstage wall crests above the water plane")
north = [ocean_floor_height(0.0, r) for r in (32.0, 34.0, 36.0, 38.0)]
check(
    "due north crests above the water plane",
    max(north) > WATER_PLANE_Z,
    f"max {max(north):.2f} vs water {WATER_PLANE_Z}",
)

print("the wall is directional, not a ring")
south_far = [ocean_floor_height(0.0, -r) for r in (32.0, 34.0, 36.0, 38.0)]
check(
    "due south at the same radii is far below the water plane",
    max(south_far) < 0.0,
    f"max {max(south_far):.2f}",
)
check(
    "north and south differ by more than the abyss depth",
    max(north) - max(south_far) > ABYSS_DEPTH,
    f"delta {max(north) - max(south_far):.2f}",
)

print("the shelf lip is irregular, never a circle")
lips = [lip_radius(math.tau * i / 64) for i in range(64)]
check(
    "lip radius varies by at least 3 m across directions",
    max(lips) - min(lips) >= 3.0,
    f"min {min(lips):.2f} max {max(lips):.2f}",
)
check(
    "lip radius stays within +/- 3 m of the nominal shelf outer radius",
    all(abs(r - SHELF_OUTER_RADIUS) <= 3.0 for r in lips),
)

print("the abyss actually plunges")
south_deep = [ocean_floor_height(0.0, -r) for r in (40.0, 60.0, 90.0)]
# Tolerance of 1 m: shelf_relief still contributes up to +0.56 m in the abyss,
# so an exact -ABYSS_DEPTH assertion would be flaky by design.
check(
    "south floor reaches the authored abyss depth within 1 m",
    min(south_deep) <= -(ABYSS_DEPTH - 1.0),
    f"min {min(south_deep):.2f} vs -{ABYSS_DEPTH}",
)

print("height is continuous -- no cliffs the mesh cannot represent")
worst_step = 0.0
worst_at = None
for angle_index in range(48):
    angle = math.tau * angle_index / 48
    previous = None
    radius = 0.0
    while radius <= WORLD_RADIUS:
        x, y = math.cos(angle) * radius, math.sin(angle) * radius
        height = ocean_floor_height(x, y)
        if previous is not None and abs(height - previous) > worst_step:
            worst_step = abs(height - previous)
            worst_at = (round(radius, 1), round(math.degrees(angle)))
        previous = height
        radius += 0.5
check(
    "no 0.5 m radial step changes height by more than 8 m",
    worst_step <= 8.0,
    f"worst {worst_step:.2f} m at radius/bearing {worst_at}",
)

print("depth darkening ramps the right way")
check("shelf height is undarkened", depth_darkening(0.0) == 0.0)
check("deep abyss is fully darkened", depth_darkening(-ABYSS_DEPTH) == 1.0)
check(
    "darkening is monotonic downward",
    all(
        depth_darkening(-z) <= depth_darkening(-z - 1.0)
        for z in range(0, int(ABYSS_DEPTH))
    ),
)

print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED: {', '.join(FAILURES)}")
    sys.exit(1)
print("all ocean terrain profile checks passed")
