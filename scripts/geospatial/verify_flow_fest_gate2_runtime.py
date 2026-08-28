#!/usr/bin/env python3
"""Fail closed when Flow Fest Gate 2 runtime evidence drifts."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "static/data/flow-fest-sim/gate2-runtime-contract.json"
CONTRACT_COPY_PATH = ROOT / (
    "docs/superpowers/specs/flow-fest-sim/evidence/gate-2/"
    "gate2-coordinate-manifest.json"
)
TRACE_PATH = ROOT / "docs/superpowers/specs/flow-fest-sim/austen-traced-connectors.json"
COMPARISON_PATH = ROOT / (
    "docs/superpowers/specs/flow-fest-sim/evidence/gate-2/"
    "gate2-host-comparison.json"
)
GATES_PATH = ROOT / "docs/superpowers/specs/flow-fest-sim/scene-gates.json"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def exact_xz(points: list[dict[str, Any]]) -> list[tuple[float, float]]:
    return [(float(point["x"]), float(point["z"])) for point in points]


def contains_exact_subsequence(
    points: list[tuple[float, float]],
    subsequence: list[tuple[float, float]],
) -> bool:
    return any(
        points[index : index + len(subsequence)] == subsequence
        for index in range(len(points) - len(subsequence) + 1)
    )


def check_source_hashes(contract: dict[str, Any]) -> str:
    inputs = contract["sourceAuthority"]["inputs"]
    require(len(inputs) >= 6, "runtime contract source authority is incomplete")
    for item in inputs:
        path = ROOT / item["path"]
        require(path.is_file(), f"missing source authority file: {item['path']}")
        require(sha256(path) == item["sha256"], f"source digest drift: {item['path']}")
    return f"{len(inputs)} source inputs match their pinned SHA-256 values"


def check_coordinate_contract(contract: dict[str, Any]) -> str:
    frame = contract["runtimeWorldFrame"]
    require(frame["units"] == "meter", "runtime units must be metres")
    require(frame["metersPerUnit"] == 1, "runtime scale must be 1 metre per unit")
    require(frame["handedness"] == "right", "runtime frame must be right-handed")
    require(frame["axes"] == {"x": "east", "y": "up", "z": "south"}, "runtime axes drifted")
    require(frame["projectedCrs"]["code"] == 26916, "projected CRS must remain EPSG:26916")
    require(contract["spawn"]["positionWorld"][0::2] == [340.0, -20.0], "lower-gate spawn drifted")
    require(math.isclose(contract["spawn"]["eyeHeightMeters"], 1.7), "eye height drifted")
    return "1 m right-handed east/up/south frame, EPSG:26916, and lower-gate spawn remain locked"


def check_trace_parity(contract: dict[str, Any], trace: dict[str, Any]) -> str:
    for trace_id, source_points in trace["paths"].items():
        runtime_points = contract["connectorTraces"][trace_id]["vertices"]
        require(exact_xz(runtime_points) == exact_xz(source_points), f"connector drift: {trace_id}")
    require(len(trace["paths"]["upperClearingToMiddleEarth"]) == 13, "upper trace count drifted")
    require(len(trace["paths"]["middleEarthToLowerClearing"]) == 14, "lower trace count drifted")
    return "13 upper and 14 lower Austen-traced vertices match exactly"


def check_route_contract(contract: dict[str, Any]) -> str:
    arrivals = contract["routes"]["arrivalBranches"]
    returns = contract["routes"]["nightReturnBranches"]
    expected = {"lower-tent", "upper-tent", "car-camp"}
    require(set(arrivals) == expected, "arrival branch set drifted")
    require(set(returns) == expected, "night-return branch set drifted")
    person_segments = []
    vehicle_segments = []
    for branch in arrivals.values():
        for segment in branch["segments"]:
            (person_segments if segment["mode"] == "person" else vehicle_segments).append(segment)
    person_segments.extend(returns.values())
    require(person_segments, "no person routes found")
    require(vehicle_segments, "no vehicle routes found")
    require(
        all(math.isclose(segment["nominalSpeedMetersPerSecond"], 1.2) for segment in person_segments),
        "person route speed drifted from 1.2 m/s",
    )
    require(
        all(segment["nominalDurationSeconds"] is None for segment in vehicle_segments),
        "vehicle duration was invented",
    )
    segments_by_id = {
        segment["id"]: segment
        for branch in arrivals.values()
        for segment in branch["segments"]
    }
    segments_by_id.update({segment["id"]: segment for segment in returns.values()})
    trace_expectations = {
        "upperClearingToMiddleEarth": {
            "forward": ["lower-tent-home-on-foot", "upper-camp-to-middle-earth"],
            "reverse": ["upper-tent-night-return"],
        },
        "middleEarthToLowerClearing": {
            "forward": [
                "lower-tent-home-on-foot",
                "lower-tent-night-return",
                "car-camp-night-return",
            ],
            "reverse": ["middle-earth-arrival", "car-camp-to-middle-earth"],
        },
    }
    embedded_trace_uses = 0
    for trace_id, directions in trace_expectations.items():
        trace_points = exact_xz(contract["connectorTraces"][trace_id]["vertices"])
        for direction, segment_ids in directions.items():
            expected = trace_points if direction == "forward" else list(reversed(trace_points))
            for segment_id in segment_ids:
                require(segment_id in segments_by_id, f"missing route segment: {segment_id}")
                actual = exact_xz(segments_by_id[segment_id]["points"])
                require(
                    contains_exact_subsequence(actual, expected),
                    f"{trace_id} {direction} subsequence drifted in {segment_id}",
                )
                embedded_trace_uses += 1
    return (
        f"three arrivals and returns preserve {len(person_segments)} timed person "
        f"segments, null vehicle timing, and {embedded_trace_uses} exact connector subsequences"
    )


def check_runtime_sources(comparison: dict[str, Any]) -> str:
    sources = comparison["runtimeSourceFiles"]
    require(len(sources) >= 6, "runtime source evidence is incomplete")
    for item in sources:
        path = ROOT / item["path"]
        require(path.is_file(), f"missing runtime source: {item['path']}")
        require(sha256(path) == item["sha256"], f"runtime source digest drift: {item['path']}")
    return f"{len(sources)} runtime owner files match the measured comparison"


def check_host_comparison(comparison: dict[str, Any]) -> str:
    hosts = {host["id"]: host for host in comparison["hosts"]}
    require(set(hosts) == {"bounded-static", "chunked"}, "both terrain hosts must be measured")
    require(comparison["decision"]["winner"] == "chunked", "default host decision drifted")
    require(comparison["invariants"]["sourceHeightSamples"] == 1_050_625, "full DTM sample count drifted")
    require(comparison["invariants"]["sourceSpacingMeters"] == 1, "runtime DTM spacing drifted")
    for host in hosts.values():
        require(host["renderColliderHeightParity"] is True, f"{host['id']} render/collider height parity failed")
        audit = host["collisionAudit"]
        require(audit["status"] == "passed", f"{host['id']} collision audit failed")
        require(audit["registeredPersonWaypoints"] == 144, f"{host['id']} route coverage drifted")
        require(audit["missingHits"] == 0, f"{host['id']} has missing ground hits")
        require(audit["missingColliderFrames"] == 0, f"{host['id']} exposed missing collider frames")
        require(audit["maximumAbsoluteDtmErrorMeters"] <= 0.05, f"{host['id']} collision error exceeded 5 cm")
        traversal = host["dynamicTraversalAudit"]
        require(traversal["status"] == "passed", f"{host['id']} dynamic traversal audit failed")
        require(traversal["samples"] == 522, f"{host['id']} traversal probe coverage drifted")
        require(traversal["seamCrossings"] == 86, f"{host['id']} seam crossing count drifted")
        require(traversal["seamAdjacentProbes"] == 258, f"{host['id']} seam-adjacent coverage drifted")
        require(traversal["routeLegEndpointProbes"] == 264, f"{host['id']} endpoint coverage drifted")
        require(
            traversal["seamAdjacentProbes"] + traversal["routeLegEndpointProbes"]
            == traversal["samples"],
            f"{host['id']} traversal probe decomposition is inconsistent",
        )
        require(traversal["missingColliderSamples"] == 0, f"{host['id']} missed a dynamic collider sample")
        require(traversal["missingGroundHits"] == 0, f"{host['id']} missed dynamic ground")
        require(traversal["maximumAbsoluteDtmErrorMeters"] <= 0.05, f"{host['id']} dynamic collision error exceeded 5 cm")
    require(
        hosts["chunked"]["frameMilliseconds"]["p95"] <= (1000 / 30),
        "selected chunk host missed the 30 fps p95 floor",
    )
    require(hosts["bounded-static"]["renderColliderIdentity"] is True, "bounded host lost typed-array identity")
    require(hosts["chunked"]["renderMeshes"] == 1, "chunk host visual terrain is not batched")
    require(hosts["chunked"]["activeTerrainColliderMeshesAtSpawn"] < 100, "chunk collider window is unbounded")
    require(
        0 < hosts["chunked"]["dynamicTraversalAudit"]["maximumActiveTerrainColliders"] <= 36,
        "dynamic chunk collider window exceeded its bound",
    )
    require(
        hosts["chunked"]["dynamicTraversalAudit"]["colliderWindowTransitions"] > 0,
        "dynamic traversal did not exercise chunk reconciliation",
    )
    require(
        hosts["chunked"]["playerReadyMilliseconds"] < hosts["bounded-static"]["playerReadyMilliseconds"],
        "recorded host winner is not faster to a collision-ready player",
    )
    return "both hosts pass ground plus 258 seam-adjacent and 264 endpoint probes; the chunk winner satisfies startup and the strict 30 fps p95 gate"


def check_barrier_policy(contract: dict[str, Any], comparison: dict[str, Any]) -> str:
    policy = contract["nodePolicy"]["runtimeTopologyBarrierPolicy"]
    require(policy["visibleColliderIdentityRequired"] is True, "visible/collider barrier identity is not required")
    require(policy["sourceClass"] == "interpreted-gameplay-from-measured-surface", "barrier source class drifted")
    require(comparison["invariants"]["barrierOccupiedCellCount"] == 95_459, "barrier occupancy drifted")
    require(comparison["invariants"]["barrierCellSizeMeters"] == 1, "barrier cell spacing drifted")
    require(math.isclose(comparison["invariants"]["barrierPersonCorridorClearanceMeters"], 1.12), "person corridor clearance drifted")
    require(math.isclose(comparison["invariants"]["barrierVehicleCorridorClearanceMeters"], 2.9), "vehicle corridor clearance drifted")
    require(math.isclose(comparison["invariants"]["auditedVehicleHalfWidthMeters"], 1), "vehicle footprint drifted")
    require(comparison["invariants"]["barrierConservativeDilationMeters"] == 18, "barrier dilation drifted")
    require(comparison["invariants"]["barrierMinimumHeightMeters"] == 4, "barrier minimum height drifted")
    require("gameplay invention" in comparison["invariants"]["dilationClassification"], "barrier dilation is not truthfully classified")
    require("do not identify individual trees" in policy["truthBoundary"], "barrier truth boundary is missing")
    topology = comparison["barrierTopologyAudit"]
    require(topology["status"] == "passed", "barrier pathfinding audit failed")
    require(topology["spawnUnobstructed"] is True, "lower-gate spawn is obstructed")
    require(topology["approvedPersonLegs"] == 132, "approved person-leg coverage drifted")
    require(topology["obstructedApprovedLegs"] == [], "an approved person corridor is obstructed")
    require(topology["approvedVehicleLegs"] == 54, "approved vehicle-leg coverage drifted")
    require(topology["obstructedApprovedVehicleLegs"] == [], "an approved vehicle corridor is obstructed")
    for connector_id, connector in topology["connectors"].items():
        require(connector["connected"] is True, f"connector is disconnected: {connector_id}")
        require(connector["withinApprovedCorridor"] is True, f"connector escaped its corridor: {connector_id}")
        require(
            connector["maximumDeviationFromApprovedMeters"]
            <= connector["maximumAllowedDeviationMeters"],
            f"connector deviation exceeded its limit: {connector_id}",
        )
        require(connector["offCorridorChallengerIsShorter"] is False, f"shortcut flag failed: {connector_id}")
        require(
            connector["offCorridorChallengerGridDistanceMeters"]
            >= connector["inCorridorGridDistanceMeters"],
            f"shorter off-corridor challenger remains: {connector_id}",
        )
    zones = topology["zones"]
    require(len(zones) == 7, "registered-zone audit coverage drifted")
    for zone_id, zone in zones.items():
        require(zone["passed"] is True, f"registered zone was swallowed: {zone_id}")
        require(
            zone["openFraction"] >= zone["minimumRequiredOpenFraction"],
            f"registered zone open fraction failed: {zone_id}",
        )
    return "95,459 lidar-derived/dilated cells preserve the spawn, 132 person legs, 54 vehicle legs, seven clearings, and both traced connector corridors"


def check_camera_projection(comparison: dict[str, Any]) -> str:
    camera = comparison["cameraProjectionAudit"]
    require(camera["status"] == "passed", "registered camera projection audit failed")
    require(math.isclose(camera["registeredHorizontalFovDegrees"], 65), "registered horizontal FOV drifted")
    require(
        math.isclose(
            camera["actualHorizontalFovDegrees"],
            camera["registeredHorizontalFovDegrees"],
            abs_tol=1e-9,
        ),
        "runtime camera does not reproduce the registered horizontal FOV",
    )
    return "runtime camera reproduces the registered 65 degree horizontal FOV at the captured aspect"


def check_gate_evidence() -> str:
    gates = read_json(GATES_PATH)
    gate = next(item for item in gates["gates"] if item["id"] == "playable-graybox")
    require(
        gate["status"] in {"ready-for-review", "approved"},
        "Gate 2 must remain reviewable or approved",
    )
    if gate["status"] == "approved":
        require(isinstance(gate["approval"], dict), "approved Gate 2 needs an approval record")
        require(
            gate["approval"].get("approvedBy") == "Austen Cloud",
            "Gate 2 approval must come from Austen",
        )
    else:
        require(gate["approval"] is None, "unapproved Gate 2 cannot carry an approval record")
    for item in gate["evidence"]:
        path = ROOT / item["path"]
        require(path.is_file(), f"missing Gate 2 evidence: {item['path']}")
        require(sha256(path) == item["sha256"], f"Gate 2 evidence digest drift: {item['path']}")
    checks = {item["name"]: item["status"] for item in gate["checks"]}
    required = {
        "artifact-digest",
        "collision",
        "dynamic-collision",
        "barrier-topology",
        "camera-projection",
        "route-duration",
        "sequence-parity",
    }
    require(all(checks.get(name) == "passed" for name in required), "required Gate 2 checks are not all passed")
    approval_state = "approval recorded" if gate["status"] == "approved" else "approval remains unset"
    return f"{len(gate['evidence'])} scene-gate evidence files match; {approval_state}"


def main() -> int:
    contract_bytes = CONTRACT_PATH.read_bytes()
    require(contract_bytes == CONTRACT_COPY_PATH.read_bytes(), "runtime and evidence coordinate manifests differ")
    contract = json.loads(contract_bytes)
    trace = read_json(TRACE_PATH)
    comparison = read_json(COMPARISON_PATH)
    require(sha256(CONTRACT_PATH) == comparison["runtimeContract"]["sha256"], "comparison contract digest drifted")
    require(
        contract["coordinateContentFingerprint"]["canonicalPayloadSha256"]
        == comparison["runtimeContract"]["coordinatePayloadSha256"],
        "coordinate payload fingerprint drifted",
    )

    checks: list[tuple[str, Callable[[], str]]] = [
        ("coordinate-manifest-copy", lambda: "runtime and evidence coordinate manifests are byte-identical"),
        ("source-hashes", lambda: check_source_hashes(contract)),
        ("coordinate-contract", lambda: check_coordinate_contract(contract)),
        ("connector-trace-parity", lambda: check_trace_parity(contract, trace)),
        ("route-contract", lambda: check_route_contract(contract)),
        ("runtime-source-hashes", lambda: check_runtime_sources(comparison)),
        ("host-comparison", lambda: check_host_comparison(comparison)),
        ("barrier-policy", lambda: check_barrier_policy(contract, comparison)),
        ("camera-projection", lambda: check_camera_projection(comparison)),
        ("scene-gate-evidence", check_gate_evidence),
    ]

    failures = 0
    for name, check in checks:
        try:
            print(f"PASS {name}: {check()}")
        except (AssertionError, KeyError, TypeError, ValueError) as error:
            failures += 1
            print(f"FAIL {name}: {error}")
    print(f"RESULT: {len(checks) - failures}/{len(checks)} Gate 2 runtime checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
