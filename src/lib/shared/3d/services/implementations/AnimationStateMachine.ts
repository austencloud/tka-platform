/**
 * AnimationStateMachine
 *
 * Reads physics signals (grounded, velocity, movement input) each frame
 * and outputs which locomotion state the avatar should be in. The state
 * machine smooths animation speed for visual acceleration/deceleration
 * without affecting actual movement physics (that stays in UCC).
 *
 * State graph:
 *   IDLE ─── hasMovement ───→ WALKING
 *     │                          │
 *     └── !grounded ──→ JUMPING ←┘
 *                          │
 *                  vY <= 0 ↓
 *                       FALLING
 *                          │
 *                  grounded ↓
 *                       LANDING ──→ IDLE or WALKING (after landingDuration)
 */

export enum LocomotionState {
	IDLE = "idle",
	WALKING = "walking",
	CROUCHING = "crouching",
	JUMPING = "jumping",
	FALLING = "falling",
	LANDING = "landing",
}

export interface LocomotionStateInput {
	/** Player is pressing movement keys */
	hasMovementInput: boolean;
	/** Horizontal movement speed in scene units/sec */
	horizontalSpeed: number;
	/** Vertical velocity - positive = ascending, negative = falling */
	verticalVelocity: number;
	/** On the ground? (from PhysicsProvider.isGrounded()) */
	isGrounded: boolean;
	/** Player is holding the crouch key (Ctrl) */
	isCrouching: boolean;
	/** True on the frame jump was requested (input-driven, not physics-driven) */
	isJumpRequested?: boolean;
	/** Movement direction relative to facing (-1..+1 per axis) */
	moveDirection?: { x: number; z: number };
	/** Facing angle in radians */
	facingAngle?: number;
}

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

export interface AnimationStateMachineConfig {
	/** Time to ramp from 0 to full walk speed (seconds, default 0.15) */
	accelerationTime?: number;
	/** Time to ramp from full walk speed to 0 (seconds, default 0.2) */
	decelerationTime?: number;
	/** Duration of the landing state before auto-transition (seconds, default 0.4) */
	landingDuration?: number;
	/** Grace period before WALKING->FALLING to absorb bumps (seconds, default 0.1) */
	coyoteGrace?: number;
	/** Vertical velocity threshold to trigger jump/fall states (default 0.5) */
	verticalThreshold?: number;
}

// ── Defaults ──

const DEFAULT_CONFIG: Required<AnimationStateMachineConfig> = {
	accelerationTime: 0.08,
	decelerationTime: 0,  // Instant stop - prevents foot sliding when movement ends
	landingDuration: 0.15,
	coyoteGrace: 0.1,
	verticalThreshold: 0.5,
};

export class AnimationStateMachine {
	private state = LocomotionState.IDLE;
	private config: Required<AnimationStateMachineConfig>;

	// Speed smoothing - purely visual, doesn't affect movement
	private smoothedSpeed = 0;

	// Landing timer - auto-transition after duration
	private landingTimer = 0;

	// Coyote grace - brief delay before WALKING→FALLING to absorb bumps
	private airborneTimer = 0;

	constructor(config?: AnimationStateMachineConfig) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	update(input: LocomotionStateInput, delta: number): LocomotionStateOutput {
		this.updateState(input, delta);
		this.updateSmoothedSpeed(input, delta);

		return {
			state: this.state,
			animationSpeed: this.smoothedSpeed,
			// Crouch-walking needs directional weights too - report isMoving
			// whenever there's movement input in any grounded locomotion state.
			isMoving: this.state === LocomotionState.WALKING
				|| (this.state === LocomotionState.CROUCHING && input.hasMovementInput),
			moveDirection: input.moveDirection,
			facingAngle: input.facingAngle,
		};
	}

	getState(): LocomotionState {
		return this.state;
	}

	reset(): void {
		this.state = LocomotionState.IDLE;
		this.smoothedSpeed = 0;
		this.landingTimer = 0;
		this.airborneTimer = 0;
	}

