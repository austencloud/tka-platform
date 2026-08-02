# Guide: Print + Interactive, Shippable — Design

**Date:** 2026-07-11
**Status:** Approved scope (Phase 0 + Phase 1)
**Author:** Fable 5 (with Austen)

---

## Context

The Level-1 guide is **content-complete**: 25 authored body pages, real print CSS
(`_styles/guide-print.css`, `@page Letter`, break rules), and two print surfaces
(`/guide/level-1/print`, `/guide/level-1/book`) that render the same
`GuideDocument` as the in-app reader, so they can't drift in content.

Austen wants to **send the guide to people** as a print + interactive artifact.
Two things block that:

1. **It doesn't look finished.** The interactive Codex page renders its
   pictographs overlapping each other, and the reader is weak on a phone (nav
   disappears, touch targets shrink) — and phone-in-hand is the core interactive
   use case (holding the paper book, using the phone).
2. **The "neat idea" isn't wired.** The vision: someone holds the printed guide,
   scans a card, and sees the thing in their hand animated *in the context of the
   guide* — land on the page teaching that content, with the matching pictograph
   ready to animate.

### Architecture reality (why this spec is scoped the way it is)

- The guide is authored as **fixed 816×1056 print sheets** — prose absolutely
  positioned at pixel coordinates, pictographs at baked sizes, the whole sheet
  uniformly **scaled** to fit the reader pane. Print-canonical; the reader is a
  zoomed page.
- The Learn module's **Concepts tab** is already a native-responsive,
  Khan-Academy-style learning engine (data manifest, flowing responsive lessons,
  a progress tracker with localStorage+Firestore/mastery/badges/spaced-repetition,
  step/scroll view modes, quizzes, delight).
- **Converging the guide onto the Concepts engine is the north star** — but it's
  a large rebuild, headway there has been slow, and it must not block shipping.
  **This spec explicitly defers convergence** and ships the finished
  print-artboard guide plus the companion bridge, on the existing reader.

The in-guide **tap → animate** path already works and is reused throughout:
tapping a pictograph fires a `GuideSequenceClick`, which
`GuideReader.handleSequenceClick` converts to a `SequenceData` and opens the
`GuideCompanion` animator. This spec builds on that, it does not replace it.

Recent reader/companion polish (animator position markers, codex companion
controls) lives on this same reader and survives unchanged — it is not part of
the deferred convergence.

---

## Goals

- **Phase 0:** the guide looks finished and works phone-in-hand.
- **Phase 1:** scan/QR → land in the guide with the held content animated *in
  context* (the Codex page as the universal hub), reusing the existing
  tap→animate machinery.

## Non-goals (explicitly deferred)

- **No** Concepts-engine convergence, block-based lesson model, or responsive
  rewrite of chapter pages. Chapter pages stay artboards.
