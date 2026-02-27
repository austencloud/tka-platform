<!--
  RetroScribe — SCRIBE.EXE main component

  The flagship TKA-OS application. Retro version of the Create module
  rendered inside a RetroWindow. Contains a full Win95-style app shell:
  menu bar, toolbar, tab control, and status bar.

  Fills its parent container (the RetroWindow body area).

  Domain: Retro SCRIBE App
-->
<script lang="ts">
  import RetroMenuBar from "../../primitives/RetroMenuBar.svelte";
  import RetroToolbar from "../../primitives/RetroToolbar.svelte";
  import RetroTabControl from "../../primitives/RetroTabControl.svelte";
  import RetroStatusBar from "../../primitives/RetroStatusBar.svelte";
  import RetroGenerateTab from "./RetroGenerateTab.svelte";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  let activeTab = $state("construct");
  let showToolbar = $state(true);
  let showStatusBar = $state(true);
  let beatCount = $state(0);
  let statusText = $state("Ready");

  /* ------------------------------------------------------------------ */
  /* Tab definitions                                                     */
  /* ------------------------------------------------------------------ */

  const tabs = [
    { id: "construct", label: "Construct" },
    { id: "visual-builder", label: "Visual Builder" },
    { id: "generate", label: "Generate" },
    { id: "spell", label: "Spell" },
  ];

  /* ------------------------------------------------------------------ */
  /* Menu bar                                                            */
  /* ------------------------------------------------------------------ */

  const menus = $derived([
    {
      label: "File",
      items: [
        { label: "New", shortcut: "Ctrl+N", action: () => handleNew() },
        { label: "Open...", shortcut: "Ctrl+O", action: () => {} },
        { label: "Save", shortcut: "Ctrl+S", action: () => handleSave() },
        { label: "Save As...", action: () => handleSave() },
        { separator: true, label: "" },
        { label: "Exit", action: () => onclose?.() },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", disabled: true },
        { label: "Redo", shortcut: "Ctrl+Y", disabled: true },
        { separator: true, label: "" },
        { label: "Cut", shortcut: "Ctrl+X", disabled: true },
        { label: "Copy", shortcut: "Ctrl+C", disabled: true },
        { label: "Paste", shortcut: "Ctrl+V", disabled: true },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Toolbar", action: () => (showToolbar = !showToolbar) },
        { label: "Status Bar", action: () => (showStatusBar = !showStatusBar) },
      ],
    },
    {
      label: "Sequence",
      items: [
        {
          label: "Add Beat...",
          action: () => {
            activeTab = "construct";
          },
        },
        { label: "Clear All", action: () => handleClear() },
      ],
    },
    {
      label: "Generate",
      items: [
        {
          label: "Generate Word...",
          shortcut: "F5",
          action: () => {
            activeTab = "generate";
          },
        },
        {
          label: "Spell Word...",
          action: () => {
            activeTab = "spell";
          },
        },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About SCRIBE.EXE", action: () => showAbout() }],
    },
  ]);

  /* ------------------------------------------------------------------ */
  /* Toolbar buttons                                                     */
  /* ------------------------------------------------------------------ */

  const toolbarButtons = $derived([
    { icon: "\u{1F4C4}", tooltip: "New", action: () => handleNew() },
    { icon: "\u{1F4C2}", tooltip: "Open", action: () => {} },
    { icon: "\u{1F4BE}", tooltip: "Save", action: () => handleSave() },
    { separator: true, icon: "", tooltip: "", action: () => {} },
    {
      icon: "\u25B6\uFE0F",
      tooltip: "Generate",
      action: () => {
        activeTab = "generate";
      },
    },
  ]);

  /* ------------------------------------------------------------------ */
  /* Status bar panels                                                   */
  /* ------------------------------------------------------------------ */

  const statusPanels = $derived([
    { text: `Beats: ${beatCount}`, width: "100px" },
    { text: statusText },
  ]);

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  function handleNew() {
    beatCount = 0;
    statusText = "New sequence";
  }

  function handleSave() {
    statusText = "Saved.";
  }

  function handleClear() {
    beatCount = 0;
    statusText = "Cleared";
  }

  function showAbout() {
    statusText = "SCRIBE.EXE v1.0 - TKA-OS";
  }

  function handleGenerateStatusChange(status: string) {
    statusText = status;

    /* Parse beat count from generate status if available */
    const match = status.match(/Beats:\s*(\d+)/);
    if (match) {
      beatCount = parseInt(match[1]!, 10);
    }
  }
</script>

<div class="scribe-shell">
  <!-- Menu bar -->
  <div class="scribe-menubar">
    <RetroMenuBar {menus} />
  </div>

  <!-- Toolbar (toggle-able) -->
  {#if showToolbar}
    <div class="scribe-toolbar">
      <RetroToolbar buttons={toolbarButtons} />
    </div>
  {/if}

  <!-- Tab control + content area -->
  <div class="scribe-content">
    <RetroTabControl {tabs} bind:activeTab>
      {#snippet children()}
        {#if activeTab === "generate"}
          <RetroGenerateTab onstatuschange={handleGenerateStatusChange} />
        {:else if activeTab === "construct"}
          <div class="tab-placeholder">
            <p class="tab-placeholder-icon">{"\u{1F527}"}</p>
            <p>Construct tab coming soon.</p>
            <p class="tab-placeholder-hint">Beat-by-beat sequence builder.</p>
          </div>
        {:else if activeTab === "visual-builder"}
          <div class="tab-placeholder">
            <p class="tab-placeholder-icon">{"\u{1F3A8}"}</p>
            <p>Visual Builder tab coming soon.</p>
            <p class="tab-placeholder-hint">Drag-and-drop sequence layout.</p>
          </div>
        {:else if activeTab === "spell"}
          <div class="tab-placeholder">
            <p class="tab-placeholder-icon">{"\u{1F524}"}</p>
            <p>Spell tab coming soon.</p>
            <p class="tab-placeholder-hint">Spell words with TKA letters.</p>
          </div>
        {/if}
      {/snippet}
    </RetroTabControl>
  </div>

  <!-- Status bar (toggle-able) -->
  {#if showStatusBar}
    <div class="scribe-statusbar">
      <RetroStatusBar panels={statusPanels} />
    </div>
  {/if}
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Shell layout — fills parent window body                             */
  /* ------------------------------------------------------------------ */
  .scribe-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  /* ------------------------------------------------------------------ */
  /* Menu bar                                                            */
  /* ------------------------------------------------------------------ */
  .scribe-menubar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar                                                             */
  /* ------------------------------------------------------------------ */
  .scribe-toolbar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--retro-button-shadow, #808080);
  }

  /* ------------------------------------------------------------------ */
  /* Content area (tabs + body)                                          */
  /* ------------------------------------------------------------------ */
  .scribe-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 4px 4px 0;
    overflow: hidden;
  }

  /* Make the tab control fill available space */
  .scribe-content :global(.retro-tab-control) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .scribe-content :global(.retro-tab-body) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  /* ------------------------------------------------------------------ */
  /* Status bar                                                          */
  /* ------------------------------------------------------------------ */
  .scribe-statusbar {
    flex-shrink: 0;
  }

  /* ------------------------------------------------------------------ */
  /* Placeholder tabs                                                    */
  /* ------------------------------------------------------------------ */
  .tab-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 80px;
    padding: 16px;
    text-align: center;
    color: var(--retro-black, #000);
    font-size: var(--retro-font-size, 11px);
  }

  .tab-placeholder p {
    margin: 2px 0;
  }

  .tab-placeholder-icon {
    font-size: 24px;
    margin-bottom: 4px;
  }

  .tab-placeholder-hint {
    color: var(--retro-disabled-text, #808080);
  }
</style>
