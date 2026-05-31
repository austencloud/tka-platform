# Worker Front-Render Parity — Design

**Date:** 2026-05-31
**Status:** Active (approved 2026-05-31)
**Validation surface:** `/test/card-back-parity` → "Front (worker vs main)" mode

## Goal

Off-thread, multi-core pictograph **card-front** rendering that is pixel-parity
with the main-thread render, proven green and fast in the existing parity
harness — **before** any re-integration into the deck releaser / print modal.

The prior attempt was wired straight into the program and failed repeatedly
because the worker render graph transitively pulled browser-only modules
(`$env/dynamic/public`, then firebase/firestore's `window`-using `fetcher.js`).
It was reverted to the proven main-thread path (commit context: PrintCardRenderer
/ PrintPreviewPages reverted; posthog lazy-`$env` fix kept). This design isolates
the worker path on the harness and makes it correct there first.

## Blocker analysis (grounded)

- The **pure render pipeline is already worker-safe**: canvas factories branch to
  `OffscreenCanvas` in worker scope (`create-render-canvas.ts:4`,
  `canvas-2d-direct-renderer.ts:90`, `layer-compositor.ts:81` all guard with
  `typeof OffscreenCanvas`), and the SVG decode path is already solved by the
  `card-asset-bundle` seeding (worker `createImageBitmap(svgBlob)` fails on the
  app's dimensionless SVGs, so the main thread snapshots transferable
  `ImageBitmap[]` and seeds each worker).
- The **entire client-only reach** comes from arrow override resolution. The
  worker path `composeSequenceImage → renderPictographWithLayerCompositor →
  import(pictograph-preparer) → arrowLifecycleManager → arrow-placer /
  arrow-adjustment-calculator` statically imports the 4 override **singletons**,
  which statically import the **repos + persisters**:
  - repos → `authState` → posthog → `$env/dynamic/public` (crashes worker eval).
  - persisters → `getFirestoreInstance` → firebase/firestore → `window` /
    `fetcher.js` (crashes worker eval).
  Merely *importing* a singleton module drags the whole client graph in; init
  never runs in the worker, but the static import is enough to crash it.
- The 4 override **`*State` classes are import-clean** (verified: no firebase /
  auth / posthog / `$env` / window / document). The worker can hydrate them
  directly.

## Architecture

Three parts. Parts 1–2 are the substance; Part 3 is a re-add of prior work.

### Part 1 — Worker-safety: lazy-load the repos behind the singletons

Each of the 4 override singletons (`default-override-singleton`,
`special-override-singleton`, `global-adjustment-singleton`,
`prop-geometry-singleton`) currently imports its repo + persister at module top.
Change each to **dynamic-import the repo + persister inside `doInitialize()`**
(browser-only, post-auth). Keep type-only imports (erased). Effect:

- Importing a singleton module no longer pulls firebase / auth / posthog / `$env`.
- Main-thread behavior is unchanged — `initializeXxx()` still loads the repo and
  reads Firestore exactly as today.
- **No sync-admin-read problem**: the repo classes themselves are untouched, so
  `isAdmin()` / `saveDefaultLocal()` keep reading `authState` synchronously on
  the main thread.

After Part 1 the worker render graph is free of `$env` / `window` / firebase /
auth / posthog. The worker renders with **static-JSON base placements** (every
`getXxxRepository()` returns `null` because nothing initialized it in the worker).

### Part 2 — Override seeding via a uniform resolver seam (full parity)

For the worker to honor admin overrides without importing the firebase-bound
repos, all four override types are consumed through a **pure-function resolver
seam** (the pattern `default` already uses via `setDefaultOverrideResolver` in
`arrow-placer.ts:31`). Pure-function resolvers have zero firebase/auth surface
and are trivially seedable in a worker.

**Resolver seam.** Add resolver setters + module-level resolver slots for the
three override types that currently use direct getters
(`special`, `global`, `prop-geometry`), mirroring `DefaultOverrideResolver`. Each
resolver is a pure function with the exact read signature the calculator/placer
needs at its call site. Convert every `getXxxRepository()?.<readMethod>(...)`
consumption site in `arrow-adjustment-calculator.ts` (lines 203, 308, 339, 589,
598, 665) and `special-placer.ts` (line 104) to call the resolver slot instead.
Reads only — write paths are untouched and stay on the repos.

> Risk note: `arrow-adjustment-calculator.ts` is the delicate positioning core.
> This conversion is mechanical (swap the data source, not the logic) but MUST
> preserve byte-identical output. Execute + review this task with the
> `arrow-positioning-expert` agent, and gate it on the parity harness.

**Main-thread registration.** Each singleton's `doInitialize()` registers its
resolver backed by the now-initialized repo (default already does this;
special/global/prop-geometry gain the same one-line registration). Disposal
clears the resolver.

**`OverridePlacementBundle` (transferable).** A plain serializable snapshot of
the loaded docs of the 4 override stores:

```ts
interface OverridePlacementBundle {
  default: DefaultArrowPlacementDoc[];
  special: SpecialArrowPlacementDoc[];
  global: GlobalArrowAdjustmentDoc[];
  propGeometry: PropGeometryAdjustmentDoc[];
}
```

(Each array is exactly what that store's `*State.loadAll(docs)` consumes — the
same docs the main-thread repo loaded from Firestore.) Built on the main thread
from the initialized singletons; structured-clone transferred into each worker
alongside the existing `AssetBundle`.

**Worker hydration.** A worker-safe `seedOverrideResolvers(bundle)` constructs
the 4 import-clean `*State` instances, calls `loadAll(docs)` on each, and
registers the 4 resolvers (`setDefaultOverrideResolver(...)`, plus the 3 new
setters) over those states. No repo, no persister, no firebase, no auth. The
worker's calculator/placer now resolve overrides identically to main.

### Part 3 — QR: main renders, worker draws

The worker has no Firebase / QR generator. The main thread renders the QR bitmap
(cheap; served by the existing `QrImageCache`) and transfers it via the existing
`qrBitmap` field on the compose message; the worker attaches it to
`effectiveOptions.qrImageBitmap` and `renderQRCode` draws it (scaled via
`drawImage`) into the empty cell it already computes. This was built previously
and reverted from the program — re-add it on the **worker compose path only**,
not in PrintCardRenderer/PrintPreviewPages.

## Data flow (worker render, post-design)

```
main: getCardAssetBundle(seqs)            → AssetBundle (ImageBitmap[])
main: buildOverridePlacementBundle()      → OverridePlacementBundle (docs)
main: renderQrBitmap(seq)                 → ImageBitmap
        │  (all transferable / structured-clone)
        ▼
worker init:  seedCachesFromBundle(assetBundle)
worker init:  seedOverrideResolvers(overrideBundle)   ← registers 4 resolvers
worker compose(seq, options, qrBitmap):
        composeSequenceImage → preparer → arrow-placer / calculator
            → resolvers return seeded override values (parity with main)
            → renderQRCode draws transferred qrBitmap
        → transferToImageBitmap() → main
```

## Validation (parity harness only)

1. After Part 1: worker renders pictographs off-thread with base placements —
   no `$env` / `window` errors, cells populate (diff may exceed 1% wherever an
   override exists).
2. After Part 2: worst diff ≤ 1% across the harness set (worker vs main),
   including override-bearing sequences (e.g. `BΦ-LΦ`).
3. After Part 3: QR cell matches.
4. Speed: measure wall-clock drop vs main-thread and confirm active
   DedicatedWorker threads (multicore) on the harness draw.

No wiring into `PrintPreviewPages` / `PrintCardRenderer` until 1–4 pass.

## Scope

**In:** the 4 singletons (lazy repo import + resolver registration); the resolver
seam in `arrow-placer` / `special-placer` / `arrow-adjustment-calculator`; the
`OverridePlacementBundle` build (main) + `seedOverrideResolvers` (worker); the
worker QR draw; the parity-harness "Front (worker vs main)" wiring to seed both
bundles + QR.

**Out:** re-integration into deck releaser / print modal (separate follow-up once
the harness is green and fast); the card-**back** BackJob word/glyph parity gap
(unrelated subsystem).

## Risks

- **Positioning calculator conversion** — delicate; mechanical swap of data
  source must preserve output. Mitigation: arrow-positioning-expert + parity gate.
- **Override doc shape drift** — the bundle docs must be exactly what
  `*State.loadAll` consumes. Mitigation: reuse the persister's existing doc types;
  the bundle is built from `repo` state, not re-derived.
- **Worker staleness during dev** — the dispatcher spawns its pool once per page
  load; harness iteration requires a hard reload to respawn workers with new code.
