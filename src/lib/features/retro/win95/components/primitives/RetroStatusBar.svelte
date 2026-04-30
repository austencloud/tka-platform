<!--
  RetroStatusBar - Bottom bar with sunken inset panels

  Renders a row of sunken (inset border) panels at the bottom of a window.
  The last panel takes remaining width if no explicit width is specified.
  Uses 98.css's sunken-panel class for the authentic Win95 status bar look.
-->
<script lang="ts">
  let {
    panels,
  }: {
    panels: { text: string; width?: string }[];
  } = $props();
</script>

<div class="retro-status-bar" role="status">
  {#each panels as panel, i (i)}
    <div
      class="retro-status-panel sunken-panel"
      class:flex-fill={!panel.width && i === panels.length - 1}
      style={panel.width ? `width: ${panel.width};` : ""}
    >
      {panel.text}
    </div>
  {/each}
</div>

<style>
  .retro-status-bar {
    display: flex;
    align-items: stretch;
    gap: 2px;
    padding: var(--retro-padding-sm, 2px);
    background: var(--retro-button-face, #c0c0c0);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    user-select: none;
  }

  .retro-status-panel {
    padding: 1px var(--retro-padding-md, 4px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }

  .retro-status-panel.flex-fill {
    flex: 1;
    flex-shrink: 1;
  }
</style>
