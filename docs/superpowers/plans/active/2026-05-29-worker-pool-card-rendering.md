# Worker-Pool Card Rendering (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render choreo-card fronts AND backs across all CPU cores via the existing worker pool, at full visual parity, by seeding each worker's SVG caches with pre-decoded `ImageBitmap`s so the (already worker-safe) render pipeline never decodes SVG in-worker.

**Architecture:** The only main-thread-bound step is SVG decode (`HTMLImageElement`). A main-thread prepare-pass over the deck populates the singleton `svgCache` + `svgAssetLoader`; we snapshot those as transferable `ImageBitmap`s into an `AssetBundle`, transfer a clone to each worker at init, and seed the worker caches. Then `composeSequenceImage` (fronts) and `buildBackJob`+`paintBackJob` (backs) run in parallel in-worker, hitting only cache. Constant back rasterizers (brand/url/badge/loop-icons) are DOM-coupled, so they are pre-built once per deck on the main thread and injected into the in-worker `buildBackJob` via its `deps`.

**Tech Stack:** Svelte 5, TypeScript, OffscreenCanvas, `createImageBitmap`, module Web Workers, the existing `CompositionDispatcher` pool, `vitest`.

**Spec:** `docs/superpowers/specs/active/2026-05-29-worker-pool-card-rendering-design.md`

**Reference files (read before starting):**
- `src/lib/shared/render/services/svg-image-cache.ts` — `SvgImageCache`, `DrawableImage`, singleton `getSvgImageCache()`. Cache map is private — Task 1 adds accessors.
- `src/lib/shared/render/services/svg-asset-loader.ts` — `SvgAssetLoader` grids/letters; `getSvgAssetLoader()`. Grids stored in `assets.grids`, NOT only the cache.
- `src/lib/shared/render/services/composition-dispatcher.ts` — pool, `detectWorkerSupport()` (line 77, hard-`false`), `POOL_SIZE` (line 52), `init` message (line 18-27), glyph-clone pattern (line 271).
- `src/lib/shared/render/workers/composition.worker.ts` — worker router; `handleInit` (line 88) builds the pipeline; `handleCompose` (line 157).
- `src/lib/shared/render/services/image-composer.ts` — `composeSequenceImage`; worker-safe dynamic-import fallbacks (line 129-167).
- `src/lib/shared/pictograph/shared/services/pictograph-preparer.ts` — `prepareBatch` (line 36), `prepareSingle` (line 52), worker-safe (line 17-22).
- `src/lib/shared/render/services/canvas-2d-direct-renderer.ts` — `drawProps`/`drawArrows` cache keys (line 447, 499); `getSvgImageCache()`/`getSvgAssetLoader()`.
- `src/lib/features/choreo-card/services/card-back/card-back-job-builder.ts` — `buildBackJob` (line 261), `BuildBackJobDeps` (line 160), `realDeps` (line 192). Constant rasterizers injectable.
- `src/lib/features/choreo-card/services/card-back/card-back-bitmaps-constant.ts` — `rasterizeBrand`/`rasterizeUrl`/`rasterizeDifficultyBadge`/`rasterizeLoopIcon` via `rasterizeComponent` (DOM mount — NOT worker-safe; pre-build on main thread).
- `src/lib/features/choreo-card/services/card-back/card-back-raster.ts` — `paintBackJob(job): OffscreenCanvas` (worker-safe).
- `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — `renderFront` (line 93), `renderBack` (line 198).
- `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` — `renderAll` (line 293), lane loop (line 416-425).
- `src/routes/test/card-back-parity/+page.svelte` — existing parity harness host.

**Constants:** card front+back render at `822×1122` logical × scale `2` = **`1644×2244`** output. Backs use `bleedPx 72`.

**Commit discipline (PROJECT RULE):** the git index is shared with other agents. EVERY commit MUST use an explicit pathspec: `git commit -m "msg" -- path/a path/b`. NEVER bare `git commit`, NEVER `git add -A`/`.`. NEVER reset/rebase/amend.

**Model discipline (PROJECT RULE):** if dispatched as a subagent, OMIT the model param (inherit main-loop model). NEVER Opus 4.7.

---

# PHASE 0 — Shared infrastructure: AssetBundle + cache seeding + worker probe

Goal: the worker can be handed a bundle of pre-decoded SVG bitmaps and render WITHOUT decoding any SVG. No front/back routing yet — this phase is the foundation both phases consume.

### Task 0.1: SvgImageCache accessors (`entries` + `setImage`)

**Files:**
- Modify: `src/lib/shared/render/services/svg-image-cache.ts`
- Test: `src/lib/shared/render/services/__tests__/svg-image-cache-accessors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// svg-image-cache-accessors.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { SvgImageCache } from "../svg-image-cache";

