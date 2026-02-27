<!--
  RetroRecycleBin — Corrupted files easter egg

  Displays a list of "deleted" files with ominous corruption messages,
  a disabled toolbar, and a status bar. Double-clicking any file shows
  an error dialog via desktopState.dialogQueue.

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  import RetroListBox from "../primitives/RetroListBox.svelte";
  import RetroStatusBar from "../primitives/RetroStatusBar.svelte";
  import { desktopState } from "../../state/desktop-state.svelte";

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* File data                                                           */
  /* ------------------------------------------------------------------ */

  const FILES = [
    "ORDER7.DOC \u2014 File corrupted during suppression event",
    "HISTORY.TXT \u2014 Read error: sector not found",
    "FOUNDERS.BMP \u2014 Image data scrambled (CRC mismatch)",
    "LOCATION.DAT \u2014 GPS coordinates redacted by system",
    "BUDGET95.XLS \u2014 Encrypted (key destroyed)",
    "MEMO_ALL.MSG \u2014 Sender: [CLASSIFIED] \u2014 Receiver: [CLASSIFIED]",
    "INCIDENT.LOG \u2014 File locked by RESTRICT.SYS",
    "STAFFLST.CSV \u2014 Partial recovery: 3 of 247 records readable",
  ];

  let selectedIndex = $state(-1);

  /* ------------------------------------------------------------------ */
  /* File open attempt                                                   */
  /* ------------------------------------------------------------------ */

  function handleFileOpen(index: number) {
    desktopState.dialogQueue = [
      ...desktopState.dialogQueue,
      {
        title: "Recycle Bin",
        message:
          "Error: Cannot open \u2014 file corrupted or access denied by RESTRICT.SYS",
        type: "error",
        buttons: ["OK"],
      },
    ];
  }
</script>

<div class="recyclebin-shell">
  <!-- Toolbar -->
  <div class="recyclebin-toolbar">
    <button
      class="recyclebin-toolbar-btn"
      type="button"
      disabled
      title="Cannot empty: files locked by system"
    >
      Empty Recycle Bin
    </button>
    <button
      class="recyclebin-toolbar-btn"
      type="button"
      disabled
      title="Cannot restore: files may be corrupted"
    >
      Restore
    </button>
  </div>

  <!-- File list -->
  <div class="recyclebin-list">
    <RetroListBox
      items={FILES}
      bind:selectedIndex
      height={10}
      ondblclick={handleFileOpen}
    />
  </div>

  <!-- Status bar -->
  <div class="recyclebin-statusbar">
    <RetroStatusBar
      panels={[
        {
          text: "8 object(s) \u2014 Cannot restore: files may be corrupted or restricted",
        },
      ]}
    />
  </div>
</div>

<style>
  .recyclebin-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar                                                             */
  /* ------------------------------------------------------------------ */
  .recyclebin-toolbar {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
    flex-shrink: 0;
  }

  .recyclebin-toolbar-btn {
    min-height: 21px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    padding: 2px 8px;
    cursor: default;
  }

  .recyclebin-toolbar-btn:disabled {
    color: var(--retro-disabled-text, #808080);
  }

  /* ------------------------------------------------------------------ */
  /* File list                                                           */
  /* ------------------------------------------------------------------ */
  .recyclebin-list {
    flex: 1;
    min-height: 0;
    padding: 4px;
    overflow: hidden;
  }

  /* ------------------------------------------------------------------ */
  /* Status bar                                                          */
  /* ------------------------------------------------------------------ */
  .recyclebin-statusbar {
    flex-shrink: 0;
  }
</style>
