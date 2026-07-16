# Sequence Showcase — banner + step strip (2026-07-16)

**Decision (Austen, 2026-07-16):** replace the vertical card-stage pattern
(square animation stacked over a 5:7 ChoreoCard) with a **banner + step strip**
showcase, applied as the SINGLE way the Level-1 guide flow view presents any
word sequence. Chosen in brainstorm over: media band w/ landscape card,
three-column spread, toggled one-box.

## Why the old pattern lost

Square animation + 5:7 card stacked = a ~1:2.4 tower. No prose block is that
tall, so every text-beside-stage layout (the aside) centered short text against
a huge column — the "weird vertical section left, empty section right" Austen
rejected. Every good fix breaks the tower apart.

## The shape

```
┌──────────┐  Section heading
│ animation│  Prose prose prose prose
│  (square)│  prose prose prose.
└──────────┘
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ ▶ │ A │ B │ C │ D │ E │ F │ G │   ← steps, one row (scrolls on phone)
└───┴───┴───┴───┴───┴───┴───┴───┘
```

- **Banner:** square live canvas (InlineAnimationPlayer, `chrome="minimal"
  fill`, lazy-mounted, gold in-view ring) on the LEFT; heading + prose on the
  right, vertically centered. DOM order is text-then-canvas (SSR/SEO first),
  visual order via `row-reverse`.
- **Strip:** the sequence's steps as one horizontal row of live
  `GuidePictograph` cells — SSR'd, each carrying its synchronous
  `describePictograph` aria-label, so the crawl surface IMPROVES (was
  browser-gated ChoreoCard + sr-only; now real prerendered cells). The sr-only
  notation block is kept anyway (standing rule: never drop it).
- **Narrow (<~600px container):** text, then canvas (capped ~20rem, centered),
  then strip (scroll-snap x, as today's `.flow-strip`).

The 5:7 ChoreoCard leaves the guide flow entirely. `ChoreoCard.lightMode`
(added 2026-07-16) stays — generic API. Physical-card affordance (tap-to-open
card view) is a possible follow-up, decided after Austen's eyeball pass.

## Primitive audit (never-hand-roll)

- **Reuse:** `InlineAnimationPlayer` (square canvas, minimal chrome),
  `GuidePictograph` (SSR pictograph + aria), the `.flow-strip` recipe
  (FlowFrame.svelte), gold-ring + lazy-mount IO logic (GuideCardStage),
  `simplifyRepeatedWord`, `deriveWord`, `stripToSequence`.
- **Extract:** `GuideStepStrip.svelte` — the strip markup/CSS currently inlined
  in FlowFrame, consumed by BOTH FlowFrame (catalog/demo strips) and
  SequenceShowcase. Consolidation, not new capability.
- **Create:** `SequenceShowcase.svelte` — the banner composition. Nothing
  composes animation + text + strip today; predecessor GuideCardStage is
  superseded and deleted.
- **Rejected:** `pickBestFitLayout` wiring into the baked thumbnail path — not
  needed once the card leaves the flow. Landscape-card render — losing option.

## FlowFrame routing (replaces cardRow/cardAside/solo)

`card: true` on a `pictographGroup` block → one `SequenceShowcase` per block.

**Which text a card owns (Austen, 2026-07-16 — first eyeball round):**

- Preceding text is absorbed ONLY as a complete heading-led mini-section
  (heading → prose → card, the permutations shape). A prose run with NO heading
  directly above it is shared narrative for the whole page/family (the
  dj-ek-fl intro) and stays in the flow. This killed the "DJ swallows the
  family intro" mis-attribution.
- Trailing prose/glyphs up to the next heading/card are the card's own label —
  always absorbed.
- Cards in a run of 2+ absorb nothing (shared prose stays above).

**Which shape it takes — layout answers to content density (same round; a
one-line label in the feature banner left a void of empty column):**

- `variant="feature"` — absorbed heading, or >180 plain-text chars: banner
  (canvas left ~330px, text right, gold ring) + full-width strip beneath.
- `variant="compact"` — caption-sized text or none: one tight band, canvas
  (~250px) | label + strip stacked, `width: fit-content` centred. Label =
  absorbed label prose, else the authored caption, else the simplified word.
  Caption never doubles with an absorbed label (caption only renders when no
  text was absorbed).

Until more shapes prove out, each new situation gets its own explicit solution
inside SequenceShowcase (a variant), not a bent existing one.

- `cardLayout` type field: dead, removed. `.flow-card-row`, `.flow-aside-group`,
  `.card-stage-*` CSS: removed with the paths that used them.

## Ledger

- [x] Spec
- [x] `GuideStepStrip.svelte` extracted; FlowFrame strip path delegates to it
- [x] `SequenceShowcase.svelte` (banner + strip + ring + lazy mount)
- [x] FlowFrame rewire (routing above); GuideCardStage deleted
- [x] Compact variant + heading-led absorption + text-weight variant rule
      (Austen's first eyeball round: lt1-dj-ek-fl EK void)
- [x] Fused seams (round 2): a sequence reads as ONE object — steps flush,
      hairline seams, outer corners rounded; no loose tiles
- [x] Balanced row wrap (round 3): strips NEVER scroll sideways — measured
      column → balanced rows (17 → 9+8), cells 104–132px, each row a fused
      bar (the printed step-row form); single scrollable row only as the
      SSR/no-JS fallback
- [x] Spacing rhythm (round 3): strip margins zeroed inside the showcase;
      internal banner↔strip gap 0.85rem < external margin-block 1.9rem/1.4rem
      so the unit coheres
- [x] Start-position canon (round 4): start box NEVER mixes into the step
      flow — its own leading column (separate framed cell, top-aligned, the
      card's top-left start) or its own row above. Start detection via the
      adapter's own `isStartBox`.
- [x] Width-first grid (round 5, Austen: "why not 8 cols instead of 4"): the
      card layout table is PORTRAIT-card canon and wrong for a wide band —
      steps prefer the widest fitting layout (one row when it fits, else the
      widest even divisor: 16 → 8×2 before 4×4; balanced-ceiling only for
      divisor-less counts). Start column vs start row decided by whichever
      leaves fewer, wider step rows; ties go to the column.
- [x] Full 2D fusion (round 6, "aesthetically golden" challenge): the step
      block is ONE solid rounded rectangle — hairline seams in both axes,
      row gap eliminated by moving step labels INSIDE their cells (the card's
      step-number convention, top-left, quiet). Row-mode start box anchors to
      the grid's leading edge (card row-0), never centred adrift. Seam
      geometry closed even for ragged fallback rows (cells carry bottom +
      leading edges; first row adds top, row-last cells add trailing).
- [x] Typecheck clean on touched files (`npm run check` 2026-07-16: only
      pre-existing errors in unrelated files, 0 in guide/card files)
- [x] Tab layout (round 7, "start disconnected + dead band"): the start box
      FUSES onto the grid's top-left — no gap, the grid's top border is the
      shared seam, tab corners round on top only, the grid corner under it
      squares off. The compact label moves INTO the start row's free band
      (GuideStepStrip `startAside` snippet, forced tab mode; tab pinned
      flex-end so tall labels can't lift it off the grid). Column mode
      remains for label-less feature strips.
- [ ] Austen's eyeball pass at phone/laptop/4K (permutations, gamma-loops,
      lt1-dj-ek-fl, sixteen-count, eight-letter-words) ← NEXT
- [ ] Decide physical-card affordance (tap-to-open?) after the pass
- [ ] Commit (Austen's call, scoped pathspec)
