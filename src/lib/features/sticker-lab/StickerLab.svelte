<!--
  StickerLab.svelte — Phase 1 MVP sticker lab tab.

  Three-column layout: sticker list (left), sheet preview (center), export panel (right).
  Child components are added in later tasks.
-->
<script lang="ts">
  import { createStickerLabState } from "./state/sticker-lab-state.svelte";
  import { setStickerLabContext } from "./context/sticker-lab-context";
  import StickerList from "./components/StickerList.svelte";
  import StickerSheetPreview from "./components/StickerSheetPreview.svelte";

  const state = createStickerLabState();
  setStickerLabContext(state);
</script>

<div class="sticker-lab">
  <section class="col col-list" aria-label="Sticker list">
    <header><h2>Stickers</h2></header>
    <StickerList />
  </section>

  <section class="col col-preview" aria-label="Sheet preview">
    <header><h2>Sheet preview</h2></header>
    <StickerSheetPreview />
  </section>

  <section class="col col-export" aria-label="Export panel">
    <header><h2>Export</h2></header>
    <div class="placeholder">Export panel (Task 11)</div>
  </section>
</div>

<style>
  .sticker-lab {
    display: grid;
    grid-template-columns: 320px 1fr 300px;
    gap: 16px;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
  }

  .col {
    display: flex;
    flex-direction: column;
    background: var(--theme-surface, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    padding: 12px;
    overflow: auto;
  }

  .col header {
    margin-bottom: 12px;
  }
  .col h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-style: italic;
    font-size: 13px;
  }
</style>
