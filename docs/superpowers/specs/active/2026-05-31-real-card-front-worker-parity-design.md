# Real Card-Front Worker Parity + Pair-Strip Viewer — Design

**Date:** 2026-05-31
**Status:** Active
**Goal:** The composition worker renders the *complete* real card front — word header, footer (TnD labels + element icon), accent-tinted side margins, and the colored stripe **border frame** — from *real released-deck data*, pixel-matching the main-thread `PrintCardRenderer.renderFront`. Results are viewed in a comfortable Pair+diff-strip viewer covering Front and Back modes. Parity gate: worst diff ≤ 1% across the deck's cards, Front **and** Back.

## Why

The worker front render currently works (props, arrows, positions, grid, word) but the parity harness feeds it a hand-trimmed `frontOptions()` and renders only a bare pictograph grid via `composeSequenceImage` — no header, no footer, no border, and arbitrary browse-engine sequences instead of real deck cards. The trimmed-options mirror is exactly the kind of hand-copy that drifts. This design makes the worker run the **same** front composition the print pipeline runs, on **real** card data, proving the worker can produce a print-ready card front.

The "made-up glyph in the bottom-left of the start-position cell" the user flagged is the real `"Start"` step-number label (`step-number-renderer.ts`, `stepNumber === 0`). It only reads as fake because the surrounding header/footer/frame are absent. Rendering the full real card resolves it.

## Architecture / Data Flow

```
DeckRelease (Firestore, deck-release-store.getAllReleases)
  └─ DeckReleaseCard[] { sequenceId, word, footer{left,center,right,iconPath}, variation }
        ├─ catalog-loader → SequenceData (+ apply CardVariation)
        └─ footer.iconPath → getTnDElementByIconPath → TnDElement { accentColor, darkComplement, cardTintOpacity, iconPath }
              ↓
        buildFrontComposeOptions(sequence, printRenderOptions)   ← SINGLE shared builder
              ↓
   ┌──────────────────────────────┐        ┌──────────────────────────────────────────┐
   │ MAIN: renderFront             │        │ WORKER: composeFrontBitmap                 │
   │  composeSequenceImage(opts)   │        │  composeSequenceImage(opts)                │
   │  + wrapContentInCardFrame     │        │  + wrapContentInCardFrame (via opts.       │
   │                               │        │    frontCardFrame, in-worker)              │
   └──────────────────────────────┘        └──────────────────────────────────────────┘
              ↓                                          ↓
            diff(main, worker)  →  CardParityViewer rows (Pair + diff strip)
```

## Workstream 1 — Full real front through the worker

### 1.1 Single shared options builder (the anti-drift fix)
Extract `renderFront`'s `composeOptions` assembly (`PrintCardRenderer.ts:64-104`) into a pure function:

`buildFrontComposeOptions(sequence, opts): { composeOptions: Partial<SequenceExportOptions>; frame: CardFrameOptions }`

- New file: `src/lib/features/choreo-card/services/build-front-compose-options.ts`.
- Inputs: `sequence: SequenceData`, `opts: PrintRenderOptions` (+ canvas/bleed dims, default MPC 822×1122/36).
- Returns the exact `composeOptions` object `renderFront` builds today, plus the `frame` (`{canvasWidth, canvasHeight, bleedPx, accent, dark}`) for `wrapContentInCardFrame`.
- `PrintCardRenderer.renderFront` is rewritten to call this builder, then `composeSequenceImage(composeOptions)`, then `wrapContentInCardFrame(canvas, frame)`. Behavior byte-identical (verified by unit test + Front parity).
- Pure: no DOM, no Firestore, no `new Date()` side effects other than `exportDate` (which the builder accepts as an injected `exportDate` param so worker and main produce identical bytes — see 1.5).

### 1.2 Frame applied in the worker
`composeFrontBitmap` already JSON-serializes `options`. Add an optional field to `SequenceExportOptions`:

