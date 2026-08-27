/**
 * TouchLookProvider
 *
 * Touch-based camera look with inertia and gesture smoothing.
 * Designed for mobile devices and DevTools touch emulation.
 *
 * Features:
 * - Inertia for smooth camera stopping
 * - Gesture noise filtering
 * - Zone-based touch (right side = look, left side ignored for movement)
 * - Pointer capture for reliable tracking
 *
 * Note: Movement is handled by VirtualJoystick component, not this provider.
 */

import type {
	IInputProvider,
	LookDelta,
	MovementInput,
	InputProviderConfig,
} from "../IInputProvider";
import { DEFAULT_INPUT_CONFIG } from "../IInputProvider";

interface TouchState {
	id: number;
	lastX: number;
	lastY: number;
	startTime: number;
}

export class TouchLookProvider implements IInputProvider {
	readonly type = "touch" as const;

	private enabled = false;
	private element: HTMLElement;
	private config: Required<InputProviderConfig>;

	// Current velocity (with inertia)
	private velocity = { yaw: 0, pitch: 0 };

	// Active touch tracking
	private activeTouch: TouchState | null = null;
	private isActive = false;

	// Noise filtering - average last few deltas
	private deltaHistory: Array<{ yaw: number; pitch: number }> = [];
	private readonly HISTORY_SIZE = 3;

	constructor(element: HTMLElement, config: InputProviderConfig = {}) {
		this.element = element;
		this.config = { ...DEFAULT_INPUT_CONFIG, ...config };
	}

	// IInputProvider implementation

	getLookDelta(): LookDelta {
		return { yaw: this.velocity.yaw, pitch: this.velocity.pitch };
	}

	getMovementInput(): MovementInput {
		// Touch movement is handled by VirtualJoystick, not this provider
		return { forward: 0, strafe: 0 };
	}

	isJumpPressed(): boolean {
		return false; // Touch jump would be a button, not part of look provider
	}

	isSprintHeld(): boolean {
		return false; // Touch sprint would be a button
	}

	update(_deltaTime: number): void {
		if (!this.isActive) {
			// Apply inertia decay when not touching
			this.velocity.yaw *= this.config.inertiaDecay;
			this.velocity.pitch *= this.config.inertiaDecay;

			// Zero out tiny values to prevent drift
			if (Math.abs(this.velocity.yaw) < 0.0001) this.velocity.yaw = 0;
			if (Math.abs(this.velocity.pitch) < 0.0001) this.velocity.pitch = 0;
		}
	}

	enable(): void {
		if (this.enabled) return;
		this.enabled = true;

		// Prevent browser touch gestures
		this.element.style.touchAction = "none";

		this.element.addEventListener("pointerdown", this.handlePointerDown);
		this.element.addEventListener("pointermove", this.handlePointerMove);
		this.element.addEventListener("pointerup", this.handlePointerUp);
		this.element.addEventListener("pointercancel", this.handlePointerUp);
		this.element.addEventListener("contextmenu", this.preventDefault);
	}

	disable(): void {
		if (!this.enabled) return;
		this.enabled = false;

		this.element.removeEventListener("pointerdown", this.handlePointerDown);
		this.element.removeEventListener("pointermove", this.handlePointerMove);
		this.element.removeEventListener("pointerup", this.handlePointerUp);
		this.element.removeEventListener("pointercancel", this.handlePointerUp);
		this.element.removeEventListener("contextmenu", this.preventDefault);

		this.reset();
	}

	dispose(): void {
		this.disable();
	}

	// Internal helpers

	private reset(): void {
		this.activeTouch = null;
		this.isActive = false;
		this.velocity = { yaw: 0, pitch: 0 };
		this.deltaHistory = [];
	}

	private isInLookZone(clientX: number): boolean {
		// Right 60% of screen is look zone
		const rect = this.element.getBoundingClientRect();
		const relativeX = clientX - rect.left;
		return relativeX > rect.width * 0.4;
	}

	private smoothDelta(yaw: number, pitch: number): { yaw: number; pitch: number } {
		this.deltaHistory.push({ yaw, pitch });
		if (this.deltaHistory.length > this.HISTORY_SIZE) {
			this.deltaHistory.shift();
		}

		// Average the history for smoothing
		const avg = this.deltaHistory.reduce(
			(acc, d) => ({ yaw: acc.yaw + d.yaw, pitch: acc.pitch + d.pitch }),
			{ yaw: 0, pitch: 0 }
		);

		return {
			yaw: avg.yaw / this.deltaHistory.length,
			pitch: avg.pitch / this.deltaHistory.length,
		};
	}

	// Event handlers

	private handlePointerDown = (e: PointerEvent): void => {
		if (!this.enabled) return;
		if (e.pointerType !== "touch") return;
		if (!this.isInLookZone(e.clientX)) return;
		if (this.activeTouch !== null) return; // Already tracking a touch

		this.activeTouch = {
			id: e.pointerId,
			lastX: e.clientX,
			lastY: e.clientY,
			startTime: performance.now(),
		};
		this.isActive = true;
		this.deltaHistory = [];

		// Capture for reliable tracking
		this.element.setPointerCapture(e.pointerId);
		e.preventDefault();
	};

	private handlePointerMove = (e: PointerEvent): void => {
		if (!this.enabled) return;
		if (e.pointerId !== this.activeTouch?.id) return;

		const deltaX = e.clientX - this.activeTouch.lastX;
		const deltaY = e.clientY - this.activeTouch.lastY;

		this.activeTouch.lastX = e.clientX;
		this.activeTouch.lastY = e.clientY;

		// Convert to radians with sensitivity
		const rawYaw = -deltaX * this.config.lookSensitivity;
		const rawPitch = -deltaY * this.config.lookSensitivity;

		const smoothed = this.smoothDelta(rawYaw, rawPitch);
		this.velocity.yaw = smoothed.yaw;
		this.velocity.pitch = smoothed.pitch;

		e.preventDefault();
	};

	private handlePointerUp = (e: PointerEvent): void => {
		if (e.pointerId !== this.activeTouch?.id) return;

		// Release capture
		if (this.element.hasPointerCapture(e.pointerId)) {
			this.element.releasePointerCapture(e.pointerId);
		}

		this.activeTouch = null;
		this.isActive = false;
		// Don't reset velocity - let inertia take over
	};

	private preventDefault = (e: Event): void => {
		e.preventDefault();
	};
}
