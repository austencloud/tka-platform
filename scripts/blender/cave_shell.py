"""Carve a cave shell out of one solid mass of rock.

Every Vulcan Cave room is a hole, not a set of walls. The First Fire graybox
established the method: build a single block that spans the room's footprint
plus a margin, model the space the visitor actually occupies as a NEGATIVE
volume, and subtract it. Floor, wall and vault come out as one continuous
surface because they were never separate objects — they are the same cut.

The Drowned Gallery was built the other way, out of axis-aligned boxes, and it
reads as a set of rooms rather than a cave: every arris is a 90-degree corner
and every ceiling is a flat lid. Austen, walking it (2026-08-11): "this does
not feel like it's in a cave." This module is First Fire's machinery pulled out
so both rooms cut their shells the same way, and so the four remaining wings
inherit it rather than growing a third variant.

Two families of negative volume live here:

  swept / chamber   a section pushed along a centreline, or revolved. What a
                    tunnel network wants: First Fire's corridors, torch lanes
                    and courts are all one of these two.
  vault / basin     a rounded-rectangle room raised to a crown, or a trough cut
                    down from a deck. What a MEASURED room wants, where the
                    plan is a contract of rectangles that must survive the
                    re-cut unchanged.

Everything is authored in Blender coordinates. Callers own the mapping from
their own plan space; keeping that out of here is what lets two rooms with
different origins share one carver.
"""

from __future__ import annotations

import math

import bpy

# Four cross-sections, floor edge up to crown, as (lateral multiple of the
# walked half-width, fraction of the clearance).
#
# The lateral term is CLAMPED at 1.00 on purpose. An earlier set gave every
# wall a belly that bulged past its own foot, which undercut the foot all the
# way round: the floor came out 93.6% flat with a ragged 6% fringe spread over
# 152 levels, and the room read as a jagged pit rather than a walked space.
# Austen (2026-08-10): "I'd like you to simplify the floor ... I just want to
# back everything up and get a really simple graybox going where the floor is
# consistent." A profile that never exceeds 1.00 can only ever ADD rock above
# the foot, so the walked surface stays exactly the rectangle the plan promised.
WALL_PROFILES = {
    "tube":  [(1.00, 0.00), (1.00, 0.63), (0.81, 0.80), (0.46, 0.93), (0.00, 1.00)],
    "slot":  [(1.00, 0.00), (1.00, 0.70), (0.92, 0.85), (0.60, 0.95), (0.00, 1.00)],
    "dome":  [(1.00, 0.00), (1.00, 0.44), (0.94, 0.60), (0.78, 0.75), (0.47, 0.90), (0.00, 1.00)],
    "shaft": [(1.00, 0.00), (1.00, 0.42), (0.80, 0.56), (0.42, 0.68), (0.22, 0.86), (0.00, 1.00)],
}

# The wall foot stands this far outboard of the walked edge, so the colliders —
# derived from the same plan widths — always stop the visitor before the rock
# rather than inside it.
FLOOR_SHOULDER = 0.30

# The mitre widens a swept section through a bend so the passage keeps its width
# instead of pinching. Past this the widening runs away and the ring crosses the
# segments either side of it, handing the solver a mesh that folds through
# itself; at 0.45 that resolved into a 150mm blade of rock standing a metre
# inside a court. 0.85 caps the widening at 1.18. Corners are closed by the
# joint chamber at each vertex, which is what joints are for.
MITRE_LIMIT = 0.85

# An exact boolean leaves scrap: zero-area faces lying on top of real ones. The
# visitor never sees them, but they double every ray crossing they sit on, which
# is enough to make a measuring instrument report walls that are not there.
SCRAP_WELD = 1e-4


def wall_profile(
    walked_half_width: float, clearance: float, shape: str = "tube",
    shoulder: float = FLOOR_SHOULDER,
) -> list[tuple[float, float]]:
    foot = walked_half_width + shoulder
    return [(foot * u, clearance * h) for u, h in WALL_PROFILES[shape]]


def crown_is_a_ridge(profile: list[tuple[float, float]]) -> bool:
    """Does the section close to a line on its own axis, or to a flat top?

    A ridged crown shares one apex between both walls; a flat crown has two
    distinct top corners and a ceiling between them. Everything that builds
    geometry from a profile has to know which, or it drops the far corner.
    """
    return profile[-1][0] <= 1e-6


def section_loop(
    walked_half_width: float, clearance: float, shape: str = "tube",
    shoulder: float = FLOOR_SHOULDER,
) -> list[tuple[float, float]]:
    """Closed cross-section of the void, as (lateral offset, height)."""
    profile = wall_profile(walked_half_width, clearance, shape, shoulder)
    foot = profile[0][0]
    loop = [(-foot, 0.0), (foot, 0.0)]
    loop += profile[1:]                                     # right wall to crown
    # A ridge's apex belongs to both walls and is walked once; a flat crown's
    # top corner is mirrored like every other point, and the segment between
    # the two mirrored corners IS the ceiling.
    mirrored = profile[1:-1] if crown_is_a_ridge(profile) else profile[1:]
    loop += [(-u, h) for u, h in reversed(mirrored)]        # left wall back down
    return loop


