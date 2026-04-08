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
		const sliceLower = sel.shape.sliceType.toLowerCase();
		const gridLower = sel.shape.gridMode.toLowerCase();
		result = result.filter(
			(d) =>
				lowerTypes.includes(d.loopType.toLowerCase()) &&
				d.sliceType.toLowerCase() === sliceLower &&
				d.gridMode.toLowerCase() === gridLower
		);
	}

	if (sel.category) {
		const familyLower = sel.category.vtgFamily.toLowerCase();
		const gridLower = sel.category.gridMode.toLowerCase();
		console.log('[filterDecks] VTG category filter:', { familyLower, gridLower, decksBefore: result.length });
		if (result.length > 0) {
			const sample = result[0];
			console.log('[filterDecks] sample deck:', { id: sample.id, gridMode: sample.gridMode, familyIds: sample.families.map(f => f.id) });
		}
		result = result.filter(
			(d) =>
				d.families.some((f) => f.id.toLowerCase().includes(familyLower)) &&
				d.gridMode.toLowerCase() === gridLower
		);
		console.log('[filterDecks] VTG after filter:', result.length);
		if (result.length > 0) {
			console.log('[filterDecks] VTG turnPatterns:', [...new Set(result.map(d => d.turnPattern))]);
			console.log('[filterDecks] VTG stepCounts:', [...new Set(result.map(d => d.stepCount))]);
		}
	}

	if (sel.stepCount !== null) {
		result = result.filter((d) => d.stepCount === sel.stepCount);
	}

	if (sel.turnPattern !== null) {
		const selTurn = sel.turnPattern.toLowerCase().replace(/\s+/g, '-');
		result = result.filter((d) => {
			const deckTurn = d.turnPattern.toLowerCase().replace(/\s+/g, '-');
			// Match exactly, or match "0t" against "uniform-0t"
			return deckTurn === selTurn || deckTurn === `uniform-${selTurn}`;
		});
	}

	if (sel.reversalPattern !== null) {
		const selRev = sel.reversalPattern.toLowerCase().replace(/\s+/g, '-');
		result = result.filter((d) => d.reversalPattern.toLowerCase().replace(/\s+/g, '-') === selRev);
	}

	return result;
}

function unique<T>(values: T[]): T[] {
	return [...new Set(values)];
}

// ── Session persistence for HMR survival ──
// Drill-down selections are ephemeral navigation state, but losing them on
// every HMR cycle is annoying. sessionStorage keeps them alive within a tab
// session without polluting localStorage across sessions.
const SESSION_KEY = 'deckDrillDown.state';

interface PersistedDrillState {
	selections: DrillSelections;
	breadcrumbs: BreadcrumbSegment[];
	currentStep: DrillStepId;
}

function saveToSession(data: PersistedDrillState): void {
	try {
		sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
	} catch { /* quota exceeded — ignore */ }
}

function loadFromSession(): PersistedDrillState | null {
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as PersistedDrillState;
	} catch {
		return null;
	}
}

export function createDrillDownState(allDecksOrGetter: Deck[] | (() => Deck[])) {
	// Accept either a static array or a getter function for reactive deck loading
	const getAllDecks = typeof allDecksOrGetter === 'function' ? allDecksOrGetter : () => allDecksOrGetter;

	const restored = typeof window !== 'undefined' ? loadFromSession() : null;

	let selections = $state<DrillSelections>(restored?.selections ?? emptySelections());
	let breadcrumbs = $state<BreadcrumbSegment[]>(restored?.breadcrumbs ?? []);
	let currentStep = $state<DrillStepId>(restored?.currentStep ?? 'collection');
	let direction = $state<'forward' | 'backward'>('forward');

	const filteredDecks = $derived(filterDecks(getAllDecks(), selections));

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

	// Persist drill-down state to sessionStorage so HMR doesn't reset navigation
	$effect(() => {
		saveToSession({ selections, breadcrumbs, currentStep });
	});

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

	function advanceTo(stepId: DrillStepId, previousLabel: string, currentLabel?: string) {
		breadcrumbs = [
			...breadcrumbs,
			{ label: previousLabel, stepId: currentStep },
			...(currentLabel ? [{ label: currentLabel, stepId: stepId }] : []),
		];
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
				advanceTo('shape', 'LOOPs', 'Shape');
			} else {
				advanceTo('category', 'VTG', 'Category');
			}
		},

		selectShape(shape: ShapeSelections) {
			selections = { ...selections, shape };
			resetSelectionsAfter('shape');

			// Recompute filtered decks after shape selection to check
			// if step count can be auto-resolved.
			const afterShape = filterDecks(getAllDecks(), { ...selections, shape });
			const counts = unique(afterShape.map((d) => d.stepCount));

			if (counts.length === 1 && counts[0] !== undefined) {
				// Only one step count available, auto-skip to turns.
				selections = { ...selections, shape, stepCount: counts[0] ?? null };
				advanceTo('turn', shape.loopTypes.join(' + '), 'Turn Pattern');
			} else {
				advanceTo('stepcount', shape.loopTypes.join(' + '), 'Step Count');
			}
		},

		selectCategory(category: CategorySelections) {
			// VTG skips step count — don't set it so the filter ignores it.
			selections = { ...selections, category, stepCount: null };
			resetSelectionsAfter('category');
			advanceTo('turn', category.vtgFamily, 'Turn Pattern');
		},

		selectStepCount(count: number) {
			selections = { ...selections, stepCount: count };
			resetSelectionsAfter('stepcount');
			advanceTo('turn', `${count}-step`, 'Turn Pattern');
		},

		selectTurnPattern(pattern: string) {
			selections = { ...selections, turnPattern: pattern };
			resetSelectionsAfter('turn');

			// Check if there's only one reversal pattern left.
			const afterTurn = filterDecks(getAllDecks(), {
				...selections,
				turnPattern: pattern,
			});
			const reversals = unique(afterTurn.map((d) => d.reversalPattern));

			if (reversals.length === 1 && reversals[0] !== undefined) {
				// Auto-select the sole reversal pattern.
				selections = {
					...selections,
					turnPattern: pattern,
					reversalPattern: reversals[0] ?? null,
				};
				advanceTo('reversal', pattern, 'Reversal Pattern');
			} else {
				advanceTo('reversal', pattern, 'Reversal Pattern');
			}
		},

		selectReversalPattern(pattern: string) {
			selections = { ...selections, reversalPattern: pattern };
		},

		goBackTo(index: number) {
			const target = breadcrumbs[index];
			if (!target) return;

			direction = 'backward';
			const stepId = target.stepId;
			currentStep = stepId;

			// Truncate breadcrumbs to the entries before the target.
			breadcrumbs = breadcrumbs.slice(0, index);

			// Going back to collection resets everything including path.
			if (stepId === 'collection') {
				selections = emptySelections();
			} else {
				resetSelectionsAfter(stepId);
			}
		},

		goTo(stepId: DrillStepId) {
			currentStep = stepId;
			direction = 'forward';
		},

		reset() {
			selections = emptySelections();
			breadcrumbs = [];
			currentStep = 'collection';
			direction = 'forward';
			try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
		},
	};
}

export type DrillDownState = ReturnType<typeof createDrillDownState>;
