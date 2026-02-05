<!--
  PropSelectionSheet.svelte
  Drawer for selecting props - right on desktop, bottom on mobile
  Uses BentoPropGrid to show all variations organized by family.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import BentoPropGrid from "./BentoPropGrid.svelte";

  let {
    isOpen = $bindable(false),
    selectedPropType,
    color = "blue",
    title = "Select Prop",
    onSelect,
  } = $props<{
    isOpen?: boolean;
    selectedPropType: PropType;
    color?: "blue" | "red";
    title?: string;
    onSelect: (propType: PropType) => void;
  }>();

  // Services
  let deviceDetector: IDeviceDetector | null = null;

  // Drawer placement based on device
  let placement = $state<"bottom" | "right">("right");

  onMount(() => {
    deviceDetector = container.items.deviceDetector as IDeviceDetector;
    updatePlacement();

    const cleanup = deviceDetector?.onCapabilitiesChanged(() => {
      updatePlacement();
    });

    return () => cleanup?.();
  });

  function updatePlacement() {
    if (!deviceDetector) return;
    const navigationLayout = deviceDetector.getNavigationLayoutImmediate();
    // Bottom navigation = bottom drawer, Top/Left navigation = right drawer
    placement = navigationLayout === "bottom" ? "bottom" : "right";
  }

  function handlePropSelect(propType: PropType) {
    const hapticService = container.items.hapticFeedback;
    hapticService?.trigger("selection");
    onSelect(propType);
    isOpen = false;
  }
</script>

<Drawer
  {isOpen}
  {placement}
  closeOnBackdrop={true}
  closeOnEscape={true}
  dismissible={true}
  showHandle={true}
  ariaLabel={title}
  class="prop-selection-drawer"
  onOpenChange={(open) => {
    if (!open) isOpen = false;
  }}
>
  <!-- Bento grid shows all variations organized by family -->
  <div class="sheet-content">
    <BentoPropGrid
      {selectedPropType}
      {color}
      {title}
      onSelect={handlePropSelect}
    />
  </div>
</Drawer>

<style>
  /* Bottom sheet constraint - only cover prop controls area, not beat grid */
  :global(.prop-selection-drawer[data-placement="bottom"]) {
    max-height: 70vh;
    height: auto;
  }

  /* Right drawer - wider to accommodate Bento grid */
  :global(.prop-selection-drawer[data-placement="right"]) {
    width: min(480px, 90vw);
  }

  /* Content - fills drawer */
  .sheet-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px;
  }
</style>
