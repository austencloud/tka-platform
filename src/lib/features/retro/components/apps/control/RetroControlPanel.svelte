<!--
  RetroControlPanel — CONTROL.EXE Control Panel

  Icon-grid launcher that opens sub-panels inline. Clicking an icon
  replaces the grid with a sub-panel. [Back] button returns to grid.
  Fills its parent RetroWindow body area.

  Domain: Retro CONTROL App
-->
<script lang="ts">
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroCheckbox from "../../primitives/RetroCheckbox.svelte";
  import RetroStatusBar from "../../primitives/RetroStatusBar.svelte";

  /* ------------------------------------------------------------------ */
  /* Props                                                               */
  /* ------------------------------------------------------------------ */

  let {
    onclose,
  }: {
    onclose?: () => void;
  } = $props();

  /* ------------------------------------------------------------------ */
  /* Navigation state                                                    */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
  /* Icon grid entries                                                   */
  /* ------------------------------------------------------------------ */

  interface ControlIcon {
    id: PanelId;
    emoji: string;
    label: string;
  }

  const ICONS: ControlIcon[] = [
    { id: "display", emoji: "\u{1F5A5}\uFE0F", label: "Display" },
    { id: "sound", emoji: "\u{1F50A}", label: "Sound" },
    { id: "props", emoji: "\u{1F3AD}", label: "Props" },
    { id: "keyboard", emoji: "\u2328\uFE0F", label: "Keyboard" },
    { id: "mouse", emoji: "\u{1F5B1}\uFE0F", label: "Mouse" },
    { id: "printers", emoji: "\u{1F5A8}\uFE0F", label: "Printers" },
    { id: "network", emoji: "\u{1F310}", label: "Network" },
    { id: "datetime", emoji: "\u{1F4C5}", label: "Date/Time" },
    { id: "about", emoji: "\u2139\uFE0F", label: "About" },
  ];

  function openPanel(id: PanelId) {
    activePanel = id;
    statusText = `${ICONS.find((i) => i.id === id)?.label ?? id}`;
  }

  function backToGrid() {
    activePanel = "grid";
    statusText = "Select an icon";
  }

  /* ------------------------------------------------------------------ */
  /* Display sub-panel state                                             */
  /* ------------------------------------------------------------------ */

  let displayScanlines = $state(true);
  let displayVignette = $state(true);
  let displayFlicker = $state(true);

  const displayPreview = $derived(() => {
    const effects: string[] = [];
    if (displayScanlines) effects.push("Scanlines");
    if (displayVignette) effects.push("Vignette");
    if (displayFlicker) effects.push("Flicker");
    return effects.length > 0
      ? `Active effects: ${effects.join(", ")}`
      : "No CRT effects enabled";
  });

  function displayApply() {
    statusText = "Display settings applied";
  }

  function displayOk() {
    displayApply();
    backToGrid();
  }

  /* ------------------------------------------------------------------ */
  /* Sound sub-panel state                                               */
  /* ------------------------------------------------------------------ */

  let soundVolume = $state(75);
  let soundMuted = $state(false);

  function soundVolumeUp() {
    soundVolume = Math.min(100, soundVolume + 5);
  }

  function soundVolumeDown() {
    soundVolume = Math.max(0, soundVolume - 5);
  }

  function soundTest() {
    statusText = "\u266A Ding!";
  }

  function soundOk() {
    statusText = "Sound settings applied";
    backToGrid();
  }

  /* ------------------------------------------------------------------ */
  /* Status bar                                                          */
  /* ------------------------------------------------------------------ */

  const statusPanels = $derived([{ text: statusText }]);
</script>