- **No** progress tracking / mastery / quizzes inside the guide (that is
  Concepts' job).
- **No** per-chapter content→page mapping beyond the Codex hub in v1. The index
  is structured to grow that way later, "one page at a time."
- **No** change to the default card-scan destination (still the sequence
  viewer). The guide is an additional, opt-in destination.

---

## Architecture overview

```
Scan / QR  ──►  ShortCodeManager.resolveShortCode(code) : SequenceData
                        │
             (default) ▼                         (opt-in) "See it in the Guide"
                Sequence viewer  ───────────────────────►  guide-content-index
                                                                    │  {slug, cellKey?|sequence}
                                                                    ▼
                                                     setGuideScanIntent(...)  (one-shot stash)
                                                                    │
                                                     goto(/learn/guide/<slug>)
                                                                    ▼
                                            GuideReader.onMount → consumeGuideScanIntent()
                                                                    │
                                     cellKey → handleSequenceClick(cell payload)
                                     sequence → open GuideCompanion with SequenceData
                                                                    ▼
                                        animate (+ mobile scroll-into-band)
```

The scan-intent layer is a one-shot stash/consume, structurally identical to the
existing `src/lib/features/browse/state/pending-scan-intent.svelte.ts` pattern,
keyed to the guide instead of the collection scanner.

---

## Phase 0 — Shippable polish

### 0.1 Codex overlap fix

**Cause (confirmed at the CSS layer; live-verify is implementation step 1).**
In `src/routes/(public)/guide/codex/_components/CodexCell.svelte`, the pictograph
box `.picto` (`width:100%; max-width:64px; aspect-ratio:1`) has **no overflow
clip**, and it renders `GuidePictograph` **without the `bordered` prop** — and
`bordered` is the only thing that turns on `GuidePictograph`'s own
`overflow:hidden` clip. So nothing in the codex cell chain clips the SVG. If a
pictograph resolves larger than its 64px box (async prep, `aspect-ratio` not
resolving against a definite width, or the `printMode`+`eager` render path), it
spills into neighboring cells — matching "all overlapping."

**Fix.**
- Add `overflow: hidden` to `.picto` (and `.codex-cell`) as the clip boundary.
- Guarantee a definite width resolves before `aspect-ratio` (the `.box-cells`
  grid `repeat(var(--cols), 1fr)` should supply it — verify the cell isn't
  collapsing to content width first; if it is, give `.picto` an explicit
  `width: 100%; min-width: 0` inside a `min-width: 0` cell).
- If the SVG still oversizes after clipping, constrain `PictographRenderer`'s
  root to `width:100%; height:100%` within the wrapper (it currently uses a
  viewBox with `width="100%"`; confirm the wrapper has a resolved height via the
  `aspect-ratio` box).

**Verify.** Land on the Codex page in the reader AND `/print`; confirm every cell
sits inside its grid gap with no overlap; screenshot. Confirm the existing print
route still paginates SHEET1/SHEET2 onto separate pages.

**Files:** `guide/codex/_components/CodexCell.svelte` (style), possibly
`guide/level-1/_components/GuidePictograph.svelte`.

### 0.2 Mobile page navigation

**Problem.** In `GuideReader.svelte`, below a 720px container width the left nav
`.reader-aside` is `display:none` — on a phone there is **no** TOC or page-jump,
only continuous scrolling.

**Fix.** A mobile "Contents" affordance: a fixed, ≥44px button in the reader
header (mobile only) that opens the existing `GuideTOC` inside a sheet/drawer.
**Reuse an existing sheet primitive** — grep `PropSelectionSheet`, `Drawer`,
`SequencePickerModal` and pick the closest; do not hand-roll a sheet
(`never-hand-roll.md`). Tapping a TOC row scrolls to that page and closes the
sheet, reusing the reader's existing `go(index)` scroll-to.

**Files:** `GuideReader.svelte`, `GuideTOC.svelte`, chosen sheet primitive.

### 0.3 Touch targets

**Problem.** Pictograph cells are sized by the page's global scale factor, so on a
narrow phone their on-screen tap target (the `SelectionHit` overlay) can fall
below the `--min-touch-target: 44px` floor every other guide control enforces.

**Fix.** Ensure the `SelectionHit` hit region keeps a ≥44px tappable area on
mobile even when the visual cell is smaller — expand the hit overlay beyond the
visual footprint (centered) below the mobile breakpoint. Verify adjacent hit
regions don't overlap after expansion (fall back to the visual size where cells
are tightly packed, e.g. dense codex boxes).

**Files:** `src/lib/shared/selection/SelectionHit.svelte` or its guide call
sites; verify against the 44px token.

### 0.4 Rough edges that read as unfinished

- **Reduced-motion autoplay.** `GuideCompanion` invokes `InlineAnimationPlayer`
  with `autoPlay={true}` unconditionally. Gate it on `prefers-reduced-motion`:
  for reduced-motion users, do not auto-start — render the player paused with a
  visible play control.
- **Skip past front matter.** A deep-link / scan intent must land directly on
  content, not force scrolling through 5 stacked front-matter pages. Confirm the
  slug-driven landing already parks the scroller on the target page (it does via
  `indexForSlug`); add a "Start reading" control on the cover for the no-deep-link
  first visit.

**Files:** `GuideCompanion.svelte` (autoplay gate), `GuideReader.svelte`
(landing / start-reading control).

---

## Phase 1 — Physical ↔ digital bridge

### 1.1 Content → page/cell index (Codex as hub)

**New data module:** `guide/level-1/_data/guide-content-index.ts`. Maps a base
letter (and, later, a richer pictograph identity) → `{ slug, cellKey }`.

- **v1 baseline:** every base letter → `{ slug: "codex", cellKey: "<letter-id>" }`,
  e.g. `"A" → { slug: "codex", cellKey: "A-0" }`, `"Σ" → { slug: "codex",
  cellKey: "Σ-0" }`. The Codex already enumerates these ids
  (`codex/_data/codex-groups.ts`, `CELLS_BY_ID` in `GuideCodexPage.svelte`), so
  the Codex is the natural universal landing target and the living index of all
  47 base letters.
- **Resolution rule:**
  - Single base-letter content → its Codex cell: land on `codex`, highlight and
    animate that cell.
  - Multi-letter word (a real sequence) → land on `codex`, and play the full
    `SequenceData` in the companion directly (no single cell highlighted).
- **Extensible:** as chapters are enriched later, repoint specific letters from
  `codex` to their chapter page + cell — the index is the single seam for that.

**Files:** new `guide-content-index.ts`.

### 1.2 Guide scan-intent layer

**New one-shot state module:** `guide/level-1/_data/guide-scan-intent.svelte.ts`,
mirroring `pending-scan-intent.svelte.ts`.

