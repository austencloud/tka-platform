# Founding Smart Collections — Design

**Date:** 2026-07-07
**Status:** Design (approved-in-brainstorm; pending spec review)
**Author:** Austen + Claude

## Goal

Surface the three printed T&D decks — **TKA 1: Learning Letters**, **TKA 2:
Writing Words**, **TKA 3: Speaking Sentences** — as read-only, platform-owned
("founding") collections in every user's Library, defined by browse-filter
**rules** rather than pinned membership. They render through the existing Smart
Collection machinery over the community pool.

## Why rules work here (the key finding)

The three decks are already released as TnD-mode deck manifests
(`deckReleases/counter/manifests/{004,007,008}`, project `the-kinetic-alphabet`).
Their recipes are **identical on every axis except turn patterns**:

| Deck | Families | Grid | Register | Reversal | Turn patterns | Cards |
|---|---|---|---|---|---|---|
| TKA 1 (deck 4) | all 6 | diamond | radial | continuous | *(base, 0 turns)* | 19 |
| TKA 2 (deck 7) | all 6 | diamond | radial | continuous | `1\|1, 0\|1, 1\|0` | 57 |
| TKA 3 (deck 8) | all 6 | diamond | radial | continuous | `0.5\|0.5, 0\|0.5, 0.5\|0, 1\|0.5, 0.5\|1` | 95 |

The turn split is **base / whole-turn / half-turn**, which maps exactly onto the
canonical difficulty level (`canonical-tnd-pool.ts:66-68`): 0 turns → level 1,
whole turns end radial → level 2, half turns end non-radial → level 3. Browse can
filter difficulty and a turn ceiling, so a rule reproduces each deck:

- Card counts prove the partition: `19 = 19×1`, `57 = 19×3`, `95 = 19×5`.
- Over the turn domain `{0, 0.5, 1}` (i.e. `MAX_TURN_INTENSITY ≤ 1`), difficulty
  level cleanly separates all three with no overlap.

### The canonical alphabet already lives in the community pool

`BrowseModule.svelte:87` wires `extraCommunitySequences: loadCanonicalTnDSequences`.
That pool (`canonical-tnd-pool.ts`) generates the full T&D alphabet — 6 families ×
49 turn combos — as first-class `SequenceData` browse citizens (each variation a
distinct id `${seedId}__t_${pattern}`, dated 2022-03-27, real computed level). So
a `source: "community"` Smart Collection genuinely sees these sequences. No
Firestore upload, no `publicSequences` docs — appended to the community pool at
load.

### The isolation axis (correctness lynchpin)

The community pool mixes the alphabet **with user sequences**. `DIFFICULTY 2 +
≤1 turns` alone would also match any user's level-2, ≤1-turn sequence, so the
production count would exceed 57. The canonical pool currently stamps **no
author** (`filterByAuthor` = exact `seq.author === value`,
`browse-filter.ts:433`). Fix: stamp a reserved author on the canonical cards and
fence each rule to it. This isolates the alphabet from user content **and** gives
a handle on the separate gallery-flooding concern (alphabet becomes
filterable/hideable by author).

## Approach (chosen)

**Config-defined founding collections + synthetic read-only rail cards.** The
three collections are declared in a client config module — not per-user Firestore
docs. Because they are baked into the client, every user gets them automatically:
"public to all" by construction, zero seeding, zero security-rule changes. They
reuse the existing `SmartCollectionDetailView` (ephemeral engine over the
community source) unchanged except for a read-only branch.

Rejected alternatives (from brainstorm):
- **Deck-kind collection referencing the manifest** (Fork B): correct but heavier
  (new kind, manifest resolver, synthetic cards) and unnecessary once separability
  is proven.
- **Per-user seeded system docs** (mirror Favorites): writes 3 docs into every
  user's library, drifts on re-release, needs reconciliation. Founding decks are
  not user data.
- **Materialize cards as library sequences**: duplicates data, pollutes libraries.

