<!--
  Date/Time Properties sub-panel - live clock display.
-->
<script lang="ts">
  import RetroButton from "../../../primitives/RetroButton.svelte";

  let {
    onback,
  }: {
    onback: () => void;
  } = $props();

  let currentTime = $state(new Date());

  $effect(() => {
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
</script>

<div class="sub-panel">
  <div class="sub-panel-header">
    <button class="back-btn" type="button" onclick={onback}>
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
    <RetroButton label="OK" isDefault={true} onclick={onback} />
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
</style>
