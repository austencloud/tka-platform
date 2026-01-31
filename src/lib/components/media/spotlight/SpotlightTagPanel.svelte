<!--
  SpotlightTagPanel.svelte

  Slide-out panel for tagging media items.

  Features:
  - Slides in from the right
  - Tag grid with number key shortcuts (1-9)
  - Active tags highlighted
  - "New Tag" button at bottom
-->
<script lang="ts">
  import type { MediaItem } from "./MediaSpotlight.svelte";

  interface Props {
    /** Whether panel is open */
    open: boolean;
    /** Current media item */
    item: MediaItem | null;
    /** Available tags to choose from */
    availableTags?: string[];
    /** Callback when tags change */
    onTagChange?: (itemId: string, tags: string[]) => void;
    /** Callback to close panel */
    onClose?: () => void;
    /** Callback to create new tag */
    onCreateTag?: () => void;
  }

  let {
    open,
    item,
    availableTags = [],
    onTagChange,
    onClose,
    onCreateTag,
  }: Props = $props();

  // ===== State =====
  let newTagInput = $state("");

  // ===== Derived =====
  const currentTags = $derived(new Set(item?.tags ?? []));

  // ===== Handlers =====
  function toggleTag(tag: string) {
    if (!item) return;

    const newTags = new Set(currentTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }

    onTagChange?.(item.id, Array.from(newTags));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;

    // Escape closes panel
    if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
      return;
    }

    // Number keys 1-9 toggle tags
    if (e.key >= "1" && e.key <= "9") {
      const index = parseInt(e.key, 10) - 1;
      if (index < availableTags.length) {
        e.preventDefault();
        toggleTag(availableTags[index]!);
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="spotlight-tag-panel"
  data-open={open}
  role="dialog"
  aria-label="Tag editor"
  aria-modal="false"
>
  <!-- Header -->
  <div class="tag-panel-header">
    <h2 class="tag-panel-title">Tags</h2>
    <button
      class="tag-panel-close"
      onclick={onClose}
      aria-label="Close tag panel"
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>

  <!-- Tag Grid -->
  <div class="tag-panel-content">
    {#if availableTags.length > 0}
      <div class="tag-grid" role="group" aria-label="Available tags">
        {#each availableTags as tag, index}
          {@const isActive = currentTags.has(tag)}
          {@const shortcutKey = index < 9 ? (index + 1).toString() : null}
          <button
            class="tag-chip"
            class:active={isActive}
            onclick={() => toggleTag(tag)}
            aria-pressed={isActive}
            type="button"
          >
            <span class="tag-name">{tag}</span>
            {#if shortcutKey}
              <span class="tag-shortcut" aria-hidden="true">{shortcutKey}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="tag-empty">
        <p>No tags available</p>
        <p class="tag-empty-hint">Create tags to organize your media</p>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="tag-panel-footer">
    <button
      class="tag-create-btn"
      onclick={onCreateTag}
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span>New Tag</span>
    </button>
  </div>
</div>

<style>
  .spotlight-tag-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--spotlight-tag-panel-width, 280px);
    max-width: 90vw;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 20;
  }

  .spotlight-tag-panel[data-open="true"] {
    transform: translateX(0);
  }

  /* Header */
  .tag-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    padding-top: calc(16px + var(--spotlight-safe-area-top, 0px));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tag-panel-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .tag-panel-close {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 150ms ease,
      color 150ms ease;
  }

  .tag-panel-close:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, white);
  }

  .tag-panel-close:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Content */
  .tag-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .tag-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text, white);
    font-size: 13px;
    cursor: pointer;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }

  .tag-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .tag-chip:active {
    transform: scale(0.95);
  }

  .tag-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  .tag-chip.active {
    background: var(--theme-accent, #f43f5e);
    border-color: var(--theme-accent, #f43f5e);
    color: white;
  }

  .tag-chip.active:hover {
    background: color-mix(in srgb, var(--theme-accent, #f43f5e) 85%, black);
    border-color: color-mix(in srgb, var(--theme-accent, #f43f5e) 85%, black);
  }

  .tag-name {
    flex: 1;
  }

  .tag-shortcut {
    font-size: 11px;
    font-weight: 600;
    opacity: 0.6;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  .tag-chip.active .tag-shortcut {
    background: rgba(0, 0, 0, 0.3);
    opacity: 0.8;
  }

  /* Empty State */
  .tag-empty {
    text-align: center;
    padding: 24px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }

  .tag-empty p {
    margin: 0;
  }

  .tag-empty-hint {
    font-size: 13px;
    margin-top: 8px !important;
    opacity: 0.7;
  }

  /* Footer */
  .tag-panel-footer {
    padding: 16px;
    padding-bottom: calc(16px + var(--spotlight-safe-area-bottom, 0px));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tag-create-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: 14px;
    cursor: pointer;
    transition:
      background 150ms ease,
      border-color 150ms ease;
  }

  .tag-create-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .tag-create-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight-tag-panel {
      transition: none;
    }

    .tag-chip,
    .tag-panel-close,
    .tag-create-btn {
      transition: none;
    }
  }
</style>