`frontCardFrame?: { canvasWidth: number; canvasHeight: number; bleedPx: number; accent: string; dark: string }`

In `composition.worker.ts handleCompose`, after `composeSequenceImage(...)` returns the inner content canvas, if `effectiveOptions.frontCardFrame` is present, wrap it:
`canvas = wrapContentInCardFrame(canvas, effectiveOptions.frontCardFrame)` (dynamic import, worker-safe). The worker returns the full framed 822×1122 bitmap.

`composeCardImage`/`cardMode` is **not** used for the front (it re-lays-out into 5:7 but adds no border; `renderFront` never calls it).

### 1.3 `wrapContentInCardFrame` made worker-safe
`card-front-frame.ts:112` uses `document.createElement("canvas")`. Replace with `createRenderCanvas(canvasW, canvasH)` (the existing OffscreenCanvas-safe helper used across the render pipeline). Return type widens to `RenderCanvas`; `PrintCardRenderer.renderFront` casts to `HTMLCanvasElement` on the main path (runtime-correct — `createRenderCanvas` returns an HTMLCanvasElement on the main thread). Verify the module graph of `card-front-frame.ts` is worker-clean (it imports nothing but the canvas helper after this change).

### 1.4 Footer-icon seeding (the one missing worker asset)
`loadFooterIcon` (`packages/render-composition/src/footer-renderer.ts:79`) uses `new Image()` and a module-level `iconCache` keyed by path. It checks `iconCache` first.

- Add `seedFooterIcon(path: string, image: CanvasImageSource): void` to `footer-renderer.ts` (populates `iconCache`), export via `render-composition/src/index.ts`.
- Extend `AssetBundle` with `icons: { path: string; bitmap: ImageBitmap }[]`.
- Main thread (`buildAssetBundle`): for each unique footer `iconPath` in the deck, fetch + decode to `ImageBitmap`, add to `bundle.icons`. Add icons to `bundleTransferables`.
- Worker (`seedCachesFromBundle` or a sibling `seedFooterIcons`): call `seedFooterIcon(path, bitmap)` for each. Worker `renderUserInfo → loadFooterIcon` then hits the cache, never `new Image()`.

### 1.5 Deterministic `exportDate`
`renderFront` sets `exportDate: new Date().toISOString()`. For pixel parity the harness must pass the **same** `exportDate` to both the main render and the worker render. The builder accepts `exportDate` as a parameter (caller supplies one timestamp per card; the harness reuses it for both sides). Production `renderFront` defaults it to `new Date().toISOString()` as today.

### 1.6 Real deck data in the harness
- `getAllReleases()` (deck-release-store) → newest `DeckRelease`. If multiple, a `SegmentedControl`/dropdown selects one (auto-select newest). If none, render a clear "no released decks" empty state.
- For each `DeckReleaseCard` (cap ~8 for the parity run): `catalog-loader` → `SequenceData`, apply `CardVariation`, resolve `TnDElement` via `getTnDElementByIconPath(footer.iconPath)`.
- Build `PrintRenderOptions` = `{ tndElement, includeStartPosition: true, startPositionLayout: "row", leftLabel: footer.left, rightLabel: footer.right, notes: footer.center, iconPath: footer.iconPath, bluePropType, redPropType, deckId, deckName }` and one shared `exportDate`.

## Workstream 2 — Pair+diff-strip viewer

### 2.1 `CardParityViewer.svelte` (new, `src/lib/shared/parity/`)
Replaces `ParityHarness` for this page. Layout (per the approved "Pair + diff strip" mock):
- **Sticky top bar:** verdict pill (PASS/FAIL color) + worst-metric line + Front/Back `SegmentedControl` + Run button + progress.
- **Per-card row:** MAIN and WORKER full framed cards side-by-side, each in a reused `.card-frame` (soft shadow, `aspect-ratio: 822 / 1122` reserved box — no layout shift on async render). Beside them a slim strip: DIFF heat thumbnail + `diff x%` / `maxΔ n` badges (`tabular-nums`). Row tinted if over the gate.
- **Collapsed `<details>` footer:** the raw JSON result (no longer tucked top-left, no longer always-on).

