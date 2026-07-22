<!--
  ViewerOverflowMenu.svelte

  Three-dot overflow menu for secondary sequence viewer actions.
  Opens a popover above the trigger with labeled action buttons.
  WAI-ARIA menu pattern with keyboard navigation.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { shareTarget, saveActionLabel } from "$lib/shared/mobile/share-action.svelte";
  import MotionColorChips from "$lib/shared/components/MotionColorChips.svelte";

  type OverflowOpenReason =
    | "trigger"
    | "item"
    | "backdrop"
    | "escape"
    | "tab";

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
    dropDown?: boolean;
    /**
     * Horizontal edge the popover aligns to. 'left' when the trigger sits at the
     * screen's left edge; 'center' drops the popover centred under the trigger
     * (used when the header title itself is the trigger).
     */
    align?: 'left' | 'right' | 'center';
    /**
     * Custom trigger content. When provided, the trigger button renders this
     * snippet (a transparent title-style row) instead of the three-dot glyph, so
     * the header title can BE the menu trigger. Open/close, backdrop, keyboard
     * nav, and the item model are unchanged. Omit for the default three-dot.
     * `hasMenu` is false when there are no items to open — the caller hides the
     * chevron in that case so a dead title doesn't advertise a dropdown.
     */
    trigger?: Snippet<[{ isOpen: boolean; hasMenu: boolean }]>;
    isFavorite?: boolean;
    onFavoriteToggle?: () => void;
    isSaved?: boolean;
    onSave?: () => void;
    onRemix?: () => void;
    /** Label for the onRemix item. Defaults to "Remix". */
    remixLabel?: string;
    /** Download the current sequence (QR scan funnel). Renders a Download item. */
    onDownload?: () => void;
    /** Swap the Download item to a spinner + "Preparing…" while an export runs. */
    downloadBusy?: boolean;
    /** Open the wider app from a guest surface (QR scan funnel). */
    onOpenApp?: () => void;
    /** Label for the onOpenApp item. Defaults to "Open TKA". */
    openAppLabel?: string;
    onCopyData?: () => void;
    copyDataFeedback?: boolean;
    /** "See it in the Guide" action — maps the sequence to a guide destination
     *  and navigates there (QR scan → codex/chapter handoff). */
    onGuideAction?: () => void;
    /** Label for the onGuideAction item. Defaults to "See it in the Guide". */
    guideActionLabel?: string;
    /** When set, a "View in coven hub" item deep-links to /coven?seq=<id>. */
    sequenceId?: string;
    /** When set, a Left/Right motion-visibility chip row renders atop the menu. */
    motionVisibility?: {
      showBlue: boolean;
      showRed: boolean;
      onToggleBlue: () => void;
      onToggleRed: () => void;
    };
    onOpenChange?: (open: boolean, reason: OverflowOpenReason) => void;
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
    dropDown = false,
    align = 'right',
    trigger,
    isFavorite = false,
    onFavoriteToggle,
    isSaved = true,
    onSave,
    onRemix,
    remixLabel = "Remix",
    onDownload,
    downloadBusy = false,
    onOpenApp,
    openAppLabel = "Open TKA",
    onCopyData,
    copyDataFeedback = false,
    onGuideAction,
    guideActionLabel = "See it in the Guide",
    sequenceId,
    motionVisibility,
    onOpenChange,
  }: Props = $props();

  let isOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);

  function toggle() {
    if (!hasMenu) return;
    isOpen = !isOpen;
    onOpenChange?.(isOpen, "trigger");
    if (isOpen) {
      requestAnimationFrame(() => {
        const firstItem = menuEl?.querySelector<HTMLButtonElement>('[role="menuitem"]');
        firstItem?.focus();
      });
    }
  }

  function close(reason: Exclude<OverflowOpenReason, "trigger">) {
    if (!isOpen) return;
    isOpen = false;
    onOpenChange?.(false, reason);
    triggerEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen || !menuEl) return;

    const items = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "Escape") {
      e.preventDefault();
      close("escape");
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
      close("tab");
    }
  }

  function handleItemClick(action: (() => void) | undefined) {
    action?.();
    close("item");
  }

  let menuItems = $derived.by(() => {
    const items: Array<{ label: string; icon: string; action: () => void; className?: string; dividerBefore?: boolean }> = [];

    if (onFavoriteToggle) {
      items.push({
        label: isFavorite ? "Unfavorite" : "Favorite",
        icon: "fa-heart",
        action: onFavoriteToggle,
        className: isFavorite ? "favorited" : undefined,
      });
    }
    if (onSave && !isSaved) {
      items.push({ label: "Save", icon: "fa-floppy-disk", action: onSave, className: "save" });
    }
    if (onRemix) {
      items.push({ label: remixLabel, icon: "fa-pen-to-square", action: onRemix, className: "remix" });
    }
    if (onDownload) {
      // Mobile opens the native share sheet, so the item reads "Share" there and
      // "Download" on desktop — matching shareOrDownloadBlob's actual behavior.
      items.push({
        label: downloadBusy ? "Preparing…" : saveActionLabel(),
        icon: downloadBusy
          ? "fa-spinner fa-spin"
          : shareTarget.isMobile
            ? "fa-share-nodes"
            : "fa-download",
        action: onDownload,
      });
    }
    if (onOpenApp) {
      items.push({
        label: openAppLabel,
        icon: "fa-compass",
        action: onOpenApp,
        dividerBefore: items.length > 0,
      });
    }
    if (onCopyData) {
      items.push({
        label: copyDataFeedback ? "Copied!" : "Copy Data",
        icon: copyDataFeedback ? "fa-check" : "fa-terminal",
        action: onCopyData,
        className: copyDataFeedback ? "copied" : undefined,
      });
    }
    if (onGuideAction) {
      items.push({
        label: guideActionLabel,
        icon: "fa-book-open",
        action: onGuideAction,
        dividerBefore: items.length > 0,
      });
    }
    if (onPracticeToggle) {
      items.push({
        label: practiceActive ? "Stop Practice" : "Practice Mode",
        icon: practiceActive ? "fa-stop" : "fa-dumbbell",
        action: onPracticeToggle,
        className: practiceActive ? "practice-active" : undefined,
        dividerBefore: items.length > 0,
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
    if (sequenceId) {
      items.push({
        label: "View in coven hub",
        icon: "fa-hat-wizard",
        action: () => goto(`/coven?seq=${sequenceId}`),
        dividerBefore: items.length > 0,
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
  // The menu can open only when it has items (or the motion row). A title trigger
  // still RENDERS with no items so the header title never disappears — it just
  // isn't interactive (chevron hidden by the caller, toggle no-ops).
  let hasMenu = $derived(hasItems || !!motionVisibility);
  let shouldRender = $derived(hasMenu || !!trigger);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if shouldRender}
  <div
    class="overflow-wrapper"
    class:drop-down={dropDown}
    class:align-left={align === 'left'}
    class:align-center={align === 'center'}
    class:title-trigger={!!trigger}
    onkeydown={handleKeydown}
  >
    <button
      bind:this={triggerEl}
      type="button"
      class="overflow-trigger"
      class:header-variant={variant === 'header' && !trigger}
      class:title-variant={!!trigger}
      class:static={!!trigger && !hasMenu}
      onclick={toggle}
      aria-haspopup={hasMenu ? "menu" : undefined}
      aria-expanded={hasMenu ? isOpen : undefined}
      aria-label="More actions"
    >
      {#if trigger}
        {@render trigger({ isOpen, hasMenu })}
      {:else}
        <i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>
      {/if}
    </button>

    {#if isOpen && hasMenu}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="overflow-backdrop"
        onclick={() => close("backdrop")}
        onkeydown={() => {}}
      ></div>

      <div bind:this={menuEl} class="overflow-popover" role="menu" aria-label="More actions">
        {#if motionVisibility}
          <div class="motion-vis-section">
            <span class="motion-vis-label">Motion</span>
            <MotionColorChips
              showBlue={motionVisibility.showBlue}
              showRed={motionVisibility.showRed}
              onToggleBlue={motionVisibility.onToggleBlue}
              onToggleRed={motionVisibility.onToggleRed}
            />
          </div>
          {#if hasItems}
            <div class="menu-divider"></div>
          {/if}
        {/if}
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

  .overflow-wrapper.drop-down .overflow-popover {
    bottom: auto;
    top: calc(100% + 8px);
  }

  .overflow-wrapper.align-left .overflow-popover {
    right: auto;
    left: 0;
  }

  /* Centred under the trigger — used when the header title itself is the trigger. */
  .overflow-wrapper.align-center .overflow-popover {
    right: auto;
    left: 50%;
    transform: translateX(-50%);
  }

  /* Title-as-trigger: the button is a transparent inline row (title text + chevron)
     rather than the three-dot circle. It carries the 44px touch floor. */
  .overflow-trigger.title-variant {
    width: auto;
    height: auto;
    min-height: var(--min-touch-target, 44px);
    padding: 2px 8px;
    gap: 8px;
    border-radius: 10px;
    background: none;
    border: none;
    color: var(--theme-text, #fff);
  }
  @media (hover: hover) and (pointer: fine) {
    .overflow-trigger.title-variant:hover {
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
      color: var(--theme-text, #fff);
    }
  }
  .overflow-trigger.title-variant:active {
    transform: none;
  }
  /* No items to open: the title still shows, but reads as plain text. */
  .overflow-trigger.title-variant.static {
    cursor: default;
  }
  .overflow-trigger.title-variant.static:hover {
    background: none;
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

  .overflow-item.favorited {
    color: var(--semantic-error, #ef4444);
  }

  .overflow-item.save {
    color: var(--semantic-success, #22c55e);
  }

  .overflow-item.remix {
    color: var(--semantic-warning, #f59e0b);
  }

  .overflow-item.practice-active {
    color: var(--semantic-error, #f87171);
  }

  .overflow-item.practice-active:hover,
  .overflow-item.practice-active:focus {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    color: var(--semantic-error, #f87171);
  }

  .menu-divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 4px 8px;
  }

  .motion-vis-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 8px 2px;
  }

  .motion-vis-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .motion-vis-section :global(.motion-color-chips) {
    width: 100%;
  }

  .motion-vis-section :global(.chip) {
    flex: 1;
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
