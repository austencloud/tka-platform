# Worker-Pool Front Render — Wiring + Pre-Warm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the deck card-front render through the existing OffscreenCanvas worker pool, pre-warmed the moment a deck's sequences are known, so cold deck draws render fast and the main thread stays responsive — zero pixel change.

**Architecture:** A fire-and-forget `prewarmCardPool` runs `probe → getCardAssetBundle → setAssetBundle → ensureInitialized` at `loadSelectedSequences` (the single seam both releaser-draw and view-release funnel through). The dispatcher tracks a bundle **signature** so a deck change does `terminate()` + re-seed. `PrintCardRenderer.renderFront` routes through `composeFrontBitmap` when `canUseWorker()`, pre-generating the QR on the main thread and passing it to the worker; the frame wrap stays main-thread. Any worker failure or probe=false falls back to the unchanged main-thread compose. `PrintPreviewPages`' existing concurrency lanes now feed the pool unchanged.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, Vite module workers, OffscreenCanvas, Vitest.

**Spec:** `docs/superpowers/specs/active/2026-05-31-worker-pool-prewarm-wiring-design.md` (extends `2026-05-30-multicore-deck-front-render-design.md`).

**Deviation from spec — `PrintPreviewPages` unchanged.** The spec's piece 6 (drop the 8-lane cap; render QR per card in `PrintPreviewPages`) is dropped as unnecessary: once `renderFront` is worker-backed and owns its own QR pre-gen, the existing `RENDER_CONCURRENCY` lanes already dispatch fronts to the pool concurrently (the pool caps at 8 internally), and QR ownership lives in `renderFront`. Less surface area, same win. The 8-lane cap is now redundant but harmless; leave it.

**Files (3 modified, 1 created):**

- **Create** `src/lib/shared/render/services/card-pool-prewarm.ts` — `computeBundleSignature` (pure) + `prewarmCardPool` (fire-and-forget orchestration).
- **Modify** `src/lib/shared/render/services/composition-dispatcher.ts` — `pendingSignature`/`seededSignature` fields, `setPendingSignature`, `getSeededSignature`, set seeded at init, clear on terminate.
- **Modify** `src/lib/features/choreo-card/services/PrintCardRenderer.ts` — `renderFront` worker path + main-thread QR pre-gen + per-card fallback.
- **Modify** `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` — one `prewarmCardPool(...)` call at the end of `loadSelectedSequences`.

**Already in code (no task needed):** pool cap 8 + parallel seed (`composition-dispatcher.ts:68,485`); `composeFrontBitmap(sequence, options, qrBitmap)` returns unframed inner when `frontCardFrame` absent (`:249`); worker composites a supplied `qrBitmap` + skips worker-side QR (`composition.worker.ts`); QR draw gate `qrCodeGenerator || qrImageBitmap` (`card-front-assembler.ts:293`); `wrapContentInCardFrame(content, opts, createCanvas)` (`card-front-frame.ts:105`); `buildFrontComposeOptions` (`build-front-compose-options.ts:45`).

---

### Task 1: Dispatcher bundle-signature tracking

**Files:**
- Modify: `src/lib/shared/render/services/composition-dispatcher.ts`
- Test: `src/lib/shared/render/services/__tests__/composition-dispatcher-signature.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/shared/render/services/__tests__/composition-dispatcher-signature.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CompositionDispatcher } from "../composition-dispatcher";

// Minimal stubs — signature tracking never touches the composer/text renderer.
const stub = {} as never;

describe("CompositionDispatcher signature tracking", () => {
  it("starts with a null seeded signature", () => {
    const d = new CompositionDispatcher(stub, stub);
    expect(d.getSeededSignature()).toBeNull();
  });

  it("clears the seeded signature on terminate", () => {
    const d = new CompositionDispatcher(stub, stub);
    // Force a seeded signature without spawning workers.
    (d as unknown as { seededSignature: string | null }).seededSignature = "sig-abc";
    expect(d.getSeededSignature()).toBe("sig-abc");
    d.terminate();
    expect(d.getSeededSignature()).toBeNull();
  });

  it("setPendingSignature records the signature to seed at next init", () => {
    const d = new CompositionDispatcher(stub, stub);
    d.setPendingSignature("sig-xyz");
    expect((d as unknown as { pendingSignature: string | null }).pendingSignature).toBe("sig-xyz");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/render/services/__tests__/composition-dispatcher-signature.test.ts`
