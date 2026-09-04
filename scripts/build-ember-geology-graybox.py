"""Build and verify Ember's Breached Rift Bench Gate 2 graybox.

The approved Gate 1 geology study remains the terrain authority. This script
derives one coordinate manifest from it, carries the benchmark simulator
footprint into Blender as a registered guide, builds an editable graybox and
review GLB, renders the complete orbit plus plan and section evidence, and
verifies the resulting artifacts.

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
GATE_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions/evidence/gate-2-geology-graybox-r1"
MANIFEST_PATH = GATE_DIR / "ember-breached-rift-bench-coordinate-manifest.json"
REPORT_PATH = GATE_DIR / "ember-breached-rift-bench-graybox-report.json"
CONTACT_SHEET_PATH = GATE_DIR / "ember-breached-rift-bench-gate2-contact-sheet.png"
TERRAIN_DATA_PATH = ROOT / "static/data/ember/review/ember-breached-rift-bench-height.f32"
SIMULATOR_MASK_PATH = ROOT / "static/data/ember/review/ember-breached-rift-bench-flowy-guide.u8"
BLEND_PATH = ROOT / "blender/ember-breached-rift-bench-graybox.blend"
GLB_PATH = ROOT / "static/models/ember/review/ember-breached-rift-bench-graybox.glb"
CACHE_DIR = ROOT / ".cache/ember/gate2"
BLENDER_SNAPSHOT_PATH = CACHE_DIR / "blender-verification.json"
BLENDER_EXE = Path("C:/Program Files/Blender Foundation/Blender 5.0/blender.exe")
SIMULATOR_OUTPUT_PATH = Path(
    "E:/tka-platform-ember-geology-sources/ember-simulator-benchmark/flowy/output/ember_breached_rift_thickness_full.asc"
)

TERRAIN_STRIDE = 2
LAVA_STRIDE = 1
GUIDE_STRIDE = 2
REVIEW_WIDTH = 1280
REVIEW_HEIGHT = 720
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
    "09-plan-simulator-guide.png",
    "10-longitudinal-section.png",
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
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


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


def read_esri_ascii(path: Path) -> tuple[Any, dict[str, float | int]]:
    import numpy as np

    if not path.exists():
        raise FileNotFoundError(
            f"Missing registered Flowy output: {path}. Run the checked-in Ember simulator benchmark first."
        )
    header: dict[str, float | int] = {}
    with path.open("r", encoding="utf-8") as handle:
        for _ in range(6):
            key, value = handle.readline().split(maxsplit=1)
            lowered = key.lower()
            header[lowered] = int(value) if lowered in {"ncols", "nrows"} else float(value)
        data = np.loadtxt(handle, dtype=np.float32)
    expected = (int(header["nrows"]), int(header["ncols"]))
    if data.shape != expected:
        raise ValueError(f"Simulator raster shape {data.shape} != {expected}")
    return np.flipud(data), header


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
    height = study.candidate_height(candidate).astype("<f4")
    simulator, simulator_header = read_esri_ascii(SIMULATOR_OUTPUT_PATH)
    if simulator.shape != height.shape:
        raise ValueError(f"Simulator grid {simulator.shape} does not match terrain {height.shape}")
    active = (simulator > 1e-5).astype("u1")

    TERRAIN_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    SIMULATOR_MASK_PATH.parent.mkdir(parents=True, exist_ok=True)
    TERRAIN_DATA_PATH.write_bytes(height.tobytes(order="C"))
    SIMULATOR_MASK_PATH.write_bytes(active.tobytes(order="C"))

    rows, columns = height.shape
    active_rows, active_columns = np.nonzero(active)
    active_x = study.WORLD_X[0] + active_columns.astype(float)
    active_z = study.WORLD_Z[0] + active_rows.astype(float)
    active_distances = np.hypot(active_x, active_z)
    source_y = study.sample_height(height, *candidate.source)
    terminus_y = study.sample_height(height, *candidate.flow_path[-1])
    cumulative, path_length = polyline_metrics(candidate.flow_path)

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

    contract: dict[str, Any] = {
        "schemaVersion": 1,
        "sceneId": "ember-breached-rift-bench",
        "gateId": "playable-graybox",
        "status": "derived-from-approved-plan",
        "sourceAuthority": {
            "approvedDirection": candidate.id,
            "terrainOwner": rel(STUDY_PATH),
            "researchContract": rel(RESEARCH_PATH),
            "simulatorGuideSource": str(SIMULATOR_OUTPUT_PATH),
            "simulatorImplementation": "Flowy",
            "simulatorRole": "Registered emplacement guide only; not final render geometry.",
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
            "centerlineWorldXZ": [list(point) for point in candidate.flow_path],
            "widthMeters": list(candidate.flow_widths),
            "pathLengthMeters": round(path_length, 6),
            "sourceTerrainElevationMeters": round(source_y, 6),
            "terminusTerrainElevationMeters": round(terminus_y, 6),
            "netDescentMeters": round(source_y - terminus_y, 6),
            "centerlineCumulativeDistanceMeters": [round(value, 6) for value in cumulative],
            "grayboxRole": "Full approved source-to-continuation footprint; final lava morphology remains Gate 4 work.",
        },
        "simulatorGuide": {
            "maskPath": rel(SIMULATOR_MASK_PATH),
            "maskSha256": sha256_path(SIMULATOR_MASK_PATH),
            "sourceSha256": sha256_path(SIMULATOR_OUTPUT_PATH),
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
            "esriHeader": simulator_header,
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
        "limitations": [
            "This is a composition and spatial-causality graybox, not a final geological surface.",
            "The Flowy raster is an uncalibrated same-DEM benchmark and is shown only as a guide.",
            "The complete lava body is a deterministic footprint derived from the approved Gate 1 centerline and widths.",
            "No production Ember asset, runtime behavior, final material, atmosphere, or Meshy object is changed.",
        ],
    }
    contract["sourceDigests"] = {
        "terrainOwnerSha256": sha256_path(STUDY_PATH),
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


def compose_contact_sheet(contract: dict[str, Any]) -> None:
    from PIL import Image, ImageDraw, ImageFont

    width, height = 3840, 2160
    canvas = Image.new("RGB", (width, height), (11, 14, 18))
    draw = ImageDraw.Draw(canvas)

    def font(size: int, bold: bool = False) -> Any:
        candidates = (
            Path("C:/Windows/Fonts/seguisb.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf") if bold else Path("C:/Windows/Fonts/arial.ttf"),
        )
        for candidate in candidates:
            if candidate.exists():
                return ImageFont.truetype(str(candidate), size=size)
        return ImageFont.load_default()

    title_font, subtitle_font, label_font = font(54, True), font(25), font(20, True)
    draw.text((66, 42), "EMBER GATE 2 · BREACHED RIFT BENCH", fill=(241, 236, 225), font=title_font)
    draw.text(
        (69, 109),
        "Editable Blender graybox · default audience + 45° orbit · imported Flowy guide · plan + 4× longitudinal section",
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
        "PLAN · CYAN = FLOWY GUIDE",
        "LONGITUDINAL SECTION · 4× VERTICAL",
    ]
    columns, rows = 4, 3
    margin_x, gap_x, gap_y = 66, 22, 25
    cell_width = (width - 2 * margin_x - gap_x * (columns - 1)) // columns
    cell_height = 565
    image_height = 515
    start_y = 174
    for index, (name, label) in enumerate(zip(REVIEW_IMAGE_NAMES, labels)):
        row, column = divmod(index, columns)
        left = margin_x + column * (cell_width + gap_x)
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
        f"{contract['lavaPlan']['pathLengthMeters']:.1f} m source-to-continuation drainage · flat diagnostic materials"
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
    mask = (ROOT / contract["simulatorGuide"]["maskPath"]).read_bytes()
    columns, rows = int(terrain["columns"]), int(terrain["rows"])
    if len(mask) != columns * rows:
        raise ValueError("Simulator guide mask size does not match the coordinate manifest")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Ember Breached Rift Bench Gate 2"
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

    world = bpy.data.worlds.new("Ember Gate 2 Diagnostic World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.012, 0.022, 1.0)
    background.inputs["Strength"].default_value = 0.22
    scene.world = world

    def collection(name: str) -> Any:
        item = bpy.data.collections.new(name)
        scene.collection.children.link(item)
        return item

    collections = {
        "terrain": collection("EMBER_01_Terrain"),
        "lava": collection("EMBER_02_LavaGraybox"),
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
        "basalt": material("EMBER_GB_Basalt", (0.095, 0.12, 0.145, 1.0), roughness=0.96),
        "basalt_dark": material("EMBER_GB_SteepScarp", (0.035, 0.048, 0.064, 1.0), roughness=0.98),
        "old_flow": material("EMBER_GB_OldFlowMass", (0.145, 0.17, 0.19, 1.0), roughness=0.93),
        "bench": material("EMBER_GB_PerformerBenchTerrain", (0.145, 0.125, 0.115, 1.0), roughness=0.97),
        "crust": material("EMBER_GB_LavaCrust", (0.11, 0.035, 0.018, 1.0), roughness=0.88),
        "molten": material("EMBER_GB_ExposedHeat", (0.75, 0.065, 0.008, 1.0), roughness=0.42, emission=4.2),
        "hot": material("EMBER_GB_HotCore", (1.0, 0.22, 0.015, 1.0), roughness=0.35, emission=6.0),
        "performer": material("EMBER_GB_Performer", (0.10, 0.62, 0.82, 1.0), roughness=0.48, emission=0.45),
        "guide": material("EMBER_GB_FlowyGuide", (0.02, 0.85, 0.94, 0.58), roughness=0.55, emission=1.2, alpha=0.58),
        "line": material("EMBER_GB_ReviewLine", (0.06, 0.68, 0.82, 1.0), roughness=0.6, emission=0.8),
        "section_rock": material("EMBER_GB_SectionRock", (0.20, 0.235, 0.25, 1.0), roughness=0.92, emission=0.32),
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
        if cx < -42.0 and cz > -25.0 and slope > 0.09:
            polygon.material_index = 1
        elif cx < -42.0 and cz > -25.0 and cy > 7.0:
            polygon.material_index = 2
        elif slope > 0.18:
            polygon.material_index = 1
        else:
            polygon.material_index = 0

    path = contract["lavaPlan"]["centerlineWorldXZ"]
    widths = contract["lavaPlan"]["widthMeters"]

    def lava_top(x: float, z: float) -> tuple[float, float, float, float]:
        distance, progress, width = nearest_path_sample(x, z, path, widths)
        ratio = min(1.0, distance / max(0.1, width * 0.5))
        thickening = 0.34 + 0.28 * progress
        thickening += 0.95 * math.exp(-0.5 * ((progress - 0.64) / 0.10) ** 2)
        thickening += 1.35 * math.exp(-0.5 * ((progress - 0.89) / 0.12) ** 2)
        edge_taper = 0.18 + 0.82 * max(0.0, 1.0 - ratio ** 1.7)
        return bilinear_height(values, terrain, bounds, x, z) + thickening * edge_taper, distance, progress, width

    lava_row_indices = sampled_indices(rows, LAVA_STRIDE)
    lava_column_indices = sampled_indices(columns, LAVA_STRIDE)
    lava_vertices: list[tuple[float, float, float]] = []
    lava_faces: list[tuple[int, int, int, int]] = []
    lava_face_materials: list[int] = []
    lava_vertex_map: dict[tuple[int, int], int] = {}
    for row_offset in range(len(lava_row_indices) - 1):
        r0, r1 = lava_row_indices[row_offset], lava_row_indices[row_offset + 1]
        center_z = float(bounds["minZ"]) + (r0 + r1) * 0.5
        for column_offset in range(len(lava_column_indices) - 1):
            c0, c1 = lava_column_indices[column_offset], lava_column_indices[column_offset + 1]
            center_x = float(bounds["minX"]) + (c0 + c1) * 0.5
            distance, progress, width = nearest_path_sample(center_x, center_z, path, widths)
            lobe_bias = 0.0
            if progress > 0.55:
                lobe_bias = 0.55 * math.sin(progress * 53.0 + center_x * 0.11) + 0.35 * math.sin(center_z * 0.19)
            if distance > width * (0.5 + 0.055 * lobe_bias):
                continue
            face: list[int] = []
            for key in ((r0, c0), (r0, c1), (r1, c1), (r1, c0)):
                if key not in lava_vertex_map:
                    z = float(bounds["minZ"]) + key[0]
                    x = float(bounds["minX"]) + key[1]
                    y, _, _, _ = lava_top(x, z)
                    lava_vertex_map[key] = len(lava_vertices)
                    lava_vertices.append((x, y + 0.035, z))
                face.append(lava_vertex_map[key])
            lava_faces.append(tuple(face))
            core_ratio = distance / max(0.1, width * 0.5)
            fissure = math.sin(center_x * 0.73 + center_z * 0.31 + progress * 41.0)
            if core_ratio < 0.18:
                lava_face_materials.append(2)
            elif core_ratio < 0.52 and fissure > 0.72:
                lava_face_materials.append(1)
            else:
                lava_face_materials.append(0)
    lava_obj = mesh_object(
        "EMBER_LavaFootprintGraybox",
        lava_vertices,
        lava_faces,
        collections["lava"],
        [mats["crust"], mats["molten"], mats["hot"]],
        "approved-plan-footprint-with-terrain-driven-thickness",
    )
    lava_obj["ember_path_length_m"] = contract["lavaPlan"]["pathLengthMeters"]
    for polygon, material_index in zip(lava_obj.data.polygons, lava_face_materials):
        polygon.material_index = material_index

    guide_vertices: list[tuple[float, float, float]] = []
    guide_faces: list[tuple[int, int, int, int]] = []
    guide_map: dict[tuple[int, int], int] = {}
    guide_rows = sampled_indices(rows, GUIDE_STRIDE)
    guide_columns = sampled_indices(columns, GUIDE_STRIDE)
    for row_offset in range(len(guide_rows) - 1):
        r0, r1 = guide_rows[row_offset], guide_rows[row_offset + 1]
        for column_offset in range(len(guide_columns) - 1):
            c0, c1 = guide_columns[column_offset], guide_columns[column_offset + 1]
            center_row, center_column = (r0 + r1) // 2, (c0 + c1) // 2
            if not mask[center_row * columns + center_column]:
                continue
            face: list[int] = []
            for key in ((r0, c0), (r0, c1), (r1, c1), (r1, c0)):
                if key not in guide_map:
                    z = float(bounds["minZ"]) + key[0]
                    x = float(bounds["minX"]) + key[1]
                    y = bilinear_height(values, terrain, bounds, x, z) + 0.22
                    guide_map[key] = len(guide_vertices)
                    guide_vertices.append((x, y, z))
                face.append(guide_map[key])
            guide_faces.append(tuple(face))
    guide_obj = mesh_object(
        "EMBER_FlowySimulatorGuide",
        guide_vertices,
        guide_faces,
        collections["guide"],
        [mats["guide"]],
        "registered-simulator-footprint-guide-not-exported",
    )
    guide_obj["ember_source_sha256"] = contract["simulatorGuide"]["sourceSha256"]
    guide_obj.hide_render = True

    def add_ico(name: str, x: float, z: float, scale: tuple[float, float, float], target: Any) -> Any:
        y = bilinear_height(values, terrain, bounds, x, z)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(x, -z, y + scale[2] * 0.32))
        obj = bpy.context.object
        obj.name = name
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        target.objects.link(obj)
        obj.data.materials.append(mats["basalt_dark"])
        obj["ember_role"] = "collapse-talus-scale-signal"
        obj["ember_collides"] = False
        return obj

    # Sparse, deterministic talus makes the western mass read as a collapsed
    # scarp rather than a giant freestanding arch. It is a scale signal only.
    for index in range(28):
        fraction = index / 27.0
        x = -94.0 + 29.0 * math.sin(index * 1.71) + 15.0 * fraction
        z = -18.0 + 146.0 * fraction + 9.0 * math.sin(index * 2.19)
        scale = (
            1.5 + 2.4 * ((index * 17) % 11) / 10.0,
            1.3 + 2.0 * ((index * 13) % 9) / 8.0,
            1.0 + 2.1 * ((index * 7) % 8) / 7.0,
        )
        add_ico(f"EMBER_Talus_{index:02d}", x, z, scale, collections["landform"])

    performer_y = float(contract["performerContract"]["originWorldXYZ"][1])
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.22, depth=1.38, location=(0.0, 0.0, performer_y + 0.69))
    performer = bpy.context.object
    performer.name = "EMBER_PerformerProxy"
    for owner in list(performer.users_collection):
        owner.objects.unlink(performer)
    collections["performer"].objects.link(performer)
    performer.data.materials.append(mats["performer"])
    performer["ember_role"] = "1.75m-performer-scale-proxy"
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.22, location=(0.0, 0.0, performer_y + 1.58))
    head = bpy.context.object
    head.name = "EMBER_PerformerHeadProxy"
    for owner in list(head.users_collection):
        owner.objects.unlink(head)
    collections["performer"].objects.link(head)
    head.data.materials.append(mats["performer"])
    head["ember_role"] = "performer-scale-proxy"

    def add_curve_circle(name: str, radius: float, target: Any) -> Any:
        curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = 0.075
        curve.bevel_resolution = 1
        spline = curve.splines.new("POLY")
        segments = 96
        spline.points.add(segments)
        for index in range(segments + 1):
            angle = math.tau * index / segments
            x, z = math.cos(angle) * radius, math.sin(angle) * radius
            y = bilinear_height(values, terrain, bounds, x, z) + 0.16
            spline.points[index].co = (x, y, z, 1.0)
        obj = bpy.data.objects.new(name, curve)
        target.objects.link(obj)
        obj.parent = world_root
        obj.data.materials.append(mats["line"])
        obj["ember_role"] = "plan-only-action-envelope"
        return obj

    action_ring = add_curve_circle(
        "EMBER_ActionEnvelope_4_5m",
        float(contract["performerContract"]["actionRadiusMeters"]),
        collections["guide"],
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
    look_at(plan_camera, world_to_blender((0.0, 0.0, 22.5)))
    plan_camera["ember_role"] = "registered-plan-camera"
    collections["review"].objects.link(plan_camera)

    GATE_DIR.mkdir(parents=True, exist_ok=True)
    guide_obj.hide_render = True
    action_ring.hide_render = True
    for camera_spec in contract["reviewCameras"]:
        scene.camera = cameras[camera_spec["id"]]
        scene.render.resolution_x = REVIEW_WIDTH
        scene.render.resolution_y = REVIEW_HEIGHT
        scene.render.filepath = str(GATE_DIR / camera_spec["reviewImage"])
        bpy.ops.render.render(write_still=True)

    guide_obj.hide_render = False
    action_ring.hide_render = False
    scene.camera = plan_camera
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.filepath = str(GATE_DIR / REVIEW_IMAGE_NAMES[9])
    bpy.ops.render.render(write_still=True)
    guide_obj.hide_render = True
    action_ring.hide_render = True

    # Longitudinal section is a second scene inside the same editable Blend.
    section = bpy.data.scenes.new("Ember Gate 2 Longitudinal Section")
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
    world_root.select_set(True)
    export_objects = [world_root, terrain_obj, lava_obj]
    for obj in export_objects[1:]:
        obj.select_set(True)
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
                "reviewImages": contract["reviewImages"],
            },
            indent=2,
        )
    )


def blender_verify() -> None:
    import bpy  # type: ignore

    contract = load_json(MANIFEST_PATH)
    scene = bpy.data.scenes.get("Ember Breached Rift Bench Gate 2")
    root = bpy.data.objects.get("EMBER_WorldRoot")
    terrain = bpy.data.objects.get("EMBER_Terrain")
    lava = bpy.data.objects.get("EMBER_LavaFootprintGraybox")
    guide = bpy.data.objects.get("EMBER_FlowySimulatorGuide")
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
            "passed": lava is not None and len(lava.data.polygons) > 2500,
            "evidence": {
                "vertexCount": len(lava.data.vertices) if lava else None,
                "faceCount": len(lava.data.polygons) if lava else None,
            },
        },
        "simulator-guide": {
            "passed": guide is not None and len(guide.data.polygons) > 50 and guide.get("ember_source_sha256") == contract["simulatorGuide"]["sourceSha256"],
            "evidence": {
                "faceCount": len(guide.data.polygons) if guide else None,
                "sourceSha256": guide.get("ember_source_sha256") if guide else None,
            },
        },
        "registered-cameras": {
            "passed": len(cameras) == len(contract["reviewCameras"]),
            "evidence": cameras,
        },
        "section-scene": {
            "passed": bpy.data.scenes.get("Ember Gate 2 Longitudinal Section") is not None,
            "evidence": "Ember Gate 2 Longitudinal Section",
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
        MANIFEST_PATH,
        TERRAIN_DATA_PATH,
        SIMULATOR_MASK_PATH,
        BLEND_PATH,
        GLB_PATH,
        CONTACT_SHEET_PATH,
        *(GATE_DIR / name for name in REVIEW_IMAGE_NAMES),
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing Gate 2 artifacts: {missing}")
    run_blender("--blender-verify", blend=BLEND_PATH)
    blender_snapshot = load_json(BLENDER_SNAPSHOT_PATH)
    glb = parse_glb_json(GLB_PATH)
    glb_node_names = [node.get("name") for node in glb.get("nodes", [])]
    required_nodes = {"EMBER_WorldRoot", "EMBER_Terrain", "EMBER_LavaFootprintGraybox"}
    if not required_nodes.issubset(set(glb_node_names)):
        raise AssertionError(f"Review GLB lacks required nodes: {required_nodes - set(glb_node_names)}")
    dimensions = {rel(path): list(png_dimensions(path)) for path in (GATE_DIR / name for name in REVIEW_IMAGE_NAMES)}
    if png_dimensions(CONTACT_SHEET_PATH) != (3840, 2160):
        raise AssertionError("Gate 2 contact sheet must be 3840x2160")

    artifacts = {
        rel(path): {"sha256": sha256_path(path), "byteLength": path.stat().st_size}
        for path in required
    }
    clearance = float(contract["simulatorGuide"]["clearanceBeyondActionEnvelopeMeters"])
    descent = float(contract["lavaPlan"]["netDescentMeters"])
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
        "terrain-source-lock": {
            "passed": sha256_path(STUDY_PATH) == contract["sourceDigests"]["terrainOwnerSha256"],
            "evidence": contract["sourceDigests"]["terrainOwnerSha256"],
        },
        "simulator-guide-import": {
            "passed": blender_snapshot["checks"]["simulator-guide"]["passed"],
            "evidence": {
                "implementation": contract["sourceAuthority"]["simulatorImplementation"],
                "sourceSha256": contract["simulatorGuide"]["sourceSha256"],
                "activeAreaSquareMeters": contract["simulatorGuide"]["activeAreaSquareMeters"],
            },
        },
        "downhill-drainage": {
            "passed": descent > 20.0,
            "evidence": {
                "pathLengthMeters": contract["lavaPlan"]["pathLengthMeters"],
                "sourceTerrainElevationMeters": contract["lavaPlan"]["sourceTerrainElevationMeters"],
                "terminusTerrainElevationMeters": contract["lavaPlan"]["terminusTerrainElevationMeters"],
                "netDescentMeters": descent,
            },
        },
        "performer-clearance": {
            "passed": clearance > 4.0,
            "evidence": {
                "simulatorGuideClearanceBeyondActionEnvelopeMeters": clearance,
                "actionRadiusMeters": contract["performerContract"]["actionRadiusMeters"],
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
        "glb-node-policy": {
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
            "cameraCount": len(contract["reviewCameras"]),
            "planIncludesSimulatorGuide": True,
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
        compose_contact_sheet(contract)
        verify_outer()
        return
    verify_outer()


if __name__ == "__main__":
    main()
