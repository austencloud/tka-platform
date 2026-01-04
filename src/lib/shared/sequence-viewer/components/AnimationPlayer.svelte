<!--
  AnimationPlayer.svelte

  Unified animation player component for use in both SequenceViewer contexts:
  - Gallery detail panels (standalone mode with minimal controls)
  - ShareHub/Export panels (external control mode with full controls)

  Features:
  - Configurable controls level: minimal, standard, full
  - Can manage its own state (standalone) or use external callbacks
  - Lazy-loads animation services on demand
  - Supports all playback modes and BPM presets
  - Full mode includes: playback mode, visibility toggles, loop count, step settings
-->
<script lang="ts">
	import { onMount, onDestroy, untrack } from "svelte";
	import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
	import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";
	import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
	import SettingsTogglePanel from "$lib/features/compose/components/controls/SettingsTogglePanel.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
	import type { PlaybackMode, StepPlaybackStepSize } from "$lib/features/compose/state/animation-panel-state.svelte";
	import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
	import { resolve, loadFeatureModule } from "$lib/shared/inversify/di";
	import { TYPES } from "$lib/shared/inversify/types";
	import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
	import { Letter } from "$lib/shared/foundation/domain/models/Letter";
	import type { ControlsLevel, ExportProgress } from "../domain/types";

	const DEFAULT_BPM = 60;

	let {
		sequence,
		autoPlay = true,
		showControls = true,
		controlsLevel = "minimal" as ControlsLevel,

		// External control mode
		externalControl = false,
		isPlaying: externalIsPlaying = false,
		speed: externalSpeed = 1,
		currentBeat: externalCurrentBeat = 0,
		bluePropState: externalBluePropState = null,
		redPropState: externalRedPropState = null,
		onPlaybackToggle: externalPlaybackToggle,
		onSpeedChange: externalSpeedChange,
		onStepForward,
		onStepBackward,

		// Full step controls (for full mode)
		onStepHalfBeatForward,
		onStepHalfBeatBackward,
		onStepFullBeatForward,
		onStepFullBeatBackward,

		// Playback mode controls (full mode)
		playbackMode = "continuous" as PlaybackMode,
		stepPlaybackPauseMs = 300,
		stepPlaybackStepSize = 1 as StepPlaybackStepSize,
		onPlaybackModeChange,
		onStepPlaybackPauseMsChange,
		onStepPlaybackStepSizeChange,

		// Visibility toggles (full mode)
		blueMotionVisible = true,
		redMotionVisible = true,
		onToggleBlue,
		onToggleRed,

		// Loop count (full mode)
		isCircular = false,
		loopCount = 1,
		onLoopCountChange,

		// Export controls (full mode only)
		isExporting = false,
		exportProgress = null as ExportProgress | null,
		onExport,
		onCancelExport,
		onCanvasReady,
	}: {
		sequence: SequenceData;
		autoPlay?: boolean;
		showControls?: boolean;
		controlsLevel?: ControlsLevel;
		externalControl?: boolean;
		isPlaying?: boolean;
		speed?: number;
		currentBeat?: number;
		bluePropState?: any;
		redPropState?: any;
		onPlaybackToggle?: () => void;
		onSpeedChange?: (speed: number) => void;
		onStepForward?: () => void;
		onStepBackward?: () => void;
		// Full step controls
		onStepHalfBeatForward?: () => void;
		onStepHalfBeatBackward?: () => void;
		onStepFullBeatForward?: () => void;
		onStepFullBeatBackward?: () => void;
		// Playback mode
		playbackMode?: PlaybackMode;
		stepPlaybackPauseMs?: number;
		stepPlaybackStepSize?: StepPlaybackStepSize;
		onPlaybackModeChange?: (mode: PlaybackMode) => void;
		onStepPlaybackPauseMsChange?: (pauseMs: number) => void;
		onStepPlaybackStepSizeChange?: (stepSize: StepPlaybackStepSize) => void;
		// Visibility
		blueMotionVisible?: boolean;
		redMotionVisible?: boolean;
		onToggleBlue?: () => void;
		onToggleRed?: () => void;
		// Loop count
		isCircular?: boolean;
		loopCount?: number;
		onLoopCountChange?: (count: number) => void;
		// Export
		isExporting?: boolean;
		exportProgress?: ExportProgress | null;
		onExport?: () => void;
		onCancelExport?: () => void;
		onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
	} = $props();

	// Services
	let sequenceService: ISequenceRepository | null = null;
	let playbackController: IAnimationPlaybackController | null = null;
	let servicesReady = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Internal animation state (used in standalone mode)
	const animationState = createAnimationPanelState();

	// Track last loaded sequence
	let lastLoadedSequenceId: string | null = null;

	// Local reactive state
	let internalIsPlaying = $state(false);
	let bpm = $state(DEFAULT_BPM);

	// Effective state - uses external or internal based on mode
	const isPlaying = $derived(
		externalControl ? externalIsPlaying : internalIsPlaying
	);
	const currentBeat = $derived(
		externalControl ? externalCurrentBeat : animationState.currentBeat
	);

	// Sync playing state from animation state in standalone mode
	$effect(() => {
		if (externalControl) return;
		const checkPlaying = () => {
			const current = animationState.isPlaying;
			if (current !== internalIsPlaying) {
				internalIsPlaying = current;
			}
		};
		checkPlaying();
		const interval = setInterval(checkPlaying, 50);
		return () => clearInterval(interval);
	});

	// Derive current letter for display
	let currentLetter = $derived.by(() => {
		const seqData = externalControl
			? sequence
			: animationState.sequenceData || sequence;
		if (!seqData) return null;

		if (currentBeat < 1) {
			return getStartPositionLetter(seqData);
		}

		if (seqData.beats?.length > 0) {
			const beatIndex = Math.max(0, Math.floor(currentBeat) - 1);
			const clampedIndex = Math.min(beatIndex, seqData.beats.length - 1);
			return seqData.beats[clampedIndex]?.letter || null;
		}

		return null;
	});

	// Derive current beat data for canvas
	let currentBeatData = $derived.by(() => {
		const seqData = externalControl
			? sequence
			: animationState.sequenceData || sequence;
		if (!seqData) return null;

		if (currentBeat < 1 && seqData.startPosition) {
			return seqData.startPosition;
		}

		if (seqData.beats?.length > 0) {
			const beatIndex = Math.max(0, Math.floor(currentBeat) - 1);
			const clampedIndex = Math.min(beatIndex, seqData.beats.length - 1);
			return seqData.beats[clampedIndex] || null;
		}

		return null;
	});

	// Grid mode from sequence
	let gridMode = $derived(
		sequence?.gridMode ?? animationState.sequenceData?.gridMode
	);

	// Get Greek letter for start position
	function getStartPositionLetter(seq: SequenceData): Letter | null {
		if (seq.startingPositionGroup) {
			const group = seq.startingPositionGroup.toLowerCase();
			if (group === "alpha") return Letter.ALPHA;
			if (group === "beta") return Letter.BETA;
			if (group === "gamma") return Letter.GAMMA;
		}

		const spLetter = seq.startPosition?.letter;
		if (
			spLetter === Letter.ALPHA ||
			spLetter === Letter.BETA ||
			spLetter === Letter.GAMMA
		) {
			return spLetter;
		}

		const firstBeat = seq.beats?.[0];
		if (firstBeat) {
			const startPos = firstBeat.startPosition || (firstBeat as any).startPos;
			if (startPos && typeof startPos === "string") {
				const posLower = startPos.toLowerCase();
				if (posLower.startsWith("alpha")) return Letter.ALPHA;
				if (posLower.startsWith("beta")) return Letter.BETA;
				if (posLower.startsWith("gamma")) return Letter.GAMMA;
			}
		}

		return null;
	}

	// Load services on mount
	onMount(async () => {
		try {
			await loadFeatureModule("animate");

			sequenceService = resolve<ISequenceRepository>(TYPES.ISequenceRepository);
			playbackController = resolve<IAnimationPlaybackController>(
				TYPES.IAnimationPlaybackController
			);
			servicesReady = true;
		} catch (err) {
			console.error("Failed to initialize animation player:", err);
			error = "Failed to load animation";
			loading = false;
		}
	});

	onDestroy(() => {
		if (!externalControl) {
			playbackController?.dispose();
			animationState.dispose();
		}
	});

	// Watch for sequence changes - load animation data in both modes
	// External control mode: load data but don't auto-play (parent controls playback)
	// Standalone mode: load data and optionally auto-play
	$effect(() => {
		const sequenceId = sequence?.id || sequence?.word || sequence?.name;

		if (sequence && servicesReady && sequenceId !== lastLoadedSequenceId) {
			untrack(() => {
				if (animationState.isPlaying) {
					playbackController?.togglePlayback();
				}
				animationState.reset();
				lastLoadedSequenceId = sequenceId ?? null;
				// In external control mode, never auto-play (parent controls playback)
				// In standalone mode, respect the autoPlay prop
				loadAnimation(externalControl ? false : autoPlay);
			});
		}
	});

	async function loadAnimation(shouldAutoPlay: boolean = false) {
		if (!sequenceService || !playbackController || !sequence) return;

		loading = true;
		error = null;

		try {
			const fullSequence = await loadSequenceData(sequence);

			if (!fullSequence) {
				throw new Error("Failed to load sequence data");
			}

			animationState.setShouldLoop(true);
			const success = playbackController.initialize(
				fullSequence,
				animationState
			);

			if (!success) {
				throw new Error("Failed to initialize playback");
			}

			if (shouldAutoPlay) {
				setTimeout(() => {
					playbackController?.togglePlayback();
				}, 300);
			}
		} catch (err) {
			console.error("Failed to load animation:", err);
			error = err instanceof Error ? err.message : "Failed to load animation";
		} finally {
			loading = false;
		}
	}

	async function loadSequenceData(
		seq: SequenceData
	): Promise<SequenceData | null> {
		if (!sequenceService) return null;

		const hasMotionData = (s: SequenceData) =>
			Array.isArray(s.beats) &&
			s.beats.length > 0 &&
			s.beats.some((beat) => beat?.motions?.blue && beat?.motions?.red);

		if (hasMotionData(seq)) {
			return seq;
		}

		const identifier = seq.word || seq.name || seq.id;
		if (identifier) {
			const loaded = await sequenceService.getSequence(identifier);
			if (loaded && hasMotionData(loaded)) {
				return loaded;
			}
		}

		return seq;
	}

	// Playback handlers
	function togglePlayback() {
		if (externalControl && externalPlaybackToggle) {
			externalPlaybackToggle();
		} else {
			playbackController?.togglePlayback();
		}
	}

	function handleBpmChange(newBpm: number) {
		bpm = newBpm;
		const newSpeed = newBpm / DEFAULT_BPM;
		if (externalControl && externalSpeedChange) {
			externalSpeedChange(newSpeed);
		} else {
			playbackController?.setSpeed(newSpeed);
		}
	}

	function handleStepForward() {
		if (externalControl && onStepForward) {
			onStepForward();
		} else {
			// Internal step logic would go here
		}
	}

	function handleStepBackward() {
		if (externalControl && onStepBackward) {
			onStepBackward();
		} else {
			// Internal step logic would go here
		}
	}

	function handleCanvasReady(canvas: HTMLCanvasElement | null) {
		onCanvasReady?.(canvas);
	}

	// Export progress helpers
	const progressPercent = $derived(
		exportProgress ? Math.round(exportProgress.progress * 100) : 0
	);
	const progressStage = $derived(
		exportProgress?.stage === "capturing"
			? "Capturing frames..."
			: exportProgress?.stage === "encoding"
				? "Encoding video..."
				: exportProgress?.stage === "complete"
					? "Complete!"
					: exportProgress?.stage === "error"
						? "Error"
						: ""
	);
