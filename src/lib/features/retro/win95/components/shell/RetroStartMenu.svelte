<!--
  RetroStartMenu - Win95-style start menu popup

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
  import { RETRO_ICONS } from "../rendering/retro-icons";

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

  /** Keyboard navigation for menu items */
  function handleMenuKeydown(event: KeyboardEvent) {
    const nonSeparatorItems = items.filter((i) => !i.separator);
    const focusedEl = document.activeElement as HTMLElement | null;
    const allMenuItems = menuElement
      ? Array.from(menuElement.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      : [];
    const currentIdx = focusedEl ? allMenuItems.indexOf(focusedEl) : -1;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = currentIdx < allMenuItems.length - 1 ? currentIdx + 1 : 0;
        allMenuItems[next]?.focus();
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : allMenuItems.length - 1;
        allMenuItems[prev]?.focus();
        break;
      }
      case "ArrowRight": {
        // Open submenu if this item has children
        if (currentIdx >= 0) {
          const item = nonSeparatorItems[currentIdx];
          if (item?.children?.length) {
            activeSubmenuIndex = items.indexOf(item);
          }
        }
        break;
      }
      case "ArrowLeft":
        activeSubmenuIndex = null;
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        focusedEl?.click();
        break;
      }
      case "Escape":
        onclose();
        break;
    }
  }

  function handleItemKeydown(event: KeyboardEvent, item: RetroStartMenuItem) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleItemClick(item);
    }
  }

  function handleSubmenuItemKeydown(event: KeyboardEvent, child: RetroStartMenuItem) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      handleSubmenuItemClick(child);
    }
  }

  function handleWindowClick(event: MouseEvent) {
    if (!menuElement) return;
    const target = event.target as HTMLElement;

    /* Don't close if the click was on the Start button itself -
       the taskbar handles that toggle. */
    if (target.closest("[data-start-button]")) return;

    if (!menuElement.contains(target)) {
      onclose();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div
  class="start-menu"
  bind:this={menuElement}
  role="menu"
  tabindex="-1"
  onkeydown={handleMenuKeydown}
>
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
        <div
          class="start-menu-item"
          class:has-children={item.children && item.children.length > 0}
          role="menuitem"
          tabindex="-1"
          onclick={() => handleItemClick(item)}
          onkeydown={(e) => handleItemKeydown(e, item)}
          onmouseenter={() => handleItemMouseEnter(index, item)}
        >
          <span class="item-icon" aria-hidden="true">
            {@html RETRO_ICONS[item.icon as keyof typeof RETRO_ICONS] ?? ""}
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
                  <div
                    class="start-menu-item"
                    role="menuitem"
                    tabindex="-1"
                    onclick={(e: MouseEvent) => {
                      e.stopPropagation();
                      handleSubmenuItemClick(child);
                    }}
                    onkeydown={(e) => handleSubmenuItemKeydown(e, child)}
                  >
                    <span class="item-icon" aria-hidden="true">
                      {@html RETRO_ICONS[child.icon as keyof typeof RETRO_ICONS] ?? ""}
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

  /* Vertical sidebar                                                    */
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

  /* Menu item list                                                      */
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
    flex-shrink: 0;
    image-rendering: pixelated;
  }

  .item-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .item-label {
    flex: 1;
  }

  .item-arrow {
    font-size: 8px;
    margin-left: auto;
    padding-right: 4px;
  }

  /* Separator                                                           */
  .start-menu-separator {
    border: none;
    border-top: 1px solid var(--retro-button-shadow, #808080);
    border-bottom: 1px solid var(--retro-button-highlight, #ffffff);
    margin: 2px 4px;
  }

  /* Submenu                                                             */
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
