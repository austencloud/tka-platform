#!/usr/bin/env python3
"""Build and verify the Flow Fest Sim Gate 1 measured-plan evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import PIL
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, features


ROOT = Path(__file__).resolve().parents[2]
PLAN_PATH = ROOT / "docs/superpowers/specs/flow-fest-sim/flow-fest-site-plan.json"
OUTPUT_DIRECTORY = ROOT / "docs/superpowers/specs/flow-fest-sim/evidence/gate-1"
OUTPUT_NAMES = (
    "gate1-measured-plan.png",
    "gate1-vertical-section.png",
    "gate1-route-storyboard.png",
    "gate1-sightline-study.png",
    "gate1-review-board.png",
    "gate1-validation.json",
)

FONT_REGULAR = Path("C:/Windows/Fonts/segoeui.ttf")
FONT_SEMIBOLD = Path("C:/Windows/Fonts/seguisb.ttf")
FONT_MONO = Path("C:/Windows/Fonts/consola.ttf")

INK = (238, 242, 239, 255)
MUTED = (174, 188, 181, 255)
BACKGROUND = (12, 20, 18, 255)
PANEL = (22, 32, 29, 245)
PANEL_LIGHT = (35, 48, 43, 245)
MEASURED = (79, 206, 196, 255)
INTERPRETED = (245, 184, 76, 255)
AUTHORED = (255, 104, 88, 255)
ROUTE = (255, 244, 195, 255)
VEHICLE = (139, 186, 255, 255)
UPPER_TENT = (185, 153, 255, 255)
CAR_CAMP = (119, 214, 144, 255)
PASS = (113, 214, 139, 255)
BLOCKED = (233, 124, 116, 255)


@dataclass(frozen=True)
class TerrainData:
    manifest: dict[str, Any]
    height: np.ndarray
    surface_centimeters: np.ndarray
    ortho: Image.Image
    min_x: float
    max_x: float
    min_z: float
    max_z: float
    spacing: float


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def toolchain_fingerprint() -> dict[str, Any]:
    return {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "pillow": PIL.__version__,
        "freetype": features.version_module("freetype2"),
        "textLayout": {
            "resolvedEngine": ImageFont.Layout.BASIC.name,
            "raqm": {"available": features.check("raqm"), "version": features.version("raqm")},
            "harfbuzz": {"available": features.check("harfbuzz"), "version": features.version("harfbuzz")},
            "fribidi": {"available": features.check("fribidi"), "version": features.version("fribidi")},
        },
        "fonts": {
            str(path): {"sha256": sha256(path), "sizeBytes": path.stat().st_size}
            for path in (FONT_REGULAR, FONT_SEMIBOLD, FONT_MONO)
        },
    }


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def font(size: int, *, semibold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_MONO if mono else FONT_SEMIBOLD if semibold else FONT_REGULAR
    return ImageFont.truetype(str(path), size=size, layout_engine=ImageFont.Layout.BASIC)


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, text_font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), candidate, font=text_font)[2] > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    text_font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    width: int,
    line_gap: int = 8,
) -> int:
    x, y = xy
    lines = wrap_lines(draw, text, text_font, width)
    line_height = draw.textbbox((0, 0), "Ag", font=text_font)[3] + line_gap
    for line in lines:
        draw.text((x, y), line, font=text_font, fill=fill)
        y += line_height
    return y


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], *, light: bool = False) -> None:
    draw.rounded_rectangle(box, radius=28, fill=PANEL_LIGHT if light else PANEL, outline=(75, 91, 83, 255), width=2)


def load_terrain(plan: dict[str, Any]) -> TerrainData:
    authority = plan["sourceAuthority"]
    manifest_path = ROOT / authority["terrainManifest"]
    if sha256(manifest_path) != authority["terrainManifestSha256"]:
        raise ValueError("terrain manifest digest differs from the Gate 1 source authority")

    manifest = load_json(manifest_path)
    terrain = manifest["terrain"]
    surface = manifest["surfaceEvidence"]
    ortho = manifest["orthophoto"]
    height_path = ROOT / "static" / terrain["height"]["path"].lstrip("/")
    surface_path = ROOT / "static" / surface["path"].lstrip("/")
    ortho_path = ROOT / "static" / ortho["path"].lstrip("/")

    expected = {
        height_path: authority["heightSha256"],
        surface_path: authority["surfaceSha256"],
        ortho_path: authority["orthophotoSha256"],
    }
    for path, digest in expected.items():
        if sha256(path) != digest:
            raise ValueError(f"source digest differs from the Gate 1 authority: {path}")

    width = terrain["height"]["width"]
    height_count = terrain["height"]["height"]
    height_field = np.fromfile(height_path, dtype="<f4").reshape(height_count, width)
    surface_field = np.fromfile(surface_path, dtype="<u2").reshape(surface["height"], surface["width"])
    bounds = terrain["sampleBoundsWorldMeters"]
    return TerrainData(
        manifest=manifest,
        height=height_field,
        surface_centimeters=surface_field,
        ortho=Image.open(ortho_path).convert("RGB"),
        min_x=float(bounds["minX"]),
        max_x=float(bounds["maxX"]),
        min_z=float(bounds["minZ"]),
        max_z=float(bounds["maxZ"]),
        spacing=float(terrain["height"]["sampleSpacingMeters"]),
    )


def load_connector_trace(plan: dict[str, Any]) -> dict[str, Any]:
    authority = plan["sourceAuthority"]
    trace_path = ROOT / authority["connectorTracePath"]
    if sha256(trace_path) != authority["connectorTraceSha256"]:
        raise ValueError("Austen's connector trace digest differs from the Gate 1 source authority")

    trace = load_json(trace_path)
    if trace["sceneId"] != plan["sceneId"]:
        raise ValueError("connector trace scene differs from the Gate 1 plan")
    if trace["capturedAt"] != authority["connectorTraceCapturedAt"]:
        raise ValueError("connector trace capture time differs from the Gate 1 source authority")
    if trace["source"]["sha256"] != authority["orthophotoSha256"]:
        raise ValueError("connector trace orthophoto differs from the Gate 1 source authority")
    if trace["coordinateFrame"] != "world metres; x east, z south":
        raise ValueError("connector trace coordinate frame is not the registered world frame")
    return trace


def world_to_grid(data: TerrainData, x: float, z: float) -> tuple[float, float]:
    column = (x - data.min_x) / data.spacing
    row = (z - data.min_z) / data.spacing
    return row, column


def sample_bilinear(field: np.ndarray, data: TerrainData, x: float, z: float) -> float:
    row, column = world_to_grid(data, x, z)
    row = float(np.clip(row, 0, field.shape[0] - 1))
    column = float(np.clip(column, 0, field.shape[1] - 1))
    row0 = int(math.floor(row))
    column0 = int(math.floor(column))
    row1 = min(row0 + 1, field.shape[0] - 1)
    column1 = min(column0 + 1, field.shape[1] - 1)
    row_weight = row - row0
    column_weight = column - column0
    north = field[row0, column0] * (1 - column_weight) + field[row0, column1] * column_weight
    south = field[row1, column0] * (1 - column_weight) + field[row1, column1] * column_weight
    return float(north * (1 - row_weight) + south * row_weight)


def surface_offset_meters(data: TerrainData, x: float, z: float) -> float | None:
    row, column = world_to_grid(data, x, z)
    value = int(data.surface_centimeters[int(round(row)), int(round(column))])
    return None if value == 65535 else value / 100


def expand_waypoints(waypoints: list[list[float]] | list[tuple[float, float]], spacing: float = 1.0) -> list[tuple[float, float]]:
    route: list[tuple[float, float]] = []
    for start, end in zip(waypoints, waypoints[1:]):
        distance = math.dist(start, end)
        steps = max(1, int(math.ceil(distance / spacing)))
        for index in range(steps):
            fraction = index / steps
            point = (
                start[0] + (end[0] - start[0]) * fraction,
                start[1] + (end[1] - start[1]) * fraction,
            )
            if not route or point != route[-1]:
                route.append(point)
    final = (float(waypoints[-1][0]), float(waypoints[-1][1]))
    if not route or final != route[-1]:
        route.append(final)
    return route


def build_route(
    plan: dict[str, Any],
    data: TerrainData,
) -> tuple[list[tuple[float, float]], int, dict[str, list[tuple[float, float]]]]:
    stops = plan["route"]["stops"]
    route_config = plan["route"]
    route: list[tuple[float, float]] = []
    vehicle_end_index = 0
    for start_stop, goal_stop in zip(stops, stops[1:]):
        if "pathFromPrevious" not in goal_stop:
            raise ValueError(f"registered path is missing for route stop: {goal_stop['id']}")
        segment = expand_waypoints(goal_stop["pathFromPrevious"], data.spacing)
        if route:
            segment = segment[1:]
        route.extend(segment)
        if goal_stop["number"] == route_config["vehicleThroughStopNumber"]:
            vehicle_end_index = len(route) - 1

    return_routes = {
        branch["journeyId"]: expand_waypoints(branch["waypoints"], data.spacing)
        for branch in route_config["returnBranches"]
    }
    return route, vehicle_end_index, return_routes


def cumulative_route(route: list[tuple[float, float]], data: TerrainData) -> tuple[np.ndarray, np.ndarray]:
    distances = [0.0]
    elevations = [sample_bilinear(data.height, data, *route[0])]
    for previous, current in zip(route, route[1:]):
        distances.append(distances[-1] + math.dist(previous, current))
        elevations.append(sample_bilinear(data.height, data, *current))
    return np.asarray(distances), np.asarray(elevations)


def max_window_grade(distances: np.ndarray, elevations: np.ndarray, window: float) -> float:
    maximum = 0.0
    for index, distance in enumerate(distances):
        target = distance + window
        if target > distances[-1]:
            break
        target_index = int(np.searchsorted(distances, target))
        span = distances[target_index] - distance
        if span > 0:
            maximum = max(maximum, abs(float(elevations[target_index] - elevations[index])) / span)
    return maximum


def stop_route_indices(route: list[tuple[float, float]], plan: dict[str, Any]) -> list[int]:
    indices = []
    start = 0
    for stop in plan["route"]["stops"]:
        x = stop["position"]["x"]
        z = stop["position"]["z"]
        index = min(range(start, len(route)), key=lambda candidate: math.hypot(route[candidate][0] - x, route[candidate][1] - z))
        indices.append(index)
        start = index
    return indices


def zone_masks(
    zone: dict[str, Any],
    plan: dict[str, Any],
    data: TerrainData,
) -> tuple[np.ndarray, np.ndarray, tuple[float, float, float, float]]:
    center = zone["center"]
    if zone["shape"] == "circle":
        radius_x = radius_z = zone["radiusMeters"]
    elif zone["shape"] == "ellipse":
        radius_x = zone["radiusXMeters"]
        radius_z = zone["radiusZMeters"]
    else:
        radius_x = zone["searchRadiusXMeters"]
        radius_z = zone["searchRadiusZMeters"]

    def snap_down(value: float, origin: float) -> float:
        return origin + math.floor((value - origin) / data.spacing) * data.spacing

    def snap_up(value: float, origin: float) -> float:
        return origin + math.ceil((value - origin) / data.spacing) * data.spacing

    min_x = snap_down(center["x"] - radius_x, data.min_x)
    max_x = snap_up(center["x"] + radius_x, data.min_x)
    min_z = snap_down(center["z"] - radius_z, data.min_z)
    max_z = snap_up(center["z"] + radius_z, data.min_z)
    xs = np.arange(min_x, max_x + data.spacing * 0.5, data.spacing)
    zs = np.arange(min_z, max_z + data.spacing * 0.5, data.spacing)
    xx, zz = np.meshgrid(xs, zs)
    envelope = ((xx - center["x"]) / radius_x) ** 2 + ((zz - center["z"]) / radius_z) ** 2 <= 1
    rows = np.rint((zs - data.min_z) / data.spacing).astype(int)
    columns = np.rint((xs - data.min_x) / data.spacing).astype(int)
    surface = data.surface_centimeters[np.ix_(rows, columns)]
    threshold_cm = int(round(plan["route"]["surfaceOccluderThresholdMeters"] * 100))
    open_ground = (surface != 65535) & (surface < threshold_cm)

    if zone["shape"] != "surface-open-region":
        return envelope, envelope, (min_x, min_z, max_x, max_z)

    allowed = envelope & open_ground
    seed = zone["seed"]
    seed_row = round((seed["z"] - min_z) / data.spacing)
    seed_column = round((seed["x"] - min_x) / data.spacing)
    if not allowed[seed_row, seed_column]:
        raise ValueError(f"zone seed is not measured open ground: {zone['id']}")
    derived = np.zeros_like(allowed)
    stack = [(seed_row, seed_column)]
    derived[seed_row, seed_column] = True
    while stack:
        row, column = stack.pop()
        for dz in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dz == 0:
                    continue
                neighbor_row = row + dz
                neighbor_column = column + dx
                if not (0 <= neighbor_row < allowed.shape[0] and 0 <= neighbor_column < allowed.shape[1]):
                    continue
                if allowed[neighbor_row, neighbor_column] and not derived[neighbor_row, neighbor_column]:
                    derived[neighbor_row, neighbor_column] = True
                    stack.append((neighbor_row, neighbor_column))
    return envelope, derived, (min_x, min_z, max_x, max_z)


def analyze_zone(zone: dict[str, Any], plan: dict[str, Any], data: TerrainData) -> dict[str, Any]:
    envelope, derived, bounds = zone_masks(zone, plan, data)
    min_x, min_z, max_x, max_z = bounds
    zs = np.arange(min_z, max_z + data.spacing * 0.5, data.spacing)
    xs = np.arange(min_x, max_x + data.spacing * 0.5, data.spacing)
    rows = np.rint((zs - data.min_z) / data.spacing).astype(int)
    columns = np.rint((xs - data.min_x) / data.spacing).astype(int)
    surface = data.surface_centimeters[np.ix_(rows, columns)]
    threshold_cm = int(round(plan["route"]["surfaceOccluderThresholdMeters"] * 100))
    valid = (surface != 65535) & envelope
    open_ground = valid & (surface < threshold_cm)
    offsets = surface[valid].astype(np.float64) / 100
    envelope_cells = int(envelope.sum())
    open_fraction = float(open_ground.sum() / envelope_cells) if envelope_cells else 0
    result = {
        "id": zone["id"],
        "label": zone["label"],
        "class": zone["class"],
        "shape": zone["shape"],
        "candidateEnvelopeAreaSquareMeters": envelope_cells * data.spacing * data.spacing,
        "candidateEnvelopeOpenFraction": round(open_fraction, 6),
        "measuredOpenAreaSquareMeters": int(open_ground.sum()) * data.spacing * data.spacing,
        "surfaceOffsetMedianMeters": round(float(np.median(offsets)), 3) if len(offsets) else None,
        "surfaceOffsetP90Meters": round(float(np.percentile(offsets, 90)), 3) if len(offsets) else None,
        "surfaceOffsetMaximumMeters": round(float(offsets.max()), 3) if len(offsets) else None,
    }
    if "minimumEnvelopeOpenFraction" in zone:
        minimum = zone["minimumEnvelopeOpenFraction"]
        result["minimumEnvelopeOpenFraction"] = minimum
        result["meetsOpenFraction"] = open_fraction >= minimum
        result["connectedOpenAreaSquareMeters"] = int(derived.sum()) * data.spacing * data.spacing
    return result


def point_in_derived_zone(point: dict[str, float], zone: dict[str, Any], plan: dict[str, Any], data: TerrainData) -> bool:
    _, derived, bounds = zone_masks(zone, plan, data)
    min_x, min_z, max_x, max_z = bounds
    x = point["x"]
    z = point["z"]
    if not (min_x <= x <= max_x and min_z <= z <= max_z):
        return False
    row = round((z - min_z) / data.spacing)
    column = round((x - min_x) / data.spacing)
    return bool(derived[row, column])


def evaluate_sightline_ray(
    start: dict[str, float],
    target: dict[str, float],
    data: TerrainData,
) -> dict[str, Any]:
    distance = math.hypot(target["x"] - start["x"], target["z"] - start["z"])
    sample_count = max(2, int(math.ceil(distance * 2)))
    start_y = sample_bilinear(data.height, data, start["x"], start["z"]) + start["heightMeters"]
    target_y = sample_bilinear(data.height, data, target["x"], target["z"]) + target["heightMeters"]
    minimum_margin = math.inf
    dtm_only_minimum_margin = math.inf
    blocker: dict[str, float] | None = None
    dtm_only_blocker: dict[str, float] | None = None
    profile = []
    for index in range(sample_count + 1):
        fraction = index / sample_count
        x = start["x"] + (target["x"] - start["x"]) * fraction
        z = start["z"] + (target["z"] - start["z"]) * fraction
        terrain_y = sample_bilinear(data.height, data, x, z)
        surface = surface_offset_meters(data, x, z)
        top_y = terrain_y + (surface or 0)
        ray_y = start_y + (target_y - start_y) * fraction
        margin = ray_y - top_y
        dtm_only_margin = ray_y - terrain_y
        profile.append({
            "distanceMeters": round(distance * fraction, 3),
            "terrainElevationMeters": round(terrain_y, 3),
            "surfaceTopElevationMeters": round(top_y, 3),
            "rayElevationMeters": round(ray_y, 3),
        })
        if 0.025 < fraction < 0.975 and margin < minimum_margin:
            minimum_margin = margin
            blocker = {"x": round(x, 3), "z": round(z, 3), "marginMeters": round(margin, 3)}
        if 0.025 < fraction < 0.975 and dtm_only_margin < dtm_only_minimum_margin:
            dtm_only_minimum_margin = dtm_only_margin
            dtm_only_blocker = {"x": round(x, 3), "z": round(z, 3), "marginMeters": round(dtm_only_margin, 3)}
    clear = minimum_margin >= 0
    dtm_only_clear = dtm_only_minimum_margin >= 0
    if clear:
        occlusion_class = "clear"
    elif dtm_only_clear:
        occlusion_class = "surface-only occlusion"
    elif dtm_only_minimum_margin >= -0.5:
        occlusion_class = "marginal terrain + surface occlusion"
    else:
        occlusion_class = "terrain + surface occlusion"
    return {
        "clear": clear,
        "distanceMeters": round(distance, 3),
        "minimumClearanceMeters": round(minimum_margin, 3),
        "criticalPoint": blocker,
        "dtmOnlyClear": dtm_only_clear,
        "dtmOnlyMinimumClearanceMeters": round(dtm_only_minimum_margin, 3),
        "dtmOnlyCriticalPoint": dtm_only_blocker,
        "occlusionClass": occlusion_class,
        "profile": profile,
    }


def evaluate_sightline(item: dict[str, Any], data: TerrainData) -> dict[str, Any]:
    ray = evaluate_sightline_ray(item["from"], item["to"], data)
    clear = ray["clear"]
    neighborhood_radius = int(item.get("neighborhoodRadiusMeters", 0))
    neighborhood = None
    if neighborhood_radius > 0:
        margins = []
        for dz in range(-neighborhood_radius, neighborhood_radius + 1):
            for dx in range(-neighborhood_radius, neighborhood_radius + 1):
                start = {**item["from"], "x": item["from"]["x"] + dx, "z": item["from"]["z"] + dz}
                result = evaluate_sightline_ray(start, item["to"], data)
                margins.append(result["minimumClearanceMeters"])
        neighborhood = {
            "radiusMeters": neighborhood_radius,
            "samples": len(margins),
            "clearSamples": sum(margin >= 0 for margin in margins),
            "worstClearanceMeters": round(min(margins), 3),
        }
    return {
        "id": item["id"],
        "label": item["label"],
        "expected": item["expected"],
        "actual": "clear" if clear else "occluded",
        "matchesExpectation": item["expected"] == ("clear" if clear else "occluded"),
        "distanceMeters": ray["distanceMeters"],
        "minimumClearanceMeters": ray["minimumClearanceMeters"],
        "criticalPoint": ray["criticalPoint"],
        "dtmOnlyClear": ray["dtmOnlyClear"],
        "dtmOnlyMinimumClearanceMeters": ray["dtmOnlyMinimumClearanceMeters"],
        "dtmOnlyCriticalPoint": ray["dtmOnlyCriticalPoint"],
        "occlusionClass": ray["occlusionClass"],
        "neighborhood": neighborhood,
        "profile": ray["profile"],
    }


def canopy_metrics(route: list[tuple[float, float]], plan: dict[str, Any], data: TerrainData) -> dict[str, Any]:
    offsets = [surface_offset_meters(data, x, z) for x, z in route]
    valid = [offset for offset in offsets if offset is not None]
    threshold = plan["route"]["surfaceOccluderThresholdMeters"]
    return {
        "canopySampleCount": len(valid),
        "canopyCoverageFraction": round(sum(offset >= threshold for offset in valid) / len(valid), 6) if valid else None,
        "surfaceOffsetMedianMeters": round(float(np.median(valid)), 3) if valid else None,
    }


def polyline_metrics(route: list[tuple[float, float]], plan: dict[str, Any], data: TerrainData) -> dict[str, Any]:
    distances, elevations = cumulative_route(route, data)
    differences = np.diff(elevations)
    return {
        "distanceMeters": round(float(distances[-1]), 3),
        "minimumElevationMeters": round(float(elevations.min()), 3),
        "maximumElevationMeters": round(float(elevations.max()), 3),
        "elevationChangeMeters": round(float(elevations[-1] - elevations[0]), 3),
        "cumulativeAscentMeters": round(float(differences[differences > 0].sum()), 3),
        "cumulativeDescentMeters": round(float(-differences[differences < 0].sum()), 3),
        "maximumTenMeterGrade": round(float(max_window_grade(distances, elevations, 10)), 5),
        "pointCount": len(route),
        **canopy_metrics(route, plan, data),
    }


def analyze_alternative_journey(journey: dict[str, Any], plan: dict[str, Any], data: TerrainData) -> dict[str, Any]:
    segment_results = []
    vehicle_distance = 0.0
    person_distance = 0.0
    vehicle_grade = 0.0
    person_grade = 0.0
    ascent = 0.0
    descent = 0.0
    elevations: list[float] = []
    for segment in journey["segments"]:
        derived = expand_waypoints(segment["waypoints"], data.spacing)
        metrics = polyline_metrics(derived, plan, data)
        if segment["mode"] == "vehicle":
            vehicle_distance += metrics["distanceMeters"]
            vehicle_grade = max(vehicle_grade, metrics["maximumTenMeterGrade"])
        else:
            person_distance += metrics["distanceMeters"]
            person_grade = max(person_grade, metrics["maximumTenMeterGrade"])
        ascent += metrics["cumulativeAscentMeters"]
        descent += metrics["cumulativeDescentMeters"]
        elevations.extend((metrics["minimumElevationMeters"], metrics["maximumElevationMeters"]))
        segment_results.append({
            "id": segment["id"],
            "mode": segment["mode"],
            "pathClass": segment.get("pathClass"),
            "sourceType": segment.get("sourceType"),
            **metrics,
            "derivedRoute": [
                {
                    "x": round(x, 3),
                    "z": round(z, 3),
                    "navd88ElevationMeters": round(sample_bilinear(data.height, data, x, z), 3),
                }
                for x, z in derived
            ],
        })

    return {
        "id": journey["id"],
        "label": journey["label"],
        "color": journey["color"],
        "vehicleOutcome": journey["vehicleOutcome"],
        "campPosition": journey["campPosition"],
        "vehicleDistanceMeters": round(vehicle_distance, 3),
        "pedestrianDistanceMeters": round(person_distance, 3),
        "nominalWalkingMinutes": round(person_distance / plan["player"]["nominalWalkingSpeedMetersPerSecond"] / 60, 2),
        "minimumElevationMeters": round(min(elevations), 3),
        "maximumElevationMeters": round(max(elevations), 3),
        "cumulativeAscentMeters": round(ascent, 3),
        "cumulativeDescentMeters": round(descent, 3),
        "vehicleMaximumTenMeterGrade": round(vehicle_grade, 5),
        "pedestrianMaximumTenMeterGrade": round(person_grade, 5),
        "segments": segment_results,
    }


def journey_segment(journey: dict[str, Any], segment_id: str) -> dict[str, Any]:
    return next(segment for segment in journey["segments"] if segment["id"] == segment_id)


def analyze(
    plan: dict[str, Any],
    data: TerrainData,
    route: list[tuple[float, float]],
    vehicle_end_index: int,
    return_routes: dict[str, list[tuple[float, float]]],
) -> dict[str, Any]:
    distances, elevations = cumulative_route(route, data)
    differences = np.diff(elevations)
    vehicle_route = route[: vehicle_end_index + 1]
    pedestrian_route = route[vehicle_end_index:]
    vehicle_distances, vehicle_elevations = cumulative_route(vehicle_route, data)
    pedestrian_distances, pedestrian_elevations = cumulative_route(pedestrian_route, data)
    primary_return_route = return_routes[plan["route"]["primaryJourneyId"]]
    return_metrics = {
        journey_id: polyline_metrics(return_route, plan, data)
        for journey_id, return_route in return_routes.items()
    }
    primary_return_distances, primary_return_elevations = cumulative_route(primary_return_route, data)
    stop_indices = stop_route_indices(route, plan)
    segment_metrics = []
    for start_index, end_index, start_stop, end_stop in zip(
        stop_indices,
        stop_indices[1:],
        plan["route"]["stops"],
        plan["route"]["stops"][1:],
    ):
        segment_route = route[start_index : end_index + 1]
        metrics = polyline_metrics(segment_route, plan, data)
        segment_metrics.append({
            "from": start_stop["id"],
            "to": end_stop["id"],
            "mode": "vehicle" if end_stop["number"] <= plan["route"]["vehicleThroughStopNumber"] else "person",
            "pathClass": end_stop.get("pathClass"),
            "sourceType": end_stop.get("sourceType"),
            **metrics,
        })

    zones = [analyze_zone(item, plan, data) for item in plan["zones"]]
    sightlines = [evaluate_sightline(item, data) for item in plan["sightlines"]]
    alternative_journeys = [
        analyze_alternative_journey(journey, plan, data)
        for journey in plan["route"]["alternativeJourneys"]
    ]
    for journey in alternative_journeys:
        metrics = return_metrics[journey["id"]]
        journey["returnDistanceMeters"] = metrics["distanceMeters"]
        journey["returnWalkingMinutes"] = round(metrics["distanceMeters"] / plan["player"]["nominalWalkingSpeedMetersPerSecond"] / 60, 2)
        journey["returnMaximumTenMeterGrade"] = metrics["maximumTenMeterGrade"]
        journey["derivedReturnRoute"] = [
            {
                "x": round(x, 3),
                "z": round(z, 3),
                "navd88ElevationMeters": round(sample_bilinear(data.height, data, x, z), 3),
            }
            for x, z in return_routes[journey["id"]]
        ]
    vehicle_grade = max_window_grade(vehicle_distances, vehicle_elevations, 10)
    pedestrian_grade = max(
        max_window_grade(pedestrian_distances, pedestrian_elevations, 10),
        max_window_grade(primary_return_distances, primary_return_elevations, 10),
    )
    repeated_connector = next(item for item in segment_metrics if item["from"] == "lower-tent-home-on-foot" and item["to"] == "middle-earth-arrival")
    route_metrics = {
        "distanceMeters": round(float(distances[-1]), 3),
        "vehicleDistanceMeters": round(float(vehicle_distances[-1]), 3),
        "pedestrianDistanceMeters": round(float(pedestrian_distances[-1]), 3),
        "optionalReturnDistanceMeters": return_metrics["lower-tent"]["distanceMeters"],
        "nominalWalkingMinutes": round(float(pedestrian_distances[-1]) / plan["player"]["nominalWalkingSpeedMetersPerSecond"] / 60, 2),
        "optionalReturnWalkingMinutes": round(return_metrics["lower-tent"]["distanceMeters"] / plan["player"]["nominalWalkingSpeedMetersPerSecond"] / 60, 2),
        "repeatedLowerConnectorDistanceMeters": repeated_connector["distanceMeters"],
        "minimumElevationMeters": round(float(elevations.min()), 3),
        "maximumElevationMeters": round(float(elevations.max()), 3),
        "cumulativeAscentMeters": round(float(differences[differences > 0].sum()), 3),
        "cumulativeDescentMeters": round(float(-differences[differences < 0].sum()), 3),
        "vehicleMaximumTenMeterGrade": round(float(vehicle_grade), 5),
        "pedestrianMaximumTenMeterGrade": round(float(pedestrian_grade), 5),
        "routePointCount": len(route),
        "returnRoutePointCount": len(primary_return_route),
        "vehicleEndRoutePointIndex": vehicle_end_index,
    }
    stops = []
    for stop, route_index in zip(plan["route"]["stops"], stop_indices):
        point = stop["position"]
        stops.append({
            "id": stop["id"],
            "number": stop["number"],
            "x": point["x"],
            "z": point["z"],
            "navd88ElevationMeters": round(sample_bilinear(data.height, data, point["x"], point["z"]), 3),
            "routeDistanceMeters": round(float(distances[route_index]), 3),
        })

    final_view = next(item for item in sightlines if item["id"] == "night-composition")
    final_view_contract = next(item for item in plan["sightlines"] if item["id"] == "night-composition")
    final_neighborhood = final_view["neighborhood"]
    constrained_zones = [zone for zone in zones if "meetsOpenFraction" in zone]
    all_pedestrian_grades = [
        pedestrian_grade,
        *(journey["pedestrianMaximumTenMeterGrade"] for journey in alternative_journeys),
        *(metrics["maximumTenMeterGrade"] for metrics in return_metrics.values()),
    ]
    maximum_pedestrian_grade = max(all_pedestrian_grades)
    all_vehicle_grades = [vehicle_grade, *(journey["vehicleMaximumTenMeterGrade"] for journey in alternative_journeys)]
    maximum_vehicle_grade = max(all_vehicle_grades)
    primary_stop_ids = [stop["id"] for stop in plan["route"]["stops"]]
    required_primary_order = [
        "lower-gate-check-in",
        "lower-tent-unload",
        "lower-gate-return",
        "west-upper-parking",
        "lower-tent-home-on-foot",
        "middle-earth-arrival",
        "community-task",
        "first-night-choice",
    ]
    alternative_by_id = {journey["id"]: journey for journey in plan["route"]["alternativeJourneys"]}
    upper_segment_ids = {segment["id"] for segment in alternative_by_id["upper-tent"]["segments"]}
    car_segment_ids = {segment["id"] for segment in alternative_by_id["car-camp"]["segments"]}
    stop_by_id = {stop["id"]: stop for stop in plan["route"]["stops"]}
    gate_point = stop_by_id["lower-gate-check-in"]["position"]
    lower_camp_point = stop_by_id["lower-tent-unload"]["position"]
    parking_point = stop_by_id["west-upper-parking"]["position"]
    middle_point = stop_by_id["middle-earth-arrival"]["position"]
    night_point = stop_by_id["first-night-choice"]["position"]
    connector_trace = load_connector_trace(plan)
    upper_trace = [
        [point["x"], point["z"]]
        for point in connector_trace["paths"]["upperClearingToMiddleEarth"]
    ]
    lower_trace = [
        [point["x"], point["z"]]
        for point in connector_trace["paths"]["middleEarthToLowerClearing"]
    ]

    def close(left: Any, right: Any, tolerance: float = 0.5) -> bool:
        left_x, left_z = (left["x"], left["z"]) if isinstance(left, dict) else (left[0], left[1])
        right_x, right_z = (right["x"], right["z"]) if isinstance(right, dict) else (right[0], right[1])
        return math.hypot(left_x - right_x, left_z - right_z) <= tolerance

    primary_endpoints_valid = all(
        close(goal_stop["pathFromPrevious"][0], start_stop["position"])
        and close(goal_stop["pathFromPrevious"][-1], goal_stop["position"])
        for start_stop, goal_stop in zip(plan["route"]["stops"], plan["route"]["stops"][1:])
    )

    def segments_contiguous(journey: dict[str, Any]) -> bool:
        return all(close(left["waypoints"][-1], right["waypoints"][0]) for left, right in zip(journey["segments"], journey["segments"][1:]))

    def contains_points(route_points: list[list[float]], source_points: list[list[float]]) -> bool:
        if len(source_points) > len(route_points):
            return False
        return any(
            all(
                math.isclose(candidate[0], source[0], rel_tol=0.0, abs_tol=1e-9)
                and math.isclose(candidate[1], source[1], rel_tol=0.0, abs_tol=1e-9)
                for candidate, source in zip(route_points[start:], source_points)
            )
            for start in range(len(route_points) - len(source_points) + 1)
        )

    upper_by_id = {segment["id"]: segment for segment in alternative_by_id["upper-tent"]["segments"]}
    car_by_id = {segment["id"]: segment for segment in alternative_by_id["car-camp"]["segments"]}
    upper_camp_point = alternative_by_id["upper-tent"]["campPosition"]
    car_camp_point = alternative_by_id["car-camp"]["campPosition"]
    parking_zone = next(zone for zone in plan["zones"] if zone["id"] == "west-upper-parking-zone")
    car_points = [point for segment in alternative_by_id["car-camp"]["segments"] for point in segment["waypoints"]]
    car_avoids_upper_parking = all(
        math.hypot(point[0] - parking_point["x"], point[1] - parking_point["z"]) > parking_zone["radiusMeters"]
        for point in car_points
    )
    geometric_topology_valid = (
        primary_endpoints_valid
        and segments_contiguous(alternative_by_id["upper-tent"])
        and segments_contiguous(alternative_by_id["car-camp"])
        and close(upper_by_id["gate-to-upper-unload"]["waypoints"][0], gate_point)
        and close(upper_by_id["gate-to-upper-unload"]["waypoints"][-1], upper_camp_point)
        and close(upper_by_id["upper-unload-to-gate"]["waypoints"][-1], gate_point)
        and close(upper_by_id["gate-to-west-parking"]["waypoints"][-1], parking_point)
        and close(upper_by_id["parking-to-upper-camp"]["waypoints"][-1], upper_camp_point)
        and close(upper_by_id["upper-camp-to-middle-earth"]["waypoints"][-1], upper_trace[-1])
        and close(car_by_id["gate-to-car-camp"]["waypoints"][0], gate_point)
        and close(car_by_id["gate-to-car-camp"]["waypoints"][-1], car_camp_point)
        and close(car_by_id["car-camp-to-middle-earth"]["waypoints"][-1], lower_trace[0])
        and car_avoids_upper_parking
    )
    topology_valid = (
        primary_stop_ids == required_primary_order
        and alternative_by_id["upper-tent"]["vehicleOutcome"] == "relocated-to-west-upper-parking"
        and {"upper-unload-to-gate", "gate-to-west-parking", "parking-to-upper-camp", "upper-camp-to-middle-earth"}.issubset(upper_segment_ids)
        and alternative_by_id["car-camp"]["vehicleOutcome"] == "stays-at-campsite"
        and "gate-to-car-camp" in car_segment_ids
        and "car-camp-to-middle-earth" in car_segment_ids
        and "gate-to-west-parking" not in car_segment_ids
        and geometric_topology_valid
    )
    connector_sources = {
        "lower-to-middle": stop_by_id["middle-earth-arrival"].get("sourceType"),
        "upper-to-middle": upper_by_id["upper-camp-to-middle-earth"].get("sourceType"),
        "car-camp-to-middle": car_by_id["car-camp-to-middle-earth"].get("sourceType"),
    }
    connector_metrics = {
        "lower-to-middle": next(item for item in segment_metrics if item["to"] == "middle-earth-arrival"),
        "upper-to-middle": journey_segment(next(item for item in alternative_journeys if item["id"] == "upper-tent"), "upper-camp-to-middle-earth"),
        "car-camp-to-middle": journey_segment(next(item for item in alternative_journeys if item["id"] == "car-camp"), "car-camp-to-middle-earth"),
    }
    connectors_registered = all(source == "austen-traced" for source in connector_sources.values())
    return_by_id = {branch["journeyId"]: branch for branch in plan["route"]["returnBranches"]}
    primary_walk = stop_by_id["lower-tent-home-on-foot"]["pathFromPrevious"]
    primary_lower_connector = stop_by_id["middle-earth-arrival"]["pathFromPrevious"]
    trace_usage_valid = (
        contains_points(primary_walk, upper_trace)
        and contains_points(primary_walk, lower_trace)
        and contains_points(primary_lower_connector, list(reversed(lower_trace)))
        and contains_points(upper_by_id["upper-camp-to-middle-earth"]["waypoints"], upper_trace)
        and contains_points(car_by_id["car-camp-to-middle-earth"]["waypoints"], list(reversed(lower_trace)))
        and contains_points(return_by_id["lower-tent"]["waypoints"], lower_trace)
        and contains_points(return_by_id["upper-tent"]["waypoints"], list(reversed(upper_trace)))
        and contains_points(return_by_id["car-camp"]["waypoints"], lower_trace)
    )
    middle_center = next(zone["center"] for zone in plan["zones"] if zone["id"] == "middle-earth-zone")
    campsite_points = {
        "lower-tent": next(stop["position"] for stop in plan["route"]["stops"] if stop["id"] == "lower-tent-unload"),
        **{journey["id"]: journey["campPosition"] for journey in plan["route"]["alternativeJourneys"]},
    }
    campsite_distances = {
        name: round(math.hypot(point["x"] - middle_center["x"], point["z"] - middle_center["z"]), 3)
        for name, point in campsite_points.items()
    }
    camping_excluded_from_middle = all(distance > 35 for distance in campsite_distances.values())
    car_camp_zone = next(zone for zone in plan["zones"] if zone["id"] == "car-camp-zone")
    lower_tent_outside_car_camp = not point_in_derived_zone(lower_camp_point, car_camp_zone, plan, data)
    all_routes = [route, *return_routes.values()]
    for journey in alternative_by_id.values():
        all_routes.extend(expand_waypoints(segment["waypoints"], data.spacing) for segment in journey["segments"])
    routes_inside_terrain = all(
        data.min_x <= x <= data.max_x and data.min_z <= z <= data.max_z
        for candidate_route in all_routes
        for x, z in candidate_route
    )
    design_widths_valid = (
        plan["route"]["personDesignWidthMeters"] >= 0.8
        and plan["route"]["vehicleDesignWidthMeters"] >= 3
        and plan["route"]["accessibleDesignWidthMeters"] >= 3
        and routes_inside_terrain
    )
    return_targets = {branch["journeyId"]: branch["campPosition"] for branch in plan["route"]["returnBranches"]}
    returns_valid = (
        set(return_routes) == set(campsite_points)
        and all(close(return_route[0], night_point) and close(return_route[-1], return_targets[journey_id]) for journey_id, return_route in return_routes.items())
        and all(close(return_targets[journey_id], campsite_points[journey_id]) for journey_id in campsite_points)
    )
    return_summary = "; ".join(f"{journey_id} {return_metrics[journey_id]['distanceMeters']:.1f} m" for journey_id in ("lower-tent", "upper-tent", "car-camp"))
    surface_only_count = sum(item["occlusionClass"] == "surface-only occlusion" for item in sightlines)
    marginal_terrain_count = sum(item["occlusionClass"] == "marginal terrain + surface occlusion" for item in sightlines)
    terrain_occluded_count = sum(item["occlusionClass"] == "terrain + surface occlusion" for item in sightlines)
    checks = {
        "walkability": {
            "status": "passed" if maximum_pedestrian_grade <= plan["route"]["maximumTenMeterGrade"] else "failed",
            "evidence": f"All three registered pedestrian branches hold a {maximum_pedestrian_grade * 100:.1f}% maximum ten-metre DTM grade against the {plan['route']['maximumTenMeterGrade'] * 100:.0f}% game-space cap; this is not an ADA field survey.",
        },
        "clearance": {
            "status": "passed" if design_widths_valid else "failed",
            "evidence": f"All registered route points remain inside the measured terrain footprint, and the Gate 2 contract reserves {plan['route']['personDesignWidthMeters']:.1f} m person, {plan['route']['vehicleDesignWidthMeters']:.1f} m vehicle, and {plan['route']['accessibleDesignWidthMeters']:.1f} m accessible game-space widths. Physical and ADA clearance remain field-unverified.",
        },
        "vehicle-grade": {
            "status": "passed" if maximum_vehicle_grade <= plan["route"]["vehicleMaximumTenMeterGrade"] else "failed",
            "evidence": f"All registered vehicle branches hold a {maximum_vehicle_grade * 100:.1f}% maximum ten-metre DTM grade against the {plan['route']['vehicleMaximumTenMeterGrade'] * 100:.0f}% game-space driving cap; the real road grade remains field-unverified.",
        },
        "sightlines": {
            "status": "passed" if all(item["matchesExpectation"] for item in sightlines) else "failed",
            "evidence": f"{sum(item['matchesExpectation'] for item in sightlines)} of {len(sightlines)} expectations match: {terrain_occluded_count} terrain-plus-surface occlusions, {marginal_terrain_count} marginal terrain-plus-surface occlusion, {surface_only_count} surface-only occlusion, and {sum(item['actual'] == 'clear' for item in sightlines)} clear relationships.",
        },
        "final-view": {
            "status": "passed" if final_view["actual"] == "clear" and final_neighborhood and final_neighborhood["clearSamples"] == final_neighborhood["samples"] else "failed",
            "evidence": f"The registered dusk camera frames a {final_view_contract['to']['heightMeters']:.1f} m composition target from all {final_neighborhood['samples']} points in its {final_neighborhood['radiusMeters']} m review neighbourhood; worst clearance is {final_neighborhood['worstClearanceMeters']:.2f} m.",
        },
        "arrival-topology": {
            "status": "passed" if topology_valid else "failed",
            "evidence": "Lower- and upper-tent branches unload, return through the lower gate, relocate to west upper parking, and walk home; lower car camping keeps the vehicle and skips relocation.",
        },
        "return-route": {
            "status": "passed" if returns_valid else "failed",
            "evidence": f"All three night returns terminate at their own branch campsite: {return_summary}.",
        },
        "connector-registration": {
            "status": "passed" if connectors_registered else "failed",
            "evidence": "Austen-traced connector centerlines are registered with measured >=2 m surface coverage: " + "; ".join(f"{name} {metrics['canopyCoverageFraction'] * 100:.1f}%" for name, metrics in connector_metrics.items()) + ". Physical field precision remains unverified.",
        },
        "connector-trace-lock": {
            "status": "passed" if trace_usage_valid else "failed",
            "evidence": f"The {len(upper_trace)}-vertex upper-to-middle trace and {len(lower_trace)}-vertex middle-to-lower trace captured {connector_trace['capturedAt']} are source-locked to the registered orthophoto and embedded without vertex drift in every affected arrival and return branch.",
        },
        "middle-earth-camping-exclusion": {
            "status": "passed" if camping_excluded_from_middle else "failed",
            "evidence": "All three campsite examples remain outside Middle Earth: " + "; ".join(f"{name} {distance:.1f} m from its activity center" for name, distance in campsite_distances.items()) + ".",
        },
        "lower-camping-separation": {
            "status": "passed" if lower_tent_outside_car_camp else "failed",
            "evidence": "Austen's placement keeps the representative lower-tent point outside the authored open-middle car-camping envelope. Both examples sit on measured open ground; no measured physical feature is claimed to divide them.",
        },
        "zone-openness": {
            "status": "passed" if all(zone["meetsOpenFraction"] for zone in constrained_zones) else "failed",
            "evidence": "; ".join(f"{zone['label']} envelope {zone['candidateEnvelopeOpenFraction'] * 100:.1f}% measured open" for zone in constrained_zones),
        },
    }
    return {
        "routeMetrics": route_metrics,
        "segmentMetrics": segment_metrics,
        "alternativeJourneys": alternative_journeys,
        "stops": stops,
        "zones": zones,
        "sightlines": sightlines,
        "checks": checks,
        "derivedRoute": [
            {
                "x": x,
                "z": z,
                "navd88ElevationMeters": round(sample_bilinear(data.height, data, x, z), 3),
            }
            for x, z in route
        ],
        "derivedReturnRoute": [
            {
                "x": x,
                "z": z,
                "navd88ElevationMeters": round(sample_bilinear(data.height, data, x, z), 3),
            }
            for x, z in primary_return_route
        ],
        "derivedReturnRoutes": {
            journey_id: [
                {
                    "x": x,
                    "z": z,
                    "navd88ElevationMeters": round(sample_bilinear(data.height, data, x, z), 3),
                }
                for x, z in return_route
            ]
            for journey_id, return_route in return_routes.items()
        },
    }


def ortho_crop(data: TerrainData, bounds: dict[str, float], size: tuple[int, int]) -> Image.Image:
    width, height = data.ortho.size
    left = int(round((bounds["minX"] - data.min_x) / (data.max_x - data.min_x) * width))
    right = int(round((bounds["maxX"] - data.min_x) / (data.max_x - data.min_x) * width))
    top = int(round((bounds["minZ"] - data.min_z) / (data.max_z - data.min_z) * height))
    bottom = int(round((bounds["maxZ"] - data.min_z) / (data.max_z - data.min_z) * height))
    crop = data.ortho.crop((left, top, right, bottom)).resize(size, Image.Resampling.LANCZOS)
    crop = ImageEnhance.Color(crop).enhance(0.78)
    crop = ImageEnhance.Contrast(crop).enhance(1.12)
    crop = ImageEnhance.Brightness(crop).enhance(0.68)
    return crop.convert("RGBA")


def world_mapper(bounds: dict[str, float], box: tuple[int, int, int, int]):
    x0, y0, x1, y1 = box
    width = x1 - x0
    height = y1 - y0

    def project(x: float, z: float) -> tuple[int, int]:
        px = x0 + (x - bounds["minX"]) / (bounds["maxX"] - bounds["minX"]) * width
        py = y0 + (z - bounds["minZ"]) / (bounds["maxZ"] - bounds["minZ"]) * height
        return round(px), round(py)

    return project


def aspect_fit_world_box(bounds: dict[str, float], box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    world_aspect = (bounds["maxX"] - bounds["minX"]) / (bounds["maxZ"] - bounds["minZ"])
    box_aspect = (x1 - x0) / (y1 - y0)
    if box_aspect > world_aspect:
        fitted_width = round((y1 - y0) * world_aspect)
        inset = ((x1 - x0) - fitted_width) // 2
        return x0 + inset, y0, x0 + inset + fitted_width, y1
    fitted_height = round((x1 - x0) / world_aspect)
    inset = ((y1 - y0) - fitted_height) // 2
    return x0, y0 + inset, x1, y0 + inset + fitted_height


def draw_dashed_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    fill: tuple[int, int, int, int],
    width: int,
    dash: int = 18,
    gap: int = 12,
) -> None:
    distance = math.dist(start, end)
    if distance == 0:
        return
    dx = (end[0] - start[0]) / distance
    dy = (end[1] - start[1]) / distance
    cursor = 0.0
    while cursor < distance:
        finish = min(distance, cursor + dash)
        draw.line(
            (
                start[0] + dx * cursor,
                start[1] + dy * cursor,
                start[0] + dx * finish,
                start[1] + dy * finish,
            ),
            fill=fill,
            width=width,
        )
        cursor += dash + gap


def draw_arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], fill: tuple[int, int, int, int], width: int) -> None:
    draw.line((start, end), fill=fill, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    length = width * 3.2
    wing = math.pi / 6
    points = [
        end,
        (end[0] - length * math.cos(angle - wing), end[1] - length * math.sin(angle - wing)),
        (end[0] - length * math.cos(angle + wing), end[1] - length * math.sin(angle + wing)),
    ]
    draw.polygon(points, fill=fill)


def draw_route_line(
    draw: ImageDraw.ImageDraw,
    pixels: list[tuple[int, int]],
    color: tuple[int, int, int, int],
    width: int,
    *,
    canopy_hidden: bool = False,
    halo: bool = True,
) -> None:
    if len(pixels) < 2:
        return
    if halo:
        draw.line(pixels, fill=(5, 8, 7, 225), width=width + 8, joint="curve")
    if not canopy_hidden:
        draw.line(pixels, fill=color, width=width, joint="curve")
        return
    for start in range(0, len(pixels) - 1, 24):
        chunk = pixels[start : min(start + 15, len(pixels))]
        if len(chunk) > 1:
            draw.line(chunk, fill=color, width=width, joint="curve")


def draw_zone(draw: ImageDraw.ImageDraw, project, zone: dict[str, Any]) -> None:
    center = zone["center"]
    center_px = project(center["x"], center["z"])
    if zone["shape"] == "circle":
        edge = project(center["x"] + zone["radiusMeters"], center["z"])
        radius_x = abs(edge[0] - center_px[0])
        edge_z = project(center["x"], center["z"] + zone["radiusMeters"])
        radius_z = abs(edge_z[1] - center_px[1])
    else:
        edge = project(center["x"] + zone["radiusXMeters"], center["z"])
        radius_x = abs(edge[0] - center_px[0])
        edge_z = project(center["x"], center["z"] + zone["radiusZMeters"])
        radius_z = abs(edge_z[1] - center_px[1])
    color = AUTHORED if zone["class"] == "invention" else INTERPRETED
    fill = (*color[:3], 36)
    box = (center_px[0] - radius_x, center_px[1] - radius_z, center_px[0] + radius_x, center_px[1] + radius_z)
    draw.ellipse(box, fill=fill, outline=color, width=5)


def draw_surface_open_zone(
    overlay: Image.Image,
    project,
    zone: dict[str, Any],
    plan: dict[str, Any],
    data: TerrainData,
) -> None:
    _, derived, bounds = zone_masks(zone, plan, data)
    min_x, min_z, max_x, max_z = bounds
    start = project(min_x, min_z)
    end = project(max_x + data.spacing, max_z + data.spacing)
    width = max(1, end[0] - start[0])
    height = max(1, end[1] - start[1])
    mask = Image.fromarray(derived.astype(np.uint8) * 255)
    eroded = mask.filter(ImageFilter.MinFilter(3))
    edge = Image.fromarray(np.asarray(mask, dtype=np.int16).clip(0, 255).astype(np.uint8))
    edge_array = np.asarray(edge, dtype=np.int16) - np.asarray(eroded, dtype=np.int16)
    edge = Image.fromarray(np.clip(edge_array, 0, 255).astype(np.uint8))
    fill_mask = mask.resize((width, height), Image.Resampling.NEAREST).point(lambda value: 54 if value else 0)
    edge_mask = edge.resize((width, height), Image.Resampling.NEAREST)
    fill_layer = Image.new("RGBA", (width, height), (*INTERPRETED[:3], 0))
    fill_layer.putalpha(fill_mask)
    edge_layer = Image.new("RGBA", (width, height), (*INTERPRETED[:3], 0))
    edge_layer.putalpha(edge_mask)
    overlay.alpha_composite(fill_layer, start)
    overlay.alpha_composite(edge_layer, start)


def draw_zone_labels(
    draw: ImageDraw.ImageDraw,
    project,
    plan: dict[str, Any],
    analysis: dict[str, Any],
) -> None:
    zone_results = {item["id"]: item for item in analysis["zones"]}
    for zone in plan["zones"]:
        if zone["shape"] != "surface-open-region":
            continue
        center = project(zone["center"]["x"], zone["center"]["z"])
        result = zone_results[zone["id"]]
        color = AUTHORED if zone["class"] == "invention" else INTERPRETED
        label = f"{zone['label']} · {result['candidateEnvelopeOpenFraction'] * 100:.1f}% open envelope"
        label_font = font(19, semibold=True)
        label_box = draw.textbbox((0, 0), label, font=label_font)
        box_width = label_box[2] - label_box[0] + 24
        label_offset = -105 if zone["id"] == "middle-earth-zone" else -88
        draw.line((center[0], center[1], center[0], center[1] + label_offset), fill=color, width=3)
        draw.rounded_rectangle(
            (center[0] - box_width / 2, center[1] + label_offset - 18, center[0] + box_width / 2, center[1] + label_offset + 18),
            radius=12,
            fill=(10, 17, 15, 220),
            outline=color,
            width=2,
        )
        draw.text((center[0], center[1] + label_offset), label, font=label_font, fill=INK, anchor="mm")

    label_offsets = {
        "lower-gate-zone": (-10, -62),
        "upper-tent-zone": (0, 58),
        "west-upper-parking-zone": (-6, -68),
        "lower-tent-zone": (60, 68),
    }
    for zone in plan["zones"]:
        if zone["id"] not in label_offsets:
            continue
        center = project(zone["center"]["x"], zone["center"]["z"])
        dx, dy = label_offsets[zone["id"]]
        color = AUTHORED if zone["class"] == "invention" else INTERPRETED
        draw.line((center[0], center[1], center[0] + dx, center[1] + dy), fill=color, width=3)
        draw.text((center[0] + dx, center[1] + dy), zone["label"], font=font(18, semibold=True), fill=INK, anchor="mm", stroke_width=4, stroke_fill=(8, 13, 12, 235))


def draw_map_base(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    plan: dict[str, Any],
    data: TerrainData,
    route: list[tuple[float, float]],
    analysis: dict[str, Any],
    *,
    sightlines: bool = True,
) -> Any:
    bounds = plan["planView"]
    box = aspect_fit_world_box(bounds, box)
    x0, y0, x1, y1 = box
    base = ortho_crop(data, bounds, (x1 - x0, y1 - y0))
    canvas.alpha_composite(base, (x0, y0))
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    project = world_mapper(bounds, box)

    surface = data.surface_centimeters
    row0, column0 = world_to_grid(data, bounds["minX"], bounds["minZ"])
    row1, column1 = world_to_grid(data, bounds["maxX"], bounds["maxZ"])
    surface_crop = surface[int(round(row0)) : int(round(row1)) + 1, int(round(column0)) : int(round(column1)) + 1]
    threshold_cm = int(round(plan["route"]["surfaceOccluderThresholdMeters"] * 100))
    mask = ((surface_crop != 65535) & (surface_crop >= threshold_cm)).astype(np.uint8) * 255
    mask_image = Image.fromarray(mask).resize((x1 - x0, y1 - y0), Image.Resampling.NEAREST)
    obstacle_layer = Image.new("RGBA", (x1 - x0, y1 - y0), (*INTERPRETED[:3], 0))
    obstacle_layer.putalpha(mask_image.point(lambda value: 105 if value else 0))
    overlay.alpha_composite(obstacle_layer, (x0, y0))

    for zone in plan["zones"]:
        if zone["shape"] == "surface-open-region":
            draw_surface_open_zone(overlay, project, zone, plan, data)
        else:
            draw_zone(draw, project, zone)

    draw = ImageDraw.Draw(overlay)

    if sightlines:
        sightline_results = {item["id"]: item for item in analysis["sightlines"]}
        for item in plan["sightlines"]:
            result = sightline_results[item["id"]]
            color = PASS if result["actual"] == "clear" else BLOCKED
            draw_dashed_line(
                draw,
                project(item["from"]["x"], item["from"]["z"]),
                project(item["to"]["x"], item["to"]["z"]),
                color,
                6,
            )

    route_pixels = [project(x, z) for x, z in route]
    vehicle_end_index = analysis["routeMetrics"]["vehicleEndRoutePointIndex"]
    vehicle_pixels = route_pixels[: vehicle_end_index + 1]
    pedestrian_pixels = route_pixels[vehicle_end_index:]
    return_pixels = [project(item["x"], item["z"]) for item in analysis["derivedReturnRoute"]]
    for pixels, color, width in (
        (vehicle_pixels, VEHICLE, 13),
        (pedestrian_pixels, ROUTE, 9),
    ):
        draw_route_line(draw, pixels, color, width)
    if len(return_pixels) > 1:
        draw.line(return_pixels, fill=(5, 8, 7, 220), width=10, joint="curve")
        draw.line(return_pixels, fill=(*MEASURED[:3], 210), width=5, joint="curve")
    branch_colors = {"upper-tent": UPPER_TENT, "car-camp": CAR_CAMP}
    for journey in analysis["alternativeJourneys"]:
        color = branch_colors[journey["id"]]
        for segment in journey["segments"]:
            pixels = [project(point["x"], point["z"]) for point in segment["derivedRoute"]]
            draw_route_line(draw, pixels, color, 4, canopy_hidden=segment.get("sourceType") == "austen-traced", halo=False)
    for pixels, color in ((vehicle_pixels, VEHICLE), (pedestrian_pixels, AUTHORED)):
        for index in range(35, len(pixels), 70):
            draw_arrow(draw, pixels[index - 8], pixels[index], color, 5)

    stop_groups: dict[tuple[float, float], list[dict[str, Any]]] = {}
    for stop in plan["route"]["stops"]:
        key = (stop["position"]["x"], stop["position"]["z"])
        stop_groups.setdefault(key, []).append(stop)
    for (x, z), stops in stop_groups.items():
        point = project(x, z)
        radius = 34 if len(stops) > 1 else 28
        draw.ellipse((point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius), fill=AUTHORED, outline=INK, width=4)
        number_font = font(23 if len(stops) > 1 else 31, semibold=True)
        number = "→".join(str(stop["number"]) for stop in stops)
        bounds_text = draw.textbbox((0, 0), number, font=number_font)
        draw.text(
            (point[0] - (bounds_text[2] - bounds_text[0]) / 2, point[1] - (bounds_text[3] - bounds_text[1]) / 2 - 3),
            number,
            font=number_font,
            fill=BACKGROUND,
        )

    draw_zone_labels(draw, project, plan, analysis)

    canvas.alpha_composite(overlay)
    return project


def draw_header(draw: ImageDraw.ImageDraw, title: str, subtitle: str, width: int) -> None:
    draw.text((80, 45), title, font=font(64, semibold=True), fill=INK)
    draw.text((82, 120), subtitle, font=font(27), fill=MUTED)
    draw.line((80, 165, width - 80, 165), fill=(77, 94, 86, 255), width=2)


def make_measured_plan(plan: dict[str, Any], data: TerrainData, route: list[tuple[float, float]], analysis: dict[str, Any], output: Path) -> None:
    canvas = Image.new("RGBA", (3840, 2160), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, "FLOW FEST SIM · GATE 1 MEASURED EARTH PLAN", "North-up · one world unit = one metre · connector vertices are Austen-traced; other placements remain proposals", 3840)

    map_box = (80, 205, 2740, 1665)
    rounded_panel(draw, map_box)
    inset = 18
    inner = (map_box[0] + inset, map_box[1] + inset, map_box[2] - inset, map_box[3] - inset)
    inner = aspect_fit_world_box(plan["planView"], inner)
    project = draw_map_base(canvas, inner, plan, data, route, analysis, sightlines=False)
    draw = ImageDraw.Draw(canvas)

    threshold = plan["route"]["surfaceOccluderThresholdMeters"]
    draw.text((inner[0] + 24, inner[1] + 20), f"2023 NAIP + 2021 lidar surface ≥{threshold:.1f} m", font=font(25, semibold=True), fill=INK)
    draw.text((inner[0] + 24, inner[1] + 55), "Amber wash is a visibility layer. Registered paths can continue beneath canopy.", font=font(22), fill=MUTED)

    north_x, north_y = inner[2] - 95, inner[1] + 130
    draw_arrow(draw, (north_x, north_y + 75), (north_x, north_y), MEASURED, 7)
    draw.text((north_x - 16, north_y - 48), "N", font=font(34, semibold=True), fill=INK)

    scale_start = (inner[0] + 35, inner[3] - 55)
    scale_end = project(plan["planView"]["minX"] + 100, plan["planView"]["maxZ"])
    scale_length = abs(scale_end[0] - project(plan["planView"]["minX"], plan["planView"]["maxZ"])[0])
    draw.line((scale_start[0], scale_start[1], scale_start[0] + scale_length, scale_start[1]), fill=INK, width=8)
    draw.line((scale_start[0], scale_start[1] - 12, scale_start[0], scale_start[1] + 12), fill=INK, width=5)
    draw.line((scale_start[0] + scale_length, scale_start[1] - 12, scale_start[0] + scale_length, scale_start[1] + 12), fill=INK, width=5)
    draw.text((scale_start[0], scale_start[1] - 52), "100 m", font=font(25, semibold=True), fill=INK)
    figure_x = scale_start[0] + scale_length + 65
    figure_ground = scale_start[1]
    figure_height = max(8, round(scale_length / 100 * plan["player"]["eyeHeightMeters"]))
    draw.line((figure_x, figure_ground, figure_x, figure_ground - figure_height + 3), fill=MEASURED, width=3)
    draw.ellipse((figure_x - 3, figure_ground - figure_height - 3, figure_x + 3, figure_ground - figure_height + 3), fill=MEASURED)
    draw.line((figure_x - 4, figure_ground - figure_height // 2, figure_x + 4, figure_ground - figure_height // 2), fill=MEASURED, width=2)
    draw.text((figure_x + 14, figure_ground - 27), "1.70 m player", font=font(19, semibold=True), fill=INK)

    side = (2790, 205, 3760, 1665)
    rounded_panel(draw, side)
    draw.text((2840, 250), "Evidence classes", font=font(35, semibold=True), fill=INK)
    y = 315
    for label, color, copy in (
        ("MEASURED", MEASURED, "DTM, lidar surface, scale, and registration"),
        ("AUSTEN-TRACED", ROUTE, "route rules plus source-locked hidden connector drawings"),
        ("INTERPRETED", INTERPRETED, "imagery-traced roads and clearing extents"),
        ("AUTHORED", AUTHORED, "exact placements, interactions, and night state"),
    ):
        draw.ellipse((2840, y + 5, 2864, y + 29), fill=color)
        draw.text((2880, y), label, font=font(21, semibold=True), fill=color)
        draw.text((2880, y + 29), copy, font=font(18), fill=MUTED)
        y += 66

    draw.line((2840, y, 3710, y), fill=(77, 94, 86, 255), width=2)
    y += 28
    draw.text((2840, y), "Registered branch checks", font=font(31, semibold=True), fill=INK)
    y += 48
    metrics = analysis["routeMetrics"]
    journeys = {journey["id"]: journey for journey in analysis["alternativeJourneys"]}
    peak_person_grade = max(metrics["pedestrianMaximumTenMeterGrade"], *(journey["pedestrianMaximumTenMeterGrade"] for journey in journeys.values()))
    lower_connector = next(item for item in analysis["segmentMetrics"] if item["to"] == "middle-earth-arrival")
    upper_connector = journey_segment(journeys["upper-tent"], "upper-camp-to-middle-earth")
    facts = (
        ("Lower tent · vehicle / foot", f"{metrics['vehicleDistanceMeters']:.0f} / {metrics['pedestrianDistanceMeters']:.0f} m"),
        ("Upper tent · vehicle / foot", f"{journeys['upper-tent']['vehicleDistanceMeters']:.0f} / {journeys['upper-tent']['pedestrianDistanceMeters']:.0f} m"),
        ("Car camp · vehicle / foot", f"{journeys['car-camp']['vehicleDistanceMeters']:.0f} / {journeys['car-camp']['pedestrianDistanceMeters']:.0f} m"),
        ("Night returns · L / U / car", f"{metrics['optionalReturnDistanceMeters']:.0f} / {journeys['upper-tent']['returnDistanceMeters']:.0f} / {journeys['car-camp']['returnDistanceMeters']:.0f} m"),
        ("Peak foot / vehicle grade", f"{peak_person_grade * 100:.1f}% / {max(metrics['vehicleMaximumTenMeterGrade'], *(journey['vehicleMaximumTenMeterGrade'] for journey in journeys.values())) * 100:.1f}%"),
        ("≥2 m cover · upper / lower", f"{upper_connector['canopyCoverageFraction'] * 100:.1f}% / {lower_connector['canopyCoverageFraction'] * 100:.1f}%"),
        ("Visibility expectations", f"{sum(item['matchesExpectation'] for item in analysis['sightlines'])}/{len(analysis['sightlines'])} match"),
    )
    for label, value in facts:
        draw.text((2840, y), label, font=font(24), fill=MUTED)
        draw.text((3700, y), value, font=font(25, semibold=True), fill=INK, anchor="ra")
        y += 43

    y += 8
    draw.line((2840, y, 3710, y), fill=(77, 94, 86, 255), width=2)
    y += 22
    draw.text((2840, y), "Route legend", font=font(25, semibold=True), fill=INK)
    y += 36
    for color, copy in (
        (VEHICLE, "Lower-tent vehicle loop"),
        (ROUTE, "Lower-tent walk + return"),
        (UPPER_TENT, "Upper-tent branch"),
        (CAR_CAMP, "Lower car-camping branch"),
        (MEASURED, "Thin teal: optional route home"),
    ):
        draw.line((2842, y + 13, 2910, y + 13), fill=color, width=8)
        draw.text((2932, y), copy, font=font(19), fill=MUTED)
        y += 33
    draw.text((2932, y), "Broken branch strokes pass beneath canopy", font=font(18), fill=INTERPRETED)
    y += 34

    y += 4
    draw.text((2840, y), "Full measured footprint", font=font(31, semibold=True), fill=INK)
    y += 52
    inset_box = (2840, y, 3140, y + 300)
    full = ImageEnhance.Brightness(data.ortho.convert("RGB")).enhance(0.68).resize((300, 300), Image.Resampling.LANCZOS).convert("RGBA")
    canvas.alpha_composite(full, (inset_box[0], inset_box[1]))
    draw.rectangle(inset_box, outline=MEASURED, width=4)
    full_project = world_mapper(
        {"minX": data.min_x, "maxX": data.max_x, "minZ": data.min_z, "maxZ": data.max_z},
        inset_box,
    )
    crop_a = full_project(plan["planView"]["minX"], plan["planView"]["minZ"])
    crop_b = full_project(plan["planView"]["maxX"], plan["planView"]["maxZ"])
    draw.rectangle((crop_a[0], crop_a[1], crop_b[0], crop_b[1]), outline=AUTHORED, width=5)
    draw.text((3180, y + 75), "1,024 m square", font=font(25, semibold=True), fill=MEASURED)
    draw.text((3180, y + 125), "540 × 280 m", font=font(25, semibold=True), fill=AUTHORED)
    draw.text((3180, y + 166), "Gate 1 focus", font=font(21), fill=MUTED)

    footer = (80, 1715, 3760, 2075)
    rounded_panel(draw, footer, light=True)
    draw.text((125, 1760), "Approval bridge", font=font(34, semibold=True), fill=INK)
    approval = "Can you trace all three camp choices, explain which cars move to upper parking, identify both hidden connectors, and show how every branch reaches Middle Earth and returns to its selected camp? Austen has already confirmed that both tent branches return through the lower gate before parking."
    draw_wrapped(draw, (125, 1815), approval, font(31), INK, 2260, 10)
    draw.text((2570, 1760), "Boundary of truth", font=font(34, semibold=True), fill=INK)
    boundary = (
        "Terrain and visibility are measured. Route topology and the two orthophoto-drawn connector centerlines come from Austen. "
        f"The traced upper connector has {upper_connector['canopyCoverageFraction'] * 100:.1f}% surface coverage at least 2 m high and the traced lower connector {lower_connector['canopyCoverageFraction'] * 100:.1f}%. "
        "Physical width, surface condition, drainage, and accessibility remain field-unverified; lidar never acts as a walkability mask."
    )
    draw_wrapped(draw, (2570, 1815), boundary, font(27), MUTED, 1080, 8)

    canvas.convert("RGB").save(output, format="PNG", optimize=False)


def make_vertical_section(plan: dict[str, Any], data: TerrainData, route: list[tuple[float, float]], analysis: dict[str, Any], output: Path) -> None:
    canvas = Image.new("RGBA", (2560, 1440), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, "GATE 1 · LOWER-TENT ROUTE SECTION", "One complete branch · blue is vehicle travel, cream is on foot, amber is lidar surface · player eye = 1.70 m", 2560)
    chart = (150, 250, 2410, 995)
    rounded_panel(draw, chart)
    distances, elevations = cumulative_route(route, data)
    surface_tops = []
    for x, z in route:
        offset = surface_offset_meters(data, x, z) or 0
        surface_tops.append(sample_bilinear(data.height, data, x, z) + offset)
    surface_tops_array = np.asarray(surface_tops)
    y_min = math.floor(float(elevations.min()) - 2)
    y_max = math.ceil(max(float(surface_tops_array.max()), float(elevations.max()) + 4))

    def px(distance: float) -> int:
        return round(chart[0] + 80 + distance / distances[-1] * (chart[2] - chart[0] - 130))

    def py(elevation: float) -> int:
        return round(chart[3] - 70 - (elevation - y_min) / (y_max - y_min) * (chart[3] - chart[1] - 125))

    horizontal_pixels_per_meter = (chart[2] - chart[0] - 130) / float(distances[-1])
    vertical_pixels_per_meter = (chart[3] - chart[1] - 125) / float(y_max - y_min)
    vertical_exaggeration = vertical_pixels_per_meter / horizontal_pixels_per_meter

    for elevation in range(y_min, y_max + 1, 5):
        y = py(elevation)
        draw.line((chart[0] + 70, y, chart[2] - 40, y), fill=(67, 82, 75, 180), width=2)
        draw.text((chart[0] + 58, y), f"{elevation} m", font=font(21, mono=True), fill=MUTED, anchor="ra")
    for distance in range(0, int(distances[-1]) + 1, 100):
        x = px(distance)
        draw.line((x, chart[1] + 35, x, chart[3] - 65), fill=(55, 69, 63, 150), width=2)
        draw.text((x, chart[3] - 48), f"{distance} m", font=font(21, mono=True), fill=MUTED, anchor="ma")

    terrain_points = [(px(float(distance)), py(float(elevation))) for distance, elevation in zip(distances, elevations)]
    terrain_polygon = terrain_points + [(terrain_points[-1][0], chart[3] - 68), (terrain_points[0][0], chart[3] - 68)]
    draw.polygon(terrain_polygon, fill=(81, 89, 66, 255))
    draw.line(terrain_points, fill=MEASURED, width=6)
    eye_points = [(px(float(distance)), py(float(elevation + plan["player"]["eyeHeightMeters"]))) for distance, elevation in zip(distances, elevations)]
    vehicle_end = analysis["routeMetrics"]["vehicleEndRoutePointIndex"]
    draw.line(eye_points[: vehicle_end + 1], fill=VEHICLE, width=5)
    draw.line(eye_points[vehicle_end:], fill=ROUTE, width=5)
    surface_points = [(px(float(distance)), py(float(elevation))) for distance, elevation in zip(distances, surface_tops_array)]
    draw.line(surface_points, fill=INTERPRETED, width=3)

    true_box = (850, 845, 1560, 950)
    draw.rounded_rectangle(true_box, radius=16, fill=(11, 18, 16, 230), outline=(75, 91, 83, 255), width=2)
    draw.text((true_box[0] + 18, true_box[1] + 12), f"1:1 relief inset · main profile {vertical_exaggeration:.1f}× vertical", font=font(18, semibold=True), fill=INK)
    true_scale = (true_box[2] - true_box[0] - 36) / float(distances[-1])
    true_baseline = true_box[3] - 22
    true_points = [
        (
            round(true_box[0] + 18 + float(distance) * true_scale),
            round(true_baseline - (float(elevation) - float(elevations.min())) * true_scale),
        )
        for distance, elevation in zip(distances, elevations)
    ]
    draw.line(true_points, fill=MEASURED, width=3)

    indices = stop_route_indices(route, plan)
    grouped_stops: dict[int, list[dict[str, Any]]] = {}
    for stop, index in zip(plan["route"]["stops"], indices):
        grouped_stops.setdefault(index, []).append(stop)
    label_rows = {1: 0, 2: 1, 3: 2, 4: 0, 5: 2, 6: 0, 7: 1, 8: 2}
    for index, stops in grouped_stops.items():
        x = px(float(distances[index]))
        y = py(float(elevations[index] + plan["player"]["eyeHeightMeters"]))
        draw.line((x, y - 80, x, chart[3] - 70), fill=(*AUTHORED[:3], 150), width=3)
        marker_radius = 25 if len(stops) > 1 else 21
        draw.ellipse((x - marker_radius, y - marker_radius, x + marker_radius, y + marker_radius), fill=AUTHORED, outline=INK, width=3)
        marker = "/".join(str(stop["number"]) for stop in stops)
        draw.text((x, y - 3), marker, font=font(19 if len(stops) > 1 else 23, semibold=True), fill=BACKGROUND, anchor="mm")
        label = " → ".join(stop["label"] for stop in stops)
        label_y = chart[1] + 43 + label_rows[stops[0]["number"]] * 34
        draw.text((x, label_y), label, font=font(18, semibold=True), fill=INK, anchor="ma")

    draw.text((175, 1045), "What the section proves", font=font(34, semibold=True), fill=INK)
    metrics = analysis["routeMetrics"]
    journeys = {journey["id"]: journey for journey in analysis["alternativeJourneys"]}
    statements = (
        f"Lower tent: {metrics['vehicleDistanceMeters']:.0f} m by vehicle, then {metrics['pedestrianDistanceMeters']:.0f} m or {metrics['nominalWalkingMinutes']:.1f} minutes on foot before the optional route home.",
        f"Upper tent: {journeys['upper-tent']['vehicleDistanceMeters']:.0f} m by vehicle and {journeys['upper-tent']['pedestrianDistanceMeters']:.0f} m on foot. Car camp: {journeys['car-camp']['vehicleDistanceMeters']:.0f} m by vehicle and {journeys['car-camp']['pedestrianDistanceMeters']:.0f} m on foot.",
        f"The lower-tent example accumulates {metrics['cumulativeAscentMeters']:.1f} m of climb and {metrics['cumulativeDescentMeters']:.1f} m of descent; {metrics['repeatedLowerConnectorDistanceMeters']:.0f} m is deliberately retraced after the parking walk.",
        f"The steepest registered pedestrian branch is {max(metrics['pedestrianMaximumTenMeterGrade'], *(journey['pedestrianMaximumTenMeterGrade'] for journey in journeys.values())) * 100:.1f}% over a ten-metre DTM window, below the {plan['route']['maximumTenMeterGrade'] * 100:.0f}% gameplay cap.",
        "A route line passing below the amber lidar surface means tree canopy hides the ground. It does not mean the remembered path is blocked. Width and accessibility still require field evidence.",
    )
    y = 1100
    for statement in statements:
        draw.ellipse((180, y + 10, 196, y + 26), fill=MEASURED)
        y = draw_wrapped(draw, (220, y), statement, font(27), MUTED, 2100, 8) + 14

    canvas.convert("RGB").save(output, format="PNG", optimize=False)


def stop_thumbnail(data: TerrainData, stop: dict[str, Any], size: tuple[int, int]) -> Image.Image:
    center = stop["position"]
    half_x = 52
    half_z = half_x * size[1] / size[0]
    bounds = {
        "minX": center["x"] - half_x,
        "maxX": center["x"] + half_x,
        "minZ": center["z"] - half_z,
        "maxZ": center["z"] + half_z,
    }
    image = ortho_crop(data, bounds, size)
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    center_px = (size[0] // 2, size[1] // 2)
    draw.ellipse((center_px[0] - 22, center_px[1] - 22, center_px[0] + 22, center_px[1] + 22), fill=AUTHORED, outline=INK, width=3)
    draw.text(center_px, str(stop["number"]), font=font(24, semibold=True), fill=BACKGROUND, anchor="mm")
    image.alpha_composite(overlay)
    return image


def make_route_storyboard(plan: dict[str, Any], data: TerrainData, output: Path) -> None:
    canvas = Image.new("RGBA", (3840, 2160), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, "GATE 1 · FIRST-ARRIVAL BRANCH LOGIC", "One frame per event · Austen-observed ritual, terrain-registered positions, authored presentation", 3840)
    positions = [
        (80, 220, 940, 970),
        (1020, 220, 1880, 970),
        (1960, 220, 2820, 970),
        (2900, 220, 3760, 970),
        (2900, 1050, 3760, 2030),
        (1960, 1050, 2820, 2030),
        (1020, 1050, 1880, 2030),
        (80, 1050, 940, 2030),
    ]
    route_numbers = {stop["id"]: stop["number"] for stop in plan["route"]["stops"]}
    for stop, box in zip(plan["storyFrames"], positions):
        rounded_panel(draw, box, light=stop["number"] == "H")
        thumb_box = (box[0] + 25, box[1] + 25, box[2] - 25, box[1] + 285)
        thumbnail = stop_thumbnail(data, stop, (thumb_box[2] - thumb_box[0], thumb_box[3] - thumb_box[1]))
        canvas.alpha_composite(thumbnail, (thumb_box[0], thumb_box[1]))
        draw.text((box[0] + 35, box[1] + 315), f"{stop['number']}  {stop['label']}", font=font(31, semibold=True), fill=INK)
        cross_reference = "/".join(str(route_numbers[item]) for item in stop["routeStopIds"])
        plan_reference = f"PLAN {cross_reference}" if cross_reference else stop["planReference"]
        draw.text((box[2] - 35, box[1] + 321), plan_reference, font=font(18, semibold=True), fill=MEASURED, anchor="ra")
        y = box[1] + 370
        for label, copy, color in (
            ("DO", stop["action"], AUTHORED),
            ("SEE", stop["firstFocus"], MEASURED),
            ("UNDERSTAND", stop["understanding"], INTERPRETED),
            ("NEXT", stop["nextCue"], ROUTE),
        ):
            draw.text((box[0] + 35, y), label, font=font(19, semibold=True), fill=color)
            y = draw_wrapped(draw, (box[0] + 35, y + 30), copy, font(23), MUTED, box[2] - box[0] - 70, 6) + 18

    for start, end in zip(positions, positions[1:4]):
        draw_arrow(draw, (start[2] + 12, (start[1] + start[3]) // 2), (end[0] - 12, (end[1] + end[3]) // 2), AUTHORED, 5)
    draw_arrow(draw, ((positions[3][0] + positions[3][2]) // 2, positions[3][3] + 8), ((positions[4][0] + positions[4][2]) // 2, positions[4][1] - 8), AUTHORED, 5)
    for start, end in zip(positions[4:], positions[5:]):
        draw_arrow(draw, (start[0] - 12, (start[1] + start[3]) // 2), (end[2] + 12, (end[1] + end[3]) // 2), AUTHORED, 5)

    canvas.convert("RGB").save(output, format="PNG", optimize=False)


def make_sightline_study(plan: dict[str, Any], data: TerrainData, route: list[tuple[float, float]], analysis: dict[str, Any], output: Path) -> None:
    canvas = Image.new("RGBA", (2560, 1600), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, "GATE 1 · CANOPY + SIGHTLINE STUDY", "Measured terrain + lidar tops test visibility only · Austen-observed paths can continue under an occluding tree line", 2560)
    map_box = (90, 220, 1560, 1100)
    rounded_panel(draw, map_box)
    inner = (map_box[0] + 16, map_box[1] + 16, map_box[2] - 16, map_box[3] - 16)
    inner = aspect_fit_world_box(plan["planView"], inner)
    project = draw_map_base(canvas, inner, plan, data, route, analysis, sightlines=True)
    draw = ImageDraw.Draw(canvas)
    scale_origin = (inner[0] + 24, inner[3] - 28)
    scale_end_x = project(plan["planView"]["minX"] + 50, plan["planView"]["maxZ"])[0]
    scale_length = abs(scale_end_x - project(plan["planView"]["minX"], plan["planView"]["maxZ"])[0])
    draw.line((scale_origin[0], scale_origin[1], scale_origin[0] + scale_length, scale_origin[1]), fill=INK, width=6)
    draw.line((scale_origin[0], scale_origin[1] - 8, scale_origin[0], scale_origin[1] + 8), fill=INK, width=3)
    draw.line((scale_origin[0] + scale_length, scale_origin[1] - 8, scale_origin[0] + scale_length, scale_origin[1] + 8), fill=INK, width=3)
    draw.text((scale_origin[0], scale_origin[1] - 36), "50 m", font=font(19, semibold=True), fill=INK)
    figure_x = scale_origin[0] + scale_length + 36
    figure_ground = scale_origin[1]
    figure_height = max(8, round(scale_length / 50 * plan["player"]["eyeHeightMeters"]))
    draw.line((figure_x, figure_ground, figure_x, figure_ground - figure_height + 3), fill=MEASURED, width=3)
    draw.ellipse((figure_x - 3, figure_ground - figure_height - 3, figure_x + 3, figure_ground - figure_height + 3), fill=MEASURED)
    draw.text((figure_x + 12, figure_ground - 25), "1.70 m", font=font(17, semibold=True), fill=INK)
    north_x, north_y = inner[2] - 55, inner[1] + 70
    draw_arrow(draw, (north_x, north_y + 58), (north_x, north_y), MEASURED, 6)
    draw.text((north_x - 11, north_y - 38), "N", font=font(28, semibold=True), fill=INK)

    summary_box = (1600, 220, 2470, 1100)
    rounded_panel(draw, summary_box)
    draw.text((1645, 265), "All tested relationships", font=font(35, semibold=True), fill=INK)
    results = {item["id"]: item for item in analysis["sightlines"]}
    y = 330
    class_labels = {
        "clear": "CLEAR",
        "surface-only occlusion": "SURFACE ONLY",
        "marginal terrain + surface occlusion": "MARGINAL TERRAIN+SURFACE",
        "terrain + surface occlusion": "TERRAIN+SURFACE",
    }
    for item in plan["sightlines"]:
        result = results[item["id"]]
        color = PASS if result["actual"] == "clear" else BLOCKED
        draw.ellipse((1645, y + 5, 1669, y + 29), fill=color)
        draw.text((1686, y), item["label"], font=font(22, semibold=True), fill=INK)
        y += 31
        copy = f"{class_labels[result['occlusionClass']]} · {result['distanceMeters']:.0f} m · DTM {result['dtmOnlyMinimumClearanceMeters']:.2f} · top {result['minimumClearanceMeters']:.2f} m"
        if result["neighborhood"]:
            neighborhood = result["neighborhood"]
            copy += f" · {neighborhood['clearSamples']}/{neighborhood['samples']} cameras"
        draw.text((1686, y), copy, font=font(16, mono=True), fill=color)
        y += 43

    draw.line((1645, y + 2, 2425, y + 2), fill=(77, 94, 86, 255), width=2)
    y += 24
    draw.text((1645, y), "Interpretation boundary", font=font(25, semibold=True), fill=INK)
    y += 39
    y = draw_wrapped(
        draw,
        (1645, y),
        "Occlusion says what a standing player can see, not where they can walk. The final ray targets a 1.70 m ground point; the fictional mast is irrelevant to this pass.",
        font(21),
        MUTED,
        760,
        6,
    )
    connector_metrics = {
        "upper": journey_segment(next(item for item in analysis["alternativeJourneys"] if item["id"] == "upper-tent"), "upper-camp-to-middle-earth"),
        "lower": next(item for item in analysis["segmentMetrics"] if item["to"] == "middle-earth-arrival"),
        "car": journey_segment(next(item for item in analysis["alternativeJourneys"] if item["id"] == "car-camp"), "car-camp-to-middle-earth"),
    }
    coverage = " · ".join(f"{name} {metrics['canopyCoverageFraction'] * 100:.1f}%" for name, metrics in connector_metrics.items())
    draw.text((1645, y + 10), f"≥2 m surface coverage: {coverage}", font=font(17, mono=True), fill=INTERPRETED)

    chart_top = 1140
    chart_height = 380
    chart_width = 760
    detail_ids = ("upper-camp-to-middle", "lower-camp-to-middle", "night-composition")
    detailed = [item for item in plan["sightlines"] if item["id"] in detail_ids]
    detailed.sort(key=lambda item: detail_ids.index(item["id"]))
    for chart_index, item in enumerate(detailed):
        result = results[item["id"]]
        left = 90 + chart_index * 815
        box = (left, chart_top, left + chart_width, chart_top + chart_height)
        rounded_panel(draw, box, light=item["id"] == "night-composition")
        profile = result["profile"]
        distances = np.asarray([sample["distanceMeters"] for sample in profile])
        terrain = np.asarray([sample["terrainElevationMeters"] for sample in profile])
        surface = np.asarray([sample["surfaceTopElevationMeters"] for sample in profile])
        ray = np.asarray([sample["rayElevationMeters"] for sample in profile])
        y_min = math.floor(float(min(terrain.min(), ray.min())) - 1)
        y_max = math.ceil(float(max(surface.max(), ray.max())) + 1)

        def x_px(value: float) -> int:
            return round(box[0] + 42 + value / distances[-1] * (box[2] - box[0] - 74))

        def y_px(value: float) -> int:
            return round(box[3] - 48 - (value - y_min) / (y_max - y_min) * (box[3] - box[1] - 105))

        draw.text((box[0] + 28, box[1] + 18), item["label"], font=font(24, semibold=True), fill=INK)
        terrain_points = [(x_px(float(distance)), y_px(float(value))) for distance, value in zip(distances, terrain)]
        draw.line(terrain_points, fill=MEASURED, width=4)
        surface_points = [(x_px(float(distance)), y_px(float(value))) for distance, value in zip(distances, surface)]
        draw.line(surface_points, fill=INTERPRETED, width=3)
        ray_points = [(x_px(float(distance)), y_px(float(value))) for distance, value in zip(distances, ray)]
        draw.line(ray_points, fill=PASS if result["actual"] == "clear" else BLOCKED, width=5)
        draw.text((box[0] + 28, box[3] - 34), f"0 → {result['distanceMeters']:.0f} m", font=font(20, mono=True), fill=MUTED)
        draw.text((box[2] - 28, box[3] - 34), class_labels[result["occlusionClass"]], font=font(19, semibold=True), fill=PASS if result["actual"] == "clear" else BLOCKED, anchor="ra")

    canvas.convert("RGB").save(output, format="PNG", optimize=False)


def make_review_board(outputs: dict[str, Path], output: Path) -> None:
    canvas = Image.new("RGBA", (3840, 2160), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw_header(draw, "FLOW FEST SIM · REVISED GATE 1 REVIEW BOARD", "Index sheet only · open each source panel at full size for spatial review", 3840)
    panels = (
        ("gate1-measured-plan.png", (70, 210, 1900, 1175), "A · WHERE"),
        ("gate1-vertical-section.png", (1940, 210, 3770, 1175), "B · HOW IT FEELS"),
        ("gate1-route-storyboard.png", (70, 1240, 1900, 2070), "C · WHAT HAPPENS"),
        ("gate1-sightline-study.png", (1940, 1240, 3770, 2070), "D · WHAT IS REVEALED"),
    )
    for name, box, label in panels:
        rounded_panel(draw, box)
        image = Image.open(outputs[name]).convert("RGB")
        available_width = box[2] - box[0] - 30
        available_height = box[3] - box[1] - 80
        ratio = min(available_width / image.width, available_height / image.height)
        resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS).convert("RGBA")
        x = box[0] + (box[2] - box[0] - resized.width) // 2
        y = box[1] + 56 + (available_height - resized.height) // 2
        canvas.alpha_composite(resized, (x, y))
        draw.text((box[0] + 25, box[1] + 17), label, font=font(24, semibold=True), fill=MEASURED)
    canvas.convert("RGB").save(output, format="PNG", optimize=False)


def exact_color_pixel_count(path: Path, color: tuple[int, int, int, int]) -> int:
    pixels = np.asarray(Image.open(path).convert("RGB"))
    target = np.asarray(color[:3], dtype=np.uint8)
    return int(np.all(pixels == target, axis=2).sum())


def build(output_directory: Path) -> dict[str, Any]:
    output_directory.mkdir(parents=True, exist_ok=True)
    plan = load_json(PLAN_PATH)
    data = load_terrain(plan)
    route, vehicle_end_index, return_routes = build_route(plan, data)
    analysis = analyze(plan, data, route, vehicle_end_index, return_routes)

    paths = {name: output_directory / name for name in OUTPUT_NAMES}
    make_measured_plan(plan, data, route, analysis, paths["gate1-measured-plan.png"])
    make_vertical_section(plan, data, route, analysis, paths["gate1-vertical-section.png"])
    make_route_storyboard(plan, data, paths["gate1-route-storyboard.png"])
    make_sightline_study(plan, data, route, analysis, paths["gate1-sightline-study.png"])
    make_review_board(paths, paths["gate1-review-board.png"])

    visibility_thresholds = {
        "lower-tent-vehicle": {"color": VEHICLE, "plan": 5000, "sightline": 2000},
        "lower-tent-person": {"color": ROUTE, "plan": 3000, "sightline": 1000},
        "upper-tent": {"color": UPPER_TENT, "plan": 2000, "sightline": 700},
        "car-camp": {"color": CAR_CAMP, "plan": 1000, "sightline": 500},
    }
    route_visibility = {
        journey_id: {
            "measuredPlanExactColorPixels": exact_color_pixel_count(paths["gate1-measured-plan.png"], color),
            "sightlineStudyExactColorPixels": exact_color_pixel_count(paths["gate1-sightline-study.png"], color),
            "minimumMeasuredPlanExactColorPixels": thresholds["plan"],
            "minimumSightlineStudyExactColorPixels": thresholds["sightline"],
        }
        for journey_id, thresholds in visibility_thresholds.items()
        for color in (thresholds["color"],)
    }
    routes_visible = all(
        item["measuredPlanExactColorPixels"] > item["minimumMeasuredPlanExactColorPixels"]
        and item["sightlineStudyExactColorPixels"] > item["minimumSightlineStudyExactColorPixels"]
        for item in route_visibility.values()
    )
    analysis["routeVisibility"] = route_visibility
    analysis["checks"]["route-visibility"] = {
        "status": "passed" if routes_visible else "failed",
        "evidence": "; ".join(
            f"{journey_id} {item['measuredPlanExactColorPixels']} plan / {item['sightlineStudyExactColorPixels']} sightline exact-color pixels"
            for journey_id, item in route_visibility.items()
        ),
    }

    evidence = {
        name: {
            "path": str((OUTPUT_DIRECTORY / name).relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256(paths[name]),
        }
        for name in OUTPUT_NAMES
        if name.endswith(".png")
    }
    report = {
        "schemaVersion": 2,
        "sceneId": plan["sceneId"],
        "status": "PASS" if all(item["status"] == "passed" for item in analysis["checks"].values()) else "FAIL",
        "sourceAuthority": {
            "planPath": str(PLAN_PATH.relative_to(ROOT)).replace("\\", "/"),
            "planSha256": sha256(PLAN_PATH),
            **plan["sourceAuthority"],
        },
        "toolchain": toolchain_fingerprint(),
        **analysis,
        "evidence": evidence,
        "uncertainties": plan["knownUnknowns"],
    }
    paths["gate1-validation.json"].write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def verify() -> None:
    missing = [name for name in OUTPUT_NAMES if not (OUTPUT_DIRECTORY / name).exists()]
    if missing:
        raise ValueError(f"missing Gate 1 output(s): {', '.join(missing)}")
    frozen_report = load_json(OUTPUT_DIRECTORY / "gate1-validation.json")
    with tempfile.TemporaryDirectory(prefix="flow-fest-gate1-") as temporary:
        temporary_directory = Path(temporary)
        fresh_report = build(temporary_directory)
        frozen_semantic = {key: value for key, value in frozen_report.items() if key not in {"evidence", "toolchain"}}
        fresh_semantic = {key: value for key, value in fresh_report.items() if key not in {"evidence", "toolchain"}}
        if frozen_semantic != fresh_semantic:
            raise ValueError("Gate 1 semantic analysis differs from the checked report")

        same_toolchain = frozen_report.get("toolchain") == fresh_report.get("toolchain")
        image_mismatches = []
        if same_toolchain:
            image_mismatches = [
                name
                for name in OUTPUT_NAMES
                if name.endswith(".png") and (temporary_directory / name).read_bytes() != (OUTPUT_DIRECTORY / name).read_bytes()
            ]
        if image_mismatches:
            raise ValueError(f"Gate 1 image outputs are stale or non-deterministic on the recorded toolchain: {', '.join(image_mismatches)}")

    evidence_mismatches = []
    for name, item in frozen_report["evidence"].items():
        if sha256(OUTPUT_DIRECTORY / name) != item["sha256"]:
            evidence_mismatches.append(name)
    if evidence_mismatches:
        raise ValueError(f"Gate 1 checked image digests differ from the frozen report: {', '.join(evidence_mismatches)}")
    if fresh_report["status"] != "PASS":
        failed = [name for name, item in fresh_report["checks"].items() if item["status"] != "passed"]
        raise ValueError(f"Gate 1 check(s) failed: {', '.join(failed)}")
    print("PASS: Gate 1 source digests match")
    print("PASS: semantic analysis matches the checked report")
    if same_toolchain:
        print("PASS: recorded toolchain matches and deterministic image bytes match")
    else:
        print("INFO: toolchain differs; semantic analysis matched and frozen image digests were verified")
    for name, item in fresh_report["checks"].items():
        print(f"PASS: {name}: {item['evidence']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "verify"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "build":
        report = build(OUTPUT_DIRECTORY)
        print(f"{report['status']}: wrote Gate 1 evidence to {OUTPUT_DIRECTORY}")
        if report["status"] != "PASS":
            raise SystemExit(1)
    else:
        verify()


if __name__ == "__main__":
    main()
