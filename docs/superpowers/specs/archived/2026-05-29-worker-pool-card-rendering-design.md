# Worker-Pool Card Rendering (Phase 3) — Design

**Date:** 2026-05-29
**Status:** Design — pending implementation plan
**Predecessor:** `2026-05-28-worker-parallelized-card-backs-design.md` (Phase 1 main-thread BackJob shipped; the old Phase 2 single-purpose back worker was skipped). This supersedes that Phase 2 with a unified front+back worker pool.

## Goal

Render choreo-card fronts AND backs across all CPU cores via the existing worker
pool, at full visual parity, so large decks (50–100+ cards) render with true
multi-core throughput instead of cooperative single-thread lanes.

## Background — why this is now feasible

The card render pipeline was already 90% worker-ready; it was shelved for two
reasons, only one of which still holds:

1. **`$env`/`$app`/Firebase crashing worker module-init — STALE.**
   `image-composer.ts:129-167` now imports those modules dynamically inside
   `try/catch` with worker-safe fallbacks, and the print path passes a full
   `visibilityOverrides` object (`PrintCardRenderer.renderFront`), so the
   store-reading branch never executes. `pictograph-preparer.ts:17-22` had its
   `getSettings()`→Firebase→`window` import deliberately removed for exactly this
   reason. `composition.worker.ts` already imports and runs `ImageComposer` +
   `Canvas2DDirectRenderer` in-worker.

2. **SVG decode fails in-worker — STILL REAL.**
   `svg-image-cache.ts:96-128`: the main thread decodes SVG via
   `HTMLImageElement` (browser SVG engine). The worker path falls back to
   `createImageBitmap(svgBlob)`, which fails on the app's real SVGs (proven in
   the Phase 0 spike). `getSvgAssetLoader()` (grids) and the glyph renderers
   decode SVGs the same way.

`detectWorkerSupport()` (`composition-dispatcher.ts:77-83`) hard-returns `false`
because of (1). The fix for (2) is the single new idea in this design.

## The core idea — AssetBundle cache seeding

The worker never needs to *decode* an SVG if its cache is pre-populated with the
already-decoded `ImageBitmap`s. SVG decode is the only main-thread-bound step;
everything downstream (`prepareSingle`, `composeSequenceImage`, `paintBackJob`,
the glyph renderers, `Canvas2DDirectRenderer`) is pure compute + canvas ops that
run identically in a worker.

```
MAIN THREAD                                   WORKER POOL (N = hardwareConcurrency-1)
───────────                                   ──────────────────────────────────────
1. prepareBatch(deck pictographs)             composition.worker.ts (exists)
   → populates the singleton svgCache           on init:
     + svgAssetLoader with every prop/            seedCachesFromBundle(bundle)
     arrow/grid/glyph the deck uses               → svgCache + assetLoader filled
2. buildAssetBundle(): snapshot those           per job:
   caches → re-decode each DrawableImage          composeSequenceImage(...)  // front
   to a transferable ImageBitmap →                paintBackJob(job)          // back
   AssetBundle { keys[], bitmaps[] }              every getImage() = cache HIT
3. dispatcher.init(bundle): transfer a            → NEVER calls createImageBitmap(svgBlob)
   clone of the bundle to each worker             return ImageBitmap (zero-copy transfer)
4. dispatch front+back jobs round-robin  ◄──── results collected by request id
5. ImageBitmap → canvas → cache/blob
```

### Why misses can't happen (by construction)

The cache key for props/arrows is `hash(wrapped + color-substituted SVG)`
(`canvas-2d-direct-renderer.ts:447,499`). The worker prepares the **same**
pictographs the main thread already prepared (the prepare logic is deterministic
and worker-safe), producing the **same** wrapped SVG strings → the **same** hash
keys → all already present in the seeded bundle. A miss would require
main-thread and worker `prepareSingle` to diverge, which they cannot.

Exhaustive pre-decode (enumerate every asset file) was assessed and **rejected**:
the arrow universe is only ~65 source files (position/rotation/mirror are
draw-time transforms, not separate files), so the universe is tractable (~155
files, ~300 bitmaps with color variants) — but the cache keys require per-asset
`viewBox`/`center` metadata that only `prepareSingle` produces, so exhaustive
seeding would have to reimplement the asset-selection pipeline. The deck
prepare-snapshot produces correctly-keyed entries for free and only for what the
deck uses (~20–40 arrows typical). Snapshot wins on both correctness and size.

## Components

### New: `card-asset-bundle.ts`
`src/lib/shared/render/services/card-asset-bundle.ts`

```ts
export interface AssetBundle {
  keys: string[];            // svgCache keys (prop_*, arrow_*, glyph keys)
  bitmaps: ImageBitmap[];    // index-aligned, transferable
  gridKeys: string[];        // svgAssetLoader grid/non-radial keys
  gridBitmaps: ImageBitmap[];
}

// Main thread: run a prepare-pass over the deck, snapshot the populated caches.
export async function buildAssetBundle(
  sequences: SequenceData[],
  opts: { bluePropType: PropType; redPropType: PropType; theme: string },
): Promise<AssetBundle>;

// Worker thread: populate svgCache + svgAssetLoader from a received bundle.
export function seedCachesFromBundle(bundle: AssetBundle): void;
```

