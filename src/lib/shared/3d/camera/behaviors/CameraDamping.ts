/**
 * CameraDamping
 *
 * Smooth damping/easing behavior for camera movement.
 * Applied last (high priority) to smooth all other behaviors.
 *
 * Inspired by yomotsu/camera-controls smooth transitions.
 */

import { Vector3 } from "three";
import type { ICameraBehavior, CameraState, CameraBehaviorInput } from "../contracts/ICameraBehavior";
import { lerp, smoothDampFactor } from "../utils/sensitivity";

export interface CameraDampingConfig {
	/** Position smoothing time in seconds (lower = snappier) */
	positionSmoothTime?: number;
	/** Rotation smoothing time in seconds */
	rotationSmoothTime?: number;
	/** Whether damping is enabled */
	enabled?: boolean;
}

const DEFAULT_CONFIG: Required<CameraDampingConfig> = {
	positionSmoothTime: 0.1,
	rotationSmoothTime: 0.08,
	enabled: true,
};

export class CameraDamping implements ICameraBehavior {
	readonly priority = 100; // Apply last

	private config: Required<CameraDampingConfig>;
	private smoothedState: CameraState | null = null;

	constructor(config: CameraDampingConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	apply(state: CameraState, input: CameraBehaviorInput): CameraState {
		if (!this.config.enabled) {
			return state;
		}

		// Initialize smoothed state on first call
		if (!this.smoothedState) {
			this.smoothedState = {
				position: state.position.clone(),
				rotation: { ...state.rotation },
				target: state.target?.clone(),
				distance: state.distance,
				fov: state.fov,
			};
			return state;
		}

		const dt = input.deltaTime;

		// Calculate damping factors
		const posFactor = smoothDampFactor(this.config.positionSmoothTime, dt);
		const rotFactor = smoothDampFactor(this.config.rotationSmoothTime, dt);

		// Smooth position
		this.smoothedState.position.lerp(state.position, posFactor);

		// Smooth rotation
		this.smoothedState.rotation.yaw = lerp(
			this.smoothedState.rotation.yaw,
			state.rotation.yaw,
			rotFactor
		);
		this.smoothedState.rotation.pitch = lerp(
			this.smoothedState.rotation.pitch,
			state.rotation.pitch,
			rotFactor
		);

		// Smooth target if present
		if (state.target) {
			if (!this.smoothedState.target) {
				this.smoothedState.target = state.target.clone();
			} else {
				this.smoothedState.target.lerp(state.target, posFactor);
			}
		}

		// Smooth distance if present
		if (state.distance !== undefined) {
			this.smoothedState.distance = lerp(
				this.smoothedState.distance ?? state.distance,
				state.distance,
				posFactor
			);
		}

		// Smooth FOV if present
		if (state.fov !== undefined) {
			this.smoothedState.fov = lerp(
				this.smoothedState.fov ?? state.fov,
				state.fov,
				posFactor
			);
		}

		return {
			position: this.smoothedState.position.clone(),
			rotation: { ...this.smoothedState.rotation },
			target: this.smoothedState.target?.clone(),
			distance: this.smoothedState.distance,
			fov: this.smoothedState.fov,
		};
	}

	/**
	 * Enable/disable damping
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
	}

	/**
	 * Update smooth times
	 */
	setSmoothTime(position: number, rotation?: number): void {
		this.config.positionSmoothTime = position;
		this.config.rotationSmoothTime = rotation ?? position;
	}

	reset(): void {
		this.smoothedState = null;
	}
}
