<script lang="ts">
  import "../customize-accent.css";
  import type { Snippet } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "./portal";

  let {
    isOpen,
    ariaLabel,
    onClose,
    children,
  }: {
    isOpen: boolean;
    ariaLabel: string;
    onClose: () => void;
    children: Snippet;
  } = $props();
</script>

<div use:portal>
  <Drawer
    {isOpen}
    placement="right"
    respectLayoutMode={true}
    closeOnBackdrop={true}
    closeOnEscape={true}
    {ariaLabel}
    focusContainerOnOpen={true}
    class="generation-settings-drawer"
    backdropClass="generation-settings-backdrop"
    onclose={onClose}
  >
    <div class="generation-settings-content customize-accent-scope">
      {@render children()}
    </div>
  </Drawer>
</div>

<style>
  :global(.drawer-content.generation-settings-drawer) {
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
  }

  :global(.drawer-overlay.generation-settings-backdrop.side-by-side-layout) {
    top: var(--create-panel-top, 0);
    right: 0;
    bottom: 0;
    left: var(--desktop-sidebar-width, 0);
  }

  :global(.drawer-content.generation-settings-drawer[data-placement="bottom"]) {
    height: 85dvh;
    min-height: 0;
    max-height: 85dvh;
  }

  :global(
    .drawer-content.generation-settings-drawer.side-by-side-layout[data-placement="right"]
  ) {
    width: min(var(--create-panel-width, 480px), clamp(480px, 30vw, 620px));
    max-width: 100%;
  }

  .generation-settings-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    background-color: var(--customize-surface-solid);
    background-image: var(--customize-surface-gradient),
      var(--customize-surface-wash-layer);
    border: none;
    border-radius: 0;
  }

  .generation-settings-content > :global(.generation-settings-overlay) {
    position: static;
    flex: 1;
    min-height: 0;
    gap: 10px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .generation-settings-content {
      transition: none;
    }
  }
</style>
