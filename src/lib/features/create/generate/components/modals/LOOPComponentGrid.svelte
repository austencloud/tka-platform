<!--
LOOPComponentGrid.svelte - Layout for LOOP component selection buttons
- layout="grid" (default): compact 3x2 grid (icon + label), unchanged behavior.
- layout="list": single vertical column with descriptions (used by the drawer).
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
    layout = "grid",
    onToggleComponent,
  } = $props<{
    selectedComponents: Set<LOOPComponent>;
    isMultiSelectMode?: boolean;
    layout?: "grid" | "list";
    onToggleComponent: (component: LOOPComponent) => void;
  }>();

  // List layout shows descriptions per row; grid stays compact (icon + label).
  const showDescriptions = $derived(layout === "list");
</script>

<div
  class="loop-component-grid"
  class:list={layout === "list"}
  class:with-descriptions={showDescriptions}
>
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

  /* List layout: single vertical column. Rows stretch to fill a tall panel
     (desktop) but never shrink below a comfortable tap target — on a short
     panel they hold 64px and the container scrolls instead of crushing. */
  .loop-component-grid.list {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(64px, 1fr);
    height: 100%;
  }
</style>
