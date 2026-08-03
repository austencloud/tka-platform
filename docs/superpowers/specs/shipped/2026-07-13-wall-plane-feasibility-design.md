# Wall-Plane Feasibility System — Design

**Date:** 2026-07-13
**Status:** Approved (brainstormed with Austen 2026-07-13)
**Supersedes / converges:** Collision Lab (2026-04-10), Dodge Lab swept-tube work (2026-06-17..20), dual-wheel plane mode (2026-04-05, which deferred "anti-spin path cheating"), archived `negative-space-behind-body-prototype.md`.

## Problem

When the performer stays square to the audience (wall plane), some sequences are physically possible and some are not — arms cannot pass through each other. The 3D avatar has no awareness of this and passes arms through each other constantly. Two prior facts make this solvable now:

1. Detection primitives already exist (Collision Lab stance simulator, Dodge Lab swept tubes) but are lab-only/orphaned.
2. Many "impossible" wall-plane sequences ARE possible in real life by cheating: pulling an anti-spin path deeply concave toward the center, sneaking the staff under the shoulder line. The current concave interpolation cannot express this — it is a fixed reflection with no depth parameter, and it forces 4-point logic onto paths that physically make 4, 6, or 8 petals depending on turns.

Out of scope permanently for this spec: body turns and full negative-space technique (the years-long problems). Pro-rotation conflicts are not cheatable here — they route to the fallback.

## Architecture Overview

One pipeline, offline-first:

```
sequence → offline feasibility scan → verdict + per-step path params in metadata
                                            ↓
viewer reads metadata → applies plane mode + concavity params → engine renders dumb
```

Three-state verdict, never silent clipping:

| `wallFeasible` | Meaning | Viewer behavior |
|---|---|---|
| `true` | Clean in wall plane as-is | Wall plane, default paths |
| `"withCheat"` | Clean with per-step concavity overrides | Wall plane, solver's `k` values applied |
| `false` | Cannot be done square | Auto `PlaneMode.DUAL_WHEEL`, avatar turned 90° so flowers face audience, unobtrusive "shown in wheel plane" notice, manual override preserved |

Verdict + per-step params stored in sequence metadata (same convention as `metadata.pathShape`, documented in `src/lib/shared/foundation/domain/models/sequence-data.ts`).

## Phase 0 — Flower-Count Path Model (foundation)

Rebuild concave interpolation on a petal model. Sites (keep in sync):

- `src/lib/shared/3d/services/prop-state-interpolator.ts` (`resolvePathType`, `interpolateConcavePosition`)
- `src/lib/shared/animation-engine/services/prop-interpolator.ts` (2D twin)
- `src/lib/features/hand-paths/hand-path-builder/services/hand-path-animator.ts` (lab twin)

Model:

- **Petal count derives from turns**, not a forced 4-point grid: anti with 0 turns = 4 petals per cycle, continuous half turns = 6, +1 turn = 8. Petal boundaries come from actual staff-end pointing events (e.g. anti with 1 turn: end A points N, mid-step end B points NW, step end A points W while B moves through center) — the interpolator must track which end points where at petal boundaries rather than assuming grid-point-only apexes.
- **Depth parameter `k` ∈ [0, 1]** on the petal curve: `k = 0` reproduces today's shallow chord-reflection look; `k = 1` traces essentially at the center point (Austen's stated upper limit, matching real practice). Default `k` tuned for natural look.
- Fixing the petal count alone fixes the visible "smooshed" anti rendering — this phase delivers user-visible value with zero collision logic.

Validation: hand-path lab renders per petal-count case; Austen's real sequence examples captured as fixtures.

## Phase 1 — Feasibility Scan + Dual-Wheel Fallback (Option A)

**Scan (offline script, `scan-collision-lab.ts` pattern):** per sequence, per step:

