# Catalog Browse → Admin-Only, Releaser as Operator Home — Design

**Date:** 2026-05-31
**Status:** Approved (brainstorming complete, ready for implementation plan)

## Goal

Make the **Deck Releaser** the operator's single home for catalog/deck work.
Retire the redundant consumer-facing **Catalogs** browse tab by gating it to
admin. Keep the catalog browse reachable for the rare verify-after-seed pass
(admin only). Catalog DATA is untouched — the Releaser composes from it.

## Context

The Choreo Card module (`src/lib/features/choreo-card/`) has five tabs, wired in
`CHOREO_CARD_TABS` (`src/lib/shared/navigation/config/tab-definitions.ts:656`)
and rendered through `ChoreoCardTab.svelte` (`mode` switch):

| Tab id | Component | Role |
|---|---|---|
| `catalogs` | `CatalogBrowser.svelte` | Browse the full enumerated dataset (every sequence per family/position). Operator/QA surface. |
| `designer` | `CardDesigner.svelte` | Design custom choreo cards. Consumer. |
| `scan-activity` | `ScanActivityTab.svelte` | Live feed of card scans worldwide. Consumer. |
| `theme-lab` | `CardBackThemeLab.svelte` | Compare card-back theme variations side by side. Dev/design tool. |
| `releaser` | `DeckReleaserTab.svelte` | Compose + release physical decks to Firestore. Operator. |

**Key architectural fact:** "Catalog" means two distinct things.
- **Catalog DATA** — Firestore `catalogs/` collection (enumerated source pools).
  `deck-composer.ts` reads it (`buildSequencePool`, `composeDeck`,
  `getTnDFamilyOptions`). Load-bearing infra for the Releaser. **Not touched.**
- **Catalog BROWSE UI** — the `catalogs` tab / `CatalogBrowser.svelte`. A
  user-facing window into the raw dataset. **This is what gets gated.**

The browse UI's only unique job (the Releaser does not do it) is eyeballing the
full enumeration to verify correctness after seeding a new deck (the deck skill's
"anti motions must flip in→out" check). Decided value of that job going forward:
**rare / dev-only** — so it does not earn a consumer tab, but is not deleted.

## Decisions

1. **Audience split.**
   - Consumer choreo tabs: **Scan Activity** (primary), **Card Designer** (kept
     for now; may be dropped later).
   - Operator/admin choreo tabs: **Catalogs**, **Deck Releaser**, **Theme Lab**.
   - **Admin sees everything** (all five tabs).

2. **No deletion, no new view.** `CatalogBrowser.svelte` and its ~20
   sub-components stay exactly as-is, reached via the now-admin-only Catalogs
   tab. No new "enumeration view" is built inside the Releaser (YAGNI — verify is
   rare/dev-only). The Releaser is unchanged (it reads catalog DATA directly).

## Changes

### 1. Gate three tabs

In `CHOREO_CARD_TABS` (`tab-definitions.ts`), add `adminOnly: true` to the
`catalogs`, `releaser`, and `theme-lab` Section entries. (`adminOnly?: boolean`
already exists on the `Section` type — `domain/types.ts:83`.)

### 2. Wire tab-level `adminOnly` (currently a no-op)

Tab-level `adminOnly` is typed but **not honored** anywhere — only *module*-level
`adminOnly` is filtered (`ModuleList.svelte:51`:
`MODULE_DEFINITIONS.filter((m) => !m.adminOnly || showAdmin)` with
`showAdmin = $derived(isCurrentUserAdmin())`).

Apply the identical pattern at the **tab-render seam** so every renderer honors
it consistently. The reactive admin signal is `isCurrentUserAdmin()` from
`$lib/shared/auth/admin` (already proven reactive inside `$derived` in
`ModuleList.svelte`).

Tab renderers to cover (each filters its sections list with
`!tab.adminOnly || showAdmin`):
- `SectionsList.svelte` (desktop sidebar)
- `BottomNavigation.svelte` (mobile)
- `MobileNavigation.svelte`
- `TabOverflowSelector.svelte`

(Exact file/line set to be confirmed during planning by grepping consumers of
the per-module sections list; the single invariant is: no renderer shows an
`adminOnly` tab to a non-admin.)

### 3. Consumer default landing tab → Scan Activity

`ChoreoCardTab.svelte` initializes `mode = $state<ChoreoCardMode>("catalogs")`
and syncs from `navigationState.activeTab`. With `catalogs` now admin-gated, a
consumer must not default into a hidden tab.

- Consumer default resolves to **`scan-activity`**.
- Admins land/navigate normally (they can still see and select any tab).
- The default must come from the **filtered** (admin-aware) tab set, not a
  hardcoded `"catalogs"`. Planning will confirm whether the default is driven by
  the module's first *visible* tab or an explicit default constant (cf.
  `DEFAULT_CREATE_TAB`), and set the consumer default to `scan-activity`
  accordingly.

## Out of scope

- No changes to catalog DATA or the `catalogs/` Firestore collection.
- No new enumeration view inside the Releaser.
- No `CatalogBrowser` refactor.
- No change to the Deck Releaser's compose/release behavior.
- The broader deck → print → QR → payment business flow (separate question;
  being documented separately, not part of this change).

## Testing / verification

- Non-admin session: Choreo Card module shows only **Scan Activity** + **Card
  Designer**; default lands on **Scan Activity**. Catalogs / Releaser / Theme Lab
  are absent from every nav surface (desktop sidebar, mobile bottom nav,
  overflow).
- Admin session (`austencloud@gmail.com`): all five tabs visible; Catalogs opens
  `CatalogBrowser` and loads catalogs from `catalogs/` as before.
- Deck Releaser still composes/releases (admin) — unchanged.
- `npm run check` clean for touched files.

## Risk

Low. Additive gating + a default retarget. No data, no deletion, no Releaser
logic touched. Worst case (filter misapplied) is a tab wrongly shown/hidden —
caught immediately in the verification session.
