# Worker-Pool Front Render — Wiring + Pre-Warm (2026-05-31)

## Status

Extends the approved `2026-05-30-multicore-deck-front-render-design.md`. That spec
covers the seam mechanics (renderFront→pool, QR-on-main, main-thread fallback) and
its **seed-fix** (pool cap 8, parallel-clone seed) + **QR-forward** (`composeFrontBitmap`
accepts/forwards `qrBitmap`; worker composites it) are **already in the code**. The
**parity proof** that spec depended on is also done — `/test/card-back-parity` front
path pixel-diffs worker vs main clean (real released-deck data, Gelasio font parity,
QR present).

This document adds the **pre-warm layer** the benchmark proved necessary and
**corrects the seed-cost expectation**.

## The corrected number (measured this session, :5173, 32-core)

The 2026-05-30 spec targeted "seed 3702 ms → < 500 ms after parallelizing." Reality,
measured against real decks:

| Measurement | Result |
|---|---|
| Single worker boot (probe) | **41 ms** |
| Main thread, 8 async lanes (current path) | **68 ms/card** (1288 ms / 19 distinct cards) |
| Worker pool, **warm**, wall-clock | **7.2 ms/card** (136 ms / 19) → **9.5× faster** |
| Worker pool **cold seed** (spawn 8 + clone bundle) | **~5 s** |
| Asset-bundle build (decode-on-main) | **~2 s** |

The ~5 s seed is **not** dev-server overhead (a single worker boots in 41 ms). It is
the per-worker **bundle clone**: `transfer` detaches the source `ImageBitmap`, so each
of 8 workers needs its own copy of ~110 glyph + SVG + icon bitmaps ≈ 900
`createImageBitmap` calls. `Promise.all` parallelizes scheduling, not the decode work,
so the floor stays seconds.

### Why this flips the math by deck size

- **88-card releaser draw** (the 2026-05-30 target): main ≈ 21 s; worker ≈ 5 s seed +
  88 × 7 ms ≈ **5.6 s → 3.7× win even paying full seed lazily**.
- **Small deck (19–24 cards)**: main ≈ 1.1–1.3 s; worker ≈ 5 s seed + render ≈ 5.7 s →
  **lazy seed loses**.

Pre-warming the pool before the preview mounts hides the seed behind user navigation,
so **every** deck (small or large) hits the 9.5× warm path and the review render is
near-instant.

## What is NOT a pattern to copy (verified)

The browse-thumbnail path calls `dispatcher.compose()` but **never probes**, so
`canUseWorker()` stays `false` and thumbnails run on the **main-thread fallback** today
(`get-thumbnail-render-queue.ts` comment confirms: queue constructed before any probe).
There is **no shipping per-deck-bundle seeding** in production. The card-back-parity
harness is the only place that does `probe → getCardAssetBundle → setAssetBundle →
setOverrideBundle → composeFrontBitmap`. This spec establishes that as the production
sequence; the harness is the reference implementation.

## Goal

Route the deck card-front render through the existing worker pool, with the pool
**pre-warmed** the moment a deck's sequences are known, so cold deck draws (small or
large) render fast and the main thread stays responsive. **Zero pixel change** — the
worker runs the identical `composeSequenceImage` path; parity is proven by the harness.

## Non-goals

- **Backs.** DOM/HTML screenshots, not Canvas2D — can't use OffscreenCanvas. Stay
  main-thread. Separate problem.
- **Browse thumbnails.** Untouched (still main-fallback; out of scope).
- **New pool / worker / bundle / transfer mechanism.** Reuse `CompositionDispatcher`,
  `composition.worker`, `card-asset-bundle`, `card-front-frame` as-is. The seed-fix and
  QR-forward are already in. Only the additions below are new.
- **Incremental cross-deck asset accumulation.** Rejected for YAGNI — terminate+reinit
  on deck change (§2) is simpler and spawn is cheap.

## Architecture

### 1. Pre-warm entry point

New module `src/lib/shared/render/services/card-pool-prewarm.ts`:

```
prewarmCardPool(sequences, { bluePropType, redPropType, theme, iconPaths }): void
```

Fire-and-forget (caller does NOT await), idempotent, all errors swallowed (any failure
just leaves `canUseWorker()` false → main-thread fallback, no regression). Steps:

1. `await CompositionDispatcher.probeWorkerSupport()` — if `false`, return (no worker).
2. Compute the **bundle signature** (§2) for these sequences/opts. If it equals the
   dispatcher's currently-seeded signature, return (pool already hot for this deck).
