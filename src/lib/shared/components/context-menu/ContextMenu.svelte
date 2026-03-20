<!--
  ContextMenu - Shared right-click context menu primitive.
  Handles positioning, viewport clamping, dismissal, keyboard nav, submenus.
  Both the menu and submenu are portaled to document.body to escape ancestor
  transforms and overflow clipping.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type {
    ContextMenuEntry,
    ContextMenuItem,
    ContextMenuState,
  } from "./context-menu-types";
  import {
    isMenuItem,
    isSeparator,
    isHeader,
  } from "./context-menu-types";

  let {
    menuState,
    items,
    onClose,
  } = $props<{
    menuState: ContextMenuState;
    items: ContextMenuEntry[];
    onClose: () => void;
  }>();

  let menuElement: HTMLDivElement | null = $state(null);
  let submenuElement: HTMLDivElement | null = $state(null);
  let activeSubmenuId: string | null = $state(null);
  let submenuTimer: ReturnType<typeof setTimeout> | null = $state(null);
  let loadingItemId: string | null = $state(null);
  let submenuPosition = $state({ left: 0, top: 0 });
  let submenuOpensLeft = $state(false);

  // Derive active submenu entry from items so it stays reactive when items rebuild
  const activeSubmenuEntry = $derived.by(() => {
    if (!activeSubmenuId) return null;
    for (const entry of items) {
      if (isMenuItem(entry) && entry.id === activeSubmenuId && entry.children?.length) {
        return entry;
      }
    }
    return null;
  });

  /** Svelte action: moves the node to document.body so position:fixed works correctly */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  /** Trigger a short haptic pulse on devices that support it */
  function haptic() {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
  }

  // Position clamping after render
  $effect(() => {
    if (!menuState.open || !menuElement) return;

    const rect = menuElement.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let x = menuState.x;
    let y = menuState.y;

    if (x + rect.width > vw - margin) {
      x = vw - rect.width - margin;
    }
    if (x < margin) x = margin;

    const spaceBelow = vh - y - margin;
    const spaceAbove = y - margin;

    if (rect.height <= spaceBelow) {
      menuElement.style.maxHeight = "";
    } else if (rect.height <= spaceAbove) {
      y = y - rect.height;
    } else {
      y = margin;
      menuElement.style.maxHeight = `${vh - margin * 2}px`;
    }

    if (y < margin) y = margin;

    menuElement.style.left = `${x}px`;
    menuElement.style.top = `${y}px`;
  });

  // Submenu viewport clamping
  $effect(() => {
    if (!activeSubmenuId || !submenuElement) return;

    const rect = submenuElement.getBoundingClientRect();
    const vh = window.innerHeight;
    const margin = 8;

    let top = submenuPosition.top;
    if (top + rect.height > vh - margin) {
      top = vh - margin - rect.height;
    }
    if (top < margin) top = margin;

    submenuElement.style.left = `${submenuPosition.left}px`;
    submenuElement.style.top = `${top}px`;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (activeSubmenuId) {
        activeSubmenuId = null;
      } else {
        onClose();
      }
    }
  }

  function handleClickOutside(e: PointerEvent) {
    const target = e.target as Node;
    const inMenu = menuElement?.contains(target);
    const inSubmenu = submenuElement?.contains(target);
    if (!inMenu && !inSubmenu) {
      onClose();
    }
  }

  async function handleItemClick(item: ContextMenuItem, event?: MouseEvent) {
    // Items with children: toggle submenu on click
    if (item.children?.length) {
      if (submenuTimer) clearTimeout(submenuTimer);
      if (activeSubmenuId === item.id) {
        activeSubmenuId = null;
      } else {
        // Open immediately on click (no hover delay)
        const wrapper = (event?.currentTarget as HTMLElement)?.closest(".menu-item-wrapper") as HTMLElement | null;
        if (wrapper) openSubmenuForEntry(item, wrapper);
      }
      return;
    }
    if (item.disabled) return;
    if (!item.action) return;

    haptic();
    loadingItemId = item.id;
    try {
      await item.action();
    } finally {
      loadingItemId = null;
      if (!item.keepOpen) {
        onClose();
      }
    }
  }

  function openSubmenuForEntry(entry: ContextMenuItem, wrapper: HTMLElement) {
    activeSubmenuId = entry.id;

    if (!wrapper || !menuElement) return;
    const itemRect = wrapper.getBoundingClientRect();
    const menuRect = menuElement.getBoundingClientRect();
    const vw = window.innerWidth;
    const margin = 8;
    const submenuWidth = 200;

    // Prefer right of the menu, fall back to left
    let left: number;
    const opensRight = menuRect.right + submenuWidth + margin < vw;
    if (opensRight) {
      left = menuRect.right;
    } else {
      left = menuRect.left - submenuWidth;
      if (left < margin) left = margin;
    }

    submenuOpensLeft = !opensRight;
    submenuPosition = { left, top: itemRect.top - 4 };
  }

  function handleSubmenuEnter(entry: ContextMenuItem, event: MouseEvent) {
    if (submenuTimer) clearTimeout(submenuTimer);
    const wrapper = event.currentTarget as HTMLElement;
    submenuTimer = setTimeout(() => {
      openSubmenuForEntry(entry, wrapper);
    }, 150);
  }

  function handleSubmenuLeave() {
    if (submenuTimer) clearTimeout(submenuTimer);
    submenuTimer = setTimeout(() => {
      activeSubmenuId = null;
    }, 200);
  }

  function handleSubmenuPanelEnter() {
    if (submenuTimer) clearTimeout(submenuTimer);
  }

  // Close submenu when main menu closes
  $effect(() => {
    if (!menuState.open) {
      activeSubmenuId = null;
    }
  });

  function handleWindowBlur() {
    if (menuState.open) {
      onClose();
    }
  }

  onMount(() => {
    document.addEventListener("pointerdown", handleClickOutside, true);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("blur", handleWindowBlur);
      if (submenuTimer) clearTimeout(submenuTimer);
    };
  });

  /** Build inline accent style for checked items that have an iconColor */
  function checkedAccentStyle(item: ContextMenuItem): string {
    if (!item.checked || !item.iconColor) return "";
    return `background: color-mix(in srgb, ${item.iconColor} 12%, transparent);`;
  }
