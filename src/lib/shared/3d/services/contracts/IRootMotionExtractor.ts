/**
 * IRootMotionExtractor
 *
 * Extracts per-frame position deltas from the Hips bone after the
 * AnimationMixer updates bone transforms. This delta represents
 * how far the animation wants the character to move this frame.
 *
 * After reading the delta, the extractor zeros out the Hips XZ
 * position so the mesh stays centered on its group. The caller
 * applies the delta to the group position (with collision checks).
 *
 * Pipeline:
 *   AnimationMixer.update(delta)   -- writes Hips position from clip
 *   RootMotionExtractor.extract()  -- reads Hips XZ delta, zeros it
 *   PhysicsProvider.movePlayer()   -- applies delta with collision
 */

import type { Bone } from "three";

export interface RootMotionDelta {
  /** Local-space lateral displacement this frame (left/right) */
  x: number;
  /** Local-space forward/backward displacement this frame.
   *  Positive = forward, negative = backward.
   *  Named 'forward' (not 'z') because the raw Hips data from Mixamo
   *  uses Y for forward motion after Blender FBX→GLB conversion. */
  forward: number;
}

export interface IRootMotionExtractor {
  /**
   * Initialize with the Hips bone reference.
   * Must be called after the GLTF model is loaded.
   */
  initialize(hipsBone: Bone): void;

  /**
   * Read the Hips XZ delta since last frame, then zero out the
   * Hips XZ position so the mesh stays centered.
   *
   * Call this AFTER AnimationMixer.update() each frame.
   * Returns { x: 0, z: 0 } if not initialized or no movement.
   */
  extract(): RootMotionDelta;

  /**
   * Reset the previous position tracker. Call this when:
   * - Animation loops (prevents delta spike at loop boundary)
   * - State changes (prevents carryover between clips)
   */
  reset(): void;

  /**
   * Whether the extractor is initialized with a valid Hips bone.
   */
  isReady(): boolean;

  /**
   * Clean up references.
   */
  dispose(): void;
}
