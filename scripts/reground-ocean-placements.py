"""Re-ground every ocean placement onto the sculpted terrain.

Why this exists as a separate pass: ocean_zone_pass3.py's `ground_snap` snaps
to an ABSOLUTE z of -0.15. That was correct when the seabed was a flat plate at
z = 0. It is wrong now — it leaves objects at the old plate level while the
terrain beneath them may be 45 m lower, which is exactly the failure this pass
corrects (46 of 320 objects, gaps up to 44.7 m).

Two steps per object:
  1. Pull anything past the shelf lip back inside it. Reef content belongs on
     the shelf; the abyss is meant to be empty, which is what makes it read as
     depth rather than as a floor.
  2. Snap so the object's lowest point sits just under the terrain surface at
     its own x/y.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/reground-ocean-placements.py -- --save

Design: docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md
"""

import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocean_terrain_profile import (  # noqa: E402
    CLEARING_RADIUS,
    lip_radius,
    ocean_floor_height,
)

BURY_DEPTH = 0.15
# Keep content a little inside the lip so nothing overhangs the drop.
LIP_MARGIN = 1.5
SKIP_PREFIXES = ("Dais", "Torch", "src_", "Ocean_WallDressing_")
SKIP_NAMES = {"Seabed"}


def should_skip(obj):
    if obj.type != "MESH":
        return True
    if obj.name in SKIP_NAMES:
        return True
    if obj.name.startswith(SKIP_PREFIXES):
        return True
    if obj.name.endswith("_template"):
        return True
    if obj.parent is not None:
        # Parented objects follow their parent; moving them independently
        # double-applies the offset.
        return True
    return not obj.data.vertices


def lowest_world_z(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return min(c.z for c in corners)


def main():
    pulled_in = 0
    resnapped = 0
    worst_before = 0.0

    targets = [o for o in bpy.data.objects if not should_skip(o)]
    print(f"REGROUND considering {len(targets)} objects")

    for obj in targets:
        x, y = obj.location.x, obj.location.y
        radius = math.hypot(x, y)

        # 1. Pull back inside the shelf lip.
        if radius > CLEARING_RADIUS:
            limit = lip_radius(math.atan2(y, x)) - LIP_MARGIN
            if radius > limit:
                scale = limit / radius
                obj.location.x = x * scale
                obj.location.y = y * scale
                x, y = obj.location.x, obj.location.y
                pulled_in += 1

        # 2. Snap onto the terrain at the object's own x/y.
        bpy.context.view_layer.update()
        ground = ocean_floor_height(x, y)
        gap = lowest_world_z(obj) - ground
        worst_before = max(worst_before, abs(gap))
        obj.location.z += (ground - BURY_DEPTH) - lowest_world_z(obj)
        resnapped += 1

    bpy.context.view_layer.update()

    # Verify in the same run rather than trusting the arithmetic.
    worst_after = 0.0
    offenders = []
    for obj in targets:
        gap = lowest_world_z(obj) - ocean_floor_height(
            obj.location.x, obj.location.y
        )
        if abs(gap + BURY_DEPTH) > 0.35:
            offenders.append((obj.name, round(gap, 2)))
        worst_after = max(worst_after, abs(gap + BURY_DEPTH))

    print(
        f"REGROUND pulled_in={pulled_in} resnapped={resnapped} "
        f"worst_gap_before={worst_before:.2f} worst_residual_after={worst_after:.2f}"
    )
    for name, gap in sorted(offenders, key=lambda p: -abs(p[1]))[:15]:
        print(f"   RESIDUAL {name} gap={gap}")
    print(f"REGROUND_OFFENDERS {len(offenders)}")

    if "--save" in sys.argv:
        bpy.ops.wm.save_mainfile()
        print("REGROUND_SAVED")


main()
