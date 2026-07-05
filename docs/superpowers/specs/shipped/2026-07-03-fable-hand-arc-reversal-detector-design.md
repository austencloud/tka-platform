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

---

## Completion note — 2026-07-05 (Fable)

> **Display-policy correction (Austen, 2026-07-05, same day — see the
> follow-up section at the end):** dots = prop reversals only; the
> hand-reversal signal is retained as a non-display channel. The
> "ENABLED"/display-diff claims immediately below describe the initial
> shipment and are SUPERSEDED by that section.

**Shipped and ENABLED.** Ship-gate verified satisfied before enabling:
`CONTENT_HASH_VERSION === HASH_VERSION_V2` at
`src/lib/shared/library/services/sequence-content-hasher.ts:51` — derived
reversal flags are no longer identity-bearing, so enabling cannot fork
sequence identity. (The render-cache key `foundation/services/content-hasher.ts`
still includes the flags, correctly: dots change the rendered output, so
affected pictographs re-render once.)

### Ground truth re-verified (MCP, this session)

- `get_term_definition("pro")` / `("reversal")` — pro = prop rotates same
  direction as the hand's arc; three reversal types (hand / prop / full), all
  dotted.
- `get_pictograph_data("A")` vs `("B")` — decisive canonical proof that
  `rotationDirection` records the PROP's spin, not the hand's arc: identical
  blue hand path w→n (clockwise arc), A (pro) stores `cw`, B (anti) stores
  `ccw`. Hence the rotation-only detector was blind to hand reversals.

### Open decisions resolved

- **Hand-arc computation: hybrid.** Authored `handPath` (app view field) wins
  when present — it exists precisely for floats ("no rotation to derive from")
  and skewed long-way arcs that endpoint geometry cannot see. Fallback:
  endpoint geometry on the 8-point circle (shortest arc; static and
  dash/opposite have no arc), the same convention as the pre-existing
  primitives `HAND_ROTATION_DIRECTION_MAP` (engine loop maps, proven equal on
  all 32 pairs by test), `deriveHandPath` (pictograph-preparer), and
  `calculateRotationDirection` (hand-path-motion-calculator). Orientation
  delta rejected: orientation is a prop property subject to turn parity, not a
  hand-path signal.
- **Consolidate (not converge).** One canonical detector:
  `deriveReversals(steps, { loop })` in
  `packages/sequence-engine/src/analysis/deriveReversals.ts`, using
  `analysis/motion-signals.ts` (`handArcDirection`, `propRotationDirection` —
  the unified motion-signal model Spec 1 shares). The app's
  `processReversals`/option-preview module
  (`src/lib/shared/create/services/reversal-detector.ts`) is now a thin
  adapter delegating to it. The engine's `ReversalDetector` class (third
  implementation, zero consumers — verified) was deleted.
- **Canonical semantics = production semantics.** Loop-wrap for loop
  sequences (a loop is cyclic; step 1's predecessor is the last step) and
  transparent chains (blanks / noRotation / arc-less motions never flag,
  never anchor, never break the chain — consistent with how the prop chain
  always treated statics). The engine functions' chain-breaking blank
  semantics were drift from production, not design; the deck reversal system
  ("WYSIWYG") depends on parity with production, re-proven by the untouched
  `reversal-matrix-solver.test.ts` passing against the new detector.

### Proof

- Engine: 29 analysis tests (17 deriveReversals + 12 motion-signals) covering
  all three MCP reversal types, float-via-handPath reversals, loop wrap,
  blank transparency, geometry↔legacy-map agreement on all 32 location pairs;
  full engine suite 267/267 green.
- App: 11 new tests through the production API (three types, loop wrap,
  option previews now hand-arc aware); pre-existing
  `ReversalDetectionService.test.ts` (13) and `reversal-matrix-solver.test.ts`
  (3) pass UNCHANGED — legacy prop-flip behavior and deck WYSIWYG preserved.
- Corpus (`tests/unit/hand-arc-reversal-impact.test.ts`, 460 published
  sequences / 6188 steps): **0 legacy dots suppressed** (hard assert — the
  guardrail), 2582 reversal cells gained (1032 → 3614; blue 1222, red 1360),
  **318/460 sequences (69%) gain ≥1 dot** (279 loop, 39 non-loop). Spot-check
  verified by hand on corpus word `AABB`: gained dots land exactly where the
  hand returns to its previous point while the prop continues (A→B pro→anti
  boundaries) — verbatim the MCP hand-reversal definition.
- `svelte-check`: 0 errors, 0 warnings.

Display-level effect (expected): reversal dots increase on cards/UI for 69%
of the published corpus; render caches for those sequences invalidate once.
Identity hashes are untouched (V2 excludes the flags).

---

## Display-policy correction — 2026-07-05 (Austen, same day)

**Dots = prop reversals only, per Austen 2026-07-05; hand-reversal signal
retained as non-display channel.** ("That's only for prop-er reversals.")
The initial enablement above fed the hand-arc channel into the pictograph
dots — a product regression. Corrected surgically the same day; the
consolidation, canonical detector, dead-class deletion, and signal-level
coverage all stand.

What changed:

- **Canonical API split into explicit channels.** `deriveReversals` now
  returns per-hand `{ propReversal, handReversal }`
  (`ChannelReversals`): `propReversal` = prop rotation direction flipped
  (fires on PROP and FULL reversals — both flip prop direction) — THE dot
  display channel; `handReversal` = hand arc flipped (HAND and FULL
  reversals) — non-display signal channel kept for future consumers (e.g.
  the practice judgment loop).
- **App adapter reads `propReversal` only.** `processReversals`,
  `detectReversal`, and both option-preview helpers render dots from the
  prop channel exclusively; option previews are back to raw
  rotationDirection comparison on the option side (legacy behavior).
- **Corpus proof of byte-identical display**
  (`tests/unit/hand-arc-reversal-impact.test.ts`, hard-asserted): 460
  sequences / 6188 steps — legacy 1032 dot cells, consolidated 1032 dot
  cells, **0 gained, 0 suppressed**. The 2582-cell increase from the initial
  enablement is gone from rendered output. The non-display `handReversal`
  channel carries 2925 cells on the same corpus (informational; feeds
  nothing today).
- **Tests updated:** the three MCP reversal types stay covered at the SIGNAL
  level (engine channel tests + app-level `deriveReversals` assertions);
  display-channel tests assert prop-only (hand reversal → NO dot; float
  handPath flip → NO dot; pure hand-reversal loop → no dots). Engine
  267/267; app reversal suites 33/33 (incl. untouched
  `ReversalDetectionService` and `reversal-matrix-solver`);
  `svelte-check` 0 errors.
