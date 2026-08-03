# Guide Surface 4K Treatment: Lockstep Scaling + Targeted Recomposition

**Date:** 2026-07-19
**Status:** Approved (Austen approved hybrid approach in session; spec review waived)
**Scope:** The guide shell surface: `/guide` hub, `/guide/level-1/[slug]` topic pages,
`/guide/level-2` landing + chapter pages. Other public pages (legal shell, product
detail, notation letters, poi) are follow-on candidates using the same recipe.

## Problem

4K audit (2026-07-19, emulated 3840x2160 screenshots) showed the guide reading
surface renders as a ~1100px strip in a 3840px canvas: sidebar pinned to the
viewport edge, body type at laptop size, footer link columns crushed to
one-word-per-line inside the 90ch prose track. Austen's requirement: everything
must FEEL designed for 4K; no prose caps that let text lag behind widened
material (the "disjointed" failure).

## Design

### Layer 1: lockstep fluid root scaling

Above 1680px viewport width, root font-size ramps 16px to 24px linearly
(reaching 24px at 3840). Scoped with `html:has(.guide-layout)` so only pages
mounting the guide shell scale; `/guide/level-1/book` and `/print` routes import
guide.css but never render `.guide-layout`, so their fixed-inch artboards stay
at 16px root.

Everything rem/ch/em-based grows in lockstep: FlowFrame's 62rem frame and 34rem
measure, the 90ch prose track, sidebar, cards, nav, footer type. Because the
ramp is a single multiplier, no element can outgrow a neighbour; disjointedness
is impossible by construction.

Pixel values inside the shell that would escape the ramp convert to rem
(identical rendering at 16px root, so zero change below 1680px):
sidebar 220px -> 13.75rem, pictograph sizes 120/180/280px -> 7.5/11.25/17.5rem
(mobile 100/140/220px -> 6.25/8.75/13.75rem), diagram img 320px -> 20rem,
sequence-player controls, hub page px caps, level-2 landing.

### Layer 2: targeted recomposition (>=1680px)

1. **Shell balance:** `.guide-layout` centers sidebar+content as one unit
   (`justify-content: center`); sidebar switches fixed -> sticky flex child
   (`flex: 0 0 13.75rem`); content `flex: 0 1 118rem`. Kills the lopsided
   right-side void.
2. **Media rides wide:** breakout grid tracks widen 6rem -> 14rem; diagrams,
   pictograph grids, and sequence players span `breakout` while prose keeps its
   scaled measure.
3. **Footer:** `SiteFooter` spans the `full` track at every width (fixes the
   crushed columns at all desktop sizes, not just 4K); its inner cap widens from
   the site's 1720px to `min(107rem, 92vw)` inside the guide composition.
4. **Hub 2200px tier rework:** structural px -> rem, font-size bumps deleted
   (the root ramp now provides the growth; keeping them would double-scale).
5. **Level-2 landing:** 600px column -> 42rem, h1 adopts the guide script
   (Tangerine) for parity with the hub and topic heroes.

### Explicitly out of scope

- Sheet mode's 816px artboard scale-to-fit stays capped at 1 (print artifact).
- SiteHeader's 1720px inner cap (fixed translucent bar; capped navs are the
  norm on ultrawide; revisit if it reads inset after living with it).
- Per-section px values inside level-2 chapter `_sections` components (verify
  visually; fix worst offenders as follow-up).

## Verification plan

Chrome DevTools MCP emulated screenshots at 3840, 2560, 1920, 1366 of: hub,
level-1 topic (the-grid), level-2 landing, level-2 chapter (turns). Below
1680px must be pixel-identical to today. `check:fast` green.

## Ledger

- [x] guide.css: root ramp + composition + breakout tracks + px->rem
- [x] GuideShell: footer moved below layout in a full-bleed navy wrapper
      (in-composition footer painted a background island at 4K); header/footer
      inner caps widened to composition width in guide scope
- [x] Hub +page.svelte: px->rem, 2200 tier rework (font bumps deleted)
- [x] Level-2 landing restyle (42rem, script h1)
- [x] Verified at 3840 (root 24px, composition centered 334/344 margins,
      header/footer inner aligned at 3162px), 1920 (root 16.9px, fills
      viewport), 1366 (root 16px, fixed 220px sidebar - identical to before),
      390 mobile (sidebar hidden, menu button up, root 16px)
- [x] check:fast: 0 errors in touched files (185 pre-existing errors across
      unrelated files on the shared checkout)
- [x] Commit (scoped pathspec)

## Known issues surfaced during verification (out of scope)

- Level-2 chapter pages overflow ~32px horizontally at 390px mobile:
  `showcase-wrap` inside `.guide-section` renders 420px wide. Pre-existing
  (component internals untouched by this work).
