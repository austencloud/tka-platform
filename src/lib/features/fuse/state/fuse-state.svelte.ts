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

export type FusePhase =
	| "browse"
	| "left-selected"
	| "both-selected"
	| "fusing"
	| "result";

export interface FuseStateDeps {
	sequenceFuser: ISequenceFuser;
}

export function createFuseState(deps: FuseStateDeps) {
	const { sequenceFuser } = deps;

	let phase = $state<FusePhase>("browse");
	let leftSequence = $state<SequenceData | null>(null);
	let rightSequence = $state<SequenceData | null>(null);
	let fusedSequence = $state<SequenceData | null>(null);
	let matchLengths = $state(true);
	let bpm = $state(60);

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
		phase = rightSequence ? "browse" : "browse";
	}

	function deselectRight() {
		rightSequence = null;
		fusedSequence = null;
		phase = leftSequence ? "left-selected" : "browse";
	}

	function startFuse() {
		if (!leftSequence || !rightSequence) return;

		phase = "fusing";

		// The fuser expects HandPathData or SoloPropData. For now, we use the
		// solo prop data when available, falling back to a minimal hand path
		// derived from the sequence steps. Full wiring happens in a later task.
		try {
			const blue = leftSequence.blueSoloProp;
			const red = rightSequence.redSoloProp;

			if (!blue || !red) {
				// Cannot fuse sequences without compositional data yet.
				// Later tasks will add sequence-to-solo-prop extraction.
				phase = "both-selected";
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
			phase = "result";
		} catch {
			// Revert to both-selected so user can retry or change selections
			phase = "both-selected";
		}
	}

	function completeFuse() {
		// Called after the user accepts the result (save, export, etc.)
		// For now just stays in result phase. Later tasks add persistence.
	}

	function reset() {
		phase = "browse";
		leftSequence = null;
		rightSequence = null;
		fusedSequence = null;
		matchLengths = true;
		bpm = 60;
	}

	function setBpm(value: number) {
		bpm = value;
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
	};
}

export type FuseState = ReturnType<typeof createFuseState>;
