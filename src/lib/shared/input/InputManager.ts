/**
 * Input Manager
 *
 * Main orchestrator for the unified input system.
 * Handles keyboard and pointer events, maps them to semantic actions,
 * and provides context-aware input handling.
 */

import type { InputAction, ActionEvent, HeldActionState } from "./InputActions";
import { getInputCapabilities, type InputCapabilities } from "./InputCapabilities.svelte";
import { PointerHandler, type PointerEventType, type PointerDragEvent } from "./PointerHandler";
import { type InputContext, findKeyboardAction, findPointerAction } from "./InputContexts";

type ActionCallback = (event: ActionEvent) => void;
type HeldActionCallback = (state: HeldActionState) => void;

interface InputManagerOptions {
	element: HTMLCanvasElement;
	initialContext?: InputContext;
}

/**
 * Unified input manager for 3D environments
 */
export class InputManager {
	private element: HTMLCanvasElement;
	private pointerHandler: PointerHandler;
	private capabilities = getInputCapabilities();
	private context: InputContext;

	// Action callbacks
	private actionCallbacks = new Map<InputAction, ActionCallback[]>();
	private heldActionCallbacks = new Map<InputAction, HeldActionCallback[]>();
	private wildcardCallbacks: ActionCallback[] = [];

	// Held key state (for run, move, etc.)
	private heldKeys = new Set<string>();

	// Look accumulator for smooth camera movement
	private lookDelta = { x: 0, y: 0 };

	// Touch joystick state
	private joystickDelta = { x: 0, y: 0 };

	constructor(options: InputManagerOptions) {
		this.element = options.element;
		this.context = options.initialContext ?? "first-person";

		// Initialize pointer handler
		this.pointerHandler = new PointerHandler({ element: this.element });

		// Initialize capabilities
		this.capabilities.init();

		// Wire up event handlers
		this.setupPointerHandling();
		this.setupKeyboardHandling();
	}

	private setupPointerHandling() {
		this.pointerHandler.on((event: PointerEventType) => {
			// Update capabilities with current pointer type
			if ("pointerType" in event) {
				// Create a minimal PointerEvent-like object for the capabilities handler
				this.capabilities.handlePointerEvent({
					pointerType: event.pointerType,
				} as PointerEvent);
			}

			switch (event.type) {
				case "click":
					this.handlePointerClick(event);
					break;
				case "drag":
					this.handlePointerDrag(event);
					break;
				case "down":
					// Could be used for long-press detection
					break;
				case "up":
					// Reset joystick if this was the movement touch
					if (event.zone === "left") {
						this.joystickDelta = { x: 0, y: 0 };
						// Fire move stop actions
						this.fireHeldAction("move_forward", false);
						this.fireHeldAction("move_backward", false);
						this.fireHeldAction("move_left", false);
						this.fireHeldAction("move_right", false);
					}
					break;
			}
		});
	}

	private setupKeyboardHandling() {
		document.addEventListener("keydown", this.handleKeyDown);
		document.addEventListener("keyup", this.handleKeyUp);
	}

	private handleKeyDown = (e: KeyboardEvent) => {
		// Skip if already held (key repeat)
		if (this.heldKeys.has(e.code)) return;

		// Update capabilities
		this.capabilities.handleKeyboardEvent();

		// Find action for this key
		const action = findKeyboardAction(this.context, e.code, "pressed");

		if (action) {
			// Check if this is a held action
			const heldAction = findKeyboardAction(this.context, e.code, "held");

			if (heldAction) {
				// This is a held action - track state
				this.heldKeys.add(e.code);
				this.fireHeldAction(action, true);
			}

			// Fire the action
			this.fireAction(action, "keyboard");
			e.preventDefault();
		}
	};

	private handleKeyUp = (e: KeyboardEvent) => {
		if (!this.heldKeys.has(e.code)) return;

		this.heldKeys.delete(e.code);

		// Find action for this key
		const action = findKeyboardAction(this.context, e.code, "pressed");

		if (action) {
			// Fire held action stop
			this.fireHeldAction(action, false);
		}
	};

	private handlePointerClick(event: { pointerType: string; clientX: number; clientY: number; zone: string }) {
		const action = findPointerAction(
			this.context,
			"click",
			event.zone as "left" | "right" | "center"
		);

		if (action) {
			this.fireAction(action, event.pointerType as ActionEvent["pointerType"], {
				clientX: event.clientX,
				clientY: event.clientY,
			});
		}
	}

	private handlePointerDrag(event: PointerDragEvent) {
		// Look around (right zone or any zone with mouse when pointer locked)
		if (event.zone === "right" || (event.pointerType === "mouse" && this.capabilities.current.isPointerLocked)) {
			const action = findPointerAction(this.context, "drag", event.zone);

			if (action === "look_around") {
				// Accumulate look delta
				this.lookDelta.x += event.movementX;
				this.lookDelta.y += event.movementY;

				this.fireAction("look_around", event.pointerType, {
					deltaX: event.movementX,
					deltaY: event.movementY,
				});
			}
		}

		// Movement joystick (left zone for touch)
		if (event.zone === "left" && event.pointerType === "touch") {
			// Calculate joystick delta relative to start
			const maxDelta = 40; // Max joystick movement
			this.joystickDelta = {
				x: Math.max(-1, Math.min(1, event.deltaX / maxDelta)),
				y: Math.max(-1, Math.min(1, event.deltaY / maxDelta)),
			};

			// Convert to movement actions with deadzone
			const deadzone = 0.2;

			// Forward/Backward
			if (this.joystickDelta.y < -deadzone) {
				this.fireHeldAction("move_forward", true);
				this.fireHeldAction("move_backward", false);
			} else if (this.joystickDelta.y > deadzone) {
				this.fireHeldAction("move_forward", false);
				this.fireHeldAction("move_backward", true);
			} else {
				this.fireHeldAction("move_forward", false);
				this.fireHeldAction("move_backward", false);
			}

			// Left/Right
			if (this.joystickDelta.x < -deadzone) {
				this.fireHeldAction("move_left", true);
				this.fireHeldAction("move_right", false);
			} else if (this.joystickDelta.x > deadzone) {
				this.fireHeldAction("move_left", false);
				this.fireHeldAction("move_right", true);
			} else {
				this.fireHeldAction("move_left", false);
				this.fireHeldAction("move_right", false);
			}
		}
	}