</script>

<!-- Shared snippet for rendering a menu item's icon column.
     When an item has both checked state AND a colored icon, we show both:
     a small check/blank indicator followed by the colored icon. -->
{#snippet itemIcons(item: ContextMenuItem, loading: boolean)}
  {#if loading}
    <i class="fas fa-spinner fa-spin menu-item-icon" aria-hidden="true"></i>
  {:else if item.checked !== undefined && item.icon}
    <!-- Dual-column: check indicator + colored icon -->
    <i
      class="fas menu-item-check"
      class:fa-check={item.checked}
      class:checked={item.checked}
      class:unchecked={!item.checked}
      aria-hidden="true"
    ></i>
    <i
      class="fas {item.icon} menu-item-icon"
      style={item.iconColor ? `color: ${item.iconColor}` : ""}
      aria-hidden="true"
    ></i>
  {:else if item.checked !== undefined}
    <!-- Check-only (no icon) -->
    <i
      class="fas menu-item-icon"
      class:fa-check={item.checked}
      class:checked={item.checked}
      class:unchecked={!item.checked}
      aria-hidden="true"
    ></i>
  {:else if item.icon}
    <i
      class="fas {item.icon} menu-item-icon"
      style={item.iconColor ? `color: ${item.iconColor}` : ""}
      aria-hidden="true"
    ></i>
  {:else}
    <span class="menu-item-icon-spacer"></span>
  {/if}
{/snippet}

<!-- Main context menu - portaled to body -->
{#if menuState.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="context-menu"
    bind:this={menuElement}
    use:portal
    style="left: {menuState.x}px; top: {menuState.y}px;"
    role="menu"
    tabindex="-1"
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#each items as entry, i}
      {#if isSeparator(entry)}
        <div class="menu-separator" role="separator"></div>
      {:else if isHeader(entry)}
        <div class="menu-header">{entry.label}</div>
      {:else if isMenuItem(entry)}
        {@const isLoading = loadingItemId === entry.id}
        {@const hasChildren = (entry.children?.length ?? 0) > 0}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="menu-item-wrapper"
          style="--item-index: {i};"
          onmouseenter={(e) => hasChildren && handleSubmenuEnter(entry, e)}
          onmouseleave={() => hasChildren && handleSubmenuLeave()}
        >
          <button
            class="menu-item"
            class:disabled={entry.disabled || isLoading}
            class:danger={entry.danger}
            class:has-children={hasChildren}
            class:submenu-active={activeSubmenuId === entry.id}
            role="menuitem"
            aria-label={entry.label}
            disabled={entry.disabled || isLoading}
            onclick={(e) => handleItemClick(entry, e)}
            style={checkedAccentStyle(entry)}
          >
            {@render itemIcons(entry, isLoading)}
            {#if entry.rawIcon}
              <span class="menu-item-raw-icon" style={entry.rawIconColor ? `color: ${entry.rawIconColor}` : ""}>
                {@html entry.rawIcon}
              </span>
            {/if}
            <span class="menu-item-label">{entry.label}</span>
            {#if hasChildren}
              <i class="fas menu-item-chevron" class:fa-chevron-right={!submenuOpensLeft || activeSubmenuId !== entry.id} class:fa-chevron-left={submenuOpensLeft && activeSubmenuId === entry.id} aria-hidden="true"></i>
            {/if}
          </button>
        </div>
      {/if}
    {/each}
  </div>
{/if}

<!-- Submenu - separately portaled to body, outside the main menu entirely -->
{#if menuState.open && activeSubmenuId && activeSubmenuEntry?.children?.length}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="submenu"
    class:opens-left={submenuOpensLeft}
    bind:this={submenuElement}
    use:portal
    style="left: {submenuPosition.left}px; top: {submenuPosition.top}px;"
    role="menu"
    tabindex="-1"
    onmouseenter={handleSubmenuPanelEnter}
    onmouseleave={() => handleSubmenuLeave()}
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#each activeSubmenuEntry.children ?? [] as child, j}
      {#if isSeparator(child)}
        <div class="menu-separator" role="separator"></div>
      {:else if isMenuItem(child)}
        {@const isChildLoading = loadingItemId === child.id}
        <button
          class="menu-item"
          class:disabled={child.disabled || isChildLoading}
          class:danger={child.danger}
          role="menuitem"
          aria-label={child.label}
          disabled={child.disabled || isChildLoading}
          onclick={() => handleItemClick(child)}
          style="{checkedAccentStyle(child)} --item-index: {j};"
        >
          {@render itemIcons(child, isChildLoading)}
          <span class="menu-item-label">{child.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  /* ── Entrance animations ── */
  @keyframes menu-enter {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes submenu-enter-right {
    from {
      opacity: 0;
      transform: translateX(-6px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes submenu-enter-left {
    from {
      opacity: 0;
      transform: translateX(6px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes item-enter {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .context-menu {
    position: fixed;
    z-index: 9999;
    min-width: 200px;
    max-width: 300px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    box-shadow:
      0 8px 24px var(--theme-shadow, rgba(0, 0, 0, 0.6)),
      0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
    animation: menu-enter 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
    transform-origin: top left;
  }

  .menu-header {
    padding: 6px 10px 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    margin-bottom: 2px;
  }

  .menu-separator {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.06));
    margin: 3px 8px;
  }

  .menu-item-wrapper {
    position: relative;
    animation: item-enter 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--item-index, 0) * 30ms);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    min-height: 44px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    text-align: left;
    transition:
      background 120ms ease,
      transform 120ms ease;
  }

  .menu-item:hover:not(.disabled),
  .menu-item.submenu-active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
  }

  .menu-item:active:not(.disabled) {
    transform: scale(0.97);
  }

  .menu-item.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .menu-item.danger {
    color: var(--semantic-error, #ef4444);
  }

  .menu-item.danger:hover:not(.disabled) {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
  }

  .menu-item-icon {
    width: 16px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    flex-shrink: 0;
  }

  /* Small check indicator used in dual-column mode (check + icon) */
  .menu-item-check {
    width: 12px;
    text-align: center;
    font-size: 10px;
    flex-shrink: 0;
  }

  .menu-item-check.checked,
  .menu-item-icon.checked {
    color: var(--semantic-success, #22c55e);
  }

  .menu-item-check.unchecked,
  .menu-item-icon.unchecked {
    opacity: 0;
  }

  .menu-item-icon-spacer {
    width: 16px;
    flex-shrink: 0;
  }

  .menu-item-raw-icon {
    width: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    flex-shrink: 0;
  }

  .menu-item-raw-icon :global(i),
  .menu-item-raw-icon :global(svg) {
    font-size: inherit;
    width: 16px;
    height: 16px;
  }

  .menu-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-item-chevron {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.5;
    flex-shrink: 0;
    transition: transform 120ms ease;
  }

  .menu-item.submenu-active .menu-item-chevron {
    transform: translateX(2px);
    opacity: 0.8;
  }

  .menu-item.submenu-active .menu-item-chevron.fa-chevron-left {
    transform: translateX(-2px);
  }

  .submenu {
    position: fixed;
    z-index: 10000;
    min-width: 160px;
    max-width: 260px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    box-shadow:
      0 8px 24px var(--theme-shadow, rgba(0, 0, 0, 0.6)),
      0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.4));
    overflow-y: auto;
    max-height: calc(100vh - 16px);
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
    animation: submenu-enter-right 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .submenu.opens-left {
    animation-name: submenu-enter-left;
  }

  /* Submenu items get staggered entrance too */
  .submenu .menu-item {
    animation: item-enter 140ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--item-index, 0) * 25ms);
  }

  .menu-item:focus-visible {
    outline: 2px solid var(--theme-accent, #a855f7);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .context-menu,
    .submenu,
    .submenu.opens-left,
    .menu-item-wrapper,
    .submenu .menu-item {
      animation: none;
    }

    .menu-item {
      transition: none;
    }

    .menu-item-chevron {
      transition: none;
    }
  }
</style>
