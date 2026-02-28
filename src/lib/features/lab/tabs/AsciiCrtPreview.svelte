<!--
  AsciiCrtPreview.svelte — CRT-styled preview of the ASCII pictograph render.
  Domain: Retro DOS Terminal Lab
-->
<script lang="ts">
  import "$lib/features/retro/dos/styles/dos-terminal.css";

  let {
    htmlLines = [],
    compact = "",
  }: {
    htmlLines: string[];
    compact: string;
  } = $props();
</script>

<div class="crt-preview">
  <div class="crt-header">
    <span class="crt-title">PREVIEW</span>
  </div>
  <div class="crt-screen">
    {#each htmlLines as line}
      <div class="dos-line">{@html line}</div>
    {/each}
    {#if compact}
      <div class="crt-compact">
        <div class="dos-line">{@html compact}</div>
      </div>
    {/if}
  </div>
</div>

<style>
  .crt-preview {
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .crt-header {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.6);
    border-bottom: 1px solid rgba(51, 255, 51, 0.2);
  }

  .crt-title {
    font-family: "Courier New", "Consolas", monospace;
    font-size: 12px;
    color: #33ff33;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .crt-screen {
    background: #000;
    padding: 16px;
    font-family: "Courier New", "Consolas", monospace;
    font-size: 16px;
    line-height: 1.3;
    color: #33ff33;
    min-height: 200px;
  }

  .crt-screen :global(.dos-line) {
    white-space: pre;
    min-height: 1.3em;
    text-shadow: 0 0 4px currentColor;
  }

  .crt-compact {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(51, 255, 51, 0.15);
  }
</style>
