<script lang="ts">
  import CodexCell from "./CodexCell.svelte";
  import type { CodexBoxDef } from "../_data/codex-groups";

  let { box }: { box: CodexBoxDef } = $props();
</script>

<div class="codex-box" class:full={box.full}>
  {#if box.header || box.mode}
    <div class="box-head">
      {#if box.header}<span class="box-transition">{box.header}</span>{/if}
      {#if box.mode}<span class="box-mode">{box.mode}</span>{/if}
    </div>
  {/if}
  <div class="box-cells" style:--cols={box.cells.length}>
    {#each box.cells as cell (cell.id)}
      <CodexCell {cell} />
    {/each}
  </div>
</div>

<style>
  .codex-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .codex-box.full {
    grid-column: 1 / -1;
    justify-self: center;
  }

  .box-head {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
  }

  .box-transition {
    font-size: 0.8rem;
    font-weight: 700;
    color: #1a1a1a;
  }

  .box-mode {
    font-style: italic;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: #888;
  }

  .box-cells {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 2px;
    padding: 4px 5px 3px;
    border: 1.25px solid #2b2b2b;
    border-radius: 3px;
    background: #fff;
  }
</style>
