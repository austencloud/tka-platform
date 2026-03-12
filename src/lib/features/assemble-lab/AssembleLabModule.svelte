<!--
  AssembleLabModule.svelte - Standalone assemble lab (accessed from Lab tab).

  Tap grid points to build both hands' paths in any order.
  Prop animates along arc/line paths on each click.
-->
<script lang="ts">
  import { createAssembleState } from "./state/assemble-state.svelte";
  import InteractiveGrid from "./components/InteractiveGrid.svelte";
  import BuilderControls from "./components/BuilderControls.svelte";
  import BuilderInstructionHeader from "./components/BuilderInstructionHeader.svelte";
  import BuilderTurnBar from "./components/BuilderTurnBar.svelte";
  import StepStrip from "./components/StepStrip.svelte";

  const builderState = createAssembleState();
</script>

<div class="assemble">
  <BuilderInstructionHeader {builderState} />

  <div class="grid-container">
    <InteractiveGrid {builderState} />
    <BuilderControls {builderState} />
  </div>

  <BuilderTurnBar {builderState} />
  <StepStrip {builderState} />
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

  @media (max-width: 768px) {
    .assemble {
      padding: 8px;
      gap: 8px;
    }
  }
</style>
