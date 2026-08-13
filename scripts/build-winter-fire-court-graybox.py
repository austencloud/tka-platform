"""Build the editable Keeper's Hollow fire-court graybox and web review GLB.

Run with:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
    --background --factory-startup --python scripts/build-winter-fire-court-graybox.py

This is an isolated revision source. It never opens or writes the production
Winter environment blend. QA context and cameras stay in Blender; only WF_
meshes are exported for the live review harness.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "scripts" / "winter-fire-court-graybox-r1.json"
BLEND_PATH = ROOT / "blender" / "winter_fire_court_graybox.blend"
GLB_PATH = (
    ROOT
    / "static"
    / "models"
    / "winter"
    / "review"
    / "winter-fire-court-graybox-r1.glb"
)
EVIDENCE_DIR = ROOT / "docs" / "superpowers" / "specs" / "moonlit-winter-hollow" / "evidence" / "fire-court-graybox-r1"
REPORT_PATH = EVIDENCE_DIR / "winter-fire-court-graybox-r1-report.json"

CONTRACT_BYTES = CONTRACT_PATH.read_bytes()
CONTRACT = json.loads(CONTRACT_BYTES)
SOURCE_DIGEST = hashlib.sha256(CONTRACT_BYTES).hexdigest()

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "METERS"
scene["tka_scene_id"] = CONTRACT["sceneId"]
scene["tka_revision_id"] = CONTRACT["revisionId"]
scene["tka_source_digest"] = SOURCE_DIGEST


def collection(name: str) -> bpy.types.Collection:
    item = bpy.data.collections.new(name)
    scene.collection.children.link(item)
    return item


COLLECTIONS = {
    "COURT": collection("WF_01_Fire_Court"),
    "ROUTES": collection("WF_02_Routes"),
    "FRIENDS": collection("WF_03_Ten_Friends"),
    "FURNISHINGS": collection("WF_04_Furnishings"),
    "QA": collection("QA_Context_Not_Exported"),
    "CAMERAS": collection("QA_Cameras_Not_Exported"),
}


def material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0,
) -> bpy.types.Material:
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
            emission_input.default_value = emission
        if strength_input:
            strength_input.default_value = emission_strength
    return item


COURT = material("WF_Mat_FireSafeStone", (0.055, 0.065, 0.075, 1), 0.92)
APRON = material("WF_Mat_AshSafetyApron", (0.12, 0.13, 0.14, 1), 1)
CURB = material("WF_Mat_SnowBankedCurb", (0.46, 0.52, 0.57, 1), 0.88)
PATH = material("WF_Mat_PackedSnowRoute", (0.5, 0.58, 0.66, 1), 0.98)
TIMBER = material("WF_Mat_DarkTimber", (0.16, 0.075, 0.035, 1), 0.82)
PROXY_ACTIVE = material("WF_Mat_ActiveFriend", (0.11, 0.36, 0.54, 1), 0.72)
PROXY_GUEST = material("WF_Mat_GuestFriend", (0.28, 0.18, 0.36, 1), 0.76)
FIRE = material(
    "WF_Mat_SpinnerFire",
    (1, 0.13, 0.01, 1),
    0.25,
    emission=(1, 0.035, 0.002, 1),
    emission_strength=7,
)
LANTERN = material(
    "WF_Mat_EntryLantern",
    (1, 0.34, 0.06, 1),
    0.3,
    emission=(1, 0.1, 0.008, 1),
    emission_strength=4,
)
QA_SNOW = material("QA_Mat_Snow", (0.55, 0.66, 0.76, 1), 0.96)
QA_ICE = material("QA_Mat_FrozenPond", (0.035, 0.17, 0.27, 1), 0.38, 0.15)


def move_to(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    target.objects.link(obj)


def tag(obj: bpy.types.Object, role: str, **extras: object) -> bpy.types.Object:
    obj["tka_role"] = role
    obj["tka_revision_id"] = CONTRACT["revisionId"]
    obj["tka_source_digest"] = SOURCE_DIGEST
    for key, value in extras.items():
        obj[key] = value
    return obj


def add_box(
    name: str,
    center: tuple[float, float, float],
    size: tuple[float, float, float],
    item_material: bpy.types.Material,
    target: bpy.types.Collection,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0,
    role: str = "graybox",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("SoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(item_material)
    move_to(obj, target)
    return tag(obj, role)


def add_cylinder(
    name: str,
    center: tuple[float, float, float],
    radius: float,
    depth: float,
    item_material: bpy.types.Material,
    target: bpy.types.Collection,
    vertices: int = 16,
    role: str = "graybox",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=center
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(item_material)
    move_to(obj, target)
    return tag(obj, role)


def add_sphere(
    name: str,
    center: tuple[float, float, float],
    radius: float,
    item_material: bpy.types.Material,
    target: bpy.types.Collection,
    role: str = "graybox",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(item_material)
    move_to(obj, target)
    return tag(obj, role)


def add_segment(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    width: float,
    depth: float,
    item_material: bpy.types.Material,
    target: bpy.types.Collection,
    role: str,
) -> bpy.types.Object:
    midpoint = tuple((left + right) / 2 for left, right in zip(start, end))
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = math.hypot(dx, dy)
    return add_box(
        name,
        midpoint,
        (length, width, depth),
        item_material,
        target,
        rotation=(0, 0, math.atan2(dy, dx)),
        bevel=min(0.18, width * 0.15),
        role=role,
    )


def add_irregular_ellipse(
    name: str,
    center: tuple[float, float],
    radius_x: float,
    radius_z: float,
    bottom: float,
    top: float,
    item_material: bpy.types.Material,
    target: bpy.types.Collection,
    role: str,
    segments: int = 32,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    for height in (bottom, top):
        for index in range(segments):
            angle = math.tau * index / segments
            ripple = 1 + 0.035 * math.sin(angle * 3 + 0.4) + 0.022 * math.cos(angle * 7)
            x = center[0] + math.cos(angle) * radius_x * ripple
            runtime_z = center[1] + math.sin(angle) * radius_z * ripple
            vertices.append((x, -runtime_z, height))
    faces: list[tuple[int, ...]] = []
    faces.append(tuple(range(segments - 1, -1, -1)))
    faces.append(tuple(range(segments, segments * 2)))
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.append((index, next_index, next_index + segments, index + segments))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(item_material)
    target.objects.link(obj)
    return tag(obj, role)


court = CONTRACT["court"]
court_center = tuple(court["center"])
add_irregular_ellipse(
    "WF_Court_SafetyApron",
    court_center,
    court["radiusX"] + court["safetyBuffer"],
    court["radiusZ"] + court["safetyBuffer"],
    0.015,
    0.055,
    APRON,
    COLLECTIONS["COURT"],
    "fire-safety-apron",
)
add_irregular_ellipse(
    "WF_Court_Surface",
    court_center,
    court["radiusX"],
    court["radiusZ"],
    court["surfaceElevation"] - court["surfaceThickness"],
    court["surfaceElevation"],
    COURT,
    COLLECTIONS["COURT"],
    "fire-court-surface",
)

gap_half = math.radians(court["entryGapDegrees"] / 2)
for index in range(court["curbSegments"]):
    angle = math.tau * index / court["curbSegments"]
    signed = math.atan2(math.sin(angle), math.cos(angle))
    if abs(signed) <= gap_half:
        continue
    radius_x = court["radiusX"] + 0.3
    radius_z = court["radiusZ"] + 0.3
    x = court_center[0] + math.cos(angle) * radius_x
    runtime_z = court_center[1] + math.sin(angle) * radius_z
    add_box(
        f"WF_Court_Curb_{index + 1:02d}",
        (x, -runtime_z, court["surfaceElevation"] + 0.14),
        (1.05, 0.42, 0.28),
        CURB,
        COLLECTIONS["COURT"],
        rotation=(0, 0, -angle + math.pi / 2),
        bevel=0.1,
        role="low-fire-court-curb",
    )

# The review ribbon owns the new arrival line only. The production snow path
# remains in the base GLB until this revision passes visual approval.
for route in CONTRACT["paths"]:
    points = route["points"]
    for index, (start, end) in enumerate(zip(points, points[1:])):
        start_blender = (start[0], -start[1], start[2] + 0.025)
        end_blender = (end[0], -end[1], end[2] + 0.025)
        add_segment(
            f"WF_Route_{route['id']}_{index + 1:02d}",
            start_blender,
            end_blender,
            route["width"],
            0.055,
            PATH,
            COLLECTIONS["ROUTES"],
            "review-route-ribbon",
        )


def add_friend(friend: dict) -> None:
    runtime_x, runtime_z = friend["position"]
    blender_y = -runtime_z
    role = friend["role"]
    seated = role == "seated"
    surface_elevation = friend.get("surfaceElevation", court["surfaceElevation"])
    proxy_lift = surface_elevation - court["surfaceElevation"]
    body_height = 0.82 if seated else 1.12
    body_center = 0.7 if seated else 0.86
    head_height = 1.24 if seated else 1.62
    friend_material = PROXY_ACTIVE if role == "spinner" else PROXY_GUEST
    body = add_cylinder(
        f"WF_Friend_{friend['id']}_Body",
        (runtime_x, blender_y, body_center + proxy_lift),
        0.22,
        body_height,
        friend_material,
        COLLECTIONS["FRIENDS"],
        12,
        "friend-proxy",
    )
    tag(
        body,
        "friend-proxy",
        tka_friend_id=friend["id"],
        tka_friend_role=role,
        tka_facing_degrees=friend["facingDegrees"],
        tka_surface_elevation=surface_elevation,
    )
    add_sphere(
        f"WF_Friend_{friend['id']}_Head",
        (runtime_x, blender_y, head_height + proxy_lift),
        0.21,
        friend_material,
        COLLECTIONS["FRIENDS"],
        "friend-proxy-part",
    )
    if seated:
        add_segment(
            f"WF_Friend_{friend['id']}_Legs",
            (runtime_x, blender_y, 0.58 + proxy_lift),
            (runtime_x + 0.32, blender_y - 0.05, 0.32 + proxy_lift),
            0.13,
            0.13,
            friend_material,
            COLLECTIONS["FRIENDS"],
            "friend-proxy-part",
        )
    if role == "spinner":
        yaw = math.radians(friend["facingDegrees"])
        arm_dx = math.cos(yaw) * 0.78
        arm_dy = -math.sin(yaw) * 0.78
        add_segment(
            f"WF_Friend_{friend['id']}_Arms",
            (runtime_x - arm_dx, blender_y - arm_dy, 1.2),
            (runtime_x + arm_dx, blender_y + arm_dy, 1.2),
            0.12,
            0.12,
            friend_material,
            COLLECTIONS["FRIENDS"],
            "friend-proxy-part",
        )
        for side in (-1, 1):
            flame_x = runtime_x + arm_dx * side
            flame_y = blender_y + arm_dy * side
            add_sphere(
                f"WF_Fire_{friend['id']}_{'L' if side < 0 else 'R'}",
                (flame_x, flame_y, 1.2),
                0.17,
                FIRE,
                COLLECTIONS["FRIENDS"],
                "active-fire-prop",
            )


for friend in CONTRACT["friends"]:
    add_friend(friend)

for index, lantern in enumerate(CONTRACT["furnishings"]["entryLanterns"]):
    x, runtime_z = lantern["position"]
    add_cylinder(
        f"WF_EntryLantern_Post_{index + 1}",
        (x, -runtime_z, 0.72),
        0.08,
        1.44,
        TIMBER,
        COLLECTIONS["FURNISHINGS"],
        10,
        "entry-lantern",
    )
    add_sphere(
        f"WF_EntryLantern_Glow_{index + 1}",
        (x, -runtime_z, 1.48),
        0.2,
        LANTERN,
        COLLECTIONS["FURNISHINGS"],
        "entry-lantern",
    )

for index, lantern in enumerate(CONTRACT["furnishings"]["routeLanterns"]):
    x, runtime_z = lantern["position"]
    surface = lantern["surfaceElevation"]
    add_cylinder(
        f"WF_RouteLantern_Post_{index + 1}",
        (x, -runtime_z, surface + 0.72),
        0.08,
        1.44,
        TIMBER,
        COLLECTIONS["FURNISHINGS"],
        10,
        "route-lantern",
    )
    add_sphere(
        f"WF_RouteLantern_Glow_{index + 1}",
        (x, -runtime_z, surface + 1.48),
        0.2,
        LANTERN,
        COLLECTIONS["FURNISHINGS"],
        "route-lantern",
    )

# QA-only context makes the Blender cameras useful without duplicating the
# production terrain, lodge, or pond into the web export.
add_box("QA_SnowGround", (0, 0, -0.18), (90, 100, 0.3), QA_SNOW, COLLECTIONS["QA"])
pond = CONTRACT["pond"]
add_irregular_ellipse(
    "QA_FrozenPond",
    tuple(pond["center"]),
    pond["radiusX"],
    pond["radiusZ"],
    pond["surfaceElevation"] - 0.12,
    pond["surfaceElevation"],
    QA_ICE,
    COLLECTIONS["QA"],
    "qa-context",
)
lodge = CONTRACT["lodge"]
add_box(
    "QA_ExistingLodge",
    (lodge["center"][0], -lodge["center"][1], lodge["targetPadElevation"] + 2.2),
    (lodge["footprint"][0], lodge["footprint"][1], 4.4),
    TIMBER,
    COLLECTIONS["QA"],
    bevel=0.15,
)


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


CAMERAS: dict[str, bpy.types.Object] = {}
for spec in CONTRACT["cameras"]:
    data = bpy.data.cameras.new(spec["name"])
    camera = bpy.data.objects.new(spec["name"], data)
    position = spec["position"]
    target = spec["target"]
    camera.location = (position[0], -position[2], position[1])
    look_at(camera, (target[0], -target[2], target[1]))
    data.clip_start = 0.05
    data.clip_end = 300
    if "orthographicScale" in spec:
        data.type = "ORTHO"
        data.ortho_scale = spec["orthographicScale"]
    else:
        horizontal_fov = math.radians(spec["horizontalFovDegrees"])
        data.sensor_width = 36
        data.lens = data.sensor_width / (2 * math.tan(horizontal_fov / 2))
    COLLECTIONS["CAMERAS"].objects.link(camera)
    CAMERAS[spec["id"]] = camera

world = bpy.data.worlds.new("WF_MoonlitWorld")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.003, 0.008, 0.025, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.14
scene.world = world

sun_data = bpy.data.lights.new("QA_Moon", "SUN")
sun_data.color = (0.46, 0.64, 1)
sun_data.energy = 1.1
sun = bpy.data.objects.new("QA_Moon", sun_data)
sun.rotation_euler = (math.radians(28), math.radians(-20), math.radians(-35))
COLLECTIONS["QA"].objects.link(sun)

for friend in CONTRACT["friends"]:
    if friend["role"] != "spinner":
        continue
    x, runtime_z = friend["position"]
    light_data = bpy.data.lights.new(f"QA_FireLight_{friend['id']}", "POINT")
    light_data.color = (1, 0.12, 0.015)
    light_data.energy = 700
    light_data.shadow_soft_size = 1.6
    light = bpy.data.objects.new(f"QA_FireLight_{friend['id']}", light_data)
    light.location = (x, -runtime_z, 1.5)
    COLLECTIONS["QA"].objects.link(light)

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "AgX - Medium High Contrast"

render_paths: dict[str, str] = {}
for camera_id, camera in CAMERAS.items():
    scene.camera = camera
    path = EVIDENCE_DIR / f"winter-fire-court-graybox-r1-{camera_id}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    render_paths[camera_id] = str(path.relative_to(ROOT)).replace("\\", "/")

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

export_meshes = [
    obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith("WF_")
]
friend_bodies = [
    obj for obj in export_meshes if obj.name.startswith("WF_Friend_") and obj.name.endswith("_Body")
]
friend_counts: dict[str, int] = {}
for obj in friend_bodies:
    role = obj.get("tka_friend_role", "unknown")
    friend_counts[role] = friend_counts.get(role, 0) + 1

bpy.ops.object.select_all(action="DESELECT")
for obj in export_meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = export_meshes[0]
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_apply=True,
)

report = {
    "sceneId": CONTRACT["sceneId"],
    "revisionId": CONTRACT["revisionId"],
    "sourceDigest": SOURCE_DIGEST,
    "contractPath": str(CONTRACT_PATH.relative_to(ROOT)).replace("\\", "/"),
    "blendPath": str(BLEND_PATH.relative_to(ROOT)).replace("\\", "/"),
    "glbPath": str(GLB_PATH.relative_to(ROOT)).replace("\\", "/"),
    "blenderVersion": bpy.app.version_string,
    "exportMeshCount": len(export_meshes),
    "exportedCameraCount": 0,
    "exportedLightCount": 0,
    "friendCount": len(friend_bodies),
    "friendRoleCounts": friend_counts,
    "courtCenter": court["center"],
    "pondCenter": pond["center"],
    "lodgeCenter": lodge["center"],
    "routeLanternCount": len(CONTRACT["furnishings"]["routeLanterns"]),
    "renders": render_paths,
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

print(f"Verified fire-court source digest: {SOURCE_DIGEST}")
print(f"Built exact friend roles: {friend_counts}")
print(f"Saved editable graybox: {BLEND_PATH}")
print(f"Exported review GLB: {GLB_PATH}")
print(f"Wrote QA report: {REPORT_PATH}")
