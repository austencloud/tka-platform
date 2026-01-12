<!--
GeneratePanel.svelte - Clean, focused generation panel component

Card-based architecture with integrated Generate button:
- Settings: CardBasedSettingsContainer.svelte (card grid with all controls)
- Generate button: GenerateButtonCard.svelte (integrated into card grid)
- Config state: generateConfigState.svelte.ts
- Generation actions: generateActionsState.svelte.ts
- Device state: generateDeviceState.svelte.ts
- Responsive padding: State-driven for sync with workspace animation
- Help mode: Info button triggers learning mode for settings
-->
<script lang="ts">
  import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
  import { container } from "$lib/shared/di";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";
  import { createDeviceState } from "../state/generate-device.svelte";
  import { createGenerationActionsState } from "../state/generate-actions.svelte";
  import { createGenerationConfigState } from "../state/generate-config.svelte";
  import { createStartEndOptionsState } from "../state/start-end-options-state.svelte";
  import CardBasedSettingsContainer from "./CardBasedSettingsContainer.svelte";
  import GeneratorHelpOverlay from "./help/GeneratorHelpOverlay.svelte";
  import GeneratorHelpModal from "./help/GeneratorHelpModal.svelte";
  import HelpButtonDiscovery from "./help/HelpButtonDiscovery.svelte";
  import type { GeneratorHelpId } from "../domain/generator-help-content";

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
  let selectedControl = $state<GeneratorHelpId | null>(null);
  let hapticService = $state<IHapticFeedback | null>(null);

  // Toggle body class for z-index boosting when help mode active (selecting or viewing)
  $effect(() => {
    if (helpMode !== "inactive") {
      document.body.classList.add("generator-help-mode-active");
    } else {
      document.body.classList.remove("generator-help-mode-active");
    }
    return () => document.body.classList.remove("generator-help-mode-active");
  });

  function enterHelpMode() {
    hapticService?.trigger("selection");
    helpMode = "selecting";
  }

  function selectControlHelp(controlId: GeneratorHelpId) {
    hapticService?.trigger("selection");
    selectedControl = controlId;
    helpMode = "viewing";
  }

  function closeHelpModal() {
    // Return to selection state so user can explore other controls
    helpMode = "selecting";
    selectedControl = null;
  }

  function exitHelpMode() {
    // Fully exit help mode
    helpMode = "inactive";
    selectedControl = null;
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
  });
</script>

<div
  class="generate-panel"
  class:help-active={helpMode !== "inactive"}
  data-layout={deviceState.layoutMode}
  data-allow-scroll={deviceState.shouldAllowScrolling}
  data-is-desktop={isDesktop}
  style="--min-touch-target: {deviceState.minTouchTarget}px; --element-spacing: {deviceState.elementSpacing}px;"
>
  <!-- Help button in corner -->
  <button
    class="help-btn"
    class:active={helpMode !== "inactive"}
    onclick={enterHelpMode}
    aria-label="Help with generator settings"
  >
    <i class="fas fa-circle-question" aria-hidden="true"></i>
  </button>

  <!-- First-time discovery overlay for help button -->
  {#if helpMode === "inactive"}
    <HelpButtonDiscovery />
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
      onHelpSelect={selectControlHelp}
    />
  </div>
</div>

<!-- Help mode overlays -->
{#if helpMode !== "inactive"}
  <GeneratorHelpOverlay onClose={exitHelpMode} />
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

  /* Help button - positioned in top-right corner */
  .help-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: var(--font-size-base, 16px);
  }

  .help-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--theme-text, white);
  }

  .help-btn.active {
    /* Hide button when help mode is active - banner provides the close action */
    display: none;
  }

  .help-btn:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.9);
    outline-offset: 2px;
  }

  /* Boost panel z-index when help mode is active (above backdrop at 200) */
  :global(body.generator-help-mode-active) .generate-panel {
    z-index: 210;
  }

  /* Push content down when help banner is visible so it doesn't overlap */
  .generate-panel.help-active .generate-panel-inner {
    padding-top: calc(48px + 1rem);
  }

  .generate-panel-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: stretch; /* Default: fill space (stacked layouts) */
    min-height: 0;
    /* Mobile: Add vertical padding so panel doesn't touch viewport edges */
    padding-block: 1rem;
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

  @container generate-panel (min-aspect-ratio: 1.5) and (min-width: 800px) {
    .generate-panel-inner {
      padding: 6px min(5cqi, 48px);
    }
  }

  /* Ensure no scrolling is forced when not appropriate */
  .generate-panel[data-allow-scroll="false"] {
    overflow: hidden;
  }
</style>
