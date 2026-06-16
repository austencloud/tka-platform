# Multicore Deck Front Render — Wire + Seed-Fix the Existing Worker Pool (2026-05-30)

## The finding (measured, not guessed)

A Chrome performance trace of an **88-card cold draw** in the deck releaser:

| signal | value | meaning |
|---|---|---|
| `CrRendererMain` busy | 89,804 ms self | 100% of card compose on the main thread |
| App `DedicatedWorker` threads | **0** | nothing parallel; pool not engaged |
| main-thread blocked during draw | 15,023 ms (116 long tasks, longest 350 ms) | UI frozen the whole draw |
| worst frame gap | 447 ms | visible jank |
| Firestore requests | 11 (not 88) | QR cache/batch fix working — bottleneck is now CPU, not network |
| wall clock | ~21 s (~170–240 ms/card) | single-core bound |

On a ~32-core box, ~31 cores sat idle. `RENDER_CONCURRENCY = 8` in
`PrintPreviewPages` is **async concurrency on one thread**, not parallelism —
every `composeSequenceImage` runs Canvas2D work on `CrRendererMain`.

## The reframe: the pool already exists

A production OffscreenCanvas worker pool is already built and **ships today for
browse-gallery thumbnails**:

- `composition.worker.ts` — renders a full card via `composeSequenceImage` /
  `composeCardImage` inside the worker, returns an `ImageBitmap` zero-copy
  (`transferToImageBitmap`).
- `composition-dispatcher.ts` — `CompositionDispatcher`: pool manager,
  `probeWorkerSupport()` (boots a throwaway worker, verifies init→paint→transfer),
  least-busy `pickWorker()`, `composeFrontBitmap()` (returns the inner bitmap;
  main keeps the cheap stripe/bleed wrap), and a per-card main-thread fallback.
- `card-asset-bundle.ts` / `get-card-asset-bundle.ts` — decode the deck's SVGs
  on main (worker-side `createImageBitmap(svgBlob)` fails on the app's
  dimensionless SVGs), snapshot as transferable `ImageBitmap[]`, seed each worker.
- Wired into `ThumbnailRenderer` (`getThumbnailRenderer.ts`) and exercised by the
  `/test/card-back-parity` harness.

**The deck path does not use it.** `Draw` → `ReviewStep` → `PrintPreviewPages.renderAll`
→ `PrintCardRenderer.renderFront` → `ImageComposer.composeSequenceImage` runs on
the **main thread**. That is the 0-worker measurement.

## Why the prior attempt hit 0.88× (diagnosed, not guessed)

1. **`POOL_SIZE = cores − 1`** → 31 workers on a 32-core box. Far past the 6–8
   sweet spot; memory thrash + pointless spawn cost.
2. **Serial seed.** `initPool` clones the glyph set + the whole AssetBundle
   **per worker inside a sequential `for` loop** (`await` per worker). 31 × (clone
   ~N asset bitmaps) = the **3702 ms seed**, plus ~455 MB transient
   (31 × 14.7 MB card canvases).
3. **Never probed/wired** into the deck path → `canUseWorker()` stayed `false` →
   silent main-thread render.

The earlier per-cell (0.45×) and full-card (0.88×) losses were
**marshalling/seed-bound**, not evidence that multicore is wrong. Transfer of an
`ImageBitmap` is O(1); compute is ~170 ms/card — far on the right side of
break-even (2026 SOTA brief confirms ~5–7× achievable on heavy batches).

## Goal

Route the deck **card-front** render through the existing worker pool so an
88-card cold draw drops from ~21 s single-core to a few seconds across cores,
and the main thread stays responsive (no multi-second blocks). **Zero pixel
change** — the worker runs the identical `composeSequenceImage` path; parity is
already proven by the card-back-parity harness.

## Non-goals

- **Backs.** Card backs are DOM/HTML screenshots (~200 ms fixed wait), not
  Canvas2D — they can't use an OffscreenCanvas pool. Separate problem, separate
  spec. They stay main-thread.
