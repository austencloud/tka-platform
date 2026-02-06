/**
 * GamepadProvider
 *
 * Gamepad/controller input using the Gamepad API.
 * Supports standard gamepad layout (Xbox, PlayStation, etc.).
 *
 * Features:
 * - Deadzone handling for analog sticks
 * - Standard button mapping
 * - Automatic gamepad detection
 *
 * Button mapping (Standard Gamepad):
 * - Left stick: Movement
 * - Right stick: Look
 * - A/X (button 0): Jump
 * - L3 (button 10): Sprint (press left stick)
 * - LB (button 4): Sprint alternative
 */

import type {
	IInputProvider,
	LookDelta,
	MovementInput,
	InputProviderConfig,
} from "../contracts/IInputProvider";
import { DEFAULT_INPUT_CONFIG } from "../contracts/IInputProvider";

export class GamepadProvider implements IInputProvider {
	readonly type = "gamepad" as const;

	private enabled = false;
	private config: Required<InputProviderConfig>;
	private gamepadIndex: number | null = null;

	// Edge-triggered jump detection
	private jumpWasPressed = false;
	private jumpPressed = false;

	// Sensitivity for right stick look
	private lookSensitivity = 0.05;

	constructor(config: InputProviderConfig = {}) {
		this.config = { ...DEFAULT_INPUT_CONFIG, ...config };
	}

	// =========================================================================
	// IInputProvider implementation
	// =========================================================================

	getLookDelta(): LookDelta {
		const gp = this.getGamepad();
		if (!gp) return { yaw: 0, pitch: 0 };

		// Right stick for look (axes 2, 3)
		const yaw = this.applyDeadzone(gp.axes[2] ?? 0) * this.lookSensitivity;
		const pitch = this.applyDeadzone(gp.axes[3] ?? 0) * this.lookSensitivity;

		return { yaw: -yaw, pitch: -pitch };
	}

	getMovementInput(): MovementInput {
		const gp = this.getGamepad();
		if (!gp) return { forward: 0, strafe: 0 };

		// Left stick for movement (axes 0, 1)
		const strafe = this.applyDeadzone(gp.axes[0] ?? 0);
		const forward = -this.applyDeadzone(gp.axes[1] ?? 0); // Invert Y

		return { forward, strafe };
	}

	isJumpPressed(): boolean {
		const pressed = this.jumpPressed;
		this.jumpPressed = false; // Reset after read
		return pressed;
	}

	isSprintHeld(): boolean {
		const gp = this.getGamepad();
		if (!gp) return false;

		// L3 (left stick press) or LB (left bumper)
		return gp.buttons[10]?.pressed || gp.buttons[4]?.pressed || false;
	}

	update(_deltaTime: number): void {
		// Poll for gamepad state (required for some browsers)
		const gp = this.getGamepad();
		if (!gp) return;

		// Edge-triggered jump detection (A button / button 0)
		const jumpNow = gp.buttons[0]?.pressed ?? false;
		if (jumpNow && !this.jumpWasPressed) {
			this.jumpPressed = true;
		}
		this.jumpWasPressed = jumpNow;
	}

	enable(): void {
		if (this.enabled) return;
		this.enabled = true;

		window.addEventListener("gamepadconnected", this.handleGamepadConnected);
		window.addEventListener("gamepaddisconnected", this.handleGamepadDisconnected);

		// Check for already-connected gamepads
		this.detectExistingGamepad();
	}

	disable(): void {
		if (!this.enabled) return;
		this.enabled = false;

		window.removeEventListener("gamepadconnected", this.handleGamepadConnected);
		window.removeEventListener("gamepaddisconnected", this.handleGamepadDisconnected);

		this.gamepadIndex = null;
	}

	dispose(): void {
		this.disable();
	}

	// =========================================================================
	// Public API
	// =========================================================================

	/**
	 * Check if a gamepad is currently connected
	 */
	isConnected(): boolean {
		return this.getGamepad() !== null;
	}

	// =========================================================================
	// Internal helpers
	// =========================================================================

	private getGamepad(): Gamepad | null {
		if (this.gamepadIndex === null) return null;

		const gamepads = navigator.getGamepads();
		return gamepads[this.gamepadIndex] ?? null;
	}

	private applyDeadzone(value: number): number {
		const deadzone = this.config.movementDeadzone;
		if (Math.abs(value) < deadzone) return 0;

		// Rescale to 0-1 range after deadzone
		const sign = value > 0 ? 1 : -1;
		return sign * ((Math.abs(value) - deadzone) / (1 - deadzone));
	}

	private detectExistingGamepad(): void {
		const gamepads = navigator.getGamepads();
		for (let i = 0; i < gamepads.length; i++) {
			if (gamepads[i]) {
				this.gamepadIndex = i;
				break;
			}
		}
	}

	// =========================================================================
	// Event handlers
	// =========================================================================

	private handleGamepadConnected = (e: GamepadEvent): void => {
		if (this.gamepadIndex === null) {
			this.gamepadIndex = e.gamepad.index;
		}
	};

	private handleGamepadDisconnected = (e: GamepadEvent): void => {
		if (e.gamepad.index === this.gamepadIndex) {
			this.gamepadIndex = null;

			// Try to find another connected gamepad
			this.detectExistingGamepad();
		}
	};
}
