<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. Display mode is controlled by the
	 * parent (FuseLayout) toggle — both panels switch simultaneously.
	 * "card" shows ChoreoCard browser, "animation" shows AnimationPreview.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import FuseSequenceBrowser from "./FuseSequenceBrowser.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";

	export type FuseDisplayMode = "card" | "animation";

	let {
		side,
		selectedSequence,
		browsingSequence,
		onSelect,
		onDeselect,
		bpm,
		onControllerReady,
		mode = "soloProps",
		length = 8,
		currentBeat = 0,
		displayMode = "card",
	}: {
		side: "left" | "right";
		selectedSequence: SequenceData | null;
		browsingSequence?: SequenceData | null;
		onSelect: (seq: SequenceData) => void;
		onDeselect: () => void;
		bpm: number;
		onControllerReady?: (controller: IAnimationPlaybackController) => void;
		mode?: "soloProps" | "handPaths";
		length?: number;
		currentBeat?: number;
		displayMode?: FuseDisplayMode;
	} = $props();

	const label = $derived(side === "left" ? "Blue" : "Red");

	// Track what the browser is currently showing (for animation mode without a pick)
	let localBrowsingSeq = $state<SequenceData | null>(null);

	// The sequence to show in animation mode: picked sequence if available, otherwise browsing
	const animationSequence = $derived(selectedSequence ?? browsingSequence ?? localBrowsingSeq);
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
		{#if displayMode === "animation" && animationSequence}
			<FuseAnimationPreview
				sequence={animationSequence}
				{bpm}
				onBack={onDeselect}
				{onControllerReady}
				propColor={side === "left" ? "blue" : "red"}
				{currentBeat}
			/>
		{:else}
			<FuseSequenceBrowser
				{side}
				{mode}
				{length}
				onSelect={(item) => onSelect(item as any)}
				picked={selectedSequence !== null}
				onBrowsingSequenceChange={(seq) => localBrowsingSeq = seq}
			/>
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
