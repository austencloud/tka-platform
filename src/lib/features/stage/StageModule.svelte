<script lang="ts">
  import StageEditorPanel from "./components/StageEditorPanel.svelte";
  import { getStageChoreographyState } from "./state/stage-choreography-state.svelte";

  getStageChoreographyState();
</script>

<div class="stage-module">
  <StageEditorPanel />
</div>

<style>
  .stage-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-bg-primary, #0f0f1a);
  }
</style>
