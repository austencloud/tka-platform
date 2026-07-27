<!--
  Unit Circle Theory artifact: an orbital measuring object built only from the
  sourced 2009 definition — one poi length as the unit, the circle taken as
  diameter 1. When active, the measured radius follows the pointer around the
  circle; the readout never changes because that is the point of the system.
  No relationship to QFT is drawn or implied.
-->
<script lang="ts">
	let { active = false }: { active?: boolean } = $props();

	// Pointer angle in radians, measured from straight up. Rest position: 40°.
	let angle = $state(0.7);

	function track(event: PointerEvent) {
		if (!active) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		angle = Math.atan2(event.clientX - cx, -(event.clientY - cy));
	}

	const R = 120;
	const tip = $derived({
		x: R * Math.sin(angle),
		y: -R * Math.cos(angle),
	});
	const mid = $derived({ x: tip.x / 2, y: tip.y / 2 });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- Pointer tracking is a hover enhancement; the SVG carries the semantics. -->
<div
	class="unit-circle"
	class:active
	onpointermove={track}
>
	<svg viewBox="-170 -170 340 340" role="img" aria-label="A circle of diameter 1, with one radius measured in poi lengths">
		<circle class="orbit" cx="0" cy="0" r={R} />
		<circle class="center" cx="0" cy="0" r="5" />

		<!-- The full diameter, the unit itself. -->
		<line class="diameter" x1={-tip.x} y1={-tip.y} x2={tip.x} y2={tip.y} />

		<!-- The measured radius: half the unit. -->
		<line class="radius" x1="0" y1="0" x2={tip.x} y2={tip.y} />
		<circle class="tip" cx={tip.x} cy={tip.y} r="9" />

		<!-- Tick marks: the radius read against the unit. -->
		<g class="measure" transform={`translate(${mid.x} ${mid.y})`}>
			<circle r="3" />
		</g>
	</svg>
	<div class="readout" aria-hidden="true">
		<span class="value">⌀ = 1</span>
		<span class="unit">poi length</span>
	</div>
</div>

<style>
	.unit-circle {
		position: relative;
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		touch-action: pan-x;
	}

	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.orbit {
		fill: none;
		stroke: oklch(0.75 0.1 180 / 0.55);
		stroke-width: 2.5;
	}

	.center {
		fill: oklch(0.85 0.02 270);
	}

	.diameter {
		stroke: oklch(0.6 0.03 270 / 0.4);
		stroke-width: 2;
		stroke-dasharray: 5 7;
	}

	.radius {
		stroke: oklch(0.8 0.13 180);
		stroke-width: 4;
		stroke-linecap: round;
		transition: none;
	}

	.tip {
		fill: oklch(0.8 0.13 180);
		stroke: #fff;
		stroke-width: 2;
	}

	.measure circle {
		fill: oklch(0.9 0.02 270 / 0.8);
	}

	.readout {
		position: absolute;
		inset-inline: 0;
		bottom: 6%;
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.45rem;
		pointer-events: none;
	}

	.value {
		font-size: clamp(1rem, 3cqi, 1.6rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: oklch(0.88 0.08 180);
	}

	.unit {
		font-size: clamp(0.7rem, 2cqi, 0.95rem);
		color: oklch(0.7 0.03 270);
	}
</style>
