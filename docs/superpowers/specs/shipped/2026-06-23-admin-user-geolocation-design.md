# Admin: Show Where Logged-In Users Connect From (IP Geolocation)

**Date:** 2026-06-23
**Status:** Design — pending review
**Surface:** Admin module → Users (`ActiveUsersPanel`, `UserPresenceCard`) + new map section

## Problem

Admin can see *who* is signed up and *whether* they are active, but not *where*
they connect from. Austen's actual signal of interest: a visitor in
Germany/Africa (not his own Chicago device sessions) scanning a card or using
the app. Today there is no location on any user/presence record — the only geo
in the system lives on `scanEvents` docs (card scans), not on general logins.

This is the follow-on to `2026-06-23-admin-anonymous-user-separation-design.md`:
that spec separated anonymous guests but could not show *where* they were,
which is the only reason they're interesting.

## Goal

- Capture coarse IP geolocation (city/country + city-center lat/lng) for **every
  logged-in user** (real and anonymous) from Cloudflare edge headers.
- Persist it as **last-known location** on the user doc, so it shows even when
  the user is offline.
- Surface it two ways in admin:
  1. **Cards** — a `City, CC` line on every `UserPresenceCard`.
  2. **Map** — an admin section reusing the community `GlobalUserMap`, plotting
     all users with known coordinates as pins.

Non-goals: street-level precision, browser geolocation prompts, changing the
community opt-in location feature, backfilling location for users who don't log
in again, deleting any data.

## Ground truth (verified)

| Fact | Source |
|---|---|
| CF geo headers `cf-ipcountry/cf-ipcity/cf-iplatitude/cf-iplongitude` read server-side | `src/routes/q/[code]/+page.server.ts:10-15` |
| Cloudflare adapter, SSR on, prerender off | `package.json` (`@sveltejs/adapter-cloudflare`), `src/routes/+layout.ts` (`ssr=true`, `prerender=false`) |
| Root `+layout.server.ts` exists, currently empty | `src/routes/+layout.server.ts:1` |
| Presence written client-side to RTDB `presence/{uid}` via `set`/`update` | `presence-tracker.ts:139,174,227,254,267` |
| `isAnonymous` written on user doc at create + auth refresh (pattern to mirror for `lastLocation`) | `user-document-manager.ts:124,166` |
| User-activity-tracker merges Firestore users + presence; carries fields onto both branches | `user-activity-tracker.ts:99-107,146-176` |
| `GlobalUserMap` accepts a generic pin array `scanMarkers` (`id/lat/lng/label`, optional click) | `community/components/GlobalUserMap.svelte:18-43` |
| Google Maps key is `env.PUBLIC_GOOGLE_MAPS_API_KEY` (`$env/dynamic/public`) | `community/Community.svelte:170,207`, `get-geocoding-service.ts:10` |
| `activityStatus` "active" = online + interacted < 5 min | `presence-models.ts:9-15,85-97` |

## Design

### 1. Capture — `src/routes/+layout.server.ts`

Add a `load` that reads the CF headers and returns a `geo` object (reuse the
exact parse from `q/[code]/+page.server.ts`):

```ts
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ request }) => {
  const parseCoord = (v: string | null): number | null => {
    if (!v) return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const geo = {
    country: request.headers.get("cf-ipcountry") || null,
    city: request.headers.get("cf-ipcity") || null,
    lat: parseCoord(request.headers.get("cf-iplatitude")),
    lng: parseCoord(request.headers.get("cf-iplongitude")),
  };
  const hasGeo = !!(geo.country || geo.city || (geo.lat !== null && geo.lng !== null));
  return { geo: hasGeo ? geo : null };
};
```

Localhost dev has no CF headers → `geo: null` → every downstream step is a
no-op. `cf-ipcountry` can be `"XX"`/`"T1"` (Tor/unknown); treat as a value, not
an error — display will simply show whatever CF reports.

### 2. Stamp — presence init + user doc

