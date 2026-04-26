# Card Visual Polish Design

**Date:** 2026-04-04
**Status:** Approved
**Builds on:** `2026-04-03-unified-print-preview-design.md`, `2026-04-03-print-card-rendering-fixes-design.md`

## Summary

Visual polish pass for Choreo Cards print output. Adds elemental stripe frames to card fronts, pins the mandala to true center on card backs, derives and displays VTG turn ratios, updates branding to "Choreo Cards", and adds rounded corners throughout.

## Decisions Made During Brainstorming

| Decision | Choice | Why |
|----------|--------|-----|
| Front frame style | Colored border with VTG elemental colors | Gives each family deck a distinct identity when fanning |
| Frame texture | Diagonal pinstripe (45deg) + white edge glow | More visual interest than solid color, feels like a real card product |
| Card back mandala | Pinned to true center via absolute positioning | All backs look uniform regardless of text content length |
| VTG ratio source | Derived from sequence data (approach A) | Architecturally pure, reusable beyond card backs |
| Ratio label style | Medium size, regular white text below mandala | Functional, not decorative |
| Branding text | "Choreo Cards" — letterpress style (all caps, wide tracking, thin weight) | Product name for the physical card game. No "· TKA" suffix (URL handles that). Text treatment revisit planned once real renders are available. |
| LOOP deck treatment | Neutral gray stripes, no ratio label | LOOPs don't belong to a VTG family |

## Design Specification

### 1. Card Front — Elemental Stripe Frame

