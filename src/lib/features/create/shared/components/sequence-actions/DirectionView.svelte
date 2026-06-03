<!--
  DirectionView.svelte

  Folds the two prop-spin interfaces into one Direction drawer:
  - Reversals (default): relative reverse-on/off pattern strip (the native TKA
    vocabulary — Book / Alternating / Solo, the colored-dot readout).
  - Direction: absolute cw/ccw per beat (the existing rotation-direction Apply /
    Save / templates / saved patterns).
  Both act on the same axis (prop spin); this is the single destination for it.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import ReversalPatternView from "./ReversalPatternView.svelte";
  import RotationDirectionView from "./RotationDirectionView.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { TargetHand } from "../../state/panel-coordination-state.svelte";

  interface Props {
    sequence: SequenceData | null;
    targetHand: TargetHand;
    onReversalApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
    onRotationApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
  }

  let { sequence, targetHand, onReversalApply, onRotationApply }: Props = $props();

  let mode = $state<"reversals" | "absolute">("reversals");
</script>

<div class="direction-view">
  <div class="mode-wrap">
    <SegmentedControl
      size="md"
      color="accent"
      options={[
        { value: "reversals", label: "Reversals" },
        { value: "absolute", label: "Direction" },
      ]}
      value={mode}
      onchange={(v) => (mode = v as "reversals" | "absolute")}
    />
  </div>

  {#if mode === "reversals"}
    <ReversalPatternView {sequence} onApply={onReversalApply} />
  {:else}
    <RotationDirectionView {sequence} {targetHand} onApply={onRotationApply} />
  {/if}
</div>

<style>
  .direction-view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .mode-wrap {
    flex-shrink: 0;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }
</style>
