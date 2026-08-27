<!--
  RetroAssembleTab - Grid-based visual builder for SCRIBE.EXE

  A non-functional grid mockup. Click cells to toggle them on/off.
  Bottom row has fixed L (blue) and R (red) hand position indicators.
  Toolbar with hand mode, arrow mode, and clear. Only clear works.

  Domain: Retro SCRIBE App
-->
<script lang="ts">
  let {
    onstatuschange,
  }: {
    onstatuschange?: (status: string) => void;
  } = $props();

  /* Grid state                                                          */

  const COLS = 8;
  const ROWS = 6;

  let filledCells = $state<Set<string>>(new Set());

  function cellKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  function toggleCell(row: number, col: number) {
    const key = cellKey(row, col);
    if (filledCells.has(key)) {
      filledCells.delete(key);
    } else {
      filledCells.add(key);
    }
    filledCells = new Set(filledCells);
    onstatuschange?.(`Cells selected: ${filledCells.size}`);
  }

  function handleClear() {
    filledCells = new Set();
    onstatuschange?.("Grid cleared");
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar state                                                       */
  /* ------------------------------------------------------------------ */

  let activeTool = $state("hand");

  const cellCount = $derived(filledCells.size);
</script>

<div class="assemble-tab">
  <!-- Toolbar -->
  <div class="builder-toolbar">
    <button
      class="tool-button"
      class:active={activeTool === "hand"}
      type="button"
      title="Hand mode"
      onclick={() => (activeTool = "hand")}
    >
      &#9995;
    </button>
    <button
      class="tool-button"
      class:active={activeTool === "arrow"}
      type="button"
      title="Arrow mode"
      onclick={() => (activeTool = "arrow")}
    >
      &#8597;
    </button>
    <span class="toolbar-divider"></span>
    <button
      class="tool-button"
      type="button"
      title="Clear all"
      onclick={handleClear}
    >
      &#10006;
    </button>
  </div>

  <!-- Grid area (sunken panel) -->
  <div class="grid-area sunken-panel">
    <div class="grid-container">
      {#each Array(ROWS) as _, row}
        <div class="grid-row">
          {#each Array(COLS) as _, col}
            {@const key = cellKey(row, col)}
            <button
              class="grid-cell"
              class:filled={filledCells.has(key)}
              type="button"
              aria-label="Cell row {row + 1}, column {col + 1}"
              aria-pressed={filledCells.has(key)}
              onclick={() => toggleCell(row, col)}
            ></button>
          {/each}
        </div>
      {/each}

      <!-- Hand position indicators (fixed bottom row) -->
      <div class="hand-row">
        <div class="hand-indicator hand-left">L</div>
        <div class="hand-spacer"></div>
        <div class="hand-indicator hand-right">R</div>
      </div>
    </div>
  </div>

  <!-- Status text -->
  <div class="status-line">
    Cells selected: {cellCount}
  </div>
</div>

<style>
  .assemble-tab {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    padding: 4px;
  }

  /* Toolbar                                                             */
  .builder-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    padding: 2px;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
  }

  .tool-button {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    border: none;
    background: var(--retro-button-face, #c0c0c0);
    cursor: default;
    padding: 0;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
  }

  .tool-button:hover {
    border: 1px outset var(--retro-button-face, #c0c0c0);
  }

  .tool-button.active {
    border: 1px inset var(--retro-button-face, #c0c0c0);
    background: var(--retro-button-highlight, #dfdfdf);
  }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    background: var(--retro-button-shadow, #808080);
    margin: 0 2px;
  }

  /* Grid area                                                           */
  .grid-area {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    background: var(--retro-field-bg, #fff);
  }

  .grid-container {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 8px;
  }

  .grid-row {
    display: flex;
    gap: 1px;
  }

  .grid-cell {
    width: 48px;
    height: 48px;
    border: 1px solid var(--retro-button-shadow, #808080);
    background: var(--retro-field-bg, #fff);
    cursor: crosshair;
    padding: 0;
    transition: none;
  }

  .grid-cell:hover {
    background: #e0e0e0;
  }

  .grid-cell.filled {
    background: var(--retro-navy, #000080);
  }

  .grid-cell.filled:hover {
    background: #0000a0;
  }

  .grid-cell:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -2px;
  }

  /* Hand position indicators                                            */
  .hand-row {
    display: flex;
    align-items: center;
    gap: 1px;
    margin-top: 4px;
  }

  .hand-indicator {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 16px;
    font-weight: bold;
    color: #fff;
    border: 2px outset var(--retro-button-face, #c0c0c0);
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.5);
  }

  .hand-left {
    background: #0000ff;
  }

  .hand-right {
    background: #ff0000;
  }

  .hand-spacer {
    flex: 1;
  }

  /* Status line                                                         */
  .status-line {
    color: var(--retro-black, #000);
    font-size: var(--retro-font-size, 11px);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    padding: 2px 0;
    flex-shrink: 0;
  }
</style>
