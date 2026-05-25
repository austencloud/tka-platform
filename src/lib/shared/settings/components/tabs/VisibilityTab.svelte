<!--
  VisibilityTab.svelte - Three-panel visibility settings

  Desktop: PictographPanel, AnimationPanel, and ImagePanel side-by-side.
  Mobile: MobileSegmentControl switches between panels.

  All changes are immediate via the existing state managers.
  Same settings accessible from context menus for quick access.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { onMount } from "svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import type { TrailVisibility, PlaybackMode } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import type { VisibilityMode } from "./visibility/visibility-types";
  import MobileSegmentControl from "./visibility/MobileSegmentControl.svelte";
  import PictographPanel from "./visibility/PictographPanel.svelte";
  import AnimationPanel from "./visibility/AnimationPanel.svelte";
  import ImagePanel from "./visibility/ImagePanel.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

  const vm = getVisibilityStateManager();
  const avm = getAnimationVisibilityManager();
  const icm = getImageCompositionManager();
  let effectsConfigState: ReturnType<typeof getEffectsConfigContext> | null = null;
  try {
    effectsConfigState = getEffectsConfigContext();
  } catch {
    // Context may not be set in all host environments
  }

  let haptic: HapticFeedback | null = null;

  // Entry animation
  let isVisible = $state(false);

  // Mobile panel selection
  let mobileMode = $state<VisibilityMode>("pictograph");

  function handleModeChange(mode: VisibilityMode) {
    haptic?.trigger("selection");
    mobileMode = mode;
  }

  // Force reactivity when visibility changes
  let version = $state(0);
  function bump() { version++; }

  onMount(() => {
    try { haptic = getHapticFeedback(); } catch { /* optional */ }

    vm.registerObserver(bump, ["all"]);
    avm.registerObserver(bump);
    icm.registerObserver(bump);

    setTimeout(() => (isVisible = true), 30);

    return () => {
      vm.unregisterObserver(bump);
      avm.unregisterObserver(bump);
      icm.unregisterObserver(bump);
    };
  });

  // ── Pictograph state ──
  const showGrid = $derived.by(() => { void version; return vm.getGridVisibility(); });
  const nonRadial = $derived.by(() => { void version; return vm.getNonRadialVisibility(); });
  const tkaGlyph = $derived.by(() => { void version; return vm.getRawGlyphVisibility("tkaGlyph"); });
  const vtgGlyph = $derived.by(() => { void version; return vm.getRawGlyphVisibility("vtgGlyph"); });
  const positionsGlyph = $derived.by(() => { void version; return vm.getRawGlyphVisibility("positionsGlyph"); });
  const reversals = $derived.by(() => { void version; return vm.getRawGlyphVisibility("reversalIndicators"); });

  // ── Animation state ──
  const darkMode = $derived(getSettings().darkMode ?? false);
  const animGridMode = $derived.by(() => { void version; return avm.getGridMode(); });
  const animStepNumbers = $derived.by(() => { void version; return avm.getSettings().stepNumbers; });
  const animProps = $derived.by(() => { void version; return avm.getSettings().props; });
  const animPathLines = $derived.by(() => { void version; return avm.getSettings().pathLines; });
  const animWordHeader = $derived.by(() => { void version; return avm.getSettings().wordHeader; });
  const animProgressBar = $derived.by(() => { void version; return avm.getSettings().progressBar; });
  const animTrailStyle = $derived.by(() => {
    void version;
    const tipMap = effectsConfigState?.tipEffectMap ?? {};
    const trailsActive = Object.values(tipMap).some(a => a.effect === "trails");
    return trailsActive ? "on" : "off";
  });
  const animPlaybackMode = $derived.by(() => { void version; return avm.getPlaybackMode(); });
  const animBpm = $derived.by(() => { void version; return avm.getBpm(); });
  const animTkaGlyph = $derived.by(() => { void version; return avm.getSettings().tkaGlyph; });

  // ── Image/Card state ──
  const imgWord = $derived.by(() => { void version; return icm.addWord; });
  const imgDifficulty = $derived.by(() => { void version; return icm.addDifficultyLevel; });
  const imgStartPos = $derived.by(() => { void version; return icm.includeStartPosition; });
  const imgCreator = $derived.by(() => { void version; return icm.showCreatorName; });
  const imgNotes = $derived.by(() => { void version; return icm.showNotes; });
  const imgBirthday = $derived.by(() => { void version; return icm.showBirthday; });
  const imgQR = $derived.by(() => { void version; return icm.showQRCode; });
  const imgLoopGlyph = $derived.by(() => { void version; return icm.showLoopGlyph; });
  const imgStepNumbers = $derived.by(() => { void version; return icm.addStepNumbers; });
  const imgCustomNotes = $derived.by(() => { void version; return icm.customNotesText; });

  // ── Toggle helpers ──
  function tap(fn: () => void) {
    haptic?.trigger("selection");
    fn();
  }

  // ── Pictograph toggle handler ──
  function handlePictographToggle(key: string) {
    switch (key) {
      case "grid": tap(() => vm.setGridVisibility(!showGrid)); break;
      case "tka": tap(() => vm.setGlyphVisibility("tkaGlyph", !tkaGlyph)); break;
      case "vtg": tap(() => {
        const next = !vtgGlyph;
        vm.setGlyphVisibility("vtgGlyph", next);
        vm.setGlyphVisibility("elementalGlyph", next);
      }); break;
      case "positions": tap(() => vm.setGlyphVisibility("positionsGlyph", !positionsGlyph)); break;
      case "reversals": tap(() => vm.setGlyphVisibility("reversalIndicators", !reversals)); break;
      case "nonRadial": tap(() => vm.setNonRadialVisibility(!nonRadial)); break;
    }
  }

  // ── Animation toggle handler ──
  function handleAnimationToggle(key: string) {
    switch (key) {
      case "gridOff": tap(() => avm.setGridMode("none")); break;
      case "grid8pt": tap(() => avm.setGridMode("8point")); break;
      case "gridAuto": tap(() => avm.setGridMode("auto")); break;
      case "darkMode": tap(() => {
        const next = !darkMode;
        void updateSettings({ darkMode: next });
        avm.setDarkMode(next);
      }); break;
      case "props": tap(() => avm.setVisibility("props", !animProps)); break;
      case "stepNumbers": tap(() => avm.setVisibility("stepNumbers", !animStepNumbers)); break;
      case "pathLines": tap(() => avm.setVisibility("pathLines", !animPathLines)); break;
      case "wordHeader": tap(() => avm.setVisibility("wordHeader", !animWordHeader)); break;
      case "progressBar": tap(() => avm.setVisibility("progressBar", !animProgressBar)); break;
      case "tkaGlyph": tap(() => avm.setVisibility("tkaGlyph", !animTkaGlyph)); break;
    }
  }

  // ── Animation specialized handlers ──
  function handleTrailStyleChange(style: TrailVisibility) {
    tap(() => {
      const effect = style === "on" ? "trails" : "none";
      effectsConfigState?.setActiveEffect(effect);
    });
  }

  function handlePlaybackModeChange(mode: PlaybackMode) {
    tap(() => avm.setPlaybackMode(mode));
  }

  function handleBpmChange(bpm: number) {
    tap(() => avm.setBpm(bpm));
  }

  // ── Image toggle handler ──
  function handleImageToggle(key: string) {
    switch (key) {
      case "word": tap(() => icm.setAddWord(!imgWord)); break;
      case "stepNumbers": tap(() => icm.setAddBeatNumbers(!imgStepNumbers)); break;
      case "difficulty": tap(() => icm.setAddDifficultyLevel(!imgDifficulty)); break;
      case "startPosition": tap(() => icm.setIncludeStartPosition(!imgStartPos)); break;
      case "creatorName": tap(() => icm.setShowCreatorName(!imgCreator)); break;
      case "notes": tap(() => icm.setShowNotes(!imgNotes)); break;
      case "birthday": tap(() => icm.setShowBirthday(!imgBirthday)); break;
      case "qrCode": tap(() => icm.setShowQRCode(!imgQR)); break;
      case "loopGlyph": tap(() => icm.setShowLoopGlyph(!imgLoopGlyph)); break;
    }
  }

  function handleCustomNotesChange(value: string) {
    icm.setCustomNotesText(value);
  }
