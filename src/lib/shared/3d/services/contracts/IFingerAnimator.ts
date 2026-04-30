// src/lib/shared/3d/services/contracts/IFingerAnimator.ts
import type { GripType, FingerChains } from "../../domain/models/GripPose";

/**
 * Animates finger bones by slerping between grip pose presets.
 * Peer to ILegAnimator - operates on disjoint bone sets.
 * Instantiated per-avatar (not a DI singleton).
 */
export interface IFingerAnimator {
  /** Bind to a skeleton's finger bone chains. Call after model loads. */
  initialize(fingerChains: FingerChains): void;

  /** Whether initialize() has been called with valid finger chains. */
  isReady(): boolean;

  /** Set the target grip for one hand. Animator slerps toward it. */
  setGrip(hand: "left" | "right", type: GripType): void;

  /** Set both hands at once. */
  setGrips(leftGrip: GripType, rightGrip: GripType): void;

  /** Advance animation by deltaTime seconds. Apply bone rotations. */
  update(deltaTime: number): void;

  /** Blend speed in units/sec. 1.0 = 1s transition, 6.0 = ~170ms. Default 6.0. */
  setBlendSpeed(speed: number): void;

  /** Current grip type for a hand. */
  getCurrentGrip(hand: "left" | "right"): GripType;

  /** Release bone references. */
  dispose(): void;
}
