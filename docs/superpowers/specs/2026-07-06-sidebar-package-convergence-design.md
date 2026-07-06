# Sidebar Package Convergence — Design

**Date:** 2026-07-06
**Status:** Approved (design); pending implementation plan
**Author:** Austen Cloud + Claude
**Scope:** Converge the TKA desktop sidebar and the cirque-aflame sidebar onto a single shared package, `@austencloud/sidebar`, upgraded to carry the live TKA hover-expand overlay polish. Both apps become thin wrappers.

---

## 1. Background & problem

The TKA desktop navigation sidebar is a hover-expand overlay rail: a 64px icon
rail that content reserves; it floats out to ~220px as an **overlay** on hover
(no content reflow); a pin/lock button keeps it open (rail → pinned push
layout). It carries a stack of polish shipped over recent sessions: hover-intent
open/close timers, a brand wordmark that doubles as a home link with a
"TKA"→"TKA Composer" slide+reveal, a single no-layout-shift morphing
module/section tree, an account row that morphs circle↔row, and a window
`pointermove` backstop that heals a stuck-open overlay.

The intent was "extract this to a package so cirque-aflame can reuse the
architecture instead of hand-rolling it again." Reconnaissance inverted that
framing:

- **`@austencloud/sidebar@0.1.0` already exists** in `E:\shared-packages`
  (pnpm workspace, Changesets publishing to npm under `@austencloud`).
- **cirque-aflame (the `ringmaster` app) already consumes it** through a thin
  `DesktopSidebar.svelte` wrapper that supplies `header`/`footer`/`renderIcon`
  snippets plus Firebase auth and nav data. The DI seam works in production.
- **TKA never migrated.** TKA's sidebar is bespoke and is the *only* place the
  polish lives.
- The **package is an older, simpler generation**: a classic push-collapse
  sidebar with a VS Code-style activity-bar collapsed mode. It has had **zero
  code commits since the 2026-03-19 bulk monorepo import** (only repo-wide
  tooling commits since). It lacks every signature polish feature: no
  hover-expand overlay, no pin, no brand-home link, no hover-intent, no
  no-layout-shift morph, no account row, no stuck-open backstop.

Two structural gaps between the live TKA sidebar and the package:

1. **Interaction model.** TKA = hover-expand floating overlay (rail/hover/pinned
   tri-state). Package/cirque = push-collapse (content reflows on collapse).
2. **Token vocabulary.** Package uses its own `--sidebar-*` namespace (bridges
   only 4 vars to `--theme-*`). TKA consumes `--theme-*`, `--duration-*`,
   `--ease-out`, `--min-touch-target`, `--z-sidebar`, `--semantic-*` directly.

## 2. Decisions (locked)

- **Full convergence.** Upgrade `@austencloud/sidebar` with the live TKA polish
  and migrate **both** TKA and cirque-aflame onto it as thin wrappers.
- **Unify on hover-expand overlay.** The package's canonical interaction becomes
  the floating rail + pin. cirque switches from push-collapse. No dual-mode prop.
- **Build strategy: rebuild the package FROM the live TKA components**
  (Approach 1). Treat the polished TKA sidebar as source of truth; move its
  shell, single-morphing-tree, hover-intent, brand, and account into the
  package, generalizing the coupled bits (i18n/haptics/auth/flags) into the DI
  seam the package already has. Discard the package's stale push-collapse tree.
  Rationale: the live TKA code is newest and is the approved design; the
  package's tree is 4 months stale and carries the pre-unification shift design;
  both apps migrate anyway, so nothing needs v0's tree preserved.

### Three judgment calls (approved)

- **A — Brand seam:** structured `brandLead`/`brandRest` props so the *package*
  owns the "TKA"→"TKA Composer" slide+reveal (both apps get it free); a `brand`
  snippet is the full-override escape hatch (cirque's gradient "CA" badge uses
  it). Rejected: snippet-only brand (each app re-hand-rolls the reveal).
- **B — Settings sub-nav (TKA-only):** host swaps the `modules` set to the
  settings tabs when in settings and renders the back button via a `beforeTree`
  slot. Package stays generic. Rejected: a settings mode baked into the package.
