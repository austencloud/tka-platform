"""Compare Flowy and MrLavaLoba2 on Ember's shared preproduction DEM.

The benchmark is an implementation proof, not calibrated eruption science. It
shows whether two independently maintained lava-emplacement models respond to
the same authored terrain with a comparable gravity-led footprint. Simulator
sources and large raw outputs stay outside Git; this script records compact,
reproducible evidence in the Ember scene specification.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import math
from pathlib import Path
import textwrap

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions/evidence/gate-1-geology-restart-r1"
DEFAULT_BENCHMARK_ROOT = Path("E:/tka-platform-ember-geology-sources/ember-simulator-benchmark")

PAPER = (12, 15, 19)
PANEL = (20, 25, 31)
INK = (229, 231, 235)
MUTED = (159, 168, 178)
GRID = (67, 76, 86)
CYAN = (96, 210, 218)
ORANGE = (255, 102, 38)
YELLOW = (255, 215, 93)
CRUST = (73, 45, 38)
STAGE = (223, 237, 239)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        Path("C:/Windows/Fonts/seguisb.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf") if bold else Path("C:/Windows/Fonts/arial.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


FONT_15 = load_font(15)
FONT_17 = load_font(17)
FONT_20 = load_font(20)
FONT_22 = load_font(22, bold=True)
FONT_30 = load_font(30, bold=True)
FONT_46 = load_font(46, bold=True)


@dataclass(frozen=True)
class AscGrid:
    values: np.ndarray
    ncols: int
    nrows: int
    xll: float
    yll: float
    cellsize: float
    nodata: float

    def coordinates(self) -> tuple[np.ndarray, np.ndarray]:
        x = self.xll + np.arange(self.ncols) * self.cellsize
        z = self.yll + np.arange(self.nrows - 1, -1, -1) * self.cellsize
        return np.meshgrid(x, z)


def read_asc(path: Path) -> AscGrid:
    header: dict[str, float] = {}
    with path.open("r", encoding="utf-8") as handle:
        for _ in range(6):
            key, value = handle.readline().split(maxsplit=1)
            header[key.lower()] = float(value)
        values = np.loadtxt(handle)
    ncols = int(header["ncols"])
    nrows = int(header["nrows"])
    if values.shape != (nrows, ncols):
        raise ValueError(f"{path}: header says {(nrows, ncols)}, data is {values.shape}")
    return AscGrid(
        values=values,
        ncols=ncols,
        nrows=nrows,
        xll=header.get("xllcorner", header.get("xllcenter", 0.0)),
        yll=header.get("yllcorner", header.get("yllcenter", 0.0)),
        cellsize=header["cellsize"],
        nodata=header.get("nodata_value", -9999.0),
    )


def assert_aligned(*grids: AscGrid) -> None:
    first = grids[0]
    for grid in grids[1:]:
        same = (
            grid.values.shape == first.values.shape
            and math.isclose(grid.xll, first.xll)
            and math.isclose(grid.yll, first.yll)
            and math.isclose(grid.cellsize, first.cellsize)
        )
        if not same:
            raise ValueError("Benchmark rasters do not share a grid definition")


def hillshade(elevation: np.ndarray) -> np.ndarray:
    dz, dx = np.gradient(elevation)
    slope = np.pi / 2.0 - np.arctan(np.hypot(dx, dz))
    aspect = np.arctan2(-dx, dz)
    azimuth = math.radians(315.0)
    altitude = math.radians(34.0)
    shade = np.sin(altitude) * np.sin(slope) + np.cos(altitude) * np.cos(slope) * np.cos(azimuth - aspect)
    return np.clip((shade + 1.0) * 0.5, 0.0, 1.0)


def colorize(elevation: np.ndarray, thickness: np.ndarray | None = None) -> Image.Image:
    shade = hillshade(elevation)
    low, high = np.percentile(elevation, (1.0, 99.0))
    normalized = np.clip((elevation - low) / max(0.001, high - low), 0.0, 1.0)
    base = np.empty((*elevation.shape, 3), dtype=float)
    base[..., 0] = 23 + 66 * normalized
    base[..., 1] = 26 + 62 * normalized
    base[..., 2] = 29 + 55 * normalized
    base *= 0.52 + 0.72 * shade[..., None]

    if thickness is not None:
        active = thickness > 0.05
        strength = np.clip(np.log1p(thickness) / np.log(7.2), 0.0, 1.0)
        lava = np.empty_like(base)
        lava[..., 0] = CRUST[0] + (ORANGE[0] - CRUST[0]) * strength
        lava[..., 1] = CRUST[1] + (YELLOW[1] - CRUST[1]) * strength**2.1
        lava[..., 2] = CRUST[2] + (YELLOW[2] - CRUST[2]) * strength**2.6
        alpha = np.where(active, 0.76 + 0.22 * strength, 0.0)[..., None]
        base = base * (1.0 - alpha) + lava * alpha
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), mode="RGB")


def metrics(grid: AscGrid, source: tuple[float, float], threshold: float) -> dict[str, float | int | list[float]]:
    mask = grid.values > threshold
    values = grid.values[mask]
    x, z = grid.coordinates()
    distance = np.hypot(x[mask] - source[0], z[mask] - source[1])
    stage_distance = np.hypot(x[mask], z[mask])
    return {
        "thresholdM": threshold,
        "activeCells": int(mask.sum()),
        "footprintAreaM2": round(float(mask.sum()) * grid.cellsize**2, 3),
        "volumeAboveThresholdM3": round(float(values.sum()) * grid.cellsize**2, 3),
        "minimumThicknessM": round(float(values.min()), 6),
        "medianThicknessM": round(float(np.median(values)), 6),
        "meanThicknessM": round(float(values.mean()), 6),
        "maximumThicknessM": round(float(values.max()), 6),
        "maximumPlanarDistanceFromSourceM": round(float(distance.max()), 3),
        "minimumDistanceToStageCenterM": round(float(stage_distance.min()), 3),
        "minimumClearanceFromActionEnvelopeM": round(float(stage_distance.min() - 4.5), 3),
        "footprintBoundsXZM": [
            round(float(x[mask].min()), 3),
            round(float(z[mask].min()), 3),
            round(float(x[mask].max()), 3),
            round(float(z[mask].max()), 3),
        ],
    }


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    width: int,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    spacing: int = 5,
) -> int:
    average_character = max(6, round(getattr(font, "size", 16) * 0.53))
    wrapped = textwrap.fill(text, width=max(12, width // average_character))
    draw.multiline_text(xy, wrapped, font=font, fill=fill, spacing=spacing)
    bounds = draw.multiline_textbbox(xy, wrapped, font=font, spacing=spacing)
    return bounds[3] - bounds[1]


def world_to_panel(
    grid: AscGrid,
    point: tuple[float, float],
    rect: tuple[int, int, int, int],
) -> tuple[int, int]:
    left, top, right, bottom = rect
    x, z = point
    u = (x - grid.xll) / ((grid.ncols - 1) * grid.cellsize)
    v = 1.0 - (z - grid.yll) / ((grid.nrows - 1) * grid.cellsize)
    return round(left + u * (right - left)), round(top + v * (bottom - top))


def draw_map_panel(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    grid: AscGrid,
    elevation: np.ndarray,
    thickness: np.ndarray | None,
    title: str,
    subtitle: str,
) -> None:
    left, top, right, bottom = rect
    draw.rounded_rectangle(rect, radius=18, fill=PANEL, outline=GRID, width=2)
    draw.text((left + 22, top + 18), title, font=FONT_22, fill=INK)
    draw.text((left + 22, top + 49), subtitle, font=FONT_15, fill=MUTED)
    map_rect = (left + 22, top + 82, right - 22, bottom - 24)
    map_image = colorize(elevation, thickness).resize(
        (map_rect[2] - map_rect[0], map_rect[3] - map_rect[1]),
        Image.Resampling.LANCZOS,
    )
    canvas.paste(map_image, map_rect[:2])
    draw.rectangle(map_rect, outline=GRID, width=1)

    source_xy = world_to_panel(grid, (-72.0, 137.0), map_rect)
    stage_xy = world_to_panel(grid, (0.0, 0.0), map_rect)
    pixels_per_meter = (map_rect[2] - map_rect[0]) / ((grid.ncols - 1) * grid.cellsize)
    action_radius = round(4.5 * pixels_per_meter)
    orbit_radius = round(25.0 * pixels_per_meter)
    draw.ellipse(
        (stage_xy[0] - orbit_radius, stage_xy[1] - orbit_radius, stage_xy[0] + orbit_radius, stage_xy[1] + orbit_radius),
        outline=CYAN,
        width=2,
    )
    draw.ellipse(
        (stage_xy[0] - action_radius, stage_xy[1] - action_radius, stage_xy[0] + action_radius, stage_xy[1] + action_radius),
        fill=STAGE,
        outline=PAPER,
        width=2,
    )
    draw.line((source_xy[0] - 8, source_xy[1], source_xy[0] + 8, source_xy[1]), fill=YELLOW, width=3)
    draw.line((source_xy[0], source_xy[1] - 8, source_xy[0], source_xy[1] + 8), fill=YELLOW, width=3)
    draw.text((map_rect[0] + 14, map_rect[1] + 12), "N ↑", font=FONT_17, fill=INK)


def draw_metric_column(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    name: str,
    values: dict[str, float | int | list[float]],
) -> None:
    draw.text((x, y), name, font=FONT_22, fill=CYAN)
    rows = (
        ("Footprint", f"{values['footprintAreaM2']:,.0f} m²"),
        ("Volume", f"{values['volumeAboveThresholdM3']:,.0f} m³"),
        ("Mean thickness", f"{values['meanThicknessM']:.2f} m"),
        ("Median thickness", f"{values['medianThicknessM']:.2f} m"),
        ("Maximum thickness", f"{values['maximumThicknessM']:.2f} m"),
        ("Max source distance", f"{values['maximumPlanarDistanceFromSourceM']:.1f} m"),
        ("Action clearance", f"{values['minimumClearanceFromActionEnvelopeM']:.1f} m"),
    )
    row_y = y + 38
    for label, value in rows:
        draw.text((x, row_y), label, font=FONT_17, fill=MUTED)
        draw.text((x + 205, row_y), value, font=FONT_17, fill=INK)
        row_y += 29


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--benchmark-root", type=Path, default=DEFAULT_BENCHMARK_ROOT)
    parser.add_argument("--flowy-wall-seconds", type=float, default=0.694)
    parser.add_argument("--mrlava-wall-seconds", type=float, default=27.136)
    args = parser.parse_args()

    dem_path = args.benchmark_root / "ember-breached-rift-bench.asc"
    flowy_path = args.benchmark_root / "flowy/output/ember_breached_rift_thickness_full.asc"
    mrlava_path = args.benchmark_root / "mrlavaloba/ember_breached_rift_000_thickness_full.asc"
    for path in (dem_path, flowy_path, mrlava_path):
        if not path.exists():
            raise FileNotFoundError(path)

    dem = read_asc(dem_path)
    flowy = read_asc(flowy_path)
    mrlava = read_asc(mrlava_path)
    assert_aligned(dem, flowy, mrlava)

    threshold = 0.05
    flowy_metrics = metrics(flowy, (-72.0, 137.0), threshold)
    mrlava_metrics = metrics(mrlava, (-72.0, 137.0), threshold)
    flowy_mask = flowy.values > threshold
    mrlava_mask = mrlava.values > threshold
    intersection = int(np.count_nonzero(flowy_mask & mrlava_mask))
    union = int(np.count_nonzero(flowy_mask | mrlava_mask))
    overlap_iou = intersection / union
    active_union = flowy_mask | mrlava_mask
    thickness_correlation = float(np.corrcoef(flowy.values[active_union], mrlava.values[active_union])[0, 1])
    mean_absolute_grid_difference = float(np.mean(np.abs(flowy.values - mrlava.values)))

    report = {
        "schemaVersion": 1,
        "purpose": "Same-DEM implementation proof; not calibrated eruption or hazard science.",
        "candidate": "a-breached-rift-bench",
        "grid": {
            "columns": dem.ncols,
            "rows": dem.nrows,
            "cellSizeM": dem.cellsize,
            "xRangeM": [dem.xll, dem.xll + (dem.ncols - 1) * dem.cellsize],
            "zRangeM": [dem.yll, dem.yll + (dem.nrows - 1) * dem.cellsize],
        },
        "sharedInputs": {
            "rngSeed": 6301,
            "ventRuntimeXZ": [-72.0, 137.0],
            "flows": 8,
            "lobesPerFlow": 250,
            "lobeAreaM2": 20.0,
            "totalVolumeM3": 8000.0,
            "thicknessRatio": 0.2,
            "thickeningParameter": 0.25,
            "lobeExponent": 0.12,
            "maxSlopeProbability": 0.92,
            "inertialExponent": 0.25,
        },
        "implementations": {
            "flowy": {
                "commit": "4ce1036d1073d581085c74c569b1d0e95a4ae0bd",
                "license": "GPL-3.0",
                "reportedSolverSeconds": 0.007,
                "measuredWallSeconds": args.flowy_wall_seconds,
                "metrics": flowy_metrics,
            },
            "mrlavaloba2": {
                "commit": "cf2cbc8aaabc399c9ae545286b1c710e3c6ffbb9",
                "license": "Apache-2.0",
                "reportedSolverSeconds": 8.5,
                "measuredFirstRunWallSeconds": args.mrlava_wall_seconds,
                "metrics": mrlava_metrics,
            },
        },
        "agreement": {
            "footprintIntersectionCells": intersection,
            "footprintUnionCells": union,
            "footprintIntersectionOverUnion": round(overlap_iou, 6),
            "thicknessCorrelationAcrossUnion": round(thickness_correlation, 6),
            "meanAbsoluteGridDifferenceM": round(mean_absolute_grid_difference, 6),
        },
        "interpretation": [
            "Both implementations route lava around the northwest mass and toward the bench-side drainage on the same authored DEM.",
            "Similar footprint area, thickness, and high overlap support the terrain hypothesis independently of the hand-authored concept path.",
            "The outputs are suitable as footprint/thickness guides, not render meshes and not predictions of a named eruption.",
            "Flowy is the faster iteration tool; MrLavaLoba2 is the preferred permissively licensed baseline for reproducible preproduction.",
        ],
        "runtimeCaveats": [
            "Flowy wall time includes WSL process launch.",
            "MrLavaLoba2 wall time is a cold first run and includes Numba compilation and file export.",
            "The timing comparison is directional, not a controlled performance benchmark.",
        ],
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / "lava-simulator-comparison-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    canvas = Image.new("RGB", (2560, 1440), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 38), "LAVA EMPLACEMENT CROSS-CHECK", font=FONT_30, fill=CYAN)
    draw.text((60, 78), "ONE EMBER TERRAIN · TWO INDEPENDENT SOLVERS", font=FONT_46, fill=INK)
    draw.text(
        (62, 140),
        "381 × 336 cells · 1 m resolution · 8 flows × 250 lobes · 8,000 m³ · seed 6301 · active threshold > 0.05 m",
        font=FONT_20,
        fill=MUTED,
    )

    panel_top = 196
    panel_bottom = 955
    draw_map_panel(
        canvas,
        draw,
        (60, panel_top, 840, panel_bottom),
        dem,
        dem.values,
        None,
        "SHARED AUTHORED DEM",
        "Breached Rift Bench hypothesis · white stage · cyan 25 m orbit",
    )
    draw_map_panel(
        canvas,
        draw,
        (890, panel_top, 1670, panel_bottom),
        dem,
        dem.values,
        flowy.values,
        "FLOWY",
        "GPL-3.0 · compiled C++ · 0.007 s solver / 0.694 s wall",
    )
    draw_map_panel(
        canvas,
        draw,
        (1720, panel_top, 2500, panel_bottom),
        dem,
        dem.values,
        mrlava.values,
        "MRLAVALOBA2",
        "Apache-2.0 · Python/Numba · 8.5 s solver / 27.136 s cold wall",
    )

    draw.rounded_rectangle((60, 990, 2500, 1380), radius=18, fill=PANEL, outline=GRID, width=2)
    draw_metric_column(draw, 95, 1020, "FLOWY MEASUREMENTS", flowy_metrics)
    draw_metric_column(draw, 600, 1020, "MRLAVALOBA2 MEASUREMENTS", mrlava_metrics)

    draw.text((1120, 1020), "INDEPENDENT AGREEMENT", font=FONT_22, fill=CYAN)
    draw.text((1120, 1062), f"{overlap_iou * 100:.1f}%", font=FONT_46, fill=INK)
    draw.text((1288, 1080), "footprint IoU", font=FONT_20, fill=MUTED)
    draw.text((1120, 1133), f"Thickness correlation across union: {thickness_correlation:.3f}", font=FONT_17, fill=INK)
    draw.text((1120, 1164), f"Mean absolute whole-grid difference: {mean_absolute_grid_difference:.3f} m", font=FONT_17, fill=INK)
    draw_wrapped(
        draw,
        "The agreement shows that gravity and terrain, rather than a single authored spline, can own the large-scale lava footprint. Use either output as a footprint and thickness guide; rebuild it as art-directed lobes, crust plates, levees, overflows, and sparse exposed shear zones.",
        (1120, 1210),
        760,
        FONT_17,
        MUTED,
        6,
    )

    draw.text((1925, 1020), "DECISION", font=FONT_22, fill=CYAN)
    draw_wrapped(
        draw,
        "Adopt MrLavaLoba2 as the permissive reproducibility baseline. Keep Flowy as the high-speed iteration cross-check without incorporating GPL source into the app.",
        (1925, 1062),
        515,
        FONT_20,
        INK,
        7,
    )
    draw_wrapped(
        draw,
        "Implementation proof only. This terrain is an Ember design hypothesis, not surveyed geology; inputs are intentionally uncalibrated to a named eruption.",
        (1925, 1227),
        515,
        FONT_17,
        MUTED,
        6,
    )

    board_path = OUTPUT_DIR / "lava-simulator-comparison-board.png"
    canvas.save(board_path, optimize=True)
    print(f"Wrote {board_path}")
    print(f"Wrote {report_path}")
    print(f"Footprint IoU: {overlap_iou:.6f}")


if __name__ == "__main__":
    main()
