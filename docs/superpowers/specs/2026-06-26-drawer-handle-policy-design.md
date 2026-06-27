# Drawer Handle Policy — Design

**Date:** 2026-06-26
**Status:** Approved (design), pending implementation plan
**Scope:** `Drawer` primitive + handle CSS + ~7 drawer call sites

## Problem

The app has ~30 drawer/sheet instances built on `Drawer.svelte` (directly or via
`CreatePanelDrawer.svelte`). Whether each shows a drag handle is decided
per-drawer with no governing rule: `showHandle` is set `true`, `false`, or
dynamically across the codebase, and three concrete defects result:

1. **Main sequence viewer has no handle.** `SequenceViewerDrawerHost.svelte`
   renders the viewer as a full-screen bottom drawer (`placement="bottom"`,
   `snapPoints={["100%"]}`) with `showHandle={false}`. It is swipe-dismissible
   but gives no affordance for it.
2. **Sequence Actions hides its handle on desktop.** `SequenceActionsPanel.svelte`
   sets `showHandle={true}` but force-hides it with a `display:none` override
   (`.sequence-actions-panel-container[data-placement="right"].side-by-side-layout .drawer-handle`)
   because the left-edge vertical handle overlaps the beat-lane labels on short
   panels.
3. **Systemic CSS gap.** The vertical-edge handle rule for right placement is
   gated on `.side-by-side-layout`
   (`.drawer-content[data-placement="right"].side-by-side-layout .drawer-handle`).
   A right drawer that is **not** in side-by-side layout has no matching rule, so
   its handle falls back to the base centered-horizontal-bar style and renders as
   a stray bar floating at the top of a tall side drawer.

Best-practice grounding (researched 2026): the drag handle / grabber is the
affordance for a drag-dismissible sheet (iOS grabber; Material's top drag
region). Full-screen covers do not strictly require one, but a grabber is
appropriate when the cover is swipe-dismissible because it teaches the gesture.
The cursor affordance for these handles was already corrected in a prior change
(`SheetDragHandle.svelte`, base `.drawer-handle`).

## Policy

**A drawer shows a handle iff it is drag-dismissible, and the handle sits on the
edge the drawer is dragged from.** This is encoded as the default behavior of the
`Drawer` primitive, not restated at each call site.

| Placement | Handle position |
|---|---|
| bottom | horizontal bar, top |
| top | horizontal bar, bottom |
| right | vertical bar, left (inner) edge |
| left | vertical bar, right (inner) edge |

Non-dismissible drawers (`dismissible={false}`, e.g. a consent gate) show no
handle — automatically, because the default is derived from `dismissible`.

**Full-screen covers** (a sheet at `snapPoints={["100%"]}` / full viewport, e.g.
the sequence viewer and composition viewer) show **no handle**, even though they
are dismissible. A grabber reads as a draggable *partial* sheet and
miscommunicates the full-screen state — most jarring on desktop, where there is
no swipe-to-dismiss culture. These dismiss via their own close/back control.
Encoded by keeping an explicit `showHandle={false}` on the cover.

## Changes

### 1. `Drawer.svelte` — default handle from dismissibility

Change the `showHandle` prop default from hardcoded `true` to derive from
`dismissible`. Keep the prop so an explicit value still wins:

- Default `showHandle` to `undefined`.
- Compute `const effectiveShowHandle = showHandle ?? dismissible;`
- Render the handle on `{#if effectiveShowHandle}`.

Effect: dismissible drawers keep their handle (no change for the common case); a
`dismissible={false}` drawer drops the handle without needing `showHandle={false}`.

### 2. `drawer/Drawer.css` — fix the right-edge gap + reserve a handle gutter

- **Ungate the right-edge handle.** Apply the vertical-left-edge handle styling to
  every right placement, not only `.side-by-side-layout`. Change the selector
  `.drawer-content[data-placement="right"].side-by-side-layout .drawer-handle`
  → `.drawer-content[data-placement="right"] .drawer-handle`. (The side-by-side
  variant collapses into the general one; verify no other side-by-side-only
  property is lost.)
