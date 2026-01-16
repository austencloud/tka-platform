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
    type TrailStyle,
    type PlaybackMode,
  } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

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
  let animTrailStyle = $state<TrailStyle>("on");
  let animPlaybackMode = $state<PlaybackMode>("continuous");
  let animBpm = $state(60);
  let animTkaGlyphVisible = $state(true);
  let animWordHeaderVisible = $state(true);

  // Image composition state
  let imgAddWord = $state(true);
  let imgAddDifficultyLevel = $state(false);
  let imgIncludeStartPosition = $state(true);
  // Granular footer controls
  let imgShowCreatorName = $state(true);
  let imgShowNotes = $state(true);
  let imgShowBirthday = $state(true);
  let imgCustomNotesText = $state("Created using TKA Scribe");
  let imgDarkMode = $state(false);

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
    }
  }

  function handleTrailStyleChange(newStyle: string) {
    triggerHaptic();
    animationVisibilityManager.setTrailStyle(newStyle as TrailStyle);
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
      case "darkMode":
        imgDarkMode = !imgDarkMode;
        imageCompositionManager.setDarkMode(imgDarkMode);
        break;
    }
  }

  function handleCustomNotesChange(value: string) {
    triggerHaptic();
    imgCustomNotesText = value;
    imageCompositionManager.setCustomNotesText(value);
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback as IHapticFeedback;

    // Load initial pictograph visibility
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

    // Load initial animation visibility
    animTrailStyle = animationVisibilityManager.getTrailStyle();
    animPlaybackMode = animationVisibilityManager.getPlaybackMode();
    animBpm = animationVisibilityManager.getBpm();
    animTkaGlyphVisible = animationVisibilityManager.getVisibility("tkaGlyph");
    animWordHeaderVisible =
      animationVisibilityManager.getVisibility("wordHeader");

    // Load initial image composition
    imgAddWord = imageCompositionManager.addWord;
    imgAddDifficultyLevel = imageCompositionManager.addDifficultyLevel;
    imgIncludeStartPosition = imageCompositionManager.includeStartPosition;
    // Granular footer controls
    imgShowCreatorName = imageCompositionManager.showCreatorName;
    imgShowNotes = imageCompositionManager.showNotes;
    imgShowBirthday = imageCompositionManager.showBirthday;
    imgCustomNotesText = imageCompositionManager.customNotesText;
    imgDarkMode = imageCompositionManager.darkMode;

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
      imgDarkMode = imageCompositionManager.darkMode;
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

    <AnimationPanel
      gridVisible={gridVisible}
      stepNumbersVisible={stepNumbersVisible}
      trailStyle={animTrailStyle}
      playbackMode={animPlaybackMode}
      bpm={animBpm}
      tkaGlyphVisible={animTkaGlyphVisible}
      wordHeaderVisible={animWordHeaderVisible}
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
      darkMode={imgDarkMode}
      onPictographToggle={handlePictographToggle}
      onToggle={handleImageToggle}
      onCustomNotesChange={handleCustomNotesChange}
      isMobileHidden={mobileMode !== "image"}
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
    transition: opacity 200ms ease;
    box-sizing: border-box;
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
  }

  /* Desktop: Side by side - all panels match tallest panel's height */
  @container visibility-tab (min-width: 700px) {
    .visibility-panels-container {
      flex-direction: row;
      /* Stretch all panels to match the tallest (Animation panel) */
      align-items: stretch;
    }

    /* Show all panels on desktop regardless of mobile mode */
    .visibility-panels-container :global(.mobile-hidden) {
      display: flex !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .visibility-tab {
      transition: none;
    }
  }
</style>
