"""Export the generated ComposedReef collection as a flora-scene GLB.

The composition can only really be judged by walking around it, and the four
Workbench stills cannot answer that. This exports the generated reef in exactly
the shape the runtime's FloraInstances expects, so `/test/ocean-scene` can load
it beside the authored scene under `?flora=composed` -- same route, same camera
presets, one query param between the two. That is also the head-to-head the
design asks for.

Seabed and Dais are deliberately NOT included, matching
blender-export-ocean-full.py: the terrain ships as ocean-environment.glb and the
stage is the programmatic RuinsPlatform. Including either here would double it.

Run headless:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" \
    --background blender/ocean_composed.blend \
    --python scripts/blender-export-ocean-composition.py

Output: static/models/ocean/ocean_composition_raw.glb
Then:   node scripts/optimize-ocean-glb.mjs \
          static/models/ocean/ocean_composition_raw.glb \
          static/models/ocean/ocean_composed_scene.glb

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import os

import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(
    PROJECT_ROOT, "static", "models", "ocean", "ocean_composition_raw.glb"
)
COMPOSED_COLLECTION = "ComposedReef"


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    composed = bpy.data.collections.get(COMPOSED_COLLECTION)
    if composed is None:
        raise SystemExit(
            f"No {COMPOSED_COLLECTION} collection. Run build-ocean-composition.py first."
        )

    bpy.ops.object.select_all(action="DESELECT")
    selected = 0
    for obj in composed.objects:
        if obj.type != "MESH":
            continue
        # The build hides pre-existing scenery for the render pass; the composed
        # objects themselves must be visible or the exporter drops them.
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
        selected += 1

    if not selected:
        raise SystemExit(f"{COMPOSED_COLLECTION} holds no mesh objects")
    bpy.context.view_layer.objects.active = next(
        o for o in composed.objects if o.type == "MESH"
    )

    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_texture_dir="",
        export_cameras=False,
        export_lights=False,
    )

    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f"Exported {selected} objects -> {OUTPUT_PATH} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
