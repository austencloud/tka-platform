/**
 * Grid Experience State Machine
 * Manages step progression, phase transitions, persistence, and accessibility announcements
 */

import { getExperiencePersistence } from '../../../state/experience-persistence.svelte';

export type GridPhase = 'split' | 'diamond-labels' | 'box-labels' | 'merged';
export type PointTypePhase = 'center' | 'hand' | 'outer';
export type EffectivePhase = 'intro' | 'split' | 'diamond-labels' | 'box-labels' | 'merged';
export type HighlightPhase = 'none' | 'center' | 'hand' | 'outer';
export type TapPhase = 'center' | 'hand' | 'outer' | 'box' | 'complete';

export interface GridExperienceState {
	step: number;
	gridPhase: GridPhase;
	pointTypePhase: PointTypePhase;
	animateIn: boolean;
	announcement: string;
}

export function createGridExperienceState(isScrollMode: boolean = false) {
	const persistence = getExperiencePersistence('grid');
	const initialState = !isScrollMode ? persistence.load() : { step: 0, phaseData: {} };

	const totalSteps = 5;

	// Core state
	let step = $state(initialState.step);
	let gridPhase = $state<GridPhase>(
		(initialState.phaseData?.gridPhase as GridPhase) ?? 'split'
	);
	let pointTypePhase = $state<PointTypePhase>(
		(initialState.phaseData?.pointTypePhase as PointTypePhase) ?? 'center'
	);
	let animateIn = $state(false);
	let announcement = $state('');
	let tapPhase = $state<TapPhase>('center');
	let tappedPoints = $state<string[]>([]);

	// Derived phases for GridMergeAnimation
	const effectivePhase = $derived<EffectivePhase>(
		step === 0 ? 'intro' : step === 1 ? gridPhase : 'merged'
	);

	const effectiveHighlightPhase = $derived<HighlightPhase>(
		step === 2 ? pointTypePhase : 'none'
	);

	// Accessibility: derive announcement text
	function getAnnouncement(): string {
		if (step === 0) return 'Step 1 of 5: The Grid. A 4-point diamond grid.';
		if (step === 1) {
			if (gridPhase === 'split')
				return 'Step 2 of 5: Two Grid Modes. Diamond and Box grids shown side by side.';
			if (gridPhase === 'diamond-labels')
				return 'Diamond mode: Cardinal directions North, East, South, West.';
			if (gridPhase === 'box-labels')
				return 'Box mode: Intercardinal directions Northeast, Southeast, Southwest, Northwest.';
			if (gridPhase === 'merged')
				return 'The grids merge to form the complete 8-point grid.';
		}
		if (step === 2) {
			if (pointTypePhase === 'center')
				return 'Step 3 of 5: Point Types. The center point is highlighted.';
			if (pointTypePhase === 'hand') return '4 hand points are highlighted.';
			if (pointTypePhase === 'outer') return '4 outer points are highlighted.';
		}
		if (step === 3) {
			if (tapPhase === 'center') return 'Step 4 of 5: Build the Grid. Tap the center point.';
			if (tapPhase === 'hand') return 'Tap each hand point.';
			if (tapPhase === 'outer') return 'Tap each diamond outer point.';
			if (tapPhase === 'box') return 'Tap each box outer point.';
			if (tapPhase === 'complete') return 'Grid complete!';
		}
		if (step === 4) return "Step 5 of 5: Lesson complete.";
		return '';
	}

	function announce() {
		announcement = '';
		requestAnimationFrame(() => {
			announcement = getAnnouncement();
		});
	}

	function startAnimations() {
		requestAnimationFrame(() => {
			animateIn = true;
			announce();
		});
	}

	// Returns true if handled internally (phase change), false if step change needed
	function handleNextPhase(): boolean {
		// Step 1 grid phases
		if (step === 1) {
			if (gridPhase === 'split') {
				gridPhase = 'diamond-labels';
				persistence.savePhaseData('gridPhase', 'diamond-labels');
				announce();
				return true;
			} else if (gridPhase === 'diamond-labels') {
				gridPhase = 'box-labels';
				persistence.savePhaseData('gridPhase', 'box-labels');
				announce();
				return true;
			} else if (gridPhase === 'box-labels') {
				gridPhase = 'merged';
				persistence.savePhaseData('gridPhase', 'merged');
				announce();
				return true;
			} else if (gridPhase === 'merged') {
				// Reset for next time
				gridPhase = 'split';
				persistence.savePhaseData('gridPhase', 'split');
				pointTypePhase = 'center';
				persistence.savePhaseData('pointTypePhase', 'center');
				return false; // Proceed to next step
			}
		}

		// Step 2 point type phases
		if (step === 2) {
			if (pointTypePhase === 'center') {
				pointTypePhase = 'hand';
				persistence.savePhaseData('pointTypePhase', 'hand');
				announce();
				return true;
			} else if (pointTypePhase === 'hand') {
				pointTypePhase = 'outer';
				persistence.savePhaseData('pointTypePhase', 'outer');
				announce();
				return true;
			} else if (pointTypePhase === 'outer') {
				pointTypePhase = 'center';
				persistence.savePhaseData('pointTypePhase', 'center');
				return false; // Proceed to next step
			}
		}

		return false;
	}

	// Returns true if handled internally (phase change), false if step change needed
	function handleBackPhase(): boolean {
		// Step 1 grid phases
		if (step === 1) {
			if (gridPhase === 'merged') {
				gridPhase = 'box-labels';
				persistence.savePhaseData('gridPhase', 'box-labels');
				announce();
				return true;
			} else if (gridPhase === 'box-labels') {
				gridPhase = 'diamond-labels';
				persistence.savePhaseData('gridPhase', 'diamond-labels');
				announce();
				return true;
			} else if (gridPhase === 'diamond-labels') {
				gridPhase = 'split';
				persistence.savePhaseData('gridPhase', 'split');
				announce();
				return true;
			}
		}

		// Step 2 point type phases
		if (step === 2) {
			if (pointTypePhase === 'outer') {
				pointTypePhase = 'hand';
				persistence.savePhaseData('pointTypePhase', 'hand');
				announce();
				return true;
			} else if (pointTypePhase === 'hand') {
				pointTypePhase = 'center';
				persistence.savePhaseData('pointTypePhase', 'center');
				announce();
				return true;
			}
		}

		return false;
	}

	// Returns the new tapPhase after processing the tap, or null if rejected
	function tapPoint(pointId: string, onAllComplete?: () => void): TapPhase | null {
		if (tappedPoints.includes(pointId)) return null;

		const centerIds = ['center'];
		const handIds = ['hn', 'he', 'hs', 'hw'];
		const outerIds = ['n', 'e', 's', 'w'];
		const boxIds = ['ne', 'se', 'sw', 'nw'];

		// Validate point belongs to current phase
		const validIds =
			tapPhase === 'center' ? centerIds :
			tapPhase === 'hand' ? handIds :
			tapPhase === 'outer' ? outerIds :
			tapPhase === 'box' ? boxIds : [];

		if (!validIds.includes(pointId)) return null;

		tappedPoints = [...tappedPoints, pointId];

		// Check if current group is complete, advance phase
		if (tapPhase === 'center' && tappedPoints.length === 1) {
			tapPhase = 'hand';
			announce();
		} else if (tapPhase === 'hand' && tappedPoints.filter(id => handIds.includes(id)).length === 4) {
			tapPhase = 'outer';
			announce();
		} else if (tapPhase === 'outer' && tappedPoints.filter(id => outerIds.includes(id)).length === 4) {
			tapPhase = 'box';
			announce();
		} else if (tapPhase === 'box' && tappedPoints.filter(id => boxIds.includes(id)).length === 4) {
			tapPhase = 'complete';
			announce();
			// Auto-advance to completion step after 800ms celebration
			if (onAllComplete) {
				setTimeout(onAllComplete, 800);
			}
		}

		return tapPhase;
	}

	function resetTapState() {
		tapPhase = 'center';
		tappedPoints = [];
	}

	function nextStep(onComplete?: () => void) {
		animateIn = false;
		requestAnimationFrame(() => {
			step++;
			persistence.saveStep(step);
			requestAnimationFrame(() => {
				animateIn = true;
				announce();
				onComplete?.();
			});
		});
	}

	function prevStep(onComplete?: () => void) {
		animateIn = false;
		requestAnimationFrame(() => {
			step--;
			persistence.saveStep(step);
			// Reset phases when returning to previous steps
			if (step === 1) {
				gridPhase = 'merged';
				persistence.savePhaseData('gridPhase', 'merged');
			} else if (step === 2) {
				pointTypePhase = 'outer';
				persistence.savePhaseData('pointTypePhase', 'outer');
			} else if (step === 3) {
				resetTapState();
			}
			requestAnimationFrame(() => {
				animateIn = true;
				announce();
				onComplete?.();
			});
		});
	}

	function skipToSummary(onComplete?: () => void) {
		animateIn = false;
		requestAnimationFrame(() => {
			step = 4;
			persistence.saveStep(step);
			requestAnimationFrame(() => {
				animateIn = true;
				announce();
				onComplete?.();
			});
		});
	}

	function reset() {
		persistence.reset();
	}

	function setScrollMode() {
		gridPhase = 'merged';
	}

	return {
		// State (reactive getters)
		get step() { return step; },
		get gridPhase() { return gridPhase; },
		get pointTypePhase() { return pointTypePhase; },
		get animateIn() { return animateIn; },
		get announcement() { return announcement; },
		get effectivePhase() { return effectivePhase; },
		get effectiveHighlightPhase() { return effectiveHighlightPhase; },
		get tapPhase() { return tapPhase; },
		get tappedPoints() { return tappedPoints; },
		totalSteps,

		// Actions
		startAnimations,
		handleNextPhase,
		handleBackPhase,
		nextStep,
		prevStep,
		skipToSummary,
		reset,
		setScrollMode,
		tapPoint,
		resetTapState
	};
}

export type GridExperienceStateManager = ReturnType<typeof createGridExperienceState>;
