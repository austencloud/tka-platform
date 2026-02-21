# Web Museum Prototype — Design Document

**Date:** 2026-02-20
**Status:** Approved
**Track:** Web prototype (parallel to Unreal Engine museum)

---

## Vision

Every user curates their own museum from sequences they like. Other users can visit. The museum lives inside the existing Realm terrain as scattered pavilions — roofless structures with walls that hold framed pictographs and performer platforms. Pavilions grow dynamically as the user adds more exhibits.

This is **Track A** (web prototype). Track B (Unreal Engine) continues separately with full lore, MetaHuman performers, and the complete museum experience.

---

## Architecture

### Integration with Realm

The museum is a new destination within the Realm system. It reuses:

- **Procedural terrain** — biomes, vegetation, chunks, water
- **Spawn clearing** — expanded to create "museum grounds" (40-60m flat area blended into terrain)
- **UnifiedCameraController** — first-person walking with WASD + pointer lock
- **Rapier physics** — wall colliders for pavilion structures
- **3d-animation infrastructure** — IK solver, multi-performer, sequence converter for avatar performers

### New Systems

| System | Purpose |
|--------|---------|
| PavilionGenerator | Creates pavilion layouts based on collection size |
| Pavilion geometry | Three.js wall/floor meshes with PBR textures |
| Exhibit slot system | Wall positions, empty indicators, sequence assignment |
| Interaction detector | Proximity + raycast + "Press E" prompts |
| Museum persistence | Firebase per-user museum data |
| Sequence browser overlay | In-world UI to pick sequences for slots |
| Performer platforms | Circular platforms with looping avatar performers |

---

## Pavilion Design

### Structure

Pavilions are procedural Three.js geometry: `BoxGeometry` walls, `PlaneGeometry` floors. PBR materials (stone/plaster/wood textures from AmbientCG CDN). Roofless — open sky above. Rapier static colliders on all walls.

### Templates

| Template | Walls | Slots | Use |
|----------|-------|-------|-----|
| Alcove | 2 (L-shape) | 4 | Small collections (1-4 exhibits) |
| Corridor | 2 (parallel) | 6 | Medium collections |
| Courtyard | 3 (U-shape) | 8 | Larger collections |
| Quad | 4 (square, open entry) | 12 | Full collections |

### Dynamic Growth

Collection size determines pavilion count and types:

| Exhibits | Layout |
|----------|--------|
| 1-4 | 1 alcove |
| 5-10 | 1 alcove + 1 corridor |
| 11-20 | 3 pavilions (mixed templates) |
| 20+ | Spiral pattern, keeps adding pavilions |

Pavilions are positioned within the museum grounds clearing, spaced 8-12m apart, with walking paths between them.

---

## Exhibit System

### Slot Types

Each wall has evenly spaced slots at eye height (1.5m center). Two slot types:

1. **Wall slot** — holds a framed pictograph. Frame is a gold mesh (adapted from existing gallery `FramedSequence` component) with the sequence's thumbnail rendered as a Three.js texture.

2. **Performer platform** — a raised circular platform (0.3m high, 2m diameter) positioned 1.5m in front of the corresponding wall slot. When populated, a 3D avatar performs the sequence on loop using the existing IK + animation pipeline.

### Empty vs. Populated

- **Empty slot:** Subtle "+" indicator on the wall. Glow effect when player is nearby.
- **Populated slot:** Gold frame with pictograph thumbnail + text placard (sequence name, word). Performer on platform in front.

---

## Interaction Model

### Detection

Each frame, check:
1. Player distance to each slot (threshold: 3m)
2. If within range, raycast from camera center against slot interaction volumes
3. If hit, show "Press E to assign sequence" (empty) or "Press E to view details" (populated)

### Assign Workflow

1. Player walks to empty slot, looks at it
2. "Press E to assign" prompt appears
3. Press E → fullscreen overlay opens (pointer lock releases)
4. Overlay shows sequence browser: search bar, grid of thumbnails, filters
5. Player picks a sequence → overlay closes, pointer lock resumes
6. Frame appears on wall, performer spawns on platform
7. Firebase write: `museums/{userId}/exhibits/{slotId}` → `{ sequenceId, assignedAt }`