## Components / Changes

### 1. `canonical-tnd-pool.ts` — stamp a canonical author

**File:** `src/lib/features/browse/gallery-home/canonical-tnd-pool.ts`

Add an exported constant and stamp it on every generated sequence:

```ts
/** Reserved author for the defined T&D alphabet, so it is filterable/isolatable
 *  from user-submitted community sequences. */
export const CANONICAL_TND_AUTHOR = "T&D Alphabet";
```

In `resolvePool()`, add `author: CANONICAL_TND_AUTHOR` to the
`updateSequenceData(seq, { ... })` patch (alongside `id`, `dateAdded`,
`birthday`, `level`). No other behavior changes.

### 2. `founding-collections.ts` — the config (new)

**File:** `src/lib/features/browse/collections/config/founding-collections.ts`

```ts
import type { SmartFilterSpec } from "$lib/shared/library/domain/models/collection";
import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
import { CANONICAL_TND_AUTHOR } from "$lib/features/browse/gallery-home/canonical-tnd-pool";

export interface FoundingSmartCollection {
  /** Stable id, always prefixed "founding:". */
  id: string;
  name: string;
  description: string;
  /** FontAwesome class, e.g. "fa-graduation-cap". */
  icon: string;
  /** Cached member count for the rail card (variation count). */
  sequenceCount: number;
  filterSpec: SmartFilterSpec;
}

const AUTHOR_FILTER = {
  key: "author",
  type: BrowseFilterType.AUTHOR,
  value: CANONICAL_TND_AUTHOR,
  label: CANONICAL_TND_AUTHOR,
  chipColor: "var(--semantic-info)",
};

const CEIL_1 = {
  key: "max_turn_intensity",
  type: BrowseFilterType.MAX_TURN_INTENSITY,
  value: 1,
  label: "≤1 turns",
  chipColor: "var(--semantic-success)",
};

const diff = (level: 1 | 2 | 3, label: string) => ({
  key: "difficulty",
  type: BrowseFilterType.DIFFICULTY,
  value: String(level), // filterByDifficulty parseInt()s the value → numeric only
  label,
  chipColor: "var(--semantic-warning)",
});

export const FOUNDING_SMART_COLLECTIONS: FoundingSmartCollection[] = [
  {
    id: "founding:tka-1",
    name: "TKA 1: Learning Letters",
    description: "The 19 base T&D motions — no turns.",
    icon: "fa-graduation-cap",
    sequenceCount: 19,
    filterSpec: {
      source: "community",
      filters: [AUTHOR_FILTER, diff(1, "Level 1")],
      sortMethod: "level", // BrowseSortMethod.DIFFICULTY_LEVEL string value
      sortDirection: "asc",
    },
  },
  {
    id: "founding:tka-2",
    name: "TKA 2: Writing Words",
    description: "Whole-turn variations of the base motions.",
    icon: "fa-pen-nib",
    sequenceCount: 57,
    filterSpec: {
      source: "community",
      filters: [AUTHOR_FILTER, diff(2, "Level 2"), CEIL_1],
      sortMethod: "level",
      sortDirection: "asc",
    },
  },
  {
    id: "founding:tka-3",
    name: "TKA 3: Speaking Sentences",
    description: "Half-turn variations of the base motions.",
    icon: "fa-comments",
    sequenceCount: 95,
    filterSpec: {
      source: "community",
      filters: [AUTHOR_FILTER, diff(3, "Level 3"), CEIL_1],
      sortMethod: "level",
      sortDirection: "asc",
    },
  },
];

export function isFoundingId(id: string): boolean {
  return id.startsWith("founding:");
}

export function getFoundingCollection(id: string): FoundingSmartCollection | undefined {
  return FOUNDING_SMART_COLLECTIONS.find((c) => c.id === id);
}
```

