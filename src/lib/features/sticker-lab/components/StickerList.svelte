<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import StickerListItem from "./StickerListItem.svelte";
  import PrimitivePicker from "./PrimitivePicker.svelte";

  interface Props {
    onExportClick: () => void;
  }
  let { onExportClick }: Props = $props();

  const stickerState = getStickerLabContext();

  let pickerOpen = $state(false);
</script>

<PrimitivePicker open={pickerOpen} onclose={() => (pickerOpen = false)} />

<div class="list-header">
  <span class="count">
    {stickerState.sheet.stickers.length}
    {stickerState.sheet.stickers.length === 1 ? "sticker" : "stickers"}
  </span>
  {#if stickerState.sheet.stickers.length > 0}
    <button class="clear-btn" onclick={() => stickerState.clearSheet()} aria-label="Clear all stickers">
      Clear
    </button>
  {/if}
</div>

<div class="list">
  {#if stickerState.sheet.stickers.length === 0}
    <div class="empty">
      <p>Add a primitive to start your sheet.</p>
      <button class="action-btn primary" onclick={() => (pickerOpen = true)}>Browse Primitives</button>
    </div>
  {:else}
    {#each stickerState.sheet.stickers as sticker (sticker.id)}
      <StickerListItem {sticker} />
    {/each}
  {/if}
</div>

<div class="list-footer">
  <button class="action-btn primary" onclick={() => (pickerOpen = true)} aria-label="Browse primitives">
    + Add
  </button>
  <button class="action-btn secondary" onclick={onExportClick} aria-label="Open export panel">
    Export
  </button>
</div>

<style>
  .list-header {
    display: flex;
    align-items: center;
    margin-bottom: var(--spacing-sm);
    min-height: var(--min-touch-target);
  }

  .count {
    flex: 1;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .clear-btn {
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    color: var(--theme-text-dim);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: color var(--duration-fast), border-color var(--duration-fast);
  }
  .clear-btn:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    flex: 1;
    overflow-y: auto;
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-xl) var(--spacing-md);
    align-items: center;
    text-align: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .list-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-sm);
  }

  .action-btn {
    min-height: var(--min-touch-target);
    border: none;
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition: opacity var(--duration-fast);
  }

  .action-btn.primary {
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .action-btn.secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }
  .action-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