Expected: FAIL — `getSeededSignature` / `setPendingSignature` are not functions.

- [ ] **Step 3: Add the fields + methods**

In `composition-dispatcher.ts`, add two fields beside `pendingBundle` (~line 84):

```ts
  private pendingBundle: import("./card-asset-bundle").AssetBundle | null = null;
  private pendingOverrideBundle: import("./override-placement-bundle").OverridePlacementBundle | null = null;
  private pendingSignature: string | null = null;
  private seededSignature: string | null = null;
```

Add methods next to `setOverrideBundle` (~line 101):

```ts
  /** Record the bundle signature that the next initPool will mark as seeded. */
  setPendingSignature(signature: string): void {
    this.pendingSignature = signature;
  }

  /** The signature of the bundle the pool is currently seeded with (null if unseeded). */
  getSeededSignature(): string | null {
    return this.seededSignature;
  }
```

In `initPool`, at the very end of the method (after `this.initialized = true;`, ~line 492):

```ts
    this.initialized = true;
    this.initializing = null;
    this.seededSignature = this.pendingSignature;
```

In `terminate()` (~line 506), add the clear alongside the existing resets:

```ts
  terminate(): void {
    for (const entry of this.workers) {
      entry.worker.terminate();
    }
    this.workers = [];
    this.initialized = false;
    this.initializing = null;
    this.seededSignature = null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/render/services/__tests__/composition-dispatcher-signature.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/services/__tests__/composition-dispatcher-signature.test.ts
git commit -m "feat(render): bundle-signature tracking on CompositionDispatcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- src/lib/shared/render/services/composition-dispatcher.ts src/lib/shared/render/services/__tests__/composition-dispatcher-signature.test.ts
```

---

### Task 2: `card-pool-prewarm.ts` — signature + fire-and-forget orchestration

**Files:**
- Create: `src/lib/shared/render/services/card-pool-prewarm.ts`
- Test: `src/lib/shared/render/services/__tests__/card-pool-prewarm.test.ts`

- [ ] **Step 1: Write the failing test (the pure signature core)**

Create `src/lib/shared/render/services/__tests__/card-pool-prewarm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeBundleSignature } from "../card-pool-prewarm";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const seq = (id: string) => ({ id, word: id, steps: [] }) as unknown as SequenceData;
const base = {
  sequences: [seq("a"), seq("b")],
  bluePropType: "staff" as const,
  redPropType: "staff" as const,
  theme: "cosmic",
};

describe("computeBundleSignature", () => {
  it("is stable for the same inputs regardless of sequence order", () => {
    const s1 = computeBundleSignature(base);
    const s2 = computeBundleSignature({ ...base, sequences: [seq("b"), seq("a")] });
    expect(s1).toBe(s2);
  });

  it("changes when a sequence id set changes", () => {
    const s1 = computeBundleSignature(base);
    const s2 = computeBundleSignature({ ...base, sequences: [seq("a"), seq("c")] });
    expect(s1).not.toBe(s2);
  });

  it("changes when prop types change", () => {
    const s1 = computeBundleSignature(base);
    const s2 = computeBundleSignature({ ...base, redPropType: "fan" as never });
    expect(s1).not.toBe(s2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/render/services/__tests__/card-pool-prewarm.test.ts`
Expected: FAIL — cannot find module / `computeBundleSignature` not exported.

- [ ] **Step 3: Create the module**

Create `src/lib/shared/render/services/card-pool-prewarm.ts`:

