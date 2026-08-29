"""Build Ember's Gate 4 volcanic-world production slice.

The selected Gate 3 target owns the composition: a safe blackglass shelf faces
an asymmetric volcanic escarpment split by one incandescent lava landscape. R7
replaces the graybox-like hero and near-field silhouettes with four selected,
budgeted Meshy geology formations while preserving the continuous R6 country.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import struct
import sys
import zlib
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = PROJECT_ROOT / "docs" / "superpowers" / "specs" / "ember-spatial-directions"
EVIDENCE_DIR = SPEC_DIR / "evidence" / "gate-4-meshy-r1"
TEXTURE_DIR = PROJECT_ROOT / "blender" / "ember-volcanic-world-r7-textures"
BLEND_PATH = PROJECT_ROOT / "blender" / "ember-volcanic-world-production-slice-r7.blend"
RAW_GLB_PATH = PROJECT_ROOT / "static" / "models" / "ember" / "ember-production-slice_raw.glb"
REPORT_PATH = EVIDENCE_DIR / "ember-volcanic-world-production-slice-r7-report.json"
REVISION = "ember-broken-rift-gate4-meshy-r7"
R8_TARGET_EVIDENCE_DIR = SPEC_DIR / "evidence" / "gate-3-terrain-r8"
R8_TARGET_BLEND_PATH = PROJECT_ROOT / "blender" / "ember-geological-world-r8-targets.blend"
R8_PRODUCTION_EVIDENCE_DIR = SPEC_DIR / "evidence" / "gate-4-terrain-r8"
R8_PRODUCTION_BLEND_PATH = PROJECT_ROOT / "blender" / "ember-volcanic-world-production-slice-r8.blend"
R8_PRODUCTION_REPORT_PATH = R8_PRODUCTION_EVIDENCE_DIR / "ember-volcanic-world-production-slice-r8-report.json"
R9_SURFACE_TARGET_EVIDENCE_DIR = SPEC_DIR / "evidence" / "gate-3-surface-r9"
R9_SURFACE_TARGET_BLEND_PATH = PROJECT_ROOT / "blender" / "ember-surface-ecology-r9-targets.blend"
R9_PRODUCTION_EVIDENCE_DIR = SPEC_DIR / "evidence" / "gate-4-surface-r9"
R9_PRODUCTION_BLEND_PATH = PROJECT_ROOT / "blender" / "ember-volcanic-world-production-slice-r9.blend"
R9_PRODUCTION_REPORT_PATH = R9_PRODUCTION_EVIDENCE_DIR / "ember-volcanic-world-production-slice-r9-report.json"
R9_RUNTIME_TEXTURE_DIR = PROJECT_ROOT / "static" / "textures" / "ember-surface-r9"
R10_PRODUCTION_EVIDENCE_DIR = SPEC_DIR / "evidence" / "gate-4-living-caldera-r10"
R10_PRODUCTION_BLEND_PATH = PROJECT_ROOT / "blender" / "ember-volcanic-world-production-slice-r10.blend"
R10_PRODUCTION_REPORT_PATH = R10_PRODUCTION_EVIDENCE_DIR / "ember-volcanic-world-production-slice-r10-report.json"
R8_TERRAIN_DIRECTIONS = (
    "breached-caldera-terraces",
    "collapsed-lava-delta",
    "basalt-badlands",
)
PRODUCTION_TERRAIN_DIRECTIONS = (*R8_TERRAIN_DIRECTIONS, "living-caldera")
R9_SURFACE_DIRECTIONS = (
    "fresh-flow-field",
    "ash-choked-caldera",
    "hydrothermal-rift",
    "fresh-rift-synthesis",
)
R9_SURFACE_FAMILIES = {
    "fresh-flow-field": (
        {
            "slug": "roped-pahoehoe",
            "label": "Roped pahoehoe",
            "pattern": "rope",
            "dark": (0.006, 0.011, 0.012),
            "light": (0.075, 0.086, 0.083),
            "accent": (0.16, 0.045, 0.009),
            "roughness": (0.47, 0.79),
            "normal": 27.0,
        },
        {
            "slug": "aa-clinker",
            "label": "A'a clinker",
            "pattern": "clinker",
            "dark": (0.025, 0.018, 0.015),
            "light": (0.135, 0.1, 0.072),
            "accent": (0.24, 0.065, 0.012),
            "roughness": (0.76, 0.98),
            "normal": 34.0,
        },
        {
            "slug": "fractured-basalt",
            "label": "Fresh fractured basalt",
            "pattern": "fracture",
            "dark": (0.011, 0.021, 0.023),
            "light": (0.105, 0.125, 0.12),
            "accent": (0.19, 0.075, 0.022),
            "roughness": (0.64, 0.92),
            "normal": 30.0,
        },
        {
            "slug": "windborne-ash",
            "label": "Windborne ash pockets",
            "pattern": "ash",
            "dark": (0.035, 0.039, 0.038),
            "light": (0.14, 0.135, 0.12),
            "accent": (0.18, 0.125, 0.065),
            "roughness": (0.91, 0.995),
            "normal": 8.0,
        },
    ),
    "ash-choked-caldera": (
        {
            "slug": "compacted-ash",
            "label": "Compacted ash blanket",
            "pattern": "ash",
            "dark": (0.05, 0.052, 0.05),
            "light": (0.185, 0.175, 0.155),
            "accent": (0.23, 0.17, 0.09),
            "roughness": (0.94, 1.0),
            "normal": 7.0,
        },
        {
            "slug": "lapilli-fall",
            "label": "Lapilli fall",
            "pattern": "lapilli",
            "dark": (0.028, 0.026, 0.023),
            "light": (0.145, 0.122, 0.1),
            "accent": (0.24, 0.09, 0.022),
            "roughness": (0.84, 0.99),
            "normal": 24.0,
        },
        {
            "slug": "exposed-basalt",
            "label": "Exposed basalt scarps",
            "pattern": "fracture",
            "dark": (0.009, 0.019, 0.022),
            "light": (0.105, 0.135, 0.135),
            "accent": (0.17, 0.065, 0.02),
            "roughness": (0.73, 0.95),
            "normal": 25.0,
        },
        {
            "slug": "lava-baked-crust",
            "label": "Lava-baked ash crust",
            "pattern": "sinter",
            "dark": (0.04, 0.015, 0.009),
            "light": (0.19, 0.065, 0.018),
            "accent": (0.36, 0.105, 0.012),
            "roughness": (0.72, 0.96),
            "normal": 20.0,
        },
    ),
    "hydrothermal-rift": (
        {
            "slug": "wet-obsidian",
            "label": "Wet obsidian",
            "pattern": "wet",
            "dark": (0.004, 0.011, 0.014),
            "light": (0.105, 0.19, 0.2),
            "accent": (0.18, 0.32, 0.3),
            "roughness": (0.28, 0.66),
            "normal": 15.0,
        },
        {
            "slug": "iron-oxide",
            "label": "Iron oxide drainage",
            "pattern": "oxide",
            "dark": (0.045, 0.014, 0.007),
            "light": (0.22, 0.055, 0.012),
            "accent": (0.42, 0.13, 0.014),
            "roughness": (0.68, 0.94),
            "normal": 19.0,
        },
        {
            "slug": "sulfur-sinter",
            "label": "Sulfur sinter",
            "pattern": "sinter",
            "dark": (0.035, 0.03, 0.006),
            "light": (0.15, 0.13, 0.035),
            "accent": (0.24, 0.19, 0.05),
            "roughness": (0.82, 0.99),
            "normal": 16.0,
        },
        {
            "slug": "steam-bleached-basalt",
            "label": "Steam-bleached basalt",
            "pattern": "bleached",
            "dark": (0.065, 0.075, 0.072),
            "light": (0.19, 0.205, 0.185),
            "accent": (0.15, 0.205, 0.19),
            "roughness": (0.86, 0.995),
            "normal": 13.0,
        },
    ),
    "fresh-rift-synthesis": (
        {
            "slug": "roped-pahoehoe",
            "label": "Roped pahoehoe",
            "pattern": "rope",
            "dark": (0.006, 0.011, 0.012),
            "light": (0.075, 0.086, 0.083),
            "accent": (0.16, 0.045, 0.009),
            "roughness": (0.47, 0.79),
            "normal": 27.0,
        },
        {
            "slug": "iron-contact-crust",
            "label": "Iron-rich contact crust",
            "pattern": "oxide",
            "dark": (0.035, 0.013, 0.007),
            "light": (0.19, 0.05, 0.012),
            "accent": (0.34, 0.105, 0.012),
            "roughness": (0.7, 0.94),
            "normal": 19.0,
        },
        {
            "slug": "fractured-basalt",
            "label": "Fresh fractured basalt",
            "pattern": "fracture",
            "dark": (0.011, 0.021, 0.023),
            "light": (0.105, 0.125, 0.12),
            "accent": (0.19, 0.075, 0.022),
            "roughness": (0.64, 0.92),
            "normal": 30.0,
        },
        {
            "slug": "windborne-ash",
            "label": "Windborne ash pockets",
            "pattern": "ash",
            "dark": (0.035, 0.039, 0.038),
            "light": (0.14, 0.135, 0.12),
            "accent": (0.18, 0.125, 0.065),
            "roughness": (0.91, 0.995),
            "normal": 8.0,
        },
    ),
}
MESHY_GEOLOGY_DIR = PROJECT_ROOT / "static" / "models" / "ember" / "meshy-geology"
WORLD_CONTRACT_PATH = (
    PROJECT_ROOT
    / "src"
    / "lib"
    / "shared"
    / "3d"
    / "environments"
    / "domain"
    / "models"
    / "scene-configs"
    / "ember-volcanic-world-r7.json"
)
WORLD_CONTRACT = json.loads(WORLD_CONTRACT_PATH.read_text(encoding="utf-8"))
RIVER_POINTS_RUNTIME = [
    tuple(float(value) for value in point)
    for point in WORLD_CONTRACT["lavaRiver"]["pointsRuntimeXZHeight"]
]
RIVER_POINTS_BLENDER = [
    (x, -runtime_z, height) for x, runtime_z, height in RIVER_POINTS_RUNTIME
]
ACTION_RADIUS = 4.5
SURFACE_Z = 0.5
HERO_CENTER = (-8.5, -27.0, 5.25)

SHELF_OUTLINE = [
    (-8.4, 5.6),
    (-5.8, 7.0),
    (-1.2, 6.15),
    (3.2, 6.0),
    (7.7, 3.35),
    (7.25, -0.55),
    (5.45, -3.15),
    (6.55, -6.35),
    (3.15, -9.25),
    (-0.65, -8.15),
    (-3.1, -10.45),
    (-6.55, -7.6),
    (-5.5, -3.1),
    (-8.0, -0.65),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def make_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def tag(obj: bpy.types.Object, role: str, element_id: str) -> None:
    obj["tka_scene"] = "ember"
    obj["tka_revision"] = REVISION
    obj["tka_gate"] = 4
    obj["tka_role"] = role
    obj["tka_element"] = element_id


def import_meshy_geology(
    source_name: str,
    object_name: str,
    position: tuple[float, float, float],
    target_height: float,
    rotation_degrees: float,
    role: str,
    element_id: str,
    source_task_id: str,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    """Import one selected Meshy formation, normalize it, and retain provenance."""

    source_path = MESHY_GEOLOGY_DIR / source_name
    if not source_path.exists():
        raise FileNotFoundError(f"Missing prepared Meshy geology: {source_path}")
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    helper_objects = [obj for obj in imported if obj.type != "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh objects imported from {source_path}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        if obj.parent is not None:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
            obj.select_set(False)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    formation = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    minimum, maximum = combined_bounds([formation])
    height = maximum.z - minimum.z
    if height <= 0:
        raise RuntimeError(f"Invalid zero-height Meshy formation: {source_path}")
    formation.scale *= target_height / height
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    minimum, maximum = combined_bounds([formation])
    center = (minimum + maximum) * 0.5
    formation.location += Vector((-center.x, -center.y, -minimum.z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    formation.name = object_name
    formation.rotation_euler[2] = math.radians(rotation_degrees)
    formation.location = position
    move_to_collection(formation, collection)
    for index, material in enumerate(formation.data.materials):
        if material is not None:
            material.name = f"Ember_Meshy_Geology_PBR_{element_id}_{index + 1:02d}"
    tag(formation, role, element_id)
    formation["tka_authorship"] = "meshy-selected-multiview-r7"
    formation["tka_meshy_source_task_id"] = source_task_id
    formation["tka_source_asset"] = source_path.relative_to(PROJECT_ROOT).as_posix()
    formation["tka_target_height_m"] = target_height
    dimensions = formation.dimensions
    formation["tka_radial_clearance"] = max(
        0.0,
        math.hypot(position[0], position[1])
        - math.hypot(dimensions.x * 0.5, dimensions.y * 0.5),
    )

    for obj in helper_objects:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    return formation


def smooth_noise(values: np.ndarray, passes: int) -> np.ndarray:
    result = values
    for _ in range(passes):
        result = (
            result
            + np.roll(result, 1, axis=0)
            + np.roll(result, -1, axis=0)
            + np.roll(result, 1, axis=1)
            + np.roll(result, -1, axis=1)
        ) / 5.0
    return result


def write_png(texture_path: Path, pixels: np.ndarray) -> None:
    height, width, _ = pixels.shape
    rgba = np.rint(np.clip(pixels, 0.0, 1.0) * 255.0).astype(np.uint8)
    scanlines = b"".join(b"\x00" + row.tobytes() for row in rgba)

    def png_chunk(kind: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    texture_path.parent.mkdir(parents=True, exist_ok=True)
    texture_path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(scanlines, 9))
        + png_chunk(b"IEND", b"")
    )


def save_texture(name: str, pixels: np.ndarray, colorspace: str = "sRGB") -> bpy.types.Image:
    texture_path = TEXTURE_DIR / f"{name}.png"
    write_png(texture_path, pixels)
    image = bpy.data.images.load(str(texture_path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = colorspace
    return image


def create_blackglass_textures(
    size: int = 512,
) -> tuple[bpy.types.Image, bpy.types.Image, bpy.types.Image]:
    rng = np.random.default_rng(250825)
    fine = smooth_noise(rng.random((size, size), dtype=np.float32), 3)
    medium = smooth_noise(rng.random((size, size), dtype=np.float32), 8)
    broad = smooth_noise(rng.random((size, size), dtype=np.float32), 20)

    x = np.linspace(0.0, math.tau * 9.0, size, dtype=np.float32)
    y = np.linspace(0.0, math.tau * 7.0, size, dtype=np.float32)
    folded = np.abs(np.sin(x[None, :] * 0.19 + np.sin(y[:, None] * 0.17) * 1.1))
    height = fine * 0.23 + medium * 0.37 + broad * 0.37 + folded * 0.03
    height = (height - height.min()) / max(0.0001, float(height.max() - height.min()))

    cold_dark = np.array([0.009, 0.027, 0.03], dtype=np.float32)
    cold_face = np.array([0.095, 0.225, 0.23], dtype=np.float32)
    blend = np.clip((height - 0.12) * 0.96, 0.0, 1.0)[:, :, None]
    color_rgb = cold_dark[None, None, :] * (1.0 - blend) + cold_face[None, None, :] * blend

    mineral = np.clip((medium - 0.535) * 10.0, 0.0, 1.0)
    mineral *= np.clip((broad - 0.49) * 5.5, 0.0, 1.0)
    mineral = smooth_noise(mineral, 4)[:, :, None]
    ochre = np.array([0.37, 0.31, 0.16], dtype=np.float32)
    color_rgb = color_rgb * (1.0 - mineral * 0.24) + ochre[None, None, :] * mineral * 0.24

    alpha = np.ones((size, size, 1), dtype=np.float32)
    color = np.concatenate((color_rgb, alpha), axis=2)

    roughness_value = np.clip(0.74 + fine * 0.14 + medium * 0.11 - folded * 0.018, 0.72, 0.96)
    roughness = np.concatenate((np.repeat(roughness_value[:, :, None], 3, axis=2), alpha), axis=2)

    gradient_y, gradient_x = np.gradient(height)
    normal = np.dstack((-gradient_x * 24.0, -gradient_y * 24.0, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    normal_rgb = normal * 0.5 + 0.5
    normal_map = np.concatenate((normal_rgb, alpha), axis=2)

    return (
        save_texture("blackglass-color", color),
        save_texture("blackglass-roughness", roughness, "Non-Color"),
        save_texture("blackglass-normal", normal_map, "Non-Color"),
    )


def create_basalt_textures(
    name: str,
    *,
    size: int = 512,
    seed: int,
    fresh_fracture: bool = False,
) -> tuple[bpy.types.Image, bpy.types.Image, bpy.types.Image]:
    """Bake stratified basalt maps that survive the constrained glTF PBR path."""
    rng = np.random.default_rng(seed)
    fine = smooth_noise(rng.random((size, size), dtype=np.float32), 2)
    medium = smooth_noise(rng.random((size, size), dtype=np.float32), 7)
    broad = smooth_noise(rng.random((size, size), dtype=np.float32), 18)

    x = np.linspace(0.0, math.tau * 8.0, size, dtype=np.float32)
    y = np.linspace(0.0, math.tau * 11.0, size, dtype=np.float32)
    strata = np.sin(y[:, None] * 0.28 + np.sin(x[None, :] * 0.21) * 1.55)
    micro_strata = np.sin(y[:, None] * 1.33 + medium * 3.4)
    fracture = np.abs(np.sin(x[None, :] * 0.31 + y[:, None] * 0.17 + broad * 5.8))
    # Basalt should reveal scale through mottling and fractures, not repeat as
    # obvious horizontal wallpaper across every tall joint.
    height = fine * 0.24 + medium * 0.32 + broad * 0.34 + strata * 0.022 + micro_strata * 0.012
    if fresh_fracture:
        height += fracture * 0.12
    height = (height - height.min()) / max(0.0001, float(height.max() - height.min()))

    if fresh_fracture:
        dark = np.array([0.075, 0.09, 0.09], dtype=np.float32)
        face = np.array([0.30, 0.34, 0.32], dtype=np.float32)
        warm = np.array([0.34, 0.21, 0.105], dtype=np.float32)
    else:
        dark = np.array([0.012, 0.024, 0.026], dtype=np.float32)
        face = np.array([0.105, 0.155, 0.15], dtype=np.float32)
        warm = np.array([0.24, 0.12, 0.052], dtype=np.float32)

    blend = np.clip((height - 0.1) * 1.02, 0.0, 1.0)[:, :, None]
    color_rgb = dark[None, None, :] * (1.0 - blend) + face[None, None, :] * blend
    oxidation = np.clip((medium - 0.535) * 8.5, 0.0, 1.0)
    oxidation *= np.clip((0.58 - broad) * 7.0, 0.0, 1.0)
    oxidation *= np.clip((fracture - 0.18) * 1.25, 0.0, 1.0)
    oxidation = smooth_noise(oxidation, 3)[:, :, None]
    color_rgb = color_rgb * (1.0 - oxidation * 0.34) + warm[None, None, :] * oxidation * 0.34

    alpha = np.ones((size, size, 1), dtype=np.float32)
    color = np.concatenate((color_rgb, alpha), axis=2)
    roughness_value = np.clip(
        (0.73 if fresh_fracture else 0.82) + fine * 0.13 + medium * 0.08 - fracture * 0.055,
        0.56,
        0.97,
    )
    roughness = np.concatenate((np.repeat(roughness_value[:, :, None], 3, axis=2), alpha), axis=2)

    gradient_y, gradient_x = np.gradient(height)
    normal = np.dstack((-gradient_x * 18.0, -gradient_y * 18.0, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    normal_map = np.concatenate((normal * 0.5 + 0.5, alpha), axis=2)

    return (
        save_texture(f"{name}-color", color),
        save_texture(f"{name}-roughness", roughness, "Non-Color"),
        save_texture(f"{name}-normal", normal_map, "Non-Color"),
    )


def normalize_field(values: np.ndarray) -> np.ndarray:
    minimum = float(values.min())
    extent = float(values.max()) - minimum
    return (values - minimum) / max(extent, 0.0001)


def create_r9_surface_textures(
    direction: str,
    family_index: int,
    size: int = 512,
) -> tuple[bpy.types.Image, bpy.types.Image, bpy.types.Image]:
    """Bake one of the four material families used by an R9 visual target."""

    specification = R9_SURFACE_FAMILIES[direction][family_index]
    seed = 290_000 + R9_SURFACE_DIRECTIONS.index(direction) * 10_000 + family_index * 137
    rng = np.random.default_rng(seed)
    fine = smooth_noise(rng.random((size, size), dtype=np.float32), 2)
    medium = smooth_noise(rng.random((size, size), dtype=np.float32), 7)
    broad = smooth_noise(rng.random((size, size), dtype=np.float32), 20)
    x_values = np.linspace(0.0, math.tau * 8.0, size, dtype=np.float32)
    y_values = np.linspace(0.0, math.tau * 8.0, size, dtype=np.float32)
    x, y = np.meshgrid(x_values, y_values)
    pattern = str(specification["pattern"])

    if pattern == "rope":
        rope_a = np.exp(
            -np.abs(
                np.sin(y * 0.37 + np.sin(x * 0.15 + broad * 3.0) * 2.2 + medium * 5.5)
            )
            * 4.5
        )
        rope_b = np.exp(
            -np.abs(np.sin(x * 0.18 + y * 0.22 + broad * 7.0)) * 6.0
        )
        folded = normalize_field(rope_a * 0.74 + rope_b * 0.26)
        height = broad * 0.43 + medium * 0.2 + fine * 0.08 + folded * 0.29
        accent_mask = smooth_noise(
            np.clip((0.34 - folded) * 3.0, 0.0, 1.0)
            * np.clip((0.55 - broad) * 5.0, 0.0, 1.0),
            3,
        )
    elif pattern == "clinker":
        blocks = np.clip((medium - 0.44) * 4.8, 0.0, 1.0)
        shards = np.clip((fine - 0.49) * 10.0, 0.0, 1.0)
        height = broad * 0.24 + medium * 0.28 + blocks * 0.33 + shards * 0.15
        accent_mask = smooth_noise(blocks * np.clip((0.56 - broad) * 5.0, 0.0, 1.0), 2)
    elif pattern == "fracture":
        crack_a = np.exp(-np.abs(np.sin(x * 0.31 + np.sin(y * 0.17) * 1.8)) * 15.0)
        crack_b = np.exp(-np.abs(np.sin(y * 0.27 - x * 0.09 + broad * 4.0)) * 17.0)
        cracks = np.clip(crack_a + crack_b, 0.0, 1.0)
        height = broad * 0.47 + medium * 0.33 + fine * 0.12 - cracks * 0.28
        accent_mask = smooth_noise(cracks * np.clip((0.58 - medium) * 5.0, 0.0, 1.0), 1)
    elif pattern == "ash":
        dunes = 0.5 + 0.5 * np.sin(y * 0.09 + np.sin(x * 0.11) * 1.5 + broad * 4.0)
        height = broad * 0.7 + medium * 0.2 + fine * 0.035 + dunes * 0.065
        accent_mask = smooth_noise(np.clip((medium - 0.555) * 7.0, 0.0, 1.0), 5)
    elif pattern == "lapilli":
        pebbles = np.clip((fine - 0.505) * 15.0, 0.0, 1.0)
        clusters = np.clip((medium - 0.47) * 5.5, 0.0, 1.0)
        height = broad * 0.34 + medium * 0.22 + pebbles * clusters * 0.44
        accent_mask = smooth_noise(pebbles * np.clip((0.6 - broad) * 5.5, 0.0, 1.0), 1)
    elif pattern == "sinter":
        pools = 0.5 + 0.5 * np.sin(
            np.sqrt((x - 18.0) ** 2 + (y - 27.0) ** 2) * 0.9 + broad * 6.0
        )
        crust = np.power(np.clip(pools, 0.0, 1.0), 2.0)
        height = broad * 0.39 + medium * 0.2 + crust * 0.32 + fine * 0.09
        accent_mask = smooth_noise(np.clip((crust - 0.42) * 2.4, 0.0, 1.0), 2)
    elif pattern == "wet":
        glass = 0.5 + 0.5 * np.sin(x * 0.12 - y * 0.07 + broad * 8.0)
        height = broad * 0.57 + medium * 0.24 + fine * 0.07 + glass * 0.12
        accent_mask = smooth_noise(np.clip((broad - 0.53) * 8.0, 0.0, 1.0), 4)
    elif pattern == "oxide":
        drainage = 0.5 + 0.5 * np.sin(x * 0.13 + np.sin(y * 0.075) * 2.0 + broad * 7.0)
        height = broad * 0.43 + medium * 0.31 + fine * 0.08 + drainage * 0.18
        accent_mask = smooth_noise(
            np.clip((drainage - 0.52) * 4.4, 0.0, 1.0)
            * np.clip((0.6 - medium) * 6.0, 0.0, 1.0),
            2,
        )
    elif pattern == "bleached":
        plumes = 0.5 + 0.5 * np.sin(x * 0.08 + y * 0.045 + broad * 7.0)
        height = broad * 0.54 + medium * 0.27 + fine * 0.07 + plumes * 0.12
        accent_mask = smooth_noise(np.clip((plumes - 0.56) * 4.2, 0.0, 1.0), 5)
    else:
        raise ValueError(f"Unknown R9 surface pattern: {pattern}")

    height = normalize_field(height)
    dark = np.array(specification["dark"], dtype=np.float32)
    light = np.array(specification["light"], dtype=np.float32)
    accent = np.array(specification["accent"], dtype=np.float32)
    color_mix = np.clip((height - 0.08) * 1.06, 0.0, 1.0)[:, :, None]
    color_rgb = dark[None, None, :] * (1.0 - color_mix) + light[None, None, :] * color_mix
    accent_strength = 0.34 if pattern == "sinter" else 0.26
    accent_weight = np.clip(accent_mask, 0.0, 1.0)[:, :, None] * accent_strength
    color_rgb = color_rgb * (1.0 - accent_weight) + accent[None, None, :] * accent_weight
    macro_variation = (0.89 + broad[:, :, None] * 0.21).astype(np.float32)
    color_rgb *= macro_variation

    alpha = np.ones((size, size, 1), dtype=np.float32)
    color = np.concatenate((color_rgb, alpha), axis=2)
    rough_min, rough_max = (float(value) for value in specification["roughness"])
    roughness_value = np.clip(
        rough_min + (rough_max - rough_min) * (0.22 + fine * 0.31 + medium * 0.47),
        rough_min,
        rough_max,
    )
    if pattern == "wet":
        roughness_value -= accent_mask * 0.16
    roughness_value = np.clip(roughness_value, 0.18, 1.0)
    roughness = np.concatenate(
        (np.repeat(roughness_value[:, :, None], 3, axis=2), alpha), axis=2
    )

    gradient_y, gradient_x = np.gradient(height)
    normal_scale = float(specification["normal"])
    normal = np.dstack(
        (-gradient_x * normal_scale, -gradient_y * normal_scale, np.ones_like(height))
    )
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    normal_map = np.concatenate((normal * 0.5 + 0.5, alpha), axis=2)
    prefix = f"r9-{direction}-{specification['slug']}"
    return (
        save_texture(f"{prefix}-color", color),
        save_texture(f"{prefix}-roughness", roughness, "Non-Color"),
        save_texture(f"{prefix}-normal", normal_map, "Non-Color"),
    )


def create_texture_material(
    name: str,
    role: str,
    textures: tuple[bpy.types.Image, bpy.types.Image, bpy.types.Image],
    *,
    base_color: tuple[float, float, float, float],
    roughness: float,
    metallic: float,
    normal_strength: float,
) -> bpy.types.Material:
    color_image, roughness_image, normal_image = textures
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    color_node = nodes.new("ShaderNodeTexImage")
    color_node.name = f"{name}_Color"
    color_node.image = color_image
    color_node.extension = "REPEAT"
    links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])

    roughness_node = nodes.new("ShaderNodeTexImage")
    roughness_node.name = f"{name}_Roughness"
    roughness_node.image = roughness_image
    roughness_node.extension = "REPEAT"
    links.new(roughness_node.outputs["Color"], bsdf.inputs["Roughness"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = f"{name}_Normal"
    normal_node.image = normal_image
    normal_node.extension = "REPEAT"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = normal_strength
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    material["tka_material_role"] = role
    return material


def create_blackglass_material(
    textures: tuple[bpy.types.Image, bpy.types.Image, bpy.types.Image],
) -> bpy.types.Material:
    return create_texture_material(
        "Ember_Ground_Blackglass_PBR",
        "rough-blackglass",
        textures,
        base_color=(0.03, 0.07, 0.1, 1.0),
        roughness=0.84,
        metallic=0.04,
        normal_strength=0.36,
    )


def create_r9_surface_materials(direction: str) -> list[bpy.types.Material]:
    materials: list[bpy.types.Material] = []
    for family_index, specification in enumerate(R9_SURFACE_FAMILIES[direction]):
        textures = create_r9_surface_textures(direction, family_index)
        rough_min, rough_max = (float(value) for value in specification["roughness"])
        material = create_texture_material(
            f"Ember_R9_{direction}_{specification['slug']}",
            f"r9-surface-{direction}-{specification['slug']}",
            textures,
            base_color=(*specification["light"], 1.0),
            roughness=(rough_min + rough_max) * 0.5,
            metallic=0.075 if specification["pattern"] == "wet" else 0.012,
            normal_strength=0.58 if specification["pattern"] != "ash" else 0.24,
        )
        material["tka_surface_direction"] = direction
        material["tka_surface_family_index"] = family_index
        material["tka_surface_family_label"] = specification["label"]
        materials.append(material)
    return materials


def r9_material_image(
    material: bpy.types.Material,
    suffix: str,
) -> bpy.types.Image:
    for node in material.node_tree.nodes:
        if node.bl_idname == "ShaderNodeTexImage" and node.name.endswith(suffix):
            if node.image is None:
                break
            return node.image
    raise RuntimeError(f"Missing {suffix} texture node on {material.name}")


def create_r9_blended_terrain_material(
    direction: str,
    family_materials: list[bpy.types.Material],
) -> bpy.types.Material:
    """Blend the four target families through a smooth per-vertex RGBA mask."""

    material = bpy.data.materials.new(f"Ember_R9_{direction}_Blended_Terrain")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (980.0, 0.0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (690.0, 0.0)
    bsdf.inputs["Metallic"].default_value = 0.018
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    vertex_color = nodes.new("ShaderNodeVertexColor")
    vertex_color.layer_name = "R9SurfaceMask"
    vertex_color.location = (-1120.0, 520.0)
    separate = nodes.new("ShaderNodeSeparateColor")
    separate.mode = "RGB"
    separate.location = (-900.0, 520.0)
    links.new(vertex_color.outputs["Color"], separate.inputs["Color"])
    weights = [
        separate.outputs["Red"],
        separate.outputs["Green"],
        separate.outputs["Blue"],
    ]
    sum_rg = nodes.new("ShaderNodeMath")
    sum_rg.operation = "ADD"
    sum_rg.location = (-690.0, 620.0)
    links.new(weights[0], sum_rg.inputs[0])
    links.new(weights[1], sum_rg.inputs[1])
    sum_rgb = nodes.new("ShaderNodeMath")
    sum_rgb.operation = "ADD"
    sum_rgb.location = (-510.0, 620.0)
    links.new(sum_rg.outputs[0], sum_rgb.inputs[0])
    links.new(weights[2], sum_rgb.inputs[1])
    fourth = nodes.new("ShaderNodeMath")
    fourth.operation = "SUBTRACT"
    fourth.use_clamp = True
    fourth.inputs[0].default_value = 1.0
    fourth.location = (-320.0, 620.0)
    links.new(sum_rgb.outputs[0], fourth.inputs[1])
    weights.append(fourth.outputs[0])

    weighted_colors: list[bpy.types.NodeSocket] = []
    weighted_normals: list[bpy.types.NodeSocket] = []
    weighted_roughness: list[bpy.types.NodeSocket] = []
    for family_index, family_material in enumerate(family_materials):
        vertical = 300.0 - family_index * 260.0
        color_image = nodes.new("ShaderNodeTexImage")
        color_image.image = r9_material_image(family_material, "_Color")
        color_image.extension = "REPEAT"
        color_image.location = (-1120.0, vertical)
        roughness_image = nodes.new("ShaderNodeTexImage")
        roughness_image.image = r9_material_image(family_material, "_Roughness")
        roughness_image.extension = "REPEAT"
        roughness_image.location = (-1120.0, vertical - 80.0)
        normal_image = nodes.new("ShaderNodeTexImage")
        normal_image.image = r9_material_image(family_material, "_Normal")
        normal_image.extension = "REPEAT"
        normal_image.location = (-1120.0, vertical - 160.0)

        color_multiply = nodes.new("ShaderNodeMixRGB")
        color_multiply.blend_type = "MULTIPLY"
        color_multiply.inputs[0].default_value = 1.0
        color_multiply.location = (-690.0, vertical)
        links.new(color_image.outputs["Color"], color_multiply.inputs[1])
        links.new(weights[family_index], color_multiply.inputs[2])
        weighted_colors.append(color_multiply.outputs["Color"])

        roughness_to_value = nodes.new("ShaderNodeRGBToBW")
        roughness_to_value.location = (-890.0, vertical - 80.0)
        links.new(roughness_image.outputs["Color"], roughness_to_value.inputs["Color"])
        roughness_multiply = nodes.new("ShaderNodeMath")
        roughness_multiply.operation = "MULTIPLY"
        roughness_multiply.location = (-690.0, vertical - 80.0)
        links.new(roughness_to_value.outputs["Val"], roughness_multiply.inputs[0])
        links.new(weights[family_index], roughness_multiply.inputs[1])
        weighted_roughness.append(roughness_multiply.outputs[0])

        normal_multiply = nodes.new("ShaderNodeMixRGB")
        normal_multiply.blend_type = "MULTIPLY"
        normal_multiply.inputs[0].default_value = 1.0
        normal_multiply.location = (-690.0, vertical - 160.0)
        links.new(normal_image.outputs["Color"], normal_multiply.inputs[1])
        links.new(weights[family_index], normal_multiply.inputs[2])
        weighted_normals.append(normal_multiply.outputs["Color"])

    def add_color_outputs(
        sockets: list[bpy.types.NodeSocket],
        y: float,
    ) -> bpy.types.NodeSocket:
        current = sockets[0]
        for index, socket in enumerate(sockets[1:], start=1):
            add = nodes.new("ShaderNodeMixRGB")
            add.blend_type = "ADD"
            add.inputs[0].default_value = 1.0
            add.location = (-340.0 + index * 150.0, y)
            links.new(current, add.inputs[1])
            links.new(socket, add.inputs[2])
            current = add.outputs["Color"]
        return current

    def add_value_outputs(
        sockets: list[bpy.types.NodeSocket],
        y: float,
    ) -> bpy.types.NodeSocket:
        current = sockets[0]
        for index, socket in enumerate(sockets[1:], start=1):
            add = nodes.new("ShaderNodeMath")
            add.operation = "ADD"
            add.location = (-340.0 + index * 150.0, y)
            links.new(current, add.inputs[0])
            links.new(socket, add.inputs[1])
            current = add.outputs[0]
        return current

    color_output = add_color_outputs(weighted_colors, 250.0)
    normal_output = add_color_outputs(weighted_normals, -250.0)
    roughness_output = add_value_outputs(weighted_roughness, -20.0)
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.46
    normal_map.location = (440.0, -230.0)
    links.new(normal_output, normal_map.inputs["Color"])
    links.new(color_output, bsdf.inputs["Base Color"])
    links.new(roughness_output, bsdf.inputs["Roughness"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    material["tka_material_role"] = f"r9-surface-{direction}-blended-terrain"
    material["tka_surface_direction"] = direction
    material["tka_surface_mask"] = "R9SurfaceMask"
    return material


def publish_r9_runtime_surface_assets(
    family_materials: list[bpy.types.Material],
    river: list[Vector],
    size: int = 1024,
) -> dict[str, object]:
    """Publish the selected families and one smooth world-space ecology mask."""

    R9_RUNTIME_TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    runtime_names = (
        "young-lava.png",
        "iron-contact.png",
        "fractured-basalt.png",
        "sheltered-ash.png",
    )
    published: list[dict[str, object]] = []
    for material, runtime_name in zip(family_materials, runtime_names, strict=True):
        image = r9_material_image(material, "_Color")
        source = Path(bpy.path.abspath(image.filepath))
        destination = R9_RUNTIME_TEXTURE_DIR / runtime_name
        destination.write_bytes(source.read_bytes())
        published.append(
            {
                "path": destination.relative_to(PROJECT_ROOT).as_posix(),
                "bytes": destination.stat().st_size,
                "sha256": sha256(destination),
            }
        )

    terrain = WORLD_CONTRACT["terrain"]
    x_min, x_max = (float(value) for value in terrain["runtimeXRange"])
    z_min, z_max = (float(value) for value in terrain["runtimeZRange"])
    x_values = np.linspace(x_min, x_max, size, dtype=np.float32)
    z_values = np.linspace(z_min, z_max, size, dtype=np.float32)
    grid_x, grid_z = np.meshgrid(x_values, z_values)

    # The runtime river follows a centripetal spline. The Blender builder has
    # already sampled that contract densely, so the mask measures against the
    # same curve rather than a second hand-authored approximation.
    river_points = np.array(
        [(float(point.x), float(-point.y)) for point in river],
        dtype=np.float32,
    )
    river_distance = np.full(grid_x.shape, np.inf, dtype=np.float32)
    for start, end in zip(river_points, river_points[1:]):
        segment_x = float(end[0] - start[0])
        segment_z = float(end[1] - start[1])
        length_squared = max(segment_x * segment_x + segment_z * segment_z, 0.0001)
        projection = np.clip(
            ((grid_x - start[0]) * segment_x + (grid_z - start[1]) * segment_z)
            / length_squared,
            0.0,
            1.0,
        )
        closest_x = start[0] + projection * segment_x
        closest_z = start[1] + projection * segment_z
        distance = np.sqrt((grid_x - closest_x) ** 2 + (grid_z - closest_z) ** 2)
        river_distance = np.minimum(river_distance, distance)

    def field_smoothstep(edge_start: float, edge_end: float, values: np.ndarray) -> np.ndarray:
        blend = np.clip((values - edge_start) / (edge_end - edge_start), 0.0, 1.0)
        return blend * blend * (3.0 - 2.0 * blend)

    contact = 1.0 - field_smoothstep(5.0, 14.5, river_distance)
    drainage = 0.62 + 0.38 * (
        0.5
        + 0.5
        * np.sin(grid_x * 0.19 + grid_z * 0.055 + np.sin(grid_z * 0.031) * 2.4)
    )
    contact *= drainage

    caldera_x = (grid_x + 10.0) / 1.13
    caldera_z = (grid_z - 74.0) / 0.84
    caldera_radius = np.sqrt(caldera_x * caldera_x + caldera_z * caldera_z)
    angle = np.arctan2(caldera_z, caldera_x)
    rim = np.exp(-((caldera_radius - 102.0) / 23.0) ** 2)
    broken_arc = 0.22 + 0.78 * field_smoothstep(
        -0.62,
        0.18,
        np.sin(angle + 0.42),
    )
    west_scarp = np.exp(
        -(((grid_x + 72.0) / 31.0) ** 2 + ((grid_z - 38.0) / 76.0) ** 2)
    )
    east_scarp = np.exp(
        -(((grid_x - 96.0) / 42.0) ** 2 + ((grid_z - 64.0) / 88.0) ** 2)
    )
    fractured = np.clip(
        rim * broken_arc * 1.2
        + west_scarp * 0.78
        + east_scarp * 0.84
        + np.abs(np.sin(grid_x * 0.044 - grid_z * 0.071)) * 0.12,
        0.0,
        1.0,
    )

    pocket_phase = (
        0.5
        + 0.5
        * np.sin(grid_x * 0.027 + grid_z * 0.046 + np.sin(grid_x * 0.018) * 3.1)
    )
    ash = field_smoothstep(0.49, 0.79, pocket_phase)
    ash *= (1.0 - fractured * 0.72) * (1.0 - contact * 0.88)
    ash *= 0.48 + 0.52 * field_smoothstep(26.0, 142.0, np.hypot(grid_x, grid_z))

    young_flow = 0.5 + 0.5 * np.sin(
        grid_x * 0.031 - grid_z * 0.024 + np.sin(grid_z * 0.018) * 2.2
    )
    raw_weights = np.stack(
        (
            0.86 + young_flow * 0.28,
            0.04 + contact * 1.75,
            0.12 + fractured * 1.35,
            0.08 + ash * 1.25,
        ),
        axis=2,
    )
    weights = raw_weights / np.maximum(raw_weights.sum(axis=2, keepdims=True), 0.0001)
    alpha = np.ones((size, size, 1), dtype=np.float32)
    mask_pixels = np.concatenate((weights[:, :, :3], alpha), axis=2)
    mask_path = R9_RUNTIME_TEXTURE_DIR / "fresh-rift-family-mask.png"
    write_png(mask_path, mask_pixels)

    return {
        "detailTextures": published,
        "familyMask": {
            "path": mask_path.relative_to(PROJECT_ROOT).as_posix(),
            "bytes": mask_path.stat().st_size,
            "sha256": sha256(mask_path),
            "resolution": [size, size],
            "worldOriginRuntimeXZ": [x_min, z_min],
            "worldSizeRuntimeXZ": [x_max - x_min, z_max - z_min],
            "channels": {
                "red": "young-lava",
                "green": "iron-contact",
                "blue": "fractured-basalt",
                "implicitFourth": "sheltered-ash",
            },
        },
    }


def create_plain_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    if emission:
        emission.default_value = color
    emission_strength_input = bsdf.inputs.get("Emission Strength")
    if emission_strength_input:
        emission_strength_input.default_value = emission_strength
    return material


def ensure_counter_clockwise(outline: list[tuple[float, float]]) -> list[tuple[float, float]]:
    area = sum(
        outline[index][0] * outline[(index + 1) % len(outline)][1]
        - outline[(index + 1) % len(outline)][0] * outline[index][1]
        for index in range(len(outline))
    )
    return outline if area > 0.0 else list(reversed(outline))


def scaled_outline(outline: list[tuple[float, float]], scale: float) -> list[tuple[float, float]]:
    center_x = sum(point[0] for point in outline) / len(outline)
    center_y = sum(point[1] for point in outline) / len(outline)
    return [
        (center_x + (x - center_x) * scale, center_y + (y - center_y) * scale)
        for x, y in outline
    ]


def create_extruded_polygon(
    name: str,
    outline: list[tuple[float, float]],
    top_z: float,
    bottom_z: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    role: str,
    element_id: str,
    bevel: float = 0.0,
) -> bpy.types.Object:
    points = ensure_counter_clockwise(outline)
    count = len(points)
    vertices = [(x, y, top_z) for x, y in points] + [(x, y, bottom_z) for x, y in points]
    faces: list[tuple[int, ...]] = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    if bevel > 0.0:
        modifier = obj.modifiers.new("GeologicEdgeSoftening", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    tag(obj, role, element_id)
    project_uv(obj, 4.5)
    return obj


def point_in_polygon(x: float, y: float, outline: list[tuple[float, float]]) -> bool:
    inside = False
    previous = len(outline) - 1
    for current in range(len(outline)):
        xi, yi = outline[current]
        xj, yj = outline[previous]
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
        )
        if intersects:
            inside = not inside
        previous = current
    return inside


def create_surface_field(
    outline: list[tuple[float, float]],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    step = 0.38
    xs = np.arange(-8.6, 7.9, step)
    ys = np.arange(-10.6, 7.2, step)
    vertices: list[tuple[float, float, float]] = []
    grid: dict[tuple[int, int], int] = {}
    for ix, x in enumerate(xs):
        for iy, y in enumerate(ys):
            if not point_in_polygon(float(x), float(y), outline):
                continue
            radius = math.hypot(float(x), float(y))
            relief_ramp = max(0.0, min(1.0, (radius - 4.2) / 2.1))
            relief = (
                math.sin(x * 1.73 + y * 0.39) * 0.026
                + math.sin(y * 1.21 - x * 0.31) * 0.018
                + math.sin((x + y) * 3.1) * 0.007
            ) * relief_ramp
            grid[(ix, iy)] = len(vertices)
            vertices.append((float(x), float(y), SURFACE_Z + 0.003 + relief))

    faces: list[tuple[int, int, int, int]] = []
    for ix in range(len(xs) - 1):
        for iy in range(len(ys) - 1):
            corners = [
                grid.get((ix, iy)),
                grid.get((ix + 1, iy)),
                grid.get((ix + 1, iy + 1)),
                grid.get((ix, iy + 1)),
            ]
            if all(index is not None for index in corners):
                faces.append(tuple(int(index) for index in corners))

    mesh = bpy.data.meshes.new("Ember_Shelf_Surface_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Ember_Shelf_Surface", mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, "playable-surface", "blackglass-shelf-surface")
    project_uv(obj, 3.2)
    return obj


def project_uv(obj: bpy.types.Object, scale: float) -> None:
    if obj.type != "MESH" or not obj.data.polygons:
        return
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.015)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv_layer = obj.data.uv_layers.active
    if uv_layer:
        for loop in uv_layer.data:
            loop.uv *= scale
    obj.select_set(False)


def create_ribbon(
    name: str,
    points: list[tuple[float, float]],
    width: float,
    z: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    role: str,
    element_id: str,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    for index, (x, y) in enumerate(points):
        before = Vector(points[max(0, index - 1)])
        after = Vector(points[min(len(points) - 1, index + 1)])
        tangent = (after - before).normalized()
        normal = Vector((-tangent.y, tangent.x)) * (width * 0.5)
        vertices.extend([(x + normal.x, y + normal.y, z), (x - normal.x, y - normal.y, z)])
    faces = [(index * 2, index * 2 + 1, index * 2 + 3, index * 2 + 2) for index in range(len(points) - 1)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    return obj


def combined_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type == "MESH" for corner in obj.bound_box]
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def decimate_mesh(obj: bpy.types.Object, target_triangles: int) -> None:
    obj.data.calc_loop_triangles()
    triangle_count = len(obj.data.loop_triangles)
    if triangle_count <= target_triangles:
        return
    modifier = obj.modifiers.new("RuntimeGeometryBudget", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.001, target_triangles / triangle_count)
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def create_fault_plate(
    name: str,
    outline: list[tuple[float, float]],
    thickness: float,
    location: tuple[float, float, float],
    rotation_degrees: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    element_id: str,
) -> bpy.types.Object:
    count = len(outline)
    half_thickness = thickness * 0.5
    vertices = [(x, -half_thickness, z) for x, z in outline] + [
        (x, half_thickness, z) for x, z in outline
    ]
    faces: list[tuple[int, ...]] = [
        tuple(reversed(range(count))),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = tuple(math.radians(value) for value in rotation_degrees)
    obj.data.materials.append(material)
    tag(obj, "fractured-gate-fragment", element_id)

    bpy.ops.object.select_all(action="DESELECT")
    triangulate = obj.modifiers.new("FractureTriangulation", "TRIANGULATE")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.subdivide(number_cuts=2, smoothness=0.0)
    bpy.ops.object.mode_set(mode="OBJECT")

    pressure_texture = bpy.data.textures.new(f"{name}_PressureNoise", type="CLOUDS")
    pressure_texture.noise_scale = 0.62
    pressure_texture.noise_depth = 2
    pressure_texture.contrast = 1.35
    displacement = obj.modifiers.new("GeologicPressureWarp", "DISPLACE")
    displacement.texture = pressure_texture
    displacement.texture_coords = "GLOBAL"
    displacement.direction = "NORMAL"
    displacement.strength = 0.16
    displacement.mid_level = 0.52
    bpy.ops.object.modifier_apply(modifier=displacement.name)

    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.select_set(False)
    project_uv(obj, 2.4)
    return obj


def create_authored_fault_crown(
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    plate_specs = [
        (
            "Ember_Fault_Crown_Left",
            [
                (-0.15, 0.0),
                (-2.45, 0.05),
                (-3.25, 0.9),
                (-3.0, 2.45),
                (-2.5, 4.7),
                (-1.35, 7.2),
                (-0.2, 8.8),
                (0.52, 8.05),
                (0.28, 6.65),
                (0.93, 5.1),
                (0.52, 3.45),
                (1.05, 2.05),
                (0.58, 0.75),
            ],
            0.92,
            (0.15, -12.95, 0.3),
            (-3.0, 7.0, -8.0),
            "fault-crown-left-major",
        ),
        (
            "Ember_Fault_Crown_Right",
            [
                (0.2, 0.0),
                (2.75, 0.02),
                (3.25, 0.85),
                (3.1, 2.15),
                (2.48, 4.2),
                (1.48, 6.25),
                (0.2, 7.15),
                (-0.58, 6.45),
                (-0.24, 5.0),
                (-0.82, 3.9),
                (-0.42, 2.45),
                (-0.95, 1.3),
                (-0.48, 0.35),
            ],
            1.08,
            (4.15, -13.1, 0.32),
            (4.0, -8.0, 10.0),
            "fault-crown-right-major",
        ),
        (
            "Ember_Fault_Crown_Left_Splinter",
            [
                (-0.1, 0.0),
                (-1.35, 0.1),
                (-1.8, 1.25),
                (-1.25, 3.5),
                (-0.25, 5.05),
                (0.42, 4.4),
                (0.18, 2.5),
                (0.55, 1.15),
            ],
            0.72,
            (-3.25, -13.8, 0.3),
            (2.0, 12.0, -20.0),
            "fault-crown-left-splinter",
        ),
        (
            "Ember_Fault_Crown_Right_Splinter",
            [
                (0.15, 0.0),
                (1.55, 0.0),
                (2.0, 0.9),
                (1.6, 2.4),
                (0.62, 4.0),
                (-0.2, 3.45),
                (0.08, 2.0),
                (-0.45, 0.8),
            ],
            0.78,
            (7.35, -14.05, 0.28),
            (-2.0, -10.0, 18.0),
            "fault-crown-right-splinter",
        ),
    ]
    return [
        create_fault_plate(
            name,
            outline,
            thickness,
            location,
            rotation,
            material,
            collection,
            element_id,
        )
        for name, outline, thickness, location, rotation, element_id in plate_specs
    ]


def create_shelf_edge_talus(
    outline: list[tuple[float, float]],
    blackglass: bpy.types.Material,
    mineral: bpy.types.Material,
    collection: bpy.types.Collection,
) -> None:
    positions = scaled_outline(outline, 1.018)
    # The closing shelf corner is already covered by its two neighboring
    # fragments. Omitting the redundant final stone also avoids a Blender 5
    # primitive-subdivision anomaly seen only on that closing iteration.
    for index, (x, y) in enumerate(positions[:-1]):
        radial = Vector((x, y)).normalized()
        radius = 0.62 + 0.18 * (0.5 + 0.5 * math.sin(index * 2.17))
        height = 0.36 + 0.22 * (0.5 + 0.5 * math.cos(index * 1.73))
        location = (x + radial.x * 0.18, y + radial.y * 0.18, 0.12 - height * 0.2)
        bpy.ops.object.select_all(action="DESELECT")
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
        obj = bpy.context.object
        obj.name = f"Ember_Shelf_Edge_Talus_{index + 1:02d}"
        obj.scale = (
            radius * (1.35 + 0.18 * math.sin(index * 0.91)),
            radius * (0.72 + 0.16 * math.cos(index * 1.29)),
            height,
        )
        obj.rotation_euler = (
            math.radians(-8.0 + (index % 4) * 5.0),
            math.radians(7.0 - (index % 3) * 6.0),
            math.atan2(radial.y, radial.x) + math.radians(18.0 * math.sin(index * 1.4)),
        )
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for vertex in obj.data.vertices:
            coordinate = vertex.co
            warp = 1.0 + 0.08 * math.sin(
                coordinate.x * 4.7 + coordinate.y * 3.1 + coordinate.z * 5.3 + index
            )
            coordinate *= warp
        move_to_collection(obj, collection)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.materials.append(blackglass)
        tag(obj, "shelf-stratum", f"shelf-edge-talus-{index + 1:02d}")


def create_stage_crust_transition(
    blackglass: bpy.types.Material,
    basalt: bpy.types.Material,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    """Bury the authored floor inside overlapping volcanic crust plates."""

    plate_specs = [
        ("Front_Left", [(-14.2, 10.2), (-5.8, 10.8), (-3.5, 6.0), (-8.2, 4.6), (-12.8, 6.1)], 0.44, blackglass),
        ("Front_Center", [(-6.2, 11.4), (5.4, 11.0), (4.0, 6.0), (-2.0, 5.75), (-5.5, 7.1)], 0.4, basalt),
        ("Front_Right", [(4.6, 10.9), (14.1, 8.6), (11.7, 3.5), (7.2, 2.7), (5.3, 6.0)], 0.46, blackglass),
        ("East", [(11.4, 5.0), (14.6, -2.2), (10.6, -8.4), (6.2, -6.0), (7.2, -0.2)], 0.36, basalt),
        ("Rear_Right", [(10.8, -6.2), (7.1, -13.3), (0.8, -12.1), (2.9, -8.2), (6.5, -8.0)], 0.42, blackglass),
        ("Rear_Center", [(4.0, -12.8), (-5.2, -13.8), (-5.9, -8.4), (-0.8, -7.8), (3.4, -9.0)], 0.34, basalt),
        ("Rear_Left", [(-4.6, -13.1), (-12.8, -9.0), (-10.7, -3.6), (-6.0, -4.8), (-5.7, -8.5)], 0.4, blackglass),
        ("West", [(-12.2, -7.8), (-15.0, -0.4), (-12.6, 6.8), (-7.8, 4.8), (-7.0, -0.8)], 0.38, basalt),
    ]
    plates: list[bpy.types.Object] = []
    for index, (label, outline, top, material) in enumerate(plate_specs, start=1):
        plate = create_extruded_polygon(
            f"Ember_Stage_Crust_{label}",
            ensure_counter_clockwise(outline),
            top,
            top - (0.38 + (index % 3) * 0.07),
            material,
            collection,
            "stage-crust-transition",
            f"stage-crust-transition-{index:02d}",
            bevel=0.08,
        )
        plate.rotation_euler.z = math.radians(math.sin(index * 1.77) * 1.2)
        plate["tka_radial_clearance"] = min(math.hypot(x, y) for x, y in outline)
        plates.append(plate)
    return plates


def create_columnar_joint(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    height: float,
    sides: int,
    lean: tuple[float, float],
    seed: int,
    material: bpy.types.Material,
    cap_material: bpy.types.Material,
    collection: bpy.types.Collection,
    role: str,
    element_id: str,
) -> bpy.types.Object:
    """Author one pressure-warped basalt joint without reading an external mesh."""
    rng = random.Random(seed)
    ring_count = 12
    phase = rng.uniform(-math.pi, math.pi)
    side_scales = [rng.uniform(0.88, 1.12) for _ in range(sides)]
    cap_damage = [rng.uniform(0.0, min(1.15, height * 0.14)) for _ in range(sides)]
    elliptical = rng.uniform(0.82, 1.18)
    twist = rng.uniform(-0.12, 0.12)
    vertices: list[tuple[float, float, float]] = []
    for ring_index in range(ring_count):
        t = ring_index / (ring_count - 1)
        pinch = 1.0 + math.sin(t * math.tau + phase) * 0.035
        pinch += math.sin(t * math.tau * 2.7 - phase) * 0.012
        center_x = lean[0] * t + math.sin(t * math.pi * 1.7 + phase) * radius * 0.055
        center_y = lean[1] * t + math.cos(t * math.pi * 1.45 + phase) * radius * 0.045
        for side_index in range(sides):
            angle = math.tau * side_index / sides + phase + twist * t
            ring_radius = radius * side_scales[side_index] * pinch
            z = height * t
            if ring_index == ring_count - 1:
                z -= cap_damage[side_index]
            vertices.append(
                (
                    center_x + math.cos(angle) * ring_radius * elliptical,
                    center_y + math.sin(angle) * ring_radius / elliptical,
                    z,
                )
            )

    faces: list[tuple[int, ...]] = []
    for ring_index in range(ring_count - 1):
        lower = ring_index * sides
        upper = (ring_index + 1) * sides
        for side_index in range(sides):
            next_side = (side_index + 1) % sides
            faces.append((lower + side_index, lower + next_side, upper + next_side, upper + side_index))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((ring_count - 1) * sides + index for index in range(sides)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(material)
    obj.data.materials.append(cap_material)
    obj.data.polygons[-1].material_index = 1

    bevel = obj.modifiers.new("WeatheredJointEdges", "BEVEL")
    bevel.width = min(0.028, radius * 0.045)
    bevel.segments = 1
    bevel.limit_method = "ANGLE"
    bevel.harden_normals = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)
    project_uv(obj, 2.8)
    uv_layer = obj.data.uv_layers.active
    if uv_layer:
        offset = Vector((rng.uniform(-3.0, 3.0), rng.uniform(-3.0, 3.0)))
        for loop in uv_layer.data:
            loop.uv += offset
    tag(obj, role, element_id)
    obj["tka_joint_sides"] = sides
    obj["tka_joint_height"] = round(height, 4)
    obj["tka_joint_radius"] = round(radius, 4)
    obj["tka_cap_loss_max"] = round(max(cap_damage), 4)
    obj["tka_authorship"] = "scene-authored-deterministic"
    return obj


def create_entablature_fragment(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation: tuple[float, float, float],
    seed: int,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    role: str = "collapsed-entablature",
) -> bpy.types.Object:
    rng = random.Random(seed)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = tuple(math.radians(value) for value in rotation)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for vertex in obj.data.vertices:
        direction = vertex.co.normalized()
        fracture = 1.0 + rng.uniform(-0.13, 0.13) + math.sin(
            vertex.co.x * 4.3 + vertex.co.y * 2.7 + vertex.co.z * 5.1 + seed
        ) * 0.055
        vertex.co = direction * vertex.co.length * fracture
    move_to_collection(obj, collection)
    obj.data.materials.append(material)
    tag(obj, role, name.lower().replace("ember_", "").replace("_", "-"))
    obj["tka_authorship"] = "scene-authored-deterministic"
    return obj


def create_eroded_boulder(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation: tuple[float, float, float],
    seed: int,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    role: str,
    element_id: str,
) -> bpy.types.Object:
    """Create one layered, chipped fragment for talus and buried perimeter mass."""
    rng = random.Random(seed)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = tuple(math.radians(value) for value in rotation)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for vertex in obj.data.vertices:
        coordinate = vertex.co
        band = math.sin(coordinate.z * 7.2 + seed * 0.13) * 0.035
        chip = math.sin(coordinate.x * 5.1 + coordinate.y * 3.7 + coordinate.z * 4.3 + seed)
        radial = 1.0 + band + chip * 0.045 + rng.uniform(-0.025, 0.025)
        coordinate *= radial
        coordinate.z += math.sin(coordinate.x * 3.4 + coordinate.y * 2.1 + seed) * 0.028
    move_to_collection(obj, collection)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    project_uv(obj, 2.2)
    tag(obj, role, element_id)
    obj["tka_authorship"] = "scene-authored-deterministic"
    obj["tka_joint_radius"] = round(max(scale[0], scale[1]), 4)
    return obj


def create_caldera_banks(
    outline: list[tuple[float, float]],
    ash: bpy.types.Material,
    basalt: bpy.types.Material,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    """Bury the playable shelf in nested ash banks so it never reads as a floating stage."""
    banks = [
        ("Ember_Caldera_Bank_Inner", 1.105, 0.12, -0.34, ash, "inner-ash-bank"),
        ("Ember_Caldera_Bank_Middle", 1.27, -0.06, -0.58, basalt, "middle-buried-basalt"),
        ("Ember_Caldera_Bank_Outer", 1.48, -0.21, -0.72, ash, "outer-ash-bank"),
    ]
    return [
        create_extruded_polygon(
            name,
            scaled_outline(outline, scale),
            top,
            bottom,
            material,
            collection,
            "caldera-bank",
            element_id,
            bevel=0.08,
        )
        for name, scale, top, bottom, material, element_id in banks
    ]


def create_massif_backing(
    basalt: bpy.types.Material,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    """Give the joints a buried volcanic body instead of exposing them as freestanding poles."""
    specs = [
        (
            "Ember_Massif_Left_Back",
            [(-3.8, 0.0), (-3.4, 2.0), (-2.7, 4.9), (-1.4, 8.4), (0.2, 10.3), (1.45, 8.7), (1.9, 5.8), (1.45, 2.2), (0.9, 0.0)],
            3.15,
            (-3.7, -15.6, -0.15),
            (-1.5, 4.0, -4.0),
            "left-buried-massif",
        ),
        (
            "Ember_Massif_Right_Back",
            [(-2.4, 0.0), (-2.2, 2.5), (-1.4, 5.8), (-0.25, 8.0), (1.3, 7.2), (2.5, 4.4), (2.8, 1.4), (2.5, 0.0)],
            3.5,
            (4.55, -15.95, -0.18),
            (2.5, -5.0, 7.0),
            "right-buried-massif",
        ),
        (
            "Ember_Massif_Left_Shoulder",
            [(-2.4, 0.0), (-2.2, 1.7), (-1.1, 4.9), (0.3, 6.2), (1.8, 4.1), (2.2, 1.2), (2.0, 0.0)],
            2.8,
            (-8.3, -14.75, -0.22),
            (3.0, 8.0, -12.0),
            "left-outer-shoulder",
        ),
        (
            "Ember_Massif_Right_Shoulder",
            [(-1.8, 0.0), (-1.5, 1.5), (-0.7, 4.2), (0.45, 5.4), (1.5, 3.7), (2.0, 1.0), (1.7, 0.0)],
            2.6,
            (8.7, -15.1, -0.26),
            (-2.0, -9.0, 14.0),
            "right-outer-shoulder",
        ),
    ]
    return [
        create_fault_plate(name, points, thickness, location, rotation, basalt, collection, element_id)
        for name, points, thickness, location, rotation, element_id in specs
    ]


def create_perimeter_geology(
    basalt: bpy.types.Material,
    ash: bpy.types.Material,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    """Compose the full orbit with clustered low geology, never isolated bollards."""
    clusters = [
        ((-9.2, 4.4), 0.9, 12000),
        ((-9.5, -2.1), 1.0, 12100),
        ((-7.6, -8.4), 1.15, 12200),
        ((-2.1, -10.9), 0.9, 12300),
        ((5.4, -9.8), 1.0, 12400),
        ((8.8, -5.8), 1.05, 12500),
        ((9.5, 0.4), 0.92, 12600),
        ((7.7, 5.7), 1.1, 12700),
        ((2.0, 7.4), 0.95, 12800),
        ((-5.8, 7.2), 1.08, 12900),
    ]
    objects: list[bpy.types.Object] = []
    for cluster_index, ((cx, cy), cluster_scale, seed) in enumerate(clusters):
        rng = random.Random(seed)
        piece_count = 4 + cluster_index % 3
        for piece_index in range(piece_count):
            angle = rng.uniform(0.0, math.tau)
            distance = rng.uniform(0.0, 1.05) * cluster_scale
            x = cx + math.cos(angle) * distance
            y = cy + math.sin(angle) * distance
            width = rng.uniform(0.55, 1.35) * cluster_scale
            depth = rng.uniform(0.42, 1.05) * cluster_scale
            height = rng.uniform(0.28, 0.92) * cluster_scale
            objects.append(
                create_eroded_boulder(
                    f"Ember_Perimeter_Talus_{cluster_index + 1:02d}_{piece_index + 1:02d}",
                    (x, y, -0.06 + height * 0.16),
                    (width, depth, height),
                    (rng.uniform(-16, 16), rng.uniform(-18, 18), rng.uniform(-180, 180)),
                    seed + piece_index,
                    basalt if piece_index % 3 else ash,
                    collection,
                    "perimeter-talus-cluster",
                    f"perimeter-cluster-{cluster_index + 1:02d}-{piece_index + 1:02d}",
                )
            )
    return objects


def create_secondary_outcrops(
    basalt: bpy.types.Material,
    cap: bpy.types.Material,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    """Carry the furnace language into every orbit sector as buried, collapsed geology."""
    cluster_specs = [
        (-9.6, 4.6, 3, 21000),
        (9.6, 4.5, 4, 21100),
        (-10.2, -3.4, 4, 21200),
        (10.15, -2.8, 3, 21300),
        (-7.0, -8.75, 3, 21400),
        (7.4, -8.7, 4, 21500),
    ]
    outcrops: list[bpy.types.Object] = []
    for cluster_index, (cx, cy, count, seed) in enumerate(cluster_specs):
        radial = Vector((cx, cy)).normalized()
        tangent = Vector((-radial.y, radial.x))
        rng = random.Random(seed)
        for index in range(count):
            offset = (index - (count - 1) * 0.5) * rng.uniform(0.72, 0.96)
            depth = rng.uniform(-0.5, 0.45)
            x = cx + tangent.x * offset + radial.x * depth
            y = cy + tangent.y * offset + radial.y * depth
            height = rng.uniform(1.25, 3.25) * (1.0 - abs(offset) * 0.055)
            radius = rng.uniform(0.58, 0.92)
            joint = create_columnar_joint(
                f"Ember_R3_Orbit_Outcrop_{cluster_index + 1:02d}_{index + 1:02d}",
                (x, y, -0.32),
                radius,
                height,
                rng.choice((5, 6, 6, 7)),
                (radial.x * rng.uniform(0.45, 1.05), radial.y * rng.uniform(0.45, 1.05)),
                seed + index,
                basalt,
                cap,
                collection,
                "secondary-columnar-outcrop",
                f"r3-orbit-outcrop-{cluster_index + 1:02d}-{index + 1:02d}",
            )
            joint.rotation_euler.rotate_axis(
                "Z", math.radians(rng.uniform(-16.0, 16.0))
            )
            joint["tka_cluster"] = f"orbit-{cluster_index + 1:02d}"
            outcrops.append(joint)
        for boulder_index in range(2):
            angle = rng.uniform(0.0, math.tau)
            distance = rng.uniform(0.15, 1.15)
            width = rng.uniform(1.15, 2.0)
            depth = rng.uniform(0.78, 1.5)
            height = rng.uniform(0.55, 1.25)
            outcrops.append(
                create_eroded_boulder(
                    f"Ember_R4_Orbit_Outcrop_Talus_{cluster_index + 1:02d}_{boulder_index + 1:02d}",
                    (
                        cx + math.cos(angle) * distance,
                        cy + math.sin(angle) * distance,
                        -0.18 + height * 0.12,
                    ),
                    (width, depth, height),
                    (
                        rng.uniform(-18.0, 18.0),
                        rng.uniform(-22.0, 22.0),
                        rng.uniform(-180.0, 180.0),
                    ),
                    seed + 50 + boulder_index,
                    basalt,
                    collection,
                    "secondary-columnar-outcrop",
                    f"r4-orbit-outcrop-talus-{cluster_index + 1:02d}-{boulder_index + 1:02d}",
                )
            )
    return outcrops


def sample_river_centerline(sample_count: int = 128) -> list[Vector]:
    """Sample the runtime-owned Catmull-Rom river contract in Blender space."""

    points = [Vector(point) for point in RIVER_POINTS_BLENDER]
    sampled: list[Vector] = []
    for sample_index in range(sample_count):
        t = sample_index / (sample_count - 1)
        scaled = t * (len(points) - 1)
        index = min(int(math.floor(scaled)), len(points) - 2)
        local_t = scaled - index
        p0 = points[max(index - 1, 0)]
        p1 = points[index]
        p2 = points[index + 1]
        p3 = points[min(index + 2, len(points) - 1)]
        local_t2 = local_t * local_t
        local_t3 = local_t2 * local_t
        point = 0.5 * (
            2.0 * p1
            + (-p0 + p2) * local_t
            + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * local_t2
            + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * local_t3
        )
        sampled.append(point)
    return sampled


def river_distance_and_height(x: float, y: float, river: list[Vector]) -> tuple[float, float]:
    nearest_distance = float("inf")
    nearest_height = SURFACE_Z
    point = Vector((x, y))
    for start, end in zip(river, river[1:]):
        a = Vector((start.x, start.y))
        b = Vector((end.x, end.y))
        segment = b - a
        length_squared = segment.length_squared
        projection = 0.0 if length_squared == 0.0 else max(0.0, min(1.0, (point - a).dot(segment) / length_squared))
        closest = a + segment * projection
        distance = (point - closest).length
        if distance < nearest_distance:
            nearest_distance = distance
            nearest_height = start.z + (end.z - start.z) * projection
    return nearest_distance, nearest_height


def smoothstep(edge_start: float, edge_end: float, value: float) -> float:
    if edge_start == edge_end:
        return 0.0
    normalized = max(0.0, min(1.0, (value - edge_start) / (edge_end - edge_start)))
    return normalized * normalized * (3.0 - 2.0 * normalized)


def r8_geological_height(
    direction: str,
    x: float,
    runtime_z: float,
    radial_distance: float,
    terrain_weight: float,
    seed_phase: float,
) -> float:
    """Shape the three Gate 3 terrain directions around one locked action shelf."""

    base = -0.36 + terrain_weight * (0.32 + radial_distance * 0.009)
    micro_relief = (
        math.sin(x * 0.151 + runtime_z * 0.103 + seed_phase) * 0.34
        + math.sin(x * 0.071 - runtime_z * 0.173) * 0.22
        + math.sin((x - runtime_z) * 0.029 - seed_phase * 0.4) * 0.27
    )

    if direction == "breached-caldera-terraces":
        # A long breached valley reads as exterior country from the audience
        # camera. The former radial rim formed a continuous arena wall, even
        # with a mathematical saddle cut into it. These separated scarps keep
        # the caldera scale on both flanks while preserving a sky-backed travel
        # corridor along the lava river.
        west_scarp = math.exp(
            -(((x + 118.0) / 48.0) ** 2 + ((runtime_z - 62.0) / 102.0) ** 2)
        ) * 27.0
        east_scarp = math.exp(
            -(((x - 126.0) / 46.0) ** 2 + ((runtime_z - 54.0) / 96.0) ** 2)
        ) * 24.0
        west_rear_mass = math.exp(
            -(((x + 78.0) / 40.0) ** 2 + ((runtime_z - 164.0) / 40.0) ** 2)
        ) * 21.0
        east_rear_mass = math.exp(
            -(((x - 92.0) / 42.0) ** 2 + ((runtime_z - 170.0) / 44.0) ** 2)
        ) * 24.0
        west_bench = math.exp(
            -(((x + 52.0) / 30.0) ** 2 + ((runtime_z - 72.0) / 74.0) ** 2)
        ) * 9.0
        east_bench = math.exp(
            -(((x - 64.0) / 34.0) ** 2 + ((runtime_z - 86.0) / 78.0) ** 2)
        ) * 10.5
        flank_weight = smoothstep(32.0, 108.0, abs(x))
        raw_terraces = flank_weight * max(0.0, 1.0 - abs(runtime_z - 70.0) / 170.0) * 6.5
        terrace_step = 1.65
        terraced = math.floor(raw_terraces / terrace_step) * terrace_step
        breach = math.exp(
            -(((x - 1.0) / 42.0) ** 2 + ((runtime_z - 132.0) / 68.0) ** 2)
        ) * 5.5
        return base + terrain_weight * (
            west_scarp
            + east_scarp
            + west_rear_mass
            + east_rear_mass
            + west_bench
            + east_bench
            + terraced
            - breach
            + micro_relief * 0.82
        )

    if direction == "living-caldera":
        # R10 closes the visual gap left by the R8 terrain. The production
        # country had strong geology north of the performer, but the audience
        # side was a broad, nearly flat apron. Offset caldera shoulders now
        # occupy every quadrant while two eroded river breaches keep the world
        # open and directional instead of turning it into a circular arena.
        north_west_wall = math.exp(
            -(((x + 116.0) / 50.0) ** 2 + ((runtime_z - 82.0) / 92.0) ** 2)
        ) * 31.0
        north_east_wall = math.exp(
            -(((x - 124.0) / 48.0) ** 2 + ((runtime_z - 72.0) / 88.0) ** 2)
        ) * 29.0
        north_west_crown = math.exp(
            -(((x + 72.0) / 38.0) ** 2 + ((runtime_z - 168.0) / 36.0) ** 2)
        ) * 27.0
        north_east_crown = math.exp(
            -(((x - 88.0) / 40.0) ** 2 + ((runtime_z - 174.0) / 38.0) ** 2)
        ) * 31.0

        south_west_wall = math.exp(
            -(((x + 126.0) / 54.0) ** 2 + ((runtime_z + 92.0) / 66.0) ** 2)
        ) * 36.0
        south_east_wall = math.exp(
            -(((x - 132.0) / 56.0) ** 2 + ((runtime_z + 84.0) / 68.0) ** 2)
        ) * 33.0
        south_west_bench = math.exp(
            -(((x + 62.0) / 34.0) ** 2 + ((runtime_z + 62.0) / 48.0) ** 2)
        ) * 14.5
        south_east_bench = math.exp(
            -(((x - 72.0) / 36.0) ** 2 + ((runtime_z + 68.0) / 46.0) ** 2)
        ) * 16.5
        south_west_crown = math.exp(
            -(((x + 48.0) / 30.0) ** 2 + ((runtime_z + 108.0) / 34.0) ** 2)
        ) * 24.0
        south_east_crown = math.exp(
            -(((x - 54.0) / 32.0) ** 2 + ((runtime_z + 114.0) / 36.0) ** 2)
        ) * 27.0

        west_scarp = math.exp(
            -(((x + 166.0) / 34.0) ** 2 + ((runtime_z - 2.0) / 120.0) ** 2)
        ) * 23.0
        east_scarp = math.exp(
            -(((x - 168.0) / 36.0) ** 2 + ((runtime_z + 8.0) / 124.0) ** 2)
        ) * 21.0

        flank_weight = smoothstep(30.0, 112.0, abs(x))
        raw_terraces = flank_weight * max(0.0, 1.0 - abs(runtime_z) / 210.0) * 7.8
        terrace_step = 1.35
        terraced = math.floor(raw_terraces / terrace_step) * terrace_step

        north_breach = math.exp(
            -(((x + 2.0) / 38.0) ** 2 + ((runtime_z - 150.0) / 56.0) ** 2)
        ) * 8.0
        south_breach = math.exp(
            -(((x - 2.0) / 42.0) ** 2 + ((runtime_z + 120.0) / 46.0) ** 2)
        ) * 9.0
        crown_breakup = (
            max(0.0, math.sin(x * 0.055 + runtime_z * 0.019 + seed_phase)) ** 3
        ) * smoothstep(72.0, 176.0, radial_distance) * 3.6

        return base + terrain_weight * (
            north_west_wall
            + north_east_wall
            + north_west_crown
            + north_east_crown
            + south_west_wall
            + south_east_wall
            + south_west_bench
            + south_east_bench
            + south_west_crown
            + south_east_crown
            + west_scarp
            + east_scarp
            + terraced
            + crown_breakup
            - north_breach
            - south_breach
            + micro_relief * 0.92
        )

    if direction == "collapsed-lava-delta":
        # Wide overlapping flow lobes read as a field assembled by successive
        # eruptions. Sharp fronts and braided troughs make this intentionally
        # lower and more horizontal than the caldera direction.
        fan_distance = math.hypot(x * 0.78, runtime_z - 112.0)
        fan_angle = math.atan2(x, 112.0 - runtime_z)
        fan_mask = smoothstep(176.0, 36.0, fan_distance)
        lobe_phase = fan_distance * 0.115 + math.sin(fan_angle * 5.0) * 1.8
        lobe_fronts = max(0.0, math.sin(lobe_phase)) ** 4
        delta = fan_mask * (8.0 + lobe_fronts * 6.5)
        braided = (
            math.exp(-((x - 34.0 - math.sin(runtime_z * 0.035) * 18.0) / 16.0) ** 2)
            + math.exp(-((x + 48.0 + math.sin(runtime_z * 0.028 + 1.4) * 15.0) / 20.0) ** 2)
        ) * smoothstep(-30.0, 145.0, runtime_z)
        far_wall = math.exp(-(((x + 12.0) / 118.0) ** 2 + ((runtime_z - 176.0) / 32.0) ** 2)) * 22.0
        flank_left = math.exp(-(((x + 145.0) / 44.0) ** 2 + ((runtime_z - 48.0) / 98.0) ** 2)) * 14.0
        flank_right = math.exp(-(((x - 136.0) / 48.0) ** 2 + ((runtime_z - 18.0) / 92.0) ** 2)) * 12.0
        return base + terrain_weight * (
            delta - braided * 4.2 + far_wall + flank_left + flank_right + micro_relief * 0.72
        )

    if direction == "basalt-badlands":
        # Eroded radial ribs and alternating gullies create the most aggressive
        # silhouette, with one broad rear saddle keeping the world traversable.
        warped_x = x + math.sin(runtime_z * 0.025) * 18.0
        rib_wave = math.sin(warped_x * 0.071 + runtime_z * 0.017 + 0.5)
        ribs = max(0.0, rib_wave) ** 5
        crossing_ribs = max(0.0, math.sin(x * 0.027 - runtime_z * 0.061 - 1.2)) ** 7
        north_weight = smoothstep(18.0, 172.0, runtime_z)
        badlands = (ribs * 14.0 + crossing_ribs * 8.0) * (0.42 + north_weight * 0.82)
        left_massif = math.exp(-(((x + 118.0) / 40.0) ** 2 + ((runtime_z - 92.0) / 74.0) ** 2)) * 27.0
        right_massif = math.exp(-(((x - 116.0) / 38.0) ** 2 + ((runtime_z - 76.0) / 68.0) ** 2)) * 24.0
        travel_saddle = math.exp(-(((x - 20.0) / 45.0) ** 2 + ((runtime_z - 146.0) / 40.0) ** 2)) * 9.0
        return base + terrain_weight * (
            badlands + left_massif + right_massif - travel_saddle + micro_relief * 0.9
        )

    raise ValueError(f"Unknown R8 terrain direction: {direction}")


def create_volcanic_basin(
    materials: list[bpy.types.Material],
    collection: bpy.types.Collection,
    river: list[Vector],
    direction: str = "r7-continuous-basin",
) -> bpy.types.Object:
    """Build one continuous exterior basin instead of concentric backdrop rings."""

    specification = WORLD_CONTRACT["terrain"]
    x_min, x_max = (float(value) for value in specification["runtimeXRange"])
    runtime_z_min, runtime_z_max = (
        float(value) for value in specification["runtimeZRange"]
    )
    columns = int(specification["columns"])
    rows = int(specification["rows"])
    near_material_end = float(specification["nearMaterialEndsAtDistance"])
    middle_material_end = float(specification["middleMaterialEndsAtDistance"])
    action_floor_radius = float(specification["actionFloorRadius"])
    if direction in PRODUCTION_TERRAIN_DIRECTIONS:
        # The responsive deck tops out well inside this transition zone. R7's
        # 23 m dead-flat moat made the shelf read as a floating vignette.
        action_floor_radius = 10.8
    seed = int(specification["seed"])
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    material_indices: list[int] = []
    channel_half_width = float(WORLD_CONTRACT["lavaRiver"]["width"]) * 0.5
    seed_phase = seed * 0.013

    for row in range(rows + 1):
        z_t = row / rows
        runtime_z = runtime_z_min + (runtime_z_max - runtime_z_min) * z_t
        y = -runtime_z
        for column in range(columns + 1):
            x_t = column / columns
            x = x_min + (x_max - x_min) * x_t
            radial_distance = math.hypot(x, runtime_z)
            terrain_weight = max(
                0.0,
                min(1.0, (radial_distance - action_floor_radius) / 34.0),
            )
            terrain_weight = terrain_weight * terrain_weight * (3.0 - 2.0 * terrain_weight)

            if direction in PRODUCTION_TERRAIN_DIRECTIONS:
                height = r8_geological_height(
                    direction,
                    x,
                    runtime_z,
                    radial_distance,
                    terrain_weight,
                    seed_phase,
                )
                # The fixed Meshy silhouettes must emerge from the country,
                # not be guillotined by a later terrain pass. Local erosion
                # bowls retain their bases while the surrounding benches rise.
                for asset_x, asset_z, inner_radius, outer_radius, bed_height in (
                    (-24.0, 24.0, 14.0, 27.0, -0.22),
                    (30.5, 6.0, 5.0, 10.0, -0.18),
                    (19.0, 15.0, 6.2, 13.0, -0.2),
                ):
                    asset_distance = math.hypot(x - asset_x, runtime_z - asset_z)
                    asset_blend = 1.0 - smoothstep(inner_radius, outer_radius, asset_distance)
                    if asset_blend > 0.0:
                        height = height * (1.0 - asset_blend) + bed_height * asset_blend
            else:
                # R7 is retained as a reconstruction path and before image.
                height = -0.32 + terrain_weight * (0.45 + radial_distance * 0.014)
                for ridge_x, ridge_z, ridge_width_x, ridge_width_z, ridge_height in (
                    (-92.0, -82.0, 48.0, 40.0, 17.0),
                    (82.0, -98.0, 54.0, 43.0, 19.0),
                    (-148.0, -5.0, 48.0, 66.0, 22.0),
                    (148.0, 30.0, 50.0, 64.0, 20.0),
                    (-108.0, 102.0, 57.0, 51.0, 20.0),
                    (86.0, 120.0, 52.0, 49.0, 24.0),
                    (-50.0, 174.0, 62.0, 42.0, 27.0),
                    (78.0, 178.0, 64.0, 39.0, 21.0),
                ):
                    ridge_distance = ((x - ridge_x) / ridge_width_x) ** 2
                    ridge_distance += ((runtime_z - ridge_z) / ridge_width_z) ** 2
                    height += terrain_weight * math.exp(-ridge_distance * 1.85) * ridge_height
                height += terrain_weight * (
                    math.sin(x * 0.061 + runtime_z * 0.039 + seed_phase) * 0.78
                    + math.sin(x * 0.127 - runtime_z * 0.083) * 0.34
                    + math.sin((x + runtime_z) * 0.021 - seed_phase * 0.35) * 0.62
                )

            distance, river_height = river_distance_and_height(x, y, river)
            channel_influence = max(0.0, 1.0 - distance / (channel_half_width + 5.2))
            channel_influence = channel_influence * channel_influence * (3.0 - 2.0 * channel_influence)
            height = height * (1.0 - channel_influence) + (river_height - 0.18) * channel_influence
            vertices.append((x, y, height))
    row_width = columns + 1
    for row in range(rows):
        for column in range(columns):
            runtime_z = runtime_z_min + (runtime_z_max - runtime_z_min) * ((row + 0.5) / rows)
            x = x_min + (x_max - x_min) * ((column + 0.5) / columns)
            radial_distance = math.hypot(x, runtime_z)
            material_index = 0 if radial_distance < near_material_end else 1 if radial_distance < middle_material_end else 2
            a = row * row_width + column
            b = a + 1
            c = (row + 1) * row_width + column + 1
            d = (row + 1) * row_width + column
            faces.append((a, b, c, d))
            material_indices.append(material_index)

    suffix = direction.replace("-", "_")
    mesh = bpy.data.meshes.new(f"Ember_Volcanic_Basin_{suffix}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Ember_Volcanic_Basin_{suffix}", mesh)
    collection.objects.link(obj)
    for material in materials:
        obj.data.materials.append(material)
    for polygon, material_index in zip(obj.data.polygons, material_indices, strict=True):
        polygon.use_smooth = True
        polygon.material_index = material_index
    project_uv(obj, 4.6)
    tag(obj, "volcanic-basin", f"continuous-volcanic-basin-{direction}")
    obj["tka_terrain_direction"] = direction
    obj["tka_depth_layers"] = "near,middle,far"
    obj["tka_authorship"] = "scene-authored-deterministic"
    return obj


def create_lava_channel_levees(
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    river: list[Vector],
) -> list[bpy.types.Object]:
    """Raise irregular banks around the runtime river so its surface is never a decal."""

    width = float(WORLD_CONTRACT["lavaRiver"]["width"])
    objects: list[bpy.types.Object] = []
    for side_index, side_sign in enumerate((-1.0, 1.0), start=1):
        vertices: list[tuple[float, float, float]] = []
        faces: list[tuple[int, int, int, int]] = []
        for index, center in enumerate(river):
            before = river[max(0, index - 1)]
            after = river[min(len(river) - 1, index + 1)]
            tangent = Vector((after.x - before.x, after.y - before.y)).normalized()
            normal = Vector((-tangent.y, tangent.x)) * side_sign
            t = index / (len(river) - 1)
            half_width = width * (0.9 + math.sin(math.pi * t) * 0.1 + math.sin(t * 17.3 + 0.7) * 0.025) * 0.5
            irregular = math.sin(t * 41.0 + side_index * 2.1) * 0.12 + math.sin(t * 17.0) * 0.08
            inner = Vector((center.x, center.y)) + normal * (half_width + 0.16)
            crest = Vector((center.x, center.y)) + normal * (half_width + 0.92 + irregular)
            outer = Vector((center.x, center.y)) + normal * (half_width + 2.45 + irregular * 0.5)
            vertices.extend(
                [
                    (inner.x, inner.y, center.z + 0.03),
                    (crest.x, crest.y, center.z + 0.68 + irregular * 0.4),
                    (outer.x, outer.y, center.z + 0.11 + irregular * 0.25),
                ]
            )
        for index in range(len(river) - 1):
            offset = index * 3
            next_offset = (index + 1) * 3
            faces.extend(
                [
                    (offset, next_offset, next_offset + 1, offset + 1),
                    (offset + 1, next_offset + 1, next_offset + 2, offset + 2),
                ]
            )
        mesh = bpy.data.meshes.new(f"Ember_Lava_Channel_Levee_{side_index:02d}_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(f"Ember_Lava_Channel_Levee_{side_index:02d}", mesh)
        collection.objects.link(obj)
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        project_uv(obj, 3.8)
        tag(obj, "lava-channel-levee", f"lava-channel-levee-{side_index:02d}")
        obj["tka_authorship"] = "scene-authored-deterministic"
        obj["tka_radial_clearance"] = min(math.hypot(vertex[0], vertex[1]) for vertex in vertices)
        objects.append(obj)
    return objects


def create_qa_lava_river(
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    river: list[Vector],
    crust_material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    width = float(WORLD_CONTRACT["lavaRiver"]["width"])
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index, center in enumerate(river):
        before = river[max(0, index - 1)]
        after = river[min(len(river) - 1, index + 1)]
        tangent = Vector((after.x - before.x, after.y - before.y)).normalized()
        normal = Vector((-tangent.y, tangent.x))
        t = index / (len(river) - 1)
        half_width = width * (0.9 + math.sin(math.pi * t) * 0.1) * 0.5
        left = Vector((center.x, center.y)) - normal * half_width
        right = Vector((center.x, center.y)) + normal * half_width
        vertices.extend([(left.x, left.y, center.z + 0.045), (right.x, right.y, center.z + 0.045)])
    for index in range(len(river) - 1):
        offset = index * 2
        faces.append((offset, offset + 2, offset + 3, offset + 1))
    mesh = bpy.data.meshes.new("QA_Lava_River_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("QA_Lava_River", mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, "qa-lava-river", "qa-lava-river")

    # The proof render needs to communicate the same physical idea as the
    # runtime shader: a moving incandescent body carrying cooled jigsaw rafts.
    # These sparse plates are QA-only and deliberately leave hot leads visible.
    if crust_material is not None:
        plate_index = 0
        for start in range(6, len(river) - 8, 7):
            end = min(start + 2 + (plate_index % 2), len(river) - 2)
            centers = river[start : end + 1]
            plate_vertices: list[tuple[float, float, float]] = []
            for local_index, center in enumerate(centers):
                source_index = start + local_index
                before = river[max(0, source_index - 1)]
                after = river[min(len(river) - 1, source_index + 1)]
                tangent = Vector((after.x - before.x, after.y - before.y)).normalized()
                normal = Vector((-tangent.y, tangent.x))
                t = source_index / (len(river) - 1)
                half_width = width * (0.9 + math.sin(math.pi * t) * 0.1) * 0.5
                side_bias = -0.22 if plate_index % 2 == 0 else 0.22
                plate_half = half_width * (0.38 + 0.08 * math.sin(plate_index * 1.9))
                center_offset = normal * half_width * side_bias
                left = Vector((center.x, center.y)) + center_offset - normal * plate_half
                right = Vector((center.x, center.y)) + center_offset + normal * plate_half
                plate_vertices.extend(
                    [
                        (left.x, left.y, center.z + 0.09),
                        (right.x, right.y, center.z + 0.09),
                    ]
                )
            plate_faces = [
                (index * 2, index * 2 + 2, index * 2 + 3, index * 2 + 1)
                for index in range(len(centers) - 1)
            ]
            plate_mesh = bpy.data.meshes.new(f"QA_Lava_Crust_{plate_index + 1:02d}_Mesh")
            plate_mesh.from_pydata(plate_vertices, [], plate_faces)
            plate_mesh.update()
            plate = bpy.data.objects.new(f"QA_Lava_Crust_{plate_index + 1:02d}", plate_mesh)
            collection.objects.link(plate)
            plate.data.materials.append(crust_material)
            tag(plate, "qa-lava-crust", f"qa-lava-crust-{plate_index + 1:02d}")
            plate_index += 1
    return obj


def create_vertical_fault(
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    width: float,
    y: float,
    role: str,
    element_id: str,
    *,
    points: list[tuple[float, float]] | None = None,
    x_offset: float = 0.0,
) -> bpy.types.Object:
    fault_points = points or [
        (-0.48, 0.05),
        (-0.18, 0.85),
        (-0.42, 1.7),
        (0.02, 2.65),
        (-0.08, 3.55),
        (0.38, 4.5),
        (0.24, 5.55),
        (0.72, 6.45),
        (0.64, 7.35),
        (1.08, 8.25),
        (0.96, 9.15),
    ]
    vertices: list[tuple[float, float, float]] = []
    for index, (x, z) in enumerate(fault_points):
        before = Vector(fault_points[max(0, index - 1)])
        after = Vector(fault_points[min(len(fault_points) - 1, index + 1)])
        tangent = (after - before).normalized()
        normal = Vector((-tangent.y, tangent.x)) * (width * 0.5)
        vertices.extend(
            [
                (x_offset + x + normal.x, y, z + normal.y),
                (x_offset + x - normal.x, y, z - normal.y),
            ]
        )
    faces = [
        (index * 2, index * 2 + 1, index * 2 + 3, index * 2 + 2)
        for index in range(len(fault_points) - 1)
    ]
    mesh = bpy.data.meshes.new(f"{element_id}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Ember_{element_id}", mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    tag(obj, role, element_id)
    return obj


def create_columnar_furnace(
    basalt: bpy.types.Material,
    cap: bpy.types.Material,
    lava: bpy.types.Material,
    chasm: bpy.types.Material,
    collection: bpy.types.Collection,
) -> dict[str, object]:
    """Build the selected asymmetric furnace and its shelf/fissure junction."""
    height_profiles = {
        "left": [6.7, 8.35, 7.15, 9.05, 5.75, 7.55],
        "right": [8.75, 6.25, 7.95, 5.35, 7.05, 4.65],
    }
    missing_slots = {
        ("left", 0, 1),
        ("left", 1, 4),
        ("left", 2, 0),
        ("left", 2, 5),
        ("right", 0, 4),
        ("right", 1, 1),
        ("right", 2, 3),
    }
    columns: list[bpy.types.Object] = []
    seed = 4400
    for side_name, sign in (("left", -1.0), ("right", 1.0)):
        profile = height_profiles[side_name]
        for row in range(3):
            for slot, base_height in enumerate(profile):
                if (side_name, row, slot) in missing_slots:
                    continue
                local_seed = seed + row * 100 + slot * 7 + (0 if side_name == "left" else 1000)
                rng = random.Random(local_seed)
                base_x = 2.42 if side_name == "left" else 2.92
                spacing = 0.79 if side_name == "left" else 0.66
                row_spread = 0.38 if side_name == "left" else 0.23
                x = sign * (base_x + slot * spacing + row * row_spread) + rng.uniform(-0.16, 0.16)
                y = (-12.72 if side_name == "left" else -13.18) - row * 0.78 + rng.uniform(-0.16, 0.16)
                height = base_height * (1.0 - row * 0.055) + rng.uniform(-0.38, 0.34)
                radius = rng.uniform(0.43, 0.61) * (1.0 - row * 0.035)
                lean_x = sign * rng.uniform(-0.42, 0.42)
                if slot == 0:
                    lean_x -= sign * rng.uniform(0.28, 0.62)
                lean_y = rng.uniform(-0.38, 0.34)
                joint = create_columnar_joint(
                    f"Ember_Column_{side_name.title()}_{row + 1:02d}_{slot + 1:02d}",
                    (x, y, 0.12 - row * 0.07),
                    radius,
                    height,
                    rng.choice((5, 6, 6, 7)),
                    (lean_x, lean_y),
                    local_seed,
                    basalt,
                    cap,
                    collection,
                    "columnar-joint",
                    f"{side_name}-joint-r{row + 1}-s{slot + 1}",
                )
                joint["tka_cluster"] = side_name
                joint["tka_depth_row"] = row + 1
                joint["tka_profile_slot"] = slot + 1
                columns.append(joint)

    shoulder_specs = [
        ("left", -1.12, -15.66, 0.76, 8.95, 7, (-0.64, 0.12), 6651),
        ("right", 1.02, -15.58, 0.69, 7.35, 5, (0.52, -0.18), 6652),
        ("left", -1.82, -16.08, 0.61, 6.45, 6, (-0.28, 0.14), 6653),
        ("right", 1.68, -16.15, 0.82, 9.35, 7, (0.32, 0.22), 6654),
    ]
    for index, (side_name, x, y, radius, height, sides, lean, local_seed) in enumerate(shoulder_specs):
        joint = create_columnar_joint(
            f"Ember_Fault_Shoulder_{index + 1:02d}",
            (x, y, -0.02),
            radius,
            height,
            sides,
            lean,
            local_seed,
            basalt,
            cap,
            collection,
            "columnar-joint",
            f"fault-shoulder-{index + 1:02d}",
        )
        joint["tka_cluster"] = f"{side_name}-fault-shoulder"
        joint["tka_depth_row"] = 4
        joint["tka_profile_slot"] = index + 1
        columns.append(joint)

    roots: list[bpy.types.Object] = []
    root_specs = [
        (-5.35, -11.35, 1.25, -0.34),
        (-3.85, -11.75, 1.85, -0.28),
        (-2.85, -12.05, 2.35, -0.18),
        (2.95, -12.0, 2.7, 0.24),
        (4.2, -11.55, 1.55, 0.31),
        (5.65, -11.15, 1.05, 0.38),
    ]
    for index, (x, y, height, lean_x) in enumerate(root_specs):
        roots.append(
            create_columnar_joint(
                f"Ember_Buried_Column_Root_{index + 1:02d}",
                (x, y, 0.08),
                0.48 + (index % 3) * 0.055,
                height,
                5 + index % 3,
                (lean_x, -0.08),
                7200 + index,
                basalt,
                cap,
                collection,
                "buried-column-root",
                f"buried-root-{index + 1:02d}",
            )
        )

    fallen_specs = [
        (-5.9, -12.0, 3.4, (0.74, -0.12), (0.0, 48.0, -16.0)),
        (-3.15, -11.4, 2.85, (-0.62, 0.08), (0.0, -57.0, 21.0)),
        (4.95, -11.85, 3.1, (0.66, -0.16), (0.0, 52.0, 14.0)),
    ]
    fallen: list[bpy.types.Object] = []
    for index, (x, y, height, lean, rotation) in enumerate(fallen_specs):
        obj = create_columnar_joint(
            f"Ember_Fallen_Column_{index + 1:02d}",
            (x, y, 0.22),
            0.54 + index * 0.035,
            height,
            6,
            lean,
            7600 + index,
            basalt,
            cap,
            collection,
            "fallen-column",
            f"fallen-column-{index + 1:02d}",
        )
        obj.rotation_euler = tuple(math.radians(value) for value in rotation)
        fallen.append(obj)

    perimeter_specs = [
        (-8.0, 3.55, 1.55, (-0.34, 0.28)),
        (-7.45, -1.8, 2.15, (-0.42, -0.04)),
        (-6.4, -7.45, 2.65, (-0.36, -0.2)),
        (-2.95, -9.95, 1.45, (-0.08, -0.35)),
        (3.45, -8.95, 1.85, (0.16, -0.32)),
        (6.65, -6.0, 2.35, (0.38, -0.18)),
        (7.35, -0.3, 1.65, (0.44, 0.02)),
        (7.55, 3.0, 2.05, (0.34, 0.22)),
        (3.15, 5.75, 1.4, (0.12, 0.34)),
        (-5.75, 6.65, 1.8, (-0.25, 0.32)),
    ]
    perimeter: list[bpy.types.Object] = []
    for index, (x, y, height, lean) in enumerate(perimeter_specs):
        perimeter.append(
            create_columnar_joint(
                f"Ember_Perimeter_Root_{index + 1:02d}",
                (x, y, -0.08),
                0.38 + (index % 4) * 0.045,
                height,
                5 + index % 3,
                lean,
                7800 + index,
                basalt,
                cap,
                collection,
                "perimeter-column-root",
                f"perimeter-root-{index + 1:02d}",
            )
        )

    fragment_specs = [
        ("Ember_Entablature_Left_Crown", (-5.35, -14.35, 7.35), (1.72, 0.92, 0.78), (8, -13, -7)),
        ("Ember_Entablature_Left_Shoulder", (-3.75, -13.85, 5.95), (1.18, 0.72, 0.96), (-7, 18, 12)),
        ("Ember_Entablature_Left_Fall", (-6.45, -12.25, 1.05), (1.35, 0.68, 0.82), (17, -9, 28)),
        ("Ember_Entablature_Right_Crown", (3.45, -14.55, 7.6), (1.58, 0.88, 0.92), (-11, 16, 9)),
        ("Ember_Entablature_Right_Break", (5.45, -14.15, 5.35), (1.46, 0.74, 0.82), (13, -18, -22)),
        ("Ember_Entablature_Right_Fall", (6.15, -12.0, 0.82), (1.5, 0.7, 0.74), (-15, 7, -31)),
        ("Ember_Entablature_Fault_Splinter", (2.0, -15.25, 4.15), (0.82, 0.62, 1.5), (6, 21, 16)),
        ("Ember_Entablature_Fault_Cap", (-0.25, -16.1, 8.15), (1.52, 0.74, 0.58), (11, -8, 6)),
    ]
    fragments = [
        create_entablature_fragment(
            name,
            location,
            scale,
            rotation,
            8100 + index,
            basalt,
            collection,
        )
        for index, (name, location, scale, rotation) in enumerate(fragment_specs)
    ]

    create_vertical_fault(chasm, collection, 0.42, -15.31, "cooled-fissure", "Columnar_Fault_Chasm")
    fault = create_vertical_fault(lava, collection, 0.085, -15.26, "live-fissure", "Columnar_Fault_Heat")
    return {
        "columns": columns,
        "roots": roots,
        "fallen": fallen,
        "perimeter": perimeter,
        "fragments": fragments,
        "fault": fault,
        "missingSlots": sorted("-".join(map(str, slot)) for slot in missing_slots),
    }


def create_columnar_furnace_r3(
    basalt: bpy.types.Material,
    cap: bpy.types.Material,
    ash: bpy.types.Material,
    lava: bpy.types.Material,
    chasm: bpy.types.Material,
    collection: bpy.types.Collection,
) -> dict[str, object]:
    """Build a buried, offset rift whose joints read as geology from the complete orbit."""
    backing = create_massif_backing(basalt, collection)
    print("[ember-r4] massif backing complete", flush=True)
    columns: list[bpy.types.Object] = []
    missing_slots = {
        ("left", 0, 1),
        ("left", 1, 4),
        ("left", 2, 0),
        ("right", 0, 3),
        ("right", 1, 1),
        ("right", 2, 4),
    }
    profiles = {
        "left": [
            (-7.7, 5.5, 0.88),
            (-6.45, 7.2, 0.93),
            (-5.1, 9.15, 1.02),
            (-3.65, 10.25, 1.08),
            (-2.2, 8.3, 0.96),
            (-0.75, 6.2, 0.84),
        ],
        "right": [
            (2.35, 7.75, 0.98),
            (3.75, 9.0, 1.07),
            (5.1, 7.1, 0.95),
            (6.45, 5.9, 0.88),
            (7.75, 4.6, 0.8),
        ],
    }
    for side_name, profile in profiles.items():
        sign = -1.0 if side_name == "left" else 1.0
        for row in range(3):
            for slot, (base_x, base_height, base_radius) in enumerate(profile):
                if (side_name, row, slot) in missing_slots:
                    continue
                local_seed = 14400 + row * 100 + slot * 11 + (0 if side_name == "left" else 1000)
                rng = random.Random(local_seed)
                depth_shift = row * (0.42 if side_name == "left" else 0.36)
                x = base_x + sign * depth_shift + rng.uniform(-0.22, 0.22)
                y = (-13.7 if row == 0 else -14.55 - (row - 1) * 0.82) + rng.uniform(-0.18, 0.18)
                height = base_height * (1.0 - row * 0.105) + rng.uniform(-0.42, 0.38)
                radius = base_radius * (1.0 - row * 0.065) * rng.uniform(0.9, 1.08)
                lean = (
                    sign * rng.uniform(-0.7, 0.35),
                    rng.uniform(-0.42, 0.3),
                )
                joint = create_columnar_joint(
                    f"Ember_R2_Column_{side_name.title()}_{row + 1:02d}_{slot + 1:02d}",
                    (x, y, -0.28 - row * 0.12),
                    radius,
                    height,
                    rng.choice((5, 5, 6, 6, 7)),
                    lean,
                    local_seed,
                    basalt,
                    cap,
                    collection,
                    "columnar-joint",
                    f"r2-{side_name}-joint-r{row + 1}-s{slot + 1}",
                )
                joint["tka_cluster"] = side_name
                joint["tka_depth_row"] = row + 1
                joint["tka_profile_slot"] = slot + 1
                columns.append(joint)
    print("[ember-r4] primary joints complete", flush=True)

    shoulder_specs = [
        (0.0, -15.25, 0.96, 7.1, 7, (-0.72, 0.15), 16651, "left-fault-lip"),
        (1.95, -15.55, 0.82, 6.45, 5, (0.55, -0.12), 16652, "right-fault-lip"),
        (-1.05, -16.1, 1.08, 8.65, 6, (-0.35, 0.18), 16653, "left-fault-back"),
        (2.85, -16.35, 0.91, 7.8, 7, (0.28, 0.2), 16654, "right-fault-back"),
    ]
    for index, (x, y, radius, height, sides, lean, seed, cluster) in enumerate(shoulder_specs):
        joint = create_columnar_joint(
            f"Ember_R2_Fault_Shoulder_{index + 1:02d}",
            (x, y, -0.38),
            radius,
            height,
            sides,
            lean,
            seed,
            basalt,
            cap,
            collection,
            "columnar-joint",
            f"r2-fault-shoulder-{index + 1:02d}",
        )
        joint["tka_cluster"] = cluster
        joint["tka_depth_row"] = 4
        joint["tka_profile_slot"] = index + 1
        columns.append(joint)
    print("[ember-r4] fault shoulders complete", flush=True)

    base_talus: list[bpy.types.Object] = []
    for side_index, (cx, cy, side_seed) in enumerate(((-4.7, -12.75, 18000), (5.0, -12.95, 18100))):
        rng = random.Random(side_seed)
        for index in range(18):
            x = cx + rng.uniform(-3.15, 3.0)
            y = cy + rng.uniform(-1.15, 1.0)
            width = rng.uniform(0.45, 1.45)
            depth = rng.uniform(0.38, 1.05)
            height = rng.uniform(0.24, 1.0)
            base_talus.append(
                create_eroded_boulder(
                    f"Ember_R2_Base_Talus_{side_index + 1:02d}_{index + 1:02d}",
                    (x, y, -0.22 + height * 0.22),
                    (width, depth, height),
                    (rng.uniform(-18, 18), rng.uniform(-20, 20), rng.uniform(-180, 180)),
                    side_seed + index,
                    basalt if index % 4 else ash,
                    collection,
                    "buried-column-talus",
                    f"r2-base-talus-{side_index + 1:02d}-{index + 1:02d}",
                )
            )
    print("[ember-r4] base talus complete", flush=True)

    fallen_specs = [
        (-7.25, -11.95, 0.76, 3.7, (4.0, 66.0, -22.0), 19001),
        (-2.55, -12.0, 0.7, 3.0, (-3.0, -61.0, 14.0), 19002),
        (6.75, -12.2, 0.8, 3.4, (1.0, 59.0, 18.0), 19003),
    ]
    fallen: list[bpy.types.Object] = []
    for index, (x, y, radius, height, rotation, seed) in enumerate(fallen_specs):
        obj = create_columnar_joint(
            f"Ember_R2_Fallen_Column_{index + 1:02d}",
            (x, y, 0.18),
            radius,
            height,
            5 + index % 3,
            (0.45 if index != 1 else -0.4, -0.12),
            seed,
            basalt,
            cap,
            collection,
            "fallen-column",
            f"r2-fallen-column-{index + 1:02d}",
        )
        obj.rotation_euler = tuple(math.radians(value) for value in rotation)
        fallen.append(obj)
    print("[ember-r4] fallen joints complete", flush=True)

    fragment_specs = [
        ("Ember_R2_Entablature_Left_Crown", (-5.25, -15.1, 7.4), (2.2, 1.0, 0.72), (6, -11, -8)),
        ("Ember_R2_Entablature_Left_Ledge", (-2.95, -14.15, 5.1), (1.7, 0.82, 0.58), (-9, 14, 13)),
        ("Ember_R2_Entablature_Right_Crown", (4.2, -15.35, 6.45), (1.9, 0.9, 0.68), (-8, 13, 9)),
        ("Ember_R2_Entablature_Right_Ledge", (6.45, -14.2, 3.9), (1.55, 0.78, 0.64), (12, -15, -19)),
        ("Ember_R2_Entablature_Fault_Wedge", (0.8, -15.7, 6.1), (1.1, 0.65, 1.45), (5, 19, 14)),
    ]
    fragments = [
        create_entablature_fragment(name, location, scale, rotation, 19600 + index, basalt, collection)
        for index, (name, location, scale, rotation) in enumerate(fragment_specs)
    ]
    print("[ember-r4] entablature complete", flush=True)

    glow_segments = [
        [(-0.22, 0.18), (0.04, 0.68), (-0.12, 1.02)],
        [(0.08, 3.82), (0.23, 4.12)],
        [(0.5, 6.82), (0.66, 7.06)],
    ]
    live_faults = [
        create_vertical_fault(
            lava,
            collection,
            0.018 + index * 0.003,
            -16.28,
            "live-fissure",
            f"Columnar_R3_Fault_Heat_{index + 1:02d}",
            points=segment,
            x_offset=0.82,
        )
        for index, segment in enumerate(glow_segments)
    ]
    # Emissive boulders read as orange UI lozenges at runtime. Heat is carried
    # only by the narrow, occluded fault ribbons behind the broken shoulders.
    heat_nodes: list[bpy.types.Object] = []
    print("[ember-r4] occluded fault heat complete", flush=True)

    perimeter = create_perimeter_geology(basalt, ash, collection)
    secondary_outcrops = create_secondary_outcrops(basalt, cap, collection)
    print("[ember-r4] perimeter geology complete", flush=True)
    return {
        "columns": columns,
        "backing": backing,
        "baseTalus": base_talus,
        "fallen": fallen,
        "perimeter": perimeter,
        "fragments": fragments,
        "fault": None,
        "liveFaults": live_faults,
        "heatNodes": heat_nodes,
        "secondaryOutcrops": secondary_outcrops,
        "missingSlots": sorted("-".join(map(str, slot)) for slot in missing_slots),
    }


def create_meshy_geology_ensemble(
    basalt: bpy.types.Material,
    ash: bpy.types.Material,
    collection: bpy.types.Collection,
) -> dict[str, object]:
    """Place the three approved formations once, with authored country between them."""

    # The columnar formation is a framing escarpment, not a shrine. Its former
    # near-centre placement stopped both the eye and the lava route. Cropping a
    # larger mass into the right edge makes the authored detail feel like one
    # exposed face of a much larger volcanic country.
    hero = import_meshy_geology(
        "hero-columnar-escarpment.glb",
        "Ember_Meshy_Columnar_Escarpment",
        (-24.0, -24.0, -0.62),
        19.0,
        158.0,
        "meshy-hero-geology",
        "hero-columnar-escarpment",
        "01a04587-db17-7a2a-b386-849e70d03b4e",
        collection,
    )
    lava_bank = import_meshy_geology(
        "collapsed-lava-bank.glb",
        "Ember_Meshy_Collapsed_Lava_Bank",
        (30.5, -6.0, -0.34),
        3.4,
        22.0,
        "meshy-lava-bank",
        "collapsed-lava-bank",
        "01a0458b-0cf6-7131-90ac-0c7b38dac384",
        collection,
    )
    fumarole = import_meshy_geology(
        "obsidian-fumarole-talus.glb",
        "Ember_Meshy_Obsidian_Fumarole_Talus",
        (19.0, -15.0, -0.42),
        5.4,
        24.0,
        "meshy-fumarole-talus",
        "obsidian-fumarole-talus",
        "01a0458e-5a9d-7d9c-a115-d569ba60119a",
        collection,
    )
    distant_caldera = import_meshy_geology(
        "distant-breached-caldera.glb",
        "Ember_Meshy_Distant_Breached_Caldera",
        (108.0, -158.0, 2.0),
        22.0,
        172.0,
        "meshy-distant-caldera",
        "distant-breached-caldera",
        "01a045d9-7610-7858-bf2d-3caba206f23a",
        collection,
    )

    # Scene-authored rubble remains the transition tissue. The selected Meshy
    # assets own the unique silhouettes; procedural pieces only bury their
    # bases and carry the geology around the orbit without visible duplication.
    perimeter = create_perimeter_geology(basalt, ash, collection)
    return {
        "hero": hero,
        "lavaBank": lava_bank,
        "fumarole": fumarole,
        "distantCaldera": distant_caldera,
        "perimeter": perimeter,
    }


def build_production_geometry(
    production: bpy.types.Collection,
    terrain_direction: str = "r7-continuous-basin",
) -> dict[str, object]:
    print("[ember-r7] baking blackglass textures", flush=True)
    textures = create_blackglass_textures()
    blackglass = create_blackglass_material(textures)
    print("[ember-r7] baking basalt textures", flush=True)
    basalt_textures = create_basalt_textures("weathered-basalt", seed=250827)
    print("[ember-r7] creating materials", flush=True)
    columnar_basalt = create_texture_material(
        "Ember_Columnar_Basalt_PBR",
        "columnar-joint-face",
        basalt_textures,
        base_color=(0.035, 0.065, 0.068, 1.0),
        roughness=0.86,
        metallic=0.015,
        normal_strength=0.52,
    )
    near_caldera = create_texture_material(
        "Ember_Near_Caldera_PBR",
        "near-caldera-relief",
        basalt_textures,
        base_color=(0.026, 0.048, 0.049, 1.0),
        roughness=0.91,
        metallic=0.008,
        normal_strength=0.42,
    )
    middle_caldera = create_texture_material(
        "Ember_Middle_Caldera_PBR",
        "middle-caldera-relief",
        basalt_textures,
        base_color=(0.052, 0.078, 0.079, 1.0),
        roughness=0.94,
        metallic=0.004,
        normal_strength=0.3,
    )
    far_caldera = create_texture_material(
        "Ember_Far_Caldera_PBR",
        "far-caldera-silhouette",
        basalt_textures,
        base_color=(0.085, 0.105, 0.101, 1.0),
        roughness=0.97,
        metallic=0.0,
        normal_strength=0.18,
    )
    chasm = create_plain_material("Ember_Fissure_Chasm", (0.002, 0.003, 0.005, 1.0), 1.0)
    lava = create_plain_material("Ember_Live_Fissure", (1.0, 0.085, 0.008, 1.0), 0.38, emission_strength=2.15)
    mineral_color = (
        (0.058, 0.048, 0.036, 1.0)
        if terrain_direction in PRODUCTION_TERRAIN_DIRECTIONS
        else (0.16, 0.095, 0.032, 1.0)
    )
    mineral = create_plain_material("Ember_Mineral_Ochre", mineral_color, 0.96)
    ash = create_plain_material("Ember_Ash_Deposit", (0.035, 0.048, 0.047, 1.0), 0.985)

    create_caldera_banks(SHELF_OUTLINE, ash, columnar_basalt, production)
    print("[ember-r7] authoring shelf", flush=True)

    create_extruded_polygon(
        "Ember_Blackglass_Shelf",
        SHELF_OUTLINE,
        SURFACE_Z,
        -0.48,
        blackglass,
        production,
        "playable-shelf",
        "blackglass-shelf",
        bevel=0.1,
    )
    create_extruded_polygon(
        "Ember_Shelf_Stratum_Upper",
        scaled_outline(SHELF_OUTLINE, 1.018),
        0.21,
        0.04,
        blackglass if terrain_direction in PRODUCTION_TERRAIN_DIRECTIONS else mineral,
        production,
        "shelf-stratum",
        "upper-stratum",
        bevel=0.025,
    )
    create_extruded_polygon(
        "Ember_Shelf_Stratum_Lower",
        scaled_outline(SHELF_OUTLINE, 1.035),
        -0.12,
        -0.31,
        blackglass,
        production,
        "shelf-stratum",
        "lower-stratum",
        bevel=0.025,
    )
    create_surface_field(SHELF_OUTLINE, blackglass, production)
    create_shelf_edge_talus(SHELF_OUTLINE, blackglass, mineral, production)
    if terrain_direction in PRODUCTION_TERRAIN_DIRECTIONS:
        create_stage_crust_transition(blackglass, near_caldera, production)

    fissures = [
        [(-7.2, 5.6), (-6.35, 4.35), (-6.1, 3.15), (-5.45, 2.15), (-5.6, 0.9), (-5.15, -0.15), (-5.3, -1.45), (-4.85, -2.8), (-4.95, -4.0), (-4.5, -5.2), (-3.8, -6.9)],
        [(7.05, 3.8), (6.25, 2.85), (5.85, 1.75), (5.95, 0.65), (5.4, -0.35), (5.55, -1.55), (5.1, -2.65), (5.4, -3.75), (5.15, -4.9)],
        [(-1.0, 6.0), (-0.4, 5.05), (-0.55, 4.2), (0.05, 3.3)],
    ]
    for index, points in enumerate(fissures):
        create_ribbon(
            f"Ember_Fissure_Chasm_{index + 1:02d}",
            points,
            0.24 if index == 0 else 0.18,
            SURFACE_Z + 0.009,
            chasm,
            production,
            "cooled-fissure",
            f"fissure-{index + 1:02d}",
        )
        # The responsive platform owns the active floor heat in runtime. The
        # production shelf only carries cooled seams so the scene never doubles
        # into a drawn-on neon diagram.
        live_ranges: list[tuple[int, int]] = []
        for live_index, (start, end) in enumerate(live_ranges):
            live_points = points[start : end + 1]
            if len(live_points) < 2:
                continue
            create_ribbon(
                f"Ember_Fissure_Heat_{index + 1:02d}_{live_index + 1:02d}",
                live_points,
                0.026 if index == 0 else 0.022,
                SURFACE_Z + 0.012,
                lava,
                production,
                "live-fissure",
                f"fissure-{index + 1:02d}-live-{live_index + 1:02d}",
            )

    print("[ember-r7] importing selected geology and authoring transitions", flush=True)
    furnace = create_meshy_geology_ensemble(
        columnar_basalt,
        ash,
        production,
    )
    print("[ember-r7] authoring surrounding volcanic country and lava channel", flush=True)
    river = sample_river_centerline()
    volcanic_basin = create_volcanic_basin(
        [near_caldera, middle_caldera, far_caldera],
        production,
        river,
        terrain_direction,
    )
    distant_vent = [furnace["distantCaldera"]]
    levees = create_lava_channel_levees(near_caldera, production, river)
    return {
        "furnace": furnace,
        "volcanicBasin": volcanic_basin,
        "distantVent": distant_vent,
        "lavaChannelLevees": levees,
        "materials": {
            "blackglass": blackglass,
            "chasm": chasm,
            "lava": lava,
            "mineral": mineral,
            "ash": ash,
            "columnar": columnar_basalt,
            "nearCaldera": near_caldera,
            "middleCaldera": middle_caldera,
            "farCaldera": far_caldera,
        },
    }


def r9_basin_family_index(
    direction: str,
    x: float,
    y: float,
    slope: float,
    river: list[Vector],
) -> int:
    runtime_z = -y
    radial_distance = math.hypot(x, runtime_z)
    river_distance, _ = river_distance_and_height(x, y, river)
    phase = (
        math.sin(x * 0.087 + runtime_z * 0.041)
        + math.sin(x * 0.029 - runtime_z * 0.071 + 1.7)
    ) * 0.5

    if direction == "fresh-flow-field":
        if river_distance < 7.6:
            return 0
        if slope > 0.26:
            return 2
        if radial_distance < 82.0 and phase > -0.18:
            return 0
        if phase > 0.28:
            return 1
        return 3
    if direction == "ash-choked-caldera":
        if river_distance < 9.5:
            return 3
        if slope > 0.23:
            return 2
        if phase > 0.26 and radial_distance < 136.0:
            return 1
        return 0
    if direction == "hydrothermal-rift":
        fumarole_distance = math.hypot(x + 13.0, runtime_z - 11.0)
        if fumarole_distance < 14.0:
            return 2
        if river_distance < 10.0:
            return 1
        if slope > 0.3:
            return 3
        return 0
    if direction == "fresh-rift-synthesis":
        if river_distance < 9.2:
            return 1
        if slope > 0.26:
            return 2
        if radial_distance < 82.0 and phase > -0.18:
            return 0
        if phase > 0.32:
            return 1
        return 3
    raise ValueError(f"Unknown R9 surface direction: {direction}")


def assign_single_surface_family(
    obj: bpy.types.Object,
    material: bpy.types.Material,
) -> int:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
    return len(obj.data.polygons)


def apply_r9_surface_direction(
    production: bpy.types.Collection,
    direction: str,
    materials: list[bpy.types.Material],
    blended_terrain: bpy.types.Material,
    river: list[Vector],
) -> dict[str, int]:
    """Apply a four-family ecology without altering the approved R8 geometry."""

    family_counts = {str(index): 0 for index in range(4)}
    stage_family = {
        "fresh-flow-field": 0,
        "ash-choked-caldera": 0,
        "hydrothermal-rift": 0,
        "fresh-rift-synthesis": 0,
    }[direction]
    role_family = {
        "fresh-flow-field": {
            "cooled-fissure": 2,
            "lava-channel-levee": 1,
            "meshy-hero-geology": 2,
            "meshy-lava-bank": 1,
            "meshy-fumarole-talus": 3,
            "meshy-distant-caldera": 3,
        },
        "ash-choked-caldera": {
            "cooled-fissure": 2,
            "lava-channel-levee": 3,
            "meshy-hero-geology": 2,
            "meshy-lava-bank": 3,
            "meshy-fumarole-talus": 1,
            "meshy-distant-caldera": 0,
        },
        "hydrothermal-rift": {
            "cooled-fissure": 0,
            "lava-channel-levee": 1,
            "meshy-hero-geology": 3,
            "meshy-lava-bank": 1,
            "meshy-fumarole-talus": 2,
            "meshy-distant-caldera": 3,
        },
        "fresh-rift-synthesis": {
            "cooled-fissure": 1,
            "lava-channel-levee": 1,
            "meshy-hero-geology": 2,
            "meshy-lava-bank": 1,
            "meshy-fumarole-talus": 3,
            "meshy-distant-caldera": 3,
        },
    }[direction]
    stage_roles = {
        "playable-shelf",
        "playable-surface",
        "shelf-stratum",
        "stage-crust-transition",
    }
    excluded_roles = {"live-fissure"}

    for obj in production.all_objects:
        if obj.type != "MESH":
            continue
        role = str(obj.get("tka_role", ""))
        if not role or role in excluded_roles:
            continue
        if role == "volcanic-basin":
            obj.data.materials.clear()
            obj.data.materials.append(blended_terrain)
            existing_attribute = obj.data.color_attributes.get("R9SurfaceMask")
            if existing_attribute is not None:
                obj.data.color_attributes.remove(existing_attribute)
            surface_mask = obj.data.color_attributes.new(
                name="R9SurfaceMask",
                type="FLOAT_COLOR",
                domain="CORNER",
            )
            for polygon in obj.data.polygons:
                center = polygon.center
                family_index = r9_basin_family_index(
                    direction,
                    float(center.x),
                    float(center.y),
                    1.0 - abs(float(polygon.normal.z)),
                    river,
                )
                polygon.material_index = 0
                family_counts[str(family_index)] += 1
                for loop_index in polygon.loop_indices:
                    vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index]
                    vertex_family = r9_basin_family_index(
                        direction,
                        float(vertex.co.x),
                        float(vertex.co.y),
                        1.0 - abs(float(vertex.normal.z)),
                        river,
                    )
                    surface_mask.data[loop_index].color = (
                        1.0 if vertex_family == 0 else 0.0,
                        1.0 if vertex_family == 1 else 0.0,
                        1.0 if vertex_family == 2 else 0.0,
                        1.0,
                    )
            continue

        if role in stage_roles:
            family_index = stage_family
        elif role in role_family:
            family_index = role_family[role]
        elif "talus" in role or "rubble" in role or "collapsed" in role:
            family_index = 1
        elif "column" in role or "basalt" in role or "outcrop" in role:
            family_index = 2
        else:
            family_index = stage_family
        family_counts[str(family_index)] += assign_single_surface_family(
            obj, materials[family_index]
        )

    return family_counts


def point_camera(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def create_qa_scene(qa: bpy.types.Collection) -> dict[str, bpy.types.Object]:
    performer_material = create_plain_material("QA_Performer", (0.36, 0.72, 0.82, 1.0), 0.45, emission_strength=0.035)
    for index, (x, y) in enumerate(((-1.35, 0.15), (0.0, -0.25), (1.35, 0.2))):
        pieces: list[bpy.types.Object] = []
        bpy.ops.mesh.primitive_cone_add(
            vertices=12,
            radius1=0.27,
            radius2=0.38,
            depth=0.82,
            location=(x, y, 1.39),
        )
        pieces.append(bpy.context.object)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.245, location=(x, y, 2.08))
        pieces.append(bpy.context.object)
        for leg_x in (-0.11, 0.11):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=10,
                radius=0.085,
                depth=0.76,
                location=(x + leg_x, y, 0.59),
            )
            pieces.append(bpy.context.object)
        for arm_x in (-0.47, 0.47):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=10,
                radius=0.07,
                depth=0.54,
                location=(x + arm_x * 0.5, y, 1.48),
                rotation=(0.0, math.radians(90.0), 0.0),
            )
            pieces.append(bpy.context.object)
        for piece_index, piece in enumerate(pieces):
            piece.name = f"QA_Performer_{index + 1:02d}_Part_{piece_index + 1:02d}"
            move_to_collection(piece, qa)
            piece.data.materials.append(performer_material)

    qa_lava_material = create_plain_material(
        "QA_Lava_River",
        (0.42, 0.018, 0.002, 1.0),
        0.4,
        emission_strength=1.25,
    )
    qa_lava_crust_material = create_plain_material(
        "QA_Lava_Crust",
        (0.014, 0.018, 0.017, 1.0),
        0.93,
        emission_strength=0.025,
    )
    river = sample_river_centerline(144)
    create_qa_lava_river(qa_lava_material, qa, river, qa_lava_crust_material)

    lights: list[bpy.types.Object] = []
    light_specs = [
        ("QA_Moon_Key", "AREA", (-7.0, 4.5, 15.0), (0.72, 0.87, 0.86), 3050.0, 11.0, (-1.0, -7.0, 2.3)),
        ("QA_Cold_Fill", "AREA", (11.0, 1.0, 9.0), (0.2, 0.42, 0.48), 1280.0, 8.0, (1.5, -9.0, 2.5)),
        ("QA_Furnace_Face", "AREA", (-4.0, -3.5, 12.5), (0.47, 0.68, 0.67), 1750.0, 10.0, HERO_CENTER),
        ("QA_Furnace_Edge", "AREA", (12.5, -8.0, 10.0), (0.31, 0.48, 0.56), 1180.0, 8.0, HERO_CENTER),
        ("QA_Fault_Rim", "AREA", (1.0, -17.0, 5.2), (1.0, 0.12, 0.018), 920.0, 4.0, HERO_CENTER),
        ("QA_Rear_Moon", "AREA", (0.0, -31.0, 16.0), (0.48, 0.67, 0.69), 2450.0, 13.0, HERO_CENTER),
    ]
    for name, kind, location, color, energy, size, target in light_specs:
        data = bpy.data.lights.new(name, kind)
        data.color = color
        data.energy = energy
        data.use_shadow = False
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        qa.objects.link(obj)
        obj.location = location
        point_camera(obj, target)
        lights.append(obj)

    # Broad moonlight is what separates the hundred-metre caldera wall from
    # the sky. Point and area lights were intentionally scoped to the furnace.
    caldera_sun_data = bpy.data.lights.new("QA_Caldera_Moon", "SUN")
    caldera_sun_data.color = (0.28, 0.43, 0.48)
    caldera_sun_data.energy = 0.8
    caldera_sun_data.angle = math.radians(16.0)
    caldera_sun_data.use_shadow = False
    caldera_sun = bpy.data.objects.new("QA_Caldera_Moon", caldera_sun_data)
    qa.objects.link(caldera_sun)
    caldera_sun.rotation_euler = (math.radians(38.0), math.radians(-18.0), math.radians(-31.0))
    lights.append(caldera_sun)

    for index, location in enumerate([(-5.1, -1.4, 0.72), (5.25, -1.6, 0.72), (0.2, -14.9, 3.4)]):
        data = bpy.data.lights.new(f"QA_Fissure_Glow_{index + 1:02d}", "POINT")
        data.color = (1.0, 0.12, 0.015)
        data.energy = 120.0 if index < 2 else 360.0
        data.shadow_soft_size = 1.1 if index < 2 else 2.4
        data.use_shadow = False
        obj = bpy.data.objects.new(data.name, data)
        qa.objects.link(obj)
        obj.location = location
        lights.append(obj)

    for index in (18, 42, 68, 94, 122):
        center = river[index]
        data = bpy.data.lights.new(f"QA_River_Glow_{index:03d}", "POINT")
        data.color = (1.0, 0.15, 0.018)
        data.energy = 330.0 if index < 100 else 240.0
        data.shadow_soft_size = 2.8
        data.use_shadow = False
        obj = bpy.data.objects.new(data.name, data)
        qa.objects.link(obj)
        obj.location = (center.x, center.y, center.z + 1.1)
        lights.append(obj)

    camera_specs = {
        "hero": ((0.0, 19.8, 6.55), (0.35, -7.4, 2.5), "PERSP", 40.0),
        "front-right": ((14.8, 14.8, 8.0), (0.2, -5.8, 2.45), "PERSP", 43.0),
        "right": ((20.0, 0.0, 7.5), (0.0, -3.5, 2.25), "PERSP", 45.0),
        # Rear-sector cameras judge the exterior volcanic mass itself. Looking
        # through that mass toward the performers would manufacture clipping
        # instead of proving a composed back and silhouette.
        "rear-right": ((27.0, -49.0, 14.0), (0.0, -10.0, 3.5), "PERSP", 50.0),
        "rear": ((0.0, -54.0, 15.0), (0.0, -12.0, 3.5), "PERSP", 50.0),
        # The breached-caldera west bench rises beneath this sector. Lift the
        # registered proof camera above the bench so the orbit judges the
        # composed terrain instead of clipping through its surface.
        "rear-left": ((-27.0, -49.0, 24.0), (0.0, -10.0, 4.25), "PERSP", 50.0),
        "left": ((-20.0, 0.0, 7.5), (0.0, -3.5, 2.25), "PERSP", 45.0),
        "front-left": ((-14.8, 14.8, 8.0), (0.2, -5.8, 2.45), "PERSP", 43.0),
        # This camera reproduces the low audience-side review angle that exposed
        # R9's empty southern apron. It stays registered so future terrain
        # passes cannot hide that quadrant behind elevated orbit cameras.
        "audience": ((-3.32, -28.41, 2.35), (-4.71, 4.75, 0.72), "PERSP", 50.0),
        "detail": ((10.8, 0.8, 6.9), HERO_CENTER, "PERSP", 52.0),
        "plan": ((0.0, -8.0, 135.0), (0.0, -8.0, 0.0), "ORTHO", 230.0),
    }
    cameras: dict[str, bpy.types.Object] = {}
    for name, (location, target, camera_type, value) in camera_specs.items():
        data = bpy.data.cameras.new(f"QA_{name.title()}_Camera")
        data.type = camera_type
        if camera_type == "PERSP":
            data.lens = value
        else:
            data.ortho_scale = value
        obj = bpy.data.objects.new(data.name, data)
        qa.objects.link(obj)
        obj.location = location
        point_camera(obj, target)
        cameras[name] = obj
    return cameras


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 1.05
    world = bpy.data.worlds.new("Ember_Volcanic_World_R7")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.02, 0.021, 1.0)
    background.inputs["Strength"].default_value = 0.48
    scene.world = world


def render_evidence(
    cameras: dict[str, bpy.types.Object],
    filename_revision: str = "r7",
) -> dict[str, str]:
    renders: dict[str, str] = {}
    for name, camera in cameras.items():
        output = EVIDENCE_DIR / f"ember-volcanic-world-production-slice-{filename_revision}-{name}.png"
        bpy.context.scene.camera = camera
        bpy.context.scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        renders[name] = output.relative_to(PROJECT_ROOT).as_posix()
    return renders


def render_r8_target_evidence(
    cameras: dict[str, bpy.types.Object],
    terrain_objects: dict[str, bpy.types.Object],
) -> dict[str, dict[str, str]]:
    R8_TARGET_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    target_cameras = ("hero", "front-right", "left", "rear")
    renders: dict[str, dict[str, str]] = {}
    for direction, terrain in terrain_objects.items():
        for candidate in terrain_objects.values():
            candidate.hide_render = candidate is not terrain
        renders[direction] = {}
        for camera_name in target_cameras:
            output = R8_TARGET_EVIDENCE_DIR / f"ember-r8-{direction}-{camera_name}.png"
            scene.camera = cameras[camera_name]
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            renders[direction][camera_name] = output.relative_to(PROJECT_ROOT).as_posix()
    for terrain in terrain_objects.values():
        terrain.hide_render = False
    return renders


def build_r8_target_set() -> None:
    R8_TARGET_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    clean_scene()
    production = make_collection("EMBER_PRODUCTION_SLICE")
    qa = make_collection("EMBER_QA")
    print("[ember-r8] building shared R7 geology and first terrain direction", flush=True)
    geometry = build_production_geometry(production, R8_TERRAIN_DIRECTIONS[0])
    river = sample_river_centerline()
    terrain_materials = [
        geometry["materials"]["nearCaldera"],
        geometry["materials"]["middleCaldera"],
        geometry["materials"]["farCaldera"],
    ]
    terrain_objects = {R8_TERRAIN_DIRECTIONS[0]: geometry["volcanicBasin"]}
    for direction in R8_TERRAIN_DIRECTIONS[1:]:
        print(f"[ember-r8] building {direction}", flush=True)
        terrain_objects[direction] = create_volcanic_basin(
            terrain_materials,
            production,
            river,
            direction,
        )
    configure_render()
    cameras = create_qa_scene(qa)
    print("[ember-r8] rendering registered target set", flush=True)
    renders = render_r8_target_evidence(cameras, terrain_objects)
    R8_TARGET_BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(R8_TARGET_BLEND_PATH), compress=True)
    report = {
        "revision": "ember-geological-world-gate3-r8",
        "authorityTrackerItem": "s3cxnp6hOLBVQR5dDF42",
        "fixedElements": {
            "actionClearanceMeters": ACTION_RADIUS,
            "lavaRiverControlPointsRuntimeXZHeight": RIVER_POINTS_RUNTIME,
            "meshyGeology": [
                "hero-columnar-escarpment",
                "collapsed-lava-bank",
                "obsidian-fumarole-talus",
                "distant-breached-caldera",
            ],
            "registeredCameras": list(cameras),
        },
        "directions": list(R8_TERRAIN_DIRECTIONS),
        "renders": renders,
        "blend": R8_TARGET_BLEND_PATH.relative_to(PROJECT_ROOT).as_posix(),
    }
    report_path = R8_TARGET_EVIDENCE_DIR / "ember-r8-terrain-target-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


def render_r9_surface_target_evidence(
    production: bpy.types.Collection,
    cameras: dict[str, bpy.types.Object],
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, int]]]:
    R9_SURFACE_TARGET_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    target_cameras = ("hero", "front-right", "left", "rear")
    river = sample_river_centerline()
    renders: dict[str, dict[str, str]] = {}
    family_counts: dict[str, dict[str, int]] = {}
    for direction in R9_SURFACE_DIRECTIONS:
        print(f"[ember-r9] baking and applying {direction}", flush=True)
        materials = create_r9_surface_materials(direction)
        blended_terrain = create_r9_blended_terrain_material(direction, materials)
        for material in materials:
            material.use_fake_user = True
        blended_terrain.use_fake_user = True
        family_counts[direction] = apply_r9_surface_direction(
            production, direction, materials, blended_terrain, river
        )
        renders[direction] = {}
        for camera_name in target_cameras:
            output = (
                R9_SURFACE_TARGET_EVIDENCE_DIR
                / f"ember-r9-{direction}-{camera_name}.png"
            )
            scene.camera = cameras[camera_name]
            scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            renders[direction][camera_name] = output.relative_to(PROJECT_ROOT).as_posix()
    return renders, family_counts


def build_r9_surface_target_set() -> None:
    R9_SURFACE_TARGET_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    clean_scene()
    production = make_collection("EMBER_PRODUCTION_SLICE")
    qa = make_collection("EMBER_QA")
    print("[ember-r9] rebuilding the approved R8 world", flush=True)
    build_production_geometry(production, "breached-caldera-terraces")
    configure_render()
    cameras = create_qa_scene(qa)
    print("[ember-r9] rendering the registered surface target set", flush=True)
    renders, family_counts = render_r9_surface_target_evidence(production, cameras)

    # The visual-target source stays small and editable. Texture pixels are
    # deterministic builder products, so the Blend retains geometry, cameras,
    # material-family graphs, and labels while this script remains the lossless
    # reconstruction path for every map.
    for image in list(bpy.data.images):
        bpy.data.images.remove(image, do_unlink=True)
    R9_SURFACE_TARGET_BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(R9_SURFACE_TARGET_BLEND_PATH), compress=True
    )

    report = {
        "revision": "ember-surface-ecology-gate3-r9",
        "authorityTrackerItem": "uXmi4z9lL7zCiNq5ULCp",
        "fixedElements": {
            "terrainDirection": "breached-caldera-terraces",
            "actionClearanceMeters": ACTION_RADIUS,
            "lavaRiverControlPointsRuntimeXZHeight": RIVER_POINTS_RUNTIME,
            "meshyGeology": [
                "hero-columnar-escarpment",
                "collapsed-lava-bank",
                "obsidian-fumarole-talus",
                "distant-breached-caldera",
            ],
            "atmosphere": "blackglass-inferno",
            "registeredCameras": list(cameras),
        },
        "directions": {
            direction: {
                "families": [
                    {
                        "index": index,
                        "slug": specification["slug"],
                        "label": specification["label"],
                        "pattern": specification["pattern"],
                    }
                    for index, specification in enumerate(
                        R9_SURFACE_FAMILIES[direction]
                    )
                ],
                "assignedPolygonCounts": family_counts[direction],
            }
            for direction in R9_SURFACE_DIRECTIONS
        },
        "comparisonStructure": {
            "independentDirections": list(R9_SURFACE_DIRECTIONS[:3]),
            "directorSynthesis": R9_SURFACE_DIRECTIONS[3],
            "synthesisRationale": (
                "Fresh Flow Field supplies the coherent young-lava base. "
                "Hydrothermal Rift contributes only restrained iron-rich contact "
                "zones at the river and lava banks; broad sulfur color fields are rejected."
            ),
        },
        "renders": renders,
        "editableSource": "scripts/build-ember-production-slice.py --r9-surface-targets",
        "blend": R9_SURFACE_TARGET_BLEND_PATH.relative_to(PROJECT_ROOT).as_posix(),
        "blendBytes": R9_SURFACE_TARGET_BLEND_PATH.stat().st_size,
        "blendSha256": sha256(R9_SURFACE_TARGET_BLEND_PATH),
        "productionBoundary": (
            "Gate 3 evidence only. No runtime asset, shader owner, or production "
            "material was changed before Austen selects a registered direction."
        ),
        "meshyCreditsSpent": 0,
        "meshyCreditsReserved": 40,
    }
    report_path = (
        R9_SURFACE_TARGET_EVIDENCE_DIR
        / "ember-r9-surface-target-report.json"
    )
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


def export_production(production: bpy.types.Collection) -> None:
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAW_GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in production.all_objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(RAW_GLB_PATH),
        export_format="GLB",
        export_yup=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_apply=True,
        use_selection=True,
    )
    if REVISION in {
        "ember-geological-world-gate4-r8",
        "ember-fresh-rift-surface-gate4-r9",
        "ember-living-caldera-gate4-r10",
    }:
        # The shipped source stays below GitHub's 100 MiB hard limit. All image
        # pixels are deterministic build products or live in the four tracked
        # Meshy source GLBs, so geometry/material graphs remain editable while
        # the builder is the lossless texture reconstruction path.
        for image in list(bpy.data.images):
            bpy.data.images.remove(image, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)


def scene_report(
    production: bpy.types.Collection,
    cameras: dict[str, bpy.types.Object],
    renders: dict[str, str],
    terrain_direction: str = "r7-continuous-basin",
) -> dict[str, object]:
    mesh_objects = [obj for obj in production.all_objects if obj.type == "MESH"]
    minimum, maximum = combined_bounds(mesh_objects)
    for obj in mesh_objects:
        obj.data.calc_loop_triangles()
    mesh_triangle_counts = {
        obj.name: len(obj.data.loop_triangles) for obj in mesh_objects
    }
    triangle_count = sum(mesh_triangle_counts.values())
    maximum_mesh_triangle_object = max(
        mesh_triangle_counts, key=mesh_triangle_counts.get
    )
    material_names = sorted(
        {
            material.name
            for obj in mesh_objects
            for material in obj.data.materials
            if material is not None
        }
    )
    role_counts: dict[str, int] = {}
    for obj in mesh_objects:
        role = str(obj.get("tka_role", "unclassified"))
        role_counts[role] = role_counts.get(role, 0) + 1
    column_objects = [obj for obj in mesh_objects if obj.get("tka_role") == "columnar-joint"]
    joint_side_distribution: dict[str, int] = {}
    for obj in column_objects:
        side_count = str(obj.get("tka_joint_sides", "unknown"))
        joint_side_distribution[side_count] = joint_side_distribution.get(side_count, 0) + 1
    structural_objects = [
        obj
        for obj in mesh_objects
        if obj.get("tka_role")
        in {
            "columnar-joint",
            "buried-column-root",
            "fallen-column",
            "perimeter-column-root",
            "collapsed-entablature",
            "buried-column-talus",
            "perimeter-talus-cluster",
            "secondary-columnar-outcrop",
            "lava-channel-levee",
            "meshy-hero-geology",
            "meshy-lava-bank",
            "meshy-fumarole-talus",
            "meshy-distant-caldera",
        }
    ]
    minimum_structural_clearance = min(
        float(
            obj.get(
                "tka_radial_clearance",
                math.hypot(obj.location.x, obj.location.y)
                - float(obj.get("tka_joint_radius", 0.0)),
            )
        )
        for obj in structural_objects
    )
    lava_bank = next(
        obj for obj in mesh_objects if obj.get("tka_role") == "meshy-lava-bank"
    )
    river = sample_river_centerline()
    lava_bank_centerline_clearance = min(
        river_distance_and_height(
            (lava_bank.matrix_world @ vertex.co).x,
            (lava_bank.matrix_world @ vertex.co).y,
            river,
        )[0]
        for vertex in lava_bank.data.vertices
    )
    lava_bank_edge_clearance = lava_bank_centerline_clearance - (
        float(WORLD_CONTRACT["lavaRiver"]["width"]) * 0.5
    )
    return {
        "revision": REVISION,
        "blenderVersion": bpy.app.version_string,
        "authority": {
            "spatial": "docs/superpowers/specs/ember-spatial-directions/scene-development.md#r1-outcome",
            "selectedLook": "docs/superpowers/specs/ember-spatial-directions/evidence/lookdev-r3/ember-lookdev-r3-comparison-board.png",
            "gate3SelectionTrackerItem": "QRHbwRQLhM7Zn9LyYHOd",
            "gate4AuthorizationTrackerItem": "gME4uHJawz9dtTlirRl8",
            "gate4ArtRevisionTrackerItem": "5otAzYdNg5Wp5E27mgfo",
            "gate4VolcanicWorldTrackerItem": "nu73zqvPJRxio4T2sWz7",
            "gate4ContinuityTrackerItem": "ATURN84Ov2hmjWUndebl",
            "gate4MeshyGeologyTrackerItem": "ZSnkB98pb0wz6PO17XKp",
            "gate3GeologicalWorldTrackerItem": (
                "s3cxnp6hOLBVQR5dDF42"
                if terrain_direction in PRODUCTION_TERRAIN_DIRECTIONS
                else None
            ),
            "gate3SurfaceEcologyTrackerItem": (
                "uXmi4z9lL7zCiNq5ULCp"
                if REVISION in {
                    "ember-fresh-rift-surface-gate4-r9",
                    "ember-living-caldera-gate4-r10",
                }
                else None
            ),
            "gate4SurfaceEcologyTrackerItem": (
                "ahPuPwh34G3FeqvUEHsB"
                if REVISION in {
                    "ember-fresh-rift-surface-gate4-r9",
                    "ember-living-caldera-gate4-r10",
                }
                else None
            ),
        },
        "sources": [
            {
                "role": "hero-columnar-escarpment",
                "sourceTaskId": "01a04587-db17-7a2a-b386-849e70d03b4e",
                "retextureTaskId": "01a0459b-0657-711d-89d0-0aa73e15e5cb",
                "remeshTaskId": "01a045af-5015-7cb4-ac34-0d62f4269b67",
                "referenceDirectory": "assets/meshy-refs/ember/hero-columnar-escarpment",
            },
            {
                "role": "collapsed-lava-bank",
                "sourceTaskId": "01a0458b-0cf6-7131-90ac-0c7b38dac384",
                "retextureTaskId": "01a045a0-4707-72e6-8e2f-ce95c2dabb61",
                "remeshTaskId": "01a045b2-f26d-772f-a92e-9bf36e3fc318",
                "referenceDirectory": "assets/meshy-refs/ember/collapsed-lava-bank",
            },
            {
                "role": "obsidian-fumarole-talus",
                "sourceTaskId": "01a0458e-5a9d-7d9c-a115-d569ba60119a",
                "retextureTaskId": "01a045a5-a3d7-73a6-8530-eb42836c009f",
                "remeshTaskId": "01a045b6-292c-7930-bdd7-ad8a5222989d",
                "referenceDirectory": "assets/meshy-refs/ember/obsidian-fumarole-talus",
            },
            {
                "role": "distant-breached-caldera",
                "sourceTaskId": "01a045d9-7610-7858-bf2d-3caba206f23a",
                "retextureTaskId": "01a045db-a666-78ec-99a2-3195f6a55319",
                "remeshTaskId": "01a045e1-a103-7626-bff7-b62b29c74094",
                "referenceDirectory": "assets/meshy-refs/ember/distant-breached-caldera",
            },
        ],
        "provenance": (
            "Four unique geology silhouettes were generated from registered Ember "
            "multiview references, selected from paired auditions, retextured with the "
            "same references, remeshed through Meshy's topology service, and embedded once each. "
            "Scene-authored terrain and rubble remain the continuity tissue."
        ),
        "artifacts": {
            "blend": BLEND_PATH.relative_to(PROJECT_ROOT).as_posix(),
            "rawGlb": RAW_GLB_PATH.relative_to(PROJECT_ROOT).as_posix(),
            "rawGlbSha256": sha256(RAW_GLB_PATH),
            "rawGlbBytes": RAW_GLB_PATH.stat().st_size,
            "worldContract": WORLD_CONTRACT_PATH.relative_to(PROJECT_ROOT).as_posix(),
            "worldContractSha256": sha256(WORLD_CONTRACT_PATH),
        },
        "contract": {
            "stageSurfaceLocalY": SURFACE_Z,
            "clearActionRadiusMeters": ACTION_RADIUS,
            "minimumStructuralRadialClearanceMeters": round(minimum_structural_clearance, 4),
            "heroCenterBlenderXYZ": list(HERO_CENTER),
            "heroCenterRuntimeXYZ": [HERO_CENTER[0], HERO_CENTER[2], -HERO_CENTER[1]],
            "heroInPositiveRuntimeZFarField": True,
            "selectedDirection": (
                "Living Caldera with Fresh Rift ecology"
                if REVISION == "ember-living-caldera-gate4-r10"
                else "Fresh Rift over Breached Caldera Terraces"
                if REVISION == "ember-fresh-rift-surface-gate4-r9"
                else "Breached Caldera Terraces"
                if terrain_direction == "breached-caldera-terraces"
                else "Fractured Columnar Chasm"
            ),
            "terrainDirection": terrain_direction,
            "revisionDirection": (
                "A continuous four-sided caldera whose offset walls, north and south "
                "river breaches, audience-side benches, and registered low review camera "
                "carry the Fresh Rift ecology through every orbit quadrant"
                if REVISION == "ember-living-caldera-gate4-r10"
                else "A four-family volcanic ecology with young lava crust, iron-rich "
                "river-contact alteration, fractured basalt scarps, and sheltered ash "
                "blended across the preserved breached-caldera terrain"
                if REVISION == "ember-fresh-rift-surface-gate4-r9"
                else "An asymmetrical breached caldera with collapsed terraces, an embedded "
                "blackglass action shelf, protected Meshy formations, and a river-cut "
                "travel saddle"
                if terrain_direction == "breached-caldera-terraces"
                else "Meshy-authored blackglass escarpment, collapsed lava banks, fumarole "
                "talus, and a breached distant caldera inside continuous volcanic "
                "country and a through-frame river"
            ),
            "performerFacing": "negative-runtime-z-toward-front-stage-audience",
            "lavaRiverControlPointsRuntimeXZHeight": RIVER_POINTS_RUNTIME,
            "collapsedLavaBankCenterRuntimeXZ": [
                round(lava_bank.location.x, 4),
                round(-lava_bank.location.y, 4),
            ],
            "collapsedLavaBankRiverEdgeClearanceMeters": round(
                lava_bank_edge_clearance, 4
            ),
            "continuousOrbitDepthBands": (
                ["foreground", "midground", "north-rim", "south-rim"]
                if terrain_direction == "living-caldera"
                else []
            ),
            "registeredReviewCameras": list(cameras),
        },
        "geometry": {
            "meshObjectCount": len(mesh_objects),
            "triangleCount": triangle_count,
            "maximumMeshTriangleCount": mesh_triangle_counts[
                maximum_mesh_triangle_object
            ],
            "maximumMeshTriangleObject": maximum_mesh_triangle_object,
            "materialCount": len(material_names),
            "materials": material_names,
            "roleCounts": dict(sorted(role_counts.items())),
            "columnarJointCount": len(column_objects),
            "columnSideDistribution": dict(sorted(joint_side_distribution.items())),
            "columnHeightRangeMeters": (
                [
                    round(min(float(obj["tka_joint_height"]) for obj in column_objects), 4),
                    round(max(float(obj["tka_joint_height"]) for obj in column_objects), 4),
                ]
                if column_objects
                else []
            ),
            "maximumCapLossMeters": (
                round(max(float(obj["tka_cap_loss_max"]) for obj in column_objects), 4)
                if column_objects
                else None
            ),
            "authoredHeroMeshCount": len(structural_objects),
            "authoredWorldMeshCount": len(mesh_objects),
            "volcanicBasinCount": role_counts.get("volcanic-basin", 0),
            "lavaChannelLeveeCount": role_counts.get("lava-channel-levee", 0),
            "boundsBlenderXYZ": {
                "min": [round(value, 4) for value in minimum],
                "max": [round(value, 4) for value in maximum],
            },
        },
        "cameras": {
            name: {
                "position": [round(value, 4) for value in camera.location],
                "type": camera.data.type,
                "lensMm": camera.data.lens if camera.data.type == "PERSP" else None,
                "orthoScale": camera.data.ortho_scale if camera.data.type == "ORTHO" else None,
            }
            for name, camera in cameras.items()
        },
        "renders": renders,
    }


def main() -> None:
    global BLEND_PATH, EVIDENCE_DIR, REPORT_PATH, REVISION
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if "--r8-targets" in arguments:
        build_r8_target_set()
        return
    if "--r9-surface-targets" in arguments:
        build_r9_surface_target_set()
        return
    terrain_direction = "r7-continuous-basin"
    filename_revision = "r7"
    build_r9_production = "--r9-production" in arguments
    build_r10_production = "--r10-production" in arguments
    build_surface_production = build_r9_production or build_r10_production
    if "--r8-production" in arguments:
        EVIDENCE_DIR = R8_PRODUCTION_EVIDENCE_DIR
        BLEND_PATH = R8_PRODUCTION_BLEND_PATH
        REPORT_PATH = R8_PRODUCTION_REPORT_PATH
        REVISION = "ember-geological-world-gate4-r8"
        terrain_direction = "breached-caldera-terraces"
        filename_revision = "r8"
    if build_r9_production:
        EVIDENCE_DIR = R9_PRODUCTION_EVIDENCE_DIR
        BLEND_PATH = R9_PRODUCTION_BLEND_PATH
        REPORT_PATH = R9_PRODUCTION_REPORT_PATH
        REVISION = "ember-fresh-rift-surface-gate4-r9"
        terrain_direction = "breached-caldera-terraces"
        filename_revision = "r9"
    if build_r10_production:
        EVIDENCE_DIR = R10_PRODUCTION_EVIDENCE_DIR
        BLEND_PATH = R10_PRODUCTION_BLEND_PATH
        REPORT_PATH = R10_PRODUCTION_REPORT_PATH
        REVISION = "ember-living-caldera-gate4-r10"
        terrain_direction = "living-caldera"
        filename_revision = "r10"
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    clean_scene()
    production = make_collection("EMBER_PRODUCTION_SLICE")
    qa = make_collection("EMBER_QA")
    print("[ember-r7] building production geometry", flush=True)
    geometry = build_production_geometry(production, terrain_direction)
    surface_assets: dict[str, object] | None = None
    surface_family_counts: dict[str, int] | None = None
    if build_surface_production:
        print("[ember-r10] applying the approved Fresh Rift ecology", flush=True)
        direction = "fresh-rift-synthesis"
        surface_materials = create_r9_surface_materials(direction)
        blended_terrain = create_r9_blended_terrain_material(
            direction,
            surface_materials,
        )
        river = sample_river_centerline()
        surface_family_counts = apply_r9_surface_direction(
            production,
            direction,
            surface_materials,
            blended_terrain,
            river,
        )
        surface_assets = publish_r9_runtime_surface_assets(
            surface_materials,
            river,
        )
    print("[ember-r7] configuring QA scene", flush=True)
    configure_render()
    cameras = create_qa_scene(qa)
    print("[ember-r7] rendering evidence", flush=True)
    renders = render_evidence(cameras, filename_revision)
    print("[ember-r7] exporting production asset", flush=True)
    export_production(production)
    report = scene_report(production, cameras, renders, terrain_direction)
    if build_surface_production:
        report["surfaceEcology"] = {
            "direction": "fresh-rift-synthesis",
            "approvalTrackerItem": "ahPuPwh34G3FeqvUEHsB",
            "familyPolygonCounts": surface_family_counts,
            "runtimeAssets": surface_assets,
            "materialOwner": "src/lib/shared/3d/environments/primitives/masked-ground-detail-material.ts",
            "sceneAdapter": "src/lib/shared/3d/environments/scenes/ember/ember-ground-detail.ts",
        }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
