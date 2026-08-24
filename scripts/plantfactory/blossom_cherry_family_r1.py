"""Author and export the Blossom PlantFactory cherry-family proof.

Run through PlantFactory's ``-immediate-python --python`` entry point. The eon
module is owned by PlantFactory and is unavailable to ordinary CPython.
"""

from __future__ import annotations

import hashlib
import json
import os
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
MANIFEST_PATH = PROJECT_ROOT / "scripts" / "blossom-plantfactory-family.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
CONTENT_ROOT = Path(MANIFEST["source"]["plantFactoryContentRoot"])
RAW_ROOT = PROJECT_ROOT / MANIFEST["paths"]["rawRoot"]
AUTHORED_ROOT = PROJECT_ROOT / MANIFEST["paths"]["authoredRoot"]
STATE_PATH = PROJECT_ROOT / MANIFEST["paths"]["statePath"]
COMPLETION_PATH = PROJECT_ROOT / MANIFEST["paths"]["completionPath"]
EVIDENCE_ROOT = PROJECT_ROOT / MANIFEST["paths"]["evidenceRoot"]


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
    active_set = os.environ.get("TKA_BLOSSOM_PLANTFACTORY_EXPORT_SET") or MANIFEST[
        "activeExportSet"
    ]
    selected_ids = MANIFEST["exportSets"].get(active_set)
    if not selected_ids:
        raise RuntimeError("Active export set is empty: {}".format(active_set))
    jobs = {job["id"]: job for job in MANIFEST["jobs"]}
    missing = [job_id for job_id in selected_ids if job_id not in jobs]
    if missing:
        raise RuntimeError("Export set references missing jobs: {}".format(missing))
    return [jobs[job_id] for job_id in selected_ids]


def asset_by_role(role: str) -> tuple[Path, dict]:
    matches = [
        asset for asset in MANIFEST["source"]["auxiliaryAssets"] if asset["role"] == role
    ]
    if len(matches) != 1:
        raise RuntimeError("Expected one auxiliary asset for role {}".format(role))
    asset = matches[0]
    path = CONTENT_ROOT / asset["relativePath"]
    if not path.exists():
        raise FileNotFoundError("PlantFactory asset missing: {}".format(path))
    if path.stat().st_size != int(asset["bytes"]) or sha256(path) != asset["sha256"]:
        raise RuntimeError("PlantFactory asset fingerprint changed: {}".format(path))
    return path, asset


def source_path(job: dict) -> Path:
    path = CONTENT_ROOT / job["sourceRelativePath"]
    if not path.exists():
        raise FileNotFoundError("PlantFactory stock graph missing: {}".format(path))
    if path.stat().st_size != int(job["sourceBytes"]):
        raise RuntimeError("PlantFactory stock graph byte count changed: {}".format(path))
    if sha256(path) != job["sourceSha256"]:
        raise RuntimeError("PlantFactory stock graph hash changed: {}".format(path))
    return path


