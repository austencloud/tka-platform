<!--
  CustomizeDrawer.svelte - Drawer-based Customize overlay
  Bottom sheet on mobile, right panel on desktop.
  Follows DurationRhythmSheet pattern: portal + Drawer always in DOM.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "./portal";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import CustomizeExpandedOverlay from "../cards/CustomizeExpandedOverlay.svelte";
  import type { CustomizeOverlayProps } from "../../../shared/state/panel-coordination-state.svelte";

  let {
    isOpen,
    overlayProps,
    onClose,
  }: {
    isOpen: boolean;
    overlayProps: CustomizeOverlayProps | null;
    onClose: () => void;
  } = $props();
</script>

<div use:portal>
  <Drawer
    isOpen={isOpen}
    placement="right"
    respectLayoutMode={true}
    showHandle={false}
    closeOnBackdrop={true}
    ariaLabel="Customize generation settings"
    class="customize-drawer-sheet"
    onclose={onClose}
  >
    <div class="customize-drawer-content">
      <SheetDragHandle />
      {#if overlayProps}
        <CustomizeExpandedOverlay
          constraintPreset={overlayProps.constraintPreset}
          handPathMode={overlayProps.handPathMode}
          motionTypeFilter={overlayProps.motionTypeFilter}
          durationTemplateId={overlayProps.durationTemplateId}
          startEndOptions={overlayProps.startEndOptions}
          gridMode={overlayProps.gridMode}
          isFreeformMode={overlayProps.isFreeformMode}
          onConstraintPresetChange={overlayProps.onConstraintPresetChange}
          onHandPathModeChange={overlayProps.onHandPathModeChange}
          onMotionTypeFilterChange={overlayProps.onMotionTypeFilterChange}
          onOpenDurationPanel={overlayProps.onOpenDurationPanel}
          onStartEndChange={overlayProps.onStartEndChange}
          onClose={onClose}
        />
      {/if}
    </div>
  </Drawer>
</div>

<style>
  :global(.drawer-content.customize-drawer-sheet) {
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
  }

  .customize-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #06b6d4 20%, #1a1a2e) 0%,
      color-mix(in srgb, #0891b2 12%, #1a1a2e) 50%,
      color-mix(in srgb, #06b6d4 16%, #1a1a2e) 100%
    );
    border-radius: 16px 16px 0 0;
    border-top: 1px solid color-mix(in srgb, #06b6d4 40%, transparent);
  }

  /* Right panel: left border instead of top */
  :global(.drawer-content.customize-drawer-sheet[data-placement="right"]) .customize-drawer-content {
    border-radius: 16px 0 0 16px;
    border-top: none;
    border-left: 1px solid color-mix(in srgb, #06b6d4 40%, transparent);
  }

  /* Override CustomizeExpandedOverlay's absolute positioning when inside drawer */
  .customize-drawer-content > :global(.customize-expanded-overlay) {
    position: static;
    border-radius: 0;
    border: none;
    box-shadow: none;
    background: transparent;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .customize-drawer-content {
      transition: none;
    }
  }
</style>
