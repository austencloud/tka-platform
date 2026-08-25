# Community Map: Invitation, Not Interrogation

**Date:** 2026-08-25
**Status:** Design — round 2, revised after independent review
**Surface:** Creators module (`creators` — live in production)

## Revision note

Round 1 was reviewed by Codex (gpt-5.6-sol) against the source, and separately
re-checked by the author. Between them they found one blocker, six major
defects, and four stale citations in round 1. This document is the corrected
design. Round 1's errors are listed in "What round 1 got wrong" at the end,
because several of them were assertions about code that had never been read,
and that failure mode is worth keeping visible rather than quietly patching.

## Problem

The global community map is fully built and completely unreachable.

`src/lib/features/community/` already contains the map, a consent sheet, an
orchestrator, a repository, a city-only storage model, and working
add/update/remove flows. None of it ships, and none of it would work if it did:

1. **It lives behind a disabled module.** `environment-features.ts:146` sets
   `social: false`. The Community tab is a child of a Social module that is off
   in production, so no user has ever seen the map.
2. **Its opt-in cannot execute.** `hooks.server.ts:144-147` sends
   `Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=()`.
   `geolocation=()` disables the Geolocation API for the entire origin. Every
   call to `getCurrentLocation()` in the community feature rejects before the
   browser permission prompt is ever shown. The existing opt-in is dead code
   against a policy header, not merely unpopular.
3. **Its opt-in is an interruption even in principle.** `Community.svelte:61-67`
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
tab; changing the `userLocations` document shape or its Firestore rules;
following/feed behavior; browser geolocation of any kind; loosening the
origin's `Permissions-Policy`.

## Ground truth (verified 2026-08-25)

| Fact | Source |
|---|---|
| `social: false`, `creators: true` in production modules | `src/lib/shared/environment/environment-features.ts:146` and PRODUCTION_MODULES |
| `geolocation=()` blocks the Geolocation API origin-wide | `src/hooks.server.ts:144-147` |
| Consent drawer auto-opens on a 2s timer, undismissible | `Community.svelte:61-67`; `LocationSharingConsentSheet.svelte:33-38` |
| Cloudflare geo (`city`, `country`, `lat`, `lng`) resolved server-side every request | `src/routes/+layout.server.ts`; `parseCloudflareGeo` at `presence-models.ts:31-51` |
| `geo` is `null` when no CF headers (localhost/dev) | `presence-models.ts:49-50` (`hasGeo` guard) |
| `forwardGeocode(city, country)` is public, takes **two** args, returns coords only | `geocoding-service.ts:87-89` |
| `forwardGeocode` collapses every failure mode to `null` | `geocoding-service.ts:96-121` |
| `getCurrentLocation()`: **4 calls**, 2 imports, all inside `features/community` | calls at `Community.svelte:88,127`, `location-sharing-orchestrator.ts:36,68`; imports at `Community.svelte:11`, `orchestrator.ts:13` |
| **Pin click already routes into Creators** | `GlobalUserMap.svelte:11` imports `openCreatorProfile`, calls it at `:160`, bound at `:255` |
| Google Maps loads via a shared lazy loader inside `onMount` | `GlobalUserMap.svelte:12,51-66`; `getGoogleMapsLibraryLoader.ts` |
| Loader uses `@googlemaps/js-api-loader@2.1.1` `importLibrary`, currently `maps` + `marker` | `GoogleMapsLibraryLoader.ts:1,42-43`; `package.json:306` |
| `GlobalUserMap` has a `size="embedded"` variant at hard `height: 260px`, **zero consumers** | `GlobalUserMap.svelte:40-41,278-279`; grep for `size="embedded"` returns nothing |
| `userLocations` rules: public read, owner+`isFullUser()` write, owner/admin delete | `firestore.rules:2001-2014` |
| Locations at `userLocations/{uid}`; preferences at `users/{uid}/settings/locationSharing` | `user-location-repository.ts:15,36-38,134,145` |
| `page.data.geo` is the in-component access path (`$app/state`) | `src/routes/+layout.svelte:211` |
| `authState` exposes `initialized`, `loading`, `user`, `isAnonymous`, `isFullAccount` | `auth-state.svelte.ts:990-998` |
| CreatorsPanel ramps its own root `font-size`; descendants must size in `em` | `CreatorsPanel.svelte:14-25` (doc), `:646-668` (impl) |
| CreatorsPanel band is deliberately NOT `--shell-w` (fluid, uncapped) | `CreatorsPanel.svelte:20-25` |
| Insertion region `wall-slot` → `bands` → `denominator` | `CreatorsPanel.svelte:578-619` |
| Add-key notice pattern | `Community.svelte:172-191` |
| Maps key read from `$env/static/public` (**baked at build time**) | `Community.svelte:16` |
| Creators directory is 56-58 people; page size 200 | `creators-data-state.svelte.ts:26-40` |
| No shared in-view/lazy-mount primitive exists; IntersectionObserver is hand-rolled in ~7 places | grep across `src/lib/shared` |