- **Handle gutter for side panels.** Introduce `--drawer-handle-gutter` (≈28px)
  and inset the scrollable content so the absolutely-positioned edge handle never
  overlaps content:
  - right placement: `.drawer-content[data-placement="right"] .drawer-inner { padding-left: var(--drawer-handle-gutter); }`
  - left placement: `.drawer-content[data-placement="left"] .drawer-inner { padding-right: var(--drawer-handle-gutter); }`
  This replaces the per-panel `display:none` hacks with one systematic reservation.

### 3. `SequenceActionsPanel.svelte` — delete the hide hack

Remove the `:global(...) .drawer-handle { display: none; }` override. With the
gutter reserved (change 2), the left-edge handle no longer collides with the
beat-lane labels, so the reason for hiding it no longer exists.

### 4. Per-drawer application

Apply the policy to the call sites that currently contradict it. Each is verified
against its actual placement/dismissibility during implementation.

| Drawer | Current | Change |
|---|---|---|
| `SequenceViewerDrawerHost.svelte` (main viewer) | `showHandle={false}`, bottom, snap 100% | **Keep `showHandle={false}`** — full-screen cover; a handle miscommunicates the full-screen state (see policy). Dismiss via the viewer's own close/back. |
| `CompositionViewerDrawer.svelte` | `showHandle={false}`, full-screen bottom | **Keep `showHandle={false}`** — same full-screen-cover reasoning. |
| `PresetDrawer.svelte` | `showHandle={false}`, right side panel | Remove `showHandle={false}` → vertical edge handle in the gutter. |
| `SequenceBrowserDrawer.svelte` (loop-labeler) | `showHandle={false}`, right side panel | Remove `showHandle={false}` → vertical edge handle in the gutter. |
| `CustomizeDrawer.svelte` | `showHandle={false}` + manual `<SheetDragHandle>` | Remove both → base `.drawer-handle` renders via default. One handle source. |
| `LOOPDrawer.svelte` | `showHandle={false}` + manual `<SheetDragHandle>` | Same as CustomizeDrawer. |
| `LOOPSelectionPanel.svelte` | `showHandle={false}` + manual `<SheetDragHandle>` | Same as CustomizeDrawer. |
| `LocationSharingConsentSheet.svelte` | non-dismissible gate, `showHandle={false}` | Set `dismissible={false}` → handle drops automatically; remove the redundant `showHandle={false}`. |

Call sites that already match the policy (handle on, dismissible) are left
untouched. The manual-`SheetDragHandle` removals are each confirmed against the
file during implementation — if a panel renders `SheetDragHandle` for a reason
other than the base handle being absent, it is re-evaluated rather than blindly
deleted.

### Additional sites (full implementation grep)

The initial audit undercounted. The full sweep found **15** `showHandle={false}`
and **9** manual `<SheetDragHandle>` usages. The policy was applied to all that
fit it:

- **Plain enable** (partial dismissible sheets, drop `showHandle={false}`):
  GalleryTab letter + options sheets, FilterDesktopDrawers status + priority,
  `SkewLabEditorPanel`, `VersionDetailContent` feedback panel, loop-labeler
  `SequenceBrowserDrawer`.
- **Double-handle consolidation** (base handle + manual `SheetDragHandle` → base
  only): `VideoUploadSheet`, `InviteCollaboratorsSheet`,
  `InviteCollaboratorsPanel`, `SaveToLibraryPanel`, `SaveToLibraryDialog`.
- **Deferred:** `SequenceDrawer.svelte` (unified sequence drawer) keeps
  `showHandle={false}` — it has bespoke nav/chrome and `closeOnBackdrop=false`;
  giving it a handle needs its own visual pass, out of scope here.

## Out of scope

- Snap-point / multi-height resize behavior (handles here are dismiss affordances,
  not resize cyclers).
- The `SheetDragHandle` primitive's own styling (already correct after the cursor
  pass).
- Any drawer whose placement/dismissibility already produces the correct handle.

## Verification

- `npm run check` green (0 errors).
- Handle-visibility matrix confirmed via a test page or Chrome DevTools across
  placements: bottom → top pill; right → left vertical bar in the gutter (no
  content overlap); left → right vertical bar; non-dismissible → no handle.
- The three named cases confirmed: main viewer shows a top handle; Sequence
  Actions shows its left handle without overlapping lane labels; a plain
  (non-side-by-side) right drawer shows a correctly-positioned vertical handle
  instead of the broken horizontal fallback.
- Cursor affordance on the now-visible handles (grab / grabbing) still correct.
