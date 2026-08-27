/**
 * CameraMovementController
 *
 * Framework-agnostic camera and movement controller.
 * Extracted from UnifiedCameraController.svelte for reuse across:
 * - Threlte components (Stage)
 * - Raw Three.js (Infinite Worlds)
 * - Any future renderers
 */

import type { PerspectiveCamera} from "three";
import { Vector3 as ThreeVector3 } from "three";
import { CameraMode } from "../types";
import type { PhysicsProvider, Vector3 } from "../types";

/**
 * Movement input state
 */
export interface MovementInput {
	forward: boolean;
	backward: boolean;
	left: boolean;
	right: boolean;
	sprint: boolean;
	crouch: boolean;
	jump: boolean;
}

/**
 * Look input (from mouse movement, touch, or gamepad)
 */
export interface LookInput {
	deltaYaw: number;
	deltaPitch: number;
}

/**
 * Camera state for external consumers
 */
export interface CameraState {
	mode: CameraMode;
	yaw: number;
	pitch: number;
	isPointerLocked: boolean;
	position: Vector3;
}

/**
 * Configuration for camera movement controller
 */
export interface CameraMovementConfig {
	destinationId: string;
	moveSpeed?: number;
	sprintMultiplier?: number;
	crouchMultiplier?: number;
	jumpForce?: number;
	gravity?: number;
	lookSensitivity?: number;
	thirdPersonDistance?: number;
	thirdPersonHeight?: number;
	firstPersonHeight?: number;
	orbitMinDistance?: number;
	orbitMaxDistance?: number;
}

const DEFAULT_CONFIG: Required<Omit<CameraMovementConfig, "destinationId">> = {
	moveSpeed: 5,
	sprintMultiplier: 2,
	crouchMultiplier: 0.5,
	jumpForce: 8,
	gravity: 20,
	lookSensitivity: 0.002,
	thirdPersonDistance: 5,
	thirdPersonHeight: 2,
	firstPersonHeight: 1.7,
	orbitMinDistance: 2,
	orbitMaxDistance: 50,
};

export class CameraMovementController {
	private camera: PerspectiveCamera | null = null;
	private physicsProvider: PhysicsProvider | null = null;
	private config: Required<CameraMovementConfig>;

	// Camera state
	private mode: CameraMode = CameraMode.ORBIT;
	private yaw = 0;
	private pitch = 0;
	private pointerLocked = false;

	// Player/target position
	private playerPosition = new ThreeVector3(0, 0, 0);
	private targetPosition = new ThreeVector3(0, 0, 0);

	// Movement state
	private velocity = new ThreeVector3(0, 0, 0);
	private verticalVelocity = 0;
	private isGrounded = true;

	// Orbit state
	private orbitDistance = 10;

	constructor(config: CameraMovementConfig) {
		this.config = {
			...DEFAULT_CONFIG,
			...config,
		} as Required<CameraMovementConfig>;
	}

	init(camera: PerspectiveCamera): void {
		this.camera = camera;
	}

	dispose(): void {
		this.camera = null;
		this.physicsProvider = null;
	}

	setPhysicsProvider(provider: PhysicsProvider | null): void {
		this.physicsProvider = provider;
	}

	update(
		deltaTime: number,
		movementInput: MovementInput,
		lookInput: LookInput
	): void {
		if (!this.camera) return;

		// Update look direction
		this.updateLook(lookInput);

		// Update movement based on mode
		if (this.mode === CameraMode.ORBIT) {
			this.updateOrbitCamera();
		} else {
			this.updatePlayerMovement(deltaTime, movementInput);
			this.updateFollowCamera();
		}
	}

	private updateLook(lookInput: LookInput): void {
		if (!this.pointerLocked && this.mode !== CameraMode.ORBIT) return;

		this.yaw -= lookInput.deltaYaw * this.config.lookSensitivity;
		this.pitch -= lookInput.deltaPitch * this.config.lookSensitivity;

		// Clamp pitch to prevent flipping
		this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
	}

	private updatePlayerMovement(deltaTime: number, input: MovementInput): void {
		// Build movement from camera's forward/right vectors.
		// Look direction convention: forward = (sin(yaw), 0, cos(yaw))
		// Right = perpendicular on XZ plane = (cos(yaw), 0, -sin(yaw))
		const moveDir = new ThreeVector3(0, 0, 0);

		const sinYaw = Math.sin(this.yaw);
		const cosYaw = Math.cos(this.yaw);

		// Forward/backward along look direction projected onto XZ
		const forwardInput = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
		const strafeInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);

		moveDir.x = sinYaw * forwardInput - cosYaw * strafeInput;
		moveDir.z = cosYaw * forwardInput + sinYaw * strafeInput;

		if (moveDir.lengthSq() > 0) {
			moveDir.normalize();
		}

		let speed = this.config.moveSpeed;
		if (input.sprint) speed *= this.config.sprintMultiplier;
		if (input.crouch) speed *= this.config.crouchMultiplier;

