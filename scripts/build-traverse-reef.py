"""Instantiate the trench gallery into a blend and export it as one GLB.

Reads scripts/water-traverse-reef.json and builds it into a fresh file, then
writes static/models/water-traverse/trench-reef_raw.glb for
scripts/optimize-traverse-reef.mjs to compress.

Baked rather than instanced at runtime because static set dressing is authored
in Blender here (.claude/rules/blender-first-3d-scenes.md). The runtime cost
argues the same way: the individual source GLBs total ~120 MB unoptimised, and
513 of them streamed separately is 37 fetches and 37 decode stalls during a
walk. One optimised GLB with linked mesh data is 37 unique meshes however many
times they appear.

Coordinate conversion, which is the part that silently ruins everything if it
is wrong: the composition is in the RUNTIME frame (Y up, +z along the walk).
Blender is Z up, and its glTF exporter maps Blender (X, Y, Z) to glTF
(X, Z, -Y). So a runtime position (x, y, z) is authored at Blender
(x, -z, y) and comes back out of the exporter unchanged.

Run:
  blender --background --factory-startup \
    --python scripts/build-traverse-reef.py

Design: docs/superpowers/specs/active/2026-08-09-trench-gallery-composition-design.md
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
COMPOSITION_PATH = os.path.join(HERE, "water-traverse-reef.json")
# Blender's glTF importer refuses EXT_meshopt_compression, which several of the
# source assets ship with, so they are round-tripped through gltf-transform into
# a flat scratch directory first (scripts/prepare-traverse-reef-sources.mjs).
SOURCE_CACHE = os.path.join(REPO, ".cache", "traverse-reef-src")
OUTPUT_DIR = os.path.join(REPO, "static", "models", "water-traverse")
OUTPUT_GLB = os.path.join(OUTPUT_DIR, "trench-reef_raw.glb")

SOURCES_COLLECTION = "TrenchSources"
COMPOSED_COLLECTION = "TrenchGallery"
SOURCE_PREFIX = "src_"


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_source(asset_id, rel_path, sources):
    """Import one GLB, join it, and normalise it to 1-unit maximum extent.

    Normalising here matches what the runtime does at import and is what makes
    `sizeMetres` mean metres: the placement scale is then literally the world
    size of the asset's longest axis.
    """
    path = os.path.join(SOURCE_CACHE, rel_path.replace("/", "_"))
    if not os.path.exists(path):
        print(f"  MISSING {rel_path}")
        return None

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    fresh = list(set(bpy.data.objects) - before)
    imported = [o for o in fresh if o.type == "MESH"]
    if not imported:
        print(f"  NO MESH {rel_path}")
        return None

    # Bake every asset down to STATIC geometry before it is instanced.
    #
    # Several of the kelp assets are skinned, and a single armature anywhere in
    # the file makes the whole glTF "animated", which gltf-transform's instance
    # pass refuses outright ("Instancing is not currently supported for animated
    # models"). Losing instancing turned 513 linked duplicates into 18.3 M
    # unique vertices and a 171 MB build. The armatures also carried their own
    # object transforms, which is what pushed the scene bounding box out to 338
    # units when nothing in the composition is placed past 175.
    #
    # Nothing is lost: kelp movement here is a shader, not a skeleton.
    for obj in imported:
        obj.modifiers.clear()
        obj.animation_data_clear()
        if obj.parent is not None:
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world
        if obj.data.shape_keys is not None:
            obj.shape_key_clear()
    for obj in fresh:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in imported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = imported[0]
    if len(imported) > 1:
        bpy.ops.object.join()
    source = bpy.context.view_layer.objects.active

    # Drop any transform the GLB carried in, then measure and normalise.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    dims = source.dimensions
    extent = max(dims.x, dims.y, dims.z)
    if extent > 0:
        source.scale = Vector((1.0 / extent,) * 3)
        bpy.ops.object.transform_apply(scale=True)

    # Origin to the base centre so a placement's y is where the asset SITS,
    # not where its bounding box happens to be centred.
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    low = min((source.matrix_world @ Vector(c)).z for c in source.bound_box)
    source.location.z -= low
    bpy.ops.object.transform_apply(location=True)

    source.name = SOURCE_PREFIX + asset_id.replace("/", "_")
    for coll in list(source.users_collection):
        coll.objects.unlink(source)
    sources.objects.link(source)
    source.hide_render = True
    return source


def main():
    clear_scene()

    with open(COMPOSITION_PATH, "r", encoding="utf-8") as handle:
        composition = json.load(handle)
    placements = composition["placements"]

    sources = bpy.data.collections.new(SOURCES_COLLECTION)
    composed = bpy.data.collections.new(COMPOSED_COLLECTION)
    bpy.context.scene.collection.children.link(sources)
    bpy.context.scene.collection.children.link(composed)

    wanted = {}
    for entry in placements:
        wanted[entry["asset"]] = entry["path"]

    print(f"importing {len(wanted)} distinct assets")
    source_by_asset = {}
    for asset_id, rel_path in sorted(wanted.items()):
        source = import_source(asset_id, rel_path, sources)
        if source is not None:
            source_by_asset[asset_id] = source

    print(f"instantiating {len(placements)} placements")
    built = 0
    for index, entry in enumerate(placements):
        source = source_by_asset.get(entry["asset"])
        if source is None:
            continue
        # Linked duplicate: shares mesh data, so 513 objects cost 37 meshes.
        instance = source.copy()
        composed.objects.link(instance)

        x, y, z = entry["position"]
        instance.location = Vector((x, -z, y))

        size = entry["sizeMetres"]
        instance.scale = Vector((size, size, size))

        tilt_x, tilt_y = entry["tiltDegrees"]
        instance.rotation_euler = (
            math.radians(tilt_x),
            math.radians(tilt_y),
            math.radians(entry["yawDegrees"]),
        )
        instance.name = f"{entry['role']}_{entry['asset'].replace('/', '_')}_{index:03d}"
        instance.hide_render = False
        built += 1

    # Sources must not ship. They are hidden, unlinked from the export
    # selection, and the exporter is pointed at the composed collection only.
    for obj in sources.objects:
        obj.hide_set(True)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in composed.objects:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format="GLB",
        use_selection=True,
        # export_apply evaluates every object to its own mesh, which throws
        # away the linked-duplicate sharing this whole build is arranged
        # around: with it on, 510 instances exported as 510 unique meshes and
        # a 494 MB file. There are no modifiers to apply, so it is pure cost.
        export_apply=False,
        # Emit EXT_mesh_gpu_instancing for the repeated meshes, so the runtime
        # draws a thicket of staghorn in one call rather than nine.
        export_gpu_instances=True,
        export_yup=True,
    )

    size_mb = os.path.getsize(OUTPUT_GLB) / (1024 * 1024)
    print(f"built {built} instances from {len(source_by_asset)} sources")
    print(f"wrote {os.path.relpath(OUTPUT_GLB, REPO)} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