<div class="control-shell">
  <div class="control-content">
    <!-- ====================================================== -->
    <!-- Icon grid                                               -->
    <!-- ====================================================== -->
    {#if activePanel === "grid"}
      <div class="icon-grid">
        {#each ICONS as icon (icon.id)}
          <button
            class="icon-cell"
            type="button"
            ondblclick={() => openPanel(icon.id)}
            onclick={() => {
              statusText = icon.label;
            }}
          >
            <span class="icon-emoji">{icon.emoji}</span>
            <span class="icon-label">{icon.label}</span>
          </button>
        {/each}
      </div>

    <!-- ====================================================== -->
    <!-- Display sub-panel                                       -->
    <!-- ====================================================== -->
    {:else if activePanel === "display"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            \u25C4 Back
          </button>
          <span class="sub-panel-title">Display Properties</span>
        </div>

        <fieldset class="sub-panel-group">
          <legend>CRT Effects</legend>
          <div class="checkbox-stack">
            <RetroCheckbox label="Scanlines" bind:checked={displayScanlines} />
            <RetroCheckbox label="Vignette" bind:checked={displayVignette} />
            <RetroCheckbox label="Flicker" bind:checked={displayFlicker} />
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Preview</legend>
          <div class="preview-area sunken-panel">
            {displayPreview()}
          </div>
        </fieldset>

        <div class="sub-panel-buttons">
          <RetroButton label="Apply" onclick={displayApply} />
          <RetroButton label="OK" isDefault={true} onclick={displayOk} />
          <RetroButton label="Cancel" onclick={backToGrid} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- Sound sub-panel                                         -->
    <!-- ====================================================== -->
    {:else if activePanel === "sound"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            \u25C4 Back
          </button>
          <span class="sub-panel-title">Sound</span>
        </div>

        <fieldset class="sub-panel-group">
          <legend>Volume</legend>
          <div class="volume-control">
            <span class="volume-label">Level:</span>
            <div class="volume-input-group">
              <div class="volume-value sunken-panel">{soundVolume}</div>
              <div class="volume-buttons">
                <button
                  class="volume-arrow"
                  type="button"
                  onclick={soundVolumeUp}
                  aria-label="Volume up"
                >\u25B2</button>
                <button
                  class="volume-arrow"
                  type="button"
                  onclick={soundVolumeDown}
                  aria-label="Volume down"
                >\u25BC</button>
              </div>
            </div>
          </div>
          <div class="sound-mute">
            <RetroCheckbox label="Mute all sounds" bind:checked={soundMuted} />
          </div>
        </fieldset>

        <div class="sub-panel-buttons">
          <RetroButton label="Test" onclick={soundTest} />
          <RetroButton label="OK" isDefault={true} onclick={soundOk} />
          <RetroButton label="Cancel" onclick={backToGrid} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- About sub-panel                                         -->
    <!-- ====================================================== -->
    {:else if activePanel === "about"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            \u25C4 Back
          </button>
          <span class="sub-panel-title">About TKA-OS</span>
        </div>

        <div class="about-body sunken-panel">
          <div class="about-line about-bold">TKA-OS v1.0</div>
          <div class="about-line">(c) 1995 Bellweather Technical Institute</div>
          <div class="about-line">All rights reserved.</div>
          <div class="about-spacer"></div>
          <div class="about-line">Licensed to: [CLASSIFIED]</div>
          <div class="about-line">Serial: BTI-1995-TKA-OS-001</div>
          <div class="about-spacer"></div>
          <div class="about-line">Physical Memory: 640 KB</div>
          <div class="about-line">Available Memory: 247 KB</div>
          <div class="about-line">System Resources: 73% free</div>
          <div class="about-spacer"></div>
          <div class="about-line about-classified">
            This software is classified under Order 7, Section 12.
          </div>
          <div class="about-line about-classified">
            Unauthorized distribution will be met with... consequences.
          </div>
        </div>

        <div class="sub-panel-buttons">
          <RetroButton label="OK" isDefault={true} onclick={backToGrid} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- Simple message sub-panels                               -->
    <!-- ====================================================== -->
    {:else}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            \u25C4 Back
          </button>
          <span class="sub-panel-title">
            {ICONS.find((i) => i.id === activePanel)?.label ?? ""}
          </span>
        </div>

        <div class="simple-message sunken-panel">
          {#if activePanel === "props"}
            Recommended: Double Staves. Other props not yet supported by TKA-OS.
          {:else if activePanel === "keyboard"}
            Key repeat rate: \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591 Fast.
            Key repeat delay: \u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591 Short.
          {:else if activePanel === "mouse"}
            Double-click speed: \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591 Fast.
            Pointer trail: Enabled (3 ghosts).
          {:else if activePanel === "printers"}
            No printers installed. TKA-OS supports LPT1 and LPT2 parallel ports only.
          {:else if activePanel === "network"}
            TKA-NET v0.1 not configured. Contact your system administrator at Bellweather Technical Institute.
          {:else if activePanel === "datetime"}
            Friday, March 15, 1995  3:47 PM.
            Time zone: (GMT-05:00) Eastern Time (Bellweather HQ)
          {/if}
        </div>

        <div class="sub-panel-buttons">
          <RetroButton label="OK" isDefault={true} onclick={backToGrid} />
        </div>
      </div>
    {/if}
  </div>

  <!-- Status bar -->
  <div class="control-statusbar">
    <RetroStatusBar panels={statusPanels} />
  </div>
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Shell layout                                                        */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* Icon grid                                                           */
  /* ------------------------------------------------------------------ */
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

  .icon-emoji {
    font-size: 32px;
    line-height: 1;
  }

  .icon-label {
    text-align: center;
    line-height: 1.2;
  }

  /* ------------------------------------------------------------------ */
  /* Sub-panels                                                          */
  /* ------------------------------------------------------------------ */
  .sub-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sub-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .back-btn {
    min-width: 60px;
    min-height: 21px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    padding: 2px 8px;
    cursor: default;
  }

  .sub-panel-title {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 12px;
    font-weight: bold;
    color: var(--retro-black, #000);
  }

  .sub-panel-group {
    border: 1px solid var(--retro-button-shadow, #808080);
    padding: 8px;
    margin: 0;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
  }

  .sub-panel-group legend {
    font-weight: bold;
    color: var(--retro-black, #000);
    padding: 0 4px;
  }

  .sub-panel-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    padding-top: 4px;
  }

  /* ------------------------------------------------------------------ */
  /* Display sub-panel                                                   */
  /* ------------------------------------------------------------------ */
  .checkbox-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-area {
    padding: 8px;
    min-height: 32px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    background: var(--retro-field-bg, #fff);
  }

  /* ------------------------------------------------------------------ */
  /* Sound sub-panel                                                     */
  /* ------------------------------------------------------------------ */
  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .volume-label {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .volume-input-group {
    display: flex;
    align-items: stretch;
    gap: 0;
  }

  .volume-value {
    width: 40px;
    padding: 2px 4px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    text-align: right;
    background: var(--retro-field-bg, #fff);
    color: var(--retro-black, #000);
  }

  .volume-buttons {
    display: flex;
    flex-direction: column;
  }

  .volume-arrow {
    width: 16px;
    height: 11px;
    font-size: 7px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
  }

  .sound-mute {
    margin-top: 8px;
  }

  /* ------------------------------------------------------------------ */
  /* About sub-panel                                                     */
  /* ------------------------------------------------------------------ */
  .about-body {
    padding: 12px;
    background: var(--retro-field-bg, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    line-height: 1.6;
  }

  .about-line {
    white-space: pre-wrap;
  }

  .about-bold {
    font-weight: bold;
    font-size: 12px;
  }

  .about-spacer {
    height: 8px;
  }

  .about-classified {
    font-style: italic;
    color: var(--retro-disabled-text, #808080);
  }

  /* ------------------------------------------------------------------ */
  /* Simple message sub-panels                                           */
  /* ------------------------------------------------------------------ */
  .simple-message {
    padding: 12px;
    background: var(--retro-field-bg, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    line-height: 1.6;
    white-space: pre-line;
  }
</style>
