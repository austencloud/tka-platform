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

  type RhythmValue = {
    rotationInterval: 2 | 4;
    inversionInterval: 2 | 4;
    inversionMode: "expand" | "overlay";
  };

  let {
    isOpen,
    currentType,
    selectedComponents,
    onChange,
    onClose,
    onLoopDisable,
    rhythm,
    sequenceLength,
    onRhythmChange,
    guestMaxLength,
    onRequestSignup,
  }: {
    isOpen: boolean;
    currentType: LOOPType | null;
    selectedComponents: Set<LOOPComponent> | null;
    onChange: ((loopType: LOOPType) => void) | null;
    onClose: () => void;
    onLoopDisable?: () => void;
    /** Rhythm tier plumbing — optional; absent hides the tier (see LOOPExpandedOverlay). */
    rhythm?: RhythmValue;
    sequenceLength?: number;
    onRhythmChange?: (updates: Partial<RhythmValue>) => void;
    /** Guest gating — beat cap + sign-up callback (see LOOPExpandedOverlay). */
    guestMaxLength?: number;
    onRequestSignup?: (reason: string) => void;
  } = $props();
</script>

<div use:portal>
  <Drawer
    {isOpen}
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
          {rhythm}
          {sequenceLength}
          {onRhythmChange}
          {guestMaxLength}
          {onRequestSignup}
          layout="responsive"
        />
      {/if}
    </div>
  </Drawer>
</div>

<style>
  /* Panel skin lives on the DIALOG (not the inner content) so the surface is
     continuous under the handle — the handle no longer sits in its own
     transparent gutter with a seam beside the panel. */
  :global(.drawer-content.loop-drawer-sheet) {
    --sheet-bg: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%
    );
    --sheet-border: none;
    --sheet-border-strong: 1px solid
      color-mix(in srgb, var(--theme-accent) 50%, transparent);
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

  /* Thin, FULL-HEIGHT right column (single-column list needs ~400px, not half
     the viewport). Fills the create region top-to-bottom like CustomizeDrawer;
     the list rows stretch to spread across that height (see LOOPComponentGrid),
     so there is no empty bottom and no floating-box-in-corner look. */
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

  /* Skin (gradient + border + radius) is on the dialog via --sheet-* above;
     this wrapper is transparent and just lays out the overlay. */
  .loop-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  /* No bottom-nav clearance on desktop (only the mobile bottom sheet needs it) */
  :global(.drawer-content.loop-drawer-sheet[data-placement="right"])
    .loop-drawer-content {
    padding-bottom: 12px;
  }

  /* Override LOOPExpandedOverlay's absolute positioning when inside drawer;
     fill the full drawer height like CustomizeDrawer does. On desktop the
     overlay stays its own scroller (it is height-constrained, so the sticky
     Apply dock binds to it and works). */
  .loop-drawer-content > :global(.loop-expanded-overlay) {
    position: static;
    flex: 1;
    min-height: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
    background: transparent;
  }

  /* Grid fills the remaining height; its rows stretch to spread evenly */
  .loop-drawer-content :global(.grid-container) {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* ============================================================
     MOBILE (< 768px = below the side-by-side breakpoint).
     The JS placement can get stuck on "right" (stale layout read at mount),
     leaving a narrow right-anchored drawer with a vertical side handle and a
     right-only backdrop. Below the breakpoint the panel MUST be a full-width
     bottom sheet — viewport width is the reliable signal — so pin that geometry
     here regardless of the (possibly wrong) data-placement.
     ============================================================ */
  @media (max-width: 767px) {
    :global(.drawer-content.loop-drawer-sheet) {
      inset: auto 0 0 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      height: 100dvh !important;
      max-height: 100dvh !important;
      border-radius: 0 !important;
      border-left: none !important;
      /* data-placement is still "right", whose base rule sets
         touch-action: pan-x and blocks vertical scrolling — re-enable pan-y so
         the list can actually scroll. */
      touch-action: pan-y !important;
      overscroll-behavior-y: contain !important;
    }

    :global(.drawer-content.loop-drawer-sheet[data-state="closed"]) {
      transform: translate3d(0, 100%, 0) !important;
    }

    :global(.drawer-content.loop-drawer-sheet[data-state="open"]) {
      transform: translate3d(0, 0, 0) !important;
    }

    /* Horizontal grabber at the top, not the vertical side bar */
    :global(.drawer-content.loop-drawer-sheet .drawer-handle) {
      position: relative !important;
      inset: auto !important;
      width: var(--min-touch-target) !important;
      height: 5px !important;
      margin: 10px auto 8px !important;
      transform: none !important;
    }

    /* Top-handle sheet needs no side gutter */
    :global(.drawer-content.loop-drawer-sheet) > :global(.drawer-inner) {
      padding-left: 0 !important;
    }

    /* Backdrop covers the whole screen, not just a right region */
    :global(.drawer-overlay.loop-backdrop) {
      inset: 0 !important;
    }

    /* The full-height phone sheet has one bounded layout. The six LOOP choices
       and footer stay fixed; only the optional explanation stack may scroll. */
    :global(.drawer-content.loop-drawer-sheet) > :global(.drawer-inner) {
      overflow: hidden;
    }

    .loop-drawer-content {
      height: 100% !important;
      min-height: 0;
      overflow: hidden;
    }

    .loop-drawer-content :global(.grid-container) {
      flex: 0 0 auto !important;
      overflow: visible !important;
    }

    .loop-drawer-content :global(.loop-component-grid.responsive) {
      height: auto !important;
      grid-auto-rows: minmax(64px, auto) !important;
    }

    .loop-drawer-content > :global(.loop-expanded-overlay) {
      overflow: hidden !important;
    }

    .loop-drawer-content :global(.combo-details) {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior-y: contain;
    }

    /* Apply is a real footer in the phone drawer. Keeping it in normal flow
       prevents the nearest-scrollport rules for sticky positioning from
       painting it over unfinished option rows. */
    .loop-drawer-content :global(.apply-dock) {
      position: static;
      bottom: auto;
    }
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .loop-drawer-content {
      transition: none;
    }
  }
</style>
