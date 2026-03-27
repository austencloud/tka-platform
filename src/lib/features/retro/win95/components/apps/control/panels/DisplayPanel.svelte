<!--
  Display Properties sub-panel — CRT effects, desktop color, screen saver.
  Tabbed layout mirroring Win95 Display Properties.
-->
<script lang="ts">
  import RetroButton from "../../../primitives/RetroButton.svelte";
  import RetroCheckbox from "../../../primitives/RetroCheckbox.svelte";
  import RetroTabControl from "../../../primitives/RetroTabControl.svelte";
  import { desktopState } from "../../../../state/desktop-state.svelte";
  import { saveRetroSettings } from "../../../../adapters/settings-adapter";

  let {
    onback,
    onstatuschange,
  }: {
    onback: () => void;
    onstatuschange: (text: string) => void;
  } = $props();

  let displayTab = $state("effects");
  let scanlines = $state(desktopState.crtScanlines);
  let vignette = $state(desktopState.crtVignette);
  let flicker = $state(desktopState.crtFlicker);
  let color = $state(desktopState.desktopColor);
  let saverTimeout = $state(desktopState.screensaverTimeout);

  const TABS = [
    { id: "effects", label: "Effects" },
    { id: "background", label: "Background" },
    { id: "screensaver", label: "Screen Saver" },
  ];

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

  function apply() {
    desktopState.crtScanlines = scanlines;
    desktopState.crtVignette = vignette;
    desktopState.crtFlicker = flicker;
    desktopState.desktopColor = color;
    desktopState.screensaverTimeout = saverTimeout;
    saveRetroSettings({
      retroCrtScanlines: scanlines,
      retroCrtVignette: vignette,
      retroCrtFlicker: flicker,
      retroDesktopColor: color,
      retroScreensaverTimeout: saverTimeout,
    });
    onstatuschange("Display settings applied");
  }

  function ok() {
    apply();
    onback();
  }

  function cancel() {
    scanlines = desktopState.crtScanlines;
    vignette = desktopState.crtVignette;
    flicker = desktopState.crtFlicker;
    color = desktopState.desktopColor;
    saverTimeout = desktopState.screensaverTimeout;
    onback();
  }
</script>

<div class="sub-panel">
  <div class="sub-panel-header">
    <button class="back-btn" type="button" onclick={cancel}>
      &#9668; Back
    </button>
    <span class="sub-panel-title">Display Properties</span>
  </div>

  <RetroTabControl tabs={TABS} bind:activeTab={displayTab}>
    {#snippet children()}
      {#if displayTab === "effects"}
        <fieldset class="sub-panel-group">
          <legend>CRT Effects</legend>
          <div class="checkbox-stack">
            <RetroCheckbox label="Scanlines" bind:checked={scanlines} />
            <RetroCheckbox label="Vignette" bind:checked={vignette} />
            <RetroCheckbox label="Flicker" bind:checked={flicker} />
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Preview</legend>
          <div class="preview-area sunken-panel">
            {#if scanlines || vignette || flicker}
              Active: {[
                scanlines && "Scanlines",
                vignette && "Vignette",
                flicker && "Flicker",
              ].filter(Boolean).join(", ")}
            {:else}
              No CRT effects enabled
            {/if}
          </div>
        </fieldset>

      {:else if displayTab === "background"}
        <fieldset class="sub-panel-group">
          <legend>Desktop Color</legend>
          <div class="color-grid">
            {#each DESKTOP_COLORS as c}
              <button
                class="color-swatch"
                class:selected={color === c}
                type="button"
                style:background={c}
                onclick={() => (color = c)}
                aria-label="Color {c}"
              ></button>
            {/each}
          </div>
        </fieldset>

        <fieldset class="sub-panel-group">
          <legend>Preview</legend>
          <div class="desktop-preview sunken-panel">
            <div class="desktop-preview-inner" style:background={color}>
              <div class="preview-icon-dot"></div>
              <div class="preview-icon-dot"></div>
              <div class="preview-taskbar-dot"></div>
            </div>
          </div>
        </fieldset>

      {:else if displayTab === "screensaver"}
        <fieldset class="sub-panel-group">
          <legend>Screen Saver</legend>
          <div class="saver-setting">
            <span class="saver-label">Wait:</span>
            <select
              class="saver-select sunken-panel"
              bind:value={saverTimeout}
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
    <RetroButton label="Apply" onclick={apply} />
    <RetroButton label="OK" isDefault={true} onclick={ok} />
    <RetroButton label="Cancel" onclick={cancel} />
  </div>
</div>

<style>
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
</style>
