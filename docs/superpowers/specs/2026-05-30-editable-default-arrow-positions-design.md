# Editable Default Arrow Positions — Design

**Date:** 2026-05-30
**Status:** Design — awaiting review
**Author:** brainstormed with Austen

## Problem

The step-editor Inspect panel (`PictographInspectModal` → `PipelineEditorDock`) exposes
three writable tiers of the arrow-positioning cascade — **Global Override**, **Special
JSON**, **Prop Geometry** — each persisting to Firestore and editable live via WASD /
X-Y nudge. The fourth and lowest tier, **Default**, is displayed read-only in the
pipeline trace but has **no edit path**. Today the only way to change a default arrow
position is to hand-edit a static JSON file under
`static/data/arrow_placement/{box,diamond}/default/` and redeploy.

Austen wants to set a new default for a whole **motion class** (e.g. *1.5-turn Pro in
box mode*) directly from the Inspect panel, and wants this to work **on the road and
with collaborators** — meaning the default data must live in Firebase as the source of
truth, not in a checked-in file only a deploy can change.

## Scope (locked)

- **Breadth:** *whole motion class.* A default edit applies to **every** letter /
  sequence whose arrow resolves to the same Default lookup tuple. This is exactly what
  the Default tier already keys on — it carries no letter and no start/end location.
- **Canonical source:** **Firebase becomes canonical** for default positions. The
  static JSON demotes to an offline / pre-seed fallback.
- **Authoring:** admin-gated for now (matches the other tiers' `ADMIN_EMAIL` gate).
  Broadening to approved collaborators is a noted follow-up, not in this scope.

## The Default lookup key

From the read pipeline (`ArrowPlacer.getDefaultAdjustment`,
`arrow-placer.ts:180`), a default value is addressed by exactly four dimensions:

| Dimension | Example |
|---|---|
| `gridMode` | `box` |
| `motionType` | `pro` |
| `placementKey` | `pro_to_nonradial_layer3_alpha` |
| `turns` | `1.5` |

`placementKey` is itself derived (motionType + orientation layer + position suffix) by
`generatePlacementKey` (`arrow-placement-key-generator.ts`). Rotation direction (CW/CCW)
and start/end locations do **not** appear in the key — they drive the directional-tuple
rotation applied *after* lookup. The stored value is therefore the **base** adjustment
(pre-rotation), identical in kind to what every other tier stores.

## Storage granularity decision (key divergence from the other tiers)

The three existing Firestore tiers store **one doc per key** because they are *sparse*
overrides — a handful of admin edits. The Default tier is *dense*: it is the entire
baseline dataset (hundreds of `placementKey × turns` entries across 5 motion types × 2
grid modes). Mirroring doc-per-key here would force every client to read hundreds of
docs on cold load — strictly worse than today's 5-files-per-grid-mode lazy fetch.

**Decision:** store the Default tier as **one Firestore doc per `{gridMode}_{motionType}`**
— 10 docs total, a 1:1 mirror of the 10 static JSON files. Each doc holds the full
`placementKey → { turns → [x, y] }` map, the same shape `ArrowPlacer` already builds
in memory.

```
Collection: default_arrow_adjustments
Doc ID:     box_pro            (gridMode "_" motionType)
Doc body:   {
              gridMode: "box",
              motionType: "pro",
              placements: {
                "pro_to_nonradial_layer3_alpha": { "1.5": [-15, 0], "2": [-10, -35], ... },
                "pro_to_layer1_alpha":           { "1.5": [-35, 145], ... },
                ...
              },
              updatedBy: "austencloud@gmail.com",
              updatedAt: <serverTimestamp>
            }
```

Benefits: preserves the lazy-per-grid-mode load profile (read only the docs for the
grid mode in play), the seed is a trivial file→doc copy, and an edit is a single nested
`placements.{placementKey}.{turns}` merge write. This is a deliberate extension of the
existing tier pattern (reuse the repository/persister/state/singleton *structure*),
differing only in storage granularity because a dense canonical dataset has different
read economics than a sparse override set.

## Architecture

A new tier module mirroring the existing `special-override/` layout:

```
src/lib/shared/pictograph/arrow/positioning/default-override/
  domain/
    DefaultArrowPlacement.ts          # types + doc-id helper + zod schema
  state/
    DefaultArrowPlacementState.svelte.ts   # in-memory placements map, version-bumped
  services/
    default-arrow-placement-persister.ts   # Firestore read/write/subscribe (10 docs)
    default-arrow-placement-repository.ts   # admin-gated save/delete, live cache
    default-arrow-placement-singleton.ts    # getDefaultOverrideRepository() + init
```

### Components & responsibilities

- **`DefaultArrowPlacementPersister`** — Firestore I/O against
  `default_arrow_adjustments`. `loadAll()` fetches the 10 docs; `save()` merges a single
  `placements.{placementKey}.{turns}` field into the `{gridMode}_{motionType}` doc;
  `delete()` removes that nested field (revert to JSON baseline); `subscribe()` streams
  doc changes via `onSnapshot`. Mirrors `SpecialArrowPlacementPersister` structure.
- **`DefaultArrowPlacementState`** — holds the merged placements map keyed
  `[gridMode][motionType]`, exposes `getMap(gridMode, motionType)`, `getValue(key)`,
  `setValue(...)`, `removeValue(...)`. Increments `globalAdjustmentVersion` on change so
  the renderer + dock react (same reactivity bus the other tiers use).
- **`DefaultArrowPlacementRepository`** — admin-gated (`ADMIN_EMAIL`) `saveDefault` /
  `deleteDefault` (Firestore) and `saveDefaultLocal` / `deleteDefaultLocal` (in-memory
  live preview). Same shape as `SpecialArrowPlacementRepository`.
- **`default-arrow-placement-singleton.ts`** — `getDefaultOverrideRepository()` +
  `initializeDefaultOverrides()` + dispose, identical lifecycle to
  `prop-geometry-singleton.ts`. Initialized alongside the other tier singletons.

### Read-path integration (the canonical seam)

`ArrowPlacer` already builds `allPlacements[gridMode][motionType][placementKey][turns]`
from the static JSON. We make it **prefer the Firestore map when present**:

1. In `ArrowPlacer`'s grid-mode load path (around `loadJsonFile` /
   `ensureGridModeLoaded`, `arrow-placer.ts:120-175`), for each `motionType` consult
   `getDefaultOverrideRepository()?.getMap(gridMode, motionType)` first. If it returns a
   map, use it as the base for that `[gridMode][motionType]` slot; otherwise fall back
   to fetching the static JSON file (current behavior).
