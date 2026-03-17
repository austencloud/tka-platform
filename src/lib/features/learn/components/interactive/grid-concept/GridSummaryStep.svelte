<!--
  GridSummaryStep - Step 3: Lesson completion summary
  Shows what was learned and a completion button
-->
<script lang="ts">
	import ExperienceProgressIndicator from '../ExperienceProgressIndicator.svelte';

	let {
		onComplete,
		animateIn = false,
		totalSteps = 4,
		currentStep = 4
	} = $props<{
		onComplete: () => void;
		animateIn?: boolean;
		totalSteps?: number;
		currentStep?: number;
	}>();

	// Expose button ref for focus management
	let completeButtonRef = $state<HTMLButtonElement | null>(null);

	export function focusCompleteButton() {
		completeButtonRef?.focus();
	}
</script>

<div class="step-content step-summary" class:animate-in={animateIn}>
	<h1 class="title anim-item" style="--anim-order: 0">You've Got the Grid!</h1>

	<div class="completion-section anim-item" style="--anim-order: 1">
		<p class="next-up-text">
			Next up: <strong>Hand Positions</strong>
		</p>
		<button class="complete-button" onclick={onComplete} bind:this={completeButtonRef}>
			<i class="fa-solid fa-check" aria-hidden="true"></i>
			Complete Lesson
		</button>
		<ExperienceProgressIndicator {currentStep} {totalSteps} />
	</div>
</div>

<style>
	.step-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-xl, 2rem);
		width: 100%;
		flex: 1;
	}

	.step-summary {
		max-width: 700px;
		width: 100%;
		justify-content: center;
		text-align: center;
	}

	/* Animation items - start invisible */
	.anim-item {
		opacity: 0;
		transform: translateY(20px);
	}

	/* When animate-in class is on parent, animate children */
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

	.title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--theme-text);
		margin: 0 0 var(--spacing-lg, 1.5rem) 0;
		text-align: center;
		letter-spacing: -0.02em;
	}

	.completion-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md, 1rem);
		margin-top: var(--spacing-lg, 1.5rem);
	}

	.next-up-text {
		font-size: 1rem;
		color: var(--theme-text-dim);
		margin: 0;
	}

	.next-up-text strong {
		color: var(--theme-accent, #22d3ee);
	}

	.complete-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem 2.5rem;
		background: linear-gradient(
			135deg,
			var(--semantic-success, #22c55e) 0%,
			color-mix(in srgb, var(--semantic-success, #22c55e) 80%, #000) 100%
		);
		border: none;
		border-radius: 12px;
		color: white;
		font-size: 1.125rem;
		font-weight: 700;
		cursor: pointer;
		transition: all var(--duration-normal) ease;
	}

	.complete-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
	}

	.complete-button:active {
		transform: scale(0.98);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.title {
			font-size: 2rem;
		}

		.complete-button {
			padding: 0.875rem 2rem;
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

		.complete-button {
			transition: none;
		}
	}
</style>