- **C — Version:** breaking API (`collapsed`→`pinned`, interaction change) →
  honest **`1.0.0`** major bump via Changesets, not a 0.1.x patch.

## 3. Package public API (the seam)

Extends the existing v0 DI seam. `<Sidebar>` props:

```ts
// Data
modules: ModuleDefinition[];
currentModule: string; currentSection: string;

// Navigation
onModuleChange?(id: string, targetSection?: string): void | Promise<void>;
onSectionChange?(sectionId: string): void;
onModuleContextMenu?(id: string, e: MouseEvent): void;   // host renders its own menu (TKA admin)
onSectionContextMenu?(id: string, sectionId: string, e: MouseEvent): void;
onModuleHover?(id: string): void;                        // prefetch hint

// Interaction — hover-expand overlay is THE model
pinned = $bindable(false);              // persisted rail<->pinned (renames v0 `collapsed`)
pinStorageKey?: string | null;
railWidth = 64; expandedWidth = 220;    // reserved-width contract (px)
hoverIntent = { openDelay: 50, closeDelay: 300 };
disableHoverExpand = false;             // touch / no-hover -> click-to-pin only

// DI adapters (kept from v0)
onHaptic?(): void;
translateLabel?(id: string): string;
translateSectionLabel?(id: string, sectionId: string, fallback: string): string;
filterSection?(id: string, sectionId: string): boolean;  // access/feature-flag predicate
getBadgeCount?(id: string, sectionId?: string): number;

// Chrome — structured props get the SHARED polish; snippet = escape hatch
homeHref?: string | null;                    // brand doubles as home link when set
brandLead?: Snippet | string;                // always-visible mark: "TKA" / a "CA" badge
brandRest?: Snippet | string;                // revealed suffix: " Composer" / "Ringmaster"
brand?: Snippet<[expanded: boolean]>;        // overrides the wordmark/home content only (NOT the pin)

// Slots
renderIcon?: Snippet<[name: string, size: number]>;
beforeTree?: Snippet<[expanded: boolean]>;   // host-injected above tree (TKA settings back-button)
account?: Snippet<[expanded: boolean]>;      // host drops <SidebarAccount> here
footer?: Snippet<[expanded: boolean]>;       // host actions
class?: string;
```

Kept from v0 unchanged: `modules`, `currentModule`, `currentSection`,
`onModuleChange`, `onSectionChange`, `onHaptic`, `translateLabel`,
`translateSectionLabel`, `filterSection`, `getBadgeCount`, `onModuleHover`,
`renderIcon`, `class`. Renamed/replaced: `collapsed`(bindable) →
`pinned`(bindable); `collapseStorageKey` → `pinStorageKey`; `collapsible`
dropped (hover-expand is always on unless `disableHoverExpand`). Added: the
interaction, brand, and `beforeTree`/`account` seams above.

## 4. Interaction & state model

The package owns, once, every behavior currently living in the TKA component:

- rail/hover/pinned tri-state; `visuallyExpanded = pinned || hoverExpanded`.
- hover-intent open/close timers (`services/hover-intent.ts`,
  openDelay 50ms / closeDelay 300ms grace).
- `(hover:hover) and (pointer:fine)` capability gate (touch falls back to
  click-to-pin; `disableHoverExpand` forces it).
- the window-`pointermove` **stuck-open backstop** (`reconcilePointerFromMove` +
  a `$effect` that attaches a passive listener only while hover-expanded) and
  the `::view-transition` leave-swallow guard.
- Escape-to-close (unpins/closes the hover overlay).
- reduced-motion: collapses all transitions to 0 (owned by the package; hosts
  never re-implement it).

**Reserved-width contract.** The package sets `--sidebar-reserved-width`
(= `railWidth` when unpinned, `expandedWidth` when pinned) on a stable element,
and optionally calls `onReservedWidthChange?(px)`. Hosts offset their content
with `margin-inline-start: var(--sidebar-reserved-width)`. The hover overlay
floats *above* content — the reserved width does **not** change on hover, so no
content reflow occurs during hover-expand. Pin state persists to `pinStorageKey`.

