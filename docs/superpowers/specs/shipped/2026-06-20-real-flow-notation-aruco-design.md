---
status: shipped
value: 4
effort: S
remaining: ""
depends_on: ""
plan_path: ""
tags: [notation, video, train]
last_triaged: 2026-08-03
---
# Real Flow to TKA Sequence: LED Notation

**Date:** 2026-06-20, revised 2026-06-21
**Status:** Shipped for the synthetic pipeline. Real-video validation remains open in `docs/superpowers/specs/active/2026-07-03-fable-real-flow-notation-validation-design.md`.

## Shipped result

The lab turns video frames into a reviewable notation strip through the endpoint-tracking path:

```text
video frames
  -> illuminated staff detection
  -> endpoint pairs
  -> screen-to-grid calibration
  -> per-frame staff poses and confidence
  -> beat segmentation and motion classification
  -> reviewable pictograph strip and scorecard
```

`PropTrackingLab.svelte` defaults to `IntensityStaffTracker` for color-cycling LEDs against dark footage. `ColorEndTracker` remains the fixed-color alternative. Both paths feed `ScreenToGrid`, `endpointPairToPose`, and `framesToNotation`. The review surface receives the resulting notation and per-beat confidence data.

The implementation lives in `src/lib/features/train/prop-tracking-lab/`:

- `components/PropTrackingLab.svelte` owns video extraction, calibration, tracker selection, and orchestration.
- `services/intensity-staff-tracker.ts` and `services/color-end-tracker.ts` detect the two staff endpoints.
- `services/screen-to-grid.ts` maps video pixels into the calibrated grid frame.
- `services/color-flow-pipeline.ts` converts endpoint pairs into staff poses.
- `services/notation-pipeline.ts`, `services/beat-segmenter-3d.ts`, and `services/tka-pose-classifier.ts` derive the notation.
- `components/NotationReviewPanel.svelte` renders corrections, confidence, and ground-truth scoring.

## The retired ArUco path

The original proposal used printed ArUco markers, camera-frame pose estimation, and a grid-frame solver. Capture moved to illuminated staff endpoints on 2026-06-21. Commit `e42cfcae8b` removed the ArUco tracker, solver, marker sheet, and vendored `js-aruco2` sources.

The original implementation plan is preserved only as history at `docs/superpowers/plans/archived/2026-06-21-real-flow-notation-aruco.md`. Its marker-printing and ArUco implementation steps must not be executed.

## Verification boundary

The focused suite covers endpoint detection, correspondence, calibration, segmentation, classification, conversion, confidence propagation, and scorecard behavior with generated inputs. It does not prove correct transcription of real spinning footage.

Physical verification has one owner: `docs/superpowers/specs/active/2026-07-03-fable-real-flow-notation-validation-design.md`. That spec remains blocked on a labeled performance clip and interactive calibration. No real-video claim is made here.

## Completion record

- [x] Focused verification on 2026-08-03: 10 test files, 79 tests passed.
- [x] Repository check on 2026-08-03: 0 errors and 0 warnings.
- [x] Replace the ArUco capture front end with illuminated endpoint tracking.
- [x] Remove the runtime ArUco tracker, solver, marker generator, and vendor library.
- [x] Wire capture through calibration, notation, review, and scoring.
- [x] Remove the remaining unused ArUco marker DTOs and their self-tests.
- [x] Archive the obsolete implementation plan.
- [x] Keep real-video validation open under its dedicated active spec.