```ts
// src/lib/shared/render/services/card-pool-prewarm.ts
//
// Pre-warm the OffscreenCanvas card-render pool the moment a deck's sequences
// are known (before the print preview mounts), so the ~5s asset-bundle seed
// overlaps the user's navigation and every cold deck — small or large — hits the
// warm worker path. Fire-and-forget; any failure leaves canUseWorker()===false
// and the render falls back to the main thread (no regression).

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { CompositionDispatcher } from "./composition-dispatcher";
import { getCompositionDispatcher } from "../get-composition-dispatcher";
import { getCardAssetBundle } from "./get-card-asset-bundle";
import { buildOverridePlacementBundle } from "./override-placement-bundle";

export interface PrewarmOptions {
  sequences: SequenceData[];
  bluePropType: PropType;
  redPropType: PropType;
  theme: string;
  iconPaths?: string[];
}

// Bumped when the worker render contract changes in a way that invalidates a
// seeded pool. Mirrors the spirit of PrintPreviewPages' CARD_RENDER_SCHEMA.
const SEED_SCHEMA = "v1";

/**
 * Deterministic signature of the asset bundle a deck needs. Sequence order does
 * not matter (ids are sorted); prop types and the seed schema do. Two decks with
 * the same signature can share a seeded pool; a different signature forces a
 * re-seed.
 */
export function computeBundleSignature(opts: {
  sequences: SequenceData[];
  bluePropType: PropType;
  redPropType: PropType;
}): string {
  const ids = opts.sequences
    .map((s) => s.id ?? s.word ?? "")
    .filter(Boolean)
    .sort()
    .join(",");
  return [SEED_SCHEMA, opts.bluePropType, opts.redPropType, ids].join("|");
}

/**
 * Fire-and-forget: probe worker support, build + seed the deck's asset bundle
 * into the pool. Idempotent — a second call for the same deck signature is a
 * no-op; a different signature terminates the stale pool and re-seeds. Never
 * throws (errors are swallowed → main-thread fallback).
 */
export function prewarmCardPool(opts: PrewarmOptions): void {
  void (async () => {
    try {
      if (opts.sequences.length === 0) return;
      const ok = await CompositionDispatcher.probeWorkerSupport();
      if (!ok) return;

      const dispatcher = getCompositionDispatcher();
      const signature = computeBundleSignature(opts);
      if (dispatcher.getSeededSignature() === signature) return; // already hot

      const bundle = await getCardAssetBundle(opts.sequences, {
        bluePropType: opts.bluePropType,
        redPropType: opts.redPropType,
        theme: opts.theme,
        iconPaths: opts.iconPaths,
      });

      // Different deck already seeded → tear down so re-init reseeds cleanly.
      if (dispatcher.getSeededSignature() !== null) dispatcher.terminate();

      dispatcher.setAssetBundle(bundle);
      dispatcher.setOverrideBundle(buildOverridePlacementBundle());
      dispatcher.setPendingSignature(signature);
      await dispatcher.ensureInitialized();
    } catch (err) {
      console.warn("[prewarmCardPool] pre-warm failed (main-thread fallback stays):", err);
    }
  })();
}
```

Note: `ensureInitialized` is `private` on the dispatcher today. Change it to `public` (it is the documented seed trigger):

In `composition-dispatcher.ts`, change `private async ensureInitialized()` (~line 372) to `async ensureInitialized()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/render/services/__tests__/card-pool-prewarm.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/render/services/card-pool-prewarm.ts src/lib/shared/render/services/__tests__/card-pool-prewarm.test.ts src/lib/shared/render/services/composition-dispatcher.ts
git commit -m "feat(render): prewarmCardPool + computeBundleSignature

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- src/lib/shared/render/services/card-pool-prewarm.ts src/lib/shared/render/services/__tests__/card-pool-prewarm.test.ts src/lib/shared/render/services/composition-dispatcher.ts
```

---

### Task 3: `PrintCardRenderer.renderFront` — worker path + main-thread QR pre-gen