def unit(start: tuple[float, float], end: tuple[float, float]) -> tuple[float, float]:
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    return (dx / length, dy / length) if length > 1e-9 else (1.0, 0.0)


def rounded_rect_ring(
    x0: float, y0: float, x1: float, y1: float,
    radius: float, corner_segments: int,
) -> list[tuple[float, float]]:
    """One closed counter-clockwise loop: a rectangle with rounded corners.

    Always emits 4 * (corner_segments + 1) points regardless of the radius, so
    every ring in a stack has the same vertex count and the walls between them
    are quads. A radius of zero still costs the same vertices and produces the
    square corner — which is the point: a room whose corners are square at the
    floor and round at the crown needs both from the same generator.
    """
    radius = max(0.0, min(radius, (x1 - x0) / 2, (y1 - y0) / 2))
    corners = [
        ((x1 - radius, y0 + radius), -math.pi / 2),   # south-east
        ((x1 - radius, y1 - radius), 0.0),            # north-east
        ((x0 + radius, y1 - radius), math.pi / 2),    # north-west
        ((x0 + radius, y0 + radius), math.pi),        # south-west
    ]
    loop: list[tuple[float, float]] = []
    for (cx, cy), start_angle in corners:
        for step in range(corner_segments + 1):
            angle = start_angle + (math.pi / 2) * step / corner_segments
            loop.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return loop


