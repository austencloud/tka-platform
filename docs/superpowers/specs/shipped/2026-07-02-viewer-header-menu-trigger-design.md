# Viewer Header Menu Trigger — Design

**Date:** 2026-07-02
**Status:** Approved (in-chat), ready for implementation

## Problem

The overflow "…" menu in the sequence viewer is clipped behind the header. Two
causes:

1. The practice button became a **wide labeled accent pill** (`icon + "Practice"`),
   which grew the header's right cluster and shoved the three-dot trigger toward
   the centered title (the "Download Card" region during image export).
2. `RouteViewerHeader.svelte` renders `<ViewerOverflowMenu>` **without `dropDown`**,
   so the popover opens *upward* (`bottom: calc(100% + 8px)`) and is clipped above /
   behind the header at the top of the route page.

## Decision

Retire the standalone three-dot trigger in both viewer chromes. Make the **centered
header title + a chevron** the menu trigger, opening a dropdown **below** the header.
This frees the right cluster (fixing the crowding) and moves the popover downward
(fixing the clip). Give the practice button a better, on-theme icon.

Chosen options (confirmed with user):
- **Scope:** both `SequenceViewerDrawerHost` (main drawer viewer) and
  `RouteViewerHeader` (`/sequence/[id]`).
- **Trigger:** the centered **title region + chevron** is one click target. Explicit
  buttons (back, practice, close) stay separate — no conflict with swipe-to-dismiss.
- **Practice button:** keep the "Practice" label; swap icon `fa-signal` → `fa-dumbbell`
  (the established train/practice icon: `TrainSetup`, `ProgressPanel`,
  `SequencePromptCard`).

## Components & Changes

### 1. `ViewerOverflowMenu.svelte` (shared — extend, not new)

Reuse the existing viewer overflow menu (it owns the item model, backdrop, and
WAI-ARIA keyboard nav). Extend it:

- **`trigger?: Snippet<[{ isOpen: boolean }]>`** — when provided, the trigger button
  renders this snippet (a transparent title-style row) instead of the
  `fa-ellipsis-vertical` glyph. Open/close, backdrop, keyboard nav, and menu-item
  derivation are unchanged. No `trigger` → three-dot exactly as today, so the other
  consumers (`MidFooterControls`, `q/[code]`) are untouched.
- **`align="center"`** — popover positions `left: 50%; transform: translateX(-50%)`
  so it drops centered under the title. Existing `left`/`right` unchanged.
- Trigger button gets a `title-variant` styling path (transparent, inline-flex row,
  `min-height: var(--min-touch-target)`) applied when `trigger` is set.
- Practice menu item icon `fa-signal` → `fa-dumbbell` (uniform with the pill).

Backward compatible: default trigger + `align` behavior identical to current.

### 2. `RouteViewerHeader.svelte`

- Remove the standalone `<ViewerOverflowMenu>` from `header-right`.
- Wrap the center title in `<ViewerOverflowMenu trigger dropDown align="center" …>`.
  Trigger snippet = title text + `fa-chevron-down` caret. Menu opens **below**
  (fixes the clip). Pass the same callbacks the standalone menu received.
- Practice pill: `fa-signal` → `fa-dumbbell`, label kept.
- Trigger + chevron render only when `!practiceActive`; plain title in practice.

### 3. `SequenceViewerDrawerHost.svelte`

- Delete **both** `{@render overflowMenu(...)}` calls (mobile left-actions + desktop
  right-actions).
- Render **one** title-trigger menu inside `.drawer-header-title-group`:
  `align="center"`, `dropDown`, `motionVisibility` passed when `isMobileWidth`
  (`includeMotion` = mobile; desktop keeps `MotionVisibilityToggle` inline).
- `.drawer-header-title-group` → `pointer-events: auto` (it was `none`).
- Practice pills (mobile + desktop branches): `fa-dumbbell`, label kept.
- Title-trigger only when `!practiceActive`; plain (keyed-crossfade) title otherwise.
  Preserve the existing title `{#key …}` crossfade inside the trigger snippet.

### 4. Chevron + consistency

- Chevron `fa-chevron-down`, rotates 180° on open — **transform-only**, gated by
  `prefers-reduced-motion`. Centered title group → zero sibling layout shift
  (edge clusters are pinned; the title+chevron group re-centers as a unit).
- Verify no unrelated `fa-signal` usages are swept (only practice-entry buttons +
  the menu's Practice item).

## Data Flow

Unchanged. The menu still receives action callbacks from the orchestrator context
(drawer) / props (route). Only the **trigger element** moves from a dedicated
button in the action cluster to the centered title. Open state stays internal to
`ViewerOverflowMenu`.

## Edge Cases

- **Practice mode:** title is a plain label (no chevron, not a button); menu not
  needed mid-practice (mirrors current `!practiceActive` gating).
- **Landscape / mobile-practice:** title group already hidden by existing CSS —
  no trigger shown, unaffected.
- **Export states:** title reads "Download Card" / "Download Animation" / "Upload
  Video" and still opens the menu — actions remain valid.
- **Reduced motion:** chevron rotation + popover animation both suppressed.
- **a11y:** trigger button keeps `aria-haspopup="menu"`, `aria-expanded`, and an
  `aria-label`; visible title is the accessible name content; 44px min target.

## Testing

- `npm run check` (types) + `npm run build` gate.
- Runtime: open viewer (drawer + `/sequence/[id]`), confirm title+chevron opens the
  menu below the header, chevron rotates, practice shows the dumbbell, and no clip.
- Optional component test (vitest-browser-svelte) on `ViewerOverflowMenu`:
  `aria-expanded` toggles and the menu opens when the trigger snippet is clicked —
  justified as a shared primitive gaining new trigger behavior (test-on-change).

## Non-goals

- No rewrite of `ViewerOverflowMenu` onto `bits-ui` Popover (accepted tradeoff:
  extend the proven hand-rolled popover to avoid risk to 3 consumers).
- No change to the menu's item set or ordering.
- `MidFooterControls` keeps its three-dot trigger (different surface); its practice
  icon may be aligned to `fa-dumbbell` as an optional consistency touch.
