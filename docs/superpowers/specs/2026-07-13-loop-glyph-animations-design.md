# LOOP Glyph Animations — Design

**Date:** 2026-07-13
**Status:** Approved (conversational)
**Owner surface:** LOOP type drawer (`LOOPDrawer` → `LOOPExpandedOverlay` → `LOOPComponentGrid` list layout)

## Problem

The LOOP type picker shows six transforms as static FontAwesome icons + one-line
descriptions (`loop-constants.ts`). Even domain-fluent users (Austen included)
can't tell from "Mirror left↔right (vertical axis)" what a mirrored LOOP will
actually do to their sequence. The decisive moment of the picker needs a
pre-notation, visual answer to "what will this give me?"

## Decision

Animated per-transform glyphs in the drawer's list layout only. Abstract
motion scenes (dots on a mini grid), not pictographs — the target user is
pre-notation. In-card compact grid layout (3×2) keeps static icons.

## New primitive

`src/lib/features/create/generate/components/modals/LoopGlyph.svelte`

- Props: `component: LOOPComponent`. Fixed 80×48 stage (zero layout shift).
- Pure SVG + CSS keyframes. No canvas, no rAF, transform/opacity only.
- Grep evidence nothing exists: `LoopPreview|LoopDemo|loop.*animat` across
  `src/lib` hits only the animation engine, store live-previews (real
  sequences), and shimmer CSS. `LoopBlockTimeline` is static structure blocks —
  different job (combo composition), kept as-is.

## Shared visual vocabulary

Every glyph uses the identical scene so the DIFFERENCE reads as the transform:

- 80×48 stage, faint corner dots implying the grid
- Two hand dots in the app's blue/red hand colors, orbiting/tracing a short
  arc path (the "base motif")
- Timeline ~2.5s: first half plays the base motif, second half plays the
  transformed motif, short hold, loop
- Component accent color (from `LOOP_COMPONENTS`) highlights the moment of
  transformation (axis flash, color crossfade, direction reversal)

## Per-component second halves (MCP-grounded, `get_domain_topic("loop")`)

| Component | Second half |
|---|---|
| Rotated | Motif repeats rotated 180° — dots continue orbiting the same direction |
| Mirrored | Vertical axis line flashes; motif replays mirrored left↔right |
| Flipped | Horizontal axis line flashes; motif replays mirrored top↔bottom |
| Swapped | Identical paths; dots crossfade colors at the midpoint (blue↔red) |
| Inverted | Identical paths; a small spin tick orbiting each dot reverses direction |
| Rewound | Dots retrace the first half's path backward |

Mirrored/Flipped vs Rewound disambiguation: mirrored/flipped show the axis
line + a mirrored ghost trail on the far side of the axis; rewound shows the
same trail being consumed backward. Trails (fading stroke paths) are part of
the vocabulary so "where the motion went" persists long enough to compare.

## Integration

`LOOPComponentButton.svelte`: when `showDescription` (list layout), render
`<LoopGlyph {component} />` in place of the 48px icon box, sized 80×48. The
`with-description` icon styles adjust to the wider stage. Grid layout path
untouched.

## Reduced motion

`prefers-reduced-motion: reduce` → static before→after composition (base
motif ghost, arrow, transformed motif ghost). Never a frozen mid-animation
frame. Owned inside `LoopGlyph`, not by consumers.

## Performance

Six concurrent CSS animations, GPU-composited properties only. Drawer content
unmounts on close (`closeLOOPPanel` nulls props), so nothing animates in the
background. No JS timers.

## Not doing (YAGNI)

- Combo composition preview — `LoopBlockTimeline` already shows structure
- Glyphs in the compact in-card grid layout
- Hover/long-press triggered playback (no hover on mobile; ambient loops chosen)
- Pictograph-fidelity demos (more notation ≠ less confusion for novices)

## Verification

- Test page render of the drawer list (visualization-routing: real components)
- Confirm zero layout shift across all six rows (fixed stage)
- `prefers-reduced-motion` emulation shows static before→after
- One full `npm run check` before commit
