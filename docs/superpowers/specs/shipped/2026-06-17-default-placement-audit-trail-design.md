# Default Arrow Placement Audit Trail — Design

**Date:** 2026-06-17
**Status:** Approved (brainstorming)
**Author:** Claude Opus 4.8 + Austen

## Problem

The `default_arrow_adjustments` collection stores only `updatedAt` + `updatedBy`
per doc — the last writer, nothing more. There is no record of what a value was
before a change, who changed it when, or any way to revert to a prior state. The
**global** arrow-adjustment system already solved this with
`global_arrow_adjustment_history` (append-only history docs) and an
`ArrowAdjustmentHistory.svelte` panel with per-entry revert. Default placements
should get the same capability, scoped to the arrow currently being edited in the
inspector.

## Goal

Every committed admin **save** or **delete** to a default placement records an
append-only history entry `{gridMode, propType, motionType, placementKey, turns,
action, newX, newY, prevX, prevY, by, at}`. The inspector shows the history for
the **currently-selected arrow only**, with a one-click revert-to-any-point.

Non-goals: history for live preview (`saveDefaultLocal`); an all-arrows firehose
view; retention/pruning; non-admin visibility.

## Reference implementations (mirror these)

- `src/lib/shared/pictograph/arrow/positioning/global/services/global-arrow-adjustment-persister.ts`
  — `appendHistory()` fire-and-forget pattern, flat history doc shape.
- `src/lib/features/create/shared/components/sequence-actions/ArrowAdjustmentHistory.svelte`
  — collapsible lazy-loaded panel, `revertTo()` re-saving an entry's value.
- `firestore.rules` line ~983 (`global_arrow_adjustment_history` match block).

## Data model

New top-level collection `default_arrow_adjustment_history`, one auto-id doc per
committed change:

| Field | Type | Notes |
|---|---|---|
| `gridMode` | string | arrow identity |
| `propType` | string | arrow identity |
| `motionType` | string | arrow identity |
| `placementKey` | string | arrow identity |
| `turns` | string | arrow identity (e.g. `"1.5"`) |
| `entryKey` | string | `"{grid}_{prop}_{motion}\|{placementKey}\|{turns}"` — the single field the scoped query filters on |
| `action` | `"save" \| "delete"` | |
| `newX`, `newY` | number \| null | value written; `null,null` for delete |
| `prevX`, `prevY` | number \| null | value before the change; `null,null` if none existed |
| `timestamp` | serverTimestamp | order key |
| `updatedBy` | string | admin email |

`entryKey` keeps the selected-arrow query to one equality + one `orderBy`, so the
composite index is 2-field (`entryKey ASC, timestamp DESC`) rather than 6-field.

## Write path

### Persister — `default-arrow-placement-persister.ts`

