"""Audit the First Fire Cinder Court shell from inside the room.

Gate 2 kept failing on a defect that every mesh statistic said was not there.
The shell IS watertight - zero boundary edges, zero holes, normals consistent -
and it still reads as a hole in the wall, because a solid carved from one block
can be perfectly closed and still have nowhere near enough rock between two
volumes that were never meant to see each other. Watertightness is the wrong
question. The right one is asked from where the visitor stands.

So this walks the room instead of inspecting the mesh:

  1. Grid the interior, keep the cells that are actually void, and flood-fill
     from the spawn so sealed pockets never count as room.
  2. From each reachable cell at eye height, fan rays across the full circle.
  3. For every ray, find the wall it lands on and then the far side of that
     wall. The gap between those two crossings is the rock thickness at the
     point the visitor is looking at.
  4. Report every place that rock runs thinner than the minimum, and every
     sightline that leaves the room somewhere other than a declared doorway.

A thickness of zero is the hole. A thickness of 0.4m is the hole three weeks
from now, once the dressing pass puts a torch behind it.

Run from the repository root:

  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
    --background --factory-startup --python scripts/audit-first-fire-shell.py \
    -- [--source <blend|glb>] [--min-wall 1.2] [--min-margin 1.2] [--json <path>]

Exits non-zero when the shell fails, so the build can gate on it.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = (
    ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "first-fire-cinder-court"
    / "first-fire-cinder-court-blender-plan.json"
)
DEFAULT_SOURCE = ROOT / "blender" / "first-fire-cinder-court-graybox.blend"
DEFAULT_REPORT = ROOT / "artifacts" / "first-fire-cinder-court" / "shell-audit.json"

# The visitor's eye, and the two heights either side of it that a room is read
# at: crouched under a low mouth, and stood up under a court crown.
EYE_HEIGHTS = (1.05, 1.62, 2.30)
GRID_STEP = 1.25          # interior sample spacing, metres
RAY_COUNT = 72            # horizontal fan, one ray every 5 degrees
# Up to 72 degrees above the horizon and 31 below.
#
# This was (-0.30, 0.0, 0.30) - seventeen degrees either side - cast from an eye
# that never rises above 2.30m, in courts crowned at 6.0, 7.6 and 9.2m. The
# instrument could not look at its own ceilings. A fin hanging over the dj court
# at z 4.2-5.4, 3.5m long and tapering to 30mm, was reported as no defect by an
# audit that had never sent a ray anywhere near it, and the span invariant took
# the blame for a miss that belonged to the ray fan.
#
# Visitors look up, and in a cave they look up first. Cover the view cone.
RAY_PITCHES = (-0.55, -0.25, 0.0, 0.25, 0.55, 0.90, 1.25)
MIN_WALL_DEFAULT = 1.2    # rock a wall must carry to read as rock
MIN_MARGIN_DEFAULT = 1.2  # rock between a room and the block's own outside
CLUSTER_RADIUS = 1.5      # thin-wall hits within this distance are one defect
DOOR_TOLERANCE = 1.5      # slack around a declared aperture, metres
GRAZE_COSINE = 0.20       # below this the ray runs along a face, not through it
# Boolean scrap is DEGENERATE, not merely small. This threshold once read 0.02
# m2, chosen with a lazy 20x margin over the largest scrap face measured in one
# n-gon mesh. glTF export triangulates: the shipped shell is 21192 triangles and
# 10992 of them - fifty-two percent - fell under that number. The instrument
# built to prove the shell was sound was ignoring half of it, and passing.
# 1e-6 m2 is a face one millimetre by two. Nothing in a seventy-metre cave is a
# wall at that size, and every collapsed sliver is.
MIN_FACE_AREA = 1e-6      # below this a face has no area, so it has no sides
NEEDLE_LIMIT = 1.8        # thin rock may run this far from an opening's edge
SPAN_STEP = 0.20          # stride when walking a thin strip along its surface
SPAN_CAP = 3.60           # stop walking here; past it, it is a blade either way
SPAN_REUSE = 0.50         # a strip measured this recently nearby is the same one
BULK_RADIUS = 1.20        # the neighbourhood a thin place is weighed over
BULK_SAMPLES = 3          # rungs per axis of that ball: 123 points inside it
MIN_BULK = 0.12           # under this the thin place is a splinter, not an edge


def parse_args(argv: list[str]) -> dict:
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    out = {"source": str(DEFAULT_SOURCE), "min_wall": MIN_WALL_DEFAULT,
           "min_margin": MIN_MARGIN_DEFAULT, "json": str(DEFAULT_REPORT)}
    for i, token in enumerate(args):
        if token == "--source" and i + 1 < len(args):
            out["source"] = args[i + 1]
        elif token == "--min-wall" and i + 1 < len(args):
            out["min_wall"] = float(args[i + 1])
        elif token == "--min-margin" and i + 1 < len(args):
            out["min_margin"] = float(args[i + 1])
        elif token == "--json" and i + 1 < len(args):
            out["json"] = args[i + 1]
    return out


def load_shell(source: str):
    if source.endswith(".glb") or source.endswith(".gltf"):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=source)
    else:
        bpy.ops.wm.open_mainfile(filepath=source)
    rock = next(
        (o for o in bpy.data.objects if o.type == "MESH" and "Shell_Rock" in o.name),
        None,
    )
    if rock is None:
        raise RuntimeError(f"No shell mesh named *Shell_Rock* in {source}")
    # Every audit ray is cast against the shell alone. Dressing objects would
    # stop rays in mid-air and report walls where there is only a torch.
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj is not rock:
            bpy.data.objects.remove(obj, do_unlink=True)
    return rock


class Shell:
    """Ray queries against the carved rock, in world space."""

    def __init__(self, obj):
        self.obj = obj
        self.to_local = obj.matrix_world.inverted()
        self.to_world = obj.matrix_world
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        self.lo = Vector((min(c.x for c in corners), min(c.y for c in corners),
                          min(c.z for c in corners)))
        self.hi = Vector((max(c.x for c in corners), max(c.y for c in corners),
                          max(c.z for c in corners)))

    def _cast(self, origin: Vector, direction: Vector):
        ok, loc, nrm, index = self.obj.ray_cast(self.to_local @ origin,
                                                self.to_local.to_3x3() @ direction)
        if not ok:
            return None
        return (self.to_world @ loc,
                (self.to_world.to_3x3() @ nrm).normalized(),
                index)

    def crossings(self, origin: Vector, direction: Vector, limit: int = 16,
                  skip_graze: bool = False):
        """Every surface the ray passes through that it actually passes through.

        Returns dicts with distance, point, normal, face index and facing (-1
        entering rock, +1 leaving it).

        SCRAPS are always dropped. An exact boolean leaves degenerate faces
        behind, coincident with real ones; they have no area, the visitor
        cannot see them, and they double every crossing they sit on. Counting
        them is what made the first version of this file report 49 walls that
        were not there.

        GRAZES are dropped only on request. A ray running along a surface hits
        it, and after the epsilon step hits the same face again; measured
        between those two hits the wall is a millimetre thick, and nothing is
        there. But a wall seen edge-on still CLOSES the room, so the graze
        filter belongs to measuring a wall, never to finding one.
        """
        out, cursor, travelled = [], origin.copy(), 0.0
        polygons = self.obj.data.polygons
        for _ in range(limit):
            hit = self._cast(cursor, direction)
            if hit is None:
                break
            point, normal, index = hit
            travelled += (point - cursor).length
            cursor = point + direction * 1e-3
            slope = normal.dot(direction)
            if polygons[index].area < MIN_FACE_AREA:
                continue
            if skip_graze and abs(slope) < GRAZE_COSINE:
                continue
            if out and travelled - out[-1]["distance"] < 1e-3:
                continue
            out.append({"distance": travelled, "point": point.copy(),
                        "normal": normal.copy(), "face": index,
                        "facing": 1 if slope > 0 else -1})
        return out

    def perpendicular_thickness(self, point: Vector, normal: Vector):
        """Rock straight back from a surface, measured through its own normal.

        Thickness along the line of sight is not thickness. A wall seen at a
        shallow angle reads as metres of rock, and the same wall seen edge-on
        reads as none. Only the perpendicular run is a property of the wall.
        """
        inward = -normal
        hits = self.crossings(point + inward * 1e-3, inward, limit=6)
        leaving = next((hit for hit in hits if hit["facing"] == 1), None)
        if leaving is None:
            return None
        return leaving["distance"] + 1e-3, leaving["point"]

    def is_outer_face(self, point: Vector) -> bool:
        """Is this surface on the block's own skin rather than inside it?"""
        return any(abs(point[axis] - bound) < 1e-3
                   for axis in range(3)
                   for bound in (self.lo[axis], self.hi[axis]))

    def wall_behind(self, origin: Vector, direction: Vector):
        """What the visitor is looking at down this ray.

        ("wall",   point, metres, normal) - rock between here and another space
        ("margin", point, metres, normal) - rock between here and the outdoors
        ("graze",  point, None)           - rock met edge-on: closed, unmeasurable
        None                              - no rock: the ray leaves the room

        MARGIN IS STILL ROCK. It is reported separately because it answers to a
        different number - the block was grown outboard of the plan on purpose -
        but it is measured and gated exactly like a wall. An earlier version let
        margin through unmeasured, on the excuse that the end wall beside the
        Water door is exactly as thick as designed. That exemption had no floor
        under it, and it hid a court carved clean through to the block's east
        face: zero rock, reported as fine.
        """
        hits = self.crossings(origin, direction, limit=8)
        if not hits:
            return None
        entry = next((hit for hit in hits
                      if hit["facing"] == -1
                      and abs(hit["normal"].dot(direction)) >= GRAZE_COSINE), None)
        if entry is None:
            return "graze", hits[0]["point"], None
        measured = self.perpendicular_thickness(entry["point"], entry["normal"])
        if measured is None:
            # Entering rock and never leaving it is impossible in a closed
            # solid - unless the surface entered IS the block's skin, which the
            # ray then leaves the model through. That is a breach: the carve
            # reached the outside, and the rock behind it is nothing.
            if self.is_outer_face(entry["point"]):
                return "margin", entry["point"], 0.0, entry["normal"]
            return "open", entry["point"], None
        depth, far_side = measured
        kind = "margin" if self.is_outer_face(far_side) else "wall"
        return kind, entry["point"], depth, entry["normal"]

    def thin_span(self, point: Vector, normal: Vector, limit: float) -> float:
        """How wide is the strip of thin rock this point sits in?

        Thickness alone cannot tell a defect from a doorway. EVERY opening has
        an edge, and at that edge the rock between the two spaces goes to
        nothing - that is what an opening is. Measuring thickness at a point
        therefore condemns every doorway in the room, which is exactly what the
        first version of this file did: 75 findings, 21 of them ordinary edges.

        What makes a blade is thin rock that KEEPS GOING. So walk the strip in
        both directions across the surface and return the SMALLER width: a
        doorway edge is thin along a line and thick one step away, while a
        blade is thin whichever way you go.
        """
        axis = Vector((0, 0, 1)) if abs(normal.z) <= 0.9 else Vector((1, 0, 0))
        along = normal.cross(axis).normalized()
        spans = []
        for tangent in (along, normal.cross(along).normalized()):
            span = 0.0
            for sign in (-1, 1):
                for step in range(1, int(SPAN_CAP / SPAN_STEP) + 1):
                    # Stand off the wall and look back at it, so a curved
                    # surface is re-found instead of probed from inside itself.
                    probe = point + tangent * (sign * step * SPAN_STEP) + normal * 0.30
                    measured = self.wall_behind(probe, -normal)
                    if (measured is None or measured[0] not in ("wall", "margin")
                            or measured[2] >= limit):
                        break
                    span += SPAN_STEP
            spans.append(span)
        return min(spans)

    def bulk_around(self, point: Vector) -> float:
        """What fraction of a ball at this point is rock?

        `thin_span` asks how far the thin strip runs ACROSS THE SURFACE, and
        that question cannot separate a doorway edge from the tip of a fin
        hanging in mid-air. Both are thin over a couple of hundred millimetres
        and thick a step away; measured at the wall they are the same thing.

        The shipped Gate 2 graybox had such a fin over the dj court - 3.5m
        long, 1.2m deep, tapering to 30mm, four metres from the visitor's eye -
        and this file called the shell sound, because at the point where the
        rock was thinnest it was thin over 200mm and no further. Every number
        was right and the answer was wrong.

        The difference is not at the surface, it is behind it. A doorway edge
        has a massif behind it; a splinter has void on every side. So stop
        measuring the skin and weigh the neighbourhood: a wall face reads
        thirty to fifty percent rock in a ball this size, and a 30mm fin reads
        under one. Two orders of magnitude apart, so the bar can sit anywhere
        sensible between them and never be the interesting question.
        """
        rock = total = 0
        steps = range(-BULK_SAMPLES, BULK_SAMPLES + 1)
        stride = BULK_RADIUS / BULK_SAMPLES
        for i in steps:
            for j in steps:
                for k in steps:
                    offset = Vector((i, j, k)) * stride
                    if offset.length > BULK_RADIUS:
                        continue
                    total += 1
                    if self.inside_rock(point + offset):
                        rock += 1
        return rock / total if total else 0.0

    def inside_rock(self, point: Vector) -> bool:
        """Parity test: an odd number of crossings upward means we are in rock."""
        return len(self.crossings(point, Vector((0, 0, 1)))) % 2 == 1

    def exit_point(self, origin: Vector, direction: Vector) -> Vector:
        """Where a ray that never meets rock leaves the block's own bounds."""
        best = math.inf
        for axis in range(3):
            if abs(direction[axis]) < 1e-9:
                continue
            for bound in (self.lo[axis], self.hi[axis]):
                t = (bound - origin[axis]) / direction[axis]
                if 1e-6 < t < best:
                    best = t
        return origin + direction * best


