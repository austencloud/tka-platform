<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import GuidePictograph from "./GuidePictograph.svelte";

  interface GridRow {
    label: string;
    sublabel?: string;
    cells: Array<{ data?: PictographData | null; label?: string; pngFallback?: string }>;
  }

  let {
    rows,
    columnHeaders,
    pictographSize = "sm",
  }: {
    rows: GridRow[];
    columnHeaders?: string[];
    pictographSize?: "sm" | "md" | "lg";
  } = $props();

  const columnCount = $derived(
    columnHeaders?.length ?? (rows[0]?.cells.length ?? 0)
  );

  const gridTemplateColumns = $derived(
    `160px repeat(${columnCount}, 1fr)`
  );
</script>

<div
  class="guide-pictograph-grid"
  style:grid-template-columns={gridTemplateColumns}
>
  {#if columnHeaders}
    <div class="column-header"></div>
    {#each columnHeaders as header}
      <div class="column-header">{header}</div>
    {/each}
  {/if}

  {#each rows as row}
    <div class="row-label">
      {row.label}
      {#if row.sublabel}
        <span class="row-sublabel">{row.sublabel}</span>
      {/if}
    </div>
    {#each row.cells as cell}
      <GuidePictograph
        data={cell.data}
        pngFallback={cell.pngFallback}
        label={cell.label}
        size={pictographSize}
        bordered
      />
    {/each}
  {/each}
</div>
