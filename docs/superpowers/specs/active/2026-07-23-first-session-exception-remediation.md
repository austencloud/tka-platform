---
status: active
value: 4
effort: S
remaining: "Body status: Implemented and verified locally; application release pending"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# First-Session Exception Remediation

**Date:** 2026-07-23  
**Status:** Implemented and verified locally; application release pending  
**Source:** PostHog session `019f8ccc-c1b2-779f-97d0-d848530e0d69` and
targeted Firestore reads  
**Scope:** Every exception family observed during the July 22-23 first-user
session, plus silent data corruption proven in the same account

## Why this is one program

The session contains 91 exception events, but they collapse into 11 distinct
failure families. Repeated SDK emissions are one defect, not dozens of
unrelated bugs. Each family below has its own trigger, owner, acceptance
criteria, and proof requirement. Related families are grouped into four
implementation packets so fixes can land without cross-module file collisions.

This document is new because searches for `first-session exception`,
`IndexedDB connection lost`, and the exact PostHog session ID found no existing
remediation ledger. It reuses the issue-table and evidence pattern from
`2026-07-18-onboarding-remediation-index.md`.

## Field evidence

| ID    | Observed failure                                         | Count | Primary path              |
| ----- | -------------------------------------------------------- | ----: | ------------------------- |
| EX-01 | IndexedDB connection to the database server was lost     |    43 | `/create/generate`        |
| EX-02 | Firestore missing or insufficient permissions            |    10 | Create, save, and profile |
| EX-03 | Firestore shutting down during Clear Cache               |     9 | `/settings/profile`       |
| EX-04 | `event.key.toLowerCase()` with no key                    |     9 | `/create/generate`        |
| EX-05 | Google sign-in wrapper reported a generic object failure |     6 | Auth surfaces             |
| EX-06 | Audience avatar GLB returned 404                         |     4 | Sequence Viewer           |
| EX-07 | Browser PUT to R2 failed                                 |     4 | Explicit library save     |
| EX-08 | Auth popup blocked                                       |     2 | Auth surfaces             |
| EX-09 | Effect control called `.toFixed()` on an absent value    |     2 | Sequence Viewer effects   |
| EX-10 | Auth popup cancelled                                     |     1 | Auth surfaces             |
| EX-11 | Safari `TypeError: Load failed` after closing the viewer |     1 | `/create/construct`       |

The following silent integrity defects were verified against the same account:

| ID    | Stored state                                         | Canonical state                                |
| ----- | ---------------------------------------------------- | ---------------------------------------------- |
| DI-01 | Root `sequenceCount: 0`                              | One saved sequence exists                      |
| DI-02 | Root `collectionCount: 0`                            | One custom collection exists                   |
| DI-03 | Saved sequence `metadata.length: 0`                  | Six step pairings exist                        |
| DI-04 | `onboarding/status` says incomplete                  | First-run and app-entry documents are terminal |
| DI-05 | Five drafts and two zero-step active sessions remain | Draft/session lifecycle did not close cleanly  |
| DI-06 | No signup or guest-upgrade event                     | The anonymous account became a full account    |

## Implementation disposition

