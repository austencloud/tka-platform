import type { PerspectiveCamera } from "three";
import { Vector3 as ThreeVector3 } from "three";
import { CameraMode } from "../types";
import type { PhysicsProvider, Vector3 } from "../types";

export interface MovementInput {
	forward: boolean;
	backward: boolean;
	left: boolean;
	right: boolean;
	sprint: boolean;
	crouch: boolean;
	jump: boolean;
}

export interface LookInput {
	deltaYaw: number;
	deltaPitch: number;
}

export interface CameraMovementState {
	mode: CameraMode;
	yaw: number;
	pitch: number;
	isPointerLocked: boolean;
	position: Vector3;
}

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
	private mode: CameraMode = CameraMode.ORBIT;
	private yaw = 0;
	private pitch = 0;
	private pointerLocked = false;
	private playerPosition = new ThreeVector3(0, 0, 0);
	private targetPosition = new ThreeVector3(0, 0, 0);
	private velocity = new ThreeVector3(0, 0, 0);
	private verticalVelocity = 0;
	private isGrounded = true;
	private orbitDistance = 10;

	constructor(config: CameraMovementConfig) {
		this.config = { ...DEFAULT_CONFIG, ...config } as Required<CameraMovementConfig>;
	}

	init(camera: PerspectiveCamera): void { this.camera = camera; }
	dispose(): void { this.camera = null; this.physicsProvider = null; }
	setPhysicsProvider(provider: PhysicsProvider | null): void { this.physicsProvider = provider; }

	update(deltaTime: number, movementInput: MovementInput, lookInput: LookInput): void {
		if (!this.camera) return;
		this.updateLook(lookInput);
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
		this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
	}

	private updatePlayerMovement(deltaTime: number, input: MovementInput): void {
		const moveDir = new ThreeVector3(0, 0, 0);
		const sinYaw = Math.sin(this.yaw);
		const cosYaw = Math.cos(this.yaw);
		const forwardInput = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
		const strafeInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
		moveDir.x = sinYaw * forwardInput - cosYaw * strafeInput;
		moveDir.z = cosYaw * forwardInput + sinYaw * strafeInput;
		if (moveDir.lengthSq() > 0) moveDir.normalize();

		let speed = this.config.moveSpeed;
		if (input.sprint) speed *= this.config.sprintMultiplier;
		if (input.crouch) speed *= this.config.crouchMultiplier;

		if (this.physicsProvider) {
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
			this.velocity.x = moveDir.x * speed;
			this.velocity.z = moveDir.z * speed;
			if (!this.isGrounded) this.velocity.y -= this.config.gravity * deltaTime;
			if (input.jump && this.isGrounded) {
				this.velocity.y = this.config.jumpForce;
				this.isGrounded = false;
			}
			this.playerPosition.x += this.velocity.x * deltaTime;
			this.playerPosition.y += this.velocity.y * deltaTime;
			this.playerPosition.z += this.velocity.z * deltaTime;
			if (this.playerPosition.y <= 0) {
				this.playerPosition.y = 0;
				this.velocity.y = 0;
				this.isGrounded = true;
			}
		}
	}

	private updateOrbitCamera(): void {
		if (!this.camera) return;
		const x = this.targetPosition.x + this.orbitDistance * Math.sin(this.yaw) * Math.cos(this.pitch);
		const y = this.targetPosition.y + this.orbitDistance * Math.sin(this.pitch);
		const z = this.targetPosition.z + this.orbitDistance * Math.cos(this.yaw) * Math.cos(this.pitch);
		this.camera.position.set(x, y, z);
		this.camera.lookAt(this.targetPosition);
	}

	private updateFollowCamera(): void {
		if (!this.camera) return;
		if (this.mode === CameraMode.FIRST_PERSON) {
			this.camera.position.set(
				this.playerPosition.x,
				this.playerPosition.y + this.config.firstPersonHeight,
				this.playerPosition.z,
			);
			const lookDir = new ThreeVector3(
				Math.sin(this.yaw) * Math.cos(this.pitch),
				Math.sin(this.pitch),
				Math.cos(this.yaw) * Math.cos(this.pitch),
			);
			const lookTarget = this.camera.position.clone().add(lookDir);
			this.camera.lookAt(lookTarget);
		} else if (this.mode === CameraMode.THIRD_PERSON) {
			const offsetX = -Math.sin(this.yaw) * this.config.thirdPersonDistance;
			const offsetZ = -Math.cos(this.yaw) * this.config.thirdPersonDistance;
			this.camera.position.set(
				this.playerPosition.x + offsetX,
				this.playerPosition.y + this.config.thirdPersonHeight,
				this.playerPosition.z + offsetZ,
			);
			this.camera.lookAt(
				this.playerPosition.x,
				this.playerPosition.y + this.config.firstPersonHeight,
				this.playerPosition.z,
			);
		}
	}

	getState(): CameraMovementState {
		return {
			mode: this.mode,
			yaw: this.yaw,
			pitch: this.pitch,
			isPointerLocked: this.pointerLocked,
			position: { x: this.playerPosition.x, y: this.playerPosition.y, z: this.playerPosition.z },
		};
	}

	getMode(): CameraMode { return this.mode; }
	setMode(mode: CameraMode): void { this.mode = mode; }
	cycleMode(): CameraMode {
		const modes = [CameraMode.ORBIT, CameraMode.THIRD_PERSON, CameraMode.FIRST_PERSON];
		const idx = modes.indexOf(this.mode);
		this.mode = modes[(idx + 1) % modes.length]!;
		return this.mode;
	}
	returnToOrbit(): void { this.mode = CameraMode.ORBIT; }
	setPointerLocked(locked: boolean): void { this.pointerLocked = locked; }
	setTargetPosition(position: Vector3): void { this.targetPosition.set(position.x, position.y, position.z); }
	teleport(position: Vector3): void {
		this.playerPosition.set(position.x, position.y, position.z);
		this.velocity.set(0, 0, 0);
		this.physicsProvider?.teleport?.(position);
	}
	getPlayerPosition(): Vector3 {
		return { x: this.playerPosition.x, y: this.playerPosition.y, z: this.playerPosition.z };
	}
	setYaw(yaw: number): void { this.yaw = yaw; }
	setPitch(pitch: number): void { this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch)); }
}
