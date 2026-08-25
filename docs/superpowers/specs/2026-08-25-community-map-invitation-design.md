# Community Map: Invitation, Not Interrogation

**Date:** 2026-08-25
**Status:** Design — round 3, revised after two independent review passes
**Surface:** Creators module (`creators` — live in production)

## Revision note

Round 1 was reviewed by Codex (gpt-5.6-sol) and separately by the author: one
blocker, six major defects, four stale citations. Round 2 fixed those and was
reviewed again. Round 2 confirmed nine of ten fixes but found one still-broken
model, four new majors, and a shared primitive the spec had claimed did not
exist.

Round 3 corrects those and changes three mechanisms:

- **The picker is now headless.** Round 2 specified Google's
  `PlaceAutocompleteElement` custom element. Round 2's review correctly showed
  that a Google-rendered element inside a themed panel cannot be themed,
  contrast-proofed, focus-proofed, touch-target-proofed, or kept from being
  clipped. The Places **Data API** returns the same predictions as plain data,
  which TKA renders in its own markup. That deletes the entire class of problem
  rather than mitigating it.
- **Membership no longer derives from the public locations list.** It could
  never have worked; see Ground truth row 8.
- **Places loads separately from Maps.** Adding it to the shared loader would
  have made every map mount, in two features, pay for Places.

Errors from both prior rounds are listed at the end. Several were assertions
about code that had never been read, and that failure mode is worth keeping
visible rather than quietly patching.

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

The census confirms the consequence: `userLocations` holds **exactly one
document**, created 2026-01-18. In seven months the feature has produced one
record, because no user could reach it.

The feature's actual pitch is small and light: it is fun to see where people
are, and it is easy to leave. The current surface asks for a browser permission
it cannot obtain, in a modal that cannot be closed, to deliver a dot on a map.

## Goal

Ship the map inside Creators with a one-tap, no-permission opt-in that a user
can ignore forever without ever being blocked.

**Non-goals:** enabling the Social module; the Connect / nearby-spinner-sync
tab; changing the `userLocations` Firestore rules; following/feed behavior;
browser geolocation of any kind; loosening the origin's `Permissions-Policy`.

**Scope change from round 2:** the document shape gains one additive optional
field, `countryCode` (ISO-2). Round 2 listed the shape as a non-goal. See
Design section 5. The single existing document remains valid without it.

## Ground truth (verified 2026-08-25)

