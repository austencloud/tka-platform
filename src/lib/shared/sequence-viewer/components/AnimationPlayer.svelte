<!--
  AnimationPlayer.svelte

  Thin coordinator for sequence animation playback.
  Composes existing primitives - does NOT duplicate their functionality.

  Modes:
  - Standalone: Creates own AnimationPanelState, loads services internally
  - External: Consumes AnimationExportContext from parent

  Primitives used:
  - AnimatorCanvas (rendering)
  - HorizontalSidebar / HorizontalTransportRow (horizontal layout)
  - VerticalModeControls (vertical layout)
  - ExportProgressOverlay (export progress)
-->
<script lang="ts">

import { getAnimationPlaybackController } from "$lib/shared/animation-engine/getAnimationPlaybackController";
import { getSequenceMotionLoader } from "$lib/shared/sequence-viewer/getSequenceMotionLoader";
	import { onMount, onDestroy, untrack } from "svelte";
	import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
	import type { SequenceMotionLoader } from "$lib/shared/sequence-viewer/services/implementations/SequenceMotionLoader";
	import { createAnimationPanelState, type AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
	import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
	import { TrackingMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
	import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
	import { tryGetAnimationExportContext } from "$lib/shared/export-panel/context/animation-export-context.svelte";
	import type { ControlsLevel } from "../domain/types";

	// Extracted components
	import ExportProgressOverlay from "./ExportProgressOverlay.svelte";
	import HorizontalSidebar from "./HorizontalSidebar.svelte";
	import HorizontalTransportRow from "./HorizontalTransportRow.svelte";
	import VerticalModeControls from "./VerticalModeControls.svelte";

	const DEFAULT_BPM = 60;

	import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

	let {
		sequence,
		autoPlay = true,
		showControls = true,
		controlsLevel = "minimal" as ControlsLevel,
		externalControl = false,
		onCanvasReady,
		onStepChange,
		previewDarkMode = null,
		layout = "vertical" as "vertical" | "horizontal",
		bluePropType = null,
		redPropType = null,
		onTogglePlaybackRef,
		onControllerReady,
		hideProgressBar = false,
		hideWordHeader = false,
	}: {
		sequence: SequenceData;
		autoPlay?: boolean;
		showControls?: boolean;
		controlsLevel?: ControlsLevel;
		externalControl?: boolean;
		onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
		/** Called when current step changes (0-indexed step index or null when not playing) */
		onStepChange?: (stepIndex: number | null, isPlaying: boolean) => void;
		previewDarkMode?: boolean | null;
		layout?: "vertical" | "horizontal";
		bluePropType?: PropType | null;
		redPropType?: PropType | null;
		/** Callback to receive reference to toggle playback function (for external keyboard control) */
		onTogglePlaybackRef?: (toggleFn: () => void) => void;
		/** Called when the internal playback controller is initialized, exposing it for external sync */
		onControllerReady?: (ctrl: AnimationPlaybackController, state: AnimationPanelState) => void;
		hideProgressBar?: boolean;
		hideWordHeader?: boolean;
	} = $props();

	// Context for external control mode
	const ctx = $derived(externalControl ? tryGetAnimationExportContext() : null);
	const useContext = $derived(externalControl && !!ctx);

	// Services (standalone mode only)
	let controller = $state<AnimationPlaybackController | null>(null);
	let motionLoader = $state<SequenceMotionLoader | null>(null);

	// State (standalone mode only)
	const animState = createAnimationPanelState();

	// UI state
	let loading = $state(true);
	let error = $state<string | null>(null);
	let bpm = $state(DEFAULT_BPM);
	let lastSequenceId = $state<string | null>(null);

	// Derived: effective state from context or internal
	// Use optional chaining to handle potential timing issues where ctx might not be ready
	const isPlaying = $derived(useContext ? ctx?.state?.isPlaying ?? false : animState?.isPlaying ?? false);
	const currentStep = $derived(useContext ? ctx?.state?.currentStep ?? 0 : animState?.currentStep ?? 0);
	const bluePropState = $derived(useContext ? ctx?.state?.bluePropState ?? null : animState?.bluePropState ?? null);
	const redPropState = $derived(useContext ? ctx?.state?.redPropState ?? null : animState?.redPropState ?? null);
	const sequenceData = $derived(useContext ? ctx?.state?.sequenceData ?? sequence : animState?.sequenceData ?? sequence);
	const playbackMode = $derived(useContext ? ctx?.state?.playbackMode ?? "continuous" : "continuous" as const);
	const stepSize = $derived(useContext ? ctx?.state?.stepPlaybackStepSize ?? 1 : 1 as const);
	const isExporting = $derived(useContext ? ctx?.state?.isExporting ?? false : false);
	const exportProgress = $derived(useContext ? ctx?.state?.exportProgress ?? null : null);

	// Derived: current step data for canvas
	const stepData = $derived.by(() => {
		const seq = sequenceData;
		if (!seq) return null;
		if (currentStep < 1) return seq.startPosition ?? null;
		const idx = Math.min(Math.max(0, Math.floor(currentStep) - 1), (seq.steps?.length ?? 1) - 1);
		return seq.steps?.[idx] ?? null;
	});

	const letter = $derived(stepData?.letter ?? null);
	const gridMode = $derived(sequenceData?.gridMode ?? sequence?.gridMode);

	// Notify parent of step changes for animation sync (e.g., highlighting in dual view)
	$effect(() => {
		const step = currentStep;
		const playing = isPlaying;
		// Convert currentStep (1-indexed) to stepIndex (0-indexed)
		// When step < 1, it's the start position - pass null
		const stepIndex = step < 1 ? null : Math.max(0, Math.floor(step) - 1);
		onStepChange?.(stepIndex, playing);
	});

	// Trail settings with fine-grained reactivity and unilateral prop enforcement.
	// Unilateral props (fan, club, etc.) always use RIGHT_END - they only have
	// one meaningful endpoint, so BOTH_ENDS would show an imaginary second trail.
	const trailSettings = $derived.by(() => {
		const t = animationSettings.trail;
		void t.mode;
		void t.fadeDurationMs;
		void t.lineWidth;
		void t.maxOpacity;
		void t.trackingMode;
		void t.effect;

		const settings = { ...t };

		if (settings.trackingMode === TrackingMode.BOTH_ENDS) {
			const hasBilateral =
				(bluePropType != null && isBilateralProp(String(bluePropType))) ||
				(redPropType != null && isBilateralProp(String(redPropType)));
			if (!hasBilateral) {
				settings.trackingMode = TrackingMode.RIGHT_END;
			}
		}

		return settings;
	});

	// Service initialization (standalone mode)
	onMount(async () => {
		if (useContext) {
			loading = false;
			// Expose toggle function to parent even in context mode
			onTogglePlaybackRef?.(() => ctx?.actions?.onPlaybackToggle());
			return;
		}

		try {
			motionLoader = getSequenceMotionLoader();
			controller = getAnimationPlaybackController();
			loading = false;
			// Expose toggle function to parent for keyboard control
			onTogglePlaybackRef?.(togglePlayback);
		} catch (err) {
			console.error("Failed to initialize animation player:", err);
			error = "Failed to load animation";
			loading = false;
		}
	});

	onDestroy(() => {
		if (!useContext) {
			controller?.dispose();
			animState?.dispose();
		}
	});

	// Watch sequence changes (standalone mode)
	// IMPORTANT: Explicitly track controller and motionLoader so effect re-runs when they're set
	$effect(() => {
		// Track dependencies to ensure effect re-runs when controller/motionLoader are set
		void controller;
		void motionLoader;

		if (useContext || !controller || !motionLoader) return;

		// Create content hash to detect edits (same ID, different content)
		// Include steps data to detect any beat modifications
		const stepsHash = sequence?.steps?.map(s =>
			`${s.letter}:${s.duration}:${s.startPosition ? 'start' : ''}`
		).join('|') ?? '';

		const seqId = sequence?.id
			? `${sequence.id}:${sequence.ownerId ?? "local"}:${stepsHash}`
			: `${sequence?.word ?? ""}:${stepsHash}`;

		if (seqId === lastSequenceId) return;

		untrack(async () => {
			lastSequenceId = seqId ?? null;
			if (animState?.isPlaying) controller?.togglePlayback();
			animState?.reset();

			const fullSeq = await motionLoader!.ensureMotionData(sequence);
			if (!fullSeq) {
				error = "Failed to load sequence";
				return;
			}

			animState?.setShouldLoop(true);
			const ok = controller!.initialize(fullSeq, animState!);
			if (!ok) {
				error = "Failed to initialize playback";
				return;
			}

			// Expose controller + state to parent for external sync
			onControllerReady?.(controller!, animState!);

			if (autoPlay) {
				setTimeout(() => controller?.togglePlayback(), 300);
			}
		});
	});

	// Action handlers - delegate to context or controller
	function togglePlayback() {
		useContext ? ctx?.actions?.onPlaybackToggle() : controller?.togglePlayback();
	}

	function handleBpmChange(newBpm: number) {
		bpm = newBpm;
		const speed = newBpm / DEFAULT_BPM;
		useContext ? ctx?.actions?.onSpeedChange(speed) : controller?.setSpeed(speed);
	}

	function handleCanvasReady(canvas: HTMLCanvasElement | null) {
		onCanvasReady?.(canvas);
		if (useContext) ctx?.actions?.onCanvasReady(canvas);
	}

	// Step handlers
	const stepHalfBack = () => useContext ? ctx?.actions?.onStepHalfBeatBackward() : controller?.stepHalfBeatBackward();
	const stepHalfFwd = () => useContext ? ctx?.actions?.onStepHalfBeatForward() : controller?.stepHalfBeatForward();
	const restartToStart = () => {
		if (useContext) {
			ctx?.actions?.onStepFullBeatBackward();
		} else {
			// seekToStep preserves playback state - if playing, continues from start
			controller?.seekToStep(0);
		}
	};
	const stepFullFwd = () => useContext ? ctx?.actions?.onStepFullBeatForward() : controller?.stepFullBeatForward();
	const setPlaybackMode = (m: "continuous" | "step") => ctx?.actions.onPlaybackModeChange(m);
	const setStepSize = (s: 0.5 | 1) => ctx?.actions.onStepPlaybackStepSizeChange(s);
	const cancelExport = () => ctx?.actions.onCancelExport();
</script>

<div class="animation-player" class:horizontal={layout === "horizontal"}>
	{#if loading}
		<div class="state-msg"><ProgressRing percent={-1} size={32} strokeWidth={3} /><span>Loading animation...</span></div>
	{:else if error}
		<div class="state-msg error"><span>{error}</span></div>
	{:else}
		{#if layout === "horizontal"}
			<!-- Horizontal mode: canvas + sidebar in a row -->
			<div class="horizontal-row">
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
						word={hideWordHeader ? null : (sequenceData?.word ?? sequence?.word ?? null)}
						onPlaybackToggle={togglePlayback}
						{trailSettings}
						onCanvasReady={handleCanvasReady}
						{previewDarkMode}
						{bluePropType}
						{redPropType}
						progressBarVariant="minimal"
						{hideProgressBar}
					/>

					{#if isExporting && exportProgress}
						<ExportProgressOverlay progress={exportProgress} onCancel={cancelExport} />
					{/if}
				</div>

				<HorizontalSidebar
					{controlsLevel}
					{useContext}
					{isPlaying}
					bind:bpm
					{playbackMode}
					stepSize={stepSize}
					onBpmChange={handleBpmChange}
					onPlaybackModeChange={setPlaybackMode}
					onStepSizeChange={setStepSize}
					onPlaybackToggle={togglePlayback}
				/>
			</div>

			{#if showControls}
				<HorizontalTransportRow
					{isPlaying}
					onPlaybackToggle={togglePlayback}
					onStepHalfBack={stepHalfBack}
					onStepHalfFwd={stepHalfFwd}
					onRestartToStart={restartToStart}
					onStepFullFwd={stepFullFwd}
				/>
			{/if}
		{:else}
			<!-- Vertical mode: original layout -->
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
					word={hideWordHeader ? null : (sequenceData?.word ?? sequence?.word ?? null)}
					onPlaybackToggle={togglePlayback}
					{trailSettings}
					onCanvasReady={handleCanvasReady}
					{previewDarkMode}
					{bluePropType}
					{redPropType}
					progressBarVariant="minimal"
					{hideProgressBar}
				/>

				{#if isExporting && exportProgress}
					<ExportProgressOverlay progress={exportProgress} onCancel={cancelExport} />
				{/if}
			</div>

			{#if showControls}
				<VerticalModeControls
					{controlsLevel}
					{useContext}
					{isPlaying}
					{bpm}
					{playbackMode}
					stepSize={stepSize}
					onPlaybackToggle={togglePlayback}
					onBpmChange={handleBpmChange}
					onPlaybackModeChange={setPlaybackMode}
					onStepSizeChange={setStepSize}
					onStepHalfBack={stepHalfBack}
					onStepHalfFwd={stepHalfFwd}
					onRestartToStart={restartToStart}
					onStepFullFwd={stepFullFwd}
				/>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.animation-player {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
		gap: 12px;
		padding: 8px;
		box-sizing: border-box;
	}

	.animation-player.horizontal {
		flex-direction: column;
		gap: 12px;
	}

	.horizontal-row {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: 16px;
		flex: 1;
		min-height: 0;
	}

	.horizontal-row .canvas-wrap {
		flex: 1;
		min-width: 0;
		max-width: none;
	}

	.canvas-wrap {
		position: relative;
		flex: 1;
		min-height: 0;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		overflow: visible;
		background: transparent;
		padding: 4px;
		box-sizing: border-box;
	}

	.state-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		width: 100%;
		height: 100%;
		min-height: 120px;
		color: var(--theme-text-dim);
		font-size: var(--font-size-sm);
	}

	.state-msg.error {
		color: var(--semantic-error, #fca5a5);
	}

	@media (min-width: 1200px) {
		.animation-player {
			gap: 8px;
			padding: 4px;
		}
	}

</style>
