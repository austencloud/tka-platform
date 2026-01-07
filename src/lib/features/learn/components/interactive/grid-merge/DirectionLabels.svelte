<!--
  DirectionLabels - Cardinal (N/E/S/W) and Intercardinal (NE/SE/SW/NW) labels
  - Cardinal labels: Visible in diamond-labels and merged phases
  - Intercardinal labels: Visible in box-labels and merged phases
  - Hidden during highlighting phases
-->
<script lang="ts">
	import {
		CARDINAL_LABELS,
		INTERCARDINAL_LABELS,
		type Phase,
		type HighlightPhase
	} from './grid-merge-constants';

	let { phase, highlightPhase = 'none' } = $props<{
		phase: Phase;
		highlightPhase?: HighlightPhase;
	}>();

	const showCardinal = $derived(
		phase === 'diamond-labels' || phase === 'box-labels' || phase === 'merged'
	);
	const showIntercardinal = $derived(phase === 'box-labels' || phase === 'merged');
	const isSplitCardinal = $derived(phase === 'diamond-labels' || phase === 'box-labels');
	const isSplitIntercardinal = $derived(phase === 'box-labels');
	const isHighlighting = $derived(highlightPhase !== 'none');
</script>

<g class="direction-labels" class:highlighting={isHighlighting} aria-label="Grid direction labels: North, East, South, West, Northeast, Southeast, Southwest, Northwest">
	<!-- Cardinal labels (N, E, S, W) -->
	{#each CARDINAL_LABELS as label, i}
		<text
			class="label cardinal-label"
			class:visible={showCardinal}
			class:split={isSplitCardinal}
			class:animate-in={phase === 'diamond-labels'}
			x={label.x}
			y={label.y}
			text-anchor="middle"
			dominant-baseline="middle"
			data-index={i}
		>
			{label.id}
		</text>
	{/each}

	<!-- Intercardinal labels (NE, SE, SW, NW) -->
	{#each INTERCARDINAL_LABELS as label, i}
		<text
			class="label intercardinal-label"
			class:visible={showIntercardinal}
			class:split={isSplitIntercardinal}
			class:animate-in={phase === 'box-labels'}
			x={label.x}
			y={label.y}
			text-anchor="middle"
			dominant-baseline="middle"
			data-index={i}
		>
			{label.id}
		</text>
	{/each}
</g>

<style>
	.label {
		font-size: 46px;
		font-weight: 700;
		fill: #9ca3af;
		font-family: system-ui, -apple-system, sans-serif;
		opacity: 0;
		transform: scale(0);
		transform-origin: center;
		transition:
			opacity var(--label-duration) ease-out,
			transform var(--label-duration) var(--merge-easing);
	}

	/* Visible state */
	.label.visible {
		opacity: 1;
		transform: scale(1);
	}

	/* Split positioning - cardinal on left/top */
	.cardinal-label.split {
		transform: translate(var(--split-offset-x-neg), var(--split-offset-y-neg)) scale(0.5);
		font-size: 60px;
	}

	.cardinal-label.split.visible {
		opacity: 1;
	}

	/* Split positioning - intercardinal on right/bottom */
	.intercardinal-label.split {
		transform: translate(var(--split-offset-x), var(--split-offset-y)) scale(0.5);
		font-size: 60px;
	}

	.intercardinal-label.split.visible {
		opacity: 1;
	}

	/* Animate-in with stagger for cardinal labels */
	.cardinal-label.animate-in {
		animation: labelPopIn var(--label-duration) var(--merge-easing) both;
	}
	.cardinal-label.animate-in[data-index='0'] {
		animation-delay: 0.1s;
	}
	.cardinal-label.animate-in[data-index='1'] {
		animation-delay: 0.2s;
	}
	.cardinal-label.animate-in[data-index='2'] {
		animation-delay: 0.3s;
	}
	.cardinal-label.animate-in[data-index='3'] {
		animation-delay: 0.4s;
	}

	/* Animate-in with stagger for intercardinal labels */
	.intercardinal-label.animate-in {
		animation: labelPopInBox var(--label-duration) var(--merge-easing) both;
	}
	.intercardinal-label.animate-in[data-index='0'] {
		animation-delay: 0.1s;
	}
	.intercardinal-label.animate-in[data-index='1'] {
		animation-delay: 0.2s;
	}
	.intercardinal-label.animate-in[data-index='2'] {
		animation-delay: 0.3s;
	}
	.intercardinal-label.animate-in[data-index='3'] {
		animation-delay: 0.4s;
	}

	/* Hide labels during highlighting */
	.highlighting .label {
		opacity: 0;
	}

	/* === KEYFRAMES === */
	@keyframes labelPopIn {
		0% {
			opacity: 0;
			transform: translate(var(--split-offset-x-neg), var(--split-offset-y-neg)) scale(0.2);
		}
		100% {
			opacity: 1;
			transform: translate(var(--split-offset-x-neg), var(--split-offset-y-neg)) scale(0.5);
		}
	}

	@keyframes labelPopInBox {
		0% {
			opacity: 0;
			transform: translate(var(--split-offset-x), var(--split-offset-y)) scale(0.2);
		}
		100% {
			opacity: 1;
			transform: translate(var(--split-offset-x), var(--split-offset-y)) scale(0.5);
		}
	}

	/* === RESPONSIVE === */
	@media (max-width: 700px) {
		.label {
			font-size: 38px;
		}

		.cardinal-label.split,
		.intercardinal-label.split {
			font-size: 70px;
		}
	}

	@media (max-width: 500px) {
		.label {
			font-size: 32px;
		}
	}

	/* === REDUCED MOTION === */
	@media (prefers-reduced-motion: reduce) {
		.label {
			transition: none;
			animation: none;
		}

		.label.visible {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
