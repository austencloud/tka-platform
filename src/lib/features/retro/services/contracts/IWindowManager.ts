/**
 * IWindowManager Contract
 *
 * Manages the lifecycle, focus ordering, and geometry of windows
 * in the TKA-OS retro desktop shell. Operates on the shared
 * DesktopState reactive store.
 *
 * Domain: Retro Desktop Shell
 */

import type { RetroWindowState } from "../../domain/types/retro-types";

/**
 * Configuration for opening a new window.
 * The zIndex is assigned automatically by the manager.
 */
export type WindowOpenConfig = Omit<RetroWindowState, "zIndex">;

export interface IWindowManager {
	/**
	 * Open a new window on the desktop.
	 * Assigns the next z-index and sets focus.
	 * If a window with the same ID already exists, focuses it instead.
	 */
	openWindow(config: WindowOpenConfig): void;

	/**
	 * Close and remove a window from the desktop.
	 * If the closed window was active, promotes the topmost remaining
	 * window to active.
	 */
	closeWindow(id: string): void;

	/**
	 * Bring a window to the front of the z-order and mark it active.
	 * If the window is minimized, restores it first.
	 */
	focusWindow(id: string): void;

	/**
	 * Collapse a window to the taskbar.
	 * If the window was active, clears the active window.
	 */
	minimizeWindow(id: string): void;

	/**
	 * Expand a window to fill the desktop area (minus taskbar).
	 * Stores the pre-maximize bounds for later restoration.
	 */
	maximizeWindow(id: string): void;

	/**
	 * Restore a window from either minimized or maximized state.
	 * - From minimized: un-hides and focuses.
	 * - From maximized: returns to pre-maximize bounds.
	 */
	restoreWindow(id: string): void;

	/**
	 * Update a window's position on the desktop.
	 */
	moveWindow(id: string, x: number, y: number): void;

	/**
	 * Update a window's dimensions, respecting minWidth/minHeight.
	 */
	resizeWindow(id: string, width: number, height: number): void;

	/**
	 * Retrieve a window's current state by ID.
	 */
	getWindow(id: string): RetroWindowState | undefined;

	/**
	 * Check whether a window with the given ID exists on the desktop.
	 */
	isWindowOpen(id: string): boolean;
}
