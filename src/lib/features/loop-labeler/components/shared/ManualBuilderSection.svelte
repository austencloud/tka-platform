<!--
  Manual Builder Section

  Collapsible panel for manual LOOP designation building.
  Contains mode toggle and mode-specific panels.
-->
<script lang="ts">
  import type { LabelingMode } from "../../state/loop-labeler-state.svelte";
  import type { createSectionModeState } from "../../state/section-mode-state.svelte";
  import type { createBeatPairModeState } from "../../state/steppair-mode-state.svelte";
  import type { createWholeModeState } from "../../state/whole-mode-state.svelte";

  import ComponentSelectionPanel from "../panels/ComponentSelectionPanel.svelte";
  import SectionModePanel from "../panels/SectionModePanel.svelte";
  import StepPairModePanel from "../panels/StepPairModePanel.svelte";
  import WholeModePanel from "../panels/WholeModePanel.svelte";

  interface Props {
    showManualBuilder: boolean;
    labelingMode: LabelingMode;
    sectionState: ReturnType<typeof createSectionModeState> | undefined;
    stepPairState: ReturnType<typeof createBeatPairModeState> | undefined;
    wholeState: ReturnType<typeof createWholeModeState> | undefined;
    derivedLoopType: string | null;
    notes: string;
    onToggleBuilder: (show: boolean) => void;
    onLabelingModeChange: (mode: LabelingMode) => void;
    onAddSection: () => void;
    onRemoveSection: (index: number) => void;
    onMarkUnknown: () => void;
    onNext: () => void;
    onAddDesignation: () => void;
  }

  let {
    showManualBuilder,
    labelingMode,
    sectionState,
    stepPairState,
    wholeState,
    derivedLoopType,
    notes,
    onToggleBuilder,
    onLabelingModeChange,
    onAddSection,
    onRemoveSection,
    onMarkUnknown,
    onNext,
    onAddDesignation,
  }: Props = $props();
</script>

{#if showManualBuilder}
  <div class="manual-builder-section">
    <button class="collapse-builder-btn" onclick={() => onToggleBuilder(false)}>
      <span>Hide Manual Builder</span>
      <span class="chevron">▲</span>
    </button>

    <!-- Mode Toggle -->
    <ComponentSelectionPanel {labelingMode} {onLabelingModeChange} />

    <!-- Mode-specific builder panels -->
    {#if labelingMode === "section" && sectionState}
      <SectionModePanel
        selectedSteps={sectionState.selectedSteps}
        selectedComponents={sectionState.selectedComponents}
        savedSections={sectionState.savedSections}
        selectedBaseWord={sectionState.selectedBaseWord}
        onBaseWordChange={(bw) => sectionState!.actions.setBaseWord(bw)}
        {onAddSection}
        {onRemoveSection}
        {onMarkUnknown}
        {onNext}
        canProceed={sectionState.selectedSteps.size === 0 &&
          sectionState.selectedComponents.size === 0}
      />
    {:else if labelingMode === "steppair" && stepPairState}
      <StepPairModePanel
        firstStep={stepPairState.firstStep}
        secondStep={stepPairState.secondStep}
        selectedComponents={stepPairState.selectedComponents}
        transformationIntervals={stepPairState.transformationIntervals}
        onClearSelection={() => stepPairState!.actions.clearSelection()}
        onToggleComponent={(c) => stepPairState!.actions.toggleComponent(c)}
        onSetInterval={(key, val) =>
          stepPairState!.actions.setTransformationInterval(key, val)}
        onAddBeatPair={() => stepPairState!.actions.addBeatPair()}
      />
    {:else if labelingMode === "whole" && wholeState}
      <WholeModePanel
        selectedComponents={wholeState.selectedComponents}
        transformationIntervals={wholeState.transformationIntervals}
        onToggleComponent={(c) => wholeState!.actions.toggleComponent(c)}
        onSetInterval={(key, val) =>
          wholeState!.actions.setTransformationInterval(key, val)}
        {onAddDesignation}
      />
    {/if}
  </div>
{:else}
  <button class="show-builder-btn" onclick={() => onToggleBuilder(true)}>
    <span>+ Add Manual Designation</span>
    <span class="chevron">▼</span>
  </button>
{/if}

<style>
  .show-builder-btn,
  .collapse-builder-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.03);
    border: 1px dashed var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 10px;
    color: var(--muted-foreground);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .show-builder-btn:hover,
  .collapse-builder-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.25);
    color: var(--foreground);
  }

  .collapse-builder-btn {
    background: rgba(99, 102, 241, 0.08);
    border-style: solid;
    border-color: rgba(99, 102, 241, 0.3);
    color: var(--foreground);
  }

  .chevron {
    font-size: 0.75em;
    opacity: 0.6;
  }

  .manual-builder-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }
</style>
