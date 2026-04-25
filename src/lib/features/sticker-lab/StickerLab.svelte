<script lang="ts">
  import { createStickerLabState } from "./state/sticker-lab-state.svelte";
  import { setStickerLabContext } from "./context/sticker-lab-context";
  import StickerList from "./components/StickerList.svelte";
  import StickerSheetPreview from "./components/StickerSheetPreview.svelte";
  import StickerExportPanel from "./components/StickerExportPanel.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";

  const labState = createStickerLabState();
  setStickerLabContext(labState);

  let exportDrawerOpen = $state(false);
</script>

<div class="sticker-lab">
  <section class="col col-list" aria-label="Sticker list">
    <header><h2>Stickers</h2></header>
    <StickerList onExportClick={() => (exportDrawerOpen = true)} />
  </section>

  <section class="col col-preview" aria-label="Sheet preview">
    <header><h2>Sheet Preview</h2></header>
    <StickerSheetPreview />
  </section>
</div>

<Drawer
  bind:isOpen={exportDrawerOpen}
  placement="right"
  respectLayoutMode={true}
  ariaLabel="Export sticker sheet"
  closeOnBackdrop={true}
  showHandle={true}
  class="sticker-export-drawer"
  trapFocus={false}
  preventScroll={false}
>
  <div class="export-drawer-content">
    <header class="export-header">
      <h3>Export</h3>
      <button
        class="close-btn"
        aria-label="Close export panel"
        onclick={() => (exportDrawerOpen = false)}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </header>
    <StickerExportPanel />
  </div>
</Drawer>

<style>
  .sticker-lab {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--spacing-md);
    height: 100%;
    padding: var(--spacing-md);
    box-sizing: border-box;
  }

  @media (max-width: 640px) {
    .sticker-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    .col-preview {
      min-height: 300px;
    }
  }

  .col {
    display: flex;
    flex-direction: column;
    background: var(--theme-surface, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-2026-sm);
    padding: var(--spacing-md);
    overflow: auto;
  }

  .col header {
    margin-bottom: var(--spacing-md);
  }

  .col h2 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  :global(.drawer-content.sticker-export-drawer[data-placement="right"]) {
    width: clamp(280px, 25vw, 360px);
  }

  .export-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--spacing-md);
  }

  .export-header {
    display: flex;
    align-items: center;
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-bottom: var(--spacing-md);
  }

  .export-header h3 {
    margin: 0;
    flex: 1;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: none;
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: color var(--duration-fast);
  }
  .close-btn:hover {
    color: var(--theme-text, white);
  }
</style>
