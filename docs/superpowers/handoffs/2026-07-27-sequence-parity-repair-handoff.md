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
| Shortcode labels | LABEL_CONTRADICTS_PAYLOAD = **0** (13-code review complete). 62 acknowledged PAYLOAD_INCOMPLETE quarantines remain — see below. |
| Scheduled audit | Windows task **"TKA Parity Audit"**, daily 04:30, `scripts/diagnostics/run-parity-audit.cmd` → `audit-sequence-public-parity.ts --alert`. Exit 0 clean / 2 drift / 1 failure; alerts = in-app admin notifications (pushed by deployed `onNewNotification`). Logs: `scripts/migrations/backups/parity-audit.log`. |
| Audit baseline | `scripts/diagnostics/parity-audit-baseline.json` — 62 codes, all PAYLOAD_INCOMPLETE. The audit flags any non-current shortcode NOT matching its baselined class. **Regenerate after any intentional relabel/repair** (edit the JSON or rebuild from a fresh dry-run manifest). |
| Old-client UX | A stale client's rejected public sync surfaces as `CLIENT_VERSION_REJECTED` ("reload to update") via `library-sync-retry.ts`. |

## The 62 remaining quarantines — leave them alone

Blob-only mints (no embedded copy, no surviving owner/public/catalog source)
whose float letters the **legacy wire format physically destroyed** (the
encoder wrote the float's own noRotation into the prefloat slot; nothing to
recover). They play correctly; only some letters are underivable. They are
*acknowledged* in the baseline — the audit stays quiet about them and screams
only if one CHANGES class. Do not delete them, do not guess their letters
(three guard layers exist to prevent exactly that: legacy decode, runtime
letter lookup, strict derivation lib).

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
format can carry their pro-prefloat floats** (flat drops prefloat TYPE and
re-derives it from handpath+rotation, which flips these; the compositional
encoder fails its own round-trip and falls back to flat). The honest state is
embed + no blob — Firestore resolution serves them; the skinny R2 snapshot
(`{_id, encoded}` only) omits them, so offline scan of those 4 codes fails
rather than playing the wrong sequence. Do NOT "fix" this by re-adding old
blobs.

## Open threads (ordered by leverage)

1. **Engine-vs-app LOOP executor divergence (origin hypothesis).** The
   compositional codec reconstructs LOOPs via the ENGINE executor set
   (`packages/sequence-engine`), which diverges from the app executors on
   mirrored-family transforms — its round-trip failure on the repaired
   sequences is the observable. The same divergence likely GENERATED the
   corrupt 2026-05-02 mints. Verify/fix the engine executors, then the 4
   embed-only records could get compositional blobs (and offline scans back).
2. **jyC3ji phase (cosmetic, only if asked).** Its repaired word is ΘYΘZ×4 —
   the label's circle read from the stored start position; the old printed
   label read it from the Z beat. If a physical card's phase must match,
   rotate the beat order + start position (Austen knows the option exists).
3. **The scheduled audit has not yet had a scheduled run** (registered
   2026-07-27; first fire 04:30 next morning). Check
   `parity-audit.log` / that Austen got no spurious alert.

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
| Scan-card fidelity | `src/lib/shared/qr/services/prefloat-graft.ts`, `src/lib/shared/render/services/warm-sequence-cells.ts` |