3. `const bundle = await getCardAssetBundle(sequences, { bluePropType, redPropType, theme, iconPaths })`.
4. `dispatcher.setAssetBundle(bundle)`, `dispatcher.setOverrideBundle(buildOverridePlacementBundle())`.
5. If the pool is already initialized with a different signature →
   `dispatcher.terminate()` first (so re-init reseeds from the new pending bundle).
6. `await dispatcher.ensureInitialized()` (spawns + seeds the pool from the pending
   bundle). Record the new seeded signature.

Because it's fire-and-forget at the upstream seam, the ~5 s seed overlaps the
draw/navigation that follows.

### 2. Bundle signature + re-seed on deck change

The pool seeds workers once at `initPool`; the asset bundle is deck-specific. Track a
`seededSignature: string | null` on `CompositionDispatcher`.

Signature = stable join of:
- deck identity: the sorted set of `sequence.id` (or `deckId` when available),
- `bluePropType` + `redPropType`,
- the render-schema marker (mirror `CARD_RENDER_SCHEMA`).

New dispatcher method `getSeededSignature(): string | null` and the signature is set
at the end of `initPool` (from a `pendingSignature` field set alongside
`setAssetBundle`). `terminate()` clears it.

On a deck change (`prewarmCardPool` computes a different signature while a pool is
already initialized): `terminate()` + re-init. Spawn cost is ~41 ms/worker (negligible);
the bundle-clone cost is unavoidable for any reseed and is hidden behind the pre-warm
seam. No incremental "reseed" worker message — rejected for complexity.

### 3. Trigger placement

`prewarmCardPool(...)` is called where a deck's sequences first become known:

- **Releaser** — `DeckReleaserTab.loadSelectedSequences`, immediately after
  `rs.sequences = resolved.map(...)` (line ~640), before `rs.step = "review"` mounts
  the preview. Fire-and-forget. Inputs: `rs.sequences`, `rs.bluePropType`,
  `rs.redPropType`, `rs.theme`, and the deck's footer `iconPath`s.
- **Released-deck view** — the same call at the `viewingRelease` open seam (where a
  released deck is loaded for viewing in `DeckReleaserTab`/`ReviewStep` read-only mode).

### 4. Wire `renderFront` → pool (2026-05-30 piece 1)

`PrintCardRenderer.renderFront`:

- If `CompositionDispatcher.canUseWorker()`:
  - `const inner = await dispatcher.composeFrontBitmap(sequence, composeOptions, qrBitmap)`
    — **no** `frontCardFrame` (we want the unframed inner bitmap; the frame is applied
    on main so the print/CardPair seam keeps an `HTMLCanvasElement`).
  - Draw `inner` onto a content `HTMLCanvasElement` sized to `frame` content dims.
  - `inner.close()`.
  - `return wrapContentInCardFrame(contentCanvas, frame, htmlFactory)` (main-thread,
    deterministic stripe/bleed wrap, unchanged).
  - Per-card `try/catch` → on any worker error, fall back to the main-thread compose
    for that card.
- Else (`canUseWorker()===false`): existing main-thread `composeSequenceImage` +
  `wrapContentInCardFrame` path, unchanged.

`composeFrontBitmap` already accepts `qrBitmap` and returns the unframed inner bitmap
when `frontCardFrame` is absent — no dispatcher change needed for this piece.

### 5. QR on main per card (2026-05-30 piece 4 — already half-wired)

`PrintPreviewPages` resolves each card's short code (`resolveCodesForDeck`, already
batched/shipped) and renders the QR `ImageBitmap` on main (`QrImageCache`, already
shipped), then threads it as `qrBitmap` into `renderFront` →`composeFrontBitmap`. The
worker composites the supplied bitmap at its own computed empty cell and skips
worker-side QR generation when one is provided (already implemented this session). When
`canUseWorker()===false`, the main path generates QR as today.

`PrintCardRenderer.renderFront`'s signature gains an optional `qrBitmap?: ImageBitmap`
(or reads it from `options.qrImageBitmap`, matching the existing
`SequenceExportOptions.qrImageBitmap` field) so the QR bitmap reaches the worker call.

### 6. PrintPreviewPages dispatch

Replace the artificial 8-lane `while` cap (`RENDER_CONCURRENCY`) with handing every
uncached card to the pool concurrently — `pickWorker()` load-balances across the ≤8
workers internally, so the main-thread lane cap is now redundant and only throttles
throughput. `cardCache` + `deckCardBlobCache` write-through, the sparse-array
index-write render, and the `copies` reuse are all unchanged. The QR bitmap is built
per card before dispatch (§5).

### 7. Fallback

