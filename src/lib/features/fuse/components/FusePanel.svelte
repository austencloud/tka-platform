<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. Shows a sequence browser when no
	 * sequence is selected, or a live animation preview when one is.
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
	}: {
		side: "left" | "right";
		selectedSequence: SequenceData | null;
		onSelect: (seq: SequenceData) => void;
		onDeselect: () => void;
		bpm: number;
		onControllerReady?: (controller: IAnimationPlaybackController) => void;
	} = $props();

	const label = $derived(side === "left" ? "Blue prop path" : "Red prop path");
</script>

<div class="fuse-panel" role="region" aria-label={label}>
	<div class="panel-header">
		<span class="panel-label">{label}</span>
		{#if selectedSequence}
			<span class="panel-seq-name">
				{selectedSequence.displayName || selectedSequence.name || (selectedSequence as any).word || "Selected"}
			</span>
		{/if}
	</div>

	<div class="panel-content">
		{#if selectedSequence}
			<FuseAnimationPreview
				sequence={selectedSequence}
				{bpm}
				onBack={onDeselect}
				{onControllerReady}
			/>
		{:else}
			<FuseSequenceBrowser {side} onSelect={(item) => onSelect(item as any)} />
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

	.panel-seq-name {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.panel-content {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
</style>