**Files:**
- Modify: `src/lib/features/choreo-card/services/PrintCardRenderer.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/print-card-renderer-front-worker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/features/choreo-card/services/__tests__/print-card-renderer-front-worker.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dispatcher module so the test never spawns a worker.
const composeFrontBitmap = vi.fn();
let workerAvailable = true;
vi.mock("$lib/shared/render/services/composition-dispatcher", () => ({
  CompositionDispatcher: { canUseWorker: () => workerAvailable },
}));
vi.mock("$lib/shared/render/get-composition-dispatcher", () => ({
  getCompositionDispatcher: () => ({ composeFrontBitmap }),
}));
// Frame wrap returns a sentinel so we can assert it ran on the worker bitmap.
const wrapContentInCardFrame = vi.fn(() => ({ __framed: true }));
vi.mock("../card-front-frame", () => ({ wrapContentInCardFrame }));

import { PrintCardRenderer } from "../PrintCardRenderer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const seq = { id: "x", word: "X", steps: [], author: "" } as unknown as SequenceData;
const options = { canvasWidth: 822, canvasHeight: 1122, bleedPx: 36, includeStartPosition: true } as never;

describe("PrintCardRenderer.renderFront worker path", () => {
  beforeEach(() => {
    composeFrontBitmap.mockReset();
    wrapContentInCardFrame.mockClear();
    workerAvailable = true;
    // jsdom: document.createElement('canvas') exists; getContext may be null, but
    // the worker branch never calls composeSequenceImage, so a stub composer is fine.
  });

  it("uses composeFrontBitmap + frame wrap when the worker is available", async () => {
    const innerBitmap = { close: vi.fn() } as unknown as ImageBitmap;
    composeFrontBitmap.mockResolvedValue(innerBitmap);
    const composer = { composeSequenceImage: vi.fn() } as never;

    const renderer = new PrintCardRenderer(composer, "cosmic");
    const out = await renderer.renderFront(seq, options);

    expect(composeFrontBitmap).toHaveBeenCalledOnce();
    expect(wrapContentInCardFrame).toHaveBeenCalledOnce();
    expect((innerBitmap as { close: () => void }).close).toHaveBeenCalledOnce();
    expect(out as unknown).toEqual({ __framed: true });
    expect((composer as { composeSequenceImage: () => void }).composeSequenceImage).not.toHaveBeenCalled();
  });

  it("falls back to the main-thread compose when the worker throws", async () => {
    composeFrontBitmap.mockRejectedValue(new Error("worker boom"));
    const mainCanvas = { __main: true };
    const composer = { composeSequenceImage: vi.fn().mockResolvedValue(mainCanvas) } as never;

    const renderer = new PrintCardRenderer(composer, "cosmic");
    await renderer.renderFront(seq, options);

    expect((composer as { composeSequenceImage: ReturnType<typeof vi.fn> }).composeSequenceImage).toHaveBeenCalledOnce();
    expect(wrapContentInCardFrame).toHaveBeenCalledWith(mainCanvas, expect.anything(), expect.anything());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/print-card-renderer-front-worker.test.ts`
Expected: FAIL — current `renderFront` never calls `composeFrontBitmap`.

- [ ] **Step 3: Rewrite `renderFront`**

In `PrintCardRenderer.ts`, add imports near the top (after the existing `wrapContentInCardFrame` import, ~line 20):

```ts
import { buildFrontComposeOptions } from "./build-front-compose-options";
import { wrapContentInCardFrame } from "./card-front-frame";
import { CompositionDispatcher } from "$lib/shared/render/services/composition-dispatcher";
import { getCompositionDispatcher } from "$lib/shared/render/get-composition-dispatcher";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
```

Replace the whole `renderFront` method (lines 34-55) with:

```ts
  async renderFront(
    sequence: SequenceData,
    options: PrintRenderOptions
  ): Promise<HTMLCanvasElement> {
    // Single shared builder — same options the worker/parity path consumes, so
    // the two renders stay identical by construction (no hand-mirrored copy).
    const { composeOptions, frame } = buildFrontComposeOptions(sequence, options);

    const htmlFactory = (w: number, h: number): HTMLCanvasElement => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };

    // Worker path: render the inner composite off-thread, keep the cheap,
    // deterministic stripe/bleed frame wrap on the main thread. The QR is
    // generated on the main thread (the worker has no Firebase / new Image())
    // and composited inside the worker from the supplied bitmap.
    if (CompositionDispatcher.canUseWorker()) {
      try {
        const qrBitmap = await this.prerenderQr(sequence, options, composeOptions);
        const inner = await getCompositionDispatcher().composeFrontBitmap(
          sequence,
          composeOptions,
          qrBitmap,
        );
        const framed = wrapContentInCardFrame(inner, frame, htmlFactory) as HTMLCanvasElement;
        inner.close();
        return framed;
      } catch (err) {
        console.warn("[PrintCardRenderer] worker front render failed, main-thread fallback:", err);
        // fall through to the main-thread path below
      }
    }

    // Main-thread render (worker unavailable or per-card fallback). QR is
    // generated internally by composeSequenceImage as today.
    const sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);
    return wrapContentInCardFrame(sequenceCanvas, frame, htmlFactory) as HTMLCanvasElement;
  }

  /**
   * Pre-render the card's QR code on the MAIN thread (the worker has no Firebase
   * and no `new Image()`), returning a transferable ImageBitmap, or null when the
   * card has no QR cell or no generator is wired. Mirrors the parity harness so
   * worker output matches the proven render.
   */
  private async prerenderQr(
    sequence: SequenceData,
    options: PrintRenderOptions,
    composeOptions: Partial<SequenceExportOptions>,
  ): Promise<ImageBitmap | null> {
    if (!composeOptions.visibilityOverrides?.showQRCode) return null;
    const qrGen = this.imageComposer.qrGenerator;
    if (!qrGen) return null;
    try {
      const img = await qrGen.generateAsImage(sequence, 600, {
        style: "modern",
        margin: 1,
        darkMode: false,
        bluePropType: options.bluePropType,
        redPropType: options.redPropType,
        deckName: options.deckName,
      });
      return await createImageBitmap(img);
    } catch (err) {
      console.warn("[PrintCardRenderer] QR pre-render failed:", err);
      return null;
    }
  }
```

