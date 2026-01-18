/**
 * RapierAdapter
 *
 * Full physics adapter using Rapier physics engine.
 * Good for Worlds where we need full collision and physics.
 *
 * Note: This is a placeholder implementation. The actual Rapier integration
 * depends on how Rapier is loaded in the Worlds feature.
 */

import { Vector3 } from "three";
import type { IPhysicsAdapter, PhysicsAdapterConfig } from "../contracts/IPhysicsAdapter";
import { DEFAULT_PHYSICS_CONFIG } from "../contracts/IPhysicsAdapter";

// Type definitions for Rapier (would normally come from @dimforge/rapier3d)
interface RapierWorld {
	step(): void;
	createRigidBody(desc: unknown): RapierRigidBody;
	createCollider(desc: unknown, parent: RapierRigidBody): RapierCollider;
	removeRigidBody(body: RapierRigidBody): void;
	castRay(ray: unknown, maxToi: number, solid: boolean): RapierRayHit | null;
}

interface RapierRigidBody {
	translation(): { x: number; y: number; z: number };
	linvel(): { x: number; y: number; z: number };
	setTranslation(pos: { x: number; y: number; z: number }, wake: boolean): void;
	setLinvel(vel: { x: number; y: number; z: number }, wake: boolean): void;
	applyImpulse(impulse: { x: number; y: number; z: number }, wake: boolean): void;
}

interface RapierCollider {
	// Collider methods
}

interface RapierRayHit {
	toi: number;
	normal: { x: number; y: number; z: number };
}

export interface RapierAdapterOptions {
	world: RapierWorld;
	rigidBody: RapierRigidBody;
	collider: RapierCollider;
}

export class RapierAdapter implements IPhysicsAdapter {
	private config: Required<PhysicsAdapterConfig>;
	private world: RapierWorld | null;
	private rigidBody: RapierRigidBody | null;
	private collider: RapierCollider | null;
	private grounded: boolean;

	// Fallback position when Rapier not available
	private fallbackPosition: Vector3;
	private fallbackVelocity: Vector3;

	constructor(options?: RapierAdapterOptions, config: PhysicsAdapterConfig = {}) {
		this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
		this.world = options?.world ?? null;
		this.rigidBody = options?.rigidBody ?? null;
		this.collider = options?.collider ?? null;
		this.grounded = false;

		this.fallbackPosition = new Vector3(0, 0, 0);
		this.fallbackVelocity = new Vector3(0, 0, 0);
	}

	move(velocity: Vector3, deltaTime: number): Vector3 {
		if (!this.rigidBody) {
			// Fallback to simple kinematic movement
			return this.fallbackMove(velocity, deltaTime);
		}

		// Set horizontal velocity
		const currentVel = this.rigidBody.linvel();
		this.rigidBody.setLinvel(
			{
				x: velocity.x,
				y: this.grounded ? (velocity.y > 0 ? velocity.y : currentVel.y) : currentVel.y,
				z: velocity.z,
			},
			true
		);

		// Step physics (if we own the world step)
		// Note: In actual usage, the world step is typically done elsewhere
		// this.world?.step();

		// Get new position
		const pos = this.rigidBody.translation();
		return new Vector3(pos.x, pos.y, pos.z);
	}

	private fallbackMove(velocity: Vector3, deltaTime: number): Vector3 {
		this.fallbackVelocity.x = velocity.x;
		this.fallbackVelocity.z = velocity.z;

		if (!this.grounded) {
			this.fallbackVelocity.y -= this.config.gravity * deltaTime;
		} else if (velocity.y > 0) {
			this.fallbackVelocity.y = velocity.y;
			this.grounded = false;
		} else {
			this.fallbackVelocity.y = 0;
		}

		this.fallbackPosition.x += this.fallbackVelocity.x * deltaTime;
		this.fallbackPosition.y += this.fallbackVelocity.y * deltaTime;
		this.fallbackPosition.z += this.fallbackVelocity.z * deltaTime;

		if (this.fallbackPosition.y <= 0) {
			this.fallbackPosition.y = 0;
			this.fallbackVelocity.y = 0;
			this.grounded = true;
		}

		return this.fallbackPosition.clone();
	}

	jump(force: number): void {
		if (!this.grounded) return;

		if (this.rigidBody) {
			this.rigidBody.applyImpulse({ x: 0, y: force, z: 0 }, true);
		} else {
			this.fallbackVelocity.y = force;
		}
		this.grounded = false;
	}

	isGrounded(): boolean {
		if (this.rigidBody && this.world) {
			// In real implementation, cast ray down to check ground
			// For now, use simple Y check
			const pos = this.rigidBody.translation();
			this.grounded = pos.y < 0.1;
		}
		return this.grounded;
	}

	getPosition(): Vector3 {
		if (this.rigidBody) {
			const pos = this.rigidBody.translation();
			return new Vector3(pos.x, pos.y, pos.z);
		}
		return this.fallbackPosition.clone();
	}

	setPosition(position: Vector3): void {
		if (this.rigidBody) {
			this.rigidBody.setTranslation(
				{ x: position.x, y: position.y, z: position.z },
				true
			);
		} else {
			this.fallbackPosition.copy(position);
		}
	}

	getVelocity(): Vector3 {
		if (this.rigidBody) {
			const vel = this.rigidBody.linvel();
			return new Vector3(vel.x, vel.y, vel.z);
		}
		return this.fallbackVelocity.clone();
	}

	/**
	 * Connect to Rapier world after initialization
	 */
	connect(options: RapierAdapterOptions): void {
		this.world = options.world;
		this.rigidBody = options.rigidBody;
		this.collider = options.collider;

		// Sync position
		if (this.rigidBody) {
			this.rigidBody.setTranslation(
				{
					x: this.fallbackPosition.x,
					y: this.fallbackPosition.y,
					z: this.fallbackPosition.z,
				},
				true
			);
		}
	}

	dispose(): void {
		if (this.rigidBody && this.world) {
			this.world.removeRigidBody(this.rigidBody);
		}
		this.world = null;
		this.rigidBody = null;
		this.collider = null;
	}
}
