# Admin Toolbar Declutter — Design

**Date:** 2026-06-29
**Status:** Approved (brainstorm)
**Author:** Austen + Claude

## Problem

The admin debug toolbar (F9 top bar / mobile bottom sheet, admin-only) has
accreted controls over time. An audit (2026-06-29) found 13 inline desktop
actions, two of which are dead no-ops and one redundant:

| Control | Status | Why |
|---|---|---|
| Reset Help Discovery | **DEAD** | `HelpButtonDiscovery.svelte` was deleted in the 2026-06-27 create-header declutter. No listener for the `helpDiscoveryReset` event remains; the button is a pure no-op. |
| Reset Intro | **DEAD** | `TabIntro.svelte` is orphaned (was mounted only in the removed "fuse" module). Nothing reads `tabIntroSeen:*` localStorage keys, so clearing one does nothing observable. |
| Clear Thumbnail Cache | **REDUNDANT** | Clears only the local thumbnail cache, which is a strict subset of what "Clear Cloud Thumbnails" already does (`AdminToolbar.svelte:239` calls `getThumbnailLocalCache().clear()` + invalidates the orchestrator). |

Everything else verified ALIVE: role override (security-validated gating),
user-preview/impersonation, Preview First Run, Preview Tutorial, PWA Banner,
and the three remaining cache clears (Cloud Thumbnails, Pictograph, TIKA).

## Decision (locked)

Scope = **Dead + consolidate** (chosen over "Dead only" and "Aggressive"):

1. Remove the two dead buttons and the redundant cache button (with all their
   handlers, state, and prop threading).
2. Fold the three surviving cache clears into a single permanent **Caches ▾**
   dropdown, reusing the existing dropdown markup/styles (renamed from the old
   responsive "Debug" fallback).
3. Keep role chips, user search, and the three onboarding preview buttons
   inline.

Not in scope: deleting the orphaned `TabIntro.svelte` / `tab-intro-content.ts`
files (that was the rejected "Aggressive" option) and the duplicate "Admin"
shield text.

## Design

### Desktop — `AdminToolbarDesktop.svelte`

Inline, left→right: branding · 4 role chips · divider · quick-access user chips ·
search · spacer · **Preview First Run** · **Preview Tutorial** · **PWA Banner** ·
**Caches ▾** · close.

- **Caches ▾** is a permanent dropdown (both normal and preview modes) holding
  the three surviving cache actions. It reuses the existing `.actions-menu` /
  `.actions-dropdown` markup and styles; the trigger relabels "Debug" → "Caches"
  (icon `fa-wrench` → `fa-database`).
- **Delete the measure-strip auto-fit machinery** (`measureEl`, `toolbarEl`,
  `useInline`, the `$effect` + `checkFit`, the `.measure-strip` block, and the
  `.actions-menu.hidden` rule). It existed solely to juggle 9 inline actions
  between an inline row and a dropdown fallback. With three short preview buttons
  plus one dropdown, it is dead weight.
- The three preview buttons render inline unconditionally (no `{#if useInline}`).
- **Narrow desktop (768–900px):** preview buttons and the Caches trigger go
  icon-only, by hiding their text `<span>` in the existing `@media (max-width:
  900px)` block (the same block already hides `.chip-name` / `.branding-text`).
  This is the simplest no-overflow handling and matches existing chip behavior.

### Mobile — `AdminToolbarMobile.svelte`

The action grid stays. Remove three cards: **Reset Tab Intro**, **Reset Help
Discovery**, **Clear Thumbnail Cache**. Six cards remain (First Run Wizard,
Create Tutorial, PWA Banner, Clear Cloud Thumbnails, Clear Pictograph Cache,
Clear TIKA Cache). No dropdown — the grid already handles density.

### Orchestrator — `AdminToolbar.svelte`

Remove:
- Handlers `resetTabIntro`, `resetHelpButtonDiscovery`, `clearThumbnailLocalCache`.
- State flag `isClearingThumbnailCache`.
- `getTabIntroContent` import; `navigationState` import; `currentModule`,
  `currentTab`, `currentIntro`, `canResetIntro` derived values (now unused once
  the tab-intro reset is gone).
- Prop threading to both children for the removed actions: `canResetIntro`,
  `currentIntroTitle`, `onResetTabIntro`, `onResetHelpDiscovery`,
  `onClearThumbnailCache`, `isClearingThumbnailCache`.

Keep all live wiring untouched: impersonation, role override, the three live
previews, the three live cache clears.

## Net effect

- Desktop bar: 13 actions → 3 inline previews + 1 Caches dropdown.
- Mobile sheet: 9 cards → 6.
- ~40 lines of dead responsive measuring machinery removed.

## Verification

- `npm run check` clean.
- Desktop (F9): bar shows 4 role chips, search, 3 preview buttons, a Caches ▾
  dropdown (3 items), close. No Reset Intro / Reset Help Discovery / Clear
  Thumbnail Cache. Screenshot.
- Caches ▾ opens and the 3 clears still fire (toast confirms).
- Narrow desktop ~800px: previews + Caches go icon-only, no overflow. Screenshot.
- Mobile sheet: 6 action cards, no removed ones. Screenshot.

## Related

- Audit source: this conversation (2026-06-29).
- `2026-06-27-create-header-declutter-design.md` — where HelpButtonDiscovery died.
- `feedback_design_system_mandatory`, `.claude/rules/no-layout-shift.md`,
  `clickables-look-like-buttons.md`, `chip-primitives.md`.
