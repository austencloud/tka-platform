<!--
  RetroRecycleBin - RECYCLEBIN.EXE main component

  Shows soft-deleted sequences from the user's library as DOS .SEQ files.
  Users can restore items back to their library, permanently delete individual
  items, or empty the entire bin. All operations go through ILibraryRepository.

  Confirmations are handled inline (the dialog queue infrastructure exists but
  is not yet wired to render). The ominous Order files at the bottom are lore
  - always present, always unrestorable.

  Domain: Retro Recycle Bin
-->
<script lang="ts">
  import { onMount } from "svelte";
  import RetroButton from "../primitives/RetroButton.svelte";
  import RetroListBox from "../primitives/RetroListBox.svelte";
  import RetroStatusBar from "../primitives/RetroStatusBar.svelte";
  import {
    getDeletedItems,
    restoreItem,
    purgeItem,
    emptyBin,
  } from "../../adapters/recycle-adapter";
  import type { RecycleBinItem } from "../../adapters/recycle-adapter";

  /* Props                                                               */

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* State                                                               */

  let items = $state<RecycleBinItem[]>([]);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let selectedIndex = $state(-1);
  let isBusy = $state(false);
  let statusText = $state("");

  /** When set, a confirmation prompt is shown in place of the normal toolbar. */
  let pendingConfirm = $state<{
    message: string;
    onconfirm: () => Promise<void>;
  } | null>(null);

  /* Lore: Order files that can never be restored                        */

  const ORDER_FILES = [
    "ORDER7.DOC \u2014 File corrupted during suppression event",
    "HISTORY.TXT \u2014 Read error: sector not found",
    "FOUNDERS.BMP \u2014 Image data scrambled (CRC mismatch)",
    "LOCATION.DAT \u2014 GPS coordinates redacted by system",
    "BUDGET95.XLS \u2014 Encrypted (key destroyed)",
    "MEMO_ALL.MSG \u2014 Sender: [CLASSIFIED] \u2014 Receiver: [CLASSIFIED]",
    "INCIDENT.LOG \u2014 File locked by RESTRICT.SYS",
    "STAFFLST.CSV \u2014 Partial recovery: 3 of 247 records readable",
  ];

  /* Combined list: real items first, then Order lore files              */

  const listItems = $derived([
    ...items.map((item) => {
      const date = item.deletedAt.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      });
      const sizeStr = item.size > 0 ? `${item.size}B` : "0B";
      return `${item.dosName}  ${date}  ${sizeStr}  \u2014  ${item.fullName}`;
    }),
    ...ORDER_FILES,
  ]);

  /** True when selected index maps to a real user sequence (not a lore file). */
  const selectedItem = $derived(
    selectedIndex >= 0 && selectedIndex < items.length
      ? items[selectedIndex]
      : null
  );

  const statusPanels = $derived([
    {
      text: isLoading
        ? "Loading items..."
        : loadError
          ? "Error loading recycle bin"
          : `${items.length + ORDER_FILES.length} object(s)`,
      width: "160px",
    },
    {
      text: statusText || (selectedItem ? selectedItem.fullName : ""),
    },
  ]);

  /* ------------------------------------------------------------------ */
  /* Load on mount                                                       */
  /* ------------------------------------------------------------------ */

  onMount(async () => {
    await reload();
  });

  async function reload() {
    isLoading = true;
    loadError = null;
    selectedIndex = -1;
    pendingConfirm = null;
    try {
      items = await getDeletedItems();
    } catch (err) {
      loadError =
        err instanceof Error ? err.message : "Failed to load recycle bin.";
    } finally {
      isLoading = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Lore: Order files can never be opened                               */
  /* ------------------------------------------------------------------ */

  function handleFileOpen(index: number) {
    if (index >= items.length) {
      statusText =
        "Error: Cannot open \u2014 file corrupted or access denied by RESTRICT.SYS";
    }
  }

  /* ------------------------------------------------------------------ */
  /* Restore                                                             */
  /* ------------------------------------------------------------------ */

  function handleRestore() {
    if (!selectedItem || isBusy) return;
    const item = selectedItem;
    pendingConfirm = {
      message: `Restore "${item.fullName}" to your library?`,
      onconfirm: async () => {
        isBusy = true;
        statusText = `Restoring ${item.dosName}...`;
        try {
          await restoreItem(item.id);
          statusText = `"${item.fullName}" restored to library.`;
          await reload();
        } catch (err) {
          statusText = `Restore failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        } finally {
          isBusy = false;
        }
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Purge (permanent delete)                                            */
  /* ------------------------------------------------------------------ */

  function handlePurge() {
    if (!selectedItem || isBusy) return;
    const item = selectedItem;
    pendingConfirm = {
      message: `Permanently delete "${item.fullName}"? This cannot be undone.`,
      onconfirm: async () => {
        isBusy = true;
        statusText = `Deleting ${item.dosName}...`;
        try {
          await purgeItem(item.id);
          statusText = `"${item.fullName}" permanently deleted.`;
          await reload();
        } catch (err) {
          statusText = `Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        } finally {
          isBusy = false;
        }
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Empty bin                                                           */
  /* ------------------------------------------------------------------ */

  function handleEmptyBin() {
    if (isBusy || items.length === 0) return;
    const count = items.length;
    pendingConfirm = {
      message: `Permanently delete all ${count} sequence${count === 1 ? "" : "s"}? This cannot be undone.`,
      onconfirm: async () => {
        isBusy = true;
        statusText = "Emptying recycle bin...";
        try {
          await emptyBin();
          statusText = `${count} sequence${count === 1 ? "" : "s"} permanently deleted.`;
          await reload();
        } catch (err) {
          statusText = `Empty failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        } finally {
          isBusy = false;
        }
      },
    };
  }

  async function confirmAction() {
    if (!pendingConfirm) return;
    const action = pendingConfirm.onconfirm;
    pendingConfirm = null;
    await action();
  }

  function cancelAction() {
    pendingConfirm = null;
    statusText = "";
  }
</script>

<div class="recyclebin-shell">
  <!-- Toolbar or confirm prompt -->
  {#if pendingConfirm}
    <div class="recyclebin-confirm">
      <span class="confirm-message">{pendingConfirm.message}</span>
      <div class="confirm-buttons">
        <RetroButton label="Yes" onclick={confirmAction} />
        <RetroButton label="No" onclick={cancelAction} />
      </div>
    </div>
  {:else}
    <div class="recyclebin-toolbar">
      <RetroButton
        label="Restore"
        disabled={!selectedItem || isBusy}
        onclick={handleRestore}
      />
      <RetroButton
        label="Delete"
        disabled={!selectedItem || isBusy}
        onclick={handlePurge}
      />
      <div class="toolbar-sep"></div>
      <RetroButton
        label="Empty Recycle Bin"
        disabled={items.length === 0 || isBusy}
        onclick={handleEmptyBin}
      />
    </div>
  {/if}

  <!-- Column headers -->
  <div class="recyclebin-headers">
    <span class="col-name">Name</span>
    <span class="col-date">Deleted</span>
    <span class="col-size">Size</span>
    <span class="col-fullname">Full Name</span>
  </div>

  <!-- File list -->
  <div class="recyclebin-list">
    {#if isLoading}
      <div class="recyclebin-message">
        <span class="recyclebin-message-text">Loading items...</span>
      </div>
    {:else if loadError}
      <div class="recyclebin-message">
        <span class="recyclebin-message-text recyclebin-message-error">
          Error: {loadError}
        </span>
      </div>
    {:else}
      <RetroListBox
        items={listItems}
        bind:selectedIndex
        height={12}
        ondblclick={handleFileOpen}
      />
    {/if}
  </div>

  <!-- Status bar -->
  <div class="recyclebin-statusbar">
    <RetroStatusBar panels={statusPanels} />
  </div>
</div>

<style>
  .recyclebin-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  /* Toolbar                                                             */
  .recyclebin-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
    flex-shrink: 0;
  }

  .toolbar-sep {
    width: 1px;
    height: 20px;
    background: var(--retro-button-shadow, #808080);
    margin: 0 2px;
  }

  /* Confirm prompt                                                      */
  .recyclebin-confirm {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
    flex-shrink: 0;
    background: var(--retro-button-face, #c0c0c0);
    flex-wrap: wrap;
  }

  .confirm-message {
    flex: 1;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    min-width: 0;
  }

  .confirm-buttons {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  /* Column headers                                                      */
  .recyclebin-headers {
    display: flex;
    gap: 0;
    padding: 2px 6px;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
    background: var(--retro-button-face, #c0c0c0);
    flex-shrink: 0;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .col-name {
    width: 100px;
    font-weight: bold;
  }

  .col-date {
    width: 70px;
    font-weight: bold;
  }

  .col-size {
    width: 50px;
    font-weight: bold;
  }

  .col-fullname {
    flex: 1;
    font-weight: bold;
  }

  /* File list                                                           */
  .recyclebin-list {
    flex: 1;
    min-height: 0;
    padding: 4px;
    overflow: hidden;
  }

  /* Loading / error message                                             */
  .recyclebin-message {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .recyclebin-message-text {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-disabled-text, #808080);
    text-align: center;
  }

  .recyclebin-message-error {
    color: var(--semantic-error, #cc0000);
  }

  /* Status bar                                                          */
  .recyclebin-statusbar {
    flex-shrink: 0;
  }
</style>
