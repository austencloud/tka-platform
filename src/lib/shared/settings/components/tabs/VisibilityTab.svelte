<!--
  VisibilityTab.svelte - Visibility Settings Orchestrator

  Desktop: Side-by-side panels for Pictograph, Animation, and Image settings
  Mobile: Segmented control to switch between modes

  This component coordinates three visibility domains:
  - Pictograph: Glyphs (TKA includes turn numbers), reversals, non-radial
  - Animation: Grid mode, trails, overlays
  - Image Export: Elements included in exported images
-->
<script lang="ts">
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import {
    getAnimationVisibilityManager,
    type TrailVisibility,
    type PlaybackMode,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  import {
    getSettings,
    updateSettings,
    isSettingsPreviewMode,
  } from "$lib/shared/application/state/app-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import MobileSegmentControl from "./visibility/MobileSegmentControl.svelte";
  import type { VisibilityMode } from "./visibility/visibility-types";
  import PictographPanel from "./visibility/PictographPanel.svelte";
  import AnimationPanel from "./visibility/AnimationPanel.svelte";
  import ImagePanel from "./visibility/ImagePanel.svelte";

  // Note: This tab manages its own state via dedicated managers
  // (VisibilityStateManager, AnimationVisibilityManager, ImageCompositionManager)
  // rather than using the generic settings pattern

  // State managers
  const visibilityManager = getVisibilityStateManager();
  const animationVisibilityManager = getAnimationVisibilityManager();
  const imageCompositionManager = getImageCompositionManager();

  // UI state
  let mobileMode = $state<VisibilityMode>("pictograph");
  let isVisible = $state(false);

  // Dark mode - top-level toggle
  const darkMode = $derived(getSettings().darkMode ?? false);
  const isPreview = $derived(isSettingsPreviewMode());

  function handleDarkModeToggle() {
    if (isPreview) return;
    triggerHaptic();
    const newValue = !darkMode;
    void updateSettings({ darkMode: newValue });
    animationVisibilityManager.setDarkMode(newValue);
  }

  // Pictograph visibility state
  let tkaGlyphVisible = $state(true);
  let vtgGlyphVisible = $state(false);
  let elementalGlyphVisible = $state(false);
  let positionsGlyphVisible = $state(false);
  let reversalIndicatorsVisible = $state(true);
  let gridVisible = $state(true);
  let nonRadialVisible = $state(false);
  let handPointVisibility = $state<"all" | "active">("all");
  let stepNumbersVisible = $state(true);

  // Animation visibility state
  let animTrailStyle = $state<TrailVisibility>("on");
  let animPlaybackMode = $state<PlaybackMode>("continuous");
  let animBpm = $state(60);
  let animTkaGlyphVisible = $state(true);
  let animWordHeaderVisible = $state(true);
  let animFireEffectEnabled = $state(false);
  let animLedEffectEnabled = $state(false);
  let animLedBrightness = $state(5);
  let animColorBlend = $state(0.5);
  let animSmokeLevel = $state(0.1);
  let animUseCharcoal = $state(false);
  let animFireIntensity = $state(0.7);

  // Image composition state
  let imgAddWord = $state(true);
  let imgAddDifficultyLevel = $state(false);
  let imgIncludeStartPosition = $state(true);
  // Granular footer controls
  let imgShowCreatorName = $state(true);
  let imgShowNotes = $state(true);
  let imgShowBirthday = $state(true);
  let imgCustomNotesText = $state("Created using TKA Scribe");

  // Haptics
  let hapticService: IHapticFeedback | null = null;
  const triggerHaptic = () => hapticService?.trigger("selection");

  // Mobile mode handler
  function handleModeChange(mode: VisibilityMode) {
    triggerHaptic();
    mobileMode = mode;
  }

  // Pictograph toggle handler
  function handlePictographToggle(key: string) {
    triggerHaptic();
    switch (key) {
      case "tka":
        tkaGlyphVisible = !tkaGlyphVisible;
        visibilityManager.setGlyphVisibility("tkaGlyph", tkaGlyphVisible);
        break;
      case "vtg":
        vtgGlyphVisible = !vtgGlyphVisible;
        visibilityManager.setGlyphVisibility("vtgGlyph", vtgGlyphVisible);
        break;
      case "elemental":
        elementalGlyphVisible = !elementalGlyphVisible;
        visibilityManager.setGlyphVisibility(
          "elementalGlyph",
          elementalGlyphVisible
        );
        break;
      case "positions":
        positionsGlyphVisible = !positionsGlyphVisible;
        visibilityManager.setGlyphVisibility(
          "positionsGlyph",
          positionsGlyphVisible
        );
        break;
      case "reversals":
        reversalIndicatorsVisible = !reversalIndicatorsVisible;
        visibilityManager.setGlyphVisibility(
          "reversalIndicators",
          reversalIndicatorsVisible
        );
        break;
      case "grid":
        gridVisible = !gridVisible;
        visibilityManager.setGridVisibility(gridVisible);
        break;
      case "nonRadial":
        nonRadialVisible = !nonRadialVisible;
        visibilityManager.setNonRadialVisibility(nonRadialVisible);
        break;
      case "handPoints":
        // Toggle between "all" and "active" (show/hide hand points)
        handPointVisibility = handPointVisibility === "all" ? "active" : "all";
        visibilityManager.setHandPointVisibility(handPointVisibility);
        break;
      case "stepNumbers":
        stepNumbersVisible = !stepNumbersVisible;
        visibilityManager.setBeatNumbersVisibility(stepNumbersVisible);
        break;
    }
  }

  // Animation toggle handler
  function handleAnimationToggle(key: string) {
    triggerHaptic();
    switch (key) {
      case "tka":
        animTkaGlyphVisible = !animTkaGlyphVisible;
        animationVisibilityManager.setVisibility(
          "tkaGlyph",
          animTkaGlyphVisible
        );
        break;
      case "wordHeader":
        animWordHeaderVisible = !animWordHeaderVisible;
        animationVisibilityManager.setVisibility(
          "wordHeader",
          animWordHeaderVisible
        );
        break;
      case "fireEffect":
        animFireEffectEnabled = !animFireEffectEnabled;
        animationVisibilityManager.setFireEffect(animFireEffectEnabled);
        break;
      case "ledEffect":
        animLedEffectEnabled = !animLedEffectEnabled;
        animationVisibilityManager.setLedEffect(animLedEffectEnabled);
        break;
    }
  }

  function handleLedBrightnessChange(level: number) {
    triggerHaptic();
    animLedBrightness = level;
    animationVisibilityManager.setLedBrightness(level);
  }

  function handleColorBlendChange(value: number) {
    triggerHaptic();
    animColorBlend = value;
    animationVisibilityManager.setFireColorBlend(value);
  }

  function handleSmokeLevelChange(value: number) {
    triggerHaptic();
    animSmokeLevel = value;
    animationVisibilityManager.setFireSmokeLevel(value);
  }

  function handleUseCharcoalChange(value: boolean) {
    triggerHaptic();
    animUseCharcoal = value;
    animationVisibilityManager.setFireUseCharcoal(value);
  }

  function handleFireIntensityChange(value: number) {
    triggerHaptic();
    animFireIntensity = value;
    animationVisibilityManager.setFireIntensity(value);
  }

  function handleTrailStyleChange(newStyle: string) {
    triggerHaptic();
    animationVisibilityManager.setTrailStyle(newStyle as TrailVisibility);
  }

  function handlePlaybackModeChange(mode: PlaybackMode) {
    triggerHaptic();
    animPlaybackMode = mode;
    animationVisibilityManager.setPlaybackMode(mode);
  }

  function handleBpmChange(bpm: number) {
    triggerHaptic();
    animBpm = bpm;
    animationVisibilityManager.setBpm(bpm);
  }

  // Image toggle handler
  function handleImageToggle(key: string) {
    triggerHaptic();
    switch (key) {
      case "word":
        imgAddWord = !imgAddWord;
        imageCompositionManager.setAddWord(imgAddWord);
        break;
      case "difficulty":
        imgAddDifficultyLevel = !imgAddDifficultyLevel;
        imageCompositionManager.setAddDifficultyLevel(imgAddDifficultyLevel);
        break;
      case "startPosition":
        imgIncludeStartPosition = !imgIncludeStartPosition;
        imageCompositionManager.setIncludeStartPosition(
          imgIncludeStartPosition
        );
        break;
      case "creatorName":
        imgShowCreatorName = !imgShowCreatorName;
        imageCompositionManager.setShowCreatorName(imgShowCreatorName);
        break;
      case "notes":
        imgShowNotes = !imgShowNotes;
        imageCompositionManager.setShowNotes(imgShowNotes);
        break;
      case "birthday":
        imgShowBirthday = !imgShowBirthday;
        imageCompositionManager.setShowBirthday(imgShowBirthday);
        break;
    }
  }

  function handleCustomNotesChange(value: string) {
    triggerHaptic();
    imgCustomNotesText = value;
    imageCompositionManager.setCustomNotesText(value);
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;

    // Wait for persisted settings to load before reading initial pictograph values
    void visibilityManager.ensureSettingsLoaded().then(() => {
      tkaGlyphVisible = visibilityManager.getRawGlyphVisibility("tkaGlyph");
      vtgGlyphVisible = visibilityManager.getRawGlyphVisibility("vtgGlyph");
      elementalGlyphVisible =
        visibilityManager.getRawGlyphVisibility("elementalGlyph");
      positionsGlyphVisible =
        visibilityManager.getRawGlyphVisibility("positionsGlyph");
      reversalIndicatorsVisible =
        visibilityManager.getRawGlyphVisibility("reversalIndicators");
      gridVisible = visibilityManager.getGridVisibility();
      nonRadialVisible = visibilityManager.getNonRadialVisibility();
      handPointVisibility = visibilityManager.getHandPointVisibility();
      stepNumbersVisible = visibilityManager.getBeatNumbersVisibility();
    });

    // Load initial animation visibility (separate persistence, no race)
    animTrailStyle = animationVisibilityManager.getTrailStyle();
    animPlaybackMode = animationVisibilityManager.getPlaybackMode();
    animBpm = animationVisibilityManager.getBpm();
    animTkaGlyphVisible = animationVisibilityManager.getVisibility("tkaGlyph");
    animWordHeaderVisible =
      animationVisibilityManager.getVisibility("wordHeader");
    animFireEffectEnabled = animationVisibilityManager.isFireEffectEnabled();
    animLedEffectEnabled = animationVisibilityManager.isLedEffectEnabled();
    animLedBrightness = animationVisibilityManager.getLedBrightness();
    animColorBlend = animationVisibilityManager.getFireColorBlend();
    animSmokeLevel = animationVisibilityManager.getFireSmokeLevel();
    animUseCharcoal = animationVisibilityManager.getFireUseCharcoal();
    animFireIntensity = animationVisibilityManager.getFireIntensity();

    // Load initial image composition
    imgAddWord = imageCompositionManager.addWord;
    imgAddDifficultyLevel = imageCompositionManager.addDifficultyLevel;
    imgIncludeStartPosition = imageCompositionManager.includeStartPosition;
    // Granular footer controls
    imgShowCreatorName = imageCompositionManager.showCreatorName;
    imgShowNotes = imageCompositionManager.showNotes;
    imgShowBirthday = imageCompositionManager.showBirthday;
    imgCustomNotesText = imageCompositionManager.customNotesText;

    // Observers for external changes
    const pictographObserver = () => {
      tkaGlyphVisible = visibilityManager.getRawGlyphVisibility("tkaGlyph");
      vtgGlyphVisible = visibilityManager.getRawGlyphVisibility("vtgGlyph");
      elementalGlyphVisible =
        visibilityManager.getRawGlyphVisibility("elementalGlyph");
      positionsGlyphVisible =
        visibilityManager.getRawGlyphVisibility("positionsGlyph");
      reversalIndicatorsVisible =
        visibilityManager.getRawGlyphVisibility("reversalIndicators");
      gridVisible = visibilityManager.getGridVisibility();
      nonRadialVisible = visibilityManager.getNonRadialVisibility();
      handPointVisibility = visibilityManager.getHandPointVisibility();
      stepNumbersVisible = visibilityManager.getBeatNumbersVisibility();
    };

    const animationObserver = () => {
      animTrailStyle = animationVisibilityManager.getTrailStyle();
      animPlaybackMode = animationVisibilityManager.getPlaybackMode();
      animBpm = animationVisibilityManager.getBpm();
      animTkaGlyphVisible =
        animationVisibilityManager.getVisibility("tkaGlyph");
      animWordHeaderVisible =
        animationVisibilityManager.getVisibility("wordHeader");
      animFireEffectEnabled = animationVisibilityManager.isFireEffectEnabled();
      animLedEffectEnabled = animationVisibilityManager.isLedEffectEnabled();
      animLedBrightness = animationVisibilityManager.getLedBrightness();
      animColorBlend = animationVisibilityManager.getFireColorBlend();
      animSmokeLevel = animationVisibilityManager.getFireSmokeLevel();
      animUseCharcoal = animationVisibilityManager.getFireUseCharcoal();
      animFireIntensity = animationVisibilityManager.getFireIntensity();
    };

    const imageObserver = () => {
      imgAddWord = imageCompositionManager.addWord;
      imgAddDifficultyLevel = imageCompositionManager.addDifficultyLevel;
      imgIncludeStartPosition = imageCompositionManager.includeStartPosition;
      // Granular footer controls
      imgShowCreatorName = imageCompositionManager.showCreatorName;
      imgShowNotes = imageCompositionManager.showNotes;
      imgShowBirthday = imageCompositionManager.showBirthday;
      imgCustomNotesText = imageCompositionManager.customNotesText;
    };

    visibilityManager.registerObserver(pictographObserver, ["all"]);
    animationVisibilityManager.registerObserver(animationObserver);
    imageCompositionManager.registerObserver(imageObserver);

    // Entry animation
    setTimeout(() => (isVisible = true), 30);

    return () => {
      visibilityManager.unregisterObserver(pictographObserver);
      animationVisibilityManager.unregisterObserver(animationObserver);
      imageCompositionManager.unregisterObserver(imageObserver);
    };
  });
