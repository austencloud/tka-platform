# Pulse — Ambient User-Activity Awareness

**Date:** 2026-07-09
**Status:** Approved (Austen delegated design 2026-07-09: "take over the whole design phase")
**Problem owner:** Austen

## Problem

Austen discovered via manual PostHog forensics that 78 accounts exist, ~1,700
anonymous visitors hit the site in 90 days, QR scans cluster in cities he's
never heard of — and he had no idea any of it was happening. Two systems were
supposed to tell him and both failed silently:

1. **Signup notifications** — `admin-notifier.ts` runs client-side in the *new
   user's* browser and writes to `users/{admin}/notifications`. Firestore rules
   (`firestore.rules:263-267`) require `isOwner || isAdmin` for that write. A
   brand-new non-admin user is neither → write denied → swallowed by
   try/catch → **zero signup notifications ever delivered** despite a fully
   working FCM pipeline (verified: Austen has 16 FCM tokens and receives
   `feedback-resolved` pushes fine; zero `admin-new-user-signup` docs exist).
2. **Scan activity** — scans write Firestore (`shortcodes/{code}/scanEvents`)
   and PostHog, but the only surface is a pull-only admin map tab. No push, no
   ambient signal.

ADHD constraint: any channel Austen must remember to open will fail. The
channel that works is the one that comes to him (phone push), backed by a
glanceable in-app dashboard for the full picture.

## Design

One system, two organs: **Pulse alerts** (push) and the **Pulse dashboard**
(admin tab).

### Part 1 — Pulse alerts (cloud functions → existing FCM pipeline)

All event detection moves server-side. Cloud functions use the Admin SDK
(bypasses the security rule that killed the client path) to write notification
docs to each admin's `users/{uid}/notifications`. The existing
`onNewNotification` function then delivers FCM push. No new push infra.

**New module `firebase-functions/src/pulse/`:**

- `notifyAdmins.ts` — shared helper. Queries admins (`isAdmin == true` OR
  `role == "admin"`), skips the admin who caused the event (no self-noise),
  respects each admin's `notificationPreferences[prefKey]` **before writing the
  doc** (muted type = no inbox spam either), writes the notification doc.
- `pulseTriggers.ts` — four v2 trigger exports:

| Function | Trigger | Signals |
|---|---|---|
| `pulseUserActivity` | `onDocumentWritten("users/{userId}")` | (a) doc created with `isAnonymous:false` → signup; (b) `isAnonymous` flips true→false → guest upgrade; (c) `lastActivityDate` changes → returning user, throttled 6h/user via `pulseState/{uid}` doc, skipped for admins/guests/accounts <6h old |
| `pulseScanActivity` | `onDocumentCreated("shortcodes/{code}/scanEvents/{id}")` | QR scan; enriched with geo (city, country) from the event + word from parent shortcode doc. Works for fully anonymous scanners |
| `pulseSequenceCreated` | `onDocumentCreated("users/{userId}/sequences/{id}")` | "{name} saved {word}"; admin owners skipped |
| `pulseCollectionCreated` | `onDocumentCreated("users/{userId}/collections/{id}")` | collection created; `system_favorites` and admin owners skipped |

**Why `lastActivityDate` instead of an RTDB presence trigger:** presence
writes fire on every user interaction — an RTDB trigger would bill thousands of
no-op invocations. `lastActivityDate` is written exactly once per auth refresh
(session start) by `createOrUpdateUserDocument` — one clean "user opened the
app" signal per session, on a trigger we already need for signups.

**New notification types** (single source `NOTIFICATION_TYPES`):
`admin-qr-scan`, `admin-content-created`, `admin-user-returned` — plus pref
keys `adminQrScan`, `adminContentCreated`, `adminUserReturned` in
`NotificationPreferences`, `getPreferenceKeyForType`, `NOTIFICATION_TYPE_CONFIG`
(client) and `PREF_KEY_MAP` (functions `pushDispatcher.ts`). Signups reuse the
existing `admin-new-user-signup` type and pref.

**Removals:** the dead client path — `admin-notifier.ts` and its call sites in
`user-document-manager.ts` and `anonymous-upgrade.ts` (the calls have never
succeeded; rules correctly deny them).

### Part 2 — Pulse dashboard (admin tab)

New `pulse` tab in the existing admin module (tab registry + AdminDashboard
switch — no new module). Data flows through the existing
`/api/admin/analytics` HogQL proxy (admin-gated, rate-limited, PostHog key
stays server-side), extended with **global** query types alongside the
existing per-user ones:

| Query type | Returns |
|---|---|
| `pulse-overview` | visitors / signups / scans / saves for today, 7d, 30d |
| `pulse-breakdown` | ranked country, city, referrer, device splits (30d) |
| `pulse-feed` | last N events (pageview sessions, signups, scans, saves) with geo + device |
| `pulse-live` | distinct visitors in the last 5 minutes |

All global queries exclude dev noise (`$host` LIKE localhost%, dev.tkaflowarts.com)
and Austen's own UIDs (server-side constant).

**UI panels** (`src/lib/features/admin/components/pulse/`):

1. **Hero strip** — today / 7d / 30d counters. `tabular-nums`, reserved widths
   (no-layout-shift rule).
2. **Live now** — active identified users via existing presence tracker +
   anon count from `pulse-live`.
3. **Where & how** — ranked lists: countries, cities, referrers, devices.
4. **Activity feed** — merged recent events, identified names resolved via
   Firestore, newest first.
5. **Alert switches** — per-Pulse-type mute toggles writing
   `users/{me}.notificationPreferences.*` (button + toggle-indicator pattern,
   no checkboxes).

Polling every 60s, paused on `visibilitychange`. No map in v1 (ranked lists
carry the payload; `GlobalUserMap` already exists for presence pins).

## Verification plan

- Unit: notification model additions (types/prefs stay in sync via existing
  derived zod enum).
- Functions: build clean (`tsc`), deploy the four functions, then write a
  synthetic `scanEvents` doc via Admin SDK → assert a notification doc appears
  in Austen's subcollection (end-to-end proof through the real trigger) →
  clean up the synthetic docs.
- App: `npm run check` green; dashboard verified against live PostHog data.

## Deferred (explicitly out of scope)

- **tka.run edge tracking** — short-code hits redirect before PostHog boots;
  real scan volume is undercounted. Needs an edge-side counter (CF Worker).
- **Signup conversion mechanics** — nudge toast / feature gating for anonymous
  users (project #2 from the 2026-07-09 brainstorm; separate spec).
- **`collectionCount` denormalization fix** — counter never increments
  (12 real collections exist, all owners show 0). Separate bug, known.
- **Weekly digest** — rollup push/email summary.
- **Dashboard map panel** — pins for anon visitors (PostHog has lat/lng).
