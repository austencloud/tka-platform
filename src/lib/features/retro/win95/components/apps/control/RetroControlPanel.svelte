<!--
  RetroControlPanel — CONTROL.EXE Control Panel

  Icon-grid launcher that opens sub-panels inline. Clicking an icon
  replaces the grid with a sub-panel. [Back] button returns to grid.

  Functional panels:
  - Display: CRT effects (scanlines/vignette/flicker), desktop color,
    screen saver timeout — all wired to desktopState
  - Sound: volume + mute wired to RetroSoundManager, test button plays ding
  - Mouse: double-click speed slider (wired), pointer trail flavor
  - Date/Time: live system clock
  - About: TKA-OS lore + system stats
  - Props/Keyboard/Printers/Network: themed flavor text

  Domain: Retro CONTROL App
-->
<script lang="ts">
  import RetroButton from "../../primitives/RetroButton.svelte";
  import RetroCheckbox from "../../primitives/RetroCheckbox.svelte";
  import RetroStatusBar from "../../primitives/RetroStatusBar.svelte";
  import RetroTabControl from "../../primitives/RetroTabControl.svelte";
  import { RETRO_ICONS, type RetroIconName } from "../../rendering/retro-icons";
  import { desktopState } from "../../../state/desktop-state.svelte";
  import { retroSound } from "../../../state/retro-sound";

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

  /* ------------------------------------------------------------------ */
  /* Display sub-panel state                                             */
  /* ------------------------------------------------------------------ */

  let displayTab = $state("effects");
  let displayScanlines = $state(desktopState.crtScanlines);
  let displayVignette = $state(desktopState.crtVignette);
  let displayFlicker = $state(desktopState.crtFlicker);
  let displayColor = $state(desktopState.desktopColor);
  let displaySaverTimeout = $state(desktopState.screensaverTimeout);

  const DISPLAY_TABS = [
    { id: "effects", label: "Effects" },
    { id: "background", label: "Background" },
    { id: "screensaver", label: "Screen Saver" },
  ];

  /** Win95 20-color palette for desktop background */
  const DESKTOP_COLORS = [
    "#000000", "#800000", "#008000", "#808000", "#000080",
    "#800080", "#008080", "#c0c0c0", "#808080", "#ff0000",
    "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff",
    "#ffffff", "#003366", "#006633", "#660033", "#333399",
  ];

  const SAVER_OPTIONS = [
    { label: "(None)", value: 0 },
    { label: "1 minute", value: 60 },
    { label: "2 minutes", value: 120 },
    { label: "5 minutes", value: 300 },
    { label: "10 minutes", value: 600 },
  ];

  function displayApply() {
    desktopState.crtScanlines = displayScanlines;
    desktopState.crtVignette = displayVignette;
    desktopState.crtFlicker = displayFlicker;
    desktopState.desktopColor = displayColor;
    desktopState.screensaverTimeout = displaySaverTimeout;
    statusText = "Display settings applied";
  }

  function displayOk() {
    displayApply();
    backToGrid();
  }

  function displayCancel() {
    /* Revert local state to current applied values */
    displayScanlines = desktopState.crtScanlines;
    displayVignette = desktopState.crtVignette;
    displayFlicker = desktopState.crtFlicker;
    displayColor = desktopState.desktopColor;
    displaySaverTimeout = desktopState.screensaverTimeout;
    backToGrid();
  }

  /* ------------------------------------------------------------------ */
  /* Sound sub-panel state                                               */
  /* ------------------------------------------------------------------ */

  let soundVolume = $state(desktopState.soundVolume);
  let soundMuted = $state(desktopState.soundMuted);

  function soundVolumeUp() {
    soundVolume = Math.min(100, soundVolume + 5);
  }

  function soundVolumeDown() {
    soundVolume = Math.max(0, soundVolume - 5);
  }

  function soundApply() {
    desktopState.soundVolume = soundVolume;
    desktopState.soundMuted = soundMuted;
    statusText = "Sound settings applied";
  }

  function soundTest() {
    /* Temporarily apply so the test uses current slider values */
    retroSound.setVolume(soundVolume / 100);
    retroSound.setMuted(soundMuted);
    retroSound.ding();
    statusText = "\u266A Ding!";
  }

  function soundOk() {
    soundApply();
    backToGrid();
  }

  function soundCancel() {
    soundVolume = desktopState.soundVolume;
    soundMuted = desktopState.soundMuted;
    backToGrid();
  }

  /* ------------------------------------------------------------------ */
  /* Mouse sub-panel state                                               */
  /* ------------------------------------------------------------------ */

  let mouseSpeed = $state(desktopState.doubleClickSpeed);

  const mouseSpeedLabel = $derived(
    mouseSpeed <= 300 ? "Fast" : mouseSpeed <= 600 ? "Medium" : "Slow"
  );

  function mouseApply() {
    desktopState.doubleClickSpeed = mouseSpeed;
    statusText = "Mouse settings applied";
  }

  function mouseOk() {
    mouseApply();
    backToGrid();
  }

  function mouseCancel() {
    mouseSpeed = desktopState.doubleClickSpeed;
    backToGrid();
  }

  /* ------------------------------------------------------------------ */
  /* Date/Time: live clock                                               */
  /* ------------------------------------------------------------------ */

  let currentTime = $state(new Date());

  $effect(() => {
    if (activePanel !== "datetime") return;
    const interval = setInterval(() => {
      currentTime = new Date();
    }, 1000);
    return () => clearInterval(interval);
  });

  const formattedDate = $derived(
    currentTime.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  const formattedTime = $derived(
    currentTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );

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
            onclick={() => openPanel(icon.id)}
          >
            <span class="icon-image" aria-hidden="true">{@html RETRO_ICONS[icon.iconName]}</span>
            <span class="icon-label">{icon.label}</span>
          </button>
        {/each}
      </div>

    <!-- ====================================================== -->
    <!-- Display sub-panel (tabbed: Effects / Background / Saver)-->
    <!-- ====================================================== -->
    {:else if activePanel === "display"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={displayCancel}>
            &#9668; Back
          </button>
          <span class="sub-panel-title">Display Properties</span>
        </div>

        <RetroTabControl tabs={DISPLAY_TABS} bind:activeTab={displayTab}>
          {#snippet children()}
            {#if displayTab === "effects"}
              <!-- CRT Effects -->
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
                  {#if displayScanlines || displayVignette || displayFlicker}
                    Active: {[
                      displayScanlines && "Scanlines",
                      displayVignette && "Vignette",
                      displayFlicker && "Flicker",
                    ].filter(Boolean).join(", ")}
                  {:else}
                    No CRT effects enabled
                  {/if}
                </div>
              </fieldset>

            {:else if displayTab === "background"}
              <!-- Desktop Color -->
              <fieldset class="sub-panel-group">
                <legend>Desktop Color</legend>
                <div class="color-grid">
                  {#each DESKTOP_COLORS as color}
                    <button
                      class="color-swatch"
                      class:selected={displayColor === color}
                      type="button"
                      style:background={color}
                      onclick={() => (displayColor = color)}
                      aria-label="Color {color}"
                    ></button>
                  {/each}
                </div>
              </fieldset>

              <fieldset class="sub-panel-group">
                <legend>Preview</legend>
                <div class="desktop-preview sunken-panel">
                  <div class="desktop-preview-inner" style:background={displayColor}>
                    <div class="preview-icon-dot"></div>
                    <div class="preview-icon-dot"></div>
                    <div class="preview-taskbar-dot"></div>
                  </div>
                </div>
              </fieldset>

            {:else if displayTab === "screensaver"}
              <!-- Screen Saver -->
              <fieldset class="sub-panel-group">
                <legend>Screen Saver</legend>
                <div class="saver-setting">
                  <span class="saver-label">Wait:</span>
                  <select
                    class="saver-select sunken-panel"
                    bind:value={displaySaverTimeout}
                  >
                    {#each SAVER_OPTIONS as opt}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                </div>
                <div class="saver-note">
                  Flying Props screensaver activates after the idle period.
                </div>
              </fieldset>
            {/if}
          {/snippet}
        </RetroTabControl>

        <div class="sub-panel-buttons">
          <RetroButton label="Apply" onclick={displayApply} />
          <RetroButton label="OK" isDefault={true} onclick={displayOk} />
          <RetroButton label="Cancel" onclick={displayCancel} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- Sound sub-panel                                         -->
    <!-- ====================================================== -->
    {:else if activePanel === "sound"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={soundCancel}>
            &#9668; Back
          </button>
          <span class="sub-panel-title">Sound</span>
        </div>

        <fieldset class="sub-panel-group">
          <legend>Volume</legend>
          <div class="volume-control">
            <span class="field-label">Level:</span>
            <div class="volume-input-group">
              <div class="volume-value sunken-panel">{soundVolume}</div>
              <div class="volume-buttons">
                <button
                  class="volume-arrow"
                  type="button"
                  onclick={soundVolumeUp}
                  aria-label="Volume up"
                >&#9650;</button>
                <button
                  class="volume-arrow"
                  type="button"
                  onclick={soundVolumeDown}
                  aria-label="Volume down"
                >&#9660;</button>
              </div>
            </div>
          </div>
          <div class="volume-bar-container">
            <div class="volume-bar-track sunken-panel">
              <div
                class="volume-bar-fill"
                style:width="{soundMuted ? 0 : soundVolume}%"
              ></div>
            </div>
            <div class="volume-bar-labels">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
          <div class="sound-mute">
            <RetroCheckbox label="Mute all sounds" bind:checked={soundMuted} />
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Events</legend>
          <div class="sound-events sunken-panel">
            <div class="event-row">&#9834; TKA-OS Start &mdash; startup.wav</div>
            <div class="event-row">&#9834; Default Beep &mdash; ding.wav</div>
            <div class="event-row">&#9834; Critical Stop &mdash; error.wav</div>
            <div class="event-row">&#9834; Menu Click &mdash; click.wav</div>
          </div>
        </fieldset>

        <div class="sub-panel-buttons">
          <RetroButton label="Test" onclick={soundTest} />
          <RetroButton label="Apply" onclick={soundApply} />
          <RetroButton label="OK" isDefault={true} onclick={soundOk} />
          <RetroButton label="Cancel" onclick={soundCancel} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- Mouse sub-panel                                         -->
    <!-- ====================================================== -->
    {:else if activePanel === "mouse"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={mouseCancel}>
            &#9668; Back
          </button>
          <span class="sub-panel-title">Mouse Properties</span>
        </div>

        <fieldset class="sub-panel-group">
          <legend>Double-Click Speed</legend>
          <div class="slider-row">
            <span class="field-label">Slow</span>
            <input
              class="retro-range"
              type="range"
              min="200"
              max="900"
              step="50"
              bind:value={mouseSpeed}
            />
            <span class="field-label">Fast</span>
          </div>
          <div class="slider-value">
            {mouseSpeed}ms ({mouseSpeedLabel})
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Test Area</legend>
          <div class="dblclick-test sunken-panel">
            <button
              class="dblclick-target"
              type="button"
              ondblclick={() => {
                retroSound.ding();
                statusText = "Double-click registered!";
              }}
            >
              <span class="test-icon" aria-hidden="true">{@html RETRO_ICONS.props}</span>
              <span>Double-click here to test</span>
            </button>
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Pointer Trail</legend>
          <div class="trail-display">
            &#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617; Enabled (3 ghosts)
          </div>
        </fieldset>

        <div class="sub-panel-buttons">
          <RetroButton label="Apply" onclick={mouseApply} />
          <RetroButton label="OK" isDefault={true} onclick={mouseOk} />
          <RetroButton label="Cancel" onclick={mouseCancel} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- Date/Time sub-panel (live clock)                        -->
    <!-- ====================================================== -->
    {:else if activePanel === "datetime"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            &#9668; Back
          </button>
          <span class="sub-panel-title">Date/Time Properties</span>
        </div>

        <fieldset class="sub-panel-group">
          <legend>Date</legend>
          <div class="datetime-display sunken-panel">
            {formattedDate}
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Time</legend>
          <div class="time-display sunken-panel">
            <span class="time-digits">{formattedTime}</span>
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Time Zone</legend>
          <div class="timezone-display sunken-panel">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
            (Bellweather HQ)
          </div>
        </fieldset>

        <div class="sub-panel-buttons">
          <RetroButton label="OK" isDefault={true} onclick={backToGrid} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- About sub-panel                                         -->
    <!-- ====================================================== -->
    {:else if activePanel === "about"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            &#9668; Back
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
    <!-- Keyboard sub-panel (TKA key layout)                     -->
    <!-- ====================================================== -->
    {:else if activePanel === "keyboard"}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            &#9668; Back
          </button>
          <span class="sub-panel-title">Keyboard Properties</span>
        </div>

        <fieldset class="sub-panel-group">
          <legend>Number Row &rarr; Greek Letters</legend>
          <div class="keycap-row">
            <div class="keycap"><span class="keycap-key">1</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Sigma;</span></div>
            <div class="keycap"><span class="keycap-key">2</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Delta;</span></div>
            <div class="keycap"><span class="keycap-key">3</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Theta;</span></div>
            <div class="keycap"><span class="keycap-key">4</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Omega;</span></div>
            <div class="keycap"><span class="keycap-key">5</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Phi;</span></div>
            <div class="keycap"><span class="keycap-key">6</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Psi;</span></div>
            <div class="keycap"><span class="keycap-key">7</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&Lambda;</span></div>
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Numpad &rarr; Position Letters</legend>
          <div class="keycap-grid">
            <div class="keycap"><span class="keycap-key">Num1</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&alpha;</span></div>
            <div class="keycap"><span class="keycap-key">Num2</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&beta;</span></div>
            <div class="keycap"><span class="keycap-key">Num3</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&gamma;</span></div>
            <div class="keycap"><span class="keycap-key">Num4</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&zeta;</span></div>
            <div class="keycap"><span class="keycap-key">Num5</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&eta;</span></div>
            <div class="keycap"><span class="keycap-key">Num6</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&tau;</span></div>
            <div class="keycap"><span class="keycap-key">Num7</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">&#8853;</span></div>
          </div>
          <div class="numpad-note">
            <span class="keycap keycap-wide"><span class="keycap-key">Num&minus;</span><span class="keycap-arrow">&rarr;</span><span class="keycap-symbol">-</span></span>
            Dash suffix (e.g. &Sigma; then Num&minus; &rarr; &Sigma;-)
          </div>
        </fieldset>

        <div class="keyboard-footer sunken-panel">
          <div>Repeat rate: &#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9617;&#9617;&#9617; Fast</div>
          <div class="stub-spacer"></div>
          <span class="stub-note">Keyboard type: Enhanced 101-key (TKA layout)</span>
        </div>

        <div class="sub-panel-buttons">
          <RetroButton label="OK" isDefault={true} onclick={backToGrid} />
        </div>
      </div>

    <!-- ====================================================== -->
    <!-- Themed stub sub-panels                                  -->
    <!-- ====================================================== -->
    {:else}
      <div class="sub-panel">
        <div class="sub-panel-header">
          <button class="back-btn" type="button" onclick={backToGrid}>
            &#9668; Back
          </button>
          <span class="sub-panel-title">
            {ICONS.find((i) => i.id === activePanel)?.label ?? ""}
          </span>
        </div>

        <div class="simple-message sunken-panel">
          {#if activePanel === "props"}
            <div class="stub-header">Prop Configuration</div>
            <div class="stub-spacer"></div>
            Detected props: Double Staves (2)
            <div class="stub-spacer"></div>
            Other prop types are not yet supported by TKA-OS.
            Contact the Bellweather Technical Institute for driver updates.
            <div class="stub-spacer"></div>
            <span class="stub-note">Driver: STAVES.SYS v1.0 (1995-03-15)</span>
          {:else if activePanel === "printers"}
            <div class="stub-header">Printers</div>
            <div class="stub-spacer"></div>
            No printers installed.
            <div class="stub-spacer"></div>
            TKA-OS supports LPT1 and LPT2 parallel ports only.
            Pictograph printing requires BTI Notation Printer v2.0 or later.
            <div class="stub-spacer"></div>
            <span class="stub-note">Contact your local BTI office for procurement.</span>
          {:else if activePanel === "network"}
            <div class="stub-header">Network Configuration</div>
            <div class="stub-spacer"></div>
            TKA-NET v0.1 — Status: Not Connected
            <div class="stub-spacer"></div>
            The TKA-NET protocol operates on a classified frequency.
            Connection requires Level 3 clearance from the Order.
            <div class="stub-spacer"></div>
            <span class="stub-note">Contact: sysadmin@bellweather.bti (internal only)</span>
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

  .field-label {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  /* ------------------------------------------------------------------ */
  /* Display: CRT Effects                                                */
  /* ------------------------------------------------------------------ */
  .checkbox-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-area {
    padding: 8px;
    min-height: 28px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    background: var(--retro-field-bg, #fff);
  }

  /* ------------------------------------------------------------------ */
  /* Display: Background color grid                                      */
  /* ------------------------------------------------------------------ */
  .color-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 2px;
    padding: 4px;
  }

  .color-swatch {
    width: 100%;
    aspect-ratio: 1;
    border: 2px solid var(--retro-button-face, #c0c0c0);
    cursor: default;
    padding: 0;
    min-width: 14px;
    min-height: 14px;
  }

  .color-swatch.selected {
    border: 2px solid var(--retro-black, #000);
    outline: 1px solid var(--retro-white, #fff);
    outline-offset: -3px;
  }

  .color-swatch:hover:not(.selected) {
    border-color: var(--retro-dark-gray, #808080);
  }

  .desktop-preview {
    padding: 4px;
    background: var(--retro-field-bg, #fff);
    min-height: 60px;
  }

  .desktop-preview-inner {
    position: relative;
    height: 50px;
    border: 1px solid var(--retro-black, #000);
  }

  .preview-icon-dot {
    position: absolute;
    width: 4px;
    height: 4px;
    background: var(--retro-white, #fff);
    left: 3px;
  }

  .preview-icon-dot:first-child {
    top: 4px;
  }

  .preview-icon-dot:nth-child(2) {
    top: 12px;
  }

  .preview-taskbar-dot {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: var(--retro-button-face, #c0c0c0);
    border-top: 1px solid var(--retro-dark-gray, #808080);
  }

  /* ------------------------------------------------------------------ */
  /* Display: Screen Saver                                               */
  /* ------------------------------------------------------------------ */
  .saver-setting {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .saver-label {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .saver-select {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    padding: 2px 4px;
    background: var(--retro-field-bg, #fff);
    color: var(--retro-black, #000);
    border: none;
    cursor: default;
  }

  .saver-note {
    font-size: 10px;
    color: var(--retro-dark-gray, #808080);
    font-style: italic;
  }

  /* ------------------------------------------------------------------ */
  /* Sound sub-panel                                                     */
  /* ------------------------------------------------------------------ */
  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
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

  .volume-bar-container {
    margin-top: 6px;
  }

  .volume-bar-track {
    height: 10px;
    background: var(--retro-field-bg, #fff);
    position: relative;
    overflow: hidden;
  }

  .volume-bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background: var(--retro-navy, #000080);
  }

  .volume-bar-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--retro-dark-gray, #808080);
    margin-top: 2px;
  }

  .sound-mute {
    margin-top: 8px;
  }

  .sound-events {
    padding: 4px;
    background: var(--retro-field-bg, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .event-row {
    padding: 2px 4px;
    line-height: 1.6;
  }

  /* ------------------------------------------------------------------ */
  /* Mouse sub-panel                                                     */
  /* ------------------------------------------------------------------ */
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .retro-range {
    flex: 1;
    cursor: default;
    accent-color: var(--retro-navy, #000080);
  }

  .slider-value {
    text-align: center;
    margin-top: 4px;
    font-size: 10px;
    color: var(--retro-dark-gray, #808080);
  }

  .dblclick-test {
    padding: 8px;
    background: var(--retro-field-bg, #fff);
    display: flex;
    justify-content: center;
  }

  .dblclick-target {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    background: none;
    border: 1px solid transparent;
    cursor: default;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .dblclick-target:hover {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }

  .test-icon {
    display: flex;
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }

  .test-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .trail-display {
    font-family: var(--retro-font-mono, "Fixedsys", monospace);
    font-size: 10px;
    color: var(--retro-dark-gray, #808080);
  }

  /* ------------------------------------------------------------------ */
  /* Date/Time sub-panel                                                 */
  /* ------------------------------------------------------------------ */
  .datetime-display {
    padding: 8px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    background: var(--retro-field-bg, #fff);
  }

  .time-display {
    padding: 8px;
    text-align: center;
    background: var(--retro-field-bg, #fff);
  }

  .time-digits {
    font-family: var(--retro-font-mono, "Fixedsys", monospace);
    font-size: 18px;
    color: var(--retro-black, #000);
    letter-spacing: 2px;
  }

  .timezone-display {
    padding: 8px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    background: var(--retro-field-bg, #fff);
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
  /* Stub sub-panels                                                     */
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

  .stub-header {
    font-weight: bold;
    font-size: 12px;
  }

  .stub-spacer {
    height: 6px;
  }

  .stub-note {
    font-size: 10px;
    color: var(--retro-dark-gray, #808080);
    font-style: italic;
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard sub-panel                                                  */
  /* ------------------------------------------------------------------ */
  .keycap-row {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .keycap-grid {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 3px;
    justify-content: start;
  }

  .keycap {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 3px 5px;
    background: var(--retro-button-face, #c0c0c0);
    border: 1px solid;
    border-color:
      var(--retro-white, #fff)
      var(--retro-button-shadow, #808080)
      var(--retro-button-shadow, #808080)
      var(--retro-white, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: 10px;
    color: var(--retro-black, #000);
    white-space: nowrap;
  }

  .keycap-wide {
    padding: 3px 8px;
  }

  .keycap-key {
    font-weight: bold;
    font-size: 10px;
  }

  .keycap-arrow {
    color: var(--retro-dark-gray, #808080);
    font-size: 9px;
  }

  .keycap-symbol {
    font-weight: bold;
    font-size: 11px;
    color: var(--retro-navy, #000080);
  }

  .numpad-note {
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

  .keyboard-footer {
    padding: 8px;
    background: var(--retro-field-bg, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }
</style>
