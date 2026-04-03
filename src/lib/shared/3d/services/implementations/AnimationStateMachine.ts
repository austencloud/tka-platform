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

import {
	LocomotionState,
	type IAnimationStateMachine,
	type LocomotionStateInput,
	type LocomotionStateOutput,
	type AnimationStateMachineConfig,
} from "../contracts/IAnimationStateMachine";

// ── Defaults ──

const DEFAULT_CONFIG: Required<AnimationStateMachineConfig> = {
	accelerationTime: 0.15,
	decelerationTime: 0.2,
	landingDuration: 0.4,
	coyoteGrace: 0.1,
	verticalThreshold: 0.5,
};

export class AnimationStateMachine implements IAnimationStateMachine {
	private state = LocomotionState.IDLE;
	private config: Required<AnimationStateMachineConfig>;

	// Speed smoothing — purely visual, doesn't affect movement
	private smoothedSpeed = 0;

	// Landing timer — auto-transition after duration
	private landingTimer = 0;

	// Coyote grace — brief delay before WALKING→FALLING to absorb bumps
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
			isMoving: this.state === LocomotionState.WALKING,
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
		// No resources to clean up — pure state machine
	}

	// ── State transitions ──

	private updateState(input: LocomotionStateInput, delta: number): void {
		const { isGrounded, hasMovementInput, verticalVelocity } = input;
		const { verticalThreshold, coyoteGrace, landingDuration } = this.config;

		switch (this.state) {
			case LocomotionState.IDLE:
				if (!isGrounded && verticalVelocity > verticalThreshold) {
					this.enterState(LocomotionState.JUMPING);
				} else if (!isGrounded && verticalVelocity < -verticalThreshold) {
					this.enterState(LocomotionState.FALLING);
				} else if (hasMovementInput && isGrounded) {
					this.enterState(LocomotionState.WALKING);
				}
				break;

			case LocomotionState.WALKING:
				if (!isGrounded) {
					// Coyote grace: don't instantly transition to airborne.
					// Absorbs single-frame ground-loss from bumps or steps.
					this.airborneTimer += delta;
					if (this.airborneTimer >= coyoteGrace) {
						if (verticalVelocity > verticalThreshold) {
							this.enterState(LocomotionState.JUMPING);
						} else {
							this.enterState(LocomotionState.FALLING);
						}
					}
				} else {
					this.airborneTimer = 0;
					if (!hasMovementInput) {
						this.enterState(LocomotionState.IDLE);
					}
				}
				break;

			case LocomotionState.JUMPING:
				if (isGrounded) {
					// Hit something and came back down
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
					if (hasMovementInput) {
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
