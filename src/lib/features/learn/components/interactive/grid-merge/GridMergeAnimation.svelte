<!--
  GridMergeAnimation - Orchestrator for the grid merge teaching animation

  Phases:
  - "intro": Simple 4-point diamond grid, no labels
  - "split": Two grids side-by-side (diamond left, box right)
  - "diamond-labels": Split view with cardinal labels animating in on diamond
  - "box-labels": Split view with intercardinal labels animating in on box
  - "merged": Both grids animate together to form the 8-point grid
  - "split-highlight": Split view for point type highlighting

  Highlight phases (for point type teaching, used after merged):
  - "none": No highlighting, all points visible
  - "center": Center point highlighted, others dimmed
  - "hand": Hand points highlighted, others dimmed
  - "outer": Outer points highlighted, others dimmed
-->
<script lang="ts">
	import { GRID, TIMING, RESPONSIVE, type Phase, type HighlightPhase } from './grid-merge-constants';
	import GridBackgrounds from './GridBackgrounds.svelte';
	import RotatingGridGroup from './RotatingGridGroup.svelte';
	import StaticGridGroup from './StaticGridGroup.svelte';
	import DirectionLabels from './DirectionLabels.svelte';
	import ModeLabels from './ModeLabels.svelte';

	let { phase = 'intro', highlightPhase = 'none' } = $props<{
		phase?: Phase;
		highlightPhase?: HighlightPhase;
	}>();

	// Derive max-width based on phase
	const maxWidth = $derived(
		phase === 'intro'
			? RESPONSIVE.DESKTOP.MAX_WIDTH_INTRO
			: phase === 'merged'
				? RESPONSIVE.DESKTOP.MAX_WIDTH_MERGED
				: RESPONSIVE.DESKTOP.MAX_WIDTH_SPLIT
	);

	// CSS custom properties for unified timing
	const cssVars = `
		--grid-center: ${GRID.CENTER}px;
		--merge-duration: ${TIMING.MERGE}ms;
		--merge-easing: ${TIMING.EASING};
		--merge-easing-soft: ${TIMING.EASING_SOFT};
		--entrance-duration: ${TIMING.ENTRANCE}ms;
		--label-duration: ${TIMING.LABEL}ms;
		--highlight-duration: ${TIMING.HIGHLIGHT}ms;
		--split-offset-x: ${RESPONSIVE.DESKTOP.SPLIT_OFFSET_X}px;
		--split-offset-y: ${RESPONSIVE.DESKTOP.SPLIT_OFFSET_Y}px;
		--split-offset-x-neg: -${RESPONSIVE.DESKTOP.SPLIT_OFFSET_X}px;
		--split-offset-y-neg: -${RESPONSIVE.DESKTOP.SPLIT_OFFSET_Y}px;
	`;
</script>

<div class="grid-merge-container">
	<svg
		viewBox="0 0 {GRID.SIZE} {GRID.SIZE}"
		class="merge-svg"
		style="{cssVars} --grid-merge-default-max-width: {maxWidth}px;"
	>
		<GridBackgrounds {phase} />
		<RotatingGridGroup {phase} {highlightPhase} />
		<StaticGridGroup {phase} {highlightPhase} />
		<DirectionLabels {phase} {highlightPhase} />
		<ModeLabels {phase} />
	</svg>
</div>

<style>
	.grid-merge-container {
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.merge-svg {
		width: 100%;
		height: auto;
		max-width: var(
			--grid-merge-max-width,
			var(--grid-merge-default-max-width)
		);
		overflow: visible;
		transition: max-width var(--merge-duration) var(--merge-easing);
	}

	/* === RESPONSIVE: Update CSS variables for tablet/mobile === */
	@media (max-width: 700px) {
		.merge-svg {
			--split-offset-x: 0px;
			--split-offset-y: 200px;
			--split-offset-x-neg: 0px;
			--split-offset-y-neg: -200px;
			max-width: 400px !important;
		}
	}

	@media (max-width: 500px) {
		.merge-svg {
			--split-offset-y: 180px;
			--split-offset-y-neg: -180px;
			max-width: 340px !important;
		}
	}
</style>
