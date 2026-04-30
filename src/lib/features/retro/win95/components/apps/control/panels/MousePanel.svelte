<!--
  Mouse Properties sub-panel - double-click speed, test area, pointer trail.
-->
<script lang="ts">
  import RetroButton from "../../../primitives/RetroButton.svelte";
  import { RETRO_ICONS } from "../../../rendering/retro-icons";
  import { desktopState } from "../../../../state/desktop-state.svelte";
  import { retroSound } from "../../../../state/retro-sound";

  let {
    onback,
    onstatuschange,
  }: {
    onback: () => void;
    onstatuschange: (text: string) => void;
  } = $props();

  let speed = $state(desktopState.doubleClickSpeed);

  const speedLabel = $derived(
    speed <= 300 ? "Fast" : speed <= 600 ? "Medium" : "Slow"
  );

  function apply() {
    desktopState.doubleClickSpeed = speed;
    onstatuschange("Mouse settings applied");
  }

  function ok() {
    apply();
    onback();
  }

  function cancel() {
    speed = desktopState.doubleClickSpeed;
    onback();
  }
</script>

<div class="sub-panel">
  <div class="sub-panel-header">
    <button class="back-btn" type="button" onclick={cancel}>
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
        bind:value={speed}
      />
      <span class="field-label">Fast</span>
    </div>
    <div class="slider-value">
      {speed}ms ({speedLabel})
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
          onstatuschange("Double-click registered!");
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

  .field-label {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
  }

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
</style>