def readable_value(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [readable_value(item) for item in value]
    return repr(value)


def inspect_loaded_plant(child: eon.EONChild, job: dict) -> dict:
    materials = []
    for index in range(int(child.CountMaterials())):
        material = child.MaterialByIndex(index)
        materials.append({"index": index, "name": str(material.Name())})

    return {
        "sourceRelativePath": job["sourceRelativePath"],
        "sourceSha256": job["sourceSha256"],
        "inspectionSeed": job["seed"],
        "materials": materials,
        "graphInspection": {
            "status": "not-enumerable-through-eon-child",
            "availableMutationMethods": [
                "GetSpecialNode",
                "GetNodeAt",
                "NodeSetParam",
                "NodeResetParentFilter",
                "NodeResetProfileFilter",
            ],
        },
        "plantMetrics": {
            "height": float(child.GetPlantHeight()),
            "polygons": int(child.GetNumberOfPolygons()),
            "leafCount": int(child.GetLeafNumber()),
        },
    }


def inspect_sources(child: eon.EONChild) -> None:
    inspections = []
    seen = set()
    for job in selected_jobs():
        if job["sourceRelativePath"] in seen:
            continue
        seen.add(job["sourceRelativePath"])
        child.NewScene()
        child.LoadPlant(str(source_path(job)), int(job["seed"]))
        child.WaitForGeometry()
        inspections.append(inspect_loaded_plant(child, job))
    output = EVIDENCE_ROOT / "plantfactory-source-inspection.json"
    atomic_json(
        output,
        {
            "schemaVersion": 1,
            "bridgeId": MANIFEST["bridgeId"],
            "createdAt": utc_now(),
            "sources": inspections,
        },
    )
    print("BLOSSOM PLANTFACTORY INSPECTION COMPLETE: {}".format(output))


def contract_fingerprint(job: dict) -> str:
    payload = {
        "bridgeId": MANIFEST["bridgeId"],
        "export": MANIFEST["export"],
        "materialPolicy": MANIFEST["materialPolicy"],
        "auxiliaryAssets": MANIFEST["source"]["auxiliaryAssets"],
        "job": job,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def configure_plant_parameters(job: dict) -> dict:
    eon.GeneralParameterSetAgeMax(int(job["maximumAgeYears"]))
    eon.GeneralParameterSetAge(int(job["ageYears"]))
    eon.GeneralParameterSetHealth(float(job["health"]))
    eon.GeneralParameterSetSeason(int(job["seasonDay"]))
    eon.GeneralParameterSetSeed(int(job["seed"]))
    expected_values = (
        ("maximumAgeYears", float(job["maximumAgeYears"]), eon.GeneralParameterGetAgeMax),
        ("ageYears", float(job["ageYears"]), eon.GeneralParameterGetAge),
        ("health", float(job["health"]) * 100.0, eon.GeneralParameterGetHealth),
        (
            "seasonDay",
            int(job["seasonDay"]) / 364.0 * 100.0,
            eon.GeneralParameterGetSeason,
        ),
    )
    applied = {}
    for label, expected, getter in expected_values:
        value = float(getter())
        if abs(value - expected) > 1e-2:
            raise RuntimeError(
                "PlantFactory ignored {} for {}: expected {}, got {}".format(
                    label, job["id"], expected, value
                )
            )
        applied[label] = value
    return applied


def classify_material(name: str) -> str | None:
    lowered = name.lower()
    policy = MANIFEST["materialPolicy"]
    if any(token in lowered for token in policy["woodTokens"]):
        return "wood"
    if any(token in lowered for token in policy["foliageTokens"]):
        return "flower"
    return None


def apply_cherry_materials(child: eon.EONChild) -> list[dict]:
    policy = MANIFEST["materialPolicy"]
    bark_path, _ = asset_by_role(policy["barkAssetRole"])
    flower_path, _ = asset_by_role(policy["flowerAssetRole"])
    bark_material = child.LoadMaterial(str(bark_path))
    flower_material = child.LoadMaterial(str(flower_path))
    bark_name = str(bark_material.Name())
    flower_name = str(flower_material.Name())
    replacements = []
    original_materials = [
        str(child.MaterialByIndex(index).Name())
        for index in range(int(child.CountMaterials()))
    ]
    for original_index, original_name in enumerate(original_materials):
        family = classify_material(original_name)
        if family is None:
            continue
        current_index = None
        for index in range(int(child.CountMaterials())):
            material = child.MaterialByIndex(index)
            if material is not None and str(material.Name()) == original_name:
                current_index = index
                break
        if current_index is None:
            raise RuntimeError(
                "Material slot disappeared before replacement: {}".format(original_name)
            )
        target_path = bark_path if family == "wood" else flower_path
        target_name = bark_name if family == "wood" else flower_name
        child.SetMaterialByIndex(current_index, target_name)
        if child.MaterialByName(target_name) is None:
            raise RuntimeError("PlantFactory did not retain material {}".format(target_name))
        replacements.append(
            {
                "originalIndex": original_index,
                "resolvedIndex": current_index,
                "originalName": original_name,
                "family": family,
                "targetPath": str(target_path),
                "appliedName": target_name,
                "assignmentProof": "deferred-to-exported-material-and-texture-gate",
            }
        )
    wood_count = sum(1 for item in replacements if item["family"] == "wood")
    flower_count = sum(1 for item in replacements if item["family"] == "flower")
    if wood_count < int(policy["minimumWoodReplacements"]):
        raise RuntimeError("No structural material was replaced with cherry bark")
    if flower_count < int(policy["minimumFlowerReplacements"]):
        raise RuntimeError("No foliage material was replaced with cherry flowers")
    return replacements


def apply_node_edits(child: eon.EONChild, job: dict) -> list[dict]:
    applied = []
    for edit in job.get("nodeEdits", []):
        node = (
            child.GetSpecialNode(edit["specialNode"])
            if "specialNode" in edit
            else child.GetNodeAt(int(edit["nodeIndex"]))
        )
        child.NodeSetParam(node, edit["parameter"], edit["value"])
        applied.append({**edit, "applied": True})
    return applied


def read_export_options(child: eon.EONChild, names) -> dict:
    return {name: child.GetExportOption(name) for name in names}


def configure_export(child: eon.EONChild) -> dict:
    preset_name = MANIFEST["export"]["presetConstant"]
    preset = getattr(eon, preset_name)
    child.SetExportPreset(preset)
    applied_preset = int(child.GetExportPreset())
    if applied_preset != int(preset):
        raise RuntimeError("PlantFactory did not apply export preset {}".format(preset_name))
    requested = MANIFEST["export"]["options"]
    for name, value in requested.items():
        child.SetExportOption(name, value)
    effective = read_export_options(child, requested.keys())
    for name, value in requested.items():
        matched = bool(effective[name]) == value if isinstance(value, bool) else effective[name] == value
        if not matched:
            raise RuntimeError(
                "PlantFactory ignored export option {}: requested {!r}, got {!r}".format(
                    name, value, effective[name]
                )
            )
    return {
        "requested": effective,
        "recorded": read_export_options(child, MANIFEST["export"]["recordedOptions"]),
        "preset": applied_preset,
    }


def export_job(child: eon.EONChild, state: dict, job: dict) -> dict:
    source = source_path(job)
    fingerprint = contract_fingerprint(job)
    job_root = RAW_ROOT / job["rawSubdirectory"]
    maps_root = job_root / "maps"
    output_fbx = job_root / (job["id"] + MANIFEST["export"]["extension"])
    authored_tpf = AUTHORED_ROOT / job["authoredFilename"]
    authored_scene = authored_tpf.with_suffix(".tpfs")
    existing = state["jobs"].get(job["id"], {})
    if (
        existing.get("status") == "complete"
        and existing.get("contractFingerprint") == fingerprint
        and output_fbx.exists()
        and output_fbx.stat().st_size > 0
        and authored_tpf.exists()
        and authored_tpf.stat().st_size > 0
        and authored_scene.exists()
        and authored_scene.stat().st_size > 0
    ):
        print("SKIP {}: checkpoint matches {}".format(job["id"], output_fbx))
        return existing

    job_root.mkdir(parents=True, exist_ok=True)
    maps_root.mkdir(parents=True, exist_ok=True)
    authored_tpf.parent.mkdir(parents=True, exist_ok=True)
    state["jobs"][job["id"]] = {
        "status": "running",
        "startedAt": utc_now(),
        "contractFingerprint": fingerprint,
        "sourcePath": str(source),
        "sourceSha256": job["sourceSha256"],
        "outputFbx": str(output_fbx),
        "authoredTpf": str(authored_tpf),
        "authoredScene": str(authored_scene),
        "mapsDirectory": str(maps_root),
    }
    save_state(state)

    child.NewScene()
    child.LoadPlant(str(source), int(job["seed"]))
    parameter_readback = configure_plant_parameters(job)
    material_replacements = apply_cherry_materials(child)
    node_edits = apply_node_edits(child, job)
    child.ApplyChanges()
    child.UpdateVariation()
    child.WaitForGeometry()

    child.ExportAsVueSpecies(str(authored_tpf), True, True)
    if not authored_tpf.exists() or authored_tpf.stat().st_size == 0:
        raise RuntimeError("PlantFactory did not save the authored TPF: {}".format(authored_tpf))
    saved_scene = bool(child.SaveScene(str(authored_scene)))
    if not saved_scene or not authored_scene.exists() or authored_scene.stat().st_size == 0:
        raise RuntimeError(
            "PlantFactory did not save the authored scene: {}".format(authored_scene)
        )

    selected_before = int(child.CountSelectedObjects())
    if selected_before == 0:
        child.SelectAll()
    selected_after = int(child.CountSelectedObjects())
    if selected_after == 0:
        raise RuntimeError("PlantFactory produced no selected plant for export")
    export_options = configure_export(child)
    exported = bool(child.ExportObject(str(output_fbx), str(maps_root)))
    if not exported or not output_fbx.exists() or output_fbx.stat().st_size == 0:
        raise RuntimeError("PlantFactory did not create a valid FBX: {}".format(output_fbx))

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
        "sourcePath": str(source),
        "sourceSha256": job["sourceSha256"],
        "authoredTpf": str(authored_tpf),
        "authoredTpfBytes": authored_tpf.stat().st_size,
        "authoredTpfSha256": sha256(authored_tpf),
        "authoredScene": str(authored_scene),
        "authoredSceneBytes": authored_scene.stat().st_size,
        "authoredSceneSha256": sha256(authored_scene),
        "outputFbx": str(output_fbx),
        "outputFbxBytes": output_fbx.stat().st_size,
        "mapsDirectory": str(maps_root),
        "mapFiles": map_files,
        "parameterReadback": parameter_readback,
        "materialReplacements": material_replacements,
        "nodeEdits": node_edits,
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


def export_family(child: eon.EONChild) -> None:
    state = load_state()
    jobs = selected_jobs()
    completed = []
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
    print("BLOSSOM PLANTFACTORY FAMILY COMPLETE: {}".format(COMPLETION_PATH))
    child.Exit(False, 0)


def main() -> None:
    child = eon.EONChild()
    mode = os.environ.get("TKA_BLOSSOM_PLANTFACTORY_MODE", "export").lower()
    if mode == "inspect":
        inspect_sources(child)
        return
    if mode != "export":
        raise RuntimeError("Unsupported TKA_BLOSSOM_PLANTFACTORY_MODE: {}".format(mode))
    export_family(child)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("BLOSSOM PLANTFACTORY FAMILY FAILED. The checkpoint contains the exact error.")
        raise
