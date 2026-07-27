# Sequence/Public Parity Repair — Handoff (2026-07-27)

The 5-phase parity-repair program
([spec](../specs/active/2026-07-25-sequence-public-parity-repair-design.md) —
read its dated addendums; they are the authoritative history) is **complete
and live**, including the full human review of every label/payload
contradiction. This doc is what the next agent needs to operate, extend, or
debug the system without re-deriving it.

## State of the world (verified 2026-07-27)

| Surface | State |
|---|---|
| Public projections | 466/466 IN_SYNC (reconcile engine) |
| Firestore rules | STRICT, deployed: schema-2 shape + transaction-proven owner parity (`getAfter`/`existsAfter`) + hash-claim linkage on every public write; strict mint shape on shortcodes. Legacy write allowance removed. |
| Shortcode labels | LABEL_CONTRADICTS_PAYLOAD = **0** (13-code review complete). PAYLOAD_INCOMPLETE = **1** (3CLR, permanently residual — see below). The other 61 were recovered 2026-07-27 (round 4, label-witnessed float restoration + the P9LY rotation repair). |
| Scheduled audit | Windows task **"TKA Parity Audit"**, daily 04:30, `scripts/diagnostics/run-parity-audit.cmd` → `audit-sequence-public-parity.ts --alert`. Exit 0 clean / 2 drift / 1 failure; alerts = in-app admin notifications (pushed by deployed `onNewNotification`). First scheduled run completed 2026-07-27 at 04:30 with exit 0 and no actionable violations. Logs: `scripts/migrations/backups/parity-audit.log`. |
| Audit baseline | `scripts/diagnostics/parity-audit-baseline.json` — 1 code (3CLR, PAYLOAD_INCOMPLETE). The audit flags any non-current shortcode NOT matching its baselined class. **Regenerate after any intentional relabel/repair** (edit the JSON or rebuild from a fresh dry-run manifest). |
| Old-client UX | A stale client's rejected public sync surfaces as `CLIENT_VERSION_REJECTED` ("reload to update") via `library-sync-retry.ts`. |
| New shortcode payloads | **LOCAL, NOT YET DEPLOYED:** `ShortCodeManager.allocateCode` decodes every candidate blob, re-derives its letters through the runtime motion lookup, and keeps it only when the exact strict source word and beat count survive. A lossy or unverifiable blob is omitted and the exact `sequenceData` embed is stored instead; its word always comes from strict source-step derivation. The embed-only + hash-claim write shape lands under current rules (26/26 parity rules tests). |

## The former 62 quarantines — recovered 2026-07-27 (round 4)

Blob-only mints whose float letters the **legacy wire format physically
destroyed** (the encoder wrote the float's own noRotation into the prefloat
slot). "Nothing to recover *from the payload*" stood — but the mint-time
LABEL is a surviving projection of the destroyed letters, and for every
word-labeled record the strict derivation spelled the label perfectly at
every derivable beat. Round 4 (spec addendum "Round 4" is the authoritative
detail) recovered 61 of 62:

- **60 restored embeds** (`restore-quarantined-shortcode-payloads.ts`): the
  embedded payload copy is reconstructed from the record's own blob decode;
  float-gap letters come from the canonical alternatives lookup wherever it
  matches the label witness (witness-validated: the lookup alone is only
  ~50% right, so label agreement is the per-beat proof), else the label's
  letter is stamped as stored mint testimony. Witness gates: full-label
  positional corroboration / periodicity proof for truncated 6-char labels
  (7FJ8, CKW8, JXZB) / sibling-signature proof (0XHN ≡ seed half of 5247).
  Blobs, hashes, and claims untouched.
- **P9LY** (`repair-p9ly-mirrored-rotations.ts`): not float damage — its
  mirrored repeat-2 blue rotations were never flipped (half-applied family,
  the B2ZM defect expressed as rotations). Unique label-corroborated fix
  via the canonical matcher; blob re-encoded, claim moved, R2 refreshed.
