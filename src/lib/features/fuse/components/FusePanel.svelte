<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. Shows a sequence browser when no
	 * sequence is selected, or an animation preview placeholder when one is.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import FuseSequenceBrowser from "./FuseSequenceBrowser.svelte";

	let {
		side,
		selectedSequence,
		onSelect,
		onDeselect,
		bpm,
	}: {
		side: "left" | "right";
		selectedSequence: SequenceData | null;
		onSelect: (seq: SequenceData) => void;
		onDeselect: () => void;
		bpm: number;
	} = $props();

	const label = $derived(side === "left" ? "Left sequence" : "Right sequence");
</script>

<div class="fuse-panel" role="region" aria-label={label}>
	<div class="panel-header">
		<span class="panel-label">{label}</span>
		{#if selectedSequence}
			<button class="deselect-btn" onclick={onDeselect} aria-label="Remove selection">
				<i class="fas fa-times" aria-hidden="true"></i>
			</button>
		{/if}
	</div>

	<div class="panel-content">
		{#if selectedSequence}
			<div class="preview-placeholder">
				<i class="fas fa-film preview-icon" aria-hidden="true"></i>
				<span class="preview-name">{selectedSequence.displayName || selectedSequence.name || selectedSequence.word || "Sequence"}</span>
				<span class="preview-meta">{selectedSequence.steps.length} beats</span>
			</div>
		{:else}
			<FuseSequenceBrowser {onSelect} />
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
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: none;
		border: none;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		border-radius: var(--radius-sm, 8px);
		transition: color 0.15s ease;
	}

	.deselect-btn:hover {
		color: var(--semantic-error, #ef4444);
	}

	.panel-content {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.preview-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: var(--spacing-sm, 8px);
		color: var(--theme-text, #ffffff);
	}

	.preview-icon {
		font-size: 2rem;
		opacity: 0.4;
	}

	.preview-name {
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
	}

	.preview-meta {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}
</style>