- **Browse thumbnails.** Already use the pool and work — untouched.
- **No new pool, worker, bundle, or transfer mechanism.** Reuse
  `CompositionDispatcher` / `composition.worker` / `card-asset-bundle` as-is
  except the three fixes below.
- **No QR re-architecture.** The shipped short-code/QR cache (commit `a5deb2e46`)
  stays; this spec consumes it.

## Architecture — four pieces

### 1. Wire the seam (`PrintCardRenderer.renderFront` → pool)

`renderFront` currently returns `wrapContentInCardFrame(await composeSequenceImage(...))`.
Change the inner compose to go through the dispatcher:

- If `CompositionDispatcher.canUseWorker()` (probe passed): `const inner = await
  dispatcher.composeFrontBitmap(sequence, composeOptions, qrBitmap)` → draw the
  returned `ImageBitmap` onto the content canvas → `inner.close()` →
  `wrapContentInCardFrame(contentCanvas, …)`. The main thread keeps the
  deterministic stripe/bleed frame wrap (unchanged).
- Else: existing main-thread `composeSequenceImage` path (unchanged).
- Per-card `try/catch` → main-thread fallback on any worker error (the dispatcher
  already does this for `compose()`; extend the same guard to the front path).

`PrintPreviewPages.renderAll`: at draw start, once per generation, **(a)** call
`CompositionDispatcher.probeWorkerSupport()`, **(b)** build + set the AssetBundle
(piece 3), **(c)** call `resolveCodesForDeck` (already present). Then dispatch all
cards. The dispatcher's least-busy `pickWorker()` load-balances internally, so the
hand-rolled 8-lane `while` loop is replaced by handing every uncached card to the
pool concurrently (bounded by pool size inside the dispatcher). `cardCache` +
`deckCardBlobCache` write-through and the `copies` reuse are unchanged.

### 2. Seed fix (`composition-dispatcher.ts`)

- **Cap the pool:** `POOL_SIZE = Math.max(2, Math.min((navigator.hardwareConcurrency || 4) - 1, 8))`.
- **Parallelize the seed:** build glyph-clone + bundle-clone per worker, then
  `await Promise.all` **across all workers**, instead of awaiting each worker's
  clones inside the sequential spawn loop. Target: 3702 ms → < 500 ms.
- Keep the existing transfer-list / `init-done` handshake. Memory ceiling now
  8 × 14.7 MB ≈ 118 MB transient — comfortable.

### 3. AssetBundle once per draw

`PrintPreviewPages` (or `ReviewStep`) calls `getCardAssetBundle(sequences, {bluePropType, redPropType, theme})`
once per draw and `dispatcher.setAssetBundle(bundle)` **before** the first
`composeFrontBitmap` (which triggers `initPool` and seeds every worker from the
pending bundle). The bundle's main-thread prepare-pass is the unavoidable
decode-on-main step (worker can't decode the app's SVGs); it is shared across all
88 cards and all workers, so it is paid once.

### 4. QR on main, transferred to worker

Per the locked decision:

- Main resolves the code (`resolveCodesForDeck`, cached) and renders the QR
  `ImageBitmap` (now cheap — `QrImageCache` + decoded-image memo). One QR bitmap
  per card.
- `composeFrontBitmap(sequence, options, qrBitmap)` forwards `qrBitmap` in the
  `compose` message transfer list (the protocol's `qrBitmap` field already
  exists; `composeFrontBitmap` currently hard-codes `null` — change it to accept
  and forward).
- `composition.worker` composites the supplied `qrBitmap` at the QR cell its own
  layout computes (it already computes `findEmptyCellForQR`), and **skips** any
  Firebase/qr-code-styling QR generation when a `qrBitmap` is provided (the worker
  has no Firebase). When `canUseWorker()` is false, the main path renders QR as it
  does today.

## Data flow (after)

