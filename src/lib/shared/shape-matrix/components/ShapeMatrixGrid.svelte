<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION, STAGGER } from "$lib/shared/transitions/transitions";
  import type { ShapeMatrixData } from "../services/shape-matrix-flowers";
  import {
    flowerKey,
    flowerLabel,
    type Flower,
  } from "../domain/flower-signature";
  import { renderCell, renderHeader } from "../services/shape-matrix-render";

  type CellVerdict = "legal" | "illegal" | "unsure";

  interface Props {
    data: ShapeMatrixData;
    /** Blue flowers to show as rows (already filtered). */
    rowAxis: Flower[];
    /** Red flowers to show as columns (already filtered). */
    colAxis: Flower[];
    /** Upper bound on a cell's edge; the actual size shrinks to fit the viewport. */
    maxCellPx?: number;
    onselect: (pair: { blue: Flower; red: Flower }) => void;
    /** Optional externally-owned selection for restored/shared app state. */
    selectedPair?: { blue: Flower; red: Flower } | null;
    /** Alternative cell/header painter (e.g. the poi trail painter). Defaults to the club-style painter. */
    painter?: {
      cell: typeof renderCell;
      header: typeof renderHeader;
    };
    /** Per-cell verdict tint (poi-legality curation). Null/undefined = no tint. */
    overlayFor?: (blue: Flower, red: Flower) => CellVerdict | null | undefined;
    /** Cells to de-emphasize (e.g. already-judged cells in a curation focus view). */
    dimFor?: (blue: Flower, red: Flower) => boolean;
  }
  let {
    data,
    rowAxis,
    colAxis,
    maxCellPx = 100,
    onselect,
    selectedPair,
    painter,
    overlayFor,
    dimFor,
  }: Props = $props();
  const paintCell = painter?.cell ?? renderCell;
  const paintHeader = painter?.header ?? renderHeader;

  // Measured viewport of the scroll container.
  let wrapW = $state(0);
  let wrapH = $state(0);

  // Fit the whole grid (headers + cells) into the viewport, but never below the
  // 44px AAA touch-target floor. When the grid can't fit at 44px (very large
  // axis on a small viewport) it overflows and scrolls — touch target wins.
  const cell = $derived.by(() => {
    const cols = colAxis.length + 1; // + rowheader column
    const rows = rowAxis.length + 1; // + colheader row
    if (!wrapW || !wrapH || cols <= 1 || rows <= 1) return 56;
    const fit = Math.floor(Math.min(wrapW / cols, wrapH / rows));
    return Math.max(44, Math.min(maxCellPx, fit));
  });

  // Cells and headers are cached as vector images. They can follow the grid
  // from the 44px touch-target floor through the 320px 4K layout without
  // stretching a small raster image or rebuilding geometry during resize.
  const VECTOR_VIEWBOX_PX = 128;

  const headerCache = new Map<string, string>();
  function headerSrc(f: Flower, hand: "blue" | "red"): string {
    const k = `${data.propType}__${hand}__${flowerKey(f)}`;
    let url = headerCache.get(k);
    if (!url) {
      url = paintHeader(
        (hand === "blue" ? data.blue : data.red).get(flowerKey(f))!,
        hand,
        VECTOR_VIEWBOX_PX,
        data.clubTipDx
      );
      headerCache.set(k, url);
    }
    return url;
  }

  const cellCache = new Map<string, string>();
  function cellSrc(b: Flower, r: Flower): string {
    const k = `${data.propType}__${flowerKey(b)}__${flowerKey(r)}`;
    let url = cellCache.get(k);
    if (!url) {
      url = paintCell(
        data.blue.get(flowerKey(b))!,
        data.red.get(flowerKey(r))!,
        VECTOR_VIEWBOX_PX,
        data.clubTipDx
      );
      cellCache.set(k, url);
    }
    return url;
  }

  let observed = $state(new Set<string>());
  function watch(node: HTMLElement, key: string) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            observed = new Set(observed).add(key);
            io.unobserve(node);
          }
      },
      { rootMargin: "240px" }
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  let sel = $state<string | null>(null);
  const selectedKey = $derived(
    selectedPair === undefined
      ? sel
      : selectedPair
        ? `${flowerKey(selectedPair.blue)}__${flowerKey(selectedPair.red)}`
        : null
  );
</script>

<div
  class="wrap"
  style="--cell:{cell}px"
  bind:clientWidth={wrapW}
  bind:clientHeight={wrapH}
