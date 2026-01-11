<!--
AssemblerTab.svelte - Wrapper for simplified hand path assembly

Integrates HandPathOrchestrator with the Create module's workspace.
Handles real-time workspace updates and sequence completion.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import HandPathOrchestrator, {
    type AssemblyUndoRef,
    type AssemblyBackRef,
  } from "./HandPathOrchestrator.svelte";

  let {
    onSequenceUpdate,
    onSequenceComplete,
    onHeaderTextChange,
    onStartPositionSet,
    onClearSequence,
    initialGridMode,
    hasExistingSequence = false,
    existingStartPositionBeat = null,
    existingBeats = [],
    // Bindable undo ref for workspace integration
    undoRef = $bindable(),
    // Bindable back ref for workspace back button
    backRef = $bindable(),
  } = $props<{
    onSequenceUpdate?: (sequence: PictographData[]) => void;
    onSequenceComplete?: (sequence: PictographData[]) => void;
    onHeaderTextChange?: (text: string) => void;
    onStartPositionSet?: (startPosition: PictographData) => void;
    onClearSequence?: () => void;
    initialGridMode?: GridMode;
    hasExistingSequence?: boolean;
    existingStartPositionBeat?: PictographData | null;
    existingBeats?: PictographData[];
    // Bindable undo ref for workspace integration
    undoRef?: AssemblyUndoRef | null;
    // Bindable back ref for workspace back button
    backRef?: AssemblyBackRef | null;
  }>();

  // Handle sequence updates (during building)
  function handleSequenceUpdate(sequence: PictographData[]) {
    onSequenceUpdate?.(sequence);
  }

  // Handle sequence completion
  function handleSequenceComplete(sequence: PictographData[]) {
    onSequenceComplete?.(sequence);
  }

  // Handle start position set
  function handleStartPositionSet(startPosition: PictographData) {
    onStartPositionSet?.(startPosition);
  }
</script>

<div class="assembler-tab">
  <HandPathOrchestrator
    {initialGridMode}
    {hasExistingSequence}
    {existingStartPositionBeat}
    {existingBeats}
    onSequenceUpdate={handleSequenceUpdate}
    onSequenceComplete={handleSequenceComplete}
    onStartPositionSet={handleStartPositionSet}
    {onHeaderTextChange}
    {onClearSequence}
    bind:undoRef
    bind:backRef
  />
</div>

<style>
  .assembler-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    width: 100%;
  }
</style>
