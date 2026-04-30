<!--
  Themed stub sub-panel - Props, Printers, Network flavor text.
-->
<script lang="ts">
  import RetroButton from "../../../primitives/RetroButton.svelte";

  let {
    panelId,
    label,
    onback,
  }: {
    panelId: "props" | "printers" | "network";
    label: string;
    onback: () => void;
  } = $props();
</script>

<div class="sub-panel">
  <div class="sub-panel-header">
    <button class="back-btn" type="button" onclick={onback}>
      &#9668; Back
    </button>
    <span class="sub-panel-title">{label}</span>
  </div>

  <div class="simple-message sunken-panel">
    {#if panelId === "props"}
      <div class="stub-header">Prop Configuration</div>
      <div class="stub-spacer"></div>
      Detected props: Double Staves (2)
      <div class="stub-spacer"></div>
      Other prop types are not yet supported by TKA-OS.
      Contact the Bellweather Technical Institute for driver updates.
      <div class="stub-spacer"></div>
      <span class="stub-note">Driver: STAVES.SYS v1.0 (1995-03-15)</span>
    {:else if panelId === "printers"}
      <div class="stub-header">Printers</div>
      <div class="stub-spacer"></div>
      No printers installed.
      <div class="stub-spacer"></div>
      TKA-OS supports LPT1 and LPT2 parallel ports only.
      Pictograph printing requires BTI Notation Printer v2.0 or later.
      <div class="stub-spacer"></div>
      <span class="stub-note">Contact your local BTI office for procurement.</span>
    {:else if panelId === "network"}
      <div class="stub-header">Network Configuration</div>
      <div class="stub-spacer"></div>
      TKA-NET v0.1 - Status: Not Connected
      <div class="stub-spacer"></div>
      The TKA-NET protocol operates on a classified frequency.
      Connection requires Level 3 clearance from the Order.
      <div class="stub-spacer"></div>
      <span class="stub-note">Contact: sysadmin@bellweather.bti (internal only)</span>
    {/if}
  </div>

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

  .sub-panel-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    padding-top: 4px;
  }

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
</style>
