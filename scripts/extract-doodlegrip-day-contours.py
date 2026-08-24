"""Trace a DoodleGrip practice fan from a user-supplied product image.

The source image is a front-on white fan on black. We isolate its largest
connected white component, walk every pixel boundary, simplify the resulting
loops without changing their topology, and normalize the geometry around the
centre of the finger opening. The output is stable JSON consumed by Blender's
fan builder, plus an optional SVG that makes the trace easy to audit.

Usage:
  python scripts/extract-doodlegrip-day-contours.py \
    --input path/to/reference.png \
    --output scripts/assets/doodlegrip-day-contours.json \
    --preview scratchpad/fan-review/doodlegrip-trace.svg
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

from PIL import Image


DAY_WIDTH_M = 0.51
DAY_HEIGHT_M = 0.35
DEFAULT_RING_DIAMETER_M = 0.044
DEFAULT_CROP = (300, 120, 1170, 740)


Point = tuple[int, int]
Edge = tuple[Point, Point]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--threshold", type=int, default=150)
    parser.add_argument("--simplify", type=float, default=1.6)
    parser.add_argument(
        "--crop",
        type=int,
        nargs=4,
        default=DEFAULT_CROP,
        metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"),
    )
    return parser.parse_args()


def largest_component(
    image: Image.Image, crop: tuple[int, int, int, int], threshold: int
) -> set[Point]:
    left, top, right, bottom = crop
    foreground = {
        (x, y)
        for y in range(top, bottom)
        for x in range(left, right)
        if image.getpixel((x, y)) >= threshold
    }
    seen: set[Point] = set()
    components: list[set[Point]] = []
    for seed in foreground:
        if seed in seen:
            continue
        component = {seed}
        seen.add(seed)
        stack = [seed]
        while stack:
            x, y = stack.pop()
            for neighbour in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if neighbour in foreground and neighbour not in seen:
                    seen.add(neighbour)
                    component.add(neighbour)
                    stack.append(neighbour)
        components.append(component)
    if not components:
        raise ValueError("No light foreground component was found in the crop")
    return max(components, key=len)


def boundary_loops(component: set[Point]) -> list[list[Point]]:
    edges: list[Edge] = []
    for x, y in component:
        if (x, y - 1) not in component:
            edges.append(((x, y), (x + 1, y)))
        if (x + 1, y) not in component:
            edges.append(((x + 1, y), (x + 1, y + 1)))
        if (x, y + 1) not in component:
            edges.append(((x + 1, y + 1), (x, y + 1)))
        if (x - 1, y) not in component:
            edges.append(((x, y + 1), (x, y)))

    next_points: dict[Point, list[Point]] = defaultdict(list)
    for start, end in edges:
        next_points[start].append(end)
    unused = set(edges)
    loops: list[list[Point]] = []
    while unused:
        edge = next(iter(unused))
        start = edge[0]
        points = [start]
        while edge in unused:
            unused.remove(edge)
            points.append(edge[1])
            if edge[1] == start:
                break
            candidates = [
                (edge[1], end)
                for end in next_points[edge[1]]
                if (edge[1], end) in unused
            ]
            if not candidates:
                break
            edge = candidates[0]
        if points[-1] == start and len(points) > 8:
            loops.append(points[:-1])
    return loops


def signed_area(points: list[Point] | list[tuple[float, float]]) -> float:
    return sum(
        points[index][0] * points[(index + 1) % len(points)][1]
        - points[(index + 1) % len(points)][0] * points[index][1]
        for index in range(len(points))
    ) / 2


def point_line_distance(point: Point, start: Point, end: Point) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx == 0 and dy == 0:
        return math.dist(point, start)
    return abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / math.hypot(dx, dy)


def simplify_open(points: list[Point], tolerance: float) -> list[Point]:
    if len(points) <= 2:
        return points
    farthest_index = 0
    farthest_distance = 0.0
    for index, point in enumerate(points[1:-1], start=1):
        distance = point_line_distance(point, points[0], points[-1])
        if distance > farthest_distance:
            farthest_index = index
            farthest_distance = distance
    if farthest_distance <= tolerance:
        return [points[0], points[-1]]
    left = simplify_open(points[: farthest_index + 1], tolerance)
    right = simplify_open(points[farthest_index:], tolerance)
    return left[:-1] + right


def simplify_closed(points: list[Point], tolerance: float) -> list[Point]:
    anchor = min(range(len(points)), key=lambda index: points[index])
    rotated = points[anchor:] + points[:anchor]
    opposite = max(
        range(1, len(rotated)),
        key=lambda index: math.dist(rotated[0], rotated[index]),
    )
    first = simplify_open(rotated[: opposite + 1], tolerance)
    second = simplify_open(rotated[opposite:] + [rotated[0]], tolerance)
    return first[:-1] + second[:-1]


def centroid(points: list[Point]) -> tuple[float, float]:
    area = signed_area(points)
    factor = 1 / (6 * area)
    x = sum(
        (points[index][0] + points[(index + 1) % len(points)][0])
        * (
            points[index][0] * points[(index + 1) % len(points)][1]
            - points[(index + 1) % len(points)][0] * points[index][1]
        )
        for index in range(len(points))
    ) * factor
    y = sum(
        (points[index][1] + points[(index + 1) % len(points)][1])
        * (
            points[index][0] * points[(index + 1) % len(points)][1]
            - points[(index + 1) % len(points)][0] * points[index][1]
        )
        for index in range(len(points))
    ) * factor
    return x, y


def resample_open(
    points: list[tuple[float, float]], count: int
) -> list[tuple[float, float]]:
    lengths = [math.dist(points[index], points[index + 1]) for index in range(len(points) - 1)]
    total = sum(lengths)
    targets = [total * index / (count - 1) for index in range(count)]
    result: list[tuple[float, float]] = []
    segment = 0
    travelled = 0.0
    for target in targets:
        while segment < len(lengths) - 1 and travelled + lengths[segment] < target:
            travelled += lengths[segment]
            segment += 1
        distance = lengths[segment]
        ratio = 0.0 if distance == 0 else (target - travelled) / distance
        start = points[segment]
        end = points[segment + 1]
        result.append(
            (
                start[0] + (end[0] - start[0]) * ratio,
                start[1] + (end[1] - start[1]) * ratio,
            )
        )
    return result


def resample_closed(
    points: list[tuple[float, float]], count: int
) -> list[tuple[float, float]]:
    return resample_open([*points, points[0]], count + 1)[:-1]


def smooth_open(
    points: list[tuple[float, float]],
    *,
    passes: int = 5,
    strength: float = 0.2,
) -> list[tuple[float, float]]:
    """Remove raster wobble while retaining the measured end points."""
    result = list(points)
    for _ in range(passes):
        previous = result
        result = [previous[0]]
        for index in range(1, len(previous) - 1):
            neighbour_x = (previous[index - 1][0] + previous[index + 1][0]) / 2
            neighbour_y = (previous[index - 1][1] + previous[index + 1][1]) / 2
            result.append(
                (
                    previous[index][0] * (1 - strength) + neighbour_x * strength,
                    previous[index][1] * (1 - strength) + neighbour_y * strength,
                )
            )
        result.append(previous[-1])
    return result


def smooth_closed(
    points: list[tuple[float, float]],
    *,
    passes: int = 4,
    strength: float = 0.2,
) -> list[tuple[float, float]]:
    """Apply a restrained periodic fairing pass to one cut-through opening."""
    result = list(points)
    for _ in range(passes):
        previous = result
        result = []
        for index, point in enumerate(previous):
            neighbour_x = (
                previous[index - 1][0] + previous[(index + 1) % len(previous)][0]
            ) / 2
            neighbour_y = (
                previous[index - 1][1] + previous[(index + 1) % len(previous)][1]
            ) / 2
            result.append(
                (
                    point[0] * (1 - strength) + neighbour_x * strength,
                    point[1] * (1 - strength) + neighbour_y * strength,
                )
            )
    return result


def point_segment_distance(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length_squared = dx * dx + dy * dy
    if length_squared == 0:
        return math.dist(point, start)
    projection = (
        (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
    ) / length_squared
    projection = max(0.0, min(1.0, projection))
    closest = (start[0] + projection * dx, start[1] + projection * dy)
    return math.dist(point, closest)


def contour_distance(
    first: list[list[float]], second: list[list[float]]
) -> float:
    first_points = [tuple(point) for point in first]
    second_points = [tuple(point) for point in second]
    minimum = math.inf
    for index, point in enumerate(first_points):
        first_next = first_points[(index + 1) % len(first_points)]
        for other_index, other_point in enumerate(second_points):
            second_next = second_points[(other_index + 1) % len(second_points)]
            minimum = min(
                minimum,
                point_segment_distance(point, other_point, second_next),
                point_segment_distance(other_point, point, first_next),
            )
    return minimum


def minimum_web_thickness(
    outline: list[list[float]], holes: list[list[list[float]]]
) -> float:
    clearances = [contour_distance(outline, hole) for hole in holes]
    clearances.extend(
        contour_distance(holes[first], holes[second])
        for first in range(len(holes))
        for second in range(first + 1, len(holes))
    )
    return min(clearances)


def align_closed(
    reference: list[tuple[float, float]],
    candidate: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    if signed_area(reference) * signed_area(candidate) < 0:
        candidate = list(reversed(candidate))
    best_shift = min(
        range(len(candidate)),
        key=lambda shift: sum(
            math.dist(reference[index], candidate[(index + shift) % len(candidate)]) ** 2
            for index in range(len(reference))
        ),
    )
    return [candidate[(index + best_shift) % len(candidate)] for index in range(len(candidate))]


def symmetrize_outline(
    outline: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    top = max(range(len(outline)), key=lambda index: outline[index][1])
    bottom = min(range(len(outline)), key=lambda index: outline[index][1])

    def forward(start: int, end: int) -> list[tuple[float, float]]:
        result = [outline[start]]
        index = start
        while index != end:
            index = (index + 1) % len(outline)
            result.append(outline[index])
        return result

    first = forward(top, bottom)
    second = list(reversed(forward(bottom, top)))
    left, right = (first, second) if sum(x for x, _ in first) < 0 else (second, first)
    sample_count = max(72, len(outline))
    left_sample = resample_open(left, sample_count)
    right_sample = resample_open(right, sample_count)
    averaged_left = [
        ((left_point[0] - right_point[0]) / 2, (left_point[1] + right_point[1]) / 2)
        for left_point, right_point in zip(left_sample, right_sample)
    ]
    averaged_left[0] = (0.0, averaged_left[0][1])
    averaged_left[-1] = (0.0, averaged_left[-1][1])
    averaged_left = smooth_open(averaged_left)
    averaged_right = [(-x, y) for x, y in reversed(averaged_left[1:-1])]
    return [*averaged_left, *averaged_right]


def symmetrize_pair(
    left: list[tuple[float, float]],
    right: list[tuple[float, float]],
) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    count = max(32, len(left) * 2, len(right) * 2)
    left_sample = resample_closed(left, count)
    mirrored_right = [(-x, y) for x, y in resample_closed(right, count)]
    mirrored_right = align_closed(left_sample, mirrored_right)
    averaged_left = [
        ((left_point[0] + right_point[0]) / 2, (left_point[1] + right_point[1]) / 2)
        for left_point, right_point in zip(left_sample, mirrored_right)
    ]
    averaged_left = smooth_closed(averaged_left)
    averaged_right = [(-x, y) for x, y in reversed(averaged_left)]
    return averaged_left, averaged_right


def symmetrize_and_calibrate(data: dict[str, object]) -> dict[str, object]:
    outline = [tuple(point) for point in data["outline"]]
    holes = [[tuple(point) for point in contour] for contour in data["holes"]]
    outline = symmetrize_outline(outline)

    centres = [centroid(hole) for hole in holes]
    left_indices = [index for index, centre in enumerate(centres) if centre[0] < -0.006]
    right_indices = [index for index, centre in enumerate(centres) if centre[0] > 0.006]
    if len(left_indices) != 8 or len(right_indices) != 8:
        raise ValueError("Expected eight mirrored cutout pairs around the finger opening")

    pairs: list[tuple[list[tuple[float, float]], list[tuple[float, float]]]] = []
    unused_right = set(right_indices)
    for left_index in sorted(left_indices, key=lambda index: (-centres[index][1], centres[index][0])):
        left_centre = centres[left_index]
        left_area = abs(signed_area(holes[left_index]))
        right_index = min(
            unused_right,
            key=lambda index: (
                abs(abs(left_centre[0]) - centres[index][0])
                + abs(left_centre[1] - centres[index][1])
                + abs(left_area - abs(signed_area(holes[index]))) * 4
            ),
        )
        unused_right.remove(right_index)
        pairs.append(symmetrize_pair(holes[left_index], holes[right_index]))

    symmetric_holes = [contour for pair in pairs for contour in pair]
    min_x = min(x for x, _ in outline)
    max_x = max(x for x, _ in outline)
    min_y = min(y for _, y in outline)
    max_y = max(y for _, y in outline)
    scale_x = DAY_WIDTH_M / (max_x - min_x)
    scale_y = DAY_HEIGHT_M / (max_y - min_y)

    def calibrate(contour: list[tuple[float, float]]) -> list[list[float]]:
        return [[round(x * scale_x, 7), round(y * scale_y, 7)] for x, y in contour]

    ring_radius = DEFAULT_RING_DIAMETER_M / 2
    ring = [
        [
            round(ring_radius * math.cos(math.tau * index / 64), 7),
            round(ring_radius * math.sin(math.tau * index / 64), 7),
        ]
        for index in range(64)
    ]
    calibrated_outline = calibrate(outline)
    calibrated_holes = [calibrate(hole) for hole in symmetric_holes]
    calibrated_holes.append(ring)
    minimum_web_m = minimum_web_thickness(calibrated_outline, calibrated_holes)
    data.update(
        {
            "outline": calibrated_outline,
            "holes": calibrated_holes,
            "width_m": DAY_WIDTH_M,
            "height_m": DAY_HEIGHT_M,
            "ring_diameter_m": DEFAULT_RING_DIAMETER_M,
            "symmetry": "bilateral average of eight left/right cutout pairs",
            "curve_cleanup": "uniform resampling plus restrained periodic fairing",
            "minimum_web_m": round(minimum_web_m, 7),
            "official_dimensions_source": "https://flowtoys.com/products/doodlegrip-practice-fans",
        }
    )
    return data


def normalize_contours(loops: list[list[Point]]) -> dict[str, object]:
    ordered = sorted(loops, key=lambda loop: abs(signed_area(loop)), reverse=True)
    outline = ordered[0]
    holes = ordered[1:]
    min_x = min(point[0] for point in outline)
    max_x = max(point[0] for point in outline)
    min_y = min(point[1] for point in outline)
    max_y = max(point[1] for point in outline)
    centre_x = (min_x + max_x) / 2
    pivot_candidates = [
        hole
        for hole in holes
        if abs(centroid(hole)[0] - centre_x) < (max_x - min_x) * 0.08
        and centroid(hole)[1] > min_y + (max_y - min_y) * 0.65
    ]
    if not pivot_candidates:
        raise ValueError("Could not identify the central finger opening")
    pivot = max(pivot_candidates, key=lambda hole: abs(signed_area(hole)))
    pivot_x, pivot_y = centroid(pivot)
    scale = DAY_WIDTH_M / (max_x - min_x)

    def transform(loop: list[Point]) -> list[list[float]]:
        return [
            [round((x - pivot_x) * scale, 7), round((pivot_y - y) * scale, 7)]
            for x, y in loop
        ]

    return {
        "width_m": DAY_WIDTH_M,
        "height_m": round((max_y - min_y) * scale, 7),
        "pivot_px": [round(pivot_x, 3), round(pivot_y, 3)],
        "source_bounds_px": [min_x, min_y, max_x, max_y],
        "outline": transform(outline),
        "holes": [transform(hole) for hole in holes],
    }


def write_preview(path: Path, data: dict[str, object]) -> None:
    contours = [data["outline"], *data["holes"]]
    points = [point for contour in contours for point in contour]
    min_x = min(point[0] for point in points)
    max_x = max(point[0] for point in points)
    min_y = min(point[1] for point in points)
    max_y = max(point[1] for point in points)
    scale = 1500 / (max_x - min_x)
    margin = 60

    def path_data(contour: list[list[float]]) -> str:
        commands = []
        for index, (x, y) in enumerate(contour):
            px = margin + (x - min_x) * scale
            py = margin + (max_y - y) * scale
            commands.append(f"{'M' if index == 0 else 'L'}{px:.2f},{py:.2f}")
        return " ".join(commands) + " Z"

    path_data_all = " ".join(path_data(contour) for contour in contours)
    width = round((max_x - min_x) * scale + margin * 2)
    height = round((max_y - min_y) * scale + margin * 2)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="#000"/>'
        f'<path d="{path_data_all}" fill="#fff" fill-rule="evenodd"/></svg>'
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg, encoding="utf-8")


def main() -> None:
    args = parse_args()
    image = Image.open(args.input).convert("L")
    component = largest_component(image, tuple(args.crop), args.threshold)
    raw_loops = boundary_loops(component)
    simplified = [simplify_closed(loop, args.simplify) for loop in raw_loops]
    data = symmetrize_and_calibrate(normalize_contours(simplified))
    document = {
        "source": "user-supplied Flowtoys DoodleGrip white product image, upper fan",
        "threshold": args.threshold,
        "crop_px": args.crop,
        "simplification_tolerance_px": args.simplify,
        "foreground_pixels": len(component),
        "contour_count": len(simplified),
        **data,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    if args.preview:
        write_preview(args.preview, document)
    print(f"DOODLEGRIP_CONTOURS={len(simplified)}")
    print(f"DOODLEGRIP_HOLES={len(simplified) - 1}")
    calibrated_point_count = len(document["outline"]) + sum(
        len(hole) for hole in document["holes"]
    )
    print(f"DOODLEGRIP_POINTS={calibrated_point_count}")
    print(f"DOODLEGRIP_SIZE_M={document['width_m']},{document['height_m']}")
    print(f"DOODLEGRIP_PIVOT_PX={document['pivot_px']}")


if __name__ == "__main__":
    main()
