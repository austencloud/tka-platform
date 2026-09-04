"""Prepare one shared Ember DEM for Flowy and MrLavaLoba2.

The benchmark workspace lives outside Git because both simulators generate many
intermediate rasters. The checked-in script is the reproducible authority for
the input terrain and parameter parity.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
STUDY_SCRIPT = ROOT / "scripts/build-ember-geology-study.py"
BENCHMARK_ROOT = Path("E:/tka-platform-ember-geology-sources/ember-simulator-benchmark")
DEM_PATH = BENCHMARK_ROOT / "ember-breached-rift-bench.asc"

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
n_flows = {N_FLOWS}
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


def main() -> None:
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
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"DEM: {DEM_PATH}")
    print(f"Flowy config: {flowy_dir / 'input.toml'}")
    print(f"MrLavaLoba2 config: {mrlavaloba_dir / 'input_data.py'}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
