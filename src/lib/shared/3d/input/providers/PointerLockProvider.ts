/**
 * PointerLockProvider
 *
 * Mouse-based camera look using the Pointer Lock API.
 * Falls back to drag-to-look when pointer lock is unavailable (mobile, DevTools).
 *
 * Features:
 * - Automatic fallback to drag mode
 * - Raw mouse movement for precise control
 * - Click-to-lock interaction pattern
 */

import type {
	IInputProvider,
	LookDelta,
	MovementInput,
	InputProviderConfig,
} from "../IInputProvider";
import { DEFAULT_INPUT_CONFIG } from "../IInputProvider";

export class PointerLockProvider implements IInputProvider {
	readonly type = "pointerlock" as const;

	private enabled = false;
	private element: HTMLElement;
	private config: Required<InputProviderConfig>;

	// Look delta accumulator (consumed each frame)
	private lookDelta = { yaw: 0, pitch: 0 };

	// Pointer lock state
	private isLocked = false;

	// Fallback drag mode state
	private fallbackMode = false;
	private isDragging = false;
	private lastMousePos = { x: 0, y: 0 };

	constructor(element: HTMLElement, config: InputProviderConfig = {}) {
		this.element = element;
		this.config = { ...DEFAULT_INPUT_CONFIG, ...config };
	}

	// =========================================================================
	// IInputProvider implementation
	// =========================================================================

	getLookDelta(): LookDelta {
		const delta = { ...this.lookDelta };
		// Reset after read
		this.lookDelta = { yaw: 0, pitch: 0 };
		return delta;
	}

	getMovementInput(): MovementInput {
		// Movement is handled by KeyboardProvider
		return { forward: 0, strafe: 0 };
	}

	isJumpPressed(): boolean {
		return false; // Handled by KeyboardProvider
	}

	isSprintHeld(): boolean {
		return false; // Handled by KeyboardProvider
	}

	update(_deltaTime: number): void {
		// No update logic needed - event-driven
	}

	enable(): void {
		if (this.enabled) return;
		this.enabled = true;

		// Check if pointer lock is supported
		this.fallbackMode = !("pointerLockElement" in document);

		this.element.addEventListener("click", this.handleClick);
		this.element.addEventListener("mousedown", this.handleMouseDown);
		this.element.addEventListener("mousemove", this.handleMouseMove);
		this.element.addEventListener("mouseup", this.handleMouseUp);
		document.addEventListener("pointerlockchange", this.handlePointerLockChange);
		document.addEventListener("pointerlockerror", this.handlePointerLockError);
	}

	disable(): void {
		if (!this.enabled) return;
		this.enabled = false;

		// Exit pointer lock if active
		if (this.isLocked) {
			document.exitPointerLock();
		}

		this.element.removeEventListener("click", this.handleClick);
		this.element.removeEventListener("mousedown", this.handleMouseDown);
		this.element.removeEventListener("mousemove", this.handleMouseMove);
		this.element.removeEventListener("mouseup", this.handleMouseUp);
		document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
		document.removeEventListener("pointerlockerror", this.handlePointerLockError);

		this.reset();
	}

	dispose(): void {
		this.disable();
	}

	// =========================================================================
	// Public API
	// =========================================================================

	/**
	 * Request pointer lock (call from user gesture)
	 */
	async requestLock(): Promise<boolean> {
		if (this.fallbackMode) {
			return false;
		}

		try {
			await this.element.requestPointerLock();
			return true;
		} catch {
			this.fallbackMode = true;
			return false;
		}
	}

	/**
	 * Check if currently locked
	 */
	isPointerLocked(): boolean {
		return this.isLocked;
	}

	/**
	 * Check if in fallback (drag) mode
	 */
	isInFallbackMode(): boolean {
		return this.fallbackMode;
	}

	// =========================================================================
	// Internal helpers
	// =========================================================================

	private reset(): void {
		this.lookDelta = { yaw: 0, pitch: 0 };
		this.isLocked = false;
		this.isDragging = false;
	}

	// =========================================================================
	// Event handlers
	// =========================================================================

	private handleClick = async (): Promise<void> => {
		if (!this.enabled) return;

		// Try to acquire pointer lock on click
		if (!this.isLocked && !this.fallbackMode) {
			await this.requestLock();
		}
	};

	private handleMouseDown = (e: MouseEvent): void => {
		if (!this.enabled) return;

		// Only handle left mouse button
		if (e.button !== 0) return;

		if (this.fallbackMode || !this.isLocked) {
			// Start drag-to-look in fallback mode
			this.isDragging = true;
			this.lastMousePos = { x: e.clientX, y: e.clientY };
		}
	};

	private handleMouseMove = (e: MouseEvent): void => {
		if (!this.enabled) return;

		if (this.isLocked) {
			// Use movementX/Y for pointer lock (raw delta)
			const deltaX = e.movementX ?? 0;
			const deltaY = e.movementY ?? 0;

			this.lookDelta.yaw -= deltaX * this.config.lookSensitivity;
			this.lookDelta.pitch -= deltaY * this.config.lookSensitivity;
		} else if (this.isDragging) {
			// Fallback drag mode
			const deltaX = e.clientX - this.lastMousePos.x;
			const deltaY = e.clientY - this.lastMousePos.y;

			this.lastMousePos = { x: e.clientX, y: e.clientY };

			this.lookDelta.yaw -= deltaX * this.config.lookSensitivity;
			this.lookDelta.pitch -= deltaY * this.config.lookSensitivity;
		}
	};

	private handleMouseUp = (): void => {
		this.isDragging = false;
	};

	private handlePointerLockChange = (): void => {
		this.isLocked = document.pointerLockElement === this.element;
	};

	private handlePointerLockError = (): void => {
		console.warn("[PointerLockProvider] Pointer lock failed, using fallback mode");
		this.fallbackMode = true;
	};
}
