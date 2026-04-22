<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import StickerListItem from "./StickerListItem.svelte";
  import PrimitivePicker from "./PrimitivePicker.svelte";

  const stickerState = getStickerLabContext();

  let pickerOpen = $state(false);
</script>

<PrimitivePicker open={pickerOpen} onclose={() => (pickerOpen = false)} />

<div class="list-header">
  <span class="count">
    {stickerState.sheet.stickers.length}
    {stickerState.sheet.stickers.length === 1 ? "sticker" : "stickers"}
  </span>
  <button class="add-btn" onclick={() => (pickerOpen = true)} aria-label="Browse primitives">
    + Add
  </button>
</div>

<div class="list">
  {#if stickerState.sheet.stickers.length === 0}
    <div class="empty">
      <p>Add a primitive to start your sheet.</p>
      <button onclick={() => (pickerOpen = true)}>Browse primitives</button>
    </div>
  {:else}
    {#each stickerState.sheet.stickers as sticker (sticker.id)}
      <StickerListItem {sticker} />
    {/each}
  {/if}
</div>

<style>
  .list-header {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
  }
  .count {
    flex: 1;
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }
  .add-btn {
    padding: 4px 10px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px 12px;
    align-items: center;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 13px;
  }

  .empty button {
    padding: 8px 16px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
</style>
