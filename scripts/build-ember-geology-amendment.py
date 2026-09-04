"""Build Ember's Gate 1.1 measured-plan regression package.

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
    "E:/tka-platform-ember-geology-sources/ember-simulator-benchmark/gate-1-1-r2"
)
SIMULATOR_MANIFEST = SIMULATOR_ROOT / "calibration-manifest.json"
OUTPUT_DIR = (
    ROOT
    / "docs/superpowers/specs/ember-spatial-directions/evidence/gate-1-1-geology-amendment-r2"
)
REPORT_PATH = OUTPUT_DIR / "ember-breached-rift-bench-gate1-1-report.json"
PLAN_PATH = OUTPUT_DIR / "01-north-up-measured-plan.png"
SECTIONS_PATH = OUTPUT_DIR / "02-measured-sections.png"
SIGHTLINES_PATH = OUTPUT_DIR / "03-orbit-sightline-study.png"
CALIBRATION_PATH = OUTPUT_DIR / "04-flowy-calibration-sweep.png"
CONTACT_PATH = OUTPUT_DIR / "ember-breached-rift-bench-gate1-1-contact-sheet.png"
SELECTED_DATA_PATH = ROOT / "static/data/ember/review/ember-breached-rift-bench-r2-flowy-thickness.f32"

INK = (235, 237, 239)
MUTED = (155, 165, 174)
PAPER = (11, 14, 18)
PANEL = (20, 25, 31)
GRID = (64, 73, 82)
CYAN = (89, 214, 224)
LAVA = (255, 91, 33)
LAVA_HOT = (255, 201, 84)
HEADWALL = (209, 177, 124)
BREACH = (225, 93, 73)
TALUS = (173, 132, 92)
STAGE = (231, 242, 244)
PASS = (109, 207, 137)
FAIL = (237, 112, 94)


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


def map_panel(
    study: Any,
    height: np.ndarray,
    thickness: np.ndarray,
    masks: dict[str, np.ndarray],
    size: tuple[int, int],
) -> Image.Image:
    canvas = Image.new("RGBA", size, (*PAPER, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 42), "EMBER GATE 1.1 · NORTH-UP MEASURED PLAN", font=FONT_44, fill=INK)
    draw.text(
        (66, 101),
        "Corrected terrain shelf, explicit collapse anatomy, and simulator-owned lava footprint",
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
    add_raster_overlay(canvas, study.contour_mask(height, interval=2.0), rect, INK, 64)

    add_raster_overlay(canvas, thickness > 0.01, rect, LAVA, 150)
    add_raster_overlay(canvas, masks["survivingHeadwall"], rect, HEADWALL, 245, edges_only=True)
    add_raster_overlay(canvas, masks["collapseBreach"], rect, BREACH, 220, edges_only=True)
    add_raster_overlay(canvas, masks["talusApron"], rect, TALUS, 210, edges_only=True)
    add_raster_overlay(canvas, masks["performanceShelf"], rect, CYAN, 210, edges_only=True)

    draw = ImageDraw.Draw(canvas)
    stage = world_to_pixel(study, 0.0, 0.0, rect)
    action = metres_to_pixels(study, study.ACTION_RADIUS_M, rect)
    orbit = metres_to_pixels(study, study.ORBIT_RADIUS_M, rect)
    draw.ellipse((stage[0] - orbit, stage[1] - orbit, stage[0] + orbit, stage[1] + orbit), outline=(*CYAN, 210), width=3)
    draw.ellipse((stage[0] - action, stage[1] - action, stage[0] + action, stage[1] + action), fill=(*STAGE, 245), outline=(*PAPER, 255), width=3)
    draw.line((stage[0] - 10, stage[1], stage[0] + 10, stage[1]), fill=PAPER, width=3)
    draw.line((stage[0], stage[1] - 10, stage[0], stage[1] + 10), fill=PAPER, width=3)

    source = world_to_pixel(study, -72.0, 137.0, rect)
    draw.polygon(
        ((source[0], source[1] - 13), (source[0] - 12, source[1] + 10), (source[0] + 12, source[1] + 10)),
        fill=LAVA_HOT,
        outline=PAPER,
    )
    draw.line((rect[0], rect[3] - 5, rect[2], rect[3] - 5), fill=LAVA_HOT, width=5)

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

    label(draw, (source[0] + 20, source[1] - 28), "1 · FISSURE SOURCE", color=LAVA_HOT)
    headwall_pt = world_to_pixel(study, -125.0, 108.0, rect)
    label(draw, (headwall_pt[0] - 100, headwall_pt[1] - 32), "SURVIVING HEADWALL", color=HEADWALL)
    breach_pt = world_to_pixel(study, -58.0, 103.0, rect)
    label(draw, (breach_pt[0] + 15, breach_pt[1] - 35), "2 · MISSING COLLAPSE VOLUME", color=BREACH)
    talus_pt = world_to_pixel(study, -60.0, 63.0, rect)
    label(draw, (talus_pt[0] - 110, talus_pt[1] + 36), "3 · TALUS RUNOUT", color=TALUS)
    label(draw, (stage[0] - 245, stage[1] + 53), "4 · IRREGULAR OLD-FLOW SHELF", color=CYAN)
    label(draw, (stage[0] - 58, stage[1] - 48), "PERFORMER", color=INK)
    flow_mid = world_to_pixel(study, 21.0, -42.0, rect)
    label(draw, (flow_mid[0] + 34, flow_mid[1] - 10), "5 · SIMULATED ACTIVE FOOTPRINT", color=LAVA_HOT)
    label(draw, (rect[2] - 302, rect[3] - 52), "6 · SOUTH CONTINUATION", color=LAVA_HOT)
    audience = world_to_pixel(study, 0.0, -21.5, rect)
    draw.polygon(
        ((audience[0], audience[1] - 12), (audience[0] - 11, audience[1] + 10), (audience[0] + 11, audience[1] + 10)),
        fill=INK,
        outline=PAPER,
    )
    draw.line((audience[0], audience[1] - 15, stage[0], stage[1] + 14), fill=(*INK,), width=2)
    label(draw, (audience[0] - 308, audience[1] + 24), "VIEWER ENTRY · DEFAULT AUDIENCE CAMERA", color=INK)
    east_pt = world_to_pixel(study, 142.0, 32.0, rect)
    draw.line((east_pt[0] - 30, east_pt[1], east_pt[0] + 70, east_pt[1]), fill=CYAN, width=4)
    draw.polygon(((east_pt[0] + 88, east_pt[1]), (east_pt[0] + 58, east_pt[1] - 12), (east_pt[0] + 58, east_pt[1] + 12)), fill=CYAN)
    label(draw, (east_pt[0] - 64, east_pt[1] + 28), "OPEN EAST / SOUTHEAST HORIZON", color=CYAN)

    legend_y = rect[3] + 46
    draw.text((rect[0], legend_y), "PLAN CONTRACT", font=FONT_22, fill=CYAN)
    legend = (
        "380 × 335 m · 1 m DEM · white = protected 4.5 m action envelope · cyan ring = 25 m orbit · "
        "orange = Flowy cells > 0.01 m · bottom edge = downstream continuation"
    )
    draw.text((rect[0], legend_y + 38), legend, font=FONT_18, fill=MUTED)
    return canvas


def section_board(study: Any, candidate: Any, height: np.ndarray) -> tuple[Image.Image, dict[str, float]]:
    canvas = Image.new("RGB", (2400, 1400), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 42), "EMBER GATE 1.1 · MEASURED SECTIONS", font=FONT_44, fill=INK)
    draw.text((66, 101), "Natural scale labels; vertical exaggeration is stated where used", font=FONT_22, fill=MUTED)

    distances, xs, zs = study.interpolate_path(study.R2_BREACHED_RIFT_FLOW_PATH, samples=480)
    elevations = np.asarray([study.sample_height(height, float(x), float(z)) for x, z in zip(xs, zs)])
    left, top, right, bottom = 90, 210, 2310, 760
    draw.rounded_rectangle((left, top, right, bottom), radius=18, fill=PANEL, outline=GRID, width=2)
    plot = (left + 75, top + 70, right - 40, bottom - 65)
    min_e = float(elevations.min()) - 2.0
    max_e = float(elevations.max()) + 3.0

    def long_point(distance: float, elevation: float) -> tuple[int, int]:
        px = plot[0] + distance / distances[-1] * (plot[2] - plot[0])
        py = plot[3] - (elevation - min_e) / (max_e - min_e) * (plot[3] - plot[1])
        return round(px), round(py)

    points = [long_point(float(d), float(e)) for d, e in zip(distances, elevations)]
    draw.polygon(points + [(plot[2], plot[3]), (plot[0], plot[3])], fill=(47, 51, 50), outline=HEADWALL)
    for index, text in ((0, "SOURCE"), (205, "BENCH-SIDE"), (360, "SLOPE BREAK"), (479, "CONTINUATION")):
        px, py = points[index]
        draw.line((px, py - 8, px, plot[3]), fill=GRID, width=2)
        draw.text((px - 54, py - 40), text, font=FONT_16, fill=LAVA_HOT)
    draw.text((left + 24, top + 18), "LONGITUDINAL · source to south continuation · 4× vertical exaggeration", font=FONT_22, fill=INK)

    xs_cross = np.linspace(-60.0, 60.0, 400)
    cross_e = np.asarray([study.sample_height(height, float(x), 0.0) for x in xs_cross])
    c_left, c_top, c_right, c_bottom = 90, 850, 2310, 1280
    draw.rounded_rectangle((c_left, c_top, c_right, c_bottom), radius=18, fill=PANEL, outline=GRID, width=2)
    cplot = (c_left + 75, c_top + 62, c_right - 40, c_bottom - 55)
    c_min = float(cross_e.min()) - 0.7
    c_max = float(cross_e.max()) + 1.2

    def cross_point(x: float, elevation: float) -> tuple[int, int]:
        px = cplot[0] + (x - xs_cross[0]) / (xs_cross[-1] - xs_cross[0]) * (cplot[2] - cplot[0])
        py = cplot[3] - (elevation - c_min) / (c_max - c_min) * (cplot[3] - cplot[1])
        return round(px), round(py)

    cross_points = [cross_point(float(x), float(e)) for x, e in zip(xs_cross, cross_e)]
    draw.polygon(cross_points + [(cplot[2], cplot[3]), (cplot[0], cplot[3])], fill=(47, 51, 50), outline=HEADWALL)
    stage_left = cross_point(-study.ACTION_RADIUS_M, study.sample_height(height, -study.ACTION_RADIUS_M, 0.0))
    stage_right = cross_point(study.ACTION_RADIUS_M, study.sample_height(height, study.ACTION_RADIUS_M, 0.0))
    stage_y = min(stage_left[1], stage_right[1]) - 10
    draw.line((stage_left[0], stage_y, stage_right[0], stage_y), fill=STAGE, width=8)
    draw.text((stage_left[0] - 44, stage_y - 38), "9 m protected action width", font=FONT_18, fill=STAGE)
    draw.text((c_left + 24, c_top + 17), "TRANSVERSE · west headwall → irregular shelf → eastern drainage", font=FONT_22, fill=INK)
    draw.text((cplot[0], c_bottom - 38), "WEST", font=FONT_18, fill=MUTED)
    draw.text((cplot[2] - 50, c_bottom - 38), "EAST", font=FONT_18, fill=MUTED)

    local_samples = []
    for x in np.linspace(-study.ACTION_RADIUS_M, study.ACTION_RADIUS_M, 31):
        for z in np.linspace(-study.ACTION_RADIUS_M, study.ACTION_RADIUS_M, 31):
            if math.hypot(x, z) <= study.ACTION_RADIUS_M:
                local_samples.append(study.sample_height(height, float(x), float(z)))
    local_relief = max(local_samples) - min(local_samples)
    metrics = {
        "pathLengthM": round(float(distances[-1]), 3),
        "sourceElevationM": round(float(elevations[0]), 3),
        "continuationElevationM": round(float(elevations[-1]), 3),
        "netDescentM": round(float(elevations[0] - elevations[-1]), 3),
        "averageGradePercent": round(float((elevations[0] - elevations[-1]) / distances[-1] * 100.0), 3),
        "actionEnvelopeLocalReliefM": round(float(local_relief), 3),
    }
    return canvas, metrics


def calibration_board(study: Any, height: np.ndarray, manifest: dict[str, Any]) -> Image.Image:
    canvas = Image.new("RGBA", (3840, 1280), (*PAPER, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 38), "FLOWY CALIBRATION SWEEP · SAME CORRECTED DEM", font=FONT_44, fill=INK)
    draw.text((62, 96), "Orange is solver output, not an authored ribbon. Green cards meet continuation + clearance.", font=FONT_22, fill=MUTED)
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
        draw.text((x0 + 25, y0 + 729), f"south reach z = {bounds['minZ']:.1f} m", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 765), f"action clearance = {result['clearanceBeyondActionEnvelopeM']:.1f} m", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 801), f"downstream median width = {result['downstreamMedianWidthM']:.1f} m", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 837), f"widening ratio = {result['downstreamWideningRatio']:.2f}×", font=FONT_18, fill=INK)
        draw.text((x0 + 25, y0 + 873), "Targets: z ≤ −143 m · width ≥ 9 m · widening ≥ 1.25×", font=FONT_16, fill=MUTED)
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
    draw.text((66, 101), "Camera eye 7.0 m · target 1.2 m · orbit radius 25 m", font=FONT_22, fill=MUTED)
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
    draw.text((60, 35), "EMBER BREACHED RIFT BENCH · GATE 1.1 REVIEW", font=FONT_44, fill=INK)
    draw.text((62, 93), "One corrected coordinate owner · north-up plan · sections · sightlines · solver calibration", font=FONT_22, fill=MUTED)
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
    study = load_module(STUDY_SCRIPT, "ember_geology_study_r2")
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    height = study.candidate_height(candidate, revision="r2")
    masks = study.breached_rift_r2_masks()
    manifest = json.loads(SIMULATOR_MANIFEST.read_text(encoding="utf-8"))
    selected = selected_result(manifest)
    thickness = read_esri_ascii(Path(selected["output"]))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SELECTED_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    SELECTED_DATA_PATH.write_bytes(np.asarray(thickness, dtype="<f4").tobytes(order="C"))
    map_panel(study, height, thickness, masks, (2400, 2400)).convert("RGB").save(PLAN_PATH, optimize=True)
    sections, section_metrics = section_board(study, candidate, height)
    sections.save(SECTIONS_PATH, optimize=True)
    sightlines, sightline_metrics = sightline_board(study, height)
    sightlines.save(SIGHTLINES_PATH, optimize=True)
    calibration_board(study, height, manifest).convert("RGB").save(CALIBRATION_PATH, optimize=True)
    contact_sheet([PLAN_PATH, SECTIONS_PATH, SIGHTLINES_PATH, CALIBRATION_PATH]).save(CONTACT_PATH, optimize=True)

    shelf = masks["performanceShelf"] >= 0.98
    shelf_x = study.X_GRID[shelf]
    shelf_z = study.Z_GRID[shelf]
    shelf_covariance = np.cov(np.column_stack((shelf_x, shelf_z)), rowvar=False)
    shelf_eigenvalues = np.linalg.eigvalsh(shelf_covariance)
    shelf_pca_aspect = math.sqrt(float(shelf_eigenvalues[-1] / shelf_eigenvalues[0]))
    headwall = masks["survivingHeadwall"] >= 0.75
    breach = masks["collapseBreach"] >= 0.50
    headwall_relief = float(np.percentile(height[headwall], 75) - np.percentile(height[breach], 25))
    report = {
        "schemaVersion": 1,
        "artifact": "Ember Breached Rift Bench Gate 1.1 measured-plan amendment",
        "generatedBy": "scripts/build-ember-geology-amendment.py",
        "terrainOwner": "scripts/build-ember-geology-study.py#breached_rift_height_r2",
        "simulatorCalibrationOwner": "scripts/prepare-ember-lava-simulator-benchmark.py",
        "museumTracker": {
            "correctiveAuthorization": "WS9FU4nn2fCSbOn68IeB",
            "adversarialAudit": "xSjtvI2XVvvMdn8pHqwP",
            "acceptedDirection": "ZgRNLK66C9Hz2wMPbOXc",
        },
        "worldContract": {
            "runtimeXRangeM": list(study.WORLD_X),
            "runtimeZRangeM": list(study.WORLD_Z),
            "gridColumns": study.GRID_COLUMNS,
            "gridRows": study.GRID_ROWS,
            "cellSizeM": 1.0,
            "actionRadiusM": study.ACTION_RADIUS_M,
            "interactiveOrbitCapM": study.ORBIT_RADIUS_M,
            "sourceRuntimeXZ": list(candidate.source),
            "drainageCenterlineRuntimeXZ": [list(point) for point in study.R2_BREACHED_RIFT_FLOW_PATH],
        },
        "terrainMetrics": {
            "minimumElevationM": round(float(height.min()), 3),
            "maximumElevationM": round(float(height.max()), 3),
            "performerElevationM": round(study.sample_height(height, 0.0, 0.0), 3),
            "shelfCoreBoundsRuntimeXZ": {
                "minX": round(float(shelf_x.min()), 3),
                "maxX": round(float(shelf_x.max()), 3),
                "minZ": round(float(shelf_z.min()), 3),
                "maxZ": round(float(shelf_z.max()), 3),
            },
            "shelfCoreAspectRatio": round(float(np.ptp(shelf_x) / np.ptp(shelf_z)), 3),
            "shelfCorePcaAspectRatio": round(shelf_pca_aspect, 3),
            "headwallToBreachReliefM": round(headwall_relief, 3),
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
                "southContinuationRuntimeZ": manifest["continuationThresholdRuntimeZ"],
                "clearanceBeyondActionEnvelopeM": manifest["requiredClearanceBeyondActionEnvelopeM"],
                "downstreamMedianWidthM": manifest["requiredDownstreamMedianWidthM"],
                "downstreamWideningRatio": manifest["requiredDownstreamWideningRatio"],
            },
            "calibrationManifest": str(SIMULATOR_MANIFEST),
            "selectedData": {
                "path": rel(SELECTED_DATA_PATH),
                "format": "little-endian float32, row-major, runtime Z ascending",
                "columns": study.GRID_COLUMNS,
                "rows": study.GRID_ROWS,
                "sha256": sha256_path(SELECTED_DATA_PATH),
            },
        },
        "orbitSightlines": sightline_metrics,
        "evidence": [
            rel(PLAN_PATH),
            rel(SECTIONS_PATH),
            rel(SIGHTLINES_PATH),
            rel(CALIBRATION_PATH),
            rel(CONTACT_PATH),
            rel(SELECTED_DATA_PATH),
        ],
        "evidenceDigests": {
            rel(path): sha256_path(path)
            for path in (PLAN_PATH, SECTIONS_PATH, SIGHTLINES_PATH, CALIBRATION_PATH, CONTACT_PATH, SELECTED_DATA_PATH)
        },
        "limitations": manifest["limitations"],
        "readyForReview": bool(
            manifest.get("selectionStatus", "").startswith("selected-")
            and all(bool(item["clear"]) for item in sightline_metrics)
            and shelf_pca_aspect >= 1.5
            and section_metrics["actionEnvelopeLocalReliefM"] <= 0.35
            and headwall_relief >= 8.0
        ),
    }
    write_json(REPORT_PATH, report)
    return report


def verify() -> dict[str, Any]:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    checks = {
        "ready-for-review": bool(report["readyForReview"]),
        "north-up-plan": PLAN_PATH.exists() and Image.open(PLAN_PATH).size == (2400, 2400),
        "measured-sections": SECTIONS_PATH.exists() and Image.open(SECTIONS_PATH).size == (2400, 1400),
        "eight-sightlines": len(report["orbitSightlines"]) == 8 and all(item["clear"] for item in report["orbitSightlines"]),
        "non-radial-shelf": float(report["terrainMetrics"]["shelfCorePcaAspectRatio"]) >= 1.5,
        "walkable-action-envelope": float(report["terrainMetrics"]["actionEnvelopeLocalReliefM"]) <= 0.35,
        "explicit-collapse-relief": float(report["terrainMetrics"]["headwallToBreachReliefM"]) >= 8.0,
        "simulator-continuation": bool(report["simulator"]["selectedResult"]["reachesSouthContinuation"]),
        "simulator-clearance": bool(report["simulator"]["selectedResult"]["meetsActionClearance"]),
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
        "evidenceSha256": {rel(path): sha256_path(path) for path in (PLAN_PATH, SECTIONS_PATH, SIGHTLINES_PATH, CALIBRATION_PATH, CONTACT_PATH)},
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
