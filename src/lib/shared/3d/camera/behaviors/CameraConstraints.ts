/**
 * CameraConstraints
 *
 * Enforces constraints on camera state:
 * - Pitch limits (prevent over-rotation)
 * - Distance limits (min/max zoom)
 * - Position bounds (keep camera in valid area)
 */

import { Vector3 } from "three";
import type { ICameraBehavior, CameraState, CameraBehaviorInput } from "../contracts/ICameraBehavior";
import { clamp } from "../utils/sensitivity";

export interface CameraConstraintsConfig {
	/** Maximum pitch angle in radians */
	maxPitch?: number;
	/** Minimum pitch angle in radians */
	minPitch?: number;
	/** Minimum distance from target */
	minDistance?: number;
	/** Maximum distance from target */
	maxDistance?: number;
	/** Minimum Y position (floor) */
	minY?: number;
	/** Maximum Y position (ceiling) */
	maxY?: number;
	/** Bounds for camera position */
	bounds?: {
		min: { x: number; y: number; z: number };
		max: { x: number; y: number; z: number };
	};
}

const DEFAULT_CONFIG: Required<Omit<CameraConstraintsConfig, "bounds">> & {
	bounds: CameraConstraintsConfig["bounds"];
} = {
	maxPitch: Math.PI / 2 - 0.1,
	minPitch: -Math.PI / 2 + 0.1,
	minDistance: 1,
	maxDistance: 100,
	minY: 0.5,
	maxY: 1000,
	bounds: undefined,
};

export class CameraConstraints implements ICameraBehavior {
	readonly priority = 90; // Apply near-last, before damping

	private config: typeof DEFAULT_CONFIG;

	constructor(config: CameraConstraintsConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	apply(state: CameraState, _input: CameraBehaviorInput): CameraState {
		const newState = { ...state };

		// Clamp pitch
		newState.rotation = {
			yaw: state.rotation.yaw,
			pitch: clamp(state.rotation.pitch, this.config.minPitch, this.config.maxPitch),
		};

		// Clamp distance
		if (state.distance !== undefined) {
			newState.distance = clamp(
				state.distance,
				this.config.minDistance,
				this.config.maxDistance
			);
		}

		// Clamp position Y
		const position = state.position.clone();
		position.y = clamp(position.y, this.config.minY, this.config.maxY);

		// Apply bounds if defined
		if (this.config.bounds) {
			position.x = clamp(position.x, this.config.bounds.min.x, this.config.bounds.max.x);
			position.y = clamp(position.y, this.config.bounds.min.y, this.config.bounds.max.y);
			position.z = clamp(position.z, this.config.bounds.min.z, this.config.bounds.max.z);
		}

		newState.position = position;

		return newState;
	}

	/**
	 * Update pitch limits
	 */
	setPitchLimits(min: number, max: number): void {
		this.config.minPitch = min;
		this.config.maxPitch = max;
	}

	/**
	 * Update distance limits
	 */
	setDistanceLimits(min: number, max: number): void {
		this.config.minDistance = min;
		this.config.maxDistance = max;
	}

	/**
	 * Update position bounds
	 */
	setBounds(
		min: { x: number; y: number; z: number },
		max: { x: number; y: number; z: number }
	): void {
		this.config.bounds = { min, max };
	}

	/**
	 * Clear position bounds
	 */
	clearBounds(): void {
		this.config.bounds = undefined;
	}

	reset(): void {
		// No internal state to reset
	}
}
