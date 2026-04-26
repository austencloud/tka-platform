# Museum Village Embed — Design Spec

**Date:** 2026-04-07
**Status:** Draft

## Overview

Replace the 4 static MuseumPerformerStation3D instances in the Room of Collaboration with a live Village ECS simulation. The visitor walks from Isolation into an outdoor campground where autonomous entities are teaching, performing, inventing, and dying — performing the museum's own sequences. The thesis of the entire museum rendered as a living system.

## Architecture

A new `MuseumVillageEmbed.svelte` component creates and manages its own VillageOrchestrator, seeded with sequences from earlier museum rooms. It renders a stripped-down village scene (avatars, monuments, death marks, jam circles — no control panel, no timeline) positioned at the collaboration room's center in museum world coordinates.

The embed is conditionally mounted when the collaboration room enters the active streaming set, and destroyed when it leaves. The sim runs independently of the lab tab village — separate orchestrator, separate state, separate lifecycle.

## Spatial Layout

- **Room:** 22x20 tiles, ~44x40 world units, outdoor theme, dirt floor
- **Village arena:** radius 8, centered in the room
- **Ground plane:** Disabled — the museum's dirt floor IS the ground
- **Arena edge ring:** Kept, subtle amber ring marks the campfire boundary
- **Grid helper:** Disabled — would clash with the museum floor
- **Camera:** Museum's existing FPS camera, no orbit controls

The player walks freely through the room. Village entities perform within the arena radius. The player can walk right up to them, through the group, around the edges. No invisible walls.

## Seed Sequences

The village entities perform sequences from earlier museum rooms:

```typescript
// From museum-room-content.ts collaboration performers
const MUSEUM_SEED_SEQUENCES = [
  "performer-cave-seq",      // Cave painting sequence
  "gallery-spiral-seq",      // K's Gallery spiral
  "gallery-scribes-seq",     // Scribes sequence
  "gallery-practice-seq",    // Practice sequence
];
```

These are the same sequence IDs the static performers currently use. The village entities learn, teach, mutate, and forget these exact sequences. The knowledge that survived 40,000 years of suppression is alive and evolving in front of the visitor.

## Population

- **6 entities** (compact, intimate campfire feel)
- **No maker entity** — the campfire doesn't need a craftsman, and fewer entities = less visual clutter
- **Tick speed:** 5 ticks/second (slower than lab default, gives the visitor time to observe individual interactions)
- **Lifespan:** 400 ticks (shorter than lab default — visitor should see at least one death/birth cycle during a 2-minute visit)
- **LLM disabled** — deterministic only for museum (predictable performance, no Ollama dependency)

## What Renders

| Element | Included | Why |
|---------|----------|-----|
| VillageAvatar (PerformerRig) | Yes | The core — entities with locomotion, effects, props |
| Name labels | Yes | Identity matters in a campfire |
| Monuments | Yes | History accumulates visibly on the ground |
| Death marks | Yes | Temporary scars that heal |
| Jam circles | Yes | Emergent social clustering |
| Effect circles | Yes | Affinity-colored ground rings |
| Dropped props | Yes | Material culture artifacts |
| Event toasts | No | Too much UI noise in a museum context |
| Controls panel | No | Museum visitor doesn't control the sim |
| Timeline strip | No | No sidebar in museum |
| Prop wall | No | Too small to see at museum scale |
| Grid helper | No | Clashes with museum floor |

## Lifecycle

1. **Mount:** When `activeRoomSet` includes `"collaboration"`, mount `MuseumVillageEmbed`
2. **Initialize:** Create VillageOrchestrator with museum config, seed with museum sequences, start simulation at 5 ticks/second
3. **Run:** Sim ticks independently. Museum render loop calls `syncFromEngine()` + `lerpAvatars()` each frame via `useTask`
4. **Unmount:** When player leaves collaboration room (room exits active set), call `orchestrator.destroy()`. Threlte handles Three.js cleanup via Svelte lifecycle.

No persistence. Each visit starts a fresh village. That's thematically correct — you're witnessing one possible future of these sequences, not THE future.

## Integration Point

In `Museum3DScene.svelte`, the performer rendering block already has a per-performer loop:

```svelte
{#each visiblePerformers as performer (performer.id)}
  <!-- existing MuseumPerformerStation3D or TelekineticFormation3D -->
{/each}
```

For the collaboration room, instead of rendering individual performer stations, check if any visible performer belongs to the collaboration room and render the village embed instead:

```svelte
{#if activeRoomSet.has("collaboration")}
  <MuseumVillageEmbed
    centerX={collabRoomCenterX}
    centerZ={collabRoomCenterZ}
    seedSequenceIds={MUSEUM_SEED_SEQUENCES}
  />
{/if}
```

The static collab performers (`collab-1` through `collab-4`) are filtered out of visiblePerformers when the embed is active, avoiding double rendering.

## File Manifest

| File | Action | Responsibility |
|------|--------|----------------|
| `museum/components/game/MuseumVillageEmbed.svelte` | CREATE | Owns orchestrator lifecycle, renders village scene elements, positioned in museum world space |
| `museum/components/game/Museum3DScene.svelte` | MODIFY | Conditionally render embed when collaboration room is active, filter collab performers |
| `museum/data/museum-room-content.ts` | NO CHANGE | Seed sequence IDs already defined |

## What It Looks Like

The visitor walks through the Room of Isolation — cubicles, fragments of knowledge kept apart, oppressive silence. They pass through the east door and step outside. Dirt underfoot. Sky above. Stars. Trees at the edges.

In the center of the space, six figures. Some are walking toward each other. Two are facing each other — one demonstrating a sequence, the other mirroring it. One stands alone, performing something by their fire-lit prop tips. A faint hexagonal pillar glows near the edge — a monument to a sequence that survived three generations.

A name label floats above each figure. Ember (e) [S]. Reed (y) [F]. The elder glows faintly. The youth wobbles slightly.

The visitor didn't start this. These entities were here before the visitor arrived and will continue after they leave (until the room unloads). The knowledge that was suppressed, hoarded, nearly lost — it's being freely exchanged by strangers around a campfire. No plaques. No explanations. Just people doing the thing.

That's the payoff for the entire museum.