</script>

<div class="animation-player" class:has-controls={showControls}>
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<span>Loading animation...</span>
		</div>
	{:else if error}
		<div class="error-state">
			<span>{error}</span>
			<button class="retry-btn" onclick={() => loadAnimation()}>Retry</button>
		</div>
	{:else}
		<!-- Animation Canvas -->
		<div class="canvas-container">
			<AnimatorCanvas
				blueProp={externalControl && externalBluePropState ? externalBluePropState : animationState.bluePropState}
				redProp={externalControl && externalRedPropState ? externalRedPropState : animationState.redPropState}
				gridVisible={true}
				{gridMode}
				letter={currentLetter}
				beatData={currentBeatData}
				sequenceData={externalControl ? sequence : animationState.sequenceData}
				{isPlaying}
				onPlaybackToggle={togglePlayback}
				trailSettings={animationSettings.trail}
				onCanvasReady={handleCanvasReady}
			/>

			<!-- Export Progress Overlay -->
			{#if isExporting && exportProgress}
				<div class="export-overlay">
					<div class="export-progress-card">
						<div class="progress-header">
							<span class="progress-stage">{progressStage}</span>
							{#if exportProgress.stage !== "complete" && exportProgress.stage !== "error"}
								<button
									class="cancel-button"
									onclick={() => onCancelExport?.()}
									aria-label="Cancel export"
								>
									<i class="fas fa-times" aria-hidden="true"></i>
								</button>
							{/if}
						</div>
						<div class="progress-bar-container">
							<div class="progress-bar" style="width: {progressPercent}%"
							></div>
						</div>
						<span class="progress-percent">{progressPercent}%</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Controls -->
		{#if showControls}
			{#if controlsLevel === "full"}
				<!-- Full Controls Mode (for ShareHub/Export) -->
				<div class="controls-full">
					<!-- Transport Controls Row -->
					<div class="control-row playback-row">
						<TransportControls
							{isPlaying}
							onPlaybackToggle={togglePlayback}
							onStepHalfBeatBackward={onStepHalfBeatBackward ?? handleStepBackward}
							onStepHalfBeatForward={onStepHalfBeatForward ?? handleStepForward}
							onStepFullBeatBackward={onStepFullBeatBackward}
							onStepFullBeatForward={onStepFullBeatForward}
						/>
					</div>

					<!-- Settings Toggle Panel (BPM, Playback Mode, Step Settings) -->
					<SettingsTogglePanel
						propType={null}
						bluePropType={null}
						redPropType={null}
						{bpm}
						{playbackMode}
						{stepPlaybackStepSize}
						{isPlaying}
						onBpmChange={handleBpmChange}
						onPlaybackModeChange={onPlaybackModeChange}
						onStepPlaybackStepSizeChange={onStepPlaybackStepSizeChange}
						onPlaybackToggle={togglePlayback}
					/>

					<!-- Loop Count (for circular sequences) -->
					{#if isCircular && onLoopCountChange}
						<div class="control-row loop-count-row">
							<span class="loop-label">Loops:</span>
							<div class="loop-stepper">
								<button
									class="loop-btn"
									onclick={() => onLoopCountChange?.(Math.max(1, loopCount - 1))}
									disabled={loopCount <= 1}
									aria-label="Decrease loop count"
								>−</button>
								<span class="loop-value">{loopCount}</span>
								<button
									class="loop-btn"
									onclick={() => onLoopCountChange?.(Math.min(10, loopCount + 1))}
									disabled={loopCount >= 10}
									aria-label="Increase loop count"
								>+</button>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Minimal/Standard Controls -->
				<div class="controls" class:minimal={controlsLevel === "minimal"}>
					<!-- Play/Pause Button -->
					<button
						class="control-btn play-btn"
						onclick={togglePlayback}
						aria-label={isPlaying ? "Pause" : "Play"}
					>
						{#if isPlaying}
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M8 5v14l11-7z" />
							</svg>
						{/if}
					</button>

					<!-- Step Controls (standard only) -->
					{#if controlsLevel === "standard"}
						<div class="step-controls">
							<button
								class="control-btn step-btn"
								onclick={handleStepBackward}
								aria-label="Step backward"
							>
								<svg viewBox="0 0 24 24" fill="currentColor">
									<path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
								</svg>
							</button>
							<button
								class="control-btn step-btn"
								onclick={handleStepForward}
								aria-label="Step forward"
							>
								<svg viewBox="0 0 24 24" fill="currentColor">
									<path d="M18 6h-2v12h2V6zm-3.5 6L6 6v12l8.5-6z" />
								</svg>
							</button>
						</div>
					{/if}

					<!-- BPM Controls -->
					<div class="bpm-controls">
						<BpmChips {bpm} variant="compact" onBpmChange={handleBpmChange} />
					</div>
				</div>
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
		gap: 8px;
	}

	.canvas-container {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		overflow: hidden;
		position: relative;
	}

	/* Full Controls Mode */
	.controls-full {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1.5px solid var(--theme-stroke);
		border-radius: 14px;
		box-shadow:
			0 4px 20px var(--theme-shadow),
			inset 0 1px 0 var(--theme-card-bg);
	}

	.control-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.playback-row {
		justify-content: center;
		gap: 8px;
	}

	/* Loop Count Row */
	.loop-count-row {
		justify-content: center;
		gap: 12px;
		padding: 8px 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 10px;
	}

	.loop-label {
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		font-weight: 500;
	}

	.loop-stepper {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.loop-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
		border-radius: 8px;
		color: var(--theme-text, white);
		font-size: 18px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.loop-btn:hover:not(:disabled) {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.loop-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.loop-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.loop-value {
		font-size: var(--font-size-lg, 18px);
		font-weight: 600;
		color: var(--theme-text, white);
		min-width: 24px;
		text-align: center;
	}

	/* Standard/Minimal Controls */
	.controls {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
	}

	.controls.minimal {
		gap: 8px;
		padding: 6px;
	}

	.step-controls {
		display: flex;
		gap: 4px;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 50%;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.control-btn svg {
		width: 20px;
		height: 20px;
	}

	.control-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.control-btn:active {
		transform: scale(0.95);
	}

	.play-btn {
		width: var(--min-touch-target, 44px);
		height: var(--min-touch-target, 44px);
		background: linear-gradient(135deg, var(--semantic-info) 0%, #2563eb 100%);
		border-color: transparent;
	}

	.play-btn:hover {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
	}

	.step-btn {
		width: 36px;
		height: 36px;
	}

	.step-btn svg {
		width: 16px;
		height: 16px;
	}

	.bpm-controls {
		flex: 1;
		min-width: 0;
	}

	/* Export Progress Overlay */
	.export-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	.export-progress-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px 32px;
		background: var(--theme-card-bg);
		border: 1px solid var(--theme-stroke);
		border-radius: 16px;
		min-width: 200px;
	}

	.progress-header {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		justify-content: space-between;
	}

	.progress-stage {
		font-size: var(--font-size-min);
		color: var(--theme-text);
		font-weight: 500;
	}

	.cancel-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--theme-stroke);
		border-radius: 6px;
		color: var(--theme-text-dim);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-button:hover {
		background: var(--semantic-error);
		border-color: var(--semantic-error);
		color: white;
	}

	.progress-bar-container {
		width: 100%;
		height: 6px;
		background: var(--theme-stroke);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: var(--theme-accent);
		transition: width 0.1s ease;
	}

	.progress-percent {
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--theme-text);
	}

	/* Landscape layout */
	@media (orientation: landscape) and (min-width: 600px) and (min-height: 400px) {
		.animation-player {
			flex-direction: row;
			gap: 12px;
		}

		.canvas-container {
			flex: 1;
			min-width: 0;
			border-radius: 12px;
		}

		.controls {
			flex-direction: column;
			width: 140px;
			flex-shrink: 0;
			padding: 12px;
			border-radius: 12px;
			gap: 12px;
			justify-content: flex-start;
			align-items: stretch;
		}

		.controls.minimal {
			width: 120px;
		}

		.control-btn.play-btn {
			width: 100%;
			height: 48px;
			border-radius: 10px;
		}

		.step-controls {
			justify-content: center;
		}

		.bpm-controls {
			flex: none;
			width: 100%;
		}

		.bpm-controls :global(.bpm-chips.compact) {
			flex-wrap: wrap;
			gap: 6px;
		}

		.bpm-controls :global(.preset-chip) {
			flex: 1 1 calc(50% - 3px);
			min-width: 0;
			padding: 10px 4px;
		}

		.bpm-controls :global(.custom-chip) {
			flex: 1 1 100%;
			max-width: none;
		}
	}

	/* Loading/Error states */
	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 32px;
		height: 100%;
		color: var(--theme-text-dim);
		font-size: var(--font-size-sm);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--theme-stroke);
		border-top-color: rgba(59, 130, 246, 0.8);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-state {
		color: rgba(252, 165, 165, 1);
	}

	.retry-btn {
		padding: 8px 16px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		color: white;
		font-size: var(--font-size-compact);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.retry-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	@media (prefers-reduced-motion: reduce) {
		.control-btn,
		.retry-btn,
		.cancel-button {
			transition: none;
		}

		.spinner {
			animation: none;
		}

		.progress-bar {
			transition: none;
		}
	}
</style>
