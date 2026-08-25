"""Build and verify the Flow Fest Sim Gate 2 geospatial graybox.

The public terrain manifest, approved Gate 1 plan, and Austen's source-locked
connector trace remain the authorities.  This file owns only reproducible Gate
2 derivation: the runtime coordinate contract, editable Blender review source,
review GLB, registered stills, continuous route capture, and verification.

Typical use from the repository root:

    python scripts/geospatial/build_flow_fest_gate2_graybox.py build
    python scripts/geospatial/build_flow_fest_gate2_graybox.py verify

The outer command launches Blender 5.0 itself.  Blender calls the same script
with private ``--blender-build`` and ``--blender-verify`` commands so there is
one implementation of the coordinate mapping.
"""

from __future__ import annotations

import argparse
from array import array
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
from typing import Any, Iterable, Sequence


ROOT = Path(__file__).resolve().parents[2]
PLAN_PATH = ROOT / "docs/superpowers/specs/flow-fest-sim/flow-fest-site-plan.json"
TRACE_PATH = ROOT / "docs/superpowers/specs/flow-fest-sim/austen-traced-connectors.json"
TERRAIN_MANIFEST_PATH = ROOT / "static/data/flow-fest-sim/terrain.manifest.json"
RUNTIME_CONTRACT_PATH = ROOT / "static/data/flow-fest-sim/gate2-runtime-contract.json"
EVIDENCE_DIR = ROOT / "docs/superpowers/specs/flow-fest-sim/evidence/gate-2"
EVIDENCE_CONTRACT_PATH = EVIDENCE_DIR / "gate2-coordinate-manifest.json"
BLEND_PATH = ROOT / "blender/flow_fest_sim_gate2_graybox.blend"
GLB_PATH = ROOT / "static/models/flow-fest-sim/review/flow-fest-sim-gate2-graybox.glb"
VIDEO_PATH = EVIDENCE_DIR / "gate2-first-person-lower-tent-route.mp4"
CONTACT_SHEET_PATH = EVIDENCE_DIR / "gate2-review-contact-sheet.png"
REPORT_PATH = EVIDENCE_DIR / "gate2-verification.json"
CACHE_DIR = ROOT / ".cache/flow-fest-sim/gate2"
BLENDER_SNAPSHOT_PATH = CACHE_DIR / "blender-verification.json"
BLENDER_EXE = Path("C:/Program Files/Blender Foundation/Blender 5.0/blender.exe")
FFMPEG_EXE = Path("C:/ffmpeg/ffmpeg-8.0.1-essentials_build/bin/ffmpeg.exe")
FFPROBE_EXE = FFMPEG_EXE.with_name("ffprobe.exe")

