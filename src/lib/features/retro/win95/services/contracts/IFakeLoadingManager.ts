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

export interface IFakeLoadingManager {
	/**
	 * Begin a new loading session. Resets all state from any
	 * previous session and starts the progress ticker.
	 *
	 * @param context - Determines which message pool to use
	 * @param durationMs - Approximate total duration (default ~3000ms)
	 */
	startSession(context: LoadingContext, durationMs?: number): void;

	/**
	 * Return a snapshot of the current session state.
	 * If no session is active, returns progress 0 / empty message / not complete.
	 */
	getSession(): LoadingSession;

	/**
	 * Abort the current session immediately.
	 * Clears the ticker and resets state.
	 */
	cancelSession(): void;

	/**
	 * Subscribe to progress updates. The callback fires on every tick
	 * (~200ms) with the latest session snapshot.
	 *
	 * @returns Unsubscribe function
	 */
	onProgress(callback: (session: LoadingSession) => void): () => void;
}