		if (this.physicsProvider) {
			// Indoor scenes: no jumping. Ground-level movement only.
			// Jump + gravity will be handled properly when IndoorScene
			// migrates to UnifiedCameraController.
			const desiredMovement: Vector3 = {
				x: moveDir.x * speed * deltaTime,
				y: 0,
				z: moveDir.z * speed * deltaTime,
			};

			this.physicsProvider.movePlayer(desiredMovement, deltaTime);
			const pos = this.physicsProvider.getPlayerPosition();
			this.playerPosition.set(pos.x, pos.y, pos.z);
			this.isGrounded = this.physicsProvider.isGrounded();
		} else {
			// Kinematic movement (simple, no collision)
			this.velocity.x = moveDir.x * speed;
			this.velocity.z = moveDir.z * speed;

			// Simple gravity
			if (!this.isGrounded) {
				this.velocity.y -= this.config.gravity * deltaTime;
			}

			// Jump
			if (input.jump && this.isGrounded) {
				this.velocity.y = this.config.jumpForce;
				this.isGrounded = false;
			}

			this.playerPosition.x += this.velocity.x * deltaTime;
			this.playerPosition.y += this.velocity.y * deltaTime;
			this.playerPosition.z += this.velocity.z * deltaTime;

			// Simple ground check (y = 0)
			if (this.playerPosition.y <= 0) {
				this.playerPosition.y = 0;
				this.velocity.y = 0;
				this.isGrounded = true;
			}
		}
	}

	private updateOrbitCamera(): void {
		if (!this.camera) return;

		// Orbit around target position
		const x = this.targetPosition.x + this.orbitDistance * Math.sin(this.yaw) * Math.cos(this.pitch);
		const y = this.targetPosition.y + this.orbitDistance * Math.sin(this.pitch);
		const z = this.targetPosition.z + this.orbitDistance * Math.cos(this.yaw) * Math.cos(this.pitch);

		this.camera.position.set(x, y, z);
		this.camera.lookAt(this.targetPosition);
	}

	private updateFollowCamera(): void {
		if (!this.camera) return;

		if (this.mode === CameraMode.FIRST_PERSON) {
			// Camera at player eye level
			this.camera.position.set(
				this.playerPosition.x,
				this.playerPosition.y + this.config.firstPersonHeight,
				this.playerPosition.z
			);

			// Look direction from yaw/pitch
			const lookDir = new ThreeVector3(
				Math.sin(this.yaw) * Math.cos(this.pitch),
				Math.sin(this.pitch),
				Math.cos(this.yaw) * Math.cos(this.pitch)
			);
			const lookTarget = this.camera.position.clone().add(lookDir);
			this.camera.lookAt(lookTarget);
		} else if (this.mode === CameraMode.THIRD_PERSON) {
			// Camera behind and above player
			const offsetX = -Math.sin(this.yaw) * this.config.thirdPersonDistance;
			const offsetZ = -Math.cos(this.yaw) * this.config.thirdPersonDistance;

			this.camera.position.set(
				this.playerPosition.x + offsetX,
				this.playerPosition.y + this.config.thirdPersonHeight,
				this.playerPosition.z + offsetZ
			);

			// Look at player
			this.camera.lookAt(
				this.playerPosition.x,
				this.playerPosition.y + this.config.firstPersonHeight,
				this.playerPosition.z
			);
		}
	}

	getState(): CameraState {
		return {
			mode: this.mode,
			yaw: this.yaw,
			pitch: this.pitch,
			isPointerLocked: this.pointerLocked,
			position: {
				x: this.playerPosition.x,
				y: this.playerPosition.y,
				z: this.playerPosition.z,
			},
		};
	}

	getMode(): CameraMode {
		return this.mode;
	}

	setMode(mode: CameraMode): void {
		this.mode = mode;
	}

	cycleMode(): CameraMode {
		const modes: CameraMode[] = [CameraMode.ORBIT, CameraMode.THIRD_PERSON, CameraMode.FIRST_PERSON];
		const currentIndex = modes.indexOf(this.mode);
		const nextIndex = (currentIndex + 1) % modes.length;
		this.mode = modes[nextIndex]!;
		return this.mode;
	}

	returnToOrbit(): void {
		this.mode = CameraMode.ORBIT;
	}

	setPointerLocked(locked: boolean): void {
		this.pointerLocked = locked;
	}

	isPointerLocked(): boolean {
		return this.pointerLocked;
	}

	setTargetPosition(position: Vector3): void {
		this.targetPosition.set(position.x, position.y, position.z);
	}

	teleport(position: Vector3): void {
		this.playerPosition.set(position.x, position.y, position.z);
		this.velocity.set(0, 0, 0);
		if (this.physicsProvider?.teleport) {
			this.physicsProvider.teleport(position);
		}
	}

	getPlayerPosition(): Vector3 {
		return {
			x: this.playerPosition.x,
			y: this.playerPosition.y,
			z: this.playerPosition.z,
		};
	}

	setYaw(yaw: number): void {
		this.yaw = yaw;
	}

	setPitch(pitch: number): void {
		this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
	}
}
