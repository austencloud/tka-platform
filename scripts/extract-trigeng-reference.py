"""Recover a threefold-symmetric Trigeng silhouette from the supplied CAD render.

The source is a screenshot rather than an original vector. This extractor
isolates the largest connected manufactured body, locates its enclosed grip
hole, and combines the source with copies rotated by 120 and 240 degrees. A
two-of-three vote removes screenshot skew while preserving the real blade and
junction proportions.

Usage:
  PYTHONPATH=scratchpad/trigeng-trace-deps python \
    scripts/extract-trigeng-reference.py --source <screenshot.png>
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "scripts" / "assets" / "trigeng-reference.svg"
DEFAULT_DATA = ROOT / "scripts" / "assets" / "trigeng-reference.json"
DEFAULT_DEBUG = ROOT / "scratchpad" / "trigeng-trace"

# The screenshot's white product-card image, excluding Cults UI and the camera
# glyph. These coordinates are stable for the supplied 1227x1536 capture.
SOURCE_CROP = (51, 149, 1203, 1052)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--debug-dir", type=Path, default=DEFAULT_DEBUG)
    return parser.parse_args()


def largest_component(mask: np.ndarray) -> np.ndarray:
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if count <= 1:
        raise RuntimeError("No Trigeng body was found in the source image")
    # Ignore any component touching the crop edge and retain the dominant body.
    candidates = []
    height, width = mask.shape
    for label in range(1, count):
        x, y, w, h, area = stats[label]
        touches_edge = x == 0 or y == 0 or x + w == width or y + h == height
        if not touches_edge:
            candidates.append((area, label))
    if not candidates:
        raise RuntimeError("Every dark component touches the crop edge")
    _, selected = max(candidates)
    return np.where(labels == selected, 255, 0).astype(np.uint8)


def find_grip_center(mask: np.ndarray) -> tuple[float, float, float]:
    contours, hierarchy = cv2.findContours(
        mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE
    )
    if hierarchy is None:
        raise RuntimeError("The Trigeng contour hierarchy is empty")
    outer_index = max(range(len(contours)), key=lambda index: cv2.contourArea(contours[index]))
    child = hierarchy[0][outer_index][2]
    holes = []
    while child >= 0:
        area = cv2.contourArea(contours[child])
        if area > 40:
            moments = cv2.moments(contours[child])
            if moments["m00"]:
                center = (
                    moments["m10"] / moments["m00"],
                    moments["m01"] / moments["m00"],
                )
                holes.append((area, center, contours[child]))
        child = hierarchy[0][child][0]
    if not holes:
        raise RuntimeError("The enclosed Trigeng grip hole was not found")

    # The center grip is the only substantial enclosed white island.
    area, center, contour = max(holes, key=lambda item: item[0])
    (_, _), radius = cv2.minEnclosingCircle(contour)
    return center[0], center[1], radius


def rotate_about(
    mask: np.ndarray, center: tuple[float, float], degrees: float
) -> np.ndarray:
    transform = cv2.getRotationMatrix2D(center, degrees, 1.0)
    return cv2.warpAffine(
        mask,
        transform,
        (mask.shape[1], mask.shape[0]),
        flags=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )


def contour_points(mask: np.ndarray) -> tuple[np.ndarray, list[np.ndarray]]:
    contours, hierarchy = cv2.findContours(
        mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE
    )
    if hierarchy is None:
        raise RuntimeError("The symmetrized Trigeng has no contours")
    outer_index = max(range(len(contours)), key=lambda index: cv2.contourArea(contours[index]))
    outer = cv2.approxPolyDP(contours[outer_index], 1.15, True)[:, 0, :]
    holes = []
    child = hierarchy[0][outer_index][2]
    while child >= 0:
        if cv2.contourArea(contours[child]) > 40:
            holes.append(cv2.approxPolyDP(contours[child], 0.8, True)[:, 0, :])
        child = hierarchy[0][child][0]
    return outer, holes


def signed_area(points: np.ndarray) -> float:
    shifted = np.roll(points, -1, axis=0)
    return float(np.sum(points[:, 0] * shifted[:, 1] - shifted[:, 0] * points[:, 1]) * 0.5)


def ensure_winding(points: np.ndarray, clockwise: bool) -> np.ndarray:
    is_clockwise = signed_area(points) < 0
    return points if is_clockwise == clockwise else points[::-1]


def resample_closed(points: np.ndarray, count: int) -> np.ndarray:
    source = points.astype(np.float64)
    following = np.roll(source, -1, axis=0)
    lengths = np.linalg.norm(following - source, axis=1)
    perimeter = float(lengths.sum())
    cumulative = np.concatenate(([0.0], np.cumsum(lengths)))
    samples = np.linspace(0.0, perimeter, count, endpoint=False)
    result = []
    for distance in samples:
        segment = min(int(np.searchsorted(cumulative, distance, side="right") - 1), len(source) - 1)
        unit = (distance - cumulative[segment]) / max(lengths[segment], 1e-9)
        result.append(source[segment] + (following[segment] - source[segment]) * unit)
    return np.asarray(result)


def smooth_closed(points: np.ndarray, rounds: int = 2) -> np.ndarray:
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


def clean_outer_contour(
    points: np.ndarray, center: tuple[float, float]
) -> tuple[np.ndarray, set[int]]:
    original_tip_indices = tip_indices(points, center)
    original_tips = points[list(original_tip_indices)].astype(np.float64)
    cleaned = smooth_closed(resample_closed(points, 240))
    cleaned_tip_indices: set[int] = set()
    for tip in original_tips:
        index = int(np.argmin(np.linalg.norm(cleaned - tip, axis=1)))
        cleaned[index] = tip
        cleaned_tip_indices.add(index)
    return cleaned, cleaned_tip_indices


def tip_indices(points: np.ndarray, center: tuple[float, float]) -> set[int]:
    relative = points.astype(np.float64) - np.asarray(center, dtype=np.float64)
    radii = np.linalg.norm(relative, axis=1)
    angles = np.arctan2(relative[:, 1], relative[:, 0])
    anchor = angles[int(np.argmax(radii))]
    tips: set[int] = set()
    for blade in range(3):
        target = anchor + blade * np.pi * 2.0 / 3.0
        delta = np.abs(np.angle(np.exp(1j * (angles - target))))
        candidates = np.where(delta < np.deg2rad(42.0))[0]
        tips.add(int(candidates[np.argmax(radii[candidates])]))
    return tips


def path_data(
    points: np.ndarray,
    offset: tuple[float, float],
    *,
    sharp: set[int] | None = None,
) -> str:
    shifted = points.astype(np.float64) - np.asarray(offset, dtype=np.float64)
    sharp = sharp or set()
    commands = [f"M {shifted[0, 0]:.3f} {shifted[0, 1]:.3f}"]
    count = len(shifted)
    for index in range(count):
        next_index = (index + 1) % count
        previous_index = (index - 1) % count
        after_index = (index + 2) % count
        start = shifted[index]
        end = shifted[next_index]
        # Cubic Catmull-Rom handles remove pixel stair-steps from the screenshot
        # trace. The three blade apices stay hard corners like the CAD source.
        control_a = (
            start
            if index in sharp
            else start + (end - shifted[previous_index]) * (0.68 / 6.0)
        )
        control_b = (
            end
            if next_index in sharp
            else end - (shifted[after_index] - start) * (0.68 / 6.0)
        )
        commands.append(
            "C "
            f"{control_a[0]:.3f} {control_a[1]:.3f} "
            f"{control_b[0]:.3f} {control_b[1]:.3f} "
            f"{end[0]:.3f} {end[1]:.3f}"
        )
    commands.append("Z")
    return " ".join(commands)


def main() -> None:
    args = parse_args()
    source = cv2.imread(str(args.source.resolve()), cv2.IMREAD_COLOR)
    if source is None:
        raise FileNotFoundError(args.source)
    x0, y0, x1, y1 = SOURCE_CROP
    crop = source[y0:y1, x0:x1]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # All rendered plastic is below this threshold; the card background is
    # near-white. A small close joins antialiased seams without swelling tips.
    raw = np.where(gray < 242, 255, 0).astype(np.uint8)
    raw = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    body = largest_component(raw)
    center_x, center_y, source_hole_radius = find_grip_center(body)
    center = (center_x, center_y)

    rotated_120 = rotate_about(body, center, 120.0)
    rotated_240 = rotate_about(body, center, 240.0)
    votes = (
        (body > 0).astype(np.uint8)
        + (rotated_120 > 0).astype(np.uint8)
        + (rotated_240 > 0).astype(np.uint8)
    )
    symmetric = np.where(votes >= 2, 255, 0).astype(np.uint8)
    symmetric = cv2.GaussianBlur(symmetric, (3, 3), 0.65)
    symmetric = np.where(symmetric >= 128, 255, 0).astype(np.uint8)

    outer, holes = contour_points(symmetric)
    if len(holes) != 1:
        raise RuntimeError(f"Expected one center hole after symmetry, found {len(holes)}")
    outer = ensure_winding(outer, clockwise=False)
    outer, outer_tip_indices = clean_outer_contour(outer, center)
    traced_hole = holes[0].astype(np.float64)
    hole_center = traced_hole.mean(axis=0)
    hole_radius = np.linalg.norm(traced_hole - hole_center, axis=1).mean()
    hole_angles = np.linspace(0.0, -np.pi * 2.0, 48, endpoint=False)
    hole = np.column_stack(
        (
            hole_center[0] + np.cos(hole_angles) * hole_radius,
            hole_center[1] + np.sin(hole_angles) * hole_radius,
        )
    )

    minimum = outer.min(axis=0).astype(float)
    maximum = outer.max(axis=0).astype(float)
    padding = 8.0
    offset = (minimum[0] - padding, minimum[1] - padding)
    width = maximum[0] - minimum[0] + padding * 2.0
    height = maximum[1] - minimum[1] + padding * 2.0
    combined_path = (
        f"{path_data(outer, offset, sharp=outer_tip_indices)} "
        f"{path_data(hole, offset)}"
    )

    args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.output.resolve().write_text(
        "\n".join(
            (
                '<?xml version="1.0" encoding="UTF-8"?>',
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.3f} {height:.3f}">',
                f'  <path d="{combined_path}" fill="#2e3191" fill-rule="evenodd"/>',
                "</svg>",
            )
        ),
        encoding="utf-8",
    )

    center_in_svg = (center_x - offset[0], center_y - offset[1])
    span_pixels = max(width - padding * 2.0, height - padding * 2.0)
    data = {
        "source": str(args.source.resolve()),
        "sourceCrop": [x0, y0, x1, y1],
        "sourceGripCenterPx": [round(center_x, 3), round(center_y, 3)],
        "sourceGripRadiusPx": round(source_hole_radius, 3),
        "svgGripCenterPx": [round(center_in_svg[0], 3), round(center_in_svg[1], 3)],
        "spanPx": round(span_pixels, 3),
        "widthPx": round(width - padding * 2.0, 3),
        "heightPx": round(height - padding * 2.0, 3),
        "outerPointCount": int(len(outer)),
        "holePointCount": int(len(hole)),
        "symmetryMethod": "2-of-3 vote at 0, 120, and 240 degrees",
    }
    args.data.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.data.resolve().write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    debug_dir = args.debug_dir.resolve()
    debug_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(debug_dir / "01-crop.png"), crop)
    cv2.imwrite(str(debug_dir / "02-largest-component.png"), body)
    cv2.imwrite(str(debug_dir / "03-symmetrized-mask.png"), symmetric)
    overlay = crop.copy()
    cv2.drawContours(
        overlay, [np.rint(outer).astype(np.int32)], -1, (0, 0, 255), 2
    )
    cv2.drawContours(
        overlay, [np.rint(hole).astype(np.int32)], -1, (255, 80, 0), 2
    )
    cv2.circle(overlay, (round(center_x), round(center_y)), 5, (0, 255, 0), -1)
    cv2.imwrite(str(debug_dir / "04-trace-overlay.png"), overlay)

    print(f"TRIGENG_REFERENCE_SVG={args.output.resolve()}")
    print(f"TRIGENG_REFERENCE_DATA={args.data.resolve()}")
    print(f"TRIGENG_REFERENCE_CENTER={center_x:.3f},{center_y:.3f}")
    print(f"TRIGENG_REFERENCE_SPAN_PX={span_pixels:.3f}")
    print(f"TRIGENG_REFERENCE_OUTER_POINTS={len(outer)}")
    print(f"TRIGENG_REFERENCE_HOLE_POINTS={len(hole)}")


if __name__ == "__main__":
    main()
