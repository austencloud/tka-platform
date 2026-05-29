# Worker-Parallelized Card Backs — Design

**Date:** 2026-05-28
**Status:** Approved (design), pending implementation plan
**Topic:** Move choreo-card *back* rendering off the main thread to true multi-core, at full visual parity with the current DOM-screenshot path.

---

## Problem

Card **fronts** already render via a Canvas2D pipeline and parallelize across a lane pool. Card **backs** do not: each back mounts `CardBack.svelte` into the live DOM, waits a fixed ~200 ms (`requestAnimationFrame` ×2 + `setTimeout 200`), then `modern-screenshot.domToCanvas` rasterizes the DOM. This path:

- cannot run in a Web Worker (no DOM in workers),
- carries a fixed 200 ms latency per card,
- spends real main-thread CPU on full-DOM computed-style introspection.

Goal: backs should parallelize like fronts via the worker pool, with **complete visual parity** — no regression in any pixel.

### Two documented blockers (both previously hit and shelved)

1. **SvelteKit module coupling** — `CompositionDispatcher.detectWorkerSupport()` returns `false` because the compose pipeline transitively imports `$env/dynamic/public` + Firebase auth (→ `window`) that crash at worker module-init.
2. **SVG-in-worker rasterization** — `RenderFactory.supportsWorkerRendering()` returns `false`: `createImageBitmap()` in workers cannot reliably decode SVG blobs that reference **external resources** (the pictograph pipeline loads grid/arrow/prop SVG assets by URL → partial renders).

### Verified facts (web + code, 2026-05-28)

