/**
 * WindowManager Implementation
 *
 * Manages window lifecycle, z-ordering, and geometry by mutating
 * the shared DesktopState. Stores pre-maximize bounds so windows
 * can be restored after maximizing.
 *
 * Domain: Retro Desktop Shell
 */

import type { WindowOpenConfig } from "./types";
import type { RetroWindowState } from "../domain/types/retro-types";
import { desktopState } from "../state/desktop-state.svelte";

/** Height of the Win95-style taskbar in pixels. */
const TASKBAR_HEIGHT = 28;

interface WindowBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export class WindowManager {
	/**
	 * Stores the bounds a window had before it was maximized,
	 * keyed by window ID. Cleared when the window is closed.
	 */
	private preMaxBounds = new Map<string, WindowBounds>();

	openWindow(config: WindowOpenConfig): void {
		const existing = this.findWindow(config.id);
		if (existing) {
			this.focusWindow(config.id);
			return;
		}

		const zIndex = desktopState.nextZIndex++;
		const window: RetroWindowState = { ...config, zIndex };

		desktopState.windows = [...desktopState.windows, window];
		desktopState.activeWindowId = config.id;
	}

	closeWindow(id: string): void {
		const wasActive = desktopState.activeWindowId === id;

		desktopState.windows = desktopState.windows.filter((w) => w.id !== id);
		this.preMaxBounds.delete(id);

		if (wasActive) {
			desktopState.activeWindowId = this.getTopmostWindowId();
		}
	}

	focusWindow(id: string): void {
		const win = this.findWindow(id);
		if (!win) return;

		if (win.isMinimized) {
			win.isMinimized = false;
		}

		win.zIndex = desktopState.nextZIndex++;
		desktopState.activeWindowId = id;
	}

	minimizeWindow(id: string): void {
		const win = this.findWindow(id);
		if (!win) return;

		win.isMinimized = true;

		if (desktopState.activeWindowId === id) {
			desktopState.activeWindowId = this.getTopmostVisibleWindowId();
		}
	}

	maximizeWindow(id: string): void {
		const win = this.findWindow(id);
		if (!win) return;

		// Store current bounds before maximizing
		if (!this.preMaxBounds.has(id)) {
			this.preMaxBounds.set(id, {
				x: win.x,
				y: win.y,
				width: win.width,
				height: win.height,
			});
		}

		win.x = 0;
		win.y = 0;
		win.width = typeof window !== "undefined" ? window.innerWidth : 1024;
		win.height =
			(typeof window !== "undefined" ? window.innerHeight : 768) -
			TASKBAR_HEIGHT;
		win.isMaximized = true;

		this.focusWindow(id);
	}

	restoreWindow(id: string): void {
		const win = this.findWindow(id);
		if (!win) return;

		if (win.isMaximized) {
			const bounds = this.preMaxBounds.get(id);
			if (bounds) {
				win.x = bounds.x;
				win.y = bounds.y;
				win.width = bounds.width;
				win.height = bounds.height;
				this.preMaxBounds.delete(id);
			}
			win.isMaximized = false;
		}

		if (win.isMinimized) {
			win.isMinimized = false;
		}

		this.focusWindow(id);
	}

	moveWindow(id: string, x: number, y: number): void {
		const win = this.findWindow(id);
		if (!win) return;

		win.x = x;
		win.y = y;
	}

	resizeWindow(id: string, width: number, height: number): void {
		const win = this.findWindow(id);
		if (!win) return;

		win.width = Math.max(width, win.minWidth ?? 200);
		win.height = Math.max(height, win.minHeight ?? 150);
	}

	getWindow(id: string): RetroWindowState | undefined {
		return this.findWindow(id);
	}

	isWindowOpen(id: string): boolean {
		return desktopState.windows.some((w) => w.id === id);
	}


	private findWindow(id: string): RetroWindowState | undefined {
		return desktopState.windows.find((w) => w.id === id);
	}

	/**
	 * Return the ID of the topmost window regardless of visibility,
	 * or null if no windows remain.
	 */
	private getTopmostWindowId(): string | null {
		if (desktopState.windows.length === 0) return null;

		return desktopState.windows.reduce((top, w) =>
			w.zIndex > top.zIndex ? w : top
		).id;
	}

	/**
	 * Return the ID of the topmost non-minimized window,
	 * or null if all windows are minimized or none remain.
	 */
	private getTopmostVisibleWindowId(): string | null {
		const visible = desktopState.windows.filter((w) => !w.isMinimized);
		if (visible.length === 0) return null;

		return visible.reduce((top, w) => (w.zIndex > top.zIndex ? w : top)).id;
	}
}
