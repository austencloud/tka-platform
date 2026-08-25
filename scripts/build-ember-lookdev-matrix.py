"""Build editable look-development scenes for Ember's Broken Rift Gate.

The geometry comes from the approved spatial graybox. Each treatment receives
its own duplicated collection, procedural material set, world, lights, cameras,
and Blender scene so the looks remain independently editable.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE_BLEND = ROOT / "blender/ember-spatial-directions-r1.blend"
OUTPUT_BLEND = ROOT / "blender/ember-broken-rift-lookdev-r2.blend"
SPEC_DIR = ROOT / "docs/superpowers/specs/ember-spatial-directions"
EVIDENCE_DIR = SPEC_DIR / "evidence/lookdev-r2"
REPORT_PATH = EVIDENCE_DIR / "ember-lookdev-r2-report.json"

EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)

if not SOURCE_BLEND.exists():
    raise FileNotFoundError(f"Missing spatial graybox: {SOURCE_BLEND}")

bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))

SOURCE_COLLECTION = next(
    collection
    for collection in bpy.data.collections
    if collection.name == "OPTION_E-BROKEN-RIFT-GATE"
)

CAMERA_SOURCES = {
    "hero": bpy.data.objects["CAM_EmberSharedHero"],
    "oblique": bpy.data.objects["CAM_EmberSharedOblique"],
    "reverse": bpy.data.objects["CAM_EmberSharedReverse"],
    "plan": bpy.data.objects["CAM_EmberSharedPlan"],
}


LOOKS = {
    "blackglass-blue-hour": {
        "label": "Blackglass Blue Hour",
        "palette": {
            "basaltDark": "#07101a",
            "basaltLight": "#30485a",
            "mineral": "#527087",
            "obsidianDark": "#020812",
            "obsidianLight": "#163047",
            "ashDark": "#171a20",
            "ashLight": "#454b52",
            "lava": "#ff5a1f",
            "lavaHot": "#ffb15a",
            "lavaDim": "#3b0c05",
            "world": "#010713",
            "key": "#78a7ff",
            "fill": "#243d70",
            "rim": "#ff5d20",
        },
        "worldStrength": 0.24,
        "exposure": 0.72,
        "keyEnergy": 5200,
        "fillEnergy": 2700,
        "rimEnergy": 2300,
        "lavaEnergy": 1050,
    },
    "blackglass-mineral-rift": {
        "label": "Blackglass Mineral Rift",
        "palette": {
            "basaltDark": "#060d15",
            "basaltLight": "#2b4352",
            "mineral": "#746a43",
            "obsidianDark": "#02060b",
            "obsidianLight": "#142b3b",
            "ashDark": "#15181b",
            "ashLight": "#4a4b46",
            "lava": "#ff5418",
            "lavaHot": "#ffc26a",
            "lavaDim": "#080403",
            "world": "#01050d",
            "key": "#799fff",
            "fill": "#294363",
            "rim": "#ff541d",
        },
        "worldStrength": 0.22,
        "exposure": 0.64,
        "keyEnergy": 5000,
        "fillEnergy": 2550,
        "rimEnergy": 2200,
        "lavaEnergy": 900,
        "obsidianRoughness": 0.34,
        "obsidianMetallic": 0.38,
        "lavaField": {
            "scale": 5.2,
            "interpolation": "CONSTANT",
            "dimPosition": 0.0,
            "lavaPosition": 0.63,
            "hotPosition": 0.79,
            "emissionStrength": 0.34,
        },
    },
    "ash-eclipse": {
        "label": "Ash Eclipse",
        "palette": {
            "basaltDark": "#211b1a",
            "basaltLight": "#6b574d",
            "mineral": "#9a8170",
            "obsidianDark": "#120d0e",
            "obsidianLight": "#392226",
            "ashDark": "#49413e",
            "ashLight": "#81736c",
            "lava": "#ff6815",
            "lavaHot": "#ffc06a",
            "lavaDim": "#4c1408",
            "world": "#160503",
            "key": "#d4c2b6",
            "fill": "#7b4939",
            "rim": "#ff5418",
        },
        "worldStrength": 0.32,
        "exposure": 0.46,
        "keyEnergy": 4200,
        "fillEnergy": 2800,
        "rimEnergy": 3000,
        "lavaEnergy": 1250,
    },
    "sulfur-furnace": {
        "label": "Sulfur Furnace",
        "palette": {
            "basaltDark": "#171912",
            "basaltLight": "#555843",
            "mineral": "#a49545",
            "obsidianDark": "#0a0d09",
            "obsidianLight": "#29342b",
            "ashDark": "#424234",
            "ashLight": "#78745a",
            "lava": "#ff8f12",
            "lavaHot": "#ffe08a",
            "lavaDim": "#5a2d05",
            "world": "#050804",
            "key": "#d8e1b0",
            "fill": "#65704a",
            "rim": "#ff9b1a",
        },
        "worldStrength": 0.28,
        "exposure": 0.54,
        "keyEnergy": 4800,
        "fillEnergy": 2500,
        "rimEnergy": 2600,
        "lavaEnergy": 1150,
    },
    "ironstorm": {
        "label": "Ironstorm",
        "palette": {
            "basaltDark": "#18080d",
            "basaltLight": "#63303d",
            "mineral": "#914a51",
            "obsidianDark": "#08050d",
            "obsidianLight": "#2b1838",
            "ashDark": "#2b1720",
            "ashLight": "#5c3040",
            "lava": "#ff2f0b",
            "lavaHot": "#ff9a5a",
            "lavaDim": "#520308",
            "world": "#05020b",
            "key": "#9989ff",
            "fill": "#3f2a7d",
            "rim": "#ff2408",
        },
        "worldStrength": 0.25,
        "exposure": 0.68,
        "keyEnergy": 5400,
        "fillEnergy": 2500,
        "rimEnergy": 3300,
        "lavaEnergy": 1350,
    },
}


def hex_color(value: str) -> tuple[float, float, float, float]:
    value = value.lstrip("#")
    srgb = [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]

    def linear(channel: float) -> float:
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4

    return (*[linear(channel) for channel in srgb], 1.0)


def clear_nodes(material: bpy.types.Material) -> tuple[bpy.types.NodeTree, bpy.types.Node, bpy.types.Node]:
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (620, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (340, 0)
    material.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material.node_tree, bsdf, output


def rock_material(
    name: str,
    dark: str,
    light: str,
    roughness: float,
    scale: float,
    bump_strength: float,
    metallic: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    tree, bsdf, _ = clear_nodes(material)
    nodes = tree.nodes
    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-650, 20)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-440, 50)
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.72
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-180, 100)
    ramp.color_ramp.elements[0].position = 0.24
    ramp.color_ramp.elements[0].color = hex_color(dark)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = hex_color(light)
    bump = nodes.new("ShaderNodeBump")
    bump.location = (90, -160)
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.28
    tree.links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def lava_field_material(
    name: str,
    dim: str,
    lava: str,
    hot: str,
    settings: dict | None = None,
) -> bpy.types.Material:
    settings = settings or {}
    material = bpy.data.materials.new(name)
    tree, bsdf, _ = clear_nodes(material)
    nodes = tree.nodes
    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-690, 20)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-480, 20)
    noise.inputs["Scale"].default_value = settings.get("scale", 3.4)
    noise.inputs["Detail"].default_value = 7.0
    noise.inputs["Roughness"].default_value = 0.76
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-180, 60)
    ramp.color_ramp.interpolation = settings.get("interpolation", "EASE")
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    first = ramp.color_ramp.elements[0]
    first.position = settings.get("dimPosition", 0.28)
    first.color = hex_color(dim)
    middle = ramp.color_ramp.elements.new(settings.get("lavaPosition", 0.58))
    middle.color = hex_color(lava)
    final = ramp.color_ramp.elements.new(settings.get("hotPosition", 0.78))
    final.color = hex_color(hot)
    bump = nodes.new("ShaderNodeBump")
    bump.location = (70, -180)
    bump.inputs["Strength"].default_value = 0.34
    bump.inputs["Distance"].default_value = 0.16
    tree.links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Emission Strength"].default_value = settings.get("emissionStrength", 0.62)
    bsdf.inputs["Roughness"].default_value = 0.54
    return material


def emission_material(name: str, color: str, hot: str, strength: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    tree, bsdf, _ = clear_nodes(material)
    bsdf.inputs["Base Color"].default_value = hex_color(color)
    bsdf.inputs["Emission Color"].default_value = hex_color(hot)
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Roughness"].default_value = 0.35
    return material


def performer_material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    _, bsdf, _ = clear_nodes(material)
    bsdf.inputs["Base Color"].default_value = hex_color("#d8f2ff")
    bsdf.inputs["Emission Color"].default_value = hex_color("#5ebfff")
    bsdf.inputs["Emission Strength"].default_value = 0.8
    bsdf.inputs["Roughness"].default_value = 0.32
    return material


def build_materials(look_id: str, look: dict) -> dict[str, bpy.types.Material]:
    palette = look["palette"]
    prefix = f"LD_{look_id.replace('-', '_')}"
    return {
        "GB_Basalt": rock_material(
            f"{prefix}_Basalt",
            palette["basaltDark"],
            palette["basaltLight"],
            0.84,
            2.6,
            0.42,
        ),
        "GB_Basalt_Light": rock_material(
            f"{prefix}_MineralBasalt",
            palette["basaltLight"],
            palette["mineral"],
            0.8,
            3.1,
            0.38,
        ),
        "GB_Basalt_Dark": rock_material(
            f"{prefix}_DarkBasalt",
            palette["basaltDark"],
            palette["obsidianDark"],
            0.9,
            2.2,
            0.46,
        ),
        "GB_Obsidian": rock_material(
            f"{prefix}_Obsidian",
            palette["obsidianDark"],
            palette["obsidianLight"],
            look.get("obsidianRoughness", 0.22),
            7.5,
            0.16,
            look.get("obsidianMetallic", 0.56),
        ),
        "GB_Ash": rock_material(
            f"{prefix}_Ash",
            palette["ashDark"],
            palette["ashLight"],
            0.96,
            5.0,
            0.25,
        ),
        "GB_Lava": emission_material(
            f"{prefix}_LiveLava",
            palette["lava"],
            palette["lavaHot"],
            4.2,
        ),
        "GB_Lava_Dim": lava_field_material(
            f"{prefix}_CoolingLavaField",
            palette["lavaDim"],
            palette["lava"],
            palette["lavaHot"],
            look.get("lavaField"),
        ),
        "GB_Performer": performer_material(f"{prefix}_Performer"),
    }


def duplicate_source_collection(
    look_id: str,
    material_map: dict[str, bpy.types.Material],
) -> bpy.types.Collection:
    collection = bpy.data.collections.new(f"LOOK_{look_id.upper()}")
    prefix = f"LD_{look_id.replace('-', '_')}"
    for source in SOURCE_COLLECTION.all_objects:
        if source.type not in {"MESH", "CURVE"}:
            continue
        duplicate = source.copy()
        duplicate.data = source.data.copy()
        duplicate.name = f"{prefix}_{source.name}"
        if hasattr(duplicate.data, "materials"):
            for index, source_material in enumerate(list(duplicate.data.materials)):
                if source_material is None:
                    continue
                base_name = source_material.name.split(".")[0]
                replacement = material_map.get(base_name)
                if replacement is not None:
                    duplicate.data.materials[index] = replacement
        collection.objects.link(duplicate)
    return collection


def configure_scene(scene: bpy.types.Scene, look: dict) -> None:
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 35
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = look["exposure"]


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    scene: bpy.types.Scene,
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    energy: float,
    size: float,
    color: str,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.color = hex_color(color)[:3]
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    look_at(obj, target)
    scene.collection.objects.link(obj)
    return obj


def add_point_light(
    scene: bpy.types.Scene,
    name: str,
    location: tuple[float, float, float],
    energy: float,
    radius: float,
    color: str,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.color = hex_color(color)[:3]
    data.energy = energy
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    scene.collection.objects.link(obj)
    return obj


def create_world(look_id: str, look: dict) -> bpy.types.World:
    world = bpy.data.worlds.new(f"WORLD_{look_id.upper()}")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = hex_color(look["palette"]["world"])
    background.inputs["Strength"].default_value = look["worldStrength"]
    return world


def copy_cameras(scene: bpy.types.Scene, look_id: str) -> dict[str, bpy.types.Object]:
    cameras: dict[str, bpy.types.Object] = {}
    for camera_id, source in CAMERA_SOURCES.items():
        camera = source.copy()
        camera.data = source.data.copy()
        camera.name = f"CAM_{look_id}_{camera_id}"
        scene.collection.objects.link(camera)
        cameras[camera_id] = camera
    return cameras


look_scenes: dict[str, bpy.types.Scene] = {}
render_paths: dict[str, dict[str, str]] = {}
object_counts: dict[str, int] = {}

for look_id, look in LOOKS.items():
    materials = build_materials(look_id, look)
    collection = duplicate_source_collection(look_id, materials)
    scene_variant = bpy.data.scenes.new(f"Ember | {look['label']}")
    configure_scene(scene_variant, look)
    scene_variant.collection.children.link(collection)
    scene_variant.world = create_world(look_id, look)
    cameras = copy_cameras(scene_variant, look_id)

    palette = look["palette"]
    add_area_light(
        scene_variant,
        f"LIGHT_{look_id}_Key",
        (-12, -12, 23),
        (0, 2, 0),
        look["keyEnergy"],
        10,
        palette["key"],
    )
    add_area_light(
        scene_variant,
        f"LIGHT_{look_id}_Fill",
        (14, -3, 12),
        (0, 2, 1),
        look["fillEnergy"],
        9,
        palette["fill"],
    )
    add_area_light(
        scene_variant,
        f"LIGHT_{look_id}_Rim",
        (0, 18, 12),
        (0, 3, 1),
        look["rimEnergy"],
        9,
        palette["rim"],
    )
    add_point_light(
        scene_variant,
        f"LIGHT_{look_id}_LavaNear",
        (1.5, -4.0, 0.0),
        look["lavaEnergy"],
        5.5,
        palette["lava"],
    )
    add_point_light(
        scene_variant,
        f"LIGHT_{look_id}_LavaGate",
        (1.5, 13.0, 2.5),
        look["lavaEnergy"] * 0.72,
        6.5,
        palette["lava"],
    )

    render_paths[look_id] = {}
    for camera_id, camera in cameras.items():
        scene_variant.camera = camera
        path = EVIDENCE_DIR / f"{look_id}-{camera_id}.png"
        scene_variant.render.filepath = str(path)
        bpy.context.window.scene = scene_variant
        bpy.ops.render.render(write_still=True)
        render_paths[look_id][camera_id] = str(path.relative_to(ROOT)).replace("\\", "/")

    look_scenes[look_id] = scene_variant
    object_counts[look_id] = len(collection.all_objects)


# Open on the first look when the file is inspected. The other looks are
# complete Blender scenes in the scene selector, not hidden snapshots.
bpy.context.window.scene = look_scenes["blackglass-mineral-rift"]
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))

report = {
    "revision": "lookdev-r2",
    "selection": {
        "lookId": "blackglass-mineral-rift",
        "scope": "palette-and-material-system",
        "locked": [
            "hot-cold contrast hierarchy",
            "mostly cooled surrounding field",
            "rough blackglass response",
            "sparse mineral ochre accents",
        ],
        "replaceable": [
            "proxy boulders",
            "gate fragment meshes",
            "shelf silhouette",
            "procedural texture noise",
            "exact light placements",
        ],
    },
    "sourceBlend": str(SOURCE_BLEND.relative_to(ROOT)).replace("\\", "/"),
    "outputBlend": str(OUTPUT_BLEND.relative_to(ROOT)).replace("\\", "/"),
    "blenderVersion": bpy.app.version_string,
    "sharedGeometryCollection": SOURCE_COLLECTION.name,
    "sharedCameras": {
        camera_id: {
            "position": [round(value, 3) for value in source.location],
            "type": source.data.type,
            "lensMm": None if source.data.type == "ORTHO" else source.data.lens,
            "orthoScale": source.data.ortho_scale if source.data.type == "ORTHO" else None,
        }
        for camera_id, source in CAMERA_SOURCES.items()
    },
    "looks": {
        look_id: {
            "label": look["label"],
            "scene": look_scenes[look_id].name,
            "objectCount": object_counts[look_id],
            "palette": look["palette"],
            "worldStrength": look["worldStrength"],
            "exposure": look["exposure"],
            "renders": render_paths[look_id],
        }
        for look_id, look in LOOKS.items()
    },
}
REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

print(f"Built {len(LOOKS)} editable Broken Rift Gate look scenes")
print(f"Rendered {len(LOOKS) * len(CAMERA_SOURCES)} comparison frames")
print(f"Saved look-development Blender file: {OUTPUT_BLEND}")
print(f"Wrote look-development report: {REPORT_PATH}")
