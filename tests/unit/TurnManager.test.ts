/**
 * TurnManager Tests
 *
 * These tests pin the single invariant that matters for the renderer:
 * a static or dash motion that has non-zero turns MUST have a concrete
 * rotation direction (cw or ccw). An empty string or "noRotation" on a
 * spinning motion is invalid — the renderer has no way to draw it and
 * the orientation chain silently corrupts.
 *
 * The bug this guards against: the spell/word generation path called
 * updateDashStaticRotationDirections with empty strings as the previous
 * rotation direction. In CONTINUOUS mode, the function cast the empty
 * string straight into the motion data, producing static motions with
 * turns=1 and rotationDirection="".
 */

import { describe, it, expect } from "vitest";
import { updateDashStaticRotationDirections } from "$lib/features/create/generate/shared/services/turn-manager";
import { PropContinuity } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  MotionType,
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

function makeStep(overrides: {
  blueMotionType?: MotionType;
  redMotionType?: MotionType;
  blueTurns?: number;
  redTurns?: number;
  blueRot?: RotationDirection;
  redRot?: RotationDirection;
}): StepData {
  return {
    id: crypto.randomUUID(),
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: overrides.blueMotionType ?? MotionType.STATIC,
        turns: overrides.blueTurns ?? 0,
        rotationDirection: overrides.blueRot ?? RotationDirection.NO_ROTATION,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.SOUTH,
        color: MotionColor.BLUE,
        gridMode: GridMode.DIAMOND,
      }),
      [MotionColor.RED]: createMotionData({
        motionType: overrides.redMotionType ?? MotionType.STATIC,
        turns: overrides.redTurns ?? 0,
        rotationDirection: overrides.redRot ?? RotationDirection.NO_ROTATION,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.NORTH,
        color: MotionColor.RED,
        gridMode: GridMode.DIAMOND,
      }),
    },
  };
}

function isSpinningRotation(rot: string | undefined): boolean {
  return rot === RotationDirection.CLOCKWISE || rot === RotationDirection.COUNTER_CLOCKWISE;
}

