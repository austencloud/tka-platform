"""Build and verify Ember's performer-centred Breached Rift Bench Gate 2 R3 graybox.

The Gate 1.1 geology amendment review candidate remains the terrain authority. This
script derives one checkout-stable coordinate manifest from it, makes the
checked-in Flowy thickness raster the visible lava-deposit owner, builds an
editable graybox and review-equivalent GLB, renders the complete runtime orbit
plus director, north-up plan, section, and orbit-strip evidence, and verifies
the resulting artifacts.

Typical use from the repository root:

    py -3 scripts/build-ember-geology-graybox.py build
    py -3 scripts/build-ember-geology-graybox.py verify

The graybox is intentionally isolated from EmberScene.svelte and the existing
production asset. It does not author final materials or spend Meshy credits.
"""

from __future__ import annotations

import argparse
from array import array
import hashlib
import heapq
import importlib.util
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
from typing import Any, Sequence


ROOT = Path(__file__).resolve().parents[1]
STUDY_PATH = ROOT / "scripts/build-ember-geology-study.py"
RESEARCH_PATH = ROOT / "docs/superpowers/specs/ember-spatial-directions/geology-lava-composition-research.md"
GATE1_REPORT_PATH = ROOT / (
    "docs/superpowers/specs/ember-spatial-directions/evidence/"
    "gate-1-1-geology-amendment-r3/ember-breached-rift-bench-gate1-1-report.json"
)
GATE_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions/evidence/gate-2-geology-graybox-r3"
MANIFEST_PATH = GATE_DIR / "ember-breached-rift-bench-r3-coordinate-manifest.json"
REPORT_PATH = GATE_DIR / "ember-breached-rift-bench-r3-graybox-report.json"
CONTACT_SHEET_PATH = GATE_DIR / "ember-breached-rift-bench-r3-gate2-contact-sheet.png"
ORBIT_STRIP_PATH = GATE_DIR / "11-sampled-runtime-orbit-board.png"
ORBIT_VIDEO_PATH = GATE_DIR / "14-continuous-runtime-orbit.webp"
TERRAIN_DATA_PATH = ROOT / "static/data/ember/review/ember-breached-rift-bench-r3-height.f32"
SIMULATOR_THICKNESS_PATH = ROOT / "static/data/ember/review/ember-breached-rift-bench-r3-flowy-thickness.f32"
BLEND_PATH = ROOT / "blender/ember-breached-rift-bench-graybox-r3.blend"
GLB_PATH = ROOT / "static/models/ember/review/ember-breached-rift-bench-graybox-r3.glb"
CACHE_DIR = ROOT / ".cache/ember/gate2-r3"
BLENDER_SNAPSHOT_PATH = CACHE_DIR / "blender-verification.json"
BLENDER_EXE = Path("C:/Program Files/Blender Foundation/Blender 5.0/blender.exe")

