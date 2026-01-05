<!--
  AnimationPlayer.svelte

  Thin coordinator for sequence animation playback.
  Composes existing primitives - does NOT duplicate their functionality.

  Modes:
  - Standalone: Creates own AnimationPanelState, loads services internally
  - External: Consumes AnimationExportContext from parent

  Primitives used:
  - AnimatorCanvas (rendering)
  - TransportControls (play/step buttons)
  - BpmChips (speed selection)
  - SettingsTogglePanel (full mode settings)
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
	import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
	import { resolve, loadFeatureModule } from "$lib/shared/inversify/di";
	import { TYPES } from "$lib/shared/inversify/types";
	import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
	import { tryGetAnimationExportContext } from "$lib/shared/share-hub/context/animation-export-context.svelte";
	import type { ControlsLevel } from "../domain/types";

	const DEFAULT_BPM = 60;

	let {
		sequence,
		autoPlay = true,
		showControls = true,
		controlsLevel = "minimal" as ControlsLevel,
		externalControl = false,
		onCanvasReady,
		// Preview-only dark mode - when provided, bypasses global setting
		previewDarkMode = null,
	}: {
		sequence: SequenceData;
		autoPlay?: boolean;
		showControls?: boolean;
		controlsLevel?: ControlsLevel;
		externalControl?: boolean;
		onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
		previewDarkMode?: boolean | null;
	} = $props();

	// Context for external control mode - use $derived so these update if props change
	const ctx = $derived(externalControl ? tryGetAnimationExportContext() : null);
	const useContext = $derived(externalControl && !!ctx);

	// Services (standalone mode only)
	let controller: IAnimationPlaybackController | null = null;
	let sequenceRepo: ISequenceRepository | null = null;

	// State (standalone mode only) - created once, not reactive to useContext changes
	// (if useContext changes mid-lifecycle, animState persists for cleanup)
	const animState = createAnimationPanelState();

	// UI state
	let loading = $state(true);
	let error = $state<string | null>(null);
	let bpm = $state(DEFAULT_BPM);
	let lastSequenceId: string | null = null;

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

	// Derived: current letter for TKA glyph display
	const letter = $derived(beatData?.letter ?? null);

	const gridMode = $derived(sequenceData?.gridMode ?? sequence?.gridMode);

	// Service initialization (standalone mode)
	onMount(async () => {
		if (useContext) {
			loading = false;
			return;
		}

		try {
			await loadFeatureModule("animate");
			sequenceRepo = resolve<ISequenceRepository>(TYPES.ISequenceRepository);
			controller = resolve<IAnimationPlaybackController>(TYPES.IAnimationPlaybackController);
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
		if (useContext || !controller || !sequenceRepo) return;
		const seqId = sequence?.id || sequence?.word || sequence?.name;
		if (seqId === lastSequenceId) return;

		untrack(async () => {
			lastSequenceId = seqId ?? null;
			if (animState?.isPlaying) controller?.togglePlayback();
			animState?.reset();

			// Load full sequence data if needed
			const fullSeq = await loadFullSequence(sequence);
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

	async function loadFullSequence(seq: SequenceData): Promise<SequenceData | null> {
		if (!sequenceRepo) return seq;
		const hasMotions = seq.beats?.some(b => b?.motions?.blue && b?.motions?.red);
		if (hasMotions) return seq;

		const id = seq.word || seq.name || seq.id;
		if (id) {
			const loaded = await sequenceRepo.getSequence(id);
			if (loaded?.beats?.some(b => b?.motions?.blue && b?.motions?.red)) return loaded;
		}
		return seq;
	}

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

	// Context-only handlers for full mode
	const stepHalfBack = () => ctx?.actions.onStepHalfBeatBackward();
	const stepHalfFwd = () => ctx?.actions.onStepHalfBeatForward();
	const stepFullBack = () => ctx?.actions.onStepFullBeatBackward();
	const stepFullFwd = () => ctx?.actions.onStepFullBeatForward();
	const setPlaybackMode = (m: any) => ctx?.actions.onPlaybackModeChange(m);
	const setStepSize = (s: any) => ctx?.actions.onStepPlaybackStepSizeChange(s);
	const cancelExport = () => ctx?.actions.onCancelExport();

	// Export progress display
	const progressPct = $derived(exportProgress ? Math.round(exportProgress.progress * 100) : 0);
	const progressLabel = $derived(
		exportProgress?.stage === "capturing" ? "Capturing..." :
		exportProgress?.stage === "encoding" ? "Encoding..." :
		exportProgress?.stage === "complete" ? "Done!" : ""
	);
</script>

<div class="animation-player">
	{#if loading}
		<div class="state-msg"><div class="spinner"></div><span>Loading...</span></div>
	{:else if error}
		<div class="state-msg error"><span>{error}</span></div>
	{:else}
		<div class="canvas-wrap">
			<AnimatorCanvas
				blueProp={bluePropState}
				redProp={redPropState}
				gridVisible={true}
				{gridMode}
				{letter}
				{beatData}
				{sequenceData}
				{isPlaying}
				word={sequenceData?.word ?? sequence?.word ?? null}
				onPlaybackToggle={togglePlayback}
				trailSettings={animationSettings.trail}
				onCanvasReady={handleCanvasReady}
				{previewDarkMode}
			/>

			{#if isExporting && exportProgress}
				<div class="export-overlay">
					<div class="export-card">
						<span>{progressLabel} {progressPct}%</span>
						<div class="progress-bar"><div style="width:{progressPct}%"></div></div>
						{#if exportProgress.stage !== "complete"}
							<button onclick={cancelExport}>Cancel</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		{#if showControls}
			{#if controlsLevel === "full" && useContext}
				<div class="controls-full">
					<TransportControls
						{isPlaying}
						onPlaybackToggle={togglePlayback}
						onStepHalfBeatBackward={stepHalfBack}
						onStepHalfBeatForward={stepHalfFwd}
						onStepFullBeatBackward={stepFullBack}
						onStepFullBeatForward={stepFullFwd}
					/>
					<SettingsTogglePanel
						propType={null}
						bluePropType={null}
						redPropType={null}
						{bpm}
						{playbackMode}
						stepPlaybackStepSize={stepSize}
						{isPlaying}
						onBpmChange={handleBpmChange}
						onPlaybackModeChange={setPlaybackMode}
						onStepPlaybackStepSizeChange={setStepSize}
						onPlaybackToggle={togglePlayback}
					/>
				</div>
			{:else}
				<div class="controls-simple">
					<button class="play-btn" onclick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
						{#if isPlaying}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
						{/if}
					</button>
					<BpmChips {bpm} variant="compact" onBpmChange={handleBpmChange} />
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
	/*
	 * Container-Query-Based Responsive Layout System
	 *
	 * Uses golden ratio (~62%) for canvas allocation.
	 * Adapts layout flow based on container aspect ratio:
	 * - Portrait (tall): vertical flow, canvas top
	 * - Square: balanced vertical flow
	 * - Landscape (wide): horizontal flow, canvas left
	 * - Ultra-wide (bottom sheet): compact horizontal
	 */

	.animation-player {
		/* Enable container queries */
		container-type: size;
		container-name: animation-player;

		/* Base layout - vertical by default */
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		gap: 12px;
		padding: 8px;
		box-sizing: border-box;

		/* Golden ratio proportions as CSS custom properties */
		--golden-major: 0.618;
		--golden-minor: 0.382;
		--canvas-max-ratio: 0.65; /* Max space for canvas */
		--controls-min: 100px; /* Minimum space for controls */
	}

	/* ========================================
	   CANVAS WRAPPER - Intelligent sizing
	   ======================================== */
	.canvas-wrap {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.2);

		/* Default: take available space but respect aspect ratio */
		flex: 0 1 auto;
		width: 100%;
		aspect-ratio: 1; /* Canvas content is always square */

		/* Constrain to leave room for controls */
		max-height: calc(100cqh - var(--controls-min) - 24px);
		max-width: 100%;

		/* Center within available space */
		align-self: center;
	}

	/* ========================================
	   PORTRAIT CONTAINERS (tall panels)
	   aspect-ratio < 0.85
	   ======================================== */
	@container animation-player (aspect-ratio < 0.85) {
		.animation-player {
			/* Vertical flow - canvas top, controls bottom */
			flex-direction: column;
			justify-content: flex-start;
			gap: 16px;
		}

		.canvas-wrap {
			/* Size canvas to ~60% of height, but respect width */
			max-height: calc(100cqh * var(--golden-major) - 20px);
			max-width: calc(100cqw - 16px);
			width: min(100%, calc(100cqh * var(--golden-major) - 20px));
		}

		.controls-simple,
		.controls-full {
			/* Controls get comfortable space at bottom */
			flex-shrink: 0;
			width: 100%;
		}
	}

	/* ========================================
	   SQUARE-ISH CONTAINERS
	   0.85 <= aspect-ratio <= 1.3
	   ======================================== */
	@container animation-player (0.85 <= aspect-ratio <= 1.3) {
		.animation-player {
			flex-direction: column;
			justify-content: center;
			align-items: center;
			gap: 16px;
		}

		.canvas-wrap {
			/* Balanced sizing - ~58% of smaller dimension */
			--size: min(100cqw - 16px, calc(100cqh * 0.58));
			width: var(--size);
			max-width: var(--size);
			max-height: var(--size);
		}

		.controls-simple,
		.controls-full {
			width: 100%;
		}
	}

	/* ========================================
	   LANDSCAPE CONTAINERS (wide panels)
	   aspect-ratio > 1.3
	   ======================================== */
	@container animation-player (aspect-ratio > 1.3) {
		.animation-player {
			/* Horizontal flow - canvas left, controls right */
			flex-direction: row;
			align-items: center;
			justify-content: center;
			gap: 20px;
		}

		.canvas-wrap {
			/* Size to height, leave room for controls on right */
			--size: min(calc(100cqh - 24px), calc(100cqw * var(--golden-major) - 30px));
			width: var(--size);
			max-width: var(--size);
			max-height: var(--size);
			flex-shrink: 0;
		}

		.controls-simple {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
			width: auto;
			min-width: 140px;
			max-width: 200px;
		}

		.controls-full {
			flex: 1;
			min-width: 180px;
			max-width: 280px;
			height: auto;
			max-height: calc(100cqh - 24px);
			overflow-y: auto;
		}
	}

	/* ========================================
	   ULTRA-WIDE / BOTTOM SHEET (very short)
	   height < 280px
	   ======================================== */
	@container animation-player (max-height: 280px) {
		.animation-player {
			flex-direction: row;
			align-items: center;
			padding: 8px 12px;
			gap: 16px;
		}

		.canvas-wrap {
			/* Compact canvas sized to height */
			--size: calc(100cqh - 24px);
			width: var(--size);
			max-width: var(--size);
			max-height: var(--size);
			flex-shrink: 0;
		}

		.controls-simple {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			justify-content: center;
			gap: 8px;
			flex: 1;
		}

		.controls-full {
			flex: 1;
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			justify-content: center;
			gap: 8px;
			padding: 8px;
			max-height: none;
			overflow: visible;
		}
	}

	/* ========================================
	   STATE MESSAGES (loading/error)
	   ======================================== */
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
		to { transform: rotate(360deg); }
	}

	/* ========================================
	   EXPORT OVERLAY
	   ======================================== */
	.export-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		border-radius: inherit;
	}

	.export-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px;
		background: var(--theme-card-bg);
		border: 1px solid var(--theme-stroke);
		border-radius: 12px;
		color: var(--theme-text);
	}

	.export-card .progress-bar {
		width: 160px;
		height: 6px;
		background: var(--theme-stroke);
		border-radius: 3px;
		overflow: hidden;
	}

	.export-card .progress-bar div {
		height: 100%;
		background: var(--theme-accent);
		transition: width 0.15s ease;
	}

	.export-card button {
		padding: 8px 16px;
		background: transparent;
		border: 1px solid var(--theme-stroke);
		border-radius: 6px;
		color: var(--theme-text-dim);
		cursor: pointer;
		min-height: 36px;
	}

	.export-card button:hover {
		background: var(--semantic-error);
		border-color: var(--semantic-error);
		color: white;
	}

	/* ========================================
	   SIMPLE CONTROLS (minimal mode)
	   ======================================== */
	.controls-simple {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: var(--theme-card-bg, rgba(0, 0, 0, 0.3));
		border: 1px solid var(--theme-stroke);
		border-radius: 12px;
		flex-shrink: 0;
	}

	.play-btn {
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--theme-accent, #3b82f6) 0%, color-mix(in srgb, var(--theme-accent, #3b82f6) 80%, black) 100%);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.play-btn svg {
		width: 22px;
		height: 22px;
	}

	.play-btn:hover {
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
	}

	.play-btn:active {
		transform: scale(0.98);
	}

	/* ========================================
	   FULL CONTROLS (export mode)
	   ======================================== */
	.controls-full {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		background: var(--theme-card-bg);
		border: 1.5px solid var(--theme-stroke);
		border-radius: 14px;
		flex-shrink: 0;
	}

	/* ========================================
	   ACCESSIBILITY & MOTION
	   ======================================== */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}

		.play-btn,
		.export-card .progress-bar div {
			transition: none;
		}
	}
</style>