- Add `const HISTORY_COLLECTION_NAME = "default_arrow_adjustment_history";`
- Add `private async appendHistory(...)` — exact mirror of the global persister:
  build the flat doc above, `setDoc(doc(collection(db, HISTORY_COLLECTION_NAME)), {...})`,
  wrapped in try/catch that logs and swallows (fire-and-forget; never blocks or
  fails the user's save).
- `saveValue(...)` gains `prevValue: PlacementValue | null` param. After the
  existing `firestoreSet` succeeds, call `appendHistory("save", value, prevValue, …)`.
- `deleteValue(...)` gains `prevValue: PlacementValue | null` param. After the
  delete succeeds (including the already-baseline no-op branch — that branch does
  NOT log, since nothing changed), call `appendHistory("delete", null, prevValue, …)`.

### Repository — `default-arrow-placement-repository.ts`

The repository reads the prior value itself so callers stay unchanged:

- `saveDefault(...)`: `const prev = this.getValue(gridMode, propType, motionType,
  placementKey, turns);` then `await this.persister.saveValue(..., prev);`
- `deleteDefault(...)`: same — read `prev` before delete, pass it through.

`PipelineEditorDock.svelte` and all other callers are untouched. Live preview
(`saveDefaultLocal` / `deleteDefaultLocal`) writes no history.

## UI — generalize, don't fork (never-hand-roll)

`ArrowAdjustmentHistory.svelte` is ~90% generic presentation (toggle, lazy list,
row markup, relative-time formatter, revert button, styles) wrapped around two
domain-specific functions: `loadHistory` (collection + query + mapping) and
`revertTo` (key parse + repo write).

1. **Extract** `AdjustmentHistoryPanel.svelte` (new, presentational) holding the
   toggle/list/row/time-format/revert-button/styles. Props:
   - `load: () => Promise<HistoryEntry[]>`
   - `onRevert: (entry: HistoryEntry) => Promise<void>`
   - `formatKey: (entry: HistoryEntry) => string`
   - `HistoryEntry` = `{ id, action, x, y, prevX, prevY, timestamp, updatedBy, label }`
     (a neutral shape both domains map into).
2. **Refactor** `ArrowAdjustmentHistory.svelte` into a thin wrapper that passes
   its existing global `load` + `revert` + key formatter to the panel. Behavior
   stays byte-identical — verified by the existing global flow.
3. **Add** `DefaultArrowAdjustmentHistory.svelte` (new wrapper):
   - `load`: query `default_arrow_adjustment_history` where `entryKey == <selected
     arrow's entryKey>` `orderBy timestamp desc` `limit 15`, map to `HistoryEntry`.
   - `onRevert`: re-apply the entry's produced state via the default repo — a
     `save` entry calls `saveDefault(...newX,newY)`; a `delete` entry calls
     `deleteDefault(...)`. Revert itself logs a fresh history row (append-only).
   - `formatKey`: `placementKey · turns`.
   - Props in: the selected arrow's `{gridMode, propType, motionType, placementKey,
     turns}` (the dock already derives all five via `defaultLookup`).

### Mount point

`DefaultArrowAdjustmentHistory` mounts inside `PipelineEditorDock.svelte`, shown
only when `editTarget === "default"` and an arrow is selected, bound to
`defaultLookup`. Collapsed by default; lazy-loads on expand (mirrors global).

## Firestore

### Rules (stricter than global — append-only per request)

```
match /default_arrow_adjustment_history/{entryId} {
  allow read:   if isAdmin();
  allow create: if isAdmin();
  allow update, delete: if false;   // immutable audit trail
}
```

### Composite index — `firestore.indexes.json`

```
{
  "collectionGroup": "default_arrow_adjustment_history",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "entryKey", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

## Revert semantics

Revert reproduces the state the chosen entry produced, it does not rewind:
- `save` entry → `saveDefault(grid, prop, motion, placementKey, turns, [newX, newY])`
- `delete` entry → `deleteDefault(grid, prop, motion, placementKey, turns)`

Both go through the normal write path, so each revert appends its own new history
row. History is never mutated or deleted.

## Testing

- **Unit (persister):** `saveValue` with a prev value writes one history doc with
  `action:"save"`, correct `new*/prev*/entryKey`; `deleteValue` writes
  `action:"delete"`, `new*` null. Already-baseline delete no-op writes nothing.
- **Unit (repository):** `saveDefault`/`deleteDefault` read the prior value and
  forward it to the persister.
- **Runtime:** select arrow → Default → nudge → Save → history row appears with
  prev→new; click revert on an older row → arrow returns to that value and a new
  row logs. Verified via Firestore query + DevTools (with permission).

## Files

**Create:**
- `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/AdjustmentHistoryPanel.svelte` — generic presentational panel (grep: no existing generic history panel; `ArrowAdjustmentHistory` is global-coupled).
- `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/DefaultArrowAdjustmentHistory.svelte` — default-domain wrapper.

**Modify:**
- `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts` — `appendHistory` + prev params.
- `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts` — read + forward prev value.
- `src/lib/features/create/shared/components/sequence-actions/ArrowAdjustmentHistory.svelte` — refactor to wrap `AdjustmentHistoryPanel`.
- `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte` — mount the default history panel.
- `firestore.rules` — new match block.
- `firestore.indexes.json` — new composite index.