TERRAIN_STRIDE = 1
REVIEW_WIDTH = 1600
REVIEW_HEIGHT = 900
ACTIVE_THICKNESS_M = 0.01
REVIEW_IMAGE_NAMES = (
    "00-default-audience.png",
    "01-orbit-000.png",
    "02-orbit-045.png",
    "03-orbit-090.png",
    "04-orbit-135.png",
    "05-orbit-180.png",
    "06-orbit-225.png",
    "07-orbit-270.png",
    "08-orbit-315.png",
    "09-north-up-plan.png",
    "10-longitudinal-section.png",
    "12-director-overview.png",
    "13-collapse-oblique.png",
)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_digest(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    path.write_bytes(payload.encode("utf-8"))


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_geology_study() -> Any:
    spec = importlib.util.spec_from_file_location("ember_geology_study_gate2", STUDY_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load Gate 1 terrain owner: {STUDY_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def read_numpy_grid(path: Path, rows: int, columns: int) -> Any:
    import numpy as np

    if not path.exists():
        raise FileNotFoundError(path)
    values = np.fromfile(path, dtype="<f4")
    expected = rows * columns
    if values.size != expected:
        raise ValueError(f"Float grid sample count {values.size} != {expected}: {path}")
    return values.reshape((rows, columns))


def polyline_metrics(path: Sequence[Sequence[float]]) -> tuple[list[float], float]:
    cumulative = [0.0]
    for start, end in zip(path, path[1:]):
        cumulative.append(cumulative[-1] + math.hypot(end[0] - start[0], end[1] - start[1]))
    return cumulative, cumulative[-1]


def nearest_path_sample(
    x: float,
    z: float,
    path: Sequence[Sequence[float]],
    widths: Sequence[float],
) -> tuple[float, float, float]:
    cumulative, total = polyline_metrics(path)
    best_distance = math.inf
    best_progress = 0.0
    best_width = float(widths[0])
    for index, (start, end) in enumerate(zip(path, path[1:])):
        ax, az = float(start[0]), float(start[1])
        bx, bz = float(end[0]), float(end[1])
        vx, vz = bx - ax, bz - az
        length_sq = vx * vx + vz * vz
        t = 0.0 if length_sq <= 1e-12 else max(0.0, min(1.0, ((x - ax) * vx + (z - az) * vz) / length_sq))
        px, pz = ax + vx * t, az + vz * t
        distance = math.hypot(x - px, z - pz)
        if distance < best_distance:
            segment_length = math.sqrt(length_sq)
            best_distance = distance
            best_progress = (cumulative[index] + segment_length * t) / total
            best_width = float(widths[index]) * (1.0 - t) + float(widths[index + 1]) * t
    return best_distance, best_progress, best_width


def build_manifest() -> dict[str, Any]:
    import numpy as np

    study = load_geology_study()
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    gate1_report = load_json(GATE1_REPORT_PATH)
    height = study.candidate_height(candidate, revision="r3").astype("<f4")
    rows, columns = height.shape
    simulator = read_numpy_grid(SIMULATOR_THICKNESS_PATH, rows, columns)
    active = simulator > ACTIVE_THICKNESS_M

    TERRAIN_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    TERRAIN_DATA_PATH.write_bytes(height.tobytes(order="C"))

    active_rows, active_columns = np.nonzero(active)
    active_x = study.WORLD_X[0] + active_columns.astype(float)
    active_z = study.WORLD_Z[0] + active_rows.astype(float)
    active_distances = np.hypot(active_x, active_z)
    cell_half_extent = 0.5
    active_support_distances = np.hypot(
        np.maximum(np.abs(active_x) - cell_half_extent, 0.0),
        np.maximum(np.abs(active_z) - cell_half_extent, 0.0),
    )
    source = study.R3_BREACHED_RIFT_SOURCE
    source_y = study.sample_height(height, *source)
    r3_path = study.R3_BREACHED_RIFT_FLOW_PATH
    terminus_y = study.sample_height(height, *r3_path[-1])
    cumulative, path_length = polyline_metrics(r3_path)
    upstream_widths = active[(study.Z_VALUES >= -30.0) & (study.Z_VALUES <= -5.0)].sum(axis=1)
    upstream_widths = upstream_widths[upstream_widths > 0]
    downstream_widths = active[study.Z_VALUES <= -80.0].sum(axis=1)
    downstream_widths = downstream_widths[downstream_widths > 0]
    upstream_median_width = float(np.median(upstream_widths)) if upstream_widths.size else 0.0
    downstream_median_width = float(np.median(downstream_widths)) if downstream_widths.size else 0.0
    branched_rows = 0
    for row in active:
        occupied = np.flatnonzero(row)
        if occupied.size > 1 and np.any(np.diff(occupied) >= 3):
            branched_rows += 1

    source_row = int(round(source[1] - study.WORLD_Z[0]))
    source_column = int(round(source[0] - study.WORLD_X[0]))
    start_row, start_column = source_row, source_column
    if not active[start_row, start_column]:
        raise RuntimeError("Selected Flowy footprint is not active at the registered fissure source")
    basin_x, basin_z = (float(value) for value in study.R3_TERMINAL_BASIN_CENTER)
    goal_row = int(round(basin_z - study.WORLD_Z[0]))
    goal_column = int(round(basin_x - study.WORLD_X[0]))
    if not active[goal_row, goal_column]:
        raise RuntimeError("Selected Flowy footprint is not active at the registered terminal-basin centre")

    queue: list[tuple[float, int, int]] = [(0.0, start_row, start_column)]
    costs: dict[tuple[int, int], float] = {(start_row, start_column): 0.0}
    parents: dict[tuple[int, int], tuple[int, int] | None] = {(start_row, start_column): None}
    goal: tuple[int, int] | None = None
    neighbours = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))
    while queue:
        cost, row, column = heapq.heappop(queue)
        cell = (row, column)
        if cost > costs.get(cell, math.inf):
            continue
        if cell == (goal_row, goal_column):
            goal = cell
            break
        for dr, dc in neighbours:
            neighbour = (cell[0] + dr, cell[1] + dc)
            if (
                0 <= neighbour[0] < rows
                and 0 <= neighbour[1] < columns
                and active[neighbour]
            ):
                current_y = float(height[cell])
                neighbour_y = float(height[neighbour])
                local_rise = max(0.0, neighbour_y - current_y)
                step_cost = math.hypot(dr, dc) + local_rise * local_rise * 45.0
                candidate_cost = cost + step_cost
                if candidate_cost < costs.get(neighbour, math.inf):
                    costs[neighbour] = candidate_cost
                    parents[neighbour] = cell
                    heapq.heappush(queue, (candidate_cost, neighbour[0], neighbour[1]))
    if goal is None:
        raise RuntimeError("Selected Flowy footprint has no connected source-to-inboard-basin path")
    traced_cells: list[tuple[int, int]] = []
    cursor: tuple[int, int] | None = goal
    while cursor is not None:
        traced_cells.append(cursor)
        cursor = parents[cursor]
    traced_cells.reverse()
    deposit_section = [
        [float(study.WORLD_X[0] + column), float(study.WORLD_Z[0] + row)]
        for row, column in traced_cells
    ]
    section_elevations = np.asarray(
        [study.sample_height(height, point[0], point[1]) for point in deposit_section],
        dtype=float,
    )
    _, deposit_trace_length = polyline_metrics(deposit_section)
    section_rises = np.diff(section_elevations)
    downhill_fraction = float(np.mean(section_rises <= 0.05)) if section_rises.size else 0.0
    maximum_local_rise = float(section_rises.max()) if section_rises.size else 0.0
    trace_source_y = float(section_elevations[0])
    trace_terminus_y = float(section_elevations[-1])

    performer_ground = float(study.sample_height(height, 0.0, 0.0))
    target_y = performer_ground + float(study.CAMERA_TARGET_HEIGHT_M)
    camera_y = performer_ground + float(study.CAMERA_HEIGHT_M)
    vertical_delta = camera_y - target_y
    runtime_horizontal_radius = math.sqrt(float(study.ORBIT_RADIUS_M) ** 2 - vertical_delta**2)

    cameras: list[dict[str, Any]] = [
        {
            "id": "default-audience",
            "positionWorldXYZ": [0.0, round(camera_y, 6), -21.5],
            "targetWorldXYZ": [0.0, round(target_y, 6), 0.0],
            "verticalFovDegrees": 50.0,
            "runtimeEquivalent": True,
            "reviewImage": REVIEW_IMAGE_NAMES[0],
        }
    ]
    for index, bearing in enumerate(range(0, 360, 45), start=1):
        angle = math.radians(bearing)
        cameras.append(
            {
                "id": f"orbit-{bearing:03d}",
                "bearingDegreesClockwiseFromAudience": bearing,
                "positionWorldXYZ": [
                    round(math.sin(angle) * runtime_horizontal_radius, 6),
                    round(camera_y, 6),
                    round(-math.cos(angle) * runtime_horizontal_radius, 6),
                ],
                "targetWorldXYZ": [0.0, round(target_y, 6), 0.0],
                "verticalFovDegrees": 50.0,
                "runtimeEquivalent": True,
                "reviewImage": REVIEW_IMAGE_NAMES[index],
            }
        )

    cameras.extend(
        (
            {
                "id": "director-overview",
                "positionWorldXYZ": [95.0, 115.0, -43.0],
                "targetWorldXYZ": [0.0, 0.0, -45.0],
                "verticalFovDegrees": 48.0,
                "runtimeEquivalent": False,
                "reviewImage": REVIEW_IMAGE_NAMES[11],
                "reviewRole": "bird-eye-whole-scene",
            },
            {
                "id": "collapse-oblique",
                "positionWorldXYZ": [13.0, 24.0, 30.0],
                "targetWorldXYZ": [-25.0, 7.0, 25.0],
                "verticalFovDegrees": 50.0,
                "runtimeEquivalent": False,
                "reviewImage": REVIEW_IMAGE_NAMES[12],
                "reviewRole": "collapse-anatomy",
            },
        )
    )

    contract: dict[str, Any] = {
        "schemaVersion": 1,
        "sceneId": "ember-broken-rift",
        "directionId": candidate.id,
        "revisionId": "gate2-r3",
        "gateId": "playable-graybox",
        "status": "candidate-pending-gate-1-1-approval",
        "sourceAuthority": {
            "selectedDirection": candidate.id,
            "terrainOwner": rel(STUDY_PATH),
            "terrainRevision": "r3",
            "gate1AmendmentReport": rel(GATE1_REPORT_PATH),
            "researchContract": rel(RESEARCH_PATH),
            "simulatorDepositSource": rel(SIMULATOR_THICKNESS_PATH),
            "simulatorImplementation": "Flowy",
            "simulatorCalibration": gate1_report["simulator"]["selectedCalibration"],
            "simulatorRole": "Visible Gate 2 deposit footprint and per-cell source thickness owner; final material morphology remains Gate 4 work.",
        },
        "coordinateSystem": {
            "world": "right-handed metres; x east/west, y elevation, z north/south",
            "blenderChildCoordinates": "(worldX, worldY, worldZ)",
            "blenderDisplayTransform": "World root rotates +90 degrees about X; review cameras use (x, -z, y)",
            "gltfRuntime": "Root and child transforms preserve plan-world local coordinates for later integration review.",
        },
        "worldBoundsMeters": {
            "minX": float(study.WORLD_X[0]),
            "maxX": float(study.WORLD_X[1]),
            "minZ": float(study.WORLD_Z[0]),
            "maxZ": float(study.WORLD_Z[1]),
        },
        "terrain": {
            "dataPath": rel(TERRAIN_DATA_PATH),
            "columns": columns,
            "rows": rows,
            "cellSizeMeters": 1.0,
            "reviewStrideSamples": TERRAIN_STRIDE,
            "minimumElevationMeters": round(float(height.min()), 6),
            "maximumElevationMeters": round(float(height.max()), 6),
            "performerElevationMeters": round(float(study.sample_height(height, 0.0, 0.0)), 6),
            "dataSha256": sha256_path(TERRAIN_DATA_PATH),
        },
        "lavaPlan": {
            "sourceWorldXZ": list(source),
            "diagnosticCenterlineWorldXZ": [list(point) for point in r3_path],
            "pathLengthMeters": round(path_length, 6),
            "sourceTerrainElevationMeters": round(source_y, 6),
            "terminusTerrainElevationMeters": round(terminus_y, 6),
            "netDescentMeters": round(source_y - terminus_y, 6),
            "centerlineCumulativeDistanceMeters": [round(value, 6) for value in cumulative],
            "footprintOwner": "simulatorDeposit",
            "grayboxRole": "The centerline is section and causality evidence only; it does not generate visible lava geometry.",
        },
        "simulatorDeposit": {
            "dataPath": rel(SIMULATOR_THICKNESS_PATH),
            "dataSha256": sha256_path(SIMULATOR_THICKNESS_PATH),
            "rasterSampleRegistration": "ESRI cell centres align to integer world X/Z because the lower-left corner is offset by half the 1 m cell size.",
            "format": "little-endian float32, row-major, runtime Z ascending",
            "columns": columns,
            "rows": rows,
            "cellSizeMeters": 1.0,
            "activeThicknessThresholdMeters": ACTIVE_THICKNESS_M,
            "minimumActiveThicknessMeters": round(float(simulator[active].min()), 6),
            "maximumActiveThicknessMeters": round(float(simulator[active].max()), 6),
            "activeCellCount": int(active.sum()),
            "activeAreaSquareMeters": float(active.sum()),
            "boundsWorldXZ": {
                "minX": round(float(active_x.min()), 3),
                "maxX": round(float(active_x.max()), 3),
                "minZ": round(float(active_z.min()), 3),
                "maxZ": round(float(active_z.max()), 3),
            },
            "cellSupportBoundsWorldXZ": {
                "minX": round(float(active_x.min()) - 0.5, 3),
                "maxX": round(float(active_x.max()) + 0.5, 3),
                "minZ": round(float(active_z.min()) - 0.5, 3),
                "maxZ": round(float(active_z.max()) + 0.5, 3),
            },
            "minimumCenterDistanceMeters": round(float(active_distances.min()), 6),
            "minimumVisibleSupportDistanceMeters": round(float(active_support_distances.min()), 6),
            "distanceMeasurement": "Minimum distance from performer origin to the visible 1 m cell support, computed against each active square's nearest point.",
            "clearanceBeyondActionEnvelopeMeters": round(float(active_support_distances.min()) - float(study.ACTION_RADIUS_M), 6),
            "upstreamMedianWidthMeters": round(upstream_median_width, 6),
            "upstreamWidthSamplingRuntimeZ": {"minimum": -30.0, "maximum": -5.0},
            "downstreamMedianWidthMeters": round(downstream_median_width, 6),
            "downstreamWidthSamplingRuntimeZ": {"maximum": -80.0},
            "downstreamWideningRatio": round(downstream_median_width / max(1.0, upstream_median_width), 6),
            "reachesInboardTerminalBasin": gate1_report["simulator"]["selectedResult"]["reachesInboardTerminalBasin"],
            "branchedRowCount": branched_rows,
            "terminalBasinActiveCellCount": gate1_report["simulator"]["selectedResult"]["terminalBasinActiveCellCount"],
            "touchesSouthBoundaryGuard": gate1_report["simulator"]["selectedResult"]["touchesSouthBoundaryGuard"],
            "depositSectionWorldXZ": deposit_section,
            "depositSectionLengthMeters": round(deposit_trace_length, 6),
            "depositSectionSourceElevationMeters": round(trace_source_y, 6),
            "depositSectionTerminusElevationMeters": round(trace_terminus_y, 6),
            "depositSectionNetDescentMeters": round(trace_source_y - trace_terminus_y, 6),
            "depositSectionDownhillFraction": round(downhill_fraction, 6),
            "depositSectionMaximumLocalRiseMeters": round(maximum_local_rise, 6),
            "visibleThicknessContract": "Each active ESRI cell becomes one quad centred on its registered integer world X/Z sample. Its four corners use the cell's exact Flowy thickness above the bilinearly sampled terrain; there is no thickness scale, floor, or neighbouring-cell maximum.",
        },
        "performerContract": {
            "originWorldXYZ": [0.0, round(performer_ground, 6), 0.0],
            "heightMeters": 1.75,
            "actionRadiusMeters": float(study.ACTION_RADIUS_M),
            "orbitRadiusMeters": float(study.ORBIT_RADIUS_M),
            "walkable": False,
        },
        "compositionContract": {
            "dominantMass": candidate.dominant_mass,
            "openHorizon": candidate.open_horizon,
            "sourceToTerminalBasin": "near northwest fissure through breach, main drainage with one failed breakout lobe, and inboard terminal deposition low",
            "antiPatterns": [
                "decorative arch",
                "circular stage island",
                "radial basin",
                "spline-owned lava footprint",
                "visible world edge from the 25 m orbit",
            ],
        },
        "reviewCameras": cameras,
        "reviewImages": [f"{rel(GATE_DIR)}/{name}" for name in REVIEW_IMAGE_NAMES],
        "orbitStrip": rel(ORBIT_STRIP_PATH),
        "continuousOrbit": rel(ORBIT_VIDEO_PATH),
        "limitations": [
            "This is a composition and spatial-causality graybox, not a final geological surface.",
            "The Flowy calibration is preproduction morphology evidence, not eruption-history or hazard science.",
            "The visible lava body is generated only from the selected checked-in Flowy thickness raster.",
            "The GLB is spatially review-equivalent for geometry, materials, cameras, and collision metadata; Blender world shading and the area fill are renderer-specific and intentionally excluded.",
            "The collision metadata is runtime-recognized, but the current Viewer3D terrain-safe collision path is enabled only for AUTUMN; Ember integration remains a later-gate task.",
            "Semantic composition assertions remain human review items and are not reported as machine-verified passes.",
            "No production Ember asset, runtime behavior, final material, atmosphere, or Meshy object is changed.",
        ],
    }
    contract["sourceDigests"] = {
        "terrainOwnerSha256": sha256_path(STUDY_PATH),
        "gate1AmendmentReportSha256": sha256_path(GATE1_REPORT_PATH),
        "researchContractSha256": sha256_path(RESEARCH_PATH),
        "contractPayloadSha256": canonical_digest(contract),
    }
    write_json(MANIFEST_PATH, contract)
    return contract


def blender_command(private_command: str, *, blend: Path | None = None) -> list[str]:
    if not BLENDER_EXE.exists():
        raise FileNotFoundError(BLENDER_EXE)
    command = [str(BLENDER_EXE), "--background", "--factory-startup"]
    if blend is not None:
        command.append(str(blend))
    command.extend(["--python", str(Path(__file__).resolve()), "--", private_command])
    return command


def run_blender(private_command: str, *, blend: Path | None = None) -> None:
    result = subprocess.run(
        blender_command(private_command, blend=blend),
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    success_marker = f"EMBER_BLENDER_COMMAND_OK {private_command}"
    if result.returncode != 0 or success_marker not in result.stdout:
        raise RuntimeError(
            f"Blender command {private_command} failed with exit code {result.returncode}"
        )


def blender_action_fcurves(obj: Any) -> list[Any]:
    """Return an object's action curves across Blender 4.x and 5.x APIs."""

    animation = getattr(obj, "animation_data", None)
    action = getattr(animation, "action", None)
    if action is None:
        return []
    legacy_curves = getattr(action, "fcurves", None)
    if legacy_curves is not None:
        return list(legacy_curves)
    slot = getattr(animation, "action_slot", None)
    if slot is None:
        return []
    curves: list[Any] = []
    for layer in action.layers:
        for strip in layer.strips:
            channelbag = strip.channelbag(slot)
            if channelbag is not None:
                curves.extend(channelbag.fcurves)
    return curves


def sampled_indices(size: int, stride: int) -> list[int]:
    values = list(range(0, size, stride))
    if values[-1] != size - 1:
        values.append(size - 1)
    return values


def read_float_grid(spec: dict[str, Any]) -> array:
    values = array("f")
    values.frombytes((ROOT / spec["dataPath"]).read_bytes())
    if sys.byteorder != "little":
        values.byteswap()
    expected = int(spec["columns"]) * int(spec["rows"])
    if len(values) != expected:
        raise ValueError(f"Terrain sample count {len(values)} != {expected}")
    return values


def bilinear_height(
    values: Sequence[float],
    terrain: dict[str, Any],
    bounds: dict[str, float],
    x: float,
    z: float,
) -> float:
    columns, rows = int(terrain["columns"]), int(terrain["rows"])
    cell = float(terrain["cellSizeMeters"])
    column = max(0.0, min(columns - 1.0, (x - float(bounds["minX"])) / cell))
    row = max(0.0, min(rows - 1.0, (z - float(bounds["minZ"])) / cell))
    c0, r0 = int(math.floor(column)), int(math.floor(row))
    c1, r1 = min(c0 + 1, columns - 1), min(r0 + 1, rows - 1)
    tx, tz = column - c0, row - r0
    return float(
        values[r0 * columns + c0] * (1 - tx) * (1 - tz)
        + values[r0 * columns + c1] * tx * (1 - tz)
        + values[r1 * columns + c0] * (1 - tx) * tz
        + values[r1 * columns + c1] * tx * tz
    )


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    return struct.unpack(">II", data[16:24])


def parse_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError(f"Invalid GLB header: {path}")
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("First GLB chunk is not JSON")
    document = json.loads(data[20 : 20 + json_length].decode("utf-8").rstrip(" \t\r\n\0"))
    binary_header = 20 + json_length
    if len(data) < binary_header + 8:
        raise ValueError("GLB has no binary chunk")
    binary_length, binary_type = struct.unpack_from("<II", data, binary_header)
    if binary_type != 0x004E4942:
        raise ValueError("Second GLB chunk is not BIN")
    binary = data[binary_header + 8 : binary_header + 8 + binary_length]
    return document, binary


def parse_glb_json(path: Path) -> dict[str, Any]:
    return parse_glb(path)[0]


def glb_accessor_values(document: dict[str, Any], binary: bytes, accessor_index: int) -> list[tuple[float | int, ...]]:
    accessor = document["accessors"][accessor_index]
    if "sparse" in accessor:
        raise ValueError("Sparse GLB accessors are not supported by this verifier")
    view = document["bufferViews"][accessor["bufferView"]]
    component_formats = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
    component_counts = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
    component_type = int(accessor["componentType"])
    component_format = component_formats[component_type]
    component_count = component_counts[accessor["type"]]
    packed_size = struct.calcsize("<" + component_format * component_count)
    stride = int(view.get("byteStride", packed_size))
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    return [
        struct.unpack_from("<" + component_format * component_count, binary, offset + index * stride)
        for index in range(int(accessor["count"]))
    ]


def quaternion_rotate_vector(quaternion: Sequence[float], vector: Sequence[float]) -> tuple[float, float, float]:
    qx, qy, qz, qw = (float(value) for value in quaternion)
    vx, vy, vz = (float(value) for value in vector)
    tx = 2.0 * (qy * vz - qz * vy)
    ty = 2.0 * (qz * vx - qx * vz)
    tz = 2.0 * (qx * vy - qy * vx)
    return (
        vx + qw * tx + (qy * tz - qz * ty),
        vy + qw * ty + (qz * tx - qx * tz),
        vz + qw * tz + (qx * ty - qy * tx),
    )


def image_font(size: int, bold: bool = False) -> Any:
    from PIL import ImageFont

    candidates = (
        Path("C:/Windows/Fonts/seguisb.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf") if bold else Path("C:/Windows/Fonts/arial.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def annotate_plan() -> None:
    from PIL import Image, ImageDraw

    path = GATE_DIR / REVIEW_IMAGE_NAMES[9]
    image = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(image, "RGBA")
    title_font = image_font(32, True)
    label_font = image_font(21, True)
    note_font = image_font(18)
    draw.rounded_rectangle((24, 22, 530, 112), radius=12, fill=(8, 12, 16, 220), outline=(98, 111, 120, 230), width=2)
    draw.text((42, 35), "NORTH-UP PLAN", fill=(240, 236, 226, 255), font=title_font)
    draw.text((43, 78), "orange = Flowy deposit · violet = collapse guide", fill=(205, 174, 231, 255), font=note_font)
    arrow_x = image.width - 72
    draw.line((arrow_x, 116, arrow_x, 45), fill=(235, 239, 242, 255), width=6)
    draw.polygon(((arrow_x, 30), (arrow_x - 13, 55), (arrow_x + 13, 55)), fill=(235, 239, 242, 255))
    draw.text((arrow_x - 12, 118), "N", fill=(235, 239, 242, 255), font=label_font)
    draw.rounded_rectangle(
        (image.width - 340, image.height - 60, image.width - 22, image.height - 18),
        radius=8,
        fill=(8, 12, 16, 220),
        outline=(98, 111, 120, 230),
        width=2,
    )
    draw.text(
        (image.width - 325, image.height - 52),
        "INBOARD TERMINAL LOW",
        fill=(240, 171, 55, 255),
        font=label_font,
    )
    image.save(path, compress_level=6)


def annotate_section(contract: dict[str, Any]) -> None:
    from PIL import Image, ImageDraw

    path = GATE_DIR / REVIEW_IMAGE_NAMES[10]
    image = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(image, "RGBA")
    title_font = image_font(30, True)
    label_font = image_font(19, True)
    note_font = image_font(17)
    distance = float(contract["simulatorDeposit"]["depositSectionWorldXZ"][-1][1])
    _, trace_length = polyline_metrics(contract["simulatorDeposit"]["depositSectionWorldXZ"])
    draw.rounded_rectangle((24, 20, 840, 112), radius=12, fill=(8, 12, 16, 226), outline=(98, 111, 120, 230), width=2)
    draw.text((42, 32), "FLOWY DEPOSIT LONGITUDINAL SECTION", fill=(240, 236, 226, 255), font=title_font)
    draw.text(
        (43, 75),
        f"trace {trace_length:.1f} m · 4× vertical · exact source thickness · terminal z {distance:.0f} m",
        fill=(174, 184, 190, 255),
        font=note_font,
    )
    axis_y = image.height - 42
    draw.line((88, axis_y, image.width - 48, axis_y), fill=(225, 229, 232, 230), width=3)
    draw.polygon(((image.width - 34, axis_y), (image.width - 57, axis_y - 9), (image.width - 57, axis_y + 9)), fill=(225, 229, 232, 230))
    draw.text((92, axis_y - 31), "SOURCE", fill=(255, 172, 72, 255), font=label_font)
    draw.text((image.width - 250, axis_y - 31), "TERMINAL BASIN", fill=(255, 172, 72, 255), font=label_font)
    draw.text((image.width // 2 - 90, axis_y - 31), "distance along active deposit", fill=(190, 198, 203, 255), font=note_font)
    draw.line((48, image.height - 74, 48, 152), fill=(225, 229, 232, 230), width=3)
    draw.polygon(((48, 134), (39, 157), (57, 157)), fill=(225, 229, 232, 230))
    draw.text((62, 145), "elevation (m) · 4×", fill=(190, 198, 203, 255), font=note_font)
    image.save(path, compress_level=6)


def compose_orbit_strip() -> None:
    from PIL import Image, ImageDraw

    tile_width, tile_height = 800, 450
    canvas = Image.new("RGB", (2400, 1500), (9, 13, 17))
    draw = ImageDraw.Draw(canvas)
    title_font = image_font(40, True)
    label_font = image_font(22, True)
    note_font = image_font(20)
    draw.text((42, 30), "EMBER GATE 2 R3 · SAMPLED RUNTIME ORBIT", fill=(240, 236, 226), font=title_font)
    draw.text(
        (44, 83),
        "Eight 45° runtime-equivalent stops, clockwise from the default audience side",
        fill=(157, 172, 182),
        font=note_font,
    )
    for index, image_name in enumerate(REVIEW_IMAGE_NAMES[1:9]):
        row, column = divmod(index, 3)
        left, top = column * tile_width, 130 + row * tile_height
        source = Image.open(GATE_DIR / image_name).convert("RGB")
        source.thumbnail((tile_width, tile_height - 36), Image.Resampling.LANCZOS)
        canvas.paste(source, (left + (tile_width - source.width) // 2, top))
        bearing = index * 45
        draw.text((left + 18, top + tile_height - 34), f"{bearing:03d}°", fill=(235, 132, 61), font=label_font)
        if index < 7:
            draw.text((left + tile_width - 54, top + tile_height - 38), "→", fill=(86, 209, 222), font=title_font)
    draw.text(
        (tile_width * 2 + 18, 130 + tile_height * 2 + 24),
        "315° → 000° closes the orbit",
        fill=(157, 172, 182),
        font=note_font,
    )
    ORBIT_STRIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(ORBIT_STRIP_PATH, compress_level=6)


def compose_orbit_animation() -> None:
    from PIL import Image

    frame_paths = sorted(CACHE_DIR.glob("orbit-frame-*.png"))
    if len(frame_paths) != 48:
        raise RuntimeError(f"Expected 48 continuous-orbit frames, found {len(frame_paths)}")
    frames = [Image.open(path).convert("RGB") for path in frame_paths]
    ORBIT_VIDEO_PATH.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        ORBIT_VIDEO_PATH,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=42,
        loop=0,
        quality=78,
        method=4,
    )
    for frame in frames:
        frame.close()


def compose_contact_sheet(contract: dict[str, Any]) -> None:
    from PIL import Image, ImageDraw, ImageFont

    width, height = 3840, 2160
    canvas = Image.new("RGB", (width, height), (11, 14, 18))
    draw = ImageDraw.Draw(canvas)

    title_font, subtitle_font, label_font = image_font(54, True), image_font(25), image_font(20, True)
    draw.text((66, 42), "EMBER GATE 2 R3 · PERFORMER-CENTRED BREACHED RIFT", fill=(241, 236, 225), font=title_font)
    draw.text(
        (69, 109),
        "Near fissure and breach · exact Flowy footprint/thickness · runtime camera contract · north-up plan",
        fill=(161, 174, 183),
        font=subtitle_font,
    )

    labels = [
        "DEFAULT AUDIENCE",
        "ORBIT 000°",
        "ORBIT 045°",
        "ORBIT 090°",
        "ORBIT 135°",
        "ORBIT 180°",
        "ORBIT 225°",
        "ORBIT 270°",
        "ORBIT 315°",
        "NORTH-UP PLAN",
        "LONGITUDINAL SECTION · 4× VERTICAL",
        "DIRECTOR OVERVIEW · BIRD'S-EYE",
        "COLLAPSE OBLIQUE",
    ]
    columns, rows = 5, 3
    margin_x, gap_x, gap_y = 66, 22, 25
    cell_width = (width - 2 * margin_x - gap_x * (columns - 1)) // columns
    cell_height = 565
    image_height = 515
    start_y = 174
    for index, (name, label) in enumerate(zip(REVIEW_IMAGE_NAMES, labels)):
        row, column = divmod(index, columns)
        items_in_row = min(columns, len(REVIEW_IMAGE_NAMES) - row * columns)
        centering = (columns - items_in_row) * (cell_width + gap_x) // 2
        left = margin_x + centering + column * (cell_width + gap_x)
        top = start_y + row * (cell_height + gap_y)
        source = Image.open(GATE_DIR / name).convert("RGB")
        source.thumbnail((cell_width, image_height), Image.Resampling.LANCZOS)
        tile = Image.new("RGB", (cell_width, image_height), (18, 22, 27))
        tile.paste(source, ((cell_width - source.width) // 2, (image_height - source.height) // 2))
        canvas.paste(tile, (left, top))
        draw.rectangle((left, top, left + cell_width, top + image_height), outline=(74, 84, 92), width=2)
        draw.text((left + 10, top + image_height + 9), label, fill=(233, 137, 70), font=label_font)

    footer = (
        f"380 × 335 m terrain · 4.5 m protected action radius · "
        f"{contract['lavaPlan']['pathLengthMeters']:.1f} m authored section axis · "
        f"{contract['simulatorDeposit']['depositSectionLengthMeters']:.1f} m connected deposit trace · "
        f"{contract['simulatorDeposit']['activeAreaSquareMeters']:.0f} m² active Flowy footprint"
    )
    draw.text((68, 2079), footer, fill=(161, 174, 183), font=subtitle_font)
    CONTACT_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(CONTACT_SHEET_PATH, compress_level=6)


def blender_build() -> None:
    import bpy  # type: ignore
    from mathutils import Vector  # type: ignore

    contract = load_json(MANIFEST_PATH)
    terrain = contract["terrain"]
    bounds = contract["worldBoundsMeters"]
    values = read_float_grid(terrain)
    deposit = contract["simulatorDeposit"]
    thickness_values = read_float_grid(deposit)
    columns, rows = int(terrain["columns"]), int(terrain["rows"])
    if len(thickness_values) != columns * rows:
        raise ValueError("Simulator thickness size does not match the coordinate manifest")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Ember Breached Rift Bench Gate 2 R3"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = REVIEW_WIDTH
    scene.render.resolution_y = REVIEW_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 42
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.75
    scene["ember_gate"] = 2
    scene["ember_coordinate_manifest_sha256"] = sha256_path(MANIFEST_PATH)
    scene["ember_terrain_owner_sha256"] = contract["sourceDigests"]["terrainOwnerSha256"]

    world = bpy.data.worlds.new("Ember Gate 2 R3 Diagnostic World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.010, 0.015, 0.021, 1.0)
    background.inputs["Strength"].default_value = 0.32
    scene.world = world

    def collection(name: str) -> Any:
        item = bpy.data.collections.new(name)
        scene.collection.children.link(item)
        return item

    collections = {
        "terrain": collection("EMBER_01_Terrain"),
        "lava": collection("EMBER_02_SimulatorDeposit"),
        "landform": collection("EMBER_03_LandformSignals"),
        "performer": collection("EMBER_04_PerformerScale"),
        "guide": collection("EMBER_QA_SimulatorAndPlanGuides"),
        "review": collection("EMBER_QA_CamerasAndLights"),
    }

    world_root = bpy.data.objects.new("EMBER_WorldRoot", None)
    world_root.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    world_root["ember_role"] = "world-root"
    world_root["ember_plan_to_blender"] = "(x, y, z) -> (x, -z, y)"
    scene.collection.objects.link(world_root)

    def material(
        name: str,
        color: tuple[float, float, float, float],
        *,
        roughness: float = 0.9,
        metallic: float = 0.0,
        emission: float = 0.0,
        alpha: float = 1.0,
    ) -> Any:
        item = bpy.data.materials.new(name)
        item.diffuse_color = color
        item.use_nodes = True
        shader = item.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
        if emission:
            emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
            strength_input = shader.inputs.get("Emission Strength")
            if emission_input:
                emission_input.default_value = color
            if strength_input:
                strength_input.default_value = emission
        if alpha < 1.0:
            shader.inputs["Alpha"].default_value = alpha
            item.surface_render_method = "DITHERED"
        return item

    mats = {
        "basalt": material("EMBER_GB_Basalt", (0.070, 0.086, 0.102, 1.0), roughness=0.96),
        "basalt_dark": material("EMBER_GB_SteepScarp", (0.025, 0.032, 0.040, 1.0), roughness=0.99),
        "old_flow": material("EMBER_GB_OldFlowPeninsula", (0.155, 0.178, 0.188, 1.0), roughness=0.93),
        "open_shelf": material("EMBER_GB_OpenSideShelves", (0.105, 0.132, 0.145, 1.0), roughness=0.95),
        "crust": material("EMBER_GB_SimulatorCrust", (0.105, 0.026, 0.012, 1.0), roughness=0.90),
        "molten": material("EMBER_GB_ExposedHeat", (0.48, 0.035, 0.004, 1.0), roughness=0.48, emission=1.8),
        "hot": material("EMBER_GB_HotCore", (0.82, 0.085, 0.006, 1.0), roughness=0.38, emission=3.2),
        "performer": material("EMBER_GB_Performer", (0.08, 0.55, 0.74, 1.0), roughness=0.48, emission=0.35),
        "guide": material("EMBER_GB_CollapseGuide", (0.31, 0.18, 0.78, 0.42), roughness=0.64, emission=0.55, alpha=0.42),
        "line": material("EMBER_GB_ReviewLine", (0.04, 0.62, 0.78, 1.0), roughness=0.6, emission=0.65),
        "source": material("EMBER_GB_SourceFissure", (1.0, 0.48, 0.025, 1.0), roughness=0.28, emission=11.0),
        "section_rock": material("EMBER_GB_SectionRock", (0.18, 0.205, 0.22, 1.0), roughness=0.92, emission=0.20),
    }

    def mesh_object(
        name: str,
        vertices: Sequence[Sequence[float]],
        faces: Sequence[Sequence[int]],
        target: Any,
        materials: Sequence[Any],
        role: str,
        *,
        collides: bool = False,
        parent: bool = True,
    ) -> Any:
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        target.objects.link(obj)
        if parent:
            obj.parent = world_root
        for item in materials:
            mesh.materials.append(item)
        obj["ember_role"] = role
        obj["ember_collides"] = collides
        obj["tka_camera_collision"] = collides
        obj["ember_coordinate_manifest_sha256"] = sha256_path(MANIFEST_PATH)
        return obj

    row_indices = sampled_indices(rows, TERRAIN_STRIDE)
    column_indices = sampled_indices(columns, TERRAIN_STRIDE)
    terrain_vertices = [
        (
            float(bounds["minX"]) + column * float(terrain["cellSizeMeters"]),
            float(values[row * columns + column]),
            float(bounds["minZ"]) + row * float(terrain["cellSizeMeters"]),
        )
        for row in row_indices
        for column in column_indices
    ]
    terrain_faces: list[tuple[int, int, int, int]] = []
    row_width = len(column_indices)
    for row in range(len(row_indices) - 1):
        for column in range(len(column_indices) - 1):
            first = row * row_width + column
            terrain_faces.append((first, first + 1, first + 1 + row_width, first + row_width))
    terrain_obj = mesh_object(
        "EMBER_Terrain",
        terrain_vertices,
        terrain_faces,
        collections["terrain"],
        [mats["basalt"], mats["basalt_dark"], mats["old_flow"], mats["open_shelf"]],
        "candidate-heightfield-and-visible-collider",
        collides=True,
    )
    terrain_obj["ember_source_data_sha256"] = terrain["dataSha256"]

    def gaussian_signal(
        x: float,
        z: float,
        x0: float,
        z0: float,
        sigma_x: float,
        sigma_z: float,
        amplitude: float,
        angle_deg: float,
    ) -> float:
        angle = math.radians(angle_deg)
        dx, dz = x - x0, z - z0
        local_x = dx * math.cos(angle) + dz * math.sin(angle)
        local_z = -dx * math.sin(angle) + dz * math.cos(angle)
        return amplitude * math.exp(-0.5 * ((local_x / sigma_x) ** 2 + (local_z / sigma_z) ** 2))

    def peninsula_signal(x: float, z: float) -> float:
        angle = math.radians(-7.0)
        dx, dz = x - 11.0, z + 1.5
        u = dx * math.cos(angle) + dz * math.sin(angle)
        v = -dx * math.sin(angle) + dz * math.cos(angle)
        warp = 1.0 + 0.10 * math.sin((u + 1.8 * v) / 7.5)
        metric = (abs(u) / (32.0 * warp)) ** 3.4 + (abs(v) / 9.5) ** 3.4
        t = max(0.0, min(1.0, (1.24 - metric) / 0.42))
        return t * t * (3.0 - 2.0 * t)

    def open_shelf_signal(x: float, z: float) -> float:
        return min(
            1.0,
            gaussian_signal(x, z, 27.0, 20.0, 13.0, 7.5, 1.0, 10.0)
            + gaussian_signal(x, z, 39.0, -17.0, 17.0, 8.0, 0.88, -11.0)
            + gaussian_signal(x, z, 24.0, -43.0, 13.0, 8.0, 0.72, 16.0),
        )

    for polygon in terrain_obj.data.polygons:
        cx, cy, cz = polygon.center
        slope = 1.0 - abs(polygon.normal.y)
        peninsula = peninsula_signal(float(cx), float(cz))
        open_shelf = open_shelf_signal(float(cx), float(cz))
        if cx < -24.0 and cz > 5.0 and slope > 0.075:
            polygon.material_index = 1
        elif cx < -18.0 and cz > 5.0 and cy > 5.0:
            polygon.material_index = 2
        elif peninsula > 0.34 and slope < 0.18:
            polygon.material_index = 2
        elif open_shelf > 0.24 and slope < 0.18:
            polygon.material_index = 3
        elif slope > 0.14:
            polygon.material_index = 1
        else:
            polygon.material_index = 0
        polygon.use_smooth = True

    path = contract["lavaPlan"]["diagnosticCenterlineWorldXZ"]
    path_width_placeholders = [1.0] * len(path)
    source_x, source_z = (float(value) for value in contract["lavaPlan"]["sourceWorldXZ"])
    active_threshold = float(deposit["activeThicknessThresholdMeters"])

    def lava_top(x: float, z: float) -> tuple[float, float]:
        """Sample the diagnostic section surface, independent of cell-quad registration."""

        thickness = max(0.0, bilinear_height(thickness_values, deposit, bounds, x, z))
        terrain_y = bilinear_height(values, terrain, bounds, x, z)
        return terrain_y + thickness, thickness

    lava_vertices: list[tuple[float, float, float]] = []
    lava_top_faces: list[tuple[int, int, int, int]] = []
    lava_top_materials: list[int] = []
    cell_top_vertices: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    half_cell = float(deposit["cellSizeMeters"]) * 0.5
    for row in range(rows):
        center_z = float(bounds["minZ"]) + row * float(deposit["cellSizeMeters"])
        for column in range(columns):
            center_index = row * columns + column
            center_thickness = float(thickness_values[center_index])
            if center_thickness <= active_threshold:
                continue
            center_x = float(bounds["minX"]) + column * float(deposit["cellSizeMeters"])
            base_vertex = len(lava_vertices)
            for x, z in (
                (center_x - half_cell, center_z - half_cell),
                (center_x + half_cell, center_z - half_cell),
                (center_x + half_cell, center_z + half_cell),
                (center_x - half_cell, center_z + half_cell),
            ):
                y = bilinear_height(values, terrain, bounds, x, z) + center_thickness
                lava_vertices.append((x, y, z))
            top_face = (base_vertex, base_vertex + 1, base_vertex + 2, base_vertex + 3)
            cell_top_vertices[(row, column)] = top_face
            lava_top_faces.append(top_face)
            seam = math.sin(center_x * 0.71 + center_z * 0.29) + 0.55 * math.sin(center_z * 0.83)
            centerline_distance, flow_progress, _ = nearest_path_sample(
                center_x,
                center_z,
                path,
                path_width_placeholders,
            )
            source_distance = math.hypot(center_x - source_x, center_z - source_z)
            if source_distance <= 5.0:
                lava_top_materials.append(2)
            elif flow_progress <= 0.24 and centerline_distance <= 5.5 and center_thickness > 0.08:
                lava_top_materials.append(1)
            elif center_thickness > 0.48 and seam > 1.24:
                lava_top_materials.append(2)
            elif center_thickness > 0.30 and seam > 0.98:
                lava_top_materials.append(1)
            else:
                lava_top_materials.append(0)

    # The registered top faces remain the simulator truth.  Riser faces close
    # every inter-cell height step, while terrain skirts close the footprint
    # boundary.  This keeps the deposit a continuous terrain-conforming body
    # instead of an open stack of disconnected raster cards.
    lava_support_faces: list[tuple[int, int, int, int]] = []
    for (row, column), top in cell_top_vertices.items():
        for dr, dc, current_edge, neighbour_edge in (
            (-1, 0, (0, 1), None),
            (0, 1, (1, 2), (0, 3)),
            (1, 0, (2, 3), (1, 0)),
            (0, -1, (3, 0), None),
        ):
            neighbour = (row + dr, column + dc)
            neighbour_top = cell_top_vertices.get(neighbour)
            if neighbour_top is not None:
                if neighbour_edge is None:
                    continue
                a, b = current_edge
                na, nb = neighbour_edge
                lava_support_faces.append((top[a], neighbour_top[na], neighbour_top[nb], top[b]))
                continue
            a, b = current_edge
            base_a = len(lava_vertices)
            for top_vertex in (top[a], top[b]):
                x, _, z = lava_vertices[top_vertex]
                lava_vertices.append((x, bilinear_height(values, terrain, bounds, x, z), z))
            lava_support_faces.append((top[a], top[b], base_a + 1, base_a))

    lava_faces = [*lava_top_faces, *lava_support_faces]
    lava_face_materials = [*lava_top_materials, *([0] * len(lava_support_faces))]
    lava_obj = mesh_object(
        "EMBER_LavaSimulatorDeposit",
        lava_vertices,
        lava_faces,
        collections["lava"],
        [mats["crust"], mats["molten"], mats["hot"]],
        "simulator-owned-visible-deposit",
    )
    lava_obj["ember_path_length_m"] = contract["lavaPlan"]["pathLengthMeters"]
    lava_obj["ember_source_sha256"] = deposit["dataSha256"]
    lava_obj["ember_active_cell_count"] = deposit["activeCellCount"]
    lava_obj["ember_registered_top_face_count"] = len(lava_top_faces)
    lava_obj["ember_support_face_count"] = len(lava_support_faces)
    for polygon, material_index in zip(lava_obj.data.polygons, lava_face_materials):
        polygon.material_index = material_index

    # The plan-only polygon shows the failed rock volume as absence. The
    # visible terrain already contains the breach; this diagnostic overlay is
    # hidden from cinematic views and excluded from the GLB review export.
    collapse_outline = (
        (-35.0, 43.0),
        (-26.0, 45.0),
        (-17.0, 38.0),
        (-14.0, 28.0),
        (-18.0, 17.0),
        (-27.0, 13.0),
        (-35.0, 22.0),
    )
    collapse_vertices = [
        (x, bilinear_height(values, terrain, bounds, x, z) + 0.34, z)
        for x, z in collapse_outline
    ]
    collapse_faces = [tuple(range(len(collapse_vertices)))]
    collapse_guide = mesh_object(
        "EMBER_CollapseGuide",
        collapse_vertices,
        collapse_faces,
        collections["guide"],
        [mats["guide"]],
        "plan-only-missing-collapse-volume",
    )
    collapse_guide.hide_render = True

    def append_octahedron(
        vertices: list[tuple[float, float, float]],
        faces: list[tuple[int, int, int]],
        x: float,
        y: float,
        z: float,
        scale_x: float,
        scale_y: float,
        scale_z: float,
    ) -> None:
        base = len(vertices)
        vertices.extend(
            (
                (x + scale_x, y, z),
                (x - scale_x, y, z),
                (x, y, z + scale_z),
                (x, y, z - scale_z),
                (x, y + scale_y, z),
                (x, y - scale_y * 0.28, z),
            )
        )
        faces.extend(
            (
                (base + 0, base + 2, base + 4),
                (base + 2, base + 1, base + 4),
                (base + 1, base + 3, base + 4),
                (base + 3, base + 0, base + 4),
                (base + 2, base + 0, base + 5),
                (base + 1, base + 2, base + 5),
                (base + 3, base + 1, base + 5),
                (base + 0, base + 3, base + 5),
            )
        )

    def append_fractured_block(
        vertices: list[tuple[float, float, float]],
        faces: list[tuple[int, ...]],
        x: float,
        y: float,
        z: float,
        scale_x: float,
        scale_y: float,
        scale_z: float,
        angle_deg: float,
    ) -> None:
        angle = math.radians(angle_deg)
        cosine, sine = math.cos(angle), math.sin(angle)
        base = len(vertices)
        corners = ((-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0))
        for level, y_offset in ((0, 0.0), (1, scale_y)):
            for corner_index, (cx, cz) in enumerate(corners):
                local_x = cx * scale_x
                local_z = cz * scale_z
                rotated_x = local_x * cosine - local_z * sine
                rotated_z = local_x * sine + local_z * cosine
                top_jitter = (0.12 * scale_y * math.sin((base + corner_index) * 1.71)) if level else 0.0
                vertices.append((x + rotated_x, y + y_offset + top_jitter, z + rotated_z))
        faces.extend(
            (
                (base + 0, base + 1, base + 2, base + 3),
                (base + 4, base + 7, base + 6, base + 5),
                (base + 0, base + 4, base + 5, base + 1),
                (base + 1, base + 5, base + 6, base + 2),
                (base + 2, base + 6, base + 7, base + 3),
                (base + 3, base + 7, base + 4, base + 0),
            )
        )
    talus_vertices: list[tuple[float, float, float]] = []
    talus_faces: list[tuple[int, int, int]] = []
    for index in range(34):
        fraction = index / 33.0
        x = -35.0 + 17.0 * fraction + 6.0 * math.sin(index * 1.73)
        z = 8.0 + 29.0 * fraction + 5.0 * math.sin(index * 2.11)
        y = bilinear_height(values, terrain, bounds, x, z)
        sx = 0.65 + 1.8 * ((index * 17) % 13) / 12.0
        sy = 0.35 + 1.55 * ((index * 11) % 9) / 8.0
        sz = 0.65 + 1.65 * ((index * 7) % 11) / 10.0
        append_fractured_block(talus_vertices, talus_faces, x, y - 0.06, z, sx, sy, sz, -31.0 + index * 19.0)
    talus_obj = mesh_object(
        "EMBER_TalusApron",
        talus_vertices,
        talus_faces,
        collections["landform"],
        [mats["basalt_dark"]],
        "visible-collapse-talus-and-failed-headwall-blocks",
    )

    def build_strip(
        points: Sequence[Sequence[float]],
        widths: Sequence[float],
        y_offset: float,
    ) -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int, int]]]:
        vertices: list[tuple[float, float, float]] = []
        faces: list[tuple[int, int, int, int]] = []
        for index, point in enumerate(points):
            previous = points[max(0, index - 1)]
            following = points[min(len(points) - 1, index + 1)]
            tangent_x = float(following[0]) - float(previous[0])
            tangent_z = float(following[1]) - float(previous[1])
            length = max(1e-6, math.hypot(tangent_x, tangent_z))
            normal_x, normal_z = -tangent_z / length, tangent_x / length
            half_width = float(widths[index]) * 0.5
            for side in (-1.0, 1.0):
                x = float(point[0]) + normal_x * half_width * side
                z = float(point[1]) + normal_z * half_width * side
                y = bilinear_height(values, terrain, bounds, x, z) + y_offset
                vertices.append((x, y, z))
            if index:
                base = index * 2
                faces.append((base - 2, base, base + 1, base - 1))
        return vertices, faces

    fissure_points = ((-35.0, 31.5), (-30.0, 29.0), (-25.5, 26.5), (-22.0, 25.0), (-18.0, 23.5), (-14.0, 22.0))
    fissure_vertices, fissure_faces = build_strip(fissure_points, (0.7, 1.0, 1.4, 1.6, 1.2, 0.7), 0.62)
    source_fissure = mesh_object(
        "EMBER_SourceFissure",
        fissure_vertices,
        fissure_faces,
        collections["landform"],
        [mats["source"]],
        "elongated-fissure-source-spatial-event",
    )

    rampart_vertices: list[tuple[float, float, float]] = []
    rampart_faces: list[tuple[int, int, int]] = []
    for index, (x, z) in enumerate(((-35.0, 33.0), (-30.0, 31.0), (-25.0, 29.0), (-19.0, 26.5), (-14.0, 24.0), (-31.0, 26.0), (-25.0, 23.0), (-19.0, 21.5), (-15.0, 20.5))):
        y = bilinear_height(values, terrain, bounds, x, z)
        append_octahedron(
            rampart_vertices,
            rampart_faces,
            x,
            y + 0.8,
            z,
            1.4 + 0.35 * (index % 3),
            1.5 + 0.3 * ((index + 1) % 3),
            1.1 + 0.25 * (index % 2),
        )
    source_rampart = mesh_object(
        "EMBER_SourceRampart",
        rampart_vertices,
        rampart_faces,
        collections["landform"],
        [mats["basalt_dark"]],
        "fractured-fissure-rampart",
    )

    performer_y = float(contract["performerContract"]["originWorldXYZ"][1])
    performer_vertices: list[tuple[float, float, float]] = []
    performer_faces: list[tuple[int, ...]] = []
    sides = 10
    for level_y, radius in ((performer_y, 0.22), (performer_y + 1.46, 0.22)):
        performer_vertices.extend(
            (math.cos(math.tau * index / sides) * radius, level_y, math.sin(math.tau * index / sides) * radius)
            for index in range(sides)
        )
    for index in range(sides):
        performer_faces.append((index, (index + 1) % sides, sides + (index + 1) % sides, sides + index))
    performer_faces.extend((tuple(range(sides - 1, -1, -1)), tuple(range(sides, sides * 2))))
    append_octahedron(performer_vertices, performer_faces, 0.0, performer_y + 1.57, 0.0, 0.23, 0.18, 0.23)
    performer = mesh_object(
        "EMBER_PerformerProxy",
        performer_vertices,
        performer_faces,
        collections["performer"],
        [mats["performer"]],
        "1.75m-performer-scale-proxy",
    )

    radius = float(contract["performerContract"]["actionRadiusMeters"])
    ring_vertices: list[tuple[float, float, float]] = []
    ring_faces: list[tuple[int, int, int, int]] = []
    segments = 96
    for index in range(segments):
        angle = math.tau * index / segments
        for ring_radius in (radius - 0.08, radius + 0.08):
            x, z = math.cos(angle) * ring_radius, math.sin(angle) * ring_radius
            y = bilinear_height(values, terrain, bounds, x, z) + 0.16
            ring_vertices.append((x, y, z))
    for index in range(segments):
        next_index = (index + 1) % segments
        ring_faces.append((index * 2, next_index * 2, next_index * 2 + 1, index * 2 + 1))
    action_ring = mesh_object(
        "EMBER_ActionEnvelope",
        ring_vertices,
        ring_faces,
        collections["guide"],
        [mats["line"]],
        "plan-only-action-envelope",
    )
    action_ring.hide_render = True

    # Diagnostic lighting stays neutral enough to read form while emissive
    # orange communicates only the lava body's internal state.
    sun_data = bpy.data.lights.new("EMBER_Sun_Data", "SUN")
    sun_data.energy = 2.0
    sun_data.angle = math.radians(18.0)
    sun = bpy.data.objects.new("EMBER_Sun", sun_data)
    sun.rotation_euler = (math.radians(38.0), math.radians(-24.0), math.radians(-28.0))
    collections["review"].objects.link(sun)

    area_data = bpy.data.lights.new("EMBER_EastFill_Data", "AREA")
    area_data.energy = 2600.0
    area_data.shape = "DISK"
    area_data.size = 80.0
    area = bpy.data.objects.new("EMBER_EastFill", area_data)
    area.location = (78.0, -28.0, 92.0)
    area.rotation_euler = (math.radians(24.0), 0.0, math.radians(112.0))
    collections["review"].objects.link(area)

    def world_to_blender(point: Sequence[float]) -> tuple[float, float, float]:
        return float(point[0]), -float(point[2]), float(point[1])

    def look_at(obj: Any, target: Sequence[float]) -> None:
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

    source_point_data = bpy.data.lights.new("EMBER_SourceFissureLight_Data", "POINT")
    source_point_data.energy = 780.0
    source_point_data.color = (1.0, 0.12, 0.015)
    source_point_data.shadow_soft_size = 8.0
    source_point = bpy.data.objects.new("EMBER_SourceFissureLight", source_point_data)
    source_x, source_z = contract["lavaPlan"]["sourceWorldXZ"]
    source_y = bilinear_height(values, terrain, bounds, source_x, source_z)
    source_point.location = world_to_blender((source_x, source_y + 4.0, source_z))
    collections["review"].objects.link(source_point)

    cameras: dict[str, Any] = {}
    for camera_spec in contract["reviewCameras"]:
        data = bpy.data.cameras.new(f"EMBER_Camera_{camera_spec['id']}_Data")
        data.type = "PERSP"
        data.sensor_fit = "VERTICAL"
        data.angle_y = math.radians(float(camera_spec["verticalFovDegrees"]))
        data.clip_start = 0.1
        data.clip_end = 700.0
        camera = bpy.data.objects.new(f"EMBER_Camera_{camera_spec['id']}", data)
        camera.location = world_to_blender(camera_spec["positionWorldXYZ"])
        look_at(camera, world_to_blender(camera_spec["targetWorldXYZ"]))
        camera["ember_role"] = "registered-review-camera"
        collections["review"].objects.link(camera)
        cameras[camera_spec["id"]] = camera

    plan_data = bpy.data.cameras.new("EMBER_Camera_plan_Data")
    plan_data.type = "ORTHO"
    plan_data.ortho_scale = 410.0
    plan_data.clip_start = 0.1
    plan_data.clip_end = 700.0
    plan_camera = bpy.data.objects.new("EMBER_Camera_plan", plan_data)
    plan_camera.location = world_to_blender((0.0, 390.0, 22.5))
    # Looking down Blender -Z with a 180° roll maps runtime +Z (north) to
    # image-up. R1 omitted this roll and therefore rendered south-up.
    plan_camera.rotation_euler = (0.0, 0.0, math.pi)
    plan_camera["ember_role"] = "registered-plan-camera"
    collections["review"].objects.link(plan_camera)

    GATE_DIR.mkdir(parents=True, exist_ok=True)
    collapse_guide.hide_render = True
    action_ring.hide_render = True
    for camera_spec in contract["reviewCameras"]:
        scene.camera = cameras[camera_spec["id"]]
        scene.render.resolution_x = REVIEW_WIDTH
        scene.render.resolution_y = REVIEW_HEIGHT
        scene.render.filepath = str(GATE_DIR / camera_spec["reviewImage"])
        bpy.ops.render.render(write_still=True)

    # A true continuous runtime-equivalent orbit supplements the eight sampled
    # stills.  The camera keeps the same 50° vertical FOV and exact 25 m
    # eye-to-target distance while a pivot rotates through 360°.
    video_pivot = bpy.data.objects.new("EMBER_QA_ContinuousOrbitPivot", None)
    video_target = world_to_blender(contract["reviewCameras"][1]["targetWorldXYZ"])
    video_pivot.location = video_target
    collections["review"].objects.link(video_pivot)
    video_data = bpy.data.cameras.new("EMBER_QA_ContinuousOrbitCamera_Data")
    video_data.type = "PERSP"
    video_data.sensor_fit = "VERTICAL"
    video_data.angle_y = math.radians(50.0)
    video_data.clip_start = 0.1
    video_data.clip_end = 700.0
    video_camera = bpy.data.objects.new("EMBER_QA_ContinuousOrbitCamera", video_data)
    collections["review"].objects.link(video_camera)
    video_camera.parent = video_pivot
    video_position = Vector(world_to_blender(contract["reviewCameras"][1]["positionWorldXYZ"]))
    video_camera.location = video_position - Vector(video_target)
    video_camera.rotation_euler = (Vector((0.0, 0.0, 0.0)) - video_camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    video_pivot.rotation_euler = (0.0, 0.0, 0.0)
    video_pivot.keyframe_insert(data_path="rotation_euler", frame=1)
    video_pivot.rotation_euler = (0.0, 0.0, math.tau)
    video_pivot.keyframe_insert(data_path="rotation_euler", frame=49)
    for fcurve in blender_action_fcurves(video_pivot):
        for point in fcurve.keyframe_points:
            point.interpolation = "LINEAR"
    scene.frame_start = 1
    scene.frame_end = 48
    scene.render.fps = 24
    scene.camera = video_camera
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(CACHE_DIR / "orbit-frame-")
    bpy.ops.render.render(animation=True)

    collapse_guide.hide_render = False
    action_ring.hide_render = False
    scene.camera = plan_camera
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.filepath = str(GATE_DIR / REVIEW_IMAGE_NAMES[9])
    bpy.ops.render.render(write_still=True)
    collapse_guide.hide_render = True
    action_ring.hide_render = True

    # Longitudinal section is a second scene inside the same editable Blend.
    section = bpy.data.scenes.new("Ember Gate 2 R3 Longitudinal Section")
    section.render.engine = "BLENDER_EEVEE"
    section.render.resolution_x = 1400
    section.render.resolution_y = 700
    section.render.resolution_percentage = 100
    section.render.image_settings.file_format = "PNG"
    section.render.image_settings.color_mode = "RGB"
    section.view_settings.look = "AgX - Medium High Contrast"
    section.world = world
    section_collection = bpy.data.collections.new("EMBER_SECTION_Geometry")
    section.collection.children.link(section_collection)
    section_path = deposit["depositSectionWorldXZ"]
    cumulative, path_length = polyline_metrics(section_path)
    section_samples: list[tuple[float, float, float]] = []
    for sample_index in range(241):
        distance_along = path_length * sample_index / 240.0
        segment_index = len(section_path) - 2
        for candidate_index in range(len(cumulative) - 1):
            if distance_along <= cumulative[candidate_index + 1]:
                segment_index = candidate_index
                break
        segment_length = cumulative[segment_index + 1] - cumulative[segment_index]
        local = 0.0 if segment_length <= 1e-9 else (distance_along - cumulative[segment_index]) / segment_length
        x = float(section_path[segment_index][0]) * (1.0 - local) + float(section_path[segment_index + 1][0]) * local
        z = float(section_path[segment_index][1]) * (1.0 - local) + float(section_path[segment_index + 1][1]) * local
        y = bilinear_height(values, terrain, bounds, x, z)
        thick = lava_top(x, z)[0] - y
        section_samples.append((distance_along, y, thick))
    vertical_exaggeration = 4.0
    base_y = -8.0
    rock_vertices = [(distance, 0.0, base_y * vertical_exaggeration) for distance, _, _ in section_samples]
    rock_vertices += [(distance, 0.0, elevation * vertical_exaggeration) for distance, elevation, _ in section_samples]
    count = len(section_samples)
    rock_faces = [(index, index + 1, count + index + 1, count + index) for index in range(count - 1)]
    rock = mesh_object(
        "EMBER_SECTION_Terrain",
        rock_vertices,
        rock_faces,
        section_collection,
        [mats["section_rock"]],
        "longitudinal-section-terrain",
        parent=False,
    )
    lava_section_vertices = [(distance, -0.08, elevation * vertical_exaggeration) for distance, elevation, _ in section_samples]
    lava_section_vertices += [
        (distance, -0.08, (elevation + thickness) * vertical_exaggeration)
        for distance, elevation, thickness in section_samples
    ]
    lava_section_faces = [(index, index + 1, count + index + 1, count + index) for index in range(count - 1)]
    mesh_object(
        "EMBER_SECTION_Lava",
        lava_section_vertices,
        lava_section_faces,
        section_collection,
        [mats["molten"]],
        "longitudinal-section-lava",
        parent=False,
    )
    section_camera_data = bpy.data.cameras.new("EMBER_SECTION_Camera_Data")
    section_camera_data.type = "ORTHO"
    section_camera_data.ortho_scale = 178.0
    section_camera = bpy.data.objects.new("EMBER_SECTION_Camera", section_camera_data)
    section_camera.location = (path_length * 0.5, -220.0, 31.0)
    look_at(section_camera, (path_length * 0.5, 0.0, 31.0))
    section.collection.objects.link(section_camera)
    section.camera = section_camera
    section_light_data = bpy.data.lights.new("EMBER_SECTION_Key_Data", "AREA")
    section_light_data.energy = 3200.0
    section_light_data.shape = "RECTANGLE"
    section_light_data.size = 240.0
    section_light_data.size_y = 95.0
    section_light = bpy.data.objects.new("EMBER_SECTION_Key", section_light_data)
    section_light.location = (path_length * 0.5, -65.0, 72.0)
    look_at(section_light, (path_length * 0.5, 0.0, 25.0))
    section.collection.objects.link(section_light)
    section.render.filepath = str(GATE_DIR / REVIEW_IMAGE_NAMES[10])
    bpy.context.window.scene = section
    bpy.ops.render.render(write_still=True)
    bpy.context.window.scene = scene

    # Leave both scenes portable and the main Blend in the exact default
    # runtime-equivalent review state.  No checkout-specific render path is
    # persisted in the editable source.
    collapse_guide.hide_render = True
    action_ring.hide_render = True
    scene.camera = cameras["default-audience"]
    scene.render.resolution_x = REVIEW_WIDTH
    scene.render.resolution_y = REVIEW_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = "//ember-gate2-r3-preview.png"
    scene.frame_start = 1
    scene.frame_end = 48
    section.render.filepath = "//ember-gate2-r3-longitudinal-section.png"

    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [
        world_root,
        terrain_obj,
        lava_obj,
        talus_obj,
        source_fissure,
        source_rampart,
        performer,
        plan_camera,
        sun,
        source_point,
        *cameras.values(),
    ]
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = world_root
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_cameras=True,
        export_lights=True,
        export_extras=True,
        export_apply=False,
        export_yup=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    scene.camera = cameras["default-audience"]
    scene.render.resolution_x = REVIEW_WIDTH
    scene.render.resolution_y = REVIEW_HEIGHT
    scene.render.filepath = "//ember-gate2-r3-preview.png"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(
        json.dumps(
            {
                "blend": rel(BLEND_PATH),
                "glb": rel(GLB_PATH),
                "terrainVertices": len(terrain_obj.data.vertices),
                "terrainFaces": len(terrain_obj.data.polygons),
                "lavaVertices": len(lava_obj.data.vertices),
                "lavaFaces": len(lava_obj.data.polygons),
                "simulatorActiveCells": deposit["activeCellCount"],
                "exportedCompositionObjects": [obj.name for obj in export_objects],
                "reviewImages": contract["reviewImages"],
            },
            indent=2,
        )
    )


def blender_verify() -> None:
    import bpy  # type: ignore
    from mathutils import Vector  # type: ignore

    contract = load_json(MANIFEST_PATH)
    scene = bpy.data.scenes.get("Ember Breached Rift Bench Gate 2 R3")
    root = bpy.data.objects.get("EMBER_WorldRoot")
    terrain = bpy.data.objects.get("EMBER_Terrain")
    lava = bpy.data.objects.get("EMBER_LavaSimulatorDeposit")
    talus = bpy.data.objects.get("EMBER_TalusApron")
    collapse = bpy.data.objects.get("EMBER_CollapseGuide")
    source = bpy.data.objects.get("EMBER_SourceFissure")
    rampart = bpy.data.objects.get("EMBER_SourceRampart")
    performer = bpy.data.objects.get("EMBER_PerformerProxy")
    action = bpy.data.objects.get("EMBER_ActionEnvelope")
    orbit_pivot = bpy.data.objects.get("EMBER_QA_ContinuousOrbitPivot")
    plan_camera = bpy.data.objects.get("EMBER_Camera_plan")
    colliders = [
        obj.name
        for obj in scene.objects
        if obj.type == "MESH" and bool(obj.get("tka_camera_collision", False))
    ]
    cameras = [
        obj.name
        for obj in scene.objects
        if obj.type == "CAMERA" and obj.get("ember_role") == "registered-review-camera"
    ]
    camera_contracts: dict[str, Any] = {}
    for camera_spec in contract["reviewCameras"]:
        camera = bpy.data.objects.get(f"EMBER_Camera_{camera_spec['id']}")
        if camera is None:
            camera_contracts[camera_spec["id"]] = {"passed": False, "reason": "missing"}
            continue
        position = camera_spec["positionWorldXYZ"]
        target = camera_spec["targetWorldXYZ"]
        expected_location = Vector((float(position[0]), -float(position[2]), float(position[1])))
        expected_target = Vector((float(target[0]), -float(target[2]), float(target[1])))
        actual_location = camera.matrix_world.translation
        position_error = (actual_location - expected_location).length
        expected_direction = (expected_target - actual_location).normalized()
        actual_direction = camera.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
        aim_dot = max(-1.0, min(1.0, actual_direction.normalized().dot(expected_direction)))
        aim_error = math.degrees(math.acos(aim_dot))
        distance = (actual_location - expected_target).length
        fov = math.degrees(float(camera.data.angle_y))
        runtime_ok = not camera_spec.get("runtimeEquivalent") or distance <= 25.000001
        camera_contracts[camera_spec["id"]] = {
            "passed": (
                runtime_ok
                and position_error <= 1e-5
                and aim_error <= 0.03
                and abs(fov - float(camera_spec["verticalFovDegrees"])) <= 1e-4
            ),
            "runtimeEquivalent": bool(camera_spec.get("runtimeEquivalent")),
            "eyeToTargetDistanceMeters": round(distance, 6),
            "verticalFovDegrees": round(fov, 6),
            "positionErrorMeters": round(position_error, 9),
            "aimErrorDegrees": round(aim_error, 9),
        }
    expected_terrain_vertices = len(sampled_indices(int(contract["terrain"]["columns"]), TERRAIN_STRIDE)) * len(
        sampled_indices(int(contract["terrain"]["rows"]), TERRAIN_STRIDE)
    )
    deposit_values = read_float_grid(contract["simulatorDeposit"])
    deposit_columns = int(contract["simulatorDeposit"]["columns"])
    deposit_rows = int(contract["simulatorDeposit"]["rows"])
    deposit_cell = float(contract["simulatorDeposit"]["cellSizeMeters"])
    bounds = contract["worldBoundsMeters"]
    terrain_values = read_float_grid(contract["terrain"])
    threshold = float(contract["simulatorDeposit"]["activeThicknessThresholdMeters"])
    expected_lava_centers = {
        (
            round(float(bounds["minX"]) + column * deposit_cell, 6),
            round(float(bounds["minZ"]) + row * deposit_cell, 6),
        )
        for row in range(deposit_rows)
        for column in range(deposit_columns)
        if float(deposit_values[row * deposit_columns + column]) > threshold
    }
    registered_top_face_count = int(lava.get("ember_registered_top_face_count", 0)) if lava is not None else 0
    support_face_count = int(lava.get("ember_support_face_count", 0)) if lava is not None else 0
    actual_lava_centers = (
        {
            (round(float(polygon.center.x), 6), round(float(polygon.center.z), 6))
            for polygon in list(lava.data.polygons)[:registered_top_face_count]
        }
        if lava is not None
        else set()
    )
    top_vertex_height_errors: list[float] = []
    top_face_vertex_contract = lava is not None
    if lava is not None:
        for polygon in list(lava.data.polygons)[:registered_top_face_count]:
            center_x = float(polygon.center.x)
            center_z = float(polygon.center.z)
            column = int(round((center_x - float(bounds["minX"])) / deposit_cell))
            row = int(round((center_z - float(bounds["minZ"])) / deposit_cell))
            if not (0 <= row < deposit_rows and 0 <= column < deposit_columns):
                top_face_vertex_contract = False
                continue
            cell_thickness = float(deposit_values[row * deposit_columns + column])
            if len(polygon.vertices) != 4 or cell_thickness <= threshold:
                top_face_vertex_contract = False
            for vertex_index in polygon.vertices:
                vertex = lava.data.vertices[int(vertex_index)].co
                expected_height = bilinear_height(
                    terrain_values,
                    contract["terrain"],
                    bounds,
                    float(vertex.x),
                    float(vertex.z),
                ) + cell_thickness
                top_vertex_height_errors.append(abs(float(vertex.y) - expected_height))
    maximum_top_vertex_height_error = max(top_vertex_height_errors, default=math.inf)
    lava_edge_use: dict[tuple[int, int], int] = {}
    if lava is not None:
        for polygon in lava.data.polygons:
            vertices = list(polygon.vertices)
            for start, end in zip(vertices, vertices[1:] + vertices[:1]):
                edge = tuple(sorted((int(start), int(end))))
                lava_edge_use[edge] = lava_edge_use.get(edge, 0) + 1
    unsupported_top_edges = 0
    if lava is not None:
        for polygon in list(lava.data.polygons)[:registered_top_face_count]:
            vertices = list(polygon.vertices)
            for start, end in zip(vertices, vertices[1:] + vertices[:1]):
                if lava_edge_use.get(tuple(sorted((int(start), int(end)))), 0) < 2:
                    unsupported_top_edges += 1
    actual_lava_support = None
    if lava is not None and lava.data.vertices:
        xs = [float(vertex.co.x) for vertex in lava.data.vertices]
        zs = [float(vertex.co.z) for vertex in lava.data.vertices]
        actual_lava_support = {
            "minX": round(min(xs), 6),
            "maxX": round(max(xs), 6),
            "minZ": round(min(zs), 6),
            "maxZ": round(max(zs), 6),
        }
    expected_lava_support = contract["simulatorDeposit"]["cellSupportBoundsWorldXZ"]
    orbit_keyframes = []
    orbit_interpolations = []
    if orbit_pivot:
        for fcurve in blender_action_fcurves(orbit_pivot):
            if fcurve.data_path == "rotation_euler" and fcurve.array_index == 2:
                orbit_keyframes = [[float(point.co.x), float(point.co.y)] for point in fcurve.keyframe_points]
                orbit_interpolations = [point.interpolation for point in fcurve.keyframe_points]
                break
    checks = {
        "manifest-scene-lock": {
            "passed": scene is not None and scene.get("ember_coordinate_manifest_sha256") == sha256_path(MANIFEST_PATH),
            "evidence": scene.get("ember_coordinate_manifest_sha256") if scene else None,
        },
        "root-transform": {
            "passed": root is not None and abs(root.rotation_euler.x - math.radians(90.0)) < 1e-6,
            "evidence": list(root.rotation_euler) if root else None,
        },
        "terrain-identity": {
            "passed": (
                terrain is not None
                and len(terrain.data.vertices) == expected_terrain_vertices
                and not terrain.hide_render
                and terrain.get("ember_role") == "candidate-heightfield-and-visible-collider"
            ),
            "evidence": {
                "vertexCount": len(terrain.data.vertices) if terrain else None,
                "faceCount": len(terrain.data.polygons) if terrain else None,
                "expectedVertexCount": expected_terrain_vertices,
                "role": terrain.get("ember_role") if terrain else None,
            },
        },
        "visible-collision": {
            "passed": (
                colliders == ["EMBER_Terrain"]
                and terrain is not None
                and not terrain.hide_render
                and terrain.get("tka_camera_collision") is True
            ),
            "evidence": {"runtimeRecognizedColliders": colliders, "metadata": "tka_camera_collision=true"},
        },
        "lava-footprint": {
            "passed": (
                lava is not None
                and registered_top_face_count == int(contract["simulatorDeposit"]["activeCellCount"])
                and len(lava.data.polygons) == registered_top_face_count + support_face_count
                and len(lava.data.vertices) >= registered_top_face_count * 4
                and actual_lava_centers == expected_lava_centers
                and actual_lava_support == expected_lava_support
                and top_face_vertex_contract
                and len(top_vertex_height_errors) == registered_top_face_count * 4
                and maximum_top_vertex_height_error <= 1e-5
                and support_face_count > 0
                and unsupported_top_edges == 0
                and lava.get("ember_source_sha256") == contract["simulatorDeposit"]["dataSha256"]
            ),
            "evidence": {
                "vertexCount": len(lava.data.vertices) if lava else None,
                "faceCount": len(lava.data.polygons) if lava else None,
                "expectedActiveCellCount": contract["simulatorDeposit"]["activeCellCount"],
                "registeredTopFaceCount": registered_top_face_count,
                "supportFaceCount": support_face_count,
                "unsupportedTopEdgeCount": unsupported_top_edges,
                "registeredFaceCenterCount": len(actual_lava_centers),
                "expectedRegisteredFaceCenterCount": len(expected_lava_centers),
                "verifiedRegisteredTopVertexCount": len(top_vertex_height_errors),
                "maximumTopVertexHeightErrorMeters": round(maximum_top_vertex_height_error, 9),
                "cellSupportBoundsWorldXZ": actual_lava_support,
                "expectedCellSupportBoundsWorldXZ": expected_lava_support,
                "sourceSha256": lava.get("ember_source_sha256") if lava else None,
            },
        },
        "review-equivalence-signals": {
            "passed": all(item is not None for item in (talus, collapse, source, rampart, performer, action)),
            "evidence": [
                item.name if item is not None else None
                for item in (talus, collapse, source, rampart, performer, action)
            ],
        },
        "registered-cameras": {
            "passed": len(cameras) == len(contract["reviewCameras"]) and all(item["passed"] for item in camera_contracts.values()),
            "evidence": camera_contracts,
        },
        "continuous-orbit-motion": {
            "passed": (
                len(orbit_keyframes) == 2
                and abs(orbit_keyframes[0][0] - 1.0) < 1e-6
                and abs(orbit_keyframes[0][1]) < 1e-6
                and abs(orbit_keyframes[1][0] - 49.0) < 1e-6
                and abs(orbit_keyframes[1][1] - math.tau) < 1e-6
                and orbit_interpolations == ["LINEAR", "LINEAR"]
            ),
            "evidence": {"keyframes": orbit_keyframes, "interpolations": orbit_interpolations},
        },
        "north-up-plan": {
            "passed": plan_camera is not None and abs(float(plan_camera.rotation_euler.z) - math.pi) < 1e-6,
            "evidence": list(plan_camera.rotation_euler) if plan_camera else None,
        },
        "section-scene": {
            "passed": bpy.data.scenes.get("Ember Gate 2 R3 Longitudinal Section") is not None,
            "evidence": "Ember Gate 2 R3 Longitudinal Section",
        },
        "performer-scale": {
            "passed": performer is not None and abs(
                max(vertex.co.y for vertex in performer.data.vertices)
                - min(vertex.co.y for vertex in performer.data.vertices)
                - 1.75
            ) <= 1e-6,
            "evidence": (
                round(
                    max(vertex.co.y for vertex in performer.data.vertices)
                    - min(vertex.co.y for vertex in performer.data.vertices),
                    6,
                )
                if performer
                else None
            ),
        },
        "portable-default-state": {
            "passed": (
                scene.camera is not None
                and scene.camera.name == "EMBER_Camera_default-audience"
                and scene.render.resolution_x == REVIEW_WIDTH
                and scene.render.resolution_y == REVIEW_HEIGHT
                and scene.render.filepath.startswith("//")
                and all(item.render.filepath.startswith("//") for item in bpy.data.scenes)
            ),
            "evidence": {
                "activeCamera": scene.camera.name if scene and scene.camera else None,
                "resolution": [scene.render.resolution_x, scene.render.resolution_y] if scene else None,
                "sceneRenderPaths": {item.name: item.render.filepath for item in bpy.data.scenes},
            },
        },
    }
    if not all(item["passed"] for item in checks.values()):
        print(json.dumps(checks, indent=2))
        raise AssertionError("One or more Blender Gate 2 checks failed")
    snapshot = {
        "sceneId": contract["sceneId"],
        "blenderVersion": bpy.app.version_string,
        "blendPath": rel(BLEND_PATH),
        "checks": checks,
    }
    write_json(BLENDER_SNAPSHOT_PATH, snapshot)
    print(json.dumps(snapshot, indent=2))


def verify_outer() -> dict[str, Any]:
    import numpy as np

    contract = load_json(MANIFEST_PATH)
    required = [
        Path(__file__).resolve(),
        STUDY_PATH,
        RESEARCH_PATH,
        GATE1_REPORT_PATH,
        MANIFEST_PATH,
        TERRAIN_DATA_PATH,
        SIMULATOR_THICKNESS_PATH,
        BLEND_PATH,
        GLB_PATH,
        CONTACT_SHEET_PATH,
        ORBIT_STRIP_PATH,
        ORBIT_VIDEO_PATH,
        *(GATE_DIR / name for name in REVIEW_IMAGE_NAMES),
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing Gate 2 artifacts: {missing}")
    run_blender("--blender-verify", blend=BLEND_PATH)
    blender_snapshot = load_json(BLENDER_SNAPSHOT_PATH)
    glb, glb_binary = parse_glb(GLB_PATH)
    glb_node_names = [node.get("name") for node in glb.get("nodes", [])]
    required_nodes = {
        "EMBER_WorldRoot",
        "EMBER_Terrain",
        "EMBER_LavaSimulatorDeposit",
        "EMBER_PerformerProxy",
        "EMBER_TalusApron",
        "EMBER_SourceFissure",
        "EMBER_SourceRampart",
        "EMBER_Camera_plan",
        *(f"EMBER_Camera_{item['id']}" for item in contract["reviewCameras"]),
    }
    if not required_nodes.issubset(set(glb_node_names)):
        raise AssertionError(f"Review GLB lacks required nodes: {required_nodes - set(glb_node_names)}")
    glb_nodes = {node.get("name"): node for node in glb.get("nodes", []) if node.get("name")}
    terrain_extras = glb_nodes.get("EMBER_Terrain", {}).get("extras", {})
    glb_camera_contracts: dict[str, Any] = {}
    for camera_spec in contract["reviewCameras"]:
        node_name = f"EMBER_Camera_{camera_spec['id']}"
        node = glb_nodes.get(node_name, {})
        camera_index = node.get("camera")
        perspective = (
            glb.get("cameras", [])[int(camera_index)].get("perspective", {})
            if isinstance(camera_index, int) and camera_index < len(glb.get("cameras", []))
            else {}
        )
        vertical_fov = math.degrees(float(perspective.get("yfov", 0.0)))
        expected_fov = float(camera_spec["verticalFovDegrees"])
        aspect = perspective.get("aspectRatio")
        # Blender's glTF exporter converts the top-level camera nodes back to
        # the manifest's runtime (x, y, z) coordinates.
        expected_position = tuple(float(value) for value in camera_spec["positionWorldXYZ"])
        expected_target = tuple(float(value) for value in camera_spec["targetWorldXYZ"])
        actual_position = tuple(float(value) for value in node.get("translation", (math.inf, math.inf, math.inf)))
        actual_rotation = tuple(float(value) for value in node.get("rotation", (0.0, 0.0, 0.0, 1.0)))
        position_error = math.sqrt(sum((actual - expected) ** 2 for actual, expected in zip(actual_position, expected_position)))
        expected_direction_raw = tuple(target - position for target, position in zip(expected_target, actual_position))
        expected_direction_length = math.sqrt(sum(value * value for value in expected_direction_raw))
        expected_direction = tuple(value / expected_direction_length for value in expected_direction_raw)
        actual_direction_raw = quaternion_rotate_vector(actual_rotation, (0.0, 0.0, -1.0))
        actual_direction_length = math.sqrt(sum(value * value for value in actual_direction_raw))
        actual_direction = tuple(value / actual_direction_length for value in actual_direction_raw)
        aim_dot = max(-1.0, min(1.0, sum(actual * expected for actual, expected in zip(actual_direction, expected_direction))))
        aim_error = math.degrees(math.acos(aim_dot))
        eye_to_target_distance = expected_direction_length
        runtime_distance_ok = not camera_spec.get("runtimeEquivalent") or eye_to_target_distance <= 25.000001
        camera_role_ok = node.get("extras", {}).get("ember_role") == "registered-review-camera"
        glb_camera_contracts[camera_spec["id"]] = {
            "passed": (
                position_error <= 1e-5
                and aim_error <= 0.03
                and runtime_distance_ok
                and camera_role_ok
                and abs(vertical_fov - expected_fov) <= 1e-4
                and (aspect is None or abs(float(aspect) - REVIEW_WIDTH / REVIEW_HEIGHT) <= 1e-4)
            ),
            "runtimeEquivalent": bool(camera_spec.get("runtimeEquivalent")),
            "eyeToTargetDistanceMeters": round(eye_to_target_distance, 6),
            "positionErrorMeters": round(position_error, 9),
            "aimErrorDegrees": round(aim_error, 9),
            "verticalFovDegrees": round(vertical_fov, 6),
            "expectedVerticalFovDegrees": expected_fov,
            "aspectRatio": aspect,
        }
    diagnostic_nodes_absent = not {"EMBER_ActionEnvelope", "EMBER_CollapseGuide"}.intersection(glb_node_names)
    required_geometry_nodes = {
        "EMBER_Terrain",
        "EMBER_LavaSimulatorDeposit",
        "EMBER_PerformerProxy",
        "EMBER_TalusApron",
        "EMBER_SourceFissure",
        "EMBER_SourceRampart",
    }
    geometry_nodes_have_meshes = all(isinstance(glb_nodes.get(name, {}).get("mesh"), int) for name in required_geometry_nodes)
    punctual_lights = glb.get("extensions", {}).get("KHR_lights_punctual", {}).get("lights", [])
    dimensions = {rel(path): list(png_dimensions(path)) for path in (GATE_DIR / name for name in REVIEW_IMAGE_NAMES)}
    if png_dimensions(CONTACT_SHEET_PATH) != (3840, 2160):
        raise AssertionError("Gate 2 contact sheet must be 3840x2160")

    artifacts = {
        rel(path): {"sha256": sha256_path(path), "byteLength": path.stat().st_size}
        for path in required
    }
    study = load_geology_study()
    simulator = read_numpy_grid(
        SIMULATOR_THICKNESS_PATH,
        int(contract["simulatorDeposit"]["rows"]),
        int(contract["simulatorDeposit"]["columns"]),
    )
    active = simulator > float(contract["simulatorDeposit"]["activeThicknessThresholdMeters"])
    active_rows, active_columns = np.nonzero(active)
    active_x = float(study.WORLD_X[0]) + active_columns.astype(float)
    active_z = float(study.WORLD_Z[0]) + active_rows.astype(float)
    cell_half_extent = float(contract["simulatorDeposit"]["cellSizeMeters"]) * 0.5
    measured_support_distance = float(
        np.hypot(
            np.maximum(np.abs(active_x) - cell_half_extent, 0.0),
            np.maximum(np.abs(active_z) - cell_half_extent, 0.0),
        ).min()
    )
    reported_support_distance = float(contract["simulatorDeposit"]["minimumVisibleSupportDistanceMeters"])
    clearance = float(contract["simulatorDeposit"]["clearanceBeyondActionEnvelopeMeters"])
    measured_clearance = measured_support_distance - float(contract["performerContract"]["actionRadiusMeters"])

    terrain_values = read_float_grid(contract["terrain"])
    deposit_values = read_float_grid(contract["simulatorDeposit"])
    bounds = contract["worldBoundsMeters"]

    def decoded_mesh(node_name: str) -> tuple[list[tuple[float, float, float]], list[tuple[tuple[float, float, float], ...]]]:
        node = glb_nodes[node_name]
        mesh = glb["meshes"][int(node["mesh"])]
        all_positions: list[tuple[float, float, float]] = []
        all_triangles: list[tuple[tuple[float, float, float], ...]] = []
        for primitive in mesh["primitives"]:
            positions = [
                (float(value[0]), float(value[1]), float(value[2]))
                for value in glb_accessor_values(glb, glb_binary, int(primitive["attributes"]["POSITION"]))
            ]
            indices = [int(value[0]) for value in glb_accessor_values(glb, glb_binary, int(primitive["indices"]))]
            if len(indices) % 3:
                raise AssertionError(f"GLB mesh {node_name} contains a non-triangle index count")
            all_positions.extend(positions)
            all_triangles.extend(tuple(positions[index] for index in indices[offset : offset + 3]) for offset in range(0, len(indices), 3))
        return all_positions, all_triangles

    terrain_positions, terrain_triangles = decoded_mesh("EMBER_Terrain")
    terrain_sample_keys: set[tuple[int, int]] = set()
    terrain_coordinate_contract = True
    terrain_height_errors: list[float] = []
    terrain_columns = int(contract["terrain"]["columns"])
    terrain_rows = int(contract["terrain"]["rows"])
    terrain_cell = float(contract["terrain"]["cellSizeMeters"])
    for x, z, y in terrain_positions:
        column_value = (x - float(bounds["minX"])) / terrain_cell
        row_value = (z - float(bounds["minZ"])) / terrain_cell
        column = int(round(column_value))
        row = int(round(row_value))
        if (
            abs(column_value - column) > 1e-5
            or abs(row_value - row) > 1e-5
            or not (0 <= column < terrain_columns and 0 <= row < terrain_rows)
        ):
            terrain_coordinate_contract = False
            continue
        terrain_sample_keys.add((row, column))
        # Mesh vertices remain under the +90-degree world root. The exporter
        # stores their local coordinates as (world x, world z, -world y).
        terrain_height_errors.append(abs(-y - float(terrain_values[row * terrain_columns + column])))
    terrain_position_bounds = {
        "minX": round(min(value[0] for value in terrain_positions), 6),
        "maxX": round(max(value[0] for value in terrain_positions), 6),
        "minZ": round(min(value[1] for value in terrain_positions), 6),
        "maxZ": round(max(value[1] for value in terrain_positions), 6),
    }
    expected_terrain_position_bounds = {
        "minX": float(bounds["minX"]),
        "maxX": float(bounds["maxX"]),
        "minZ": float(bounds["minZ"]),
        "maxZ": float(bounds["maxZ"]),
    }
    terrain_node = glb_nodes["EMBER_Terrain"]
    terrain_mesh_equivalent = (
        terrain_coordinate_contract
        and len(terrain_sample_keys) == terrain_columns * terrain_rows
        and len(terrain_triangles) == (terrain_columns - 1) * (terrain_rows - 1) * 2
        and max(terrain_height_errors, default=math.inf) <= 1e-5
        and terrain_position_bounds == expected_terrain_position_bounds
        and terrain_node.get("extras", {}).get("ember_source_data_sha256") == contract["terrain"]["dataSha256"]
        and terrain_node.get("extras", {}).get("ember_coordinate_manifest_sha256") == sha256_path(MANIFEST_PATH)
    )

    lava_positions, lava_triangles = decoded_mesh("EMBER_LavaSimulatorDeposit")
    expected_lava_centers = {
        (
            round(float(bounds["minX"]) + int(column) * float(contract["simulatorDeposit"]["cellSizeMeters"]), 6),
            round(float(bounds["minZ"]) + int(row) * float(contract["simulatorDeposit"]["cellSizeMeters"]), 6),
        )
        for row, column in zip(active_rows, active_columns)
    }
    top_triangle_counts: dict[tuple[float, float], int] = {}
    top_height_errors: list[float] = []
    top_triangle_contract = True
    top_triangle_count = 0
    support_triangle_count = 0
    deposit_columns = int(contract["simulatorDeposit"]["columns"])
    deposit_rows = int(contract["simulatorDeposit"]["rows"])
    deposit_cell = float(contract["simulatorDeposit"]["cellSizeMeters"])
    threshold = float(contract["simulatorDeposit"]["activeThicknessThresholdMeters"])
    for triangle in lava_triangles:
        (ax, az, _), (bx, bz, _), (cx, cz, _) = triangle
        projected_double_area = abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax))
        if projected_double_area <= 1e-6:
            support_triangle_count += 1
            continue
        top_triangle_count += 1
        min_x, max_x = min(ax, bx, cx), max(ax, bx, cx)
        min_z, max_z = min(az, bz, cz), max(az, bz, cz)
        center_x = (min_x + max_x) * 0.5
        center_z = (min_z + max_z) * 0.5
        center = (round(center_x, 6), round(center_z, 6))
        column = int(round((center_x - float(bounds["minX"])) / deposit_cell))
        row = int(round((center_z - float(bounds["minZ"])) / deposit_cell))
        if (
            abs((max_x - min_x) - deposit_cell) > 1e-5
            or abs((max_z - min_z) - deposit_cell) > 1e-5
            or abs(projected_double_area - deposit_cell * deposit_cell) > 1e-5
            or center not in expected_lava_centers
            or not (0 <= row < deposit_rows and 0 <= column < deposit_columns)
        ):
            top_triangle_contract = False
            continue
        thickness = float(deposit_values[row * deposit_columns + column])
        if thickness <= threshold:
            top_triangle_contract = False
        top_triangle_counts[center] = top_triangle_counts.get(center, 0) + 1
        for x, z, y in triangle:
            expected_y = bilinear_height(terrain_values, contract["terrain"], bounds, x, z) + thickness
            top_height_errors.append(abs(-y - expected_y))
    lava_node = glb_nodes["EMBER_LavaSimulatorDeposit"]
    lava_extras = lava_node.get("extras", {})
    lava_position_bounds = {
        "minX": round(min(value[0] for value in lava_positions), 6),
        "maxX": round(max(value[0] for value in lava_positions), 6),
        "minZ": round(min(value[1] for value in lava_positions), 6),
        "maxZ": round(max(value[1] for value in lava_positions), 6),
    }
    glb_lava_mesh_equivalent = (
        top_triangle_contract
        and set(top_triangle_counts) == expected_lava_centers
        and all(count == 2 for count in top_triangle_counts.values())
        and top_triangle_count == int(contract["simulatorDeposit"]["activeCellCount"]) * 2
        and support_triangle_count == int(lava_extras.get("ember_support_face_count", -1)) * 2
        and int(lava_extras.get("ember_registered_top_face_count", -1)) == int(contract["simulatorDeposit"]["activeCellCount"])
        and max(top_height_errors, default=math.inf) <= 1e-5
        and lava_position_bounds == contract["simulatorDeposit"]["cellSupportBoundsWorldXZ"]
        and lava_extras.get("ember_source_sha256") == contract["simulatorDeposit"]["dataSha256"]
        and lava_extras.get("ember_coordinate_manifest_sha256") == sha256_path(MANIFEST_PATH)
    )

    node_indices = {node.get("name"): index for index, node in enumerate(glb.get("nodes", [])) if node.get("name")}
    root_node = glb_nodes["EMBER_WorldRoot"]
    root_children = set(int(value) for value in root_node.get("children", []))
    expected_root_rotation = (math.sqrt(0.5), 0.0, 0.0, math.sqrt(0.5))
    actual_root_rotation = tuple(float(value) for value in root_node.get("rotation", ()))
    glb_root_equivalent = (
        len(actual_root_rotation) == 4
        and max(abs(actual - expected) for actual, expected in zip(actual_root_rotation, expected_root_rotation)) <= 1e-5
        and node_indices["EMBER_Terrain"] in root_children
        and node_indices["EMBER_LavaSimulatorDeposit"] in root_children
    )
    descent = float(contract["simulatorDeposit"]["depositSectionNetDescentMeters"])
    payload = dict(contract)
    payload.pop("sourceDigests", None)
    checks = {
        "artifact-digest": {
            "passed": True,
            "evidence": f"SHA-256 and byte length recorded for {len(artifacts)} Gate 2 artifacts.",
        },
        "collision": {
            "passed": blender_snapshot["checks"]["visible-collision"]["passed"],
            "evidence": "EMBER_Terrain is the only visible collider and exports runtime-recognized tka_camera_collision=true metadata.",
        },
        "route-duration": {
            "passed": True,
            "applicable": False,
            "evidence": f"Ember is an orbit backdrop with no player route; the explicit exemption is evidenced by {rel(ORBIT_VIDEO_PATH)} plus the sampled 45-degree still set.",
        },
        "sequence-parity": {
            "passed": True,
            "applicable": False,
            "evidence": "This isolated environment graybox neither selects nor modifies a TKA sequence.",
        },
        "source-and-manifest-lock": {
            "passed": (
                sha256_path(STUDY_PATH) == contract["sourceDigests"]["terrainOwnerSha256"]
                and sha256_path(GATE1_REPORT_PATH) == contract["sourceDigests"]["gate1AmendmentReportSha256"]
                and sha256_path(RESEARCH_PATH) == contract["sourceDigests"]["researchContractSha256"]
                and canonical_digest(payload) == contract["sourceDigests"]["contractPayloadSha256"]
            ),
            "evidence": contract["sourceDigests"],
        },
        "simulator-deposit-owner": {
            "passed": blender_snapshot["checks"]["lava-footprint"]["passed"],
            "evidence": {
                "implementation": contract["sourceAuthority"]["simulatorImplementation"],
                "calibration": contract["sourceAuthority"]["simulatorCalibration"],
                "sourceSha256": contract["simulatorDeposit"]["dataSha256"],
                "activeCellCount": contract["simulatorDeposit"]["activeCellCount"],
                "activeAreaSquareMeters": contract["simulatorDeposit"]["activeAreaSquareMeters"],
            },
        },
        "downhill-drainage": {
            "passed": (
                descent > 5.0
                and contract["simulatorDeposit"]["reachesInboardTerminalBasin"]
                and not contract["simulatorDeposit"]["touchesSouthBoundaryGuard"]
                and float(contract["simulatorDeposit"]["depositSectionDownhillFraction"]) >= 0.85
                and float(contract["simulatorDeposit"]["depositSectionMaximumLocalRiseMeters"]) <= 0.5
            ),
            "evidence": {
                "depositSectionLengthMeters": contract["simulatorDeposit"]["depositSectionLengthMeters"],
                "sourceTerrainElevationMeters": contract["simulatorDeposit"]["depositSectionSourceElevationMeters"],
                "terminusTerrainElevationMeters": contract["simulatorDeposit"]["depositSectionTerminusElevationMeters"],
                "netDescentMeters": descent,
                "reachesInboardTerminalBasin": contract["simulatorDeposit"]["reachesInboardTerminalBasin"],
                "terminalBasinActiveCellCount": contract["simulatorDeposit"]["terminalBasinActiveCellCount"],
                "touchesSouthBoundaryGuard": contract["simulatorDeposit"]["touchesSouthBoundaryGuard"],
                "depositSectionDownhillFraction": contract["simulatorDeposit"]["depositSectionDownhillFraction"],
                "depositSectionMaximumLocalRiseMeters": contract["simulatorDeposit"]["depositSectionMaximumLocalRiseMeters"],
            },
        },
        "performer-clearance": {
            "passed": (
                clearance >= 2.5
                and abs(reported_support_distance - measured_support_distance) <= 1e-6
                and abs(clearance - measured_clearance) <= 1e-6
            ),
            "evidence": {
                "simulatorDepositClearanceBeyondActionEnvelopeMeters": clearance,
                "minimumVisibleSupportDistanceMeters": reported_support_distance,
                "independentlyMeasuredVisibleSupportDistanceMeters": round(measured_support_distance, 6),
                "actionRadiusMeters": contract["performerContract"]["actionRadiusMeters"],
            },
        },
        "observable-bifurcation": {
            "passed": int(contract["simulatorDeposit"]["branchedRowCount"]) >= 3,
            "evidence": {
                "branchedRowCount": contract["simulatorDeposit"]["branchedRowCount"],
                "claim": "Separated active runs prove bifurcation only; no downstream reconnection is claimed.",
                "upstreamMedianWidthMeters": contract["simulatorDeposit"]["upstreamMedianWidthMeters"],
                "upstreamWidthSamplingRuntimeZ": contract["simulatorDeposit"]["upstreamWidthSamplingRuntimeZ"],
                "downstreamMedianWidthMeters": contract["simulatorDeposit"]["downstreamMedianWidthMeters"],
                "downstreamWidthSamplingRuntimeZ": contract["simulatorDeposit"]["downstreamWidthSamplingRuntimeZ"],
                "downstreamWideningRatio": contract["simulatorDeposit"]["downstreamWideningRatio"],
            },
        },
        "evidence-raster-and-motion-integrity": {
            "passed": len(dimensions) == len(REVIEW_IMAGE_NAMES) and ORBIT_VIDEO_PATH.stat().st_size > 10_000,
            "evidence": {"stillDimensions": dimensions, "continuousOrbitBytes": ORBIT_VIDEO_PATH.stat().st_size},
        },
        "blender-source-integrity": {
            "passed": all(item["passed"] for item in blender_snapshot["checks"].values()),
            "evidence": blender_snapshot,
        },
        "glb-spatial-camera-equivalence": {
            "passed": (
                required_nodes.issubset(set(glb_node_names))
                and geometry_nodes_have_meshes
                and diagnostic_nodes_absent
                and glb_root_equivalent
                and terrain_mesh_equivalent
                and glb_lava_mesh_equivalent
                and terrain_extras.get("tka_camera_collision") is True
                and all(item["passed"] for item in glb_camera_contracts.values())
                and len(punctual_lights) >= 2
            ),
            "evidence": {
                "nodes": glb_node_names,
                "diagnosticNodesExcluded": diagnostic_nodes_absent,
                "geometryNodesHaveMeshes": geometry_nodes_have_meshes,
                "rootTransformAndParentingEquivalent": glb_root_equivalent,
                "terrainExtras": terrain_extras,
                "terrainMesh": {
                    "passed": terrain_mesh_equivalent,
                    "decodedPositionCount": len(terrain_positions),
                    "uniqueRegisteredSampleCount": len(terrain_sample_keys),
                    "decodedTriangleCount": len(terrain_triangles),
                    "maximumHeightErrorMeters": round(max(terrain_height_errors, default=math.inf), 9),
                    "positionBoundsWorldXZ": terrain_position_bounds,
                },
                "lavaMesh": {
                    "passed": glb_lava_mesh_equivalent,
                    "registeredCellCount": len(top_triangle_counts),
                    "topTriangleCount": top_triangle_count,
                    "supportTriangleCount": support_triangle_count,
                    "maximumTopVertexHeightErrorMeters": round(max(top_height_errors, default=math.inf), 9),
                    "positionBoundsWorldXZ": lava_position_bounds,
                    "sourceSha256": lava_extras.get("ember_source_sha256"),
                    "manifestSha256": lava_extras.get("ember_coordinate_manifest_sha256"),
                },
                "cameras": glb_camera_contracts,
                "punctualLightCount": len(punctual_lights),
                "scope": "Geometry, materials, cameras, and collision metadata. Blender world shading and area fill are intentionally not represented by glTF.",
            },
        },
    }
    if not all(item["passed"] for item in checks.values()):
        print(json.dumps(checks, indent=2))
        raise AssertionError("One or more outer Gate 2 checks failed")
    report = {
        "schemaVersion": 1,
        "sceneId": contract["sceneId"],
        "gateId": "playable-graybox",
        "status": "candidate-pending-gate-1-1-approval",
        "blenderVersion": blender_snapshot["blenderVersion"],
        "commands": {
            "build": "py -3 scripts/build-ember-geology-graybox.py build",
            "verify": "py -3 scripts/build-ember-geology-graybox.py verify",
        },
        "artifacts": artifacts,
        "checks": checks,
        "review": {
            "contactSheet": rel(CONTACT_SHEET_PATH),
            "orbitStrip": rel(ORBIT_STRIP_PATH),
            "continuousOrbit": rel(ORBIT_VIDEO_PATH),
            "cameraCount": len(contract["reviewCameras"]),
            "planIsNorthUp": True,
            "planIncludesSimulatorDeposit": True,
            "sectionVerticalExaggeration": 4.0,
        },
        "reviewAssertions": {
            "geologicalCausalityReadsFromDefaultCamera": "requires-human-review",
            "collapseReadsAsMissingVolumeAndTalus": "requires-human-review",
            "attachedOldFlowPeninsulaDoesNotReadAsAStageIsland": "requires-human-review",
            "allOrbitSectorsHaveUsefulDepthWithoutClosingTheEastHorizon": "requires-human-review",
        },
        "limitations": contract["limitations"],
    }
    write_json(REPORT_PATH, report)
    print(f"Wrote Gate 2 verification report: {rel(REPORT_PATH)}")
    for name, check in checks.items():
        print(f"PASS {name}: {check['evidence'] if isinstance(check['evidence'], str) else 'machine evidence recorded'}")
    return report


def running_inside_blender() -> bool:
    try:
        import bpy  # type: ignore  # noqa: F401

        return True
    except ImportError:
        return False


def blender_private_command() -> str | None:
    if "--" not in sys.argv:
        return None
    arguments = sys.argv[sys.argv.index("--") + 1 :]
    return arguments[0] if arguments else None


def main() -> None:
    if running_inside_blender():
        command = blender_private_command()
        if command == "--blender-build":
            blender_build()
            print("EMBER_BLENDER_COMMAND_OK --blender-build")
            return
        if command == "--blender-verify":
            blender_verify()
            print("EMBER_BLENDER_COMMAND_OK --blender-verify")
            return
        raise SystemExit("Expected --blender-build or --blender-verify after Blender's -- separator")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("manifest", "build", "verify"))
    args = parser.parse_args()
    if args.command == "manifest":
        build_manifest()
        print(f"Wrote coordinate manifest: {rel(MANIFEST_PATH)}")
        return
    if args.command == "build":
        contract = build_manifest()
        run_blender("--blender-build")
        annotate_plan()
        annotate_section(contract)
        compose_orbit_strip()
        compose_orbit_animation()
        compose_contact_sheet(contract)
        verify_outer()
        return
    verify_outer()


if __name__ == "__main__":
    main()
