<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  Idle: side-by-side guidance panel + grid, centered together.
  Building: panel disappears, grid recenters via flex layout.
-->
<script lang="ts">
  import type { AssembleTabState } from "../../shared/state/assemble-tab-state.svelte";
  import BuilderInstructionHeader from "$lib/features/assemble-lab/components/BuilderInstructionHeader.svelte";
  import BuilderControls from "$lib/features/assemble-lab/components/BuilderControls.svelte";
  import InteractiveGrid from "$lib/features/assemble-lab/components/InteractiveGrid.svelte";
  import BuilderTurnBar from "$lib/features/assemble-lab/components/BuilderTurnBar.svelte";
  import AssembleIdlePanel from "$lib/features/assemble-lab/components/AssembleIdlePanel.svelte";
  import { container } from "$lib/shared/di";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";

  let { tabState }: { tabState: AssembleTabState } = $props();

  const builderState = $derived(tabState.assembleBuilderState);

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
    settingsState = container.items.settingsState as ISettingsState;
    const saved = settingsState.currentSettings;
    if (saved.preferredGridMode) {
      tabState.assembleBuilderState.setGridMode(saved.preferredGridMode);
    }
    if (saved.preferredShowCenter) {
      tabState.assembleBuilderState.setShowCenter(saved.preferredShowCenter);
    }
  } catch {
    // Settings unavailable — use defaults
  }

  // Persist grid mode changes for next session
  $effect(() => {
    const mode = builderState.gridMode;
    const center = builderState.showCenter;
    if (settingsState) {
      void settingsState.updateSetting("preferredGridMode", mode);
      void settingsState.updateSetting("preferredShowCenter", center);
    }
  });
</script>

<div class="assemble-tool-panel">
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

  <div class="turn-bar-section" class:hidden={isIdle}>
    <BuilderTurnBar {builderState} />
  </div>
</div>

<style>
  .assemble-tool-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    padding: 0 12px 12px;
    gap: 8px;
  }

  .header-section,
  .turn-bar-section {
    flex-shrink: 0;
  }

  .header-section.hidden,
  .turn-bar-section.hidden {
    display: none;
  }

  .main-area {
    flex: 1;
    min-height: 0;
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

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .assemble-tool-panel {
      padding: 0;
      gap: 0;
    }

    .main-area {
      flex-direction: column;
      gap: 0;
    }

    .grid-slot {
      width: 100%;
    }

    .header-section:not(.hidden) {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 5;
      pointer-events: none;
    }

    .turn-bar-section {
      display: none;
    }
  }

  /* View transition timing (used by tab-switching view transitions) */
  :global(::view-transition-old(assemble-grid)),
  :global(::view-transition-new(assemble-grid)) {
    animation-duration: 0.4s;
    animation-timing-function: ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-slot {
      view-transition-name: none;
    }
  }
</style>