```
Draw / open Print modal
  └─ PrintPreviewPages.renderAll
       ├─ probeWorkerSupport()                  // once
       ├─ getCardAssetBundle(seqs) → setAssetBundle()   // once, decode-on-main
       ├─ resolveCodesForDeck(seqs)             // once, batched (already shipped)
       └─ for each uncached card (dispatched concurrently to pool):
            ├─ main: render QR bitmap (cached) 
            ├─ dispatcher.composeFrontBitmap(seq, opts, qrBitmap)
            │     └─ worker: seeded composeSequenceImage + composite qrBitmap
            │        → transferToImageBitmap → postMessage(bitmap,[bitmap])
            ├─ main: drawImage(inner) → wrapContentInCardFrame → close(inner)
            └─ cache (memory + IDB), copies reuse
       (fallback: any worker error / probe=false → main-thread composeSequenceImage)
```

## Bitmap lifecycle / memory

- Worker reuses one `OffscreenCanvas` per worker across cards (the worker already
  allocates per compose; confirm it reuses or that allocation is cheap — if not,
  reuse).
- Main consumes each returned `ImageBitmap` exactly once (`drawImage` into the
  frame canvas) then `close()`s it immediately. No queue of un-drawn bitmaps.
- Pool capped at 8; assets seeded once.

## Cache invalidation / correctness

- Worker render == main render (same `composeSequenceImage`), so the existing
  `CARD_RENDER_SCHEMA` cache key and `hashSequenceContent` fingerprint stay
  valid; cached worker output and cached main-thread output are interchangeable.
- Parity is enforceable via the existing `/test/card-back-parity` front path
  (worker vs main pixel diff).

## Files

- **Modify** `src/lib/shared/render/services/composition-dispatcher.ts` — cap
  `POOL_SIZE`; parallelize per-worker seed clones; `composeFrontBitmap` accepts +
  forwards `qrBitmap`; extend front-path try/catch → main fallback.
- **Modify** `src/lib/shared/render/workers/composition.worker.ts` — composite a
  supplied `qrBitmap` at the QR cell; skip worker-side QR generation when provided.
- **Modify** `src/lib/features/choreo-card/services/PrintCardRenderer.ts` —
  `renderFront` routes through `composeFrontBitmap` (worker) with main-thread
  fallback; keeps `wrapContentInCardFrame`.
- **Modify** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
  — probe + build/set AssetBundle once per draw; dispatch cards to the pool
  (replace the hand-rolled 8-lane loop); render QR bitmap on main per card.
- **Reuse unchanged:** `card-asset-bundle.ts`, `get-card-asset-bundle.ts`,
  `card-front-frame.ts` (`wrapContentInCardFrame`), `short-code`/`qr-image` caches.

## Testing / gate

- **Runtime gate (primary):** re-run the 88-card cold draw under a Chrome trace.
  Expect: `DedicatedWorker` threads now active and busy; `CrRendererMain` block
  collapses from ~15 s to a small fraction; wall clock ~21 s → a few seconds;
  Firestore still ~11. Record before/after.
- **Parity:** `/test/card-back-parity` front path — worker output pixel-diffs
  clean vs main thread (zero pixel change).
- **Unit:** `POOL_SIZE` cap math; parallel-seed completes < 500 ms on an N-worker
  stub; `composeFrontBitmap` forwards `qrBitmap` in the transfer list.
- **Fallback:** force `canUseWorker()=false` → identical main-thread render, no
  regression.

## Risks / notes

- **OffscreenCanvas-2D support** (Firefox / some Safari): the probe already gates
  this; those browsers keep the main-thread path. No regression, just no speedup.
- **Memory:** capped pool + immediate `close()` keeps transient bounded (~118 MB).
- **QR cell geometry:** the worker owns layout, so it places the supplied bitmap
  at its own computed empty cell — no duplicated geometry on main.
- **Glyph/font in worker:** headers already render in the worker today via
  transferred glyph bitmaps (not `FontFace`), so no worker font-loading work.
- **First-draw seed is still paid once** (decode-on-main AssetBundle). It is now
  parallel-cloned and capped, and amortized across 88 cards — the per-card win
  dominates. A future optimization could persist the bundle across draws.