(Remove the now-duplicate `buildFrontComposeOptions` / `wrapContentInCardFrame` imports already at the top of the file if they exist — keep one of each. The file already imports both at lines 19-20; do NOT add a second copy. Add only the `CompositionDispatcher`, `getCompositionDispatcher`, and `SequenceExportOptions` imports.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/choreo-card/services/__tests__/print-card-renderer-front-worker.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/services/__tests__/print-card-renderer-front-worker.test.ts
git commit -m "feat(choreo-card): renderFront routes through worker pool with main QR + fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- src/lib/features/choreo-card/services/PrintCardRenderer.ts src/lib/features/choreo-card/services/__tests__/print-card-renderer-front-worker.test.ts
```

---

### Task 4: Pre-warm trigger in `DeckReleaserTab.loadSelectedSequences`

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`

This is a Svelte component wiring change — verified at runtime (Task 5 gate), not unit-tested.

- [ ] **Step 1: Add the import**

In the `<script>` import block of `DeckReleaserTab.svelte` (near the other `$lib/shared/render` imports), add:

```ts
  import { prewarmCardPool } from "$lib/shared/render/services/card-pool-prewarm";
```

- [ ] **Step 2: Fire pre-warm after sequences resolve**

In `loadSelectedSequences`, immediately after `rs.brokenLoopCount = ...` (line 641, still inside the `try`, after the generation guard at line 637), add:

```ts
      rs.brokenLoopCount = resolved.filter((r) => !r.turnLoopClosed).length;

      // Pre-warm the worker pool now — both Draw and view-release funnel through
      // here, so the ~5s asset-bundle seed overlaps the step→review transition and
      // the review render hits the warm path. Fire-and-forget; failure is a no-op
      // (render falls back to the main thread).
      prewarmCardPool({
        sequences: rs.sequences,
        bluePropType: rs.bluePropType,
        redPropType: rs.redPropType,
        theme: rs.theme,
        iconPaths: rs.cards
          .map((c) => c.footer?.iconPath)
          .filter((p): p is string => !!p),
      });
```

- [ ] **Step 3: Typecheck the changed graph**

Run: `npm run check:fast`
Expected: no new errors in `DeckReleaserTab.svelte`, `card-pool-prewarm.ts`, `PrintCardRenderer.ts`, `composition-dispatcher.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(deck-releaser): pre-warm worker pool when deck sequences resolve

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" -- src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
```

---

### Task 5: Verification gates (parity + runtime trace + full check)

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck (one cold run, capture-once)**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log`
Expected: zero errors. If any reference the four touched files, fix and re-run.

- [ ] **Step 2: Full unit suite for the touched area**

Run: `npx vitest run src/lib/shared/render src/lib/features/choreo-card/services`
Expected: all green, including the three new test files.

- [ ] **Step 3: Parity gate (pixel identity, worker vs main)**

On the authenticated dev server (`http://localhost:5173`), open
[card-back parity harness](http://localhost:5173/test/card-back-parity), Front mode, pick a deck, Run.
Expected verdict: **PASS — worst diff ≤ 1%**, QR present in WORKER matching MAIN, no `each_key_duplicate`. This proves the worker render the production path now uses is pixel-identical to main.

- [ ] **Step 4: Runtime trace gate (the actual win)**

With a real deck loaded in the deck releaser, evaluate in the page (Chrome DevTools MCP) the cold-draw timing the wiring targets — confirm `CompositionDispatcher.canUseWorker()` is `true` after a draw (pre-warm ran) and a cold deck render dispatches to workers. Capture before/after wall-clock: expect the review render to land near the warm 7 ms/card path once the pool is pre-warmed, and the main thread to stay responsive (no multi-second freeze). Record the numbers.

- [ ] **Step 5: Report**

Report the parity verdict, the unit/check results, and the before/after draw timing. No commit (verification only).
