<!--
  CustomizeDrawer.svelte - Full-screen bottom sheet Customize overlay
  Slides up from bottom, covers entire viewport including bottom nav.
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
    placement="bottom"
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

  /* Full-screen bottom sheet on mobile — covers bottom nav */
  :global(.drawer-content.customize-drawer-sheet[data-placement="bottom"]) {
    height: 100vh;
    height: 100dvh;
    min-height: 100vh;
    min-height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    border-radius: 0;
  }

  .customize-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #06b6d4 20%, #1a1a2e) 0%,
      color-mix(in srgb, #0891b2 12%, #1a1a2e) 50%,
      color-mix(in srgb, #06b6d4 16%, #1a1a2e) 100%
    );
    border-radius: 0;
    border-top: none;
  }


  /* Override CustomizeExpandedOverlay when inside drawer — fill height, no inner border */
  .customize-drawer-content > :global(.customize-expanded-overlay) {
    position: static;
    flex: 1;
    min-height: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
    background: transparent;
    padding: 0;
    gap: 10px;
  }

  /* Scale up style buttons in drawer context */
  .customize-drawer-content > :global(.customize-expanded-overlay .option-btn) {
    min-height: var(--min-touch-target);
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

  /* Tight accordion content padding — maximize space for pictographs */
  .customize-drawer-content > :global(.customize-expanded-overlay .accordion-content) {
    padding: 10px 8px 12px;
    gap: 10px;
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
