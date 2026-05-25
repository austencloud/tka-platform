<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import StageEditorPanel from "./components/StageEditorPanel.svelte";
  import Stage3DPreview from "./components/Stage3DPreview.svelte";
  import { getStageChoreographyState } from "./state/stage-choreography-state.svelte";

  const state = getStageChoreographyState();

  let activeView = $state<"editor" | "preview">("editor");

  $effect(() => {
    const tab = navigationState.activeTab;
    if (tab === "editor" || tab === "preview") {
      activeView = tab;
    }
  });
</script>

<div class="stage-module">
  {#if activeView === "editor"}
    <StageEditorPanel />
  {:else}
    <Stage3DPreview />
  {/if}
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
