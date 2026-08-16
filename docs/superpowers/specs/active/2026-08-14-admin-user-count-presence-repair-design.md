# Admin User Counts and Multi-Connection Presence

**Date:** 2026-08-14  
**Status:** Approved for implementation  
**Surface:** Admin module, User Management

## Observed failure

A production read-only audit found two different count boundaries:

| Source                     | Registered | Anonymous | Total |
| -------------------------- | ---------: | --------: | ----: |
| Firebase Auth              |         66 |        52 |   118 |
| Firestore `users` profiles |         63 |        20 |    83 |

Quick Stats reads non-anonymous Firestore profiles, so its Total Users value is 63. Three registered Auth accounts have no `users/{uid}` profile. The existing
30-day reconciliation job intentionally excludes those older accounts.

Presence had a separate false-negative failure. Austen Cloud and
Handsome_banana wrote activity within 90 seconds of the audit, but their shared
`presence/{uid}` records said `online: false`. `computeActivityStatus` therefore
reported both as inactive.

## Cause

Every browser tab and device writes the same `presence/{uid}` record. Each
connection also registers an `onDisconnect` write against that shared record.
When one tab disconnects, it marks every other tab for that user offline. A
remaining tab refreshes `lastActivity` and `activityStatus`, but does not restore
`online`, which creates the exact production state observed.

Firebase's documented presence pattern stores every connection separately and
considers a user offline only when no connection children remain:

<https://firebase.google.com/docs/database/web/offline-capabilities#section-presence>

## Ownership decision

- **Extend** `PresenceTracker`, the existing owner of app-wide RTDB presence.
- **Create** a pure presence aggregation module beside the domain models. It
  converts legacy flat records and the new connection records into the existing
  `UserPresenceWithId` view model.
- **Extend** `SystemStateManager`, the existing cached admin data hub, with an
  admin-only Firebase Auth/profile summary.
- **Compose** the new summary into `WeeklyEngagement`; no second admin user
  cache or parallel presence implementation is introduced.

Search terms used to establish ownership: `presence`, `online`,
`activityStatus`, `Total Users`, `SystemStateManager`, `listUsers`, and
`onDisconnect`.

## Presence model

New clients write:

```text
presence/{uid}/schemaVersion = 2
presence/{uid}/lastSeen = <server timestamp>
presence/{uid}/connections/{connectionId} = <UserPresence>
```

Each tab owns one pushed `connectionId`. On RTDB disconnect, only that child is
removed and the user-level `lastSeen` timestamp advances. The tracker listens to
`/.info/connected`, so a network reconnect creates a new connection child.

Aggregation rules:

1. Any connection with activity under five minutes makes the user active.
2. The most recently active connection supplies module, tab, device, session,
   identity, and location fields.
3. A user with connection children but no recent activity is inactive but still
   connected.
4. A version-two node with no connections is offline and uses its user-level
   `lastSeen` value.
5. Legacy flat records remain readable during rollout. A fresh legacy record
   whose stored status is `active` counts as active even when another tab has
   incorrectly written `online: false`. A genuine legacy disconnect writes
   stored status `offline`, so it stays inactive.

The deployed RTDB rule already grants an authenticated user write access below
their own `presence/{uid}` node, so the nested connection path needs no new
permission.

## Account summary

An admin-only GET endpoint lists Firebase Auth users and reads Firestore profile
markers. It returns aggregate counts only:

- total, registered, and anonymous Auth accounts;
- total, registered, and anonymous profiles;
- registered Auth accounts missing a profile.

`SystemStateManager` fetches this summary beside its existing Firestore reads.
If the privileged count is unavailable, Quick Stats says that it is showing
profile counts instead of silently presenting the fallback as an Auth total.

Quick Stats uses registered Auth accounts for Total Users. The detail under the
number states how many profiles exist and how many are missing. Weekly activity
and new-user metrics remain profile-backed because those dates live on the
profile documents.

The three old profile gaps are reported, not automatically repaired. Creating
profiles changes production identity data and needs a separate review of those
accounts.

## Failure handling

- Presence remains non-blocking. A failed connection registration logs one
  actionable warning and retries on the next RTDB reconnect.
- The account-summary endpoint requires a live admin claim, uses the admin rate
  limit, returns no account PII, and records an audit event.
- A summary failure leaves the rest of User Management usable and displays the
  fallback boundary under Total Users.

## Verification gates

1. Pure aggregation tests cover two tabs, one-tab disconnect, idle connections,
   no-connection last-seen data, and the legacy false-offline regression.
2. Endpoint tests cover authorization, rate limiting, Auth pagination, anonymous
   classification, and missing-profile counts.
3. Focused TypeScript/Svelte checks pass for every touched source file.
4. A read-only RTDB query proves active users remain active when another
   connection disappears.
5. The admin page visually shows the Auth total, profile boundary, and live
   active count at required viewports.

## Expected files

- `src/lib/shared/presence/domain/models/presence-models.ts`
- `src/lib/shared/presence/domain/presence-aggregation.ts`
- `src/lib/shared/presence/services/presence-tracker.ts`
- `src/routes/api/admin/user-summary/+server.ts`
- `src/lib/features/admin/services/types.ts`
- `src/lib/features/admin/services/system-state-manager.ts`
- `src/lib/features/admin/components/analytics/WeeklyEngagement.svelte`
- focused unit tests under `tests/unit/`
