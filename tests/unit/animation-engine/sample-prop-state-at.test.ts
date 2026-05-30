import { describe, it, expect, vi } from "vitest";

// ── Block transitive imports that crash at collection time ────────────────────
// getSettings (app-state) and the visibility manager both reach into heavy
// runtime graphs (scene-3d → protobufjs) that explode under vitest. Mock them to
// minimal stand-ins, mirroring the established pattern in
// endless-playback-state.test.ts. The interpolator's resolvePathType() reads
// getMotionAwarePaths/getPathShape; the orchestrator reads getEffortPreset.
vi.mock("$lib/shared/application/state/app-state.svelte", () => ({
  getSettings: vi.fn(() => ({})),
}));
vi.mock("$lib/shared/animation-engine/state/animation-visibility-state.svelte", () => ({
  getAnimationVisibilityManager: vi.fn(() => ({
    getEffortPreset: () => "linear",
    getMotionAwarePaths: () => false,
    getPathShape: () => "arc",
  })),
}));

import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
import { createAngleCalculator } from "$lib/shared/animation-engine/services/angle-calculator";
import { EndpointCalculator } from "$lib/shared/animation-engine/services/endpoint-calculator";
import { PropInterpolator } from "$lib/shared/animation-engine/services/prop-interpolator";
import {
  MotionType,
  RotationDirection,
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

// NOTE: We intentionally construct motions as plain literals rather than importing
// createMotionData. createMotionData transitively imports @austencloud/scene-3d
// (via MotionData's Plane type), which pulls protobufjs and explodes at collection
// time under vitest. The endpoint calculator + interpolator only read a handful of
// structural fields (motionType, rotationDirection, start/endLocation,
// start/endOrientation, turns, pathShape), so a minimal literal is sufficient and
// keeps this a real-data unit test without the 3D dependency graph.

/**
 * Build the real service stack the way the production factory wires it
 * (animation-playback-controller-factory.ts): AngleCalculator → EndpointCalculator
 * → PropInterpolator, plus a fresh AnimationStateManager.
 */
function buildOrchestrator(): {
  orchestrator: SequenceAnimationOrchestrator;
  stateManager: AnimationStateManager;
} {
  const angleCalculator = createAngleCalculator();
  const endpointCalculator = new EndpointCalculator(angleCalculator);
  const propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);
  const stateManager = new AnimationStateManager();
  const orchestrator = new SequenceAnimationOrchestrator(stateManager, propInterpolator);
  return { orchestrator, stateManager };
}

/**
 * Smallest real sequence the interpolator accepts: one motion step with both
 * hands present (blue PRO, red ANTI) sweeping NORTH→EAST so the interpolated
 * angles are non-trivial (not all-zero).
 */
function buildSequence(): SequenceData {
  const step: StepData = {
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter: null as unknown as StepData["letter"],
    motions: {
      blue: {
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        turns: 1,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        color: MotionColor.BLUE,
      },
      red: {
        motionType: MotionType.ANTI,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        turns: 1,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        color: MotionColor.RED,
      },
    },
  } as unknown as StepData;

  return {
    word: "T",
    name: "T",
    author: "test",
    steps: [step],
  } as unknown as SequenceData;
}

describe("SequenceAnimationOrchestrator.samplePropStateAt", () => {
  it("returns blue/red prop angles at a fractional step", () => {
    const { orchestrator } = buildOrchestrator();
    expect(orchestrator.initializeWithDomainData(buildSequence())).toBe(true);

    const sample = orchestrator.samplePropStateAt(1.5);

    expect(typeof sample.blue.centerPathAngle).toBe("number");
    expect(typeof sample.blue.staffRotationAngle).toBe("number");
    expect(typeof sample.red.centerPathAngle).toBe("number");
    expect(typeof sample.red.staffRotationAngle).toBe("number");
    expect(Number.isFinite(sample.blue.centerPathAngle)).toBe(true);
    expect(Number.isFinite(sample.red.staffRotationAngle)).toBe(true);
  });

  it("does NOT mutate the shared state manager", () => {
    const { orchestrator, stateManager } = buildOrchestrator();
    expect(orchestrator.initializeWithDomainData(buildSequence())).toBe(true);

    const before = structuredClone(stateManager.getPropStates());
    orchestrator.samplePropStateAt(1.5);
    const after = structuredClone(stateManager.getPropStates());

    expect(after).toEqual(before);
  });

  it("is deterministic — same step twice yields deep-equal results", () => {
    const { orchestrator } = buildOrchestrator();
    expect(orchestrator.initializeWithDomainData(buildSequence())).toBe(true);

    const a = orchestrator.samplePropStateAt(1.5);
    const b = orchestrator.samplePropStateAt(1.5);

    expect(a).toEqual(b);
  });
});
