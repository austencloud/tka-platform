"""Verify the Olive Cloudbreak Gate 2 Blender artifact against its coordinate contract."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SPEC_DIR = PROJECT_ROOT / "docs" / "superpowers" / "specs" / "seraphic-vault"
REVISION = "olive-cloudbreak-r2"
REVISION_SUFFIX = "r2"
BLEND_PATH = PROJECT_ROOT / "blender" / f"olive_cloudbreak_graybox_{REVISION_SUFFIX}.blend"
GLB_PATH = (
    PROJECT_ROOT
    / "static"
    / "models"
    / "celestial"
    / "review"
    / f"olive-cloudbreak-graybox-{REVISION_SUFFIX}.glb"
)
COORDINATE_PATH = SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-coordinate-manifest.json"
REPORT_PATH = SPEC_DIR / f"seraphic-vault-gate2-cloudbreak-{REVISION_SUFFIX}-verification.json"
RENDER_SIZES = {
    "desktop": (1600, 900),
    "portrait": (675, 1200),
    "landscapePhone": (1600, 687),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def round4(value: float) -> float:
    return round(value, 4)


def mesh_bounds_ndc(
    camera: bpy.types.Object, objects: list[bpy.types.Object]
) -> list[float] | None:
    points: list[tuple[float, float]] = []
    scene = bpy.context.scene
    for obj in objects:
        if obj.type != "MESH":
            continue
        matrix = obj.matrix_world
        for vertex in obj.data.vertices:
            projected = world_to_camera_view(scene, camera, matrix @ vertex.co)
            if projected.z > 0:
                points.append((projected.x * 2.0 - 1.0, projected.y * 2.0 - 1.0))
    if not points:
        return None
    return [
        round4(min(point[0] for point in points)),
        round4(max(point[0] for point in points)),
        round4(min(point[1] for point in points)),
        round4(max(point[1] for point in points)),
    ]


def bounds_center(bounds: list[float]) -> tuple[float, float]:
    return ((bounds[0] + bounds[1]) / 2, (bounds[2] + bounds[3]) / 2)


def rectangles_overlap(a: list[float], b: list[float], padding: float = 0.0) -> bool:
    return not (
        a[1] + padding <= b[0]
        or a[0] - padding >= b[1]
        or a[3] + padding <= b[2]
        or a[2] - padding >= b[3]
    )


def tagged_objects(
    *, role: str | None = None, element: str | None = None
) -> list[bpy.types.Object]:
    return [
        obj
        for obj in bpy.data.objects
        if obj.get("tka_gate") == 2
        and (role is None or obj.get("tka_role") == role)
        and (element is None or obj.get("tka_element") == element)
    ]


def vector_close(actual, expected, tolerance: float = 0.001) -> bool:
    return all(
        math.isclose(float(actual[index]), float(expected[index]), abs_tol=tolerance)
        for index in range(3)
    )


def main() -> None:
    if not BLEND_PATH.exists() or not GLB_PATH.exists() or not COORDINATE_PATH.exists():
        raise FileNotFoundError("Olive Cloudbreak Gate 2 artifacts must exist before verification")
    with COORDINATE_PATH.open("r", encoding="utf-8") as handle:
        contract = json.load(handle)
    if contract["revision"] != REVISION:
        raise RuntimeError(
            f"Coordinate manifest revision {contract['revision']} does not match {REVISION}"
        )

    gate_objects = tagged_objects()
    revision_tags_pass = bool(gate_objects) and all(
        obj.get("tka_revision") == REVISION for obj in gate_objects
    )
    expected_role_counts = {
        "graybox-landmass": 1,
        "graybox-performance-zone": 1,
        "graybox-lagoon": 1,
        "graybox-olive-trunk": 2,
        "graybox-olive-canopy": 2,
        "graybox-distant-mesa": 4,
        "graybox-distant-mesa-top": 4,
        "graybox-far-sun": 1,
        "graybox-scale-figure": 2,
    }
    actual_role_counts = {
        role: len(tagged_objects(role=role)) for role in expected_role_counts
    }
    source_parity_pass = revision_tags_pass and actual_role_counts == expected_role_counts

    camera_parity = []
    for name, preset in contract["cameraPresets"].items():
        camera = bpy.data.objects.get(f"Cloudbreak_Camera_{name}")
        camera_parity.append(
            {
                "camera": name,
                "passed": bool(camera)
                and vector_close(camera.location, preset["blenderPosition"]),
            }
        )

    sun = tagged_objects(role="graybox-far-sun")
    sun_position_pass = len(sun) == 1 and vector_close(
        sun[0].location, contract["sun"]["blenderPosition"]
    )
    tree_position_checks = []
    for tree in contract["oliveTrees"]:
        trunks = tagged_objects(role="graybox-olive-trunk", element=tree["id"])
        expected = tree["blenderPosition"]
        tree_position_checks.append(
            {
                "id": tree["id"],
                "passed": len(trunks) == 1
                and math.isclose(trunks[0].location.x, expected[0], abs_tol=0.001)
                and math.isclose(trunks[0].location.y, expected[1], abs_tol=0.001),
            }
        )

    coordinate_parity_pass = (
        all(check["passed"] for check in camera_parity)
        and sun_position_pass
        and all(check["passed"] for check in tree_position_checks)
    )

    coordinate_collision = next(
        check for check in contract["checks"] if check["name"] == "collision"
    )
    performance_objects = tagged_objects(role="graybox-performance-zone")
    lagoon_objects = tagged_objects(role="graybox-lagoon")
    collision_pass = (
        coordinate_collision["passed"]
        and len(performance_objects) == 1
        and len(lagoon_objects) == 1
    )

    registered_views = {}
    solar_checks = []
    layout_checks = []
    hero_checks = []
    hero_band = [
        contract["protectedHeroBand"]["ndcMinX"],
        contract["protectedHeroBand"]["ndcMaxX"],
        contract["protectedHeroBand"]["ndcMinY"],
        contract["protectedHeroBand"]["ndcMaxY"],
    ]
    for name, preset in contract["cameraPresets"].items():
        bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = RENDER_SIZES[name]
        camera = bpy.data.objects.get(f"Cloudbreak_Camera_{name}")
        if not camera:
            raise RuntimeError(f"Missing registered camera: {name}")

        sun_bounds = mesh_bounds_ndc(camera, sun)
        stage_bounds = mesh_bounds_ndc(camera, performance_objects)
        lagoon_bounds = mesh_bounds_ndc(camera, lagoon_objects)
        if not sun_bounds or not stage_bounds or not lagoon_bounds:
            raise RuntimeError(f"Missing projected bounds in registered camera {name}")

        mesa_bounds = {}
        for mesa in contract["distantMesas"]:
            members = [
                obj
                for obj in tagged_objects(element=mesa["id"])
                if str(obj.get("tka_role", "")).startswith("graybox-distant-mesa")
            ]
            bounds = mesh_bounds_ndc(camera, members)
            if not bounds:
                raise RuntimeError(f"Missing mesa geometry: {mesa['id']}")
            overlaps = rectangles_overlap(sun_bounds, bounds, padding=0.006)
            solar_checks.append(
                {
                    "camera": name,
                    "mesa": mesa["id"],
                    "passed": not overlaps,
                    "sunBounds": sun_bounds,
                    "mesaBounds": bounds,
                }
            )
            mesa_bounds[mesa["id"]] = bounds

        tree_bounds = {}
        for tree in contract["oliveTrees"]:
            bounds = mesh_bounds_ndc(
                camera,
                tagged_objects(role="graybox-olive-trunk", element=tree["id"]),
            )
            if not bounds:
                raise RuntimeError(f"Missing olive trunk geometry: {tree['id']}")
            overlaps = rectangles_overlap(hero_band, bounds)
            hero_checks.append(
                {
                    "camera": name,
                    "tree": tree["id"],
                    "passed": not overlaps,
                    "bounds": bounds,
                }
            )
            tree_bounds[tree["id"]] = bounds

        stage_center = bounds_center(stage_bounds)
        lagoon_center = bounds_center(lagoon_bounds)
        sun_center = bounds_center(sun_bounds)
        expected_stage = preset["projections"]["stage"]
        expected_lagoon = preset["projections"]["lagoon"]
        expected_sun = preset["projections"]["sun"]
        layout_pass = (
            abs(stage_center[0] - expected_stage[0]) <= 0.025
            and abs(stage_center[1] - expected_stage[1]) <= 0.035
            and abs(lagoon_center[0] - expected_lagoon[0]) <= 0.04
            and abs(lagoon_center[1] - expected_lagoon[1]) <= 0.04
            and abs(sun_center[0] - expected_sun[0]) <= 0.015
            and abs(sun_center[1] - expected_sun[1]) <= 0.015
        )
        layout_checks.append(
            {
                "camera": name,
                "passed": layout_pass,
                "stageCenter": [round4(value) for value in stage_center],
                "expectedStage": expected_stage,
                "lagoonCenter": [round4(value) for value in lagoon_center],
                "expectedLagoon": expected_lagoon,
                "sunCenter": [round4(value) for value in sun_center],
                "expectedSun": expected_sun,
            }
        )
        registered_views[name] = {
            "stageBounds": stage_bounds,
            "lagoonBounds": lagoon_bounds,
            "sunBounds": sun_bounds,
            "mesaBounds": mesa_bounds,
            "treeTrunkBounds": tree_bounds,
        }

    report = {
        "sceneId": "seraphic-vault",
        "gateId": "playable-graybox",
        "revision": REVISION,
        "artifactDigests": {
            str(BLEND_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"): sha256(BLEND_PATH),
            str(COORDINATE_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"): sha256(COORDINATE_PATH),
            str(GLB_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"): sha256(GLB_PATH),
        },
        "registeredViews": registered_views,
        "checks": {
            "artifact-digest": {
                "passed": True,
                "evidence": "SHA-256 digests captured for the Blender source, coordinate manifest, and review GLB.",
            },
            "source-parity": {
                "passed": source_parity_pass,
                "evidence": actual_role_counts,
            },
            "coordinate-parity": {
                "passed": coordinate_parity_pass,
                "evidence": {
                    "cameras": camera_parity,
                    "sun": sun_position_pass,
                    "trees": tree_position_checks,
                },
            },
            "collision": {
                "passed": collision_pass,
                "evidence": coordinate_collision["evidence"],
            },
            "registered-camera-layout": {
                "passed": all(check["passed"] for check in layout_checks),
                "evidence": layout_checks,
            },
            "solar-silhouette-clearance": {
                "passed": all(check["passed"] for check in solar_checks),
                "evidence": solar_checks,
            },
            "hero-band-clearance": {
                "passed": all(check["passed"] for check in hero_checks),
                "evidence": hero_checks,
            },
        },
    }
    failed = [name for name, check in report["checks"].items() if not check["passed"]]
    if failed:
        raise RuntimeError(f"Olive Cloudbreak verification failed: {', '.join(failed)}")
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "report": str(REPORT_PATH),
                "checks": {
                    name: check["passed"] for name, check in report["checks"].items()
                },
            },
            indent=2,
        )
    )

main()