</script>

<div class="visibility-tab" class:visible={isVisible}>
  <!-- Mobile: Segmented Control (hidden on desktop via container query) -->
  <div class="mobile-only">
    <MobileSegmentControl
      currentMode={mobileMode}
      onModeChange={handleModeChange}
    />
  </div>

  <!-- Dark Mode Toggle - compact pill -->
  <div class="dark-mode-row">
    <button
      type="button"
      class="dark-mode-toggle"
      class:active={darkMode}
      class:disabled={isPreview}
      onclick={handleDarkModeToggle}
      aria-pressed={darkMode}
      disabled={isPreview}
    >
      <span class="dark-mode-icon">{darkMode ? "🌙" : "☀️"}</span>
      <span class="dark-mode-label">{darkMode ? t("visibility_dark_mode") : t("visibility_light_mode")}</span>
      <div class="dark-mode-switch" class:on={darkMode}>
        <div class="dark-mode-knob"></div>
      </div>
    </button>
  </div>

  <!-- Panels Container -->
  <div class="visibility-panels-container">
    <PictographPanel
      {tkaGlyphVisible}
      {vtgGlyphVisible}
      {elementalGlyphVisible}
      {positionsGlyphVisible}
      {reversalIndicatorsVisible}
      {gridVisible}
      {nonRadialVisible}
      {handPointVisibility}
      {stepNumbersVisible}
      onToggle={handlePictographToggle}
      isMobileHidden={mobileMode !== "pictograph"}
    />

    <div class="secondary-panels">
      <AnimationPanel
        gridVisible={gridVisible}
        stepNumbersVisible={stepNumbersVisible}
        trailStyle={animTrailStyle}
        playbackMode={animPlaybackMode}
        bpm={animBpm}
        tkaGlyphVisible={animTkaGlyphVisible}
        wordHeaderVisible={animWordHeaderVisible}
        fireEffectEnabled={animFireEffectEnabled}
        ledEffectEnabled={animLedEffectEnabled}
        ledBrightness={animLedBrightness}
        onLedBrightnessChange={handleLedBrightnessChange}
        colorBlend={animColorBlend}
        smokeLevel={animSmokeLevel}
        useCharcoal={animUseCharcoal}
        fireIntensity={animFireIntensity}
        onColorBlendChange={handleColorBlendChange}
        onSmokeLevelChange={handleSmokeLevelChange}
        onUseCharcoalChange={handleUseCharcoalChange}
        onFireIntensityChange={handleFireIntensityChange}
        onToggle={handleAnimationToggle}
        onTrailStyleChange={handleTrailStyleChange}
        onPlaybackModeChange={handlePlaybackModeChange}
        onBpmChange={handleBpmChange}
        isMobileHidden={mobileMode !== "animation"}
      />

      <ImagePanel
        addWord={imgAddWord}
        addDifficultyLevel={imgAddDifficultyLevel}
        includeStartPosition={imgIncludeStartPosition}
        showCreatorName={imgShowCreatorName}
        showNotes={imgShowNotes}
        showBirthday={imgShowBirthday}
        customNotesText={imgCustomNotesText}
        onPictographToggle={handlePictographToggle}
        onToggle={handleImageToggle}
        onCustomNotesChange={handleCustomNotesChange}
        isMobileHidden={mobileMode !== "image"}
      />
    </div>
  </div>
