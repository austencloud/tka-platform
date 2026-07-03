# Fable Spec — Real-Flow Notation: Validate + Robust Perception Core (THE MOONSHOT)

**Date:** 2026-07-03 · **Autonomy: FULL AUTO on code (tracker, harness, UI); CHECKPOINT for real-clip validation** (Austen must shoot/provide a ground-truth clip — physical dependency) · Index: `2026-07-03-fable-dispatch-index.md`

> This is the differentiator: a notation system that **reads reality** — a real flow artist spinning on video → TKA notation, the way sheet music transcribes playing. The pure inference "brain" is built and green; the reasoning-heavy, still-unproven part is exactly the kind of work a stronger model exists for. It also builds the perception core the Practice spec consumes.

## Problem

The pipeline (`src/lib/features/train/prop-tracking-lab/`, reachable as the **"LED Notation"** tab — `src/lib/shared/navigation/config/tab-definitions.ts:908`, `VideoModule.svelte:21`) has a complete pure "brain" with **50 passing tests — but every test is synthetic.** The chain has **never been validated on real captured video.** The high-value question — *does it correctly notate real footage, with the sign/correspondence conventions holding up?* — is 100% open.

Spec's own framing: *"Roll is the unsolved crux, and without it the notation is not real TKA."*

## What's built (verified)

- **Brain (pure, tested):** `tka-pose-classifier.ts` (grid-location, in/out/clock/counter orientation, static/shift/dash, pro/anti/float, turns + rotation direction), `beat-segmenter-3d.ts`, `notation-pipeline.ts`, render bridge `notation-to-pictograph.ts` → real `PictographContainer`.
- **Capture front-end:** `color-end-tracker.ts` (PCA blob → two endpoints + thumb/pinky continuity), `screen-to-grid.ts`, `color-flow-pipeline.ts`.
- **Lab UI:** `PropTrackingLab.svelte` — 4-phase (upload → draw-box → track → review with click-to-calibrate center/radius/sample-blue/sample-red + "Notate Flow" + pictograph strip).
- **Tests:** 50 green (all synthetic — `color-end-tracker.test.ts` draws a colored line and asserts endpoints; classifier tests use hand-built vectors).
- **Note:** the plan `docs/superpowers/plans/active/2026-06-21-real-flow-notation-aruco.md` is **stale ArUco** (front-end was retired for LED color-end tracking — commit `e42cfcae8b`). The spec revision header reflects the pivot; the plan does not. Trust the code + spec, not the plan's marker-printing steps.

## The hard parts (why a stronger model earns its keep — no ground truth to catch a mistake)

1. **Thumb/pinky correspondence aliasing.** `assignThumbPinky` labels ends by nearest-to-previous; a spin rotating >180° between frames aliases the correspondence. Load-bearing twice — it sets in/out *sense* AND makes `axisDir` the 360° vector turns are counted from. One aliased frame silently corrupts orientation and turn count.
2. **Naive blob segmentation.** `findColorBlobEndpoints` does full-frame Euclidean-RGB thresholding with **no connected-component labeling** — motion blur, reflections, crossing staves, or similar-colored background merge/split the blob; PCA endpoints on a merged blob are wrong.
3. **Single-view orientation collapse.** The pivot bet is "two tracked endpoints give orientation directly." It collapses when the staff tilts toward camera: `axis2d.lengthSq() < 1e-9` → `classifyOrientation` silently returns `Orientation.OUT` (`tka-pose-classifier.ts:55`). Untested on real footage.
4. **Sign-convention minefield.** pro/anti and in/out are sign conventions; the plan's own self-review flags "two distinct angle conventions explicitly separated … to prevent a sign bug." One flipped cross-product passes every synthetic test yet inverts the whole notation on real data.
5. **Beat segmentation** (`motionThreshold`/`minHeldFrames`) is untuned against a noisy real position stream.

## Fable's task

1. **Build a real-clip validation harness** and prove the v1 single-camera wall-plane chain end-to-end on a known clip: performed sequence in → rendered pictograph strip out → diff. (Austen provides the clip + the ground-truth sequence.)
2. **Harden the tracker** where validation exposes failures: connected-component segmentation + robust correspondence (Hungarian/Kalman), out-of-plane handling, confidence gating.
3. **Reconcile CV output ↔ canonical TKA semantics ↔ rendered pictograph** — MCP-grounded at every domain boundary (orientation sense, pro/anti, turn counting).
4. Surface **per-beat confidence** + a **correction affordance** in the lab UI once the chain is proven.

## Open decisions (left to Fable)

- Tracker architecture for robust correspondence + out-of-plane (single-view heuristics vs a learned pose step vs the v2 multi-camera path — spec's endgame is *"3 cameras … multi-view triangulation → 3D + plane detection"*).
- Whether v1 single-camera wall-plane is shippable, or the sign/correspondence fragility forces the multi-view path sooner.
- Canonical-sequence export format (currently explicitly out of scope) — propose if validation succeeds.

## Guardrails + definition of done

- **CHECKPOINT:** validation needs a real ground-truth clip only Austen can shoot/label. Coordinate; do not claim "it works on real video" without a diff against a real, labeled clip (`verification-protocol`, `no-assumption-without-evidence`).
- MCP-ground every TKA domain claim in the working turn; verify semantics at the canonical source, not the classifier's current output (the classifier may itself carry a sign bug).
- Keep the 50 synthetic tests green; add real-clip regression fixtures as they're captured.
- Do not invest in a UI facelift until the chain is proven on real footage — polishing an unvalidated pipeline is wasted.
- Commit own changes only, explicit pathspec.

## Dependencies

**Builds the perception core** (camera → track → derive TKA motion) that the **Practice judgment loop** spec consumes. Do this first; Practice extends it from recorded video to live-motion judgment.
