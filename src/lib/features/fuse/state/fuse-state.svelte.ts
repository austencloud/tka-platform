/**
 * Fuse State Factory
 *
 * Five-phase state machine for merging two sequences into one.
 * Phases: browse -> left-selected -> both-selected -> fusing -> result
 *
 * The factory receives DI services as arguments (never resolves from container internally).
 * Returns a plain object with getter accessors, matching the Factory + Context pattern.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceFuser } from "../services/contracts/ISequenceFuser";
import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";

export type FusePhase =
	| "browse"
	| "left-selected"
	| "both-selected"
	| "fusing"
	| "result";

export interface FuseStateDeps {
	sequenceFuser: ISequenceFuser;
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
		// localStorage may be full or unavailable — silently ignore
	}
}

export function createFuseState(deps: FuseStateDeps) {
	const { sequenceFuser } = deps;

	const persisted = readPersistedState();

	let phase = $state<FusePhase>("browse");
	let leftSequence = $state<SequenceData | null>(null);
	let rightSequence = $state<SequenceData | null>(null);
	let fusedSequence = $state<SequenceData | null>(null);
	let matchLengths = $state(persisted.matchLengths ?? true);
	let bpm = $state(persisted.bpm ?? 60);

	const DEFAULT_BPM = 60;

	// Persist bpm and matchLengths whenever they change
	$effect(() => {
		writePersistedState({ bpm, matchLengths });
	});

	// Animation controller references for sync
	let leftController: IAnimationPlaybackController | null = null;
	let rightController: IAnimationPlaybackController | null = null;

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
		// If no left yet, stay in current phase (user picked right first — still need left)
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
				maxBeats: matchLengths
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
		phase = "browse";
		leftSequence = null;
		rightSequence = null;
		fusedSequence = null;
		matchLengths = true;
		bpm = 60;
		leftController?.dispose();
		rightController?.dispose();
		leftController = null;
		rightController = null;
	}

	function registerController(side: "left" | "right", controller: IAnimationPlaybackController) {
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

	function setMatchLengths(value: boolean) {
		matchLengths = value;
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
		selectLeft,
		selectRight,
		deselectLeft,
		deselectRight,
		startFuse,
		completeFuse,
		reset,
		setBpm,
		setMatchLengths,
		registerController,
		unregisterController,
	};
}

export type FuseState = ReturnType<typeof createFuseState>;
