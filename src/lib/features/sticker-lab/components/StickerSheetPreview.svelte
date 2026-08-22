<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { renderStickerUnitSVG } from "../services/sticker-unit-renderer";
  import {
    getPrimitivePaths,
    loadPrimitivePaths,
  } from "../state/mandala-paths-cache.svelte";
  import {
    SHEET_DIMENSIONS_IN,
    STICKER_GAP_IN,
  } from "../domain/sticker-constants";

  const stickerState = getStickerLabContext();

  let showCutLines = $state(true);
  let showBleed = $state(false);
  let activePage = $state(0);

  // Expand sticker copies into a flat list for layout.
  const flattened = $derived(
    stickerState.sheet.stickers.flatMap((s) =>
      Array.from({ length: s.copies }, () => s)
    )
  );

  const layout = $derived.by(() => {
    const { width: sw, height: sh } =
      SHEET_DIMENSIONS_IN[stickerState.sheet.sheetSize];
    const diameter = 3;
    const pitch = diameter + STICKER_GAP_IN;
    const cols = Math.floor((sw + STICKER_GAP_IN) / pitch);
    const rows = Math.floor((sh + STICKER_GAP_IN) / pitch);
    const perPage = cols * rows;
    const pages =
      perPage > 0 ? Math.max(1, Math.ceil(flattened.length / perPage)) : 1;
    return { sheetWidthIn: sw, sheetHeightIn: sh, cols, rows, perPage, pages };
  });

  // Clamp activePage when pages shrink.
  $effect(() => {
    if (activePage >= layout.pages) activePage = Math.max(0, layout.pages - 1);
  });

  // Fire-and-forget: populate the mandala-paths cache for every visible sticker.
  // Writes to the $state-backed cache trigger a rerender, so the SVG appears
  // as soon as paths resolve.
  $effect(() => {
    for (const sticker of stickerState.sheet.stickers) {
      void loadPrimitivePaths(sticker.primitiveRef);
    }
  });

  const pageStickers = $derived(
    flattened.slice(
      activePage * layout.perPage,
      (activePage + 1) * layout.perPage
    )
  );
</script>

<div class="preview">
  <div class="toolbar">
    <button
      class="toggle-btn"
      aria-pressed={showCutLines}
      onclick={() => (showCutLines = !showCutLines)}>Cut lines</button
    >
    <button
      class="toggle-btn"
      aria-pressed={showBleed}
      onclick={() => (showBleed = !showBleed)}>Bleed</button
    >
    <span class="count"
      >{flattened.length} stickers across {layout.pages} sheet{layout.pages ===
      1
        ? ""
        : "s"}</span
    >
    {#if layout.pages > 1}
      <nav class="pager" aria-label="Sheet pages">
        <button
          onclick={() => (activePage = Math.max(0, activePage - 1))}
          disabled={activePage === 0}
          aria-label="Previous sheet">‹</button
        >
        <span>Sheet {activePage + 1} of {layout.pages}</span>
        <button
          onclick={() =>
            (activePage = Math.min(layout.pages - 1, activePage + 1))}
          disabled={activePage >= layout.pages - 1}
          aria-label="Next sheet">›</button
        >
      </nav>
    {/if}
  </div>

  <div class="sheet-frame">
    <div
      class="sheet"
      style:--sheet-w="{layout.sheetWidthIn}in"
      style:--sheet-h="{layout.sheetHeightIn}in"
      style:--sheet-ar="{layout.sheetWidthIn} / {layout.sheetHeightIn}"
      style:--cols={layout.cols}
      style:--rows={layout.rows}
      class:show-cut-lines={showCutLines}
      class:show-bleed={showBleed}
    >
      {#each pageStickers as sticker, i (`${activePage}-${i}`)}
        {@const paths = getPrimitivePaths(sticker.primitiveRef.shapeHash)}
        <div class="slot">
          {#if paths}
            <!-- Inline SVG rendering. The SVG already includes its own bleed padding. -->
            {@html renderStickerUnitSVG(sticker, paths)}
          {:else}
            <div class="missing">
              No paths for {sticker.primitiveRef.displayName ??
                sticker.primitiveRef.shapeHash.slice(0, 8)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    height: 100%;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
    font-size: var(--font-size-sm);
    color: var(--theme-text, white);
  }

  .toolbar .toggle-btn {
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-2026-sm);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text, white);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition:
      background var(--duration-fast),
      border-color var(--duration-fast);
  }
  .toolbar .toggle-btn[aria-pressed="true"] {
    background: rgba(255, 255, 255, 0.15);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .toolbar .count {
    margin-left: auto;
    font-size: var(--font-size-compact);
    opacity: 0.6;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
  }
  .pager button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    border: none;
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: background var(--duration-fast);
  }
  .pager button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  .pager button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sheet-frame {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: var(--spacing-md);
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-2026-sm);
  }

  .sheet {
    width: calc(var(--sheet-w));
    height: calc(var(--sheet-h));
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: var(--sheet-ar);
    background: #f9f6ef;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 0.15in;
    padding: 0.5in;
    box-sizing: border-box;
  }

  .slot {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .slot :global(svg) {
    width: 100%;
    height: 100%;
  }

  .sheet.show-cut-lines .slot::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1px dashed rgba(0, 0, 0, 0.4);
  }

  .sheet.show-bleed .slot::after {
    content: "";
    position: absolute;
    inset: -0.1in;
    border-radius: 50%;
    border: 1px dotted rgba(200, 0, 0, 0.4);
    pointer-events: none;
  }

  .missing {
    font-size: var(--font-size-compact);
    color: rgba(0, 0, 0, 0.4);
  }
</style>
