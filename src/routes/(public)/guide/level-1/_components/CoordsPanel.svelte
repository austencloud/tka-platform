<script lang="ts">
  /**
   * Floating panel shown only in edit mode (?edit). Copies every editable page's
   * current coordinates to the clipboard so they can be pasted back and baked in.
   */
  import { guideEdit, collectEditCoords } from "../_data/guide-edit.svelte";

  let copied = $state(false);

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
    <span class="ttl">Edit mode</span>
    <span class="hint">drag arrows + text · then</span>
    <button onclick={copy}>{copied ? "Copied ✓" : "Copy coords"}</button>
  </div>
{/if}

<style>
  .coords-panel {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 999px;
    background: #15151c;
    color: #eaeaf2;
    border: 1px solid #3a3a48;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.5);
    font-family: system-ui, sans-serif;
    font-size: 13px;
  }
  .ttl {
    font-weight: 700;
    color: #a5b4fc;
  }
  .hint {
    color: #9a9ab0;
  }
  .coords-panel button {
    font: 600 12px system-ui;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid #3730a3;
    background: #3730a3;
    color: #fff;
    cursor: pointer;
  }
</style>
