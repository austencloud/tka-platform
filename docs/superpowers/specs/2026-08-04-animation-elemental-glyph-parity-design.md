# Animation Elemental Glyph Parity

**Date:** 2026-08-04
**Status:** Approved
**Goal:** Give the 2D animation viewer an Element display setting and render the
same canonical elemental glyph in live playback, the landing hero, and encoded
video exports.

## Problem

The pictograph renderer already places `ElementalGlyph.svelte` in the
bottom-right corner of its 950-unit viewBox. Its slot is 120 by 140 units with a
40-unit inset. The landing hero does not use that renderer. It adds a separate
HTML image capped at 46px, so the icon is smaller and uses different artwork.

The animation visibility state has no elemental-glyph flag. The Display panel
therefore cannot expose the capability, and the video compositor has no way to
bake the glyph into downloaded animation frames.

## Reuse decision

Internal discovery searched `elemental`, `element glyph`, `element badge`,
`showElemental`, and `elementalGlyph` across shared components, feature
components, render services, and tests.

- **Reuse** `src/lib/shared/pictograph/shared/components/ElementalGlyph.svelte`
  for live animation. It already owns the fused artwork, current-step gating,
  accessibility label, and transition behavior.
- **Extend** `AnimationVisibilityStateManager` with a persisted
  `elementalGlyph` boolean. It is the existing owner for every animation Display
  toggle.
- **Reuse** `SvgImageCache` for export-time asset decoding.
- **Extend** `ExportGlyphPrerenderer` and `ExportFrameCompositor` so deterministic
  video frames use the same current-step element and geometry.
- **Extend** the existing Display chip grid. No new selector, chip, badge, state
  service, or image loader is created.

The Svelte documentation confirms that component-rendered SVG content and
conditional SVG blocks are supported. No framework extra or npm package can
provide TKA-specific elemental classification or artwork, so an external UI
dependency is not applicable.

## Behavior

1. `elementalGlyph` defaults off for animation viewers and persists with the
   other animation visibility settings.
2. The Display panel exposes an `Element` toggle. The regular nine-control grid
   is three columns by three rows. The Left/Right variant uses two columns for
   ten controls, avoiding a stranded final control.
3. The canvas context menu and legacy visual pane expose the same flag.
4. `GlyphOverlay` derives the current step's elemental type and renders the
   existing `ElementalGlyph` inside the 950-unit SVG overlay.
5. The landing hero removes its custom HTML badge. Its existing shape-matrix
   element signal only enables or disables the canonical overlay; the glyph
   shown still comes from the current step.
6. Video export resolves the same visibility flag, predecodes only the element
   images needed by the sequence, and draws the current step's glyph at the
   canonical bottom-right coordinates before encoding each frame.
7. Tunnel/art export explicitly suppresses the elemental overlay with its other
   animation chrome.

## Shared geometry

The canonical 950-unit layout is expressed by one pure module consumed by the
Svelte glyph, direct canvas renderer, and video compositor:

- width: 120
- height: 140
- right inset: 40
- bottom inset: 40

Canvas renderers contain-fit each source image inside that box without changing
its aspect ratio.

## Risks and controls

- **Missing first-frame image:** all required WebP assets are decoded before the
  export loop begins.
- **Preview/export drift:** live SVG and encoded canvas use one layout helper and
  the same per-step TnD derivation.
- **Stale landing classification:** the landing prop controls eligibility only;
  the rendered glyph is always derived from the live step.
- **Control-grid orphan:** fixed column counts are selected by control count,
  then verified at every required viewport.
- **Unsupported step:** the existing glyph component and derivation return no
  glyph when the current step has no elemental classification.

## Verification

- Unit tests for default and persisted visibility state.
- Unit tests for canonical placement and aspect-ratio containment.
- Unit tests proving export picks the current step's decoded elemental asset and
  suppresses it when disabled.
- Focused TypeScript/Svelte check, followed by the single full check allowed for
  the completion gate.
- Browser verification of the landing hero and viewer Display panel at
  1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, and 375x667.
- Export one short clip and inspect a decoded frame for preview/export parity.