`buildAssetBundle` calls `pictographPreparer.prepareBatch()` for all steps +
start positions (warms `prepareCache` AND `svgCache`), then reads
`svgCache`'s internal map and `svgAssetLoader`'s grid map, re-decoding each
`DrawableImage` to a fresh `ImageBitmap` via `createImageBitmap(drawable)` (works
for both `HTMLImageElement` and `ImageBitmap` sources). Bundle bitmaps are cloned
per-worker at transfer (transfer consumes the original — mirror the existing
glyph-clone pattern in `composition-dispatcher.ts:271`).

`seedCachesFromBundle` adds a public `setImage(key, bitmap)` to `SvgImageCache`
and a seed method to `SvgAssetLoader` so the worker fills caches without decoding.

### Modified: `composition-dispatcher.ts`
- `detectWorkerSupport()` → **probe once, cache result**: lazily spin up one
  worker and exercise it via the **back paint path** (`paintBackJob` with a
  minimal proof-mode job) — this needs NO SVG decode (mandala is Path2D,
  decorations null), so it bootstraps without a seeded bundle and verifies the
  whole init → OffscreenCanvas → paint → transfer chain produces non-blank
  alpha. Cache pass/fail on `CompositionDispatcher.workerSupport` for the
  session. On any failure → `false` (main-thread path).
- `POOL_SIZE` → `Math.max(1, (navigator?.hardwareConcurrency || 4) - 1)`
  (uncapped per user decision). Peak-memory note: N in-flight 1644×2244 RGBA
  canvases ≈ N × 14.7 MB; on a 16-core machine ≈ 220 MB transient — acceptable
  on desktop, the target for deck rendering.
- `init` message gains `bundle: AssetBundle`; `initPool` builds the bundle once
  and transfers a per-worker clone alongside the existing glyph bitmaps.
- Add `compose-back` in-message + `composeBack(sequence, constantBitmaps): Promise<ImageBitmap>`.
  The back's CONSTANT rasterizers (brand/url/difficulty-badge/loop-icons in
  `card-back-bitmaps-constant.ts`) use `rasterizeComponent` (DOM mount +
  screenshot) and CANNOT run in-worker — but they are cached once per
  theme/level/icon. They are pre-built on the main thread (once per deck) and
  passed to the worker. The worker then runs the FULL `buildBackJob` (per-card:
  Path2D mandala, canvas-native glyphs, start-pos pictograph via the seeded
  `Canvas2DDirectRenderer`) + `paintBackJob`. `buildBackJob` already accepts a
  `deps` parameter — inject the constant bitmaps through it so the worker never
  DOM-rasterizes. This is the real back win (the per-card build is what costs,
  not the ~1ms composite).
- Add a `decode-request`/`decode-response` round-trip pair as the never-fires
  safety net: on an in-worker cache miss, the worker asks the main thread to
  decode that one SVG and transfers the bitmap back.

### Modified: `composition.worker.ts`
- On `init`: after building the pipeline, call `seedCachesFromBundle(bundle)`.
- Add `handleComposeBack(sequence, constantBitmaps)` → `buildBackJob(sequence,
  opts, deps={constant bitmaps injected})` → `paintBackJob(job)` →
  `transferToImageBitmap()` → `postResult`.
- On `getImage` miss (wrap the cache): post `decode-request`, await
  `decode-response`. (Implemented as a small async bridge keyed by request id.)

### Modified: `PrintCardRenderer` + `PrintPreviewPages.svelte`
- `renderFront`/`renderBack` route through `dispatcher.compose(...)` /
  `dispatcher.composeBack(...)` when `CompositionDispatcher.canUseWorker()`.
- `PrintPreviewPages` builds the `AssetBundle` once per deck (before the render
  loop) and ensures `dispatcher.init(bundle)` before dispatching.
- The existing cooperative lane loop stays as the orchestration layer; each lane
  now awaits a worker job instead of a main-thread render.

## Data flow

1. `PrintPreviewPages.renderAll` → `buildAssetBundle(sequences, {props, theme})`.
2. `dispatcher.ensureInitialized(bundle)` (idempotent; re-seed only if prop/theme
   changed — bundle identity keyed by `prop+theme`).
3. Per card, per lane: `Promise.all([dispatcher.compose(front), dispatcher.composeBack(sequence, constantBitmaps)])`
   where `constantBitmaps` are built once per deck (theme/level/icon-keyed cache).
4. `ImageBitmap` → `HTMLCanvasElement` (existing CardPair seam) → cache + blob.

## Error handling — three fallback tiers

