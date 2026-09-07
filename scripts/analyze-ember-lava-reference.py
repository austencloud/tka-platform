"""Render a compact Ember reference board from the USGS Mauna Loa 2022 rasters.

The source GeoTIFFs are intentionally kept outside Git. This script records the
dataset identity, raster metadata, sampled thickness statistics, and a small
derived visualization suitable for the Ember preproduction evidence pack.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import textwrap

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT


ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions"
OUTPUT_DIR = SPEC_DIR / "evidence/gate-1-geology-restart-r1"
DEFAULT_SOURCE_ROOT = Path("E:/tka-platform-ember-geology-sources/usgs-mauna-loa-2022")

PAPER = (12, 15, 19)
PANEL = (20, 25, 31)
INK = (229, 231, 235)
MUTED = (159, 168, 178)
GRID = (67, 76, 86)
CYAN = (96, 210, 218)
ORANGE = (255, 112, 38)
YELLOW = (255, 211, 88)


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
FONT_22_BOLD = load_font(22, bold=True)
FONT_30 = load_font(30, bold=True)
FONT_48 = load_font(48, bold=True)


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    width: int,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    spacing: int = 6,
) -> int:
    average_character = max(6, round(getattr(font, "size", 16) * 0.53))
    wrapped = textwrap.fill(text, width=max(12, width // average_character))
    draw.multiline_text(xy, wrapped, font=font, fill=fill, spacing=spacing)
    box = draw.multiline_textbbox(xy, wrapped, font=font, spacing=spacing)
    return box[3] - box[1]


def hillshade(elevation: np.ndarray) -> np.ndarray:
    dz, dx = np.gradient(elevation)
    slope = np.pi / 2.0 - np.arctan(np.hypot(dx, dz))
    aspect = np.arctan2(-dx, dz)
    azimuth = math.radians(315.0)
    altitude = math.radians(34.0)
    shade = np.sin(altitude) * np.sin(slope) + np.cos(altitude) * np.cos(slope) * np.cos(azimuth - aspect)
    return np.clip((shade + 1.0) * 0.5, 0.0, 1.0)


def colorize_reference(elevation: np.ma.MaskedArray, thickness: np.ma.MaskedArray) -> Image.Image:
    elevation_filled = np.ma.filled(elevation, np.nan)
    finite = np.isfinite(elevation_filled)
    replacement = float(np.nanmedian(elevation_filled))
    elevation_work = np.where(finite, elevation_filled, replacement)
    shade = hillshade(elevation_work)
    low, high = np.nanpercentile(elevation_filled, (2.0, 98.0))
    normalized = np.clip((elevation_work - low) / max(0.001, high - low), 0.0, 1.0)
    base = np.empty((*normalized.shape, 3), dtype=float)
    base[..., 0] = 22 + 82 * normalized
    base[..., 1] = 25 + 70 * normalized
    base[..., 2] = 28 + 52 * normalized
    base *= (0.50 + 0.68 * shade[..., None])

    thickness_values = np.ma.filled(thickness, 0.0)
    active = (~np.ma.getmaskarray(thickness)) & (thickness_values > 0.5)
    lava_strength = np.clip(np.log1p(np.maximum(thickness_values, 0.0)) / np.log(21.0), 0.0, 1.0)
    lava_color = np.empty_like(base)
    lava_color[..., 0] = 142 + 113 * lava_strength
    lava_color[..., 1] = 35 + 176 * lava_strength**1.7
    lava_color[..., 2] = 20 + 50 * lava_strength**2.2
    alpha = np.where(active, 0.58 + 0.38 * lava_strength, 0.0)[..., None]
    rgb = base * (1.0 - alpha) + lava_color * alpha
    rgb[~finite] = np.asarray(PAPER)
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), mode="RGB")


def histogram_counts(values: np.ndarray) -> tuple[list[str], list[int]]:
    bins = np.asarray((0.5, 2.0, 5.0, 10.0, 20.0, np.inf))
    labels = ["0.5–2 m", "2–5 m", "5–10 m", "10–20 m", ">20 m"]
    counts = []
    for low, high in zip(bins, bins[1:]):
        counts.append(int(np.count_nonzero((values >= low) & (values < high))))
    return labels, counts


def draw_histogram(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    labels: list[str],
    counts: list[int],
) -> None:
    left, top, right, bottom = rect
    draw.rounded_rectangle(rect, radius=16, fill=PANEL, outline=GRID, width=2)
    draw.text((left + 24, top + 18), "SAMPLED POSITIVE THICKNESS", font=FONT_22_BOLD, fill=INK)
    maximum = max(counts)
    bar_left = left + 125
    bar_right = right - 32
    y = top + 68
    for label, count in zip(labels, counts):
        draw.text((left + 24, y + 5), label, font=FONT_16, fill=MUTED)
        width = round((bar_right - bar_left) * count / maximum)
        draw.rounded_rectangle((bar_left, y, bar_left + width, y + 25), radius=7, fill=ORANGE)
        draw.text((bar_left + width + 9, y + 4), f"{count:,}", font=FONT_16, fill=INK)
        y += 43
    draw.text((left + 24, bottom - 28), "Downsampled diagnostic distribution; not a volume estimate.", font=FONT_16, fill=MUTED)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    args = parser.parse_args()

    dem_path = args.source_root / "ML_20221210_mosaic_align.tif"
    thickness_path = args.source_root / "ML_20221210_thickness.tif"
    metadata_path = args.source_root / "ML22demmetadata.xml"
    for path in (dem_path, thickness_path, metadata_path):
        if not path.exists():
            raise FileNotFoundError(path)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sample_width = 920
    sample_height = 1368

    with rasterio.open(thickness_path) as thickness_source:
        thickness = thickness_source.read(
            1,
            out_shape=(sample_height, sample_width),
            masked=True,
            resampling=Resampling.bilinear,
        )
        sampled_transform = thickness_source.transform * thickness_source.transform.scale(
            thickness_source.width / sample_width,
            thickness_source.height / sample_height,
        )
        thickness_metadata = {
            "width": thickness_source.width,
            "height": thickness_source.height,
            "crs": str(thickness_source.crs),
            "bounds": [round(value, 3) for value in thickness_source.bounds],
            "resolutionM": [round(value, 6) for value in thickness_source.res],
            "nodata": thickness_source.nodata,
        }

        with rasterio.open(dem_path) as dem_source:
            with WarpedVRT(
                dem_source,
                crs=thickness_source.crs,
                transform=sampled_transform,
                width=sample_width,
                height=sample_height,
                resampling=Resampling.bilinear,
            ) as dem_vrt:
                elevation = dem_vrt.read(1, masked=True)
            dem_metadata = {
                "width": dem_source.width,
                "height": dem_source.height,
                "crs": str(dem_source.crs),
                "bounds": [round(value, 3) for value in dem_source.bounds],
                "resolutionM": [round(value, 6) for value in dem_source.res],
                "nodata": dem_source.nodata,
            }

    positive = thickness.compressed()
    positive = positive[positive > 0.5]
    percentiles = np.percentile(positive, (5, 25, 50, 75, 90, 95, 99))
    labels, counts = histogram_counts(positive)

    map_image = colorize_reference(elevation, thickness)
    map_image = map_image.resize((1076, 1190), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (2400, 1500), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 40), "MEASURED REAL-WORLD REFERENCE", font=FONT_30, fill=CYAN)
    draw.text((60, 82), "MAUNA LOA 2022 — FINAL DEM + LAVA THICKNESS", font=FONT_48, fill=INK)
    draw.text(
        (62, 145),
        "USGS / NASA GLISTIN-A single-pass InSAR, 10 December 2022. Orange-yellow is measured positive topographic change.",
        font=FONT_22,
        fill=MUTED,
    )

    map_rect = (60, 210, 1136, 1400)
    canvas.paste(map_image, map_rect[:2])
    draw.rectangle(map_rect, outline=GRID, width=2)
    draw.text((83, 231), "N ↑", font=FONT_22_BOLD, fill=INK)

    width_km = (thickness_metadata["bounds"][2] - thickness_metadata["bounds"][0]) / 1000.0
    height_km = (thickness_metadata["bounds"][3] - thickness_metadata["bounds"][1]) / 1000.0
    scale_px = round(5.0 / height_km * (map_rect[3] - map_rect[1]))
    scale_y = map_rect[3] - 42
    draw.line((map_rect[0] + 28, scale_y, map_rect[0] + 28 + scale_px, scale_y), fill=INK, width=5)
    draw.text((map_rect[0] + 34 + scale_px, scale_y - 12), "5 km", font=FONT_18, fill=INK)

    right_x = 1190
    draw.rounded_rectangle((right_x, 210, 2340, 480), radius=18, fill=PANEL, outline=GRID, width=2)
    draw.text((right_x + 28, 235), "DATASET FACTS", font=FONT_22_BOLD, fill=CYAN)
    facts = (
        f"Coverage: {width_km:.1f} × {height_km:.1f} km",
        f"Pixel spacing: {thickness_metadata['resolutionM'][0]:.2f} m",
        "Reported unchanged-terrain vertical σ: 1.09 m",
        f"Sampled thickness median: {percentiles[2]:.2f} m",
        f"Sampled 90th percentile: {percentiles[4]:.2f} m",
        "Public-domain USGS data release: 10.5066/P1NBKNMC",
    )
    y = 285
    for fact in facts:
        draw.ellipse((right_x + 30, y + 7, right_x + 38, y + 15), fill=ORANGE)
        draw.text((right_x + 52, y), fact, font=FONT_18, fill=INK)
        y += 31

    draw.rounded_rectangle((right_x, 510, 2340, 890), radius=18, fill=PANEL, outline=GRID, width=2)
    draw.text((right_x + 28, 535), "WHAT TRANSFERS TO EMBER", font=FONT_22_BOLD, fill=CYAN)
    rules = (
        "Read the eruption as a connected footprint: source fissure, trunk, diversions, widening reaches, and terminal lobes.",
        "Thickness varies by terrain control. A constant-width ribbon erases the pauses, ponding, stacking, and breakout history.",
        "A 380 × 335 m Ember world is a close-up window into one reach of this system, not a miniature complete volcano.",
        "Use measured data as a proportion and topology teacher. Do not copy noisy radar relief as final art geometry.",
    )
    y = 587
    for index, rule in enumerate(rules, start=1):
        draw.text((right_x + 30, y), f"{index:02d}", font=FONT_22_BOLD, fill=ORANGE)
        used = draw_wrapped(draw, rule, (right_x + 76, y), 1050, FONT_18, INK, spacing=4)
        y += used + 19

    draw_histogram(draw, (right_x, 920, 2340, 1260), labels, counts)
    draw.text((right_x, 1300), "TRANSFER LIMIT", font=FONT_22_BOLD, fill=ORANGE)
    draw_wrapped(
        draw,
        "The raster resolves emplacement at 3.05 m and carries 1.09 m vertical uncertainty over unchanged ground. It can validate drainage, footprint, and broad thickness rhythm; it cannot supply Ember's centimeter-scale crust, clinker, or fissure detail.",
        (right_x, 1334),
        1130,
        FONT_18,
        INK,
    )

    board_path = OUTPUT_DIR / "usgs-mauna-loa-2022-reference-board.png"
    canvas.save(board_path, quality=95)

    report = {
        "schemaVersion": 1,
        "dataset": {
            "title": "Mauna Loa 2022 lava flow digital elevation models and thickness maps",
            "authors": ["Hannah R. Dietterich", "Michael H. Zoeller", "Paul R. Lundgren"],
            "publicationDate": "2026-03-12",
            "doi": "10.5066/P1NBKNMC",
            "license": "CC0 / USGS public domain",
            "sourcePage": "https://www.usgs.gov/data/mauna-loa-2022-lava-flow-digital-elevation-models-and-thickness-maps",
            "localSourceRoot": str(args.source_root),
            "sourceFiles": [dem_path.name, thickness_path.name, metadata_path.name],
        },
        "dem": dem_metadata,
        "thickness": thickness_metadata,
        "sample": {
            "outShape": [sample_height, sample_width],
            "positiveThresholdM": 0.5,
            "positiveSampleCount": int(positive.size),
            "percentilesM": {
                str(percentile): round(float(value), 3)
                for percentile, value in zip((5, 25, 50, 75, 90, 95, 99), percentiles)
            },
            "histogramLabels": labels,
            "histogramCounts": counts,
            "warning": "Downsampled diagnostic only; not a scientific volume calculation.",
        },
        "publishedAccuracy": {
            "horizontalResolutionM": 3.05,
            "horizontalMappingAgreement": "within one pixel (less than 3 m)",
            "unchangedTerrainVerticalOneSigmaM": 1.09,
            "verticalShiftRemovedM": 2.5,
            "source": "ML22demmetadata.xml",
        },
        "derivedBoard": board_path.relative_to(ROOT).as_posix(),
    }
    report_path = OUTPUT_DIR / "usgs-mauna-loa-2022-reference-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Board: {board_path}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
