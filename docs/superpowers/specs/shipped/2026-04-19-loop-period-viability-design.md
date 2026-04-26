# LOOP Period Viability & Non-Rotated Executors — Design Spec

**Date:** 2026-04-19
**Author:** Claude (drafted overnight, pending Austen's review)
**Status:** FINAL — MCP-grounded answers to Q1-Q5 below; ready for implementation
**Supersedes:** nothing (follow-on to `2026-04-18-loop-period-and-orientation-domain.md`)

---

## 1. Problem

When generating a **16-count quartered mirrored** LOOP today, the generator silently produces period-2 output (i.e. a halved mirror), not the expected period-4 closure. Two orthogonal defects cause this:

### 1.1 Non-rotated executors ignore the period

`StrictMirroredLOOPExecutor.executeLOOP(sequence, _sliceSize)` takes a slice-size parameter but ignores it. The comment at line 15 even says so:

> `IMPORTANT: Slice size is ALWAYS halved (no user choice like ROTATED)`

The index map at `_getIndexMap` hard-codes `length / 2`. Same pattern across `StrictFlippedLOOPExecutor`, `StrictInvertedLOOPExecutor`, `StrictSwappedLOOPExecutor`, `RewoundLOOPExecutor` — all non-rotated executors generate exactly period 2 regardless of UI input.

The `ILOOPExecutor` contract codifies this at line 11:
> *"will ignore the sliceSize parameter, but it must still be provided for interface consistency."*

So the UI collects a period value, the config stores it, the executor drops it on the floor.

### 1.2 No viability gating on the Period card

`CardConfigurator.ts:187` shows the period card whenever `loopEnabled`. It does not consider whether the selected (loopType, period, level) combination is physically generatable. A user at level 1 can select **mirrored + quartered** and the UI gives no hint that this is infeasible.

The result: the user thinks they asked for period 4, the system accepts it, then silently delivers period 2.

---

## 2. Goal

1. **Executor correctness** — when the UI requests a period, the generator either produces it or refuses. No silent downgrade.
2. **Viability gating** — the Period card is only shown (or period 4 is only selectable) when the current (type, period, level) combination can actually generate.
3. **Explain infeasibility** — when a user's setting combo would reduce period, tell them why, so they can adjust level or type.

---

## 3. Current State Audit

**Working:**
- `PeriodCard.svelte` renders and updates config (Phase 6 landed).
- Period flows through `CardConfigurator.deriveLoopMinOverride` → `minLength` engine call → LengthCard minimum.
- Phase 5 `minLength` returns `Infinity` for L1 + non-rotation period > 2, so in theory the length stepper should already bottom out for infeasible combos.

**Broken / missing:**
- `StrictMirroredLOOPExecutor` (and peers) ignore the period parameter end-to-end.
- `ILOOPExecutor` contract treats sliceSize as ceremonial.
- `minLength` returning `Infinity` does **not** currently remove the period option from the UI — it just caps the length. User can still click Generate.
- No viability check at the period card level.
- No error surface when the user's combo is infeasible — the generator runs and returns period 2 as if nothing happened.

---

## 4. Design

### 4.1 Viability rules table

This table is the source of truth for which (loopType, period, level) combos are viable. Everything else — UI gating, executor behavior, error messages — derives from it.

**MCP grounding (2026-04-19):** `get_domain_topic("loops")` and `get_domain_topic("caps-vs-loops")` establish two load-bearing facts:

1. *"Each transformation is its own inverse — mirror twice = original."* All six LOOP transformations (mirrored, flipped, swapped, inverted, rewound, rotated-as-reflection) are group elements of order 2, **except ROTATED in its continuing-same-direction quartered form**, which provides genuine C4 cyclic structure.
2. *"Turn values and orientations do not affect LOOP classification."* This is decisive. Turns cannot contribute a per-pass wheel delta that alters the LOOP's period. The LOOP algebra operates on the reduced space of (grid positions, motion types, hand identity); turns are additive on top and do not compose with the LOOP group.

Combined: **period 4 only exists for LOOPs containing ROTATED.** All pure non-rotated primitives close at period 2, regardless of level or turn placement.

| LOOP type | Period 2 | Period 4 | Period 8 |
|---|---|---|---|
| ROTATED | ✅ all levels | ✅ all levels | L7+ reserved |
| MIRRORED | ✅ all levels | ❌ algebra forbids | — |
| FLIPPED | ✅ all levels | ❌ algebra forbids | — |
| SWAPPED | ✅ all levels | ❌ algebra forbids | — |
| INVERTED | ✅ all levels | ❌ algebra forbids | — |
| REWOUND | ✅ all levels | ❌ not meaningful (rewind-of-rewind = identity) | — |
| MIRRORED_ROTATED | ✅ all levels | ✅ all levels | — |
| ROTATED_INVERTED | ✅ all levels | ✅ all levels | — |
| ROTATED_SWAPPED | ✅ all levels | ✅ all levels | — |
| MIRRORED_INVERTED (no ROTATED) | ✅ all levels | ❌ order 2 × order 2 = order 2 | — |
| MIRRORED_SWAPPED (no ROTATED) | ✅ all levels | ❌ same | — |
| SWAPPED_INVERTED (no ROTATED) | ✅ all levels | ❌ same | — |
| MIRRORED_INVERTED_ROTATED | ✅ all levels | ✅ all levels | — |
| MIRRORED_ROTATED_INVERTED_SWAPPED | ✅ all levels | ✅ all levels | — |

**Rule, stated as a one-liner:** Period 4 is viable iff `ROTATED_LOOP_TYPES.has(loopType)`.

**Implication for the user's reported bug:** A quartered mirrored request at 16 counts cannot produce period-4 output because no period-4 mirrored exists. The correct behavior is to reject the combo (disable the period 4 option with an explanation), not to silently downgrade to period 2.

### 4.2 Why the algebra forbids period-4 for non-rotated types

The LOOP transformations form a finite group (per MCP `caps-vs-loops`): closure, associativity, identity, inverses. Each non-rotated primitive is its own inverse (order 2). Products of order-2 elements in an abelian-or-small context are also order 2 or 1. The only transformation that breaks out of this is ROTATED in its quartered form, which has order 4 (C4 cyclic — 4 applications of 90° grid rotation returns to identity).

**Turn injection does not help.** MCP `loops` says plainly: *"Turn values and orientations do not affect LOOP classification."* LOOPs are classified by the reduced space of (position, motion type, hand identity). Turns are an orthogonal layer added on top of the skeleton. They cannot create a period-4 cycle out of an order-2 LOOP operation.

**Consequence:** any request for "quartered X" where X does not contain ROTATED is ill-defined. The generator must reject it.

### 4.3 Executor changes

With Q1 resolved, the executor surgery is much smaller than originally scoped. No new period-4 paths need to be built for mirrored/flipped/swapped/inverted — they don't exist mathematically.

1. **Contract change:** `ILOOPExecutor.executeLOOP(sequence, sliceSize)` → `ILOOPExecutor.executeLOOP(sequence, period: number)`. Drop the `sliceSize` parameter entirely.
2. **Per-executor behavior:**
   - `StrictRotatedLOOPExecutor`: continues handling period 2 and period 4 (this is the only one that ever did).
   - All other executors: accept the period parameter and assert it equals 2. Throw `LoopViabilityError` if called with period ≠ 2. This is defense-in-depth; the UI should have already prevented it.
3. **Pre-flight viability check:** before executor dispatch, call `LoopViabilityService.check(type, period, level, gridMode)`. If infeasible, throw `LoopViabilityError` with a human-readable reason.

### 4.4 Gating UX

Two options on the table. Pick in morning review (see Q3).

**Option A: hide the Period card when only one period is viable**
- At L1 with MIRRORED selected → period card hidden entirely (period 2 only).
- At L3 with MIRRORED selected (if Q1 resolves affirmatively) → period card visible with 2 and 4.
- Minimal UI surface area; clean.
- Downside: users don't learn that quartered exists or why it's hidden.

**Option B: show the Period card always; disable the infeasible option with an explainer**
- Period 4 button is visually disabled at L1 for MIRRORED with tooltip: *"Quartered mirrored requires Level 3+ for half-turn closure."*
- Teaches the user; preserves discoverability.
- Downside: more clutter, tooltip needs real copy.

**Recommendation: Option B.** Consistent with TKA's pedagogical framing — level gates should be visible so users learn the progression.

### 4.5 Error surface for runtime infeasibility

Even with UI gating, config restoration (from favorites, URL params, saved presets) can produce an infeasible combo. Runtime check needed.

- `onGenerateClicked` → viability service → on infeasible, show inline error in the generate button area: *"This combination can't close at period 4. Switch to period 2 or raise level to 3."*
- Don't silently downgrade. Don't silently raise level. The user asked for something specific; either deliver it or explain why not.

---

## 5. Resolved Questions

### Q1 — Period-4 mechanism for non-rotated LOOPs: **none exists**

Grounded in MCP `loops` and `caps-vs-loops`. The LOOP transformation group structure (each non-rotated primitive is order 2) combined with the turn-independence axiom (turns don't affect LOOP classification) makes period 4 impossible without ROTATED in the composition. Austen's earlier intuition about "half turns in a specific way" appears to have conflated turn additions (which are independent) with LOOP structure (which is not).

### Q2 — FLIPPED's orientation action: **moot**

Since Q1 resolved to "no non-rotated period 4", the specific wheel action of FLIPPED no longer matters for this work. The TKA `orientation-algebra` topic is available if we need it later for other work.

### Q3 — UX gating: **Option A (hide the card)**

Pivoted from Option B after inspecting the existing `ToggleCard` architecture. ToggleCard is a single-button component — click anywhere on the card flips between option1 and option2. There is no per-option disable surface; adding one would require extending ToggleCard's contract across the rest of the generator (LengthCard, LevelCard, GridModeCard, TurnIntensityCard all consume the same primitive).

The cost of Option B is unjustified for one gate. Option A: when the selected `loopType` is not in `ROTATED_LOOP_TYPES`, **hide the Period card entirely**. The user still sees period 2 in effect (the default). When they switch to any rotated-containing type, the card reappears.

Teaching is now handled by Phase C's error surface: if a user forces an infeasible combo via URL/preset/favorite, the error banner explains the rule.

### Q4 — REWOUND period 4: **reject, with error**

Rewound is order 2 (reverse-of-reverse = identity). Period 4 would require an undefined operation. UI disables it. Runtime rejects it.

### Q5 — Drop `sliceSize` from ILOOPExecutor now: **scoped down — defensive asserts only**

Revised during implementation. The full contract migration (15+ files, all call sites, DI wiring) carries real regression risk and doesn't fix any user-visible defect — Phases A-C already prevent infeasible combos at both UI and pre-flight layers. Pure code hygiene shouldn't justify that blast radius.

Phase D now does the minimum required for defense-in-depth: non-rotated executors (`StrictMirroredLOOPExecutor`, `StrictFlippedLOOPExecutor`, `StrictSwappedLOOPExecutor`, `StrictInvertedLOOPExecutor`, `RewoundLOOPExecutor`) get a runtime guard that throws `LoopViabilityError` if ever invoked with `SliceSize.QUARTERED`. Contract signature deferred to a future cleanup pass.

---

## 6. Testing Strategy

**Unit tests (before implementation, TDD-style):**

- `LoopViabilityService.check(...)` — tabulated for each cell of §4.1 table. ~30 test cases.
- `StrictMirroredLOOPExecutor.executeLOOP(seq, 4)` — verifies output length = 4 × input beats, verifies closure (start pos = end pos, start ori = end ori).
- Same for other non-rotated executors once period-4 is defined per Q1.
- `CardConfigurator` — verifies period 4 is gated out at L1 for non-rotated types (Option A) or marked disabled (Option B).

**Runtime verification:**

- Generate 16-count period-4 mirrored at L3. Run `detect_loop_pattern` MCP — expect period=4 result. Today this produces period=2.
- Generate at L1 with the same settings. Expect viability error, not silent downgrade.

**Regression:**

- All existing Phase 1-10 tests (140 engine + 36 loop-labeler + migration) must stay green.
- Existing period-2 LOOPs (the default case) must produce identical output.

---

## 7. Phased Rollout

**Phase A — Viability service + UI gating (Option B)** (1-2 hours work)
- New service `LoopViabilityService` returning `{viable, reason}`.
- Wire into `PeriodCard` (disabled state + tooltip).
- Wire into `onGenerateClicked` as pre-flight.
- Tests for the table.

**Phase B — Mirror executor period-4 support** (needs Q1 resolved first)
- Extend `StrictMirroredLOOPExecutor` with period branch.
- Update contract: `executeLOOP(seq, period)`.
- Tests for period-4 output structure + closure.

**Phase C — Other non-rotated executors** (parallel to B once Q1 is answered)
- Flipped, swapped, inverted. Same pattern.
- Rewound rejects period 4.

**Phase D — Cleanup** (after A/B/C land)
- Drop `sliceSize` parameter from `ILOOPExecutor`.
- Delete `SliceSize` enum (currently `@deprecated` from Phase 10).
- Update `CardConfigurator.handleSliceSizeChange` → `handlePeriodChange`.

---

## 8. Out of Scope

- Period-8 LOOPs (L7+ territory, reserved).
- Orientation-domain-only period closure for non-rotated types (Phase 4 flag `USE_DIRECT_GEOMETRIC_LOOP_GENERATION = false` remains off).
- Compound LOOP types beyond the table in §4.1 (if new compounds are added later, extend the table).
- Changes to `orientationCycleExtender` (Phase 7 auto-extend stays as-is).

---

## 9. Status

- [x] Q1-Q5 resolved (MCP-grounded)
- [x] §4.1 viability table updated
- [x] §5 replaced with resolved answers
- [ ] Plan written (next)
- [ ] Implemented
- [ ] Verified
