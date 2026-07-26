---
status: active
value: 3
effort: L
remaining: "Body status: Awaiting review"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Hover-Expand Overlay Rail Sidebar — Design

**Date:** 2026-07-05
**Status:** Awaiting review
**Inspiration:** Cloudflare dashboard sidebar (thin rail, hover expands as overlay above content, content never reflows)

## Problem

The desktop sidebar is a push drawer. It is `position: fixed`
(`DesktopNavigationSidebar.svelte`), but content reserves its full current
width via `MainInterface.svelte:403`
(`padding-left: var(--desktop-sidebar-width)`), which swings 220px ↔ 64px on a
manual toggle. Every toggle reflows the entire content area over a 0.3s
transition: text re-wraps, reading position jumps. This is exactly the layout
instability `no-layout-shift.md` bans elsewhere in the app.

The Cloudflare model fixes it: content permanently reserves only the thin rail
(64px). Hovering the rail expands it to 220px **above** content on the z-axis.
Content never moves. Navigation reads as chrome (a layer above the page), not
as a document sibling — which matches its actual role.

## Current State (evidence)

- `src/lib/shared/layout/desktop-sidebar-state.svelte.ts` — `isCollapsed`
  boolean, `width` (64/220) set by `setDesktopSidebarCollapsed()`, persisted to
  localStorage key `tka-desktop-sidebar-collapsed`. Default: expanded (push).
- `src/lib/shared/MainInterface.svelte:263,403` — feeds
  `--desktop-sidebar-width` from `desktopSidebarState.width`; content padding
  tracks it.
- Sidebar renders **two content trees**: collapsed activity bar
  (`CollapsedModuleButton` + `CollapsedTabButton`, VS Code style) vs expanded
  (`ModuleGroup` → `ModuleButton` + `SectionsList`). Trees swap instantly on
  toggle; width animates 280ms (`--duration-emphasis`).
- Consumers of `--desktop-sidebar-width` / `desktopSidebarState.width` (all
  want the **reserved** edge, none want the visual width):
  - `MainInterface.svelte:403` (content padding)
  - `src/app.css:1188,1193` (drawer overlay + left-drawer constrained to
    sidebar edge)
  - `foundation/ui/drawer/Drawer.css:73`
  - `CreatePanelDrawer.svelte:361`, `CustomizeDrawer.svelte:70`
  - `TabIntro.svelte:46`, `BrowseModule.svelte:180` (layout math)
- Z-scale (`app.css:523-533`): `--z-sidebar: 200`, `--z-drawer: 400`. Drawers
  sit above the sidebar and anchor their left edge to the reserved width.
- `hasOpenDrawers()` exists in `foundation/ui/drawer/drawer-stack` (already
  imported by MainInterface).
- `CollapsedModuleButton.svelte:188-210` and `CollapsedTabButton` ship a
  per-icon `.hover-label` flyout tooltip.
- Container queries: `.navigation-content` is `container-type: inline-size`;
  section buttons size fonts in `cqw` — font size varies with sidebar width.
- Reduced motion: component-level blanket rule kills all
  transitions/animations (`DesktopNavigationSidebar.svelte:866`).
- No hover-intent utility exists in the codebase (grep: `hoverIntent`,
  `hover-intent`, `hoverDelay`, `pointerenter` — all hits unrelated).

## Decisions (brainstorm log — resolved from codebase per full-autonomy grant)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Pin semantics | **True hybrid.** Pinned = reserved 220 push (today's expanded). Unpinned rail = reserved 64 + hover overlay. | `isCollapsed` already models it; permanent overlay would cover content's left 156px |
| 2 | Triggers | Hover (120ms intent) + `focus-within` + click-pin. Gate: `(hover: hover) and (pointer: fine)` | NN/G: hover-only nav fails touch/keyboard |
| 3 | Default | Rail mode for new users (no stored value → collapsed). Stored prefs respected | The rail is the feature; Cloudflare defaults to rail |
| 4 | Scrim | None. Elevation shadow only | Content must stay readable — that is the pattern's point |
| 5 | Open drawer | Suppress hover-expand while `hasOpenDrawers()` | Drawer (z 400) > sidebar (z 200) anchored at reserved edge; expanding underneath looks broken |
| 6 | Per-icon hover tooltips | Remove `.hover-label` from collapsed buttons | Redundant: overlay shows real labels 120ms later; both firing together is noise |
| 7 | Module tap behavior while hover-expanded | Key off **visual** state, not `isCollapsed` | User sees expanded UI → expects expanded behavior (inline section expansion) |

## Approaches Considered

1. **CSS-only** (`:hover` width + `transition-delay` as intent). Rejected:
   cannot swap content trees, no hold-open guards (context menu, account
   popover), no drawer suppression.
