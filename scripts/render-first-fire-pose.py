"""Render the First Fire shell from a captured in-app view pose.

    blender --background --python scripts/render-first-fire-pose.py \
      -- --source <glb> --out <png> \
         --pose '{"x":-10.833,"y":0.8701,"z":-17.0059,"yaw":0.3841,"pitch":-0.2267}'

The pose is the JSON the in-app capture puts on the clipboard. It records the
PLAYER'S BODY, not the camera: UnifiedCameraController puts the eye at

    camX = x + sin(yaw) * FORWARD_OFFSET
    camY = y + FIRST_PERSON_CAMERA_OFFSET
    camZ = z + cos(yaw) * FORWARD_OFFSET

and aims it with lookAt at

    (sin(yaw)cos(pitch), -sin(pitch), cos(yaw)cos(pitch))

which is NOT the three.js YXZ euler convention - every component's sign is the
other way round. Assuming the textbook convention renders the room from behind
the visitor's head, which looks plausible enough to believe and is 180 degrees
wrong. Read the controller, don't derive it.

App space is Y up; Blender is Z up; the GLB carries the app's convention, so
the conversion is the export's own, inverted:

    blender x =  app x
    blender y = -app z
    blender z =  app y

Rendering the shell alone, lit from the eye, answers one question and no
others: is there rock where the wall should be? A dressed frame with torches
and embers answers it worse.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
# Threlte's default camera, which this route does not override, is
# PerspectiveCamera(75, ...) - and three.js `fov` is the VERTICAL angle.
FOV_DEGREES = 75.0
RESOLUTION = (1367, 1230)   # matches the captured viewport
EYE_OFFSET = 0.75           # camera-3d CAMERA_DEFAULTS.FIRST_PERSON_CAMERA_OFFSET
FORWARD_OFFSET = 0.05       # camera-3d SETTINGS.firstPerson.forwardOffset


def parse_args(argv: list[str]) -> dict:
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    out = {"source": "", "out": "", "pose": "", "samples": 24, "energy": 1400.0}
    for i, token in enumerate(args):
        if token in ("--source", "--out", "--pose") and i + 1 < len(args):
            out[token[2:]] = args[i + 1]
        elif token == "--samples" and i + 1 < len(args):
            out["samples"] = int(args[i + 1])
        elif token == "--energy" and i + 1 < len(args):
            out["energy"] = float(args[i + 1])
    return out


def app_to_blender(point: Vector) -> Vector:
    return Vector((point.x, -point.z, point.y))


def eye_of(pose: dict) -> Vector:
    yaw = pose["yaw"]
    return app_to_blender(Vector((
        pose["x"] + math.sin(yaw) * FORWARD_OFFSET,
        pose["y"] + EYE_OFFSET,
        pose["z"] + math.cos(yaw) * FORWARD_OFFSET,
    )))


def forward_of(pose: dict) -> Vector:
    yaw, pitch = pose["yaw"], pose["pitch"]
    return app_to_blender(Vector((
        math.sin(yaw) * math.cos(pitch),
        -math.sin(pitch),
        math.cos(yaw) * math.cos(pitch),
    ))).normalized()


def main() -> int:
    options = parse_args(sys.argv)
    pose = json.loads(options["pose"])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=options["source"])

    # The shell alone. Flames and guides would sit between the eye and the wall
    # and turn "is the wall there" into "what is that orange thing".
    keep = {"FF_Shell_Rock"}
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and not any(k in obj.name for k in keep):
            bpy.data.objects.remove(obj, do_unlink=True)

    eye = eye_of(pose)
    forward = forward_of(pose)

    camera_data = bpy.data.cameras.new("PoseCamera")
    camera_data.lens_unit = "FOV"
    # VERTICAL, explicitly: with a taller-than-wide frame Blender's AUTO sensor
    # fit would apply the angle to the other axis and quietly change the crop.
    camera_data.sensor_fit = "VERTICAL"
    camera_data.angle_y = math.radians(FOV_DEGREES)
    camera = bpy.data.objects.new("PoseCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = eye
    # Blender cameras look down local -Z with +Y up; to_track_quat maps a
    # direction onto that basis without hand-rolling a rotation matrix.
    camera.rotation_euler = forward.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera

    # A lamp at the eye, so what the frame shows is the geometry in front of the
    # visitor rather than wherever the scene's own lights happen to point. Rock
    # that is missing goes black; rock that is there is lit.
    # Energy is tuned for a wall five to ten metres off. A lamp at the eye falls
    # off as the square of the distance, so an over-bright one blows the near
    # wall to paper and hides exactly the thing being looked for.
    lamp_data = bpy.data.lights.new("PoseLamp", type="POINT")
    lamp_data.energy = options["energy"]
    lamp_data.shadow_soft_size = 1.5
    lamp = bpy.data.objects.new("PoseLamp", lamp_data)
    bpy.context.scene.collection.objects.link(lamp)
    lamp.location = eye + forward * 0.4

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = options["samples"]
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("PoseWorld")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)

    out = Path(options["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(out)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print(f"###POSE### eye={[round(v, 3) for v in eye]} "
          f"forward={[round(v, 3) for v in forward]} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