>
  {#if rowAxis.length === 0 || colAxis.length === 0}
    <div class="empty">No flowers match the current filters.</div>
  {:else}
    <table
      class="matrix"
      aria-label="Shape matrix: blue flower rows by red flower columns; activate a cell for its TKA realizations"
    >
      <thead>
        <tr>
          <th class="corner" scope="col" aria-label="blue rows by red columns"
          ></th>
          {#each colAxis as rf, colIndex (colIndex)}
            {@const source = headerSrc(rf, "red")}
            <th class="colhead" scope="col" title={flowerLabel(rf)}>
              <Crossfade
                key={source}
                fill
                duration={DURATION.emphasis}
                delay={STAGGER.micro}
              >
                <img src={source} alt={`red ${flowerLabel(rf)}`} />
              </Crossfade>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rowAxis as bf, rowIndex (rowIndex)}
          {@const rowSource = headerSrc(bf, "blue")}
          <tr>
            <th class="rowhead" scope="row" title={flowerLabel(bf)}>
              <Crossfade
                key={rowSource}
                fill
                duration={DURATION.emphasis}
                delay={STAGGER.micro}
              >
                <img src={rowSource} alt={`blue ${flowerLabel(bf)}`} />
              </Crossfade>
            </th>
            {#each colAxis as rf, colIndex (colIndex)}
              {@const key = `${flowerKey(bf)}__${flowerKey(rf)}`}
              {@const slotKey = `${rowIndex}:${colIndex}`}
              {@const verdict = overlayFor?.(bf, rf) ?? null}
              <td class="cell-td">
                <button
                  type="button"
                  class="cell"
                  class:sel={selectedKey === key}
                  class:v-legal={verdict === "legal"}
                  class:v-illegal={verdict === "illegal"}
                  class:v-unsure={verdict === "unsure"}
                  class:dim={dimFor?.(bf, rf) ?? false}
                  use:watch={slotKey}
                  aria-label={`blue ${flowerLabel(bf)} over red ${flowerLabel(rf)}`}
                  aria-pressed={selectedKey === key}
                  onclick={() => {
                    sel = key;
                    onselect({ blue: bf, red: rf });
                  }}
                >
                  {#if observed.has(slotKey)}
                    {@const source = cellSrc(bf, rf)}
                    <Crossfade
                      key={source}
                      fill
                      duration={DURATION.emphasis}
                      delay={STAGGER.micro}
                    >
                      <img src={source} alt="" />
                    </Crossfade>
                  {/if}
                </button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .wrap {
    overflow: auto;
    display: grid;
    height: 100%;
    place-content: safe center;
    background: var(--theme-panel-bg, #0a0f14);
  }
  .empty {
    padding: 48px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.82));
    text-align: center;
    font-size: var(--font-size-min, 14px);
  }

  table.matrix {
    border-collapse: separate;
    border-spacing: 0;
    width: max-content;
    margin: auto;
  }
  th,
  td {
    padding: 0;
  }

  /* The table needs this cell to align its sticky row and column headers. It is
     visually neutral because the colored flower headers already identify both
     axes; another blue/red legend reads like a selectable matrix result. */
  .corner {
    position: sticky;
    top: 0;
    left: 0;
    z-index: 5;
    width: var(--cell);
    height: var(--cell);
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, #111922);
  }

  .colhead {
    position: sticky;
    top: 0;
    z-index: 4;
    width: var(--cell);
    height: var(--cell);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, #111922);
  }
  .rowhead {
    position: sticky;
    left: 0;
    z-index: 3;
    width: var(--cell);
    height: var(--cell);
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, #111922);
  }
  .colhead img,
  .rowhead img {
    width: var(--cell);
    height: var(--cell);
    display: block;
    aspect-ratio: 1;
  }

  .cell-td {
    width: var(--cell);
    height: var(--cell);
  }
  .cell {
    position: relative;
    width: var(--cell);
    height: var(--cell);
    aspect-ratio: 1;
    display: block;
    padding: 0;
    margin: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: transparent;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms)
      var(--transition-easing, ease);
  }
  .cell:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }
  .cell.sel {
    outline: none;
    z-index: 2;
  }
  .cell.sel::after {
    content: "";
    position: absolute;
    inset: 2px;
    z-index: 2;
    border: 1px solid var(--theme-accent, #f59e0b);
    border-radius: 2px;
    box-shadow: inset 0 0 0.8rem
      color-mix(in srgb, var(--theme-accent, #f59e0b) 16%, transparent);
    pointer-events: none;
  }
  .cell:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: -2px;
    z-index: 2;
    position: relative;
  }
  .cell img {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Verdict tints: inset ring + wash, so the cell box never changes size. */
  .cell.v-legal {
    box-shadow: inset 0 0 0 2px
      color-mix(in srgb, var(--semantic-success, #4ade80) 85%, transparent);
    background: color-mix(
      in srgb,
      var(--semantic-success, #4ade80) 12%,
      transparent
    );
  }
  .cell.v-illegal {
    box-shadow: inset 0 0 0 2px
      color-mix(in srgb, var(--semantic-error, #f87171) 85%, transparent);
    background: color-mix(
      in srgb,
      var(--semantic-error, #f87171) 14%,
      transparent
    );
  }
  .cell.v-unsure {
    box-shadow: inset 0 0 0 2px
      color-mix(in srgb, var(--semantic-warning, #facc15) 80%, transparent);
    background: color-mix(
      in srgb,
      var(--semantic-warning, #facc15) 10%,
      transparent
    );
  }
  .cell.dim {
    opacity: 0.25;
  }

  @media (prefers-reduced-motion: reduce) {
    .cell {
      transition: none;
    }
  }
</style>
