# Community Map: Invitation, Not Interrogation

**Date:** 2026-08-25
**Status:** Design — round 4, revised after three independent review passes
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

Round 3 was reviewed. That pass found no blocker — the first round without one
— but it found two genuine bugs and a set of corrections that round 4 applies:

- **A single Firestore write, not two.** Round 3's review asked whether the
  non-atomic `saveLocation` + `savePreferences` pair needed partial-failure
  recovery "or removal, if nothing still consumes preferences." Checking
  settled it: nothing does (Ground truth 25). The preferences write is deleted,
  Add becomes one write, and the atomicity question dissolves instead of being
  answered.
- **The loader's configuration must be lifted out of `load()`**, or a
  picker-before-map ordering runs Places unconfigured (Ground truth 26).
- **The persisted country name must pin its locale**, or the same country is
  stored under three spellings depending on who added it — and the CF `XX`
  sentinel silently becomes a country named "XX" while `T1` throws
  (Ground truth 28).
- **`GlobalUserMap` has three hosts**, so the shared `size="embedded"` variant
  is left alone rather than "converted" (Ground truth 24).

Two of the review's recommendations are **not** adopted, with reasons recorded
in place: `Home`/`End` interception (ARIA APG makes it optional and the native
text-cursor behavior is sanctioned — Ground truth 30), and "remove always wins"
in the mutation queue (the invariant is chronological ordering; a later add is
a legitimate change of mind).