</script>

<div class="visibility-tab" class:visible={isVisible}>
  <!-- Mobile: Segmented Control -->
  <div class="mobile-only">
    <MobileSegmentControl currentMode={mobileMode} onModeChange={handleModeChange} />
  </div>

  <!-- Panels Container -->
  <div class="visibility-panels-container">
    <PictographPanel
      {showGrid}
      tkaGlyphVisible={tkaGlyph}
      vtgGlyphVisible={vtgGlyph}
      positionsGlyphVisible={positionsGlyph}
      reversalIndicatorsVisible={reversals}
      nonRadialVisible={nonRadial}
      onToggle={handlePictographToggle}
      isMobileHidden={mobileMode !== "pictograph"}
    />

    <AnimationPanel
      gridMode={animGridMode}
      stepNumbersVisible={animStepNumbers}
      armsVisible={true}
      propsVisible={animProps}
      pathLinesVisible={animPathLines}
      trailStyle={animTrailStyle}
      playbackMode={animPlaybackMode}
      bpm={animBpm}
      tkaGlyphVisible={animTkaGlyph}
      wordHeaderVisible={animWordHeader}
      progressBarVisible={animProgressBar}
      onToggle={handleAnimationToggle}
      onTrailStyleChange={handleTrailStyleChange}
      onPlaybackModeChange={handlePlaybackModeChange}
      onBpmChange={handleBpmChange}
      isMobileHidden={mobileMode !== "animation"}
    />

    <ImagePanel
      addWord={imgWord}
      addStepNumbers={imgStepNumbers}
      addDifficultyLevel={imgDifficulty}
      includeStartPosition={imgStartPos}
      showQRCode={imgQR}
      showLoopGlyph={imgLoopGlyph}
      showCreatorName={imgCreator}
      showNotes={imgNotes}
      showBirthday={imgBirthday}
      customNotesText={imgCustomNotes}
      {darkMode}
      onToggle={handleImageToggle}
      onCustomNotesChange={handleCustomNotesChange}
      onPictographToggle={handlePictographToggle}
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
    overflow-y: auto;
    max-height: 100%;
  }

  .visibility-tab.visible {
    opacity: 1;
  }

  .mobile-only {
    width: 100%;
    flex-shrink: 0;
  }

  /* Hide mobile segment on desktop */
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

  /* Desktop: side by side */
  @container visibility-tab (min-width: 700px) {
    .visibility-panels-container {
      flex-direction: row;
      align-items: stretch;
    }

    /* Show all panels on desktop regardless of mobile mode */
    .visibility-panels-container :global(.mobile-hidden) {
      display: flex !important;
    }
  }

  /* Mobile column: undo the panels' desktop `flex: 1 1 0; overflow: hidden`,
     which collapses to min-content here and clips everything below the header. */
  @container visibility-tab (max-width: 699px) {
    .visibility-panels-container :global(.settings-panel) {
      flex: 0 0 auto;
      overflow: visible;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .visibility-tab {
      transition: none;
    }
  }
</style>
