"""Prepare one shared Ember DEM for Flowy and MrLavaLoba2.

The benchmark workspace lives outside Git because both simulators generate many
intermediate rasters. The checked-in script is the reproducible authority for
the input terrain and parameter parity.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
STUDY_SCRIPT = ROOT / "scripts/build-ember-geology-study.py"
BENCHMARK_ROOT = Path("E:/tka-platform-ember-geology-sources/ember-simulator-benchmark")
DEM_PATH = BENCHMARK_ROOT / "ember-breached-rift-bench.asc"
R3_ROOT = BENCHMARK_ROOT / "gate-1-1-r3"
R3_DEM_PATH = R3_ROOT / "ember-breached-rift-bench-r3.asc"
R3_MANIFEST_PATH = R3_ROOT / "calibration-manifest.json"
R3_SELECTED_PATH = R3_ROOT / "selected-flowy-thickness.asc"
R4_ROOT = BENCHMARK_ROOT / "gate-1-1-r4"
R4_DEM_PATH = R4_ROOT / "ember-midflank-fire-pilgrimage-r4.asc"
R4_MANIFEST_PATH = R4_ROOT / "calibration-manifest.json"
R4_SELECTED_PATH = R4_ROOT / "selected-flowy-thickness.asc"
R5_ROOT = BENCHMARK_ROOT / "gate-1-1-r5"
R5_DEM_PATH = R5_ROOT / "ember-midflank-fire-pilgrimage-r5.asc"
R5_MANIFEST_PATH = R5_ROOT / "calibration-manifest.json"
R5_SELECTED_PATH = R5_ROOT / "selected-flowy-thickness.asc"
FLOWY_WSL_BINARY = "/mnt/e/tka-platform-ember-geology-sources/flowy/build-mamba/flowy"

RNG_SEED = 6301
N_FLOWS = 8
N_LOBES = 250
LOBE_AREA_M2 = 20.0
TOTAL_VOLUME_M3 = 8000.0
THICKENING_PARAMETER = 0.25
LOBE_EXPONENT = 0.12
MAX_SLOPE_PROBABILITY = 0.92
INERTIAL_EXPONENT = 0.25
THICKNESS_RATIO = 0.20


@dataclass(frozen=True)
class Calibration:
    id: str
    lobes_per_flow: int
    total_volume_m3: float
    n_flows: int = 3
    lobe_area_m2: float = 20.0
    max_slope_probability: float = 1.0
    inertial_exponent: float = 0.18
    lobe_exponent: float = 0.0
    thickening_parameter: float = 0.18
    thickness_ratio: float = 0.20


R3_CALIBRATIONS = (
    Calibration("r3f-c01f-threaded-10m2", 520, 5200.0, n_flows=3, lobe_area_m2=10.0, lobe_exponent=0.01),
    Calibration("r3f-c02f-breakout-14m2", 600, 7560.0, n_flows=3, lobe_area_m2=14.0, lobe_exponent=0.02),
    Calibration("r3f-c03f-branched-18m2", 680, 11016.0, n_flows=4, lobe_area_m2=18.0, lobe_exponent=0.035),
    Calibration("r3f-c04f-branched-22m2", 760, 15048.0, n_flows=4, lobe_area_m2=22.0, lobe_exponent=0.05),
    Calibration("r3f-c05f-lobate-28m2", 840, 21168.0, n_flows=5, lobe_area_m2=28.0, lobe_exponent=0.065),
)

R4_CALIBRATIONS = (
    Calibration("r4n-c01-threaded-12m2", 720, 7776.0, n_flows=3, lobe_area_m2=12.0, lobe_exponent=0.01),
    Calibration("r4n-c02-channel-16m2", 880, 12672.0, n_flows=3, lobe_area_m2=16.0, lobe_exponent=0.02),
    Calibration("r4n-c03-braided-20m2", 1040, 18720.0, n_flows=4, lobe_area_m2=20.0, lobe_exponent=0.035),
    Calibration("r4n-c04-lobate-24m2", 1200, 25920.0, n_flows=4, lobe_area_m2=24.0, lobe_exponent=0.05),
    Calibration("r4n-c05-heavy-30m2", 1400, 37800.0, n_flows=5, lobe_area_m2=30.0, lobe_exponent=0.065),
)

R5_CALIBRATIONS = (
    Calibration("r5f-c01-threaded-12m2", 720, 7776.0, n_flows=3, lobe_area_m2=12.0, lobe_exponent=0.01),
    Calibration("r5f-c02-channel-16m2", 880, 12672.0, n_flows=3, lobe_area_m2=16.0, lobe_exponent=0.02),
    Calibration("r5f-c03-braided-20m2", 1040, 18720.0, n_flows=4, lobe_area_m2=20.0, lobe_exponent=0.035),
    Calibration("r5f-c04-lobate-24m2", 1200, 25920.0, n_flows=4, lobe_area_m2=24.0, lobe_exponent=0.05),
    Calibration("r5f-c05-heavy-30m2", 1400, 37800.0, n_flows=5, lobe_area_m2=30.0, lobe_exponent=0.065),
)


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def flowy_binary_sha256() -> str:
    result = subprocess.run(
        ["wsl.exe", "-e", "bash", "-lc", f"sha256sum '{FLOWY_WSL_BINARY}' | cut -d' ' -f1"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def load_geology_study():
    spec = importlib.util.spec_from_file_location("ember_geology_study", STUDY_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {STUDY_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_esri_ascii(path: Path, data: np.ndarray) -> None:
    header = (
        f"ncols {data.shape[1]}\n"
        f"nrows {data.shape[0]}\n"
        "xllcorner -190.5\n"
        "yllcorner -145.5\n"
        "cellsize 1\n"
        "NODATA_value -9999\n"
    )
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(header)
        np.savetxt(handle, np.flipud(data), fmt="%.5f")


def read_esri_ascii(path: Path) -> np.ndarray:
    return np.flipud(np.loadtxt(path, skiprows=6))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    path.write_bytes(payload.encode("utf-8"))


def flowy_config() -> str:
    return f'''run_name = "ember_breached_rift"
source = "../ember-breached-rift-bench.asc"
output_folder = "output"
write_lobes_csv = false
print_remaining_time = false
save_final_dem = true
rng_seed = {RNG_SEED}
masking_tolerance = 0.00001
masking_max_iter = 20
volume_correction = false

vent_flag = 0
x_vent = [-72.0]
y_vent = [137.0]
east_to_vent = 380.0
west_to_vent = 380.0
south_to_vent = 380.0
north_to_vent = 380.0
hazard_flag = 0
masking_threshold = 0.97
n_flows = {calibration.n_flows}
min_n_lobes = {N_LOBES}
max_n_lobes = {N_LOBES}
total_volume = {TOTAL_VOLUME_M3}
fixed_dimension_flag = 1
lobe_area = {LOBE_AREA_M2}
thickness_ratio = {THICKNESS_RATIO}
thickening_parameter = {THICKENING_PARAMETER}
lobe_exponent = {LOBE_EXPONENT}
max_slope_prob = {MAX_SLOPE_PROBABILITY}
inertial_exponent = {INERTIAL_EXPONENT}

[Output]
crop_to_content = false
use_netcdf = false
compression = false
compression_level = 0
shuffle = false
packing_data_type = "float"

[Advanced]
restart_files = []
restart_filling_parameters = []
saveraster_flag = 1
flag_threshold = 1
a_beta = 0.0
b_beta = 0.0
force_max_length = 0
max_length = 250
n_init = 1
n_check_loop = 0
start_from_dist_flag = 0
dist_fact = 0.78
npoints = 36
aspect_ratio_coeff = 2.0
max_aspect_ratio = 2.5
'''


def flowy_r3_config(calibration: Calibration) -> str:
    return f'''run_name = "ember_gate1_1_{calibration.id.replace("-", "_")}"
source = "../../ember-breached-rift-bench-r3.asc"
output_folder = "output"
write_lobes_csv = false
print_remaining_time = false
save_final_dem = true
rng_seed = {RNG_SEED}
masking_tolerance = 0.00001
masking_max_iter = 20
volume_correction = false

vent_flag = 0
x_vent = [-22.0]
y_vent = [25.0]
east_to_vent = 380.0
west_to_vent = 380.0
south_to_vent = 380.0
north_to_vent = 380.0
hazard_flag = 0
masking_threshold = 0.97
n_flows = {calibration.n_flows}
min_n_lobes = {calibration.lobes_per_flow}
max_n_lobes = {calibration.lobes_per_flow}
total_volume = {calibration.total_volume_m3}
fixed_dimension_flag = 1
lobe_area = {calibration.lobe_area_m2}
thickness_ratio = {calibration.thickness_ratio}
thickening_parameter = {calibration.thickening_parameter}
lobe_exponent = {calibration.lobe_exponent}
max_slope_prob = {calibration.max_slope_probability}
inertial_exponent = {calibration.inertial_exponent}

[Output]
crop_to_content = false
use_netcdf = false
compression = false
compression_level = 0
shuffle = false
packing_data_type = "float"

[Advanced]
restart_files = []
restart_filling_parameters = []
saveraster_flag = 1
flag_threshold = 1
a_beta = 0.0
b_beta = 0.0
force_max_length = 0
max_length = 260
n_init = 1
n_check_loop = 0
start_from_dist_flag = 0
dist_fact = 0.80
npoints = 36
aspect_ratio_coeff = 2.0
max_aspect_ratio = 2.5
'''


def flowy_r4_config(calibration: Calibration) -> str:
    return f'''run_name = "ember_gate1_1_{calibration.id.replace("-", "_")}"
source = "../../ember-midflank-fire-pilgrimage-r4.asc"
output_folder = "output"
write_lobes_csv = false
print_remaining_time = false
save_final_dem = true
rng_seed = {RNG_SEED}
masking_tolerance = 0.00001
masking_max_iter = 20
volume_correction = false

vent_flag = 0
x_vent = [-34.0]
y_vent = [132.0]
east_to_vent = 380.0
west_to_vent = 380.0
south_to_vent = 380.0
north_to_vent = 380.0
hazard_flag = 0
masking_threshold = 0.97
n_flows = {calibration.n_flows}
min_n_lobes = {calibration.lobes_per_flow}
max_n_lobes = {calibration.lobes_per_flow}
total_volume = {calibration.total_volume_m3}
fixed_dimension_flag = 1
lobe_area = {calibration.lobe_area_m2}
thickness_ratio = {calibration.thickness_ratio}
thickening_parameter = {calibration.thickening_parameter}
lobe_exponent = {calibration.lobe_exponent}
max_slope_prob = {calibration.max_slope_probability}
inertial_exponent = {calibration.inertial_exponent}

[Output]
crop_to_content = false
use_netcdf = false
compression = false
compression_level = 0
shuffle = false
packing_data_type = "float"

[Advanced]
restart_files = []
restart_filling_parameters = []
saveraster_flag = 1
flag_threshold = 1
a_beta = 0.0
b_beta = 0.0
force_max_length = 0
max_length = 360
n_init = 1
n_check_loop = 0
start_from_dist_flag = 0
dist_fact = 0.82
npoints = 36
aspect_ratio_coeff = 2.0
max_aspect_ratio = 2.5
'''


def flowy_r5_config(calibration: Calibration) -> str:
    return f'''run_name = "ember_gate1_1_{calibration.id.replace("-", "_")}"
source = "../../ember-midflank-fire-pilgrimage-r5.asc"
output_folder = "output"
write_lobes_csv = false
print_remaining_time = false
save_final_dem = true
rng_seed = {RNG_SEED}
masking_tolerance = 0.00001
masking_max_iter = 20
volume_correction = false

vent_flag = 0
x_vent = [-34.0]
y_vent = [132.0]
east_to_vent = 380.0
west_to_vent = 380.0
south_to_vent = 380.0
north_to_vent = 380.0
hazard_flag = 0
masking_threshold = 0.97
n_flows = {calibration.n_flows}
min_n_lobes = {calibration.lobes_per_flow}
max_n_lobes = {calibration.lobes_per_flow}
total_volume = {calibration.total_volume_m3}
fixed_dimension_flag = 1
lobe_area = {calibration.lobe_area_m2}
thickness_ratio = {calibration.thickness_ratio}
thickening_parameter = {calibration.thickening_parameter}
lobe_exponent = {calibration.lobe_exponent}
max_slope_prob = {calibration.max_slope_probability}
inertial_exponent = {calibration.inertial_exponent}

[Output]
crop_to_content = false
use_netcdf = false
compression = false
compression_level = 0
shuffle = false
packing_data_type = "float"

[Advanced]
restart_files = []
restart_filling_parameters = []
saveraster_flag = 1
flag_threshold = 1
a_beta = 0.0
b_beta = 0.0
force_max_length = 0
max_length = 360
n_init = 1
n_check_loop = 0
start_from_dist_flag = 0
dist_fact = 0.82
npoints = 36
aspect_ratio_coeff = 2.0
max_aspect_ratio = 2.5
'''


def mrlavaloba_input() -> str:
    return f'''run_name = "ember_breached_rift"
source = "../ember-breached-rift-bench.asc"
vent_flag = 0
x_vent = [-72.0]
y_vent = [137.0]
east_to_vent = 380.0
west_to_vent = 380.0
south_to_vent = 380.0
north_to_vent = 380.0
hazard_flag = 0
masking_threshold = 0.97
n_flows = {N_FLOWS}
min_n_lobes = {N_LOBES}
max_n_lobes = {N_LOBES}
volume_flag = 1
total_volume = {TOTAL_VOLUME_M3}
fixed_dimension_flag = 1
lobe_area = {LOBE_AREA_M2}
thickness_ratio = {THICKNESS_RATIO}
thickening_parameter = {THICKENING_PARAMETER}
lobe_exponent = {LOBE_EXPONENT}
max_slope_prob = {MAX_SLOPE_PROBABILITY}
inertial_exponent = {INERTIAL_EXPONENT}
'''


def mrlavaloba_advanced_input() -> str:
    return '''restart_files = []
restart_filling_parameters = []
npoints = 36
n_init = 1
dist_fact = 0.78
flag_threshold = 1
a_beta = 0.0
b_beta = 0.0
max_aspect_ratio = 2.5
aspect_ratio_coeff = 2.0
start_from_dist_flag = 0
force_max_length = 0
max_length = 250
'''


def prepare_r1() -> None:
    study = load_geology_study()
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    height = study.candidate_height(candidate)

    flowy_dir = BENCHMARK_ROOT / "flowy"
    mrlavaloba_dir = BENCHMARK_ROOT / "mrlavaloba"
    flowy_dir.mkdir(parents=True, exist_ok=True)
    mrlavaloba_dir.mkdir(parents=True, exist_ok=True)
    (flowy_dir / "output").mkdir(parents=True, exist_ok=True)
    write_esri_ascii(DEM_PATH, height)
    (flowy_dir / "input.toml").write_text(flowy_config(), encoding="utf-8")
    (mrlavaloba_dir / "input_data.py").write_text(mrlavaloba_input(), encoding="utf-8")
    (mrlavaloba_dir / "input_data_advanced.py").write_text(mrlavaloba_advanced_input(), encoding="utf-8")

    manifest = {
        "schemaVersion": 1,
        "purpose": "Same-DEM implementation proof for Flowy and MrLavaLoba2; not calibrated hazard science.",
        "candidate": candidate.id,
        "dem": {
            "path": str(DEM_PATH),
            "columns": int(height.shape[1]),
            "rows": int(height.shape[0]),
            "cellSizeM": 1.0,
            "xRangeM": list(study.WORLD_X),
            "zRangeM": list(study.WORLD_Z),
            "minimumElevationM": round(float(height.min()), 4),
            "maximumElevationM": round(float(height.max()), 4),
        },
        "sharedParameters": {
            "rngSeed": RNG_SEED,
            "nFlows": N_FLOWS,
            "lobesPerFlow": N_LOBES,
            "lobeAreaM2": LOBE_AREA_M2,
            "totalVolumeM3": TOTAL_VOLUME_M3,
            "thickeningParameter": THICKENING_PARAMETER,
            "lobeExponent": LOBE_EXPONENT,
            "maxSlopeProbability": MAX_SLOPE_PROBABILITY,
            "inertialExponent": INERTIAL_EXPONENT,
            "thicknessRatio": THICKNESS_RATIO,
            "ventRuntimeXZ": list(candidate.source),
        },
        "implementations": {
            "flowy": {
                "repository": "https://github.com/flowy-code/flowy",
                "commit": "4ce1036d1073d581085c74c569b1d0e95a4ae0bd",
                "license": "GPL-3.0",
                "config": str(flowy_dir / "input.toml"),
            },
            "mrlavaloba2": {
                "repository": "https://github.com/demichie/MrLavaLoba2",
                "commit": "cf2cbc8aaabc399c9ae545286b1c710e3c6ffbb9",
                "license": "Apache-2.0",
                "config": [
                    str(mrlavaloba_dir / "input_data.py"),
                    str(mrlavaloba_dir / "input_data_advanced.py"),
                ],
            },
        },
        "limitations": [
            "The terrain is an authored Gate 1 hypothesis, not a surveyed volcano.",
            "Parameters are matched for implementation comparison, not calibrated to a named eruption.",
            "MrLavaLoba2 has no input seed in this version; the runner seeds NumPy before execution.",
            "Simulator outputs inform footprint and thickness rhythm only, not final render geometry.",
        ],
    }
    manifest_path = BENCHMARK_ROOT / "benchmark-manifest.json"
    write_json(manifest_path, manifest)
    print(f"DEM: {DEM_PATH}")
    print(f"Flowy config: {flowy_dir / 'input.toml'}")
    print(f"MrLavaLoba2 config: {mrlavaloba_dir / 'input_data.py'}")
    print(f"Manifest: {manifest_path}")


def prepare_r3() -> None:
    study = load_geology_study()
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    height = study.candidate_height(candidate, revision="r3")

    R3_ROOT.mkdir(parents=True, exist_ok=True)
    write_esri_ascii(R3_DEM_PATH, height)
    input_digests: dict[str, str] = {}
    for calibration in R3_CALIBRATIONS:
        calibration_dir = R3_ROOT / "calibrations" / calibration.id
        (calibration_dir / "output").mkdir(parents=True, exist_ok=True)
        config_path = calibration_dir / "input.toml"
        config_path.write_bytes(flowy_r3_config(calibration).encode("utf-8"))
        input_digests[calibration.id] = sha256_path(config_path)

    manifest = {
        "schemaVersion": 1,
        "purpose": "Gate 1.1 continuation and action-clearance calibration; not calibrated hazard science.",
        "terrainRevision": "r3",
        "candidate": candidate.id,
        "dem": {
            "path": str(R3_DEM_PATH),
            "sha256": sha256_path(R3_DEM_PATH),
            "columns": int(height.shape[1]),
            "rows": int(height.shape[0]),
            "cellSizeM": 1.0,
            "xRangeM": list(study.WORLD_X),
            "zRangeM": list(study.WORLD_Z),
            "minimumElevationM": round(float(height.min()), 4),
            "maximumElevationM": round(float(height.max()), 4),
        },
        "actionRadiusM": study.ACTION_RADIUS_M,
        "activeThicknessThresholdM": 0.01,
        "terminalBasin": {
            "centerRuntimeXZ": list(study.R3_TERMINAL_BASIN_CENTER),
            "radiiM": list(study.R3_TERMINAL_BASIN_RADII),
            "requiredActiveCellCount": 24,
            "southBoundaryGuardRuntimeZ": study.WORLD_Z[0] + 5.0,
        },
        "requiredClearanceBeyondActionEnvelopeM": 2.5,
        "requiredDownstreamMedianWidthM": 8.0,
        "requiredDownstreamWideningRatio": None,
        "requiredBranchEvidence": True,
        "calibrations": [asdict(calibration) for calibration in R3_CALIBRATIONS],
        "inputTomlSha256": input_digests,
        "selectedCalibration": None,
        "results": [],
        "implementation": {
            "repository": "https://github.com/flowy-code/flowy",
            "commit": "4ce1036d1073d581085c74c569b1d0e95a4ae0bd",
            "license": "GPL-3.0",
            "binary": FLOWY_WSL_BINARY,
            "binarySha256": flowy_binary_sha256(),
        },
        "limitations": [
            "The terrain is an authored Gate 1.1 hypothesis, not a surveyed volcano.",
            "The sweep tests route reach and clearance, not eruption-history fit.",
            "Simulator output owns the proposed deposit footprint but is not final render geometry.",
        ],
    }
    write_json(R3_MANIFEST_PATH, manifest)
    print(f"R3 DEM: {R3_DEM_PATH}")
    print(f"R3 calibrations: {len(R3_CALIBRATIONS)}")
    print(f"R3 manifest: {R3_MANIFEST_PATH}")


def wsl_path(path: Path) -> str:
    drive = path.drive.rstrip(":").lower()
    suffix = path.as_posix().split(":", 1)[1]
    return f"/mnt/{drive}{suffix}"


def r3_run_name(calibration: Calibration) -> str:
    return f"ember_gate1_1_{calibration.id.replace('-', '_')}"


def r3_output_path(calibration: Calibration) -> Path:
    output_dir = R3_ROOT / "calibrations" / calibration.id / "output"
    exact = output_dir / f"{r3_run_name(calibration)}_thickness_full.asc"
    legacy_numbered = output_dir / f"{r3_run_name(calibration)}_000_thickness_full.asc"
    return exact if exact.exists() or not legacy_numbered.exists() else legacy_numbered


def run_r3_flowy() -> None:
    if not R3_MANIFEST_PATH.exists():
        prepare_r3()
    for calibration in R3_CALIBRATIONS:
        calibration_dir = R3_ROOT / "calibrations" / calibration.id
        output_path = r3_output_path(calibration)
        if output_path.exists():
            print(f"Reuse {calibration.id}: {output_path}")
            continue
        command = (
            f"cd '{wsl_path(calibration_dir)}' && "
            f"'{FLOWY_WSL_BINARY}' --name '{r3_run_name(calibration)}' input.toml"
        )
        started = time.perf_counter()
        subprocess.run(["wsl.exe", "-e", "bash", "-lc", command], check=True)
        print(f"Ran {calibration.id} in {time.perf_counter() - started:.3f} s")


def analyze_r3() -> dict[str, object]:
    study = load_geology_study()
    manifest = json.loads(R3_MANIFEST_PATH.read_text(encoding="utf-8"))
    results: list[dict[str, object]] = []
    for calibration in R3_CALIBRATIONS:
        output_path = r3_output_path(calibration)
        if not output_path.exists():
            raise FileNotFoundError(f"Missing Flowy result: {output_path}")
        thickness = read_esri_ascii(output_path)
        active = thickness > float(manifest["activeThicknessThresholdM"])
        if not np.any(active):
            raise RuntimeError(f"Flowy result has no active cells: {output_path}")
        # The ASC lower-left corner is half a cell outside the authored point
        # grid, so Flowy's cell centres align exactly with X_GRID/Z_GRID.
        active_x = study.X_GRID[active]
        active_z = study.Z_GRID[active]
        active_distances = np.hypot(active_x, active_z)
        cell_half_extent = float(manifest["dem"]["cellSizeM"]) * 0.5
        active_support_distances = np.hypot(
            np.maximum(np.abs(active_x) - cell_half_extent, 0.0),
            np.maximum(np.abs(active_z) - cell_half_extent, 0.0),
        )
        upstream_widths = active[(study.Z_VALUES >= -30.0) & (study.Z_VALUES <= -5.0)].sum(axis=1)
        upstream_widths = upstream_widths[upstream_widths > 0]
        downstream_widths = active[study.Z_VALUES <= -80.0].sum(axis=1)
        downstream_widths = downstream_widths[downstream_widths > 0]
        upstream_median_width = float(np.median(upstream_widths)) if upstream_widths.size else 0.0
        downstream_median_width = float(np.median(downstream_widths)) if downstream_widths.size else 0.0
        widening_ratio = downstream_median_width / max(1.0, upstream_median_width)
        occupied_rows = np.flatnonzero(active.any(axis=1))
        occupied_row_gap_count = int(np.sum(np.diff(occupied_rows) > 1)) if occupied_rows.size > 1 else 0
        # A branch is observable when a row contains two active runs separated
        # by at least two inactive cells.  This detects a real split, not mere
        # width growth of one continuous ribbon.
        branched_rows = 0
        for row in active:
            occupied = np.flatnonzero(row)
            if occupied.size > 1 and np.any(np.diff(occupied) >= 3):
                branched_rows += 1
        min_z = float(active_z.min())
        clearance = float(active_support_distances.min()) - float(study.ACTION_RADIUS_M)
        basin = manifest["terminalBasin"]
        basin_x, basin_z = (float(value) for value in basin["centerRuntimeXZ"])
        basin_rx, basin_rz = (float(value) for value in basin["radiiM"])
        basin_mask = ((study.X_GRID - basin_x) / basin_rx) ** 2 + ((study.Z_GRID - basin_z) / basin_rz) ** 2 <= 1.0
        terminal_basin_active_cells = int(np.count_nonzero(active & basin_mask))
        reaches_terminal_basin = terminal_basin_active_cells >= int(basin["requiredActiveCellCount"])
        touches_south_boundary_guard = min_z <= float(basin["southBoundaryGuardRuntimeZ"])
        meets_clearance = clearance >= float(manifest["requiredClearanceBeyondActionEnvelopeM"])
        meets_downstream_width = downstream_median_width >= float(manifest["requiredDownstreamMedianWidthM"])
        has_branch_evidence = branched_rows >= 3
        results.append(
            {
                "calibrationId": calibration.id,
                "output": str(output_path),
                "activeCellCount": int(active.sum()),
                "activeAreaM2": round(float(active.sum()), 3),
                "boundsRuntimeXZ": {
                    "minX": round(float(active_x.min()), 3),
                    "maxX": round(float(active_x.max()), 3),
                    "minZ": round(min_z, 3),
                    "maxZ": round(float(active_z.max()), 3),
                },
                "minimumDistanceToPerformerM": round(float(active_support_distances.min()), 3),
                "minimumCellCenterDistanceToPerformerM": round(float(active_distances.min()), 3),
                "distanceMeasurement": "Minimum distance from performer origin to the visible 1 m cell support, not merely its center sample.",
                "clearanceBeyondActionEnvelopeM": round(clearance, 3),
                "upstreamMedianWidthM": round(upstream_median_width, 3),
                "upstreamWidthSamplingRuntimeZ": {"minimum": -30.0, "maximum": -5.0},
                "downstreamMedianWidthM": round(downstream_median_width, 3),
                "downstreamWidthSamplingRuntimeZ": {"maximum": -80.0},
                "downstreamWideningRatio": round(widening_ratio, 3),
                "occupiedRowGapCount": occupied_row_gap_count,
                "branchedRowCount": branched_rows,
                "terminalBasinActiveCellCount": terminal_basin_active_cells,
                "reachesInboardTerminalBasin": reaches_terminal_basin,
                "touchesSouthBoundaryGuard": touches_south_boundary_guard,
                "meetsActionClearance": meets_clearance,
                "meetsDownstreamWidth": meets_downstream_width,
                "widensDownstream": None,
                "hasBranchEvidence": has_branch_evidence,
                "eligible": reaches_terminal_basin and not touches_south_boundary_guard and meets_clearance and meets_downstream_width and has_branch_evidence,
            }
        )

    eligible = [result for result in results if result["eligible"]]
    if not eligible:
        selected = min(results, key=lambda result: float(result["boundsRuntimeXZ"]["minZ"]))
        selection_status = "no-eligible-calibration"
    else:
        selected = min(
            eligible,
            key=lambda result: (
                -int(result["branchedRowCount"]),
                abs(float(result["downstreamMedianWidthM"]) - 12.0),
            ),
        )
        selection_status = "selected-inboard-basin-deposition-with-breakout-evidence"

    shutil.copy2(Path(str(selected["output"])), R3_SELECTED_PATH)
    manifest["results"] = results
    manifest["selectedCalibration"] = selected["calibrationId"]
    manifest["selectionStatus"] = selection_status
    manifest["selectedOutput"] = str(R3_SELECTED_PATH)
    manifest["selectedOutputSha256"] = sha256_path(R3_SELECTED_PATH)
    write_json(R3_MANIFEST_PATH, manifest)
    print(json.dumps({"selectionStatus": selection_status, "selected": selected}, indent=2))
    return manifest


def prepare_r4() -> None:
    study = load_geology_study()
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    height = study.candidate_height(candidate, revision="r4")

    R4_ROOT.mkdir(parents=True, exist_ok=True)
    write_esri_ascii(R4_DEM_PATH, height)
    input_digests: dict[str, str] = {}
    for calibration in R4_CALIBRATIONS:
        calibration_dir = R4_ROOT / "calibrations" / calibration.id
        (calibration_dir / "output").mkdir(parents=True, exist_ok=True)
        config_path = calibration_dir / "input.toml"
        config_path.write_bytes(flowy_r4_config(calibration).encode("utf-8"))
        input_digests[calibration.id] = sha256_path(config_path)

    manifest = {
        "schemaVersion": 1,
        "purpose": "Gate 1.1 mid-flank drainage, orbit clearance, and downslope-continuation calibration; not calibrated hazard science.",
        "terrainRevision": "r4",
        "candidate": "midflank-fire-pilgrimage",
        "dem": {
            "path": str(R4_DEM_PATH),
            "sha256": sha256_path(R4_DEM_PATH),
            "columns": int(height.shape[1]),
            "rows": int(height.shape[0]),
            "cellSizeM": 1.0,
            "xRangeM": list(study.WORLD_X),
            "zRangeM": list(study.WORLD_Z),
            "minimumElevationM": round(float(height.min()), 4),
            "maximumElevationM": round(float(height.max()), 4),
        },
        "sourceRuntimeXZ": list(study.R4_MIDFLANK_SOURCE),
        "downslopeExitRuntimeXZ": list(study.R4_DOWNSLOPE_EXIT),
        "actionRadiusM": study.ACTION_RADIUS_M,
        "activeThicknessThresholdM": 0.01,
        "requiredClearanceBeyondActionEnvelopeM": 2.5,
        "requiredMidflankPassCellCount": 12,
        "requiredSouthExitCellCount": 8,
        "requiredDownstreamMedianWidthM": 6.0,
        "calibrations": [asdict(calibration) for calibration in R4_CALIBRATIONS],
        "inputTomlSha256": input_digests,
        "selectedCalibration": None,
        "results": [],
        "implementation": {
            "repository": "https://github.com/flowy-code/flowy",
            "commit": "4ce1036d1073d581085c74c569b1d0e95a4ae0bd",
            "license": "GPL-3.0",
            "binary": FLOWY_WSL_BINARY,
            "binarySha256": flowy_binary_sha256(),
        },
        "limitations": [
            "The terrain is an authored Gate 1.1 spatial hypothesis, not a surveyed volcano.",
            "The sweep tests route continuity, clearance, and scene-boundary continuation, not eruption-history fit.",
            "Simulator output owns the proposed deposit footprint but is not final render geometry.",
            "The south-boundary exit intentionally states that the drainage continues beyond the review world; it is not a terminal pool.",
        ],
    }
    write_json(R4_MANIFEST_PATH, manifest)
    print(f"R4 DEM: {R4_DEM_PATH}")
    print(f"R4 calibrations: {len(R4_CALIBRATIONS)}")
    print(f"R4 manifest: {R4_MANIFEST_PATH}")


def r4_run_name(calibration: Calibration) -> str:
    return f"ember_gate1_1_{calibration.id.replace('-', '_')}"


def r4_output_path(calibration: Calibration) -> Path:
    output_dir = R4_ROOT / "calibrations" / calibration.id / "output"
    exact = output_dir / f"{r4_run_name(calibration)}_thickness_full.asc"
    legacy_numbered = output_dir / f"{r4_run_name(calibration)}_000_thickness_full.asc"
    return exact if exact.exists() or not legacy_numbered.exists() else legacy_numbered


def run_r4_flowy() -> None:
    if not R4_MANIFEST_PATH.exists():
        prepare_r4()
    for calibration in R4_CALIBRATIONS:
        calibration_dir = R4_ROOT / "calibrations" / calibration.id
        output_path = r4_output_path(calibration)
        if output_path.exists():
            print(f"Reuse {calibration.id}: {output_path}")
            continue
        command = (
            f"cd '{wsl_path(calibration_dir)}' && "
            f"'{FLOWY_WSL_BINARY}' --name '{r4_run_name(calibration)}' input.toml"
        )
        started = time.perf_counter()
        subprocess.run(["wsl.exe", "-e", "bash", "-lc", command], check=True)
        print(f"Ran {calibration.id} in {time.perf_counter() - started:.3f} s")


def analyze_r4() -> dict[str, object]:
    study = load_geology_study()
    manifest = json.loads(R4_MANIFEST_PATH.read_text(encoding="utf-8"))
    results: list[dict[str, object]] = []
    for calibration in R4_CALIBRATIONS:
        output_path = r4_output_path(calibration)
        if not output_path.exists():
            raise FileNotFoundError(f"Missing Flowy result: {output_path}")
        thickness = read_esri_ascii(output_path)
        active = thickness > float(manifest["activeThicknessThresholdM"])
        if not np.any(active):
            raise RuntimeError(f"Flowy result has no active cells: {output_path}")
        active_x = study.X_GRID[active]
        active_z = study.Z_GRID[active]
        cell_half_extent = float(manifest["dem"]["cellSizeM"]) * 0.5
        active_support_distances = np.hypot(
            np.maximum(np.abs(active_x) - cell_half_extent, 0.0),
            np.maximum(np.abs(active_z) - cell_half_extent, 0.0),
        )
        clearance = float(active_support_distances.min()) - float(study.ACTION_RADIUS_M)
        midflank_zone = (
            (study.X_GRID >= -24.0)
            & (study.X_GRID <= -7.0)
            & (study.Z_GRID >= -24.0)
            & (study.Z_GRID <= 24.0)
        )
        south_exit_zone = study.Z_GRID <= -140.0
        midflank_cells = int(np.count_nonzero(active & midflank_zone))
        south_exit_cells = int(np.count_nonzero(active & south_exit_zone))
        downstream_widths = active[study.Z_VALUES <= -90.0].sum(axis=1)
        downstream_widths = downstream_widths[downstream_widths > 0]
        downstream_median_width = float(np.median(downstream_widths)) if downstream_widths.size else 0.0
        occupied_rows = np.flatnonzero(active.any(axis=1))
        occupied_row_gap_count = int(np.sum(np.diff(occupied_rows) > 1)) if occupied_rows.size > 1 else 0
        meets_clearance = clearance >= float(manifest["requiredClearanceBeyondActionEnvelopeM"])
        passes_midflank = midflank_cells >= int(manifest["requiredMidflankPassCellCount"])
        reaches_exit = south_exit_cells >= int(manifest["requiredSouthExitCellCount"])
        continuous = occupied_row_gap_count == 0
        meets_downstream_width = downstream_median_width >= float(manifest["requiredDownstreamMedianWidthM"])
        results.append(
            {
                "calibrationId": calibration.id,
                "output": str(output_path),
                "activeCellCount": int(active.sum()),
                "activeAreaM2": round(float(active.sum()), 3),
                "boundsRuntimeXZ": {
                    "minX": round(float(active_x.min()), 3),
                    "maxX": round(float(active_x.max()), 3),
                    "minZ": round(float(active_z.min()), 3),
                    "maxZ": round(float(active_z.max()), 3),
                },
                "minimumDistanceToPerformerM": round(float(active_support_distances.min()), 3),
                "clearanceBeyondActionEnvelopeM": round(clearance, 3),
                "midflankPassActiveCellCount": midflank_cells,
                "southExitActiveCellCount": south_exit_cells,
                "downstreamMedianWidthM": round(downstream_median_width, 3),
                "occupiedRowGapCount": occupied_row_gap_count,
                "passesMidflank": passes_midflank,
                "reachesDownslopeExit": reaches_exit,
                "continuousDownslope": continuous,
                "meetsActionClearance": meets_clearance,
                "meetsDownstreamWidth": meets_downstream_width,
                "eligible": passes_midflank and reaches_exit and continuous and meets_clearance and meets_downstream_width,
            }
        )

    eligible = [result for result in results if result["eligible"]]
    if not eligible:
        selected = min(results, key=lambda result: float(result["boundsRuntimeXZ"]["minZ"]))
        selection_status = "no-eligible-calibration"
    else:
        selected = min(
            eligible,
            key=lambda result: (
                abs(float(result["downstreamMedianWidthM"]) - 12.0),
                abs(int(result["activeCellCount"]) - 5000),
            ),
        )
        selection_status = "selected-continuous-midflank-to-south-exit"

    shutil.copy2(Path(str(selected["output"])), R4_SELECTED_PATH)
    manifest["results"] = results
    manifest["selectedCalibration"] = selected["calibrationId"]
    manifest["selectionStatus"] = selection_status
    manifest["selectedOutput"] = str(R4_SELECTED_PATH)
    manifest["selectedOutputSha256"] = sha256_path(R4_SELECTED_PATH)
    write_json(R4_MANIFEST_PATH, manifest)
    print(json.dumps({"selectionStatus": selection_status, "selected": selected}, indent=2))
    return manifest


def prepare_r5() -> None:
    study = load_geology_study()
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    height = study.candidate_height(candidate, revision="r5")

    R5_ROOT.mkdir(parents=True, exist_ok=True)
    write_esri_ascii(R5_DEM_PATH, height)
    input_digests: dict[str, str] = {}
    for calibration in R5_CALIBRATIONS:
        calibration_dir = R5_ROOT / "calibrations" / calibration.id
        (calibration_dir / "output").mkdir(parents=True, exist_ok=True)
        config_path = calibration_dir / "input.toml"
        config_path.write_bytes(flowy_r5_config(calibration).encode("utf-8"))
        input_digests[calibration.id] = sha256_path(config_path)

    manifest = {
        "schemaVersion": 1,
        "purpose": "Gate 1.1 slanted-flank drainage, orbit clearance, and downslope-continuation calibration; not calibrated hazard science.",
        "terrainRevision": "r5",
        "candidate": "midflank-fire-pilgrimage-slanted-flank",
        "dem": {
            "path": str(R5_DEM_PATH),
            "sha256": sha256_path(R5_DEM_PATH),
            "columns": int(height.shape[1]),
            "rows": int(height.shape[0]),
            "cellSizeM": 1.0,
            "xRangeM": list(study.WORLD_X),
            "zRangeM": list(study.WORLD_Z),
            "minimumElevationM": round(float(height.min()), 4),
            "maximumElevationM": round(float(height.max()), 4),
        },
        "sourceRuntimeXZ": list(study.R5_MIDFLANK_SOURCE),
        "downslopeExitRuntimeXZ": list(study.R5_DOWNSLOPE_EXIT),
        "actionRadiusM": study.ACTION_RADIUS_M,
        "activeThicknessThresholdM": 0.01,
        "requiredClearanceBeyondActionEnvelopeM": 2.5,
        "requiredMidflankPassCellCount": 12,
        "requiredSouthExitCellCount": 8,
        "requiredDownstreamMedianWidthM": 6.0,
        "calibrations": [asdict(calibration) for calibration in R5_CALIBRATIONS],
        "inputTomlSha256": input_digests,
        "selectedCalibration": None,
        "results": [],
        "implementation": {
            "repository": "https://github.com/flowy-code/flowy",
            "commit": "4ce1036d1073d581085c74c569b1d0e95a4ae0bd",
            "license": "GPL-3.0",
            "binary": FLOWY_WSL_BINARY,
            "binarySha256": flowy_binary_sha256(),
        },
        "limitations": [
            "The terrain is an authored Gate 1.1 spatial hypothesis, not a surveyed volcano.",
            "The sweep tests route continuity, clearance, and scene-boundary continuation, not eruption-history fit.",
            "Simulator output owns the proposed deposit footprint but is not final render geometry.",
            "The south-boundary exit intentionally states that the drainage continues beyond the review world; it is not a terminal pool.",
            "The small stable patch is a production accommodation embedded in a continuously inclined flank, not a claim about a named field site.",
        ],
    }
    write_json(R5_MANIFEST_PATH, manifest)
    print(f"R5 DEM: {R5_DEM_PATH}")
    print(f"R5 calibrations: {len(R5_CALIBRATIONS)}")
    print(f"R5 manifest: {R5_MANIFEST_PATH}")


def r5_run_name(calibration: Calibration) -> str:
    return f"ember_gate1_1_{calibration.id.replace('-', '_')}"


def r5_output_path(calibration: Calibration) -> Path:
    output_dir = R5_ROOT / "calibrations" / calibration.id / "output"
    exact = output_dir / f"{r5_run_name(calibration)}_thickness_full.asc"
    legacy_numbered = output_dir / f"{r5_run_name(calibration)}_000_thickness_full.asc"
    return exact if exact.exists() or not legacy_numbered.exists() else legacy_numbered


def run_r5_flowy() -> None:
    if not R5_MANIFEST_PATH.exists():
        prepare_r5()
    for calibration in R5_CALIBRATIONS:
        calibration_dir = R5_ROOT / "calibrations" / calibration.id
        output_path = r5_output_path(calibration)
        if output_path.exists():
            print(f"Reuse {calibration.id}: {output_path}")
            continue
        command = (
            f"cd '{wsl_path(calibration_dir)}' && "
            f"'{FLOWY_WSL_BINARY}' --name '{r5_run_name(calibration)}' input.toml"
        )
        started = time.perf_counter()
        subprocess.run(["wsl.exe", "-e", "bash", "-lc", command], check=True)
        print(f"Ran {calibration.id} in {time.perf_counter() - started:.3f} s")


def analyze_r5() -> dict[str, object]:
    study = load_geology_study()
    manifest = json.loads(R5_MANIFEST_PATH.read_text(encoding="utf-8"))
    results: list[dict[str, object]] = []
    for calibration in R5_CALIBRATIONS:
        output_path = r5_output_path(calibration)
        if not output_path.exists():
            raise FileNotFoundError(f"Missing Flowy result: {output_path}")
        thickness = read_esri_ascii(output_path)
        active = thickness > float(manifest["activeThicknessThresholdM"])
        if not np.any(active):
            raise RuntimeError(f"Flowy result has no active cells: {output_path}")
        active_x = study.X_GRID[active]
        active_z = study.Z_GRID[active]
        cell_half_extent = float(manifest["dem"]["cellSizeM"]) * 0.5
        active_support_distances = np.hypot(
            np.maximum(np.abs(active_x) - cell_half_extent, 0.0),
            np.maximum(np.abs(active_z) - cell_half_extent, 0.0),
        )
        clearance = float(active_support_distances.min()) - float(study.ACTION_RADIUS_M)
        midflank_zone = (
            (study.X_GRID >= -24.0)
            & (study.X_GRID <= -7.0)
            & (study.Z_GRID >= -24.0)
            & (study.Z_GRID <= 24.0)
        )
        south_exit_zone = study.Z_GRID <= -140.0
        midflank_cells = int(np.count_nonzero(active & midflank_zone))
        south_exit_cells = int(np.count_nonzero(active & south_exit_zone))
        downstream_widths = active[study.Z_VALUES <= -90.0].sum(axis=1)
        downstream_widths = downstream_widths[downstream_widths > 0]
        downstream_median_width = float(np.median(downstream_widths)) if downstream_widths.size else 0.0
        occupied_rows = np.flatnonzero(active.any(axis=1))
        occupied_row_gap_count = int(np.sum(np.diff(occupied_rows) > 1)) if occupied_rows.size > 1 else 0
        meets_clearance = clearance >= float(manifest["requiredClearanceBeyondActionEnvelopeM"])
        passes_midflank = midflank_cells >= int(manifest["requiredMidflankPassCellCount"])
        reaches_exit = south_exit_cells >= int(manifest["requiredSouthExitCellCount"])
        continuous = occupied_row_gap_count == 0
        meets_downstream_width = downstream_median_width >= float(manifest["requiredDownstreamMedianWidthM"])
        results.append(
            {
                "calibrationId": calibration.id,
                "output": str(output_path),
                "activeCellCount": int(active.sum()),
                "activeAreaM2": round(float(active.sum()), 3),
                "boundsRuntimeXZ": {
                    "minX": round(float(active_x.min()), 3),
                    "maxX": round(float(active_x.max()), 3),
                    "minZ": round(float(active_z.min()), 3),
                    "maxZ": round(float(active_z.max()), 3),
                },
                "minimumDistanceToPerformerM": round(float(active_support_distances.min()), 3),
                "clearanceBeyondActionEnvelopeM": round(clearance, 3),
                "midflankPassActiveCellCount": midflank_cells,
                "southExitActiveCellCount": south_exit_cells,
                "downstreamMedianWidthM": round(downstream_median_width, 3),
                "occupiedRowGapCount": occupied_row_gap_count,
                "passesMidflank": passes_midflank,
                "reachesDownslopeExit": reaches_exit,
                "continuousDownslope": continuous,
                "meetsActionClearance": meets_clearance,
                "meetsDownstreamWidth": meets_downstream_width,
                "eligible": passes_midflank and reaches_exit and continuous and meets_clearance and meets_downstream_width,
            }
        )

    eligible = [result for result in results if result["eligible"]]
    if not eligible:
        selected = min(results, key=lambda result: float(result["boundsRuntimeXZ"]["minZ"]))
        selection_status = "no-eligible-calibration"
    else:
        selected = min(
            eligible,
            key=lambda result: (
                abs(float(result["downstreamMedianWidthM"]) - 12.0),
                abs(int(result["activeCellCount"]) - 5000),
            ),
        )
        selection_status = "selected-continuous-slanted-midflank-to-south-exit"

    shutil.copy2(Path(str(selected["output"])), R5_SELECTED_PATH)
    manifest["results"] = results
    manifest["selectedCalibration"] = selected["calibrationId"]
    manifest["selectionStatus"] = selection_status
    manifest["selectedOutput"] = str(R5_SELECTED_PATH)
    manifest["selectedOutputSha256"] = sha256_path(R5_SELECTED_PATH)
    write_json(R5_MANIFEST_PATH, manifest)
    print(json.dumps({"selectionStatus": selection_status, "selected": selected}, indent=2))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        nargs="?",
        default="r1",
        choices=(
            "r1",
            "prepare-r3",
            "run-r3",
            "analyze-r3",
            "all-r3",
            "prepare-r4",
            "run-r4",
            "analyze-r4",
            "all-r4",
            "prepare-r5",
            "run-r5",
            "analyze-r5",
            "all-r5",
        ),
    )
    args = parser.parse_args()
    if args.command == "r1":
        prepare_r1()
    elif args.command == "prepare-r3":
        prepare_r3()
    elif args.command == "run-r3":
        run_r3_flowy()
    elif args.command == "analyze-r3":
        analyze_r3()
    elif args.command == "all-r3":
        prepare_r3()
        run_r3_flowy()
        analyze_r3()
    elif args.command == "prepare-r4":
        prepare_r4()
    elif args.command == "run-r4":
        run_r4_flowy()
    elif args.command == "analyze-r4":
        analyze_r4()
    elif args.command == "all-r4":
        prepare_r4()
        run_r4_flowy()
        analyze_r4()
    elif args.command == "prepare-r5":
        prepare_r5()
    elif args.command == "run-r5":
        run_r5_flowy()
    elif args.command == "analyze-r5":
        analyze_r5()
    else:
        prepare_r5()
        run_r5_flowy()
        analyze_r5()


if __name__ == "__main__":
    main()
