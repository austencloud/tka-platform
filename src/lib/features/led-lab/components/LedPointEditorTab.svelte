<!--
  LedPointEditorTab.svelte

  Orchestrator: composes LedPropTypeSelector + LedPointSvgCanvas + LedPointListPanel.
  Creates and manages the editor state, wires keyboard shortcuts.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { LedPointEditorState } from "../state/led-point-editor-state.svelte";
  import type { ILedPointOverrideProvider } from "../services/contracts/ILedPointOverrideProvider";
  import LedPropTypeSelector from "./LedPropTypeSelector.svelte";
  import LedPointSvgCanvas from "./LedPointSvgCanvas.svelte";
  import LedPointListPanel from "./LedPointListPanel.svelte";

  const provider = container.items.ledPointOverrideProvider as ILedPointOverrideProvider;
  const editorState = new LedPointEditorState(provider);

  function handleKeyDown(e: KeyboardEvent) {
    // Ctrl+Z / Cmd+Z: undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      editorState.undo();
      return;
    }
    // Delete / Backspace: delete selected point
    if ((e.key === "Delete" || e.key === "Backspace") && editorState.selectedPointIndex >= 0) {
      // Only if not focused on an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      editorState.deletePoint(editorState.selectedPointIndex);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div class="editor-tab">
  <LedPropTypeSelector {editorState} />

  <div class="editor-content">
    <LedPointSvgCanvas {editorState} />
    <div class="list-panel-wrapper">
      <LedPointListPanel {editorState} />
    </div>
  </div>
</div>

<style>
  .editor-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .editor-content {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: var(--spacing-md, 16px);
    padding: var(--spacing-md, 16px);
    min-height: 0;
    overflow: hidden;
  }

  .list-panel-wrapper {
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 900px) {
    .editor-content {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }
  }
</style>
