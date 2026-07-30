---
status: archived
value: 3
effort: M
remaining: ""
depends_on: ""
plan_path: ""
tags: [creators, navigation, social]
superseded_by: src/lib/features/creators/CreatorsModule.svelte
last_triaged: 2026-07-29
---

# Move Creators from Browse to Social

**Date:** 2026-07-08
**Status:** Superseded 2026-07-25
**Related:** `2026-07-08-collections-ia-mine-joint-others-design.md`

> **ARCHIVED 2026-07-29.** Commit `2a940bd17e` promotes Creators to its own
> top-level module. Both intermediate routes from this design redirect to
> `/creators`, so implementing this Social-tab placement would restore an
> intentionally retired information architecture.

Creators now has its own tabless module at `/creators`. Both routes introduced
by this design, `/browse/creators/*` and `/social/creators/*`, redirect to the
new canonical path. Social returns to Community and Connect only.

## Goal

Relocate the Creators tab (creator discovery + profiles) from the **Browse**
module to the **Social** module, where it sits beside Community and Connect.
Browse becomes pure content discovery (Gallery | Library | Collections); Social
becomes people (Community | Connect | Creators). Existing shared/bookmarked
`/browse/creators/[userId]` profile links must keep working via redirect.

## Why

Browse = content discovery (sequences, collections). Creators is people
discovery — the same category as Social's Community/Connect. The tab is
mis-filed. This is an IA correction, no new capability.

## Current coupling (the actual work)

`SocialModule.svelte` is a clean lazy tab-loader (`tabComponents[id] → dynamic
import`), so *hosting* CreatorsPanel there is one line. The cost is that
Creators' routing does NOT live in the panel — it lives in **`BrowseModule.svelte`**:
- imports `CreatorsPanel`, `UserProfilePanel`, `creatorsViewState`;
- `$effect`s that push a profile view to history (`browseNavigationState`,
  `{ tab: "creators", view: "profile", contextId: userId }`), restore it, reset
  on tab-leave, and listen for browser back/forward (BrowseModule ~lines
  235-520);
- boot-time refresh-to-profile from the `/browse/creators/[userId]` URL
  (BrowseModule ~410).

Moving Creators cleanly requires making the **panel self-contained**: it owns its
own list↔profile state and its own URL/history sync, so any host (previously
Browse, now Social) just mounts it. BrowseModule then sheds all creators glue.

## Architecture

### 1. Tab config
- `tab-definitions.ts`: remove the `creators` entry from `BROWSE_TABS`; add an
  equivalent `creators` entry to `SOCIAL_TABS` (after `community`/`connect` or
  wherever reads best). Same `labelKey`/icon; reuse the existing
  `tab_browse_creators` label text or add a `tab_social_creators` key (prefer a
  new `tab_social_creators`/`tab_desc_social_creators` in `messages/en.json`;
  the `tab_community_creators` key already exists and may be reused).

### 2. Social hosts the panel
- `SocialModule.svelte` `tabComponents`: add
  `creators: () => import("$lib/features/browse/creators/components/CreatorsPanel.svelte")`.
  (The panel stays in `features/browse/creators/` — no file move needed; only its
  host changes. Optional future cleanup: relocate the folder to `features/social/`.)

### 3. Panel self-containment
- Move the creators list↔profile routing out of `BrowseModule` and into
  `CreatorsPanel` (or a small `creators-routing.svelte.ts` helper the panel owns):
  render `UserProfilePanel` when `creatorsViewState` is on a profile; push/replace
  history via the nav coordinator under module id **`social`** (not `browse`);
  restore the profile from the URL on mount; handle back/forward. Preserve the
  existing `creatorsViewState` API (viewUserProfile / reset / currentView /
  viewingUserId) — only its *host* and *module id* change.
- `BrowseModule.svelte`: delete the creators imports, `BrowseModuleType`
  `"creators"`, its `TAB_ORDER` slot, the nav→tab mapping branch, the profile
  push/restore/back-forward `$effect`s, and the boot URL parse for
  `/browse/creators`. Browse's tab union collapses to
  `gallery | collections | discover | hall-of-shame`.
- `browse-navigation-state.svelte.ts`: drop `"creators"` from `BrowseTab` if no
  longer referenced (grep first; leave if other consumers exist).

### 4. URL + redirect
- New canonical profile URL: `/social/creators/[userId]` (module `social`,
  section `creators`, contextId userId — the coordinator already carries a third
  path segment as contextId for `/browse/creators/{userId}`, so `/social/...`
  works the same way once creators is a social section).
- Redirect legacy links in `navigation-coordinator.svelte.ts`
  `parsePathNavigation` (the existing legacy-redirect block ~613, where
  `library → browse` already lives): when `moduleId === "browse" && parts[1] ===
  "creators"`, rewrite to `moduleId = "social"` and keep section `creators` +
  the `[userId]` contextId segment. So `/browse/creators/42` resolves to Social ›
  Creators › profile 42.

## Data Flow

`/social/creators/42` (or redirected `/browse/creators/42`) → coordinator parses
module `social`, section `creators`, contextId `42` → SocialModule lazy-loads
CreatorsPanel → panel reads contextId, opens profile 42 → back returns to the
creators list; forward/refresh restore the profile. Follows/messages unchanged.

## Testing

- Unit/static: `SOCIAL_TABS` contains `creators`; `BROWSE_TABS` does not;
  `parsePathNavigation("/browse/creators/42")` → `{ moduleId: "social", sectionId:
  "creators", contextId/deeper: "42" }` (test at whatever granularity the parser
  exposes).
- Runtime acceptance (browser): Creators appears under Social, not Browse; opening
  a profile deep-links to `/social/creators/[id]`; refresh on that URL restores the
  profile; browser back returns to the list; an old `/browse/creators/[id]` link
  redirects and lands on the profile.

## Risks

- **Profile deep-links + back/forward are load-bearing** (shareable, used by real
  users). The migration must preserve them — this is the acceptance bar, not a
  nice-to-have. Verify all four: open, refresh-restore, back, legacy-redirect.
- **`creatorsViewState` host coupling.** It is currently driven from BrowseModule;
  ensure exactly one host drives it after the move (Social), or a stale Browse
  effect could fight it. Grep every `creatorsViewState` consumer before deleting.
- **Folder stays under `features/browse/creators/`.** Acceptable (import path only);
  a physical move is optional and out of scope to limit churn.