1. Build a `SweptTube` per hand for the staff's path across the step (promote `swept-tube.ts` + `swept-volume-builder.ts` out of `src/lib/features/stage/locomotion/dodge/` into shared 3d services — first production consumer of that orphaned geometry).
2. Test tube-vs-arm-segment, tube-vs-tube, and tube-vs-torso using the sphere/segment primitives and thresholds from Collision Lab's `stance-simulator.ts` (`PROP_BODY_THRESHOLD = 0.02`, `ARM_ARM_THRESHOLD = 0.06`, oriented-slab torso).
3. Any hit at `k = default` → step flagged. In Phase 1 (no solver yet) any flagged step ⇒ sequence verdict `false`.

**Fallback policy (viewer):** verdict `false` → auto-select existing `PlaneMode.DUAL_WHEEL` via `avatar-instance-state.svelte.ts` (`setPlaneMode`), existing 90° facing turn, notice text, manual override intact. Dual-wheel's own negative-space gaps are a **named limitation**, not in scope.

## Phase 2 — Concavity Solver (Option B)

Offline, per flagged step (anti/concave-eligible motions only):

- Binary-search minimum `k` in [default, 1] such that the Phase 1 collision test clears. Shallowest clearing depth wins — deep pull only when needed, natural look preserved.
- All flagged steps clear → verdict `"withCheat"`, per-step `k` overrides written to metadata; viewer stays in wall plane.
- Any flagged step never clears (including all pro-rotation conflicts, which are not concave-eligible) → verdict `false`, Phase 1 fallback.

## Phase 3 — Per-Hand Depth Layering (designed now, may implement later)

Second solver degree of freedom: per-hand z-offset toward/away from the body, enabling strategic near/far staff placement and under-armpit passes (one staff necessarily closer to the body than the other).

- Solver space becomes `(k, zBlue, zRed)`; objective = minimal total deformation that clears.
- **Data shape fixed in this spec** so Phase 2 output format doesn't churn: per-step, per-hand `{ k?: number, depthOffset?: number }` in the metadata overrides block. Phase 2 writes `k` only; Phase 3 adds `depthOffset` without migration.
- Prereqs (from archived negative-space doc): body reference points on the rig, new elbow-pole IK cases in `ElbowPoleComputer` for behind-plane hand positions. These are Phase 3 implementation tasks, not Phase 0–2 blockers.

## Ground-Truth Loop

- Reuse Collision Lab's pose-label repository pattern (`local-pose-label-repository.ts`) at sequence level: Austen labels real sequences possible / impossible / cheatable.
- Scan results diffed against labels; thresholds and default `k` tuned until agreement. Labeled sequences become the regression fixture set.
- No mocap dependency: labels + fixtures substitute until/unless mocap data exists.

## What Gets Kept, Promoted, Parked

| Prior work | Disposition |
|---|---|
| `SweptTube` / `swept-volume-builder` (dodge dir) | **Promoted** to shared 3d services; core scan geometry |
| Stance-simulator primitives + thresholds | **Reused** as collision test inside scan |
| `scan-collision-lab.ts` | **Pattern reused** for the sequence scan script |
| Pose-label repository | **Pattern reused** for sequence-level ground truth |
| Dodge vacate planner / orchestrator (body steps aside) | **Parked** — stage locomotion problem, not this one |
| Collision Lab stance optimizer | **Not used** — stance stays fixed; path deforms instead |
| Dual-wheel plane mode | **Reused as-is** for fallback |
| Archived negative-space prototype doc | **Absorbed** as Phase 3 design input |

## Error Handling

- Scan failure / missing verdict in metadata → viewer treats as unscanned: current behavior (wall plane, no claims). Never block playback on scan.
- Metadata present but engine lacks petal model (version skew) → ignore `k` overrides, honor plane verdict only.

## Testing

- Phase 0: unit tests per petal-count case (0 / continuous-half / +1 turn) asserting petal boundary angles and `k=0` backward-compat with current reflection output; visual check in hand-path lab.
- Phase 1: scan script over labeled fixture set; agreement metric reported. Viewer policy unit test: verdict → plane mode mapping.
- Phase 2: solver unit tests (monotonic clearance in `k`, minimality); fixture sequences that must land `"withCheat"`.
- Phase 3: deferred with implementation.
