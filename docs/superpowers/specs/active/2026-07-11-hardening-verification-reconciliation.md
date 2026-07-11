---
title: Hardening Findings — Verified Reconciliation (2026-07-11)
status: active
value: 4
effort: M
depends_on: ""
remaining: "Ship the OPEN-SAFE batch; get Austen sign-off on the OPEN-FLAGGED batch."
---

# Hardening Findings — Verified Reconciliation

## Why this doc exists

The prior hardening findings docs in `docs/superpowers/specs/active/`
(`2026-06-28-hardening-audit-findings.md`, `2026-06-28-hardening-audit-wave2.md`,
`2026-06-25-remote-hardening-session.md`, `2026-06-19-wave9-flagged-findings.md`)
list bugs, but **many were already shipped-fixed and never marked done** — nothing
moved to `shipped/`, and progress was tracked in prose. A 2026-07-11 session went to
"fix" the top findings and discovered the first several were already fixed in live
code. This doc is the result of re-verifying **every** finding against current code on
branch `claude/prioritize-high-value-work-n1sepc`, so future sessions work from ground
truth instead of stale claims.

**Method:** each finding was opened at its cited `file:line` (or grepped by symptom) in
current code and classified FIXED / OPEN-SAFE / OPEN-FLAGGED. Line numbers below are
current as of 2026-07-11.

## Shipped this session (2026-07-11)

- `b9dec9f` — deleted dead `QuestionGenerator.svelte` (zero importers) + stale hooks import comment.
- `53ceffe` — public gallery now resolves real tag names on publish (was `tags: []`), + unit test.
- `45ba5ca` — video-record save failures surfaced to the user (was console-only).
- `465a043` — `addSequencesToCollection` parallelized (S1).
- `e649c3a` — FNV-1a preview hash corrected to 32-bit via `Math.imul` (S2).
- `7b77859` — continuity validator guarded against motions-less start beat (S3).
- `c6b217a` — letter-mappings payload shape-validated at fetch (S6).
- `15d1ffb` — eager `sharer` singleton removed; browser-guarded `getSharer()` (S4).
- `93be9db` — **F1 loop-executor validation sets** fixed + regression tests (was OPEN-FLAGGED; resolved by canonical `LOOPValidator` + UI `loop-validator` grounding + MCP `validate_loop_options` + negative-control tests).

## Confirmed ALREADY-FIXED (do not re-report as open)

Verified corrected in live code; the source findings docs are stale on these:

- tika `saveSession` → `merge: true` (`tika-session-repository.ts:98`).
- library-save id resolved up front (`library-save-service.ts:112-120`); Dexie failure surfaced (`:144-162`).
- filter-persister null-filter guard (`filter-persister.ts:47-53`).
- `getFavorites` boolean filter; browse variation-cache invalidation (`variation-grouper.ts:84-97`).
- library recycle-bin purge guard (`library-recycle-bin.ts:110-133`).
- offline-cache: error surfaced (`offline-cache-state.svelte.ts:48,66`), `propSvgsCached` computed (`offline-cache-orchestrator.ts:140`).
- reversal-detector rewritten to delegate to `@tka/sequence-engine` (no dead sub-condition).
- merch webhook `unitPrice` uses `amount_subtotal` (`handleMerchWebhook.ts:79`).

## OPEN-SAFE — autonomous, typecheck/test-verifiable (tonight's fix backlog)

Ranked by real value (skip cosmetic/premature per `feedback_shiny_object_guard`).
**Status: S1, S2, S3, S4, S6 SHIPPED this session (see commits above). S5, S7 remain.**

| # | Finding | file:line | Fix | Size |
|---|---|---|---|---|
| S1 | `addSequencesToCollection` serial awaits | `shared/library/services/collection-manager.ts:604-611` | `Promise.all(ids.map(addSequenceToCollection))` | S |
| S2 | FNV-1a 32-bit overflow in preview hash | `shared/share/services/preview-cache.ts:78-84` | `Math.imul`-based FNV-1a (invalidates cache once) | S |
| S3 | continuity validator throws on motions-less start beat | `create/spell/services/orientation-continuity-validator.ts:54` | `if (!previousBeat?.motions) continue;` | S |
| S4 | `sharer` direct singleton export bypasses browser guard | `shared/share/services/sharer.ts:302` (+2 importers) | migrate to `getSharer()`, delete direct export | M |
| S5 | 4 RED prop-collection tests (flag-dependent) | `shared/gamification/domain/prop-collection.test.ts` | parameterize suite on `PROP_LOCKING_ENABLED` | M |
| S6 | `browser-data-provider` unvalidated `response.json()` | `shared/sequence-engine/data/browser-data-provider.ts:34` | cast/validate the payload | S |
| S7 | `MutationResult` typed success-only | `features/village/services/sequence-mutator.ts:24` | narrow return type or add failure branch | S |

