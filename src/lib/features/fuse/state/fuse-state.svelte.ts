/**
 * Fuse State Factory
 *
 * Five-phase state machine for merging two sequences into one.
 * Phases: browse -> left-selected -> both-selected -> fusing -> result
 *
 * The factory receives DI services as arguments (never resolves from container internally).
 * Returns a plain object with getter accessors, matching the Factory + Context pattern.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
import type { fuseSequences } from "../services/sequence-fuser";
export type FusePhase =
	| "browse"
	| "left-selected"
	| "both-selected"
	| "fusing"
	| "result";

export interface FuseStateDeps {
	sequenceFuser: { fuse: typeof fuseSequences };
}

const STORAGE_KEY = "fuse-tab-state";

interface PersistedFuseState {
	bpm?: number;
	matchLengths?: boolean;
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

export function createFuseState(deps: FuseStateDeps) {
	const { sequenceFuser } = deps;

	const persisted = readPersistedState();

	let phase = $state<FusePhase>("browse");
	let leftSequence = $state<SequenceData | null>(null);
	let rightSequence = $state<SequenceData | null>(null);
	let fusedSequence = $state<SequenceData | null>(null);
	const matchLengths = true;
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

	const canFuse = $derived(
		phase === "both-selected" &&
			leftSequence !== null &&
			rightSequence !== null
	);

	function selectLeft(seq: SequenceData) {
		leftSequence = seq;
		if (rightSequence) {
			phase = "both-selected";
		} else {
			phase = "left-selected";
		}
	}

	function selectRight(seq: SequenceData) {
		rightSequence = seq;
		if (leftSequence) {
			phase = "both-selected";
		}
		// If no left yet, stay in current phase (user picked right first - still need left)
	}

	function deselectLeft() {
		leftSequence = null;
		fusedSequence = null;
		leftController?.dispose();
		leftController = null;
		phase = rightSequence ? "browse" : "browse";
	}

	function deselectRight() {
		rightSequence = null;
		fusedSequence = null;
		rightController?.dispose();
		rightController = null;
		phase = leftSequence ? "left-selected" : "browse";
	}

	function startFuse() {
		if (!leftSequence || !rightSequence) return;

		// Compute the fused result first, then enter the "fusing" phase so the
		// layout can play the assembly animation. The layout calls completeFuse()
		// when the animation finishes, which transitions to "result".
		try {
			const blue = leftSequence.blueSoloProp;
			const red = rightSequence.redSoloProp;

			if (!blue || !red) {
				// Cannot fuse sequences without compositional data yet.
				// Later tasks will add sequence-to-solo-prop extraction.
				return;
			}

			const result = sequenceFuser.fuse(blue, red, {
				maxSteps: matchLengths
					? Math.min(
							leftSequence.steps.length || 8,
							rightSequence.steps.length || 8
						)
					: undefined,
			});

			fusedSequence = result;
			phase = "fusing";
		} catch {
			// Revert to both-selected so user can retry or change selections
			phase = "both-selected";
		}
	}

	function completeFuse() {
		// Called by FuseLayout after the assembly animation finishes.
		// Transitions from "fusing" to "result" so FuseTab renders FuseResultView.
		phase = "result";
	}

	function reset() {
		stopClock();
		currentStep = 0;
		phase = "browse";
		leftSequence = null;
		rightSequence = null;
		fusedSequence = null;
		bpm = 60;
		leftController?.dispose();
		rightController?.dispose();
		leftController = null;
		rightController = null;
	}

	function toggleClock() {
		if (clockRunning) {
			stopClock();
		} else {
			startClock();
		}
	}

	function dispose() {
		stopClock();
	}

	function registerController(side: "left" | "right", controller: AnimationPlaybackController) {
		if (side === "left") leftController = controller;
		else rightController = controller;

		// Sync BPM to the newly registered controller
		const speed = bpm / DEFAULT_BPM;
		controller.setSpeed(speed);

		// When both controllers are present, seek the second to match the first
		if (leftController && rightController) {
			const reference = side === "right" ? leftController : rightController;
			const newOne = controller;
			try {
				const states = reference.getCurrentPropStates();
				if (states) {
					newOne.seekToStep(0);
				}
			} catch {
				// Controller may not be fully initialized yet
			}
		}
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

	function setFusedSequence(seq: SequenceData) {
		fusedSequence = seq;
	}

	return {
		get phase() {
			return phase;
		},
		get leftSequence() {
			return leftSequence;
		},
		get rightSequence() {
			return rightSequence;
		},
		get fusedSequence() {
			return fusedSequence;
		},
		get matchLengths() {
			return matchLengths;
		},
		get bpm() {
			return bpm;
		},
		get canFuse() {
			return canFuse;
		},
		get currentStep() { return currentStep; },
		get clockRunning() { return clockRunning; },
		startClock,
		stopClock,
		toggleClock,
		dispose,
		selectLeft,
		selectRight,
		deselectLeft,
		deselectRight,
		startFuse,
		completeFuse,
		reset,
		setBpm,
		registerController,
		unregisterController,
		setFusedSequence,
	};
}

export type FuseState = ReturnType<typeof createFuseState>;
