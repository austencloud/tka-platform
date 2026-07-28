---
status: shipped
value: 5
effort: S
remaining: ""
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-28
---
# Fable Dispatch — Index

**Date:** 2026-07-03
**Status:** Dispatch complete. This is a reference map; each linked spec owns its remaining work and queue state.
**Purpose:** seven self-contained specs prepared for execution by a stronger reasoning model (Fable 5), in two clusters — a **correctness cluster** (4) and **game-changer features** (3). Each is dispatchable independently in a fresh session — no shared conversation context assumed. This index is a map, not a campaign spec.

## The two root causes that bind the set

Most of the difficulty across these tasks traces to two design patterns. Fix the **class**, not the instance.

- **A. Detection heuristics key off one motion axis.** Loop detection and reversal detection both compare raw `rotationDirection` (cw/ccw) when correctness needs the full motion signal — hand-arc direction, `motionType` (pro/anti), and the pro-anti relation (`pro` = prop spins the same direction as the hand's arc). `rotationDirection` is flipped by mirror/flip/invert/rewound, so it cancels in composites and false-positives on singles. Spans specs **1** and **2**.
- **B. Round-trip-derived fields leak into the identity hash.** Reversal flags and `gridMode` are recomputed on every load but serialized into the content hash, making a sequence's identity load-path- and algorithm-dependent → phantom forks on resave. Spans specs **3** and **4**.

## The four specs

| # | Spec | Autonomy | Risk |
|---|---|---|---|
| 1 | [Loop-detection audit fixes](../active/2026-07-03-fable-loop-detection-audit-fixes-design.md) | **Code DONE 2026-07-05**; runtime publication remains tracked by the child spec | Detection algebra and regression coverage shipped in `f3f2eab145`. |
| 2 | [Hand-arc-aware reversal detector](2026-07-03-fable-hand-arc-reversal-detector-design.md) | **DONE 2026-07-05** | Canonical derivation and regression coverage shipped in `6423f92e2b` and `63a3840053`. |
| 3 | [Content-hash V2 rollout](2026-07-03-fable-content-hash-v2-rollout-execution-design.md) | ~~Checkpoint~~ **DONE** | **Resolved 2026-07-05: rollout had already executed 2026-06-30** (`d814ad76d3`→`4a9b8e872c`), before this spec was staged. Post-execution verification on live corpus green (38/38 tests, 936 docs, 0 would-rewrite, 0 would-fork): see [checkpoint package](../active/2026-07-05-content-hash-v2-checkpoint-package.md). Spec 2's ship-gate is satisfied. |
| 4 | [StepData→Step + MotionData→Motion remainder](2026-07-03-fable-stepdata-motion-migration-remainder-design.md) | ~~Checkpoint~~ **DONE 2026-07-11** | W0 fixed the 8 silent-corruption/dead-gate sites (2026-07-05, `cd2b8ee349`); W1 widening + cast fixes and W2 extras retirement executed 2026-07-09; residual widening slices closed as not-worth-executing (zero behavioral gain). End state = Option C subtypes by design. Record: [checkpoint package](2026-07-05-stepdata-migration-checkpoint-package.md) §5-6. |

## Recommended sequence

1. **Spec 3 before Spec 2.** Spec 2 (hand-arc detector) *increases* reversal dots. While reversal flags remain in the identity hash, that mass-shifts `contentHash` for ~29% of the corpus. Spec 3's Option A *removes* derived fields from the hash — land it first and Track C becomes identity-safe.
2. **Spec 1 anytime** (independent; shares root-cause A with Spec 2 — Fable may unify the motion-signal model across both).
3. **Spec 4 independent**, but coordinate its identity/derivation concerns with Spec 3 (shared root-cause B; the loop-wrap reversal semantics touch both).

## Game-changer features (the high-return targets)

Chosen from a six-pillar scout of the codebase (real-flow, practice, create, mandala, museum, complete-system explorability), ranked by mission-value × Fable-fit × facelift-worthiness. These are feature builds, not correctness fixes.

| Spec | Kind | Autonomy | Why Fable |
|---|---|---|---|
| [Real-flow notation — validate + robust perception core](../active/2026-07-03-fable-real-flow-notation-validation-design.md) | Moonshot / differentiator | Code half ✅ 2026-07-05 (82/82 tests); **real-clip validation PARKED 2026-07-11 per Austen ("pass on 5 for now")** — active prop-tracking-lab session continues separately | Reasoning-limited inference with no ground truth (sign conventions, correspondence aliasing, out-of-plane) |
| [Practice judgment loop](../active/2026-07-03-fable-practice-judgment-loop-design.md) | Retention pillar | Full auto; **checkpoint** on game-feel | CV judgment + calibration + non-gameable game-feel design |
| [Mandala signature identity](../active/2026-07-03-fable-mandala-signature-identity-design.md) | Facelift / virality | Aesthetic checkpoint PASSED 2026-07-12 (9-candidate page → Austen picked ink/gilded/abyss); presets + per-preset backgrounds SHIPPED `0e97409bfc` (viewer + MP4 export). **Remainder PARKED per Austen scope-down**: trails, tka.run share links, print/poster, hero surface | Taste-heavy beauty on a rigorous substrate; the shareable-art pillar |

### The unifying insight (perception core)

Real-flow and Practice **share one reasoning-limited core**: camera → track prop/hand → derive TKA motion → compare to expected. *TKA that perceives reality.* Build it once, on real-flow (bounded, the brain already exists, has ground truth), then Practice extends it from recorded video to live-motion judgment.

### Sequence

- **Real-flow before Practice** (Practice consumes the perception core).
- **Mandala independent** — the facelift, parallelizable anytime.
- Alternative facelift on deck: **elemental-model visualization** (bolder net-new; noted inside the mandala spec).

### Window note

Fable is available a limited window (through 2026-07-07). Favor **reasoning-bottleneck, bounded slices** over XL labor: the real-flow validation core and the mandala facelift both fit; the full Practice loop is XL and should be scoped to the perception-core slice first.

## Autonomy convention (used in each spec)

- **Full auto** — Fable designs, implements, tests, and commits itself (own changes only, explicit pathspec). Stops only at physical blockers.
- **Checkpoint** — Fable produces the design/analysis/proof and presents it for Austen's go before any irreversible or prod action. After greenlight, executes end-to-end (including the prod migration for Spec 3).

The **fix decisions are deliberately left to Fable** in every spec — the "Open decisions" section names them. These specs package the problem, evidence, ground truth, and guardrails; they do not prescribe the solution.