## Design

### 1. One behavior owner, two hosts

Round 1 proposed a shared invitation slot with each host composing its own map,
loading, and mutations around it. That is insufficient: the hosts would still
each own public-location loading, error handling, membership, add/remove
orchestration, key handling, the count, and refresh-after-write. That is
precisely the host-level duplication that `sequence-viewer-shell.md` exists to
forbid, and it is how the /q page and the viewer drawer drifted for days.

**`CommunityMapExperience.svelte`** is the single owner of the whole
experience: map, count, invitation slot, picker, and every mutation. Hosts are
thin and pass only layout intent.

```
CommunityMapExperience.svelte      <- owns everything below
  ├─ community-map-state.svelte.ts <- locations, membership, mutations, async
  ├─ GlobalUserMap.svelte          <- unchanged except sizing (see §6)
  ├─ CommunityInvitationSlot.svelte
  └─ CommunityCityPicker.svelte
```

| Host | Role |
|---|---|
| `CreatorsPanel.svelte` | Renders the experience as a band between `wall-slot` and `bands`. |
| `Community.svelte` | Renders the same experience as the Social-module page. Loses its own loading, consent, mutation, and map composition entirely. |

Host-specific differences travel as props (a layout variant and the surrounding
heading), never as forked markup. If a host needs something the experience does
not expose, the prop is added to the experience.

### 2. State model

Round 1 named `(geo, hasSharedLocation, authState)` without defining ownership,
loading states, or async safety. Specified now.

**Membership comes from the locations array, not from consent.**
`hasConsented()` reads `users/{uid}/settings/locationSharing` while the visible
pin lives in `userLocations/{uid}`, and the add flow writes both independently.
Either write can fail alone, so consent is not a reliable proxy for "on the
map." The already-loaded public `locations` array answers the question directly
and cannot disagree with what the user sees on the map.

`community-map-state.svelte.ts` owns:

```ts
type LocationsStatus = "unresolved" | "loading" | "present" | "error";
```

- Public locations, their status, and the count.
- Current-user membership, derived from `locations` and the effective uid.
- `addCity`, `removeCity`, and refresh-after-write.
- Async safety: every request captures the uid and a request generation;
  results from a superseded generation are discarded. This prevents user A's
  in-flight read from landing after user B signs in.
- The effect must not depend on state it writes.

**Auth resolution is a first-class state.** The existing check runs once in
`onMount` reading `auth.currentUser` (`Community.svelte:29-32,55-60`), so if
Firebase resolves afterward it never re-runs. The new state keys on
`authState.initialized` and `authState.user?.uid`, and re-runs on uid change and
sign-out.

