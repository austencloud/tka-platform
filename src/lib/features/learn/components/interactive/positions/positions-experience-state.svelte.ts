/**
 * Positions Experience State Machine
 *
 * Manages phase progression through Discovery → Construction Quiz → Speed Rounds → Complete.
 * Follows the same reactive getter + double-rAF transition pattern as Grid experience state.
 */

import { getExperiencePersistence } from '../../../state/experience-persistence.svelte';

export type PositionsPhase = 'discovery' | 'construction-quiz' | 'speed-rounds' | 'complete';

export interface PositionsExperienceState {
	phase: PositionsPhase;
	discoveredTypes: Set<string>;
	allDiscovered: boolean;
	quizScore: number;
	quizTotal: number;
	quizPassed: boolean;
	currentStreak: number;
	bestStreak: number;
	animateIn: boolean;
	announcement: string;
}

export function createPositionsExperienceState() {
	const persistence = getExperiencePersistence('positions');
	const initialState = persistence.load();

	// Restore persisted phase (mapped from step number for persistence API compatibility)
	const phaseMap: Record<number, PositionsPhase> = {
		0: 'discovery',
		1: 'construction-quiz',
		2: 'speed-rounds',
		3: 'complete'
	};
	const stepMap: Record<PositionsPhase, number> = {
		'discovery': 0,
		'construction-quiz': 1,
		'speed-rounds': 2,
		'complete': 3
	};

	const restoredPhase = phaseMap[initialState.step] ?? 'discovery';
	const restoredDiscovered = (initialState.phaseData?.discoveredTypes as string[]) ?? [];
	const restoredQuizPassed = (initialState.phaseData?.quizPassed as boolean) ?? false;

	// Core state
	let phase = $state<PositionsPhase>(restoredPhase);
	let discoveredTypes = $state<Set<string>>(new Set(restoredDiscovered));
	let quizScore = $state(0);
	let quizTotal = $state(0);
	let quizPassed = $state(restoredQuizPassed);
	let currentStreak = $state(0);
	let bestStreak = $state(0);
	let animateIn = $state(false);
	let announcement = $state('');

	// Derived
	const allDiscovered = $derived(
		discoveredTypes.has('alpha') && discoveredTypes.has('beta') && discoveredTypes.has('gamma')
	);

	// Accessibility announcements
	function getAnnouncement(): string {
		switch (phase) {
			case 'discovery':
				return `Discovery phase. ${discoveredTypes.size} of 3 position types discovered.`;
			case 'construction-quiz':
				return `Construction quiz. Score: ${quizScore} of ${quizTotal}.`;
			case 'speed-rounds':
				return `Speed rounds. Current streak: ${currentStreak}. Best streak: ${bestStreak}.`;
			case 'complete':
				return 'Positions lesson complete.';
			default:
				return '';
		}
	}

	function announce() {
		announcement = '';
		requestAnimationFrame(() => {
			announcement = getAnnouncement();
		});
	}

	/**
	 * Double-rAF phase transition: fade out → update phase → fade in.
	 * Matches the Grid lesson's nextStep/prevStep pattern exactly.
	 */
	function transitionTo(newPhase: PositionsPhase, onComplete?: () => void) {
		animateIn = false;
		requestAnimationFrame(() => {
			phase = newPhase;
			persistence.saveStep(stepMap[newPhase]);
			requestAnimationFrame(() => {
				animateIn = true;
				announce();
				onComplete?.();
			});
		});
	}

	// --- Actions ---

	function startAnimations() {
		requestAnimationFrame(() => {
			animateIn = true;
			announce();
		});
	}

	function discoverType(type: string) {
		discoveredTypes = new Set([...discoveredTypes, type]);
		const typesArray = [...discoveredTypes];
		persistence.savePhaseData('discoveredTypes', typesArray);
		announce();
	}

	function advanceToQuiz() {
		transitionTo('construction-quiz');
	}

	function recordQuizAnswer(correct: boolean) {
		quizTotal++;
		if (correct) {
			quizScore++;
			currentStreak++;
			if (currentStreak > bestStreak) {
				bestStreak = currentStreak;
			}
		} else {
			currentStreak = 0;
		}
		announce();
	}

	function passQuiz() {
		quizPassed = true;
		persistence.savePhaseData('quizPassed', true);
	}

	function advanceToSpeedRounds() {
		transitionTo('speed-rounds');
	}

	function complete() {
		transitionTo('complete');
	}

	function reset() {
		phase = 'discovery';
		discoveredTypes = new Set();
		quizScore = 0;
		quizTotal = 0;
		quizPassed = false;
		currentStreak = 0;
		bestStreak = 0;
		animateIn = false;
		announcement = '';
		persistence.reset();
	}

	return {
		// State (reactive getters)
		get phase() { return phase; },
		get discoveredTypes() { return discoveredTypes; },
		get allDiscovered() { return allDiscovered; },
		get quizScore() { return quizScore; },
		get quizTotal() { return quizTotal; },
		get quizPassed() { return quizPassed; },
		get currentStreak() { return currentStreak; },
		get bestStreak() { return bestStreak; },
		get animateIn() { return animateIn; },
		get announcement() { return announcement; },

		// Actions
		startAnimations,
		discoverType,
		advanceToQuiz,
		recordQuizAnswer,
		passQuiz,
		advanceToSpeedRounds,
		complete,
		reset,
		transitionTo
	};
}

export type PositionsExperienceStateManager = ReturnType<typeof createPositionsExperienceState>;
