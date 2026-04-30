<!--
  RetroControlPanel - CONTROL.EXE Control Panel

  Icon-grid launcher that opens sub-panels inline. Clicking an icon
  replaces the grid with a sub-panel. [Back] button returns to grid.

  Domain: Retro CONTROL App
-->
<script lang="ts">
  import RetroStatusBar from "../../primitives/RetroStatusBar.svelte";
  import { RETRO_ICONS, type RetroIconName } from "../../rendering/retro-icons";
  import DisplayPanel from "./panels/DisplayPanel.svelte";
  import SoundPanel from "./panels/SoundPanel.svelte";
  import MousePanel from "./panels/MousePanel.svelte";
  import DateTimePanel from "./panels/DateTimePanel.svelte";
  import AboutPanel from "./panels/AboutPanel.svelte";
  import KeyboardPanel from "./panels/KeyboardPanel.svelte";
  import StubPanel from "./panels/StubPanel.svelte";

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  type PanelId =
    | "grid"
    | "display"
    | "sound"
    | "props"
    | "keyboard"
    | "mouse"
    | "printers"
    | "network"
    | "datetime"
    | "about";

  let activePanel: PanelId = $state("grid");
  let statusText = $state("Select an icon");

  interface ControlIcon {
    id: PanelId;
    iconName: RetroIconName;
    label: string;
  }

  const ICONS: ControlIcon[] = [
    { id: "display", iconName: "display", label: "Display" },
    { id: "sound", iconName: "sound", label: "Sound" },
    { id: "props", iconName: "props", label: "Props" },
    { id: "keyboard", iconName: "keyboard", label: "Keyboard" },
    { id: "mouse", iconName: "mouse", label: "Mouse" },
    { id: "printers", iconName: "printers", label: "Printers" },
    { id: "network", iconName: "network", label: "Network" },
    { id: "datetime", iconName: "datetime", label: "Date/Time" },
    { id: "about", iconName: "info", label: "About" },
  ];

  function openPanel(id: PanelId) {
    activePanel = id;
    statusText = `${ICONS.find((i) => i.id === id)?.label ?? id}`;
  }

  function backToGrid() {
    activePanel = "grid";
    statusText = "Select an icon";
  }

  function setStatus(text: string) {
    statusText = text;
  }

  const statusPanels = $derived([{ text: statusText }]);

  const STUB_PANELS: PanelId[] = ["props", "printers", "network"];
</script>

<div class="control-shell">
  <div class="control-content">
    {#if activePanel === "grid"}
      <div class="icon-grid">
        {#each ICONS as icon (icon.id)}
          <button
            class="icon-cell"
            type="button"
            onclick={() => openPanel(icon.id)}
          >
            <span class="icon-image" aria-hidden="true">{@html RETRO_ICONS[icon.iconName]}</span>
            <span class="icon-label">{icon.label}</span>
          </button>
        {/each}
      </div>
    {:else if activePanel === "display"}
      <DisplayPanel onback={backToGrid} onstatuschange={setStatus} />
    {:else if activePanel === "sound"}
      <SoundPanel onback={backToGrid} onstatuschange={setStatus} />
    {:else if activePanel === "mouse"}
      <MousePanel onback={backToGrid} onstatuschange={setStatus} />
    {:else if activePanel === "datetime"}
      <DateTimePanel onback={backToGrid} />
    {:else if activePanel === "about"}
      <AboutPanel onback={backToGrid} />
    {:else if activePanel === "keyboard"}
      <KeyboardPanel onback={backToGrid} />
    {:else if STUB_PANELS.includes(activePanel)}
      <StubPanel
        panelId={activePanel as "props" | "printers" | "network"}
        label={ICONS.find((i) => i.id === activePanel)?.label ?? ""}
        onback={backToGrid}
      />
    {/if}
  </div>

  <div class="control-statusbar">
    <RetroStatusBar panels={statusPanels} />
  </div>
</div>

<style>
  .control-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--retro-button-face, #c0c0c0);
  }

  .control-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px;
  }

  .control-statusbar {
    flex-shrink: 0;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 8px;
  }

  .icon-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: none;
    border: 1px solid transparent;
    cursor: default;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    user-select: none;
  }

  .icon-cell:hover {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }

  .icon-cell:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -2px;
  }

  .icon-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }

  .icon-image :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .icon-label {
    text-align: center;
    line-height: 1.2;
  }
</style>