	dispose(): void {
		// No resources to clean up - pure state machine
	}

	// ── State transitions ──

	private updateState(input: LocomotionStateInput, delta: number): void {
		const { isGrounded, hasMovementInput, verticalVelocity, isCrouching, isJumpRequested } = input;
		const { verticalThreshold, coyoteGrace, landingDuration } = this.config;

		switch (this.state) {
			case LocomotionState.IDLE:
				// Input-driven jump: immediate response, same frame as physics impulse
				if (isJumpRequested) {
					this.enterState(LocomotionState.JUMPING);
				} else if (!isGrounded && verticalVelocity < -verticalThreshold) {
					// Walked off a ledge
					this.enterState(LocomotionState.FALLING);
				} else if (isCrouching && isGrounded) {
					this.enterState(LocomotionState.CROUCHING);
				} else if (hasMovementInput && isGrounded) {
					this.enterState(LocomotionState.WALKING);
				}
				break;

			case LocomotionState.WALKING:
				// Input-driven jump from walking
				if (isJumpRequested) {
					this.enterState(LocomotionState.JUMPING);
				} else if (!isGrounded) {
					this.airborneTimer += delta;
					if (this.airborneTimer >= coyoteGrace) {
						// Walked off a ledge (no jump input)
						this.enterState(LocomotionState.FALLING);
					}
				} else {
					this.airborneTimer = 0;
					if (isCrouching) {
						this.enterState(LocomotionState.CROUCHING);
					} else if (!hasMovementInput) {
						this.enterState(LocomotionState.IDLE);
					}
				}
				break;

			case LocomotionState.CROUCHING:
				if (!isCrouching && hasMovementInput) {
					this.enterState(LocomotionState.WALKING);
				} else if (!isCrouching) {
					this.enterState(LocomotionState.IDLE);
				} else if (!isGrounded) {
					this.enterState(LocomotionState.FALLING);
				}
				break;

			case LocomotionState.JUMPING:
				if (isGrounded) {
					this.enterState(LocomotionState.LANDING);
				} else if (verticalVelocity <= 0) {
					// Reached apex
					this.enterState(LocomotionState.FALLING);
				}
				break;

			case LocomotionState.FALLING:
				if (isGrounded) {
					this.enterState(LocomotionState.LANDING);
				}
				break;

			case LocomotionState.LANDING:
				this.landingTimer += delta;
				if (this.landingTimer >= landingDuration) {
					if (isCrouching) {
						this.enterState(LocomotionState.CROUCHING);
					} else if (hasMovementInput) {
						this.enterState(LocomotionState.WALKING);
					} else {
						this.enterState(LocomotionState.IDLE);
					}
				}
				break;
		}
	}

	private enterState(newState: LocomotionState): void {
		if (this.state === newState) return;


		// Reset state-specific timers on exit
		if (this.state === LocomotionState.WALKING) {
			this.airborneTimer = 0;
		}

		this.state = newState;

		// Initialize state-specific timers on entry
		if (newState === LocomotionState.LANDING) {
			this.landingTimer = 0;
		}
	}

	// ── Speed smoothing ──

	private updateSmoothedSpeed(input: LocomotionStateInput, delta: number): void {
		const targetSpeed = input.hasMovementInput ? input.horizontalSpeed : 0;

		// Exponential lerp toward target speed.
		// Different rates for accelerating vs decelerating.
		const isAccelerating = targetSpeed > this.smoothedSpeed;
		const rampTime = isAccelerating
			? this.config.accelerationTime
			: this.config.decelerationTime;

		if (rampTime <= 0) {
			this.smoothedSpeed = targetSpeed;
		} else {
			// Convert ramp time to exponential decay factor.
			// factor = 1 - e^(-delta / rampTime) gives ~95% convergence in 3x rampTime.
			const factor = 1 - Math.exp(-delta / rampTime);
			this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * factor;
		}

		// Snap to zero when very close (avoid sub-pixel animation jitter)
		if (this.smoothedSpeed < 0.01) {
			this.smoothedSpeed = 0;
		}
	}
}
