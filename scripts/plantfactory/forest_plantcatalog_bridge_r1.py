"""Deterministic PlantCatalog export bridge for the Moonlit Firefly Forest.

Run this file through PlantFactory's ``--python`` command-line option.
PlantFactory owns the eon module, so this script intentionally cannot execute
in ordinary CPython.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

import eon


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def current_script_path() -> Path:
    if "__file__" in globals():
        return Path(__file__).resolve()
    child = eon.EONChild()
    return Path(str(child.GetCurrentScriptPath())).resolve()


SCRIPT_PATH = current_script_path()
PROJECT_ROOT = SCRIPT_PATH.parents[2]
MANIFEST_PATH = PROJECT_ROOT / "scripts" / "forest-plantcatalog-bridge.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
STATE_PATH = PROJECT_ROOT / MANIFEST["paths"]["statePath"]
COMPLETION_PATH = PROJECT_ROOT / MANIFEST["paths"]["completionPath"]
CATALOG_ROOT = Path(MANIFEST["source"]["plantCatalogRoot"])
RAW_ROOT = PROJECT_ROOT / MANIFEST["paths"]["rawRoot"]


def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {
        "schemaVersion": 1,
        "bridgeId": MANIFEST["bridgeId"],
        "manifestPath": MANIFEST_PATH.relative_to(PROJECT_ROOT).as_posix(),
        "startedAt": utc_now(),
        "updatedAt": utc_now(),
        "activeExportSet": MANIFEST["activeExportSet"],
        "jobs": {},
    }


def save_state(state: dict) -> None:
    state["updatedAt"] = utc_now()
    atomic_json(STATE_PATH, state)


def selected_jobs() -> list[dict]:
    # PlantFactory hosts this script and owns its argv, so the export set is
    # overridden by environment variable rather than a command-line flag. Without
    # it, exporting a set other than the manifest default means editing the
    # manifest, running, and editing it back -- a window in which the committed
    # contract does not describe what the bridge is doing.
    active_set = os.environ.get("TKA_PLANTCATALOG_EXPORT_SET") or MANIFEST["activeExportSet"]
    selected_ids = MANIFEST["exportSets"].get(active_set)
    if not selected_ids:
        raise RuntimeError("Active export set is empty: {}".format(active_set))
    jobs = {job["id"]: job for job in MANIFEST["jobs"]}
    missing = [job_id for job_id in selected_ids if job_id not in jobs]
    if missing:
        raise RuntimeError("Manifest export set references missing jobs: {}".format(missing))
    return [jobs[job_id] for job_id in selected_ids]


def contract_fingerprint(job: dict, source_hash: str) -> str:
    payload = {
        "bridgeId": MANIFEST["bridgeId"],
        "export": MANIFEST["export"],
        "job": job,
        "sourceSha256": source_hash,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def read_export_options(child: eon.EONChild, names) -> dict:
    effective = {}
    for name in names:
        effective[name] = child.GetExportOption(name)
    return effective


def configure_export(child: eon.EONChild) -> dict:
    preset_name = MANIFEST["export"]["presetConstant"]
    preset = getattr(eon, preset_name)
    child.SetExportPreset(preset)
    applied_preset = int(child.GetExportPreset())
    if applied_preset != int(preset):
        raise RuntimeError(
            "PlantFactory did not apply export preset {}: requested {}, got {}".format(
                preset_name, int(preset), applied_preset
            )
        )

    requested = MANIFEST["export"]["options"]
    for name, value in requested.items():
        child.SetExportOption(name, value)

    # SetExportPreset's docstring warns that "once a preset has been set, it overrides most
    # export options set with SetExportOption", so a successful set is not evidence the value
    # survived. Read every option back and fail on any that did not stick. Booleans come back
    # as ints (True reads 1), so compare through bool for those.
    effective = read_export_options(child, requested.keys())
    for name, value in requested.items():
        if isinstance(value, bool):
            matched = bool(effective[name]) == value
        else:
            matched = effective[name] == value
        if not matched:
            raise RuntimeError(
                "PlantFactory ignored export option {}: requested {!r}, got {!r}".format(
                    name, value, effective[name]
                )
            )

    # Options this bridge deliberately does not set but must record, because they shape the
    # output and are not settable through this API: every string-typed option (texture map
    # formats, filename prefix, format extensions) raises "Invalid option", and the float
    # "scale" raises a SWIG overload error, so only int and bool options can be pinned.
    # The object/scene format follows the output filename's extension per ExportObject's
    # docstring, and the Blender stage renormalizes height against targetHeightMetres, so
    # capturing these as provenance is enough.
    recorded = read_export_options(child, MANIFEST["export"]["recordedOptions"])
    return {"requested": effective, "recorded": recorded, "preset": applied_preset}


def export_job(child: eon.EONChild, state: dict, job: dict) -> dict:
    source_path = CATALOG_ROOT / Path(job["sourceRelativePath"])
    if not source_path.exists():
        raise FileNotFoundError("PlantCatalog source missing: {}".format(source_path))
    if source_path.stat().st_size != int(job["sourceBytes"]):
        raise RuntimeError("PlantCatalog source size changed: {}".format(source_path))
    source_hash = sha256(source_path)
    if source_hash != job["sourceSha256"]:
        raise RuntimeError("PlantCatalog source hash changed: {}".format(source_path))

    fingerprint = contract_fingerprint(job, source_hash)
    job_root = RAW_ROOT / job["rawSubdirectory"]
    maps_root = job_root / "maps"
    output_fbx = job_root / (job["id"] + MANIFEST["export"]["extension"])
    existing = state["jobs"].get(job["id"], {})
    if (
        existing.get("status") == "complete"
        and existing.get("contractFingerprint") == fingerprint
        and output_fbx.exists()
        and output_fbx.stat().st_size > 0
    ):
        print("SKIP {}: checkpoint matches {}".format(job["id"], output_fbx))
        return existing

    job_root.mkdir(parents=True, exist_ok=True)
    maps_root.mkdir(parents=True, exist_ok=True)
    state["jobs"][job["id"]] = {
        "status": "running",
        "startedAt": utc_now(),
        "contractFingerprint": fingerprint,
        "sourcePath": str(source_path),
        "sourceSha256": source_hash,
        "outputFbx": str(output_fbx),
        "mapsDirectory": str(maps_root),
    }
    save_state(state)

    child.NewScene()
    # Load by verified path, not by catalog display name. LoadPlantCatalogFile's docstring --
    # unlike LoadPlant's -- carries no "Can throws exceptions on error", and that is literal:
    # when it cannot resolve the species string it silently opens PlantFactory's interactive
    # "Browser" picker, which disables the main frame and blocks the script forever with
    # nothing written to vue.log. Both "Quercus robur forest" and the LOD-qualified
    # "Quercus robur forest HD" hung that way. LoadPlant raises instead, and it takes the
    # exact file whose existence, size, and SHA-256 were just verified above, so the load is
    # pinned to the same bytes as the contract fingerprint rather than to a display name.
    child.LoadPlant(str(source_path), int(job["seed"]))
    # Age, max age, and season are typed 'int' in the SWIG bindings and raise TypeError on a
    # float, so these casts are load-bearing, not cosmetic. Health is the one genuine float.
    eon.GeneralParameterSetAgeMax(int(job["maximumAgeYears"]))
    eon.GeneralParameterSetAge(int(job["ageYears"]))
    eon.GeneralParameterSetHealth(float(job["health"]))
    eon.GeneralParameterSetSeason(int(job["seasonDay"]))
    eon.GeneralParameterSetSeed(int(job["seed"]))

    # Verify each parameter actually took, because two of these getters do not answer in the
    # units their setter accepts and a silent mismatch would ship a wrong-looking tree:
    #   * season  -- set as a day in [0, 364]; read back as percent of the year
    #                (day 172 reads 47.25 == 172 / 364 * 100)
    #   * health  -- set as a fraction in [0, 1]; read back as a percentage (1.0 reads 100.0)
    #   * age, ageMax -- years in both directions
    # Out-of-range values do raise ("season must be <= 364", "health max must be <= 1"), so
    # this guard is aimed at a value that is silently ignored rather than rejected.
    for label, expected, getter in (
        ("maximumAgeYears", float(job["maximumAgeYears"]), eon.GeneralParameterGetAgeMax),
        ("ageYears", float(job["ageYears"]), eon.GeneralParameterGetAge),
        ("health", float(job["health"]) * 100.0, eon.GeneralParameterGetHealth),
        ("seasonDay", int(job["seasonDay"]) / 364.0 * 100.0, eon.GeneralParameterGetSeason),
    ):
        applied = float(getter())
        if abs(applied - expected) > 1e-2:
            raise RuntimeError(
                "PlantFactory did not apply {} for {}: expected {} on read-back, got {}".format(
                    label, job["id"], expected, applied
                )
            )

    child.ApplyChanges()
    child.UpdateVariation()
    child.WaitForGeometry()

    selected_before = int(child.CountSelectedObjects())
    if selected_before == 0:
        child.SelectAll()
    selected_after = int(child.CountSelectedObjects())
    if selected_after == 0:
        raise RuntimeError("PlantFactory produced no selected plant for export")

    export_options = configure_export(child)
    exported = bool(child.ExportObject(str(output_fbx), str(maps_root)))
    if not exported or not output_fbx.exists() or output_fbx.stat().st_size == 0:
        raise RuntimeError("PlantFactory export did not create a valid FBX: {}".format(output_fbx))

    map_files = sorted(
        path.relative_to(job_root).as_posix()
        for path in maps_root.rglob("*")
        if path.is_file()
    )
    result = {
        "status": "complete",
        "startedAt": state["jobs"][job["id"]]["startedAt"],
        "completedAt": utc_now(),
        "contractFingerprint": fingerprint,
        "sourcePath": str(source_path),
        "sourceSha256": source_hash,
        "outputFbx": str(output_fbx),
        "outputFbxBytes": output_fbx.stat().st_size,
        "mapsDirectory": str(maps_root),
        "mapFiles": map_files,
        "plantMetrics": {
            "height": float(child.GetPlantHeight()),
            "polygons": int(child.GetNumberOfPolygons()),
            "leafCount": int(child.GetLeafNumber()),
            "ageRatio": float(child.GetAgeRatio()),
            "health": float(child.GetHealth()),
            "season": float(child.GetSeason()),
        },
        "selectedObjectsBeforeFallback": selected_before,
        "selectedObjectsAtExport": selected_after,
        "exportPreset": MANIFEST["export"]["presetConstant"],
        "effectiveExportOptions": export_options,
    }
    state["jobs"][job["id"]] = result
    save_state(state)
    print("EXPORTED {}: {}".format(job["id"], output_fbx))
    return result


def main() -> None:
    state = load_state()
    jobs = selected_jobs()
    completed = []
    child = eon.EONChild()
    for job in jobs:
        try:
            completed.append(export_job(child, state, job))
        except Exception as error:
            prior = state["jobs"].get(job["id"], {})
            state["jobs"][job["id"]] = {
                **prior,
                "status": "failed",
                "failedAt": utc_now(),
                "error": str(error),
                "traceback": traceback.format_exc(),
            }
            save_state(state)
            raise

    completion = {
        "schemaVersion": 1,
        "bridgeId": MANIFEST["bridgeId"],
        "activeExportSet": MANIFEST["activeExportSet"],
        "completedAt": utc_now(),
        "jobCount": len(completed),
        "jobs": [job["id"] for job in jobs],
        "statePath": STATE_PATH.relative_to(PROJECT_ROOT).as_posix(),
    }
    atomic_json(COMPLETION_PATH, completion)
    print("PLANTCATALOG BRIDGE COMPLETE: {}".format(COMPLETION_PATH))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("PLANTCATALOG BRIDGE FAILED. The checkpoint contains the exact error.")
        raise
