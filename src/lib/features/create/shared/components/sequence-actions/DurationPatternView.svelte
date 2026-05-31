<!--
  DurationPatternView.svelte

  Chrome-free duration-pattern editor body, rendered INLINE inside the Sequence
  Actions panel as a drill-down view (no Drawer wrapper). Single-lane duration
  binding via PatternStripEditor; Apply tiles the strip to a DurationPattern and
  runs the proven duration-pattern-manager.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { DURATION_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import { stampSingle } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { stripToDurationPattern } from "../../domain/pattern-strip-apply";
  import * as durationPatternManager from "$lib/features/create/shared/services/duration-pattern-manager";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    sequence: SequenceData | null;
    onApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
  }

  let { sequence, onApply }: Props = $props();

  const DUR_VALUES: StripValue[] = [1, 1.25, 1.5, 2, 4];
  const fmtDur = (v: StripValue) => (v === 1 ? "1×" : `${v}×`);
  const binding: StripBinding = {
    lanes: 1,
    rhythms: DURATION_RHYTHMS,
    valueList: DUR_VALUES,
    amountList: [1.25, 1.5, 2, 4],
    base: 1,
    format: fmtDur,
    laneColors: ["accent"],
    laneLabels: ["Hold"],
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1);

  let strip = $state<StripValue[][]>([[2, 1, 1, 1]]);

  // Seed the downbeat rhythm (P---) at x2 hold once on mount (entering view).
  onMount(() => {
    strip = [stampSingle(DURATION_RHYTHMS[2]!, initPeriod, 2, 1)];
  });

  function applyStrip() {
    if (!sequence) return;
    const pattern = stripToDurationPattern(
      strip[0]! as number[],
      sequence.steps.length
    );
    const result = durationPatternManager.applyPattern(pattern, sequence);
    if (result.success && result.sequence) {
      onApply({ sequence: result.sequence, warnings: result.warnings });
    }
  }
</script>

<div class="pattern-view-body">
  <PatternStripEditor
    {binding}
    sequenceLength={seqLen}
    value={strip}
    onChange={(v) => (strip = v)}
  />
  <button class="apply-btn duration" onclick={applyStrip} disabled={!sequence}>
    Apply to sequence
  </button>
</div>

<style>
  .pattern-view-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    /* One shared content column — see TurnPatternView for rationale. */
    width: 100%;
    max-width: 820px;
    margin-inline: auto;
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
    background: linear-gradient(135deg, var(--theme-accent, #2dd4bf), #0e8f80);
    color: #fff;
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
