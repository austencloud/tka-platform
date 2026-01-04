<!--
  SequenceMediaViewerUnified.svelte

  Unified media viewer using the new AnimationPlayer.
  Provides tabs for Image, Animation, and Video views.

  Key differences from gallery's SequenceMediaViewer:
  - Uses unified AnimationPlayer with configurable controls
  - Supports export progress overlay
  - Configurable controls level
  - Integrates with AnimationExportContext when used in ShareHub
-->
<script lang="ts">
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
	import type { ControlsLevel, ExportProgress, MediaType } from "../domain/types";
	import { tryResolve } from "$lib/shared/inversify/di";
	import { TYPES } from "$lib/shared/inversify/types";
	import { onMount, onDestroy } from "svelte";
	import AnimationPlayer from "./AnimationPlayer.svelte";
	import PropAwareThumbnail from "$lib/features/discover/gallery/display/components/PropAwareThumbnail.svelte";
	import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
	import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
	import { isCatDogMode } from "$lib/features/discover/gallery/display/services/implementations/DiscoverThumbnailCache";
	import { tryGetAnimationExportContext } from "$lib/shared/share-hub/context/animation-export-context.svelte";

	let {
		sequence,
		initialMediaType = "image" as MediaType,
		controlsLevel = "standard" as ControlsLevel,
		isExporting = false,
		exportProgress = null as ExportProgress | null,
		onCanvasReady,
		onMediaTypeChange,
	}: {
		sequence: SequenceData;
		initialMediaType?: MediaType;
		controlsLevel?: ControlsLevel;
		isExporting?: boolean;
		exportProgress?: ExportProgress | null;
		onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
		onMediaTypeChange?: (type: MediaType) => void;
	} = $props();

	let hapticService: IHapticFeedback | null = null;

	// Check if we're in ShareHub context (external control mode)
	const animationExportContext = tryGetAnimationExportContext();
	const useExternalControl = !!animationExportContext;

	onMount(() => {
		hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
	});

	// State
	let activeMediaType = $state<MediaType>("image");

	// Set initial media type
	$effect(() => {
		if (initialMediaType) {
			activeMediaType = initialMediaType;
		}
	});

	// Get prop settings for PropAwareThumbnail
	const propSettings = $derived({
		bluePropType: settingsService.settings.bluePropType,
		redPropType: settingsService.settings.redPropType,
		catDogMode: settingsService.settings.catDogMode,
	});

	const isCatDog = $derived(
		isCatDogMode(
			propSettings.bluePropType,
			propSettings.redPropType,
			propSettings.catDogMode
		)
	);

	// Get light mode from visibility state
	const visibilityManager = getAnimationVisibilityManager();
	let lightMode = $state(!visibilityManager.isDarkMode());

	function handleVisibilityChange() {
		lightMode = !visibilityManager.isDarkMode();
	}

	visibilityManager.registerObserver(handleVisibilityChange);

	onDestroy(() => {
		visibilityManager.unregisterObserver(handleVisibilityChange);
	});

	// Derived: available media types
	const hasImages = $derived(!!sequence);
	const hasAnimation = $derived(!!sequence);
	const hasVideo = $derived(!!sequence?.performanceVideoUrl);

	const availableMediaTypes = $derived.by(() => {
		const types: MediaType[] = [];
		if (hasImages) types.push("image");
		if (hasAnimation) types.push("animation");
		if (hasVideo) types.push("video");
		return types;
	});

	// Reset to image view when sequence changes
	$effect(() => {
		if (sequence) {
			activeMediaType = initialMediaType || "image";
		}
	});

	// Handlers
	function selectMediaType(type: MediaType) {
		hapticService?.trigger("selection");
		activeMediaType = type;
		onMediaTypeChange?.(type);
	}

</script>