describe("SvgImageCache accessors", () => {
  let cache: SvgImageCache;
  beforeEach(() => { cache = new SvgImageCache(); });

  it("setImage stores a drawable retrievable synchronously via entries()", () => {
    const fake = { width: 10, height: 10 } as unknown as ImageBitmap;
    cache.setImage("k1", fake);
    const entries = cache.entries();
    expect(entries.get("k1")).toBe(fake);
  });

  it("getImage returns a setImage-seeded entry without decoding", async () => {
    const fake = { width: 5, height: 5 } as unknown as ImageBitmap;
    cache.setImage("seed-key", fake);
    const got = await cache.getImage("<svg/>", "seed-key");
    expect(got).toBe(fake);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/shared/render/services/__tests__/svg-image-cache-accessors.test.ts`
Expected: FAIL — `cache.setImage is not a function`.

- [ ] **Step 3: Implement the accessors**

In `svg-image-cache.ts`, add two public methods to `class SvgImageCache` (after `getStats()`):

```ts
  /** Synchronously seed a decoded image under `key` (worker cache pre-population). */
  setImage(key: string, image: DrawableImage): void {
    this.cache.set(key, image);
  }

  /** Snapshot of the cache map (key → drawable). Used to build an AssetBundle. */
  entries(): Map<string, DrawableImage> {
    return new Map(this.cache);
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/shared/render/services/__tests__/svg-image-cache-accessors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/svg-image-cache.ts src/lib/shared/render/services/__tests__/svg-image-cache-accessors.test.ts
git commit -m "feat(render): SvgImageCache setImage/entries accessors for worker cache seeding" -- src/lib/shared/render/services/svg-image-cache.ts src/lib/shared/render/services/__tests__/svg-image-cache-accessors.test.ts
```

### Task 0.2: SvgAssetLoader grid seed + snapshot

**Files:**
- Modify: `src/lib/shared/render/services/svg-asset-loader.ts`
- Test: `src/lib/shared/render/services/__tests__/svg-asset-loader-seed.test.ts`

`getGridImage`/`getNonRadialPointsImage` read `this.assets.grids`, which `initialize()` populates by fetch+decode (fails in-worker). Add direct seed + snapshot of the four grids so the worker skips `initialize()`.

- [ ] **Step 1: Write the failing test**

```ts
// svg-asset-loader-seed.test.ts
import { describe, it, expect } from "vitest";
import { SvgAssetLoader } from "../svg-asset-loader";

describe("SvgAssetLoader grid seed", () => {
  it("seedGrids populates getGridImage without initialize()", () => {
    const loader = new SvgAssetLoader();
    const diamond = { width: 950, height: 950 } as unknown as ImageBitmap;
    loader.seedGrids({ diamond, box: null, diamondNonRadial: null, boxNonRadial: null });
    expect(loader.getGridImage("diamond")).toBe(diamond);
    expect(loader.isInitialized()).toBe(true);
  });

  it("snapshotGrids returns the four grid slots", () => {
    const loader = new SvgAssetLoader();
    const diamond = { width: 1 } as unknown as ImageBitmap;
    loader.seedGrids({ diamond, box: null, diamondNonRadial: null, boxNonRadial: null });
    const snap = loader.snapshotGrids();
    expect(snap.diamond).toBe(diamond);
    expect(snap.box).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/shared/render/services/__tests__/svg-asset-loader-seed.test.ts`
Expected: FAIL — `loader.seedGrids is not a function`.

- [ ] **Step 3: Implement seed + snapshot**

In `svg-asset-loader.ts`, add to `class SvgAssetLoader` (after `getNonRadialPointsImage`):

```ts
  /** Seed the four grid drawables directly (worker path — skips fetch+decode). */
  seedGrids(grids: LoadedAssets["grids"]): void {
    this.assets.grids = grids;
    this.initialized = true;
  }

  /** Snapshot the four grid drawables (main thread — feeds an AssetBundle). */
  snapshotGrids(): LoadedAssets["grids"] {
    return { ...this.assets.grids };
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/shared/render/services/__tests__/svg-asset-loader-seed.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/svg-asset-loader.ts src/lib/shared/render/services/__tests__/svg-asset-loader-seed.test.ts
git commit -m "feat(render): SvgAssetLoader grid seed/snapshot for worker seeding" -- src/lib/shared/render/services/svg-asset-loader.ts src/lib/shared/render/services/__tests__/svg-asset-loader-seed.test.ts
```

### Task 0.3: AssetBundle build + seed

**Files:**
- Create: `src/lib/shared/render/services/card-asset-bundle.ts`
- Test: `src/lib/shared/render/services/__tests__/card-asset-bundle.test.ts`

- [ ] **Step 1: Write the failing test** (seed half — pure, no decode needed)

```ts
// card-asset-bundle.test.ts
import { describe, it, expect } from "vitest";
import { seedCachesFromBundle, type AssetBundle } from "../card-asset-bundle";
import { SvgImageCache } from "../svg-image-cache";
import { SvgAssetLoader } from "../svg-asset-loader";

describe("seedCachesFromBundle", () => {
  it("populates a cache + loader from a bundle", () => {
    const cache = new SvgImageCache();
    const loader = new SvgAssetLoader();
    const bmpA = { width: 1, height: 1 } as unknown as ImageBitmap;
    const bmpGrid = { width: 950, height: 950 } as unknown as ImageBitmap;
    const bundle: AssetBundle = {
      keys: ["arrow_blue_exp_123"],
      bitmaps: [bmpA],
      grids: { diamond: bmpGrid, box: null, diamondNonRadial: null, boxNonRadial: null },
    };
    seedCachesFromBundle(bundle, cache, loader);
    expect(cache.entries().get("arrow_blue_exp_123")).toBe(bmpA);
    expect(loader.getGridImage("diamond")).toBe(bmpGrid);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/shared/render/services/__tests__/card-asset-bundle.test.ts`
Expected: FAIL — module `../card-asset-bundle` not found.

- [ ] **Step 3: Implement `card-asset-bundle.ts`**

```ts
// src/lib/shared/render/services/card-asset-bundle.ts
//
// AssetBundle: a transferable snapshot of every decoded SVG the worker pool
// needs. Built on the MAIN THREAD after a prepare-pass populates the caches;
// seeded into each worker so it NEVER calls createImageBitmap(svgBlob) (which
// fails on the app's SVGs in worker scope).

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { getSvgImageCache, type DrawableImage } from "./svg-image-cache";
import { getSvgAssetLoader } from "./svg-asset-loader";
import type { LoadedAssets } from "./svg-asset-loader";

export interface AssetBundle {
  keys: string[];
  bitmaps: ImageBitmap[];               // index-aligned with keys
  grids: LoadedAssets["grids"];         // four grid drawables (ImageBitmap | null)
}

/** Re-decode any DrawableImage (HTMLImageElement | ImageBitmap) to an ImageBitmap. */
async function toBitmap(img: DrawableImage | null): Promise<ImageBitmap | null> {
  if (!img) return null;
  return createImageBitmap(img as ImageBitmapSource);
}

/**
 * MAIN THREAD. Runs a prepare-pass over the deck to warm the singleton svgCache
 * + svgAssetLoader, then snapshots them as transferable ImageBitmaps.
 *
 * `prepareDeck` is injected (defaults to the real preparer wiring) so the heavy
 * pictograph-preparer import isn't pulled into worker/unit bundles.
 */
export async function buildAssetBundle(
  sequences: SequenceData[],
  opts: { bluePropType: PropType; redPropType: PropType; theme: string },
  prepareDeck: (seqs: SequenceData[], o: typeof opts) => Promise<void>,
): Promise<AssetBundle> {
  await prepareDeck(sequences, opts);

  const cache = getSvgImageCache();
  const loader = getSvgAssetLoader();

  const snapshot = cache.entries();
  const keys: string[] = [];
  const bitmaps: ImageBitmap[] = [];
  for (const [key, drawable] of snapshot) {
    const bmp = await toBitmap(drawable);
    if (bmp) { keys.push(key); bitmaps.push(bmp); }
  }

  const g = loader.snapshotGrids();
  const grids: LoadedAssets["grids"] = {
    diamond: await toBitmap(g.diamond),
    box: await toBitmap(g.box),
    diamondNonRadial: await toBitmap(g.diamondNonRadial),
    boxNonRadial: await toBitmap(g.boxNonRadial),
  };

  return { keys, bitmaps, grids };
}

/** Collect every transferable in a bundle (for postMessage transfer list). */
export function bundleTransferables(bundle: AssetBundle): Transferable[] {
  const t: Transferable[] = [...bundle.bitmaps];
  for (const v of Object.values(bundle.grids)) if (v) t.push(v);
  return t;
}

/** WORKER (or any) THREAD. Populate a cache + loader from a received bundle. */
export function seedCachesFromBundle(
  bundle: AssetBundle,
  cache = getSvgImageCache(),
  loader = getSvgAssetLoader(),
): void {
  for (let i = 0; i < bundle.keys.length; i++) {
    cache.setImage(bundle.keys[i]!, bundle.bitmaps[i]!);
  }
  loader.seedGrids(bundle.grids);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/shared/render/services/__tests__/card-asset-bundle.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/card-asset-bundle.ts src/lib/shared/render/services/__tests__/card-asset-bundle.test.ts
git commit -m "feat(render): AssetBundle build + cache-seed for worker SVG pre-decode" -- src/lib/shared/render/services/card-asset-bundle.ts src/lib/shared/render/services/__tests__/card-asset-bundle.test.ts
```

### Task 0.4: Wire prepare-pass + bundle build behind a main-thread helper

**Files:**
- Create: `src/lib/shared/render/services/get-card-asset-bundle.ts`
- Test: none (thin wiring; covered by Phase 1 parity harness).

`buildAssetBundle` takes an injected `prepareDeck`. This helper supplies the real one using the existing preparer getter, keeping the preparer import out of the worker bundle.

- [ ] **Step 1: Implement the helper**

```ts
// src/lib/shared/render/services/get-card-asset-bundle.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { buildAssetBundle, type AssetBundle } from "./card-asset-bundle";
import { getPictographPreparer } from "$lib/shared/pictograph/getPictographPreparer";

/** Flatten a deck's steps + start positions into PictographData for preparation. */
function deckPictographs(sequences: SequenceData[]) {
  const out: unknown[] = [];
  for (const seq of sequences) {
    if (seq.startPosition) out.push(seq.startPosition);
    for (const step of seq.steps ?? []) out.push(step);
  }
  return out as Parameters<ReturnType<typeof getPictographPreparer>["prepareBatch"]>[0];
}

export function getCardAssetBundle(
  sequences: SequenceData[],
  opts: { bluePropType: PropType; redPropType: PropType; theme: string },
): Promise<AssetBundle> {
  return buildAssetBundle(sequences, opts, async (seqs, o) => {
    const preparer = getPictographPreparer();
    await preparer.prepareBatch(deckPictographs(seqs), {
      themeMode: "light",
      bluePropType: o.bluePropType,
      redPropType: o.redPropType,
    });
  });
}
```

> Before implementing, grep `getPictographPreparer` to confirm the exact import path and that `prepareBatch` accepts `{ themeMode, bluePropType, redPropType }` (it does — see `pictograph-preparer.ts:36` + `PrepareOptions`). If the getter lives elsewhere, use that path.

- [ ] **Step 2: Typecheck this file only**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep get-card-asset-bundle` (expect no output = clean) — or rely on `check:watch` if running.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/render/services/get-card-asset-bundle.ts
git commit -m "feat(render): main-thread card AssetBundle helper (prepare-pass wiring)" -- src/lib/shared/render/services/get-card-asset-bundle.ts
```

### Task 0.5: Dispatcher — accept bundle at init + seed worker; flip probe

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts`
- Modify: `src/lib/shared/render/workers/composition.worker.ts`

- [ ] **Step 1: Extend the init message + worker seed**

In `composition-dispatcher.ts`, change the `init` variant of `CompositionWorkerInMessage` (line 19) to carry the bundle:

```ts
  | { type: "init"; glyphs: ImageBitmap[]; glyphMeta: GlyphTransferEntry[]; bundle: import("./card-asset-bundle").AssetBundle }
```

In `initPool()` (line 225), build the bundle is the CALLER's job (Task 1.x passes it in). For now, thread an optional `bundle` field on the dispatcher set before init. Add a private field + setter:

```ts
  private pendingBundle: import("./card-asset-bundle").AssetBundle | null = null;
  setAssetBundle(bundle: import("./card-asset-bundle").AssetBundle): void {
    this.pendingBundle = bundle;
  }
```

In `initPool`, when posting the init message (line 282-288), include a per-worker CLONE of the bundle bitmaps (transfer consumes originals — mirror the glyph-clone at line 271):

```ts
    const bundle = this.pendingBundle;
    let bundleClone: import("./card-asset-bundle").AssetBundle = { keys: [], bitmaps: [], grids: { diamond: null, box: null, diamondNonRadial: null, boxNonRadial: null } };
    const bundleTransfer: Transferable[] = [];
    if (bundle) {
      const clonedBmps = await Promise.all(bundle.bitmaps.map((b) => createImageBitmap(b)));
      const cloneGrid = async (g: ImageBitmap | null) => (g ? await createImageBitmap(g) : null);
      bundleClone = {
        keys: [...bundle.keys],
        bitmaps: clonedBmps,
        grids: {
          diamond: await cloneGrid(bundle.grids.diamond),
          box: await cloneGrid(bundle.grids.box),
          diamondNonRadial: await cloneGrid(bundle.grids.diamondNonRadial),
          boxNonRadial: await cloneGrid(bundle.grids.boxNonRadial),
        },
      };
      bundleTransfer.push(...clonedBmps);
      for (const v of Object.values(bundleClone.grids)) if (v) bundleTransfer.push(v);
    }

    const initMessage: CompositionWorkerInMessage = {
      type: "init", glyphs: clonedBitmaps, glyphMeta, bundle: bundleClone,
    };
    worker.postMessage(initMessage, [...clonedBitmaps, ...bundleTransfer]);
```

In `composition.worker.ts` `handleInit` (line 88), accept + seed. Change signature to `handleInit(glyphs, glyphMeta, bundle)` and after the pipeline is built (after line 137), before `postResult({ type: "init-done" })`:

```ts
  const { seedCachesFromBundle } = await import("../services/card-asset-bundle");
  seedCachesFromBundle(bundle);
```

Update the router (line 249-258) to pass `msg.bundle` into `handleInit`.

- [ ] **Step 2: Flip `detectWorkerSupport` to a probe**

Replace the body of `detectWorkerSupport()` (line 77-83) with a deferred async probe. Because `canUseWorker()` is sync, restructure: keep `canUseWorker()` returning the cached value, but add `async probeWorkerSupport(): Promise<boolean>` that the caller (PrintPreviewPages) awaits before its first dispatch:

```ts
  static async probeWorkerSupport(): Promise<boolean> {
    if (CompositionDispatcher.workerSupport !== null) return CompositionDispatcher.workerSupport;
    // Feature gate first.
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
      return (CompositionDispatcher.workerSupport = false);
    }
    try {
      const ok = await CompositionDispatcher.runProbe();
      return (CompositionDispatcher.workerSupport = ok);
    } catch {
      return (CompositionDispatcher.workerSupport = false);
    }
  }

  // Bootstraps via the SVG-free back paint path: a minimal proof-mode BackJob
  // needs NO seeded bundle (mandala is Path2D, decorations null), so it verifies
  // init -> OffscreenCanvas -> paint -> transfer end to end.
  private static runProbe(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const w = new Worker(new URL("../workers/composition.worker.ts", import.meta.url), { type: "module" });
      const timeout = setTimeout(() => { w.terminate(); resolve(false); }, 8000);
      w.onerror = () => { clearTimeout(timeout); w.terminate(); resolve(false); };
      w.onmessage = (e: MessageEvent) => {
        const d = e.data;
        if (d?.type === "probe-result") {
          clearTimeout(timeout); w.terminate(); resolve(!!d.ok);
        }
      };
      w.postMessage({ type: "probe" });
    });
  }
```

Keep `detectWorkerSupport()` deleted/inlined; `canUseWorker()` now just returns the cached `workerSupport` (and returns `false` if never probed).

- [ ] **Step 3: Add the `probe` handler in the worker**

In `composition.worker.ts`, extend the in-message type (mirror in dispatcher) with `| { type: "probe" }` and add to the router:

```ts
    case "probe":
      (async () => {
        try {
          const { paintBackJob } = await import("$lib/features/choreo-card/services/card-back/card-back-raster");
          const job = {
            width: 64, height: 64, bleedPx: 4,
            borderGradient: { type: "linear", angleDeg: 0, stops: [{ offset: 0, color: "#000" }, { offset: 1, color: "#000" }] },
            bgGradient: { type: "linear", angleDeg: 0, stops: [{ offset: 0, color: "#fff" }, { offset: 1, color: "#fff" }] },
            decorations: null, mandala: null, bitmaps: [],
          };
          const off = paintBackJob(job as never);
          const ctx = off.getContext("2d")!;
          const px = ctx.getImageData(0, 0, off.width, off.height).data;
          let nonZero = 0;
          for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) nonZero++;
          (self as unknown as Worker).postMessage({ type: "probe-result", ok: nonZero > 0 });
        } catch (err) {
          (self as unknown as Worker).postMessage({ type: "probe-result", ok: false, error: String(err) });
        }
      })();
      break;
```

> `card-back-raster.ts` imports only `renderMandalaToCanvas` + canvas ops — confirm it pulls nothing SvelteKit-coupled before relying on it (read its import block). If it does, fall back to a gradient-only probe (fill an OffscreenCanvas, sample alpha) instead.

- [ ] **Step 4: Typecheck (changed files only via check:watch, or scoped tsc)**

Run: `npx vitest run src/lib/shared/render/services/__tests__/card-asset-bundle.test.ts` (still green — no regression to the bundle module).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/workers/composition.worker.ts
git commit -m "feat(render): worker init seeds AssetBundle; probe-once worker support gate" -- src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/workers/composition.worker.ts
```

### Task 0.6: Raise pool size to cores-1 (uncapped)

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts:52`

- [ ] **Step 1: Change `POOL_SIZE`**

```ts
// Was: Math.max(1, Math.min((navigator?.hardwareConcurrency || 4) - 1, 4));
const POOL_SIZE = Math.max(1, (navigator?.hardwareConcurrency || 4) - 1);
```

- [ ] **Step 2: Add the peak-memory note as a comment above it**

```ts
// One in-flight 1644x2244 RGBA card canvas per worker ≈ 14.7 MB; N = cores-1
// → up to ~220 MB transient on a 16-core machine. Acceptable on the desktop
// deck-rendering target. Revisit if memory profiling shows pressure.
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/render/services/composition-dispatcher.ts
git commit -m "perf(render): worker pool size = cores-1 (uncapped) for card batches" -- src/lib/shared/render/services/composition-dispatcher.ts
```

---

# PHASE 1 — Front rendering through the worker pool

Goal: route `renderFront` through the seeded worker pool. The front pipeline (`composeSequenceImage`) is reused verbatim in-worker; only routing + bundle-init + parity/perf are new.

### Task 1.1: Build + set the bundle in PrintPreviewPages before the render loop

**Files:**
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte:293-356`

- [ ] **Step 1: Import the bundle helper + dispatcher getter**

At the top script block, add:

```ts
import { getCardAssetBundle } from "$lib/shared/render/services/get-card-asset-bundle";
import { getCompositionDispatcher } from "$lib/shared/render/services/get-composition-dispatcher";
```

> Grep for the existing dispatcher getter; if none, the renderer constructs it. In that case expose `getPrintCardRenderer().dispatcher` or add `getCompositionDispatcher()`. Confirm the path before writing.

- [ ] **Step 2: In `renderAll`, before Phase 3 (line ~343), probe + build + set bundle on the uncached path**

```ts
    // Worker fast-path setup: probe once, build the deck's asset bundle, seed workers.
    let useWorker = false;
    try {
      useWorker = await CompositionDispatcher.probeWorkerSupport();
      if (useWorker && generation === renderGeneration) {
        const bundle = await getCardAssetBundle(seqs, {
          bluePropType: resolvedBlueProp, redPropType: resolvedRedProp, theme,
        });
        getCompositionDispatcher().setAssetBundle(bundle);
      }
    } catch (e) {
      console.warn("[PrintPreview] worker setup failed, main-thread path:", e);
      useWorker = false;
    }
    if (generation !== renderGeneration) return;
```

Import `CompositionDispatcher` (class, for the static probe) alongside the getter.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "feat(choreo-card): probe + build worker AssetBundle before deck render" -- src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
```

### Task 1.2: Route renderFront through the dispatcher

**Files:**
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts:93-196`

The front canvas is currently built by `composeSequenceImage` then wrapped in stripes/bleed. To use the worker, the worker must produce the SAME final front canvas (stripes + bleed + sequence image). Two options — pick the one that holds parity:

(a) Worker returns the inner `sequenceCanvas` (composeSequenceImage output) as `ImageBitmap`; main thread does the cheap stripe/bleed wrap (steps 2-6 of `renderFront`, all canvas ops, ~1ms). **Recommended** — keeps the deterministic stripe/glow on the main thread, worker does only the heavy pictograph composite.

- [ ] **Step 1: Add a dispatcher method that returns the inner sequence ImageBitmap**

In `composition-dispatcher.ts`, the existing `compose()` returns a `Blob`. Add `composeFrontBitmap(sequence, options): Promise<ImageBitmap>` that posts the existing `compose` message but resolves with the raw `ImageBitmap` (skip the blob conversion at line 173-182). Reuse `composeOnWorker` plumbing; add a result mode flag on the pending request (`wantBitmap: true`) so `handleWorkerMessage` resolves the bitmap directly instead of converting to blob.

- [ ] **Step 2: In `renderFront`, branch on worker availability**

Refactor `renderFront` so the inner `sequenceCanvas` comes from the worker when available:

```ts
    let sequenceCanvas: RenderCanvas;
    const dispatcher = getCompositionDispatcher();
    if (CompositionDispatcher.canUseWorker()) {
      try {
        const bmp = await dispatcher.composeFrontBitmap(sequence, /* the same options object built below */ composeOptions);
        sequenceCanvas = bmp as unknown as RenderCanvas; // drawImage accepts ImageBitmap
      } catch (e) {
        console.warn("[PrintCardRenderer] front worker failed, main-thread:", e);
        sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);
      }
    } else {
      sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);
    }
```

Extract the big options object (current lines 108-158) into a `composeOptions` const above the branch so both paths use the identical options. The downstream `ctx.drawImage(sequenceCanvas, ...)` (line 190) already accepts `ImageBitmap`.

- [ ] **Step 3: Verify the front options carry `cardMode`/deckCard correctly for the worker**

The worker's `handleCompose` (line 201) branches on `effectiveOptions.cardMode`. The front uses `deckCard: { contentWidth, contentHeight }`, NOT `cardMode`, so it hits `composeSequenceImage` in-worker — correct. No change needed; just confirm.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/shared/render/services/composition-dispatcher.ts
git commit -m "feat(choreo-card): renderFront uses worker pool for the pictograph composite" -- src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/shared/render/services/composition-dispatcher.ts
```

### Task 1.3: Front parity gate (harness)

**Files:**
- Modify: `src/routes/test/card-back-parity/+page.svelte` (add a "Fronts" mode)

- [ ] **Step 1: Add a front-parity path** that renders the SAME sequence two ways: worker (force `canUseWorker` true after probe + bundle) vs main-thread (force false). Draw both inner sequence bitmaps to side-by-side canvases; compute per-pixel max delta + % differing pixels.

- [ ] **Step 2: Cover the matrix** — each theme × prop × {loop, no-loop} × {float, mixed turns, 0T} × level {1,2,3} × {with, without start position}. Render a sortable table of worst-case delta per cell.

- [ ] **Step 3: Run the harness** — open `/test/card-back-parity` (fronts mode) in the browser; report worst-case delta. **Gate:** worker output pixel-identical within AA tolerance (< 0.5% differing, max delta ≤ small epsilon). If a cell drifts, diagnose (font fallback in worker? a non-seeded asset?) and fix before proceeding. Do NOT claim parity without harness output.

- [ ] **Step 4: Commit**

```bash
git add src/routes/test/card-back-parity/+page.svelte
git commit -m "test(choreo-card): front worker-vs-main parity harness" -- src/routes/test/card-back-parity/+page.svelte
```

### Task 1.4: Front perf measurement

- [ ] **Step 1: Measure** a 50-card deck via `PrintPreviewPages`: wall-clock for fronts, worker pool vs main-thread baseline (`performance.now()` around the lane loop). Add a temporary `console.table` of total + per-core scaling.
- [ ] **Step 2: Report the numbers** in this turn. If the worker path is NOT faster on the batch, STOP and report — the gate for keeping the worker path is a measured win.
- [ ] **Step 3: One cold `npm run check` into a log; fix any types in changed files; commit any fixes.**

```bash
npm run check > /tmp/check-p1.log 2>&1; grep -niE "error" /tmp/check-p1.log
```

---

# PHASE 2 — Back rendering through the worker pool

Goal: route the FULL back render (`buildBackJob` + `paintBackJob`) into the worker. The DOM-coupled constant rasterizers are pre-built once per deck on the main thread and injected via `buildBackJob`'s `deps`.

### Task 2.1: Pre-build constant back bitmaps once per deck

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/build-constant-bitmaps.ts`
- Test: `.../card-back/__tests__/build-constant-bitmaps.test.ts` (jsdom: assert keying + caching)

The constants are: brand (per theme), url (per theme), difficulty badge (per level 1/2/3), loop icons (per component+color+quartered). Collect the set the deck needs, build each once (main-thread DOM rasterize), key them so the worker can look them up.

- [ ] **Step 1: Define the bundle shape + builder**

```ts
// build-constant-bitmaps.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import {
  rasterizeBrand, rasterizeUrl, rasterizeDifficultyBadge, rasterizeLoopIcon, LOOP_ICONS,
} from "./card-back-bitmaps-constant";

export interface ConstantBackBitmaps {
  brand: ImageBitmap;                       // theme-constant (deck = one theme)
  url: ImageBitmap;
  badges: Record<number, ImageBitmap>;      // level -> bitmap
  loopIcons: Record<string, ImageBitmap>;   // `${component}|${color}|${quartered}` -> bitmap
}

function loopIconKey(component: string, color: string, quartered: boolean) {
  return `${component}|${color}|${quartered}`;
}

export async function buildConstantBackBitmaps(
  sequences: SequenceData[],
  theme: string,
): Promise<ConstantBackBitmaps> {
  const brand = await rasterizeBrand(theme);
  const url = await rasterizeUrl(theme);

  const levels = new Set<number>();
  const icons = new Map<string, { component: string; color: string; quartered: boolean }>();
  for (const seq of sequences) {
    const lvl = seq.level ?? 1; levels.add(lvl);
    // Surface the same loop components CardBack does (see resolveLoopDisplay usage in buildBackJob).
    // Enumerate from LOOP_ICONS for the deck's loop types — mirror buildBackJob's loop-row logic.
  }
  const badges: Record<number, ImageBitmap> = {};
  for (const lvl of levels) badges[lvl] = await rasterizeDifficultyBadge(lvl);

  const loopIcons: Record<string, ImageBitmap> = {};
  for (const { component, color, quartered } of icons.values()) {
    loopIcons[loopIconKey(component, color, quartered)] = await rasterizeLoopIcon(component, color, quartered);
  }
  return { brand, url, badges, loopIcons };
}

export { loopIconKey };
```

> Before finalizing, read `buildBackJob` (lines 261-420) to copy the EXACT loop-component enumeration (`resolveLoopDisplay`) + the exact args passed to `rasterizeLoopIcon`/`rasterizeDifficultyBadge`, so the worker's injected deps reproduce the same keys. The enumeration in Step 1 (`// Enumerate ...`) MUST be replaced with that real logic — no placeholder ships.

- [ ] **Step 2: Test** that two calls for the same deck reuse the rasterizer caches (the underlying `card-back-bitmaps-constant` caches by theme/level/icon), and that `badges`/`loopIcons` keys match `loopIconKey`.
- [ ] **Step 3: Run → PASS. Commit.**

```bash
git add src/lib/features/choreo-card/services/card-back/build-constant-bitmaps.ts src/lib/features/choreo-card/services/card-back/__tests__/build-constant-bitmaps.test.ts
git commit -m "feat(choreo-card): pre-build constant back bitmaps per deck for worker injection" -- src/lib/features/choreo-card/services/card-back/build-constant-bitmaps.ts src/lib/features/choreo-card/services/card-back/__tests__/build-constant-bitmaps.test.ts
```

### Task 2.2: Worker deps factory — inject constants into buildBackJob

**Files:**
- Create: `src/lib/features/choreo-card/services/card-back/worker-back-deps.ts`
- Test: `.../__tests__/worker-back-deps.test.ts`

- [ ] **Step 1: Build a `Partial<BuildBackJobDeps>` that returns pre-built constants** instead of DOM-rasterizing, and lets the per-card rasterizers (turn/reversal/stepCount/loopRow/startPos/decorations/mandala) fall through to `realDeps` (all canvas-native / Path2D / seeded-cache, worker-safe).

```ts
// worker-back-deps.ts
import type { BuildBackJobDeps } from "./card-back-job-builder";
import type { ConstantBackBitmaps } from "./build-constant-bitmaps";
import { loopIconKey } from "./build-constant-bitmaps";

/** Deps overrides that serve pre-built constant bitmaps (no DOM in-worker). */
export function workerBackDeps(c: ConstantBackBitmaps): Partial<BuildBackJobDeps> {
  return {
    rasterizeBrand: async () => c.brand,
    rasterizeUrl: async () => c.url,
    rasterizeDifficultyBadge: async (level: number) => c.badges[level] ?? c.badges[1]!,
    rasterizeLoopIcon: async (component: string, color: string, quartered: boolean) =>
      c.loopIcons[loopIconKey(component, color, quartered)]!,
  };
}
```

> Confirm the real signatures of `rasterizeBrand`/`rasterizeUrl`/`rasterizeDifficultyBadge`/`rasterizeLoopIcon` (args + return `Promise<ImageBitmap>`) from `card-back-bitmaps-constant.ts` and match them EXACTLY. `rasterizeLoopRow` composes icons + labels per card — leave it to `realDeps` (it consumes per-icon bitmaps that the loop-icon override now serves), unless reading it shows it DOM-mounts; if so, override it too.

- [ ] **Step 2: Test** `workerBackDeps(c).rasterizeBrand()` resolves `c.brand`; badge fallback works for an unknown level.
- [ ] **Step 3: Run → PASS. Commit.**

```bash
git add src/lib/features/choreo-card/services/card-back/worker-back-deps.ts src/lib/features/choreo-card/services/card-back/__tests__/worker-back-deps.test.ts
git commit -m "feat(choreo-card): worker buildBackJob deps serve pre-built constant bitmaps" -- src/lib/features/choreo-card/services/card-back/worker-back-deps.ts src/lib/features/choreo-card/services/card-back/__tests__/worker-back-deps.test.ts
```

### Task 2.3: compose-back message + dispatcher.composeBack

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts`
- Modify: `src/lib/shared/render/workers/composition.worker.ts`

- [ ] **Step 1: Extend the in-message** with:

```ts
  | { type: "compose-back"; id: number; sequence: SequenceData; opts: { width: number; height: number; bleedPx: number; theme: string }; constants: ConstantBackTransfer }
```

where `ConstantBackTransfer` is `ConstantBackBitmaps` flattened to parallel arrays for transfer (`brand`, `url`, `badgeLevels[]`+`badgeBitmaps[]`, `iconKeys[]`+`iconBitmaps[]`). Add a `composeBack(sequence, opts, constants): Promise<ImageBitmap>` on the dispatcher mirroring `composeFrontBitmap` plumbing, with all constant `ImageBitmap`s in the transfer list.

- [ ] **Step 2: Worker `handleComposeBack`** — reconstruct `ConstantBackBitmaps` from the transfer arrays, then:

```ts
  const { buildBackJob } = await import("$lib/features/choreo-card/services/card-back/card-back-job-builder");
  const { paintBackJob } = await import("$lib/features/choreo-card/services/card-back/card-back-raster");
  const { workerBackDeps } = await import("$lib/features/choreo-card/services/card-back/worker-back-deps");
  const job = await buildBackJob(sequence, opts, workerBackDeps(constants));
  const off = paintBackJob(job);
  const bitmap = off.transferToImageBitmap();
  postResult({ type: "result", id, bitmap }, [bitmap]);
```

> Confirm `card-back-job-builder.ts` imports nothing SvelteKit-coupled at module scope (it imports mandala constants, `getMandalaGeometryCalculator` [dynamic-safe?], `deriveCardBackData`, `getCardBackThemeVisuals`, `resolveLoopDisplay`). If any of those crash worker init, dynamic-import them inside `handleComposeBack` (already done above for the builder) and verify. If a transitive import hard-crashes, that card type falls back to tier 2 — log it.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/workers/composition.worker.ts
git commit -m "feat(render): compose-back worker message runs full buildBackJob+paint in-worker" -- src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/workers/composition.worker.ts
```

### Task 2.4: Route renderBack through the pool

**Files:**
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts:198-237`
- Modify: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte` (build + pass constants)

- [ ] **Step 1: In PrintPreviewPages**, alongside the AssetBundle build (Task 1.1), build the constant back bitmaps once per deck and hold them for the render loop:

```ts
import { buildConstantBackBitmaps } from "$lib/features/choreo-card/services/card-back/build-constant-bitmaps";
// after bundle build, on the worker path:
const backConstants = await buildConstantBackBitmaps(seqs, theme);
```

Pass `backConstants` into the renderer call (extend `renderBack` signature or stash on the renderer).

- [ ] **Step 2: In `renderBack`**, branch on worker availability (keep the existing two fallback tiers):

```ts
    const dispatcher = getCompositionDispatcher();
    if (CompositionDispatcher.canUseWorker() && constants) {
      try {
        const bmp = await dispatcher.composeBack(sequence, { width: canvasWidth*scale, height: canvasHeight*scale, bleedPx: bleedPx*scale, theme }, constants);
        const out = document.createElement("canvas");
        out.width = bmp.width; out.height = bmp.height;
        out.getContext("2d")!.drawImage(bmp, 0, 0);
        return out;
      } catch (e) {
        console.warn("[PrintCardRenderer] back worker failed, main-thread:", e);
      }
    }
    // tier 2: existing main-thread buildBackJob + paintBackJob (current code) ...
    // tier 3: existing renderCardBack DOM fallback ...
```

- [ ] **Step 3: Commit.**

```bash
git add src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "feat(choreo-card): renderBack runs full build+paint in worker pool" -- src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
```

### Task 2.5: Back parity gate + perf + retire decision

**Files:**
- Modify: `src/routes/test/card-back-parity/+page.svelte` (backs already covered — add worker mode)

- [ ] **Step 1: Run the back parity harness** with the worker path active — same matrix as Phase 1, same gate (worker back === main-thread back within AA tolerance). Report worst-case delta.
- [ ] **Step 2: Measure** a 50-card deck: full front+back wall-clock, worker pool vs main-thread baseline. Report the numbers + per-core scaling.
- [ ] **Step 3: One cold `npm run check` into a log; fix any types; commit.**

```bash
npm run check > /tmp/check-p2.log 2>&1; grep -niE "error" /tmp/check-p2.log
git add <changed files> && git commit -m "test(choreo-card): back worker parity + full-deck perf" -- <changed files>
```

---

## Notes for the implementer

- **Parity is the hard requirement.** Both phases gate on the pixel-diff harness, not unit tests. Never report parity without harness output (project verification-protocol rule).
- **Fast loop:** use `npm run check:watch` while iterating; ONE cold `npm run check` per phase at the commit gate. Never `npm run build`/full `check` in the inner loop. Never `npm run dev` / never touch port 5173.
- **The worker decodes NO SVG.** Every `getImage()`/grid lookup must hit the seeded cache. If the parity harness shows a missing asset (blank prop/arrow/letter), the prepare-pass in `getCardAssetBundle` didn't surface it — fix the enumeration, don't add in-worker decode.
- **Round-trip safety net (optional, only if a real miss appears):** if the harness surfaces a systematic miss that the prepare-pass can't cover, add a `decode-request`/`decode-response` message pair (worker asks main thread to decode one SVG, transfers it back, worker `setImage`s it). Spec'd but should not be needed — implement only if a miss is observed.
- **Commit discipline:** explicit pathspec on EVERY commit. The index is shared with other agents — never sweep unrelated files.
- **MCP-only for any TKA rendering** during testing (no inline pictograph scripts).

---

## SESSION STATUS

Plan written 2026-05-29. Spec: `docs/superpowers/specs/active/2026-05-29-worker-pool-card-rendering-design.md`. Predecessor Phase 1 (main-thread BackJob) + the Path2D-mandala/canvas-glyph work are shipped (commit `a0a8804ea`); backs are 52ms warm. This plan adds the worker pool for fronts (Phase 1) + backs (Phase 2) on the proven AssetBundle-seeding architecture.
