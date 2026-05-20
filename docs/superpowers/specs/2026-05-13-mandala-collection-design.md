# Mandala Collection — Right-Click to Save

## Goal

Right-click a mandala in the step grid → save to a browsable collection in Lab → Mandalas tab. Gallery now, export integration later.

## Data Model

```ts
interface CollectedMandala {
  id: string;             // crypto.randomUUID()
  name: string;           // sequence word or "Mandala #N"
  steps: StepData[];      // regenerate mandala from these
  variant: "blue" | "red" | "both";
  bluePropType: string;
  redPropType: string;
  createdAt: number;      // Date.now()
}
```

localStorage key: `tka:mandala-collection`

Stored as `JSON.stringify(CollectedMandala[])`. No deduplication in Phase 1 — same sequence can be saved multiple times with different variants.

## Piece 1: Context Menu on Mandala Cells

### TimelineGrid + StandardGrid changes

- Remove `pointer-events: none` from mandala cell wrappers
- Add `oncontextmenu` handler to mandala cell wrapper divs
- On right-click: open a lightweight context menu (reuse generic `ContextMenu` component) with one item: **"Save to Collection"**
- On click: serialize current `steps`, active variant, prop types, and sequence word → push to localStorage collection
- Show brief toast/notification confirming save

### Data flow

Mandala cells need access to:
- `steps` (already have via `{ steps }` sequence prop)
- Current variant (`cell.show`)
- Prop types (bluePropTypeOverride / redPropTypeOverride, or fall back to settingsService)
- Sequence word (pass down from StepGrid or derive from steps)

## Piece 2: Collection Gallery in Lab

### Location

Extend existing mandala lab tab. Add a "Collection" toggle or section alongside the mandala generator. When collection view is active, show saved mandalas in a responsive grid.

### Gallery UI

- Grid of mandala thumbnails rendered via `SequenceMandala` component
- Each card shows: mandala visual, name, date saved
- Click → expand/detail view (future phase)
- Delete button (with confirmation) per card
- Empty state: "No mandalas saved yet. Right-click a mandala in the step grid to add one."

### State

New file: `src/lib/features/mandala-collection/state/mandala-collection-state.svelte.ts`
- `load()`: read from localStorage
- `save(mandala: CollectedMandala)`: append + persist
- `remove(id: string)`: filter + persist
- Reactive `collection` array for UI binding

### Repository

New file: `src/lib/features/mandala-collection/services/LocalMandalaCollectionRepository.ts`
- `load(): CollectedMandala[]`
- `save(collection: CollectedMandala[]): void`
- Follows `LocalStickerSheetRepository` pattern

## Not in Scope

- Firebase sync / cloud persistence
- Export to Sticker Lab pipeline
- Mandala generator integration (custom + sequence mandalas are separate artifacts)
- Deduplication / merge logic
- Sorting / filtering / search in gallery

## Future Phases

- Phase 2: Export mandala to Sticker Lab as `MandalaPrimitiveRef`
- Phase 3: Firebase persistence with user accounts
- Phase 4: Gallery sorting, filtering, tagging
