# Museum Exhibit → Pictograph Rendering Design

## Goal

When a player presses E on an exhibit in the 2D museum, the detail panel shows the plaque text (as now) plus a rendered TKA sequence as a strip of pictographs. This transforms the museum from a walking simulator into an actual teaching tool where exhibits display real kinetic notation.

## Architecture

The existing system already has the plumbing:
- `ExhibitDefinition.sequenceId` field exists (optional string)
- `DetailPanel.svelte` already conditionally renders `SequenceView` when `sequenceId` is present
- `SequenceView.svelte` is a placeholder that says "Pictograph rendering available in Phase 2"

This spec replaces `SequenceView` with a real implementation. Three changes:

1. **Exhibit sequence manifest** — pre-generated StepData stored as a static TypeScript module, keyed by exhibit `sequenceId`
2. **Replace SequenceView** — the existing placeholder becomes a real renderer using `PictographContainer`
3. **Populate sequenceId** — set `sequenceId` on exhibits that should display sequences in `museum-room-content.ts`

No new services, no Firebase dependency, no runtime generation. Sequences are pre-baked static data.

## Data Layer

### Exhibit Sequence Manifest

New file `src/lib/features/museum-2d/data/museum-exhibit-sequences.ts`:

```typescript
import type { StepData } from "$lib/shared/pictograph/core/domain/types/PictographData";
import type { StartPositionData } from "$lib/shared/pictograph/core/domain/types/StartPositionData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface MuseumSequenceData {
  word: string;
  gridMode: GridMode;
  startPosition: StartPositionData;
  steps: StepData[];
}

export const MUSEUM_EXHIBIT_SEQUENCES: Record<string, MuseumSequenceData> = {
  // Keys match ExhibitDefinition.sequenceId values
  "vic-brass-seq": { ... },
  "digital-crt-seq": { ... },
  "gallery-spiral-seq": { ... },
  "gallery-scribes-seq": { ... },
  "gallery-practice-seq": { ... },
};
```

### Seed Script Pipeline

`scripts/seed-museum-sequences.cjs`:
1. Defines exhibit → word mappings (e.g. `"gallery-spiral-seq" → "SPIRAL"`)
2. Calls `packages/sequence-engine` to generate each sequence with `constraintPreset: "smooth"`
3. The engine returns `SequenceData` with `steps: StepData[]` — the same format PictographContainer consumes
4. Serializes the steps + startPosition + word + gridMode to the manifest file

The manifest contains raw `StepData` (not pre-prepared). `PictographContainer` handles async preparation internally via `PictographPreparer.prepareSingle()`. This is the same pipeline used everywhere else in the app — no special handling needed.

### Which Exhibits Get Sequences

| Room | Exhibit refId | sequenceId | Word | Rationale |
|------|--------------|------------|------|-----------|
| victorian | `vic-brass` | `vic-brass-seq` | 3-beat L1 | First mechanical notation device |
| digital | `digital-crt` | `digital-crt-seq` | 4-beat L1 | First digital sequence |
| gallery | `gallery-spiral` | `gallery-spiral-seq` | 6-beat L2 | Centerpiece exhibit |
| gallery | `gallery-scribes` | `gallery-scribes-seq` | 4-beat L1 | Scribe training sequence |
| gallery | `gallery-practice` | `gallery-practice-seq` | 4-beat L1 | Practice pattern |

All other exhibits remain narrative-only (no `sequenceId`). More can be added later by extending the manifest and setting `sequenceId` in the content map.

### Content Map Changes

In `museum-room-content.ts`, the `ExhibitContent` interface gains an optional `sequenceId`:

```typescript
export interface ExhibitContent {
  plaque?: { title: string; subtitle?: string; body: string; footer?: string };
  sequenceId?: string;  // Key into MUSEUM_EXHIBIT_SEQUENCES
}
```

