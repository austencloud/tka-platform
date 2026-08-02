---
status: active
value: 4
effort: M
remaining: 'Entire spec unimplemented as of 2026-08-02. Verified: the "View in coven hub" action is still live at ViewerOverflowMenu.svelte:240, src/routes/coven/ still exists, and src/config/vite-plugin-feature-gate.ts references neither getDisabledRoutePatterns nor BUILD_COVEN — so production and Capacitor bundles still ship the unfinished /coven route and the /test/* page implementations. getDisabledRoutePatterns() exists at feature-flags.ts:432 but has no consumer.'
depends_on: ""
plan_path: ""
tags: [security, build, native, capacitor, release-gating]
last_triaged: 2026-08-02
---
# Native Release Surface Hardening

**Status:** Approved for implementation on 2026-08-01

## Incident

The production sequence viewer exposed **View in coven hub** for every saved
sequence. The link opened `/coven`, an unfinished 3D route with no release gate.
The same implementation was present in the Android web assets.

The production client bundle also retained `/test/*` page implementations even
though the feature registry already classified those routes as development-only.
`getDisabledRoutePatterns()` existed, but the Vite feature-gate plugin never
consumed it for the client build.

## Outcome

Production and native builds must fail closed:

- Coven remains available in the Vite development server and in an explicit
  `BUILD_COVEN=true` build.
- Ordinary production builds do not show the Coven viewer action.
- Direct production navigation to `/coven` redirects to Browse before the page
  renders.
- Direct production navigation to `/test/*` redirects to Browse before a test
  page renders.
- Disabled route components are emptied during the production client build so
  their implementation graphs are not shipped in web or Capacitor assets.
- The Android workflow verifies the release surface after the web build and
  before Capacitor sync.
- The legacy Google review account no longer emits username-validation
  exceptions during authentication.

## Existing Architecture to Extend

No new routing or feature-flag system is needed.

- `src/config/feature-flags.ts` owns build tiers, module paths, and route paths.
- `src/config/vite-plugin-feature-gate.ts` already stubs disabled feature
  components and empties selected SSR route components.
- SvelteKit universal load functions and `redirect()` provide the direct-route
  guard.
- `scripts/lib/firestore-provider.js` provides the established dry-run and
  Admin SDK migration path.
- `scripts/lib/native-push-deploy-core.mjs` is the existing home for pure native
  artifact checks.

The implementation extends those seams. It does not introduce another router,
menu, feature registry, or Firebase bootstrap.

## Design

### Coven build flag

Add `coven` as a `dev` feature with:

- no module-wide stub because the museum reuses `CovenStation`
- route path `src/routes/coven/`
- compile-time constant `__FEATURE_COVEN__`

The shared viewer menu includes the action only when the constant is true. The
route load function uses the same constant and redirects to `/browse/gallery`
when false. This keeps the link, route, and bundle controlled by one decision.

### Disabled client routes

During a production client build, the existing Vite plugin receives guarded
disabled route patterns as its list of components to empty. The initial guarded
set is `/coven` and `/test/*`. Emptying keeps SvelteKit's required route node in
its manifest while severing the page's component import graph.

The route manifest may still name `/coven` or `/test/*`; those nodes contain no
page implementation and their load guards redirect. The release invariant is
that disabled implementation modules and navigation affordances are absent,
not that SvelteKit's generated matcher forgets the pathname.

### Native artifact gate

Add a pure directory scanner beside the existing native ZIP checks. It reports
forbidden production markers found in generated JavaScript. A small command
uses it against `.svelte-kit/cloudflare` and fails on:

- `View in coven hub`
- the `/coven?seq=` navigation target
- Coven page implementation markers that are not shared by the museum

The Android workflow runs the command immediately after `pnpm run build`.
Focused unit tests cover detection, clean output, and missing-build failures.

### Review-account repair

Do not edit `user-document-manager.ts` while another session owns changes in
that file. Add a single-account, dry-run-first migration for Firebase UID
`Tv39DzbAy9O9BZeH5QHmithJ2gC2`.

The migration transaction:

1. verifies the current username is exactly `tkascribe.review_7949`;
2. verifies `tkascribereview7949` is unclaimed or already belongs to the same
   UID;
3. writes the valid username and lowercase field to the user document;
4. creates the valid username claim; and
5. removes the obsolete invalid claim only when it belongs to the same UID.

Apply requires both `TKA_ADMIN=1` and `--apply`. A second run must report that
the account is already repaired and perform no writes.

## Verification

1. Focused unit tests for feature definitions, route guards, client route
   emptying, artifact marker detection, and username repair planning.
2. One full `pnpm run check` captured to a log.
3. One production `pnpm run build`.
4. Run the native release-surface verifier against the built Cloudflare assets.
5. Sync/build the Android artifact when the machine resource gate permits, then
   scan the packaged web assets for the same forbidden markers.
6. In Chrome, verify the development build still shows the Coven action and a
   production preview does not. Direct production `/coven` and `/test/*` loads
   must land on Browse.
7. Run the account migration in dry-run, apply it, run it again, and read the
   resulting Firestore documents to prove the repair is idempotent.

## Risks

- Emptying route components too broadly could blank a shipped route. Only
  registry-declared disabled patterns are consumed, and tests assert the exact
  production list.
- A build override could expose Coven intentionally. `BUILD_COVEN=true` is the
  explicit preview mechanism and is never set in the Android release workflow.
- Username repair could steal another user's claim. The transaction refuses to
  write when the destination claim belongs to a different UID or when the
  source profile has drifted from the expected legacy value.
