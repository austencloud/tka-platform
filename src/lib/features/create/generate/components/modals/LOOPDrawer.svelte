<!--
  LOOPDrawer.svelte - Drawer-based LOOP type selector
  Bottom sheet on mobile, right panel on desktop.
  Follows DurationRhythmSheet pattern: portal + Drawer always in DOM.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "./portal";
  import LOOPExpandedOverlay from "../cards/LOOPExpandedOverlay.svelte";
  import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";

  let {
    isOpen,
    currentType,
    selectedComponents,
    onChange,
    onClose,
    onLoopDisable,
  }: {
    isOpen: boolean;
    currentType: LOOPType | null;
    selectedComponents: Set<LOOPComponent> | null;
    onChange: ((loopType: LOOPType) => void) | null;
    onClose: () => void;
    onLoopDisable?: () => void;
  } = $props();
</script>

<div use:portal>
  <Drawer
    isOpen={isOpen}
    placement="right"
    respectLayoutMode={true}
    closeOnBackdrop={true}
    ariaLabel="Select LOOP Type"
    class="loop-drawer-sheet"
    backdropClass="loop-backdrop"
    onclose={onClose}
  >
    <div class="loop-drawer-content">
      {#if selectedComponents && onChange && currentType}
        <LOOPExpandedOverlay
          {currentType}
          {selectedComponents}
          {onChange}
          {onClose}
          {onLoopDisable}
          layout="list"
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

  /* Hug content - don't stretch to viewport min/max */
  :global(.drawer-content.loop-drawer-sheet[data-placement="bottom"]) {
    min-height: 0;
  }

  :global(.drawer-content.loop-drawer-sheet[data-placement="right"]) {
    height: auto;
    max-height: none;
  }

  /* Outside-click-to-close: span backdrop from sidebar edge to the right so a
     workspace click dismisses (mirrors customize-backdrop). */
  :global(.drawer-overlay.loop-backdrop.side-by-side-layout) {
    left: var(--desktop-sidebar-width, 0);
    right: 0;
    top: var(--create-panel-top, 0);
    bottom: 0;
  }

  /* Thin right column (single-column list needs ~400px, not half the viewport) */
  :global(
    .drawer-content.loop-drawer-sheet.side-by-side-layout[data-placement="right"]
  ) {
    width: min(var(--create-panel-width, 400px), 400px);
    max-width: 100%;
  }

  /* drawer-inner default flex: 1 1 0% makes dialog unable to auto-size
     beyond min-height. flex-basis: auto lets content determine dialog height. */
  :global(.drawer-content.loop-drawer-sheet) > :global(.drawer-inner) {
    flex-basis: auto;
  }

  .loop-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-bottom: calc(var(--nav-min-height, 64px) + env(safe-area-inset-bottom, 0px));
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


  /* Override LOOPExpandedOverlay's absolute positioning when inside drawer;
     fill the full drawer height like CustomizeDrawer does. */
  .loop-drawer-content > :global(.loop-expanded-overlay) {
    position: static;
    flex: 1;
    min-height: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
    background: transparent;
  }

  /* Grid fills remaining height and scrolls (overlay now fills the drawer) */
  .loop-drawer-content :global(.grid-container) {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .loop-drawer-content {
      transition: none;
    }
  }
</style>
