<!--
  CustomizeDrawer.svelte - Customize overlay drawer
  Desktop: right-side panel matching other create module drawers.
  Mobile: full-screen bottom sheet covering entire viewport including bottom nav.
  Follows DurationRhythmSheet pattern: portal + Drawer always in DOM.
-->
<script lang="ts">
  import "../customize-accent.css";
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
    backdropClass="customize-backdrop"
    onclose={onClose}
  >
    <div class="customize-drawer-content customize-accent-scope">
      <SheetDragHandle />
      {#if overlayProps}
        <CustomizeExpandedOverlay
          constraintPreset={overlayProps.constraintPreset}
          handPathMode={overlayProps.handPathMode}
          motionTypeFilter={overlayProps.motionTypeFilter}
          startEndOptions={overlayProps.startEndOptions}
          gridMode={overlayProps.gridMode}
          isFreeformMode={overlayProps.isFreeformMode}
          onConstraintPresetChange={overlayProps.onConstraintPresetChange}
          onHandPathModeChange={overlayProps.onHandPathModeChange}
          onMotionTypeFilterChange={overlayProps.onMotionTypeFilterChange}
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

  /* Outside-click-to-close. The base side-by-side backdrop is constrained to the
     right (left: --create-panel-left), so it never covers the workspace and an
     outside click there can't close the panel. Span the backdrop from the
     sidebar edge to the right so any workspace click hits it and dismisses.
     Sidebar stays clickable (backdrop starts after it). Higher specificity
     (3 classes) overrides the base side-by-side + has-desktop-sidebar rules. */
  :global(.drawer-overlay.customize-backdrop.side-by-side-layout) {
    left: var(--desktop-sidebar-width, 0);
    right: 0;
    top: var(--create-panel-top, 0);
    bottom: 0;
  }

  /* Bottom sheet on mobile - auto-size to content, don't take full screen */
  :global(.drawer-content.customize-drawer-sheet[data-placement="bottom"]) {
    height: auto;
    min-height: auto;
    max-height: 85dvh;
  }

  /* Right-side panel on desktop.
     Base Drawer.css sizes right+side-by-side drawers to --create-panel-width
     (the MEASURED generate-panel width). With no sequence the workspace
     collapses and the generate panel goes full-width, so the customize drawer
     would blow out to the whole viewport. Cap it: a settings form never needs
     more than a readable column. min() keeps it from exceeding the panel on
     narrow windows. */
  :global(.drawer-content.customize-drawer-sheet.side-by-side-layout[data-placement="right"]) {
    width: min(var(--create-panel-width, 480px), 520px);
    max-width: 100%;
  }

  .customize-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    /* Palette hoisted to ../customize-accent.css (shared with CustomizeExpandedOverlay) */
    background: var(--customize-surface-gradient);
    border-radius: 0;
    border-top: none;
  }


  /* Override CustomizeExpandedOverlay when inside drawer - fill height, no inner border */
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

  /* Tight accordion content padding - maximize space for pictographs */
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
