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
	import PropAwareThumbnail from "$lib/features/discover/sequences/display/components/PropAwareThumbnail.svelte";
	import LayeredSequencePreview from "./LayeredSequencePreview.svelte";
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
		showVisibilitySettings = true,
		onCanvasReady,
		onMediaTypeChange,
	}: {
		sequence: SequenceData;
		initialMediaType?: MediaType;
		controlsLevel?: ControlsLevel;
		/** Show visibility chips and dark mode toggle. False = use global settings (browse mode). */
		showVisibilitySettings?: boolean;
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

	// Local export settings (for Share Hub mode)
	let localAddWord = $state(imageSettings.addWord);
	let localAddBeatNumbers = $state(imageSettings.addBeatNumbers);
	let localIncludeStartPosition = $state(imageSettings.includeStartPosition);
	let localAddDifficultyLevel = $state(imageSettings.addDifficultyLevel);
	let localAddUserInfo = $state(imageSettings.addUserInfo);
	let localDarkMode = $state(imageSettings.darkMode);
	// Granular footer controls
	let localShowCreatorName = $state(imageSettings.showCreatorName);
	let localShowNotes = $state(imageSettings.showNotes);
	let localShowBirthday = $state(imageSettings.showBirthday);

	function handleImageSettingsChange() {
		localAddWord = imageSettings.addWord;
		localAddBeatNumbers = imageSettings.addBeatNumbers;
		localIncludeStartPosition = imageSettings.includeStartPosition;
		localAddDifficultyLevel = imageSettings.addDifficultyLevel;
		localAddUserInfo = imageSettings.addUserInfo;
		localDarkMode = imageSettings.darkMode;
		// Granular footer controls
		localShowCreatorName = imageSettings.showCreatorName;
		localShowNotes = imageSettings.showNotes;
		localShowBirthday = imageSettings.showBirthday;
	}

	imageSettings.registerObserver(handleImageSettingsChange);

	// Global settings (for browse mode - Sequence Details panel)
	const globalImageExport = $derived(settingsService.settings.imageExport);
	const globalDarkMode = $derived(settingsService.settings.darkMode ?? false);

	// Effective settings - use global when browsing, local when customizing for export
	const addWord = $derived(showVisibilitySettings ? localAddWord : (globalImageExport?.addWord ?? true));
	const addBeatNumbers = $derived(showVisibilitySettings ? localAddBeatNumbers : (globalImageExport?.addBeatNumbers ?? true));
	const includeStartPosition = $derived(showVisibilitySettings ? localIncludeStartPosition : (globalImageExport?.includeStartPosition ?? true));
	const addDifficultyLevel = $derived(showVisibilitySettings ? localAddDifficultyLevel : (globalImageExport?.addDifficultyLevel ?? false));
	const addUserInfo = $derived(showVisibilitySettings ? localAddUserInfo : ((globalImageExport?.showCreatorName || globalImageExport?.showNotes || globalImageExport?.showBirthday) ?? false));
	const darkMode = $derived(showVisibilitySettings ? localDarkMode : globalDarkMode);

	// Granular footer controls - derived for effective values
	const showCreatorName = $derived(showVisibilitySettings ? localShowCreatorName : (globalImageExport?.showCreatorName ?? true));
	const showNotes = $derived(showVisibilitySettings ? localShowNotes : (globalImageExport?.showNotes ?? true));
	const showBirthday = $derived(showVisibilitySettings ? localShowBirthday : (globalImageExport?.showBirthday ?? true));

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
	// Granular footer toggle handlers
	function toggleShowCreatorName() {
		imageSettings.toggle("showCreatorName");
	}
	function toggleShowNotes() {
		imageSettings.toggle("showNotes");
	}
	function toggleShowBirthday() {
		imageSettings.toggle("showBirthday");
	}

	// Container width for responsive layout detection
	let containerWidth = $state(0);
	// Use horizontal layout when container is wide enough (600px+)
	const useHorizontalLayout = $derived(containerWidth >= 600);

	// Copy to clipboard state
	let isCopying = $state(false);
	let copySuccess = $state(false);
	let copyError = $state(false);

	/**
	 * Copy the current image to clipboard
	 * Uses the Clipboard API to write a PNG blob
	 */
	async function copyImageToClipboard() {
		if (isCopying || !sequence) return;

		isCopying = true;
		copySuccess = false;

		try {
			// Get the container instance to access the renderer
			const { getContainerInstance } = await import("$lib/shared/inversify/di");
			const { TYPES } = await import("$lib/shared/inversify/types");
			const container = await getContainerInstance();
			const renderer = container.get<import("$lib/shared/render/services/contracts/ISequenceRenderer").ISequenceRenderer>(TYPES.ISequenceRenderer);

			// Render the image with current settings
			const blob = await renderer.renderSequenceToBlob(sequence, {
				beatSize: 240,
				format: "PNG",
				quality: 1.0,
				includeStartPosition,
				addBeatNumbers,
				addWord,
				addDifficultyLevel,
				addUserInfo,
				userName,
				showCreatorName,
				showNotes,
				showBirthday,
				addReversalSymbols: true,
				visibilityOverrides: {
					darkMode,
				},
			});

			// Copy to clipboard using Clipboard API
			await navigator.clipboard.write([
				new ClipboardItem({
					"image/png": blob,
				}),
			]);

			copySuccess = true;
			hapticService?.trigger("success");

			// Reset success indicator after 2 seconds
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (error) {
			console.error("Failed to copy image to clipboard:", error);
			copyError = true;
			hapticService?.trigger("error");

			// Reset error indicator after 3 seconds
			setTimeout(() => {
				copyError = false;
			}, 3000);
		} finally {
			isCopying = false;
		}
	}

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
				type="button"
				class="mode-switch-btn primary"
				onclick={() => selectMediaType("animation")}
				aria-label="Play animation"
			>
				<i class="fas fa-play" aria-hidden="true"></i>
				<span>Play Animation</span>
			</button>
		{:else if activeMediaType === "animation" && hasImages}
			<button
				type="button"
				class="mode-switch-btn secondary"
				onclick={() => selectMediaType("image")}
				aria-label="View image"
			>
				<i class="fas fa-image" aria-hidden="true"></i>
				<span>View Image</span>
			</button>
		{/if}

		<!-- Dark Mode Lamp Button - only shown when visibility settings are enabled (Share Hub) -->
		{#if showVisibilitySettings}
			<button
				type="button"
				class="lamp-btn"
				class:lit={!darkMode}
				onclick={toggleDarkMode}
				aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
				title="Toggle dark/light mode"
			>
				<i class="fas fa-lightbulb" aria-hidden="true"></i>
			</button>
		{/if}

		<!-- Copy to Clipboard Button - only shown in image mode with visibility settings -->
		{#if showVisibilitySettings && activeMediaType === "image"}
			<button
				type="button"
				class="copy-btn"
				class:success={copySuccess}
				class:error={copyError}
				onclick={copyImageToClipboard}
				disabled={isCopying}
				aria-label="Copy image to clipboard"
				title={copyError ? "Copy failed - try again" : "Copy image to clipboard"}
			>
				{#if isCopying}
					<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
				{:else if copySuccess}
					<i class="fas fa-check" aria-hidden="true"></i>
				{:else if copyError}
					<i class="fas fa-times" aria-hidden="true"></i>
				{:else}
					<i class="fas fa-copy" aria-hidden="true"></i>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Media Content Area -->
	<div class="media-content">
		{#if activeMediaType === "image"}
			<!-- Image View - LayeredSequencePreview for interactive mode, PropAwareThumbnail for browse mode -->
			<div class="image-view-container">
				<div class="image-view">
					{#if showVisibilitySettings}
						<!-- Interactive mode: Use layered preview for animated toggles -->
						<LayeredSequencePreview
							{sequence}
							showWord={addWord}
							showBeatNumbers={addBeatNumbers}
							showDifficultyLevel={addDifficultyLevel}
							{includeStartPosition}
							{showCreatorName}
							{showNotes}
							{showBirthday}
							{darkMode}
							{userName}
							{bluePropType}
							redPropType={catDogMode ? redPropType : bluePropType}
							catDogModeEnabled={catDogMode}
						/>
					{:else}
						<!-- Browse mode: Use cached composite images -->
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
							{showCreatorName}
							{showNotes}
							{showBirthday}
						/>
					{/if}
				</div>

				<!-- Image Export Settings Chips - only shown when visibility settings are enabled (Share Hub) -->
				{#if showVisibilitySettings}
					<div class="settings-chips">
						<button
							type="button"
							class="chip"
							class:active={addWord}
							onclick={toggleWord}
							aria-pressed={addWord}
						>
							Word
						</button>
						<button
							type="button"
							class="chip"
							class:active={addBeatNumbers}
							onclick={toggleBeatNumbers}
							aria-pressed={addBeatNumbers}
						>
							Beat #s
						</button>
						<button
							type="button"
							class="chip"
							class:active={includeStartPosition}
							onclick={toggleStartPosition}
							aria-pressed={includeStartPosition}
						>
							Start Pos
						</button>
						<button
							type="button"
							class="chip"
							class:active={addDifficultyLevel}
							onclick={toggleDifficulty}
							aria-pressed={addDifficultyLevel}
						>
							Difficulty
						</button>
						<button
							type="button"
							class="chip"
							class:active={showCreatorName}
							onclick={toggleShowCreatorName}
							aria-pressed={showCreatorName}
						>
							Name
						</button>
						<button
							type="button"
							class="chip"
							class:active={showNotes}
							onclick={toggleShowNotes}
							aria-pressed={showNotes}
						>
							Notes
						</button>
						<button
							type="button"
							class="chip birthday-chip"
							class:active={showBirthday}
							onclick={toggleShowBirthday}
							aria-pressed={showBirthday}
							title="Birthday date"
						>
							🎂
						</button>
					</div>
				{/if}
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

				<!-- Animation Visibility Settings Chips (only shown in Share Hub, not browse mode) -->
				<!-- When controlsLevel="full", these are redundant with AnimationPlayer's Visual tab -->
				{#if showVisibilitySettings && controlsLevel !== "full"}
					<div class="settings-chips">
						<button
							type="button"
							class="chip"
							class:active={animGridVisible}
							onclick={toggleAnimGrid}
							aria-pressed={animGridVisible}
						>
							Grid
						</button>
						<button
							type="button"
							class="chip"
							class:active={animBeatNumbers}
							onclick={toggleAnimBeatNumbers}
							aria-pressed={animBeatNumbers}
						>
							Beat #s
						</button>
						<button
							type="button"
							class="chip"
							class:active={animTkaGlyph}
							onclick={toggleAnimTkaGlyph}
							aria-pressed={animTkaGlyph}
						>
							TKA Glyph
						</button>
						<button
							type="button"
							class="chip"
							class:active={animWordHeader}
							onclick={toggleAnimWordHeader}
							aria-pressed={animWordHeader}
						>
							Word
						</button>
						<button
							type="button"
							class="chip"
							class:active={animTrails}
							onclick={toggleAnimTrails}
							aria-pressed={animTrails}
						>
							Trails
						</button>
					</div>
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
					type="button"
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

	/* Copy Button for Clipboard */
	.copy-btn {
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

	.copy-btn i {
		font-size: 20px;
		transition: all 0.25s ease;
	}

	.copy-btn:hover:not(:disabled) {
		transform: scale(1.08);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.copy-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.copy-btn:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.copy-btn.success {
		background: linear-gradient(145deg, rgba(34, 197, 94, 0.25), rgba(22, 163, 74, 0.15));
		border-color: rgba(34, 197, 94, 0.5);
		color: #22c55e;
	}

	.copy-btn.error {
		background: linear-gradient(145deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15));
		border-color: var(--semantic-error, rgba(239, 68, 68, 0.5));
		color: var(--semantic-error, #ef4444);
	}

	.copy-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
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

	/* Birthday chip with emoji */
	.chip.birthday-chip {
		font-size: 18px;
		line-height: 1;
		padding: 12px 14px;
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
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
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
		width: 20px;
		height: 20px;
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
		.lamp-btn,
		.copy-btn,
		.back-btn,
		.chip {
			transition: none;
		}

		.mode-switch-btn:hover,
		.mode-switch-btn:active,
		.lamp-btn:hover,
		.lamp-btn:active,
		.copy-btn:hover,
		.copy-btn:active {
			transform: none;
		}
	}
</style>
