/**
 * IAnimationStateMachine
 *
 * Decides which locomotion state the avatar is in (idle, walking,
 * jumping, falling, landing) based on physics signals each frame.
 * Sits between the movement system (UCC + PhysicsProvider) and
 * the clip player (LocomotionAnimator). The state machine decides
 * WHAT to play; the animator handles HOW clips blend.
 */

// ── State enum ──

export enum LocomotionState {
	IDLE = "idle",
	WALKING = "walking",
	CROUCHING = "crouching",
	JUMPING = "jumping",
	FALLING = "falling",
	LANDING = "landing",
}

// ── Per-frame input from movement/physics ──

export interface LocomotionStateInput {
	/** Player is pressing movement keys */
	hasMovementInput: boolean;
	/** Horizontal movement speed in scene units/sec */
	horizontalSpeed: number;
	/** Vertical velocity — positive = ascending, negative = falling */
	verticalVelocity: number;
	/** On the ground? (from PhysicsProvider.isGrounded()) */
	isGrounded: boolean;
	/** Player is holding the crouch key (Ctrl) */
	isCrouching: boolean;
	/** Movement direction relative to facing (-1..+1 per axis) */
	moveDirection?: { x: number; z: number };
	/** Facing angle in radians */
	facingAngle?: number;
}

// ── Per-frame output consumed by LocomotionAnimator ──

export interface LocomotionStateOutput {
	/** Current locomotion state (drives clip selection) */
	state: LocomotionState;
	/** Smoothed speed for animation playback rate (visual only) */
	animationSpeed: number;
	/** Whether walk clips should be active */
	isMoving: boolean;
	/** Directional weights for 4-way walk blending */
	moveDirection?: { x: number; z: number };
	/** Facing angle pass-through */
	facingAngle?: number;
}

// ── Configuration ──

export interface AnimationStateMachineConfig {
	/** Time to ramp from 0 to full walk speed (seconds, default 0.15) */
	accelerationTime?: number;
	/** Time to ramp from full walk speed to 0 (seconds, default 0.2) */
	decelerationTime?: number;
	/** Duration of the landing state before auto-transition (seconds, default 0.4) */
	landingDuration?: number;
	/** Grace period before WALKING→FALLING to absorb bumps (seconds, default 0.1) */
	coyoteGrace?: number;
	/** Vertical velocity threshold to trigger jump/fall states (default 0.5) */
	verticalThreshold?: number;
}

// ── Interface ──

export interface IAnimationStateMachine {
	/** Update state from this frame's physics signals. Returns output for LocomotionAnimator. */
	update(input: LocomotionStateInput, delta: number): LocomotionStateOutput;

	/** Current locomotion state */
	getState(): LocomotionState;

	/** Reset to idle (e.g. after teleport) */
	reset(): void;

	/** Clean up */
	dispose(): void;
}
