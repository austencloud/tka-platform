"""Build and verify Ember's corrected Breached Rift Bench Gate 2 R2 graybox.

The approved Gate 1.1 geology amendment remains the terrain authority. This
script derives one checkout-stable coordinate manifest from it, makes the
checked-in Flowy thickness raster the visible lava-deposit owner, builds an
editable graybox and review-equivalent GLB, renders the complete runtime orbit
plus director, north-up plan, section, and orbit-strip evidence, and verifies
the resulting artifacts.

Typical use from the repository root:

    python scripts/build-ember-geology-graybox.py build
    python scripts/build-ember-geology-graybox.py verify

The graybox is intentionally isolated from EmberScene.svelte and the existing
production asset. It does not author final materials or spend Meshy credits.
"""

from __future__ import annotations

import argparse
from array import array
import hashlib
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
    "gate-1-1-geology-amendment-r2/ember-breached-rift-bench-gate1-1-report.json"
)
GATE_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions/evidence/gate-2-geology-graybox-r2"
MANIFEST_PATH = GATE_DIR / "ember-breached-rift-bench-r2-coordinate-manifest.json"
REPORT_PATH = GATE_DIR / "ember-breached-rift-bench-r2-graybox-report.json"
CONTACT_SHEET_PATH = GATE_DIR / "ember-breached-rift-bench-r2-gate2-contact-sheet.png"
ORBIT_STRIP_PATH = GATE_DIR / "11-registered-orbit-strip.png"
TERRAIN_DATA_PATH = ROOT / "static/data/ember/review/ember-breached-rift-bench-r2-height.f32"
SIMULATOR_THICKNESS_PATH = ROOT / "static/data/ember/review/ember-breached-rift-bench-r2-flowy-thickness.f32"
BLEND_PATH = ROOT / "blender/ember-breached-rift-bench-graybox-r2.blend"
GLB_PATH = ROOT / "static/models/ember/review/ember-breached-rift-bench-graybox-r2.glb"
CACHE_DIR = ROOT / ".cache/ember/gate2-r2"
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
    height = study.candidate_height(candidate, revision="r2").astype("<f4")
    rows, columns = height.shape
    simulator = read_numpy_grid(SIMULATOR_THICKNESS_PATH, rows, columns)
    active = simulator > ACTIVE_THICKNESS_M

    TERRAIN_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    TERRAIN_DATA_PATH.write_bytes(height.tobytes(order="C"))

    active_rows, active_columns = np.nonzero(active)
    active_x = study.WORLD_X[0] + active_columns.astype(float)
    active_z = study.WORLD_Z[0] + active_rows.astype(float)
    active_distances = np.hypot(active_x, active_z)
    source_y = study.sample_height(height, *candidate.source)
    r2_path = study.R2_BREACHED_RIFT_FLOW_PATH
    terminus_y = study.sample_height(height, *r2_path[-1])
    cumulative, path_length = polyline_metrics(r2_path)
    upstream_widths = active[study.Z_VALUES >= 80.0].sum(axis=1)
    upstream_widths = upstream_widths[upstream_widths > 0]
    downstream_widths = active[study.Z_VALUES <= -70.0].sum(axis=1)
    downstream_widths = downstream_widths[downstream_widths > 0]
    upstream_median_width = float(np.median(upstream_widths)) if upstream_widths.size else 0.0
    downstream_median_width = float(np.median(downstream_widths)) if downstream_widths.size else 0.0

    cameras: list[dict[str, Any]] = [
        {
            "id": "default-audience",
            "positionWorldXYZ": [0.0, 7.0, -21.5],
            "targetWorldXYZ": [0.0, 2.7, 27.0],
            "horizontalFovDegrees": 69.0,
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
                    round(math.sin(angle) * float(study.ORBIT_RADIUS_M), 6),
                    7.0,
                    round(-math.cos(angle) * float(study.ORBIT_RADIUS_M), 6),
                ],
                "targetWorldXYZ": [0.0, 1.85, 0.0],
                "horizontalFovDegrees": 72.0,
                "reviewImage": REVIEW_IMAGE_NAMES[index],
            }
        )

    cameras.extend(
        (
            {
                "id": "director-overview",
                "positionWorldXYZ": [108.0, 76.0, -104.0],
                "targetWorldXYZ": [-34.0, 8.0, 54.0],
                "horizontalFovDegrees": 58.0,
                "reviewImage": REVIEW_IMAGE_NAMES[11],
                "reviewRole": "bird-eye-whole-scene",
            },
            {
                "id": "collapse-oblique",
                "positionWorldXYZ": [18.0, 28.0, 82.0],
                "targetWorldXYZ": [-76.0, 11.0, 94.0],
                "horizontalFovDegrees": 54.0,
                "reviewImage": REVIEW_IMAGE_NAMES[12],
                "reviewRole": "collapse-anatomy",
            },
        )
    )

    contract: dict[str, Any] = {
        "schemaVersion": 1,
        "sceneId": "ember-breached-rift-bench",
        "revisionId": "gate2-r2",
        "gateId": "playable-graybox",
        "status": "derived-from-approved-gate-1-1",
        "sourceAuthority": {
            "approvedDirection": candidate.id,
            "terrainOwner": rel(STUDY_PATH),
            "terrainRevision": "r2",
            "gate1AmendmentReport": rel(GATE1_REPORT_PATH),
            "researchContract": rel(RESEARCH_PATH),
            "simulatorDepositSource": rel(SIMULATOR_THICKNESS_PATH),
            "simulatorImplementation": "Flowy",
            "simulatorCalibration": gate1_report["simulator"]["selectedCalibration"],
            "simulatorRole": "Visible Gate 2 deposit footprint and thickness owner; final material morphology remains Gate 4 work.",
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
            "sourceWorldXZ": list(candidate.source),
            "diagnosticCenterlineWorldXZ": [list(point) for point in r2_path],
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
            "minimumCenterDistanceMeters": round(float(active_distances.min()), 6),
            "clearanceBeyondActionEnvelopeMeters": round(float(active_distances.min()) - float(study.ACTION_RADIUS_M), 6),
            "upstreamMedianWidthMeters": round(upstream_median_width, 6),
            "downstreamMedianWidthMeters": round(downstream_median_width, 6),
            "downstreamWideningRatio": round(downstream_median_width / max(1.0, upstream_median_width), 6),
            "reachesSouthContinuation": bool(float(active_z.min()) <= float(study.WORLD_Z[0] + 2.0)),
        },
        "performerContract": {
            "originWorldXYZ": [0.0, round(float(study.sample_height(height, 0.0, 0.0)), 6), 0.0],
            "heightMeters": 1.75,
            "actionRadiusMeters": float(study.ACTION_RADIUS_M),
            "orbitRadiusMeters": float(study.ORBIT_RADIUS_M),
            "walkable": False,
        },
        "compositionContract": {
            "dominantMass": candidate.dominant_mass,
            "openHorizon": candidate.open_horizon,
            "sourceToContinuation": "northwest fissure to south frame exit",
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
        "limitations": [
            "This is a composition and spatial-causality graybox, not a final geological surface.",
            "The Flowy calibration is preproduction morphology evidence, not eruption-history or hazard science.",
            "The visible lava body is generated only from the selected checked-in Flowy thickness raster.",
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


def parse_glb_json(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError(f"Invalid GLB header: {path}")
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("First GLB chunk is not JSON")
    return json.loads(data[20 : 20 + json_length].decode("utf-8").rstrip(" \t\r\n\0"))


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
    draw.text((43, 78), "orange = simulator-owned deposit", fill=(236, 134, 63, 255), font=note_font)
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
        "SOUTH CONTINUATION ↓",
        fill=(240, 171, 55, 255),
        font=label_font,
    )
    image.save(path, compress_level=6)


def compose_orbit_strip() -> None:
    from PIL import Image, ImageDraw

    tile_width, tile_height = 800, 450
    canvas = Image.new("RGB", (2400, 1500), (9, 13, 17))
    draw = ImageDraw.Draw(canvas)
    title_font = image_font(40, True)
    label_font = image_font(22, True)
    note_font = image_font(20)
    draw.text((42, 30), "EMBER GATE 2 R2 · REGISTERED ORBIT", fill=(240, 236, 226), font=title_font)
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


def compose_contact_sheet(contract: dict[str, Any]) -> None:
    from PIL import Image, ImageDraw, ImageFont

    width, height = 3840, 2160
    canvas = Image.new("RGB", (width, height), (11, 14, 18))
    draw = ImageDraw.Draw(canvas)

    title_font, subtitle_font, label_font = image_font(54, True), image_font(25), image_font(20, True)
    draw.text((66, 42), "EMBER GATE 2 R2 · BREACHED RIFT BENCH", fill=(241, 236, 225), font=title_font)
    draw.text(
        (69, 109),
        "Simulator-owned deposit · explicit breach and talus · default audience + complete orbit · north-up plan",
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
        f"{contract['lavaPlan']['pathLengthMeters']:.1f} m source-to-continuation drainage · "
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
    scene.name = "Ember Breached Rift Bench Gate 2 R2"
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

    world = bpy.data.worlds.new("Ember Gate 2 R2 Diagnostic World")
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
        "old_flow": material("EMBER_GB_OldFlowMass", (0.125, 0.145, 0.155, 1.0), roughness=0.93),
        "bench": material("EMBER_GB_PerformerBenchTerrain", (0.080, 0.074, 0.069, 1.0), roughness=0.97),
        "crust": material("EMBER_GB_SimulatorCrust", (0.105, 0.026, 0.012, 1.0), roughness=0.90),
        "molten": material("EMBER_GB_ExposedHeat", (0.48, 0.035, 0.004, 1.0), roughness=0.48, emission=1.8),
        "hot": material("EMBER_GB_HotCore", (0.82, 0.085, 0.006, 1.0), roughness=0.38, emission=3.2),
        "performer": material("EMBER_GB_Performer", (0.08, 0.55, 0.74, 1.0), roughness=0.48, emission=0.35),
        "guide": material("EMBER_GB_CollapseGuide", (0.85, 0.18, 0.08, 0.38), roughness=0.64, emission=0.55, alpha=0.38),
        "line": material("EMBER_GB_ReviewLine", (0.04, 0.62, 0.78, 1.0), roughness=0.6, emission=0.65),
        "source": material("EMBER_GB_SourceFissure", (1.0, 0.16, 0.008, 1.0), roughness=0.34, emission=7.0),
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
        [mats["basalt"], mats["basalt_dark"], mats["old_flow"], mats["bench"]],
        "approved-heightfield-and-visible-collider",
        collides=True,
    )
    terrain_obj["ember_source_data_sha256"] = terrain["dataSha256"]
    for polygon in terrain_obj.data.polygons:
        cx, cy, cz = polygon.center
        slope = 1.0 - abs(polygon.normal.y)
        if cx < -48.0 and cz > 18.0 and slope > 0.075:
            polygon.material_index = 1
        elif cx < -42.0 and cz > 12.0 and cy > 5.0:
            polygon.material_index = 2
        elif ((cx + 4.0) / 48.0) ** 2 + ((cz - 1.0) / 29.0) ** 2 < 1.0:
            polygon.material_index = 3
        elif slope > 0.14:
            polygon.material_index = 1
        else:
            polygon.material_index = 0
        polygon.use_smooth = True

    path = contract["lavaPlan"]["diagnosticCenterlineWorldXZ"]
    active_threshold = float(deposit["activeThicknessThresholdMeters"])

    def thickness_at_grid_vertex(row: int, column: int) -> float:
        samples: list[float] = []
        for rr in (row - 1, row):
            for cc in (column - 1, column):
                if 0 <= rr < rows and 0 <= cc < columns:
                    samples.append(float(thickness_values[rr * columns + cc]))
        return max(samples) if samples else 0.0

    def lava_top(x: float, z: float) -> tuple[float, float]:
        thickness = max(0.0, bilinear_height(thickness_values, deposit, bounds, x, z))
        terrain_y = bilinear_height(values, terrain, bounds, x, z)
        return terrain_y + 0.045 + thickness * 1.15, thickness

    lava_vertices: list[tuple[float, float, float]] = []
    lava_faces: list[tuple[int, int, int, int]] = []
    lava_face_materials: list[int] = []
    lava_vertex_map: dict[tuple[int, int], int] = {}
    for r0 in range(rows - 1):
        r1 = r0 + 1
        center_z = float(bounds["minZ"]) + r0 + 0.5
        for c0 in range(columns - 1):
            c1 = c0 + 1
            center_index = r0 * columns + c0
            center_thickness = float(thickness_values[center_index])
            if center_thickness <= active_threshold:
                continue
            face: list[int] = []
            for key in ((r0, c0), (r0, c1), (r1, c1), (r1, c0)):
                if key not in lava_vertex_map:
                    z = float(bounds["minZ"]) + key[0]
                    x = float(bounds["minX"]) + key[1]
                    thickness = thickness_at_grid_vertex(*key)
                    y = bilinear_height(values, terrain, bounds, x, z) + 0.045 + thickness * 1.15
                    lava_vertex_map[key] = len(lava_vertices)
                    lava_vertices.append((x, y, z))
                face.append(lava_vertex_map[key])
            lava_faces.append(tuple(face))
            center_x = float(bounds["minX"]) + c0 + 0.5
            seam = math.sin(center_x * 0.71 + center_z * 0.29) + 0.55 * math.sin(center_z * 0.83)
            if center_thickness > 0.48 and seam > 1.24:
                lava_face_materials.append(2)
            elif center_thickness > 0.30 and seam > 0.98:
                lava_face_materials.append(1)
            else:
                lava_face_materials.append(0)
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
    for polygon, material_index in zip(lava_obj.data.polygons, lava_face_materials):
        polygon.material_index = material_index

    # The plan-only polygon shows the failed rock volume as absence. The
    # visible terrain already contains the breach; this diagnostic overlay is
    # hidden from cinematic views and remains available in the GLB review.
    collapse_outline = (
        (-94.0, 154.0),
        (-79.0, 146.0),
        (-61.0, 125.0),
        (-48.0, 99.0),
        (-52.0, 76.0),
        (-69.0, 69.0),
        (-87.0, 91.0),
        (-98.0, 121.0),
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

    talus_vertices: list[tuple[float, float, float]] = []
    talus_faces: list[tuple[int, int, int]] = []
    for index in range(42):
        fraction = index / 41.0
        x = -88.0 + 31.0 * fraction + 17.0 * math.sin(index * 1.73)
        z = 48.0 + 76.0 * fraction + 12.0 * math.sin(index * 2.11)
        y = bilinear_height(values, terrain, bounds, x, z)
        sx = 1.0 + 2.8 * ((index * 17) % 13) / 12.0
        sy = 0.8 + 2.2 * ((index * 11) % 9) / 8.0
        sz = 1.0 + 2.3 * ((index * 7) % 11) / 10.0
        append_octahedron(talus_vertices, talus_faces, x, y + sy * 0.35, z, sx, sy, sz)
    talus_obj = mesh_object(
        "EMBER_TalusApron",
        talus_vertices,
        talus_faces,
        collections["landform"],
        [mats["basalt_dark"]],
        "collapse-talus-scale-signal",
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

    fissure_points = ((-76.0, 134.0), (-73.0, 137.0), (-69.0, 139.0), (-64.0, 141.0), (-58.0, 144.0))
    fissure_vertices, fissure_faces = build_strip(fissure_points, (1.2, 1.8, 2.4, 1.8, 1.1), 0.20)
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
    for index, (x, z) in enumerate(((-77.0, 138.0), (-72.0, 142.0), (-66.0, 144.0), (-59.0, 147.0), (-75.0, 132.0), (-68.0, 136.0), (-61.0, 139.0))):
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
    for level_y, radius in ((performer_y, 0.22), (performer_y + 1.36, 0.22)):
        performer_vertices.extend(
            (math.cos(math.tau * index / sides) * radius, level_y, math.sin(math.tau * index / sides) * radius)
            for index in range(sides)
        )
    for index in range(sides):
        performer_faces.append((index, (index + 1) % sides, sides + (index + 1) % sides, sides + index))
    performer_faces.extend((tuple(range(sides - 1, -1, -1)), tuple(range(sides, sides * 2))))
    append_octahedron(performer_vertices, performer_faces, 0.0, performer_y + 1.60, 0.0, 0.23, 0.25, 0.23)
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
    source_y = bilinear_height(values, terrain, bounds, -72.0, 137.0)
    source_point.location = world_to_blender((-72.0, source_y + 5.0, 137.0))
    collections["review"].objects.link(source_point)

    cameras: dict[str, Any] = {}
    for camera_spec in contract["reviewCameras"]:
        data = bpy.data.cameras.new(f"EMBER_Camera_{camera_spec['id']}_Data")
        data.type = "PERSP"
        data.sensor_width = 36.0
        horizontal_fov = math.radians(float(camera_spec["horizontalFovDegrees"]))
        data.lens = data.sensor_width / (2.0 * math.tan(horizontal_fov * 0.5))
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
    section = bpy.data.scenes.new("Ember Gate 2 R2 Longitudinal Section")
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
    cumulative, path_length = polyline_metrics(path)
    section_samples: list[tuple[float, float, float]] = []
    for sample_index in range(241):
        distance_along = path_length * sample_index / 240.0
        segment_index = len(path) - 2
        for candidate_index in range(len(cumulative) - 1):
            if distance_along <= cumulative[candidate_index + 1]:
                segment_index = candidate_index
                break
        segment_length = cumulative[segment_index + 1] - cumulative[segment_index]
        local = 0.0 if segment_length <= 1e-9 else (distance_along - cumulative[segment_index]) / segment_length
        x = float(path[segment_index][0]) * (1.0 - local) + float(path[segment_index + 1][0]) * local
        z = float(path[segment_index][1]) * (1.0 - local) + float(path[segment_index + 1][1]) * local
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

    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [
        world_root,
        terrain_obj,
        lava_obj,
        talus_obj,
        collapse_guide,
        source_fissure,
        source_rampart,
        performer,
        action_ring,
        plan_camera,
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
        export_lights=False,
        export_extras=True,
        export_apply=False,
        export_yup=True,
        export_normals=True,
        export_materials="EXPORT",
    )
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

    contract = load_json(MANIFEST_PATH)
    scene = bpy.data.scenes.get("Ember Breached Rift Bench Gate 2 R2")
    root = bpy.data.objects.get("EMBER_WorldRoot")
    terrain = bpy.data.objects.get("EMBER_Terrain")
    lava = bpy.data.objects.get("EMBER_LavaSimulatorDeposit")
    talus = bpy.data.objects.get("EMBER_TalusApron")
    collapse = bpy.data.objects.get("EMBER_CollapseGuide")
    source = bpy.data.objects.get("EMBER_SourceFissure")
    rampart = bpy.data.objects.get("EMBER_SourceRampart")
    performer = bpy.data.objects.get("EMBER_PerformerProxy")
    action = bpy.data.objects.get("EMBER_ActionEnvelope")
    plan_camera = bpy.data.objects.get("EMBER_Camera_plan")
    colliders = [
        obj.name
        for obj in scene.objects
        if obj.type == "MESH" and bool(obj.get("ember_collides", False))
    ]
    cameras = [
        obj.name
        for obj in scene.objects
        if obj.type == "CAMERA" and obj.get("ember_role") == "registered-review-camera"
    ]
    expected_terrain_vertices = len(sampled_indices(int(contract["terrain"]["columns"]), TERRAIN_STRIDE)) * len(
        sampled_indices(int(contract["terrain"]["rows"]), TERRAIN_STRIDE)
    )
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
            "passed": terrain is not None and len(terrain.data.vertices) == expected_terrain_vertices and not terrain.hide_render,
            "evidence": {
                "vertexCount": len(terrain.data.vertices) if terrain else None,
                "faceCount": len(terrain.data.polygons) if terrain else None,
                "expectedVertexCount": expected_terrain_vertices,
            },
        },
        "visible-collision": {
            "passed": colliders == ["EMBER_Terrain"] and terrain is not None and not terrain.hide_render,
            "evidence": colliders,
        },
        "lava-footprint": {
            "passed": (
                lava is not None
                and len(lava.data.polygons) == int(contract["simulatorDeposit"]["activeCellCount"])
                and lava.get("ember_source_sha256") == contract["simulatorDeposit"]["dataSha256"]
            ),
            "evidence": {
                "vertexCount": len(lava.data.vertices) if lava else None,
                "faceCount": len(lava.data.polygons) if lava else None,
                "expectedActiveCellCount": contract["simulatorDeposit"]["activeCellCount"],
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
            "passed": len(cameras) == len(contract["reviewCameras"]),
            "evidence": cameras,
        },
        "north-up-plan": {
            "passed": plan_camera is not None and abs(float(plan_camera.rotation_euler.z) - math.pi) < 1e-6,
            "evidence": list(plan_camera.rotation_euler) if plan_camera else None,
        },
        "section-scene": {
            "passed": bpy.data.scenes.get("Ember Gate 2 R2 Longitudinal Section") is not None,
            "evidence": "Ember Gate 2 R2 Longitudinal Section",
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
        *(GATE_DIR / name for name in REVIEW_IMAGE_NAMES),
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing Gate 2 artifacts: {missing}")
    run_blender("--blender-verify", blend=BLEND_PATH)
    blender_snapshot = load_json(BLENDER_SNAPSHOT_PATH)
    glb = parse_glb_json(GLB_PATH)
    glb_node_names = [node.get("name") for node in glb.get("nodes", [])]
    required_nodes = {
        "EMBER_WorldRoot",
        "EMBER_Terrain",
        "EMBER_LavaSimulatorDeposit",
        "EMBER_PerformerProxy",
        "EMBER_ActionEnvelope",
        "EMBER_TalusApron",
        "EMBER_CollapseGuide",
        "EMBER_SourceFissure",
        "EMBER_SourceRampart",
        "EMBER_Camera_plan",
        *(f"EMBER_Camera_{item['id']}" for item in contract["reviewCameras"]),
    }
    if not required_nodes.issubset(set(glb_node_names)):
        raise AssertionError(f"Review GLB lacks required nodes: {required_nodes - set(glb_node_names)}")
    dimensions = {rel(path): list(png_dimensions(path)) for path in (GATE_DIR / name for name in REVIEW_IMAGE_NAMES)}
    if png_dimensions(CONTACT_SHEET_PATH) != (3840, 2160):
        raise AssertionError("Gate 2 contact sheet must be 3840x2160")

    artifacts = {
        rel(path): {"sha256": sha256_path(path), "byteLength": path.stat().st_size}
        for path in required
    }
    clearance = float(contract["simulatorDeposit"]["clearanceBeyondActionEnvelopeMeters"])
    descent = float(contract["lavaPlan"]["netDescentMeters"])
    payload = dict(contract)
    payload.pop("sourceDigests", None)
    checks = {
        "artifact-digest": {
            "passed": True,
            "evidence": f"SHA-256 and byte length recorded for {len(artifacts)} Gate 2 artifacts.",
        },
        "collision": {
            "passed": blender_snapshot["checks"]["visible-collision"]["passed"],
            "evidence": "EMBER_Terrain is the only visible collider in the isolated graybox; no invisible barrier geometry is present.",
        },
        "route-duration": {
            "passed": True,
            "applicable": False,
            "evidence": "Ember is an orbit backdrop with no authored player route; Austen's recorded Gate 2 exemption substitutes the registered 45-degree orbit set.",
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
            "passed": descent > 10.0 and contract["simulatorDeposit"]["reachesSouthContinuation"],
            "evidence": {
                "pathLengthMeters": contract["lavaPlan"]["pathLengthMeters"],
                "sourceTerrainElevationMeters": contract["lavaPlan"]["sourceTerrainElevationMeters"],
                "terminusTerrainElevationMeters": contract["lavaPlan"]["terminusTerrainElevationMeters"],
                "netDescentMeters": descent,
                "reachesSouthContinuation": contract["simulatorDeposit"]["reachesSouthContinuation"],
            },
        },
        "performer-clearance": {
            "passed": clearance > 4.0,
            "evidence": {
                "simulatorDepositClearanceBeyondActionEnvelopeMeters": clearance,
                "actionRadiusMeters": contract["performerContract"]["actionRadiusMeters"],
            },
        },
        "downstream-widening": {
            "passed": (
                float(contract["simulatorDeposit"]["downstreamMedianWidthMeters"]) >= 9.0
                and float(contract["simulatorDeposit"]["downstreamWideningRatio"]) >= 1.25
            ),
            "evidence": {
                "upstreamMedianWidthMeters": contract["simulatorDeposit"]["upstreamMedianWidthMeters"],
                "downstreamMedianWidthMeters": contract["simulatorDeposit"]["downstreamMedianWidthMeters"],
                "downstreamWideningRatio": contract["simulatorDeposit"]["downstreamWideningRatio"],
            },
        },
        "fixed-camera-evidence": {
            "passed": len(dimensions) == len(REVIEW_IMAGE_NAMES),
            "evidence": dimensions,
        },
        "blender-source-integrity": {
            "passed": all(item["passed"] for item in blender_snapshot["checks"].values()),
            "evidence": blender_snapshot,
        },
        "glb-review-equivalence": {
            "passed": required_nodes.issubset(set(glb_node_names)),
            "evidence": glb_node_names,
        },
    }
    if not all(item["passed"] for item in checks.values()):
        print(json.dumps(checks, indent=2))
        raise AssertionError("One or more outer Gate 2 checks failed")
    report = {
        "schemaVersion": 1,
        "sceneId": contract["sceneId"],
        "gateId": "playable-graybox",
        "status": "ready-for-review",
        "blenderVersion": blender_snapshot["blenderVersion"],
        "commands": {
            "build": "python scripts/build-ember-geology-graybox.py build",
            "verify": "python scripts/build-ember-geology-graybox.py verify",
        },
        "artifacts": artifacts,
        "checks": checks,
        "review": {
            "contactSheet": rel(CONTACT_SHEET_PATH),
            "orbitStrip": rel(ORBIT_STRIP_PATH),
            "cameraCount": len(contract["reviewCameras"]),
            "planIsNorthUp": True,
            "planIncludesSimulatorDeposit": True,
            "sectionVerticalExaggeration": 4.0,
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
        compose_orbit_strip()
        compose_contact_sheet(contract)
        verify_outer()
        return
    verify_outer()


if __name__ == "__main__":
    main()
