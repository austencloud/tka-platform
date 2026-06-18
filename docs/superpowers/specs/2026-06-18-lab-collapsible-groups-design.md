# Lab Collapsible Groups — Design

**Date:** 2026-06-18
**Status:** Approved (brainstorm), implementing
**Context:** Lab triage reduced the module to 17 tabs. A flat 17-item list in the
desktop sidebar is hard to scan. User picked the collapsible-group option (C)
after comparing three variants live at `/test/lab-nav-compare`.

## Goal

Group the Lab module's tabs into labeled, collapsible sections in the desktop
sidebar. One Lab module (no split into multiple modules), expand/collapse per
group, selection always visible.

## Non-goals

- No change to routing or `activeTab` semantics — grouping is render-only.
- No change to any other module (Create/Browse/Learn/etc. stay flat).
- Mobile (`SideNavigation`) stays flat for now (groups are a desktop affordance).

## Groups (17 tabs → 5)

| Group | Tabs |
|---|---|
| Notation | pictograph-explorer, vtg, trigrid, path-mandalas |
| Choreography | duration, effects, composition, phrase-effort |
| 3D / Physical | spatial-lab, collision-lab, village |
| Output | stickers, pov-pattern |
| Presentation | themes, landing, prop-buttons, voice |

Any LAB_TAB without a `groupId` falls through to an ungrouped tail (safety net).

## Data model (backwards-compatible)

`navigation/domain/types.ts`:
- New `SectionGroup` interface: `{ id, labelKey, label, icon, color }`.
- `Section` gains optional `groupId?: string`.
- `ModuleDefinition` gains optional `groups?: SectionGroup[]`.

`navigation/config/tab-definitions.ts`:
- New `LAB_GROUPS: SectionGroup[]` (the 5 above).
- Each of the 17 LAB_TABS tagged with its `groupId`.

`navigation/config/module-definitions.ts`:
- Lab module definition gains `groups: LAB_GROUPS`.

## Render

`SectionsList.svelte` gains an optional `groups?: SectionGroup[]` prop:
- **Absent** → flat list, exactly as today (every other module).
- **Present** → for each group: a disclosure header (chevron + icon + label +
  count badge) followed by its sections inside a slide region. Sections keep
  using the real `SectionButton`.

`ModuleGroup.svelte` passes `groups={module.groups}` through to `SectionsList`.
`DesktopNavigationSidebar.svelte` needs no change (ModuleGroup owns the pass-through).

## Expansion state

- Persisted in `localStorage` under `lab-nav-expanded` as `{ [groupId]: boolean }`.
- The group containing the active tab is **force-open** regardless of stored
  state, so the current selection is never hidden.
- First visit / no stored value: active tab's group open, the rest collapsed.
- Toggling a header writes through to `localStorage`.
- SSR-safe: guard `localStorage` access; default collapsed-except-active on the
  server, hydrate stored state on the client.

## i18n

5 group label keys in `messages/en.json` following the existing tab-key pattern:
`tab_group_lab_notation`, `tab_group_lab_choreography`, `tab_group_lab_physical`,
`tab_group_lab_output`, `tab_group_lab_presentation`. Run `npm run i18n:types`
to regenerate `TranslationKey`.

## Accessibility / layout

- Disclosure is a `<button>` with `aria-expanded`; chevron rotates.
- Count badge uses `font-variant-numeric: tabular-nums` (no width jitter).
- Slide transition gated by `prefers-reduced-motion` (inherited pattern).

## Files touched

`types.ts`, `tab-definitions.ts`, `module-definitions.ts`, `SectionsList.svelte`,
`ModuleGroup.svelte`, `messages/en.json` (+ regenerated `i18n-types.ts`).
Throwaway `src/routes/test/lab-nav-compare/+page.svelte` deleted after sign-off.

## Verification

- `npm run check` green.
- Real Lab sidebar renders grouped, collapse/expand works, active tab's group
  force-opens, state survives reload.
