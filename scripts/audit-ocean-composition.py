"""Audit the composed reef against the real seabed mesh.

The generator seats every asset with `z = ground - baseOffset * scale`, where
baseOffset comes from scripts/ocean-asset-facts.json. Checking that arithmetic
against the same height function that produced it proves nothing -- it is the
same number twice. This measures the OTHER way: real world-space geometry
(post-rotation, post-scale) raycast against the real Seabed mesh, which is what
the runtime actually renders.

Reports, per placement: the lowest world point of the object, the terrain
directly beneath it, and the gap. Positive gap = floating. Large negative =
buried. Also reports lean from vertical, because a tilt applied to geometry
whose silhouette is wrong is how a basalt column ends up lying over.

Run headless:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
    --background blender/ocean_composed.blend \
    --python scripts/audit-ocean-composition.py

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import collections
import json
import math
import os

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
COMPOSITION_PATH = os.path.join(HERE, "ocean-composition.json")

# A contact tolerance, not a style choice: the seabed mesh is a 128x192 polar
# grid, so between vertices the true surface sits a few centimetres off the
# analytic height the generator sampled. Anything inside this reads as seated.
CONTACT_TOLERANCE = 0.06
# How far above the object's own low point to start the downward ray. Must clear
# the object's full height for the steepest lean.
RAY_START_ABOVE = 40.0


def world_bounds(obj):
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for corner in obj.bound_box:
        point = obj.matrix_world @ Vector(corner)
        for axis in range(3):
            lo[axis] = min(lo[axis], point[axis])
            hi[axis] = max(hi[axis], point[axis])
    return lo, hi


def terrain_height(seabed, x, y, above):
    """World z of the seabed under (x, y), or None if the ray misses."""
    inv = seabed.matrix_world.inverted()
    origin = inv @ Vector((x, y, above))
    # Direction is a vector, so it takes the linear part only.
    direction = inv.to_3x3() @ Vector((0.0, 0.0, -1.0))
    hit, location, _normal, _index = seabed.ray_cast(origin, direction.normalized())
    if not hit:
        return None
    return (seabed.matrix_world @ location).z


def lean_degrees(obj):
    """Angle between the object's own +Z and world +Z, in degrees."""
    up = (obj.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    return math.degrees(math.acos(max(-1.0, min(1.0, up.z))))


def main():
    with open(COMPOSITION_PATH, "r", encoding="utf-8") as handle:
        placements = json.load(handle)["placements"]

    seabed = bpy.data.objects.get("Seabed")
    if seabed is None:
        raise SystemExit("No Seabed object in this blend")

    composed = bpy.data.collections.get("ComposedReef")
    if composed is None:
        raise SystemExit("No ComposedReef collection. Run build-ocean-composition.py.")

    by_name = {obj.name: obj for obj in composed.objects}
    rows = []
    missed = 0

    for index, placement in enumerate(placements):
        name = f"Composed_{placement['silhouette']}_{index:03d}"
        obj = by_name.get(name)
        if obj is None:
            continue

        lo, hi = world_bounds(obj)
        centre_x = (lo.x + hi.x) / 2.0
        centre_y = (lo.y + hi.y) / 2.0
        ground = terrain_height(seabed, centre_x, centre_y, hi.z + RAY_START_ABOVE)
        if ground is None:
            missed += 1
            continue

        rows.append(
            {
                "asset": placement["asset"],
                "silhouette": placement["silhouette"],
                "zone": placement["zone"],
                "size": placement["sizeMetres"],
                "worldSize": [round(hi[a] - lo[a], 3) for a in range(3)],
                "lowZ": lo.z,
                "ground": ground,
                "gap": lo.z - ground,
                "lean": lean_degrees(obj),
                "pos": [round(centre_x, 2), round(centre_y, 2)],
            }
        )

    floating = [r for r in rows if r["gap"] > CONTACT_TOLERANCE]
    buried = [r for r in rows if r["gap"] < -CONTACT_TOLERANCE]

    print(f"\nAudited {len(rows)} placements ({missed} off the terrain mesh)")
    print(
        f"  seated {len(rows) - len(floating) - len(buried)}"
        f"  floating {len(floating)}  buried {len(buried)}"
    )

    def summarise(title, subset, key):
        if not subset:
            return
        print(f"\n{title} ({len(subset)}):")
        per_asset = collections.defaultdict(list)
        for row in subset:
            per_asset[row["asset"]].append(row[key])
        print(f"  {'asset':38} {'n':>4} {'worst':>8} {'median':>8}")
        for asset in sorted(per_asset, key=lambda a: -max(abs(v) for v in per_asset[a])):
            values = sorted(per_asset[asset], key=abs)
            worst = values[-1]
            median = values[len(values) // 2]
            print(f"  {asset:38} {len(values):>4} {worst:>8.3f} {median:>8.3f}")

    summarise("FLOATING above the seabed, metres", floating, "gap")
    summarise("BURIED below the seabed, metres", buried, "gap")

    leaning = [r for r in rows if r["lean"] > 12.0]
    if leaning:
        print(f"\nLeaning more than 12 degrees from vertical ({len(leaning)}):")
        per_asset = collections.Counter(r["asset"] for r in leaning)
        for asset, count in per_asset.most_common(12):
            worst = max(r["lean"] for r in leaning if r["asset"] == asset)
            print(f"  {asset:38} {count:>4}  worst {worst:5.1f} deg")

    print("\nLargest objects by measured world extent:")
    for row in sorted(rows, key=lambda r: -max(r["worldSize"]))[:12]:
        print(
            f"  {row['asset']:34} {row['worldSize']}  authored {row['size']:5.2f} m"
            f"  lean {row['lean']:4.1f} gap {row['gap']:+6.2f}  {row['zone']}"
        )


if __name__ == "__main__":
    main()
