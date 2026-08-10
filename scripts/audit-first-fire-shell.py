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
    -- [--source <blend|glb>] [--min-wall 1.2] [--json <path>]

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
RAY_PITCHES = (-0.30, 0.0, 0.30)
MIN_WALL_DEFAULT = 1.2    # rock a wall must carry to read as rock
CLUSTER_RADIUS = 1.5      # thin-wall hits within this distance are one defect
DOOR_TOLERANCE = 1.5      # slack around a declared aperture, metres


def parse_args(argv: list[str]) -> dict:
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    out = {"source": str(DEFAULT_SOURCE), "min_wall": MIN_WALL_DEFAULT,
           "json": str(DEFAULT_REPORT)}
    for i, token in enumerate(args):
        if token == "--source" and i + 1 < len(args):
            out["source"] = args[i + 1]
        elif token == "--min-wall" and i + 1 < len(args):
            out["min_wall"] = float(args[i + 1])
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
        ok, loc, nrm, _ = self.obj.ray_cast(self.to_local @ origin,
                                            self.to_local.to_3x3() @ direction)
        if not ok:
            return None
        return self.to_world @ loc, (self.to_world.to_3x3() @ nrm).normalized()

    def crossings(self, origin: Vector, direction: Vector, limit: int = 16):
        """Every surface the ray passes through, front/back classified.

        Returns (distance, point, facing) where facing is -1 entering rock and
        +1 leaving it. Grazing hits re-report the same face after the epsilon
        step, which would otherwise read as a wall of zero thickness, so a
        crossing that lands within a millimetre of the previous one is dropped
        rather than counted.
        """
        out, cursor, travelled = [], origin.copy(), 0.0
        for _ in range(limit):
            hit = self._cast(cursor, direction)
            if hit is None:
                break
            point, normal = hit
            travelled += (point - cursor).length
            facing = 1 if normal.dot(direction) > 0 else -1
            if not out or travelled - out[-1][0] > 1e-3:
                out.append((travelled, point.copy(), facing))
            cursor = point + direction * 1e-3
        return out

    def wall_thickness(self, origin: Vector, direction: Vector):
        """The wall the visitor is looking at: where it starts, how deep it runs.

        Rock begins at the first front-facing crossing and ends at the first
        back-facing one after it. Anything between those two is solid.
        """
        hits = self.crossings(origin, direction, limit=8)
        entry = next((h for h in hits if h[2] == -1), None)
        if entry is None:
            return None
        exit_hit = next((h for h in hits if h[0] > entry[0] and h[2] == 1), None)
        if exit_hit is None:
            return entry[1], None
        return entry[1], exit_hit[0] - entry[0]

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
    for entry in sorted(points, key=lambda e: e["thickness"]):
        position = Vector(entry["at"])
        for group in clusters:
            if (position - Vector(group["at"])).length <= radius:
                group["samples"] += 1
                group["thickness"] = min(group["thickness"], entry["thickness"])
                break
        else:
            clusters.append({"at": entry["at"], "thickness": entry["thickness"],
                             "samples": 1})
    return clusters


def audit_shell(
    rock,
    contract: dict,
    *,
    min_wall: float = MIN_WALL_DEFAULT,
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
                       EYE_HEIGHTS[1]))

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
    leaks: list[dict] = []
    unclosed: list[dict] = []
    thinnest = math.inf
    rays_cast = 0

    for cell in sorted(reachable):
        base = centre_of(cell)
        for height in EYE_HEIGHTS:
            origin = Vector((base.x, base.y, height))
            if shell.inside_rock(origin):
                continue  # a low mouth: this height is rock here, not room
            for i in range(RAY_COUNT):
                angle = 2 * math.pi * i / RAY_COUNT
                for pitch in RAY_PITCHES:
                    direction = Vector((math.cos(angle) * math.cos(pitch),
                                        math.sin(angle) * math.cos(pitch),
                                        math.sin(pitch))).normalized()
                    rays_cast += 1
                    measured = shell.wall_thickness(origin, direction)
                    if measured is None:
                        escape = shell.exit_point(origin, direction)
                        name = through_aperture(escape, apertures)
                        if name is None:
                            leaks.append({"from": [round(v, 2) for v in origin],
                                          "out": [round(v, 2) for v in escape]})
                        continue
                    entry_point, thickness = measured
                    if thickness is None:
                        unclosed.append({"at": [round(v, 2) for v in entry_point]})
                        continue
                    thinnest = min(thinnest, thickness)
                    if thickness < options["min_wall"]:
                        thin.append({"at": [round(v, 2) for v in entry_point],
                                     "thickness": round(thickness, 3),
                                     "seen_from": [round(v, 2) for v in origin]})

    defects = cluster(thin, CLUSTER_RADIUS)
    report = {
        "source": options["source"],
        "min_wall": options["min_wall"],
        "room_cells": len(reachable),
        "rays_cast": rays_cast,
        "thinnest_wall": round(thinnest, 3) if thinnest < math.inf else None,
        "thin_wall_defects": sorted(defects, key=lambda d: d["thickness"])[:40],
        "thin_wall_defect_count": len(defects),
        "leak_count": len(leaks),
        "leaks": leaks[:20],
        "unclosed_hits": len(unclosed),
        "pass": not defects and not leaks and not unclosed,
    }

    out_path = Path(options["json"])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("###AUDIT###")
    print(json.dumps(report, indent=1))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
