# MandalaLoader — Design

**Date:** 2026-06-26
**Status:** Approved (design), pending spec review
**Author:** Claude + Austen

## Problem

The modern app boot loader (`src/app.html`, lines ~850–874) shows 23 "Sims-style
flavor text" lines — `Negotiating with gravity…`, `Charging the glow sticks…`,
`Debating prospin vs inspin…`, plus a literal `Reticulating flower patterns…`
(a 1996 SimCity in-joke). It is one gag (mundane verb + grand noun) repeated 23
times. It reads cheesy, none of the lines describe real work, and it lands worst
on slow loads — exactly when a wink makes the app feel both broken and smug.

Austen wants the loading experience to instead show a beautiful TKA mandala that
undulates and morphs over time, cycling through fresh sequences generated from
parameters he chooses.

## Scope

Two deliverables:

1. **De-cheese the cold boot** (`app.html`): remove the 23-line shuffle, keep the
   real resource-tracking bar, show one quiet line.
2. **`MandalaLoader`**: a reusable in-app loading component that renders a live,
   undulating mandala and crossfades through a small, locally-generated pool of
   sequences. This is the new build.

### Surface decision (locked)

The live morph targets **post-hydration** in-app waits, not the cold boot. The
`app.html` boot loader runs as inline vanilla JS *before* SvelteKit hydrates, so
`SequenceMandala` (a Svelte component whose code is not yet downloaded) cannot run
there. It is also usually up under a second — too short to watch a mandala
undulate. The cold boot therefore stays a simple bar; the mandala lives where a
wait lasts seconds and the app is already hydrated.

First adopters: the **Create module load** screen and a new **`LoadingGate`
`variant="mandala"`**. Export already renders its own `SequenceMandala`
centerpiece (`MandalaExportTakeover`) — leave it. Other surfaces opt in by
rendering the component.

## What already exists (reuse, do not rebuild)

| Need | Reuse | Path |
|---|---|---|
| Render a mandala from a sequence | `SequenceMandala.svelte` | `src/lib/shared/mandala/components/SequenceMandala.svelte` |
| Undulation (8 easings), rotation, shape morph | `SequenceMandala` props (`animate`, `animateEasing`, `animateRotation`, `pathShape`) | same |
| Flow-color palette cycling | helpers in `MandalaViewerController` (`PRESET_COLORS`, `sampleGradient`, gradient compute) | `src/lib/shared/sequence-viewer/state/mandala-viewer-controller.svelte.ts` |
| Client-side generation (sync, ~10–100ms, no network) | `GenerationOrchestrator.generateSequence()` → `SequenceBuilder.build()` | `src/lib/shared/create/services/generation-orchestrator.ts` |
| Local persistence | `TKADatabase` (Dexie) + `dexie-persistence-service` | `src/lib/shared/persistence/database/tka-database.ts` |
| Layer crossfade | Svelte built-in `fade` from `svelte/transition` | framework |
| Seeded RNG / sampling | `makeRng`, `mintSeed` | `src/lib/shared/foundation/utils/seeded-rng.ts` |

The **only genuinely new** behavior is auto-cycling/crossfading through a
*collection* of sequences. `calculateMorphed()` morphs the path *shape* within one
sequence (arc↔linear↔concave); it does not interpolate between two different
sequences' geometries (different point counts). Cross-sequence transition is a
**crossfade of two stacked layers**, not a path morph.

## Architecture

### New files

1. **`src/lib/shared/mandala/components/MandalaLoader.svelte`** — the loader.
2. **`src/lib/shared/mandala/services/mandala-pool.svelte.ts`** — the pool service
   (Dexie-backed store, generation top-up, sampling). A `$state`-backed module
   singleton (per `state-management` conventions).
3. **`src/lib/shared/mandala/domain/mandala-loader-config.ts`** — the generation
   **recipe** and the **look** defaults. Austen's knobs, one editable file.
4. **`src/lib/shared/mandala/data/mandala-seed-pool.ts`** — a baked seed of ~6
   pre-generated sequences (plain `SequenceData`) for the first-ever cold load.
5. **`src/lib/shared/mandala/domain/mandala-palette.ts`** — flow-palette helpers
   extracted from `MandalaViewerController` (`PRESET_COLORS`, `sampleGradient`,
   `lerpColor`, `createFlowGradient(preset, phase)`), imported by both the
   controller and the loader. Targeted refactor so the color math is not
   duplicated.

### Modified files

- **`tka-database.ts`** + **`database_constants.ts`** — bump `DATABASE_VERSION`
  6→7; add store `generatedMandalaPool`: `{ id, sequence, generatedAt }`, indexed
  `++id, generatedAt`.
- **`mandala-viewer-controller.svelte.ts`** — import the extracted palette helpers
  from `mandala-palette.ts` instead of holding them inline. Behavior unchanged.
- **`src/app.html`** — replace the 23-line flavor array + Fisher-Yates shuffle
  with a single quiet line; keep the real PerformanceObserver bar and the
  `__tkaReadyMessages` (those read fine).
- **`LoadingGate.svelte`** — add `variant="mandala"` rendering `MandalaLoader`.
- **Create module load** — render the mandala loader (exact insertion point —
  `ModuleRenderer` / `ModuleSkeleton` for the Create chunk vs `CreateModule`'s
  internal bar — confirmed at plan time by reading those files).

### `MandalaLoader.svelte`