def declared_apertures(contract: dict) -> list[dict]:
    """The doorways the plan cuts on purpose - a ray through one is not a leak."""
    apertures = []
    for name, door in contract["doors"].items():
        apertures.append({
            "name": name,
            "centre": Vector((door["blender"]["x"], door["blender"]["y"], 0.0)),
            "side": door["side"],
            "half_width": door["clearWidth"] / 2 + DOOR_TOLERANCE,
            "height": door.get("clearHeight", 3.4) + DOOR_TOLERANCE,
        })
    return apertures


def through_aperture(point: Vector, apertures: list[dict]) -> str | None:
    """A doorway is a hole in ONE end wall, at one height, at one width.

    The side test matters: without it, a ray leaving the north wall at the same
    y as the Water door would be waved through as if it had used the door.
    """
    for aperture in apertures:
        centre = aperture["centre"]
        on_side = point.x < 0 if aperture["side"] == "west" else point.x > 0
        if (on_side
                and abs(point.x - centre.x) <= DOOR_TOLERANCE + 2.6
                and abs(point.y - centre.y) <= aperture["half_width"]
                and point.z <= aperture["height"]):
            return aperture["name"]
    return None


def cluster(points: list[dict], radius: float) -> list[dict]:
    """Collapse neighbouring hits so one missing wall reports as one defect."""
    clusters: list[dict] = []
    for entry in sorted(points, key=lambda e: -e["span"]):
        position = Vector(entry["at"])
        for group in clusters:
            if (position - Vector(group["at"])).length <= radius:
                group["samples"] += 1
                group["thickness"] = min(group["thickness"], entry["thickness"])
                group["span"] = max(group["span"], entry["span"])
                group["bulk"] = min(group["bulk"], entry["bulk"])
                break
        else:
            # Keep the thinnest hit's vantage point with it. A coordinate alone
            # cannot be gone and looked at; "stand here, face there" can.
            clusters.append({"at": entry["at"], "thickness": entry["thickness"],
                             "span": entry["span"], "bulk": entry["bulk"],
                             "seen_from": entry["seen_from"], "samples": 1})
    return clusters


