<!--
  FuseResultView.svelte

  Displayed after a successful fuse. Shows a brief celebration burst,
  then the fused sequence playing in an AnimatorCanvas with three action
  buttons: Save, Build Another, and See Related.
-->
<script lang="ts">
	import { onMount, onDestroy, untrack } from "svelte";
	import { getFuseContext } from "../context/fuse-context";
	import CelebrationOverlay from "./CelebrationOverlay.svelte";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
	import { container } from "$lib/shared/di";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import type { ISequenceMotionLoader } from "$lib/shared/sequence-viewer/services/contracts/ISequenceMotionLoader";
	import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";

	const { state: fuseState } = getFuseContext();

	const DEFAULT_BPM = 60;

	let showCelebration = $state(true);
	let resultEl = $state<HTMLDivElement | null>(null);

	// Animation playback state
	let controller = $state<IAnimationPlaybackController | null>(null);
	let motionLoader = $state<ISequenceMotionLoader | null>(null);
	const animState = createAnimationPanelState();

	let loading = $state(true);
	let error = $state<string | null>(null);

	const isPlaying = $derived(animState.isPlaying);
	const currentStep = $derived(animState.currentStep);
	const bluePropState = $derived(animState.bluePropState);
	const redPropState = $derived(animState.redPropState);

	const sequence = $derived(fuseState.fusedSequence);
	const sequenceData = $derived(animState.sequenceData ?? sequence);

	const stepData = $derived.by(() => {
		const seq = sequenceData;
		if (!seq) return null;
		if (currentStep < 1) return seq.startPosition ?? null;
		const idx = Math.min(Math.max(0, Math.floor(currentStep) - 1), (seq.steps?.length ?? 1) - 1);
		return seq.steps?.[idx] ?? null;
	});

	const letter = $derived(stepData?.letter ?? null);
	const gridMode = $derived(sequenceData?.gridMode ?? sequence?.gridMode);

	// Celebration center — middle of the result container
	const celebrationX = $derived(resultEl ? resultEl.clientWidth / 2 : 0);
	const celebrationY = $derived(resultEl ? resultEl.clientHeight / 2 : 0);

	onMount(async () => {
		try {
			motionLoader = container.items.sequenceMotionLoader;
			controller = container.items.animationPlaybackController;
			loading = false;
		} catch (err) {
			console.error("Failed to initialize fuse result playback:", err);
			error = "Failed to load animation";
			loading = false;
		}
	});

	onDestroy(() => {
		controller?.dispose();
		animState.dispose();
	});

	// Initialize playback when controller and sequence are ready
	$effect(() => {
		void controller;
		void motionLoader;
		const seq = sequence;

		if (!controller || !motionLoader || !seq) return;

		untrack(async () => {
			if (animState.isPlaying) controller!.togglePlayback();
			animState.reset();

			const fullSeq = await motionLoader!.ensureMotionData(seq);
			if (!fullSeq) {
				error = "Failed to load sequence motion data";
				return;
			}

			animState.setShouldLoop(true);
			const ok = controller!.initialize(fullSeq, animState);
			if (!ok) {
				error = "Failed to initialize playback";
				return;
			}

			const speed = fuseState.bpm / DEFAULT_BPM;
			controller!.setSpeed(speed);

			setTimeout(() => controller?.togglePlayback(), 300);
		});
	});

	function handleCelebrationComplete() {
		showCelebration = false;
	}

	function handleBuildAnother() {
		fuseState.reset();
	}

	function handleOpenInViewer() {
		if (!sequence) return;
		openSequenceViewer(sequence, {
			returnPath: "/app/create",
			returnLabel: "Fuse",
			initialBpm: fuseState.bpm,
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			fuseState.reset();
		}
		if (event.key === " ") {
			event.preventDefault();
			controller?.togglePlayback();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="fuse-result"
	bind:this={resultEl}
	role="region"
	aria-label="Fused sequence result"
	tabindex="0"
	onkeydown={handleKeydown}
>
	{#if showCelebration && resultEl}
		<CelebrationOverlay
			centerX={celebrationX}
			centerY={celebrationY}
			onComplete={handleCelebrationComplete}
		/>
	{/if}

	<div class="result-header">
		<h2 class="result-title">
			{sequence?.displayName || sequence?.name || sequence?.word || "Fused Sequence"}
		</h2>
		{#if sequence}
			<span class="result-meta">
				{sequence.sequenceLength ?? sequence.steps?.length ?? 0} beats
			</span>
		{/if}
	</div>

	<div class="result-canvas">
		{#if loading}
			<div class="state-msg">
				<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
				<span>Loading...</span>
			</div>
		{:else if error}
			<div class="state-msg error">
				<span>{error}</span>
			</div>
		{:else if sequence}
			<AnimatorCanvas
				blueProp={bluePropState}
				redProp={redPropState}
				gridVisible={true}
				{gridMode}
				{letter}
				{stepData}
				sequenceData={sequenceData}
				{currentStep}
				{isPlaying}
				word={sequenceData?.word ?? sequence?.word ?? null}
				hideProgressBar={false}
				hideTkaGlyph={false}
				hideStepNumbers={false}
				progressBarVariant="gradient"
				fillContainer={true}
			/>
		{:else}
			<div class="state-msg">
				<span>No result available</span>
			</div>
		{/if}
	</div>

	<div class="result-actions">
		<button class="action-btn action-save" onclick={() => {}}>
			<i class="fas fa-bookmark" aria-hidden="true"></i>
			<span>Save</span>
		</button>
		<button class="action-btn action-another" onclick={handleBuildAnother}>
			<i class="fas fa-redo" aria-hidden="true"></i>
			<span>Build Another</span>
		</button>
		<button class="action-btn action-related" onclick={handleOpenInViewer}>
			<i class="fas fa-expand" aria-hidden="true"></i>
			<span>Open in Viewer</span>
		</button>
	</div>
</div>

<style>
	.fuse-result {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		position: relative;
		outline: none;
	}

	.result-header {
		flex-shrink: 0;
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-md, 16px);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.result-title {
		margin: 0;
		font-size: var(--font-size-lg, 18px);
		font-weight: 700;
		color: var(--theme-text, #ffffff);
	}

	.result-meta {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.result-canvas {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm, 8px);
	}

	.state-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
	}

	.state-msg.error {
		color: var(--semantic-error, #fca5a5);
	}

	.result-actions {
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-md, 16px);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		min-height: 44px;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-md, 12px);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.action-btn:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	.action-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #fb923c);
		outline-offset: 2px;
	}

	.action-save {
		background: linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%);
		color: #ffffff;
		border: none;
	}

	.action-save:hover {
		opacity: 0.9;
	}

	@media (prefers-reduced-motion: reduce) {
		.action-btn {
			transition: none;
		}
	}
</style>
