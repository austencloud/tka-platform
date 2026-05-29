import type { RetroWindowState } from "../domain/types/retro-types";

// --- From IFakeLoadingManager ---
/**
 * IFakeLoadingManager - Contract for theatrical loading sequences
 *
 * Drives the lying progress bars that make TKA-OS feel authentic.
 * Progress jumps forward erratically, occasionally regresses, and
 * always stalls at 99% for dramatic tension before completing.
 *
 * Domain: Retro Desktop Effects
 */

/**
 * What kind of operation the loading bar is pretending to perform.
 * Each context gets its own pool of status messages.
 */
export type LoadingContext = "generate" | "load" | "save" | "install" | "defrag";

/**
 * Snapshot of a loading session's current state.
 * Emitted on every tick so the UI can update reactively.
 */
export interface LoadingSession {
	/** Current progress value, 0-100 */
	progress: number;

	/** Current status message from the context-themed pool */
	message: string;

	/** True once the session has finished (progress hit 100 after the 99% stall) */
	isComplete: boolean;
}

// --- From IWindowManager ---
/**
 * IWindowManager Contract
 *
 * Manages the lifecycle, focus ordering, and geometry of windows
 * in the TKA-OS retro desktop shell. Operates on the shared
 * DesktopState reactive store.
 *
 * Domain: Retro Desktop Shell
 */


/**
 * Configuration for opening a new window.
 * The zIndex is assigned automatically by the manager.
 */
export type WindowOpenConfig = Omit<RetroWindowState, "zIndex">;

