/**
 * ILocomotionAnimator
 *
 * Plays full-body Mixamo animation clips (idle, walk, strafe)
 * via Three.js AnimationMixer. Unlike the old LegAnimator, this
 * does NOT filter out upper body bones -- the full skeleton is
 * animated. IK post-processing in AvatarAnimator selectively
 * overrides arm bones when props are held.
 */

// Unused Three.js and LocomotionState imports removed (were only used by retired interface).

/**
 * Locomotion state from the avatar movement system
 */
export interface LocomotionInput {
  /** Whether the avatar is currently moving */
  isMoving: boolean;
  /** Movement speed in scene units/sec (used to sync animation playback with actual movement) */
  speed: number;
  /** Optional: facing angle for root motion alignment */
  facingAngle?: number;
  /** Movement direction relative to facing: x (-1 left, +1 right), z (-1 back, +1 forward) */
  moveDirection?: { x: number; z: number };
}

/**
 * URLs for all locomotion animation clips
 */
export interface AnimationUrls {
  idle: string;
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
  /** Jump ascent clip (optional - needed for jump/fall/land states) */
  jump?: string;
  /** Sustained fall loop (optional) */
  fall?: string;
  /** One-shot landing recovery (optional) */
  land?: string;
  /** Crouch idle loop (optional) */
  crouch?: string;
}

/**
 * Configuration for locomotion animation behavior
 */
export interface LocomotionConfig {
  /** Base playback speed multiplier (default: 1) */
  baseSpeed?: number;
  /** Blend time when transitioning between states (seconds, default: 0.3) */
  blendTime?: number;
  /**
   * The walk animation's natural speed in scene units/sec.
   * Mixamo walk animations are typically ~1.4 m/s.
   * Animation timeScale = actualSpeed / animationWalkSpeed
   * so feet match actual ground movement. Default: 1.4
   */
  animationWalkSpeed?: number;
  /**
   * Enable root motion: keep Hips position track in animations so
   * RootMotionExtractor can read XZ displacement each frame.
   * When false (default), Hips position is filtered out as before.
   */
  enableRootMotion?: boolean;
  /**
   * Strip leg bone rotation tracks from the idle clip so feet stay
   * perfectly planted. Used for exhibit performers that stand in
   * place during sequence playback - upper body gets idle sway but
   * legs remain in bind pose. Default: false.
   */
  stripLegBones?: boolean;
}

// ILocomotionAnimator interface retired — LocomotionAnimator class is the contract now.
