"""Instantiate the generated composition into the ocean blend.

Reads scripts/ocean-composition.json and builds it as a NEW collection,
"ComposedReef", leaving the existing hand-authored objects untouched. That is
deliberate: the composition system has to be compared against what is there
before it replaces it, and a teardown-first build cannot tell a bad index from
a bad seed.

Each distinct GLB is imported once into a hidden "OceanSources" collection,
normalised to 1-unit maximum extent -- matching what the runtime does at import
-- and then linked-duplicated per placement. Linked duplicates share mesh data,
so 217 objects cost 39 meshes.

Run:
  blender --background blender/ocean_scene.blend \
    --python scripts/build-ocean-composition.py -- --save

  # or, to start from an empty file:
  blender --background --factory-startup \
    --python scripts/build-ocean-composition.py -- --save-as blender/ocean_composed.blend

Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md
"""

import json
import os
import sys

import bpy
from mathutils import Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
COMPOSITION_PATH = os.path.join(HERE, "ocean-composition.json")
MODELS_ROOT = os.path.join(REPO, "static", "models", "ocean")
# Blender's glTF importer cannot read EXT_meshopt_compression or Draco, and
# most optimized ocean assets carry one. prepare-ocean-sources.mjs writes
# decoded copies here, flattening "meshy/kelp.glb" to "meshy__kelp.glb".
SOURCES_ROOT = os.path.join(MODELS_ROOT, ".sources")

SOURCES_COLLECTION = "OceanSources"
COMPOSED_COLLECTION = "ComposedReef"
# reground-ocean-placements.py already skips this prefix, so sources are
# invisible to the existing passes by construction.
SOURCE_PREFIX = "src_"


def argv_after_double_dash():
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def get_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def clear_collection(collection):
    """Remove previously composed objects so re-running is idempotent."""
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def world_max_extent(objects):
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                lo[axis] = min(lo[axis], point[axis])
                hi[axis] = max(hi[axis], point[axis])
    return max(hi[axis] - lo[axis] for axis in range(3))


def import_source(asset_id, relative_path, sources):
    """Import one GLB, join it, normalise it to unit extent, return the object."""
    name = SOURCE_PREFIX + asset_id.replace("/", "_")
    existing = bpy.data.objects.get(name)
    if existing is not None:
        return existing

    path = os.path.join(SOURCES_ROOT, relative_path.replace("/", "__"))
    if not os.path.exists(path):
        raise RuntimeError(
            f"Missing decoded source for {asset_id}: {path}\n"
            f"Run: node scripts/prepare-ocean-sources.mjs"
        )

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{asset_id} imported no mesh objects")

    # The glTF importer parents meshes to empties that carry the Y-up -> Z-up
    # conversion and the file's own node transforms. Detach first, KEEPING the
    # world transform: removing a parent later silently drops it, which is how
    # kelp_plant ended up 2x its neighbours and sea_grass 44 m off origin.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    for empty in [o for o in imported if o.type != "MESH"]:
        bpy.data.objects.remove(empty, do_unlink=True)

    # Bake every transform down so the normalisation below measures real geometry.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    source = bpy.context.view_layer.objects.active

    # Runtime normalises every model to 1-unit max extent, and the facts index
    # (baseOffset, footprintRadius, sizeMetres) is expressed against that. The
    # source must match or every scale in the composition is wrong.
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    # Some GLBs reuse one mesh across several nodes, which join() keeps shared.
    # transform_apply refuses multi-user data and only warns, so without this the
    # normalisation is silently skipped -- that is how kelp_plant stayed at 2 m.
    bpy.ops.object.make_single_user(object=True, obdata=True)
    # bound_box is stale until the depsgraph catches up with the apply above.
    bpy.context.view_layer.update()

    extent = world_max_extent([source])
    if extent > 1e-9:
        source.scale = (1.0 / extent,) * 3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.view_layer.update()
    final = world_max_extent([source])
    if abs(final - 1.0) > 1e-3:
        raise RuntimeError(f"{asset_id} normalised to {final:.4f}, expected 1.0")

    # Origin stays at the GLB's own origin -- the facts index expresses
    # baseOffset against exactly that, so moving it would unseat every placement.
    source.name = name

    for collection in list(source.users_collection):
        collection.objects.unlink(source)
    sources.objects.link(source)
    return source


def main():
    args = argv_after_double_dash()

    with open(COMPOSITION_PATH, "r", encoding="utf-8") as handle:
        composition = json.load(handle)
    placements = composition["placements"]

    sources = get_collection(SOURCES_COLLECTION)
    composed = get_collection(COMPOSED_COLLECTION)
    clear_collection(composed)

    source_objects = {}
    for placement in placements:
        asset_id = placement["asset"]
        if asset_id not in source_objects:
            source_objects[asset_id] = import_source(asset_id, placement["path"], sources)

    for index, placement in enumerate(placements):
        source = source_objects[placement["asset"]]
        obj = bpy.data.objects.new(
            f"Composed_{placement['silhouette']}_{index:03d}", source.data
        )
        obj.location = Vector(placement["position"])
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = Quaternion(placement["rotation"]).normalized()
        obj.scale = (placement["scale"],) * 3
        composed.objects.link(obj)

    # Sources are scaffolding, not scenery. Hidden here and skipped by the
    # export scripts' src_ prefix so they can never reach a GLB.
    sources.hide_viewport = True
    sources.hide_render = True

    print(f"Composed {len(placements)} objects from {len(source_objects)} source meshes")

    if "--hide-existing" in args:
        # Judging the generated reef means seeing it alone on the real ground.
        # The terrain and the dais stay: one is what everything is seated on,
        # the other is the thing the composition is staged around.
        kept = 0
        hidden = 0
        for obj in bpy.data.objects:
            if obj.type != "MESH" or obj.name in composed.objects:
                continue
            if obj.name == "Seabed" or obj.name.startswith("Dais_"):
                kept += 1
                continue
            obj.hide_render = True
            obj.hide_viewport = True
            hidden += 1
        print(f"Hid {hidden} pre-existing meshes, kept {kept} (Seabed + Dais)")

    if "--save" in args:
        bpy.ops.wm.save_mainfile()
        print(f"Saved {bpy.data.filepath}")
    elif "--save-as" in args:
        target = args[args.index("--save-as") + 1]
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REPO, target))
        print(f"Saved {target}")


if __name__ == "__main__":
    main()
