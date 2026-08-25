# Community Map: Invitation, Not Interrogation

**Date:** 2026-08-25
**Status:** Design — pending review
**Surface:** Creators module (`creators` — live in production)

## Problem

The global community map is fully built and completely unreachable.

`src/lib/features/community/` already contains the map, a consent sheet, an
orchestrator, a repository, a city-only storage model, and working
add/update/remove flows. None of it ships, and none of it would work if it did:

1. **It lives behind a disabled module.** `environment-features.ts:146` sets
   `social: false`. The Community tab is a child of a Social module that is off
   in production, so no user has ever seen the map.
2. **Its opt-in cannot execute.** `hooks.server.ts:146` sends
   `Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=()`.
   `geolocation=()` disables the Geolocation API for the entire origin. Every
   call to `getCurrentLocation()` in the community feature rejects before the
   browser permission prompt is ever shown. The existing opt-in is dead code
   against a policy header, not merely unpopular.
3. **Its opt-in is an interruption even in principle.** `Community.svelte:64`
   starts a 2-second timer that opens `LocationSharingConsentSheet` as a bottom
   drawer with `closeOnBackdrop={false}`, `closeOnEscape={false}`,
   `dismissible={false}`. An undismissible modal covers the map the user
   deliberately navigated to, then presents three benefit bullets and a
   five-item privacy list before it will move.

The feature's actual pitch is small and light: it is fun to see where people
are, and it is easy to leave. The current surface asks for a browser permission
it cannot obtain, in a modal that cannot be closed, to deliver a dot on a map.

## Goal

Ship the map inside Creators with a one-tap, no-permission opt-in that a user
can ignore forever without ever being blocked.

**Non-goals:** enabling the Social module; the Connect / nearby-spinner-sync
tab; changing the `userLocations` storage model or its Firestore rules;
following/feed behavior; precise or street-level location of any kind;
loosening the origin's `Permissions-Policy`.

## Ground truth (verified 2026-08-25)

| Fact | Source |
|---|---|
| `social: false` in production modules | `src/lib/shared/environment/environment-features.ts:146` |
| `creators: true` in production modules | `src/lib/shared/environment/environment-features.ts` (PRODUCTION_MODULES) |
| `geolocation=()` blocks the Geolocation API origin-wide | `src/hooks.server.ts:146` |
| Consent drawer auto-opens on a 2s timer, undismissible | `src/lib/features/community/Community.svelte:64`; `components/LocationSharingConsentSheet.svelte:33-38` |
| Cloudflare geo (`city`, `country`, `lat`, `lng`) resolved server-side on every request | `src/routes/+layout.server.ts`; `parseCloudflareGeo` at `src/lib/shared/presence/domain/models/presence-models.ts:31-51` |
| `geo` is `null` when no CF headers (localhost/dev) | `presence-models.ts:49-50` (`hasGeo` guard) |
| `forwardGeocode(city, country)` is public and returns city-center coords | `src/lib/features/community/services/geocoding-service.ts:87-89` |
| `getCurrentLocation()` used only inside `features/community`, 5 call sites | `Community.svelte:11,88,127`; `location-sharing-orchestrator.ts:13,36,68` |
| Map pin click opens a profile popup with an `onViewProfile` handoff | `components/UserProfileMarker.svelte:13-24` |
| `userLocations` rules: public read, owner+`isFullUser()` write, owner/admin delete | `firestore.rules:2001-2014` |
| Preferences live at `users/{uid}/settings`, locations at `userLocations/{uid}` | `services/user-location-repository.ts:15,36-38` |
| `page.data.geo` is the in-component access path (`$app/state` is the convention) | `src/routes/+layout.svelte:211`; `$app/state` imports across `src/lib/features/**` |
| CreatorsPanel ramps its own root `font-size`; **descendants must size in `em`** | `src/lib/features/creators/components/CreatorsPanel.svelte:1-25` (header comment) |
| CreatorsPanel content band is deliberately NOT `--shell-w` (fluid padding, no cap) | same header comment |
| Insertion region: `wall-slot` → `bands` → `denominator` | `CreatorsPanel.svelte:578-618` |
| Google Maps key read from `PUBLIC_GOOGLE_MAPS_API_KEY`, present in local `.env` | `Community.svelte:16`; `get-geocoding-service.ts:10` |

## Design

### 1. Placement — a Community band inside CreatorsPanel

