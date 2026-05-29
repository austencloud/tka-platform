<!--
  FuseAnimationPreview.svelte

  Shows a live animation preview driven entirely by the shared fuse clock.
  Does NOT run its own playback loop - instead, reactively calls
  calculateStateForStep() when currentStep changes.
-->
<script lang="ts">

import { getSequenceMotionLoader } from "$lib/shared/sequence-viewer/getSequenceMotionLoader";
	import { onMount, onDestroy, untrack } from "svelte";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
	import type { SequenceMotionLoader } from "$lib/shared/sequence-viewer/services/sequence-motion-loader";
	import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
	import { createPlaybackControllerFactory } from "$lib/shared/animation-engine/createPlaybackControllerFactory";

	let {
		sequence,
		bpm = 60,
		onBack,
		onControllerReady,
		propColor,
		currentStep = 0,
		showBackButton = true,
	}: {
		sequence: SequenceData;
		bpm?: number;
		onBack?: () => void;
		onControllerReady?: (controller: AnimationPlaybackController) => void;
		propColor?: "blue" | "red";
		currentStep?: number;
		showBackButton?: boolean;
	} = $props();

	let controller = $state<AnimationPlaybackController | null>(null);
	let motionLoader = $state<SequenceMotionLoader | null>(null);
	const animState = createAnimationPanelState();
	let initialized = $state(false);
	let totalSteps = $state(0);

	let loading = $state(true);
	let error = $state<string | null>(null);

	// Derived state from animState for canvas props
	const animCurrentStep = $derived(animState.currentStep);
	const bluePropState = $derived(animState.bluePropState);
	const redPropState = $derived(animState.redPropState);
	const sequenceData = $derived(animState.sequenceData ?? sequence);

	const stepData = $derived.by(() => {
		const seq = sequenceData;
		if (!seq) return null;
		if (animCurrentStep < 1) return seq.startPosition ?? null;
		const idx = Math.min(Math.max(0, Math.floor(animCurrentStep) - 1), (seq.steps?.length ?? 1) - 1);
		return seq.steps?.[idx] ?? null;
	});

	const letter = $derived(stepData?.letter ?? null);
	const gridMode = $derived(sequenceData?.gridMode ?? sequence?.gridMode);

	onMount(async () => {
		try {
			motionLoader = getSequenceMotionLoader();
			controller = createPlaybackControllerFactory();
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

	// Initialize controller with sequence (but do NOT start its playback loop)
	$effect(() => {
		void controller;
		void motionLoader;

		if (!controller || !motionLoader) return;

		untrack(async () => {
			// Stop any existing playback
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

			totalSteps = fullSeq.steps?.length ?? 1;
			initialized = true;

			onControllerReady?.(controller!);

			// Do NOT call togglePlayback() - the shared clock drives this
			// Just calculate initial state
			const stepCount = totalSteps;
			if (stepCount > 0 && currentStep > 0) {
				const wrappedBeat = (Math.floor(currentStep) % stepCount) + 1;
				controller!.calculateStateForStep(wrappedBeat);
			} else {
				controller!.calculateStateForStep(0);
			}
		});
	});

	// Drive animation from the shared clock - this is the only beat source.
	// calculateStateForStep computes interpolated prop states for the given beat
	// without running an internal rAF loop.
	$effect(() => {
		const beat = currentStep;
		if (!initialized || !controller || totalSteps <= 0) return;

		untrack(() => {
			// The animation engine convention: beat 0 = start position, 1..N = motion steps.
			// Shared clock beat is a continuous float. Wrap into sequence length,
			// then add 1 to skip past the start position into motion space.
			const wrappedWithFraction = (beat % totalSteps) + 1;
			controller!.calculateStateForStep(wrappedWithFraction);
			animState.setCurrentStep(wrappedWithFraction);
		});
	});
</script>

<div class="fuse-animation-preview">
	{#if loading}
		<div class="state-msg">
			<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
			<span>Loading animation...</span>
		</div>
	{:else if error}
		<div class="state-msg error">
			<span>{error}</span>
		</div>
	{:else}
		<div class="canvas-wrap">
			<AnimatorCanvas
				blueProp={propColor === "red" ? null : bluePropState}
				redProp={propColor === "blue" ? null : redPropState}
				gridVisible={true}
				{gridMode}
				letter={null}
				{stepData}
				{sequenceData}
				{currentStep}
				isPlaying={true}
				word={null}
				hideProgressBar={true}
				hideTkaGlyph={true}
				hideStepNumbers={true}
				progressBarVariant="minimal"
				fillContainer={true}
			/>

			{#if showBackButton && onBack}
				<button
					class="back-btn"
					onclick={onBack}
					aria-label="Deselect sequence"
				>
					<i class="fas fa-arrow-left" aria-hidden="true"></i>
				</button>
			{/if}
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