### Populated Slot Interaction

1. Walk to populated slot, look at it
2. "Press E for details" prompt
3. Press E → info panel shows: sequence word, letter breakdown, creator, option to remove/swap

---

## Data Model

### Firebase Structure

```
museums/
  {userId}/
    meta/
      name: string          // "Austen's Museum"
      createdAt: timestamp
      updatedAt: timestamp
      isPublic: boolean     // whether others can visit
    exhibits/
      {slotId}/
        sequenceId: string  // reference to sequence document
        assignedAt: timestamp
```

### Local State (Svelte 5 runes)

```typescript
interface MuseumState {
  exhibits: Map<string, MuseumExhibit>  // slotId → exhibit
  pavilions: PavilionLayout[]           // generated from exhibit count
  isOwner: boolean                      // viewing own museum vs. visiting
  selectedSlot: string | null           // slot being interacted with
  isOverlayOpen: boolean                // sequence browser open
}
```

---

## File Structure

```
src/lib/features/museum/
├── MuseumDestination.svelte
├── components/
│   ├── MuseumGrounds.svelte
│   ├── Pavilion.svelte
│   ├── ExhibitSlot.svelte
│   ├── FramedSequence.svelte
│   ├── PerformerPlatform.svelte
│   └── InteractionPrompt.svelte
├── domain/
│   ├── museum-types.ts
│   ├── pavilion-templates.ts
│   └── layout-calculator.ts
├── services/
│   ├── contracts/
│   │   ├── IMuseumPersister.ts
│   │   ├── IPavilionGenerator.ts
│   │   └── IInteractionDetector.ts
│   └── implementations/
│       ├── MuseumPersister.ts
│       ├── PavilionGenerator.ts
│       └── InteractionDetector.ts
├── state/
│   └── museum-state.svelte.ts
└── overlay/
    └── SequenceBrowserOverlay.svelte
```

---

## What Gets Reused

| Existing System | How It's Used |
|-----------------|---------------|
| Realm terrain + chunks + biomes | Foundation — pavilions placed on clearings |
| Spawn clearing system | Expanded for museum grounds (larger flat area) |
| UnifiedCameraController | First-person walking, no changes |
| Rapier physics | Wall colliders for pavilions |
| 3d-animation IK + SequenceConverter | Avatar performers on platforms |
| Gallery FramedSequence concept | Adapted for wall slot system |
| Gallery AnimationScreen concept | Reference for live playback |
| Destination registry | New "museum" destination entry |
| DI container pattern | New museum-container.ts |

---

## Phases

### Phase 1: Static Museum
- Pavilion geometry rendering (walls, floors, materials)
- Terrain clearing for museum grounds
- Slot positions on walls
- Destination registration
- Walk around empty pavilions

### Phase 2: Exhibits on Walls
- FramedSequence adapted from gallery
- Hardcoded test exhibits (no Firebase yet)
- Thumbnail textures loading on frames
- ExhibitLabel placards

### Phase 3: Performers
- PerformerPlatform geometry
- Avatar spawning with sequence data
- IK animation loop on platforms
- Activation/deactivation by proximity

### Phase 4: Interaction & Curation
- InteractionDetector (proximity + raycast)
- InteractionPrompt UI
- SequenceBrowserOverlay (search, filter, assign)
- Museum persistence (Firebase CRUD)
- Dynamic pavilion growth on collection change

### Phase 5: Visiting
- Museum URL scheme (visit another user's museum)
- Read-only mode for visitors
- Public/private toggle

---

## Non-Goals (v1)

- Multiplayer (existing gallery multiplayer code can be revived later)
- Museum lore, Order narrative, themed rooms (Track B / Unreal)
- Audio/ambient sound design
- Custom pavilion decoration or theming
- Leaderboards or social features beyond visiting
