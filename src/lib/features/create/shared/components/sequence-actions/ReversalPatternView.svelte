<!--
  ReversalPatternView.svelte

  Chrome-free reversal editor body — a 2-lane BOOLEAN pattern strip (reverse
  on/off per beat per hand) rendered inside the Direction drawer's "Reversals"
  mode. Length × Rhythm × boolean strip; Apply tiles the strip and runs the
  idempotent applyReversalMatrix solver, which flips each hand's spin so the
  detected reversal dots land exactly on the matrix (WYSIWYG), re-derives
  letters and recomputes orientations.

  A reversal only exists where a prop is spinning, so dash/static beats can't
  carry one. The caption surfaces each hand's spinnable-beat count so the result
  (fewer dots than cells when dashes are present) reads as intentional.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import SettingsDrillRow from "$lib/shared/ui/components/settings-drill/SettingsDrillRow.svelte";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import {
    perHandRhythmMatches,
    stampPerHand,
    tilePeriod,
  } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { applyReversalMatrix } from "$lib/features/choreo-card/services/reversal-seed-service";
  import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
  import { reversalStripStore } from "./reversal-strip-store.svelte";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ReversalEditorStage } from "./direction-drill-route";

  interface Props {
    sequence: SequenceData | null;
    stage?: ReversalEditorStage;
    onStageChange: (stage: ReversalEditorStage) => void;
    onApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
  }

  let {
    sequence,
    stage = "overview",
    onStageChange,
    onApply,
  }: Props = $props();

  const binding: StripBinding = {
    lanes: 2,
    rhythms: PER_HAND_RHYTHMS,
    valueList: [false, true],
    base: false,
    activeValue: true,
    cellKind: "toggle",
    format: () => "", // toggle cells render an icon, not the value
    laneColors: ["blue", "red"],
    laneLabels: ["Left", "Right"],
    // amountList omitted → AMOUNT row hidden (reversal is binary on/off)
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1);

  /** Per-hand count of beats whose prop actually spins (cw/ccw). Reversals can
   *  only land on these — dash/static beats hold no spin to flip. */
  const spin = $derived.by(() => {
    const steps = sequence?.steps ?? [];
    let left = 0;
    let right = 0;
    for (const s of steps) {
      const b = s.motions?.[MotionColor.BLUE]?.rotationDirection;
      const r = s.motions?.[MotionColor.RED]?.rotationDirection;
      if (b === "cw" || b === "ccw") left++;
      if (r === "cw" || r === "ccw") right++;
    }
    return { left, right, total: steps.length };
  });
  const hasInert = $derived(spin.left < spin.total || spin.right < spin.total);

  /** Per-lane, period-aligned mask: a strip cell is inert when none of the
   *  sequence beats it tiles onto are spinning for that hand. Lets the strip
   *  grey the cells where a toggle would have no effect. */
  const inertMask = $derived.by((): boolean[][] | undefined => {
    const steps = sequence?.steps ?? [];
    const len = steps.length;
    const period = strip[0]?.length ?? 0;
    if (!len || !period) return undefined;

    const spins = (color: MotionColor) =>
      steps.map((s) => {
        const d = s.motions?.[color]?.rotationDirection;
        return d === "cw" || d === "ccw";
      });
    const cellInert = (beatSpins: boolean[]) =>
      Array.from({ length: period }, (_, p) => {
        for (let b = p; b < len; b += period) if (beatSpins[b]) return false;
        return true;
      });

    // Lane order matches binding.laneColors: [0] Left=blue, [1] Right=red.
    return [
      cellInert(spins(MotionColor.BLUE)),
      cellInert(spins(MotionColor.RED)),
    ];
  });

  function seedAlternating(): StripValue[][] {
    const alt = stampPerHand(
      PER_HAND_RHYTHMS[2]!,
      initPeriod,
      true,
      false,
      false
    );
    return [alt.blue, alt.red];
  }

  // Restore the persisted matrix; the store outlives this component's mount so
  // the user's layout survives navigating back to the actions grid and returning.
  let strip = $state<StripValue[][]>(
    reversalStripStore.value ?? seedAlternating()
  );
  const period = $derived(strip[0]?.length ?? 1);
  const repetitions = $derived(seqLen / period);
  const activeRhythm = $derived(
    PER_HAND_RHYTHMS.find(
      (rhythm) =>
        (rhythm.period == null || rhythm.period === period) &&
        perHandRhythmMatches(rhythm.sym, strip[0] ?? [], strip[1] ?? [], false)
    )?.label ?? "Custom"
  );
  const reversalCounts = $derived({
    left: (strip[0] ?? []).filter(Boolean).length,
    right: (strip[1] ?? []).filter(Boolean).length,
  });

  // Seed only on a fresh session or when the persisted period no longer tiles
  // the current sequence length (e.g. the sequence was resized while away).
  onMount(() => {
    const persisted = reversalStripStore.value;
    const period = persisted?.[0]?.length ?? 0;
    const compatible = period > 0 && seqLen % period === 0;
    if (!persisted || !compatible) {
      strip = seedAlternating();
      reversalStripStore.set(strip);
    }
  });

  function handleChange(v: StripValue[][]) {
    strip = v;
    reversalStripStore.set(v);
  }

  let applying = $state(false);
  async function applyStrip() {
    if (!sequence || applying) return;
    applying = true;
    try {
      const len = sequence.steps.length;
      const left = tilePeriod(strip[0]! as boolean[], len);
      const right = tilePeriod(strip[1]! as boolean[], len);
      const edges = await loadDiamondEdges();
      // left lane = blue (Left hand), right lane = red (Right hand).
      const next = applyReversalMatrix(sequence, left, right, edges);
      onApply({ sequence: next });
    } finally {
      applying = false;
    }
  }
