# Museum Object Placement System — Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Sims-like object placement for museum edit mode

---

## Problem

The museum editor (F2) can reposition existing objects but cannot add new ones. Rooms like the Room of Collaboration have no wall fixtures because the auto-placement system only places torches on wall segments defined in the room graph. There's no way to manually place torches, furniture, or decorative objects.

## Solution

A Sims-style placement system integrated into the existing museum editor. Pick an object from a panel, see a ghost preview that snaps to valid surfaces with correct orientation, click to place. Objects persist to a source file so placements are version-controlled and survive rebuilds.

---

## 1. Object Definitions

### PlaceableObjectDef

Every placeable object carries constraints that the placement system enforces.

```ts
type PlacementSurface = 'wall' | 'floor' | 'floor_against_wall';

interface PlaceableObjectDef {
  id: string;                    // "cave-torch", "bench", "plant"
  label: string;                 // "Wall Torch (Cave)"
  category: 'fixture' | 'furniture';
  surface: PlacementSurface;
  modelPath: string;             // "/models/fixtures/torch-cave.glb"
  thumbnail?: string;            // picker panel preview image
  mountHeight: number;           // Y position (1.25 for torches, 0 for floor)
  wallOffset: number;            // distance from wall surface (0.175 for torches)
  scale: number;                 // model scale factor
  hasFlame?: boolean;            // fixture-specific: spawn flame effect
  lightColor?: string;           // fixture-specific: point light color
  lightIntensity?: number;       // fixture-specific: point light intensity
}
```

### Surface Rules

| Surface | Rule | Objects |
|---------|------|---------|
| `wall` | Must hit a vertical wall face. Auto-orients via face normal. Offset by `wallOffset` so back is flush. | Torches, sconces, plaques |
| `floor` | Any walkable floor tile. Snaps to tile grid center. Free Y-rotation. | Benches, plants, pedestals, lamps |
| `floor_against_wall` | Floor tile adjacent to a wall. Auto-orients to face away from nearest wall. | Bookshelves, display cases |

### Registry

The `PlaceableObjectDef` registry is a flat catalog built from existing data sources:

- **Fixtures:** Derived from `FIXTURE_REGISTRY` (keyed by WingTheme) in `fixture-registry.ts`
- **Furniture:** Derived from `ROLE_DEFINITIONS` in `MuseumModelLoader.ts`

A single `PLACEABLE_OBJECTS` array in `placeable-object-registry.ts` unifies both. The picker panel reads this array to populate its grid.

---

## 2. Interaction Flow

### Entering Placement Mode

1. User is in edit mode (F2 toggle, existing system)
2. A picker panel appears on the left side of the viewport (always visible in edit mode)
3. User clicks an object in the picker (e.g. "Cave Torch")
4. Editor state transitions: `museum3dEditorState.placementMode` set to the selected `PlaceableObjectDef`
5. The TransformControls gizmo is hidden. A ghost mesh appears instead.

### Ghost Preview

A translucent clone of the selected object's model follows the cursor:

- **Material:** `MeshStandardMaterial({ transparent: true, opacity: 0.5, depthWrite: false })`
- **Color:** Green (`#22dd77`) when valid, red (`#dd3344`) when invalid
- **Snap ring:** Pulsing circle around the ghost indicating the snap point

On every `pointermove`:
1. `Raycaster.setFromCamera(mouseNDC, camera)` → `intersectObjects(sceneMeshes, true)`
2. For the first hit, classify the surface via dot product of face normal with world up:
   - `dot > 0.7` → floor
   - `dot < 0.3` → wall
3. Check if the hit surface matches the object's `PlaceableObjectDef.surface` constraint
4. If valid:
   - **Wall objects:** `quaternion.setFromUnitVectors(FORWARD, worldNormal)` for orientation. Position = `hitPoint + normal * wallOffset`. Snap tangent axes to tile grid (`Math.round(v / TILE_SIZE) * TILE_SIZE`). Set Y to `mountHeight`.
   - **Floor objects:** Snap X and Z to tile grid center. Set Y to 0.
   - Ghost turns green, snap ring visible
