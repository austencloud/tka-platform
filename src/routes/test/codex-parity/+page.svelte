<script lang="ts">
  import CodexSheet from "../../(public)/guide/codex/_components/CodexSheet.svelte";
  import { SHEETS } from "../../(public)/guide/codex/_data/codex-groups";

  const originals = ["/test/codex-original/sheet1.png", "/test/codex-original/sheet2.png"];
</script>

<svelte:head><title>Codex Parity — original vs rendered</title></svelte:head>

<div class="root">
  <h1>Codex Parity — original artboard (left) vs rendered (right)</h1>
  {#each SHEETS as sheet, i (i)}
    <div class="pair">
      <div class="col">
        <span class="tag">ORIGINAL · sheet {i + 1}</span>
        <img src={originals[i]} alt="original sheet {i + 1}" />
      </div>
      <div class="col">
        <span class="tag">RENDERED · sheet {i + 1}</span>
        <div class="rendered"><CodexSheet {sheet} /></div>
      </div>
    </div>
  {/each}
</div>

<style>
  .root {
    background: #d9dbe0;
    min-height: 100vh;
    padding: 16px;
    font-family: system-ui, sans-serif;
  }
  h1 {
    font-size: 15px;
    margin: 0 0 14px;
    color: #222;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
    margin-bottom: 28px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tag {
    font: 700 11px/1 monospace;
    letter-spacing: 0.1em;
    color: #444;
  }
  .col img,
  .rendered {
    width: 100%;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
    background: #fff;
  }
  /* Scale the 8.5in sheet down to the column width for comparison. */
  .rendered {
    overflow: hidden;
  }
  .rendered :global(.codex-sheet) {
    transform-origin: top left;
    /* 8.5in ≈ 816px; scale handled by container width via zoom */
    zoom: 0.62;
  }
</style>
