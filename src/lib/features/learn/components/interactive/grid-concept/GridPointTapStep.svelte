<!--
  GridPointTapStep - Interactive grid building through point tapping
  User taps center → hand points → diamond outer → box outer to build the full grid
-->
<script lang="ts">
	import { GRID, CARDINAL_HAND, CARDINAL_OUTER, INTERCARDINAL_OUTER } from '../grid-merge/grid-merge-constants';
	import { container } from '$lib/shared/di';
	import type { TapPhase } from './grid-experience-state.svelte';

	let {
		tapPhase,
		tappedPoints,
		onTapPoint,
	} = $props<{
		tapPhase: TapPhase;
		tappedPoints: string[];
		onTapPoint: (pointId: string) => TapPhase | null;
	}>();

	const hapticService = container.items.hapticFeedback;

	const DIRECTION_NAMES: Record<string, string> = {
		hn: 'North', he: 'East', hs: 'South', hw: 'West',
		n: 'North', e: 'East', s: 'South', w: 'West',
		ne: 'Northeast', se: 'Southeast', sw: 'Southwest', nw: 'Northwest',
	};

	// All 13 points: 1 center + 4 hand + 4 diamond outer + 4 box outer
	const ALL_POINTS = [
		{ id: 'center', x: GRID.CENTER, y: GRID.CENTER, group: 'center' as const, label: 'Center', ariaLabel: 'Center point' },
		...CARDINAL_HAND.map(p => ({
			id: p.id, x: p.x, y: p.y, group: 'hand' as const,
			label: p.id.slice(1).toUpperCase(),
			ariaLabel: `${DIRECTION_NAMES[p.id]} hand point`,
		})),
		...CARDINAL_OUTER.map(p => ({
			id: p.id, x: p.x, y: p.y, group: 'outer' as const,
			label: p.id.toUpperCase(),
			ariaLabel: `${DIRECTION_NAMES[p.id]} outer point`,
		})),
		...INTERCARDINAL_OUTER.map(p => ({
			id: p.id, x: p.x, y: p.y, group: 'box' as const,
			label: p.id.toUpperCase(),
			ariaLabel: `${DIRECTION_NAMES[p.id]} outer point`,
		})),
	];

	let recentlyTapped = $state<string | null>(null);

	const instruction = $derived(
		tapPhase === 'center' ? 'Tap the center point' :
		tapPhase === 'hand' ? 'Tap each hand point' :
		tapPhase === 'outer' ? 'Now the diamond points' :
		tapPhase === 'box' ? 'Now the box points' :
		'Grid complete!'
	);

	function getPointState(point: typeof ALL_POINTS[0]): 'hidden' | 'pulsing' | 'filled' {
		if (tappedPoints.includes(point.id)) return 'filled';
		if (point.group === tapPhase) return 'pulsing';
		return 'hidden';
	}

	function handleTap(pointId: string) {
		const newPhase = onTapPoint(pointId);
		if (newPhase === null) return;

		hapticService?.trigger('selection');
		recentlyTapped = pointId;
		setTimeout(() => {
			if (recentlyTapped === pointId) recentlyTapped = null;
		}, 800);

		if (newPhase === 'complete') {
			hapticService?.trigger('success');
		}
	}

	function handleKeydown(event: KeyboardEvent, pointId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleTap(pointId);
		}
	}

	// Touch target: scale to ~84 SVG units so at 500px render width (scale 0.526),
	// the actual pixel size is ~44px (WCAG AAA minimum)
	const TAP_RADIUS = 84;

	const VISUAL_RADIUS: Record<'center' | 'hand' | 'outer' | 'box', number> = {
		center: GRID.CENTER_POINT_RADIUS,
		hand: GRID.HAND_POINT_RADIUS,
		outer: GRID.POINT_RADIUS,
		box: GRID.POINT_RADIUS,
	};
</script>

