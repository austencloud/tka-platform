/**
 * IInputProvider
 *
 * Unified interface for all input sources (keyboard, touch, pointer lock, gamepad).
 * Provides a consistent API for camera look and movement input regardless of input method.
 *
 * Design principles:
 * - Input-agnostic: consumers don't care HOW input is gathered
 * - Composable: multiple providers can be combined
 * - Lifecycle-aware: enable/disable/dispose for proper cleanup
 */

export interface LookDelta {
	/** Horizontal rotation in radians (positive = right) */
	yaw: number;
	/** Vertical rotation in radians (positive = up) */
	pitch: number;
}

export interface MovementInput {
	/** Forward/backward input (-1 = back, 1 = forward) */
	forward: number;
	/** Left/right strafe input (-1 = left, 1 = right) */
	strafe: number;
}

export interface IInputProvider {
	/** Provider type identifier */
	readonly type: "keyboard" | "touch" | "pointerlock" | "gamepad" | "composite";

	/**
	 * Get camera look delta since last call.
	 * Values are in radians per frame, ready to apply to camera rotation.
	 */
	getLookDelta(): LookDelta;

	/**
	 * Get movement input.
	 * Values are normalized to -1 to 1 range.
	 */
	getMovementInput(): MovementInput;

	/**
	 * Check if jump was pressed this frame.
	 * Resets after being read (edge-triggered).
	 */
	isJumpPressed(): boolean;

	/**
	 * Check if sprint is currently held.
	 * Continuous state (level-triggered).
	 */
	isSprintHeld(): boolean;

	/**
	 * Called each frame to update internal state.
	 * Used for inertia decay, gamepad polling, etc.
	 */
	update(deltaTime: number): void;

	/** Enable input capture */
	enable(): void;

	/** Disable input capture (but don't dispose) */
	disable(): void;

	/** Clean up all event listeners and resources */
	dispose(): void;
}

/**
 * Configuration for input providers
 */
export interface InputProviderConfig {
	/** Mouse/touch look sensitivity multiplier */
	lookSensitivity?: number;
	/** Movement input deadzone (0-1) */
	movementDeadzone?: number;
	/** Inertia decay factor (0-1, higher = more inertia) */
	inertiaDecay?: number;
}

export const DEFAULT_INPUT_CONFIG: Required<InputProviderConfig> = {
	lookSensitivity: 0.002,
	movementDeadzone: 0.15,
	inertiaDecay: 0.92,
};
