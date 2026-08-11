# Gallery Filter Pane: Collapse + Resize

**Date:** 2026-08-11
**Status:** Approved (Austen, this conversation)
**Driving feedback:** *"this sidebar in the gallery where you get to pick what
you filter by should probably be resizable, or even dismissable ... just trying
to reduce the visual overwhelm experience here."* Follow-up: include the drag
handle too — `ResizeHandle` already exists, so it's cheap.

## Problem

The split-pane filter workspace's left column is a fixed grid track:
`minmax(25rem, 27.5rem)` in `GalleryDrill.svelte` (~line 702), stepping to
`minmax(40rem, 46rem)` when the drill container passes 2300px. On Austen's 4K
desktop that is a permanent 640–736px block on the left edge of the gallery —
visually heavy even when he is browsing results, not filtering. There is no way
to shrink it or put it away.

## Design

Three changes, all inside the existing split-pane composition. `FilterWorkspace`
is shared by the gallery and the Library (`AllLibraryView`), so both surfaces
get all three by construction.

### 1. Collapse

- A collapse affordance on the left pane (icon button, chevron-left, 44px
  target, top-right of the pane surface — a real button per
  `clickables-look-like-buttons.md`).
- Collapsed state: the split grid drops its first two tracks (pane + handle)
  and the results column takes the full band. The results header keeps the
  existing rule strip (count + grouped rule sentence) as the filter summary.
- Reopen: a "Filters" pill rendered at the start of the results header row
  while collapsed (leading position, same `PanelButton` family as the strip
  actions). Clicking it restores the pane at its persisted width.
- Collapse/expand animates the grid track (`transition` on
  `grid-template-columns`; collapse to 0fr + opacity), disabled under
  `prefers-reduced-motion`.

### 2. Resize

- `src/lib/shared/panels/ResizeHandle.svelte` (existing shared primitive:
  pointer-captured, delta-emitting, `role="separator"`, focusable) sits as its
  own grid track between pane and results, replacing part of the current 1rem
  gap.
- Drag maps delta → pane width in px, clamped **352–736px (22–46rem)**, applied
  as `--filter-pane-w` on the drill stage. The grid template becomes
  `minmax(0, var(--filter-pane-w)) auto minmax(0, 1fr)` while the pane is open.
- The pane is already `container-name: drill` scoped, so the value editors
  recompose live during the drag — no extra wiring.
- Keyboard: while the handle has focus, ArrowLeft/ArrowRight adjust width by
  16px steps within the same clamp (the primitive is focusable but delta-only;
  the host adds the key handling).
- On drag end (and on keyboard adjust), width persists.

### 3. Leaner default

- Delete the ≥2300px `minmax(40rem, 46rem)` tier. Default width is **27.5rem at
  every size**; anyone who wants the monumental editors drags wider, and that
  choice sticks.

## Persistence

Same shape as `tka-viewer-rail-width`: two localStorage keys,
`tka-filter-pane-width` (px number) and `tka-filter-pane-collapsed`
("1"/absent), read once at mount inside try/catch (private-browsing denial
falls back to defaults: 27.5rem, expanded). Written on drag end / toggle.
State lives in `GalleryDrill.svelte` beside the existing `paneWidth`
measurement state; no new store module — this is two values with one owner.

## Ownership / routing (never-hand-roll evidence)

- **Reusing** `ResizeHandle` (`src/lib/shared/panels/ResizeHandle.svelte`) for
  the drag; **reusing** `PanelButton` for collapse + reopen controls.
- Search terms run: `resize-handle`, `splitter`, `col-resize`,
  `aria-valuenow separator`, `localStorage width|pane|panel`. Closest matches:
  the panels ResizeHandle (chosen), RetroSplitter (feature-local, win95 skin —
  not a candidate), viewer rail persistence (pattern copied).
- No new shared capability is created; the collapse/resize state is
  feature-local to GalleryDrill.

## Edge cases

- **Below the split seam** (`SPLIT_SEAM` container width): nothing changes —
  the pane doesn't render there; collapse/resize state is simply dormant.
- **Persisted width above the clamp** (from a future clamp change): re-clamped
  on read.
- **Collapsed + user opens a category from the rule strip's edit chip:** the
  strip's `onEditFilter` seeds the drill editor — that action auto-expands the
  pane (you cannot edit a value in a pane that isn't there).
- **`showAllPane` / idle catalog:** collapse applies to the whole left column
  regardless of which zone is showing; the reopen pill label stays "Filters".

## Verification

Per `visual-verification-mandatory.md`: screenshots at 1920/2560/3840 + 1440,
covering (a) default open at new leaner width, (b) dragged wide, (c) collapsed
with reopen pill, (d) collapse→expand round trip with no layout shift in the
results header. Plus `npm run check` before commit.

## Out of scope

- Phone bottom sheet (`GalleryFilterSheet`) — untouched; its fate is the
  existing phone-sheet-feel decision.
- Persistent-desktop-catalog (non-split) rail widths — untouched.
