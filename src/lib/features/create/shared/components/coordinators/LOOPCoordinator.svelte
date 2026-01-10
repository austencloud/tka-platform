<script lang="ts">
  /**
   * LOOP Coordinator Component
   *
   * Manages LOOP selection modal state at CreateModule level.
   * Extracts LOOP modal logic from LOOPCard for proper stacking context.
   *
   * Domain: Create module - LOOP Panel Coordination
   */

  import { container } from "$lib/shared/di";
  import type { ILOOPTypeResolver } from "$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver";
  import LOOPSelectionPanel from "../../../generate/components/modals/LOOPSelectionPanel.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";

  // Get context
  const ctx = getCreateModuleContext();
  const { panelState } = ctx;

  const LOOPTypeResolver: ILOOPTypeResolver = container.items.loopTypeResolver;

  // Local pending state - tracks changes before applying
  let pendingComponents = $state<Set<any> | null>(null);

  // Use pending components if available, otherwise use the original
  const displayComponents = $derived(
    pendingComponents || panelState.loopSelectedComponents || new Set()
  );

  // Event handlers
  function handleConfirm() {
    // Apply pending changes if any
    if (pendingComponents && panelState.loopOnChange) {
      // Check if the combination is implemented
      const isImplemented = LOOPTypeResolver.isImplemented(pendingComponents);

      if (!isImplemented) {
        // Show "Coming Soon" message
        const componentNames = Array.from(pendingComponents)
          .map((c) => c.charAt(0) + c.slice(1).toLowerCase())
          .join(" + ");

        alert(
          `${componentNames} combination is coming soon! This combination hasn't been implemented yet, but we're working on it.`
        );
        return; // Don't close the panel, let user select a different combination
      }

      const finalLOOPType =
        LOOPTypeResolver.generateLOOPType(pendingComponents);
      panelState.loopOnChange(finalLOOPType);
    }

    // Reset state and close
    pendingComponents = null;
    panelState.closeLOOPPanel();
  }

  function handleClose() {
    // Discard pending changes without applying them
    pendingComponents = null;
    panelState.closeLOOPPanel();
  }

  function handleToggleComponent(component: any) {
    // Initialize pending if not set
    if (!pendingComponents) {
      pendingComponents = new Set(
        panelState.loopSelectedComponents || new Set()
      );
    }

    // Toggle the component
    if (pendingComponents.has(component)) {
      pendingComponents.delete(component);
    } else {
      pendingComponents.add(component);
    }

    // Trigger reactivity
    pendingComponents = new Set(pendingComponents);
  }

  // Reset pending state when panel closes
  $effect(() => {
    if (!panelState.isLOOPPanelOpen) {
      pendingComponents = null;
    }
  });
</script>

<LOOPSelectionPanel
  isOpen={panelState.isLOOPPanelOpen}
  selectedComponents={displayComponents}
  onToggleComponent={handleToggleComponent}
  onConfirm={handleConfirm}
  onClose={handleClose}
/>
