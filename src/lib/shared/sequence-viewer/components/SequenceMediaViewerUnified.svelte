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
	}: {
		sequence: SequenceData;
		initialMediaType?: MediaType;
		controlsLevel?: ControlsLevel;
		isExporting?: boolean;
		exportProgress?: ExportProgress | null;
		onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
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
	}

	function handleImageClick() {
		if (hasAnimation) {
			selectMediaType("animation");
		}
	}
</script>

<div class="media-viewer">
	<!-- Media Type Tabs -->
	{#if availableMediaTypes.length > 1}
		<div class="media-tabs">
			{#each availableMediaTypes as mediaType}
				<button
					class="media-tab"
					class:active={activeMediaType === mediaType}
					onclick={() => selectMediaType(mediaType)}
				>
					{#if mediaType === "image"}
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<polyline points="21 15 16 10 5 21" />
						</svg>
						<span>Image</span>
					{:else if mediaType === "animation"}
						<svg viewBox="0 0 24 24" fill="currentColor">
							<path d="M8 5v14l11-7z" />
						</svg>
						<span>Animate</span>
					{:else if mediaType === "video"}
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polygon points="23 7 16 12 23 17 23 7" />
							<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
						</svg>
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
			<div
				class="image-view"
				role="button"
				tabindex="0"
				aria-label="Click to animate sequence"
				onclick={handleImageClick}
				onkeypress={(e) => e.key === "Enter" && handleImageClick()}
			>
				{#key sequence.id || sequence.word}
					<PropAwareThumbnail
						{sequence}
						bluePropType={propSettings.bluePropType}
						redPropType={propSettings.redPropType}
						catDogModeEnabled={isCatDog}
						{lightMode}
					/>
				{/key}

				<!-- Play overlay hint -->
				{#if hasAnimation}
					<div class="play-overlay">
						<div class="play-icon">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M8 5v14l11-7z" />
							</svg>
						</div>
						<span>Click to animate</span>
					</div>
				{/if}
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

	/* Media Type Tabs */
	.media-tabs {
		display: flex;
		justify-content: center;
		gap: 4px;
		padding: 4px;
		background: color-mix(in srgb, var(--theme-shadow) 20%, transparent);
		border-radius: 10px;
		flex-shrink: 0;
	}

	.media-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.media-tab svg {
		width: 16px;
		height: 16px;
	}

	.media-tab:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
		color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
	}

	.media-tab.active {
		background: color-mix(
			in srgb,
			var(--semantic-info, #3b82f6) 25%,
			transparent
		);
		color: var(--theme-text, white);
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
		cursor: pointer;
	}

	/* Play overlay */
	.play-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: color-mix(in srgb, var(--theme-shadow) 40%, transparent);
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
	}

	.image-view:hover .play-overlay {
		opacity: 1;
	}

	.play-icon {
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(
			in srgb,
			var(--semantic-info, #3b82f6) 90%,
			transparent
		);
		border-radius: 50%;
		color: var(--theme-text, white);
	}

	.play-icon svg {
		width: 28px;
		height: 28px;
		margin-left: 3px;
	}

	.play-overlay span {
		font-size: var(--font-size-compact, 12px);
		color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
		font-weight: 500;
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
		.media-tab,
		.play-overlay,
		.back-btn {
			transition: none;
		}
	}
</style>