2. **State-driven overlay reusing both existing trees** — **CHOSEN.** Minimal
   diff, zero consumer changes, full guard control.
3. **Unified single-tree refactor** (one tree, labels reveal; Cloudflare-exact
   internals). Deferred follow-up, only if approach 2's icon alignment shows a
   visible jump. Rewrites 5 components; not justified until proven necessary.

## Design

### State model

`desktop-sidebar-state.svelte.ts`:

- `width` is re-documented as **reserved layout width** (64 rail / 220
  pinned). Setter logic unchanged. All existing consumers are automatically
  correct under the new semantics — **zero changes outside the sidebar
  component tree.**
- Default flips: no stored value → `collapsed = true` (rail). Stored
  `"false"` (user previously chose expanded) → pinned push, exactly as today.
- `hoverExpanded` lives **inside** `DesktopNavigationSidebar.svelte` as
  component state. No external consumer needs it; keep the public state
  surface unchanged.

Derived visual state in the component:

```
visuallyExpanded = !isCollapsed || hoverExpanded
```

- Content tree selection: `visuallyExpanded` picks the expanded tree
  (ModuleGroup list); otherwise activity bar. (Today this keys off
  `isCollapsed` — swap the condition.)
- Nav width: `visuallyExpanded ? 220px : 64px` via a `.visually-expanded`
  class. The `collapsed` class on `<nav>` follows `!visuallyExpanded`.
- `handleModuleTap`'s `isCollapsed` branch uses `!visuallyExpanded` instead.

### Hover-intent controller

New: `src/lib/shared/navigation/services/hover-intent.ts` (~30 lines — pure
timer logic, no runes, so plain `.ts`).

Justification gate (`never-hand-roll.md`): grep found no internal
hover-intent/openDelay utility (terms: `hoverIntent`, `hover-intent`,
`hoverDelay`, `pointerenter` — unrelated hits only). No external micro-lib
justified for two timers with cancel + guard hooks.

Factory: `createHoverIntent({ openDelay: 120, closeDelay: 300, onOpen, onClose })`
returning `{ pointerEnter(), pointerLeave(), cancel(), openNow(), closeNow() }`.
Pure timer logic, no DOM — unit-testable with fake timers.

Wiring in `DesktopNavigationSidebar.svelte`:

- `onpointerenter` → if hover-capable && `isCollapsed` && `!hasOpenDrawers()`
  → `pointerEnter()` (opens after 120ms).
- `onpointerleave` → `pointerLeave()` (closes after 300ms grace) **unless**
  hold-open guard active.
- Hold-open guards (block close, re-arm when cleared): context menu open
  (`contextMenuState.mode !== "closed"`), account popover open
  (`accountPopoverOpen`), focus inside nav.
- `onfocusin` → `openNow()` (keyboard users get no delay);
  `onfocusout` (focus left nav entirely) → `closeNow()` unless pointer still
  inside.
- `Escape` keydown while hover-expanded → `closeNow()`.
- Hover capability detected once via
  `window.matchMedia("(hover: hover) and (pointer: fine)")` (listen for
  changes — convertible laptops).
- Pinning (`isCollapsed` → false) or unpinning cancels all timers and clears
  `hoverExpanded`.

### Layout & stacking

- Content reserves the rail permanently: no change needed anywhere —
  `desktopSidebarState.width` already reads 64 while collapsed, and
  hover-expansion never touches it. `MainInterface.svelte` is untouched.
- Sidebar stays `position: fixed; z-index: var(--z-sidebar)` (200). Above
  content, below dropdowns/drawers/modals — correct: drawers suppress
  hover-expand (Decision 5), so the sidebar never needs to fight them.
- Overlay elevation: while `hoverExpanded` (not pinned), apply
  `box-shadow: var(--theme-shadow-strong, 0 12px 40px rgba(0,0,0,0.45))` and a
  slightly stronger right border. Shadow transitions in/out with the width.

### Motion & geometry (the feel)

- Width 64→220 animates on the existing
  `transition: width var(--duration-emphasis, 280ms) var(--ease-out)` — no
  new curve.
- **Icon anchoring (load-bearing):** the expanded tree's module-icon column
  must center at x=32px from the sidebar's left edge — the same center as the
  rail's icons (44px buttons centered in the 64px rail). Achieve with a fixed
  icon-column width in `ModuleButton` rows and matched horizontal padding.
  Result: on tree swap, icons hold perfectly still; labels bloom rightward.
  This is what makes the Cloudflare version feel continuous.
- **No mid-animation reflow:** while `visuallyExpanded`, pin the inner
  `.navigation-content` to a fixed 220px width (outer `<nav>` clips via
  existing `overflow: hidden`). This makes the expansion a *reveal*, not a
  reflow — and fixes a latent bug: the `cqw`-based label fonts would
  otherwise scale during the width animation.
