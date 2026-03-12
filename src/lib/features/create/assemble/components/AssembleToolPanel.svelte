<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  Desktop: Three-section vertical stack (header, grid, turn bar).
  Mobile: Grid fills entire panel; header and turn bar become
  semi-transparent overlays so touch targets are maximized.
-->
<script lang="ts">
  import type { AssembleTabState } from "../../shared/state/assemble-tab-state.svelte";
  import BuilderInstructionHeader from "$lib/features/assemble-lab/components/BuilderInstructionHeader.svelte";
  import BuilderControls from "$lib/features/assemble-lab/components/BuilderControls.svelte";
  import InteractiveGrid from "$lib/features/assemble-lab/components/InteractiveGrid.svelte";
  import BuilderTurnBar from "$lib/features/assemble-lab/components/BuilderTurnBar.svelte";

  let { tabState }: { tabState: AssembleTabState } = $props();

  const builderState = $derived(tabState.assembleBuilderState);
</script>

<div class="assemble-tool-panel">
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
</div>

<style>
  /* ── Desktop: flex column stack ── */
  .assemble-tool-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    padding: 0 12px 12px;
    gap: 8px;
  }

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

  /* ── Mobile: grid overlap layout ──
     All three sections occupy the same grid cell.
     The interactive grid fills 100% of the panel.
     Header and turn bar float as semi-transparent overlays. */
  @media (max-width: 768px) {
    .assemble-tool-panel {
      display: grid;
      grid-template-rows: 1fr;
      grid-template-columns: 1fr;
      gap: 0;
      padding: 8px;
    }

    .header-section,
    .grid-section,
    .turn-bar-section {
      grid-row: 1;
      grid-column: 1;
    }

    /* Header floats at top */
    .header-section {
      align-self: start;
      z-index: 5;
      pointer-events: none;
    }

    /* Grid fills entire cell */
    .grid-section {
      align-self: stretch;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Turn bar hidden on mobile — replaced by popover in BuilderControls */
    .turn-bar-section {
      display: none;
    }
  }
</style>
