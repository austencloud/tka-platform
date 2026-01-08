<script lang="ts">
  /**
   * ArrangeTab - Main component for the Compose module's Arrange tab
   *
   * Allows users to arrange compositions by selecting a mode and configuring sequences.
   * Uses Bento-style design with mode selection cards and sequence configuration panel.
   * This is the choreography workspace where sequences are combined into compositions/acts.
   *
   * Features:
   * - Mode selection grid (Single, Mirror, Tunnel, Grid)
   * - Recent compositions for quick resume
   * - Sequence configuration panel after mode selection
   */

  import { getArrangeTabState } from "./state/arrange-state.svelte";
  import { getComposeModuleState } from "$lib/features/compose/shared/state/compose-module-state.svelte";
  import ModeGrid from "./components/ModeGrid.svelte";
  import SequenceSetupPanel from "./components/SequenceSetupPanel.svelte";
  import RecentCompositions from "./components/RecentCompositions.svelte";
  import type { ComposeMode } from "$lib/features/compose/shared/state/compose-module-state.svelte";

  // Get state instances
  const arrangeState = getArrangeTabState();
  const composeModuleState = getComposeModuleState();

  // Reactive bindings
  const selectedMode = $derived(arrangeState.selectedMode);
  const sequenceSlots = $derived(arrangeState.sequenceSlots);
  const requiredSlots = $derived(arrangeState.requiredSlots);
  const isConfigurationComplete = $derived(
    arrangeState.isConfigurationComplete
  );

  // Handlers
  function handleModeSelect(mode: ComposeMode) {
    arrangeState.selectMode(mode);
  }

  function handleBack() {
    arrangeState.selectMode(null);
  }

  function handleStartPlayback() {
    if (!isConfigurationComplete || !selectedMode) {
      console.warn(
        "🎨 ArrangeTab: Cannot start playback - configuration incomplete"
      );
      return;
    }

    // Set the animation mode for playback
    composeModuleState.setCurrentMode(selectedMode);

    // Open the playback overlay (source: arrange tab)
    composeModuleState.openPlayback("arrange");
  }
</script>

<div class="arrange-tab">
  {#if !selectedMode}
    <!-- Mode Selection Grid -->
    <ModeGrid onModeSelect={handleModeSelect} />

    <!-- Recent Compositions (quick resume) -->
    <RecentCompositions />
  {:else}
    <!-- Sequence Configuration Panel -->
    <SequenceSetupPanel
      {selectedMode}
      {requiredSlots}
      {sequenceSlots}
      {isConfigurationComplete}
      onBack={handleBack}
      onSetSequence={arrangeState.setSequenceForSlot}
      onClearSlot={arrangeState.clearSlot}
      onStartPlayback={handleStartPlayback}
    />
  {/if}
</div>

<style>
  .arrange-tab {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: transparent;
    scroll-behavior: smooth;
  }

  @media (prefers-reduced-motion: reduce) {
    .arrange-tab {
      scroll-behavior: auto;
    }
  }
</style>
