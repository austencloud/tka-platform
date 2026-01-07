<!--
  GridStepHeader - Title and description for steps 0-2
  Renders conditional content based on current step and phase
-->
<script lang="ts">
	import type { GridPhase, PointTypePhase } from './grid-experience-state.svelte';

	let {
		step,
		gridPhase,
		pointTypePhase
	} = $props<{
		step: number;
		gridPhase: GridPhase;
		pointTypePhase: PointTypePhase;
	}>();
</script>

<!-- Title transitions based on step and phase -->
<h1 class="title anim-item" style="--anim-order: 0">
	{#if step === 0}
		The Grid
	{:else if step === 1}
		{#if gridPhase === 'split'}
			Two Grid Modes
		{:else if gridPhase === 'diamond-labels'}
			Diamond Mode
		{:else if gridPhase === 'box-labels'}
			Box Mode
		{:else}
			The 8-Point Grid
		{/if}
	{:else}
		{#if pointTypePhase === 'center'}
			The Center Point
		{:else if pointTypePhase === 'hand'}
			Hand Points
		{:else}
			Outer Points
		{/if}
	{/if}
</h1>

<!-- Description transitions based on step and phase -->
<p class="description anim-item" style="--anim-order: 1">
	{#if step === 0}
		The Kinetic Alphabet is based on a <strong>4-point grid</strong>.
	{:else if step === 1}
		{#if gridPhase === 'split'}
			There are two types of grids: <strong>Diamond</strong> and <strong>Box</strong>.
		{:else if gridPhase === 'diamond-labels'}
			<strong>Diamond</strong> points are labeled with cardinal directions.
		{:else if gridPhase === 'box-labels'}
			<strong>Box</strong> points are labeled with intercardinal directions.
		{:else}
			<strong>Diamond + Box</strong> together create the full 8-point grid.
		{/if}
	{:else}
		{#if pointTypePhase === 'center'}
			The <strong>center point</strong> is the hub of all movement.
		{:else if pointTypePhase === 'hand'}
			<strong>4 hand points</strong> are halfway between center and outer.
		{:else}
			<strong>4 outer points</strong> define the grid's boundary.
		{/if}
	{/if}
</p>

<!-- Secondary text - only for merged phase -->
<p class="description secondary" class:visible={step === 1 && gridPhase === 'merged'}>
	{#if step === 1 && gridPhase === 'merged'}
		We'll use this grid to learn hand positions.
	{:else}
		&nbsp;
	{/if}
</p>

<style>
	.title {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--theme-text);
		margin: 0 0 var(--spacing-lg, 1.5rem) 0;
		text-align: center;
		letter-spacing: -0.02em;
		flex-shrink: 0;
	}

	.description {
		font-size: 1.25rem;
		line-height: 1.6;
		color: var(--theme-text);
		margin: 0;
		text-align: center;
	}

	.description strong {
		color: var(--theme-text);
		font-weight: 700;
	}

	.description.secondary {
		font-size: 1.1rem;
		color: var(--theme-text-dim);
		font-style: italic;
		min-height: 1.8em;
		opacity: 0;
		transition: opacity 300ms ease-out;
	}

	.description.secondary.visible {
		opacity: 1;
	}

	/* Animation items - inherit from parent's animate-in */
	.anim-item {
		opacity: 0;
		transform: translateY(20px);
	}

	:global(.animate-in) .anim-item {
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

	/* Responsive */
	@media (max-width: 768px) {
		.title {
			font-size: 2rem;
		}

		.description {
			font-size: 1.1rem;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.anim-item {
			opacity: 1;
			transform: none;
		}

		:global(.animate-in) .anim-item {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
