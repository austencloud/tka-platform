<script lang="ts">
  /**
   * Viewer-chrome control that flips page numbers on/off for the whole printable
   * guide (screen + print). Screen-only — hidden in the printout itself.
   */
  import { pageNumberPrefs } from "../_data/page-number-prefs.svelte";
</script>

<button
  class="pn-toggle"
  aria-pressed={pageNumberPrefs.show}
  onclick={() => (pageNumberPrefs.show = !pageNumberPrefs.show)}
>
  <span class="dot" class:on={pageNumberPrefs.show} aria-hidden="true"></span>
  Page numbers · {pageNumberPrefs.show ? "On" : "Off"}
</button>

<style>
  .pn-toggle {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 50;
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    font: 500 12px/1 system-ui, sans-serif;
    padding: 8px 13px;
    border-radius: 999px;
    border: 1px solid #4a4a56;
    background: #26262f;
    color: #cfcfe0;
    cursor: pointer;
  }
  .pn-toggle:hover {
    background: #303039;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #5a5a68;
  }
  .dot.on {
    background: #6f8cff;
  }
  @media print {
    .pn-toggle {
      display: none;
    }
  }
</style>
