<!--
  RetroDataGrid - Simple table with column headers and row selection

  Renders a data table with sortable-looking column headers (raised 3D),
  alternating row colors, and single-row selection. Selected row is
  highlighted in navy with white text. Double-click fires ondblclick.

  Keyboard navigation: ArrowUp/Down moves selection, Enter fires ondblclick.
-->
<script lang="ts">
  let {
    columns,
    rows,
    selectedRow = $bindable(-1),
    onselect,
    ondblclick,
  }: {
    columns: { key: string; label: string; width?: string }[];
    rows: Record<string, string>[];
    selectedRow?: number;
    onselect?: (index: number) => void;
    ondblclick?: (index: number) => void;
  } = $props();

  function handleRowClick(index: number) {
    selectedRow = index;
    onselect?.(index);
  }

  function handleRowDblClick(index: number) {
    selectedRow = index;
    ondblclick?.(index);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (rows.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(selectedRow + 1, rows.length - 1);
      selectedRow = next;
      onselect?.(next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(selectedRow - 1, 0);
      selectedRow = prev;
      onselect?.(prev);
    } else if (event.key === "Enter" && selectedRow >= 0) {
      event.preventDefault();
      ondblclick?.(selectedRow);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="retro-datagrid-wrapper sunken-panel"
  tabindex="0"
  onkeydown={handleKeydown}
  role="grid"
  aria-label="Data grid"
>
  <table class="retro-datagrid">
    <!-- Column headers -->
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th
            class="retro-datagrid-header"
            style={col.width ? `width: ${col.width};` : ""}
            role="columnheader"
          >
            {col.label}
          </th>
        {/each}
      </tr>
    </thead>

    <!-- Data rows -->
    <tbody>
      {#each rows as row, i (i)}
        <tr
          class="retro-datagrid-row"
          class:selected={i === selectedRow}
          class:alt={i % 2 === 1}
          aria-selected={i === selectedRow}
          onclick={() => handleRowClick(i)}
          ondblclick={() => handleRowDblClick(i)}
        >
          {#each columns as col (col.key)}
            <td class="retro-datagrid-cell" role="gridcell">
              {@html row[col.key] ?? ""}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .retro-datagrid-wrapper {
    overflow: auto;
    background: var(--retro-field-bg, #fff);
  }

  .retro-datagrid-wrapper:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -2px;
  }

  .retro-datagrid {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-field-text, #000);
  }

  /* Column headers: raised 3D button appearance                         */
  .retro-datagrid-header {
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    padding: 1px 6px;
    text-align: left;
    font-weight: normal;
    white-space: nowrap;
    cursor: default;
    user-select: none;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  /* Data rows                                                           */
  .retro-datagrid-row {
    cursor: default;
    user-select: none;
  }

  .retro-datagrid-row.alt {
    background: #f0f0f0;
  }

  .retro-datagrid-row.selected {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }

  .retro-datagrid-row.selected .retro-datagrid-cell {
    color: inherit;
  }

  /* Cells                                                               */
  .retro-datagrid-cell {
    padding: 1px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-right: 1px solid #e0e0e0;
  }

  .retro-datagrid-cell :global(svg) {
    width: 16px;
    height: 16px;
    vertical-align: middle;
    image-rendering: pixelated;
  }

  .retro-datagrid-cell:last-child {
    border-right: none;
  }
</style>