**Slot state is a pure function** in `community-invitation-state.ts`, taking
`(authInitialized, isFullAccount, uid, locationsStatus, isOnMap, geoCity)` and
returning one variant. It is unit-tested without any reactive singleton.

Treating an unresolved read as "not on the map" would flash "Add Chicago" at a
user who is already on it. `unresolved` renders the slot's reserved space with
no action, never a wrong action.

### 3. The invitation slot — one box, five states

| Variant | Contents |
|---|---|
| `unresolved` | Reserved space, no action. Never a spinner that shifts. |
| `guest` | `Sign in to add your city.` · **[Sign in]** |
| `suggest` (geo city known, not on map) | `Looks like you're in {City}.` · **[Add {City}]** · **[Not right?]** |
| `pick` (no geo city, not on map) | **[Pick your city]** |
| `member` (on map) | 📍 `{City}` · **[Remove]** |

Fine print, one line, always present: **`City only. Remove it whenever you want.`**

Same box in every variant, sized to the widest so nothing below moves
(`no-layout-shift.md`: ghost-sizer or explicit `min-height`, never intrinsic
sizing). No dismiss control and no dismissal state to persist — the slot covers
nothing, so there is nothing to wave away. It never re-prompts and never appears
outside this experience.

`Not right?` and `Pick your city` open the same picker. Both are real buttons
with visible affordances (`clickables-look-like-buttons.md`).

**Copy:** no em dashes, no superlatives, no first person. New `community_*` keys
in `messages/en.json`.

### 4. Two entry paths, one write

```
CF path:      page.data.geo.{city,country} → forwardGeocode() → coords
Picker path:  Places Autocomplete → canonical {city, country, coords}
                                  ↓
                        addCity({city, country, coords})
                                  ↓
     saveLocation(uid, …)  +  savePreferences(uid, …)
```

`addCity` is the only write path. `updateLocation` collapses into it and takes
the same input; it no longer requires prior consent or browser coordinates.
`removeCity` wraps the existing `removeLocation`.

**Partial-write handling.** The two writes are independent and non-atomic. If
`saveLocation` succeeds and `savePreferences` fails, the user IS on the map,
membership is derived from locations, and the UI is therefore correct. The
preference write is best-effort and its failure is logged, not surfaced as a
failed add. If `saveLocation` itself fails, nothing is written and the slot
reports it.

**No browser geolocation anywhere.** No permission prompt, no
`Permissions-Policy` change.

### 5. The city picker — Places Autocomplete

Round 1 proposed one free-text field feeding `forwardGeocode`. That is
unimplementable: `forwardGeocode(city, country)` requires both arguments and
returns coordinates only, so it can neither accept one string nor canonicalize
what gets stored.

`PlaceAutocompleteElement` from `importLibrary("places")` returns a canonical
locality, country, and coordinates from a single control:

```ts
const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
el.addEventListener("gmp-select", async ({ placePrediction }) => {
  const place = placePrediction.toPlace();
  await place.fetchFields({ fields: ["location", "addressComponents"] });
  // locality + country from addressComponents; lat/lng from location
});
```

Restricted to cities. `GoogleMapsLibraryLoader.load()` gains `"places"`
alongside `"maps"` and `"marker"` — an extension of the existing owner, not a
new loader.

**Cost, verified 2026-08-25 against Google's pricing page.** Autocomplete
Session Usage is unlimited and free. Place Details Essentials — which covers the
`location` and `addressComponents` fields — is free for the first 10,000 events
per month, then $5.00 per 1,000. Only a completed pick bills. Against a 56-58
person directory on a fallback path, this is free by roughly two orders of
magnitude; exceeding the free tier would take more than 10,000 city picks in a
month, and past that it is half a cent per person, once.

**The real cost is operational:** the Places API must be enabled on the
production key with correct referrer restrictions. Pre-ship gate, §9.