class Carver:
    """Collects negative volumes, then subtracts their union from a rock block.

    One join and one boolean, not one boolean per volume: ~70 sequential exact
    booleans is minutes of solver time and a new chance to fail at every step,
    while `use_self` on a single joined negative lets the overlapping volumes
    behave as their union for free.
    """

    def __init__(self, collection_name: str = "CARVE_Negative", scene=None):
        self.scene = scene or bpy.context.scene
        self.collection = bpy.data.collections.new(collection_name)
        self.scene.collection.children.link(self.collection)
        self.parts: list[bpy.types.Object] = []
        # The centreline each sweep actually used, overrun included. A caller
        # auditing its own shell reasons about surfaces, and a surface built
        # from a path that is not the path the mesh used sends it hunting for
        # wedges that are not there.
        self.paths: dict[str, list[tuple[float, float]]] = {}

    # ── mesh plumbing ───────────────────────────────────────────────────────

    def mesh(
        self, name: str, vertices: list[tuple[float, float, float]],
        faces: list[tuple[int, ...]],
    ) -> bpy.types.Object:
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        self.collection.objects.link(obj)
        self.parts.append(obj)
        return obj

    # ── swept and revolved volumes (tunnel networks) ────────────────────────

    def swept(
        self, name: str, points: list[tuple[float, float]], width: float,
        clearance: float, shape: str = "tube", extend: float = 0.3,
        shoulder: float = FLOOR_SHOULDER, base: float = 0.0,
    ) -> bpy.types.Object | None:
        """One continuous run of tunnel swept along a centreline.

        Mitred at every interior vertex. Built segment-by-segment as separate
        boxes the corridor came out scalloped: at every bend the two boxes'
        square corners stood proud of the wall outside and notched it inside,
        and the plan view read as a chain of blobs rather than a passage.
        """
        path = [
            point for index, point in enumerate(points)
            if index == 0
            or math.hypot(point[0] - points[index - 1][0],
                          point[1] - points[index - 1][1]) > 1e-6
        ]
        if len(path) < 2:
            return None
        # Overrun both ends so consecutive sections overlap. Two sweeps meeting
        # at a shared vertex touch on a coplanar cap, which is the one case an
        # exact boolean is entitled to get wrong.
        if extend > 0:
            head = unit(path[0], path[1])
            tail = unit(path[-2], path[-1])
            path.insert(0, (path[0][0] - head[0] * extend, path[0][1] - head[1] * extend))
            path.append((path[-1][0] + tail[0] * extend, path[-1][1] + tail[1] * extend))

        self.paths[name] = list(path)
        loop = section_loop(width / 2, clearance, shape, shoulder)
        count = len(loop)
        vertices: list[tuple[float, float, float]] = []
        for index, point in enumerate(path):
            if index == 0:
                direction = unit(path[0], path[1])
                scale = 1.0
            elif index == len(path) - 1:
                direction = unit(path[-2], path[-1])
                scale = 1.0
            else:
                incoming = unit(path[index - 1], path[index])
                outgoing = unit(path[index], path[index + 1])
                bisector = (incoming[0] + outgoing[0], incoming[1] + outgoing[1])
                length = math.hypot(*bisector)
                direction = incoming if length < 1e-6 else (bisector[0] / length, bisector[1] / length)
                normal = (-direction[1], direction[0])
                scale = 1.0 / max(MITRE_LIMIT, normal[0] * -incoming[1] + normal[1] * incoming[0])
            nx, ny = -direction[1], direction[0]
            for lateral, height in loop:
                vertices.append((
                    point[0] + nx * lateral * scale,
                    point[1] + ny * lateral * scale,
                    base + height,
                ))

        faces: list[tuple[int, ...]] = [
            tuple(reversed(range(count))),
            tuple(range(count * (len(path) - 1), count * len(path))),
        ]
        for ring in range(len(path) - 1):
            low, high = ring * count, (ring + 1) * count
            for index in range(count):
                nxt = (index + 1) % count
                faces.append((low + index, low + nxt, high + nxt, high + index))
        return self.mesh(name, vertices, faces)

    def chamber(
        self, name: str, centre: tuple[float, float], radius: float,
        clearance: float, shape: str = "tube", segments: int = 28,
        shoulder: float = FLOOR_SHOULDER, base: float = 0.0,
    ) -> bpy.types.Object:
        """The same section revolved: a domed chamber, an apse, or a bend joint."""
        profile = wall_profile(radius, clearance, shape, shoulder)
        ridged = crown_is_a_ridge(profile)
        rings = profile[:-1] if ridged else profile
        vertices: list[tuple[float, float, float]] = []
        for ring_radius, ring_height in rings:
            for index in range(segments):
                angle = math.tau * index / segments
                vertices.append((
                    centre[0] + math.cos(angle) * ring_radius,
                    centre[1] + math.sin(angle) * ring_radius,
                    base + ring_height,
                ))
        faces: list[tuple[int, ...]] = [tuple(reversed(range(segments)))]
        for level in range(len(rings) - 1):
            low, high = level * segments, (level + 1) * segments
            for index in range(segments):
                nxt = (index + 1) % segments
                faces.append((low + index, low + nxt, high + nxt, high + index))
        crown_ring = (len(rings) - 1) * segments
        if ridged:
            apex = len(vertices)
            vertices.append((centre[0], centre[1], base + profile[-1][1]))
            for index in range(segments):
                faces.append((crown_ring + index, crown_ring + (index + 1) % segments, apex))
        else:
            # Rings run counter-clockwise in plan, so the crown ring in order
            # faces up — the same n-gon the floor uses, wound the other way.
            faces.append(tuple(range(crown_ring, crown_ring + segments)))
        return self.mesh(name, vertices, faces)

    # ── stacked-ring volumes (measured rooms) ───────────────────────────────

    def prism(
        self, name: str, box: tuple[float, float, float, float],
        rings: list[tuple[float, object]], corner_radius: float = 1.2,
        corner_segments: int = 4, relief: float = 0.0, seed: float = 0.0,
    ) -> bpy.types.Object | None:
        """A stack of rounded-rectangle rings, capped top and bottom.

        `rings` runs bottom to top as (inset, height); height is a float or a
        callable (x, y) -> float so a ramped floor can carry its own slope. The
        inset shrinks the rectangle and grows the corner radius by the same
        amount, so a room that starts square at the floor closes round.
        """
        x0, y0, x1, y1 = box
        if x1 - x0 <= 0.01 or y1 - y0 <= 0.01:
            return None
        vertices: list[tuple[float, float, float]] = []
        count = 4 * (corner_segments + 1)
        for level, (inset, height) in enumerate(rings):
            ring = rounded_rect_ring(
                x0 + inset, y0 + inset, x1 - inset, y1 - inset,
                corner_radius + inset, corner_segments,
            )
            for index, (vx, vy) in enumerate(ring):
                # Relief only ever pushes rock AWAY, and only above the floor
                # ring, so the walked rectangle the plan promised is never
                # touched and no bulge can undercut a wall foot. A harmonic of
                # angle and ring index rather than raw noise, so consecutive
                # rings undulate together instead of shredding the wall.
                bulge = 0.0
                if relief > 0.0 and level > 0:
                    angle = math.atan2(vy - (y0 + y1) / 2, vx - (x0 + x1) / 2)
                    wave = 0.5 + 0.5 * math.sin(3.0 * angle + 1.7 * level + seed)
                    bulge = relief * wave
                distance = math.hypot(vx - (x0 + x1) / 2, vy - (y0 + y1) / 2)
                if bulge > 0.0 and distance > 1e-6:
                    vx += (vx - (x0 + x1) / 2) / distance * bulge
                    vy += (vy - (y0 + y1) / 2) / distance * bulge
                z = height(vx, vy) if callable(height) else height
                vertices.append((vx, vy, z))
        faces: list[tuple[int, ...]] = [tuple(reversed(range(count)))]
        for level in range(len(rings) - 1):
            low, high = level * count, (level + 1) * count
            for index in range(count):
                nxt = (index + 1) % count
                faces.append((low + index, low + nxt, high + nxt, high + index))
        top = (len(rings) - 1) * count
        faces.append(tuple(range(top, top + count)))
        return self.mesh(name, vertices, faces)

    def vault(
        self, name: str, box: tuple[float, float, float, float],
        floor, crown: float, shape: str = "dome", corner_radius: float = 1.2,
        expand: float = 0.0, corner_segments: int = 4, top_inset: float = 0.85,
        relief: float = 0.0, seed: float = 0.0,
    ) -> bpy.types.Object | None:
        """A measured rectangle raised into a vault.

        `floor` is a float or a callable (x, y) -> float, so a ramp carries its
        slope into the cut and the crown stays where the plan's ceiling was.
        The profile's lateral term drives an inward INSET rather than a lateral
        multiple: a rectangle has no single half-width, and shrinking the whole
        ring by one distance is what turns a long room into a barrel vault and a
        square one into a cloister vault, from the same numbers.

        `expand` grows the footprint before cutting. Neighbouring rooms in a
        measured plan share a face, and two volumes meeting on a coplanar face
        is the one case an exact boolean is entitled to get wrong — a hand's
        width of overlap makes the union unambiguous.
        """
        x0, y0, x1, y1 = box
        x0, y0, x1, y1 = x0 - expand, y0 - expand, x1 + expand, y1 + expand
        span = min(x1 - x0, y1 - y0)
        limit = span / 2 * top_inset

        def height_at(fraction: float):
            if callable(floor):
                return lambda vx, vy: floor(vx, vy) + fraction * (crown - floor(vx, vy))
            return floor + fraction * (crown - floor)

        rings = [
            ((1.0 - lateral) * limit, height_at(fraction))
            for lateral, fraction in WALL_PROFILES[shape]
        ]
        return self.prism(
            name, (x0, y0, x1, y1), rings, corner_radius, corner_segments,
            relief, seed,
        )

    def basin(
        self, name: str, box: tuple[float, float, float, float],
        floor: float, rim: float, corner_radius: float = 1.2,
        foot_inset: float = 0.35, corner_segments: int = 4,
        relief: float = 0.0, seed: float = 0.0,
    ) -> bpy.types.Object | None:
        """A trough cut down from a deck: pool, channel, or shelf.

        The rim sits ABOVE the deck the trough is cut into, so the basin and the
        room above it overlap in height instead of meeting on the deck plane.
        The bottom ring draws in slightly, so the rock rises to meet the edges
        of the floor slab that will sit in the trough rather than leaving a
        machined step all the way round.
        """
        depth = rim - floor
        if depth <= 0.05:
            return None
        shoulder = min(0.9, depth * 0.28)
        rings = [
            (foot_inset, floor),
            (0.0, floor + shoulder),
            (0.0, rim),
        ]
        return self.prism(
            name, box, rings, corner_radius, corner_segments, relief, seed,
        )

    # ── the cut ─────────────────────────────────────────────────────────────

    def subtract_from(self, rock: bpy.types.Object) -> dict:
        """Join every negative into one mesh and take it out of the rock."""
        if not self.parts:
            raise RuntimeError("Nothing to carve: the negative volume is empty.")
        bpy.ops.object.select_all(action="DESELECT")
        for part in self.parts:
            part.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]
        bpy.ops.object.join()
        void = bpy.context.view_layer.objects.active
        void.name = f"{self.collection.name}_Joined"
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")

        modifier = rock.modifiers.new("Carve", "BOOLEAN")
        modifier.operation = "DIFFERENCE"
        modifier.solver = "EXACT"
        modifier.use_self = True
        modifier.use_hole_tolerant = True
        modifier.object = void
        bpy.context.view_layer.objects.active = rock
        bpy.ops.object.modifier_apply(modifier="Carve")
        carved_faces = len(rock.data.polygons)
        if carved_faces <= 6:
            raise RuntimeError(
                f"The shell carve produced {carved_faces} faces: the boolean did not cut."
            )

        operands = len(self.parts)
        bpy.data.objects.remove(void, do_unlink=True)
        bpy.data.collections.remove(self.collection)
        self.parts = []

        bpy.context.view_layer.objects.active = rock
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=SCRAP_WELD)
        bpy.ops.mesh.dissolve_degenerate(threshold=SCRAP_WELD)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        return {
            "model": "carved",
            "object": rock.name,
            "carveOperands": operands,
            "carvedFaces": carved_faces,
            "cleanedFaces": len(rock.data.polygons),
        }
