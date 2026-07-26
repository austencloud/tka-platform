---
status: active
value: 3
effort: S
remaining: "Unscored until triage 2026-07-25; spec body carries no status line. Needs a read-through to establish real state before this score is trusted."
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Titanium Hardening — Audit Wave 2 (2026-06-28)

Six adversarial auditors swept the pipelines the first wave didn't reach:
pictograph/positioning, sequence-engine/generation, gamification, payments/commerce,
auth/application, and export/render/deck. Every finding below was traced to its
canonical source by the auditor. This doc is the triage + backlog.

## Shipped this wave (verified, low-risk)

- **variation cache invalidation** — `shared/browse/services/variation-grouper.ts`. Cache was keyed only on the id set; a rename with the same id set returned stale variation groups. Fold the grouping key into the signature. (branch `claude/hardening-correctness-2-tr5zsf`)
- **boot-snapshot clear on sign-out** — `shared/auth/state/auth-state.svelte.ts`. The `"tka-boot-snapshot"` key (hyphen) escaped signOut's `tka_/auth/session` purge and `clearBootSnapshot()` had zero callers → stale premium tier flashed on reload for a now-guest. (same branch)
- **guest Create-tab gate in mobile nav** — `shared/navigation-coordinator/navigation-coordinator.svelte.ts`. The `create` branch omitted the `isTabAccessible()` guest gate the browse/default branches apply → guests saw Fuse on mobile. (same branch)
- **merch order unitPrice** — `firebase-functions/src/merch/handleMerchWebhook.ts`. Recorded `amount_total` (incl. shipping+tax) as the per-unit price. Now `amount_subtotal`. (branch `claude/hardening-commerce-tr5zsf`, PR flagged for review — payment path.)

## FLAGGED — confirmed but NOT auto-fixed (need verification I can't do headless)

These are real. They're held because the fix touches TKA **domain logic** (positioning/generation — the project's enforced `verify-at-canonical-source` / `mcp-ground-truth` zone), a **production payment path**, or **auth/print behavior** that can't be confirmed without runtime/visual/2-device testing. Fix each deliberately, with the matching verification.

### Pictograph / arrow positioning (needs MCP + visual verification)

- **[CONFIRMED] Float directional-tuple branches are dead → CW-handpath floats get the CCW adjustment transform.** `shared/pictograph/arrow/positioning/calculation/services/directional-tuple-processor.ts:75-94` (diamond) and `:133-153` (box). Both float branches index start/end into an `order` array that's swapped vs the grid the branch handles, so `indexOf` returns `-1`, the `cwStep` branch is unreachable, and every float takes the `else`/CCW tuple. Diamond float N→E (a CW handpath) with base `(10,0)` yields `(0,-10)` instead of `(10,0)` — 90° wrong — and WASD-nudging any CW float moves it the wrong way. Fix: use the grid-appropriate order per branch, or replace the inline `(idxStart+1)%4` derivation with the already-correct `calculateHandpathDirection(motion.startLocation, motion.endLocation)`. **Verify against MCP/canonical + a visual before/after on a float pictograph.**
- **[CONFIRMED] `getDiagnostics` legacy ori-bucket computed from the resolved key, not the raw key.** `arrow-adjustment-calculator.ts:256` (and `:356`) — `mapToLegacyBucket(oriKey)` where `oriKey` is already resolved to `from_layer1` for staff+staff, producing `from_layer2`. The render path (`special-placer.ts:98-101`) uses `mapToLegacyBucket(rawOriKey)`. Diagnostics-only, BUT confirm the Inspect/WASD tool doesn't use the diagnostics result to choose which tier it *writes* to before fixing.
- **[CONFIRMED] `getDiagnostics` special-override key uses `"(0, 0)"` instead of canonical `"0,0"`.** `arrow-adjustment-calculator.ts:322` (and dead `:619`) — builds the key from `String(jsonResult.turnsTupleKey)` (parenthesized) while the render path / `computeSpecialOverrideKey` uses `generateTurnsTuple(pictographData).join(",")`, so the probe never matches a stored override. Same diagnostics-vs-write caveat as above.

### Loop-executor validation sets (generation domain — verify against MCP/position maps)

- **[CONFIRMED] SWAPPED_INVERTED validates against `INVERTED_LOOP_VALIDATION_SET` (wrong) → rejects UI-offered partials AND breaks loop closure.** `features/create/generate/circular/services/swapped-inverted-loop-executor.ts:109`. The UI gate offers it via `SWAPPED_LOOP_VALIDATION_SET`; the executor requires start==end, so `alpha3→alpha7` (offered) throws. Closure math confirms SWAPPED is the correct gate (ends at `SWAPPED(SWAPPED(P))==P`). Fix: use `SWAPPED_LOOP_VALIDATION_SET`.
- **[CONFIRMED] ROTATED_SWAPPED validates against the pure-rotation set instead of rotated-then-swapped.** `rotated-swapped-loop-executor.ts:121`. UI offers via `ROTATED_SWAPPED_{QUARTERED,HALVED}_VALIDATION_SET` (end == `SWAPPED(ROTATED(start))`); executor uses `QUARTERED_LOOPS`/`HALVED_LOOPS`, so offered pairs throw. Fix: use the rotated-swapped sets.
- **[PLAUSIBLE/latent] `LOOPType.MIRRORED_ROTATED_SWAPPED` unhandled in `loop-executor-selector.ts:77`** — first-class enum + UI card + validator config entry, but the selector `switch` throws "not yet implemented". Gated off today by `ALL_LOOP_TYPES` omitting it; becomes a hard throw the moment it's enabled. Either wire an executor or remove it from the enum/labels/config.