- `setGuideScanIntent(intent)` where
  `intent = { slug: string; cellKey?: string; sequence?: SequenceData }`.
- `consumeGuideScanIntent()` returns the intent and clears it (one-shot).
- **Consumed in `GuideReader.onMount`**, alongside the existing `savedCompanion()`
  restore, using the same `await tick()` + `requestAnimationFrame` guard that
  path already uses to avoid racing `fit()`/scale settle:
  - `cellKey` present → invoke the same handler a real tap would
    (`handleSequenceClick` with the cell's payload, obtained via the Codex page's
    per-id trigger, see 1.3).
  - `sequence` present → open `GuideCompanion` with the resolved `SequenceData`
    directly.
- Reuses the reader's mobile `scrollCellIntoBand`/`syncMobileScroll` so the
  animated cell and the companion are both visible on a phone.

**Files:** new `guide-scan-intent.svelte.ts`; `GuideReader.svelte` (consume);
`GuideCodexPage.svelte` (expose a "trigger cell by id" so the intent can fire a
specific codex cell without a DOM tap).

### 1.3 Scan → guide entry point

**Non-destructive.** The default scan still lands in the sequence viewer
(`/q/[code]` → `SequenceViewerShell`), the primary product flow.

Add an opt-in **"See it in the Guide"** action on the scan/viewer surface. On tap
it: resolves the current `SequenceData` → derives a base letter if it's a single
base-letter sequence → looks up `guide-content-index` → `setGuideScanIntent(...)`
→ `goto("/learn/guide/<slug>")`.

**Respect the sequence-viewer-shell contract** (`sequence-viewer-shell.md`): the
host must not fork chrome. Expose this as a **new optional prop on
`SequenceViewerShell`** (an action/overflow-item seam, the same way
`exportOverrides` was added), which `QScanPage` passes. Do not add host-side
chrome. The shell contract test
(`tests/unit/sequence-viewer-shell-contract.test.ts`) must stay green.

**Extensible (deferred):** printed QR codes inside the book can later deep-link
straight to `/learn/guide/<slug>?scan=<code>` — a book-side addition that reuses
the same intent layer, no new plumbing.

**Files:** `src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte`
(new optional action prop), `src/routes/q/[code]/QScanPage.svelte` (pass it),
`guide-content-index.ts` (letter derivation).

---

## Data flow (Phase 1, end to end)

1. `resolveShortCode(code)` → `SequenceData`.
2. Viewer shows the sequence (default). User taps **"See it in the Guide."**
3. Derive letter (if single base letter) → `guide-content-index` →
   `{ slug, cellKey? | sequence }`.
4. `setGuideScanIntent(...)`; `goto("/learn/guide/" + slug)`.
5. `GuideReader.onMount` → `consumeGuideScanIntent()` → (tick + rAF guard) →
   `handleSequenceClick` (cellKey) or open companion (sequence).
6. Companion animates; on mobile the cell scrolls into the band above the sheet.

---

## Testing

- **Codex overlap:** visual screenshot (reader + `/print`) shows no overlap;
  existing codex/print behavior unchanged; SHEET1/SHEET2 still page-break.
- **Mobile nav:** below 720px the Contents sheet opens, rows scroll-to + close;
  all controls ≥44px.
- **Touch targets:** `SelectionHit` hit area ≥44px on mobile; no overlapping hit
  regions.
- **Scan-intent:** unit-test stash/consume (one-shot: second consume returns
  null). Integration: set intent → mount reader → assert companion opens with the
  expected sequence/cell.
- **Shell contract:** `sequence-viewer-shell-contract.test.ts` stays green with
  the new prop (no forked chrome, no theme-var declarations).
- **Reduced motion:** autoplay does not auto-start under
  `prefers-reduced-motion`.

---

## Risks

- **Codex root cause unconfirmed live** (dev-server cert interstitial blocked the
  screenshot). The clip fix is defensible regardless of the exact trigger;
  live-verify is implementation step 1. If clipping alone doesn't seat the cells,
  the width/aspect-ratio chain is the next suspect (0.1).
- **Auto-open race** on mount (before scale settles) — mitigated by reusing the
  existing `tick()`+rAF guard from the `savedCompanion` restore path.
- **Two mobile-detection sources** (viewer viewport-width `<768` vs reader
  container-width `<720`). The intent handoff is data-only and must not depend on
  the two agreeing.

---

## Rollout

- **Phase 0 first** — ships the finished guide (codex fix + mobile + rough
  edges). This alone makes it sendable.
- **Phase 1 second** — the scan/QR → Codex → animate bridge.
- **"One page at a time":** the content index starts Codex-only and is enriched
  per chapter later, without touching the intent layer or the reader.
- **North star (separate future spec):** converge the guide's on-screen
  experience onto the Concepts engine (block-based lesson model, responsive
  chapters, progress tracking). Deferred until Concepts has headway.