1. **Worker pool** (bundle-seeded).
2. **Main-thread** `composeSequenceImage` / `paintBackJob` (today's proven path) —
   on any worker error, init failure, or unrecoverable miss.
3. **DOM renderer** (`card-back-dom-renderer.ts`, backs only) — existing last resort.

Every fallback is `console.warn`-logged with the card index + reason. No silent
perf cliff: if tier-1 fails systematically, the logs make it visible.

## Testing

### Unit
- `card-asset-bundle.test.ts`: `buildAssetBundle` over a fixture deck yields a
  bundle whose `keys` superset-covers the keys a single in-worker render requests
  (assert no miss for the fixture); `seedCachesFromBundle` populates a fresh
  `SvgImageCache` such that `getImage` returns synchronously without decode.
- `composition-dispatcher` probe: mock a worker that returns non-blank → support
  `true`; one that throws → `false`, falls back.

### Parity (the hard gate — reuse `/test/card-back-parity`, add a fronts tab)
- Render the matrix worker-vs-main-thread: each theme × prop × {loop,no-loop} ×
  {float, mixed turns, 0T} × level {1,2,3} × {with,without start position}, fronts
  AND backs.
- Per-pixel max delta + % differing pixels in a sortable table.
- **Gate:** worker output pixel-identical to main-thread within AA tolerance
  (target < 0.5% differing, max delta ≤ small AA epsilon). Do not claim parity
  without harness output.

### Perf
- 50-card deck wall-clock: worker pool vs main-thread baseline (`performance.now()`
  around the render loop). Report the actual numbers and the per-core scaling.

## Out of scope
- WebGPU / GPU compositing (separate `project_webgpu_migration`).
- Changing the visual output of any card (parity is mandatory).
- Front render-pipeline refactors beyond cache seeding (no FrontJob extraction —
  the existing in-worker `composeSequenceImage` is reused verbatim).

## Open risks
- **Probe latency** on first render (one test pictograph) — one-time, cached.
- **Bundle build cost** — a prepare-pass over the deck before rendering; but
  `prepareCache` means the subsequent worker renders reuse it, and the pass is
  work the main thread would do anyway. Net add ≈ the SVG re-decode-to-bitmap
  loop (~sub-second for a deck's ~20–40 assets).
- **Font availability in-worker** — `composition.worker.ts:140` already attempts
  `FontFace` registration; glyph text falls back gracefully. Parity harness will
  catch any text drift.

---

## Phase 1 OUTCOME (2026-05-29) — Approach A BLOCKED; pivot to FrontJob

Phase 0 infra built + Phase 1 front routing wired, then the parity harness +
worker diagnostics caught that **Approach A (reuse the existing composition
worker) does not work** — for the exact reasons the worker was gated off. Two
of this spec's foundational assumptions were WRONG:

1. **"The prepare-pass populates the caches."** FALSE. `pictograph-preparer`
   only selects SVG asset strings; `svgCache` is populated by
   `Canvas2DDirectRenderer` at RENDER time, not prepare time. Fixed by
   warming via a tiny main-thread `composeSequenceImage` pass (commit
   `1f3d92320`) + injecting SVG dims so viewBox-only SVGs snapshot
   (`528d2c776`). Seeding then worked: diagnostics showed `bundle keys: 64,
   grids: 2` delivered to the worker.

2. **"The $env/dynamic/public coupling is stale."** FALSE — it is LIVE in the
   deep render path. The worker crashes per-beat: `TypeError: Cannot read
   properties of undefined (reading 'env') at public:1:47` (a transitive
   `$env/dynamic/public` / sveltekit-env-global access, reached per pictograph,
   not nameable from the collapsed stack). This is precisely why
   `CompositionDispatcher.detectWorkerSupport()` was hard-`false`. The gate was
   correct, not stale.

3. **Bonus gap:** the worker never calls
   `Canvas2DDirectRenderer.setGlobalPreparerGetter`, so even with the env crash
   fixed, the worker has no preparer → props/arrows would not render.

4. **Glyph cache near-empty in worker** (`initPool glyphEntries: 6`) → word
   falls back to raw serif `fillText` instead of compressed TKA glyphs.

**Verdict:** reusing the gated-off worker is a rabbit hole — each fix exposes the
next reason it was disabled. **Production neutralized** (commit `7a7cee1d2`):
`renderFront` stays main-thread (proven correct), the probe+bundle setup removed
from `PrintPreviewPages`. Phase 0 infra (cache accessors, AssetBundle,
dispatcher seed/probe) remains as DORMANT library code (nothing routes to the
worker).

**Next:** if true-multicore fronts are still wanted, do **Approach B (FrontJob)**
as a FRESH sub-project — its own brainstorm → spec → plan. A plain-data FrontJob
+ a dumb paint worker that imports NOTHING SvelteKit-coupled sidesteps the $env
wall entirely (the proven `paintBackJob` pattern, extended to fronts). It is a
large extraction (the full `composeSequenceImage` layout/word/step-number/
start-pos logic must be re-expressed as plain data + pre-decoded bitmaps) — do
not start it on a tired context. Backs are already 52ms warm; main-thread fronts
already render correctly — nothing is broken without this.
