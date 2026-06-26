<script lang="ts">
  import CodexSheet from "./_components/CodexSheet.svelte";
  import { SHEETS } from "./_data/codex-groups";

  function print() {
    window.print();
  }
</script>

<svelte:head>
  <title>Double Staff Codex: Printable</title>
  <meta name="description" content="Printable Kinetic Alphabet base-letter codex for double staves. Types 1–6." />
</svelte:head>

<div class="codex-print-root">
  <div class="toolbar">
    <button class="print-btn" onclick={print}>Print / Save PDF</button>
  </div>

  <div class="sheets">
    {#each SHEETS as sheet, i (i)}
      <div class="sheet-wrap">
        <CodexSheet {sheet} />
      </div>
    {/each}
  </div>
</div>

<style>
  .codex-print-root {
    min-height: 100vh;
    background: #4a4f57;
    padding: 1.5rem 0 3rem;
  }

  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    padding: 0 0 1.25rem;
  }

  .print-btn {
    font: 600 0.95rem/1 system-ui, sans-serif;
    padding: 0.7rem 1.4rem;
    border: none;
    border-radius: 999px;
    background: #111;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }

  .print-btn:hover {
    background: #000;
  }

  .sheets {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .sheet-wrap {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  }

  @media print {
    .codex-print-root {
      background: #fff;
      padding: 0;
    }
    .toolbar {
      display: none;
    }
    .sheets {
      gap: 0;
    }
    .sheet-wrap {
      box-shadow: none;
      break-after: page;
    }
    .sheet-wrap:last-child {
      break-after: auto;
    }
  }

  @page {
    size: letter portrait;
    margin: 0;
  }
</style>