</div>

<style>
  .visibility-tab {
    container-type: inline-size;
    container-name: visibility-tab;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: clamp(8px, 1.5cqi, 12px);
    padding: clamp(8px, 1.5cqi, 12px);
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
    box-sizing: border-box;

    /* In modal context, --vt-height is set to 100% so the tab fills its parent.
       In settings page context, defaults to auto (content-driven). */
    height: var(--vt-height, auto);
  }

  .visibility-tab.visible {
    opacity: 1;
  }

  .mobile-only {
    width: 100%;
    flex-shrink: 0;
  }

  /* Hide mobile segment control on desktop */
  @container visibility-tab (min-width: 700px) {
    .mobile-only {
      display: none;
    }
  }

  .visibility-panels-container {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 12px);
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;

    /* In modal context, grow to fill available height.
       In settings page context, defaults to content-driven. */
    flex-grow: var(--vt-container-flex-grow, 0);
    min-height: var(--vt-container-min-h, auto);
  }

  /* Desktop: Show all panels regardless of mobile mode */
  @container visibility-tab (min-width: 700px) {
    .visibility-panels-container :global(.mobile-hidden) {
      display: flex !important;
    }
  }

  /* Secondary panels: Animation + Image side by side on desktop */
  .secondary-panels {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 12px);
    width: 100%;
  }

  @container visibility-tab (min-width: 700px) {
    .secondary-panels {
      display: grid;
      grid-template-columns: 35% 1fr;
    }
  }

  /* Dark Mode Row - right-aligned container */
  .dark-mode-row {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    max-width: 1200px;
  }

  /* Dark Mode Toggle - compact pill */
  .dark-mode-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    cursor: pointer;
    transition:
      background var(--duration-fast) ease,
      border-color var(--duration-fast) ease;
    text-align: left;
  }

  .dark-mode-toggle:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .dark-mode-toggle.active {
    background: rgba(0, 255, 255, 0.06);
    border-color: rgba(0, 255, 255, 0.25);
  }

  .dark-mode-toggle.active:hover {
    background: rgba(0, 255, 255, 0.1);
    border-color: rgba(0, 255, 255, 0.35);
  }

  .dark-mode-toggle.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  .dark-mode-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #f97316);
    outline-offset: 2px;
  }

  .dark-mode-icon {
    font-size: var(--font-size-sm, 14px);
    line-height: 1;
  }

  .dark-mode-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
    white-space: nowrap;
  }

  .dark-mode-toggle.active .dark-mode-label {
    color: #00ffff;
  }

  .dark-mode-switch {
    width: 36px;
    height: 20px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    padding: 2px;
    transition: background var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .dark-mode-switch.on {
    background: rgba(0, 255, 255, 0.4);
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
  }

  .dark-mode-knob {
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: transform var(--duration-normal) ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .dark-mode-switch.on .dark-mode-knob {
    transform: translateX(16px);
  }

  @media (prefers-reduced-motion: reduce) {
    .visibility-tab,
    .dark-mode-toggle,
    .dark-mode-switch,
    .dark-mode-knob {
      transition: none;
    }
  }
</style>
