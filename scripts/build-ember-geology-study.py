"""Build Ember's geology-first Gate 1 comparison boards.

This is a measured preproduction tool. It does not build or replace the Ember
runtime scene. The three height fields are authored hypotheses that make the
world scale, performer clearance, lava drainage, vertical section, and orbit
sightlines reviewable before any production geometry is commissioned.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
import textwrap

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions"
OUTPUT_DIR = SPEC_DIR / "evidence/gate-1-geology-restart-r1"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

WORLD_X = (-190.0, 190.0)
WORLD_Z = (-145.0, 190.0)
GRID_COLUMNS = 381
GRID_ROWS = 336
ACTION_RADIUS_M = 4.5
ORBIT_RADIUS_M = 25.0
CAMERA_HEIGHT_M = 7.0
CAMERA_TARGET_HEIGHT_M = 1.2
DEFAULT_CAMERA_XZ = (0.0, -21.5)

X_VALUES = np.linspace(WORLD_X[0], WORLD_X[1], GRID_COLUMNS)
Z_VALUES = np.linspace(WORLD_Z[0], WORLD_Z[1], GRID_ROWS)
X_GRID, Z_GRID = np.meshgrid(X_VALUES, Z_VALUES)

INK = (229, 231, 235)
MUTED = (159, 168, 178)
PAPER = (12, 15, 19)
PANEL = (20, 25, 31)
GRID = (67, 76, 86)
CYAN = (96, 210, 218)
LAVA = (255, 92, 32)
LAVA_HOT = (255, 198, 76)
LAVA_CRUST = (76, 37, 29)
STAGE = (218, 232, 235)
RISK = (238, 154, 63)


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
FONT_20 = load_font(20)
FONT_22 = load_font(22, bold=True)
FONT_28 = load_font(28, bold=True)
FONT_36 = load_font(36, bold=True)
FONT_52 = load_font(52, bold=True)


@dataclass(frozen=True)
class Candidate:
    id: str
    name: str
    subtitle: str
    source: tuple[float, float]
    flow_path: tuple[tuple[float, float], ...]
    flow_widths: tuple[float, ...]
    mode: str
    dominant_mass: str
    open_horizon: str
    thesis: str
    chief_risk: str
    section_note: str
    score: tuple[int, int, int, int, int, int]


CANDIDATES = (
    Candidate(
        id="a-breached-rift-bench",
        name="A. Breached Rift Bench",
        subtitle="Recommended hypothesis for the first geology graybox",
        source=(-72.0, 137.0),
        flow_path=(
            (-72.0, 137.0),
            (-61.0, 116.0),
            (-48.0, 92.0),
            (-31.0, 68.0),
            (-12.0, 45.0),
            (8.0, 24.0),
            (14.0, 8.0),
            (15.0, -9.0),
            (19.0, -31.0),
            (29.0, -54.0),
            (35.0, -82.0),
            (42.0, -122.0),
            (49.0, -145.0),
        ),
        flow_widths=(4.0, 5.0, 5.5, 6.0, 6.5, 7.0, 7.0, 7.5, 10.0, 14.0, 19.0, 24.0, 28.0),
        mode="Open channel becomes a crusted lobe field after the southern slope break.",
        dominant_mass="Older collapse scarp to west / northwest",
        open_horizon="East and southeast",
        thesis="A fissure-fed flow escapes a breached caldera wall, skirts the old performance bench, then widens into overlapping toes.",
        chief_risk="The breached wall can become a decorative arch unless its bedding, talus, and flow contact all agree.",
        section_note="Source, chute, bench-side reach, slope-break pool, and terminus are visible in one longitudinal section.",
        score=(5, 5, 5, 4, 5, 5),
    ),
    Candidate(
        id="b-perched-channel-terraces",
        name="B. Perched Channel Terraces",
        subtitle="Strongest exposed-flow spectacle; highest canalization risk",
        source=(61.0, 145.0),
        flow_path=(
            (61.0, 145.0),
            (48.0, 125.0),
            (29.0, 106.0),
            (8.0, 89.0),
            (-6.0, 70.0),
            (-15.0, 51.0),
            (-16.0, 31.0),
            (-15.0, 10.0),
            (-14.0, -11.0),
            (-20.0, -32.0),
            (-30.0, -58.0),
            (-42.0, -88.0),
            (-54.0, -126.0),
            (-62.0, -145.0),
        ),
        flow_widths=(4.5, 5.0, 5.0, 6.0, 7.0, 7.0, 8.0, 8.0, 9.0, 11.0, 14.0, 18.0, 21.0, 24.0),
        mode="A channel is repeatedly banked and partly perched by overflows at three terrace lips.",
        dominant_mass="Stepped eastern fault shoulder",
        open_horizon="West and southwest",
        thesis="Three topographic benches produce visible acceleration, ponding, overtopping, and renewed channelization.",
        chief_risk="Repeated terraces and parallel levees can read as stairs and civil engineering rather than accumulated lava.",
        section_note="The vertical profile makes slope breaks explicit, but the levees must stay irregular and locally failed.",
        score=(4, 5, 4, 4, 4, 4),
    ),
    Candidate(
        id="c-inflated-rift-apron",
        name="C. Inflated Rift Apron",
        subtitle="Most natural pāhoehoe field; deliberately less neon",
        source=(-42.0, 132.0),
        flow_path=(
            (-42.0, 132.0),
            (-34.0, 111.0),
            (-24.0, 90.0),
            (-13.0, 69.0),
            (-3.0, 48.0),
            (7.0, 28.0),
            (13.0, 8.0),
            (15.0, -13.0),
            (20.0, -35.0),
            (28.0, -57.0),
            (38.0, -78.0),
            (50.0, -99.0),
            (65.0, -120.0),
            (78.0, -145.0),
        ),
        flow_widths=(5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 15.0, 20.0, 27.0, 34.0, 42.0, 48.0),
        mode="A roofed tube is revealed by skylights, tumuli, pressure cracks, and a broad active breakout field.",
        dominant_mass="Low northwest vent rampart and inflated central apron",
        open_horizon="South and east",
        thesis="Most transport happens inside an insulated tube; surface fire appears only at skylights, breakouts, and the advancing toe.",
        chief_risk="Physical credibility can undersell Ember's heat fantasy unless the sparse hot events are composed decisively.",
        section_note="The section distinguishes the concealed tube, inflated crust, tumulus cracks, and thin breakout toes.",
        score=(5, 3, 4, 5, 4, 4),
    ),
)


def gaussian(
    x0: float,
    z0: float,
    sigma_x: float,
    sigma_z: float,
    amplitude: float,
    angle_deg: float = 0.0,
) -> np.ndarray:
    angle = math.radians(angle_deg)
    dx = X_GRID - x0
    dz = Z_GRID - z0
    local_x = dx * math.cos(angle) + dz * math.sin(angle)
    local_z = -dx * math.sin(angle) + dz * math.cos(angle)
    return amplitude * np.exp(-0.5 * ((local_x / sigma_x) ** 2 + (local_z / sigma_z) ** 2))


def distance_and_progress_to_polyline(
    path: tuple[tuple[float, float], ...],
) -> tuple[np.ndarray, np.ndarray]:
    best = np.full_like(X_GRID, np.inf, dtype=float)
    progress = np.zeros_like(X_GRID, dtype=float)
    points = np.asarray(path, dtype=float)
    segment_lengths = np.hypot(np.diff(points[:, 0]), np.diff(points[:, 1]))
    cumulative = np.concatenate(([0.0], np.cumsum(segment_lengths)))
    total_length = cumulative[-1]
    for index, (start, end) in enumerate(zip(path, path[1:])):
        ax, az = start
        bx, bz = end
        vx = bx - ax
        vz = bz - az
        denom = vx * vx + vz * vz
        t = np.clip(((X_GRID - ax) * vx + (Z_GRID - az) * vz) / denom, 0.0, 1.0)
        px = ax + t * vx
        pz = az + t * vz
        distance = np.hypot(X_GRID - px, Z_GRID - pz)
        closer = distance < best
        best = np.where(closer, distance, best)
        segment_progress = (cumulative[index] + t * segment_lengths[index]) / total_length
        progress = np.where(closer, segment_progress, progress)
    return best, progress


def embed_performance_bench(height: np.ndarray, target_height: float) -> np.ndarray:
    radius = np.hypot(X_GRID, Z_GRID)
    core = np.clip((13.5 - radius) / 6.5, 0.0, 1.0)
    core = core * core * (3.0 - 2.0 * core)
    bench = target_height + X_GRID * 0.006 + Z_GRID * 0.002
    return height * (1.0 - core) + bench * core


def candidate_height(candidate: Candidate) -> np.ndarray:
    base = 0.15 + 0.018 * (Z_GRID - WORLD_Z[0]) - 0.003 * X_GRID
    distance, progress = distance_and_progress_to_polyline(candidate.flow_path)

    if candidate.id.startswith("a-"):
        height = base
        height += gaussian(-130, 74, 31, 87, 26, -10)
        height += gaussian(-92, 149, 51, 25, 15, 12)
        height += gaussian(-92, 22, 28, 53, 12, -14)
        height += gaussian(112, 133, 70, 35, 5, 0)
        height -= gaussian(-52, 91, 28, 37, 7, -28)
        height = embed_performance_bench(height, 0.72)
        channel_bed = -1.15 + 22.6 * (1.0 - progress) ** 5.2
        channel_influence = np.exp(-0.5 * (distance / 5.8) ** 2)
    elif candidate.id.startswith("b-"):
        height = base * 0.82
        height += 4.4 / (1.0 + np.exp(-(Z_GRID - 105.0) / 4.0))
        height += 3.4 / (1.0 + np.exp(-(Z_GRID - 57.0) / 3.5))
        height += 2.3 / (1.0 + np.exp(-(Z_GRID - 8.0) / 3.2))
        height += gaussian(128, 72, 29, 105, 24, 7)
        height += gaussian(82, 153, 48, 31, 12, -16)
        height = embed_performance_bench(height, 0.86)
        smooth_step = lambda center, width: 1.0 / (1.0 + np.exp(-(progress - center) / width))
        channel_bed = (
            27.0
            - 7.5 * smooth_step(0.14, 0.025)
            - 7.0 * smooth_step(0.34, 0.025)
            - 5.2 * smooth_step(0.54, 0.025)
            - 4.3 * smooth_step(0.72, 0.025)
            - 3.4 * smooth_step(0.89, 0.035)
            - 0.8 * progress
        )
        channel_influence = np.exp(-0.5 * (distance / 5.5) ** 2)
    else:
        height = base * 0.67
        height += gaussian(-119, 115, 42, 63, 12, -18)
        height += gaussian(-51, 136, 28, 23, 8, 8)
        for x0, z0, sx, sz, amp, angle in (
            (-25, 74, 25, 13, 2.8, -22),
            (8, 51, 32, 16, 3.2, -25),
            (31, 9, 28, 17, 2.6, -20),
            (48, -37, 35, 19, 2.3, -28),
            (64, -88, 44, 22, 1.8, -30),
        ):
            height += gaussian(x0, z0, sx, sz, amp, angle)
        height = embed_performance_bench(height, 0.66)
        channel_bed = -0.9 + 16.0 * (1.0 - progress) ** 2.35
        channel_influence = np.exp(-0.5 * (distance / 6.8) ** 2)

    return height * (1.0 - channel_influence) + channel_bed * channel_influence


def world_to_pixel(
    x: float,
    z: float,
    rect: tuple[int, int, int, int],
) -> tuple[int, int]:
    left, top, right, bottom = rect
    px = left + (x - WORLD_X[0]) / (WORLD_X[1] - WORLD_X[0]) * (right - left)
    py = bottom - (z - WORLD_Z[0]) / (WORLD_Z[1] - WORLD_Z[0]) * (bottom - top)
    return round(px), round(py)


def meters_to_pixels(metres: float, rect: tuple[int, int, int, int]) -> int:
    return max(1, round(metres / (WORLD_X[1] - WORLD_X[0]) * (rect[2] - rect[0])))


def sample_height(height: np.ndarray, x: float, z: float) -> float:
    col = np.clip((x - WORLD_X[0]) / (WORLD_X[1] - WORLD_X[0]) * (GRID_COLUMNS - 1), 0, GRID_COLUMNS - 1)
    row = np.clip((z - WORLD_Z[0]) / (WORLD_Z[1] - WORLD_Z[0]) * (GRID_ROWS - 1), 0, GRID_ROWS - 1)
    c0 = int(math.floor(col))
    r0 = int(math.floor(row))
    c1 = min(c0 + 1, GRID_COLUMNS - 1)
    r1 = min(r0 + 1, GRID_ROWS - 1)
    tx = col - c0
    tz = row - r0
    return float(
        height[r0, c0] * (1 - tx) * (1 - tz)
        + height[r0, c1] * tx * (1 - tz)
        + height[r1, c0] * (1 - tx) * tz
        + height[r1, c1] * tx * tz
    )


def terrain_image(height: np.ndarray, size: tuple[int, int]) -> Image.Image:
    palette = np.asarray(
        [
            (18, 22, 26),
            (31, 36, 40),
            (48, 51, 50),
            (68, 65, 58),
            (92, 82, 67),
            (126, 110, 88),
        ],
        dtype=float,
    )
    low, high = np.percentile(height, (1.0, 99.0))
    normalized = np.clip((height - low) / max(0.001, high - low), 0.0, 1.0)
    scaled = normalized * (len(palette) - 1)
    lower = np.floor(scaled).astype(int)
    upper = np.minimum(lower + 1, len(palette) - 1)
    mix = (scaled - lower)[..., None]
    rgb = palette[lower] * (1.0 - mix) + palette[upper] * mix

    dz, dx = np.gradient(height)
    light = np.clip(0.74 - dx * 0.08 + dz * 0.055, 0.45, 1.15)[..., None]
    rgb = np.clip(rgb * light, 0, 255).astype(np.uint8)
    image = Image.fromarray(rgb, mode="RGB")
    return image.resize(size, Image.Resampling.BICUBIC)


def contour_mask(height: np.ndarray, interval: float = 2.0) -> np.ndarray:
    bands = np.floor((height - float(height.min())) / interval).astype(int)
    edges = np.zeros_like(bands, dtype=bool)
    edges[:, 1:] |= bands[:, 1:] != bands[:, :-1]
    edges[1:, :] |= bands[1:, :] != bands[:-1, :]
    return edges


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
    box = draw.multiline_textbbox(xy, wrapped, font=font, spacing=spacing)
    return box[3] - box[1]


def polyline_min_distance_to_origin(path: tuple[tuple[float, float], ...]) -> float:
    best = math.inf
    for start, end in zip(path, path[1:]):
        ax, az = start
        bx, bz = end
        vx = bx - ax
        vz = bz - az
        denom = vx * vx + vz * vz
        t = max(0.0, min(1.0, -(ax * vx + az * vz) / denom))
        best = min(best, math.hypot(ax + t * vx, az + t * vz))
    return best


def interpolate_path(path: tuple[tuple[float, float], ...], samples: int = 320) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    points = np.asarray(path, dtype=float)
    segments = np.diff(points, axis=0)
    lengths = np.hypot(segments[:, 0], segments[:, 1])
    cumulative = np.concatenate(([0.0], np.cumsum(lengths)))
    distances = np.linspace(0.0, cumulative[-1], samples)
    xs = np.interp(distances, cumulative, points[:, 0])
    zs = np.interp(distances, cumulative, points[:, 1])
    return distances, xs, zs


def sightline_clearance(height: np.ndarray) -> list[dict[str, float | bool]]:
    results: list[dict[str, float | bool]] = []
    for angle_deg in range(0, 360, 45):
        angle = math.radians(angle_deg)
        camera_x = math.sin(angle) * ORBIT_RADIUS_M
        camera_z = -math.cos(angle) * ORBIT_RADIUS_M
        minimum_clearance = math.inf
        for t in np.linspace(0.08, 0.92, 80):
            x = camera_x * (1.0 - t)
            z = camera_z * (1.0 - t)
            ray_y = CAMERA_HEIGHT_M * (1.0 - t) + CAMERA_TARGET_HEIGHT_M * t
            clearance = ray_y - sample_height(height, x, z)
            minimum_clearance = min(minimum_clearance, clearance)
        results.append(
            {
                "bearingDegreesClockwiseFromAudience": angle_deg,
                "minimumTerrainClearanceM": round(minimum_clearance, 3),
                "clear": bool(minimum_clearance > 0.15),
            }
        )
    return results


def draw_flow(
    draw: ImageDraw.ImageDraw,
    candidate: Candidate,
    rect: tuple[int, int, int, int],
) -> None:
    pixel_path = [world_to_pixel(x, z, rect) for x, z in candidate.flow_path]
    scale = (rect[2] - rect[0]) / (WORLD_X[1] - WORLD_X[0])
    for path_index in range(max(1, len(pixel_path) - 5), len(pixel_path)):
        px, py = pixel_path[path_index]
        radius_x = max(4, round(candidate.flow_widths[path_index] * scale * 0.58))
        radius_y = max(6, round(radius_x * 1.38))
        draw.ellipse(
            (px - radius_x, py - radius_y, px + radius_x, py + radius_y),
            fill=LAVA_CRUST,
            outline=LAVA,
            width=2,
        )
    for index, (start, end) in enumerate(zip(pixel_path, pixel_path[1:])):
        width_m = (candidate.flow_widths[index] + candidate.flow_widths[index + 1]) * 0.5
        width_px = max(3, round(width_m * scale))
        draw.line((start, end), fill=LAVA_CRUST, width=width_px + 5, joint="curve")
        if candidate.id.startswith("c-") and index < 9:
            draw.line((start, end), fill=(91, 77, 61), width=max(2, width_px - 1), joint="curve")
        else:
            draw.line((start, end), fill=LAVA, width=max(2, width_px - 2), joint="curve")
            draw.line(
                (start, end),
                fill=(105, 47, 31),
                width=max(1, round(width_px * 0.36)),
                joint="curve",
            )
            segment_x = end[0] - start[0]
            segment_y = end[1] - start[1]
            segment_length = max(1.0, math.hypot(segment_x, segment_y))
            normal_x = -segment_y / segment_length
            normal_y = segment_x / segment_length
            hot_offset = width_px * 0.29
            hot_width = max(1, round(width_px * 0.12))
            for side in (-1.0, 1.0):
                offset_x = normal_x * hot_offset * side
                offset_y = normal_y * hot_offset * side
                draw.line(
                    (
                        (round(start[0] + offset_x), round(start[1] + offset_y)),
                        (round(end[0] + offset_x), round(end[1] + offset_y)),
                    ),
                    fill=LAVA_HOT,
                    width=hot_width,
                )

    if candidate.id.startswith("c-"):
        for path_index in (1, 3, 5, 7, 9):
            x, z = candidate.flow_path[path_index]
            px, py = world_to_pixel(x, z, rect)
            radius = meters_to_pixels(4.2 if path_index < 7 else 6.0, rect)
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=LAVA_CRUST, outline=LAVA)
            draw.line((px - radius // 2, py, px + radius // 2, py), fill=LAVA_HOT, width=2)


def draw_plan(
    canvas: Image.Image,
    candidate: Candidate,
    height: np.ndarray,
    rect: tuple[int, int, int, int],
) -> None:
    canvas.paste(terrain_image(height, (rect[2] - rect[0], rect[3] - rect[1])), rect[:2])
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    edges = contour_mask(height)
    contour = Image.fromarray((edges * 92).astype(np.uint8), mode="L")
    contour = contour.resize((rect[2] - rect[0], rect[3] - rect[1]), Image.Resampling.NEAREST)
    contour_rgba = Image.new("RGBA", contour.size, (220, 220, 206, 0))
    contour_rgba.putalpha(contour)
    overlay.alpha_composite(contour_rgba, (rect[0], rect[1]))

    draw_flow(draw, candidate, rect)

    stage_x, stage_y = world_to_pixel(0.0, 0.0, rect)
    action_radius = meters_to_pixels(ACTION_RADIUS_M, rect)
    orbit_radius = meters_to_pixels(ORBIT_RADIUS_M, rect)
    draw.ellipse(
        (stage_x - orbit_radius, stage_y - orbit_radius, stage_x + orbit_radius, stage_y + orbit_radius),
        outline=(*CYAN, 165),
        width=2,
    )
    draw.ellipse(
        (stage_x - action_radius, stage_y - action_radius, stage_x + action_radius, stage_y + action_radius),
        fill=(*STAGE, 235),
        outline=(255, 255, 255, 255),
        width=2,
    )
    draw.line((stage_x - 10, stage_y, stage_x + 10, stage_y), fill=(27, 31, 36, 255), width=2)
    draw.line((stage_x, stage_y - 10, stage_x, stage_y + 10), fill=(27, 31, 36, 255), width=2)

    camera = world_to_pixel(*DEFAULT_CAMERA_XZ, rect)
    draw.polygon(
        ((camera[0], camera[1] + 10), (camera[0] - 8, camera[1] - 6), (camera[0] + 8, camera[1] - 6)),
        fill=(*CYAN, 255),
    )
    draw.line((camera, (stage_x, stage_y)), fill=(*CYAN, 130), width=2)

    source = world_to_pixel(*candidate.source, rect)
    draw.ellipse((source[0] - 9, source[1] - 9, source[0] + 9, source[1] + 9), fill=LAVA_HOT, outline=(255, 255, 255), width=2)

    draw.rectangle(rect, outline=(*GRID, 255), width=2)
    for x in (-150, -100, -50, 0, 50, 100, 150):
        px, _ = world_to_pixel(x, 0, rect)
        draw.line((px, rect[1], px, rect[3]), fill=(*GRID, 95), width=1)
    for z in (-100, -50, 0, 50, 100, 150):
        _, py = world_to_pixel(0, z, rect)
        draw.line((rect[0], py, rect[2], py), fill=(*GRID, 95), width=1)

    draw.text((rect[0] + 14, rect[1] + 12), "N ↑", font=FONT_20, fill=INK)
    draw.text((rect[0] + 14, rect[3] - 31), "380 m × 335 m world", font=FONT_16, fill=MUTED)
    draw.text((stage_x - 178, stage_y + 13), "4.5 m action envelope", font=FONT_16, fill=INK)
    draw.text((source[0] + 12, source[1] - 12), "fissure source", font=FONT_16, fill=INK)
    draw.text((camera[0] + 12, camera[1] + 4), "default audience", font=FONT_16, fill=CYAN)

    canvas.alpha_composite(overlay)


def draw_longitudinal_section(
    draw: ImageDraw.ImageDraw,
    candidate: Candidate,
    height: np.ndarray,
    rect: tuple[int, int, int, int],
) -> dict[str, float]:
    distances, xs, zs = interpolate_path(candidate.flow_path)
    elevations = np.asarray([sample_height(height, x, z) for x, z in zip(xs, zs)])
    normalized_distance = distances / distances[-1]
    thickness = 0.7 + 1.1 * normalized_distance
    thickness += 1.5 * np.exp(-0.5 * ((normalized_distance - 0.63) / 0.09) ** 2)
    thickness += 1.0 * np.exp(-0.5 * ((normalized_distance - 0.88) / 0.11) ** 2)

    left, top, right, bottom = rect
    draw.rounded_rectangle(rect, radius=15, fill=PANEL, outline=GRID, width=2)
    plot = (left + 58, top + 48, right - 22, bottom - 38)
    min_y = min(0.0, float(elevations.min()) - 1.0)
    max_y = float((elevations + thickness).max()) + 2.0

    def point(distance: float, elevation: float) -> tuple[int, int]:
        px = plot[0] + distance / distances[-1] * (plot[2] - plot[0])
        py = plot[3] - (elevation - min_y) / (max_y - min_y) * (plot[3] - plot[1])
        return round(px), round(py)

    terrain_points = [point(d, e) for d, e in zip(distances, elevations)]
    lava_points = [point(d, e + t) for d, e, t in zip(distances, elevations, thickness)]
    terrain_fill = terrain_points + [(plot[2], plot[3]), (plot[0], plot[3])]
    lava_fill = lava_points + list(reversed(terrain_points))
    draw.polygon(terrain_fill, fill=(47, 49, 47), outline=(126, 116, 100))
    draw.polygon(lava_fill, fill=LAVA_CRUST, outline=LAVA, width=2)
    draw.line(lava_points, fill=LAVA_HOT, width=2)
    draw.line((plot[0], plot[3], plot[2], plot[3]), fill=GRID, width=1)
    draw.line((plot[0], plot[1], plot[0], plot[3]), fill=GRID, width=1)
    draw.text((left + 18, top + 13), "LONGITUDINAL SECTION — source to terminus", font=FONT_18, fill=INK)
    draw.text((left + 9, plot[1]), f"{max_y:.0f} m", font=FONT_16, fill=MUTED)
    draw.text((left + 14, plot[3] - 8), f"{min_y:.0f} m", font=FONT_16, fill=MUTED)
    draw.text((plot[0], bottom - 29), "source", font=FONT_16, fill=LAVA_HOT)
    draw.text((plot[2] - 74, bottom - 29), "terminus", font=FONT_16, fill=LAVA_HOT)
    draw.text((plot[0] + round((plot[2] - plot[0]) * 0.63), top + 49), "slope-break thickening", font=FONT_16, fill=INK)
    return {
        "pathLengthM": round(float(distances[-1]), 3),
        "sourceTerrainElevationM": round(float(elevations[0]), 3),
        "terminusTerrainElevationM": round(float(elevations[-1]), 3),
        "netTerrainDescentM": round(float(elevations[0] - elevations[-1]), 3),
        "averageGradePercent": round(float((elevations[0] - elevations[-1]) / distances[-1] * 100.0), 3),
    }


def draw_transverse_section(
    draw: ImageDraw.ImageDraw,
    candidate: Candidate,
    height: np.ndarray,
    rect: tuple[int, int, int, int],
) -> None:
    left, top, right, bottom = rect
    draw.rounded_rectangle(rect, radius=15, fill=PANEL, outline=GRID, width=2)
    xs = np.linspace(-44.0, 44.0, 240)
    elevations = np.asarray([sample_height(height, x, 0.0) for x in xs])
    plot = (left + 58, top + 48, right - 22, bottom - 38)
    min_y = float(elevations.min()) - 0.8
    max_y = float(elevations.max()) + 3.2

    def point(x: float, elevation: float) -> tuple[int, int]:
        px = plot[0] + (x - xs[0]) / (xs[-1] - xs[0]) * (plot[2] - plot[0])
        py = plot[3] - (elevation - min_y) / (max_y - min_y) * (plot[3] - plot[1])
        return round(px), round(py)

    terrain_points = [point(x, elevation) for x, elevation in zip(xs, elevations)]
    terrain_fill = terrain_points + [(plot[2], plot[3]), (plot[0], plot[3])]
    draw.polygon(terrain_fill, fill=(47, 49, 47), outline=(126, 116, 100))

    nearest_index = min(range(len(candidate.flow_path)), key=lambda index: abs(candidate.flow_path[index][1]))
    channel_x = candidate.flow_path[nearest_index][0]
    channel_width = candidate.flow_widths[nearest_index]
    channel_ground = sample_height(height, channel_x, 0.0)
    lava_section = [
        point(channel_x - channel_width / 2, channel_ground + 0.2),
        point(channel_x - channel_width * 0.35, channel_ground + 1.1),
        point(channel_x + channel_width * 0.35, channel_ground + 1.0),
        point(channel_x + channel_width / 2, channel_ground + 0.2),
    ]
    draw.polygon(lava_section, fill=LAVA_CRUST, outline=LAVA, width=2)
    draw.line((lava_section[1], lava_section[2]), fill=LAVA_HOT, width=2)

    action_left = point(-ACTION_RADIUS_M, sample_height(height, -ACTION_RADIUS_M, 0.0))[0]
    action_right = point(ACTION_RADIUS_M, sample_height(height, ACTION_RADIUS_M, 0.0))[0]
    stage_y = min(point(x, sample_height(height, x, 0.0))[1] for x in (-ACTION_RADIUS_M, 0.0, ACTION_RADIUS_M))
    draw.line((action_left, stage_y - 5, action_right, stage_y - 5), fill=STAGE, width=5)
    draw.line((plot[0], plot[3], plot[2], plot[3]), fill=GRID, width=1)
    draw.text((left + 18, top + 13), "TRANSVERSE SECTION — across performer and active reach", font=FONT_18, fill=INK)
    draw.text((action_left - 9, stage_y - 30), "protected 9 m", font=FONT_16, fill=STAGE)
    draw.text((lava_section[0][0] - 8, lava_section[0][1] - 31), "lava", font=FONT_16, fill=LAVA_HOT)
    draw.text((plot[0], bottom - 29), "−44 m", font=FONT_16, fill=MUTED)
    draw.text((plot[2] - 44, bottom - 29), "+44 m", font=FONT_16, fill=MUTED)


def draw_candidate_board(candidate: Candidate) -> tuple[Path, dict[str, object]]:
    height = candidate_height(candidate)
    canvas = Image.new("RGBA", (1800, 1500), (*PAPER, 255))
    draw = ImageDraw.Draw(canvas)

    draw.text((70, 48), candidate.name, font=FONT_52, fill=INK)
    draw.text((72, 111), candidate.subtitle, font=FONT_22, fill=CYAN if candidate.id.startswith("a-") else MUTED)
    draw_wrapped(draw, candidate.thesis, (72, 155), 1120, FONT_20, INK)

    info_rect = (1260, 55, 1730, 300)
    draw.rounded_rectangle(info_rect, radius=18, fill=PANEL, outline=GRID, width=2)
    draw.text((1288, 78), "FORMATION CONTRACT", font=FONT_18, fill=CYAN)
    y = 112
    for label, value in (
        ("Dominant mass", candidate.dominant_mass),
        ("Open horizon", candidate.open_horizon),
        ("Lava expression", candidate.mode),
    ):
        draw.text((1288, y), label.upper(), font=FONT_16, fill=MUTED)
        y += 22
        y += draw_wrapped(draw, value, (1288, y), 412, FONT_16, INK, spacing=3) + 13

    plan_rect = (70, 320, 1730, 900)
    draw_plan(canvas, candidate, height, plan_rect)
    draw = ImageDraw.Draw(canvas)

    longitudinal_metrics = draw_longitudinal_section(draw, candidate, height, (70, 930, 880, 1245))
    draw_transverse_section(draw, candidate, height, (920, 930, 1730, 1245))

    draw.text((72, 1288), "WHY IT COULD WORK", font=FONT_18, fill=CYAN)
    draw_wrapped(draw, candidate.section_note, (72, 1317), 790, FONT_18, INK)
    draw.text((922, 1288), "FAILURE TO GUARD AGAINST", font=FONT_18, fill=RISK)
    draw_wrapped(draw, candidate.chief_risk, (922, 1317), 790, FONT_18, INK)
    draw.text((72, 1445), "Preproduction hypothesis — not an approved scene direction", font=FONT_16, fill=MUTED)

    output_path = OUTPUT_DIR / f"{candidate.id}-measured-board.png"
    canvas.convert("RGB").save(output_path, quality=95)

    flow_clearance = polyline_min_distance_to_origin(candidate.flow_path)
    widest_near_stage = max(
        width
        for (x, z), width in zip(candidate.flow_path, candidate.flow_widths)
        if math.hypot(x, z) < 45.0
    )
    edge_clearance = flow_clearance - widest_near_stage * 0.5 - ACTION_RADIUS_M
    sightlines = sightline_clearance(height)
    metrics: dict[str, object] = {
        "candidateId": candidate.id,
        "candidateName": candidate.name,
        "status": "research-proposal",
        "worldBoundsRuntimeXZ": {"x": list(WORLD_X), "z": list(WORLD_Z)},
        "terrainGrid": {"columns": GRID_COLUMNS, "rows": GRID_ROWS, "cellSizeM": 1.0},
        "terrainElevationM": {
            "minimum": round(float(height.min()), 3),
            "maximum": round(float(height.max()), 3),
            "atPerformer": round(sample_height(height, 0.0, 0.0), 3),
        },
        "performerContract": {
            "actionRadiusM": ACTION_RADIUS_M,
            "orbitRadiusM": ORBIT_RADIUS_M,
            "flowCenterlineMinimumDistanceM": round(flow_clearance, 3),
            "conservativeFlowEdgeToActionEnvelopeClearanceM": round(edge_clearance, 3),
        },
        "longitudinalProfile": longitudinal_metrics,
        "orbitSightlines": sightlines,
        "researchScore": {
            "geologicCausality": candidate.score[0],
            "lavaLegibility": candidate.score[1],
            "heroComposition": candidate.score[2],
            "orbitResilience": candidate.score[3],
            "runtimeFit": candidate.score[4],
            "meshyEfficiency": candidate.score[5],
            "scale": "1–5 directional estimate; requires graybox proof",
        },
        "evidence": output_path.relative_to(ROOT).as_posix(),
    }
    return output_path, metrics


def build_contact_sheet(paths: list[Path]) -> Path:
    previews: list[Image.Image] = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        image.thumbnail((1220, 1010), Image.Resampling.LANCZOS)
        previews.append(image)

    canvas = Image.new("RGB", (3840, 1200), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((56, 34), "EMBER GEOLOGY-FIRST GATE 1 — THREE MEASURED SPATIAL HYPOTHESES", font=FONT_36, fill=INK)
    draw.text(
        (58, 83),
        "Same 380 × 335 m world, 4.5 m action envelope, 25 m orbit cap, north-up plan, and source-to-terminus section.",
        font=FONT_20,
        fill=MUTED,
    )
    column_width = 1260
    for index, preview in enumerate(previews):
        x = 30 + index * column_width
        y = 140
        canvas.paste(preview, (x, y))
        border = (x, y, x + preview.width, y + preview.height)
        draw.rectangle(border, outline=GRID, width=2)
    output = OUTPUT_DIR / "ember-geology-gate1-directions.png"
    canvas.save(output, quality=95)
    return output


def main() -> None:
    paths: list[Path] = []
    metrics: list[dict[str, object]] = []
    for candidate in CANDIDATES:
        path, candidate_metrics = draw_candidate_board(candidate)
        paths.append(path)
        metrics.append(candidate_metrics)

    contact_sheet = build_contact_sheet(paths)
    report = {
        "schemaVersion": 1,
        "artifact": "Ember geology-first Gate 1 comparison",
        "generatedBy": "scripts/build-ember-geology-study.py",
        "worldContract": {
            "runtimeXRangeM": list(WORLD_X),
            "runtimeZRangeM": list(WORLD_Z),
            "actionRadiusM": ACTION_RADIUS_M,
            "interactiveOrbitCapM": ORBIT_RADIUS_M,
            "defaultAudienceCameraRuntimeXZ": list(DEFAULT_CAMERA_XZ),
        },
        "disclaimer": "These are deterministic preproduction hypotheses, not physical lava simulations or approved art direction.",
        "recommendedForFirstGraybox": "a-breached-rift-bench",
        "recommendationBasis": "Best combined geology causality, one-mass/one-horizon composition, runtime fit, and Meshy efficiency. User approval remains required.",
        "contactSheet": contact_sheet.relative_to(ROOT).as_posix(),
        "candidates": metrics,
    }
    report_path = OUTPUT_DIR / "ember-geology-gate1-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(paths)} measured candidate boards")
    print(f"Contact sheet: {contact_sheet}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
