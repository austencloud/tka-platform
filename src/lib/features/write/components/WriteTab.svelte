<!--
  WriteTab.svelte — the Choreo Sheet module.

  Single purpose: build a printable choreography sheet. (The old Act playlist
  editor was retired here — the module is now just the choreo-sheet builder,
  which owns its own state and auto-persists across reload/HMR.)
-->
<script lang="ts">
  import ChoreoSheetView from "./sheet/ChoreoSheetView.svelte";
</script>

<div class="write-tab">
  <ChoreoSheetView />
</div>

<style>
  .write-tab {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
    padding: var(--spacing-sm);
    box-sizing: border-box;
  }

  .write-tab > :global(.choreo-sheet-view) {
    flex: 1;
    min-height: 0;
  }
</style>
