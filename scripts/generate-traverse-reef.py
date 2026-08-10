"""Compose the water traverse's trench gallery.

The middle leg of the traverse is 98 m of seabed that shipped with ONE baked
reef GLB dropped at its centre: a 40 m island in a 98 m room, bare sand on the
approach and bare sand past it. This composes the whole trench instead.

What is reused, and what is not:

  * `scripts/ocean-asset-facts.json` and `scripts/ocean-ecology-rules.json` are
    consumed verbatim. They are the researched index — 47 assets with real
    species scale, and the biology of how each silhouette class groups. There is
    no second copy of any of that here.

  * `scripts/generate-ocean-composition.py` is NOT extended. It composes a
    theatre: elliptical zones around a proscenium and a dais, sampled against a
    baked heightmap, staged for one hero camera downstage. Every one of those
    assumptions is false here. This is a corridor with an analytic flat floor
    and no fixed camera at all — the audience is a person walking up the
    centreline, and the composition has to read from every point on that line.
    Sharing the sampling code would mean parameterising a hero camera into a
    thing that has none.

The composition grammar lives in `scripts/water-traverse-reef-layout.json`,
which is the file to edit when a frame looks wrong. This script is the
mechanism, not the art.

Pure math, no `bpy`. Run it, read the JSON, then instantiate with
scripts/build-traverse-reef.py.

Run:
  python scripts/generate-traverse-reef.py

Design: docs/superpowers/specs/active/2026-08-09-trench-gallery-composition-design.md
"""

import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# The sculpted floor. Same module the visual mesh is baked from and the runtime
# colliders are tiled from, so a specimen cannot end up standing on a different
# seabed from the one the visitor walks.
import traverse_seabed as seabed  # noqa: E402

FACTS_PATH = os.path.join(HERE, "ocean-asset-facts.json")
RULES_PATH = os.path.join(HERE, "ocean-ecology-rules.json")
LAYOUT_PATH = os.path.join(HERE, "water-traverse-reef-layout.json")
OUTPUT_PATH = os.path.join(HERE, "water-traverse-reef.json")

# Instances per square metre of band area, before an act's density multiplier.
# The trench's usable floor is roughly 5 500 m2 per flank, so this lands near
# 400 instances — dense enough to never see bare sand between features, sparse
# enough that the walk is not a hedge.
INSTANCES_PER_SQM = 0.055
# Rejection sampling gives up rather than looping. A band that cannot place its
# quota is reported, not silently short: it means the clearance rules and the
# band width disagree, which is a layout bug worth seeing.
MAX_ATTEMPTS_PER_INSTANCE = 30

# Terrain. The ascent profile lives in traverse_seabed.base_floor_y and is
# read from there, not restated here.
#
# It used to be restated here, as the third copy of the same ramp math after
# water-traverse-terrain.ts and traverse_seabed.py. When the ascent moved on
# 2026-08-09 the two other copies were updated and this one was not, so all 755
# specimens were seated against a floor that no longer existed and the 7.5 m
# arch gate on the centreline ended up 5.3 m underground. Three owners for one
# curve is how that happens; there is one owner now.
SEA_FLOOR_Y = -18.0


class Terrain:
    """Height and slope of the trench floor, in seabed-relative metres.

    The ocean stage needs a 256x256 baked heightmap because its floor is a
    sculpted shelf. The trench's floor is a flat and two ramps, authored as
    closed-form geometry in TypeScript, so here it is nine lines of arithmetic
    and there is nothing to bake or keep in sync.
    """

    def __init__(self, geometry):
        self.flat_end_z = geometry["flatEndZ"]
        self.ascent_end_z = geometry["ascentEndZ"]

    def height(self, z):
        """Metres above the seabed datum at route position z."""
        return seabed.base_floor_y(z) - SEA_FLOOR_Y

    def slope_degrees(self, z):
        d = 0.5
        rise = self.height(z + d) - self.height(z - d)
        return abs(math.degrees(math.atan2(rise, 2 * d)))

    def substrate(self, x, bands):
        """What the floor is made of, derived from distance off the walk.

        The ocean stage derives substrate from terrain shape because its floor
        has shape to read. This floor is flat, so shape says nothing — but the
        bands already describe three different grounds, and they turn out to BE
        the substrate map:

          near  sand   the swept apron either side of the walk, where the small
                       sand-dwellers collect: shells, urchins, grass, anemones
          mid   reef   the reef bed itself, the only ground hard corals accept
          far   rock   the rubble and bedrock apron running up to the ridge wall

        Deriving it the other way — flat sand everywhere with rock only at the
        walls — is what the first run did, and it locked every coral in the
        index out of the trench: reef-substrate species had nowhere to live but
        a 4 m strip against the wall, 30 m from anyone looking at them.
        """
        d = abs(x)
        if d < bands["mid"]["fromX"]:
            return "sand"
        if d < bands["far"]["fromX"]:
            return "reef"
        return "rock"


