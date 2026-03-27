<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. ChoreoCard on top, animation below,
	 * big shuffle button at the bottom. No headers, no pick step.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import FuseSequenceBrowser from "./FuseSequenceBrowser.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";
	import { fuseTourState } from "$lib/shared/onboarding/state/fuse-tour-state.svelte";

	let {
		side,
		bpm,
		onControllerReady,
		onCurrentSequenceChange,
		length = 8,
		currentBeat = 0,
		tourShuffleGlow = false,
	}: {
		side: "left" | "right";
		bpm: number;
		onControllerReady?: (controller: IAnimationPlaybackController) => void;
		onCurrentSequenceChange?: (seq: SequenceData | null) => void;
		length?: number;
		currentBeat?: number;
		tourShuffleGlow?: boolean;
	} = $props();

	const label = $derived(side === "left" ? "Blue" : "Red");
	const accentColor = $derived(side === "left" ? "var(--prop-blue, #2196f3)" : "var(--prop-red, #f44336)");

	let currentSequence = $state<SequenceData | null>(null);
	let shuffleFn = $state<(() => void) | null>(null);
	let counter = $state({ current: 0, total: 0 });

	function handleCurrentItemChange(seq: SequenceData | null) {
		currentSequence = seq;
		onCurrentSequenceChange?.(seq);
	}
</script>

<div class="fuse-panel" role="region" aria-label="{label} prop path" style="--align: {side === 'left' ? 'flex-end' : 'flex-start'};">
	<div class="card-section">
		<FuseSequenceBrowser
			{side}
			{length}
			onSelect={() => {}}
			hideActions={true}
			onCurrentItemChange={handleCurrentItemChange}
			onShuffleReady={(fn) => shuffleFn = fn}
			onCounterChange={(c, t) => counter = { current: c, total: t }}
		/>
	</div>

	<div class="animation-section">
		{#if currentSequence}
			<div class="animation-square">
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
			</div>
		{:else}
			<div class="animation-placeholder">
				<i class="fas fa-play-circle" aria-hidden="true"></i>
			</div>
		{/if}
	</div>

	<button
		class="shuffle-btn"
		class:glow={tourShuffleGlow}
		onclick={() => {
			shuffleFn?.();
			if (fuseTourState.isActive && fuseTourState.currentStop === "shuffle") {
				fuseTourState.completeAction();
				// Auto-advance after 1.5s so they see the shuffled result
				setTimeout(() => fuseTourState.advance(), 1500);
			}
		}}
		aria-label="Shuffle {label} to next sequence"
		style="--accent: {accentColor};"
	>
		<i class="fas fa-shuffle" aria-hidden="true"></i>
		<span class="shuffle-label">Shuffle</span>
		{#if counter.total > 0}
			<span class="shuffle-counter">{counter.current} / {counter.total}</span>
		{/if}
	</button>
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

	.card-section {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.animation-section {
		flex: 1;
		min-height: 100px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		position: relative;
		display: flex;
		justify-content: var(--align, center);
		align-items: center;
	}

	.animation-square {
		aspect-ratio: 1;
		height: 100%;
		max-width: 100%;
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

	.shuffle-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		min-height: 48px;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		border: none;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: background 150ms ease;
	}

	.shuffle-btn:hover {
		background: color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.shuffle-btn:active {
		background: color-mix(in srgb, var(--accent) 32%, transparent);
	}

	.shuffle-btn.glow {
		background: color-mix(in srgb, var(--accent) 35%, transparent);
		border: 1.5px solid color-mix(in srgb, var(--accent) 50%, transparent);
		border-top: 1.5px solid color-mix(in srgb, var(--accent) 50%, transparent);
		box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent);
		animation: shuffleGlow 1.5s ease-in-out infinite;
	}

	@keyframes shuffleGlow {
		0%, 100% {
			box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent);
			background: color-mix(in srgb, var(--accent) 30%, transparent);
		}
		50% {
			box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 50%, transparent);
			background: color-mix(in srgb, var(--accent) 45%, transparent);
		}
	}

	.shuffle-label {
		letter-spacing: 0.03em;
	}

	.shuffle-counter {
		font-size: var(--font-size-compact, 12px);
		font-weight: 400;
		opacity: 0.6;
	}

	@media (prefers-reduced-motion: reduce) {
		.shuffle-btn {
			transition: none;
		}

		.shuffle-btn.glow {
			animation: none;
		}
	}
</style>
