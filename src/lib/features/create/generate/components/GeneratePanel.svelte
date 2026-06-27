<!--
GeneratePanel.svelte - Clean, focused generation panel component

Card-based architecture with integrated Generate button:
- Settings: CardBasedSettingsContainer.svelte (card grid with all controls)
- Generate button: GenerateButtonCard.svelte (integrated into card grid)
- Config state: generateConfigState.svelte.ts
- Generation actions: generateActionsState.svelte.ts
- Device state: generateDeviceState.svelte.ts
- Responsive padding: State-driven for sync with workspace animation
- Tour: Guided tour triggered from help button or ButtonPanel
-->
<script lang="ts">
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { SequenceState } from "$lib/features/create/shared/state/sequence-state-orchestrator.svelte";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import type { DeviceDetector } from '$lib/shared/device/services/device-detector'
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";
  import { createDeviceState } from "../state/generate-device.svelte";
  import { createGenerationActionsState } from "../state/generate-actions.svelte";
  import { createGenerationConfigState } from "../state/generate-config.svelte";
  import { createStartEndOptionsState } from "../state/start-end-options-state.svelte";
  import { createSpellModeState } from "../state/spell-mode-state.svelte";
  import CardBasedSettingsContainer from "./CardBasedSettingsContainer.svelte";
  import WordInputOverlay from "./cards/WordInputOverlay.svelte";
  import LOOPDrawer from "./modals/LOOPDrawer.svelte";
  import CustomizeDrawer from "./modals/CustomizeDrawer.svelte";
  import PresetDrawer from "./presets/PresetDrawer.svelte";
  import { createFavoriteState } from "../state/favorite-state.svelte";
  import type { GeneratorHelpId } from "$lib/shared/create/domain/generator-help-content";
  import { generateTourState } from "$lib/shared/onboarding/state/generate-tour-state.svelte";
  import GeneratePanelTour from "$lib/shared/onboarding/components/generate-tour/GeneratePanelTour.svelte";
  import {
    setGeneratorVoiceRef,
    type GeneratorVoiceRef,
  } from "$lib/shared/create/state/generator-voice-ref.svelte";
  import { uiConfigToGenerationOptions } from "../shared/utils/config-mapper";
  import type { GenerationOptions } from "../shared/domain/models/generate-models";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { PropType as PropTypeEnum } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  // Get context for panel coordination (optional - may not be available in all contexts)
  const context = tryGetCreateModuleContext();
  const panelState = context?.panelState;

  // Props
  let {
    sequenceState,
    isDesktop = false,
  }: {
    sequenceState: SequenceState;
    isDesktop?: boolean;
  } = $props();

  // Animation is always sequential with gentle bloom
  const isSequentialAnimation = true;

  // ===== State Management =====
  const configState = createGenerationConfigState();
  const spellModeState = createSpellModeState();
  const actionsState = createGenerationActionsState(
    () => sequenceState,
    () => isSequentialAnimation,
    () => configState.config,
    () => spellModeState,
    (type, metadata) => context?.CreateModuleState.pushUndoSnapshot(type, metadata)
  );
  const deviceState = createDeviceState();
  const startEndState = createStartEndOptionsState();
  const favoriteState = createFavoriteState();

  // Spell mode: derived from word presence (if there's a word, it's spell mode)
  const hasWord = $derived(!!spellModeState.inputWord?.trim());
  const isMobile = $derived(deviceState.isMobile);

  function handleFavoriteActivated(id: string) {
    if (id === favoriteState.activeFavoriteId) {
      favoriteState.deactivateFavorite();
      return;
    }

    favoriteState.activateFavorite(id);

    // Get the config from either "mine" or a community favorite
    const fav =
      id === "mine"
        ? favoriteState.myFavorite
        : favoriteState.communityFavorites.find((f) => f.userId === id);

    if (fav) {
      configState.updateConfig(fav.config);
      if (fav.startEndOptions) {
        startEndState.setOptions(fav.startEndOptions);
      }
    }

    if (spellModeState.inputWord?.trim()) {
      spellModeState.setInputWord("");
    }

    panelState?.closePresetDrawer();
  }

  async function handleSaveAsFavorite() {
    await favoriteState.saveMyFavorite(
      configState.config,
      startEndState.options
    );
    panelState?.closePresetDrawer();
  }

  async function handleGenerate(options: GenerationOptions | null) {
    if (hasWord) {
      await actionsState.onSpellGenerate();
    } else if (options) {
      await actionsState.onGenerateClicked(options);
    }
  }

  // ===== Dirty-State Detection =====
  const hasSettingsChanged = $derived.by(() => {
    const last = actionsState.lastGeneratedConfig;
    if (!last) return false;
    const cur = configState.config;
    return (
      cur.loopEnabled !== last.loopEnabled ||
      cur.length !== last.length ||
      cur.level !== last.level ||
      cur.turnIntensity !== last.turnIntensity ||
      cur.gridMode !== last.gridMode ||
      cur.propContinuity !== last.propContinuity ||
      cur.loopType !== last.loopType ||
      cur.period !== last.period ||
      cur.constraintPreset !== last.constraintPreset ||
      cur.handPathMode !== last.handPathMode ||
      cur.motionTypeFilter !== last.motionTypeFilter
    );
  });

  let hapticService = $state<HapticFeedback | null>(null);

  // Tour trigger (desktop help button; first-run offer in the empty workspace)
  function handleHelpClick(event?: MouseEvent) {
    event?.stopPropagation();
    hapticService?.trigger("selection");
    generateTourState.start();
  }

  // ===== Device Service Integration =====
  onMount(() => {
    try {
      const deviceService = getDeviceDetector();
      deviceState.initializeDevice(deviceService);
    } catch (error) {
      // Fallback handled in deviceState
    }
    try {
      hapticService = getHapticFeedback();
    } catch {
      // Optional service
    }

    // Register voice control ref so voice commands can access generator state
    const voiceRef: GeneratorVoiceRef = {
      getConfig: () => configState.config,
      updateConfig: (updates) => configState.updateConfig(updates),
      triggerGeneration: () => {
        if (hasWord) {
          actionsState.onSpellGenerate();
        } else {
          const propType =
            (settingsService.settings.bluePropType as PropType) ||
            PropTypeEnum.STAFF;
          const options = uiConfigToGenerationOptions(
            configState.config,
            propType
          );
          actionsState.onGenerateClicked(options);
        }
      },
      openHelpForControl: (_controlId: GeneratorHelpId) => {
        generateTourState.start();
      },
      getCurrentPropType: () =>
        settingsService.settings.bluePropType || "staff",
    };
    setGeneratorVoiceRef(voiceRef);

    return () => {
      setGeneratorVoiceRef(null);
    };
  });

