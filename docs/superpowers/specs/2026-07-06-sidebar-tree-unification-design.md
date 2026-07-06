# Sidebar Rail↔Overlay Tree Unification — Design

Date: 2026-07-06
Status: Approved (implementing)
Area: `src/lib/shared/navigation/components/desktop-sidebar/`

## Problem

The desktop hover-expand sidebar has shipped a run of "jump/snap" bugs, each a
seam between two separate DOM trees:

- **Bug 2 — module jump-down.** In the expanded overlay you can peek a second
  module's tabs (multi-expand, persisted in `expandedModules`). The rail only
  renders tabs for the *active* module. So a peeked module's tabs exist in one
  tree and not the other → the two trees are different heights → modules below
  jump on the rail↔overlay swap.
- **Bug 3 — tab-inset snap.** Expanded tabs are inset right (`SectionButton`,
  signals hierarchy — kept, it's liked). Rail tabs are icon-only centered under
  the module (`CollapsedTabButton`). These are **different elements in different
  trees**, so on the swap the tab position *mounts/unmounts* rather than moving —
  the inset snaps. CSS cannot transition between two different elements.

Root cause of both: `DesktopNavigationSidebar.svelte` renders the module list as
`{#if !visuallyExpanded} <activity-bar rail> {:else} <ModuleGroup expanded> {/if}`.
Module *icons* were already aligned across the seam (fixed 44px icon column pins
them to x=32 in both trees — prior parity work). Tabs were never unified.

## Decision

Unify the module list into **one tree** that morphs between rail and expanded.
Render `ModuleGroup` for every main module always, driven by
`isCollapsed={!visuallyExpanded}`. Same elements persist across the state change,
so geometry transitions. Every cross-tree parity hack (matching heights,
margins, paddings between activity-bar and ModuleGroup) becomes unnecessary and
is deleted — one tree can't disagree with itself.

Settings nav (`{#if isInSettings}` branch, its own rail/expanded split) is **out
of scope** — not in the bug report. It keeps `CollapsedTabButton`.

## Coordinate model (why it lands where it should)

Content inner-left = 8px (`.navigation-content` padding). `.module-group` inner
padding 2px → module-group inner-left = 10px. Icons live in a fixed **44px
leading column**, so icon center = 10 + 22 = **x=32** (matches the module icon —
"directly under" in rail).

The tab inset is the one intentional horizontal motion. Put it on the tab
container as a transitioning `padding-left`:

| | Collapsed (rail) | Expanded (overlay) |
|---|---|---|
| tab container `padding-left` | `0` → icon center **x=32** | `8px` → icon center **x=40** (inset 8) |
| tab label | `opacity:0`, flex yields 0 width | `opacity:1`, fills row |
| tab button width | ~44px (icon fills it → reads centered) | 100% of growing content |

`padding-left` and label `opacity` transition (`--duration-emphasis`), so on
expand the tab icon **slides** 32→40 and the label **fades in**; collapse
reverses. The button width grows with the sidebar's own width animation (content
width tracks the nav — no fixed-width pin, which previously caused the flex
cross-axis spring).

## Target architecture

`SectionButton.svelte` — restructure to the `ModuleButton` skeleton: fixed 44px
leading icon-wrapper (keeps `NotificationBadge` positioning) + label. New
`isCollapsed` prop:
- Collapsed: button is narrow (icon fills the 44px column, reads centered), label
  `opacity:0` + no width, active styling matches the old rail
  `CollapsedTabButton` (bg + inset ring).
- Expanded: full-width row, label visible, existing active glow / hover
  `translateX` / gradient icon preserved.
- Geometry snaps, visuals + `transform` transition (same discipline as
  `ModuleButton` — no `transition: all`).

`SectionsList.svelte` — new `isCollapsed` prop:
- Collapsed: render a **flat** icon list (Lab `groups` flatten — group headers
  with labels don't fit 64px). Container `padding-left: 0`.
- Expanded: render as today (flat or grouped). Container `padding-left: 8px`.
- Transition `padding-left` between the two. Pass `isCollapsed` to each
  `SectionButton`. Keep `transition:slide` for module open/close (independent of
  the rail morph).

`ModuleGroup.svelte` — render `SectionsList` in **both** modes (drop the
`!isCollapsed` gate on the section render). Pass `isCollapsed` through. Collapsed
`.module-group` styling replaces the rail's `.module-context-group` (active-glass
container). One element now, so no cross-tree height matching.

`DesktopNavigationSidebar.svelte` — replace the `{#if !visuallyExpanded}` module
fork with a single `{#each mainModules}` of `ModuleGroup`, passing
`isCollapsed={!visuallyExpanded}` and `isExpanded={expandedModules.has(id)}`.
Delete `.activity-bar`, `.module-context-group`, `.nested-tabs` CSS and the
tree-swap in/out `slide` on `.modules-content` (nothing swaps now). Keep the
settings branch. `handleModuleTap`/`handleSectionTap` logic unchanged (behavior,
not rendering).

`CollapsedModuleButton.svelte` — unused after this → remove.
`CollapsedTabButton.svelte` — still used by the settings rail → keep.

## Behavior notes / edge cases

- **Multi-expand now mirrors into the rail.** Rail shows tabs for every
  `expandedModules` member, not just active. This is the bug-2 fix; rail becomes
  a faithful mini-map. If the user collapsed the active module's tabs in the
  overlay, the rail now also hides them (previously rail force-showed active
  tabs) — more consistent, acceptable.
- **Lab groups** flatten to a plain icon list in rail; full grouped list in
  expanded.
- **Badges** (`NotificationBadge`) stay in the icon-wrapper → work in both modes.
- **Celebrate** (tutorial reveal) animation preserved in expanded.
- **Reduced-motion** collapses all transitions to snap, as today.
- **Module label** keeps its existing `{#if !isCollapsed}` + fade-in mount (not
  in the bug report; masked by the width animation).

## Risk

Central render path with many tuned states. Sequence the implementation so the
dev server (`:5173` HMR) shows each step; verify icon x-position stability and
the tab slide with a runtime measurement before claiming done.
