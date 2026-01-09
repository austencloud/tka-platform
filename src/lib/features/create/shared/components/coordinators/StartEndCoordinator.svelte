<script lang="ts">
  /**
   * Start/End Options Coordinator Component
   *
   * Manages start/end options sheet state at CreateModule level.
   * Coordinates start/end position selection.
   *
   * Domain: Create module - Start/End Options Panel Coordination
   */

  import type { StartEndOptions } from "../../state/panel-coordination-state.svelte";
  import StartEndSheet from "../../../generate/components/modals/StartEndSheet.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";

  // Get context
  const ctx = getCreateModuleContext();
  const { panelState } = ctx;

  // Local pending state - tracks changes before sheet closes
  let pendingOptions = $state<StartEndOptions | null>(null);

  // Use pending options if available, otherwise use the original
  const displayOptions = $derived(
    pendingOptions ||
      panelState.startEndOptions || {
        startPosition: null,
        endPosition: null,
        mustContainLetters: [],
        mustNotContainLetters: [],
      }
  );

  function handleChange(options: StartEndOptions) {
    pendingOptions = { ...options };

    // Apply changes immediately to the callback
    if (panelState.startEndOnChange) {
      panelState.startEndOnChange(options);
    }
  }

  function handleClose() {
    // Reset pending and close
    pendingOptions = null;
    panelState.closeStartEndPanel();
  }

  // Reset pending state when panel closes
  $effect(() => {
    if (!panelState.isStartEndPanelOpen) {
      pendingOptions = null;
    }
  });
</script>

<StartEndSheet
  isOpen={panelState.isStartEndPanelOpen}
  options={displayOptions}
  onChange={handleChange}
  onClose={handleClose}
  isFreeformMode={panelState.startEndIsFreeformMode}
  gridMode={panelState.startEndGridMode}
/>
