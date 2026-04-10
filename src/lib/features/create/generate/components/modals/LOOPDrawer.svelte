<!--
  LOOPDrawer.svelte - Drawer-based LOOP type selector
  Bottom sheet on mobile, right panel on desktop.
  Follows DurationRhythmSheet pattern: portal + Drawer always in DOM.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "./portal";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import LOOPExpandedOverlay from "../cards/LOOPExpandedOverlay.svelte";
  import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { SliceSize } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";

  let {
    isOpen,
    currentType,
    selectedComponents,
    onChange,
    onClose,
    onLoopDisable,
    sliceSize = SliceSize.HALVED,
    onSliceSizeChange,
  }: {
    isOpen: boolean;
    currentType: LOOPType | null;
    selectedComponents: Set<LOOPComponent> | null;
    onChange: ((loopType: LOOPType) => void) | null;
    onClose: () => void;
    onLoopDisable?: () => void;
    sliceSize?: SliceSize;
    onSliceSizeChange?: (size: SliceSize) => void;
  } = $props();
</script>

<div use:portal>
  <Drawer
    isOpen={isOpen}
    placement="right"
    respectLayoutMode={true}
    showHandle={false}
    closeOnBackdrop={true}
    ariaLabel="Select LOOP Type"
    class="loop-drawer-sheet"
    onclose={onClose}
  >
    <div class="loop-drawer-content">
      <SheetDragHandle />
      {#if selectedComponents && onChange && currentType}
        <LOOPExpandedOverlay
          {currentType}
          {selectedComponents}
          {onChange}
          {onClose}
          {onLoopDisable}
          {sliceSize}
          {onSliceSizeChange}
        />
      {/if}
    </div>
  </Drawer>
</div>

<style>
  :global(.drawer-content.loop-drawer-sheet) {
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
  }

  .loop-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%
    );
    border-radius: 16px 16px 0 0;
    border-top: 1px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }

  /* Right panel: left border instead of top */
  :global(.drawer-content.loop-drawer-sheet[data-placement="right"]) .loop-drawer-content {
    border-radius: 16px 0 0 16px;
    border-top: none;
    border-left: 1px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
  }


  /* Override LOOPExpandedOverlay's absolute positioning when inside drawer */
  .loop-drawer-content > :global(.loop-expanded-overlay) {
    position: static;
    border-radius: 0;
    border: none;
    box-shadow: none;
    background: transparent;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .loop-drawer-content {
      transition: none;
    }
  }
</style>
