/**
 * RaycastAdapter
 *
 * Physics adapter using Three.js raycasting for ground detection.
 * Good for Gallery where we need ground detection but not full physics.
 */

import { Vector3, Raycaster, Object3D, Mesh } from "three";
import type { IPhysicsAdapter, PhysicsAdapterConfig } from "../contracts/IPhysicsAdapter";
import { DEFAULT_PHYSICS_CONFIG } from "../contracts/IPhysicsAdapter";

export class RaycastAdapter implements IPhysicsAdapter {
	private config: Required<PhysicsAdapterConfig>;
	private position: Vector3;
	private velocity: Vector3;
	private grounded: boolean;

	// Raycasting
	private raycaster: Raycaster;
	private groundMeshes: Object3D[];
	private downDirection = new Vector3(0, -1, 0);

	constructor(
		groundMeshes: Object3D[] = [],
		config: PhysicsAdapterConfig = {},
		initialPosition?: Vector3
	) {
		this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
		this.position = initialPosition?.clone() ?? new Vector3(0, 0, 0);
		this.velocity = new Vector3(0, 0, 0);
		this.grounded = false;
		this.groundMeshes = groundMeshes;
		this.raycaster = new Raycaster();

		// Set raycaster near/far for ground detection
		this.raycaster.near = 0;
		this.raycaster.far = this.config.playerHeight + this.config.groundCheckDistance;
	}

	move(velocity: Vector3, deltaTime: number): Vector3 {
		// Apply horizontal velocity directly
		this.velocity.x = velocity.x;
		this.velocity.z = velocity.z;

		// Apply gravity if not grounded
		if (!this.grounded) {
			this.velocity.y -= this.config.gravity * deltaTime;
		} else {
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

		// Ground check via raycast
		this.checkGround();

		return this.position.clone();
	}

	private checkGround(): void {
		if (this.groundMeshes.length === 0) {
			// No ground meshes - use simple floor at Y=0
			if (this.position.y <= 0) {
				this.position.y = 0;
				this.velocity.y = 0;
				this.grounded = true;
			} else {
				this.grounded = false;
			}
			return;
		}

		// Cast ray downward from player position (at head height)
		const rayOrigin = this.position.clone();
		rayOrigin.y += this.config.playerHeight;

		this.raycaster.set(rayOrigin, this.downDirection);
		const intersects = this.raycaster.intersectObjects(this.groundMeshes, true);

		if (intersects.length > 0) {
			const groundY = intersects[0].point.y;
			const feetY = this.position.y;

			// If feet are at or below ground level
			if (feetY <= groundY + this.config.groundCheckDistance) {
				this.position.y = groundY;
				if (this.velocity.y < 0) {
					this.velocity.y = 0;
				}
				this.grounded = true;
			} else {
				this.grounded = false;
			}
		} else {
			this.grounded = false;
		}
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
		this.checkGround();
	}

	getVelocity(): Vector3 {
		return this.velocity.clone();
	}

	/**
	 * Update ground meshes
	 */
	setGroundMeshes(meshes: Object3D[]): void {
		this.groundMeshes = meshes;
	}

	/**
	 * Add a ground mesh
	 */
	addGroundMesh(mesh: Object3D): void {
		this.groundMeshes.push(mesh);
	}

	/**
	 * Remove a ground mesh
	 */
	removeGroundMesh(mesh: Object3D): void {
		const index = this.groundMeshes.indexOf(mesh);
		if (index >= 0) {
			this.groundMeshes.splice(index, 1);
		}
	}

	dispose(): void {
		this.groundMeshes = [];
	}
}