| ID    | Disposition         | Result                                                                                                                           |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| EX-01 | Fixed               | Safari and iOS use localStorage Auth plus memory-backed Firestore, avoiding the failed IDB path.                                 |
| EX-02 | Fixed               | Owner writes retry one token-refresh race; permanent denials still reject.                                                       |
| EX-03 | Fixed               | Clear Cache signs out and stops listeners before Firestore teardown and browser-storage removal.                                 |
| EX-04 | Fixed               | Keydown-shaped events without a usable key stop before shortcut normalization.                                                   |
| EX-05 | Fixed               | Structured Google errors retain their code; unexpected failures are captured once.                                               |
| EX-06 | Fixed               | Production loads immutable, versioned models from the cached `assets.tkaflowarts.com` deployment.                                |
| EX-07 | Fixed               | Saves become durable before thumbnail work; the finished thumbnail patches only its own field.                                   |
| EX-08 | Fixed               | Popup-blocked is a recoverable interaction with direct guidance.                                                                 |
| EX-09 | Fixed               | Both viewer surfaces resolve cross-store FX fields, and numeric formatting rejects absent values.                                |
| EX-10 | Fixed               | Dismissed and superseded popups are silent cancellation outcomes.                                                                |
| EX-11 | Fixed               | The viewer's unhandled 3D chunk imports now use a lifecycle-owned loader with an active retry state and teardown settlement.     |
| DI-01 | Fixed and repaired  | Sequence creation updates its profile count atomically; the affected profile now reads 1.                                        |
| DI-02 | Fixed and repaired  | Custom collection changes use atomic count increments; the affected profile now reads 1.                                         |
| DI-03 | Fixed and repaired  | Save derives both length fields from stored steps; the affected sequence now reads 6/6/6.                                        |
| DI-04 | Fixed and repaired  | One batch writes both onboarding terminal records; the affected record is skipped.                                               |
| DI-05 | Fixed and repaired  | Create uses one shared ID, starts tracking after meaningful work, drains pending draft writes, and completes cleanup atomically. |
| DI-06 | Fixed going forward | Signup and upgrade events wait for PostHog readiness. Historical analytics were not fabricated.                                  |

## Band-aid audit

The first implementation pass was reviewed specifically for fixes that hid a
failure, preserved a race, or described behavior the code no longer performed.

| Finding                                        | Verdict                        | Final treatment                                                                                                                                          |
| ---------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production audience cutoff                     | Band-aid                       | Removed. Production now uses the deployed optimized models and reports a visible load failure instead of an empty success.                               |
| Collection delete pre-count                    | Partial fix                    | Replaced with an atomic decrement in the same Firestore batch as the collection delete.                                                                  |
| Sequence delete follow-up count write          | Partial fix                    | Replaced in both single and multi-delete paths. Each delete batch now includes its matching atomic profile decrement.                                    |
| Thumbnail follow-up full save                  | Unsafe follow-up               | Replaced with a field-level thumbnail update, so a late image cannot overwrite newer sequence edits.                                                     |
| Sequential onboarding writes                   | Partial fix                    | Replaced with one batch using the authenticated UID for both documents.                                                                                  |
| Save progress still showed thumbnail rendering | Stale UI                       | Removed. Foreground progress now matches the durable save stages that actually run.                                                                      |
| Safari memory-backed Firestore                 | Supported fallback             | Retained. It avoids the proven WebKit IndexedDB failure while preserving live network reads and writes.                                                  |
| Exact Firestore-shutdown telemetry filter      | Narrow expected-outcome filter | Retained. Only the two proven teardown signatures are filtered; other failures remain visible.                                                           |
| Effect-value formatter guard                   | Safety backstop                | Retained after fixing the missing cross-store value adapter in both viewer surfaces.                                                                     |
| Generic Safari `Load failed`                   | Concrete owner found           | The viewer's raw 3D `Promise.all(import(...))` had no rejection handler. It now uses the shared lifecycle boundary; no generic error text is suppressed. |
| Create draft/session cleanup                   | Fixed                          | One ID now owns local and cloud records. Completion drains pending cloud writes before atomically closing the session and deleting its draft.            |
| Draft cleanup waited only for IndexedDB        | Resurrection race              | Completion now drains the serialized Firestore draft queue before cleanup, so an older upload cannot recreate the deleted draft.                         |
| SSR Auth initialization relied on a catch      | Hidden initialization failure  | Server rendering omits browser storage and popup dependencies and uses Firebase's supported in-memory fallback.                                          |

## Individual exception specifications

### EX-01: IndexedDB connection loss

**Owner:** Firebase lifecycle and persistence policy.

**Required outcome:**

1. Identify Safari and all iOS browsers before Firebase persistence starts.
2. Use localStorage-backed Auth and memory-backed Firestore for those WebKit
   sessions, so no listener can enter the failed persistent-cache loop.
3. Retain persistent Firestore caching on unaffected desktop browsers.
4. Fall back from localStorage Auth to memory if browser policy blocks storage.

