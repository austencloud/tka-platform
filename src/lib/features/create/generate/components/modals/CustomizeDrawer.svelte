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
    closeOnBackdrop={true}
    ariaLabel="Customize generation settings"
    class="customize-drawer-sheet"
    backdropClass="customize-backdrop"
    onclose={onClose}
  >
    <div class="customize-drawer-content customize-accent-scope">
      {#if overlayProps}
        <CustomizeExpandedOverlay
          constraintPreset={overlayProps.constraintPreset}
          handPathMode={overlayProps.handPathMode}
          motionTypeFilter={overlayProps.motionTypeFilter}
          startEndOptions={overlayProps.startEndOptions}
          level={overlayProps.level}
          gridMode={overlayProps.gridMode}
          isFreeformMode={overlayProps.isFreeformMode}
          styleBaseline={overlayProps.styleBaseline}
          onConstraintPresetChange={overlayProps.onConstraintPresetChange}
          onHandPathModeChange={overlayProps.onHandPathModeChange}
          onMotionTypeFilterChange={overlayProps.onMotionTypeFilterChange}
          onStartEndChange={overlayProps.onStartEndChange}
          onResetAll={overlayProps.onResetAll}
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

  /* Bottom sheet on mobile. Fixed height, NOT auto: the drill panel swaps
     between a three-row Style screen and a 16-cell grid, and an auto-height
     sheet would resize under the user's thumb on every drill. */
  :global(.drawer-content.customize-drawer-sheet[data-placement="bottom"]) {
    height: 85dvh;
    min-height: 0;
    max-height: 85dvh;
  }

  /* Right-side panel on desktop.
     Base Drawer.css sizes right+side-by-side drawers to --create-panel-width
     (the MEASURED generate-panel width). With no sequence the workspace
     collapses and the generate panel goes full-width, so an uncapped drawer
     blows out to the whole viewport — a settings form spanning 3840px.

     The ceiling is a band, not a flat cap: a flat 520px left 4K as a thin
     strip against idle rail (4k-native-layout.md), and the drill panel's
     two-pane seam at 840px could never fire. 1440 -> ~600 (one column) ·
     1920 -> ~810 (one column) · 2560 -> ~1075 (two-pane) · 3840 -> 1100.
     min() keeps it from ever exceeding the panel it sits over. */
  :global(.drawer-content.customize-drawer-sheet.side-by-side-layout[data-placement="right"]) {
    width: min(var(--create-panel-width, 480px), clamp(520px, 42vw, 1100px));
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

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .customize-drawer-content {
      transition: none;
    }
  }
</style>