**Geocoder error handling.** `forwardGeocode` currently returns `null` for
"city not found", HTTP failure, quota exhaustion, key restriction, and network
error alike, so the UI cannot honestly explain what went wrong. It gains a
discriminated result distinguishing `not-found` from `operational-failure`. The
CF path needs this because a silent `null` there would otherwise present as
"we couldn't find Chicago."

### 6. Sizing and the map mount

**`em` throughout.** CreatorsPanel scales by ramping its own `font-size` with
descendants in `em` (`:14-25`, `:646-668`). Every measure in the new subtree is
`em`. The 44px touch floor is expressed as `2.75em` at the 16px base. A single
`rem` freezes the subtree at 1080p proportions and breaks the panel's 4K
strategy.

**`size="embedded"` is unusable as-is.** It hardcodes `height: 260px`. It has
zero consumers, so it is free to change: it becomes an `em`-based height driven
by the experience rather than a fixed pixel value.

**Viewport-gated mount.** The shared loader defers the Google script until
`GlobalUserMap` mounts — that is module laziness, not viewport laziness. If the
band renders immediately, every Creators visitor fetches Google Maps right after
hydration on a page that never previously loaded it. The experience therefore
reserves the band's full height and mounts `GlobalUserMap` only when the
reserved shell approaches the viewport, via IntersectionObserver.

No shared in-view primitive exists; IntersectionObserver is hand-rolled in about
seven places under `src/lib/shared`. Per `never-hand-roll.md` this is recorded as
**compose, with a reason**: extracting a shared primitive across seven existing
consumers is its own refactor and must not ride along on this feature. The
experience follows the existing local pattern (`LaunchpadGrid.svelte:148-160`)
and the extraction is flagged separately.

### 7. Guests

`firestore.rules:2001-2014` already gates writes behind
`isOwner(uid) && isFullUser()` while public locations are world-readable. Guests
see the map and the count; the slot shows the `guest` variant. No rules change.

### 8. Deletions

- `consentTimer` / `showConsentSheet` and their handlers in `Community.svelte`.
- `components/LocationSharingConsentSheet.svelte`.
- `services/location-provider.ts` — four calls and two imports, all replaced.
  **Re-verify with a fresh grep immediately before deleting.**
- The three-benefit list and five-bullet privacy notice, replaced by the single
  fine-print line.
- Orphaned `community_consent_*` keys (13 of them). Remove only keys with zero
  remaining references, proven by grep.

### 9. Privacy — stated accurately

Round 1 claimed "nothing more precise than a city is ever obtained." That is
false: `+layout.server.ts` returns Cloudflare's geo object including `lat`/`lng`,
and it is exposed in page data on every route. The accurate statement:

- The app never requests browser geolocation, and cannot — the origin blocks it.
- Cloudflare's coordinates are IP-derived and already city-or-region level. They
  are not a device position.
- The write path stores city, country, and **city-center** coordinates from
  geocoding. Cloudflare's coordinates are never stored.
- The stored document is world-readable by design and the user can delete it.

The one-line fine print is accurate as written. This section exists so nobody
later repeats the stronger claim, which is not.

## Edge cases

| Case | Behavior |
|---|---|
| `page.data.geo` is `null` (localhost, no CF headers) | `pick` variant. Dev is a first-class path, not an error. |
| VPN / proxy exit node | CF reports the exit node's city. `Not right?` is the remedy; this is why the picker is not optional. |
| `cf-ipcountry` sentinels (`XX`, `T1`) | Treated as a value. Missing `city` falls to `pick`. |
| Auth still resolving | `unresolved`. Never a wrong action. |
| Sign-out mid-session, or uid change | State resets, stale in-flight results discarded, slot re-renders. |
| Maps key missing at build | Existing add-key notice (`Community.svelte:172-191`), never a blank rectangle. |
| Places not enabled on the key | Picker reports an operational failure and stays open. The CF path still works, so the feature degrades rather than breaking. |
| `forwardGeocode` not-found vs operational failure | Distinct messages. Neither writes anything. |
| Existing location from the old flow | `member` variant. No migration; stored shape unchanged. |
| Zero public locations | Band renders with an honest empty map and the invitation. Count reads `0`. Never hidden. |
| `wallItems` empty | The band must not sit inside the wall's conditional. Verify placement is independent of it. |

