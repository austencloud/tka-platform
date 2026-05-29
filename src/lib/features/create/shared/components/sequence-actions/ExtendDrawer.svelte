<!--
  ExtendDrawer.svelte

  Drawer for extending a sequence using LOOP (Linked Orbital Offset Pattern).

  Two-phase flow:
  1. If directly loopable → Show LOOPPicker immediately
  2. If NOT directly loopable → Show bridge pictograph grid first
     - User selects a bridge pictograph → IMMEDIATELY appends to sequence
     - Sequence is re-analyzed → should now be loopable
     - Show LOOPPicker for the now-loopable sequence
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import LOOPPicker from "$lib/shared/components/loop-picker/LOOPPicker.svelte";
  import BridgePictographGrid from "$lib/shared/components/loop-picker/BridgePictographGrid.svelte";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { ExtensionAnalysis, CircularizationOption } from "../../services/sequence-extender";
  import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";

  interface Props {
    isOpen: boolean;
    analysis: ExtensionAnalysis | null;
    /** Circularization options when sequence isn't directly loopable */
    circularizationOptions?: CircularizationOption[];
    /** Reason why direct LOOPs aren't available */
    directUnavailableReason?: string | null;
    isApplying: boolean;
    /** Measured tool panel width for desktop sizing */
    toolPanelWidth?: number;
    onClose: () => void;
    /** Called when user selects a bridge pictograph - should immediately append to sequence */
    onBridgeAppend: (bridgeLetter: Letter) => void;
    /** Called when user selects a LOOP (no bridge letter needed - already appended) */
    onApply: (loopType: LOOPType) => void;
  }

  let {
    isOpen = $bindable(),
    analysis,
    circularizationOptions = [],
    directUnavailableReason = null,
    isApplying,
    toolPanelWidth = 0,
    onClose,
    onBridgeAppend,
    onApply,
  }: Props = $props();

  // Available LOOP options (direct)
  const availableDirectOptions = $derived(analysis?.availableLOOPOptions ?? []);

  // Determine if sequence is directly loopable
  const isDirectlyLoopable = $derived(availableDirectOptions.length > 0);

  // Build inline style for drawer width when we have a valid measurement
  const drawerStyle = $derived(
    toolPanelWidth > 0 ? `--measured-panel-width: ${toolPanelWidth}px` : ""
  );

  function handleBridgeSelect(option: CircularizationOption) {
    if (isApplying) return;
    const bridgeLetter = option.bridgeLetters[0];
    if (!bridgeLetter) return;
    // Immediately append the bridge letter to the sequence
    // Parent will re-analyze and the analysis prop will update to show LOOPs
    onBridgeAppend(bridgeLetter);
  }

  function handleLoopSelect(_bridgeLetter: Letter | null, loopType: LOOPType) {
    if (isApplying) return;
    // Bridge is already appended, just apply the LOOP
    onApply(loopType);
  }

  function handleClose() {
    if (isApplying) return;
    onClose();
  }

  // Header text based on current state
  const headerTitle = $derived(isDirectlyLoopable ? "Extend" : "Choose Bridge");

  const headerSubtitle = $derived(() => {
    if (!isDirectlyLoopable) {
      return "Select a pictograph to reach a loopable position";
    }
    if (analysis?.extensionType === "half_rotation") {
      return "180° rotation patterns";
    }
    if (analysis?.extensionType === "quarter_rotation") {
      return "90° rotation patterns";
    }
    if (analysis?.extensionType === "already_complete") {
      return "Extend with pattern";
    }
    return "Extend your sequence";
  });
</script>

<div style={drawerStyle}>
  <Drawer
    bind:isOpen
    placement="right"
    onclose={handleClose}
    showHandle={false}
    respectLayoutMode={true}
    class="extend-drawer"
    backdropClass="extend-backdrop"
  >
    <div class="extend-drawer-content">
      <DrawerHeader
        title={headerTitle}
        subtitle={headerSubtitle()}
        onClose={handleClose}
      />

      {#if !analysis || (!isDirectlyLoopable && circularizationOptions.length === 0)}
        <!-- No options at all -->
        <div class="no-options">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <p>No extension patterns available for this sequence.</p>
        </div>
      {:else}
        <div class="options-container">
          <!-- Position Info -->
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

          <!-- Bridge Selection (not directly loopable) -->
          {#if !isDirectlyLoopable}
            <BridgePictographGrid
              options={circularizationOptions}
              onSelect={handleBridgeSelect}
              isLoading={isApplying}
            />
          {:else}
            <!-- LOOP Selection (directly loopable) -->
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
    </div>
  </Drawer>
</div>

<style>
  /* Position extend drawer to cover Sequence Actions panel on desktop */
  :global(.extend-drawer.side-by-side-layout) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important;
    max-width: 100% !important;
  }

  /* Backdrop transparent - we want to cover sequence actions, not dim everything */
  :global(.extend-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }

  .extend-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

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

  /* Fullscreen on mobile - browsing interface needs space */
  @media (max-width: 768px) {
    :global(.drawer-content:has(.extend-drawer)) {
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      border-radius: 0 !important;
    }
  }
</style>
