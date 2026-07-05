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

---

## Progress — 2026-07-05 (Fable): everything buyable BEFORE the clip is built

**Status: real-clip validation still PENDING — nothing below claims "works on real video." Every result is synthetic/degraded-synthetic. Spec stays claimed (lock in place) until the ground-truth clip lands and the scorecard runs against it.**

### Shipped this pass (82/82 tests green: 50 original preserved + 10 degradation + 22 validation)

1. **Validation harness** (`validation/ground-truth.ts`, `validation/scorecard.ts` + tests, and the scorecard panel in the lab UI):
   - Ground-truth label format: cheap for a performer to supply. Three accepted shapes — harness JSON (`{"beats":[{"letter":"A","blue":{...},"red":{...}}]}`), pasted app sequence data (`steps[].motions`, i.e. `get_sequence_data` MCP output works as-is), or a bare beat array. All fields optional; only supplied fields are scored. Case/name normalization ("NORTH" → "n", "clockwise" → "cw", turns `'fl'`).
   - Scorecard: Needleman-Wunsch beat alignment (segmentation miscounts surface as insertions/deletions, not cascading off-by-ones), per-beat × per-hand × per-field match table, per-field aggregates, per-beat tracked confidence — a diagnosis, not a pass/fail bit.
   - **Camera-mirror hypothesis check**: every run also scores the left/right-mirrored detection (e↔w, clock↔counter, cw↔ccw; pro/anti invariant). If mirrored scores way better, the report says so — this is the sign-convention minefield's tripwire, resolved empirically instead of by guessing the performer-vs-camera perspective.
2. **Tracker hardening** (per the 5 named silent-failure modes):
   - *Naive blob segmentation* → connected-component labeling (8-conn iterative flood fill, following the established `led-threshold-detector.ts` pattern) + largest-component-by-mass selection + speck rejection + `secondaryMassRatio` confidence tax for same-color competitors. Endpoints are now cap centroids (near-extreme-projection pixels), not single corner pixels.
   - *Thumb/pinky aliasing* → constant-velocity prediction per endpoint + exact min-cost assignment over the two hypotheses (the 2×2 Hungarian case, solved directly — a general solver/npm dep would be dead weight for n=2). Coasts through dropouts up to 6 frames; margin between hypotheses → correspondence confidence. Degradation tests prove the old nearest-to-previous flips at >90°/frame steps and after 2-frame dropouts mid-spin where the new tracker holds the label.
   - *Out-of-plane collapse* → foreshortening ratio (projected axis length vs rolling max) → `orientation` confidence component; a staff pointing at the camera now reads as "orientation unreadable" instead of silently OUT.
   - *Sign conventions* → MCP-grounded this session (base-rotation topic: 1 turn = 180° additional, pro base = +arc/preserves, anti = −arc/reverses; center-relative-orientation topic: in/out/clock/counter; glossary: clockwise = N→E→S→W) and documented at the top of `tka-pose-classifier.ts`. Classifier logic verified consistent — no changes needed. The remaining unknown (camera mirror) is handled by the scorecard tripwire above.
   - *Beat segmentation* → new index-based `segmentBeatIndices3D` (also fixes a latent `findIndex`-by-value bug in the pipeline) with hysteresis (enter/exit thresholds) and confidence gating: dropout frames are transparent — they no longer fabricate beats mid-swing (held-last-pose looked exactly like a hold) and no longer split genuine holds.
   - Per-frame/per-beat `TrackConfidence` breakdown (`blob` / `correspondence` / `orientation` / `overall`) threaded end-to-end: tracker → pipeline → `StaffMotionNotation.confidenceDetail`.
3. **Review UI** (`NotationReviewPanel.svelte`, mounted in PropTrackingLab review phase): per-beat confidence badge (% + weakest-component tag: blob/ends/tilt), click-a-beat correction editor (SegmentedControls for motionType/orientations/rotation/locations, stepper for turns; corrections re-render that pictograph but NEVER affect the score), ground-truth paste + "Score against ground truth" → full scorecard table + mirror verdict.

### How to run the validation when the clip arrives

1. Open the **LED Notation** tab → upload the clip.
2. Draw the box, Start Tracking (existing flow) → review phase.
3. Calibrate: Set center (grid center on the wall plane), Set radius (center → any cardinal point), Sample blue staff, Sample red staff (click the LED in the paused frame).
4. **Notate Flow** → strip renders with per-beat confidence badges.
5. Paste the performed sequence into the ground-truth box (the `get_sequence_data` output of the sequence Austen performed is accepted verbatim) → **Score against ground truth**.
6. Read the scorecard: overall + per-field accuracy, per-beat diffs, insertions/deletions, low-confidence beats, and the mirror verdict. If "likely mirrored" fires, the E/W convention is flipped for this camera setup — that's the empirical answer to the perspective question; wire a mirror toggle into ScreenToGrid as the follow-up.

### Deferred / known-not-done

- **Real-clip validation** — the whole point; physically blocked on the clip.
- Headless CLI harness (node + ffmpeg frame extraction): skipped deliberately — the lab UI already owns video decode + calibration, and a CLI adds an ffmpeg/Windows dependency for no pre-clip gain. Revisit only if iteration-on-clip demands batch reruns.
- Mirror toggle in ScreenToGrid/UI: wired the *detector* (scorecard verdict), not the *switch*. One-line transform once the first clip tells us which way this camera reads.
- Kalman filter proper: constant-velocity prediction was chosen over a full Kalman state (position+velocity covariance) — for 2 endpoints at 30fps the prediction step is the value; the covariance machinery adds tuning burden with no synthetic evidence of need. Escalate only if real-clip jitter defeats CV prediction.
- Letter-only ground truth (`"word": "ABC"` expansion to expected motions) — underdetermined without start-position anchoring; pasting sequence data is just as cheap and exact.