def load(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def check_geometry(geometry):
    """Fail loudly if the layout's copy of the terrain has drifted.

    The layout restates constants that live in water-traverse-terrain.ts. A
    stale copy does not error — it plants coral inside a wall — so the one
    invariant that is cheap to test is tested.
    """
    problems = []
    if geometry["channelHalfWidth"] >= geometry["floorHalfWidth"]:
        problems.append("channel is wider than the floor")
    open_width = geometry["floorHalfWidth"] - geometry["ridgeThickness"]
    if open_width <= geometry["channelHalfWidth"]:
        problems.append("ridge walls leave no floor beside the channel")
    if problems:
        raise SystemExit("layout geometry is impossible: " + "; ".join(problems))
    return open_width


class Occupancy:
    """Everything already placed, for spacing and apron rejection.

    Flat list rather than a grid: 400 instances against 400 is 80 000 distance
    checks, which is nothing, and a grid would be a second thing to be wrong.
    """

    def __init__(self):
        self.items = []

    def add(self, x, z, radius, silhouette):
        self.items.append((x, z, radius, silhouette))

    def clear_of(self, x, z, radius, silhouette, spacing_multiplier):
        for ox, oz, oradius, osil in self.items:
            gap = math.hypot(x - ox, z - oz)
            required = radius + oradius
            if osil == silhouette:
                required *= spacing_multiplier
            if gap < required:
                return False
        return True


def band_size_range(band, act, band_name):
    """The size window for this band, after any per-act override.

    An act may lower a band's floor when its own ceiling has already closed the
    band off. The descent beds cap everything at 3 m, which left the far band —
    floor 4 m — admitting literally nothing, so its whole flank came out as bare
    sand. Dropping that one floor to boulder scale fills it with rubble without
    breaking the act's promise that nothing tall stands here.
    """
    lo, hi = band["sizeMetres"]
    lo = act.get("bandSizeFloor", {}).get(band_name, lo)
    return lo, min(hi, act["maxHeightMetres"])


def pick_size(rng, facts, band, act, band_name):
    """A world size that satisfies the species, the band and the act.

    Where the researched range and the band overlap, sample the overlap. Where
    they do not, the asset simply is not admitted here — which is the whole
    point of the bands, so it is a rejection rather than a clamp.
    """
    band_lo, band_hi = band_size_range(band, act, band_name)
    lo = max(facts["sizeMetres"]["min"], band_lo)
    hi = min(facts["sizeMetres"]["max"], band_hi)
    if lo > hi:
        return None
    return lo + (hi - lo) * rng.random()


def yaw_for(rng, policy, x, layout):
    """Heading in degrees about the vertical, 0 = +z (down the route).

    `face-camera-biased` is reinterpreted for a walk: the ocean stage aims its
    interesting faces at a fixed hero camera, and there is no such camera here.
    The audience is the centreline, so an instance turns to face x = 0 — same
    intent, different geometry.
    """
    if policy == "face-current":
        return layout["yaw"]["currentDegrees"] + rng.uniform(-15, 15)
    if policy == "face-camera-biased":
        toward_channel = 90.0 if x < 0 else -90.0
        jitter = layout["yaw"]["channelBiasJitterDegrees"]
        return toward_channel + rng.uniform(-jitter, jitter)
    return rng.uniform(0, 360)


def ground_samples(terrain, x, z, radius, rings=2, spokes=8):
    """Ground elevations under a footprint: centre plus two sampled rings."""
    heights = [terrain.height(z) + seabed.relief_at(x, z)]
    for ring in range(1, rings + 1):
        r = radius * ring / rings
        for spoke in range(spokes):
            angle = math.tau * spoke / spokes
            sx = x + r * math.cos(angle)
            sz = z + r * math.sin(angle)
            heights.append(terrain.height(sz) + seabed.relief_at(sx, sz))
    return heights


def footprint_relief_span(terrain, x, z, radius):
    """How much the ground rises and falls across a footprint, in metres."""
    heights = ground_samples(terrain, x, z, radius)
    return max(heights) - min(heights)


def seating_tolerance(size):
    """How much ground variation an asset of this size can absorb.

    Seating at the footprint minimum means the floor can only ever rise INTO an
    asset, never drop away from it, so this bounds how deeply the ground can cut
    up its side before the specimen has to go somewhere flatter.

    It scales with size rather than being a flat allowance, because the defect
    is proportional: a metre of dune against a 14 m pinnacle is the bed it
    stands in, and the same metre against a 40 cm anemone deletes it. A first
    pass used a near-constant tolerance and evicted every large landmark from
    the trench — the citadel, both big rocks and the coral arch all went unused,
    which cost the composition far more than a bedded-in boulder ever could.
    """
    return min(3.0, 0.30 + 0.22 * size)


def emit(placements, asset_id, facts, x, z, size, yaw, terrain, tilt_jitter, rng, note):
    """One placement row, sat on the floor and tilted off vertical.

    The floor is no longer a plane. `terrain.height` gives the analytic ramp
    profile; `seabed.relief_at` adds the sculpted dune the specimen is actually
    standing on. Without the second term every specimen off the cleared route
    sits buried to its waist in its own dune — which is what happens when set
    dressing is placed before the ground exists.

    Seating uses the MINIMUM ground under the whole footprint, not the height at
    the centre point. A specimen is a rigid object several metres wide standing
    on undulating dunes: seat it at its centre and the downhill half hangs in
    open water while the uphill half is swallowed. Measured on the first
    sculpted build, 29% of the trench had reef geometry more than 0.6 m under
    the floor, the worst of it over 4 m. Taking the minimum means the ground can
    only ever rise into a specimen — which reads as bedding in — and never fall
    away from under it, which reads as broken.

    `baseOffset` deliberately does NOT appear here. It records where a source
    GLB's geometry sits relative to its own origin, and build-traverse-reef.py
    already spends that fact at import: every source is normalised to unit
    extent and re-origined to its base centre, so a placement's y IS where the
    asset's lowest point lands. Applying the offset a second time sank every
    specimen by |baseOffset| x size — measured at a 2.6 m table coral, 0.60 m
    of it under the sand, which is what "tons of stuff clips through the floor"
    was.
    """
    radius = facts["footprintRadius"] * size
    y = min(ground_samples(terrain, x, z, radius))
    placements.append(
        {
            "asset": asset_id,
            "path": facts["path"],
            "species": facts["species"],
            "silhouette": facts["silhouette"],
            "sizeMetres": round(size, 3),
            "position": [round(x, 4), round(y, 4), round(z, 4)],
            "yawDegrees": round(yaw % 360.0, 2),
            "tiltDegrees": [
                round(rng.uniform(-tilt_jitter, tilt_jitter), 2),
                round(rng.uniform(-tilt_jitter, tilt_jitter), 2),
            ],
            "role": note,
        }
    )


def admitted_assets(facts_index, classes, band, act, band_name):
    """Assets whose class is admitted here AND whose real size can fit the band."""
    band_lo, band_hi = band_size_range(band, act, band_name)
    out = []
    for asset_id, facts in facts_index.items():
        if facts.get("silhouette") not in classes:
            continue
        lo = max(facts["sizeMetres"]["min"], band_lo)
        hi = min(facts["sizeMetres"]["max"], band_hi)
        if lo <= hi:
            out.append((asset_id, facts))
    return out


def place_specimens(layout, facts_index, terrain, occupancy, placements, rng):
    """The curatorial move: one perfect example, alone, in cleared sand.

    Placed FIRST so their aprons are already in the occupancy grid and the
    scatter passes have to route around them. A specimen that gets crowded by
    a later staghorn thicket is not a specimen.
    """
    spec = layout["specimens"]
    for entry in spec["placements"]:
        facts = facts_index[entry["asset"]]
        size = entry["sizeMetres"]
        yaw = yaw_for(rng, "face-camera-biased", entry["x"], layout)
        emit(
            placements, entry["asset"], facts, entry["x"], entry["z"], size, yaw,
            terrain, 3.0, rng, "specimen",
        )
        occupancy.add(entry["x"], entry["z"], spec["apronRadius"], "_apron")


def place_gates(layout, facts_index, terrain, occupancy, placements, rng):
    """Arches straddling the walk, squared to it so they are passed through."""
    gates = layout["gates"]
    for index, z in enumerate(gates["atZ"]):
        asset_id = gates["assets"][index % len(gates["assets"])]
        facts = facts_index[asset_id]
        size = gates["sizeMetres"]
        emit(placements, asset_id, facts, 0.0, z, size, 90.0 - facts["facing"],
             terrain, 1.5, rng, "gate")
        # The arch's own footprint is the exclusion: nothing may crowd the
        # opening the visitor walks through.
        occupancy.add(0.0, z, facts["footprintRadius"] * size + 3.0, "_apron")


def place_bays(layout, act, facts_index, terrain, occupancy, placements, rng):
    """Monumental instances ranked at a regular stride, alternating flanks."""
    bays = act.get("bays")
    if not bays:
        return 0
    pool = [
        (asset_id, facts)
        for asset_id, facts in facts_index.items()
        if facts.get("silhouette") in bays["classes"]
        and facts["sizeMetres"]["max"] >= layout["bands"]["far"]["sizeMetres"][0]
    ]
    if not pool:
        return 0
    placed = 0
    z = bays["startZ"]
    flank = 1
    while z < act["toZ"]:
        asset_id, facts = pool[rng.randrange(len(pool))]
        x = flank * rng.uniform(bays["x"][0], bays["x"][1])
        size = max(
            layout["bands"]["far"]["sizeMetres"][0],
            facts["sizeMetres"]["min"]
            + (facts["sizeMetres"]["max"] - facts["sizeMetres"]["min"]) * rng.random(),
        )
        radius = facts["footprintRadius"] * size
        if occupancy.clear_of(x, z, radius, facts["silhouette"], 1.0):
            yaw = yaw_for(rng, "face-camera-biased", x, layout)
            emit(placements, asset_id, facts, x, z, size, yaw, terrain, 3.0, rng, "bay")
            occupancy.add(x, z, radius, facts["silhouette"])
            placed += 1
        z += bays["strideZ"]
        flank = -flank
    return placed


def place_kelp_stands(layout, facts_index, terrain, occupancy, placements, rng):
    """Kelp as forests, not as scattered singles.

    Giant kelp is the only thing in the index that reaches from the seabed
    toward the surface, so it is the only asset that can describe the 18 m of
    water overhead. Placed in a handful of dense stands: kelp is a forest or it
    is a weed.
    """
    stands = layout["kelpStands"]
    placed = 0
    for _ in range(stands["count"]):
        cz = rng.uniform(*stands["zRange"])
        cx = rng.choice([-1, 1]) * rng.uniform(*stands["xRange"])
        count = rng.randint(*stands["perStand"])
        for _ in range(count):
            asset_id = rng.choice(stands["assets"])
            facts = facts_index[asset_id]
            angle = rng.uniform(0, math.tau)
            reach = stands["radius"] * math.sqrt(rng.random())
            x = cx + math.cos(angle) * reach
            z = cz + math.sin(angle) * reach
            size = rng.uniform(*stands["sizeMetres"])
            # A kelp frond is a stalk, not a disc. Its bounding footprint
            # scales with its 10 m HEIGHT, so spacing fronds by that number
            # spread a "stand" over 40 m and rejected all but a handful — five
            # stands produced six fronds. Kelp is spaced by its stipe.
            radius = stands["frondRadius"]
            if not occupancy.clear_of(x, z, radius, "blade", 1.0):
                continue
            yaw = yaw_for(rng, "face-current", x, layout)
            emit(placements, asset_id, facts, x, z, size, yaw, terrain, 5.0, rng, "kelp-stand")
            occupancy.add(x, z, radius, "blade")
            placed += 1
    return placed


def place_band(layout, act, band_name, facts_index, rules, terrain, occupancy,
               placements, rng, geometry, open_width):
    """Scatter one act's one band, honouring habit, spacing and clearance."""
    band = layout["bands"][band_name]
    classes = act["admits"][band_name]
    pool = admitted_assets(facts_index, classes, band, act, band_name)
    if not pool:
        return 0, 0

    from_x = band["fromX"]
    to_x = min(band["toX"], open_width - 1.0)
    if to_x <= from_x:
        return 0, 0

    area = 2 * (to_x - from_x) * (act["toZ"] - act["fromZ"])
    # The near band is the only one the visitor can actually READ, and it is
    # also the narrowest and the one whose sand-dwellers carry the largest
    # companion spacing — left on the flat rate it came out at half a dozen
    # shells per act, which is a beach, not a reef apron.
    quota = int(area * INSTANCES_PER_SQM * act["density"] * band.get("densityScale", 1.0))

    channel_clear = geometry["channelHalfWidth"] + layout["clearance"]["margin"]
    exit_clear_z = layout["clearance"]["exitClearZ"]

    placed = 0
    rejected = 0
    for _ in range(quota):
        asset_id, facts = pool[rng.randrange(len(pool))]
        rule = rules[facts["silhouette"]]
        for _ in range(MAX_ATTEMPTS_PER_INSTANCE):
            x = rng.choice([-1, 1]) * rng.uniform(from_x, to_x)
            z = rng.uniform(act["fromZ"], act["toZ"])
            if z > exit_clear_z:
                continue
            if terrain.slope_degrees(z) > rule["slopeRange"][1]:
                continue
            substrate = terrain.substrate(x, layout["bands"])
            if substrate not in rule["substrate"] and "any" not in rule["substrate"]:
                continue
            size = pick_size(rng, facts, band, act, band_name)
            if size is None:
                continue
            radius = facts["footprintRadius"] * size
            # Clearance is measured to the FOOTPRINT, not the origin. A 12 m
            # pinnacle whose centre clears the channel still hangs six metres
            # of rock over the walk.
            if abs(x) - radius < channel_clear:
                continue
            # Too much rise and fall under the footprint for this asset to sit
            # convincingly. Rejecting here rather than fixing it at seating time
            # is what keeps big specimens off dune crests, where no seating
            # height exists that does not either bury or float them.
            if footprint_relief_span(terrain, x, z, radius) > seating_tolerance(size):
                continue
            if not occupancy.clear_of(x, z, radius, facts["silhouette"],
                                      rule["companionSpacing"]):
                continue

            yaw = yaw_for(rng, rule["yawPolicy"], x, layout)
            emit(placements, asset_id, facts, x, z, size, yaw, terrain,
                 rule["tiltJitter"], rng, f"{act['id']}/{band_name}")
            occupancy.add(x, z, radius, facts["silhouette"])
            placed += 1

            # Habit: clumping and colonial species scatter siblings around the
            # seed. A single isolated staghorn is the tell that a reef was
            # placed by a random walk.
            if rule["habit"] in ("clumping", "colonial"):
                siblings = rng.randint(*rule["clumpSize"]) - 1
                spread = radius * (3.0 if rule["habit"] == "clumping" else 1.8)
                for _ in range(siblings):
                    angle = rng.uniform(0, math.tau)
                    reach = spread * (0.4 + 0.6 * rng.random())
                    sx = x + math.cos(angle) * reach
                    sz = z + math.sin(angle) * reach
                    ssize = pick_size(rng, facts, band, act, band_name)
                    if ssize is None:
                        continue
                    sradius = facts["footprintRadius"] * ssize
                    if abs(sx) - sradius < channel_clear or sz > exit_clear_z:
                        continue
                    if not occupancy.clear_of(sx, sz, sradius, facts["silhouette"],
                                              rule["companionSpacing"] * 0.5):
                        continue
                    if (footprint_relief_span(terrain, sx, sz, sradius)
                            > seating_tolerance(ssize)):
                        continue
                    emit(placements, asset_id, facts, sx, sz, ssize,
                         yaw_for(rng, rule["yawPolicy"], sx, layout), terrain,
                         rule["tiltJitter"], rng, f"{act['id']}/{band_name}")
                    occupancy.add(sx, sz, sradius, facts["silhouette"])
                    placed += 1
            break
        else:
            rejected += 1

    return placed, rejected


def main():
    facts_index = {k: v for k, v in load(FACTS_PATH).items() if not k.startswith("_")}
    rules = load(RULES_PATH)
    layout = load(LAYOUT_PATH)

    geometry = layout["geometry"]
    open_width = check_geometry(geometry)
    terrain = Terrain(geometry)
    rng = random.Random(layout["seed"])

    placements = []
    occupancy = Occupancy()

    # Order matters: every DESIGNED feature — specimens, gates, kelp stands —
    # claims its ground before the scatter runs, so the scatter routes around
    # them rather than the other way round. Running the stands last produced
    # four fronds from five stands: by then the reef bed they wanted was full.
    place_specimens(layout, facts_index, terrain, occupancy, placements, rng)
    place_gates(layout, facts_index, terrain, occupancy, placements, rng)
    kelp = place_kelp_stands(layout, facts_index, terrain, occupancy, placements, rng)

    summary = []
    for act in layout["acts"]:
        bays = place_bays(layout, act, facts_index, terrain, occupancy, placements, rng)
        act_total = bays
        # Far to near: the big shapes claim their ground first, then the detail
        # fills in around them. The verge runs last — it is the densest band and
        # the most forgiving about where it lands.
        for band_name in ("far", "mid", "near", "verge"):
            placed, rejected = place_band(
                layout, act, band_name, facts_index, rules, terrain, occupancy,
                placements, rng, geometry, open_width,
            )
            act_total += placed
            if rejected:
                summary.append(
                    f"  {act['id']}/{band_name}: {placed} placed, "
                    f"{rejected} gave up after {MAX_ATTEMPTS_PER_INSTANCE} attempts"
                )
            else:
                summary.append(f"  {act['id']}/{band_name}: {placed} placed")
        summary.append(f"  {act['id']}: {act_total} total (bays {bays})")

    summary.append(f"  kelp stands: {kelp} fronds")

    by_asset = {}
    for entry in placements:
        by_asset[entry["asset"]] = by_asset.get(entry["asset"], 0) + 1

    document = {
        "generator": "scripts/generate-traverse-reef.py",
        "layout": "scripts/water-traverse-reef-layout.json",
        "coordinateFrame": (
            "Runtime frame: x across the trench (0 = walking centreline), "
            "y metres above the seabed, z absolute route distance"
        ),
        "scaleMeaning": (
            "world metres of the asset's longest axis; geometry is normalised "
            "to 1-unit extent at import"
        ),
        "seed": layout["seed"],
        "total": len(placements),
        "distinctAssets": len(by_asset),
        "placements": placements,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=1)

    print("\n".join(summary))
    print(f"\n{len(placements)} placements of {len(by_asset)} distinct assets "
          f"-> {os.path.relpath(OUTPUT_PATH, HERE)}")
    unused = sorted(set(facts_index) - set(by_asset))
    if unused:
        print(f"unused assets ({len(unused)}): {', '.join(unused)}")


if __name__ == "__main__":
    main()
