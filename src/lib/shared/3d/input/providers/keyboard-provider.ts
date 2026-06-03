/**
 * KeyboardProvider
 *
 * Handles WASD/Arrow keyboard input for movement and discrete actions.
 * Does NOT provide look input (use PointerLockProvider or TouchLookProvider for that).
 *
 * Features:
 * - Blur/visibility handling to prevent stuck keys
 * - Ignores input when typing in form fields
 * - Edge-triggered jump detection
 */

import type {
	IInputProvider,
	LookDelta,
	MovementInput,
	InputProviderConfig,
} from "../IInputProvider";
import { DEFAULT_INPUT_CONFIG } from "../IInputProvider";

export class KeyboardProvider implements IInputProvider {
	readonly type = "keyboard" as const;

	private enabled = false;
	private keys = new Set<string>();
	private jumpPressed = false;
	private config: Required<InputProviderConfig>;

	constructor(config: InputProviderConfig = {}) {
		this.config = { ...DEFAULT_INPUT_CONFIG, ...config };
	}

	// =========================================================================
	// IInputProvider implementation
	// =========================================================================

	getLookDelta(): LookDelta {
		// Keyboard doesn't provide look input
		return { yaw: 0, pitch: 0 };
	}

	getMovementInput(): MovementInput {
		if (!this.enabled) {
			return { forward: 0, strafe: 0 };
		}

		const forward =
			(this.isKeyHeld("KeyW") || this.isKeyHeld("ArrowUp") ? 1 : 0) -
			(this.isKeyHeld("KeyS") || this.isKeyHeld("ArrowDown") ? 1 : 0);

		const strafe =
			(this.isKeyHeld("KeyD") || this.isKeyHeld("ArrowRight") ? 1 : 0) -
			(this.isKeyHeld("KeyA") || this.isKeyHeld("ArrowLeft") ? 1 : 0);

		return { forward, strafe };
	}

	isJumpPressed(): boolean {
		const pressed = this.jumpPressed;
		this.jumpPressed = false; // Reset after read (edge-triggered)
		return pressed;
	}

	isSprintHeld(): boolean {
		return this.isKeyHeld("ShiftLeft") || this.isKeyHeld("ShiftRight");
	}

	update(_deltaTime: number): void {
		// No update logic needed for keyboard (event-driven)
	}

	enable(): void {
		if (this.enabled) return;
		this.enabled = true;

		window.addEventListener("keydown", this.handleKeyDown);
		window.addEventListener("keyup", this.handleKeyUp);
		window.addEventListener("blur", this.handleBlur);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
	}

	disable(): void {
		if (!this.enabled) return;
		this.enabled = false;
		this.clearAllKeys();

		window.removeEventListener("keydown", this.handleKeyDown);
		window.removeEventListener("keyup", this.handleKeyUp);
		window.removeEventListener("blur", this.handleBlur);
		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
	}

	dispose(): void {
		this.disable();
	}

	// =========================================================================
	// Internal helpers
	// =========================================================================

	private isKeyHeld(code: string): boolean {
		return this.keys.has(code);
	}

	private clearAllKeys(): void {
		this.keys.clear();
		this.jumpPressed = false;
	}

	private isTypingInField(target: EventTarget | null): boolean {
		if (!target) return false;
		return (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		);
	}

	// =========================================================================
	// Event handlers
	// =========================================================================

	private handleKeyDown = (e: KeyboardEvent): void => {
		if (!this.enabled) return;
		if (this.isTypingInField(e.target)) return;

		// Ignore key repeat
		if (this.keys.has(e.code)) return;

		this.keys.add(e.code);

		// Edge-triggered jump detection
		if (e.code === "Space") {
			this.jumpPressed = true;
			e.preventDefault();
		}

		// Prevent default for movement keys to avoid scrolling
		if (this.isMovementKey(e.code)) {
			e.preventDefault();
		}
	};

	private handleKeyUp = (e: KeyboardEvent): void => {
		this.keys.delete(e.code);
	};

	private handleBlur = (): void => {
		// Clear all keys when window loses focus to prevent stuck keys
		this.clearAllKeys();
	};

	private handleVisibilityChange = (): void => {
		// Clear keys when tab becomes hidden
		if (document.hidden) {
			this.clearAllKeys();
		}
	};

	private isMovementKey(code: string): boolean {
		return [
			"KeyW",
			"KeyA",
			"KeyS",
			"KeyD",
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight",
			"Space",
		].includes(code);
	}
}