### Spell generation controls (behavior-changing — verify output)

- **[CONFIRMED] `maxReversals` is never enforced.** `spell/services/variation-constraint-builder.ts:32` + `random-sequence-generator.ts`. "Max reversals: none" still returns sequences with reversals. Fix: reject over-limit sequences in the `maxAttempts` retry loop.
- **[CONFIRMED] `highContinuity` toggle is a no-op.** `variation-constraint-builder.ts:36` sets `minContinuityScore` which nothing reads. Fix: route into `createConstraintSet` as a `ContinuityConstraint("maximize")` (mirror the `smooth` preset).
- **[CONFIRMED] `SpellGenerationOptions.seed` is never threaded into RNG.** `shared/create/domain/spell-models.ts:209`. Advertised "reproducible" but every draw uses raw `Math.random()`. Fix: seeded PRNG (mulberry32) threaded through the generators, or delete the field.
- **[PLAUSIBLE/dead] `orientation-continuity-validator.ts:44-54`** can throw on a start-position beat with no `motions` map; currently has no live caller. Guard `if (!previousBeat?.motions) continue;` if wired.

### Auth lifecycle (needs runtime verification)

- **[CONFIRMED] Anon→collision account upgrade leaves child services bound to the discarded guest uid.** `auth-state.svelte.ts:499-505` + `anonymous-upgrade.ts:135,159,193`. `childServicesInitialized` resets only in `signOut()`; the collision branch calls `signInWithCredential` (new uid) without signing out, so the subscription listener + mandala collection stay bound to the orphaned anon uid (permission-denied; premium/role changes don't sync). Fix: track the bound uid and reset+re-init child services when `onAuthStateChanged` fires with a different uid. **Verify by exercising the collision-upgrade path.**

### Deck / print (needs PDF output verification)

- **[CONFIRMED] Null render holes shift every later card onto the wrong element sheet.** `choreo-card/components/print-preview/PrintPreviewPages.svelte:544` filters out null pairs (from the catch at 511-514) so `renderedPairs` desyncs from the full-length `tndElements` in `planPrintSlots` → cards after a failure group under the wrong element. Preview is correct, print is not. Fix: keep pairs index-aligned with elements (skip nulls in lockstep in the exporter).
- **[CONFIRMED] Printed recipe line / PDF metadata reflects live Configure dials, not the viewed release.** `DeckReleaserTab.svelte:290-327` `buildDeckMeta` reads the live `rs.selected*` dials; `handleSelectRelease` never loads `release.recipe`. Viewing released Deck #007 while the dials say something else stamps the wrong recipe on the cards. Fix: source recipe fields from `rs.viewingRelease?.recipe` when present.

### Gamification (flag-gated impact / test hygiene)

- **[CONFIRMED logic] prop-unlock load/persist auth-race clobbers a member's Firestore prop collection with guest data.** `shared/gamification/services/prop-unlock-manager.ts:41,77`. `load()` picks its source once (before async auth restore); `persist()` re-checks live and does a merge-less `setDoc`. Impact is limited today because `PROP_LOCKING_ENABLED=false` keeps `unlockedPropTypes` empty, but it's a latent data-loss the moment the flag flips. Fix: track `loadedAsUid` and reset+reload when the uid changes before writing.
- **[CONFIRMED] `prop-collection.test.ts` has 4 RED tests** — they assert flag-ON behavior while `PROP_LOCKING_ENABLED=false` changed `recordOne`/`isUnlocked`/`mergeCollections` semantics. Either the suite isn't running (masking) or CI is red. Fix: parameterize the suite on the flag (design decision — yours).
- **[PLAUSIBLE/flag-gated] `mergeCollections` sums `pendingPicks` but takes `max` of `creationCount`** (`prop-collection.ts:75`) → over-grants picks on guest→member merge. Masked by the flag today.

### Payments (server — in PR, flagged)

- **[PLAUSIBLE] No webhook idempotency** — `handleMerchWebhook.ts` `orders.add()` is unconditional; a Stripe re-delivery duplicates the order → double fulfillment. Fix: key the doc on `session.id`.
- **[PLAUSIBLE] `past_due` client/server disagreement** — client (`subscription-manager.ts:178`) treats `past_due` as active; server (`index.ts:90-122`) revokes premium on it. Grace-period policy decision.
- **[PLAUSIBLE, low] Active product with empty `stripePriceId`** → `createMerchCheckout` calls Stripe with `price: ""` and throws instead of a clean "unavailable". Fails safe. Fix: early reject.

### Carried from wave 1 (still open)

- **[CONFIRMED, needs 2-device] LAN-sync joiner is receive-only** — `shared/lan-sync/services/peer-connection-manager.ts:198-208`; `registerConnection` sets the map inside a `conn.on('open')` that never fires on the already-open joiner conn. Fix: `if (conn.open) addToMap(); else conn.on('open', addToMap)`.