2. The lookup at `getDefaultAdjustment` (`arrow-placer.ts:180`) is **unchanged** — it
   keeps reading from `allPlacements`, now sourced Firestore-first.
3. On a live Firestore update (`onSnapshot`) or a local preview edit, invalidate
   `allPlacements[gridMode][motionType]`, bump `globalAdjustmentVersion`, and
   `pictographPreparer.clearCache()` so the next render repopulates — same live-preview
   loop the other tiers use.

This keeps the cascade order intact (Global → Special → PropGeometry → Default) and the
directional-tuple rotation downstream untouched. Only the Default tier's **backing
store** changes from static-file-only to Firestore-with-file-fallback.

> **Note on offline/guest correctness:** because defaults underpin *every* arrow, the
> Firestore read must succeed for guests and pre-auth renders. The static JSON remains
> the always-present fallback, so a Firestore miss or offline state degrades gracefully
> to the last shipped baseline rather than breaking rendering.

### Write-path integration (`PipelineEditorDock.svelte`)

The dock already types `PipelineTier` with `"default"` and `tierLabel()` already handles
it (`PipelineEditorDock.svelte:211`). Required changes, each mirroring the existing
`special-json` branch:

1. Add `{ value: "default", label: "Default" }` to `tierOptions` (line 76-80) and widen
   the `editTarget` / `selectEditTarget` union to include `"default"`.
2. Add a `defaultOverrideKey` `$derived` (gridMode + motionType + placementKey + turns)
   sourced from `diagnostics.default` — see *Diagnostics extension* below.
3. Add `handleDefaultSave`, `handleDefaultNumericUpdate`, `handleDefaultDelete`, and a
   `syncNumericInputs` branch — direct analogues of the special-json handlers, calling
   the new repository's `saveDefault` / `saveDefaultLocal` / `deleteDefault`.