The map becomes a full-width band on the Creators roster page, inserted
**between `wall-slot` and `bands`** (`CreatorsPanel.svelte:578-590`). It is not
a tab, not a route, and not a modal. A user browsing creators scrolls into it.

Band header, one row:

> **Flow artists around the world** · `{n}` on the map

The count is live from the loaded locations. It is the social proof that makes
the invitation legible: a map with 127 dots reads as a place, a map with 0 dots
reads as a form.

**4K/scale constraint (load-bearing):** CreatorsPanel scales by ramping its own
`font-size`, with every descendant sized in `em`. The band and every element
inside it **must size in `em`**. A `rem` measure anywhere in this subtree
freezes at 1080p proportions and breaks the panel's 4K strategy. The band
inherits the panel's fluid content band; it must not introduce a `--shell-w`
cap or any hard `max-width`.

The band has a fixed, viewport-proportional height so the map never collapses
and never swallows the page. It must earn its vertical at 3840 and stay
scrollable-past at 375.

### 2. The invitation slot — one box, four states

A single slot docked in the band. Same box in every state, sized to the widest
variant so nothing below it moves when the state changes
(`no-layout-shift.md`; ghost-sizer or explicit `min-height`, not intrinsic
sizing).

| Condition | Contents |
|---|---|
| Signed in, not on the map, `page.data.geo.city` present | `Looks like you're in {City}.` · **[Add {City}]** · `Not right?` |
| Signed in, not on the map, no geo | **[Pick your city]** |
| Signed in, on the map | 📍 `{City}` · **[Remove]** |
| Guest / anonymous | `Sign in to add your city.` · **[Sign in]** |

Fine print, one line, always present: **`City only. Remove it whenever you want.`**

There is no dismiss control and no dismissal state to persist. The slot is not
covering anything, so there is nothing to wave away. It never re-prompts, never
animates in, and never appears anywhere other than this band.

`Not right?` and `Pick your city` open the same city picker.

**Copy rules:** no em dashes, no superlatives, no "Whether you're", no first
person. The strings above are the proposed final copy and go through
`messages/en.json` as new `community_*` keys.

### 3. Add flow — Cloudflare geo, no browser permission

```
page.data.geo.{city,country}
  → Geocoder.forwardGeocode(city, country)   // city-center coords
  → saveLocation(uid, { city, country, cityCenterCoordinates, visibility: "public" })
  → savePreferences(uid, { hasConsented: true, consentedAt, visibility: "public" })
```

The manual picker produces the same `(city, country)` pair and feeds the
identical two writes. **One write path, two ways to reach it.**

No Geolocation API call. No permission prompt. No `Permissions-Policy` change.
Nothing more precise than a city is ever obtained, so nothing more precise than
a city can ever leak.

`updateLocation` collapses to the same path; `removeLocation` is unchanged.

**Failure handling:** if `forwardGeocode` returns `null` (a city name the
Geocoding API cannot resolve), surface a specific message in the slot and keep
the picker open. Never write a location with fabricated coordinates, and never
fall back silently.

### 4. The city picker

Invoked from `Not right?` and `Pick your city`. Minimum viable shape: a text
input plus a **[Use this city]** action that runs `forwardGeocode` on the typed
string and reports back whether it resolved. It reuses the existing Geocoder;
it does not add a Places Autocomplete dependency.

Per `never-hand-roll.md`: before building the picker, grep for an existing
search/typeahead primitive in `src/lib/shared/components/` (`PanelSearch` is
already imported by CreatorsPanel and may cover the input). Report
reuse/extend/compose/create before implementing.

Per `no-checkboxes.md` and `clickables-look-like-buttons.md`: every action is a
real button with a visible affordance and a 44px touch-target floor. `Not
right?` is a standalone action, so it is a button, not a text link.

### 5. Pin click → creator profile

`UserProfileMarker`'s existing `onViewProfile(userId)` currently has nowhere to
go. Inside Creators it routes into the existing profile view via
`openCreatorProfile` (`../state/creators-routing.svelte`). Pin → person → their
work, without a new component.

### 6. Deletions

- The `consentTimer` / `showConsentSheet` block (`Community.svelte:61-67`, plus
  the `onDestroy` cleanup at `:35-39` if it becomes vacuous).
