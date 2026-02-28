/**
 * DesktopState
 *
 * Svelte 5 runes-based reactive state for the TKA-OS desktop shell.
 * This is a plain reactive container -- all mutation logic lives in
 * the WindowManager and other services that operate on this state.
 *
 * Domain: Retro Desktop Shell
 */

import type {
	RetroWindowState,
	RetroDialogConfig,
} from "../domain/types/retro-types";

class DesktopState {
	/** All open windows on the desktop. */
	windows = $state<RetroWindowState[]>([]);

	/** ID of the window that currently has focus, or null if none. */
	activeWindowId = $state<string | null>(null);

	/** Monotonically increasing counter for z-index assignment. */
	nextZIndex = $state(10);

	/** Queue of dialogs waiting to be displayed (FIFO). */
	dialogQueue = $state<RetroDialogConfig[]>([]);

	/** True while the boot sequence animation is running. */
	isBooting = $state(true);

	/** Flipped to true once the boot sequence finishes. */
	bootComplete = $state(false);

	/** Whether the Start menu is currently open. */
	startMenuOpen = $state(false);

	/** ID of the currently selected desktop icon, or null. */
	selectedDesktopIcon = $state<string | null>(null);
}

export const desktopState = new DesktopState();
