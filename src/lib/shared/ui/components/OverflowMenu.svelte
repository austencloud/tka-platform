<!--
  OverflowMenu - Three-dot dropdown for secondary actions

  Displays a vertical three-dot icon button. On click, opens a positioned
  dropdown with action items. Closes on outside click or Escape.
-->
<script lang="ts">
  interface MenuItem {
    label: string;
    icon: string;
    action: () => void;
    variant?: "danger";
  }

  interface Props {
    items: MenuItem[];
    disabled?: boolean;
  }

  const { items, disabled = false }: Props = $props();

  let open = $state(false);
  let menuEl: HTMLElement | null = $state(null);

  function toggle() {
    if (disabled) return;
    open = !open;
  }

  function handleItemClick(item: MenuItem) {
    open = false;
    item.action();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
    }
  }

  function handleOutsidePointerDown(e: PointerEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      open = false;
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener("pointerdown", handleOutsidePointerDown, true);
      return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }
    return undefined;
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overflow-menu" bind:this={menuEl} onkeydown={handleKeydown}>
  <button
    type="button"
    class="overflow-trigger"
    {disabled}
    onclick={toggle}
    aria-label="More actions"
    aria-expanded={open}
    aria-haspopup="menu"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  </button>

  {#if open}
    <div class="overflow-dropdown" role="menu">
      {#each items as item}
        <button
          type="button"
          class="overflow-item"
          class:danger={item.variant === "danger"}
          role="menuitem"
          onclick={() => handleItemClick(item)}
        >
          <i class={item.icon} aria-hidden="true"></i>
          <span>{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .overflow-menu {
    position: relative;
  }

  .overflow-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-target-min, 44px);
    height: var(--touch-target-min, 44px);
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .overflow-trigger:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .overflow-trigger:not(:disabled):hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .overflow-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .overflow-dropdown {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    min-width: 180px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 50;
  }

  .overflow-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .overflow-item:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .overflow-item:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .overflow-item i {
    width: 18px;
    text-align: center;
    font-size: 14px;
  }

  .overflow-item.danger {
    color: var(--semantic-error);
  }

  .overflow-item.danger:hover {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .overflow-trigger,
    .overflow-item {
      transition: none;
    }
  }
</style>
