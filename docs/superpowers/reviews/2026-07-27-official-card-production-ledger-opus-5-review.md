---
phase: official-card-production-ledger
reviewed: 2026-07-27
reviewer: claude-opus-5
model_alias: opus
depth: maximum
source_spec: docs/superpowers/specs/2026-07-27-official-card-production-ledger-design.md
verdict: approve_with_required_changes
findings:
  p0: 3
  p1: 6
  p2: 5
status: issues_found
---

# Architecture Review: Official Card Production Ledger

**Verdict: APPROVE WITH REQUIRED CHANGES.**

The reframed invariant, the honest-guarantees table, and the release/edition/run separation are the right foundation and should not be renegotiated. Three findings below are blocking because they break the document's own central claims against verified current code, not because implementation hasn't started.

**Verified in source** (2026-07-27, read this session):

1. `releaseDeck`, `updateDeckMeta`, `deleteDeck` are **browser** writes via the client SDK (`deck-release-store.ts:32,80,104`). `firestore.rules:1623-1631` allows admin write **and delete** on `deckReleases/**`.
2. `DeckReleaseCard` has **no shortCode field** (`DeckRelease.ts:40-49`).
3. Short codes are minted client-side at print time (`serialized-print-run.ts:210-219`); `/api/physical-cards/issue` validates only that the code doc **exists** (`issue/+server.ts:170-182`), never that it matches the manifest.
4. `shortcodes/{code}`: `allow create: if isFullUser()` (`firestore.rules:1014`).
5. Issue commits in 450-write slices with a best-effort `failed` marker (`issue/+server.ts:326-353`). Caps: 250 cards / 100 copies / 2000 identities (`physical-card.ts:90-92`).
6. Scan dedupe = code + pid + deviceHash + day + city (`scan/+server.ts:223-230`); `lat`/`lng` **are** written (`246-248`).
7. `PrintPanel` and `prepareSerializedPrintRun` both live in `DeckReleaserTab.svelte` (32, 487, 568, 1593).
8. Festivals repository/schemas exist. QRMandalaOverlay mints codes for signed-in users only.

Everything else below is inference from the spec text.

## P0

### P0-1: Freeze is not a trusted boundary; the entire ledger anchors to a browser-written, admin-mutable document

**Section:** "3. Freeze release"; "Security rules" ("Every command validates release hash"); Acceptance criterion 1.

**Consequence:** The hash is computed and written by the same client that writes the manifest, and rules permit later update and delete. An admin session, a leaked admin token, or a client bug can rewrite manifest+hash together and every server command still validates. `deleteDoc` can remove a manifest that active runs reference, orphaning printed cards permanently.

**Correction:** Add a server freeze command that computes the SHA-256 server-side over a **specified canonicalization** (key order, number formatting, Unicode normalization; an unspecified hash over a JS object is not reproducible across browser, renderer, and restore drill), writes via the existing `getFirestoreRest` credential path, and emits `release.frozen`. Change `deckReleases/{d}/manifests/{m}` to `allow update, delete: if false`. Explicitly state that `updateDeckMeta`'s `setDoc(merge)` path is removed. The spec's "separate annotation record" is correct but never retires the existing second writer to the hashed doc.

### P0-2: The CardInstance-to-shortCode binding has no defined origin, and the only existing path is client-supplied

**Section:** `cardInstances` (`shortCode: string`); "Public carrier token" ("the client cannot pair an arbitrary physical ID with an arbitrary short code"); "CardDesign storage".

**Consequence:** At reserve time the server holds `{releaseId, cardDesignSlot}` and must produce a short code the frozen manifest does not contain. If the caller supplies it, which is the only mechanism that exists, the stated invariant is false on day one: an official CardInstance can bind to a code whose payload was never in the release. The printed QR then resolves to wrong content and produced-counts attach to the wrong CardDesign, on permanent paper.

**Correction:** Make the short code part of the frozen CardDesign. At freeze, the server resolves or mints one code per slot (the content-addressed `shortcodeHashes` index already gives one-code-per-encoderHash, so this is a lookup, not new machinery) and includes it in the manifest hash. Reserve reads it from the manifest and rejects any caller-supplied code. Add acceptance criterion: *"No command accepts a caller-supplied short code; a CardInstance's shortCode always equals its frozen slot's."*

### P0-3: Single-funnel enforcement omits the surface where the leak actually is: the v1 browser issuance path

**Section:** "Enforcement chokepoints"; "Cutover" step 8.

