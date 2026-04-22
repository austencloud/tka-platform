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

  let entries = $state<PrimitiveCatalogEntry[]>([]);
  let isLoading = $state(true);
  let filterSymmetry = $state<"all" | "high" | "low">("all");
  let filterColoration = $state<"all" | "monochrome" | "two-color">("all");

  onMount(async () => {
    const catalog = await loadPrimitiveCatalog();
    entries = catalog.entries;
    isLoading = false;
    for (const entry of entries) {
      void loadPrimitivePaths(entry.shapeHash);
    }
  });

  const filteredEntries = $derived.by(() => {
    return entries.filter((e) => {
      if (filterSymmetry === "high" && e.symmetryOrder < 4) return false;
      if (filterSymmetry === "low" && e.symmetryOrder >= 4) return false;
      if (filterColoration === "monochrome" && e.ultraCount > 1) return false;
      if (filterColoration === "two-color" && e.ultraCount <= 1) return false;
      return true;
    });
  });

  function copiesOnSheet(shapeHash: string): number {
    const sticker = stickerState.sheet.stickers.find((s) => s.primitiveRef.shapeHash === shapeHash);
    return sticker ? sticker.copies : 0;
  }

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
  <div class="picker" role="dialog" aria-label="Choose a mandala primitive" aria-modal="true">
    <header>
      <h3>Choose a mandala primitive</h3>
      <button class="close-btn" aria-label="Close picker" onclick={onclose}>×</button>
    </header>

    <div class="filters">
      <label>
        Symmetry:
        <select bind:value={filterSymmetry}>
          <option value="all">All</option>
          <option value="high">High symmetry</option>
          <option value="low">Low symmetry</option>
        </select>
      </label>
      <label>
        Coloration:
        <select bind:value={filterColoration}>
          <option value="all">All</option>
          <option value="monochrome">Monochrome</option>
          <option value="two-color">Two-color</option>
        </select>
      </label>
      <button
        class="clear-btn"
        onclick={() => { filterSymmetry = "all"; filterColoration = "all"; }}
        disabled={filterSymmetry === "all" && filterColoration === "all"}
      >
        Clear
      </button>
    </div>

    {#if isLoading}
      <div class="loading">Loading primitives…</div>
    {:else if filteredEntries.length === 0}
      <div class="empty">No primitives match these filters.</div>
    {:else}
      <div class="grid">
        {#each filteredEntries as entry (entry.shapeHash)}
          {@const paths = getPrimitivePaths(entry.shapeHash)}
          {@const copies = copiesOnSheet(entry.shapeHash)}
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

  .filters {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    flex-wrap: wrap;
  }
  .filters label { display: flex; align-items: center; gap: 6px; }
  .filters select {
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text, white);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 11px;
  }
  .clear-btn {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    font-size: 11px;
  }
  .clear-btn:disabled { opacity: 0.3; cursor: not-allowed; }

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
