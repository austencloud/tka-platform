/**
 * Hint Provider
 *
 * Provides context-aware UI hints based on current input method.
 * Adapts hints dynamically as the user switches between touch, mouse, and keyboard.
 */

import type { InputManager } from "./InputManager";
import type { InputAction } from "./InputActions";
import type { InputContext } from "./InputContexts";

export interface ControlHint {
	action: InputAction;
	label: string; // What the action does ("Place", "Move", "Look")
	key: string; // What to press/tap ("Click", "Tap", "WASD")
}

/**
 * Get control hints for first-person mode based on current input method
 */
export function getFirstPersonHints(manager: InputManager, hasPlacementObject: boolean): ControlHint[] {
	const caps = manager.getCapabilities();
	const isTouch = caps.currentPointerType === "touch";

	const hints: ControlHint[] = [];

	// Movement
	if (isTouch) {
		hints.push({ action: "move_forward", label: "Move", key: "Joystick" });
	} else {
		hints.push({ action: "move_forward", label: "Move", key: "WASD" });
	}

	// Object selection
	if (!isTouch) {
		hints.push({ action: "select_slot_1", label: "Select", key: "1-6" });
		hints.push({ action: "cycle_object_next", label: "Cycle", key: "Q" });
	}

	// Placement (only show if object selected)
	if (hasPlacementObject) {
		hints.push({
			action: "place_object",
			label: "Place",
			key: isTouch ? "Tap" : "Click",
		});
		hints.push({
			action: "cancel_placement",
			label: "Cancel",
			key: isTouch ? "Back" : "ESC",
		});
	}

	return hints;
}

/**
 * Get control hints for overhead mode
 */
export function getOverheadHints(manager: InputManager, inPlacementMode: boolean): ControlHint[] {
	const caps = manager.getCapabilities();
	const isTouch = caps.currentPointerType === "touch";

	const hints: ControlHint[] = [];

	if (inPlacementMode) {
		hints.push({
			action: "place_object",
			label: "Place",
			key: isTouch ? "Tap" : "Click",
		});
		hints.push({
			action: "cancel_placement",
			label: "Cancel",
			key: isTouch ? "Back" : "ESC",
		});
	} else {
		hints.push({
			action: "select_object",
			label: "Select",
			key: isTouch ? "Tap" : "Click",
		});
	}

	return hints;
}

/**
 * Get control hints for editing mode (transform controls active)
 */
export function getEditingHints(manager: InputManager): ControlHint[] {
	const caps = manager.getCapabilities();
	const isTouch = caps.currentPointerType === "touch";

	if (isTouch) {
		// Touch editing uses gizmo directly
		return [
			{ action: "deselect_object", label: "Done", key: "Tap outside" },
			{ action: "delete_object", label: "Delete", key: "Long press" },
		];
	}

	return [
		{ action: "transform_translate", label: "Move", key: "W" },
		{ action: "transform_rotate", label: "Rotate", key: "E" },
		{ action: "transform_scale", label: "Scale", key: "R" },
		{ action: "delete_object", label: "Delete", key: "Del" },
		{ action: "deselect_object", label: "Done", key: "ESC" },
	];
}

/**
 * Format hints as a single string for simple display
 */
export function formatHintsAsString(hints: ControlHint[], separator = " • "): string {
	return hints.map((h) => `${h.key} ${h.label.toLowerCase()}`).join(separator);
}

/**
 * Get movement hint string based on input method
 */
export function getMovementHint(manager: InputManager): string {
	const caps = manager.getCapabilities();

	if (caps.currentPointerType === "touch") {
		return "Drag left side to move";
	}

	return "WASD to move";
}

/**
 * Get look hint string based on input method
 */
export function getLookHint(manager: InputManager): string {
	const caps = manager.getCapabilities();

	if (caps.currentPointerType === "touch") {
		return "Drag right side to look";
	}

	if (caps.isPointerLocked) {
		return "Mouse to look";
	}

	return "Click to enable mouse look";
}
