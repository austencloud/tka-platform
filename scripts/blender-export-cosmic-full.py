"""Export only the authored Astral Reliquary collection to a raw GLB."""

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "static" / "models" / "cosmic" / "cosmic-reliquary_raw.glb"
COLLECTION_NAME = "EXPORT_cosmic_reliquary"


def objects_in(collection: bpy.types.Collection) -> set[bpy.types.Object]:
    result = set(collection.objects)
    for child in collection.children:
        result.update(objects_in(child))
    return result


export_collection = bpy.data.collections.get(COLLECTION_NAME)
if export_collection is None:
    raise RuntimeError(f"Collection not found: {COLLECTION_NAME}")

bpy.ops.object.select_all(action="DESELECT")
selected = []
for obj in objects_in(export_collection):
    if obj.type != "MESH":
        continue
    obj.hide_set(False)
    obj.hide_render = False
    obj.select_set(True)
    selected.append(obj)

if not selected:
    raise RuntimeError(f"No mesh objects in {COLLECTION_NAME}")

bpy.context.view_layer.objects.active = selected[0]
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_texcoords=True,
    export_normals=True,
    export_tangents=True,
    export_cameras=False,
    export_lights=False,
)
print(f"COSMIC_RELIQUARY_RAW={OUTPUT}")