Props (all optional, default to the loader config):
- `recipe?` — generation recipe override.
- `look?` — undulation easing, rotation speed, depth, preset selection.
- `dwellMs?` — time per sequence before crossfade (default ~5000).
- `crossfadeMs?` — dissolve duration (default ~900).

Behavior:
- Holds `current` and `next` sequences drawn from `mandalaPool.sample()`.
- Renders two stacked `SequenceMandala` layers (`animate`, gradient from the flow
  palette). Every `dwellMs`, crossfade `current`→`next` via Svelte `fade`, promote
  `next`→`current`, draw a new `next`.
- During the crossfade the **outgoing layer is a frozen frame** (its rAF stopped)
  while the incoming layer animates — caps the two-layer cost at one animated
  mandala + one static bitmap.
- A small `$state` `phase` advances per frame to drive flow-color; gradient passed
  to `SequenceMandala` (reusing `createFlowGradient`).
- Per-draw the color **preset is randomized** for variety (within the look config's
  allowed set).

### `mandala-pool.svelte.ts`

```
sample(): SequenceData            // random draw; falls back to seed when pool is cold
warm(): Promise<void>             // read Dexie pool into memory on first use
topUp(): void                     // idle-time generation (post first paint)
count(): number
```

Lifecycle:
- **Warm:** on first `sample()`, read the Dexie store into memory. If the store has
  fewer than a floor (e.g. < 6), seed from `mandala-seed-pool.ts`.
- **Top-up:** after first paint, on `requestIdleCallback` (timeout fallback),
  generate 2–3 sequences via `GenerationOrchestrator.generateSequence()` using the
  recipe, append to Dexie, and **drop oldest** beyond a cap (~40). This feeds the
  *next* load, so it never contends with the boot it is covering. Generation is
  synchronous (~10–100ms each); time-slice across idle callbacks so a batch never
  blocks a frame.
- **Sample:** random pick from the in-memory pool.

SSR-guarded: Dexie and generation are browser-only; the service no-ops under SSR
and the component renders nothing until mounted.

### The recipe (Austen's knob — recommended defaults)

LOOP sequences produce symmetric petal mandalas (a mandala is the sequence's
tip-path; LOOP types repeat with rotation/mirror, which reads as symmetry). The
recommended default recipe favors them:

```ts
export const MANDALA_LOADER_RECIPE = {
  loop: { type: 'rotated' },   // rotated or mirrored — exact LOOPType enum value
                               // resolved against SequenceBuilder LoopOptions at plan time
  length: 8,                   // 8–16 range, varied per draw
  constraintPreset: 'smooth',
  level: 2,                    // 2–3
};
```

Flagged for review: set these as you like — this is the "parameters I choose."
If a plain freeform mandala reads better than LOOP symmetry, drop `loop` and keep
`length` + `constraintPreset` only.

### The look (Austen's knob — recommended defaults)

```ts
export const MANDALA_LOADER_LOOK = {
  animateEasing: 'breathe',   // or 'tidal'
  animateRotation: 30,        // slow degrees/cycle
  animatePeriod: 6,           // seconds/undulation
  depth: 100,
  presets: ['aurora', 'twilight', 'ice', 'ember'],  // randomized per draw
  lineWeight: 2.5,
};
```

## Edge cases

- **`prefers-reduced-motion`** → render a single static mandala (`animate=false`,
  no crossfade, no color cycling). Required by `no-layout-shift` / motion rules and
  matches every other loader in the app.
- **Empty / cold pool** → baked seed (`mandala-seed-pool.ts`).
- **Generation failure** (beam search finds no path) → caught in `topUp`, skipped,
  pool keeps its existing entries; never surfaces to the user.
- **No layout shift** → the loader renders into a fixed-size box; the mandala fills
  it. No reflow on sequence swap (crossfade is opacity-only).

## Performance

- One animated `SequenceMandala` ≈ 15–20ms/frame at 60fps with glow (measured in
  the existing renderer). Two-layer cost is bounded by freezing the outgoing layer
  during crossfade.
- Top-up generation runs post-first-paint on idle, for the next load — zero
  contention with the current wait.
- Pool cap ~40 keeps Dexie reads and memory trivial.

## Testing

- **Pool service** (unit): seed fallback when cold; append + drop-oldest at cap;
  `sample()` returns a pool member; SSR no-op. (Generation is mocked.)
- **Palette extraction** (unit): `createFlowGradient` output matches the
  pre-refactor controller output for a set of (preset, phase) pairs — guards the
  refactor.
- **MandalaLoader** (component): renders a mandala from a stub pool; advances to
  `next` after `dwellMs`; reduced-motion renders one static layer with no
  crossfade.
- Skip: visual exactness of the mandala itself (covered by existing
  `SequenceMandala` behavior).

## Reuse-vs-new ledger (never-hand-roll)

- **Reuse:** `SequenceMandala`, its undulation/rotation, `GenerationOrchestrator`,
  Dexie persistence, Svelte `fade`, seeded-RNG utils.
- **Extract + share:** flow-palette helpers (out of the viewer controller).
- **New:** `MandalaLoader.svelte`, `mandala-pool.svelte.ts`, one Dexie store, the
  baked seed, two config files.

## Out of scope (future)

- **Firebase-collective pool** — a shared, crowd-grown pool. The `PoolSource`
  shape (`sample()`) is kept clean so a `FirebasePoolSource` can drop in later
  without touching `MandalaLoader` or the crossfade.
- Ambient/idle "screensaver" use of the same component.
