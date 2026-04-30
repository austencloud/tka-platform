<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { loadPrimitiveCatalog } from "../services/implementations/PrimitiveCatalogReader";
  import { loadPrimitivePaths, getPrimitivePaths } from "../state/mandala-paths-cache.svelte";
  import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";
  import { entryToRef } from "../domain/primitive-catalog-types";
  import type { PrimitiveCatalogEntry } from "../domain/primitive-catalog-types";
  import type { MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open = $bindable(), onclose }: Props = $props();

  const stickerState = getStickerLabContext();
  const renderer = new MandalaRenderer();

  const PICKER_PALETTE: MandalaPalette = {
    blueStroke: "#1e40af",
    blueFill: "transparent",
    redStroke: "#991b1b",
    redFill: "transparent",
    purpleStroke: "#6b21a8",
    purpleFill: "transparent",
  };

  let entries = $state<PrimitiveCatalogEntry[]>([]);
  let isLoading = $state(true);

  onMount(async () => {
    const catalog = await loadPrimitiveCatalog();
    entries = catalog.entries;
    isLoading = false;
    for (const entry of entries) {
      void loadPrimitivePaths(entry.shapeHash);
    }
  });

  const copiesMap = $derived(
    new Map(stickerState.sheet.stickers.map(s => [s.primitiveRef.shapeHash, s.copies]))
  );

  function handleAdd(entry: PrimitiveCatalogEntry) {
    stickerState.addPrimitive(entryToRef(entry));
  }

  function handleClose() {
    open = false;
    onclose();
  }
</script>

<Drawer
  bind:isOpen={open}
  placement="right"
  respectLayoutMode={true}
  ariaLabel="Choose a mandala primitive"
  closeOnBackdrop={true}
  showHandle={true}
  class="primitive-picker-drawer"
  onclose={handleClose}
  trapFocus={true}
  preventScroll={false}
>
  <div class="picker-content">
    <header class="picker-header">
      <h3>Primitives</h3>
      <div class="header-right">
        <span class="entry-count">{entries.length}</span>
        <button class="close-btn" aria-label="Close picker" onclick={handleClose}>
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    {#if isLoading}
      <div class="loading">Loading primitives…</div>
    {:else if entries.length === 0}
      <div class="empty">No primitives available.</div>
    {:else}
      <div class="grid">
        {#each entries as entry (entry.shapeHash)}
          {@const paths = getPrimitivePaths(entry.shapeHash)}
          {@const copies = copiesMap.get(entry.shapeHash) ?? 0}
          <button
            class="tile"
            class:on-sheet={copies > 0}
            onclick={() => handleAdd(entry)}
            aria-label="{entry.displayName} - {copies > 0 ? `${copies} on sheet` : 'Add to sheet'}"
          >
            {#if paths}
              {@html renderer.renderSVG(paths, {
                size: 120,
                style: "stroke",
                showGridDots: false,
                show: "both",
                strokeWidth: 2,
                transparentBackground: true,
                palette: PICKER_PALETTE,
              })}
            {:else}
              <div class="tile-loading">…</div>
            {/if}
            <span class="tile-label">{entry.displayName}</span>
            {#if copies > 0}
              <span class="badge">{copies}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</Drawer>

<style>
  :global(.drawer-content.primitive-picker-drawer[data-placement="right"]) {
    width: clamp(300px, 30vw, 400px);
  }

  .picker-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--spacing-md);
  }

  .picker-header {
    display: flex;
    align-items: center;
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-bottom: var(--spacing-md);
  }

  .picker-header h3 {
    margin: 0;
    flex: 1;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .entry-count {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
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

  .loading, .empty {
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--spacing-sm);
    overflow-y: auto;
    flex: 1;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid transparent;
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    transition: background var(--duration-fast), border-color var(--duration-fast);
  }
  .tile:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }
  .tile.on-sheet {
    border-color: var(--theme-accent, #8b5cf6);
    background: rgba(139, 92, 246, 0.08);
  }

  .tile :global(svg) {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #f9f6ef;
  }

  .tile-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-loading {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-lg);
  }

  .badge {
    position: absolute;
    top: var(--spacing-xs);
    right: var(--spacing-xs);
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-size: var(--font-size-compact);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--spacing-xs);
  }
</style>
