<!--
  RetroContextMenu - Win95-style right-click context menu

  Positioned absolutely at mouse coordinates. Same visual style as
  the start menu (gray background, outset border, navy hover) but
  without the blue sidebar. Supports one level of submenus.

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  import type { RetroContextMenuItem } from "../../domain/types/retro-types";

  let {
    x,
    y,
    items,
    onclose,
  }: {
    x: number;
    y: number;
    items: RetroContextMenuItem[];
    onclose: () => void;
  } = $props();

  let menuElement: HTMLDivElement | undefined = $state();
  let activeSubmenuIndex = $state<number | null>(null);

  /* Position clamping - keep menu within viewport                       */

  const clampedX = $derived.by(() => {
    if (!menuElement) return x;
    const shell = menuElement.closest(".retro-shell") as HTMLElement | null;
    if (!shell) return x;
    const shellRect = shell.getBoundingClientRect();
    const menuWidth = menuElement.offsetWidth;
    const maxX = shellRect.width - menuWidth - 4;
    return Math.min(x, Math.max(0, maxX));
  });

  const clampedY = $derived.by(() => {
    if (!menuElement) return y;
    const shell = menuElement.closest(".retro-shell") as HTMLElement | null;
    if (!shell) return y;
    const shellRect = shell.getBoundingClientRect();
    const menuHeight = menuElement.offsetHeight;
    const maxY = shellRect.height - menuHeight - 32;
    return Math.min(y, Math.max(0, maxY));
  });

  /* Click-outside dismiss                                               */

  function handleWindowPointerDown(event: PointerEvent) {
    if (!menuElement) return;
    const target = event.target as HTMLElement;
    if (!menuElement.contains(target)) {
      onclose();
    }
  }

  /* Item handlers                                                       */

  function handleItemClick(item: RetroContextMenuItem) {
    if (item.separator || item.disabled) return;
    if (item.children && item.children.length > 0) return;
    item.action?.();
    onclose();
  }

  function handleItemMouseEnter(index: number, item: RetroContextMenuItem) {
    if (item.children && item.children.length > 0) {
      activeSubmenuIndex = index;
    } else {
      activeSubmenuIndex = null;
    }
  }

  function handleSubmenuItemClick(event: MouseEvent, child: RetroContextMenuItem) {
    event.stopPropagation();
    if (child.disabled) return;
    child.action?.();
    onclose();
  }

  /* Keyboard navigation                                                 */

  function handleKeydown(event: KeyboardEvent) {
    if (!menuElement) return;

    const allItems = Array.from(
      menuElement.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    const focusedEl = document.activeElement as HTMLElement | null;
    const currentIdx = focusedEl ? allItems.indexOf(focusedEl) : -1;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = currentIdx < allItems.length - 1 ? currentIdx + 1 : 0;
        allItems[next]?.focus();
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : allItems.length - 1;
        allItems[prev]?.focus();
        break;
      }
      case "ArrowRight": {
        const nonSeparatorItems = items.filter((i) => !i.separator);
        if (currentIdx >= 0 && currentIdx < nonSeparatorItems.length) {
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
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="context-menu"
  bind:this={menuElement}
  role="menu"
  tabindex="-1"
  style:left="{clampedX}px"
  style:top="{clampedY}px"
  onkeydown={handleKeydown}
>
  {#each items as item, index}
    {#if item.separator}
      <hr class="context-menu-separator" />
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="context-menu-item"
        class:has-children={item.children && item.children.length > 0}
        class:disabled={item.disabled}
        role="menuitem"
        tabindex="-1"
        aria-disabled={item.disabled}
        onclick={() => handleItemClick(item)}
        onmouseenter={() => handleItemMouseEnter(index, item)}
      >
        <span class="item-label" class:default-action={item.isDefault}>{item.label}</span>
        {#if item.children && item.children.length > 0}
          <span class="item-arrow" aria-hidden="true">&#9654;</span>
        {/if}

        <!-- Submenu -->
        {#if activeSubmenuIndex === index && item.children && item.children.length > 0}
          <div class="context-submenu" role="menu">
            {#each item.children as child}
              {#if child.separator}
                <hr class="context-menu-separator" />
              {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  class="context-menu-item"
                  class:disabled={child.disabled}
                  role="menuitem"
                  tabindex="-1"
                  aria-disabled={child.disabled}
                  onclick={(e: MouseEvent) => handleSubmenuItemClick(e, child)}
                >
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

<style>
  .context-menu {
    position: absolute;
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    box-shadow: 2px 2px 0 var(--retro-black, #000);
    padding: 2px 0;
    min-width: 160px;
    z-index: 350;
    font-family: var(
      --retro-font-family,
      "Microsoft Sans Serif",
      Arial,
      sans-serif
    );
    font-size: var(--retro-font-size, 11px);
  }

  /* Menu items                                                          */
  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 24px 4px 20px;
    cursor: default;
    position: relative;
    white-space: nowrap;
    min-height: 20px;
    color: var(--retro-black, #000);
  }

  .context-menu-item:hover:not(.disabled) {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #ffffff);
  }

  .context-menu-item.disabled {
    color: var(--retro-disabled-text, #808080);
  }

  .item-label {
    flex: 1;
  }

  .item-label.default-action {
    font-weight: bold;
  }

  .item-arrow {
    font-size: 8px;
    margin-left: auto;
    padding-right: 4px;
  }

  /* Separator                                                           */
  .context-menu-separator {
    border: none;
    border-top: 1px solid var(--retro-button-shadow, #808080);
    border-bottom: 1px solid var(--retro-button-highlight, #ffffff);
    margin: 2px 4px;
  }

  /* Submenu                                                             */
  .context-submenu {
    position: absolute;
    left: 100%;
    top: -2px;
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    box-shadow: 2px 2px 0 var(--retro-black, #000);
    padding: 2px 0;
    min-width: 150px;
    z-index: 360;
  }
</style>
