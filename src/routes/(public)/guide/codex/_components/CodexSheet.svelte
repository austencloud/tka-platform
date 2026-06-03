<script lang="ts">
  import CodexBox from "./CodexBox.svelte";
  import type { CodexSheetDef } from "../_data/codex-groups";

  let { sheet }: { sheet: CodexSheetDef } = $props();
</script>

<section class="codex-sheet">
  {#if sheet.title}
    <h1 class="sheet-title">{sheet.title}</h1>
  {/if}

  {#each sheet.types as type (type.n)}
    {#if type.divider}<hr class="type-divider" />{/if}
    <div class="type-block">
      <h2 class="type-head">
        <span class="type-word">{type.word}</span>{#each type.segs as seg}<span
            style:color={seg.c}>{seg.t}</span
          >{/each}
      </h2>
      <div class="type-boxes">
        {#each type.boxes as box, i (i)}
          <CodexBox {box} />
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  .codex-sheet {
    width: 8.5in;
    min-height: 11in;
    box-sizing: border-box;
    padding: 0.45in 0.5in 0.6in;
    background: #fff;
    color: #111;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .sheet-title {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-weight: 500;
    font-size: 2.6rem;
    letter-spacing: 0.01em;
    margin: 0 0 0.1in;
    color: #1a1a1a;
  }

  .type-divider {
    width: 100%;
    border: none;
    border-top: 2px solid #111;
    margin: 0.18in 0 0.05in;
  }

  .type-block {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 0.12in;
  }

  .type-head {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-weight: 600;
    font-size: 1.5rem;
    margin: 0.06in 0 0.12in;
    text-align: center;
  }

  .type-word {
    color: #1a1a1a;
  }

  .type-boxes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: center;
    align-items: start;
    gap: 0.16in 0.5in;
    width: 100%;
    max-width: 7.2in;
  }
</style>