**Proof:** The persistence-policy suite covers desktop Safari, a non-Safari iOS
browser, and desktop Chromium. The full type and Svelte diagnostic pass covers
both Firebase initialization paths.

### EX-02: Firestore permissions during account conversion

**Owner:** Authenticated Firestore operation boundary and user-document
initialization.

**Required outcome:**

1. A write that races anonymous-to-full-account conversion waits for the current
   auth identity and retries only the proven transient permission race.
2. Permanent permission denials remain visible and retain operation context.
3. Creating a root user document never overwrites real subcollection-derived
   counts with zero.
4. Profile updates use the authenticated UID, not a stale preview or anonymous
   identity.

**Proof:** Focused tests cover a first permission denial followed by a refreshed
authenticated retry, a permanent denial, and root-document creation when saved
data already exists.

### EX-03: Intentional Firestore shutdown

**Owner:** Clear Cache and Firebase lifecycle.

**Required outcome:**

1. Clear Cache stops owned listeners before terminating Firestore.
2. The exact expected `Firestore shutting down` result is not reported as an
   application exception.
3. The next Firestore request receives a live instance.
4. Any unrelated error during the reset remains visible.

**Proof:** Account-manager tests order sign-out/listener cleanup, Firestore
shutdown, and browser-storage deletion. The PostHog noise-filter suite accepts
the two exact shutdown signatures and retains unrelated exceptions.

### EX-04: Missing keyboard key

**Owner:** `KeyboardShortcutManager`.

**Required outcome:** A keydown-shaped event with an absent or empty `key` is
ignored before normalization. Valid key events and input suppressors retain
their current behavior.

**Proof:** Dispatch a generic `keydown` event with no `key`; it must not throw or
query the shortcut registry. Existing suppressor tests must remain green.

### EX-05: Google wrapper failure

**Owner:** Social auth UI boundary.

**Required outcome:** A Firebase error keeps its code and message across the
component boundary. Expected popup outcomes are not stringified as
`[object Object]`, and an underlying failure is recorded at most once.

**Proof:** Component/service tests cover structured Firebase errors, an unknown
error, and the success path.

### EX-06: Audience avatar 404

**Owner:** 3D environment visibility and audience preload.

**Required outcome:**

1. Production and development resolve the same six audience models through the
   canonical typed avatar registry.
2. Every canonical avatar model and both seated animations are publicly
   deployed at immutable versioned keys with correct MIME types, source hashes,
   browser CORS, and edge-cache headers.
3. Production never silently substitutes an empty audience.
4. A transient preload failure can retry; a terminal failure settles the scene
   barrier in an explicit degraded state and gives the user a retry path.

**Proof:** Asset-contract tests cover all six canonical audience IDs and both
animations. Live checks cover all 16 canonical avatars plus both seated
animations, compare deployed object length and hash to their upload sources,
validate GLB headers, and exercise production CORS and edge caching.
Scene-feature tests cover failure, settled loading, and retry state.

### EX-07: Browser upload to R2

**Owner:** Thumbnail upload route and save orchestration.

**Required outcome:**

1. Web uploads use the same-origin authenticated Pages route.
2. Native/direct R2 uploads use a bucket CORS rule that exactly covers their
   origin, method, and headers.
3. A thumbnail failure cannot hold the durable sequence write open for minutes
   or report a save that did not persist.
4. A completed thumbnail updates only the thumbnail fields on the current
   local and cloud records. It must not replay the stale sequence snapshot that
   existed when rendering began.
5. Foreground save progress describes only foreground work.

**Proof:** Route and uploader tests cover valid upload, auth rejection, invalid
body, R2 failure, and response shape. A live read-only CORS query must match the
checked-in policy.

### EX-08: Popup blocked

**Owner:** Auth outcome classification.

**Required outcome:** `auth/popup-blocked` is an expected user-recoverable
outcome with direct guidance. It is not logged as an application exception.

**Proof:** Auth UI tests assert the inline message and the absence of an error
log or handled-exception capture.

### EX-09: Missing effect value