- Labels: `white-space: nowrap`; reuse the existing `label-fade-in` staggered
  animation (Google Calendar style, already in the component).
- `prefers-reduced-motion`: existing blanket rule already snaps all of this.
  Intent delays remain (they are behavior, not animation).

### Header / pin affordance

`SidebarHeader.svelte` (the brand button is already the toggle):

- Pinned (expanded, reserved 220): unchanged — "TKA Composer" + chevron-left
  on hover. Click → unpin to rail.
- Hover-expanded (overlay): "TKA Composer" + **pin icon** (`fa-thumbtack`)
  instead of chevron. Click → pin: `setDesktopSidebarCollapsed(false)` +
  persist. Content animates over via the existing padding transition.
- Rail (not hovered): unchanged "TKA" mark.
- `aria-label` follows state: "Pin sidebar open" / "Collapse sidebar to rail".

### Cleanup (in scope)

- Delete `.hover-label` flyouts from `CollapsedModuleButton.svelte` and
  `CollapsedTabButton.svelte` (Decision 6). `aria-label`s remain for AT.
- Delete the dead `isTransitioningFromCollapsed` state
  (`DesktopNavigationSidebar.svelte:111` — declared, never set true) and its
  prop threading through `ModuleGroup.svelte:118`.

### Touch / small viewports

Untouched. Sidebar only renders ≥1280px side-by-side desktop
(`shouldShowDesktopSidebar`). Touch devices in that range fail the hover
media gate and keep today's rail-tap behavior; `MobileNavigation` path is
separate.

## Edge Cases

| Case | Behavior |
|---|---|
| Pointer crosses rail en route elsewhere | 120ms intent delay — no expansion |
| Pointer leaves briefly (overshoot) | 300ms close grace re-entered without collapse |
| Drawer open | Hover-expand suppressed; rail stays interactive |
| Context menu / account popover open | Overlay holds open until closed |
| Keyboard Tab into rail | Expands immediately (no delay); Escape or focus-out collapses |
| Convertible switches to touch mid-session | matchMedia change listener disables hover path |
| Click module while hover-expanded | Expanded-mode behavior: navigate + inline section expansion |
| Reduced motion | Expansion snaps (existing rule); delays retained |
| Museum/full-screen modules | Already force-hide the sidebar (`forcedHidden`) — unaffected |

## Testing & Verification

1. **Unit** (vitest, fake timers): `createHoverIntent` — open fires after
   openDelay; leave-before-open cancels; close fires after closeDelay;
   re-enter cancels close; `openNow`/`closeNow`/`cancel`.
2. **Manual via Chrome DevTools MCP** (read-only unless permission given):
   - Hover rail → expands above content; **content area does not move**
     (assert `getBoundingClientRect()` of a content landmark before/during).
   - Font size of labels stable during animation (no cqw scaling).
   - Icon x-positions identical pre/post tree swap.
   - Drawer open → no hover-expand.
   - Tab into rail expands; Escape collapses.
   - Pin persists across reload.
3. **Gate:** one full `npm run check` before commit (per
   `fast-iteration-loop.md`).

No new component-tests beyond the pure-logic unit test
(`component-test-discipline.md` — grow on fix, not on feature).

## Out of Scope / Follow-ups

- Unified single-tree refactor (approach 3) — only if icon alignment proves
  insufficient in practice.
- The inline `view-transition-name: sidebar` vs CSS `view-transition-name:
  none` contradiction in `DesktopNavigationSidebar.svelte` (lines 342/573) —
  pre-existing, unrelated.
- Any mobile navigation changes.

## Files Changed (summary)

| File | Change |
|---|---|
| `src/lib/shared/layout/desktop-sidebar-state.svelte.ts` | width = reserved (docs), default → rail |
| `src/lib/shared/navigation/services/hover-intent.ts` | **new** (~30 lines, justified above) |
| `src/lib/shared/navigation/components/DesktopNavigationSidebar.svelte` | visual-state rendering, intent wiring, guards, shadow, inner-width pin, dead-state cleanup |
| `src/lib/shared/navigation/components/desktop-sidebar/SidebarHeader.svelte` | pin affordance |
| `src/lib/shared/navigation/components/desktop-sidebar/ModuleButton.svelte` | icon-column alignment to x=32px center |
| `src/lib/shared/navigation/components/desktop-sidebar/CollapsedModuleButton.svelte` | remove `.hover-label` |
| `src/lib/shared/navigation/components/desktop-sidebar/CollapsedTabButton.svelte` | remove `.hover-label` |
| `src/lib/shared/navigation/components/desktop-sidebar/ModuleGroup.svelte` | drop dead `isTransitioningFromCollapsed` prop |
| `src/lib/shared/navigation/services/hover-intent.test.ts` | **new** unit test |

`MainInterface.svelte`, `app.css`, all drawer CSS: **untouched.**
