/**
 * CrouchSystem tests
 *
 * Verifies the three layers that make crouching work:
 * 1. State machine: CROUCHING state reports isMoving when there's movement input
 * 2. Animation clip prep: crouch clip keeps Hips Y position (body actually drops)
 * 3. Blend weights: crouch-walk produces non-zero walk + crouch weights
 */

import { describe, it, expect } from "vitest";
import { AnimationStateMachine } from "$lib/shared/3d/services/implementations/AnimationStateMachine";
import { LocomotionState } from "$lib/shared/3d/services/contracts/IAnimationStateMachine";

// ---------------------------------------------------------------------------
// 1. State machine: isMoving during crouch-walk
// ---------------------------------------------------------------------------

describe("AnimationStateMachine crouch transitions", () => {
  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      hasMovementInput: false,
      horizontalSpeed: 0,
      verticalVelocity: 0,
      isGrounded: true,
      isCrouching: false,
      isJumpRequested: false,
      moveDirection: { x: 0, z: 1 },
      facingAngle: 0,
      ...overrides,
    };
  }

  it("enters CROUCHING from IDLE when Ctrl is held", () => {
    const sm = new AnimationStateMachine();
    const output = sm.update(createInput({ isCrouching: true }), 1 / 60);
    expect(output.state).toBe(LocomotionState.CROUCHING);
  });

  it("reports isMoving=false when crouching without movement", () => {
    const sm = new AnimationStateMachine();
    const output = sm.update(createInput({ isCrouching: true }), 1 / 60);
    expect(output.state).toBe(LocomotionState.CROUCHING);
    expect(output.isMoving).toBe(false);
  });

  it("reports isMoving=true when crouching WITH movement input", () => {
    const sm = new AnimationStateMachine();
    // Enter crouch first
    sm.update(createInput({ isCrouching: true }), 1 / 60);
    // Now crouch + move
    const output = sm.update(
      createInput({ isCrouching: true, hasMovementInput: true, horizontalSpeed: 1.4 }),
      1 / 60,
    );
    expect(output.state).toBe(LocomotionState.CROUCHING);
    expect(output.isMoving).toBe(true);
  });

  it("transitions from WALKING to CROUCHING when Ctrl is pressed", () => {
    const sm = new AnimationStateMachine();
    // Start walking
    sm.update(createInput({ hasMovementInput: true, horizontalSpeed: 3.5 }), 1 / 60);
    // Hold Ctrl while moving
    const output = sm.update(
      createInput({ isCrouching: true, hasMovementInput: true, horizontalSpeed: 1.4 }),
      1 / 60,
    );
    expect(output.state).toBe(LocomotionState.CROUCHING);
    expect(output.isMoving).toBe(true);
  });

  it("returns to WALKING when Ctrl is released while moving", () => {
    const sm = new AnimationStateMachine();
    // Enter crouch-walk
    sm.update(createInput({ isCrouching: true, hasMovementInput: true }), 1 / 60);
    // Release Ctrl but keep moving
    const output = sm.update(
      createInput({ isCrouching: false, hasMovementInput: true, horizontalSpeed: 3.5 }),
      1 / 60,
    );
    expect(output.state).toBe(LocomotionState.WALKING);
  });

  it("returns to IDLE when Ctrl is released while stationary", () => {
    const sm = new AnimationStateMachine();
    sm.update(createInput({ isCrouching: true }), 1 / 60);
    const output = sm.update(createInput({ isCrouching: false }), 1 / 60);
    expect(output.state).toBe(LocomotionState.IDLE);
  });
});

// ---------------------------------------------------------------------------
// 2. Clip preparation: Hips position track retention
// ---------------------------------------------------------------------------

describe("prepareClip Hips position mode selection", () => {
  // Mirrors the hipsMode logic in prepareClip().
  // Crouch uses "pose" mode: keeps Hips position but scales cm→m (÷100).
  // Without this, the body can't drop — bone rotations alone produce a broken pose.
  function getHipsMode(
    key: string,
    enableRootMotion: boolean,
  ): "strip" | "rootMotion" | "pose" {
    const isLocomotionClip =
      key === "forward" ||
      key === "backward" ||
      key === "strafeLeft" ||
      key === "strafeRight";
    if (enableRootMotion && isLocomotionClip) return "rootMotion";
    if (key === "crouch") return "pose";
    return "strip";
  }

  it("uses pose mode for crouch (scales Hips position cm→m)", () => {
    expect(getHipsMode("crouch", false)).toBe("pose");
    expect(getHipsMode("crouch", true)).toBe("pose");
  });

  it("uses rootMotion for walk clips only with root motion enabled", () => {
    expect(getHipsMode("forward", false)).toBe("strip");
    expect(getHipsMode("forward", true)).toBe("rootMotion");
  });

  it("strips Hips position for idle/jump/fall/land", () => {
    for (const key of ["idle", "jump", "fall", "land"]) {
      expect(getHipsMode(key, false)).toBe("strip");
      expect(getHipsMode(key, true)).toBe("strip");
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Blend weights: crouch-walk drives non-zero walk weights
// ---------------------------------------------------------------------------

describe("Crouch-walk blend weights", () => {
  // Mirrors the logic from LocomotionAnimator.applyStateWeights
  function computeWeights(
    state: LocomotionState,
    targetDirWeights: Record<string, number>,
  ) {
    const isCrouching = state === LocomotionState.CROUCHING;
    const hasMovement = Object.values(targetDirWeights).some((w) => w > 0);
    const crouchWalking = isCrouching && hasMovement;

    const wantWalk =
      state === LocomotionState.WALKING ? 1 : crouchWalking ? 0.4 : 0;
    const wantCrouch = isCrouching ? (crouchWalking ? 0.6 : 1) : 0;
    const wantIdle = state === LocomotionState.IDLE ? 1 : 0;

    return { wantWalk, wantCrouch, wantIdle };
  }

  it("crouch-idle: 100% crouch, 0% walk", () => {
    const w = computeWeights(LocomotionState.CROUCHING, {
      forward: 0,
      backward: 0,
      strafeLeft: 0,
      strafeRight: 0,
    });
    expect(w.wantCrouch).toBe(1);
    expect(w.wantWalk).toBe(0);
    expect(w.wantIdle).toBe(0);
  });

  it("crouch-walk: 60% crouch + 40% walk", () => {
    const w = computeWeights(LocomotionState.CROUCHING, {
      forward: 1,
      backward: 0,
      strafeLeft: 0,
      strafeRight: 0,
    });
    expect(w.wantCrouch).toBeCloseTo(0.6);
    expect(w.wantWalk).toBeCloseTo(0.4);
    expect(w.wantIdle).toBe(0);
  });

  it("normal walk: 0% crouch, 100% walk", () => {
    const w = computeWeights(LocomotionState.WALKING, {
      forward: 1,
      backward: 0,
      strafeLeft: 0,
      strafeRight: 0,
    });
    expect(w.wantCrouch).toBe(0);
    expect(w.wantWalk).toBe(1);
    expect(w.wantIdle).toBe(0);
  });

  it("idle: 0% crouch, 0% walk, 100% idle", () => {
    const w = computeWeights(LocomotionState.IDLE, {
      forward: 0,
      backward: 0,
      strafeLeft: 0,
      strafeRight: 0,
    });
    expect(w.wantCrouch).toBe(0);
    expect(w.wantWalk).toBe(0);
    expect(w.wantIdle).toBe(1);
  });
});
