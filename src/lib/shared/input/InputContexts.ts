/**
 * Input Contexts
 *
 * Different modes have different action mappings.
 * Inspired by Unreal Engine's Enhanced Input System.
 */

import type { InputAction } from "./InputActions";

export type InputContext = "first-person" | "first-person-placement" | "overhead" | "overhead-placement" | "editing";

/**
 * Key binding types
 */
export type KeyBinding =
	| { type: "pressed"; key: string } // Fire once on key down
	| { type: "held"; key: string } // Fire start/stop on key down/up
	| { type: "released"; key: string }; // Fire once on key up

/**
 * Pointer binding types
 */
export type PointerBinding =
	| { type: "click"; zone?: "left" | "right" | "center" } // Short press
	| { type: "drag"; zone?: "left" | "right" | "center" }; // Drag movement

/**
 * Complete action mapping for a context
 */
export interface ActionMapping {
	action: InputAction;
	keyboard?: KeyBinding[];
	pointer?: PointerBinding[];
}

/**
 * First-person walking context (no object selected)
 */
export const FIRST_PERSON_CONTEXT: ActionMapping[] = [
	// Movement
	{ action: "move_forward", keyboard: [{ type: "held", key: "KeyW" }, { type: "held", key: "ArrowUp" }] },
	{ action: "move_backward", keyboard: [{ type: "held", key: "KeyS" }, { type: "held", key: "ArrowDown" }] },
	{ action: "move_left", keyboard: [{ type: "held", key: "KeyA" }, { type: "held", key: "ArrowLeft" }] },
	{ action: "move_right", keyboard: [{ type: "held", key: "KeyD" }, { type: "held", key: "ArrowRight" }] },
	{ action: "jump", keyboard: [{ type: "pressed", key: "Space" }] },
	{ action: "run_start", keyboard: [{ type: "held", key: "ShiftLeft" }, { type: "held", key: "ShiftRight" }] },
	{ action: "fly_toggle", keyboard: [{ type: "pressed", key: "KeyG" }] },

	// Look around (pointer drag in right zone, or mouse with pointer lock)
	{ action: "look_around", pointer: [{ type: "drag", zone: "right" }] },

	// Object selection
	{ action: "cycle_object_next", keyboard: [{ type: "pressed", key: "KeyQ" }] },
	{ action: "select_slot_1", keyboard: [{ type: "pressed", key: "Digit1" }] },
	{ action: "select_slot_2", keyboard: [{ type: "pressed", key: "Digit2" }] },
	{ action: "select_slot_3", keyboard: [{ type: "pressed", key: "Digit3" }] },
	{ action: "select_slot_4", keyboard: [{ type: "pressed", key: "Digit4" }] },
	{ action: "select_slot_5", keyboard: [{ type: "pressed", key: "Digit5" }] },
	{ action: "select_slot_6", keyboard: [{ type: "pressed", key: "Digit6" }] },

	// View switching
	{ action: "switch_to_overhead", keyboard: [{ type: "pressed", key: "KeyM" }] },
	{ action: "toggle_placement_mode", keyboard: [{ type: "pressed", key: "KeyP" }] },
];

/**
 * First-person with object selected for placement
 */
export const FIRST_PERSON_PLACEMENT_CONTEXT: ActionMapping[] = [
	// Inherit all first-person mappings
	...FIRST_PERSON_CONTEXT,

	// Placement actions (override/add)
	{
		action: "place_object",
		keyboard: [{ type: "pressed", key: "KeyE" }],
		pointer: [{ type: "click" }], // Click anywhere to place
	},
	{ action: "cancel_placement", keyboard: [{ type: "pressed", key: "Escape" }] },
];

/**
 * Overhead/bird's-eye view context
 */
export const OVERHEAD_CONTEXT: ActionMapping[] = [
	// View controls
	{ action: "switch_to_firstperson", keyboard: [{ type: "pressed", key: "KeyM" }] },
	{ action: "toggle_placement_mode", keyboard: [{ type: "pressed", key: "KeyP" }] },

	// Object selection via click
	{ action: "select_object", pointer: [{ type: "click" }] },

	// Zoom
	{ action: "zoom_in", keyboard: [{ type: "pressed", key: "Equal" }] },
	{ action: "zoom_out", keyboard: [{ type: "pressed", key: "Minus" }] },
];

/**
 * Overhead view with object selected for placement
 */
export const OVERHEAD_PLACEMENT_CONTEXT: ActionMapping[] = [
	...OVERHEAD_CONTEXT,

	// Placement
	{ action: "place_object", pointer: [{ type: "click" }] },
	{ action: "cancel_placement", keyboard: [{ type: "pressed", key: "Escape" }] },
];

/**
 * Editing mode (object selected with transform controls)
 */
export const EDITING_CONTEXT: ActionMapping[] = [
	// Transform mode switching
	{ action: "transform_translate", keyboard: [{ type: "pressed", key: "KeyW" }] },
	{ action: "transform_rotate", keyboard: [{ type: "pressed", key: "KeyE" }] },
	{ action: "transform_scale", keyboard: [{ type: "pressed", key: "KeyR" }] },

	// Deselect/delete
	{ action: "deselect_object", keyboard: [{ type: "pressed", key: "Escape" }] },
	{ action: "delete_object", keyboard: [{ type: "pressed", key: "Delete" }, { type: "pressed", key: "Backspace" }] },
];

/**
 * Get action mappings for a context
 */
export function getContextMappings(context: InputContext): ActionMapping[] {
	switch (context) {
		case "first-person":
			return FIRST_PERSON_CONTEXT;
		case "first-person-placement":
			return FIRST_PERSON_PLACEMENT_CONTEXT;
		case "overhead":
			return OVERHEAD_CONTEXT;
		case "overhead-placement":
			return OVERHEAD_PLACEMENT_CONTEXT;
		case "editing":
			return EDITING_CONTEXT;
		default:
			return FIRST_PERSON_CONTEXT;
	}
}

/**
 * Find which action a keyboard event maps to in a context
 */
export function findKeyboardAction(
	context: InputContext,
	key: string,
	eventType: "pressed" | "held" | "released"
): InputAction | null {
	const mappings = getContextMappings(context);

	for (const mapping of mappings) {
		if (!mapping.keyboard) continue;

		for (const kb of mapping.keyboard) {
			if (kb.key === key && kb.type === eventType) {
				return mapping.action;
			}
			// For held bindings, "pressed" events trigger start, "released" trigger stop
			if (kb.type === "held" && kb.key === key) {
				if (eventType === "pressed" || eventType === "released") {
					return mapping.action;
				}
			}
		}
	}

	return null;
}

/**
 * Find which action a pointer event maps to in a context
 */
export function findPointerAction(
	context: InputContext,
	eventType: "click" | "drag",
	zone?: "left" | "right" | "center"
): InputAction | null {
	const mappings = getContextMappings(context);

	for (const mapping of mappings) {
		if (!mapping.pointer) continue;

		for (const pb of mapping.pointer) {
			if (pb.type === eventType) {
				// Zone match: either no zone specified (matches all) or zones match
				if (!pb.zone || pb.zone === zone) {
					return mapping.action;
				}
			}
		}
	}

	return null;
}
