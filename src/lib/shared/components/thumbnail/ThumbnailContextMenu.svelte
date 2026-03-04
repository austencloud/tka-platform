<!--
  ThumbnailContextMenu.svelte

  A minimal context menu for cached images. Shows on right-click with
  an option to delete the cached version and re-render from scratch.

  Usage:
    <ThumbnailContextMenu
      onRerender={() => { /* delete cache + trigger re-render */ }}
    />

  The parent component controls positioning by wrapping the image
  in a container with position: relative.
-->
<script lang="ts">
  let {
    onRerender,
  } = $props<{
    /** Called when user clicks "Re-render". Parent handles cache deletion + re-render. */
    onRerender: () => void;
  }>();

  let visible = $state(false);
  let x = $state(0);
  let y = $state(0);
  let menuRef = $state<HTMLDivElement | null>(null);

  /** Open the menu at mouse position (relative to parent container) */
  export function open(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    // Position relative to the viewport, then adjust into the parent's coordinate space
    const parent = (event.currentTarget as HTMLElement)?.closest("[data-ctx-container]") as HTMLElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else {
      x = event.offsetX;
      y = event.offsetY;
    }

    visible = true;

    // Close on next click anywhere
    requestAnimationFrame(() => {
      document.addEventListener("pointerdown", handleOutsideClick, { once: true });
    });
  }

  function handleOutsideClick(event: PointerEvent): void {
    if (menuRef && !menuRef.contains(event.target as Node)) {
      close();
    }
  }

  function close(): void {
    visible = false;
    document.removeEventListener("pointerdown", handleOutsideClick);
  }

  function handleRerender(event: MouseEvent): void {
    event.stopPropagation();
    close();
    onRerender();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="ctx-menu"
    bind:this={menuRef}
    style:left="{x}px"
    style:top="{y}px"
    role="menu"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === "Escape") close(); }}
  >
    <button
      class="ctx-item"
      role="menuitem"
      onclick={handleRerender}
    >
      <i class="fas fa-sync-alt ctx-icon" aria-hidden="true"></i>
      Re-render
    </button>
  </div>
{/if}

<style>
  .ctx-menu {
    position: absolute;
    z-index: 1000;
    min-width: 140px;
    background: var(--theme-card-bg, rgba(30, 30, 40, 0.97));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    border-radius: var(--settings-radius-sm, 6px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    padding: 4px 0;
    backdrop-filter: blur(8px);
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 14px;
    font-size: var(--font-size-min, 14px);
    font-family: inherit;
    color: var(--theme-text, #ffffff);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background 100ms ease;
  }

  .ctx-item:hover {
    background: var(--theme-accent, rgba(100, 140, 255, 0.15));
  }

  .ctx-item:active {
    background: var(--theme-accent, rgba(100, 140, 255, 0.25));
  }

  .ctx-icon {
    font-size: 12px;
    opacity: 0.7;
  }
</style>
