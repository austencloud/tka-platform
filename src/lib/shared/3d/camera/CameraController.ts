/**
 * CameraController
 *
 * Main camera controller that orchestrates behaviors.
 * Behaviors are applied in priority order to transform camera state.
 */

import { Vector3, Camera, PerspectiveCamera } from "three";
import type { ICameraController } from "./contracts/ICameraController";
import type { ICameraBehavior, CameraState, CameraBehaviorInput } from "./contracts/ICameraBehavior";

export interface CameraControllerConfig {
	/** Initial yaw in radians */
	initialYaw?: number;
	/** Initial pitch in radians */
	initialPitch?: number;
	/** Initial position */
	initialPosition?: { x: number; y: number; z: number };
	/** Initial distance (for orbit modes) */
	initialDistance?: number;
	/** Initial FOV in degrees */
	initialFov?: number;
}

const DEFAULT_CONFIG: Required<CameraControllerConfig> = {
	initialYaw: 0,
	initialPitch: 0.3,
	initialPosition: { x: 0, y: 0, z: 0 },
	initialDistance: 5,
	initialFov: 60,
};

export class CameraController implements ICameraController {
	private behaviors: ICameraBehavior[] = [];
	private state: CameraState;
	private config: Required<CameraControllerConfig>;

	constructor(config: CameraControllerConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };

		this.state = {
			position: new Vector3(
				this.config.initialPosition.x,
				this.config.initialPosition.y,
				this.config.initialPosition.z
			),
			rotation: {
				yaw: this.config.initialYaw,
				pitch: this.config.initialPitch,
			},
			target: undefined,
			distance: this.config.initialDistance,
			fov: this.config.initialFov,
		};
	}

	// =========================================================================
	// ICameraController implementation
	// =========================================================================

	addBehavior(behavior: ICameraBehavior): void {
		this.behaviors.push(behavior);
		// Sort by priority (lower first)
		this.behaviors.sort((a, b) => a.priority - b.priority);
	}

	removeBehavior(behavior: ICameraBehavior): void {
		const index = this.behaviors.indexOf(behavior);
		if (index >= 0) {
			this.behaviors.splice(index, 1);
		}
	}

	update(deltaTime: number, lookDelta: { yaw: number; pitch: number }): void {
		const input: CameraBehaviorInput = {
			lookDelta,
			deltaTime,
			currentDistance: this.state.distance,
		};

		// Apply each behavior in priority order
		let currentState = this.state;
		for (const behavior of this.behaviors) {
			currentState = behavior.apply(currentState, input);
		}

		this.state = currentState;
	}

	applyToCamera(camera: Camera): void {
		// Apply position
		camera.position.copy(this.state.position);

		// Apply rotation (YXZ order for FPS-style)
		camera.rotation.order = "YXZ";
		camera.rotation.y = this.state.rotation.yaw;
		camera.rotation.x = -this.state.rotation.pitch; // Negative because pitch up = camera rotates down

		// Apply FOV if perspective camera
		if (this.state.fov !== undefined && camera instanceof PerspectiveCamera) {
			if (camera.fov !== this.state.fov) {
				camera.fov = this.state.fov;
				camera.updateProjectionMatrix();
			}
		}
	}

	getState(): Readonly<CameraState> {
		return this.state;
	}

	getYaw(): number {
		return this.state.rotation.yaw;
	}

	setTarget(target: { x: number; y: number; z: number } | null): void {
		if (target) {
			this.state.target = new Vector3(target.x, target.y, target.z);
		} else {
			this.state.target = undefined;
		}
	}

	reset(): void {
		// Reset state to initial values
		this.state = {
			position: new Vector3(
				this.config.initialPosition.x,
				this.config.initialPosition.y,
				this.config.initialPosition.z
			),
			rotation: {
				yaw: this.config.initialYaw,
				pitch: this.config.initialPitch,
			},
			target: undefined,
			distance: this.config.initialDistance,
			fov: this.config.initialFov,
		};

		// Reset all behaviors
		for (const behavior of this.behaviors) {
			behavior.reset?.();
		}
	}

	// =========================================================================
	// Additional utility methods
	// =========================================================================

	/**
	 * Set camera position directly (useful for teleporting)
	 */
	setPosition(x: number, y: number, z: number): void {
		this.state.position.set(x, y, z);
	}

	/**
	 * Set rotation directly
	 */
	setRotation(yaw: number, pitch: number): void {
		this.state.rotation = { yaw, pitch };
	}

	/**
	 * Set distance (for orbit modes)
	 */
	setDistance(distance: number): void {
		this.state.distance = distance;
	}

	/**
	 * Set FOV in degrees
	 */
	setFov(fov: number): void {
		this.state.fov = fov;
	}

	/**
	 * Get current distance
	 */
	getDistance(): number {
		return this.state.distance ?? this.config.initialDistance;
	}

	/**
	 * Get current pitch
	 */
	getPitch(): number {
		return this.state.rotation.pitch;
	}

	/**
	 * Look at a specific point
	 */
	lookAt(x: number, y: number, z: number): void {
		const target = new Vector3(x, y, z);
		const direction = target.clone().sub(this.state.position).normalize();

		this.state.rotation.yaw = Math.atan2(-direction.x, -direction.z);
		this.state.rotation.pitch = Math.asin(direction.y);
	}
}