`canUseWorker()===false` (no `OffscreenCanvas`, probe failed, Firefox/some Safari):
unchanged main-thread render — zero behavior change, just no speedup. Per-card worker
errors fall back to a main-thread render of that card. The probe already gates this.

## Data flow (after)

```
Releaser draw completes (loadSelectedSequences sets rs.sequences)
  └─ prewarmCardPool(seqs, {props, theme, iconPaths})   // fire-and-forget
       ├─ probeWorkerSupport()                           // 41 ms
       ├─ signature changed? terminate() prior pool
       ├─ getCardAssetBundle(seqs) → setAssetBundle      // ~2 s decode-on-main
       └─ ensureInitialized()                            // ~5 s seed (hidden behind draw)
  └─ rs.step = "review" → ReviewStep → PrintPreviewPages.renderAll
       ├─ resolveCodesForDeck(seqs)                      // batched, shipped
       └─ for each uncached card (dispatched concurrently to the warm pool):
            ├─ main: render QR bitmap (cached)
            ├─ renderer.renderFront → dispatcher.composeFrontBitmap(seq, opts, qrBitmap)
            │     └─ worker: seeded composeSequenceImage + composite qrBitmap
            │        → transferToImageBitmap → postMessage(bitmap,[bitmap])   // 7 ms/card
            ├─ main: drawImage(inner) → wrapContentInCardFrame → close(inner)
            └─ cache (memory + IDB), copies reuse
       (fallback: probe=false / per-card worker error → main composeSequenceImage)
```

## Files

- **Create** `src/lib/shared/render/services/card-pool-prewarm.ts` — `prewarmCardPool`.
- **Modify** `src/lib/shared/render/services/composition-dispatcher.ts` — add
  `pendingSignature` + `seededSignature`, set at init, cleared on `terminate`; expose
  `getSeededSignature()`. (Pool cap + parallel seed + `composeFrontBitmap(qrBitmap)`
  already present.)
- **Modify** `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — `renderFront`
  routes through `composeFrontBitmap` (worker) with main fallback; keeps
  `wrapContentInCardFrame`; accepts the QR bitmap.
- **Modify** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
  — dispatch uncached cards to the pool (drop the 8-lane cap); render QR bitmap on main
  per card; pass it into `renderFront`.
- **Modify** `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`
  — call `prewarmCardPool(...)` at the end of `loadSelectedSequences` and at the
  `viewingRelease` open seam.
- **Reuse unchanged:** `card-asset-bundle.ts`, `get-card-asset-bundle.ts`,
  `override-placement-bundle.ts`, `card-front-frame.ts`, `composition.worker.ts`,
  short-code / QR-image caches.

## Testing / gate

- **Parity (primary, already green):** `/test/card-back-parity` front path — worker
  output pixel-diffs clean vs main (zero pixel change). Re-run after wiring.
- **Runtime trace:** Chrome trace of a cold releaser draw — expect `DedicatedWorker`
  threads active and busy, `CrRendererMain` block collapses (no multi-second freeze),
  wall clock drops sharply. With pre-warm, the seed appears during the draw, not the
  review render.
- **Unit:**
  - signature equality (same deck → no reseed) and inequality (changed props/seqs →
    reseed) logic;
  - `prewarmCardPool` idempotency (second call with same signature is a no-op);
  - `prewarmCardPool` swallows a probe/bundle failure and leaves `canUseWorker()` false;
  - `renderFront` worker path draws the inner bitmap and frames on main; per-card error
    falls back to main compose.
- **Fallback:** force `canUseWorker()===false` → identical main-thread render, no
  regression.

## Risks / notes

- **Deck-switch reseed cost.** Each new deck pays the ~5 s clone again. Mitigated by
  pre-warming at the open seam so it overlaps navigation. Sessions usually view one deck
  at a time; acceptable. (Incremental cross-deck accumulation is a possible future
  optimization, explicitly out of scope.)
- **Pre-warm racing the render.** If the user reaches the preview before the seed
  finishes, `renderAll`'s first `composeFrontBitmap` simply awaits the in-flight
  `ensureInitialized` (the dispatcher already dedups via the `initializing` guard) — no
  double-seed, no error; worst case the first render waits out the remaining seed.
- **Memory:** capped pool (≤8) + immediate `inner.close()` keeps transient bounded
  (~118 MB worker canvases).
- **OffscreenCanvas-2D support:** probe-gated; unsupported browsers keep the main path.
- **Stale signature after terminate:** `terminate()` must clear `seededSignature` so the
  next `prewarmCardPool` re-seeds rather than assuming a hot pool.
