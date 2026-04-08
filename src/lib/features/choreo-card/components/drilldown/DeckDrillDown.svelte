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
	const state = createDrillDownState(() => decks);
	setDrillDownContext(state);

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
		state.selections.path === 'VTG' ? '#b763cd' : '#63b7cd'
	);

	const accentRgb = $derived(
		state.selections.path === 'VTG' ? '183,99,205' : '99,183,205'
	);

	const glowClass = $derived(
		state.selections.path === 'VTG'
			? 'vtg'
			: state.selections.path === 'LOOPs'
				? 'loops'
				: ''
	);

	function handleDeckSelect(deck: Deck) {
		onSelectDeck(deck, state.selections.category?.vtgFamily ?? null);
	}
</script>

<div class="drilldown" class:desktop={isDesktop} style="--accent:{accentColor};--accent-rgb:{accentRgb}">
	<div class="ambient-glow {glowClass}"></div>

	{#if isDesktop}
		<div class="desktop-layout">
			<DeckFilterSidebar {state} allDecks={decks} />
			<DeckResultsPanel
				decks={state.filteredDecks}
				onSelectDeck={handleDeckSelect}
			/>
		</div>
	{:else}
		{#if state.breadcrumbs.length > 0}
			<DrillBreadcrumb
				breadcrumbs={state.breadcrumbs}
				accentColor={accentColor}
				onNavigate={state.goBackTo}
			/>
		{/if}

		{#key state.currentStep}
			<div class="step-content">
				{#if state.currentStep === 'collection'}
					<CollectionStep decks={decks} onSelectPath={state.selectPath} />
				{:else if state.currentStep === 'shape'}
					<ShapeStep decks={state.filteredDecks} onContinue={state.selectShape} />
				{:else if state.currentStep === 'category'}
					<CategoryStep onContinue={state.selectCategory} />
				{:else if state.currentStep === 'stepcount'}
					<StepCountStep
						availableCounts={state.availableStepCounts}
						onSelect={state.selectStepCount}
					/>
				{:else if state.currentStep === 'turn'}
					<TurnPatternStep
						stepCount={state.selections.stepCount ?? 4}
						path={state.selections.path ?? 'LOOPs'}
						availablePatterns={state.availableTurnPatterns}
						onSelectPattern={state.selectTurnPattern}
						onSelectUniform={() => state.goTo('uniform')}
					/>
				{:else if state.currentStep === 'uniform'}
					<UniformSubStep onSelect={state.selectTurnPattern} />
				{:else if state.currentStep === 'reversal'}
					<ReversalPatternStep
						decks={state.filteredDecks}
						breadcrumbs={state.breadcrumbs}
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
		padding: 24px 32px;
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
