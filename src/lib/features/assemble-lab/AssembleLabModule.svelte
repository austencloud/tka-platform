<!--
  AssembleLabModule.svelte - Standalone assemble lab (accessed from Lab tab).
-->
<script lang="ts">
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { createAssembleState } from "./state/assemble-state.svelte";
  import InteractiveGrid from "./components/InteractiveGrid.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import BuilderInstructionHeader from "./components/BuilderInstructionHeader.svelte";
  import BuilderTurnBar from "./components/BuilderTurnBar.svelte";
  import StepStrip from "./components/StepStrip.svelte";
  import AssembleIdlePanel from "./components/AssembleIdlePanel.svelte";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";

  const builderState = createAssembleState();

  let isIdle = $state(true);
  let prevPhaseIdle = true;

  // Track idle→building transitions.
  $effect.pre(() => {
    const currentlyIdle = builderState.phase === "idle" && builderState.stepCount === 0;
    if (prevPhaseIdle && !currentlyIdle) {
      isIdle = false;
    } else if (!prevPhaseIdle && currentlyIdle) {
      isIdle = true;
    }
    prevPhaseIdle = currentlyIdle;
  });

  // Load last-used grid preferences from settings
  let settingsState: ISettingsState | null = null;
  try {
    settingsState = settingsService as ISettingsState;
    const saved = settingsState.currentSettings;
    if (saved.preferredGridMode) {
      builderState.setGridMode(saved.preferredGridMode);
    }
    if (saved.preferredShowCenter) {
      builderState.setShowCenter(saved.preferredShowCenter);
    }
  } catch {
    // Settings unavailable — use defaults
  }

  $effect(() => {
    const mode = builderState.gridMode;
    const center = builderState.showCenter;
    if (settingsState) {
      void settingsState.updateSetting("preferredGridMode", mode);
      void settingsState.updateSetting("preferredShowCenter", center);
    }
  });
</script>

<div class="assemble">
  <div class="header-section" class:hidden={isIdle}>
    <BuilderInstructionHeader {builderState} />
  </div>

  <div class="main-area">
    {#if isIdle}
      <div class="panel-slot">
        <AssembleIdlePanel {builderState} />
      </div>
    {/if}

    <div class="grid-slot">
      <InteractiveGrid {builderState} />
      <BuilderControls {builderState} />
    </div>
  </div>

  <div class="footer-section" class:hidden={isIdle}>
    <BuilderTurnBar {builderState} />
    <StepStrip {builderState} />
  </div>
</div>

<style>
  .assemble {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 12px;
    gap: 12px;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .header-section,
  .footer-section {
    flex-shrink: 0;
    width: 100%;
  }

  .header-section.hidden,
  .footer-section.hidden {
    display: none;
  }

  .main-area {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
  }

  .panel-slot {
    flex: 0 0 auto;
  }

  .grid-slot {
    flex: 0 0 auto;
    width: 65vh;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    view-transition-name: assemble-grid;
  }

  .grid-slot :global(.interactive-grid) {
    max-width: 100%;
    max-height: 100%;
  }

  :global(::view-transition-old(assemble-grid)),
  :global(::view-transition-new(assemble-grid)) {
    animation-duration: 0.4s;
    animation-timing-function: ease;
  }

  @media (max-width: 768px) {
    .assemble {
      padding: 8px;
      gap: 8px;
    }

    .main-area {
      flex-direction: column;
      gap: 0;
    }

    .grid-slot {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-slot {
      view-transition-name: none;
    }
  }
</style>
