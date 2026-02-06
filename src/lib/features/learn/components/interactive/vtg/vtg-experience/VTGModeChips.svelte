<!--
VTGModeChips - Preview chips showing all 6 VTG modes
-->
<script lang="ts">
  import {
    VTG_MODES,
    VTG_MODE_INFO,
  } from "../../../../domain/constants/vtg-experience-data";
</script>

<div class="mode-preview">
  <h3>The 6 VTG Modes</h3>
  <div class="mode-chips">
    {#each VTG_MODES as vtgMode}
      {@const info = VTG_MODE_INFO[vtgMode]}
      <div class="mode-chip" style="--chip-color: {info.color}">
        <span class="chip-code">{vtgMode}</span>
        <span class="chip-name">{info.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .mode-preview {
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .mode-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
    justify-content: center;
  }

  .mode-chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: color-mix(in srgb, var(--chip-color) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--chip-color) 30%, transparent);
    border-radius: 16px;
  }

  .chip-code {
    font-family: monospace;
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--chip-color);
  }

  .chip-name {
    font-size: 0.6875rem;
    color: var(--chip-color);
    opacity: 0.8;
  }
</style>