| # | Fact | Source |
|---|---|---|
| 1 | `geolocation=()` disables the Geolocation API origin-wide | `src/hooks.server.ts:144-147` |
| 2 | Cloudflare geo is resolved server-side and exposed on every route | `src/routes/+layout.server.ts:5-9` |
| 3 | `parseCloudflareGeo` returns city, country, lat, lng; `country` is **ISO-2** and documented as such | `presence-models.ts:18-21,31-52` |
| 4 | `social: false`, `creators: true` | `environment-features.ts:146` |
| 5 | The consent sheet is undismissible and timer-triggered | `Community.svelte:61-67`; `LocationSharingConsentSheet.svelte:33-38` |
| 6 | Pin click already routes to the creator profile. This is wired today | `GlobalUserMap.svelte:11,160,255` |
| 7 | `getLocation(userId)` reads the owner's document directly, and has **exactly one caller**, in the orchestrator this design deletes | `user-location-repository.ts:53-61`; `location-sharing-orchestrator.ts:100` |
| 8 | `getPublicLocations()` filters `visibility == "public"` **and drops any location whose `users/{uid}` profile join returns null**. It throws on failure rather than returning empty | `user-location-repository.ts:73-113` |
| 9 | `getLocation` swallows all errors to `null`, making "no document" and "read failed" indistinguishable | `user-location-repository.ts:57-60` |
| 10 | Preferences live at `users/{uid}/settings/locationSharing` | `user-location-repository.ts:36-38,134` |
| 11 | The shared loader imports `maps` + `marker` together behind one memoized promise | `GoogleMapsLibraryLoader.ts:41-56` |
| 12 | The loader has **two** consumers, not one: the community map and `FestivalMap` | `GlobalUserMap.svelte:51`; `FestivalMap.svelte:30` |
| 13 | `LazyMount` is a shared primitive for deferred chunk loading with an SSR-rendered same-footprint `placeholder`, `prefetch`, and error/retry | `src/lib/shared/components/LazyMount.svelte` |
| 14 | No shared IntersectionObserver / in-view owner exists. `LazyMount` governs *when code is fetched*, not visibility, and does not observe intersection | `LazyMount.svelte:15-19` |
| 15 | `GlobalUserMap` has an unused `size="embedded"` variant at a hard `height: 260px` | `GlobalUserMap.svelte:40-41,278-279` |
| 16 | `country` is rendered directly to users as "city, country" | `UserProfileMarker.svelte:59-64`; `GlobalUserMap.svelte:138` |
| 17 | `CreatorsPanel` ramps its own `font-size`; descendants must size in `em`, never `rem` | `CreatorsPanel.svelte:14-25` |
| 18 | `forwardGeocode(city, country)` takes two arguments and returns coordinates only; every failure collapses to `null` | `geocoding-service.ts:87-89,96-121` |
| 19 | `userLocations`: public read, `isOwner && isFullUser` write, owner/admin delete | `firestore.rules:2001-2014` |
| 20 | **Census:** `userLocations` contains exactly one document — Chicago, `country: "United States"` (long name), `visibility: "public"`, created 2026-01-18 | Firestore query, 2026-08-25 |
| 21 | The `(cities)` type collection is valid for `includedPrimaryTypes` in Autocomplete (New) and maps to `locality` or `administrative_area_level_3`. A type collection **cannot** be combined with any other type; doing so returns `INVALID_REQUEST` | [Place Types (New)](https://developers.google.com/maps/documentation/places/web-service/place-types) |
| 22 | `AutocompleteSuggestion.fetchAutocompleteSuggestions()` returns predictions as data, for a caller-rendered UI. `AutocompleteSessionToken` is created and refreshed manually on this path | [Autocomplete Data API](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data) |
| 23 | `addressComponents` and `location` are **Place Details Essentials** fields. `displayName` is **Pro** | [Place data fields](https://developers.google.com/maps/documentation/javascript/place-class-data-fields) |

## Design

### 1. One behavior owner, two hosts

```
CommunityMapExperience.svelte        <- owns everything below
  |- community-map-state.svelte.ts   <- module-scoped; survives host teardown
  |- GlobalUserMap.svelte            <- unchanged except sizing
  |- CommunityInvitationSlot.svelte
  |- CommunityCityPicker.svelte      <- TKA-rendered, Places as a data source
```

Hosts render `<CommunityMapExperience />` and nothing else map-related. The
Creators band and the Community tab cannot drift because there is only one
implementation, per the `sequence-viewer-shell.md` precedent.

Round 2's review was right that a shared *slot* alone would not have prevented
drift while hosts still owned loading, membership, mutation, and composition.
The owner boundary is drawn around all of it.

### 2. State model

Two independent status machines. Conflating them was round 2's blocker.

| Concern | Source | Drives |
|---|---|---|
| `locations` / `locationsStatus` | `getPublicLocations()` | Map markers, the count |
| `ownLocation` / `ownStatus` | `getLocation(uid)` | Membership, the member's city |

**Membership derives only from `ownLocation`.** It cannot derive from
`locations`, because `getPublicLocations()` excludes private documents, drops
public documents whose profile join fails, and is limit-bounded (Ground truth
8). A user could be on the map and absent from that array for three separate
reasons.

`getLocation` is changed to a discriminated result so absence and failure are
distinguishable (Ground truth 9). Its only caller is deleted by this work
(Ground truth 7), so the change is free:

```ts
type OwnLocationResult =
  | { status: "found"; location: UserLocation }
  | { status: "absent" }
  | { status: "failed"; error: unknown };
```

**Mutation ordering.** A generation counter guards *reads*; it cannot unwind an
out-of-order *write*. The failing sequence round 2's review named is real: add
starts, remove is activated, delete lands first, the earlier save lands second,
and the user is silently back on the map after removing themselves.

Mutations therefore run through a **per-uid serial queue**. Each enqueued
mutation is tagged with an intent sequence number; on dequeue, a mutation whose
sequence is not the latest is discarded before it issues any Firestore write.
Two writes for one uid can never be in flight simultaneously, and a superseded
intent never reaches the network.

**Lifetime.** The state module is feature-scoped, not component-scoped. Opening
a creator profile tears down the roster host through the panel's root
`Crossfade`; a per-mount store would refetch both collections on every back
navigation. The module invalidates on uid change and on explicit refresh.

### 3. The invitation slot — one box, five states

| State | When | Shows |
|---|---|---|
| `unresolved` | auth or `ownStatus` still pending | Reserved space, no text |
| `guest` | not a full account | "Sign in to add your city" |
| `suggest` | full account, `ownStatus: absent`, CF city present | "Practicing in Chicago? Add yourself to the map." plus Add and Pick another city |
| `pick` | no CF city, or user chose another city | The picker |
| `member` | `ownStatus: found` | "You're on the map in Chicago." plus Change city and Remove |

`ownStatus: "failed"` renders `suggest` with the Add action disabled and a retry
affordance. It never renders as `absent`, because offering "add yourself" to
someone already on the map is the visible symptom of the round-2 blocker.

All five variants occupy identical measured geometry. Round 2's review was right
that reserving height is insufficient unless loading, error, key-warning,
picker-open, and invitation variants all live inside the same box
(`no-layout-shift.md`).

The slot is never modal, never timed, and never blocks the map.

### 4. Two entry paths, one write

```
CF path:      page.data.geo city/country/lat/lng
                    -> Intl.DisplayNames for the country name
                    -> forwardGeocode(city, country) for city-center coords
Picker path:  Places Data API -> addressComponents + location
                    |
                    v
              CanonicalCity { city, country, countryCode, coords }
                    |
                    v
              addCity(canonical)
                    |
                    v
     saveLocation(uid, ...)  plus  savePreferences(uid, ...)
```

There is one write path. "Change city" is `addCity` with a different canonical
input, not a separate `updateLocation`.

`forwardGeocode` gains a discriminated return so "city not found" and "geocoder
failed" are distinguishable (Ground truth 18). The UI must not promise an error
message the geocoder cannot produce.

**Coordinates written are always city-center coordinates from the geocoder or
from Places `location`.** The CF `lat`/`lng` are never written. They are
IP-derived and more precise than the stated privacy model allows.

### 5. City canonicalization

Round 2 said "restricted to cities", which is not an implementation contract.

**Request:** the `(cities)` type collection for `includedPrimaryTypes`, alone —
the collection is rejected if combined with any other type (Ground truth 21).

**Fields fetched:** `addressComponents` and `location` only. Both are Place
Details Essentials. `displayName` is Pro and is deliberately not requested
(Ground truth 23); the city label is built from components instead.

**City label, first match wins:**

1. `locality`
2. `postal_town` (UK)
3. `administrative_area_level_3`
4. `administrative_area_level_2`
5. `administrative_area_level_1`

No match is a rejection with an actionable message, not a silent write.

**Country.** Round 2's review caught a real inconsistency: CF supplies ISO-2
(`"US"`), the legacy reverse-geocoder wrote a long name (`"United States"`), and
`country` is rendered directly to users (Ground truth 16). "Chicago, US" is a
worse marker label than "Chicago, United States".

Both are kept, and both paths produce both:

- `country` — long display name. Places: the country component's `longText`.
  CF: `Intl.DisplayNames` with `type: "region"`, falling back to the raw code if
  it throws.
- `countryCode` — ISO-2, additive and optional. Places: the country component's
  `shortText`. CF: the value as given.

The one existing document (Ground truth 20) already carries a long-name
`country` and simply lacks `countryCode`. The schema addition is optional, so
that document stays valid and no migration is required.

### 6. The picker — Places as a data source, not as a widget

`CommunityCityPicker.svelte` is TKA markup: a text input and a result list
built from existing primitives. Predictions come from
`AutocompleteSuggestion.fetchAutocompleteSuggestions()` (Ground truth 22).

This is the round-3 mechanism change. The widget path would have injected a
Google-owned custom element into a themed, font-ramped panel, and round 2's
review correctly listed what that costs: no supported theming surface, contrast
and focus rings that cannot be proven, a 44px touch target that cannot be
verified by inspecting the Svelte subtree, `em` compliance that stops at the
element boundary, and a prediction overlay whose geometry can escape the panel
or be clipped by the panel's `overflow: hidden`.

None of that applies to markup TKA owns. The `em` rule, the design system, the
touch-target floor, and the contrast tokens apply to the picker the same way
they apply to every other control in the panel.

**What the headless path costs, stated up front.** The widget provided things
the app must now own, and this design is not complete without them:

- **A "Powered by Google" attribution is mandatory.** Using the Data API
  programmatically requires the UI to display the attribution unless the
  predictions appear inside a Google-branded map. The prediction list is not
  inside the map canvas, so the picker carries the mark. This was verified
  against Google's policy, not assumed. Source:
  [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).
- **Full combobox accessibility.** `role="combobox"`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, `role="listbox"`/`option`, arrow
  and Home/End/Escape handling, scroll-into-view for the active option, and a
  live-region announcement of the result count. The widget shipped these; TKA
  now writes them.

Both are accepted deliberately. Attribution is a static mark. The combobox
semantics are ordinary work the design system already supports, and unlike the
widget's shadow DOM, they can actually be audited and proven.

**Lifecycle, explicitly:**

- Places is imported on picker open, never before.
- `AutocompleteSessionToken` is created on open, sent with every keystroke
  request, and refreshed immediately after a selection resolves.
- Requests are sequence-tagged; a superseded response is discarded rather than
  rendered.
- Input is debounced. Empty input issues no request.
- Close, unmount, or uid change invalidates the in-flight sequence, so a late
  `fetchFields` cannot write after the picker is gone.
- No custom element is injected, so there is nothing to remove on destroy.
- Focus enters the input on open and returns to the trigger on close.

**Cost.** Round 2 stated Autocomplete sessions were unlimited and free, which
was wrong. Correctly: Autocomplete Requests and Place Details Essentials each
carry a 10,000-event monthly free allowance, and session pricing groups a
session's keystrokes with its terminating details call. At the current scale —
one existing record, a creators directory in the tens — this is free with four
orders of magnitude of headroom. The conclusion survives; the explanation was
wrong and is corrected here.

### 7. Loading: Maps and Places are separate capabilities

The shared loader imports `maps` and `marker` behind one memoized promise, and
has **two** consumers (Ground truth 11, 12). Adding `places` to that
`Promise.all` would make every mount of both the community map and `FestivalMap`
download Places even when no picker is ever opened.

The contract gains a separately-memoized capability, and `load()` keeps its
exact current signature so neither existing consumer changes:

```ts
export interface IGoogleMapsLibraryLoader {
  load(apiKey: string): Promise<void>;        // maps + marker, unchanged
  loadPlaces(apiKey: string): Promise<void>;  // places, separately memoized
}
```

Both share one bootstrap/API-key owner, preserving the existing different-key
rejection.

### 8. Sizing and the map mount

`GlobalUserMap`'s unused `size="embedded"` variant is a hard `260px`
(Ground truth 15), which is frozen at 1080p proportions inside a panel that
ramps its own font size (Ground truth 17). The experience owns its height in
`em`; the unused variant is converted rather than left as a trap.

**Viewport gating.** `LazyMount` is the shared owner for deferring the chunk and
for the SSR-rendered same-footprint placeholder (Ground truth 13). Round 2
claimed no such primitive existed; it does, and this uses it.

`LazyMount` governs *when code is fetched*, not visibility, and does not observe
intersection (Ground truth 14). A feature-local IntersectionObserver flips
`active`, following the established `LaunchpadGrid` cleanup/fallback pattern. No
shared observer owner is invented for a single consumer.

Round 2's review confirmed the layout mechanics: a default-root observer works
inside the panel's nested `.scroller` because ancestor clipping participates in
intersection, and the `bands` `bind:clientWidth` column math is unaffected as
long as the band is a sibling *before* `.bands`. The map must not introduce its
own vertical scroller.

### 9. Guests

Guests see the map and the count, and a sign-in invitation in the slot. The
Firestore rules already require `isFullUser()` to write (Ground truth 19); the
UI simply matches the rule instead of failing at the write.

### 10. Deletions

The undismissible consent sheet, the browser-geolocation provider, the
orchestrator, and the 13 `community_consent_*` message keys are removed. They
implement a permission negotiation that the origin's own policy header forbids.
Deletion happens last, after a fresh reference search.

### 11. Privacy — stated accurately

Stored: city name, country name, ISO-2 country code, city-center coordinates,
visibility, timestamp. Not stored: any device-derived position, and not the
Cloudflare IP-derived `lat`/`lng`, which are read but never written.

The claim is "we store your city, not your location," and the code must make
that literally true rather than approximately true. Round 1 asserted nothing
more precise than a city is ever *obtained*, which was false — `page.data.geo`
carries IP-derived coordinates on every request. Obtained is not stored, and the
copy must say the accurate one.

## Edge cases

| Case | Behavior |
|---|---|
| CF geo absent (local dev, VPN, privacy proxy) | Slot renders `pick` directly |
| CF city present, geocoder finds nothing | Actionable message, falls through to `pick` |
| CF city present, geocoder fails | Distinct retry message; does not claim the city is unknown |
| `ownStatus: failed` | `suggest` with Add disabled plus retry; never `absent` |
| Own document is private | `member`. Public list absence is not evidence |
| Own public document, profile join fails | `member`. Marker may be missing from the map; membership is unaffected |
| `getPublicLocations` throws | Map shows an error state; membership resolves independently |
| Add then Remove, reversed completion | Serial queue; the later intent wins; no resurrection |
| Add A then Add B, reversed completion | Serial queue; B is the final state |
| No Places match for a typed city | Rejection with a message; no write |
| Place has no accepted city component | Rejection with a message; no write |
| API key missing | Existing `community_api_key_required` path; the slot still renders |
| Sign out while member | State invalidates on uid change; slot returns to `guest` |
| Creators roster empty | The band still renders |

## Risks

| Risk | Mitigation |
|---|---|
| Places billing surprise | Two SKUs, 10k free events each per month; current scale is one record. Verify actual SKUs in billing after one real session |
| `PUBLIC_GOOGLE_MAPS_API_KEY` missing from the Pages **build** environment | Pre-ship gate; it is baked at build time, not read at runtime |
| Key not enabled for Places, or referrer-restricted incorrectly | Pre-ship gate against the real restricted key, not a permissive dev key |
| Eager Maps/Places load hidden by a warm cache | Verify in a fresh tab with request logs cleared; assert the absence-to-presence transition by URL |
| The band pushes Creators content below the fold at 1080p | Visual gate with Austen before finalizing height |

## Verification

Per phase, and stated as what would make each check a **false pass**:

1. **State and persistence.** Deferred-promise tests that resolve repository
   promises in deliberately reversed order. *False pass:* mocks that resolve in
   call order cannot expose an out-of-order write; the test must control each
   promise individually.
2. **Loader split.** Assert the exact `importLibrary` calls. *False pass:*
   mocking only the loader's resolved promise passes while `places` still
   imports eagerly.
3. **Canonicalization.** Fixtures for US `locality`, UK `postal_town`,
   administrative fallback, missing country, missing coordinates, ISO-2
   normalization, and the no-accepted-component rejection.
4. **Picker.** Keyboard-only selection issues exactly one canonical add; closing
   mid-`fetchFields` cannot write; superseded responses are discarded; the
   "Powered by Google" attribution is present whenever predictions are shown;
   combobox roles and `aria-activedescendant` track the active option.
5. **Composition.** Network trace in a fresh tab: no Maps request before
   intersection, no Places request before the picker opens.
6. **Visual.** All seven required viewports, measured and screenshotted, with
   all five slot variants confirmed to share one geometry.
7. **Deletion.** Zero references to `getCurrentLocation`,
   `LocationSharingConsentSheet`, `showConsentSheet`, `consentTimer`, and each
   removed message key. *False pass:* grep goes green while a dynamic import
   string still reaches geolocation; confirm at runtime that no geolocation
   access occurs.

## Pre-ship gates (human)

1. Confirm `PUBLIC_GOOGLE_MAPS_API_KEY` is present in the Cloudflare Pages
   **build** environment.
2. Enable the Places API on that key with correct referrer restrictions, and
   verify against the restricted key rather than a permissive one.
3. Visual gate: band height and position within the Creators page, brought with
   frames at 1920 / 2560 / 3840.

## What the earlier rounds got wrong

Kept visible because the pattern matters more than the individual defects:
most were assertions about code that had never been read.

### Round 1

| # | Defect | Found by |
|---|---|---|
| 1 | Claimed the pin's profile handoff "has nowhere to go". It was already wired. Cited the child component, never read the parent that binds it | both |
| 2 | Hand-waved "load lazily" when a shared loader existed | both |
| 3 | Missed `size="embedded"` at a hard 260px colliding with the `em` requirement | author |
| 4 | **Blocker:** a one-field picker cannot feed `forwardGeocode(city, country)` | Codex |
| 5 | Used consent as a proxy for membership across two writes that can diverge | Codex |
| 6 | Claimed nothing more precise than a city is ever obtained, while `page.data.geo` carries lat/lng | Codex |
| 7 | Promised a geocoder error message the geocoder cannot produce | Codex |
| 8 | Left `updateLocation` undesigned | Codex |
| 9 | Assumed a shared slot prevents drift while hosts own everything else | Codex |
| 10 | Miscounted call sites; three stale line ranges | Codex |

### Round 2

| # | Defect | Found by |
|---|---|---|
| 11 | **Blocker:** derived membership from `getPublicLocations()`, which excludes private documents, drops documents whose profile join fails, and is limit-bounded. Membership could disagree with Firestore three different ways | Codex |
| 12 | Generation counters guard reads, not writes. Add-then-remove could resurrect a removed user | Codex |
| 13 | Adding `places` to the shared loader would have made every map mount in **two** features download it. Round 2 also counted one consumer where there are two | Codex |
| 14 | "Restricted to cities" was written without verification and is not an implementation contract. No component-extraction order, no country representation, no rejection behavior | Codex and author |
| 15 | Claimed Autocomplete sessions are unlimited and free. Both SKUs carry 10k monthly free events; the scale conclusion held, the explanation did not | Codex |
| 16 | Specified a Google-rendered custom element inside a themed panel with no supported theming, contrast, focus, touch-target, or clipping story | Codex |
| 17 | Claimed no shared lazy-mount primitive existed. `LazyMount` exists, with exactly the placeholder contract the design needed | Codex |
| 18 | Did not choose a state lifetime, so the panel's root `Crossfade` would have refetched on every profile back-navigation | Codex |
| 19 | Cited a 56-58 person directory census from a July code comment as current ground truth | Codex |
| 20 | Never censused `userLocations`. It holds exactly one document, which makes the country-representation change free | author |

### Round 3 (self-caught, before review returned)

| # | Defect | Found by |
|---|---|---|
| 21 | Specified the headless Places path without checking its policy constraints. A "Powered by Google" attribution is mandatory for programmatic use outside a Google-branded map, and the widget's combobox accessibility becomes the app's to write. Neither was mentioned. Corrected in section 6; the decision stands, the accounting was incomplete | author |
