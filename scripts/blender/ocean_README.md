# Ocean Scene — Blender Workflow

Three scripts for building, tuning, and exporting the ocean-v2 scene via Blender MCP.

## Scripts

### 1. `ocean_setup.py` — Initial Scene Build

Creates the full underwater scene in Blender:
- Subdivided seabed plane with fractal noise displacement
- Stage exclusion zone (radius 5, smoothed flat at center)
- Water surface plane at y=10 (translucent blue)
- Blue-tinted sun, caustic area light, ambient fill
- Underwater camera perspective
- All ocean models imported as templates
- One instance of each model placed in a spiral for manual arrangement

Each placed object gets `tka_id` and `tka_objectKey` custom properties for sync.

### 2. `ocean_sync_to_placements.py` — Sync Transforms to TypeScript

After arranging objects in Blender's viewport:
1. Run this script
2. Copy the output between `__PLACEMENTS_TS_START__` and `__PLACEMENTS_TS_END__`
3. Paste into `src/lib/shared/3d/environments/scenes/ocean-v2/authored/placements.ts`

Reads from collections: Flora, Rocks, Formations, Decorations.

Coordinate conversion: Blender Z-up to Three.js Y-up.

### 3. `ocean_export_environment.py` — Export Terrain + Structures as GLB

Exports only the Terrain and Structures collections as a single GLB:
- Output: `static/models/ocean/ocean-environment.glb`
- Includes: seabed mesh, water surface
- Excludes: flora, rocks, formations, decorations (loaded individually at runtime)

## Workflow

```
1. Paste ocean_setup.py into mcp__blender__execute_blender_code
2. Arrange objects in Blender viewport (duplicate, move, rotate, scale)
3. Ensure each object has tka_id (ocean-N) and tka_objectKey custom properties
4. Paste ocean_sync_to_placements.py to get updated placements.ts
5. Paste ocean_export_environment.py to export terrain GLB
```

## Collections

| Collection | Purpose | Exported to GLB? |
|---|---|---|
| Terrain | Seabed geometry | Yes |
| Structures | Water surface, major structures | Yes |
| Flora | Corals, seaweed, kelp, anemone | No (runtime) |
| Rocks | Rock models 0-5 | No (runtime) |
| Formations | Meshy models (pinnacles, arches) | No (runtime) |
| Decorations | Starfish, urchin, shell | No (runtime) |
| _Templates | Hidden source models | No |

## Coordinate System

```
Three.js (Y-up)  ->  Blender (Z-up)
  (x, y, z)      ->  (x, -z, y)

Blender (Z-up)   ->  Three.js (Y-up)
  (x, y, z)      ->  (x, z, -y)

Y-axis rotation (Three.js) = Z-axis rotation (Blender)
```

## Model Keys

Keys match `ocean-composer-plugin.ts`. File naming uses underscores; keys use dashes.

| Key | File |
|---|---|
| `coral-0` | `coral_0.glb` |
| `kelp-plant` | `kelp_plant.glb` |
| `meshy-basalt-pinnacle` | `meshy/basalt_pinnacle.glb` |
