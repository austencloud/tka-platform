/**
 * FakeLoadingManager - Theatrical progress bar simulation
 *
 * Drives the classic Windows "please wait" experience: progress jumps
 * forward erratically, occasionally jumps backward (because of course
 * it does), cycles through context-themed status messages at random
 * intervals, and stalls at 99% for dramatic tension before completing.
 *
 * Stateless between sessions. Each startSession() call resets everything.
 *
 * Domain: Retro Desktop Effects
 */

import type { LoadingContext, LoadingSession } from "./types";

// ============================================================================
// MESSAGE POOLS
// ============================================================================

const MESSAGE_POOLS: Record<LoadingContext, readonly string[]> = {
	generate: [
		"Computing kinetic path...",
		"Resolving bridges...",
		"Calibrating prop physics...",
		"Rendering notation...",
		"Optimizing sequence...",
		"Analyzing motion vectors...",
		"Building pictograph data...",
		"Validating orientations...",
	],
	load: [
		"Reading from A:\\...",
		"Buffering data...",
		"Decompressing...",
		"Parsing file header...",
		"Loading assets...",
		"Verifying checksum...",
		"Allocating memory...",
		"Reading sector 0x3FA7...",
	],
	save: [
		"Writing to A:\\...",
		"Formatting floppy...",
		"Verifying data integrity...",
		"Updating directory...",
		"Flushing buffer...",
		"Writing FAT table...",
		"Closing file handle...",
		"Confirming write...",
	],
	install: [
		"Copying files...",
		"Registering components...",
		"Updating registry...",
		"Configuring system...",
		"Installing drivers...",
		"Creating shortcuts...",
		"Verifying installation...",
		"Writing INI files...",
	],
	defrag: [
		"Analyzing drive...",
		"Moving cluster 0x4F2A...",
		"Defragmenting...",
		"Optimizing free space...",
		"Consolidating files...",
		"Reading file allocation table...",
		"Relocating cluster 0xA1B3...",
		"Compacting directory entries...",
	],
} as const;

// ============================================================================
// TUNING CONSTANTS
// ============================================================================

/** How often the progress ticker fires (ms) */
const TICK_INTERVAL_MS = 200;

/** Chance per tick that progress jumps backward instead of forward */
const REGRESSION_CHANCE = 0.15;

/** Min/max forward jump per tick (percentage points) */
const FORWARD_MIN = 1;
const FORWARD_MAX = 15;

/** Min/max backward jump when regression triggers */
const BACKWARD_MIN = 5;
const BACKWARD_MAX = 20;

/** Progress stalls at this value before completing */
const STALL_THRESHOLD = 99;

/** Min/max stall duration at 99% (ms) */
const STALL_MIN_MS = 500;
const STALL_MAX_MS = 1500;

/** Min/max interval between message changes (ms) */
const MESSAGE_CHANGE_MIN_MS = 400;
const MESSAGE_CHANGE_MAX_MS = 800;

/** Default total session duration (ms) */
const DEFAULT_DURATION_MS = 3000;

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class FakeLoadingManager {
	private progress = 0;
	private message = "";
	private isComplete = false;
	private tickTimer: ReturnType<typeof setInterval> | null = null;
	private stallTimer: ReturnType<typeof setTimeout> | null = null;
	private messageTimer: ReturnType<typeof setTimeout> | null = null;
	private listeners: Set<(session: LoadingSession) => void> = new Set();
	private messagePool: readonly string[] = [];
	private lastMessageIndex = -1;

	/**
	 * Target progress per tick, computed from durationMs so the bar
	 * reaches ~99% in roughly the requested time. The random jumps
	 * and regressions add variance around this target.
	 */
	private targetProgressPerTick = 0;

	startSession(context: LoadingContext, durationMs = DEFAULT_DURATION_MS): void {
		this.reset();

		this.messagePool = MESSAGE_POOLS[context];
		this.message = this.pickMessage();

		// How many ticks to reach the stall threshold
		const totalTicks = durationMs / TICK_INTERVAL_MS;
		this.targetProgressPerTick = STALL_THRESHOLD / totalTicks;

		this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
		this.scheduleMessageChange();
		this.emit();
	}

	getSession(): LoadingSession {
		return {
			progress: this.progress,
			message: this.message,
			isComplete: this.isComplete,
		};
	}

	cancelSession(): void {
		this.reset();
	}

	onProgress(callback: (session: LoadingSession) => void): () => void {
		this.listeners.add(callback);
		return () => {
			this.listeners.delete(callback);
		};
	}

	// ── Private ─────────────────────────────────────────────────

	private tick(): void {
		if (this.isComplete) return;

		// Already at stall threshold - enter the dramatic pause
		if (this.progress >= STALL_THRESHOLD) {
			this.clearTickTimer();
			this.enterStall();
			return;
		}

		const regresses = Math.random() < REGRESSION_CHANCE;

		if (regresses) {
			const drop = randomInt(BACKWARD_MIN, BACKWARD_MAX);
			this.progress = Math.max(0, this.progress - drop);
		} else {
			// Scale the random forward jump around the target rate
			const scaleFactor = this.targetProgressPerTick / ((FORWARD_MIN + FORWARD_MAX) / 2);
			const rawJump = randomInt(FORWARD_MIN, FORWARD_MAX);
			const jump = Math.max(1, Math.round(rawJump * scaleFactor));
			this.progress = Math.min(STALL_THRESHOLD, this.progress + jump);
		}

		this.emit();
	}

	private enterStall(): void {
		this.progress = STALL_THRESHOLD;
		this.emit();

		const stallDuration = randomInt(STALL_MIN_MS, STALL_MAX_MS);

		this.stallTimer = setTimeout(() => {
			this.progress = 100;
			this.isComplete = true;
			this.clearMessageTimer();
			this.emit();
		}, stallDuration);
	}

	private pickMessage(): string {
		if (this.messagePool.length === 0) return "";
		if (this.messagePool.length === 1) return this.messagePool[0]!;

		// Avoid repeating the same message twice in a row
		let index: number;
		do {
			index = randomInt(0, this.messagePool.length - 1);
		} while (index === this.lastMessageIndex);

		this.lastMessageIndex = index;
		return this.messagePool[index]!;
	}

	private scheduleMessageChange(): void {
		if (this.isComplete) return;

		const delay = randomInt(MESSAGE_CHANGE_MIN_MS, MESSAGE_CHANGE_MAX_MS);

		this.messageTimer = setTimeout(() => {
			if (this.isComplete) return;

			this.message = this.pickMessage();
			this.emit();
			this.scheduleMessageChange();
		}, delay);
	}

	private emit(): void {
		const session = this.getSession();
		for (const listener of this.listeners) {
			listener(session);
		}
	}

	private reset(): void {
		this.clearTickTimer();
		this.clearStallTimer();
		this.clearMessageTimer();

		this.progress = 0;
		this.message = "";
		this.isComplete = false;
		this.lastMessageIndex = -1;
		this.targetProgressPerTick = 0;
		this.listeners.clear();
	}

	private clearTickTimer(): void {
		if (this.tickTimer !== null) {
			clearInterval(this.tickTimer);
			this.tickTimer = null;
		}
	}

	private clearStallTimer(): void {
		if (this.stallTimer !== null) {
			clearTimeout(this.stallTimer);
			this.stallTimer = null;
		}
	}

	private clearMessageTimer(): void {
		if (this.messageTimer !== null) {
			clearTimeout(this.messageTimer);
			this.messageTimer = null;
		}
	}
}

// ── Helpers ──────────────────────────────────────────────────

/** Inclusive random integer between min and max. */
function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
