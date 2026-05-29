<!--
GridConceptExperience - Orchestrator for the Grid learning experience
Coordinates state, navigation, and accessibility across sub-components.

Supports two view modes:
- "step": Traditional step-by-step navigation
- "scroll": All pages displayed vertically for review
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
import { onMount } from 'svelte';
	import GridMergeAnimation from './grid-merge/GridMergeAnimation.svelte';
	import ExperienceProgressIndicator from './ExperienceProgressIndicator.svelte';
	import GridScrollView from './grid-concept/GridScrollView.svelte';
	import GridSummaryStep from './grid-concept/GridSummaryStep.svelte';
	import GridStepHeader from './grid-concept/GridStepHeader.svelte';
	import { createGridExperienceState } from './grid-concept/grid-experience-state.svelte';
	import GridPointTapStep from './grid-concept/GridPointTapStep.svelte';
	import type { ExperienceViewMode } from '../../domain/types';

	let {
		onComplete,
		onBack,
		viewMode = 'step'
	} = $props<{
		onComplete?: () => void;
		onBack?: () => void;
		viewMode?: ExperienceViewMode;
	}>();

	const hapticService = getHapticFeedback();
	const experienceState = $derived.by(() => createGridExperienceState(viewMode === 'scroll'));

	// Accessibility: refs for focus management
	let nextButtonRef = $state<HTMLButtonElement | null>(null);
	let summaryStepRef = $state<GridSummaryStep | null>(null);
	let containerRef = $state<HTMLDivElement | null>(null);

	// Set scroll mode if needed
	$effect(() => {
		if (viewMode === 'scroll') {
			experienceState.setScrollMode();
		}
	});

	onMount(() => {
		experienceState.startAnimations();
	});

	function focusNextAction() {
		requestAnimationFrame(() => {
			if (experienceState.step === 4 && summaryStepRef) {
				summaryStepRef.focusCompleteButton();
			} else if (nextButtonRef) {
				nextButtonRef.focus();
			}
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (viewMode !== 'step') return;

		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			if (experienceState.step === 3) return; // Tap step advances via tapping
			event.preventDefault();
			handleNext();
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			handleBack();
		}
	}

	function handleNext() {
		hapticService?.trigger('selection');

		// Check if phase handles it internally
		if (experienceState.handleNextPhase()) return;

		// Otherwise advance to next step
		experienceState.nextStep(focusNextAction);
	}

	function handleBack() {
		hapticService?.trigger('selection');

		// Check if phase handles it internally
		if (experienceState.handleBackPhase()) return;

		// Otherwise go to previous step
		if (experienceState.step > 0) {
			experienceState.prevStep(focusNextAction);
		} else {
			onBack?.();
		}
	}

	function handleSkipToSummary() {
		hapticService?.trigger('selection');
		experienceState.skipToSummary(focusNextAction);
	}

	function handleComplete() {
		// Just haptic feedback - the visual delight comes from
		// progress updates and card state changes, not confetti
		hapticService?.trigger('success');
		experienceState.reset();
		onComplete?.();
	}

	// Expose handleBack for parent to call
	export { handleBack };
</script>

{#if viewMode === 'scroll'}
	<GridScrollView />
{:else}
	<!-- STEP MODE -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="grid-experience"
		class:animate-in={experienceState.animateIn}
		bind:this={containerRef}
		onkeydown={handleKeydown}
		tabindex="0"
		role="application"
		aria-label="Grid lesson, use arrow keys to navigate"
	>
		<!-- Accessibility: Live region for announcements -->
		<div class="sr-only" aria-live="polite" aria-atomic="true">
			{experienceState.announcement}
		</div>

		<!-- Accessibility: Skip link -->
		{#if experienceState.step < 4}
			<button class="skip-link" onclick={handleSkipToSummary}>Skip to summary</button>
		{/if}

		{#if experienceState.step <= 2}
			<!-- Steps 0, 1 & 2: Grid content -->
			<div class="step-content step-grid-content">
				<GridStepHeader
					step={experienceState.step}
					gridPhase={experienceState.gridPhase}
					pointTypePhase={experienceState.pointTypePhase}
				/>

				<div class="merge-animation-container">
					<GridMergeAnimation
						phase={experienceState.effectivePhase}
						highlightPhase={experienceState.effectiveHighlightPhase}
					/>
				</div>

				<div
					class="navigation-area anim-item"
					style="--anim-order: {experienceState.step === 0 ? 3 : experienceState.step === 1 ? 4 : 2}"
				>
					<button class="next-button" onclick={handleNext} bind:this={nextButtonRef}>Next</button>
					<ExperienceProgressIndicator currentStep={experienceState.step + 1} totalSteps={experienceState.totalSteps} />
				</div>
			</div>
		{:else if experienceState.step === 3}
			<!-- Step 3: Point tap interaction -->
			<div class="step-content step-grid-content">
				<GridPointTapStep
					tapPhase={experienceState.tapPhase}
					tappedPoints={experienceState.tappedPoints}
					onTapPoint={(id) => experienceState.tapPoint(id, () => experienceState.nextStep(focusNextAction))}
				/>
				<ExperienceProgressIndicator currentStep={experienceState.step + 1} totalSteps={experienceState.totalSteps} />
			</div>
		{:else if experienceState.step === 4}
			<GridSummaryStep
				animateIn={experienceState.animateIn}
				totalSteps={experienceState.totalSteps}
				currentStep={experienceState.step + 1}
				onComplete={handleComplete}
				bind:this={summaryStepRef}
			/>
		{/if}
	</div>
{/if}

<style>
	.grid-experience {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		height: 100%;
		padding: var(--spacing-xl, 2rem);
		padding-top: var(--spacing-2xl, 3rem);
		overflow-y: auto;
		overflow-x: hidden;
		outline: none;
	}

	/* Screen reader only */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Skip link - visible on focus */
	.skip-link {
		position: absolute;
		top: -100px;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.75rem 1.5rem;
		background: var(--theme-accent, #22d3ee);
		color: var(--theme-on-accent, #000);
		font-weight: 600;
		font-size: 0.875rem;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		z-index: var(--z-modal);
		transition: top var(--duration-normal) ease;
	}

	.skip-link:focus {
		top: 1rem;
		outline: 2px solid white;
		outline-offset: 2px;
	}

	/* Animation system */
	.anim-item {
		opacity: 0;
		transform: translateY(20px);
	}

	.animate-in .anim-item {
		animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: calc(var(--anim-order, 0) * 120ms);
	}

	@keyframes fadeSlideUp {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Layout */
	.step-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-xl, 2rem);
		width: 100%;
		flex: 1;
	}

	.step-grid-content {
		max-width: 900px;
		width: 100%;
		justify-content: center;
	}

	.merge-animation-container {
		width: 100%;
		max-width: 700px;
	}

	.navigation-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.next-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem 3rem;
		background: color-mix(in srgb, var(--theme-accent) 40%, transparent);
		border: 2px solid color-mix(in srgb, var(--theme-accent) 60%, transparent);
		border-radius: 12px;
		color: white;
		font-size: 1.125rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		min-width: 160px;
	}

	.next-button:hover {
		background: color-mix(in srgb, var(--theme-accent) 50%, transparent);
		border-color: color-mix(in srgb, var(--theme-accent) 80%, transparent);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--theme-accent) 30%, transparent);
	}

	.next-button:active {
		transform: scale(0.98);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.grid-experience {
			padding: var(--spacing-lg, 1.5rem);
			padding-top: var(--spacing-xl, 2rem);
		}

		.next-button {
			padding: 0.875rem 2.5rem;
			font-size: 1rem;
		}

		.merge-animation-container {
			max-width: 100%;
		}
	}

	/* Height-constrained viewports (e.g. Z Fold unfolded portrait: wide but short) */
	@media (max-height: 1000px) {
		.grid-experience {
			padding: var(--spacing-sm, 0.5rem);
			padding-top: var(--spacing-md, 1rem);
		}

		.step-content {
			gap: var(--spacing-sm, 0.5rem);
		}

		.merge-animation-container {
			max-height: 55dvh;
			display: flex;
			justify-content: center;
		}

		.merge-animation-container :global(svg) {
			max-height: 100%;
			width: auto;
		}

		.next-button {
			padding: 0.75rem 2rem;
			font-size: 1rem;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.anim-item {
			opacity: 1;
			transform: none;
		}

		.animate-in .anim-item {
			animation: none;
			opacity: 1;
			transform: none;
		}

		.next-button {
			transition: none;
		}
	}
</style>
