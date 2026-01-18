/**
 * ThirdPersonOrbit
 *
 * Third-person camera that orbits around a target.
 * Classic game-style third-person camera.
 */

import { Vector3 } from "three";
import type { ICameraBehavior, CameraState, CameraBehaviorInput } from "../contracts/ICameraBehavior";
import { clamp, getDistanceScaledSensitivity } from "../utils/sensitivity";

export interface ThirdPersonOrbitConfig {
	/** Distance from target */
	distance?: number;
	/** Height offset above target */
	heightOffset?: number;
	/** Maximum pitch angle (looking down at target) */
	maxPitch?: number;
	/** Minimum pitch angle (looking up from below) */
	minPitch?: number;
	/** Base sensitivity */
	sensitivity?: number;
	/** Reference distance for sensitivity scaling */
	referenceDistance?: number;
	/** Whether to scale sensitivity by distance */
	scaleByDistance?: boolean;
}

const DEFAULT_CONFIG: Required<ThirdPersonOrbitConfig> = {
	distance: 5,
	heightOffset: 1.5,
	maxPitch: Math.PI / 3, // 60 degrees (looking down)
	minPitch: -0.2, // Slightly below horizon
	sensitivity: 1.0,
	referenceDistance: 5,
	scaleByDistance: true,
};

export class ThirdPersonOrbit implements ICameraBehavior {
	readonly priority = 10; // Apply early

	private config: Required<ThirdPersonOrbitConfig>;

	constructor(config: ThirdPersonOrbitConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	apply(state: CameraState, input: CameraBehaviorInput): CameraState {
		if (!state.target) {
			// No target, can't orbit
			return state;
		}

		const distance = state.distance ?? this.config.distance;

		// Calculate sensitivity (optionally scaled by distance)
		let sensitivity = this.config.sensitivity;
		if (this.config.scaleByDistance) {
			sensitivity *= getDistanceScaledSensitivity(distance, this.config.referenceDistance);
		}

		// Apply look delta
		const yaw = state.rotation.yaw + input.lookDelta.yaw * sensitivity;
		const pitch = clamp(
			state.rotation.pitch + input.lookDelta.pitch * sensitivity,
			this.config.minPitch,
			this.config.maxPitch
		);

		// Calculate camera position on orbit sphere
		// Camera is positioned such that it faces TOWARD the target
		// With yaw=0, camera is at +Z from target, looking toward -Z (at target)
		const cosPitch = Math.cos(pitch);
		const position = new Vector3(
			state.target.x + Math.sin(yaw) * distance * cosPitch,
			state.target.y + this.config.heightOffset + Math.sin(pitch) * distance * 0.5,
			state.target.z + Math.cos(yaw) * distance * cosPitch
		);

		return {
			...state,
			position,
			rotation: { yaw, pitch },
			distance,
		};
	}

	/**
	 * Update configuration dynamically
	 */
	setDistance(distance: number): void {
		this.config.distance = distance;
	}

	setHeightOffset(height: number): void {
		this.config.heightOffset = height;
	}

	reset(): void {
		// No internal state to reset
	}
}
