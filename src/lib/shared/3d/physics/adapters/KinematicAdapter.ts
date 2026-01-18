/**
 * KinematicAdapter
 *
 * Simple physics adapter with no collision detection.
 * Applies velocity directly to position with gravity.
 * Good for Stage where collision isn't needed.
 */

import { Vector3 } from "three";
import type { IPhysicsAdapter, PhysicsAdapterConfig } from "../contracts/IPhysicsAdapter";
import { DEFAULT_PHYSICS_CONFIG } from "../contracts/IPhysicsAdapter";

export class KinematicAdapter implements IPhysicsAdapter {
	private config: Required<PhysicsAdapterConfig>;
	private position: Vector3;
	private velocity: Vector3;
	private grounded: boolean;

	/** Floor Y position */
	private floorY: number;

	constructor(config: PhysicsAdapterConfig = {}, initialPosition?: Vector3, floorY: number = 0) {
		this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
		this.position = initialPosition?.clone() ?? new Vector3(0, 0, 0);
		this.velocity = new Vector3(0, 0, 0);
		this.grounded = true;
		this.floorY = floorY;
	}

	move(velocity: Vector3, deltaTime: number): Vector3 {
		// Apply horizontal velocity directly
		this.velocity.x = velocity.x;
		this.velocity.z = velocity.z;

		// Apply gravity to vertical velocity if not grounded
		if (!this.grounded) {
			this.velocity.y -= this.config.gravity * deltaTime;
		} else {
			// On ground, only apply vertical velocity from input (jump)
			if (velocity.y > 0) {
				this.velocity.y = velocity.y;
				this.grounded = false;
			} else {
				this.velocity.y = 0;
			}
		}

		// Update position
		this.position.x += this.velocity.x * deltaTime;
		this.position.y += this.velocity.y * deltaTime;
		this.position.z += this.velocity.z * deltaTime;

		// Ground check (simple floor plane)
		if (this.position.y <= this.floorY) {
			this.position.y = this.floorY;
			this.velocity.y = 0;
			this.grounded = true;
		}

		return this.position.clone();
	}

	jump(force: number): void {
		if (this.grounded) {
			this.velocity.y = force;
			this.grounded = false;
		}
	}

	isGrounded(): boolean {
		return this.grounded;
	}

	getPosition(): Vector3 {
		return this.position.clone();
	}

	setPosition(position: Vector3): void {
		this.position.copy(position);
		// Check if new position is on ground
		this.grounded = this.position.y <= this.floorY + 0.01;
	}

	getVelocity(): Vector3 {
		return this.velocity.clone();
	}

	/**
	 * Set floor Y position
	 */
	setFloorY(y: number): void {
		this.floorY = y;
	}

	dispose(): void {
		// No resources to clean up
	}
}