**Owner:** Effect control manifest/value resolution.

**Required outcome:** Known cross-store fields receive the same adapter in both
viewer surfaces. Numeric formatting never calls number methods on an absent or
non-finite value, while explicit zero remains zero.

**Proof:** Pure resolver tests cover missing, non-finite, zero, and valid saved
values; the component consumes that resolver.

### EX-10: Popup cancelled

**Owner:** Auth outcome classification.

**Required outcome:** `auth/popup-closed-by-user` and
`auth/cancelled-popup-request` are cancellation outcomes, not platform
exceptions. A later retry remains available.

**Proof:** Auth UI tests assert cancellation does not log or capture an
exception and does not leave the form busy.

### EX-11: Viewer-close load failure

**Owner:** Sequence Viewer asset lifecycle.

**Required outcome:** Viewer teardown may cancel owned requests without leaving
an unhandled rejection. Only an error proven to be an abort/cancellation is
ignored. The generic Safari text `Load failed` must not be globally suppressed.

**Proof:** The shared lazy-loader browser suite covers an active chunk failure,
visible retry, and a rejected load after owner teardown. The production build
contains the contextual `3D viewer canvas` diagnostic and no longer contains
the viewer's raw `Promise.all(import(...))` owner.

The historical event still has one native Safari frame and no request URL, so
telemetry alone cannot prove which request failed. The source audit found a
specific viewer-owned match: `ViewerSplitPane` started the 3D canvas and
performer imports without any rejection handler, and the event happened after
viewer close immediately before a same-page reload. That path now settles late
rejections after teardown. An active failure keeps its context and shows a
retry state. The generic Safari message remains unsuppressed, so unrelated
network failures stay visible.

## Data-integrity specifications

### DI-01 and DI-02: Denormalized counters

The save or collection mutation and its counter update must share an atomic
Firestore boundary. Concurrent collection creates and deletes use atomic
increments rather than a stale read-and-overwrite count. Root-document
initialization must preserve or derive existing counts instead of stamping
zero. A reconciliation command remains the repair path for historical drift.

### DI-03: Sequence length

The persistence mapper derives `metadata.length` from the normalized saved step
array. Caller-provided zero cannot override six stored steps. A round-trip test
must compare stored length and step count.

### DI-04: Onboarding terminal state

App-entry completion and the app-wide onboarding status commit in one batch
under the authenticated UID. Completion and skip are mutually exclusive.
Disabling automatic tours records a skip and must not emit
`onboarding_tutorial_completed`.

### DI-05: Draft and active-session lifecycle

Create must use one session ID for autosave, session analytics, save completion,
and cleanup. A Firestore active-session record is created after meaningful work
begins, or an empty record is reliably abandoned on teardown. Successful save
deletes or closes the correlated draft. Human-readable draft names need
collision-resistant identity beyond second-resolution wall time.

`CreateModule` now mints one collision-resistant ID and passes it to both
`Autosaver` and `SessionManager`. Opening an untouched workspace creates no
cloud session. The first non-empty local autosave creates the matching session
record. Save completion blocks new draft writes, drains the local write and the
serialized Firestore backup queue, removes only the matching local draft, then
uses one Firestore batch to complete the session and delete its cloud draft.
Teardown cannot downgrade a completed session, and a later edit reactivates the
same identity. The five historical drafts remain untouched because they may
contain recoverable work; only the two proven zero-step sessions were marked
abandoned.

### DI-06: Account-conversion analytics

Every anonymous-to-full conversion path emits one
`guest_upgraded_to_account` event after PostHog is ready. A genuinely new
non-anonymous account emits `user_signed_up`. Identity and conversion events
must survive magic-link tab/device handoff without including email in the URL.

## Implementation packets

| Packet | Families                                        | Main ownership                                 |
| ------ | ----------------------------------------------- | ---------------------------------------------- |
| A      | EX-01, EX-02, EX-03, EX-05, EX-08, EX-10, DI-06 | Auth and Firebase                              |
| B      | EX-07, DI-01, DI-02, DI-03                      | Library and persistence                        |
| C      | EX-06, EX-09, EX-11                             | Viewer, 3D assets, and effects                 |
| D      | EX-04, DI-04, DI-05, historical repair          | Shared input, onboarding, and Create lifecycle |

