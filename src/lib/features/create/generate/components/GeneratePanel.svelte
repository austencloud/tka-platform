<!--
GeneratePanel.svelte - Clean, focused generation panel component

Card-based architecture with integrated Generate button:
- Settings: CardBasedSettingsContainer.svelte (card grid with all controls)
- Generate button: GenerateButtonCard.svelte (integrated into card grid)
- Config state: generateConfigState.svelte.ts
- Generation actions: generateActionsState.svelte.ts
- Device state: generateDeviceState.svelte.ts
- Responsive padding: State-driven for sync with workspace animation
- Help mode: Triggered from ButtonPanel for learning mode
-->
<script lang="ts">
  import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";
  import { container } from "$lib/shared/di";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";
  import { createDeviceState } from "../state/generate-device.svelte";
  import { createGenerationActionsState } from "../state/generate-actions.svelte";
  import { createGenerationConfigState } from "../state/generate-config.svelte";
  import { createStartEndOptionsState } from "../state/start-end-options-state.svelte";
  import CardBasedSettingsContainer from "./CardBasedSettingsContainer.svelte";
  import StartEndSheet from "./modals/StartEndSheet.svelte";
  import GeneratorHelpOverlay from "./help/GeneratorHelpOverlay.svelte";
  import GeneratorHelpModal from "./help/GeneratorHelpModal.svelte";
  import type { GeneratorHelpId } from "../domain/generator-help-content";
  import {
    setGeneratorVoiceRef,
    type GeneratorVoiceRef,
  } from "../state/generator-voice-ref.svelte";
  import { uiConfigToGenerationOptions } from "../shared/utils/config-mapper";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { PropType as PropTypeEnum } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  // Get context for panel coordination (optional - may not be available in all contexts)
  const context = tryGetCreateModuleContext();
  const panelState = context?.panelState;

  // Help mode types
  type HelpMode = "inactive" | "selecting" | "viewing";

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
  const actionsState = createGenerationActionsState(
    () => sequenceState,
    () => isSequentialAnimation
  );
  const deviceState = createDeviceState();
  const startEndState = createStartEndOptionsState();

  // ===== Help Mode State =====
  let helpMode = $state<HelpMode>("inactive");
  let isExiting = $state(false); // True during exit animation
  let selectedControl = $state<GeneratorHelpId | null>(null);
  let hapticService = $state<IHapticFeedback | null>(null);

  // Toggle body class for z-index boosting when help mode active OR exiting
  $effect(() => {
    if (helpMode !== "inactive" || isExiting) {
      document.body.classList.add("generator-help-mode-active");
    } else {
      document.body.classList.remove("generator-help-mode-active");
    }
    return () => document.body.classList.remove("generator-help-mode-active");
  });

  // Listen to mobile help button trigger from ButtonPanel
  $effect(() => {
    if (panelState?.shouldEnterGeneratorHelpMode) {
      enterHelpMode();
      panelState.clearGeneratorHelpModeTrigger();
    }
  });

  function enterHelpMode(event?: MouseEvent) {
    event?.stopPropagation(); // Prevent panel click from immediately exiting
    hapticService?.trigger("selection");
    helpMode = "selecting";
  }

  function selectControlHelp(controlId: GeneratorHelpId) {
    hapticService?.trigger("selection");
    selectedControl = controlId;
    helpMode = "viewing";
  }

  function closeHelpModal() {
    // Return to selection state so user can browse other controls
    helpMode = "selecting";
    selectedControl = null;
  }

  function exitHelpMode() {
    // Start exit animation (keeps z-index boosted)
    isExiting = true;

    // After animation completes, fully exit
    setTimeout(() => {
      helpMode = "inactive";
      selectedControl = null;
      isExiting = false;
    }, 250); // Match CSS animation duration
  }

  // Handle clicks on the panel background (not on cards) to exit help mode
  function handlePanelClick(event: MouseEvent) {
    // Only act when in selecting mode (not viewing a modal)
    if (helpMode !== "selecting") return;

    // If the click was on a card, it will have stopped propagation
    // So we only get here for clicks on empty panel space
    exitHelpMode();
  }

  // ===== Device Service Integration =====
  onMount(() => {
    try {
      const deviceService = container.items.deviceDetector;
      deviceState.initializeDevice(deviceService);
    } catch (error) {
      // Fallback handled in deviceState
    }
    try {
      hapticService = container.items.hapticFeedback;
    } catch {
      // Optional service
    }

    // Register voice control ref so voice commands can access generator state
    const voiceRef: GeneratorVoiceRef = {
      getConfig: () => configState.config,
      updateConfig: (updates) => configState.updateConfig(updates),
      triggerGeneration: () => {
        const propType =
          (settingsService.settings.bluePropType as PropType) ||
          PropTypeEnum.STAFF;
        const options = uiConfigToGenerationOptions(
          configState.config,
          propType
        );
        actionsState.onGenerateClicked(options);
      },
      openHelpForControl: (controlId: GeneratorHelpId) => {
        selectControlHelp(controlId);
      },
      getCurrentPropType: () =>
        settingsService.settings.bluePropType || "staff",
    };
    setGeneratorVoiceRef(voiceRef);

    return () => {
      setGeneratorVoiceRef(null);
    };
  });

  function handlePanelKeydown(event: KeyboardEvent) {
    if (helpMode !== "selecting") return;
    if (event.key === "Escape") {
      exitHelpMode();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="generate-panel"
  class:help-active={helpMode !== "inactive"}
  data-layout={deviceState.layoutMode}
  data-allow-scroll={deviceState.shouldAllowScrolling}
  data-is-desktop={isDesktop}
  style="--min-touch-target: {deviceState.minTouchTarget}px; --element-spacing: {deviceState.elementSpacing}px;"
  onclick={handlePanelClick}
  onkeydown={handlePanelKeydown}
  role="region"
  aria-label="Generator settings panel"
>
  <!-- Desktop-only help button in top-right corner -->
  {#if isDesktop}
    <button
      class="desktop-help-button"
      onclick={enterHelpMode}
      aria-label="Help with generator settings"
      title="Help with generator settings"
    >
      <i class="fas fa-circle-question" aria-hidden="true"></i>
    </button>
  {/if}

  <div class="generate-panel-inner">
    <CardBasedSettingsContainer
      config={configState.config}
      isFreeformMode={configState.isFreeformMode}
      updateConfig={configState.updateConfig}
      isGenerating={actionsState.isGenerating}
      onGenerateClicked={actionsState.onGenerateClicked}
      {startEndState}
      helpMode={helpMode !== "inactive"}
      helpModeExiting={isExiting}
      onHelpSelect={selectControlHelp}
    />
  </div>
</div>

<!-- Start/End position drawer (rendered outside card grid for full-screen coverage) -->
{#if panelState}
  <StartEndSheet
    isOpen={panelState.isStartEndPanelOpen}
    options={panelState.startEndOptions}
    onChange={panelState.startEndOnChange ?? (() => {})}
    onClose={() => panelState.closeStartEndPanel()}
    isFreeformMode={panelState.startEndIsFreeformMode}
    gridMode={panelState.startEndGridMode}
  />
{/if}

<!-- Help mode overlays -->
{#if helpMode !== "inactive" || isExiting}
  <GeneratorHelpOverlay onClose={exitHelpMode} {isExiting} />
{/if}
{#if helpMode === "viewing" && selectedControl}
  <GeneratorHelpModal controlId={selectedControl} onClose={closeHelpModal} />
{/if}

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

  /* Boost panel z-index when help mode is active (above backdrop at 200) */
  :global(body.generator-help-mode-active) .generate-panel {
    z-index: 210;
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