**Consequence:** All six chokepoints guard v2. Bullet 5 makes `withPhysicalCardId` "legacy-compatibility", which still mints unwatermarked, identity-bearing `?pid=` fronts from the browser after cutover. Those cards are indistinguishable from pre-cutover cards to any scanner, so they can never be retroactively reclassified as prototypes. "Retire direct v1 issuance" sits as step 8 of an unsequenced list with no enforcement.

**Correction:** Add a seventh chokepoint: `/api/physical-cards/issue` rejects any request naming a v2-era release, and returns 410 for all requests once Phase 3 lands. Bind the kill-switch to a phase, not a list position. Add acceptance criterion: *"After cutover, no browser path produces a front-bearing artifact without a visible PROTOTYPE mark."*

## P1

### P1-1: Abandoned `reserving` runs leave permanent orphan instances

**Section:** "State machines → Production run", rules 2 and 4; "Failure behavior" row 1.

**Consequence:** Committed chunks of a run abandoned in `reserving` exist, are scan-ineligible, and are never tombstoned. They inflate `reservedCardCount` and break the restore drill's cardinality check. The analogous v1 endpoint already has this shape (450-write slices, best-effort failure marking that can itself throw).

**Correction:** Add a scheduled sweeper that tombstones instances of runs stuck in `reserving` past a stated TTL, appending `run.canceled` + `card.tombstoned`. Change the idempotency key to chunk granularity: `reserve:{runId}:{chunkIndex}`. One key cannot make a multi-commit sequence idempotent. Add `reservedCardCount` to the replay mismatch report.

### P1-2: The outbox dispatcher's rule re-enqueues the one case that must never be re-executed

**Section:** "Idempotency", steps 1-5 plus the dispatcher paragraph.

**Consequence:** A command that was enqueued, executed the paid external call, then crashed before step 4 is indistinguishable from one enqueued and never executed. Both read as "not finished," so the dispatcher re-enqueues, and re-enqueue means re-submit unless the handler reconciles first. This contradicts "An ambiguous provider timeout never triggers an unqualified second paid order."

**Correction:** Give command records three phases: `committed`, `dispatched`, `settled`. State that the only legal action on a `dispatched` command lacking an external reference is `reconcileRun`, or escalation to dead-letter when the provider offers no query-by-key. Never `submitRun`. Bind the existing crash-injection integration test specifically to the paid-order case: *exactly one provider order.*

### P1-3: Observation counts have no defined unit, so the public sentence is unverifiable

**Section:** "City-stop projection"; `ScanObservation`.

**Consequence:** Under the current key, "Seen 10 times in Chicago" means 10 device-days, much closer to "10 people" than to "10 scans," the exact claim the next bullet forbids. If v2 changes the key, the sentence silently changes meaning and old/new observations stop being comparable in one projection.

**Correction:** Put the dedupe key in the spec beside `ScanObservation`, add `observationKeyVersion` to the record, and word the public copy to the unit ("Seen on 10 separate days in Chicago" for a device-day key).

### P1-4: Prototype watermark is asserted as a property of a user-controllable artifact

**Section:** "Prototype"; visual verification list.

**Consequence:** The mark is rendered in the user's browser from modifiable code. A de-watermarked proof looks official and scans as prototype. The resolver classification is the real defense; the guarantees table omits this row, breaking its own discipline.

**Correction:** Add a row: *"A downloaded proof carries a visible PROTOTYPE mark → Not provable after handoff. The resolver's prototype classification is the enforceable half."*

### P1-5: Legacy and v2 scan stores have no stated join, and Era 1 says two things

**Section:** "Era 1" ("Existing scans stay in their historical collection") vs. "Carrier types" (`legacy-serialized` → "Kept as legacy observations") vs. the new `scanObservations` collection.

**Consequence:** A card printed today gets scanned after cutover. Whether that writes `scanEvents` (old key, with coordinates) or `ScanObservation` (new key, city-only) is unstated. Two writers with different dedupe keys on one physical card double-count in any combined projection.

**Correction:** State that after cutover **all** scans write `ScanObservation`, `scanEvents` becomes read-only history, and the compatibility projection unions them with a named cutover-window dedupe rule. Test: *"a `?pid=` scan after cutover produces exactly one observation and zero new `scanEvents` documents."*

### P1-6: v1 IP-derived coordinates sit below the v2 privacy floor with no disposition

**Section:** "Privacy and append-only history" vs. "Era 1" vs. Out of scope ("Deleting or rewriting legacy scan history").

**Consequence:** The spec sets a floor for v2 and leaves an existing coordinate store beneath it, while forbidding the cleanup that would close it. Aspirational floors don't survive a privacy request.

