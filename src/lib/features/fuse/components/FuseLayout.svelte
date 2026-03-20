<script lang="ts">
	/**
	 * Fuse Layout
	 *
	 * Responsive split layout with two sequence browser panels and a fuse button.
	 * CSS grid: 1fr 1fr on desktop, stacked 1fr / 1fr on mobile (<900px).
	 * Uses container queries per project convention.
	 */

	import { getFuseContext } from "../context/fuse-context";
	import FusePanel from "./FusePanel.svelte";
	import FuseButton from "./FuseButton.svelte";

	const { state } = getFuseContext();
</script>

<div class="fuse-layout">
	<div class="fuse-panels">
		<FusePanel
			side="left"
			selectedSequence={state.leftSequence}
			onSelect={state.selectLeft}
			onDeselect={state.deselectLeft}
			bpm={state.bpm}
		/>
		<FusePanel
			side="right"
			selectedSequence={state.rightSequence}
			onSelect={state.selectRight}
			onDeselect={state.deselectRight}
			bpm={state.bpm}
		/>
	</div>

	<div class="fuse-action">
		<FuseButton />
	</div>
</div>

<style>
	.fuse-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		container-type: inline-size;
		container-name: fuse-layout;
	}

	.fuse-panels {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 1fr;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px);
	}

	@container fuse-layout (min-width: 900px) {
		.fuse-panels {
			grid-template-columns: 1fr 1fr;
			grid-template-rows: 1fr;
		}
	}

	.fuse-action {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
	}
</style>
