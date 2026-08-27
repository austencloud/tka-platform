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
	RetroContextMenuItem,
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

	/** Active right-click context menu, or null when closed. */
	contextMenu = $state<{
		x: number;
		y: number;
		items: RetroContextMenuItem[];
	} | null>(null);

	/* Shell settings (Control Panel ↔ desktop wiring)                    */

	/** CRT overlay: horizontal scanline bands. */
	crtScanlines = $state(true);

	/** CRT overlay: radial corner darkening. */
	crtVignette = $state(true);

	/** CRT overlay: rare phosphor flicker animation. */
	crtFlicker = $state(true);

	/** Desktop surface background color (Win95 default teal). */
	desktopColor = $state("#008080");

	/** Master sound volume, 0-100. */
	soundVolume = $state(75);

	/** Whether all sounds are muted. */
	soundMuted = $state(false);

	/** Screensaver idle timeout in seconds (0 = disabled). */
	screensaverTimeout = $state(60);

	/** Double-click speed in milliseconds. */
	doubleClickSpeed = $state(500);

	/* Auth state                                                          */

	/** Whether the user has authenticated (gates the desktop). */
	isAuthenticated = $state(false);

	/** Display name of the authenticated user, or null. */
	userDisplayName = $state<string | null>(null);

	/** Email of the authenticated user, or null. */
	userEmail = $state<string | null>(null);
}

export const desktopState = new DesktopState();
