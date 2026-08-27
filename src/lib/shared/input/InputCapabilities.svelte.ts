/**
 * Input Capabilities
 *
 * Reactive state that tracks what input methods are currently available
 * and being used. Updates dynamically as the user switches input methods.
 *
 * Key insight: Don't detect the DEVICE, detect the INPUT.
 * - DevTools touch emulation fires pointerType: "touch"
 * - External mouse on mobile fires pointerType: "mouse"
 * - The code responds to actual input, not detected device
 */

export type PointerType = "mouse" | "touch" | "pen";

export interface InputCapabilities {
	/** Can we lock the pointer? (browsers with Pointer Lock API) */
	hasPointerLock: boolean;
	/** Does the device have touch capability? */
	hasTouchscreen: boolean;
	/** Is pointer lock currently active? */
	isPointerLocked: boolean;
	/** Is a physical keyboard likely attached? */
	hasKeyboard: boolean;
	/** Is a gamepad connected? */
	hasGamepad: boolean;
	/** What type of pointer is currently being used? */
	currentPointerType: PointerType | null;
	/** Last time pointer type changed (for debouncing UI updates) */
	pointerTypeChangedAt: number;
}

export function createInputCapabilities() {
	let caps = $state<InputCapabilities>({
		hasPointerLock: typeof document !== "undefined" && "pointerLockElement" in document,
		hasTouchscreen: false,
		isPointerLocked: false,
		hasKeyboard: true, // Assume true initially, can be refined
		hasGamepad: false,
		currentPointerType: null,
		pointerTypeChangedAt: 0,
	});

	// Subscribers for capability changes
	const changeCallbacks: Array<(caps: InputCapabilities) => void> = [];

	function notifyChange() {
		for (const cb of changeCallbacks) {
			cb(caps);
		}
	}

	function handlePointerEvent(e: PointerEvent) {
		const newType = e.pointerType as PointerType;

		if (newType !== caps.currentPointerType) {
			caps = {
				...caps,
				currentPointerType: newType,
				pointerTypeChangedAt: performance.now(),
			};

			// If we see touch input, we know the device has a touchscreen
			if (newType === "touch") {
				caps = { ...caps, hasTouchscreen: true };
			}

			notifyChange();
		}
	}

	/**
	 * Update pointer lock state
	 */
	function handlePointerLockChange() {
		const locked = document.pointerLockElement !== null;
		if (locked !== caps.isPointerLocked) {
			caps = { ...caps, isPointerLocked: locked };
			notifyChange();
		}
	}

	/**
	 * Handle keyboard detection
	 * If we see keyboard input, we know there's a keyboard
	 */
	function handleKeyboardEvent() {
		if (!caps.hasKeyboard) {
			caps = { ...caps, hasKeyboard: true };
			notifyChange();
		}
	}

	/**
	 * Initialize listeners (call once on mount)
	 */
	function init() {
		if (typeof document === "undefined") return;

		// Pointer lock changes
		document.addEventListener("pointerlockchange", handlePointerLockChange);

		// Gamepad connection
		window.addEventListener("gamepadconnected", () => {
			caps = { ...caps, hasGamepad: true };
			notifyChange();
		});
		window.addEventListener("gamepaddisconnected", () => {
			caps = { ...caps, hasGamepad: false };
			notifyChange();
		});

		// Check for existing gamepads
		const gamepads = navigator.getGamepads?.();
		if (gamepads) {
			for (const gp of gamepads) {
				if (gp) {
					caps = { ...caps, hasGamepad: true };
					break;
				}
			}
		}

		// Initial touch capability check (but we'll update from actual events)
		caps = {
			...caps,
			hasTouchscreen: "ontouchstart" in window || navigator.maxTouchPoints > 0,
		};
	}

	/**
	 * Cleanup listeners
	 */
	function destroy() {
		if (typeof document === "undefined") return;
		document.removeEventListener("pointerlockchange", handlePointerLockChange);
	}

	/**
	 * Subscribe to capability changes
	 */
	function onChange(callback: (caps: InputCapabilities) => void): () => void {
		changeCallbacks.push(callback);
		return () => {
			const idx = changeCallbacks.indexOf(callback);
			if (idx >= 0) changeCallbacks.splice(idx, 1);
		};
	}

	/**
	 * Get appropriate primary interaction type hint
	 * Returns what the user is currently using to interact
	 */
	function getPrimaryInteractionType(): "mouse" | "touch" | "keyboard" {
		if (caps.currentPointerType === "touch") {
			return "touch";
		}
		if (caps.currentPointerType === "mouse" || caps.currentPointerType === "pen") {
			return "mouse";
		}
		// Default to keyboard/mouse if we haven't seen pointer input yet
		return caps.hasKeyboard ? "keyboard" : "touch";
	}

	/**
	 * Should we show touch-specific UI (like virtual joystick)?
	 */
	function shouldShowTouchUI(): boolean {
		// Show touch UI if:
		// 1. Current pointer type is touch
		// 2. AND we don't have pointer lock (can't do mouse look)
		// 3. AND we probably don't have a keyboard (or are actively using touch)
		return caps.currentPointerType === "touch" && !caps.isPointerLocked;
	}

	/**
	 * Can we use pointer lock for mouse look?
	 */
	function canUsePointerLock(): boolean {
		return caps.hasPointerLock && caps.currentPointerType !== "touch";
	}

	return {
		get current() {
			return caps;
		},
		handlePointerEvent,
		handleKeyboardEvent,
		init,
		destroy,
		onChange,
		getPrimaryInteractionType,
		shouldShowTouchUI,
		canUsePointerLock,
	};
}

// Singleton instance for shared state
let instance: ReturnType<typeof createInputCapabilities> | null = null;

export function getInputCapabilities() {
	if (!instance) {
		instance = createInputCapabilities();
	}
	return instance;
}
