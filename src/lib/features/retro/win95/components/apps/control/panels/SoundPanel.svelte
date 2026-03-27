<!--
  Sound sub-panel — volume control, mute, event list, test button.
-->
<script lang="ts">
  import RetroButton from "../../../primitives/RetroButton.svelte";
  import RetroCheckbox from "../../../primitives/RetroCheckbox.svelte";
  import { desktopState } from "../../../../state/desktop-state.svelte";
  import { retroSound } from "../../../../state/retro-sound";
  import { saveRetroSettings } from "../../../../adapters/settings-adapter";

  let {
    onback,
    onstatuschange,
  }: {
    onback: () => void;
    onstatuschange: (text: string) => void;
  } = $props();

  let volume = $state(desktopState.soundVolume);
  let muted = $state(desktopState.soundMuted);

  function volumeUp() {
    volume = Math.min(100, volume + 5);
  }

  function volumeDown() {
    volume = Math.max(0, volume - 5);
  }

  function apply() {
    desktopState.soundVolume = volume;
    desktopState.soundMuted = muted;
    retroSound.setVolume(volume / 100);
    retroSound.setMuted(muted);
    saveRetroSettings({
      retroSoundVolume: volume,
      retroSoundMuted: muted,
    });
    onstatuschange("Sound settings applied");
  }

  function test() {
    retroSound.setVolume(volume / 100);
    retroSound.setMuted(muted);
    retroSound.ding();
    onstatuschange("\u266A Ding!");
  }

  function ok() {
    apply();
    onback();
  }

  function cancel() {
    volume = desktopState.soundVolume;
    muted = desktopState.soundMuted;
    onback();
  }
</script>

<div class="sub-panel">
  <div class="sub-panel-header">
    <button class="back-btn" type="button" onclick={cancel}>
      &#9668; Back
    </button>
    <span class="sub-panel-title">Sound</span>
  </div>

  <fieldset class="sub-panel-group">
    <legend>Volume</legend>
    <div class="volume-control">
      <span class="field-label">Level:</span>
      <div class="volume-input-group">
        <div class="volume-value sunken-panel">{volume}</div>
        <div class="volume-buttons">
          <button
            class="volume-arrow"
            type="button"
            onclick={volumeUp}
            aria-label="Volume up"
          >&#9650;</button>
          <button
            class="volume-arrow"
            type="button"
            onclick={volumeDown}
            aria-label="Volume down"
          >&#9660;</button>
        </div>
      </div>
    </div>
    <div class="volume-bar-container">
      <div class="volume-bar-track sunken-panel">
        <div
          class="volume-bar-fill"
          style:width="{muted ? 0 : volume}%"
        ></div>
      </div>
      <div class="volume-bar-labels">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
    <div class="sound-mute">
      <RetroCheckbox label="Mute all sounds" bind:checked={muted} />
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
    <RetroButton label="Test" onclick={test} />
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
</style>
