<!--
LOOPComponentGrid.svelte - Grid layout for LOOP component selection buttons
Compact 3x2 grid (icon + label) so all 6 items fit on mobile without scrolling
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

  // Compact grid in both modes - descriptions removed to fit all 6 items
  // on small mobile screens (e.g. Z Fold 6 portrait in browser)
  const showDescriptions = false;
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
    gap: 8px;
    flex-shrink: 0;
    /* 3 columns x 2 rows - fits all 6 items on small mobile screens */
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: minmax(64px, auto);
  }
</style>