Errors from all prior rounds are listed at the end. Several were assertions
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
| 12 | The **loader** has **two** consumers: the community map and `FestivalMap`. This row counts loader consumers only — see row 24 for map consumers | `GlobalUserMap.svelte:51`; `FestivalMap.svelte:30` |
| 13 | `LazyMount` is a shared primitive for deferred chunk loading with an SSR-rendered same-footprint `placeholder`, `prefetch`, and error/retry | `src/lib/shared/components/LazyMount.svelte` |
| 14 | No shared IntersectionObserver / in-view owner exists. `LazyMount` governs *when code is fetched*, not visibility, and does not observe intersection | `LazyMount.svelte:15-19` |
| 15 | `GlobalUserMap` has a `size="embedded"` variant at a hard `height: 260px`. Round 3 called it unused; it is reachable from the three hosts in row 24, so this design does not modify it | `GlobalUserMap.svelte:40-41,278-279` |
| 16 | `country` is rendered directly to users as "city, country" | `UserProfileMarker.svelte:59-64`; `GlobalUserMap.svelte:138` |
| 17 | `CreatorsPanel` ramps its own `font-size`; descendants must size in `em`, never `rem` | `CreatorsPanel.svelte:14-25` |
| 18 | `forwardGeocode(city, country)` takes two arguments and returns coordinates only; every failure collapses to `null` | `geocoding-service.ts:87-89,96-121` |
| 19 | `userLocations`: public read, `isOwner && isFullUser` write, owner/admin delete | `firestore.rules:2001-2014` |
| 20 | **Census:** `userLocations` contains exactly one document — Chicago, `country: "United States"` (long name), `visibility: "public"`, created 2026-01-18 | Firestore query, 2026-08-25 |
| 21 | The `(cities)` type collection is valid for `includedPrimaryTypes` in Autocomplete (New) and maps to `locality` or `administrative_area_level_3`. A type collection **cannot** be combined with any other type; doing so returns `INVALID_REQUEST` | [Place Types (New)](https://developers.google.com/maps/documentation/places/web-service/place-types) |
| 22 | `AutocompleteSuggestion.fetchAutocompleteSuggestions()` returns predictions as data, for a caller-rendered UI. `AutocompleteSessionToken` is created and refreshed manually on this path | [Autocomplete Data API](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data) |
| 23 | `addressComponents` and `location` are **Place Details Essentials** fields. `displayName` is **Pro** | [Place data fields](https://developers.google.com/maps/documentation/javascript/place-class-data-fields) |
| 24 | `GlobalUserMap` has **three** hosts | `Community.svelte:208`; `ActiveUsersPanel.svelte:273`; `ScanActivityTab.svelte:228` |
| 25 | The community `locationSharing` preferences document has **no consumer** outside the orchestrator this design deletes. `PulseDashboard.svelte:308` calls a same-named `getPreferences` imported from a different module | `PulseDashboard.svelte:29-32,308`; grep of `hasConsented`/`savePreferences` |
| 26 | The loader's API-key configuration (`setOptions`, key checks, `this.apiKey`) lives **inside `load()`**, so a `loadPlaces()`-first call would run unconfigured | `GoogleMapsLibraryLoader.ts:41-56` |
| 27 | Attribution for Places data shown outside a Google map is the **Google Maps** logo, or the text `Google Maps` when space is limited. It must not be localized, and the policy names `translate="no"`. "Powered by Google" is not an accepted form | [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) |
| 28 | **Measured:** `Intl.DisplayNames` region conversion returns `"XX"` unchanged for the CF unknown sentinel (no throw) and **throws `RangeError`** on `T1`. Default locale resolution yields `United States` / `Vereinigte Staaten` / `États-Unis` for the same input | `node -e` run, 2026-08-25 |
| 29 | `UserSearchInput` has **no** `Home`/`End` handling, **no** `isComposing`/`compositionend` handling, and **no** `dir`/RTL handling | grep of `UserSearchInput.svelte`; key handler at `:159-195` |
| 30 | ARIA APG makes `Home`/`End` **optional** for a combobox, and for an editable one "places the cursor on the first character" is a sanctioned behavior | [APG combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) |

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

Round 3's review found three gaps in that description. All three are real.

**Latest-intent is chronological, and remove does not automatically win.** The
rule is "the last thing the user asked for happens," full stop. For
`add A → add B → remove`, remove wins because it is last. For
`remove → add C`, **C wins** — the user removed themselves and then changed
their mind, and honoring the remove would discard a later explicit choice.
Round 3 half-implied remove should always win; it should not. The invariant is
ordering, not operation priority.

**The queue needs auth-generation cancellation, not just uid invalidation.**
"The module invalidates on uid change" does not cancel work already queued: a
queued closure captured uid A, and invalidating module state does not reach
inside it. Sign out plus sign in as B while an add for A is queued would write
A's document after B is active. Every mutation therefore carries the uid **and**
the auth generation it was created under, and revalidates both against the live
values *immediately before* issuing its write, inside the same synchronous step
as the write call. A mismatch is a discard. Invalidation bumps the generation,
so every in-flight and queued mutation for the old identity dies at its own
check rather than depending on a teardown reaching it.

**A discarded mutation must be visible, not silent.** The user pressed a button;
it cannot simply do nothing. Every mutation resolves to an explicit
discriminated result:

```ts
type MutationOutcome =
  | { status: "applied"; intent: number }
  | { status: "superseded"; intent: number }
  | { status: "failed"; intent: number; error: unknown };
```

The slot keys its rendering to the **latest** intent number, not to whichever
result arrives last. A `superseded` outcome for a stale intent changes nothing
on screen — correct, because a newer intent already owns the display — while a
`superseded` outcome for the latest intent is a bug the phase's test asserts
cannot happen. A `failed` outcome restores the prior state and surfaces a retry.
Without this, the discard path and the success path are indistinguishable from
the outside, which is the same class of defect as `getLocation` swallowing
errors to `null`.

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
                    -> Intl.DisplayNames("en") for the country name
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
              saveLocation(uid, ...)        <- one document, one write
```

There is one write path, and at the persistence boundary it is now literally
one write. "Change city" is `addCity` with a different canonical input, not a
separate `updateLocation`.

**The preferences document is dropped.** Round 3 wrote `saveLocation` plus
`savePreferences`, which made Add two non-atomic writes that could leave the
two documents divergent. That redundancy is unnecessary:

- `hasConsented` is meaningless once membership is the existence of the
  location document.
- `visibility` already lives on the location document itself
  (`UserLocation.visibility`).
- The only reader of the community preferences document is
  `location-sharing-orchestrator.ts`, which this design deletes.
  (`PulseDashboard.svelte:308` calls a same-named `getPreferences` imported from
  `features/feedback/services/notification-preferences-manager` — a different
  module and a different document. It is not a consumer.)

**Deleting it removes a latent divergence, not just dead weight.** The
`userLocations` security rule gates reads on `resource.data.visibility` — the
**location** document's field (Ground truth 19). The preferences document
carried its own `visibility` copy (`user-location-repository.ts:129`) that
nothing enforced against it. Two mutable copies of one privacy setting, with
the security boundary trusting only one of them, is a bug waiting for a partial
write. Dropping the mirror leaves exactly one `visibility`, and it is the one
the rule reads.

The `/settings/{settingId}` rule is generic — only `featureOverrides` is
special-cased (`firestore.rules:439-448`) — so removing this document needs no
rules change.

So `savePreferences`, `getPreferences`, `preferencesPath`, `PreferencesSchema`,
and `LocationSharingPreferences` all become dead with the orchestrator and are
removed in the deletion phase. The one existing user's orphaned preferences
document is left in place, unread.

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

No match is a rejection with an actionable message, not a silent write.

Round 3's review cut levels 2 and 1 off the end of this list, and it is right.
`(cities)` returns places whose primary type is a city, so a result reaching
level 2 or level 1 means the components did not describe a city at all. Writing
a county or a state into a field named `city` produces a marker labeled
"Illinois, United States" sitting on a state centroid. Rejecting is the honest
outcome: the user picks again, or the picker says it cannot place that result.

**Country.** Round 2's review caught a real inconsistency: CF supplies ISO-2
(`"US"`), the legacy reverse-geocoder wrote a long name (`"United States"`), and
`country` is rendered directly to users (Ground truth 16). "Chicago, US" is a
worse marker label than "Chicago, United States".

Both are kept, and both paths produce both:

- `country` — long display name. Places: the country component's `longText`.
  CF: `Intl.DisplayNames` with `type: "region"`, **locale pinned to `"en"`**.
- `countryCode` — ISO-2, additive and optional. Places: the country component's
  `shortText`. CF: the value as given.

**The locale must be pinned, and the CF sentinels must be rejected.** Round 3's
review flagged both; measured behavior on this machine's Node build confirms
them and is worse than described:

| Input | `Intl.DisplayNames(undefined)` | Pinned `"en"` |
|---|---|---|
| `US` under an `en-US` viewer | `United States` | `United States` |
| `US` under a `de` viewer | `Vereinigte Staaten` | `United States` |
| `US` under a `fr` viewer | `États-Unis` | `United States` |
| `XX` (CF unknown) | returns `"XX"` — no throw | same |
| `T1` (CF Tor exit) | **throws `RangeError`** | same |

Default locale resolution means the persisted string would depend on whoever
happened to add the city, so the same country would appear under three
different names on one map. The locale is fixed at `"en"` because `country` is
a stored value shared across all viewers, not a per-viewer rendering. If the
map is ever localized, it localizes from `countryCode` at render time, which is
the field that carries the meaning.

`XX` is the dangerous one: it does not throw, so an unguarded call writes the
literal string `"XX"` as a country name. The conversion therefore rejects the
sentinels `XX` and `T1` explicitly **before** the call, wraps the call in
try/catch for `T1`-shaped throws, and treats `of(code) === code` as a failure
rather than a name. A rejected country means the CF path does not offer a
one-tap suggestion at all and the user goes to the picker.

**`countryCode` is not free.** Round 3's review is right that
`UserLocationSchema`'s `.passthrough()` is insufficient on its own. Passthrough
preserves unknown keys through *validation*, but `getPublicLocations()` builds
its joined result by explicit field-by-field assignment
(`user-location-repository.ts`), so any field not named there is dropped before
it reaches a consumer. The field therefore needs three coordinated changes, not
one: the `UserLocation` type, the Zod schema, and the explicit mapping in the
join. All three land in the same phase.

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

- **A Google Maps attribution is mandatory, and the wording is specific.**
  Displaying Places data in the app's own UI rather than inside a Google map
  requires the attribution. The prediction list is not inside the map canvas,
  so the picker carries the mark.

  Round 3's review corrected the wording, and re-checking the policy confirms
  the correction: **"Powered by Google" is wrong and is not an accepted form.**
  The policy requires the Google Maps logo where space allows, with the text
  `Google Maps` acceptable when space is limited. It must not be localized or
  machine-translated, and the policy names the mechanism: the element carries
  `translate="no"`.

  So: the string is `Google Maps`, it renders with `translate="no"`, it is not
  routed through any localization path, and it sits with the prediction list —
  not hidden behind a disclosure. Source:
  [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).
- **Full combobox accessibility**, which TKA already owns. See below.

**Primitive discovery: extending, not creating.**

Searched `role="combobox"`, `aria-activedescendant`, `role="listbox"`,
`*search*.svelte`, `*autocomplete*.svelte`, `*typeahead*.svelte`,
`*combobox*.svelte`.

`src/lib/shared/user-search/UserSearchInput.svelte` is a complete
async-suggestion combobox and already implements, correctly, every behavior
this picker needs:

| Behavior | Where |
|---|---|
| Debounced input, minimum query length | `:88-131` |
| **Sequence-tagged requests, superseded responses discarded** | `:85,113,120,127` |
| Sequence invalidated on select and on destroy | `:135,257-260` |
| Arrow up/down with wraparound, Enter, Escape | `:159-195` |
| `scrollIntoView({ block: "nearest" })` for the active option | `:153-157` |
| `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant` | `:260-265` |
| `role="listbox"` / `role="option"`, roving `tabindex="-1"` | `:299-313` |
| Live region announcing result count and the empty state | `:285-295` |
| `useFixedPosition` dropdown that escapes an ancestor's `overflow: hidden` | `:196-203` |

Section 6 of round 3 originally specified all of this as new work. It is not
new work. The sequence-tagged discard is the same mechanism this spec derived
from scratch, and `useFixedPosition` directly answers the clipping risk, which
is not hypothetical: this panel's `overflow: hidden` has already clipped a
control off its edge once (`CreatorsPanel.svelte:835-836`).

The component hardcodes only two things: its data source
(`searchUsersService`) and its row rendering.

**Decision: extract, do not create.** `never-hand-roll.md` forbids a fourth
parallel implementation, and the codebase already carries several
(`PerformerSearchInput`, `UserSearch`, `AdminSearchBox`, `MediaSearchBar`).
The generic behavior moves to a shared owner; the data source and row
rendering become injectable; `CommunityCityPicker` composes it with Places as
the source.

`UserSearchInput` keeps a **byte-identical public prop signature** and
delegates internally. Its seven consumers — `AnnouncementForm`,
`AdminToolbarDesktop`, `AdminToolbarMobile`, `GroupSettingsSheet`,
`NewMessageSheet`, `SendAttachmentSheet`, `ShareCollectionSheet` — are not
edited, and their unchanged compilation plus behavior is the extraction's
verification. A shared owner with one consumer would be Create wearing a
different label, which is why the migration is part of the same phase rather
than deferred.

This is recorded in `canonical-capabilities.md` as the owner for
async-suggestion comboboxes.

**What the extraction adds, and what it deliberately does not.** Round 3's
review listed three behaviors `UserSearchInput` lacks. Grepping the file
confirms all three are genuinely absent. Two are added; one is rejected with a
reason.

- **IME composition — added.** There is no `isComposing` or `compositionend`
  handling anywhere in the file. The debounce fires on every `input` event, so
  a user typing Japanese, Chinese, or Korean issues billable Places requests
  against half-composed intermediate text that matches nothing. The extracted
  owner skips the search while `event.isComposing` is true and runs once on
  `compositionend`. This is a live bug in the existing seven consumers that the
  extraction fixes for all of them at once.
- **RTL — added.** No `dir` handling and no logical properties. The dropdown's
  offset math and the row layout use logical properties in the extracted owner.
- **Home/End — deliberately not hijacked.** The review recommended adding them.
  Checking the ARIA APG combobox pattern shows both keys are **optional**, and
  that for an editable combobox "returns focus to the combobox and places the
  cursor on the first character" is one of the two sanctioned behaviors. That
  is exactly what the native text input already does. Intercepting Home/End to
  jump between options would take a working text-editing affordance away from
  every user in order to add a redundant one. The native behavior stays.
  Source: [APG combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).

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

**The bootstrap must be extracted first, or `loadPlaces()` breaks.** Round 3's
review caught this and the current code confirms it. Today the entire
configuration step — the empty-key rejection, the different-key rejection, the
`setOptions({ key, v, loading })` call, and the `this.apiKey` assignment — lives
*inside* `load()`. `loadPlaces()` can be called first, because the picker can be
opened before the map ever intersects the viewport. On that ordering
`setOptions` has never run, so `importLibrary("places")` executes with no key
configured and fails.

The fix is to lift that block into a **synchronous** private
`ensureConfigured(apiKey: string): void` that both entry points call before
touching their own memoized promise. Synchronous matters: if configuration were
itself a promise, two concurrent calls could interleave between the key check
and the `setOptions` call. A synchronous function runs to completion inside one
task, so the first caller configures and every later caller sees the settled
state regardless of arrival order.

Each entry point then memoizes independently — `loadPromise` and
`placesPromise` are separate fields with separate null-on-failure resets, so a
Places failure never poisons the map's memo and vice versa. Order-independence
is a stated requirement of the phase, not an accident of the current call
sites, and it is what the phase's test asserts: `loadPlaces()` first, then
`load()`, both resolve.

### 8. Sizing and the map mount

`GlobalUserMap`'s `size="embedded"` variant is a hard `260px` (Ground truth 15),
frozen at 1080p proportions inside a panel that ramps its own font size (Ground
truth 17).

**The shared variant is not touched.** Round 3's review flagged Ground truth 12
as understating the blast radius, and checking confirms it: `GlobalUserMap` has
**three** hosts, not the two the loader has — `Community.svelte:208`,
`ActiveUsersPanel.svelte:273`, and `ScanActivityTab.svelte:228`. Ground truth 12
counted loader consumers and was read as if it counted map consumers.

Round 3 said the unused variant would be "converted rather than left as a
trap." That was wrong twice over: the variant is not unused, and converting it
would silently change the height of three surfaces this feature has no business
touching and will not be screenshotting. **The experience owns its own height**
and passes it down; `size="embedded"` keeps its current `260px` and its three
existing hosts render byte-identically. Ground truth 15 is corrected to say
"used by three hosts," and Ground truth 12 is corrected to say it counts loader
consumers only.

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

**Two different equality requirements, and round 3 conflated them.** Round 3
wrote as if one rule covered both; the review is right that it does not.

- **The `LazyMount` placeholder reserves the whole band — map *and* slot.**
  The deferred chunk contains both, so a placeholder sized to the map alone
  collapses the slot's height until the chunk lands and shoves every band below
  it down on arrival. This is the CLS case `LazyMount`'s SSR placeholder exists
  to prevent, and getting it wrong produces exactly the shift the primitive was
  adopted to avoid.
- **The five-state identical-geometry rule (Section 3) applies to the slot
  only.** The map's height is fixed and independent; it does not vary by slot
  state. Requiring the map to participate in five-way geometry equality would
  be meaningless, and stating it that way obscures the real constraint, which is
  that `unresolved`, `guest`, `suggest`, `pick`, and `member` must not resize
  the band relative to each other.

The band's reserved height is therefore `map height + slot height`, where the
slot height is the measured maximum across all five states, including
`pick` with the picker open. The picker is the tallest state, so it sets the
floor; it does not push the band taller when it opens.

### 9. Guests

Guests see the map and the count, and a sign-in invitation in the slot. The
Firestore rules already require `isFullUser()` to write (Ground truth 19); the
UI simply matches the rule instead of failing at the write.

### 10. Deletions

The undismissible consent sheet, the browser-geolocation provider, the
orchestrator, and the 14 `community_consent_*` message keys are removed. They
implement a permission negotiation that the origin's own policy header forbids.

The community preferences API goes with them: `savePreferences`,
`getPreferences`, `hasConsented`, `preferencesPath`, `PreferencesSchema`, and
`LocationSharingPreferences`. Ground truth 25 establishes the orchestrator is
their only consumer. The one existing user's orphaned
`users/{uid}/settings/locationSharing` document is left in place, unread — a
stale document costs nothing, and a cleanup migration for a single row is
ceremony.

Deletion happens last, after a fresh reference search. The search must include
`getPreferences` by name and check each hit's **import path**, because a
same-named function exists in `features/feedback/services/notification-preferences-manager`
and matching on the bare identifier would produce a false consumer.

### 11. Privacy — stated accurately

Stored: city name, country name, ISO-2 country code, city-center coordinates,
visibility, timestamp. Not stored: any device-derived position, and not the
Cloudflare IP-derived `lat`/`lng`, which are read but never written.

The user-facing string is **"We store your city and its map point, never your
device location."** Round 3's review flagged the earlier phrasing, "we store
your city, not your location," and it is right: the app *does* store a
lat/lng, so a flat "not your location" invites the reading that no coordinates
exist at all. The accurate distinction is not city-versus-coordinates, it is
**city-center coordinates versus device coordinates**. The copy says which one,
because the whole point of this section is that the claim survives someone
opening the Firestore document and checking.

The code must make that literally true rather than approximately true. Round 1 asserted nothing
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
   promises in deliberately reversed order, covering `add A / add B / remove`
   (remove wins) and `remove / add C` (C wins). Assert a mid-flight uid change
   discards the queued mutation for the old identity, and that every mutation
   resolves to an explicit `applied` / `superseded` / `failed` outcome.
   *False pass:* mocks that resolve in call order cannot expose an out-of-order
   write; the test must control each promise individually. Second false pass:
   asserting only the final Firestore state, which is identical whether a stale
   mutation was discarded or simply never scheduled.
2. **Loader split.** Assert the exact `importLibrary` calls, **and** assert
   `loadPlaces()`-then-`load()` resolves as well as `load()`-then-`loadPlaces()`.
   *False pass:* mocking only the loader's resolved promise passes while
   `places` still imports eagerly; and testing only the map-first ordering
   passes while the picker-first ordering runs unconfigured (Ground truth 26).
3. **Canonicalization.** Fixtures for US `locality`, UK `postal_town`,
   `administrative_area_level_3`, missing country, missing coordinates, ISO-2
   normalization, the no-accepted-component rejection, a level-2/level-1-only
   result (must reject, not write a county as a city), and the CF sentinels
   `XX` and `T1`. Assert the country name is locale-pinned: the conversion
   returns `United States` while the process locale is `de`. *False pass:*
   running the suite only under an `en` locale, which makes the pin invisible.
4. **Picker.** Keyboard-only selection issues exactly one canonical add; closing
   mid-`fetchFields` cannot write; superseded responses are discarded; the
   `Google Maps` attribution renders with `translate="no"` whenever predictions
   are shown; combobox roles and `aria-activedescendant` track the active
   option; an `isComposing` input event issues no request. *False pass:*
   asserting the attribution element merely exists, while it is hidden, sits
   outside the prediction list, or carries the wrong string.
5. **Composition.** Network trace in a fresh tab: no Maps request before
   intersection, no Places request before the picker opens.
6. **Visual.** All seven required viewports, measured and screenshotted, with
   all five slot variants confirmed to share one geometry — including `pick`
   with the picker open, which is the tallest. Separately confirm the
   `LazyMount` placeholder reserves map **and** slot: nothing below the band
   moves when the chunk lands. *False pass:* comparing only the settled states
   to each other and never observing the placeholder-to-loaded transition.
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
| 21 | Specified the headless Places path without checking its policy constraints. An attribution is mandatory for programmatic use outside a Google-branded map. Corrected in section 6; the decision stands, the accounting was incomplete. **Round 3's review then corrected the correction:** the required form is the Google Maps logo or the text `Google Maps` with `translate="no"`, and "Powered by Google" is not an accepted form at all (see defect 23) | author, then Codex |
| 22 | Then claimed the widget's combobox accessibility "becomes the app's to write" — without searching for it. `UserSearchInput` already implements all of it, including the same sequence-tagged discard this spec derived independently, and a fixed-position dropdown that answers the clipping risk. This is the third consecutive round in which the spec asserted something did not exist without grepping for it (round 2 did it with `LazyMount`) | author |

### Round 3 (found by review)

The first round with no blocker. Two genuine bugs, and a set of corrections.

| # | Defect | Found by |
|---|---|---|
| 23 | The attribution string was wrong. "Powered by Google" is not an accepted form; the policy requires the Google Maps logo, or the text `Google Maps` with `translate="no"` and no localization. Round 3 had verified that attribution was *required* without verifying *what it says* | Codex |
| 24 | **Bug:** the loader's API-key configuration lives inside `load()`, so the specified `loadPlaces()` would run unconfigured whenever the picker opens before the map intersects. Fixed by lifting a synchronous `ensureConfigured` out of `load()` | Codex |
| 25 | **Bug:** `Intl.DisplayNames` was specified without pinning a locale, so the persisted country name would vary by whoever added it. Measuring it found worse: `XX` returns `"XX"` silently and `T1` throws | Codex, measured by author |
| 26 | Called `size="embedded"` unused and proposed converting it. `GlobalUserMap` has three hosts; the variant is reachable, and converting it would have silently resized three unrelated surfaces | Codex |
| 27 | Specified `saveLocation` + `savePreferences` as one logical write when they are two non-atomic ones. The review's alternative — delete preferences if nothing consumes them — turned out to be the right one | Codex |
| 28 | Left `administrative_area_level_2` and `_1` in the city fallback chain, which would write a county or a state into a field named `city` | Codex |
| 29 | Described one geometry-equality rule where there are two: the placeholder reserves map plus slot, while the five-state equality applies to the slot alone | Codex |
| 30 | Missed that `countryCode` needs an explicit entry in `getPublicLocations()`'s join mapping. `.passthrough()` preserves unknown keys through validation, but the join rebuilds its result field by field | Codex |
| 31 | Missed that `UserSearchInput` has no IME composition handling, so the debounce fires on half-composed CJK input. A live bug in seven existing consumers, fixed by the extraction | Codex |
| 32 | Said the mutation queue's uid invalidation cancels queued work. It does not reach inside a closure that already captured a uid; the mutation must revalidate uid and auth generation at its own write | Codex |
| 33 | Specified discard-on-supersede with no observable outcome, leaving a pressed button indistinguishable from a no-op | Codex |
