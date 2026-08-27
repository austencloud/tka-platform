<!--
  RetroSaveDialog - Win95 Save As dialog for SCRIBE.EXE

  Classic "Save in:" dropdown, directory tree, filename field with 8.3
  format enforcement, file type dropdown, and Save/Cancel buttons.
  Entirely presentational - calls onsave/oncancel callbacks.

  Domain: Retro SCRIBE App
-->
<script lang="ts">
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroTextInput from "../../primitives/RetroTextInput.svelte";
  import RetroDropdown from "../../primitives/RetroDropdown.svelte";
  import RetroTreeView from "../../primitives/RetroTreeView.svelte";
  import type { RetroTreeNode } from "../../../domain/types/retro-types";
  import { RETRO_ICONS } from "../../rendering/retro-icons";

  let {
    filename = $bindable("UNTITLED"),
    oncancel,
    onsave,
  }: {
    filename?: string;
    oncancel?: () => void;
    onsave?: (filename: string) => void;
  } = $props();

  /* State                                                               */

  let saveLocation = $state("a");
  let fileType = $state("seq");
  let selectedTreeNode = $state("seq-dir");

  const locationOptions = [
    { value: "a", label: 'A:\\ [3\u00BD Floppy]' },
    { value: "c", label: "C:\\ [TKA-OS]" },
    { value: "d", label: "D:\\ [CD-ROM]" },
  ];

  const fileTypeOptions = [
    { value: "seq", label: "Sequence Files (*.SEQ)" },
    { value: "all", label: "All Files (*.*)" },
  ];

  /* Directory tree                                                      */

  const directoryTree: RetroTreeNode[] = [
    {
      id: "c-drive",
      label: "C:\\TKA-OS\\",
      icon: RETRO_ICONS.computer,
      expanded: true,
      children: [
        { id: "seq-dir", label: "SEQUENCES\\", icon: RETRO_ICONS.folder },
        { id: "let-dir", label: "LETTERS\\", icon: RETRO_ICONS.folder },
        { id: "sys-dir", label: "SYSTEM\\", icon: RETRO_ICONS.folder },
      ],
    },
    {
      id: "a-drive",
      label: "A:\\",
      icon: RETRO_ICONS.floppy,
    },
  ];

  /* Filename enforcement (8.3 format)                                   */

  function handleFilenameChange(val: string) {
    /* Strip any extension the user typed, uppercase, max 8 chars, alphanumeric only */
    const cleaned = val
      .replace(/\.[^.]*$/, "")
      .replace(/[^A-Za-z0-9_]/g, "")
      .toUpperCase()
      .slice(0, 8);
    filename = cleaned;
  }

  /* Actions                                                             */

  function handleSave() {
    onsave?.(filename);
  }
</script>

<div class="save-dialog">
  <!-- Save in row -->
  <div class="field-row-custom">
    <label class="field-label" for="save-location">Save in:</label>
    <div class="location-dropdown">
      <RetroDropdown
        id="save-location"
        bind:value={saveLocation}
        options={locationOptions}
      />
    </div>
  </div>

  <!-- Directory listing -->
  <div class="directory-area">
    <RetroTreeView
      nodes={directoryTree}
      bind:selectedId={selectedTreeNode}
    />
  </div>

  <!-- File name row -->
  <div class="field-row-custom">
    <label class="field-label" for="save-filename">File name:</label>
    <div class="filename-input">
      <RetroTextInput
        id="save-filename"
        value={filename}
        maxLength={8}
        onchange={handleFilenameChange}
      />
    </div>
    <span class="extension-label">.SEQ</span>
  </div>

  <!-- Save as type row -->
  <div class="field-row-custom">
    <label class="field-label" for="save-type">Save as type:</label>
    <div class="type-dropdown">
      <RetroDropdown
        id="save-type"
        bind:value={fileType}
        options={fileTypeOptions}
      />
    </div>
  </div>

  <!-- Button row -->
  <div class="button-row">
    <RetroButton label="Save" isDefault saveShortcut onclick={handleSave} />
    <RetroButton label="Cancel" onclick={() => oncancel?.()} />
  </div>
</div>

<style>
  .save-dialog {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
  }

  /* Field rows                                                          */
  .field-row-custom {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .field-label {
    white-space: nowrap;
    color: var(--retro-black, #000);
    font-size: var(--retro-font-size, 11px);
    flex-shrink: 0;
    min-width: 75px;
  }

  .location-dropdown {
    flex: 1;
  }

  .location-dropdown :global(.retro-dropdown) {
    width: 100%;
  }

  .filename-input {
    flex: 1;
  }

  .extension-label {
    color: var(--retro-black, #000);
    font-family: var(--retro-font-mono, "Fixedsys", monospace);
    font-size: var(--retro-font-size, 11px);
    flex-shrink: 0;
  }

  .type-dropdown {
    flex: 1;
  }

  .type-dropdown :global(.retro-dropdown) {
    width: 100%;
  }

  /* Directory area                                                      */
  .directory-area {
    height: 120px;
  }

  .directory-area :global(.retro-treeview) {
    height: 100%;
  }

  /* Button row                                                          */
  .button-row {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 4px;
  }
</style>
