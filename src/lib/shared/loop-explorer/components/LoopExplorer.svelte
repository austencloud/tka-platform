<!-- src/lib/shared/loop-explorer/components/LoopExplorer.svelte
  Composes the picker + showcase + explanation pane and owns the shared
  loop-explorer-state (factory + context per state-management skill — set
  once here, consumed by any descendant). Desktop: sticky picker header over
  a two-pane grid (showcase | explanation). Mobile (<768, the shared
  breakpoint per sequence-viewer-shell.md/no new breakpoints): single column,
  picker -> grid -> explanation stack. Container query on the wrapper, not a
  viewport media query, so this drops into any host width (page section,
  future embed) correctly. -->
<script lang="ts">
  import { onMount } from "svelte";
  import LoopComponentPicker from "./LoopComponentPicker.svelte";
  import ExplorerShowcase from "./ExplorerShowcase.svelte";
  import ExplanationPane from "./ExplanationPane.svelte";
  import { createLoopExplorerState, setLoopExplorerContext } from "../state/loop-explorer-state.svelte";

  const state = createLoopExplorerState();
  setLoopExplorerContext(state);

  onMount(() => {
    void state.refresh();
  });
</script>

<div class="loop-explorer">
  <div class="picker-header">
    <LoopComponentPicker />
  </div>

  <div class="body">
    <ExplorerShowcase />
    <ExplanationPane />
  </div>
</div>

<style>
  .loop-explorer {
    container-type: inline-size;
    container-name: loop-explorer;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }

  .picker-header {
    position: sticky;
    top: 0;
    z-index: 6;
    padding: 0.75rem;
    border-radius: 16px;
    background: var(--theme-panel-bg, rgba(10, 12, 18, 0.85));
    backdrop-filter: blur(10px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* Mobile default: single column, grid -> explanation stack under the picker. */
  .body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
  }

  /* Desktop: two-pane once the explorer itself has room (matches the shared
     768px breakpoint via container width rather than viewport width). */
  @container loop-explorer (min-width: 768px) {
    .body {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      align-items: start;
      gap: 1.75rem;
    }
  }
</style>
