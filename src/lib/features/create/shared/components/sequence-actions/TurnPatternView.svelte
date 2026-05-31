<!--
  TurnPatternView.svelte

  Chrome-free turn-pattern editor body, rendered INLINE inside the Sequence
  Actions panel as a drill-down view (no Drawer wrapper). The strip is the
  source of truth: Length × Rhythm × Amount edits a 2-lane (blue/red) turn
  strip, which Apply converts to a TurnPattern and runs through the proven
  turn-pattern-manager.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import { stampPerHand } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { stripToTurnPattern } from "../../domain/pattern-strip-apply";
  import * as turnPatternManager from "$lib/shared/create/services/turn-pattern-manager";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    sequence: SequenceData | null;
    onApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
  }

  let { sequence, onApply }: Props = $props();

  const TURN_VALUES: StripValue[] = [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"];
  const fmtTurn = (v: StripValue) => (v === "fl" ? "fl" : String(v));
  const binding: StripBinding = {
    lanes: 2,
    rhythms: PER_HAND_RHYTHMS,
    valueList: TURN_VALUES,
    amountList: [0.5, 1, 1.5, 2, 2.5, 3],
    base: 0,
    format: fmtTurn,
    laneColors: ["blue", "red"],
    // Labels match the APPLY TO / HandSelector convention (blue=Left, red=Right);
    // colour coding stays via laneColors.
    laneLabels: ["Left", "Right"],
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1);

  let strip = $state<StripValue[][]>([
    [0, 1],
    [1, 0],
  ]);

  // Seed once when the view mounts (entering the drill-down). Re-mounts on each
  // entry, so edits are not clobbered by sequence-length changes while open.
  onMount(() => {
    const alt = stampPerHand(PER_HAND_RHYTHMS[2]!, initPeriod, 1, 1, 0); // alternating x1
    strip = [alt.blue, alt.red];
  });

  function applyStrip() {
    if (!sequence) return;
    const pattern = stripToTurnPattern(
      strip[0]!,
      strip[1]!,
      sequence.steps.length
    );
    const result = turnPatternManager.applyPattern(pattern, sequence, "both");
    if (result.success && result.sequence) {
      onApply({ sequence: result.sequence, warnings: result.warnings });
    }
  }
</script>

<div class="pattern-view-body">
  <div class="pattern-view-inner">
    <PatternStripEditor
      {binding}
      sequenceLength={seqLen}
      value={strip}
      onChange={(v) => (strip = v)}
    />
    <button class="apply-btn turn" onclick={applyStrip} disabled={!sequence}>
      Apply to sequence
    </button>
  </div>
</div>

<style>
  .pattern-view-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
  }

  /* One shared content column, centered both axes. margin:auto centers it in the
     panel when there's room and collapses to top-aligned + scrollable when the
     content is taller than the panel (no clipping on short screens). */
  .pattern-view-inner {
    margin: auto;
    width: 100%;
    max-width: 820px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .apply-btn {
    width: 100%;
    min-height: 52px;
    margin: 6px 0 0;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(135deg, var(--theme-blue, #6f9bff), #4b7bff);
    color: #fff;
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