</script>

<div class="pattern-view-body">
  <div class="reversal-surface">
    {#if stage === "overview"}
      <div class="reversal-overview">
        <SettingsDrillRow
          label="Length"
          value={`${period} steps · repeats ${repetitions}×`}
          onclick={() => onStageChange("length")}
        />
        <SettingsDrillRow
          label="Rhythm"
          value={activeRhythm}
          onclick={() => onStageChange("rhythm")}
        />
        <SettingsDrillRow
          label="Result"
          value={`${reversalCounts.left} left · ${reversalCounts.right} right per cycle`}
          onclick={() => onStageChange("result")}
        />
      </div>
    {:else}
      <div class="reversal-detail">
        <PatternStripEditor
          {binding}
          sequenceLength={seqLen}
          value={strip}
          onChange={handleChange}
          {inertMask}
          fitAvailableHeight
          visibleAxis={stage}
        />
        {#if stage === "result"}
          <p class="reversal-note" class:emphasis={hasInert}>
            A reversal flips a spinning prop, so dash and static steps stay put.
            <span class="counts"
              >Left spins on <b>{spin.left}</b>/<b>{spin.total}</b> steps, Right
              on <b>{spin.right}</b>/<b>{spin.total}</b>.</span
            >
          </p>
        {/if}
      </div>
    {/if}
  </div>
  <div class="pattern-action-footer">
    <button
      class="apply-btn reversal"
      onclick={applyStrip}
      disabled={!sequence || applying}
    >
      {applying ? "Applying…" : "Apply to sequence"}
    </button>
  </div>
</div>

<style>
  .pattern-view-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* `safe center` + scroll, never `margin: auto` + `overflow: hidden`: the
     latter centres content taller than the box and then silently clips both
     ends of it, which is how the overview's Result row lost its bottom edge. */
  .reversal-surface {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 12px 6px;
    display: flex;
    flex-direction: column;
    justify-content: safe center;
  }

  .reversal-overview,
  .reversal-detail {
    flex: 0 0 auto;
    margin-inline: auto;
    width: 100%;
    max-width: 820px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pattern-action-footer {
    flex: 0 0 auto;
    padding: 6px 12px 10px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10131a) 94%,
      transparent
    );
  }

  .apply-btn {
    width: 100%;
    display: block;
    max-width: 820px;
    min-height: var(--min-touch-target, 44px);
    margin: 0 auto;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(135deg, #a78bfa, #7c3aed);
    color: #fff;
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reversal-note {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--theme-text-dim);
  }

  /* Brighter when some beats can't reverse — that's when the count matters. */
  .reversal-note.emphasis {
    color: var(--theme-text, #e7ecf3);
  }

  .reversal-note .counts {
    font-variant-numeric: tabular-nums;
  }

  .reversal-note b {
    font-weight: 700;
    color: var(--theme-accent, #2dd4bf);
  }

  @container sequence-action-subview (max-width: 599px) and (max-height: 430px) {
    .reversal-surface {
      padding: 8px 10px 4px;
    }

    .pattern-action-footer {
      padding: 4px 10px;
    }
  }

  @container sequence-action-subview (min-width: 600px) and (max-height: 540px) {
    .reversal-surface {
      padding: 6px 10px;
    }

    /* min-height, not height: the block still fills the short foldable drawer,
       but grows past it rather than hiding the overflow from the scroller. */
    .reversal-overview,
    .reversal-detail {
      min-height: 100%;
      gap: 4px;
      justify-content: safe center;
    }

    .reversal-note {
      font-size: var(--font-size-compact, 12px);
    }
  }
</style>
