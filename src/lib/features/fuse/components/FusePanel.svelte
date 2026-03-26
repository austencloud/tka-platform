<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. Shows a shuffle card when no
	 * item is selected, or a live animation preview when one is picked.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import FuseSequenceBrowser from "./FuseSequenceBrowser.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";

	let {
		side,
		selectedSequence,
		onSelect,
		onDeselect,
		bpm,
		onControllerReady,
		mode = "soloProps",
		length = 8,
		currentBeat = 0,
	}: {
		side: "left" | "right";
		selectedSequence: SequenceData | null;
		onSelect: (seq: SequenceData) => void;
		onDeselect: () => void;
		bpm: number;
		onControllerReady?: (controller: IAnimationPlaybackController) => void;
		mode?: "soloProps" | "handPaths";
		length?: number;
		currentBeat?: number;
	} = $props();

	const label = $derived(side === "left" ? "Blue" : "Red");
</script>

<div class="fuse-panel" role="region" aria-label="{label} {mode === 'soloProps' ? 'prop path' : 'hand path'}">
	<div class="panel-header">
		<span class="panel-label">{label}</span>
		{#if selectedSequence}
			<button class="deselect-btn" onclick={onDeselect} aria-label="Clear selection">
				<i class="fas fa-times" aria-hidden="true"></i>
			</button>
		{/if}
	</div>

	<div class="panel-content">
		{#if selectedSequence}
			<FuseAnimationPreview
				sequence={selectedSequence}
				{bpm}
				onBack={onDeselect}
				{onControllerReady}
				propColor={side === "left" ? "blue" : "red"}
				{currentBeat}
			/>
		{:else}
			<FuseSequenceBrowser {side} {mode} {length} onSelect={(item) => onSelect(item as any)} />
		{/if}
	</div>
</div>

<style>
	.fuse-panel {
		display: flex;
		flex-direction: column;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-md, 12px);
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.panel-label {
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		color: var(--theme-text, #ffffff);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.deselect-btn {
		background: none;
		border: none;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		padding: 4px 8px;
		min-height: 36px;
		min-width: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm, 6px);
	}

	.deselect-btn:hover {
		color: var(--theme-text, #ffffff);
	}

	.panel-content {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
</style>
