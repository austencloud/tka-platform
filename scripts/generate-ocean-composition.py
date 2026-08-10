"""Compose the ocean reef from the asset facts index and the ecology rules.

Replaces the hardcoded per-bucket scale ranges in
generate-ocean-placements.cjs, which invented world size by bucket after the
runtime had already discarded each model's real scale:

    lerp(0.6, 2.5, rng())   # "meters -- prominent reef rocks"
    lerp(1.5, 4.0, rng())   # "large reef formations"

Here size comes from scripts/ocean-asset-facts.json, which carries researched
species scale, and placement is filtered by scripts/ocean-ecology-rules.json
against the terrain's own substrate, slope and depth.

Zones still own staging and sightlines. This is a theatre with a proscenium
arch and a dais; the rules only decide what is plausible inside a zone.

Pure math, no `bpy` -- run it headless, review the JSON, then instantiate with
scripts/build-ocean-composition.py.

Run:
  python scripts/generate-ocean-composition.py

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import json
import math
import os
import random
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ocean_substrate import ROCK_SLOPE_DEGREES, sample  # noqa: E402
from ocean_terrain_profile import lip_radius  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FACTS_PATH = os.path.join(HERE, "ocean-asset-facts.json")
RULES_PATH = os.path.join(HERE, "ocean-ecology-rules.json")
ZONES_PATH = os.path.join(HERE, "ocean-zone-layout.json")
OUTPUT_PATH = os.path.join(HERE, "ocean-composition.json")

# Instances per square metre of zone area, before densityScale. Tuned so the
# nine zones land near the layout's minimumInstances floor of 160 without any
# zone becoming a carpet.
INSTANCES_PER_SQM = 0.36
# Rejection sampling gives up rather than looping forever when a zone's rules
# admit almost nothing -- that is a signal the rules are wrong, and the summary
# reports it instead of hiding it.
MAX_ATTEMPTS_PER_INSTANCE = 40
# Keep content inside the shelf lip. The abyss reads as depth only while empty.
LIP_MARGIN = 1.5
# The default hero camera sits downstage on +z (runtime frame), so "toward the
# audience" is -y in Blender's frame.
CAMERA_DIRECTION_DEGREES = -90.0
# Blades align to a nominal current running across the stage.
CURRENT_DEGREES = 20.0
# The default hero camera looks upstage at the dais from about 19 m downstage.
# Anything tall inside this corridor stands between the audience and the
# performer, which is the one thing a staged reef may never do. Outside the
# corridor tall objects are welcome -- there they frame instead of block.
SIGHTLINE_HALF_WIDTH = 8.0
# Floor scatter: low life everywhere the zones do not reach. Nothing taller than
# a knee, so it can cross the camera corridor without hiding the performer.
FLOOR_SCATTER_SILHOUETTES = ("shell", "plate", "blade")
FLOOR_SCATTER_MAX_HEIGHT = 0.9
FLOOR_SCATTER_PER_SQM = 0.06


def validate_rules(rules):
    """Reject rules that can never be satisfied.

    Substrate "rock" is DERIVED from slope above ROCK_SLOPE_DEGREES, so a class
    admitting only rock while capping slope below that threshold is impossible
    -- and impossible reads exactly like "the generator ignored my zone". The
    column class shipped that way and placed zero pinnacles until this caught it.
    """
    problems = []
    for name, rule in rules.items():
        if name.startswith("_") or not isinstance(rule, dict) or "substrate" not in rule:
            continue
        substrates = set(rule["substrate"])
        if substrates == {"rock"} and rule["slopeRange"][1] <= ROCK_SLOPE_DEGREES:
            problems.append(
                f"{name}: substrate is rock-only but slopeRange caps at "
                f"{rule['slopeRange'][1]}, and rock requires slope above "
                f"{ROCK_SLOPE_DEGREES}. Nothing can ever place."
            )
        if rule["depthBand"][0] >= rule["depthBand"][1]:
            problems.append(f"{name}: empty depthBand {rule['depthBand']}")
        if rule["clumpSize"][0] > rule["clumpSize"][1]:
            problems.append(f"{name}: inverted clumpSize {rule['clumpSize']}")
    if problems:
        raise SystemExit("Unsatisfiable ecology rules:\n  " + "\n  ".join(problems))


def load(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def normalise(name):
    """Collapse the three naming conventions the zone layout mixes.

    Zones name heroes as "meshy-sunlit-coral-arch", "photorealistic_coral_3"
    and "rock_2" interchangeably. All three must resolve to one facts row.
    """
    return name.lower().replace("-", "").replace("_", "").replace("/", "")


def build_resolver(facts):
    index = {}
    for asset_id in facts:
        if asset_id.startswith("_"):
            continue
        index.setdefault(normalise(asset_id), asset_id)
        index.setdefault(normalise(asset_id.split("/")[-1]), asset_id)
    return index


def canonical(facts, asset_id):
    """Follow an alias to the asset it re-exports."""
    row = facts[asset_id]
    return facts[row["aliasOf"]] if row.get("aliasOf") else row


def is_clear(occupied, x, y, row, size, rule):
    """Two spacing tests, because they answer different questions.

    Physical footprints may never overlap -- that is geometry interpenetrating,
    and it is wrong between any two objects. companionSpacing is a much wider
    breathing radius and applies only WITHIN a silhouette class: a brain coral
    wants two metres of clear sand from the next brain coral, but a starfish
    sitting beside it is exactly what a reef looks like.

    Enforcing companionSpacing against everything put one arch in the arch zone
    and rejected 959 candidates behind it.
    """
    # footprintRadius and baseOffset are normalised against max extent, so they
    # scale with the SCALE FACTOR, not with the authored metre size.
    physical = row["footprintRadius"] * scale_for_size(row, size)
    companion = physical * rule["companionSpacing"]
    for ox, oy, o_physical, o_companion, o_silhouette in occupied:
        distance = math.hypot(x - ox, y - oy)
        if distance < physical + o_physical:
            return False
        if o_silhouette == row["silhouette"] and distance < companion + o_companion:
            return False
    return True


def occupancy(x, y, row, size, rule):
    # footprintRadius and baseOffset are normalised against max extent, so they
    # scale with the SCALE FACTOR, not with the authored metre size.
    physical = row["footprintRadius"] * scale_for_size(row, size)
    return (x, y, physical, physical * rule["companionSpacing"], row["silhouette"])


AXIS_INDEX = {"x": 0, "y": 1, "z": 2}


def measured_extent_for_axis(row):
    """Normalised extent of the axis the authored size actually refers to.

    Geometry is normalised to 1-unit MAX extent at import, so a scale factor
    sets the longest axis. But "giant kelp is 10 m tall" names its height, and
    for a kelp sheet whose longest axis is horizontal those are not the same
    number. Scaling by height directly produced an 11 m wide slab where a frond
    belonged -- visible immediately in a render, invisible in the JSON.
    """
    up = AXIS_INDEX[row["upAxis"]]
    horizontal = [a for a in (0, 1, 2) if a != up]
    axis = row["sizeMetres"]["axis"]
    extent = (
        row["size"][up]
        if axis == "height"
        else max(row["size"][horizontal[0]], row["size"][horizontal[1]])
    )
    return extent / row["maxExtent"]


def scale_for_size(row, metres):
    """Convert an authored metre size along its own axis into a scale factor."""
    extent = measured_extent_for_axis(row)
    return metres / extent if extent > 1e-6 else metres


def contradicts_silhouette(row):
    """Reject geometry that cannot be what the index says it is.

    A blade or a column is by definition taller than it is wide. When the
    measured mesh says otherwise the asset is mis-exported -- lying down, or
    with the wrong up axis -- and no scale factor rescues it.
    """
    up = AXIS_INDEX[row["upAxis"]]
    horizontal = [a for a in (0, 1, 2) if a != up]
    footprint = max(row["size"][horizontal[0]], row["size"][horizontal[1]])
    if footprint < 1e-6:
        return None
    aspect = row["size"][up] / footprint
    # A column must actually be taller than it is wide -- that is the whole
    # silhouette. A blade need not be: a turtle-grass patch spreads wider than
    # it stands, and that is correct. What a blade may not be is a flat sheet.
    minimum = 1.0 if row["silhouette"] == "column" else 0.5
    if row["silhouette"] in {"blade", "column"} and aspect < minimum:
        return (
            f"{row['silhouette']} aspect {aspect:.2f} is below {minimum:.1f} "
            f"(up {row['size'][up]:.3f} vs footprint {footprint:.3f})"
        )
    return None


def zone_area(zone):
    return math.pi * zone["radii"][0] * zone["radii"][1]


def sample_in_zone(zone, rng):
    """Uniform point inside the zone ellipse, in runtime (x, z) metres."""
    angle = rng.random() * math.tau
    radius = math.sqrt(rng.random())
    ex = math.cos(angle) * radius * zone["radii"][0]
    ez = math.sin(angle) * radius * zone["radii"][1]
    theta = math.radians(zone.get("rotationDegrees", 0.0))
    rx = ex * math.cos(theta) - ez * math.sin(theta)
    rz = ex * math.sin(theta) + ez * math.cos(theta)
    return zone["center"][0] + rx, zone["center"][1] + rz


def runtime_to_blender(x, z):
    """Runtime -Z is upstage; Blender +Y is upstage."""
    return x, -z


def within_lip(bx, by):
    radius = math.hypot(bx, by)
    return radius <= lip_radius(math.atan2(by, bx)) - LIP_MARGIN


def yaw_for(policy, facing_degrees, bx, by, rng):
    """Radians about Blender +Z."""
    jitter = math.radians(rng.uniform(-25.0, 25.0))
    if policy == "face-camera-biased":
        # Rotate the asset's own interesting face toward the audience, then
        # jitter. Without this an arch is a wall seen edge-on.
        target = math.radians(CAMERA_DIRECTION_DEGREES - facing_degrees)
        return target + jitter * 0.5
    if policy == "face-current":
        return math.radians(CURRENT_DEGREES) + jitter * 0.6
    return rng.random() * math.tau


def tilt_quaternion(normal, jitter_degrees, rng):
    """Align +Z to the substrate normal, then jitter.

    Returned as (w, x, y, z) so the instantiation script can hand it straight
    to Blender's quaternion rotation mode.
    """
    nx, ny, nz = normal
    # Rotation taking +Z onto the normal is about the axis Z x N.
    axis_x, axis_y = -ny, nx
    axis_len = math.hypot(axis_x, axis_y)
    angle = math.acos(max(-1.0, min(1.0, nz)))
    angle += math.radians(rng.uniform(-jitter_degrees, jitter_degrees))
    if axis_len < 1e-9:
        # Flat ground: tilt in an arbitrary direction so jitter still reads.
        phi = rng.random() * math.tau
        axis_x, axis_y, axis_len = math.cos(phi), math.sin(phi), 1.0
    ax, ay = axis_x / axis_len, axis_y / axis_len
    half = angle / 2.0
    s = math.sin(half)
    return (math.cos(half), ax * s, ay * s, 0.0)


def compose_quaternions(a, b):
    """a * b, both (w, x, y, z)."""
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (
        aw * bw - ax * bx - ay * by - az * bz,
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
    )


def yaw_quaternion(yaw):
    half = yaw / 2.0
    return (math.cos(half), 0.0, 0.0, math.sin(half))


def main():
    facts = load(FACTS_PATH)
    rules = load(RULES_PATH)
    layout = load(ZONES_PATH)
    validate_rules(rules)
    resolver = build_resolver(facts)
    role_admits = rules["roleAdmits"]
    placement_rules = layout["placementRules"]
    stage_exclusion = placement_rules["stageExclusionRadiusMetres"]
    foreground_max_height = placement_rules["foregroundMaxHeightMetres"]
    outer_boundary = placement_rules["outerBoundaryMetres"]

    # Asset pool keyed by silhouette, aliases excluded so a zone asking for
    # three different rocks stops getting the same rock three times.
    by_silhouette = {}
    excluded = []
    for asset_id, row in facts.items():
        if asset_id.startswith("_") or row.get("aliasOf"):
            continue
        if row.get("broken"):
            excluded.append(f"{asset_id}: {row['broken']}")
            continue
        if abs(row["baseOffset"]) > 1.5:
            # Broken origin: seating it would bury it dozens of sizes deep.
            excluded.append(f"{asset_id}: origin {row['baseOffset']} max extents from geometry")
            continue
        contradiction = contradicts_silhouette(row)
        if contradiction:
            excluded.append(f"{asset_id}: {contradiction}")
            continue
        by_silhouette.setdefault(row["silhouette"], []).append(asset_id)

    placements = []
    occupied = []  # (bx, by, radius) for spacing rejection
    summary = []
    unresolved_heroes = []

    for zone in layout["zones"]:
        rng = random.Random(zone["seed"])
        admitted = role_admits.get(zone["role"], [])
        pool = []

        # Heroes first and always: a zone names them because the composition
        # depends on them, not because they were convenient.
        for hero in zone.get("heroObjects", []):
            asset_id = resolver.get(normalise(hero))
            if asset_id is None:
                unresolved_heroes.append(f"{zone['id']}: {hero}")
                continue
            row = facts[asset_id]
            target = row["aliasOf"] if row.get("aliasOf") else asset_id
            pool.append(target)

        for silhouette in admitted:
            pool.extend(by_silhouette.get(silhouette, []))

        pool = list(dict.fromkeys(pool))
        if not pool:
            summary.append((zone["id"], 0, 0, "no admitted assets"))
            continue

        budget = max(1, round(zone_area(zone) * zone["densityScale"] * INSTANCES_PER_SQM))
        placed = 0
        rejected = 0
        attempts = 0
        limit = budget * MAX_ATTEMPTS_PER_INSTANCE

        # Heroes are placed first and each gets its own attempt budget. Drawing
        # them uniformly from the pool meant the arch zone's arch simply never
        # came up against nineteen boulders and eighteen kelp.
        hero_queue = [a for a in pool[: len(zone.get("heroObjects", []))]]
        hero_attempts = 0
        unplaced_heroes = []

        while placed < budget and attempts < limit:
            attempts += 1
            if hero_queue:
                asset_id = hero_queue[0]
                hero_attempts += 1
                if hero_attempts > MAX_ATTEMPTS_PER_INSTANCE * 4:
                    unplaced_heroes.append(hero_queue.pop(0))
                    hero_attempts = 0
                    continue
            else:
                asset_id = rng.choice(pool)
            row = canonical(facts, asset_id)
            rule = rules[row["silhouette"]]

            x, z = sample_in_zone(zone, rng)
            bx, by = runtime_to_blender(x, z)

            if math.hypot(bx, by) < stage_exclusion:
                rejected += 1
                continue
            if math.hypot(bx, by) > outer_boundary or not within_lip(bx, by):
                rejected += 1
                continue

            ground = sample(bx, by)
            if rule["substrate"] != ["any"] and ground["substrate"] not in rule["substrate"]:
                rejected += 1
                continue
            if not rule["slopeRange"][0] <= ground["slope"] <= rule["slopeRange"][1]:
                rejected += 1
                continue
            if not rule["depthBand"][0] <= ground["depth"] <= rule["depthBand"][1]:
                rejected += 1
                continue

            size = rng.uniform(row["sizeMetres"]["min"], row["sizeMetres"]["max"])
            # Downstage of the dais and inside the camera corridor, height is
            # capped for every zone -- not only the fringe. Blade assets were
            # putting 9 m kelp two metres in front of the stage, which reads as
            # a curtain drawn across the performer.
            in_corridor = by < -1.0 and abs(bx) < SIGHTLINE_HALF_WIDTH
            if (in_corridor or zone["role"] == "foreground-silhouette") and (
                size > foreground_max_height
            ):
                rejected += 1
                continue

            if not is_clear(occupied, bx, by, row, size, rule):
                rejected += 1
                continue

            # Clumping and colonial species place a seed then scatter siblings,
            # because a lone staghorn is the tell that a reef was placed by a
            # random walk rather than grown.
            placed_before = placed
            clump = rng.randint(*rule["clumpSize"])
            for member in range(clump):
                if placed >= budget:
                    break
                if member == 0:
                    mx, my = bx, by
                else:
                    spread = row["footprintRadius"] * scale_for_size(row, size)
                    spread *= rule["companionSpacing"]
                    spread *= rng.uniform(1.0, 2.4)
                    phi = rng.random() * math.tau
                    mx, my = bx + math.cos(phi) * spread, by + math.sin(phi) * spread
                    if math.hypot(mx, my) < stage_exclusion or not within_lip(mx, my):
                        continue
                    ground = sample(mx, my)
                    if (
                        rule["substrate"] != ["any"]
                        and ground["substrate"] not in rule["substrate"]
                    ):
                        continue
                    size = rng.uniform(row["sizeMetres"]["min"], row["sizeMetres"]["max"])
                    if my < -1.0 and abs(mx) < SIGHTLINE_HALF_WIDTH and size > foreground_max_height:
                        continue
                    if not is_clear(occupied, mx, my, row, size, rule):
                        continue

                ground = sample(mx, my)
                # baseOffset is normalised against max extent, so multiplying by
                # the chosen metre size seats the asset's lowest point on the
                # ground regardless of how large it was drawn.
                z_world = ground["height"] - row["baseOffset"] * scale_for_size(row, size)
                if row["silhouette"] == "swimmer":
                    # Pelagic: hovers rather than sits.
                    z_world = ground["height"] + rng.uniform(1.2, 4.0)

                rotation = compose_quaternions(
                    tilt_quaternion(ground["normal"], rule["tiltJitter"], rng),
                    yaw_quaternion(yaw_for(rule["yawPolicy"], row["facing"], mx, my, rng)),
                )

                placements.append(
                    {
                        "asset": asset_id,
                        "path": row["path"],
                        "silhouette": row["silhouette"],
                        "species": row["species"],
                        "zone": zone["id"],
                        "substrate": ground["substrate"],
                        "sizeMetres": round(size, 3),
                        # Geometry is normalised to 1-unit MAX extent at import,
                        # so the scale factor sets the longest axis -- which is
                        # only the authored size when that axis is the one the
                        # size names.
                        "scale": round(scale_for_size(row, size), 4),
                        "position": [round(mx, 4), round(my, 4), round(z_world, 4)],
                        "rotation": [round(c, 8) for c in rotation],
                    }
                )
                occupied.append(occupancy(mx, my, row, size, rule))
                placed += 1

            if hero_queue and placed > placed_before and asset_id == hero_queue[0]:
                hero_queue.pop(0)
                hero_attempts = 0

        note = ""
        if not placed:
            note = "nothing admitted"
        elif unplaced_heroes or hero_queue:
            note = "unplaced heroes: " + ", ".join(unplaced_heroes + hero_queue)
        summary.append((zone["id"], placed, rejected, note))

    # Floor scatter. The zones cover roughly 730 of the world's 1400 usable
    # square metres, and the first render showed the rest as bald sand: the
    # reef read as set pieces standing on a parking lot. Real seabed carries
    # low life everywhere between the features, so this pass dresses the whole
    # annulus with nothing tall enough to compete with a zone or block a view.
    scatter_rng = random.Random(layout.get("scatterSeed", 90210))
    scatter_pool = [
        asset_id
        for silhouette in FLOOR_SCATTER_SILHOUETTES
        for asset_id in by_silhouette.get(silhouette, [])
        if facts[asset_id]["sizeMetres"]["min"] <= FLOOR_SCATTER_MAX_HEIGHT
    ]
    scatter_budget = round(
        math.pi * (outer_boundary**2 - stage_exclusion**2) * FLOOR_SCATTER_PER_SQM
    )
    scattered = 0
    scatter_attempts = 0
    while scatter_pool and scattered < scatter_budget and scatter_attempts < scatter_budget * MAX_ATTEMPTS_PER_INSTANCE:
        scatter_attempts += 1
        asset_id = scatter_rng.choice(scatter_pool)
        row = canonical(facts, asset_id)
        rule = rules[row["silhouette"]]

        angle = scatter_rng.random() * math.tau
        radius = math.sqrt(scatter_rng.uniform(0.0, 1.0)) * outer_boundary
        bx, by = math.cos(angle) * radius, math.sin(angle) * radius
        if radius < stage_exclusion or not within_lip(bx, by):
            continue

        ground = sample(bx, by)
        if rule["substrate"] != ["any"] and ground["substrate"] not in rule["substrate"]:
            continue
        if not rule["slopeRange"][0] <= ground["slope"] <= rule["slopeRange"][1]:
            continue

        ceiling = min(row["sizeMetres"]["max"], FLOOR_SCATTER_MAX_HEIGHT)
        size = scatter_rng.uniform(row["sizeMetres"]["min"], ceiling)
        if not is_clear(occupied, bx, by, row, size, rule):
            continue

        rotation = compose_quaternions(
            tilt_quaternion(ground["normal"], rule["tiltJitter"], scatter_rng),
            yaw_quaternion(yaw_for(rule["yawPolicy"], row["facing"], bx, by, scatter_rng)),
        )
        placements.append(
            {
                "asset": asset_id,
                "path": row["path"],
                "silhouette": row["silhouette"],
                "species": row["species"],
                "zone": "floor-scatter",
                "substrate": ground["substrate"],
                "sizeMetres": round(size, 3),
                "scale": round(scale_for_size(row, size), 4),
                "position": [
                    round(bx, 4),
                    round(by, 4),
                    round(ground["height"] - row["baseOffset"] * scale_for_size(row, size), 4),
                ],
                "rotation": [round(c, 8) for c in rotation],
            }
        )
        occupied.append(occupancy(bx, by, row, size, rule))
        scattered += 1
    summary.append(("floor-scatter", scattered, scatter_attempts - scattered, ""))

    payload = {
        "generator": "scripts/generate-ocean-composition.py",
        "coordinateFrame": "Blender: x/y horizontal, +y upstage, z up, seabed top z=0, water plane z=+12",
        "rotationFormat": "quaternion (w, x, y, z)",
        "scaleMeaning": "world metres of the asset's longest axis; geometry is normalised to 1-unit extent at import",
        "total": len(placements),
        "placements": placements,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=1)
        handle.write("\n")

    print(f"Wrote {len(placements)} placements -> {os.path.relpath(OUTPUT_PATH, HERE)}")
    print(f"{'zone':26} {'placed':>7} {'rejected':>9}")
    for zone_id, placed, rejected, note in summary:
        print(f"{zone_id:26} {placed:>7} {rejected:>9}  {note}")

    counts = {}
    for placement in placements:
        counts[placement["silhouette"]] = counts.get(placement["silhouette"], 0) + 1
    print("\nBy silhouette:")
    for silhouette in sorted(counts, key=lambda s: -counts[s]):
        print(f"  {silhouette:11} {counts[silhouette]}")

    if excluded:
        print("\nExcluded assets (geometry contradicts the index):")
        for line in sorted(excluded):
            print(f"  {line}")

    if unresolved_heroes:
        print("\nZone heroes with no facts row:")
        for line in unresolved_heroes:
            print(f"  {line}")

    minimum = layout["placementRules"]["minimumInstances"]
    if len(placements) < minimum:
        print(f"\nWARNING: {len(placements)} placements is below the layout floor of {minimum}.")


if __name__ == "__main__":
    main()
