# Prominent Practice Entry Button — Design

**Date:** 2026-06-29
**Status:** Approved (brainstorm), pre-implementation
**Tier:** Practice Rehaul (T2) — discoverability polish

## Goal

Make entering practice mode obvious on both desktop and mobile. Today the entry
point is hard to find: an unlabeled icon on desktop, buried in a menu on mobile.

## Problem (current state)

| Surface | Practice entry today | Problem |
|---|---|---|
| Desktop header (`RouteViewerHeader`, drawer inline header) | icon-only `header-action-btn practice` (`fa-signal`), gated `{#if !isMobile}` | Unlabeled mystery icon, lost among heart / save / remix / motion / overflow |
| Mobile | item inside the `⋮` overflow popover (`ViewerOverflowMenu` "Practice Mode") | Effectively undiscoverable — two taps into a menu |
| Side-by-side view (`ViewerSplitPane`) | none | No spare controls strip; desktop = two 50/50 panes, mobile = full canvas/card/transport 3-row grid |

## Decision

A single **labeled, accent-colored chrome button** that shows on both platforms,
pulled out of the overflow. (In-view CTA and first-time nudge were considered and
rejected — in-view fights the clean panes + mobile's full grid; nudge is YAGNI for
a size/clarity problem.)

## Behavior

1. **Labeled accent button (desktop + mobile).** Replace the icon-only practice
   button with `[▤ Practice]` — `fa-signal` icon **+** "Practice" label,
   accent-colored (`--theme-accent`, the primary-action color — distinct from the
   semantic heart=red / save=green / remix=amber so it reads as *the* CTA). Reuses
   the existing `.header-action-btn` base with a new accent modifier; **no new
   component** (`never-hand-roll`, `primitive-discovery`). 44px min target
   (`feedback_design_system_mandatory`).

2. **Show on mobile.** Remove the `{#if !isMobile}` gate so the labeled button
   renders in the mobile header-right next to `⋮`. Layout: `[←] title [▤ Practice][⋮]`.
   The title truncates as it already does; the pill + `⋮` fit a 360px phone's right
   cell (~150px, leaving ~160px for the title).

3. **De-dup — drop Practice from the `⋮` menu.** Stop passing `onPracticeToggle`
   to `ViewerOverflowMenu`. One obvious entry point, not two
   (`clickables-look-like-buttons` — no redundant weak link).

4. **Active state unchanged.** Entering practice still hides header-right and
   shows the red "Exit Practice" on the left, so the labeled button is the *entry*
   affordance only and always reads "Practice". Bottom-bar setup + its big "Start
   practice" CTA are untouched.

## Files

| File | Change |
|---|---|
| `src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte` | Icon-only → labeled accent button; remove `!isMobile` gate; add `.header-action-btn.practice` accent modifier CSS |
| `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` | Same change to the inline header practice button |
| `src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte` *(or its call sites)* | Stop surfacing the Practice item (callers stop passing `onPracticeToggle`) |

## Out of scope

- Guest QR viewer (`/q/[code]`) — no practice mode there.
- In-view CTA, first-time discoverability nudge.
- Icon swap (keep `fa-signal`; the label now carries meaning).

## Reuse / non-hand-roll

`.header-action-btn` already exists in both headers with semantic color modifiers
(`.favorited`, `.save`, `.remix`, `.practice-active`). The accent entry style is a
sibling modifier on that base — extend, don't fork. Label + icon pattern matches
the existing `.practice-exit` button (which already renders icon + text).