4. Wire the existing Save / WASD / Ctrl+S / Revert affordances to the `default` branch
   (the `handleSave` / `handleDelete` / `handleNumericChange` switch statements).

No new UI primitives — the segmented control, X/Y inputs, WASD nudge, and save button
are reused as-is.

### Diagnostics extension

The dock builds tier keys from the `PipelineDiagnostics` object. The `default` entry
must expose the lookup identity so the dock can address the right Firestore field. If
`diagnostics.default` does not already carry `placementKey` + `turns` + `motionType` +
`gridMode`, extend the diagnostics producer (the default-tier branch of
`ArrowAdjustmentCalculator.getDiagnostics`) to include them. This is the only change
outside the new module and the dock.

### One-time migration / seed script

`scripts/seed-default-arrow-placements.mjs` (Admin SDK, run once, idempotent):

1. Read all 10 static JSON files under `static/data/arrow_placement/{box,diamond}/default/`.
2. For each, write a `default_arrow_adjustments/{gridMode}_{motionType}` doc with the
   full `placements` map, `updatedBy: "seed"`, `updatedAt: serverTimestamp()`.
3. Re-runnable: a re-seed overwrites the docs back to the JSON baseline (a clean reset
   path). Edits made via the dock that should become the new committed baseline get
   exported back into the JSON by a companion `export-default-arrow-placements.mjs` (read
   the 10 docs, write the 10 JSON files) so the repo stays the long-term canonical record
   and the diff is reviewable/committable — closing the verify-at-canonical-source loop.

### Firestore rules

Add to `firestore.rules`, modeled on `prop_geometry_adjustments` (which uses
`allow read: if true` precisely because rendering needs it pre-auth):

```
// Default arrow placements — canonical baseline arrow positions.
// Readable by all (every arrow render needs them, incl. guests / pre-auth),
// writable by admins. Doc ID format: {gridMode}_{motionType}.
match /default_arrow_adjustments/{docId} {
  allow read: if true;
  allow write: if isAdmin();
}
```

## Error handling

- **Firestore read failure / offline:** persister `loadAll()` swallows permission/offline
  errors and returns empty (as `SpecialArrowPlacementPersister.loadAll` does); ArrowPlacer
  then uses the static JSON fallback. Rendering never breaks.
- **Save failure:** dock surfaces it via the existing `saveState` reset + logged error
  (same as `handleSpecialJsonSave`'s catch); the in-memory preview value remains so the
  user can retry.
- **Non-admin write attempt:** repository throws before touching Firestore, matching the
  other tiers' admin gate.

## Testing

- **Unit — doc-id helper:** `generateDefaultDocId(gridMode, motionType)` produces
  `box_pro` etc.; `placements.{key}.{turns}` field path builder is correct.
- **Unit — seed flatten:** given a known JSON fixture, the seed produces the expected doc
  body (assert `pro_to_nonradial_layer3_alpha["1.5"]`).
- **Unit — read precedence:** with a Firestore map present for `box/pro`, ArrowPlacer
  returns the Firestore value; with none, it returns the static JSON value (fallback).
- **Round-trip:** `saveDefaultLocal` updates the in-memory map → `getDefaultAdjustment`
  returns the new base → directional-tuple rotation still applied downstream (the
  displayed `base → rotated` pair updates).
- **Admin gate:** non-admin `saveDefault` throws; no Firestore write occurs.

## Out of scope / follow-ups

- Broadening write access from `ADMIN_EMAIL` to approved collaborators (role check) so
  others can author on the road — noted, not built here.
- A bulk "diff vs JSON baseline" review UI. The `export-...mjs` script covers the commit
  path for now.
- Migrating the *other* tiers' granularity — unchanged.

## Files

**Create:**
- `src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts`
- `src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts`
- `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts`
- `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts`
- `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-singleton.ts`
- `scripts/seed-default-arrow-placements.mjs`
- `scripts/export-default-arrow-placements.mjs`

**Modify:**
- `src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts` (Firestore-first load)
- `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte` (4th tier)
- `ArrowAdjustmentCalculator` diagnostics (expose default placementKey/turns) — only if not already present
- `firestore.rules` (`default_arrow_adjustments` match)
- the tier-singleton init site (register `initializeDefaultOverrides()` alongside the others)
