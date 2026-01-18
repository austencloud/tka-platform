/**
 * MovementCalculator
 *
 * Calculates movement velocity from input.
 * Pure logic - no physics dependency.
 */

import { Vector3 } from "three";
import type {
	IMovementController,
	MovementInput,
	MovementConfig,
	AnimationParameters,
} from "./contracts/IMovementController";

const DEFAULT_CONFIG: MovementConfig = {
	walkSpeed: 3,
	runSpeed: 8,
	jumpForce: 8,
	gravity: 20,
};

export class MovementCalculator implements IMovementController {
	private config: MovementConfig;

	// Reusable vectors to avoid allocation
	private forward = new Vector3();
	private right = new Vector3();
	private moveDir = new Vector3();

	constructor(config: Partial<MovementConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	calculateVelocity(input: MovementInput, cameraYaw: number, isSprinting: boolean): Vector3 {
		// Check if there's any input
		if (Math.abs(input.forward) < 0.01 && Math.abs(input.strafe) < 0.01) {
			return new Vector3(0, 0, 0);
		}

		// Get forward and right vectors from camera yaw
		// Forward is negative Z in Three.js convention
		this.forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
		this.right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

		// Combine inputs
		this.moveDir.set(0, 0, 0);
		this.moveDir.addScaledVector(this.forward, input.forward);
		this.moveDir.addScaledVector(this.right, input.strafe);

		// Normalize to prevent faster diagonal movement
		if (this.moveDir.lengthSq() > 0) {
			this.moveDir.normalize();
		}

		// Apply speed
		const speed = isSprinting ? this.config.runSpeed : this.config.walkSpeed;
		this.moveDir.multiplyScalar(speed);

		return this.moveDir.clone();
	}

	getAnimationParameters(
		velocity: Vector3,
		isGrounded: boolean,
		isSprinting: boolean
	): AnimationParameters {
		const horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
		const isMoving = horizontalSpeed > 0.1;

		// Calculate movement direction relative to forward
		let direction = 0;
		if (isMoving) {
			direction = Math.atan2(velocity.x, velocity.z);
		}

		return {
			speed: horizontalSpeed,
			direction,
			isRunning: isSprinting && isMoving,
			isGrounded,
			isMoving,
			verticalVelocity: velocity.y,
		};
	}

	getConfig(): MovementConfig {
		return { ...this.config };
	}

	setConfig(config: Partial<MovementConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get gravity value
	 */
	getGravity(): number {
		return this.config.gravity ?? DEFAULT_CONFIG.gravity!;
	}

	/**
	 * Get jump force
	 */
	getJumpForce(): number {
		return this.config.jumpForce;
	}
}
