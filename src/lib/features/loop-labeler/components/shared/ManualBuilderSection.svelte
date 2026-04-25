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
        onAddBeatPair={() => stepPairState!.actions.addStepPair()}
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
    background: var(--theme-card-bg);
    border: 1px dashed var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 10px;
    color: var(--muted-foreground);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .show-builder-btn:hover,
  .collapse-builder-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--foreground);
  }

  .collapse-builder-btn {
    background: color-mix(in srgb, var(--primary-color) 8%, transparent);
    border-style: solid;
    border-color: color-mix(in srgb, var(--primary-color) 30%, transparent);
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
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }
</style>
