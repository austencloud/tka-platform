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
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
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
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
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

  // UI state — restore persisted panel or default to "pictograph"
  const VALID_PANELS: VisibilityMode[] = ["pictograph", "animation", "image"];
  const savedPanel = navigationState.getLastPanelForTab("settings", "visibility");
  let activePanel = $state<VisibilityMode>(
    savedPanel && VALID_PANELS.includes(savedPanel as VisibilityMode)
      ? (savedPanel as VisibilityMode)
      : "pictograph"
  );
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
    activePanel = mode;
    navigationState.setLastPanelForTab(mode, "settings", "visibility");
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
    imageCompositionManager.registerObserver(imageObserver);

    // Entry animation
    setTimeout(() => (isVisible = true), 30);

    return () => {
      visibilityManager.unregisterObserver(pictographObserver);
      imageCompositionManager.unregisterObserver(imageObserver);
    };
  });
</script>

<div class="visibility-tab" class:visible={isVisible}>
  <!-- Top bar: dark mode toggle + segment control -->
  <div class="top-bar">
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

    <MobileSegmentControl
      currentMode={activePanel}
      onModeChange={handleModeChange}
    />
  </div>

  <!-- Hero Panel: selected panel gets full width -->
  <div class="hero-panel">
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
      isMobileHidden={activePanel !== "pictograph"}
    />

    <AnimationPanel isMobileHidden={activePanel !== "animation"} />

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
      isMobileHidden={activePanel !== "image"}
    />
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

  /* Top bar: dark mode toggle + segment control in a row */
  .top-bar {
    display: flex;
    align-items: center;
    gap: clamp(8px, 1.5cqi, 16px);
    width: 100%;
    max-width: 1000px;
    flex-shrink: 0;
  }

  /* Hero panel: selected panel is full width, others hidden via isMobileHidden */
  .hero-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 12px);
    width: 100%;
    max-width: 1000px;

    /* In modal context, grow to fill available height.
       In settings page context, defaults to content-driven. */
    flex-grow: var(--vt-container-flex-grow, 0);
    min-height: var(--vt-container-min-h, auto);
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
