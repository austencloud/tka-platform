<script lang="ts">
  /**
   * Contextual edit palette — appears bottom-center ONLY while edit mode is on
   * (undo/redo, the selected item, Copy coords). Entry into edit mode lives in
   * the GuideDevBar toolbar (or the E hotkey); this component still owns init
   * (from ?edit or the last localStorage choice) and the global hotkeys
   * (E, Ctrl+Z/Y, arrows, Esc).
   */
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import {
    guideEdit,
    hist,
    collectEditCoords,
    setEdit,
    undo,
    redo,
    initEdit,
    installEditHotkeys,
  } from "../_data/guide-edit.svelte";

  let copied = $state(false);

  onMount(() => {
    initEdit(page.url.searchParams.has("edit"));
    return installEditHotkeys();
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(collectEditCoords());
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      copied = false;
    }
  }
</script>

{#if guideEdit.on}
  <div class="coords-panel">
    <span class="ttl">Edit</span>
    <button class="ico" onclick={undo} disabled={hist.undo === 0} title="Undo (Ctrl+Z)">↶</button>
    <button class="ico" onclick={redo} disabled={hist.redo === 0} title="Redo (Ctrl+Shift+Z)">↷</button>
    <span class="sel" title="Selected — arrow keys nudge (Shift ×10)">
      {guideEdit.selectedLabel ?? "click to select"}
    </span>
    <button class="primary" onclick={copy}>{copied ? "Copied ✓" : "Copy coords"}</button>
    <button class="ico exit" onclick={() => setEdit(false)} title="Exit edit (Esc)">✕</button>
  </div>
{/if}

<style>
  .coords-panel {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    font-family: system-ui, sans-serif;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: #15151c;
    color: #eaeaf2;
    border: 1px solid #3a3a48;
    font-size: 13px;
  }
  .ttl {
    font-weight: 700;
    color: #a5b4fc;
  }
  .sel {
    min-width: 110px;
    max-width: 220px;
    text-align: center;
    color: #9a9ab0;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
  .coords-panel button {
    border-radius: 999px;
    border: 1px solid #3a3a48;
    background: #26262f;
    color: #c8c8db;
    cursor: pointer;
  }
  .coords-panel button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .ico {
    width: 30px;
    height: 30px;
    font-size: 15px;
    line-height: 1;
  }
  .primary {
    padding: 7px 14px;
    font: 600 12px system-ui;
    border-color: #3730a3 !important;
    background: #3730a3 !important;
    color: #fff !important;
  }
  .exit {
    color: #e08b8b;
  }
</style>
