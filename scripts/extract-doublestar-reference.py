"""Derive a symmetric Double Star silhouette from Austen's real prop photo.

The source was photographed at a slight angle.  Rather than tracing both ends
independently and baking that perspective error into the model, this script
measures the cleaner upper half row-by-row, removes the horizontal camera shear,
mirrors it left/right, and then rotates that corrected half through 180 degrees.
The resulting SVG is the canonical, perfectly symmetric manufacturing profile.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "scripts" / "assets" / "doublestar-reference-photo.png"
DEFAULT_OUTPUT = ROOT / "scripts" / "assets" / "doublestar-reference.svg"
DEFAULT_PROOF = ROOT / "scripts" / "assets" / "doublestar-reference-mask.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--proof", type=Path, default=DEFAULT_PROOF)
    return parser.parse_args()


def cyan_mask(image: np.ndarray) -> np.ndarray:
    red = image[..., 0].astype(np.int16)
    green = image[..., 1].astype(np.int16)
    blue = image[..., 2].astype(np.int16)
    return (
        (green - red > 25)
        & (blue - red > 20)
        & (green > 75)
        & (blue > 75)
    )


def runs(row: np.ndarray) -> list[tuple[int, int]]:
    padded = np.pad(row.astype(np.int8), (1, 1))
    changes = np.diff(padded)
    starts = np.flatnonzero(changes == 1)
    ends = np.flatnonzero(changes == -1) - 1
    return [
        (int(start), int(end))
        for start, end in zip(starts, ends, strict=True)
        if end - start >= 2
    ]


def smooth(values: np.ndarray, radius: int = 7) -> np.ndarray:
    kernel = np.ones(radius * 2 + 1, dtype=np.float64)
    padded = np.pad(values, (radius, radius), mode="edge")
    return np.convolve(padded, kernel / kernel.sum(), mode="valid")


def sampled_indices(
    length: int,
    step: int,
    landmarks: tuple[int, ...] = (),
) -> np.ndarray:
    sampled = {0, length - 1, *range(0, length, step)}
    sampled.update(index for index in landmarks if 0 <= index < length)
    return np.asarray(sorted(sampled), dtype=np.int32)


def round_profile_peak(values: np.ndarray, peak: int, radius: int) -> None:
    """Replace a traced extremity with the ellipse implied by its shoulders."""
    start = peak - radius
    end = peak + radius
    maximum = float(values[peak])
    left_shoulder = float(values[start])
    right_shoulder = float(values[end])
    centerline = (left_shoulder + right_shoulder) * 0.5
    depth = maximum - centerline
    for index in range(start, end + 1):
        normalized = (index - peak) / radius
        progress = (normalized + 1.0) * 0.5
        shoulder = left_shoulder + (right_shoulder - left_shoulder) * progress
        values[index] = shoulder + depth * np.sqrt(max(0.0, 1.0 - normalized**2))


def closed_catmull_path(points: list[tuple[float, float]]) -> str:
    """Turn sparse measured landmarks into one continuous molded contour."""
    commands = [f"M {points[0][0]:.3f},{points[0][1]:.3f}"]
    count = len(points)
    for index, point in enumerate(points):
        following = points[(index + 1) % count]
        previous = points[(index - 1) % count]
        after = points[(index + 2) % count]
        control_1 = (
            point[0] + (following[0] - previous[0]) / 6.0,
            point[1] + (following[1] - previous[1]) / 6.0,
        )
        control_2 = (
            following[0] - (after[0] - point[0]) / 6.0,
            following[1] - (after[1] - point[1]) / 6.0,
        )
        commands.append(
            f"C {control_1[0]:.3f},{control_1[1]:.3f} "
            f"{control_2[0]:.3f},{control_2[1]:.3f} "
            f"{following[0]:.3f},{following[1]:.3f}"
        )
    commands.append("Z")
    return " ".join(commands)


def extract_profile(mask: np.ndarray) -> tuple[str, dict[str, float]]:
    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise RuntimeError("No cyan prop silhouette found in the reference photo")

    top = int(ys.min())
    bottom = int(ys.max())
    center = (top + bottom) / 2.0
    half_rows = int(round(center - top)) + 1

    outer_half_width = np.zeros(half_rows, dtype=np.float64)
    hole_half_width = np.full(half_rows, np.nan, dtype=np.float64)

    for offset in range(half_rows):
        y = min(top + offset, mask.shape[0] - 1)
        row_runs = runs(mask[y])
        if not row_runs:
            if offset:
                outer_half_width[offset] = outer_half_width[offset - 1]
            continue

        left = row_runs[0][0]
        right = row_runs[-1][1]
        # Re-centering every scanline removes the photo's small sideways camera
        # shear while preserving the measured span and plate thickness.
        outer_half_width[offset] = (right - left) / 2.0

        if len(row_runs) >= 2:
            left_inner = row_runs[0][1]
            right_inner = row_runs[-1][0]
            if right_inner - left_inner > 8:
                hole_half_width[offset] = (right_inner - left_inner) / 2.0

    outer_half_width = smooth(outer_half_width)
    # The photographed tips are molded capsules, not mathematical points.  The
    # very first cyan row under-represents the soft antialiased edge, so retain
    # a small half-width and let the closed spline form the rounded end cap.
    outer_half_width[0] = max(3.0, outer_half_width[1] * 0.32)

    hole_rows = np.flatnonzero(np.isfinite(hole_half_width))
    if not len(hole_rows):
        raise RuntimeError("The star opening could not be separated from the frame")
    hole_start = int(hole_rows.min())
    hole_end = int(hole_rows.max())
    hole_values = hole_half_width[hole_start : hole_end + 1]
    valid = np.isfinite(hole_values)
    hole_values = np.interp(
        np.arange(len(hole_values)), np.flatnonzero(valid), hole_values[valid]
    )
    hole_values = smooth(hole_values, radius=5)
    # A quilt crease and the raised center seam create a short false widening
    # just before the lower inner point in the photograph.  The molded opening
    # itself closes continuously, so enforce that local monotonic taper on
    # both ends while leaving the measured belly of the opening untouched.
    endpoint_span = min(84, len(hole_values) // 4)
    hole_values[:endpoint_span] = np.maximum.accumulate(
        hole_values[:endpoint_span]
    )
    hole_values[-endpoint_span:] = np.minimum.accumulate(
        hole_values[-endpoint_span:]
    )
    # The molded edge bevel supplies the physical radius.  Keep one shared
    # spline point at each inner corner so the trace cannot develop a doubled
    # notch where the right and left scanline boundaries meet.
    hole_values[0] = 0.0
    hole_values[-1] = 0.0

    total_photo_length = (center - top) * 2.0
    scale = 1000.0 / total_photo_length

    # Retain the photograph's actual shoulder, side-tip and grip transitions.
    # A broad second smoothing pass removes quilt texture and camera noise; the
    # sparse landmarks then describe the real molded profile rather than a
    # generic four-point star or a chain of visible scanline segments.
    outer_profile = smooth(outer_half_width, radius=15)
    # Smoothing rounds away a little amplitude as well as noise. Put the
    # photograph's measured overall width back before shaping the corners.
    outer_profile *= outer_half_width.max() / outer_profile.max()
    outer_peak = int(np.argmax(outer_profile))
    # Reconstruct the rounded molded cap from the height and depth of the
    # photographed tip instead of preserving its antialiased pixel stair-steps.
    # The side landing spans about 48 source pixels in the corrected photo.
    # Using that full measured span keeps the overall width while preventing
    # the long lead-in curve from reading as a spike with a rounded dot on it.
    outer_cap_radius = 24
    round_profile_peak(outer_profile, outer_peak, outer_cap_radius)
    outer_indices = sampled_indices(
        len(outer_profile),
        40,
        (
            outer_peak - outer_cap_radius,
            outer_peak - outer_cap_radius // 2,
            outer_peak,
            outer_peak + outer_cap_radius // 2,
            outer_peak + outer_cap_radius,
        ),
    )
    outer_y = -500.0 + np.arange(len(outer_profile)) * scale
    outer_right = [
        (float(outer_profile[index] * scale), float(outer_y[index]))
        for index in outer_indices
    ]
    lower_right = [(x, -y) for x, y in reversed(outer_right)]
    full_right = outer_right + lower_right[1:]
    full_left = [(-x, y) for x, y in reversed(full_right)]
    outer_points = full_right + full_left

    hole_profile = smooth(hole_values, radius=12)
    hole_profile *= hole_values.max() / hole_profile.max()
    hole_peak = int(np.argmax(hole_profile))
    # The opening corners are radiused in the physical molding. Tiny 6 mm end
    # flats and an elliptical side cap reproduce that roundness without visibly
    # truncating the diamond.
    corner_half_width_px = 7.0
    hole_profile[0] = corner_half_width_px
    hole_profile[-1] = corner_half_width_px
    hole_cap_radius = 14
    round_profile_peak(hole_profile, hole_peak, hole_cap_radius)
    hole_indices = sampled_indices(
        len(hole_profile),
        30,
        (
            hole_peak - hole_cap_radius,
            hole_peak - hole_cap_radius // 2,
            hole_peak,
            hole_peak + hole_cap_radius // 2,
            hole_peak + hole_cap_radius,
        ),
    )
    hole_y = -500.0 + (hole_start + np.arange(len(hole_profile))) * scale
    upper_hole_right = [
        (float(hole_profile[index] * scale), float(hole_y[index]))
        for index in hole_indices
    ]
    upper_hole_left = [(-x, y) for x, y in reversed(upper_hole_right)]
    upper_hole_points = upper_hole_right + upper_hole_left
    lower_hole_points = [(-x, -y) for x, y in upper_hole_points]

    path = " ".join(
        [
            closed_catmull_path(outer_points),
            closed_catmull_path(upper_hole_points),
            closed_catmull_path(lower_hole_points),
        ]
    )
    stats = {
        "photo_top_px": float(top),
        "photo_bottom_px": float(bottom),
        "photo_half_length_px": float(center - top),
        "profile_width_ratio": float(outer_half_width.max() * 2.0 / total_photo_length),
        "hole_top_ratio": float(hole_start / (center - top)),
        "hole_bottom_ratio": float(hole_end / (center - top)),
    }
    return path, stats


def write_svg(path: Path, profile_path: str, stats: dict[str, float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    metadata = " ".join(f'{key}="{value:.6f}"' for key, value in stats.items())
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-260 -510 520 1020">
  <!-- Symmetry-corrected from Austen's real Double Star photo (2026-08-20). -->
  <metadata {metadata}/>
  <path id="doublestar-reference" d="{profile_path}" fill="#20cbd1" fill-rule="evenodd"/>
</svg>
"""
    path.write_text(svg, encoding="utf-8")


def write_proof(path: Path, mask: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.where(mask, 255, 0).astype(np.uint8)).save(path)


def main() -> None:
    args = parse_args()
    image = np.asarray(Image.open(args.source).convert("RGB"))
    mask = cyan_mask(image)
    profile_path, stats = extract_profile(mask)
    write_svg(args.output, profile_path, stats)
    write_proof(args.proof, mask)
    print(f"DOUBLESTAR_REFERENCE={args.output.resolve()}")
    print(f"DOUBLESTAR_PROOF={args.proof.resolve()}")
    for key, value in stats.items():
        print(f"DOUBLESTAR_{key.upper()}={value:.6f}")


if __name__ == "__main__":
    main()
