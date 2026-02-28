<!--
  SidebarContextMenu - Right-click context menu for sidebar tab visibility toggling.

  Two modes:
  - Tab mode: Single "Hide [Tab Name]" action
  - Module mode: Lists all tabs with toggle checkmarks for batch visibility editing
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { ISidebarTabToggler, TabVisibilityInfo } from "../../services/contracts/ISidebarTabToggler";
  import type { ModuleId } from "../../domain/types";
  import { translateTab } from "$lib/shared/i18n/translate";
  import { getReactiveLocale } from "$lib/shared/i18n/locale-state.svelte";

  export type ContextMenuState =
    | { mode: "closed" }
    | { mode: "tab"; moduleId: ModuleId; tabId: string; tabLabel: string; x: number; y: number }
    | { mode: "module"; moduleId: ModuleId; moduleLabel: string; x: number; y: number };

  let {
    menuState,
    onClose,
  } = $props<{
    menuState: ContextMenuState;
    onClose: () => void;
  }>();

  let menuElement = $state<HTMLDivElement | null>(null);
  let sidebarTabToggler: ISidebarTabToggler | null = null;
  let tabInfos = $state<TabVisibilityInfo[]>([]);

  // Reactive locale for translations
  const locale = $derived(getReactiveLocale());

  // Load tab infos when opening in module mode
  $effect(() => {
    if (menuState.mode === "module" && sidebarTabToggler) {
      tabInfos = sidebarTabToggler.getAllTabsForModule(menuState.moduleId);
    }
  });

  // Position clamping: keep menu within viewport
  const menuStyle = $derived.by(() => {
    if (menuState.mode === "closed") return "";
    const x = menuState.x;
    const y = menuState.y;
    return `left: ${x}px; top: ${y}px;`;
  });

  // Clamp position and constrain height to fit within viewport
  $effect(() => {
    if (menuState.mode === "closed" || !menuElement) return;

    const rect = menuElement.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let x = menuState.x;
    let y = menuState.y;

    // Horizontal clamping
    if (x + rect.width > vw - margin) {
      x = vw - rect.width - margin;
    }
    if (x < margin) x = margin;

    // Vertical: if menu fits below cursor, place there.
    // If not, try placing above cursor. If still too tall, pin to top and scroll.
    const spaceBelow = vh - y - margin;
    const spaceAbove = y - margin;

    if (rect.height <= spaceBelow) {
      // Fits below cursor
      menuElement.style.maxHeight = "";
    } else if (rect.height <= spaceAbove) {
      // Fits above cursor
      y = y - rect.height;
    } else {
      // Doesn't fit either direction — pin to top margin, cap height
      y = margin;
      menuElement.style.maxHeight = `${vh - margin * 2}px`;
    }

    if (y < margin) y = margin;

    menuElement.style.left = `${x}px`;
    menuElement.style.top = `${y}px`;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuElement && !menuElement.contains(e.target as Node)) {
      onClose();
    }
  }

  async function handleHideTab() {
    if (menuState.mode !== "tab" || !sidebarTabToggler) return;
    await sidebarTabToggler.hideTab(menuState.moduleId, menuState.tabId);
    onClose();
  }

  async function handleToggleTab(info: TabVisibilityInfo) {
    if (menuState.mode !== "module" || !sidebarTabToggler || info.isRoleLocked) return;
    const moduleId = menuState.moduleId;

    if (info.isVisible) {
      await sidebarTabToggler.hideTab(moduleId, info.section.id);
    } else {
      await sidebarTabToggler.showTab(moduleId, info.section.id);
    }

    // Refresh the list after toggling
    tabInfos = sidebarTabToggler.getAllTabsForModule(moduleId);
  }

  onMount(() => {
    sidebarTabToggler = container.items.sidebarTabToggler;

    // Load initial data if already in module mode
    if (menuState.mode === "module") {
      tabInfos = sidebarTabToggler.getAllTabsForModule(menuState.moduleId);
    }

    document.addEventListener("click", handleClickOutside, true);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("click", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

{#if menuState.mode !== "closed"}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="context-menu"
    bind:this={menuElement}
    style={menuStyle}
    role="menu"
    tabindex="-1"
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#if menuState.mode === "tab"}
      <button
        class="menu-item"
        role="menuitem"
        onclick={handleHideTab}
      >
        <i class="fas fa-eye-slash menu-item-icon" aria-hidden="true"></i>
        <span class="menu-item-label">Hide {menuState.tabLabel}</span>
      </button>
    {:else if menuState.mode === "module"}
      <div class="menu-header">{menuState.moduleLabel} Tabs</div>
      {#each tabInfos as info}
        {@const label = translateTab(menuState.moduleId, info.section.id, info.section.label)}
        <button
          class="menu-item"
          class:disabled={info.isRoleLocked}
          role="menuitem"
          disabled={info.isRoleLocked}
          onclick={() => handleToggleTab(info)}
        >
          {#if info.isRoleLocked}
            <i class="fas fa-lock menu-item-icon locked" aria-hidden="true"></i>
          {:else if info.isVisible}
            <i class="fas fa-check menu-item-icon visible" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-eye-slash menu-item-icon hidden" aria-hidden="true"></i>
          {/if}
          <span class="menu-item-label">{label}</span>
        </button>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 9999;
    min-width: 200px;
    max-width: 300px;
    padding: 4px;
    background: #1a1a2e;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
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

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast, 100ms) ease;
  }

  .menu-item:hover:not(.disabled) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
  }

  .menu-item.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .menu-item-icon {
    width: 16px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    flex-shrink: 0;
  }

  .menu-item-icon.visible {
    color: var(--semantic-success, #22c55e);
  }

  .menu-item-icon.hidden {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .menu-item-icon.locked {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .menu-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Focus for keyboard navigation */
  .menu-item:focus-visible {
    outline: 2px solid var(--theme-accent, #a855f7);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .menu-item {
      transition: none;
    }
  }
</style>
