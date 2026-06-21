# Arrow / Prop Separation — Dark-Mode Background Halo

**Date:** 2026-06-16
**Status:** Approved (mechanism), pending implementation review
**Author:** Claude (brainstormed with Austen)

## Problem

When an arrow occupies the same space as a same-color prop in a pictograph, the
two blend into one indistinguishable blob. Worst with wide props (fans,
doublestars, eightrings) whose silhouette spreads far past a staff. Example: Δ
(alpha3 → gamma1, doublestar), blue static arrow sitting on the blue doublestar —
you cannot tell where the prop ends and the arrow begins.

Staffs barely trigger this (thin silhouette, little overlap), so the fix targets
the wide-prop case and must not degrade the common staff case.

## Root cause

Props and arrows are both single-fill SVG paths colored from the same per-hand
color map (`svg-color-utils.ts`). The arrow is drawn directly on top of the prop
in a shared SVG (`PictographRenderer.svelte`). Same color + stacked + no
separator = melt.

A separator already exists, but **only in light mode**: ArrowSvg applies a white
`drop-shadow` halo when `!isDarkMode` (`ArrowSvg.svelte:107-109`). Dark mode never
got its version, so dark-mode pictographs (the default, and the screenshot in the
report) have no separation.

## Chosen approach — background-matching halo (option "A · medium")

Extend the existing light-mode halo idea to dark mode, coloring the halo to match
the pictograph background. A background-colored halo is **invisible against the
background** and only renders as a clean gap **where the arrow overlaps a prop**.
No "ugly border everywhere," because everywhere-but-the-prop the halo is the same
color as what is behind it.

Austen reviewed six live treatments on the real Δ doublestar overlap
(`/test/arrow-prop-separation`, dark mode) and selected **A · medium**.

### Spec

In `src/lib/shared/pictograph/arrow/rendering/components/ArrowSvg.svelte`:

- Rename the `lightModeStroke` derived to `haloFilter` and make it always
  produce a filter (not empty in dark mode):
  - **Light / `!isDarkMode`:** `drop-shadow(0 0 2px white)` ×3 — light-friendly
    counterpart at the same "medium" intensity. White stays invisible against
    print's white background (print renders `!isDarkMode`).
  - **Dark / `isDarkMode`:** `drop-shadow(0 0 2px #0a0a0f)` ×3 (the approved
    "medium" gap; `#0a0a0f` matches the dark bg rect in
    `PictographRenderer.svelte:338`).
- Template (`ArrowSvg.svelte:460`): apply `filter: {haloFilter}` whenever
  `!isSelected` (previously gated on `lightModeStroke` being truthy, which
  excluded dark mode).

### Decisions (resolved from code, not open questions)

- **Both modes get the medium halo.** Dark uses the bg-color `#0a0a0f`; light
  uses white at the same `×3 @2px` intensity (light-friendly, print-safe).
- **Halo color `#0a0a0f`**, matching the dark background rect.
- **Always on, no overlap gating.** A bg-colored halo is invisible off-prop, so
  the existing AABB overlap detector (`PictographRenderer.svelte:212`) is not
  needed for this.
- **Transparent / export / card contexts** that render dark inherit the dark
  halo; composited over black it stays invisible vs background.
- **Print mode** renders white bg and `!isDarkMode`, so the white branch already
  covers it — no print flag needed in ArrowSvg.
- **Known tradeoff:** the inline halo filter overrides the clickable
  hover/selection-glow CSS filter in dark mode — exactly the behavior light mode
  already has. Accepted as parity; revisit only if it reads wrong in the editor.

## Out of scope

- Option B (overlap-gated crisp outline) and option C (two-tone hue shading) —
  evaluated and rejected in favor of A.
- The arrow-tip z-promotion split system — orthogonal (arrow-vs-arrow tip
  occlusion, not prop-vs-arrow same-color confusion).

## Verification

- `/test/arrow-prop-separation` already renders the real Δ doublestar overlap.
  After the change, the production dark-mode pictograph should match the
  "A · medium" panel: clear gap between blue arrow and blue doublestar.
- Regression check: staff pictographs in dark mode should look essentially
  unchanged (thin halo invisible where there is no overlap).