<div class="tap-step">
	<h2 class="tap-title anim-item" style="--anim-order: 0">Build the Grid</h2>
	<p class="tap-instruction anim-item" style="--anim-order: 1">{instruction}</p>

	<div class="tap-grid-container anim-item" style="--anim-order: 2">
		<svg viewBox="0 0 {GRID.SIZE} {GRID.SIZE}" class="tap-svg">
			<!-- Render visual points first (bottom layer) -->
			{#each ALL_POINTS as point (point.id)}
				{@const state = getPointState(point)}
				{@const visualR = VISUAL_RADIUS[point.group]}
				{@const isBox = point.group === 'box'}
				<circle
					cx={point.x}
					cy={point.y}
					r={visualR}
					class="tap-point"
					class:hidden={state === 'hidden'}
					class:pulsing={state === 'pulsing'}
					class:filled={state === 'filled'}
					class:pop={recentlyTapped === point.id}
					class:ring={isBox}
				/>
			{/each}

			<!-- Render floating labels (middle layer) -->
			{#each ALL_POINTS as point (point.id)}
				{@const visualR = VISUAL_RADIUS[point.group]}
				{#if recentlyTapped === point.id}
					<text
						x={point.x}
						y={point.y - visualR - 20}
						class="tap-label"
						text-anchor="middle"
						dominant-baseline="auto"
					>
						{point.label}
					</text>
				{/if}
			{/each}

			<!-- Render tap targets on top (highest layer, catches all clicks) -->
			{#each ALL_POINTS as point (point.id)}
				{@const state = getPointState(point)}
				{#if state === 'pulsing'}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<circle
						cx={point.x}
						cy={point.y}
						r={TAP_RADIUS}
						class="tap-target"
						role="button"
						tabindex="0"
						aria-label={point.ariaLabel}
						onclick={() => handleTap(point.id)}
						onkeydown={(e) => handleKeydown(e, point.id)}
					/>
				{/if}
			{/each}

			<!-- Completion glow -->
			{#if tapPhase === 'complete'}
				<circle
					cx={GRID.CENTER}
					cy={GRID.CENTER}
					r={GRID.OUTER_RADIUS + 40}
					class="completion-glow"
				/>
			{/if}
		</svg>
	</div>
</div>

<style>
	.tap-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md, 1rem);
		width: 100%;
		max-width: 700px;
		flex: 1;
		justify-content: center;
	}

	.tap-title {
		font-size: 2rem;
		font-weight: 800;
		color: var(--theme-text);
		margin: 0;
		text-align: center;
		letter-spacing: -0.02em;
	}

	.tap-instruction {
		font-size: 1.125rem;
		color: var(--theme-text);
		margin: 0;
		text-align: center;
		min-height: 1.8em;
	}

	.tap-grid-container {
		width: 100%;
		max-width: 500px;
		display: flex;
		justify-content: center;
	}

	.tap-svg {
		width: 100%;
		height: auto;
	}

	/* Tap target: transparent overlay, large hit area, always on top */
	.tap-target {
		fill: transparent;
		cursor: pointer;
		outline: none;
	}

	/* Hover feedback: show a subtle ring around the point */
	.tap-target:hover {
		fill: color-mix(in srgb, var(--theme-accent, #22d3ee) 15%, transparent);
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 2;
		stroke-opacity: 0.5;
	}

	.tap-target:focus-visible {
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 3;
		stroke-dasharray: 6 3;
	}

	/* Point visual states */
	.tap-point {
		transition: opacity 0.3s ease;
		fill: var(--theme-accent, #22d3ee);
		pointer-events: none;
	}

	.tap-point.hidden {
		opacity: 0;
	}

	.tap-point.pulsing {
		opacity: 0.5;
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 2;
		fill: transparent;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.tap-point.filled {
		opacity: 1;
	}

	/* Box points render as hollow rings (stroke only, no fill) */
	.tap-point.ring {
		fill: transparent;
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 6;
	}

	.tap-point.ring.pulsing {
		fill: transparent;
		stroke-opacity: 0.5;
	}

	.tap-point.ring.filled {
		fill: transparent;
		stroke-opacity: 1;
	}

	.tap-point.pop {
		animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}

	/* Floating label */
	.tap-label {
		font-size: 28px;
		font-weight: 700;
		fill: var(--theme-text, #fff);
		font-family: system-ui, -apple-system, sans-serif;
		animation: labelFloat 0.8s ease-out forwards;
		pointer-events: none;
	}

	/* Completion glow */
	.completion-glow {
		fill: none;
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 2;
		opacity: 0;
		animation: glowPulse 0.5s ease-out forwards;
		pointer-events: none;
	}

	/* Animations */
	@keyframes pulse {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 0.8; }
	}

	@keyframes popIn {
		0% { transform: scale(0); opacity: 0; }
		70% { transform: scale(1.2); opacity: 1; }
		100% { transform: scale(1); opacity: 1; }
	}

	@keyframes labelFloat {
		0% { opacity: 0; transform: translateY(5px); }
		20% { opacity: 1; transform: translateY(0); }
		80% { opacity: 1; }
		100% { opacity: 0; }
	}

	@keyframes glowPulse {
		0% { opacity: 0; transform: scale(0.8); }
		50% { opacity: 0.6; }
		100% { opacity: 0; transform: scale(1.1); }
	}

	/* Animation entry items */
	.anim-item {
		opacity: 0;
		transform: translateY(20px);
	}

	:global(.animate-in) .anim-item {
		animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: calc(var(--anim-order, 0) * 120ms);
	}

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(16px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Responsive */
	@media (max-width: 768px) {
		.tap-title { font-size: 1.75rem; }
		.tap-instruction { font-size: 1rem; }
	}

	@media (max-height: 1000px) {
		.tap-step { gap: var(--spacing-sm, 0.5rem); }
		.tap-title { font-size: 1.5rem; }
		.tap-grid-container { max-width: 400px; }
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.tap-point.pulsing { animation: none; opacity: 0.6; }
		.tap-point.pop { animation: none; opacity: 1; }
		.tap-label { animation: none; opacity: 1; }
		.completion-glow { animation: none; opacity: 0.4; }
		.anim-item { opacity: 1; transform: none; }
		:global(.animate-in) .anim-item { animation: none; opacity: 1; transform: none; }
	}
</style>