describe("TurnManager.updateDashStaticRotationDirections", () => {

  // ──────────────────────────────────────────────────────────────────────
  // CONTINUOUS mode (smooth preset) — the failing case from the bug report
  // ──────────────────────────────────────────────────────────────────────

  it("inherits previous cw rotation for a static motion with turns in CONTINUOUS mode", () => {
    const step = makeStep({
      blueMotionType: MotionType.STATIC,
      blueTurns: 1,
      blueRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(step, PropContinuity.CONTINUOUS, "cw", "");

    expect(step.motions.blue!.rotationDirection).toBe(RotationDirection.CLOCKWISE);
  });

  it("inherits previous ccw rotation for a dash motion with turns in CONTINUOUS mode", () => {
    const step = makeStep({
      blueMotionType: MotionType.DASH,
      blueTurns: 1,
      blueRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(step, PropContinuity.CONTINUOUS, "ccw", "");

    expect(step.motions.blue!.rotationDirection).toBe(RotationDirection.COUNTER_CLOCKWISE);
  });

  it("falls back to a concrete rotation when CONTINUOUS mode receives an empty previous direction", () => {
    const step = makeStep({
      blueMotionType: MotionType.STATIC,
      blueTurns: 1,
      blueRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(step, PropContinuity.CONTINUOUS, "", "");

    // The critical invariant — no empty string, no "noRotation" on a spinning motion
    expect(isSpinningRotation(step.motions.blue!.rotationDirection)).toBe(true);
  });

  it("falls back to a concrete rotation when CONTINUOUS mode receives 'noRotation' as previous", () => {
    const step = makeStep({
      blueMotionType: MotionType.DASH,
      blueTurns: 1,
      blueRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(
      step,
      PropContinuity.CONTINUOUS,
      RotationDirection.NO_ROTATION,
      "",
    );

    expect(isSpinningRotation(step.motions.blue!.rotationDirection)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // RANDOM mode — already worked but pinning the invariant
  // ──────────────────────────────────────────────────────────────────────

  it("assigns a concrete rotation to static+turns in RANDOM mode", () => {
    const step = makeStep({
      blueMotionType: MotionType.STATIC,
      blueTurns: 1,
      blueRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(step, PropContinuity.RANDOM, "", "");

    expect(isSpinningRotation(step.motions.blue!.rotationDirection)).toBe(true);
  });

  it("assigns a concrete rotation to dash+turns in RANDOM mode", () => {
    const step = makeStep({
      redMotionType: MotionType.DASH,
      redTurns: 1,
      redRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(step, PropContinuity.RANDOM, "", "");

    expect(isSpinningRotation(step.motions.red!.rotationDirection)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Zero-turn motions must stay noRotation — a held static has no spin
  // ──────────────────────────────────────────────────────────────────────

  it("leaves static at 0 turns as noRotation in CONTINUOUS mode", () => {
    const step = makeStep({
      blueMotionType: MotionType.STATIC,
      blueTurns: 0,
      blueRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(step, PropContinuity.CONTINUOUS, "cw", "cw");

    expect(step.motions.blue!.rotationDirection).toBe(RotationDirection.NO_ROTATION);
  });

  it("leaves dash at 0 turns as noRotation in RANDOM mode", () => {
    const step = makeStep({
      blueMotionType: MotionType.DASH,
      blueTurns: 0,
      blueRot: RotationDirection.NO_ROTATION,
    });

    updateDashStaticRotationDirections(step, PropContinuity.RANDOM, "", "");

    expect(step.motions.blue!.rotationDirection).toBe(RotationDirection.NO_ROTATION);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Non-static/dash motions are untouched
  // ──────────────────────────────────────────────────────────────────────

  it("leaves pro motions untouched regardless of turns or mode", () => {
    const step = makeStep({
      blueMotionType: MotionType.PRO,
      blueTurns: 2,
      blueRot: RotationDirection.CLOCKWISE,
    });

    updateDashStaticRotationDirections(step, PropContinuity.CONTINUOUS, "ccw", "");

    // Pro motions keep their CSV-assigned direction; they already have one
    expect(step.motions.blue!.rotationDirection).toBe(RotationDirection.CLOCKWISE);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Full-sequence invariant — the bug report scenario
  // ──────────────────────────────────────────────────────────────────────

  it("produces a valid rotation on every static-with-turns beat when stepping through a sequence", () => {
    // Simulate the caller pattern from generate-actions.svelte.ts: apply
    // turns to each beat in order, tracking the previous rotation per color.
    const steps: StepData[] = [
      makeStep({ blueMotionType: MotionType.PRO, blueTurns: 0, blueRot: RotationDirection.CLOCKWISE }),
      makeStep({ blueMotionType: MotionType.STATIC, blueTurns: 1, blueRot: RotationDirection.NO_ROTATION }),
      makeStep({ blueMotionType: MotionType.DASH, blueTurns: 1, blueRot: RotationDirection.NO_ROTATION }),
      makeStep({ blueMotionType: MotionType.STATIC, blueTurns: 1, blueRot: RotationDirection.NO_ROTATION }),
    ];

    let prevBlueRot = "";
    let prevRedRot = "";
    for (const step of steps) {
      updateDashStaticRotationDirections(step, PropContinuity.CONTINUOUS, prevBlueRot, prevRedRot);
      const blueRot = step.motions.blue!.rotationDirection;
      const redRot = step.motions.red!.rotationDirection;
      if (blueRot && blueRot !== RotationDirection.NO_ROTATION) prevBlueRot = blueRot;
      if (redRot && redRot !== RotationDirection.NO_ROTATION) prevRedRot = redRot;
    }

    // Every spinning motion must have a concrete direction
    for (const step of steps) {
      const blue = step.motions.blue!;
      const hasBlueTurns = typeof blue.turns === "number" && blue.turns > 0;
      if (hasBlueTurns) {
        expect(isSpinningRotation(blue.rotationDirection)).toBe(true);
      }
    }

    // CONTINUOUS should have propagated beat 1's cw to beats 2, 3, 4
    expect(steps[1]!.motions.blue!.rotationDirection).toBe(RotationDirection.CLOCKWISE);
    expect(steps[2]!.motions.blue!.rotationDirection).toBe(RotationDirection.CLOCKWISE);
    expect(steps[3]!.motions.blue!.rotationDirection).toBe(RotationDirection.CLOCKWISE);
  });
});