## 5. Component tree (inside the package)

Rebuilt from live TKA:

- `src/Sidebar.svelte` — orchestrator: hover-intent, reserved width, pin state,
  the module/section tree, brand + slots.
- `src/sidebar/SidebarBrand.svelte` — the slide-reveal wordmark (0fr→1fr grid
  column reveal on `brandRest`, `brandLead` never fades), home link (`homeHref`),
  and the pin/lock button (thumbtack ↔ chevron). Internal, prop-driven. The
  `brand` snippet overrides **only** the wordmark/home content; the pin button is
  always package-owned and rendered beside the brand slot, so a full-override
  brand (cirque's "CA" badge) keeps the pin. The pin's absolute placement + the
  brand's reserved right-gutter (so the wordmark can't slide under the pin) live
  here too.
- `src/sidebar/{ModuleGroup, ModuleButton, SectionsList, SectionButton}.svelte`
  — the **single morphing tree** from live TKA (no-layout-shift; fixed 44px
  icon-column x-anchor across the width morph). **Deletes** v0's
  `CollapsedModuleButton` / `CollapsedTabButton` mode-swap.
- `src/services/hover-intent.ts` — ported as-is (zero-dependency timer
  controller).
- `src/sidebar/pin-state.ts` — localStorage read/write (adapted from v0
  `collapse-state.ts`).

Exported primitives (separately importable so hosts share the polish without
forced chrome):

- `src/SidebarAccount.svelte` — the circle↔row **shape morph** (border-radius
  eased `calc(min-touch-target/2)`↔12px, 44px avatar-col left-anchor, guest
  fallback). Props: an `avatar` snippet (host renders its own RobustAvatar /
  photoURL), `displayName`, `isAuthenticated`, `onClick`. Auth and avatar stay
  in the host.
- `src/NotificationBadge.svelte` — already portable; lift as-is.

Public barrel `src/index.ts` re-exports: `Sidebar` (default of
`Sidebar.svelte`), `SidebarAccount`, `NotificationBadge`, `createHoverIntent`,
`readPinState`/`writePinState`, and `type` exports (`ModuleDefinition`,
`Section`, `SectionGroup`, `SidebarProps`). A generic `NavItem`-style type set
without TKA's `ModuleId` union / `TranslationKey` label typing (v0's `types.ts`
already generalized this).

## 6. Token contract

Reconcile onto the richer TKA-style vocabulary that both apps' `@austencloud/theme`
already feeds. The package consumes:

`--theme-{panel-bg, stroke, stroke-strong, accent, accent-strong, text,
text-dim, card-bg, card-hover-bg, shadow}`, `--semantic-{error, info, success}`,
`--duration-{instant, fast, normal, emphasis}`, `--ease-out`,
`--min-touch-target`, `--font-size-{compact, sm, base, lg, xl}`, `--z-sidebar`;
plus inline per-item `--module-color`/`--section-color`/`--section-gradient`
set from data.

Ship `css/sidebar-tokens.css` giving sane defaults for all of them, and put an
**inline fallback on every `var()`** in component CSS (the live TKA pattern) so a
bare consumer still renders and animates correctly. Both apps provide `--theme-*`
via `@austencloud/theme`; cirque lacks `--duration-*` (it uses `--transition-*`)
— the inline fallbacks cover it, and cirque may add the four duration tokens for
exact parity. Drops v0's parallel `--sidebar-*` namespace.

## 7. TKA migration (`DesktopNavigationSidebar.svelte` → thin wrapper)

Host supplies everything domain-specific through the seam:

- `modules` from `MODULE_DEFINITIONS` / navigation-state; `currentModule` /
  `currentSection` as today; `onModuleChange` / `onSectionChange` = existing
  handlers.
- `translateLabel` / `translateSectionLabel` = `t()` + `getReactiveLocale()`
  adapter; `onHaptic` = `getHapticFeedback().trigger("selection")` adapter;
  `filterSection` = access adapter (`resolveAccessTier`, `isTabAccessible`,
  `featureFlagService.canAccessTab`); `getBadgeCount` = inbox adapter;
  `renderIcon` = TKA icon renderer.
