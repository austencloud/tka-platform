<!--
  SequenceViewer.svelte

  Unified media viewer with CTA button to switch between Image and Animation modes.
  Uses sessionStorage for persistence (survives HMR and page refresh).

  Key features:
  - Single CTA button at top to switch modes (no tabs)
  - "Play Animation" button when in Image view
  - "View Image" button when in Animation view
  - Uses unified AnimationPlayer with configurable controls
  - Supports export progress overlay
  - Integrates with AnimationExportContext when used in ShareHub
-->
<script lang="ts">
	import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
	import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
	import type { ControlsLevel, MediaType } from "../domain/types";
	import { tryResolve } from "$lib/shared/inversify/di";
	import { TYPES } from "$lib/shared/inversify/types";
	import { onMount, onDestroy } from "svelte";
	import AnimationPlayer from "./AnimationPlayer.svelte";
	import PropAwareThumbnail from "$lib/features/discover/gallery/display/components/PropAwareThumbnail.svelte";
	import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
	import { tryGetAnimationExportContext } from "$lib/shared/share-hub/context/animation-export-context.svelte";
	import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
	import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
	import { authState } from "$lib/shared/auth/state/authState.svelte";
	import { browser } from "$app/environment";

	const MEDIA_TYPE_STORAGE_KEY = "sequence-viewer-media-type";

	let {
		sequence,
		initialMediaType = "image" as MediaType,
		controlsLevel = "standard" as ControlsLevel,
		onCanvasReady,
		onMediaTypeChange,
	}: {
		sequence: SequenceData;
		initialMediaType?: MediaType;
		controlsLevel?: ControlsLevel;
		onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
		onMediaTypeChange?: (type: MediaType) => void;
	} = $props();

	let hapticService: IHapticFeedback | null = null;

	// Check if we're in ShareHub context (external control mode)
	const animationExportContext = tryGetAnimationExportContext();
	const useExternalControl = !!animationExportContext;

	onMount(() => {
		hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
		// Notify parent of initial/persisted media type so export button label syncs
		onMediaTypeChange?.(activeMediaType);
	});

	// State - restore from sessionStorage if available (survives HMR)
	function getPersistedMediaType(): MediaType {
		if (!browser) return initialMediaType;
		const stored = sessionStorage.getItem(MEDIA_TYPE_STORAGE_KEY);
		if (stored === "image" || stored === "animation" || stored === "video") {
			return stored;
		}
		return initialMediaType;
	}

	let activeMediaType = $state<MediaType>(getPersistedMediaType());

	onDestroy(() => {
		imageSettings.unregisterObserver(handleImageSettingsChange);
		animationSettings.unregisterObserver(handleAnimationSettingsChange);
	});

	// Image export settings from ImageCompositionManager
	const imageSettings = getImageCompositionManager();

	// Animation visibility settings
	const animationSettings = getAnimationVisibilityManager();
	// Note: Dark mode uses imageSettings for persistence - shared between image & animation tabs
	// This is separate from the global app dark mode
	let animGridVisible = $state(animationSettings.getGridMode() !== "none");
	let animBeatNumbers = $state(animationSettings.getVisibility("beatNumbers"));
	let animTkaGlyph = $state(animationSettings.getVisibility("tkaGlyph"));
	let animWordHeader = $state(animationSettings.getVisibility("wordHeader"));
	let animTrails = $state(animationSettings.getTrailStyle() !== "off");

	function handleAnimationSettingsChange() {
		animGridVisible = animationSettings.getGridMode() !== "none";
		animBeatNumbers = animationSettings.getVisibility("beatNumbers");
		animTkaGlyph = animationSettings.getVisibility("tkaGlyph");
		animWordHeader = animationSettings.getVisibility("wordHeader");
		animTrails = animationSettings.getTrailStyle() !== "off";
	}

	animationSettings.registerObserver(handleAnimationSettingsChange);

	// Animation toggle handlers
	function toggleAnimGrid() {
		// Toggle between diamond and none
		const current = animationSettings.getGridMode();
		animationSettings.setGridMode(current === "none" ? "diamond" : "none");
	}
	function toggleAnimBeatNumbers() {
		animationSettings.toggleVisibility("beatNumbers");
	}
	function toggleAnimTkaGlyph() {
		animationSettings.toggleVisibility("tkaGlyph");
	}
	function toggleAnimWordHeader() {
		animationSettings.toggleVisibility("wordHeader");
	}
	function toggleAnimTrails() {
		// Toggle between subtle and off
		const current = animationSettings.getTrailStyle();
		animationSettings.setTrailStyle(current === "off" ? "subtle" : "off");
	}

	let addWord = $state(imageSettings.addWord);
	let addBeatNumbers = $state(imageSettings.addBeatNumbers);
	let includeStartPosition = $state(imageSettings.includeStartPosition);
	let addDifficultyLevel = $state(imageSettings.addDifficultyLevel);
	let addUserInfo = $state(imageSettings.addUserInfo);
	let darkMode = $state(imageSettings.darkMode);

	function handleImageSettingsChange() {
		addWord = imageSettings.addWord;
		addBeatNumbers = imageSettings.addBeatNumbers;
		includeStartPosition = imageSettings.includeStartPosition;
		addDifficultyLevel = imageSettings.addDifficultyLevel;
		addUserInfo = imageSettings.addUserInfo;
		darkMode = imageSettings.darkMode;
	}

	imageSettings.registerObserver(handleImageSettingsChange);

	// Prop type settings for PropAwareThumbnail
	const bluePropType = $derived(settingsService.settings.bluePropType);
	const redPropType = $derived(settingsService.settings.redPropType);
	const catDogMode = $derived(settingsService.settings.catDogMode);
	const userName = $derived(authState.user?.displayName ?? "");

	// Image settings toggle handlers
	function toggleWord() {
		imageSettings.toggle("addWord");
	}
	function toggleBeatNumbers() {
		imageSettings.toggle("addBeatNumbers");
	}
	function toggleStartPosition() {
		imageSettings.toggle("includeStartPosition");
	}
	function toggleDifficulty() {
		imageSettings.toggle("addDifficultyLevel");
	}
	function toggleUserInfo() {
		imageSettings.toggle("addUserInfo");
	}
	function toggleDarkMode() {
		imageSettings.toggle("darkMode");
	}

	// Container width for responsive layout detection
	let containerWidth = $state(0);
	// Use horizontal layout when container is wide enough (600px+)
	const useHorizontalLayout = $derived(containerWidth >= 600);

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

	// Note: We no longer reset media type when sequence changes
	// because we want to preserve the user's tab selection across HMR and navigation

	// Handlers
	function selectMediaType(type: MediaType) {
		hapticService?.trigger("selection");
		activeMediaType = type;
		onMediaTypeChange?.(type);
		// Persist to sessionStorage (survives HMR)
		if (browser) {
			sessionStorage.setItem(MEDIA_TYPE_STORAGE_KEY, type);
		}
	}

