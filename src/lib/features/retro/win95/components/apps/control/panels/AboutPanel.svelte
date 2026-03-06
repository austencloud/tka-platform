<!--
  About TKA-OS sub-panel — system lore and stats.
-->
<script lang="ts">
  import RetroButton from "../../../primitives/RetroButton.svelte";

  let {
    onback,
  }: {
    onback: () => void;
  } = $props();
</script>

<div class="sub-panel">
  <div class="sub-panel-header">
    <button class="back-btn" type="button" onclick={onback}>
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
</style>
