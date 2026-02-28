<!--
  RetroStartMenu — Win95-style start menu popup

  Anchored above the taskbar Start button. Features:
  - Dark blue vertical sidebar with "TKA-OS v1.0" rotated 90 degrees
  - Menu items with 16x16 icons and labels
  - Submenu expansion on hover (arrow indicator for items with children)
  - Separator support
  - Click-outside closes the menu

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  import type { RetroStartMenuItem } from "../../domain/types/retro-types";

  let {
    items,
    onclose,
  }: {
    items: RetroStartMenuItem[];
    onclose: () => void;
  } = $props();

  let activeSubmenuIndex = $state<number | null>(null);
  let menuElement: HTMLDivElement | undefined = $state();

  function handleItemClick(item: RetroStartMenuItem) {
    if (item.separator) return;
    if (item.children && item.children.length > 0) return;

    item.action?.();
    onclose();
  }

  function handleItemMouseEnter(index: number, item: RetroStartMenuItem) {
    if (item.children && item.children.length > 0) {
      activeSubmenuIndex = index;
    } else {
      activeSubmenuIndex = null;
    }
  }

  function handleSubmenuItemClick(child: RetroStartMenuItem) {
    child.action?.();
    onclose();
  }

  function handleWindowClick(event: MouseEvent) {
    if (!menuElement) return;
    const target = event.target as HTMLElement;

    /* Don't close if the click was on the Start button itself —
       the taskbar handles that toggle. */
    if (target.closest("[data-start-button]")) return;

    if (!menuElement.contains(target)) {
      onclose();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="start-menu" bind:this={menuElement} role="menu">
  <!-- Vertical sidebar -->
  <div class="start-menu-sidebar" aria-hidden="true">
    <span class="sidebar-text">TKA-OS v1.0</span>
  </div>

  <!-- Menu items -->
  <div class="start-menu-items">
    {#each items as item, index}
      {#if item.separator}
        <hr class="start-menu-separator" />
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="start-menu-item"
          class:has-children={item.children && item.children.length > 0}
          role="menuitem"
          tabindex="-1"
          onclick={() => handleItemClick(item)}
          onmouseenter={() => handleItemMouseEnter(index, item)}
        >
          <span class="item-icon" aria-hidden="true">
            {item.icon ?? ""}
          </span>
          <span class="item-label">{item.label}</span>
          {#if item.children && item.children.length > 0}
            <span class="item-arrow" aria-hidden="true">&#9654;</span>
          {/if}

          <!-- Submenu -->
          {#if activeSubmenuIndex === index && item.children && item.children.length > 0}
            <div class="start-submenu" role="menu">
              {#each item.children as child}
                {#if child.separator}
                  <hr class="start-menu-separator" />
                {:else}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="start-menu-item"
                    role="menuitem"
                    tabindex="-1"
                    onclick={(e: MouseEvent) => {
                      e.stopPropagation();
                      handleSubmenuItemClick(child);
                    }}
                  >
                    <span class="item-icon" aria-hidden="true">
                      {child.icon ?? ""}
                    </span>
                    <span class="item-label">{child.label}</span>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .start-menu {
    position: absolute;
    bottom: 28px;
    left: 0;
    display: flex;
    flex-direction: row;
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    box-shadow: 2px -2px 0 var(--retro-black, #000);
    z-index: 300;
    font-family: var(
      --retro-font-family,
      "Microsoft Sans Serif",
      Arial,
      sans-serif
    );
    font-size: var(--retro-font-size, 11px);
    min-width: 180px;
  }

  /* ------------------------------------------------------------------ */
  /* Vertical sidebar                                                    */
  /* ------------------------------------------------------------------ */
  .start-menu-sidebar {
    width: 22px;
    background: linear-gradient(to top, #0000aa, #000080);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 4px;
    flex-shrink: 0;
  }

  .sidebar-text {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    color: var(--retro-white, #ffffff);
    font-size: 14px;
    font-weight: bold;
    letter-spacing: 1px;
    white-space: nowrap;
    user-select: none;
  }

  /* ------------------------------------------------------------------ */
  /* Menu item list                                                      */
  /* ------------------------------------------------------------------ */
  .start-menu-items {
    flex: 1;
    padding: 2px 0;
  }

  .start-menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 24px 4px 4px;
    cursor: default;
    position: relative;
    white-space: nowrap;
    min-height: 22px;
  }

  .start-menu-item:hover {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #ffffff);
  }

  .item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .item-label {
    flex: 1;
  }

  .item-arrow {
    font-size: 8px;
    margin-left: auto;
    padding-right: 4px;
  }

  /* ------------------------------------------------------------------ */
  /* Separator                                                           */
  /* ------------------------------------------------------------------ */
  .start-menu-separator {
    border: none;
    border-top: 1px solid var(--retro-button-shadow, #808080);
    border-bottom: 1px solid var(--retro-button-highlight, #ffffff);
    margin: 2px 4px;
  }

  /* ------------------------------------------------------------------ */
  /* Submenu                                                             */
  /* ------------------------------------------------------------------ */
  .start-submenu {
    position: absolute;
    left: 100%;
    top: -2px;
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    box-shadow: 2px 2px 0 var(--retro-black, #000);
    padding: 2px 0;
    min-width: 160px;
    z-index: 310;
  }
</style>