	private fireAction(
		action: InputAction,
		pointerType: ActionEvent["pointerType"],
		extra?: { clientX?: number; clientY?: number; deltaX?: number; deltaY?: number }
	) {
		const event: ActionEvent = {
			action,
			pointerType,
			timestamp: performance.now(),
			...extra,
		};

		// Fire specific callbacks
		const callbacks = this.actionCallbacks.get(action);
		if (callbacks) {
			for (const cb of callbacks) {
				cb(event);
			}
		}

		// Fire wildcard callbacks
		for (const cb of this.wildcardCallbacks) {
			cb(event);
		}
	}

	private fireHeldAction(action: InputAction, isHeld: boolean) {
		const callbacks = this.heldActionCallbacks.get(action);
		if (callbacks) {
			for (const cb of callbacks) {
				cb({ action, isHeld });
			}
		}
	}

	// ============================================================================
	// PUBLIC API
	// ============================================================================

	/**
	 * Subscribe to an action
	 */
	onAction(action: InputAction | "*", callback: ActionCallback): () => void {
		if (action === "*") {
			this.wildcardCallbacks.push(callback);
			return () => {
				const idx = this.wildcardCallbacks.indexOf(callback);
				if (idx >= 0) this.wildcardCallbacks.splice(idx, 1);
			};
		}

		if (!this.actionCallbacks.has(action)) {
			this.actionCallbacks.set(action, []);
		}
		this.actionCallbacks.get(action)!.push(callback);

		return () => {
			const callbacks = this.actionCallbacks.get(action);
			if (callbacks) {
				const idx = callbacks.indexOf(callback);
				if (idx >= 0) callbacks.splice(idx, 1);
			}
		};
	}

	/**
	 * Subscribe to a held action (for continuous actions like running)
	 */
	onHeldAction(action: InputAction, callback: HeldActionCallback): () => void {
		if (!this.heldActionCallbacks.has(action)) {
			this.heldActionCallbacks.set(action, []);
		}
		this.heldActionCallbacks.get(action)!.push(callback);

		return () => {
			const callbacks = this.heldActionCallbacks.get(action);
			if (callbacks) {
				const idx = callbacks.indexOf(callback);
				if (idx >= 0) callbacks.splice(idx, 1);
			}
		};
	}

	/**
	 * Change the current input context
	 */
	setContext(context: InputContext) {
		if (context !== this.context) {
			this.context = context;
		}
	}

	/**
	 * Get current context
	 */
	getContext(): InputContext {
		return this.context;
	}

	/**
	 * Get current input capabilities
	 */
	getCapabilities(): InputCapabilities {
		return this.capabilities.current;
	}

	/**
	 * Get accumulated look delta (call and reset each frame)
	 */
	consumeLookDelta(): { x: number; y: number } {
		const delta = { ...this.lookDelta };
		this.lookDelta = { x: 0, y: 0 };
		return delta;
	}

	/**
	 * Get current joystick delta (-1 to 1)
	 */
	getJoystickDelta(): { x: number; y: number } {
		return this.joystickDelta;
	}

	/**
	 * Should we show touch-specific UI?
	 */
	shouldShowTouchUI(): boolean {
		return this.capabilities.shouldShowTouchUI();
	}

	/**
	 * Can we use pointer lock for mouse look?
	 */
	canUsePointerLock(): boolean {
		return this.capabilities.canUsePointerLock();
	}

	/**
	 * Get hint text for an action based on current input method
	 */
	getHintForAction(action: InputAction): string {
		const caps = this.capabilities.current;

		// If using touch, show tap/drag hints
		if (caps.currentPointerType === "touch") {
			switch (action) {
				case "place_object":
					return "Tap";
				case "look_around":
					return "Drag";
				case "move_forward":
				case "move_backward":
				case "move_left":
				case "move_right":
					return "Joystick";
				case "cycle_object_next":
					return "Swipe";
				default:
					return "Tap";
			}
		}

		// Mouse/keyboard hints
		switch (action) {
			case "place_object":
				return "Click";
			case "look_around":
				return "Mouse";
			case "move_forward":
				return "W";
			case "move_backward":
				return "S";
			case "move_left":
				return "A";
			case "move_right":
				return "D";
			case "cycle_object_next":
				return "Q";
			case "run_start":
				return "Shift";
			case "fly_toggle":
				return "G";
			case "jump":
				return "Space";
			case "cancel_placement":
				return "ESC";
			case "transform_translate":
				return "W";
			case "transform_rotate":
				return "E";
			case "transform_scale":
				return "R";
			case "delete_object":
				return "Del";
			default:
				return "";
		}
	}

	/**
	 * Clean up
	 */
	destroy() {
		document.removeEventListener("keydown", this.handleKeyDown);
		document.removeEventListener("keyup", this.handleKeyUp);
		this.pointerHandler.destroy();
		this.capabilities.destroy();
		this.actionCallbacks.clear();
		this.heldActionCallbacks.clear();
		this.wildcardCallbacks.length = 0;
	}
}
