<!--
LOOPComponentGrid.svelte - Layout for LOOP component selection buttons
- layout="grid" (default): compact 3x2 grid (icon + label), unchanged behavior.
  - layout="list": single vertical column with descriptions.
  - layout="responsive": descriptive desktop list, compact phone grid.
-->
<script lang="ts">
  import {
    LOOP_COMPONENTS,
    LOOPComponent,
  } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import LOOPComponentButton from "./LOOPComponentButton.svelte";

  let {
    selectedComponents,
    disabledComponents = null,
    lockedComponents = null,
    isMultiSelectMode = false,
    layout = "grid",
    onToggleComponent,
  } = $props<{
    selectedComponents: Set<LOOPComponent>;
    /** Components that can't join the current selection (combo mode gating). */
    disabledComponents?: Set<LOOPComponent> | null;
    /** Guest-gated components — still clickable, but route to sign-up. */
    lockedComponents?: Set<LOOPComponent> | null;
    isMultiSelectMode?: boolean;
    layout?: "grid" | "list" | "responsive";
    onToggleComponent: (component: LOOPComponent) => void;
  }>();

  // List layout shows descriptions per row; grid stays compact (icon + label).
  const showDescriptions = $derived(layout !== "grid");
  const compactOnMobile = $derived(layout === "responsive");
</script>

<div
  class="loop-component-grid"
  class:list={layout !== "grid"}
  class:responsive={layout === "responsive"}
  class:with-descriptions={showDescriptions}
>
  {#each LOOP_COMPONENTS as componentInfo}
    <LOOPComponentButton
      {componentInfo}
      {isMultiSelectMode}
      {compactOnMobile}
      isSelected={selectedComponents.has(componentInfo.component)}
      isDisabled={disabledComponents?.has(componentInfo.component) ?? false}
      isLocked={lockedComponents?.has(componentInfo.component) ?? false}
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

  /* The LOOP drawer keeps the descriptive list on desktop. A phone uses the
     existing compact 3 x 2 presentation so every choice stays above the
     footer, including on the 667px-tall iPhone SE viewport. */
  @media (max-width: 767px) {
    .loop-component-grid.responsive {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-auto-rows: minmax(64px, auto);
      height: auto;
    }
  }
</style>
