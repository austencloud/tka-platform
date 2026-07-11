# Guide Companion — Mobile Split-View Redesign

Date: 2026-07-11. Approved by Austen.

## Problem

On mobile (≤720px container), the guide reader companion is a full-screen
overlay that slides up over the whole sheet and crams in header title, player,
BPM button, and a wrapping admin row. When you tap a sequence on the page the
page vanishes behind the panel, and the animator competes with chrome for
space. The real intent on mobile: **tap a sequence → immediately watch the
animation, right next to the cell it came from**, with nothing else in the way.

Austen: the animation is the hero; every other button is in-depth and belongs
behind an overflow. And critically — the sheet should come up *just enough* to
show the animator as a square in the bottom half while the page scrolls the
animated cell into the top half, so you see the ringed source cell and the
live animation at the same time.

## Design

### Split view (mobile, ≤720px only)

- Tapping a sequence cell opens the companion as a **bottom sheet occupying the
  bottom ~half** of the viewport (not full-screen). The sheet height is sized
  so the animator (InlineAnimationPlayer, minimal chrome) renders as a clean
  square with only a slim top bar above it. Target height: `min(50svh, square
  that fits width)` — the animator square drives it; chrome is minimal so the
  bottom half is plenty.
- The **top half keeps showing the guide page**. On mobile cell-click the reader
  **auto-scrolls the doc so the clicked cell lands in the visible band above the
  sheet** (viewport height minus sheet height), and keeps it there. The cell
  already receives the golden selection ring via GuideActiveStep — so the ringed
  source cell and the animation are both visible simultaneously.

### Minimal chrome (the sheet face)

- A slim top bar over the animator: **grab handle** (swipe-down or tap to
  dismiss) on the left/center, a single **"⋯" overflow** button on the right.
- NO title text, NO BPM button, NO admin row on the face. Just handle + ⋯ +
  the animator square.

### Overflow — grow the sheet upward

- Tapping ⋯ **expands the sheet taller** to reveal an in-depth controls region
  ABOVE the animator (the animator stays put; it never disappears). The page
  scroll-sync re-adjusts so the ringed cell stays visible in the shrunken top
  band. Tapping ⋯ again (or a collapse affordance) returns to the compact
  hero height.
- Contents of the expanded region:
  - **BPM** (the existing BpmQuickPopover content / inline stepper)
  - **Admin (when signed in as admin + a stripKey):** Replace, Revert, Reset,
    Transform, Remix, Edit steps, Copy-for-AI — the current admin actions,
    restyled for touch (full-width rows, 44px targets).
  - **Codex mode:** the GuideCodexControls (prop / show / turns / transform)
    render here as a labeled, scrollable section.

### Desktop unchanged

- Above 720px the companion keeps its current right-panel layout verbatim
  (player, BPM below, admin row, codex controls stacked). The redesign is a
  mobile-only branch inside GuideCompanion; desktop markup/behavior is not
  touched.

## Architecture

- **Mobile detection**: the companion learns it is in the mobile overlay from
  the reader (the reader already switches layout at the 720px container query).
  Pass an explicit `isMobile` prop from GuideReader (derived from a
  `matchMedia`/container observer the reader owns) rather than duplicating the
  breakpoint — single source of truth for the 720px cutoff.
- **Sheet height + expand state**: local `$state` in the companion
  (`overflowOpen`) toggles compact vs expanded height; CSS drives the size via
  a height/max-height transition (no layout thrash). Reduced-motion collapses
  the transition.
- **Scroll-sync**: a new reader responsibility. When `handleSequenceClick`
  fires AND mobile, after the sheet opens, scroll the doc scroller so the
  clicked cell's bounding box is centered in the top band
  (`availableTop = viewportH - sheetH`). Reuse the reader's existing scroll
  machinery (SCROLL_KEY / the doc scroller ref); add a `scrollCellIntoBand(el,
  bandBottom)` helper. Re-run when the sheet expands/collapses (band height
  changes). Respect reduced-motion (`behavior: auto`).
- **Dismiss**: grab handle tap closes (existing onClose). Swipe-down: a
  lightweight pointer-drag on the handle/top-bar that closes past a threshold —
  reuse an existing drag primitive if one fits (grep first per never-hand-roll;
  `@neodrag/svelte` is already a dep — check), else a minimal pointer handler.
  Swipe-down is a nice-to-have; ship tap-to-close first, layer swipe if cheap.

## Components touched

- `GuideCompanion.svelte` — add `isMobile` prop; mobile branch: hero layout
  (handle + ⋯ + animator square) with an expandable overflow region reusing the
  existing BPM/admin/codex-controls markup (extract the shared control bodies so
  desktop + mobile both render them without duplication).
- `GuideReader.svelte` — own `isMobile` (matchMedia 720px), pass to companion;
  add mobile scroll-sync on cell-click + on sheet expand/collapse; the
  companion overlay height on mobile becomes the compact/expanded sheet (CSS).

## Testing

- `npm run check` clean; guide unit tests green.
- CDP mobile emulation (~390×844 DPR3): tap a sequence → sheet is bottom-half,
  animator square, ringed cell visible in top band; ⋯ grows the sheet and shows
  BPM/admin/codex controls; dismiss returns to page. Desktop screenshot
  unchanged.

## Non-goals

- Changing desktop layout.
- Changing what the controls DO (Replace/Transform/etc. logic is untouched —
  only their mobile placement/chrome changes).
- A full gesture system — tap-to-dismiss is the floor; swipe-down is optional
  polish.
