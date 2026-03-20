<!--
  FuseAnimationPreview.svelte

  Replaces the browser in a FusePanel when a sequence is selected.
  Creates its own AnimationPlaybackController + AnimationPanelState,
  initializes with the sequence, and starts looping playback on mount.

  A back button overlays the animation so the user can deselect.
-->
<script lang="ts">
	import { onMount, onDestroy, untrack } from "svelte";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import type { ISequenceMotionLoader } from "$lib/shared/sequence-viewer/services/contracts/ISequenceMotionLoader";
	import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
	import { container } from "$lib/shared/di";

	const DEFAULT_BPM = 60;

	let {
		sequence,
		bpm = DEFAULT_BPM,
		onBack,
		onControllerReady,
	}: {
		sequence: SequenceData;
		bpm?: number;
		onBack: () => void;
		onControllerReady?: (controller: IAnimationPlaybackController) => void;
	} = $props();

	let controller = $state<IAnimationPlaybackController | null>(null);
	let motionLoader = $state<ISequenceMotionLoader | null>(null);
	const animState = createAnimationPanelState();

	let loading = $state(true);
	let error = $state<string | null>(null);

	// Derived state from animState for canvas props
	const isPlaying = $derived(animState.isPlaying);
	const currentStep = $derived(animState.currentStep);
	const bluePropState = $derived(animState.bluePropState);
	const redPropState = $derived(animState.redPropState);
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

	onMount(async () => {
		try {
			motionLoader = container.items.sequenceMotionLoader;
			controller = container.items.animationPlaybackController;
			loading = false;
		} catch (err) {
			console.error("Failed to initialize fuse animation preview:", err);
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

		if (!controller || !motionLoader) return;

		untrack(async () => {
			if (animState.isPlaying) controller!.togglePlayback();
			animState.reset();

			const fullSeq = await motionLoader!.ensureMotionData(sequence);
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

			// Expose controller to parent for sync
			onControllerReady?.(controller!);

			// Apply BPM
			const speed = bpm / DEFAULT_BPM;
			controller!.setSpeed(speed);

			// Start playback after a brief delay so the canvas renders first
			setTimeout(() => controller?.togglePlayback(), 300);
		});
	});

	// Sync BPM changes to controller speed
	$effect(() => {
		const speed = bpm / DEFAULT_BPM;
		if (controller) {
			untrack(() => controller!.setSpeed(speed));
		}
	});
</script>

<div class="fuse-animation-preview">
	{#if loading}
		<div class="state-msg">
			<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
			<span>Loading...</span>
		</div>
	{:else if error}
		<div class="state-msg error">
			<span>{error}</span>
		</div>
	{:else}
		<div class="canvas-wrap">
			<AnimatorCanvas
				blueProp={bluePropState}
				redProp={redPropState}
				gridVisible={true}
				{gridMode}
				{letter}
				{stepData}
				{sequenceData}
				{currentStep}
				{isPlaying}
				word={sequenceData?.word ?? sequence?.word ?? null}
				hideProgressBar={false}
				hideTkaGlyph={true}
				hideStepNumbers={true}
				progressBarVariant="minimal"
				disableContextMenu={true}
				fillContainer={true}
			/>

			<button
				class="back-btn"
				onclick={onBack}
				aria-label="Deselect sequence"
			>
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
			</button>
		</div>
	{/if}
</div>

<style>
	.fuse-animation-preview {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.canvas-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.back-btn {
		position: absolute;
		top: var(--spacing-xs, 4px);
		left: var(--spacing-xs, 4px);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: var(--radius-sm, 8px);
		background: rgba(0, 0, 0, 0.5);
		color: #ffffff;
		font-size: 1rem;
		cursor: pointer;
		z-index: 10;
		transition: background 0.15s ease;
	}

	.back-btn:hover {
		background: rgba(0, 0, 0, 0.7);
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

	@media (prefers-reduced-motion: reduce) {
		.back-btn {
			transition: none;
		}
	}
</style>
