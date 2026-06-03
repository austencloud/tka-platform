<!--
  ExtendView.svelte

  Chrome-free sequence-extension body, rendered INLINE inside the Sequence
  Actions panel as a drill-down view (no Drawer wrapper).

  Two-phase flow:
  1. Directly loopable → show LOOPPicker immediately
  2. Not directly loopable → show bridge pictograph grid; selecting a bridge
     appends it, the parent re-analyzes, and the LOOPPicker appears.

  The header title/subtitle are owned by the panel's shared sub-view header
  (it holds the analysis state); this view renders the options body only.
-->
<script lang="ts">
  import LOOPPicker from "$lib/shared/components/loop-picker/LOOPPicker.svelte";
  import BridgePictographGrid from "$lib/shared/components/loop-picker/BridgePictographGrid.svelte";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type {
    ExtensionAnalysis,
    CircularizationOption,
  } from "../../services/sequence-extender";
  import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";

  interface Props {
    analysis: ExtensionAnalysis | null;
    circularizationOptions?: CircularizationOption[];
    directUnavailableReason?: string | null;
    isApplying: boolean;
    onBridgeAppend: (bridgeLetter: Letter) => void;
    onApply: (loopType: LOOPType) => void;
  }

  let {
    analysis,
    circularizationOptions = [],
    directUnavailableReason = null,
    isApplying,
    onBridgeAppend,
    onApply,
  }: Props = $props();

  const availableDirectOptions = $derived(analysis?.availableLOOPOptions ?? []);
  const isDirectlyLoopable = $derived(availableDirectOptions.length > 0);

  function handleBridgeSelect(option: CircularizationOption) {
    if (isApplying) return;
    const bridgeLetter = option.bridgeLetters[0];
    if (!bridgeLetter) return;
    onBridgeAppend(bridgeLetter);
  }

  function handleLoopSelect(_bridgeLetter: Letter | null, loopType: LOOPType) {
    if (isApplying) return;
    onApply(loopType);
  }
</script>

{#if !analysis || (!isDirectlyLoopable && circularizationOptions.length === 0)}
  <div class="no-options">
    <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
    <p>No extension patterns available for this sequence.</p>
  </div>
{:else}
  <div class="options-container">
    <div class="position-info">
      <div class="position-row">
        <span class="label">Start:</span>
        <span class="position">{analysis.startPosition}</span>
      </div>
      <div class="position-row">
        <span class="label">End:</span>
        <span class="position">{analysis.currentEndPosition}</span>
      </div>
    </div>

    {#if !isDirectlyLoopable}
      <BridgePictographGrid
        options={circularizationOptions}
        onSelect={handleBridgeSelect}
        isLoading={isApplying}
      />
    {:else}
      <LOOPPicker
        directOptions={availableDirectOptions}
        circularizationOptions={[]}
        onSelect={handleLoopSelect}
        directUnavailableReason={null}
        {isApplying}
      />
    {/if}
  </div>
{/if}

<style>
  .no-options {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 24px;
    text-align: center;
    color: var(--theme-text-dim);
    flex: 1;
  }

  .no-options i {
    font-size: var(--font-size-2xl, 2rem);
    opacity: 0.6;
  }

  .options-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 16px;
    overflow-y: auto;
  }

  .position-info {
    display: flex;
    justify-content: space-between;
    padding: 12px;
    background: var(--theme-card-bg);
    border-radius: var(--radius-md, 8px);
    font-size: var(--font-size-sm, 14px);
    flex-shrink: 0;
  }

  .position-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .label {
    color: var(--theme-text-dim);
  }

  .position {
    font-family: monospace;
    font-weight: 500;
    color: var(--theme-accent);
  }
</style>