</script>

<div class="media-viewer" bind:clientWidth={containerWidth}>
	<!-- Mode Switch Button (at top, where tabs used to be) -->
	<div class="mode-switch-row">
		{#if activeMediaType === "image" && hasAnimation}
			<button
				class="mode-switch-btn primary"
				onclick={() => selectMediaType("animation")}
				aria-label="Play animation"
			>
				<i class="fas fa-play" aria-hidden="true"></i>
				<span>Play Animation</span>
			</button>
		{:else if activeMediaType === "animation" && hasImages}
			<button
				class="mode-switch-btn secondary"
				onclick={() => selectMediaType("image")}
				aria-label="View image"
			>
				<i class="fas fa-image" aria-hidden="true"></i>
				<span>View Image</span>
			</button>
		{/if}

		<!-- Dark Mode Lamp Button - unified for both image & animation tabs -->
		<button
			class="lamp-btn"
			class:lit={!darkMode}
			onclick={toggleDarkMode}
			aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
			title="Toggle dark/light mode"
		>
			<i class="fas fa-lightbulb" aria-hidden="true"></i>
		</button>
	</div>

	<!-- Media Content Area -->
	<div class="media-content">
		{#if activeMediaType === "image"}
			<!-- Image View - using PropAwareThumbnail with custom settings -->
			<div class="image-view-container">
				<div class="image-view">
					<PropAwareThumbnail
						{sequence}
						{bluePropType}
						redPropType={catDogMode ? redPropType : bluePropType}
						catDogModeEnabled={catDogMode}
						lightMode={!darkMode}
						{addWord}
						{addBeatNumbers}
						{includeStartPosition}
						{addDifficultyLevel}
						{addUserInfo}
						{userName}
					/>
				</div>

				<!-- Image Export Settings Chips -->
				<div class="settings-chips">
					<button
						class="chip"
						class:active={addWord}
						onclick={toggleWord}
						aria-pressed={addWord}
					>
						Word
					</button>
					<button
						class="chip"
						class:active={addBeatNumbers}
						onclick={toggleBeatNumbers}
						aria-pressed={addBeatNumbers}
					>
						Beat #s
					</button>
					<button
						class="chip"
						class:active={includeStartPosition}
						onclick={toggleStartPosition}
						aria-pressed={includeStartPosition}
					>
						Start Pos
					</button>
					<button
						class="chip"
						class:active={addDifficultyLevel}
						onclick={toggleDifficulty}
						aria-pressed={addDifficultyLevel}
					>
						Difficulty
					</button>
					<button
						class="chip"
						class:active={addUserInfo}
						onclick={toggleUserInfo}
						aria-pressed={addUserInfo}
					>
						User Info
					</button>
				</div>
			</div>
		{:else if activeMediaType === "animation"}
			<!-- Animation View - using unified AnimationPlayer -->
			<!-- AnimationPlayer consumes AnimationExportContext internally when externalControl=true -->
			<div class="animation-view-container">
				<div class="animation-view">
					<AnimationPlayer
						{sequence}
						autoPlay={!useExternalControl}
						showControls={true}
						{controlsLevel}
						externalControl={useExternalControl}
						{onCanvasReady}
						previewDarkMode={darkMode}
						layout={useHorizontalLayout ? "horizontal" : "vertical"}
					/>
				</div>

				<!-- Animation Visibility Settings Chips -->
				<div class="settings-chips">
					<button
						class="chip"
						class:active={animGridVisible}
						onclick={toggleAnimGrid}
						aria-pressed={animGridVisible}
					>
						Grid
					</button>
					<button
						class="chip"
						class:active={animBeatNumbers}
						onclick={toggleAnimBeatNumbers}
						aria-pressed={animBeatNumbers}
					>
						Beat #s
					</button>
					<button
						class="chip"
						class:active={animTkaGlyph}
						onclick={toggleAnimTkaGlyph}
						aria-pressed={animTkaGlyph}
					>
						TKA Glyph
					</button>
					<button
						class="chip"
						class:active={animWordHeader}
						onclick={toggleAnimWordHeader}
						aria-pressed={animWordHeader}
					>
						Word
					</button>
					<button
						class="chip"
						class:active={animTrails}
						onclick={toggleAnimTrails}
						aria-pressed={animTrails}
					>
						Trails
					</button>
				</div>
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
		min-height: 0;
		min-width: 0; /* Critical for flex width containment chain */
		flex: 1;
		gap: 8px;
		overflow: hidden;
	}

	/* Mode Switch Row (at top) */
	.mode-switch-row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 16px;
		flex-shrink: 0;
		padding: 12px 16px;
		overflow: visible;
	}

	/* Lamp Button for Dark Mode Toggle */
	.lamp-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		cursor: pointer;
		transition: all 0.25s ease;
	}

	.lamp-btn i {
		font-size: 22px;
		transition: all 0.25s ease;
	}

	/* Lit state - lamp is "on" (light mode preview) */
	.lamp-btn.lit {
		background: linear-gradient(145deg, rgba(255, 220, 100, 0.25), rgba(255, 180, 50, 0.15));
		border-color: rgba(255, 200, 80, 0.5);
		color: #ffd966;
		box-shadow:
			0 0 20px rgba(255, 200, 80, 0.3),
			inset 0 0 10px rgba(255, 255, 255, 0.1);
	}

	.lamp-btn.lit i {
		filter: drop-shadow(0 0 6px rgba(255, 200, 80, 0.8));
	}

	.lamp-btn:hover {
		transform: scale(1.08);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.lamp-btn.lit:hover {
		background: linear-gradient(145deg, rgba(255, 220, 100, 0.35), rgba(255, 180, 50, 0.25));
		box-shadow:
			0 0 25px rgba(255, 200, 80, 0.4),
			inset 0 0 12px rgba(255, 255, 255, 0.15);
	}

	.lamp-btn:active {
		transform: scale(0.95);
	}

	.lamp-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Mode Switch Button - single CTA at top */
	.mode-switch-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 14px 28px;
		min-height: 56px;
		min-width: 180px;
		border-radius: 28px;
		font-size: var(--font-size-base, 16px);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mode-switch-btn i {
		font-size: 18px;
	}

	/* Primary style (Play Animation) */
	.mode-switch-btn.primary {
		background: var(--theme-accent, #6366f1);
		border: none;
		color: white;
		box-shadow:
			0 4px 12px rgba(99, 102, 241, 0.3),
			0 0 0 1px rgba(99, 102, 241, 0.2);
	}

	.mode-switch-btn.primary:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 6px 16px rgba(99, 102, 241, 0.4),
			0 0 0 1px rgba(99, 102, 241, 0.3);
	}

	/* Secondary style (View Image) */
	.mode-switch-btn.secondary {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 2px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.mode-switch-btn.secondary:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		transform: translateY(-2px) scale(1.02);
	}

	.mode-switch-btn:active {
		transform: translateY(0) scale(0.98);
	}

	.mode-switch-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Media Content - fills available space for animation/image */
	.media-content {
		flex: 1;
		min-height: 0;
		min-width: 0; /* Critical for flex width containment chain */
		width: 100%;
		display: flex;
		flex-direction: column;
		position: relative;
		border-radius: 10px;
		overflow: hidden;
	}

	/* Image View Container */
	.image-view-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.image-view {
		flex: 1;
		min-height: 0;
		min-width: 0;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	/* Settings Chips */
	.settings-chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		flex-shrink: 0;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 16px;
		min-height: 48px; /* WCAG 2.1 AAA touch target */
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 24px;
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		transition: all 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.chip:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		color: var(--theme-text, white);
	}

	.chip.active {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
		border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
		color: white;
	}

	.chip.active:hover {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
		border-color: var(--theme-accent, #6366f1);
	}

	.chip:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Animation View Container */
	.animation-view-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	/* Animation View - fills available space */
	.animation-view {
		flex: 1;
		min-height: 0;
		min-width: 0;
		width: 100%;
		display: flex;
		overflow: hidden;
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

	/* Mobile: horizontal scroll if needed, but maintain touch targets */
	@media (max-width: 600px) {
		.settings-chips {
			padding: 10px;
			gap: 8px;
			overflow-x: auto;
			flex-wrap: nowrap;
			-webkit-overflow-scrolling: touch;
		}

		.chip {
			padding: 10px 14px;
			min-height: 48px; /* Maintain WCAG touch target on mobile */
			white-space: nowrap;
			flex-shrink: 0;
		}
	}


	@media (prefers-reduced-motion: reduce) {
		.mode-switch-btn,
		.back-btn,
		.chip {
			transition: none;
		}

		.mode-switch-btn:hover,
		.mode-switch-btn:active {
			transform: none;
		}
	}
</style>
