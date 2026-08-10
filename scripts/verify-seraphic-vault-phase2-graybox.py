"""Verify registered camera geometry in the Seraphic Vault Gate 2 Blender artifact."""

from __future__ import annotations

import hashlib
import json
import runpy
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view


if "--cloudbreak" in sys.argv:
    runpy.run_path(
        str(Path(__file__).resolve().parent / "lib" / "verify-seraphic-vault-cloudbreak-graybox.py"),
        run_name="__main__",
    )
    raise SystemExit(0)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BLEND_PATH = PROJECT_ROOT / "blender" / "seraphic_vault_phase2_graybox.blend"
GLB_PATH = (
    PROJECT_ROOT
    / "static"
    / "models"
    / "celestial"
    / "review"
    / "seraphic-vault-phase2-graybox.glb"
)
COORDINATE_PATH = (
    PROJECT_ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "seraphic-vault"
    / "seraphic-vault-gate2-coordinate-manifest.json"
)
REPORT_PATH = (
    PROJECT_ROOT
    / "docs"
    / "superpowers"
    / "specs"
    / "seraphic-vault"
    / "seraphic-vault-gate2-verification.json"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def round4(value: float) -> float:
    return round(value, 4)


def project_meshes(camera: bpy.types.Object, objects: list[bpy.types.Object]) -> list[float] | None:
    points = []
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


def rectangles_overlap(a: list[float], b: list[float]) -> bool:
    return not (a[1] <= b[0] or a[0] >= b[1] or a[3] <= b[2] or a[2] >= b[3])


def main() -> None:
    if not BLEND_PATH.exists() or not GLB_PATH.exists() or not COORDINATE_PATH.exists():
        raise FileNotFoundError("Gate 2 artifacts must exist before verification")
    with COORDINATE_PATH.open("r", encoding="utf-8") as handle:
        contract = json.load(handle)

    feather_objects = [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.name.startswith("FeatherRib_")
    ]
    platform_objects = [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.get("tka_gate") == 2
    ]
    report_views = {}
    occlusion_checks = []
    render_sizes = {
        "desktop": (1600, 900),
        "portrait": (675, 1200),
        "landscapePhone": (1600, 687),
    }
    for preset_name in contract["cameraPresets"]:
        bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = render_sizes[preset_name]
        for platform in contract["platforms"]:
            runtime_position = platform["positions"][preset_name]
            root = bpy.data.objects.get(f"Gate2_{platform['id']}_Root")
            if not root:
                raise RuntimeError(f"Missing platform root: {platform['id']}")
            root.location = (
                -runtime_position[0],
                runtime_position[2],
                runtime_position[1],
            )
        bpy.context.view_layer.update()
        camera = bpy.data.objects.get(f"Gate2_Camera_{preset_name}")
        if not camera:
            raise RuntimeError(f"Missing registered camera: {preset_name}")
        feather_bounds = {
            obj.name: project_meshes(camera, [obj])
            for obj in feather_objects
        }
        platforms = {}
        for platform in contract["platforms"]:
            platform_id = platform["id"]
            members = [obj for obj in platform_objects if obj.get("tka_platform") == platform_id]
            solid = [obj for obj in members if obj.get("tka_role") != "graybox-cloud-collar"]
            solid_bounds = project_meshes(camera, solid)
            atmospheric_bounds = project_meshes(camera, members)
            platforms[platform_id] = {
                "solidBounds": solid_bounds,
                "atmosphericBounds": atmospheric_bounds,
            }
            overlapping_feathers = [
                name
                for name, bounds in feather_bounds.items()
                if bounds and solid_bounds and rectangles_overlap(solid_bounds, bounds)
            ]
            occlusion_checks.append({
                "preset": preset_name,
                "platform": platform_id,
                "passed": not overlapping_feathers,
                "overlappingFeatherBounds": overlapping_feathers,
            })
        report_views[preset_name] = {
            "featherBounds": feather_bounds,
            "platforms": platforms,
        }

    report = {
        "sceneId": "seraphic-vault",
        "gateId": "playable-graybox",
        "artifactDigests": {
            str(BLEND_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"): sha256(BLEND_PATH),
            str(COORDINATE_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"): sha256(COORDINATE_PATH),
            str(GLB_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"): sha256(GLB_PATH),
        },
        "registeredViews": report_views,
        "checks": {
            "artifact-digest": {
                "passed": True,
                "evidence": "SHA-256 digests captured for the Blender source, derived coordinate manifest, and review GLB.",
            },
            "collision": {
                "passed": all(check["passed"] for check in contract["checks"] if check["name"] == "collision"),
                "evidence": next(check["evidence"] for check in contract["checks"] if check["name"] == "collision"),
            },
            "registered-silhouette-clearance": {
                "passed": all(check["passed"] for check in occlusion_checks),
                "evidence": occlusion_checks,
            },
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "report": str(REPORT_PATH),
        "checks": {
            name: check["passed"] for name, check in report["checks"].items()
        },
    }, indent=2))


main()
