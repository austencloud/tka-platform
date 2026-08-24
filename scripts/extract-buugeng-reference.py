"""Recover a clean, half-turn-symmetric Buugeng from the supplied flowgeng photo."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(
    r"C:\Users\Austen\AppData\Local\Temp\codex-clipboard-268d8175-cbcf-4680-b16b-ef2cd5650dad.png"
)
DEFAULT_OUTPUT = ROOT / "scripts" / "assets" / "buugeng-reference.svg"
DEFAULT_DATA = ROOT / "scripts" / "assets" / "buugeng-reference.json"
DEFAULT_DEBUG = ROOT / "scratchpad" / "buugeng-trace"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--debug-dir", type=Path, default=DEFAULT_DEBUG)
    return parser.parse_args()


def largest_component(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
    if count <= 1:
        raise RuntimeError("No light Buugeng body was found")
    selected = max(range(1, count), key=lambda index: stats[index, cv2.CC_STAT_AREA])
    body = np.where(labels == selected, 255, 0).astype(np.uint8)
    return body, stats[selected], centroids[selected]


def estimate_tangent(mask: np.ndarray, center_y: float) -> np.ndarray:
    samples = []
    radius = round(mask.shape[0] * 0.11)
    for y in range(max(0, round(center_y) - radius), min(mask.shape[0], round(center_y) + radius)):
        xs = np.where(mask[y] > 0)[0]
        if len(xs):
            samples.append((y, float(xs.mean())))
    if len(samples) < 8:
        raise RuntimeError("The Buugeng waist could not be measured")
    rows = np.asarray(samples, dtype=np.float64)
    slope, _ = np.polyfit(rows[:, 0], rows[:, 1], 1)
    tangent = np.asarray((slope, 1.0), dtype=np.float64)
    return tangent / np.linalg.norm(tangent)


def symmetrize_from_lower_half(
    body: np.ndarray, center: np.ndarray, tangent: np.ndarray
) -> np.ndarray:
    yy, xx = np.indices(body.shape)
    along = (xx - center[0]) * tangent[0] + (yy - center[1]) * tangent[1]
    lower = np.where(along >= -4.0, body, 0).astype(np.uint8)
    transform = cv2.getRotationMatrix2D(tuple(center), 180.0, 1.0)
    opposite = cv2.warpAffine(
        lower,
        transform,
        (body.shape[1], body.shape[0]),
        flags=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )
    symmetric = cv2.bitwise_or(lower, opposite)

    # The transparent source loses a few center pixels. Restore only the short
    # physical waist, using its measured direction and width, before tracing.
    waist_width = []
    for y in range(round(center[1]) - 36, round(center[1]) + 37):
        xs = np.where(body[y] > 0)[0]
        if len(xs):
            waist_width.append(xs.max() - xs.min() + 1)
    bridge_width = max(10, round(float(np.median(waist_width)) * 0.72))
    start = tuple(np.rint(center - tangent * 26.0).astype(int))
    end = tuple(np.rint(center + tangent * 26.0).astype(int))
    cv2.line(symmetric, start, end, 255, bridge_width, cv2.LINE_AA)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    return cv2.morphologyEx(symmetric, cv2.MORPH_CLOSE, kernel)


def signed_area(points: np.ndarray) -> float:
    following = np.roll(points, -1, axis=0)
    return float(
        np.sum(points[:, 0] * following[:, 1] - following[:, 0] * points[:, 1])
        * 0.5
    )


def ensure_winding(points: np.ndarray, clockwise: bool) -> np.ndarray:
    return points if (signed_area(points) < 0) == clockwise else points[::-1]


def resample_closed(points: np.ndarray, count: int) -> np.ndarray:
    source = points.astype(np.float64)
    following = np.roll(source, -1, axis=0)
    lengths = np.linalg.norm(following - source, axis=1)
    perimeter = float(lengths.sum())
    cumulative = np.concatenate(([0.0], np.cumsum(lengths)))
    result = []
    for distance in np.linspace(0.0, perimeter, count, endpoint=False):
        segment = min(
            int(np.searchsorted(cumulative, distance, side="right") - 1),
            len(source) - 1,
        )
        unit = (distance - cumulative[segment]) / max(lengths[segment], 1e-9)
        result.append(source[segment] + (following[segment] - source[segment]) * unit)
    return np.asarray(result)


def smooth_closed(points: np.ndarray, rounds: int) -> np.ndarray:
    result = points.astype(np.float64)
    for _ in range(rounds):
        result = (
            np.roll(result, 2, axis=0)
            + 4.0 * np.roll(result, 1, axis=0)
            + 6.0 * result
            + 4.0 * np.roll(result, -1, axis=0)
            + np.roll(result, -2, axis=0)
        ) / 16.0
    return result


def clean_outer(points: np.ndarray, center: np.ndarray) -> tuple[np.ndarray, set[int]]:
    relative = points.astype(np.float64) - center
    radii = np.linalg.norm(relative, axis=1)
    first_tip = int(np.argmax(radii))
    first_vector = relative[first_tip]
    opposite_scores = np.linalg.norm(relative + first_vector, axis=1)
    second_tip = int(np.argmin(opposite_scores))
    original_tips = points[[first_tip, second_tip]].astype(np.float64)

    cleaned = smooth_closed(resample_closed(points, 280), 2)
    sharp: set[int] = set()
    for tip in original_tips:
        index = int(np.argmin(np.linalg.norm(cleaned - tip, axis=1)))
        cleaned[index] = tip
        sharp.add(index)
    return cleaned, sharp


def path_data(
    points: np.ndarray, offset: np.ndarray, *, sharp: set[int] | None = None
) -> str:
    shifted = points.astype(np.float64) - offset
    sharp = sharp or set()
    commands = [f"M {shifted[0, 0]:.3f} {shifted[0, 1]:.3f}"]
    count = len(shifted)
    for index in range(count):
        following = (index + 1) % count
        previous = (index - 1) % count
        after = (index + 2) % count
        start = shifted[index]
        end = shifted[following]
        control_a = (
            start
            if index in sharp
            else start + (end - shifted[previous]) * (0.68 / 6.0)
        )
        control_b = (
            end
            if following in sharp
            else end - (shifted[after] - start) * (0.68 / 6.0)
        )
        commands.append(
            "C "
            f"{control_a[0]:.3f} {control_a[1]:.3f} "
            f"{control_b[0]:.3f} {control_b[1]:.3f} "
            f"{end[0]:.3f} {end[1]:.3f}"
        )
    commands.append("Z")
    return " ".join(commands)


def trace_contours(
    mask: np.ndarray, center: np.ndarray
) -> tuple[np.ndarray, set[int], list[np.ndarray]]:
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hierarchy is None:
        raise RuntimeError("The symmetric Buugeng has no contour hierarchy")
    outer_index = max(
        range(len(contours)), key=lambda index: cv2.contourArea(contours[index])
    )
    outer_raw = cv2.approxPolyDP(contours[outer_index], 1.0, True)[:, 0, :]
    outer_raw = ensure_winding(outer_raw, clockwise=False)
    outer, sharp = clean_outer(outer_raw, center)

    holes = []
    child = hierarchy[0][outer_index][2]
    while child >= 0:
        area = cv2.contourArea(contours[child])
        if area >= 70.0:
            raw = cv2.approxPolyDP(contours[child], 0.8, True)[:, 0, :]
            count = max(18, min(40, round(cv2.arcLength(contours[child], True) / 5.0)))
            hole = smooth_closed(resample_closed(raw, count), 1)
            holes.append(ensure_winding(hole, clockwise=True))
        child = hierarchy[0][child][0]
    holes.sort(key=lambda points: float(points[:, 1].mean()))
    return outer, sharp, holes


def cross_section_width(
    mask: np.ndarray, center: np.ndarray, tangent: np.ndarray
) -> int:
    normal = np.asarray((-tangent[1], tangent[0]))
    samples = []
    for distance in range(-60, 61):
        point = np.rint(center + normal * distance).astype(int)
        if 0 <= point[0] < mask.shape[1] and 0 <= point[1] < mask.shape[0]:
            samples.append(mask[point[1], point[0]] > 0)
    longest = current = 0
    for active in samples:
        current = current + 1 if active else 0
        longest = max(longest, current)
    return longest


def main() -> None:
    args = parse_args()
    source = cv2.imread(str(args.source.resolve()), cv2.IMREAD_COLOR)
    if source is None:
        raise FileNotFoundError(args.source)
    gray = cv2.cvtColor(source, cv2.COLOR_BGR2GRAY)
    raw = np.where(gray > 180, 255, 0).astype(np.uint8)
    body, stats, centroid = largest_component(raw)
    x, y, width, height, _ = map(int, stats)
    padding = 15
    crop_origin = np.asarray((x - padding, y - padding), dtype=np.float64)
    cropped_source = source[y - padding : y + height + padding, x - padding : x + width + padding]
    cropped_body = body[y - padding : y + height + padding, x - padding : x + width + padding]

    center = np.asarray(
        (centroid[0] - crop_origin[0], (cropped_body.shape[0] - 1) * 0.5),
        dtype=np.float64,
    )
    tangent = estimate_tangent(cropped_body, center[1])
    symmetric = symmetrize_from_lower_half(cropped_body, center, tangent)
    outer, sharp, holes = trace_contours(symmetric, center)
    if len(holes) != 10:
        raise RuntimeError(f"Expected ten flowgeng slots, found {len(holes)}")

    minimum = outer.min(axis=0)
    maximum = outer.max(axis=0)
    svg_padding = 8.0
    offset = minimum - svg_padding
    svg_width, svg_height = maximum - minimum + svg_padding * 2.0
    path = path_data(outer, offset, sharp=sharp)
    path += " " + " ".join(path_data(hole, offset) for hole in holes)

    args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.output.resolve().write_text(
        "\n".join(
            (
                '<?xml version="1.0" encoding="UTF-8"?>',
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_width:.3f} {svg_height:.3f}">',
                f'  <path d="{path}" fill="#2e3191" fill-rule="evenodd"/>',
                "</svg>",
            )
        ),
        encoding="utf-8",
    )

    span_pixels = float(maximum[1] - minimum[1])
    waist_pixels = cross_section_width(symmetric, center, tangent)
    data = {
        "source": str(args.source.resolve()),
        "sourceComponentBounds": [x, y, width, height],
        "symmetryCenterPx": [round(float(center[0]), 3), round(float(center[1]), 3)],
        "tangent": [round(float(value), 6) for value in tangent],
        "spanPx": round(span_pixels, 3),
        "widthPx": round(float(maximum[0] - minimum[0]), 3),
        "waistWidthPx": waist_pixels,
        "slotCount": len(holes),
        "symmetryMethod": "lower reference half rotated 180 degrees",
    }
    args.data.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.data.resolve().write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    debug_dir = args.debug_dir.resolve()
    debug_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(debug_dir / "01-source-component.png"), cropped_source)
    cv2.imwrite(str(debug_dir / "02-source-mask.png"), cropped_body)
    cv2.imwrite(str(debug_dir / "03-symmetric-mask.png"), symmetric)
    overlay = cropped_source.copy()
    cv2.drawContours(overlay, [np.rint(outer).astype(np.int32)], -1, (0, 0, 255), 2)
    for hole in holes:
        cv2.drawContours(
            overlay, [np.rint(hole).astype(np.int32)], -1, (255, 80, 0), 2
        )
    cv2.imwrite(str(debug_dir / "04-trace-overlay.png"), overlay)

    print(f"BUUGENG_REFERENCE_SVG={args.output.resolve()}")
    print(f"BUUGENG_REFERENCE_DATA={args.data.resolve()}")
    print(f"BUUGENG_REFERENCE_SPAN_PX={span_pixels:.3f}")
    print(f"BUUGENG_REFERENCE_WIDTH_PX={maximum[0] - minimum[0]:.3f}")
    print(f"BUUGENG_REFERENCE_WAIST_PX={waist_pixels}")
    print(f"BUUGENG_REFERENCE_SLOTS={len(holes)}")


if __name__ == "__main__":
    main()
