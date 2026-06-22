"""
Export exact placement data from ocean_scene.blend → placements.ts format.
Each mesh object becomes a placement entry with its world-space transform.

Run headless:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/blender-export-placements.py

Outputs: scripts/ocean-blender-placements.json
"""
import bpy
import json
import os
import math
import mathutils

output_path = os.path.join(os.path.dirname(__file__), "ocean-blender-placements.json")

# Map Blender object name prefixes → WebGL objectKey
# Blender uses Z-up; WebGL uses Y-up. We swap Y↔Z.
NAME_MAP = {
    "Staghorn": "meshy-staghorn-coral",
    "Brain_Coral": "meshy-brain-coral",
    "Fan_Coral": "meshy-fan-coral",
    "Table_Coral": "meshy-table-coral",
    "Kelp_Plant": "kelp-plant",
    "Tall_Kelp": "meshy-tall-kelp",
    "Sea_Grass": "meshy-sea-grass",
    "Starfish": "starfish",
    "src_Sea_Urchin": "sea-urchin",
    "Sea_Urchin": "sea-urchin",
    "Shell": "shell",
    "src_Anemone": "anemone",
    "Anemone": "anemone",
    "Basalt_Pinnacle": "meshy-basalt-pinnacle",
    "Basalt_Columns": "meshy-basalt-pinnacle",
    "Living_Rock": "meshy-coral-encrusted-rock",
    "Coral_Mountain": "meshy-coral-mountain",
    "Neon_Summit": "meshy-neon-coral-summit",
    "Coral_Citadel": "meshy-submerged-coral-citadel",
    "Sunlit_Arch": "meshy-sunlit-coral-arch",
    "Underwater_Arch": "meshy-underwater-coral-arch",
    "Rock_Table": "meshy-underwater-rock-table",
    "PR_Coral_0": "meshy-photorealistic-coral-0",
    "PR_Coral_1": "meshy-photorealistic-coral-1",
    "PR_Coral_2": "meshy-photorealistic-coral-2",
    "PR_Coral_3": "meshy-photorealistic-coral-3",
    "Coral_Arch": "struct-coral-arch",
    "Coral_Bommie": "struct-coral-bommie",
    "Coral_Tower": "struct-coral-tower",
    "Reef_Wall": "struct-reef-wall",
    "PH_boulder_01": "ph-boulder-01",
    "PH_rock_07": "ph-rock-07",
    "PH_stone_01": "ph-stone-01",
    "PH_sand_rocks": "ph-sand-rocks",
    "PH_coast_rocks_05": "ph-coast-rocks-05",
    "Volcanic_Rock": "rock-0",  # Map volcanic rocks to available rock models
}

# Objects to skip (not flora/structure)
SKIP_PREFIXES = [
    "Stage_", "Seabed", "Water", "Torch", "Light", "Camera", "Plane",
    "Performer", "Grid", "Circle", "Cube", "Sphere", "Empty", "Armature",
]


def match_object_key(name):
    """Match a Blender object name to a WebGL objectKey."""
    for prefix, key in NAME_MAP.items():
        if name.startswith(prefix):
            return key
    return None


def blender_to_webgl_position(loc):
    """Convert Blender Z-up to WebGL Y-up: (X, Y, Z) → (X, Z, -Y)"""
    return [round(loc[0], 4), round(loc[2], 4), round(-loc[1], 4)]


def blender_to_webgl_quaternion(obj):
    """Convert Blender rotation to WebGL Y-up quaternion."""
    # Get world rotation as quaternion
    rot = obj.matrix_world.to_quaternion()
    # Blender: Z-up → WebGL: Y-up
    # Apply coordinate swap: (w, x, y, z) → (w, x, z, -y)
    # But we need to compose with the 90° X rotation that swaps Y↔Z
    # Rotation matrix for -90° around X: swaps Y→-Z, Z→Y
    swap = mathutils.Quaternion((1, 0, 0), math.radians(-90))
    final = swap @ rot
    # Return as [x, y, z, w] for Three.js Quaternion constructor
    return [round(final.x, 6), round(final.y, 6), round(final.z, 6), round(final.w, 6)]


def get_world_max_extent(obj):
    """Get the world-space max extent of an object's bounding box."""
    bbox_corners = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    xs = [c.x for c in bbox_corners]
    ys = [c.y for c in bbox_corners]
    zs = [c.z for c in bbox_corners]
    size = [max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)]
    return max(size)


def export_placements():
    """Walk the open scene, write world-space prop transforms to JSON.

    Reused by the autosave handler (scripts/blender_ocean_autosave_handler.py) so a
    Ctrl+S in Blender regenerates placements without a manual headless run. Returns the
    output dict so callers can inspect counts/unmapped without re-reading the file.
    """
    placements = []
    skipped = []
    unmapped = []

    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue

        name = obj.name

        # Skip non-flora objects
        if any(name.startswith(p) for p in SKIP_PREFIXES):
            skipped.append(name)
            continue

        object_key = match_object_key(name)
        if object_key is None:
            unmapped.append(name)
            continue

        # World-space max extent = the scale value for a maxExtent-normalized model
        world_extent = get_world_max_extent(obj)

        # Position (Blender Z-up → WebGL Y-up)
        loc = obj.matrix_world.translation
        position = blender_to_webgl_position(loc)

        # Quaternion rotation
        rotation = blender_to_webgl_quaternion(obj)

        # Uniform scale = world max extent (model normalized to 1-unit max extent)
        scale_val = round(world_extent, 4)

        placements.append({
            "blender_name": name,
            "objectKey": object_key,
            "position": position,
            "rotation": rotation,
            "scale": [scale_val, scale_val, scale_val],
            "world_extent": world_extent,
        })

    # Sort by objectKey for readability
    placements.sort(key=lambda p: (p["objectKey"], p["blender_name"]))

    output = {
        "total": len(placements),
        "skipped": len(skipped),
        "unmapped": unmapped,
        "placements": placements,
    }

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nExported {len(placements)} placements to {output_path}")
    print(f"Skipped {len(skipped)} non-flora objects")
    if unmapped:
        print(f"\nUnmapped objects ({len(unmapped)}):")
        for name in sorted(set(unmapped)):
            print(f"  {name}")

    # Summary by objectKey
    from collections import Counter
    key_counts = Counter(p["objectKey"] for p in placements)
    print(f"\nBreakdown by objectKey:")
    for key, count in sorted(key_counts.items()):
        extents = [p["world_extent"] for p in placements if p["objectKey"] == key]
        print(f"  {key:<40} {count:>3}  scale range: {min(extents):.2f} - {max(extents):.2f}m")

    return output


if __name__ == "__main__":
    export_placements()
