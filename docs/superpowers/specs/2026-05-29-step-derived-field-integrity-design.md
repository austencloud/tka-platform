# Step Derived-Field Integrity — Design

**Date:** 2026-05-29
**Status:** Design (awaiting review → writing-plans)
**Author:** Claude (Opus 4.8) + Austen
**Related:** unblocks `project_box_mode` (deck box-mode axis #33); root cause behind the box-mode VTG/elemental mislabel.

---

## 1. Problem

A step's `startPosition`, `endPosition`, and `letter` are **derived data** — pure functions of the two motions' grid locations and motion configuration. But they are also **stored** on the step, and per-motion edits mutate the motion while leaving the derived fields stale. Over a few single-hand edits the stored fields drift away from the real geometry and get **persisted in that corrupt state**.

### Canonical reproduction (Austen, 2026-05-29)

A step authored from an alpha2 seed, then edited one motion at a time, ended up as:

```jsonc
{
  "letter": "M",
  "startPosition": "alpha2",      // STALE
  "endPosition": "alpha4",        // STALE
  "gridMode": "box",
  "motions": {
    "blue": { "startLocation": "nw", "endLocation": "ne", "rotationDirection": "cw",  ... },
    "red":  { "startLocation": "sw", "endLocation": "se", "rotationDirection": "ccw", ... }
  }
}
```

Real geometry: blue `nw` + red `sw` → `getGridPositionFromLocations("nw","sw")` = **GAMMA14**, not alpha2. The stored `alpha2` + letter `M` are leftovers from before the edits. "M can't start in alpha" — correct; the data is corrupt.

### Observable downstream symptom

`tnd-calculator.ts` classifies the VTG/elemental glyph by **letter + gridMode + startPosition lookup** (`calculateTnD` → `BOX_MODE_MAP`). Fed the stale `letter:"M"` + `startPosition:"alpha2"`, `BOX_MODE_MAP["M"](alpha2)` hits the non-`GAMMA_DIAG` branch → `TOG_OPP` → **air**. The pictograph renders the wrong element glyph. This is a *symptom of the stale data*, not an independent classifier bug.

---

## 2. Root cause

**Derived fields are stored AND mutated independently of their source of truth (the motions).** There is no reconciliation step that recomputes them when a single motion changes.

Verified across the edit surface:

| Path | File | Recomputes on single-hand edit? |
|---|---|---|
| `rotateBeat` both-hand | `step-transforms.ts:180` | ✅ positions via `getGridPositionFromLocations` |
| `mirrorBeat` / `flipBeat` / `rotateBeat` **single-hand** | `step-transforms.ts:94,139,204` | ❌ keeps stale positions+letter "for instant animation" |
| `invertBeat` / `rewindBeat` both-hand | `step-transforms.ts:275,344` | ✅ letter via `findLetterByMotionConfiguration` |
| `orientation-handler` | `step-operations/orientation-handler.ts` | recomputes endOri + propagates; ❌ never positions/letter |
| `turns-handler` | `step-operations/turns-handler.ts` | recomputes endOri; ❌ never positions/letter |
| `rotation-direction-handler` | `step-operations/rotation-direction-handler.ts:184` | ✅ async letter; ❌ never positions |

The load-bearing wrong assumption is the comment *"positions are derived from both hands, so they stay valid when only one changes."* False: position is a function of **both** locations, so moving one hand changes it. And `getGridPositionFromLocations(newBlueLoc, oldRedLoc)` recomputes it **synchronously** — there was never a reason to leave it stale.

### Why a per-handler patch is the wrong fix

The bug was *born* from each edit site independently choosing whether to recompute. Patching all 8+ sites repeats that fragility — the next handler added forgets again. The fix must establish the invariant at a **chokepoint**, not scatter it.

---

## 3. The invariant

> `startPosition`, `endPosition` are pure sync functions of `(blue.location, red.location)`.
> `letter` is a pure async function of `(blue, red, gridMode)`.
> Neither is ever stored stale after a mutation.

Mirrors the codebase's existing, proven `recalculateAllOrientations` pattern (orientation is already reconciled this way).

---

## 4. Architecture — two-layer reconciliation

Positions are **sync + cheap + idempotent**; letter is **async + needs `motionQueryHandler`**. These get different chokepoints.

### Layer 1 — Sync position reconciliation at the state write chokepoint

`setCurrentSequence` (`sequence-core-state.svelte.ts:84`) is the single method every sequence write funnels through; it already normalizes `gridMode` from the sequence. Add a pure normalization pass there:

```ts
// new: sequence-derived-fields.ts
export function reconcileStepPositions(step: StepData): StepData;          // recompute start/endPosition from motions, guarded
export function normalizeSequencePositions(seq: SequenceData): SequenceData; // map reconcileStepPositions over steps + startPosition
```

`setCurrentSequence` calls `normalizeSequencePositions(sequence)` before assigning. Because positions are derived, valid data normalizes to itself (no-op) and corrupt data **self-heals**. Covers every current and future edit path with zero per-handler wiring. O(steps), pure, sync.

Also apply `reconcileStepPositions` inside the single-hand branches of `mirrorBeat`/`flipBeat`/`rotateBeat` so the transform functions are correct in isolation (not only once written back) — they are reused by batch transforms and tests.

**Guard:** `getGridPositionFromLocations` *throws* on a location pair that isn't a valid position. The reconciler wraps it in try/catch and keeps the prior position on throw (an in-flight/invalid intermediate must not crash the editor). Logged at debug.

### Layer 2 — Async letter reconciliation on edit-commit

Letter is async, so it cannot live in the sync setter. Generalize the existing, proven helper `recalculateLetterForBeat(stepNumber, state, queryHandler)` (`rotation-direction-handler.ts:281`) into a shared `reconcileStepLetter` and call it from the edit handlers whose edit **can change the letter**:

| Edit | Changes letter? | Wire letter reconcile? |
|---|---|---|
| rotation-direction (PRO↔ANTI) | yes | already wired — keep |
| turns (can flip to/from FLOAT) | yes (float letters differ) | **add** |
| single-hand location-changing transform (mirror/flip/rotate one hand) | yes | **add** at the caller |
| orientation (in/out/clock/counter) | **no** (orientation is a layer above letter) | **must NOT** — regression guard |

Letter reconcile runs on **commit** (after the edit settles), never per drag-frame, so no animation jank. It already handles FLOAT/prefloat and start-position-vs-step (`findLetterByMotionConfiguration`, `motion-query-handler.ts:326`).

### Functions reused (never hand-rolled)

- `getGridPositionFromLocations` — `grid-position-deriver.ts:114` (sync, grid-agnostic: alpha/beta/gamma/zeta/eta).
- `findLetterByMotionConfiguration` — `motion-query-handler.ts:326` (async, float/prefloat aware).
- `_deriveGridMode(blue, red)` — `grid-mode-deriver.ts` (used by existing letter recompute).
- `recalculateLetterForBeat` — `rotation-direction-handler.ts:281` (generalized into `reconcileStepLetter`).

---

## 5. What this fixes (and what it deliberately does NOT)

**Fixes:**
- Corrupt persisted steps (stale position/letter) self-heal on next write; new edits never corrupt.
- The box-mode VTG/elemental mislabel: once the step carries its real letter + gamma position, the existing `tnd-calculator` lookup is fed correct inputs.

**Explicit non-goals (separate decisions, re-evaluated AFTER this lands):**
- **Do NOT rewrite `tnd-calculator` to a geometric classifier yet.** First fix the data, then re-observe whether the box label is correct. The mislabel is hypothesized to be entirely downstream of stale data. If the lookup still mislabels on *correct* inputs, that becomes its own follow-up spec.
- **Do NOT convert derived fields to fully on-read getters** (eliminate storage). Correct end-state, but a large refactor touching every `step.startPosition`/`.letter` consumer + persisted format. Out of scope.

---

## 6. Affected files

**New:** `src/lib/shared/create/services/sequence-derived-fields.ts` (`reconcileStepPositions`, `normalizeSequencePositions`, `reconcileStepLetter`).

**Edited:**
- `sequence-core-state.svelte.ts:84` — call `normalizeSequencePositions` in `setCurrentSequence`.
- `step-transforms.ts` — single-hand branches of `mirrorBeat`/`flipBeat`/`rotateBeat` call `reconcileStepPositions`; correct the misleading comments.
- `step-operations/turns-handler.ts` — add letter reconcile on commit.
- single-hand transform caller(s) — add letter reconcile on commit (identify exact seam during planning).
- `rotation-direction-handler.ts` — refactor its private letter recompute to the shared `reconcileStepLetter` (no behavior change).

---

## 7. Testing (TDD — failing test first)

1. **Reproduction (red):** build a step from an alpha2 seed; edit one motion's location so geometry becomes GAMMA14; assert `startPosition === "gamma14"`, `endPosition` correct, `letter` re-derived (not `"M"`). Fails today.
2. **Position reconcile unit:** `reconcileStepPositions` over diamond, box (intercardinal), and skewed (zeta/eta) pairs; asserts correct GridPosition.
3. **Idempotency:** `normalizeSequencePositions(normalizeSequencePositions(seq)) === ` first result; valid data is a no-op.
4. **Invalid-pair guard:** an invalid location pair keeps the prior position and does not throw.
5. **Letter reconcile:** turns→float flips letter; rotation-direction PRO↔ANTI flips letter (regression-lock the existing behavior through the shared helper).
6. **Negative regression:** an orientation-only edit changes neither `startPosition`/`endPosition` nor `letter`.
7. **Browser verification:** re-render Austen's box-M after the fix; confirm the elemental glyph corrects (capture the label). Per verification-protocol.

---

## 8. Relationship to box mode (#33)

Box-mode cards render the VTG/elemental glyph on every pictograph. With derived fields trustworthy, box rendering is correct and the box-mode axis (sync geometric rotation, per-family direction, Diamond|Box|Both) resumes from the already-settled design. This spec is the prerequisite; box mode follows.