> **`sortMethod` token confirmed:** `BrowseSortMethod.DIFFICULTY_LEVEL = "level"`
> (`browse-enums.ts:11`); the spec persists `String(engine.sortMethod)` and
> replays via `engine.setSort(spec.sortMethod as BrowseSortMethod, dir)`, so
> `"level"` round-trips correctly. `sortDirection` is `"asc" | "desc"`.

### 3. Synthetic-collection adapter

**File:** same config module (or a sibling `founding-collection-adapter.ts`).

A pure function that maps a `FoundingSmartCollection` → a `LibraryCollection`-
shaped object for the rail/detail view. Never persisted.

```ts
export function toSyntheticCollection(f: FoundingSmartCollection): LibraryCollection {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    ownerId: "system",
    sequenceIds: [],
    sequenceCount: f.sequenceCount, // variation count (57), per decision A
    icon: f.icon,
    isPublic: true,
    sortOrder: -1, // founding decks sort above user collections
    kind: "smart",
    systemType: "founding",
    filterSpec: f.filterSpec,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as LibraryCollection;
}
```

> `systemType: "founding"` is a new `SystemCollectionType` member. The type is a
> plain string union at `collection.ts:32` (`export type SystemCollectionType =
> "favorites"`); change to `"favorites" | "founding"`. It is display/gating
> metadata only (never seeded like `favorites`). Confirm the full
> `LibraryCollection` field list during implementation and fill every required
> field (the cast documents intent, not an excuse to omit required fields).
> `isReadonly` is a `CollectionCard` prop the panel passes, not a model field —
> the rail passes `isReadonly={true}` for founding cards.

### 4. Rail — `MyCollectionsPanel.svelte`

**File:** `src/lib/features/browse/collections/components/MyCollectionsPanel.svelte`

- Prepend the three founding cards (from `FOUNDING_SMART_COLLECTIONS.map(toSyntheticCollection)`)
  above the user's own collections.
- Render with the existing `CollectionCard`, passing `isReadonly={true}`. Founding
  cards show the smart badge plus a distinct founding marker (reuse the existing
  smart wand badge; optionally a "Founding" word — decided during UI pass, must not
  introduce layout shift per `no-layout-shift.md`).
- Opening a founding card routes to `SmartCollectionDetailView` exactly as a smart
  collection does. The existing `isSmart(id)` routing check
  (`MyCollectionsPanel.svelte:76`) must also treat founding ids as smart (they are
  `kind: "smart"`).

### 5. Detail view — `SmartCollectionDetailView.svelte`

**File:** `src/lib/features/browse/collections/components/SmartCollectionDetailView.svelte`

Add a **founding branch** to the collection-loading effect:

- If `isFoundingId(collectionId)`: set `collection = toSyntheticCollection(getFoundingCollection(id)!)`
  synchronously (no `subscribeToCollection`, no Firestore).
- Everything downstream is unchanged: `specSignature` effect builds the ephemeral
  community engine, `applySpecToEngine` replays the rule, `BrowsePanel` renders
  read-only (`showToolbar={false} showFilterBar={false} showSidebar={true}`), the
  self-heal count write-back is **skipped** for founding ids (no doc to write).
- Gate mutations: when `isFoundingId`, hide/disable **rename**, **delete**, and
  **Edit rule** (the rule is platform-fixed). The options menu shows nothing
  mutating (or is omitted entirely).

No changes to the ephemeral-engine, viewer-open (`handleSelect` → `openViewer`),
or variation-picker paths — they already work for community sequences.

### 6. Count-check test

**File:** `tests/unit/browse/founding-collections.test.ts`

For each founding collection, run its `filterSpec` through the pure
`filterPoolBySpec` (the non-engine derivation in `smart-filter-spec.ts`) over the
resolved canonical T&D pool (author-stamped), and assert the sequence count:

- `founding:tka-1` → **19**
- `founding:tka-2` → **57**
- `founding:tka-3` → **95**