## Research basis

- Firebase documents persistent multi-tab web caching and the memory-cache
  alternative in [Access data offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
- Firebase documents atomic cross-document writes in
  [Transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions).
- Cloudflare requires browser presigned-URL uploads to match bucket CORS origin,
  method, and headers in
  [Configure CORS](https://developers.cloudflare.com/r2/buckets/cors/).
- Cloudflare documents `r2.dev` as a rate-limited development endpoint and
  requires a custom domain for Cache in
  [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
- Cloudflare's default cache eligibility is extension-based and includes
  `.bin`, which is why the immutable binary model and animation objects end in
  `.glb.bin` and `.fbx.bin` while retaining their correct content types. See
  [Default Cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/).
- The UI Events specification defines `key` as a string and gives an empty
  string as the uninitialized value, so an event with no usable key has no
  shortcut meaning. See [UI Events](https://w3c.github.io/uievents/).
- MDN documents that a failed dynamic-module fetch rejects the `import()`
  promise with a browser-defined `TypeError`. See
  [Dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import).
- Firebase documents that Auth initialization without an explicit persistence
  dependency falls back to in-memory persistence. See
  [Auth dependencies](https://firebase.google.com/docs/reference/js/auth.dependencies).

## Release state

The immutable 3D objects and `@austencloud/scene-3d@0.1.6` are deployed. The
current local application build consumes those versioned assets and contains
the viewer lifecycle fix. The production site still serves its previous
application chunks. This checkout contains unrelated work from several active
sessions, so deploying the entire generated bundle would publish changes
outside this remediation. No application deploy was made from that mixed
source state.

The final follow-ups are recorded as completed internal feedback:

- `bQOQs5N5UHCdLLDk7ttD`: Create draft and session lifecycle
- `igmU40B22CwfFFaL0KoA`: 3D viewer chunk failures and teardown
- `T6Gs9gNDsEUZlcB8M47i`: Firebase Auth browser persistence during SSR

## Verification results

1. Combined auth, PostHog, save, counters, thumbnails, onboarding, effects,
   keyboard, and 3D regression run: 41 files, 274 tests passed.
2. Current lifecycle regression runs: 3 unit files, 16 tests passed; the
   shared lazy-loader browser file, 2 tests passed.
3. `@austencloud/scene-3d@0.1.6`: loader retry test passed, package
   `svelte-check` reported 0 errors and 0 warnings, and the package build
   succeeded.
4. Full app `pnpm check`: 0 errors and 4 unrelated existing CSS warnings.
5. The final Cloudflare production build completed successfully. A Firebase
   Auth assertion exposed by the first build was traced to browser persistence
   during SSR; the server path was corrected and the second build emitted no
   assertion.
6. The `assets.tkaflowarts.com` R2 custom domain is enabled with active
   ownership and SSL. Public `GET`/`HEAD` uses wildcard CORS; app and local
   origins receive `PUT` only.
7. All 16 avatar GLBs and both seated-animation FBXs in
   `v2026-07-23-r1` returned 200. Content lengths and ETags matched their local
   sources, MIME types were correct, cache policy was one-year immutable, and
   every object reached a Cloudflare `HIT` on the second full GET.
8. The app resolves `@austencloud/scene-3d` to published version `0.1.6`; its
   canonical avatar registry and the seated-animation registry use the same
   immutable namespace.
9. The built application has zero unversioned audience-model paths. Its
   audience chunks use `assets.tkaflowarts.com` and `v2026-07-23-r1`, and the
   viewer chunk contains the contextual 3D load boundary.
10. Admin SDK verification: profile counts match 1 sequence and 1 custom
    collection; `metadata.length`, `sequenceLength`, and pairing count are all
    6; onboarding is terminal; both empty sessions are abandoned; 5 drafts
    remain.
11. No interactive browser verification was performed because permission was
    not granted.