- `homeHref="/"`, `brandLead="TKA"`, `brandRest=" Composer"`.
- `account` snippet → `<SidebarAccount>` with `RobustAvatar` + `authState` +
  the guest → `authDrawerState.show("signup")` path.
- `footer` snippet → the TKA footer actions (inbox + badge, voice mic, prop
  switcher, support, network status) — stays host-rendered.
- Admin right-click → `onModuleContextMenu` / `onSectionContextMenu` → host
  renders `SidebarContextMenu` (all PostHog/feature-flag plumbing stays in the
  host).
- Settings sub-nav (judgment call B): when in settings, the host passes the
  settings-tab set as `modules` and renders the back button via `beforeTree`.

State: TKA's `desktop-sidebar-state.svelte.ts` reserved-width/collapsed logic is
largely superseded by the package's pin state + reserved-width contract;
`MainInterface.svelte` reads `--sidebar-reserved-width` for its content offset.
`AccountPopover.svelte`, `SidebarContextMenu.svelte`, `SidebarFooter.svelte`,
`navigation-state.svelte.ts`, and `config/*` remain host-owned (TKA payload).

## 8. cirque-aflame migration (`ringmaster/.../DesktopSidebar.svelte`)

- Switch push-collapse → overlay: drop the chevron-toggle + `collapsed` reflow;
  adopt `pinned` + hover-expand.
- Brand via the `brand` override snippet (gradient "CA" badge + "Ringmaster"),
  `homeHref="/"`.
- `account` snippet → `<SidebarAccount>` with cirque's `RobustAvatar` +
  `authState` + `signOut()`.
- `+layout.svelte`: content offset `margin-left: var(--sidebar-width)` →
  `var(--sidebar-reserved-width)`; drop the collapse-driven width swap.
- `MobileNavigation.svelte` is untouched (a separate bespoke bottom-sheet).

## 9. Dev / publish / verification

- **Dev loop:** both apps point at `file:../shared-packages/packages/sidebar`
  (local `svelte-package` build) until green, so we iterate without publishing.
- **Publish:** Changesets **major** bump to `1.0.0` (breaking: `collapsed`→
  `pinned`, interaction model). `pnpm --filter @austencloud/sidebar build`,
  `pnpm check:publish` (publint) + `pnpm check:types` (are-the-types-wrong),
  `changeset version`, `changeset publish`. Then
  `pnpm add @austencloud/sidebar@^1.0.0` in both apps, swapping off the `file:`
  link.
- **Verification:**
  - Static contract test in TKA (mirrors `sequence-viewer-shell-contract.test.ts`):
    assert the wrapper renders the package `<Sidebar>` and forks no chrome
    (no local re-implementation of the tree/brand/account).
  - Visual parity check of the migrated TKA sidebar against the current polish
    (this session's fixes): hover-expand float, pin, brand slide-reveal, account
    morph, footer no-shift, stuck-open heal. Driven via DevTools/screenshots
    (with permission) or handed to Austen.
  - cirque UX re-verified on the new overlay interaction.
- **Git:** three separate repos (`tka-platform`, `cirque-aflame`,
  `shared-packages`). Commit each independently, scoped to only our own files
  (explicit pathspec, never a bare `git commit`). No branches (work on main per
  global rules).

## 10. Sequencing (de-risks the heavy TKA cutover)

1. **Upgrade the package** — port shell/tree/hover-intent/brand/account behind
   the seam; reconcile tokens; delete v0's push-collapse tree. Build locally.
2. **Migrate TKA** to the thin wrapper — the highest-risk step; verify parity
   against the current polish before moving on.
3. **Migrate cirque** to the new version + overlay — verify its UX.
4. **Publish** via Changesets; point both apps at `^1.0.0`.

## 11. Out of scope

- cirque's `MobileNavigation.svelte` (separate bespoke component).
- TKA's `AccountPopover`, `SidebarContextMenu`, `SidebarFooter` bodies,
  `navigation-state`, and `config/*` — these stay host-owned (TKA payload behind
  the seam), not absorbed into the package.
- Any new sidebar feature not already present in the live TKA sidebar. This is a
  convergence, not a feature expansion.