## Risks

1. **`PUBLIC_GOOGLE_MAPS_API_KEY` is `$env/static/public`** — baked at build
   time. If absent from the Cloudflare Pages build environment, the band ships
   the add-key notice to a live production page.
2. **Places API enablement and referrer restrictions** on the production key.
   New API surface for this codebase.
3. **Map weight on production traffic.** Mitigated by the viewport gate; must be
   proven, not assumed (§10).
4. **`em` discipline.** One `rem` silently breaks the 4K ramp. Grep the diff.
5. **`getPublicLocations()` joins a user profile per location.** Fine at 56-58.
   Flag, do not pre-optimize.

## Verification

**Non-visual:**
- `npm run check` green; unit tests green.
- Unit: slot-variant pure function across all five variants and every auth /
  locations-status combination.
- Unit: `addCity` performs both writes on success; performs zero writes when
  resolution fails; surfaces `saveLocation` failure; tolerates `savePreferences`
  failure without reporting a failed add.
- Unit: stale-result discarding — a superseded uid's response is ignored.
- Unit: `forwardGeocode` distinguishes not-found from operational failure.
- Runtime: **no Google Maps network request before the band nears the
  viewport**, proven from the network panel, not asserted.
- Grep: no `type="checkbox"`; no `rem` in the new subtree; zero references to
  `getCurrentLocation`, `location-provider`, `LocationSharingConsentSheet`,
  `showConsentSheet`, `consentTimer`; each deleted i18n key has zero consumers.

**Visual (all seven, per `visual-verification-mandatory.md`):**
1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, 375×667.

Measurement pass (`evaluate_script`) first — slot button widths, band height as
a fraction of viewport, computed font sizes — then screenshots for composition.
At each: buttons size to their labels rather than stretching; slot variants move
nothing below them; the map is not a thin strip; no dead rail at 4K; the page
does not dead-end; fine print stays legible (12px supplementary floor).

## Pre-ship gates (human)

1. `PUBLIC_GOOGLE_MAPS_API_KEY` present in the Cloudflare Pages **build**
   environment.
2. Places API enabled on that key, with referrer restrictions permitting the
   production origins.
3. Band placement, tier heights, and count placement confirmed against real
   frames.

## What round 1 got wrong

Kept deliberately. Most of these were assertions about code that was never
opened.

| # | Defect | Found by |
|---|---|---|
| 1 | Claimed the pin's profile handoff "has nowhere to go." It was already wired in `GlobalUserMap.svelte:11,160,255`. Cited the child component, never read the parent that binds it. | both |
| 2 | Hand-waved "load lazily" when a shared loader already existed — and missed that it is not viewport-lazy. | both |
| 3 | Missed that `size="embedded"` exists at a hard 260px, colliding with the `em` requirement. | author |
| 4 | **Blocker:** a one-field picker cannot feed `forwardGeocode(city, country)` or canonicalize what is stored. | Codex |
| 5 | Used consent as the proxy for map membership across two independent writes that can diverge. | Codex |
| 6 | Claimed "nothing more precise than a city is ever obtained" while `page.data.geo` carries lat/lng. | Codex |
| 7 | Promised a specific geocoding error message the geocoder cannot produce, since it collapses all failures to `null`. | Codex |
| 8 | Left `updateLocation` "collapses to the same path" undesigned. | Codex |
| 9 | Assumed a shared slot prevents host drift when the hosts still own everything else. | Codex |
| 10 | Said "5 call sites" for what is 4 calls and 2 imports; understated the preferences path; three stale line ranges. | Codex |
