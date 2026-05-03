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

export interface RootMotionDelta {
  /** Local-space lateral displacement this frame (left/right) */
  x: number;
  /** Local-space forward/backward displacement this frame.
   *  Positive = forward, negative = backward.
   *  Named 'forward' (not 'z') because the raw Hips data from Mixamo
   *  uses Y for forward motion after Blender FBX→GLB conversion. */
  forward: number;
  /** Local-space yaw delta this frame in radians.
   *  Positive = counterclockwise (when viewed from above).
   *  Zero on first frame and on loop boundaries (clamped).
   *  Extracted from Hips bone rotation around the Mixamo local
   *  vertical axis, which is Z (not Y) after FBX→GLB conversion. */
  yawDelta: number;
}

// IRootMotionExtractor interface retired — RootMotionExtractor class is the contract now.
