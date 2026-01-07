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
	import { galleryPanelManager } from "$lib/features/discover/shared/state/gallery-panel-state.svelte";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IAnimationPlaybackController } from "$lib/features/compose/services/contracts/IAnimationPlaybackController";
	import type { IDiscoverLoader } from "$lib/features/discover/gallery/display/services/contracts/IDiscoverLoader";
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

	// Services (standalone mode only) - must be $state for $effect to track them
	let controller = $state<IAnimationPlaybackController | null>(null);
	let discoverLoader = $state<IDiscoverLoader | null>(null);

	// State (standalone mode only) - created once, not reactive to useContext changes
	// (if useContext changes mid-lifecycle, animState persists for cleanup)
	const animState = createAnimationPanelState();

	// UI state
	let loading = $state(true);
	let error = $state<string | null>(null);
	let bpm = $state(DEFAULT_BPM);
	let lastSequenceId = $state<string | null>(null);

	// Sidebar space detection - switch to compact mode if not enough room
	let sidebarRef: HTMLDivElement | null = $state(null);
	let sidebarHeight = $state(0);
	const COMPACT_THRESHOLD = 420; // px - below this, use tabbed compact mode
	const useCompactSidebar = $derived(sidebarHeight > 0 && sidebarHeight < COMPACT_THRESHOLD);

	// ResizeObserver for sidebar height
	$effect(() => {
		if (!sidebarRef) return;
		const observer = new ResizeObserver((entries) => {
			sidebarHeight = entries[0]?.contentRect.height ?? 0;
		});
		observer.observe(sidebarRef);
		return () => observer.disconnect();
	});

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

	// Trail settings - use $derived.by to ensure reactivity across module boundary
	// The animationSettings singleton uses $state inside a factory closure, which may not
	// propagate reactivity properly through simple getters. Reading individual properties
	// forces Svelte to track fine-grained changes.
	const trailSettings = $derived.by(() => {
		const t = animationSettings.trail;
		// Read individual properties to establish fine-grained dependency tracking
		void t.enabled;
		void t.mode;
		void t.fadeDurationMs;
		void t.lineWidth;
		void t.maxOpacity;
		void t.glowEnabled;
		void t.trackingMode;
		// Return a new object to ensure AnimatorCanvas sees the change
		return { ...t };
	});

	// Service initialization (standalone mode)
	onMount(async () => {
		if (useContext) {
			loading = false;
			return;
		}

		try {
			await loadFeatureModule("animate");
			discoverLoader = resolve<IDiscoverLoader>(TYPES.IDiscoverLoader);
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
		if (useContext || !controller || !discoverLoader) return;
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
		if (!discoverLoader) return seq;

		// Check if sequence already has motion data
		const hasMotions = seq.beats?.some(b => b?.motions?.blue && b?.motions?.red);
		if (hasMotions) return seq;

		// Try to load from gallery using word/name (gallery sequences)
		const galleryId = seq.word || seq.name;
		if (galleryId) {
			try {
				const loaded = await discoverLoader.loadFullSequenceData(galleryId);
				if (loaded?.beats?.some(b => b?.motions?.blue && b?.motions?.red)) {
					return loaded;
				}
			} catch (err) {
				console.warn(`Could not load sequence from gallery: ${galleryId}`, err);
			}
		}

		// Return original sequence if we couldn't load motion data
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

	// Step handlers - work in both context and standalone modes
	const stepHalfBack = () => useContext ? ctx!.actions.onStepHalfBeatBackward() : controller?.stepHalfBeatBackward();
	const stepHalfFwd = () => useContext ? ctx!.actions.onStepHalfBeatForward() : controller?.stepHalfBeatForward();
	const stepFullBack = () => useContext ? ctx!.actions.onStepFullBeatBackward() : controller?.stepFullBeatBackward();
	const stepFullFwd = () => useContext ? ctx!.actions.onStepFullBeatForward() : controller?.stepFullBeatForward();
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
						{isPlaying}
						word={sequenceData?.word ?? sequence?.word ?? null}
						onPlaybackToggle={togglePlayback}
						{trailSettings}
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

				<!-- Sidebar with settings - adapts based on mode and available height -->
				<div class="horizontal-sidebar" bind:this={sidebarRef}>
					{#if useContext && controlsLevel === "full"}
						<!-- External control mode: full playback + visual controls -->
						{#if useCompactSidebar}
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
						{:else}
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
							<div class="sidebar-section">
								<VisualPane propType={null} bluePropType={null} redPropType={null} />
							</div>
						{/if}
					{:else}
						<!-- Standalone mode: simplified BPM + visual controls -->
						<div class="sidebar-section standalone-controls">
							<BpmChips {bpm} variant="full" onBpmChange={handleBpmChange} />
						</div>
						<div class="sidebar-section">
							<VisualPane propType={null} bluePropType={null} redPropType={null} />
						</div>
					{/if}
				</div>
			</div>

			<!-- Transport row - always show step controls -->
			<!-- Full beat steps are adjacent to play (primary), half beat steps on outside (secondary) -->
			{#if showControls}
				<div class="horizontal-transport-row">
					<button class="step-btn step-secondary" onclick={stepHalfBack} aria-label="Previous half beat">
						<i class="fas fa-chevron-left" aria-hidden="true"></i>
					</button>
					<button class="step-btn step-primary" onclick={stepFullBack} aria-label="Previous beat">
						<i class="fas fa-angles-left" aria-hidden="true"></i>
					</button>

					<button class="play-btn large" onclick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
						{#if isPlaying}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
						{/if}
					</button>

					<button class="step-btn step-primary" onclick={stepFullFwd} aria-label="Next beat">
						<i class="fas fa-angles-right" aria-hidden="true"></i>
					</button>
					<button class="step-btn step-secondary" onclick={stepHalfFwd} aria-label="Next half beat">
						<i class="fas fa-chevron-right" aria-hidden="true"></i>
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
					{trailSettings}
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
				<!-- Vertical mode: full tabbed layout -->
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
			{:else if controlsLevel === "standard"}
				<!-- Vertical mode: standard controls with step buttons + settings gear -->
				<!-- Uses 3-column layout: spacer | centered transport | gear button -->
				<div class="controls-standard">
					<div class="controls-spacer"></div>
					<TransportControls
						{isPlaying}
						onPlaybackToggle={togglePlayback}
						onStepHalfBeatBackward={stepHalfBack}
						onStepHalfBeatForward={stepHalfFwd}
						onStepFullBeatBackward={stepFullBack}
						onStepFullBeatForward={stepFullFwd}
					/>
					<button
						class="settings-gear-btn"
						class:active={galleryPanelManager.isDetailExpanded}
						onclick={() => galleryPanelManager.toggleDetailExpanded()}
						aria-label={galleryPanelManager.isDetailExpanded ? "Collapse settings" : "Expand settings"}
						type="button"
					>
						<i class="fas fa-sliders" aria-hidden="true"></i>
					</button>
				</div>
			{:else}
				<!-- Vertical mode: minimal controls (play button + BPM + settings gear) -->
				<div class="controls-simple">
					<button class="play-btn" onclick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
						{#if isPlaying}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
						{/if}
					</button>
					<BpmChips {bpm} variant="compact" onBpmChange={handleBpmChange} />
					<button
						class="settings-gear-btn"
						class:active={galleryPanelManager.isDetailExpanded}
						onclick={() => galleryPanelManager.toggleDetailExpanded()}
						aria-label={galleryPanelManager.isDetailExpanded ? "Collapse settings" : "Expand settings"}
						type="button"
					>
						<i class="fas fa-sliders" aria-hidden="true"></i>
					</button>
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

	/* Canvas + Sidebar row - both items stretch to fill height */
	.horizontal-row {
		display: flex;
		flex-direction: row;
		align-items: stretch;
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

	/* Horizontal sidebar - adapts between expanded and compact modes */
	.horizontal-sidebar {
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
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
		overflow: hidden; /* Prevent overflow while measuring */
		container-type: size;
		container-name: sidebar;
	}

	/* Compact mode: SettingsTogglePanel (.settings-panel) fills the sidebar */
	.horizontal-sidebar :global(.settings-panel) {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	/* Compact mode: Make panes use vertical layout */
	.horizontal-sidebar :global(.settings-panel .visual-pane),
	.horizontal-sidebar :global(.settings-panel .playback-pane) {
		gap: 12px;
	}

	/* Compact mode: Element grid - 2x2 layout instead of 4 across */
	.horizontal-sidebar :global(.settings-panel .element-grid) {
		display: grid !important;
		grid-template-columns: repeat(2, 1fr) !important;
		gap: 8px;
	}

	/* Compact mode: Motion toggles */
	.horizontal-sidebar :global(.settings-panel .motion-toggles) {
		flex-wrap: wrap;
		gap: 8px;
	}

	/* Compact mode: Trail presets */
	.horizontal-sidebar :global(.settings-panel .trail-presets) {
		flex-wrap: wrap;
		gap: 8px;
	}

	/* Compact mode: Style toggle (Flow/Step) */
	.horizontal-sidebar :global(.settings-panel .style-toggle) {
		flex-wrap: wrap;
		gap: 8px;
	}

	/* Compact mode: BPM presets - 2 columns for narrow sidebar */
	.horizontal-sidebar :global(.settings-panel .preset-chips) {
		display: grid !important;
		grid-template-columns: repeat(2, 1fr) !important;
		gap: 8px;
	}

	/* Compact mode: Ensure all buttons meet touch targets */
	.horizontal-sidebar :global(.settings-panel .element-btn),
	.horizontal-sidebar :global(.settings-panel .motion-btn),
	.horizontal-sidebar :global(.settings-panel .trail-btn),
	.horizontal-sidebar :global(.settings-panel .style-btn),
	.horizontal-sidebar :global(.settings-panel .preset-chip) {
		min-height: 48px;
		flex: 1 1 auto;
	}

	/* Sidebar sections - natural height, don't force stretch */
	.sidebar-section {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.sidebar-section + .sidebar-section {
		padding-top: clamp(14px, 3cqh, 24px);
		border-top: 1px solid var(--theme-stroke);
	}

	/* Standalone mode: BpmChips in sidebar */
	.standalone-controls {
		gap: 12px;
	}

	.standalone-controls :global(.bpm-chips) {
		width: 100%;
	}

	.standalone-controls :global(.bpm-adjuster) {
		justify-content: center;
	}

	.standalone-controls :global(.preset-chips) {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.standalone-controls :global(.preset-chip) {
		min-height: 48px;
	}

	/* Child panes - space between sections, not stretched buttons */
	.horizontal-sidebar :global(.playback-pane),
	.horizontal-sidebar :global(.visual-pane) {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		flex: 1;
		gap: clamp(12px, 3cqh, 24px); /* Extra space goes to gaps between groups */
	}

	/* EXPANDED MODE ONLY: Button groups (scoped via .sidebar-section) */
	.horizontal-sidebar .sidebar-section :global(.style-toggle),
	.horizontal-sidebar .sidebar-section :global(.motion-toggles),
	.horizontal-sidebar .sidebar-section :global(.trail-presets),
	.horizontal-sidebar .sidebar-section :global(.ends-selector) {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	/* Element grid: 2x2 layout for visibility toggles (Grid, Props, #, Glyph) */
	.horizontal-sidebar .sidebar-section :global(.element-grid) {
		display: grid !important;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		flex-shrink: 0;
	}

	/* EXPANDED MODE ONLY: Button sizing */
	.horizontal-sidebar .sidebar-section :global(.style-btn),
	.horizontal-sidebar .sidebar-section :global(.motion-btn),
	.horizontal-sidebar .sidebar-section :global(.element-btn),
	.horizontal-sidebar .sidebar-section :global(.trail-btn),
	.horizontal-sidebar .sidebar-section :global(.ends-btn) {
		flex: 1;
		min-height: 48px;
		max-height: 56px;
		height: 48px;
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
		min-width: 48px;
		min-height: 48px;
		background: var(--theme-card-bg);
		border: 1.5px solid var(--theme-stroke);
		border-radius: 50%;
		color: var(--theme-text-dim);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
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
		min-width: 64px;
		min-height: 64px;
		flex-shrink: 0;
	}

	.horizontal-transport-row .play-btn svg {
		width: 28px;
		height: 28px;
	}

	/* BPM control container - fills available space */
	.horizontal-sidebar :global(.bpm-control) {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: clamp(8px, 2cqh, 14px);
	}

	/* BPM adjuster - stays horizontal with 48px minimum */
	.horizontal-sidebar :global(.bpm-adjuster) {
		gap: 10px;
		min-height: 48px;
	}

	.horizontal-sidebar :global(.bpm-display) {
		min-height: 48px;
		min-width: 80px;
		padding: 0 14px;
		font-size: clamp(1rem, 3cqh, 1.25rem);
	}

	.horizontal-sidebar :global(.bpm-btn) {
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
	}

	/* BPM presets - 3-column grid (2 rows of 3 chips) */
	.horizontal-sidebar :global(.preset-chips) {
		display: grid !important;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.horizontal-sidebar :global(.preset-chip) {
		min-height: 48px;
		max-height: 52px;
		height: 48px;
		padding: 8px 10px;
		font-size: 0.85rem;
	}

	/* Step size row in playback pane */
	.horizontal-sidebar :global(.step-size-row) {
		min-height: 48px;
		max-height: 56px;
		flex-shrink: 0;
	}

	.horizontal-sidebar :global(.step-chip) {
		min-height: 48px;
		height: 48px;
	}

	/* Container queries - adjust gaps, not button sizes */
	@container sidebar (max-height: 450px) {
		/* Tight mode: reduce gaps */
		.horizontal-sidebar :global(.playback-pane),
		.horizontal-sidebar :global(.visual-pane) {
			gap: 10px;
		}
	}

	@container sidebar (min-height: 550px) {
		/* Roomy mode: more generous gaps */
		.horizontal-sidebar :global(.playback-pane),
		.horizontal-sidebar :global(.visual-pane) {
			gap: 20px;
		}
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

	.controls-standard {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		background: var(--theme-card-bg, rgba(0, 0, 0, 0.3));
		border: 1px solid var(--theme-stroke);
		border-radius: 14px;
		flex-shrink: 0;
	}

	/* Invisible spacer to balance the gear button - keeps transport centered */
	.controls-spacer {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		visibility: hidden;
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

		/* Keep 48px minimum for WCAG AAA compliance */
		.play-btn {
			width: 48px;
			height: 48px;
			min-width: 48px;
			min-height: 48px;
		}

		.play-btn svg {
			width: 22px;
			height: 22px;
		}

		.controls-full {
			gap: 8px;
			padding: 10px;
			max-height: 180px;
		}
	}

	/* ========================================
	   SETTINGS GEAR BUTTON
	   ======================================== */
	.settings-gear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
		background: var(--theme-card-bg);
		border: 1.5px solid var(--theme-stroke);
		border-radius: 50%;
		color: var(--theme-text-dim);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.settings-gear-btn i {
		font-size: 18px;
	}

	.settings-gear-btn:hover {
		background: var(--theme-card-hover-bg);
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text);
		transform: scale(1.05);
	}

	.settings-gear-btn:active {
		transform: scale(0.95);
	}

	.settings-gear-btn.active {
		background: var(--theme-accent, #3b82f6);
		border-color: var(--theme-accent, #3b82f6);
		color: white;
	}

	.settings-gear-btn.active:hover {
		background: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, black);
		border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 85%, black);
	}

	/* ========================================
	   SETTINGS SHEET (Drawer)
	   ======================================== */
	:global(.animation-settings-sheet) {
		--drawer-max-height: 55dvh;
	}

	:global(.drawer-content.animation-settings-sheet) {
		max-height: 55dvh !important;
		border-radius: 20px 20px 0 0 !important;
	}

	.settings-sheet-content {
		display: flex;
		flex-direction: column;
		padding: 8px 16px 16px;
		height: 100%;
		background: var(--theme-panel-elevated-bg, var(--theme-panel-bg));
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	/* ========================================
	   ACCESSIBILITY & MOTION
	   ======================================== */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}

		.play-btn,
		.settings-gear-btn,
		.export-card .progress-bar div {
			transition: none;
		}
	}
</style>
