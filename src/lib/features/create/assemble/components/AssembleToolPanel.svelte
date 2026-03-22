<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  Idle state (desktop): side-by-side layout with guidance panel on left, grid on right.
  Idle state (mobile): guidance card above the grid.
  Building state: grid fills entire panel, guidance panel disappears.
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

  // Whether the builder is in idle state (no steps, no prop placed)
  const isIdle = $derived(
    builderState.phase === "idle" && builderState.stepCount === 0
  );

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

<div class="assemble-tool-panel" class:idle={isIdle}>
  {#if isIdle}
    <!-- Desktop: side-by-side. Mobile: stacked. -->
    <div class="idle-layout">
      <AssembleIdlePanel {builderState} />
      <div class="grid-section idle-grid">
        <InteractiveGrid {builderState} />
        <BuilderControls {builderState} />
      </div>
    </div>
  {:else}
    <!-- Building state: standard layout -->
    <div class="header-section">
      <BuilderInstructionHeader {builderState} />
    </div>

    <div class="grid-section">
      <InteractiveGrid {builderState} />
      <BuilderControls {builderState} />
    </div>

    <div class="turn-bar-section">
      <BuilderTurnBar {builderState} />
    </div>
  {/if}
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

  /* ── Idle layout: side-by-side on desktop ── */
  .idle-layout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
    height: 100%;
    width: 100%;
    min-height: 0;
  }

  .idle-grid {
    height: 100%;
    max-width: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Building layout sections ── */
  .header-section {
    flex-shrink: 0;
  }

  .grid-section {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .turn-bar-section {
    flex-shrink: 0;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .assemble-tool-panel {
      padding: 0;
      gap: 0;
    }

    /* Idle: stack vertically */
    .idle-layout {
      flex-direction: column;
      gap: 0;
    }

    /* Building: grid overlap layout */
    .assemble-tool-panel:not(.idle) {
      display: grid;
      grid-template-rows: 1fr;
      grid-template-columns: 1fr;
    }

    .assemble-tool-panel:not(.idle) .header-section,
    .assemble-tool-panel:not(.idle) .grid-section,
    .assemble-tool-panel:not(.idle) .turn-bar-section {
      grid-row: 1;
      grid-column: 1;
    }

    .assemble-tool-panel:not(.idle) .header-section {
      align-self: start;
      z-index: 5;
      pointer-events: none;
    }

    .assemble-tool-panel:not(.idle) .grid-section {
      align-self: stretch;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .assemble-tool-panel:not(.idle) .turn-bar-section {
      display: none;
    }
  }
</style>
