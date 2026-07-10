/**
 * Fuse State Factory
 *
 * Owns the shared beat clock and playback-controller registry for the two
 * shuffle panels. Fusing itself is a one-shot action in FuseLayout (pure
 * `fuseSequences` call → sequence viewer drawer), so no phase machine lives
 * here anymore.
 *
 * Returns a plain object with getter accessors, matching the Factory + Context pattern.
 */

import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";

const STORAGE_KEY = "fuse-tab-state";

interface PersistedFuseState {
	bpm?: number;
}

function readPersistedState(): PersistedFuseState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		return JSON.parse(raw) as PersistedFuseState;
	} catch {
		return {};
	}
}

function writePersistedState(data: PersistedFuseState): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// localStorage may be full or unavailable - silently ignore
	}
}

export function createFuseState() {
	const persisted = readPersistedState();

	let bpm = $state(persisted.bpm ?? 60);

	const DEFAULT_BPM = 60;

	// Persist bpm whenever it changes
	$effect(() => {
		writePersistedState({ bpm });
	});

	// Animation controller references for sync
	let leftController: AnimationPlaybackController | null = null;
	let rightController: AnimationPlaybackController | null = null;

	// Shared beat clock - single rAF loop drives all panels
	let currentStep = $state(0);
	let clockRunning = $state(false);
	let clockAnimFrameId: number | null = null;
	let lastClockTimestamp: number | null = null;

	function startClock() {
		if (clockRunning) return;
		clockRunning = true;
		lastClockTimestamp = null;
		tickClock();
	}

	function stopClock() {
		clockRunning = false;
		if (clockAnimFrameId !== null) {
			cancelAnimationFrame(clockAnimFrameId);
			clockAnimFrameId = null;
		}
		lastClockTimestamp = null;
	}

	function tickClock() {
		if (!clockRunning) return;
		clockAnimFrameId = requestAnimationFrame((now) => {
			if (lastClockTimestamp !== null) {
				const deltaMs = now - lastClockTimestamp;
				const beatsPerMs = bpm / 60_000;
				currentStep += deltaMs * beatsPerMs;
			}
			lastClockTimestamp = now;
			tickClock();
		});
	}

	function toggleClock() {
		if (clockRunning) {
			stopClock();
		} else {
			startClock();
		}
	}

	function dispose() {
		// Controllers are owned (and disposed) by their FuseAnimationPreview
		// instances - the state only drops its references.
		stopClock();
		leftController = null;
		rightController = null;
	}

	function registerController(side: "left" | "right", controller: AnimationPlaybackController) {
		if (side === "left") leftController = controller;
		else rightController = controller;

		// Sync BPM to the newly registered controller
		const speed = bpm / DEFAULT_BPM;
		controller.setSpeed(speed);
	}

	function unregisterController(side: "left" | "right") {
		if (side === "left") leftController = null;
		else rightController = null;
	}

	function setBpm(value: number) {
		bpm = value;
		// Sync speed to both controllers
		const speed = value / DEFAULT_BPM;
		leftController?.setSpeed(speed);
		rightController?.setSpeed(speed);
	}

	return {
		get bpm() {
			return bpm;
		},
		get currentStep() {
			return currentStep;
		},
		get clockRunning() {
			return clockRunning;
		},
		startClock,
		stopClock,
		toggleClock,
		dispose,
		setBpm,
		registerController,
		unregisterController,
	};
}

export type FuseState = ReturnType<typeof createFuseState>;