Lower-value/cosmetic (defer unless already in the file): `TopologyCanvas` viewBox string-parse
(`:145-146` → use `origin.x/.y`), `image-composition-state` singleton→getter, `get-library-repository`
reset, `viewport-measurement` dir move, `lineage-tracker` perf, `personality-generator` defensive guard,
`library-batch-operations` reportError (changes toast→modal UX). These are churn, not value.

## OPEN-FLAGGED — need Austen (do NOT auto-ship)

High value, but each crosses a gate the agent can't clear autonomously.

### TKA generation domain (verify vs canonical validation sets / MCP)
- **F1. Loop-executor wrong validation sets** — ✅ SHIPPED `93be9db`. Both executors now gate on the correct sets, verified against canonical `LOOPValidator`/UI `loop-validator` + MCP + regression tests.
- **F2. `MIRRORED_ROTATED_SWAPPED` unhandled** in `loop-executor-selector.ts` (no case → default throw); enum member + detector still emit it. Wire an executor or coordinate enum removal. M-L.
- **F3. Float directional-tuple dead branches (90° wrong)** — `directional-tuple-processor.ts:75-94` (diamond) & `:133-153` (box): `indexOf` on wrong-grid `order` returns -1 → every float takes the CCW transform. M. Gate: positioning + visual before/after.
- **F4. Spell `maxReversals` never enforced** (`variation-constraint-builder.ts:32` + `random-sequence-generator.ts:550-552`); **`highContinuity` no-op** (`:36`, `minContinuityScore` has zero readers). M each. Gate: generation behavior.
- **F5. Arrow `getDiagnostics` legacy ori-bucket / turnsTuple key** — `arrow-adjustment-calculator.ts:256,322,356,619`. S each. Gate: confirm Inspect/WASD doesn't write from diagnostics.

### Payments (payment-path gate)
- **F6. Merch webhook no idempotency** — `handleMerchWebhook.ts:86` unconditional `.add(order)`; Stripe re-delivery double-fulfills. Fix: `.doc(session.id).set(order)`. S. HIGH value.
- **F7. `past_due` client/server disagreement** — client counts it active (`subscription-manager.ts:178`), server revokes premium (`index.ts:98-124`). Grace-period policy decision. S.
- **F8. Active product w/ empty `stripePriceId`** → Stripe throws (`createMerchCheckout.ts:101-103`). Fails safe; add early reject. S.

### Auth / data-loss (runtime gate)
- **F9. Anon→collision leaves child services on discarded uid** — `auth-state.svelte.ts:500-502` flag reset only in `signOut()`; collision branches (`anonymous-upgrade.ts:132,155,190`) re-auth without sign-out. Track bound uid, reset+re-init on uid change. M.
- **F10. prop-unlock load/persist auth-race** clobbers member data — `prop-unlock-manager.ts:39-84` no `loadedAsUid` (masked today by `PROP_LOCKING_ENABLED=false`). M.

### 2-device / LAN (needs two devices)
- **F11. LAN-sync joiner receive-only** — `peer-connection-manager.ts:198-208`. M.

### Deck / print (PDF-output gate)
- **F12. Null render holes desync cards from element sheets** — `PrintPreviewPages.svelte:546` filters nulls, shrinking emitted pairs. M.
- **F13. Printed recipe reflects live dials, not viewed release** — `DeckReleaserTab.svelte:295-333` `buildDeckMeta` reads live `rs.*` not `rs.viewingRelease?.recipe`. M.

### Visual / theming (visual gate)
- `TopologyCanvas.svelte:87-89,133` hardcoded hex + blank empty-state; `topology-presets.ts:73-90` 2-box vs diagonal-box build identically (TKA-domain: what should diagonal-box build?).

## Separately observed
- `npm run check` requires `build:packages` first — otherwise `@tka/domain` fails to resolve and cascades ~13 errors into `tika/*` + `Type1HybridPage.svelte`. Not code bugs; a check-baseline note. The two `implicit any` params in `api/tika/ask/+server.ts:546,572` are real and trivially fixable once the baseline is green.
