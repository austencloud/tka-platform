# Blender ↔ TKA Workflow

Art-direct 3D scene object placement in Blender, sync transforms back to the web app.

## Prerequisites

- Blender 5.1+ with BlenderMCP addon enabled (port 9876)
- Claude Code with `mcp__blender__execute_blender_code` connected

## Scripts

### `cosmic_setup.py` — Build the Cosmic scene

Imports 7 crystal GLBs from `static/models/cosmic/`, places 24 instances per `placements.ts`, adds ground plane, stage platform, lighting, camera, and a 5m exclusion zone wireframe.

**Run:** paste full script content into `mcp__blender__execute_blender_code`

### `sync_to_placements.py` — Export Blender → placements.ts

Reads all objects in the `Crystals` collection, converts Blender Z-up coordinates back to Three.js Y-up, and prints a complete `placements.ts` file between `__PLACEMENTS_TS_START__` / `__PLACEMENTS_TS_END__` sentinel markers.

**Run:** paste full script content into `mcp__blender__execute_blender_code`, then extract the content between sentinels and write to `src/lib/shared/3d/environments/scenes/cosmic/placements.ts`.

## Coordinate Conversion

| Axis    | Three.js (Y-up) | Blender (Z-up) |
|---------|-----------------|----------------|
| Right   | +X              | +X             |
| Up      | +Y              | +Z             |
| Forward | -Z              | -Y             |

**Position:** `(x, y, z)_three → (x, -z, y)_blender`

**Rotation:** Y-axis rotation in Three.js = Z-axis rotation in Blender

## Workflow

1. Run `cosmic_setup.py` to build the scene
2. Move/rotate/scale crystals in Blender
3. Tell Claude "sync to app"
4. Claude runs `sync_to_placements.py`, extracts output, writes `placements.ts`
5. Vite hot-reloads the app

## Object Naming

Blender objects: `{modelType}_{index}` (e.g. `crystal-spire-prismatic_0`)

Custom properties on each crystal:
- `tka_id` — e.g. `cosmic-0`
- `tka_objectKey` — e.g. `crystal-spire-amethyst`

## Collections

- `_Templates` — hidden GLB source objects (one per crystal type)
- `Crystals` — visible placed instances (24 objects)