def audit_shell(
    rock,
    contract: dict,
    *,
    min_wall: float = MIN_WALL_DEFAULT,
    min_margin: float = MIN_MARGIN_DEFAULT,
    grid_step: float = GRID_STEP,
    ray_count: int = RAY_COUNT,
    pitches: tuple[float, ...] = RAY_PITCHES,
    eye_heights: tuple[float, ...] = EYE_HEIGHTS,
) -> dict:
    """Audit an in-memory shell object. The builder gates on this directly."""
    apertures = declared_apertures(contract)
    shell = Shell(rock)
    # The walked route is the room's own definition of "inside": seed the flood
    # fill from the first step of the first section rather than a guessed point.
    spawn = contract["pathSections"][0]["blenderPoints"][0]
    seed = Vector((spawn["x"], spawn["y"], eye_heights[len(eye_heights) // 2]))

    # --- 1. Which cells are room? -----------------------------------------
    step = grid_step
    cols = int((shell.hi.x - shell.lo.x) / step)
    rows = int((shell.hi.y - shell.lo.y) / step)

    def cell_of(point: Vector) -> tuple[int, int]:
        return (int((point.x - shell.lo.x) / step), int((point.y - shell.lo.y) / step))

    def centre_of(cell: tuple[int, int]) -> Vector:
        return Vector((shell.lo.x + (cell[0] + 0.5) * step,
                       shell.lo.y + (cell[1] + 0.5) * step,
                       seed.z))

    void: dict[tuple[int, int], bool] = {}

    def is_void(cell: tuple[int, int]) -> bool:
        if cell not in void:
            if not (0 <= cell[0] < cols and 0 <= cell[1] < rows):
                void[cell] = False
            else:
                void[cell] = not shell.inside_rock(centre_of(cell))
        return void[cell]

    reachable: set[tuple[int, int]] = set()
    frontier = [cell_of(seed)]
    if not is_void(frontier[0]):
        # The spawn sits in rock only if the plan and the carve disagree.
        raise RuntimeError(f"Spawn cell {frontier[0]} is solid rock; the carve is wrong.")
    while frontier:
        cell = frontier.pop()
        if cell in reachable or not is_void(cell):
            continue
        reachable.add(cell)
        frontier.extend([(cell[0] + 1, cell[1]), (cell[0] - 1, cell[1]),
                         (cell[0], cell[1] + 1), (cell[0], cell[1] - 1)])

    # --- 2. Look around from every reachable cell -------------------------
    thin: list[dict] = []
    thin_margin: list[dict] = []
    splinters: list[dict] = []
    leaks: list[dict] = []
    unclosed: list[dict] = []
    span_cache: dict[tuple, tuple[float, float]] = {}
    thinnest = math.inf
    thinnest_margin = math.inf
    rays_cast = 0

    for cell in sorted(reachable):
        base = centre_of(cell)
        for height in eye_heights:
            origin = Vector((base.x, base.y, height))
            if shell.inside_rock(origin):
                continue  # a low mouth: this height is rock here, not room
            for i in range(ray_count):
                angle = 2 * math.pi * i / ray_count
                for pitch in pitches:
                    direction = Vector((math.cos(angle) * math.cos(pitch),
                                        math.sin(angle) * math.cos(pitch),
                                        math.sin(pitch))).normalized()
                    rays_cast += 1
                    measured = shell.wall_behind(origin, direction)
                    if measured is None:
                        escape = shell.exit_point(origin, direction)
                        name = through_aperture(escape, apertures)
                        if name is None:
                            leaks.append({"from": [round(v, 2) for v in origin],
                                          "out": [round(v, 2) for v in escape]})
                        continue
                    if measured[0] == "graze":
                        continue
                    if measured[0] == "open":
                        unclosed.append({"at": [round(v, 3) for v in measured[1]],
                                         "seen_from": [round(v, 2) for v in origin]})
                        continue
                    kind, entry_point, thickness, normal = measured
                    bar = min_wall if kind == "wall" else min_margin
                    if kind == "wall":
                        thinnest = min(thinnest, thickness)
                    else:
                        thinnest_margin = min(thinnest_margin, thickness)
                    if thickness >= bar:
                        continue
                    # Walking a strip costs a dozen casts and weighing a
                    # neighbourhood costs a hundred, and thousands of rays land
                    # on the same place. Measure each one once.
                    key = (kind,) + tuple(round(v / SPAN_REUSE) for v in entry_point)
                    if key in span_cache:
                        span, bulk = span_cache[key]
                    else:
                        span = shell.thin_span(entry_point, normal, bar)
                        bulk = shell.bulk_around(entry_point)
                        span_cache[key] = (span, bulk)
                    if span > NEEDLE_LIMIT:
                        (thin if kind == "wall" else thin_margin).append(
                            {"at": [round(v, 2) for v in entry_point],
                             "thickness": round(thickness, 3),
                             "span": round(span, 2),
                             "bulk": round(bulk, 3),
                             "seen_from": [round(v, 2) for v in origin]})
                    elif bulk < MIN_BULK:
                        splinters.append(
                            {"at": [round(v, 2) for v in entry_point],
                             "thickness": round(thickness, 3),
                             "span": round(span, 2),
                             "bulk": round(bulk, 3),
                             "seen_from": [round(v, 2) for v in origin]})

    defects = cluster(thin, CLUSTER_RADIUS)
    breaches = cluster(thin_margin, CLUSTER_RADIUS)
    shards = cluster(splinters, CLUSTER_RADIUS)
    return {
        "min_wall": min_wall,
        "min_margin": min_margin,
        "grid_step": grid_step,
        # How much of the shell the instrument can actually see. A rising
        # ignored count is the signature of an audit that passes by not looking.
        "faces": len(rock.data.polygons),
        "faces_ignored": sum(1 for p in rock.data.polygons if p.area < MIN_FACE_AREA),
        "room_cells": len(reachable),
        "rays_cast": rays_cast,
        "thinnest_wall": round(thinnest, 3) if thinnest < math.inf else None,
        "thinnest_margin": (round(thinnest_margin, 3)
                            if thinnest_margin < math.inf else None),
        "needle_limit": NEEDLE_LIMIT,
        "thin_wall_defects": sorted(defects, key=lambda d: -d["span"])[:40],
        "thin_wall_defect_count": len(defects),
        "thin_margin_defects": sorted(breaches, key=lambda d: -d["span"])[:40],
        "thin_margin_defect_count": len(breaches),
        "min_bulk": MIN_BULK,
        "splinters": sorted(shards, key=lambda d: d["bulk"])[:40],
        "splinter_count": len(shards),
        "leak_count": len(leaks),
        "leaks": leaks[:20],
        "unclosed_hits": len(unclosed),
        "unclosed": unclosed[:20],
        "pass": (not defects and not breaches and not shards
                 and not leaks and not unclosed),
    }


def main() -> int:
    options = parse_args(sys.argv)
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    rock = load_shell(options["source"])
    report = audit_shell(rock, manifest["contract"], min_wall=options["min_wall"],
                         min_margin=options["min_margin"])
    report["source"] = options["source"]

    out_path = Path(options["json"])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("###AUDIT###")
    print(json.dumps(report, indent=1))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
