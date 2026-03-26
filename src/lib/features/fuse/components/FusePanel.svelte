<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. ChoreoCard on top, animation below.
	 * Shuffle button in the header. No pick step — Fuse uses whatever's showing.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import FuseSequenceBrowser from "./FuseSequenceBrowser.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";

	let {
		side,
		bpm,
		onControllerReady,
		onCurrentSequenceChange,
		length = 8,
		currentBeat = 0,
	}: {
		side: "left" | "right";
		bpm: number;
		onControllerReady?: (controller: IAnimationPlaybackController) => void;
		onCurrentSequenceChange?: (seq: SequenceData | null) => void;
		length?: number;
		currentBeat?: number;
	} = $props();

	const label = $derived(side === "left" ? "Blue" : "Red");

	let currentSequence = $state<SequenceData | null>(null);
	let shuffleFn = $state<(() => void) | null>(null);

	function handleCurrentItemChange(seq: SequenceData | null) {
		currentSequence = seq;
		onCurrentSequenceChange?.(seq);
	}
</script>

<div class="fuse-panel" role="region" aria-label="{label} prop path">
	<div class="panel-body">
		<!-- Shuffle overlay button -->
		<button
			class="shuffle-overlay"
			onclick={() => shuffleFn?.()}
			aria-label="Shuffle {label} to next sequence"
		>
			<i class="fas fa-shuffle" aria-hidden="true"></i>
		</button>
		<div class="card-section">
			<FuseSequenceBrowser
				{side}
				{length}
				onSelect={() => {}}
				hideActions={true}
				onCurrentItemChange={handleCurrentItemChange}
				onShuffleReady={(fn) => shuffleFn = fn}
			/>
		</div>

		<div class="animation-section">
			{#if currentSequence}
				{#key currentSequence.id ?? currentSequence.word}
					<FuseAnimationPreview
						sequence={currentSequence}
						{bpm}
						{onControllerReady}
						propColor={side === "left" ? "blue" : "red"}
						{currentBeat}
						showBackButton={false}
					/>
				{/key}
			{:else}
				<div class="animation-placeholder">
					<i class="fas fa-play-circle" aria-hidden="true"></i>
				</div>
			{/if}
		</div>
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

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.shuffle-overlay {
		position: absolute;
		top: var(--spacing-xs, 4px);
		right: var(--spacing-xs, 4px);
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: rgba(0, 0, 0, 0.5);
		border: none;
		border-radius: var(--radius-sm, 6px);
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		font-size: 14px;
		transition: background 150ms ease;
	}

	.shuffle-overlay:hover {
		background: rgba(0, 0, 0, 0.7);
		color: #ffffff;
	}

	.card-section {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.animation-section {
		flex: 1;
		min-height: 120px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		position: relative;
	}

	.animation-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
		font-size: 2rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.shuffle-btn {
			transition: none;
		}
	}
</style>