**Current state:** Gray (#808080) bleed area surrounding white content area with inner margin.

**New state:** Two-tone diagonal pinstripe pattern in the bleed/frame area, with a white edge glow overlay for depth. Content fills the inner rounded rectangle edge-to-edge.

#### Stripe Pattern

```
repeating-linear-gradient(45deg,
  <accent> 0px, <accent> 3px,
  <dark> 3px, <dark> 6px
)
```

Plus an edge glow overlay:
```
linear-gradient(to bottom,
  rgba(255,255,255,0.2) 0%,
  transparent 20%,
  transparent 80%,
  rgba(255,255,255,0.2) 100%
)
```

#### Element Color Pairs

Each VTG family maps to an accent + dark complement:

| Family | Element | Accent | Dark Complement |
|--------|---------|--------|-----------------|
| split-same | Water | #63b7cd | #1a5276 |
| split-opp | Fire | #f2673a | #6b1a0a |
| tog-same | Earth | #75A874 | #2a4a29 |
| tog-opp | Air | #78b7e3 | #1a4a6b |
| quarter-same | Sun | #ffde17 | #7a6a00 |
| quarter-opp | Moon | #6a4199 | #2a1540 |
| (LOOP/default) | Neutral | #999999 | #444444 |

These are added to `elemental-theme.ts` as a `darkComplement` field on `ElementalTheme`.

#### Rounded Corners

- Outer card edge: ~12px radius at print resolution (maps to ~4px in `renderFront` at 822px canvas)
- Inner content area: ~8px radius (maps to ~3px)
- Canvas clipping via `ctx.roundRect()` (Chrome 99+, safe since this only runs client-side in the browser, never SSR/Node)

#### Content Fill

The sequence image from ImageComposer fills the inner rounded rect edge-to-edge. No white margin between the image and the inner border. The gray header/footer of the sequence image naturally extend to the inner card edges.

#### Implementation in `PrintCardRenderer.renderFront()`

1. Draw rounded-rect clip for outer card
2. Fill with diagonal stripe pattern (canvas `createPattern` or manual stripe drawing)
3. Draw edge glow overlay
4. Clip inner rounded rect
5. Draw sequence image filling the inner area completely (no `innerMargin`)

#### How the renderer knows which element

`PrintRenderOptions` gains an optional `elementTheme?: ElementalTheme` field. The caller (PrintPreviewPages, export flows) passes it based on context:
- VTG family drill-down: look up from `VTG_ELEMENTAL_THEMES` by `familyId`
- LOOP decks: omit (renderer defaults to neutral gray stripes on fronts; backs usually won't show ratio since LOOP sequences have mixed turns)
- The renderer reads `accent` and `darkComplement` from the theme, or falls back to neutral gray (#999/#444).

**Note on `renderBack`:** The back card's visual identity (border gradient, decorations) is driven by `CardBack.svelte`'s existing theme system (`card-back-theme-visuals.ts`), not by `elementTheme`. The `elementTheme` field on `PrintRenderOptions` is only used by `renderFront()` for the stripe frame. The card back border gradient is already themed by the background setting. No changes needed to `CardBackDomRenderer` or `renderBack()` for this spec.

### 2. Card Back — Mandala Centering

**Current state:** `.content` uses flexbox with `padding: 20cqi 4cqi 10cqi`. Mandala sits in a `flex: 1` container. Position varies with word length and presence of pronunciation/LOOP explanation.

**New state:** Mandala pinned to absolute center of the card. Word and ratio label positioned at fixed offsets above/below center.

#### Layout Structure

```
.cb-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.cb-word {
  position: absolute;
  top: 14%;  /* fixed offset, tunable with real renders */
}

.cb-mandala {
  /* centered by the flex container */
}

.cb-ratio {
  position: absolute;
  top: calc(50% + 70px);  /* fixed offset below center, tunable */
}
```

The word, pronunciation (if any), mandala, and ratio label are all positioned relative to the card center. The mandala is always at the same spot on every card.

### 3. VTG Ratio Derivation

**Current state:** `CardBackData` has no ratio field. The ratio exists only in `FamilyRatioGroup.ratio` during drill-down browsing.

**New state:** `CardBackData` gains `vtgRatio: string | null`. Derived from the sequence's motion turn values.

#### Derivation Logic

Added to `card-back-data.ts`:

1. Scan all steps, collect every numeric `turns` value across all motions on both hands (skip "fl" floats).
2. Check if all collected turn values are **uniform** (same value). If turns are mixed (common in LOOP sequences where each beat has different turn values), the ratio is meaningless — return `null`.
3. If uniform, reverse-lookup using `VTG_TURNS_RATIO_MAP` (the inverse of the existing `VTG_RATIO_TURNS_MAP`): `{ 0: "1:1", 0.5: "2:1", 1: "3:1", 1.5: "4:1", 2: "5:1", 2.5: "6:1", 3: "7:1" }`
4. If no turns found, return `"1:1"` (base motions)
5. If uniform turn value doesn't match any key, return `null`

Note: `VTG_TURNS_RATIO_MAP` is the programmatic inverse of the existing `VTG_RATIO_TURNS_MAP`. Both coexist — one for ratio→turns lookups (existing usage in aggregator), one for turns→ratio lookups (new usage here).

**Why uniform-only:** VTG deck sequences are grouped by ratio — every motion shares the same turn value, so the ratio is meaningful. LOOP sequences often have wildly different turn values per beat, making any single ratio label misleading.

#### Display

- Shown on card back below the mandala
- Medium size text (~4cqi), regular weight, white color (`rgba(255,255,255,0.85)`)
- Only displayed when `vtgRatio` is non-null
- LOOP cards: ratio usually `null` (mixed turns per beat), so label hidden. Only shows if turns happen to be uniform.

### 4. Branding Update

**Current:** `Choreo Card · TKA`

**New:** `CHOREO CARDS` — all caps, wide letter-spacing (~0.2em), thin weight (300), small size (~2.8cqi). Letterpress aesthetic.

No "· TKA" suffix. The bottom URL (`tkaflowarts.com`) handles brand association.

This replaces the entire `.top-brand` block in `CardBack.svelte` (currently three spans: "Choreo Card", "·", "TKA") with a single element.

This is a starting point. The text treatment will be revisited once real card renders are available for evaluation.

### 5. Print Preview — Rounded Card Cells

**Current state:** `.card-cell` in `PrintPreviewPages.svelte` has `border-radius: 4px`.

**New state:** Increase to `border-radius: 8px` with `overflow: hidden` to clip the rendered card images to rounded corners, matching the grid view's playing-card aesthetic.

### 6. Element Theme Data Extension

`elemental-theme.ts` additions:

```typescript
export interface ElementalTheme {
  readonly familyId: string;
  readonly element: string;
  readonly accentColor: string;
  readonly darkComplement: string;  // NEW
  readonly svgPath: string;
}
```

Each entry in `VTG_ELEMENTAL_THEMES` gains its `darkComplement` value (see color table above).

A helper function to look up theme by familyId:

```typescript
export function getElementalTheme(familyId: string): ElementalTheme | null {
  return VTG_ELEMENTAL_THEMES.find(t => t.familyId === familyId) ?? null;
}
```

And a reverse lookup map for ratio derivation:

```typescript
export const VTG_TURNS_RATIO_MAP: Readonly<Record<number, string>> = {
  0: "1:1", 0.5: "2:1", 1: "3:1", 1.5: "4:1", 2: "5:1", 2.5: "6:1", 3: "7:1",
};
```

## Files Changed

| File | Change |
|------|--------|
| `elemental-theme.ts` | Add `darkComplement` to interface and data, add `VTG_TURNS_RATIO_MAP`, add `getElementalTheme()` |
| `PrintCardRenderer.ts` | Rewrite `renderFront()` for stripe frame + rounded corners + full-bleed content |
| `IPrintCardRenderer.ts` | Add `elementTheme?` to `PrintRenderOptions` |
| `card-back-data.ts` | Add `vtgRatio` derivation to `CardBackData` and `deriveCardBackData()` |
| `CardBack.svelte` | Absolute-position mandala to center, add ratio label, update branding to "CHOREO CARDS" letterpress style |
| `PrintPreviewPages.svelte` | Increase card-cell border-radius to 8px, pass `elementTheme` through to renderer |
| `VtgFamilyDrillDown.svelte` | Pass element theme to PrintPreviewPages |
| `DeckBrowser.svelte` | Pass neutral theme (or none) for LOOP decks |

## Calibration Notes

The following values are starting points and should be tuned with real rendered output:

- Stripe width (3px accent / 3px dark) — may need adjustment at 300 DPI
- Edge glow opacity (0.2) — may be too subtle or too strong on print
- Word position (top: 14%) — depends on actual word + pronunciation rendering
- Ratio label position (50% + 70px) — depends on final mandala size
- Branding letter-spacing (0.2em) — needs real render evaluation
- Inner/outer corner radii — need to look right at both screen preview and print size

## Out of Scope

- Tarot size bugs (separate issue, different aspect ratio / grid layout)
- Custom SVG wordmark for "Choreo Cards" (future design task)
- Element-specific micro-patterns (waves for water, flames for fire) — considered but deferred
