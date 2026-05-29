<!--
  GridPointTapStep - Interactive grid building through point tapping
  User taps center → diamond hand → diamond outer → box hand → box outer
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { GRID, CARDINAL_HAND, CARDINAL_OUTER, INTERCARDINAL_HAND, INTERCARDINAL_OUTER } from '../grid-merge/grid-merge-constants';
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

	const hapticService = getHapticFeedback();

	const DIRECTION_NAMES: Record<string, string> = {
		hn: 'North', he: 'East', hs: 'South', hw: 'West',
		hne: 'Northeast', hse: 'Southeast', hsw: 'Southwest', hnw: 'Northwest',
		n: 'North', e: 'East', s: 'South', w: 'West',
		ne: 'Northeast', se: 'Southeast', sw: 'Southwest', nw: 'Northwest',
	};

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
		...INTERCARDINAL_HAND.map(p => ({
			id: p.id, x: p.x, y: p.y, group: 'boxHand' as const,
			label: p.id.slice(1).toUpperCase(),
			ariaLabel: `${DIRECTION_NAMES[p.id]} hand point`,
		})),
		...INTERCARDINAL_OUTER.map(p => ({
			id: p.id, x: p.x, y: p.y, group: 'box' as const,
			label: p.id.toUpperCase(),
			ariaLabel: `${DIRECTION_NAMES[p.id]} outer point`,
		})),
	];

	let recentlyTapped = $state<string | null>(null);

	const currentPhase = $derived(tapPhase);
	const currentTapped = $derived(tappedPoints);

	const instruction = $derived(
		currentPhase === 'center' ? 'Tap the center point' :
		currentPhase === 'hand' ? 'Tap each diamond hand point' :
		currentPhase === 'outer' ? 'Now the diamond outer points' :
		currentPhase === 'boxHand' ? 'Now the box hand points' :
		currentPhase === 'box' ? 'Now the box outer points' :
		'Grid complete!'
	);

	function getPointState(point: typeof ALL_POINTS[0]): 'hidden' | 'pulsing' | 'filled' {
		if (currentTapped.includes(point.id)) return 'filled';
		if (point.group === currentPhase) return 'pulsing';
		return 'hidden';
	}

	function handleTap(pointId: string) {
		const newPhase = onTapPoint(pointId);
		if (newPhase === null) return;

		hapticService?.trigger('selection');
		recentlyTapped = pointId;
		setTimeout(() => {
			if (recentlyTapped === pointId) recentlyTapped = null;
		}, 1000);

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

	const TAP_RADIUS = 84;

	const VISUAL_RADIUS: Record<'center' | 'hand' | 'outer' | 'boxHand' | 'box', number> = {
		center: GRID.CENTER_POINT_RADIUS,
		hand: GRID.HAND_POINT_RADIUS,
		outer: GRID.POINT_RADIUS,
		boxHand: GRID.HAND_POINT_RADIUS,
		box: GRID.POINT_RADIUS,
	};
</script>

<div class="tap-step">
	<h2 class="tap-title anim-item" style="--anim-order: 0">Build the Grid</h2>
	<p class="tap-instruction anim-item" style="--anim-order: 1" aria-live="polite">{instruction}</p>

	<div class="tap-grid-container anim-item" style="--anim-order: 2">
		<svg viewBox="0 0 {GRID.SIZE} {GRID.SIZE}" class="tap-svg">
			<!-- SVG defs for reusable effects -->
			<defs>
				<filter id="point-glow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			<!-- Visual points (bottom layer) -->
			{#each ALL_POINTS as point (point.id)}
				{@const state = getPointState(point)}
				{@const visualR = VISUAL_RADIUS[point.group]}
				{@const isBox = point.group === 'box' || point.group === 'boxHand'}
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

			<!-- Floating labels (middle layer) -->
			{#each ALL_POINTS as point (point.id)}
				{@const visualR = VISUAL_RADIUS[point.group]}
				{#if recentlyTapped === point.id}
					<text
						x={point.x}
						y={point.y - visualR - 24}
						class="tap-label"
						text-anchor="middle"
						dominant-baseline="auto"
					>
						{point.label}
					</text>
				{/if}
			{/each}

			<!-- Tap targets (top layer) -->
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

			<!-- Completion: expanding rings -->
			{#if currentPhase === 'complete'}
				<circle cx={GRID.CENTER} cy={GRID.CENTER} r={GRID.OUTER_RADIUS} class="completion-ring ring-1" />
				<circle cx={GRID.CENTER} cy={GRID.CENTER} r={GRID.OUTER_RADIUS} class="completion-ring ring-2" />
			{/if}
		</svg>
	</div>
</div>

<style>
	.tap-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-lg, 1.5rem);
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
		color: var(--theme-text-dim, #9ca3af);
		margin: 0;
		text-align: center;
		min-height: 1.8em;
		transition: opacity 0.3s ease;
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

	/* ─── Tap target ─── */
	.tap-target {
		fill: transparent;
		cursor: pointer;
		outline: none;
		transition: fill 0.2s ease, stroke-opacity 0.2s ease;
	}

	.tap-target:hover {
		fill: color-mix(in srgb, var(--theme-accent, #22d3ee) 10%, transparent);
	}

	.tap-target:active {
		fill: color-mix(in srgb, var(--theme-accent, #22d3ee) 20%, transparent);
	}

	.tap-target:focus-visible {
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 2;
		stroke-opacity: 0.6;
		stroke-dasharray: 8 4;
	}

	/* ─── Point visual states ─── */
	.tap-point {
		fill: var(--theme-accent, #22d3ee);
		pointer-events: none;
		transition: opacity 0.4s cubic-bezier(0, 0, 0.2, 1);
	}

	.tap-point.hidden {
		opacity: 0;
	}

	.tap-point.pulsing {
		opacity: 0;
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 2;
		fill: color-mix(in srgb, var(--theme-accent, #22d3ee) 15%, transparent);
		animation: breathe 2.5s ease-in-out infinite;
	}

	.tap-point.filled {
		opacity: 1;
		filter: url(#point-glow);
	}

	.tap-point.pop {
		animation: materialize 0.4s cubic-bezier(0, 0, 0.2, 1) forwards;
	}

	/* ─── Box points: hollow rings ─── */
	.tap-point.ring {
		fill: transparent;
		stroke: var(--theme-accent, #22d3ee);
		stroke-width: 6;
	}

	.tap-point.ring.pulsing {
		fill: transparent;
		stroke-width: 4;
		animation: breatheRing 2.5s ease-in-out infinite;
	}

	.tap-point.ring.filled {
		fill: transparent;
		stroke-opacity: 1;
		filter: url(#point-glow);
	}

	.tap-point.ring.pop {
		animation: materializeRing 0.4s cubic-bezier(0, 0, 0.2, 1) forwards;
	}

	/* ─── Floating label ─── */
	.tap-label {
		font-size: 26px;
		font-weight: 600;
		fill: var(--theme-text-dim, #9ca3af);
		font-family: system-ui, -apple-system, sans-serif;
		animation: labelReveal 1s cubic-bezier(0, 0, 0.2, 1) forwards;
		pointer-events: none;
	}

	/* ─── Completion rings ─── */
	.completion-ring {
		fill: none;
		stroke: var(--theme-accent, #22d3ee);
		pointer-events: none;
	}

	.completion-ring.ring-1 {
		stroke-width: 2;
		opacity: 0;
		animation: ripple 0.8s cubic-bezier(0, 0, 0.2, 1) forwards;
	}

	.completion-ring.ring-2 {
		stroke-width: 1.5;
		opacity: 0;
		animation: ripple 0.8s cubic-bezier(0, 0, 0.2, 1) 0.15s forwards;
	}

	/* ─── Animations ─── */

	/* Gentle breathing: slow opacity cycle, no scale */
	@keyframes breathe {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.65; }
	}

	@keyframes breatheRing {
		0%, 100% { stroke-opacity: 0.25; }
		50% { stroke-opacity: 0.6; }
	}

	/* Smooth materialization: fade in + slight scale, no overshoot */
	@keyframes materialize {
		0% {
			opacity: 0;
			transform: scale(0.6);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes materializeRing {
		0% {
			stroke-opacity: 0;
			transform: scale(0.6);
		}
		100% {
			stroke-opacity: 1;
			transform: scale(1);
		}
	}

	/* Label: gentle rise and fade */
	@keyframes labelReveal {
		0% {
			opacity: 0;
			transform: translateY(8px);
		}
		15% {
			opacity: 1;
			transform: translateY(0);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	/* Completion ripple: expanding ring that fades */
	@keyframes ripple {
		0% {
			opacity: 0.5;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.3);
		}
	}

	/* ─── Entry animation ─── */
	.anim-item {
		opacity: 0;
		transform: translateY(12px);
	}

	:global(.animate-in) .anim-item {
		animation: fadeIn 0.6s cubic-bezier(0, 0, 0.2, 1) forwards;
		animation-delay: calc(var(--anim-order, 0) * 100ms);
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ─── Responsive ─── */
	@media (max-width: 768px) {
		.tap-title { font-size: 1.75rem; }
		.tap-instruction { font-size: 1rem; }
	}

	@media (max-height: 1000px) {
		.tap-step { gap: var(--spacing-sm, 0.5rem); }
		.tap-title { font-size: 1.5rem; }
		.tap-grid-container { max-width: 400px; }
	}

	/* ─── Reduced motion ─── */
	@media (prefers-reduced-motion: reduce) {
		.tap-point.pulsing { animation: none; opacity: 0.5; }
		.tap-point.ring.pulsing { animation: none; stroke-opacity: 0.5; }
		.tap-point.pop { animation: none; opacity: 1; }
		.tap-point.ring.pop { animation: none; stroke-opacity: 1; }
		.tap-label { animation: none; opacity: 1; }
		.completion-ring { animation: none; }
		.anim-item { opacity: 1; transform: none; }
		:global(.animate-in) .anim-item { animation: none; opacity: 1; transform: none; }
		.tap-instruction { transition: none; }
	}
</style>