- `src/lib/features/community/components/LocationSharingConsentSheet.svelte`.
- `src/lib/features/community/services/location-provider.ts` — grep confirms its
  only consumers are the five call sites this design replaces. **Re-verify with
  a fresh grep immediately before deleting** (`verify-before-deleting`).
- The three-benefit list and the five-bullet privacy notice, replaced by the
  single fine-print line.
- Their now-orphaned `community_consent_*` keys in `messages/en.json`. Remove
  only keys with zero remaining references, verified by grep.

### 7. Guests

`firestore.rules:2008` already gates writes behind
`isOwner(userId) && isFullUser()` while public locations are world-readable.
Guests therefore see the map and the count, and the slot shows the sign-in
variant. No rules change, no new gate.

### 8. What does not change

The `userLocations` document shape, the Firestore rules, `GlobalUserMap.svelte`,
`UserProfileMarker.svelte`'s internals, `user-location-repository.ts`,
`environment-features.ts` (`social` stays `false`), and `Permissions-Policy`.

`src/lib/features/community/Community.svelte` remains as the Social-module host
for the map. It loses the consent timer and drawer; it is not deleted. The new
band composes `GlobalUserMap` plus the invitation slot directly, and the
invitation slot is a shared component both hosts render, so the two surfaces
cannot drift.

## Edge cases

| Case | Behavior |
|---|---|
| `page.data.geo` is `null` (localhost, missing CF headers) | Slot shows **[Pick your city]**. No error, no empty state. Dev is a first-class path. |
| VPN / proxy exit node | CF reports the exit node's city. `Not right?` is the remedy; this is why the correction path is not optional. |
| `cf-ipcountry` sentinels (`XX`, `T1`) | Treated as a value. If `city` is absent, the slot falls to **[Pick your city]**. |
| Geocoding key missing at runtime | Band renders the existing add-key notice pattern (`Community.svelte:170-175`), not a broken map. Never a blank grey rectangle. |
| `forwardGeocode` returns `null` | Specific message, picker stays open, no write. |
| User already has a location from the old flow | Slot renders the on-the-map state. No migration; the stored shape is unchanged. |
| Zero public locations | Band still renders with an honest empty map and the invitation. The count reads `0 on the map`. Do not hide the band. |
| Signed out mid-session | Slot re-renders to the guest variant reactively. |

## Risks

1. **`PUBLIC_GOOGLE_MAPS_API_KEY` in the Cloudflare Pages production env.**
   Present in local `.env` (39 chars). Its presence in production could not be
   verified from this session. **Confirm before ship**; if absent, the band
   renders the add-key notice on a live production page.
2. **`getPublicLocations()` joins a user profile per location.** Fine at current
   scale. Flag, do not pre-optimize, revisit past a few hundred pins.
3. **Map bundle weight on a page that did not previously load Google Maps.** The
   Creators page is production traffic. The map must load lazily and must not
   block the roster's first paint.
4. **`em` discipline.** A single `rem` in the new subtree silently breaks
   CreatorsPanel's 4K ramp. Grep the diff for `rem` before claiming done.

## Verification

**Non-visual:**
- `npm run check` green; unit tests green.
- Unit test the pure derivation of slot state from
  `(geo, hasSharedLocation, authState)` — four states, no reactive singleton.
- Unit test the add-flow write path: `(city, country)` → two repository calls,
  and the `forwardGeocode`-returns-`null` case writing nothing.
- Grep proof: no `type="checkbox"` in the diff; no `rem` units in the new
  Creators subtree; no remaining `getCurrentLocation` references after deletion.

**Visual (mandatory, all seven, per `visual-verification-mandatory.md`):**
1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, 375×667.

At each: the band earns its vertical without dead rail; the invitation slot's
buttons size to their labels and are not stretched into progress bars; state
changes in the slot move nothing below them; the map is not a thin strip; the
page does not dead-end at 4K; the fine print is legible (12px supplementary
floor minimum) at its real viewing scale.

A measurement pass (`evaluate_script`) runs before the screenshot pass: slot
button widths, band height as a fraction of viewport, computed font sizes.

## Open decisions for Austen

These are visual/UX gates, raised at the moment they are reachable rather than
answered in advance:

1. Band position: above `wall-slot` (map first) or between `wall-slot` and
   `bands` (work first). This spec assumes the latter.
2. Band height at each tier.
3. Whether the count belongs in the header or on the map itself.