</script>

<div
  class="generate-panel"
  data-layout={deviceState.layoutMode}
  data-allow-scroll={deviceState.shouldAllowScrolling}
  data-is-desktop={isDesktop}
  style="--min-touch-target: {deviceState.minTouchTarget}px; --element-spacing: {deviceState.elementSpacing}px;"
  role="region"
  aria-label="Generator settings panel"
>
  <!-- Desktop-only help button in top-right corner -->
  {#if isDesktop}
    <button
      class="desktop-help-button"
      onclick={handleHelpClick}
      aria-label="Help with generator settings"
      title="Help with generator settings"
    >
      <i class="fas fa-circle-question" aria-hidden="true"></i>
    </button>
  {/if}

  <div class="generate-panel-inner">
    <CardBasedSettingsContainer
      config={configState.config}
      isFreeformMode={!hasWord}
      updateConfig={configState.updateConfig}
      isGenerating={actionsState.isGenerating}
      onGenerateClicked={handleGenerate}
      {startEndState}
      {hasSettingsChanged}
      wordInputValue={spellModeState.inputWord}
      onWordInput={(v) => spellModeState.setInputWord(v)}
      onWordSubmit={() => handleGenerate(null)}
      {isMobile}
      onOpenWordInput={() => spellModeState.openWordInput()}
      favoriteState={favoriteState}
    />
  </div>
</div>

<!-- Word input overlay - rendered outside the panel div so it can cover the full viewport on mobile -->
{#if spellModeState.isWordInputOpen}
  <WordInputOverlay
    wordValue={spellModeState.inputWord}
    onWordChange={(v) => spellModeState.setInputWord(v)}
    onClose={() => spellModeState.closeWordInput()}
  />
{/if}

<!-- Generation panels (rendered outside card grid for full-screen coverage).
     Start/End + Rhythm are handled inside the unified Customize overlay below;
     the standalone StartEndSheet / DurationRhythmSheet were removed (orphaned). -->
{#if panelState}
  <LOOPDrawer
    isOpen={panelState.isLOOPPanelOpen}
    currentType={panelState.loopCurrentType}
    selectedComponents={panelState.loopSelectedComponents}
    onChange={panelState.loopOnChange}
    onClose={() => panelState.closeLOOPPanel()}
    onLoopDisable={() => {
      panelState.closeLOOPPanel();
      configState.updateConfig({ loopEnabled: false });
    }}
  />

  <CustomizeDrawer
    isOpen={panelState.isCustomizeOverlayOpen}
    overlayProps={panelState.customizeOverlayProps}
    onClose={() => panelState.closeCustomizeOverlay()}
  />

  <PresetDrawer
    isOpen={panelState.isPresetDrawerOpen}
    myFavorite={favoriteState.myFavorite}
    communityFavorites={favoriteState.communityFavorites}
    activeFavoriteId={favoriteState.activeFavoriteId}
    isLoading={favoriteState.isLoading}
    onActivateMine={() => handleFavoriteActivated("mine")}
    onActivateCommunity={(userId) => handleFavoriteActivated(userId)}
    onSaveAsFavorite={handleSaveAsFavorite}
    onClose={() => panelState.closePresetDrawer()}
  />
{/if}

<GeneratePanelTour />

<style>
  .generate-panel {
    container-type: size;
    container-name: generate-panel;
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: visible;
    gap: 0;
  }

  .generate-panel-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: stretch; /* Default: fill space (stacked layouts) */
    min-height: 0;
    /* Mobile: Minimal vertical padding to maximize space for cards */
    padding-block: 0.25rem;
    /* Smooth transition for padding changes (syncs with 450ms workspace animation) */
    transition: padding 450ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Desktop: center cards vertically since we constrain their height, remove vertical padding */
  @media (min-width: 1024px) {
    .generate-panel-inner {
      justify-content: center;
      padding-block: 0;
    }
  }

  /* Wide squarish displays (like Z-Fold unfolded): add horizontal padding
     to prevent the generate panel from looking too stretched */
  @container generate-panel (min-width: 700px) {
    .generate-panel-inner {
      padding-inline: min(8cqi, 64px);
    }
  }

  /* Very wide landscape displays: more aggressive padding */
  @container generate-panel (min-aspect-ratio: 1.5) and (min-width: 800px) {
    .generate-panel-inner {
      padding: 6px min(10cqi, 96px);
    }
  }

  /* Ensure no scrolling is forced when not appropriate */
  .generate-panel[data-allow-scroll="false"] {
    overflow: hidden;
  }

  /* Desktop help button - positioned in top-right corner of generator panel */
  .desktop-help-button {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 1.25rem;
    color: var(--theme-text);

    /* Blue info styling */
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 70%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-info, #3b82f6) 40%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--semantic-info, #3b82f6) 30%, transparent);
  }

  .desktop-help-button:hover {
    transform: scale(1.05);
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 85%, transparent);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--semantic-info, #3b82f6) 50%, transparent);
  }

  .desktop-help-button:active {
    transform: scale(0.95);
    transition: all var(--duration-instant) ease;
  }

  .desktop-help-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