- `createImageBitmap(svgBlob)` **works in workers in all current engines**, provided the SVG has explicit dimensions (the repo's `sanitizeSvgForCreateImageBitmap` injects them from `viewBox`). MDN / HTML spec.
- The durable limitation is **external resources** (fonts, `<image href>`, external CSS) not loading unless inlined.
- `renderMandalaSVG` emits **fully self-contained** SVG (inline `<defs>`: `feGaussianBlur`/`feMerge` filters, masks, gradients; inline paths/colors; no external refs/fonts).
- `renderMandalaToCanvas` already exists — a **Path2D-based** mandala drawer that is worker-safe and needs no SVG rasterization at all.
- `CardBackDecorations.svelte` is **self-contained theme-parameterized SVG** (shapes, gradients, `feGaussianBlur` filters; no external refs).
- The start-position pictograph is the only back element bound to external SVG assets (it runs the full pictograph pipeline).

So the repo's blanket "worker SVG rendering disabled" is **stale/overgeneralized** for the back's self-contained content.

---

## Decisions (locked)

- **Font/icon strategy:** pre-rasterize on the main thread and transfer `ImageBitmap`s to the worker — the same pattern the front pipeline already uses for TKA letter glyphs. Applies to: brand/URL/label/step-count text (custom fonts: Didot/Bodoni/Segoe), FontAwesome LOOP icons, `DifficultyBadge`, and the start-position pictograph.
- **Worker topology:** reuse the existing `CompositionDispatcher` pool + `composition.worker` (add a `compose-back` message). One pool, shared concurrency cap, fronts+backs interleave.
- **Approach A** (layered composite) chosen over B (one big self-contained SVG with embedded base64 fonts — parity risk on `<text>` metrics, license-murky font embedding) and C (full Canvas2D-native rewrite — massive hand-roll, violates `never-hand-roll`).

---

## Architecture: thread split by capability

The worker only ever touches worker-safe primitives (Path2D draws, self-contained SVG, pre-rendered bitmaps). Everything DOM-coupled or external-asset-coupled stays main-thread. This dodges **both** blockers without re-enabling the global `supportsWorkerRendering` flag.

```
MAIN THREAD (cheap, per card)          WORKER (heavy, ×N cores)
─────────────────────────────         ────────────────────────
deriveCardBackData(seq)                receive BackJob
mandala geometry → MandalaPaths        ├ paint border + bg gradients
build BackJob {                        ├ rasterize decorations SVG
  layout numbers,                      │   (createImageBitmap) → draw
  mandalaPaths + render opts,          ├ renderMandalaToCanvas (Path2D)
  decorationsSVG string,               ├ drawImage each placed bitmap
  bitmaps[] + placements[],            └ transferToImageBitmap → post back
  theme colors
}  ──postMessage(transfer)──▶
pre-rasterize (cached per theme/level):
  brand text, URL, ornament,
  difficulty badge, FA loop icons
pre-rasterize (per card):
  start-position pictograph,
  turn/reversal glyphs, step count
                          ◀──ImageBitmap──  wrap into canvas → CardPair
```

---

## Component breakdown (reuse map)

**Reused as-is:** `renderMandalaSVG` / `renderMandalaToCanvas`, `deriveCardBackData`, `CompositionDispatcher` pool + `composition.worker`, `getMandalaGeometryCalculator`, the main-thread pictograph pipeline (one start-pos pictograph per card), the glyph-bitmap transfer pattern (`convertGlyphCacheToBitmaps`).

**Extracted to pure functions (no Svelte runtime):**
- `CardBackDecorations.svelte` → `buildDecorationsSVG(theme): string` — pure port of the existing `{#each}` SVG, emits identical markup.
- `CardBack.svelte` layout (corners, brand slot, url slot, loop row, level badge) → `computeCardBackLayout(data, dims)` returning numeric placement boxes (ports the `cqi` math to px against the 1644×2244 render size).

**New:**
- `card-back-job-builder.ts` (main thread) — assembles `BackJob` from a sequence (data derivation + mandala geometry + layout + pre-rasterized bitmaps).
- `card-back-raster.ts` (worker side) — paints a `BackJob` to an `OffscreenCanvas`.
- Bitmap pre-rasterizers for text/icons (main thread), cached by theme/level.
- New worker message `compose-back` + dispatcher method `composeBack(job)`.

**Changed:** `PrintCardRenderer.renderBack` → routes through `dispatcher.composeBack`; on any worker error, falls back to the current DOM path.

**Retired after parity proven (Phase 2):** `card-back-dom-renderer.ts` (mount + 200 ms + modern-screenshot). Kept as runtime fallback until the diff gate passes, then deleted.

---

## Data flow / the `BackJob` contract

`BackJob` is plain-transferable: numbers, strings, and `ImageBitmap[]` (transfer list). No class instances, no SvelteKit imports — crosses the worker boundary cleanly and cannot drag in blocker #1.

- Pre-rasterized bitmaps carry `kind` + `placement {x, y, w, h}`.
- **Theme/level-constant** bitmaps (brand text, URL ornament, decorations-if-rasterized, per-level badge, FA icons) are built **once** and cached by `(theme)` / `(level)` key, reused across every card in the batch.
- **Per-sequence** bitmaps (start-pos pictograph, turn/reversal glyphs, step-count text) are built per card.
- **Mandala** is drawn in-worker via `renderMandalaToCanvas` (Path2D) from transferred `MandalaPaths` — no SVG raster, sidesteps blocker #2 for the most complex per-card element.
- **Decorations** rasterize in-worker via `createImageBitmap(decorationsSVG)`. (Phase 0 gates this; fallback is a Path2D port.)

Worker paint order matches the current z-stack exactly: border frame → bg gradient → decorations → mandala → loop row → corners / badges / text.

Output `ImageBitmap` at the current back resolution **1644×2244** (822×1122 × scale 2) to preserve print parity. Seam: `renderBack` returns a canvas today (consumed in `Promise.all([renderFront, renderBack])` → `CardPair` → lane pool); the worker returns an `ImageBitmap` wrapped into a canvas at the seam.

---

## Parity strategy + verification

Parity is **mechanical, not by-eye**: every layer is either (a) the exact generator the DOM used (`renderMandalaSVG` / decorations port verified byte-identical, or `renderMandalaToCanvas` which the front already uses), or (b) a bitmap pre-rasterized from the *same* DOM/pipeline output. The only re-authored code is the layout-number math (`cqi`→px) and the worker paint order.

**Verification gate** (per `verification-protocol.md`):
- Pixel-diff harness over representative backs: every theme (cosmic/ocean/winter/ember/blossom/forest/autumn/rainbow), loop / no-loop, float, mixed turns, each level (1–3), with / without start position. Render both ways (old DOM path vs new path) and assert per-pixel delta under a tight threshold. Test route exists: `src/routes/test/card-back-print`.
- Visual side-by-side in the actual grid before retiring the DOM path.
- No "parity" claim without diff output in hand.

---

## Phasing + fallback

- **Phase 0 — spike (gate the whole effort):** prove a real decorations SVG (with `feGaussianBlur` filters) rasterizes correctly via `createImageBitmap` in a worker in the target browser. If filters misrender, port decorations to Path2D draws instead.
- **Phase 1 — main-thread direct assembly:** `renderBack` builds `BackJob` and paints it **on the main thread** (no worker yet). Removes the 200 ms wait + modern-screenshot DOM introspection. Big speedup, low risk, validates the paint + parity path end-to-end.
- **Phase 2 — move paint into the worker pool:** `composeBack` dispatch, transfer bitmaps, composite off-thread. True multi-core. Retire the DOM renderer after the diff gate passes.

Every phase keeps the DOM renderer as a runtime fallback (`try job paint → catch → renderCardBack`), so a regression never blocks printing.

---

## Risks

| Risk | Mitigation |
|---|---|
| Decorations SVG filters misrender via `createImageBitmap` in worker | Phase 0 spike gates this; Path2D port fallback |
| `cqi`→px layout math drifts from CSS flex layout | Pixel-diff gate catches drift; layout ported against fixed 1644×2244 |
| Custom-font text raster differs from DOM (Didot/Bodoni availability) | Pre-rasterized on main thread from the *same* fonts the DOM uses → identical by construction |
| Worker transfer overhead per card exceeds raster savings for small batches | Theme/level-constant bitmaps cached + reused; measure in Phase 2, keep main-thread Phase 1 path as the small-batch default if needed |
| `BackJob` accidentally imports a SvelteKit-coupled module | Contract is plain data only; builder runs main-thread, worker file imports nothing from `$app`/`$env`/Firebase |

---

## Out of scope

- Re-enabling the **front** worker path (separate effort; same blockers, different content).
- Changing card back **visual design** (parity is the hard requirement).
- The global `supportsWorkerRendering` flag (back path makes its own worker-safety guarantee via the `BackJob` contract).
