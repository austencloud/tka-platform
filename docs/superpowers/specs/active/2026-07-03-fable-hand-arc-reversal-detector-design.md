# Fable Spec 2 — Hand-Arc-Aware Reversal Detector (Track C)

**Date:** 2026-07-03 · **Autonomy: FULL AUTO to build + prove; ENABLING is ship-gated on Spec 3** · Index: `2026-07-03-fable-dispatch-index.md`

> Dispatch context: root cause **A** — the reversal detector keys off one motion axis (`rotationDirection`) and never reads the hand arc, so it misses an entire reversal type. Same failure class as the loop-detection bug in Spec 1.

## Problem

The production reversal detector compares raw `rotationDirection` (cw/ccw) between steps and never reads hand-arc direction. That makes it **miss hand reversals** — false negatives. It is not over-detecting; it is under-detecting one specific type.

## Ground truth (MCP-verified 2026-07-03; re-verify before coding)

`get_term_definition("pro")`: **pro** = the prop rotates in the **same direction as the hand's arc**; **anti** = opposite. So pro/anti is a *relation* between prop rotation and hand arc, not a raw spin direction.

`get_term_definition("reversal")` — three distinct types:
- **Hand reversal** — hand returns to previous point, **prop continues** same spin → switches pro↔anti.
- **Prop reversal** — hand continues, **prop reverses** spin → switches pro↔anti.
- **Full reversal** — both hand and prop retrace → **maintains** pro/anti.

Consequence: comparing only `rotationDirection` sees prop/full-style spin flips but is **blind to hand reversals**, where the prop's spin direction is unchanged and only the hand retraces its arc. Those are the missed dots.

## Evidence

- **Authoritative findings:** `docs/superpowers/specs/active/2026-06-30-reversal-derivation-reconciliation-findings.md` — §"TKA domain ground truth" establishes zero false positives today and the hand-reversal false-negative gap (Track **C**). Read the whole doc; it also carries the identity/fork context that constrains *enabling* this work.
- **Three divergent implementations, all comparing raw `rotationDirection`, none reading hand arc:**

| impl | file | loop-wrap |
|---|---|---|
| app `processReversals` (production, hydrate path) | `src/lib/shared/create/services/reversal-detector.ts` | **yes** (looks past blanks, wraps at the loop boundary) |
| engine `deriveReversals` (advertised canonical by `tka-types/step.ts`) | `packages/sequence-engine/src/analysis/deriveReversals.ts` | **no** |
| engine `ReversalDetector` class | `packages/sequence-engine/src/analysis/ReversalDetector.ts` | **no** |

- **Diagnostic already built:** `tests/unit/reversal-derivation-parity.test.ts` (real corpus, read-only). Nothing exists yet for Track C.

## Fable's task

1. Make the detector **hand-arc-aware** so it catches hand reversals (hand retraces, prop spin unchanged, pro/anti flips). Derive hand-arc direction from the motion data (start/end locations + rotation), not from `rotationDirection` alone.
2. **Converge the three implementations** (loop-wrap + blank semantics currently differ across them) or consolidate to one canonical detector the others delegate to.
3. Prove it: tests with fixtures for each of the three reversal types, confirming hand reversals are now flagged and prop/full behavior is unchanged.

## Open decisions (left to Fable)

- **How to compute hand-arc direction** from a motion (location-arc geometry vs orientation delta vs a hybrid). Verify against the canonical motion definitions, not extension data (`verify-at-canonical-source`).
- **Converge vs consolidate** the three impls, and which loop-wrap/blank semantics are correct (the app's wrap is the production behavior; the engine functions omit it).

## Guardrails + definition of done

- **Do not suppress existing correct dots.** The findings doc establishes the current detector has zero false positives — this work only *adds* hand reversals. It increases dot count.
- **This is orthogonal to identity/hashing. Do not conflate with content-hash.** Increasing dots changes `blueReversal`/`redReversal`, which currently sit inside the identity hash.
- **SHIP-GATE (hard):** do not enable a default detection change that shifts stored `contentHash` until **Spec 3 (content-hash V2)** is live and excludes derived reversal flags from identity. Until then: build, test, and prove the detector, but do not flip the corpus's dot output on the identity-bearing path. Otherwise ~29% of published sequences re-hash (`133/460`, per the findings doc).
- MCP-ground every domain claim in the working turn (`mcp-ground-truth`).
- Commit own changes only, explicit pathspec.

## Dependencies

- Root cause **A** shared with Spec 1 — a unified motion-signal model serves both.
- **Ship-ordering dependency on Spec 3** (above). Coordinate.
