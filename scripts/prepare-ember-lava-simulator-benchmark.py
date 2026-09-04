"""Prepare one shared Ember DEM for Flowy and MrLavaLoba2.

The benchmark workspace lives outside Git because both simulators generate many
intermediate rasters. The checked-in script is the reproducible authority for
the input terrain and parameter parity.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
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
R2_ROOT = BENCHMARK_ROOT / "gate-1-1-r2"
R2_DEM_PATH = R2_ROOT / "ember-breached-rift-bench-r2.asc"
R2_MANIFEST_PATH = R2_ROOT / "calibration-manifest.json"
R2_SELECTED_PATH = R2_ROOT / "selected-flowy-thickness.asc"
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


R2_CALIBRATIONS = (
    Calibration("r2f-c01-linear-20m2", 1200, 14400.0, lobe_area_m2=20.0, lobe_exponent=0.0),
    Calibration("r2f-c02-threaded-35m2", 1200, 25200.0, lobe_area_m2=35.0, lobe_exponent=0.01),
    Calibration("r2f-c03-branched-50m2", 1200, 36000.0, lobe_area_m2=50.0, lobe_exponent=0.02),
    Calibration("r2f-c04-branched-65m2", 1200, 46800.0, lobe_area_m2=65.0, lobe_exponent=0.03),
    Calibration("r2f-c05-branched-80m2", 1200, 57600.0, lobe_area_m2=80.0, lobe_exponent=0.04),
)


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
        "xllcorner -190\n"
        "yllcorner -145\n"
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


def flowy_r2_config(calibration: Calibration) -> str:
    return f'''run_name = "ember_gate1_1_{calibration.id.replace("-", "_")}"
source = "../../ember-breached-rift-bench-r2.asc"
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
n_flows = {N_FLOWS}
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
max_length = 400
n_init = 1
n_check_loop = 0
start_from_dist_flag = 0
dist_fact = 0.80
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


def prepare_r2() -> None:
    study = load_geology_study()
    candidate = next(item for item in study.CANDIDATES if item.id == "a-breached-rift-bench")
    height = study.candidate_height(candidate, revision="r2")

    R2_ROOT.mkdir(parents=True, exist_ok=True)
    write_esri_ascii(R2_DEM_PATH, height)
    for calibration in R2_CALIBRATIONS:
        calibration_dir = R2_ROOT / "calibrations" / calibration.id
        (calibration_dir / "output").mkdir(parents=True, exist_ok=True)
        (calibration_dir / "input.toml").write_bytes(flowy_r2_config(calibration).encode("utf-8"))

    manifest = {
        "schemaVersion": 1,
        "purpose": "Gate 1.1 continuation and action-clearance calibration; not calibrated hazard science.",
        "terrainRevision": "r2",
        "candidate": candidate.id,
        "dem": {
            "path": str(R2_DEM_PATH),
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
        "continuationThresholdRuntimeZ": study.WORLD_Z[0] + 2.0,
        "requiredClearanceBeyondActionEnvelopeM": 4.0,
        "requiredDownstreamMedianWidthM": 9.0,
        "requiredDownstreamWideningRatio": 1.25,
        "calibrations": [asdict(calibration) for calibration in R2_CALIBRATIONS],
        "selectedCalibration": None,
        "results": [],
        "implementation": {
            "repository": "https://github.com/flowy-code/flowy",
            "commit": "4ce1036d1073d581085c74c569b1d0e95a4ae0bd",
            "license": "GPL-3.0",
            "binary": FLOWY_WSL_BINARY,
        },
        "limitations": [
            "The terrain is an authored Gate 1.1 hypothesis, not a surveyed volcano.",
            "The sweep tests route reach and clearance, not eruption-history fit.",
            "Simulator output owns the proposed deposit footprint but is not final render geometry.",
        ],
    }
    write_json(R2_MANIFEST_PATH, manifest)
    print(f"R2 DEM: {R2_DEM_PATH}")
    print(f"R2 calibrations: {len(R2_CALIBRATIONS)}")
    print(f"R2 manifest: {R2_MANIFEST_PATH}")


def wsl_path(path: Path) -> str:
    drive = path.drive.rstrip(":").lower()
    suffix = path.as_posix().split(":", 1)[1]
    return f"/mnt/{drive}{suffix}"


def r2_run_name(calibration: Calibration) -> str:
    return f"ember_gate1_1_{calibration.id.replace('-', '_')}"


def r2_output_path(calibration: Calibration) -> Path:
    output_dir = R2_ROOT / "calibrations" / calibration.id / "output"
    exact = output_dir / f"{r2_run_name(calibration)}_thickness_full.asc"
    legacy_numbered = output_dir / f"{r2_run_name(calibration)}_000_thickness_full.asc"
    return exact if exact.exists() or not legacy_numbered.exists() else legacy_numbered


def run_r2_flowy() -> None:
    if not R2_MANIFEST_PATH.exists():
        prepare_r2()
    for calibration in R2_CALIBRATIONS:
        calibration_dir = R2_ROOT / "calibrations" / calibration.id
        output_path = r2_output_path(calibration)
        if output_path.exists():
            print(f"Reuse {calibration.id}: {output_path}")
            continue
        command = (
            f"cd '{wsl_path(calibration_dir)}' && "
            f"'{FLOWY_WSL_BINARY}' --name '{r2_run_name(calibration)}' input.toml"
        )
        started = time.perf_counter()
        subprocess.run(["wsl.exe", "-e", "bash", "-lc", command], check=True)
        print(f"Ran {calibration.id} in {time.perf_counter() - started:.3f} s")


def analyze_r2() -> dict[str, object]:
    study = load_geology_study()
    manifest = json.loads(R2_MANIFEST_PATH.read_text(encoding="utf-8"))
    results: list[dict[str, object]] = []
    for calibration in R2_CALIBRATIONS:
        output_path = r2_output_path(calibration)
        if not output_path.exists():
            raise FileNotFoundError(f"Missing Flowy result: {output_path}")
        thickness = read_esri_ascii(output_path)
        active = thickness > float(manifest["activeThicknessThresholdM"])
        if not np.any(active):
            raise RuntimeError(f"Flowy result has no active cells: {output_path}")
        active_x = study.X_GRID[active]
        active_z = study.Z_GRID[active]
        active_distances = np.hypot(active_x, active_z)
        upstream_widths = active[study.Z_VALUES >= 80.0].sum(axis=1)
        upstream_widths = upstream_widths[upstream_widths > 0]
        downstream_widths = active[study.Z_VALUES <= -70.0].sum(axis=1)
        downstream_widths = downstream_widths[downstream_widths > 0]
        upstream_median_width = float(np.median(upstream_widths)) if upstream_widths.size else 0.0
        downstream_median_width = float(np.median(downstream_widths)) if downstream_widths.size else 0.0
        widening_ratio = downstream_median_width / max(1.0, upstream_median_width)
        min_z = float(active_z.min())
        clearance = float(active_distances.min()) - float(study.ACTION_RADIUS_M)
        reaches_continuation = min_z <= float(manifest["continuationThresholdRuntimeZ"])
        meets_clearance = clearance >= float(manifest["requiredClearanceBeyondActionEnvelopeM"])
        meets_downstream_width = downstream_median_width >= float(manifest["requiredDownstreamMedianWidthM"])
        widens_downstream = widening_ratio >= float(manifest["requiredDownstreamWideningRatio"])
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
                "minimumDistanceToPerformerM": round(float(active_distances.min()), 3),
                "clearanceBeyondActionEnvelopeM": round(clearance, 3),
                "upstreamMedianWidthM": round(upstream_median_width, 3),
                "downstreamMedianWidthM": round(downstream_median_width, 3),
                "downstreamWideningRatio": round(widening_ratio, 3),
                "reachesSouthContinuation": reaches_continuation,
                "meetsActionClearance": meets_clearance,
                "meetsDownstreamWidth": meets_downstream_width,
                "widensDownstream": widens_downstream,
                "eligible": reaches_continuation and meets_clearance and meets_downstream_width and widens_downstream,
            }
        )

    eligible = [result for result in results if result["eligible"]]
    if not eligible:
        selected = min(results, key=lambda result: float(result["boundsRuntimeXZ"]["minZ"]))
        selection_status = "no-eligible-calibration"
    else:
        selected = min(
            eligible,
            key=lambda result: abs(float(result["downstreamMedianWidthM"]) - 14.0),
        )
        selection_status = "selected-closest-to-14m-downstream-width"

    shutil.copy2(Path(str(selected["output"])), R2_SELECTED_PATH)
    manifest["results"] = results
    manifest["selectedCalibration"] = selected["calibrationId"]
    manifest["selectionStatus"] = selection_status
    manifest["selectedOutput"] = str(R2_SELECTED_PATH)
    write_json(R2_MANIFEST_PATH, manifest)
    print(json.dumps({"selectionStatus": selection_status, "selected": selected}, indent=2))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        nargs="?",
        default="r1",
        choices=("r1", "prepare-r2", "run-r2", "analyze-r2", "all-r2"),
    )
    args = parser.parse_args()
    if args.command == "r1":
        prepare_r1()
    elif args.command == "prepare-r2":
        prepare_r2()
    elif args.command == "run-r2":
        run_r2_flowy()
    elif args.command == "analyze-r2":
        analyze_r2()
    else:
        prepare_r2()
        run_r2_flowy()
        analyze_r2()


if __name__ == "__main__":
    main()
