<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import StickerListItem from "./StickerListItem.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  const state = getStickerLabContext();

  function openDeckBrowser() {
    // Navigate to the choreo-card module where the deck browser lives.
    navigationState.setCurrentModule("choreo_card");
  }
</script>

<div class="list">
  {#if state.sheet.stickers.length === 0}
    <div class="empty">
      <p>Open the deck browser and send LOOPs here to build your sheet.</p>
      <button onclick={openDeckBrowser}>Open deck browser</button>
    </div>
  {:else}
    {#each state.sheet.stickers as sticker (sticker.id)}
      <StickerListItem {sticker} />
    {/each}
  {/if}
</div>

<style>
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
