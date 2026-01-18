/**
 * FirstPersonLook
 *
 * First-person camera look behavior.
 * Applies yaw/pitch directly to camera rotation.
 * Camera position is at "eye level" - not orbiting around anything.
 */

import { Vector3 } from "three";
import type { ICameraBehavior, CameraState, CameraBehaviorInput } from "../contracts/ICameraBehavior";
import { clamp } from "../utils/sensitivity";

export interface FirstPersonLookConfig {
	/** Maximum pitch angle in radians (looking up) */
	maxPitch?: number;
	/** Minimum pitch angle in radians (looking down, negative) */
	minPitch?: number;
	/** Eye height above position.y */
	eyeHeight?: number;
	/** Sensitivity multiplier */
	sensitivity?: number;
}

const DEFAULT_CONFIG: Required<FirstPersonLookConfig> = {
	maxPitch: Math.PI / 2 - 0.1, // ~80 degrees up
	minPitch: -Math.PI / 2 + 0.1, // ~80 degrees down
	eyeHeight: 1.7, // meters
	sensitivity: 1.0,
};

export class FirstPersonLook implements ICameraBehavior {
	readonly priority = 10; // Apply early

	private config: Required<FirstPersonLookConfig>;

	constructor(config: FirstPersonLookConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	apply(state: CameraState, input: CameraBehaviorInput): CameraState {
		// Apply look delta with sensitivity
		const yaw = state.rotation.yaw + input.lookDelta.yaw * this.config.sensitivity;
		const pitch = clamp(
			state.rotation.pitch + input.lookDelta.pitch * this.config.sensitivity,
			this.config.minPitch,
			this.config.maxPitch
		);

		// Position is at eye height (first person doesn't orbit)
		const position = state.position.clone();
		position.y = (state.target?.y ?? 0) + this.config.eyeHeight;

		return {
			...state,
			position,
			rotation: { yaw, pitch },
		};
	}

	reset(): void {
		// No internal state to reset
	}
}
