<!--
  RetroMenuBar - Horizontal menu bar with dropdown submenus

  Core navigation element for every retro "app." Menu labels are displayed
  horizontally with an underlined hotkey letter (first letter by default).
  Clicking opens the dropdown. Hovering between menus while one is open
  switches the active menu. Clicking away or pressing Escape closes.

  Disabled items appear grayed out. Separators render as horizontal rules.
  Keyboard shortcuts are right-aligned in the dropdown.
-->
<script lang="ts">
  let {
    menus,
  }: {
    menus: {
      label: string;
      items: {
        label: string;
        action?: () => void;
        separator?: boolean;
        disabled?: boolean;
        shortcut?: string;
      }[];
    }[];
  } = $props();

  let openMenuIndex = $state<number | null>(null);

  function toggleMenu(index: number) {
    if (openMenuIndex === index) {
      openMenuIndex = null;
    } else {
      openMenuIndex = index;
    }
  }

  function handleMenuHover(index: number) {
    if (openMenuIndex !== null) {
      openMenuIndex = index;
    }
  }

  function handleItemClick(item: { action?: () => void; disabled?: boolean }) {
    if (item.disabled) return;
    openMenuIndex = null;
    item.action?.();
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".retro-menubar")) {
      openMenuIndex = null;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      openMenuIndex = null;
    }
  }

  $effect(() => {
    if (openMenuIndex !== null) {
      document.addEventListener("pointerdown", handlePointerDownOutside);
      document.addEventListener("keydown", handleKeydown);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<div class="retro-menubar" role="menubar">
  {#each menus as menu, i (menu.label)}
    <div class="retro-menu-wrapper">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <button
        class="retro-menu-label"
        class:open={openMenuIndex === i}
        type="button"
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={openMenuIndex === i}
        onmousedown={() => toggleMenu(i)}
        onmouseenter={() => handleMenuHover(i)}
      >
        <span class="retro-menu-hotkey">{menu.label[0]}</span>{menu.label.slice(1)}
      </button>

      {#if openMenuIndex === i}
        <div class="retro-menu-dropdown" role="menu">
          {#each menu.items as item (item.label)}
            {#if item.separator}
              <hr class="retro-menu-separator" />
            {:else}
              <button
                class="retro-menu-item"
                class:disabled={item.disabled}
                role="menuitem"
                disabled={item.disabled ?? false}
                onclick={() => handleItemClick(item)}
              >
                <span class="retro-menu-item-label">{item.label}</span>
                {#if item.shortcut}
                  <span class="retro-menu-item-shortcut">{item.shortcut}</span>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .retro-menubar {
    display: flex;
    align-items: stretch;
    background: var(--retro-button-face, #c0c0c0);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    user-select: none;
    padding: 0;
  }

  /* Menu wrapper (label + dropdown anchor)                              */
  .retro-menu-wrapper {
    position: relative;
  }

  /* Top-level menu label                                                */
  .retro-menu-label {
    display: inline-block;
    padding: 2px 6px;
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    color: var(--retro-black, #000);
    cursor: default;
    white-space: nowrap;
  }

  .retro-menu-label:hover,
  .retro-menu-label.open {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }

  .retro-menu-label:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -1px;
  }

  /* Hotkey underline (first letter)                                     */
  .retro-menu-hotkey {
    text-decoration: underline;
  }

  /* Dropdown panel                                                      */
  .retro-menu-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 1000;
    min-width: 160px;
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    box-shadow: 2px 2px 0 var(--retro-black, #000);
    padding: 2px;
  }

  /* Menu item                                                           */
  .retro-menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 2px 16px 2px 8px;
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    color: var(--retro-black, #000);
    cursor: default;
    white-space: nowrap;
    text-align: left;
    gap: 16px;
  }

  .retro-menu-item:hover:not(:disabled) {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }

  .retro-menu-item:disabled {
    color: var(--retro-disabled-text, #808080);
  }

  .retro-menu-item-label {
    flex: 1;
  }

  .retro-menu-item-shortcut {
    flex-shrink: 0;
    color: inherit;
    text-align: right;
  }

  /* Separator                                                           */
  .retro-menu-separator {
    border: none;
    border-top: 1px solid var(--retro-button-shadow, #808080);
    border-bottom: 1px solid var(--retro-button-highlight, #fff);
    margin: 2px 0;
  }
</style>
