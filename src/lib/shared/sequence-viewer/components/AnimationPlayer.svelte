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
	import { onMount, onDestroy, untrack } from "svelte";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import type { ISequenceMotionLoader } from "../services/contracts/ISequenceMotionLoader";
	import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
	import { container } from "$lib/shared/di";
	import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
	import { tryGetAnimationExportContext } from "$lib/shared/share-hub/context/animation-export-context.svelte";
	import type { ControlsLevel } from "../domain/types";

	// Extracted components
	import ExportProgressOverlay from "./ExportProgressOverlay.svelte";
	import HorizontalSidebar from "./HorizontalSidebar.svelte";
	import HorizontalTransportRow from "./HorizontalTransportRow.svelte";
	import VerticalModeControls from "./VerticalModeControls.svelte";

	const DEFAULT_BPM = 60;

	let {
		sequence,
		autoPlay = true,
		showControls = true,
		controlsLevel = "minimal" as ControlsLevel,
		externalControl = false,
		onCanvasReady,
		previewDarkMode = null,
		layout = "vertical" as "vertical" | "horizontal",
	}: {
		sequence: SequenceData;
		autoPlay?: boolean;
		showControls?: boolean;
		controlsLevel?: ControlsLevel;
		externalControl?: boolean;
		onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
		previewDarkMode?: boolean | null;
		layout?: "vertical" | "horizontal";
	} = $props();

	// Context for external control mode
	const ctx = $derived(externalControl ? tryGetAnimationExportContext() : null);
	const useContext = $derived(externalControl && !!ctx);

	// Services (standalone mode only)
	let controller = $state<IAnimationPlaybackController | null>(null);
	let motionLoader = $state<ISequenceMotionLoader | null>(null);

	// State (standalone mode only)
	const animState = createAnimationPanelState();

	// UI state
	let loading = $state(true);
	let error = $state<string | null>(null);
	let bpm = $state(DEFAULT_BPM);
	let lastSequenceId = $state<string | null>(null);

	// Derived: effective state from context or internal
	const isPlaying = $derived(useContext ? ctx!.state.isPlaying : animState?.isPlaying ?? false);
	const currentBeat = $derived(useContext ? ctx!.state.currentBeat : animState?.currentBeat ?? 0);
	const bluePropState = $derived(useContext ? ctx!.state.bluePropState : animState?.bluePropState);
	const redPropState = $derived(useContext ? ctx!.state.redPropState : animState?.redPropState);
	const sequenceData = $derived(useContext ? ctx!.state.sequenceData ?? sequence : animState?.sequenceData ?? sequence);
	const playbackMode = $derived(useContext ? ctx!.state.playbackMode : "continuous" as const);
	const stepSize = $derived(useContext ? ctx!.state.stepPlaybackStepSize : 1 as const);
	const isExporting = $derived(useContext ? ctx!.state.isExporting : false);
	const exportProgress = $derived(useContext ? ctx!.state.exportProgress : null);

	// Derived: current beat data for canvas
	const beatData = $derived.by(() => {
		const seq = sequenceData;
		if (!seq) return null;
		if (currentBeat < 1) return seq.startPosition ?? null;
		const idx = Math.min(Math.max(0, Math.floor(currentBeat) - 1), (seq.beats?.length ?? 1) - 1);
		return seq.beats?.[idx] ?? null;
	});

	const letter = $derived(beatData?.letter ?? null);
	const gridMode = $derived(sequenceData?.gridMode ?? sequence?.gridMode);

	// Trail settings with fine-grained reactivity
	const trailSettings = $derived.by(() => {
		const t = animationSettings.trail;
		void t.enabled;
		void t.mode;
		void t.fadeDurationMs;
		void t.lineWidth;
		void t.maxOpacity;
		void t.glowEnabled;
		void t.trackingMode;
		return { ...t };
	});

	// Service initialization (standalone mode)
	onMount(async () => {
		if (useContext) {
			loading = false;
			return;
		}

		try {
			motionLoader = container.items.sequenceMotionLoader;
			controller = container.items.animationPlaybackController;
			loading = false;
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
	$effect(() => {
		if (useContext || !controller || !motionLoader) return;
		// Use id + ownerId to uniquely identify sequences (different creators can have same word)
		// Fall back to word + beats length as last resort for local sequences without ownerId
		const seqId = sequence?.id
			? `${sequence.id}:${sequence.ownerId ?? "local"}`
			: `${sequence?.word ?? ""}:${sequence?.beats?.length ?? 0}`;
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

			if (autoPlay) {
				setTimeout(() => controller?.togglePlayback(), 300);
			}
		});
	});

	// Action handlers - delegate to context or controller
	function togglePlayback() {
		useContext ? ctx!.actions.onPlaybackToggle() : controller?.togglePlayback();
	}

	function handleBpmChange(newBpm: number) {
		bpm = newBpm;
		const speed = newBpm / DEFAULT_BPM;
		useContext ? ctx!.actions.onSpeedChange(speed) : controller?.setSpeed(speed);
	}

	function handleCanvasReady(canvas: HTMLCanvasElement | null) {
		onCanvasReady?.(canvas);
		if (useContext) ctx!.actions.onCanvasReady(canvas);
	}

	// Step handlers
	const stepHalfBack = () => useContext ? ctx!.actions.onStepHalfBeatBackward() : controller?.stepHalfBeatBackward();
	const stepHalfFwd = () => useContext ? ctx!.actions.onStepHalfBeatForward() : controller?.stepHalfBeatForward();
	const stepFullBack = () => useContext ? ctx!.actions.onStepFullBeatBackward() : controller?.stepFullBeatBackward();
	const stepFullFwd = () => useContext ? ctx!.actions.onStepFullBeatForward() : controller?.stepFullBeatForward();
	const setPlaybackMode = (m: "continuous" | "step") => ctx?.actions.onPlaybackModeChange(m);
	const setStepSize = (s: 0.5 | 1) => ctx?.actions.onStepPlaybackStepSizeChange(s);
	const cancelExport = () => ctx?.actions.onCancelExport();
</script>

<div class="animation-player" class:horizontal={layout === "horizontal"}>
	{#if loading}
		<div class="state-msg"><div class="spinner"></div><span>Loading...</span></div>
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
						{beatData}
						{sequenceData}
						{currentBeat}
						{isPlaying}
						word={sequenceData?.word ?? sequence?.word ?? null}
						onPlaybackToggle={togglePlayback}
						{trailSettings}
						onCanvasReady={handleCanvasReady}
						{previewDarkMode}
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
					onStepFullBack={stepFullBack}
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
					{beatData}
					{sequenceData}
					{currentBeat}
					{isPlaying}
					word={sequenceData?.word ?? sequence?.word ?? null}
					onPlaybackToggle={togglePlayback}
					{trailSettings}
					onCanvasReady={handleCanvasReady}
					{previewDarkMode}
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
					onStepFullBack={stepFullBack}
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

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--theme-stroke);
		border-top-color: var(--theme-accent, #3b82f6);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (min-width: 1200px) {
		.animation-player {
			gap: 8px;
			padding: 4px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
</style>
