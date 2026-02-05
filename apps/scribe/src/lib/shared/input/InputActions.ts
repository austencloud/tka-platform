/**
 * Input Actions
 *
 * Semantic actions that the user wants to perform.
 * These are device-agnostic - "place_object" could come from
 * a mouse click, touch tap, gamepad button, or keyboard key.
 */

// Movement actions
export type MovementAction =
	| "move_forward"
	| "move_backward"
	| "move_left"
	| "move_right"
	| "look_around"
	| "jump"
	| "run_start"
	| "run_stop"
	| "fly_toggle";

// Placement actions
export type PlacementAction =
	| "place_object"
	| "cancel_placement"
	| "cycle_object_next"
	| "cycle_object_prev"
	| "select_slot_1"
	| "select_slot_2"
	| "select_slot_3"
	| "select_slot_4"
	| "select_slot_5"
	| "select_slot_6";

// Editing actions
export type EditingAction =
	| "select_object"
	| "deselect_object"
	| "transform_translate"
	| "transform_rotate"
	| "transform_scale"
	| "delete_object";

// View actions
export type ViewAction =
	| "switch_to_overhead"
	| "switch_to_firstperson"
	| "toggle_placement_mode"
	| "zoom_in"
	| "zoom_out";

// All actions
export type InputAction = MovementAction | PlacementAction | EditingAction | ViewAction;

/**
 * Action event with metadata
 */
export interface ActionEvent {
	action: InputAction;
	pointerType: "mouse" | "touch" | "pen" | "keyboard" | "gamepad";
	timestamp: number;
	// For continuous actions like look_around
	deltaX?: number;
	deltaY?: number;
	// For position-based actions like place_object
	clientX?: number;
	clientY?: number;
}

/**
 * Held action state (for actions that need start/stop, like running)
 */
export interface HeldActionState {
	action: InputAction;
	isHeld: boolean;
}