### 2.2 Reuse the run engine
The `ParityRun` / `ctx` (`addRow`/`onProgress`) contract and `image-diff` (`diff`, `normalizeToCanvas`, `AA_TOLERANCE`) are unchanged. `CardParityViewer` is a presentation swap that consumes the same `makeRun()` and renders rows via the same `ParityRow`/`ParityCell` types. Back mode keeps passing, now in the nicer viewer.

### 2.3 Rules compliance
- No-layout-shift: reserved `aspect-ratio` card boxes; `tabular-nums` metrics.
- chip-primitives: Front/Back is a `SegmentedControl` (single-select group), not raw `<button>`s; deck picker is `SegmentedControl` or `FilterChipBase` dropdown.
- never-hand-roll: reuse `CardPreviewStack`'s `.card-frame` framing approach; reuse the parity engine + diff.

## Components / Files

| File | Action | Responsibility |
|---|---|---|
| `src/lib/features/choreo-card/services/build-front-compose-options.ts` | Create | Single pure builder: PrintRenderOptions → composeOptions + frame |
| `src/lib/features/choreo-card/services/PrintCardRenderer.ts` | Modify | `renderFront` consumes the shared builder |
| `src/lib/features/choreo-card/services/card-front-frame.ts` | Modify | Worker-safe canvas via `createRenderCanvas` |
| `src/lib/shared/render/domain/models/sequence-export-options.ts` | Modify | Add `frontCardFrame?` field |
| `src/lib/shared/render/workers/composition.worker.ts` | Modify | Apply `frontCardFrame` wrap; seed footer icons |
| `src/lib/shared/render/services/card-asset-bundle.ts` | Modify | `icons[]` in bundle + transferables + seed |
| `packages/render-composition/src/footer-renderer.ts` | Modify | `seedFooterIcon(path, image)` |
| `packages/render-composition/src/index.ts` | Modify | Export `seedFooterIcon` |
| `src/lib/shared/render/services/composition-dispatcher.ts` | Modify | Carry `icons` through init message |
| `src/lib/shared/parity/CardParityViewer.svelte` | Create | Pair+diff-strip viewer |
| `src/lib/features/choreo-card/services/parity-deck-source.ts` | Create | Released-deck → renderable card tuples (Firestore) |
| `src/routes/test/card-back-parity/+page.svelte` | Modify | Use real deck source + shared builder + new viewer |

## Testing

- **Unit:** `build-front-compose-options.test.ts` — same `(sequence, opts, exportDate)` → deep-equal `composeOptions` + `frame`. Asserts the field set matches the legacy `renderFront` object (regression lock).
- **Unit:** `card-asset-bundle` icons round-trip (bundle includes a seeded icon path → `seedFooterIcon` called).
- **Parity gate:** worst diff ≤ 1% across the deck's cards, Front **and** Back, AA tolerance 8/channel.
- **Live:** verified on the isolated dev server (`vite --port 5174`) via Chrome DevTools screenshot of the Front run showing framed cards with header/footer/border and a green ≤1% verdict.

## Out of Scope (follow-on)

- Wiring the worker path into the real `PrintPreviewPages`/`PrintCardRenderer` print pipeline (only after parity is green).
- Card-back job changes (already passing).
- Retiring `ParityHarness` for other consumers (`trail-export-parity` keeps using it).

## Risks

- **Footer-icon seed:** low — mirrors the working glyph-bitmap seed; `iconCache` already path-keyed and checked first.
- **Harness Firestore fetch:** low — the page already inits a Firestore-backed browse engine; deck/catalog reads use the same auth/Firestore seam.
- **`exportDate` nondeterminism:** addressed by 1.5 (one timestamp shared across both renders per card).
- **`createRenderCanvas` return-type widening:** contained to `card-front-frame.ts` + a cast in `renderFront`.
