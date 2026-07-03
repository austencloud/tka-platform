# Fable Spec 1 — Loop-Detection Audit Fixes

**Date:** 2026-07-03 · **Autonomy: FULL AUTO** (detection logic + tests only; no data migration) · Index: `2026-07-03-fable-dispatch-index.md`

> Dispatch context: one of four specs for execution by a stronger reasoning model. Root cause **A** applies here: detection heuristics key off one motion axis (`rotationDirection`) when correctness needs the full signal (hand-arc / `motionType` / pro-anti relation). Fix the class, not the instance.

## Problem

TKA has **five near-duplicate loop detectors**. One confirmed bug was fixed 2026-07-03: the functional `detectLOOPFromSteps` detected the `inverted` component off a **rotation-direction flip**, but mirror+invert *preserves* rotation direction (mirror flips it, invert flips it back — they cancel), so inversion went undetected and mirror+invert loops mislabeled as bare "mirrored". Fixed to key off the `motionType` pro↔anti flip (only invert touches motionType). A round-trip audit off that same insight surfaced a family of related misdetections.

## Evidence (read these first)

- **Handoff (authoritative):** `docs/superpowers/handoffs/2026-07-03-loop-detection-audit-handoff.md` — ground-truth signature matrix (§2), detector inventory (§4), full findings table (§5), open decisions (§7).
- **Audit harness:** `packages/sequence-engine/tests/loop/detection/round-trip-audit.test.ts` — drives real executors → runs both engine detectors → checks recovery. Run: `npx vitest run --root packages/sequence-engine tests/loop/detection/round-trip-audit.test.ts`.
- **Regression test (the fixed bug):** `packages/sequence-engine/tests/loop/detection/mirrored-inverted-detection.test.ts`.
- **The fix:** `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` → `checkInvertedPattern`.

**Findings are LEADS, not verdicts.** The harness feeds hand-built partials to the real generator; a bad partial injects artifacts (axis-orbit makes a mirror look rotated; a 360°-sweep injects real rotation). Treat `+swapped`/`+rotated` *crosstalk* findings with more skepticism than `(none)` *structural* findings, and re-ground on real generated loops (MCP `generate_loop_sequence` / the app generator) before trusting any single cell.

## Detector inventory (5 implementations; harness covers 2)

| # | Detector | Path | Audited? |
|---|---|---|---|
| 1 | functional `detectLOOPFromSteps` (backs MCP `detect_loop_pattern` + `scripts/import-sequence.cjs`) | `packages/sequence-engine/src/loop/detection/LOOPDetector.ts` | ✅ |
| 2 | class `loopDetectorClass.detectLOOPType` | same file | ✅ |
| 3 | app class `LOOPDetector` (near-identical copy of #2; used by hydration) | `src/lib/shared/create/services/loop-detector.ts` | ❌ |
| 4 | loop-labeler pipeline — the sophisticated one, rotation-direction-aware per transform, explicit composite targets, unanimity | `src/lib/features/loop-labeler/services/**` (`comparison/{reflection,rotation,swap-invert}-comparer.ts`, `detection/run-unanimity-checks.ts`, `loop-detector.ts`) | ❌ |
| 5 | `.cjs` labelers | `scripts/auto-label-loops.cjs`, `scripts/validate-loop-detection.cjs` | ❌ |

## Root-cause summary (from handoff §5)

- Swap and invert are **aliased on the motionType signal** for opposite-typed hands (functional collapses swap→inverted; class inflates invert→swap+inverted). Separating signal = hand identity / letters, which the simple detectors ignore.
- **swap∘invert cancels** on motionType → both report nothing.
- **No FLIPPED and no REWOUND detection path** exist (structural).
- **Mirror is phase-fragile** — an absolute index-wise mirror check vs continuous loops.

## Fable's task

1. Extend the harness to detectors **#3, #4, #5** (note: #4 takes a different input shape — `SequenceEntry` with `fullMetadata`, not `SequenceStep`; write the adapter).
2. Re-ground fixtures on **real generated loops** to eliminate artifact risk, then confirm which findings are genuine.
3. Decide the architecture (see Open decisions), implement, and lock every confirmed bug with a regression test.

## Open decisions (left to Fable)

- **Consolidate vs patch.** Five parallel detectors is the deeper problem. Is the answer to route MCP/import/hydration through one canonical detector (likely #4, the loop-labeler) and retire the others, or to patch each? The loop-labeler is unaudited — verify it first; if it is already correct, "route everything through it" beats five fixes.
- **Swap-vs-invert disambiguation signal** — hand identity (swap exchanges hands; invert does not) vs letters (`INVERTED_LETTER_MAP`). Pick the invariant.
- **Mirror phase-fragility** — detector bug, or a generator/detector contract mismatch about mirror semantics (absolute-index vs continuous)?
- **Flipped + Rewound** — fill the missing detection paths, or confirm they are an intentional scope cut?

## Guardrails + definition of done

- All existing `packages/sequence-engine` loop tests stay green; every confirmed misdetection gets a regression test.
- Any TKA domain claim is MCP-grounded in the working turn (`mcp-ground-truth` rule). Any knowledge-base correction is verified at the canonical source (`verify-at-canonical-source` rule).
- **Shipping note:** the functional detector (#1) backs the MCP `detect_loop_pattern` tool. Changes ship only after rebuilding `@tka/domain` + restarting the Flow Arts MCP service (see memory `reference_flow_arts_mcp_deploy`).
- Commit own changes only, with an explicit pathspec (`commit-only-your-own-changes` rule). The 2026-07-03 fix + tests are currently **uncommitted** in the working tree — fold them into your change or commit standalone.

## Dependencies

Shares root-cause **A** with Spec 2 (hand-arc reversal detector). If you build a unified motion-signal model (hand-arc + motionType + rotationDirection), both detectors benefit — consider doing them together.
