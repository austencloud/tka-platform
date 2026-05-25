/**
 * Meditation Session State (Svelte 5 Runes)
 *
 * Reactive state for guided breathing meditation sessions.
 * Manages breath phase computation, RAF-driven tick clock,
 * visibility-aware pause/resume, and Screen Wake Lock.
 */

import type {
	BreathPhase,
	BreathingPattern,
	BreathingPatternId,
	CompletedSession,
	MeditationSessionStatus,
} from "../domain/meditation-types";
import { getPatternCycleTime } from "../domain/meditation-types";

const PHASE_ORDER: BreathPhase[] = ["inhale", "hold-in", "exhale", "hold-out"];

function getPhaseDuration(pattern: BreathingPattern, phase: BreathPhase): number {
	switch (phase) {
		case "inhale":
			return pattern.inhale;
		case "hold-in":
			return pattern.holdIn;
		case "exhale":
			return pattern.exhale;
		case "hold-out":
			return pattern.holdOut;
	}
}

/**
 * Create a reactive meditation session state instance.
 * One instance per viewer/modal context.
 */
export function createMeditationSession() {
	// ── Core reactive state ────────────────────────────────────────
	let status = $state<MeditationSessionStatus>("idle");
	let pattern = $state<BreathingPattern>(null!);
	let durationMinutes = $state(10);
	let elapsedSeconds = $state(0);
	let breathCount = $state(0);
	let currentPhase = $state<BreathPhase>("inhale");
	let phaseElapsed = $state(0);
	let phaseDuration = $state(0);
	let holdPulseDx = $state<number | undefined>(undefined);
	let sessionHistory = $state<CompletedSession[]>([]);

	// ── Internal (non-reactive) state ──────────────────────────────
	let rafId: number | null = null;
	let sessionStartMs = 0;
	let totalPausedMs = 0;
	let tabHiddenAt: number | null = null;
	let paused = false;
	let animateMin = 0;
	let animateMax = 0;
	let prevCycleIndex = -1;
	let prevPhase: BreathPhase | null = null;
	let onCompleteCallback: (() => void) | undefined;
	let onPhaseChangeCallback: ((phase: BreathPhase) => void) | undefined;
	let wakeLockSentinel: WakeLockSentinel | null = null;

	// ── Visibility change handler ──────────────────────────────────
	function handleVisibilityChange() {
		if (document.hidden) {
			tabHiddenAt = performance.now();
			paused = true;
		} else {
			if (tabHiddenAt !== null) {
				totalPausedMs += performance.now() - tabHiddenAt;
				tabHiddenAt = null;
			}
			paused = false;
		}
	}

	// ── Wake Lock ──────────────────────────────────────────────────
	async function acquireWakeLock() {
		if (!("wakeLock" in navigator)) return;
		try {
			wakeLockSentinel = await navigator.wakeLock.request("screen");
			wakeLockSentinel.addEventListener("release", handleWakeLockRelease);
		} catch {
			// Graceful degradation — API unavailable or permission denied
		}
	}

	function handleWakeLockRelease() {
		// Re-acquire if session is still running (iOS 16.4–18.3 PWA bug mitigation)
		if (status === "running") {
			acquireWakeLock();
		}
	}

	async function releaseWakeLock() {
		if (wakeLockSentinel) {
			wakeLockSentinel.removeEventListener("release", handleWakeLockRelease);
			try {
				await wakeLockSentinel.release();
			} catch {
				// Already released
			}
			wakeLockSentinel = null;
		}
	}

	// ── Breath phase computation ───────────────────────────────────
	function computePhase(elapsed: number) {
		const cycleTime = getPatternCycleTime(pattern);
		if (cycleTime <= 0) return;

		const cycleIndex = Math.floor(elapsed / cycleTime);
		const cycleElapsed = elapsed % cycleTime;

		// Detect new cycle start → increment breath count
		if (cycleIndex > prevCycleIndex && prevCycleIndex >= 0) {
			breathCount = cycleIndex;
		}
		prevCycleIndex = cycleIndex;

		// Walk through phases to find current
		let accumulated = 0;
		for (const phase of PHASE_ORDER) {
			const dur = getPhaseDuration(pattern, phase);
			if (dur <= 0) continue; // Skip zero-duration phases

			if (cycleElapsed < accumulated + dur) {
				currentPhase = phase;
				phaseElapsed = cycleElapsed - accumulated;
				phaseDuration = dur;

				// Fire phase change callback
				if (phase !== prevPhase) {
					prevPhase = phase;
					onPhaseChangeCallback?.(phase);
				}

				// Hold phase micro-pulse
				computeHoldPulse(phase, phaseElapsed);
				return;
			}
			accumulated += dur;
		}
	}

	function computeHoldPulse(phase: BreathPhase, elapsed: number) {
		if (phase === "hold-in" || phase === "hold-out") {
			const range = animateMax - animateMin;
			const amplitude = range * 0.03;
			const sinVal = Math.sin(2 * Math.PI * 0.2 * elapsed);

			if (phase === "hold-in") {
				holdPulseDx = animateMax + sinVal * amplitude;
			} else {
				holdPulseDx = animateMin + sinVal * amplitude;
			}
		} else {
			holdPulseDx = undefined;
		}
	}

	// ── RAF tick loop ──────────────────────────────────────────────
	function tick() {
		if (status !== "running") return;

		if (!paused) {
			const now = performance.now();
			elapsedSeconds = (now - sessionStartMs - totalPausedMs) / 1000;

			// Check session complete
			const targetSeconds = durationMinutes * 60;
			if (elapsedSeconds >= targetSeconds) {
				elapsedSeconds = targetSeconds;
				completeSession();
				return;
			}

			computePhase(elapsedSeconds);
		}

		rafId = requestAnimationFrame(tick);
	}

	// ── Session lifecycle ──────────────────────────────────────────
	function completeSession() {
		status = "complete";
		stopInternal();

		// Final breath count based on total elapsed
		const cycleTime = getPatternCycleTime(pattern);
		if (cycleTime > 0) {
			breathCount = Math.floor(elapsedSeconds / cycleTime);
		}

		sessionHistory = [
			...sessionHistory,
			{
				completedAt: new Date(),
				durationMinutes,
				pattern: pattern.id,
				breathCount,
			},
		];

		onCompleteCallback?.();
	}

	function stopInternal() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		document.removeEventListener("visibilitychange", handleVisibilityChange);
		releaseWakeLock();
	}

	function start(
		p: BreathingPattern,
		dur: number,
		aMin: number,
		aMax: number,
		onComplete?: () => void,
		onPhaseChange?: (phase: BreathPhase) => void,
	): void {
		// Clean up any prior session
		stopInternal();

		// Initialize state
		pattern = p;
		durationMinutes = dur;
		animateMin = aMin;
		animateMax = aMax;
		onCompleteCallback = onComplete;
		onPhaseChangeCallback = onPhaseChange;

		elapsedSeconds = 0;
		breathCount = 0;
		currentPhase = "inhale";
		phaseElapsed = 0;
		phaseDuration = p.inhale;
		holdPulseDx = undefined;
		prevCycleIndex = -1;
		prevPhase = null;
		totalPausedMs = 0;
		tabHiddenAt = null;
		paused = false;

		status = "running";
		sessionStartMs = performance.now();

		// Register visibility handler
		document.addEventListener("visibilitychange", handleVisibilityChange);

		// Acquire wake lock (user gesture context from start button)
		acquireWakeLock();

		// Fire initial phase callback
		onPhaseChangeCallback?.(currentPhase);

		// Start RAF loop
		rafId = requestAnimationFrame(tick);
	}

	function stop(): void {
		if (status !== "running") return;
		status = "idle";
		stopInternal();
	}

	function dispose(): void {
		stopInternal();
		status = "idle";
		elapsedSeconds = 0;
		breathCount = 0;
		holdPulseDx = undefined;
		prevCycleIndex = -1;
		prevPhase = null;
	}

	return {
		get status() {
			return status;
		},
		get pattern() {
			return pattern;
		},
		get durationMinutes() {
			return durationMinutes;
		},
		get elapsedSeconds() {
			return elapsedSeconds;
		},
		get breathCount() {
			return breathCount;
		},
		get currentPhase() {
			return currentPhase;
		},
		get phaseElapsed() {
			return phaseElapsed;
		},
		get phaseDuration() {
			return phaseDuration;
		},
		get holdPulseDx() {
			return holdPulseDx;
		},
		get sessionHistory() {
			return sessionHistory;
		},
		start,
		stop,
		dispose,
	};
}

export type MeditationSession = ReturnType<typeof createMeditationSession>;