**Correction:** Add to Era 1: legacy `lat`/`lng` are dropped or coarsened to city centroid by a one-time migration (privacy minimization, not falsification; the city fact survives), and ingest stops writing them at cutover. If Austen prefers retention, state the window. Either is defensible; silence is not.

## P2

- **Quantity ceiling.** "Enter quantity" has no bound. 54 cards × 100 copies = 5,400 instances, artifacts, carriers, and resolver rows. State `maxDeckCopiesPerRun` / `maxIdentitiesPerRun`, derived from the Phase 0 renderer spike's per-card cost rather than guessed.
- **`identityEra`** is declared on every entity and used in no rule. Name the resolver branch it governs, or drop it.
- **`ProductionRunState`** is referenced in the projection but never defined; prose states (`in-production`, `closed-partial`) use different casing than the sibling instance enums. Define the union inline.
- **Presentation carrier lifecycle.** Every workshop session mints a durable resolver row forever. State GC/retention, or derive presentation carriers from the digital carrier + session ID.
- **MPC gate has no fallback rule.** Question 1 (per-copy variable art) is load-bearing. Commit now to operator print station as the default launch channel if the answer is no, instead of leaving Phase 0 step 3 open.

## Contradictions and missing invariants

1. Freeze immutability vs. the surviving `updateDeckMeta` merge-write on the hashed doc (P0-1).
2. "No official PDF or ZIP download button appears in the normal release UI" vs. the manual-provider "short-lived encrypted package for an authorized operator." Say whether that package contains print-ready fronts. It currently implies both.
3. **Missing:** what a `flagged` carrier does to produced-count and city-stop projections. The eligibility table says "feed clone analysis"; the counting section never excludes flagged observations.
4. **Missing:** restore ordering. A printed card scanned mid-recovery needs resolver aliases restored **before** the ledger. The drill compares projections but never states the order.
5. **Missing:** who may invoke Official Production. "Authenticated creators may request commands" vs. admin-only release rules today, unresolved, and it decides whether reservation is a cost-bearing surface for non-admins.

## Strong decisions to preserve

- The reframed invariant (unique identity + one funnel + clone detection) replacing "one piece of paper." Everything honest in this document descends from it.
- The Honest guarantees table, including all four "Not provable" rows. Keep it first.
- Release / Edition / Run separation with the 2026-design-produced-in-2031 worked example.
- Activation at `produced`, not provider acceptance, with the explicit shipment-evidence fallback.
- "Discovered," never "owned"; no Scanned-Cards silo; relationship evidence on collection membership.
- The ≥3-distinct-CardInstances threshold before any public city aggregate.
- Evidence levels as a first-class field, with `rendered-only` excluded from counts.
- Provider-neutral `IPrintProvider` with MPC explicitly uncertified and a written capability gate.
- Refusing to backfill v1 as produced; keeping legacy routes indefinitely.
- Signed portable NDJSON exports with a scheduled restore drill into a disposable project.

## Recommended spec edits, priority order

1. Add a "Freeze is a server command" subsection: server-side hash over a specified canonicalization, server credential write, `release.frozen` event, rules changed to deny update/delete, `updateDeckMeta` retired. (P0-1)
2. Add short code to the frozen CardDesign slot and to the manifest hash; forbid caller-supplied codes; add the acceptance criterion. (P0-2)
3. Add the v1-issuance kill-switch as a seventh enforcement chokepoint, bound to Phase 3, plus the no-unwatermarked-front acceptance criterion. (P0-3)
4. Rewrite the dispatcher paragraph around `committed`/`dispatched`/`settled` and the reconcile-only rule for `dispatched`. (P1-2)
5. Add the `reserving` sweeper, chunk-level idempotency keys, and `reservedCardCount` reconciliation. (P1-1)
6. Add the dedupe key, `observationKeyVersion`, and unit-accurate public copy to the scan sections. (P1-3)
7. Add the cutover rule for legacy `?pid=` scans plus its test. (P1-5)
8. Add the legacy-coordinate disposition to Era 1. (P1-6)
9. Add the prototype-watermark row to Honest guarantees. (P1-4)
10. Resolve the five gaps above: run-command authorization, flagged-carrier counting, restore ordering, quantity ceilings, presentation-carrier retention, `ProductionRunState` definition.

---

_Reviewed: 2026-07-27_  
_Reviewer: Claude Opus 5 (`claude-opus-5`, invoked through Claude Code's `opus` alias)_  
_Depth: maximum_
