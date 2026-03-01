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
          stepCount={overlayProps.stepCount}
          startEndOptions={overlayProps.startEndOptions}
          gridMode={overlayProps.gridMode}
          isFreeformMode={overlayProps.isFreeformMode}
          onConstraintPresetChange={overlayProps.onConstraintPresetChange}
          onHandPathModeChange={overlayProps.onHandPathModeChange}
          onMotionTypeFilterChange={overlayProps.onMotionTypeFilterChange}
          onDurationTemplateSelect={overlayProps.onDurationTemplateSelect}
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
    padding: 24px 24px calc(24px + env(safe-area-inset-bottom, 0px));
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

  /* Override CustomizeExpandedOverlay when inside drawer — fill height for scrolling */
  .customize-drawer-content > :global(.customize-expanded-overlay) {
    position: static;
    flex: 1;
    min-height: 0;
    border-radius: 16px;
    border: 1.5px solid color-mix(in srgb, #06b6d4 30%, transparent);
    box-shadow: none;
    background: rgba(0, 0, 0, 0.15);
    padding: 24px;
    gap: 12px;
  }

  /* Center accordion content when it doesn't fill the drawer, scroll from top when it overflows */
  .customize-drawer-content > :global(.customize-expanded-overlay .overlay-content) {
    justify-content: safe center;
  }

  /* Scale up style buttons in drawer context */
  .customize-drawer-content > :global(.customize-expanded-overlay .option-btn) {
    min-height: 48px;
    font-size: var(--font-size-sm, 14px);
    border-radius: 12px;
  }

  /* Larger axis labels */
  .customize-drawer-content > :global(.customize-expanded-overlay .style-axis-label) {
    font-size: var(--font-size-compact, 12px);
  }

  /* More spacious axis rows */
  .customize-drawer-content > :global(.customize-expanded-overlay .style-axis) {
    gap: 6px;
  }

  .customize-drawer-content > :global(.customize-expanded-overlay .style-axis-options) {
    gap: 8px;
  }

  /* More spacing between axis groups in drawer */
  .customize-drawer-content > :global(.customize-expanded-overlay .style-panel) {
    gap: 14px;
  }

  /* Larger accordion headers in drawer context */
  .customize-drawer-content > :global(.customize-expanded-overlay .accordion-header) {
    padding: 14px 16px;
    min-height: 56px;
  }

  .customize-drawer-content > :global(.customize-expanded-overlay .accordion-value) {
    font-size: var(--font-size-base, 16px);
  }

  .customize-drawer-content > :global(.customize-expanded-overlay .accordion-label) {
    font-size: var(--font-size-sm, 14px);
  }

  /* More space between accordion sections */
  .customize-drawer-content > :global(.customize-expanded-overlay .overlay-content) {
    gap: 10px;
  }

  /* More generous accordion content padding */
  .customize-drawer-content > :global(.customize-expanded-overlay .accordion-content) {
    padding: 14px 16px 16px;
    gap: 14px;
  }

  /* Larger accordion sections with more visual presence */
  .customize-drawer-content > :global(.customize-expanded-overlay .accordion-section) {
    border-radius: 12px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .customize-drawer-content {
      transition: none;
    }
  }
</style>
