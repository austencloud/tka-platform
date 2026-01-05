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
	import PlaybackPane from "$lib/features/compose/components/controls/settings-panel/PlaybackPane.svelte";
	import VisualPane from "$lib/features/compose/components/controls/settings-panel/VisualPane.svelte";
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
		// Layout mode: "vertical" (default) stacks controls below canvas,
		// "horizontal" places controls to the right of canvas
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

<div class="animation-player" class:horizontal={layout === "horizontal"}>
	{#if loading}
		<div class="state-msg"><div class="spinner"></div><span>Loading...</span></div>
	{:else if error}
		<div class="state-msg error"><span>{error}</span></div>
	{:else}
		{#if layout === "horizontal" && controlsLevel === "full" && useContext}
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

				<!-- Sidebar with settings (no step controls - they're in the transport row below) -->
				<div class="horizontal-sidebar">
					<!-- Playback Settings -->
					<div class="sidebar-section">
						<PlaybackPane
							bind:bpm
							{playbackMode}
							stepPlaybackStepSize={stepSize}
							{isPlaying}
							onBpmChange={handleBpmChange}
							onPlaybackModeChange={setPlaybackMode}
							onStepPlaybackStepSizeChange={setStepSize}
							onPlaybackToggle={togglePlayback}
						/>
					</div>

					<!-- Visual Settings -->
					<div class="sidebar-section">
						<VisualPane propType={null} bluePropType={null} redPropType={null} />
					</div>
				</div>
			</div>

			<!-- Transport row: step controls + play button -->
			{#if showControls}
				<div class="horizontal-transport-row">
					<button class="step-btn" onclick={stepFullBack} aria-label="Previous beat">
						<i class="fas fa-angles-left" aria-hidden="true"></i>
					</button>
					<button class="step-btn" onclick={stepHalfBack} aria-label="Previous half beat">
						<i class="fas fa-chevron-left" aria-hidden="true"></i>
					</button>

					<button class="play-btn large" onclick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
						{#if isPlaying}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
						{/if}
					</button>

					<button class="step-btn" onclick={stepHalfFwd} aria-label="Next half beat">
						<i class="fas fa-chevron-right" aria-hidden="true"></i>
					</button>
					<button class="step-btn" onclick={stepFullFwd} aria-label="Next beat">
						<i class="fas fa-angles-right" aria-hidden="true"></i>
					</button>
				</div>
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
				<!-- Vertical mode: original tabbed layout -->
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

	/* Horizontal layout: canvas on left, controls on right */
	.animation-player.horizontal {
		flex-direction: row;
		gap: 16px;
	}

	.animation-player.horizontal .canvas-wrap {
		flex: 1;
		min-width: 0;
	}

	/* ========================================
	   HORIZONTAL LAYOUT
	   ======================================== */

	/* Horizontal mode: column layout with row inside */
	.animation-player.horizontal {
		flex-direction: column;
		gap: 12px;
	}

	/* Canvas + Sidebar row */
	.horizontal-row {
		display: flex;
		flex-direction: row;
		gap: 16px;
		flex: 1;
		min-height: 0;
	}

	/* Canvas takes remaining space after sidebar */
	.horizontal-row .canvas-wrap {
		flex: 1;
		min-width: 0;
		max-width: none;
	}

	/* Horizontal sidebar - fill container height, distribute content evenly */
	.horizontal-sidebar {
		display: flex;
		flex-direction: column;
		justify-content: stretch;
		gap: clamp(12px, 3cqh, 24px);
		width: clamp(240px, 32%, 300px);
		min-width: 240px;
		height: 100%;
		flex-shrink: 0;
		padding: clamp(14px, 3cqh, 24px);
		box-sizing: border-box;
		background: var(--theme-card-bg);
		border: 1.5px solid var(--theme-stroke);
		border-radius: 14px;
		overflow-y: auto;
		container-type: size;
		container-name: sidebar;
	}

	/* Sidebar sections - flex to fill and distribute space evenly */
	.sidebar-section {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.sidebar-section + .sidebar-section {
		padding-top: clamp(12px, 2.5cqh, 20px);
		border-top: 1px solid var(--theme-stroke);
	}

	/* Make child panes fill their section and distribute space */
	.horizontal-sidebar :global(.playback-pane),
	.horizontal-sidebar :global(.visual-pane) {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: 1;
		gap: clamp(10px, 2.5cqh, 18px);
	}

	/* All button groups stretch to fill available space */
	.horizontal-sidebar :global(.style-toggle),
	.horizontal-sidebar :global(.motion-toggles),
	.horizontal-sidebar :global(.element-grid),
	.horizontal-sidebar :global(.trail-presets),
	.horizontal-sidebar :global(.ends-selector) {
		flex: 1;
		display: flex;
		gap: 8px;
	}

	/* All interactive buttons - 48px minimum height, fill available space */
	.horizontal-sidebar :global(.style-btn),
	.horizontal-sidebar :global(.motion-btn),
	.horizontal-sidebar :global(.element-btn),
	.horizontal-sidebar :global(.trail-btn),
	.horizontal-sidebar :global(.ends-btn) {
		flex: 1;
		min-height: 48px;
		height: 100%;
	}

	/* Transport row: step buttons + play button */
	.horizontal-transport-row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--theme-card-bg);
		border: 1.5px solid var(--theme-stroke);
		border-radius: 14px;
		flex-shrink: 0;
	}

	.horizontal-transport-row .step-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: var(--theme-card-bg);
		border: 1.5px solid var(--theme-stroke);
		border-radius: 50%;
		color: var(--theme-text-dim);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.horizontal-transport-row .step-btn:hover {
		background: var(--theme-card-hover-bg);
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text);
		transform: scale(1.05);
	}

	.horizontal-transport-row .play-btn {
		width: 64px;
		height: 64px;
	}

	.horizontal-transport-row .play-btn svg {
		width: 28px;
		height: 28px;
	}

	/* Override PlaybackPane styles in sidebar - stack Flow/Step vertically */
	.horizontal-sidebar :global(.style-toggle) {
		flex-direction: column;
		gap: 8px;
	}

	.horizontal-sidebar :global(.style-btn) {
		min-height: 44px;
	}

	/* BPM adjuster - KEEP HORIZONTAL (don't override, just tighten) */
	.horizontal-sidebar :global(.bpm-adjuster) {
		gap: 8px;
	}

	.horizontal-sidebar :global(.bpm-display) {
		min-height: 44px;
		min-width: 70px;
		padding: 0 12px;
	}

	.horizontal-sidebar :global(.bpm-btn) {
		width: 36px;
		height: 36px;
	}

	/* BPM presets - compact 3-column grid */
	.horizontal-sidebar :global(.bpm-presets) {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}

	.horizontal-sidebar :global(.preset-chip) {
		min-height: 36px;
		padding: 6px 8px;
		font-size: 0.8rem;
	}

	/* Make sidebar sections more compact */
	.horizontal-sidebar :global(.bpm-control) {
		gap: 8px;
	}

	.horizontal-sidebar :global(.playback-pane) {
		gap: 10px;
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
		overflow: visible; /* Allow AnimatorCanvas border to show */
		background: transparent;
		/* Add padding so AnimatorCanvas border isn't clipped by parent overflow:hidden */
		padding: 4px;
		box-sizing: border-box;
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

	.controls-simple {
		display: flex;
		align-items: center;
		justify-content: center;
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

	.controls-full {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		background: var(--theme-card-bg);
		border: 1.5px solid var(--theme-stroke);
		border-radius: 14px;
		flex-shrink: 0;
		max-height: 200px;
		overflow-y: auto;
	}

	/* ========================================
	   WIDESCREEN OPTIMIZATIONS
	   ======================================== */
	@media (min-width: 1200px) {
		.animation-player {
			gap: 8px;
			padding: 4px;
		}

		.controls-simple {
			padding: 8px 10px;
			gap: 10px;
		}

		.play-btn {
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
		}

		.play-btn svg {
			width: 20px;
			height: 20px;
		}

		.controls-full {
			gap: 8px;
			padding: 10px;
			max-height: 180px;
		}
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