The test loads the real canonical pool (`loadCanonicalTnDSequences`) so it
validates the difficulty-level assignment, the author stamp, and the turn ceiling
end-to-end. If any count is off, the rule (or the level/author assumptions) is
wrong — do not adjust the assertion to match; fix the cause.

## Data flow

```
MyCollectionsPanel
  → FOUNDING_SMART_COLLECTIONS.map(toSyntheticCollection)  // synthetic rail cards
  → open founding:tka-2
     → SmartCollectionDetailView (founding branch: config object, no Firestore)
        → createBrowseEngine({ source: "community", sections: true })
           → community pool = user public sequences ⊕ canonical T&D alphabet
             (extraCommunitySequences, author-stamped)
        → applySpecToEngine: AUTHOR="T&D Alphabet" + DIFFICULTY 2 + MAX_TURN ≤1
        → engine.resultCount === 57  (rail card shows 57)
        → grid word-collapses to 19 word-cards, each holding its 3 variations
        → tap card → openSequenceViewer (animate / practice / export)
```

## Read-only contract

Founding collections are immutable to users:
- No rename / delete / edit-rule (gated in the detail view).
- Not offered in the add-to-collection picker (they are `systemType: "founding"`;
  the picker already excludes smart + system collections — confirm founding is
  excluded).
- No publish/unpublish (public by construction).
- `collectionsState.toggle` / `removeSequenceFromCollection` never target them (no
  UI path reaches those for founding ids).

## Edge cases

- **Difficulty value format:** `filterByDifficulty` does `parseInt(filterValue)`;
  a string name like `"beginner"` yields `NaN` → no filtering. Founding rules use
  numeric-string values (`"1"`, `"2"`, `"3"`). The count-check test catches a
  regression here.
- **Rail count vs grid cards:** rail shows 57 (variation/sequence count); grid
  shows 19 word-collapsed cards. Intentional and documented (decision A: variations
  are the meaningful unit; words are a reduction). `engine.resultCount` already
  counts variations, so no special code.
- **Reduced motion / theming:** inherited from `SmartCollectionDetailView` and
  `BrowsePanel`; no new handling.
- **Pool load failure:** `loadCanonicalTnDSequences` already retries on rejection;
  a transient failure yields an empty/partial grid, same as any community view.

## Out of scope (flag, do not build)

- **Gallery-flooding remedy.** Stamping the author makes the alphabet
  *filterable/hideable*, but deciding whether to hide it from the default
  community feed (or separate deck generation from saved gallery items) is a
  separate product decision. Not addressed here beyond providing the author handle.
- **Admin-editable founding sets.** Config-baked means changing the set needs a
  deploy. Upgrade hook: promote `FOUNDING_SMART_COLLECTIONS` → a global
  `systemCollections` Firestore doc read by the rail. YAGNI for three fixed decks.
- **Deck print order.** Founding views sort by the rule's sort (difficulty asc),
  not the manifest's printed order. These are browsable views, not the print
  artifact.
- **Recipe-kind (generative) collections.** The broader "derived collection with
  pluggable derivation kinds" unification is a roadmap successor, not this spec.

## Files touched (summary)

| File | Change |
|---|---|
| `src/lib/features/browse/gallery-home/canonical-tnd-pool.ts` | Export `CANONICAL_TND_AUTHOR`; stamp `author` on each pool sequence |
| `src/lib/features/browse/collections/config/founding-collections.ts` | **New** — config, adapter, `isFoundingId`/`getFoundingCollection` |
| `src/lib/shared/library/domain/models/collection.ts` | Add `"founding"` to `SystemCollectionType` |
| `src/lib/features/browse/collections/components/MyCollectionsPanel.svelte` | Prepend founding rail cards; route founding ids as smart |
| `src/lib/features/browse/collections/components/SmartCollectionDetailView.svelte` | Founding branch (config load, mutation gating, skip count write-back) |
| `tests/unit/browse/founding-collections.test.ts` | **New** — count-check 19/57/95 |
```
