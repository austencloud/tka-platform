"""
Extract exact world-space transforms from ocean_scene.blend.
Run headless: "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/blender-extract-ocean-transforms.py
Outputs JSON to scripts/ocean-blender-transforms.json
"""
import bpy
import json
import os
import mathutils

output_path = os.path.join(os.path.dirname(__file__), "ocean-blender-transforms.json")

results = {}

for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue

    # World-space bounding box corners
    bbox_corners = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]

    xs = [c.x for c in bbox_corners]
    ys = [c.y for c in bbox_corners]
    zs = [c.z for c in bbox_corners]

    world_min = [min(xs), min(ys), min(zs)]
    world_max = [max(xs), max(ys), max(zs)]
    world_size = [world_max[i] - world_min[i] for i in range(3)]
    world_center = [(world_min[i] + world_max[i]) / 2 for i in range(3)]

    # Object-level transforms
    loc = list(obj.location)
    rot = list(obj.rotation_euler)
    scale = list(obj.scale)

    # Mesh-level data name (for matching to GLB objectKey)
    mesh_name = obj.data.name if obj.data else ""

    results[obj.name] = {
        "mesh_name": mesh_name,
        "location": [round(v, 6) for v in loc],
        "rotation_euler": [round(v, 6) for v in rot],
        "scale": [round(v, 6) for v in scale],
        "world_bbox_min": [round(v, 6) for v in world_min],
        "world_bbox_max": [round(v, 6) for v in world_max],
        "world_size": [round(v, 6) for v in world_size],
        "world_center": [round(v, 6) for v in world_center],
        "max_world_extent": round(max(world_size), 6),
        "world_height": round(world_size[2], 6),  # Z-up in Blender
    }

# Also export scene-level info
scene_info = {
    "unit_system": bpy.context.scene.unit_settings.system,
    "unit_scale": bpy.context.scene.unit_settings.scale_length,
    "object_count": len(results),
}

output = {
    "scene_info": scene_info,
    "objects": results,
}

with open(output_path, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\nExported {len(results)} mesh objects to {output_path}")
print(f"Unit system: {scene_info['unit_system']}, scale: {scene_info['unit_scale']}")

# Print summary
print("\nObject summary:")
print(f"{'Name':<40} {'MaxExtent':>10} {'Height(Z)':>10} {'Location':>30}")
print("-" * 95)
for name, data in sorted(results.items()):
    loc_str = f"({data['location'][0]:.1f}, {data['location'][1]:.1f}, {data['location'][2]:.1f})"
    print(f"{name:<40} {data['max_world_extent']:>10.3f} {data['world_height']:>10.3f} {loc_str:>30}")
