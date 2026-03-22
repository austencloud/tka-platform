<!--
  AssembleLabModule.svelte - Standalone assemble lab (accessed from Lab tab).

  Idle: side-by-side guidance panel + grid.
  Building: grid fills entire space.
-->
<script lang="ts">
  import { createAssembleState } from "./state/assemble-state.svelte";
  import InteractiveGrid from "./components/InteractiveGrid.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import BuilderInstructionHeader from "./components/BuilderInstructionHeader.svelte";
  import BuilderTurnBar from "./components/BuilderTurnBar.svelte";
  import StepStrip from "./components/StepStrip.svelte";
  import AssembleIdlePanel from "./components/AssembleIdlePanel.svelte";
  import { container } from "$lib/shared/di";
  import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";

  const builderState = createAssembleState();

  const isIdle = $derived(
    builderState.phase === "idle" && builderState.stepCount === 0
  );

  // Load last-used grid preferences from settings
  let settingsState: ISettingsState | null = null;
  try {
    settingsState = container.items.settingsState as ISettingsState;
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

<div class="assemble" class:idle={isIdle}>
  {#if isIdle}
    <div class="idle-layout">
      <AssembleIdlePanel {builderState} />
      <div class="grid-container idle-grid">
        <InteractiveGrid {builderState} />
        <BuilderControls {builderState} />
      </div>
    </div>
  {:else}
    <BuilderInstructionHeader {builderState} />

    <div class="grid-container">
      <InteractiveGrid {builderState} />
      <BuilderControls {builderState} />
    </div>

    <BuilderTurnBar {builderState} />
    <StepStrip {builderState} />
  {/if}
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

  /* ── Idle: side-by-side ── */
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

  /* ── Building: standard ── */
  .grid-container {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .grid-container :global(.interactive-grid) {
    max-width: 100%;
    max-height: 100%;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .assemble {
      padding: 8px;
      gap: 8px;
    }

    .idle-layout {
      flex-direction: column;
      gap: 0;
    }
  }
</style>
