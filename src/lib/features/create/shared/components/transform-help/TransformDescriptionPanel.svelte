<!--
  TransformDescriptionPanel.svelte

  Container for transform action cards
  - Mobile: Vertical stack (accordion pattern)
  - Desktop: 2-column grid
  Uses container queries for smart responsive layout
-->
<script lang="ts">
  import { transformHelpContent } from "../../domain/transforms/transform-help-content";
  import TransformDescription from "./TransformDescription.svelte";

  interface Props {
    expandedTransformId: "mirror" | "rotate" | "swap" | "rewind";
    isDesktopLayout: boolean;
    onToggleExpand?: (id: "mirror" | "rotate" | "swap" | "rewind") => void;
    onApplyTransform?: (transformId: string) => void;
    onApplyRotate?: (direction: "cw" | "ccw") => void;
  }

  let {
    expandedTransformId,
    isDesktopLayout,
    onToggleExpand,
    onApplyTransform,
    onApplyRotate,
  }: Props = $props();

  function isExpanded(id: string): boolean {
    return id === expandedTransformId;
  }

  function handleToggle(id: "mirror" | "rotate" | "swap" | "rewind") {
    onToggleExpand?.(id);
  }
</script>

<div class="transforms-panel" class:desktop={isDesktopLayout}>
  {#each transformHelpContent as item (item.id)}
    <TransformDescription
      {item}
      {isDesktopLayout}
      expanded={isExpanded(item.id)}
      onToggle={() =>
        handleToggle(item.id as "mirror" | "rotate" | "swap" | "rewind")}
      onApply={() => {
        if (item.id === "rotate") {
          onApplyRotate?.("cw");
        } else {
          onApplyTransform?.(item.id);
        }
      }}
      onRotate={onApplyRotate}
    />
  {/each}
</div>

<style>
  .transforms-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    flex: 1;
    min-height: 0;
  }

  /* Desktop: 2-column grid that expands to fill available space */
  .transforms-panel.desktop {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 16px;
    width: 100%;
    height: 100%;
    flex: 1;
  }
</style>