The `MuseumGridBuilder.placeExhibits()` method already copies `sequenceId` from content to `ExhibitDefinition`. It currently reads from `ROOM_CONTENT[room.id]?.exhibits?.[refId]` — we just need to populate the `sequenceId` field there.

## Components

### SequenceView Replacement

Replace the placeholder `SequenceView.svelte` with a real implementation.

**Props** (unchanged interface — still takes `sequenceId`):
```typescript
interface Props {
  sequenceId: string;
}
```

**Rendering:** Look up `MUSEUM_EXHIBIT_SEQUENCES[sequenceId]`. If found, render a horizontal strip of `PictographContainer` instances (one per step, plus the start position). If not found, show a minimal fallback.

**Layout:**
```
┌─────────────────────────────────────┐
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ Σ  │ │ A  │ │ B  │ │ D  │ ...  │  ← scrollable
│  │    │ │    │ │    │ │    │      │
│  └────┘ └────┘ └────┘ └────┘      │
│  "SPIRAL" — 6 beats               │
└─────────────────────────────────────┘
```

**Sizing:** Each pictograph cell uses `min(80px, 20cqw)` — container-query relative so it adapts when the detail panel is narrow. The strip scrolls horizontally via `overflow-x: auto`. Word label below in museum tan.

**PictographContainer usage:** Each step is rendered as:
```svelte
<PictographContainer
  pictographData={step}
  showGrid={true}
  showTKA={true}
  showReversals={false}
  showPositions={true}
/>
```

The async `prepareSingle()` call inside PictographContainer is fine — it's lightweight (~1ms per step) and runs in parallel for all visible steps. For 5-6 steps this is imperceptible.

### DetailPanel — No Changes Needed

The existing DetailPanel already renders `SequenceView` when `focusedExhibit.sequenceId` exists (line 44-48). By replacing the SequenceView implementation, the panel integration is automatic. Zero changes to DetailPanel.

## Interaction Flow

1. Player walks to exhibit panel, faces it
2. InteractionPrompt shows "E Examine" (existing)
3. Player presses E → `state.interact()` sets `focusedExhibitId` (existing)
4. DetailPanel resolves the exhibit, shows PlaqueView (existing)
5. DetailPanel checks `focusedExhibit.sequenceId` (existing conditional)
6. **CHANGED:** SequenceView looks up manifest, renders pictograph strip instead of placeholder
7. Player presses E elsewhere → exhibit unfocused, strip disappears (existing)

## 3D Mode (Future — Not This Implementation)

Deferred. Requires per-instance mesh identification and raycasting. The SequenceView component will work in any context once the 3D interaction trigger is wired.

## Testing

Per project testing philosophy ("test what would silently produce wrong output"), the visual rendering doesn't need tests — you'll see if it's broken. Instead, test the seed script output:

- `tests/unit/museum-2d/museum-exhibit-sequences.test.ts`
- Verify: every manifest entry has non-empty `steps` array
- Verify: all `stepNumber` values are sequential starting from 1
- Verify: every step has both blue and red motions defined
- Verify: `word` length matches `steps` length

These catch silent data corruption in the pre-baked manifest.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `museum-2d/data/museum-exhibit-sequences.ts` | Create | Pre-baked sequence data manifest |
| `museum-2d/data/museum-room-content.ts` | Modify | Add `sequenceId` to 5 exhibit entries |
| `museum-2d/components/panel/SequenceView.svelte` | Replace | Real pictograph strip (was placeholder) |
| `scripts/seed-museum-sequences.cjs` | Create | One-time script to generate manifest data |
| `tests/unit/museum-2d/museum-exhibit-sequences.test.ts` | Create | Manifest data validation |

## Non-Goals

- Animation playback in the detail panel (future)
- Performer stations playing sequences (future)
- 3D exhibit interaction (future, separate spec)
- Dynamic sequence generation at runtime
- Firebase sequence loading
- New components in DetailPanel (existing conditional already handles it)
