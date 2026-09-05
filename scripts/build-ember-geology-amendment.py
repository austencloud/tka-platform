"""Build Ember's true-scale slanted-flank Gate 1.1 R5 correction package.

The terrain comes from ``build-ember-geology-study.py`` and the lava footprint
comes from Flowy calibration outputs prepared by
``prepare-ember-lava-simulator-benchmark.py``. This script is a review renderer;
it does not own either source of truth and does not touch the runtime scene.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
STUDY_SCRIPT = ROOT / "scripts/build-ember-geology-study.py"
SIMULATOR_ROOT = Path(
    "E:/tka-platform-ember-geology-sources/ember-simulator-benchmark/gate-1-1-r5"
)
SIMULATOR_MANIFEST = SIMULATOR_ROOT / "calibration-manifest.json"
OUTPUT_DIR = (
    ROOT
    / "docs/superpowers/specs/ember-spatial-directions/evidence/gate-1-1-geology-amendment-r5"
)
REPORT_PATH = OUTPUT_DIR / "ember-midflank-fire-pilgrimage-r5-gate1-1-report.json"
PLAN_PATH = OUTPUT_DIR / "01-north-up-measured-plan.png"
SECTIONS_PATH = OUTPUT_DIR / "02-true-scale-midflank-section.png"
VIEWPOINTS_PATH = OUTPUT_DIR / "03-runtime-uphill-downhill-proof.png"
SIGHTLINES_PATH = OUTPUT_DIR / "04-orbit-sightline-study.png"
CALIBRATION_PATH = OUTPUT_DIR / "05-flowy-calibration-sweep.png"
GROUND_DETAIL_PATH = OUTPUT_DIR / "06-performance-ground-detail.png"
CONTACT_PATH = OUTPUT_DIR / "ember-midflank-fire-pilgrimage-r5-gate1-1-contact-sheet.png"
SELECTED_DATA_PATH = ROOT / "static/data/ember/review/ember-midflank-fire-pilgrimage-r5-flowy-thickness.f32"

INK = (235, 237, 239)
MUTED = (155, 165, 174)
PAPER = (11, 14, 18)
PANEL = (20, 25, 31)
GRID = (64, 73, 82)
CYAN = (89, 214, 224)
LAVA = (255, 91, 33)
LAVA_HOT = (255, 201, 84)
HEADWALL = (209, 177, 124)
BREACH = (137, 116, 238)
TALUS = (173, 132, 92)
STAGE = (231, 242, 244)
PASS = (109, 207, 137)
FAIL = (237, 112, 94)

AUDIENCE_STANDING_POINTS: tuple[tuple[float, float], ...] = (
    (4.0, -9.0),
    (8.0, -11.5),
    (7.0, -15.0),
    (2.5, -17.0),
)


def load_module(path: Path, name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        Path("C:/Windows/Fonts/seguisb.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf") if bold else Path("C:/Windows/Fonts/arial.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


FONT_16 = load_font(16)
FONT_18 = load_font(18)
FONT_22 = load_font(22)
FONT_26 = load_font(26, bold=True)
FONT_32 = load_font(32, bold=True)
FONT_44 = load_font(44, bold=True)
FONT_62 = load_font(62, bold=True)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    path.write_bytes(payload.encode("utf-8"))


def read_esri_ascii(path: Path) -> np.ndarray:
    return np.flipud(np.loadtxt(path, skiprows=6))


def world_to_pixel(
    study: Any,
    x: float,
    z: float,
    rect: tuple[int, int, int, int],
) -> tuple[int, int]:
    left, top, right, bottom = rect
    px = left + (x - study.WORLD_X[0]) / (study.WORLD_X[1] - study.WORLD_X[0]) * (right - left)
    py = bottom - (z - study.WORLD_Z[0]) / (study.WORLD_Z[1] - study.WORLD_Z[0]) * (bottom - top)
    return round(px), round(py)


def metres_to_pixels(study: Any, metres: float, rect: tuple[int, int, int, int]) -> int:
    return max(1, round(metres / (study.WORLD_X[1] - study.WORLD_X[0]) * (rect[2] - rect[0])))


def mask_edges(mask: np.ndarray, threshold: float) -> np.ndarray:
    inside = mask >= threshold
    edges = np.zeros_like(inside)
    edges[:, 1:] |= inside[:, 1:] != inside[:, :-1]
    edges[1:, :] |= inside[1:, :] != inside[:-1, :]
    return edges


def add_raster_overlay(
    canvas: Image.Image,
    mask: np.ndarray,
    rect: tuple[int, int, int, int],
    color: tuple[int, int, int],
    alpha: int,
    *,
    edges_only: bool = False,
) -> None:
    raster = mask_edges(mask, 0.5) if edges_only else mask
    raster_u8 = np.clip(raster.astype(float) * alpha, 0, 255).astype(np.uint8)
    layer = Image.new("RGBA", (mask.shape[1], mask.shape[0]), (*color, 0))
    layer.putalpha(Image.fromarray(np.flipud(raster_u8)))
    layer = layer.resize((rect[2] - rect[0], rect[3] - rect[1]), Image.Resampling.NEAREST)
    canvas.alpha_composite(layer, (rect[0], rect[1]))


def label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    *,
    color: tuple[int, int, int] = INK,
    fill: tuple[int, int, int] = PANEL,
    font: ImageFont.ImageFont = FONT_18,
) -> None:
    box = draw.textbbox(xy, text, font=font)
    padded = (box[0] - 8, box[1] - 5, box[2] + 8, box[3] + 5)
    draw.rounded_rectangle(padded, radius=5, fill=(*fill, 232), outline=(*GRID, 220))
    draw.text(xy, text, font=font, fill=color)


def selected_result(manifest: dict[str, Any]) -> dict[str, Any]:
    selected_id = manifest.get("selectedCalibration")
    for result in manifest.get("results", []):
        if result.get("calibrationId") == selected_id:
            return result
    raise ValueError("Calibration manifest has no selected result")


def performance_ground_metrics(
    study: Any,
    height: np.ndarray,
    thickness: np.ndarray,
    masks: dict[str, np.ndarray],
    selected: dict[str, Any],
) -> dict[str, Any]:
    dz, dx = np.gradient(height, 1.0, 1.0)
    slope_degrees = np.degrees(np.arctan(np.hypot(dx, dz)))
    stable_core = masks["stablePatch"] >= 0.98
    stable_x = study.X_GRID[stable_core]
    stable_z = study.Z_GRID[stable_core]
    old_flow_contact = masks["olderFlowContact"] >= 0.5
    radius = np.hypot(study.X_GRID, study.Z_GRID)
    active = thickness > 0.01
    active_x = study.X_GRID[active]
    active_z = study.Z_GRID[active]
    standing_points: list[dict[str, Any]] = []
    for x, z in AUDIENCE_STANDING_POINTS:
        row = int(np.argmin(np.abs(study.Z_VALUES - z)))
        column = int(np.argmin(np.abs(study.X_VALUES - x)))
        distance_from_performer = math.hypot(x, z)
        active_flow_clearance = float(np.min(np.hypot(active_x - x, active_z - z)))
        standing_points.append(
            {
                "runtimeXZ": [x, z],
                "terrainSlopeDegrees": round(float(slope_degrees[row, column]), 3),
                "clearanceBeyondActionEnvelopeM": round(distance_from_performer - study.ACTION_RADIUS_M, 3),
                "activeFlowClearanceM": round(active_flow_clearance, 3),
                "withinOlderFlowContact": bool(masks["olderFlowContact"][row, column] >= 0.5),
            }
        )
    return {
        "stableCoreWidthXM": round(float(np.ptp(stable_x)), 3),
        "stableCoreWidthZM": round(float(np.ptp(stable_z)), 3),
        "stableCoreAreaM2": int(np.count_nonzero(stable_core)),
        "actionAreaM2": round(math.pi * study.ACTION_RADIUS_M**2, 3),
        "actionMedianSlopeDegrees": round(
            float(np.median(slope_degrees[radius <= study.ACTION_RADIUS_M])),
            3,
        ),
        "olderFlowContactMedianSlopeDegrees": round(
            float(np.median(slope_degrees[old_flow_contact])),
            3,
        ),
        "activeFlowActionClearanceM": round(float(selected["clearanceBeyondActionEnvelopeM"]), 3),
        "audienceStandingPoints": standing_points,
        "minimumAudienceActionClearanceM": min(
            point["clearanceBeyondActionEnvelopeM"] for point in standing_points
        ),
        "minimumAudienceActiveFlowClearanceM": min(
            point["activeFlowClearanceM"] for point in standing_points
        ),
        "audienceSlopeRangeDegrees": [
            min(point["terrainSlopeDegrees"] for point in standing_points),
            max(point["terrainSlopeDegrees"] for point in standing_points),
        ],
    }


def map_panel(
    study: Any,
    height: np.ndarray,
    thickness: np.ndarray,
    masks: dict[str, np.ndarray],
    size: tuple[int, int],
) -> Image.Image:
    canvas = Image.new("RGBA", size, (*PAPER, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 42), "EMBER GATE 1.1 R5 · SLANTED MID-FLANK NORTH-UP PLAN", font=FONT_44, fill=INK)
    draw.text(
        (66, 101),
        "Summit continues uphill · performer occupies a small widening within the slope · drainage exits downslope",
        font=FONT_22,
        fill=MUTED,
    )

    map_height = min(size[1] - 330, round((size[0] - 180) / 380.0 * 335.0))
    map_width = round(map_height / 335.0 * 380.0)
    rect = ((size[0] - map_width) // 2, 170, (size[0] + map_width) // 2, 170 + map_height)
    terrain = (
        study.terrain_image(height, (map_width, map_height))
        .transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        .convert("RGBA")
    )
    canvas.alpha_composite(terrain, (rect[0], rect[1]))
    add_raster_overlay(canvas, study.contour_mask(height, interval=10.0), rect, INK, 88)

    add_raster_overlay(canvas, thickness > 0.01, rect, LAVA, 150)
    add_raster_overlay(canvas, masks["craterRim"], rect, BREACH, 220, edges_only=True)
    add_raster_overlay(canvas, masks["olderFlowContact"], rect, HEADWALL, 205, edges_only=True)
    add_raster_overlay(canvas, masks["stablePatch"], rect, CYAN, 245, edges_only=True)

    draw = ImageDraw.Draw(canvas)
    stage = world_to_pixel(study, 0.0, 0.0, rect)
    action = metres_to_pixels(study, study.ACTION_RADIUS_M, rect)
    orbit = metres_to_pixels(study, study.ORBIT_RADIUS_M, rect)
    draw.ellipse((stage[0] - orbit, stage[1] - orbit, stage[0] + orbit, stage[1] + orbit), outline=(*CYAN, 210), width=3)
    draw.ellipse((stage[0] - action, stage[1] - action, stage[0] + action, stage[1] + action), fill=(*STAGE, 245), outline=(*PAPER, 255), width=3)
    draw.line((stage[0] - 10, stage[1], stage[0] + 10, stage[1]), fill=PAPER, width=3)
    draw.line((stage[0], stage[1] - 10, stage[0], stage[1] + 10), fill=PAPER, width=3)

    source = world_to_pixel(study, *study.R5_MIDFLANK_SOURCE, rect)
    draw.polygon(
        ((source[0], source[1] - 13), (source[0] - 12, source[1] + 10), (source[0] + 12, source[1] + 10)),
        fill=LAVA_HOT,
        outline=PAPER,
    )
    exit_point = world_to_pixel(study, *study.R5_DOWNSLOPE_EXIT, rect)

    # Explicit orientation and route labels. Each is legible without prose.
    north_x = rect[0] + 62
    north_y = rect[1] + 92
    draw.line((north_x, north_y + 54, north_x, north_y - 44), fill=INK, width=6)
    draw.polygon(((north_x, north_y - 64), (north_x - 14, north_y - 38), (north_x + 14, north_y - 38)), fill=INK)
    draw.text((north_x - 13, north_y - 100), "N", font=FONT_32, fill=INK)

    scale_length = metres_to_pixels(study, 50.0, rect)
    scale_x = rect[2] - scale_length - 62
    scale_y = rect[1] + 52
    draw.line((scale_x, scale_y, scale_x + scale_length, scale_y), fill=INK, width=5)
    draw.line((scale_x, scale_y - 10, scale_x, scale_y + 10), fill=INK, width=4)
    draw.line((scale_x + scale_length, scale_y - 10, scale_x + scale_length, scale_y + 10), fill=INK, width=4)
    draw.text((scale_x + scale_length // 2 - 28, scale_y + 14), "50 m", font=FONT_18, fill=INK)

    summit_pt = world_to_pixel(study, -18.0, 181.0, rect)
    label(draw, (summit_pt[0] + 48, summit_pt[1] + 18), "1 · SUMMIT CONTINUES BEYOND FRAME", color=HEADWALL)
    label(draw, (source[0] + 20, source[1] - 28), "2 · FURNACE SADDLE + HIGH SOURCE", color=LAVA_HOT)
    ravine_pt = world_to_pixel(study, -22.0, 58.0, rect)
    label(draw, (ravine_pt[0] + 24, ravine_pt[1] - 18), "3 · GRAVITY-LED RAVINE", color=LAVA_HOT)
    stable_core = masks["stablePatch"] >= 0.98
    stable_width_x = float(np.ptp(study.X_GRID[stable_core]))
    stable_width_z = float(np.ptp(study.Z_GRID[stable_core]))
    label(
        draw,
        (stage[0] - 360, stage[1] + 53),
        f"4 · OLDER HARDENED LAVA BENCH · {stable_width_x:.0f} × {stable_width_z:.0f} m EASED CORE",
        color=CYAN,
    )
    label(draw, (stage[0] - 58, stage[1] - 48), "PERFORMER", color=INK)
    drop_pt = world_to_pixel(study, 52.0, -67.0, rect)
    label(draw, (drop_pt[0] + 24, drop_pt[1] - 8), "5 · GRADUALLY STEEPENING LOWER FLANK", color=TALUS)
    label(draw, (exit_point[0] + 34, exit_point[1] - 36), "6 · FLOW CONTINUES BEYOND SCENE", color=LAVA_HOT)
    audience = world_to_pixel(study, 0.0, -21.5, rect)
    draw.polygon(
        ((audience[0], audience[1] - 12), (audience[0] - 11, audience[1] + 10), (audience[0] + 11, audience[1] + 10)),
        fill=INK,
        outline=PAPER,
    )
    draw.line((audience[0], audience[1] - 15, stage[0], stage[1] + 14), fill=(*INK,), width=2)
    label(draw, (audience[0] - 308, audience[1] + 24), "VIEWER ENTRY · DEFAULT AUDIENCE CAMERA", color=INK)
    uphill_arrow = world_to_pixel(study, 132.0, 133.0, rect)
    downhill_arrow = world_to_pixel(study, 132.0, -87.0, rect)
    performer_ground = study.sample_height(height, 0.0, 0.0)
    uphill_rise = float(height.max() - performer_ground)
    downhill_fall = float(performer_ground - height.min())
    draw.line((uphill_arrow[0], uphill_arrow[1] + 52, uphill_arrow[0], uphill_arrow[1] - 42), fill=HEADWALL, width=5)
    draw.polygon(((uphill_arrow[0], uphill_arrow[1] - 62), (uphill_arrow[0] - 13, uphill_arrow[1] - 37), (uphill_arrow[0] + 13, uphill_arrow[1] - 37)), fill=HEADWALL)
    label(draw, (uphill_arrow[0] - 95, uphill_arrow[1] + 66), f"LOOK UPHILL · +{uphill_rise:.0f} m", color=HEADWALL)
    draw.line((downhill_arrow[0], downhill_arrow[1] - 52, downhill_arrow[0], downhill_arrow[1] + 42), fill=TALUS, width=5)
    draw.polygon(((downhill_arrow[0], downhill_arrow[1] + 62), (downhill_arrow[0] - 13, downhill_arrow[1] + 37), (downhill_arrow[0] + 13, downhill_arrow[1] + 37)), fill=TALUS)
    label(draw, (downhill_arrow[0] - 95, downhill_arrow[1] - 104), f"LOOK DOWNHILL · -{downhill_fall:.0f} m", color=TALUS)

    legend_y = rect[3] + 46
    draw.text((rect[0], legend_y), "PLAN CONTRACT", font=FONT_22, fill=CYAN)
    legend = (
        "380 × 335 m · 1 m DEM · 10 m contours · white = protected 4.5 m action envelope · "
        "cyan ring = 25 m orbit · orange = Flowy cells > 0.01 m · tan = sloping old-flow contact · cyan = cooled stable core"
    )
    draw.text((rect[0], legend_y + 38), legend, font=FONT_18, fill=MUTED)
    return canvas


def performance_ground_board(
    study: Any,
    height: np.ndarray,
    thickness: np.ndarray,
    masks: dict[str, np.ndarray],
    ground_metrics: dict[str, Any],
) -> Image.Image:
    """Clarify what the performer stands on without changing the R5 terrain."""

    canvas = Image.new("RGBA", (2400, 1800), (*PAPER, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 42), "EMBER GATE 1.1 R5 · PERFORMANCE-GROUND CLARIFICATION", font=FONT_44, fill=INK)
    draw.text(
        (66, 101),
        "Same measured terrain · close-up of the old-flow bench, protected action zone, and small audience relationship",
        font=FONT_22,
        fill=MUTED,
    )

    local_x = (-28.0, 28.0)
    local_z = (-26.0, 24.0)
    x_selection = (study.X_VALUES >= local_x[0]) & (study.X_VALUES <= local_x[1])
    z_selection = (study.Z_VALUES >= local_z[0]) & (study.Z_VALUES <= local_z[1])
    local_height = height[np.ix_(z_selection, x_selection)]
    local_thickness = thickness[np.ix_(z_selection, x_selection)]
    local_contact = masks["olderFlowContact"][np.ix_(z_selection, x_selection)]
    local_patch = masks["stablePatch"][np.ix_(z_selection, x_selection)]
    rect = (64, 178, 1456, 1421)
    terrain = (
        study.terrain_image(local_height, (rect[2] - rect[0], rect[3] - rect[1]))
        .transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        .convert("RGBA")
    )
    canvas.alpha_composite(terrain, (rect[0], rect[1]))
    add_raster_overlay(canvas, study.contour_mask(local_height, interval=1.0), rect, INK, 82)
    add_raster_overlay(canvas, local_contact, rect, HEADWALL, 54)
    add_raster_overlay(canvas, local_contact, rect, HEADWALL, 220, edges_only=True)
    add_raster_overlay(canvas, local_patch, rect, CYAN, 72)
    add_raster_overlay(canvas, local_patch, rect, CYAN, 245, edges_only=True)
    add_raster_overlay(canvas, local_thickness > 0.01, rect, LAVA, 160)
    draw = ImageDraw.Draw(canvas)

    def local_to_pixel(x: float, z: float) -> tuple[int, int]:
        px = rect[0] + (x - local_x[0]) / (local_x[1] - local_x[0]) * (rect[2] - rect[0])
        py = rect[3] - (z - local_z[0]) / (local_z[1] - local_z[0]) * (rect[3] - rect[1])
        return round(px), round(py)

    def local_metres_to_pixels(metres: float) -> int:
        return max(1, round(metres / (local_x[1] - local_x[0]) * (rect[2] - rect[0])))

    stage = local_to_pixel(0.0, 0.0)
    action = local_metres_to_pixels(study.ACTION_RADIUS_M)
    draw.ellipse(
        (stage[0] - action, stage[1] - action, stage[0] + action, stage[1] + action),
        outline=(*STAGE, 255),
        width=5,
    )
    draw.line((stage[0] - 13, stage[1], stage[0] + 13, stage[1]), fill=STAGE, width=4)
    draw.line((stage[0], stage[1] - 13, stage[0], stage[1] + 13), fill=STAGE, width=4)
    label(draw, (stage[0] + 34, stage[1] - 42), "PERFORMER GROUP · 4.5 m PROTECTED RADIUS", color=STAGE)

    audience_pixels = [local_to_pixel(x, z) for x, z in AUDIENCE_STANDING_POINTS]
    draw.line(audience_pixels, fill=(*HEADWALL, 220), width=8, joint="curve")
    for px, py in audience_pixels:
        draw.ellipse((px - 11, py - 11, px + 11, py + 11), fill=INK, outline=HEADWALL, width=4)
    label(
        draw,
        (audience_pixels[-1][0] + 28, audience_pixels[-1][1] - 14),
        "SMALL DOWNSLOPE / LATERAL STANDING CRESCENT",
        color=HEADWALL,
    )

    audience_camera = local_to_pixel(0.0, -21.5)
    draw.polygon(
        (
            (audience_camera[0], audience_camera[1] - 15),
            (audience_camera[0] - 14, audience_camera[1] + 12),
            (audience_camera[0] + 14, audience_camera[1] + 12),
        ),
        fill=INK,
        outline=PAPER,
    )
    draw.line((audience_camera[0], audience_camera[1] - 18, stage[0], stage[1] + 18), fill=(*INK, 180), width=3)
    label(draw, (audience_camera[0] - 298, audience_camera[1] + 30), "DEFAULT AUDIENCE CAMERA · 21.5 m DOWNSLOPE", color=INK)

    stable_label_point = local_to_pixel(-5.0, 5.0)
    label(draw, (stable_label_point[0] - 312, stable_label_point[1] - 66), "12 × 11 m LOCALLY EASED CORE", color=CYAN)
    contact_label_point = local_to_pixel(18.0, 13.0)
    label(draw, (contact_label_point[0] - 140, contact_label_point[1] - 45), "OLDER COOLED FLOW CONTACT", color=HEADWALL)
    lava_label_point = local_to_pixel(-12.0, -12.0)
    label(draw, (lava_label_point[0] - 270, lava_label_point[1] + 28), "ACTIVE FLOW REMAINS OUTSIDE ACTION ZONE", color=LAVA_HOT)

    scale_start = local_to_pixel(-25.0, 21.0)
    scale_end = local_to_pixel(-15.0, 21.0)
    draw.line((*scale_start, *scale_end), fill=INK, width=5)
    draw.line((scale_start[0], scale_start[1] - 9, scale_start[0], scale_start[1] + 9), fill=INK, width=4)
    draw.line((scale_end[0], scale_end[1] - 9, scale_end[0], scale_end[1] + 9), fill=INK, width=4)
    draw.text((scale_start[0] + 88, scale_start[1] + 16), "10 m", font=FONT_18, fill=INK)
    draw.rectangle(rect, outline=GRID, width=3)

    card = (1510, 178, 2336, 1650)
    draw.rounded_rectangle(card, radius=20, fill=(*PANEL, 255), outline=GRID, width=3)
    x0 = card[0] + 38
    y = card[1] + 34
    draw.text((x0, y), "MY CALL", font=FONT_26, fill=CYAN)
    y += 54
    draw.text((x0, y), "OLDER HARDENED LAVA BENCH", font=FONT_32, fill=INK)
    y += 64
    draw.multiline_text(
        (x0, y),
        "Natural cause: a thin remnant of an older cooled flow\n"
        "crosses the continuing mountain grade.\n\n"
        "Order intervention: loose clinker is cleared away;\n"
        "the rock is not quarried into a platform.\n\n"
        "Audience: a few standing pockets follow the contour\n"
        "downslope and laterally, outside the action zone.",
        font=FONT_22,
        fill=MUTED,
        spacing=10,
    )
    y += 338
    draw.text((x0, y), "MEASURED NOW", font=FONT_26, fill=CYAN)
    y += 54
    audience_slope_range = ground_metrics["audienceSlopeRangeDegrees"]
    measured_lines = (
        (
            "Stable core                 "
            f"{float(ground_metrics['stableCoreWidthXM']):.0f} × "
            f"{float(ground_metrics['stableCoreWidthZM']):.0f} m · "
            f"{int(ground_metrics['stableCoreAreaM2'])} m²"
        ),
        f"Protected action area       {float(ground_metrics['actionAreaM2']):.1f} m²",
        f"Core median slope           {float(ground_metrics['actionMedianSlopeDegrees']):.1f}°",
        f"Old-flow contact slope      {float(ground_metrics['olderFlowContactMedianSlopeDegrees']):.1f}°",
        f"Audience pocket slopes      {audience_slope_range[0]:.1f}–{audience_slope_range[1]:.1f}°",
        f"Audience / active flow      ≥ {float(ground_metrics['minimumAudienceActiveFlowClearanceM']):.1f} m",
    )
    for line in measured_lines:
        draw.text((x0, y), line, font=FONT_22, fill=INK)
        y += 44
    y += 24
    draw.text((x0, y), "RESERVED FOR GATE 3 / 4", font=FONT_26, fill=LAVA_HOT)
    y += 54
    draw.multiline_text(
        (x0, y),
        "INVENTION · Slightly darker, denser basalt may\n"
        "distinguish the whole old-flow contact. A restrained\n"
        "pulse may live only in pre-existing peripheral fractures.\n"
        "The surface underfoot remains cooled and non-emissive.",
        font=FONT_22,
        fill=MUTED,
        spacing=10,
    )
    y += 190
    draw.text((x0, y), "REJECT", font=FONT_26, fill=FAIL)
    y += 54
    draw.multiline_text(
        (x0, y),
        "Floating disc · circular shader · radial crack graphic\n"
        "lava moat · broad level shelf · hot floor under performers",
        font=FONT_22,
        fill=MUTED,
        spacing=10,
    )

    draw.text(
        (66, 1510),
        "GATE STATUS · This sheet clarifies the ground identity and audience relationship. It does not alter the R5 terrain or Flowy calibration.",
        font=FONT_22,
        fill=INK,
    )
    draw.text(
        (66, 1554),
        "Tan = the full sloping old-flow contact · cyan = locally eased stable core · white = protected action radius · orange = simulator-owned active flow",
        font=FONT_18,
        fill=MUTED,
    )
    return canvas


def section_board(study: Any, candidate: Any, height: np.ndarray) -> tuple[Image.Image, dict[str, float]]:
    del candidate
    canvas = Image.new("RGB", (2400, 1800), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 42), "EMBER GATE 1.1 R5 · TRUE-SCALE COMPOUND-FLANK SECTION", font=FONT_44, fill=INK)
    draw.text((66, 101), "One horizontal metre equals one vertical metre · no vertical exaggeration", font=FONT_22, fill=MUTED)

    profile_path = ((-18.0, 190.0), (-26.0, 158.0), *study.R5_MIDFLANK_FLOW_PATH)
    distances, xs, zs = study.interpolate_path(profile_path, samples=900)
    elevations = np.asarray([study.sample_height(height, float(x), float(z)) for x, z in zip(xs, zs)])
    drainage_distances, drainage_xs, drainage_zs = study.interpolate_path(study.R5_MIDFLANK_FLOW_PATH, samples=720)
    drainage_elevations = np.asarray(
        [study.sample_height(height, float(x), float(z)) for x, z in zip(drainage_xs, drainage_zs)]
    )
    left, top, right, bottom = 76, 178, 2324, 1655
    draw.rounded_rectangle((left, top, right, bottom), radius=18, fill=PANEL, outline=GRID, width=2)
    min_e = math.floor((float(elevations.min()) - 8.0) / 10.0) * 10.0
    max_e = math.ceil((float(elevations.max()) + 8.0) / 10.0) * 10.0
    plot_left, plot_top, plot_right, plot_bottom = left + 102, top + 70, right - 42, bottom - 102
    scale = min((plot_right - plot_left) / float(distances[-1]), (plot_bottom - plot_top) / (max_e - min_e))
    used_width = float(distances[-1]) * scale
    used_height = (max_e - min_e) * scale
    plot_left += int(((plot_right - plot_left) - used_width) / 2.0)
    plot_right = round(plot_left + used_width)
    plot_top += int(((plot_bottom - plot_top) - used_height) / 2.0)
    plot_bottom = round(plot_top + used_height)

    def long_point(distance: float, elevation: float) -> tuple[int, int]:
        return round(plot_left + distance * scale), round(plot_bottom - (elevation - min_e) * scale)

    for elevation_tick in range(int(min_e), int(max_e) + 1, 25):
        _, py = long_point(0.0, float(elevation_tick))
        draw.line((plot_left, py, plot_right, py), fill=GRID, width=1)
        draw.text((plot_left - 70, py - 10), f"{elevation_tick} m", font=FONT_16, fill=MUTED)
    for distance_tick in range(0, int(distances[-1]) + 1, 50):
        px, _ = long_point(float(distance_tick), min_e)
        draw.line((px, plot_top, px, plot_bottom), fill=GRID, width=1)
        draw.text((px - 18, plot_bottom + 18), f"{distance_tick}", font=FONT_16, fill=MUTED)

    points = [long_point(float(d), float(e)) for d, e in zip(distances, elevations)]
    draw.polygon(points + [(plot_right, plot_bottom), (plot_left, plot_bottom)], fill=(43, 47, 48), outline=HEADWALL)

    source_index = int(np.argmin((xs - study.R5_MIDFLANK_SOURCE[0]) ** 2 + (zs - study.R5_MIDFLANK_SOURCE[1]) ** 2))
    exit_index = int(np.argmin((xs - study.R5_DOWNSLOPE_EXIT[0]) ** 2 + (zs - study.R5_DOWNSLOPE_EXIT[1]) ** 2))
    lava_points = points[source_index : exit_index + 1]
    draw.line(lava_points, fill=LAVA, width=8)
    draw.line(lava_points, fill=LAVA_HOT, width=3)

    annotations = (
        ((-18.0, 190.0), "SUMMIT CONTINUES"),
        (study.R5_MIDFLANK_SOURCE, "HIGH SOURCE"),
        ((-2.0, 1.0), "SMALL STABLE PATCH"),
        ((-7.0, -62.0), "STEEPENING LOWER FLANK"),
        (study.R5_DOWNSLOPE_EXIT, "OUTFLOW CONTINUES"),
    )
    for (x0, z0), text_value in annotations:
        index = int(np.argmin((xs - x0) ** 2 + (zs - z0) ** 2))
        px, py = points[index]
        draw.line((px, py - 8, px, min(plot_bottom, py + 68)), fill=GRID, width=2)
        draw.text((px - 58, py - 42), text_value, font=FONT_16, fill=LAVA_HOT if "SOURCE" in text_value or "OUTFLOW" in text_value else INK)

    performer_index = int(np.argmin(xs * xs + zs * zs))
    performer_x, performer_ground_y = points[performer_index]
    performer_height_px = max(10, round(1.75 * scale))
    draw.line((performer_x, performer_ground_y, performer_x, performer_ground_y - performer_height_px), fill=STAGE, width=5)
    draw.ellipse((performer_x - 5, performer_ground_y - performer_height_px - 9, performer_x + 5, performer_ground_y - performer_height_px + 1), fill=STAGE)

    performer_elevation = study.sample_height(height, 0.0, 0.0)
    upper_rise = float(height.max()) - performer_elevation
    downhill_fall = performer_elevation - float(height.min())
    dz, dx = np.gradient(height, 1.0, 1.0)
    slope_degrees = np.degrees(np.arctan(np.hypot(dx, dz)))
    radius = np.hypot(study.X_GRID, study.Z_GRID)
    surrounding_annulus = (radius >= 8.0) & (radius <= 25.0)
    older_flow_contact = study.midflank_r5_masks()["olderFlowContact"] >= 0.5
    near_level_neighborhood = (radius <= 35.0) & (slope_degrees < 2.0)
    action_median_slope = float(np.median(slope_degrees[radius <= study.ACTION_RADIUS_M]))
    surrounding_median_slope = float(np.median(slope_degrees[surrounding_annulus]))
    contact_median_slope = float(np.median(slope_degrees[older_flow_contact]))
    near_level_area = int(np.count_nonzero(near_level_neighborhood))
    metric_x = plot_left + 22
    metric_y = plot_top + 26
    label(draw, (metric_x, metric_y), f"UPHILL RISE ABOVE PERFORMER  +{upper_rise:.1f} m", color=HEADWALL)
    label(draw, (metric_x, metric_y + 48), f"DOWNHILL FALL BELOW PERFORMER  -{downhill_fall:.1f} m", color=TALUS)
    label(draw, (metric_x, metric_y + 96), f"TOTAL VERTICAL SPAN  {float(height.max() - height.min()):.1f} m", color=INK)
    label(draw, (metric_x, metric_y + 144), f"ACTION PATCH MEDIAN SLOPE  {action_median_slope:.1f}°", color=CYAN)
    label(draw, (metric_x, metric_y + 192), f"8-25 m SURROUNDING MEDIAN SLOPE  {surrounding_median_slope:.1f}°", color=HEADWALL)
    label(draw, (metric_x, metric_y + 240), f"NEAR-LEVEL AREA WITHIN 35 m  {near_level_area} m²", color=INK)
    draw.text((plot_right - 210, plot_bottom + 50), "distance along flank (m)", font=FONT_16, fill=MUTED)
    draw.text((left + 28, top + 20), "LONGITUDINAL · upper rim → compound slanted flank → lower country", font=FONT_22, fill=INK)
    draw.text((left + 28, bottom - 54), "PASS: the performer remains on the mountain grade; only the action footprint is locally eased.", font=FONT_18, fill=MUTED)

    local_samples = []
    for x in np.linspace(-study.ACTION_RADIUS_M, study.ACTION_RADIUS_M, 31):
        for z in np.linspace(-study.ACTION_RADIUS_M, study.ACTION_RADIUS_M, 31):
            if math.hypot(x, z) <= study.ACTION_RADIUS_M:
                local_samples.append(study.sample_height(height, float(x), float(z)))
    local_relief = max(local_samples) - min(local_samples)
    metrics = {
        "pathLengthM": round(float(drainage_distances[-1]), 3),
        "sourceElevationM": round(float(drainage_elevations[0]), 3),
        "downslopeExitElevationM": round(float(drainage_elevations[-1]), 3),
        "netDescentM": round(float(drainage_elevations[0] - drainage_elevations[-1]), 3),
        "averageGradePercent": round(float((drainage_elevations[0] - drainage_elevations[-1]) / drainage_distances[-1] * 100.0), 3),
        "uphillRiseAbovePerformerM": round(float(upper_rise), 3),
        "downhillFallBelowPerformerM": round(float(downhill_fall), 3),
        "totalVerticalSpanM": round(float(height.max() - height.min()), 3),
        "verticalExaggeration": 1.0,
        "actionEnvelopeLocalReliefM": round(float(local_relief), 3),
        "actionEnvelopeMedianSlopeDegrees": round(action_median_slope, 3),
        "surroundingEightToTwentyFiveMetreMedianSlopeDegrees": round(surrounding_median_slope, 3),
        "olderFlowContactMedianSlopeDegrees": round(contact_median_slope, 3),
        "nearLevelAreaWithinThirtyFiveMetresM2": near_level_area,
    }
    return canvas, metrics


def render_heightfield_camera(
    study: Any,
    height: np.ndarray,
    thickness: np.ndarray,
    eye: tuple[float, float, float],
    target: tuple[float, float, float],
    *,
    size: tuple[int, int] = (1800, 1000),
    vertical_fov_degrees: float = 50.0,
) -> Image.Image:
    """Render a lightweight perspective proof from the runtime camera contract."""

    width, image_height = size
    canvas = Image.new("RGB", size, PAPER)
    draw = ImageDraw.Draw(canvas)
    for y in range(image_height):
        t = y / max(1, image_height - 1)
        color = (
            round(10 + 14 * t),
            round(11 + 10 * t),
            round(15 + 7 * t),
        )
        draw.line((0, y, width, y), fill=color)

    eye_v = np.asarray(eye, dtype=float)
    target_v = np.asarray(target, dtype=float)
    forward = target_v - eye_v
    forward /= np.linalg.norm(forward)
    world_up = np.asarray((0.0, 1.0, 0.0), dtype=float)
    right = np.cross(forward, world_up)
    right /= np.linalg.norm(right)
    camera_up = np.cross(right, forward)
    focal = (image_height * 0.5) / math.tan(math.radians(vertical_fov_degrees) * 0.5)

    step = 3
    terrain_x = study.X_GRID[::step, ::step]
    terrain_z = study.Z_GRID[::step, ::step]
    terrain_y = height[::step, ::step]
    vertices = np.stack((terrain_x, terrain_y, terrain_z), axis=-1)
    relative = vertices - eye_v
    camera_x = np.tensordot(relative, right, axes=([-1], [0]))
    camera_y = np.tensordot(relative, camera_up, axes=([-1], [0]))
    camera_z = np.tensordot(relative, forward, axes=([-1], [0]))
    safe_z = np.maximum(camera_z, 0.01)
    screen_x = width * 0.5 + focal * camera_x / safe_z
    screen_y = image_height * 0.5 - focal * camera_y / safe_z
    terrain_min = float(height.min())
    terrain_span = max(1.0, float(height.max() - height.min()))
    triangles: list[tuple[float, tuple[tuple[int, int], tuple[int, int], tuple[int, int]], tuple[int, int, int]]] = []
    rows, columns = terrain_y.shape
    for row in range(rows - 1):
        for column in range(columns - 1):
            for indices in (
                ((row, column), (row, column + 1), (row + 1, column + 1)),
                ((row, column), (row + 1, column + 1), (row + 1, column)),
            ):
                depths = [float(camera_z[r, c]) for r, c in indices]
                if min(depths) <= 0.35:
                    continue
                polygon = tuple((round(float(screen_x[r, c])), round(float(screen_y[r, c]))) for r, c in indices)
                if max(point[0] for point in polygon) < -20 or min(point[0] for point in polygon) > width + 20:
                    continue
                if max(point[1] for point in polygon) < -20 or min(point[1] for point in polygon) > image_height + 20:
                    continue
                mean_elevation = sum(float(terrain_y[r, c]) for r, c in indices) / 3.0
                elevation_t = np.clip((mean_elevation - terrain_min) / terrain_span, 0.0, 1.0)
                world_points = [vertices[r, c] for r, c in indices]
                normal = np.cross(world_points[1] - world_points[0], world_points[2] - world_points[0])
                normal_length = float(np.linalg.norm(normal))
                if normal_length > 0.0001:
                    normal /= normal_length
                if normal[1] < 0.0:
                    normal *= -1.0
                light = np.asarray((-0.48, 0.78, -0.39), dtype=float)
                light /= np.linalg.norm(light)
                shade = 0.34 + 0.66 * max(0.0, float(np.dot(normal, light)))
                contour_band = 0.91 if int(math.floor(mean_elevation / 7.5)) % 2 else 1.0
                base = np.asarray(
                    (
                        54.0 + 38.0 * elevation_t,
                        48.0 + 27.0 * elevation_t,
                        47.0 + 19.0 * elevation_t,
                    )
                )
                lit = base * shade * contour_band
                fog = np.clip((sum(depths) / 3.0 - 80.0) / 300.0, 0.0, 0.58)
                fog_color = np.asarray((35.0, 30.0, 31.0))
                color = tuple(int(value) for value in np.clip(lit * (1.0 - fog) + fog_color * fog, 0.0, 255.0))
                triangles.append((sum(depths) / 3.0, polygon, color))
    triangles.sort(key=lambda item: item[0], reverse=True)
    for _, polygon, color in triangles:
        draw.polygon(polygon, fill=color)

    def project(point: tuple[float, float, float]) -> tuple[int, int] | None:
        relative_point = np.asarray(point, dtype=float) - eye_v
        depth = float(np.dot(relative_point, forward))
        if depth <= 0.35:
            return None
        px = width * 0.5 + focal * float(np.dot(relative_point, right)) / depth
        py = image_height * 0.5 - focal * float(np.dot(relative_point, camera_up)) / depth
        return round(px), round(py)

    # Draw the solver-derived centreline rather than inflating coarse raster
    # cells into foreground polygons.  The measured plan remains the footprint
    # proof; this frame is strictly a composition and vertical-scale proof.
    active = thickness > 0.01
    lava_world: list[tuple[float, float, float]] = []
    for row in range(active.shape[0] - 1, -1, -1):
        columns = np.flatnonzero(active[row])
        if columns.size == 0:
            continue
        column = int(round(float(np.median(columns))))
        x = float(study.X_VALUES[column])
        z = float(study.Z_VALUES[row])
        y = study.sample_height(height, x, z) + 0.22
        lava_world.append((x, y, z))
    projected_lava: list[tuple[int, int]] = []
    for point in lava_world:
        projected = project(point)
        if projected is None:
            if len(projected_lava) >= 2:
                draw.line(projected_lava, fill=LAVA, width=11, joint="curve")
                draw.line(projected_lava, fill=LAVA_HOT, width=4, joint="curve")
            projected_lava = []
            continue
        if -80 <= projected[0] <= width + 80 and -80 <= projected[1] <= image_height + 80:
            projected_lava.append(projected)
        elif len(projected_lava) >= 2:
            draw.line(projected_lava, fill=LAVA, width=11, joint="curve")
            draw.line(projected_lava, fill=LAVA_HOT, width=4, joint="curve")
            projected_lava = []
    if len(projected_lava) >= 2:
        draw.line(projected_lava, fill=LAVA, width=11, joint="curve")
        draw.line(projected_lava, fill=LAVA_HOT, width=4, joint="curve")

    performer_ground = study.sample_height(height, 0.0, 0.0)
    feet = project((0.0, performer_ground + 0.05, 0.0))
    shoulders = project((0.0, performer_ground + 1.45, 0.0))
    head = project((0.0, performer_ground + 1.78, 0.0))
    if feet and shoulders and head:
        draw.line((feet, shoulders), fill=STAGE, width=8)
        radius = max(7, abs(shoulders[1] - head[1]) // 2)
        draw.ellipse((head[0] - radius, head[1] - radius, head[0] + radius, head[1] + radius), fill=STAGE)
        draw.line((shoulders[0] - 18, shoulders[1] + 12, shoulders[0] + 18, shoulders[1] + 12), fill=STAGE, width=6)

    return canvas


def viewpoint_board(study: Any, height: np.ndarray, thickness: np.ndarray) -> tuple[Image.Image, dict[str, Any]]:
    canvas = Image.new("RGB", (3840, 1320), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 34), "EXACT RUNTIME ORBIT PROOF · SAME TARGET, OPPOSITE SIDES", font=FONT_44, fill=INK)
    draw.text((62, 92), "50° vertical FOV · 25.000 m eye-to-target · no camera cheat · performer remains the target", font=FONT_22, fill=MUTED)
    performer_ground = study.sample_height(height, 0.0, 0.0)
    uphill_rise = float(height.max() - performer_ground)
    downhill_fall = float(performer_ground - height.min())
    target = (0.0, performer_ground + study.CAMERA_TARGET_HEIGHT_M, 0.0)
    vertical_delta = study.CAMERA_HEIGHT_M - study.CAMERA_TARGET_HEIGHT_M
    horizontal_radius = math.sqrt(study.ORBIT_RADIUS_M**2 - vertical_delta**2)
    uphill_eye = (0.0, performer_ground + study.CAMERA_HEIGHT_M, -horizontal_radius)
    downhill_eye = (0.0, performer_ground + study.CAMERA_HEIGHT_M, horizontal_radius)
    uphill = render_heightfield_camera(study, height, thickness, uphill_eye, target)
    downhill = render_heightfield_camera(study, height, thickness, downhill_eye, target)
    canvas.paste(uphill, (60, 190))
    canvas.paste(downhill, (1980, 190))
    draw.rectangle((60, 190, 1860, 1190), outline=HEADWALL, width=4)
    draw.rectangle((1980, 190, 3780, 1190), outline=TALUS, width=4)
    label(draw, (92, 220), f"LOOK UPHILL · +{uphill_rise:.0f} m mountain rise", color=HEADWALL)
    label(draw, (2012, 220), f"LOOK DOWNHILL · -{downhill_fall:.0f} m fall to lower country", color=TALUS)
    draw.text((62, 1222), "Audience-side camera sees fire and continuing mountain behind the performer.", font=FONT_18, fill=MUTED)
    draw.text((1982, 1222), "Opposite orbit camera sees the world fall away behind the performer.", font=FONT_18, fill=MUTED)
    return canvas, {
        "verticalFovDegrees": 50.0,
        "eyeToTargetDistanceM": study.ORBIT_RADIUS_M,
        "horizontalOrbitRadiusM": round(horizontal_radius, 6),
        "targetRuntimeXYZ": [round(float(value), 6) for value in target],
        "uphillEyeRuntimeXYZ": [round(float(value), 6) for value in uphill_eye],
        "downhillEyeRuntimeXYZ": [round(float(value), 6) for value in downhill_eye],
    }


def calibration_board(study: Any, height: np.ndarray, manifest: dict[str, Any]) -> Image.Image:
    canvas = Image.new("RGBA", (3840, 1280), (*PAPER, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 38), "FLOWY CALIBRATION SWEEP · SAME CORRECTED DEM", font=FONT_44, fill=INK)
    draw.text((62, 96), "Orange is solver output. Green cards cross the slanted mid-flank, preserve performer clearance, and continue through the south boundary.", font=FONT_22, fill=MUTED)
    results = manifest.get("results", [])
    panel_width = 720
    for index, result in enumerate(results):
        x0 = 50 + index * 755
        y0 = 160
        rect = (x0, y0, x0 + panel_width, y0 + 925)
        border = PASS if result.get("eligible") else FAIL
        draw.rounded_rectangle(rect, radius=18, fill=PANEL, outline=border, width=4)
        output = read_esri_ascii(Path(result["output"]))
        map_rect = (x0 + 25, y0 + 78, x0 + panel_width - 25, y0 + 650)
        terrain = (
            study.terrain_image(height, (map_rect[2] - map_rect[0], map_rect[3] - map_rect[1]))
            .transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            .convert("RGBA")
        )
        canvas.alpha_composite(terrain, (map_rect[0], map_rect[1]))
        add_raster_overlay(canvas, output > 0.01, map_rect, LAVA, 170)
        draw = ImageDraw.Draw(canvas)
        stage = world_to_pixel(study, 0.0, 0.0, map_rect)
        action = metres_to_pixels(study, study.ACTION_RADIUS_M, map_rect)
        draw.ellipse((stage[0] - action, stage[1] - action, stage[0] + action, stage[1] + action), fill=STAGE, outline=PAPER, width=2)
        draw.text((x0 + 25, y0 + 24), result["calibrationId"], font=FONT_26, fill=INK)
        bounds = result["boundsRuntimeXZ"]
        status = "ELIGIBLE" if result.get("eligible") else "REJECT"
        draw.text((x0 + 25, y0 + 680), status, font=FONT_26, fill=border)
        draw.text((x0 + 25, y0 + 729), f"mid-flank pass cells = {result['midflankPassActiveCellCount']}", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 765), f"action clearance = {result['clearanceBeyondActionEnvelopeM']:.1f} m", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 801), f"downstream median width = {result['downstreamMedianWidthM']:.1f} m", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 837), f"south-exit cells = {result['southExitActiveCellCount']}", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 873), "Targets: pass ≥ 12 · exit ≥ 8 · clearance ≥ 2.5 m · no occupied-row gaps", font=FONT_16, fill=MUTED)
    draw.text(
        (60, 1150),
        f"Selection status: {manifest.get('selectionStatus')} · selected: {manifest.get('selectedCalibration')}",
        font=FONT_26,
        fill=PASS if manifest.get("selectionStatus", "").startswith("selected-") else FAIL,
    )
    draw.text((60, 1192), "Preproduction morphology evidence only; terrain and parameters are not calibrated to a named eruption.", font=FONT_18, fill=MUTED)
    return canvas


def sightline_board(study: Any, height: np.ndarray) -> tuple[Image.Image, list[dict[str, Any]]]:
    sightlines = study.sightline_clearance(height)
    canvas = Image.new("RGB", (2400, 1320), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 42), "EIGHT-POINT ORBIT SIGHTLINE STUDY", font=FONT_44, fill=INK)
    draw.text((66, 101), "Camera eye +8.25 m · target +1.75 m · exact 25 m eye-to-target cap", font=FONT_22, fill=MUTED)
    cx, cy = 760, 720
    radius = 465
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=GRID, width=3)
    draw.ellipse((cx - 80, cy - 80, cx + 80, cy + 80), fill=STAGE, outline=PAPER, width=3)
    draw.text((cx - 67, cy - 15), "PERFORMER", font=FONT_18, fill=PAPER)
    for result in sightlines:
        angle_deg = float(result["bearingDegreesClockwiseFromAudience"])
        angle = math.radians(angle_deg)
        px = cx + math.sin(angle) * radius
        py = cy + math.cos(angle) * radius
        clear = bool(result["clear"])
        color = PASS if clear else FAIL
        draw.line((round(px), round(py), cx, cy), fill=(*color,), width=4)
        draw.ellipse((round(px) - 28, round(py) - 28, round(px) + 28, round(py) + 28), fill=color, outline=PAPER, width=2)
        draw.text((round(px) - 17, round(py) - 11), f"{int(angle_deg)}°", font=FONT_16, fill=PAPER)

    card = (1370, 220, 2300, 1180)
    draw.rounded_rectangle(card, radius=18, fill=PANEL, outline=GRID, width=2)
    draw.text((1410, 260), "MEASURED CLEARANCE", font=FONT_26, fill=CYAN)
    y = 330
    for result in sightlines:
        clear = bool(result["clear"])
        draw.text(
            (1410, y),
            f"{int(result['bearingDegreesClockwiseFromAudience']):03d}°",
            font=FONT_22,
            fill=INK,
        )
        draw.text(
            (1540, y),
            f"{float(result['minimumTerrainClearanceM']):6.3f} m",
            font=FONT_22,
            fill=PASS if clear else FAIL,
        )
        draw.text((1830, y), "CLEAR" if clear else "BLOCKED", font=FONT_22, fill=PASS if clear else FAIL)
        y += 91
    draw.text((1410, 1088), "Required: all eight > 0.15 m", font=FONT_18, fill=MUTED)
    return canvas, sightlines


def contact_sheet(paths: list[Path]) -> Image.Image:
    canvas = Image.new("RGB", (3840, 2160), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 35), "EMBER MID-FLANK FIRE PILGRIMAGE · GATE 1.1 R5 REVIEW", font=FONT_44, fill=INK)
    draw.text(
        (62, 93),
        "North-up plan · true-scale section · exact uphill/downhill orbit proof · performance-ground clarification",
        font=FONT_22,
        fill=MUTED,
    )
    slots = ((45, 150, 1905, 1135), (1935, 150, 3795, 1135), (45, 1165, 1905, 2120), (1935, 1165, 3795, 2120))
    for path, slot in zip(paths, slots):
        image = Image.open(path).convert("RGB")
        image.thumbnail((slot[2] - slot[0], slot[3] - slot[1]), Image.Resampling.LANCZOS)
        x = slot[0] + (slot[2] - slot[0] - image.width) // 2
        y = slot[1] + (slot[3] - slot[1] - image.height) // 2
        canvas.paste(image, (x, y))
        draw.rectangle((x, y, x + image.width, y + image.height), outline=GRID, width=2)
    return canvas


def build() -> dict[str, Any]:
    study = load_module(STUDY_SCRIPT, "ember_geology_study_r5")
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    height = study.candidate_height(candidate, revision="r5")
    masks = study.midflank_r5_masks()
    manifest = json.loads(SIMULATOR_MANIFEST.read_text(encoding="utf-8"))
    selected = selected_result(manifest)
    thickness = read_esri_ascii(Path(selected["output"]))
    ground_metrics = performance_ground_metrics(study, height, thickness, masks, selected)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SELECTED_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    SELECTED_DATA_PATH.write_bytes(np.asarray(thickness, dtype="<f4").tobytes(order="C"))
    map_panel(study, height, thickness, masks, (2400, 2400)).convert("RGB").save(PLAN_PATH, optimize=True)
    sections, section_metrics = section_board(study, candidate, height)
    sections.save(SECTIONS_PATH, optimize=True)
    viewpoints, viewpoint_metrics = viewpoint_board(study, height, thickness)
    viewpoints.save(VIEWPOINTS_PATH, optimize=True)
    sightlines, sightline_metrics = sightline_board(study, height)
    sightlines.save(SIGHTLINES_PATH, optimize=True)
    calibration_board(study, height, manifest).convert("RGB").save(CALIBRATION_PATH, optimize=True)
    performance_ground_board(study, height, thickness, masks, ground_metrics).convert("RGB").save(
        GROUND_DETAIL_PATH,
        optimize=True,
    )
    contact_sheet([PLAN_PATH, SECTIONS_PATH, VIEWPOINTS_PATH, GROUND_DETAIL_PATH]).save(CONTACT_PATH, optimize=True)

    stable_patch = masks["stablePatch"] >= 0.98
    stable_x = study.X_GRID[stable_patch]
    stable_z = study.Z_GRID[stable_patch]
    contact = masks["olderFlowContact"] >= 0.5
    contact_x = study.X_GRID[contact]
    contact_z = study.Z_GRID[contact]
    report = {
        "schemaVersion": 1,
        "sceneId": "ember-broken-rift",
        "directionId": "midflank-fire-pilgrimage-r5",
        "gateId": "measured-plan",
        "status": "ready-for-review",
        "artifact": "Ember Mid-Flank Fire Pilgrimage Gate 1.1 R5 slanted-flank correction",
        "generatedBy": "scripts/build-ember-geology-amendment.py",
        "terrainOwner": "scripts/build-ember-geology-study.py#midflank_height_r5",
        "simulatorCalibrationOwner": "scripts/prepare-ember-lava-simulator-benchmark.py",
        "museumTracker": {
            "midflankRequirement": "BvN1DiylOnfdbrofcwaM",
            "broadLedgeRejection": "Vwm6XTLdDbDfxuoVE7z9",
            "r5CandidateProposal": "5P5KVEq04dpHxu9F0ViI",
            "performanceGroundDetailProposal": "LfdgqBhR1T31jk77cFhf",
            "gate1R5CompletionReference": "Iur86OmZX40nTqdwgxDq",
            "historicalGate1R4Approval": "xFcagbaZTQAq615IbZgT",
            "historicalGate1R4Completion": "FZftIaWtEdGTrqXRv9JS",
        },
        "worldContract": {
            "runtimeXRangeM": list(study.WORLD_X),
            "runtimeZRangeM": list(study.WORLD_Z),
            "gridColumns": study.GRID_COLUMNS,
            "gridRows": study.GRID_ROWS,
            "cellSizeM": 1.0,
            "actionRadiusM": study.ACTION_RADIUS_M,
            "interactiveOrbitCapM": study.ORBIT_RADIUS_M,
            "sourceRuntimeXZ": list(study.R5_MIDFLANK_SOURCE),
            "downslopeExitRuntimeXZ": list(study.R5_DOWNSLOPE_EXIT),
            "drainageCenterlineRuntimeXZ": [list(point) for point in study.R5_MIDFLANK_FLOW_PATH],
        },
        "terrainMetrics": {
            "minimumElevationM": round(float(height.min()), 3),
            "maximumElevationM": round(float(height.max()), 3),
            "performerElevationM": round(study.sample_height(height, 0.0, 0.0), 3),
            "stablePatchCoreBoundsRuntimeXZ": {
                "minX": round(float(stable_x.min()), 3),
                "maxX": round(float(stable_x.max()), 3),
                "minZ": round(float(stable_z.min()), 3),
                "maxZ": round(float(stable_z.max()), 3),
            },
            "stablePatchCoreWidthXM": round(float(np.ptp(stable_x)), 3),
            "stablePatchCoreWidthZM": round(float(np.ptp(stable_z)), 3),
            "stablePatchCoreAreaM2": int(np.count_nonzero(stable_patch)),
            "olderFlowContactBoundsRuntimeXZ": {
                "minX": round(float(contact_x.min()), 3),
                "maxX": round(float(contact_x.max()), 3),
                "minZ": round(float(contact_z.min()), 3),
                "maxZ": round(float(contact_z.max()), 3),
            },
            **section_metrics,
        },
        "simulator": {
            "implementation": manifest["implementation"],
            "selectionStatus": manifest.get("selectionStatus"),
            "selectedCalibration": manifest.get("selectedCalibration"),
            "selectedResult": selected,
            "calibrations": manifest["calibrations"],
            "thresholds": {
                "activeThicknessM": manifest["activeThicknessThresholdM"],
                "clearanceBeyondActionEnvelopeM": manifest["requiredClearanceBeyondActionEnvelopeM"],
                "midflankPassCellCount": manifest["requiredMidflankPassCellCount"],
                "southExitCellCount": manifest["requiredSouthExitCellCount"],
                "downstreamMedianWidthM": manifest["requiredDownstreamMedianWidthM"],
            },
            "calibrationManifest": str(SIMULATOR_MANIFEST),
            "provenanceDigests": {
                "flowyBinarySha256": manifest["implementation"]["binarySha256"],
                "demSha256": manifest["dem"]["sha256"],
                "selectedInputTomlSha256": manifest["inputTomlSha256"][manifest["selectedCalibration"]],
                "selectedOutputAscSha256": manifest["selectedOutputSha256"],
                "calibrationManifestSha256": sha256_path(SIMULATOR_MANIFEST),
            },
            "selectedData": {
                "path": rel(SELECTED_DATA_PATH),
                "format": "little-endian float32, row-major, runtime Z ascending",
                "columns": study.GRID_COLUMNS,
                "rows": study.GRID_ROWS,
                "sha256": sha256_path(SELECTED_DATA_PATH),
            },
        },
        "runtimeViewpointProof": viewpoint_metrics,
        "orbitSightlines": sightline_metrics,
        "performanceGround": {
            **ground_metrics,
            "geometryClassification": "invention",
            "geologicalRead": "Old, cooled lava bench embedded in the sloping older-flow contact.",
            "authoredIntervention": "The Order clears loose clinker without cutting a geometric platform.",
            "audienceRelationship": "A few standing pockets follow the contour downslope and laterally, outside the protected action envelope.",
            "materialClassification": "invention reserved for Gate 3",
            "materialProposal": "A subtle darker and denser read belongs to the entire old-flow contact, not a circular stage shader.",
            "thermalResponseClassification": "invention reserved for Gate 3/4",
            "thermalResponseProposal": "Low-area pulse only in pre-existing peripheral fractures; the cooled surface underfoot remains non-emissive.",
            "rejectedReads": [
                "floating disc",
                "circular stage shader",
                "radial crack graphic",
                "lava moat",
                "broad level shelf",
                "hot floor under performers",
            ],
        },
        "evidence": [
            rel(PLAN_PATH),
            rel(SECTIONS_PATH),
            rel(VIEWPOINTS_PATH),
            rel(SIGHTLINES_PATH),
            rel(CALIBRATION_PATH),
            rel(GROUND_DETAIL_PATH),
            rel(CONTACT_PATH),
            rel(SELECTED_DATA_PATH),
        ],
        "evidenceDigests": {
            rel(path): sha256_path(path)
            for path in (
                PLAN_PATH,
                SECTIONS_PATH,
                VIEWPOINTS_PATH,
                SIGHTLINES_PATH,
                CALIBRATION_PATH,
                GROUND_DETAIL_PATH,
                CONTACT_PATH,
                SELECTED_DATA_PATH,
            )
        },
        "limitations": manifest["limitations"],
        "readyForReview": bool(
            manifest.get("selectionStatus", "").startswith("selected-")
            and all(bool(item["clear"]) for item in sightline_metrics)
            and section_metrics["actionEnvelopeLocalReliefM"] <= 0.35
            and section_metrics["actionEnvelopeMedianSlopeDegrees"] <= 2.0
            and 6.0 <= section_metrics["surroundingEightToTwentyFiveMetreMedianSlopeDegrees"] <= 10.0
            and 6.0 <= section_metrics["olderFlowContactMedianSlopeDegrees"] <= 10.0
            and section_metrics["nearLevelAreaWithinThirtyFiveMetresM2"] <= 150
            and 9.0 <= float(np.ptp(stable_x)) <= 15.0
            and 9.0 <= float(np.ptp(stable_z)) <= 15.0
            and section_metrics["uphillRiseAbovePerformerM"] >= 100.0
            and section_metrics["downhillFallBelowPerformerM"] >= 60.0
            and section_metrics["totalVerticalSpanM"] >= 180.0
            and section_metrics["verticalExaggeration"] == 1.0
            and bool(selected["passesMidflank"])
            and bool(selected["reachesDownslopeExit"])
            and bool(selected["continuousDownslope"])
            and bool(selected["meetsActionClearance"])
            and bool(selected["meetsDownstreamWidth"])
        ),
    }
    write_json(REPORT_PATH, report)
    return report


def verify() -> dict[str, Any]:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    checks = {
        "ready-for-review": bool(report["readyForReview"]),
        "north-up-plan": PLAN_PATH.exists() and Image.open(PLAN_PATH).size == (2400, 2400),
        "true-scale-section": (
            SECTIONS_PATH.exists()
            and Image.open(SECTIONS_PATH).size == (2400, 1800)
            and float(report["terrainMetrics"]["verticalExaggeration"]) == 1.0
        ),
        "runtime-uphill-downhill-proof": VIEWPOINTS_PATH.exists() and Image.open(VIEWPOINTS_PATH).size == (3840, 1320),
        "performance-ground-clarification": (
            GROUND_DETAIL_PATH.exists()
            and Image.open(GROUND_DETAIL_PATH).size == (2400, 1800)
            and report["performanceGround"]["geometryClassification"] == "invention"
            and report["performanceGround"]["thermalResponseClassification"] == "invention reserved for Gate 3/4"
        ),
        "audience-standing-pockets": (
            len(report["performanceGround"]["audienceStandingPoints"]) == len(AUDIENCE_STANDING_POINTS)
            and all(
                bool(point["withinOlderFlowContact"])
                and float(point["terrainSlopeDegrees"]) <= 12.0
                and float(point["clearanceBeyondActionEnvelopeM"]) >= 3.0
                and float(point["activeFlowClearanceM"]) >= 3.0
                for point in report["performanceGround"]["audienceStandingPoints"]
            )
        ),
        "eight-sightlines": len(report["orbitSightlines"]) == 8 and all(item["clear"] for item in report["orbitSightlines"]),
        "small-irregular-stable-patch": (
            9.0 <= float(report["terrainMetrics"]["stablePatchCoreWidthXM"]) <= 15.0
            and 9.0 <= float(report["terrainMetrics"]["stablePatchCoreWidthZM"]) <= 15.0
            and int(report["terrainMetrics"]["stablePatchCoreAreaM2"]) <= 200
        ),
        "walkable-action-envelope": float(report["terrainMetrics"]["actionEnvelopeLocalReliefM"]) <= 0.35,
        "locally-eased-action-grade": float(report["terrainMetrics"]["actionEnvelopeMedianSlopeDegrees"]) <= 2.0,
        "continuous-surrounding-grade": 6.0 <= float(report["terrainMetrics"]["surroundingEightToTwentyFiveMetreMedianSlopeDegrees"]) <= 10.0,
        "sloping-old-flow-contact": 6.0 <= float(report["terrainMetrics"]["olderFlowContactMedianSlopeDegrees"]) <= 10.0,
        "no-broad-near-level-platform": int(report["terrainMetrics"]["nearLevelAreaWithinThirtyFiveMetresM2"]) <= 150,
        "mountain-rises-above-performer": float(report["terrainMetrics"]["uphillRiseAbovePerformerM"]) >= 100.0,
        "country-falls-below-performer": float(report["terrainMetrics"]["downhillFallBelowPerformerM"]) >= 60.0,
        "world-scale-vertical-span": float(report["terrainMetrics"]["totalVerticalSpanM"]) >= 180.0,
        "simulator-midflank-pass": bool(report["simulator"]["selectedResult"]["passesMidflank"]),
        "simulator-downslope-exit": bool(report["simulator"]["selectedResult"]["reachesDownslopeExit"]),
        "simulator-continuity": bool(report["simulator"]["selectedResult"]["continuousDownslope"]),
        "simulator-clearance": bool(report["simulator"]["selectedResult"]["meetsActionClearance"]),
        "simulator-downstream-width": bool(report["simulator"]["selectedResult"]["meetsDownstreamWidth"]),
        "selected-data-digest": (
            SELECTED_DATA_PATH.exists()
            and SELECTED_DATA_PATH.stat().st_size == 381 * 336 * 4
            and sha256_path(SELECTED_DATA_PATH) == report["simulator"]["selectedData"]["sha256"]
        ),
    }
    result = {
        "passed": all(checks.values()),
        "checks": checks,
        "reportSha256": sha256_path(REPORT_PATH),
        "evidenceSha256": {
            rel(path): sha256_path(path)
            for path in (
                PLAN_PATH,
                SECTIONS_PATH,
                VIEWPOINTS_PATH,
                SIGHTLINES_PATH,
                CALIBRATION_PATH,
                GROUND_DETAIL_PATH,
                CONTACT_PATH,
            )
        },
    }
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        raise SystemExit(1)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build", "verify"))
    args = parser.parse_args()
    if args.command == "build":
        report = build()
        print(f"Wrote Gate 1.1 evidence to {OUTPUT_DIR}")
        print(f"Ready for review: {report['readyForReview']}")
    else:
        verify()


if __name__ == "__main__":
    main()