- **3CLR is the sole permanent residual**: an Assemble-lab export whose
  beats exist in no pictograph dataframe. It has no word and never will —
  baselined, do not delete, do not guess.

The three guard layers (legacy decode, runtime letter lookup, strict
derivation lib) still stand: the wire channel never guesses. The restored
embeds are the sanctioned dual-source shape every source mint carries.

`prefloat-graft.ts` additionally grafts embedded step LETTERS onto
letterless decoded steps (same conservatism: tail alignment + both
channels' motion identity), so /q displays the mint letter instead of the
runtime's same-family guess and the scan-cell warm can finally render the
float beats — all 60 restored codes were warmed 60/60 after the repair.

## Defect families discovered in the review (and their repair tools)

1. **Half-applied LOOP transforms** (2026-05-02-era system mints): the
   generator applied its repeat-2 transform to only part of the data.
   - B2ZM/PAI0 (`mirrored`): red locations mirrored, rotations unflipped,
     blue copied. Repaired.
   - ZLCD/HVJY (`mirrored_inverted`): locations+rotations right, pro↔anti
     inversion never applied. Repaired.
   - Tool: `scripts/migrations/repair-half-applied-loop-mints.ts <source>
     <twin|-> <label> [--apply]` — regenerates repeat 2 via the app's
     canonical executor for the embedded loopType; refuses unless the rebuild
     derives the exact reviewed label on BOTH channels. Extend its `EXECUTORS`
     map only after verifying the transform.
2. **Seed-level pro↔anti flip** (jyC3ji/ZaJWw6, `rotated` quartered): one
   seed beat's blue was anti-family where the label's letter requires
   pro-family; all four repeats inherited it. Bespoke tool:
   `repair-jyc3ji-rotated-loop.ts` (kept as the worked example of the
   brute-force method: chain-constrained enumeration through
   `letterForBeat` + `calculateEndOrientation`).
3. **Simple wrong labels** (payload right): ×N labels over shorter payloads,
   decode-bias letters. Tool: `scripts/migrations/relabel-reviewed-shortcode.ts
   <code> <reviewed-word> [--apply]` — re-derives from the live doc and
   refuses on mismatch. Only run AFTER Austen has reviewed the code.

**Review convention learned:** Austen ruled "payload wins" in 10/13 cases;
the 3 exceptions were all mechanically PROVABLE generator defects
(label-corroborated canonical rebuilds). If new contradictions ever appear:
probe for a transform signature FIRST, present only the genuinely ambiguous
ones for review.

## Embed-only records (no `encoded` field) — deliberate

ZLCD, HVJY, jyC3ji, ZaJWw6 carry `sequenceData` but NO blob: **neither wire
format can carry their pro-prefloat floats** (flat stores prefloat rotation,
then re-derives prefloat type from path and rotation, which flips these).
The recipe format uses that same flat representation for its seed and
integrity hash, so byte agreement is not proof that the decoded motion kept
the same letter. The honest state is embed + no blob. Firestore resolution
serves them; the skinny R2 snapshot
(`{_id, encoded}` only) omits them, so offline scan of those 4 codes fails
rather than playing the wrong sequence. Do NOT "fix" this by re-adding old
blobs.

## Open threads (ordered by leverage)

1. **A new wire version, only if offline restoration matters.** The live QR
   codec resolves app executors through `compositional-utils.ts`; it does not
   reconstruct through the engine executor set. Restoring offline scans for
   the 4 embed-only records requires a versioned wire representation that
   carries explicit prefloat type. Compound recipe tags such as
   `mirrored_inverted` would also be needed for ZLCD/HVJY. Fixing an executor
   alone cannot make the current flat seed lossless.
2. **Engine detector classification.** The app detector delegates to
   `packages/sequence-engine`. On the repaired ZLCD/HVJY payload it reports
   strict `mirrored`, not stored `mirrored_inverted`. That makes the recipe
   encoder attempt a plain mirrored reconstruction and fall back to flat.
   This detector issue is real, but it does not explain the lossy prefloat
   wire or prove what generated the 2026-05-02 corruption.
3. **jyC3ji phase (cosmetic, only if asked).** Its repaired word is ΘYΘZ×4.
   The label's circle reads from the stored start position; the old printed
   label read it from the Z beat. If a physical card's phase must match,
   rotate the beat order + start position (Austen knows the option exists).

## Gotchas that cost hours (don't rediscover them)

- **Rules tests:** firebase-tools **15.24.0** (14.x emulator breaks ALL
  `getAfter`) + **JDK 21** on PATH:
  `export JAVA_HOME="/c/Users/Austen/jdks/jdk-21.0.11+10" && export PATH="$JAVA_HOME/bin:$PATH"`.
  Run per-file (`test:rules:core` / `test:rules:parity`).
- **Owner saves are OFFLINE-FIRST** — owner-doc rules gate only the three
  projection stamp keys, deliberately (spec deviation, documented). Don't
  "tighten" them to full content parity.
- **Admin scripts:** `TKA_ADMIN=1 npx tsx …` from repo root. tsx CJS quirk:
  no top-level await in /tmp scripts — wrap in `main()`.
- **Reconcile manifests use `records`, shortcode manifests use `results`** —
  the audit's `runEngine` accepts both; keep it that way.
- **Cell warming must mirror ChoreoCard's per-cell options.** Wide
  (duration>1) cells key with `|wm2|` (widthMultiplier); `warmSequenceCells`
  now handles this — any future option that enters `deriveCacheKey` must be
  added to the warm too, or cells 404 forever on `/q` (cloudOnly throws, no
  local fallback there).
- **In-browser scoped warms:** drive `startScanCellWarm` with injected
  `listCodes` from DevTools MCP `evaluate_script` on a /q page. Fresh
  `import()` graphs are UNCONFIGURED (`getShortCodeManager` throws) — route
  through `warm-all-scan-cells.ts`, which wires its own deps.
- **Scan-card resolver:** blob decode is the renderer's base; embedded
  mint-data is grafted for float prefloat only (`prefloat-graft.ts`).
  Rendering raw embedded steps breaks pictographs/orientations — don't
  reorder those strategies again.
- **Every repair script writes a backup manifest** to
  `scripts/migrations/backups/repair-*.json` (previous encoded +
  sequenceData) before touching Firestore. Keep that property.
- Refresh the R2 snapshot after anything that touches `encoded`:
  `TKA_ADMIN=1 npx tsx scripts/publish-r2-shortcode-snapshot.ts --upload`.

## Key files

| What | Where |
|---|---|
| Spec + full history | `docs/superpowers/specs/active/2026-07-25-sequence-public-parity-repair-design.md` |
| Strict rules | `firestore.rules`; tests in `tests/integration/firestore-rules/` |
| Audit | `scripts/diagnostics/audit-sequence-public-parity.ts` + `run-parity-audit.cmd` + `parity-audit-baseline.json` |
| Derivation lib (channel-aware floats) | `scripts/migrations/lib/shortcode-derivation.ts` |
| Repair tools | `scripts/migrations/{relabel-reviewed-shortcode,repair-half-applied-loop-mints,repair-jyc3ji-rotated-loop,rebuild-truncated-shortcode-payloads,backfill-shortcode-words}.ts` |
| Prefloat guards | `legacy-sequence-codec.ts` (decode), `motion-query-handler.ts` (runtime), derivation lib (strict) |
| Mint-time blob fidelity | `src/lib/shared/qr/services/short-code-manager.ts` |
| Scan-card fidelity | `src/lib/shared/qr/services/prefloat-graft.ts`, `src/lib/shared/render/services/warm-sequence-cells.ts` |
