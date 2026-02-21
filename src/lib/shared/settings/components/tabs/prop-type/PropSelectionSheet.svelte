<!--
  PropSelectionSheet.svelte
  Bottom drawer for selecting props.
  Uses BentoPropGrid to show all variations organized by family.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
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

  function handlePropSelect(propType: PropType) {
    const hapticService = container.items.hapticFeedback;
    hapticService?.trigger("selection");
    onSelect(propType);
    isOpen = false;
  }
</script>

<Drawer
  {isOpen}
  placement="bottom"
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
  /* Bottom drawer sizing - centered with margin auto (avoids transform conflicts with drag) */
  :global(.prop-selection-drawer[data-placement="bottom"]) {
    height: fit-content;
    max-height: 70vh;
    min-height: 0 !important;
    max-width: 480px;
    left: 0 !important;
    right: 0 !important;
    margin-left: auto;
    margin-right: auto;
    border-radius: var(--sheet-radius-large, 20px) var(--sheet-radius-large, 20px) 0 0;
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