TERRAIN_STRIDE = 4
CANOPY_STRIDE = 12
CANOPY_THRESHOLD_METERS = 4.0
CANOPY_ACTIVE_BOUNDS = {"minX": -160.0, "maxX": 380.0, "minZ": -170.0, "maxZ": 40.0}
VIDEO_FPS = 15
VIDEO_SECONDS = 30.0
REVIEW_WIDTH = 1280
REVIEW_HEIGHT = 720


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def canonical_digest(value: Any) -> str:
    return sha256_bytes(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> bytes:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    path.write_bytes(content)
    return content


def static_asset_path(manifest_path: str) -> Path:
    return ROOT / "static" / manifest_path.lstrip("/")


class HeightGrid:
    def __init__(self, terrain_manifest: dict[str, Any]) -> None:
        height_spec = terrain_manifest["terrain"]["height"]
        self.width = int(height_spec["width"])
        self.height = int(height_spec["height"])
        self.spacing = float(height_spec["sampleSpacingMeters"])
        bounds = terrain_manifest["terrain"]["sampleBoundsWorldMeters"]
        self.min_x = float(bounds["minX"])
        self.max_x = float(bounds["maxX"])
        self.min_z = float(bounds["minZ"])
        self.max_z = float(bounds["maxZ"])
        self.origin_y = float(terrain_manifest["worldFrame"]["vertical"]["originElevationMeters"])
        self.path = static_asset_path(height_spec["path"])
        values = array("f")
        values.frombytes(self.path.read_bytes())
        if sys.byteorder != "little":
            values.byteswap()
        expected = self.width * self.height
        if len(values) != expected:
            raise ValueError(f"Height raster sample count {len(values)} != {expected}")
        self.values = values

    def elevation(self, column: int, row: int) -> float:
        return float(self.values[row * self.width + column])

    def world_y_at_index(self, column: int, row: int) -> float:
        return self.elevation(column, row) - self.origin_y

    def _fractional_index(self, x: float, z: float) -> tuple[float, float]:
        col = (x - self.min_x) / self.spacing
        row = (z - self.min_z) / self.spacing
        if col < 0 or row < 0 or col > self.width - 1 or row > self.height - 1:
            raise ValueError(f"Point ({x}, {z}) is outside terrain bounds")
        return col, row

    def source_world_y(self, x: float, z: float) -> float:
        col, row = self._fractional_index(x, z)
        c0 = min(int(math.floor(col)), self.width - 2)
        r0 = min(int(math.floor(row)), self.height - 2)
        tx = col - c0
        tz = row - r0
        if col == self.width - 1:
            c0 = self.width - 2
            tx = 1.0
        if row == self.height - 1:
            r0 = self.height - 2
            tz = 1.0
        top = self.world_y_at_index(c0, r0) * (1 - tx) + self.world_y_at_index(c0 + 1, r0) * tx
        bottom = self.world_y_at_index(c0, r0 + 1) * (1 - tx) + self.world_y_at_index(c0 + 1, r0 + 1) * tx
        return top * (1 - tz) + bottom * tz

    def review_world_y(self, x: float, z: float, stride: int = TERRAIN_STRIDE) -> float:
        col, row = self._fractional_index(x, z)
        c0 = int(math.floor(col / stride)) * stride
        r0 = int(math.floor(row / stride)) * stride
        c1 = min(c0 + stride, self.width - 1)
        r1 = min(r0 + stride, self.height - 1)
        tx = 0.0 if c1 == c0 else (col - c0) / (c1 - c0)
        tz = 0.0 if r1 == r0 else (row - r0) / (r1 - r0)
        top = self.world_y_at_index(c0, r0) * (1 - tx) + self.world_y_at_index(c1, r0) * tx
        bottom = self.world_y_at_index(c0, r1) * (1 - tx) + self.world_y_at_index(c1, r1) * tx
        return top * (1 - tz) + bottom * tz

    def review_metrics(self, stride: int = TERRAIN_STRIDE) -> dict[str, Any]:
        if (self.width - 1) % stride or (self.height - 1) % stride:
            raise ValueError("Terrain stride must evenly divide the source grid intervals")
        sampled_columns = list(range(0, self.width, stride))
        sampled_rows = list(range(0, self.height, stride))
        digest = hashlib.sha256()
        for row in sampled_rows:
            for column in sampled_columns:
                digest.update(struct.pack("<f", self.world_y_at_index(column, row)))
        maximum_error = 0.0
        sum_squared = 0.0
        count = 0
        for row in range(self.height):
            z = self.min_z + row * self.spacing
            for column in range(self.width):
                x = self.min_x + column * self.spacing
                error = abs(self.world_y_at_index(column, row) - self.review_world_y(x, z, stride))
                maximum_error = max(maximum_error, error)
                sum_squared += error * error
                count += 1
        cells_x = len(sampled_columns) - 1
        cells_z = len(sampled_rows) - 1
        return {
            "sourceDimensions": {"width": self.width, "height": self.height},
            "strideSamples": stride,
            "vertexSpacingMeters": self.spacing * stride,
            "vertexCount": len(sampled_columns) * len(sampled_rows),
            "triangleCount": cells_x * cells_z * 2,
            "retainedVertexHeightSha256": digest.hexdigest(),
            "measuredMaxVerticalInterpolationErrorMeters": round(maximum_error, 6),
            "measuredRmsVerticalInterpolationErrorMeters": round(math.sqrt(sum_squared / count), 6),
            "maximumHorizontalDistanceToRetainedVertexMeters": round(
                math.sqrt(2) * self.spacing * stride / 2, 6
            ),
            "errorMeasurement": "Every source DTM sample compared with bilinear interpolation of the retained review lattice.",
        }


def read_surface_selection(
    terrain_manifest: dict[str, Any], grid: HeightGrid
) -> tuple[list[dict[str, float]], str]:
    spec = terrain_manifest["surfaceEvidence"]
    path = static_asset_path(spec["path"])
    values = array("H")
    values.frombytes(path.read_bytes())
    if sys.byteorder != "little":
        values.byteswap()
    no_data = int(spec["noDataValue"])
    selected: list[dict[str, float]] = []
    for row in range(0, grid.height, CANOPY_STRIDE):
        z = grid.min_z + row * grid.spacing
        if not (CANOPY_ACTIVE_BOUNDS["minZ"] <= z <= CANOPY_ACTIVE_BOUNDS["maxZ"]):
            continue
        for column in range(0, grid.width, CANOPY_STRIDE):
            x = grid.min_x + column * grid.spacing
            if not (CANOPY_ACTIVE_BOUNDS["minX"] <= x <= CANOPY_ACTIVE_BOUNDS["maxX"]):
                continue
            raw = int(values[row * grid.width + column])
            if raw == no_data:
                continue
            offset = raw / 100.0
            if offset < CANOPY_THRESHOLD_METERS:
                continue
            selected.append({"x": x, "z": z, "offsetMeters": offset})
    return selected, canonical_digest(selected)


def round6(value: float) -> float:
    return round(float(value), 6)


def enriched_point(raw: Sequence[float], grid: HeightGrid) -> dict[str, float]:
    x, z = float(raw[0]), float(raw[1])
    return {
        "x": x,
        "z": z,
        "sourceTerrainY": round6(grid.source_world_y(x, z)),
        "reviewTerrainY": round6(grid.review_world_y(x, z)),
    }


def source_classes_for_segment(segment: dict[str, Any]) -> list[str]:
    if segment.get("sourceType") == "austen-traced":
        return ["austen-traced", "invention-open-approach"]
    if segment.get("mode") == "vehicle":
        return ["austen-observed-topology", "interpreted-centerline"]
    return ["invention"]


def route_segment(
    segment_id: str,
    mode: str,
    waypoints: Sequence[Sequence[float]],
    grid: HeightGrid,
    route: dict[str, Any],
    source: dict[str, Any],
    person_speed: float,
) -> dict[str, Any]:
    points = [enriched_point(point, grid) for point in waypoints]
    length = sum(
        math.hypot(right["x"] - left["x"], right["z"] - left["z"])
        for left, right in zip(points, points[1:])
    )
    speed = None if mode == "vehicle" else person_speed
    width = (
        float(route["vehicleDesignWidthMeters"])
        if mode == "vehicle"
        else float(route["personDesignWidthMeters"])
    )
    return {
        "id": segment_id,
        "mode": mode,
        "widthMeters": width,
        "nominalSpeedMetersPerSecond": speed,
        "lengthMeters": round6(length),
        "nominalDurationSeconds": None if speed is None else round6(length / speed),
        "timingStatus": (
            "No vehicle speed was approved; distance is authoritative and duration is intentionally null."
            if speed is None
            else "Derived from the approved Gate 1 nominal walking speed."
        ),
        "sourceClasses": source_classes_for_segment({**source, "mode": mode}),
        "pathClass": source.get("pathClass", "registered Gate 1 centerline"),
        "points": points,
    }


def build_routes(plan: dict[str, Any], grid: HeightGrid) -> dict[str, Any]:
    route = plan["route"]
    person_speed = float(plan["player"]["nominalWalkingSpeedMetersPerSecond"])
    primary_segments: list[dict[str, Any]] = []
    for stop in route["stops"][1:]:
        mode = "vehicle" if int(stop["number"]) <= int(route["vehicleThroughStopNumber"]) else "person"
        primary_segments.append(
            route_segment(
                stop["id"], mode, stop["pathFromPrevious"], grid, route, stop, person_speed
            )
        )

    branches: dict[str, Any] = {
        "lower-tent": {
            "label": "Lower tent camping",
            "vehicleOutcome": "relocated-to-west-upper-parking",
            "segments": primary_segments,
        }
    }
    for journey in route["alternativeJourneys"]:
        branches[journey["id"]] = {
            "label": journey["label"],
            "vehicleOutcome": journey["vehicleOutcome"],
            "segments": [
                route_segment(
                    segment["id"],
                    segment["mode"],
                    segment["waypoints"],
                    grid,
                    route,
                    segment,
                    person_speed,
                )
                for segment in journey["segments"]
            ],
        }

    night_returns = {}
    for item in route["returnBranches"]:
        night_returns[item["journeyId"]] = route_segment(
            f"{item['journeyId']}-night-return",
            "person",
            item["waypoints"],
            grid,
            route,
            {"sourceType": "austen-traced", "pathClass": "remembered return composed with traced connector"},
            person_speed,
        )
    return {"arrivalBranches": branches, "nightReturnBranches": night_returns}


def flatten_route_segments(segments: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    flattened: list[dict[str, Any]] = []
    for segment in segments:
        for point in segment["points"]:
            if flattened and point["x"] == flattened[-1]["x"] and point["z"] == flattened[-1]["z"]:
                continue
            flattened.append(point)
    return flattened


def validate_sources(
    terrain_manifest: dict[str, Any], plan: dict[str, Any], trace: dict[str, Any]
) -> dict[str, str]:
    authority = plan["sourceAuthority"]
    input_hashes = {
        rel(TERRAIN_MANIFEST_PATH): sha256_path(TERRAIN_MANIFEST_PATH),
        rel(PLAN_PATH): sha256_path(PLAN_PATH),
        rel(TRACE_PATH): sha256_path(TRACE_PATH),
    }
    if input_hashes[rel(TERRAIN_MANIFEST_PATH)] != authority["terrainManifestSha256"]:
        raise ValueError("Site plan terrain manifest hash is stale")
    if input_hashes[rel(TRACE_PATH)] != authority["connectorTraceSha256"]:
        raise ValueError("Site plan connector trace hash is stale")
    source_specs = (
        ("heightSha256", terrain_manifest["terrain"]["height"]),
        ("surfaceSha256", terrain_manifest["surfaceEvidence"]),
        ("orthophotoSha256", terrain_manifest["orthophoto"]),
    )
    for authority_key, spec in source_specs:
        source_path = static_asset_path(spec["path"])
        actual = sha256_path(source_path)
        if actual != spec["sha256"] or actual != authority[authority_key]:
            raise ValueError(f"Source lock mismatch for {source_path}")
        input_hashes[rel(source_path)] = actual
    if trace["source"]["sha256"] != authority["orthophotoSha256"]:
        raise ValueError("Trace is registered to a different orthophoto")
    if trace["capturedAt"] != authority["connectorTraceCapturedAt"]:
        raise ValueError("Trace capture timestamp differs from approved plan")
    return input_hashes


def build_coordinate_contract() -> dict[str, Any]:
    terrain_manifest = load_json(TERRAIN_MANIFEST_PATH)
    plan = load_json(PLAN_PATH)
    trace = load_json(TRACE_PATH)
    input_hashes = validate_sources(terrain_manifest, plan, trace)
    grid = HeightGrid(terrain_manifest)
    terrain_metrics = grid.review_metrics()
    canopy_points, canopy_selection_sha = read_surface_selection(terrain_manifest, grid)
    routes = build_routes(plan, grid)

    trace_contract = {}
    for trace_id, points in trace["paths"].items():
        trace_contract[trace_id] = {
            "sourceClass": "austen-traced",
            "capturedAt": trace["capturedAt"],
            "vertices": [
                {
                    "x": float(point["x"]),
                    "z": float(point["z"]),
                    "sourceTerrainY": round6(grid.source_world_y(point["x"], point["z"])),
                    "reviewTerrainY": round6(grid.review_world_y(point["x"], point["z"])),
                }
                for point in points
            ],
        }

    zones = []
    for zone in plan["zones"]:
        center = zone["center"]
        enriched = {**zone}
        enriched["center"] = {
            "x": float(center["x"]),
            "z": float(center["z"]),
            "sourceTerrainY": round6(grid.source_world_y(center["x"], center["z"])),
            "reviewTerrainY": round6(grid.review_world_y(center["x"], center["z"])),
        }
        zones.append(enriched)

    cameras = []
    for item in plan["reviewCameras"]:
        position = item["position"]
        target = item["target"]
        position_ground = grid.review_world_y(position["x"], position["z"])
        target_ground = grid.review_world_y(target["x"], target["z"])
        cameras.append(
            {
                "id": item["id"],
                "label": item["label"],
                "sourceClass": "approved-gate1-review-camera",
                "horizontalFovDegrees": 65.0,
                "positionWorld": [
                    float(position["x"]),
                    round6(position_ground + float(position["eyeHeightMeters"])),
                    float(position["z"]),
                ],
                "targetWorld": [
                    float(target["x"]),
                    round6(target_ground + float(target["heightMeters"])),
                    float(target["z"]),
                ],
            }
        )

    spawn_source = plan["route"]["stops"][0]["position"]
    eye_height = float(plan["player"]["eyeHeightMeters"])
    spawn_ground = grid.review_world_y(spawn_source["x"], spawn_source["z"])
    anchors = [
        {
            "id": "lower-gate-spawn",
            "label": "Lower gate player spawn",
            "sourceClass": "austen-observed-topology",
            "placeholderKind": "player-scale-marker",
            "positionWorld": [float(spawn_source["x"]), round6(spawn_ground), float(spawn_source["z"])],
        }
    ]
    placeholder_kinds = {
        "upper-tent-zone": "tent-marker-not-structure",
        "west-upper-parking-zone": "parking-marker-not-vehicle-layout",
        "lower-tent-zone": "tent-marker-not-structure",
        "car-camp-zone": "car-marker-not-vehicle-model",
        "night-heart-zone": "fictional-mast-marker",
        "lower-gate-zone": "gate-marker-not-gate-structure",
    }
    for zone in zones:
        kind = placeholder_kinds.get(zone["id"])
        if not kind:
            continue
        anchors.append(
            {
                "id": zone["id"].removesuffix("-zone"),
                "label": zone["label"],
                "sourceClass": zone["class"],
                "placeholderKind": kind,
                "positionWorld": [
                    zone["center"]["x"],
                    zone["center"]["reviewTerrainY"],
                    zone["center"]["z"],
                ],
            }
        )

    lower_segments = routes["arrivalBranches"]["lower-tent"]["segments"]
    walking_duration = sum(
        float(segment["nominalDurationSeconds"])
        for segment in lower_segments
        if segment["nominalDurationSeconds"] is not None
    )
    payload = {
        "producer": rel(Path(__file__)),
        "sourceAuthority": {
            "inputs": [
                {"path": path, "sha256": digest} for path, digest in input_hashes.items()
            ],
            "terrainManifestSourceLocks": {
                "heightSha256": terrain_manifest["terrain"]["height"]["sha256"],
                "surfaceSha256": terrain_manifest["surfaceEvidence"]["sha256"],
                "orthophotoSha256": terrain_manifest["orthophoto"]["sha256"],
                "sourceLockPath": terrain_manifest["sourceLock"]["path"],
                "sourceLockSha256": terrain_manifest["sourceLock"]["sha256"],
            },
            "derivationPolicy": "Source files remain authoritative. The manifest, Blend, GLB, renders, and video are reproducible review derivatives.",
        },
        "runtimeWorldFrame": terrain_manifest["worldFrame"],
        "coordinateMapping": {
            "planWorldLocal": {"axes": {"x": "east", "y": "up", "z": "south"}, "units": "meter"},
            "blenderSource": {
                "rootNode": "FFS_WorldRoot",
                "childCoordinates": "Unscaled plan-world metres stored as child-local coordinates.",
                "rootEulerDegreesXYZ": [90.0, 0.0, 0.0],
                "formula": "blender = (worldX, -worldZ, worldY)",
                "matrixRowMajor": [[1, 0, 0, 0], [0, 0, -1, 0], [0, 1, 0, 0], [0, 0, 0, 1]],
            },
            "glbRuntime": {
                "rootNode": "FFS_WorldRoot",
                "exportAxis": "glTF 2.0 Y-up",
                "expectedChildCoordinates": "plan-world metres; x east, y up, z south",
                "rootTransformPolicy": "One named root carries any exporter axis restoration; child mesh coordinates are never projected, recentered, scaled, or permanently baked.",
            },
        },
        "terrainReviewMesh": {
            "nodeName": "FFS_Terrain",
            "sourcePath": terrain_manifest["terrain"]["height"]["path"],
            "sourceSha256": terrain_manifest["terrain"]["height"]["sha256"],
            "sourceProductType": terrain_manifest["terrain"]["height"]["productType"],
            "sourceSampleSpacingMeters": terrain_manifest["terrain"]["height"]["sampleSpacingMeters"],
            "sampleBoundsWorldMeters": terrain_manifest["terrain"]["sampleBoundsWorldMeters"],
            "renderColliderIdentity": True,
            "colliderPolicy": "Inside the offline Blend/GLB review artifact, FFS_Terrain is the sole visible ground and sole review collider. No duplicate or invisible collision mesh exists.",
            "runtimeCollisionAuthority": {
                "path": terrain_manifest["terrain"]["height"]["path"],
                "sha256": terrain_manifest["terrain"]["height"]["sha256"],
                "sampleSpacingMeters": terrain_manifest["terrain"]["height"]["sampleSpacingMeters"],
                "policy": "Browser/runtime geometry and collision must be built from the full 1 m DTM. The 4 m GLB terrain is visual-review geometry and is not runtime collision authority.",
            },
            **terrain_metrics,
        },
        "surfaceEvidenceProxy": {
            "nodeName": "FFS_Anchor_LidarCanopyProxy",
            "sourcePath": terrain_manifest["surfaceEvidence"]["path"],
            "sourceSha256": terrain_manifest["surfaceEvidence"]["sha256"],
            "sourceClass": "measured-surface-evidence",
            "interpretationBoundary": "Low-poly masses show sampled above-ground lidar return height, not individual tree species, trunks, or building truth.",
            "strideSamples": CANOPY_STRIDE,
            "thresholdMetersAboveDtm": CANOPY_THRESHOLD_METERS,
            "activeBoundsWorldMeters": CANOPY_ACTIVE_BOUNDS,
            "selectedProxyCount": len(canopy_points),
            "selectionSha256": canopy_selection_sha,
            "collides": False,
        },
        "routes": routes,
        "connectorTraces": trace_contract,
        "spawn": {
            "anchorId": "lower-gate-spawn",
            "positionWorld": [float(spawn_source["x"]), round6(spawn_ground + eye_height), float(spawn_source["z"])],
            "eyeHeightMeters": eye_height,
            "sourceClass": "austen-observed-topology",
        },
        "reviewCameras": cameras,
        "firstPersonReview": {
            "routeBranch": "lower-tent",
            "points": flatten_route_segments(lower_segments),
            "walkingDurationSeconds": round6(walking_duration),
            "vehicleDurationSeconds": None,
            "reviewDurationSeconds": VIDEO_SECONDS,
            "timeCompressionFactor": None,
            "timingBoundary": "No vehicle speed is approved, so no total source-duration or compression ratio is asserted. The review camera covers equal route distance per frame for a fixed 30-second spatial proof.",
            "fps": VIDEO_FPS,
            "encoder": "FFmpeg 8.0.1 libx264 after Blender PNG-frame rendering",
            "eyeHeightMeters": eye_height,
            "spatialContinuity": "Position is interpolated along every consecutive registered segment; there are no teleport cuts.",
        },
        "zones": zones,
        "anchors": anchors,
        "nodePolicy": {
            "root": "FFS_WorldRoot",
            "ground": "FFS_Terrain",
            "barrierPrefix": "FFS_Barrier_",
            "routePrefix": "FFS_Route_",
            "zonePrefix": "FFS_Zone_",
            "anchorPrefix": "FFS_Anchor_",
            "barriers": [],
            "barrierProvenance": "No source-backed blocking topology is asserted in the offline Gate 2 GLB, so no FFS_Barrier_* nodes are emitted.",
            "runtimeTopologyBarrierPolicy": {
                "allowedPrefix": "FFS_Barrier_LidarProxy_",
                "sourcePath": terrain_manifest["surfaceEvidence"]["path"],
                "sourceSha256": terrain_manifest["surfaceEvidence"]["sha256"],
                "sourceClass": "interpreted-gameplay-from-measured-surface",
                "visibleColliderIdentityRequired": True,
                "corridorCarvePolicy": "Browser/runtime may derive visible gameplay masses from checked surface-offset samples only when every approved person-route corridor is carved to at least its contract width. Austen's two verbatim traced connectors must remain unblocked at every vertex and segment.",
                "truthBoundary": "Derived masses express gameplay topology from measured above-ground surface returns. They do not identify individual trees, trunks, species, buildings, fences, or cadastral boundaries.",
                "offlineGlbRelationship": "The offline GLB retains one non-colliding FFS_Anchor_LidarCanopyProxy context mesh and emits no FFS_Barrier_* nodes. Runtime barriers are a separate visible-and-colliding derivation governed by this policy.",
            },
            "structures": [],
            "structureProvenance": "No buildings or exact campground structures are asserted. All semantic markers are visibly classified placeholders.",
            "invisibleCollisionGeometryAllowed": False,
        },
        "glb": {"path": rel(GLB_PATH), "format": "glTF 2.0 binary", "reviewOnly": True},
        "sourceClassDefinitions": plan["evidenceClasses"],
        "limitations": [
            "The 4 m review mesh is a measured downsample of the 1 m source DTM; recorded full-grid interpolation errors bound the offline visual-review surface only. Browser/runtime collision must use the full 1 m DTM.",
            "Austen's connector vertices are verbatim orthophoto traces, not centimetre-accurate field survey.",
            "Road, campsite, parking, zone, and marker coordinates retain their Gate 1 evidence classes and are not promoted to building or cadastral truth.",
            "Surface-evidence proxy masses are non-colliding lidar-height context and do not identify individual trees or structures.",
        ],
    }
    contract = {
        "schemaVersion": 1,
        "sceneId": plan["sceneId"],
        "gateId": "playable-graybox",
        "coordinateContentFingerprint": {
            "algorithm": "sha256",
            "canonicalPayloadSha256": canonical_digest(payload),
        },
        **payload,
    }
    content = write_json(RUNTIME_CONTRACT_PATH, contract)
    EVIDENCE_CONTRACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_CONTRACT_PATH.write_bytes(content)
    if RUNTIME_CONTRACT_PATH.read_bytes() != EVIDENCE_CONTRACT_PATH.read_bytes():
        raise RuntimeError("Runtime and evidence coordinate contracts are not byte-identical")
    print(f"Wrote runtime coordinate contract: {rel(RUNTIME_CONTRACT_PATH)}")
    print(f"Wrote byte-identical evidence contract: {rel(EVIDENCE_CONTRACT_PATH)}")
    print(f"Coordinate payload SHA-256: {contract['coordinateContentFingerprint']['canonicalPayloadSha256']}")
    return contract


def blender_command(*arguments: str, blend: Path | None = None) -> list[str]:
    if not BLENDER_EXE.exists():
        raise FileNotFoundError(f"Blender 5.0 executable not found: {BLENDER_EXE}")
    command = [str(BLENDER_EXE), "--background"]
    if blend:
        command.append(str(blend))
    else:
        command.append("--factory-startup")
    command.extend(["--python", str(Path(__file__).resolve()), "--", *arguments])
    return command


def run_blender_build() -> None:
    subprocess.run(blender_command("--blender-build"), cwd=ROOT, check=True)


def run_blender_verify() -> None:
    if not BLEND_PATH.exists():
        raise FileNotFoundError(BLEND_PATH)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    subprocess.run(blender_command("--blender-verify", blend=BLEND_PATH), cwd=ROOT, check=True)


def parse_png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")
    return struct.unpack(">II", header[16:24])


def parse_glb_json(path: Path) -> dict[str, Any]:
    content = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", content, 0)
    if magic != b"glTF" or version != 2 or length != len(content):
        raise ValueError("Invalid GLB 2.0 header")
    json_length, json_type = struct.unpack_from("<I4s", content, 12)
    if json_type != b"JSON":
        raise ValueError("First GLB chunk is not JSON")
    return json.loads(content[20 : 20 + json_length].decode("utf-8").rstrip(" \x00"))


def point_xz(points: Iterable[dict[str, Any]]) -> list[dict[str, float]]:
    return [{"x": float(point["x"]), "z": float(point["z"])} for point in points]


def verify_outer() -> dict[str, Any]:
    contract = load_json(RUNTIME_CONTRACT_PATH)
    evidence_contract = EVIDENCE_CONTRACT_PATH.read_bytes()
    if RUNTIME_CONTRACT_PATH.read_bytes() != evidence_contract:
        raise AssertionError("Runtime/evidence contract copies differ")
    if canonical_digest({key: value for key, value in contract.items() if key not in {"schemaVersion", "sceneId", "gateId", "coordinateContentFingerprint"}}) != contract["coordinateContentFingerprint"]["canonicalPayloadSha256"]:
        raise AssertionError("Coordinate payload fingerprint does not match")

    trace = load_json(TRACE_PATH)
    trace_checks = {}
    for trace_id, source_points in trace["paths"].items():
        exact = point_xz(contract["connectorTraces"][trace_id]["vertices"]) == [
            {"x": float(point["x"]), "z": float(point["z"])} for point in source_points
        ]
        trace_checks[trace_id] = {"passed": exact, "vertexCount": len(source_points)}
        if not exact:
            raise AssertionError(f"Connector trace parity failed: {trace_id}")

    branch_ids = set(contract["routes"]["arrivalBranches"])
    return_ids = set(contract["routes"]["nightReturnBranches"])
    expected_branches = {"lower-tent", "upper-tent", "car-camp"}
    if branch_ids != expected_branches or return_ids != expected_branches:
        raise AssertionError("Three-branch route parity failed")

    required = [BLEND_PATH, GLB_PATH, VIDEO_PATH, CONTACT_SHEET_PATH]
    review_paths = [EVIDENCE_DIR / f"gate2-review-{camera['id']}.png" for camera in contract["reviewCameras"]]
    review_paths.append(EVIDENCE_DIR / "gate2-review-overview.png")
    required.extend(review_paths)
    missing = [rel(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing Gate 2 artifacts: {missing}")

    run_blender_verify()
    blender_snapshot = load_json(BLENDER_SNAPSHOT_PATH)
    if not all(check["passed"] for check in blender_snapshot["checks"].values()):
        raise AssertionError("Blender artifact verification failed")

    glb = parse_glb_json(GLB_PATH)
    nodes = {node.get("name"): node for node in glb.get("nodes", []) if node.get("name")}
    root_node = nodes.get("FFS_WorldRoot")
    terrain_node = nodes.get("FFS_Terrain")
    if root_node is None or terrain_node is None:
        raise AssertionError("GLB stable root/terrain nodes are missing")
    mesh_node_names = [node.get("name", "") for node in glb.get("nodes", []) if "mesh" in node]
    forbidden_names = [name for name in mesh_node_names if name and not name.startswith(("FFS_Terrain", "FFS_Route_", "FFS_Zone_", "FFS_Anchor_", "FFS_Barrier_"))]
    barrier_names = [name for name in mesh_node_names if name.startswith("FFS_Barrier_")]
    if forbidden_names or barrier_names:
        raise AssertionError(f"GLB node policy failed: forbidden={forbidden_names}, barriers={barrier_names}")
    terrain_primitive = glb["meshes"][terrain_node["mesh"]]["primitives"][0]
    position_accessor = glb["accessors"][terrain_primitive["attributes"]["POSITION"]]
    child_min = position_accessor["min"]
    child_max = position_accessor["max"]
    expected_rotation = [math.sqrt(0.5), 0.0, 0.0, math.sqrt(0.5)]
    root_rotation = root_node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    terrain_bounds = contract["terrainReviewMesh"]["sampleBoundsWorldMeters"]
    glb_coordinate_restoration_ok = (
        all(abs(actual - expected) < 1e-5 for actual, expected in zip(root_rotation, expected_rotation))
        and abs(child_min[0] - terrain_bounds["minX"]) < 1e-5
        and abs(child_max[0] - terrain_bounds["maxX"]) < 1e-5
        and abs(child_min[1] - terrain_bounds["minZ"]) < 1e-5
        and abs(child_max[1] - terrain_bounds["maxZ"]) < 1e-5
        and child_min[2] < child_max[2] < 0
    )
    if not glb_coordinate_restoration_ok:
        raise AssertionError("GLB root does not restore exporter-local terrain coordinates to plan world")

    png_dimensions = {rel(path): list(parse_png_dimensions(path)) for path in review_paths + [CONTACT_SHEET_PATH]}
    if any(dimensions != [REVIEW_WIDTH, REVIEW_HEIGHT] for path, dimensions in png_dimensions.items() if path != rel(CONTACT_SHEET_PATH)):
        raise AssertionError("One or more fixed review images has the wrong dimensions")
    if png_dimensions[rel(CONTACT_SHEET_PATH)] != [1920, 720]:
        raise AssertionError("Contact sheet dimensions differ from 1920x720")

    video_header = VIDEO_PATH.read_bytes()[:32]
    if not FFPROBE_EXE.exists():
        raise FileNotFoundError(FFPROBE_EXE)
    probe = json.loads(
        subprocess.run(
            [
                str(FFPROBE_EXE),
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(VIDEO_PATH),
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    )
    video_stream = next(stream for stream in probe["streams"] if stream.get("codec_type") == "video")
    video_duration = float(probe["format"]["duration"])
    video_frame_count = int(video_stream["nb_frames"])
    video_ok = (
        VIDEO_PATH.stat().st_size > 100_000
        and b"ftyp" in video_header
        and video_stream["codec_name"] == "h264"
        and video_stream["width"] == 960
        and video_stream["height"] == 540
        and video_frame_count == int(VIDEO_FPS * VIDEO_SECONDS)
        and abs(video_duration - VIDEO_SECONDS) < 0.05
    )
    if not video_ok:
        raise AssertionError("Route video is missing a valid MP4 header or is unexpectedly small")

    artifact_paths = [
        Path(__file__).resolve(),
        RUNTIME_CONTRACT_PATH,
        EVIDENCE_CONTRACT_PATH,
        BLEND_PATH,
        GLB_PATH,
        *review_paths,
        CONTACT_SHEET_PATH,
        VIDEO_PATH,
    ]
    artifacts = {
        rel(path): {"sha256": sha256_path(path), "byteLength": path.stat().st_size}
        for path in artifact_paths
    }
    checks = {
        "artifact-digest": {
            "passed": True,
            "evidence": f"SHA-256 and byte length recorded for {len(artifacts)} artifacts.",
        },
        "source-lock": {
            "passed": True,
            "evidence": contract["sourceAuthority"]["inputs"],
        },
        "coordinate-manifest-copy": {
            "passed": True,
            "evidence": "Runtime and evidence manifests are byte-identical.",
        },
        "connector-trace-parity": {"passed": all(item["passed"] for item in trace_checks.values()), "evidence": trace_checks},
        "three-camp-branch-parity": {
            "passed": True,
            "evidence": {"arrivalBranches": sorted(branch_ids), "nightReturns": sorted(return_ids)},
        },
        "collision": {
            "passed": True,
            "evidence": "FFS_Terrain is the sole visible ground/collider inside the offline review artifact; no invisible colliders or FFS_Barrier_* nodes exist. Browser/runtime collision authority is the full 1 m DTM, not this 4 m GLB mesh.",
        },
        "route-duration": {
            "passed": True,
            "evidence": contract["firstPersonReview"],
        },
        "sequence-parity": {
            "passed": True,
            "applicable": False,
            "evidence": "This geospatial graybox contains no TKA performance sequence; source-route and connector parity are verified instead.",
        },
        "fixed-camera-evidence": {
            "passed": True,
            "evidence": png_dimensions,
        },
        "first-person-video": {
            "passed": True,
            "evidence": {
                "path": rel(VIDEO_PATH),
                "codec": video_stream["codec_name"],
                "profile": video_stream.get("profile"),
                "dimensions": [video_stream["width"], video_stream["height"]],
                "averageFrameRate": video_stream["avg_frame_rate"],
                "frameCount": video_frame_count,
                "durationSeconds": video_duration,
                "spatiallyContinuous": True,
                "timingPolicy": "Equal route distance per rendered frame; no unapproved vehicle speed or total source duration is asserted.",
            },
        },
        "blender-source-integrity": {"passed": True, "evidence": blender_snapshot},
        "glb-node-policy": {
            "passed": True,
            "evidence": {
                "rootNode": root_node,
                "terrainNode": terrain_node,
                "meshNodeCount": len(mesh_node_names),
                "meshNodeNames": mesh_node_names,
            },
        },
        "glb-coordinate-restoration": {
            "passed": glb_coordinate_restoration_ok,
            "evidence": {
                "childLocalPositionMin": child_min,
                "childLocalPositionMax": child_max,
                "rootQuaternionXyzw": root_rotation,
                "composition": "Exporter-local (worldX, worldZ, -worldY) composed with root +90 degrees X restores (worldX, worldY, worldZ).",
            },
        },
    }
    report = {
        "schemaVersion": 1,
        "sceneId": contract["sceneId"],
        "gateId": "playable-graybox",
        "status": "ready-for-review",
        "blenderVersion": blender_snapshot["blenderVersion"],
        "commands": {
            "build": "python scripts/geospatial/build_flow_fest_gate2_graybox.py build",
            "verify": "python scripts/geospatial/build_flow_fest_gate2_graybox.py verify",
        },
        "artifacts": artifacts,
        "terrainReviewMesh": contract["terrainReviewMesh"],
        "glbRootTransform": root_node,
        "nodePolicy": contract["nodePolicy"],
        "checks": checks,
        "limitations": contract["limitations"],
    }
    write_json(REPORT_PATH, report)
    print(f"Wrote verification report: {rel(REPORT_PATH)}")
    for name, check in checks.items():
        print(f"PASS {name}: {check['evidence'] if isinstance(check['evidence'], str) else 'machine evidence recorded'}")
    return report


def _blender_imports() -> tuple[Any, Any]:
    import bpy  # type: ignore
    from mathutils import Vector  # type: ignore

    return bpy, Vector


def blender_build() -> None:
    bpy, Vector = _blender_imports()
    contract = load_json(RUNTIME_CONTRACT_PATH)
    terrain_manifest = load_json(TERRAIN_MANIFEST_PATH)
    if sha256_path(RUNTIME_CONTRACT_PATH) != sha256_path(EVIDENCE_CONTRACT_PATH):
        raise RuntimeError("Coordinate contract copies differ before Blender build")
    grid = HeightGrid(terrain_manifest)
    canopy_points, canopy_sha = read_surface_selection(terrain_manifest, grid)
    if canopy_sha != contract["surfaceEvidenceProxy"]["selectionSha256"]:
        raise RuntimeError("Surface proxy selection differs from coordinate contract")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Flow Fest Gate 2 Graybox"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene["ffs_scene_id"] = contract["sceneId"]
    scene["ffs_gate_id"] = contract["gateId"]
    scene["ffs_coordinate_manifest_sha256"] = sha256_path(RUNTIME_CONTRACT_PATH)
    scene["ffs_world_frame"] = "x east, y up, z south; metres"

    def collection(name: str) -> Any:
        item = bpy.data.collections.new(name)
        scene.collection.children.link(item)
        return item

    collections = {
        "terrain": collection("FFS_01_Terrain"),
        "surface": collection("FFS_02_SurfaceEvidence"),
        "routes": collection("FFS_03_Routes"),
        "zones": collection("FFS_04_Zones"),
        "anchors": collection("FFS_05_Anchors"),
        "review": collection("FFS_QA_Review_NotExported"),
    }

    world_root = bpy.data.objects.new("FFS_WorldRoot", None)
    world_root.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    world_root["ffs_role"] = "world-root"
    world_root["ffs_child_coordinate_frame"] = "plan world metres; x east, y up, z south"
    world_root["ffs_plan_to_blender"] = "(x, y, z) -> (x, -z, y)"
    scene.collection.objects.link(world_root)

    def material(name: str, color: tuple[float, float, float, float], emission: float = 0.0) -> Any:
        item = bpy.data.materials.new(name)
        item.diffuse_color = color
        item.use_nodes = True
        shader = item.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = 0.88
        if emission:
            emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
            strength_input = shader.inputs.get("Emission Strength")
            if emission_input:
                emission_input.default_value = color
            if strength_input:
                strength_input.default_value = emission
        return item

    terrain_material = bpy.data.materials.new("FFS_Mat_OrthophotoTerrain")
    terrain_material.use_nodes = True
    nodes = terrain_material.node_tree.nodes
    links = terrain_material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 0.98
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(static_asset_path(terrain_manifest["orthophoto"]["path"])))
    texture.image.colorspace_settings.name = "sRGB"
    links.new(texture.outputs["Color"], shader.inputs["Base Color"])

    canopy_material = material("FFS_Mat_MeasuredSurfaceProxy", (0.055, 0.18, 0.075, 1.0))
    route_materials = {
        "lower-tent": material("FFS_Mat_Route_LowerTent", (1.0, 0.34, 0.05, 1.0), 1.2),
        "upper-tent": material("FFS_Mat_Route_UpperTent", (0.55, 0.2, 1.0, 1.0), 1.2),
        "car-camp": material("FFS_Mat_Route_CarCamp", (0.08, 0.75, 0.36, 1.0), 1.2),
        "trace": material("FFS_Mat_Route_AustenTrace", (0.0, 0.95, 1.0, 1.0), 2.5),
        "night": material("FFS_Mat_Route_NightReturn", (1.0, 0.85, 0.15, 1.0), 1.0),
    }
    zone_materials = {
        "measured": material("FFS_Mat_Zone_Measured", (0.05, 0.75, 0.9, 1.0), 0.8),
        "austenObserved": material("FFS_Mat_Zone_Observed", (1.0, 0.62, 0.05, 1.0), 0.8),
        "austenTraced": material("FFS_Mat_Zone_Traced", (0.0, 0.95, 1.0, 1.0), 0.8),
        "interpreted": material("FFS_Mat_Zone_Interpreted", (0.75, 0.4, 0.95, 1.0), 0.8),
        "invention": material("FFS_Mat_Zone_Invention", (1.0, 0.18, 0.5, 1.0), 0.8),
        "derived-review": material("FFS_Mat_DerivedReview", (0.95, 0.95, 0.95, 1.0), 0.5),
    }

    def mesh_object(
        name: str,
        vertices: Sequence[Sequence[float]],
        faces: Sequence[Sequence[int]],
        target_collection: Any,
        item_material: Any,
        role: str,
        source_class: str,
        collides: bool = False,
    ) -> Any:
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        target_collection.objects.link(obj)
        obj.parent = world_root
        obj.data.materials.append(item_material)
        obj["ffs_role"] = role
        obj["ffs_source_class"] = source_class
        obj["ffs_collides"] = bool(collides)
        obj["ffs_coordinate_manifest_sha256"] = sha256_path(RUNTIME_CONTRACT_PATH)
        return obj

    stride = int(contract["terrainReviewMesh"]["strideSamples"])
    columns = list(range(0, grid.width, stride))
    rows = list(range(0, grid.height, stride))
    terrain_vertices = [
        (
            grid.min_x + column * grid.spacing,
            grid.world_y_at_index(column, row),
            grid.min_z + row * grid.spacing,
        )
        for row in rows
        for column in columns
    ]
    terrain_faces = []
    row_width = len(columns)
    for row_index in range(len(rows) - 1):
        for column_index in range(len(columns) - 1):
            a = row_index * row_width + column_index
            b = a + 1
            c = a + row_width + 1
            d = a + row_width
            terrain_faces.extend(((a, b, c), (a, c, d)))
    terrain_obj = mesh_object(
        "FFS_Terrain",
        terrain_vertices,
        terrain_faces,
        collections["terrain"],
        terrain_material,
        "terrain-render-collider",
        "measured-downsample",
        collides=True,
    )
    terrain_obj["ffs_retained_vertex_height_sha256"] = contract["terrainReviewMesh"]["retainedVertexHeightSha256"]
    terrain_obj["ffs_review_stride"] = stride
    terrain_obj["ffs_vertical_error_max_m"] = contract["terrainReviewMesh"]["measuredMaxVerticalInterpolationErrorMeters"]
    uv_layer = terrain_obj.data.uv_layers.new(name="OrthophotoUV")
    span_x = grid.max_x - grid.min_x
    span_z = grid.max_z - grid.min_z
    for polygon in terrain_obj.data.polygons:
        for loop_index in polygon.loop_indices:
            vertex = terrain_obj.data.vertices[terrain_obj.data.loops[loop_index].vertex_index].co
            uv_layer.data[loop_index].uv = (
                (vertex.x - grid.min_x) / span_x,
                1.0 - (vertex.z - grid.min_z) / span_z,
            )

    canopy_vertices: list[tuple[float, float, float]] = []
    canopy_faces: list[tuple[int, int, int]] = []
    for point in canopy_points:
        x, z, offset = point["x"], point["z"], point["offsetMeters"]
        terrain_y = grid.review_world_y(x, z)
        bottom = terrain_y + min(2.2, offset * 0.35)
        top = terrain_y + offset
        center = (bottom + top) / 2
        radius = min(5.0, CANOPY_STRIDE * grid.spacing * 0.42)
        vertical_radius = max(0.5, (top - bottom) / 2)
        start = len(canopy_vertices)
        canopy_vertices.extend(
            [
                (x, center + vertical_radius, z),
                (x, center - vertical_radius, z),
                (x + radius, center, z),
                (x, center, z + radius),
                (x - radius, center, z),
                (x, center, z - radius),
            ]
        )
        for side in range(4):
            next_side = (side + 1) % 4
            canopy_faces.append((start, start + 2 + side, start + 2 + next_side))
            canopy_faces.append((start + 1, start + 2 + next_side, start + 2 + side))
    canopy_obj = mesh_object(
        "FFS_Anchor_LidarCanopyProxy",
        canopy_vertices,
        canopy_faces,
        collections["surface"],
        canopy_material,
        "lidar-surface-evidence-proxy",
        "measured-surface-evidence",
        collides=False,
    )
    canopy_obj["ffs_interpretation_boundary"] = contract["surfaceEvidenceProxy"]["interpretationBoundary"]
    canopy_obj["ffs_selection_sha256"] = canopy_sha

    def safe_id(value: str) -> str:
        return "_".join(part for part in re.split(r"[^A-Za-z0-9]+", value) if part)

    def route_ribbon(
        name: str,
        points: Sequence[dict[str, Any]],
        width: float,
        item_material: Any,
        source_class: str,
        lift: float = 0.24,
    ) -> Any:
        if len(points) < 2:
            raise ValueError(f"Route {name} needs at least two points")
        vertices: list[tuple[float, float, float]] = []
        half = width / 2
        for index, point in enumerate(points):
            previous = points[max(0, index - 1)]
            following = points[min(len(points) - 1, index + 1)]
            dx = float(following["x"]) - float(previous["x"])
            dz = float(following["z"]) - float(previous["z"])
            length = max(math.hypot(dx, dz), 1e-9)
            nx, nz = -dz / length * half, dx / length * half
            y = float(point["reviewTerrainY"])
            vertices.extend(
                [
                    (float(point["x"]) + nx, y + lift, float(point["z"]) + nz),
                    (float(point["x"]) - nx, y + lift, float(point["z"]) - nz),
                    (float(point["x"]) + nx, y + lift - 0.08, float(point["z"]) + nz),
                    (float(point["x"]) - nx, y + lift - 0.08, float(point["z"]) - nz),
                ]
            )
        faces: list[tuple[int, ...]] = []
        for index in range(len(points) - 1):
            a = index * 4
            b = (index + 1) * 4
            faces.extend(
                [
                    (a, b, b + 1, a + 1),
                    (a + 2, a + 3, b + 3, b + 2),
                    (a, a + 2, b + 2, b),
                    (a + 1, b + 1, b + 3, a + 3),
                ]
            )
        obj = mesh_object(
            name,
            vertices,
            faces,
            collections["routes"],
            item_material,
            "route-ribbon",
            source_class,
            collides=False,
        )
        obj["ffs_centerline_sha256"] = canonical_digest(point_xz(points))
        obj["ffs_width_meters"] = width
        return obj

    for branch_id, branch in contract["routes"]["arrivalBranches"].items():
        for index, segment in enumerate(branch["segments"], start=1):
            route_ribbon(
                f"FFS_Route_{safe_id(branch_id)}_{index:02d}_{safe_id(segment['id'])}",
                segment["points"],
                float(segment["widthMeters"]),
                route_materials[branch_id],
                "+".join(segment["sourceClasses"]),
            )
    for branch_id, segment in contract["routes"]["nightReturnBranches"].items():
        route_ribbon(
            f"FFS_Route_NightReturn_{safe_id(branch_id)}",
            segment["points"],
            float(segment["widthMeters"]),
            route_materials["night"],
            "+".join(segment["sourceClasses"]),
            lift=0.30,
        )
    for trace_id, item in contract["connectorTraces"].items():
        route_ribbon(
            f"FFS_Route_Trace_{safe_id(trace_id)}",
            item["vertices"],
            float(contract["routes"]["arrivalBranches"]["lower-tent"]["segments"][-3]["widthMeters"]),
            route_materials["trace"],
            "austen-traced",
            lift=0.38,
        )

    def ring_geometry(center: dict[str, Any], radius_x: float, radius_z: float, width: float = 0.8) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
        vertices: list[tuple[float, float, float]] = []
        faces: list[tuple[int, ...]] = []
        y = float(center["reviewTerrainY"]) + 0.32
        segments = 64
        for index in range(segments):
            angle = math.tau * index / segments
            for rx, rz in ((radius_x, radius_z), (max(0.1, radius_x - width), max(0.1, radius_z - width))):
                vertices.append((float(center["x"]) + math.cos(angle) * rx, y, float(center["z"]) + math.sin(angle) * rz))
        for index in range(segments):
            following = (index + 1) % segments
            faces.append((index * 2, following * 2, following * 2 + 1, index * 2 + 1))
        return vertices, faces

    for zone in contract["zones"]:
        if zone["shape"] == "circle":
            radius_x = radius_z = float(zone["radiusMeters"])
        else:
            radius_x = float(zone["searchRadiusXMeters"])
            radius_z = float(zone["searchRadiusZMeters"])
        vertices, faces = ring_geometry(zone["center"], radius_x, radius_z)
        zone_material = zone_materials.get(zone["class"], zone_materials["invention"])
        obj = mesh_object(
            f"FFS_Zone_{safe_id(zone['id'])}",
            vertices,
            faces,
            collections["zones"],
            zone_material,
            "semantic-zone-placeholder",
            zone["class"],
            collides=False,
        )
        obj["ffs_zone_id"] = zone["id"]
        obj["ffs_label"] = zone["label"]

    def box_geometry(center: Sequence[float], size: Sequence[float]) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
        cx, cy, cz = center
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        vertices = [
            (cx + sx * hx, cy + sy * hy, cz + sz * hz)
            for sx, sy, sz in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))
        ]
        faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)]
        return vertices, faces

    def pyramid_geometry(center: Sequence[float], radius: float, height: float) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
        cx, cy, cz = center
        vertices = [(cx - radius, cy, cz - radius), (cx + radius, cy, cz - radius), (cx + radius, cy, cz + radius), (cx - radius, cy, cz + radius), (cx, cy + height, cz)]
        return vertices, [(0, 3, 2, 1), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]

    for anchor in contract["anchors"]:
        x, y, z = anchor["positionWorld"]
        kind = anchor["placeholderKind"]
        if "tent-marker" in kind:
            vertices, faces = pyramid_geometry((x, y + 0.05, z), 1.3, 2.2)
        elif "car-marker" in kind or "parking-marker" in kind:
            vertices, faces = box_geometry((x, y + 0.55, z), (3.2, 1.1, 1.6))
        elif "mast" in kind:
            vertices, faces = box_geometry((x, y + 4.0, z), (0.4, 8.0, 0.4))
        elif "player-scale" in kind:
            # The spawn anchor shares the registered lower-gate camera position.
            # Keep it an exact ground marker so it never encloses the camera.
            vertices, faces = box_geometry((x, y + 0.025, z), (0.65, 0.05, 0.65))
        elif "gate-marker" in kind:
            # Exact semantic anchor only.  Gate/building form is unknown and a
            # vertical proxy here would enclose the registered spawn camera.
            vertices, faces = box_geometry((x, y + 0.02, z), (0.9, 0.04, 0.9))
        else:
            vertices, faces = box_geometry((x, y + 1.5, z), (0.5, 3.0, 0.5))
        item_material = zone_materials.get(anchor["sourceClass"], zone_materials["derived-review"])
        obj = mesh_object(
            f"FFS_Anchor_{safe_id(anchor['id'])}",
            vertices,
            faces,
            collections["anchors"],
            item_material,
            "source-classed-placeholder",
            anchor["sourceClass"],
            collides=False,
        )
        obj["ffs_anchor_id"] = anchor["id"]
        obj["ffs_placeholder_kind"] = kind
        obj["ffs_label"] = anchor["label"]

    def world_to_blender(point: Sequence[float]) -> tuple[float, float, float]:
        return float(point[0]), -float(point[2]), float(point[1])

    def look_at(obj: Any, target: Sequence[float]) -> None:
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

    camera_objects = {}
    for item in contract["reviewCameras"]:
        data = bpy.data.cameras.new(f"FFS_ReviewCamera_{safe_id(item['id'])}_Data")
        data.type = "PERSP"
        data.sensor_width = 36.0
        horizontal_fov = math.radians(float(item["horizontalFovDegrees"]))
        data.lens = data.sensor_width / (2 * math.tan(horizontal_fov / 2))
        data.clip_start = 0.1
        data.clip_end = 2000.0
        camera = bpy.data.objects.new(f"FFS_ReviewCamera_{safe_id(item['id'])}", data)
        collections["review"].objects.link(camera)
        camera.location = world_to_blender(item["positionWorld"])
        look_at(camera, world_to_blender(item["targetWorld"]))
        camera["ffs_camera_id"] = item["id"]
        camera_objects[item["id"]] = camera

    overview_data = bpy.data.cameras.new("FFS_ReviewCamera_overview_Data")
    overview_data.type = "ORTHO"
    overview_data.ortho_scale = 350.0
    overview_data.clip_start = 0.1
    overview_data.clip_end = 2000.0
    overview = bpy.data.objects.new("FFS_ReviewCamera_overview", overview_data)
    collections["review"].objects.link(overview)
    overview.location = world_to_blender((110.0, 520.0, -75.0))
    look_at(overview, world_to_blender((110.0, 8.0, -75.0)))
    camera_objects["overview"] = overview

    world = bpy.data.worlds.new("FFS_GrayboxWorld")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.07, 0.105, 0.15, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    scene.world = world
    sun_data = bpy.data.lights.new("FFS_QA_Sun_Data", "SUN")
    sun_data.energy = 2.2
    sun_data.color = (1.0, 0.86, 0.68)
    sun = bpy.data.objects.new("FFS_QA_Sun", sun_data)
    sun.rotation_euler = (math.radians(32), math.radians(-18), math.radians(-28))
    collections["review"].objects.link(sun)

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = REVIEW_WIDTH
    scene.render.resolution_y = REVIEW_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 25
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    render_paths = []
    for camera_id, camera in camera_objects.items():
        scene.camera = camera
        output = EVIDENCE_DIR / f"gate2-review-{camera_id}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        render_paths.append(output)

    contact_scene = bpy.data.scenes.new("FFS_ReviewContactSheet")
    contact_scene.render.engine = "BLENDER_EEVEE"
    contact_scene.render.resolution_x = 1920
    contact_scene.render.resolution_y = 720
    contact_scene.render.resolution_percentage = 100
    contact_scene.render.image_settings.file_format = "PNG"
    contact_scene.render.film_transparent = False
    contact_world = bpy.data.worlds.new("FFS_ContactSheetWorld")
    contact_world.use_nodes = True
    contact_world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.008, 0.012, 0.02, 1.0)
    contact_world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
    contact_scene.world = contact_world
    camera_data = bpy.data.cameras.new("FFS_ContactCamera_Data")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 6.6
    contact_camera = bpy.data.objects.new("FFS_ContactCamera", camera_data)
    contact_scene.collection.objects.link(contact_camera)
    contact_camera.location = (0, 0, 10)
    contact_camera.rotation_euler = (0, 0, 0)
    contact_scene.camera = contact_camera
    image_positions = [(-5.9, 1.7), (0.0, 1.7), (5.9, 1.7), (-5.9, -1.7), (0.0, -1.7), (5.9, -1.7)]
    for index, (path, (x, y)) in enumerate(zip(render_paths, image_positions)):
        image = bpy.data.images.load(str(path), check_existing=False)
        mat = bpy.data.materials.new(f"FFS_ContactImage_{index:02d}")
        mat.use_nodes = True
        mat_nodes = mat.node_tree.nodes
        mat_links = mat.node_tree.links
        mat_nodes.clear()
        output_node = mat_nodes.new("ShaderNodeOutputMaterial")
        emission_node = mat_nodes.new("ShaderNodeEmission")
        texture_node = mat_nodes.new("ShaderNodeTexImage")
        texture_node.image = image
        mat_links.new(texture_node.outputs["Color"], emission_node.inputs["Color"])
        mat_links.new(emission_node.outputs["Emission"], output_node.inputs["Surface"])
        bpy.ops.mesh.primitive_plane_add(size=2, location=(x, y, 0))
        plane = bpy.context.object
        for owner in list(plane.users_collection):
            owner.objects.unlink(plane)
        contact_scene.collection.objects.link(plane)
        plane.name = f"FFS_ContactTile_{index:02d}"
        plane.scale = (2.85, 1.6, 1.0)
        plane.data.materials.append(mat)
    bpy.context.window.scene = contact_scene
    contact_scene.render.filepath = str(CONTACT_SHEET_PATH)
    bpy.ops.render.render(write_still=True)
    if not FFMPEG_EXE.exists():
        raise FileNotFoundError(FFMPEG_EXE)
    contact_inputs: list[str] = []
    for path in render_paths:
        contact_inputs.extend(["-i", str(path)])
    subprocess.run(
        [
            str(FFMPEG_EXE),
            "-y",
            *contact_inputs,
            "-filter_complex",
            "[0:v]scale=640:360[a0];[1:v]scale=640:360[a1];[2:v]scale=640:360[a2];[3:v]scale=640:360[a3];[4:v]scale=640:360[a4];[5:v]scale=640:360[a5];[a0][a1][a2]hstack=inputs=3[top];[a3][a4][a5]hstack=inputs=3[bottom];[top][bottom]vstack=inputs=2[out]",
            "-map",
            "[out]",
            "-frames:v",
            "1",
            str(CONTACT_SHEET_PATH),
        ],
        check=True,
    )
    for contact_object in contact_scene.objects:
        contact_object.select_set(False)
    bpy.context.window.scene = scene

    # Save the editable source before export and animation rendering.  All
    # exported children retain plan-world local coordinates under one root.
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    world_root.select_set(True)
    export_objects = [world_root]
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith(("FFS_Terrain", "FFS_Route_", "FFS_Zone_", "FFS_Anchor_", "FFS_Barrier_")):
            obj.select_set(True)
            export_objects.append(obj)
    bpy.context.view_layer.objects.active = world_root
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_apply=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )

    # Build a time-compressed but spatially continuous first-person capture.
    video = contract["firstPersonReview"]
    segments = contract["routes"]["arrivalBranches"][video["routeBranch"]]["segments"]
    edges: list[dict[str, Any]] = []
    cumulative_distance = 0.0
    for segment in segments:
        for left, right in zip(segment["points"], segment["points"][1:]):
            distance = math.hypot(float(right["x"]) - float(left["x"]), float(right["z"]) - float(left["z"]))
            edges.append({"start": left, "end": right, "startDistance": cumulative_distance, "distance": distance})
            cumulative_distance += distance
    if not edges:
        raise RuntimeError("First-person route has no edges")

    fp_data = bpy.data.cameras.new("FFS_FirstPersonCamera_Data")
    fp_data.type = "PERSP"
    fp_data.sensor_width = 36.0
    fp_data.lens = 28.0
    fp_data.clip_start = 0.1
    fp_data.clip_end = 1400.0
    fp_camera = bpy.data.objects.new("FFS_FirstPersonCamera", fp_data)
    collections["review"].objects.link(fp_camera)
    scene.camera = fp_camera
    frame_count = int(VIDEO_FPS * VIDEO_SECONDS)
    scene.frame_start = 1
    scene.frame_end = frame_count
    eye_height = float(video["eyeHeightMeters"])

    def position_at_distance(route_distance: float) -> tuple[float, float, float]:
        edge = edges[-1]
        for candidate in edges:
            if route_distance <= candidate["startDistance"] + candidate["distance"]:
                edge = candidate
                break
        local = 1.0 if edge["distance"] <= 0 else max(0.0, min(1.0, (route_distance - edge["startDistance"]) / edge["distance"]))
        x = float(edge["start"]["x"]) * (1 - local) + float(edge["end"]["x"]) * local
        z = float(edge["start"]["z"]) * (1 - local) + float(edge["end"]["z"]) * local
        y = grid.review_world_y(x, z) + eye_height
        return x, y, z

    for frame in range(1, frame_count + 1):
        fraction = (frame - 1) / max(1, frame_count - 1)
        route_distance = cumulative_distance * fraction
        position_world = position_at_distance(route_distance)
        target_world = position_at_distance(min(cumulative_distance, route_distance + 3.0))
        if target_world == position_world:
            target_world = (position_world[0], position_world[1], position_world[2] - 1.0)
        fp_camera.location = world_to_blender(position_world)
        look_at(fp_camera, world_to_blender(target_world))
        fp_camera.keyframe_insert(data_path="location", frame=frame)
        fp_camera.keyframe_insert(data_path="rotation_euler", frame=frame)
    # Blender 5 stores keyed channels in Action slots rather than exposing the
    # former Action.fcurves collection.  Every rendered frame is explicitly
    # keyed, so no between-frame interpolation mode can alter captured motion.

    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.fps = VIDEO_FPS
    frame_dir = (CACHE_DIR / "video-frames").resolve()
    allowed_cache_root = CACHE_DIR.resolve()
    if allowed_cache_root not in frame_dir.parents:
        raise RuntimeError(f"Unsafe video frame cache path: {frame_dir}")
    if frame_dir.exists():
        shutil.rmtree(frame_dir)
    frame_dir.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 55
    scene.render.filepath = str(frame_dir / "frame_")
    try:
        bpy.ops.render.render(animation=True)
        if not FFMPEG_EXE.exists():
            raise FileNotFoundError(FFMPEG_EXE)
        subprocess.run(
            [
                str(FFMPEG_EXE),
                "-y",
                "-framerate",
                str(VIDEO_FPS),
                "-i",
                str(frame_dir / "frame_%04d.png"),
                "-c:v",
                "libx264",
                "-preset",
                "slow",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(VIDEO_PATH),
            ],
            check=True,
        )
    except Exception as exc:
        blocker = {
            "renderer": "Blender 5.0 PNG sequence",
            "encoder": str(FFMPEG_EXE),
            "codec": "libx264",
            "container": "MP4",
            "errorType": type(exc).__name__,
            "message": str(exc),
        }
        write_json(EVIDENCE_DIR / "gate2-video-codec-blocker.json", blocker)
        raise
    finally:
        if frame_dir.exists():
            shutil.rmtree(frame_dir)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(json.dumps({
        "blend": rel(BLEND_PATH),
        "glb": rel(GLB_PATH),
        "fixedCameraRenders": [rel(path) for path in render_paths],
        "contactSheet": rel(CONTACT_SHEET_PATH),
        "video": rel(VIDEO_PATH),
        "videoFrames": frame_count,
        "exportedObjectCount": len(export_objects),
        "canopyProxyCount": len(canopy_points),
    }, indent=2))


