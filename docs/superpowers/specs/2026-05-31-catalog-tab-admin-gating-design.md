# Gate the Choreo Card Module to Admin — Design

**Date:** 2026-05-31
**Status:** Approved (brainstorming complete, pending user spec review)

## Goal

Make the entire **Choreo Card** module admin-only. The Deck Releaser becomes the
operator's home for catalog/deck work; the redundant consumer-facing Catalogs
browse is gone for consumers by virtue of the whole module being gated. Catalog
DATA is untouched — the Releaser composes from it.

## Why

The user-facing Catalogs browse tab is redundant now that the Deck Releaser
composes algorithmically from the same catalog data. The browse UI's only unique
job — eyeballing the full enumeration to verify a newly seeded deck — is
**rare / dev-only**, so it does not earn consumer surface but should stay
reachable for admins. The Releaser composes + releases physical decks to
Firestore, which is an operator action, not an end-user one. The Card Designer,
Scan Activity, and Theme Lab tabs in this module are likewise operator/dev
surfaces. Decision: **gate the whole module**, not individual tabs.

## Context (verified)

- Module def: `choreo_card` in
  `src/lib/shared/navigation/config/module-definitions.ts:210` — currently has
  **no** `adminOnly` flag (so it's consumer-visible). `sections: CHOREO_CARD_TABS`.
- Tabs: `catalogs`, `designer`, `scan-activity`, `theme-lab`, `releaser`
  (`tab-definitions.ts:656`), rendered via `ChoreoCardTab.svelte` `mode` switch.
- `adminOnly?: boolean` exists on the module/section type
  (`navigation/domain/types.ts:83`).
- **Enforcement already exists and is honored** at
  `src/lib/shared/navigation-coordinator/navigation-coordinator.svelte.ts:494`:
  the module list filter drops any `module.adminOnly` when
  `featureFlagService.effectiveRole !== "admin"` ("defense in depth … enforce
  adminOnly directly from the module definition"). Three modules already use it:
  `moderation` (`module-definitions.ts:253`), `admin` (`:266`), and one more
  (`:366`). This is the proven pattern.
- Catalog DATA lives in Firestore `catalogs/` and is read by `deck-composer.ts`
  (`buildSequencePool`/`composeDeck`/`getTnDFamilyOptions`). Not touched.

## The change

### 1. Module flag

Add `adminOnly: true` to the `choreo_card` module definition
(`module-definitions.ts`, the object opened at line 210). The coordinator filter
(`:494`) then hides the module from every nav surface for non-admins, exactly as
it already does for `moderation`/`admin`.

```ts
{
  id: "choreo_card",
  // …existing fields…
  sections: CHOREO_CARD_TABS,
  adminOnly: true,   // ← added
},
```

This drives every nav surface via the coordinator filter (`:494`). No tab-level
flags, no tab-filter machinery, no default-tab retarget, no
`ChoreoCardTab.svelte` change, no `CatalogBrowser` change, no Releaser change.
(The path-init guard below is the second and final change.)

## Second change required (direct-URL guard — gap confirmed)

The nav filter (`:494`) hides the module from every nav *surface*, but direct
URL navigation to `/choreo_card` bypasses it. Verified:

- `parsePathNavigation()`
  (`navigation-coordinator.svelte.ts:553`) resolves the path segment against the
  **unfiltered** `MODULE_DEFINITIONS` (`:591`) — no `adminOnly` / role check.
- `initializeNavigationHistory()` (`:648`) then calls
  `navigationState.setCurrentModule(pathNav.moduleId, …)` (`:671`) with no access
  check (it special-cases only heavyweight 3D modules `museum`/`archive`).

So a non-admin hitting `/choreo_card` directly **would** mount the module. The
one-line module flag is necessary but not sufficient.

**Fix:** add an `adminOnly` guard at the path-init seam, mirroring the proven
`:494` pattern and the init-timing guard already used by `handleSectionChange`
(`:387`, which skips the gate until `featureFlagService.isInitialized`). When the
parsed module is `adminOnly` and `featureFlagService.effectiveRole !== "admin"`
(only enforced once flags are initialized), redirect to the default consumer
module (`create`) instead of setting the gated module — exactly the existing
heavyweight-module redirect shape at `:665-667`.

Exact placement (inside `parsePathNavigation` returning null for a gated module,
vs. inside `initializeNavigationHistory` before `setCurrentModule`) is a
plan-level detail; the invariant is: a non-admin direct-URL hit on an `adminOnly`
module lands on a consumer module, and admins are unaffected.

This is the full scope: (1) module `adminOnly: true`, (2) path-init guard. No
other files change.

## Out of scope

- Catalog DATA / the `catalogs/` Firestore collection.
- Any change to Releaser compose/release behavior, `CatalogBrowser`, or the
  individual choreo tabs.
- The broader deck → print → QR → payment business flow (separate question).

## Testing / verification

- **Non-admin session:** Choreo Card module is absent from the module switcher,
  desktop sidebar, mobile bottom nav, and overflow. Direct URL `/choreo_card`
  does not render the module (redirects to a consumer module).
- **Admin session** (`austencloud@gmail.com`): Choreo Card visible with all five
  tabs; Catalogs opens `CatalogBrowser` and loads from `catalogs/` as before;
  Deck Releaser composes/releases unchanged.
- `npm run check` clean for touched files.

## Risk

Low. An additive flag plus a small guard at one path-init seam, both mirroring
patterns already in the file (`:494`, `:387`, `:665`). No data, no deletion, no
Releaser logic touched.
