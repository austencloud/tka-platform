<!--
  RetroFileManager - FILEMGR.EXE main component

  Explorer-style file browser for TKA-OS. Left pane shows a directory
  tree (drives C:\, A:\, D:\). Right pane shows the user's real saved
  sequences as .SEQ files (from LibraryRepository), rendered via
  RetroDataGrid (details view) or RetroListBox (list view).

  C:\SEQUENCES shows real library data. Other directories (SYSTEM,
  A:\, D:\) remain static decoration.

  Fills its parent container (the RetroWindow body area).

  Domain: Retro File Manager
-->
<script lang="ts">
  import { onMount } from "svelte";
  import RetroMenuBar from "../../primitives/RetroMenuBar.svelte";
  import RetroToolbar from "../../primitives/RetroToolbar.svelte";
  import RetroStatusBar from "../../primitives/RetroStatusBar.svelte";
  import RetroSplitter from "../../primitives/RetroSplitter.svelte";
  import RetroTreeView from "../../primitives/RetroTreeView.svelte";
  import RetroDataGrid from "../../primitives/RetroDataGrid.svelte";
  import RetroListBox from "../../primitives/RetroListBox.svelte";
  import type { RetroTreeNode } from "../../../domain/types/retro-types";
  import { convertFileName } from "../../../services/file-name-converter";
  import { RETRO_ICONS } from "../../rendering/retro-icons";
  import {
    listSequenceFiles,
    deleteFile,
    subscribeToLibrary,
    type RetroFile,
  } from "../../../adapters/library-adapter";

  /* Props                                                               */

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* State                                                               */

  type ViewMode = "details" | "list";

  let selectedDirId = $state("c-sequences");
  let viewMode = $state<ViewMode>("details");
  let selectedFileIndex = $state(-1);
  let statusText = $state("");
  let navigationHistory = $state<string[]>(["c-sequences"]);
  let historyIndex = $state(0);

  /** Real library files from Firestore */
  let libraryFiles = $state<RetroFile[]>([]);
  let libraryLoading = $state(true);

  /** Pending delete confirmation */
  let pendingDeleteFile = $state<RetroFile | null>(null);


  /* Load real library data                                              */

  onMount(() => {
    /* Initial load */
    listSequenceFiles().then((files) => {
      libraryFiles = files;
      libraryLoading = false;
    }).catch(() => {
      libraryLoading = false;
    });

    /* Real-time subscription keeps the list in sync */
    const unsubscribe = subscribeToLibrary((files) => {
      libraryFiles = files;
      libraryLoading = false;
    });

    return unsubscribe;
  });

  /* Directory tree                                                      */

  const treeNodes: RetroTreeNode[] = [
    {
      id: "c-root",
      label: "C:\\ [TKA-OS]",
      icon: RETRO_ICONS.floppy,
      expanded: true,
      children: [
        {
          id: "c-sequences",
          label: "SEQUENCES",
          icon: RETRO_ICONS.folder,
          expanded: true,
        },
        {
          id: "c-system",
          label: "SYSTEM",
          icon: RETRO_ICONS.folder,
          children: [
            { id: "c-sys-config", label: "CONFIG", icon: RETRO_ICONS.folder },
            { id: "c-sys-drivers", label: "DRIVERS", icon: RETRO_ICONS.folder },
          ],
        },
      ],
    },
    { id: "a-root", label: "A:\\ [3½ Floppy]", icon: RETRO_ICONS.floppy },
    { id: "d-root", label: "D:\\ [CD-ROM]", icon: RETRO_ICONS.cdrom },
  ];

  /* Static (decorative) file data for non-library directories           */

  interface StaticFile {
    name: string;
    size: number;
    modified: string;
  }

  function generateStaticFiles(dirId: string): StaticFile[] {
    const catalog: Record<string, string[]> = {
      "c-system": [
        "AUTOEXEC.BAT",
        "CONFIG.SYS",
        "HIMEM.SYS",
        "EMM386.EXE",
        "COMMAND.COM",
      ],
      "c-sys-config": [
        "TKANOTTN.INI",
        "DISPLAY.CFG",
        "PALETTE.DAT",
        "GRID.CFG",
        "KEYBOARD.MAP",
        "PRINTER.DRV",
        "SOUND.CFG",
        "USER.PRF",
      ],
      "c-sys-drivers": [
        "VGA256.DRV",
        "MOUSE.DRV",
        "CDROM.SYS",
        "SBPRO.DRV",
        "JOYSTICK.DRV",
        "MIDI.DRV",
      ],
      "a-root": [
        "BACKUP01",
        "README",
        "INSTALL",
      ],
      "d-root": [
        "SETUP",
        "README",
        "DEMO",
        "MANUAL",
      ],
    };

    const names = catalog[dirId] ?? [];
    const siblings: string[] = [];

    return names.map((name, i) => {
      const isSystemDir = dirId.startsWith("c-sys") || dirId === "c-system";
      const hasExtension = /\.\w{3}$/.test(name);

      let filename: string;
      if (isSystemDir && hasExtension) {
        filename = name.toUpperCase();
      } else if (isSystemDir) {
        filename = convertFileName(name, ".SYS", siblings);
      } else if (dirId === "a-root") {
        filename = convertFileName(name, ".BAK", siblings);
      } else if (dirId === "d-root") {
        filename = convertFileName(name, ".EXE", siblings);
      } else {
        filename = convertFileName(name, ".SEQ", siblings);
      }

      siblings.push(filename);

      const seed = name.length + i * 7;
      const size = ((seed * 2048) + 1024) % 65536;
      const month = ((seed % 12) + 1).toString().padStart(2, "0");
      const day = ((seed % 28) + 1).toString().padStart(2, "0");
      const year = 1994 + (seed % 3);

      return { name: filename, size, modified: `${month}/${day}/${year}` };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Unified file list - real data for SEQUENCES, static elsewhere       */
  /* ------------------------------------------------------------------ */

  /** Whether the current directory shows real library data */
  const isLibraryDir = $derived(selectedDirId === "c-sequences");

  function formatDosDate(date: Date): string {
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${m}/${d}/${y}`;
  }

  /** Unified row shape used by both real and static files */
  interface FileRow {
    name: string;
    size: number;
    modified: string;
    /** Only set for real library files */
    retroFile?: RetroFile;
  }

  const currentFiles: FileRow[] = $derived.by(() => {
    if (isLibraryDir) {
      return libraryFiles.map((f) => ({
        name: f.dosName,
        size: f.size,
        modified: formatDosDate(f.date),
        retroFile: f,
      }));
    }
    return generateStaticFiles(selectedDirId).map((f) => ({
      name: f.name,
      size: f.size,
      modified: f.modified,
    }));
  });

  const currentDirPath = $derived(dirIdToPath(selectedDirId));

  const totalSize = $derived(
    currentFiles.reduce((sum, f) => sum + f.size, 0),
  );

  const statusPanels = $derived([
    {
      text: libraryLoading && isLibraryDir
        ? "Loading files..."
        : selectedFileIndex >= 0
          ? `1 object(s) - ${currentFiles[selectedFileIndex]?.size.toLocaleString()} bytes`
          : `${currentFiles.length} object(s) - ${totalSize.toLocaleString()} bytes`,
      width: "220px",
    },
    { text: statusText || currentDirPath },
  ]);

  /* ------------------------------------------------------------------ */
  /* DataGrid columns for details view                                   */
  /* ------------------------------------------------------------------ */

  const detailColumns = [
    { key: "icon", label: "", width: "24px" },
    { key: "name", label: "Name", width: "140px" },
    { key: "size", label: "Size", width: "80px" },
    { key: "modified", label: "Modified", width: "90px" },
  ];

  const detailRows = $derived(
    currentFiles.map((f) => ({
      icon: RETRO_ICONS.fileTxt,
      name: f.name,
      size: `${f.size.toLocaleString()} KB`,
      modified: f.modified,
    })),
  );

  const listItems = $derived(currentFiles.map((f) => f.name));

  /* ------------------------------------------------------------------ */
  /* Menu bar                                                            */
  /* ------------------------------------------------------------------ */

  const menus = $derived([
    {
      label: "File",
      items: [
        {
          label: "Delete",
          disabled: selectedFileIndex < 0 || !currentFiles[selectedFileIndex]?.retroFile,
          action: () => promptDelete(),
        },
        { label: "Exit", action: () => onclose?.() },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Large Icons", disabled: true },
        { label: "Small Icons", disabled: true },
        { label: "List", action: () => (viewMode = "list") },
        { label: "Details", action: () => (viewMode = "details") },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "About FILEMGR.EXE",
          action: () => {
            statusText = "FILEMGR.EXE v1.0 - TKA-OS File Manager";
          },
        },
      ],
    },
  ]);

  /* ------------------------------------------------------------------ */
  /* Toolbar                                                             */
  /* ------------------------------------------------------------------ */

  const canGoBack = $derived(historyIndex > 0);
  const canGoForward = $derived(historyIndex < navigationHistory.length - 1);

  const toolbarButtons = $derived([
    {
      icon: RETRO_ICONS.arrowLeft,
      tooltip: "Back",
      disabled: !canGoBack,
      action: () => navigateBack(),
      isHtml: true,
    },
    {
      icon: RETRO_ICONS.arrowRight,
      tooltip: "Forward",
      disabled: !canGoForward,
      action: () => navigateForward(),
      isHtml: true,
    },
    {
      icon: RETRO_ICONS.arrowUp,
      tooltip: "Up One Level",
      action: () => navigateUp(),
      isHtml: true,
    },
    { separator: true, icon: "", tooltip: "", action: () => {} },
    {
      icon: RETRO_ICONS.viewDetails,
      tooltip: "Details",
      action: () => (viewMode = "details"),
      isHtml: true,
    },
    {
      icon: RETRO_ICONS.viewList,
      tooltip: "List",
      action: () => (viewMode = "list"),
      isHtml: true,
    },
  ]);

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */

  function handleTreeSelect(id: string) {
    selectedDirId = id;
    selectedFileIndex = -1;
    statusText = "";

    /* Trim forward history and push */
    navigationHistory = [...navigationHistory.slice(0, historyIndex + 1), id];
    historyIndex = navigationHistory.length - 1;
  }

  function navigateBack() {
    if (historyIndex > 0) {
      historyIndex--;
      selectedDirId = navigationHistory[historyIndex]!;
      selectedFileIndex = -1;
    }
  }

  function navigateForward() {
    if (historyIndex < navigationHistory.length - 1) {
      historyIndex++;
      selectedDirId = navigationHistory[historyIndex]!;
      selectedFileIndex = -1;
    }
  }

  function navigateUp() {
    const parentMap: Record<string, string> = {
      "c-sequences": "c-root",
      "c-system": "c-root",
      "c-sys-config": "c-system",
      "c-sys-drivers": "c-system",
    };

    const parentId = parentMap[selectedDirId];
    if (parentId) {
      handleTreeSelect(parentId);
    }
  }

  function dirIdToPath(id: string): string {
    const pathMap: Record<string, string> = {
      "c-root": "C:\\",
      "c-sequences": "C:\\SEQUENCES",
      "c-system": "C:\\SYSTEM",
      "c-sys-config": "C:\\SYSTEM\\CONFIG",
      "c-sys-drivers": "C:\\SYSTEM\\DRIVERS",
      "a-root": "A:\\",
      "d-root": "D:\\",
    };
    return pathMap[id] ?? "C:\\";
  }

  /* ------------------------------------------------------------------ */
  /* File interactions                                                   */
  /* ------------------------------------------------------------------ */

  function handleFileSelect(index: number) {
    selectedFileIndex = index;
    statusText = "";
  }

  function handleFileDblClick(index: number) {
    const file = currentFiles[index];
    if (!file) return;
    statusText = `Opening ${file.name}... (redirecting to TKANOTTN.EXE)`;
  }

  /* ------------------------------------------------------------------ */
  /* Delete confirmation                                                 */
  /* ------------------------------------------------------------------ */

  function promptDelete() {
    const row = currentFiles[selectedFileIndex];
    if (!row?.retroFile) return;
    pendingDeleteFile = row.retroFile;
  }

  async function confirmDelete() {
    if (!pendingDeleteFile) return;
    const name = pendingDeleteFile.dosName;
    try {
      await deleteFile(pendingDeleteFile.id);
      statusText = `${name} moved to Recycle Bin`;
    } catch {
      statusText = `Error deleting ${name}`;
    }
    pendingDeleteFile = null;
    selectedFileIndex = -1;
  }

  function cancelDelete() {
    pendingDeleteFile = null;
  }
</script>

<div class="filemgr-shell">
  <!-- Menu bar -->
  <div class="filemgr-menubar">
    <RetroMenuBar {menus} />
  </div>

  <!-- Toolbar -->
  <div class="filemgr-toolbar">
    <RetroToolbar buttons={toolbarButtons} />
  </div>

  <!-- Address bar -->
  <div class="filemgr-address">
    <span class="address-label">Address:</span>
    <span class="address-path sunken-panel">{currentDirPath}</span>
  </div>

  <!-- Splitter: tree + file list -->
  <div class="filemgr-content">
    <RetroSplitter direction="horizontal" initialSplit={25}>
      {#snippet left()}
        <div class="tree-pane">
          <RetroTreeView
            nodes={treeNodes}
            bind:selectedId={selectedDirId}
            onselect={handleTreeSelect}
          />
        </div>
      {/snippet}
      {#snippet right()}
        <div class="files-pane">
          {#if viewMode === "details"}
            <RetroDataGrid
              columns={detailColumns}
              rows={detailRows}
              bind:selectedRow={selectedFileIndex}
              onselect={handleFileSelect}
              ondblclick={handleFileDblClick}
            />
          {:else}
            <RetroListBox
              items={listItems}
              bind:selectedIndex={selectedFileIndex}
              onselect={handleFileSelect}
              ondblclick={handleFileDblClick}
            />
          {/if}
        </div>
      {/snippet}
    </RetroSplitter>
  </div>

  <!-- Status bar -->
  <div class="filemgr-statusbar">
    <RetroStatusBar panels={statusPanels} />
  </div>

  <!-- Delete confirmation dialog -->
  {#if pendingDeleteFile}
    <div class="delete-overlay">
      <div class="delete-dialog raised-panel">
        <div class="delete-title">Confirm File Delete</div>
        <div class="delete-body">
          Are you sure you want to send '{pendingDeleteFile.dosName}' to the Recycle Bin?
        </div>
        <div class="delete-buttons">
          <button class="retro-btn" onclick={confirmDelete}>Yes</button>
          <button class="retro-btn" onclick={cancelDelete}>No</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Shell layout - fills parent window body                             */
  .filemgr-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  /* Menu bar                                                            */
  .filemgr-menubar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
  }

  /* Toolbar                                                             */
  .filemgr-toolbar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
  }

  /* Address bar                                                         */
  .filemgr-address {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
    background: var(--retro-button-face, #c0c0c0);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
  }

  .address-label {
    flex-shrink: 0;
    color: var(--retro-black, #000);
  }

  .address-path {
    flex: 1;
    padding: 1px 4px;
    background: var(--retro-field-bg, #fff);
    color: var(--retro-field-text, #000);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Content: splitter fills remaining space                             */
  .filemgr-content {
    flex: 1;
    min-height: 0;
    padding: 4px;
  }

  .tree-pane {
    height: 100%;
  }

  .tree-pane :global(.retro-treeview) {
    height: 100%;
  }

  .files-pane {
    height: 100%;
  }

  .files-pane :global(.retro-datagrid-wrapper) {
    height: 100%;
  }

  .files-pane :global(.retro-listbox) {
    height: 100% !important;
  }

  /* Status bar                                                          */
  .filemgr-statusbar {
    flex-shrink: 0;
  }

  /* Delete confirmation dialog                                          */
  .delete-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.25);
    z-index: 10;
  }

  .delete-dialog {
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    padding: 0;
    min-width: 280px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
  }

  .delete-title {
    background: var(--retro-active-title, #000080);
    color: var(--retro-title-text, #fff);
    padding: 2px 4px;
    font-weight: bold;
  }

  .delete-body {
    padding: 16px 12px;
    color: var(--retro-black, #000);
  }

  .delete-buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 0 12px 12px;
  }

  .retro-btn {
    min-width: 72px;
    padding: 2px 8px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    background: var(--retro-button-face, #c0c0c0);
    border: 2px outset var(--retro-button-face, #c0c0c0);
    cursor: pointer;
  }

  .retro-btn:active {
    border-style: inset;
  }
</style>