A `UserLocation`-lite shape (distinct from the community `UserLocation` model,
which carries consent/visibility we don't want here):

```ts
// presence-models.ts
export interface PresenceLocation {
  city: string | null;
  country: string | null;   // ISO-2, e.g. "DE"
  lat: number | null;
  lng: number | null;
}
```

- **`presence-models.ts`** — add `location?: PresenceLocation;` to `UserPresence`.
- **Presence write** (`presence-tracker.ts` `set` at :174, refreshed via the
  init path) — accept an optional `location` and include it in the written
  record. The caller (presence bootstrap, wherever `initializePresence`/tracker
  start is invoked) passes `data.geo` from the layout load. If `geo` is null,
  omit `location` (don't overwrite a prior good value with nulls — see Edge
  cases).
- **User doc** — write `lastLocation: PresenceLocation & { updatedAt }` onto the
  Firestore user doc, in the same `user-document-manager` path that already
  writes `isAnonymous` (:124/:166). This is the persistent last-known copy that
  survives offline. Skip the write when `geo` is null.

Source of truth split: presence record = live location for the map of
currently-online users; user-doc `lastLocation` = persistent last-known for
cards and for offline users on the map.

### 3. Plumb through the admin merge — `user-activity-tracker.ts`

In `subscribeToAllUsers`:
- Read `data["lastLocation"]` into the firestore-user map alongside
  `isAnonymous`.
- Carry `location` onto every merged record on **both** branches (has-presence
  and default/no-presence), preferring the live presence `location` when
  present, else the user-doc `lastLocation`. (Mirror exactly how `isAnonymous`
  is threaded at :157 and :174.)
- Add `lastLocation` to `CachedUserMetadata` (`types.ts`) and parse it in
  `system-state-manager.ts` `parseUserDocument`, mirroring the `isAnonymous`
  addition from the prior spec — so any Quick-Stats/analytics consumer can use
  it later without re-plumbing.

### 4. Display A — cards (`UserPresenceCard.svelte`)

Add a location line: `📍 {city}, {country}` (e.g. `📍 Berlin, DE`). Format:
- Both present → `City, CC`.
- Country only → `CC`.
- Neither → render the slot **empty but space-reserved** (fixed min-height) so
  cards with and without location are the same height — `no-layout-shift.md`.

No new card component; this is an additive line on the existing primitive, used
by both the real-users grid and the anonymous-activity grid from the prior spec.

### 5. Display B — map section (`ActiveUsersPanel.svelte`)

A collapsible **User Map** section (below the existing grids) that mounts
`GlobalUserMap` and feeds users as generic pins via its existing `scanMarkers`
prop — no coupling to `UserLocationWithProfile`:

```ts
const userPins = $derived(
  users
    .filter((u) => u.location?.lat != null && u.location?.lng != null)
    .map((u) => ({
      id: u.userId,
      lat: u.location!.lat!,
      lng: u.location!.lng!,
      label: `${u.displayName}${u.location!.city ? ` · ${u.location!.city}` : ""}`,
      styleClass: u.activityStatus === "active" ? "pin-new" : "pin",
    }))
);
```

- `apiKey={env.PUBLIC_GOOGLE_MAPS_API_KEY}` (same source as community map).
- When the key is missing/placeholder → render the same "add key" notice
  pattern Community.svelte uses (`:170-175`), not a broken map.
- `onScanMarkerClick={(id) => selectUser(id)}` — clicking a pin opens the
  existing `UserDetailModal`. (Prop name is `onScanMarkerClick` for historical
  reasons; semantics here are "marker click". Acceptable reuse; a rename is out
  of scope.)
- Active users render as the pulsing `pin-new`, offline as `pin`, so live
  connections stand out.

### 6. i18n keys (`messages/en.json`)

- `admin_user_map` → "User Map"
- `admin_user_map_hint` → "Where signed-in users connect from (approximate)"
- `admin_location_unknown` → "Location unknown"
- (reuse existing `admin_*` add-key notice strings if the community one isn't
  admin-scoped; otherwise add `admin_map_key_missing`.)

## Edge cases

- **Null geo (dev/localhost, or CF header absent):** never write nulls over an
  existing `lastLocation`. The stamp step is skipped entirely when `geo` is
  null, so a user's last good location is preserved.
- **VPN / proxy:** CF reports the exit node's location. Acceptable — this is
  "where the connection originates," not a claim about the person.
- **`cf-ipcountry` sentinel values** (`XX`, `T1`): displayed verbatim; not
  treated as errors.
- **Coordinates without city** (some CF responses): pin still plots; card shows
  country only.
- **Map performance:** marker count = user count (hundreds, not thousands).
  GlobalMap already clusters; no extra work needed at current scale. If the user
  base grows past ~1k, revisit clustering density (flag, don't pre-optimize).

## Privacy

IP-derived, city-level, admin-only. No browser geolocation permission (does not
touch the `geolocation()` API blocked in `hooks.server.ts:107`). This is
standard analytics-grade location, same source already used for scan events. No
user-facing consent surface changes; the community opt-in precise-location
feature is untouched and independent.

## Testing / verification

- Build + `npm run check` green.
- Unit: pure `userPins` derivation (filter + label format) tested without the
  reactive singleton, mirroring `buildScanMapPins` tests
  (`tests/unit/scan-activity-map-pins.test.ts`).
- Runtime proof (DevTools MCP with permission, or Austen confirms in prod where
  CF headers exist): a user card shows `📍 City, CC`; the User Map plots pins;
  an active user is the pulsing pin; clicking a pin opens the detail modal.
  Localhost will show no location (expected — no CF headers).

## Files touched

| File | Change |
|---|---|
| `src/routes/+layout.server.ts` | add `load` returning CF `geo` |
| `presence/domain/models/presence-models.ts` | + `PresenceLocation`, `location?` on `UserPresence` |
| `presence/services/presence-tracker.ts` | accept + write `location` on presence record |
| `shared/auth/.../user-document-manager.ts` | write `lastLocation` on user doc (where `isAnonymous` is written) |
| presence bootstrap caller | pass `data.geo` into tracker init |
| `admin/services/user-activity-tracker.ts` | read `lastLocation`, carry `location` onto merged records |
| `admin/services/types.ts` | + `lastLocation` on `CachedUserMetadata` |
| `admin/services/system-state-manager.ts` | parse `lastLocation` |
| `admin/components/active-users/UserPresenceCard.svelte` | + reserved location line |
| `admin/components/ActiveUsersPanel.svelte` | + User Map section (GlobalUserMap reuse) |
| `messages/en.json` | new keys |
| `tests/unit/admin-user-pins.test.ts` | new — `userPins` derivation |

## Open items to resolve during planning (not blockers)

- Exact presence bootstrap call site that starts the tracker (where `data.geo`
  is injected) — confirm during plan; `+layout.server.ts` data reaches it via
  `$page.data` or a layout prop.
- Whether `user-document-manager` already has the user's request context to read
  geo, or whether the client passes it in (likely client-passed, since the doc
  write is client-side). Confirm the write path during plan.
