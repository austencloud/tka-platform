<!--
LOOPComponentGrid.svelte - Grid layout for LOOP component selection buttons
Quick Apply mode: Single column with descriptions
Build Combo mode: 2x2 grid, compact
-->
<script lang="ts">
  import {
    LOOP_COMPONENTS,
    LOOPComponent,
  } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import LOOPComponentButton from "./LOOPComponentButton.svelte";

  let {
    selectedComponents,
    isMultiSelectMode = false,
    onToggleComponent,
  } = $props<{
    selectedComponents: Set<LOOPComponent>;
    isMultiSelectMode?: boolean;
    onToggleComponent: (component: LOOPComponent) => void;
  }>();

  // Show descriptions in Quick Apply mode (single-select)
  const showDescriptions = $derived(!isMultiSelectMode);
</script>

<div class="loop-component-grid" class:with-descriptions={showDescriptions}>
  {#each LOOP_COMPONENTS as componentInfo}
    <LOOPComponentButton
      {componentInfo}
      {isMultiSelectMode}
      isSelected={selectedComponents.has(componentInfo.component)}
      showDescription={showDescriptions}
      onClick={() => onToggleComponent(componentInfo.component)}
    />
  {/each}
</div>

<style>
  .loop-component-grid {
    display: grid;
    width: 100%;
    margin: 0 auto;
    gap: 12px;
    flex-shrink: 0;
  }

  /* Build Combo mode: 2x2 grid, compact buttons */
  .loop-component-grid:not(.with-descriptions) {
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 90px;
  }

  /* Quick Apply mode: single column with descriptions */
  .loop-component-grid.with-descriptions {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
</style>