5. If invalid: ghost turns red, click does nothing

### Placing

- **Left-click** on valid ghost position → confirm placement
  1. Ghost becomes a real object (solid material, effects enabled)
  2. Placement written to `museum-manual-placements.ts` immediately
  3. Ghost resets and continues following cursor for next placement
- **ESC** → exit placement mode, return to normal editor
- **Right-click** on an existing manually-placed object → delete it (remove from file)

### Collision With Existing Editor

When `placementMode` is active:
- Clicking does NOT trigger the existing `findClickedObject` selection logic
- The TransformControls gizmo is hidden
- OrbitControls still work (middle-click/scroll to navigate while placing)
- WASD panning still works

When `placementMode` is null (normal edit mode):
- Everything works as before: click to select, gizmo to drag, undo/redo

---

## 3. Wall Snapping — Technical Detail

### Raycast Target

Wall meshes are `BatchedMesh` instances. Three.js `Raycaster` supports BatchedMesh natively. The intersection result includes:
- `hit.point` — world-space hit position
- `hit.face.normal` — local-space face normal
- `hit.object.matrixWorld` — for transforming normal to world space

### Orientation Algorithm

```
worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)

if (worldNormal.dot(WORLD_FORWARD) < -0.999):
    ghost.quaternion.setFromAxisAngle(UP, Math.PI)  // anti-parallel edge case
else:
    ghost.quaternion.setFromUnitVectors(WORLD_FORWARD, worldNormal)
```

### Position Algorithm

```
// Snap to tile grid on tangent axes
snappedX = Math.round(hit.point.x / TILE_SIZE) * TILE_SIZE
snappedZ = Math.round(hit.point.z / TILE_SIZE) * TILE_SIZE

// Set Y to mount height
snappedY = def.mountHeight

// Offset from wall surface
position = Vector3(snappedX, snappedY, snappedZ) + worldNormal * def.wallOffset
```

### Surface Classification

```
dot = worldNormal.dot(UP_VECTOR)
if dot > 0.7 → 'floor'
if dot < -0.7 → 'ceiling' (unused for now)
if abs(dot) < 0.3 → 'wall'
```

---

## 4. Persistence

### Data File

`src/lib/features/museum/data/museum-manual-placements.ts`

```ts
import type { Direction } from '../domain/museum-grid-types';

export interface ManualPlacement {
  id: string;                     // unique, e.g. "collab-torch-1"
  objectDefId: string;            // references PlaceableObjectDef.id
  tileX: number;                  // tile coordinate
  tileY: number;                  // tile coordinate
  wallFacing: Direction | null;   // which direction the wall faces (null for floor objects)
  yaw: number;                    // Y rotation in radians
}

export const MANUAL_PLACEMENTS: Record<string, ManualPlacement[]> = {
  // Populated by editor save action
};
```

### Save Flow

When user clicks to place:
1. Generate a unique ID: `${roomId}-${objectDefId}-${Date.now()}`
2. Compute tile coordinates from world position: `Math.round(worldX / TILE_SIZE)`
3. Compute wall facing from normal: map `(0,0,-1)` → `"north"`, etc.
4. Compute yaw from ghost quaternion
5. Add to in-memory `MANUAL_PLACEMENTS[roomId]` array
6. Write the entire file back to disk using `fs.writeFileSync` (via a dev-only API endpoint or Vite plugin)
7. Vite HMR detects the change and hot-reloads

### Delete Flow

When user right-clicks a manually-placed object:
1. Identify the placement by raycasting → finding the named group → looking up its `id`
2. Remove from `MANUAL_PLACEMENTS[roomId]`
3. Write file back to disk
4. Object disappears on HMR reload

### Why a .ts File

- Version-controlled (git)
- Diff-friendly (one placement per line)
- Type-checked at compile time
- Imported statically by the geometry builder
- No runtime deserialization cost

---

## 5. Integration With Geometry Builder

### Reading Manual Placements

