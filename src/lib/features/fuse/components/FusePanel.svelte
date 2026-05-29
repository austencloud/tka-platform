<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. ChoreoCard on top, animation below,
	 * shuffle button at the bottom. Content column is constrained and aligned
	 * toward center so the two panels' content hugs the center gap.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
	import FuseSequenceBrowser from "./FuseSequenceBrowser.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";
	import { fuseTourState } from "$lib/shared/onboarding/state/fuse-tour-state.svelte";

	let {
		side,
		bpm,
		onControllerReady,
		onCurrentSequenceChange,
		length = 8,
		currentStep = 0,
		tourShuffleGlow = false,
	}: {
		side: "left" | "right";
		bpm: number;
		onControllerReady?: (controller: AnimationPlaybackController) => void;
		onCurrentSequenceChange?: (seq: SequenceData | null) => void;
		length?: number;
		currentStep?: number;
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

<div
	class="fuse-panel"
	class:align-end={side === "left"}
	class:align-start={side === "right"}
	role="region"
	aria-label="{label} prop path"
>
	<!-- Single content column - constrained width, aligned toward center -->
	<div class="content-column">
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
				{#key currentSequence.id ?? currentSequence.word}
					<FuseAnimationPreview
						sequence={currentSequence}
						{bpm}
						{onControllerReady}
						propColor={side === "left" ? "blue" : "red"}
						{currentStep}
						showBackButton={false}
					/>
				{/key}
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
</div>

<style>
	/* The panel fills its grid cell - background, border, rounded corners */
	.fuse-panel {
		display: flex;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-md, 12px);
		overflow: hidden;
	}

	/* Left panel pushes content right, right panel pushes content left */
	.fuse-panel.align-end {
		justify-content: flex-end;
	}
	.fuse-panel.align-start {
		justify-content: flex-start;
	}

	/* Single column that holds card + animation + shuffle.
	   Height fills the panel. Width defaults to 100% but on wide viewports
	   is capped so the animation stays proportional. */
	.content-column {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		max-width: 100%;
	}

	/* On wide screens, cap column width so panels don't stretch
	   into massive horizontal bars. 500px fits a nice square canvas. */
	@media (min-width: 1000px) {
		.content-column {
			max-width: 500px;
		}
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
		overflow: hidden;
		/* Never taller than wide - keeps the canvas square */
		aspect-ratio: 1;
		max-height: 100%;
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
		width: 100%;
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
