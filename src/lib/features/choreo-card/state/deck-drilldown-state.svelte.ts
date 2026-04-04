import type { Deck } from '../domain/models/Deck';
import type {
	DrillPath,
	DrillStepId,
	DrillSelections,
	BreadcrumbSegment,
	ShapeSelections,
	CategorySelections,
} from './deck-drilldown-types';

function emptySelections(): DrillSelections {
	return {
		path: null,
		shape: null,
		category: null,
		stepCount: null,
		turnPattern: null,
		reversalPattern: null,
	};
}

// The ordered sequence of drill steps per path. Used to determine which
// selections to reset when the user navigates backward.
const LOOP_STEPS: DrillStepId[] = [
	'collection',
	'shape',
	'stepcount',
	'turn',
	'reversal',
];

const VTG_STEPS: DrillStepId[] = [
	'collection',
	'category',
	'turn',
	'reversal',
];

function stepsForPath(path: DrillPath): DrillStepId[] {
	return path === 'LOOPs' ? LOOP_STEPS : VTG_STEPS;
}

function filterDecks(allDecks: Deck[], sel: DrillSelections): Deck[] {
	let result = allDecks;

	if (sel.path) {
		result = result.filter((d) => d.collection === sel.path);
	}

	if (sel.shape) {
		const lowerTypes = sel.shape.loopTypes.map((t) => t.toLowerCase());
		result = result.filter(
			(d) =>
				lowerTypes.includes(d.loopType.toLowerCase()) &&
				d.sliceType === sel.shape!.sliceType &&
				d.gridMode === sel.shape!.gridMode
		);
	}

	if (sel.category) {
		const familyLower = sel.category.vtgFamily.toLowerCase();
		result = result.filter(
			(d) =>
				d.families.some((f) => f.id.toLowerCase().includes(familyLower)) &&
				d.gridMode === sel.category!.gridMode
		);
	}

	if (sel.stepCount !== null) {
		result = result.filter((d) => d.stepCount === sel.stepCount);
	}

	if (sel.turnPattern !== null) {
		result = result.filter((d) => d.turnPattern === sel.turnPattern);
	}

	if (sel.reversalPattern !== null) {
		result = result.filter((d) => d.reversalPattern === sel.reversalPattern);
	}

	return result;
}

function unique<T>(values: T[]): T[] {
	return [...new Set(values)];
}

export function createDrillDownState(allDecks: Deck[]) {
	let selections = $state<DrillSelections>(emptySelections());
	let breadcrumbs = $state<BreadcrumbSegment[]>([]);
	let currentStep = $state<DrillStepId>('collection');
	let direction = $state<'forward' | 'backward'>('forward');

	const filteredDecks = $derived(filterDecks(allDecks, selections));

	const selectedDeck = $derived(
		filteredDecks.length === 1 ? filteredDecks[0] : null
	);

	const availableStepCounts = $derived(
		unique(filteredDecks.map((d) => d.stepCount)).sort((a, b) => a - b)
	);

	const availableTurnPatterns = $derived(
		unique(filteredDecks.map((d) => d.turnPattern)).sort()
	);

	const availableReversalPatterns = $derived(
		unique(filteredDecks.map((d) => d.reversalPattern)).sort()
	);

	// Resets all selection fields that come after the given step in the
	// current path's step sequence. Leaves earlier selections intact.
	function resetSelectionsAfter(stepId: DrillStepId) {
		const path = selections.path;
		if (!path) {
			selections = emptySelections();
			return;
		}

		const steps = stepsForPath(path);
		const idx = steps.indexOf(stepId);
		if (idx === -1) return;

		const toReset = new Set(steps.slice(idx + 1));
		selections = {
			path: selections.path,
			shape: toReset.has('shape') ? null : selections.shape,
			category: toReset.has('category') ? null : selections.category,
			stepCount: toReset.has('stepcount') ? null : selections.stepCount,
			turnPattern: toReset.has('turn') ? null : selections.turnPattern,
			reversalPattern: toReset.has('reversal')
				? null
				: selections.reversalPattern,
		};
	}

	function advanceTo(stepId: DrillStepId, label: string) {
		breadcrumbs = [...breadcrumbs, { label, stepId: currentStep }];
		currentStep = stepId;
		direction = 'forward';
	}

	return {
		get selections() {
			return selections;
		},
		get breadcrumbs() {
			return breadcrumbs;
		},
		get currentStep() {
			return currentStep;
		},
		get direction() {
			return direction;
		},
		get filteredDecks() {
			return filteredDecks;
		},
		get selectedDeck() {
			return selectedDeck;
		},
		get availableStepCounts() {
			return availableStepCounts;
		},
		get availableTurnPatterns() {
			return availableTurnPatterns;
		},
		get availableReversalPatterns() {
			return availableReversalPatterns;
		},

		selectPath(path: DrillPath) {
			selections = { ...emptySelections(), path };
			breadcrumbs = [];
			direction = 'forward';

			if (path === 'LOOPs') {
				advanceTo('shape', 'LOOPs');
			} else {
				advanceTo('category', 'VTG');
			}
		},

		selectShape(shape: ShapeSelections) {
			selections = { ...selections, shape };
			resetSelectionsAfter('shape');

			// Recompute filtered decks after shape selection to check
			// if step count can be auto-resolved.
			const afterShape = filterDecks(allDecks, { ...selections, shape });
			const counts = unique(afterShape.map((d) => d.stepCount));

			if (counts.length === 1 && counts[0] !== undefined) {
				// Only one step count available, auto-skip to turns.
				selections = { ...selections, shape, stepCount: counts[0] };
				advanceTo('turn', shape.loopTypes.join(' + '));
			} else {
				advanceTo('stepcount', shape.loopTypes.join(' + '));
			}
		},

		selectCategory(category: CategorySelections) {
			// VTG decks are always 4 steps.
			selections = { ...selections, category, stepCount: 4 };
			resetSelectionsAfter('category');
			advanceTo('turn', category.vtgFamily);
		},

		selectStepCount(count: number) {
			selections = { ...selections, stepCount: count };
			resetSelectionsAfter('stepcount');
			advanceTo('turn', `${count}-step`);
		},

		selectTurnPattern(pattern: string) {
			selections = { ...selections, turnPattern: pattern };
			resetSelectionsAfter('turn');

			// Check if there's only one reversal pattern left.
			const afterTurn = filterDecks(allDecks, {
				...selections,
				turnPattern: pattern,
			});
			const reversals = unique(afterTurn.map((d) => d.reversalPattern));

			if (reversals.length === 1 && reversals[0] !== undefined) {
				// Auto-select the sole reversal pattern.
				selections = {
					...selections,
					turnPattern: pattern,
					reversalPattern: reversals[0],
				};
				advanceTo('reversal', pattern);
			} else {
				advanceTo('reversal', pattern);
			}
		},

		selectReversalPattern(pattern: string) {
			selections = { ...selections, reversalPattern: pattern };
		},

		goBackTo(index: number) {
			const target = breadcrumbs[index];
			if (!target) return;

			direction = 'backward';
			currentStep = target.stepId;

			// Truncate breadcrumbs to the entries before the target.
			breadcrumbs = breadcrumbs.slice(0, index);

			// Reset selections for everything after the target step.
			resetSelectionsAfter(target.stepId);
		},

		reset() {
			selections = emptySelections();
			breadcrumbs = [];
			currentStep = 'collection';
			direction = 'forward';
		},
	};
}

export type DrillDownState = ReturnType<typeof createDrillDownState>;
