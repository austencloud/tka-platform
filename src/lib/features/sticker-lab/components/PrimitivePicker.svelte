<script lang="ts">
  import { onMount } from "svelte";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { loadPrimitiveCatalog } from "../services/implementations/PrimitiveCatalogReader";
  import { loadPrimitivePaths, getPrimitivePaths } from "../state/mandala-paths-cache.svelte";
  import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";
  import { entryToRef } from "../domain/primitive-catalog-types";
  import type { PrimitiveCatalogEntry } from "../domain/primitive-catalog-types";
  import type { MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();

  const stickerState = getStickerLabContext();
  const renderer = new MandalaRenderer();

  const PICKER_PALETTE: MandalaPalette = {
    blueStroke: "#1e40af",
    blueFill: "rgba(37, 99, 235, 0.65)",
    redStroke: "#991b1b",
    redFill: "rgba(220, 38, 38, 0.65)",
    purpleStroke: "#6b21a8",
    purpleFill: "rgba(126, 34, 206, 0.75)",
  };

  let pickerEl = $state<HTMLDivElement | null>(null);
  let previousFocus: Element | null = null;

  $effect(() => {
    if (!open || !pickerEl) return;
    previousFocus = document.activeElement;
    pickerEl.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  });

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
</script>

{#if open}
  <div
    class="overlay-backdrop"
    role="presentation"
    onclick={onclose}
    onkeydown={(e) => { if (e.key === "Escape") onclose(); }}
  ></div>
  <div
    class="picker"
    role="dialog"
    aria-label="Choose a mandala primitive"
    aria-modal="true"
    bind:this={pickerEl}
    tabindex="-1"
    onkeydown={(e) => { if (e.key === "Escape") onclose(); }}
  >
    <header>
      <h3>Choose a mandala primitive</h3>
      <button class="close-btn" aria-label="Close picker" onclick={onclose}>×</button>
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
            aria-label="{entry.displayName} — {copies > 0 ? `${copies} on sheet` : 'Add to sheet'}"
          >
            {#if paths}
              {@html renderer.renderSVG(paths, {
                size: 120,
                style: "filled",
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
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
  }

  .picker {
    position: fixed;
    left: 320px; /* TODO(Stage B): derive from column width CSS var when layout becomes resizable */
    top: 60px;
    width: 480px;
    max-height: calc(100vh - 80px);
    background: var(--theme-surface-elevated, #1e1e2e);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    z-index: 101;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  header h3 {
    margin: 0;
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, white);
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 0 4px;
  }
  .close-btn:hover { color: white; }

  .loading, .empty {
    padding: 32px;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: 13px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px;
    overflow-y: auto;
    flex: 1;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .tile:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }
  .tile.on-sheet {
    border-color: var(--theme-accent, #8b5cf6);
    background: rgba(139, 92, 246, 0.08);
  }

  .tile :global(svg) {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: #f9f6ef;
  }

  .tile-label {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-loading {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.2);
    font-size: 18px;
  }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }
</style>
