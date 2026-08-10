"""Render the composed reef from the scene's own camera presets.

The composition matrix is a visual claim, and a JSON summary cannot check it.
This renders the same framings the runtime harness uses on /test/ocean-scene so
the generated reef can be judged before the export/optimize/R2 trip.

Workbench, not Cycles: this is a composition check -- masses, silhouettes,
sightlines -- not a lighting check. Cycles would cost minutes per frame and
answer a question nobody asked yet.

Run:
  blender --background blender/ocean_composed.blend \
    --python scripts/render-ocean-composition.py

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUTPUT_DIR = os.path.join(REPO, "docs", "superpowers", "specs", "active", "ocean-composition")

sys.path.append(HERE)
from ocean_terrain_profile import ocean_floor_height  # noqa: E402

# Runtime presets from src/routes/test/ocean-scene/+page.svelte, converted from
# the runtime frame (y up, -z upstage) to Blender's (z up, +y upstage), and
# lifted by the seabed datum: the harness puts the seabed at y = -1.5, so a
# runtime y of 4.5 is 6.0 above the Blender seabed top.
SEABED_OFFSET = 1.5
VIEWS = {
    "hero": ((0, -19, 4.5), (0, 2, 1.6), 46),
    "reef": ((-11, -12, 3.6), (4, 6, 1.8), 48),
    "world": ((0, -30, 26), (0, 0, 0), 52),
    "reverse": ((0, 21, 5.5), (0, 0, 1.6), 48),
}
RESOLUTION = (1280, 720)


def look_at(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    scene = bpy.context.scene

    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "SINGLE"
    shading.single_color = (0.42, 0.55, 0.62)
    shading.show_shadows = True
    shading.show_cavity = True
    scene.world.color = (0.03, 0.09, 0.14) if scene.world else None

    camera_data = bpy.data.cameras.new("CompositionCamera")
    camera = bpy.data.objects.new("CompositionCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    for name, (position, target, fov) in VIEWS.items():
        camera.location = Vector(
            (position[0], position[1], position[2] + SEABED_OFFSET)
        )
        camera_data.lens_unit = "FOV"
        camera_data.angle = math.radians(fov)
        look_at(camera, (target[0], target[1], target[2] + SEABED_OFFSET))
        scene.render.filepath = os.path.join(OUTPUT_DIR, f"composition-{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {scene.render.filepath}")


if __name__ == "__main__":
    main()
