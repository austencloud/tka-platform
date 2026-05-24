<!--
  ViewerOverflowMenu.svelte

  Three-dot overflow menu for secondary sequence viewer actions.
  Opens a popover above the trigger with labeled action buttons.
  WAI-ARIA menu pattern with keyboard navigation.
-->
<script lang="ts">
  interface Props {
    isPublished?: boolean;
    onCopyLink?: () => void;
    linkCopied?: boolean;
    onPropsOpen?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onDeleteRequest?: () => void;
    practiceActive?: boolean;
    onPracticeToggle?: () => void;
    onVideoUpload?: () => void;
    variant?: 'header' | 'footer';
  }

  let {
    isPublished = false,
    onCopyLink,
    linkCopied = false,
    onPropsOpen,
    onPublish,
    onUnpublish,
    onDeleteRequest,
    practiceActive = false,
    onPracticeToggle,
    onVideoUpload,
    variant = 'header',
  }: Props = $props();

  let isOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      requestAnimationFrame(() => {
        const firstItem = menuEl?.querySelector<HTMLButtonElement>('[role="menuitem"]');
        firstItem?.focus();
      });
    }
  }

  function close() {
    isOpen = false;
    triggerEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen || !menuEl) return;

    const items = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      close();
    }
  }

  function handleItemClick(action: (() => void) | undefined) {
    action?.();
    close();
  }

  let menuItems = $derived.by(() => {
    const items: Array<{ label: string; icon: string; action: () => void; className?: string; dividerBefore?: boolean }> = [];

    if (onPracticeToggle) {
      items.push({
        label: practiceActive ? "Stop Practice" : "Practice Mode",
        icon: practiceActive ? "fa-stop" : "fa-signal",
        action: onPracticeToggle,
        className: practiceActive ? "practice-active" : undefined,
      });
    }
    if (onVideoUpload) {
      items.push({ label: "Upload Video", icon: "fa-video", action: onVideoUpload });
    }
    if (onPropsOpen) {
      items.push({ label: "Props", icon: "fa-wand-magic-sparkles", action: onPropsOpen, dividerBefore: items.length > 0 });
    }
    if (onCopyLink) {
      items.push({
        label: linkCopied ? "Copied!" : "Copy Link",
        icon: linkCopied ? "fa-check" : "fa-link",
        action: onCopyLink,
        className: linkCopied ? "copied" : undefined,
        dividerBefore: !onPropsOpen && items.length > 0,
      });
    }
    if (onPublish || onUnpublish) {
      items.push({
        label: isPublished ? "Make Private" : "Make Public",
        icon: isPublished ? "fa-eye-slash" : "fa-eye",
        action: (isPublished ? onUnpublish : onPublish) ?? (() => {}),
        dividerBefore: !(onPropsOpen || onCopyLink) && items.length > 0,
      });
    }
    if (onDeleteRequest) {
      items.push({
        label: "Delete",
        icon: "fa-trash",
        action: onDeleteRequest,
        className: "delete",
      });
    }

    return items;
  });

  let hasItems = $derived(menuItems.length > 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if hasItems}
  <div class="overflow-wrapper" onkeydown={handleKeydown}>
    <button
      bind:this={triggerEl}
      type="button"
      class="overflow-trigger"
      class:header-variant={variant === 'header'}
      onclick={toggle}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-label="More actions"
    >
      <i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
    </button>

    {#if isOpen}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="overflow-backdrop" onclick={close} onkeydown={() => {}}></div>

      <div bind:this={menuEl} class="overflow-popover" role="menu" aria-label="More actions">
        {#each menuItems as item}
          {#if item.dividerBefore}
            <div class="menu-divider"></div>
          {/if}
          <button
            type="button"
            role="menuitem"
            class="overflow-item {item.className ?? ''}"
            onclick={() => handleItemClick(item.action)}
            tabindex={-1}
          >
            <i class="fas {item.icon}" aria-hidden="true"></i>
            <span>{item.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .overflow-wrapper {
    position: relative;
  }

  .overflow-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .overflow-trigger:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .overflow-trigger:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .overflow-trigger:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .overflow-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .overflow-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 100;
    min-width: 180px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 4px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .overflow-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  .overflow-item i {
    width: 20px;
    text-align: center;
    font-size: 14px;
  }

  .overflow-item:hover,
  .overflow-item:focus {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
    outline: none;
  }

  .overflow-item.delete {
    color: var(--semantic-error, #ef4444);
  }

  .overflow-item.delete:hover,
  .overflow-item.delete:focus {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    color: var(--semantic-error, #ef4444);
  }

  .overflow-item.copied {
    color: var(--semantic-success, #22c55e);
  }

  .overflow-item.practice-active {
    color: #f87171;
  }

  .overflow-item.practice-active:hover,
  .overflow-item.practice-active:focus {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .menu-divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 4px 8px;
  }

  .overflow-trigger.header-variant {
    width: auto;
    height: auto;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border-radius: 8px;
    background: none;
    border: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .overflow-trigger {
      transition: none;
    }
    .overflow-trigger:active {
      transform: none;
    }
  }
</style>