<div class="media-viewer">
	<!-- Media Type Tabs (pill/chip style) -->
	{#if availableMediaTypes.length > 1}
		<div class="media-tabs" role="radiogroup" aria-label="Media type selection">
			{#each availableMediaTypes as mediaType}
				<button
					class="media-chip"
					class:active={activeMediaType === mediaType}
					role="radio"
					aria-checked={activeMediaType === mediaType}
					onclick={() => selectMediaType(mediaType)}
				>
					{#if mediaType === "image"}
						<i class="fas fa-image" aria-hidden="true"></i>
						<span>Image</span>
					{:else if mediaType === "animation"}
						<i class="fas fa-play-circle" aria-hidden="true"></i>
						<span>Animate</span>
					{:else if mediaType === "video"}
						<i class="fas fa-video" aria-hidden="true"></i>
						<span>Video</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Media Content Area -->
	<div class="media-content">
		{#if activeMediaType === "image"}
			<!-- Image View -->
			<div class="image-view">
				{#key sequence.id || sequence.word}
					<PropAwareThumbnail
						{sequence}
						bluePropType={propSettings.bluePropType}
						redPropType={propSettings.redPropType}
						catDogModeEnabled={isCatDog}
						{lightMode}
					/>
				{/key}
			</div>
		{:else if activeMediaType === "animation"}
			<!-- Animation View - using unified AnimationPlayer -->
			<div class="animation-view">
				{#if useExternalControl && animationExportContext}
					<!-- External control mode (ShareHub context) -->
					<AnimationPlayer
						sequence={animationExportContext.state.sequenceData ?? sequence}
						autoPlay={false}
						showControls={true}
						{controlsLevel}
						externalControl={true}
						isPlaying={animationExportContext.state.isPlaying}
						speed={animationExportContext.state.speed}
						currentBeat={animationExportContext.state.currentBeat}
						bluePropState={animationExportContext.state.bluePropState}
						redPropState={animationExportContext.state.redPropState}
						onPlaybackToggle={animationExportContext.actions.onPlaybackToggle}
						onSpeedChange={animationExportContext.actions.onSpeedChange}
						onStepForward={animationExportContext.actions.onStepHalfBeatForward}
						onStepBackward={animationExportContext.actions.onStepHalfBeatBackward}
						onStepHalfBeatForward={animationExportContext.actions.onStepHalfBeatForward}
						onStepHalfBeatBackward={animationExportContext.actions.onStepHalfBeatBackward}
						onStepFullBeatForward={animationExportContext.actions.onStepFullBeatForward}
						onStepFullBeatBackward={animationExportContext.actions.onStepFullBeatBackward}
						playbackMode={animationExportContext.state.playbackMode}
						stepPlaybackPauseMs={animationExportContext.state.stepPlaybackPauseMs}
						stepPlaybackStepSize={animationExportContext.state.stepPlaybackStepSize}
						onPlaybackModeChange={animationExportContext.actions.onPlaybackModeChange}
						onStepPlaybackPauseMsChange={animationExportContext.actions.onStepPlaybackPauseMsChange}
						onStepPlaybackStepSizeChange={animationExportContext.actions.onStepPlaybackStepSizeChange}
						blueMotionVisible={animationExportContext.state.blueMotionVisible}
						redMotionVisible={animationExportContext.state.redMotionVisible}
						onToggleBlue={animationExportContext.actions.onToggleBlue}
						onToggleRed={animationExportContext.actions.onToggleRed}
						isCircular={animationExportContext.state.isCircular}
						loopCount={animationExportContext.state.exportLoopCount}
						onLoopCountChange={animationExportContext.actions.onLoopCountChange}
						isExporting={animationExportContext.state.isExporting}
						exportProgress={animationExportContext.state.exportProgress}
						onExport={animationExportContext.actions.onExportVideo}
						onCancelExport={animationExportContext.actions.onCancelExport}
						onCanvasReady={animationExportContext.actions.onCanvasReady}
					/>
				{:else}
					<!-- Standalone mode (internal state) -->
					<AnimationPlayer
						{sequence}
						autoPlay={true}
						showControls={true}
						{controlsLevel}
						{isExporting}
						{exportProgress}
						{onCanvasReady}
					/>
				{/if}
			</div>
		{:else if activeMediaType === "video"}
			<!-- Video View -->
			<div class="video-view">
				{#if sequence.performanceVideoUrl}
					<video
						src={sequence.performanceVideoUrl}
						controls
						playsinline
						class="video-player"
					>
						<track kind="captions" />
						Your browser does not support video playback.
					</video>
				{:else}
					<div class="placeholder">No video available</div>
				{/if}

				<button
					class="back-btn"
					onclick={() => selectMediaType("image")}
					aria-label="Close video"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.media-viewer {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		gap: 8px;
	}

	/* Media Type Tabs (pill/chip style) */
	.media-tabs {
		display: flex;
		justify-content: center;
		gap: 12px;
		flex-shrink: 0;
	}

	.media-chip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		min-height: 48px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 24px;
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.media-chip i {
		font-size: var(--font-size-base, 16px);
	}

	.media-chip:hover {
		border-color: var(--theme-accent, #6366f1);
		color: var(--theme-text, white);
		transform: translateY(-2px);
	}

	.media-chip:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	.media-chip.active {
		background: var(--theme-accent, #6366f1);
		border-color: var(--theme-accent, #6366f1);
		color: white;
		box-shadow:
			0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.3)),
			0 0 0 1px var(--theme-accent-glow, rgba(99, 102, 241, 0.3));
	}

	.media-chip.active:hover {
		transform: translateY(-1px) scale(1.02);
	}

	/* Media Content */
	.media-content {
		flex: 1;
		min-height: 0;
		position: relative;
		border-radius: 10px;
		overflow: hidden;
	}

	/* Image View */
	.image-view {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Animation View */
	.animation-view {
		width: 100%;
		height: 100%;
	}

	/* Video View */
	.video-view {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--theme-shadow, black);
	}

	.video-player {
		max-width: 100%;
		max-height: 100%;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.back-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--theme-shadow) 60%, transparent);
		border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		border-radius: 50%;
		color: var(--theme-text, white);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.back-btn svg {
		width: 18px;
		height: 18px;
	}

	.back-btn:hover {
		background: color-mix(in srgb, var(--theme-shadow) 80%, transparent);
	}

	/* Placeholder */
	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
	}

	@media (prefers-reduced-motion: reduce) {
		.media-chip,
		.back-btn {
			transition: none;
		}

		.media-chip:hover,
		.media-chip.active:hover {
			transform: none;
		}
	}
</style>
