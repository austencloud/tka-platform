# Admin: Separate Anonymous Guests from Signed-Up Users

**Date:** 2026-06-23
**Status:** Design — pending review
**Surface:** Admin module → Users (`UsersDashboard`)

## Problem

The admin User Management view lists Firebase **anonymous** sessions
("Anonymous User" cards) intermixed with real signed-up accounts, and counts
them in Quick Stats. Most are Austen's own repeated guest sessions across
devices, not distinct people. Two defects:

1. **Anonymous sessions pollute the signed-up user list** and inflate Quick
   Stats (`Total Users`, `Active This Week`, `New This Week`) and the Active /
   Inactive tallies.
2. **No way to see genuine live guests.** A real visitor who is online *right
   now* but hasn't created an account is indistinguishable from a stale
   4-day-old device session.

Root cause: both read surfaces query the `users` collection but neither reads
the `isAnonymous` flag that already exists on every user doc
(`user-document-manager.ts:124,166`).

## Goal

- Signed-up list and all Quick Stats counts reflect **real accounts only**
  (`isAnonymous !== true`).
- A separate **Anonymous Activity** section surfaces only anonymous guests who
  are **currently active** (`activityStatus === "active"`, i.e. online and
  interacted within `IDLE_TIMEOUT_MINUTES` = 5 min). Stale/offline anonymous
  sessions appear nowhere.

Non-goals: deleting anonymous user docs, changing guest provisioning, touching
Browse Creators (already excludes guests via `isAnonymous`), PostHog analytics.

## Ground truth (verified)

| Fact | Source |
|---|---|
| `isAnonymous` written on create + every auth refresh | `user-document-manager.ts:124,166` |
| Active list reads `users` docs, ignores `isAnonymous` | `user-activity-tracker.ts:99-106` |
| Quick Stats counts read `systemState.users`, ignore `isAnonymous` | `system-state-manager.ts:111-115`, `WeeklyEngagement.svelte:27-45` |
| "active" = online + interacted < 5 min | `presence-models.ts:9-15,85-95` |
| Admin-view fields (`displayName/email/photoURL`) already optional on `UserPresence` | `presence-models.ts:46-53` |

## Design

Reuse the existing `UserPresenceCard` and `PanelGrid` for the new section — no
new card component. The only new markup is a section wrapper + header in
`ActiveUsersPanel`.

### 1. Plumb `isAnonymous` through the data layer

- **`presence-models.ts`** — add optional admin-view field to `UserPresence`:
  `/** Guest session flag (admin view). */ isAnonymous?: boolean;`
- **`user-activity-tracker.ts`** `subscribeToAllUsers` — read
  `data["isAnonymous"]` into the firestore-user map and carry it onto every
  merged record (both the has-presence and the default/no-presence branches).
- **`types.ts` `CachedUserMetadata`** — add `isAnonymous: boolean;`
- **`system-state-manager.ts` `parseUserDocument`** — set
  `isAnonymous: (data["isAnonymous"] as boolean) ?? false`.

Shared cache stays faithful to Firestore (raw, unfiltered). Filtering happens
at the two consumer surfaces only, so other analytics consumers
(`user-metrics-analyzer`, PostHog) are unaffected.

### 2. `ActiveUsersPanel.svelte` — split the merged list

- `realUsers = $derived(users.filter(u => u.isAnonymous !== true))`
- `liveAnon = $derived(users.filter(u => u.isAnonymous === true && u.activityStatus === "active"))`
- `activeCount` / `inactiveCount` / `totalUsers` and `filteredUsers` derive from
  **`realUsers`** (currently `users`). The status-filter logic is unchanged
  beyond its source array.
- Below the existing grid, render a new **Anonymous Activity** `<section>`,
  shown only when `liveAnon.length > 0`:
  - Header: title `t("admin_anonymous_activity")` + live count badge
    (e.g. `1 online`).
  - One-line subtitle: `t("admin_anonymous_activity_hint")` — explains these are
    un-registered visitors active right now.
  - `PanelGrid` of `UserPresenceCard` over `liveAnon`. Cards open the existing
    `UserDetailModal` (unchanged) — guests are valid detail targets.
  - Zero state: section hidden entirely (no empty box).

### 3. `WeeklyEngagement.svelte` — exclude anon from Quick Stats

- In the `metrics` derived block, operate on
  `users.filter(u => !u.isAnonymous)` for all three tallies. No template change.

### 4. i18n keys (`messages/en.json`)

- `admin_anonymous_activity` → "Anonymous Activity"
- `admin_anonymous_activity_hint` → "Unregistered visitors active right now"
- `admin_anonymous_online` → "{count} online"

## Layout-shift check

Anonymous Activity section mounts/unmounts as guests come and go. It sits
**below** the existing grid and modal, so its appearance pushes nothing
sideways and nothing above it. The live-count badge uses a stable label
(`{n} online`) — wrap the number in `font-variant-numeric: tabular-nums` per
`no-layout-shift.md`. No reserved-space issue since the section is the last
child.

## Testing / verification

- Build + `npm run check` green.
- Runtime proof via admin Users view (DevTools MCP, with permission, or Austen
  confirms): signed-up grid shows no "Anonymous User" cards; Quick Stats drop by
  the anon count; Anonymous Activity section absent when no guest is live, and
  appears with a card when one is.

## Files touched

| File | Change |
|---|---|
| `presence/domain/models/presence-models.ts` | + optional `isAnonymous` field |
| `admin/services/user-activity-tracker.ts` | read + carry `isAnonymous` |
| `admin/services/types.ts` | + `isAnonymous` on `CachedUserMetadata` |
| `admin/services/system-state-manager.ts` | parse `isAnonymous` |
| `admin/components/ActiveUsersPanel.svelte` | split real vs live-anon, new section |
| `admin/components/analytics/WeeklyEngagement.svelte` | exclude anon from counts |
| `messages/en.json` | 3 new keys |
