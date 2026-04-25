<script lang="ts">
  import { createStickerLabState } from "./state/sticker-lab-state.svelte";
  import { setStickerLabContext } from "./context/sticker-lab-context";
  import StickerList from "./components/StickerList.svelte";
  import StickerSheetPreview from "./components/StickerSheetPreview.svelte";
  import StickerExportPanel from "./components/StickerExportPanel.svelte";

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
    <StickerExportPanel />
  </section>
</div>

<style>
  .sticker-lab {
    display: grid;
    grid-template-columns: 280px 1fr 260px;
    gap: 16px;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
  }

  @media (max-width: 1024px) {
    .sticker-lab {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr auto;
    }
    .col-preview {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 640px) {
    .sticker-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }
    .col-preview {
      grid-column: auto;
      min-height: 300px;
    }
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
</style>