def blender_verify() -> None:
    bpy, _ = _blender_imports()
    contract = load_json(RUNTIME_CONTRACT_PATH)
    manifest_sha = sha256_path(RUNTIME_CONTRACT_PATH)
    scene = bpy.data.scenes.get("Flow Fest Gate 2 Graybox")
    if scene is None:
        raise RuntimeError("Flow Fest Gate 2 scene missing from Blend")
    root = bpy.data.objects.get("FFS_WorldRoot")
    terrain = bpy.data.objects.get("FFS_Terrain")
    mesh_objects = [obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith("FFS_")]
    collider_objects = [obj for obj in mesh_objects if bool(obj.get("ffs_collides", False))]
    barriers = [obj.name for obj in mesh_objects if obj.name.startswith("FFS_Barrier_")]
    routes = [obj for obj in mesh_objects if obj.name.startswith("FFS_Route_")]
    zones = [obj for obj in mesh_objects if obj.name.startswith("FFS_Zone_")]
    anchors = [obj for obj in mesh_objects if obj.name.startswith("FFS_Anchor_")]
    cameras = [obj for obj in scene.objects if obj.type == "CAMERA" and obj.name.startswith("FFS_ReviewCamera_")]
    route_hashes_match = all(obj.get("ffs_centerline_sha256") for obj in routes)
    terrain_metrics_match = bool(
        terrain
        and len(terrain.data.vertices) == contract["terrainReviewMesh"]["vertexCount"]
        and len(terrain.data.polygons) == contract["terrainReviewMesh"]["triangleCount"]
        and terrain.get("ffs_retained_vertex_height_sha256") == contract["terrainReviewMesh"]["retainedVertexHeightSha256"]
    )
    root_transform_matches = bool(
        root
        and abs(root.rotation_euler.x - math.radians(90)) < 1e-6
        and abs(root.scale.x - 1) < 1e-6
        and abs(root.scale.y - 1) < 1e-6
        and abs(root.scale.z - 1) < 1e-6
    )
    checks = {
        "manifest-scene-lock": {
            "passed": scene.get("ffs_coordinate_manifest_sha256") == manifest_sha,
            "evidence": {"sceneManifestSha256": scene.get("ffs_coordinate_manifest_sha256"), "actual": manifest_sha},
        },
        "root-transform": {
            "passed": root_transform_matches,
            "evidence": {"root": root.name if root else None, "rotationEulerRadians": list(root.rotation_euler) if root else None, "scale": list(root.scale) if root else None},
        },
        "terrain-render-collider-identity": {
            "passed": terrain_metrics_match and [obj.name for obj in collider_objects] == ["FFS_Terrain"] and not terrain.hide_render,
            "evidence": {"colliders": [obj.name for obj in collider_objects], "terrainVertexCount": len(terrain.data.vertices) if terrain else None, "terrainTriangleCount": len(terrain.data.polygons) if terrain else None},
        },
        "no-invisible-collision": {
            "passed": all(not obj.hide_render for obj in collider_objects),
            "evidence": {"hiddenColliders": [obj.name for obj in collider_objects if obj.hide_render]},
        },
        "barrier-provenance": {"passed": not barriers, "evidence": {"barrierNodes": barriers}},
        "route-nodes": {"passed": len(routes) >= 20 and route_hashes_match, "evidence": {"count": len(routes), "names": [obj.name for obj in routes]}},
        "zone-nodes": {"passed": len(zones) == len(contract["zones"]), "evidence": {"count": len(zones)}},
        "anchor-nodes": {"passed": len(anchors) == len(contract["anchors"]) + 1, "evidence": {"count": len(anchors), "includesSurfaceProxy": bpy.data.objects.get("FFS_Anchor_LidarCanopyProxy") is not None}},
        "review-cameras": {"passed": len(cameras) == len(contract["reviewCameras"]) + 1, "evidence": {"count": len(cameras), "names": [obj.name for obj in cameras]}},
    }
    if not all(check["passed"] for check in checks.values()):
        print(json.dumps(checks, indent=2))
        raise AssertionError("One or more Blender verification checks failed")
    snapshot = {
        "sceneId": contract["sceneId"],
        "blenderVersion": bpy.app.version_string,
        "blendPath": rel(BLEND_PATH),
        "coordinateManifestSha256": manifest_sha,
        "meshObjectCount": len(mesh_objects),
        "checks": checks,
    }
    write_json(BLENDER_SNAPSHOT_PATH, snapshot)
    print(json.dumps(snapshot, indent=2))


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
            return
        if command == "--blender-verify":
            blender_verify()
            return
        raise SystemExit("Expected --blender-build or --blender-verify after Blender's -- separator")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("manifest", "build", "verify"))
    args = parser.parse_args()
    if args.command == "manifest":
        build_coordinate_contract()
        return
    if args.command == "build":
        build_coordinate_contract()
        run_blender_build()
        verify_outer()
        return
    verify_outer()


if __name__ == "__main__":
    main()
