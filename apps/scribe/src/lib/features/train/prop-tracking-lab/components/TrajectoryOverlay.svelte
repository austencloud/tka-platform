<!--
	TrajectoryOverlay.svelte - Visualizes prop tip trajectory

	Draws the path of the prop tip across all frames as an SVG overlay.
	The current tip position is highlighted.
-->
<script lang="ts">
	import type { NormalizedPoint } from '../domain/models';

	let {
		trajectory,
		currentTip,
		videoWidth,
		videoHeight
	}: {
		trajectory: NormalizedPoint[];
		currentTip: NormalizedPoint | null;
		videoWidth: number;
		videoHeight: number;
	} = $props();

	// Convert trajectory to SVG path
	let pathData = $derived(() => {
		if (trajectory.length < 2) return '';

		const points = trajectory.map(p => `${p.x * 100},${p.y * 100}`);
		return `M ${points[0]} L ${points.slice(1).join(' L ')}`;
	});
</script>

<svg
	class="trajectory-overlay"
	viewBox="0 0 100 100"
	preserveAspectRatio="none"
>
	<!-- Trail path -->
	{#if trajectory.length >= 2}
		<path
			d={pathData()}
			fill="none"
			stroke="url(#trajectory-gradient)"
			stroke-width="0.3"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}

	<!-- Current tip position -->
	{#if currentTip}
		<circle
			cx={currentTip.x * 100}
			cy={currentTip.y * 100}
			r="1"
			fill="var(--semantic-warning)"
			stroke="white"
			stroke-width="0.2"
		/>
		<!-- Direction indicator -->
		<circle
			cx={currentTip.x * 100}
			cy={currentTip.y * 100}
			r="2"
			fill="none"
			stroke="var(--semantic-warning)"
			stroke-width="0.1"
			opacity="0.5"
		/>
	{/if}

	<!-- Gradient definition -->
	<defs>
		<linearGradient id="trajectory-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
			<stop offset="0%" stop-color="rgba(99, 102, 241, 0.3)" />
			<stop offset="100%" stop-color="rgba(99, 102, 241, 1)" />
		</linearGradient>
	</defs>
</svg>

<style>
	.trajectory-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
