<script lang="ts">
	import type { Deck } from '../../domain/models/Deck';
	import { createDrillDownState } from '../../state/deck-drilldown-state.svelte';
	import { setDrillDownContext } from '../../context/deck-drilldown-context';
	import DrillBreadcrumb from './DrillBreadcrumb.svelte';
	import CollectionStep from './CollectionStep.svelte';
	import ShapeStep from './ShapeStep.svelte';
	import CategoryStep from './CategoryStep.svelte';
	import StepCountStep from './StepCountStep.svelte';
	import TurnPatternStep from './TurnPatternStep.svelte';
	import UniformSubStep from './UniformSubStep.svelte';
	import ReversalPatternStep from './ReversalPatternStep.svelte';
	import DeckFilterSidebar from './sidebar/DeckFilterSidebar.svelte';
	import DeckResultsPanel from './DeckResultsPanel.svelte';
	import { BREAKPOINTS } from '$lib/shared/device/domain/constants/device-constants';

	interface Props {
		decks: Deck[];
		onSelectDeck: (deck: Deck, vtgFamily?: string | null) => void;
	}

	let { decks, onSelectDeck }: Props = $props();

	// Pass a getter so the state factory can react to async deck loading
	const drillState = createDrillDownState(() => decks);
	setDrillDownContext(drillState);

	let isDesktop = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia(`(min-width: ${BREAKPOINTS.DESKTOP}px)`);
		isDesktop = mq.matches;
		const handler = (e: MediaQueryListEvent) => { isDesktop = e.matches; };
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	const accentColor = $derived(
		drillState.selections.path === 'VTG' ? '#b763cd' : '#63b7cd'
	);

	const accentRgb = $derived(
		drillState.selections.path === 'VTG' ? '183,99,205' : '99,183,205'
	);

	const glowClass = $derived(
		drillState.selections.path === 'VTG'
			? 'vtg'
			: drillState.selections.path === 'LOOPs'
				? 'loops'
				: ''
	);

	function handleDeckSelect(deck: Deck) {
		onSelectDeck(deck, drillState.selections.category?.vtgFamily ?? null);
	}

	// On desktop, auto-open when filters narrow to exactly 1 deck.
	// Track which deck ID we already auto-opened to avoid re-triggering
	// when the user navigates back to change a filter.
	let autoOpenedDeckId = $state<string | null>(null);

	$effect(() => {
		if (!isDesktop) return;
		const single = drillState.selectedDeck;
		if (single && single.id !== autoOpenedDeckId) {
			autoOpenedDeckId = single.id;
			handleDeckSelect(single);
		}
		// Reset when filters change away from a single result
		if (!single) {
			autoOpenedDeckId = null;
		}
	});
</script>

<div class="drilldown" class:desktop={isDesktop} style="--accent:{accentColor};--accent-rgb:{accentRgb}">
	<div class="ambient-glow {glowClass}"></div>

	{#if isDesktop}
		<div class="desktop-layout">
			<DeckFilterSidebar state={drillState} allDecks={decks} />
			<DeckResultsPanel
				decks={drillState.filteredDecks}
				onSelectDeck={handleDeckSelect}
			/>
		</div>
	{:else}
		{#if drillState.breadcrumbs.length > 0}
			<DrillBreadcrumb
				breadcrumbs={drillState.breadcrumbs}
				accentColor={accentColor}
				onNavigate={drillState.goBackTo}
			/>
		{/if}

		{#key drillState.currentStep}
			<div class="step-content">
				{#if drillState.currentStep === 'collection'}
					<CollectionStep decks={decks} onSelectPath={drillState.selectPath} />
				{:else if drillState.currentStep === 'shape'}
					<ShapeStep decks={drillState.filteredDecks} onContinue={drillState.selectShape} />
				{:else if drillState.currentStep === 'category'}
					<CategoryStep onContinue={drillState.selectCategory} />
				{:else if drillState.currentStep === 'stepcount'}
					<StepCountStep
						availableCounts={drillState.availableStepCounts}
						onSelect={drillState.selectStepCount}
					/>
				{:else if drillState.currentStep === 'turn'}
					<TurnPatternStep
						stepCount={drillState.selections.stepCount ?? 4}
						path={drillState.selections.path ?? 'LOOPs'}
						availablePatterns={drillState.availableTurnPatterns}
						onSelectPattern={drillState.selectTurnPattern}
						onSelectUniform={() => drillState.goTo('uniform')}
					/>
				{:else if drillState.currentStep === 'uniform'}
					<UniformSubStep onSelect={drillState.selectTurnPattern} />
				{:else if drillState.currentStep === 'reversal'}
					<ReversalPatternStep
						decks={drillState.filteredDecks}
						breadcrumbs={drillState.breadcrumbs}
						onSelectDeck={handleDeckSelect}
					/>
				{/if}
			</div>
		{/key}
	{/if}
</div>

<style>
	.drilldown {
		position: relative;
		z-index: 1;
		max-width: 1100px;
		margin: 0 auto;
		padding: 40px 48px;
		min-height: 100%;
		display: flex;
		flex-direction: column;
	}

	.ambient-glow {
		position: fixed;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 800px;
		height: 400px;
		border-radius: 50%;
		filter: blur(120px);
		opacity: 0;
		transition: opacity 0.6s ease;
		pointer-events: none;
		z-index: 0;
	}

	.ambient-glow.loops {
		background: rgba(99, 183, 205, 0.06);
		opacity: 1;
	}

	.ambient-glow.vtg {
		background: rgba(183, 99, 205, 0.06);
		opacity: 1;
	}

	.step-content {
		animation: stepIn 250ms ease-out;
	}

	.desktop-layout {
		display: flex;
		gap: 24px;
		flex: 1;
		min-height: 0;
	}

	.drilldown.desktop {
		max-width: none;
		padding: 20px;
	}

	@keyframes stepIn {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.step-content {
			animation: none;
		}
		.ambient-glow {
			transition: none;
		}
	}
</style>