The geometry builder (`MuseumGeometryBuilder.ts`) currently reads torch positions from `bucketMuseumTiles()` which walks the tile grid. For manual placements:

1. Import `MANUAL_PLACEMENTS` from the data file
2. After bucketing auto-placed torches, iterate `MANUAL_PLACEMENTS[wingId]`
3. For each manual fixture: create a `TorchPosition` with the stored tile/offset/theme data and push to `torchPositions[]`
4. For each manual furniture: create a furniture entry and push to the furniture arrays

This means manually-placed objects go through the exact same rendering pipeline as auto-placed ones. No new rendering code needed.

### Room ID Resolution

The geometry builder processes rooms by wing. It needs to know which room ID maps to which wing. The `MuseumGrid.wings` array already has `wing.id` which matches the room graph `id` field. Manual placements are keyed by room `id`.

---

## 6. Picker Panel Component

### Location

`src/lib/features/museum/components/editor/PlacementPickerPanel.svelte`

### Layout

- Fixed left panel, 240px wide, full viewport height
- Only visible when `museum3dEditorState.editorActive` is true
- Sections: "Wall Fixtures" and "Floor Objects" (derived from `PlaceableObjectDef.category`)
- Each item shows icon/thumbnail + label in a 2-column grid
- Selected item highlighted with accent border
- Bottom hint section with keybinding reminders

### State

Clicking an item sets `museum3dEditorState.placementMode` to the selected def. Clicking the same item again (or ESC) clears it.

---

## 7. Editor State Extensions

### New Fields on museum3dEditorState

```ts
placementMode: PlaceableObjectDef | null  // null = normal edit mode, non-null = placing
ghostValid: boolean                        // is current ghost position a valid placement
```

### Mode Transitions

| From | Trigger | To |
|------|---------|----|
| Normal edit | Click picker item | Placement mode |
| Placement mode | ESC | Normal edit |
| Placement mode | Click picker item (same) | Normal edit |
| Placement mode | Click picker item (different) | Placement mode (new object) |
| Placement mode | F2 | Exit editor entirely |

---

## 8. File Structure

New files:
```
src/lib/features/museum/
  data/
    museum-manual-placements.ts          # Persisted placements
    placeable-object-registry.ts         # PlaceableObjectDef catalog
  components/
    editor/
      PlacementPickerPanel.svelte        # Left-side object picker
      PlacementGhost.svelte              # Ghost preview mesh + snapping logic
  services/
    contracts/
      IPlacementPersister.ts             # Interface for save/delete
    implementations/
      PlacementPersister.ts              # Writes to .ts file via dev API
```

Modified files:
```
  state/
    museum-3d-editor-state.svelte.ts     # Add placementMode, ghostValid
  components/game/
    Museum3DScene.svelte                 # Mount picker panel + ghost in editor mode
    MuseumSceneEditor.svelte             # Route clicks to placement vs selection
  services/implementations/
    MuseumGeometryBuilder.ts             # Read manual placements during bucketing
```

---

## 9. Phasing

### Phase A (This Implementation)

Wall fixtures only. Torches and sconces from `FIXTURE_REGISTRY`.
- Picker panel with fixture category
- Ghost snapping to walls
- Persistence to file
- Geometry builder integration for fixtures

### Phase B (Future)

Floor objects. Benches, plants, pedestals, lamps from `ROLE_DEFINITIONS`.
- Add furniture category to picker
- Floor raycasting + tile grid snap
- Free Y-rotation (scroll wheel while placing)

### Phase C (Future)

Full palette. `floor_against_wall` objects, custom models, per-room theme filtering.
- Bookshelves auto-orient against walls
- Picker filters by current room's theme
- Collision detection between placed objects

---

## 10. Non-Goals

- **Undo/redo for placements** — out of scope for Phase A. The existing TransformControls undo stack is separate. Placements can be deleted via right-click.
- **Multi-select / bulk operations** — one object at a time
- **Custom model import** — only objects from existing registries
- **Runtime placement by players** — editor-only, dev-time tool
